// server/gameLogic.js
const boardData = require('./boardData');
const BuildingLogic = require('./buildingLogic');
const TradingLogic = require('./tradingLogic');
const DemolishLogic = require('./demolishLogic');
const C = require('./gameConstants');

class Game {
    constructor() {
        this.players = [];
        this.board = boardData;
        this.currentTurn = 0;          // 🆕 Dabar visada playerId
        this.gameStarted = false;
        this.turnHistory = [];
        this.maxPlayers = C.MAX_PLAYERS;
        this.diceValues = [1, 1];
        this.isRolling = false;
        this.consecutiveDoubles = 0;
        this.waitingForBuy = false;
        this.currentPlayerId = null;
        this.doubleRoll = false;
        this.emitFunction = null;
        this.lastMessage = '';
        this.buildingLogic = new BuildingLogic(this);
        this.tradingLogic = new TradingLogic(this);
        this.demolishLogic = new DemolishLogic(this);
        // VOTE-KICK
        this.activeVoteKick = null;
        this.voteKickTimer = null;
        // VIEŠI STALAI
        this.isPublic = false;
        this.lastActivity = Date.now();
        // URBAN KODAS
        this.gameId = null;
        // BUY TIMEOUT
        this.buyTimeoutTimer = null;
        // 🆕 SPALVŲ REZERVACIJA
        this.reservedColors = new Map(); // color -> { socketId, timeout, timestamp }
    }

    setEmitFunction(emitFn) {
        this.emitFunction = emitFn;
    }

    setGameId(id) {
        this.gameId = id;
    }

    // ============================================
    // PAGALBINĖS FUNKCIJOS
    // ============================================
    
    // 🆕 Gauti žaidėją pagal ID
    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    // 🆕 Gauti aktyvius žaidėjus
    getActivePlayers() {
        return this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
    }

    // ============================================
    // ŽAIDĖJŲ PRIDĖJIMAS
    // ============================================

    addPlayer(name, color = null) {
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
            properties: [],
            houses: {},
            inJail: false,
            jailTurns: 0,
            isActive: true,
            bankrupt: false,
            left: false,
            kicked: false,
            isDebtor: false,
            ready: false,
            socketId: null,
            token: Math.random().toString(36).substring(2) + Date.now().toString(36),
            joinedAt: Date.now(),
            isHost: this.players.length === 0
        };
        this.players.push(player);
        
        this.lastActivity = Date.now();
        
        return player;
    }

    // ============================================
// 🤖 BOTŲ FUNKCIJOS
// ============================================

// 🆕 Pridėti botą prie žaidimo
addBot() {
    if (this.players.length >= C.MAX_PLAYERS) {
        return { error: `Daugiausiai ${C.MAX_PLAYERS} žaidėjai` };
    }
    
    if (this.gameStarted) {
        return { error: 'Žaidimas jau prasidėjo! Negalima pridėti boto.' };
    }
    
    // 🆕 Botų vardai
    const BOT_NAMES = ['Jonas', 'Petras', 'Antanas', 'Ona', 'Marytė', 'Stasys', 'Birutė'];
    
    // 🆕 Rasti laisvą vardą
    const usedNames = this.players.map(p => p.name);
    const availableName = BOT_NAMES.find(n => !usedNames.includes(n));
    
    if (!availableName) {
        return { error: 'Nėra laisvų botų vardų!' };
    }
    
    // 🆕 Rasti laisvą spalvą
    const usedColors = this.players
        .filter(p => !p.left && !p.bankrupt && !p.kicked)
        .map(p => p.color);
    
    const availableColor = C.PLAYER_COLORS.find(c => !usedColors.includes(c));
    
    if (!availableColor) {
        return { error: 'Nėra laisvų spalvų!' };
    }
    
    // 🆕 Sukurti botą
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
        isActive: true,
        bankrupt: false,
        left: false,
        kicked: false,
        isDebtor: false,
        ready: true,              // 🆕 Botai visada pasiruošę
        socketId: null,
        token: 'bot_' + Math.random().toString(36).substring(2),
        joinedAt: Date.now(),
        isHost: false,
        isBot: true               // 🆕 Boto žymė
    };
    
    this.players.push(bot);
    this.lastActivity = Date.now();
    
    console.log(`🤖 Botas pridėtas: ${availableName} (${availableColor})`);
    
    return bot;
}

