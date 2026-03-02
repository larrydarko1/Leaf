<template>
  <div
    class="excalidraw-container"
    ref="containerEl"
    tabindex="0"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @contextmenu.prevent
  >
    <!-- Floating Toolbar -->
    <div class="floating-toolbar">
      <div class="toolbar-inner">
        <!-- Selection -->
        <button
          @click="selectTool('select')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'select' }"
          title="Selection — V"
        >
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" fill="currentColor"/></svg>
        </button>

        <!-- Hand -->
        <button
          @click="selectTool('hand')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'hand' }"
          title="Hand (Pan) — H"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 9.5V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7 20.64A4 4 0 0 0 9.83 22H15a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"/></svg>
        </button>

        <span class="toolbar-sep"></span>

        <!-- Rectangle -->
        <button
          @click="selectTool('rectangle')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'rectangle' }"
          title="Rectangle — R"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>

        <!-- Diamond -->
        <button
          @click="selectTool('diamond')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'diamond' }"
          title="Diamond — D"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 22,12 12,22 2,12"/></svg>
        </button>

        <!-- Ellipse -->
        <button
          @click="selectTool('ellipse')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'ellipse' }"
          title="Ellipse — O"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg>
        </button>

        <!-- Triangle -->
        <button
          @click="selectTool('triangle')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'triangle' }"
          title="Triangle — T"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,3 22,21 2,21"/></svg>
        </button>

        <!-- Arrow -->
        <button
          @click="selectTool('arrow')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'arrow' }"
          title="Arrow — A"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="10,5 19,5 19,14"/></svg>
        </button>

        <!-- Line -->
        <button
          @click="selectTool('line')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'line' }"
          title="Line — L"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>
        </button>

        <span class="toolbar-sep"></span>

        <!-- Freedraw -->
        <button
          @click="selectTool('freedraw')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'freedraw' }"
          title="Pen — P"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>

        <!-- Text -->
        <button
          @click="selectTool('text')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'text' }"
          title="Text — X"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9.5" y1="20" x2="14.5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        </button>

        <!-- Eraser -->
        <button
          @click="selectTool('eraser')"
          class="toolbar-btn"
          :class="{ active: currentTool === 'eraser' }"
          title="Eraser — E"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 18"/></svg>
        </button>

        <span class="toolbar-sep"></span>

        <!-- Architecture shapes dropdown -->
        <div class="arch-dropdown" ref="archDropdownEl">
          <button
            @click="toggleArchDropdown"
            class="toolbar-btn"
            :class="{ active: isArchTool }"
            title="Architecture Shapes"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
            </svg>
          </button>
          <transition name="panel-fade">
            <div v-if="archDropdownOpen" class="arch-dropdown-menu">
              <button
                v-for="shape in archShapes"
                :key="shape.tool"
                @click="selectArchTool(shape.tool)"
                class="arch-shape-btn"
                :class="{ active: currentTool === shape.tool }"
                :title="shape.label"
              >
                <span class="arch-shape-icon" v-html="shape.icon"></span>
                <span class="arch-shape-label">{{ shape.label }}</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Properties Panel (left) -->
    <transition name="panel-fade">
      <div v-if="shouldShowProperties" class="properties-panel">
        <!-- Stroke Color -->
        <div class="prop-section">
          <div class="prop-label">Stroke</div>
          <div class="color-grid">
            <button
              v-for="c in strokeColorPalette"
              :key="'s-' + c"
              @click="setProperty('strokeColor', c)"
              class="color-swatch"
              :class="{ active: activeStrokeColor === c }"
              :style="{ background: c }"
            />
          </div>
        </div>

        <!-- Fill Color (only for shapes) -->
        <div class="prop-section" v-if="showFillOption">
          <div class="prop-label">Background</div>
          <div class="color-grid">
            <button
              @click="setProperty('fillColor', 'transparent')"
              class="color-swatch transparent-swatch"
              :class="{ active: activeFillColor === 'transparent' }"
            >
              <svg width="16" height="16" viewBox="0 0 16 16"><line x1="0" y1="16" x2="16" y2="0" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button
              v-for="c in fillColorPalette"
              :key="'f-' + c"
              @click="setProperty('fillColor', c)"
              class="color-swatch"
              :class="{ active: activeFillColor === c }"
              :style="{ background: c }"
            />
          </div>
        </div>

        <!-- Stroke Width -->
        <div class="prop-section">
          <div class="prop-label">Stroke width</div>
          <div class="stroke-width-row">
            <button
              v-for="w in strokeWidthOptions"
              :key="w"
              @click="setProperty('strokeWidth', w)"
              class="stroke-width-btn"
              :class="{ active: activeStrokeWidth === w }"
            >
              <span class="stroke-preview" :style="{ height: w + 'px' }"></span>
            </button>
          </div>
        </div>

        <!-- Stroke Style -->
        <div class="prop-section">
          <div class="prop-label">Stroke style</div>
          <div class="stroke-style-row">
            <button
              v-for="s in strokeStyleOptions"
              :key="s.value"
              @click="setProperty('strokeStyle', s.value)"
              class="stroke-style-btn"
              :class="{ active: activeStrokeStyle === s.value }"
              :title="s.label"
            >
              <svg width="40" height="6" viewBox="0 0 40 6">
                <line x1="0" y1="3" x2="40" y2="3" stroke="currentColor" stroke-width="2" :stroke-dasharray="s.dash"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Roundness -->
        <div class="prop-section" v-if="showRoundnessOption">
          <div class="prop-label">Roundness</div>
          <div class="roundness-row">
            <button
              v-for="r in borderRadiusOptions"
              :key="r.value"
              @click="setProperty('borderRadius', r.value)"
              class="roundness-btn"
              :class="{ active: activeBorderRadius === r.value }"
              :title="r.label"
            >
              <svg v-if="r.icon === 'sharp'" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="16" height="16"/>
              </svg>
              <svg v-else-if="r.icon === 'round'" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="16" height="16" rx="4"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="16" height="16" rx="8"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Canvas -->
    <canvas
      ref="canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @dblclick="onDoubleClick"
      @wheel.prevent="onWheel"
      :style="{ cursor: canvasCursor }"
    />

    <!-- Text Editing Overlay -->
    <textarea
      v-if="textEditing"
      ref="textInputEl"
      v-model="textValue"
      class="text-edit-overlay"
      :style="textOverlayStyle"
      @blur="finalizeText"
      @keydown.escape.prevent="cancelText"
      @keydown.enter.exact="onTextEnter"
      @pointerdown.stop
    />

    <!-- Footer -->
    <div class="canvas-footer">
      <div class="footer-left">
        <div class="zoom-controls">
          <button @click="zoomToCenter(zoom - 0.1)" class="zoom-btn" title="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button @click="zoomToCenter(1)" class="zoom-value" title="Reset zoom">{{ zoomPercent }}%</button>
          <button @click="zoomToCenter(zoom + 0.1)" class="zoom-btn" title="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
      <div class="footer-center">
        <button @click="undo" class="footer-btn" :disabled="historyIndex <= 0" title="Undo (⌘Z)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button @click="redo" class="footer-btn" :disabled="historyIndex >= history.length - 1" title="Redo (⌘⇧Z)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </button>
        <button @click="clearAll" class="footer-btn" title="Clear canvas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="footer-right">
        <span v-if="isSaving" class="save-status saving">Saving...</span>
        <span v-else-if="hasUnsavedChanges" class="save-status unsaved">Unsaved</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

// ================= Types =================

type ToolType = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'diamond' | 'triangle'
  | 'line' | 'arrow' | 'freedraw' | 'text' | 'eraser'
  | 'database' | 'server' | 'user' | 'cloud' | 'document' | 'hexagon' | 'parallelogram' | 'star';

