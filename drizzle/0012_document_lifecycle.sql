CREATE TYPE "public"."client_documents_status" AS ENUM('pending_review', 'approved', 'rejected', 'superseded');--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "documentGroupId" integer;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "status" "client_documents_status" DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "reviewedByUserId" integer;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "reviewedAt" timestamp;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "reviewNote" text;--> statement-breakpoint
ALTER TABLE "client_documents" ADD COLUMN "retentionNote" text;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_reviewedByUserId_users_id_fk" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_documents_document_group_id_idx" ON "client_documents" USING btree ("documentGroupId");