# API QuickTest — Send. Inspect. Understand.

[![CI](https://github.com/Hafiz-Hamza-Liaqat/api-quicktest/actions/workflows/ci.yml/badge.svg)](https://github.com/Hafiz-Hamza-Liaqat/api-quicktest/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/Hafiz-Hamza-Liaqat/api-quicktest/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Hafiz-Hamza-Liaqat/api-quicktest/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Version: 1.0.0](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

**API QuickTest** is a fast, responsive, and secure API client built for developers who need to test endpoints, inspect payloads, troubleshoot failures, and run automated assertions without unnecessary complexity or bloated memory footprints.

It combines an intuitive, dark-first desktop and mobile interface with a lightweight, SSRF-hardened Node.js proxy to offer seamless debugging across both browser-direct and server-proxied environments.

---

## Visual Walkthrough

### 1. Main Dashboard & Response Inspector
Real-time request execution with client-observed timing, HTTP status badges, formatted JSON display, and one-click copy/download controls.

![API QuickTest Main Dashboard](docs/screenshots/01-main-dashboard.png)

### 2. Built-in API Recipes & Quick Start
Pre-configured, runnable workflows covering common REST operations (CRUD, 404 inspection, and response assertions) with offline deterministic endpoints.

![API Recipes & Quick Start](docs/screenshots/02-recipes-modal.png)

### 3. Developer Code Snippet Generator
Generate copy-ready cURL commands, modern JavaScript `fetch()` snippets, and Python `requests` scripts with automated secret omission.

![Developer Code Snippet Generator](docs/screenshots/03-code-snippets.png)

### 4. Response Assertions Engine
Evaluate response status codes, latency thresholds, JSON path values, data types, and header presence without dynamic code execution (`eval`).

![Response Assertions Engine](docs/screenshots/05-response-assertions.png)

### 5. Environment Profiles & Variable Substitution
Manage Development, Staging, and Production profiles with dynamic `{{baseUrl}}` variable substitution and credential masking.

![Environment Profiles](docs/screenshots/04-environment-modal.png)

### 6. Light Theme Support & Mobile View
Full theme toggle with contrast preservation across mobile (375px), tablet (768px), and desktop (1440px) viewports with zero horizontal overflow.

| Light Theme Interface | Mobile View (375px) |
| :---: | :---: |
| ![Light Theme](docs/screenshots/06-light-theme.png) | ![Mobile View](docs/screenshots/07-mobile-responsive.png) |

---

## Core Capabilities

1. **Request Builder**:
   - Supported HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
   - Method-aware payload management: `GET` requests never transmit request bodies.
   - Live query parameter synchronization with two-way URL encoding and fragment preservation.
   - Live resolved URL preview reflecting active environment variables (`{{baseUrl}}`, `{{userId}}`).
   - Dynamic header editor with browser-prohibited header warnings in direct mode.
   - Syntax-validated JSON editor with auto-formatting and size enforcement.
   - Authentication modes: Bearer Token, Basic Auth, and Custom Header API Keys with UI masking.

2. **Accurate Response Inspector**:
   - HTTP status code badges with RFC reason phrases (2xx, 3xx, 4xx, 5xx).
   - High-precision client-observed elapsed time measured via `performance.now()`.
   - Distinct display for upstream timing reported by the proxy backend.
   - Payload byte sizing, formatted Content-Type badges, and memory-safe 5MB truncation limits.
   - 4-tab inspection:
     - **Pretty**: Syntax-highlighted, formatted JSON with search match counters.
     - **Raw**: Unaltered text preserving original line breaks and whitespace.
     - **Headers**: Searchable response header table.
     - **Assertions**: Automated pass/fail test results with descriptive failure reasons.

3. **Request History & Collections**:
   - Bounded, privacy-preserving recent request history with one-click rerun.
   - Named collections with request duplication, editing, and deletion.
   - Safe JSON collection import and export.
   - **Zero Secret Leakage**: Authorization tokens, passwords, and private keys are stripped from history, exports, and persistent storage by default.

4. **Response Assertions**:
   - Status code equality (`status === 200`, `status === 201`).
   - Latency thresholds (`duration < 500ms`).
   - Safe JSON Path existence, equality, and type checking (`users[0].name === "Ada Lovelace"`).
   - Prototype pollution protection with pure algorithmic traversal (no `eval()` or `new Function()`).

---

## Architecture & Request Modes

API QuickTest supports two distinct execution paths:

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)              │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       [Direct Browser Mode]     [Proxy Mode]
                │                        │
                ▼                        ▼
     Target API Server           Node.js Proxy Server
     (Subject to CORS)           (SSRF-Hardened)
                                         │
                                         ▼
                                 Target API Server
```

### Direct Browser Mode
Sends standard `window.fetch()` calls directly from the user's browser.
- **Benefits**: Zero backend required; works entirely client-side.
- **Constraints**: Subject to the target API's Cross-Origin Resource Sharing (CORS) policy. If the remote API does not return permissive `Access-Control-Allow-Origin` headers, the browser blocks the response.
- **Error Transparency**: When direct mode encounters a CORS failure, API QuickTest clearly explains the limitation and offers a one-click switch to Proxy Mode.

### Proxy Mode
Routes requests through the dedicated Node.js proxy server.
- **Benefits**: Bypasses browser CORS restrictions, provides upstream timing telemetry, and enables testing APIs that do not serve browser-facing headers.
- **Security Controls**: Enforces strict destination validation, anti-SSRF filtering, and rate limiting.

---

## Node.js Proxy & SSRF Security Architecture

The backend proxy (`server/`) is purpose-built to prevent arbitrary open-proxy abuse and Server-Side Request Forgery (SSRF):

1. **Protocol Restriction**: Accepts only `http:` and `https:`. All other schemes (`file:`, `ftp:`, `data:`, `blob:`, `ws:`) are rejected.
2. **URL Credential Rejection**: Disallows embedded userinfo credentials (`http://user:pass@host`).
3. **Private IP Address Blocking**:
   - **IPv4**: Blocks `127.0.0.0/8` (loopback), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private LANs), `169.254.0.0/16` (link-local & AWS/GCP cloud metadata `169.254.169.254`), `224.0.0.0/4` (multicast), and `240.0.0.0/4` (reserved).
   - **IPv6**: Blocks `::1` (loopback), `::` (unspecified), `fe80::/10` (link-local), `fc00::/7` (unique local), and `::ffff:0:0/96` (IPv4-mapped addresses).
