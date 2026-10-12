const {
    app,
    BrowserWindow,
    Tray,
    Menu,
    nativeImage,
    ipcMain,
    desktopCapturer,
    screen,
    Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer } = require('./server');

// Глобальные ссылки — иначе GC удалит объекты
let tray = null;
let mainWindow = null;
let httpBundle = null;

// Флаг «пользователь явно вышел». Объявляем до первого использования,
// иначе !undefined === true и окно закроется вместо сворачивания в трей.
app.isQuitting = false;

// ============================================================
// ОКНО
// ============================================================

function createWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');

    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            contextIsolation: true,
            // webSecurity и allowRunningInsecureContent нужны только если
            // SSO/Kerberos через *.sgp.ru не заводится без них.
            // Попробуйте убрать — если работает, оставьте убранным.
            webSecurity: false,
            allowRunningInsecureContent: true,
            preload: preloadPath,
        },
    });

    // mainWindow.loadURL('http://localhost:3000/messenger/');
    mainWindow.loadURL('https://sco1-vapp-09.sgp.ru/messenger/');

    Menu.setApplicationMenu(null);

    // mainWindow.webContents.openDevTools();

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============================================================
// ТРЕЙ
// ============================================================

function createTray() {
    const iconPath = path.join(__dirname, 'tray-icon.png');

    let trayImage = nativeImage.createFromPath(iconPath);
    if (trayImage.isEmpty()) {
        console.error('[Tray] Иконка не найдена:', iconPath, '— использую заглушку');
        trayImage = nativeImage.createFromDataURL(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        );
    }
    trayImage = trayImage.resize({ width: 16, height: 16 });

    tray = new Tray(trayImage);
    tray.setToolTip('Чатики');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Открыть',
            click: () => {
                if (!mainWindow) return createWindow();
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            },
        },
        { type: 'separator' },
        {
            label: 'Выйти',
            click: () => {
                app.isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
    });
}

// ============================================================
// IPC
// ============================================================

function setupIPCHandlers() {
    // --- Скриншот (для React через window.electronAPI.takeScreenshot) ---
    ipcMain.handle('take-screenshot', async () => {
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.size;
            const scaleFactor = primaryDisplay.scaleFactor;

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: width * scaleFactor,
                    height: height * scaleFactor,
                },
            });

            if (!sources.length) {
                console.error('[Screenshot] Источники экрана не найдены');
                return null;
            }

            const base64Data = sources[0].thumbnail.toPNG().toString('base64');
            console.log('[Screenshot] Готов, размер:', width, 'x', height);
            return base64Data;
        } catch (error) {
            console.error('[Screenshot] Ошибка:', error);
            return null;
        }
    });

    // --- Обработка base64 на стороне main (для отправки на сервер) ---
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

    // --- Тест связи ---
    ipcMain.handle('test-connection', async () => ({
        status: 'success',
        message: 'Связь Electron-React работает!',
        timestamp: new Date().toISOString(),
    }));

    // --- Источники экрана / окон ---
    ipcMain.handle('get-desktop-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 },
            });
            console.log(`[Sources] Найдено ${sources.length}`);
            return sources;
        } catch (error) {
            console.error('[Sources] Ошибка:', error);
            return [];
        }
    });

    ipcMain.handle('select-source', (event, sourceId) => {
        console.log('[Sources] Выбран:', sourceId);
        if (mainWindow) mainWindow.webContents.send('source-selected', sourceId);
        return true;
    });

    // --- Показать окно (из трея/уведомления) ---
    ipcMain.on('show-app', () => {
        if (!mainWindow) return createWindow();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        console.log('[IPC] show-app');
    });

    // --- Уведомление со звуком ---
    ipcMain.handle('play-notification-assets', async (event, soundType = 'message') => {
        try {
            const soundMap = {
                message: path.join(__dirname, 'sounds', 'message.mp3'),
                call: path.join(__dirname, 'sounds', 'message.mp3'),
                alert: path.join(__dirname, 'sounds', 'message.mp3'),
            };

            const soundPath = soundMap[soundType];
            console.log('[Notify] soundType:', soundType, '→', soundPath);

            // В Electron Notification не умеет проигрывать кастомный mp3-файл.
            // Можно либо использовать системный звук (silent: false),
            // либо проигрывать mp3 через renderer (HTMLAudioElement).
            // Здесь — системный звук как простой вариант.
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

// ============================================================
// SSO / Kerberos
// ============================================================

app.commandLine.appendSwitch('auth-server-whitelist', '*.sgp.ru');
app.commandLine.appendSwitch('auth-negotiate-whitelist', '*.sgp.ru');

// ============================================================
// ЗАПУСК
// ============================================================

app.whenReady().then(() => {
    createWindow();
    createTray();
    setupIPCHandlers();

    // startServer теперь возвращает { server, mcpServer, close }
    httpBundle = startServer({
        port: 3737,
        onNotify: async ({ title, body }) => {
            new Notification({ title, body, silent: false }).show();
        },
        onScreenshot: async () => {
            const display = screen.getPrimaryDisplay();
            const { width, height } = display.size;
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width, height },
            });
            return sources[0]?.thumbnail.toPNG().toString('base64') || null;
        },
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// ============================================================
// ЗАВЕРШЕНИЕ
// ============================================================

app.on('before-quit', async (event) => {
    if (!httpBundle) return;
    // Даём серверу корректно закрыться
    event.preventDefault();
    try {
        await httpBundle.close();
        console.log('[HTTP] Сервер остановлен');
    } catch (e) {
        console.error('[HTTP] Ошибка при остановке:', e);
    } finally {
        httpBundle = null;
        app.exit(0); // теперь выходим по-настоящему
    }
});

// Приложение живёт в трее — не выходим при закрытии всех окон
app.on('window-all-closed', () => {
    // Намеренно ничего не делаем. Выход — только через трей → «Выйти».
});