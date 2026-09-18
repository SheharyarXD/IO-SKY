-- Discovery Call spec §11 (Call Type — PHONE / VIDEO).
--
-- PHONE is the authoritative default and the only type the customer-facing
-- flow ever produces. An authorised IO SKY user can later switch a specific
-- booking to VIDEO internally (server/routers/bookingAdmin.ts), at which
-- point meetingUrl carries the booking-specific, server-validated HTTPS
-- meeting link that the confirmation email's "Join Meeting" CTA opens.
-- Additive only, per the rollback plan (docs/RELEASE_ROLLBACK_PLAN.md).

CREATE TYPE "booking_call_type" AS ENUM ('phone', 'video');
--> statement-breakpoint

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "callType" "booking_call_type" NOT NULL DEFAULT 'phone';
--> statement-breakpoint

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "meetingUrl" text;
--> statement-breakpoint

-- Recipient locale at booking time, so a reminder sent later (24h/1h before
-- the call) can be rendered in the same language as the original
-- confirmation without needing the original request's session context.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "locale" varchar(16);
