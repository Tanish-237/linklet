# Contributing to Linklet

Thanks for wanting to contribute — Linklet is built by MNNIT students, for MNNIT students, and outside contributions are genuinely welcome, whether you're fixing a bug, adding a feature, or improving docs.

## Before you start

- **Discuss non-trivial changes first.** Open an issue describing what you want to build before writing code, especially for new features or anything touching auth, chat, or the database schema. This avoids wasted work if the direction doesn't fit.
- **Check existing issues/PRs** to avoid duplicate work.

## Development setup

Follow the [Getting Started](README.md#getting-started) section in the README to get both the backend and frontend running locally. You'll need MongoDB and (optionally, for full functionality) Redis running locally or accessible via a connection string.

## Making a change

1. Fork the repo and create a branch from `main`: `git checkout -b fix/short-description` or `feat/short-description`.
2. Make your change. Keep it scoped — a bug fix shouldn't also refactor unrelated code.
3. **Add or update tests.** Every shipped feature, API route, or page in this codebase ships with tests (Jest on the backend, Vitest on the frontend). A PR that changes behavior without a test covering it will be asked to add one.
4. Run both test suites and lint before opening a PR:
   ```bash
   cd backend && npm test && npm run lint
   cd frontend && npx vitest run && npm run lint
   ```
5. Commit with a clear, descriptive message (see [Commit style](#commit-style) below).
6. Push and open a PR against `main`. Describe *what* changed and *why* — not just what files were touched.

## Commit style

- Use present-tense, descriptive commit subjects: `fix: prevent double-submit on chat composer`, not `fixed bug`.
- Prefix with `fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, or `test:` where it fits — this repo's history already follows this loosely, keep it consistent.
- Keep commits focused; don't bundle unrelated changes.

## Code style

- Both packages are linted with ESLint (`npm run lint` in `backend/` and `frontend/`) — CI will block on lint errors.
- Match the existing patterns in the file you're editing (e.g. this codebase's backend uses a layered `routes → controllers → services → repositories → models` architecture; don't reach into a repository directly from a controller).
- Frontend UI should match the site's existing dark theme (zinc/violet palette, see any page under `frontend/src/pages/static/` for the convention) and work at mobile widths — this project has been burned before by pages that only looked right on desktop.

## Reporting bugs / requesting features

Use the issue templates — they ask for the context that's actually needed to act on a report (repro steps for bugs, the problem being solved for feature requests).

## Security issues

**Do not open a public issue for a security vulnerability.** See [SECURITY.md](SECURITY.md) for how to report it privately.

## Questions

If something in this doc doesn't cover your situation, open an issue or reach out via the [Contact page](https://linklet.org/contact).
