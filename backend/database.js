const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const JSON_DB_PATH = path.join(__dirname, 'db.json');
let db;

function isGameOpen(drawTime) {
    const now = new Date();
    const pktBias = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const [drawH, drawM] = drawTime.split(':').map(Number);
    const pktH = pktBias.getUTCHours();
    const currentCycleStart = new Date(pktBias);
    currentCycleStart.setUTCHours(16, 0, 0, 0);
    if (pktH < 16) currentCycleStart.setUTCDate(currentCycleStart.getUTCDate() - 1);
    const currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setUTCHours(drawH, drawM, 0, 0);
    if (drawH < 16) currentCycleEnd.setUTCDate(currentCycleEnd.getUTCDate() + 1);
    return pktBias >= currentCycleStart && pktBias < currentCycleEnd;
}

const initializeDefaultData = () => {
    if (!fs.existsSync(JSON_DB_PATH)) return;
    console.log('Initializing default data from db.json...');
    const jsonData = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
    
    db.transaction(() => {
        const admin = jsonData.admin;
        db.prepare('INSERT INTO admins (id, name, password, wallet, prizeRates, avatarUrl) VALUES (?, ?, ?, ?, ?, ?)').run(admin.id, admin.name, admin.password, admin.wallet, JSON.stringify(admin.prizeRates), admin.avatarUrl);
        jsonData.dealers.forEach(dealer => {
            db.prepare('INSERT INTO dealers (id, name, password, area, contact, wallet, commissionRate, isRestricted, prizeRates, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(dealer.id, dealer.name, dealer.password, dealer.area, dealer.contact, dealer.wallet, dealer.commissionRate, dealer.isRestricted ? 1 : 0, JSON.stringify(dealer.prizeRates), dealer.avatarUrl);
        });
        jsonData.users.forEach(user => {
            db.prepare('INSERT INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, isRestricted, prizeRates, betLimits, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(user.id, user.name, user.password, user.dealerId, user.area, user.contact, user.wallet, user.commissionRate, user.isRestricted ? 1 : 0, JSON.stringify(user.prizeRates), user.betLimits ? JSON.stringify(user.betLimits) : null, user.avatarUrl);
        });
        jsonData.games.forEach(game => {
            db.prepare('INSERT INTO games (id, name, drawTime, winningNumber, payoutsApproved) VALUES (?, ?, ?, ?, ?)').run(game.id, game.name, game.drawTime, game.winningNumber || null, game.payoutsApproved ? 1 : 0);
        });
    })();
};

const connect = () => {
    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.exec(`
            CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, name TEXT, password TEXT, wallet REAL, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS dealers (id TEXT PRIMARY KEY, name TEXT, password TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, password TEXT, dealerId TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, betLimits TEXT, avatarUrl TEXT, FOREIGN KEY (dealerId) REFERENCES dealers(id));
            CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT, drawTime TEXT, winningNumber TEXT, payoutsApproved INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, userId TEXT, dealerId TEXT, gameId TEXT, subGameType TEXT, numbers TEXT, amountPerNumber REAL, totalAmount REAL, timestamp TEXT, FOREIGN KEY (userId) REFERENCES users(id), FOREIGN KEY (dealerId) REFERENCES dealers(id), FOREIGN KEY (gameId) REFERENCES games(id));
            CREATE TABLE IF NOT EXISTS ledgers (id TEXT PRIMARY KEY, accountId TEXT, accountType TEXT, timestamp TEXT, description TEXT, debit REAL, credit REAL, balance REAL);
            CREATE TABLE IF NOT EXISTS number_limits (id INTEGER PRIMARY KEY AUTOINCREMENT, gameType TEXT, numberValue TEXT, limitAmount REAL, UNIQUE(gameType, numberValue));
        `);
        const adminCheck = db.prepare("SELECT count(*) as count FROM admins").get();
        if (adminCheck.count === 0) initializeDefaultData();
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const findAccountById = (id, table, ledgerLimit = 15) => {
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE LOWER(id) = LOWER(?)`);
    const account = stmt.get(id);
    if (!account) return null;
    if (table !== 'games') {
        account.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(id, ledgerLimit).reverse();
    } else {
        account.isMarketOpen = isGameOpen(account.drawTime);
    }
    if (['users', 'dealers', 'admins'].includes(table)) {
        account.commissionRate = Number(account.commissionRate) || 0;
        if (account.prizeRates) account.prizeRates = JSON.parse(account.prizeRates);
        if (account.betLimits) account.betLimits = JSON.parse(account.betLimits);
        account.isRestricted = !!account.isRestricted;
    }
    return account;
};

const findAccountForLogin = (loginId) => {
    const lowerId = loginId.toLowerCase();
    const tables = [{ name: 'users', role: 'USER' }, { name: 'dealers', role: 'DEALER' }, { name: 'admins', role: 'ADMIN' }];
    for (const tableInfo of tables) {
        const account = db.prepare(`SELECT * FROM ${tableInfo.name} WHERE LOWER(id) = ?`).get(lowerId);
        if (account) return { account, role: tableInfo.role };
    }
    return { account: null, role: null };
};

const getAllFromTable = (table, withLedger = false, ledgerLimit = 5) => {
    return db.prepare(`SELECT * FROM ${table}`).all().map(acc => {
        if (['users', 'dealers', 'admins'].includes(table)) {
            acc.commissionRate = Number(acc.commissionRate) || 0;
            if (withLedger) acc.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(acc.id, ledgerLimit).reverse();
            if (acc.prizeRates) acc.prizeRates = JSON.parse(acc.prizeRates);
            if (acc.betLimits) acc.betLimits = JSON.parse(acc.betLimits);
            acc.isRestricted = !!acc.isRestricted;
        }
        if (table === 'games') acc.isMarketOpen = isGameOpen(acc.drawTime);
        if (table === 'bets' && acc.numbers) acc.numbers = JSON.parse(acc.numbers);
        return acc;
    });
};

module.exports = {
    connect, verifySchema: () => {}, findAccountById, findAccountForLogin, 
    getAllFromTable, findUsersByDealerId: (id) => db.prepare('SELECT id FROM users WHERE LOWER(dealerId) = LOWER(?)').all(id).map(u => findAccountById(u.id, 'users')),
    findBetsByUserId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(userId) = LOWER(?) ORDER BY timestamp DESC').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers) })),
    findBetsByDealerId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(dealerId) = LOWER(?)').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers) })),
    resetAllGames: () => { db.transaction(() => { db.prepare('UPDATE games SET winningNumber = NULL, payoutsApproved = 0').run(); db.prepare('DELETE FROM bets').run(); })(); }
};