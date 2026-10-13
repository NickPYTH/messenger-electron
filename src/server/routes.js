function registerRoutes(app, { onNotify, onScreenshot, onBadge }) {
    app.get('/health', (req, res) => {
        res.json({ ok: true, time: new Date().toISOString() });
    });

    app.post('/notify', async (req, res) => {
        const { title = 'Чатики', body = '', count } = req.body || {};
        try {
            if (onNotify) await onNotify({ title, body, count });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/badge', async (req, res) => {
        const { count } = req.body || {};
        try {
            const applied = onBadge ? await onBadge(count) : count;
            res.json({ ok: true, count: applied });
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
