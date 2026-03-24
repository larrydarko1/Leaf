<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    filePath: string;
}>();

const hasError = ref(false);
const pdfUrl = ref('');

watch(
    () => props.filePath,
    (path) => {
        hasError.value = false;
        pdfUrl.value = `leaf://localhost${path}`;
    },
    { immediate: true },
);
</script>

<template>
    <div class="pdf-viewer">
        <iframe v-if="pdfUrl && !hasError" :src="pdfUrl" class="pdf-preview" @error="hasError = true" />
        <div v-if="hasError" class="pdf-error">
            <p>Failed to load PDF</p>
            <p class="pdf-error-hint">This file may be corrupted or in an unsupported format</p>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.pdf-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
    background: var(--base1);
    position: relative;
}

.pdf-preview {
    width: 100%;
    height: 100%;
    border: none;
    position: relative;
    z-index: 1;
}

.pdf-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    position: relative;
    z-index: 1;

    p {
        margin: 0.5rem 0;
        font-size: 1rem;
    }

    .pdf-error-hint {
        font-size: 0.85rem;
        opacity: 0.7;
    }
}
</style>
