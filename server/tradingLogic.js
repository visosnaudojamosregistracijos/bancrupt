// ============================================
// PREKYBOS LOGIKA
// ============================================

class TradingLogic {
    constructor(game) {
        this.game = game;
        this.auctions = new Map();
        this.trades = new Map();
        this.utilityIds = [2, 14, 29, 45];
        this.serviceIds = [8, 19, 40, 47];
    }

    // ============================================
    // PATIKRINTI AR KORTELĖ TURI NAMŲ
    // ============================================
    hasHouses(playerId, fieldId) {
        const player = this.game.players[playerId];
        if (!player) return false;
        return player.houses && player.houses[fieldId] && player.houses[fieldId] > 0;
    }

    // ============================================
    // GAUTI KORTELĖS VERTĘ (80% PARDavimui BANKUI)
    // ============================================
    getBankBuybackPrice(fieldId) {
        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) return 0;
        return Math.floor(field.cost * 0.8);
    }

    // ============================================
    // GAUTI ŽAIDĖJO TURIMAS KORTELES (BE NAMŲ)
    // ============================================
    getPlayerTradableProperties(playerId) {
        const player = this.game.players[playerId];
        if (!player) return [];

        return player.properties.filter(fieldId => {
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            return houses === 0;
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

    // ============================================
    // GAUTI VISAS ŽAIDĖJO TURIMAS KORTELES (SU NAMAIS)
    // ============================================
    getAllPlayerProperties(playerId) {
        const player = this.game.players[playerId];
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
        const player = this.game.players[playerId];
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (this.game.currentTurn !== playerId) return { error: 'Ne tavo eilė' };

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
        console.log('🔨🔨🔨 startAuction iškviesta:', { playerId, fieldId });
        
        const player = this.game.players[playerId];
        if (!player || player.bankrupt) {
            console.log('❌ Žaidėjas neaktyvus');
            return { error: 'Žaidėjas neaktyvus' };
        }
        if (this.game.currentTurn !== playerId) {
            console.log('❌ Ne tavo eilė');
            return { error: 'Ne tavo eilė' };
        }
        if (!player.properties.includes(fieldId)) {
            console.log('❌ Neturi šios kortelės');
            return { error: 'Neturi šios kortelės' };
        }

        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) {
            console.log('❌ Turi namų');
            return { error: 'Negali aukcionuoti kortelės su namais!' };
        }

        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) {
            console.log('❌ Kortelė nerasta');
            return { error: 'Kortelė nerasta' };
        }

        console.log('🔨 Rasta kortelė:', field);

        const auctionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        const endTime = Date.now() + 60000;
        const startPrice = Math.floor(field.cost * 0.5);
        
        console.log('🔨 Kuriamas aukcionas:', { auctionId, fieldId, sellerId: playerId, startPrice });

        this.auctions.set(auctionId, {
            fieldId: fieldId,
            sellerId: playerId,
            currentBid: startPrice,
            bidders: [],
            endTime: endTime,
            isActive: true,
            winner: null
        });

        // Pašalinti kortelę iš pardavėjo
        player.properties = player.properties.filter(id => id !== fieldId);
        if (player.houses) {
            delete player.houses[fieldId];
        }

        this.game.addMessage(`🔨 ${player.name} paskelbė aukcioną: ${field.name}! Siūlykite!`);

        const result = { 
            success: true, 
            auctionId: auctionId,
            fieldId: fieldId,
            fieldName: field.name,
            fieldCost: field.cost,
            sellerId: playerId,
            sellerName: player.name,
            currentBid: startPrice,
            endTime: endTime
        };

        console.log('🔨🔨🔨 AUKCIONAS SUKURTAS, GRAŽINAMA:', JSON.stringify(result, null, 2));

        return result;
    }

    // ============================================
    // SIŪLYTI AUKCIONE
    // ============================================
    bidAuction(playerId, auctionId, bidAmount) {
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.isActive) return { error: 'Aukcionas neaktyvus' };
        if (auction.sellerId === playerId) return { error: 'Negali siūlyti savo aukcione' };
        if (Date.now() > auction.endTime) {
            return this.endAuction(auctionId);
        }

        const player = this.game.players[playerId];
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (player.money < bidAmount) return { error: 'Neturi tiek pinigų' };
        if (bidAmount <= auction.currentBid) return { error: 'Pasiūlyk daugiau nei dabartinė kaina' };

        auction.currentBid = bidAmount;
        
        const existing = auction.bidders.find(b => b.playerId === playerId);
        if (existing) {
            existing.bid = bidAmount;
        } else {
            auction.bidders.push({ playerId, bid: bidAmount });
        }

        auction.endTime = Date.now() + 10000;

        const field = this.game.board.find(f => f.id === auction.fieldId);
        this.game.addMessage(`💰 ${player.name} pasiūlė €${bidAmount} už ${field ? field.name : 'kortelę'}`);

        return { 
            success: true, 
            currentBid: bidAmount,
            bidder: player.name,
            endTime: auction.endTime
        };
    }

    // ============================================
    // BAIGTI AUKCIONĄ
    // ============================================
    endAuction(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return null;
        
        console.log('🔨🔨🔨 endAuction iškviesta:', auctionId);
        
        auction.isActive = false;
        const field = this.game.board.find(f => f.id === auction.fieldId);
        let winner = null;
        let winnerId = null;

        if (auction.bidders.length > 0) {
            const sorted = auction.bidders.sort((a, b) => b.bid - a.bid);
            const winnerData = sorted[0];
            winner = this.game.players[winnerData.playerId];
            winnerId = winnerData.playerId;
            
            console.log('🔨🔨🔨 Aukciono laimėtojas:', winner?.name, 'už €', winnerData.bid);
            
            if (winner) {
                winner.properties.push(auction.fieldId);
                winner.money -= winnerData.bid;
                console.log(`💰 ${winner.name} sumokėjo €${winnerData.bid} ir gavo ${field ? field.name : 'kortelę'}`);
                
                const seller = this.game.players[auction.sellerId];
                if (seller) {
                    seller.money += winnerData.bid;
                    console.log(`💰 ${seller.name} gavo €${winnerData.bid} iš aukciono`);
                }
                
                this.game.addMessage(`🔨 ${winner.name} laimėjo aukcioną: ${field ? field.name : 'kortelė'} už €${winnerData.bid}!`);
            }
        } else {
            const seller = this.game.players[auction.sellerId];
            if (seller) {
                seller.properties.push(auction.fieldId);
                this.game.addMessage(`⏳ Aukcionas ${field ? field.name : 'kortelė'} baigėsi be pasiūlymų - kortelė grąžinta ${seller.name}`);
            }
        }

        this.auctions.delete(auctionId);
        
        return { 
            winner: winnerId, 
            winnerName: winner ? winner.name : null,
            fieldId: auction.fieldId,
            fieldName: field ? field.name : null,
            finalBid: auction.currentBid
        };
    }

    // ============================================
    // 3. SIŪLYTI ŽAIDĖJUI
    // ============================================
    proposeTrade(playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney) {
        const player = this.game.players[playerId];
        if (!player || player.bankrupt) return { error: 'Žaidėjas neaktyvus' };
        if (this.game.currentTurn !== playerId) return { error: 'Ne tavo eilė' };
        if (playerId === targetPlayerId) return { error: 'Negali siūlyti sau' };

        const target = this.game.players[targetPlayerId];
        if (!target || target.bankrupt) return { error: 'Žaidėjas neaktyvus' };

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

    // ============================================
    // ATSAKYTI Į SIŪLYMĄ
    // ============================================
    respondToTrade(tradeId, playerId, accept) {
        const trade = this.trades.get(tradeId);
        console.log('🔄🔄🔄 respondToTrade iškviesta:', { tradeId, playerId, accept });
        
        if (!trade) return { error: 'Pasiūlymas nerastas' };
        if (trade.toPlayer !== playerId) return { error: 'Ne tau skirtas šis pasiūlymas' };
        if (trade.status !== 'pending') return { error: 'Pasiūlymas jau atsakytas' };

        if (accept) {
            const fromPlayer = this.game.players[trade.fromPlayer];
            const toPlayer = this.game.players[trade.toPlayer];
            
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
            
            console.log('✅ Prekyba sėkminga!');
            return { success: true, message: message };
        } else {
            trade.status = 'rejected';
            const player = this.game.players[playerId];
            this.game.addMessage(`❌ ${player?.name || 'Žaidėjas'} atmetė pasiūlymą`);
            this.trades.delete(tradeId);
            return { success: false, message: 'Pasiūlymas atmestas' };
        }
    }

    // ============================================
    // KOREKTYUOTI SIŪLYMĄ
    // ============================================
    counterTrade(tradeId, playerId, newOfferFieldIds, newRequestFieldIds, newOfferMoney, newRequestMoney) {
        const trade = this.trades.get(tradeId);
        if (!trade) return { error: 'Pasiūlymas nerastas' };
        if (trade.toPlayer !== playerId) return { error: 'Ne tau skirtas šis pasiūlymas' };
        if (trade.status !== 'pending') return { error: 'Pasiūlymas jau atsakytas' };

        const fromPlayer = this.game.players[trade.fromPlayer];
        const toPlayer = this.game.players[trade.toPlayer];
        
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

    // ============================================
    // GAUTI AKTYVIUS AUKCIONUS
    // ============================================
    getActiveAuctions() {
        const result = [];
        for (const [id, auction] of this.auctions) {
            if (auction.isActive) {
                const field = this.game.board.find(f => f.id === auction.fieldId);
                result.push({
                    auctionId: id,
                    fieldId: auction.fieldId,
                    fieldName: field ? field.name : 'Nežinoma',
                    currentBid: auction.currentBid,
                    endTime: auction.endTime,
                    sellerId: auction.sellerId,
                    bidders: auction.bidders
                });
            }
        }
        return result;
    }

    // ============================================
    // GAUTI LAUKIANČIUS PASIŪLYMUS
    // ============================================
    getPendingTrades(playerId) {
        const result = [];
        for (const [id, trade] of this.trades) {
            if (trade.status === 'pending' && trade.toPlayer === playerId) {
                const fromPlayer = this.game.players[trade.fromPlayer];
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