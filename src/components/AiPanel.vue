<template>
	<div class="ai-panel">
		<!-- Drag region matching the editor header height -->
		<div class="ai-drag-region"></div>

		<!-- Model selector / status bar -->
		<div class="ai-model-bar">
			<div class="ai-model-pill">
				<div v-if="!status.isModelLoaded" class="ai-model-selector">
					<div class="ai-dropdown" ref="dropdownRef">
						<button 
							class="ai-dropdown-trigger" 
							@click="toggleDropdown" 
							:disabled="isLoading"
						>
							<span class="ai-dropdown-label">{{ selectedModelLabel }}</span>
							<svg class="ai-dropdown-chevron" :class="{ open: showDropdown }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
						</button>
						<Teleport to="body">
							<div 
								v-if="showDropdown" 
								class="ai-dropdown-menu"
								:style="dropdownPosition"
							>
								<div 
									v-if="availableModels.length === 0" 
									class="ai-dropdown-empty"
								>
									No models found
								</div>
								<div 
									v-for="m in availableModels" 
									:key="m.path" 
									class="ai-dropdown-item"
									:class="{ selected: selectedModelPath === m.path }"
									@click="selectModel(m)"
								>
									<span class="ai-dropdown-item-name">{{ truncate(m.name, 30) }}</span>
									<span class="ai-dropdown-item-size">{{ m.sizeFormatted }}</span>
								</div>
							</div>
						</Teleport>
					</div>
					<button 
						@click="loadSelectedModel" 
						class="ai-btn-small" 
						:disabled="!selectedModelPath || isLoading"
					>
						{{ isLoading ? '...' : 'Load' }}
					</button>
				</div>
				<div v-else class="ai-model-status">
					<span class="ai-model-indicator"></span>
					<span class="ai-model-name">{{ status.currentModelName }}</span>
					<button @click="unloadModel" class="ai-btn-icon ai-btn-danger" title="Unload model" :disabled="status.isGenerating">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
						</svg>
					</button>
				</div>
			</div>
			<div class="ai-bar-actions">
				<button @click="openModelsFolder" class="ai-btn-icon" title="Open models folder">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
						<path d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.12.28.256.554.53L11 4c.816.816 1.224 1.224 1.712 1.495.274.15.56.263.86.348.536.153 1.113.153 2.268.153h.374c2.632 0 3.949 0 4.804.77.079.07.154.145.224.224C22 7.85 22 9.166 22 11.798V14c0 3.771 0 5.657-1.172 6.828C19.657 22 17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172C2 19.657 2 17.771 2 14V6.95z"/>
					</svg>
				</button>
				<button @click="refreshModels" class="ai-btn-icon" title="Refresh model list">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10"/>
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
					</svg>
				</button>
				<button 
					v-if="status.isModelLoaded"
					@click="toggleHistory" 
					class="ai-btn-icon" 
					:class="{ 'ai-btn-active': showHistory }"
					title="Conversation history"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<polyline points="12 6 12 12 16 14"/>
					</svg>
				</button>
				<button 
					v-if="status.isModelLoaded"
					@click="startNewConversation" 
					class="ai-btn-icon" 
					title="New conversation"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/>
						<line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</button>
				<button @click="$emit('close')" class="ai-btn-icon" title="Close">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Conversation history panel -->
		<div v-if="showHistory" class="ai-history-panel">
			<div class="ai-history-header">
				<span class="ai-history-title">History</span>
			</div>
			<div class="ai-history-list">
				<div v-if="conversationList.length === 0" class="ai-history-empty">
					No conversations yet
				</div>
				<div 
					v-for="conv in conversationList" 
					:key="conv.id" 
					class="ai-history-item"
					:class="{ active: currentConversationId === conv.id }"
					@click="loadConversation(conv.id)"
				>
					<div class="ai-history-item-content">
						<span v-if="renamingConversationId === conv.id" class="ai-history-item-title">
							<input
								ref="renameInputRef"
								v-model="renameValue"
								class="ai-history-rename-input"
								@keydown.enter.prevent="confirmRename(conv.id)"
								@keydown.escape.prevent="cancelRename"
								@blur="confirmRename(conv.id)"
								@click.stop
							/>
						</span>
						<span v-else class="ai-history-item-title">{{ conv.title }}</span>
						<span class="ai-history-item-meta">
							{{ conv.messageCount }} msgs · {{ formatRelativeDate(conv.updatedAt) }}
						</span>
					</div>
					<div class="ai-history-item-actions" @click.stop>
						<button 
							class="ai-btn-icon ai-btn-tiny" 
							@click="startRename(conv)"
							title="Rename"
						>
							<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
							</svg>
						</button>
						<button 
							class="ai-btn-icon ai-btn-tiny ai-btn-danger" 
							@click="deleteConversation(conv.id)"
							title="Delete"
						>
							<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Chat messages -->
		<div class="ai-messages" ref="messagesContainer">
			<!-- Empty state -->
			<div v-if="messages.length === 0" class="ai-empty-state">
				<div class="ai-empty-icon">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
						<line x1="9" y1="21" x2="15" y2="21"/>
						<line x1="10" y1="24" x2="14" y2="24"/>
					</svg>
				</div>
				<p class="ai-empty-text">
					{{ status.isModelLoaded 
						? 'Ask anything about your notes or just chat.' 
						: 'Load a model to get started. Place .gguf files in your models folder.' 
					}}
				</p>
				<button v-if="!status.isModelLoaded && availableModels.length === 0" @click="openModelsFolder" class="ai-btn-secondary">
					Open Models Folder
				</button>
			</div>

			<!-- Messages -->
			<div 
				v-for="(msg, index) in messages" 
				:key="index" 
				class="ai-message" 
				:class="msg.role"
			>
				<div class="ai-message-wrapper">
					<div class="ai-message-content" v-if="msg.role === 'user'">
						{{ msg.content }}
					</div>
					<div 
						v-else 
						class="ai-message-content ai-markdown" 
						v-html="renderMarkdown(msg.content)"
					></div>
					<span v-if="msg.role === 'assistant' && index === messages.length - 1 && isStreaming" class="ai-cursor">▊</span>
					<button 
						v-if="msg.content && !(msg.role === 'assistant' && index === messages.length - 1 && isStreaming)"
						class="ai-btn-copy" 
						@click="copyMessage(msg.content, index)"
						:title="copiedIndex === index ? 'Copied!' : 'Copy message'"
					>
						<svg v-if="copiedIndex !== index" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
						</svg>
						<svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Token counter -->
		<div v-if="status.isModelLoaded && status.contextSize > 0" class="ai-token-bar">
			<div class="ai-token-bar-track">
				<div 
					class="ai-token-bar-fill" 
					:class="{ warning: tokenUsagePercent > 75, danger: tokenUsagePercent > 90 }"
					:style="{ width: tokenUsagePercent + '%' }"
				></div>
			</div>
			<span class="ai-token-label">{{ formatTokenCount(conversationTokenCount) }} / {{ formatTokenCount(status.contextSize) }} · {{ tokenUsagePercent }}%</span>
		</div>

		<!-- Input area -->
		<div class="ai-input-area">
			<div v-if="includeNoteContext && activeFile" class="ai-context-hint">
				<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
				</svg>
				{{ activeFile.name }}
			</div>
			<div class="ai-input-row">
				<label class="ai-context-toggle" title="Include current note as context">
					<input type="checkbox" v-model="includeNoteContext" :disabled="!activeFile" />
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" :class="{ 'ai-context-active': includeNoteContext && activeFile }">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
					</svg>
				</label>
				<textarea
					ref="inputField"
					v-model="inputMessage"
					@keydown.enter.exact.prevent="sendMessage"
					placeholder="Ask something..."
					class="ai-input"
					:disabled="!status.isModelLoaded || status.isGenerating"
					rows="1"
				/>
				<button 
					v-if="isStreaming"
					@click="stopGeneration" 
					class="ai-btn-send ai-btn-stop" 
					title="Stop generating"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--base1)" xmlns="http://www.w3.org/2000/svg">
						<rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
					</svg>
				</button>
				<button 
					v-else
					@click="sendMessage" 
					class="ai-btn-send" 
					:disabled="!inputMessage.trim() || !status.isModelLoaded || isStreaming"
					title="Send message"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 14L13 21L20 4L3 11L6.5 12.5" stroke="var(--base1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { marked } from 'marked';
import type { FileInfo, AiModelInfo, AiStatus, ConversationMeta } from '../types/electron';

// Configure marked for safe, clean rendering
marked.setOptions({
	breaks: true,
	gfm: true,
});

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

const props = defineProps<{
	activeFile: FileInfo | null;
}>();

defineEmits<{
	(e: 'close'): void;
}>();

// State
const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const isStreaming = ref(false);
const isLoading = ref(false);
const includeNoteContext = ref(false);
const selectedModelPath = ref('');
const availableModels = ref<AiModelInfo[]>([]);
const status = ref<AiStatus>({
	isModelLoaded: false,
	currentModelPath: null,
	currentModelName: null,
	isGenerating: false,
	modelsDir: '',
	contextTokens: 0,
	contextSize: 0
});

const copiedIndex = ref<number | null>(null);

// Conversation persistence state
const showHistory = ref(false);
const conversationList = ref<ConversationMeta[]>([]);
const currentConversationId = ref<string | null>(null);
const renamingConversationId = ref<string | null>(null);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement[] | null>(null);

// Per-conversation token count
const conversationTokenCount = ref(0);

// Dropdown state
const showDropdown = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownPosition = ref<{ top: string; left: string; minWidth: string }>({ top: '0px', left: '0px', minWidth: '0px' });

const selectedModelLabel = computed(() => {
	if (!selectedModelPath.value) return 'Select a model...';
	const model = availableModels.value.find(m => m.path === selectedModelPath.value);
	return model ? truncate(model.name, 30) : 'Select a model...';
});

function truncate(text: string, max: number): string {
	return text.length > max ? text.slice(0, max) + '...' : text;
}

function toggleDropdown() {
	if (showDropdown.value) {
		showDropdown.value = false;
		return;
	}
	// Position the dropdown below the trigger
	if (dropdownRef.value) {
		const rect = dropdownRef.value.getBoundingClientRect();
		const menuWidth = Math.min(rect.width + 60, window.innerWidth - rect.left - 12);
		dropdownPosition.value = {
			top: `${rect.bottom + 4}px`,
			left: `${rect.left}px`,
			minWidth: `${menuWidth}px`
		};
	}
	showDropdown.value = true;
}

function selectModel(model: AiModelInfo) {
	selectedModelPath.value = model.path;
	showDropdown.value = false;
}

function handleDropdownClickOutside(event: MouseEvent) {
	if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
		showDropdown.value = false;
	}
}

