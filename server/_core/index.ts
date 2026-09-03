import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerMfaChallengeRoutes } from "./mfaChallengeRoute";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuthRoute";
import { registerSupabaseAuthRoutes } from "./supabaseAuthRoute";
import { registerStorageProxy } from "./storageProxy";
import { registerViewAsRoutes } from "./viewAsRoute";
import { registerStagingGate } from "./stagingGate";
import { registerSecurityHeaders } from "./securityHeaders";
import { registerCorsPolicy } from "./corsPolicy";
import { registerHealthRoutes } from "./healthRoute";
import { registerResendWebhookRoutes } from "./resendWebhookRoute";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./staticServer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Milestone 3 §3.3 — API hardening. Registered before any route so the
  // headers and the CORS decision apply to every response, including the
  // static-file and Vite paths further down.
  //
  // `trust proxy` is what makes req.protocol / X-Forwarded-Proto honest
  // behind a TLS-terminating proxy. Without it, isSecureRequest() in
  // cookies.ts reads plain HTTP behind a load balancer and downgrades the
  // session cookie's Secure flag. Opt-in via TRUST_PROXY because trusting
  // the header when NOT behind a proxy lets a client spoof it.
  if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }
  registerSecurityHeaders(app);
  registerCorsPolicy(app);

  // Milestone 3 §3.3 — reject malformed request URLs cleanly.
  //
  // Found by the RM-102 E2E run: `client/index.html` renders the analytics
  // beacon as `src="%VITE_ANALYTICS_ENDPOINT%/umami"`. When that variable is
  // not configured, Vite leaves the placeholder literal, the browser requests
  // `/%VITE_ANALYTICS_ENDPOINT%/umami`, and Express's router throws a
  // URIError out of decodeURIComponent while matching the path — on every
  // single page load. It surfaced as a stack trace per request.
  //
  // Any client can trigger the same thing with a stray `%` in a URL, so this
  // is not only about the beacon: an un-decodable path is a malformed request
  // and belongs in the 400 family, not an unhandled exception.
  app.use((req, res, next) => {
    try {
      decodeURIComponent(req.path);
      next();
    } catch {
      res.status(400).type("text/plain").send("Bad Request: malformed URL");
    }
  });
  // Configure body parser with larger size limit for file uploads.
  // `verify` stashes the raw bytes alongside the parsed body — needed by
  // server/_core/resendWebhookRoute.ts (Milestone 2 §2.3) to check the
  // Svix/Resend webhook signature, which is computed over the exact raw
  // payload bytes, not a re-serialization of the parsed JSON.
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // RM-76: health endpoints go BEFORE the staging gate, so an uptime monitor
  // or load balancer can probe them without holding the staging password. They
  // expose no data beyond liveness, readiness and the build commit.
  registerHealthRoutes(app);

  // Private staging / pre-launch gate (no-op unless STAGING_MODE=on).
  registerStagingGate(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerLocalAuthRoutes(app);
  registerSupabaseAuthRoutes(app);
  registerMfaChallengeRoutes(app);
  registerViewAsRoutes(app);
  registerResendWebhookRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Development uses Vite middleware; production serves the built client.
  //
  // The Vite branch is a DYNAMIC import on purpose. ./vite.ts imports 'vite'
  // and 'vite.config' at module scope, and 'vite' is a devDependency that
  // `pnpm prune --prod` strips from the production image. A static import
  // here - even one guarded by this if - is resolved at load time, and that
  // made the container crash-loop on ERR_MODULE_NOT_FOUND. Dynamic keeps it
  // unresolved unless the branch actually runs.
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const isProduction = process.env.NODE_ENV === "production";

  // Milestone 3 §3.2 (RM-75): in production, bind EXACTLY the requested port.
  //
  // The development behaviour below scans upward for a free port, which is a
  // convenience locally and a silent outage in production. Every managed host
  // — Railway, Fly, Render, Cloud Run — injects PORT and routes traffic to
  // precisely that number. If the process quietly binds PORT+1 instead, the
  // platform's proxy reaches nothing: the container is "running", health
  // checks fail, and the logs cheerfully report a successful start on a port
  // no one is talking to.
  //
  // Failing loudly is strictly better: the deploy stops with a real reason
  // rather than coming up unreachable.
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[Startup] Port ${port} is already in use. In production the port is assigned by the ` +
          `host and must be bound exactly — refusing to fall back to another port, which would ` +
          `leave the service unreachable behind the platform's proxy.`,
      );
      process.exit(1);
    }
    throw err;
  });

  // Bind 0.0.0.0 explicitly rather than relying on the default. A container
  // that listens only on localhost is invisible to the host's network.
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
  });
}

startServer().catch(console.error);
