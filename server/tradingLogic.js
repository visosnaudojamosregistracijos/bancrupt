// ============================================
// server/tradingLogic.js
// ============================================

const C = require('./gameConstants');

const { L } = require('./i18nSrv');   // 🌐 tekstai iš lang/lt.json
class TradingLogic {
    constructor(game) {
        this.game = game;
        this.auctions = new Map();
        this.trades = new Map();
        this.utilityIds = C.SERVICE1_IDS;
        this.serviceIds = C.SERVICE2_IDS;
        this.specialIds = C.SERVICE3_IDS;
    }

    // 🛡️ Sumos: tik sveikas teigiamas skaičius
    normMoney(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return null;
        return Math.floor(n);
    }

    // 🛡️ Kortelių sąrašas: tik masyvas, tik sveiki skaičiai, be pasikartojimų
    normFieldIds(list) {
        if (list === undefined || list === null) return [];
        if (!Array.isArray(list)) return null;
        const out = [];
        for (const x of list) {
            const n = Number(x);
            if (!Number.isInteger(n)) return null;
            if (!out.includes(n)) out.push(n);
        }
        return out;
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
    sellToBank(playerId, fieldIds, isBailiff = false) {
    fieldIds = this.normFieldIds(fieldIds);
    if (!fieldIds || fieldIds.length === 0) return { error: L('srv.trade.pasirink_bent_viena_kortele') };
    const player = this.getPlayer(playerId);
    if (!player || player.bankrupt) return { error: L('srv.game.zaidejas_neaktyvus') };
    if (player.left) return { error: L('srv.trade.zaidejas_pasitraukes') };
    if (player.kicked) return { error: L('srv.trade.zaidejas_pasalintas') };

    let totalPrice = 0;
    const soldFields = [];

    for (const fieldId of fieldIds) {
        if (!player.properties.includes(fieldId)) {
            return { error: L('srv.trade.neturi_korteles', { fieldId }) };
        }
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) {
            const field = this.game.board.find(f => f.id === fieldId);
            return { error: L('srv.trade.negali_parduoti_turi_namu', { v: field ? field.name : L('srv.word.cardGen') }) };
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
    
    // 🆕 SKIRTINGI PRANEŠIMAI
    let message;
    if (isBailiff) {
        // 🏛️ AFK – antstoliai
        message = L('srv.trade.anstoliai_konfiskavo_sklypa_us_uz', { player: player.name, v: soldFields.length, totalPrice });
    } else {
        // 🏦 Žaidėjas pats
        message = L('srv.trade.pardave_kortele_es_bankui_uz', { player: player.name, v: soldFields.length, totalPrice });
    }
    
    this.game.addMessage(message);

    if (player.money >= 0) {
        player.isDebtor = false;
    }

    return { 
        success: true, 
        soldFields: soldFields,
        totalPrice: totalPrice,
        message: message,
        isBailiff: isBailiff
    };
}

    // ============================================
    // 2. PRADĖTI AUKCIONĄ
    // ============================================
    startAuction(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) {
            return { error: L('srv.game.zaidejas_neaktyvus') };
        }
        if (player.left) {
            return { error: L('srv.trade.zaidejas_pasitraukes') };
        }
        if (player.kicked) {
            return { error: L('srv.trade.zaidejas_pasalintas') };
        }

        if (!player.properties.includes(fieldId)) {
            return { error: L('srv.trade.neturi_sios_korteles') };
        }

        // 🛡️ Vienu metu – tik vienas aukcionas (langas rodo vieną)
        if ([...this.auctions.values()].some(x => x.isActive)) {
            return { error: L('srv.trade.jau_vyksta_kitas_aukcionas_palauk') };
        }

        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) {
            return { error: L('srv.trade.negali_aukcionuoti_korteles_su_namais') };
        }
        
        if (this.hasHousesInGroup(playerId, fieldId)) {
            return { error: L('srv.trade.negali_aukcionuoti_grupeje_yra_pastatytu') };
        }

        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) {
            return { error: L('srv.trade.kortele_nerasta') };
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

        this.game.addMessage(L('srv.trade.paskelbe_aukciona_bankas_siulo', { player: player.name, field: field.name, startPrice }));

        const auction = this.auctions.get(auctionId);
        const timeLeft = endTime - Date.now();
        auction.timer = setTimeout(() => {
            this.endAuctionServerSide(auctionId);
        }, timeLeft);

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
        
        bots.forEach(bot => {
            setTimeout(() => {
                this.botBidAuction(bot.id, auctionId);
            }, 2000 + Math.random() * 3000);
        });
    }

