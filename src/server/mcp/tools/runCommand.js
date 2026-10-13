const { exec } = require('child_process');
const { promisify } = require('util');
const { z } = require('zod');

const execAsync = promisify(exec);

const ALLOWED_PREFIXES = [
    'ls', 'pwd', 'whoami', 'cat', 'echo', 'date', 'uname',
    'df', 'free', 'uptime', 'ping -c 1',
];

function registerRunCommandTool(mcpServer) {
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
}

module.exports = { registerRunCommandTool };
