import { terminalStatuses } from '@/ordering/status';

export function closeLiveDetailOnRefresh(status: string, closeOnTerminal: boolean) {
  return closeOnTerminal && (terminalStatuses as readonly string[]).includes(status);
}
