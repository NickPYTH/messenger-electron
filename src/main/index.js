const { app, BrowserWindow, Notification, session } = require('electron');
const { startServer } = require('../server');
const { PORT, AUTH_WHITELIST } = require('../config');
const state = require('./state');
const { createWindow } = require('./window');
const { createTray } = require('./tray');
const { setupIPCHandlers } = require('./ipc');
const { capturePrimaryScreen } = require('./screenshot');
const { incrementBadge, setBadgeCount } = require('./badge');

// Объявляем до первого close: !undefined === true закрыл бы окно вместо трея.
app.isQuitting = false;

// SSO / Kerberos для *.sgp.ru. Ставится до app.ready.
// whitelist — имена, с которыми приложение работало на Electron 28.
// allowlist — имя, которое читает Chromium в Electron 44.
// Список хостов тот же: им можно отдать встроенную проверку Windows.
app.commandLine.appendSwitch('auth-server-whitelist', AUTH_WHITELIST);
app.commandLine.appendSwitch('auth-server-allowlist', AUTH_WHITELIST);
app.commandLine.appendSwitch('auth-negotiate-whitelist', AUTH_WHITELIST);

if (process.platform === 'win32') {
    app.setAppUserModelId('ru.sgp.messenger');
}
if (process.platform === 'linux') {
    // Имя .desktop, с которым electron-builder ставит приложение на Альт.
    // По нему KDE может показать счётчик на панели, если она понимает LauncherEntry.
    app.setDesktopName('messenger-electron.desktop');
}

app.whenReady().then(() => {
    // Дублирует флаги выше через API Electron, ему не важно, как переименован ключ Chromium.
    session.defaultSession.allowNTLMCredentialsForDomains(AUTH_WHITELIST);

    createWindow();
    createTray();
    setupIPCHandlers();

    state.httpBundle = startServer({
        port: PORT,
        onNotify: async ({ title, body, count }) => {
            new Notification({ title, body, silent: false }).show();
            if (count === undefined || count === null || count === '') incrementBadge();
            else setBadgeCount(count);
        },
        onBadge: (count) => setBadgeCount(count),
        onScreenshot: async () => {
            const shot = await capturePrimaryScreen();
            return shot?.base64 || null;
        },
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('before-quit', async (event) => {
    if (!state.httpBundle) return;
    event.preventDefault();
    try {
        await state.httpBundle.close();
        console.log('[HTTP] Сервер остановлен');
    } catch (e) {
        console.error('[HTTP] Ошибка при остановке:', e);
    } finally {
        state.httpBundle = null;
        app.exit(0);
    }
});

// Приложение живёт в трее — не выходим при закрытии всех окон.
app.on('window-all-closed', () => {});
