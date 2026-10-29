/*
 * I03 (SRS 25.8; 29 Oct Ch20, ACC-33): backup policy visibility. Pure rules and the
 * configuration validation; database-free. These tests show the page reports what
 * is declared and what is missing. They do not and cannot show a backup exists.
 */
import { describe, expect, it } from "vitest";
import { assessBackupPolicy, BACKUP_KEYS, BACKUP_SETTING_SEEDS, DISCLOSURE, isBackupKey, NOT_SET, readDeclared, validateBackupSetting, type Declared } from "../shared/backupPolicy";
import { validateSettingValue } from "../shared/srsRules";

const NOW = new Date("2026-10-30T12:00:00Z");
const full: Declared = { rpoHours: 24, rtoHours: 8, retentionDays: 14, pitr: true, storageProcedure: "manual", lastRehearsalDate: "2026-10-01", rehearsedNever: false, lastRehearsalResult: "passed", rehearsalIntervalDays: 90, owner: "Platform lead" };
const codes = (d: Declared, now = NOW) => assessBackupPolicy(d, now).findings.map((f) => f.code);

describe("validation", () => {
  it("accepts in-range integers, the enum values, dates, 'never' and 'not_set'", () => {
    for (const [k, v] of [
      [BACKUP_KEYS.rpoHours, "1"],
      [BACKUP_KEYS.rpoHours, "720"],
      [BACKUP_KEYS.rtoHours, "8"],
      [BACKUP_KEYS.retentionDays, "3650"],
      [BACKUP_KEYS.rehearsalIntervalDays, "7"],
      [BACKUP_KEYS.pitr, "on"],
      [BACKUP_KEYS.pitr, "off"],
      [BACKUP_KEYS.storageProcedure, "automated"],
      [BACKUP_KEYS.lastRehearsalResult, "failed"],
      [BACKUP_KEYS.lastRehearsalDate, "2026-10-01"],
      [BACKUP_KEYS.lastRehearsalDate, "never"],
      [BACKUP_KEYS.owner, "Platform lead"],
      [BACKUP_KEYS.rpoHours, NOT_SET],
      [BACKUP_KEYS.pitr, NOT_SET],
    ] as const) expect(validateBackupSetting(k, v, NOW), `${k}=${v}`).toEqual({ ok: true });
  });
  it("rejects out-of-range, non-integer, wrong enum, impossible and future dates, and unknown keys", () => {
    for (const [k, v] of [
      [BACKUP_KEYS.rpoHours, "0"],
      [BACKUP_KEYS.rpoHours, "721"],
      [BACKUP_KEYS.rpoHours, "1.5"],
      [BACKUP_KEYS.rpoHours, "-3"],
      [BACKUP_KEYS.rtoHours, "soon"],
      [BACKUP_KEYS.rehearsalIntervalDays, "6"],
      [BACKUP_KEYS.pitr, "yes"],
      [BACKUP_KEYS.storageProcedure, "sometimes"],
      [BACKUP_KEYS.lastRehearsalResult, "ok"],
      [BACKUP_KEYS.lastRehearsalDate, "2026-02-30"],
      [BACKUP_KEYS.lastRehearsalDate, "30/10/2026"],
      [BACKUP_KEYS.lastRehearsalDate, "2027-01-01"],
      [BACKUP_KEYS.owner, "x"],
      ["backup.unknown", "1"],
    ] as const) expect(validateBackupSetting(k, v, NOW).ok, `${k}=${v}`).toBe(false);
  });
  it("is the validator the configuration pipeline uses for backup keys, and leaves other keys alone", () => {
    expect(validateSettingValue(BACKUP_KEYS.rpoHours, "99999").ok).toBe(false);
    expect(validateSettingValue(BACKUP_KEYS.rpoHours, "24").ok).toBe(true);
    expect(validateSettingValue(BACKUP_KEYS.lastRehearsalDate, "never").ok).toBe(true);
    expect(validateSettingValue("security.session_hours", "12").ok).toBe(true);
    expect(isBackupKey("backup.owner")).toBe(true);
    expect(isBackupKey("security.owner")).toBe(false);
  });
  it("every seeded row is valid and starts undeclared, so nothing is claimed that nobody stated", () => {
    expect(BACKUP_SETTING_SEEDS.length).toBe(Object.keys(BACKUP_KEYS).length);
    expect(new Set(BACKUP_SETTING_SEEDS.map((s) => s.key))).toEqual(new Set(Object.values(BACKUP_KEYS)));
    for (const s of BACKUP_SETTING_SEEDS) {
      expect(s.value).toBe(NOT_SET);
      expect(validateSettingValue(s.key, s.value).ok, s.key).toBe(true);
    }
  });
});

