const { z } = require('zod');

function registerNotifyTool(mcpServer, { onNotify }) {
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
}

module.exports = { registerNotifyTool };
