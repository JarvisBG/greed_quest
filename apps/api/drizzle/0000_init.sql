CREATE TABLE "balises" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"zone_id" text NOT NULL,
	"libelle" text NOT NULL,
	"type" text,
	"etat" text DEFAULT 'dormante' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"epuisee_a" integer,
	"position" jsonb
);
--> statement-breakpoint
CREATE TABLE "cartes" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"numero" integer NOT NULL,
	"nom" text NOT NULL,
	"rang" text NOT NULL,
	"designee" boolean DEFAULT true NOT NULL,
	"lot_reel" text
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"zone_id" text NOT NULL,
	"arbitre_id" text,
	"defi" text NOT NULL,
	"cartes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evenements" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"zone_id" text,
	"debut" integer NOT NULL,
	"fin" integer NOT NULL,
	"etat" text NOT NULL,
	"reussi" boolean,
	"data" jsonb NOT NULL,
	"lance_par" text
);
--> statement-breakpoint
CREATE TABLE "exemplaires" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"joueur_id" text NOT NULL,
	"carte_id" text NOT NULL,
	"origine" jsonb NOT NULL,
	"obtenu_a" integer NOT NULL,
	"faux" jsonb,
	"marque" text,
	"maudite" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joueurs" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"pseudo" text NOT NULL,
	"appareil_id" text NOT NULL,
	"licence_secret" text NOT NULL,
	"nen" text,
	"jenny" integer DEFAULT 0 NOT NULL,
	"statut" text DEFAULT 'actif' NOT NULL,
	"position" jsonb,
	"derniere_action_a" integer,
	"gele_jusqua" integer,
	"immunite_jusqua" integer,
	"dernier_offensif_a" integer,
	"pouvoirs_utilises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transformation_dispo_a" integer,
	"historique_tirages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dernier_tirage_a" integer,
	"inscrit_a" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"heure_jeu" integer NOT NULL,
	"acteur_type" text NOT NULL,
	"acteur_id" text,
	"action" text NOT NULL,
	"resultat" text NOT NULL,
	"motif" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "livres" (
	"joueur_id" text PRIMARY KEY NOT NULL,
	"gele" boolean DEFAULT false NOT NULL,
	"gele_a" integer
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"etat" text DEFAULT 'brouillon' NOT NULL,
	"etat_avant_pause" text,
	"inscriptions_ouvertes" boolean DEFAULT false NOT NULL,
	"demarree_a" bigint,
	"pause_depuis" bigint,
	"pause_cumulee" bigint DEFAULT 0 NOT NULL,
	"terminee_a" integer,
	"parametres" jsonb NOT NULL,
	"j" jsonb DEFAULT '{"value":0,"lastDecreaseAt":null}'::jsonb NOT NULL,
	"perimetre" jsonb,
	"graine" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pertes" (
	"id" serial PRIMARY KEY NOT NULL,
	"joueur_id" text NOT NULL,
	"carte_id" text NOT NULL,
	"cause" text NOT NULL,
	"par" text,
	"a" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prereglages" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"systeme" boolean DEFAULT false NOT NULL,
	"reglages" jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sorts" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"joueur_id" text NOT NULL,
	"type" text NOT NULL,
	"obtenu_a" integer NOT NULL,
	"utilise" boolean DEFAULT false NOT NULL,
	"utilise_a" integer
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"nom" text NOT NULL,
	"role" text NOT NULL,
	"code_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" text PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"nom" text NOT NULL,
	"type" text NOT NULL,
	"polygone" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balises" ADD CONSTRAINT "balises_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balises" ADD CONSTRAINT "balises_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartes" ADD CONSTRAINT "cartes_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_arbitre_id_staff_id_fk" FOREIGN KEY ("arbitre_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemplaires" ADD CONSTRAINT "exemplaires_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemplaires" ADD CONSTRAINT "exemplaires_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemplaires" ADD CONSTRAINT "exemplaires_carte_id_cartes_id_fk" FOREIGN KEY ("carte_id") REFERENCES "public"."cartes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joueurs" ADD CONSTRAINT "joueurs_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livres" ADD CONSTRAINT "livres_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pertes" ADD CONSTRAINT "pertes_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sorts" ADD CONSTRAINT "sorts_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sorts" ADD CONSTRAINT "sorts_joueur_id_joueurs_id_fk" FOREIGN KEY ("joueur_id") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balises_partie" ON "balises" USING btree ("partie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cartes_partie_numero" ON "cartes" USING btree ("partie_id","numero");--> statement-breakpoint
CREATE INDEX "evenements_partie" ON "evenements" USING btree ("partie_id");--> statement-breakpoint
CREATE INDEX "exemplaires_joueur" ON "exemplaires" USING btree ("joueur_id");--> statement-breakpoint
CREATE INDEX "exemplaires_partie" ON "exemplaires" USING btree ("partie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "joueurs_partie_pseudo" ON "joueurs" USING btree ("partie_id","pseudo");--> statement-breakpoint
CREATE UNIQUE INDEX "joueurs_partie_appareil" ON "joueurs" USING btree ("partie_id","appareil_id");--> statement-breakpoint
CREATE INDEX "journal_partie" ON "journal" USING btree ("partie_id","id");--> statement-breakpoint
CREATE INDEX "pertes_joueur" ON "pertes" USING btree ("joueur_id");--> statement-breakpoint
CREATE INDEX "sorts_joueur" ON "sorts" USING btree ("joueur_id");