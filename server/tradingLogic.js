// ============================================
// server/tradingLogic.js
// ============================================

const C = require('./gameConstants');

class TradingLogic {
    constructor(game) {
        this.game = game;
        this.auctions = new Map();
        this.trades = new Map();
        this.utilityIds = C.SERVICE1_IDS;
        this.serviceIds = C.SERVICE2_IDS;
        this.specialIds = C.SERVICE3_IDS;
    }

    getPlayer(playerId) {
        return this.game.players.find(p => p.id === playerId);
    }

    hasHouses(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        return player.houses && player.houses[fieldId] && player.houses[fieldId] > 0;
    }

    hasHousesInGroup(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        const field = this.game.board.find(f => f.id === fieldId);
        if (!field || !field.color) return false;
        
        const groupFields = C.COLOR_GROUPS[field.color] || [];
        return groupFields.some(id => {
            return player.houses && player.houses[id] && player.houses[id] > 0;
        });
    }

    getBankBuybackPrice(fieldId) {
        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) return 0;
        return Math.floor(field.cost * C.BANK_BUYBACK_RATIO);
    }

    getPlayerTradableProperties(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return [];

        return player.properties.filter(fieldId => {
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            if (houses > 0) return false;
            if (this.hasHousesInGroup(playerId, fieldId)) return false;
            return true;
        }).map(fieldId => {
            const field = this.game.board.find(f => f.id === fieldId);
            return {
                id: fieldId,
                name: field ? field.name : 'Nežinoma',
                cost: field ? field.cost : 0,
                type: field ? field.type : 'unknown',
                color: field ? field.color : null
            };
        });
    }

    getAllPlayerProperties(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return [];

        return player.properties.map(fieldId => {
            const field = this.game.board.find(f => f.id === fieldId);
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            return {
                id: fieldId,
                name: field ? field.name : 'Nežinoma',
                cost: field ? field.cost : 0,
                type: field ? field.type : 'unknown',
                color: field ? field.color : null,
                houses: houses,
                hasHouses: houses > 0
            };
        });
    }

    // ============================================
    // 1. PARDUOTI BANKUI
    // ============================================
    sellToBank(playerId, fieldIds) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (player.left) return { error: 'Žaidėjas pasitraukęs' };
        if (player.kicked) return { error: 'Žaidėjas pašalintas' };

        let totalPrice = 0;
        const soldFields = [];

        for (const fieldId of fieldIds) {
            if (!player.properties.includes(fieldId)) {
                return { error: `Neturi kortelės ${fieldId}` };
            }
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            if (houses > 0) {
                const field = this.game.board.find(f => f.id === fieldId);
                return { error: `Negali parduoti ${field ? field.name : 'kortelės'} - turi namų!` };
            }
            
            
            
            const price = this.getBankBuybackPrice(fieldId);
            totalPrice += price;
            soldFields.push(fieldId);
        }

        for (const fieldId of soldFields) {
            player.properties = player.properties.filter(id => id !== fieldId);
            if (player.houses) {
                delete player.houses[fieldId];
            }
        }

        player.money += totalPrice;
        this.game.addMessage(`🏦 ${player.name} pardavė ${soldFields.length} kortelę(-es) bankui už €${totalPrice}!`);

        if (player.money >= 0) {
            player.isDebtor = false;
        }

        return { 
            success: true, 
            soldFields: soldFields,
            totalPrice: totalPrice,
            message: `Parduota už €${totalPrice}`
        };
    }

    // ============================================
    // 2. PRADĖTI AUKCIONĄ
    // ============================================
    startAuction(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) {
            return { error: 'Žaidėjas neaktyvus' };
        }
        if (player.left) {
            return { error: 'Žaidėjas pasitraukęs' };
        }
        if (player.kicked) {
            return { error: 'Žaidėjas pašalintas' };
        }

        if (!player.properties.includes(fieldId)) {
            return { error: 'Neturi šios kortelės' };
        }

        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) {
            return { error: 'Negali aukcionuoti kortelės su namais!' };
        }
        
        if (this.hasHousesInGroup(playerId, fieldId)) {
            return { error: 'Negali aukcionuoti – grupėje yra pastatytų namų!' };
        }

        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) {
            return { error: 'Kortelė nerasta' };
        }

        const auctionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        const endTime = Date.now() + C.AUCTION_DURATION;
        
        const startPrice = Math.floor(field.cost * C.AUCTION_START_RATIO);

        const bankBid = {
            playerId: 'bank',
            playerName: '🏦 Bankas',
            bid: startPrice
        };

        this.auctions.set(auctionId, {
            fieldId: fieldId,
            sellerId: playerId,
            sellerName: player.name,
            fieldName: field.name,
            fieldCost: field.cost,
            fieldIcon: field.icon || '',
            fieldColor: field.color || null,
            fieldType: field.type || 'property',
            currentBid: startPrice,
            currentBidder: 'bank',
            currentBidderName: '🏦 Bankas',
            bidders: [bankBid],
            endTime: endTime,
            isActive: true,
            winner: null,
            timer: null
        });

        player.properties = player.properties.filter(id => id !== fieldId);
        if (player.houses) {
            delete player.houses[fieldId];
        }

        this.game.addMessage(`🔨 ${player.name} paskelbė aukcioną: ${field.name}! Bankas siūlo €${startPrice}`);

        const auction = this.auctions.get(auctionId);
        const timeLeft = endTime - Date.now();
        auction.timer = setTimeout(() => {
            this.endAuctionServerSide(auctionId);
        }, timeLeft);

        // 🆕 Pranešti botams apie aukcioną
        this.notifyBotsAboutAuction(auctionId);

        return { 
            success: true, 
            auctionId: auctionId,
            fieldId: fieldId,
            fieldName: field.name,
            fieldCost: field.cost,
            fieldIcon: field.icon || '',
            fieldColor: field.color || null,
            fieldType: field.type || 'property',
            sellerId: playerId,
            sellerName: player.name,
            currentBid: startPrice,
            currentBidder: 'bank',
            currentBidderName: '🏦 Bankas',
            endTime: endTime
        };
    }

    // ============================================
    // 🆕 BOTAI AUKCIONE
    // ============================================
    notifyBotsAboutAuction(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return;
        
        const bots = this.game.getBots();
        if (!bots || bots.length === 0) return;
        
        console.log(`🤖 ${bots.length} botai informuoti apie aukcioną: ${auction.fieldName}`);
        
        // 🆕 Kiekvienas botas atskirai nuspręs ar bid'inti
        bots.forEach(bot => {
            setTimeout(() => {
                this.botBidAuction(bot.id, auctionId);
            }, 2000 + Math.random() * 3000);
        });
    }

    // 🆕 Boto bid'as aukcione
    async botBidAuction(botId, auctionId) {
        const bot = this.game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.isActive) return;
        
        // 🆕 Negali būti pardavėjas
        if (auction.sellerId === botId) return;
        
        // 🆕 Ar jau baigėsi?
        if (Date.now() > auction.endTime) return;
        
        // 🆕 Nuspręsti ar verta
        const shouldBid = this.botShouldBidAuction(bot, auction);
        if (!shouldBid.can) {
            console.log(`🤖 ${bot.name}: nebid'ina ${auction.fieldName} (${shouldBid.reason})`);
            return;
        }
        
        // 🆕 Apskaičiuoti bid'ą
        const bidAmount = shouldBid.amount;
        
        console.log(`🤖 ${bot.name}: bid'ina €${bidAmount} už ${auction.fieldName}`);
        
        const result = this.bidAuction(botId, auctionId, bidAmount);
        
        if (result.error) {
            console.log(`🤖 ${bot.name}: bid klaida:`, result.error);
            return;
        }
        
        // 🆕 Pranešti visiems
        if (this.game.emitFunction) {
            this.game.emitFunction('auctionUpdated', result);
            this.game.emitFunction('gameState', this.game.getGameState());
            this.game.emitFunction('message', `🤖 ${bot.name} pasiūlė €${bidAmount} už ${auction.fieldName}!`);
        }
    }

    // 🆕 Boto sprendimas – ar bid'inti aukcione?
    botShouldBidAuction(bot, auction) {
        if (!bot || !auction) return { can: false, reason: 'Nėra duomenų' };
        
        const field = this.game.board.find(f => f.id === auction.fieldId);
        if (!field) return { can: false, reason: 'Kortelė nerasta' };
        
        // 🆕 1. Ar turi pakankamai pinigų?
        const minMoney = auction.currentBid * 1.5;
        if (bot.money < minMoney) {
            return { can: false, reason: 'nepakanka pinigų' };
        }
        
        // 🆕 2. Ar verta? (ROI analizė)
        const baseRent = field.cost * C.RENT_BASE_RATIO;
        const roi = (baseRent * 10) / field.cost;
        
        // 🆕 3. Ar service1/2/3 – visada verta
        const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
        
        // 🆕 4. Kiek verta mokėti?
        let maxBid = Math.floor(field.cost * 1.2);  // Max 120% vertės
        
        // 🆕 Jei turi grupę – verta daugiau
        if (field.color) {
            const group = C.COLOR_GROUPS[field.color] || [];
            const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;
            
            if (ownedInGroup >= 1) {
                maxBid = Math.floor(field.cost * 1.8);  // 180% jei turi grupę
            }
            
            if (ownedInGroup >= group.length - 1) {
                maxBid = Math.floor(field.cost * 2.5);  // 250% jei trūksta 1
            }
        }
        
        // 🆕 Service – verta 150%
        if (isService) {
            maxBid = Math.floor(field.cost * 1.5);
        }
        
        // 🆕 Negali viršyti savo pinigų
        if (maxBid > bot.money * 0.7) {
            maxBid = Math.floor(bot.money * 0.7);
        }
        
        // 🆕 5. Ar dabartinis bid jau per didelis?
        if (auction.currentBid >= maxBid) {
            return { can: false, reason: 'per brangu' };
        }
        
        // 🆕 6. Bid'as – šiek tiek daugiau nei dabartinis (5-15%)
        const increment = 1.05 + Math.random() * 0.10;
        let bidAmount = Math.ceil(auction.currentBid * increment);
        
        // 🆕 Negali viršyti maxBid
        if (bidAmount > maxBid) {
            bidAmount = maxBid;
        }
        
        // 🆕 Turi būti didesnis už dabartinį
        if (bidAmount <= auction.currentBid) {
            bidAmount = auction.currentBid + 1;
        }
        
        // 🆕 Negali viršyti bot.money
        if (bidAmount > bot.money) {
            return { can: false, reason: 'nepakanka pinigų bid\'ui' };
        }
        
        // 🆕 Atsitiktinumas – ar tikrai bid'ins (70%)
        if (Math.random() > 0.7) {
            return { can: false, reason: 'atsitiktinai praleidžia' };
        }
        
        return { can: true, amount: bidAmount };
    }

    // ============================================
    // SIŪLYTI AUKCIONE
    // ============================================
    bidAuction(playerId, auctionId, bidAmount) {
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.isActive) return { error: 'Aukcionas neaktyvus' };
        
        if (auction.sellerId === playerId) {
            return { error: 'Tu esi pardavėjas - negali siūlyti savo aukcione!' };
        }
        
        if (Date.now() > auction.endTime) {
            return { error: 'Aukcionas jau baigėsi' };
        }

        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (player.left) return { error: 'Žaidėjas pasitraukęs' };
        if (player.kicked) return { error: 'Žaidėjas pašalintas' };
        if (player.money < bidAmount) return { error: 'Neturi tiek pinigų' };
        
        if (bidAmount <= auction.currentBid) {
            return { error: `Siūlyk daugiau nei €${auction.currentBid}!` };
        }

        auction.currentBid = bidAmount;
        auction.currentBidder = playerId;
        auction.currentBidderName = player.name;
        
        const existing = auction.bidders.find(b => b.playerId === playerId);
        if (existing) {
            existing.bid = bidAmount;
        } else {
            auction.bidders.push({ 
                playerId: playerId, 
                playerName: player.name,
                bid: bidAmount 
            });
        }

        auction.endTime = Date.now() + C.AUCTION_EXTENSION;
        
        if (auction.timer) {
            clearTimeout(auction.timer);
        }
        auction.timer = setTimeout(() => {
            this.endAuctionServerSide(auctionId);
        }, C.AUCTION_EXTENSION);

        this.game.addMessage(`💰 ${player.name} pasiūlė €${bidAmount} už ${auction.fieldName}!`);

        return { 
            success: true, 
            auctionId: auctionId,
            fieldId: auction.fieldId,
            fieldName: auction.fieldName,
            currentBid: bidAmount,
            currentBidder: playerId,
            currentBidderName: player.name,
            endTime: auction.endTime
        };
    }

    endAuctionServerSide(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return;
        
        console.log(`🔨 Server-side endAuction: ${auctionId}`);
        
        const result = this.endAuction(auctionId);
        
        if (result && this.game.emitFunction) {
            this.game.emitFunction('auctionEnded', result);
            this.game.emitFunction('gameState', this.game.getGameState());
            
            if (result.winnerId === 'bank') {
                this.game.emitFunction('message', `🏦 Bankas laimėjo aukcioną: ${result.fieldName} už €${result.finalBid}`);
            } else if (result.winnerName) {
                this.game.emitFunction('message', `🔨 ${result.winnerName} laimėjo aukcioną: ${result.fieldName} už €${result.finalBid}!`);
            }
        }
    }

    endAuction(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return null;
        
        if (auction.timer) {
            clearTimeout(auction.timer);
            auction.timer = null;
        }
        
        auction.isActive = false;
        
        let winner = null;
        let winnerId = null;
        let winnerName = null;

        const seller = this.getPlayer(auction.sellerId);
        
        if (auction.currentBidder === 'bank') {
            if (seller) {
                seller.money += auction.currentBid;
                if (seller.money >= 0) {
                    seller.isDebtor = false;
                }
            }
            
            this.game.addMessage(`🏦 Bankas laimėjo aukcioną: ${auction.fieldName} už €${auction.currentBid}. Kortelė grąžinta į rinką.`);
            
            this.auctions.delete(auctionId);
            
            return { 
                winner: 'bank',
                winnerId: 'bank',
                winnerName: '🏦 Bankas',
                fieldId: auction.fieldId,
                fieldName: auction.fieldName,
                finalBid: auction.currentBid,
                sellerId: auction.sellerId,
                sellerName: auction.sellerName,
                returnedToMarket: true
            };
        }
        
        winnerId = auction.currentBidder;
        winner = this.getPlayer(winnerId);
        
        if (winner) {
            winnerName = winner.name;
            
            winner.properties.push(auction.fieldId);
            winner.money -= auction.currentBid;
            
            if (seller) {
                seller.money += auction.currentBid;
                if (seller.money >= 0) {
                    seller.isDebtor = false;
                }
            }
            
            this.game.addMessage(`🔨 ${winner.name} laimėjo aukcioną: ${auction.fieldName} už €${auction.currentBid}!`);
        }

        this.auctions.delete(auctionId);
        
        return { 
            winner: winnerId, 
            winnerId: winnerId,
            winnerName: winnerName,
            fieldId: auction.fieldId,
            fieldName: auction.fieldName,
            finalBid: auction.currentBid,
            sellerId: auction.sellerId,
            sellerName: auction.sellerName,
            returnedToMarket: false
        };
    }

    // ============================================
    // 3. SIŪLYTI ŽAIDĖJUI
    // ============================================
    proposeTrade(playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (player.left) return { error: 'Žaidėjas pasitraukęs' };
        if (player.kicked) return { error: 'Žaidėjas pašalintas' };
        
        if (playerId === targetPlayerId) return { error: 'Negali siūlyti sau' };

        const target = this.getPlayer(targetPlayerId);
        if (!target || target.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (target.left) return { error: 'Žaidėjas pasitraukęs' };
        if (target.kicked) return { error: 'Žaidėjas pašalintas' };

        if (offerFieldIds && offerFieldIds.length > 0) {
            for (const fieldId of offerFieldIds) {
                if (!player.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Neturi siūlomos kortelės: ${field ? field.name : fieldId}` };
                }
                if (this.hasHouses(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Negali siūlyti kortelės su namais: ${field ? field.name : fieldId}` };
                }
                if (this.hasHousesInGroup(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Negali siūlyti ${field ? field.name : fieldId} – grupėje yra pastatytų namų!` };
                }
            }
        }

        if (requestFieldIds && requestFieldIds.length > 0) {
            for (const fieldId of requestFieldIds) {
                if (!target.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Gavėjas neturi prašomos kortelės: ${field ? field.name : fieldId}` };
                }
                if (this.hasHouses(targetPlayerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Negali prašyti kortelės su namais: ${field ? field.name : fieldId}` };
                }
                if (this.hasHousesInGroup(targetPlayerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: `Negali prašyti ${field ? field.name : fieldId} – grupėje yra pastatytų namų!` };
                }
            }
        }

        const tradeId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        
        this.trades.set(tradeId, {
            fromPlayer: playerId,
            toPlayer: targetPlayerId,
            offerFieldIds: offerFieldIds || [],
            requestFieldIds: requestFieldIds || [],
            offerMoney: offerMoney || 0,
            requestMoney: requestMoney || 0,
            status: 'pending',
            counterOffer: null,
            timestamp: Date.now()
        });

        let offerNames = 'pinigai';
        if (offerFieldIds && offerFieldIds.length > 0) {
            const names = offerFieldIds.map(id => {
                const field = this.game.board.find(f => f.id === id);
                return field ? field.name : `ID:${id}`;
            }).filter(name => name);
            if (names.length > 0) {
                offerNames = names.join(', ');
            }
        }
        
        let requestNames = 'pinigai';
        if (requestFieldIds && requestFieldIds.length > 0) {
            const names = requestFieldIds.map(id => {
                const field = this.game.board.find(f => f.id === id);
                return field ? field.name : `ID:${id}`;
            }).filter(name => name);
            if (names.length > 0) {
                requestNames = names.join(', ');
            }
        }
        
        let offerMoneyMsg = offerMoney > 0 ? ` + €${offerMoney}` : '';
        let requestMoneyMsg = requestMoney > 0 ? ` + €${requestMoney}` : '';
        
        this.game.addMessage(`📩 ${player.name} pasiūlė ${target.name}: ${offerNames}${offerMoneyMsg} ⇄ ${requestNames}${requestMoneyMsg}`);

        if (target.isBot === true) {
            console.log(`🤖 ${target.name} yra botas – apdorojamas prekybos pasiūlymas`);
            
            setTimeout(() => {
                this.game.processBotTradeResponse(targetPlayerId, tradeId);
            }, 100);
        }

        return {
            success: true,
            tradeId: tradeId,
            fromPlayer: player.name,
            toPlayer: target.name,
            offerField: offerNames,
            requestField: requestNames,
            offerMoney: offerMoney,
            requestMoney: requestMoney,
            offerFieldIds: offerFieldIds,
            requestFieldIds: requestFieldIds
        };
    }

    respondToTrade(tradeId, playerId, accept) {
        const trade = this.trades.get(tradeId);
        
        if (!trade) return { error: 'Pasiūlymas nerastas' };
        if (trade.toPlayer !== playerId) return { error: 'Ne tau skirtas šis pasiūlymas' };
        if (trade.status !== 'pending') return { error: 'Pasiūlymas jau atsakytas' };

        if (accept) {
            const fromPlayer = this.getPlayer(trade.fromPlayer);
            const toPlayer = this.getPlayer(trade.toPlayer);
            
            if (!fromPlayer || fromPlayer.bankrupt) {
                trade.status = 'rejected';
                return { error: 'Siūlytojas neaktyvus' };
            }
            if (!toPlayer || toPlayer.bankrupt) {
                trade.status = 'rejected';
                return { error: 'Gavėjas neaktyvus' };
            }

            if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
                for (const fieldId of trade.offerFieldIds) {
                    if (!fromPlayer.properties.includes(fieldId)) {
                        trade.status = 'rejected';
                        const field = this.game.board.find(f => f.id === fieldId);
                        return { error: `Siūlytojas nebeturi kortelės: ${field ? field.name : fieldId}` };
                    }
                }
            }

            if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
                for (const fieldId of trade.requestFieldIds) {
                    if (!toPlayer.properties.includes(fieldId)) {
                        trade.status = 'rejected';
                        const field = this.game.board.find(f => f.id === fieldId);
                        return { error: `Gavėjas nebeturi kortelės: ${field ? field.name : fieldId}` };
                    }
                }
            }

            if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
                for (const fieldId of trade.offerFieldIds) {
                    fromPlayer.properties = fromPlayer.properties.filter(id => id !== fieldId);
                    toPlayer.properties.push(fieldId);
                    if (fromPlayer.houses) {
                        delete fromPlayer.houses[fieldId];
                    }
                }
            }

            if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
                for (const fieldId of trade.requestFieldIds) {
                    toPlayer.properties = toPlayer.properties.filter(id => id !== fieldId);
                    fromPlayer.properties.push(fieldId);
                    if (toPlayer.houses) {
                        delete toPlayer.houses[fieldId];
                    }
                }
            }

            if (trade.offerMoney > 0) {
                fromPlayer.money -= trade.offerMoney;
                toPlayer.money += trade.offerMoney;
            }
            if (trade.requestMoney > 0) {
                toPlayer.money -= trade.requestMoney;
                fromPlayer.money += trade.requestMoney;
            }

            trade.status = 'accepted';
            
            const message = `✅ Prekyba įvykdyta tarp ${fromPlayer.name} ir ${toPlayer.name}!`;
            this.game.addMessage(message);
            this.game.turnHistory.push({
                player: fromPlayer.name,
                action: 'trade_accepted',
                target: toPlayer.name,
                timestamp: new Date().toISOString()
            });
            
            this.trades.delete(tradeId);
            
            if (fromPlayer.money >= 0) fromPlayer.isDebtor = false;
            if (toPlayer.money >= 0) toPlayer.isDebtor = false;
            
            return { success: true, message: message };
        } else {
            trade.status = 'rejected';
            const player = this.getPlayer(playerId);
            this.game.addMessage(`❌ ${player?.name || 'Žaidėjas'} atmetė pasiūlymą`);
            this.trades.delete(tradeId);
            return { success: false, message: 'Pasiūlymas atmestas' };
        }
    }

    counterTrade(tradeId, playerId, newOfferFieldIds, newRequestFieldIds, newOfferMoney, newRequestMoney) {
        const trade = this.trades.get(tradeId);
        if (!trade) return { error: 'Pasiūlymas nerastas' };
        if (trade.toPlayer !== playerId) return { error: 'Ne tau skirtas šis pasiūlymas' };
        if (trade.status !== 'pending') return { error: 'Pasiūlymas jau atsakytas' };

        const fromPlayer = this.getPlayer(trade.fromPlayer);
        const toPlayer = this.getPlayer(trade.toPlayer);
        
        if (!fromPlayer || fromPlayer.bankrupt) return { error: 'Siūlytojas neaktyvus' };
        if (!toPlayer || toPlayer.bankrupt) return { error: 'Gavėjas neaktyvus' };

        const newTradeId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        
        this.trades.set(newTradeId, {
            fromPlayer: playerId,
            toPlayer: trade.fromPlayer,
            offerFieldIds: newOfferFieldIds || [],
            requestFieldIds: newRequestFieldIds || [],
            offerMoney: newOfferMoney || 0,
            requestMoney: newRequestMoney || 0,
            status: 'pending',
            counterOffer: true,
            timestamp: Date.now()
        });

        trade.status = 'countered';

        this.game.addMessage(`🔄 ${toPlayer.name} pakoregavo pasiūlymą ${fromPlayer.name}`);
        
        return { 
            success: true, 
            tradeId: newTradeId,
            message: 'Pakoreguotas pasiūlymas išsiųstas'
        };
    }

    getActiveAuctions() {
        const result = [];
        for (const [id, auction] of this.auctions) {
            if (auction.isActive) {
                result.push({
                    auctionId: id,
                    fieldId: auction.fieldId,
                    fieldName: auction.fieldName,
                    fieldIcon: auction.fieldIcon || '',
                    fieldColor: auction.fieldColor || null,
                    fieldType: auction.fieldType || 'property',
                    currentBid: auction.currentBid,
                    currentBidder: auction.currentBidder,
                    currentBidderName: auction.currentBidderName,
                    endTime: auction.endTime,
                    sellerId: auction.sellerId,
                    sellerName: auction.sellerName
                });
            }
        }
        return result;
    }

    getPendingTrades(playerId) {
        const result = [];
        for (const [id, trade] of this.trades) {
            if (trade.status === 'pending' && trade.toPlayer === playerId) {
                const fromPlayer = this.getPlayer(trade.fromPlayer);
                let offerNames = 'pinigai';
                if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
                    const names = trade.offerFieldIds.map(fid => {
                        const field = this.game.board.find(f => f.id === fid);
                        return field ? field.name : `ID:${fid}`;
                    }).filter(name => name);
                    if (names.length > 0) {
                        offerNames = names.join(', ');
                    }
                }
                let requestNames = 'pinigai';
                if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
                    const names = trade.requestFieldIds.map(fid => {
                        const field = this.game.board.find(f => f.id === fid);
                        return field ? field.name : `ID:${fid}`;
                    }).filter(name => name);
                    if (names.length > 0) {
                        requestNames = names.join(', ');
                    }
                }
                    
                result.push({
                    tradeId: id,
                    fromPlayer: fromPlayer ? fromPlayer.name : 'nežinomas',
                    offerField: offerNames,
                    requestField: requestNames,
                    offerMoney: trade.offerMoney,
                    requestMoney: trade.requestMoney
                });
            }
        }
        return result;
    }
}

module.exports = TradingLogic;