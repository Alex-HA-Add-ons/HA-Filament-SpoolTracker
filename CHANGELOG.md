# Changelog

All notable changes to this project will be documented in this file.

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

