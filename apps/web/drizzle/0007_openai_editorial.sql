ALTER TABLE "albums" ADD COLUMN "editorial" jsonb;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "editorial_model" text;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "editorial_updated_at" timestamp with time zone;
