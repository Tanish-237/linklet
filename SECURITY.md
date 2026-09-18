# Security Policy

Linklet handles institutional email addresses, private chat messages, and academic records for MNNIT Allahabad students. Taking security reports seriously is non-negotiable.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.** Public disclosure before a fix ships puts real student data at risk.

Instead, report it privately using one of these:

1. **GitHub Private Vulnerability Reporting** (preferred): open the [Security tab](../../security/advisories/new) on this repository and use "Report a vulnerability." This creates a private advisory only the maintainers can see.
2. **Email**: [founderslinklet@gmail.com](mailto:founderslinklet@gmail.com) with a clear subject line (e.g. `[SECURITY] <short description>`).

### What to include

- A description of the vulnerability and its potential impact.
- Steps to reproduce it (a minimal repro is enormously helpful).
- Which part of the system is affected (frontend, backend API, socket layer, a specific dependency, etc.).

### What to expect

- Acknowledgement of your report as soon as possible.
- We'll investigate, confirm the issue, and work on a fix. We'll keep you updated on progress where practical.
- Once a fix ships, we'll credit you in the release notes (unless you'd prefer to stay anonymous — just let us know).

## Scope

This policy covers the Linklet codebase in this repository and its production deployment at [linklet.org](https://linklet.org). It does not cover third-party services Linklet depends on (MongoDB Atlas, Cloudinary, Render, Vercel, Google OAuth) — please report issues in those directly to the respective vendor.

## Supported versions

Linklet is deployed continuously from `main`. Only the latest deployed version is supported; there are no maintained older release branches.
