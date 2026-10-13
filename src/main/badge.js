const { app, nativeImage, screen } = require('electron');
const state = require('./state');
const { assetPath } = require('./paths');

/** 3×5, старший бит слева. */
const FONT = {
    '0': [0b111, 0b101, 0b101, 0b101, 0b111],
    '1': [0b010, 0b110, 0b010, 0b010, 0b111],
    '2': [0b111, 0b001, 0b111, 0b100, 0b111],
    '3': [0b111, 0b001, 0b111, 0b001, 0b111],
    '4': [0b101, 0b101, 0b111, 0b001, 0b001],
    '5': [0b111, 0b100, 0b111, 0b001, 0b111],
    '6': [0b111, 0b100, 0b111, 0b101, 0b111],
    '7': [0b111, 0b001, 0b001, 0b001, 0b001],
    '8': [0b111, 0b101, 0b111, 0b101, 0b111],
    '9': [0b111, 0b101, 0b111, 0b001, 0b111],
};

const GLYPH_W = 3;
const GLYPH_H = 5;
const RED = [220, 38, 38];
const WHITE = [255, 255, 255];

let baseImage = null;

function normalizeCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(999, Math.floor(n));
}

function badgeLabel(count) {
    if (count > 99) return '99';
    return String(count);
}

function loadBaseImage() {
    if (baseImage && !baseImage.isEmpty()) return baseImage;

    const loaded = nativeImage.createFromPath(assetPath('tray-icon.png'));
    if (!loaded.isEmpty()) {
        baseImage = loaded;
        return baseImage;
    }

    console.error('[Badge] Иконка трея не найдена, использую заглушку');
    baseImage = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    );
    return baseImage;
}

function imageBitmap(image) {
    const factors = typeof image.getScaleFactors === 'function' ? image.getScaleFactors() : [];
    const scale = factors[0] || 1;
    const bitmap = Buffer.from(image.toBitmap({ scaleFactor: scale }));
    const { width, height } = image.getSize(scale);
    let bitmapWidth = Math.round(width * scale);
    let bitmapHeight = Math.round(height * scale);
    if (bitmap.length !== bitmapWidth * bitmapHeight * 4) {
        bitmapWidth = width;
        bitmapHeight = height;
    }
    if (bitmap.length !== bitmapWidth * bitmapHeight * 4) return null;
    return { bitmap, bitmapWidth, bitmapHeight };
}

function setPixel(buf, width, height, x, y, r, g, b, a) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = (py * width + px) * 4;
    buf[i] = b;
    buf[i + 1] = g;
    buf[i + 2] = r;
    buf[i + 3] = a;
}

function fillCircle(buf, width, height, cx, cy, radius, color) {
    const [r, g, b] = color;
    const r2 = radius * radius;
    const y0 = Math.floor(cy - radius);
    const y1 = Math.ceil(cy + radius);
    const x0 = Math.floor(cx - radius);
    const x1 = Math.ceil(cx + radius);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r2) setPixel(buf, width, height, x, y, r, g, b, 255);
        }
    }
}

function fillPill(buf, width, height, cx, cy, radiusX, radiusY, color) {
    const [r, g, b] = color;
    const y0 = Math.floor(cy - radiusY);
    const y1 = Math.ceil(cy + radiusY);
    const x0 = Math.floor(cx - radiusX);
    const x1 = Math.ceil(cx + radiusX);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = Math.max(0, Math.abs(x + 0.5 - cx) - (radiusX - radiusY));
            const dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= radiusY * radiusY) {
                setPixel(buf, width, height, x, y, r, g, b, 255);
            }
        }
    }
}

function drawLabel(buf, width, height, label, originX, originY, scale) {
    const gap = scale;
    for (let n = 0; n < label.length; n++) {
        const glyph = FONT[label[n]];
        if (!glyph) continue;
        const x = originX + n * (GLYPH_W * scale + gap);
        for (let row = 0; row < GLYPH_H; row++) {
            const bits = glyph[row];
            for (let col = 0; col < GLYPH_W; col++) {
                if (((bits >> (GLYPH_W - 1 - col)) & 1) === 0) continue;
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        setPixel(
                            buf,
                            width,
                            height,
                            x + col * scale + dx,
                            originY + row * scale + dy,
                            WHITE[0],
                            WHITE[1],
                            WHITE[2],
                            255
                        );
                    }
                }
            }
        }
    }
}

