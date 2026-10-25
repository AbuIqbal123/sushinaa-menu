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
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\SushinaaPrint" https://test-dev-abu-iqbal-projects.vercel.app/cms/orders
```

Use the site the branch actually signs in to. The separate profile makes the flag apply even when Chrome is already open.

Open that profile once without `--kiosk-printing`. Print one ticket. Set margins to None, and turn headers and footers off. Then use the shortcut.

## Daily use

Sign in. On the orders screen, turn on “Auto-print on this device”. Leave the orders tab in front so Chrome does not slow its polling.

Auto-print is stored on that browser only, and it starts off. Phones do not print unless someone turns it on there.

The browser can tell that a ticket reached the print queue. It cannot tell whether paper came out.
