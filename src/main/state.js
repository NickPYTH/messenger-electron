/** Живые ссылки main-процесса. Держим явно, иначе GC снимет окно и трей. */
module.exports = {
    mainWindow: null,
    tray: null,
    httpBundle: null,
    unreadCount: 0,
};
