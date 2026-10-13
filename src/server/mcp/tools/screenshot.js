function registerScreenshotTool(mcpServer, { onScreenshot }) {
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
}

module.exports = { registerScreenshotTool };
