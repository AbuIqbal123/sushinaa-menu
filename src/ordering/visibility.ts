/** Kitchen-visible orders: pay-at-pickup, or online orders that have confirmed payment. */
export const KITCHEN_VISIBLE = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";
