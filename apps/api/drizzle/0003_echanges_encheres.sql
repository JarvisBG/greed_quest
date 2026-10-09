CREATE TABLE "echanges" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"etat" text NOT NULL,
	"derniere_action_a" integer NOT NULL,
	"donne_a" jsonb NOT NULL,
	"donne_b" jsonb NOT NULL,
	"valide_a" boolean DEFAULT false NOT NULL,
	"valide_b" boolean DEFAULT false NOT NULL,
	"conclu_a" integer
);
--> statement-breakpoint
CREATE TABLE "encheres" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"carte_id" text NOT NULL,
	"pnj_id" text,
	"prix_depart" integer NOT NULL,
	"debut" integer NOT NULL,
	"fin" integer NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"etat" text DEFAULT 'ouverte' NOT NULL,
	"gagnant_id" text,
	"prix" integer
);
--> statement-breakpoint
ALTER TABLE "echanges" ADD CONSTRAINT "echanges_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echanges" ADD CONSTRAINT "echanges_a_joueurs_id_fk" FOREIGN KEY ("a") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echanges" ADD CONSTRAINT "echanges_b_joueurs_id_fk" FOREIGN KEY ("b") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encheres" ADD CONSTRAINT "encheres_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encheres" ADD CONSTRAINT "encheres_carte_id_cartes_id_fk" FOREIGN KEY ("carte_id") REFERENCES "public"."cartes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "echanges_partie" ON "echanges" USING btree ("partie_id","etat");