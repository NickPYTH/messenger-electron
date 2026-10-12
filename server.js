const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const { z } = require('zod');

if (typeof globalThis.crypto === 'undefined') {
    try {
        // Пытаемся получить Web Crypto API из встроенного модуля Node.js
        const { webcrypto } = require('node:crypto');
        globalThis.crypto = webcrypto;
    } catch (e) {
        console.error('Не удалось установить полифилл для crypto:', e);
    }
}

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
    StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const execAsync = promisify(exec);

function startServer({ port = 3737, onNotify, onScreenshot } = {}) {
    const app = express();
    app.use(express.json({ limit: '20mb' }));

    // CORS — чтобы клиент со страницы https://sco1-vapp-09.sgp.ru мог обращаться
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });

    // ============================================================
    // 1. ОБЫЧНЫЕ REST-ЭНДПОИНТЫ (оставлены как были)
    // ============================================================

    app.get('/health', (req, res) => {
        res.json({ ok: true, time: new Date().toISOString() });
    });

    app.post('/notify', async (req, res) => {
        const { title = 'Чатики', body = '' } = req.body || {};
        try {
            if (onNotify) await onNotify({ title, body });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/screenshot', async (req, res) => {
        try {
            const base64 = await onScreenshot();
            if (!base64) return res.status(500).json({ ok: false });
            res.json({ ok: true, data: base64 });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // ============================================================
    // 2. MCP-СЕРВЕР
    // ============================================================

    const mcpServer = new McpServer({
        name: 'messenger-tools',
        version: '1.0.0',
    });

    // --- Инструмент: выполнение консольной команды ---
    // ОСТОРОЖНО: это позволяет выполнять произвольные команды.
    // Ниже — простой whitelist, отредактируйте под себя.
    const ALLOWED_PREFIXES = [
        'ls', 'pwd', 'whoami', 'cat', 'echo', 'date', 'uname',
        'df', 'free', 'uptime', 'ping -c 1',
    ];

    mcpServer.tool(
        'run_command',
        'Выполняет разрешённую консольную команду и возвращает stdout/stderr.',
        {
            command: z.string().describe('Команда для выполнения'),
            cwd: z.string().optional().describe('Рабочая директория (опционально)'),
        },
        async ({ command, cwd }) => {
            const trimmed = command.trim();
            const allowed = ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p));

            if (!allowed) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Команда отклонена: '${trimmed}'. Разрешены только: ${ALLOWED_PREFIXES.join(', ')}`,
                        },
                    ],
                    isError: true,
                };
            }

            try {
                const { stdout, stderr } = await execAsync(trimmed, {
                    cwd: cwd || process.cwd(),
                    timeout: 30000,
                    maxBuffer: 1024 * 1024,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `STDOUT:\n${stdout || '(пусто)'}\n\nSTDERR:\n${stderr || '(пусто)'}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Ошибка: ${error.message}\nSTDERR: ${error.stderr || ''}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // --- Инструмент: показать уведомление ---
    mcpServer.tool(
        'send_notification',
        'Показывает системное уведомление в приложении.',
        {
            title: z.string().describe('Заголовок'),
            body: z.string().describe('Текст уведомления'),
        },
        async ({ title, body }) => {
            try {
                if (onNotify) await onNotify({ title, body });
                return {
                    content: [{ type: 'text', text: `Уведомление "${title}" показано.` }],
                };
            } catch (e) {
                return {
                    content: [{ type: 'text', text: `Ошибка: ${e.message}` }],
                    isError: true,
                };
            }
        }
    );

    // --- Инструмент: сделать скриншот ---
    mcpServer.tool(
        'take_screenshot',
        'Делает скриншот основного экрана и возвращает его в base64 (PNG).',
        {},
        async () => {
            try {
                const base64 = await onScreenshot();
                if (!base64) {
                    return {
                        content: [{ type: 'text', text: 'Не удалось получить скриншот.' }],
                        isError: true,
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Скриншот сделан (${Math.round(base64.length / 1024)} KB base64).`,
                        },
                        {
                            type: 'image',
                            data: base64,
                            mimeType: 'image/png',
                        },
                    ],
                };
            } catch (e) {
                return {
                    content: [{ type: 'text', text: `Ошибка: ${e.message}` }],
                    isError: true,
                };
            }
        }
    );

    // --- Инструмент: состояние приложения ---
    mcpServer.tool(
        'get_status',
        'Возвращает статус приложения и время.',
        {},
        async () => ({
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(
                        {
                            status: 'running',
                            time: new Date().toISOString(),
                            platform: process.platform,
                            pid: process.pid,
                        },
                        null,
                        2
                    ),
                },
            ],
        })
    );

    // ============================================================
    // 3. МОНТИРУЕМ MCP ПОВЕРХ HTTP
    // ============================================================
    // StreamableHTTPServerTransport в stateless-режиме:
    // каждый POST /mcp — отдельная сессия, состояние не хранится.
    // Подходит для простых инструментов.

    app.post('/mcp', async (req, res) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined, // stateless
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

    // Некоторые клиенты сначала дёргают GET /mcp (для SSE-стрима).
    // В stateless-режиме SSE не поддерживается — отдаём 405.
    app.get('/mcp', (req, res) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'SSE not supported (stateless mode)' },
            id: null,
        });
    });

    // DELETE /mcp — закрытие сессии. В stateless не нужен.
    app.delete('/mcp', (req, res) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Not supported (stateless mode)' },
            id: null,
        });
    });

    // ============================================================
    // 4. ЗАПУСК
    // ============================================================

    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`[HTTP] REST:  http://0.0.0.0:${port}/health`);
        console.log(`[MCP]  URL:   http://0.0.0.0:${port}/mcp`);
    });

    server.on('error', (err) => {
        console.error('[HTTP] Ошибка сервера:', err.message);
    });

    // Возвращаем и HTTP-сервер, и MCP-сервер — для корректного shutdown
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