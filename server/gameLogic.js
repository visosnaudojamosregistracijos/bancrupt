// server/gameLogic.js
const boardData = require('./boardData');
const BuildingLogic = require('./buildingLogic');
const TradingLogic = require('./tradingLogic');
const DemolishLogic = require('./demolishLogic');

class Game {
    constructor() {
        this.players = [];
        this.board = boardData;
        this.currentTurn = 0;
        this.gameStarted = false;
        this.turnHistory = [];
        this.maxPlayers = 8;
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
    }

    setEmitFunction(emitFn) {
        this.emitFunction = emitFn;
    }

    addPlayer(name) {
        if (this.players.length >= this.maxPlayers) {
            return { error: 'Daugiausiai 8 žaidėjai' };
        }
        if (this.players.find(p => p.name === name)) {
            return { error: 'Toks vardas jau užimtas' };
        }

        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE'];
        const player = {
            id: this.players.length,
            name: name,
            position: 0,
            money: 1500,
            color: colors[this.players.length % colors.length],
            properties: [],
            houses: {},
            inJail: false,
            jailTurns: 0,
            isActive: true,
            bankrupt: false,
            socketId: null,
            icon: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑'][this.players.length % 8]
        };
        this.players.push(player);
        return player;
    }

    rollDice(playerId, socketId) {
        if (this.isRolling) return { error: 'Palaukite, kauliukai metami...' };
        if (this.waitingForBuy) return { error: 'Pirmiausia nusipirk sklypą!' };
        
        const player = this.players[playerId];
        if (!player || !player.isActive || player.bankrupt) {
            return { error: 'Žaidėjas neaktyvus' };
        }
        if (this.currentTurn !== playerId) {
            return { error: 'Ne tavo eilė' };
        }

        if (socketId) {
            player.socketId = socketId;
        }

        this.isRolling = true;
        this.currentPlayerId = playerId;
        
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
            player.money += 200;
            this.addMessage(`${player.name} praėjo START ir gavo €200! 💰`);
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
                
                this.emitFunction('message', `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`);
            }
            
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
            player.money -= 50;
            player.inJail = false;
            player.jailTurns = 0;
            this.addMessage(`${player.name} sumokėjo €50 ir išėjo iš kalėjimo`);
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
            player.money += 200;
            this.addMessage(`${player.name} praėjo START ir gavo €200! 💰`);
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
                
