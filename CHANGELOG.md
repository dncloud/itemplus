# Changelog

## 1.2.1 - 2026-05-22

### Web app
- Fixed item grid edit actions so they open the dedicated edit page instead of the detail view.
- Removed the duplicate top image upload from add/edit item forms and moved attachment management to the top of the edit flow.
- Added an optional setting to show attachment upload actions on item detail pages for users with attachment write permissions.
- Updated attachment upload, link, SFTP, and attachment edit dialogs to match the TWP dark form styling.
- Improved the edit page title, iPhone connection labels in English, and detail-page attachment behavior.

### Data and repository
- Added merge-safe English and German SQL import files for the curated demo data without creating users or applying bundle/checkout state.
- Added a MariaDB/MySQL clear database helper that preserves user accounts while resetting item data.
- Refreshed the public screenshots for the 1.2 web UI.

## 1.2 - 2026-05-20

### Backend
- Added first-class bundle support for archive and collection items, including locked child items, bundle-aware checkout requests, direct lending, and partial returns.
- Added generic sales platforms and item sale metadata for items marked as for sale or sold.
- Added database migrations as separate release steps for MySQL/MariaDB and SQLite.
- Added external source support for attachments and fixed local attachment uploads on MariaDB.
- Improved checkout availability, overdue calculations, and multi-user lending for quantity-based items.
- Added device presence metadata so connected clients can report their current web position.
- Hardened branding, magic-link, configuration, and upload paths for the packaged Go server.

### Web app
- Refined the item list, item detail, add/edit flows, settings, checkouts, and dashboard around the new dark TWP-style layout.
- Added bundle controls, searchable bundle child selection, bundle-aware checkout displays, and linked bundle item references.
- Added sales platform management in master data and sale filters in item search.
- Added checkout pagination, clearer period and due-date wording, and overdue badges in checkout views.
- Added branding footer text, safer magic-link email rendering, and clearer setup hints for public URLs.
- Improved search pacing, item sorting, QR preview behavior, card image ratios, and permissions-aware item properties.

### Repository
- Removed the iOS client from the public repository. The public release now ships the Go backend, web client, configuration templates, and docs.

## 2026-04-30

### TSPL label templates and printing
- Introduced database-backed TSPL label templates across the Go and Python backends.
- Added label template API endpoints for metadata, listing, creating, updating, deleting, and setting defaults.
- Switched item, location, preview/test print, calibration, and iOS bridge print jobs over to template-rendered TSPL.
- Added default template seeding and automatic fallback default reassignment when deleting the active default template.
- Included label templates in Python admin export/import so the print setup travels with the database state.
- Normalized built-in templates to a single `QR only 20x20` system template and enforced printer-friendly TSPL termination before sending.

### Printer configuration and iOS bridge
- Reduced global printer configuration to host and port only.
- Removed the legacy runtime printer speed, density, label size, and gap settings from the Go, Python, web, and iOS runtime paths.
- Aligned the local iOS printer bridge with the same built-in 20x20 TSPL style used by the server templates.
- Added websocket-based print request/result handling to the Python backend to match the cross-device bridge flow.

### Web app and settings polish
- Simplified the printer settings UI around TSPL templates and inline test printing.
- Added placeholder and TSPL command reference sections to the settings UI.
- Removed the failed preview-heavy direction and kept the template editor focused on raw TSPL authoring.
- Set English as the default locale for the web app, with German as an explicit option.
- Cleaned up mixed-language strings and tightened content widths for item details, categories, locations, and master data pages.

### Magic-link e-mails
- Reworked the magic-link e-mail layout into a cleaner branded structure.
- Switched the e-mail copy to English by default.
- Added footer links and branding elements.
- Added quoted-printable transfer encoding for more reliable HTML mail character handling.
