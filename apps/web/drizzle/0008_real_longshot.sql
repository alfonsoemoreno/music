CREATE TABLE "bridge_enrollment_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bridge_enrollment_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "bridge_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" text NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "bridges_installation_id_unique" UNIQUE("installation_id"),
	CONSTRAINT "bridges_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
ALTER TABLE "bridge_nonces" ADD CONSTRAINT "bridge_nonces_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bridge_nonce_unique" ON "bridge_nonces" USING btree ("bridge_id","nonce");
