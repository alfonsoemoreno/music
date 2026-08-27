CREATE TABLE "viewer_recovery_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"viewer_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
