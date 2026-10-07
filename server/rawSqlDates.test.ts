/*
 * Regression guard: a Date passed as a parameter inside a raw sql`` template
 * fails at runtime under postgres-js ("The string argument must be of type
 * string or an instance of Buffer"), because drizzle only maps a Date when it
 * is compared through a typed column helper such as gte() or lte().
 *
 * It was found when the compliance and history queries returned zero for data
 * that existed: the error had been swallowed. Pass an ISO string with an
 * explicit cast, or use the typed helpers.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DATE_LIKE = /^(now|since|until|week|twoDays|before|after|date|from|to|start|end|cutoff|threshold|expiresAt|dueAt)$/;

function rawSqlParams(source: string): Array<{ param: string; line: number }> {
  const out: Array<{ param: string; line: number }> = [];
  const re = /sql(?:<[^>]*>)?`([^`]*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const body = m[1];
    const pr = /\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(body))) {
      if (DATE_LIKE.test(p[1])) out.push({ param: p[1], line: source.slice(0, m.index).split("\n").length });
    }
  }
  return out;
}

describe("raw sql date parameters", () => {
  const dir = path.resolve(__dirname, "db");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));

  it("scans a meaningful number of db files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const f of files) {
    it(`${f} passes no bare date variable into a raw sql template`, () => {
      const src = fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
      expect(rawSqlParams(src), "Use ${x.toISOString()}::timestamp or a typed helper like lte(column, x)").toEqual([]);
    });
  }

  it("the detector itself flags the bad pattern", () => {
    expect(rawSqlParams("const q = sql`select 1 where a < ${now}`;")).toHaveLength(1);
    expect(rawSqlParams("const q = sql`select 1 where a < ${now.toISOString()}::timestamp`;")).toHaveLength(0);
  });
});
