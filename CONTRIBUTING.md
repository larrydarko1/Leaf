# Contributing to Leaf

Thank you for considering contributing to Leaf! This is a desktop note-taking application built with Electron and Vue 3.

## Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```sh
   git clone https://github.com/larrydarko1/leaf.git
   cd leaf
   ```
3. **Install dependencies**
   ```sh
   npm install
   ```
4. **Start the development environment**
   ```sh
   npm run dev
   ```

This will launch the Electron app with hot reload enabled.

## Project Structure

```
leaf/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry point, window creation, protocol
│   │   ├── lib/
│   │   │   ├── extensions.ts       # Allowed file extensions list
│   │   │   ├── mime.ts             # MIME type mappings
│   │   │   └── paths.ts            # Default paths (models dir, whisper dir)
│   │   └── services/
│   │       ├── agent.ts            # Agent mode file editing with backup/restore
│   │       ├── ai.ts               # Local LLM inference (node-llama-cpp)
│   │       ├── conversation.ts     # Conversation persistence (JSON storage)
│   │       ├── fs.ts               # File system operations & watcher
│   │       ├── hf-download.ts      # Hugging Face model search & download
│   │       ├── media.ts            # Audio recording & spellcheck
│   │       └── speech.ts           # Local Whisper speech-to-text
│   ├── preload/
│   │   └── index.ts                # Secure bridge between main & renderer
│   └── renderer/                   # Vue 3 frontend
│       ├── index.html              # Entry HTML
│       ├── main.ts                 # Vue bootstrap
│       ├── App.vue
│       ├── style.scss
│       ├── assets/                 # App icons and images
│       ├── components/
│       │   ├── AiPanel.vue         # AI chat interface with conversation history
│       │   ├── AudioRecorder.vue   # Voice recording and audio capture
│       │   ├── BookmarksPanel.vue  # Bookmarked notes panel
│       │   ├── ContextMenu.vue     # Right-click context menu
│       │   ├── DrawingCanvas.vue   # Freehand drawing canvas
│       │   ├── FileExplorer.vue    # Vault file browser with drag & drop
│       │   ├── FolderNode.vue      # Tree node for folder/file rendering
│       │   ├── NoteEditor.vue      # Editor with Markdown preview & media embeds
│       │   └── SearchPanel.vue     # Full-text search across vault
│       ├── composables/            # Vue composables (grouped by domain)
│       │   ├── ai/                 # AI chat, model, agent, history, downloads
│       │   ├── drawing/            # Canvas rendering, elements, interaction
│       │   ├── editor/             # Markdown editor, media players, dictation
│       │   ├── ui/                 # Context menu, keyboard navigation
│       │   └── vault/              # File selection, folder tree, bookmarks
│       ├── types/                  # TypeScript type definitions
│       └── utils/                  # Shared utilities
├── models/
│   └── whisper/                    # Whisper ONNX model (download manually — see README)
├── public/                         # Static assets (demo screenshot)
├── build/                          # App icons & packaging hooks for Electron Builder
├── electron.vite.config.ts         # electron-vite config (main, preload, renderer)
├── package.json
├── tsconfig.json                   # Root TS config (project references)
├── tsconfig.app.json               # Renderer TS config (DOM + Vue)
├── tsconfig.node.json              # Main & preload TS config (Node)
└── generate-icons.sh               # Icon generation script
```

## How to Contribute

### Bug Fixes & Features
- Create a new branch for your feature or bugfix
  ```sh
  git checkout -b feature/your-feature-name
  ```
- Make your changes with clear commit messages
- Test your changes in the Electron app
- Open a pull request describing your changes

### Testing
- Test the desktop app on your platform (macOS, Windows, or Linux)
- Verify vault creation and file reading
- Test with different file formats

## Code Style
- Use consistent formatting
- Write clear, descriptive comments where necessary
- Follow existing patterns in the codebase
- Keep components small and focused

## Reporting Issues
- Use GitHub Issues for bugs and feature requests
- Provide steps to reproduce bugs if possible
- Include your OS version and Electron app version
- Screenshots are helpful!

## Code of Conduct
Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?
Feel free to open a discussion or issue if you need help!
