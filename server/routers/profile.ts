/**
 * Profile — the self-service surface every authenticated role shares.
 *
 * Deliberately role-neutral. The client asked for profile completion,
 * including a profile photo, across Client, Developer, Technical Operator,
 * Admin and Super Admin, and a photo is the same operation for all five: a
 * person changes their own picture. Putting it behind `protectedProcedure`
 * rather than duplicating it into the client, developer, admin and ops
 * routers means there is one validation path and one audit path rather than
 * five that can drift.
 *
 * Every procedure here acts on the CALLER's own row. None of them take a
 * user id, so there is no path by which one person edits another's profile,
 * privileged role or not.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  appendLoginAudit,
  getUserById,
  updateUserAvatarKey,
  updateUserDisplayName,
} from "../db";
import { getRequestMeta } from "../_core/requestMeta";
import { storageDelete, storageGetSignedUrl, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

/** 2 MiB, matching the bucket's own file_size_limit in 0020_user_avatars.sql. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * The image types a browser will reliably render in an <img> and that we can
 * identify from their leading bytes. Deliberately excludes SVG: an SVG is a
 * document that can carry script, and serving one from our own origin would
 * hand every uploader a stored-XSS primitive.
 */
const ALLOWED_AVATAR_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type AllowedAvatarType = keyof typeof ALLOWED_AVATAR_TYPES;

/**
 * Identify the real format from the leading bytes.
 *
 * The declared content type is caller-controlled and therefore not evidence
 * of anything. Checking the magic bytes is what stops an HTML or SVG payload
 * arriving labelled "image/png". Returns null when the bytes match none of
 * the allowed formats.
 */
export function sniffImageType(bytes: Buffer): AllowedAvatarType | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Decode a base64 data payload with a hard ceiling applied BEFORE decoding.
 *
 * Base64 inflates by 4/3, so checking the decoded length alone would still
 * mean allocating an arbitrarily large buffer first. The encoded-length check
 * bounds the allocation itself.
 */
export function decodeBoundedBase64(encoded: string): Buffer {
  const maxEncoded = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 4;
  if (encoded.length > maxEncoded) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Profile photo must be 2 MB or smaller.",
    });
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Profile photo must be 2 MB or smaller.",
    });
  }
  if (bytes.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Profile photo is empty.",
    });
  }
  return bytes;
}

export const profileRouter = router({
  /**
   * The caller's own profile, including a short-lived signed URL for the
   * photo. The URL is minted per request rather than stored because the
   * avatars bucket is private, so any persisted URL would expire.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    const avatarKey = user?.avatarKey ?? null;

    let avatarUrl: string | null = null;
    if (avatarKey) {
      try {
        avatarUrl = await storageGetSignedUrl("avatars", avatarKey, 3600);
      } catch (err) {
        // A missing or unreachable object must not blank the whole profile —
        // the rest of the page is still correct and useful without a picture.
        console.warn("[Profile] Could not sign avatar URL:", err);
      }
    }

    return {
      id: ctx.user.id,
      name: user?.name ?? ctx.user.name ?? null,
      email: user?.email ?? ctx.user.email ?? null,
      phone: user?.phone ?? null,
      role: ctx.user.role,
      mfaMethod: user?.mfaMethod ?? "none",
      avatarUrl,
      avatarUpdatedAt: user?.avatarUpdatedAt ?? null,
    };
  }),

  /** Change the caller's own display name. */
  updateDisplayName: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserDisplayName(ctx.user.id, input.name);
      return { ok: true as const, name: input.name };
    }),

  /**
   * Replace the caller's profile photo.
   *
   * The image arrives base64-encoded through tRPC rather than as multipart:
   * every other write in this app goes through the same typed JSON pipeline,
   * and a 2 MB ceiling keeps that practical. The trade-off is the 4/3
   * encoding overhead, which `decodeBoundedBase64` accounts for.
   */
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        /** Base64 WITHOUT a data: URI prefix — the client strips it. */
        data: z.string().min(1),
        contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = decodeBoundedBase64(input.data);

      // The declared type is caller-controlled, so the bytes decide. A
      // mismatch is rejected rather than silently corrected: it means the
      // upload is not what it claims to be.
      const sniffed = sniffImageType(bytes);
      if (sniffed === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Profile photo must be a PNG, JPEG or WebP image.",
        });
      }
      if (sniffed !== input.contentType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Profile photo content does not match its declared type.",
        });
      }

      const extension = ALLOWED_AVATAR_TYPES[sniffed];
      const existing = (await getUserById(ctx.user.id))?.avatarKey ?? null;

      // `storagePut` appends a random suffix, so the new object never
      // collides with the old one and a concurrent read of the old key keeps
      // working until the row is repointed.
      const { key } = await storagePut(
        "avatars",
        `${ctx.user.id}/avatar.${extension}`,
        bytes,
        sniffed,
      );

      await updateUserAvatarKey(ctx.user.id, key);

      // Delete the previous object only after the row points at the new one.
      // The other order would leave a user with no photo if the update failed.
      if (existing && existing !== key) {
        try {
          await storageDelete("avatars", existing);
        } catch (err) {
          // An orphaned object costs storage, not correctness.
          console.warn("[Profile] Could not delete replaced avatar:", err);
        }
      }

      await appendLoginAudit({
        userId: ctx.user.id,
        provider: "credentials",
        outcome: "redirect",
        reason: "profile_avatar_updated",
        ...getRequestMeta(ctx.req),
      });

      const avatarUrl = await storageGetSignedUrl("avatars", key, 3600);
      return { ok: true as const, avatarUrl };
    }),

  /** Remove the caller's profile photo. */
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = (await getUserById(ctx.user.id))?.avatarKey ?? null;
    await updateUserAvatarKey(ctx.user.id, null);

    if (existing) {
      try {
        await storageDelete("avatars", existing);
      } catch (err) {
        console.warn("[Profile] Could not delete removed avatar:", err);
      }
    }

    await appendLoginAudit({
      userId: ctx.user.id,
      provider: "credentials",
      outcome: "redirect",
      reason: "profile_avatar_removed",
      ...getRequestMeta(ctx.req),
    });

    return { ok: true as const };
  }),
});
