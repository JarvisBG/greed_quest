ALTER TABLE "exemplaires" ADD COLUMN "cachee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "accompagne_jusqua" integer;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "accompagne_par" text;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "villes_visitees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "retour_ville" text;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "retour_jusqua" integer;