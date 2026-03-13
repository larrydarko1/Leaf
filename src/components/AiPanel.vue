<template>
	<div class="ai-panel">
		<!-- Drag region matching the editor header height -->
		<div class="ai-drag-region"></div>

		<!-- Model selector / status bar -->
		<div class="ai-model-bar">
			<!-- LOCAL MODE: model pill -->
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
				<!-- HF Download button -->
				<button 
					@click="toggleHfPanel" 
					class="ai-btn-icon" 
					:class="{ 'ai-btn-active': showHfPanel }"
					title="Download models from Hugging Face"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="7 10 12 15 17 10"/>
						<line x1="12" y1="15" x2="12" y2="3"/>
					</svg>
				</button>
				<button @click="refreshModels" class="ai-btn-icon" title="Refresh model list">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10"/>
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
					</svg>
				</button>
				<button 
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
					@click="toggleAgentMode" 
					class="ai-btn-icon" 
					:class="{ 'ai-btn-active': agentMode }"
					title="Agent mode — AI can read and edit files"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</button>
				<button 
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

		<!-- HF Model Download Panel -->
		<div v-if="showHfPanel" class="ai-hf-panel">
			<div class="ai-hf-header">
				<span class="ai-hf-title">Download Models</span>
				<button @click="showHfPanel = false" class="ai-btn-icon ai-btn-tiny" title="Close">
					<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
			<div class="ai-hf-search-bar">
				<input
					v-model="hfSearchQuery"
					placeholder="Search GGUF models..."
					class="ai-hf-search-input"
					@keydown.enter.prevent="searchHfModels"
				/>
				<button @click="searchHfModels" class="ai-btn-icon" :disabled="hfIsSearching" title="Search">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/>
						<line x1="21" y1="21" x2="16.65" y2="16.65"/>
					</svg>
				</button>
			</div>

			<!-- Back button when viewing files -->
			<button v-if="hfSelectedRepo" @click="hfSelectedRepo = null; hfRepoFiles = []; hfModelInfo = null" class="ai-hf-back-btn">
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="19" y1="12" x2="5" y2="12"/>
					<polyline points="12 19 5 12 12 5"/>
				</svg>
				Back to results
			</button>

			<div class="ai-hf-results">
				<!-- Loading state -->
				<div v-if="hfIsSearching || hfIsLoadingFiles" class="ai-hf-loading">Searching...</div>

				<!-- Repo file listing -->
				<template v-else-if="hfSelectedRepo && hfRepoFiles.length > 0">
					<div class="ai-hf-repo-header">
						<span class="ai-hf-repo-title">{{ hfSelectedRepo }}</span>
						<div v-if="hfModelInfo" class="ai-hf-model-meta">
							<span v-if="hfModelInfo.architecture" class="ai-hf-meta-tag" title="Model Architecture">
								<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14a4 4 0 0 0-8 0v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4z"/></svg>
								{{ hfModelInfo.architecture }}
							</span>
							<span v-if="hfModelInfo.contextLength" class="ai-hf-meta-tag" title="Context Window">
								<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
								{{ formatNumber(hfModelInfo.contextLength) }} tokens
							</span>
							<span v-if="hfModelInfo.totalParamSize" class="ai-hf-meta-tag" title="Total Parameter Size (unquantized)">
								<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
								{{ hfModelInfo.totalParamSizeFormatted }} params
							</span>
						</div>
					</div>
					<div 
						v-for="file in hfRepoFiles" 
						:key="file.name" 
						class="ai-hf-file-item"
					>
						<div class="ai-hf-file-info">
							<div class="ai-hf-file-top-row">
								<span class="ai-hf-file-name">{{ file.name }}</span>
								<span 
									v-if="file.tier" 
									class="ai-hf-tier-badge" 
									:class="'ai-hf-tier-' + file.tier.color"
									:title="file.tier.description"
								>
									{{ file.tier.label }}
								</span>
							</div>
							<div class="ai-hf-file-details">
								<span class="ai-hf-file-size" title="Download size">{{ file.sizeFormatted }}</span>
								<span v-if="file.quantType" class="ai-hf-quant-badge" title="Quantization type">{{ file.quantType }}</span>
								<span v-if="file.estimatedRamFormatted" class="ai-hf-ram-estimate" title="Estimated RAM needed for inference">
									RAM: ~{{ file.estimatedRamFormatted }}
								</span>
								<span v-if="file.isSharded" class="ai-hf-shard-info" title="Model is split into multiple files">
									{{ file.shardCount }} parts
								</span>
							</div>
						</div>
						<div class="ai-hf-file-actions">
							<template v-if="hfActiveDownloads.has(file.name)">
								<div v-if="hfDownloadProgress && hfDownloadProgress.fileName === file.name" class="ai-hf-progress">
									<div class="ai-hf-progress-bar">
										<div class="ai-hf-progress-fill" :style="{ width: hfDownloadProgress.percent + '%' }"></div>
									</div>
									<span class="ai-hf-progress-text">{{ hfDownloadProgress.percent }}%</span>
								</div>
								<button @click="cancelHfDownload(file.name)" class="ai-btn-icon ai-btn-tiny ai-btn-danger" title="Cancel">
									<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"/>
										<line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
								</button>
							</template>
							<button v-else-if="file.isSharded" @click="downloadHfModel(file)" class="ai-hf-download-btn ai-hf-download-sharded" title="Download all parts to ~/leaf-models/">
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									<polyline points="7 10 12 15 17 10"/>
									<line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								<span class="ai-hf-download-label">All</span>
							</button>
							<button v-else @click="downloadHfModel(file)" class="ai-hf-download-btn" title="Download to ~/leaf-models/">
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									<polyline points="7 10 12 15 17 10"/>
									<line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
							</button>
						</div>
					</div>
				</template>

				<!-- No files found -->
				<div v-else-if="hfSelectedRepo && !hfIsLoadingFiles" class="ai-hf-empty">
					No .gguf files found in this repository
				</div>

				<!-- Search results -->
				<template v-else-if="hfSearchResults.length > 0">
					<div 
						v-for="repo in hfSearchResults" 
						:key="repo.id" 
						class="ai-hf-result-item"
						@click="selectHfRepo(repo.id)"
					>
						<div class="ai-hf-result-info">
							<span class="ai-hf-result-name">{{ repo.id }}</span>
							<span class="ai-hf-result-meta">
								<span title="Downloads">↓ {{ formatNumber(repo.downloads) }}</span>
								<span title="Likes">♥ {{ formatNumber(repo.likes) }}</span>
							</span>
						</div>
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</div>
				</template>

				<!-- Empty state -->
				<div v-else-if="!hfIsSearching" class="ai-hf-empty">
					Search for GGUF models on Hugging Face
				</div>
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
		<div class="ai-messages" ref="messagesContainer" @scroll="onMessagesScroll">
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
				<button v-if="!status.isModelLoaded && availableModels.length > 0" @click="openHistory" class="ai-btn-secondary">
					Browse History
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
					<!-- User message: edit mode -->
					<div v-if="msg.role === 'user' && editingIndex === index" class="ai-message-edit">
						<textarea
							ref="editInputRef"
							v-model="editContent"
							@keydown.enter.exact.prevent="confirmEditMessage(index)"
							@keydown.escape.prevent="cancelEditMessage"
							class="ai-edit-input"
							rows="2"
						/>
						<div class="ai-edit-actions">
							<button @click="cancelEditMessage" class="ai-btn-icon ai-btn-tiny" title="Cancel">
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<line x1="18" y1="6" x2="6" y2="18"/>
									<line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
							<button @click="confirmEditMessage(index)" class="ai-btn-icon ai-btn-tiny" title="Save & resend">
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							</button>
						</div>
					</div>
					<!-- User message: normal mode -->
					<div class="ai-message-content" v-else-if="msg.role === 'user'">
						{{ msg.content }}
					</div>
					<!-- System message (e.g. auto-compaction notice) -->
					<div v-else-if="msg.role === 'system'" class="ai-message-content ai-system-notice">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/>
							<line x1="12" y1="8" x2="12" y2="12"/>
							<line x1="12" y1="16" x2="12.01" y2="16"/>
						</svg>
						<span>{{ msg.content }}</span>
					</div>
					<!-- Assistant message -->
					<div 
						v-else 
						class="ai-message-content ai-markdown" 
						v-html="renderMarkdown(msg.content)"
					></div>
					<!-- Agent edit cards -->
					<div v-if="msg.agentEdits && msg.agentEdits.length > 0" class="ai-agent-edits">
						<div 
							v-for="(edit, editIdx) in msg.agentEdits" 
							:key="editIdx" 
							class="ai-agent-edit-card"
							:class="edit.status"
						>
							<div class="ai-agent-edit-header">
								<div class="ai-agent-edit-file">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
									</svg>
									<span class="ai-agent-edit-filename">{{ edit.relativePath || edit.filePath }}</span>
									<span v-if="edit.isNewFile" class="ai-agent-edit-badge new">NEW</span>
								</div>
								<div class="ai-agent-edit-status">
									<span v-if="edit.status === 'approved'" class="ai-agent-status-text approved">Approved</span>
									<span v-else-if="edit.status === 'rejected'" class="ai-agent-status-text rejected">Reverted</span>
									<span v-else-if="edit.status === 'error'" class="ai-agent-status-text error">Error</span>
								</div>
							</div>
							<!-- Diff view (collapsible) -->
							<details v-if="edit.originalContent !== undefined" class="ai-agent-diff-details">
								<summary class="ai-agent-diff-summary">View changes</summary>
								<div class="ai-agent-diff">
									<div v-if="!edit.isNewFile" class="ai-agent-diff-section removed">
										<div class="ai-agent-diff-label">Original</div>
										<pre class="ai-agent-diff-code">{{ edit.originalContent }}</pre>
									</div>
									<div class="ai-agent-diff-section added">
										<div class="ai-agent-diff-label">{{ edit.isNewFile ? 'New file' : 'Modified' }}</div>
										<pre class="ai-agent-diff-code">{{ edit.newContent }}</pre>
									</div>
								</div>
							</details>
							<!-- Error message -->
							<div v-if="edit.error" class="ai-agent-edit-error">{{ edit.error }}</div>
							<!-- Approve / Reject buttons -->
							<div v-if="edit.status === 'pending'" class="ai-agent-edit-actions">
								<button @click="approveAgentEdit(index, editIdx)" class="ai-agent-btn approve">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"/>
									</svg>
									Approve
								</button>
								<button @click="rejectAgentEdit(index, editIdx)" class="ai-agent-btn reject">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"/>
										<line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
									Reject
								</button>
							</div>
						</div>
					</div>
					<span v-if="msg.role === 'assistant' && index === messages.length - 1 && isStreaming" class="ai-cursor">▊</span>
					<!-- Message action buttons -->
					<div 
						v-if="msg.role !== 'system' && msg.content && !(isStreaming && index >= messages.length - 2) && editingIndex !== index" 
						class="ai-message-actions"
					>
						<!-- Copy -->
						<button 
							class="ai-btn-action" 
							@click="copyMessage(msg.content, index)"
							:title="copiedIndex === index ? 'Copied!' : 'Copy'"
						>
							<svg v-if="copiedIndex !== index" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
							</svg>
							<svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						</button>
						<!-- Edit (user messages only) -->
						<button 
							v-if="msg.role === 'user'" 
							class="ai-btn-action" 
							@click="startEditMessage(index)"
							title="Edit"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
							</svg>
						</button>
						<!-- Resend (last user message only, no messages after it) -->
						<button 
							v-if="msg.role === 'user' && index === messages.length - 1 && isReady" 
							class="ai-btn-action" 
							@click="resendMessage(index)"
							title="Resend"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="1 4 1 10 7 10"/>
								<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
							</svg>
						</button>
						<!-- Regenerate (last assistant message only) -->
						<button 
							v-if="msg.role === 'assistant' && index === messages.length - 1 && isReady" 
							class="ai-btn-action" 
							@click="regenerateLastResponse"
							title="Regenerate"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="23 4 23 10 17 10"/>
								<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
							</svg>
						</button>
						<!-- Delete last message pair -->
						<button 
							v-if="index === messages.length - 1" 
							class="ai-btn-action ai-btn-action-danger" 
							@click="deleteLastMessagePair"
							title="Delete"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Load model banner (shown when viewing a conversation without a loaded model) -->
		<div v-if="!status.isModelLoaded && messages.length > 0" class="ai-load-model-banner">
			<div class="ai-load-model-banner-content">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<span>Load a model to continue chatting</span>
			</div>
			<button 
				v-if="previousModelMatch" 
				@click="loadPreviousModel" 
				class="ai-load-model-btn"
				:disabled="isLoading"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="23 4 23 10 17 10"/>
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
				</svg>
				{{ isLoading ? 'Loading...' : 'Load ' + truncate(previousModelMatch.name, 20) }}
			</button>
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
			<div v-if="agentMode" class="ai-agent-indicator">
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="16 18 22 12 16 6"/>
					<polyline points="8 6 2 12 8 18"/>
				</svg>
				<span v-if="activeFile" class="ai-agent-file-name">Agent · {{ activeFile.name }}</span>
				<span v-else class="ai-agent-no-file">Agent · No file open</span>
			</div>
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
					:disabled="!isReady || isAnyGenerating"
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
					:disabled="!inputMessage.trim() || !isReady || isStreaming"
					title="Send message"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 14L13 21L20 4L3 11L6.5 12.5" stroke="var(--base1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FileInfo } from '../types/electron';
