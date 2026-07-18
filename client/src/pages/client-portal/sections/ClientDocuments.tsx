/*
 * IO SKY — Client Portal · Documents
 *
 * Three flows:
 *   • Upload: client picks a file (≤ 15 MB), we read it as base64 and call
 *             trpc.clientPortal.uploadDocument; the server writes to S3 and
 *             logs an audit + sends a notification to the IO SKY team.
 *   • Open  : trpc.clientPortal.requestDocumentSignedUrl returns a 10-min
 *             signed URL we open in a new tab. Every download is audited.
 *   • Delete: trpc.clientPortal.requestDocumentDeletion. The server only
 *             accepts deletions for files the *current* client uploaded —
 *             IO-SKY-issued contracts must go through Support.
 */
import { useMemo, useRef, useState } from "react";
import { Download, FolderLock, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "../components/PortalUI";

type Doc = {
  id: number;
  organizationId: number;
  name: string;
  category: string;
  fileKey: string;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedByUserId: number | null;
  uploadedBy: string | null;
  createdAt: Date | string;
};

type UploadCategory = "general" | "contract" | "deliverable" | "design" | "data";

const CATEGORIES: Array<{ value: UploadCategory; label: string }> = [
  { value: "general", label: "General" },
  { value: "contract", label: "Contract" },
  { value: "deliverable", label: "Deliverable" },
  { value: "design", label: "Design" },
  { value: "data", label: "Data" },
];

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader returns "data:<mime>;base64,<payload>"; strip the prefix.
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ClientDocuments() {
  const documents = trpc.clientPortal.documents.useQuery();
  const utils = trpc.useUtils();
  const auth = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<UploadCategory>("general");

  const list = (documents.data ?? []) as Doc[];

  const upload = trpc.clientPortal.uploadDocument.useMutation({
    onSuccess: async () => {
      await utils.clientPortal.documents.invalidate();
      toast.success("Document uploaded", {
        description: "Your IO SKY operating partner has been notified.",
      });
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: error => {
      toast.error("Upload failed", {
        description: error.message ?? "Please try again.",
      });
    },
  });

  const openDoc = trpc.clientPortal.requestDocumentSignedUrl.useMutation({
    onSuccess: res => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: error => {
      toast.error("Couldn't open document", {
        description: error.message ?? "Please try again.",
      });
    },
  });

  const removeDoc = trpc.clientPortal.requestDocumentDeletion.useMutation({
    onSuccess: async () => {
      await utils.clientPortal.documents.invalidate();
      toast.success("Document removed");
    },
    onError: error => {
      toast.error("Couldn't remove document", {
        description: error.message ?? "Please try again.",
      });
    },
  });

  const isOpenPending = (id: number) =>
    openDoc.isPending && openDoc.variables?.id === id;
  const isRemovePending = (id: number) =>
    removeDoc.isPending && removeDoc.variables?.id === id;

  const userId = auth.user?.id ?? null;

  const handleSelected = (file: File | null) => {
    if (!file) {
      setPendingFile(null);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Vault uploads are limited to 15 MB per file.",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPendingFile(file);
  };

  const submitUpload = async () => {
    if (!pendingFile) return;
    try {
      const base64 = await readAsBase64(pendingFile);
      upload.mutate({
        name: pendingFile.name,
        category,
        mimeType: pendingFile.type || undefined,
        contentBase64: base64,
      });
    } catch (err) {
      toast.error("Couldn't read file", {
        description: (err as Error)?.message ?? "Please try a different file.",
      });
    }
  };

  const grouped = useMemo(() => {
    const order = ["contract", "deliverable", "design", "data", "general"];
    const map: Record<string, Doc[]> = {};
    for (const d of list) (map[d.category] ??= []).push(d);
    return order
      .filter(k => map[k]?.length)
      .map(k => [k, map[k]] as const)
      .concat(
        Object.entries(map)
          .filter(([k]) => !order.includes(k))
          .map(([k, v]) => [k, v] as const),
      );
  }, [list]);

  return (
    <>
      <SectionHeader
        eyebrow="Documents"
        title="Secure document vault"
        description="Contracts, NDAs, deliverables and architecture artefacts shared between you and IO SKY. All access events are logged."
        action={
          <Button
            className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload file
          </Button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={e => handleSelected(e.target.files?.[0] ?? null)}
      />

      {pendingFile && (
        <GlassCard className="p-5 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {pendingFile.name}
              </p>
              <p className="text-[11px] text-white/55 mt-0.5">
                {fmtSize(pendingFile.size)} · {pendingFile.type || "file"}
              </p>
            </div>
            <Select
              value={category}
              onValueChange={v => setCategory(v as UploadCategory)}
            >
              <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/10 text-white/85">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b1422] border-white/10 text-white">
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="text-white/55 hover:text-white"
              onClick={() => {
                setPendingFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={upload.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
              onClick={submitUpload}
              disabled={upload.isPending}
            >
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </GlassCard>
      )}

      <SectionStateSwitch
        loading={documents.isLoading}
        error={documents.error}
        onRetry={() => documents.refetch()}
        data={list}
        isEmpty={d => d.length === 0}
        emptyIcon={<FolderLock className="h-5 w-5" />}
        emptyTitle="No documents yet"
        emptyBody="Once IO SKY uploads documents for your organization they will appear here, encrypted at rest."
        emptyAction={
          <Button
            className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload your first file
          </Button>
        }
        skeletonRows={5}
      />

      {!documents.isLoading && !documents.error && list.length > 0 && (
        <div className="space-y-7">
          {grouped.map(([cat, docs]) => (
            <section key={cat}>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-2">
                {cat}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {docs.map(d => {
                  const ownedByMe = d.uploadedByUserId === userId;
                  return (
                    <GlassCard key={d.id} className="p-5" interactive>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
                          <FolderLock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">
                            {d.name}
                          </p>
                          <p className="text-[11px] text-white/45 mt-0.5 capitalize">
                            {d.category}
                          </p>
                          {d.uploadedBy && (
                            <p className="text-[12px] text-white/55 mt-2 line-clamp-2">
                              Uploaded by {d.uploadedBy}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-white/35 uppercase tracking-wider">
                              {fmtSize(d.sizeBytes)} ·{" "}
                              {d.mimeType ? d.mimeType.split("/").pop() : "file"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isOpenPending(d.id)}
                                onClick={() => openDoc.mutate({ id: d.id })}
                                className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                              >
                                {isOpenPending(d.id) ? (
                                  "Opening…"
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Open
                                  </>
                                )}
                              </Button>
                              {ownedByMe && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isRemovePending(d.id)}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Remove "${d.name}" from the vault? This action is logged.`,
                                      )
                                    ) {
                                      removeDoc.mutate({ id: d.id });
                                    }
                                  }}
                                  className="text-white/55 hover:text-rose-200 hover:bg-rose-500/10"
                                  title="Remove document"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
