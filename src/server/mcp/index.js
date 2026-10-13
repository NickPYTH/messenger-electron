const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
    StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerRunCommandTool } = require('./tools/runCommand');
const { registerNotifyTool } = require('./tools/notify');
const { registerScreenshotTool } = require('./tools/screenshot');
const { registerStatusTool } = require('./tools/status');

function createMcpServer({ onNotify, onScreenshot }) {
    const mcpServer = new McpServer({
        name: 'messenger-tools',
        version: '1.0.0',
    });

    registerRunCommandTool(mcpServer);
    registerNotifyTool(mcpServer, { onNotify });
    registerScreenshotTool(mcpServer, { onScreenshot });
    registerStatusTool(mcpServer);

    return mcpServer;
}

/**
 * Streamable HTTP в stateless-режиме: каждый POST /mcp — отдельная сессия.
 */
function mountMcp(app, mcpServer) {
    app.post('/mcp', async (req, res) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            res.on('close', () => transport.close());
            await mcpServer.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error('[MCP] Ошибка обработки запроса:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal error' },
                    id: null,
                });
            }
        }
    });

    app.get('/mcp', (req, res) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'SSE not supported (stateless mode)' },
            id: null,
        });
    });

    app.delete('/mcp', (req, res) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Not supported (stateless mode)' },
            id: null,
        });
    });
}

module.exports = { createMcpServer, mountMcp };
