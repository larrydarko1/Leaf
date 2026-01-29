# Leaf 🍃

![License](https://img.shields.io/github/license/larrydarko1/leaf)
![Issues](https://img.shields.io/github/issues/larrydarko1/leaf)
![Pull Requests](https://img.shields.io/github/issues-pr/larrydarko1/leaf)

Leaf is a **local-first, privacy-focused note-taking app** for desktop built with **Electron**, **Vue 3**, and TypeScript. Inspired by Obsidian, Leaf provides a clean, distraction-free environment for managing your notes. All your data stays on your device - no cloud, no database, no tracking.

> **IMPORTANT:** This app runs natively on **Desktop** (macOS, Windows, Linux). All notes are stored in your local vault folder and never leave your device.

## Features

### Note Management
- **Vault-based system** - Create or import a folder as your vault
- **Multi-format support** - Read and edit `.txt`, `.md`, and `.rtf` files
- **File browser** - Navigate your notes with an intuitive file tree
- **Quick search** - Find notes instantly across your vault
- **Live preview** - Markdown rendering for `.md` files

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

## Data Storage

Your notes are stored exactly where you choose:

### Vault Location
- You select the folder location when creating/importing a vault
- Common locations:
  - **macOS:** `~/Documents/Notes/`, `~/Desktop/MyVault/`
  - **Windows:** `C:\Users\YourName\Documents\Notes\`, `D:\MyVault\`
  - **Linux:** `~/Documents/Notes/`, `~/notes/`

### App Settings
- **macOS:** `~/Library/Application Support/leaf/`
- **Windows:** `%APPDATA%/leaf/`
- **Linux:** `~/.config/leaf/`

> **Note:** Your vault folder can be anywhere on your system. Use it with other apps, back it up to external drives, sync with git - it's just files!

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

#### Desktop Development
```sh
# Start the Electron app in development mode
npm run dev:electron
```

This will:
- Start Vite dev server on http://localhost:3000
- Launch the Electron desktop app
- Enable hot reload for development

#### Mobile Development

See [MOBILE.md](MOBILE.md) for complete mobile development guide.

**Quick Start:**
```sh
# Build and sync to mobile platforms
npm run build:mobile

# Open in native IDEs
npm run cap:open:ios      # Requires macOS + Xcode
npm run cap:open:android  # Requires Android Studio

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
- **Storage:** Plain text files (txt, md, rtf) + JSON for app settings
- **Build Tools:** Vite + Electron Builder

## Project Structure

```
leaf/
├── electron/
│   ├── main.cjs           # Electron main process
│   ├── preload.cjs        # Secure bridge between main/renderer
│   └── storage.cjs        # File system operations
├── src/
│   ├── components/        # Vue components
│   ├── store/             # Storage adapters
│   │   ├── adapters/
│   │   │   ├── electron.ts    # Electron storage adapter
│   │   │   └── factory.ts     # Storage factory
│   │   ├── index.ts
│   │   └── types.ts
│   ├── App.vue
│   ├── main.ts
│   └── style.scss
├── build/                 # App icons
├── package.json
└── vite.config.ts
```

## Roadmap

### Current Features
- [x] Electron desktop app foundation
- [x] Local-first architecture
- [x] Dark theme
- [x] Multi-language support

### Planned Features
- [ ] Vault management (create/import folder)
- [ ] File browser with tree view
- [ ] Markdown editor with live preview
- [ ] TXT and RTF file support
- [ ] Full-text search across vault
- [ ] Tags and organization
- [ ] Wikilinks support (`[[note]]`)
- [ ] Graph view of note connections
- [ ] Export/import vault
- [ ] Keyboard shortcuts

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments
- Inspired by [Obsidian](https://obsidian.md/) for the vault-based note-taking approach
- Built with ❤️ for privacy-conscious note-takers

---

**Made with Vue 3, Electron, and a passion for local-first software.**
