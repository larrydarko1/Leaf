# Security Policy

## Security Architecture

Leaf is a **desktop-only application** with local-first architecture, which provides enhanced security:

- ✅ **No server-side code** - No backend vulnerabilities
- ✅ **Local-only storage** - Notes stored as plain text files on user's computer
- ✅ **No network requests** - No data transmission risks
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

If you discover a security vulnerability in the Electron app or client-side code, please report it by:

1. Opening a GitHub issue with the label `security`
2. Or emailing the maintainer directly (for sensitive issues)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

## Supported Versions

Security issues will be addressed in the latest major release. Older versions may not receive updates.

## Security Best Practices for Users

- Keep the app updated to the latest version
- Regularly backup your vault folder
- Only download from official releases
- Store sensitive notes in encrypted volumes if needed (OS-level encryption)
