// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Безопасно экспортируем API в renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    playNotificationSound: () => ipcRenderer.invoke('play-notification-assets'),
    showApp: () => ipcRenderer.send('show-app'),
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    saveScreenshot: (base64Data) => ipcRenderer.invoke('save-screenshot', base64Data),
    uploadScreenshot: (data) => ipcRenderer.invoke('upload-screenshot', data),

    // Метод для получения источников экрана
    getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

    // Метод для выбора источника
    selectSource: (sourceId) => ipcRenderer.invoke('select-source', sourceId),

    // Событие при выборе источника
    onSourceSelected: (callback) =>
        ipcRenderer.on('source-selected', (event, sourceId) => callback(sourceId)),

    // Тестовый метод для проверки связи
    testConnection: () => ipcRenderer.invoke('test-connection'),

    // Получение WebRTC конфигурации
    getWebRTCConfig: () => ({
        iceServers: [
            {
                urls: ['turn:localhost:3478'],
                username: 'testuser',
                credential: 'testpassword',
            },
            {
                urls: ['stun:stun.l.google.com:19302'],
            },
        ],
    }),
});
