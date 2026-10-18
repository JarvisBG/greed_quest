ALTER TABLE "joueurs" ADD COLUMN "profil" jsonb;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "telephone" text;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "accord_recontact" boolean DEFAULT false NOT NULL;