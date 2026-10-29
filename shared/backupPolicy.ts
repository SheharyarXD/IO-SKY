/**
 * Backup policy visibility (task I03; SRS 25.8, 25.20, 26.13; 29 Oct Ch20, ACC-33).
 * Pure rules for the backup policy page in the admin console.
 *
 * What this can and cannot say. Backups are made by the database and storage
 * providers; this platform cannot read the provider plan, cannot see whether a
 * backup exists and cannot run a restore. The values here are DECLARED by a super
 * administrator through the normal configuration pipeline (validated, history
 * kept) and the evaluation only checks them for completeness, internal
 * consistency and age. Its best result is "declared", never "verified": a restore
 * rehearsal outside the platform is the only proof, and the page says so.
 */
export const BACKUP_KEYS = {
  rpoHours: "backup.rpo_hours",
  rtoHours: "backup.rto_hours",
  retentionDays: "backup.retention_days",
  pitr: "backup.pitr_enabled",
  storageProcedure: "backup.storage_procedure",
  lastRehearsalDate: "backup.last_rehearsal_date",
  lastRehearsalResult: "backup.last_rehearsal_result",
  rehearsalIntervalDays: "backup.rehearsal_interval_days",
  owner: "backup.owner",
} as const;

export const NOT_SET = "not_set";

export const STORAGE_PROCEDURES = ["none", "manual", "automated"] as const;
export const REHEARSAL_RESULTS = ["passed", "failed", "not_run"] as const;

const INT_RANGES: Record<string, [number, number]> = {
  [BACKUP_KEYS.rpoHours]: [1, 720],
  [BACKUP_KEYS.rtoHours]: [1, 720],
  [BACKUP_KEYS.retentionDays]: [1, 3650],
  [BACKUP_KEYS.rehearsalIntervalDays]: [7, 365],
};

export function isBackupKey(key: string): boolean {
  return key.startsWith("backup.");
}

function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Validate a backup setting before it is applied. "not_set" is always allowed: it means undeclared. */
export function validateBackupSetting(key: string, raw: string, now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
  const v = raw.trim();
  if (v === NOT_SET) return { ok: true };
  const range = INT_RANGES[key];
  if (range) {
    const n = Number(v);
    return /^\d+$/.test(v) && n >= range[0] && n <= range[1] ? { ok: true } : { ok: false, reason: `This setting must be a whole number from ${range[0]} to ${range[1]}, or "${NOT_SET}".` };
  }
  switch (key) {
    case BACKUP_KEYS.pitr:
      return v === "on" || v === "off" ? { ok: true } : { ok: false, reason: `This setting accepts only "on", "off" or "${NOT_SET}".` };
    case BACKUP_KEYS.storageProcedure:
      return (STORAGE_PROCEDURES as readonly string[]).includes(v) ? { ok: true } : { ok: false, reason: `Use one of: ${STORAGE_PROCEDURES.join(", ")}, or "${NOT_SET}".` };
    case BACKUP_KEYS.lastRehearsalResult:
      return (REHEARSAL_RESULTS as readonly string[]).includes(v) ? { ok: true } : { ok: false, reason: `Use one of: ${REHEARSAL_RESULTS.join(", ")}, or "${NOT_SET}".` };
    case BACKUP_KEYS.lastRehearsalDate:
      if (v === "never") return { ok: true };
      if (!validDate(v)) return { ok: false, reason: `Use a date as YYYY-MM-DD, "never", or "${NOT_SET}".` };
      return new Date(`${v}T00:00:00Z`).getTime() > now.getTime() + 86_400_000 ? { ok: false, reason: "A rehearsal date cannot be in the future." } : { ok: true };
    case BACKUP_KEYS.owner:
      return v.length >= 2 && v.length <= 120 ? { ok: true } : { ok: false, reason: `Name the person or role responsible, or "${NOT_SET}".` };
    default:
      return { ok: false, reason: "Unknown backup setting." };
  }
}

