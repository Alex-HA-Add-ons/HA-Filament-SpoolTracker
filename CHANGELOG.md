# Changelog

## 0.1.28

- **See when a spool was archived (Spools):** On each spool card, the archived date and time appear in the header—same spot as the green “loaded on printer” label when a spool is active—in year-month-day and time format.
- **Pick the right spool from the list (Dashboard & Printers):** When choosing which spool is loaded on a printer, the dropdown shows remaining grams as well as name and color, so similar spools are easier to tell apart.
- **Consistent inactive spools (Spools, Dashboard, Print history, Home Assistant):** Archived spools are treated the same in filters, the dashboard, print history, reminders, and what Home Assistant reflects for active spools.
- **Easier standalone Docker updates:** If you run the add-on in Docker outside the Home Assistant OS stack (see README), the database updates automatically when the container starts, with fewer manual steps after an upgrade.

## 0.1.27

- **Standalone Docker run:** Run the add-on in Docker outside Hass.io while still connected to Home Assistant. Refer to the README for instructions.

## 0.1.26

- Reduce duplicate print jobs: use printer “print start” entity (e.g. `sensor.*_print_start`) to detect same print; add optional `entityPrintStart` to printer config and Edit Printer modal.
- Printer cards: full-width spool section, icon+label Edit/Remove buttons, and full-width progress/selector; add “Loaded spool” label and improve layout.
- SpoolSelect component: color dots in dropdown options; optional custom trigger (`renderTrigger`) for card-style content; used on Dashboard and Printers page.
- Dashboard Active Spools: integrate selector into the card (one block per printer: card content is the dropdown trigger; “View” link to spool detail; no duplicate spool text).
- Dashboard API: include `color` and `colorHex` in `spoolsList` so selector options show correct spool colors.
- SpoolCard: replace action text with icon + short label (Edit, Deduct, Activate/Archive, Delete) for a single-row layout.

## 0.1.24

- Footer: add link to Home Assistant community discussion.
- Active spool sensor: prefer spool loaded on the most recently updated printer so the sensor updates correctly when changing the loaded spool from the dashboard.

## 0.1.23

- Add global notification toggle and per-feature toggle for filament-change reminders in Settings.
- Detect likely filament changes from Bambu entities and, when enabled, send a reminder to update the loaded spool.
- Add dedicated “Low” filter on the Spools page and wire dashboard tiles to deep-link with filters (spools and history).
- Enhance Spool detail view with inline Deduct and Archive actions.
- Refine mobile navigation and header (integrated tab bar, hamburger drawer, updated favicon/logo).
- Add README screenshots from `docs/` and link to the Home Assistant community thread and changelog URL in `config.yaml`.

## 0.1.19

- Add cached cover image support: store print job thumbnails locally and serve via the add-on.
- Implement active spool sensor published back to Home Assistant (grams remaining, percent, type, color).
- Link printers and spools via active spool assignment and expose that on the dashboard.
- Improve dashboard UI: combined Active Spools section, clickable stats, and responsive header navigation.
- Add manual completion for in-progress print jobs and better deduction handling when assigning spools later.
- Add periodic reconciliation of in-progress jobs based on HA print status.
- Add notifications for stuck in-progress jobs when all printers are inactive.

## 0.1.18

- Internal fixes and UI refinements.