import type { ChatMessage } from '../types/chat';
import { useAIModel } from '../composables/useAIModel';
import { useConversationHistory } from '../composables/useConversationHistory';
import { useAgentMode } from '../composables/useAgentMode';
import { useHfDownload } from '../composables/useHfDownload';
import { useAIChat } from '../composables/useAIChat';

const props = defineProps<{
	activeFile: FileInfo | null;
	workspacePath: string | null;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'file-changed', path: string): void;
}>();

// AI model composable
const model = useAIModel();
const {
	status,
	availableModels,
	isLoading,
	selectedModelPath,
	lastUsedModelName,
	isReady,
	isAnyGenerating,
	selectedModelLabel,
	showDropdown,
	// @ts-ignore - template ref, bound via ref="dropdownRef" in template
	dropdownRef,
	dropdownPosition,
	previousModelMatch,
	truncate,
	toggleDropdown,
	selectModel,
	refreshModels,
	refreshStatus,
	openModelsFolder,
} = model;

// Shared messages state (passed to multiple composables)
const messages = ref<ChatMessage[]>([]);

// Conversation history composable
const conversation = useConversationHistory(status, lastUsedModelName, messages);
const {
	showHistory,
	conversationList,
	currentConversationId,
	conversationTokenCount,
	renamingConversationId,
	renameValue,
	// @ts-ignore - template ref, bound via ref="renameInputRef" in template
	renameInputRef,
	toggleHistory,
	openHistory,
	refreshConversationList,
	createNewConversation,
	saveCurrentConversation,
	saveTokenCountToConversation,
	deleteConversation,
	startRename,
	confirmRename,
	cancelRename,
	formatRelativeDate,
} = conversation;

