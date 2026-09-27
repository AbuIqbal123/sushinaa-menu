# Sushinaa menu

The public QR menu for Sushinaa. Guests browse the dishes, build an order, and send it on WhatsApp. Prices are in QAR. The site does not take payment.

## Run

```bash
npm install
npm run dev
```

The menu opens at [http://localhost:3005](http://localhost:3005). A push to `main` updates the live menu.

## Layout

- `src/app` — the pages
- `src/catalog` — dishes, prices, and choices
- `src/ordering` — how a selection is priced and kept on the device
- `src/i18n` — English and Arabic
- `src/components/menu` — the scrolling menu
- `src/components/order` — the order sheet
- `src/components/site` — contact and legal pages
- `src/lib` — company facts, money, and page titles
- `public` — the photos, logo, and fonts the site serves

Spreadsheets, print menus, and brand files stay in `reference/` on this machine. They are not part of the site.
