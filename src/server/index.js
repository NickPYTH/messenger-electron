require('./polyfill');

const { createApp } = require('./createApp');
const { PORT, HOST } = require('../config');

function startServer({ port = PORT, onNotify, onScreenshot, onBadge } = {}) {
    const { app, mcpServer } = createApp({ onNotify, onScreenshot, onBadge });

    const server = app.listen(port, HOST, () => {
        console.log(`[HTTP] REST:  http://${HOST}:${port}/health`);
        console.log(`[MCP]  URL:   http://${HOST}:${port}/mcp`);
    });

    server.on('error', (err) => {
        console.error('[HTTP] Ошибка сервера:', err.message);
    });

    return {
        server,
        mcpServer,
        close: () =>
            new Promise((resolve) => {
                mcpServer.close().catch(() => {});
                server.close(() => resolve());
            }),
    };
}

module.exports = { startServer };
