ALTER TABLE "joueurs" ADD COLUMN "code_secours" text;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "echecs_code" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "joueurs" ADD COLUMN "code_bloque_jusqua" bigint;--> statement-breakpoint
-- Joueurs déjà inscrits : un code de secours tiré au hasard (alphabet sans O / 0 / I / 1).
UPDATE "joueurs" SET "code_secours" = translate(upper(substr(md5(random()::text || "id"), 1, 6)), '01', 'KM') WHERE "code_secours" IS NULL;