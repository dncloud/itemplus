-- item+ 1.2 Seed-Import, Deutsch
-- Merge-sicher für bestehende Umgebungen: keine Benutzer, keine festen IDs, keine Deletes.
-- Enthält nur Stammdaten und Items aus der alten Seed-Liste; keine Bundles, keine Ausleihen, keine Verkaufsstatus.

BEGIN;

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Küchengeräte', 'Alltagsgeräte für die Küche, gepflegt wie wertige Haushaltsausstattung.', '#3b82f6', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Küchengeräte');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), 'Farbe', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), 'Leistung', 'number', 'W', '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), 'Kapazität', 'text', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Getränkezubehör', 'Geräte rund um Getränke und die tägliche Getränkeecke.', '#14b8a6', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Getränkezubehör');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Getränkezubehör' ORDER BY id LIMIT 1), 'Farbe', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Farbe');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Getränkezubehör' ORDER BY id LIMIT 1), 'Zubehör', 'textblock', NULL, '{}', 0, 0, 'full', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zubehör');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Getränkezubehör' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Getränkezubehör' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Küchenwerkzeuge', 'Wertige Küchenwerkzeuge, die sich als Einzelstücke im Inventar lohnen.', '#f97316', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Küchenwerkzeuge');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenwerkzeuge' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenwerkzeuge' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenwerkzeuge' ORDER BY id LIMIT 1), 'Kürzlich geschärft', 'boolean', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Kürzlich geschärft');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenwerkzeuge' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Küchenorganisation', 'Sichtbare Küchenorganisation und Aufbewahrung mit echtem Nutzwert.', '#a855f7', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Küchenorganisation');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenorganisation' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenorganisation' ORDER BY id LIMIT 1), 'Kapazität', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Kapazität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Küchenorganisation' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Büroelektronik', 'Zentrale Büroelektronik für den täglichen Arbeitsplatz.', '#2563eb', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Büroelektronik');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), 'Speicher', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Speicher');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), 'Konnektivität', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Konnektivität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Speichermedien', 'Tragbare Speichermedien für Transfer, Übergaben und kleine Büroabläufe.', '#0ea5e9', 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Speichermedien');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichermedien' ORDER BY id LIMIT 1), 'Kapazität', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Kapazität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichermedien' ORDER BY id LIMIT 1), 'Anschluss', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Anschluss');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichermedien' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Netzwerktechnik', 'Kleine Netzwerk-Hardware und gemeinsame Infrastruktur im Büro.', '#0284c7', 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Netzwerktechnik');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Netzwerktechnik' ORDER BY id LIMIT 1), 'Ports', 'number', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Ports');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Netzwerktechnik' ORDER BY id LIMIT 1), 'Managed', 'boolean', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Managed');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Netzwerktechnik' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Bürobeleuchtung', 'Arbeitsbeleuchtung für lange Schreibtisch-Sessions und Abendstunden.', '#eab308', 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Bürobeleuchtung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobeleuchtung' ORDER BY id LIMIT 1), 'Lampentyp', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Lampentyp');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobeleuchtung' ORDER BY id LIMIT 1), 'Dimmbar', 'boolean', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Dimmbar');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobeleuchtung' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Speichersysteme', 'Gemeinsame Speichersysteme und lokale Infrastruktur mit Dauerbetrieb.', '#0891b2', 9, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Speichersysteme');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichersysteme' ORDER BY id LIMIT 1), 'Einschübe', 'number', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Einschübe');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichersysteme' ORDER BY id LIMIT 1), 'Netzwerk', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Netzwerk');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichersysteme' ORDER BY id LIMIT 1), 'Erweiterbar', 'boolean', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Erweiterbar');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Speichersysteme' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Bürotechnik', 'Geräte für Papier, Scans und Ausgaben im Büroalltag.', '#6366f1', 10, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Bürotechnik');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürotechnik' ORDER BY id LIMIT 1), 'Konnektivität', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Konnektivität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürotechnik' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürotechnik' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Elektrowerkzeuge', 'Akkubetriebene Werkzeuge für Montage, Einbau und Werkstattalltag.', '#f59e0b', 11, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Elektrowerkzeuge');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), 'Energiequelle', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Energiequelle');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), 'Spannung', 'number', 'V', '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Spannung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Werkzeugzubehör', 'Kompaktes Zubehör und schnell greifbare Einsätze für die Werkstatt.', '#fb923c', 12, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Werkzeugzubehör');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugzubehör' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugzubehör' ORDER BY id LIMIT 1), 'Kapazität', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Kapazität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugzubehör' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Messwerkzeuge', 'Mess- und Diagnosewerkzeuge für präzises Arbeiten und Fehlersuche.', '#22c55e', 13, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Messwerkzeuge');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), 'Werkzeugtyp', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Werkzeugtyp');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), 'Konnektivität', 'text', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Konnektivität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Werkzeugaufbewahrung', 'Koffer und mobile Aufbewahrung für Ordnung und Außeneinsätze.', '#84cc16', 14, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Werkzeugaufbewahrung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugaufbewahrung' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugaufbewahrung' ORDER BY id LIMIT 1), 'Abschließbar', 'boolean', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Abschließbar');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugaufbewahrung' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeugaufbewahrung' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Elektronikwerkzeuge', 'Feinwerkzeuge für Löten, Prototyping und Reparatur.', '#f43f5e', 15, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Elektronikwerkzeuge');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronikwerkzeuge' ORDER BY id LIMIT 1), 'Leistung', 'number', 'W', '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Leistung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronikwerkzeuge' ORDER BY id LIMIT 1), 'ESD-sicher', 'boolean', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'ESD-sicher');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronikwerkzeuge' ORDER BY id LIMIT 1), 'Werkzeugtyp', 'text', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Werkzeugtyp');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronikwerkzeuge' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT '3D-Druck', '3D-Drucker, Filament und Fertigungstechnik für Prototypen und Halterungen.', '#ef4444', 16, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = '3D-Druck');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Bauraum', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Bauraum');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Konnektivität', 'text', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Konnektivität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Durchmesser', 'text', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Durchmesser');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Farbe', 'text', NULL, '{}', 0, 1, 'third', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Farbe');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Priorität', 'priority', NULL, '{}', 0, 1, 'third', 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Priorität');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Elektronik', 'Boards, Mikrocontroller und Adapter für Prototyping und Wartung.', '#60a5fa', 17, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Elektronik');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), 'Spannung', 'number', 'V', '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), 'Anschluss', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), 'Leistung', 'number', 'W', '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Werkzeug', 'Handwerkzeuge und Messgeräte für die tägliche Arbeit.', '#f59e0b', 18, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Werkzeug');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Material');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Gewicht');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), 'Elektrisch', 'boolean', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Elektrisch');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Zustand');

