# Changelog

## 1.4.0 - 2026-10-11

This release reworks most of the web app, opens loans to every user, adds notifications inside the app, brings Claude as an AI provider and replaces the first-start setup. The separate update program is gone. Please read "Before you update" first.

### Before you update
- **The update program `itemplus-update` no longer exists.** A release now consists of five server binaries. Update by replacing the server binary; if `itemplus-update` and an `updates/` folder still lie next to your server, you can delete them.
- **item+ never contacts another server on its own.** A notice about new versions only appears when you set `UPDATE_CHECK=release` (published releases) or `UPDATE_CHECK=build` (also unreleased builds) in `itemplus.conf`. The server then asks `api.github.com` once a day. Nothing is downloaded or installed, and there is no switch for this in the web app.
- **Every item needs a category.** Creating an item without one is refused, and a change can move an item to another category but not remove it. Items that lost their category or location in the past are listed for administrators under **Settings > Storage > Orphaned items**, where they are restored or assigned.
- **An item that is lent out cannot be deleted**, neither on its own nor as a bundle with lent parts, and neither can a user with active loans. Return first.
- **Loans are open to every signed-in user.** Without the right `checkout.manage` people see only their own loans and requests, and they report a return instead of closing the loan themselves (see below).
- **AI prompts:** the default prompts were rewritten. Profiles that still use the old defaults follow the new ones automatically; prompts you edited stay as they are.
- On MySQL/MariaDB the server removes rows at startup that deleted items and categories left behind, and on both engines it renumbers attachments that shared a position.

### Loans and notifications
- The **Loans** page is the one place for lending. Every user finds there what they have borrowed and asked for, in both realms; people with `checkout.manage` see everything in the current realm.
- A borrower reports a return. The loan stays active until someone with `checkout.manage` confirms it or dismisses the report, so nothing is "returned" without a second pair of eyes.
- Open requests and reported returns are shown as cards above the list. A request is visible to the person who made it and to those who manage loans.
- New **notifications**: stored messages for the steps of a loan (requested, approved, rejected, return reported, confirmed, dismissed), with a bell in the header and a messages page. They need neither the iPhone app nor push, are written in the reader's language, and nobody is notified about their own action.
- Menu badges count what waits in the current realm; the realm switch shows what waits in the other one.

### Web app
- Navigation: a group tile opens the page last visited in it, and badges show a count.
- Dashboard: figures, growth, categories, activity by kind of movement, value by category and items by location; in the collection a find of the day and, with a game catalog that offers it, collection progress per platform.
- Item list: a card and a table view per realm, with per-realm choices of what a card shows and a sort menu. Each item has printing as an icon and a menu with its stock, loans and maintenance; deleting is the last entry there. The badges "lent to" and "due/overdue" lead to the loans and the maintenance of the item.
- Item page: catalog games show cover and facts side by side, empty fields are hidden, and the QR code has its own popover.
- Item form: an action bar that stays in view with links to the sections, properties laid out by their configured width, and save errors that are shown.
- Categories: a layout preview, the width of a property can be switched in place, and a clearer control to open a category. Category and location colours are picked from swatches or freely, with a preview for light and dark mode, and stay readable in both.
- Categories, locations and master data share one set of list and form controls; deleting sits behind a menu everywhere.
- Stock is a history grouped by day that can be filtered by item name, kind of movement and period, with calmer warning cards. Stocktaking and maintenance were redesigned.
- Users, AI usage, the chat and all settings sections follow the same design. Storage, label printer and AI settings use tiles for their choices.
- Sign-in page on a card layout; while the server does not answer, the app shows a notice and reloads when it is back.
- Nothing of the app is drawn before the server has confirmed that someone is signed in.
- Light mode: a grey page background, and fixes for headings and a menu that were white on white.

### Attachments
- Images can be dragged into order in the item form, like files already could.
- No two attachments of an item share a position any more. New ones are added at the end whatever a client asks for, and setting a position moves the others out of the way.
- "Add from source" is a file picker with source tabs, a path you can click through, a filter and a switch for hidden files.
- The four ways to add something are tiles that say what they do.

### AI assistant
- **Claude** (Anthropic) is available as a provider next to OpenAI, through Anthropic's official SDK, including web search and image input. Ollama stays as the local option for trying things out.
- The default prompts are shorter and say what Ina is for. What the server needs for technical reasons (the JSON form, value formats, how to treat text from the web or from users as material and never as instructions) is added by the server and also applies to prompts you wrote yourself.
- One "Add profile" button with a menu of providers, and AI usage statistics for all three providers.

