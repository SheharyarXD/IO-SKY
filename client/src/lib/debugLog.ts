/**
 * IO SKY — Debug Logging Utility
 *
 * Temporary debug infrastructure for diagnosing the removeChild error
 * during admin login redirect. Can be toggled on/off via localStorage.
 *
 * Usage:
 *   debugLog.enable()  // Turn on debug mode
 *   debugLog.log("event", { data })
 *   debugLog.disable() // Turn off debug mode
 *   debugLog.export()  // Get all logs as JSON
 */

interface DebugLogEntry {
  timestamp: number;
  event: string;
  data?: Record<string, any>;
  source: "frontend" | "backend";
}

class DebugLogger {
  private enabled = false;
  private logs: DebugLogEntry[] = [];
  private maxLogs = 200;

  constructor() {
    // Check localStorage for debug mode
    this.enabled = localStorage.getItem("io_sky_debug_mode") === "true";
    if (this.enabled) {
      console.log("[IO SKY DEBUG] Debug mode enabled. Logs will be collected.");
    }
  }

  enable() {
    this.enabled = true;
    localStorage.setItem("io_sky_debug_mode", "true");
    console.log("[IO SKY DEBUG] Debug mode enabled");
  }

  disable() {
    this.enabled = false;
    localStorage.removeItem("io_sky_debug_mode");
    console.log("[IO SKY DEBUG] Debug mode disabled");
  }

  log(event: string, data?: Record<string, any>, source: "frontend" | "backend" = "frontend") {
    if (!this.enabled) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      event,
      data,
      source,
    };

    this.logs.push(entry);

    // Keep only the last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console for real-time visibility
    const time = new Date(entry.timestamp).toISOString();
    console.log(`[${time}] [${source}] ${event}`, data || "");
  }

  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    console.log("[IO SKY DEBUG] Logs cleared");
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const debugLog = new DebugLogger();

// Expose to window for easy access in console
if (typeof window !== "undefined") {
  (window as any).ioSkyDebug = {
    enable: () => debugLog.enable(),
    disable: () => debugLog.disable(),
    export: () => debugLog.export(),
    logs: () => debugLog.getLogs(),
    clear: () => debugLog.clear(),
    isEnabled: () => debugLog.isEnabled(),
  };
}
