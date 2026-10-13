const { app, Tray, Menu } = require('electron');
const state = require('./state');
const { showMainWindow } = require('./window');
const { applyBadge, renderTrayIcon } = require('./badge');

function createTray() {
    state.tray = new Tray(renderTrayIcon(state.unreadCount || 0));
    applyBadge();

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Открыть',
            click: () => showMainWindow(),
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

    state.tray.setContextMenu(contextMenu);

    state.tray.on('click', () => {
        if (!state.mainWindow) return;
        if (state.mainWindow.isVisible()) state.mainWindow.hide();
        else showMainWindow();
    });

    return state.tray;
}

module.exports = { createTray };