INSERT INTO archive_categories (name, description, color, position, created_at, updated_at)
SELECT 'Bürobedarf', 'Label, Papier und kleine Organisationshelfer für den Versand- und Verwaltungsalltag.', '#10b981', 19, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_categories WHERE name = 'Bürobedarf');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobedarf' ORDER BY id LIMIT 1), 'Format', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Format');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobedarf' ORDER BY id LIMIT 1), 'Farbe', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Farbe');

INSERT INTO archive_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM archive_categories WHERE name = 'Bürobedarf' ORDER BY id LIMIT 1), 'Priorität', 'priority', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Priorität');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Küche', 'Warme Alltagsküche mit ausgewählten Geräten und sichtbarer Ordnung.', '#60a5fa', NULL, 60, 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Küche');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Arbeitsplatte', 'Sichtbare Nutzfläche für kleine Geräte und Gewürze.', '#93c5fd', (SELECT id FROM archive_locations WHERE name = 'Küche' ORDER BY id LIMIT 1), 12, 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Arbeitsplatte');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Geräteregal', 'Regalplatz für größere Küchengeräte im schnellen Zugriff.', '#bfdbfe', (SELECT id FROM archive_locations WHERE name = 'Küche' ORDER BY id LIMIT 1), 10, 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Geräteregal');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Vorratsschrank Küche', 'Geschlossener Stauraum für größere Geräte und Vorratsorganisation.', '#dbeafe', (SELECT id FROM archive_locations WHERE name = 'Küche' ORDER BY id LIMIT 1), 16, 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Vorratsschrank Küche');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Messerschublade', 'Geschützter Platz für Messer und Vorbereitungswerkzeuge.', '#e0f2fe', (SELECT id FROM archive_locations WHERE name = 'Küche' ORDER BY id LIMIT 1), 8, 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Messerschublade');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Getränkeecke', 'Ecke für Tee, Kaffee und Sprudelwasser im täglichen Einsatz.', '#99f6e4', (SELECT id FROM archive_locations WHERE name = 'Küche' ORDER BY id LIMIT 1), 8, 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Getränkeecke');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Büro', 'Ruhiger Arbeitsplatz mit Speicher, Scan- und Drucktechnik sowie ein paar persönlichen Tech-Geräten.', '#2563eb', NULL, 80, 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Büro');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Hauptschreibtisch', 'Hauptarbeitsplatz für konzentrierte Schreibtischarbeit.', '#60a5fa', (SELECT id FROM archive_locations WHERE name = 'Büro' ORDER BY id LIMIT 1), 12, 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Hauptschreibtisch');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Sideboard', 'Seitliche Ablage für Geräte mit regelmäßigem, aber nicht permanentem Einsatz.', '#93c5fd', (SELECT id FROM archive_locations WHERE name = 'Büro' ORDER BY id LIMIT 1), 10, 9, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Sideboard');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Netzwerkregal', 'Ecke für gemeinsames Storage und kleine Netzwerktechnik.', '#bfdbfe', (SELECT id FROM archive_locations WHERE name = 'Büro' ORDER BY id LIMIT 1), 10, 10, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Netzwerkregal');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Scannerplatz', 'Platz für Papiererfassung, Scans und Dokumentenvorbereitung.', '#dbeafe', (SELECT id FROM archive_locations WHERE name = 'Büro' ORDER BY id LIMIT 1), 8, 11, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Scannerplatz');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Druckerecke', 'Druckbereich für Versand, Etiketten und Bürodokumente.', '#e0e7ff', (SELECT id FROM archive_locations WHERE name = 'Büro' ORDER BY id LIMIT 1), 8, 12, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Druckerecke');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Werkstatt', 'Organisierte Werkstatt mit Bereichen für Fertigung, Löten, Messen und Montage.', '#f97316', NULL, 120, 13, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Werkstatt');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Werkbank links', 'Elektronikplatz mit Oszilloskop und Netzteil.', '#fb923c', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 30, 14, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Werkbank links');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Werkbank rechts', 'Mechanik und Montage.', '#fdba74', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 30, 15, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Werkbank rechts');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Hauptwerkbank', 'Zentrale Arbeitsfläche für Montage, Zuschnitt und Einpassungen.', '#fb923c', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 18, 16, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Hauptwerkbank');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Werkzeugschrank', 'Sortiertes Zubehör und schnell griffbereite Einsätze.', '#fdba74', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 18, 17, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Werkzeugschrank');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Messregal', 'Geschütztes Regal für Mess- und Diagnosewerkzeuge.', '#fde68a', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 12, 18, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Messregal');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Lötplatz', 'Elektronikplatz für feine Lötarbeiten und Prototyping.', '#fca5a5', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 12, 19, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Lötplatz');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT '3D-Druck-Ecke', 'Fertigungsbereich für Druckteile, Halterungen und Werkstatthelfer.', '#fda4af', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 14, 20, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = '3D-Druck-Ecke');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Mobiler Werkzeugkoffer', 'Aufbewahrung für mobile Werkzeuge und sortierte Einsätze.', '#fdba74', (SELECT id FROM archive_locations WHERE name = 'Werkstatt' ORDER BY id LIMIT 1), 10, 21, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Mobiler Werkzeugkoffer');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Materiallager', 'Regale für Verbrauchsmaterial und Nachschub.', '#22c55e', NULL, 200, 22, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Materiallager');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Regal A', 'Elektronik und Adapter.', '#4ade80', (SELECT id FROM archive_locations WHERE name = 'Materiallager' ORDER BY id LIMIT 1), 60, 23, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Regal A');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Regal B', 'Filament und Verbrauchsmaterial.', '#86efac', (SELECT id FROM archive_locations WHERE name = 'Materiallager' ORDER BY id LIMIT 1), 60, 24, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Regal B');

