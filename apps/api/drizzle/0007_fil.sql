CREATE TABLE "fil" (
	"id" serial PRIMARY KEY NOT NULL,
	"partie_id" text NOT NULL,
	"heure_jeu" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fil" ADD CONSTRAINT "fil_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fil_partie" ON "fil" USING btree ("partie_id","id");