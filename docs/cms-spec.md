# Menu CMS implementation

Preserve the existing Next.js menu, styling, cart, Arabic/English copy and all eight dish configurations. Seed every resolved catalog value, including Arabic fallbacks, into one persistent menu document. Categories and dishes have stable IDs, explicit order and visibility; dishes also have availability. Nested option arrays preserve their explicit sequence. Existing primary and variant/style images remain editable.

Use libSQL: a local SQLite file for development or a remote libSQL database for Vercel. Store uploaded raster images in the same database, served through a media route. No ephemeral server filesystem uploads. Read menu once per server request; publish through authenticated API with revision comparison to prevent lost updates. No frontend seed fallback.

/admin provides dummy admin/admin login, dashboard, searchable grouped menu, categories and settings. Item forms cover bilingual content, price models, images, nested choices, extras, dietary labels and selection limits. Destructive operations require confirmation; category deletion is allowed only when empty. Authentication uses revocable random sessions stored server-side, HTTP-only cookies and same-origin mutation checks.

Verify seed parity against the original catalog snapshot, validation for each pricing model, auth and CRUD API workflows, persistence after restart, and public desktop/mobile English/Arabic rendering. Original public markup and CSS are the visual baseline.
