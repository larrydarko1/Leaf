<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
    <div
        class="pdf-viewer"
        role="region"
        :aria-label="t('editor.pdf_viewer')">
        <!-- PDF preview area -->
        <iframe
            v-if="pdfUrl && !hasError"
            :src="pdfUrl"
            class="pdf-preview"
            title="PDF document"
            :aria-label="t('editor.pdf_viewer')"
            @error="hasError = true" />

        <!-- Error state fallback -->
        <section
            v-if="hasError"
            class="pdf-error"
            role="alert"
            aria-live="polite">
            <h2>{{ t('editor.pdf_load_error') }}</h2>
            <p>{{ t('editor.failed_to_load_pdf') }}</p>
            <p class="pdf-error-hint">{{ t('editor.pdf_format_not_supported') }}</p>
        </section>
    </div>
</template>

<style lang="scss" scoped>
/* ––– PDF Viewer Container ––– */

.pdf-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
    background: $base1;
    position: relative;
}

/* ––– PDF Preview ––– */

.pdf-preview {
    width: 100%;
    height: 100%;
    border: none;
    position: relative;
    z-index: $z-normal;
}

/* ––– Error State ––– */

.pdf-error {
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

    .pdf-error-hint {
        font-size: $font-size-sm;
        opacity: 0.7;
    }
}
</style>