INSERT INTO archive_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Versandplatz', 'Versand, Etiketten und Verwaltung.', '#0ea5e9', NULL, 40, 25, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_locations WHERE name = 'Versandplatz');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Bosch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Bosch');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Braun', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Braun');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'WMF', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'WMF');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'SodaStream', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'SodaStream');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Zwilling', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Zwilling');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Tefal', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Tefal');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Apple', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Apple');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'SanDisk', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'SanDisk');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Valve', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Valve');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Cisco', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Cisco');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Dyson', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Dyson');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Synology', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Synology');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Brother', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Brother');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Festool', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Festool');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Wera', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Wera');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Leica', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Leica');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Wurth', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Wurth');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'ERSA', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'ERSA');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Ultimaker', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Ultimaker');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Fluke', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Fluke');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Arduino', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Arduino');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Raspberry Pi', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Raspberry Pi');

INSERT INTO archive_manufacturers (name, created_at, updated_at)
SELECT 'Prusament', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_manufacturers WHERE name = 'Prusament');

INSERT INTO archive_suppliers (name, created_at, updated_at)
SELECT 'Amazon Business', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_suppliers WHERE name = 'Amazon Business');

INSERT INTO archive_suppliers (name, created_at, updated_at)
SELECT 'Mouser', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_suppliers WHERE name = 'Mouser');

INSERT INTO archive_suppliers (name, created_at, updated_at)
SELECT 'Reichelt', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_suppliers WHERE name = 'Reichelt');

INSERT INTO archive_suppliers (name, created_at, updated_at)
SELECT 'Prusa Research', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_suppliers WHERE name = 'Prusa Research');

INSERT INTO archive_suppliers (name, created_at, updated_at)
SELECT 'Office Partner', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_suppliers WHERE name = 'Office Partner');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'Amazon', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'Amazon');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'IKEA', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'IKEA');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'Conrad', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'Conrad');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'Amazon Business', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'Amazon Business');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT '3DJake', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = '3DJake');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'Retro Trade', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'Retro Trade');

