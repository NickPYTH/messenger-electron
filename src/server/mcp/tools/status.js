function registerStatusTool(mcpServer) {
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
}

module.exports = { registerStatusTool };
