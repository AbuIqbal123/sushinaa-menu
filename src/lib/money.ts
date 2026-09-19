export function formatQar(amount: number): string {
  if (Number.isInteger(amount)) return `${amount} QAR`;
  return `${amount.toFixed(2)} QAR`;
}

export function formatQarShort(amount: number): string {
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2);
}
