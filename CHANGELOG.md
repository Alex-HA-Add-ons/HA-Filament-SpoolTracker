# Changelog

## 0.1.32
- **Live print next to loaded spool (Dashboard):** Each printer row shows the active job in a larger card—tall preview image, progress bar (including a working “unknown progress” state), **Filament used** that updates as Home Assistant reports usage, and **ETA** when your integration exposes remaining time for that printer (otherwise a dash).
- **Print progress from Home Assistant (Printers):** In **Edit printer**, you can set the monitored **print progress** entity (with discover / refresh like other sensors). SpoolTracker keeps job progress and grams-used in sync from Home Assistant during a print and during periodic checks.
- **Change status with filament safety (Print history):** Replace the status badge with a menu to set In progress, Completed, Failed, or Cancelled. Completing can **deduct** recorded grams from the linked spool or **skip** deduction; leaving **Completed** can **restore** grams to the spool or change status only—so you stay in control of inventory.

## 0.1.30

- **See the add-on URL in logs (Home Assistant):** On startup, the add-on log shows the API base address for automations and the ingress line for the sidebar UI.
- **Spool list in Home Assistant:** A second sensor lists how many spools you have and includes spool and printer details in attributes for dashboards and scripts.
- **Load a spool from Home Assistant (README):** You can call the add-on’s HTTP API from a [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) automation to set which spool is on a printer; the README explains the JSON body and when to include the printer ID.

## 0.1.28

- **See when a spool was archived (Spools):** On each spool card, the archived date and time appear in the header—same spot as the green “loaded on printer” label when a spool is active—in year-month-day and time format.
- **Pick the right spool from the list (Dashboard & Printers):** When choosing which spool is loaded on a printer, the dropdown shows remaining grams as well as name and color, so similar spools are easier to tell apart.
- **Consistent inactive spools (Spools, Dashboard, Print history, Home Assistant):** Archived spools are treated the same in filters, the dashboard, print history, reminders, and what Home Assistant reflects for active spools.
- **Easier standalone Docker updates:** If you run the add-on in Docker outside the Home Assistant OS stack (see README), the database updates automatically when the container starts, with fewer manual steps after an upgrade.
- **Home Assistant add-on:** Startup now applies the same migration step as standalone Docker instead of a schema “push,” so upgrades add archived-spool timestamps correctly and avoid failed syncs that left the database out of date (which could break the active-spool sensor).

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