                this.emitFunction('message', `🏠 ${player.name} gali nusipirkti ${currentField.name} už €${currentField.cost}`);
            }
            
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

    calculateUtilityRent(utilityCount, diceValues) {
        const diceTotal = diceValues[0] + diceValues[1];
        return diceTotal * utilityCount;
    }

    handleField(player, field) {
        const result = { action: 'stand', message: '' };
        const utilityIds = [2, 14, 29, 45];
        
        switch(field.type) {
            case 'property': {
                const propOwner = this.players.find(p => p.properties.includes(field.id));
                
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
                            this.bankruptPlayer(player.id);
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
                const utilOwner = this.players.find(p => p.properties.includes(field.id));
                if (utilOwner) {
                    if (utilOwner.id === player.id) {
                        result.message = `${player.name} stovi ant savo ${field.name}`;
                        this.addMessage(result.message);
                    } else {
                        const utilityCount = utilOwner.properties.filter(id => utilityIds.includes(id)).length;
                        const rent = this.calculateUtilityRent(utilityCount, this.diceValues);
                        player.money -= rent;
                        utilOwner.money += rent;
                        result.action = 'pay_rent';
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${utilOwner.name} už ${field.name}`;
                        this.addMessage(result.message);
                        
                        if (player.money < 0) {
                            this.bankruptPlayer(player.id);
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
                
            case 'service2': {
                const serviceOwner = this.players.find(p => p.properties.includes(field.id));
                if (serviceOwner) {
                    if (serviceOwner.id === player.id) {
                        result.message = `${player.name} stovi ant savo ${field.name}`;
                        this.addMessage(result.message);
                    } else {
                        const rent = this.buildingLogic.getRentWithHouses(serviceOwner.id, field.id);
                        player.money -= rent;
                        serviceOwner.money += rent;
                        result.action = 'pay_rent';
                        result.message = `${player.name} sumokėjo €${rent} nuomos ${serviceOwner.name}`;
                        this.addMessage(result.message);
                        
                        if (player.money < 0) {
                            this.bankruptPlayer(player.id);
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
                
            case 'tax':
    // Patikrinti ar tai VMI (id: 5)
    if (field.id === 5) {
        player.money -= 200;
        result.action = 'pay_tax';
        result.message = `${player.name} sumokėjo €200 VMI mokesčių! 💰`;
        this.addMessage(result.message);
    } else {
        player.money -= field.cost;
        result.action = 'pay_tax';
        result.message = `${player.name} sumokėjo €${field.cost} mokesčių`;
        this.addMessage(result.message);
    }
    if (player.money < 0) {
        this.bankruptPlayer(player.id);
    }
    break;
                
            case 'jail':
                player.inJail = true;
                result.action = 'go_to_jail';
                result.message = `${player.name} pateko į kalėjimą! ⛓️`;
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
                result.message = `${player.name} atsistojo ant START`;
                break;
                
            case 'parking':
                result.message = `${player.name} atsistojo ant PARKINGO`;
                break;
                
            case 'chance':
    // SPECIALUS ATVEJIS - HORNY RP (id: 4)
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
        result.message = `🎂 ${player.name} švenčia gimtadienį ir gauna €200! 🎉`;
        this.addMessage(result.message);
    } else if (field.id === 13) {
        // LIGONINĖ - susimoki €50 daktarui Bubauskui
        player.money -= 50;
        result.action = 'pay_tax';
        result.message = `🏥 ${player.name} apsilankė ligoninėje ir sumokėjo €50 daktarui Bubauskui! 👨‍⚕️`;
        this.addMessage(result.message);
        if (player.money < 0) {
            this.bankruptPlayer(player.id);
        }
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
            this.bankruptPlayer(player.id);
        }
    }

    buyProperty(playerId) {
        if (!this.waitingForBuy) {
            return { error: 'Čia negalima pirkti' };
        }
        
        const player = this.players[playerId];
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        
        const field = this.board[player.position];
        if (field.type !== 'property' && field.type !== 'service1' && field.type !== 'service2') {
            this.waitingForBuy = false;
            return { error: 'Čia negalima pirkti' };
        }
        
        if (player.properties.includes(field.id)) {
            this.waitingForBuy = false;
            return { error: 'Jau turi šį objektą' };
        }
        
        if (this.players.find(p => p.properties.includes(field.id) && p.id !== player.id)) {
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
        if (!this.waitingForBuy) {
            return { error: 'Nėra ką pirkti' };
        }
        
        const player = this.players[playerId];
        if (!player) return { error: 'Žaidėjas nerastas' };
        
        const field = this.board[player.position];
        this.waitingForBuy = false;
        this.addMessage(`${player.name} atsisakė pirkti ${field.name}`);
        
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
        this.addMessage(`💀 ${player.name} BANKROTAS!`);
        
        const activePlayers = this.players.filter(p => p.isActive && !p.bankrupt);
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

    endTurn() {
        let nextPlayer = this.currentTurn;
        let attempts = 0;
        do {
            nextPlayer = (nextPlayer + 1) % this.players.length;
            attempts++;
            if (attempts > this.players.length) break;
        } while (!this.players[nextPlayer].isActive || this.players[nextPlayer].bankrupt);
        
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
        const winner = this.players.find(p => p.isActive && !p.bankrupt);
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
            players: this.players,
            board: this.board,
            currentTurn: this.currentTurn,
            gameStarted: this.gameStarted,
            maxPlayers: this.maxPlayers,
            diceValues: this.diceValues,
            turnHistory: this.turnHistory.slice(-50),
            waitingForBuy: this.waitingForBuy,
            consecutiveDoubles: this.consecutiveDoubles,
            doubleRoll: this.doubleRoll
        };
    }

    // ============================================
    // PREKYBOS METODAI
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

    // ============================================
    // STATYBOS METODAI
    // ============================================
    buildHouse(playerId, fieldId) {
        return this.buildingLogic.buildHouse(playerId, fieldId);
    }

    canBuildHouse(playerId, fieldId) {
        return this.buildingLogic.canBuildHouse(playerId, fieldId);
    }

    // ============================================
    // GRIAUTI NAMUS - METODAI
    // ============================================
    getDemolishableProperties(playerId) {
        return this.demolishLogic.getPlayerPropertiesWithHouses(playerId);
    }

    canDemolishHouse(playerId, fieldId) {
        return this.demolishLogic.canDemolish(playerId, fieldId);
    }

    demolishHouse(playerId, fieldId) {
        return this.demolishLogic.demolishHouse(playerId, fieldId);
    }

    // ============================================
    // KALĖJIMO METODAI
    // ============================================
    payJailFine(playerId) {
        const player = this.players[playerId];
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (!player.inJail) return { error: 'Žaidėjas nėra kalėjime' };
        if (this.currentTurn !== playerId) return { error: 'Ne tavo eilė' };
        if (player.money < 50) return { error: 'Nepakanka pinigų (reikia €50)' };
        
        player.money -= 50;
        player.inJail = false;
        player.jailTurns = 0;
        
        this.addMessage(`${player.name} sumokėjo €50 ir išėjo iš kalėjimo! 🚪`);
        
        return { success: true, message: `${player.name} išėjo iš kalėjimo!` };
    }
}

module.exports = Game;