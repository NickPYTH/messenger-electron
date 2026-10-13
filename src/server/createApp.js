const express = require('express');
const { registerRoutes } = require('./routes');
const { createMcpServer, mountMcp } = require('./mcp');

function createApp({ onNotify, onScreenshot, onBadge }) {
    const app = express();
    app.use(express.json({ limit: '20mb' }));

    // Страница мессенджера на другом origin ходит сюда с localhost.
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });

    registerRoutes(app, { onNotify, onScreenshot, onBadge });

    const mcpServer = createMcpServer({ onNotify, onScreenshot });
    mountMcp(app, mcpServer);

    return { app, mcpServer };
}

module.exports = { createApp };
