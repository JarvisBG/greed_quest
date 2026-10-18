ALTER TABLE "zones" DROP CONSTRAINT "zones_qr_unique";--> statement-breakpoint
ALTER TABLE "balises" DROP CONSTRAINT "balises_pkey";--> statement-breakpoint
ALTER TABLE "balises" ADD CONSTRAINT "balises_partie_id_id_pk" PRIMARY KEY("partie_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_partie_qr" ON "zones" USING btree ("partie_id","qr");
