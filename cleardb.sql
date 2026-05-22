-- item+ clear database script for MariaDB/MySQL.
-- Keeps user accounts in `users`, clears everything else, and resets table counters.
-- Make a backup first. This is intentionally destructive for all non-user data.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE archive_item_properties;
TRUNCATE TABLE archive_attachments;
TRUNCATE TABLE archive_checkouts;
TRUNCATE TABLE archive_item_components;
TRUNCATE TABLE archive_items;
TRUNCATE TABLE archive_properties;
TRUNCATE TABLE archive_locations;
TRUNCATE TABLE archive_categories;
TRUNCATE TABLE archive_manufacturers;
TRUNCATE TABLE archive_suppliers;
TRUNCATE TABLE archive_vendors;

TRUNCATE TABLE collection_item_properties;
TRUNCATE TABLE collection_attachments;
TRUNCATE TABLE collection_checkouts;
TRUNCATE TABLE collection_item_components;
TRUNCATE TABLE collection_items;
TRUNCATE TABLE collection_properties;
TRUNCATE TABLE collection_locations;
TRUNCATE TABLE collection_categories;
TRUNCATE TABLE collection_manufacturers;
TRUNCATE TABLE collection_suppliers;
TRUNCATE TABLE collection_vendors;

TRUNCATE TABLE checkout_requests;
TRUNCATE TABLE device_sessions;
TRUNCATE TABLE qr_login_tokens;
TRUNCATE TABLE magic_link_tokens;
TRUNCATE TABLE label_templates;
TRUNCATE TABLE external_sources;
TRUNCATE TABLE generic_sales_platforms;


SET FOREIGN_KEY_CHECKS = 1;
