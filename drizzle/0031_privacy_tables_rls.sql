-- Row Level Security for the Data Subject Rights tables (0021).
--
-- 0021 created these without RLS, so the Supabase REST API would have served
-- them to anyone holding the publishable key. They will hold personal data
-- (requester identity, verification notes, actions taken).
--
-- The policy is deliberately NONE. The client's requirement is that only an
-- explicitly authorised privacy officer may act on a request, and that no role
-- gets access merely because of its general role. That check lives in the
-- application (privacyOfficerProcedure). With RLS enabled and forced and no
-- policy, the anon and authenticated database roles can read nothing at all;
-- the backend's privileged connection is unaffected. An admin policy here would
-- have quietly given every admin a direct path to the data.

ALTER TABLE "privacy_officer_grants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "privacy_officer_grants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "privacy_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "privacy_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "privacy_request_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "privacy_request_events" FORCE ROW LEVEL SECURITY;
