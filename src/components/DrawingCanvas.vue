<template>
  <div class="drawing-canvas-container">
    <!-- Toolbar -->
    <div class="drawing-toolbar">
      <div class="tool-group">
        <!-- Pen Tool -->
        <button 
          @click="currentTool = 'pen'" 
          class="tool-btn" 
          :class="{ active: currentTool === 'pen' }"
          title="Pen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
        </button>
        
        <!-- Eraser Tool -->
        <button 
          @click="currentTool = 'eraser'" 
          class="tool-btn" 
          :class="{ active: currentTool === 'eraser' }"
          title="Eraser"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 18"></path>
          </svg>
        </button>
      </div>
      
      <span class="toolbar-divider"></span>
      
      <!-- Colors -->
      <div class="tool-group colors">
        <button 
          v-for="color in colors" 
          :key="color"
          @click="currentColor = color"
          class="color-btn"
          :class="{ active: currentColor === color }"
          :style="{ backgroundColor: color }"
          :title="color"
        ></button>
      </div>
      
      <span class="toolbar-divider"></span>
      
      <!-- Brush Sizes -->
      <div class="tool-group sizes">
        <button 
          v-for="size in brushSizes" 
          :key="size.value"
          @click="brushSize = size.value"
          class="size-btn"
          :class="{ active: brushSize === size.value }"
          :title="size.label"
        >
          <span class="size-dot" :style="{ width: size.value + 'px', height: size.value + 'px' }"></span>
        </button>
      </div>
      
      <span class="toolbar-divider"></span>
      
      <!-- Actions -->
      <div class="tool-group">
        <button 
          @click="undo" 
          class="tool-btn" 
          :disabled="historyIndex <= 0"
          title="Undo (Cmd+Z)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6"></path>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
          </svg>
        </button>
        
        <button 
          @click="redo" 
          class="tool-btn" 
          :disabled="historyIndex >= history.length - 1"
          title="Redo (Cmd+Shift+Z)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 7v6h-6"></path>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
          </svg>
        </button>
        
        <button 
          @click="clearCanvas" 
          class="tool-btn"
          title="Clear All"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      
      <div class="toolbar-spacer"></div>
      
      <!-- Save indicator -->
      <div class="save-status">
        <span v-if="isSaving" class="saving">Saving...</span>
        <span v-else-if="hasUnsavedChanges" class="unsaved">Unsaved</span>
      </div>
    </div>
    
    <!-- Canvas -->
    <div class="canvas-wrapper" ref="canvasWrapper">
      <canvas
        ref="canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart.prevent="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend.prevent="stopDrawing"
        :class="{ 'eraser-cursor': currentTool === 'eraser' }"
      ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

