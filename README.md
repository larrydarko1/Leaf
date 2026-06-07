# leaf.

![Issues](https://img.shields.io/github/issues/larrydarko1/leaf)
![Pull Requests](https://img.shields.io/github/issues-pr/larrydarko1/leaf)

If you find Leaf useful, consider [giving it a star ⭐](https://github.com/larrydarko1/leaf) — it helps others discover the project!

Leaf is a **local-first, privacy-focused note-taking app** for desktop built with **Electron**, **Vue 3**, and TypeScript. Inspired by [Obsidian](https://obsidian.md) and [LM Studio](https://lmstudio.ai), Leaf provides a clean, distraction-free environment for managing your notes with local AI capabilities. All your data stays on your device - no cloud, no database, no tracking.

> **IMPORTANT:** This app runs natively on **Desktop** (macOS, Windows, Linux). All notes are stored in your local vault folder and never leave your device.

# Demo

![Leaf Demo](./public/demo.png)

## Features

### Note Management

- **Vault-based system** - Select any folder as your vault
- **Multi-format support** - Read and edit `.txt` and `.md` (Markdown) files
- **Image support** - View images directly in the app (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`)
- **Video support** - Play videos directly in the app (`.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`, `.mkv`)
- **Audio support** - Play audio files directly in the app (`.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.ogg`, `.wma`, `.aiff`)
- **Audio recording** - Record voice notes directly in the app and save as `.wav` files to your vault
- **Speech-to-text dictation** - Dictate into `.txt` and `.md` files using local Whisper speech recognition — no cloud, no API keys
- **File browser** - Navigate your notes with a tree-based folder structure
- **Obsidian-style media embeds** - Use `![[image.png]]` syntax in Markdown to embed images, videos, audio, and PDFs inline — fully interoperable with Obsidian vaults
- **Drag & drop embed** - Drag media files from the file explorer onto a Markdown note to automatically insert embed syntax
- **Drag & drop organization** - Move files between folders with drag and drop
- **Folder nesting** - Organize folders by dragging them into other folders
- **Auto-save** - Changes save automatically as you type

### AI Assistant (Local LLM)

- **100% local inference** - Run AI models directly on your machine, no cloud or API keys needed
- **In-app model download** - Search and download GGUF models directly from Hugging Face without leaving the app
- **Smart model info** - See file size, quantization type, estimated RAM usage, and size tier badges before downloading
- **Chat interface** - Built-in chat panel with streaming responses
- **Conversation history** - All chats are automatically saved as JSON and can be browsed, loaded, renamed, or deleted
- **Conversation restore** - Reloading a model or switching conversations automatically restores context so the AI remembers what you discussed
- **Auto context compaction** - When token memory reaches 90%, the AI automatically summarizes the conversation and frees context space — no data is lost, all messages stay visible
- **Note-aware context** - Toggle to include the current note as context for AI queries
- **Editable system prompts** - Pick from bundled templates or hand-edit Markdown files in `~/.leaf/prompts/` to customise the AI’s personality and behaviour
- **Agent mode** - Let the AI read and edit your currently open file directly, with built-in version control (approve or revert every change)
- **Model management** - Load and unload GGUF models from a dedicated models folder (`~/.leaf/models/`)
- **GPU accelerated** - Automatically uses Metal (macOS), CUDA (NVIDIA), or Vulkan for fast inference
- **Powered by llama.cpp** - Uses [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) bindings to [llama.cpp](https://github.com/ggml-org/llama.cpp) (both MIT licensed)

### Privacy & Storage

- **Offline-first** - AI inference, dictation, and notes all run locally; internet is only used to download models on demand
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
- **Minimal network requests** - The only external connection is optional model downloads from Hugging Face; no note data or usage data is ever transmitted
- **No cloud sync** - Your notes never leave your device unless you explicitly copy them
- **No accounts** - No sign-ups, logins, or user tracking of any kind
- **Local AI** - AI inference runs entirely on your hardware; no data is sent to any server

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

### AI Models

Leaf stores AI models in `~/.leaf/models/`. To get started with the AI assistant:

1. Open the AI panel by clicking the lightbulb icon in the sidebar
2. Click the **download** icon in the toolbar to open the Hugging Face download panel
3. Search for a model (e.g. "llama 3.2", "phi", "qwen") and browse available GGUF files
4. Check the **size tier badge** and **estimated RAM** to make sure it fits your machine
5. Click the download button — the model is saved directly to `~/.leaf/models/`
6. Select and load the model from the dropdown in the AI panel

> **Tip:** You can also manually place `.gguf` files in `~/.leaf/models/` or click the folder icon to open the directory.

> **Migrating from older versions:** If you previously stored models in `~/leaf-models/`, Leaf automatically moves them to `~/.leaf/models/` on first launch. No action required.

### Using Agent Mode

Agent mode lets the AI edit your files directly with a safety net:

1. Open a file in the editor
2. Open the AI panel and load a model
3. Click the **Agent mode** button (code brackets icon) in the toolbar — the indicator shows the current file name
4. Ask the AI to make changes (e.g. "add a table of contents" or "refactor the second paragraph")
5. The AI proposes edits shown as inline diff cards with **Approve** and **Reject** buttons
6. **Approve** keeps the change permanently; **Reject** reverts the file to its original content

> Agent mode only operates on the currently open file and is scoped to your vault folder for security.

### Customising the System Prompt

Leaf ships a small library of system-prompt templates as Markdown files. The active prompt is sent to the model on every load / chat reset, shaping its tone and behaviour.

1. Open the AI panel and click the **chat-bubble icon** in the toolbar — the dropdown lists every template in `~/.leaf/prompts/` with its name and description, and a checkmark on the active one.
2. Click any template to make it active.
3. Click the folder icon to edit templates in your preferred editor.

The templates folder lives at `~/.leaf/prompts/`. Each `*.md` file is one template:

```markdown
---
name: Coding Assistant
description: Focused on programming questions, code review, and refactoring
---

You are a senior software engineer assisting inside a note-taking app.
...
```

- The `---` frontmatter block (`name`, `description`) is optional and used only by the picker UI; it's stripped before being sent to the model.
- Drop new `.md` files into the folder to add your own templates — they appear automatically.
- Bundled defaults (`default.md`, `coding.md`, `writing.md`) are seeded on first launch and never overwritten if you've edited them.

### Using Dictation (Speech-to-Text)

Leaf includes a built-in speech-to-text feature powered by [Whisper](https://github.com/openai/whisper) running 100% locally via ONNX:

1. Open any `.txt` or `.md` file in the editor
2. Click the **microphone icon** in the bottom-right corner of the editor
3. On first use, the Whisper model loads from disk (a few seconds)
4. Speak naturally — your speech is transcribed and appended to the file every ~5 seconds
5. Click the microphone again to stop dictation

> **The Whisper ONNX model files are not included in this repository.** Before using dictation you need to download them manually — see the [setup step](#speech-to-text-model-setup) below.

#### Speech-to-Text Model Setup

The app uses [`Xenova/whisper-tiny.en`](https://huggingface.co/Xenova/whisper-tiny.en) from Hugging Face. Download the two required ONNX files and place them at the exact paths shown:

```
models/whisper/Xenova/whisper-tiny.en/onnx/encoder_model.onnx
models/whisper/Xenova/whisper-tiny.en/onnx/decoder_model_merged.onnx
```

Download links (right-click → Save Link As):

- [`encoder_model.onnx`](https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder_model.onnx)
- [`decoder_model_merged.onnx`](https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/decoder_model_merged.onnx)

Or via `curl`:

```sh
mkdir -p models/whisper/Xenova/whisper-tiny.en/onnx
curl -L -o models/whisper/Xenova/whisper-tiny.en/onnx/encoder_model.onnx \
  https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder_model.onnx
curl -L -o models/whisper/Xenova/whisper-tiny.en/onnx/decoder_model_merged.onnx \
  https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/decoder_model_merged.onnx
```

Once the files are in place, dictation works fully offline — no cloud or API keys needed.

Recommended models for getting started:
| Model | Size | RAM Needed | Best For |
|-------|------|------------|----------|
| Llama 3.2 1B Q4 | ~0.7 GB | ~2 GB | Fast, lightweight tasks |
| Llama 3.2 3B Q4 | ~2 GB | ~4 GB | Good balance of speed and quality |
| Phi-3 Mini 3.8B Q4 | ~2.3 GB | ~4 GB | Strong reasoning |
| Llama 3.1 8B Q4 | ~4.5 GB | ~8 GB | Best quality |

### App Settings

Leaf stores minimal app preferences (like your last opened folder path) automatically. No configuration needed.

### Conversation History

AI conversations are automatically saved as JSON files in Electron's standard `userData` directory:

- **macOS:** `~/Library/Application Support/Leaf/conversations/`
- **Windows:** `%APPDATA%\Leaf\conversations\`
- **Linux:** `~/.config/Leaf/conversations/`

Each conversation is stored as a separate `.json` file containing the model used, timestamps, and the full message history. Conversations are auto-titled from the first message and can be renamed or deleted from the history panel.

## Getting Started

### Prerequisites

- Node.js (v24+ recommended)
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
npm run dev
```

### Testing & Code Quality

```sh
# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Lint source code
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Check formatting
npm run format:check

# Auto-format source code
npm run format
```

Tests live in the `tests/` directory and mirror the `src/` structure. The CI pipeline runs type-checking, building, and all tests on every push and pull request — the release pipeline only triggers if CI passes.

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

- **Desktop:** [Electron](https://www.electronjs.org) (Native macOS, Windows, Linux app)
- **Frontend:** [Vue 3](https://vuejs.org), TypeScript, SCSS
- **Editor:** [CodeMirror 6](https://codemirror.net) with [Lezer](https://lezer.codemirror.net) markdown grammar (live preview, inline widgets, keyboard shortcuts)
- **AI:** [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) + [llama.cpp](https://github.com/ggml-org/llama.cpp) (local LLM inference)
- **Speech-to-Text:** [Whisper](https://github.com/openai/whisper) via [@huggingface/transformers](https://github.com/huggingface/transformers.js) + ONNX Runtime (local dictation)
- **Storage:** Plain text files (txt, md), images, videos, audio, and embedded media in your local vault
- **Build Tools:** [electron-vite](https://electron-vite.org) + [Electron Builder](https://www.electron.build)
- **Testing:** [Vitest](https://vitest.dev) + [Vue Test Utils](https://test-utils.vuejs.org)
- **Linting:** [ESLint](https://eslint.org) (flat config) + [typescript-eslint](https://typescript-eslint.io) + [Prettier](https://prettier.io)
- **Git Hooks:** [Husky](https://typicode.github.io/husky) + [lint-staged](https://github.com/lint-staged/lint-staged) + [commitlint](https://commitlint.js.org) (Conventional Commits)

## Project Structure

```
leaf/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry, BrowserWindow, leaf:// protocol, IPC wiring
│   │   ├── lib/
│   │   │   ├── extensions.ts       # Allowed file extension sets for vault scanning
│   │   │   ├── logger.ts           # electron-log wrapper; rotating file logger
│   │   │   ├── mime.ts             # MIME type maps for images, audio, video, PDF
│   │   │   ├── paths.ts            # App path constants: LEAF_HOME, models, prompts, themes
│   │   │   └── validation.ts       # Path-traversal & filename safety checks for IPC
│   │   └── services/
│   │       ├── agent.ts            # AI file editing with backup/restore version control
│   │       ├── ai.ts               # Local LLM inference via node-llama-cpp with streaming
│   │       ├── conversation.ts     # Chat conversation persistence as JSON in userData
│   │       ├── fs.ts               # Vault file/folder IPC handlers and FS watcher
│   │       ├── hf-download.ts      # Hugging Face model search and GGUF download
│   │       ├── media.ts            # Audio recording saves and spellcheck suggestions
│   │       ├── speech.ts           # Local Whisper speech-to-text via ONNX/transformers
│   │       ├── systemPrompt.ts     # System prompt template management and active-prompt state
│   │       └── theme.ts            # Theme preset management and active-theme state
│   ├── preload/
│   │   └── index.ts                # contextBridge: exposes safe IPC APIs to renderer
│   └── renderer/                   # Vue 3 frontend
│       ├── index.html              # Entry HTML
│       ├── main.ts                 # Mounts the Vue app onto #app
│       ├── App.vue                 # Root component: layout, sidebar, tab bar
│       ├── style.scss              # Global SCSS styles and CSS custom properties
│       ├── vite-env.d.ts
│       ├── assets/                 # App icons and images
│       ├── components/
│       │   ├── AiPanel.vue         # AI chat panel orchestrator
│       │   ├── AudioRecorder.vue   # Voice recording and WAV capture UI
│       │   ├── BookmarksPanel.vue  # Bookmarked notes panel
│       │   ├── ContextMenu.vue     # Right-click context menu
│       │   ├── DrawingCanvas.vue   # Freehand drawing canvas orchestrator
│       │   ├── FileExplorer.vue    # Vault file browser with drag & drop
│       │   ├── FolderNode.vue      # Recursive tree node for folder/file rendering
│       │   ├── NoteEditor.vue      # CodeMirror 6 markdown editor orchestrator
│       │   ├── SearchPanel.vue     # Full-text search across vault
│       │   ├── TabBar.vue          # Editor tab bar
│       │   ├── ThemePicker.vue     # Theme preset picker modal
│       │   ├── ai/                 # AI sub-components
│       │   │   ├── AiAgentEditCard.vue  # Agent edit diff card with approve/reject
│       │   │   ├── AiHfPanel.vue       # Hugging Face model browser & download
│       │   │   ├── AiHistoryPanel.vue  # Conversation history sidebar
│       │   │   ├── AiInputArea.vue     # Chat input with agent mode toggle
│       │   │   ├── AiMessageList.vue   # Message rendering with streaming
│       │   │   └── AiModelBar.vue      # Model selector and status bar
│       │   ├── drawing/            # Drawing canvas sub-components
│       │   │   ├── DrawingExportDialog.vue  # Export modal with preview & save/copy
│       │   │   ├── DrawingFooter.vue        # Zoom, undo/redo, save status
│       │   │   ├── DrawingPropertiesPanel.vue # Color, stroke & style controls
│       │   │   └── DrawingToolbar.vue       # Tool buttons & architecture shapes
│       │   └── editor/             # Editor & media viewer sub-components
│       │       ├── AudioViewer.vue     # Audio player with playback controls
│       │       ├── ImageViewer.vue     # Image viewer with zoom
│       │       ├── MarkdownToolbar.vue # Markdown formatting toolbar
│       │       ├── PdfViewer.vue       # PDF embed viewer
│       │       └── VideoViewer.vue     # Video player with custom controls
│       ├── composables/            # Vue composables (grouped by domain)
│       │   ├── useAudioRecorder.ts # Microphone capture and WAV encoding
│       │   ├── ai/                 # AI chat, model, agent, history, system prompts, downloads
│       │   │   ├── useAIChat.ts        # Streaming inference, message management
│       │   │   ├── useAIModel.ts       # Model loading, unloading, and listing
│       │   │   ├── useAgentMode.ts     # Agent mode file editing workflow
│       │   │   ├── useConversationHistory.ts  # Conversation persistence and navigation
│       │   │   ├── useHfDownload.ts    # Hugging Face model search and download
│       │   │   └── useSystemPrompt.ts  # System prompt template listing and switching
│       │   ├── drawing/            # Canvas rendering, elements, interaction
│       │   │   ├── useCanvasRenderer.ts    # Canvas 2D rendering loop and bitmap export
│       │   │   ├── useDrawingElements.ts   # Shape and path element state management
│       │   │   ├── useDrawingHistory.ts    # Undo/redo stack for drawing operations
│       │   │   ├── useDrawingInteraction.ts # Pointer, wheel, and keyboard event handling
│       │   │   ├── useDrawingPersistence.ts # Save/load drawings; v1→v2 migration
│       │   │   └── useTextEditing.ts       # Inline text tool overlay for canvas
│       │   ├── editor/             # CodeMirror 6 editor & media players
│       │   │   ├── codemirror/         # CodeMirror 6 extension files
│       │   │   │   ├── cm-deco-builders.ts     # Decoration builder functions for live-preview
│       │   │   │   ├── cm-list-continuation.ts # List continuation keymap extension
│       │   │   │   ├── cm-markdown-widgets.ts  # ViewPlugin entry point for markdown live-preview
│       │   │   │   ├── cm-task-fold.ts         # Fold completed tasks extension
│       │   │   │   ├── cm-theme.ts             # Editor theme and syntax highlight styling
│       │   │   │   ├── cm-toolbar.ts           # Toolbar formatting commands & keybindings
│       │   │   │   ├── cm-widgets.ts           # WidgetType classes for live-preview
│       │   │   │   ├── useCodeEditor.ts        # CM6 instance for read-only code file viewing
│       │   │   │   └── useCodemirror.ts        # CM6 markdown editor lifecycle and extensions
│       │   │   ├── useAudioPlayer.ts       # Reactive audio playback state and controls
│       │   │   ├── useDictation.ts         # Streams mic audio to Whisper, inserts transcription
│       │   │   ├── useEditorDrop.ts        # Drag & drop onto editor inserts embed syntax
│       │   │   ├── useEditorTabs.ts        # Open file tabs with localStorage persistence
│       │   │   ├── useEmbedResolver.ts     # Resolves ![[...]] paths to data URIs with caching
│       │   │   ├── useNotePersistence.ts   # Note content load/save and auto-save scheduling
│       │   │   └── useVideoPlayer.ts       # Reactive video playback state and controls
│       │   ├── ui/                 # General UI composables
│       │   │   ├── useContextMenu.ts           # Context menu position and open/close state
│       │   │   ├── useListKeyboardNavigation.ts # Arrow-key navigation for list elements
│       │   │   └── useTheme.ts                 # Theme listing, CSS property application
│       │   └── vault/              # Vault & file management
│       │       ├── useBookmarks.ts     # Bookmarked notes state
│       │       ├── useFileSelection.ts # Active file and multi-select state
│       │       ├── useFolderTree.ts    # Recursive tree structure from flat file/folder lists
│       │       ├── useTreeNodeDrag.ts  # Drag-and-drop file/folder moves in tree
│       │       └── useVault.ts         # Core vault: folder open, FS watcher, CRUD
│       ├── types/                  # TypeScript type definitions
│       │   ├── ai.ts               # AI model info, load result, and status types
│       │   ├── chat.ts             # Chat message and agent file edit types
│       │   ├── drawing.ts          # Drawing element, tool, and canvas types
│       │   ├── electron.d.ts       # Electron IPC & preload API type declarations
│       │   ├── hf.ts               # Hugging Face search, repo file, and download types
│       │   └── speech.ts           # Speech-to-text result types
│       └── utils/                  # Shared utilities
│           ├── audio.ts            # WebM→WAV conversion and PCM encoding helpers
│           └── fileTypes.ts        # File extension classification constants and predicates
├── tests/                          # Unit tests (mirrors src/ structure)
│   ├── main/
│   │   ├── bookmarks.test.ts
│   │   ├── extensions.test.ts
│   │   ├── fs.scan.test.ts
│   │   ├── mime.test.ts
│   │   ├── paths.test.ts
│   │   ├── systemPrompt.test.ts
│   │   └── validation.test.ts
│   └── renderer/
│       ├── AiInputArea.test.ts
│       ├── AiPanel.test.ts
│       ├── audio.test.ts
│       ├── cm-list-continuation.test.ts
│       ├── cm-task-fold.test.ts
│       ├── cm-toolbar.test.ts
│       ├── exportDrawing.test.ts
│       ├── fileTypes.test.ts
│       ├── useAIChat.test.ts
│       ├── useAIModel.test.ts
│       ├── useAgentMode.test.ts
│       ├── useBookmarks.test.ts
│       ├── useContextMenu.test.ts
│       ├── useConversationHistory.test.ts
│       ├── useDrawingElements.test.ts
│       ├── useDrawingHistory.test.ts
│       ├── useEditorTabs.test.ts
│       ├── useEmbedResolver.test.ts
│       ├── useFileSelection.test.ts
│       ├── useFolderTree.test.ts
│       ├── useHfDownload.test.ts
│       ├── useListKeyboardNavigation.test.ts
│       ├── useNotePersistence.test.ts
│       ├── useSystemPrompt.test.ts
│       ├── useTheme.test.ts
│       ├── useTreeNodeDrag.test.ts
│       └── useVault.test.ts
├── assets/                         # Bundled app assets seeded to LEAF_HOME on first launch
│   ├── prompts/                    # Default system prompt templates (Markdown)
│   │   ├── coding.md
│   │   ├── default.md
│   │   └── writing.md
│   └── themes/                     # Built-in colour themes (JSON)
│       ├── dark.json
│       ├── light.json
│       └── ...                     # 18 themes total (catppuccin, dracula, nord, etc.)
├── models/
│   └── whisper/                    # Whisper ONNX model (download manually — see above)
├── public/                         # Static assets (demo screenshot)
├── build/                          # App icons, DMG backgrounds & packaging hooks
├── design/                         # Source design files (PSD)
├── .github/
│   ├── FUNDING.yml                 # GitHub Sponsors config
│   └── workflows/
│       ├── ci.yml                  # Type-check, build, test on every push/PR
│       └── release.yml             # Multi-platform build & GitHub Release
├── electron.vite.config.ts         # electron-vite config (main, preload, renderer)
├── vitest.config.ts                # Test runner config (jsdom environment)
├── eslint.config.js                # ESLint flat config (TypeScript + Vue + Prettier)
├── commitlint.config.js            # Conventional Commits linting
├── .prettierrc                     # Prettier formatting rules
├── package.json
├── tsconfig.json                   # Root TS config (project references)
├── tsconfig.app.json               # Renderer TS config (DOM + Vue, strict)
├── tsconfig.node.json              # Main & preload TS config (Node, strict)
└── generate-icons.sh               # Icon generation script
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Versions prior to v2.0.0 are licensed under the [MIT License](https://opensource.org/licenses/MIT).

From v2.0.0 onward, this project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE). You are free to use, modify, and distribute this software under the terms of the AGPL-3.0. If you wish to use Leaf in a proprietary or commercial product without complying with the AGPL, please contact the author for a commercial license.

## Acknowledgments

- Inspired by [Obsidian](https://obsidian.md/) for the vault-based note-taking approach
- Local AI powered by [llama.cpp](https://github.com/ggml-org/llama.cpp) and [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)

---

**Made with Vue 3, Electron, and a passion for local-first software.**