// 🆕 Patikrinti, ar žaidėjas yra botas
isBot(playerId) {
    const player = this.getPlayerById(playerId);
    return player && player.isBot === true;
}

// 🆕 Gauti visus botus
getBots() {
    return this.players.filter(p => p.isBot === true && !p.bankrupt && !p.left && !p.kicked);
}

// 🆕 Boto sprendimas – ar pirkti sklypą?
botShouldBuyProperty(bot, field) {
    if (!bot || !field) return false;
    
    // 1. Ar turi pakankamai pinigų? (bent 1.5× kainos)
    if (bot.money < field.cost * 1.5) {
        console.log(`🤖 ${bot.name}: nepakanka pinigų ${field.name}`);
        return false;
    }
    
    // 2. Ar tai verta? (ROI analizė)
    const baseRent = field.cost * C.RENT_BASE_RATIO;
    const roi = (baseRent * 10) / field.cost;  // ~10 apsisukimų
    
    // 3. Ar tai service1/2/3 (visada verta)?
    const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
    if (isService) {
        console.log(`🤖 ${bot.name}: perka service ${field.name}`);
        return true;
    }
    
    // 4. Ar tai property?
    if (field.type === 'property') {
        // Ar turi kitų tos pačios spalvos sklypų?
        const group = C.COLOR_GROUPS[field.color] || [];
        const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;
        
        // Jei turi 1+ tos pačios spalvos – verta
        if (ownedInGroup >= 1) {
            console.log(`🤖 ${bot.name}: perka ${field.name} (turi ${ownedInGroup} tos pačios spalvos)`);
            return true;
        }
        
        // Jei pinigų daug (> 3× kainos) – verta bet kokiu atveju
        if (bot.money > field.cost * 3) {
            console.log(`🤖 ${bot.name}: perka ${field.name} (daug pinigų)`);
            return true;
        }
        
        // Jei ROI geras – verta
        if (roi > 0.5) {
            console.log(`🤖 ${bot.name}: perka ${field.name} (ROI ${roi.toFixed(2)})`);
            return true;
        }
    }
    
    // 5. Nuspręsta – nepirkti (taupo pinigus)
    console.log(`🤖 ${bot.name}: NEperka ${field.name}`);
    return false;
}

// 🆕 Boto sprendimas – ar statyti namą?
botShouldBuildHouse(bot, fieldId) {
    if (!bot || !fieldId) return false;
    
    const field = this.board.find(f => f.id === fieldId);
    if (!field || !field.color) return false;
    
    // 1. Ar turi visą grupę?
    const group = C.COLOR_GROUPS[field.color] || [];
    const hasAll = group.every(id => bot.properties.includes(id));
    if (!hasAll) return false;
    
    // 2. Ar jau yra viežbutis?
    const currentHouses = bot.houses[fieldId] || 0;
    if (currentHouses >= 5) return false;
    
    // 3. Ar pinigų pakanka? (bent 2× namo kainos)
    const buildCost = Math.floor(field.cost * C.BUILD_COST_RATIO);
    if (bot.money < buildCost * 2) {
        console.log(`🤖 ${bot.name}: nepakanka pinigų namui statyti`);
        return false;
    }
    
    // 4. Ar tai tolygu? (max-min ≤ 1)
    const housesInGroup = group.map(id => bot.houses[id] || 0);
    const minHouses = Math.min(...housesInGroup);
    const maxHouses = Math.max(...housesInGroup);
    
    if (maxHouses - minHouses > 1) return false;
    
    // 5. Ar šis sklypas turi mažiausiai namų?
    if (currentHouses > minHouses) return false;
    
    console.log(`🤖 ${bot.name}: stato namą ant ${field.name}`);
    return true;
}

