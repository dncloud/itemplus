# Changelog

## 1.2.8 - 2026-06-14

### Update banner
- Fixed the update banner dismissal behavior so ignoring an update only hides that exact installed/available version pair instead of suppressing all future update notices in the browser.
- Made the web app treat the generic `/api/update-status` `available` flag as a valid update signal in addition to the detailed release/commit flags.
- Renamed the permanent-looking “Do not show again” action to “Ignore this update” / “Dieses Update ignorieren” to better match the new scoped behavior.

## 1.2.7 - 2026-06-14

### SQLite reliability
- Fixed SQLite `database is locked` errors during device-session reconciliation by closing the session query before stale sessions are marked offline.
- Configured SQLite with a single database connection, WAL mode, normal synchronous mode, a longer busy timeout, and foreign-key enforcement while leaving MySQL/MariaDB behavior unchanged.

## 1.2.6 - 2026-06-12

### Manual updater
- Added the separate `itemplus-update` binary for explicit, admin-controlled update checks without adding any automatic external calls to the running item+ server.
- Added `itemplus-update --check`, which checks the GitHub release and main commit state, compares them with the installed version/build, stores the result locally in the database, and lets the web app show a local update notice.
- Added `itemplus-update --download`, which downloads the matching server binary for the current platform into a local `updates/` folder and stores the downloaded build, asset name, and path in the database without replacing or restarting anything automatically.
- Removed the planned `--run` mode before release; item+ deliberately does not self-replace its running server binary. Administrators remain responsible for stopping the service, copying the downloaded binary into place, and starting item+ again.
- Added a calm update banner in the web app with release notes, installed/available build details, dismiss handling, and a “do not show again” option stored only in the browser.

### AI update
- Reworked the AI settings area around explicit OpenAI and Ollama profiles, including active-profile selection, per-profile prompts, clearer model/provider controls, optional Ollama API keys for cloud web search, masked stored-key indicators, and OpenAI model discovery.
- Added an Ollama vision-capability toggle so local text-only models do not receive image payloads, while vision-capable models can still be used for photo-based item identification.
- Added a dedicated Chat page for testing the active Ina profile outside item and category workflows, with persistent session history, inline scrolling, markdown rendering, model/token badges, optional web search, attachments, a dynamic composer, and raw stream/debug output.
- Added AI usage tracking in the database for requests, input/output/total tokens, web-search usage, provider, model, feature area, status, latency, and provider-level summaries.
- Added the AI usage dashboard under its own main-menu section, including separate OpenAI/Ollama views, fixed time buckets for hour/day/week/month, a total view, request charts, and token charts.
- Added read-only inventory context for Ina so chat answers can use current items, quantities, locations, checkouts, categories, descriptions, and property values without granting write access.
- Tightened the free chat web-search trigger so everyday greetings or inventory questions no longer get treated as web-search requests unless the user clearly asks for current or external information.
- Improved AI response rendering with markdown support, calmer animated “Denke nach” states, animated new assistant messages, and previously-seen chat messages that reopen instantly instead of replaying the effect.
- Cleaned up old/static AI helper text and unused ballast so category, property, and item AI flows rely more on configured prompts and live conversation context.

