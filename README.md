# Linklet

The dedicated academic and social platform for students at **MNNIT Allahabad**.

Linklet connects students across batches and branches through real-time communication, course-tagged academic archives, peer Q&A forums, and campus utility tools. Live in production at [linklet.org](https://linklet.org) with API services at [api.linklet.org](https://api.linklet.org).

---

## Highlights

- **Campus-Only Verification**: Registrations and logins strictly require an authenticated `@mnnit.ac.in` Google Workspace or institutional email.
- **Production Chat Architecture**: Low-latency 1:1 and group conversations with audio voice notes, waveform scrubbers, parallel multi-attachment uploads, atomic reactions, in-chat search, and real-time read receipts.
- **Academics & Resources**: Centralized repository for lecture notes, past exams, and assignment references categorized by branch, semester, and course code.
- **Help Forum**: Stack-Overflow-style peer Q&A forum with question tagging, markdown/code formatting, and vote tallying.
- **Student Dashboard**: Class schedule manager, lecture and lab attendance tracker with minimum percentage warnings, and academic progress tools.
- **Enterprise-Grade Performance**: Built for 10,000 active students with cursor-based pagination, Redis-backed horizontal WebSocket scaling, and zero full-table database scans.

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
- **Redis**: v6.0+ (local server or cloud instance; optional in local dev with graceful in-memory fallback)

---

### Backend Setup

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` file in `backend/`:
   ```env
   PORT=5001
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173

   # MongoDB
   MONGO_URL=mongodb://localhost:27017/linklet

   # Authentication
   ACCESS_TOKEN_SECRET=your_super_secret_access_key
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_super_secret_refresh_key
   REFRESH_TOKEN_EXPIRY=10d

   # Redis (optional locally, falls back to memory adapter)
   REDIS_URL=redis://localhost:6379

   # Cloudinary Media Storage
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Google OAuth (must match your Google Console credentials)
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Email Service (Password Resets / OTPs)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   ```

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

2. Create a `.env` file in `frontend/`:
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

Linklet maintains a strict test-driven development workflow with over 530 automated unit and integration tests across both client and server codebases.

### Backend Tests (Jest)
Runs repository unit tests, controller mocks, security middleware validations, and service integration tests:
```bash
cd backend
npm test
```
*Current test suite: 24 test suites, 291 tests passing.*

### Frontend Tests (Vitest + Testing Library)
Tests React components, custom hooks (`useChatMessages`, `useVoiceRecorder`), Zustand state stores, and Socket.IO connection lifecycles in a JSDOM environment:
```bash
cd frontend
npx vitest run
```
*Current test suite: 45 test suites, 242 tests passing.*

### Production Build Verification
To ensure all assets compile cleanly without bundling warnings or type errors:
```bash
cd frontend
npm run build
```

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
│   ├── package.json
│   └── vite.config.js
│
├── CHANGELOG.md               # Structured release history (Keep a Changelog format)
└── README.md
```

---

## Security

- **Restricted Email Domain**: Enforced server-side checks reject any non-`@mnnit.ac.in` domain during registration and OAuth callbacks.
- **JWT Protection**: Short-lived access tokens (15m-1d) coupled with refresh tokens. Socket handshakes require token verification before room joins.
- **Rate Limiting**: Public endpoints (auth, password resets, file uploads) are throttled via `express-rate-limit`.
- **Media Cleanup**: Multer disk-storage uploads are unlinked and wiped from the server file system immediately after upload or error.
- **Role-Based Access Control**: Admin-only moderation endpoints guarded by strict RBAC middleware.

---

## License

This project is maintained for the students and campus community of Motilal Nehru National Institute of Technology (MNNIT) Allahabad.