// 🆕 Boto sprendimas – ką daryti su skola?
botHandleDebt(bot) {
    if (!bot || bot.money >= 0) return { action: 'none' };
    
    console.log(`🤖 ${bot.name}: skolingas €${Math.abs(bot.money)} – bando parduoti`);
    
    // 1. Parduoti pigiausią sklypą be namų
    const sellable = bot.properties
        .filter(id => !bot.houses[id] || bot.houses[id] === 0)
        .map(id => this.board.find(f => f.id === id))
        .filter(f => f)
        .sort((a, b) => a.cost - b.cost);
    
    if (sellable.length > 0) {
        return { action: 'sell', fieldId: sellable[0].id };
    }
    
    // 2. Parduoti sklypą su namais
    const withHouses = bot.properties
        .map(id => this.board.find(f => f.id === id))
        .filter(f => f)
        .sort((a, b) => a.cost - b.cost);
    
    if (withHouses.length > 0) {
        return { action: 'demolish', fieldId: withHouses[0].id };
    }
    
    // 3. Bankrotas
    return { action: 'bankrupt' };
}

// 🆕 Boto sprendimas – ką daryti jo ėjimo metu?
botDecideAction(bot) {
    if (!bot || !bot.isActive || bot.bankrupt) return { action: 'none' };
    
    // 1. Ar skolingas?
    if (bot.money < 0) {
        return this.botHandleDebt(bot);
    }
    
    // 2. Ar kalėjime?
    if (bot.inJail) {
        if (bot.money >= C.JAIL_FINE * 2) {
            return { action: 'pay_jail' };
        }
    }
    
    // 3. Ar gali statyti?
    const field = this.board[bot.position];
    if (field && field.type === 'property' && field.color) {
        if (this.botShouldBuildHouse(bot, field.id)) {
            return { action: 'build', fieldId: field.id };
        }
    }
    
    // 4. Nieko
    return { action: 'none' };
}

// 🆕 Boto ėjimas – pagrindinė funkcija
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
    
    console.log(`🤖 ${bot.name} pradeda ėjimą...`);
    
    // 🆕 1. Ar skolingas?
    if (bot.money < 0) {
        console.log(`🤖 ${bot.name}: skolingas €${Math.abs(bot.money)}`);
        const decision = this.botDecideAction(bot);
        
        if (decision.action === 'sell') {
            // Parduoti sklypą bankui
            const result = this.sellToBank(bot.id, [decision.fieldId]);
            console.log(`🤖 ${bot.name} pardavė sklypą:`, result);
            await this.botSleep(1500);
            
            if (bot.money >= 0) {
                return { action: 'sold', message: `${bot.name} pardavė turtą` };
            }
        } else if (decision.action === 'demolish') {
            // Nugriauti namą
            const result = this.demolishHouse(bot.id, decision.fieldId);
            console.log(`🤖 ${bot.name} nugriovė namą:`, result);
            await this.botSleep(1500);
            
            if (bot.money >= 0) {
                return { action: 'demolished', message: `${bot.name} nugriovė namą` };
            }
        } else {
            // Bankrotas
            console.log(`🤖 ${bot.name} bankrutuoja!`);
            const result = this.bankruptPlayer(bot.id);
            return { action: 'bankrupt', result };
        }
    }
    
    // 🆕 2. Ar kalėjime?
    if (bot.inJail) {
        if (bot.money >= C.JAIL_FINE * 2) {
            console.log(`🤖 ${bot.name}: moka €${C.JAIL_FINE} iš kalėjimo`);
            this.payJailFine(bot.id);
            await this.botSleep(1000);
            return { action: 'paid_jail', message: `${bot.name} išėjo iš kalėjimo` };
        } else {
            console.log(`🤖 ${bot.name}: lieka kalėjime`);
            this.isRolling = false;
            this.endTurn();
            return { action: 'stayed_jail', message: `${bot.name} lieka kalėjime` };
        }
    }
    
    // 🆕 3. Mesti kauliukus
    await this.botSleep(500);
    
    console.log(`🤖 ${bot.name}: meta kauliukus`);
    const rollResult = this.rollDice(botId, null);
    
    if (rollResult.error) {
        console.log(`🤖 ${bot.name}: klaida metant kauliukus:`, rollResult.error);
        return { error: rollResult.error };
    }
    
    // 🆕 4. Jei gali pirkti – nuspręsti
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
    
    // 🆕 5. Jei gali statyti – nuspręsti
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
    
    // 🆕 6. Baigti ėjimą
    return { 
        action: 'roll', 
        rollResult,
        message: `${bot.name} baigė ėjimą`
    };
}

