/*
 * IO SKY — SMS sender abstraction for the MFA track.
 *
 * Goals:
 *   - Keep the rest of the system unaware of any specific SMS provider.
 *   - Default safely: when no provider env is present we fall back to a
 *     console sender that logs the OTP to the server log (never to the
 *     client). This is dev-only by definition.
 *   - When TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER are
 *     present, pick the Twilio adapter automatically.
 *
 * The interface is tiny on purpose. Any future provider (MessageBird,
 * Vonage, AWS SNS, …) only has to implement `sendOtp`.
 */

export interface SmsSendResult {
  /** True when the provider accepted the message for delivery. */
  ok: boolean;
  /** Provider-side message identifier when available. */
  providerMessageId?: string;
  /** Optional provider error code, for audit. */
  errorCode?: string;
}

export interface SmsSender {
  readonly name: string;
  sendOtp(input: {
    /** E.164 destination, e.g. "+31612345678". */
    to: string;
    /** The OTP value the user must enter to verify. */
    code: string;
    /** Plain-text message to deliver. The OTP is already embedded. */
    body: string;
  }): Promise<SmsSendResult>;
}

/**
 * Dev/test fallback. The OTP is written to the server console so a
 * developer can see it locally; the client never sees the value via the
 * tRPC response. Returns ok=true unconditionally.
 */
export const consoleSmsSender: SmsSender = {
  name: "console",
  async sendOtp({ to, code, body }) {
    // Mask the middle digits when logging so the log isn't an OTP gift.
    const masked =
      code.length >= 4 ? `${code.slice(0, 1)}***${code.slice(-1)}` : "***";
    // eslint-disable-next-line no-console
    console.log(
      `[SMS:console] to=${to} code=${masked} body=${body
        .replace(code, masked)
        .slice(0, 120)}`,
    );
    return { ok: true, providerMessageId: "console-" + Date.now() };
  },
};

/**
 * Twilio adapter. Lives behind a feature flag so the sandbox does not
 * accidentally bill anyone.
 */
function buildTwilioSender(opts: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): SmsSender {
  const { accountSid, authToken, fromNumber } = opts;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader =
    "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  return {
    name: "twilio",
    async sendOtp({ to, body }) {
      try {
        const form = new URLSearchParams();
        form.set("To", to);
        form.set("From", fromNumber);
        form.set("Body", body);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });

        if (!resp.ok) {
          let errorCode: string | undefined;
          try {
            const payload = await resp.json();
            errorCode = String(payload?.code ?? resp.status);
          } catch {
            errorCode = String(resp.status);
          }
          return { ok: false, errorCode };
        }

        const payload = await resp.json();
        return {
          ok: true,
          providerMessageId: payload?.sid ? String(payload.sid) : undefined,
        };
      } catch (e) {
        return {
          ok: false,
          errorCode:
            e instanceof Error ? e.message.slice(0, 80) : "network_error",
        };
      }
    },
  };
}

let cached: SmsSender | null = null;

/**
 * Pick the right sender for the current environment. We resolve lazily so
 * the tests can swap env vars without re-importing the module.
 */
export function getSmsSender(): SmsSender {
  if (cached) return cached;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (sid && token && from) {
    cached = buildTwilioSender({
      accountSid: sid,
      authToken: token,
      fromNumber: from,
    });
  } else {
    cached = consoleSmsSender;
  }

  return cached;
}

/** Test-only helper to force a specific sender. */
export function __setSmsSenderForTests(sender: SmsSender | null) {
  cached = sender;
}

/**
 * Generates a 6-digit numeric OTP suitable for SMS. Leading zeros are
 * preserved by string formatting. Uses Node's crypto.randomInt for
 * uniform distribution.
 */
export function generateSmsOtp(): string {
  // 1_000_000 = 6 digits including 000000.
  const crypto = require("crypto") as typeof import("crypto");
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}