### AI workflows, chat UX, and settings
- Added editable AI prompt templates in Settings for item parsing, category property suggestions, and property enhancement, so each installation can tune Ina to its own inventory style instead of relying on one fixed built-in prompt.
- Added a restore-to-defaults flow for those AI prompt templates and moved the API key closer to provider, model, and base URL for a clearer configuration layout.
- Reworked the category and property AI flows from “additional instructions” into a more explicit task-based chat with a visible conversational history, user/assistant roles, and a calmer message composer.
- Introduced Ina as the named assistant in the web app and aligned the assistant prompts so the model can answer in a more natural, context-aware voice instead of sounding like a generated report.
- Changed category and property AI behavior so the current conversation history is passed back into the model, allowing follow-up answers, small clarifications, and mixed relevant/irrelevant user messages to be interpreted more naturally.
- Updated the category/property AI drawers so they can be reopened from the header, remain available while a session is active, and are ended explicitly through a dedicated “end chat session” action instead of disappearing as soon as the drawer closes.
- Replaced the separate info-first category/property AI flow with a more direct chat-first interaction, including clearer follow-up handling, calmer “thinking” animation, and keyboard-friendly chat sending (`Enter` to send, `Shift+Enter` for line breaks).
- Added inline editing for select and multiselect options in the property editor, so option labels can be corrected directly without deleting and recreating them.
- Exposed more property-type details during editing, including select/multiselect custom-value settings and weight units, and removed leftover placeholders that made the editor feel more generated than intentional.
- Reworked the item-create AI drawer into the same Ina chat model: simplified header actions, fewer debug/status panels, editable basics inside the drawer, and a smaller bottom composer with chat/session/photo actions gathered in one place.
- Added contextual AI suggestion cards that attach directly to the Ina message that produced them, keeping field/property suggestions inside the conversation instead of isolating them in a detached technical block.
- Added scanned barcodes to the item-create AI context panel so Ina can see the same basis information the user sees while preparing or refining a draft.
- Restored the photo-to-Ina flow inside item creation, including connected-iPhone-only camera actions, waiting states, and showing the uploaded photo itself as a user chat message once it arrives.
- Made the item-create device bridge more tolerant of `photo.uploaded` events whose `purpose` field is missing as long as a temporary image ID is present, preventing the AI photo flow from getting stuck in “waiting for photo”.
- Added temporary-image retrieval for AI uploads so freshly captured photos can be rendered directly in the chat instead of only being referenced indirectly by the AI request.
- Improved wording and localization across the Ina surfaces, including German umlauts in visible UI copy, quieter button labels such as `Senden`, and more neutral suggestion headings that fit the conversational flow better.

### Web app polish and navigation
- Moved Settings and Logout out of the sidebar account block and into compact header icons, leaving the main menu cleaner.
- Added a dedicated AI menu section with links for usage and chat/testing surfaces.
- Improved light-mode chat styling so Ina conversations remain readable outside dark mode.
- Recolored external SFTP storage settings with an emerald accent for selected sources, authentication choices, active toggles, and save actions, matching the storage domain instead of the generic blue settings accent.
- Added optional count fields for select properties, allowing schemas such as `Medium = CD-ROM` plus `Anzahl = 2` without forcing multiselect usage.
- Added one-click sorting for select and multiselect choices by name, plus an `ID` order button to return to the original saved option order before saving.
- Fixed iPhone-confirmed deletes so category properties, categories, and items refresh correctly without requiring a manual page reload.

### Attachments and external storage
- Fixed SFTP-backed video previews by serving external SFTP attachment streams through range-aware HTTP content serving, restoring browser playback, seeking, and metadata loading for MP4 and other video files.
- Silenced expected SFTP request-cancel noise during video seeking so aborted browser range requests no longer appear as real SFTP stream errors in the server log.

## 1.2.5 - 2026-06-05

### Account deletion and review compliance
- Added account deletion to the iPhone app and web app Settings area, including inline confirmation, clean logout/redirect behavior, and App Store review-compliant self-service deletion.
- Blocked account deletion while a user still has active checkouts and prevented admin accounts from deleting themselves through the regular account-deletion flow.
- Released archive and collection location manager assignments automatically when a non-admin account is deleted, so locations never remain stuck behind a removed manager.
- Localized account-deletion blockers and review-facing messaging consistently across the web app and iPhone app.

### Authentication and iPhone release polish
- Changed the iPhone Apple sign-in flow so missing accounts are no longer created implicitly on first login; users now explicitly confirm registration.
- Kept the configurable `AUTO_ACTIVATED=true|false` server behavior for new Apple and magic-link users while preserving the first-user admin bootstrap path.
- Replaced remaining system-style iPhone prompts with item+-styled cards for registration, deletion, and deletion blockers.
- Improved the scanner presentation with the darker masked preview and quieter cutout treatment refined during App Store review preparation.
- Prepared the iPhone release track for `1.2.5` with build `12501`.

