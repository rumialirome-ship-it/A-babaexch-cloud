
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
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, password TEXT, dealerId TEXT, area TEXT, contact TEXT, wallet REAL, commissionRate REAL, isRestricted INTEGER DEFAULT 0, prizeRates TEXT, betLimits TEXT, avatarUrl TEXT, FOREIGN KEY (dealerId) REFERENCES dealers(id));
            CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT, drawTime TEXT, winningNumber TEXT, payoutsApproved INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, userId TEXT, dealerId TEXT, gameId TEXT, subGameType TEXT, numbers TEXT, amountPerNumber REAL, totalAmount REAL, timestamp TEXT, FOREIGN KEY (userId) REFERENCES users(id), FOREIGN KEY (dealerId) REFERENCES dealers(id), FOREIGN KEY (gameId) REFERENCES games(id));
            CREATE TABLE IF NOT EXISTS ledgers (id TEXT PRIMARY KEY, accountId TEXT, accountType TEXT, timestamp TEXT, description TEXT, debit REAL, credit REAL, balance REAL);
            CREATE TABLE IF NOT EXISTS daily_resets (reset_date TEXT PRIMARY KEY);
        `);

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
                        db.prepare('INSERT OR IGNORE INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                            u.id, u.name, u.password, u.dealerId, u.area, u.contact, u.wallet, u.commissionRate, JSON.stringify(u.prizeRates), JSON.stringify(u.betLimits), u.avatarUrl
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

const findAccountById = (id, table, ledgerLimit = 100) => {
    if (!id) return null;
    const account = db.prepare(`SELECT * FROM ${table} WHERE LOWER(id) = LOWER(?)`).get(id);
    if (!account) return null;
    account.ledger = db.prepare('SELECT * FROM ledgers WHERE LOWER(accountId) = LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(id, ledgerLimit).map(l => ({...l, timestamp: new Date(l.timestamp)}));
    if (table === 'games') account.isMarketOpen = isGameOpen(account.drawTime);
    if (account.prizeRates) account.prizeRates = safeJsonParse(account.prizeRates);
    if (account.betLimits) account.betLimits = safeJsonParse(account.betLimits);
    if (account.isRestricted !== undefined) account.isRestricted = !!account.isRestricted;
    return account;
};

const calculatePayout = (bet, winningNumber, gameName, prizeRates) => {
    if (!winningNumber) return 0;
    let winningCount = 0;
    const nums = typeof bet.numbers === 'string' ? JSON.parse(bet.numbers) : bet.numbers;
    nums.forEach(num => {
        if (bet.subGameType === '1 Digit Open' && winningNumber.length >= 1 && num === winningNumber[0]) winningCount++;
        else if (bet.subGameType === '1 Digit Close') {
            if (gameName === 'AKC' && num === winningNumber) winningCount++;
            else if (winningNumber.length === 2 && num === winningNumber[1]) winningCount++;
        }
        else if (num === winningNumber) winningCount++;
    });
    if (winningCount === 0) return 0;
    const rates = typeof prizeRates === 'string' ? safeJsonParse(prizeRates) : prizeRates;
    const rate = bet.subGameType === '1 Digit Open' ? rates.oneDigitOpen : (bet.subGameType === '1 Digit Close' ? rates.oneDigitClose : rates.twoDigit);
    return winningCount * bet.amountPerNumber * rate;
};

const performDailyCleanup = () => {
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
};

module.exports = {
    connect, findAccountById, performDailyCleanup,
    exportDatabaseState: () => {
        const admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
        if (admin) {
            admin.prizeRates = safeJsonParse(admin.prizeRates);
            admin.ledger = db.prepare('SELECT * FROM ledgers WHERE accountId = ?').all(admin.id);
        }
        const dealers = db.prepare('SELECT * FROM dealers').all().map(d => ({
            ...d,
            prizeRates: safeJsonParse(d.prizeRates),
            isRestricted: !!d.isRestricted,
            ledger: db.prepare('SELECT * FROM ledgers WHERE accountId = ?').all(d.id)
        }));
        const users = db.prepare('SELECT * FROM users').all().map(u => ({
            ...u,
            prizeRates: safeJsonParse(u.prizeRates),
            betLimits: safeJsonParse(u.betLimits),
            isRestricted: !!u.isRestricted,
            ledger: db.prepare('SELECT * FROM ledgers WHERE accountId = ?').all(u.id)
        }));
        const games = db.prepare('SELECT * FROM games').all();
        const bets = db.prepare('SELECT * FROM bets').all().map(b => ({
            ...b,
            numbers: safeJsonParse(b.numbers)
        }));
        return { admin, dealers, users, games, bets };
    },
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
    findUsersByDealerId: (dealerId) => {
        return db.prepare('SELECT * FROM users WHERE dealerId = ?').all(dealerId).map(u => {
            u.prizeRates = safeJsonParse(u.prizeRates);
            u.betLimits = safeJsonParse(u.betLimits);
            u.isRestricted = !!u.isRestricted;
            u.ledger = db.prepare('SELECT * FROM ledgers WHERE accountId = ? ORDER BY timestamp DESC LIMIT 50').all(u.id).map(l => ({...l, timestamp: new Date(l.timestamp)}));
            return u;
        });
    },
    findBetsByDealerId: (dealerId) => {
        return db.prepare('SELECT * FROM bets WHERE dealerId = ?').all(dealerId).map(b => {
            b.numbers = safeJsonParse(b.numbers);
            b.timestamp = new Date(b.timestamp);
            return b;
        });
    },
    findBetsByUserId: (userId) => {
        return db.prepare('SELECT * FROM bets WHERE userId = ?').all(userId).map(b => {
            b.numbers = safeJsonParse(b.numbers);
            b.timestamp = new Date(b.timestamp);
            return b;
        });
    },
    searchBets: (query, gameId, userId) => {
        let sql = 'SELECT * FROM bets WHERE 1=1';
        const params = [];
        if (query) {
            sql += ' AND numbers LIKE ?';
            params.push(`%"${query}"%`);
        }
        if (gameId) {
            sql += ' AND gameId = ?';
            params.push(gameId);
        }
        if (userId) {
            sql += ' AND userId = ?';
            params.push(userId);
        }
        return db.prepare(sql).all(...params).map(b => ({
            ...b,
            numbers: safeJsonParse(b.numbers),
            timestamp: new Date(b.timestamp)
        }));
    },
    createDealer: (d) => {
        const defaultPrizeRates = JSON.stringify({ oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 });
        const wallet = parseFloat(d.wallet) || 0;
        db.transaction(() => {
            db.prepare(`INSERT INTO dealers (id, name, password, area, contact, wallet, commissionRate, prizeRates) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                d.id, d.name, d.password, d.area || '', d.contact || '', wallet, d.commissionRate || 10, 
                d.prizeRates ? JSON.stringify(d.prizeRates) : defaultPrizeRates
            );
            if (wallet > 0) {
                db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                    uuidv4(), d.id, 'DEALER', new Date().toISOString(), 'Opening Deposit', 0, wallet, wallet
                );
            }
        })();
    },
    createUser: (u) => {
        const defaultPrizeRates = JSON.stringify({ oneDigitOpen: 90, oneDigitClose: 90, twoDigit: 900 });
        const defaultBetLimits = JSON.stringify({ oneDigit: 5000, twoDigit: 5000, perDraw: 20000 });
        const wallet = parseFloat(u.wallet) || 0;
        db.transaction(() => {
            db.prepare(`INSERT INTO users (id, name, password, dealerId, area, contact, wallet, commissionRate, prizeRates, betLimits) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                u.id, u.name, u.password, u.dealerId, u.area || '', u.contact || '', wallet, u.commissionRate || 5, 
                u.prizeRates ? JSON.stringify(u.prizeRates) : defaultPrizeRates, 
                u.betLimits ? JSON.stringify(u.betLimits) : defaultBetLimits
            );
            if (wallet > 0) {
                db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                    uuidv4(), u.id, 'USER', new Date().toISOString(), 'Opening Deposit', 0, wallet, wallet
                );
            }
        })();
    },
    updateUser: (id, u) => {
        db.prepare('UPDATE users SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ? WHERE id = ?').run(
            u.name, u.password, u.area, u.contact, u.commissionRate, JSON.stringify(u.prizeRates), id
        );
    },
    updateDealer: (id, d) => {
        db.prepare('UPDATE dealers SET name = ?, password = ?, area = ?, contact = ?, commissionRate = ?, prizeRates = ? WHERE id = ?').run(
            d.name, d.password, d.area, d.contact, d.commissionRate, JSON.stringify(d.prizeRates), id
        );
    },
    updateWallet: (id, table, amount, type, actorId) => {
        return db.transaction(() => {
            const acc = db.prepare(`SELECT wallet FROM ${table} WHERE id = ?`).get(id);
            if (!acc) throw new Error('Account not found');
            const amt = parseFloat(amount);
            const newBalance = type === 'credit' ? acc.wallet + amt : acc.wallet - amt;
            if (newBalance < 0) throw new Error('Insufficient funds');
            
            db.prepare(`UPDATE ${table} SET wallet = ? WHERE id = ?`).run(newBalance, id);
            db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                uuidv4(), id, table.toUpperCase().slice(0, -1), new Date().toISOString(), 
                `${type === 'credit' ? 'Deposit' : 'Withdrawal'} by ${actorId}`, 
                type === 'debit' ? amt : 0, type === 'credit' ? amt : 0, newBalance
            );
            return newBalance;
        })();
    },
    placeBet: (userId, data) => {
        return db.transaction(() => {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) throw new Error('User not found');
            const dealer = db.prepare('SELECT * FROM dealers WHERE id = ?').get(user.dealerId);
            if (!dealer) throw new Error('Dealer not found');
            
            const processBet = (gameId, betGroups) => {
                const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
                if (!game) throw new Error(`Game ${gameId} not found`);
                if (!isGameOpen(game.drawTime)) throw new Error(`Market for ${game.name} is closed`);

                let totalCost = 0;
                betGroups.forEach(bg => totalCost += bg.numbers.length * bg.amountPerNumber);

                const currentBalance = db.prepare('SELECT wallet FROM users WHERE id = ?').get(userId).wallet;
                if (currentBalance < totalCost) throw new Error('Insufficient wallet balance');

                // 1. Deduct Bet Amount from User
                const afterBetBalance = currentBalance - totalCost;
                db.prepare('UPDATE users SET wallet = ? WHERE id = ?').run(afterBetBalance, userId);
                db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                    uuidv4(), userId, 'USER', new Date().toISOString(), `Bet placed on ${game.name}`, totalCost, 0, afterBetBalance
                );

                // 2. Add User Commission (Cashback)
                const userComm = totalCost * (user.commissionRate / 100);
                if (userComm > 0) {
                    const afterCommBalance = afterBetBalance + userComm;
                    db.prepare('UPDATE users SET wallet = ? WHERE id = ?').run(afterCommBalance, userId);
                    db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                        uuidv4(), userId, 'USER', new Date().toISOString(), `Comm. on ${game.name} Stake`, 0, userComm, afterCommBalance
                    );
                }

                // 3. Add Dealer Commission
                const dealerComm = totalCost * (dealer.commissionRate / 100);
                if (dealerComm > 0) {
                    const currentDealerWallet = db.prepare('SELECT wallet FROM dealers WHERE id = ?').get(dealer.id).wallet;
                    const afterDealerBalance = currentDealerWallet + dealerComm;
                    db.prepare('UPDATE dealers SET wallet = ? WHERE id = ?').run(afterDealerBalance, dealer.id);
                    db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                        uuidv4(), dealer.id, 'DEALER', new Date().toISOString(), `Booking Comm. [User: ${user.name}] [Game: ${game.name}]`, 0, dealerComm, afterDealerBalance
                    );
                }

                // 4. Record Bets
                betGroups.forEach(bg => {
                    db.prepare(`INSERT INTO bets (id, userId, dealerId, gameId, subGameType, numbers, amountPerNumber, totalAmount, timestamp) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                        uuidv4(), userId, user.dealerId, gameId, bg.subGameType, JSON.stringify(bg.numbers), 
                        bg.amountPerNumber, bg.numbers.length * bg.amountPerNumber, new Date().toISOString()
                    );
                });
            };

            if (data.isMultiGame) {
                Object.entries(data.multiGameBets).forEach(([gid, gdata]) => processBet(gid, gdata.betGroups));
            } else {
                processBet(data.gameId, data.betGroups);
            }
            return { success: true };
        })();
    },
    getDetailedWinners: () => {
        const games = db.prepare('SELECT * FROM games WHERE winningNumber IS NOT NULL AND winningNumber != ""').all();
        const allWinners = [];
        games.forEach(game => {
            const gameBets = db.prepare('SELECT * FROM bets WHERE gameId = ?').all(game.id);
            gameBets.forEach(bet => {
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(bet.userId);
                if (!user) return;
                const payout = calculatePayout(bet, game.winningNumber, game.name, user.prizeRates);
                if (payout > 0) {
                    const dealer = db.prepare('SELECT name FROM dealers WHERE id = ?').get(bet.dealerId);
                    allWinners.push({ 
                        id: bet.id, 
                        userName: user.name, 
                        userId: user.id, 
                        dealerName: dealer ? dealer.name : 'Unknown',
                        dealerId: bet.dealerId,
                        gameName: game.name, 
                        winningNumber: game.winningNumber, 
                        payout: payout, 
                        timestamp: bet.timestamp 
                    });
                }
            });
        });
        return allWinners.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
    getFinancialSummary: () => {
        const games = db.prepare('SELECT * FROM games').all();
        const summaries = games.map(g => {
            const bets = db.prepare('SELECT * FROM bets WHERE gameId = ?').all(g.id);
            let stake = 0, payouts = 0, userComm = 0, dealerComm = 0;
            bets.forEach(b => {
                stake += b.totalAmount;
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(b.userId);
                const dealer = db.prepare('SELECT * FROM dealers WHERE id = ?').get(b.dealerId);
                if (user) userComm += b.totalAmount * (user.commissionRate / 100);
                if (dealer) dealerComm += b.totalAmount * (dealer.commissionRate / 100);
                if (g.winningNumber && user) payouts += calculatePayout(b, g.winningNumber, g.name, user.prizeRates);
            });
            return { 
                gameId: g.id,
                gameName: g.name, 
                winningNumber: g.winningNumber || '-', 
                totalStake: stake, 
                totalPayouts: payouts, 
                userCommission: userComm,
                dealerCommission: dealerComm,
                netProfit: stake - payouts - userComm - dealerComm 
            };
        });
        return { 
            games: summaries, 
            totals: summaries.reduce((acc, s) => ({
                totalStake: acc.totalStake + s.totalStake,
                totalPayouts: acc.totalPayouts + s.totalPayouts,
                totalUserCommission: acc.totalUserCommission + s.userCommission,
                totalDealerCommission: acc.totalDealerCommission + s.dealerCommission,
                netProfit: acc.netProfit + s.netProfit
            }), { totalStake: 0, totalPayouts: 0, totalUserCommission: 0, totalDealerCommission: 0, netProfit: 0 }) 
        };
    },
    getLiveStats: () => {
        const bets = db.prepare('SELECT * FROM bets').all();
        const dealerMap = {};
        const dealers = db.prepare('SELECT id, name FROM dealers').all();
        dealers.forEach(d => { dealerMap[d.id] = { name: d.name, total: 0 }; });
        const typeStats = { '1 Digit Open': 0, '1 Digit Close': 0, '2 Digit': 0, 'Bulk Game': 0, 'Combo Game': 0 };
        const userMap = {};
        bets.forEach(b => {
            if (dealerMap[b.dealerId]) dealerMap[b.dealerId].total += b.totalAmount;
            if (typeStats[b.subGameType] !== undefined) typeStats[b.subGameType] += b.totalAmount;
            if (!userMap[b.userId]) {
                const u = db.prepare('SELECT name FROM users WHERE id = ?').get(b.userId);
                userMap[b.userId] = { name: u ? u.name : b.userId, total: 0 };
            }
            userMap[b.userId].total += b.totalAmount;
        });
        return {
            dealerBookings: Object.entries(dealerMap).map(([id, data]) => ({ id, name: data.name, total: data.total })).sort((a,b) => b.total - a.total),
            typeBookings: Object.entries(typeStats).map(([type, total]) => ({ type, total })),
            topPlayers: Object.entries(userMap).map(([id, data]) => ({ id, name: data.name, total: data.total })).sort((a,b) => b.total - a.total).slice(0, 10)
        };
    },
    updateGameDrawTime: (gameId, time) => db.prepare('UPDATE games SET drawTime = ? WHERE id = ?').run(time, gameId),
    declareWinner: (gameId, num) => db.prepare('UPDATE games SET winningNumber = ? WHERE id = ?').run(num, gameId),
    approvePayouts: (gameId) => {
        return db.transaction(() => {
            const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
            if (!game || !game.winningNumber || game.payoutsApproved) return { success: false };
            const bets = db.prepare('SELECT * FROM bets WHERE gameId = ?').all(gameId);
            bets.forEach(bet => {
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(bet.userId);
                const payout = calculatePayout(bet, game.winningNumber, game.name, user.prizeRates);
                if (payout > 0) {
                    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(payout, user.id);
                    db.prepare('INSERT INTO ledgers (id, accountId, accountType, timestamp, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                        uuidv4(), user.id, 'USER', new Date().toISOString(), `Winning Payout: ${game.name}`, 0, payout, user.wallet + payout
                    );
                }
            });
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