// Refs
const messagesContainer = ref<HTMLElement | null>(null);
const inputField = ref<HTMLTextAreaElement | null>(null);

// Render markdown content
function renderMarkdown(content: string): string {
	if (!content) return '';
	return marked.parse(content, { async: false }) as string;
}

// Copy message to clipboard
async function copyMessage(content: string, index: number) {
	try {
		await navigator.clipboard.writeText(content);
		copiedIndex.value = index;
		setTimeout(() => {
			if (copiedIndex.value === index) copiedIndex.value = null;
		}, 2000);
	} catch (err) {
		console.error('Failed to copy:', err);
	}
}

// Scroll to bottom of messages
function scrollToBottom() {
	nextTick(() => {
		if (messagesContainer.value) {
			messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
		}
	});
}

// Load available models and current status
async function refreshModels() {
	try {
		const result = await window.electronAPI.aiListModels();
		if (result.success) {
			availableModels.value = result.models;
		}
	} catch (error) {
		console.error('Failed to list models:', error);
	}
}

async function refreshStatus() {
	try {
		status.value = await window.electronAPI.aiGetStatus();
	} catch (error) {
		console.error('Failed to get AI status:', error);
	}
}

// Load a model
async function loadSelectedModel() {
	if (!selectedModelPath.value) return;
	
	isLoading.value = true;
	try {
		const result = await window.electronAPI.aiLoadModel(selectedModelPath.value);
		if (result.success) {
			await refreshStatus();
			await startNewConversation();
		} else {
			messages.value.push({
				role: 'assistant',
				content: `Failed to load model: ${result.error}`
			});
		}
	} catch (error) {
		console.error('Failed to load model:', error);
	} finally {
		isLoading.value = false;
	}
}

