/*
 * IO SKY — Developer Workspace · Files.
 *
 * Lists every file approved for an assigned project the developer is on.
 * Files live in object storage; the only way the UI ever surfaces a URL
 * is through `developer.requestFileSignedUrl`, which mints a short-lived
 * signed URL on the server, audits the download, and rejects access to
 * any file outside the developer's assignment scope (returns FORBIDDEN
 * and writes a high-severity security event).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "@/pages/client-portal/components/PortalUI";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2 } from "lucide-react";

function humanBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function DeveloperFiles() {
  const filesQuery = trpc.developer.listFiles.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const [pendingFileId, setPendingFileId] = useState<number | null>(null);

  const requestSignedUrl = trpc.developer.requestFileSignedUrl.useMutation({
    onSuccess: ({ url, name }) => {
      // Open the signed URL in a new tab so we never replace the workspace.
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(`Opened ${name}`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not open this file");
    },
    onSettled: () => setPendingFileId(null),
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Knowledge base"
        title="Files"
        description="Specifications, contracts and reference material released for your assignments. Every download is signed, short-lived, and audited."
      />

      <SectionStateSwitch
        loading={filesQuery.isLoading}
        error={filesQuery.error}
        onRetry={() => filesQuery.refetch()}
        data={filesQuery.data ?? []}
        isEmpty={(d) => (d?.length ?? 0) === 0}
        emptyIcon={<FileText className="h-5 w-5" />}
        emptyTitle="No files released yet"
        emptyBody="When the engineering desk publishes specs, contracts or reference material to one of your assignments, they'll show up here."
        skeletonRows={5}
      />

      {filesQuery.data && filesQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filesQuery.data.map((file) => {
            const pending = pendingFileId === file.id && requestSignedUrl.isPending;
            return (
              <GlassCard
                key={file.id}
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:gap-5 gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {file.projectCode && (
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.02] text-white/65 text-[10px] uppercase tracking-wider font-semibold"
                        >
                          {file.projectCode}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/[0.02] text-white/55 text-[10px] uppercase tracking-wider"
                      >
                        {file.category}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 text-sm md:text-base font-semibold text-white truncate">
                      {file.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-white/45">
                      <span>{humanBytes(file.sizeBytes)}</span>
                      {file.mimeType && (
                        <>
                          <span className="text-white/20">·</span>
                          <span className="truncate">{file.mimeType}</span>
                        </>
                      )}
                      <span className="text-white/20">·</span>
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="md:w-auto shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setPendingFileId(file.id);
                      requestSignedUrl.mutate({ fileId: file.id });
                    }}
                    className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-2">Open</span>
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
