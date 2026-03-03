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
├── electron/
│   ├── main.cjs                # Electron main process
│   ├── preload.cjs             # Secure bridge between main/renderer
│   ├── ai-service.cjs          # Local LLM inference service (node-llama-cpp)
│   ├── agent-service.cjs       # Agent mode file editing with backup/restore
│   ├── conversation-service.cjs # Conversation persistence (JSON storage)
│   ├── hf-download-service.cjs # Hugging Face model search & download
│   └── speech-service.cjs      # Local Whisper speech-to-text service
├── src/
│   ├── assets/                 # App icons and images
│   ├── components/
│   │   ├── AiPanel.vue         # AI chat interface with conversation history
│   │   ├── AudioRecorder.vue   # Voice recording and audio capture
│   │   ├── BookmarksPanel.vue  # Bookmarked notes panel
│   │   ├── ContextMenu.vue     # Right-click context menu
│   │   ├── DrawingCanvas.vue   # Freehand drawing canvas
│   │   ├── FileExplorer.vue    # Vault file browser with drag & drop
│   │   ├── FolderNode.vue      # Tree node for folder/file rendering
│   │   ├── NoteEditor.vue      # Editor with Markdown preview & media embeds
│   │   └── SearchPanel.vue     # Full-text search across vault
│   ├── types/
│   │   └── electron.d.ts       # Electron API type definitions
│   ├── App.vue
│   ├── main.ts
│   ├── style.scss
│   └── vite-env.d.ts           # Vite environment type definitions
├── models/
│   └── whisper/                # Whisper ONNX model (download manually — see README)
├── public/                     # Static assets (demo screenshot, icons)
├── build/                      # App icons for Electron Builder
├── index.html                  # Electron entry HTML
├── package.json
├── vite.config.ts
├── tsconfig.json               # Base TypeScript config
├── tsconfig.app.json           # App TypeScript config
├── tsconfig.node.json          # Node TypeScript config
└── generate-icons.sh           # Icon generation script
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
