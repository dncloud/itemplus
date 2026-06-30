# item+ iOS App Store Connect Metadata

Prepared for the iOS app release of `item+`.

Recommended pricing:
- Free app
- No in-app purchase required

Recommended category:
- Primary: `Utilities`
- Secondary: `Productivity`

Recommended URLs:
- Marketing URL: [https://itemplus.app](https://itemplus.app)
- Support URL: [https://itemplus.app/support/](https://itemplus.app/support/)

Recommended copyright:
- `© 2025–2026 Oliver Cermann`

## English

### App Name
`item+`

### Subtitle
`Inventory and collection companion`

### Promotional Text
`Scan, look up, and manage your self-hosted item+ inventory on the go.`

### Description
`item+ is the mobile companion for the self-hosted item+ inventory and collection system.

Use it to scan item, location, and login codes, review item details on the go, send photos back to the web app, and work with your browser sessions in real time.

item+ is built for people who want a practical tool for home inventory, workshop stock, collections, media shelves, retro hardware, and everyday organization without bloated warehouse software.

Highlights:
- Scan QR codes, barcodes, item labels, and location labels
- Open item details directly after scanning
- Send barcodes to the web app to create new items faster
- Confirm sensitive actions from iPhone when required
- Use the camera as a bridge for item photos and AI-assisted item capture
- Monitor connected browser sessions and live web activity
- Work with self-hosted item+ servers on your local network or over HTTPS
- Print labels through the iPhone print bridge when configured

item+ requires a running item+ server. This app is not a standalone inventory database.`

### Keywords
`inventory,collection,barcode,qr,scanner,organizer,home inventory,self-hosted,labels,catalog`

### App Review Notes
`item+ connects to a self-hosted item+ server.

Login:
- Sign in with Apple is used for account login
- A reachable test server must be configured by the reviewer before login can succeed

Important behaviors:
- The app can connect to local .local hosts and private LAN IPs over HTTP
- Public servers are expected to use HTTPS
- The app requests camera access for scanning and item photos
- The app requests local network access for local item+ servers and local label printers

The app is a mobile companion for the item+ system and requires a configured backend server.`

## German

### App-Name
`item+`

### Untertitel
`Inventar- und Sammlungsbegleiter`

### Werbetext
`Scannen, nachschlagen und dein selbstgehostetes item+ auch unterwegs verwalten.`

### Beschreibung
`item+ ist der mobile Begleiter fuer das selbstgehostete Inventar- und Sammlungssystem item+.

Die App dient dazu, Item-, Standort- und Login-Codes zu scannen, Item-Details unterwegs aufzurufen, Fotos an die WebApp zurueckzugeben und mit Browser-Sitzungen in Echtzeit zu arbeiten.

item+ ist fuer Menschen gedacht, die ein praktisches Werkzeug fuer Haushaltsinventar, Werkstattbestand, Sammlungen, Medienregale, Retro-Hardware und alltaegliche Organisation wollen, ohne ueberladenes Lager- oder ERP-Gefuehl.

Highlights:
- QR-Codes, Barcodes, Item-Labels und Standort-Labels scannen
- Item-Details direkt nach dem Scan oeffnen
- Barcodes an die WebApp senden, um neue Items schneller anzulegen
- Kritische Aktionen bei Bedarf ueber das iPhone bestaetigen
- Die Kamera als Bruecke fuer Item-Fotos und KI-unterstuetzte Erfassung nutzen
- Verbundene Browser-Sitzungen und Live-Aktivitaet der WebApp einsehen
- Mit selbstgehosteten item+ Servern im lokalen Netz oder ueber HTTPS arbeiten
- Labels ueber die iPhone-Druckbruecke drucken, wenn diese eingerichtet ist

item+ benoetigt einen laufenden item+ Server. Die App ist keine eigenstaendige Inventardatenbank.`

### Keywords
`inventar,sammlung,barcode,qr,scanner,organisation,haushalt,selbstgehostet,labels,katalog`

### Hinweise fuer App Review
`item+ verbindet sich mit einem selbstgehosteten item+ Server.

Login:
- Fuer die Anmeldung wird Sign in with Apple verwendet
- Vor einem erfolgreichen Login muss ein erreichbarer Testserver konfiguriert werden

Wichtige Eigenschaften:
- Die App kann lokale .local-Hosts und private LAN-IP-Adressen ueber HTTP erreichen
- Oeffentliche Server sollen ueber HTTPS angesprochen werden
- Die App fragt Kamerazugriff fuer Scans und Item-Fotos an
- Die App fragt lokalen Netzwerkzugriff fuer lokale item+ Server und lokale Labeldrucker an

Die App ist ein mobiler Begleiter fuer das item+ System und benoetigt einen konfigurierten Backend-Server.`

## Notes

- Keep the App Store page honest: this is a companion for a running item+ server, not a standalone offline inventory app.
- Keep the pricing model honest too: the iOS app is free and works as a companion to a configured item+ server.
- If Apple asks for demo access, provide either:
  - a reachable review server, or
  - a short review note explaining how to access a prepared test instance.
- Voluntary support can happen outside the app, for example through GitHub Sponsors or the project website, without adding payment flows inside the iOS app.