// 🆕 Pagalbinė – miegojimas (kad botas nežaistų per greitai)
botSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 🆕 Ar dabar boto eilė?
isBotTurn() {
    const currentPlayer = this.getPlayerById(this.currentTurn);
    return currentPlayer && currentPlayer.isBot === true;
}

// 🆕 Gauti dabartinį botą
getCurrentBot() {
    const currentPlayer = this.getPlayerById(this.currentTurn);
    if (currentPlayer && currentPlayer.isBot === true) {
        return currentPlayer;
    }
    return null;
}

    // ============================================
    // SPALVŲ FUNKCIJOS
    // ============================================

    getUsedColors() {
        const playerColors = this.players
            .filter(p => !p.left && !p.bankrupt && !p.kicked)
            .map(p => p.color);
        
        // 🆕 Pridėti rezervuotas spalvas (kurios dar neprisijungusios)
        const reservedColors = Array.from(this.reservedColors.keys())
            .filter(color => !playerColors.includes(color));
        
        return [...playerColors, ...reservedColors];
    }

    // 🆕 Rezervuoti spalvą
    reserveColor(color, socketId) {
        if (!color) return { error: 'Nėra spalvos' };
        
        // Patikrinti, ar spalva jau užimta žaidėjo
        const isTaken = this.players.some(p => 
            p.color === color && !p.left && !p.bankrupt && !p.kicked
        );
        
        if (isTaken) {
            return { error: 'Ši spalva jau užimta!' };
        }
        
        // Išvalyti seną rezervaciją šiam socketId
        for (const [c, data] of this.reservedColors) {
            if (data.socketId === socketId && c !== color) {
                if (data.timeout) clearTimeout(data.timeout);
                this.reservedColors.delete(c);
            }
        }
        
        // Išvalyti seną timeout'ą tai pačiai spalvai
        const existing = this.reservedColors.get(color);
        if (existing && existing.timeout) {
            clearTimeout(existing.timeout);
        }
        
        // Nustatyti naują rezervaciją su 30s timeout'u
        const timeout = setTimeout(() => {
            this.reservedColors.delete(color);
            console.log(`⏰ Spalvos rezervacija baigėsi: ${color}`);
            
            // 🆕 Pranešti visiems žaidėjams, kad spalva vėl laisva
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

    // 🆕 Atlaisvinti rezervaciją
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

    // 🆕 Patvirtinti rezervaciją (kai žaidėjas prisijungia)
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

    // ============================================
    // WAITING ROOM
    // ============================================

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
        this.addMessage(`✋ ${player.name} ${player.ready ? 'pasiruošęs' : 'atšaukė pasiruošimą'}`);
        
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
        
        this.addMessage(`🎮 Žaidimas pradėtas! Pirmas eina: ${shuffled[0].name}`);
        
        // 🆕 Po 4s siųsti yourTurn pirmam žaidėjui
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
        this.addMessage(`❌ ${targetName} buvo išmestas iš žaidimo`);
        
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
    isBot: p.isBot === true    // 🆕 Boto žyma
})),
            totalPlayers: activePlayers.length,
            readyCount: activePlayers.filter(p => p.ready).length,
            canStart: this.canStartGame().can,
            hostId: hostId,
            isPublic: this.isPublic,
            gameId: this.gameId
        };
    }

    // ============================================
    // VIEŠI STALAI
    // ============================================

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

    // ============================================
    // ĖJIMAI IR KAULIUKAI
    // ============================================

    checkDebtor(playerId) {
        const player = this.getPlayerById(playerId);
        if (!player) return;
        if (player.bankrupt || player.left || player.kicked) return;
        
        if (player.money < 0) {
            player.isDebtor = true;
            this.addMessage(`⚠️ ${player.name} skolingas €${Math.abs(player.money)}! Parduok turtą!`);
        } else {
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
            this.consecutiveDoubles++;
        } else {
            this.consecutiveDoubles = 0;
        }

        // 🆕 3 DUBLIAI IŠ EILĖS – KELIAUJA Į KALĖJIMĄ
        if (this.consecutiveDoubles >= 3) {
            this.consecutiveDoubles = 0;
            player.position = 16;
            player.inJail = true;
            this.isRolling = false;
            this.addMessage(`⛓️ ${player.name} išmetė 3 dubliukus iš eilės ir keliauja į kalėjimą!`);
            
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
                message: '3 dubliukai - keliauji į kalėjimą!'
            };
        }

        const oldPosition = player.position;
        let newPosition = (player.position + total) % this.board.length;

        if (newPosition < player.position) {
            player.money += C.START_BONUS;
            this.addMessage(`${player.name} praėjo START ir gavo €${C.START_BONUS}! 💰`);
        }
        else if (newPosition === 0 && player.position !== 0) {
            player.money += C.START_LAND_BONUS;
            this.addMessage(`🏁 ${player.name} atsistojo ant START ir gavo €${C.START_LAND_BONUS}! 💰`);
        }

        player.position = newPosition;
        const currentField = this.board[newPosition];
        const result = this.handleField(player, currentField);
        
        if (result.action === 'can_buy') {
            this.waitingForBuy = true;
            this.isRolling = false;
            
            if (this.emitFunction) {
                // 🆕 Siųsti VISIEMS – klientas pats nuspręs, ar rodyti
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
                dice: [dice1, dice2], 
                total, 
                player, 
                field: currentField,
                result,
                double: this.doubleRoll,
                oldPosition: oldPosition,
                newPosition: newPosition,
                canBuy: true,
                message: `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`
            };
        }

        this.turnHistory.push({
            player: player.name,
            dice: [dice1, dice2],
            total,
            field: currentField.name,
            action: result.action || 'Atsistojo',
            double: this.doubleRoll,
            timestamp: new Date().toISOString()
        });

        this.isRolling = false;

        if (this.doubleRoll && result.action !== 'can_buy') {
            this.addMessage(`🎲 ${player.name} išmetė dublį! Meta dar kartą.`);
        }

        if (!this.doubleRoll) {
            this.endTurn();
        }

        return { 
            dice: [dice1, dice2], 
            total, 
            player, 
            field: currentField,
            result,
            double: this.doubleRoll,
            oldPosition: oldPosition,
            newPosition: newPosition,
            inJail: player.inJail,
            canBuy: false
        };
    }

    handleJailRoll(player, dice1, dice2) {
        const isDouble = dice1 === dice2;
        player.jailTurns++;

        if (isDouble) {
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessage(`${player.name} išėjo iš kalėjimo! 🎉`);
            return this.continueAfterJail(player, dice1, dice2);
        } else if (player.jailTurns >= 3) {
            player.money -= C.JAIL_FINE;
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessage(`${player.name} sumokėjo €${C.JAIL_FINE} ir išėjo iš kalėjimo`);
            if (player.money < 0) {
                this.checkDebtor(player.id);
            }
            return this.continueAfterJail(player, dice1, dice2);
        } else {
            this.addMessage(`${player.name} kalėjime. Bandymas ${player.jailTurns}/3`);
            this.isRolling = false;
            this.endTurn();
            return { 
                dice: [dice1, dice2], 
                total: dice1 + dice2, 
                player, 
                field: null, 
                inJail: true,
                double: false,
                jailAttempt: player.jailTurns,
                message: `Kalėjime. Bandymas ${player.jailTurns}/3`
            };
        }
    }

    continueAfterJail(player, dice1, dice2) {
        const total = dice1 + dice2;
        const oldPosition = player.position;
        let newPosition = (player.position + total) % this.board.length;
        
        if (newPosition < player.position) {
            player.money += C.START_BONUS;
            this.addMessage(`${player.name} praėjo START ir gavo €${C.START_BONUS}! 💰`);
        }
        else if (newPosition === 0 && player.position !== 0) {
            player.money += C.START_LAND_BONUS;
            this.addMessage(`🏁 ${player.name} atsistojo ant START ir gavo €${C.START_LAND_BONUS}! 💰`);
        }

        player.position = newPosition;
        const currentField = this.board[newPosition];
        const result = this.handleField(player, currentField);

        if (result.action === 'can_buy') {
            this.waitingForBuy = true;
            this.isRolling = false;
            
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
            
            this.startBuyTimeout(player.id);
            
            return { 
                dice: [dice1, dice2], 
                total, 
                player, 
                field: currentField,
                result,
                double: false,
                oldPosition: oldPosition,
                newPosition: newPosition,
                canBuy: true,
                message: `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`
            };
        }

        this.isRolling = false;
        this.endTurn();
        return { 
            dice: [dice1, dice2], 
            total, 
            player, 
            field: currentField,
            result,
            double: false,
            oldPosition: oldPosition,
            newPosition: newPosition,
            inJail: false
        };
    }

    // 🆕 Gauti service nuomą (service1, service2, service3)
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
                        result.message = `${player.name} stovi ant savo sklypo ${field.name}`;
                        this.addMessage(result.message);
                    } else {
                        const rent = this.buildingLogic.getRentWithHouses(propOwner.id, field.id);
                        player.money -= rent;
                        propOwner.money += rent;
                        result.action = 'pay_rent';
                        result.rent = rent;
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${propOwner.name}`;
                        this.addMessage(result.message);
                        
                        if (player.money < 0) {
                            this.checkDebtor(player.id);
                        }
                    }
                } else {
                    if (player.money >= field.cost) {
                        result.action = 'can_buy';
                        result.message = `${player.name} gali nusipirkti ${field.name} už €${field.cost}`;
                        result.field = field;
                        this.addMessage(result.message);
                    } else {
                        result.action = 'stand';
                        result.rent = 0;
                        result.field = field;
                        result.message = `${player.name} neturi pakankamai pinigų ${field.name} pirkti`;
                        this.addMessage(result.message);
                    }
                }
                break;
            }
                
            case 'service1':
            case 'service2':
            case 'service3': {
                const serviceOwner = this.players.find(p => p.properties.includes(field.id) && !p.bankrupt && !p.left && !p.kicked);
                
                // Specialus action pavadinimas
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
                        result.message = `${player.name} stovi ant savo ${field.name}`;
                        this.addMessage(result.message);
                        result.action = specialAction;
                    } else {
                        const rent = this.getServiceRent(serviceOwner, field.type);
                        player.money -= rent;
                        serviceOwner.money += rent;
                        result.action = specialAction;
                        result.rent = rent;
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${serviceOwner.name} už ${field.name}`;
                        this.addMessage(result.message);
                        
                        if (player.money < 0) {
                            this.checkDebtor(player.id);
                        }
                    }
                } else {
                    if (player.money >= field.cost) {
                        result.action = 'can_buy';
                        result.message = `${player.name} gali nusipirkti ${field.name} už €${field.cost}`;
                        result.field = field;
                        this.addMessage(result.message);
                    } else {
                        result.action = specialAction;
                        result.rent = 0;
                        result.field = field;
                        result.message = `${player.name} neturi pakankamai pinigų ${field.name} pirkti`;
                        this.addMessage(result.message);
                    }
                }
                break;
            }
                
            case 'tax': {
                if (field.id === 5) {
                    player.money -= 200;
                    result.action = 'pay_tax';
                    result.message = `${player.name} sumokėjo €200 VMI mokesčių! 💰`;
                    this.addMessage(result.message);
                }
                else if (field.id === 21) {
                    player.money -= 10;
                    result.action = 'latras';
                    result.message = `${player.name} užsuko į LATRŲ BARĄ ir išleido €10! 🍺`;
                    this.addMessage(result.message);
                }
                else {
                    player.money -= field.cost;
                    result.action = 'pay_tax';
                    result.message = `${player.name} sumokėjo €${field.cost} mokesčių`;
                    this.addMessage(result.message);
                }
                if (player.money < 0) {
                    this.checkDebtor(player.id);
                }
                break;
            }
                
            case 'jail':
                result.action = 'visiting_jail';
                result.message = `${player.name} užsuko į svečius pas kalinius! 🚔`;
                this.addMessage(result.message);
                break;
                
            case 'go-to-jail':
                player.position = 16;
                player.inJail = true;
                result.action = 'go_to_jail';
                result.message = `${player.name} keliauja į kalėjimą! 🚨`;
                this.addMessage(result.message);
                break;
                
            case 'start':
                player.money += C.START_LAND_BONUS;
                result.message = `🏁 ${player.name} atsistojo ant START ir gavo €${C.START_LAND_BONUS}! 💰`;
                this.addMessage(result.message);
                break;
                
            case 'parking':
                result.message = `${player.name} atsistojo ant PARKINGO`;
                break;
                
            case 'chance':
                if (field.id === 4) {
                    player.money += 200;
                    result.action = 'special';
                    result.message = `🎲 ${player.name} atsistojo ant HORNY RP ir gavo nuo Dedo €200 naujam importui! 🎉`;
                    this.addMessage(result.message);
                } else {
                    this.handleChance(player);
                    result.action = 'chance';
                    result.message = `${player.name} gavo šansą`;
                }
                break;
                
            case 'special':
                if (field.id === 50) {
                    player.money += 200;
                    result.action = 'birthday';
                    result.message = `🎂 ${player.name} švenčia gimtadienį ir gauna €200! 🎉`;
                    this.addMessage(result.message);
                } else if (field.id === 13) {
                    const cost = field.cost || 50;
                    player.money -= cost;
                    result.action = 'hospital';
                    result.message = `🏥 ${player.name} apsilankė ligoninėje ir sumokėjo €${cost} daktarui Bubauskui! 👨‍⚕️`;
                    this.addMessage(result.message);
                    if (player.money < 0) {
                        this.checkDebtor(player.id);
                    }
                } else if (field.id === 4) {
                    player.money += 200;
                    result.action = 'special';
                    result.message = `🎲 ${player.name} atsistojo ant HORNY RP ir gavai €200 nuo Dedo su Juanu! 🎉`;
                    this.addMessage(result.message);
                } else {
                    const random = Math.random();
                    if (random < 0.3) {
                        player.money += 100;
                        result.message = `${player.name} laimėjo €100! 🎉`;
                    } else if (random < 0.6) {
                        player.money -= 100;
                        result.message = `${player.name} prarado €100! 😱`;
                    } else {
                        result.message = `${player.name} nieko neįvyko`;
                    }
                    this.addMessage(result.message);
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
            () => { player.money += 200; return 'Laimėjai €200! 🎉'; },
            () => { player.money -= 100; return 'Sumokėjai €100 mokesčių! 💰'; },
            () => { player.position = 0; player.money += 200; return 'Keliauji į START! 🏁'; },
            () => { player.money += 50; return 'Gavai €50! ✨'; },
            () => { player.money -= 50; return 'Sumokėjai €50! 😅'; },
            () => { player.inJail = true; player.position = 16; return 'Keliauji į kalėjimą! ⛓️'; },
            () => { player.money += 100; return 'Laimėjai €100! 🎊'; },
            () => { return 'Nieko neįvyko! 😶'; }
        ];
        
        const result = chances[Math.floor(Math.random() * chances.length)]();
        this.addMessage(`${player.name}: ${result}`);
        if (player.money < 0) {
            this.checkDebtor(player.id);
        }
    }

    // ============================================
    // BUY TIMEOUT
    // ============================================
    
    startBuyTimeout(playerId) {
        if (this.buyTimeoutTimer) {
            clearTimeout(this.buyTimeoutTimer);
            this.buyTimeoutTimer = null;
        }
        
        this.buyTimeoutTimer = setTimeout(() => {
            console.log(`⏰ Buy timeout - auto-cancel (player ${playerId})`);
            this.cancelBuy(playerId, true); // true = timeout
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
        
        player.money -= field.cost;
        player.properties.push(field.id);
        this.addMessage(`${player.name} nusipirko ${field.name} už €${field.cost}! 🏠`);
        
        this.waitingForBuy = false;
        this.lastActivity = Date.now();
        
        if (this.emitFunction) {
            this.emitFunction('buyConfirmed', {
                playerId: player.id,
                playerName: player.name,
                fieldName: field.name
            });
        }
        
        if (this.doubleRoll) {
            this.addMessage(`🎲 ${player.name} išmetė dublį! Gali mesti dar kartą.`);
            return { success: true, message: `${field.name} nupirktas! Gali mesti dar kartą (dublis)!`, double: true };
        }
        
        this.endTurn();
        return { success: true, message: `${field.name} nupirktas!`, double: false };
    }

    // 🆕 cancelBuy su isTimeout flag'u
    cancelBuy(playerId, isTimeout = false) {
        this.clearBuyTimeout();

        if (!this.waitingForBuy) {
            return { error: 'Nėra ką pirkti' };
        }
        
        const player = this.getPlayerById(playerId);
        if (!player) return { error: 'Žaidėjas nerastas' };
        
        const field = this.board[player.position];
        this.waitingForBuy = false;
        this.addMessage(`${player.name} atsisakė pirkti ${field.name}`);
        
        this.lastActivity = Date.now();
        
        if (this.emitFunction) {
            this.emitFunction('buyCancelled', {
                playerId: player.id,
                playerName: player.name,
                fieldName: field.name
            });
        }
        
        // 🆕 Jei dublis IR ne timeout → žaidėjas meta dar kartą
        if (this.doubleRoll && !isTimeout) {
            return { 
                success: true, 
                message: 'Atsisakyta pirkti. Gali mesti dar kartą (dublis)!',
                double: true
            };
        }
        
        // Timeout arba ne dublis → pereina prie kito
        this.endTurn();
        return { 
            success: true, 
            message: isTimeout ? 'Laikas baigėsi - praleistas ėjimas' : 'Atsisakyta pirkti',
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
        
        this.addMessage(`💀 ${player.name} BANKROTAS! Kortelės grąžintos bankui.`);
        
        if (this.activeVoteKick) {
            this.cancelVoteKick('Žaidėjas bankrutavo');
        }
        
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) {
            this.endGame();
        }
        
        this.endTurn();
        
        return { 
            success: true, 
            playerName: player.name,
            activePlayers: activePlayers.length 
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

        this.addMessage(`😭 ${playerName} susinervino ir pabėgo į kampą!`);
        
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
            this.addMessage(`🏆 ${winner} LAIMĖJO! Visi kiti pabėgo!`);
            this.gameStarted = false;
        } else if (activePlayers.length === 0) {
            this.addMessage(`🏁 Visi pabėgo – žaidimas baigtas!`);
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

    // 🆕 endTurn per playerId
    endTurn() {
        const activePlayers = this.getActivePlayers();
        
        if (activePlayers.length <= 1) {
            this.endGame();
            return { error: 'Žaidimas baigtas' };
        }

        // Rasti dabartinį žaidėją
        const currentPlayer = this.getPlayerById(this.currentTurn);
        let currentIndex = currentPlayer ? this.players.indexOf(currentPlayer) : -1;
        
        if (currentIndex === -1) {
            // Jei nerastas - pradėk nuo 0
            currentIndex = 0;
        }

        // Eiti per žaidėjus ratu
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
        
        // 🆕 Siųsti yourTurn IŠKART (be pauzės)
        const nextPlayer = this.players[nextIndex];
        if (this.emitFunction && nextPlayer.socketId) {
            this.emitFunction('yourTurn', {
                playerId: nextPlayer.id,
                playerName: nextPlayer.name
            }, nextPlayer.socketId);
        }
        
        this.addMessage(`🔄 Dabar eina ${this.players[nextIndex].name}`);
        return { nextPlayer: this.currentTurn };
    }

    endGame() {
        this.gameStarted = false;
        const activePlayers = this.getActivePlayers();
        const winner = activePlayers[0];
        if (winner) {
            this.addMessage(`🏆 ${winner.name} LAIMĖJO! 🎉`);
        }
    }

    addMessage(message) {
        this.lastMessage = message;
        console.log('📢', message);
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
            gameId: this.gameId
        };
    }

    // ============================================
    // VOTE-KICK LOGIKA
    // ============================================

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

        this.addMessage(`🗳️ ${initiator.name} pradėjo balsavimą dėl ${target.name} pašalinimo!`);

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

        this.addMessage(`🗳️ ${player.name} balsavo ${vote ? 'UŽ' : 'PRIEŠ'} ${vk.targetName} pašalinimą`);

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
            this.addMessage(`✅ ${vk.targetName} buvo pašalintas nuo stalo! (${votesFor}/${vk.requiredVotes})`);
        } else {
            this.addMessage(`❌ Balsavimas dėl ${vk.targetName} nepavyko (${votesFor}/${vk.requiredVotes})`);
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

    // ============================================
    // KITI METODAI (perduodami kitiems moduliams)
    // ============================================

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
        
        this.addMessage(`${player.name} sumokėjo €${C.JAIL_FINE} ir išėjo iš kalėjimo! 🚪`);
        
        return { success: true, message: `${player.name} išėjo iš kalėjimo!` };
    }
}

module.exports = Game;