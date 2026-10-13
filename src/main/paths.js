const path = require('path');

/** Корень проекта: src/main → ../.. */
const rootDir = path.join(__dirname, '..', '..');

function assetPath(...segments) {
    return path.join(rootDir, 'assets', ...segments);
}

function preloadPath() {
    return path.join(__dirname, '..', 'preload', 'index.js');
}

module.exports = { rootDir, assetPath, preloadPath };
