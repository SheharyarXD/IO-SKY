/**
 * IO SKY — Portal Error Boundary
 *
 * Specialized error boundary for portal routes (/admin, /client-portal, /developer-workspace).
 *
 * Behaviour by error type:
 *   • removeChild / NotFoundError  — React 18 concurrent-rendering race condition caused
 *     by a Radix portal mounting during a state transition. Auto-reloads once silently;
 *     the page always works correctly after reload.
 *   • All other errors             — Shows a user-facing error screen with retry / home
 *     buttons and logs details for debugging.
 *
 * Auto-reload guard: a sessionStorage flag prevents infinite reload loops. If the page
 * crashes again after the first auto-reload, the error screen is shown instead.
 */

import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { debugLog } from "@/lib/debugLog";

const AUTO_RELOAD_FLAG = "iosky_portal_auto_reloaded";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

class PortalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Omit<State, "errorInfo"> {
    debugLog.log("portal_error_caught", {
      message: error.message,
      name: error.name,
      stack: error.stack?.split("\n").slice(0, 5).join("\n"),
    });

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isRemoveChildError =
      error.message.includes("removeChild") ||
      error.name === "NotFoundError" ||
      error.message.includes("not a child of this node");

    debugLog.log("portal_error_details", {
      componentStack: errorInfo.componentStack?.split("\n").slice(0, 3).join("\n"),
      errorMessage: error.message,
      isRemoveChildError,
    });

    this.setState({ errorInfo: errorInfo.componentStack ?? null });

    console.error("[PortalErrorBoundary] Caught error:", error);
    console.error("[PortalErrorBoundary] Component stack:", errorInfo.componentStack);

    if (isRemoveChildError) {
      // Check if we already auto-reloaded once to prevent infinite loops.
      const alreadyReloaded = sessionStorage.getItem(AUTO_RELOAD_FLAG) === "1";
      if (!alreadyReloaded) {
        debugLog.log("portal_error_auto_reload", { url: window.location.href });
        sessionStorage.setItem(AUTO_RELOAD_FLAG, "1");
        // Small delay so the error boundary state is committed before reload.
        setTimeout(() => window.location.reload(), 50);
        return;
      }
      // Second crash after reload — fall through to show error screen.
      debugLog.log("portal_error_auto_reload_skipped_already_reloaded");
    }

    // Clear the flag for non-removeChild errors so future removeChild errors
    // can still trigger the auto-reload.
    if (!isRemoveChildError) {
      sessionStorage.removeItem(AUTO_RELOAD_FLAG);
    }
  }

  handleReload = () => {
    debugLog.log("portal_error_reload_clicked");
    sessionStorage.removeItem(AUTO_RELOAD_FLAG);
    window.location.reload();
  };

  handleReturnHome = () => {
    debugLog.log("portal_error_return_home_clicked");
    sessionStorage.removeItem(AUTO_RELOAD_FLAG);
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isRemoveChildError =
        this.state.error?.message.includes("removeChild") ||
        this.state.error?.name === "NotFoundError" ||
        this.state.error?.message.includes("not a child of this node");

      // If it's a removeChild error and we haven't reloaded yet,
      // show a brief "loading" state while the auto-reload fires.
      const alreadyReloaded = sessionStorage.getItem(AUTO_RELOAD_FLAG) === "1";
      if (isRemoveChildError && !alreadyReloaded) {
        // Auto-reload is in progress — show a transparent loading screen.
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#0B1020]">
            <div className="flex flex-col items-center gap-4 text-white/60">
              <div className="w-5 h-5 border-2 border-white/20 border-t-[#FF7A00] rounded-full animate-spin" />
              <span className="text-sm font-mono">Loading portal…</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle size={48} className="text-destructive mb-6 flex-shrink-0" />

            <h2 className="text-xl font-semibold mb-2">
              {isRemoveChildError ? "Portal Loading Issue" : "An unexpected error occurred"}
            </h2>

            <p className="text-sm text-muted-foreground mb-6 text-center">
              {isRemoveChildError
                ? "We encountered a loading issue. Please try again — it usually resolves immediately."
                : "Something went wrong while rendering this page."}
            </p>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6 max-h-48">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                {this.state.error?.message}
              </pre>
              {this.state.errorInfo && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {this.state.errorInfo}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={this.handleReload}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer transition-opacity"
                )}
              >
                <RotateCcw size={16} />
                Try Again
              </button>

              <button
                onClick={this.handleReturnHome}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-secondary text-secondary-foreground",
                  "hover:opacity-90 cursor-pointer transition-opacity"
                )}
              >
                Return Home
              </button>
            </div>

            {debugLog.isEnabled() && (
              <div className="mt-8 p-4 w-full rounded bg-muted/50 border border-muted-foreground/20">
                <p className="text-xs text-muted-foreground mb-2">
                  Debug Mode: Logs are being collected. Open browser console and run:
                </p>
                <code className="text-xs bg-background p-2 rounded block overflow-auto">
                  window.ioSkyDebug.export()
                </code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PortalErrorBoundary;
