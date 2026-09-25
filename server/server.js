// server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const Game = require('./gameLogic');

// ============================================
// LIMITAI
// ============================================
const LIMITS = {
    MAX_PUBLIC_GAMES: 100,
    MAX_PRIVATE_GAMES: 100,
    MAX_TOTAL_GAMES: 200,
    MAX_PLAYERS_TOTAL: 2400,
    MAX_GAMES_PER_PLAYER: 3,
    MAX_GAMES_PER_IP: 5,
    EMPTY_GAME_TIMEOUT: 10 * 60 * 1000,
    INACTIVE_GAME_TIMEOUT: 30 * 60 * 1000,
    FINISHED_GAME_TIMEOUT: 5 * 60 * 1000,
    CPU_LIMIT: 90,
    RAM_LIMIT: 80
};

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
// 🆕 GAUTI KLIENTO IP (per proxy)
// ============================================
function getClientIp(socket) {
    // Railway naudoja proxy, todėl x-forwarded-for
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return socket.handshake.address;
}

// ============================================
// AUTO-VALYMAS
// ============================================
setInterval(() => {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [gameId, game] of games) {
        if (game.players.length === 0 && now - (game.createdAt || now) > LIMITS.EMPTY_GAME_TIMEOUT) {
            console.log(`🗑️ Trinu tuščią stalą: ${gameId}`);
            games.delete(gameId);
            removedCount++;
            continue;
        }
        
        if (now - (game.lastActivity || now) > LIMITS.INACTIVE_GAME_TIMEOUT) {
            console.log(`🗑️ Trinu neaktyvų stalą: ${gameId}`);
            games.delete(gameId);
            removedCount++;
            continue;
        }
        
        if (game.gameFinished && now - (game.finishedAt || now) > LIMITS.FINISHED_GAME_TIMEOUT) {
            console.log(`🗑️ Trinu pasibaigusį stalą: ${gameId}`);
            games.delete(gameId);
            removedCount++;
            continue;
        }
    }
    
    if (removedCount > 0) {
        console.log(`✅ Ištrinta ${removedCount} neaktyvių stalų`);
        broadcastPublicGames();
    }
}, 60000);


// ============================================
// AR GALIMA KURTI NAUJĄ STALĄ?
// ============================================
function canCreateGame(socket, isPublic) {
    if (games.size >= LIMITS.MAX_TOTAL_GAMES) {
        return { can: false, reason: `Serveris pilnas (max ${LIMITS.MAX_TOTAL_GAMES} stalų)` };
    }
    
    if (isPublic) {
        let publicCount = 0;
        for (const [id, g] of games) {
            if (g.isPublic && !g.gameStarted) publicCount++;
        }
        if (publicCount >= LIMITS.MAX_PUBLIC_GAMES) {
            return { can: false, reason: `Viešų stalų limitas (${LIMITS.MAX_PUBLIC_GAMES})` };
        }
    }
    
    if (!isPublic) {
        let privateCount = 0;
        for (const [id, g] of games) {
            if (!g.isPublic && !g.gameStarted) privateCount++;
        }
        if (privateCount >= LIMITS.MAX_PRIVATE_GAMES) {
            return { can: false, reason: `Privačių stalų limitas (${LIMITS.MAX_PRIVATE_GAMES})` };
        }
    }
    
    const playerGames = [...games.values()].filter(g => 
        g.players.some(p => p.socketId === socket.id)
    ).length;
    if (playerGames >= LIMITS.MAX_GAMES_PER_PLAYER) {
        return { can: false, reason: `Tu jau turi ${LIMITS.MAX_GAMES_PER_PLAYER} aktyvius stalus` };
    }
    
    // 🆕 IP per x-forwarded-for
    const ip = getClientIp(socket);
    const ipGames = [...games.values()].filter(g => 
        g.players.some(p => p.ip === ip)
    ).length;
    if (ipGames >= LIMITS.MAX_GAMES_PER_IP) {
        return { can: false, reason: `Per daug stalų iš tavo IP (max ${LIMITS.MAX_GAMES_PER_IP})` };
    }
    
    const totalPlayers = [...games.values()].reduce((sum, g) => 
        sum + g.players.filter(p => !p.left && !p.kicked).length, 0
    );
    if (totalPlayers >= LIMITS.MAX_PLAYERS_TOTAL) {
        return { can: false, reason: `Serveris pilnas (max ${LIMITS.MAX_PLAYERS_TOTAL} žaidėjų)` };
    }
    
    // 🆕 CPU/RAM patikrinimas IŠIMTAS – Railway pats tvarko resursus
    // os.loadavg() Railway container'iuose rodo neteisingus duomenis
    
    return { can: true };
}




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
    
    io.to('lobby').emit('publicGamesList', publicGames);
}

