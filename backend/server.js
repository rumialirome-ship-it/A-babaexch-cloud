
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');

// Internal modules
const database = require('./database');
const authMiddleware = require('./authMiddleware');
const { sendWhatsAppReport } = require('./whatsappService');

const app = express();
const server = http.createServer(app);

// --- 1. CORE MIDDLEWARE (Must be before routes) ---
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- 2. HEALTH CHECKS ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- 3. API ROUTES (Registered Synchronously) ---
const JWT_SECRET = process.env.JWT_SECRET || 'ababa-secure-cloud-9988-secret';

app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    const { account, role } = database.findAccountForLogin(loginId);
    if (account && account.password === password) {
        const fullAccount = database.findAccountById(account.id, role.toLowerCase() + 's', 100);
        const token = jwt.sign({ id: account.id, role }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token, role, account: fullAccount });
    }
    res.status(401).json({ message: 'Invalid Credentials' });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
    const role = req.user.role;
    const account = database.findAccountById(req.user.id, role.toLowerCase() + 's', 100);
    if (!account) return res.status(404).json({ message: 'Not found' });
    let extra = {};
    if (role === 'DEALER') { 
        extra.users = database.findUsersByDealerId(req.user.id); 
        extra.bets = database.findBetsByDealerId(req.user.id); 
    }
    else if (role === 'USER') { 
        extra.bets = database.findBetsByUserId(req.user.id); 
    }
    else if (role === 'ADMIN') { 
        extra.dealers = database.getAllFromTable('dealers'); 
        extra.users = database.getAllFromTable('users'); 
        extra.bets = database.getAllFromTable('bets'); 
    }
    res.json({ account, role, ...extra });
});

app.get('/api/ledger/:accountId', authMiddleware, (req, res) => {
    const { accountId } = req.params;
    const { role } = req.user;
    if (role === 'DEALER' && accountId !== req.user.id) {
        const user = database.findAccountById(accountId, 'users');
        if (!user || user.dealerId.toLowerCase() !== req.user.id.toLowerCase()) {
            return res.status(403).json({ message: 'Access Denied' });
        }
    } else if (role === 'USER' && accountId !== req.user.id) {
        if (accountId !== req.user.id) return res.status(403).json({ message: 'Access Denied' });
    }
    res.json(database.getLedgerForAccount(accountId, 500));
});

app.get('/api/admin/summary', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    res.json(database.getFinancialSummary(req.query.gameId));
});
app.get('/api/admin/detailed-winners', authMiddleware, (req, res) => res.json(database.getDetailedWinners()));
app.get('/api/admin/live-stats', authMiddleware, (req, res) => res.json(database.getLiveStats()));
app.get('/api/admin/number-summary', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    res.json(database.getNumberSummary(req.query));
});
app.get('/api/admin/export', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    res.json(database.exportDatabaseState());
});
app.get('/api/admin/bets/search', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    res.json(database.searchBets(req.query.q, req.query.gameId, req.query.userId));
});

app.post('/api/admin/dealers', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    try { database.createDealer(req.body); res.json({ success: true }); } catch (e) { res.status(400).json({ message: e.message }); }
});
app.put('/api/admin/dealers/:id', authMiddleware, (req, res) => { database.updateDealer(req.params.id, req.body); res.json({ success: true }); });
app.put('/api/admin/users/:id', authMiddleware, (req, res) => { database.updateUser(req.params.id, req.body); res.json({ success: true }); });
app.put('/api/admin/games/:id/draw-time', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    database.updateGameDrawTime(req.params.id, req.body.newDrawTime);
    res.json({ success: true });
});
app.put('/api/admin/games/:id/report-settings', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    database.updateGameReportSettings(req.params.id, req.body.reportTime, req.body.whatsappNumber);
    res.json({ success: true });
});

app.post('/api/dealer/users', authMiddleware, (req, res) => {
    database.createUser({ ...req.body.userData, dealerId: req.user.id, wallet: 0 });
    res.json({ success: true });
});
app.put('/api/dealer/users/:id', authMiddleware, (req, res) => {
    const user = database.findAccountById(req.params.id, 'users');
    if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
        database.updateUser(req.params.id, req.body);
        res.json({ success: true });
    } else res.status(403).json({ message: 'Access Denied' });
});
app.delete('/api/dealer/users/:id', authMiddleware, (req, res) => { database.deleteUser(req.params.id); res.json({ success: true }); });