// Unload current model
async function unloadModel() {
	try {
		// Stop any in-progress generation first
		if (status.value.isGenerating) {
			await stopGeneration();
		}
		// Save current conversation before unloading
		await saveCurrentConversation();
		await window.electronAPI.aiUnloadModel();
		await refreshStatus();
		messages.value = [];
		currentConversationId.value = null;
		conversationTokenCount.value = 0;
		showHistory.value = false;
	} catch (error) {
		console.error('Failed to unload model:', error);
	}
}

// Send a chat message
async function sendMessage() {
	const text = inputMessage.value.trim();
	if (!text || !status.value.isModelLoaded || status.value.isGenerating) return;
	
	// Create a new conversation if none exists
	if (!currentConversationId.value) {
		await createNewConversation();
	}
	
	// Add user message
	const userMsg: ChatMessage = { role: 'user', content: text };
	messages.value.push(userMsg);
	inputMessage.value = '';
	
	// Persist user message
	if (currentConversationId.value) {
		await window.electronAPI.conversationAddMessage(currentConversationId.value, userMsg);
	}
	
	// Add empty assistant message for streaming
	messages.value.push({ role: 'assistant', content: '' });
	isStreaming.value = true;
	scrollToBottom();
	
	// Get note context if enabled
	let noteContext: string | null = null;
	if (includeNoteContext.value && props.activeFile) {
		try {
			const result = await window.electronAPI.readFile(props.activeFile.path);
			if (result.success && result.content) {
				noteContext = result.content;
			}
		} catch (error) {
			console.error('Failed to read note for context:', error);
		}
	}
	
	try {
		const result = await window.electronAPI.aiChat(text, noteContext);
		if (!result.success) {
			const lastMsg = messages.value[messages.value.length - 1];
			if (lastMsg.role === 'assistant') {
				lastMsg.content = `Error: ${result.error}`;
			}
		}
		
		// Persist assistant response
		const assistantMsg = messages.value[messages.value.length - 1];
		if (currentConversationId.value && assistantMsg.role === 'assistant') {
			await window.electronAPI.conversationAddMessage(currentConversationId.value, {
				role: 'assistant',
				content: assistantMsg.content
			});
		}
	} catch (error) {
		const lastMsg = messages.value[messages.value.length - 1];
		if (lastMsg.role === 'assistant') {
			lastMsg.content = `Error: ${(error as Error).message}`;
		}
	} finally {
		isStreaming.value = false;
		await refreshStatus();
		// Update per-conversation token count from live session
		conversationTokenCount.value = status.value.contextTokens;
		// Persist token count to the conversation
		await saveTokenCountToConversation();
		await refreshConversationList();
		scrollToBottom();
	}
}