// Agent mode composable
const agent = useAgentMode(
	messages,
	computed(() => props.workspacePath),
	(path) => emit('file-changed', path)
);
const { agentMode, toggleAgentMode, parseAgentEdits, processAgentEdits, approveAgentEdit, rejectAgentEdit } = agent;

// HF download composable
const hf = useHfDownload(refreshModels);
const {
	showHfPanel,
	hfSearchQuery,
	hfSearchResults,
	hfIsSearching,
	hfSelectedRepo,
	hfRepoFiles,
	hfModelInfo,
	hfIsLoadingFiles,
	hfDownloadProgress,
	hfActiveDownloads,
	toggleHfPanel,
	searchHfModels,
	selectHfRepo,
	downloadHfModel,
	cancelHfDownload,
	formatNumber,
} = hf;

// Chat composable
const chat = useAIChat(
	{ messages, status, conversationTokenCount, currentConversationId, agentMode,
	  activeFile: computed(() => props.activeFile),
	  workspacePath: computed(() => props.workspacePath) },
	{ createNewConversation, saveCurrentConversation, saveTokenCountToConversation,
	  refreshConversationList, refreshStatus, parseAgentEdits, processAgentEdits }
);
const {
	// @ts-ignore - template ref, bound via ref="messagesContainer" in template
	messagesContainer,
	inputField, inputMessage, isStreaming, includeNoteContext,
	copiedIndex, editingIndex, editContent,
	// @ts-ignore - template ref, bound via ref="editInputRef" in template
	editInputRef,
	onMessagesScroll, renderMarkdown, copyMessage,
	startEditMessage, cancelEditMessage, confirmEditMessage,
	resendMessage, deleteLastMessagePair, regenerateLastResponse,
	sendMessage, stopGeneration, scrollToBottom, formatTokenCount,
} = chat;