describe("reading what was declared", () => {
  it("maps settings to typed values and treats not_set, blanks and garbage as undeclared", () => {
    const m = new Map<string, string>([
      [BACKUP_KEYS.rpoHours, "24"],
      [BACKUP_KEYS.rtoHours, NOT_SET],
      [BACKUP_KEYS.retentionDays, "abc"],
      [BACKUP_KEYS.pitr, "on"],
      [BACKUP_KEYS.storageProcedure, "weird"],
      [BACKUP_KEYS.lastRehearsalDate, "2026-02-30"],
      [BACKUP_KEYS.owner, "  "],
    ]);
    expect(readDeclared(m)).toMatchObject({ rpoHours: 24, rtoHours: null, retentionDays: null, pitr: true, storageProcedure: null, lastRehearsalDate: null, rehearsedNever: false, owner: null });
    expect(readDeclared(new Map([[BACKUP_KEYS.lastRehearsalDate, "never"]]))).toMatchObject({ rehearsedNever: true, lastRehearsalDate: null });
    expect(readDeclared({ [BACKUP_KEYS.pitr]: "off" }).pitr).toBe(false);
  });
});

describe("assessment", () => {
  it("nothing declared is 'undeclared', not 'ok'", () => {
    const a = assessBackupPolicy(readDeclared(new Map(BACKUP_SETTING_SEEDS.map((s) => [s.key, s.value]))), NOW);
    expect(a.status).toBe("undeclared");
    expect(a.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["rpo_not_declared", "rto_not_declared", "owner_not_declared"]));
  });
  it("a complete, recent, passing, consistent policy is 'declared' with no findings, and still not verified", () => {
    const a = assessBackupPolicy(full, NOW);
    expect(a).toMatchObject({ status: "declared", findings: [], rehearsalDue: false, rehearsalAgeDays: 29, disclosure: DISCLOSURE });
    expect(DISCLOSURE).toMatch(/cannot see whether a backup exists/);
    expect(DISCLOSURE).toMatch(/Only a restore rehearsal proves/);
    expect(a.status).not.toBe("verified" as never);
  });
  it("never having rehearsed a restore is a high finding and needs attention", () => {
    for (const d of [{ ...full, lastRehearsalDate: null, rehearsedNever: true, lastRehearsalResult: null }, { ...full, lastRehearsalResult: "not_run" as const, lastRehearsalDate: null }]) {
      const a = assessBackupPolicy(d, NOW);
      expect(a.status).toBe("attention");
      expect(a.rehearsalDue).toBe(true);
      expect(a.findings.find((f) => f.code === "restore_never_rehearsed")?.severity).toBe("high");
    }
  });
  it("a failed rehearsal needs attention however recent", () => {
    const a = assessBackupPolicy({ ...full, lastRehearsalResult: "failed" }, NOW);
    expect(a.status).toBe("attention");
    expect(codes({ ...full, lastRehearsalResult: "failed" })).toContain("last_rehearsal_failed");
  });
  it("an old rehearsal is overdue against the declared interval, or 90 days when unset", () => {
    expect(codes({ ...full, lastRehearsalDate: "2026-06-01" })).toContain("rehearsal_overdue");
    expect(codes({ ...full, lastRehearsalDate: "2026-06-01", rehearsalIntervalDays: 365 })).not.toContain("rehearsal_overdue");
    expect(codes({ ...full, lastRehearsalDate: "2026-07-01", rehearsalIntervalDays: null })).toContain("rehearsal_overdue"); // 121 days
    expect(codes({ ...full, lastRehearsalDate: "2026-09-15", rehearsalIntervalDays: null })).not.toContain("rehearsal_overdue");
    const a = assessBackupPolicy({ ...full, lastRehearsalDate: "2026-06-01" }, NOW);
    expect(a.rehearsalDue).toBe(true);
    expect(a.status).toBe("attention");
  });
  it("a passed rehearsal with no date is not accepted as evidence", () => {
    const a = assessBackupPolicy({ ...full, lastRehearsalDate: null, rehearsedNever: false }, NOW);
    expect(a.findings.map((f) => f.code)).toContain("rehearsal_date_not_declared");
    expect(a.status).not.toBe("declared");
  });
  it("uploaded files with no procedure is a high finding", () => {
    expect(assessBackupPolicy({ ...full, storageProcedure: "none" }, NOW)).toMatchObject({ status: "attention" });
    expect(codes({ ...full, storageProcedure: "none" })).toContain("files_not_covered");
  });
  it("an acceptable data loss under 24 hours with point in time recovery off cannot be met", () => {
    expect(codes({ ...full, rpoHours: 4, pitr: false })).toContain("rpo_needs_pitr");
    expect(codes({ ...full, rpoHours: 4, pitr: true })).not.toContain("rpo_needs_pitr");
    expect(codes({ ...full, rpoHours: 24, pitr: false })).not.toContain("rpo_needs_pitr");
    expect(codes({ ...full, rpoHours: 4, pitr: null })).not.toContain("rpo_needs_pitr"); // undeclared is reported as missing, not guessed
  });
  it("very short retention is flagged, and missing fields make the policy 'incomplete' rather than ok", () => {
    expect(codes({ ...full, retentionDays: 3 })).toContain("short_retention");
    const a = assessBackupPolicy({ ...full, owner: null }, NOW);
    expect(a.status).toBe("incomplete");
    expect(a.findings.map((f) => f.code)).toEqual(["owner_not_declared"]);
  });
  it("findings carry only the codes, severities and plain messages, with no hidden state", () => {
    for (const f of assessBackupPolicy({ ...full, storageProcedure: "none", lastRehearsalResult: "failed" }, NOW).findings) {
      expect(["high", "medium", "info"]).toContain(f.severity);
      expect(f.message.length).toBeGreaterThan(10);
    }
  });
});
