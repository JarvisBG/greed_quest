CREATE TABLE "arene" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"joueur_id" text NOT NULL,
	"pnj_id" text,
	"mise" integer NOT NULL,
	"entree_a" integer NOT NULL,
	"etat" text DEFAULT 'en_cours' NOT NULL,
	"gain" jsonb,
	"fin_a" integer
);
--> statement-breakpoint
ALTER TABLE "arene" ADD CONSTRAINT "arene_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arene" ADD CONSTRAINT "arene_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arene_partie" ON "arene" USING btree ("partie_id","etat");--> statement-breakpoint
CREATE INDEX "arene_joueur" ON "arene" USING btree ("joueur_id","entree_a");