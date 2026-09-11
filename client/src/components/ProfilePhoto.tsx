/*
 * Profile photo — one component for every role.
 *
 * Client, Developer, Technical Operator, Admin and Super Admin all share the
 * same `profile.*` procedures, so they share this control rather than each
 * portal growing its own. That matters beyond tidiness: the file-size and
 * file-type guidance shown to the user has to match what the server actually
 * enforces, and five copies of that text drift apart.
 *
 * The server re-validates everything checked here — the checks below exist to
 * give immediate feedback, not to be the boundary.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/** Mirrors MAX_AVATAR_BYTES and ALLOWED_AVATAR_TYPES in server/routers/profile.ts. */
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;

type Accepted = (typeof ACCEPTED)[number];

function isAccepted(type: string): type is Accepted {
  return (ACCEPTED as readonly string[]).includes(type);
}

/** Strip the `data:image/png;base64,` prefix the server does not want. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfilePhoto(props: { className?: string }) {
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = trpc.profile.uploadAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Profile photo updated");
      await utils.profile.get.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not upload the photo"),
    onSettled: () => setBusy(false),
  });

  const remove = trpc.profile.removeAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Profile photo removed");
      await utils.profile.get.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not remove the photo"),
    onSettled: () => setBusy(false),
  });

  const onPick = async (file: File | undefined) => {
    // Clear the input straight away so re-selecting the same file after a
    // rejection still fires a change event.
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;

    if (!isAccepted(file.type)) {
      toast.error("Choose a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Choose an image of 2 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const data = await toBase64(file);
      upload.mutate({ data, contentType: file.type });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Could not read the file");
    }
  };

  const avatarUrl = profile.data?.avatarUrl ?? null;
  const initials = initialsOf(profile.data?.name);
  const pending = busy || upload.isPending || remove.isPending;

  return (
    <div className={"flex flex-wrap items-center gap-4 " + (props.className ?? "")}>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04]">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile.data?.name ? `${profile.data.name} profile photo` : "Profile photo"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[18px] font-medium text-white/70">
            {initials || <User className="h-6 w-6 text-white/40" aria-hidden="true" />}
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-5 w-5 animate-spin text-white/80" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="ml-2">{avatarUrl ? "Replace photo" : "Upload photo"}</span>
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setBusy(true);
                remove.mutate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="ml-2">Remove</span>
            </Button>
          )}
        </div>
        <p className="text-[12px] text-white/50">
          PNG, JPEG or WebP, up to 2 MB. Visible to other people on the platform
          next to your name.
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </div>
  );
}

export default ProfilePhoto;
