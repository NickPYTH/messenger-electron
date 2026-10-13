if (typeof globalThis.crypto === 'undefined') {
    try {
        const { webcrypto } = require('node:crypto');
        globalThis.crypto = webcrypto;
    } catch (e) {
        console.error('Не удалось установить полифилл для crypto:', e);
    }
}
