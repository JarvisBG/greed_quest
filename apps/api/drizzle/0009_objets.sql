CREATE TABLE "objets" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"joueur_id" text NOT NULL,
	"type" text NOT NULL,
	"obtenu_a" integer NOT NULL,
	"utilise" boolean DEFAULT false NOT NULL,
	"utilise_a" integer
);
--> statement-breakpoint
ALTER TABLE "exemplaires" ADD COLUMN "coffre_jusqua" integer;--> statement-breakpoint
ALTER TABLE "objets" ADD CONSTRAINT "objets_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objets" ADD CONSTRAINT "objets_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "objets_joueur" ON "objets" USING btree ("joueur_id");