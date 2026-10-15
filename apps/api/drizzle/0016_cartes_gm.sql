CREATE TABLE "cartes_gm" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"type" text NOT NULL,
	"joueur_id" text,
	"obtenu_a" integer,
	"jouee" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "encheres" ALTER COLUMN "carte_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "encheres" ADD COLUMN "carte_gm" text;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "fige_jusqua" integer;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "scelle_jusqua" integer;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "intouchable_jusqua" integer;--> statement-breakpoint
ALTER TABLE "cartes_gm" ADD CONSTRAINT "cartes_gm_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartes_gm" ADD CONSTRAINT "cartes_gm_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cartes_gm_partie_type" ON "cartes_gm" USING btree ("partie_id","type");--> statement-breakpoint
CREATE INDEX "cartes_gm_joueur" ON "cartes_gm" USING btree ("joueur_id");