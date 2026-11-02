# Approved menu portraits

The 83 WebP photographs in `public/dishes/portrait/` cover the 74 seeded menu items and their protein/style variants. They use the owner-reviewed portrait treatment: whole dishes, extended backgrounds, matching packaging proportions and no chopstick sleeves. These are AI-edited photos; the full original photos remain available in item details.

The portrait paths are listed in `data/card-photos.json` and the shipped-image manifest. `withCardPhotos` resolves untouched original photographs and their previous seeded card crops to the new portraits, without writing to the database. Custom CMS card images or custom full-photo pairings remain unchanged. The initial menu contains the new card paths for fresh installations. No database migration, special environment variable, or local file outside the repository is needed.

Only these portrait menu slides use `object-fit: contain`, so their edges stay visible on different phone sizes. Other CMS uploads keep their existing rendering. The public menu cache key is versioned so an older cached menu does not delay the image update after deployment.

Generation used the built-in image-generation tool with each original as the edit target and the approved burger/calamari portraits as packaging and composition references. The shared food brief was to retain the dish, portions and packaging format, extend the tabletop vertically into a 9:16 composition, keep matching box types plausibly proportioned, remove chopsticks and sleeves, and leave space for menu copy. Drinks use their original product/background as the reference without adding restaurant packaging.
