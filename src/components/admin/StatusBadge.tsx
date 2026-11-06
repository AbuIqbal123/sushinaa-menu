import type { ReactNode } from 'react';

/** One visual owner for admin status pills. Callers pass the tone key and label. */
export function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`staff-status status-${status}`}>{children}</span>;
}
