# IO SKY — Complete Developer Handoff Document

**Version:** 1.0.0  
**Last Updated:** June 2026  
**Status:** Production-Ready  
**Manus Dependency:** None (fully self-hosted capable)

---

## Table of Contents

1. [Repository & Access](#1-repository--access)
2. [Frontend Stack](#2-frontend-stack)
3. [Backend Stack](#3-backend-stack)
4. [Database Architecture](#4-database-architecture)
5. [Authentication Architecture](#5-authentication-architecture)
6. [Storage Architecture](#6-storage-architecture)
7. [Environment Variables](#7-environment-variables)
8. [Deployment Architecture](#8-deployment-architecture)
9. [CI/CD Configuration](#9-cicd-configuration)
10. [Developer Onboarding Guide](#10-developer-onboarding-guide)

---

## 1. Repository & Access

### Repository Location

**Current Hosting:** Manus (managed sandbox)  
**Project Path:** `/home/ubuntu/io-sky`  
**Project Name:** `io-sky`  
**Version ID (Latest Checkpoint):** `fd851e74`

### Self-Hosting (Post-Manus)

To migrate to self-hosted infrastructure:

1. **Export the codebase:**
   ```bash
   cd /home/ubuntu/io-sky
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to your own Git repository:**
   ```bash
   git remote add origin https://github.com/YOUR_ORG/io-sky.git
   git push -u origin main
   ```

3. **Recommended Platforms:**
   - **GitHub** (recommended for enterprise)
   - **GitLab** (with built-in CI/CD)
   - **Bitbucket** (for Atlassian integration)

### Access Control

- **Admin Portal:** `/admin/bookings` (role: `admin`)
- **Client Portal:** `/client-portal` (role: `client`)
- **Developer Workspace:** `/developer-workspace` (role: `developer`)
- **Public Site:** `/` (all visitors)

---

## 2. Frontend Stack

### Core Framework

| Component | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.2.1 | UI framework |
| **Vite** | 5.x | Build tool & dev server |
| **TypeScript** | 5.9.3 | Type safety |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **Wouter** | 3.x | Client-side routing (lightweight alternative to React Router) |

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **@trpc/client** | 11.6.0 | Type-safe RPC client |
| **@tanstack/react-query** | 5.90.2 | Server state management |
| **shadcn/ui** | Latest | Accessible component library |
| **@radix-ui/** | Latest | Headless UI primitives |
| **Lucide React** | Latest | Icon library |
| **Sonner** | Latest | Toast notifications |
| **date-fns** | 4.1.0 | Date utilities |

### Build Process

```bash
# Development
pnpm dev

# Production build
pnpm build

# Preview production build locally
pnpm preview

# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint

# Formatting
pnpm format
```

### Project Structure

```
client/
├── public/              # Static assets (favicon, robots.txt only)
├── src/
│   ├── pages/          # Page-level components
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (LanguageContext, ThemeContext)
│   ├── hooks/          # Custom React hooks
│   ├── lib/
│   │   ├── trpc.ts     # tRPC client setup
│   │   ├── i18n/       # Translation dictionaries (9 languages)
│   │   └── i18n.ts     # i18n initialization
│   ├── App.tsx         # Main app + routing
│   ├── main.tsx        # React entry point
│   └── index.css       # Global styles & design tokens
└── index.html          # HTML template
```

### Styling System

- **Design Tokens:** Defined in `client/src/index.css` (CSS variables)
- **Color Palette:** Orange (#FF6A00) accent, navy-black background, restrained interactions
- **Responsive:** Mobile-first, breakpoints at 640px, 1024px, 1280px
- **Dark Mode:** Default (can extend to light mode via ThemeProvider)
- **Animations:** GPU-accelerated (transform/opacity only), <300ms duration

### Internationalization (i18n)

**Supported Languages:**
- English (en)
- Dutch (nl)
- German (de)
- French (fr)
- Spanish (es)
- Portuguese (pt)
- Arabic (ar) — RTL support
- Chinese Simplified (zh)
- Japanese (ja)

**Dictionary Location:** `client/src/lib/i18n/`  
**Usage:** `const t = useT(); t("key.path", "fallback")`  
**Storage Key:** `localStorage.iosky.lang`

---

## 3. Backend Stack

### Core Framework

| Component | Version | Purpose |
|-----------|---------|---------|
| **Express** | 4.21.2 | HTTP server |
| **Node.js** | 20+ | Runtime |
| **TypeScript** | 5.9.3 | Type safety |
| **tRPC** | 11.6.0 | Type-safe RPC layer |

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **@trpc/server** | 11.6.0 | tRPC server |
| **drizzle-orm** | 0.44.5 | ORM for database |
| **mysql2** | 3.15.0 | MySQL driver |
| **bcryptjs** | Latest | Password hashing |
| **jose** | 6.1.0 | JWT signing |
| **cookie** | 1.0.2 | Cookie parsing |
| **Resend** | Latest | Email service |
| **Twilio** | Latest | SMS/Voice service |

### Server Structure

```
server/
├── _core/
│   ├── index.ts                  # Server entry point
│   ├── context.ts                # tRPC context (auth, user)
│   ├── cookies.ts                # Session cookie handling
│   ├── oauth.ts                  # Manus OAuth flow
│   ├── localAuthRoute.ts         # Email+password login (Manus-independent)
│   ├── llm.ts                    # LLM integration
│   ├── imageGeneration.ts        # Image generation API
│   ├── voiceTranscription.ts     # Speech-to-text API
│   ├── notification.ts           # Owner notifications
│   ├── map.ts                    # Google Maps integration
│   ├── dataApi.ts                # External data APIs
│   ├── trpc.ts                   # tRPC setup
│   ├── env.ts                    # Environment validation
│   ├── heartbeat.ts              # Scheduled jobs
│   ├── systemRouter.ts           # System procedures
│   └── types/
│       └── manusTypes.ts         # Type definitions
├── db.ts                         # Database query helpers
├── routers.ts                    # tRPC procedure definitions
├── storage.ts                    # S3 file storage helpers
└── auth.logout.test.ts           # Example test file
```

### API Routes

#### Public Routes
- `GET /` — Homepage
- `GET /login` — Login page
- `POST /api/auth/local/login` — Email+password authentication
- `POST /api/auth/local/logout` — Logout
- `GET /api/oauth/callback` — OAuth callback (Manus)
- `GET /api/trpc/*` — tRPC endpoints

#### Protected Routes (Require Session)
- `/admin/*` — Admin dashboard (role: admin)
- `/client-portal` — Client portal (role: client)
- `/developer-workspace` — Developer workspace (role: developer)

### tRPC Procedures

**Procedure Types:**
- `publicProcedure` — No authentication required
- `protectedProcedure` — Requires valid session
- `adminProcedure` — Requires admin role
- `clientProcedure` — Requires client role
- `developerProcedure` — Requires developer role

**Example Procedure:**
```typescript
export const appRouter = router({
  auth: {
    me: publicProcedure.query(async ({ ctx }) => {
      return ctx.user; // null if not authenticated
    }),
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      // Clear session
      return { ok: true };
    }),
  },
});
```

### Build & Run

```bash
# Development
pnpm dev

# Production build
pnpm build

# Run production build
node dist/index.mjs

# Database migrations
pnpm db:push

# Run tests
pnpm test
```

---

## 4. Database Architecture

### Database Provider

**Type:** MySQL / TiDB (compatible)  
**Connection:** Via `DATABASE_URL` environment variable  
**ORM:** Drizzle ORM 0.44.5  
**Migrations:** Drizzle Kit (auto-generated from schema)

### Core Tables

#### `users`
Stores all user accounts (admin, client, developer, regular users).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key, auto-increment |
| `openId` | VARCHAR(64) | Unique identifier (from OAuth or local) |
| `name` | TEXT | User's full name |
| `email` | VARCHAR(320) | Email address |
| `loginMethod` | VARCHAR(64) | "oauth" or "local" |
| `passwordHash` | VARCHAR(255) | Bcrypt hash (nullable for OAuth-only users) |
| `organizationId` | INT | Multi-tenant link (nullable) |
| `phone` | VARCHAR(64) | For SMS MFA |
| `role` | ENUM | "user", "client", "developer", "admin" |
| `mfaMethod` | VARCHAR(32) | "none", "totp", "email", "sms" |
| `createdAt` | TIMESTAMP | Account creation |
| `updatedAt` | TIMESTAMP | Last update |
| `lastSignedIn` | TIMESTAMP | Last login |

#### `bookings`
Strategy call bookings from `/book-strategy`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `publicRef` | VARCHAR(32) | Public reference (for URLs) |
| `serviceId` | VARCHAR(32) | Service type identifier |
| `slotStartMs` | BIGINT | Unix timestamp (milliseconds) |
| `durationMin` | INT | Duration in minutes |
| `timezone` | VARCHAR(64) | User's timezone |
| `fullName` | VARCHAR(200) | Visitor's name |
| `email` | VARCHAR(320) | Visitor's email |
| `company` | VARCHAR(200) | Company name |
| `roleTitle` | VARCHAR(120) | Job title |
| `phone` | VARCHAR(64) | Contact phone |
| `preparation` | TEXT | Pre-call notes |
| `note` | TEXT | Additional notes |
| `utmSource` | VARCHAR(120) | UTM source |
| `utmCampaign` | VARCHAR(120) | UTM campaign |
| `status` | ENUM | "pending", "confirmed", "cancelled", "completed" |
| `emailSent` | INT | Email notification count |
| `ownerNotified` | INT | Owner notification count |
| `ip` | VARCHAR(64) | Client IP |
| `userAgent` | TEXT | Browser user agent |
| `createdAt` | TIMESTAMP | Booking creation |
| `updatedAt` | TIMESTAMP | Last update |

#### `booking_audit`
Audit log for booking lifecycle events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `bookingId` | INT | Foreign key to bookings |
| `event` | VARCHAR(64) | Event type (e.g., "created", "confirmed") |
| `detail` | TEXT | Event details |
| `createdAt` | TIMESTAMP | Event timestamp |

#### `leads`
CRM leads aggregated from all inbound channels.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `source` | VARCHAR(64) | "booking", "contact", "ai-scan", "engineering-access" |
| `email` | VARCHAR(320) | Lead email |
| `name` | VARCHAR(200) | Lead name |
| `company` | VARCHAR(200) | Company |
| `phone` | VARCHAR(64) | Phone |
| `message` | TEXT | Inquiry message |
| `status` | VARCHAR(64) | "new", "contacted", "qualified", "closed" |
| `createdAt` | TIMESTAMP | Lead creation |
| `updatedAt` | TIMESTAMP | Last update |

### Relationships

```
users (1) ──→ (many) bookings
users (1) ──→ (many) leads
bookings (1) ──→ (many) booking_audit
```

### Migrations

Migrations are auto-generated by Drizzle Kit:

```bash
# Generate migration from schema changes
pnpm db:push

# View migration history
ls drizzle/migrations/
```

### Seeding

Initial data is seeded via:

```bash
node scripts/seed-users.mjs
```

This creates:
- `admin@iosky.local` (role: admin)
- `client@iosky.local` (role: client)
- `developer@iosky.local` (role: developer)

---

## 5. Authentication Architecture

### Authentication Flow

#### Path 1: Local Email + Password (Manus-Independent)

```
User enters email + password
        ↓
POST /api/auth/local/login
        ↓
Server validates via bcrypt
        ↓
Server mints io_sky_session cookie
        ↓
User redirected to role-based destination
```

**Endpoint:** `POST /api/auth/local/login`

**Request Body:**
```json
{
  "email": "admin@iosky.local",
  "password": "IOSky-Admin-2026!"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "role": "admin",
  "next": "/admin/bookings"
}
```

**Response (Failure):**
```json
{
  "ok": false,
  "code": "invalid_credentials",
  "error": "Invalid email or password"
}
```

#### Path 2: Manus OAuth (Federated)

```
User clicks "Sign in with SSO"
        ↓
Redirects to Manus OAuth portal
        ↓
User authenticates (Google, Microsoft, Apple)
        ↓
Manus redirects to /api/oauth/callback
        ↓
Server validates token + creates/updates user
        ↓
Server mints io_sky_session cookie
        ↓
User redirected to role-based destination
```

**Note:** This path requires active Manus subscription. For self-hosted, use local auth only.

### Session Management

**Cookie Name:** `io_sky_session`  
**Cookie Duration:** 1 year (configurable)  
**Cookie Flags:** HttpOnly, Secure, SameSite=Lax  
**Session Storage:** JWT token (signed via `JWT_SECRET`)

**Logout:**
```bash
POST /api/auth/local/logout
```

Clears the `io_sky_session` cookie.

### Multi-Factor Authentication (MFA)

**Supported Methods:**
- TOTP (Time-based One-Time Password) — Google Authenticator, Authy
- Email (magic link)
- SMS (via Twilio)

**MFA Flow:**

1. User logs in with email + password
2. Server checks `users.mfaMethod`
3. If MFA enrolled, redirect to `/mfa-challenge`
4. User completes MFA challenge
5. Server mints session cookie
6. User redirected to role destination

**Enroll MFA:**
- Navigate to `/security` (authenticated)
- Choose method (TOTP, Email, SMS)
- Complete enrollment

### Role-Based Access Control (RBAC)

**Roles:**
- `admin` — Full platform access, user management, audit logs
- `client` — Client portal, booking management, document uploads
- `developer` — Developer workspace, API access, NDA acceptance
- `user` — Default, homepage access only

**Role-Based Redirects:**

| Role | Destination |
|------|-------------|
| admin | `/admin/bookings` |
| client | `/client-portal` |
| developer | `/developer-workspace` |
| user | `/` (homepage) |

**RBAC in tRPC:**

```typescript
// Admin-only procedure
export const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
```

### Password Security

- **Hashing:** Bcrypt (rounds: 10)
- **Validation:** Minimum 8 characters
- **Storage:** Never store plain-text passwords
- **Reset:** Via email magic link (not yet implemented; add as needed)

---

## 6. Storage Architecture

### File Storage Provider

**Primary:** AWS S3 (or S3-compatible, e.g., MinIO)  
**Fallback:** Local filesystem (for development)

### Upload Flow

1. **Client uploads file** → POST to `/api/trpc/storage.upload`
2. **Server validates** (size, type, permissions)
3. **Server uploads to S3** via `storagePut()`
4. **Server returns signed URL** → `/manus-storage/{key}`
5. **Client displays file** via returned URL

### Storage Helpers

**Upload:**
```typescript
import { storagePut } from "./server/storage";

const { key, url } = await storagePut(
  `users/${userId}/documents/${fileName}`,
  fileBuffer,
  "application/pdf"
);
// url = "/manus-storage/users/123/documents/contract.pdf"
```

**Download:**
```typescript
import { storageGet } from "./server/storage";

const { url } = await storageGet(`users/${userId}/documents/${fileName}`);
// Returns presigned URL (expires in 1 hour by default)
```

### S3 Configuration

**Environment Variables:**
- `AWS_ACCESS_KEY_ID` — S3 access key
- `AWS_SECRET_ACCESS_KEY` — S3 secret key
- `AWS_REGION` — S3 region (e.g., us-east-1)
- `AWS_S3_BUCKET` — Bucket name

**Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    }
  ]
}
```

---

## 7. Environment Variables

### Required Variables

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `NODE_ENV` | string | "production" | Environment (development/production) |
| `PORT` | number | 3000 | Server port |
| `DATABASE_URL` | string | "mysql://user:pass@host/db" | MySQL connection string |
| `JWT_SECRET` | string | "random-secret-key-64-chars" | Session token signing key |
| `PUBLIC_BASE_URL` | string | "https://iosky.nl" | Public domain (for links in emails) |

### Optional Variables (Manus-Dependent)

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `VITE_APP_ID` | string | "app-id-from-manus" | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | string | "https://api.manus.im" | Manus OAuth endpoint |
| `BUILT_IN_FORGE_API_URL` | string | "https://forge.manus.im" | Manus API endpoint |
| `BUILT_IN_FORGE_API_KEY` | string | "forge-api-key" | Manus API key |
| `VITE_FRONTEND_FORGE_API_KEY` | string | "frontend-key" | Frontend Manus API key |
| `VITE_FRONTEND_FORGE_API_URL` | string | "https://forge.manus.im" | Frontend Manus API URL |
| `OWNER_OPEN_ID` | string | "owner-id-from-manus" | Manus owner ID |
| `OWNER_NAME` | string | "Your Name" | Owner name |
| `STAGING_MODE` | string | "true" | Enable staging gate |
| `STAGING_PASSWORD` | string | "staging-pass" | Staging gate password |
| `STAGING_SECRET` | string | "staging-secret" | Staging gate HMAC secret |

### Email & SMS Variables

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `RESEND_API_KEY` | string | "re_xxxxx" | Resend email API key |
| `SMTP_URL` | string | "smtp://user:pass@host:587" | SMTP connection (alternative) |
| `SMTP_FROM` | string | "noreply@iosky.nl" | From email address |
| `BOOKING_FROM_EMAIL` | string | "bookings@iosky.nl" | Booking email sender |
| `TWILIO_ACCOUNT_SID` | string | "AC..." | Twilio account ID |
| `TWILIO_AUTH_TOKEN` | string | "token..." | Twilio auth token |
| `TWILIO_FROM_NUMBER` | string | "+1234567890" | Twilio phone number |

### Frontend Variables (Vite)

Frontend variables must be prefixed with `VITE_` to be exposed to the client:

```typescript
// In client code
const appId = import.meta.env.VITE_APP_ID;
```

### Environment File Template

Create `.env.local` in project root:

```bash
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/iosky
JWT_SECRET=your-secret-key-here-minimum-32-characters
PUBLIC_BASE_URL=https://iosky.nl

# Email
RESEND_API_KEY=re_xxxxx
SMTP_FROM=noreply@iosky.nl
BOOKING_FROM_EMAIL=bookings@iosky.nl

# SMS (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=token...
TWILIO_FROM_NUMBER=+1234567890

# Manus (optional, for OAuth)
VITE_APP_ID=app-id
OAUTH_SERVER_URL=https://api.manus.im
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=forge-key
VITE_FRONTEND_FORGE_API_KEY=frontend-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
OWNER_OPEN_ID=owner-id
OWNER_NAME=Your Name

# Staging
STAGING_MODE=false
STAGING_PASSWORD=staging-pass
STAGING_SECRET=staging-secret
```

---

## 8. Deployment Architecture

### Self-Hosted Deployment (Post-Manus)

#### Option A: Docker + Kubernetes

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Run
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
```

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: io-sky
spec:
  replicas: 3
  selector:
    matchLabels:
      app: io-sky
  template:
    metadata:
      labels:
        app: io-sky
    spec:
      containers:
      - name: io-sky
        image: your-registry/io-sky:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: io-sky-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: io-sky-secrets
              key: jwt-secret
        # ... other env vars
```

#### Option B: Heroku / Railway / Render

**Procfile:**
```
web: node dist/index.mjs
```

**Deploy:**
```bash
# Heroku
git push heroku main

# Railway
railway up

# Render
git push render main
```

#### Option C: VPS (DigitalOcean, Linode, AWS EC2)

**Setup:**
```bash
# SSH into server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Clone repo
git clone https://github.com/YOUR_ORG/io-sky.git
cd io-sky

# Install dependencies
pnpm install

# Set environment variables
nano .env.production

# Build
pnpm build

# Run with PM2 (process manager)
npm install -g pm2
pm2 start dist/index.mjs --name "io-sky"
pm2 startup
pm2 save
```

### Database Deployment

#### MySQL on AWS RDS

1. Create RDS instance (MySQL 8.0+)
2. Set `DATABASE_URL` to RDS endpoint:
   ```
   mysql://user:password@your-rds-endpoint:3306/iosky
   ```
3. Run migrations:
   ```bash
   pnpm db:push
   ```

#### MySQL on Self-Hosted VPS

```bash
# Install MySQL
sudo apt-get install mysql-server

# Create database
mysql -u root -p
CREATE DATABASE iosky;
CREATE USER 'iosky'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON iosky.* TO 'iosky'@'localhost';
FLUSH PRIVILEGES;

# Set DATABASE_URL
DATABASE_URL=mysql://iosky:password@localhost:3306/iosky
```

### DNS & SSL

#### DNS Setup

Point your domain to your server:

```
A record: iosky.nl → your-server-ip
CNAME record: www.iosky.nl → iosky.nl
```

#### SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d iosky.nl -d www.iosky.nl

# Auto-renewal
sudo systemctl enable certbot.timer
```

#### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name iosky.nl www.iosky.nl;

    ssl_certificate /etc/letsencrypt/live/iosky.nl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/iosky.nl/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name iosky.nl www.iosky.nl;
    return 301 https://$server_name$request_uri;
}
```

### Monitoring & Logging

**Application Logs:**
```bash
# View logs
pm2 logs io-sky

# Persistent logging
pm2 install pm2-logrotate
```

**Error Tracking (Sentry):**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

**Uptime Monitoring:**
- Use UptimeRobot or Healthchecks.io
- Monitor `/api/health` endpoint (add if needed)

---

## 9. CI/CD Configuration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        run: pnpm test
      
      - name: Type check
        run: pnpm tsc --noEmit
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /app/io-sky
            git pull origin main
            pnpm install
            pnpm build
            pnpm db:push
            pm2 restart io-sky
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:20
  script:
    - npm install -g pnpm
    - pnpm install --frozen-lockfile
    - pnpm test
    - pnpm tsc --noEmit

build:
  stage: build
  image: node:20
  script:
    - npm install -g pnpm
    - pnpm install --frozen-lockfile
    - pnpm build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache openssh-client
    - mkdir -p ~/.ssh
    - echo "$VPS_SSH_KEY" > ~/.ssh/id_rsa
    - chmod 600 ~/.ssh/id_rsa
    - ssh-keyscan -H $VPS_HOST >> ~/.ssh/known_hosts
    - ssh $VPS_USER@$VPS_HOST "cd /app/io-sky && git pull && pnpm install && pnpm build && pm2 restart io-sky"
  only:
    - main
```

### Pre-Commit Hooks

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
```

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,json,md}": ["prettier --write"]
}
```

---

## 10. Developer Onboarding Guide

### Prerequisites

- **Node.js:** 20+ (check via `node --version`)
- **pnpm:** 8+ (install via `npm install -g pnpm`)
- **Git:** Latest (check via `git --version`)
- **MySQL:** 8.0+ (local or remote)
- **VS Code:** Recommended (with TypeScript, ESLint, Prettier extensions)

### Initial Setup

#### 1. Clone Repository

```bash
git clone https://github.com/YOUR_ORG/io-sky.git
cd io-sky
```

#### 2. Install Dependencies

```bash
pnpm install
```

#### 3. Setup Environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
nano .env.local
```

**Minimum for local development:**
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://root:password@localhost:3306/iosky
JWT_SECRET=dev-secret-key-here
PUBLIC_BASE_URL=http://localhost:3000
```

#### 4. Setup Database

```bash
# Create database
mysql -u root -p
CREATE DATABASE iosky;
EXIT;

# Run migrations
pnpm db:push

# Seed test data
node scripts/seed-users.mjs
```

#### 5. Start Development Server

```bash
pnpm dev
```

Server runs at `http://localhost:3000`

#### 6. Login with Seeded Credentials

- **Admin:** `admin@iosky.local` / `IOSky-Admin-2026!`
- **Client:** `client@iosky.local` / `IOSky-Client-2026!`
- **Developer:** `developer@iosky.local` / `IOSky-Developer-2026!`

### Development Workflow

#### File Organization

- **Pages:** Add new pages in `client/src/pages/`
- **Components:** Reusable UI in `client/src/components/`
- **Styles:** Global styles in `client/src/index.css`
- **API:** tRPC procedures in `server/routers.ts`
- **Database:** Queries in `server/db.ts`

#### Adding a New Feature

1. **Define database schema** (if needed):
   ```typescript
   // drizzle/schema.ts
   export const features = mysqlTable("features", {
     id: int("id").autoincrement().primaryKey(),
     name: text("name").notNull(),
     createdAt: timestamp("createdAt").defaultNow().notNull(),
   });
   ```

2. **Run migration:**
   ```bash
   pnpm db:push
   ```

3. **Add database helper:**
   ```typescript
   // server/db.ts
   export async function getFeatures() {
     return db.select().from(features);
   }
   ```

4. **Add tRPC procedure:**
   ```typescript
   // server/routers.ts
   features: {
     list: publicProcedure.query(async () => {
       return db.getFeatures();
     }),
   }
   ```

5. **Add UI component:**
   ```typescript
   // client/src/pages/Features.tsx
   export default function Features() {
     const { data } = trpc.features.list.useQuery();
     return <div>{data?.map(f => <p key={f.id}>{f.name}</p>)}</div>;
   }
   ```

6. **Add tests:**
   ```typescript
   // server/features.test.ts
   import { describe, it, expect } from "vitest";
   import { getFeatures } from "./db";

   describe("Features", () => {
     it("should list features", async () => {
       const features = await getFeatures();
       expect(features).toBeDefined();
     });
   });
   ```

7. **Run tests:**
   ```bash
   pnpm test
   ```

#### Code Style

- **Formatting:** `pnpm format` (Prettier)
- **Linting:** `pnpm lint` (ESLint)
- **Type checking:** `pnpm tsc --noEmit`

#### Commit & Push

```bash
git add .
git commit -m "feat: add feature name"
git push origin main
```

### Testing

#### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/auth.logout.test.ts

# Watch mode
pnpm test --watch
```

#### Integration Tests

Test the full flow (database → API → UI):

```typescript
import { describe, it, expect } from "vitest";
import { trpc } from "@/lib/trpc";

describe("Booking Flow", () => {
  it("should create and retrieve booking", async () => {
    const booking = await trpc.bookings.create.mutate({
      email: "test@example.com",
      // ... other fields
    });
    expect(booking.id).toBeDefined();
  });
});
```

### Debugging

#### Browser DevTools

- **React DevTools:** Chrome extension for React debugging
- **Redux DevTools:** For state inspection (if using Redux)
- **Network Tab:** Monitor API calls to `/api/trpc`

#### Server Logs

```bash
# View live logs
pnpm dev

# View PM2 logs (production)
pm2 logs io-sky
```

#### Database Inspection

```bash
# Connect to MySQL
mysql -u root -p iosky

# View tables
SHOW TABLES;

# Query data
SELECT * FROM users;
```

### Common Tasks

#### Reset Database

```bash
# Drop and recreate
mysql -u root -p
DROP DATABASE iosky;
CREATE DATABASE iosky;
EXIT;

pnpm db:push
node scripts/seed-users.mjs
```

#### Update Dependencies

```bash
# Check for updates
pnpm outdated

# Update all
pnpm update

# Update specific package
pnpm update react@latest
```

#### Deploy Changes

```bash
# Build for production
pnpm build

# Test production build locally
pnpm preview

# Push to main branch (triggers CI/CD)
git push origin main
```

### Troubleshooting

#### "Cannot find module" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Database connection fails

```bash
# Check DATABASE_URL in .env.local
# Verify MySQL is running
mysql -u root -p -e "SELECT 1;"

# Test connection string
pnpm db:push --verbose
```

#### Port 3000 already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

#### TypeScript errors

```bash
# Run type check
pnpm tsc --noEmit

# Fix auto-fixable errors
pnpm lint --fix
```

### Resources

- **tRPC Docs:** https://trpc.io/docs
- **Drizzle ORM Docs:** https://orm.drizzle.team
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Express.js:** https://expressjs.com

### Support

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Email:** dev@iosky.nl

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm preview                # Preview production build

# Testing
pnpm test                   # Run all tests
pnpm test --watch           # Watch mode

# Code Quality
pnpm lint                   # Run ESLint
pnpm format                 # Format with Prettier
pnpm tsc --noEmit           # Type check

# Database
pnpm db:push                # Run migrations
pnpm db:studio              # Open Drizzle Studio

# Deployment
pnpm build && node dist/index.mjs  # Run production build
```

### File Locations

| Item | Location |
|------|----------|
| Frontend code | `client/src/` |
| Backend code | `server/` |
| Database schema | `drizzle/schema.ts` |
| Environment vars | `.env.local` |
| Tests | `**/*.test.ts` |
| Migrations | `drizzle/migrations/` |
| Static assets | `client/public/` |
| Styles | `client/src/index.css` |

### Key Contacts

- **Project Owner:** Your Name
- **Lead Developer:** Your Lead Dev
- **DevOps:** Your DevOps Engineer
- **Support Email:** support@iosky.nl

---

**Document Version:** 1.0.0  
**Last Updated:** June 2026  
**Next Review:** December 2026