type ElementType = 'rectangle' | 'ellipse' | 'diamond' | 'triangle'
  | 'line' | 'arrow' | 'freedraw' | 'text'
  | 'database' | 'server' | 'user' | 'cloud' | 'document' | 'hexagon' | 'parallelogram' | 'star';

type StrokeStyle = 'solid' | 'dashed' | 'dotted';

interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  points?: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  borderRadius?: number;
}

interface DrawingDataV2 {
  version: number;
  elements: CanvasElement[];
  viewState: { scrollX: number; scrollY: number; zoom: number };
}

type DragAction = 'none' | 'create' | 'move' | 'resize' | 'pan' | 'freedraw' | 'erase';

// ================= Props & Emits =================

const props = defineProps<{
  filePath: string;
  initialContent?: string;
}>();

const emit = defineEmits<{
  save: [content: string];
  contentChanged: [hasChanges: boolean];
}>();

// ================= Constants =================

const GRID_SIZE = 20;
const HANDLE_SIZE = 8;
const SELECTION_COLOR = '#4a90d9';
const MIN_ELEMENT_SIZE = 3;

const shapeTools: ToolType[] = ['rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow',
  'database', 'server', 'user', 'cloud', 'document', 'hexagon', 'parallelogram', 'star'];

const strokeColorPalette = [
  '#1e1e1e', '#343a40', '#e03131', '#c2255c',
  '#6741d9', '#1971c2', '#0c8599', '#2f9e44',
  '#66a80f', '#f08c00', '#e8590c', '#ffffff',
];

const fillColorPalette = [
  '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff',
  '#bac8ff', '#a5d8ff', '#99e9f2', '#b2f2bb',
  '#d8f5a2', '#ffec99', '#ffd8a8', '#e9ecef',
];

const strokeWidthOptions = [1, 2, 4];
const strokeStyleOptions = [
  { value: 'solid' as StrokeStyle, label: 'Solid', dash: '' },
  { value: 'dashed' as StrokeStyle, label: 'Dashed', dash: '8,5' },
  { value: 'dotted' as StrokeStyle, label: 'Dotted', dash: '2,4' },
];

// ================= State =================

const containerEl = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const textInputEl = ref<HTMLTextAreaElement | null>(null);
const archDropdownEl = ref<HTMLDivElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;

// Architecture shapes dropdown
const archDropdownOpen = ref(false);

const archShapeTypes: ToolType[] = ['database', 'server', 'user', 'cloud', 'document', 'hexagon', 'parallelogram', 'star'];
const isArchTool = computed(() => archShapeTypes.includes(currentTool.value));

