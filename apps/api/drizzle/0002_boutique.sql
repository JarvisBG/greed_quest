ALTER TABLE "parties" ADD COLUMN "vague_boutique" jsonb;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "reglages_boutique" jsonb;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "qr" text;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_qr_unique" UNIQUE("qr");