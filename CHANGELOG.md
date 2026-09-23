# Changelog

All notable changes to the Linklet platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.4] - 2026-09-23

### Security
- **Login and OTP limits are per account as well as per IP.** Per email: 5 codes requested, 5 wrong codes and 10 failed logins per 15 minutes, however many IPs they come from. Per IP the limits are looser (60 OTP actions, 100 logins per 15 minutes) so students sharing hostel Wi-Fi aren't locked out together. Successful logins and verifications don't count.
- Change password allows 5 wrong current passwords per user per 15 minutes.
- JSON and form request bodies are capped at 1 MB (was 10 MB). File uploads are unaffected.

### Added
- **Resend code** on the signup OTP step, with a 60-second countdown.

### Changed
- Signup checks the password before sending the OTP (the password field is locked on the OTP step, so a weak password used to mean starting over).
- After signing up you land on Home with "Welcome to Linklet!" instead of being told to log in (you're already signed in).
- The site-wide rate limit returns a readable message instead of "Error 429: Something went wrong".

### Fixed
- Password-reset emails sent through Brevo said "Your OTP for registering on Linklet"; each email now has its own wording.
- An OTP sent to an email typed with capitals is accepted when the email is retyped in lowercase.
- Contact form: an over-long name, subject or message gets a clear error instead of a server error, and the fields stop at the limit. A name with quotes or commas can no longer break the Reply-To header.

## [2.1.3] - 2026-09-23

### Added
- **Unsolved** filter in the Help Forum: questions without an accepted answer (`status=unsolved` on the feed API). The status filters are now All, Solved, Unsolved, Answered and Unanswered.

### Changed
- Help Forum filters on phones: the sort dropdown and My Questions share the first row at full width; the status filters sit on their own row below and scroll sideways if they don't fit.
- The empty Help Forum list says why it's empty (e.g. "Nothing is waiting for an answer" on Unanswered, "No results for …" on a search, "You haven't asked any questions yet" on My Questions), with a matching icon, a **Clear filters** button when any filter is on, and a centred layout.

## [2.1.2] - 2026-09-23

### Deploy notes
- Run `npm run migrate:resource-sizes` (backend) once per database to fill in file sizes for resources uploaded before this release (`-- --dry-run` first; it only sets the new `fileSize` field and is safe to re-run). Until then those resources simply show no size.

### Added
- Resource cards show the file size (e.g. "2.4 MB") to the left of the download count, in grid and list views. New uploads store Cloudinary's reported size in `fileSize` (bytes); links have none.

### Changed
- The desktop rail no longer draws a divider above the theme toggle (the navigation drawer keeps its divider).

### Fixed (phones)
- **Downloads work on phones.** Resource, Saved and chat-media downloads started only after an API call or a fetch-to-blob had finished, which mobile browsers (iOS Safari especially) silently block; the blob URL was also revoked before the save could start. Every download button now uses one helper (`utlis/download.js`) that saves the file during the tap itself via Cloudinary's `fl_attachment` URL, with the resource's title as the file name. The download counter is updated in the background.
- **Resource preview on phones:** PDFs no longer show a blank or first-page-only frame (phone browsers can't render a PDF inside an iframe); touch screens get **Open PDF** and **Download** buttons instead. The preview header has a Download button, and "Download File" for other types now downloads instead of opening a tab.
- **Smoother feed scrolling:** hover effects no longer fire on touch. All 216 plain-CSS `:hover` rules now apply only on devices that can hover (`@media (hover: hover)`, the same as Tailwind's `hover:`), so cards stop lifting, re-shadowing and "sticking" under your finger while you scroll. Per-item backdrop blurs (feed cards, chat badges and buttons, grid badges) are off on touch screens, where they were re-rendered every scroll frame.
- **Press and hold on phones:** holding a chat message opens its menu, with the react button beside it; holding a chat in the list opens its menu on iPhones too (iOS never fires `contextmenu`). The hold no longer starts a text selection or the browser's callout.
- Controls that only appeared on hover are visible on touch screens: delete buttons on collection and resource cards, the chat list menu button, the delete-notification button, the change-group-icon button and the change-avatar overlay.
- iOS no longer zooms the page in (and leaves it zoomed) when you tap the chat box or a search box; pinch-zoom still works.
- Pop-ups and panels sized with `vh` use `dvh`, so their bottom edge (and buttons) aren't hidden behind Safari's toolbar.

## [2.1.1] - 2026-09-23

### Fixed
- Voice notes were sent twice: the recording was uploaded under two form fields and the server stored one message per file, so everyone in the chat got two copies and the sender also saw a third bubble stuck on "sending". The client now uploads it once, and the server keeps only one file for `mediaType: "audio"`, so browsers still running the old build stop creating duplicates too.
- Sending several attachments at once no longer shows the "sending" bubble (and its caption) next to the delivered attachments while the upload response is on its way; the first delivered attachment takes its place.

## [2.1.0] - 2026-09-23

### Deploy notes
- Deploy backend and frontend together: login responses no longer include tokens, `GET /posts/user/:userId` is now paginated, and presence uses a new `presence` socket event.
- Auth cookies are now `SameSite=Lax` (the site and API share `linklet.org`). Signing in on `*.vercel.app` preview deployments against the production API no longer works; use a local backend for previews.
- Backend requires Node.js 22 or newer (Node 18 and 20 are end-of-life); CI runs on Node 22.

### Added
- Navigation drawer: on desktop the rail's menu button opens a drawer that slides over the page; on phones the bottom bar has **Explore**, which holds every page plus account, notifications, What's New, settings and log out.
- Paginated profile posts (`GET /posts/user/:userId?cursor=&limit=`, keyset on `createdAt, _id`, with `total` on the first page).
- "Go to message" in one request (`?until=<messageId>` on chat history): tapping a reply's quote, a pin or a search result jumps straight to the original, however far back.
- Group typing indicators name who is typing ("Asha and 2 others are typing..."), per person, in the chat header and sidebar.
- In-app confirmation dialogs (`useConfirm`) replace the browser's `window.confirm`.
- Post grid cards on profiles and Saved show the caption and stats without hover, so they work on touch screens.
- Circular reveal animation when switching light/dark theme (skipped with reduced motion).

### Changed
- **Online status means "in the foreground"**: a tab or app in the background no longer shows the user online, and going away is reported after a short grace period so quick tab switches don't flicker. Background tabs still receive messages and delivery ticks.
- Login tokens live only in httpOnly cookies; they are no longer returned in response bodies, and any old copy in `localStorage` is cleared.
- Page data is kept in the React Query cache: revisiting a page renders instantly and refreshes in the background, writes mark the affected pages stale, hovering a nav link prefetches its data, and signing out clears the cache.
- Icons moved from Material Icons to a subset of Material Symbols Rounded (~26 KB); `npm run icons:sync` regenerates the list.
- Signed-in users read About, Contact, Privacy and Terms inside the app shell.
- The phone keyboard stays open between chat messages, and starting a reply or edit focuses the message box.
- Read receipts still queued when you leave a chat are sent instead of dropped.

### Security
- Socket.io events are rate limited per connection (10/s, burst 40); excess events are dropped.
- Typing indicators are relayed only from members of a chat's room, only to recipients in that chat, and only with server-set fields.

### Performance
- Index on saved collections (`userId`, `createdAt`).
- Other nav pages' code loads when the browser is idle.

## [2.0.0] - 2026-09-23

### Breaking
- **Post comments moved out of the Post document into their own `postcomments` collection.** The API changed with it: `POST /posts/:id/comment`, `.../reply`, `.../upvote` and `DELETE .../comments/:id` now return the affected comment/reply (plus `commentsCount` / `repliesCount`) instead of the whole post; post payloads carry `commentsCount` instead of a `comments` array; comment votes/deletes return `{ _id, upvotes }` / `{ deletedIds, commentsCount }`. Comments are read through the new paginated `GET /posts/:postId/comments` and `GET /posts/:postId/comments/:commentId/replies`. Backend and frontend must be deployed together.
- **Data migration required.** Run `npm run migrate:comments` (backend) once per database after deploying; use `-- --dry-run` first and take a backup. It is idempotent, preserves original comment IDs and timestamps, and only removes a post's embedded comments after verifying the copy. Until it has run, existing comments are not shown (the server logs `[MIGRATION REQUIRED]` at startup). `-- --recount` repairs the denormalized counters.

### Deploy notes
- **`REDIS_URL` is now required in production.** The server refuses to start without it (Socket.io rooms, presence and rate limits would otherwise silently become per-instance).
- **Data migration required.** Run `npm run migrate:resource-categories` (backend) once per database — it relabels the retired `presentations` category to `lectures`. The server logs `[MIGRATION REQUIRED]` at startup until it has run.

### Added
- Paginated comment threads: 20 comments per page with the first 3 replies inline and "View N more replies" on demand; replies can now be deleted by their author or an admin.
- Infinite-scroll campus feed (15 posts per page). The feed previously stopped at 50 posts with no way to reach older ones.
- Lightweight `GET /profile/me/bookmark-ids` endpoint for feed/post bookmark state.
- Reusable `SEO` component (canonical URL, robots directive, Open Graph/Twitter with image dimensions, JSON-LD); `Organization`/`WebSite` structured data on the landing page; prerendered `/posts` shell with its own title, description and canonical; `noindex` on the 404 and sign-in screens; 1200x630 social preview image, 64px favicon and Apple touch icon.
- Redis read-through cache helper (single-flight, versioned invalidation, graceful fallback when Redis is unavailable) used by the posts feed, forum tags/stats/search, resource category stats, user timetable, branches, profiles and follower lists.
- Gemini timetable parses are cached by file hash (14 days) with concurrent identical uploads sharing one call, so the paid vision call runs once per distinct timetable instead of once per student.
- API `Cache-Control` policy: `private, no-cache` (ETag revalidation) for GETs, short private caching for branches, forum metadata, tag cloud and stats.
- Cloudinary delivery helpers (`f_auto,q_auto`, width caps, `srcset`) applied to feed, post and avatar images; local group avatar asset.
- Real-database test harness (`mongodb-memory-server`) plus real-socket presence tests; frontend `npm test` script; CI caches the `mongod` binary.
- Admins can review reported feed posts: the admin dashboard's Reports tab has a Messages / Posts switch, with a link to each reported post and Resolve / Dismiss actions.
- Notification preferences are stored on the account (`PUT /profile/notification-preferences`) and enforced server-side: switching off forum, post or system alerts now actually stops those notifications, on every device.
- `GET /chat/chat-settings/muted`, used by the app shell so muted chats stay silent on a new device before the chat page has been opened.
- Chats open at the first unread message under an "N unread messages" divider (paging back through history if needed), or at the latest message when everything is read. The divider is placed once when the chat opens and doesn't move while you read.
- Real unread counts per chat (`unreadCount`, capped at 99+) from a per-user read cursor (`lastReadAt`); reading on one tab or device clears the badge on the others (`chat read` event).
- Persistent "Delete for me" for other people's messages (`POST /chat/message/hide`).
- Failed messages show **Retry** and **Delete**; sending messages show a clock until the server confirms them.
- In-chat search covers the whole conversation (server-side, partial-word, case-insensitive) with "1 of N", Enter / Shift+Enter or ↑/↓ to step through older/newer matches, and Esc to close; results older than the loaded page are loaded and highlighted.
- Chat details → **Media & files**: paginated Media (photo/video grid by month), Docs (real filenames, type icons) and Voice tabs, each item with "Show in chat" (`GET /chat/message/media/:chatId`). New uploads keep their original filename (`fileName`).
- Contact details show the person's real profile: year (derived from the institute email when not set), full branch name, semester/section, email and phone links, skills and join date.
- Pinned banner shows "Pinned message N of M" and cycles through every pin.

### Changed
- **Presence** is now correct with multiple tabs and multiple server instances: closing one tab no longer marks a user offline, "came online"/"went offline" events go only to people who share a chat with the user (previously broadcast to every connected user), and presence is refreshed when a new chat or group is created.
- Forum feed pagination rewritten: exact `hasMore`, opaque cursors (date for time-ordered views, offset for popular/most-viewed/search), search ranked over a capped candidate set so pages no longer duplicate or skip results, and "Popular" now sorts by upvote count. `?limit` above 50 no longer breaks paging. Answered/unanswered/solved filters are index-friendly.
- Resource library sorts and paginates before joining uploaders; category counts are computed separately and cached.
- Chat list cache TTL is now 120s (docstring said 120, code used 300).
- Attendance donut is a small SVG component; Navbar styles are plain CSS.
- Emoji picker loads only when opened; Google Sign-In script loads only on screens with a Google button; `socket.io-client` loads only after sign-in; vendor libraries split into separately cached chunks.
- Default avatar, logo and banner converted from 3.7 MB of PNG to about 140 KB of WebP; third-party icon hotlinks replaced with local assets.
- Profile, followers/following and bookmark queries no longer load comment bodies; follower/following lists are capped at 500.
- Rate limits are counted in Redis, so every server instance shares one budget per client (previously each instance counted separately).
- Unexpected server errors return a generic message in production instead of the raw error text; unhandled promise rejections and uncaught exceptions are logged.
- `PUT /posts/reports` validates the status and report id and returns 404 for unknown reports.
- Prerendered public pages (landing, about, contact, privacy, terms) include the navbar and load their page code before React mounts, so they no longer flash to a spinner and back on first load.
- Timetable modals load on demand, cutting the dashboard bundle from ~113 KB to ~65 KB.
- Light mode: fixed near-invisible text on profile Student/Alumni badges, chat search highlights, the resource upload box and danger/red text; dark mode: fixed invisible comment-panel empty-state icons and forum timestamps. Status colours now come from shared `--danger-fg` / `--success-fg` / `--warning-fg` tokens.
- First-paint background colours match the app's canvas in both themes.
- Toasts moved from react-toastify to Sonner: stacked cards that expand on hover, swipe to dismiss, follow the light/dark theme, and use the app's colour tokens. Chat message toasts show the sender, a preview and an **Open** button.

### Performance
- Switching chats renders from an in-memory message cache kept current by the socket, and hovering a chat prefetches it.
- Chat bubbles load bubble-sized images and video poster frames instead of full originals and live `<video>` elements.
- Message rows are memoized with stable callbacks: typing in the composer, presence updates and new messages no longer re-render every message in the chat.

### Fixed
- Posts feed render loop while bookmarks were loading (a `= []` default recreated every render re-triggered an effect).
- Stale responses can no longer overwrite newer state on HelpForum, Resource, Profile, Saved, QuestionDetail and PostDetail.
- Comment models are registered before author population (previously relied on other modules importing `User` first).
- `WeeklyTimetableModal` test failed on Sundays (unanchored day-tab query also matched "Add Class to Sunday").
- `post.integration.test.js` mocked a `getFeed` export the service never had, hiding the feed route from tests.
- Prerender no longer interprets `$&`-style sequences in page content or JSON-LD.
- `/dashboard/resources` (old link) redirects to the Resource Hub instead of 404ing.
- Messages read while a chat was open were never saved as read, so chats came back unread after a reload and senders' ticks reverted to grey. Socket read receipts are now persisted, throttled, and only sent while the tab is visible.
- A recipient with a chat open received every message twice (chat room + personal room); it's now one emit.
- Deleting a chat's newest message left the sidebar showing the deleted text; the chat's last message is repointed and pushed live (`chat preview updated`).
- Bulk delete no longer claims to delete other people's messages that then reappear — yours are deleted, theirs are hidden for you.
- "typing…" no longer sticks when the other person closes their tab mid-message.
- In-chat search no longer crashes on `(`, `?` and other regex characters.
- Group messages turn blue only once every member has read them.
- The pinned-message banner loads older history to reach a pinned message that isn't on screen.
- Leaving the chat page no longer removes other components' socket listeners.
- Signing out clears the access token and cached chats/messages from the browser.
- Chat list rows are keyboard-accessible.

- Pinning and unpinning update instantly (optimistic, confirmed by the server and live `message pinned`/`unpinned` events) and unpinning works; pin icons are red and readable in light mode.
- Opening a chat no longer lands part-way up when images/videos finish loading after it was positioned.
- Scrolling up to load older messages keeps your place instead of throwing you down the chat: the chat list now does its own scroll anchoring (the message you're reading stays put when older messages, the loading row or images above it change height), identically in Chrome and Safari.
- The in-chat search field stretches the full width of the chat.
- The media lightbox covers the whole screen (it was clipped to the chat area) and closes with Esc.
- Removed the false "End-to-End Encryption" claim and the hard-coded "CSE" branch from contact details.

### Removed
- `chart.js`, `react-chartjs-2` and `styled-components` dependencies (about 200 KB of JavaScript); the embedded comment schema (`backend/models/comment.js`); the mock-only `post.repository.test.js` (superseded by real-database tests).
- The "Email Activity Digest — Coming Soon" setting (never implemented).
- Uploads' temporary folder is no longer served over HTTP.
- Dead code: unreachable `/dashboard/*` sub-views inside the dashboard page, an unused schedule trigger, the `ChatWindow` re-export, unused template assets.

## [1.7.0] - 2026-09-18

### Security
- **Server-authoritative chat sockets**: Socket.IO handshakes now require a valid, non-blacklisted access token, and chat mutations (send, edit, delete, react, pin, group changes) are broadcast by the server after the REST controller succeeds, instead of relaying client-emitted events. Unauthenticated socket connections are now rejected (behavioral change for any non-official client).
- Fixed NoSQL operator injection on auth endpoints, regex injection/ReDoS in search, stored XSS via `javascript:` resource/post URLs, and HTML injection in contact-form emails.
- Narrowed CORS to the production domains and this project's own Vercel deployments (previously any `*.vercel.app`).
- Stopped logging OTP values, fixed password-reset user enumeration, and invalidate sessions on password change/reset.
- Enforced a password policy (8+ characters with a letter and a number) on registration, change, and reset; registration previously accepted any password. Existing passwords are unaffected until changed.
- Upgraded `multer` to 2.x and removed unused `bcrypt`/`npm` dependencies, closing all open Dependabot alerts (142 to 0).
- Added a per-user rate limit (20/hour) on the paid Gemini timetable-upload endpoint, and stricter limits on OTP/login routes.
- Added security and cache headers via `vercel.json`.

### Added
- **Privacy Policy and Terms of Service pages** (`/privacy`, `/terms`), linked from the landing footer and the registration flow.
- **Build-time prerendering** of `/`, `/about`, `/contact`, `/privacy`, and `/terms` (plain React SSR, no headless browser), with complete Open Graph/Twitter meta so shared links preview correctly. Added `robots.txt` and `sitemap.xml`.
- User blocking (`/profile/block/:targetUserId`) enforced on direct messages, and admin resource verification endpoint.
- GitHub Actions CI (lint, test, build, `npm audit`), backend ESLint config, `.env.example` files, and repo docs: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and PR templates.

### Changed
- Socket auth recovers from token refresh: sockets re-read the access token on every reconnect and refresh once on an expired-token handshake rejection, via a shared single-flight refresh used by the axios interceptor as well.
- Production logging is console-only (Render's disk is ephemeral); file transports remain in development.
- Question detail pages cap populated answers at 300 per question, and reply-thread indentation stops compounding after 4 levels.
- Games page and mini-games restyled to the site's dark theme with mobile breakpoints; QuestionDetail is now mobile-responsive.
- Game cards now say "Single Player" instead of falsely advertising multiplayer.
- Resource list queries fixed for filter collisions and verification status; post votes use atomic updates; graceful shutdown on SIGTERM/SIGINT; DB connection failure now exits non-zero.

### Fixed
- Chat and presence no longer die after the access token refreshes mid-session.
- Anonymous visitors to `/games` no longer get a misleading "check if the server is running" alert.
- Conditional hook call in `ForwardMessageModal`, chat send button double-submit, and all ESLint errors in the frontend.
- Invalid user IDs in group member adds no longer cause a 500.

### Removed
- Dead files and code (`dummy.txt`, `test_cloudinary.js`, `original_posts.txt`, `dashboard.jsx`, an unused answers query) and the unused `socket.io` server package from the frontend.

## [1.6.4] - 2026-09-11

### Added
- **In-Profile Followers & Following Infrastructure**:
  - Added `getFollowers` and `getFollowing` controllers with `.lean()` projection (`username fullName avatar department year semester`) and registered public GET endpoints `/api/profile/:username/followers` and `/api/profile/:username/following`.
  - Added clickable followers and following count pills directly within the profile header glass card (`.profile-follow-counts-bar`).
  - Added dedicated in-profile "Followers" and "Following" tabs with responsive user grids, department chips, and one-click profile navigation.
- **WhatsApp-Style Double Tick Delivery**:
  - Implemented real-time `message delivered` socket broadcast when recipient is online on the platform.
  - Rendered double grey ticks (`tick-delivered`) when recipient is active on the website but hasn't read the chat yet, smoothly transitioning to cyan double blue ticks (`tick-read`) upon reading.
- **Global Cross-App Message Notifications**:
  - Routed message socket broadcasts to recipient personal rooms (`io.to(pId).emit("message received")`).
  - Implemented interactive notification toasts with direct-to-chat click navigation and unread chat navigation badges in `Layout.jsx`.
- **Modernized Media & Voice Note Messaging**:
  - Re-engineered chat attachment preview tray with thumbnail grids, file removal, and parallel uploads.
  - Built interactive voice note recording tray with live waveform animation, timer, and cancel controls.

### Changed
- **Unified Delivery Tick Sizing**:
  - Normalized glyph dimensions, baseline alignment, and container sizing (`14px`) for single (`done`) and double (`done_all`) ticks across both message bubbles and sidebar chat previews.
- **Instant Optimistic Reactions**:
  - Reduced reaction feedback latency to 0ms with immediate optimistic state updates and rollback safety.
  - Removed redundant reaction actions from message dropdown menus to preserve cleaner message bubble actions.
- **Streamlined Profile Admin Badge**:
  - Removed lightning emoji (`⚡`) prefix from admin badge, displaying clean role typography.
- **Pointer Cursor Accessibility**:
  - Enforced `cursor: pointer !important` on clickable profile stat cards and header counter buttons.

### Fixed
- Fixed missing message notifications when recipient was navigating pages outside the active chat conversation.
- Fixed attachment tray display and multipart payload handling in chat composer.
- Fixed voice note recording bottom bar disappearance during active recording sessions.

## [1.6.3] - 2026-09-11

### Added
- **Atomic Concurrency Operations**:
  - Implemented atomic MongoDB update queries (`findOneAndUpdate` with `$pull`, `$set`, and `$push`) for emoji reactions in `chat.repository.js`, eliminating concurrent write conflicts.
  - Added indexed boolean helper queries `isParticipant(chatId, userId)` and `chatExists(chatId)` for lightning-fast participant verification without full document population.
- **Bulk Deletion & Read State Real-Time Synchronization**:
  - Implemented single atomic `messages_bulk_deleted` socket event payload (`{ chatId, messageIds }`) bridging client and server without duplicate event storms.
  - Implemented real-time `messages_read` socket broadcast on `PUT /api/chat/message/read/:chatId` for instantaneous participant read receipts.
- **Robust Mobile Socket Connectivity**:
  - Re-registered user room presence upon socket `reconnect` events in `SocketContext.jsx`.
  - Adjusted WebSocket ping parameters to `pingTimeout: 20000ms` and `pingInterval: 25000ms` to prevent mobile disconnection loops during backgrounding and app switches.

### Changed
- **Parallel Multi-File Cloud Uploads**:
  - Refactored `sendMessage` in `chat.service.js` to upload attachments concurrently via `Promise.all` and persist messages in bulk with `createManyMessages`, reducing multi-image send times by up to 80%.
- **Bounded Sidebar Feed Ingestion**:
  - Constrained `findChatsByUser` queries with default `.limit(50)` to safeguard memory consumption and database bandwidth under scale.
- **Optimized Pinned Messages Payloads**:
  - Restricted `pinChatMessage` and `unpinChatMessage` responses to minimal deltas (`{ _id, pinnedMessages }`), eliminating redundant chat and participant population.
- Synchronized frontend and backend package versions to `v1.6.3`.

### Fixed
- **Authorization & Security Guarding Across Chat Routes**:
  - Secured message report moderation routes (`GET /api/chat/message/reports`, `PUT /api/chat/message/reports`) with `requireRole(["admin"])`.
  - Enforced server-side database lookup and chat participant checks in `reportMessage` to eliminate spoofed sender and content parameters.
  - Enforced chat membership authorization prior to room subscription in `socket.on("join chat")`.
  - Enforced caller authorization in `deleteMultipleMessages` and `markAsRead`.
  - Guarded `message updated` and `message reaction` socket events with sender and participant validation.
- **Socket Listener Churn on Chat Render**:
  - Wrapped `onUpdateLastMessage` callback with `useRef` in `useChatMessages.js`, stabilizing effect dependencies and preventing rapid socket listener teardown and re-registration.
- **Ghost Admin Persistence on Group Leave**:
  - Updated `leaveGroup` to purge the departing user from `groupAdmins` immediately when transferring primary admin rights to remaining admins.
- **Unindexed Database Query Scans**:
  - Corrected `searchMessagesInChat` text search fallback to prevent unindexed `$regex` full-collection scans when searches yield zero results.
- **Duplicate URL Param Effect**:
  - Removed redundant `useEffect` for `chatId` query parameter auto-selection in `ChatPage.jsx`.
- **Upload Route Restrictions**:
  - Configured 25MB file size limits and allowed MIME type filters across all chat upload middlewares.

## [1.6.2] - 2026-09-11

### Added
- **Multi-Admin Group Infrastructure**:
  - Added `groupAdmins` array to `Chat` MongoDB schema and repository queries with multi-admin population.
  - Implemented `promoteToAdmin` (`PUT /api/chat/group/promote`) and `demoteAdmin` (`PUT /api/chat/group/demote`) services and endpoints.
  - Added group admin badges, participant action dropdowns, and group avatar upload in `ChatInfoPanel.jsx`.
- **Persistent Manual Unread State**:
  - Implemented `manualUnreadIds` backed by `localStorage` (`linklet_manual_unread_${user._id}`) with dedicated "Mark as unread" / "Mark as read" toggle.
- **Linklet Chats Branded Empty State**:
  - High-res Linklet app squircle emblem with matching rounded curvature (`rounded-2xl` inside `rounded-[28px]`) and "Search a person to start chatting" prompt.

### Changed
- **Default Unselected Chat on Mount**:
  - Removed automatic fallback that previously auto-selected the first chat (`cachedChats[0]`) on desktop viewports, preserving a clean unselected sidebar state on reload and fresh visits.
- Synchronized frontend and backend package versions to `v1.6.2`.

### Fixed
- **Transition Flash of Group Sender Names**:
  - Added React `key={activeChat._id}` to `<ChatWindow>`, forcing instantaneous component teardown and remount when switching between 1:1 and group conversations.
  - Added lazy cache initialization and synchronous prop alignment in `useChatMessages` hook.
  - Implemented `isMessageForThisChat` guard in `MessageItem.jsx` and filtered `validMessages` in `ChatMessagesList.jsx` to eliminate foreign message rendering across transition frames.
- **False Unread Badge on Reload**:
  - Resolved race condition in `ChatPage.jsx` during auth rehydration where sent messages were misclassified as unread.
  - Enforced `isSentByMe` unread suppression on mount and updated state spreading order to guarantee clean recalculation.
- **Context Menu "Mark as Unread" Functionality**:
  - Eliminated rigid sender-ID guard in `ChatSidebar.jsx`, delegating directly to unread state to allow manual unread marking on any conversation.

## [1.6.1] - 2026-09-11

### Added
- **Modular Application-Level Chat Architecture**:
  - Decomposed the monolithic 1,850+ line `ChatWindow.jsx` into specialized subcomponents (`chat/header/`, `chat/messages/`, `chat/actions/`, `chat/composer/`, `chat/controls/`, `chat/modals/`).
  - Created isolated custom hooks: `useChatMessages` (message lifecycle, cache sync, real-time socket events, cursor pagination), `useVoiceRecorder` (MediaRecorder lifecycle, stream management, timer), `useAudioPlayback` (multi-audio player state and scrubbing), and `useInChatSearch` (search query, regex match indexing, smooth element jump).
- **WhatsApp-Grade Voice Notes & Waveform Player**:
  - In-chat audio player widget with Play/Pause button, waveform progress bar, elapsed scrubber, and duration labels.
  - Voice recording tray with live pulsing red indicator, elapsed timer, cancel/trash button, and send button.
- **In-Chat Message Search**:
  - Search bar in header with match counter (`2 of 5`) and Up/Down match navigation jumping directly to message elements.
  - Instant text highlighting using golden/violet match markers.
- **Pre-Send Attachment Preview Tray**:
  - Visual preview chips for images, videos, audio notes, and documents with file size badges and remove buttons before sending.
- **Real-Time WhatsApp Delivery & Read Ticks**:
  - Message state indicators: `schedule` (sending), `done` (sent), `done_all` (delivered), and glowing violet `tick-read` (read receipt).

### Changed
- Refactored `ChatWindow.jsx` into an ultra-clean backward-compatible facade with zero breaking changes for existing routes and test suites.
- Synchronized frontend and backend package versions to `v1.6.1`.
- Enhanced mobile full-screen chat container styling with `h-[100dvh]` and dedicated back navigation button.

### Fixed
- **Reaction Button Text Overlap**: Replaced absolute-positioned buttons inside the message bubble with an external WhatsApp-style hover action toolbar `[😊] [⌄]`, eliminating text overlap on long or short messages.
- **Context Menu & Reaction Picker Viewport Clipping**: Converted dropdowns to `position: fixed` with dynamic bounds checking, automatically popping DOWN when near the top header and popping UP when near the bottom composer.
- **Auto-Dismiss on Scroll**: Menus and reaction pickers now dismiss immediately when scrolling the chat container or clicking outside.

## [1.6.0] - 2026-09-11

### Added
- **Mobile Responsiveness Overhaul & Hamburger Navigation**:
  - Accessible top-left 3-line hamburger menu button (`#mobile-sidebar-toggle-btn`) in the header for viewports `< 768px`.
  - Glassmorphic slide-out navigation drawer with dark blur backdrop overlay, close button, and automatic dismissal on route change, backdrop click, or Escape key press.
  - Full mobile responsiveness across Dashboard, Daily Schedule, Attendance Tracker, Resource Library, Saved Collections, Profile, and Settings.
- **Dedicated Full-Screen Mobile Chat**:
  - Active chat window expands to full screen on mobile (`fixed inset-0 z-40 bg-gray-950 flex flex-col h-[100dvh]`), dedicating 100% of the screen to the active conversation.
  - Prominent top-left back button (`#chat-back-to-sidebar-btn`) with `arrow_back` icon, returning users cleanly to all chats.
  - Strict hiding of conversation sidebar on mobile while in an active chat (`display: none !important`).
- **Help Forum Mobile Categories & Card Layout Overhaul**:
  - Compact, horizontally swipeable category pills bar (`All`, `General`, `Academic`, `Tech`, etc.) replacing heavy desktop sidebar on mobile.
  - Full-width question title layout with word-break protection, completely eliminating title cutoff.
  - Dedicated status badges row (`Solved`, answer count) and top-aligned voting column.
  - Username ellipsis truncation protecting footer metadata from overflow.
- **Dropdown Viewport-Clamping Safety**:
  - Notifications, What's New release notes, and Profile dropdowns fixed within safe 12px margins (`fixed inset-x-3 top-[76px]`) on mobile screens, eliminating horizontal clipping.

### Changed
- Synchronized frontend and backend package versions to `v1.6.0`.
- Updated in-app release notes in `WhatsNewDropdown.jsx` to reflect `v1.6.0` highlights and GitHub release tag.

## [1.5.0] - 2026-09-10

### Added
- **Real-Time Notification Engine**:
  - Dedicated MongoDB notification model with compound indexes for instant unread counts and lean cursor pagination.
  - Multi-tier delivery: targeted Socket.IO push to user personal rooms with Redis caching (120s TTL).
  - App-wide trigger hooks for peer follows (`USER_FOLLOW`), forum upvotes (`FORUM_UPVOTE`), nested forum comments (`FORUM_COMMENT`), and administrator moderation notices (`SYSTEM_ALERT`).
  - Full REST API endpoints mounted at `/api/v1/notifications` for fetching, marking read, and deleting notifications.
- **Notification Dropdown & Navigation**:
  - Sleek dark glassmorphic dropdown with modern SVG outline bell and live unread count badge.
  - Contextual category icons, auto-updating relative timestamps, and one-click navigation to relevant forum discussions and feed posts.
- **Production-Grade Release Notes & Rollout Engine**:
  - Version-based `localStorage` tracking (`linklet_last_seen_version`) replacing arbitrary wall-clock timers.
  - Header announcement pill (`What's New v1.5`) displayed only while unread, cleanly disappearing upon view or dismissal.
  - Permanent access to release notes from the Avatar dropdown (with unread `New` indicator) and clickable sidebar version badge (`v1.5.0`).
  - Three-way mutual exclusivity guaranteeing only one dropdown menu opens at a time.

### Changed
- Synchronized backend and frontend package versions to `v1.5.0`.
- Harmonized avatar profile dropdown border outline, elevation shadows, and backdrop blur with the notification dropdown.
- Refined settings notification preferences to use clean, switch-only toggles.

## [1.4.0] - 2026-09-10

### Added
- **Production-Grade Administration & Governance Suite**:
  - Live platform KPI analytics (students, library resources, community posts & forum discussions, system admins) with Redis caching (60s TTL).
  - User Directory with debounced institutional search, role filtering, department filtering, and pagination.
  - Role management: seamless student promotion to administrator and administrator demotion.
  - Admin Self-Lockout Prevention: Guaranteed platform continuity by preventing administrators from demoting or suspending their own accounts.
- **Universal Admin Moderation & Deletion**:
  - Added feed post comment deletion endpoint (`DELETE /api/v1/posts/:postId/comments/:commentId`) with author and administrator authorization.
  - App-wide universal deletion across feed posts, post comments, forum questions, answers, nested comments, and academic library resources.
  - In-Dashboard **Platform Oversight** tab for direct one-click moderation of recent resources, questions, and posts.
- **Account Suspension & Ban System**:
  - `isBanned` and `banReason` fields in user schema backed by `{ email: 1, isBanned: 1 }` compound index.
  - `isLoggedIn` middleware enforcement returning `403 Forbidden` with the custom administrative suspension reason.
  - Suspend and Reactivate controls with suspension reason modal in the User Directory table.
- **Security & Administrative Audit Trail**:
  - Dedicated `AuditLog` collection tracking actor, action, target type, target ID, metadata details, and timestamps with compound query indexes.
  - Dedicated **Security & Audit Trail** tab in Admin Dashboard with human-readable activity badges and pagination.
- **One-Click Quick Seed MNNIT Departments**:
  - `POST /api/v1/branches/seed-defaults` endpoint to bulk-upsert all 9 standard MNNIT Allahabad engineering departments.
  - Smart initial-setup button in Academic Departments tab that only renders when 0 departments exist.

### Changed
- Refactored user table: separated combined `Role & Status` cell into two dedicated, industry-standard columns (**Role** and **Status**), matching production standards from Stripe, GitHub, and Clerk.
- Cleaned up user table rows by removing redundant green verified tick icons from institutional emails.
- Synchronized backend and frontend package versions to `v1.4.0`.

### Fixed
- Fixed search icon and placeholder text collision on Admin Dashboard by implementing dedicated `.admin-search-wrapper` and explicit left padding.
- Replaced raw JSON strings in audit log table with formatted, color-coded activity representations.
- Enhanced modal usability with backdrop click dismissals and desktop close buttons.
