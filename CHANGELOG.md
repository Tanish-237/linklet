# Changelog

All notable changes to the Linklet platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
