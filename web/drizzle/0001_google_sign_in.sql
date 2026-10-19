ALTER TABLE "customers" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_google_sub_unique" UNIQUE("google_sub");