interface Stroke {
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

interface DrawingData {
  version: number;
  strokes: Stroke[];
  backgroundColor: string;
}

const props = defineProps<{
  filePath: string;
  initialContent?: string;
}>();

const emit = defineEmits<{
  save: [content: string];
  contentChanged: [hasChanges: boolean];
}>();

// Canvas refs
const canvas = ref<HTMLCanvasElement | null>(null);
const canvasWrapper = ref<HTMLDivElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;

// Drawing state
const isDrawing = ref(false);
const currentTool = ref<'pen' | 'eraser'>('pen');
const currentColor = ref('#ffffff');
const brushSize = ref(4);
const backgroundColor = '#1a1a1a';

// History for undo/redo
const strokes = ref<Stroke[]>([]);
const currentStroke = ref<Stroke | null>(null);
const history = ref<Stroke[][]>([]);
const historyIndex = ref(-1);

// Save state
const hasUnsavedChanges = ref(false);
const isSaving = ref(false);
let autoSaveTimeout: number | null = null;

// Colors palette
const colors = [
  '#ffffff', // White
  '#9ca3af', // Gray
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

// Brush sizes
const brushSizes = [
  { label: 'Small', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Large', value: 8 },
  { label: 'XL', value: 16 },
];

// Initialize canvas
onMounted(() => {
  setupCanvas();
  loadDrawing();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeydown);
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
});

// Watch for file changes
watch(() => props.filePath, () => {
  loadDrawing();
});

watch(() => props.initialContent, () => {
  loadDrawing();
});

function setupCanvas() {
  if (!canvas.value || !canvasWrapper.value) return;
  
  ctx = canvas.value.getContext('2d');
  if (!ctx) return;
  
  // Set canvas size to fill container
  const rect = canvasWrapper.value.getBoundingClientRect();
  canvas.value.width = rect.width;
  canvas.value.height = rect.height;
  
  // Set up context
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Fill with background color
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
}

function handleResize() {
  if (!canvas.value || !canvasWrapper.value || !ctx) return;
  
  // Resize canvas
  const rect = canvasWrapper.value.getBoundingClientRect();
  canvas.value.width = rect.width;
  canvas.value.height = rect.height;
  
  // Restore background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
  
  // Redraw all strokes
  redrawAllStrokes();
}

function loadDrawing() {
  if (!props.initialContent || !ctx || !canvas.value) {
    // Reset for new drawing
    strokes.value = [];
    history.value = [[]];
    historyIndex.value = 0;
    hasUnsavedChanges.value = false;
    nextTick(() => {
      if (ctx && canvas.value) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
      }
    });
    return;
  }
  
  try {
    const data: DrawingData = JSON.parse(props.initialContent);
    strokes.value = data.strokes || [];
    history.value = [JSON.parse(JSON.stringify(strokes.value))];
    historyIndex.value = 0;
    hasUnsavedChanges.value = false;
    redrawAllStrokes();
  } catch (e) {
    console.error('Failed to load drawing:', e);
    strokes.value = [];
    history.value = [[]];
    historyIndex.value = 0;
  }
}

function redrawAllStrokes() {
  if (!ctx || !canvas.value) return;
  
  // Clear and fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
  
  // Redraw all strokes
  for (const stroke of strokes.value) {
    drawStroke(stroke);
  }
}

function drawStroke(stroke: Stroke) {
  if (!ctx || stroke.points.length < 2) return;
  
  ctx.beginPath();
  ctx.strokeStyle = stroke.tool === 'eraser' ? backgroundColor : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  
  ctx.stroke();
}

function getCanvasPoint(e: MouseEvent | Touch): { x: number; y: number } {
  if (!canvas.value) return { x: 0, y: 0 };
  
  const rect = canvas.value.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startDrawing(e: MouseEvent) {
  isDrawing.value = true;
  const point = getCanvasPoint(e);
  
  currentStroke.value = {
    tool: currentTool.value,
    color: currentColor.value,
    size: currentTool.value === 'eraser' ? brushSize.value * 3 : brushSize.value,
    points: [point]
  };
  
  // Draw a dot for single click
  if (ctx) {
    ctx.beginPath();
    ctx.fillStyle = currentTool.value === 'eraser' ? backgroundColor : currentColor.value;
    ctx.arc(point.x, point.y, currentStroke.value.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw(e: MouseEvent) {
  if (!isDrawing.value || !currentStroke.value || !ctx) return;
  
  const point = getCanvasPoint(e);
  currentStroke.value.points.push(point);
  
  // Draw line segment
  const points = currentStroke.value.points;
  if (points.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = currentTool.value === 'eraser' ? backgroundColor : currentColor.value;
    ctx.lineWidth = currentStroke.value.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
}

function stopDrawing() {
  if (!isDrawing.value || !currentStroke.value) return;
  
  isDrawing.value = false;
  
  // Only save stroke if it has points
  if (currentStroke.value.points.length > 0) {
    strokes.value.push(currentStroke.value);
    saveToHistory();
    scheduleAutoSave();
  }
  
  currentStroke.value = null;
}

// Touch handlers
function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    isDrawing.value = true;
    const point = getCanvasPoint(touch);
    
    currentStroke.value = {
      tool: currentTool.value,
      color: currentColor.value,
      size: currentTool.value === 'eraser' ? brushSize.value * 3 : brushSize.value,
      points: [point]
    };
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!isDrawing.value || !currentStroke.value || !ctx || e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const point = getCanvasPoint(touch);
  currentStroke.value.points.push(point);
  
  // Draw line segment
  const points = currentStroke.value.points;
  if (points.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = currentTool.value === 'eraser' ? backgroundColor : currentColor.value;
    ctx.lineWidth = currentStroke.value.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
}

// History management
function saveToHistory() {
  // Remove any future history if we're not at the end
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1);
  }
  
  // Add current state to history
  history.value.push(JSON.parse(JSON.stringify(strokes.value)));
  historyIndex.value = history.value.length - 1;
  
  // Limit history size
  if (history.value.length > 50) {
    history.value.shift();
    historyIndex.value--;
  }
}

function undo() {
  if (historyIndex.value <= 0) return;
  
  historyIndex.value--;
  strokes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
  redrawAllStrokes();
  scheduleAutoSave();
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) return;
  
  historyIndex.value++;
  strokes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
  redrawAllStrokes();
  scheduleAutoSave();
}

function clearCanvas() {
  strokes.value = [];
  if (ctx && canvas.value) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
  }
  saveToHistory();
  scheduleAutoSave();
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  }
}

// Auto-save
function scheduleAutoSave() {
  hasUnsavedChanges.value = true;
  emit('contentChanged', true);
  
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  autoSaveTimeout = window.setTimeout(() => {
    saveDrawing();
  }, 1000);
}

function saveDrawing() {
  const data: DrawingData = {
    version: 1,
    strokes: strokes.value,
    backgroundColor: backgroundColor
  };
  
  isSaving.value = true;
  emit('save', JSON.stringify(data, null, 2));
  
  setTimeout(() => {
    isSaving.value = false;
    hasUnsavedChanges.value = false;
    emit('contentChanged', false);
  }, 300);
}
</script>

<style scoped lang="scss">
.drawing-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
}

.drawing-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--base1);
  border-bottom: 1px solid color-mix(in srgb, var(--text3) 60%, transparent);
  -webkit-app-region: no-drag;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  &.colors {
    gap: 0.35rem;
  }
  
  &.sizes {
    gap: 0.5rem;
  }
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--text3);
  opacity: 0.3;
  margin: 0 0.25rem;
}

.toolbar-spacer {
  flex: 1;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--text2) 15%, transparent);
    color: var(--text1);
  }
  
  &.active {
    background: var(--base2);
    color: var(--base1);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.color-btn {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    transform: scale(1.15);
  }
  
  &.active {
    border-color: var(--text1);
    transform: scale(1.15);
  }
}

.size-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: color-mix(in srgb, var(--text2) 15%, transparent);
  }
  
  &.active {
    background: color-mix(in srgb, var(--text2) 25%, transparent);
  }
  
  .size-dot {
    background: var(--text1);
    border-radius: 50%;
  }
}

.save-status {
  font-size: 0.75rem;
  
  .saving {
    color: var(--text2);
    font-style: italic;
  }
  
  .unsaved {
    color: var(--base2);
  }
}

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

canvas {
  display: block;
  cursor: crosshair;
  
  &.eraser-cursor {
    cursor: cell;
  }
}
</style>