// Stop the current generation
async function stopGeneration() {
	try {
		await window.electronAPI.aiStopChat();
	} catch (error) {
		console.error('Failed to stop generation:', error);
	} finally {
		isStreaming.value = false;
		await refreshStatus();
		// Update per-conversation token count from live session
		conversationTokenCount.value = status.value.contextTokens;
		await saveTokenCountToConversation();
	}
}

// ============================
// Conversation persistence
// ============================

// Toggle history panel
function toggleHistory() {
	showHistory.value = !showHistory.value;
	if (showHistory.value) {
		refreshConversationList();
	}
}

// Refresh conversation list
async function refreshConversationList() {
	try {
		const result = await window.electronAPI.conversationList();
		if (result.success) {
			conversationList.value = result.conversations;
		}
	} catch (error) {
		console.error('Failed to list conversations:', error);
	}
}

// Create a new conversation (internal)
async function createNewConversation() {
	try {
		const modelName = status.value.currentModelName || 'unknown';
		const result = await window.electronAPI.conversationCreate(modelName);
		if (result.success && result.conversation) {
			currentConversationId.value = result.conversation.id;
		}
	} catch (error) {
		console.error('Failed to create conversation:', error);
	}
}

// Start a new conversation (user action)
async function startNewConversation() {
	// Save current conversation before starting a new one
	await saveCurrentConversation();
	
	// Reset chat session in the model
	try {
		await window.electronAPI.aiResetChat();
	} catch (error) {
		console.error('Failed to reset chat:', error);
	}
	
	messages.value = [];
	currentConversationId.value = null;
	conversationTokenCount.value = 0;
	showHistory.value = false;
	
	if (inputField.value) {
		inputField.value.focus();
	}
}

// Save current conversation state
async function saveCurrentConversation() {
	if (!currentConversationId.value || messages.value.length === 0) return;
	
	try {
		const result = await window.electronAPI.conversationLoad(currentConversationId.value);
		if (result.success && result.conversation) {
			result.conversation.messages = messages.value.map(m => ({
				role: m.role,
				content: m.content,
				timestamp: new Date().toISOString()
			}));
			result.conversation.tokenCount = conversationTokenCount.value;
			await window.electronAPI.conversationSave(result.conversation);
		}
	} catch (error) {
		console.error('Failed to save conversation:', error);
	}
}

