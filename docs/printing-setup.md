# Receipt printer setup

The branch laptop prints tickets from the orders screen in Chrome. The printer is an E200L: 80mm thermal paper, ESC/POS, USB or network. Install it as a normal printer. The site does not talk to the printer directly.

## Driver

Install the E200L driver from the disc that came with the printer, or from the vendor download that matches the label. Set the paper to an 80mm roll (72mm printable). Turn on “cut after document” if the driver offers it. Print a test page from the system printer settings.

## Default printer

Windows: Settings › Printers & scanners. Turn off “Let Windows manage my default printer”, then set the E200L as the default.

macOS: System Settings › Printers & Scanners › Default printer. Choose the E200L.

## Chrome shortcut

Make a desktop shortcut whose target is:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\SushinaaPrint" https://test-dev-abu-iqbal-projects.vercel.app/admin
```

macOS:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk-printing --user-data-dir="$HOME/SushinaaPrint" https://test-dev-abu-iqbal-projects.vercel.app/admin
```

That address is the Sushinaa dev website. After an approved release, use the live site's /admin instead.

The separate profile makes the flag apply even when Chrome is already open.

Open that profile once without `--kiosk-printing`. Print one ticket. Choose 80mm roll paper in portrait orientation, set scale to 100%, set margins to None, and turn headers and footers off. Do not select A4, landscape, or “fit to page”. The site requests an 80mm page whose height follows the receipt content; the installed driver must also be set to the 80mm roll. Then use the shortcut.

## Daily use

Sign in. On the orders screen, turn on “Auto-print on this device”. Leave the orders tab in front so Chrome does not slow its polling.

Auto-print is stored on that browser only, and it starts off. Phones do not print unless someone turns it on there.

The browser can tell that a ticket reached the print queue. It cannot tell whether paper came out.

## Receipt layout and order sounds

Manual print and reprint use the branded receipt layout, with the logo, branch, order number, car details, bilingual item headings, item choices/notes, totals and an order-reference barcode. Print frames wait for the logo and Arabic font before opening the dialog. Adjusted and voided items remain visible on amended receipts.

Order sounds start enabled on a new browser. Click anywhere in the CMS once to allow browser audio; “Sound on” can then be clicked to mute it. A saved mute choice remains in effect after reopening the CMS. This is independent of printing.