app.post('/api/user/bets', authMiddleware, (req, res) => {
    try { 
        const result = database.placeBet(req.user.id, req.body); 
        const io = app.get('io');
        if (io) io.emit('betPlaced', { userId: req.user.id, bet: result }); 
        res.json(result); 
    } catch (e) { res.status(400).json({ message: e.message }); }
});
app.post('/api/dealer/bets/bulk', authMiddleware, (req, res) => {
    try {
        const user = database.findAccountById(req.body.userId, 'users');
        if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
            const result = database.placeBet(req.body.userId, req.body);
            const io = app.get('io');
            if (io) io.emit('betPlaced', { userId: req.body.userId, bet: result });
            res.json(result);
        } else res.status(403).json({ message: 'Unauthorized terminal access' });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.post('/api/dealer/topup/user', authMiddleware, (req, res) => {
    try { const result = database.transferFunds(req.user.id, 'dealers', req.body.userId, 'users', req.body.amount, 'Dealer Network Top-up'); res.json({ success: true, balance: result.receiverBalance }); } catch (e) { res.status(400).json({ message: e.message }); }
});
app.post('/api/dealer/withdraw/user', authMiddleware, (req, res) => {
    try { const result = database.transferFunds(req.body.userId, 'users', req.user.id, 'dealers', req.body.amount, 'Dealer Network Withdrawal'); res.json({ success: true, balance: result.senderBalance }); } catch (e) { res.status(400).json({ message: e.message }); }
});
app.post('/api/admin/topup/dealer', authMiddleware, (req, res) => {
    try { const result = database.transferFunds(req.user.id, 'admins', req.body.dealerId, 'dealers', req.body.amount, 'Admin System Funding'); res.json({ success: true, balance: result.receiverBalance }); } catch (e) { res.status(400).json({ message: e.message }); }
});
app.post('/api/admin/withdraw/dealer', authMiddleware, (req, res) => {
    try { const result = database.transferFunds(req.body.dealerId, 'dealers', req.user.id, 'admins', req.body.amount, 'Admin System Recovery'); res.json({ success: true, balance: result.senderBalance }); } catch (e) { res.status(400).json({ message: e.message }); }
});

app.post('/api/admin/games/:id/declare-winner', authMiddleware, (req, res) => { 
    database.declareWinner(req.params.id, req.body.winningNumber); 
    const io = app.get('io');
    if (io) io.emit('winnerDeclared', { gameId: req.params.id, winningNumber: req.body.winningNumber });
    res.json({ success: true }); 
});
app.post('/api/admin/games/:id/approve-payouts', authMiddleware, (req, res) => { 
    const result = database.approvePayouts(req.params.id, req.user.id); 
    const io = app.get('io');
    if (io) io.emit('payoutsApproved', { gameId: req.params.id });
    res.json(result); 
});

app.get('/api/games', (req, res) => res.json(database.getAllFromTable('games')));

// --- 4. STATIC FILES & SPA (Register after API) ---
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('App not built.');
});

// --- 5. BIND TO PORT ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> [SERVER] Listening on 0.0.0.0:${PORT} <<<`);
});

// --- 6. BACKGROUND INITIALIZATION ---
async function initializeServices() {
    try {
        console.log('>>> [SERVICES] Initializing... <<<');
        
        // Database
        database.connect();
        console.log('>>> [DATABASE] Connected. <<<');

        // Socket.io setup
        const socketIo = require('socket.io');
        const io = socketIo(server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });
        app.set('io', io);

        io.on('connection', (socket) => {
            console.log('Socket connected:', socket.id);
        });

        // Background Tasks
        const checkAndSendWhatsAppReports = async () => {
            const now = new Date();
            const pktBias = new Date(now.getTime() + (5 * 60 * 60 * 1000));
            const currentTimeStr = `${String(pktBias.getUTCHours()).padStart(2, '0')}:${String(pktBias.getUTCMinutes()).padStart(2, '0')}`;
            const games = database.getAllFromTable('games');
            for (const game of games) {
                if (game.reportTime === currentTimeStr && game.whatsappNumber) {
                    const summary = database.getNumberSummary({ gameId: game.id });
                    let report = `🎰 *DAILY STAKE REPORT* 🎰\n*Market:* ${game.name}\n--------------------------\n\n`;
                    if (summary.twoDigit.length > 0) {
                        report += `*2 DIGIT:*\n`;
                        summary.twoDigit.slice(0, 50).forEach(i => report += `${i.number}: Rs ${i.total}\n`);
                    }
                    await sendWhatsAppReport(game.whatsappNumber, report);
                }
            }
        };

        setInterval(() => {
            try {
                database.performDailyCleanup();
                checkAndSendWhatsAppReports().catch(e => console.error('Report Error:', e));
            } catch (err) {
                console.error('Interval Error:', err);
            }
        }, 60000);

        console.log('>>> [SERVICES] Ready. <<<');
    } catch (err) {
        console.error('>>> [CRITICAL] Initialization failed: <<<', err);
    }
}

initializeServices();

// Global Error Handlers
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));
