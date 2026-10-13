const { app, Tray, Menu, nativeImage } = require('electron');
const state = require('./state');
const { assetPath } = require('./paths');
const { showMainWindow } = require('./window');

function createTray() {
    const iconPath = assetPath('tray-icon.png');

    let trayImage = nativeImage.createFromPath(iconPath);
    if (trayImage.isEmpty()) {
        console.error('[Tray] Иконка не найдена:', iconPath, '— использую заглушку');
        trayImage = nativeImage.createFromDataURL(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        );
    }
    trayImage = trayImage.resize({ width: 16, height: 16 });

    state.tray = new Tray(trayImage);
    state.tray.setToolTip('Чатики');

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
        else state.mainWindow.show();
    });

    return state.tray;
}

module.exports = { createTray };
