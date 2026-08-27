ALTER TABLE "bridges" ADD COLUMN "viewer_id" text;
--> statement-breakpoint
ALTER TABLE "bridge_enrollment_codes" ADD COLUMN "viewer_id" text;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "bridge_id" uuid;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE no action ON UPDATE no action;
