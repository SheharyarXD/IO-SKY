/**
 * IO SKY — Global Error Boundary
 *
 * Catches any unhandled React render errors that escape lower-level boundaries.
 *
 * Behaviour by error type:
 *   • removeChild / NotFoundError  — React 18 concurrent-rendering race condition.
 *     Auto-reloads once silently; the page always works correctly after reload.
 *   • All other errors             — Shows a user-facing error screen with a
 *     "Reload Page" button and the full error stack for debugging.
 *
 * Auto-reload guard: a sessionStorage flag prevents infinite reload loops.
 */
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

const AUTO_RELOAD_FLAG = "iosky_global_auto_reloaded";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const isRemoveChildError =
      error.message.includes("removeChild") ||
      error.name === "NotFoundError" ||
      error.message.includes("not a child of this node");

    if (isRemoveChildError) {
      const alreadyReloaded = sessionStorage.getItem(AUTO_RELOAD_FLAG) === "1";
      if (!alreadyReloaded) {
        sessionStorage.setItem(AUTO_RELOAD_FLAG, "1");
        setTimeout(() => window.location.reload(), 50);
        return;
      }
    }

    // Clear flag for non-removeChild errors.
    if (!isRemoveChildError) {
      sessionStorage.removeItem(AUTO_RELOAD_FLAG);
    }
  }

  render() {
    if (this.state.hasError) {
      const isRemoveChildError =
        this.state.error?.message.includes("removeChild") ||
        this.state.error?.name === "NotFoundError" ||
        this.state.error?.message.includes("not a child of this node");

      const alreadyReloaded = sessionStorage.getItem(AUTO_RELOAD_FLAG) === "1";

      // Show a transparent loading screen while auto-reload fires.
      if (isRemoveChildError && !alreadyReloaded) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#0B1020]">
            <div className="flex flex-col items-center gap-4 text-white/60">
              <div className="w-5 h-5 border-2 border-white/20 border-t-[#FF7A00] rounded-full animate-spin" />
              <span className="text-sm font-mono">Loading…</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(AUTO_RELOAD_FLAG);
                window.location.reload();
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
