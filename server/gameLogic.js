// server/gameLogic.js
const boardData = require('./boardData');
const { L, Lpick } = require('./i18nSrv');   // 🌐 tekstai iš lang/lt.json
const BuildingLogic = require('./buildingLogic');
const TradingLogic = require('./tradingLogic');
const DemolishLogic = require('./demolishLogic');
const C = require('./gameConstants');

// 🛡️ Slapti žaidėjo laukai (raktas grįžimui, IP, socket ID, paskyros ID) –
// serveris juos naudoja, bet į klientus jie nesiunčiami (JSON ir {...p} jų nemato)
const PRIVATE_PLAYER_FIELDS = ['token', 'ip', 'socketId', 'userId'];
function hidePrivatePlayerFields(player) {
    PRIVATE_PLAYER_FIELDS.forEach(key => {
        const value = player[key];
        Object.defineProperty(player, key, { value: value, writable: true, configurable: true, enumerable: false });
    });
    return player;
}

// 🛡️ Sunkiai atspėjamas grįžimo raktas
function makePlayerToken() {
    try {
        return require('crypto').randomBytes(24).toString('hex');
    } catch (e) {
        return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}
const db = require('./db');

// ============================================
// 🆕 GLOBALUS BOARD CACHE (boardData + DB override)
// ============================================
let globalBoardCache = null;

async function loadBoardCache() {
    try {
        const overrides = await db.getBoardCells();
        const overrideMap = new Map();
        overrides.forEach(o => overrideMap.set(o.cell_index, o));

        globalBoardCache = boardData.map(cell => {
            const ov = overrideMap.get(cell.id);
            if (!ov) return { ...cell };
            // 🚕 TAKSI langelis: senas „Parkingo“ įrašas DB neturi pakeisti jo tipo, pavadinimo ir paveikslėlio
            if (cell.id === C.TAXI_FIELD_ID || cell.id === C.WHEEL_FIELD_ID) {
                if (ov.type || ov.icon || ov.name) {
                    console.log(`🚕 Langelis ${cell.id}: DB pakeitimas (${ov.name || ''} ${ov.type || ''}) ignoruojamas – tai TAKSI`);
                }
                return { ...cell, font_size: ov.font_size ?? 14, font_color: ov.font_color ?? null };
            }
            return {
                ...cell,
                name: (cell.id === 32 && ov.name && /^sauna$/i.test(String(ov.name).trim())) ? cell.name : (ov.name ?? cell.name),   // SAUNA → PIRTIS
                type: ov.type ?? cell.type,
                color: ov.color ?? cell.color,
                color2: ov.color2 ?? null,
                cost: ov.cost ?? cell.cost,
                icon: ov.icon ?? cell.icon,
                music: ov.music ?? null,
                font_size: ov.font_size ?? 14,
                font_color: ov.font_color ?? null,
                description: ov.description ?? null,
                custom_data: ov.custom_data ?? null
            };
        });

        console.log(`🎨 Board cache įkeltas (${overrides.length} override)`);
        return globalBoardCache;
    } catch (err) {
        console.error('❌ Board cache klaida:', err);
        globalBoardCache = boardData.map(c => ({ ...c }));
        return globalBoardCache;
    }
}

function getBoardCache() {
    return globalBoardCache || boardData;
}

class Game {
    constructor() {
        this.players = [];
        this.board = getBoardCache();
        this.currentTurn = 0;
        this.gameStarted = false;
        this.turnHistory = [];
        this.maxPlayers = C.MAX_PLAYERS;
        this.diceValues = [1, 1];
        this.isRolling = false;
        this.lastRollTime = 0;
        this.consecutiveDoubles = 0;
        this.waitingForBuy = false;
        this.currentPlayerId = null;
        this.pendingFieldPlayerId = null;
        this.doubleRoll = false;
        this.emitFunction = null;
        this.lastMessage = '';
        this.buildingLogic = new BuildingLogic(this);
        this.tradingLogic = new TradingLogic(this);
        this.demolishLogic = new DemolishLogic(this);
        this.activeVoteKick = null;
        this.voteKickTimer = null;
        this.isPublic = false;
        // 🏗️ Statybų taisyklė: 1 – bet kada ir bet kur (turint pilną gatvę),
        // 2 – atsistojus ant savo sklypo – po namą visoje gatvėje, 3 – tik sklype, ant kurio stovi
        this.buildRule = 2;
        this.builtThisTurn = {};
        this.waitingForTaxi = null;   // 🚕 { playerId, deadline }
        this.taxiTimer = null;
        this.waitingForWheel = null;  // 🎡 { playerId, deadline, spinning, index, ... }
        this.wheelTimer = null;
        this.waitingForBuild = null;  // 🏗️ { playerId, deadline }
        this.buildWindowTimer = null;
        this.lastActivity = Date.now();
        this.gameId = null;
        this.buyTimeoutTimer = null;
        this.reservedColors = new Map();
        this.botTurnInProgress = false;
        this.turnTimer = null;
        this.turnTimerEndTime = null;
        this.turnTimeoutDuration = 60000;   // 60s (normalus; AFK – žr. getTurnDurationFor)
        this.disconnectTimers = {};         // playerId -> setTimeout (bankrotas po 10 min.)
    }

    // ============================================
    // 🆕 AFK LYGIS IR LAIKAI
    // ============================================
    getAfkLevel(player) {
        const n = (player && player.afkAutoMoves) || 0;
        return Math.min(n, C.AFK_TURN_TIMES.length - 1);
    }

    getTurnDurationFor(player) {
        return C.AFK_TURN_TIMES[this.getAfkLevel(player)];
    }

    getBuyDurationFor(player) {
        return C.AFK_BUY_TIMES[this.getAfkLevel(player)];
    }

    // Žaidėjas pats ką nors padarė – nebe AFK
    markPlayerActive(playerId) {
        const p = this.getPlayerById(playerId);
        if (!p || p.isBot) return false;
        const wasAfk = (p.afkAutoMoves || 0) > 0;
        p.afkAutoMoves = 0;
        p.afkSince = null;
        // Jei dabar jo eilė ir laukiama metimo – grąžinam pilną laiką
        if (wasAfk && this.currentTurn === playerId && this.gameStarted &&
            !this.isRolling && !this.waitingForBuy && this.turnTimer) {
            this.startTurnTimer();
        }
        return wasAfk;
    }

    // ============================================
    // 🆕 BANKROTO PRANEŠIMAS VISIEMS (naudoja ir laikmačiai)
    // ============================================
    announceBankrupt(playerId, result, reason) {
        if (!this.emitFunction || !result || result.error) return;
        this.emitFunction('bankruptConfirmed', {
            playerId: playerId,
            playerName: result.playerName,
            reason: reason || null
        });
        this.emitFunction('gameState', this.getGameState());
        let msg = L('srv.game.bankrotavo', { playerName: result.playerName });
        if (reason === 'afk') msg = L('srv.game.bankrotavo_per_ilgai_neaktyvus_afk', { playerName: result.playerName });
        if (reason === 'disconnect') msg = L('srv.game.bankrotavo_negrizo_per_min', { playerName: result.playerName });
        this.emitFunction('message', msg);
    }

    forceBankrupt(playerId, reason) {
        const result = this.bankruptPlayer(playerId);
        this.announceBankrupt(playerId, result, reason);
        return result;
    }

    // ============================================
    // 🆕 ATSIJUNGIMAS / GRĮŽIMAS
    // ============================================
    playerDisconnected(playerId) {
        const p = this.getPlayerById(playerId);
        if (!p || p.isBot || p.bankrupt || p.left || p.kicked) return;
        p.disconnected = true;
        p.disconnectedAt = Date.now();
        this.clearDisconnectTimer(playerId);
        this.disconnectTimers[playerId] = setTimeout(() => {
            delete this.disconnectTimers[playerId];
            const pl = this.getPlayerById(playerId);
            if (pl && pl.disconnected && !pl.bankrupt && !pl.left && !pl.kicked && this.gameStarted) {
                console.log(`⏰ ${pl.name} negrįžo per 10 min. – bankrotas`);
                this.forceBankrupt(playerId, 'disconnect');
            }
        }, C.DISCONNECT_BANKRUPT_MS);
    }

    playerReconnected(playerId) {
        const p = this.getPlayerById(playerId);
        if (!p) return;
        p.disconnected = false;
        p.disconnectedAt = null;
        this.clearDisconnectTimer(playerId);
        this.markPlayerActive(playerId);
    }

    clearDisconnectTimer(playerId) {
        if (this.disconnectTimers[playerId]) {
            clearTimeout(this.disconnectTimers[playerId]);
            delete this.disconnectTimers[playerId];
        }
    }

    // Laukas apdorojamas serveryje, jei klientas neatsiuntė movementFinished
    // (naršyklė uždaryta arba skirtukas „užmigęs“)
    processPendingFieldServerSide(playerId) {
        if (this.pendingFieldPlayerId !== playerId) return;
        this.pendingFieldPlayerId = null;
        this.isRolling = false;
        const result = this.processField(playerId);
        if (!result || result.error || !this.emitFunction) return;
        this.emitFunction('fieldResult', result);
        this.emitFunction('gameState', this.getGameState());
        if (result.messageKey) {
            this.emitFunction('message', { key: result.messageKey, data: result.messageData || {} });
        } else if (result.message) {
            this.emitFunction('message', result.message);
        }
    }

    setEmitFunction(emitFn) {
        this.emitFunction = emitFn;
    }

    setGameId(id) {
        this.gameId = id;
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getActivePlayers() {
        return this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
    }

    addPlayer(name, color = null, userId = null, emoji = null) {
        if (this.players.length >= C.MAX_PLAYERS) {
            return { error: L('srv.game.daugiausiai_zaidejai', { MAX_PLAYERS: C.MAX_PLAYERS }) };
        }

        if (this.gameStarted) {
            return { error: L('srv.game.zaidimas_jau_prasidejo_negalima_prisijungti') };
        }

        if (this.players.find(p => p.name === name && !p.left && !p.bankrupt && !p.kicked)) {
            return { error: L('srv.game.toks_vardas_jau_uzimtas') };
        }

        let finalColor;

        if (color) {
            const isTaken = this.players.some(p =>
                p.color === color && !p.left && !p.bankrupt && !p.kicked
            );

            if (isTaken) {
                return { error: L('srv.game.si_spalva_jau_uzimta') };
            }

            if (!C.PLAYER_COLORS.includes(color)) {
                return { error: L('srv.game.neteisinga_spalva') };
            }

            finalColor = color;
        } else {
            const usedColors = this.players
                .filter(p => !p.left && !p.bankrupt && !p.kicked)
                .map(p => p.color);

            const availableColor = C.PLAYER_COLORS.find(c => !usedColors.includes(c));

            if (!availableColor) {
                return { error: L('srv.game.nera_laisvu_spalvu') };
            }

            finalColor = availableColor;
        }

        const player = {
            id: this.players.length,
            name: name,
            position: 0,
            money: C.START_MONEY,
            color: finalColor,
            emoji: emoji,
            piece: null,     // 🎲 figūrėlės forma (ne prisijungimo „token“!) – žaidėjas pasirenka pats
            properties: [],
            houses: {},
            inJail: false,
            jailTurns: 0,
            consecutiveDoubles: 0,
            isActive: true,
            bankrupt: false,
            left: false,
            kicked: false,
            isDebtor: false,
            ready: false,
            socketId: null,
            token: makePlayerToken(),
            joinedAt: Date.now(),
            isHost: this.players.length === 0,
            isBot: false,
            userId: userId,
            pendingPurchase: null
        };
        hidePrivatePlayerFields(player);
        this.players.push(player);

        this.lastActivity = Date.now();

        return player;
    }

    addBot() {
        if (this.players.length >= C.MAX_PLAYERS) {
            return { error: L('srv.game.daugiausiai_zaidejai', { MAX_PLAYERS: C.MAX_PLAYERS }) };
        }

        if (this.gameStarted) {
            return { error: L('srv.game.zaidimas_jau_prasidejo_negalima_prideti') };
        }

        const BOT_NAMES = ['Jonas', 'Petras', 'Antanas', 'Ona', 'Marytė', 'Stasys', 'Birutė'];

        const usedNames = this.players.map(p => p.name);
        const availableName = BOT_NAMES.find(n => !usedNames.includes(n));

        if (!availableName) {
            return { error: L('srv.game.nera_laisvu_botu_vardu') };
        }

        const usedColors = this.players
            .filter(p => !p.left && !p.bankrupt && !p.kicked)
            .map(p => p.color);

        const availableColor = C.PLAYER_COLORS.find(c => !usedColors.includes(c));

        if (!availableColor) {
            return { error: L('srv.game.nera_laisvu_spalvu') };
        }

        const bot = {
            id: this.players.length,
            name: availableName,
            position: 0,
            money: C.START_MONEY,
            color: availableColor,
            piece: this.randomFreePiece(),   // botas – atsitiktinė, dar nenaudojama forma
            properties: [],
            houses: {},
            inJail: false,
            jailTurns: 0,
            consecutiveDoubles: 0,
            isActive: true,
            bankrupt: false,
            left: false,
            kicked: false,
            isDebtor: false,
            ready: true,
            socketId: null,
            token: 'bot_' + Math.random().toString(36).substring(2),
            joinedAt: Date.now(),
            isHost: false,
            isBot: true
        };

        hidePrivatePlayerFields(bot);
        this.players.push(bot);
        this.lastActivity = Date.now();

        console.log(`🤖 Botas pridėtas: ${availableName} (${availableColor})`);

        return bot;
    }

    isBot(playerId) {
        const player = this.getPlayerById(playerId);
        return player && player.isBot === true;
    }

    getBots() {
        return this.players.filter(p => p.isBot === true && !p.bankrupt && !p.left && !p.kicked);
    }

    botShouldBuyProperty(bot, field) {
        if (!bot || !field) return false;

        if (bot.money < field.cost * 1.5) {
            console.log(`🤖 ${bot.name}: nepakanka pinigų ${field.name}`);
            return false;
        }

        const baseRent = field.cost * C.RENT_BASE_RATIO;
        const roi = (baseRent * 10) / field.cost;

        const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
        if (isService) {
            console.log(`🤖 ${bot.name}: perka service ${field.name}`);
            return true;
        }

        if (field.type === 'property') {
            const group = C.COLOR_GROUPS[field.color] || [];
            const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;

            if (ownedInGroup >= 1) {
                console.log(`🤖 ${bot.name}: perka ${field.name} (turi ${ownedInGroup} tos pačios spalvos)`);
                return true;
            }

            if (bot.money > field.cost * 3) {
                console.log(`🤖 ${bot.name}: perka ${field.name} (daug pinigų)`);
                return true;
            }

            if (roi > 0.5) {
                console.log(`🤖 ${bot.name}: perka ${field.name} (ROI ${roi.toFixed(2)})`);
                return true;
            }
        }

        console.log(`🤖 ${bot.name}: NEperka ${field.name}`);
        return false;
    }

    botShouldBuildHouse(bot, fieldId) {
        if (!bot || !fieldId) return false;

        const field = this.board.find(f => f.id === fieldId);
        if (!field || !field.color) return false;

        const group = C.COLOR_GROUPS[field.color] || [];
        const hasAll = group.every(id => bot.properties.includes(id));
        if (!hasAll) return false;

        const currentHouses = bot.houses[fieldId] || 0;
        if (currentHouses >= 5) return false;

        const buildCost = Math.floor(field.cost * C.BUILD_COST_RATIO);
        if (bot.money < buildCost * 2) {
            console.log(`🤖 ${bot.name}: nepakanka pinigų namui statyti`);
            return false;
        }

        const housesInGroup = group.map(id => bot.houses[id] || 0);
        const minHouses = Math.min(...housesInGroup);
        const maxHouses = Math.max(...housesInGroup);

        if (maxHouses - minHouses > 1) return false;

        if (currentHouses > minHouses) return false;

        console.log(`🤖 ${bot.name}: stato namą ant ${field.name}`);
        return true;
    }

    botHandleDebt(bot) {
        if (!bot || bot.money >= 0) return { action: 'none' };

        console.log(`🤖 ${bot.name}: skolingas €${Math.abs(bot.money)} – bando parduoti`);

        const sellable = bot.properties
            .filter(id => !bot.houses[id] || bot.houses[id] === 0)
            .map(id => this.board.find(f => f.id === id))
            .filter(f => f)
            .sort((a, b) => a.cost - b.cost);

        if (sellable.length > 0) {
            return { action: 'sell', fieldId: sellable[0].id };
        }

        const withHouses = bot.properties
            .map(id => this.board.find(f => f.id === id))
            .filter(f => f)
            .sort((a, b) => a.cost - b.cost);

        if (withHouses.length > 0) {
            return { action: 'demolish', fieldId: withHouses[0].id };
        }

        return { action: 'bankrupt' };
    }

    botDecideAction(bot) {
        if (!bot || !bot.isActive || bot.bankrupt) return { action: 'none' };

        if (bot.money < 0) {
            return this.botHandleDebt(bot);
        }

        if (bot.inJail) {
            if (bot.money >= C.JAIL_FINE * 2) {
                return { action: 'pay_jail' };
            }
        }

        const field = this.board[bot.position];
        if (field && field.type === 'property' && field.color) {
            if (this.botShouldBuildHouse(bot, field.id)) {
                return { action: 'build', fieldId: field.id };
            }
        }

        return { action: 'none' };
    }

    botShouldAcceptTrade(botId, trade) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return false;

        let botGets = 0;
        let botGives = 0;

        if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
            trade.offerFieldIds.forEach(fieldId => {
                const field = this.board.find(f => f.id === fieldId);
                if (field) botGets += field.cost;
            });
        }
        botGets += trade.offerMoney || 0;

        if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
            trade.requestFieldIds.forEach(fieldId => {
                const field = this.board.find(f => f.id === fieldId);
                if (field) botGives += field.cost;
            });
        }
        botGives += trade.requestMoney || 0;

        console.log(`🤖 ${bot.name}: prekybos analizė:`);
        console.log(`   Gauna: €${botGets}`);
        console.log(`   Atiduoda: €${botGives}`);
        console.log(`   Skirtumas: €${botGets - botGives}`);

        const profit = botGets - botGives;
        const profitRatio = botGives > 0 ? profit / botGives : 1;

        let getsGroupBonus = false;
        let givesGroupPenalty = false;

        if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
            trade.offerFieldIds.forEach(fieldId => {
                const field = this.board.find(f => f.id === fieldId);
                if (!field || !field.color) return;

                const group = C.COLOR_GROUPS[field.color] || [];
                const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;

                if (ownedInGroup >= 1) {
                    getsGroupBonus = true;
                }
            });
        }

        if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
            trade.requestFieldIds.forEach(fieldId => {
                const field = this.board.find(f => f.id === fieldId);
                if (!field || !field.color) return;

                const group = C.COLOR_GROUPS[field.color] || [];
                const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;

                if (ownedInGroup >= group.length) {
                    givesGroupPenalty = true;
                }
            });
        }

        if (givesGroupPenalty) {
            console.log(`🤖 ${bot.name}: NEPRIIMA – atiduoda pilną grupę`);
            return false;
        }

        if (getsGroupBonus && profit >= 0) {
            console.log(`🤖 ${bot.name}: PRIIMA – gauna grupės kortelę`);
            return true;
        }

        if (profitRatio > 0.2) {
            console.log(`🤖 ${bot.name}: PRIIMA – pelnas ${(profitRatio * 100).toFixed(0)}%`);
            return true;
        }

        if (profit > 0 && bot.money > 1500) {
            console.log(`🤖 ${bot.name}: PRIIMA – turi daug pinigų`);
            return true;
        }

        console.log(`🤖 ${bot.name}: ATMETA – nepakankamas pelnas`);
        return false;
    }

    async processBotTradeResponse(botId, tradeId) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return null;

        const trade = this.tradingLogic.trades.get(tradeId);
        if (!trade) {
            console.log(`🤖 ${bot.name}: prekyba ${tradeId} nerasta`);
            return null;
        }

        await this.botSleep(1500);

        // Kol botas „galvojo“, sandoris galėjo būti atšauktas arba įvykdytas
        if (!this.tradingLogic.trades.get(tradeId)) {
            console.log(`🤖 ${bot.name}: prekyba ${tradeId} jau nebeegzistuoja – nieko nedarom`);
            return null;
        }

        const accept = this.botShouldAcceptTrade(botId, trade);

        const result = this.tradingLogic.respondToTrade(tradeId, botId, accept);

        console.log(`🤖 ${bot.name} ${accept ? 'PRIIMA' : 'ATMETA'} prekybą:`, result);

        return {
            botId: botId,
            botName: bot.name,
            tradeId: tradeId,
            accept: accept,
            result: result
        };
    }

    botShouldProposeTrade(bot) {
        if (!bot || !bot.isBot) return null;

        if (bot.properties.length < 2) return null;

        const colorCounts = {};
        bot.properties.forEach(fieldId => {
            const field = this.board.find(f => f.id === fieldId);
            if (field && field.color && field.type === 'property') {
                if (!colorCounts[field.color]) colorCounts[field.color] = [];
                colorCounts[field.color].push(fieldId);
            }
        });

        let targetColor = null;
        let targetOwned = [];
        for (const [color, ids] of Object.entries(colorCounts)) {
            if (ids.length >= 2) {
                const group = C.COLOR_GROUPS[color] || [];
                if (ids.length < group.length) {
                    targetColor = color;
                    targetOwned = ids;
                    break;
                }
            }
        }

        if (!targetColor) return null;

        const group = C.COLOR_GROUPS[targetColor] || [];
        const missing = group.filter(id => !bot.properties.includes(id));

        if (missing.length === 0) return null;

        const targetFieldId = missing[0];
        const targetField = this.board.find(f => f.id === targetFieldId);
        if (!targetField) return null;

        const targetPlayer = this.players.find(p =>
            p.id !== bot.id &&
            p.properties.includes(targetFieldId) &&
            !p.bankrupt && !p.left && !p.kicked
        );

        if (!targetPlayer) return null;

        const offerable = bot.properties
            .filter(id => !targetOwned.includes(id))
            .filter(id => !bot.houses[id] || bot.houses[id] === 0)
            .map(id => this.board.find(f => f.id === id))
            .filter(f => f);

        if (offerable.length === 0) return null;

        const offerField = offerable.sort((a, b) => a.cost - b.cost)[0];

        const valueDiff = targetField.cost - offerField.cost;
        let offerMoney = 0;

        if (valueDiff > 0) {
            offerMoney = Math.min(valueDiff + 20, Math.floor(bot.money * 0.3));
        }

        if (bot.money < offerMoney) return null;

        return {
            targetPlayerId: targetPlayer.id,
            offerFieldIds: [offerField.id],
            requestFieldIds: [targetFieldId],
            offerMoney: offerMoney,
            requestMoney: 0
        };
    }

    async processBotProposeTrade(botId) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return null;

        const proposal = this.botShouldProposeTrade(bot);
        if (!proposal) return null;

        await this.botSleep(2000 + Math.random() * 3000);

        console.log(`🤖 ${bot.name}: siūlo prekybą`);

        const result = this.tradingLogic.proposeTrade(
            botId,
            proposal.targetPlayerId,
            proposal.offerFieldIds,
            proposal.requestFieldIds,
            proposal.offerMoney,
            proposal.requestMoney
        );

        if (result.error) {
            console.log(`🤖 ${bot.name}: prekybos klaida:`, result.error);
            return null;
        }

        return {
            botId: botId,
            botName: bot.name,
            result: result
        };
    }

    botShouldAcceptBotTrade(botId, trade) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return false;
        return this.botShouldAcceptTrade(botId, trade);
    }

    botShouldVoteKick(botId, voteKick) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return null;

        if (voteKick.targetId === botId) return null;

        if (voteKick.votes[botId] !== undefined) return null;

        const target = this.getPlayerById(voteKick.targetId);
        if (!target) return null;

        const targetWealth = target.money + target.properties.reduce((sum, id) => {
            const field = this.board.find(f => f.id === id);
            return sum + (field ? field.cost : 0);
        }, 0);

        const targetHouses = target.houses ? Object.values(target.houses).reduce((a, b) => a + b, 0) : 0;

        const isThreat = targetWealth > bot.money * 1.5 || targetHouses >= 5;

        if (isThreat) {
            return true;
        }

        return false;
    }

    async processBotVoteKick(botId) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return null;

        if (!this.activeVoteKick) return null;

        await this.botSleep(1500 + Math.random() * 3000);
        // Kol botas „galvojo“, balsavimas galėjo jau baigtis
        if (!this.activeVoteKick || bot.bankrupt || bot.left || bot.kicked) return null;

        const vote = this.botShouldVoteKick(botId, this.activeVoteKick);
        if (vote === null) return null;

        console.log(`🤖 ${bot.name}: balsuoja ${vote ? 'UŽ' : 'PRIEŠ'}`);

        const result = this.voteKick(botId, vote);

        return {
            botId: botId,
            botName: bot.name,
            vote: vote,
            result: result
        };
    }

    // 💬 Botų frazės – iš lang/lt.json (raktai bot.<įvykis>.1, .2 …)
    getBotChatMessage(bot, event, data = {}) {
        const key = Lpick('bot.' + event);
        if (!key) return null;
        return L(key, data);
    }
    getBotChatKey(event) { return Lpick('bot.' + event); }

    botShouldChat(bot, event) {
        if (!bot || !bot.isBot) return false;
        return Math.random() < 0.3;
    }

    sendBotChat(botId, event, data = {}) {
        const bot = this.getPlayerById(botId);
        if (!bot || !bot.isBot) return null;

        if (!this.botShouldChat(bot, event)) return null;

        const message = this.getBotChatMessage(bot, event, data);
        if (!message) return null;

        console.log(`💬 ${bot.name}: ${message}`);

        return {
            player: bot.name,
            color: bot.color,
            message: message,
            timestamp: new Date().toISOString(),
            isBot: true
        };
    }

    async botTurn(botId, emitFunction) {
        const bot = this.getPlayerById(botId);

        if (!bot || !bot.isBot) {
            return { error: L('srv.game.ne_botas') };
        }

        if (this.currentTurn !== botId) {
            return { error: L('srv.game.ne_boto_eile') };
        }

        if (!this.gameStarted) {
            return { error: L('srv.game.zaidimas_neprasidejes') };
        }

        if (bot.bankrupt || bot.left || bot.kicked) {
            return { error: L('srv.game.botas_neaktyvus') };
        }

        if (this.waitingForBuy) {
            console.log(`⏳ Botas ${bot.name}: laukiama pirkimo sprendimo`);
            return { error: L('srv.game.laukiama_pirkimo_sprendimo') };
        }

        if (bot.money >= 0 && bot.isDebtor === true) {
            console.log(`✅ ${bot.name}: isDebtor → false (money: €${bot.money})`);
            bot.isDebtor = false;
        }

        if (bot.money < 0) {
            console.log(`🤖 ${bot.name}: skolingas €${Math.abs(bot.money)}`);

            const housesToDemolish = Object.keys(bot.houses)
                .filter(id => bot.houses[id] > 0)
                .map(id => parseInt(id));

            if (housesToDemolish.length > 0) {
                housesToDemolish.sort((a, b) => (bot.houses[a] || 0) - (bot.houses[b] || 0));

                const fieldId = housesToDemolish[0];
                const field = this.board.find(f => f.id === fieldId);

                console.log(`🤖 ${bot.name}: bando griauti namą ant ${field ? field.name : fieldId}`);

                const result = this.demolishHouse(bot.id, fieldId);
                console.log(`🤖 ${bot.name} nugriovė namą:`, result);
                await this.botSleep(1500);

                if (bot.money >= 0) {
                    return { action: 'demolished', message: L('srv.game.nugriove_nama', { bot: bot.name }) };
                }

                console.log(`🤖 ${bot.name}: vis dar minuse (€${bot.money}), tęsia...`);
            }

            const sellable = bot.properties
                .filter(id => !bot.houses[id] || bot.houses[id] === 0)
                .map(id => this.board.find(f => f.id === id))
                .filter(f => f)
                .sort((a, b) => a.cost - b.cost);

            if (sellable.length > 0) {
                console.log(`🤖 ${bot.name}: bando parduoti ${sellable[0].name}`);

                const result = this.sellToBank(bot.id, [sellable[0].id], false);
                console.log(`🤖 ${bot.name} pardavė sklypą:`, result);
                await this.botSleep(1500);

                if (bot.money >= 0) {
                    return { action: 'sold', message: L('srv.game.pardave_turta', { bot: bot.name }) };
                }
            }

            console.log(`🤖 ${bot.name}: NEGALI IŠEITI IŠ MINUSO – bankrutuoja!`);
            const result = this.bankruptPlayer(bot.id);
            return { action: 'bankrupt', result };
        }

        if (bot.inJail) {
            if (bot.money >= C.JAIL_FINE * 2) {
                console.log(`🤖 ${bot.name}: moka €${C.JAIL_FINE} iš kalėjimo`);
                this.payJailFine(bot.id);
                await this.botSleep(1000);
                return { action: 'paid_jail', message: L('srv.game.isejo_is_kalejimo', { bot: bot.name }) };
            }

            console.log(`🤖 ${bot.name}: meta kauliukus kalėjime (bandymas ${(bot.jailTurns || 0) + 1}/3)`);
            const rollResult = this.rollDice(botId, null);

            if (rollResult.error) {
                console.log(`🤖 ${bot.name}: klaida metant:`, rollResult.error);
                return { error: rollResult.error };
            }

            await this.botSleep(1000);

            return {
                action: 'jail_roll',
                rollResult,
                message: L('srv.game.mete_kauliukus_kalejime', { bot: bot.name })
            };
        }

        await this.botSleep(500);

        console.log(`🤖 ${bot.name}: meta kauliukus`);
        const rollResult = this.rollDice(botId, null);

        if (rollResult.error) {
            console.log(`🤖 ${bot.name}: klaida metant kauliukus:`, rollResult.error);
            return { error: rollResult.error };
        }

        if (this.currentTurn !== botId) {
            console.log(`🤖 ${bot.name}: ėjimas baigtas (eilė perduota)`);
            return {
                action: 'ended',
                rollResult,
                message: L('srv.game.baige_ejima', { bot: bot.name })
            };
        }

        if (this.waitingForBuy) {
            await this.botSleep(1500);

            const field = this.board[bot.position];
            const shouldBuy = this.botShouldBuyProperty(bot, field);

            if (shouldBuy) {
                console.log(`🤖 ${bot.name}: perka ${field.name}`);
                const buyResult = this.buyProperty(bot.id);
                return {
                    action: 'bought',
                    field: field.name,
                    result: buyResult,
                    rollResult
                };
            } else {
                console.log(`🤖 ${bot.name}: atsisako pirkti ${field.name}`);
                const cancelResult = this.cancelBuy(bot.id);
                return {
                    action: 'cancelled',
                    field: field.name,
                    result: cancelResult,
                    rollResult
                };
            }
        }

        await this.botSleep(500);

        const currentField = this.board[bot.position];
        if (currentField && currentField.type === 'property' && currentField.color) {
            if (this.botShouldBuildHouse(bot, currentField.id)) {
                console.log(`🤖 ${bot.name}: stato namą ant ${currentField.name}`);
                const buildResult = this.buildHouse(bot.id, currentField.id);
                return {
                    action: 'built',
                    field: currentField.name,
                    result: buildResult,
                    rollResult
                };
            }
        }

        return {
            action: 'roll',
            rollResult,
            message: L('srv.game.baige_ejima', { bot: bot.name })
        };
    }

    // 🆕 Paleisti turn timer
    startTurnTimer() {
        this.clearTurnTimer();
        this._idleSince = 0;

        const currentPlayer = this.getPlayerById(this.currentTurn);
        if (!currentPlayer || currentPlayer.isBot) return;

        const duration = this.getTurnDurationFor(currentPlayer);
        this.turnPhaseStart = Date.now();   // ⏱️ nuo čia skaičiuojama 3 min riba
        this.turnPausedAt = null;
        this.armTurnTimer(duration);
    }

    armTurnTimer(ms) {
        if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
        this.turnTimerEndTime = Date.now() + ms;
        this.turnTimer = setTimeout(() => {
            console.log(`⏰ Turn timeout – auto-roll (player ${this.currentTurn})`);
            this.autoRollDice();
        }, ms);
    }

    // ============================================
    // ⏱️ ĖJIMO LAIKMATIS PO VEIKSMŲ
    // Po statybų, griovimo, pardavimo, aukciono, mainų – vėl pilnas laikas (bet ne ilgiau nei 3 min nuo
    // ėjimo pradžios). Kol vyksta aukcionas ar laukiama atsakymo į mainus – laikmatis sustoja.
    // ============================================
    canAdjustTurnTimer() {
        if (!this.gameStarted || this.gameFinished) return false;
        if (this.isRolling || this.waitingForBuy || this.waitingForTaxi || this.waitingForBuild || this.waitingForWheel ||
            this.pendingFieldPlayerId !== null && this.pendingFieldPlayerId !== undefined) return false;
        const p = this.getPlayerById(this.currentTurn);
        if (!p || p.isBot || p.bankrupt || p.left || p.kicked || !p.isActive) return false;
        return true;
    }

    shouldPauseTurnTimer() {
        const T = this.tradingLogic;
        if (!T) return false;
        if ([...T.auctions.values()].some(a => a && a.isActive)) return true;
        const pid = this.currentTurn, now = Date.now();
        for (const tr of T.trades.values()) {
            if (tr && tr.status === 'pending' && (tr.fromPlayer === pid || tr.toPlayer === pid) &&
                now - (tr.timestamp || 0) < C.TRADE_PAUSE_MAX_MS) return true;
        }
        return false;
    }

    // isAction – žaidėjas savo eilėje atliko veiksmą (statė, siūlė, pardavė…)
    updateTurnTimerAfterAction(actorId, isAction) {
        if (!this.canAdjustTurnTimer()) return false;
        const emit = () => { if (this.emitFunction) this.emitFunction('gameState', this.getGameState()); };
        if (this.shouldPauseTurnTimer()) {
            if (!this.turnPausedAt) {
                this.clearTurnTimer();
                this.turnPausedAt = Date.now();
                emit();
                return true;
            }
            return false;
        }
        if (this.turnPausedAt) {
            // pauzės laikas į 3 min ribą neskaičiuojamas
            this.turnPhaseStart = (this.turnPhaseStart || Date.now()) + (Date.now() - this.turnPausedAt);
            this.turnPausedAt = null;
            this.touchTurnTimer(true);
            emit();
            return true;
        }
        if (isAction && actorId === this.currentTurn && this.turnTimer) {
            if (this.touchTurnTimer(false)) { emit(); return true; }
        }
        return false;
    }

    touchTurnTimer(afterPause) {
        const p = this.getPlayerById(this.currentTurn);
        if (!p) return false;
        const now = Date.now();
        const full = this.getTurnDurationFor(p);
        const capLeft = (this.turnPhaseStart || now) + C.TURN_MAX_MS - now;
        const curLeft = this.turnTimerEndTime ? this.turnTimerEndTime - now : 0;
        let ms = Math.min(full, capLeft);
        if (afterPause) ms = Math.max(ms, C.TURN_RESUME_MIN_MS);   // po aukciono / mainų – bent šiek tiek laiko
        if (!afterPause && ms <= curLeft + 500) return false;      // laiko netrumpinam
        this.armTurnTimer(Math.max(1000, ms));
        return true;
    }

    // ============================================
    // 🏗️ STATYBŲ LANGAS (15 s po sustojimo)
    // ============================================
    canBuildAnything(playerId) {
        const p = this.getPlayerById(playerId);
        if (!p || !p.properties || p.properties.length === 0) return false;
        return p.properties.some(id => this.buildingLogic.canBuildHouse(playerId, id).can);
    }

    clearBuildWindowTimer() {
        if (this.buildWindowTimer) { clearTimeout(this.buildWindowTimer); this.buildWindowTimer = null; }
    }

    restartBuildWindow(playerId) {
        this.clearBuildWindowTimer();
        this.waitingForBuild = { playerId, deadline: Date.now() + C.BUILD_WINDOW_MS };
        this.buildWindowTimer = setTimeout(() => {
            this.buildWindowTimer = null;
            if (this.waitingForBuild && this.waitingForBuild.playerId === playerId) {
                this.finishBuildWindow(playerId, 'timeout');
            }
        }, C.BUILD_WINDOW_MS);
        const p = this.getPlayerById(playerId);
        // Ar po lango žaidėjas dar mes (dublis)? – mygtukas „Mesti kauliukus“ vietoj „Baigti ėjimą“
        this.waitingForBuild.rollAgain = !!(this.doubleRoll && p && !p.inJail && !p.bankrupt);
        if (this.emitFunction) {
            this.emitFunction('buildWindow', { playerId, playerName: p ? p.name : '', ms: C.BUILD_WINDOW_MS, rollAgain: this.waitingForBuild.rollAgain });
        }
    }

    // 🏗️ 15 s statybų langas po metimo:
    //   1 taisyklė – tik ką tik nusipirkus paskutinį tos gatvės sklypą (statyti galima ir prieš kiekvieną metimą);
    //   2 ir 3 taisyklės – atsistojus ant savo pilnos gatvės sklypo (tik tada ir galima statyti).
    //   Visada – tik jei pinigų užtenka bent vienam namui.
    openBuildWindow(player, opts = {}) {
        if (!player || player.bankrupt || player.inJail || player.left || player.kicked) return false;
        if (this.currentTurn !== player.id) return false;
        // 🎲 Po dublio lango nėra – žaidėjas dar mes, statyti gali įprastu mygtuku (ėjimo laiko užtenka)
        if (this.doubleRoll) return false;
        if ((this.buildRule || 2) === 1) {
            const bought = opts.boughtFieldId;
            if (bought === undefined || bought === null) return false;
            if (!this.buildingLogic.hasFullGroup(player.id, bought)) return false;
        }
        // AFK ar atsijungęs – statybų lango nėra, kad žaidimas nestovėtų
        if (!player.isBot && (player.disconnected || (player.afkAutoMoves || 0) > 0)) return false;
        this.isRolling = false;
        if (!this.canBuildAnything(player.id)) return false;
        this.clearTurnTimer();
        this.restartBuildWindow(player.id);
        if (player.isBot) setTimeout(() => this.botBuildWindow(player.id), 1200);
        return true;
    }

    // Po kiekvieno pastatyto namo: laikas iš naujo arba (nieko nebeliko) ėjimas toliau
    afterBuiltInWindow(playerId) {
        if (!this.waitingForBuild || this.waitingForBuild.playerId !== playerId) return;
        if (this.canBuildAnything(playerId)) this.restartBuildWindow(playerId);
        else this.finishBuildWindow(playerId, 'done');
    }

    finishBuildWindow(playerId, reason = 'manual') {
        const player = this.getPlayerById(playerId);
        if (!this.waitingForBuild || this.waitingForBuild.playerId !== playerId) return { error: L('srv.game.statybu_laikas_nevyksta') };
        this.clearBuildWindowTimer();
        this.waitingForBuild = null;
        if (player && this.currentTurn === playerId) {
            if (this.doubleRoll && !player.inJail && !player.bankrupt) {
                this.isRolling = false;
                this.startTurnTimer();
                this.addMessageKey('game.doubleRollAgain', { player: player.name });
            } else {
                this.endTurn();
            }
        }
        if (this.emitFunction) {
            this.emitFunction('buildWindowClosed', { playerId, reason });
            this.emitFunction('gameState', this.getGameState());
        }
        return { success: true };
    }

    botBuildWindow(botId) {
        const bot = this.getPlayerById(botId);
        for (let guard = 0; guard < 12; guard++) {
            if (!bot || !this.waitingForBuild || this.waitingForBuild.playerId !== botId) return;
            const pick = bot.properties.find(id =>
                this.buildingLogic.canBuildHouse(botId, id).can && this.botShouldBuildHouse(bot, id));
            if (pick === undefined) break;
            const r = this.buildHouse(botId, pick);
            if (!r || r.error) break;
            if (this.emitFunction) {
                this.emitFunction('gameState', this.getGameState());
                if (r.message) this.emitFunction('message', r.message);
            }
        }
        if (this.waitingForBuild && this.waitingForBuild.playerId === botId) this.finishBuildWindow(botId, 'bot');
    }

    // ============================================
    // 🚕 TAKSI
    // ============================================
    clearTaxiTimer() {
        if (this.taxiTimer) { clearTimeout(this.taxiTimer); this.taxiTimer = null; }
    }

    offerTaxi(player, opts = {}) {
        const free = !!opts.free;   // 🎡 iš laimės rato – nemokamas
        const cost = free ? 0 : C.TAXI_COST;
        const forbidden = free ? [...C.TAXI_FORBIDDEN, C.WHEEL_FIELD_ID] : C.TAXI_FORBIDDEN;
        if (!player || player.money < cost) return false;
        this.isRolling = false;
        this.clearTurnTimer();
        let dur = C.TAXI_TIMEOUT;
        if (player.disconnected) dur = 3000;
        else if (!player.isBot && typeof this.getAfkLevel === 'function' && this.getAfkLevel(player) > 0) {
            dur = this.getBuyDurationFor(player);
        }
        this.waitingForTaxi = { playerId: player.id, deadline: Date.now() + dur, cost, forbidden };
        this.clearTaxiTimer();
        this.taxiTimer = setTimeout(() => {
            this.taxiTimer = null;
            if (this.waitingForTaxi && this.waitingForTaxi.playerId === player.id) {
                console.log(`🚕 ${player.name}: taksi laikas baigėsi – lieka vietoje`);
                this.taxiDecline(player.id, true);
            }
        }, dur);
        if (this.emitFunction) {
            this.emitFunction('taxiOffer', {
                playerId: player.id,
                playerName: player.name,
                cost,
                durationMs: dur,
                forbidden
            });
        }
        if (player.isBot) {
            setTimeout(() => this.botTaxiDecision(player.id), 1800);
        }
        return true;
    }

    // 🧪 TESTAS: perkelti žaidėją ant TAKSI (veikia tik su BANCRUPT_TEST=1)
    debugToTaxi(playerId) {
        return this.debugToField(playerId, C.TAXI_FIELD_ID);
    }

    // 🧪 TESTAS: perkelti žaidėją ant nurodyto langelio ir apdoroti jį kaip įprastai (tik su BANCRUPT_TEST=1)
    debugToField(playerId, target) {
        if (!(typeof process !== 'undefined' && process.env && process.env.BANCRUPT_TEST === '1')) return { error: L('srv.game.testavimas_isjungtas') };
        const player = this.getPlayerById(playerId);
        if (!player || this.currentTurn !== playerId) return { error: L('srv.game.ne_tavo_eile') };
        if (this.isRolling || this.waitingForBuy || this.pendingFieldPlayerId || this.waitingForTaxi || this.waitingForBuild || this.waitingForWheel) {
            return { error: L('srv.game.palauk_kol_baigsis_veiksmas') };
        }
        if (player.inJail) return { error: L('srv.game.esi_kalejime') };
        const from = player.position;
        this.clearTurnTimer();
        this.doubleRoll = false;
        const to = parseInt(target, 10);
        if (!Number.isInteger(to) || to < 0 || to >= this.board.length) return { error: L('srv.game.neteisingas_langelis') };
        player.position = to;
        this.pendingFieldPlayerId = playerId;
        if (this.emitFunction) {
            this.emitFunction('debugMove', { playerId: player.id, from, to });
        }
        setTimeout(() => this.finishTaxiRide(playerId), 900 + ((to - from + 52) % 52) * 70);
        return { success: true };
    }

    taxiRide(playerId, target) {
        const player = this.getPlayerById(playerId);
        if (!player) return { error: L('srv.game.zaidejas_nerastas') };
        if (!this.waitingForTaxi || this.waitingForTaxi.playerId !== playerId || this.currentTurn !== playerId) {
            return { error: L('srv.game.taksi_tau_dabar_nelaukia') };
        }
        const to = parseInt(target, 10);
        if (!Number.isInteger(to) || to < 0 || to >= this.board.length) return { error: L('srv.game.neteisingas_langelis') };
        const cost = Number.isFinite(this.waitingForTaxi.cost) ? this.waitingForTaxi.cost : C.TAXI_COST;
        if ((this.waitingForTaxi.forbidden || C.TAXI_FORBIDDEN).includes(to)) return { error: L('srv.game.si_langeli_taksi_nevaziuoja') };
        if (player.money < cost) return { error: L('srv.game.neuztenka_pinigu_taksi_reikia', { TAXI_COST: cost }) };

        this.clearTaxiTimer();
        this.waitingForTaxi = null;
        player.money -= cost;

        const from = player.position;
        const len = this.board.length;
        const steps = (to - from + len) % len;
        // Važiuojama tik pirmyn: pravažiavus START – €200 (sustojus ant START – €300 per processField)
        const passedStart = to !== 0 && to < from;
        if (passedStart) {
            player.money += C.START_BONUS;
            this.addMessageKey('game.passedStart', { player: player.name, bonus: C.START_BONUS });
        }
        player.position = to;
        this.lastActivity = Date.now();
        this.addMessageKey(cost > 0 ? 'game.taxiRide' : 'game.taxiRideFree', { player: player.name, field: this.board[to].name, cost });
        this.turnHistory.push({ player: player.name, action: 'taxi', from, to, cost, timestamp: new Date().toISOString() });

        this.isRolling = false;
        this.pendingFieldPlayerId = playerId;
        const rideMs = 1600 + steps * 70;
        if (this.emitFunction) {
            this.emitFunction('taxiRide', {
                playerId, playerName: player.name, from, to, steps, cost,
                passedStart, fieldName: this.board[to].name
            });
            this.emitFunction('gameState', this.getGameState());
        }
        setTimeout(() => this.finishTaxiRide(playerId), rideMs);
        return { success: true, from, to, steps };
    }

    finishTaxiRide(playerId) {
        if (this.pendingFieldPlayerId !== playerId) return;
        this.pendingFieldPlayerId = null;
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt) return;
        const result = this.processField(playerId);
        if (!result || result.error || !this.emitFunction) return;
        this.emitFunction('fieldResult', result);
        this.emitFunction('gameState', this.getGameState());
        if (result.messageKey) this.emitFunction('message', { key: result.messageKey, data: result.messageData || {} });
        else if (result.message) this.emitFunction('message', result.message);

        // Botas taksi nuvažiavo prie sklypo – nusprendžia, ar pirkti
        if (player.isBot && result.canBuy) {
            setTimeout(() => {
                if (!this.waitingForBuy || this.currentTurn !== playerId) return;
                const field = this.board[player.position];
                if (this.botShouldBuyProperty(player, field)) this.buyProperty(playerId);
                else this.cancelBuy(playerId);
                if (this.emitFunction) this.emitFunction('gameState', this.getGameState());
            }, 1500);
        }
    }

    taxiDecline(playerId, isTimeout = false) {
        const player = this.getPlayerById(playerId);
        if (!player) return { error: L('srv.game.zaidejas_nerastas') };
        if (!this.waitingForTaxi || this.waitingForTaxi.playerId !== playerId) return { error: L('srv.game.taksi_tau_dabar_nelaukia') };
        this.clearTaxiTimer();
        this.waitingForTaxi = null;
        this.addMessageKey('game.taxiDeclined', { player: player.name });

        // 🏗️ Liko vietoje – jei galima statyti (1 taisyklė), duodama 15 s
        if (!isTimeout && this.openBuildWindow(player)) {
            if (this.emitFunction) {
                this.emitFunction('taxiClosed', { playerId, timeout: false });
                this.emitFunction('message', { key: 'game.taxiDeclined', data: { player: player.name } });
                this.emitFunction('gameState', this.getGameState());
            }
            return { success: true, buildWindow: true };
        }

        // Toliau – kaip po paprasto ėjimo: dublis → meta dar kartą, kitaip eilė pereina
        if (this.doubleRoll && !player.inJail && this.currentTurn === playerId) {
            this.isRolling = false;
            this.startTurnTimer();
            this.addMessageKey('game.doubleRollAgain', { player: player.name });
        } else if (this.currentTurn === playerId) {
            this.endTurn();
        }
        if (this.emitFunction) {
            this.emitFunction('taxiClosed', { playerId, timeout: isTimeout });
            this.emitFunction('message', { key: 'game.taxiDeclined', data: { player: player.name } });
            this.emitFunction('gameState', this.getGameState());
        }
        return { success: true };
    }

    botTaxiDecision(botId) {
        const bot = this.getPlayerById(botId);
        if (!bot || !this.waitingForTaxi || this.waitingForTaxi.playerId !== botId) return;
        const len = this.board.length;
        const owned = new Set();
        this.players.forEach(p => { if (!p.bankrupt && !p.kicked) p.properties.forEach(id => owned.add(id)); });
        const tcost = Number.isFinite(this.waitingForTaxi.cost) ? this.waitingForTaxi.cost : C.TAXI_COST;
        const tforb = this.waitingForTaxi.forbidden || C.TAXI_FORBIDDEN;
        const budget = bot.money - tcost - 150;
        let best = null, bestScore = -1;
        this.board.forEach(f => {
            if (tforb.includes(f.id) || owned.has(f.id) || !f.cost || f.cost > budget) return;
            if (!['property', 'service1', 'service2', 'service3'].includes(f.type)) return;
            let score = 1;
            if (f.color && C.COLOR_GROUPS[f.color]) {
                const g = C.COLOR_GROUPS[f.color];
                score += g.filter(id => bot.properties.includes(id)).length * 3;   // padeda užbaigti gatvę
            }
            if (score > bestScore) { bestScore = score; best = f; }
        });
        if (best && (bestScore > 1 || Math.random() < 0.5)) {
            console.log(`🤖🚕 ${bot.name}: važiuoja taksi į ${best.name}`);
            this.taxiRide(botId, best.id);
        } else {
            this.taxiDecline(botId, false);
        }
    }

    // ============================================
    // 🎡 LAIMĖS RATAS (4 langelis)
    // ============================================
    clearWheelTimer() {
        if (this.wheelTimer) { clearTimeout(this.wheelTimer); this.wheelTimer = null; }
    }

    offerWheel(player) {
        this.isRolling = false;
        this.clearTurnTimer();
        let dur = C.WHEEL_TIMEOUT;
        if (player.disconnected) dur = 3000;
        else if (!player.isBot && typeof this.getAfkLevel === 'function' && this.getAfkLevel(player) > 0) {
            dur = Math.min(dur, this.getBuyDurationFor(player));
        }
        this.waitingForWheel = { playerId: player.id, deadline: Date.now() + dur, spinning: false, index: null, spinMs: 0, spinStart: 0, jitter: 0, from: player.position };
        this.clearWheelTimer();
        this.wheelTimer = setTimeout(() => {
            this.wheelTimer = null;
            if (this.waitingForWheel && this.waitingForWheel.playerId === player.id && !this.waitingForWheel.spinning) {
                console.log(`🎡 ${player.name}: laikas baigėsi – ratas sukamas automatiškai`);
                this.spinWheel(player.id, true);
            }
        }, dur);
        if (this.emitFunction) {
            this.emitFunction('wheelOffer', { playerId: player.id, playerName: player.name, durationMs: dur, sectors: C.WHEEL_SECTORS });
        }
        if (player.isBot) setTimeout(() => this.spinWheel(player.id, false), 1500);
        return true;
    }

    spinWheel(playerId, auto = false) {
        const w = this.waitingForWheel;
        if (!w || w.playerId !== playerId || this.currentTurn !== playerId) return { error: L('srv.game.ratas_tau_nelaukia') };
        if (w.spinning) return { error: L('srv.game.ratas_jau_sukasi') };
        const player = this.getPlayerById(playerId);
        if (!player) return { error: L('srv.game.zaidejas_nerastas') };
        this.clearWheelTimer();
        const n = C.WHEEL_SECTORS.length;
        w.index = Math.floor(Math.random() * n);            // visi sektoriai vienodai tikėtini
        w.spinMs = C.WHEEL_SPIN_MIN_MS + Math.floor(Math.random() * (C.WHEEL_SPIN_MAX_MS - C.WHEEL_SPIN_MIN_MS + 1));
        w.jitter = Math.round((Math.random() * 0.7 - 0.35) * 100) / 100;   // kur sektoriaus viduje sustos rodyklė
        w.spinning = true;
        w.spinStart = Date.now();
        this.lastActivity = Date.now();
        if (this.emitFunction) {
            this.emitFunction('wheelSpin', { playerId, playerName: player.name, index: w.index, spinMs: w.spinMs, jitter: w.jitter, auto: !!auto });
            this.emitFunction('gameState', this.getGameState());
        }
        this.wheelTimer = setTimeout(() => { this.wheelTimer = null; this.applyWheel(playerId); }, w.spinMs + 700);
        return { success: true };
    }

    applyWheel(playerId) {
        const w = this.waitingForWheel;
        if (!w || w.playerId !== playerId || !w.spinning) return;
        this.waitingForWheel = null;
        this.clearWheelTimer();
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt || player.left || player.kicked) return;
        const s = C.WHEEL_SECTORS[w.index] || { type: 'nothing' };
        const others = this.players.filter(p => p.id !== playerId && !p.bankrupt && !p.left && !p.kicked);
        let key = 'game.wheelNothing';
        const data = { player: player.name, amount: Math.abs(s.amount || 0), total: 0 };
        const from = player.position;

        if (s.type === 'money') {
            player.money += s.amount;
            key = s.amount >= 0 ? 'game.wheelWin' : 'game.wheelLose';
        } else if (s.type === 'collect') {
            others.forEach(o => { o.money -= s.amount; player.money += s.amount; data.total += s.amount; this.checkDebtor(o.id); });
            key = 'game.wheelCollect';
        } else if (s.type === 'pay_each') {
            others.forEach(o => { o.money += s.amount; player.money -= s.amount; data.total += s.amount; this.checkDebtor(o.id); });
            key = 'game.wheelPayEach';
        } else if (s.type === 'jail') {
            player.position = 16;
            player.inJail = true;
            player.jailTurns = 0;
            player.consecutiveDoubles = 0;
            this.doubleRoll = false;
            key = 'game.wheelJail';
        } else if (s.type === 'taxi') {
            key = 'game.wheelTaxi';
        }
        this.checkDebtor(player.id);

        this.addMessageKey(key, data);
        this.turnHistory.push({ player: player.name, action: 'wheel', sector: s.type, amount: s.amount || 0, timestamp: new Date().toISOString() });
        if (this.emitFunction) {
            this.emitFunction('wheelResult', { playerId, playerName: player.name, index: w.index, sector: s, key, data, from, to: player.position });
            this.emitFunction('message', { key, data });
        }

        if (s.type === 'jail') {
            this.endTurn();
        } else if (s.type === 'taxi' && this.offerTaxi(player, { free: true })) {
            // nemokamas taksi – toliau tęsia taksi pasirinkimas
        } else if (this.openBuildWindow(player)) {
            // statybų langas pats tęs ėjimą
        } else if (this.doubleRoll && !player.inJail && this.currentTurn === playerId) {
            this.isRolling = false;
            this.startTurnTimer();
            this.addMessageKey('game.doubleRollAgain', { player: player.name });
        } else if (this.currentTurn === playerId) {
            this.endTurn();
        }
        if (this.emitFunction) this.emitFunction('gameState', this.getGameState());
    }

    // 🛡️ Atsarginė apsauga: jei žmogaus eilė, niekas nevyksta, o laikmatis neveikia – paleidžiam
    // (kad žaidimas niekada neužstrigtų be galo)
    ensureTurnTimer() {
        if (!this.gameStarted || this.gameFinished) return;
        // ⏸️ Aukcionas / mainai: sustabdyti arba vėl paleisti ėjimo laikmatį
        if (this.turnPausedAt || (this.turnTimer && this.canAdjustTurnTimer() && this.shouldPauseTurnTimer())) {
            this.updateTurnTimerAfterAction(null, false);
            return;
        }
        if (this.turnTimer || this.isRolling || this.waitingForBuy || this.pendingFieldPlayerId || this.waitingForTaxi || this.waitingForBuild || this.waitingForWheel) return;
        const p = this.getPlayerById(this.currentTurn);
        if (!p || p.isBot || p.bankrupt || p.left || p.kicked || !p.isActive) return;
        if (!this._idleSince) { this._idleSince = Date.now(); return; }
        if (Date.now() - this._idleSince < 8000) return;
        this._idleSince = 0;
        console.warn(`🛡️ ${p.name}: ėjimo laikmatis neveikė – paleidžiam iš naujo`);
        this.startTurnTimer();
        if (this.emitFunction) this.emitFunction('gameState', this.getGameState());
    }

    // 🆕 Atšaukti turn timer
    clearTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
            this.turnTimerEndTime = null;
        }
    }

    // 🆕 Auto-roll po timeout
    autoRollDice() {
    const currentPlayer = this.getPlayerById(this.currentTurn);
    if (!currentPlayer || currentPlayer.isBot) return;
    if (!currentPlayer.isActive || currentPlayer.bankrupt || currentPlayer.left || currentPlayer.kicked) return;
    if (this.isRolling) return;
    // 🛡️ Dar laukiama pirkimo / taksi / statybų sprendimo arba langelis neapdorotas – metimas ne dabar
    // (tas langas pats tęs žaidimą; AFK ėjimas neskaičiuojamas)
    if (this.waitingForBuy || this.waitingForTaxi || this.waitingForBuild || this.waitingForWheel ||
        this.pendingFieldPlayerId === currentPlayer.id) {
        console.log(`⏭️ Auto-roll praleistas (${currentPlayer.name}): laukiama sprendimo / langelio apdorojimo`);
        return;
    }

    // 🆕 AFK: ėjimai daromi automatiškai jau 10 min. be pertraukos – priverstinis bankrotas
    // (taikoma tik kai naršyklė atidaryta; uždarytai naršyklei – 10 min. atsijungimo taisyklė)
    if (!currentPlayer.afkSince) currentPlayer.afkSince = Date.now();
    if (!currentPlayer.disconnected && Date.now() - currentPlayer.afkSince >= C.AFK_BANKRUPT_MS) {
        console.log(`💀 ${currentPlayer.name}: ${Math.round(C.AFK_BANKRUPT_MS / 60000)} min. automatinių ėjimų – priverstinis bankrotas`);
        this.forceBankrupt(currentPlayer.id, 'afk');
        return;
    }
    currentPlayer.afkAutoMoves = (currentPlayer.afkAutoMoves || 0) + 1;

    // 🆕 Jei AFK ir minuse – auto-parduoti turtą, kol išeis iš minuso
    if (currentPlayer.isDebtor && currentPlayer.money < 0) {
        console.log(`🤖 AFK + isDebtor: ${currentPlayer.name} (€${currentPlayer.money}) – auto-parduodam turtą`);
        
        // ============================================
        // 1. PIRMA – nugriauti namus (nuo pigiausio sklypo)
        // ============================================
        let housesToDemolish = [];
        for (const fieldId in currentPlayer.houses) {
            const count = currentPlayer.houses[fieldId];
            if (count > 0) {
                const field = this.board.find(f => f.id === parseInt(fieldId));
                if (field) {
                    housesToDemolish.push({
                        fieldId: parseInt(fieldId),
                        field: field,
                        houses: count,
                        cost: field.cost
                    });
                }
            }
        }
        
        // Rikiuoti pagal sklypo kainą (pigiausias pirmas)
        housesToDemolish.sort((a, b) => a.cost - b.cost);
        
        // Griauti po vieną namą, kol išeis iš minuso
        for (const item of housesToDemolish) {
    while (currentPlayer.houses[item.fieldId] > 0 && currentPlayer.money < 0) {
        const result = this.demolishHouse(currentPlayer.id, item.fieldId, true); 
                
                if (result.error) {
                    console.log(`⚠️ ${currentPlayer.name}: griovimo klaida:`, result.error);
                    break;
                }
                
                console.log(`🏚️ ${currentPlayer.name} auto-nugriovė namą ant ${item.field.name} už €${result.refund} → €${currentPlayer.money}`);
                
                if (currentPlayer.money >= 0) break;
            }
            
            if (currentPlayer.money >= 0) break;
        }
        
        // ============================================
// 2. TADA – parduoti sklypus be namų (nuo pigiausio)
// ============================================
if (currentPlayer.money < 0) {
    const sellable = currentPlayer.properties
        .filter(id => !currentPlayer.houses[id] || currentPlayer.houses[id] === 0)
        .map(id => this.board.find(f => f.id === id))
        .filter(f => f)
        .sort((a, b) => a.cost - b.cost);
    
    for (const field of sellable) {
        if (currentPlayer.money >= 0) break;
        
        const result = this.sellToBank(currentPlayer.id, [field.id], true);  // ← true = antstoliai
        
        if (result.error) {
            console.log(`⚠️ ${currentPlayer.name}: pardavimo klaida:`, result.error);
            break;
        }
        
        console.log(`💰 ${currentPlayer.name} auto-pardavė ${field.name} už €${result.totalPrice} → €${currentPlayer.money}`);
    }
}
        
        // ============================================
        // 3. PATIKRINTI – ar pavyko išeiti iš minuso
        // ============================================
        if (currentPlayer.money < 0) {
            console.log(`💀 ${currentPlayer.name} vis dar minuse (€${currentPlayer.money}) – BANKRUTUOJA!`);
            this.forceBankrupt(currentPlayer.id, null);
            return;
        }
        
        // Išėjo iš minuso – išvalyti isDebtor
        if (currentPlayer.isDebtor) {
            currentPlayer.isDebtor = false;
            console.log(`✅ ${currentPlayer.name}: isDebtor → false po auto-pardavimo (money: €${currentPlayer.money})`);
        }
        
        if (this.emitFunction) {
            this.emitFunction('gameState', this.getGameState());
        }
    }

    console.log(`⏰ Auto-roll: ${currentPlayer.name}`);

    const result = this.rollDice(this.currentTurn, currentPlayer.socketId);

    if (result.error) {
        console.error('❌ Auto-roll klaida:', result.error);
        return;
    }

    if (this.emitFunction) {
        this.emitFunction('diceRolled', result);
        this.emitFunction('gameState', this.getGameState());

        if (result.dice && currentPlayer) {
            const rollMsg = L('srv.game.rolled_afk', { player: currentPlayer.name, d1: result.dice[0], d2: result.dice[1], total: result.total });
            this.emitFunction('message', rollMsg);
        }
    }

    // 🆕 Jei klientas neatsiųs movementFinished (uždaryta naršyklė) – apdorojam patys
    if (result.needsProcessField) {
        const pid = currentPlayer.id;
        const delay = currentPlayer.disconnected ? 2500 : 6000;
        setTimeout(() => {
            if (this.pendingFieldPlayerId === pid) {
                console.log(`🎯 Serverio processField (AFK/atsijungęs): ${pid}`);
                this.processPendingFieldServerSide(pid);
            }
        }, delay);
    }

    // ✅ Apsauga nuo isRolling užstrigimo po auto-roll
    const rolledPlayerId = currentPlayer.id;
    const rolledPlayerName = currentPlayer.name;
    const rolledSeq = this.rollSeq;
    const watchdog = (late) => {
        if (this.rollSeq !== rolledSeq) return;   // jau kitas metimas (pvz. dublis) – šis tikrinimas nebegalioja
        if (!(this.isRolling && this.currentTurn === rolledPlayerId)) return;
        // Langelis dar laukia apdorojimo (serveris jį apdoros po 6 s) – tai ne užstrigimas, palaukiam
        if (!late && this.pendingFieldPlayerId === rolledPlayerId) {
            setTimeout(() => watchdog(true), 6000);
            return;
        }
        {
            console.warn(`⚠️ isRolling užstrigo po auto-roll (${rolledPlayerName}) – atblokuojam`);
            this.isRolling = false;

            // Laikmatį paleidžiam tik jei nieko nelaukiama – kitaip jį paleis langelio apdorojimas / pirkimo langas
            if (!this.waitingForBuy && !this.waitingForTaxi && !this.waitingForBuild && !this.waitingForWheel &&
                this.pendingFieldPlayerId !== rolledPlayerId) {
                this.startTurnTimer();
            }

            if (this.emitFunction) {
                this.emitFunction('gameState', this.getGameState());
            }
        }
    };
    setTimeout(() => watchdog(false), 3000);
}

    botSleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isBotTurn() {
        const currentPlayer = this.getPlayerById(this.currentTurn);
        return currentPlayer && currentPlayer.isBot === true;
    }

    getCurrentBot() {
        const currentPlayer = this.getPlayerById(this.currentTurn);
        if (currentPlayer && currentPlayer.isBot === true) {
            return currentPlayer;
        }
        return null;
    }

    getUsedColors() {
        const playerColors = this.players
            .filter(p => !p.left && !p.bankrupt && !p.kicked)
            .map(p => p.color);

        const reservedColors = Array.from(this.reservedColors.keys())
            .filter(color => !playerColors.includes(color));

        return [...playerColors, ...reservedColors];
    }

    reserveColor(color, socketId) {
        if (!color) return { error: L('srv.game.nera_spalvos') };

        const isTaken = this.players.some(p =>
            p.color === color && !p.left && !p.bankrupt && !p.kicked
        );

        if (isTaken) {
            return { error: L('srv.game.si_spalva_jau_uzimta') };
        }

        for (const [c, data] of this.reservedColors) {
            if (data.socketId === socketId && c !== color) {
                if (data.timeout) clearTimeout(data.timeout);
                this.reservedColors.delete(c);
            }
        }

        const existing = this.reservedColors.get(color);
        if (existing && existing.timeout) {
            clearTimeout(existing.timeout);
        }

        const timeout = setTimeout(() => {
            this.reservedColors.delete(color);
            console.log(`⏰ Spalvos rezervacija baigėsi: ${color}`);

            if (this.emitFunction) {
                this.emitFunction('colorReservationExpired', { color });
            }
        }, 30000);

        this.reservedColors.set(color, {
            socketId: socketId,
            timeout: timeout,
            timestamp: Date.now()
        });

        console.log(`🎨 Spalva rezervuota: ${color} (socket: ${socketId})`);

        return { success: true, color: color };
    }

    releaseColor(color, socketId) {
        const reservation = this.reservedColors.get(color);

        if (reservation && reservation.socketId === socketId) {
            if (reservation.timeout) clearTimeout(reservation.timeout);
            this.reservedColors.delete(color);
            console.log(`🎨 Spalvos rezervacija atšaukta: ${color}`);
            return { success: true };
        }

        return { error: L('srv.game.rezervacija_nerasta') };
    }

    confirmColorReservation(color, socketId) {
        const reservation = this.reservedColors.get(color);

        if (reservation && reservation.socketId === socketId) {
            if (reservation.timeout) clearTimeout(reservation.timeout);
            this.reservedColors.delete(color);
            console.log(`🎨 Spalvos rezervacija patvirtinta: ${color}`);
            return { success: true };
        }

        return { error: L('srv.game.rezervacija_nerasta') };
    }

    getAvailableColors() {
        const used = this.getUsedColors();
        return C.PLAYER_COLORS.filter(c => !used.includes(c));
    }

    setPlayerReady(playerId, ready) {
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt || player.left || player.kicked) {
            return { error: L('srv.game.zaidejas_neaktyvus') };
        }

        if (this.gameStarted) {
            return { error: L('srv.game.zaidimas_jau_prasidejo') };
        }

        player.ready = ready === true;
        this.lastActivity = Date.now();

        // 🎲 Pasiruošė nepasirinkęs figūrėlės – parenkam atsitiktinę laisvą
        const autoPiece = player.ready ? this.ensurePiece(player) : null;

        this.addMessageKey(
            player.ready ? 'game.playerReady' : 'game.playerUnready',
            { player: player.name }
        );

        return {
            success: true,
            playerId: playerId,
            playerName: player.name,
            ready: player.ready,
            autoPiece: autoPiece
        };
    }

    canStartGame() {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length < 2) {
            return { can: false, reason: L('srv.game.reikia_bent_zaideju') };
        }

        // 👑 Stalo kūrėjas pasiruošęs automatiškai – jis pats spaudžia „Pradėti“
        const allReady = activePlayers.every(p => p.ready === true || p.isHost === true);
        if (!allReady) {
            return { can: false, reason: L('srv.game.ne_visi_zaidejai_pasiruose') };
        }

        return { can: true };
    }

    startGame(playerId) {
        const hostPlayer = this.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;

        if (playerId !== hostId) {
            return { error: L('srv.game.tik_zaidimo_kurejas_gali_pradeti') };
        }

        if (this.gameStarted) {
            return { error: L('srv.game.zaidimas_jau_prasidejo') };
        }

        const canStart = this.canStartGame();
        if (!canStart.can) {
            return { error: canStart.reason };
        }

        const activePlayers = this.getActivePlayers();

        // 🎲 Kas dar neturi figūrėlės – parenkam atsitiktinę laisvą
        const autoPieces = [];
        activePlayers.forEach(p => {
            const got = this.ensurePiece(p);
            if (got) autoPieces.push({ playerId: p.id, piece: got });
        });

        const shuffled = [...activePlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        this.currentTurn = shuffled[0].id;
        this.gameStarted = true;
        this.lastActivity = Date.now();

        this.addMessageKey('game.gameStarted', { player: shuffled[0].name });

        const firstPlayer = shuffled[0];
        if (this.emitFunction && firstPlayer.socketId) {
            setTimeout(() => {
                this.emitFunction('yourTurn', {
                    playerId: firstPlayer.id,
                    playerName: firstPlayer.name
                }, firstPlayer.socketId);
            }, 4000);
        }

        this.startTurnTimer();

        return {
            success: true,
            order: shuffled.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color
            })),
            firstPlayerId: this.currentTurn,
            firstPlayerName: shuffled[0].name
        };
    }

    kickPlayer(kickerId, targetId) {
        const hostPlayer = this.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;

        if (kickerId !== hostId) {
            return { error: L('srv.game.tik_zaidimo_kurejas_gali_ismesti') };
        }

        if (this.gameStarted) {
            return { error: L('srv.game.zaidimas_jau_prasidejo') };
        }

        if (targetId === kickerId) {
            return { error: L('srv.game.negali_ismesti_saves') };
        }

        const target = this.getPlayerById(targetId);
        if (!target || target.left || target.kicked) {
            return { error: L('srv.game.zaidejas_jau_neaktyvus') };
        }

        const targetName = target.name;
        const socketId = target.socketId;

        target.kicked = true;
        target.isActive = false;
        target.ready = false;

        this.lastActivity = Date.now();

        this.addMessageKey('game.kicked', { player: targetName });

        return {
            success: true,
            targetId: targetId,
            targetName: targetName,
            socketId: socketId
        };
    }

    getWaitingRoomState() {
        const activePlayers = this.getActivePlayers();
        const hostPlayer = this.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;

        return {
            gameStarted: this.gameStarted,
            players: activePlayers.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                ready: p.ready === true,
                isHost: p.id === hostId,
                piece: p.piece || null,
                isActive: p.isActive,
                isBot: p.isBot === true
            })),
            totalPlayers: activePlayers.length,
            readyCount: activePlayers.filter(p => p.ready).length,
            canStart: this.canStartGame().can,
            hostId: hostId,
            isPublic: this.isPublic,
            buildRule: this.buildRule,
            gameId: this.gameId
        };
    }

    // 🎲 Figūrėlės unikalios – kaip spalvos
    piecesInUse(exceptId) {
        return this.players
            .filter(p => p.id !== exceptId && !p.left && !p.kicked && p.piece)
            .map(p => p.piece);
    }
    randomFreePiece(exceptId) {
        const used = this.piecesInUse(exceptId);
        const free = C.PIECES.filter(t => !used.includes(t));
        const pool = free.length ? free : C.PIECES;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    // Nepasirinkusiam – parenkama atsitiktinė laisva. Grąžina parinktą arba null
    ensurePiece(player) {
        if (!player || player.piece) return null;
        player.piece = this.randomFreePiece(player.id);
        return player.piece;
    }

    setPiece(playerId, piece) {
        if (this.gameStarted) return { error: L('srv.game.zaidimas_jau_prasidejo') };
        if (!C.PIECES.includes(piece)) return { error: L('srv.game.tokios_figureles_nera') };
        const p = this.getPlayerById(playerId);
        if (!p) return { error: L('srv.game.zaidejas_nerastas') };
        if (p.piece !== piece && this.piecesInUse(playerId).includes(piece)) {
            return { error: L('srv.game.si_figurele_jau_uzimta') };
        }
        p.piece = piece;
        this.lastActivity = Date.now();
        return { success: true, piece };
    }

    setBuildRule(rule) {
        const r = parseInt(rule, 10);
        if (![1, 2, 3].includes(r)) return { error: L('srv.game.neteisinga_statybu_taisykle') };
        if (this.gameStarted) return { error: L('srv.game.zaidimas_jau_prasidejo') };
        this.buildRule = r;
        this.lastActivity = Date.now();
        return { success: true, buildRule: r };
    }

    setPublic(isPublic) {
        this.isPublic = isPublic === true;
        this.lastActivity = Date.now();
        return { success: true, isPublic: this.isPublic };
    }

    isAlive() {
        const activePlayers = this.getActivePlayers();
        const fiveMinutes = 5 * 60 * 1000;
        const timeSinceActivity = Date.now() - this.lastActivity;

        return activePlayers.length > 0 || timeSinceActivity < fiveMinutes;
    }

    getPublicInfo() {
        const activePlayers = this.getActivePlayers();

        return {
            gameId: this.gameId,
            hostName: this.players[0] ? this.players[0].name : L('srv.word.unknown'),
            playerCount: activePlayers.length,
            maxPlayers: C.MAX_PLAYERS,
            canJoin: !this.gameStarted && activePlayers.length < C.MAX_PLAYERS,
            gameStarted: this.gameStarted,
            lastActivity: this.lastActivity
        };
    }

    checkDebtor(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) return;
        if (player.bankrupt || player.left || player.kicked) return;

        if (player.money < 0) {
            player.isDebtor = true;

            this.addMessageKey('game.debtor', {
                player: player.name,
                amount: Math.abs(player.money)
            });
        } else {
            if (player.isDebtor === true) {
                console.log(`✅ ${player.name}: isDebtor → false (money: €${player.money})`);
            }
            player.isDebtor = false;
        }
    }

    rollDice(playerId, socketId) {
        if (!this.gameStarted) {
            return { error: L('srv.game.zaidimas_dar_neprasidejes') };
        }

        if (this.isRolling) return { error: L('srv.game.palaukite_kauliukai_metami') };
        if (this.waitingForBuy) return { error: L('srv.game.pirmiausia_nusipirk_sklypa') };
        if (this.waitingForTaxi) return { error: L('srv.game.pirmiausia_nuspresk_del_taksi') };
        if (this.waitingForWheel) return { error: L('srv.game.pirmiausia_suk_rata') };
        if (this.waitingForBuild) return { error: L('srv.game.pirmiausia_baik_statybas') };

        const player = this.getPlayerById(playerId);
        if (!player || !player.isActive || player.bankrupt || player.left || player.kicked) {
            return { error: L('srv.game.zaidejas_neaktyvus') };
        }

        // 🛡️ Mesti (ir gauti atidėtą pirkimo pasiūlymą) galima tik savo eilėje
        if (this.currentTurn !== playerId) {
            return { error: L('srv.game.ne_tavo_eile') };
        }

        // 🆕 Jei žaidėjas jau nebe minusе, bet isDebtor dar true – išvalom
        if (player.money >= 0 && player.isDebtor === true) {
            console.log(`✅ ${player.name}: isDebtor → false prieš rollDice (money: €${player.money})`);
            player.isDebtor = false;
        }

        if (player.pendingPurchase) {
            const pending = player.pendingPurchase;
            const field = this.board[pending.fieldId];
            const owner = this.players.find(p => p.properties.includes(pending.fieldId) && !p.bankrupt && !p.left && !p.kicked);

            console.log(`🔍 pendingPurchase patikra: ${player.name}`);
            console.log(`  - field: ${field?.name}`);
            console.log(`  - player.position: ${player.position}`);
            console.log(`  - pending.fieldId: ${pending.fieldId}`);
            console.log(`  - owner: ${owner?.name || 'nėra'}`);
            console.log(`  - player.money: €${player.money}`);
            console.log(`  - pending.fieldCost: €${pending.fieldCost}`);

            if (player.position !== pending.fieldId) {
                console.log(`  ❌ Ne, jau ne ant to sklypo`);
                player.pendingPurchase = null;
            }
            else if (owner) {
                console.log(`  ❌ Ne, jau nusipirktas`);
                player.pendingPurchase = null;
            }
            else if (player.money >= pending.fieldCost) {
                console.log(`  ✅ TAIP! Galima pasiūlyti pirkti`);

                this.waitingForBuy = true;

                if (this.emitFunction) {
                    this.emitFunction('pendingPurchase', {
                        playerId: player.id,
                        playerName: player.name,
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldCost: field.cost
                    });
                }

                this.startBuyTimeout(playerId);

                return {
                    action: 'pending_purchase',
                    player: player,
                    field: field,
                    message: L('srv.game.gali_nusipirkti_uz', { player: player.name, field: field.name, cost: field.cost })
                };
            }
            else {
                console.log(`  ❌ Ne, vis dar trūksta pinigų`);
            }
        }

        if (player.isDebtor) {
            return { error: L('srv.game.tu_skolingas_parduok_turta_kad') };
        }
        if (this.currentTurn !== playerId) {
            return { error: L('srv.game.ne_tavo_eile') };
        }

        if (socketId) {
            player.socketId = socketId;
        }

        this.clearTurnTimer();
        this.turnPausedAt = null;
        this.builtThisTurn = {};   // 🏗️ nauja vieta – nauja statybų galimybė
        this.landingPos = null;

        this.isRolling = true;
        this.rollSeq = (this.rollSeq || 0) + 1;   // kiekvienas metimas turi savo numerį (AFK apsaugai)
        this.currentPlayerId = playerId;
        this.lastActivity = Date.now();

        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;
        this.diceValues = [dice1, dice2];
        this.doubleRoll = (dice1 === dice2);

        if (player.inJail) {
            return this.handleJailRoll(player, dice1, dice2);
        }

        if (this.doubleRoll) {
            player.consecutiveDoubles++;
        } else {
            player.consecutiveDoubles = 0;
        }

        if (player.consecutiveDoubles >= 3) {
            const fromPosition = player.position;   // iš čia policija paima (kliento animacijai)
            player.consecutiveDoubles = 0;
            player.position = 16;
            player.inJail = true;
            this.isRolling = false;
            this.addMessageKey('game.threeDoubles', { player: player.name });

            try {
                this.endTurn();
            } catch (err) {
                console.error('❌ endTurn klaida (3 dubliai):', err);
            }

            return {
                dice: [dice1, dice2],
                total,
                player,
                field: this.board[16],
                inJail: true,
                double: true,
                goToJail: true,
                fromPosition,
                messageKey: 'game.threeDoubles',
                messageData: { player: player.name }
            };
        }

        const oldPosition = player.position;
        let newPosition = (player.position + total) % this.board.length;

        // Pravažiavus START – €200; sustojus tiksliai ant START bus €300 (processField), be papildomų €200
        if (newPosition < player.position && newPosition !== 0) {
            player.money += C.START_BONUS;
            this.addMessageKey('game.passedStart', {
                player: player.name,
                bonus: C.START_BONUS
            });
        }

        player.position = newPosition;
        const currentField = this.board[newPosition];

        this.pendingFieldPlayerId = playerId;

        return {
            dice: [dice1, dice2],
            total,
            player,
            field: currentField,
            double: this.doubleRoll,
            oldPosition: oldPosition,
            newPosition: newPosition,
            inJail: player.inJail,
            needsProcessField: true
        };
    }

    handleJailRoll(player, dice1, dice2) {
        const isDouble = dice1 === dice2;
        player.jailTurns++;

        if (isDouble) {
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessageKey('game.leftJail', { player: player.name });
            this.pendingFieldPlayerId = player.id;
            return this.continueAfterJail(player, dice1, dice2);
        } else if (player.jailTurns >= 3) {
            if (player.money < C.JAIL_FINE) {
                console.log(`💀 ${player.name}: neturi €${C.JAIL_FINE} – BANKROTAS!`);
                this.addMessageKey('game.jailBankrupt', {
                    player: player.name,
                    fine: C.JAIL_FINE
                });
                this.bankruptPlayer(player.id);
                return {
                    action: 'bankrupt',
                    player,
                    messageKey: 'game.jailBankrupt',
                    messageData: { player: player.name, fine: C.JAIL_FINE }
                };
            }

            player.money -= C.JAIL_FINE;
player.inJail = false;
player.jailTurns = 0;

// 🆕 Išvalyti isDebtor, jei nebe minusе
if (player.money >= 0 && player.isDebtor) {
    player.isDebtor = false;
    console.log(`✅ ${player.name}: isDebtor → false po kalėjimo mokesčio (jailRoll)`);
}

this.addMessageKey('game.paidJailFine', {
                player: player.name,
                fine: C.JAIL_FINE
            });
            if (player.money < 0) {
                this.checkDebtor(player.id);
            }
            this.pendingFieldPlayerId = player.id;
            return this.continueAfterJail(player, dice1, dice2);
        } else {
            this.addMessageKey('game.jailAttempt', {
                player: player.name,
                attempt: player.jailTurns
            });
            this.isRolling = false;
            this.endTurn();
            return {
                dice: [dice1, dice2],
                total: dice1 + dice2,
                player,
                field: this.board[player.position],
                inJail: true,
                double: false,
                jailAttempt: player.jailTurns,
                messageKey: 'game.jailAttempt',
                messageData: { player: player.name, attempt: player.jailTurns }
            };
        }
    }

    continueAfterJail(player, dice1, dice2) {
        const total = dice1 + dice2;
        const oldPosition = player.position;
        let newPosition = (player.position + total) % this.board.length;

        // Pravažiavus START – €200; sustojus tiksliai ant START bus €300 (processField), be papildomų €200
        if (newPosition < player.position && newPosition !== 0) {
            player.money += C.START_BONUS;
            this.addMessageKey('game.passedStart', {
                player: player.name,
                bonus: C.START_BONUS
            });
        }

        player.position = newPosition;
        const currentField = this.board[newPosition];

        this.pendingFieldPlayerId = player.id;

        return {
            dice: [dice1, dice2],
            total,
            player,
            field: currentField,
            double: false,
            oldPosition: oldPosition,
            newPosition: newPosition,
            inJail: player.inJail,
            needsProcessField: true
        };
    }

    processField(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) {
            return { error: L('srv.game.zaidejas_nerastas') };
        }

        const currentField = this.board[player.position];
        if (!currentField) {
            return { error: L('srv.game.laukas_nerastas') };
        }

        // 🏗️ Čia žaidėjas ką tik atsistojo – pagal 2 ir 3 taisykles statyti galima tik šį ėjimą
        this.landingPos = { playerId: player.id, pos: player.position };

        const result = this.handleField(player, currentField);

        // 🚕 TAKSI: pasiūlymas važiuoti (ėjimas nesibaigia, kol žaidėjas nenuspręs)
        if (result.action === 'taxi') {
            if (this.offerTaxi(player)) {
                return {
                    success: true,
                    playerId: playerId,
                    playerName: player.name,
                    field: currentField,
                    result: result,
                    taxiOffer: true,
                    canBuy: false,
                    messageKey: 'game.taxiOffer',
                    messageData: { player: player.name, cost: C.TAXI_COST }
                };
            }
            this.addMessageKey('game.taxiNoMoney', { player: player.name, cost: C.TAXI_COST });
        }

        // 🎡 LAIMĖS RATAS: ėjimas nesibaigia, kol ratas nesustos
        if (result.action === 'wheel') {
            this.turnHistory.push({ player: player.name, field: currentField.name, action: 'wheel', timestamp: new Date().toISOString() });
            this.offerWheel(player);
            return {
                success: true,
                playerId: playerId,
                playerName: player.name,
                field: currentField,
                result: result,
                wheelOffer: true,
                canBuy: false,
                messageKey: result.messageKey,
                messageData: result.messageData
            };
        }

        if (result.action === 'can_buy') {
            this.waitingForBuy = true;

            if (this.emitFunction) {
                this.emitFunction('showBuy', {
                    fieldId: currentField.id,
                    playerId: player.id,
                    fieldName: currentField.name,
                    fieldCost: currentField.cost
                });

                this.emitFunction('buyPending', {
                    playerId: player.id,
                    playerName: player.name,
                    fieldName: currentField.name,
                    fieldCost: currentField.cost
                });
            }

            this.startBuyTimeout(playerId);

            return {
                success: true,
                playerId: playerId,
                playerName: player.name,
                field: currentField,
                result: result,
                canBuy: true,
                messageKey: 'game.canBuy',
                messageData: { player: player.name, field: currentField.name, cost: currentField.cost }
            };
        }

        if (result.action === 'go_to_jail' || player.inJail) {
            player.consecutiveDoubles = 0;
            this.doubleRoll = false;

            this.addMessageKey('game.wentToJail', { player: player.name });

            this.turnHistory.push({
                player: player.name,
                field: currentField.name,
                action: 'go_to_jail',
                timestamp: new Date().toISOString()
            });

            this.endTurn();

            return {
                success: true,
                playerId: playerId,
                playerName: player.name,
                field: currentField,
                result: result,
                inJail: true,
                canBuy: false,
                messageKey: 'game.wentToJail',
                messageData: { player: player.name }
            };
        }

        this.turnHistory.push({
            player: player.name,
            field: currentField.name,
            action: result.action || 'Atsistojo',
            double: this.doubleRoll,
            timestamp: new Date().toISOString()
        });

        // 🏗️ Galima statyti – ėjimas nesibaigia, duodama 15 s statyboms
        if (this.openBuildWindow(player)) {
            return {
                success: true,
                playerId: playerId,
                playerName: player.name,
                field: currentField,
                result: result,
                double: this.doubleRoll,
                canBuy: false,
                buildWindow: true
            };
        }

        if (this.doubleRoll) {
            this.addMessageKey('game.doubleRollAgain', { player: player.name });
            // ✅ Dublis – žaidėjas meta dar kartą, todėl ėjimo laikmatis paleidžiamas iš naujo
            // (be jo AFK žaidėjui automatinis metimas nebeįvykdavo ir žaidimas sustodavo)
            this.isRolling = false;
            this.startTurnTimer();

            return {
                success: true,
                playerId: playerId,
                playerName: player.name,
                field: currentField,
                result: result,
                double: true,
                canBuy: false,
                messageKey: 'game.doubleRollAgain',
                messageData: { player: player.name }
            };
        }

        this.endTurn();

        return {
            success: true,
            playerId: playerId,
            playerName: player.name,
            field: currentField,
            result: result,
            double: false,
            canBuy: false
        };
    }

    getServiceRent(owner, serviceType) {
        if (!owner || !owner.properties) return 0;

        let ids;
        if (serviceType === 'service1') {
            ids = C.SERVICE1_IDS;
        } else if (serviceType === 'service2') {
            ids = C.SERVICE2_IDS;
        } else if (serviceType === 'service3') {
            ids = C.SERVICE3_IDS;
        } else {
            return 0;
        }

        const count = owner.properties.filter(id => ids.includes(id)).length;
        return count * 50;
    }

    calculateUtilityRent(utilityCount, diceValues) {
        const diceTotal = diceValues[0] + diceValues[1];
        return diceTotal * utilityCount;
    }

    handleField(player, field) {
        const result = { action: 'stand', message: '' };

        switch (field.type) {
            case 'property': {
                const propOwner = this.players.find(p => p.properties.includes(field.id) && !p.bankrupt && !p.left && !p.kicked);

                if (propOwner) {
                    if (propOwner.id === player.id) {
                        result.messageKey = 'game.ownProperty';
                        result.messageData = { player: player.name, field: field.name };
                    } else {
                        const rent = this.buildingLogic.getRentWithHouses(propOwner.id, field.id);
                        player.money -= rent;
                        propOwner.money += rent;
                        result.action = 'pay_rent';
                        result.rent = rent;
                        result.messageKey = 'game.rentPaid';
                        result.messageData = { player: player.name, rent: rent, owner: propOwner.name };
                        console.log('📢', result.messageKey, result.messageData);

                        if (player.money < 0) {
                            this.checkDebtor(player.id);
                        }
                    }
                } else {
                    if (player.money >= field.cost) {
                        result.action = 'can_buy';
                        result.messageKey = 'game.canBuy';
                        result.messageData = { player: player.name, field: field.name, cost: field.cost };
                        result.field = field;
                        console.log('📢', result.messageKey, result.messageData);
                    } else {
                        result.action = 'stand';
                        result.rent = 0;
                        result.field = field;
                        result.messageKey = 'game.notEnoughMoney';
                        result.messageData = { player: player.name, field: field.name };
                        console.log('📢', result.messageKey, result.messageData);

                        player.pendingPurchase = {
                            fieldId: field.id,
                            fieldName: field.name,
                            fieldCost: field.cost
                        };

                        console.log(`📝 ${player.name}: pendingPurchase išsaugotas (${field.name} €${field.cost})`);
                    }
                }
                break;
            }

            case 'service1':
            case 'service2':
            case 'service3': {
                const serviceOwner = this.players.find(p => p.properties.includes(field.id) && !p.bankrupt && !p.left && !p.kicked);

                let specialAction = field.type;
                if (field.id === 2) specialAction = 'dujos';
                else if (field.id === 14) specialAction = 'siuksles';
                else if (field.id === 28) specialAction = 'elektra';
                else if (field.id === 44) specialAction = 'vanduo';
                else if (field.id === 8) specialAction = 'airport';
                else if (field.id === 19) specialAction = 'train';
                else if (field.id === 37) specialAction = 'port';
                else if (field.id === 46) specialAction = 'bus';
                else if (field.id === 11) specialAction = 'cirkas';
                else if (field.id === 24) specialAction = 'veterinorius';
                else if (field.id === 32) specialAction = 'sauna';
                else if (field.id === 48) specialAction = 'akropolis';

                if (serviceOwner) {
                    if (serviceOwner.id === player.id) {
                        result.messageKey = 'game.ownService';
                        result.messageData = { player: player.name, field: field.name };
                        result.action = specialAction;
                    } else {
                        const rent = this.getServiceRent(serviceOwner, field.type);
                        player.money -= rent;
                        serviceOwner.money += rent;
                        result.action = specialAction;
                        result.rent = rent;
                        result.messageKey = 'game.serviceRentPaid';
                        result.messageData = { player: player.name, rent: rent, owner: serviceOwner.name, field: field.name };
                        console.log('📢', result.messageKey, result.messageData);

                        if (player.money < 0) {
                            this.checkDebtor(player.id);
                        }
                    }
                } else {
                    if (player.money >= field.cost) {
                        result.action = 'can_buy';
                        result.messageKey = 'game.canBuy';
                        result.messageData = { player: player.name, field: field.name, cost: field.cost };
                        result.field = field;
                        console.log('📢', result.messageKey, result.messageData);
                    } else {
                        result.action = specialAction;
                        result.rent = 0;
                        result.field = field;
                        result.messageKey = 'game.notEnoughMoney';
                        result.messageData = { player: player.name, field: field.name };
                        console.log('📢', result.messageKey, result.messageData);
                    }
                }
                break;
            }

            case 'tax': {
                if (field.id === 5) {
                    player.money -= 100;
                    result.action = 'pay_tax';
                    result.messageKey = 'game.taxVMI';
                    result.messageData = { player: player.name };
                } else if (field.id === 21) {
                    player.money -= 10;
                    result.action = 'latras';
                    result.messageKey = 'game.taxLatras';
                    result.messageData = { player: player.name };
                } else {
                    player.money -= field.cost;
                    result.action = 'pay_tax';
                    result.messageKey = 'game.taxGeneric';
                    result.messageData = { player: player.name, cost: field.cost };
                }
                if (player.money < 0) {
                    this.checkDebtor(player.id);
                }
                break;
            }

            case 'jail':
                result.action = 'visiting_jail';
                result.messageKey = 'game.visitingJail';
                result.messageData = { player: player.name };
                break;

            case 'go-to-jail':
                player.position = 16;
                player.inJail = true;
                result.action = 'go_to_jail';
                result.messageKey = 'game.goToJail';
                result.messageData = { player: player.name };
                console.log('📢', result.messageKey, result.messageData);
                break;

            case 'start':
                player.money += C.START_LAND_BONUS;
                result.messageKey = 'game.landedOnStart';
                result.messageData = { player: player.name, bonus: C.START_LAND_BONUS };
                break;

            case 'parking':
                result.messageKey = 'game.landedOnParking';
                result.messageData = { player: player.name };
                break;

            case 'taxi':
                result.action = 'taxi';
                result.messageKey = 'game.landedOnTaxi';
                result.messageData = { player: player.name, cost: C.TAXI_COST };
                break;

            case 'chance':
    if (field.id === C.WHEEL_FIELD_ID) {
        result.action = 'wheel';
        result.messageKey = 'game.wheelLanded';
        result.messageData = { player: player.name };
    } else {
        this.handleChance(player);
        result.action = 'chance';
        result.messageKey = 'game.gotChance';
        result.messageData = { player: player.name };
    }
    break;

            case 'special':
    if (field.id === 50) {
        player.money += 200;
        
        // 🆕 PRIDĖTI: išvalyti isDebtor, jei nebe minusе
        if (player.money >= 0 && player.isDebtor) {
            player.isDebtor = false;
            console.log(`✅ ${player.name}: isDebtor → false po gimtadienio (money: €${player.money})`);
        }
        
        result.action = 'birthday';
        result.messageKey = 'game.birthday';
        result.messageData = { player: player.name };
    } else if (field.id === 13) {
                    const cost = field.cost || 50;
                    player.money -= cost;
                    result.action = 'hospital';
                    result.messageKey = 'game.hospital';
                    result.messageData = { player: player.name, cost: cost };
                    if (player.money < 0) {
                        this.checkDebtor(player.id);
                    }
                } else if (field.id === C.WHEEL_FIELD_ID) {
                    // 🎡 LAIMĖS RATAS – rezultatą nulems ratas (processField → offerWheel)
                    result.action = 'wheel';
                    result.messageKey = 'game.wheelLanded';
                    result.messageData = { player: player.name };
} else {
                    const random = Math.random();
                    if (random < 0.3) {
                        player.money += 100;
                        result.messageKey = 'game.specialWin';
                        result.messageData = { player: player.name };
                    } else if (random < 0.6) {
                        player.money -= 100;
                        result.messageKey = 'game.specialLose';
                        result.messageData = { player: player.name };
                    } else {
                        result.messageKey = 'game.specialNothing';
                        result.messageData = { player: player.name };
                    }
                    if (player.money < 0) {
                        this.checkDebtor(player.id);
                    }
                }
                break;
        }

        return result;
    }

    handleChance(player) {
    const chances = [
        { key: 'game.chanceWin200', data: { player: player.name }, action: () => { player.money += 200; } },
        { key: 'game.chanceTax100', data: { player: player.name }, action: () => { player.money -= 100; } },
        { key: 'game.chanceGoStart', data: { player: player.name }, action: () => { player.position = 0; player.money += 200; } },
        { key: 'game.chanceWin50', data: { player: player.name }, action: () => { player.money += 50; } },
        { key: 'game.chancePay50', data: { player: player.name }, action: () => { player.money -= 50; } },
        { key: 'game.chanceGoJail', data: { player: player.name }, action: () => { player.inJail = true; player.position = 16; } },
        { key: 'game.chanceWin100', data: { player: player.name }, action: () => { player.money += 100; } },
        { key: 'game.chanceNothing', data: { player: player.name }, action: () => { } }
    ];

    const chance = chances[Math.floor(Math.random() * chances.length)];
    chance.action();
    this.addMessageKey(chance.key, chance.data);
    
    // 🆕 PRIDĖTI: išvalyti isDebtor, jei nebe minusе
    if (player.money >= 0 && player.isDebtor) {
        player.isDebtor = false;
        console.log(`✅ ${player.name}: isDebtor → false po chance (money: €${player.money})`);
    }
    
    if (player.money < 0) {
        this.checkDebtor(player.id);
    }
}

    startBuyTimeout(playerId) {
        // ⏸️ Kol laukiama pirkimo sprendimo – ėjimo laikmatis nereikalingas (kitaip AFK bandytų mesti)
        this.clearTurnTimer();
        if (this.buyTimeoutTimer) {
            clearTimeout(this.buyTimeoutTimer);
            this.buyTimeoutTimer = null;
        }

        const buyPlayer = this.getPlayerById(playerId);
        // AFK lygis skaičiuojamas pagal ėjimo pradžią (pirmas auto ėjimas dar gauna 30 s)
        const lvlPlayer = buyPlayer ? { afkAutoMoves: Math.max(0, (buyPlayer.afkAutoMoves || 0) - 1) } : null;
        const buyDuration = lvlPlayer ? this.getBuyDurationFor(lvlPlayer) : C.BUY_TIMEOUT;
        this.buyTimeoutEndTime = Date.now() + buyDuration;

        this.buyTimeoutTimer = setTimeout(() => {
            console.log(`⏰ Buy timeout - auto-cancel (player ${playerId})`);
            this.buyTimeoutTimer = null;
            this.buyTimeoutEndTime = null;
            const res = this.cancelBuy(playerId, true);
            // 🆕 Atnaujinti visų būseną (buyCancelled išsiunčia pats cancelBuy)
            if (this.emitFunction && res && !res.error) {
                this.emitFunction('gameState', this.getGameState());
            }
        }, buyDuration);
    }

    clearBuyTimeout() {
        if (this.buyTimeoutTimer) {
            clearTimeout(this.buyTimeoutTimer);
            this.buyTimeoutTimer = null;
            this.buyTimeoutEndTime = null;
        }
    }

    buyProperty(playerId) {
    // 🛡️ Pirkti gali tik tas, kurio eilė (kitaip svetimas žaidėjas galėtų „įsiterpti“)
    if (this.currentTurn !== playerId) {
        return { error: L('srv.game.ne_tavo_eile') };
    }

    this.clearBuyTimeout();

    if (!this.waitingForBuy) {
        return { error: L('srv.game.cia_negalima_pirkti') };
    }

    const player = this.getPlayerById(playerId);
    if (!player || player.bankrupt || player.kicked) return { error: L('srv.game.zaidejas_neaktyvus') };

    const field = this.board[player.position];
    if (field.type !== 'property' && field.type !== 'service1' && field.type !== 'service2' && field.type !== 'service3') {
        this.waitingForBuy = false;
        return { error: L('srv.game.cia_negalima_pirkti') };
    }

    if (player.properties.includes(field.id)) {
        this.waitingForBuy = false;
        return { error: L('srv.game.jau_turi_si_objekta') };
    }

    if (this.players.find(p => p.properties.includes(field.id) && p.id !== player.id && !p.kicked)) {
        this.waitingForBuy = false;
        return { error: L('srv.game.sis_objektas_jau_priklauso_kitam') };
    }

    if (player.money < field.cost) {
        return { error: L('srv.game.nepakanka_pinigu') };
    }

    const wasPendingPurchase = player.pendingPurchase !== null;

    player.money -= field.cost;
    player.properties.push(field.id);

    // 🆕 PRIDĖTI: išvalyti isDebtor, jei nebe minusе
    if (player.money >= 0 && player.isDebtor) {
        player.isDebtor = false;
        console.log(`✅ ${player.name}: isDebtor → false po pirkimo (money: €${player.money})`);
    }

    player.pendingPurchase = null;
    console.log(`✅ ${player.name}: pendingPurchase išvalytas (nupirko ${field.name})`);

    this.addMessageKey('game.boughtProperty', {
        player: player.name,
        field: field.name,
        cost: field.cost
    });

    if (player.userId && !player.isBot) {
        db.updateStats(player.userId, { properties_bought: 1 }).catch(err => {
            console.error('❌ properties_bought klaida:', err);
        });
    }

    this.waitingForBuy = false;
    this.lastActivity = Date.now();

    if (this.emitFunction) {
        this.emitFunction('buyConfirmed', {
            playerId: player.id,
            playerName: player.name,
            fieldName: field.name
        });
    }

    // 🏗️ 2 ir 3 taisyklės: ką tik užbaigus gatvę statyti dar negalima – tik kitą kartą atsistojus ant jos
    if ((this.buildRule || 2) !== 1 && this.buildingLogic.hasFullGroup(player.id, field.id) &&
        this.landingPos && this.landingPos.playerId === player.id) {
        this.landingPos = null;
    }

    // 🏗️ Nusipirkus – jei dabar galima statyti, duodama 15 s statyboms
    if (!wasPendingPurchase && this.openBuildWindow(player, { boughtFieldId: field.id })) {
        return {
            success: true,
            messageKey: 'game.boughtProperty',
            messageData: { player: player.name, field: field.name, cost: field.cost },
            double: this.doubleRoll,
            buildWindow: true
        };
    }

    if (wasPendingPurchase) {
        this.isRolling = false;
        this.startTurnTimer();   // ✅ dar reikia mesti – laikmatis iš naujo

        this.addMessageKey('game.boughtCanRoll', {
            player: player.name,
            field: field.name
        });
        return {
            success: true,
            messageKey: 'game.boughtCanRoll',
            messageData: { player: player.name, field: field.name },
            double: false,
            pendingPurchase: true
        };
    }

    if (this.doubleRoll) {
        this.isRolling = false;
        this.startTurnTimer();   // ✅ dublis – meta dar kartą, laikmatis iš naujo

        this.addMessageKey('game.doubleRollAgain', { player: player.name });
        return {
            success: true,
            messageKey: 'game.boughtProperty',
            messageData: { player: player.name, field: field.name, cost: field.cost },
            double: true
        };
    }

    this.endTurn();
    return {
        success: true,
        messageKey: 'game.boughtProperty',
        messageData: { player: player.name, field: field.name, cost: field.cost },
        double: false
    };
}

    cancelBuy(playerId, isTimeout = false) {
        // 🛡️ Atsisakyti gali tik tas, kurio eilė (svetimas žaidėjas nebegali atšaukti kito pirkimo)
        if (this.currentTurn !== playerId) {
            return { error: L('srv.game.ne_tavo_eile') };
        }

        this.clearBuyTimeout();

        if (!this.waitingForBuy) {
            return { error: L('srv.game.nera_ka_pirkti') };
        }

        const player = this.getPlayerById(playerId);
        if (!player) return { error: L('srv.game.zaidejas_nerastas') };

        const field = this.board[player.position];
        this.waitingForBuy = false;

        const wasPendingPurchase = player.pendingPurchase !== null;

        player.pendingPurchase = null;
        console.log(`❌ ${player.name}: pendingPurchase išvalytas (${isTimeout ? 'timeout' : 'atsisakė'})`);

        this.addMessageKey('game.cancelledBuy', {
            player: player.name,
            field: field.name
        });

        this.lastActivity = Date.now();

        if (this.emitFunction) {
            this.emitFunction('buyCancelled', {
                playerId: player.id,
                playerName: player.name,
                fieldName: field.name
            });
        }

        // 🏗️ Atsisakius pirkti – jei galima statyti, duodama 15 s (ne AFK atveju)
        if (!isTimeout && !wasPendingPurchase && this.openBuildWindow(player)) {
            if (this.emitFunction) this.emitFunction('gameState', this.getGameState());
            return {
                success: true,
                messageKey: 'game.cancelledBuy',
                messageData: { player: player.name, field: field.name },
                double: this.doubleRoll,
                buildWindow: true
            };
        }

        // ✅ PATAISYTA: DUBLIS turi prioritetą NET jei isTimeout=true
        if (this.doubleRoll) {
            this.isRolling = false;

            console.log(`🎲 DUBLIS + ${isTimeout ? 'AFK timeout' : 'atsisakymas'} → žaidėjas meta dar kartą`);

            // ✅ Paleisti turn timer iš naujo – žaidėjas turi dar kartą mesti
            this.startTurnTimer();

            this.addMessageKey('game.doubleRollAgain', { player: player.name });

            if (this.emitFunction) {
                this.emitFunction('gameState', this.getGameState());
            }

            return {
                success: true,
                messageKey: 'game.cancelledBuy',
                messageData: { player: player.name, field: field.name },
                double: true,
                timeout: isTimeout,
                canRollAgain: true
            };
        }

        // ✅ PATAISYTA: pendingPurchase taip pat NET jei isTimeout=true
        if (wasPendingPurchase) {
            this.isRolling = false;

            console.log(`📝 pendingPurchase + ${isTimeout ? 'AFK timeout' : 'atsisakymas'} → žaidėjas meta dar kartą`);

            // ✅ Paleisti turn timer iš naujo
            this.startTurnTimer();

            this.addMessageKey('game.cancelledCanRoll', {
                player: player.name
            });

            if (this.emitFunction) {
                this.emitFunction('gameState', this.getGameState());
            }

            return {
                success: true,
                messageKey: 'game.cancelledCanRoll',
                messageData: { player: player.name },
                double: false,
                pendingPurchase: true,
                timeout: isTimeout,
                canRollAgain: true
            };
        }

        // ✅ Tik jei NEI dublio, NEI pendingPurchase → perduoti ėjimą
        console.log(`➡️ ${player.name}: cancelBuy (${isTimeout ? 'AFK timeout' : 'atsisakymas'}) → endTurn()`);

        this.endTurn();

        if (this.emitFunction) {
            this.emitFunction('gameState', this.getGameState());
        }

        return {
            success: true,
            messageKey: isTimeout ? 'game.buyTimeout' : 'game.cancelledBuy',
            messageData: { player: player.name, field: field.name },
            double: false,
            timeout: isTimeout
        };
    }

    bankruptPlayer(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt) return { error: L('srv.game.zaidejas_jau_bankrutaves') };

        const wasCurrentTurn = this.currentTurn === playerId;
        const housesBeforeBankrupt = player.houses ? Object.values(player.houses).reduce((a, b) => a + b, 0) : 0;

        player.bankrupt = true;
        player.isActive = false;
        player.isDebtor = false;
        player.disconnected = false;
        this.clearDisconnectTimer(playerId);

        player.properties = [];
        player.houses = {};
        player.money = 0;
        player.pendingPurchase = null;

        // 🆕 Jei bankrutavo savo eilėje – išvalyti laukiamą pirkimą / judėjimą
        if (wasCurrentTurn) {
            this.clearBuyTimeout();
            this.waitingForBuy = false;
            if (this.pendingFieldPlayerId === playerId) this.pendingFieldPlayerId = null;
            this.isRolling = false;
            this.doubleRoll = false;
        }
        if (this.waitingForTaxi && this.waitingForTaxi.playerId === playerId) {
            this.clearTaxiTimer();
            this.waitingForTaxi = null;
        }
        if (this.waitingForWheel && this.waitingForWheel.playerId === playerId) {
            this.clearWheelTimer();
            this.waitingForWheel = null;
        }
        if (this.waitingForBuild && this.waitingForBuild.playerId === playerId) {
            this.clearBuildWindowTimer();
            this.waitingForBuild = null;
        }

        // 🆕 Atšaukti jo mainus ir statymus aukcionuose
        const tradeCleanup = this.tradingLogic.removePlayer(playerId);
        if (this.emitFunction) {
            tradeCleanup.cancelledTrades.forEach(tradeId => {
                this.emitFunction('tradeResponded', {
                    success: false,
                    tradeId: tradeId,
                    message: L('srv.game.pasiulymas_atsauktas_bankrotavo', { player: player.name })
                });
            });
            tradeCleanup.updatedAuctions.forEach(a => {
                this.emitFunction('auctionUpdated', a);
            });
        }

        this.addMessageKey('game.bankrupt', { player: player.name });

        if (player.userId && !player.isBot) {
            db.updateStats(player.userId, { bankrupts: 1 }).catch(err => {
                console.error('❌ bankrupts klaida:', err);
            });
        }

        if (player.userId && !player.isBot) {
            const housesBuilt = housesBeforeBankrupt;
            db.saveGameHistory(
                player.userId,
                this.gameId || 'unknown',
                'bankrupt',
                0,
                this.players.length,
                housesBuilt,
                0
            ).catch(err => console.error('❌ history klaida:', err));
        }

        // 🆕 Balsavimą atšaukiam tik jei jis susijęs su šiuo žaidėju
        if (this.activeVoteKick &&
            (this.activeVoteKick.targetId === playerId || this.activeVoteKick.initiatorId === playerId)) {
            this.cancelVoteKick(L('srv.vote.player_bankrupt'));
        }

        const activePlayers = this.getActivePlayers();

        if (activePlayers.length <= 1) {
            this.endGame();
            return {
                success: true,
                playerName: player.name,
                activePlayers: activePlayers.length,
                gameEnded: true
            };
        }

        // 🆕 Eilė keičiasi tik jei bankrutavo tas, kurio eilė (galima bankrotuoti bet kada)
        if (wasCurrentTurn) {
            this.endTurn();
        }

        return {
            success: true,
            playerName: player.name,
            activePlayers: activePlayers.length,
            gameEnded: false
        };
    }

    leaveGame(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) return { error: L('srv.game.zaidejas_nerastas') };
        if (player.bankrupt) return { error: L('srv.game.jau_bankrutaves') };
        if (player.left) return { error: L('srv.game.jau_pasitraukes') };
        if (player.kicked) return { error: L('srv.game.jau_pasalintas') };

        const playerName = player.name;

        player.properties = [];
        player.houses = {};
        player.money = 0;
        player.isDebtor = false;

        player.left = true;
        player.isActive = false;
        player.leftAt = new Date().toISOString();

        this.addMessageKey('game.playerLeft', { player: playerName });

        this.lastActivity = Date.now();

        if (this.activeVoteKick) {
            if (this.activeVoteKick.targetId === playerId) {
                this.cancelVoteKick(L('srv.vote.target_left'));
            } else if (this.activeVoteKick.initiatorId === playerId) {
                this.cancelVoteKick(L('srv.vote.initiator_left'));
            }
        }

        // ✅ Eilė ir laimėtojas tik prasidėjusiame žaidime (ne laukimo kambaryje)
        if (this.gameStarted && this.currentTurn === playerId) {
            this.endTurn();
        }

        const activePlayers = this.getActivePlayers();

        let winner = null;
        let winnerId = null;

        if (!this.gameStarted) {
            // Laukimo kambarys – niekas nelaimi
        } else if (activePlayers.length === 1) {
            winner = activePlayers[0].name;
            winnerId = activePlayers[0].id;
            this.addMessageKey('game.wonAllLeft', { player: winner });
            this.gameStarted = false;
        } else if (activePlayers.length === 0) {
            this.addMessageKey('game.allLeft');
            this.gameStarted = false;
        }

        return {
            success: true,
            playerName: playerName,
            playerId: playerId,
            winner: winner,
            winnerId: winnerId,
            activePlayers: activePlayers.length
        };
    }

    endTurn() {
        const activePlayers = this.getActivePlayers();
        this.builtThisTurn = {};
        this.landingPos = null;   // stovint vietoje kitą ėjimą statyti (2 ir 3 taisyklės) nebegalima
        this.turnPausedAt = null;

        // ✅ PATAISYTA: Išvalyti pendingPurchase visiems, kurių eilė praėjo
        this.players.forEach(p => {
            if (p.pendingPurchase && p.id !== this.currentTurn) {
                console.log(`🧹 ${p.name}: pendingPurchase išvalytas (endTurn)`);
                p.pendingPurchase = null;
            }
        });

        if (activePlayers.length <= 1) {
            this.endGame();
            return { error: L('srv.game.zaidimas_baigtas') };
        }

        const currentPlayer = this.getPlayerById(this.currentTurn);
        let currentIndex = currentPlayer ? this.players.indexOf(currentPlayer) : -1;

        if (currentIndex === -1) {
            currentIndex = 0;
        }

        let nextIndex = currentIndex;
        let attempts = 0;

        do {
            nextIndex = (nextIndex + 1) % this.players.length;
            attempts++;
            if (attempts > this.players.length) break;
        } while (!this.players[nextIndex].isActive ||
                 this.players[nextIndex].bankrupt ||
                 this.players[nextIndex].left ||
                 this.players[nextIndex].kicked);

        if (attempts > this.players.length) {
            this.endGame();
            return { error: L('srv.game.zaidimas_baigtas') };
        }

        this.currentTurn = this.players[nextIndex].id;
        this.doubleRoll = false;

        const nextPlayer = this.players[nextIndex];
        if (this.emitFunction && nextPlayer.socketId) {
            this.emitFunction('yourTurn', {
                playerId: nextPlayer.id,
                playerName: nextPlayer.name
            }, nextPlayer.socketId);
        }

        this.addMessageKey('game.turnNowMsg', {
            player: this.players[nextIndex].name
        });

        this.players.forEach(p => {
            if (p.isActive && !p.bankrupt && !p.left && !p.kicked) {
                if (p.money >= 0 && p.isDebtor === true) {
                    console.log(`✅ ${p.name}: isDebtor → false (money: €${p.money})`);
                    p.isDebtor = false;
                }
            }
        });

        this.startTurnTimer();

        return { nextPlayer: this.currentTurn };
    }

    async endGame() {
        this.gameStarted = false;
        const activePlayers = this.getActivePlayers();
        const winner = activePlayers[0];

        if (winner) {
            this.addMessageKey('game.winner', { player: winner.name });

            if (this.emitFunction) {
                this.emitFunction('gameFinished', {
                    winner: winner.name,
                    winnerId: winner.id
                });
            }
        } else {
            this.addMessageKey('game.noWinner');

            if (this.emitFunction) {
                this.emitFunction('gameFinished', {
                    winner: 'Niekas',
                    winnerId: null
                });
            }
        }

        try {
            for (const player of this.players) {
                if (player.userId && !player.isBot) {
                    await db.updateStats(player.userId, { games_played: 1 });
                    console.log(`📊 ${player.name}: games_played +1`);
                }
            }

            if (winner && winner.userId && !winner.isBot) {
                await db.updateStats(winner.userId, { games_won: 1 });
                console.log(`📊 ${winner.name}: games_won +1`);
            }
        } catch (err) {
            console.error('❌ Statistikos įrašymo klaida:', err);
        }

        try {
            for (const player of this.players) {
                if (player.userId && !player.isBot) {
                    let result;
                    if (winner && player.id === winner.id) {
                        result = 'win';
                    } else if (player.bankrupt) {
                        result = 'bankrupt';
                    } else if (player.left) {
                        result = 'left';
                    } else if (player.kicked) {
                        result = 'kicked';
                    } else {
                        result = 'lose';
                    }

                    const housesBuilt = player.houses ? Object.values(player.houses).reduce((a, b) => a + b, 0) : 0;
                    const propertiesBought = player.properties ? player.properties.length : 0;

                    await db.saveGameHistory(
                        player.userId,
                        this.gameId || 'unknown',
                        result,
                        player.money || 0,
                        this.players.length,
                        housesBuilt,
                        propertiesBought
                    );
                    console.log(`📜 ${player.name}: istorija įrašyta (${result})`);
                }
            }
        } catch (err) {
            console.error('❌ Istorijos įrašymo klaida:', err);
        }
    }

    addMessage(message) {
        this.lastMessage = message;
        this.lastMessageKey = null;
        this.lastMessageData = null;
        console.log('📢', message);
    }

    addMessageKey(key, data = {}) {
        this.lastMessageKey = key;
        this.lastMessageData = data;
        this.lastMessage = null;
        console.log('📢', key, data);
    }

    getGameState() {
        return {
            players: this.players
                .filter(p => !p.left)
                .map(p => ({
                    ...p,
                    afkMsLeft: p.afkSince ? Math.max(0, C.AFK_BANKRUPT_MS - (Date.now() - p.afkSince)) : null,
                    isDebtor: p.isDebtor || false,
                    kicked: p.kicked || false,
                    ready: p.ready || false
                })),
            board: this.board,
            currentTurn: this.currentTurn,
            gameStarted: this.gameStarted,
            lang: this.lang || 'lt',
            buildRule: this.buildRule,
            builtThisTurn: this.builtThisTurn || {},
            landingPos: this.landingPos || null,
            taxiOffer: this.waitingForTaxi ? { playerId: this.waitingForTaxi.playerId, cost: this.waitingForTaxi.cost,
                forbidden: this.waitingForTaxi.forbidden || C.TAXI_FORBIDDEN,
                msLeft: Math.max(0, this.waitingForTaxi.deadline - Date.now()) } : null,
            wheel: this.waitingForWheel ? { playerId: this.waitingForWheel.playerId, spinning: !!this.waitingForWheel.spinning,
                index: this.waitingForWheel.spinning ? this.waitingForWheel.index : null,
                jitter: this.waitingForWheel.jitter || 0, spinMs: this.waitingForWheel.spinMs || 0,
                spinLeftMs: this.waitingForWheel.spinning ? Math.max(0, this.waitingForWheel.spinStart + this.waitingForWheel.spinMs - Date.now()) : 0,
                msLeft: Math.max(0, this.waitingForWheel.deadline - Date.now()) } : null,
            // 🧪 Testavimo režimas (tik kai serveryje BANCRUPT_TEST=1) – rodo „Taksi testas“ mygtuką
            testMode: typeof process !== 'undefined' && process.env && process.env.BANCRUPT_TEST === '1',
            buildWindow: this.waitingForBuild ? { playerId: this.waitingForBuild.playerId,
                msLeft: Math.max(0, this.waitingForBuild.deadline - Date.now()),
                rollAgain: !!this.waitingForBuild.rollAgain } : null,
            isRolling: this.isRolling,
            pendingFieldPlayerId: this.pendingFieldPlayerId,
            maxPlayers: this.maxPlayers,
            diceValues: this.diceValues,
            turnHistory: this.turnHistory.slice(-50),
            waitingForBuy: this.waitingForBuy,
            consecutiveDoubles: this.consecutiveDoubles,
            doubleRoll: this.doubleRoll,
            activeVoteKick: this.activeVoteKick ? this.getVoteKickState() : null,
            isPublic: this.isPublic,
            gameId: this.gameId,
            lastMessageKey: null,
            lastMessageData: null,

            turnTimeLeft: this.turnTimerEndTime ? Math.max(0, Math.floor((this.turnTimerEndTime - Date.now()) / 1000)) : 0,
            turnTimerActive: !!this.turnTimer,
            turnTimerEndTime: this.turnTimerEndTime,
            turnTimerPaused: !!this.turnPausedAt,
            buildCostRatio: C.BUILD_COST_RATIO,
            hotelCostRatio: C.HOTEL_COST_RATIO,

            buyTimeoutEndTime: this.buyTimeoutEndTime || null,
            buyTimeoutActive: !!this.buyTimeoutTimer
        };
    }

    getRequiredVotes(playerCount) {
        return C.VOTE_KICK_REQUIRED[playerCount] || Math.ceil(playerCount / 2) + 1;
    }

    startVoteKick(initiatorId, targetId) {
        const initiator = this.getPlayerById(initiatorId);
        const target = this.getPlayerById(targetId);

        if (!initiator || !initiator.isActive || initiator.bankrupt || initiator.left || initiator.kicked) {
            return { error: L('srv.game.tu_negali_pradeti_balsavimo') };
        }
        if (!target || !target.isActive || target.bankrupt || target.left || target.kicked) {
            return { error: L('srv.game.zaidejas_neaktyvus') };
        }
        if (initiatorId === targetId) {
            return { error: L('srv.game.negali_balsuoti_pries_save') };
        }
        if (this.activeVoteKick) {
            return { error: L('srv.game.balsavimas_jau_vyksta') };
        }

        const activePlayers = this.getActivePlayers();

        if (activePlayers.length < 3) {
            return { error: L('srv.game.reikia_bent_aktyviu_zaideju_balsavimui') };
        }

        const requiredVotes = this.getRequiredVotes(activePlayers.length);
        const endTime = Date.now() + C.VOTE_KICK_DURATION;

        this.activeVoteKick = {
            initiatorId: initiatorId,
            targetId: targetId,
            targetName: target.name,
            initiatorName: initiator.name,
            votes: {},
            requiredVotes: requiredVotes,
            endTime: endTime,
            activePlayerCount: activePlayers.length
        };

        this.activeVoteKick.votes[initiatorId] = true;

        if (this.voteKickTimer) clearTimeout(this.voteKickTimer);
        const timeLeft = endTime - Date.now();
        this.voteKickTimer = setTimeout(() => {
            this.endVoteKick();
        }, timeLeft);

        this.addMessageKey('game.voteKickStarted', {
            initiator: initiator.name,
            target: target.name
        });

        const bots = this.getBots();
        bots.forEach(bot => {
            if (bot.id !== initiatorId && bot.id !== targetId) {
                setTimeout(() => {
                    this.processBotVoteKick(bot.id);
                }, 2000 + Math.random() * 3000);
            }
        });

        return {
            success: true,
            voteKick: this.getVoteKickState()
        };
    }

    voteKick(playerId, vote) {
        if (!this.activeVoteKick) {
            return { error: L('srv.game.balsavimas_nevyksta') };
        }

        const vk = this.activeVoteKick;
        const player = this.getPlayerById(playerId);

        if (!player || !player.isActive || player.bankrupt || player.left || player.kicked) {
            return { error: L('srv.game.tu_negali_balsuoti') };
        }
        if (playerId === vk.targetId) {
            return { error: L('srv.game.taikinys_negali_balsuoti') };
        }
        if (playerId === vk.initiatorId) {
            return { error: L('srv.game.tu_jau_balsavai_iniciatorius') };
        }
        if (vk.votes[playerId] !== undefined) {
            return { error: L('srv.game.tu_jau_balsavai') };
        }

        vk.votes[playerId] = vote === true;

        this.addMessageKey('game.voteKickVoted', {
            player: player.name,
            vote: vote ? 'FOR' : 'AGAINST',
            target: vk.targetName
        });

        const result = this.checkVoteKickResult();
        if (result.finished) {
            return result;
        }

        return {
            success: true,
            voteKick: this.getVoteKickState()
        };
    }

    checkVoteKickResult() {
        if (!this.activeVoteKick) return { finished: false };

        const vk = this.activeVoteKick;
        const votesFor = Object.values(vk.votes).filter(v => v === true).length;
        const totalVoted = Object.keys(vk.votes).length;

        const eligibleVoters = this.players.filter(p =>
            p.isActive && !p.bankrupt && !p.left && !p.kicked && p.id !== vk.targetId
        ).length;

        if (votesFor >= vk.requiredVotes) {
            return this.endVoteKick(true);
        }

        if (totalVoted >= eligibleVoters) {
            return this.endVoteKick(false);
        }

        return { finished: false };
    }

    endVoteKick(forceResult = null) {
        if (!this.activeVoteKick) return { finished: false };

        const vk = this.activeVoteKick;
        const votesFor = Object.values(vk.votes).filter(v => v === true).length;
        const votesAgainst = Object.values(vk.votes).filter(v => v === false).length;

        if (this.voteKickTimer) {
            clearTimeout(this.voteKickTimer);
            this.voteKickTimer = null;
        }

        const shouldKick = forceResult === true || votesFor >= vk.requiredVotes;

        const voteSummary = Object.keys(vk.votes).map(pid => {
            const p = this.getPlayerById(parseInt(pid));
            return {
                playerId: parseInt(pid),
                playerName: p ? p.name : L('srv.word.unknown'),
                vote: vk.votes[pid]
            };
        });

        const resultData = {
            finished: true,
            kicked: shouldKick,
            targetId: vk.targetId,
            targetName: vk.targetName,
            initiatorId: vk.initiatorId,
            initiatorName: vk.initiatorName,
            votesFor: votesFor,
            votesAgainst: votesAgainst,
            requiredVotes: vk.requiredVotes,
            voteSummary: voteSummary
        };

        this.activeVoteKick = null;

        if (shouldKick) {
            this.removeKickedPlayer(vk.targetId);
            this.addMessageKey('game.voteKickKicked', {
                player: vk.targetName,
                votes: votesFor,
                required: vk.requiredVotes
            });
        } else {
            this.addMessageKey('game.voteKickFailed', {
                player: vk.targetName,
                votes: votesFor,
                required: vk.requiredVotes
            });
        }

        if (this.emitFunction) {
            this.emitFunction('voteKickResult', resultData);

            const activePlayers = this.getActivePlayers();
            if (activePlayers.length <= 1 && activePlayers.length > 0) {
                this.emitFunction('gameFinished', {
                    winner: activePlayers[0].name,
                    winnerId: activePlayers[0].id
                });
            }
        }

        return resultData;
    }

    cancelVoteKick(reason) {
        if (!this.activeVoteKick) return;

        const vk = this.activeVoteKick;

        if (this.voteKickTimer) {
            clearTimeout(this.voteKickTimer);
            this.voteKickTimer = null;
        }

        this.activeVoteKick = null;

        if (this.emitFunction) {
            this.emitFunction('voteKickCancelled', {
                reason: reason,
                targetName: vk.targetName
            });
        }

        console.log(`🗳️ Balsavimas atšauktas: ${reason}`);
    }

    removeKickedPlayer(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) return;

        player.money = 0;
        player.properties = [];
        player.houses = {};
        player.kicked = true;
        player.isActive = false;
        player.isDebtor = false;
        player.kickedAt = new Date().toISOString();

        if (this.currentTurn === playerId) {
            this.endTurn();
        }

        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) {
            this.endGame();
        }
    }

    getVoteKickState() {
        if (!this.activeVoteKick) return null;

        const vk = this.activeVoteKick;
        const timeLeft = Math.max(0, Math.floor((vk.endTime - Date.now()) / 1000));

        return {
            initiatorId: vk.initiatorId,
            initiatorName: vk.initiatorName,
            targetId: vk.targetId,
            targetName: vk.targetName,
            votes: { ...vk.votes },
            requiredVotes: vk.requiredVotes,
            endTime: vk.endTime,
            timeLeft: timeLeft,
            activePlayerCount: vk.activePlayerCount
        };
    }

    sellToBank(playerId, fieldIds, isBailiff = false) {
    return this.tradingLogic.sellToBank(playerId, fieldIds, isBailiff);
}

    startAuction(playerId, fieldId) {
        return this.tradingLogic.startAuction(playerId, fieldId);
    }

    bidAuction(playerId, auctionId, bidAmount) {
        return this.tradingLogic.bidAuction(playerId, auctionId, bidAmount);
    }

    endAuction(auctionId) {
        return this.tradingLogic.endAuction(auctionId);
    }

    proposeTrade(playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney) {
        return this.tradingLogic.proposeTrade(playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney);
    }

    respondToTrade(tradeId, playerId, accept) {
        return this.tradingLogic.respondToTrade(tradeId, playerId, accept);
    }

    counterTrade(tradeId, playerId, newOfferField, newRequestField, newOfferMoney, newRequestMoney) {
        return this.tradingLogic.counterTrade(tradeId, playerId, newOfferField, newRequestField, newOfferMoney, newRequestMoney);
    }

    getActiveAuctions() {
        return this.tradingLogic.getActiveAuctions();
    }

    getPendingTrades(playerId) {
        return this.tradingLogic.getPendingTrades(playerId);
    }

    getPlayerTradableProperties(playerId) {
        return this.tradingLogic.getPlayerTradableProperties(playerId);
    }

    buildHouse(playerId, fieldId) {
        const result = this.buildingLogic.buildHouse(playerId, fieldId);
        // 🏗️ Statybų lange: pastatei – laikas iš naujo; pastatei paskutinį – ėjimas toliau
        if (result && result.success) this.afterBuiltInWindow(playerId);
        return result;
    }

    canBuildHouse(playerId, fieldId) {
        return this.buildingLogic.canBuildHouse(playerId, fieldId);
    }

    getDemolishableProperties(playerId) {
        return this.demolishLogic.getPlayerPropertiesWithHouses(playerId);
    }

    canDemolishHouse(playerId, fieldId) {
        return this.demolishLogic.canDemolish(playerId, fieldId);
    }

    demolishHouse(playerId, fieldId, isBailiff = false) {
    return this.demolishLogic.demolishHouse(playerId, fieldId, isBailiff);
}

    payJailFine(playerId) {
    const player = this.getPlayerById(playerId);
    if (!player || player.bankrupt || player.kicked) return { error: L('srv.game.zaidejas_neaktyvus') };
    if (!player.inJail) return { error: L('srv.game.zaidejas_nera_kalejime') };
    if (this.currentTurn !== playerId) return { error: L('srv.game.ne_tavo_eile') };
    if (player.money < C.JAIL_FINE) return { error: L('srv.game.nepakanka_pinigu_reikia', { JAIL_FINE: C.JAIL_FINE }) };

    player.money -= C.JAIL_FINE;
    player.inJail = false;
    player.jailTurns = 0;

    // 🆕 PRIDĖTI: išvalyti isDebtor, jei nebe minusе
    if (player.money >= 0 && player.isDebtor) {
        player.isDebtor = false;
        console.log(`✅ ${player.name}: isDebtor → false po kalėjimo mokesčio (money: €${player.money})`);
    }

    this.addMessageKey('game.paidJailFine', {
        player: player.name,
        fine: C.JAIL_FINE
    });

    return { success: true, message: L('srv.game.isejo_is_kalejimo_2', { player: player.name }) };
}
}

module.exports = Game;
module.exports.loadBoardCache = loadBoardCache;
module.exports.getBoardCache = getBoardCache;