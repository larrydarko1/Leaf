<template>
	<div id="app" :class="currentTheme">
		<div class="leaf-app">
			<header class="app-header">
				<h1 class="app-title">Leaf</h1>
				<p class="app-subtitle">Local-first note-taking</p>
			</header>
			
			<main class="app-main">
				<div class="welcome-container">
					<p>placeholder.</p>
				</div>
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const currentTheme = ref('dark');
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

.app-header {
	padding: 2rem;
	text-align: center;
	border-bottom: 1px solid var(--border-color);
	background: var(--bg-secondary);
}

.app-title {
	font-size: 2.5rem;
	font-weight: 600;
	margin: 0;
	color: var(--text-primary);
}

.app-subtitle {
	font-size: 1rem;
	color: var(--text-secondary);
	margin: 0.5rem 0 0 0;
}

.app-main {
	flex: 1;
	overflow-y: auto;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2rem;
}

.welcome-container {
	text-align: center;
	color: var(--text-secondary);
}

// Dark theme variables (default)
.dark {
	--bg-primary: #1a1a1a;
	--bg-secondary: #242424;
	--bg-tertiary: #2d2d2d;
	--bg-hover: #383838;
	--text-primary: #e0e0e0;
	--text-secondary: #a0a0a0;
	--border-color: #383838;
	--accent-color: #6b9b6e;
	--accent-hover: #7cb37f;
}
</style>