INSERT INTO archive_vendors (name, created_at, updated_at)
SELECT 'Cardmarket', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_vendors WHERE name = 'Cardmarket');

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Bosch Küchenmaschine Serie 4 MUM58200', 'Küchenmaschine für Teige, Cremes und alltägliche Backvorbereitung.', (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Geräteregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Bosch' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-12-08', 169, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Weiß / Silber', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 1000, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '3.9 L', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":5500,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bosch Küchenmaschine Serie 4 MUM58200' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Braun MultiQuick Stabmixer', 'Alltags-Stabmixer für Suppen, Saucen und schnelle Küchenvorbereitung.', (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Arbeitsplatte' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Braun' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-09-22', 64.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Schwarz / Edelstahl', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 1000, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), 'Messbecher inklusive', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":900,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Braun MultiQuick Stabmixer' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'WMF Stelio Kettle', 'Edelstahl-Wasserkocher für Tee, Kaffee und heißes Wasser im Alltag.', (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Getränkeecke' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'WMF' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-10-05', 49.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Edelstahl / Schwarz', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 2400, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '1.7 L', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":1300,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'WMF Stelio Kettle' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'SodaStream Terra', 'Wassersprudler mit Quick-Connect-Zylinder und wiederverwendbaren Flaschen.', (SELECT id FROM archive_categories WHERE name = 'Getränkezubehör' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Getränkeecke' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'SodaStream' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-11-02', 79.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Schwarz', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zubehör' ORDER BY p.id LIMIT 1), 'Zwei Flaschen, CO2-Zylinder', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zubehör' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":1900,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SodaStream Terra' AND c.name = 'Getränkezubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Getränkezubehör' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Zwilling Pro Kochmesser 20 cm', 'Hauptkochmesser für Gemüse, Kräuter und allgemeine Vorbereitung.', (SELECT id FROM archive_categories WHERE name = 'Küchenwerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Messerschublade' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Zwilling' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-08-12', 89.95, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Edelstahl', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":280,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Kürzlich geschärft' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Kürzlich geschärft' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Zwilling Pro Kochmesser 20 cm' AND c.name = 'Küchenwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Tefal OptiGrill', 'Kontaktgrill für Sandwiches, Gemüse und schnelles Indoor-Grillen.', (SELECT id FROM archive_categories WHERE name = 'Küchengeräte' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Vorratsschrank Küche' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Tefal' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-07-20', 179, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Schwarz / Edelstahl', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 2000, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '6 Automatikprogramme', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":4800,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Tefal OptiGrill' AND c.name = 'Küchengeräte' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchengeräte' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'IKEA KORKEN Vorratsgläser Set', 'Vorratsgläser für Pasta, Reis, Mehl und trockene Küchenvorräte.', (SELECT id FROM archive_categories WHERE name = 'Küchenorganisation' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Vorratsschrank Küche' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-06-15', 24.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Glas', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '4 Gläser', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'IKEA KORKEN Vorratsgläser Set' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Bambus Gewürzregal', 'Offenes Gewürzregal für häufig genutzte Gewürze und Mischungen.', (SELECT id FROM archive_categories WHERE name = 'Küchenorganisation' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Arbeitsplatte' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-08-02', 29.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Bambus', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '12 Gläser', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Bambus Gewürzregal' AND c.name = 'Küchenorganisation' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Küchenorganisation' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Apple iMac 24 Zoll', 'Primärer Desktop-Arbeitsplatz für Verwaltung, Medienarbeit und täglichen Büroeinsatz.', (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Hauptschreibtisch' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Apple' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-05-06', 1799, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Speicher' ORDER BY p.id LIMIT 1), '512 GB SSD', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Speicher' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'WLAN, Bluetooth, USB-C', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":4500,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Apple iMac 24 Zoll' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'SanDisk USB-Stick', 'Tragbarer USB-Stick für schnelle Dateiübertragungen und Firmware-Pakete.', (SELECT id FROM archive_categories WHERE name = 'Speichermedien' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Hauptschreibtisch' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'SanDisk' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2026-01-16', 18.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '128 GB', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1), 'USB-A', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'SanDisk USB-Stick' AND c.name = 'Speichermedien' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichermedien' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Valve Steam Deck', 'Handheld für Gaming und kleine Testläufe im Bürobereich.', (SELECT id FROM archive_categories WHERE name = 'Büroelektronik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Sideboard' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Valve' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-12-20', 569, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Speicher' ORDER BY p.id LIMIT 1), '512 GB', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Speicher' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'USB-C, WLAN, Bluetooth', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":670,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Valve Steam Deck' AND c.name = 'Büroelektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-12-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Büroelektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Cisco 8-Port Switch', 'Kompakter Netzwerkswitch für Arbeitsplatz, NAS und Drucker-Anbindung.', (SELECT id FROM archive_categories WHERE name = 'Netzwerktechnik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Netzwerkregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Cisco' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-10-10', 64, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Ports' ORDER BY p.id LIMIT 1), 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Ports' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Managed' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Managed' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Cisco 8-Port Switch' AND c.name = 'Netzwerktechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Netzwerktechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Dyson Tischlampe', 'Verstellbare Tischlampe für Lesen, Bearbeitung und längere Abendsessions.', (SELECT id FROM archive_categories WHERE name = 'Bürobeleuchtung' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Hauptschreibtisch' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Dyson' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-11-18', 499, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Lampentyp' ORDER BY p.id LIMIT 1), 'Tischlampe', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Lampentyp' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Dimmbar' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Dimmbar' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Dyson Tischlampe' AND c.name = 'Bürobeleuchtung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobeleuchtung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Synology Desktop NAS', 'Gemeinsames Speichersystem für Dokumente, Medien, Backups und Projektdateien.', (SELECT id FROM archive_categories WHERE name = 'Speichersysteme' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Netzwerkregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Synology' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2026-02-02', 649, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Einschübe' ORDER BY p.id LIMIT 1), 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Einschübe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Netzwerk' ORDER BY p.id LIMIT 1), '1 GbE', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Netzwerk' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Erweiterbar' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Erweiterbar' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Synology Desktop NAS' AND c.name = 'Speichersysteme' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Speichersysteme' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Brother Dokumentenscanner ADS-4700W', 'Schneller Dokumentenscanner für Belege, Verträge und Archiv-Erfassung.', (SELECT id FROM archive_categories WHERE name = 'Bürotechnik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Scannerplatz' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Brother' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2026-01-09', 529, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'USB, LAN, WLAN', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":2750,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Dokumentenscanner ADS-4700W' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Brother Laserdrucker', 'Kompakter Farb-Multifunktions-Laserdrucker für Etiketten, Scans und Bürodokumente.', (SELECT id FROM archive_categories WHERE name = 'Bürotechnik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Druckerecke' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Brother' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2026-01-09', 249, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'USB, WLAN, Ethernet', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":18000,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Brother Laserdrucker' AND c.name = 'Bürotechnik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürotechnik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Festool TXS 18-Basic-Set', 'Kompakter Akkuschrauber für Möbelaufbau und präzise Schraubarbeiten.', (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Hauptwerkbank' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Festool' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-09-14', 229, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Energiequelle' ORDER BY p.id LIMIT 1), 'Akku', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Energiequelle' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1), 18, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":900,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool TXS 18-Basic-Set' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Wera Bit-Check', 'Kompakte Bit-Sammlung für die häufigsten Schraubprofile und schnelle Werkstattaufgaben.', (SELECT id FROM archive_categories WHERE name = 'Werkzeugzubehör' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Werkzeugschrank' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Wera' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-07-07', 34.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Stahl / Kunststoff', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '12 Bits', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Bit-Check' AND c.name = 'Werkzeugzubehör' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugzubehör' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Leica DISTO S910', 'Hochwertiger Laserdistanzmesser für Raumaufmaß und präzise Planung.', (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Messregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Leica' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-06-19', 1399, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1), 'Laserdistanzmesser', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'Bluetooth, USB', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":290,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Leica DISTO S910' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Wurth Werkzeugkoffer', 'Robuster leerer Werkzeugkoffer für mobile Einsätze und sortierte Einlagen.', (SELECT id FROM archive_categories WHERE name = 'Werkzeugaufbewahrung' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Mobiler Werkzeugkoffer' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Wurth' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-05-12', 119, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Kunststoff / Aluminium', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Abschließbar' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Abschließbar' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":4200,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wurth Werkzeugkoffer' AND c.name = 'Werkzeugaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeugaufbewahrung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'ERSA i-CON 1 MK2 ESD', 'Professionelle Lötstation für feine Elektronikreparatur und Prototyping.', (SELECT id FROM archive_categories WHERE name = 'Elektronikwerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Lötplatz' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'ERSA' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-04-16', 329, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 80, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'ESD-sicher' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'ESD-sicher' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1), 'Lötstation', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'ERSA i-CON 1 MK2 ESD' AND c.name = 'Elektronikwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-16', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronikwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Ultimaker 3', 'Dual-Extrusion-3D-Drucker für Prototypen, Halterungen und Ersatzteile.', (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = '3D-Druck-Ecke' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Ultimaker' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2024-12-11', 1890, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Bauraum' ORDER BY p.id LIMIT 1), '215 x 215 x 200 mm', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Bauraum' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'WLAN, Ethernet, USB', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":10600,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Ultimaker 3' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2024-12-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Fluke 289', 'Datenlogger-Multimeter für elektrische Diagnose und detaillierte Messungen.', (SELECT id FROM archive_categories WHERE name = 'Messwerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Messregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Fluke' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-03-03', 749, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1), 'Digitalmultimeter', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Werkzeugtyp' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1), 'Lokales Logging', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Konnektivität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":870,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 289' AND c.name = 'Messwerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Messwerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Festool PSC-E 18 EB-Basic', 'Akku-Stichsäge für Kurvenschnitte, Plattenarbeit und präzise Anpassungen.', (SELECT id FROM archive_categories WHERE name = 'Elektrowerkzeuge' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Hauptwerkbank' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Festool' ORDER BY id LIMIT 1), NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon' ORDER BY id LIMIT 1), '2025-08-28', 349, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Energiequelle' ORDER BY p.id LIMIT 1), 'Akku', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Energiequelle' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1), 18, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":1700,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Festool PSC-E 18 EB-Basic' AND c.name = 'Elektrowerkzeuge' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-28', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektrowerkzeuge' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Arduino Uno R4 WiFi', 'Standardboard für schnelle Prototypen und kleine Steuerungsaufgaben.', (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Werkbank links' ORDER BY id LIMIT 1), 4, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Arduino' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Mouser' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = 'Conrad' ORDER BY id LIMIT 1), '2025-11-14', 27.9, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1), 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1), 'USB-C', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 3.5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_attachments (item_id, filename, file_path, attachment_type, url, description, gallery, size, `order`, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1), 'Arduino Uno R4 WiFi Datenblatt', NULL, 'link', 'https://docs.arduino.cc/hardware/uno-r4-wifi/', 'Offizielle Dokumentation', 0, NULL, 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_attachments WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Arduino Uno R4 WiFi' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-14', '') ORDER BY i.id LIMIT 1) AND filename = 'Arduino Uno R4 WiFi Datenblatt');

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Raspberry Pi 5 8GB', 'Schneller Single Board Computer für Dashboard, Kamera und kleine Server-Aufgaben.', (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Regal A' ORDER BY id LIMIT 1), 2, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Raspberry Pi' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Reichelt' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = 'Amazon Business' ORDER BY id LIMIT 1), '2026-01-07', 96, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1), 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1), 'USB-C', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 27, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'like_new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Raspberry Pi 5 8GB' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-07', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Fluke 117 Multimeter', 'True-RMS Multimeter für Service und Fehlersuche.', (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Werkbank rechts' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Fluke' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Reichelt' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = 'Amazon Business' ORDER BY id LIMIT 1), '2025-09-30', 238, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Kunststoff', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":550,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Elektrisch' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Elektrisch' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Fluke 117 Multimeter' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-30', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Wera Kraftform Set', 'Schraubendreher-Set für Elektronik und Werkbank.', (SELECT id FROM archive_categories WHERE name = 'Werkzeug' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Werkbank rechts' ORDER BY id LIMIT 1), 2, 0, NULL, (SELECT id FROM archive_manufacturers WHERE name = 'Wera' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Reichelt' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = 'Amazon Business' ORDER BY id LIMIT 1), '2025-06-22', 42.5, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Chrom-Vanadium', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":820,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Elektrisch' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Elektrisch' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Wera Kraftform Set' AND c.name = 'Werkzeug' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-22', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Werkzeug' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'PETG Transparent 1kg', 'Universelles PETG für robuste Gehäuse und Halterungen.', (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Regal B' ORDER BY id LIMIT 1), 6, 1, 2, (SELECT id FROM archive_manufacturers WHERE name = 'Prusament' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Prusa Research' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = '3DJake' ORDER BY id LIMIT 1), '2026-02-05', 29.9, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'PETG', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Durchmesser' ORDER BY p.id LIMIT 1), '1.75mm', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Durchmesser' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Transparent', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":1000,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1), 'medium', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PETG Transparent 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-05', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'PLA Schwarz 1kg', 'Schnelles Standardfilament für Prototypen und Labels.', (SELECT id FROM archive_categories WHERE name = '3D-Druck' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Regal B' ORDER BY id LIMIT 1), 1, 1, 3, (SELECT id FROM archive_manufacturers WHERE name = 'Prusament' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Prusa Research' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = '3DJake' ORDER BY id LIMIT 1), '2026-03-11', 27.9, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'PLA', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Durchmesser' ORDER BY p.id LIMIT 1), '1.75mm', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Durchmesser' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Schwarz', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":1000,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1), 'high', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'PLA Schwarz 1kg' AND c.name = '3D-Druck' AND COALESCE(i.purchase_date, '') = COALESCE('2026-03-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = '3D-Druck' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'USB-C Kabel 2m 100W', 'Schnell zum Testen von Netzteilen, Boards und Displays griffbereit.', (SELECT id FROM archive_categories WHERE name = 'Elektronik' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Regal A' ORDER BY id LIMIT 1), 12, 1, 4, (SELECT id FROM archive_manufacturers WHERE name = 'Raspberry Pi' ORDER BY id LIMIT 1), (SELECT id FROM archive_suppliers WHERE name = 'Mouser' ORDER BY id LIMIT 1), (SELECT id FROM archive_vendors WHERE name = 'Amazon Business' ORDER BY id LIMIT 1), '2026-02-20', 9.5, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1), 20, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Spannung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1), 'USB-C', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Anschluss' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1), 100, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Leistung' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'USB-C Kabel 2m 100W' AND c.name = 'Elektronik' AND COALESCE(i.purchase_date, '') = COALESCE('2026-02-20', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Elektronik' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO archive_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Thermo Labels 100x150', 'Versand- und Standortlabel für Drucker und Lagerworkflow.', (SELECT id FROM archive_categories WHERE name = 'Bürobedarf' ORDER BY id LIMIT 1), (SELECT id FROM archive_locations WHERE name = 'Versandplatz' ORDER BY id LIMIT 1), 18, 1, 6, NULL, NULL, (SELECT id FROM archive_vendors WHERE name = 'Amazon Business' ORDER BY id LIMIT 1), '2026-01-15', 18.9, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', ''));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Label 100x150', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1), 'Weiß', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Farbe' ORDER BY p.id LIMIT 1));