// ============================================
// 🤖 BOTŲ CIKLAS
// ============================================

// 🆕 Paleisti botų ciklą žaidimui
function startBotLoop(gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    // 🆕 Sustabdyti seną ciklą, jei yra
    if (game.botLoopInterval) {
        clearInterval(game.botLoopInterval);
        game.botLoopInterval = null;
    }
    
    console.log(`🤖 Pradedamas botų ciklas žaidimui: ${gameId}`);
    
    // 🆕 Ciklas – kas 2 sek. tikrina, ar boto eilė
    game.botLoopInterval = setInterval(async () => {
        const currentGame = games.get(gameId);
        if (!currentGame) {
            clearInterval(game.botLoopInterval);
            return;
        }
        
        if (!currentGame.gameStarted) {
            return;
        }
        
        // 🆕 Ar dabar boto eilė?
        const currentBot = currentGame.getCurrentBot();
        if (!currentBot) {
            return;
        }
        
        // 🆕 Ar jau vykdomas boto ėjimas? (apsauga nuo dvigubo)
        if (currentGame.botTurnInProgress) {
            return;
        }
        
        currentGame.botTurnInProgress = true;
        
        try {
            console.log(`🤖 Botas ${currentBot.name} pradeda...`);
            
            const result = await currentGame.botTurn(currentBot.id, (event, data) => {
                io.to(gameId).emit(event, data);
            });
            
            console.log(`🤖 Botas ${currentBot.name} baigė:`, result);
            
            // 🆕 Siųsti atnaujinimus visiems
            io.to(gameId).emit('gameState', currentGame.getGameState());
            
            if (result && result.rollResult) {
                io.to(gameId).emit('diceRolled', result.rollResult);
                
                const msg = (result.rollResult.result && result.rollResult.result.message) 
                    || result.rollResult.message;
                if (msg) {
                    io.to(gameId).emit('message', msg);
                }
            }
            
            if (result && result.message) {
                io.to(gameId).emit('message', result.message);
            }
            
        } catch (error) {
            console.error(`🤖 Boto klaida:`, error);
        } finally {
            currentGame.botTurnInProgress = false;
        }
        
    }, 2000);  // Kas 2 sekundes
}

// 🆕 Sustabdyti botų ciklą
function stopBotLoop(gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    if (game.botLoopInterval) {
        clearInterval(game.botLoopInterval);
        game.botLoopInterval = null;
        console.log(`🤖 Sustabdytas botų ciklas: ${gameId}`);
    }
}

