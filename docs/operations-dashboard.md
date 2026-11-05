# Sushinaa operations workspace

The CMS dashboard and live order queue use the existing collection-order database. No schema migration, delivery integration or order-number change is needed.

## Owner and branch views

Owners can select all branches or one branch in the shared header. This scopes the dashboard, live queue, history and export. Branch staff remain restricted to their assigned branch on the server, including analytics and CSV downloads.

The dashboard shows live Received, Preparing and Ready counts, irrespective of the reporting dates. Performance cards, branch sales, charts and popular dishes default to the last 7 days in Qatar time (changeable in the period control). Custom periods and exports are limited to 92 days. The live queue puts the newest orders first; history contains collected, cancelled and refunded orders. Live updates pause in hidden tabs and back off on connection failures.

## What the figures mean

- Only kitchen-visible orders count: pay-at-pickup orders, or confirmed paid online orders. Unpaid online checkout attempts do not count.
- Paid order value uses current order totals, excluding cancelled/refunded orders. It is not a settlement or payout statement.
- Average order excludes cancelled/refunded orders. Total order counts include them.
- Acceptance time starts at payment confirmation for online orders, or placement for pay-at-pickup. Preparation time runs from acceptance/preparing to ready. Collection wait runs from ready to collected. Missing audit stages display a dash. The preparation card includes the number of measured orders.
- Popular-item quantities respect added items, quantity amendments and voided lines. Cancelled/refunded orders are excluded.
- CSV exports include operational fields only, not customer names or contacts, and are capped at 10,000 orders. Narrow the dates if the limit is exceeded.

## Tests

`tests/operations.test.ts` covers Qatar date boundaries, branch permissions, payment exclusions, amended quantities, search and stage timings.
