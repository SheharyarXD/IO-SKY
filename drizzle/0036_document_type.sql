-- Document matrix enforcement (OPD-003, SRS 18.19 to 18.21): each document may be tagged with its type.
ALTER TABLE "client_documents" ADD COLUMN IF NOT EXISTS "documentType" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_documents_document_type_idx" ON "client_documents" ("documentType");
