
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./authMiddleware');
const database = require('./database');
const { sendWhatsAppReport } = require('./whatsappService');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.use((req, res, next) => {
    const host = req.headers.host;
    if (host && host.startsWith('www.')) {
        const newHost = host.replace(/^www\./, '');
        return res.redirect(301, `${req.protocol}://${newHost}${req.originalUrl}`);
    }
    next();
});

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
    
    // Authorization logic
    if (role === 'ADMIN') {
        // Admin can see everything
    } else if (role === 'DEALER') {
        // Dealer can only see their own ledger or their users' ledgers
        if (accountId !== req.user.id) {
            const user = database.findAccountById(accountId, 'users');
            if (!user || user.dealerId.toLowerCase() !== req.user.id.toLowerCase()) {
                return res.status(403).json({ message: 'Access Denied' });
            }
        }
    } else if (role === 'USER') {
        // User can only see their own ledger
        if (accountId !== req.user.id) {
            return res.status(403).json({ message: 'Access Denied' });
        }
    }

    const ledger = database.getLedgerForAccount(accountId, 500); // Fetch more entries for detailed view
    res.json(ledger);
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
    try {
        database.createDealer(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

app.put('/api/admin/dealers/:id', authMiddleware, (req, res) => {
    database.updateDealer(req.params.id, req.body);
    res.json({ success: true });
});

app.put('/api/admin/users/:id', authMiddleware, (req, res) => {
    database.updateUser(req.params.id, req.body);
    res.json({ success: true });
});

app.put('/api/admin/games/:id/draw-time', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    const { newDrawTime } = req.body;
    database.updateGameDrawTime(req.params.id, newDrawTime);
    res.json({ success: true });
});

app.put('/api/admin/games/:id/report-settings', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    const { reportTime, whatsappNumber } = req.body;
    database.updateGameReportSettings(req.params.id, reportTime, whatsappNumber);
    res.json({ success: true });
});

app.post('/api/dealer/users', authMiddleware, (req, res) => {
    // Force initialDeposit to 0 for dealers to ensure they use the top-up feature 
    // which correctly deducts from their own wallet.
    database.createUser({ ...req.body.userData, dealerId: req.user.id, wallet: 0 });
    res.json({ success: true });
});

app.put('/api/dealer/users/:id', authMiddleware, (req, res) => {
    const user = database.findAccountById(req.params.id, 'users');
    if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
        database.updateUser(req.params.id, req.body);
        res.json({ success: true });
    } else {
        res.status(403).json({ message: 'Access Denied' });
    }
});

app.put('/api/dealer/users/:id/toggle-restriction', authMiddleware, (req, res) => {
    const user = database.findAccountById(req.params.id, 'users');
    if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
        database.toggleRestriction(req.params.id, 'users');
        res.json({ success: true });
    } else {
        res.status(403).json({ message: 'Access Denied' });
    }
});

app.delete('/api/dealer/users/:id', authMiddleware, (req, res) => {
    database.deleteUser(req.params.id);
    res.json({ success: true });
});

