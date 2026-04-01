<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    filePath: string;
    fileName: string;
}>();

const imageUrl = ref('');
const isLoading = ref(false);
const hasError = ref(false);

async function loadImage(path: string) {
    isLoading.value = true;
    hasError.value = false;
    imageUrl.value = '';
    try {
        const result = await window.electronAPI.readImage(path);
        if (result.success && result.dataUrl) {
            imageUrl.value = result.dataUrl;
        } else {
            hasError.value = true;
        }
    } catch {
        hasError.value = true;
    } finally {
        isLoading.value = false;
    }
}

watch(
    () => props.filePath,
    (path) => loadImage(path),
    { immediate: true },
);
</script>

<template>
    <div class="image-viewer">
        <div v-if="isLoading" class="image-loading">
            <p>Loading image...</p>
        </div>
        <img
            v-else-if="imageUrl && !hasError"
            :src="imageUrl"
            :alt="fileName"
            class="image-preview"
            @load="hasError = false"
            @error="hasError = true"
        />
        <div v-if="hasError" class="image-error">
            <p>Failed to load image</p>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.image-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: auto;
    background: $base1;
    position: relative;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: url('../../assets/images/pattern.png');
        background-size: cover;
        background-position: center;
        opacity: 0.01;
        pointer-events: none;
    }
}

.image-preview {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    position: relative;
    z-index: 1;
}

.image-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: 1;

    p {
        margin: 0.5rem 0;
        font-size: 1rem;
    }
}

.image-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: 1;

    p {
        margin: 0.5rem 0;
        font-size: 1rem;
    }
}
</style>
