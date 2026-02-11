
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const JSON_DB_PATH = path.join(__dirname, 'db.json');
let db;

function isGameOpen(drawTime) {
    if (!drawTime || typeof drawTime !== 'string') return false;
    const now = new Date();
    const pktBias = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const timeParts = drawTime.split(':').map(Number);
    if (timeParts.length !== 2) return false;
    const [drawH, drawM] = timeParts;
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
        db.pragma('synchronous = NORMAL');
        db.pragma('foreign_keys = ON');
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, name TEXT, password TEXT, wallet REAL, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS dealers (id TEXT PRIMARY KEY, name TEXT, password TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, password TEXT, dealerId TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, betLimits TEXT, avatarUrl TEXT, FOREIGN KEY (dealerId) REFERENCES dealers(id));
            CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT, drawTime TEXT, winningNumber TEXT, payoutsApproved INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, userId TEXT, dealerId TEXT, gameId TEXT, subGameType TEXT, numbers TEXT, amountPerNumber REAL, totalAmount REAL, timestamp TEXT, FOREIGN KEY (userId) REFERENCES users(id), FOREIGN KEY (dealerId) REFERENCES dealers(id), FOREIGN KEY (gameId) REFERENCES games(id));
            CREATE TABLE IF NOT EXISTS ledgers (id TEXT PRIMARY KEY, accountId TEXT, accountType TEXT, timestamp TEXT, description TEXT, debit REAL, credit REAL, balance REAL);
            CREATE TABLE IF NOT EXISTS daily_resets (reset_date TEXT PRIMARY KEY);
            
            CREATE INDEX IF NOT EXISTS idx_ledgers_accountId ON ledgers(accountId);
            CREATE INDEX IF NOT EXISTS idx_bets_userId ON bets(userId);
            CREATE INDEX IF NOT EXISTS idx_users_dealerId ON users(dealerId);
        `);

        // Seed data ONLY if the database has 0 games (brand new deployment)
        const gameCount = db.prepare("SELECT count(*) as count FROM games").get();
        if (gameCount.count === 0 && fs.existsSync(JSON_DB_PATH)) {
            console.log(">>> SYSTEM: DATABASE EMPTY. IMPORTING INITIAL SEED <<<");
            const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
            db.transaction(() => {
                if (data.admin) {
                    db.prepare('INSERT OR IGNORE INTO admins (id, name, password, wallet, prizeRates, avatarUrl) VALUES (?, ?, ?, ?, ?, ?)').run(
                        data.admin.id, data.admin.name, data.admin.password, data.admin.wallet, JSON.stringify(data.admin.prizeRates), data.admin.avatarUrl
                    );
                    data.admin.ledger?.forEach(l => {
                        db.prepare(`INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                            uuidv4(), data.admin.id, 'ADMIN', l.timestamp, l.description, l.debit, l.credit, l.balance
                        );
                    });
                }
                if (data.games) {
                    const insertGame = db.prepare('INSERT INTO games (id, name, drawTime) VALUES (?, ?, ?)');
                    data.games.forEach(g => insertGame.run(g.id, g.name, g.drawTime));
                }
                if (data.dealers) {
                    data.dealers.forEach(d => {
                         db.prepare('INSERT OR IGNORE INTO dealers (id, name, password, area, contact, wallet, commissionRate, prizeRates, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                            d.id, d.name, d.password, d.area, d.contact, d.wallet, d.commissionRate, JSON.stringify(d.prizeRates), d.avatarUrl
                        );
                    });
                }
                if (data.users) {
                    data.users.forEach(u => {
                        db.prepare('INSERT OR IGNORE INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                            u.id, u.name, u.password, u.dealerId, u.area, u.contact, u.wallet, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits), u.avatarUrl
                        );
                    });
                }
            })();
        }
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const safeJsonParse = (str) => {
    if (typeof str !== 'string' || !str) return str;
    try { return JSON.parse(str); } catch (e) { return str; }
};

const findAccountById = (id, table, ledgerLimit = 100) => {
    if (!id) return null;
    const account = db.prepare(`SELECT * FROM ${table} WHERE LOWER(id) = LOWER(?)`).get(id);
    if (!account) return null;
    
    account.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(id, ledgerLimit).map(l => ({
        ...l, 
        timestamp: new Date(l.timestamp)
    }));
    
    if (table === 'games') {
        account.isMarketOpen = isGameOpen(account.drawTime);
    }
    if (account.prizeRates) account.prizeRates = safeJsonParse(account.prizeRates);
    if (account.betLimits) account.betLimits = safeJsonParse(account.betLimits);
    if (account.isRestricted !== undefined) account.isRestricted = !!account.isRestricted;
    return account;
};

