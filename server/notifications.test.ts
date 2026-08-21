/*
 * IO SKY — Milestone 2 §2.7 central typed notification write service
 * (server/notifications.ts). Locks in: the in-app DB row is always
 * written regardless of channel, the email bridge only fires for
 * "in_app_and_email", it reuses the exact §2.3 Resend transport
 * (dispatchSimpleEmail) rather than a new send path, and an email-bridge
 * failure never propagates (the in-app notification must still exist).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendClientNotificationMock,
  appendDeveloperNotificationMock,
  listOrganizationMemberEmailsMock,
  getDeveloperEmailMock,
  dispatchSimpleEmailMock,
} = vi.hoisted(() => ({
  appendClientNotificationMock: vi.fn(async () => ({ id: 1 })),
  appendDeveloperNotificationMock: vi.fn(async () => ({ id: 1 })),
  listOrganizationMemberEmailsMock: vi.fn(async () => [] as string[]),
  getDeveloperEmailMock: vi.fn(async () => null as string | null),
  dispatchSimpleEmailMock: vi.fn(async () => ({ ok: true, transport: "console" as const })),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    appendClientNotification: appendClientNotificationMock,
    appendDeveloperNotification: appendDeveloperNotificationMock,
    listOrganizationMemberEmails: listOrganizationMemberEmailsMock,
    getDeveloperEmail: getDeveloperEmailMock,
  };
});

vi.mock("./email", () => ({
  dispatchSimpleEmail: dispatchSimpleEmailMock,
}));

import { notifyClient, notifyDeveloper } from "./notifications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyClient", () => {
  it("writes the in-app row with channel: in_app by default and never calls the email bridge", async () => {
    await notifyClient({ organizationId: 7, kind: "document", title: "Doc approved" });
    expect(appendClientNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 7, channel: "in_app", templateKey: null }),
    );
    expect(dispatchSimpleEmailMock).not.toHaveBeenCalled();
  });

  it("bridges to email for every org member when channel is in_app_and_email", async () => {
    listOrganizationMemberEmailsMock.mockResolvedValueOnce(["a@example.com", "b@example.com"]);
    await notifyClient({
      organizationId: 7,
      kind: "document",
      title: "Doc approved",
      body: "Your document was approved.",
      channel: "in_app_and_email",
    });
    expect(appendClientNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "in_app_and_email", templateKey: "notification-generic" }),
    );
    expect(dispatchSimpleEmailMock).toHaveBeenCalledTimes(2);
    expect(dispatchSimpleEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@example.com", subject: "Doc approved", messageType: "notification" }),
    );
  });

  it("still writes the in-app row even if the email bridge throws", async () => {
    listOrganizationMemberEmailsMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyClient({ organizationId: 7, kind: "document", title: "X", channel: "in_app_and_email" }),
    ).resolves.toBeUndefined();
    expect(appendClientNotificationMock).toHaveBeenCalledTimes(1);
  });
});

describe("notifyDeveloper", () => {
  it("writes the in-app row and never calls the email bridge by default", async () => {
    await notifyDeveloper({ developerId: 4, kind: "task", title: "New task assigned" });
    expect(appendDeveloperNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ developerId: 4, channel: "in_app", templateKey: null }),
    );
    expect(dispatchSimpleEmailMock).not.toHaveBeenCalled();
  });

  it("bridges to email when channel is in_app_and_email and the developer has an email on file", async () => {
    getDeveloperEmailMock.mockResolvedValueOnce("dev@example.com");
    await notifyDeveloper({
      developerId: 4,
      kind: "task",
      title: "New task assigned",
      channel: "in_app_and_email",
    });
    expect(dispatchSimpleEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dev@example.com", messageType: "notification" }),
    );
  });

  it("skips the email bridge silently when the developer has no email on file", async () => {
    getDeveloperEmailMock.mockResolvedValueOnce(null);
    await notifyDeveloper({ developerId: 4, kind: "task", title: "X", channel: "in_app_and_email" });
    expect(dispatchSimpleEmailMock).not.toHaveBeenCalled();
  });
});
