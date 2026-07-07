import {
  Account,
  AccountResult,
  EngineInput,
  Finding,
  Ledger,
  Payment,
  SI,
  STATUS,
  Status,
} from "./types";
import { worstStatus } from "./status";
import { getRule } from "./rules";

const AMOUNT_EPSILON = 0.005;

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_EPSILON;
}

function contractNumbersFor(account: Account): string[] {
  return [
    account.current_contract_no,
    account.previous_contract_no_1,
    account.previous_contract_no_2,
  ].filter((c): c is string => !!c && c.trim() !== "");
}

/**
 * Process a single account end to end (SPEC §6.2). Never marks an ambiguous
 * case Complete — anything it cannot resolve becomes an explicit finding, and
 * unsupported plan types route to "For Manual Review" (SPEC §6.3 / §9).
 */
export function processAccount(
  account: Account,
  allLedgers: Ledger[],
  sis: SI[],
): AccountResult {
  const findings: Finding[] = [];
  const missing_or_numbers: Payment[] = [];
  const missing_sis: string[] = [];
  const ledger_files: {
    contract_no: string;
    file_path: string;
    url?: string | null;
  }[] = [];
  const si_files: {
    or_number: string;
    si_file_path: string;
    url?: string | null;
  }[] = [];

  const contractNos = contractNumbersFor(account);
  const siIndex = new Map<string, SI>();
  for (const si of sis) siIndex.set(si.or_number, si);

  // Ledgers belonging to this account, keyed by contract number.
  const accountLedgers = allLedgers.filter((l) =>
    contractNos.includes(l.contract_no),
  );
  const ledgerByContract = new Map<string, Ledger>();
  for (const l of accountLedgers) ledgerByContract.set(l.contract_no, l);

  // Step 3 — a ledger the account list says should exist but is not present.
  for (const contractNo of contractNos) {
    const ledger = ledgerByContract.get(contractNo);
    if (!ledger) {
      findings.push({
        status: STATUS.MISSING_LEDGER,
        detail: `Expected ledger file for contract ${contractNo} was not found.`,
        contract_no: contractNo,
      });
    } else {
      ledger_files.push({
        contract_no: contractNo,
        file_path: ledger.file_path,
        url: ledger.source_url ?? undefined,
      });
    }
  }

  // Step 4 — gather all payment rows across the account's ledgers.
  const allPayments: Payment[] = accountLedgers.flatMap((l) => l.payments);
  const paymentCount = allPayments.length;

  const currentLedger = ledgerByContract.get(account.current_contract_no);
  const previousLedgers = accountLedgers.filter(
    (l) => l.contract_no !== account.current_contract_no,
  );

  // The first (earliest-dated) payment on the current contract, used for the
  // carry-over rule below.
  const currentPaymentsSorted = currentLedger
    ? [...currentLedger.payments].sort((a, b) =>
        a.payment_date.localeCompare(b.payment_date),
      )
    : [];
  const firstCurrentPayment = currentPaymentsSorted[0];

  // Plan-type rule (SPEC §6.5). Unsupported plans (LS) never get guessed.
  const rule = getRule(account.plan_type);

  const siPresentOrNumbers = new Set<string>();
  let resolvedCarryOvers = 0;
  let orPaymentCount = 0;

  if (rule.supported) {
    // Step 5 — classify every payment.
    for (const payment of allPayments) {
      if (payment.or_number) {
        orPaymentCount++;
        const si = siIndex.get(payment.or_number);
        if (si && si.retrieved && si.si_file_path) {
          siPresentOrNumbers.add(payment.or_number);
          si_files.push({
            or_number: payment.or_number,
            si_file_path: si.si_file_path,
            url: si.si_url ?? undefined,
          });
        } else {
          missing_sis.push(payment.or_number);
          findings.push({
            status: STATUS.MISSING_SI,
            detail: `OR ${payment.or_number} has no retrieved SI.`,
            or_number: payment.or_number,
            contract_no: payment.source_contract_no,
            payment_date: payment.payment_date,
            amount: payment.amount,
          });
        }
      } else {
        // No OR number on this payment.
        const isFirstCurrent =
          firstCurrentPayment != null &&
          payment.source_contract_no === account.current_contract_no &&
          payment === firstCurrentPayment;

        if (isFirstCurrent) {
          // Check previous-contract ledger(s) for a matching entry before flagging.
          const matched = previousLedgers.some((pl) =>
            pl.payments.some((pp) => amountsEqual(pp.amount, payment.amount)),
          );
          if (matched) {
            resolvedCarryOvers++; // carried over from a previous contract — OK
          } else {
            findings.push({
              status: STATUS.FOR_BC,
              detail:
                previousLedgers.length > 0
                  ? `First payment has no OR and no previous ledger entry matches ₱${payment.amount}. B&C must confirm.`
                  : `First payment has no OR and there is no previous ledger to check. B&C must confirm.`,
              contract_no: payment.source_contract_no,
              payment_date: payment.payment_date,
              amount: payment.amount,
            });
          }
        } else {
          missing_or_numbers.push(payment);
          findings.push({
            status: STATUS.MISSING_OR,
            detail: `Payment of ₱${payment.amount} on ${payment.payment_date} has no OR number.`,
            contract_no: payment.source_contract_no,
            payment_date: payment.payment_date,
            amount: payment.amount,
          });
        }
      }
    }

    // Step 6 — count reconciliation, only if nothing else already explains a gap.
    const siCount = siPresentOrNumbers.size;
    const expected = rule.expectedSiCount({
      paymentCount,
      resolvedCarryOvers,
      orPaymentCount,
    });
    if (findings.length === 0 && siCount !== expected) {
      findings.push({
        status: STATUS.PAYMENT_COUNT_MISMATCH,
        detail: `Expected ${expected} SI(s) for ${paymentCount} payment(s) but found ${siCount}.`,
      });
    }
  } else {
    // Unsupported plan type (e.g. LS) — never guess (SPEC §6.5).
    findings.push({
      status: STATUS.MANUAL_REVIEW,
      detail: `Plan type ${account.plan_type} rules are not yet implemented. Routed for manual review.`,
    });
  }

  const status: Status = worstStatus(findings.map((f) => f.status));
  const reason =
    status === STATUS.COMPLETE
      ? ""
      : findings.map((f) => f.detail).join(" ");

  return {
    account_id: account.account_id,
    client_name: account.client_name,
    project: account.project,
    unit: account.unit,
    plan_type: account.plan_type,
    status,
    reason,
    missing_or_numbers,
    missing_sis,
    payment_count: paymentCount,
    si_count: siPresentOrNumbers.size,
    findings,
    ledger_files,
    si_files,
  };
}

/** Process every account (SPEC §6.2, batched). */
export function processAll(input: EngineInput): AccountResult[] {
  return input.accounts.map((a) =>
    processAccount(a, input.ledgers, input.sis),
  );
}