### First start
- The first-start setup was rewritten. It asks in German or English what you want to do (use item+ on this computer, in your network, or under your own domain) and derives the technical settings from that; they are only shown on request.
- The database connection is tried at once, passwords are never shown, a summary comes before anything is saved, and you can start over with your answers kept. At the end the terminal prints a one-time link to sign in with.

### Data integrity
- Categories and locations that are in use cannot be deleted, as before; an item now always has an existing category.
- At startup on MySQL/MariaDB, values, movements, maintenance entries and bundle links of deleted items are removed, as are properties of deleted categories that no item points to. Items themselves are never changed automatically.

### Fixes
- The game catalog import numbered every 25 images from 0 again, and several images uploaded at once all got the same position. Existing items are repaired at startup.
- The maintenance badge in the item list never appeared.
- Switching the realm on the stock or loans page jumped back when the address named a realm.
- A movement list limit above 500 fell back to 100, and movements were sorted by time incorrectly on SQLite.
- The rounded corners of the loans table.

### Building from source
- `build.sh` asks what to build when started in a terminal, takes targets as arguments (`local`, `all`, `mac`, `linux`, `win`, or single platforms such as `linux-arm64`), shows progress, and `--clean` keeps configuration, data, logs and uploads.

## 1.3.4 - 2026-10-09

This release fixes several security problems and a group of failures that only showed on one of the two supported database engines. Updating is recommended for every installation. Please create a new backup after updating: backups made with 1.3.3 or earlier are incomplete (see below).

### Security
- Fixed an account takeover through Sign in with Apple: an Apple ID could be attached to an existing account by naming that account's e-mail address in the request. Accounts are now matched only by the address Apple has verified and signed, and an existing Apple link is never replaced.
- The e-mail address of an account can no longer be changed by its owner, since it identifies the account for magic-link and Apple sign-in. Administrators can still correct it; the new address is validated and must not belong to another account.
- QR login now hands out the session exactly once. Previously anyone who knew the code could collect a session of their own until the code expired.
- Magic links and QR confirmations can no longer be redeemed twice by simultaneous requests.
- Login tokens and WebSocket tickets are masked in the access log.
- SVG uploads are served with a restrictive content security policy, so an SVG opened directly cannot run scripts in the app's origin.
- The vendor logo search no longer fetches addresses on the server itself or in its internal network.
- Temporary AI images are size-limited, accepted by their actual content (JPEG, PNG, GIF, WebP) instead of the type a client claims, and served with protective headers.
- Confirming a deletion on the iPhone can no longer be skipped: a confirmation is only honoured when it comes from an iPhone connection and answers an open request.
- The last active administrator can no longer be demoted or deactivated, and unknown permissions are rejected.
- AI requests share a rate limit per client.

### Database reliability: SQLite and MySQL/MariaDB behave the same
- Fixed complete server freezes on SQLite. A direct checkout, the list of checkout requests, items with open maintenance reminders and saving properties by name could each leave the server waiting for its own database connection until it was restarted.
- Fixed startup on current MariaDB versions, where `current_path` is a reserved word.
- Text is no longer turned into numbers on the way to clients. An item called `1942` or `007`, a phone number or a scanned code stays exactly as entered, and names such as `NaN` or `Infinity` no longer break item lists.
- Deleting an item now gives the same result on both engines. MySQL used to keep every dependent row, SQLite removed all of them.
- A magic link requested without a language no longer fails as "invalid".
- The test suite now runs against SQLite and MySQL/MariaDB.

### Backup and restore
- Backups are now complete dumps of the database. The previous format left out stock movements, maintenance reminders and history, bundle contents, sales platforms, inventory audits and user settings. **Backups created with 1.3.3 or earlier do not contain these; create a new backup after updating.**
- A restore first prepares everything next to the running system and exchanges it at the end. If the backup turns out to be unusable, nothing is changed.
- Restoring on MySQL/MariaDB no longer leaves rows from before the restore attached to restored items.
- A backup can only be restored into the database engine it was created with. Restoring a SQLite backup into MySQL, or the other way round, is refused with a clear message.
- Backup and restore no longer use the system temp directory, which failed on systems where it is a separate or in-memory filesystem and could leave the SQLite database closed.
- Older backups can still be restored, with what they contain.

