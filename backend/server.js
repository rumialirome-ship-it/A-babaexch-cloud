
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
        const fullAccount = database.findAccountById(account.id, role.toLowerCase() + 's', 20);
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
    if (role === 'DEALER') { extra.users = database.findUsersByDealerId(req.user.id); extra.bets = database.findBetsByDealerId(req.user.id); }
    else if (role === 'USER') { extra.bets = database.findBetsByUserId(req.user.id); }
    else if (role === 'ADMIN') { extra.dealers = database.getAllFromTable('dealers'); extra.users = database.getAllFromTable('users'); extra.bets = database.getAllFromTable('bets'); }
    res.json({ account, role, ...extra });
});

app.get('/api/admin/summary', authMiddleware, (req, res) => res.json(database.getFinancialSummary()));
app.get('/api/admin/number-summary', authMiddleware, (req, res) => res.json(database.getNumberSummary(req.query.gameId, req.query.date)));
app.get('/api/admin/bets/search', authMiddleware, (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
    res.json(database.searchBets(req.query.q, req.query.gameId, req.query.userId));
});

app.post('/api/admin/dealers', authMiddleware, (req, res) => {
    const d = req.body;
    require('better-sqlite3')(path.join(__dirname, 'database.sqlite')).prepare('INSERT INTO dealers (id, name, password, area, contact, wallet, commissionRate, prizeRates) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        d.id, d.name, d.password, d.area, d.contact, d.wallet, d.commissionRate, JSON.stringify(d.prizeRates)
    );
    database.addLedgerEntry(d.id, 'DEALER', 'Initial Allocation', 0, d.wallet, d.wallet);
    res.json({ success: true });
});

app.put('/api/admin/dealers/:id', authMiddleware, (req, res) => {
    database.updateDealer(req.params.id, req.body);
    res.json({ success: true });
});

app.put('/api/admin/users/:id', authMiddleware, (req, res) => {
    database.updateUser(req.params.id, req.body);
    res.json({ success: true });
});

app.post('/api/dealer/users', authMiddleware, (req, res) => {
    database.createUser({ ...req.body.userData, dealerId: req.user.id, wallet: req.body.initialDeposit });
    res.json({ success: true });
});

app.delete('/api/dealer/users/:id', authMiddleware, (req, res) => { database.deleteUser(req.params.id); res.json({ success: true }); });

app.post('/api/user/bets', authMiddleware, (req, res) => res.json(database.placeBet(req.user.id, req.body.gameId, req.body.betGroups)));
app.post('/api/dealer/topup/user', authMiddleware, (req, res) => res.json({ success: true, balance: database.updateWallet(req.body.userId, 'users', req.body.amount, 'credit') }));
app.post('/api/dealer/withdraw/user', authMiddleware, (req, res) => res.json({ success: true, balance: database.updateWallet(req.body.userId, 'users', req.body.amount, 'debit') }));

app.post('/api/admin/topup/dealer', authMiddleware, (req, res) => res.json({ success: true, balance: database.updateWallet(req.body.dealerId, 'dealers', req.body.amount, 'credit', req.user.id) }));
app.post('/api/admin/withdraw/dealer', authMiddleware, (req, res) => res.json({ success: true, balance: database.updateWallet(req.body.dealerId, 'dealers', req.body.amount, 'debit', req.user.id) }));

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
    const result = database.approvePayouts(req.params.id); 
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
app.listen(process.env.PORT || 8080, '0.0.0.0', () => console.log(`>>> SERVER ACTIVE <<<`));
