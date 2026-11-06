/** Stable fingerprint for comparing a live basket to a placed unpaid receipt. */
export type PlacedLineFingerprint = {
  dishId: string;
  selection: unknown;
  quantity: number;
  note: string;
  unitMinor: number;
};

function lineKey(line: PlacedLineFingerprint) {
  return JSON.stringify({
    dishId: line.dishId,
    selection: line.selection,
    quantity: line.quantity,
    note: line.note,
    unitMinor: line.unitMinor,
  });
}

/** True when the cart and placed lines are the same multiset (order-independent). */
export function cartMatchesPlaced(
  cart: PlacedLineFingerprint[],
  placed: PlacedLineFingerprint[],
) {
  if (cart.length !== placed.length) return false;
  const left = cart.map(lineKey).sort();
  const right = placed.map(lineKey).sort();
  return left.every((key, index) => key === right[index]);
}
