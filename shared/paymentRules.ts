/** Payment reminder staging (notification catalogue family 5). Pure so it can be tested directly. */

const DAY = 86_400_000;

export type PaymentReminderEvent = "PAYMENT_DUE_7D" | "PAYMENT_DUE_1D" | "PAYMENT_DUE_TODAY" | "PAYMENT_OVERDUE";

/**
 * Which reminder applies now. The closest applicable stage wins and the caller
 * de-duplicates per invoice and stage, so each stage is raised at most once.
 * Calendar days are compared in UTC.
 */
export function reminderEventFor(dueMs: number, nowMs: number): PaymentReminderEvent | null {
  const dueDay = Math.floor(dueMs / DAY);
  const today = Math.floor(nowMs / DAY);
  const diff = dueDay - today;
  if (diff < 0) return "PAYMENT_OVERDUE";
  if (diff === 0) return "PAYMENT_DUE_TODAY";
  if (diff <= 1) return "PAYMENT_DUE_1D";
  if (diff <= 7) return "PAYMENT_DUE_7D";
  return null;
}