// Persist token count to the current conversation
async function saveTokenCountToConversation() {
	if (!currentConversationId.value) return;
	
	try {
		const result = await window.electronAPI.conversationLoad(currentConversationId.value);
		if (result.success && result.conversation) {
			result.conversation.tokenCount = conversationTokenCount.value;
			await window.electronAPI.conversationSave(result.conversation);
		}
	} catch (error) {
		console.error('Failed to save token count:', error);
	}
}

// Load a conversation from history
async function loadConversation(id: string) {
	try {
		// Save current conversation first
		await saveCurrentConversation();
		
		const result = await window.electronAPI.conversationLoad(id);
		if (result.success && result.conversation) {
			// Reset the LLM chat session
			await window.electronAPI.aiResetChat();
			
			currentConversationId.value = result.conversation.id;
			messages.value = result.conversation.messages.map(m => ({
				role: m.role,
				content: m.content
			}));
			
			// Restore per-conversation token count
			conversationTokenCount.value = result.conversation.tokenCount || 0;
			
			showHistory.value = false;
			scrollToBottom();
		}
	} catch (error) {
		console.error('Failed to load conversation:', error);
	}
}

// Delete a conversation
async function deleteConversation(id: string) {
	try {
		await window.electronAPI.conversationDelete(id);
		
		// If we deleted the current conversation, clear the view
		if (currentConversationId.value === id) {
			messages.value = [];
			currentConversationId.value = null;
			conversationTokenCount.value = 0;
			await window.electronAPI.aiResetChat();
		}
		
		await refreshConversationList();
	} catch (error) {
		console.error('Failed to delete conversation:', error);
	}
}

// Start renaming a conversation
function startRename(conv: ConversationMeta) {
	renamingConversationId.value = conv.id;
	renameValue.value = conv.title;
	nextTick(() => {
		if (renameInputRef.value && renameInputRef.value.length > 0) {
			renameInputRef.value[0].focus();
			renameInputRef.value[0].select();
		}
	});
}

// Confirm rename
async function confirmRename(id: string) {
	if (!renameValue.value.trim()) {
		cancelRename();
		return;
	}
	
	try {
		await window.electronAPI.conversationRename(id, renameValue.value.trim());
		await refreshConversationList();
	} catch (error) {
		console.error('Failed to rename conversation:', error);
	}
	
	renamingConversationId.value = null;
	renameValue.value = '';
}

// Cancel rename
function cancelRename() {
	renamingConversationId.value = null;
	renameValue.value = '';
}

// Format relative date for history items
function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);
	
	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay < 7) return `${diffDay}d ago`;
	return date.toLocaleDateString();
}

// Open models directory
async function openModelsFolder() {
	try {
		await window.electronAPI.aiOpenModelsDir();
	} catch (error) {
		console.error('Failed to open models dir:', error);
	}
}

// Token usage percentage
const tokenUsagePercent = computed(() => {
	if (!status.value.contextSize) return 0;
	return Math.min(100, Math.round((conversationTokenCount.value / status.value.contextSize) * 100));
});

// Format token count for display
function formatTokenCount(n: number): string {
	if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
	return String(n);
}

// Token streaming handler
function handleToken(token: string) {
	const lastMsg = messages.value[messages.value.length - 1];
	if (lastMsg && lastMsg.role === 'assistant') {
		lastMsg.content += token;
		scrollToBottom();
	}
}

// Watch for streaming updates to auto-scroll
watch(() => messages.value.length, () => {
	scrollToBottom();
});

onMounted(async () => {
	// Set up token streaming listener
	window.electronAPI.onAiToken(handleToken);
	
	// Dropdown click-outside listener
	document.addEventListener('click', handleDropdownClickOutside);
	
	// Load initial state
	await refreshStatus();
	await refreshModels();
	await refreshConversationList();
	
	// Focus input if model already loaded
	if (status.value.isModelLoaded && inputField.value) {
		inputField.value.focus();
	}
});

onUnmounted(() => {
	// Clean up listeners
	window.electronAPI.removeAiTokenListener();
	document.removeEventListener('click', handleDropdownClickOutside);
});
</script>