// Token bar display
const tokenUsagePercent = computed(() => {
	if (!status.value.contextSize) return 0;
	return Math.min(100, Math.round((conversationTokenCount.value / status.value.contextSize) * 100));
});

// ============================
// Orchestration wrappers
// ============================

async function loadSelectedModel() {
	const result = await model.loadModel();
	if (result.success) {
		await startNewConversation();
	} else {
		messages.value.push({ role: 'assistant', content: `Failed to load model: ${result.error}` });
	}
}

async function unloadModel() {
	if (status.value.isGenerating) await stopGeneration();
	await saveCurrentConversation();
	await model.unloadModel();
	conversationTokenCount.value = 0;
}

async function startNewConversation() {
	await conversation.startNewConversation();
	inputField.value?.focus();
}

async function loadConversation(id: string) {
	await conversation.loadConversation(id);
	scrollToBottom();
}

async function loadPreviousModel() {
	const hasConversation = !!currentConversationId.value;
	const history = messages.value.map(m => ({ role: m.role, content: m.content }));
	const result = await model.loadPreviousModel(history, hasConversation);
	if (result.success) {
		if (!hasConversation) await startNewConversation();
		inputField.value?.focus();
	} else if (result.error) {
		messages.value.push({ role: 'assistant', content: `Failed to load model: ${result.error}` });
	}
}

