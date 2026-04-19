/**
 * useTextEditing — manages inline text creation and editing on the drawing canvas,
 * including overlay positioning and commit logic.
 */

import { ref, computed, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { CanvasElement, StrokeStyle } from '../../types/drawing';

interface DefaultStyle {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    borderRadius: number;
    fontSize: number;
}

export function useTextEditing(
    // DOM refs
    canvas: Ref<HTMLCanvasElement | null>,
    textInputEl: Ref<HTMLTextAreaElement | null>,
    // View state
    zoom: Ref<number>,
    // Element state
    elements: Ref<CanvasElement[]>,
    selectedId: Ref<string | null>,
    // Element helpers
    getElementBounds: (el: CanvasElement) => { x: number; y: number; width: number; height: number },
    hitTestElement: (wx: number, wy: number, zoom: number) => CanvasElement | null,
    isShapeElement: (el: CanvasElement) => boolean,
    genId: () => string,
    // Style state
    defaultStyle: Ref<DefaultStyle>,
    // Renderer helpers
    worldToScreen: (wx: number, wy: number) => { x: number; y: number },
    screenToWorld: (sx: number, sy: number) => { x: number; y: number },
    getCtx: () => CanvasRenderingContext2D | null,
    renderScene: () => void,
    // History / persistence callbacks
    saveToHistory: () => void,
    scheduleAutoSave: () => void,
) {
    // State

    const textEditing = ref(false);
    const textValue = ref('');
    const textWorldPos = ref({ x: 0, y: 0 });
    const editingElementId = ref<string | null>(null);
    const textEditCentered = ref(false);
    const textEditBounds = ref<{ x: number; y: number; width: number; height: number } | null>(null);
    const textEditFontSize = ref(20);
    const textEditColor = ref('');

    // Computed

    const textOverlayStyle = computed(() => {
        const screen = worldToScreen(textWorldPos.value.x, textWorldPos.value.y);
        const fontSize = (textEditFontSize.value || defaultStyle.value.fontSize) * zoom.value;
        const style: Record<string, string> = {
            fontSize: fontSize + 'px',
            lineHeight: fontSize * 1.3 + 'px',
            color: textEditColor.value || defaultStyle.value.strokeColor,
            textAlign: textEditCentered.value ? 'center' : 'left',
        };
        if (textEditCentered.value && textEditBounds.value) {
            const tl = worldToScreen(textEditBounds.value.x, textEditBounds.value.y);
            const br = worldToScreen(
                textEditBounds.value.x + textEditBounds.value.width,
                textEditBounds.value.y + textEditBounds.value.height,
            );
            const pad = 8 * zoom.value;
            style.left = tl.x + pad + 'px';
            style.top = tl.y + pad + 'px';
            style.width = br.x - tl.x - pad * 2 + 'px';
            style.height = br.y - tl.y - pad * 2 + 'px';
        } else {
            style.left = screen.x + 'px';
            style.top = screen.y + 'px';
        }
        return style;
    });

    // Entry points

    function startNewText(wx: number, wy: number) {
        selectedId.value = null;
        textEditing.value = true;
        textValue.value = '';
        textWorldPos.value = { x: wx, y: wy };
        editingElementId.value = null;
        textEditCentered.value = false;
        textEditBounds.value = null;
        textEditFontSize.value = defaultStyle.value.fontSize;
        textEditColor.value = defaultStyle.value.strokeColor;
        nextTick(() => textInputEl.value?.focus());
    }

    function startEditText(el: CanvasElement) {
        selectedId.value = null;
        textEditing.value = true;
        textValue.value = el.text || '';
        textWorldPos.value = { x: el.x, y: el.y };
        editingElementId.value = el.id;
        textEditCentered.value = false;
        textEditBounds.value = null;
        textEditFontSize.value = el.fontSize || defaultStyle.value.fontSize;
        textEditColor.value = el.strokeColor;
        nextTick(() => textInputEl.value?.focus());
    }

    function startEditShapeText(el: CanvasElement) {
        selectedId.value = el.id;
        textEditing.value = true;
        textValue.value = el.text || '';
        const bounds = getElementBounds(el);
        textWorldPos.value = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        editingElementId.value = el.id;
        textEditCentered.value = true;
        textEditBounds.value = { ...bounds };
        textEditFontSize.value = el.fontSize || 16;
        textEditColor.value = el.strokeColor;
        nextTick(() => textInputEl.value?.focus());
    }

    function cancelText() {
        textEditing.value = false;
        editingElementId.value = null;
        textEditCentered.value = false;
        textEditBounds.value = null;
        renderScene();
    }

    function onTextEnter(e: KeyboardEvent) {
        if (!e.shiftKey) {
            e.preventDefault();
            finalizeText();
        }
    }

    function finalizeText() {
        if (!textEditing.value) return;
        const txt = textValue.value.trim();
        const wasCentered = textEditCentered.value;
        textEditing.value = false;

        if (!txt) {
            if (editingElementId.value && !wasCentered) {
                const el = elements.value.find((e) => e.id === editingElementId.value);
                if (el && el.type === 'text') {
                    elements.value = elements.value.filter((el) => el.id !== editingElementId.value);
                    if (selectedId.value === editingElementId.value) selectedId.value = null;
                }
            }
            if (editingElementId.value && wasCentered) {
                const el = elements.value.find((e) => e.id === editingElementId.value);
                if (el) {
                    el.text = undefined;
                    el.fontSize = undefined;
                }
            }
            editingElementId.value = null;
            textEditCentered.value = false;
            textEditBounds.value = null;
            saveToHistory();
            scheduleAutoSave();
            renderScene();
            return;
        }

        // Measure text dimensions using the canvas context
        const ctx = getCtx();
        if (!ctx) return;
        const fs = textEditFontSize.value || defaultStyle.value.fontSize;
        ctx.save();
        ctx.font = `${fs}px "Helvetica", "Segoe UI", sans-serif`;
        const lines = txt.split('\n');
        const lh = fs * 1.3;
        let maxW = 0;
        for (const line of lines) {
            maxW = Math.max(maxW, ctx.measureText(line).width);
        }
        ctx.restore();

        if (editingElementId.value) {
            const el = elements.value.find((e) => e.id === editingElementId.value);
            if (el) {
                el.text = txt;
                el.fontSize = fs;
                if (el.type === 'text') {
                    el.width = maxW;
                    el.height = lines.length * lh;
                }
            }
        } else {
            const el: CanvasElement = {
                id: genId(),
                type: 'text',
                x: textWorldPos.value.x,
                y: textWorldPos.value.y,
                width: maxW,
                height: lines.length * lh,
                strokeColor: textEditColor.value || defaultStyle.value.strokeColor,
                fillColor: 'transparent',
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
                text: txt,
                fontSize: fs,
            };
            elements.value.push(el);
            selectedId.value = el.id;
        }

        editingElementId.value = null;
        textEditCentered.value = false;
        textEditBounds.value = null;
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    // Double-click handler

    function onDoubleClick(e: MouseEvent) {
        const rect = canvas.value!.getBoundingClientRect();
        const worldPt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);

        if (hit) {
            if (hit.type === 'text') {
                startEditText(hit);
            } else if (isShapeElement(hit)) {
                startEditShapeText(hit);
            }
        } else {
            startNewText(worldPt.x, worldPt.y);
        }
    }

    return {
        textEditing,
        textValue,
        textOverlayStyle,
        startNewText,
        startEditText,
        startEditShapeText,
        cancelText,
        onTextEnter,
        finalizeText,
        onDoubleClick,
    };
}
