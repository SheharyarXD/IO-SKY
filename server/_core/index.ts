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
import { registerResendWebhookRoutes } from "./resendWebhookRoute";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