app.post('/api/user/bets', authMiddleware, (req, res) => {
    try {
        const result = database.placeBet(req.user.id, req.body);
        req.app.get('io').emit('betPlaced', { userId: req.user.id, bet: result });
        res.json(result);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

app.post('/api/dealer/bets/bulk', authMiddleware, (req, res) => {
    try {
        const user = database.findAccountById(req.body.userId, 'users');
        if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
            const result = database.placeBet(req.body.userId, req.body);
            req.app.get('io').emit('betPlaced', { userId: req.body.userId, bet: result });
            res.json(result);
        } else {
            res.status(403).json({ message: 'Unauthorized terminal access' });
        }
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Dealer TOPUP User: Debit Dealer, Credit User
app.post('/api/dealer/topup/user', authMiddleware, (req, res) => {
    try {
        const result = database.transferFunds(req.user.id, 'dealers', req.body.userId, 'users', req.body.amount, 'Dealer Network Top-up');
        res.json({ success: true, balance: result.receiverBalance });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Dealer WITHDRAW from User: Debit User, Credit Dealer
app.post('/api/dealer/withdraw/user', authMiddleware, (req, res) => {
    try {
        const result = database.transferFunds(req.body.userId, 'users', req.user.id, 'dealers', req.body.amount, 'Dealer Network Withdrawal');
        res.json({ success: true, balance: result.senderBalance });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Admin TOPUP Dealer: Debit Admin, Credit Dealer
app.post('/api/admin/topup/dealer', authMiddleware, (req, res) => {
    try {
        const result = database.transferFunds(req.user.id, 'admins', req.body.dealerId, 'dealers', req.body.amount, 'Admin System Funding');
        res.json({ success: true, balance: result.receiverBalance });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Admin WITHDRAW from Dealer: Debit Dealer, Credit Admin
app.post('/api/admin/withdraw/dealer', authMiddleware, (req, res) => {
    try {
        const result = database.transferFunds(req.body.dealerId, 'dealers', req.user.id, 'admins', req.body.amount, 'Admin System Recovery');
        res.json({ success: true, balance: result.senderBalance });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

app.put('/api/admin/accounts/:type/:id/toggle-restriction', authMiddleware, (req, res) => {
    database.toggleRestriction(req.params.id, req.params.type === 'user' ? 'users' : 'dealers');
    res.json({ success: true });
});

app.post('/api/admin/games/:id/declare-winner', authMiddleware, (req, res) => { 
    database.declareWinner(req.params.id, req.body.winningNumber); 
    req.app.get('io').emit('winnerDeclared', { gameId: req.params.id, winningNumber: req.body.winningNumber });
    res.json({ success: true }); 
});
app.put('/api/admin/games/:id/update-winner', authMiddleware, (req, res) => { 
    database.declareWinner(req.params.id, req.body.newWinningNumber); 
    req.app.get('io').emit('winnerDeclared', { gameId: req.params.id, winningNumber: req.body.newWinningNumber });
    res.json({ success: true }); 
});
app.post('/api/admin/games/:id/approve-payouts', authMiddleware, (req, res) => { 
    const result = database.approvePayouts(req.params.id, req.user.id); 
    req.app.get('io').emit('payoutsApproved', { gameId: req.params.id });
    res.json(result); 
});

app.get('/api/games', (req, res) => res.json(database.getAllFromTable('games')));

app.post('/api/user/ai-lucky-pick', authMiddleware, (req, res) => {
    const count = req.body.count || 5;
    const picks = Array.from({ length: count }, () => Math.floor(Math.random() * 100).toString().padStart(2, '0')).join(',');
    res.json({ luckyNumbers: picks });
});

const distPath = path.join(__dirname, '../dist');

const checkAndSendWhatsAppReports = async () => {
    const now = new Date();
    // Pakistan Time (PKT) is UTC+5
    const pktBias = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const currentH = pktBias.getUTCHours();
    const currentM = pktBias.getUTCMinutes();
    const currentTimeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;

    const games = database.getAllFromTable('games');
    for (const game of games) {
        if (game.reportTime === currentTimeStr && game.whatsappNumber) {
            console.log(`>>> TRIGGERING AUTO REPORT FOR ${game.name} at ${currentTimeStr} <<<`);
            
            // Generate Report Content
            const summary = database.getNumberSummary({ gameId: game.id });
            
            let report = `🎰 *DAILY STAKE REPORT* 🎰\n`;
            report += `*Market:* ${game.name}\n`;
            report += `*Time:* ${new Date().toLocaleString()}\n`;
            report += `--------------------------\n\n`;

            if (summary.twoDigit.length > 0) {
                report += `*2 DIGIT STAKES:*\n`;
                summary.twoDigit.slice(0, 50).forEach(item => {
                    report += `${item.number}: Rs ${item.total.toLocaleString()}\n`;
                });
                report += `\n`;
            }

            if (summary.oneDigitOpen.length > 0) {
                report += `*1 DIGIT OPEN:*\n`;
                summary.oneDigitOpen.forEach(item => {
                    report += `${item.number}: Rs ${item.total.toLocaleString()}\n`;
                });
                report += `\n`;
            }

            if (summary.oneDigitClose.length > 0) {
                report += `*1 DIGIT CLOSE:*\n`;
                summary.oneDigitClose.forEach(item => {
                    report += `${item.number}: Rs ${item.total.toLocaleString()}\n`;
                });
            }

            report += `\n--------------------------\n`;
            report += `_Generated by A-Baba Exchange_`;

            // Send via Service
            await sendWhatsAppReport(game.whatsappNumber, report);
        }
    }
};

async function startServer() {
    try {
        console.log('>>> INITIALIZING DATABASE... <<<');
        database.connect();
        console.log('>>> DATABASE CONNECTED <<<');

        const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

        if (!isProduction) {
            try {
                console.log('>>> STARTING VITE IN DEVELOPMENT MODE... <<<');
                const { createServer: createViteServer } = require('vite');
                const vite = await createViteServer({
                    server: { middlewareMode: true },
                    appType: 'spa',
                });
                app.use(vite.middlewares);
                console.log('>>> VITE MIDDLEWARE READY <<<');
            } catch (viteError) {
                console.error('>>> FAILED TO LOAD VITE, FALLING BACK TO STATIC SERVING <<<', viteError);
                app.use(express.static(distPath));
            }
        } else {
            console.log('>>> SERVING STATIC FILES IN PRODUCTION MODE... <<<');
            app.use(express.static(distPath));
        }

        // Catch-all route for SPA
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) return next();
            
            // In production, always serve index.html
            // In dev, if Vite is loaded it handles it, otherwise we fallback
            if (isProduction || !app.get('viteLoaded')) {
                const indexPath = path.join(distPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    res.status(404).send('Application not built. Please run npm run build.');
                }
            } else {
                next();
            }
        });

        const port = process.env.PORT || 3000;
        server.listen(port, '0.0.0.0', () => {
            console.log(`>>> SERVER ACTIVE ON PORT ${port} <<<`);
        });

        setInterval(() => {
            try {
                database.performDailyCleanup();
                checkAndSendWhatsAppReports();
            } catch (intervalError) {
                console.error('>>> ERROR IN BACKGROUND TASKS <<<', intervalError);
            }
        }, 60000);

    } catch (startError) {
        console.error('>>> FATAL SERVER START ERROR <<<', startError);
        // Don't exit immediately, let the platform see the error in logs
        setTimeout(() => process.exit(1), 5000);
    }
}

startServer();
