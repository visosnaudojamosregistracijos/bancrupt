// server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const Game = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

// STATINIŲ FAILŲ APTARNAVIMAS
app.use(express.static(path.join(__dirname, '../client')));

// Atsarginis route'as
app.get('/', (req, res) => {
  res.send('Bancrupt serveris veikia!');
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const games = new Map();

io.on('connection', (socket) => {
    console.log('🎮 Naujas žaidėjas prisijungė:', socket.id);
    console.log('📊 Iš viso prisijungę:', io.engine.clientsCount);

    socket.on('createGame', (playerName) => {
        console.log('📥 Gauta createGame užklausa:', playerName);
        console.log('📤 Siunčiama iš socket:', socket.id);
        
        if (!playerName || playerName.trim() === '') {
            console.log('❌ Klaida: tuščias vardas');
            socket.emit('error', 'Įvesk vardą!');
            return;
        }
        
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('🆕 Kuriamas žaidimas:', gameId);
        
        const game = new Game();
        
        game.setEmitFunction((event, data, targetSocketId) => {
            console.log('📤 Siunčiamas eventas:', event, data, 'target:', targetSocketId || 'visiems');
            if (targetSocketId) {
                io.to(targetSocketId).emit(event, data);
            } else {
                io.to(gameId).emit(event, data);
            }
        });
        
        const player = game.addPlayer(playerName.trim());
        
        if (player.error) {
            console.log('❌ Klaida pridedant žaidėją:', player.error);
            socket.emit('error', player.error);
            return;
        }
        
        games.set(gameId, game);
        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerId = player.id;
        
        console.log('✅ Žaidimas sukurtas:', { gameId, playerId: player.id, playerName: player.name });
        
        socket.emit('gameCreated', { 
            gameId, 
            playerId: player.id,
            player: player
        });
        
        io.to(gameId).emit('gameState', game.getGameState());
        io.to(gameId).emit('message', `🎉 ${playerName} sukūrė žaidimą!`);
    });

    socket.on('joinGame', ({ gameId, playerName }) => {
        console.log('📥 Gauta joinGame užklausa:', { gameId, playerName });
        
        if (!gameId || !playerName) {
            socket.emit('error', 'Įvesk žaidimo ID ir vardą!');
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            console.log('❌ Žaidimas nerastas:', gameId);
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const player = game.addPlayer(playerName.trim());
        if (player.error) {
            socket.emit('error', player.error);
            return;
        }

        socket.join(gameId.toUpperCase());
        socket.gameId = gameId.toUpperCase();
        socket.playerId = player.id;

        socket.emit('joinedGame', { 
            playerId: player.id,
            player: player
        });
        
        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('message', `👋 ${playerName} prisijungė prie žaidimo!`);
    });

    socket.on('rollDice', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.rollDice(socket.playerId, socket.id);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('diceRolled', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
        
        if (result.message) {
            io.to(socket.gameId).emit('message', result.message);
        }
        if (result.result && result.result.message) {
            io.to(socket.gameId).emit('message', result.result.message);
        }
    });

    socket.on('buyProperty', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.buyProperty(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (result.message) {
            io.to(socket.gameId).emit('message', result.message);
        }
    });

    socket.on('cancelBuy', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.cancelBuy(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (game.lastMessage) {
            io.to(socket.gameId).emit('message', game.lastMessage);
        }
    });

    socket.on('bankrupt', (playerId) => {
        console.log('💀💀💀 SERVERIS GAUNA BANKROTA:', { playerId, socketId: socket.id, gameId: socket.gameId });
        
        if (!socket.gameId) {
            console.log('❌ KLAIDA: nėra gameId');
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            console.log('❌ KLAIDA: žaidimas nerastas', socket.gameId);
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        console.log('💀 Vykdomas bankrotas žaidėjui:', playerId);
        const result = game.bankruptPlayer(playerId);
        console.log('💀 Bankroto rezultatas:', result);
        
        if (result.error) {
            console.log('❌ KLAIDA bankroto metu:', result.error);
            socket.emit('error', result.error);
            return;
        }

        console.log('💀 Bankrotas sėkmingas, siunčiama žaidimo būsena');
        
        io.to(socket.gameId).emit('bankruptConfirmed', {
            playerId: playerId,
            playerName: result.playerName
        });
        
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', `💀 ${result.playerName} bankrotavo!`);
        
        console.log('💀 Bankroto procesas baigtas');
    });

    socket.on('endTurn', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.endTurn();
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (game.lastMessage) {
            io.to(socket.gameId).emit('message', game.lastMessage);
        }
    });

    socket.on('chatMessage', (message) => {
        if (!socket.gameId) return;
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const player = game.players.find(p => p.id === socket.playerId);
        if (!player) return;
        
        io.to(socket.gameId).emit('chatMessage', {
            player: player.name,
            color: player.color,
            message: message,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('getGameState', () => {
        if (!socket.gameId) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        socket.emit('gameState', game.getGameState());
    });

    // ============================================
    // NAMŲ STATYMAS
    // ============================================
    socket.on('canBuildHouse', ({ fieldId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.canBuildHouse(socket.playerId, fieldId);
        const field = game.board[fieldId];
        
        socket.emit('canBuildResult', {
            can: result.can,
            fieldId: fieldId,
            fieldName: field ? field.name : '',
            cost: result.cost || 0,
            isHotel: result.isHotel || false,
            reason: result.reason || ''
        });
    });

    socket.on('buildHouse', ({ fieldId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.buildHouse(socket.playerId, fieldId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (result.message) {
            io.to(socket.gameId).emit('message', result.message);
        }
    });

    // ============================================
    // KALĖJIMAS - sumokėti baudą
    // ============================================
    socket.on('payJailFine', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.payJailFine(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (result.message) {
            io.to(socket.gameId).emit('message', result.message);
        }
    });

    // ============================================
    // PREKYBA - PARDUOTI BANKUI
    // ============================================
    socket.on('sellToBank', ({ fieldIds }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.sellToBank(socket.playerId, fieldIds);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', result.message);
    });

    // ============================================
    // PREKYBA - PRADĖTI AUKCIONĄ
    // ============================================
    socket.on('startAuction', ({ fieldId }) => {
        console.log('🔨🔨🔨 GAUTA startAuction UŽKLAUSA:', { fieldId, socketId: socket.id, playerId: socket.playerId });
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        console.log('🔨🔨🔨 Iškviečiamas game.startAuction()');
        const result = game.startAuction(socket.playerId, fieldId);
        console.log('🔨🔨🔨 game.startAuction() grąžino:', JSON.stringify(result, null, 2));
        
        if (result.error) {
            console.log('🔨🔨🔨 KLAIDA:', result.error);
            socket.emit('error', result.error);
            return;
        }

        console.log('🔨🔨🔨 SIUNČIAMAS auctionStarted PER emitFunction:', result);
        
        if (game.emitFunction) {
            game.emitFunction('auctionStarted', result);
            game.emitFunction('gameState', game.getGameState());
            game.emitFunction('message', `🔨 ${game.players[socket.playerId].name} paskelbė aukcioną!`);
        } else {
            console.log('⚠️ emitFunction nėra, naudojamas io.to');
            io.to(socket.gameId).emit('auctionStarted', result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            io.to(socket.gameId).emit('message', `🔨 ${game.players[socket.playerId].name} paskelbė aukcioną!`);
        }
    });

    // ============================================
    // PREKYBA - SIŪLYTI AUKCIONE
    // ============================================
    socket.on('bidAuction', ({ auctionId, bidAmount }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.bidAuction(socket.playerId, auctionId, bidAmount);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('auctionUpdated', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // ============================================
    // PREKYBA - BAIGTI AUKCIONĄ
    // ============================================
    socket.on('endAuction', ({ auctionId }) => {
        console.log('🔨🔨🔨 GAUTA endAuction UŽKLAUSA:', { auctionId, socketId: socket.id });
        
        if (!socket.gameId) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.endAuction(auctionId);
        console.log('🔨🔨🔨 AUKCIONO PABAIGA:', result);
        
        if (!result) {
            console.log('⚠️ Aukcionas jau baigtas arba nerastas, ignoruojama');
            return;
        }

        io.to(socket.gameId).emit('auctionEnded', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', `🔨 Aukcionas baigėsi! ${result.winnerName || 'Niekas nelaimėjo'}`);
    });

    // ============================================
    // PREKYBA - SIŪLYTI ŽAIDĖJUI
    // ============================================
    socket.on('proposeTrade', (data) => {
        console.log('🔄🔄🔄 SERVERIS GAUNA PROPOSE TRADE:', data);
        
        const { targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney } = data;
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        console.log('🔄🔄🔄 Siunčiama į tradingLogic:', {
            playerId: socket.playerId,
            targetPlayerId,
            offerFieldIds,
            requestFieldIds,
            offerMoney,
            requestMoney
        });

        const result = game.proposeTrade(socket.playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('tradeProposed', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // ============================================
    // PREKYBA - ATSAKYTI Į SIŪLYMĄ
    // ============================================
    socket.on('respondToTrade', ({ tradeId, accept }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.respondToTrade(tradeId, socket.playerId, accept);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('tradeResponded', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // ============================================
    // PREKYBA - KOREKTYUOTI SIŪLYMĄ
    // ============================================
    socket.on('counterTrade', ({ tradeId, newOfferField, newRequestField, newOfferMoney, newRequestMoney }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.counterTrade(tradeId, socket.playerId, newOfferField, newRequestField, newOfferMoney, newRequestMoney);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('tradeProposed', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // ============================================
    // PREKYBA - GAUTI AKTYVIUS AUKCIONUS
    // ============================================
    socket.on('getActiveAuctions', () => {
        if (!socket.gameId) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const auctions = game.getActiveAuctions();
        socket.emit('activeAuctions', auctions);
    });

    // ============================================
    // PREKYBA - GAUTI LAUKIANČIUS PASIŪLYMUS
    // ============================================
    socket.on('getPendingTrades', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const trades = game.getPendingTrades(socket.playerId);
        socket.emit('pendingTrades', trades);
    });

    // ============================================
    // GRIAUTI NAMUS
    // ============================================
    socket.on('getDemolishableProperties', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const properties = game.getDemolishableProperties(socket.playerId);
        socket.emit('demolishableProperties', properties);
    });

    socket.on('demolishHouse', ({ fieldId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.demolishHouse(socket.playerId, fieldId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', result.message);
        io.to(socket.gameId).emit('demolishConfirmed', result);
    });

    socket.on('disconnect', () => {
        console.log('👋 Žaidėjas atsijungė:', socket.id);
        if (socket.gameId) {
            const game = games.get(socket.gameId);
            if (game) {
                const player = game.players.find(p => p.id === socket.playerId);
                if (player) {
                    player.isActive = false;
                    io.to(socket.gameId).emit('gameState', game.getGameState());
                    io.to(socket.gameId).emit('message', `👋 ${player.name} paliko žaidimą`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Bancrupt serveris veikia http://localhost:${PORT}`);
    console.log(`📡 Laukiama prisijungimų...`);
    console.log(`💀 Bankroto handleris aktyvuotas`);
});