INSERT INTO archive_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1), 'high', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM archive_item_properties WHERE item_id = (SELECT i.id FROM archive_items i JOIN archive_categories c ON c.id = i.category_id WHERE i.name = 'Thermo Labels 100x150' AND c.name = 'Bürobedarf' AND COALESCE(i.purchase_date, '') = COALESCE('2026-01-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM archive_properties p JOIN archive_categories c ON c.id = p.category_id WHERE c.name = 'Bürobedarf' AND p.name = 'Priorität' ORDER BY p.id LIMIT 1));

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Sammelkarten', 'Kuratierte Sammelkarten mit Zustands-, Set-, Grading- und Storage-Daten.', '#ec4899', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Sammelkarten');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Set', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Sprache', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Seltenheit', 'text', NULL, '{}', 0, 0, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Versiegelt', 'boolean', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Gegradet', 'boolean', NULL, '{}', 0, 1, 'third', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Kartenaufbewahrung', 'Binder, Boxen und Schutzaufbewahrung für Sammlerkarten.', '#d946ef', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Kartenaufbewahrung');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kartenaufbewahrung' ORDER BY id LIMIT 1), 'Material', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Material');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kartenaufbewahrung' ORDER BY id LIMIT 1), 'Kapazität', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Kapazität');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kartenaufbewahrung' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Retrospiele', 'Spiele, Boxen und Module mit Fokus auf gut prüfbare Sammlungsdaten.', '#8b5cf6', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Retrospiele');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Plattform', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Region', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Erscheinungsjahr', 'number', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Komplett in Box', 'boolean', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Anleitung enthalten', 'boolean', NULL, '{}', 0, 1, 'third', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Komplett', 'boolean', NULL, '{}', 0, 1, 'third', 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Altersfreigabe', 'age_rating', NULL, '{}', 0, 1, 'third', 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Altersfreigabe');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Publisher', 'text', NULL, '{}', 0, 0, 'third', 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Genre', 'text', NULL, '{}', 0, 0, 'third', 9, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 10, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Konsolen', 'Konsolen und Handhelds mit Zustand und Funktionsstatus.', '#ec4899', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Konsolen');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), 'Hersteller', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Hersteller');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), 'Erscheinungsjahr', 'number', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Erscheinungsjahr');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), 'Funktionsfähig', 'boolean', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Funktionsfähig');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Vinyl', 'Platten mit Format, Zustand und persönlicher Bewertung.', '#14b8a6', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Vinyl');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), 'Format', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Format');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), 'Genre', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Genre');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), 'Bewertung', 'rating', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Bewertung');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Kamera', 'Bodies und Objektive mit Mount, Zustand und Gewicht.', '#f97316', 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Kamera');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kamera' ORDER BY id LIMIT 1), 'Mount', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Mount');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kamera' ORDER BY id LIMIT 1), 'Gewicht', 'weight', NULL, '{}', 0, 0, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Gewicht');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Kamera' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Zustand');

INSERT INTO collection_categories (name, description, color, position, created_at, updated_at)
SELECT 'Bücher', 'Eine warme, gemischte Bibliothek mit Lieblingsromanen und Reihen.', '#7c3aed', 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_categories WHERE name = 'Bücher');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), 'Autor', 'text', NULL, '{}', 0, 1, 'third', 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), 'Sprache', 'text', NULL, '{}', 0, 1, 'third', 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), 'Format', 'text', NULL, '{}', 0, 1, 'third', 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), 'Reihe', 'text', NULL, '{}', 0, 0, 'third', 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe');

