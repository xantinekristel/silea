import { Fragment, useState } from "react";
import { AccountResult } from "../engine/types";
import { StatusChip } from "./StatusChip";

export function ResultsTable({
  results,
  exceptionsOnly,
}: {
  results: AccountResult[];
  exceptionsOnly?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = exceptionsOnly
    ? results.filter((r) => r.status !== "Complete – Ready for Submission")
    : results;

  if (rows.length === 0) {
    return (
      <p className="muted">
        {exceptionsOnly
          ? "No exceptions — every processed account is complete."
          : "No accounts processed yet."}
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Client</th>
            <th>Project / Unit</th>
            <th>Plan</th>
            <th>Status</th>
            <th className="num">Pmts</th>
            <th className="num">SIs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = open === r.account_id;
            return (
              <Fragment key={r.account_id}>
                <tr>
                  <td className="mono">{r.account_id}</td>
                  <td>{r.client_name}</td>
                  <td>
                    {r.project} / {r.unit}
                  </td>
                  <td>{r.plan_type}</td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                  <td className="num">{r.payment_count}</td>
                  <td className="num">{r.si_count}</td>
                  <td>
                    <button
                      className="link"
                      onClick={() => setOpen(isOpen ? null : r.account_id)}
                    >
                      {isOpen ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="detail-row">
                    <td colSpan={8}>
                      <div className="detail">
                        {r.reason && (
                          <p>
                            <strong>Reason:</strong> {r.reason}
                          </p>
                        )}
                        {r.findings.length > 0 && (
                          <ul>
                            {r.findings.map((f, i) => (
                              <li key={i}>
                                <StatusChip status={f.status} /> {f.detail}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="detail-files">
                          <div>
                            <strong>Ledger files</strong>
                            <ul>
                              {r.ledger_files.length ? (
                                r.ledger_files.map((f) => (
                                  <li key={f.file_path} className="mono">
                                    {f.url ? (
                                      <a href={f.url} target="_blank" rel="noreferrer">
                                        {f.file_path}
                                      </a>
                                    ) : (
                                      f.file_path
                                    )}
                                  </li>
                                ))
                              ) : (
                                <li className="muted">none</li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <strong>SI files</strong>
                            <ul>
                              {r.si_files.length ? (
                                r.si_files.map((f) => (
                                  <li key={f.or_number} className="mono">
                                    {f.url ? (
                                      <a href={f.url} target="_blank" rel="noreferrer">
                                        {f.si_file_path}
                                      </a>
                                    ) : (
                                      f.si_file_path
                                    )}
                                  </li>
                                ))
                              ) : (
                                <li className="muted">none</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