export type Declared = {
  rpoHours: number | null;
  rtoHours: number | null;
  retentionDays: number | null;
  pitr: boolean | null;
  storageProcedure: (typeof STORAGE_PROCEDURES)[number] | null;
  lastRehearsalDate: string | null; // YYYY-MM-DD, or null when never or not declared
  rehearsedNever: boolean;
  lastRehearsalResult: (typeof REHEARSAL_RESULTS)[number] | null;
  rehearsalIntervalDays: number | null;
  owner: string | null;
};

export function readDeclared(settings: ReadonlyMap<string, string> | Record<string, string>): Declared {
  const get = (k: string): string | null => {
    const v = settings instanceof Map ? settings.get(k) : (settings as Record<string, string>)[k];
    const t = (v ?? "").trim();
    return !t || t === NOT_SET ? null : t;
  };
  const int = (k: string): number | null => {
    const v = get(k);
    return v !== null && /^\d+$/.test(v) ? Number(v) : null;
  };
  const oneOf = <T extends string>(k: string, list: readonly T[]): T | null => {
    const v = get(k);
    return v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;
  };
  const date = get(BACKUP_KEYS.lastRehearsalDate);
  const pitr = get(BACKUP_KEYS.pitr);
  return {
    rpoHours: int(BACKUP_KEYS.rpoHours),
    rtoHours: int(BACKUP_KEYS.rtoHours),
    retentionDays: int(BACKUP_KEYS.retentionDays),
    pitr: pitr === "on" ? true : pitr === "off" ? false : null,
    storageProcedure: oneOf(BACKUP_KEYS.storageProcedure, STORAGE_PROCEDURES),
    lastRehearsalDate: date && validDate(date) ? date : null,
    rehearsedNever: date === "never",
    lastRehearsalResult: oneOf(BACKUP_KEYS.lastRehearsalResult, REHEARSAL_RESULTS),
    rehearsalIntervalDays: int(BACKUP_KEYS.rehearsalIntervalDays),
    owner: get(BACKUP_KEYS.owner),
  };
}

export type Severity = "high" | "medium" | "info";
export type Finding = { code: string; severity: Severity; message: string };

/** declared = complete and nothing wrong with it, still unverified. */
export type PolicyStatus = "undeclared" | "incomplete" | "attention" | "declared";

export type BackupAssessment = {
  status: PolicyStatus;
  findings: Finding[];
  declared: Declared;
  rehearsalAgeDays: number | null;
  rehearsalDue: boolean;
  /** Always shown with the policy. */
  disclosure: string;
};

export const DISCLOSURE = "These values are declared by an administrator. The platform cannot read the database or storage provider plan, cannot see whether a backup exists and cannot run a restore. Only a restore rehearsal proves that recovery works.";

const REQUIRED: Array<[keyof Declared, string, string]> = [
  ["rpoHours", "rpo_not_declared", "The acceptable data loss (RPO) is not declared."],
  ["rtoHours", "rto_not_declared", "The target recovery time (RTO) is not declared."],
  ["retentionDays", "retention_not_declared", "The backup retention period is not declared."],
  ["pitr", "pitr_not_declared", "Whether point in time recovery is enabled is not declared."],
  ["storageProcedure", "storage_procedure_not_declared", "How uploaded files are backed up and restored is not declared."],
  ["owner", "owner_not_declared", "Nobody is named as responsible for backups and restores."],
];