<style lang="scss" scoped>
.ai-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: var(--base1);
	border-left: 1px solid var(--text3);
	width: 340px;
	min-width: 280px;
}

.ai-drag-region {
	height: 50px;
	-webkit-app-region: drag;
	flex-shrink: 0;
}

.ai-model-bar {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	flex-shrink: 0;
	-webkit-app-region: no-drag;
}

.ai-model-pill {
	flex: 1;
	min-width: 0;
	background: var(--bg-primary);
	border: 1px solid var(--text3);
	border-radius: 10px;
	padding: 0.2rem 0.35rem;
	display: flex;
	align-items: center;
}

.ai-model-selector {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	flex: 1;
	min-width: 0;
}

.ai-dropdown {
	flex: 1;
	min-width: 0;
	position: relative;
}

.ai-dropdown-trigger {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	width: 100%;
	padding: 0.25rem 0.4rem;
	background: transparent;
	color: var(--text1);
	border: none;
	font-size: 0.75rem;
	cursor: pointer;
	text-align: left;
	border-radius: 6px;
	transition: background 0.15s;

	&:hover:not(:disabled) {
		background: var(--bg-hover);
	}
	
	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.ai-dropdown-label {
	flex: 1;
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--text2);
}

.ai-dropdown-chevron {
	flex-shrink: 0;
	color: var(--text2);
	transition: transform 0.2s;

	&.open {
		transform: rotate(180deg);
	}
}

.ai-dropdown-menu {
	position: fixed;
	background: var(--bg-secondary, var(--bg-primary));
	border: 1px solid var(--text3);
	border-radius: 8px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
	padding: 0.3rem;
	z-index: 10000;
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	max-height: 200px;
	max-width: calc(100vw - 24px);
	overflow-y: auto;
	overflow-x: hidden;
}

.ai-dropdown-empty {
	padding: 0.5rem 0.65rem;
	font-size: 0.75rem;
	color: var(--text2);
	text-align: center;
}

.ai-dropdown-item {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.5rem;
	padding: 0.45rem 0.6rem;
	border-radius: 5px;
	cursor: pointer;
	font-size: 0.75rem;
	color: var(--text1);
	transition: background 0.12s;

	&:hover {
		background: var(--bg-hover);
	}

	&.selected {
		background: var(--bg-hover);
		color: var(--accent-color);
	}
}

.ai-dropdown-item-name {
	flex: 1;
	min-width: 0;
	word-break: break-word;
	line-height: 1.35;
}

.ai-dropdown-item-size {
	flex-shrink: 0;
	font-size: 0.68rem;
	color: var(--text2);
	opacity: 0.7;
}

.ai-model-status {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	flex: 1;
	min-width: 0;
	padding: 0 0.2rem;
}

.ai-model-indicator {
	width: 7px;
	height: 7px;
	background: var(--accent-color);
	border-radius: 50%;
	flex-shrink: 0;
	box-shadow: 0 0 4px var(--accent-color);
}

