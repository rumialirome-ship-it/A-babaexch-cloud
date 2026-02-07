
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
        if (adminCheck.count === 0) {
            // Default Admin if db.json fails
            db.prepare('INSERT INTO admins (id, name, password, wallet, prizeRates) VALUES (?, ?, ?, ?, ?)').run('Guru', 'Guru', 'Pak@4646', 1000000, JSON.stringify({ oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 }));
        }
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const findAccountById = (id, table, ledgerLimit = 20) => {
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE LOWER(id) = LOWER(?)`);
    const account = stmt.get(id);
    if (!account) return null;
    if (table !== 'games') {
        account.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(id, ledgerLimit).reverse();
    } else {
        account.isMarketOpen = isGameOpen(account.drawTime);
    }
    if (['users', 'dealers', 'admins'].includes(table)) {
        if (account.prizeRates) account.prizeRates = JSON.parse(account.prizeRates);
        if (account.betLimits) account.betLimits = JSON.parse(account.betLimits);
        account.isRestricted = !!account.isRestricted;
    }
    return account;
};

const addLedgerEntry = (accountId, type, desc, debit, credit, newBalance) => {
    db.prepare(`INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), accountId, type, new Date().toISOString(), desc, debit, credit, newBalance
    );
};

const placeBet = (userId, gameId, betGroups) => {
    return db.transaction(() => {
        const user = findAccountById(userId, 'users');
        if (!user) throw new Error("User not found");
        if (user.isRestricted) throw new Error("Account restricted");

        const game = findAccountById(gameId, 'games');
        if (!game) throw new Error("Game not found");
        if (!isGameOpen(game.drawTime)) throw new Error("Market closed");

        let totalStake = 0;
        betGroups.forEach(g => {
            totalStake += g.numbers.length * g.amountPerNumber;
        });

        if (user.wallet < totalStake) throw new Error("Insufficient balance");

        const newBalance = user.wallet - totalStake;
        db.prepare('UPDATE users SET wallet = ? WHERE id = ?').run(newBalance, userId);

        betGroups.forEach(group => {
            db.prepare(`INSERT INTO bets (id, userId, dealerId, gameId, subGameType, numbers, amountPerNumber, totalAmount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                uuidv4(), userId, user.dealerId, gameId, group.subGameType, JSON.stringify(group.numbers), group.amountPerNumber, group.numbers.length * group.amountPerNumber, new Date().toISOString()
            );
        });

        addLedgerEntry(userId, 'USER', `Bet placed on ${game.name}`, totalStake, 0, newBalance);
        return { success: true, newBalance };
    })();
};

const updateWallet = (id, table, amount, type) => {
    return db.transaction(() => {
        const account = findAccountById(id, table);
        if (!account) throw new Error("Account not found");
        const newBalance = type === 'credit' ? account.wallet + amount : account.wallet - amount;
        if (newBalance < 0) throw new Error("Insufficient funds");
        db.prepare(`UPDATE ${table} SET wallet = ? WHERE id = ?`).run(newBalance, id);
        addLedgerEntry(id, table.slice(0, -1).toUpperCase(), type === 'credit' ? 'Wallet Top-up' : 'Wallet Withdrawal', type === 'debit' ? amount : 0, type === 'credit' ? amount : 0, newBalance);
        return newBalance;
    })();
};

module.exports = {
    connect, findAccountById, placeBet, updateWallet, addLedgerEntry,
    findAccountForLogin: (loginId) => {
        const tables = [{ n: 'users', r: 'USER' }, { n: 'dealers', r: 'DEALER' }, { n: 'admins', r: 'ADMIN' }];
        for (const t of tables) {
            const acc = db.prepare(`SELECT * FROM ${t.n} WHERE LOWER(id) = LOWER(?)`).get(loginId);
            if (acc) return { account: acc, role: t.r };
        }
        return { account: null, role: null };
    },
    getAllFromTable: (table) => {
        return db.prepare(`SELECT * FROM ${table}`).all().map(a => {
            if (a.prizeRates) a.prizeRates = JSON.parse(a.prizeRates);
            if (a.betLimits) a.betLimits = JSON.parse(a.betLimits);
            if (a.numbers) a.numbers = JSON.parse(a.numbers);
            if (table === 'games') a.isMarketOpen = isGameOpen(a.drawTime);
            return a;
        });
    },
    findUsersByDealerId: (id) => db.prepare('SELECT id FROM users WHERE LOWER(dealerId) = LOWER(?)').all(id).map(u => findAccountById(u.id, 'users')),
    findBetsByUserId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(userId) = LOWER(?)').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers) })),
    findBetsByDealerId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(dealerId) = LOWER(?)').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers) })),
    createUser: (u) => {
        db.prepare('INSERT INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            u.id, u.name, u.password, u.dealerId, u.area, u.contact, u.wallet, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits)
        );
        addLedgerEntry(u.id, 'USER', 'Initial Deposit', 0, u.wallet, u.wallet);
    },
    declareWinner: (gameId, num) => {
        db.prepare('UPDATE games SET winningNumber = ? WHERE id = ?').run(num, gameId);
    },
    approvePayouts: (gameId) => {
        db.transaction(() => {
            db.prepare('UPDATE games SET payoutsApproved = 1 WHERE id = ?').run(gameId);
            // In a real app, logic for adding winnings to user wallets goes here
        })();
    },
    toggleRestriction: (id, table) => {
        const acc = db.prepare(`SELECT isRestricted FROM ${table} WHERE id = ?`).get(id);
        db.prepare(`UPDATE ${table} SET isRestricted = ? WHERE id = ?`).run(acc.isRestricted ? 0 : 1, id);
    }
};