export function assessBackupPolicy(declared: Declared, now: Date = new Date()): BackupAssessment {
  const findings: Finding[] = [];
  const missing = REQUIRED.filter(([k]) => declared[k] === null);
  for (const [, code, message] of missing) findings.push({ code, severity: "medium", message });

  const nothingDeclared = missing.length === REQUIRED.length && declared.lastRehearsalDate === null && !declared.rehearsedNever && declared.lastRehearsalResult === null;

  let rehearsalAgeDays: number | null = null;
  let rehearsalDue = false;
  const interval = declared.rehearsalIntervalDays ?? 90;
  if (declared.rehearsedNever || declared.lastRehearsalResult === "not_run") {
    findings.push({ code: "restore_never_rehearsed", severity: "high", message: "No restore has been rehearsed, so the recovery time is unproven." });
    rehearsalDue = true;
  } else if (declared.lastRehearsalDate) {
    rehearsalAgeDays = Math.floor((now.getTime() - new Date(`${declared.lastRehearsalDate}T00:00:00Z`).getTime()) / 86_400_000);
    if (declared.lastRehearsalResult === "failed") findings.push({ code: "last_rehearsal_failed", severity: "high", message: "The last restore rehearsal failed. Recovery is not proven until one passes." });
    else if (declared.lastRehearsalResult === null) findings.push({ code: "rehearsal_result_not_declared", severity: "medium", message: "The result of the last rehearsal is not declared." });
    if (rehearsalAgeDays > interval) {
      rehearsalDue = true;
      findings.push({ code: "rehearsal_overdue", severity: "medium", message: `The last rehearsal was ${rehearsalAgeDays} days ago; the policy asks for one at least every ${interval} days.` });
    }
  } else if (declared.lastRehearsalResult === "passed") {
    findings.push({ code: "rehearsal_date_not_declared", severity: "medium", message: "A passed rehearsal is declared without its date." });
    rehearsalDue = true;
  } else if (!nothingDeclared) {
    findings.push({ code: "rehearsal_not_declared", severity: "medium", message: "Whether a restore has ever been rehearsed is not declared." });
    rehearsalDue = true;
  }

  if (declared.storageProcedure === "none") findings.push({ code: "files_not_covered", severity: "high", message: "Uploaded files have no backup procedure. A database restore does not bring files back." });
  if (declared.rpoHours !== null && declared.rpoHours < 24 && declared.pitr === false) findings.push({ code: "rpo_needs_pitr", severity: "high", message: `An acceptable data loss of ${declared.rpoHours} hours cannot be met by daily backups; point in time recovery is declared off.` });
  if (declared.retentionDays !== null && declared.retentionDays < 7) findings.push({ code: "short_retention", severity: "medium", message: `Backups are kept for only ${declared.retentionDays} days.` });

  const status: PolicyStatus = nothingDeclared ? "undeclared" : findings.some((f) => f.severity === "high") ? "attention" : missing.length > 0 ? "incomplete" : findings.length > 0 ? "attention" : "declared";
  return { status, findings, declared, rehearsalAgeDays, rehearsalDue, disclosure: DISCLOSURE };
}

/** The default rows seeded into platform_settings. Every value starts undeclared: nothing is claimed that nobody has stated. */
export const BACKUP_SETTING_SEEDS: Array<{ section: string; key: string; title: string; description: string; value: string }> = [
  { section: "backup", key: BACKUP_KEYS.rpoHours, title: "Backup: acceptable data loss (hours)", description: `RPO, from 1 to 720, or "${NOT_SET}". Declared, not measured.`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.rtoHours, title: "Backup: target recovery time (hours)", description: `RTO, from 1 to 720, or "${NOT_SET}". Proven only by a restore rehearsal.`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.retentionDays, title: "Backup: retention (days)", description: `How long the provider keeps backups, from 1 to 3650, or "${NOT_SET}".`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.pitr, title: "Backup: point in time recovery", description: `"on" or "off" as configured with the database provider, or "${NOT_SET}".`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.storageProcedure, title: "Backup: uploaded files", description: `none, manual or automated, or "${NOT_SET}". Files are not part of a database restore.`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.lastRehearsalDate, title: "Backup: last restore rehearsal", description: `Date as YYYY-MM-DD, "never", or "${NOT_SET}".`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.lastRehearsalResult, title: "Backup: last rehearsal result", description: `passed, failed or not_run, or "${NOT_SET}".`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.rehearsalIntervalDays, title: "Backup: rehearsal interval (days)", description: `How often a restore should be rehearsed, from 7 to 365 (90 is assumed when unset).`, value: NOT_SET },
  { section: "backup", key: BACKUP_KEYS.owner, title: "Backup: responsible person or role", description: `Who owns backups and restores, or "${NOT_SET}".`, value: NOT_SET },
];
