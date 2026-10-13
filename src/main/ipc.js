const fs = require('fs');
const { ipcMain, Notification } = require('electron');
const state = require('./state');
const { assetPath } = require('./paths');
const { showMainWindow } = require('./window');
const { capturePrimaryScreen, getDesktopSources } = require('./screenshot');

function setupIPCHandlers() {
    ipcMain.handle('take-screenshot', async () => {
        try {
            const shot = await capturePrimaryScreen({ scaled: true });
            if (!shot) {
                console.error('[Screenshot] Источники экрана не найдены');
                return null;
            }
            console.log('[Screenshot] Готов, размер:', shot.width, 'x', shot.height);
            return shot.base64;
        } catch (error) {
            console.error('[Screenshot] Ошибка:', error);
            return null;
        }
    });

    ipcMain.handle(
        'upload-screenshot',
        async (event, { base64Data, fileName = `screenshot-${Date.now()}.png` }) => {
            try {
                const buffer = Buffer.from(base64Data, 'base64');
                return {
                    success: true,
                    data: {
                        fileName,
                        base64Data,
                        buffer: buffer.buffer,
                        size: buffer.length,
                        mimeType: 'image/png',
                    },
                };
            } catch (error) {
                console.error('[Upload] Ошибка:', error);
                return { success: false, error: error.message };
            }
        }
    );

    ipcMain.handle('test-connection', async () => ({
        status: 'success',
        message: 'Связь Electron-React работает!',
        timestamp: new Date().toISOString(),
    }));

    ipcMain.handle('get-desktop-sources', async () => {
        try {
            const sources = await getDesktopSources();
            console.log(`[Sources] Найдено ${sources.length}`);
            return sources;
        } catch (error) {
            console.error('[Sources] Ошибка:', error);
            return [];
        }
    });

    ipcMain.handle('select-source', (event, sourceId) => {
        console.log('[Sources] Выбран:', sourceId);
        if (state.mainWindow) state.mainWindow.webContents.send('source-selected', sourceId);
        return true;
    });

    ipcMain.on('show-app', () => {
        showMainWindow();
        console.log('[IPC] show-app');
    });

    ipcMain.handle('play-notification-assets', async (event, soundType = 'message') => {
        try {
            const soundMap = {
                message: assetPath('sounds', 'message.mp3'),
                call: assetPath('sounds', 'message.mp3'),
                alert: assetPath('sounds', 'message.mp3'),
            };

            const soundPath = soundMap[soundType];
            console.log('[Notify] soundType:', soundType, '→', soundPath);

            // Notification не проигрывает произвольный mp3.
            // Кастомный файл — через renderer; здесь системный звук.
            new Notification({
                title: 'Чатики',
                body: 'Новое сообщение',
                silent: false,
            }).show();

            return {
                success: true,
                usedCustomSound: fs.existsSync(soundPath),
            };
        } catch (error) {
            console.error('[Notify] Ошибка:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { setupIPCHandlers };
