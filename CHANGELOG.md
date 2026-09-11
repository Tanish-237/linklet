# Changelog

All notable changes to the Linklet platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
