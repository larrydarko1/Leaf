<template>
	<div id="app" :class="currentTheme">
		<div class="leaf-app">
			<!-- Welcome screen when no folder is selected -->
			<div v-if="!currentFolder" class="welcome-screen">
				<div class="welcome-content">
					<h1 class="app-title">🍃 Leaf</h1>
					<p class="app-subtitle">Local-first note-taking</p>
					<button @click="selectFolder" class="btn-primary">
						Select Notes Folder
					</button>
					<p class="hint">Choose a folder containing your .txt, .md, or .rtf files</p>
				</div>
			</div>

			<!-- Main app interface -->
			<div v-else class="app-layout">
				<aside class="sidebar">
					<div class="sidebar-header"></div>
					<div class="sidebar-menu">
						<button @click="changeFolder" class="btn-menu-icon" title="Change folder">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
							</svg>
						</button>
						<button @click="createNewFile" class="btn-menu-icon" title="Create new note">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
								<polyline points="14 2 14 8 20 8"></polyline>
								<line x1="12" y1="18" x2="12" y2="12"></line>
								<line x1="9" y1="15" x2="15" y2="15"></line>
							</svg>
						</button>
						<button @click="deleteSelectedFile" class="btn-menu-icon" :disabled="!selectedFile" title="Delete note">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"></polyline>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
								<line x1="10" y1="11" x2="10" y2="17"></line>
								<line x1="14" y1="11" x2="14" y2="17"></line>
							</svg>
						</button>
					</div>
					<FileExplorer
						:files="files"
						:current-folder="currentFolder"
						:selected-file="selectedFile"
						@select-file="handleFileSelect"
					/>
				</aside>

				<main class="main-content">
					<NoteEditor
						:file="selectedFile"
						@save="handleFileSave"
					/>
				</main>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FileExplorer from './components/FileExplorer.vue';
import NoteEditor from './components/NoteEditor.vue';
import type { FileInfo } from './types/electron';

const currentTheme = ref('dark');
const currentFolder = ref<string | null>(null);
const files = ref<FileInfo[]>([]);
const selectedFile = ref<FileInfo | null>(null);

// Load saved folder path from localStorage
onMounted(() => {
	const savedFolder = localStorage.getItem('leaf-folder-path');
	if (savedFolder) {
		loadFolder(savedFolder);
	}
});

async function selectFolder() {
	try {
		const folderPath = await window.electronAPI.openFolderDialog();
		if (folderPath) {
			await loadFolder(folderPath);
			// Save the folder path
			localStorage.setItem('leaf-folder-path', folderPath);
		}
	} catch (error) {
		console.error('Error selecting folder:', error);
	}
}

async function loadFolder(folderPath: string) {
	try {
		const result = await window.electronAPI.scanFolder(folderPath);
		if (result.success && result.files) {
			currentFolder.value = folderPath;
			files.value = result.files;
			
			// Auto-select first file if available
			if (files.value.length > 0 && !selectedFile.value) {
				selectedFile.value = files.value[0];
			}
		} else {
			console.error('Failed to scan folder:', result.error);
			alert('Failed to load folder: ' + result.error);
		}
	} catch (error) {
		console.error('Error loading folder:', error);
		alert('Error loading folder');
	}
}

async function refreshFiles() {
	if (currentFolder.value) {
		const currentPath = selectedFile.value?.path;
		await loadFolder(currentFolder.value);
		
		// Reselect the same file if it still exists
		if (currentPath) {
			const file = files.value.find(f => f.path === currentPath);
			if (file) {
				selectedFile.value = file;
			}
		}
	}
}

function changeFolder() {
	currentFolder.value = null;
	files.value = [];
	selectedFile.value = null;
	localStorage.removeItem('leaf-folder-path');
}

function handleFileSelect(file: FileInfo) {
	selectedFile.value = file;
}

function handleFileSave() {
	console.log('File saved:', selectedFile.value?.name);
	// Optionally refresh file metadata
	refreshFiles();
}

async function createNewFile() {
	if (!currentFolder.value) return;
	
	// Generate a unique filename
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
	const fileName = `note-${timestamp}.md`;
	
	try {
		const result = await window.electronAPI.createFile(currentFolder.value, fileName);
		if (result.success && result.path) {
			// Refresh the file list
			await refreshFiles();
			// Select the new file
			const newFile = files.value.find(f => f.path === result.path);
			if (newFile) {
				selectedFile.value = newFile;
			}
		} else {
			alert('Failed to create file: ' + result.error);
		}
	} catch (error) {
		console.error('Error creating file:', error);
		alert('Error creating file');
	}
}

async function deleteSelectedFile() {
	if (!selectedFile.value) return;
	
	try {
		const result = await window.electronAPI.deleteFile(selectedFile.value.path);
		if (result.success) {
			selectedFile.value = null;
			
			// Refresh the file list
			await refreshFiles();
			
			// Select another file if available
			if (files.value.length > 0) {
				selectedFile.value = files.value[0];
			}
		} else {
			alert('Failed to delete file: ' + result.error);
		}
	} catch (error) {
		console.error('Error deleting file:', error);
		alert('Error deleting file');
	}
}
</script>

<style lang="scss">
#app {
	width: 100%;
	height: 100vh;
	overflow: hidden;
}

.leaf-app {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: var(--bg-primary);
	color: var(--text-primary);
}

// Welcome Screen
.welcome-screen {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg-primary);
}

.welcome-content {
	text-align: center;
	max-width: 500px;
	padding: 2rem;
}

.app-title {
	font-size: 3rem;
	font-weight: 600;
	margin: 0 0 0.5rem 0;
	color: var(--text-primary);
}

.app-subtitle {
	font-size: 1.2rem;
	color: var(--text-secondary);
	margin: 0 0 2rem 0;
}

.btn-primary {
	padding: 1rem 2rem;
	background: var(--accent-color);
	color: white;
	border: none;
	border-radius: 8px;
	font-size: 1rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s;
	
	&:hover {
		background: var(--accent-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(107, 155, 110, 0.3);
	}
}

.hint {
	margin-top: 1rem;
	font-size: 0.9rem;
	color: var(--text-tertiary);
}

// Main App Layout
.app-layout {
	display: flex;
	height: 100%;
	overflow: hidden;
}

.sidebar {
	width: 300px;
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--border-color);
	background: var(--bg-secondary);
}

.sidebar-header {
	// Keep empty for spacing with OS window controls
	height: 52px;
	background: var(--bg-secondary);
	border-bottom: 1px solid var(--border-color);
	-webkit-app-region: drag;
}

.sidebar-menu {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid var(--border-color);
	background: var(--bg-secondary);
	-webkit-app-region: drag;
}

.btn-menu-icon {
	background: none;
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	padding: 0.375rem;
	border-radius: 4px;
	transition: all 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
	-webkit-app-region: no-drag;
	
	&:hover:not(:disabled) {
		background: var(--bg-hover);
		color: var(--text-primary);
	}
	
	&:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	
	svg {
		display: block;
	}
}

.main-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

// Dark theme variables (default)
.dark {
	--bg-primary: #1a1a1a;
	--bg-secondary: #242424;
	--bg-tertiary: #2d2d2d;
	--bg-hover: #383838;
	--text-primary: #e0e0e0;
	--text-secondary: #a0a0a0;
	--text-tertiary: #707070;
	--border-color: #383838;
	--accent-color: #6b9b6e;
	--accent-hover: #7cb37f;
}
</style>
