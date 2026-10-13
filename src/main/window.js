const { app, BrowserWindow, Menu } = require('electron');
const state = require('./state');
const { preloadPath } = require('./paths');
const { MESSENGER_URL, WINDOW } = require('../config');

function createWindow() {
    state.mainWindow = new BrowserWindow({
        width: WINDOW.width,
        height: WINDOW.height,
        webPreferences: {
            contextIsolation: true,
            // webSecurity и allowRunningInsecureContent нужны только если
            // SSO/Kerberos через *.sgp.ru не заводится без них.
            webSecurity: false,
            allowRunningInsecureContent: true,
            preload: preloadPath(),
        },
    });

    state.mainWindow.loadURL(MESSENGER_URL);
    Menu.setApplicationMenu(null);

    state.mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            state.mainWindow.hide();
        }
    });

    state.mainWindow.on('closed', () => {
        state.mainWindow = null;
    });

    return state.mainWindow;
}

function showMainWindow() {
    if (!state.mainWindow) return createWindow();
    if (state.mainWindow.isMinimized()) state.mainWindow.restore();
    state.mainWindow.show();
    state.mainWindow.focus();
    return state.mainWindow;
}

module.exports = { createWindow, showMainWindow };
