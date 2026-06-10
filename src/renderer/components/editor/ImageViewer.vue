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
    <div
        class="image-viewer"
        role="region"
        aria-label="Image viewer">
        <!-- Loading state -->
        <div
            v-if="isLoading"
            class="image-loading"
            aria-live="polite"
            aria-busy="true">
            <p>Loading image...</p>
        </div>

        <!-- Image preview -->
        <img
            v-else-if="imageUrl && !hasError"
            :src="imageUrl"
            :alt="fileName"
            class="image-preview"
            @load="hasError = false"
            @error="hasError = true" />

        <!-- Error state fallback -->
        <section
            v-if="hasError"
            class="image-error"
            role="alert"
            aria-live="polite">
            <h2>Image Load Error</h2>
            <p>Failed to load image</p>
        </section>
    </div>
</template>

<style lang="scss" scoped>
/* ––– Image Viewer Container ––– */

.image-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $space-8;
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

/* ––– Image Preview ––– */

.image-preview {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: $border-radius-lg;
    position: relative;
    z-index: $z-normal;
}

/* ––– Loading State ––– */

.image-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: $z-normal;

    p {
        margin: $space-2 0;
        font-size: $font-size-base;
    }
}

/* ––– Error State ––– */

.image-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: $z-normal;

    p {
        margin: $space-2 0;
        font-size: $font-size-base;
    }
}
</style>
