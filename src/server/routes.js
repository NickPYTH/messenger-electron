function registerRoutes(app, { onNotify, onScreenshot }) {
    app.get('/health', (req, res) => {
        res.json({ ok: true, time: new Date().toISOString() });
    });

    app.post('/notify', async (req, res) => {
        const { title = 'Чатики', body = '' } = req.body || {};
        try {
            if (onNotify) await onNotify({ title, body });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/screenshot', async (req, res) => {
        try {
            const base64 = await onScreenshot();
            if (!base64) return res.status(500).json({ ok: false });
            res.json({ ok: true, data: base64 });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = { registerRoutes };
