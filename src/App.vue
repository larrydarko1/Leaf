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
						<button @click="createNewFolder" class="btn-menu-icon" title="Create new folder">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
								<line x1="12" y1="11" x2="12" y2="17"></line>
								<line x1="9" y1="14" x2="15" y2="14"></line>
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
					<button @click="renameSelectedFile" class="btn-menu-icon" :disabled="!selectedFile" title="Rename note">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 20h9"></path>
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
						</svg>
					</button>
					<button @click="toggleTheme" class="btn-menu-icon" title="Toggle theme">
							<!-- Sun icon for dark theme -->
							<svg v-if="currentTheme === 'dark-theme'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="5"></circle>
								<line x1="12" y1="1" x2="12" y2="3"></line>
								<line x1="12" y1="21" x2="12" y2="23"></line>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
								<line x1="1" y1="12" x2="3" y2="12"></line>
								<line x1="21" y1="12" x2="23" y2="12"></line>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
							</svg>
							<!-- Moon icon for light theme -->
							<svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
							</svg>
						</button>
					</div>
					<FileExplorer
						:files="files"
						:folders="folders"
						:current-folder="currentFolder"
						:selected-file="selectedFile"
						:renaming-file="renamingFile"
						@select-file="handleFileSelect"
						@rename="handleFileRename"
						@cancel-rename="cancelRename"
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
import type { FileInfo, FolderInfo } from './types/electron';

const currentTheme = ref('dark-theme');
const currentFolder = ref<string | null>(null);
const files = ref<FileInfo[]>([]);
const folders = ref<FolderInfo[]>([]);
const selectedFile = ref<FileInfo | null>(null);
const renamingFile = ref<FileInfo | null>(null);

// Load saved folder path and theme from localStorage
onMounted(() => {
	const savedTheme = localStorage.getItem('leaf-theme');
	if (savedTheme) {
		currentTheme.value = savedTheme;
	}
	
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
			folders.value = result.folders || [];
			
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
	folders.value = [];
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

async function createNewFolder() {
	if (!currentFolder.value) return;
	
	// Generate a unique folder name with timestamp
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
	const folderName = `folder-${timestamp}`;
	
	try {
		const result = await window.electronAPI.createFolder(currentFolder.value, folderName);
		if (result.success) {
			// Refresh the file list to show the new folder
			await refreshFiles();
		} else {
			console.error('Failed to create folder:', result.error);
		}
	} catch (error) {
		console.error('Error creating folder:', error);
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

async function renameSelectedFile() {
	if (!selectedFile.value) return;
	renamingFile.value = selectedFile.value;
}

function cancelRename() {
	renamingFile.value = null;
}

async function handleFileRename(file: FileInfo, newName: string) {
	const extension = file.name.substring(file.name.lastIndexOf('.'));
	const newFileName = newName + extension;
	
	try {
		const result = await window.electronAPI.renameFile(file.path, newFileName);
		if (result.success && result.newPath) {
			renamingFile.value = null;
			// Refresh the file list
			await refreshFiles();
			// Select the renamed file
			const renamedFile = files.value.find(f => f.path === result.newPath);
			if (renamedFile) {
				selectedFile.value = renamedFile;
			}
		} else {
			renamingFile.value = null;
			alert('Failed to rename file: ' + result.error);
		}
	} catch (error) {
		renamingFile.value = null;
		console.error('Error renaming file:', error);
		alert('Error renaming file');
	}
}

function toggleTheme() {
	currentTheme.value = currentTheme.value === 'dark-theme' ? 'light-theme' : 'dark-theme';
	localStorage.setItem('leaf-theme', currentTheme.value);
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
	background: var(--base1);
	color: var(--text1);
}

// Welcome Screen
.welcome-screen {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--base1);
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
	color: var(--text1);
}

.app-subtitle {
	font-size: 1.2rem;
	color: var(--text2);
	margin: 0 0 2rem 0;
}

.btn-primary {
	padding: 1rem 2rem;
	background: var(--base2);
	color: var(--base1);
	border: none;
	border-radius: 8px;
	font-size: 1rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s;
	
	&:hover {
		opacity: 0.9;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
}

.hint {
	margin-top: 1rem;
	font-size: 0.9rem;
	color: var(--text2);
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
	border-right: 1px solid var(--text3);
	background: var(--base3);
}

.sidebar-header {
	height: 52px;
	background: var(--base3);
	border-bottom: 1px solid var(--text3);
	-webkit-app-region: drag;
}

.sidebar-menu {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid var(--text3);
	background: var(--base3);
	-webkit-app-region: drag;
}

.btn-menu-icon {
	background: none;
	border: none;
	color: var(--text2);
	cursor: pointer;
	padding: 0.375rem;
	border-radius: 4px;
	transition: all 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
	-webkit-app-region: no-drag;
	
	&:hover:not(:disabled) {
		background: var(--base1);
		color: var(--text1);
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

// Theme color palettes
.light-theme {
	--text1: #000000;
	--text2: #4a4a4a;
	--text3: #cdcdcd;
	--base1: #e8e8e8;
	--base2: #000000;
	--base3: #cdcdcd;
	--base4: #ffffff;
}

.dark-theme {
	--text1: #ffffff;
	--text2: #b0b0b0;
	--text3: #282828;
	--base1: #121212;
	--base2: #ffffff;
	--base3: #282828;
	--base4: #000000;
}
</style>