INSERT INTO collection_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
SELECT (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), 'Zustand', 'condition', NULL, '{}', 0, 1, 'third', 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Sammlungszimmer', 'Warmes Sammlungszimmer mit Regalen für Karten, Retrospiele und Bücher.', '#a855f7', NULL, 90, 1, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Sammlungszimmer');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Kartenregal', 'Regal für Binder, versiegelte Produkte und Kartenaufbewahrung.', '#c084fc', (SELECT id FROM collection_locations WHERE name = 'Sammlungszimmer' ORDER BY id LIMIT 1), 16, 2, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Kartenregal');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Retrospieleregal', 'Regal für Modul-Klassiker und ausgewählte Boxen.', '#d8b4fe', (SELECT id FROM collection_locations WHERE name = 'Sammlungszimmer' ORDER BY id LIMIT 1), 20, 3, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Retrospieleregal');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Bücherregal', 'Bücherregal mit Lieblingsromanen und Reihen.', '#ddd6fe', (SELECT id FROM collection_locations WHERE name = 'Sammlungszimmer' ORDER BY id LIMIT 1), 30, 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Bücherregal');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Vitrine', 'Geschützter Platz für besondere Sammlungsstücke.', '#f0abfc', (SELECT id FROM collection_locations WHERE name = 'Sammlungszimmer' ORDER BY id LIMIT 1), 12, 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Vitrine');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Wohnzimmer Vitrine', 'Die sichtbaren Lieblingsstücke.', '#a855f7', NULL, 40, 6, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Wohnzimmer Vitrine');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Vitrine oben', 'Handhelds und Highlights.', '#c084fc', (SELECT id FROM collection_locations WHERE name = 'Wohnzimmer Vitrine' ORDER BY id LIMIT 1), 12, 7, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Vitrine oben');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Vitrine mitte', 'Konsolen und Spiele.', '#d8b4fe', (SELECT id FROM collection_locations WHERE name = 'Wohnzimmer Vitrine' ORDER BY id LIMIT 1), 18, 8, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Vitrine mitte');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Medienregal', 'Platten und größere Boxen.', '#06b6d4', NULL, 80, 9, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Medienregal');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Vinyl-Bereich', 'Sortierter Bereich für Platten und Lieblingsstücke.', '#67e8f9', (SELECT id FROM collection_locations WHERE name = 'Medienregal' ORDER BY id LIMIT 1), 36, 10, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Vinyl-Bereich');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Studio Shelf', 'Kamera- und Audioecke für laufende Projekte.', '#fb923c', NULL, 25, 11, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Studio Shelf');

INSERT INTO collection_locations (name, description, color, parent_id, capacity, position, created_at, updated_at)
SELECT 'Safe', 'Wertsachen und empfindliche Sammlungsstücke.', '#64748b', NULL, 10, 12, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_locations WHERE name = 'Safe');

INSERT INTO collection_manufacturers (name, created_at, updated_at)
SELECT 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_manufacturers WHERE name = 'Nintendo');

INSERT INTO collection_manufacturers (name, created_at, updated_at)
SELECT 'The Pokemon Company', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_manufacturers WHERE name = 'The Pokemon Company');

INSERT INTO collection_manufacturers (name, created_at, updated_at)
SELECT 'Sony', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_manufacturers WHERE name = 'Sony');

INSERT INTO collection_manufacturers (name, created_at, updated_at)
SELECT 'Canon', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_manufacturers WHERE name = 'Canon');

INSERT INTO collection_manufacturers (name, created_at, updated_at)
SELECT 'Technics', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_manufacturers WHERE name = 'Technics');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Card Market', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Card Market');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Local Electronics Store', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Local Electronics Store');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Local Bookstore', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Local Bookstore');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Retro Fair', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Retro Fair');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'eBay', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'eBay');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Discogs', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Discogs');