    async botBidAuction(botId, auctionId) {
        const bot = this.game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.isActive) return;
        
        if (auction.sellerId === botId) return;
        if (auction.currentBidder === botId) return;   // jau pirmauja – savęs nepersiūlo
        if (Date.now() > auction.endTime) return;
        
        const shouldBid = this.botShouldBidAuction(bot, auction);
        if (!shouldBid.can) {
            console.log(`🤖 ${bot.name}: nebid'ina ${auction.fieldName} (${shouldBid.reason})`);
            return;
        }
        
        const bidAmount = shouldBid.amount;
        
        console.log(`🤖 ${bot.name}: bid'ina €${bidAmount} už ${auction.fieldName}`);
        
        const result = this.bidAuction(botId, auctionId, bidAmount);
        
        if (result.error) {
            console.log(`🤖 ${bot.name}: bid klaida:`, result.error);
            return;
        }
        
        if (this.game.emitFunction) {
            this.game.emitFunction('auctionUpdated', result);
            this.game.emitFunction('gameState', this.game.getGameState());
            this.game.emitFunction('message', L('srv.trade.pasiule_uz', { bot: bot.name, bidAmount, fieldName: auction.fieldName }));
        }
    }

    botShouldBidAuction(bot, auction) {
        if (!bot || !auction) return { can: false, reason: L('srv.trade.nera_duomenu') };
        
        const field = this.game.board.find(f => f.id === auction.fieldId);
        if (!field) return { can: false, reason: L('srv.trade.kortele_nerasta') };
        
        const minMoney = auction.currentBid * 1.5;
        if (bot.money < minMoney) {
            return { can: false, reason: L('srv.trade.nepakanka_pinigu') };
        }
        
        const baseRent = field.cost * C.RENT_BASE_RATIO;
        const roi = (baseRent * 10) / field.cost;
        
        const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
        
        let maxBid = Math.floor(field.cost * 1.2);
        
        if (field.color) {
            const group = C.COLOR_GROUPS[field.color] || [];
            const ownedInGroup = bot.properties.filter(id => group.includes(id)).length;
            
            if (ownedInGroup >= 1) {
                maxBid = Math.floor(field.cost * 1.8);
            }
            
            if (ownedInGroup >= group.length - 1) {
                maxBid = Math.floor(field.cost * 2.5);
            }
        }
        
        if (isService) {
            maxBid = Math.floor(field.cost * 1.5);
        }
        
        if (maxBid > bot.money * 0.7) {
            maxBid = Math.floor(bot.money * 0.7);
        }
        
        if (auction.currentBid >= maxBid) {
            return { can: false, reason: L('srv.trade.per_brangu') };
        }
        
        const increment = 1.05 + Math.random() * 0.10;
        let bidAmount = Math.ceil(auction.currentBid * increment);
        
        if (bidAmount > maxBid) {
            bidAmount = maxBid;
        }
        
        if (bidAmount <= auction.currentBid) {
            bidAmount = auction.currentBid + 1;
        }
        
        if (bidAmount > bot.money) {
            return { can: false, reason: L('srv.trade.nepakanka_pinigu_bid_ui') };
        }
        
        if (Math.random() > 0.7) {
            return { can: false, reason: L('srv.trade.atsitiktinai_praleidzia') };
        }
        
        return { can: true, amount: bidAmount };
    }

    // ============================================
    // SIŪLYTI AUKCIONE
    // ============================================
    bidAuction(playerId, auctionId, bidAmount) {
        bidAmount = this.normMoney(bidAmount);
        if (bidAmount === null) return { error: L('srv.trade.neteisinga_suma') };
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.isActive) return { error: L('srv.trade.aukcionas_neaktyvus') };
        
        if (auction.sellerId === playerId) {
            return { error: L('srv.trade.tu_esi_pardavejas_negali_siulyti') };
        }
        
        if (Date.now() > auction.endTime) {
            return { error: L('srv.trade.aukcionas_jau_baigesi') };
        }

        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return { error: L('srv.game.zaidejas_neaktyvus') };
        if (player.left) return { error: L('srv.trade.zaidejas_pasitraukes') };
        if (player.kicked) return { error: L('srv.trade.zaidejas_pasalintas') };
        if (player.money < bidAmount) return { error: L('srv.trade.neturi_tiek_pinigu') };
        
        // 🛡️ Didžiausią sumą jau pasiūlęs žaidėjas negali persiūlyti pats savęs (ir taip pratęsti aukciono)
        if (auction.currentBidder === playerId) {
            return { error: L('srv.trade.tavo_pasiulymas_jau_didziausias') };
        }

        if (bidAmount <= auction.currentBid) {
            return { error: L('srv.trade.siulyk_daugiau_nei', { currentBid: auction.currentBid }) };
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

        this.game.addMessage(L('srv.trade.pasiule_uz_2', { player: player.name, bidAmount, fieldName: auction.fieldName }));

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
                this.game.emitFunction('message', L('srv.trade.bankas_laimejo_aukciona_uz', { fieldName: result.fieldName, finalBid: result.finalBid }));
            } else if (result.winnerName) {
                this.game.emitFunction('message', L('srv.trade.laimejo_aukciona_uz', { winnerName: result.winnerName, fieldName: result.fieldName, finalBid: result.finalBid }));
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
        
        this.game.addMessage(L('srv.trade.bankas_laimejo_aukciona_uz_kortele', { fieldName: auction.fieldName, currentBid: auction.currentBid }));
        
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
        
        // 🆕 Išvalyti winner isDebtor, jei nebe minusе
        if (winner.money >= 0 && winner.isDebtor) {
            winner.isDebtor = false;
            console.log(`✅ ${winner.name}: isDebtor → false po aukciono laimėjimo (money: €${winner.money})`);
        }
        
        if (seller) {
            seller.money += auction.currentBid;
            if (seller.money >= 0) {
                seller.isDebtor = false;
            }
        }
        
        this.game.addMessage(L('srv.trade.laimejo_aukciona_uz_2', { winner: winner.name, fieldName: auction.fieldName, currentBid: auction.currentBid }));
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
        offerFieldIds = this.normFieldIds(offerFieldIds);
        requestFieldIds = this.normFieldIds(requestFieldIds);
        offerMoney = this.normMoney(offerMoney || 0);
        requestMoney = this.normMoney(requestMoney || 0);
        if (!offerFieldIds || !requestFieldIds || offerMoney === null || requestMoney === null) {
            return { error: L('srv.trade.neteisingi_pasiulymo_duomenys') };
        }
        if (offerFieldIds.length > 3 || requestFieldIds.length > 3) {
            return { error: L('srv.trade.galima_siulyti_ir_prasyti_daugiausiai') };
        }
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return { error: L('srv.game.zaidejas_neaktyvus') };
        if (player.left) return { error: L('srv.trade.zaidejas_pasitraukes') };
        if (player.kicked) return { error: L('srv.trade.zaidejas_pasalintas') };
        
        if (playerId === targetPlayerId) return { error: L('srv.trade.negali_siulyti_sau') };

        const target = this.getPlayer(targetPlayerId);
        if (!target || target.bankrupt) return { error: L('srv.game.zaidejas_neaktyvus') };
        if (target.left) return { error: L('srv.trade.zaidejas_pasitraukes') };
        if (target.kicked) return { error: L('srv.trade.zaidejas_pasalintas') };

        // 🛡️ Negalima siūlyti daugiau pinigų nei turi, nei prašyti daugiau nei turi kitas
        if (offerMoney > Math.max(0, player.money)) return { error: L('srv.trade.neturi_tiek_pinigu_turi', { money: player.money }) };
        if (requestMoney > Math.max(0, target.money)) return { error: L('srv.trade.neturi_tiek_pinigu_turi_2', { target: target.name, money: target.money }) };

        if (offerFieldIds && offerFieldIds.length > 0) {
            for (const fieldId of offerFieldIds) {
                if (!player.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.neturi_siulomos_korteles', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHouses(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_siulyti_korteles_su_namais', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHousesInGroup(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_siulyti_grupeje_yra_pastatytu', { v: field ? field.name : fieldId }) };
                }
            }
        }

        if (requestFieldIds && requestFieldIds.length > 0) {
            for (const fieldId of requestFieldIds) {
                if (!target.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.gavejas_neturi_prasomos_korteles', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHouses(targetPlayerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_prasyti_korteles_su_namais', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHousesInGroup(targetPlayerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_prasyti_grupeje_yra_pastatytu', { v: field ? field.name : fieldId }) };
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
        
        this.game.addMessage(L('srv.trade.pasiule', { player: player.name, target: target.name, offerNames, offerMoneyMsg, requestNames, requestMoneyMsg }));

        // 🤖 Jei pasiūlymą siunčia BOTAS kitam botui – atsakymą apdorojam čia.
        // Žmogaus → boto atvejį apdoroja server.js (jis ir išsiunčia tradeResponded).
        // Anksčiau abu keliai suveikdavo dvigubai ir antrasis kvietimas grąžindavo
        // klaidingą „Pasiūlymas nerastas“ jau įvykusio sandorio atveju.
        if (target.isBot === true && player.isBot === true) {
            console.log(`🤖 ${target.name} yra botas – apdorojamas prekybos pasiūlymas`);

            setTimeout(() => {
                this.game.processBotTradeResponse(targetPlayerId, tradeId);
            }, 100);
        }

        return {
            success: true,
            tradeId: tradeId,
            fromPlayer: player.name,
            fromPlayerId: playerId,          // 🆕 PRIDĖTA
            toPlayer: target.name,
            toPlayerId: targetPlayerId,      // 🆕 PRIDĖTA
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
        
        if (!trade) return { error: L('srv.trade.pasiulymas_nerastas') };
        if (trade.toPlayer !== playerId) return { error: L('srv.trade.ne_tau_skirtas_sis_pasiulymas') };
        if (trade.status !== 'pending') return { error: L('srv.trade.pasiulymas_jau_atsakytas') };

        if (accept) {
            const fromPlayer = this.getPlayer(trade.fromPlayer);
            const toPlayer = this.getPlayer(trade.toPlayer);
            
            if (!fromPlayer || fromPlayer.bankrupt) {
                trade.status = 'rejected';
                return { error: L('srv.trade.siulytojas_neaktyvus') };
            }
            if (!toPlayer || toPlayer.bankrupt) {
                trade.status = 'rejected';
                return { error: L('srv.trade.gavejas_neaktyvus') };
            }

            if (trade.offerFieldIds && trade.offerFieldIds.length > 0) {
                for (const fieldId of trade.offerFieldIds) {
                    if (!fromPlayer.properties.includes(fieldId)) {
                        trade.status = 'rejected';
                        const field = this.game.board.find(f => f.id === fieldId);
                        return { error: L('srv.trade.siulytojas_nebeturi_korteles', { v: field ? field.name : fieldId }) };
                    }
                }
            }

            if (trade.requestFieldIds && trade.requestFieldIds.length > 0) {
                for (const fieldId of trade.requestFieldIds) {
                    if (!toPlayer.properties.includes(fieldId)) {
                        trade.status = 'rejected';
                        const field = this.game.board.find(f => f.id === fieldId);
                        return { error: L('srv.trade.gavejas_nebeturi_korteles', { v: field ? field.name : fieldId }) };
                    }
                }
            }

            // 🛡️ Kol pasiūlymas laukė, galėjo pasikeisti pinigai ar atsirasti namų
            if ((trade.offerMoney || 0) > Math.max(0, fromPlayer.money)) {
                trade.status = 'rejected';
                return { error: L('srv.trade.nebeturi_tiek_pinigu', { fromPlayer: fromPlayer.name }) };
            }
            if ((trade.requestMoney || 0) > Math.max(0, toPlayer.money)) {
                trade.status = 'rejected';
                return { error: L('srv.trade.neturi_tiek_pinigu') };
            }
            const withHouses = [...(trade.offerFieldIds || []).map(id => [trade.fromPlayer, id]), ...(trade.requestFieldIds || []).map(id => [trade.toPlayer, id])]
                .find(([pid, id]) => this.hasHouses(pid, id) || this.hasHousesInGroup(pid, id));
            if (withHouses) {
                trade.status = 'rejected';
                const field = this.game.board.find(f => f.id === withHouses[1]);
                return { error: L('srv.trade.negalima_grupeje_jau_pastatyta_namu', { v: field ? field.name : L('srv.word.cardGen') }) };
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
            
            const message = L('srv.trade.prekyba_ivykdyta_tarp_ir', { fromPlayer: fromPlayer.name, toPlayer: toPlayer.name });
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
            this.game.addMessage(L('srv.trade.atmete_pasiulyma', { v: player?.name || L('srv.word.player') }));
            this.trades.delete(tradeId);
            return { success: false, message: L('srv.trade.pasiulymas_atmestas') };
        }
    }

    // 🆕 PAKEISTA: counterTrade grąžina VISUS duomenis
    counterTrade(tradeId, playerId, newOfferFieldIds, newRequestFieldIds, newOfferMoney, newRequestMoney) {
        newOfferFieldIds = this.normFieldIds(newOfferFieldIds);
        newRequestFieldIds = this.normFieldIds(newRequestFieldIds);
        newOfferMoney = this.normMoney(newOfferMoney || 0);
        newRequestMoney = this.normMoney(newRequestMoney || 0);
        if (!newOfferFieldIds || !newRequestFieldIds || newOfferMoney === null || newRequestMoney === null) {
            return { error: L('srv.trade.neteisingi_pasiulymo_duomenys') };
        }
        if (newOfferFieldIds.length > 3 || newRequestFieldIds.length > 3) {
            return { error: L('srv.trade.galima_siulyti_ir_prasyti_daugiausiai') };
        }
        const trade = this.trades.get(tradeId);
        if (!trade) return { error: L('srv.trade.pasiulymas_nerastas') };
        if (trade.toPlayer !== playerId) return { error: L('srv.trade.ne_tau_skirtas_sis_pasiulymas') };
        if (trade.status !== 'pending') return { error: L('srv.trade.pasiulymas_jau_atsakytas') };

        const fromPlayer = this.getPlayer(trade.fromPlayer);
        const toPlayer = this.getPlayer(trade.toPlayer);
        
        if (!fromPlayer || fromPlayer.bankrupt) return { error: L('srv.trade.siulytojas_neaktyvus') };
        if (!toPlayer || toPlayer.bankrupt) return { error: L('srv.trade.gavejas_neaktyvus') };

        // 🛡️ Pinigų užtenka?
        if (newOfferMoney > Math.max(0, toPlayer.money)) return { error: L('srv.trade.neturi_tiek_pinigu_turi', { money: toPlayer.money }) };
        if (newRequestMoney > Math.max(0, fromPlayer.money)) return { error: L('srv.trade.neturi_tiek_pinigu_turi_3', { fromPlayer: fromPlayer.name, money: fromPlayer.money }) };

        // 🆕 VALIDACIJA: ar aš (toPlayer) turiu siūlomas korteles?
        if (newOfferFieldIds && newOfferFieldIds.length > 0) {
            for (const fieldId of newOfferFieldIds) {
                if (!toPlayer.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.tu_neturi_korteles', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHouses(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_siulyti_korteles_su_namais', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHousesInGroup(playerId, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_siulyti_grupeje_yra_pastatytu', { v: field ? field.name : fieldId }) };
                }
            }
        }

        // 🆕 VALIDACIJA: ar Jonas (fromPlayer) turi prašomas korteles?
        if (newRequestFieldIds && newRequestFieldIds.length > 0) {
            for (const fieldId of newRequestFieldIds) {
                if (!fromPlayer.properties.includes(fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.nebeturi_korteles', { fromPlayer: fromPlayer.name, v: field ? field.name : fieldId }) };
                }
                if (this.hasHouses(trade.fromPlayer, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_prasyti_korteles_su_namais', { v: field ? field.name : fieldId }) };
                }
                if (this.hasHousesInGroup(trade.fromPlayer, fieldId)) {
                    const field = this.game.board.find(f => f.id === fieldId);
                    return { error: L('srv.trade.negali_prasyti_grupeje_yra_pastatytu', { v: field ? field.name : fieldId }) };
                }
            }
        }

        const newTradeId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        
        // 🆕 Sukuriam NAUJĄ trade'ą (aš -> Jonas)
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

        // 🆕 Seną pažymim kaip 'countered'
        trade.status = 'countered';

        this.game.addMessage(L('srv.trade.pakoregavo_pasiulyma', { toPlayer: toPlayer.name, fromPlayer: fromPlayer.name }));

        // 🆕 Paruošti vardus
        let offerNames = 'pinigai';
        if (newOfferFieldIds && newOfferFieldIds.length > 0) {
            const names = newOfferFieldIds.map(id => {
                const field = this.game.board.find(f => f.id === id);
                return field ? field.name : `ID:${id}`;
            }).filter(name => name);
            if (names.length > 0) offerNames = names.join(', ');
        }
        
        let requestNames = 'pinigai';
        if (newRequestFieldIds && newRequestFieldIds.length > 0) {
            const names = newRequestFieldIds.map(id => {
                const field = this.game.board.find(f => f.id === id);
                return field ? field.name : `ID:${id}`;
            }).filter(name => name);
            if (names.length > 0) requestNames = names.join(', ');
        }

        // 🆕 GRĄŽINAM VISUS DUOMENIS (kad showTradeOffer galėtų užpildyti)
        return { 
            success: true, 
            tradeId: newTradeId,
            fromPlayer: toPlayer.name,              // Aš (kuris koreguoju)
            fromPlayerId: playerId,                  // Mano ID
            toPlayer: fromPlayer.name,              // Jonas (kuriam siunčiu atgal)
            toPlayerId: trade.fromPlayer,           // Jono ID
            offerField: offerNames,
            requestField: requestNames,
            offerFieldIds: newOfferFieldIds || [],
            requestFieldIds: newRequestFieldIds || [],
            offerMoney: newOfferMoney || 0,
            requestMoney: newRequestMoney || 0,
            message: L('srv.trade.pakoreguotas_pasiulymas_issiustas')
        };
    }

    // ============================================
    // 🆕 ŽAIDĖJAS IŠKRITO (bankrotas) – sutvarkyti jo mainus ir aukcionų statymus
    // ============================================
    removePlayer(playerId) {
        const cancelledTrades = [];
        for (const [tradeId, trade] of this.trades) {
            if (trade.fromPlayer === playerId || trade.toPlayer === playerId) {
                this.trades.delete(tradeId);
                cancelledTrades.push(tradeId);
            }
        }

        const updatedAuctions = [];
        for (const [auctionId, auction] of this.auctions) {
            if (!auction.isActive) continue;
            if (Array.isArray(auction.bidders)) {
                auction.bidders = auction.bidders.filter(b => b.playerId !== playerId);
            }
            if (auction.currentBidder === playerId) {
                // Grąžinam ankstesnį didžiausią statymą (arba banko pradinę)
                const remaining = (auction.bidders || []).filter(b => {
                    if (b.playerId === 'bank') return true;
                    const p = this.getPlayer(b.playerId);
                    return p && !p.bankrupt && !p.left && !p.kicked;
                });
                const best = remaining.reduce((a, b) => (!a || b.bid > a.bid) ? b : a, null);
                auction.currentBid = best ? best.bid : Math.floor(auction.fieldCost * C.AUCTION_START_RATIO);
                auction.currentBidder = best ? best.playerId : 'bank';
                auction.currentBidderName = best ? best.playerName : '🏦 Bankas';
                updatedAuctions.push({ auctionId, ...auction, timer: undefined });
            }
        }
        return { cancelledTrades, updatedAuctions };
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
                    fromPlayer: fromPlayer ? fromPlayer.name : L('srv.word.unknown'),
                    fromPlayerId: trade.fromPlayer,        // 🆕 PRIDĖTA
                    toPlayer: fromPlayer ? fromPlayer.name : L('srv.word.unknown'),
                    toPlayerId: trade.toPlayer,            // 🆕 PRIDĖTA
                    offerField: offerNames,
                    requestField: requestNames,
                    offerFieldIds: trade.offerFieldIds,    // 🆕 PRIDĖTA
                    requestFieldIds: trade.requestFieldIds, // 🆕 PRIDĖTA
                    offerMoney: trade.offerMoney,
                    requestMoney: trade.requestMoney
                });
            }
        }
        return result;
    }
}

module.exports = TradingLogic;