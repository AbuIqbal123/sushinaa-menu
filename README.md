# Sushinaa menu

The public QR menu for Sushinaa. Guests browse dishes using a category dropdown, bilingual search, and dietary filters. They can save items with individual notes to show staff. Selections stay on the device; nothing is submitted to the kitchen and the menu does not take payment. Prices are in QAR.

## Run

```bash
npm install
npm run dev
```

The menu opens at [http://localhost:3005](http://localhost:3005).

For phone testing on the same Wi-Fi, allow the computer's exact LAN address:

```bash
SUSHINAA_PREVIEW_HOST=YOUR_LAN_IP npm run dev -- --hostname 0.0.0.0 --webpack
```

Open `http://YOUR_LAN_IP:3005` on the phone. Use development mode for this HTTP preview; production headers require HTTPS for assets. A push to `main` updates the live menu.

## Layout

- `src/app` — the pages
- `src/catalog` — dishes, prices, and choices
- `src/ordering` — how a selection is priced and kept on the device
- `src/i18n` — English and Arabic
- `src/components/menu` — the scrolling menu
- `src/components/order` — the saved selection sheet
- `src/components/site` — contact and legal pages
- `src/lib` — company facts, money, and page titles
- `public` — the photos, logo, and fonts the site serves

Spreadsheets, print menus, and brand files stay in `reference/` on this machine. They are not part of the site.
