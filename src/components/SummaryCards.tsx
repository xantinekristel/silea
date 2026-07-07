import { AccountResult } from "../engine/types";
import { ALL_STATUSES, STATUS_TONE } from "../engine/status";
import { summaryCounts } from "../engine/outputs";

export function SummaryCards({ results }: { results: AccountResult[] }) {
  const counts = summaryCounts(results);
  return (
    <div className="cards">
      {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
        <div key={s} className={`card card-${STATUS_TONE[s]}`}>
          <div className="card-count">{counts[s]}</div>
          <div className="card-label">{s}</div>
        </div>
      ))}
    </div>
  );
}
