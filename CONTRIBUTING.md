# Contributing to Leaf 🍃

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
   npm run dev:electron
   ```

This will launch the Electron app with hot reload enabled.

## Project Structure

- `electron/` - Electron main process and file system backend (Node.js)
- `src/` - Vue 3 frontend (renderer process)
- `src/store/` - Storage adapters and types
- `src/components/` - Vue components (to be created)
- `src/locales/` - Internationalization files (if needed)

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
- Test with different file formats (txt, md, rtf)
- Check that features work offline
- Test across different themes

### Priority Areas
We welcome contributions in these areas:
- Vault management UI
- File browser/tree view component
- Markdown editor and preview
- TXT and RTF file support
- Search functionality
- Note organization features

## Code Style
- Use consistent formatting (TypeScript/JavaScript)
- Write clear, descriptive comments where necessary
- Follow existing patterns in the codebase
- Keep components small and focused
- Prefer functional components with `<script setup>`

## Reporting Issues
- Use GitHub Issues for bugs and feature requests
- Provide steps to reproduce bugs if possible
- Include your OS version and Electron app version
- Screenshots are helpful!

## Code of Conduct
Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?
Feel free to open a discussion or issue if you need help!
