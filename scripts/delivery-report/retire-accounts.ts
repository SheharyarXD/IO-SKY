/**
 * Delivery report, final step: retires the demo accounts used for the capture.
 * Removes the password so they cannot sign in, and expires any open invitation
 * addressed to a demo address. Demo records stay in the database, prefixed DEMO.
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
const users = await sql`update users set "passwordHash" = null where email like '%@demo.invalid' returning email`;
const inv = await sql`update account_invitations set "expiresAt" = now() - interval '1 day' where email like '%demo.invalid' and "acceptedAt" is null returning email`;
console.log("accounts without a password now:", users.map((u) => u.email));
console.log("open invitations expired:", inv.map((i) => i.email));
await sql.end();