const addLedgerEntry = (accountId, type, desc, debit, credit, newBalance) => {
    db.prepare(`INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), accountId, type, new Date().toISOString(), desc, debit, credit, newBalance
    );
};

const calculatePayout = (bet, winningNumber, gameName, prizeRates) => {
    let winningCount = 0;
    const nums = JSON.parse(bet.numbers);
    nums.forEach(num => {
        if (bet.subGameType === '1 Digit Open' && winningNumber.length === 2 && num === winningNumber[0]) winningCount++;
        else if (bet.subGameType === '1 Digit Close') {
            if (gameName === 'AKC' && num === winningNumber) winningCount++;
            else if (winningNumber.length === 2 && num === winningNumber[1]) winningCount++;
        }
        else if (num === winningNumber) winningCount++;
    });
    if (winningCount === 0) return 0;
    const rates = safeJsonParse(prizeRates);
    const rate = bet.subGameType === '1 Digit Open' ? rates.oneDigitOpen : (bet.subGameType === '1 Digit Close' ? rates.oneDigitClose : rates.twoDigit);
    return winningCount * bet.amountPerNumber * rate;
};

const performDailyCleanup = () => {
    const now = new Date();
    // 4:00 PM PKT is UTC 11:00 AM
    if (now.getUTCHours() === 11 && now.getUTCMinutes() === 0) {
        const todayStr = now.toISOString().split('T')[0];
        const alreadyDone = db.prepare('SELECT 1 FROM daily_resets WHERE reset_date = ?').get(todayStr);
        
        if (!alreadyDone) {
            db.transaction(() => {
                db.prepare('DELETE FROM bets').run();
                db.prepare('UPDATE games SET winningNumber = NULL, payoutsApproved = 0').run();
                db.prepare('INSERT INTO daily_resets (reset_date) VALUES (?)').run(todayStr);
            })();
            console.log(`>>> CLEANUP: DAILY RESET EXECUTED FOR ${todayStr} <<<`);
        }
    }
};

module.exports = {
    connect, findAccountById, addLedgerEntry, performDailyCleanup,
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
            if (a.prizeRates) a.prizeRates = safeJsonParse(a.prizeRates);
            if (a.betLimits) a.betLimits = safeJsonParse(a.betLimits);
            if (a.numbers) a.numbers = safeJsonParse(a.numbers);
            if (table === 'games') a.isMarketOpen = isGameOpen(a.drawTime);
            a.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT 50').all(a.id).map(l => ({...l, timestamp: new Date(l.timestamp)}));
            return a;
        });
    },
    searchBets: (query, gameId, userId) => {
        let sql = "SELECT * FROM bets WHERE 1=1";
        const params = [];
        if (query) { sql += " AND (numbers LIKE ? OR userId LIKE ?)"; params.push(`%"${query}"%`, `%${query}%`); }
        if (gameId) { sql += " AND gameId = ?"; params.push(gameId); }
        if (userId) { sql += " AND userId = ?"; params.push(userId); }
        sql += " ORDER BY timestamp DESC LIMIT 500";
        return db.prepare(sql).all(...params).map(b => ({ ...b, numbers: JSON.parse(b.numbers), timestamp: new Date(b.timestamp) }));
    },
    placeBet: (userId, betData) => {
        return db.transaction(() => {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user || user.isRestricted) throw new Error("Unauthorized or Restricted");
            const dealer = db.prepare('SELECT * FROM dealers WHERE id = ?').get(user.dealerId);
            const admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
            let totalStake = 0;
            const gamesToBet = [];

            if (betData.isMultiGame && betData.multiGameBets) {
                for (const gId in betData.multiGameBets) {
                    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gId);
                    if (!game || !isGameOpen(game.drawTime)) continue;
                    const groups = betData.multiGameBets[gId].betGroups;
                    totalStake += groups.reduce((s, g) => s + g.numbers.length * g.amountPerNumber, 0);
                    gamesToBet.push({ gId, groups, name: game.name });
                }
            } else {
                const game = db.prepare('SELECT * FROM games WHERE id = ?').get(betData.gameId);
                if (!game || !isGameOpen(game.drawTime)) throw new Error("Market Closed");
                const betGroups = betData.betGroups || [];
                totalStake = betGroups.reduce((s, g) => s + g.numbers.length * g.amountPerNumber, 0);
                gamesToBet.push({ gId: betData.gameId, groups: betGroups, name: game.name });
            }

            if (totalStake <= 0) throw new Error("No valid bets.");
            if (user.wallet < totalStake) throw new Error("Insufficient Balance");

            const userComm = totalStake * (user.commissionRate / 100);
            const dealerComm = totalStake * (dealer.commissionRate / 100);
            const houseShare = totalStake - userComm - dealerComm;

            const newUserBalance = user.wallet - totalStake + userComm;
            db.prepare('UPDATE users SET wallet = ? WHERE id = ?').run(newUserBalance, userId);
            db.prepare('UPDATE dealers SET wallet = ? WHERE id = ?').run(dealer.wallet + dealerComm, dealer.id);
            db.prepare('UPDATE admins SET wallet = ? WHERE id = ?').run(admin.wallet + houseShare, admin.id);

            gamesToBet.forEach(task => {
                task.groups.forEach(g => {
                    db.prepare(`INSERT INTO bets (id, userId, dealerId, gameId, subGameType, numbers, amountPerNumber, totalAmount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                        uuidv4(), userId, dealer.id, task.gId, g.subGameType, JSON.stringify(g.numbers), g.amountPerNumber, g.numbers.length * g.amountPerNumber, new Date().toISOString()
                    );
                });
            });

            addLedgerEntry(userId, 'USER', `Bet Placed - Cashback Applied`, totalStake, userComm, newUserBalance);
            return { success: true, newBalance: newUserBalance };
        })();
    },
    updateWallet: (targetId, targetTable, amount, type, callerId = null) => {
        return db.transaction(() => {
            const recipient = findAccountById(targetId, targetTable, 0);
            const newRecipientBalance = type === 'credit' ? recipient.wallet + amount : recipient.wallet - amount;
            if (newRecipientBalance < 0) throw new Error("Insufficient funds");
            db.prepare(`UPDATE ${targetTable} SET wallet = ? WHERE id = ?`).run(newRecipientBalance, targetId);
            addLedgerEntry(targetId, targetTable.slice(0, -1).toUpperCase(), `Adjustment via ${callerId || 'System'}`, type === 'debit' ? amount : 0, type === 'credit' ? amount : 0, newRecipientBalance);
            
            if (callerId) {
                const sourceTable = targetTable === 'dealers' ? 'admins' : 'dealers';
                const source = findAccountById(callerId, sourceTable, 0);
                const newSourceBalance = type === 'credit' ? source.wallet - amount : source.wallet + amount;
                db.prepare(`UPDATE ${sourceTable} SET wallet = ? WHERE id = ?`).run(newSourceBalance, callerId);
                addLedgerEntry(callerId, sourceTable.slice(0, -1).toUpperCase(), `Wallet transfer to ${targetId}`, type === 'credit' ? amount : 0, type === 'debit' ? amount : 0, newSourceBalance);
            }
            return newRecipientBalance;
        })();
    },
    getFinancialSummary: () => {
        const games = db.prepare('SELECT * FROM games').all();
        const bets = db.prepare('SELECT * FROM bets').all();
        const users = db.prepare('SELECT * FROM users').all();
        const dealers = db.prepare('SELECT * FROM dealers').all();
        const summaries = games.map(g => {
            const gameBets = bets.filter(b => b.gameId === g.id);
            let totalStake = 0, totalPayouts = 0, totalDealerProfit = 0, totalCommissions = 0;
            gameBets.forEach(b => {
                const user = users.find(u => u.id === b.userId);
                const dealer = dealers.find(d => d.id === b.dealerId);
                if (!user || !dealer) return;
                totalStake += b.totalAmount;
                totalCommissions += b.totalAmount * (user.commissionRate / 100);
                totalDealerProfit += b.totalAmount * (dealer.commissionRate / 100);
                if (g.winningNumber && !g.winningNumber.endsWith('_')) totalPayouts += calculatePayout(b, g.winningNumber, g.name, user.prizeRates);
            });
            return { gameName: g.name, winningNumber: g.winningNumber || 'Pending', totalStake, totalPayouts, totalDealerProfit, totalCommissions, netProfit: totalStake - totalPayouts - totalDealerProfit - totalCommissions };
        });
        return { games: summaries, totals: summaries.reduce((acc, s) => ({
            totalStake: acc.totalStake + s.totalStake,
            totalPayouts: acc.totalPayouts + s.totalPayouts,
            totalDealerProfit: acc.totalDealerProfit + s.totalDealerProfit,
            totalCommissions: acc.totalCommissions + s.totalCommissions,
            netProfit: acc.netProfit + s.netProfit
        }), { totalStake: 0, totalPayouts: 0, totalDealerProfit: 0, totalCommissions: 0, netProfit: 0 }) };
    },
    getNumberSummary: (gameId, date) => {
        let sql = "SELECT subGameType, numbers, amountPerNumber, totalAmount, gameId FROM bets WHERE 1=1";
        const params = [];
        if (gameId) { sql += " AND gameId = ?"; params.push(gameId); }
        if (date) { sql += " AND timestamp LIKE ?"; params.push(`${date}%`); }
        const bets = db.prepare(sql).all(...params);
        const map = { '2 Digit': {}, '1 Digit Open': {}, '1 Digit Close': {} };
        bets.forEach(b => {
            const nums = JSON.parse(b.numbers);
            let targetType = (b.subGameType === 'Bulk Game' || b.subGameType === 'Combo Game') ? '2 Digit' : b.subGameType;
            if (map[targetType]) nums.forEach(n => { map[targetType][n] = (map[targetType][n] || 0) + b.amountPerNumber; });
        });
        const transform = (m) => Object.entries(m).map(([number, stake]) => ({ number, stake })).sort((a,b) => b.stake - a.stake);
        return { twoDigit: transform(map['2 Digit']), oneDigitOpen: transform(map['1 Digit Open']), oneDigitClose: transform(map['1 Digit Close']) };
    },
    findUsersByDealerId: (id) => db.prepare('SELECT id FROM users WHERE LOWER(dealerId) = LOWER(?)').all(id).map(u => findAccountById(u.id, 'users')),
    findBetsByUserId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(userId) = LOWER(?) ORDER BY timestamp DESC').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers), timestamp: new Date(b.timestamp) })),
    findBetsByDealerId: (id) => db.prepare('SELECT * FROM bets WHERE LOWER(dealerId) = LOWER(?) ORDER BY timestamp DESC').all(id).map(b => ({ ...b, numbers: JSON.parse(b.numbers), timestamp: new Date(b.timestamp) })),
    createUser: (u) => {
        db.prepare('INSERT INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            u.id, u.name, u.password, u.dealerId, u.area, u.contact, u.wallet, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits)
        );
        addLedgerEntry(u.id, 'USER', 'Account Created', 0, u.wallet, u.wallet);
    },
    updateUser: (id, u) => {
        const c = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        db.prepare('UPDATE users SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ?, betLimits = ? WHERE id = ?').run(
            u.name || c.name, u.password || c.password, u.area || c.area, u.contact || c.contact, u.commissionRate ?? c.commissionRate, u.prizeRates ? JSON.stringify(u.prizeRates) : c.prizeRates, u.betLimits ? JSON.stringify(u.betLimits) : c.betLimits, id
        );
    },
    updateDealer: (id, d) => {
        const c = db.prepare('SELECT * FROM dealers WHERE id = ?').get(id);
        db.prepare('UPDATE dealers SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ? WHERE id = ?').run(
            d.name || c.name, d.password || c.password, d.area || c.area, d.contact || c.contact, d.commissionRate ?? c.commissionRate, d.prizeRates ? JSON.stringify(d.prizeRates) : c.prizeRates, id
        );
    },
    declareWinner: (gameId, num) => db.prepare('UPDATE games SET winningNumber = ? WHERE id = ?').run(num, gameId),
    approvePayouts: (gameId) => {
        return db.transaction(() => {
            const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
            if (!game || !game.winningNumber || game.payoutsApproved) return { success: false };
            const admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
            const bets = db.prepare('SELECT * FROM bets WHERE gameId = ?').all(gameId);
            let totalPayout = 0;
            bets.forEach(bet => {
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(bet.userId);
                const payout = calculatePayout(bet, game.winningNumber, game.name, user.prizeRates);
                if (payout > 0) {
                    totalPayout += payout;
                    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(payout, user.id);
                    addLedgerEntry(user.id, 'USER', `Win: ${game.name} (${game.winningNumber})`, 0, payout, user.wallet + payout);
                }
            });
            db.prepare('UPDATE admins SET wallet = wallet - ?').run(totalPayout);
            db.prepare('UPDATE games SET payoutsApproved = 1 WHERE id = ?').run(gameId);
            return { success: true };
        })();
    },
    toggleRestriction: (id, table) => {
        const acc = db.prepare(`SELECT isRestricted FROM ${table} WHERE id = ?`).get(id);
        db.prepare(`UPDATE ${table} SET isRestricted = ? WHERE id = ?`).run(acc.isRestricted ? 0 : 1, id);
    },
    deleteUser: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id)
};
