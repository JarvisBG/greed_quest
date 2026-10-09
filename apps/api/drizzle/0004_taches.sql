ALTER TABLE "parties" ADD COLUMN "taches" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "classement_final" jsonb;