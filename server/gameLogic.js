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
    this.currentTurn = 0;
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
    // VIEŠI STALAI (Etapas 6)
    this.isPublic = false;
    this.lastActivity = Date.now();
    // URBAN KODAS (Etapas 5)
    this.gameId = null;
    // 🆕 BUY TIMEOUT
    this.buyTimeoutTimer = null;
}

    setEmitFunction(emitFn) {
        this.emitFunction = emitFn;
    }

    setGameId(id) {
        this.gameId = id;
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

        // SPALVOS PATIKRINIMAS
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
    isHost: this.players.length === 0  // 🆕 Pirmas žaidėjas = host
};
        this.players.push(player);
        
        this.lastActivity = Date.now();
        
        return player;
    }

    // ============================================
    // SPALVŲ FUNKCIJOS
    // ============================================

    getUsedColors() {
        return this.players
            .filter(p => !p.left && !p.bankrupt && !p.kicked)
            .map(p => p.color);
    }

    getAvailableColors() {
        const used = this.getUsedColors();
        return C.PLAYER_COLORS.filter(c => !used.includes(c));
    }

    // ============================================
    // WAITING ROOM (Etapas 3)
    // ============================================

    setPlayerReady(playerId, ready) {
        const player = this.players[playerId];
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
        const activePlayers = this.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
        
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
    // 🆕 Tik kūrėjas (hostId) gali pradėti
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
        
        // 🎲 ATSITIKTINIS RIKIAVIMAS (Etapas 4)
        const activePlayers = this.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
        
        // Fisher-Yates shuffle
        const shuffled = [...activePlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Nustatyti currentTurn į pirmą atsitiktinį žaidėją
        this.currentTurn = shuffled[0].id;
        
        this.gameStarted = true;
        this.lastActivity = Date.now();
        
        this.addMessage(`🎮 Žaidimas pradėtas! Pirmas eina: ${this.players[this.currentTurn].name}`);
        
        return {
            success: true,
            order: shuffled.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color
            })),
            firstPlayerId: this.currentTurn,
            firstPlayerName: this.players[this.currentTurn].name
        };
    }

    kickPlayer(kickerId, targetId) {
    // 🆕 Tik kūrėjas (hostId) gali išmesti
    const hostPlayer = this.players.find(p => p.isHost === true);
    const hostId = hostPlayer ? hostPlayer.id : 0;
    
    if (kickerId !== hostId) {
        return { error: 'Tik žaidimo kūrėjas gali išmesti žaidėjus' };
    }
    
    if (this.gameStarted) {
        return { error: 'Žaidimas jau prasidėjo' };
    }
    
    if (targetId === kickerId) {  // 🆕 PAKEISTA
        return { error: 'Negali išmesti savęs' };
    }
    
    const target = this.players[targetId];
    if (!target || target.left || target.kicked) {
        return { error: 'Žaidėjas jau neaktyvus' };
    }
    
    const targetName = target.name;
    const socketId = target.socketId;
    
    // Pašalinam
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
    const activePlayers = this.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
    const hostPlayer = this.players.find(p => p.isHost === true);
    const hostId = hostPlayer ? hostPlayer.id : 0;
    
    return {
        gameStarted: this.gameStarted,
        players: activePlayers.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            ready: p.ready === true,
            isHost: p.id === hostId,   // 🆕
            isActive: p.isActive
        })),
        totalPlayers: activePlayers.length,
        readyCount: activePlayers.filter(p => p.ready).length,
        canStart: this.canStartGame().can,
        hostId: hostId,                // 🆕
        isPublic: this.isPublic,
        gameId: this.gameId
    };
}

    // ============================================
    // VIEŠI STALAI (Etapas 6)
    // ============================================

    setPublic(isPublic) {
        this.isPublic = isPublic === true;
        this.lastActivity = Date.now();
        return { success: true, isPublic: this.isPublic };
    }

    isAlive() {
        // Stalas gyvas, jei:
        // 1. Yra aktyvių žaidėjų
        // 2. Praėjo mažiau nei 5 min nuo paskutinės veiklos
        const activePlayers = this.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
        const fiveMinutes = 5 * 60 * 1000;
        const timeSinceActivity = Date.now() - this.lastActivity;
        
        return activePlayers.length > 0 || timeSinceActivity < fiveMinutes;
    }

    getPublicInfo() {
        const activePlayers = this.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
        
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
        const player = this.players[playerId];
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
        
        const player = this.players[playerId];
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

        if (this.consecutiveDoubles >= 3) {
            this.consecutiveDoubles = 0;
            player.position = 16;
            player.inJail = true;
            this.isRolling = false;
            this.addMessage(`⛓️ ${player.name} išmetė 3 dubliukus iš eilės ir keliauja į kalėjimą!`);
            this.endTurn();
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
        }, player.socketId);
        
        // 🆕 Pranešimas VISIEMS, kad laukiama sprendimo
        this.emitFunction('buyPending', {
            playerId: player.id,
            playerName: player.name,
            fieldName: currentField.name,
            fieldCost: currentField.cost
        });
        
        this.emitFunction('message', `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`);
    }
    
    // 🆕 TIMEOUT 30s
    this.startBuyTimeout(playerId);
    
    return { 
        dice: [dice1, dice2], 
        total, 
        player, 
        field: currentField,
        result,
        double: this.doubleRoll,
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
        }, player.socketId);
        
        // 🆕 Pranešimas VISIEMS, kad laukiama sprendimo
        this.emitFunction('buyPending', {
            playerId: player.id,
            playerName: player.name,
            fieldName: currentField.name,
            fieldCost: currentField.cost
        });
        
        this.emitFunction('message', `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`);
    }
    
    // 🆕 TIMEOUT 30s
    this.startBuyTimeout(playerId);
    
    return { 
        dice: [dice1, dice2], 
        total, 
        player, 
        field: currentField,
        result,
        double: false,
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
            inJail: false
        };
    }

    getServiceRent(owner, serviceType) {
        if (!owner || !owner.properties) return 0;
        
        let ids;
        if (serviceType === 'service1') {
            ids = C.SERVICE1_IDS;
        } else if (serviceType === 'service2') {
            ids = C.SERVICE2_IDS;
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
                        result.message = `${player.name} neturi pakankamai pinigų ${field.name} pirkti`;
                        this.addMessage(result.message);
                    }
                }
                break;
            }
                
            case 'service1': {
                const utilOwner = this.players.find(p => p.properties.includes(field.id) && !p.bankrupt && !p.left && !p.kicked);
                
                let specialAction = 'service1';
                if (field.id === 2) specialAction = 'dujos';
                else if (field.id === 14) specialAction = 'siuksles';
                else if (field.id === 28) specialAction = 'elektra';
                else if (field.id === 44) specialAction = 'vanduo';
                
                if (utilOwner) {
                    if (utilOwner.id === player.id) {
                        result.message = `${player.name} stovi ant savo ${field.name}`;
                        this.addMessage(result.message);
                        result.action = specialAction;
                    } else {
                        const rent = this.getServiceRent(utilOwner, 'service1');
                        player.money -= rent;
                        utilOwner.money += rent;
                        result.action = specialAction;
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${utilOwner.name} už ${field.name}`;
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
                        result.message = `${player.name} neturi pakankamai pinigų ${field.name} pirkti`;
                        this.addMessage(result.message);
                    }
                }
                break;
            }
                
            case 'service2': {
                const serviceOwner = this.players.find(p => p.properties.includes(field.id) && !p.bankrupt && !p.left && !p.kicked);
                
                let specialAction = 'service2';
                if (field.id === 8) specialAction = 'airport';
                else if (field.id === 19) specialAction = 'train';
                else if (field.id === 37) specialAction = 'port';
                else if (field.id === 46) specialAction = 'bus';
                
                if (serviceOwner) {
                    if (serviceOwner.id === player.id) {
                        result.message = `${player.name} stovi ant savo ${field.name}`;
                        this.addMessage(result.message);
                        result.action = specialAction;
                    } else {
                        const rent = this.getServiceRent(serviceOwner, 'service2');
                        player.money -= rent;
                        serviceOwner.money += rent;
                        result.action = specialAction;
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${serviceOwner.name}`;
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
                else if (field.id === 32) {
                    player.money -= 25;
                    result.action = 'pirtis';
                    result.message = `${player.name} nuėjo į VLADUKO PIRTĮ ir sumokėjo €25! 🧖`;
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

// 🆕 BUY TIMEOUT
startBuyTimeout(playerId) {
    if (this.buyTimeoutTimer) {
        clearTimeout(this.buyTimeoutTimer);
        this.buyTimeoutTimer = null;
    }
    
    this.buyTimeoutTimer = setTimeout(() => {
        console.log(`⏰ Buy timeout - auto-cancel (player ${playerId})`);
        this.cancelBuy(playerId);
        this.buyTimeoutTimer = null;
    }, 30000); // 30 sekundžių
}

clearBuyTimeout() {
    if (this.buyTimeoutTimer) {
        clearTimeout(this.buyTimeoutTimer);
        this.buyTimeoutTimer = null;
    }
}

    buyProperty(playerId) {
        // 🆕 Išvalyti timeout
    this.clearBuyTimeout();

        if (!this.waitingForBuy) {
            return { error: 'Čia negalima pirkti' };
        }
        
        const player = this.players[playerId];
        if (!player || player.bankrupt || player.kicked) return { error: 'Žaidėjas neaktyvus' };
        
        const field = this.board[player.position];
        if (field.type !== 'property' && field.type !== 'service1' && field.type !== 'service2') {
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

    cancelBuy(playerId) {
       // 🆕 Išvalyti timeout
    this.clearBuyTimeout();

        if (!this.waitingForBuy) {
            return { error: 'Nėra ką pirkti' };
        }
        
        const player = this.players[playerId];
        if (!player) return { error: 'Žaidėjas nerastas' };
        
        const field = this.board[player.position];
        this.waitingForBuy = false;
        this.addMessage(`${player.name} atsisakė pirkti ${field.name}`);
        
        this.lastActivity = Date.now();
        
        if (this.emitFunction) {
            this.emitFunction('buyCancelled', {
                playerName: player.name,
                fieldName: field.name
            });
        }
        
        if (this.doubleRoll) {
            return { 
                success: true, 
                message: 'Atsisakyta pirkti. Gali mesti dar kartą (dublis)!',
                double: true
            };
        }
        
        this.endTurn();
        return { 
            success: true, 
            message: 'Atsisakyta pirkti',
            double: false
        };
    }

    bankruptPlayer(playerId) {
        const player = this.players[playerId];
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
        
        const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
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
        const player = this.players[playerId];
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

        const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
        
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

    endTurn() {
        let nextPlayer = this.currentTurn;
        let attempts = 0;
        do {
            nextPlayer = (nextPlayer + 1) % this.players.length;
            attempts++;
            if (attempts > this.players.length) break;
        } while (!this.players[nextPlayer].isActive || this.players[nextPlayer].bankrupt || this.players[nextPlayer].left || this.players[nextPlayer].kicked);
        
        if (attempts > this.players.length) {
            this.endGame();
            return { error: 'Žaidimas baigtas' };
        }
        
        this.currentTurn = nextPlayer;
        this.doubleRoll = false;
        this.addMessage(`🔄 Dabar eina ${this.players[nextPlayer].name}`);
        return { nextPlayer: nextPlayer };
    }

    endGame() {
        this.gameStarted = false;
        const winner = this.players.find(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
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
            players: this.players.map(p => ({
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
        const initiator = this.players[initiatorId];
        const target = this.players[targetId];

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

        const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
        
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
        const player = this.players[playerId];

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
            const p = this.players[parseInt(pid)];
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
            
            const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
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
        const player = this.players[playerId];
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

        const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
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
        const player = this.players[playerId];
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