function badgeLayout(size, label) {
    const digits = label.length;
    const maxTextH = Math.floor(size * 0.7);
    const maxTextW = Math.floor(size * (digits > 1 ? 0.86 : 0.62));
    const widthUnit = digits * GLYPH_W + Math.max(0, digits - 1);
    const fontScale = Math.max(
        1,
        Math.min(Math.floor(maxTextH / GLYPH_H), Math.floor(maxTextW / widthUnit))
    );
    const textWidth = digits * GLYPH_W * fontScale + Math.max(0, digits - 1) * fontScale;
    const textHeight = GLYPH_H * fontScale;
    const pad = Math.max(2, Math.round(fontScale * 0.85));
    const limit = Math.floor(size / 2) - 1;
    const radiusY = Math.min(limit, Math.ceil(textHeight / 2 + pad));
    const radiusX = Math.min(limit, Math.max(radiusY, Math.ceil(textWidth / 2 + pad)));
    return { fontScale, textWidth, textHeight, radiusX, radiusY, ring: Math.max(2, Math.round(fontScale * 0.45)) };
}

function paintCount(image, count) {
    const raster = imageBitmap(image);
    if (!raster) {
        console.error('[Badge] Неожиданный размер bitmap, значок без цифры');
        return image;
    }
    const { bitmap, bitmapWidth, bitmapHeight } = raster;

    const label = badgeLabel(count);
    const layout = badgeLayout(Math.min(bitmapWidth, bitmapHeight), label);
    const { fontScale, textWidth, textHeight, radiusX, radiusY, ring } = layout;
    const cx = bitmapWidth / 2;
    const cy = bitmapHeight / 2;

    fillPill(bitmap, bitmapWidth, bitmapHeight, cx, cy, radiusX + ring, radiusY + ring, WHITE);
    fillPill(bitmap, bitmapWidth, bitmapHeight, cx, cy, radiusX, radiusY, RED);

    const originX = Math.round(cx - textWidth / 2);
    const originY = Math.round(cy - textHeight / 2);
    drawLabel(bitmap, bitmapWidth, bitmapHeight, label, originX, originY, fontScale);

    return nativeImage.createFromBitmap(bitmap, {
        width: bitmapWidth,
        height: bitmapHeight,
        scaleFactor: 1,
    });
}

function trayCanvasSize() {
    let scale = 1;
    try {
        scale = screen.getPrimaryDisplay().scaleFactor || 1;
    } catch (e) {
        scale = 1;
    }
    // Слот трея маленький и его не растянуть. Большой холст нужен, чтобы цифра
    // после сжатия Windows/KDE осталась толстой и занимала почти весь значок.
    return Math.max(64, Math.round(48 * scale));
}

function renderTrayIcon(count) {
    const size = trayCanvasSize();
    const base = loadBaseImage().resize({ width: size, height: size, quality: 'best' });
    if (!count) return base;
    return paintCount(base, count);
}

function renderOverlayIcon(count) {
    const size = 16;
    const empty = nativeImage.createFromBitmap(Buffer.alloc(size * size * 4), {
        width: size,
        height: size,
    });
    if (!count) return empty;
    return paintCount(empty, count);
}

function tooltip(count) {
    if (!count) return 'Чатики';
    return `Чатики — ${count}`;
}

function userIsLooking() {
    const win = state.mainWindow;
    return !!(
        win &&
        !win.isDestroyed() &&
        win.isVisible() &&
        !win.isMinimized() &&
        win.isFocused()
    );
}

function applyBadge() {
    const count = state.unreadCount || 0;

    if (state.tray && !state.tray.isDestroyed()) {
        state.tray.setImage(renderTrayIcon(count));
        state.tray.setToolTip(tooltip(count));
    }

    const win = state.mainWindow;
    if (process.platform === 'win32' && win && !win.isDestroyed()) {
        if (count > 0) {
            win.setOverlayIcon(renderOverlayIcon(count), tooltip(count));
        } else {
            win.setOverlayIcon(null, '');
        }
    }

    // KDE этот вызов показывает только если панель понимает LauncherEntry.
    // На значке трея цифра уже нарисована и от дока не зависит.
    if (process.platform === 'linux') {
        app.setBadgeCount(count);
    }
}

function setBadgeCount(value) {
    state.unreadCount = normalizeCount(value);
    applyBadge();
    console.log('[Badge] Счётчик:', state.unreadCount);
    return state.unreadCount;
}

function incrementBadge() {
    if (userIsLooking()) return state.unreadCount || 0;
    return setBadgeCount((state.unreadCount || 0) + 1);
}

function clearBadge() {
    return setBadgeCount(0);
}

module.exports = {
    setBadgeCount,
    incrementBadge,
    clearBadge,
    applyBadge,
    renderTrayIcon,
    normalizeCount,
};