### Checkouts, stock and deleting
- Approving a checkout request now records the "lent" stock movement, like a direct checkout always did, and approval, checkout and movement succeed or fail together. Missing movements of existing checkouts are added once at startup.
- Loans survive the deletion of their item. They stay listed as a loan of an unknown item and can still be returned.
- Uploaded files are no longer removed when an item is deleted. Administrators find them under **Settings > Storage > Unconnected files**, together with leftovers of earlier deletions, and decide what to remove.
- Categories and locations that are still in use cannot be deleted. The web app says how many items or sub-locations still refer to them.
- Quantities must be whole numbers and not negative.
- Updating an item that does not exist answers "not found" instead of a server error.

### Accounts and devices
- Added **Connect Apple ID** for accounts registered by e-mail whose Apple ID uses a different or hidden address: either with a code sent to the account's address, or by scanning a QR code shown under **Settings > Account**. Using it needs an iPhone app version that supports it.
- Every browser tab and device now has its own live session. Previously several tabs, or several devices behind one router, shared a session and only the last one received live updates.
- Fixed a magic link showing "invalid or expired" after a successful sign-in when the page was loaded twice.

### Collections, master data and storage
- Added an optional game catalog integration for the collection realm. With `GAME_CATALOG_URL` set, item+ can create matching categories under **Settings > App**, search the catalog while an item is created (including shortcuts such as `pc:`), take over the declared properties and import selected images as regular attachments. The catalog is only ever contacted by the server.
- Added developers and publishers as master data roles next to manufacturers, suppliers and vendors. Each category decides which roles its items show.
- Added a Moby score property with decimal values from 0 to 10.
- External attachment sources can now be local folders on the server and SMB shares, in addition to SFTP.

### Web app and operations
- Requests that fail without the page handling it now show a message instead of doing nothing, and the user management reports why a change was refused.
- The printer address set in the web app is kept across restarts.
- Updated Next.js to 16.4 and dependencies with known vulnerabilities.

## 1.3.3 - 2026-07-31

### Checkouts and reminder workflow
- Added manual return reminders for overdue checkouts, including a direct `Notify` action for active overdue loans, cooldown handling, reminder timestamps, and clearer status feedback in the checkout list.
- Improved checkout reminder mails so they respect the configured installation language instead of always sending mixed bilingual text, and documented the shared mail locale behavior through configuration.
- Refined overdue checkout presentation across item details and operations screens so overdue states stand out more clearly and reminder actions fit the existing item+ button language better.

### Maintenance and stock workflow
- Moved item-specific maintenance handling into dedicated per-item maintenance pages instead of keeping reminder management embedded inside the item detail view, keeping item details calmer while giving maintenance its own focused workspace.
- Added completion-note handling to maintenance history and improved how notes and status history are shown for finished reminders.
- Tightened stock movement and stock-detail navigation so operational views link to the stock perspective where it makes more sense than jumping back to the generic item detail page.
- Clarified stock movement semantics for checkout-related events by treating loan and return entries as availability changes instead of fake quantity mutations in the global stock count.

### Navigation and embedded web app stability
- Fixed sidebar behavior so favorites stay open when a page was entered through favorites, while inventory, operations, system, and settings stay open when the same target was opened through their normal section.
- Extended that navigation memory across the whole app instead of only solving it for one page, making the sidebar feel more intentional during deeper navigation.
- Fixed long-running embedded web app setups by extracting the internal Next.js build into a persistent runtime directory instead of macOS/Linux temp storage, which could be cleaned up after days of uptime.
- Routed embedded web app output back into the normal item+ logging stream so future runtime issues can be diagnosed without blind spots.

### UI polish and master data
- Improved master-data logo handling with larger list previews and continued cleanup around vendor logo resolution behavior.
- Refined item detail action shortcuts and operational links so maintenance and stock actions are easier to reach directly from the item context.
- Added and refreshed support-page content in the public docs to better match the current product and review/support expectations.

## 1.3.2 - 2026-07-07

### Session and UI hotfixes
- Fixed expired web sessions so the running app now reacts to background `401 Unauthorized` responses and cleanly returns to the login screen without requiring a full page reload.
- Reduced noisy vendor-logo preview traffic while typing by waiting for a short pause and only resolving logos automatically when a meaningful source such as a website, support URL, or explicit logo URL is available.
- Increased vendor logos in the master-data list for better readability and recognition during daily use.
- Refined the web app footer with the new `Created with love in Uelzen` line and the currently running server version on a dedicated status line above the standard links.

## 1.3.1 - 2026-07-04

