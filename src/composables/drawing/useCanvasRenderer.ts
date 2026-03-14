import { computed, type Ref, type ComputedRef } from 'vue';
import type { CanvasElement } from '../../types/drawing';

const GRID_SIZE = 20;
const HANDLE_SIZE = 8;
const SELECTION_COLOR = '#4a90d9';

export function useCanvasRenderer(
    canvas: Ref<HTMLCanvasElement | null>,
    containerEl: Ref<HTMLDivElement | null>,
    scrollX: Ref<number>,
    scrollY: Ref<number>,
    zoom: Ref<number>,
    isDark: Ref<boolean>,
    elements: Ref<CanvasElement[]>,
    creatingElement: Ref<CanvasElement | null>,
    selectedElement: ComputedRef<CanvasElement | null>,
    getElementBounds: (el: CanvasElement) => { x: number; y: number; width: number; height: number },
    getHandlePositions: (el: CanvasElement) => Record<string, { x: number; y: number }>,
) {
    let ctx: CanvasRenderingContext2D | null = null;
    let dpr = 1;

    const canvasBg = computed(() => isDark.value ? '#1e1e1e' : '#ffffff');
    const gridColor = computed(() => isDark.value ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)');

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

        ctx.fillStyle = canvasBg.value;
        ctx.fillRect(0, 0, w, h);

        drawGrid(w, h);

        ctx.save();
        ctx.translate(scrollX.value, scrollY.value);
        ctx.scale(zoom.value, zoom.value);

        for (const el of elements.value) {
            drawElement(el);
        }

        if (creatingElement.value) {
            drawElement(creatingElement.value);
        }

        if (selectedElement.value) {
            drawSelectionOutline(selectedElement.value);
        }

        ctx.restore();
    }

    function drawGrid(w: number, h: number) {
        if (!ctx) return;
        const g = GRID_SIZE;
        const zg = g * zoom.value;
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
                const dx = Math.min(el.x, el.x + el.width);
                const dy = Math.min(el.y, el.y + el.height);
                const dw = Math.abs(el.width);
                const dh = Math.abs(el.height);
                const dsx = dw / 24, dsy = dh / 24;
                ctx.save();
                ctx.translate(dx, dy);
                ctx.scale(dsx, dsy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(dsx * dsy);
                const dbBodyPath = new Path2D('M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5');
                if (hasFill) ctx.fill(dbBodyPath);
                ctx.stroke(dbBodyPath);
                ctx.stroke(new Path2D('M3 12c0 1.66 4 3 9 3s9-1.34 9-3'));
                const dbTopPath = new Path2D();
                dbTopPath.ellipse(12, 5, 9, 3, 0, 0, Math.PI * 2);
                if (hasFill) ctx.fill(dbTopPath);
                ctx.stroke(dbTopPath);
                ctx.restore();
                break;
            }
            case 'server': {
                const svrX = Math.min(el.x, el.x + el.width);
                const svrY = Math.min(el.y, el.y + el.height);
                const svrW = Math.abs(el.width);
                const svrH = Math.abs(el.height);
                const svrSX = svrW / 24, svrSY = svrH / 24;
                ctx.save();
                ctx.translate(svrX, svrY);
                ctx.scale(svrSX, svrSY);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(svrSX * svrSY);
                ctx.beginPath();
                ctx.roundRect(2, 2, 20, 8, 2);
                if (hasFill) ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.roundRect(2, 14, 20, 8, 2);
                if (hasFill) ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(6, 6, 1, 0, Math.PI * 2);
                ctx.fillStyle = '#4ade80';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(6, 18, 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }
            case 'user': {
                const ux = Math.min(el.x, el.x + el.width);
                const uy = Math.min(el.y, el.y + el.height);
                const uw = Math.abs(el.width);
                const uh = Math.abs(el.height);
                const usx = uw / 24, usy = uh / 24;
                ctx.save();
                ctx.translate(ux, uy);
                ctx.scale(usx, usy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(usx * usy);
                ctx.beginPath();
                ctx.arc(12, 8, 5, 0, Math.PI * 2);
                if (hasFill) ctx.fill();
                ctx.stroke();
                ctx.stroke(new Path2D('M3 21c0-4.42 4-8 9-8s9 3.58 9 8'));
                ctx.restore();
                break;
            }
            case 'cloud': {
                const clx = Math.min(el.x, el.x + el.width);
                const cly = Math.min(el.y, el.y + el.height);
                const clw = Math.abs(el.width);
                const clh = Math.abs(el.height);
                const clsx = clw / 24, clsy = clh / 24;
                ctx.save();
                ctx.translate(clx, cly);
                ctx.scale(clsx, clsy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(clsx * clsy);
                const cloudPath = new Path2D('M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z');
                if (hasFill) ctx.fill(cloudPath);
                ctx.stroke(cloudPath);
                ctx.restore();
                break;
            }
            case 'document': {
                const ddx = Math.min(el.x, el.x + el.width);
                const ddy = Math.min(el.y, el.y + el.height);
                const ddw = Math.abs(el.width);
                const ddh = Math.abs(el.height);
                const ddsx = ddw / 24, ddsy = ddh / 24;
                ctx.save();
                ctx.translate(ddx, ddy);
                ctx.scale(ddsx, ddsy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(ddsx * ddsy);
                const pagePath = new Path2D('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
                if (hasFill) ctx.fill(pagePath);
                ctx.stroke(pagePath);
                ctx.stroke(new Path2D('M14 2 L14 8 L20 8'));
                ctx.stroke(new Path2D('M8 13 L16 13'));
                ctx.stroke(new Path2D('M8 17 L16 17'));
                ctx.restore();
                break;
            }
            case 'hexagon': {
                const hx = Math.min(el.x, el.x + el.width);
                const hy = Math.min(el.y, el.y + el.height);
                const hw = Math.abs(el.width);
                const hh = Math.abs(el.height);
                const hsx = hw / 24, hsy = hh / 24;
                ctx.save();
                ctx.translate(hx, hy);
                ctx.scale(hsx, hsy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(hsx * hsy);
                const hexPath = new Path2D('M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z');
                if (hasFill) ctx.fill(hexPath);
                ctx.stroke(hexPath);
                ctx.restore();
                break;
            }
            case 'parallelogram': {
                const px = Math.min(el.x, el.x + el.width);
                const py = Math.min(el.y, el.y + el.height);
                const pw = Math.abs(el.width);
                const ph = Math.abs(el.height);
                const psx = pw / 24, psy = ph / 24;
                ctx.save();
                ctx.translate(px, py);
                ctx.scale(psx, psy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(psx * psy);
                const paraPath = new Path2D('M6 4 L22 4 L18 20 L2 20 Z');
                if (hasFill) ctx.fill(paraPath);
                ctx.stroke(paraPath);
                ctx.restore();
                break;
            }
            case 'star': {
                const stx = Math.min(el.x, el.x + el.width);
                const sty = Math.min(el.y, el.y + el.height);
                const stw = Math.abs(el.width);
                const sth = Math.abs(el.height);
                const stsx = stw / 24, stsy = sth / 24;
                ctx.save();
                ctx.translate(stx, sty);
                ctx.scale(stsx, stsy);
                ctx.lineWidth = el.strokeWidth / Math.sqrt(stsx * stsy);
                const starPath = new Path2D('M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z');
                if (hasFill) ctx.fill(starPath);
                ctx.stroke(starPath);
                ctx.restore();
                break;
            }
        }

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
            const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
            const toNext = { x: next.x - curr.x, y: next.y - curr.y };
            const distPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
            const distNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
            const r = Math.min(radius, distPrev / 2, distNext / 2);
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
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = lw;
        ctx.setLineDash([6 / zoom.value, 4 / zoom.value]);
        ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
        ctx.setLineDash([]);
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

    return {
        setupCanvas,
        handleResize,
        renderScene,
        screenToWorld,
        worldToScreen,
        getScreenPoint,
        cssWidth,
        cssHeight,
        getCtx: () => ctx,
    };
}
