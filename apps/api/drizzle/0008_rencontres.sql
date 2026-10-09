CREATE TABLE "rencontres" (
	"partie_id" text NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"premiere_a" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_a_joueurs_id_fk" FOREIGN KEY ("a") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_b_joueurs_id_fk" FOREIGN KEY ("b") REFERENCES "public"."joueurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rencontres_paire" ON "rencontres" USING btree ("a","b");--> statement-breakpoint
CREATE INDEX "rencontres_partie" ON "rencontres" USING btree ("partie_id");