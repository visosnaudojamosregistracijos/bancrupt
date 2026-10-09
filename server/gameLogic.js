// server/gameLogic.js
const boardData = require('./boardData');
const BuildingLogic = require('./buildingLogic');
const TradingLogic = require('./tradingLogic');
const DemolishLogic = require('./demolishLogic');
const C = require('./gameConstants');
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
    return {
        ...cell,
        name: ov.name ?? cell.name,
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
        this.lastRollTime = 0;   // 🆕 Apsauga nuo per greito metimo
        this.consecutiveDoubles = 0;
        this.waitingForBuy = false;
        this.currentPlayerId = null;
        this.pendingFieldPlayerId = null;   // 🆕 Laukiantis lauko apdorojimo
        this.doubleRoll = false;
        this.emitFunction = null;
        this.lastMessage = '';
        this.buildingLogic = new BuildingLogic(this);
        this.tradingLogic = new TradingLogic(this);
        this.demolishLogic = new DemolishLogic(this);
        this.activeVoteKick = null;
        this.voteKickTimer = null;
        this.isPublic = false;
        this.lastActivity = Date.now();
        this.gameId = null;
        this.buyTimeoutTimer = null;
        this.reservedColors = new Map();
        this.botTurnInProgress = false;
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
            return { error: `Daugiausiai ${C.MAX_PLAYERS} žaidėjai` };
        }

        if (this.gameStarted) {
            return { error: 'Žaidimas jau prasidėjo! Negalima prisijungti.' };
        }

        if (this.players.find(p => p.name === name && !p.left && !p.bankrupt && !p.kicked)) {
            return { error: 'Toks vardas jau užimtas' };
        }

        let finalColor;

        if (color) {
            const isTaken = this.players.some(p =>
                p.color === color && !p.left && !p.bankrupt && !p.kicked
            );

            if (isTaken) {
                return { error: 'Ši spalva jau užimta!' };
            }

            if (!C.PLAYER_COLORS.includes(color)) {
                return { error: 'Neteisinga spalva!' };
            }

            finalColor = color;
        } else {
            const usedColors = this.players
                .filter(p => !p.left && !p.bankrupt && !p.kicked)
                .map(p => p.color);

            const availableColor = C.PLAYER_COLORS.find(c => !usedColors.includes(c));

            if (!availableColor) {
                return { error: 'Nėra laisvų spalvų!' };
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
            token: Math.random().toString(36).substring(2) + Date.now().toString(36),
            joinedAt: Date.now(),
            isHost: this.players.length === 0,
            isBot: false,
            userId: userId,
            pendingPurchase: null
        };
        this.players.push(player);

        this.lastActivity = Date.now();

        return player;
    }

    addBot() {
        if (this.players.length >= C.MAX_PLAYERS) {
            return { error: `Daugiausiai ${C.MAX_PLAYERS} žaidėjai` };
        }

        if (this.gameStarted) {
            return { error: 'Žaidimas jau prasidėjo! Negalima pridėti boto.' };
        }

        const BOT_NAMES = ['Jonas', 'Petras', 'Antanas', 'Ona', 'Marytė', 'Stasys', 'Birutė'];

        const usedNames = this.players.map(p => p.name);
        const availableName = BOT_NAMES.find(n => !usedNames.includes(n));

        if (!availableName) {
            return { error: 'Nėra laisvų botų vardų!' };
        }

        const usedColors = this.players
            .filter(p => !p.left && !p.bankrupt && !p.kicked)
            .map(p => p.color);

        const availableColor = C.PLAYER_COLORS.find(c => !usedColors.includes(c));

        if (!availableColor) {
            return { error: 'Nėra laisvų spalvų!' };
        }

        const bot = {
            id: this.players.length,
            name: availableName,
            position: 0,
            money: C.START_MONEY,
            color: availableColor,
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

    getBotChatMessage(bot, event, data = {}) {
        const messages = {
            start: ['🎮 Na, pradėkim!', '🎲 Sėkmės visiems!', '💰 Laikas uždirbti!'],
            buy: ['💰 Gerai, perku!', '🏠 Šitas man tiks!', '💸 Nusipirkau!'],
            rent_pay: ['😤 Brangu...', '💸 Nuoma skaudi...', '😅 Reikėjo neiti ten...'],
            rent_get: ['💰 Ačiū už nuomą!', '🤑 Puiku!', '💸 Pinigai į kišenę!'],
            build: ['🏗️ Stato namą!', '🏠 Auga mano miestas!', '🏨 Viežbutis čia tiks!'],
            jail: ['⛓️ O ne, kalėjimas...', '😤 Vėl čia...', '🚔 Sėdžiu...'],
            bankrupt: ['💀 Viso gero...', '😭 Bankrotas...', '🏳️ Pasiduodu...'],
            trade_offer: ['📩 Siūlau prekybą!', '🤝 Norit mainais?', '💱 Pasiūlymas!'],
            trade_accept: ['✅ Sutariam!', '🤝 Puiku!', '👍 Priimu!'],
            trade_reject: ['❌ Ne, ačiū.', '🚫 Netinka.', '😕 Nepriimu.'],
            auction_start: ['🔨 Aukcionas!', '💰 Parduodu!', '🔨 Kas daugiau?'],
            auction_bid: ['💰 Siūlau!', '💸 Man!', '🔨 Pridedu!'],
            auction_win: ['🏆 Laimėjau!', '🎉 Mano!', '💰 Pagaliau!'],
            auction_lose: ['😤 Pralaimėjau...', '😕 Per brangu...', '💸 Kitą kartą...']
        };

        const eventMessages = messages[event];
        if (!eventMessages) return null;

        const msg = eventMessages[Math.floor(Math.random() * eventMessages.length)];

        return msg.replace(/{(\w+)}/g, (match, key) => data[key] || match);
    }

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
        return { error: 'Ne botas' };
    }

    if (this.currentTurn !== botId) {
        return { error: 'Ne boto eilė' };
    }

    if (!this.gameStarted) {
        return { error: 'Žaidimas neprasidėjęs' };
    }

    if (bot.bankrupt || bot.left || bot.kicked) {
        return { error: 'Botas neaktyvus' };
    }

    // 🆕 Jei laukiama pirkimo sprendimo – NELEISTI mesti
    if (this.waitingForBuy) {
        console.log(`⏳ Botas ${bot.name}: laukiama pirkimo sprendimo`);
        return { error: 'Laukiama pirkimo sprendimo' };
    }

    // console.log(`🤖 ${bot.name} pradeda ėjimą...`);

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
                    return { action: 'demolished', message: `${bot.name} nugriovė namą` };
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
                
                const result = this.sellToBank(bot.id, [sellable[0].id]);
                console.log(`🤖 ${bot.name} pardavė sklypą:`, result);
                await this.botSleep(1500);

                if (bot.money >= 0) {
                    return { action: 'sold', message: `${bot.name} pardavė turtą` };
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
                return { action: 'paid_jail', message: `${bot.name} išėjo iš kalėjimo` };
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
                message: `${bot.name} metė kauliukus kalėjime`
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
                message: `${bot.name} baigė ėjimą`
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
            message: `${bot.name} baigė ėjimą`
        };
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
        if (!color) return { error: 'Nėra spalvos' };

        const isTaken = this.players.some(p =>
            p.color === color && !p.left && !p.bankrupt && !p.kicked
        );

        if (isTaken) {
            return { error: 'Ši spalva jau užimta!' };
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

        return { error: 'Rezervacija nerasta' };
    }

    confirmColorReservation(color, socketId) {
        const reservation = this.reservedColors.get(color);

        if (reservation && reservation.socketId === socketId) {
            if (reservation.timeout) clearTimeout(reservation.timeout);
            this.reservedColors.delete(color);
            console.log(`🎨 Spalvos rezervacija patvirtinta: ${color}`);
            return { success: true };
        }

        return { error: 'Rezervacija nerasta' };
    }

    getAvailableColors() {
        const used = this.getUsedColors();
        return C.PLAYER_COLORS.filter(c => !used.includes(c));
    }

    setPlayerReady(playerId, ready) {
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt || player.left || player.kicked) {
            return { error: 'Žaidėjas neaktyvus' };
        }

        if (this.gameStarted) {
            return { error: 'Žaidimas jau prasidėjo' };
        }

        player.ready = ready === true;
        this.lastActivity = Date.now();
        
        // 🆕 PAKEISTA: addMessage → addMessageKey
        this.addMessageKey(
            player.ready ? 'game.playerReady' : 'game.playerUnready',
            { player: player.name }
        );

        return {
            success: true,
            playerId: playerId,
            playerName: player.name,
            ready: player.ready
        };
    }

    canStartGame() {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length < 2) {
            return { can: false, reason: 'Reikia bent 2 žaidėjų' };
        }

        const allReady = activePlayers.every(p => p.ready === true);
        if (!allReady) {
            return { can: false, reason: 'Ne visi žaidėjai pasiruošę' };
        }

        return { can: true };
    }

    startGame(playerId) {
        const hostPlayer = this.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;

        if (playerId !== hostId) {
            return { error: 'Tik žaidimo kūrėjas gali pradėti' };
        }

        if (this.gameStarted) {
            return { error: 'Žaidimas jau prasidėjo' };
        }

        const canStart = this.canStartGame();
        if (!canStart.can) {
            return { error: canStart.reason };
        }

        const activePlayers = this.getActivePlayers();

        const shuffled = [...activePlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        this.currentTurn = shuffled[0].id;
        this.gameStarted = true;
        this.lastActivity = Date.now();

        // 🆕 PAKEISTA: addMessage → addMessageKey
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
            return { error: 'Tik žaidimo kūrėjas gali išmesti žaidėjus' };
        }

        if (this.gameStarted) {
            return { error: 'Žaidimas jau prasidėjo' };
        }

        if (targetId === kickerId) {
            return { error: 'Negali išmesti savęs' };
        }

        const target = this.getPlayerById(targetId);
        if (!target || target.left || target.kicked) {
            return { error: 'Žaidėjas jau neaktyvus' };
        }

        const targetName = target.name;
        const socketId = target.socketId;

        target.kicked = true;
        target.isActive = false;
        target.ready = false;

        this.lastActivity = Date.now();
        
        // 🆕 PAKEISTA: addMessage → addMessageKey
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
                isActive: p.isActive,
                isBot: p.isBot === true
            })),
            totalPlayers: activePlayers.length,
            readyCount: activePlayers.filter(p => p.ready).length,
            canStart: this.canStartGame().can,
            hostId: hostId,
            isPublic: this.isPublic,
            gameId: this.gameId
        };
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
            hostName: this.players[0] ? this.players[0].name : 'Nežinomas',
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
            
            // 🆕 PAKEISTA: addMessage → addMessageKey
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
            return { error: 'Žaidimas dar neprasidėjęs!' };
        }

        if (this.isRolling) return { error: 'Palaukite, kauliukai metami...' };
        if (this.waitingForBuy) return { error: 'Pirmiausia nusipirk sklypą!' };

        const player = this.getPlayerById(playerId);
        if (!player || !player.isActive || player.bankrupt || player.left || player.kicked) {
            return { error: 'Žaidėjas neaktyvus' };
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
                    message: `💰 ${player.name} gali nusipirkti ${field.name} už €${field.cost}!`
                };
            }
            else {
                console.log(`  ❌ Ne, vis dar trūksta pinigų`);
            }
        }
        
        if (player.isDebtor) {
            return { error: '⚠️ Tu skolingas! Parduok turtą, kad išsigelbėtum!' };
        }
        if (this.currentTurn !== playerId) {
            return { error: 'Ne tavo eilė' };
        }

        if (socketId) {
            player.socketId = socketId;
        }

        this.isRolling = true;
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
        messageKey: 'game.threeDoubles',
        messageData: { player: player.name }
    };
}

        const oldPosition = player.position;
        let newPosition = (player.position + total) % this.board.length;

        if (newPosition < player.position) {
    player.money += C.START_BONUS;
    this.addMessageKey('game.passedStart', {
        player: player.name,
        bonus: C.START_BONUS
    });
}

        player.position = newPosition;
        const currentField = this.board[newPosition];

        // this.isRolling = false;
        this.pendingFieldPlayerId = playerId;   // 🆕 Laukiantis lauko apdorojimo

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
        // this.isRolling = false;
        this.pendingFieldPlayerId = player.id;   // 🆕 PRIDĖK ŠITĄ EILUTĘ
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
        this.addMessageKey('game.paidJailFine', {
            player: player.name,
            fine: C.JAIL_FINE
        });
        if (player.money < 0) {
            this.checkDebtor(player.id);
        }
        // this.isRolling = false;
        this.pendingFieldPlayerId = player.id;   // 🆕 Laukiantis lauko apdorojimo
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

        if (newPosition < player.position) {
            player.money += C.START_BONUS;
            this.addMessageKey('game.passedStart', {
                player: player.name,
                bonus: C.START_BONUS
            });
        }

        player.position = newPosition;
        const currentField = this.board[newPosition];

        // this.isRolling = false;
        this.pendingFieldPlayerId = player.id;   // 🆕 Laukiantis lauko apdorojimo

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
            return { error: 'Žaidėjas nerastas' };
        }

        const currentField = this.board[player.position];
        if (!currentField) {
            return { error: 'Laukas nerastas' };
        }

        const result = this.handleField(player, currentField);

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

            // 🆕 PAKEISTA: addMessage → addMessageKey
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

        if (this.doubleRoll) {
            // 🆕 PAKEISTA: addMessage → addMessageKey
            this.addMessageKey('game.doubleRollAgain', { player: player.name });
            
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

        switch(field.type) {
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

            case 'chance':
    if (field.id === 4) {
        player.money += 200;
        result.action = 'special';
        result.messageKey = 'game.hornyRP';
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
    } else if (field.id === 4) {
        player.money += 200;
        result.action = 'special';
        result.messageKey = 'game.hornyRP2';
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
    if (player.money < 0) {
        this.checkDebtor(player.id);
    }
}

    startBuyTimeout(playerId) {
        if (this.buyTimeoutTimer) {
            clearTimeout(this.buyTimeoutTimer);
            this.buyTimeoutTimer = null;
        }

        this.buyTimeoutTimer = setTimeout(() => {
            console.log(`⏰ Buy timeout - auto-cancel (player ${playerId})`);
            this.cancelBuy(playerId, true);
            this.buyTimeoutTimer = null;
        }, C.BUY_TIMEOUT);
    }

    clearBuyTimeout() {
        if (this.buyTimeoutTimer) {
            clearTimeout(this.buyTimeoutTimer);
            this.buyTimeoutTimer = null;
        }
    }

    buyProperty(playerId) {
    this.clearBuyTimeout();

    if (!this.waitingForBuy) {
        return { error: 'Čia negalima pirkti' };
    }

    const player = this.getPlayerById(playerId);
    if (!player || player.bankrupt || player.kicked) return { error: 'Žaidėjas neaktyvus' };

    const field = this.board[player.position];
    if (field.type !== 'property' && field.type !== 'service1' && field.type !== 'service2' && field.type !== 'service3') {
        this.waitingForBuy = false;
        return { error: 'Čia negalima pirkti' };
    }

    if (player.properties.includes(field.id)) {
        this.waitingForBuy = false;
        return { error: 'Jau turi šį objektą' };
    }

    if (this.players.find(p => p.properties.includes(field.id) && p.id !== player.id && !p.kicked)) {
        this.waitingForBuy = false;
        return { error: 'Šis objektas jau priklauso kitam žaidėjui' };
    }

    if (player.money < field.cost) {
        return { error: 'Nepakanka pinigų' };
    }

    const wasPendingPurchase = player.pendingPurchase !== null;

    player.money -= field.cost;
    player.properties.push(field.id);
    
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

    if (wasPendingPurchase) {
        // 🆕 Atblokuoti metimą (žaidėjas gali mesti dar kartą)
        this.isRolling = false;
        
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
        // 🆕 Atblokuoti metimą (dublis → meta dar kartą)
        this.isRolling = false;
        
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
    this.clearBuyTimeout();

    if (!this.waitingForBuy) {
        return { error: 'Nėra ką pirkti' };
    }

    const player = this.getPlayerById(playerId);
    if (!player) return { error: 'Žaidėjas nerastas' };

    const field = this.board[player.position];
    this.waitingForBuy = false;
    
    const wasPendingPurchase = player.pendingPurchase !== null;
    
    if (!isTimeout) {
        player.pendingPurchase = null;
        console.log(`❌ ${player.name}: pendingPurchase išvalytas (atsisakė)`);
    } else {
        console.log(`⏰ ${player.name}: pendingPurchase paliktas (timeout)`);
    }
    
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

    if (wasPendingPurchase && !isTimeout) {
        // 🆕 Atblokuoti metimą (žaidėjas gali mesti dar kartą)
        this.isRolling = false;
        
        this.addMessageKey('game.cancelledCanRoll', {
            player: player.name
        });
        return { 
            success: true, 
            messageKey: 'game.cancelledCanRoll',
            messageData: { player: player.name },
            double: false,
            pendingPurchase: true
        };
    }

    if (this.doubleRoll && !isTimeout) {
        // 🆕 Atblokuoti metimą (dublis → meta dar kartą)
        this.isRolling = false;
        
        return {
            success: true,
            messageKey: 'game.cancelledBuy',
            messageData: { player: player.name, field: field.name },
            double: true
        };
    }

    this.endTurn();
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
    if (!player || player.bankrupt) return { error: 'Žaidėjas jau bankrutavęs' };

    player.bankrupt = true;
    player.isActive = false;
    player.isDebtor = false;

    player.properties = [];
    player.houses = {};
    player.money = 0;

    this.addMessageKey('game.bankrupt', { player: player.name });

    if (player.userId && !player.isBot) {
        db.updateStats(player.userId, { bankrupts: 1 }).catch(err => {
            console.error('❌ bankrupts klaida:', err);
        });
    }

    if (player.userId && !player.isBot) {
        const housesBuilt = player.houses ? Object.values(player.houses).reduce((a, b) => a + b, 0) : 0;
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

    if (this.activeVoteKick) {
        this.cancelVoteKick('Žaidėjas bankrutavo');
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

    this.endTurn();

    return {
        success: true,
        playerName: player.name,
        activePlayers: activePlayers.length,
        gameEnded: false
    };
}

    leaveGame(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) return { error: 'Žaidėjas nerastas' };
        if (player.bankrupt) return { error: 'Jau bankrutavęs' };
        if (player.left) return { error: 'Jau pasitraukęs' };
        if (player.kicked) return { error: 'Jau pašalintas' };

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
                this.cancelVoteKick('Taikinys pasitraukė');
            } else if (this.activeVoteKick.initiatorId === playerId) {
                this.cancelVoteKick('Iniciatorius pasitraukė');
            }
        }

        if (this.currentTurn === playerId) {
            this.endTurn();
        }

        const activePlayers = this.getActivePlayers();

        let winner = null;
        let winnerId = null;

        if (activePlayers.length === 1) {
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

        if (activePlayers.length <= 1) {
            this.endGame();
            return { error: 'Žaidimas baigtas' };
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
            return { error: 'Žaidimas baigtas' };
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

        return { nextPlayer: this.currentTurn };
    }

    async endGame() {
        this.gameStarted = false;
        const activePlayers = this.getActivePlayers();
        const winner = activePlayers[0];
        
        if (winner) {
            // 🆕 PAKEISTA: addMessage → addMessageKey
            this.addMessageKey('game.winner', { player: winner.name });
            
            if (this.emitFunction) {
                this.emitFunction('gameFinished', {
                    winner: winner.name,
                    winnerId: winner.id
                });
            }
        } else {
            // 🆕 PAKEISTA: addMessage → addMessageKey
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
                isDebtor: p.isDebtor || false,
                kicked: p.kicked || false,
                ready: p.ready || false
            })),
        board: this.board,
        currentTurn: this.currentTurn,
        gameStarted: this.gameStarted,
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
        lastMessageData: null
    };
}

    getRequiredVotes(playerCount) {
        return C.VOTE_KICK_REQUIRED[playerCount] || Math.ceil(playerCount / 2) + 1;
    }

    startVoteKick(initiatorId, targetId) {
        const initiator = this.getPlayerById(initiatorId);
        const target = this.getPlayerById(targetId);

        if (!initiator || !initiator.isActive || initiator.bankrupt || initiator.left || initiator.kicked) {
            return { error: 'Tu negali pradėti balsavimo' };
        }
        if (!target || !target.isActive || target.bankrupt || target.left || target.kicked) {
            return { error: 'Žaidėjas neaktyvus' };
        }
        if (initiatorId === targetId) {
            return { error: 'Negali balsuoti prieš save' };
        }
        if (this.activeVoteKick) {
            return { error: 'Balsavimas jau vyksta!' };
        }

        const activePlayers = this.getActivePlayers();

        if (activePlayers.length < 3) {
            return { error: 'Reikia bent 3 aktyvių žaidėjų balsavimui' };
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

        // 🆕 PAKEISTA: addMessage → addMessageKey
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
            return { error: 'Balsavimas nevyksta' };
        }

        const vk = this.activeVoteKick;
        const player = this.getPlayerById(playerId);

        if (!player || !player.isActive || player.bankrupt || player.left || player.kicked) {
            return { error: 'Tu negali balsuoti' };
        }
        if (playerId === vk.targetId) {
            return { error: 'Taikinys negali balsuoti' };
        }
        if (playerId === vk.initiatorId) {
            return { error: 'Tu jau balsavai (iniciatorius)' };
        }
        if (vk.votes[playerId] !== undefined) {
            return { error: 'Tu jau balsavai!' };
        }

        vk.votes[playerId] = vote === true;

        // 🆕 PAKEISTA: addMessage → addMessageKey
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
                playerName: p ? p.name : 'Nežinomas',
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
            // 🆕 PAKEISTA: addMessage → addMessageKey
            this.addMessageKey('game.voteKickKicked', { 
                player: vk.targetName, 
                votes: votesFor, 
                required: vk.requiredVotes 
            });
        } else {
            // 🆕 PAKEISTA: addMessage → addMessageKey
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

    sellToBank(playerId, fieldIds) {
        return this.tradingLogic.sellToBank(playerId, fieldIds);
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
        return this.buildingLogic.buildHouse(playerId, fieldId);
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

    demolishHouse(playerId, fieldId) {
        return this.demolishLogic.demolishHouse(playerId, fieldId);
    }

    payJailFine(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player || player.bankrupt || player.kicked) return { error: 'Žaidėjas neaktyvus' };
        if (!player.inJail) return { error: 'Žaidėjas nėra kalėjime' };
        if (this.currentTurn !== playerId) return { error: 'Ne tavo eilė' };
        if (player.money < C.JAIL_FINE) return { error: `Nepakanka pinigų (reikia €${C.JAIL_FINE})` };

        player.money -= C.JAIL_FINE;
        player.inJail = false;
        player.jailTurns = 0;

        // 🆕 PAKEISTA: addMessage → addMessageKey
        this.addMessageKey('game.paidJailFine', { 
            player: player.name, 
            fine: C.JAIL_FINE 
        });

        return { success: true, message: `${player.name} išėjo iš kalėjimo!` };
    }
}

module.exports = Game;
module.exports.loadBoardCache = loadBoardCache;
module.exports.getBoardCache = getBoardCache;