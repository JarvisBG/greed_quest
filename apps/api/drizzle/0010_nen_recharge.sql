ALTER TABLE "joueurs" ADD COLUMN "pouvoirs_a" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "derniere_reserve_a" integer;