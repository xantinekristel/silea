import { Status } from "../engine/types";
import { STATUS_TONE } from "../engine/status";

export function StatusChip({ status }: { status: Status }) {
  const tone = STATUS_TONE[status];
  return <span className={`chip chip-${tone}`}>{status}</span>;
}
