
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const path = require('path');
const authMiddleware = require('./authMiddleware');
const database = require('./database');

const app = express();

// Speed up data transfer
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'ababa-secure-cloud-9988-secret';

// Auth
app.post('/api/auth/login', (req, res) => {
    try {
        const { loginId, password } = req.body;
        const { account, role } = database.findAccountForLogin(loginId);
        if (account && account.password === password) {
            const fullAccount = database.findAccountById(account.id, role.toLowerCase() + 's', 20);
            const token = jwt.sign({ id: account.id, role }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token, role, account: fullAccount });
        }
        res.status(401).json({ message: 'Invalid Credentials' });
    } catch (e) {
        res.status(500).json({ message: 'Internal Server Error during login' });
    }
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
    try {
        const role = req.user.role;
        const account = database.findAccountById(req.user.id, role.toLowerCase() + 's', 50);
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
    } catch (e) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// User Betting
app.post('/api/user/bets', authMiddleware, (req, res) => {
    try {
        const result = database.placeBet(req.user.id, req.body.gameId, req.body.betGroups);
        res.json(result);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

// Dealer Actions
app.post('/api/dealer/users', authMiddleware, (req, res) => {
    try {
        const { userData, initialDeposit } = req.body;
        userData.dealerId = req.user.id;
        userData.wallet = initialDeposit;
        database.createUser(userData);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.post('/api/dealer/topup/user', authMiddleware, (req, res) => {
    try {
        database.updateWallet(req.body.userId, 'users', req.body.amount, 'credit');
        res.json({ success: true });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.put('/api/dealer/users/:id/toggle-restriction', authMiddleware, (req, res) => {
    try {
        database.toggleRestriction(req.params.id, 'users');
        res.json({ success: true });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

// Admin Actions
app.post('/api/admin/games/:id/declare-winner', authMiddleware, (req, res) => {
    try {
        database.declareWinner(req.params.id, req.body.winningNumber);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ message: e.message }); }
});

app.get('/api/games', (req, res) => {
    try {
        res.json(database.getAllFromTable('games'));
    } catch (e) {
        res.status(500).json([]);
    }
});

// Catch-all Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something went wrong!' });
});

// Frontend
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath, { maxAge: '1h' })); 
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT || 8080;
database.connect();
app.listen(port, '0.0.0.0', () => console.log(`>>> SERVER STABILIZED ON ${port} <<<`));
