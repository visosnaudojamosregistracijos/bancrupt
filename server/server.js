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

app.use(express.static(path.join(__dirname, 'public')));

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

// ============================================
// VIEŠŲ STALŲ VALYMAS (Etapas 6)
// ============================================
setInterval(() => {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [gameId, game] of games) {
        if (!game.isAlive()) {
            console.log(`🗑️ Trinu neaktyvų stalą: ${gameId}`);
            games.delete(gameId);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        console.log(`✅ Ištrinta ${removedCount} neaktyvių stalų`);
        broadcastPublicGames();
    }
}, 60000); // Kas 1 min

// ============================================
// VIEŠŲ STALŲ SĄRAŠO SIUNTIMAS
// ============================================
function broadcastPublicGames() {
    const publicGames = [];
    
    for (const [gameId, game] of games) {
        if (game.isPublic && !game.gameStarted) {
            const activePlayers = game.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
            
            if (activePlayers.length < game.maxPlayers) {
                publicGames.push({
                    gameId: gameId,
                    hostName: activePlayers[0] ? activePlayers[0].name : 'Nežinomas',
                    playerCount: activePlayers.length,
                    maxPlayers: game.maxPlayers,
                    isPublic: true
                });
            }
        }
    }
    
    // 🆕 Siųsti TIK tiems, kurie yra laukimo kambaryje (ne žaidime)
    // Naudojame atskirą room'ą 'lobby' - žaidėjai, kurie naršo viešus stalus
    io.to('lobby').emit('publicGamesList', publicGames);
}

