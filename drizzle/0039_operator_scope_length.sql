-- Per-agent Technical Operator scopes (task G09). NOT applied by this repository.
-- Widens operator_scopes.scope from varchar(32) to varchar(80) so that "agent:<key>:<action>" fits
-- (6 + up to 64 + 1 + up to 7 = 78 characters). Widening a varchar in PostgreSQL keeps every existing value
-- and needs no table rewrite. Order: independent of 0037 and 0038. Until it is applied, granting an agent scope
-- whose key makes it longer than 32 characters fails with a database error; nothing else changes.
ALTER TABLE "operator_scopes" ALTER COLUMN "scope" TYPE varchar(80);
