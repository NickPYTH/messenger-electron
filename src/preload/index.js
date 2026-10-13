const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    playNotificationSound: (payload) => ipcRenderer.invoke('play-notification-assets', payload),
    setBadgeCount: (count) => ipcRenderer.invoke('set-badge-count', count),
    getBadgeCount: () => ipcRenderer.invoke('get-badge-count'),
    showApp: () => ipcRenderer.send('show-app'),
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    saveScreenshot: (base64Data) => ipcRenderer.invoke('save-screenshot', base64Data),
    uploadScreenshot: (data) => ipcRenderer.invoke('upload-screenshot', data),

    getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
    selectSource: (sourceId) => ipcRenderer.invoke('select-source', sourceId),
    onSourceSelected: (callback) =>
        ipcRenderer.on('source-selected', (event, sourceId) => callback(sourceId)),

    testConnection: () => ipcRenderer.invoke('test-connection'),

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
