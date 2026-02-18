
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
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('foreign_keys = ON');
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, name TEXT, password TEXT, wallet REAL, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS dealers (id TEXT PRIMARY KEY, name TEXT, password TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, avatarUrl TEXT);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, password TEXT, dealerId TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, betLimits TEXT, fixedStake REAL DEFAULT 0, avatarUrl TEXT, FOREIGN KEY (dealerId) REFERENCES dealers(id));
            CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT, drawTime TEXT, winningNumber TEXT, payoutsApproved INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, userId TEXT, dealerId TEXT, gameId TEXT, subGameType TEXT, numbers TEXT, amountPerNumber REAL, totalAmount REAL, timestamp TEXT, FOREIGN KEY (userId) REFERENCES users(id), FOREIGN KEY (dealerId) REFERENCES dealers(id), FOREIGN KEY (gameId) REFERENCES games(id));
            CREATE TABLE IF NOT EXISTS ledgers (id TEXT PRIMARY KEY, accountId TEXT, accountType TEXT, timestamp TEXT, description TEXT, debit REAL, credit REAL, balance REAL);
            CREATE TABLE IF NOT EXISTS daily_resets (reset_date TEXT PRIMARY KEY);
        `);

        const tableInfo = db.prepare("PRAGMA table_info(users)").all();
        if (!tableInfo.find(c => c.name === 'fixedStake')) {
            db.exec("ALTER TABLE users ADD COLUMN fixedStake REAL DEFAULT 0");
        }

        const checkCount = db.prepare("SELECT count(*) as count FROM admins").get();
        if (checkCount.count === 0 && fs.existsSync(JSON_DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
            db.transaction(() => {
                if (data.admin) {
                    db.prepare('INSERT OR IGNORE INTO admins (id, name, password, wallet, prizeRates, avatarUrl) VALUES (?, ?, ?, ?, ?, ?)').run(
                        data.admin.id, data.admin.name, data.admin.password, data.admin.wallet, JSON.stringify(data.admin.prizeRates), data.admin.avatarUrl
                    );
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
                        db.prepare('INSERT OR IGNORE INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits, fixedStake, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                            u.id, u.name, u.password, u.dealerId, u.area, u.contact, u.wallet, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits), u.fixedStake || 0, u.avatarUrl
                        );
                    });
                }
            })();
        }
    } catch (error) {
        process.exit(1);
    }
};

const safeJsonParse = (str) => {
    if (typeof str !== 'string' || !str) return str;
    try { return JSON.parse(str); } catch (e) { return str; }
};

const normalizeAccount = (account, table) => {
    if (!account) return null;
    const defaultPrizeRates = { oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 };
    const defaultBetLimits = { oneDigit: 5000, twoDigit: 5000, perDraw: 20000 };

    account.prizeRates = safeJsonParse(account.prizeRates) || defaultPrizeRates;
    if (table === 'users' || table === 'users_table') {
        account.betLimits = safeJsonParse(account.betLimits) || defaultBetLimits;
        account.fixedStake = account.fixedStake || 0;
    }
    if (account.isRestricted !== undefined) account.isRestricted = !!account.isRestricted;
    return account;
};

const findAccountById = (id, table, ledgerLimit = 100) => {
    if (!id) return null;
    const account = db.prepare(`SELECT * FROM ${table} WHERE LOWER(id) = LOWER(?)`).get(id);
    if (!account) return null;
    account.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC, rowid DESC LIMIT ?').all(id, ledgerLimit).map(l => ({...l, timestamp: new Date(l.timestamp)}));
    if (table === 'games') account.isMarketOpen = isGameOpen(account.drawTime);
    return normalizeAccount(account, table);
};

const normNum = (n) => {
    if (n === undefined || n === null || String(n).trim() === '') return '';
    const s = String(n).trim();
    const numVal = parseInt(s, 10);
    return isNaN(numVal) ? s : String(numVal);
};

const calculatePayout = (bet, winningNumber, gameName, prizeRates) => {
    if (!winningNumber || winningNumber.includes('_')) return 0;
    const winStr = String(winningNumber).trim();
    const paddedWin = (gameName !== 'AK' && gameName !== 'AKC' && winStr.length === 1) ? '0' + winStr : winStr;
    let winningCount = 0;
    const nums = typeof bet.numbers === 'string' ? JSON.parse(bet.numbers) : bet.numbers;

    nums.forEach(num => {
        const numNorm = normNum(num);
        const winNorm = normNum(paddedWin);
        if (bet.subGameType === '1 Digit Open') {
            if (paddedWin.length >= 1 && numNorm === normNum(paddedWin[0])) winningCount++;
        } else if (bet.subGameType === '1 Digit Close') {
            if (gameName === 'AKC') {
                if (numNorm === winNorm) winningCount++;
            } else if (paddedWin.length === 2 && numNorm === normNum(paddedWin[1])) winningCount++;
        } else {
            if (numNorm === winNorm) winningCount++;
        }
    });

    if (winningCount === 0) return 0;
    const rates = typeof prizeRates === 'string' ? safeJsonParse(prizeRates) : prizeRates;
    if (!rates) return 0;
    const rate = bet.subGameType === '1 Digit Open' ? (rates.oneDigitOpen || 0) : 
                (bet.subGameType === '1 Digit Close' ? (rates.oneDigitClose || 0) : (rates.twoDigit || 0));
    return winningCount * bet.amountPerNumber * rate;
};

module.exports = {
    connect, findAccountById,
    performDailyCleanup: () => {
        const now = new Date();
        if (now.getUTCHours() === 11 && now.getUTCMinutes() === 0) {
            const todayStr = now.toISOString().split('T')[0];
            const alreadyDone = db.prepare('SELECT 1 FROM daily_resets WHERE reset_date = ?').get(todayStr);
            if (!alreadyDone) {
                db.transaction(() => {
                    db.prepare('DELETE FROM bets').run();
                    db.prepare('UPDATE games SET winningNumber = NULL, payoutsApproved = 0').run();
                    db.prepare('INSERT INTO daily_resets (reset_date) VALUES (?)').run(todayStr);
                })();
            }
        }
    },
    exportDatabaseState: () => {
        const admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
        if (admin) admin.prizeRates = safeJsonParse(admin.prizeRates);
        return {
            admin,
            dealers: db.prepare('SELECT * FROM dealers').all().map(d => normalizeAccount(d, 'dealers')),
            users: db.prepare('SELECT * FROM users').all().map(u => normalizeAccount(u, 'users')),
            games: db.prepare('SELECT * FROM games').all(),
            bets: db.prepare('SELECT * FROM bets').all().map(b => ({...b, numbers: safeJsonParse(b.numbers)}))
        };
    },
    findAccountForLogin: (loginId) => {
        const tables = [{ n: 'users', r: 'USER' }, { n: 'dealers', r: 'DEALER' }, { n: 'admins', r: 'ADMIN' }];
        for (const t of tables) {
            const acc = db.prepare(`SELECT * FROM ${t.n} WHERE LOWER(id) = LOWER(?)`).get(loginId);
            if (acc) return { account: normalizeAccount(acc, t.n), role: t.r };
        }
        return { account: null, role: null };
    },
    getAllFromTable: (table) => {
        return db.prepare(`SELECT * FROM ${table}`).all().map(a => {
            const norm = normalizeAccount(a, table);
            if (norm.numbers) norm.numbers = safeJsonParse(norm.numbers);
            if (table === 'games') norm.isMarketOpen = isGameOpen(norm.drawTime);
            return norm;
        });
    },
    findUsersByDealerId: (dealerId) => db.prepare('SELECT * FROM users WHERE LOWER(dealerId) = LOWER(?)').all(dealerId).map(u => normalizeAccount(u, 'users')),
    findBetsByDealerId: (dealerId) => db.prepare('SELECT * FROM bets WHERE LOWER(dealerId) = LOWER(?) ORDER BY timestamp DESC').all(dealerId).map(b => ({...b, numbers: safeJsonParse(b.numbers), timestamp: new Date(b.timestamp)})),
    findBetsByUserId: (userId) => db.prepare('SELECT * FROM bets WHERE LOWER(userId) = LOWER(?) ORDER BY timestamp DESC').all(userId).map(b => ({...b, numbers: safeJsonParse(b.numbers), timestamp: new Date(b.timestamp)})),
    searchBets: (query, gameId, userId) => {
        let sql = 'SELECT * FROM bets WHERE 1=1';
        const params = [];
        if (query) { sql += ' AND numbers LIKE ?'; params.push(`%"${query}"%`); }
        if (gameId) { sql += ' AND gameId = ?'; params.push(gameId); }
        if (userId) { sql += ' AND LOWER(userId) = LOWER(?)'; params.push(userId); }
        sql += ' ORDER BY timestamp DESC';
        return db.prepare(sql).all(...params).map(b => ({...b, numbers: safeJsonParse(b.numbers), timestamp: new Date(b.timestamp)}));
    },
    getNumberSummary: (filters) => {
        const { date, gameId, dealerId, query } = filters;
        let sql = 'SELECT * FROM bets WHERE 1=1';
        const params = [];
        if (date) { sql += ' AND timestamp LIKE ?'; params.push(`${date}%`); }
        if (gameId) { sql += ' AND gameId = ?'; params.push(gameId); }
        if (dealerId) { sql += ' AND LOWER(dealerId) = LOWER(?)'; params.push(dealerId); }
        const bets = db.prepare(sql).all(...params);
        const gameBreakdownMap = {}; const twoDigitMap = {}; const oneOpenMap = {}; const oneCloseMap = {};
        const gameNames = {}; db.prepare('SELECT id, name FROM games').all().forEach(g => gameNames[g.id] = g.name);
        bets.forEach(b => {
            const nums = safeJsonParse(b.numbers); const stake = b.amountPerNumber;
            gameBreakdownMap[gameNames[b.gameId]] = (gameBreakdownMap[gameNames[b.gameId]] || 0) + b.totalAmount;
            nums.forEach(n => {
                if (query && !n.includes(query)) return;
                if (b.subGameType.includes('2 Digit') || b.subGameType.includes('Bulk') || b.subGameType.includes('Combo')) twoDigitMap[n] = (twoDigitMap[n] || 0) + stake;
                else if (b.subGameType === '1 Digit Open') oneOpenMap[n] = (oneOpenMap[n] || 0) + stake;
                else if (b.subGameType === '1 Digit Close') oneCloseMap[n] = (oneCloseMap[n] || 0) + stake;
            });
        });
        const sortMap = (map) => Object.entries(map).map(([number, total]) => ({ number, total })).sort((a, b) => b.total - a.total);
        return {
            gameBreakdown: Object.entries(gameBreakdownMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
            twoDigit: sortMap(twoDigitMap), oneDigitOpen: sortMap(oneOpenMap), oneDigitClose: sortMap(oneCloseMap)
        };
    },
    createDealer: (d) => {
        const defaultPrizeRates = JSON.stringify({ oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 });
        db.transaction(() => {
            db.prepare(`INSERT INTO dealers (id, name, password, area, contact, wallet, commissionRate, prizeRates) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                d.id, d.name, d.password, d.area || '', d.contact || '', d.wallet || 0, d.commissionRate || 10, d.prizeRates ? JSON.stringify(d.prizeRates) : defaultPrizeRates
            );
            if (d.wallet > 0) db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), d.id.toLowerCase(), 'DEALER', new Date().toISOString(), 'Opening Deposit', 0, d.wallet, d.wallet);
        })();
    },
    createUser: (u) => {
        const defaultPrizeRates = JSON.stringify({ oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 });
        const defaultBetLimits = JSON.stringify({ oneDigit: 5000, twoDigit: 5000, perDraw: 20000 });
        db.transaction(() => {
            db.prepare(`INSERT INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits, fixedStake) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                u.id, u.name, u.password, u.dealerId, u.area || '', u.contact || '', u.wallet || 0, u.commissionRate || 5, u.prizeRates ? JSON.stringify(u.prizeRates) : defaultPrizeRates, u.betLimits ? JSON.stringify(u.betLimits) : defaultBetLimits, u.fixedStake || 0
            );
            if (u.wallet > 0) db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), u.id.toLowerCase(), 'USER', new Date().toISOString(), 'Opening Deposit', 0, u.wallet, u.wallet);
        })();
    },
    updateUser: (id, u) => db.prepare('UPDATE users SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ?, betLimits = ?, fixedStake = ? WHERE LOWER(id) = LOWER(?)').run(u.name, u.password, u.area, u.contact, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits), u.fixedStake || 0, id),
    updateDealer: (id, d) => db.prepare('UPDATE dealers SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ? WHERE LOWER(id) = LOWER(?)').run(d.name, d.password, d.area, d.contact, d.commissionRate, JSON.stringify(d.prizeRates), id),
    transferFunds: (senderId, senderTable, receiverId, receiverTable, amount, description) => {
        return db.transaction(() => {
            const sender = db.prepare(`SELECT wallet, name FROM ${senderTable} WHERE LOWER(id) = LOWER(?)`).get(senderId);
            const receiver = db.prepare(`SELECT wallet, name FROM ${receiverTable} WHERE LOWER(id) = LOWER(?)`).get(receiverId);
            if (!sender || !receiver) throw new Error('Account not found');
            const amt = parseFloat(amount);
            if (amt <= 0 || sender.wallet < amt) throw new Error('Invalid or insufficient funds');
            const newSenderBal = sender.wallet - amt; const newReceiverBal = receiver.wallet + amt;
            db.prepare(`UPDATE ${senderTable} SET wallet = ? WHERE LOWER(id) = LOWER(?)`).run(newSenderBal, senderId);
            db.prepare(`UPDATE ${receiverTable} SET wallet = ? WHERE LOWER(id) = LOWER(?)`).run(newReceiverBal, receiverId);
            const ts = new Date().toISOString(); const st = senderTable.toUpperCase().slice(0, -1); const rt = receiverTable.toUpperCase().slice(0, -1);
            db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), senderId.toLowerCase(), st, ts, `${description} to ${receiver.name} (${receiverId})`, amt, 0, newSenderBal);
            db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), receiverId.toLowerCase(), rt, ts, `${description} from ${sender.name} (${senderId})`, 0, amt, newReceiverBal);
            return { senderBalance: newSenderBal, receiverBalance: newReceiverBal };
        })();
    },
    placeBet: (userId, data) => {
        return db.transaction(() => {
            const user = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?)').get(userId);
            const dealer = db.prepare('SELECT * FROM dealers WHERE LOWER(id) = LOWER(?)').get(user.dealerId);
            const limits = safeJsonParse(user.betLimits) || { oneDigit: 10000, twoDigit: 10000, perDraw: 50000 };
            const processBet = (gameId, betGroups) => {
                const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
                if (!isGameOpen(game.drawTime)) throw new Error(`Market for ${game.name} is closed`);
                let totalCost = 0;
                betGroups.forEach(bg => {
                    if (user.fixedStake > 0) bg.amountPerNumber = user.fixedStake;
                    totalCost += bg.numbers.length * bg.amountPerNumber;
                    bg.numbers.forEach(num => {
                        const limit = bg.subGameType.includes('1 Digit') ? limits.oneDigit : limits.twoDigit;
                        const existing = db.prepare('SELECT SUM(amountPerNumber) as sum FROM bets WHERE userId = ? AND gameId = ? AND numbers LIKE ?').get(userId, gameId, `%${num}%`);
                        if (((existing.sum || 0) + bg.amountPerNumber) > limit) throw new Error(`Limit Exceeded for ${num}`);
                    });
                });
                const currentTotal = db.prepare('SELECT SUM(totalAmount) as sum FROM bets WHERE userId = ? AND gameId = ?').get(userId, gameId);
                if (((currentTotal.sum || 0) + totalCost) > limits.perDraw) throw new Error(`Draw Limit Exceeded for ${game.name}`);
                if (user.wallet < totalCost) throw new Error('Insufficient wallet balance');
                const afterBet = user.wallet - totalCost; db.prepare('UPDATE users SET wallet = ? WHERE LOWER(id) = LOWER(?)').run(afterBet, userId);
                const ts = new Date().toISOString(); db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), userId.toLowerCase(), 'USER', ts, `Play: ${game.name}`, totalCost, 0, afterBet);
                const uc = totalCost * (user.commissionRate / 100); if (uc > 0) { const ac = afterBet + uc; db.prepare('UPDATE users SET wallet = ? WHERE LOWER(id) = LOWER(?)').run(ac, userId); db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), userId.toLowerCase(), 'USER', new Date(new Date(ts).getTime()+1).toISOString(), `Comm: ${game.name}`, 0, uc, ac); }
                const dc = totalCost * (dealer.commissionRate / 100); if (dc > 0) { const dw = db.prepare('SELECT wallet FROM dealers WHERE LOWER(id) = LOWER(?)').get(dealer.id).wallet + dc; db.prepare('UPDATE dealers SET wallet = ? WHERE LOWER(id) = LOWER(?)').run(dw, dealer.id); db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), dealer.id.toLowerCase(), 'DEALER', ts, `Network Comm: ${user.name}`, 0, dc, dw); }
                betGroups.forEach(bg => db.prepare(`INSERT INTO bets (id, userId, dealerId, gameId, subGameType, numbers, amountPerNumber, totalAmount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), userId.toLowerCase(), user.dealerId.toLowerCase(), gameId, bg.subGameType, JSON.stringify(bg.numbers), bg.amountPerNumber, bg.numbers.length * bg.amountPerNumber, ts));
            };
            if (data.isMultiGame) Object.entries(data.multiGameBets).forEach(([gid, gdata]) => processBet(gid, gdata.betGroups)); else processBet(data.gameId, data.betGroups);
            return { success: true };
        })();
    },
    getFinancialSummary: () => {
        const games = db.prepare('SELECT * FROM games').all();
        const summaries = games.map(g => {
            const bets = db.prepare('SELECT * FROM bets WHERE gameId = ?').all(g.id);
            let stake = 0, payouts = 0, userComm = 0, dealerComm = 0;
            bets.forEach(b => {
                stake += b.totalAmount;
                const user = db.prepare('SELECT commissionRate, prizeRates FROM users WHERE LOWER(id) = LOWER(?)').get(b.userId);
                const dealer = db.prepare('SELECT commissionRate FROM dealers WHERE LOWER(id) = LOWER(?)').get(b.dealerId);
                if (user) userComm += b.totalAmount * (user.commissionRate / 100);
                if (dealer) dealerComm += b.totalAmount * (dealer.commissionRate / 100);
                if (g.winningNumber && !g.winningNumber.includes('_') && user) payouts += calculatePayout(b, g.winningNumber, g.name, user.prizeRates);
            });
            return { gameId: g.id, gameName: g.name, winningNumber: g.winningNumber || '-', totalStake: stake, totalPayouts: payouts, userCommission: userComm, dealerCommission: dealerComm, netProfit: stake - payouts - userComm - dealerComm };
        });
        return { games: summaries, totals: summaries.reduce((acc, s) => ({ totalStake: acc.totalStake + s.totalStake, totalPayouts: acc.totalPayouts + s.totalPayouts, totalUserCommission: acc.totalUserCommission + s.userCommission, totalDealerCommission: acc.totalDealerCommission + s.dealerCommission, netProfit: acc.netProfit + s.netProfit }), { totalStake: 0, totalPayouts: 0, totalUserCommission: 0, totalDealerCommission: 0, netProfit: 0 }) };
    },
    declareWinner: (gameId, num) => {
        let val = String(num).trim();
        const gName = db.prepare('SELECT name FROM games WHERE id = ?').get(gameId).name;
        if (gName !== 'AK' && gName !== 'AKC' && val.length === 1 && val !== '') val = '0' + val;
        db.prepare('UPDATE games SET winningNumber = ? WHERE id = ?').run(val, gameId);
        return { success: true };
    },
    approvePayouts: (gameId) => {
        return db.transaction(() => {
            const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
            if (!game || !game.winningNumber || game.winningNumber.includes('_') || game.payoutsApproved) return { success: false };
            db.prepare('SELECT b.*, u.prizeRates FROM bets b JOIN users u ON LOWER(b.userId) = LOWER(u.id) WHERE b.gameId = ?').all(gameId).forEach(bet => {
                const payout = calculatePayout(bet, game.winningNumber, game.name, bet.prizeRates);
                if (payout > 0) {
                    db.prepare('UPDATE users SET wallet = wallet + ? WHERE LOWER(id) = LOWER(?)').run(payout, bet.userId);
                    const nw = db.prepare('SELECT wallet FROM users WHERE LOWER(id) = LOWER(?)').get(bet.userId).wallet;
                    db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), bet.userId.toLowerCase(), 'USER', new Date().toISOString(), `Draw Winner: ${game.name} (${game.winningNumber})`, 0, payout, nw);
                }
            });
            db.prepare('UPDATE games SET payoutsApproved = 1 WHERE id = ?').run(gameId);
            return { success: true };
        })();
    },
    toggleRestriction: (id, table) => {
        const acc = db.prepare(`SELECT isRestricted FROM ${table} WHERE LOWER(id) = LOWER(?)`).get(id);
        const newVal = acc.isRestricted ? 0 : 1;
        db.transaction(() => {
            db.prepare(`UPDATE ${table} SET isRestricted = ? WHERE LOWER(id) = LOWER(?)`).run(newVal, id);
            if (table === 'dealers') db.prepare(`UPDATE users SET isRestricted = ? WHERE LOWER(dealerId) = LOWER(?)`).run(newVal, id);
        })();
    },
    deleteUser: (id) => db.prepare('DELETE FROM users WHERE LOWER(id) = LOWER(?)').run(id)
};
