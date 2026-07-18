/**
 * IO SKY — Audit / CRM router.
 *
 * Admin-only:
 *   - audit.listLogins — last 100 login attempts.
 *   - audit.listLeads — last 100 CRM leads (cross-source funnel view).
 */

import { listRecentLeads, listRecentLoginAudit } from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const auditRouter = router({
  listLogins: adminProcedure.query(async () => {
    return listRecentLoginAudit(100);
  }),
  listLeads: adminProcedure.query(async () => {
    return listRecentLeads(100);
  }),
});
