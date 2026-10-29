/*
 * P0-03 / J11: clientVisibleDocumentTypes is the allow-list behind every client
 * document list, search and download (SRS 18.8, GOV-08). Whatever goes wrong
 * reading the matrix, it must return null (nothing typed visible), never an
 * empty "hide nothing" set.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/connection", () => ({ getDb: m.getDb }));

import { clientVisibleDocumentTypes } from "./db/platformGovernance";

const dbReturning = (rows: unknown[]) => ({ select: () => ({ from: async () => rows }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("clientVisibleDocumentTypes", () => {
  it("returns null when there is no database", async () => {
    m.getDb.mockResolvedValueOnce(null);
    expect(await clientVisibleDocumentTypes()).toBeNull();
  });

  it("returns null when the matrix query throws", async () => {
    m.getDb.mockResolvedValueOnce({ select: () => ({ from: async () => { throw new Error("relation does not exist"); } }) });
    expect(await clientVisibleDocumentTypes()).toBeNull();
  });

  it("returns null when opening the connection throws", async () => {
    m.getDb.mockRejectedValueOnce(new Error("pool exhausted"));
    expect(await clientVisibleDocumentTypes()).toBeNull();
  });

  it("returns only the types opened to clients", async () => {
    m.getDb.mockResolvedValueOnce(
      dbReturning([
        { documentType: "proposal", authorizedRoles: '["admin","client"]', clientVisible: true },
        { documentType: "internal_note", authorizedRoles: '["admin"]', clientVisible: false },
        { documentType: "contract", authorizedRoles: '["admin","client"]', clientVisible: false },
        { documentType: "dev_spec", authorizedRoles: '["developer"]', clientVisible: true },
      ]),
    );
    expect([...(await clientVisibleDocumentTypes())!]).toEqual(["proposal"]);
  });

  it("returns an empty allow-list for an unseeded matrix, so no typed document is shown", async () => {
    m.getDb.mockResolvedValueOnce(dbReturning([]));
    const set = await clientVisibleDocumentTypes();
    expect(set).not.toBeNull();
    expect(set!.size).toBe(0);
  });
});