.ai-model-name {
	font-size: 0.75rem;
	color: var(--text2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ai-bar-actions {
	display: flex;
	align-items: center;
	gap: 0.125rem;
	flex-shrink: 0;
	background: var(--bg-primary);
	border: 1px solid var(--text3);
	border-radius: 10px;
	padding: 0.15rem 0.2rem;
}

.ai-btn-icon {
	background: none;
	border: none;
	color: var(--text2);
	cursor: pointer;
	padding: 0.3rem;
	border-radius: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s;
	flex-shrink: 0;
	
	&:hover:not(:disabled) {
		background: var(--bg-hover);
		color: var(--text1);
	}
	
	&:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
}

.ai-btn-danger {
	&:hover:not(:disabled) {
		color: var(--danger-color);
	}
}

.ai-btn-active {
	color: var(--accent-color) !important;
	background: var(--bg-hover);
}

.ai-btn-small {
	padding: 0.25rem 0.55rem;
	background: var(--accent-color);
	color: var(--base1);
	border: none;
	border-radius: 7px;
	font-size: 0.72rem;
	font-weight: 500;
	cursor: pointer;
	white-space: nowrap;
	flex-shrink: 0;
	transition: opacity 0.2s, transform 0.15s;
	
	&:hover:not(:disabled) {
		opacity: 0.85;
		transform: scale(1.03);
	}
	
	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
}

.ai-btn-secondary {
	padding: 0.5rem 1rem;
	background: transparent;
	color: var(--text2);
	border: 1px solid var(--text3);
	border-radius: 6px;
	font-size: 0.8rem;
	cursor: pointer;
	transition: all 0.2s;
	margin-top: 0.5rem;
	
	&:hover {
		color: var(--text1);
		border-color: var(--text2);
	}
}

// Messages area
.ai-messages {
	flex: 1;
	overflow-y: auto;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	-webkit-app-region: no-drag;
}

// Conversation history panel
.ai-history-panel {
	flex-shrink: 0;
	max-height: 45%;
	display: flex;
	flex-direction: column;
	border-bottom: 1px solid var(--text3);
	-webkit-app-region: no-drag;
}

.ai-history-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 0.75rem 0.35rem;
}

.ai-history-title {
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--text2);
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.ai-history-list {
	flex: 1;
	overflow-y: auto;
	padding: 0 0.5rem 0.5rem;
}

.ai-history-empty {
	font-size: 0.75rem;
	color: var(--text2);
	text-align: center;
	padding: 1rem 0;
}

.ai-history-item {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.45rem 0.55rem;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.12s;
	
	&:hover {
		background: var(--bg-hover);
		
		.ai-history-item-actions {
			opacity: 1;
		}
	}
	
	&.active {
		background: var(--bg-hover);
		
		.ai-history-item-title {
			color: var(--accent-color);
		}
	}
}

.ai-history-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
}

.ai-history-item-title {
	font-size: 0.78rem;
	color: var(--text1);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.3;
}

.ai-history-item-meta {
	font-size: 0.66rem;
	color: var(--text2);
	opacity: 0.7;
}

.ai-history-item-actions {
	display: flex;
	gap: 0.1rem;
	opacity: 0;
	transition: opacity 0.15s;
	flex-shrink: 0;
}

.ai-btn-tiny {
	padding: 0.2rem !important;
}

.ai-history-rename-input {
	width: 100%;
	background: var(--bg-primary);
	color: var(--text1);
	border: 1px solid var(--accent-color);
	border-radius: 4px;
	padding: 0.15rem 0.35rem;
	font-size: 0.78rem;
	font-family: inherit;
	outline: none;
}

.ai-empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
	text-align: center;
	padding: 1rem;
}

.ai-empty-icon {
	color: var(--text3);
	margin-bottom: 0.75rem;
}

.ai-empty-text {
	font-size: 0.8rem;
	color: var(--text2);
	line-height: 1.5;
	margin: 0;
}

.ai-message {
	display: flex;
	
	&:hover .ai-btn-copy {
		opacity: 1;
	}
	
	&.user {
		justify-content: flex-end;
		
		.ai-message-wrapper {
			max-width: 85%;
		}

		.ai-message-content {
			background: var(--accent-color);
			color: var(--text1);
			border-radius: 12px 12px 2px 12px;
		}
	}
	
	&.assistant {
		justify-content: flex-start;
		
		.ai-message-wrapper {
			max-width: 90%;
		}

		.ai-message-content {
			background: var(--bg-primary);
			color: var(--text1);
			border-radius: 12px 12px 12px 2px;
		}
	}
}

.ai-message-wrapper {
	position: relative;
}

.ai-message-content {
	padding: 0.6rem 0.85rem;
	font-size: 0.82rem;
	line-height: 1.55;
	word-break: break-word;
	white-space: pre-wrap;
}