// ============================================
// SOCKET.IO PRISIJUNGIMAS
// ============================================
io.on('connection', (socket) => {
    console.log('🎮 Naujas žaidėjas prisijungė:', socket.id);
    console.log('📊 Iš viso prisijungę:', io.engine.clientsCount);

    // ============================================
    // SUKURTI ŽAIDIMĄ
    // ============================================
    socket.on('createGame', (data) => {
        console.log('📥 Gauta createGame užklausa:', data);
        
        const playerName = data.name || data;
        const playerColor = data.color || null;
        const isPublic = data.isPublic === true;
        
        if (!playerName || playerName.trim() === '') {
            socket.emit('error', 'Įvesk vardą!');
            return;
        }
        
        // Jei viešas - tikrink, ar jau yra 5 vieši
        if (isPublic) {
            let publicCount = 0;
            for (const [id, g] of games) {
                if (g.isPublic && !g.gameStarted) publicCount++;
            }
            
            if (publicCount >= 5) {
                socket.emit('error', 'Jau yra 5 vieši stalai! Palauk kol atsilaisvins.');
                return;
            }
        }
        
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('🆕 Kuriamas žaidimas:', gameId, 'Viešas:', isPublic);
        
        const game = new Game();
        game.setGameId(gameId);
        game.setPublic(isPublic);
        
        game.setEmitFunction((event, data, targetSocketId) => {
            if (targetSocketId) {
                io.to(targetSocketId).emit(event, data);
            } else {
                io.to(gameId).emit(event, data);
            }
        });
        
        const player = game.addPlayer(playerName.trim(), playerColor);
        
        if (player.error) {
            socket.emit('error', player.error);
            return;
        }
        
        games.set(gameId, game);
        socket.join(gameId);
        socket.leave('lobby'); // 🆕 Išeiti iš lobby
        socket.gameId = gameId;
        socket.playerId = player.id;
        
        socket.emit('gameCreated', { 
            gameId, 
            playerId: player.id,
            player: player
        });
        
        io.to(gameId).emit('gameState', game.getGameState());
        io.to(gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId).emit('message', `🎉 ${playerName} sukūrė žaidimą!`);
        
        // Atnaujinti viešų sąrašą
        if (isPublic) {
            broadcastPublicGames();
        }
    });

    // ============================================
    // PRISIJUNGTI PRIE ŽAIDIMO
    // ============================================
    socket.on('joinGame', ({ gameId, playerName, color }) => {
        console.log('📥 Gauta joinGame užklausa:', { gameId, playerName, color });
        
        if (!gameId || !playerName) {
            socket.emit('error', 'Įvesk žaidimo ID ir vardą!');
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }
        
        if (game.gameStarted) {
            socket.emit('error', 'Žaidimas jau prasidėjo!');
            return;
        }

        const player = game.addPlayer(playerName.trim(), color);
        if (player.error) {
            socket.emit('error', player.error);
            return;
        }

        socket.join(gameId.toUpperCase());
        socket.leave('lobby'); // 🆕 Išeiti iš lobby
        socket.gameId = gameId.toUpperCase();
        socket.playerId = player.id;

        socket.emit('joinedGame', { 
            playerId: player.id,
            player: player
        });
        
        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId.toUpperCase()).emit('message', `👋 ${playerName} prisijungė prie žaidimo!`);
        
        // Jei viešas - atnaujinti sąrašą
        if (game.isPublic) {
            broadcastPublicGames();
        }
    });

    // ============================================
    // REKONEKCIJA
    // ============================================
    socket.on('reconnectPlayer', ({ gameId, playerToken }) => {
        console.log('🔄 GAUTA reconnectPlayer:', { gameId, playerToken });
        
        if (!gameId || !playerToken) {
            socket.emit('reconnectFailed', 'Trūksta duomenų');
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            console.log('❌ Žaidimas nerastas:', gameId);
            socket.emit('reconnectFailed', 'Žaidimas nerastas');
            return;
        }
        
        const player = game.players.find(p => p.token === playerToken);
        if (!player) {
            console.log('❌ Žaidėjas nerastas pagal token');
            socket.emit('reconnectFailed', 'Žaidėjas nerastas');
            return;
        }
        
        if (player.bankrupt) {
            socket.emit('reconnectFailed', 'Žaidėjas bankrutavęs');
            return;
        }
        
        if (player.left) {
            socket.emit('reconnectFailed', 'Žaidėjas pasitraukęs');
            return;
        }
        
        if (player.kicked) {
            socket.emit('reconnectFailed', 'Žaidėjas pašalintas');
            return;
        }
        
        socket.join(gameId.toUpperCase());
        socket.gameId = gameId.toUpperCase();
        socket.playerId = player.id;
        
        player.socketId = socket.id;
        player.isActive = true;
        
        console.log('✅ Žaidėjas sėkmingai prijungtas atgal:', player.name);
        
        socket.emit('reconnected', {
            gameId: gameId.toUpperCase(),
            playerId: player.id,
            player: player
        });
        
        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId.toUpperCase()).emit('message', `🔄 ${player.name} grįžo į žaidimą!`);
    });

    // ============================================
    // KAULIUKŲ METIMAS
    // ============================================
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
        
        const messageToSend = (result.result && result.result.message) || result.message;
        if (messageToSend) {
            io.to(socket.gameId).emit('message', messageToSend);
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
        console.log('💀 SERVERIS GAUNA BANKROTA:', { playerId, socketId: socket.id, gameId: socket.gameId });
        
        if (!socket.gameId) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.bankruptPlayer(playerId);
        
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('bankruptConfirmed', {
            playerId: playerId,
            playerName: result.playerName
        });
        
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', `💀 ${result.playerName} bankrotavo!`);
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
    // STATYBOS
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
        const field = game.board.find(f => f.id === fieldId);
        
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
    // PREKYBA
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

    socket.on('startAuction', ({ fieldId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.startAuction(socket.playerId, fieldId);
        
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }
        
        if (game.emitFunction) {
            game.emitFunction('auctionStarted', result);
            game.emitFunction('gameState', game.getGameState());
            game.emitFunction('message', `🔨 ${game.players[socket.playerId].name} paskelbė aukcioną!`);
        } else {
            io.to(socket.gameId).emit('auctionStarted', result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            io.to(socket.gameId).emit('message', `🔨 ${game.players[socket.playerId].name} paskelbė aukcioną!`);
        }
    });

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

    socket.on('endAuction', ({ auctionId }) => {
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
        
        if (!result) return;

        io.to(socket.gameId).emit('auctionEnded', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', `🔨 Aukcionas baigėsi! ${result.winnerName || 'Niekas nelaimėjo'}`);
    });

    socket.on('proposeTrade', (data) => {
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

        const result = game.proposeTrade(socket.playerId, targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('tradeProposed', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

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

    socket.on('getActiveAuctions', () => {
        if (!socket.gameId) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const auctions = game.getActiveAuctions();
        socket.emit('activeAuctions', auctions);
    });

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

    // ============================================
    // VOTE-KICK
    // ============================================
    socket.on('startVoteKick', ({ targetPlayerId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const targetId = parseInt(targetPlayerId);
        if (isNaN(targetId)) {
            socket.emit('error', 'Neteisingas žaidėjo ID');
            return;
        }

        const result = game.startVoteKick(socket.playerId, targetId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('voteKickStarted', {
            initiatorId: socket.playerId,
            initiatorName: game.players[socket.playerId].name,
            targetId: targetId,
            targetName: game.players[targetId].name,
            requiredVotes: result.voteKick.requiredVotes,
            timeLeft: result.voteKick.timeLeft,
            votes: result.voteKick.votes,
            activePlayerCount: result.voteKick.activePlayerCount
        });

        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    socket.on('voteKick', ({ vote }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        if (!game.activeVoteKick) {
            socket.emit('error', 'Balsavimas nevyksta');
            return;
        }

        const result = game.voteKick(socket.playerId, vote === true);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        if (result.finished) {
            io.to(socket.gameId).emit('gameState', game.getGameState());
            return;
        }

        const vkState = result.voteKick;
        io.to(socket.gameId).emit('voteKickUpdate', {
            votes: vkState.votes,
            requiredVotes: vkState.requiredVotes,
            timeLeft: vkState.timeLeft,
            targetName: vkState.targetName,
            targetId: vkState.targetId
        });

        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // ============================================
    // WAITING ROOM (Etapas 3)
    // ============================================
    socket.on('playerReady', ({ ready }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.setPlayerReady(socket.playerId, ready);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    socket.on('startGame', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const result = game.startGame(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameStarted', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
        
        // Jei buvo viešas - ištrinti iš sąrašo
        if (game.isPublic) {
            broadcastPublicGames();
        }
    });

    socket.on('kickPlayer', ({ targetId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const targetIdInt = parseInt(targetId);
        const result = game.kickPlayer(socket.playerId, targetIdInt);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        // Pranešam išmestajam
        if (result.socketId) {
            io.to(result.socketId).emit('youWereKicked');
        }

        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', `❌ ${result.targetName} buvo išmestas`);
    });

    socket.on('getWaitingRoom', () => {
        if (!socket.gameId) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        socket.emit('waitingRoomUpdate', game.getWaitingRoomState());
    });

    // ============================================
    // SPALVŲ GAVIMAS (Etapas 2)
    // ============================================
    socket.on('getGameColors', ({ gameId }) => {
        console.log('🎨 Gauta getGameColors užklausa:', gameId);
        
        if (!gameId) {
            socket.emit('gameColors', { error: 'Nėra stalo kodo', available: [], used: [] });
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        
        if (!game) {
            socket.emit('gameColors', { 
                error: 'Žaidimas nerastas', 
                available: [], 
                used: [] 
            });
            return;
        }
        
        const used = game.getUsedColors();
        const available = game.getAvailableColors();
        
        console.log('🎨 Used:', used);
        console.log('🎨 Available:', available);
        
        socket.emit('gameColors', {
            gameId: gameId.toUpperCase(),
            available: available,
            used: used,
            players: game.players.filter(p => !p.left && !p.bankrupt && !p.kicked).map(p => ({
                name: p.name,
                color: p.color
            }))
        });
    });

    // ============================================
    // VIEŠI STALAI (Etapas 6)
    // ============================================
    socket.on('getPublicGames', () => {
    // 🆕 Prisijungti prie 'lobby' room'o
    socket.join('lobby');
    
    const publicGames = [];
    
    for (const [gameId, game] of games) {
        if (game.isPublic && !game.gameStarted) {
            const activePlayers = game.players.filter(p => !p.left && !p.bankrupt && !p.kicked);
            
            if (activePlayers.length < game.maxPlayers) {
                publicGames.push({
                    gameId: gameId,
                    hostName: activePlayers[0] ? activePlayers[0].name : 'Nežinomas',
                    playerCount: activePlayers.length,
                    maxPlayers: game.maxPlayers
                });
            }
        }
    }
    
    socket.emit('publicGamesList', publicGames);
});

socket.on('leaveLobby', () => {
    socket.leave('lobby');
    console.log('🚪 Žaidėjas išėjo iš lobby:', socket.id);
});

    socket.on('setGamePublic', ({ isPublic }) => {
    if (!socket.gameId || socket.playerId === undefined) {
        socket.emit('error', 'Neprisijungei prie žaidimo!');
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) {
        socket.emit('error', 'Žaidimas nerastas!');
        return;
    }
    
    // 🆕 Tik kūrėjas (hostId) gali keisti
    const hostPlayer = game.players.find(p => p.isHost === true);
    const hostId = hostPlayer ? hostPlayer.id : 0;
    
    if (socket.playerId !== hostId) {
        socket.emit('error', 'Tik žaidimo kūrėjas gali keisti viešumą');
        return;
    }
        
        if (game.gameStarted) {
            socket.emit('error', 'Žaidimas jau prasidėjo');
            return;
        }
        
        // Jei nori padaryti viešą - tikrink limitą
        if (isPublic) {
            let publicCount = 0;
            for (const [id, g] of games) {
                if (g.isPublic && !g.gameStarted && id !== socket.gameId) publicCount++;
            }
            
            if (publicCount >= 5) {
                socket.emit('error', 'Jau yra 5 vieši stalai!');
                return;
            }
        }
        
        const result = game.setPublic(isPublic);
        
        socket.emit('publicStatusChanged', { isPublic: game.isPublic });
        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        
        broadcastPublicGames();
    });

    // ============================================
    // PASITRAUKIMAS
    // ============================================
    socket.on('leaveGame', () => {
        console.log('🏃 GAUTA leaveGame UŽKLAUSA:', { socketId: socket.id, playerId: socket.playerId });
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        const gameIdCopy = socket.gameId;
        
        const result = game.leaveGame(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(gameIdCopy).emit('message', `😭 ${result.playerName} susinervino ir pabėgo į kampą!`);
        
        if (result.winner) {
            io.to(gameIdCopy).emit('message', `🏆 ${result.winner} LAIMĖJO! Visi kiti pabėgo!`);
            io.to(gameIdCopy).emit('gameFinished', {
                winner: result.winner,
                winnerId: result.winnerId
            });
        }
        
        io.to(gameIdCopy).emit('gameState', game.getGameState());
        io.to(gameIdCopy).emit('waitingRoomUpdate', game.getWaitingRoomState());
        
        socket.leave(gameIdCopy);
        socket.gameId = null;
        socket.playerId = undefined;
        
        socket.emit('leftGame', {
            playerName: result.playerName,
            gameId: gameIdCopy
        });
        
        console.log('🏃 Pasitraukimas baigtas:', result);
        
        // Atnaujinti viešų sąrašą
        if (game.isPublic) {
            broadcastPublicGames();
        }
    });

    // ============================================
    // ATSIJUNGIMAS
    // ============================================
    socket.on('disconnect', () => {
        console.log('👋 Žaidėjas atsijungė:', socket.id);
        if (socket.gameId) {
            const game = games.get(socket.gameId);
            if (game) {
                const player = game.players.find(p => p.id === socket.playerId);
                if (player) {
                    player.isActive = false;
                    io.to(socket.gameId).emit('gameState', game.getGameState());
                    io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
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
    console.log(`🗳️ Vote-kick sistema aktyvuota`);
    console.log(`⏳ Waiting room aktyvus`);
    console.log(`🎲 Shuffle aktyvus`);
    console.log(`🌐 Vieši stalai: max 5`);
    console.log(`🔗 URL kodas palaikomas`);
});