const archShapes = [
  { tool: 'database' as ToolType, label: 'Database',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>' },
  { tool: 'server' as ToolType, label: 'Server',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>' },
  { tool: 'user' as ToolType, label: 'User',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M3 21c0-4.42 4-8 9-8s9 3.58 9 8"/></svg>' },
  { tool: 'cloud' as ToolType, label: 'Cloud',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>' },
  { tool: 'document' as ToolType, label: 'Document',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  { tool: 'hexagon' as ToolType, label: 'Hexagon',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>' },
  { tool: 'parallelogram' as ToolType, label: 'Parallelogram',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="6,4 22,4 18,20 2,20"/></svg>' },
  { tool: 'star' as ToolType, label: 'Star',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>' },
];

function toggleArchDropdown() {
  archDropdownOpen.value = !archDropdownOpen.value;
}

function selectArchTool(tool: ToolType) {
  currentTool.value = tool;
  archDropdownOpen.value = false;
  selectedId.value = null;
  renderScene();
}

function handleClickOutsideArchDropdown(e: MouseEvent) {
  if (archDropdownOpen.value && archDropdownEl.value && !archDropdownEl.value.contains(e.target as Node)) {
    archDropdownOpen.value = false;
  }
}

// View State
const scrollX = ref(0);
const scrollY = ref(0);
const zoom = ref(1);

// Tool State
const currentTool = ref<ToolType>('select');
const spaceHeld = ref(false);
const shiftHeld = ref(false);
const effectiveTool = computed(() => spaceHeld.value ? 'hand' : currentTool.value);

// Element State
const elements = ref<CanvasElement[]>([]);
const selectedId = ref<string | null>(null);
const creatingElement = ref<CanvasElement | null>(null);

// Drag State
const isDragging = ref(false);
const dragAction = ref<DragAction>('none');
const dragStartWorld = ref({ x: 0, y: 0 });
const dragStartScreen = ref({ x: 0, y: 0 });
const dragHandle = ref<string | null>(null);
const dragOriginal = ref<{ x: number; y: number; width: number; height: number } | null>(null);
const erasedIds = ref<string[]>([]);

// Text State
const textEditing = ref(false);
const textValue = ref('');
const textWorldPos = ref({ x: 0, y: 0 });
const editingElementId = ref<string | null>(null);
const textEditCentered = ref(false);  // true when editing text inside a shape
const textEditBounds = ref<{ x: number; y: number; width: number; height: number } | null>(null);
const textEditFontSize = ref(20);
const textEditColor = ref('');

// Style Defaults
const defaultStyle = ref({
  strokeColor: '#1e1e1e',
  fillColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid' as StrokeStyle,
  borderRadius: 0,
});

const borderRadiusOptions = [
  { label: 'Sharp', value: 0, icon: 'sharp' },
  { label: 'Round', value: 8, icon: 'round' },
  { label: 'Extra round', value: 16, icon: 'extra' },
];

// History
const history = ref<string[]>([]);
const historyIndex = ref(-1);

// Save
const hasUnsavedChanges = ref(false);
const isSaving = ref(false);
let autoSaveTimeout: number | null = null;

// Theme
const isDark = ref(false);
let themeObserver: MutationObserver | null = null;

// ================= Computed =================

const zoomPercent = computed(() => Math.round(zoom.value * 100));

const selectedElement = computed(() =>
  selectedId.value ? elements.value.find(el => el.id === selectedId.value) ?? null : null
);

const shouldShowProperties = computed(() => {
  const tool = effectiveTool.value;
  return tool !== 'hand' && tool !== 'select' || selectedElement.value != null;
});

const showFillOption = computed(() => {
  const tool = effectiveTool.value;
  if (selectedElement.value) {
    return !['line', 'arrow', 'freedraw', 'text'].includes(selectedElement.value.type);
  }
  return !['freedraw', 'line', 'arrow', 'text', 'select', 'hand', 'eraser'].includes(tool);
});

const activeStrokeColor = computed(() =>
  selectedElement.value?.strokeColor ?? defaultStyle.value.strokeColor
);
const activeFillColor = computed(() =>
  selectedElement.value?.fillColor ?? defaultStyle.value.fillColor
);
const activeStrokeWidth = computed(() =>
  selectedElement.value?.strokeWidth ?? defaultStyle.value.strokeWidth
);
const activeStrokeStyle = computed(() =>
  selectedElement.value?.strokeStyle ?? defaultStyle.value.strokeStyle
);
const activeBorderRadius = computed(() =>
  selectedElement.value?.borderRadius ?? defaultStyle.value.borderRadius
);

const showRoundnessOption = computed(() => {
  const roundableTypes = ['rectangle', 'diamond', 'triangle', 'hexagon', 'parallelogram'];
  const tool = effectiveTool.value;
  if (selectedElement.value) {
    return roundableTypes.includes(selectedElement.value.type);
  }
  return roundableTypes.includes(tool);
});

const canvasCursor = computed(() => {
  const tool = effectiveTool.value;
  if (tool === 'hand') return isDragging.value ? 'grabbing' : 'grab';
  if (tool === 'select') return 'default';
  if (tool === 'eraser') return 'cell';
  if (tool === 'text') return 'text';
  return 'crosshair';
});

const textOverlayStyle = computed(() => {
  const screen = worldToScreen(textWorldPos.value.x, textWorldPos.value.y);
  const fontSize = (textEditFontSize.value || 20) * zoom.value;
  // If editing inside a shape, center the textarea on the shape
  const style: Record<string, string> = {
    fontSize: fontSize + 'px',
    lineHeight: (fontSize * 1.3) + 'px',
    color: textEditColor.value || defaultStyle.value.strokeColor,
    textAlign: textEditCentered.value ? 'center' : 'left',
  };
  if (textEditCentered.value && textEditBounds.value) {
    const tl = worldToScreen(textEditBounds.value.x, textEditBounds.value.y);
    const br = worldToScreen(
      textEditBounds.value.x + textEditBounds.value.width,
      textEditBounds.value.y + textEditBounds.value.height
    );
    const pad = 8 * zoom.value;
    style.left = (tl.x + pad) + 'px';
    style.top = (tl.y + pad) + 'px';
    style.width = (br.x - tl.x - pad * 2) + 'px';
    style.height = (br.y - tl.y - pad * 2) + 'px';
  } else {
    style.left = screen.x + 'px';
    style.top = screen.y + 'px';
  }
  return style;
});

// Canvas colors (theme-aware)
const canvasBg = computed(() => isDark.value ? '#1e1e1e' : '#ffffff');
const gridColor = computed(() => isDark.value ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)');

// ================= Lifecycle =================

onMounted(() => {
  checkTheme();
  themeObserver = new MutationObserver(checkTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  setupCanvas();
  loadDrawing();
  window.addEventListener('resize', handleResize);
  document.addEventListener('mousedown', handleClickOutsideArchDropdown);
  nextTick(() => containerEl.value?.focus());
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('mousedown', handleClickOutsideArchDropdown);
  themeObserver?.disconnect();
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
});

watch(() => props.filePath, loadDrawing);
watch(() => props.initialContent, loadDrawing);
watch(isDark, () => {
  // Update default stroke for theme
  if (isDark.value && defaultStyle.value.strokeColor === '#1e1e1e') {
    defaultStyle.value.strokeColor = '#ffffff';
  } else if (!isDark.value && defaultStyle.value.strokeColor === '#ffffff') {
    defaultStyle.value.strokeColor = '#1e1e1e';
  }
  renderScene();
});

// ================= Theme =================

function checkTheme() {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark';
}

// ================= Canvas Setup =================

function setupCanvas() {
  if (!canvas.value || !containerEl.value) return;
  dpr = window.devicePixelRatio || 1;
  const rect = containerEl.value.getBoundingClientRect();
  canvas.value.width = rect.width * dpr;
  canvas.value.height = rect.height * dpr;
  canvas.value.style.width = rect.width + 'px';
  canvas.value.style.height = rect.height + 'px';
  ctx = canvas.value.getContext('2d')!;
}

function handleResize() {
  setupCanvas();
  renderScene();
}

function cssWidth() { return canvas.value ? canvas.value.width / dpr : 0; }
function cssHeight() { return canvas.value ? canvas.value.height / dpr : 0; }

// ================= Coordinate Transforms =================

function screenToWorld(sx: number, sy: number) {
  return {
    x: (sx - scrollX.value) / zoom.value,
    y: (sy - scrollY.value) / zoom.value,
  };
}

function worldToScreen(wx: number, wy: number) {
  return {
    x: wx * zoom.value + scrollX.value,
    y: wy * zoom.value + scrollY.value,
  };
}

function getScreenPoint(e: PointerEvent | Touch) {
  const rect = canvas.value!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ================= Rendering =================

function renderScene() {
  if (!ctx || !canvas.value) return;
  const w = cssWidth();
  const h = cssHeight();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = canvasBg.value;
  ctx.fillRect(0, 0, w, h);

  // Grid
  drawGrid(w, h);

  // Apply view transform
  ctx.save();
  ctx.translate(scrollX.value, scrollY.value);
  ctx.scale(zoom.value, zoom.value);

  // Draw all elements
  for (const el of elements.value) {
    drawElement(el);
  }

  // Draw creating element preview
  if (creatingElement.value) {
    drawElement(creatingElement.value);
  }

  // Draw selection
  if (selectedElement.value) {
    drawSelectionOutline(selectedElement.value);
  }

  ctx.restore();
}

function drawGrid(w: number, h: number) {
  if (!ctx) return;
  const g = GRID_SIZE;
  const zg = g * zoom.value;

  // Only draw if grid is visible
  if (zg < 4) return;

  ctx.fillStyle = gridColor.value;
  const dotSize = Math.max(1, zoom.value);

  const startWorldX = Math.floor(-scrollX.value / zoom.value / g) * g;
  const startWorldY = Math.floor(-scrollY.value / zoom.value / g) * g;
  const endWorldX = (-scrollX.value + w) / zoom.value;
  const endWorldY = (-scrollY.value + h) / zoom.value;

  for (let wx = startWorldX; wx <= endWorldX; wx += g) {
    for (let wy = startWorldY; wy <= endWorldY; wy += g) {
      const sx = wx * zoom.value + scrollX.value;
      const sy = wy * zoom.value + scrollY.value;
      ctx.fillRect(sx - dotSize / 2, sy - dotSize / 2, dotSize, dotSize);
    }
  }
}

function drawElement(el: CanvasElement) {
  if (!ctx) return;

  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.globalAlpha = el.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (el.strokeStyle) {
    case 'dashed': ctx.setLineDash([12, 8]); break;
    case 'dotted': ctx.setLineDash([2, 5]); break;
    default: ctx.setLineDash([]);
  }

  const hasFill = el.fillColor && el.fillColor !== 'transparent';
  if (hasFill) ctx.fillStyle = el.fillColor;

  const br = el.borderRadius ?? 0;

  switch (el.type) {
    case 'rectangle': {
      const rx = Math.min(el.x, el.x + el.width);
      const ry = Math.min(el.y, el.y + el.height);
      const rw = Math.abs(el.width);
      const rh = Math.abs(el.height);
      const maxR = Math.min(rw, rh) / 2;
      const r = Math.min(br, maxR);
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, r);
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ellipse': {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rrx = Math.abs(el.width) / 2;
      const rry = Math.abs(el.height) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(0.1, rrx), Math.max(0.1, rry), 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'diamond': {
      const dcx = el.x + el.width / 2;
      const dcy = el.y + el.height / 2;
      const dhw = Math.abs(el.width) / 2;
      const dhh = Math.abs(el.height) / 2;
      ctx.beginPath();
      if (br > 0) {
        drawRoundedPolygon(ctx, [
          { x: dcx, y: dcy - dhh },
          { x: dcx + dhw, y: dcy },
          { x: dcx, y: dcy + dhh },
          { x: dcx - dhw, y: dcy },
        ], br);
      } else {
        ctx.moveTo(dcx, dcy - dhh);
        ctx.lineTo(dcx + dhw, dcy);
        ctx.lineTo(dcx, dcy + dhh);
        ctx.lineTo(dcx - dhw, dcy);
        ctx.closePath();
      }
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'triangle': {
      const tx = Math.min(el.x, el.x + el.width);
      const ty = Math.min(el.y, el.y + el.height);
      const tw = Math.abs(el.width);
      const th = Math.abs(el.height);
      ctx.beginPath();
      if (br > 0) {
        drawRoundedPolygon(ctx, [
          { x: tx + tw / 2, y: ty },
          { x: tx + tw, y: ty + th },
          { x: tx, y: ty + th },
        ], br);
      } else {
        ctx.moveTo(tx + tw / 2, ty);
        ctx.lineTo(tx + tw, ty + th);
        ctx.lineTo(tx, ty + th);
        ctx.closePath();
      }
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + el.width, el.y + el.height);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      const ax1 = el.x, ay1 = el.y;
      const ax2 = el.x + el.width, ay2 = el.y + el.height;
      ctx.beginPath();
      ctx.moveTo(ax1, ay1);
      ctx.lineTo(ax2, ay2);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
      const headLen = Math.max(el.strokeWidth * 4, 14);
      ctx.beginPath();
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - headLen * Math.cos(angle - Math.PI / 6), ay2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - headLen * Math.cos(angle + Math.PI / 6), ay2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'freedraw': {
      if (!el.points || el.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.x + el.points[i].x, el.y + el.points[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'text': {
      if (!el.text) break;
      const fs = el.fontSize || 20;
      ctx.font = `${fs}px "Helvetica", "Segoe UI", sans-serif`;
      ctx.fillStyle = el.strokeColor;
      ctx.textBaseline = 'top';
      const lines = el.text.split('\n');
      const lh = fs * 1.3;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], el.x, el.y + i * lh);
      }
      break;
    }

    // ---- Architecture / Diagram Shapes ----

    case 'database': {
      // Cylinder shape
      const dx = Math.min(el.x, el.x + el.width);
      const dy = Math.min(el.y, el.y + el.height);
      const dw = Math.abs(el.width);
      const dh = Math.abs(el.height);
      const ellH = Math.min(dh * 0.18, dw * 0.35);
      ctx.beginPath();
      // Top ellipse
      ctx.ellipse(dx + dw / 2, dy + ellH, dw / 2, ellH, 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      ctx.stroke();
      // Body
      ctx.beginPath();
      ctx.moveTo(dx, dy + ellH);
      ctx.lineTo(dx, dy + dh - ellH);
      ctx.ellipse(dx + dw / 2, dy + dh - ellH, dw / 2, ellH, 0, Math.PI, 0, true);
      ctx.lineTo(dx + dw, dy + ellH);
      if (hasFill) ctx.fill();
      ctx.stroke();
      // Bottom ellipse stroke
      ctx.beginPath();
      ctx.ellipse(dx + dw / 2, dy + dh - ellH, dw / 2, ellH, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }

    case 'server': {
      // Stacked server/rack shape (3 sections)
      const sx = Math.min(el.x, el.x + el.width);
      const sy = Math.min(el.y, el.y + el.height);
      const sw = Math.abs(el.width);
      const sh = Math.abs(el.height);
      const sections = 3;
      const secH = sh / sections;
      const sr = Math.min(br, Math.min(sw, secH) / 2);
      for (let s = 0; s < sections; s++) {
        const sy2 = sy + s * secH;
        ctx.beginPath();
        ctx.roundRect(sx, sy2, sw, secH, sr);
        if (hasFill) ctx.fill();
        ctx.stroke();
        // Status light
        const lightR = Math.min(secH * 0.15, sw * 0.04);
        const lightX = sx + sw - lightR * 3;
        const lightY = sy2 + secH / 2;
        ctx.beginPath();
        ctx.arc(lightX, lightY, lightR, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        // Restore fill
        if (hasFill) ctx.fillStyle = el.fillColor;
      }
      break;
    }

    case 'user': {
      // Person / user icon
      const ux = Math.min(el.x, el.x + el.width);
      const uy = Math.min(el.y, el.y + el.height);
      const uw = Math.abs(el.width);
      const uh = Math.abs(el.height);
      const headR = Math.min(uw, uh * 0.4) * 0.35;
      const headCx = ux + uw / 2;
      const headCy = uy + uh * 0.28;
      // Head
      ctx.beginPath();
      ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      ctx.stroke();
      // Body (shoulders + torso arc)
      const bodyTop = headCy + headR + uh * 0.06;
      const bodyBot = uy + uh;
      const bodyW = uw * 0.7;
      ctx.beginPath();
      ctx.moveTo(headCx - bodyW / 2, bodyBot);
      ctx.quadraticCurveTo(headCx - bodyW / 2, bodyTop, headCx, bodyTop);
      ctx.quadraticCurveTo(headCx + bodyW / 2, bodyTop, headCx + bodyW / 2, bodyBot);
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'cloud': {
      const cx = Math.min(el.x, el.x + el.width);
      const cy = Math.min(el.y, el.y + el.height);
      const cw = Math.abs(el.width);
      const ch = Math.abs(el.height);
      ctx.beginPath();
      // Cloud made of overlapping arcs
      ctx.moveTo(cx + cw * 0.25, cy + ch * 0.65);
      ctx.arc(cx + cw * 0.25, cy + ch * 0.52, cw * 0.17, Math.PI * 0.7, Math.PI * 1.9);
      ctx.arc(cx + cw * 0.38, cy + ch * 0.32, cw * 0.18, Math.PI * 1.1, Math.PI * 1.85);
      ctx.arc(cx + cw * 0.58, cy + ch * 0.25, cw * 0.2, Math.PI * 1.0, Math.PI * 1.8);
      ctx.arc(cx + cw * 0.75, cy + ch * 0.38, cw * 0.17, Math.PI * 1.3, Math.PI * 0.3);
      ctx.arc(cx + cw * 0.72, cy + ch * 0.58, cw * 0.16, Math.PI * 1.7, Math.PI * 0.5);
      ctx.lineTo(cx + cw * 0.25, cy + ch * 0.65);
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'document': {
      // Page with curled bottom
      const ddx = Math.min(el.x, el.x + el.width);
      const ddy = Math.min(el.y, el.y + el.height);
      const ddw = Math.abs(el.width);
      const ddh = Math.abs(el.height);
      const curl = ddh * 0.12;
      ctx.beginPath();
      ctx.moveTo(ddx, ddy);
      ctx.lineTo(ddx + ddw, ddy);
      ctx.lineTo(ddx + ddw, ddy + ddh - curl);
      // Wavy bottom
      ctx.bezierCurveTo(
        ddx + ddw * 0.7, ddy + ddh - curl * 2.5,
        ddx + ddw * 0.3, ddy + ddh + curl * 0.5,
        ddx, ddy + ddh - curl
      );
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'hexagon': {
      const hx = Math.min(el.x, el.x + el.width);
      const hy = Math.min(el.y, el.y + el.height);
      const hw = Math.abs(el.width);
      const hh = Math.abs(el.height);
      const indent = hw * 0.22;
      const pts = [
        { x: hx + indent, y: hy },
        { x: hx + hw - indent, y: hy },
        { x: hx + hw, y: hy + hh / 2 },
        { x: hx + hw - indent, y: hy + hh },
        { x: hx + indent, y: hy + hh },
        { x: hx, y: hy + hh / 2 },
      ];
      ctx.beginPath();
      if (br > 0) {
        drawRoundedPolygon(ctx, pts, br);
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
      }
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'parallelogram': {
      const px = Math.min(el.x, el.x + el.width);
      const py = Math.min(el.y, el.y + el.height);
      const pw = Math.abs(el.width);
      const ph = Math.abs(el.height);
      const skew = pw * 0.2;
      const pts = [
        { x: px + skew, y: py },
        { x: px + pw, y: py },
        { x: px + pw - skew, y: py + ph },
        { x: px, y: py + ph },
      ];
      ctx.beginPath();
      if (br > 0) {
        drawRoundedPolygon(ctx, pts, br);
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
      }
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'star': {
      const stx = Math.min(el.x, el.x + el.width);
      const sty = Math.min(el.y, el.y + el.height);
      const stw = Math.abs(el.width);
      const sth = Math.abs(el.height);
      const scx = stx + stw / 2;
      const scy = sty + sth / 2;
      const outerR = Math.min(stw, sth) / 2;
      const innerR = outerR * 0.4;
      const spikes = 5;
      const rot = -Math.PI / 2;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = rot + (i * Math.PI) / spikes;
        const px = scx + r * Math.cos(angle);
        const py = scy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
  }

  // Draw text inside shapes (if any)
  if (el.type !== 'text' && el.text) {
    drawEmbeddedText(el);
  }

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRoundedPolygon(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], radius: number) {
  const n = points.length;
  if (n < 3) return;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    // Vectors from current point to adjacent points
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const distPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
    const distNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);

    // Clamp radius so it doesn't exceed half the edge length
    const r = Math.min(radius, distPrev / 2, distNext / 2);

    // Points along edges at distance r from the corner
    const startX = curr.x + (toPrev.x / distPrev) * r;
    const startY = curr.y + (toPrev.y / distPrev) * r;
    const endX = curr.x + (toNext.x / distNext) * r;
    const endY = curr.y + (toNext.y / distNext) * r;

    if (i === 0) {
      ctx.moveTo(startX, startY);
    } else {
      ctx.lineTo(startX, startY);
    }
    ctx.quadraticCurveTo(curr.x, curr.y, endX, endY);
  }
  ctx.closePath();
}

function drawEmbeddedText(el: CanvasElement) {
  if (!ctx || !el.text) return;

  const bounds = getElementBounds(el);
  const fs = el.fontSize || 16;
  ctx.save();
  ctx.font = `${fs}px "Helvetica", "Segoe UI", sans-serif`;
  ctx.fillStyle = el.strokeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.setLineDash([]);

  const lines = el.text.split('\n');
  const lh = fs * 1.3;
  const totalH = lines.length * lh;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const startY = cy - totalH / 2 + lh / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lh);
  }
  ctx.restore();
}

function drawSelectionOutline(el: CanvasElement) {
  if (!ctx) return;
  ctx.save();

  const bounds = getElementBounds(el);
  const pad = 6 / zoom.value;
  const lw = 1.5 / zoom.value;

  // Dashed outline
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = lw;
  ctx.setLineDash([6 / zoom.value, 4 / zoom.value]);
  ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  ctx.setLineDash([]);

  // Handles
  const handles = getHandlePositions(el);
  const hs = HANDLE_SIZE / zoom.value;

  for (const pos of Object.values(handles)) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1.5 / zoom.value;
    ctx.fillRect(pos.x - hs / 2, pos.y - hs / 2, hs, hs);
    ctx.strokeRect(pos.x - hs / 2, pos.y - hs / 2, hs, hs);
  }

  ctx.restore();
}

// ================= Bounds & Handles =================

function getElementBounds(el: CanvasElement) {
  if (el.type === 'freedraw' && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, el.x + p.x);
      minY = Math.min(minY, el.y + p.y);
      maxX = Math.max(maxX, el.x + p.x);
      maxY = Math.max(maxY, el.y + p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (el.type === 'line' || el.type === 'arrow') {
    return {
      x: Math.min(el.x, el.x + el.width),
      y: Math.min(el.y, el.y + el.height),
      width: Math.abs(el.width),
      height: Math.abs(el.height),
    };
  }
  return {
    x: Math.min(el.x, el.x + el.width),
    y: Math.min(el.y, el.y + el.height),
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
}

function getHandlePositions(el: CanvasElement): Record<string, { x: number; y: number }> {
  if (el.type === 'line' || el.type === 'arrow') {
    return {
      start: { x: el.x, y: el.y },
      end: { x: el.x + el.width, y: el.y + el.height },
    };
  }
  if (el.type === 'freedraw') {
    const b = getElementBounds(el);
    return {
      nw: { x: b.x, y: b.y },
      ne: { x: b.x + b.width, y: b.y },
      sw: { x: b.x, y: b.y + b.height },
      se: { x: b.x + b.width, y: b.y + b.height },
    };
  }
  const b = getElementBounds(el);
  return {
    nw: { x: b.x, y: b.y },
    ne: { x: b.x + b.width, y: b.y },
    sw: { x: b.x, y: b.y + b.height },
    se: { x: b.x + b.width, y: b.y + b.height },
  };
}

// ================= Hit Testing =================

function hitTestElement(wx: number, wy: number): CanvasElement | null {
  const threshold = 8 / zoom.value;
  for (let i = elements.value.length - 1; i >= 0; i--) {
    const el = elements.value[i];
    if (isPointInElement(wx, wy, el, threshold)) return el;
  }
  return null;
}

function isPointInElement(wx: number, wy: number, el: CanvasElement, threshold: number): boolean {
  const b = getElementBounds(el);
  const t = threshold;

  if (el.type === 'line' || el.type === 'arrow') {
    return distanceToSegment(wx, wy, el.x, el.y, el.x + el.width, el.y + el.height) <= t + el.strokeWidth / 2;
  }
  if (el.type === 'freedraw' && el.points) {
    for (let i = 1; i < el.points.length; i++) {
      const p1 = el.points[i - 1];
      const p2 = el.points[i];
      if (distanceToSegment(wx, wy, el.x + p1.x, el.y + p1.y, el.x + p2.x, el.y + p2.y) <= t + el.strokeWidth / 2) {
        return true;
      }
    }
    return false;
  }

  // Bounding box for shapes and text
  return wx >= b.x - t && wx <= b.x + b.width + t && wy >= b.y - t && wy <= b.y + b.height + t;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx, ny = y1 + t * dy;
  return Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
}

function hitTestHandle(wx: number, wy: number): { elementId: string; handle: string } | null {
  if (!selectedElement.value) return null;
  const handles = getHandlePositions(selectedElement.value);
  const hs = (HANDLE_SIZE + 4) / zoom.value;
  for (const [name, pos] of Object.entries(handles)) {
    if (Math.abs(wx - pos.x) <= hs / 2 && Math.abs(wy - pos.y) <= hs / 2) {
      return { elementId: selectedElement.value.id, handle: name };
    }
  }
  return null;
}

// ================= Pointer Events =================

function onPointerDown(e: PointerEvent) {
  // If text editing is active, finalize it first
  if (textEditing.value) {
    finalizeText();
    return;
  }
  containerEl.value?.focus();

  const screenPt = getScreenPoint(e);
  const worldPt = screenToWorld(screenPt.x, screenPt.y);

  const tool = effectiveTool.value;

  // Text tool — don't capture pointer (textarea needs focus)
  if (tool === 'text') {
    // Check if clicking on existing text element to edit
    const hit = hitTestElement(worldPt.x, worldPt.y);
    if (hit && hit.type === 'text') {
      startEditText(hit);
    } else if (hit && isShapeElement(hit) && hit.text) {
      startEditShapeText(hit);
    } else {
      startNewText(worldPt.x, worldPt.y);
    }
    isDragging.value = false;
    return;
  }

  // Non-text tools: capture pointer for drag
  canvas.value?.setPointerCapture(e.pointerId);
  isDragging.value = true;
  dragStartWorld.value = { ...worldPt };
  dragStartScreen.value = { ...screenPt };

  // Hand tool: pan
  if (tool === 'hand') {
    dragAction.value = 'pan';
    return;
  }

  // Select tool
  if (tool === 'select') {
    // Check handle first
    const handleHit = hitTestHandle(worldPt.x, worldPt.y);
    if (handleHit) {
      const el = elements.value.find(e => e.id === handleHit.elementId)!;
      dragAction.value = 'resize';
      dragHandle.value = handleHit.handle;
      dragOriginal.value = { x: el.x, y: el.y, width: el.width, height: el.height };
      return;
    }

    // Check element hit
    const hit = hitTestElement(worldPt.x, worldPt.y);
    if (hit) {
      selectedId.value = hit.id;
      dragAction.value = 'move';
      dragOriginal.value = { x: hit.x, y: hit.y, width: hit.width, height: hit.height };
      renderScene();
      return;
    }

    // Click on empty space → deselect
    selectedId.value = null;
    dragAction.value = 'none';
    renderScene();
    return;
  }

  // Eraser tool
  if (tool === 'eraser') {
    dragAction.value = 'erase';
    erasedIds.value = [];
    const hit = hitTestElement(worldPt.x, worldPt.y);
    if (hit) {
      erasedIds.value.push(hit.id);
      elements.value = elements.value.filter(el => el.id !== hit.id);
      if (selectedId.value === hit.id) selectedId.value = null;
      renderScene();
    }
    return;
  }

  // Freedraw tool
  if (tool === 'freedraw') {
    dragAction.value = 'freedraw';
    selectedId.value = null;
    creatingElement.value = {
      id: genId(),
      type: 'freedraw',
      x: worldPt.x,
      y: worldPt.y,
      width: 0,
      height: 0,
      strokeColor: defaultStyle.value.strokeColor,
      fillColor: 'transparent',
      strokeWidth: defaultStyle.value.strokeWidth,
      strokeStyle: defaultStyle.value.strokeStyle,
      opacity: 1,
      points: [{ x: 0, y: 0 }],
    };
    return;
  }

  // Shape tools (rect, ellipse, diamond, triangle, line, arrow)
  if (shapeTools.includes(tool)) {
    dragAction.value = 'create';
    selectedId.value = null;
    creatingElement.value = {
      id: genId(),
      type: tool as ElementType,
      x: worldPt.x,
      y: worldPt.y,
      width: 0,
      height: 0,
      strokeColor: defaultStyle.value.strokeColor,
      fillColor: defaultStyle.value.fillColor,
      strokeWidth: defaultStyle.value.strokeWidth,
      strokeStyle: defaultStyle.value.strokeStyle,
      opacity: 1,
      borderRadius: ['rectangle', 'diamond', 'triangle', 'hexagon', 'parallelogram'].includes(tool) ? defaultStyle.value.borderRadius : undefined,
    };
    return;
  }
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value || !ctx) return;

  const screenPt = getScreenPoint(e);
  const worldPt = screenToWorld(screenPt.x, screenPt.y);

  switch (dragAction.value) {
    case 'pan': {
      const dx = screenPt.x - dragStartScreen.value.x;
      const dy = screenPt.y - dragStartScreen.value.y;
      scrollX.value += dx;
      scrollY.value += dy;
      dragStartScreen.value = { ...screenPt };
      renderScene();
      break;
    }

    case 'create': {
      if (!creatingElement.value) break;
      let w = worldPt.x - creatingElement.value.x;
      let h = worldPt.y - creatingElement.value.y;
      if (shiftHeld.value) {
        const constrained = constrainDimensions(creatingElement.value.type, w, h);
        w = constrained.w;
        h = constrained.h;
      }
      creatingElement.value.width = w;
      creatingElement.value.height = h;
      renderScene();
      break;
    }

    case 'move': {
      const el = selectedElement.value;
      if (!el || !dragOriginal.value) break;
      const dx = worldPt.x - dragStartWorld.value.x;
      const dy = worldPt.y - dragStartWorld.value.y;
      el.x = dragOriginal.value.x + dx;
      el.y = dragOriginal.value.y + dy;
      renderScene();
      break;
    }

    case 'resize': {
      const el = selectedElement.value;
      if (!el || !dragOriginal.value || !dragHandle.value) break;
      applyResize(el, dragHandle.value, worldPt.x, worldPt.y, dragOriginal.value);
      renderScene();
      break;
    }

    case 'freedraw': {
      if (!creatingElement.value?.points) break;
      const relX = worldPt.x - creatingElement.value.x;
      const relY = worldPt.y - creatingElement.value.y;
      creatingElement.value.points.push({ x: relX, y: relY });
      renderScene();
      break;
    }

    case 'erase': {
      const hit = hitTestElement(worldPt.x, worldPt.y);
      if (hit && !erasedIds.value.includes(hit.id)) {
        erasedIds.value.push(hit.id);
        elements.value = elements.value.filter(el => el.id !== hit.id);
        if (selectedId.value === hit.id) selectedId.value = null;
        renderScene();
      }
      break;
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  canvas.value?.releasePointerCapture(e.pointerId);

  const action = dragAction.value;
  isDragging.value = false;
  dragAction.value = 'none';

  switch (action) {
    case 'create': {
      if (!creatingElement.value) break;
      const el = creatingElement.value;
      // Normalize shape dimensions
      if (!['line', 'arrow'].includes(el.type)) {
        if (el.width < 0) { el.x += el.width; el.width = -el.width; }
        if (el.height < 0) { el.y += el.height; el.height = -el.height; }
      }
      if (Math.abs(el.width) > MIN_ELEMENT_SIZE || Math.abs(el.height) > MIN_ELEMENT_SIZE) {
        elements.value.push(el);
        selectedId.value = el.id;
        saveToHistory();
        scheduleAutoSave();
      }
      creatingElement.value = null;
      renderScene();
      break;
    }

    case 'move':
    case 'resize': {
      saveToHistory();
      scheduleAutoSave();
      renderScene();
      break;
    }

    case 'freedraw': {
      if (!creatingElement.value?.points || creatingElement.value.points.length < 2) {
        creatingElement.value = null;
        break;
      }
      // Compute bounding box
      const pts = creatingElement.value.points;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      creatingElement.value.width = maxX - minX;
      creatingElement.value.height = maxY - minY;
      elements.value.push(creatingElement.value);
      selectedId.value = creatingElement.value.id;
      creatingElement.value = null;
      saveToHistory();
      scheduleAutoSave();
      renderScene();
      break;
    }

    case 'erase': {
      if (erasedIds.value.length > 0) {
        saveToHistory();
        scheduleAutoSave();
      }
      erasedIds.value = [];
      break;
    }
  }

  dragOriginal.value = null;
  dragHandle.value = null;
}

// ================= Resize Logic =================

function applyResize(el: CanvasElement, handle: string, wx: number, wy: number, orig: { x: number; y: number; width: number; height: number }) {
  if (el.type === 'line' || el.type === 'arrow') {
    if (handle === 'start') {
      const endX = orig.x + orig.width;
      const endY = orig.y + orig.height;
      el.x = wx; el.y = wy;
      el.width = endX - wx; el.height = endY - wy;
    } else {
      el.width = wx - el.x;
      el.height = wy - el.y;
    }
    return;
  }

  const ox = orig.x, oy = orig.y, ow = orig.width, oh = orig.height;
  switch (handle) {
    case 'nw':
      el.x = wx; el.y = wy;
      el.width = ox + ow - wx; el.height = oy + oh - wy;
      break;
    case 'ne':
      el.y = wy;
      el.width = wx - ox; el.height = oy + oh - wy;
      break;
    case 'sw':
      el.x = wx;
      el.width = ox + ow - wx; el.height = wy - oy;
      break;
    case 'se':
      el.width = wx - ox; el.height = wy - oy;
      break;
  }
}

// ================= Shift Constraints =================

function constrainDimensions(type: ElementType, w: number, h: number) {
  const squareTypes = ['rectangle', 'ellipse', 'diamond', 'triangle', 'hexagon', 'star'];
  if (squareTypes.includes(type)) {
    const max = Math.max(Math.abs(w), Math.abs(h));
    return { w: Math.sign(w) * max, h: Math.sign(h) * max };
  }
  if (type === 'line' || type === 'arrow') {
    const angle = Math.atan2(h, w);
    const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
    const dist = Math.sqrt(w * w + h * h);
    return { w: dist * Math.cos(snapped), h: dist * Math.sin(snapped) };
  }
  return { w, h };
}

// ================= Wheel (Zoom) =================

function onWheel(e: WheelEvent) {
  const screenPt = getScreenPoint(e as any);

  // Pinch-to-zoom (ctrlKey is set by trackpad pinch)
  if (e.ctrlKey || e.metaKey) {
    const delta = -e.deltaY * 0.01;
    zoomAtPoint(zoom.value + delta, screenPt.x, screenPt.y);
  } else {
    // Pan
    scrollX.value -= e.deltaX;
    scrollY.value -= e.deltaY;
  }
  renderScene();
}

function zoomAtPoint(newZoom: number, sx: number, sy: number) {
  newZoom = Math.max(0.1, Math.min(5, newZoom));
  const oldZoom = zoom.value;
  scrollX.value = sx - (sx - scrollX.value) * (newZoom / oldZoom);
  scrollY.value = sy - (sy - scrollY.value) * (newZoom / oldZoom);
  zoom.value = newZoom;
}

function zoomToCenter(newZoom: number) {
  zoomAtPoint(newZoom, cssWidth() / 2, cssHeight() / 2);
  renderScene();
}

// ================= Helpers =================

function isShapeElement(el: CanvasElement): boolean {
  return ['rectangle', 'ellipse', 'diamond', 'triangle',
    'database', 'server', 'user', 'cloud', 'document', 'hexagon', 'parallelogram', 'star'].includes(el.type);
}

// ================= Double-click handler =================

function onDoubleClick(e: MouseEvent) {
  const screenPt = { x: e.clientX - canvas.value!.getBoundingClientRect().left, y: e.clientY - canvas.value!.getBoundingClientRect().top };
  const worldPt = screenToWorld(screenPt.x, screenPt.y);
  const hit = hitTestElement(worldPt.x, worldPt.y);

  if (hit) {
    if (hit.type === 'text') {
      startEditText(hit);
    } else if (isShapeElement(hit)) {
      startEditShapeText(hit);
    }
  } else {
    // Double-click on empty space → create text
    startNewText(worldPt.x, worldPt.y);
  }
}

// ================= Text Editing =================

function startNewText(wx: number, wy: number) {
  selectedId.value = null;
  textEditing.value = true;
  textValue.value = '';
  textWorldPos.value = { x: wx, y: wy };
  editingElementId.value = null;
  textEditCentered.value = false;
  textEditBounds.value = null;
  textEditFontSize.value = 20;
  textEditColor.value = defaultStyle.value.strokeColor;
  nextTick(() => {
    textInputEl.value?.focus();
  });
}

function startEditText(el: CanvasElement) {
  selectedId.value = null;
  textEditing.value = true;
  textValue.value = el.text || '';
  textWorldPos.value = { x: el.x, y: el.y };
  editingElementId.value = el.id;
  textEditCentered.value = false;
  textEditBounds.value = null;
  textEditFontSize.value = el.fontSize || 20;
  textEditColor.value = el.strokeColor;
  nextTick(() => {
    textInputEl.value?.focus();
  });
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
  nextTick(() => {
    textInputEl.value?.focus();
  });
}

function cancelText() {
  textEditing.value = false;
  editingElementId.value = null;
  textEditCentered.value = false;
  textEditBounds.value = null;
  renderScene();
}

function onTextEnter(e: KeyboardEvent) {
  // Shift+Enter for newline, Enter alone finalizes
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
    // For standalone text elements, delete if cleared
    if (editingElementId.value && !wasCentered) {
      const el = elements.value.find(e => e.id === editingElementId.value);
      if (el && el.type === 'text') {
        elements.value = elements.value.filter(el => el.id !== editingElementId.value);
        if (selectedId.value === editingElementId.value) selectedId.value = null;
      }
    }
    // For shape text, clear the text property
    if (editingElementId.value && wasCentered) {
      const el = elements.value.find(e => e.id === editingElementId.value);
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

  // Measure text
  if (!ctx) return;
  const fs = textEditFontSize.value || 20;
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
    const el = elements.value.find(e => e.id === editingElementId.value);
    if (el) {
      el.text = txt;
      el.fontSize = fs;
      // For standalone text elements, update dimensions
      if (el.type === 'text') {
        el.width = maxW;
        el.height = lines.length * lh;
      }
      // For shapes, text is stored but shape dimensions stay the same
    }
  } else {
    // New standalone text element
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

// ================= Keyboard Events =================

function handleKeydown(e: KeyboardEvent) {
  if (textEditing.value) return;

  // Space for temporary hand tool
  if (e.code === 'Space' && !isDragging.value) {
    e.preventDefault();
    spaceHeld.value = true;
    return;
  }

  if (e.key === 'Shift') { shiftHeld.value = true; return; }

  // Undo/Redo
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) redo(); else undo();
    return;
  }

  // Select all
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault();
    return;
  }

  // Delete selected
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.value) {
    e.preventDefault();
    elements.value = elements.value.filter(el => el.id !== selectedId.value);
    selectedId.value = null;
    saveToHistory();
    scheduleAutoSave();
    renderScene();
    return;
  }

  // Double-click text edit shortcut (Enter on selected element)
  if (e.key === 'Enter' && selectedElement.value) {
    e.preventDefault();
    if (selectedElement.value.type === 'text') {
      startEditText(selectedElement.value);
    } else if (isShapeElement(selectedElement.value)) {
      startEditShapeText(selectedElement.value);
    }
    return;
  }

  // Tool shortcuts (only single keys, no modifiers)
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    const toolMap: Record<string, ToolType> = {
      v: 'select', '1': 'select',
      h: 'hand', '2': 'hand',
      r: 'rectangle', '3': 'rectangle',
      d: 'diamond', '4': 'diamond',
      o: 'ellipse', '5': 'ellipse',
      t: 'triangle',
      a: 'arrow', '6': 'arrow',
      l: 'line', '7': 'line',
      p: 'freedraw', '8': 'freedraw',
      x: 'text', '9': 'text',
      e: 'eraser', '0': 'eraser',
    };
    const tool = toolMap[e.key.toLowerCase()];
    if (tool) {
      e.preventDefault();
      selectTool(tool);
      return;
    }
  }

  // Escape - deselect or cancel
  if (e.key === 'Escape') {
    if (selectedId.value) {
      selectedId.value = null;
      renderScene();
    }
    if (isDragging.value && dragAction.value === 'create') {
      creatingElement.value = null;
      isDragging.value = false;
      dragAction.value = 'none';
      renderScene();
    }
  }

  // Zoom shortcuts
  if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    zoomToCenter(zoom.value + 0.1);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '-') {
    e.preventDefault();
    zoomToCenter(zoom.value - 0.1);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault();
    zoomToCenter(1);
  }
}

function handleKeyup(e: KeyboardEvent) {
  if (e.code === 'Space') spaceHeld.value = false;
  if (e.key === 'Shift') shiftHeld.value = false;
}

// ================= Tool Selection =================

function selectTool(tool: ToolType) {
  currentTool.value = tool;
  if (tool !== 'select') selectedId.value = null;
  renderScene();
}

// ================= Properties =================

function setProperty(prop: string, value: any) {
  // Update selected element if any
  if (selectedElement.value) {
    (selectedElement.value as any)[prop] = value;
    saveToHistory();
    scheduleAutoSave();
    renderScene();
  }
  // Always update default style
  if (prop in defaultStyle.value) {
    (defaultStyle.value as any)[prop] = value;
  }
}

// ================= History =================

function saveToHistory() {
  const snapshot = JSON.stringify(elements.value);
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1);
  }
  history.value.push(snapshot);
  historyIndex.value = history.value.length - 1;
  if (history.value.length > 60) {
    history.value.shift();
    historyIndex.value--;
  }
}

function undo() {
  if (historyIndex.value <= 0) return;
  historyIndex.value--;
  elements.value = JSON.parse(history.value[historyIndex.value]);
  selectedId.value = null;
  scheduleAutoSave();
  renderScene();
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) return;
  historyIndex.value++;
  elements.value = JSON.parse(history.value[historyIndex.value]);
  selectedId.value = null;
  scheduleAutoSave();
  renderScene();
}

function clearAll() {
  elements.value = [];
  selectedId.value = null;
  saveToHistory();
  scheduleAutoSave();
  renderScene();
}

// ================= Save / Load =================

function scheduleAutoSave() {
  hasUnsavedChanges.value = true;
  emit('contentChanged', true);
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = window.setTimeout(saveDrawing, 1000);
}

function saveDrawing() {
  const data: DrawingDataV2 = {
    version: 2,
    elements: elements.value,
    viewState: { scrollX: scrollX.value, scrollY: scrollY.value, zoom: zoom.value },
  };
  isSaving.value = true;
  emit('save', JSON.stringify(data, null, 2));
  setTimeout(() => {
    isSaving.value = false;
    hasUnsavedChanges.value = false;
    emit('contentChanged', false);
  }, 300);
}

function loadDrawing() {
  if (!props.initialContent || !ctx || !canvas.value) {
    elements.value = [];
    scrollX.value = 0;
    scrollY.value = 0;
    zoom.value = 1;
    history.value = [JSON.stringify([])];
    historyIndex.value = 0;
    hasUnsavedChanges.value = false;
    nextTick(renderScene);
    return;
  }
  try {
    const data = JSON.parse(props.initialContent);
    if (data.version === 2) {
      elements.value = data.elements || [];
      scrollX.value = data.viewState?.scrollX ?? 0;
      scrollY.value = data.viewState?.scrollY ?? 0;
      zoom.value = data.viewState?.zoom ?? 1;
    } else {
      // Migrate from v1 format
      elements.value = migrateV1(data);
    }
    history.value = [JSON.stringify(elements.value)];
    historyIndex.value = 0;
    hasUnsavedChanges.value = false;
    renderScene();
  } catch (e) {
    console.error('Failed to load drawing:', e);
    elements.value = [];
    history.value = [JSON.stringify([])];
    historyIndex.value = 0;
    renderScene();
  }
}

function migrateV1(data: any): CanvasElement[] {
  const result: CanvasElement[] = [];
  if (!data.strokes) return result;

  for (const stroke of data.strokes) {
    if (stroke.tool === 'eraser') continue; // Can't migrate eraser strokes

    if (stroke.shape) {
      const s = stroke.shape;
      const isLine = s.type === 'line' || s.type === 'arrow';
      const el: CanvasElement = {
        id: genId(),
        type: s.type,
        x: isLine ? s.x1 : Math.min(s.x1, s.x2),
        y: isLine ? s.y1 : Math.min(s.y1, s.y2),
        width: isLine ? s.x2 - s.x1 : Math.abs(s.x2 - s.x1),
        height: isLine ? s.y2 - s.y1 : Math.abs(s.y2 - s.y1),
        strokeColor: stroke.color,
        fillColor: s.fill ? stroke.color : 'transparent',
        strokeWidth: stroke.size,
        strokeStyle: 'solid',
        opacity: 1,
      };
      result.push(el);
    } else if (stroke.points && stroke.points.length > 1) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      const el: CanvasElement = {
        id: genId(),
        type: 'freedraw',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        strokeColor: stroke.color,
        fillColor: 'transparent',
        strokeWidth: stroke.size,
        strokeStyle: 'solid',
        opacity: 1,
        points: stroke.points.map((p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY })),
      };
      result.push(el);
    }
  }
  return result;
}

// ================= Utils =================

let idCounter = 0;
function genId(): string {
  return `el_${Date.now()}_${idCounter++}`;
}
</script>

<style scoped lang="scss">
.excalidraw-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
  background: var(--bg-primary, #ffffff);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

// ================= Floating Toolbar =================

.floating-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  -webkit-app-region: no-drag;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text2, #6e6e73);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text1, #1d1d1f);
  }

  &.active {
    background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
    color: var(--accent-color, #3EB489);
  }
}

.toolbar-sep {
  width: 1px;
  height: 24px;
  background: var(--border-color, #e0e0e0);
  margin: 0 2px;
  flex-shrink: 0;
}

// ================= Architecture Dropdown =================

.arch-dropdown {
  position: relative;
}

.arch-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 6px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 6px rgba(0, 0, 0, 0.06);
  z-index: 25;
  min-width: 200px;
}

.arch-shape-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text2, #6e6e73);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-size: 12px;
  white-space: nowrap;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text1, #1d1d1f);
  }

  &.active {
    background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
    color: var(--accent-color, #3EB489);
  }
}

.arch-shape-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  svg {
    width: 18px;
    height: 18px;
  }
}

.arch-shape-label {
  font-weight: 500;
}

// ================= Properties Panel =================

.properties-panel {
  position: absolute;
  top: 64px;
  left: 12px;
  width: 192px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
  padding: 12px;
  z-index: 15;
  -webkit-app-region: no-drag;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.prop-section {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.prop-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #8e8e93);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    border-color: var(--accent-color, #3EB489);
    transform: scale(1.15);
  }

  &.transparent-swatch {
    background:
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    color: var(--text2, #888);

    svg {
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));
    }
  }
}

.stroke-width-row {
  display: flex;
  gap: 4px;
}

.stroke-width-btn {
  flex: 1;
  height: 32px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
  }

  &.active {
    background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
    border-color: var(--accent-color, #3EB489);
  }

  .stroke-preview {
    width: 60%;
    background: var(--text1, #1d1d1f);
    border-radius: 4px;
    min-height: 1px;
  }
}

.stroke-style-row {
  display: flex;
  gap: 4px;
}

.stroke-style-btn {
  flex: 1;
  height: 32px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text1, #1d1d1f);
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
  }

  &.active {
    background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
    border-color: var(--accent-color, #3EB489);
  }
}

.roundness-row {
  display: flex;
  gap: 4px;
}

.roundness-btn {
  flex: 1;
  height: 32px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text1, #1d1d1f);
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
  }

  &.active {
    background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
    border-color: var(--accent-color, #3EB489);
  }
}

// ================= Text Overlay =================

.text-edit-overlay {
  position: absolute;
  z-index: 30;
  border: 2px solid var(--accent-color, #3EB489);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-primary, #fff) 85%, transparent);
  outline: none;
  resize: none;
  min-width: 60px;
  min-height: 1.4em;
  font-family: "Helvetica", "Segoe UI", sans-serif;
  padding: 4px 6px;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
}

// ================= Footer =================

.canvas-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: color-mix(in srgb, var(--bg-primary, #fff) 90%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--border-color, #e0e0e0);
  z-index: 15;
  -webkit-app-region: no-drag;
}

.footer-left,
.footer-center,
.footer-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-left { min-width: 140px; }
.footer-right { min-width: 140px; justify-content: flex-end; }

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
}

.zoom-btn,
.zoom-value {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text2, #6e6e73);
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text1, #1d1d1f);
  }
}

.zoom-btn {
  width: 28px;
  padding: 0;
}

.zoom-value {
  padding: 0 6px;
  font-size: 12px;
  font-weight: 500;
  min-width: 46px;
  border-left: 1px solid var(--border-color, #e0e0e0);
  border-right: 1px solid var(--border-color, #e0e0e0);
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text2, #6e6e73);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  &:hover:not(:disabled) {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text1, #1d1d1f);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.save-status {
  font-size: 12px;
  font-weight: 500;

  &.saving {
    color: var(--text-muted, #8e8e93);
    font-style: italic;
  }

  &.unsaved {
    color: var(--accent-color, #3EB489);
  }
}
</style>
