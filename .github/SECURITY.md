# Security Policy

## Security Architecture

Leaf is a **desktop-only application** with local-first architecture, which provides enhanced security:

- ✅ **No server-side code** - No backend vulnerabilities
- ✅ **Local-only storage** - Notes stored as plain text files on user's computer
- ⚠️ **Limited network requests** - Network is only used to download AI models from Hugging Face on demand; no note data is ever transmitted
- ✅ **No encryption needed** - Files are standard text files accessible to user
- ✅ **No telemetry** - No tracking or analytics
- ✅ **Open source** - Fully auditable code

## Data Privacy

Your notes are stored in the vault folder you choose. App settings are stored locally at:

- **macOS:** `~/Library/Application Support/leaf/`
- **Windows:** `%APPDATA%/leaf/`
- **Linux:** `~/.config/leaf/`

Your notes (.txt, .md, .rtf files) never leave your device.

## Reporting a Vulnerability

**Do not open a public issue.** Leaf has no auto-update — installed copies stay on whatever version
the user downloaded until they choose to replace it. A public report is therefore a working
disclosure against every existing install, and unlike a web app there is no way to push the fix out.

Report privately through [GitHub Security Advisories](https://github.com/larrydarko1/leaf/security/advisories/new).
That opens a channel visible only to the maintainer, and it is the same place the fix and the CVE are
coordinated from.

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

Expect an acknowledgement within a week. Leaf is maintained by one person, so a fix timeline depends
on severity; you will be told which release carries the fix, and credited in it unless you ask not to
be.

## Scope

In scope: anything reachable in the Electron app or its IPC surface — preload bridge escapes, path
traversal out of the vault, renderer code execution through note content, and tampering with the
model download path.

Out of scope: findings that require an attacker to already have the user's filesystem or OS account.
Notes are plain files with the user's own permissions by design, so "another local process can read
the vault" is the threat model working as intended, not a vulnerability.

Dependency advisories with no reachable path in Leaf's code are tracked in
[SECURITY_EXCEPTIONS.md](SECURITY_EXCEPTIONS.md) rather than reported as vulnerabilities.

## Supported Versions

Security issues are fixed in the latest release only. There are no backports — upgrade is the
remediation path.

## Security Best Practices for Users

- Keep the app updated to the latest version
- Regularly backup your vault folder
- Only download from official releases
- Store sensitive notes in encrypted volumes if needed (OS-level encryption)
