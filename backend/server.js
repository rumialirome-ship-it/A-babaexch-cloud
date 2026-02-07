
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const authMiddleware = require('./authMiddleware');
const { GoogleGenAI } = require('@google/genai');
const database = require('./database');

// --- GLOBAL ERROR LOGGING ---
process.on('uncaughtException', (err) => {
    console.error('FATAL: Uncaught Exception:', err.stack || err);
    process.exit(1);
});

const app = express();
app.use(cors());
app.use(express.json());

// --- AUTOMATIC GAME RESET ---
const PKT_OFFSET_HOURS = 5;
const RESET_HOUR_PKT = 16; 

function scheduleNextGameReset() {
    const now = new Date();
    const resetHourUTC = RESET_HOUR_PKT - PKT_OFFSET_HOURS;
    let resetTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHourUTC, 0, 5, 0));
    if (now >= resetTime) {
        resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    }
    const delay = resetTime.getTime() - now.getTime();
    setTimeout(() => {
        try { database.resetAllGames(); } catch (e) { console.error('Reset error:', e); }
        scheduleNextGameReset();
    }, delay);
}

const JWT_SECRET = process.env.JWT_SECRET || 'ababa-secure-cloud-9988-secret';

// --- API ROUTES ---
app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    const { account, role } = database.findAccountForLogin(loginId);
    if (account && account.password === password) {
        const fullAccount = database.findAccountById(account.id, role.toLowerCase() + 's');
        const token = jwt.sign({ id: account.id, role }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token, role, account: fullAccount });
    }
    res.status(401).json({ message: 'Invalid Account ID or Password.' });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
    const role = req.user.role;
    const table = role.toLowerCase() + 's';
    const account = database.findAccountById(req.user.id, table);
    if (!account) return res.status(404).json({ message: 'Account not found.' });
    
    let extra = {};
    if (role === 'DEALER') {
        extra.users = database.findUsersByDealerId(req.user.id);
        extra.bets = database.findBetsByDealerId(req.user.id);
    } else if (role === 'USER') {
        extra.bets = database.findBetsByUserId(req.user.id);
    } else if (role === 'ADMIN') {
        extra.dealers = database.getAllFromTable('dealers', true);
        extra.users = database.getAllFromTable('users', true);
        extra.bets = database.getAllFromTable('bets');
    }
    res.json({ account, role, ...extra });
});

// System time endpoint to help mobile devices with incorrect internal clocks
app.get('/api/system/time', (req, res) => {
    res.json({ 
        serverTime: new Date().toISOString(),
        pktOffset: PKT_OFFSET_HOURS 
    });
});

app.post('/api/user/ai-lucky-pick', authMiddleware, async (req, res) => {
    const { gameType, count = 5 } = req.body;
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!API_KEY) return res.status(503).json({ message: "AI services unavailable." });

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const prompt = `Generate ${count} unique lucky numbers for a "${gameType}" game. Return ONLY numbers separated by commas.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: prompt }] }]
        });
        res.json({ luckyNumbers: response.text.replace(/\s+/g, '') });
    } catch (error) {
        res.status(500).json({ message: "AI Oracle is offline." });
    }
});

app.get('/api/games', (req, res) => res.json(database.getAllFromTable('games')));

// Serve Frontend
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for SPA routing - Fixes "Not Found" on mobile refresh
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT || 8080;
database.connect();
scheduleNextGameReset();
app.listen(port, '0.0.0.0', () => console.log(`>>> A-BABA SERVER RUNNING ON PORT ${port} <<<`));