onMounted(async () => {
	await refreshStatus();
	await refreshModels();
	await refreshConversationList();
	if (status.value.isModelLoaded && inputField.value) {
		inputField.value.focus();
	}
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
	
	&:hover .ai-message-actions {
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

		.ai-message-actions {
			justify-content: flex-end;
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

		.ai-message-actions {
			justify-content: flex-start;
		}
	}

	&.system {
		justify-content: center;
		
		.ai-message-wrapper {
			max-width: 95%;
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

// System notice (auto-compaction, etc.)
.ai-system-notice {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	background: var(--bg-secondary, #2a2a2a);
	border: 1px solid var(--border-color, #3a3a3a);
	border-radius: 8px;
	padding: 0.4rem 0.7rem;
	font-size: 0.72rem;
	color: var(--text2, #999);
	font-style: italic;
	white-space: normal;
	
	svg {
		flex-shrink: 0;
		opacity: 0.6;
	}
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

// Message action buttons bar
.ai-message-actions {
	display: flex;
	align-items: center;
	gap: 2px;
	opacity: 0;
	transition: opacity 0.15s;
	margin-top: 3px;
	padding: 0 2px;
}

.ai-btn-action {
	background: none;
	border: none;
	color: var(--text2);
	cursor: pointer;
	padding: 3px 4px;
	border-radius: 4px;
	transition: color 0.15s, background 0.15s;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		color: var(--text1);
		background: var(--bg-hover);
	}

	&.ai-btn-action-danger:hover {
		color: #e55;
	}
}

// Inline edit mode
.ai-message-edit {
	display: flex;
	flex-direction: column;
	gap: 4px;
	width: 100%;
}

.ai-edit-input {
	width: 100%;
	min-height: 2.5rem;
	max-height: 8rem;
	padding: 0.5rem 0.65rem;
	background: var(--bg-primary);
	color: var(--text1);
	border: 1px solid var(--accent-color);
	border-radius: 8px;
	font-size: 0.82rem;
	font-family: inherit;
	line-height: 1.5;
	resize: vertical;
	outline: none;

	&:focus {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 1px var(--accent-color);
	}
}

.ai-edit-actions {
	display: flex;
	justify-content: flex-end;
	gap: 4px;
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

// Agent mode styles
.ai-agent-indicator {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	font-size: 0.7rem;
	color: var(--accent-color);
	padding: 0 0.25rem 0.4rem;
	flex-wrap: wrap;

	svg {
		flex-shrink: 0;
	}

	span {
		font-weight: 600;
		white-space: nowrap;
	}
}

.ai-agent-file-input {
	flex: 1;
	min-width: 120px;
	background: var(--bg-primary);
	color: var(--text1);
	border: 1px solid var(--text3);
	border-radius: 6px;
	padding: 0.2rem 0.4rem;
	font-size: 0.7rem;
	font-family: 'SF Mono', 'Fira Code', monospace;
	outline: none;
	transition: border-color 0.2s;

	&::placeholder {
		color: var(--text2);
	}

	&:focus {
		border-color: var(--accent-color);
	}
}

// Agent edit cards in messages
.ai-agent-edits {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-top: 0.5rem;
	width: 100%;
}

.ai-agent-edit-card {
	background: var(--bg-primary);
	border: 1px solid var(--text3);
	border-radius: 10px;
	overflow: hidden;
	transition: border-color 0.2s;

	&.pending {
		border-color: var(--accent-color);
		border-style: dashed;
	}

	&.approved {
		border-color: #2ecc71;
	}

	&.rejected {
		border-color: #e74c3c;
		opacity: 0.7;
	}

	&.error {
		border-color: #e74c3c;
	}
}

.ai-agent-edit-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 0.65rem;
	border-bottom: 1px solid var(--text3);
	background: rgba(0, 0, 0, 0.05);
}

.ai-agent-edit-file {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	min-width: 0;
	flex: 1;
}

.ai-agent-edit-filename {
	font-size: 0.75rem;
	font-family: 'SF Mono', 'Fira Code', monospace;
	color: var(--text1);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ai-agent-edit-badge {
	font-size: 0.6rem;
	font-weight: 700;
	padding: 0.1rem 0.3rem;
	border-radius: 4px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	flex-shrink: 0;

	&.new {
		background: var(--accent-color);
		color: var(--base1);
	}
}

.ai-agent-status-text {
	font-size: 0.7rem;
	font-weight: 600;
	flex-shrink: 0;

	&.approved {
		color: #2ecc71;
	}

	&.rejected {
		color: #e74c3c;
	}

	&.error {
		color: #e74c3c;
	}
}

.ai-agent-diff-details {
	border-bottom: 1px solid var(--text3);
}

.ai-agent-diff-summary {
	padding: 0.35rem 0.65rem;
	font-size: 0.72rem;
	color: var(--text2);
	cursor: pointer;
	user-select: none;
	transition: color 0.15s;

	&:hover {
		color: var(--text1);
	}
}

.ai-agent-diff {
	max-height: 300px;
	overflow-y: auto;
}

.ai-agent-diff-section {
	&.removed {
		background: rgba(231, 76, 60, 0.08);
	}

	&.added {
		background: rgba(46, 204, 113, 0.08);
	}
}

.ai-agent-diff-label {
	padding: 0.25rem 0.65rem;
	font-size: 0.65rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--text2);
	border-bottom: 1px solid var(--text3);
}

.ai-agent-diff-code {
	padding: 0.5rem 0.65rem;
	font-size: 0.72rem;
	font-family: 'SF Mono', 'Fira Code', monospace;
	line-height: 1.5;
	margin: 0;
	white-space: pre-wrap;
	word-break: break-all;
	color: var(--text1);
	max-height: 140px;
	overflow-y: auto;
}

.ai-agent-edit-error {
	padding: 0.4rem 0.65rem;
	font-size: 0.72rem;
	color: #e74c3c;
	border-bottom: 1px solid var(--text3);
}

.ai-agent-edit-actions {
	display: flex;
	gap: 0.5rem;
	padding: 0.5rem 0.65rem;
}

.ai-agent-btn {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.35rem 0.65rem;
	border: none;
	border-radius: 7px;
	font-size: 0.72rem;
	font-weight: 500;
	cursor: pointer;
	transition: opacity 0.15s, transform 0.1s;
	flex: 1;
	justify-content: center;

	&:hover {
		opacity: 0.85;
		transform: scale(1.02);
	}

	&.approve {
		background: #2ecc71;
		color: #fff;
	}

	&.reject {
		background: #e74c3c;
		color: #fff;
	}
}

// Load model banner
.ai-load-model-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	background: var(--bg-primary);
	border-top: 1px solid var(--text3);
	flex-shrink: 0;
}

.ai-load-model-banner-content {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.72rem;
	color: var(--text2);

	svg {
		flex-shrink: 0;
		opacity: 0.7;
	}
}

.ai-load-model-btn {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.3rem 0.6rem;
	background: var(--accent-color);
	color: var(--base1);
	border: none;
	border-radius: 7px;
	font-size: 0.7rem;
	font-weight: 600;
	cursor: pointer;
	white-space: nowrap;
	transition: opacity 0.15s, transform 0.1s;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		opacity: 0.85;
		transform: scale(1.02);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	svg {
		flex-shrink: 0;
	}
}

// HF Download Panel
.ai-hf-panel {
	flex-shrink: 0;
	max-height: 50%;
	display: flex;
	flex-direction: column;
	border-bottom: 1px solid var(--text3);
	-webkit-app-region: no-drag;
}

.ai-hf-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 0.75rem 0.35rem;
}

.ai-hf-title {
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--text2);
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.ai-hf-search-bar {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	margin: 0 0.5rem 0.4rem;
	background: var(--bg-primary);
	border: 1px solid var(--text3);
	border-radius: 8px;
	padding: 0.15rem 0.15rem 0.15rem 0.5rem;

	&:focus-within {
		border-color: var(--accent-color);
	}
}

.ai-hf-search-input {
	flex: 1;
	min-width: 0;
	padding: 0.3rem 0;
	background: transparent;
	color: var(--text1);
	border: none;
	font-size: 0.75rem;
	font-family: inherit;
	outline: none;

	&::placeholder {
		color: var(--text2);
	}
}

.ai-hf-back-btn {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.3rem 0.6rem;
	margin: 0 0.5rem 0.3rem;
	background: none;
	border: none;
	color: var(--text2);
	font-size: 0.72rem;
	cursor: pointer;
	border-radius: 6px;
	transition: all 0.15s;

	&:hover {
		color: var(--text1);
		background: var(--bg-hover);
	}
}

.ai-hf-results {
	flex: 1;
	overflow-y: auto;
	padding: 0 0.5rem 0.5rem;
}

.ai-hf-loading {
	font-size: 0.75rem;
	color: var(--text2);
	text-align: center;
	padding: 1rem 0;
}

.ai-hf-empty {
	font-size: 0.75rem;
	color: var(--text2);
	text-align: center;
	padding: 1rem 0;
}

.ai-hf-result-item {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.5rem 0.55rem;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.12s;

	&:hover {
		background: var(--bg-hover);
	}
}

.ai-hf-result-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
}

.ai-hf-result-name {
	font-size: 0.75rem;
	color: var(--text1);
	word-break: break-word;
	line-height: 1.3;
}

.ai-hf-result-meta {
	display: flex;
	gap: 0.5rem;
	font-size: 0.65rem;
	color: var(--text2);
	opacity: 0.7;
}

.ai-hf-repo-header {
	padding: 0.3rem 0.55rem 0.5rem;

	.ai-hf-repo-title {
		display: block;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text1);
		word-break: break-word;
	}

	.ai-hf-model-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.35rem;

		.ai-hf-meta-tag {
			font-size: 0.62rem;
			color: var(--text2);
			background: var(--bg-hover);
			padding: 0.15rem 0.4rem;
			border-radius: 4px;
			white-space: nowrap;
			display: inline-flex;
			align-items: center;
			gap: 0.2rem;

			svg {
				flex-shrink: 0;
				opacity: 0.7;
			}
		}
	}
}

.ai-hf-file-item {
	display: flex;
	align-items: flex-start;
	gap: 0.35rem;
	padding: 0.45rem 0.55rem;
	border-radius: 8px;
	transition: background 0.12s;

	&:hover {
		background: var(--bg-hover);
	}
}

.ai-hf-file-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}

.ai-hf-file-top-row {
	display: flex;
	align-items: center;
	gap: 0.3rem;
}

.ai-hf-file-name {
	font-size: 0.72rem;
	color: var(--text1);
	word-break: break-all;
	line-height: 1.3;
	font-family: 'SF Mono', 'Fira Code', monospace;
}

.ai-hf-tier-badge {
	font-size: 0.58rem;
	font-weight: 600;
	padding: 0.08rem 0.35rem;
	border-radius: 4px;
	white-space: nowrap;
	flex-shrink: 0;

	&.ai-hf-tier-green {
		background: rgba(40, 167, 69, 0.15);
		color: #28a745;
	}
	&.ai-hf-tier-blue {
		background: rgba(0, 123, 255, 0.15);
		color: #007bff;
	}
	&.ai-hf-tier-orange {
		background: rgba(255, 165, 0, 0.15);
		color: #e69500;
	}
	&.ai-hf-tier-red {
		background: rgba(220, 53, 69, 0.15);
		color: #dc3545;
	}
}

.ai-hf-file-details {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
	align-items: center;
}

.ai-hf-file-size {
	font-size: 0.62rem;
	color: var(--text2);
}

.ai-hf-quant-badge {
	font-size: 0.58rem;
	font-weight: 500;
	background: rgba(108, 117, 125, 0.15);
	color: var(--text2);
	padding: 0.05rem 0.3rem;
	border-radius: 3px;
	font-family: 'SF Mono', 'Fira Code', monospace;
}

.ai-hf-ram-estimate {
	font-size: 0.6rem;
	color: var(--text2);
	opacity: 0.85;
}

.ai-hf-shard-info {
	font-size: 0.58rem;
	color: var(--text2);
	opacity: 0.7;
	font-style: italic;
}

.ai-hf-file-actions {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	flex-shrink: 0;
	margin-top: 0.15rem;
}

.ai-hf-download-btn {
	background: none;
	border: 1px solid var(--accent-color);
	color: var(--accent-color);
	cursor: pointer;
	padding: 0.25rem;
	border-radius: 5px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.2rem;
	transition: all 0.15s;

	&:hover {
		background: var(--accent-color);
		color: var(--base1);
	}

	&.ai-hf-download-sharded {
		padding: 0.2rem 0.4rem;
	}

	.ai-hf-download-label {
		font-size: 0.58rem;
		font-weight: 600;
	}
}

.ai-hf-progress {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	min-width: 60px;
}

.ai-hf-progress-bar {
	flex: 1;
	height: 3px;
	background: var(--text3);
	border-radius: 2px;
	overflow: hidden;
}

.ai-hf-progress-fill {
	height: 100%;
	background: var(--accent-color);
	border-radius: 2px;
	transition: width 0.3s ease;
}

.ai-hf-progress-text {
	font-size: 0.62rem;
	color: var(--text2);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}
</style>
