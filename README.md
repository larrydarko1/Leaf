# Leaf 

![License](https://img.shields.io/github/license/larrydarko1/leaf)
![Issues](https://img.shields.io/github/issues/larrydarko1/leaf)
![Pull Requests](https://img.shields.io/github/issues-pr/larrydarko1/leaf)

Leaf is a **local-first, privacy-focused note-taking app** for desktop built with **Electron**, **Vue 3**, and TypeScript. Inspired by Obsidian, Leaf provides a clean, distraction-free environment for managing your notes. All your data stays on your device - no cloud, no database, no tracking.

> **IMPORTANT:** This app runs natively on **Desktop** (macOS, Windows, Linux). All notes are stored in your local vault folder and never leave your device.

## Features

### Note Management
- **Vault-based system** - Select any folder as your vault
- **Multi-format support** - Read and edit `.txt`, `.md`, and `.rtf` files
- **File browser** - Navigate your notes with a simple file list
- **Auto-save** - Changes save automatically as you type

### Privacy & Storage
- **100% Offline** - Works completely without internet connection
- **Local-only** - Notes never leave your device
- **User-accessible files** - Direct access to your vault folder
- **No database** - Plain text files you can open anywhere
- **No tracking** - Zero telemetry or data collection

### Design
- **Obsidian-inspired UI** - Clean, familiar interface
- **Dark mode** - Easy on the eyes
- **Distraction-free** - Focus on your writing

## Security & Privacy

Leaf is built with privacy and security as core principles:

### Privacy Guarantees
- **No telemetry** - We don't collect any usage data, analytics, or crash reports
- **No network requests** - The app works 100% offline and makes zero external connections
- **No cloud sync** - Your notes never leave your device unless you explicitly copy them
- **No accounts** - No sign-ups, logins, or user tracking of any kind

### Security Architecture
- **Sandboxed renderer** - Context isolation prevents unauthorized system access
- **Local file system only** - File operations are limited to your selected vault folder
- **No remote code execution** - All code runs locally on your device
- **Open source** - Full transparency - audit the code yourself

### Reporting Security Issues
If you discover a security vulnerability, please open an issue on the [GitHub repository](https://github.com/larrydarko1/leaf/issues). 

## Data Storage

### Your Notes
Your notes are stored exactly where you choose - simply select any folder on your system as your vault. Common locations:
- **macOS:** `~/Documents/Notes/`, `~/Desktop/MyVault/`
- **Windows:** `C:\Users\YourName\Documents\Notes\`, `D:\MyVault\`
- **Linux:** `~/Documents/Notes/`, `~/notes/`

> **Note:** Your vault folder can be anywhere on your system. Use it with other apps, back it up to external drives, sync with git - it's just plain text files!

### App Settings
Leaf stores minimal app preferences (like your last opened folder path) automatically. No configuration needed.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Setup

1. **Clone the repository**
```sh
git clone https://github.com/larrydarko1/leaf.git
cd leaf
```

2. **Install dependencies**
```sh
npm install
```

3. **Run in development mode**
```sh
npm run dev:electron
```

### Building for Production

```sh
# Build for your current platform
npm run build:electron

# Build specifically for macOS
npm run build:mac

# Build for Windows (requires Windows or cross-compilation setup)
npm run build:win

# Build for Linux
npm run build:linux
```

The built installers will be in the `dist-electron/` directory:
- **macOS:** `.dmg` installer
- **Windows:** `.exe` installer (NSIS)
- **Linux:** `.AppImage` file

### Installing the App

After building:
1. Navigate to `dist-electron/`
2. Double-click the installer for your platform
3. Follow installation prompts
4. Launch "Leaf" from your Applications folder

## Tech Stack
- **Desktop:** Electron (Native macOS, Windows, Linux app)
- **Frontend:** Vue 3, TypeScript, Vite, SCSS
- **Storage:** Plain text files (txt, md, rtf) in your local vault
- **Build Tools:** Vite + Electron Builder

## Project Structure

```
leaf/
├── electron/
│   ├── main.cjs           # Electron main process
│   └── preload.cjs        # Secure bridge between main/renderer
├── src/
│   ├── components/
│   │   ├── FileExplorer.vue
│   │   └── NoteEditor.vue
│   ├── types/
│   │   └── electron.d.ts
│   ├── App.vue
│   ├── main.ts
│   └── style.scss
├── build/                 # App icons
├── package.json
└── vite.config.ts
```

## Roadmap

### Current Features
- [x] Electron desktop app
- [x] Local-first architecture
- [x] Dark theme
- [x] Folder selection for vault
- [x] File browser with list view
- [x] Text editor with auto-save
- [x] Create and delete files
- [x] `.txt`, `.md`, and `.rtf` file support
- [x] Keyboard shortcuts (Cmd/Ctrl+S to save)

### Planned Features
- [ ] Markdown live preview
- [ ] Full-text search across vault
- [ ] Tree view for nested folders
- [ ] Tags and metadata
- [ ] Wikilinks support (`[[note]]`)
- [ ] Graph view of note connections
- [ ] Light theme
- [ ] More keyboard shortcuts

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments
- Inspired by [Obsidian](https://obsidian.md/) for the vault-based note-taking approach

---

**Made with Vue 3, Electron, and a passion for local-first software.**