// Markdown styles for assistant messages
.ai-markdown {
	white-space: normal;

	:deep(p) {
		margin: 0 0 0.5em 0;

		&:last-child {
			margin-bottom: 0;
		}
	}

	:deep(h1), :deep(h2), :deep(h3), :deep(h4) {
		margin: 0.6em 0 0.3em 0;
		line-height: 1.3;

		&:first-child {
			margin-top: 0;
		}
	}

	:deep(h1) { font-size: 1.1em; }
	:deep(h2) { font-size: 1.0em; }
	:deep(h3) { font-size: 0.95em; }

	:deep(ul), :deep(ol) {
		margin: 0.3em 0;
		padding-left: 1.4em;
	}

	:deep(li) {
		margin: 0.15em 0;
	}

	:deep(code) {
		background: rgba(0, 0, 0, 0.15);
		padding: 0.15em 0.35em;
		border-radius: 3px;
		font-size: 0.9em;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
	}

	:deep(pre) {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.6em 0.75em;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0.4em 0;

		code {
			background: none;
			padding: 0;
			font-size: 0.85em;
		}
	}

	:deep(blockquote) {
		border-left: 3px solid var(--accent-color);
		margin: 0.4em 0;
		padding: 0.2em 0.6em;
		color: var(--text2);
	}

	:deep(table) {
		border-collapse: collapse;
		margin: 0.4em 0;
		width: 100%;
		font-size: 0.9em;

		th, td {
			border: 1px solid var(--text3);
			padding: 0.3em 0.5em;
			text-align: left;
		}

		th {
			background: rgba(0, 0, 0, 0.1);
		}
	}

	:deep(hr) {
		border: none;
		border-top: 1px solid var(--text3);
		margin: 0.5em 0;
	}

	:deep(a) {
		color: var(--accent-color);
		text-decoration: underline;
	}

	:deep(strong) {
		font-weight: 600;
	}
}

.ai-btn-copy {
	background: none;
	border: none;
	color: var(--text2);
	cursor: pointer;
	padding: 3px;
	border-radius: 4px;
	opacity: 0;
	transition: opacity 0.15s, color 0.15s;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 2px;
	align-self: flex-end;

	&:hover {
		color: var(--text1);
		background: var(--bg-hover);
	}
}

.ai-cursor {
	animation: blink 0.8s step-end infinite;
	color: var(--accent-color);
	font-size: 0.9em;
}

@keyframes blink {
	50% { opacity: 0; }
}

// Input area
.ai-input-area {
	padding: 0.5rem 0.75rem 0.75rem;
	flex-shrink: 0;
	-webkit-app-region: no-drag;
}

// Token counter bar
.ai-token-bar {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0 0.75rem;
	flex-shrink: 0;
	-webkit-app-region: no-drag;
}

.ai-token-bar-track {
	flex: 1;
	height: 3px;
	background: var(--text3);
	border-radius: 2px;
	overflow: hidden;
}

.ai-token-bar-fill {
	height: 100%;
	background: var(--accent-color);
	border-radius: 2px;
	transition: width 0.3s ease;

	&.warning {
		background: #e6a700;
	}

	&.danger {
		background: var(--danger-color, #e74c3c);
	}
}

.ai-token-label {
	font-size: 0.62rem;
	color: var(--text2);
	white-space: nowrap;
	flex-shrink: 0;
	font-variant-numeric: tabular-nums;
}

.ai-context-hint {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	font-size: 0.7rem;
	color: var(--accent-color);
	padding: 0 0.25rem 0.4rem;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ai-input-row {
	display: flex;
	align-items: center;
	gap: 0;
	background: var(--bg-primary);
	border: 1px solid var(--text3);
	border-radius: 12px;
	padding: 0.2rem 0.2rem 0.2rem 0.35rem;
	transition: border-color 0.2s;

	&:focus-within {
		border-color: var(--accent-color);
	}
}

.ai-context-toggle {
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	padding: 0.3rem;
	color: var(--text2);
	flex-shrink: 0;
	border-radius: 6px;
	transition: color 0.15s, background 0.15s;
	
	input {
		display: none;
	}
	
	&:hover {
		color: var(--text1);
		background: var(--bg-hover);
	}
}

.ai-context-active {
	color: var(--accent-color) !important;
}

.ai-input {
	flex: 1;
	min-width: 0;
	padding: 0.4rem 0.5rem;
	background: transparent;
	color: var(--text1);
	border: none;
	font-size: 0.82rem;
	font-family: inherit;
	line-height: 1.4;
	resize: none;
	overflow-y: auto;
	max-height: 120px;
	
	&::placeholder {
		color: var(--text2);
	}
	
	&:focus {
		outline: none;
	}
	
	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.ai-btn-send {
	background: var(--accent-color);
	color: var(--text1);
	border: none;
	border-radius: 8px;
	width: 30px;
	height: 30px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	transition: opacity 0.2s, transform 0.15s, color 0.15s;
	
	&:hover:not(:disabled) {
		opacity: 0.85;
		transform: scale(1.05);
	}
	
	&:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	&.ai-btn-stop {
		background: var(--danger-color, #e74c3c);

		&:hover {
			opacity: 0.85;
			transform: scale(1.05);
		}
	}
}
</style>