## 1.2.4 - 2026-05-31

### AI, categories, and item creation
- Reworked the item-create AI flow into a quieter icon-first UI with a dedicated info drawer instead of large inline status and debug blocks.
- Added shared floating AI start notifications so item drafts, category property suggestions, and property enhancements all show the same clear “starting” feedback.
- Improved item-create AI matching so existing select and multiselect options are preferred first, while still preserving original specific values when a category allows free-text fallbacks.
- Added AI review hints for properties whose current options are too coarse, including the exact original values the model found so category schemas can be refined later.
- Added AI-assisted property suggestion for existing categories and AI-assisted improvement for existing properties, including additional-instructions fields for legacy, collector-focused, and standards-heavy datasets.
- Added support for custom `Other (free text)` values in select and multiselect properties without changing the underlying property model.
- Simplified barcode-first AI identification and improved timeout handling for slower OpenAI Responses requests, with clearer user-facing timeout messaging.

### Web app polish
- Fixed the new-item barcode handoff so scanned barcodes are consumed once and no longer reappear after leaving and reopening the item form.
- Added a custom item+ 404 page and a hidden easter egg route mode with an `iddqd` god mode cheat for the 404 mini-game.
- Improved light-mode contrast for item detail checkout banners and related status surfaces so TWP-inspired light styling stays readable.
- Fixed category location ordering persistence for both top-level locations and nested child locations.
- Added a reusable floating notification component for richer in-app feedback patterns.
- Added consistent pending-delete spinners for users, categories, locations, vendors, and attachments so iPhone-confirmed deletes now visibly wait everywhere instead of only on items.

### iOS app
- Switched the home screen browser activity area from horizontal scrolling pills to a clearer vertical session list.
- Replaced the plain delete-confirm popup for remote web-triggered deletes with a custom-styled in-app confirmation overlay.
- Fixed multiple Swift 6 concurrency issues in the printer bridge service around sendable closures, finish-state handling, and pointer access.
- Reworked the scanner overlay with a darker masked camera preview, cleaner centered cutout, and calmer header styling.
- Polished the login flow for App Store review with a configurable default server, clearer server settings, earlier language selection, and a localized Apple sign-in button.

### Authentication and review readiness
- Added `AUTO_ACTIVATED=true|false` to the Go server configuration so new Apple and magic-link users can either become active immediately or still require manual admin activation.
- Kept the first user bootstrap path as an always-active admin while leaving follow-up account activation configurable per installation.
- Simplified first-review onboarding by allowing demo and review setups to default to direct sign-in without weakening the permission model.

### Landing and public docs
- Moved the landing site to a Jekyll-based GitHub Pages layout under `docs`, with matching privacy and imprint pages, DE/EN switching, and refreshed product copy.
- Updated the landing feature section to better reflect current item+, including bundles, components, managed SFTP attachment sources, and the companion role of the iPhone app.

## 1.2.3 - 2026-05-30

### Backend and web app
- Added app-wide barcode handoff from the iPhone bridge so barcode scans can open the web app directly in the new-item flow.
- Fixed AI settings loading on MariaDB/MySQL by quoting `app_settings.key`, so enabled AI state now survives reloads correctly.
- Refined AI request handling with a lighter barcode-first identification mode, locale-aware response language, simpler enrichment prompts, and safer output token handling.
- Improved streaming robustness for AI suggestions by processing the final SSE buffer correctly when the model returns the result at stream end.

### iPhone bridge
- Upgraded the default scanner flow to handle QR codes and linear barcodes together, forwarding regular product barcodes into the existing web app item-creation path.
- Updated scan labels and messaging so the bridge now presents barcode-aware code scanning more clearly.

## 1.2.2 - 2026-05-23

### Backend and web app
- Preserved the active realm when mobile bridge events open an item in the browser, preventing archive/collection mix-ups for matching item IDs.
- Updated the browser bridge handler so item navigation from connected mobile clients switches realm before opening the item detail page.
- Removed the packaged Linux/systemd installer, unit, and config example; the README now keeps Linux service setup as manual guidance only.

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
