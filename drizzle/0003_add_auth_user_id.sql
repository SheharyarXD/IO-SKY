ALTER TABLE "users" ADD COLUMN "authUserId" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_authUserId_unique" UNIQUE("authUserId");