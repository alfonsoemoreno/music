-- Clean records produced by overlapping enrichment events before enforcing idempotency.
WITH ranked AS (SELECT id, first_value(id) OVER (PARTITION BY discogs_release_id ORDER BY id) AS keep_id, row_number() OVER (PARTITION BY discogs_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE discogs_release_id IS NOT NULL)
UPDATE artwork AS target SET release_id = ranked.keep_id FROM ranked WHERE target.release_id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, first_value(id) OVER (PARTITION BY discogs_release_id ORDER BY id) AS keep_id, row_number() OVER (PARTITION BY discogs_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE discogs_release_id IS NOT NULL)
UPDATE credits AS target SET release_id = ranked.keep_id FROM ranked WHERE target.release_id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY discogs_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE discogs_release_id IS NOT NULL)
DELETE FROM releases AS target USING ranked WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, first_value(id) OVER (PARTITION BY musicbrainz_release_id ORDER BY id) AS keep_id, row_number() OVER (PARTITION BY musicbrainz_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE musicbrainz_release_id IS NOT NULL)
UPDATE artwork AS target SET release_id = ranked.keep_id FROM ranked WHERE target.release_id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, first_value(id) OVER (PARTITION BY musicbrainz_release_id ORDER BY id) AS keep_id, row_number() OVER (PARTITION BY musicbrainz_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE musicbrainz_release_id IS NOT NULL)
UPDATE credits AS target SET release_id = ranked.keep_id FROM ranked WHERE target.release_id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY musicbrainz_release_id ORDER BY id) AS duplicate_rank FROM releases WHERE musicbrainz_release_id IS NOT NULL)
DELETE FROM releases AS target USING ranked WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, first_value(id) OVER (PARTITION BY album_id, musicbrainz_id ORDER BY id) AS keep_id, row_number() OVER (PARTITION BY album_id, musicbrainz_id ORDER BY id) AS duplicate_rank FROM tracks WHERE musicbrainz_id IS NOT NULL)
UPDATE credits AS target SET track_id = ranked.keep_id FROM ranked WHERE target.track_id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY album_id, musicbrainz_id ORDER BY id) AS duplicate_rank FROM tracks WHERE musicbrainz_id IS NOT NULL)
DELETE FROM tracks AS target USING ranked WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "releases_discogs_release_unique" ON "releases" USING btree ("discogs_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_musicbrainz_release_unique" ON "releases" USING btree ("musicbrainz_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_album_musicbrainz_unique" ON "tracks" USING btree ("album_id","musicbrainz_id");
