# Linklet

The dedicated academic and social platform for students at **MNNIT Allahabad**.

[![CI](https://github.com/Tanish-237/linklet/actions/workflows/ci.yml/badge.svg)](https://github.com/Tanish-237/linklet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](backend/package.json)
[![Live](https://img.shields.io/badge/live-linklet.org-7c3aed.svg)](https://linklet.org)

Linklet connects students across batches and branches through real-time communication, course-tagged academic archives, peer Q&A forums, and campus utility tools. Live in production at [linklet.org](https://linklet.org) with API services at [api.linklet.org](https://api.linklet.org).

---

## Table of Contents

- [Highlights](#highlights)
- [System Architecture](#system-architecture)
- [Core Features](#core-features)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Highlights

- **Campus-Only Verification**: Registrations and logins strictly require an authenticated `@mnnit.ac.in` Google Workspace or institutional email.
- **Production Chat Architecture**: Low-latency 1:1 and group conversations with audio voice notes, waveform scrubbers, parallel multi-attachment uploads, atomic reactions, in-chat search, and real-time read receipts.
- **Academics & Resources**: Centralized repository for lecture notes, past exams, and assignment references categorized by branch, semester, and course code.
- **Help Forum**: Stack-Overflow-style peer Q&A forum with question tagging, markdown/code formatting, and vote tallying.
- **Student Dashboard**: Class schedule manager, lecture and lab attendance tracker with minimum percentage warnings, and academic progress tools.
- **AI Timetable Import**: Upload a timetable PDF or image and have it parsed (Google Gemini) into a reviewable weekly schedule and attendance tracker.
- **Built for Campus Scale**: Designed around ~10,000 students — cursor-based pagination, Redis-backed user/dashboard caching and horizontal WebSocket scaling, compound indexes on hot query paths, and tiered rate limiting.
- **Shareable Public Pages**: Landing, About, Contact, Privacy, and Terms pages are prerendered at build time with full Open Graph/Twitter meta, so links shared on WhatsApp and social apps preview correctly.

---

## System Architecture

```
                       ┌─────────────────────────┐
                       │   React 19 + Vite SPA   │
                       │ (TanStack Query, Zustand)│
                       └────────────┬────────────┘
                                    │
                         HTTPS REST │ WebSockets (WSS)
                                    ▼
                       ┌─────────────────────────┐
                       │   Express API Cluster   │
                       │   (Node.js + Helmet)    │
                       └──────┬────────────┬─────┘
                              │            │
             Read/Write Cache │            │ Horizontal Pub/Sub
                              ▼            ▼
                       ┌─────────────┐  ┌───────────────────────────┐
                       │ Redis 7.x   │  │ Socket.IO Redis Adapter   │
                       └─────────────┘  └───────────────────────────┘
                              │
                    Compound  │
                     Indexes  ▼
                       ┌─────────────────────────┐
                       │ MongoDB Replica Set     │
                       │ (Cursor-paginated msgs) │
                       └─────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, TanStack React Query v5, Zustand v5, React Router v7, Chart.js, Socket.IO Client |
| **Backend** | Node.js, Express 4, Mongoose 8, Socket.IO 4, Winston, Multer, Helmet, Express Rate Limit |
| **Data & Cache** | MongoDB (indexed cursor pagination, text search), Redis (session caching, horizontal socket adapter) |
| **Storage & Media** | Cloudinary CDN (parallelized uploads, temporary file system unlink cleanup) |
| **Authentication** | Google OAuth 2.0 (`@mnnit.ac.in` verified), JWT access + refresh token rotation |

---

## Core Features

### 1. Messaging System
- **Voice Notes**: In-browser audio recording via MediaRecorder API, live waveform visualization, and multi-track audio playback with duration tracking.
- **Concurrent Media Uploads**: Multi-image, video, and PDF uploads dispatched in parallel via Cloudinary pipelines and committed to MongoDB in bulk.
- **Concurrency-Safe Reactions**: Emoji reactions updated atomically via MongoDB `$pull` / `$set` / `$push` operators to eliminate race conditions under concurrent write loads.
- **Group Chat Governance**: Multi-admin group hierarchy, member promotion/demotion, dedicated group avatars, and safe admin handoff upon member leave.
- **Delivery & Read Receipts**: Real-time read indicators (`messages_read`) synchronized across all active participant sockets.
- **In-Chat Message Search**: Text index query engine with live jump navigation between matching message elements.

### 2. Academic Resource Archive
- Semester-wise and branch-wise categorization (CSE, ECE, EE, ME, CE, etc.).
- Direct PDF downloads and previews with file size, author attribution, and course code tags.
- Secure upload pipeline with MIME-type filtering and 25 MB payload limits.

### 3. Student Dashboard
- **Attendance Tracker**: Log lectures and lab sessions separately. Automatically calculates classes needed to maintain minimum attendance thresholds.
- **Schedule Management**: Day-by-day timetable planner with upcoming class alerts.
- **Collections & Bookmarks**: Save useful posts, questions, and resources into custom personal folders.

### 4. Help Forum & Campus Feed
- Peer-driven question feeds with thread replies, upvoting, and solved status tags.
- Campus announcements and social updates with rich media embeds and engagement tracking.

---

## Getting Started

### Prerequisites

Ensure you have the following installed locally:
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: v6.0+ (local instance or MongoDB Atlas connection URI)
- **Redis**: v6.0+ (local server or cloud instance; the server boots without it, but OTP, logout/session invalidation, caching, and socket scaling need it)

---

### Backend Setup

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```

   The example file documents every variable the backend actually reads. At minimum for local dev you'll need `MONGO_URL`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET` set. Without `REDIS_URL` the server still starts, but Redis-backed features (OTP, sessions/logout, caching, socket.io horizontal scaling) will explicitly error rather than silently work — fine for a quick local check, not for anything resembling production. Email falls back from Brevo to Gmail SMTP if only `EMAIL_USER`/`EMAIL_PASS` are set. Cloudinary, Google OAuth, and Gemini are only needed for the specific feature each one powers (media uploads, Google sign-in, AI timetable parsing).

3. Run the development server:
   ```bash
   npm run dev
   ```
   The backend API will start on `http://localhost:5001`.

---

### Frontend Setup

1. Open a new terminal, navigate to the frontend directory, and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Copy `frontend/.env.example` to `frontend/.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_API_BASE_URL=http://localhost:5001
   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## Testing

Linklet maintains a strict test-driven development workflow with over 620 automated unit and integration tests across both client and server codebases.

### Backend Tests (Jest)
Runs repository unit tests, controller mocks, security middleware validations, and service integration tests:
```bash
cd backend
npm test
```
*Current test suite: 30 test suites, 340 tests passing.*

### Frontend Tests (Vitest + Testing Library)
Tests React components, custom hooks (`useChatMessages`, `useVoiceRecorder`), Zustand state stores, and Socket.IO connection lifecycles in a JSDOM environment:
```bash
cd frontend
npx vitest run
```
*Current test suite: 54 test suites, 288 tests passing.*

### Linting
Both packages are linted with ESLint; CI fails on lint errors:
```bash
cd backend && npm run lint
cd frontend && npm run lint
```

### Production Build Verification
`npm run build` runs the Vite client build, an SSR build of the public marketing pages, and `scripts/prerender.mjs`, which writes static HTML (with real meta tags) for `/`, `/about`, `/contact`, `/privacy`, and `/terms`. All other routes fall back to `app-shell.html` and render client-side.
```bash
cd frontend
npm run build
```

### Continuous Integration
Every push and pull request to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml): backend lint + tests + `npm audit`, and frontend lint + tests + build + `npm audit`.

---

## Project Structure

```
linklet/
├── backend/
│   ├── models/                # Mongoose schemas (User, Chat, Message, Post, Question)
│   ├── socket.js              # Socket.IO server, room auth, presence & adapters
│   ├── server.js              # Express app bootstrap & HTTP server
│   ├── src/
│   │   ├── controllers/       # HTTP request handlers
│   │   ├── services/          # Business logic (chat, auth, posts, resources)
│   │   ├── repositories/      # Database abstraction & lean query layer
│   │   ├── middlewares/       # Auth, RBAC, Multer, temp file cleanup
│   │   ├── routes/            # Express router declarations
│   │   └── utils/             # Redis client, logger, error handlers, Cloudinary
│   └── tests/                 # Jest unit and integration tests
│
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios client instance with interceptors
│   │   ├── components/        # Reusable UI modules & chat components
│   │   │   └── chat/          # Modular chat architecture (composer, header, messages)
│   │   ├── context/           # SocketContext & AuthContext providers
│   │   ├── hooks/             # Custom React lifecycle hooks
│   │   ├── pages/             # Route-level views (Feed, Chat, Dashboard, Forum)
│   │   ├── store/             # Zustand persistent state stores
│   │   └── config.js          # Client configuration & environment endpoints
│   ├── ssr/                   # SSR entry used at build time to prerender public pages
│   ├── scripts/               # prerender.mjs + HTML merge helper (and tests)
│   ├── public/                # robots.txt, sitemap.xml, static assets
│   ├── package.json
│   └── vite.config.js
│
├── .github/                   # CI workflow, issue templates, PR template
├── vercel.json                # SPA/prerender rewrites, cache & security headers
├── CHANGELOG.md               # Structured release history (Keep a Changelog format)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

---

## Deployment

| Component | Host | Notes |
|---|---|---|
| Frontend | Vercel | Static build from `frontend/`; `vercel.json` handles rewrites, asset caching, and security headers |
| Backend API + WebSockets | Render | `GET /health` for health checks; graceful shutdown on `SIGTERM`; logs go to stdout only in production |
| Database | MongoDB Atlas | |
| Cache / Pub-Sub | Redis | Required in production (OTP, sessions, caching, Socket.IO adapter) |
| Media | Cloudinary | |

Set every variable from `backend/.env.example` and `frontend/.env.example` in the respective host's environment settings.

---

## Security

- **Restricted Email Domain**: Server-side checks reject any non-`@mnnit.ac.in` domain during registration and OAuth callbacks.
- **Authentication**: Short-lived JWT access tokens with rotating refresh tokens, and token blacklisting on logout/password change. Socket.IO handshakes are rejected unless they carry a valid, non-blacklisted token; the client transparently refreshes an expired token and reconnects.
- **Password Policy**: Minimum 8 characters with at least one letter and one number, enforced on registration, change, and reset.
- **Rate Limiting**: A global API limiter plus tighter limits on OTP/login endpoints and a per-user limit on the paid AI timetable-upload endpoint.
- **Input Hardening**: Type checks against NoSQL operator injection, escaped regex in searches, URL validation on user-supplied links, and HTML escaping in outbound email.
- **CORS**: Explicit origin allow-list (production domains plus this project's own Vercel deployments only).
- **Media Cleanup**: Multer uploads are removed from the server filesystem immediately after upload or error.
- **Role-Based Access Control**: Admin-only endpoints guarded by RBAC middleware, with an audit log of admin actions.
- **Dependencies**: `npm audit` runs in CI; Dependabot alerts are kept at zero.

To report a vulnerability, see [SECURITY.md](SECURITY.md) — please don't open a public issue.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first, and note that all participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Bug reports and feature requests use the issue templates in this repo.

---

## License

Released under the [MIT License](LICENSE). Built by and for the students of Motilal Nehru National Institute of Technology (MNNIT) Allahabad.