INSERT INTO collection_suppliers (name, created_at, updated_at)
SELECT 'Kleinanzeigen', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_suppliers WHERE name = 'Kleinanzeigen');

INSERT INTO collection_vendors (name, created_at, updated_at)
SELECT 'Cardmarket', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_vendors WHERE name = 'Cardmarket');

INSERT INTO collection_vendors (name, created_at, updated_at)
SELECT 'Retro Trade', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_vendors WHERE name = 'Retro Trade');

INSERT INTO collection_vendors (name, created_at, updated_at)
SELECT 'Record Store Day Box', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_vendors WHERE name = 'Record Store Day Box');

INSERT INTO collection_vendors (name, created_at, updated_at)
SELECT 'Local Camera Shop', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_vendors WHERE name = 'Local Camera Shop');

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Pokemon 151 Elite Trainer Box', 'Versiegelte Elite Trainer Box als modernes, gut sichtbares Sammlerstück.', (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'The Pokemon Company' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-11-04', 59.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1), 'Scarlet & Violet 151', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1), 'Sammlerbox', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'like_new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon 151 Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Pokemon Crown Zenith Elite Trainer Box', 'Versiegelte Premium-Box als moderner Sammlungshöhepunkt.', (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Kartenregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'The Pokemon Company' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-10-19', 54.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1), 'Crown Zenith', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1), 'Sammlerbox', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Crown Zenith Elite Trainer Box' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-10-19', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Binder: Lieblings-Pokemonkarten', 'Kuratierter Binder mit Lieblingskarten zum Durchsehen und Präsentieren.', (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Kartenregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-09-11', 89, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1), 'Gemischt', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Gemischt', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1), 'Lieblings-Binder', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Binder: Lieblings-Pokemonkarten' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Gegradete Charizard Display-Karte', 'Gut sichtbare Display-Karte als Mittelpunkt der Karten-Sammlung.', (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'The Pokemon Company' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-08-01', 249, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1), 'Modern promo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1), 'Ultra rare', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'like_new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Gegradete Charizard Display-Karte' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Toploader-Aufbewahrungsbox', 'Schutzbox für sortierte Einzelkarten, Toploader und tauschbereite Karten.', (SELECT id FROM collection_categories WHERE name = 'Kartenaufbewahrung' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Kartenregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-09-03', 24.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Material' ORDER BY p.id LIMIT 1), 'Kunststoff', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Material' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1), '100 Karten', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Kapazität' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Toploader-Aufbewahrungsbox' AND c.name = 'Kartenaufbewahrung' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kartenaufbewahrung' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Pokemon Booster Bundle', 'Kompaktes versiegeltes Bundle als kleineres Sammlerstück neben den größeren Boxen.', (SELECT id FROM collection_categories WHERE name = 'Sammelkarten' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'The Pokemon Company' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Card Market' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Cardmarket' ORDER BY id LIMIT 1), '2025-11-12', 34.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1), 'Scarlet & Violet', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Set' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1), 'Booster bundle', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Seltenheit' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Versiegelt' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Gegradet' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'like_new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Pokemon Booster Bundle' AND c.name = 'Sammelkarten' AND COALESCE(i.purchase_date, '') = COALESCE('2025-11-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Sammelkarten' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Donkey Kong Country', 'Klassischer Plattformer als eines der markantesten Stücke im Retroregal.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-06-01', 34.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1994, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Plattform', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Donkey Kong Country' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-01', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Super Mario World', 'Grundlegender SNES-Klassiker als sauberes Lieblingsstück mit Modul und Box.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-05-27', 39.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1991, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Plattform', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-27', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'F-Zero', 'Schneller futuristischer Racer, der das Regal über Jump-and-Runs hinaus erweitert.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-06-10', 29.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1990, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Rennspiel', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'F-Zero' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-10', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'The Legend of Zelda: A Link to the Past', 'Abenteuer-Highlight als eines der stärkeren Boxstücke im Regal.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-04-29', 74.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1992, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Abenteuer', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: A Link to the Past' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-04-29', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Super Metroid', 'Stimmungsvoller Science-Fiction-Klassiker, der dem Regal mehr Spannweite gibt.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-07-15', 69.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1994, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Action-Adventure', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Metroid' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-07-15', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Mario Kart', 'Mehrspieler-Klassiker, der das Retroregal zugänglicher und geselliger macht.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-08-04', 42.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1992, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Rennspiel', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Mario Kart' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Yoshi''s Island', 'Farbenfroher später SNES-Liebling, der die Retro-Reihe etwas weicher macht.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Retrospieleregal' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Retro-Börse' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2025-09-09', 54.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1995, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett in Box' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1), 'false', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Anleitung enthalten' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Publisher' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Plattform', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Yoshi''s Island' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2025-09-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Der Herr der Ringe Trilogie', 'Geliebte Fantasy-Trilogie als zusammengehöriges, präsentables Leseset.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-02-03', 39.99, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'J.R.R. Tolkien', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback set', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'Der Herr der Ringe', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Der Herr der Ringe Trilogie' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Wool', 'Erster Silo-Roman, gemeinsam mit neueren Science-Fiction-Favoriten im Regal.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-06-06', 14, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Hugh Howey', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'Silo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Wool' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-06', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Shift', 'Zweiter Silo-Roman, direkt neben Wool als Teil derselben Reihe.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-06-12', 14, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Hugh Howey', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'Silo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Shift' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-06-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Northern Lights', 'Auftakt von His Dark Materials und klassischer, jüngerer Fantasy-Ton im Regal.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-05-04', 12, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Philip Pullman', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'His Dark Materials', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Northern Lights' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'The Subtle Knife', 'Zweiter Band von His Dark Materials, direkt neben dem Auftaktband.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-05-04', 12, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Philip Pullman', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'His Dark Materials', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Subtle Knife' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'The Amber Spyglass', 'Abschlussband, der die His-Dark-Materials-Reihe im Regal vervollständigt.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-05-04', 12, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Philip Pullman', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'His Dark Materials', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Amber Spyglass' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-05-04', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'The Hitchhiker''s Guide to the Galaxy', 'Humorvoller Science-Fiction-Klassiker, der dem Regal einen leichteren Ton gibt.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-03-18', 11, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'Douglas Adams', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'The Hitchhiker''s Guide to the Galaxy', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Hitchhiker''s Guide to the Galaxy' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Harry Potter and the Philosopher''s Stone', 'Vertrauter erster Fantasy-Band, der das Regal sofort bewohnt wirken lässt.', (SELECT id FROM collection_categories WHERE name = 'Bücher' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Bücherregal' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Lokale Buchhandlung' ORDER BY id LIMIT 1), NULL, '2025-02-25', 10, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1), 'J.K. Rowling', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Autor' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1), 'Englisch', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Sprache' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'Paperback', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1), 'Harry Potter', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Reihe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Harry Potter and the Philosopher''s Stone' AND c.name = 'Bücher' AND COALESCE(i.purchase_date, '') = COALESCE('2025-02-25', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Bücher' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Super Mario World', 'SNES Klassiker komplett mit Box und Anleitung.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine mitte' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'eBay' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2024-05-12', 69, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'SNES', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Altersfreigabe' ORDER BY p.id LIMIT 1), '["usk0"]', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Altersfreigabe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Super Mario World' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-05-12', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'The Legend of Zelda: Ocarina of Time', 'N64, guter Modulzustand, Box mit leichter Patina.', (SELECT id FROM collection_categories WHERE name = 'Retrospiele' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine mitte' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Kleinanzeigen' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2024-09-02', 89, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1), 'N64', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Plattform' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1), 'PAL', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Region' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Komplett' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Altersfreigabe' ORDER BY p.id LIMIT 1), '["usk6"]', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Altersfreigabe' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'The Legend of Zelda: Ocarina of Time' AND c.name = 'Retrospiele' AND COALESCE(i.purchase_date, '') = COALESCE('2024-09-02', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Retrospiele' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'PlayStation 2 Slim', 'Gut erhaltene Slim mit Controller und AV-Kabel.', (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine oben' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Sony' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'Kleinanzeigen' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2024-11-18', 75, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Hersteller' ORDER BY p.id LIMIT 1), 'Sony', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Hersteller' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 2004, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Funktionsfähig' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Funktionsfähig' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'PlayStation 2 Slim' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-11-18', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Nintendo 64 Konsole', 'PAL-Konsole mit Expansion Pak und gereinigtem Gehäuse.', (SELECT id FROM collection_categories WHERE name = 'Konsolen' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vitrine oben' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Nintendo' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'eBay' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Retro Trade' ORDER BY id LIMIT 1), '2024-07-03', 119, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Hersteller' ORDER BY p.id LIMIT 1), 'Nintendo', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Hersteller' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1), 1997, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Erscheinungsjahr' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Funktionsfähig' ORDER BY p.id LIMIT 1), 'true', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Funktionsfähig' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Nintendo 64 Konsole' AND c.name = 'Konsolen' AND COALESCE(i.purchase_date, '') = COALESCE('2024-07-03', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Konsolen' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Dark Side of the Moon', 'UK Reissue auf 180g Vinyl, sehr sauber erhalten.', (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vinyl-Bereich' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Discogs' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Record Store Day Box' ORDER BY id LIMIT 1), '2025-03-14', 34, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'LP', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Rock', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Bewertung' ORDER BY p.id LIMIT 1), 5, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Bewertung' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'like_new', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Dark Side of the Moon' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-03-14', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Blade Runner 2049 Soundtrack', 'Doppelte LP für Klangtests und Lieblingsabende.', (SELECT id FROM collection_categories WHERE name = 'Vinyl' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Vinyl-Bereich' ORDER BY id LIMIT 1), 1, 0, NULL, NULL, (SELECT id FROM collection_suppliers WHERE name = 'Discogs' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Record Store Day Box' ORDER BY id LIMIT 1), '2025-08-08', 41, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Format' ORDER BY p.id LIMIT 1), 'LP', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Format' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Genre' ORDER BY p.id LIMIT 1), 'Soundtrack', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Genre' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Bewertung' ORDER BY p.id LIMIT 1), 4, '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Bewertung' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Blade Runner 2049 Soundtrack' AND c.name = 'Vinyl' AND COALESCE(i.purchase_date, '') = COALESCE('2025-08-08', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Vinyl' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Canon AE-1', 'Analoge Kamera mit schöner Patina und funktionierendem Belichtungsmesser.', (SELECT id FROM collection_categories WHERE name = 'Kamera' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Studio Shelf' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Canon' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'eBay' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Lokaler Kameraladen' ORDER BY id LIMIT 1), '2024-04-09', 210, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Mount' ORDER BY p.id LIMIT 1), 'Canon FD', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Mount' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":590,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon AE-1' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-09', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

INSERT INTO collection_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
SELECT 'Canon FD 50mm f/1.8', 'Leichtes Standardobjektiv für die AE-1.', (SELECT id FROM collection_categories WHERE name = 'Kamera' ORDER BY id LIMIT 1), (SELECT id FROM collection_locations WHERE name = 'Safe' ORDER BY id LIMIT 1), 1, 0, NULL, (SELECT id FROM collection_manufacturers WHERE name = 'Canon' ORDER BY id LIMIT 1), (SELECT id FROM collection_suppliers WHERE name = 'eBay' ORDER BY id LIMIT 1), (SELECT id FROM collection_vendors WHERE name = 'Lokaler Kameraladen' ORDER BY id LIMIT 1), '2024-04-11', 79, 'EUR', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', ''));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Mount' ORDER BY p.id LIMIT 1), 'Canon FD', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Mount' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1), '{"value":170,"unit":"g"}', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Gewicht' ORDER BY p.id LIMIT 1));

INSERT INTO collection_item_properties (item_id, property_id, value, created_at, updated_at)
SELECT (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1), (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1), 'very_good', '2026-05-20 09:00:00', '2026-05-20 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM collection_item_properties WHERE item_id = (SELECT i.id FROM collection_items i JOIN collection_categories c ON c.id = i.category_id WHERE i.name = 'Canon FD 50mm f/1.8' AND c.name = 'Kamera' AND COALESCE(i.purchase_date, '') = COALESCE('2024-04-11', '') ORDER BY i.id LIMIT 1) AND property_id = (SELECT p.id FROM collection_properties p JOIN collection_categories c ON c.id = p.category_id WHERE c.name = 'Kamera' AND p.name = 'Zustand' ORDER BY p.id LIMIT 1));

COMMIT;