### Inventory audit and operations polish
- Improved inventory audit handling so checked-out items remain visible during audits and can be tracked explicitly as loaned items instead of disappearing from the expected list.
- Refined scan action behavior during inventory audits with clearer in-progress feedback and safer disabled states when no connected iPhone scanner is available.
- Polished inventory-audit summaries and recent stock activity previews so counters, labels, and operational details stay easier to scan during daily use.

### Web app polish
- Reverted an experimental item-detail QR placement and kept the earlier hover-preview behavior after testing showed the alternative layout felt more distracting than helpful.
- Softened category and location drag handles so they still read as reorder controls without drawing too much visual attention.
- Fixed the recent stock activity preview on item detail pages so actor names remain in the correct row instead of dropping into a second line.

### SQLite startup reliability
- Fixed a SQLite migration regression in `1.3.0` where reading `PRAGMA table_info(user_settings)` could fail at startup with `missing destination name cid in *[]database.tableColumn`.

## 1.3.0 - 2026-07-02

### Operations, stock, and reminders
- Added dedicated `Stock`, `Maintenance`, and `Checkouts` workflow pages with clearer statistics, cleaner tables, and a shared operating-area structure that makes day-to-day inventory work easier to scan.
- Added stock movement history for archive-style inventory so purchases, consumption, corrections, lending, and returns no longer live only in the current quantity field.
- Added an `Inventory audit` workflow with live sessions, scanner/manual confirmations, recent reports, missing-item detection, unexpected finds, and explicit snapshot-vs-current location handling instead of silently rewriting locations during a room check.
- Expanded maintenance and reminder handling with recurrence, history, editing, skip/complete flows, overdue indicators, and dashboard/sidebar signals instead of burying everything inside item edit screens.
- Reworked checkout visibility and navigation so overdue or relevant activity is surfaced through the operating menu and page-level summaries instead of crowding the main dashboard.

### AI, chat, and master data
- Continued the Ina chat refinement across free chat, item creation, categories, properties, and vendors so AI actions feel more conversational, less technical, and easier to continue over multiple steps.
- Added AI-assisted vendor/master-data enrichment with suggested structured fields and multi-source logo suggestions, including better filtering for likely real logos instead of unrelated images or tiny favicons.
- Improved AI debug visibility with raw output, token counters, and provider/model badges so local Ollama and OpenAI behavior can be inspected more easily during tuning.
- Refined AI prompt management so profiles, prompt templates, and related settings are easier to maintain per installation while keeping the JSON contracts and response handling stable.

### Navigation, settings, and web app polish
- Reworked the main navigation into a more compact tile-based structure with clearer grouping for `Inventory`, `Operations`, `System`, and `Settings`, including per-section indicators for pending operational tasks.
- Redesigned large parts of Settings to use calmer, more consistent section layouts, less visual noise, clearer actions, and faster save feedback through top-right status toasts instead of scattered inline messages.
- Merged branding controls more naturally into the app settings flow and expanded branding customization for logo sizing, spacing, corner radius, title behavior, and related presentation details.
- Added cleaner favorites/default handling for dashboard shortcuts and continued aligning page headers, button sizing, table spacing, and general typography across the web app.

### Users, permissions, and administration
- Refined user management with clearer overview stats, lighter permission editing, avatar upload support, and a less crowded administration layout.
- Split operational permissions more precisely so stock and maintenance access can be granted separately for read and edit scenarios instead of exposing entire areas too broadly.
- Hid navigation targets and system areas that a user cannot actually use, keeping non-admin accounts focused on the parts of item+ that are relevant to their role.
- Added `IOS_REVIEW_PERMISSIONS=true|false` as an explicit development/review switch so newly created non-admin users can optionally receive all regular app permissions on isolated demo or App Review systems.

### Internal cleanup
- Continued the backend restructuring into clearer domains such as bootstrap, database, core, HTTP, printing, storage, and websocket code, reducing the old catch-all handler/service layout.
- Continued the web app cleanup by moving oversized page/component files into more focused modules and shared UI/helper areas without changing the overall product direction.

## 1.2.9 - 2026-06-14

### Update banner
- Fixed stale update banners after replacing the server binary by normalizing the stored update-check result against the currently running item+ version before the web app renders it.
- Changed the `Later` / `Später` action to hide the banner only for the current browser session instead of storing a long-lived dismissal in local storage.
- Removed the special downloaded-update banner state so downloaded updates continue to use the normal update notice wording.

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
