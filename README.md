# item+

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Backend](https://img.shields.io/badge/backend-Go-green)
![Web](https://img.shields.io/badge/web-Next.js-black)

Open-source inventory and collection management for private households, collectors, and anyone who wants to keep track of their things without warehouse software, SaaS overhead, or ERP bloat.

item+ helps you track what you own, where it lives, who currently has it, what has been lent out, and the details that matter for your own setup.

## Why item+

- Keep everyday stock and personal collections in one place
- Build your own categories, properties, locations, and workflows
- Lend items out, let people ask for them, and see what needs to come back
- Track quantities, values, notes, photos, documents, and external attachments
- See what is available, what is checked out, and what needs attention
- Print QR labels and use cross-device workflows when they help
- Use optional AI assistance with OpenAI, Claude, or a local model
- No telemetry and no calls home: item+ contacts other servers only where you configured it

item+ is intentionally flexible. A box of screws, a camera collection, 3D printer filament, event equipment, game media, tools, documents, spare parts, and collectibles can all live in the same system without being forced into one fixed schema.

## Highlights

### Flexible inventory

- Two realms: **Archive** for stock-like items and **Collection** for value-oriented objects
- Custom categories, nested locations, and master data for manufacturers, suppliers, vendors, developers, publishers, and sales platforms
- A dashboard with growth, activity, value by category, and items by location
- Card and table views of the item list, set up separately for each realm
- Dynamic properties such as text, number, date, select, multiselect, condition, rating, dimensions, weight, priority, and more
- Optional count fields for select values, for example `Medium = CD-ROM` plus `Count = 2`
- Bundles and related items for kits, sets, and grouped equipment

### Lending and accountability

- One loans page for everyone: people see what they borrowed and asked for, managers see everything
- Requests that are approved or rejected, due dates, reminders, and overdue items
- A borrower reports a return; someone who manages loans confirms it
- Notifications inside the app for every step of a loan, without push or a phone app
- Stock history, stocktaking, and maintenance reminders per item
- 19 separate permissions, with administrators on top
- iPhone-assisted confirmation flows for sensitive actions when configured

### Attachments and media

- Upload photos and documents per item and drag them into order
- Store external links
- Attach files from sources the server manages: local folders, SFTP, and SMB shares
- Stream SFTP-backed video attachments with browser seeking support

### QR labels and devices

- Print QR labels with TSC-compatible thermal printers
- Scan locations and items
- Use the iPhone companion app for camera, QR login, photo bridge, barcode handoff, and confirmation flows

The iPhone companion app will be available through the App Store after Apple's review. If you would like TestFlight access before then, feel free to get in touch.

### Optional AI assistant

item+ includes optional AI workflows under the assistant name **Ina**.

- Profiles for OpenAI and Claude (Anthropic), and for a local Ollama if you want to try things without a provider
- Describe an item, scan a barcode, or send a picture, and Ina prepares the item for you to check
- Suggestions for the properties of a category and for master data records
- Web search and image input where the provider and model support them
- Per-profile prompts; text from the web or from users is treated as material, never as instructions
- Chat page for testing the active profile
- AI usage statistics for requests, tokens, provider, model, and web activity
- Read-only inventory context: the assistant can look things up but changes nothing by itself

AI is opt-in. Configure it only when you want to use it.

## Screenshots

| Login | Dashboard |
| --- | --- |
| ![Login](docs/screenshots/01-login-dark.png) | ![Dashboard](docs/screenshots/02-dashboard-dark.png) |

| Items | Item detail |
| --- | --- |
| ![Items grid](docs/screenshots/03-items-grid-dark.png) | ![Item detail](docs/screenshots/04-item-detail-dark-a.png) |

| Categories | Locations |
| --- | --- |
| ![Categories](docs/screenshots/06-categories-dark.png) | ![Locations](docs/screenshots/07-locations-dark.png) |

| Vendors | Settings |
| --- | --- |
| ![Vendors](docs/screenshots/08-vendor-dark.png) | ![Settings](docs/screenshots/09-settings-dark.png) |

## Quick Start

### Download a release

The easiest way to run item+ is the single server binary from the [latest release](https://github.com/dncloud/itemplus/releases/latest). It contains the API and the web app. Pick the file for your system:

| System | File |
| --- | --- |
| Linux, Intel/AMD | `itemplus-server-linux-amd64` |
| Linux, ARM (for example Raspberry Pi 4/5, 64-bit) | `itemplus-server-linux-arm64` |
| macOS, Apple Silicon | `itemplus-server-macos-arm64` |
| macOS, Intel | `itemplus-server-macos-amd64` |
| Windows | `itemplus-server-windows-amd64.exe` |

The web app is started by the server with Node.js, so Node.js has to be installed on the machine.

```bash
chmod +x itemplus-server-linux-amd64
./itemplus-server-linux-amd64
```

On first start, item+ creates a local `itemplus.conf` and leads you through a short setup in the terminal, in English or German. It asks how you want to reach item+ (only on this computer, in your network, or under your own domain), where the data is stored, how people sign in, and about a few optional extras. You see a summary before anything is saved, and at the end item+ prints a link to sign in with.

The setup needs an interactive terminal once. To skip it, for example in a container, prepare `itemplus.conf` yourself and remove the line `ITEMPLUS_SETUP_REQUIRED`.

The server runs the API and embedded web app together.

Useful flags:

```bash
./itemplus-server-linux-amd64 --bind 0.0.0.0 --port 17117
./itemplus-server-linux-amd64 --config /opt/itemplus/itemplus.conf
./itemplus-server-linux-amd64 --database sqlite+aiosqlite:////opt/itemplus/data/itemplus.db
./itemplus-server-linux-amd64 --upload /opt/itemplus/uploads
./itemplus-server-linux-amd64 --logs /opt/itemplus/logs
./itemplus-server-linux-amd64 --no-webapp
./itemplus-server-linux-amd64 --version
```

Open the web app in your browser at the configured host and port.

### Typical Linux layout

item+ does not ship a system installer. Keep the layout explicit and understandable for your own host.

Example:

```text
/opt/itemplus/
├── itemplus-server-linux-amd64
├── itemplus.conf
├── data/
├── uploads/
└── logs/
```

A minimal systemd command can point at the config:

```ini
ExecStart=/opt/itemplus/itemplus-server-linux-amd64 --config /opt/itemplus/itemplus.conf
```

Use a reverse proxy such as nginx or Caddy if you expose item+ publicly.

## Updates

item+ does not contact any other server on its own, and it never downloads or installs anything by itself.

If you want to be told when something newer exists, switch the update check on in `itemplus.conf` and choose what counts as newer:

```ini
# a newer published release
UPDATE_CHECK=release

# also a newer build: commits on main that are not released yet, or a rebuilt release
UPDATE_CHECK=build
```

The server then asks `api.github.com` once a day and shows a notice in the web app, with a link to the release. No data about your installation is sent. Leave the setting empty and no such request is ever made; any other value also leaves the check off.

Updating is done by hand:

1. Download the server binary for your platform from the [releases page](https://github.com/dncloud/itemplus/releases)
2. Make a backup (Settings > Backup)
3. Stop item+
4. Replace the old server binary with the new one
5. Start item+ again

That is intentional. You stay in control of service restarts, backups, permissions, and rollback.

The separate `itemplus-update` program of earlier versions is no longer part of item+. If you still have it next to your server, you can delete it together with the `updates/` folder.

## Configuration

The default config template lives in [backend/go/internal/config/templates/itemplus.conf](backend/go/internal/config/templates/itemplus.conf).

Settings you will usually review:

- `APP_DOMAIN`
- `CORS_ORIGINS`
- `TRUSTED_PROXIES`
- SMTP settings for magic-link login
- `DATABASE_URL`
- `UPLOAD_DIR`
- `LOG_DIR`
- `UPDATE_CHECK`, if you want a notice about new versions (off by default)
- `GAME_CATALOG_URL`, if you connect a game catalog

AI providers are set up in the web app under **Settings > AI System**, not in this file.

### Review and development helper

item+ can optionally grant all regular app permissions to newly created non-admin users:

```conf
IOS_REVIEW_PERMISSIONS=true
```

This exists for local development, demos, and App Review style test systems where a fresh Sign in with Apple account should be able to use the app immediately after creation.

Important:

- it only affects newly created users
- it does not make those users admins
- it is not meant for normal production use
- keep it disabled on regular public installations unless you explicitly want this behavior

### Reverse proxies

By default, item+ does not trust forwarded proxy headers. This is safer for self-hosted installs.

Only set `TRUSTED_PROXIES` when item+ is behind a reverse proxy you control.

```conf
TRUSTED_PROXIES=127.0.0.1,::1
```

Leave it empty when item+ is directly reachable.

### External storage

Normal external attachment links support `http://` and `https://`.

For SFTP and similar storage, item+ uses a backend-mediated flow:

```text
browser <-> item+ <-> SFTP
```

That keeps credentials and access control on the server side.

### Optional game catalog integration

item+ can optionally use a compatible, read-only game catalog for collection assistants. It is disabled by default:

```conf
GAME_CATALOG_URL=
```

Set the value only when the item+ server itself can reach a catalog you operate or are authorized to use. The browser never receives the configured catalog address; item+ requests it server-side. A private loopback or LAN address is appropriate when the catalog must not be publicly reachable:

```conf
GAME_CATALOG_URL=http://127.0.0.1:8765
```

The integration expects the item+ catalog contract (`schema_version` / `itemplus.contract_version` 2.0):

```text
GET /v1/schema
GET /v1/itemplus/<profile-key>/games?q=<query>&limit=<number>&offset=<number>
GET /v1/itemplus/<profile-key>/games/<id>
GET /v1/itemplus/<profile-key>/games/<id>/assets?offset=<number>&limit=<number>
GET /v1/itemplus/media/<media-id>/content
GET /v1/itemplus/stats                                  (optional)
```

`/v1/itemplus/stats` is optional. A catalog that offers it enables **collection progress** on the dashboard ("12 of 296 Nintendo 64 games"). It returns how many games each profile contains, and nothing about the games themselves:

```json
{ "profiles": [ { "key": "nintendo-64-games", "name": "Nintendo 64", "game_count": 296 } ] }
```

item+ compares these numbers with the items in the collection categories that were created from each profile, and caches the answer for ten minutes. Without the endpoint, or without a catalog, the dashboard simply leaves the progress out.

`/v1/schema` declares profiles, categories, properties, canonical choices, translations, and their setup defaults. item+ creates categories from those profiles in **Settings > Collection templates**. A selected game supplies only the declared `property_values`; optional images are downloaded server-side and become ordinary local item+ attachments. This keeps a private catalog private while preserving imported item data independently of it.

You are responsible for the source, license, attribution, and access rules of any catalog you connect. Do not expose a catalog merely because item+ can consume it, and do not configure a source unless its terms allow your intended use. Keep source credentials on the server; never put them in the browser or client-side configuration.

## Development

### Backend

```bash
cd backend/go
go run . --bind 0.0.0.0 --port 17117
```

### Web app

```bash
cd clients/web
npm install
npm run dev
```

The development web app runs on `http://127.0.0.1:3000` and expects the backend on port `17117`.

### Build

Build the server with embedded web app. Started in a terminal without arguments, the script asks what to build:

```bash
cd backend/go
bash build.sh
```

Or name the targets:

```bash
bash build.sh local            # this machine only
bash build.sh all              # the five release binaries
bash build.sh linux win        # groups, or single platforms such as linux-arm64
bash build.sh --clean          # remove earlier build output; keeps config, data, logs, uploads
```

### Tests

```bash
cd backend/go
go test ./...
```

The tests run on SQLite by default. item+ supports SQLite and MySQL/MariaDB with the same features; to run them against a MySQL or MariaDB test server (never a production one), set `ITEMPLUS_TEST_DATABASE_URL`:

```bash
ITEMPLUS_TEST_DATABASE_URL=mysql+aiomysql://user:pass@127.0.0.1:3306 go test -p 1 ./internal/http/...
```

## Repository Layout

```text
backend/go     Go backend and release build scripts
clients/web    Next.js web application
docs           Public docs and screenshots
```

Private release automation stays outside this public repository.

## Project State

item+ is usable and actively developed. Version 1.4.0 reworked most of the web app, the loans, the first-start setup and the AI assistant; the [changelog](CHANGELOG.md) lists what changed and what to know before updating.

The screenshots above were taken with an earlier version and will be replaced.

## Support

item+ is free and open source. If it helps you, you can support development voluntarily through [GitHub Sponsors](https://github.com/sponsors/dncloud).

## License

item+ is licensed under the [MIT License](LICENSE).