// ============================================
// SOCKET.IO PRISIJUNGIMAS
// ============================================
io.on('connection', (socket) => {
    console.log('🎮 Naujas žaidėjas prisijungė:', socket.id);
    console.log('📊 Iš viso prisijungę:', io.engine.clientsCount);
    
    // 🆕 Išsaugoti IP
    socket.clientIp = getClientIp(socket);

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
        
        const check = canCreateGame(socket, isPublic);
        if (!check.can) {
            socket.emit('error', `❌ ${check.reason}`);
            return;
        }
        
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('🆕 Kuriamas žaidimas:', gameId, 'Viešas:', isPublic);
        
        const game = new Game();
        game.setGameId(gameId);
        game.setPublic(isPublic);
        
        game.createdAt = Date.now();
        game.lastActivity = Date.now();
        
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
        
        // 🆕 Išsaugoti IP
        player.ip = socket.clientIp;
        // 🆕 Išsaugoti socketId
        player.socketId = socket.id;
        
        games.set(gameId, game);
        socket.join(gameId);
        socket.leave('lobby');
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
        
        // 🆕 Išsaugoti IP
        player.ip = socket.clientIp;
        // 🆕 Išsaugoti socketId
        player.socketId = socket.id;

        socket.join(gameId.toUpperCase());
        socket.leave('lobby');
        socket.gameId = gameId.toUpperCase();
        socket.playerId = player.id;

        socket.emit('joinedGame', { 
            playerId: player.id,
            player: player
        });
        
        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId.toUpperCase()).emit('message', `👋 ${playerName} prisijungė prie žaidimo!`);
        
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
        player.ip = socket.clientIp;
        
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
    try {
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
    } catch (err) {
        console.error('❌ rollDice klaida:', err);
        socket.emit('error', 'Serverio klaida: ' + err.message);
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

        const result = game.cancelBuy(socket.playerId, false);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        if (game.lastMessage) {
            io.to(socket.gameId).emit('message', game.lastMessage);
        }
    });

    // ============================================
    // 🆕 BANKROTAS (SAUGUS - naudoja socket.playerId)
    // ============================================
    socket.on('bankrupt', () => {
        console.log('💀 SERVERIS GAUNA BANKROTA:', { 
            socketId: socket.id, 
            gameId: socket.gameId,
            playerId: socket.playerId
        });
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', 'Neprisijungei prie žaidimo!');
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }

        // 🆕 NAUDOJAM socket.playerId, NE kliento perduotą
        const result = game.bankruptPlayer(socket.playerId);
        
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('bankruptConfirmed', {
            playerId: socket.playerId,
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
            game.emitFunction('message', `🔨 ${game.players.find(p => p.id === socket.playerId).name} paskelbė aukcioną!`);
        } else {
            io.to(socket.gameId).emit('auctionStarted', result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            io.to(socket.gameId).emit('message', `🔨 ${game.players.find(p => p.id === socket.playerId).name} paskelbė aukcioną!`);
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
    
    // 🆕 Jei gavėjas yra botas – automatiškai apdoroti
    const target = game.getPlayerById(targetPlayerId);
    if (target && target.isBot === true) {
        console.log(`🤖 ${target.name} yra botas – apdorojamas prekybos pasiūlymas`);
        
        // 🆕 Paleisti boto atsakymą po 1.5 sek.
        setTimeout(async () => {
            try {
                const botResult = await game.processBotTradeResponse(targetPlayerId, result.tradeId);
                
                if (botResult) {
                    io.to(socket.gameId).emit('tradeResponded', botResult.result);
                    io.to(socket.gameId).emit('gameState', game.getGameState());
                    
                    const action = botResult.accept ? 'priėmė' : 'atmetė';
                    io.to(socket.gameId).emit('message', `🤖 ${botResult.botName} ${action} prekybą`);
                }
            } catch (err) {
                console.error('🤖 Boto prekybos klaida:', err);
            }
        }, 1500);
    }
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

    // ============================================
// 🤖 BOTO ATSAKYMAS Į PREKYBĄ
// ============================================
socket.on('botTradeResponse', ({ tradeId, botId, accept }) => {
    if (!socket.gameId) return;
    
    const game = games.get(socket.gameId);
    if (!game) return;
    
    const result = game.respondToTrade(tradeId, botId, accept);
    
    if (result.error) {
        console.error(`🤖 Boto atsakymo klaida:`, result.error);
        return;
    }
    
    io.to(socket.gameId).emit('tradeResponded', result);
    io.to(socket.gameId).emit('gameState', game.getGameState());
    
    const bot = game.getPlayerById(botId);
    const action = accept ? 'priėmė' : 'atmetė';
    io.to(socket.gameId).emit('message', `🤖 ${bot ? bot.name : 'Botas'} ${action} prekybą`);
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

        const initiator = game.players.find(p => p.id === socket.playerId);
        const target = game.players.find(p => p.id === targetId);

        io.to(socket.gameId).emit('voteKickStarted', {
            initiatorId: socket.playerId,
            initiatorName: initiator ? initiator.name : 'Nežinomas',
            targetId: targetId,
            targetName: target ? target.name : 'Nežinomas',
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
    // WAITING ROOM
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

    // ============================================
// 🤖 PRIDĖTI BOTĄ
// ============================================
socket.on('addBot', () => {
    console.log('🤖 GAUTA addBot UŽKLAUSA:', { 
        socketId: socket.id, 
        gameId: socket.gameId,
        playerId: socket.playerId
    });
    
    if (!socket.gameId || socket.playerId === undefined) {
        socket.emit('error', 'Neprisijungei prie žaidimo!');
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) {
        socket.emit('error', 'Žaidimas nerastas!');
        return;
    }
    
    // 🆕 Patikrinti ar kūrėjas
    const hostPlayer = game.players.find(p => p.isHost === true);
    const hostId = hostPlayer ? hostPlayer.id : 0;
    
    if (socket.playerId !== hostId) {
        socket.emit('error', 'Tik žaidimo kūrėjas gali pridėti botus!');
        return;
    }
    
    if (game.gameStarted) {
        socket.emit('error', 'Žaidimas jau prasidėjo!');
        return;
    }
    
    // 🆕 Pridėti botą
    const bot = game.addBot();
    
    if (bot.error) {
        socket.emit('error', bot.error);
        return;
    }
    
    console.log(`🤖 Botas pridėtas: ${bot.name} (ID: ${bot.id})`);
    
    // 🆕 Pranešti visiems
    io.to(socket.gameId).emit('message', `🤖 ${bot.name} prisijungė prie žaidimo!`);
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
    
    if (game.isPublic) {
        broadcastPublicGames();
    }
    
    // 🆕 Paleisti botų ciklą
    startBotLoop(socket.gameId);
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
    // 🆕 SPALVŲ REZERVACIJA
    // ============================================
    socket.on('reserveColor', ({ gameId, color }) => {
        if (!gameId || !color) {
            socket.emit('reserveColorResult', { error: 'Trūksta duomenų' });
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            socket.emit('reserveColorResult', { error: 'Žaidimas nerastas' });
            return;
        }
        
        const result = game.reserveColor(color, socket.id);
        socket.emit('reserveColorResult', result);
        
        // 🆕 Pranešti visiems, kad spalva pasikeitė
        if (result.success) {
            // Broadcast atnaujintą spalvų sąrašą visiems, kurie žiūri šį žaidimą
            const used = game.getUsedColors();
            const available = game.getAvailableColors();
            
            io.emit('gameColorsUpdated', {
                gameId: gameId.toUpperCase(),
                available: available,
                used: used
            });
        }
    });

    socket.on('releaseColor', ({ gameId, color }) => {
        if (!gameId || !color) return;
        
        const game = games.get(gameId.toUpperCase());
        if (!game) return;
        
        const result = game.releaseColor(color, socket.id);
        
        if (result.success) {
            const used = game.getUsedColors();
            const available = game.getAvailableColors();
            
            io.emit('gameColorsUpdated', {
                gameId: gameId.toUpperCase(),
                available: available,
                used: used
            });
        }
    });

    // ============================================
    // SPALVŲ GAVIMAS
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
    // VIEŠI STALAI
    // ============================================
    socket.on('getPublicGames', () => {
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
                        maxPlayers: game.maxPlayers,
                        isPublic: true
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
        
        // Tik kūrėjas gali keisti
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
        
        if (isPublic) {
            let publicCount = 0;
            for (const [id, g] of games) {
                if (g.isPublic && !g.gameStarted && id !== socket.gameId) publicCount++;
            }
            
            if (publicCount >= LIMITS.MAX_PUBLIC_GAMES) {
                socket.emit('error', `Jau yra ${LIMITS.MAX_PUBLIC_GAMES} vieši stalai!`);
                return;
            }
        }
        
        game.setPublic(isPublic);
        
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
    
    if (game.isPublic) {
        broadcastPublicGames();
    }
    
    // 🆕 Sustabdyti botų ciklą, jei žaidimas baigtas
    const activePlayers = game.getActivePlayers();
    if (activePlayers.length <= 1 || !game.gameStarted) {
        stopBotLoop(gameIdCopy);
    }
});

    // ============================================
    // ATSIJUNGIMAS
    // ============================================
    socket.on('disconnect', () => {
    console.log('👋 Žaidėjas atsijungė:', socket.id);
    
    socket.leave('lobby');
    
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
            
            // 🆕 Sustabdyti botų ciklą, jei žaidimas baigtas
            const activePlayers = game.getActivePlayers();
            if (activePlayers.length <= 1 || !game.gameStarted) {
                stopBotLoop(socket.gameId);
            }
        }
    }
    });   // ← socket.on('disconnect') pabaiga
});   // ← 🆕 io.on('connection') pabaiga – ŠITO TRŪKSTA!

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Bancrupt serveris veikia http://localhost:${PORT}`);
    console.log(`📡 Laukiama prisijungimų...`);
    console.log(`💀 Bankroto handleris aktyvuotas`);
    console.log(`🗳️ Vote-kick sistema aktyvuota`);
    console.log(`⏳ Waiting room aktyvus`);
    console.log(`🎲 Shuffle aktyvus`);
    console.log(`🌐 Vieši stalai: max ${LIMITS.MAX_PUBLIC_GAMES}`);
    console.log(`🔒 Privatūs stalai: max ${LIMITS.MAX_PRIVATE_GAMES}`);
    console.log(`📊 Viso stalų: max ${LIMITS.MAX_TOTAL_GAMES}`);
    console.log(`👥 Žaidėjų: max ${LIMITS.MAX_PLAYERS_TOTAL}`);
    console.log(`🔗 URL kodas palaikomas`);
});