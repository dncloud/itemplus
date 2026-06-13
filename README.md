# item+

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Backend](https://img.shields.io/badge/backend-Go-green)
![Web](https://img.shields.io/badge/web-Next.js-black)

Open-source inventory and collection management for private households, collectors, and anyone who wants to keep track of their things without warehouse software, SaaS overhead, or ERP bloat.

item+ helps you track what you own, where it lives, who currently has it, what has been lent out, and the details that matter for your own setup.

## Why item+

- Keep everyday stock and personal collections in one place
- Build your own categories, properties, locations, and workflows
- Lend items out, track active checkouts, and see what needs to come back
- Track quantities, values, notes, photos, documents, and external attachments
- See what is available, what is checked out, and what needs attention
- Print QR labels and use cross-device workflows when they help
- Use optional AI assistance without giving the app automatic outbound update checks or background telemetry

item+ is intentionally flexible. A box of screws, a camera collection, 3D printer filament, event equipment, game media, tools, documents, spare parts, and collectibles can all live in the same system without being forced into one fixed schema.

## Highlights

### Flexible inventory

- Two realms: **Archive** for stock-like items and **Collection** for value-oriented objects
- Custom categories, nested locations, vendors, suppliers, and manufacturers
- Dynamic properties such as text, number, date, select, multiselect, condition, rating, dimensions, weight, priority, and more
- Optional count fields for select values, for example `Medium = CD-ROM` plus `Count = 2`
- Bundles and related items for kits, sets, and grouped equipment

### Lending and accountability

- Track active checkouts, due dates, returns, and overdue items
- Keep item history and audit-style context
- Permission-aware user management with admin-only areas
- iPhone-assisted confirmation flows for sensitive actions when configured

### Attachments and media

- Upload photos and documents per item
- Store external links
- Use managed SFTP attachment sources through the backend
- Stream SFTP-backed video attachments with browser seeking support

### QR labels and devices

- Print QR labels with TSC-compatible thermal printers
- Scan locations and items
- Use the iPhone companion app for camera, QR login, photo bridge, barcode handoff, and confirmation flows

The iPhone companion app will be available through the App Store after Apple's review. If you would like TestFlight access before then, feel free to get in touch.

### Optional AI assistant

item+ includes optional AI workflows under the assistant name **Ina**.

- OpenAI and Ollama profiles
- Per-profile prompts
- Local Ollama support
- Optional Ollama cloud web search key
- Vision toggle for local models that can understand images
- Chat page for testing the active profile
- AI usage statistics for requests, tokens, provider, model, and web activity
- Read-only inventory context for safer assistant answers

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

The easiest way to run item+ is the single server binary from the latest release.

```bash
./itemplus-server-linux-amd64
```

On first start, item+ creates a local `itemplus.conf` from the default template. The server runs the API and embedded web app together.

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
├── itemplus-update-linux-amd64
├── itemplus.conf
├── data/
├── uploads/
├── logs/
└── updates/
```

A minimal systemd command can point at the config:

```ini
ExecStart=/opt/itemplus/itemplus-server-linux-amd64 --config /opt/itemplus/itemplus.conf
```

Use a reverse proxy such as nginx or Caddy if you expose item+ publicly.

## Updates

item+ does not check the internet for updates by itself. The running server only reads local state.

Use the separate updater binary when you explicitly want to check releases:

```bash
./itemplus-update-linux-amd64 --check --config /opt/itemplus/itemplus.conf
```

To download the matching server binary without installing it:

```bash
./itemplus-update-linux-amd64 --download --config /opt/itemplus/itemplus.conf
```

The updater writes the result into the local database. The web app can then show an update banner. It does **not** replace the running server.

Manual update flow:

1. Run `itemplus-update --check`
2. Run `itemplus-update --download`
3. Stop item+
4. Replace the old server binary with the downloaded one
5. Start item+ again

That is intentional. You stay in control of service restarts, backups, permissions, and rollback.

## Configuration

The default config template lives in [config/itemplus.conf](config/itemplus.conf).

Settings you will usually review:

- `APP_DOMAIN`
- `CORS_ORIGINS`
- `TRUSTED_PROXIES`
- SMTP settings for magic-link login
- `DATABASE_URL`
- `UPLOAD_DIR`
- `LOG_DIR`
- AI provider settings, if you want Ina

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

Build the server with embedded web app:

```bash
cd backend/go
bash build.sh
```

Build all release binaries:

```bash
cd backend/go
bash build.sh --all
```

## Repository Layout

```text
backend/go     Go backend and release build scripts
clients/web    Next.js web application
config         Default configuration template
docs           Public docs and screenshots
```

Private release automation stays outside this public repository.

## Project State

item+ is usable and actively developed. The current focus is making the self-hosted experience smoother, improving the AI-assisted workflows, and keeping the public packaging easy to understand.

Expect occasional changes while the project settles into a clean long-term shape.

## Support

item+ is free and open source. If it helps you, you can support development voluntarily through [GitHub Sponsors](https://github.com/sponsors/dncloud).

## License

item+ is licensed under the [MIT License](LICENSE).
