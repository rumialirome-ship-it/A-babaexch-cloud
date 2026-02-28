
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const path = require('path');
const authMiddleware = require('./authMiddleware');
const database = require('./database');

const app = express();

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
        res.json(database.placeBet(req.user.id, req.body));
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

app.post('/api/dealer/bets/bulk', authMiddleware, (req, res) => {
    try {
        const user = database.findAccountById(req.body.userId, 'users');
        if (user && user.dealerId.toLowerCase() === req.user.id.toLowerCase()) {
            res.json(database.placeBet(req.body.userId, req.body));
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

app.post('/api/admin/games/:id/declare-winner', authMiddleware, (req, res) => { database.declareWinner(req.params.id, req.body.winningNumber); res.json({ success: true }); });
app.put('/api/admin/games/:id/update-winner', authMiddleware, (req, res) => { 
    database.declareWinner(req.params.id, req.body.newWinningNumber); 
    res.json({ success: true }); 
});
app.post('/api/admin/games/:id/approve-payouts', authMiddleware, (req, res) => { 
    const result = database.approvePayouts(req.params.id, req.user.id); 
    res.json(result); 
});

app.get('/api/games', (req, res) => res.json(database.getAllFromTable('games')));

app.post('/api/user/ai-lucky-pick', authMiddleware, (req, res) => {
    const count = req.body.count || 5;
    const picks = Array.from({ length: count }, () => Math.floor(Math.random() * 100).toString().padStart(2, '0')).join(',');
    res.json({ luckyNumbers: picks });
});

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

database.connect();

setInterval(() => {
    database.performDailyCleanup();
}, 60000);

app.listen(process.env.PORT || 8080, '0.0.0.0', () => console.log(`>>> SERVER ACTIVE <<<`));
