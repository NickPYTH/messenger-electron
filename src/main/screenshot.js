const { desktopCapturer, screen } = require('electron');

/**
 * Снимок основного экрана.
 * scaled: true — размер миниатюры с учётом scaleFactor (IPC для страницы).
 * scaled: false — логические пиксели (локальный HTTP / MCP).
 */
async function capturePrimaryScreen({ scaled = false } = {}) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = scaled ? primaryDisplay.scaleFactor : 1;

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: width * scaleFactor,
            height: height * scaleFactor,
        },
    });

    if (!sources.length) return null;

    return {
        base64: sources[0].thumbnail.toPNG().toString('base64'),
        width,
        height,
    };
}

function getDesktopSources() {
    return desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 },
    });
}

module.exports = { capturePrimaryScreen, getDesktopSources };