4. **DNS Resolution & Validation**: Resolves all DNS records for hostnames using `dns.lookup`. Rejects targets if **any** address resolves to an internal or reserved IP.
5. **DNS Rebinding Mitigation**: Uses custom `http.Agent` and `https.Agent` instances that pin the connection to the validated IP while preserving SNI and the `Host` header.
6. **Manual Redirect Inspection**: Disables automatic redirect following. Redirect targets (301, 302, 307, 308) are extracted and run through the complete SSRF validation pipeline (maximum 5 redirects).
7. **Rate Limiting & Size Protection**: In-memory sliding window rate limiter (default 120 req/min per IP), 2MB request body limit, and 5MB response stream limit.
8. **Audit & Privacy Safety**: Zero logging of authorization headers, tokens, passwords, or response payloads.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js 22, Express 5, CORS, Dotenv
- **Testing**: Vitest, React Testing Library, Playwright (Chromium)
- **Deployment**:
  - Frontend: GitHub Pages
  - Backend Proxy: Render (`render.yaml`)

---

## Getting Started Locally

### Prerequisites
- Node.js >= 20.x (Node 22 LTS recommended)
- npm >= 10.x

### 1. Clone & Install
```bash
git clone https://github.com/Hafiz-Hamza-Liaqat/api-quicktest.git
cd api-quicktest
npm install
```

### 2. Configure Environment
Copy the example configuration:
```bash
cp .env.example .env
```

### 3. Start Development Servers
Run both frontend and backend concurrently:
```bash
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Proxy & Test Server: `http://localhost:3001`
- Health Endpoint: `http://localhost:3001/health`

Alternatively, run each service independently:
```bash
# Terminal 1: Frontend Client
npm run dev:client

# Terminal 2: Backend Proxy
npm run dev:server
```

---

## Test Suites & Verification

API QuickTest includes 100% automated test coverage across unit, component, security, and browser E2E workflows:

```bash
# Run Vitest unit & component tests (45 tests)
npm test

# Run Playwright E2E browser tests (13 core workflows)
npm run test:e2e

# Run linter
npm run lint

# Build verification (client & server bundles)
npm run build
```

---

## Deployment Instructions

### Frontend (GitHub Pages)
The static frontend is automatically deployed using the included GitHub Actions workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml):
1. In your GitHub repository settings, navigate to **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Push to `main` to trigger automated build and deployment.
4. Assets are built using relative paths (`./`) to guarantee proper resolution on GitHub Pages.

### Backend Proxy (Render)
Deploy the Node.js proxy service using the included [`render.yaml`](render.yaml) blueprint:
1. Connect your repository on [Render](https://render.com).
2. Choose **New > Blueprint** and select `render.yaml`.
3. Set your environment variables:
   - `ALLOWED_ORIGINS`: `https://hafiz-hamza-liaqat.github.io,http://localhost:5173`
   - `RATE_LIMIT_MAX`: `120`
   - `ALLOW_LOCALHOST`: `false`
4. Verify deployment health at `https://<your-render-service>.onrender.com/health`.

---

## Environment Variables Reference

| Variable | Target | Description | Default |
| :--- | :--- | :--- | :--- |
| `VITE_API_PROXY_URL` | Frontend | Base URL of the Node.js proxy endpoint | `http://localhost:3001` |
| `PORT` | Backend | HTTP port for proxy server | `3001` (Render: `10000`) |
| `NODE_ENV` | Backend | Runtime environment (`development` / `production`) | `development` |
| `RATE_LIMIT_MAX` | Backend | Maximum proxy requests per minute per IP | `120` |
| `ALLOWED_ORIGINS` | Backend | Comma-separated allowed CORS origins | `http://localhost:5173,...` |
| `ALLOW_LOCALHOST` | Backend | Permit loopback targets (strictly for dev testing) | `false` |

---

## Known Limitations & Security Notes

- **Browser CORS**: In Direct Mode, the browser enforces the Same-Origin Policy. If a target server does not send `Access-Control-Allow-Origin`, direct requests will fail. Switch to Proxy Mode to inspect such endpoints.
- **Public Proxy Hosting**: A publicly accessible proxy carries inherent abuse risks. The included proxy features rate limiting, strict SSRF blocks, and body limits, but should be restricted in production to your specific frontend origin.
- **Client-Side Secret Storage**: Local environment variables and tokens stored in the browser's localStorage are intended for convenience during local development. Do not store sensitive production master keys in untrusted browsers.

---

## License

This project is licensed under the [MIT License](LICENSE) © 2026 Hamza Liaqat.
