// server/server.js
require('dotenv').config();   // 🆕 Pirmiausia .env

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const os = require('os');
const Game = require('./gameLogic');
const db = require('./db');
const { RateLimiterMemory } = require('rate-limiter-flexible');   // 🆕

// ============================================
// 🆕 LEIDŽIAMI DOMENAI
// ============================================
const ALLOWED_ORIGINS = [
    'https://bancrupt-production.up.railway.app',
    'https://responsible-nourishment-production.up.railway.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://185.34.52.222:3000',
    'http://bankrotuoju.lt',
    'http://www.bankrotuoju.lt',
    'https://bankrotuoju.lt',
    'https://www.bankrotuoju.lt'
];

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

// 🆕 Saugumo antraštės
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// 🆕 CORS su leidžiamais domenais
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));

app.use(express.json());

// ============================================
// 🆕 HTTP RATE LIMITING
// ============================================
const httpRateLimiter = new RateLimiterMemory({
    points: 100,        // 100 užklausų
    duration: 60,       // per 60 sekundžių
    blockDuration: 60   // blokuoti 60 sekundžių
});

const authRateLimiter = new RateLimiterMemory({
    points: 10,         // 10 bandymų
    duration: 60,       // per 60 sekundžių
    blockDuration: 300  // blokuoti 5 minutes
});

function httpRateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    httpRateLimiter.consume(ip)
        .then(() => next())
        .catch(() => {
            console.log(`⚠️ Rate limit viršytas (HTTP): ${ip}`);
            res.status(429).json({ error: '⏳ Per daug užklausų. Palauk minutę.' });
        });
}

function authRateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    authRateLimiter.consume(ip)
        .then(() => next())
        .catch(() => {
            console.log(`⚠️ Rate limit viršytas (auth): ${ip}`);
            res.status(429).json({ error: '⏳ Per daug bandymų. Palauk 5 minutes.' });
        });
}

// Taikyti HTTP rate limiting visiems API
app.use('/api', httpRateLimitMiddleware);

// Griežtesnis rate limiting registracijai ir prisijungimui
app.use('/api/auth/register', authRateLimitMiddleware);
app.use('/api/auth/login', authRateLimitMiddleware);
app.use('/api/auth/forgot-password', authRateLimitMiddleware);

// 🆕 API ROUTES
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');        // ← NAUJA
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);                   // ← NAUJA

console.log('🔍 API ROUTES UŽREGISTRUOTI');
console.log('🔍 authRoutes tipas:', typeof authRoutes);
console.log('🔍 authRoutes stack:', authRoutes.stack ? authRoutes.stack.length : 'nėra');
console.log('🔍 adminRoutes tipas:', typeof adminRoutes);   // ← NAUJA (neprivaloma)

// ============================================
// 🆕 FEEDBACK (PRANEŠTI / PASIŪLYTI)
// ============================================
app.post('/api/feedback', async (req, res) => {
    const { type, message, email, page, username } = req.body;
    
    console.log('📬 Gautas feedback:', { type, message: message?.substring(0, 50), page, username });
    
    // Validacija
    if (!message || message.length < 5) {
        return res.status(400).json({ error: 'Aprašymas per trumpas' });
    }
    
    if (!type || !['bug', 'idea', 'complaint'].includes(type)) {
        return res.status(400).json({ error: 'Neteisingas tipas' });
    }
    
    if (message.length > 2000) {
        return res.status(400).json({ error: 'Aprašymas per ilgas (max 2000 simbolių)' });
    }
    
    try {
        await db.pool.query(
            `INSERT INTO feedback (type, message, email, page, username, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [type, message, email, page, username]
        );
        
        console.log(`✅ Feedback išsaugotas: [${type}] nuo ${username || 'svečias'} (${page})`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Feedback DB klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            
            if (ALLOWED_ORIGINS.includes(origin)) {
                callback(null, true);
            } else {
                console.log('❌ Blokuotas origin:', origin);
                callback(new Error('CORS neleidžiamas'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    // 🆕 STABILUMAS PER NGINX
    pingTimeout: 60000,        // 60s — kiek laukti pong
    pingInterval: 25000,       // 25s — kas kiek siųsti ping
    upgradeTimeout: 30000,     // 30s — kiek laukti upgrade
    maxHttpBufferSize: 1e6,    // 1MB
    transports: ['websocket', 'polling'],  // websocket pirmiausia
    allowUpgrades: true,
    perMessageDeflate: false,  // Išjungti compression (mažiau CPU)
    httpCompression: false
});

// 🆕 Perduoti io admin routes (kad galėtų siųsti WebSocket)   ← NAUJA
adminRoutes.setIO(io);                                          // ← NAUJA

// ============================================
// 🆕 SOCKET.IO RATE LIMITING
// ============================================
const socketRateLimiter = new RateLimiterMemory({
    points: 30,         // 30 event'ų
    duration: 1,        // per 1 sekundę
    blockDuration: 5    // blokuoti 5 sekundes
});

function checkSocketRateLimit(socket, eventName) {
    const key = `${socket.clientIp || socket.handshake.address}:${eventName}`;
    
    return new Promise((resolve) => {
        socketRateLimiter.consume(key)
            .then(() => resolve(true))
            .catch(() => {
                console.log(`⚠️ Rate limit viršytas (Socket.IO): ${key}`);
                socket.emit('error', '⏳ Per daug užklausų. Palauk kelias sekundes.');
                resolve(false);
            });
    });
}

const games = new Map();

// 🆕 Perduoti games į admin routes (statistikai)
app.set('games', games);

// ============================================
// GAUTI KLIENTO IP
// ============================================
function getClientIp(socket) {
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

function stopBotLoop(gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    if (game.botLoopInterval) {
        clearInterval(game.botLoopInterval);
        game.botLoopInterval = null;
        console.log(`🤖 Botų ciklas sustabdytas žaidimui: ${gameId}`);
    }
}


// ============================================
// 🤖 BOTŲ CIKLAS
// ============================================
function startBotLoop(gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    if (game.botLoopInterval) {
        clearInterval(game.botLoopInterval);
        game.botLoopInterval = null;
    }
    
    console.log(`🤖 Pradedamas botų ciklas žaidimui: ${gameId}`);
    
    game.botLoopInterval = setInterval(async () => {
        const currentGame = games.get(gameId);
        if (!currentGame) {
            clearInterval(game.botLoopInterval);
            return;
        }
        
        if (!currentGame.gameStarted) {
            return;
        }
        
        const currentBot = currentGame.getCurrentBot();
        if (!currentBot) {
            return;
        }
        
        if (currentGame.botTurnInProgress) {
            return;
        }

        if (currentGame.isRolling) {
    console.log(`⏳ Botų ciklas: laukiama, kol baigsis metimas`);
    return;
}

// 🆕 Jei laukiama processField – praleisti
if (currentGame.pendingFieldPlayerId !== null && currentGame.pendingFieldPlayerId !== undefined) {
    console.log(`⏳ Botų ciklas: laukiama processField (pending=${currentGame.pendingFieldPlayerId})`);
    return;
}

currentGame.botTurnInProgress = true;

try {
    console.log(`🤖 Botas ${currentBot.name} pradeda...`);
    
    // 🆕 Jei laukiama pirkimo sprendimo – praleisti
    if (currentGame.waitingForBuy) {
        console.log(`⏳ Botų ciklas: laukiama pirkimo sprendimo`);
        return;
    }

    const result = await currentGame.botTurn(currentBot.id, (event, data) => {
        io.to(gameId).emit(event, data);
    });
    
    console.log(`🤖 Botas ${currentBot.name} baigė:`, result);
    
    io.to(gameId).emit('gameState', currentGame.getGameState());
            
           if (result && result.rollResult) {
                io.to(gameId).emit('diceRolled', result.rollResult);
                
                // 🆕 SIŲSTI METIMO PRANEŠIMĄ VISIEMS
                if (result.rollResult.dice && result.rollResult.player) {
                    const rollMsg = `${result.rollResult.player.name} metė ${result.rollResult.dice[0]}+${result.rollResult.dice[1]}=${result.rollResult.total}`;
                    io.to(gameId).emit('message', rollMsg);
                }
                
                // 🆕 Jei reikia processField – apdorojam po animacijos
                if (result.rollResult.needsProcessField) {
                    // 🆕 Nustatom, kad botas laukia apdorojimo
                    currentGame.pendingFieldPlayerId = currentBot.id;
                    
                    // Palaukim, kol klientai atliks animaciją (2.5 sek.)
                    setTimeout(() => {
                        try {
                            // 🆕 Patikrinam, ar dar reikia apdoroti (kad nedublikuotųsi)
                            if (currentGame.pendingFieldPlayerId !== currentBot.id) {
                                console.log(`⚠️ Botas ${currentBot.name}: processField jau atliktas – praleista`);
                                return;
                            }
                            
                            // 🆕 Išvalom
                            currentGame.pendingFieldPlayerId = null;
                            
                            // 🆕 Atblokuoti metimą prieš processField (botas neturi socket'o)
                            currentGame.isRolling = false;
                            console.log('🔓 isRolling = false (botLoop processField)');
                            
                            console.log(`🎯 Botas ${currentBot.name}: processField`);
                            
                            const processResult = currentGame.processField(currentBot.id);
                            
                            io.to(gameId).emit('fieldResult', processResult);
                            io.to(gameId).emit('gameState', currentGame.getGameState());
                            
                            if (processResult.message) {
                                io.to(gameId).emit('message', processResult.message);
                            }
                            
                            // 🆕 Jei botas gali pirkti – nusprendžia
                            if (processResult.canBuy) {
                                setTimeout(() => {
                                    const field = currentGame.board[currentBot.position];
                                    const shouldBuy = currentGame.botShouldBuyProperty(currentBot, field);
                                    
                                    if (shouldBuy) {
                                        console.log(`🤖 ${currentBot.name}: perka ${field.name}`);
                                        const buyResult = currentGame.buyProperty(currentBot.id);
                                        
                                        if (buyResult.message) {
                                            io.to(gameId).emit('message', buyResult.message);
                                        }
                                        
                                        const chatMsg = currentGame.sendBotChat(currentBot.id, 'buy');
                                        if (chatMsg) {
                                            io.to(gameId).emit('chatMessage', chatMsg);
                                        }
                                    } else {
                                        console.log(`🤖 ${currentBot.name}: atsisako pirkti ${field.name}`);
                                        currentGame.cancelBuy(currentBot.id);
                                    }
                                    
                                    io.to(gameId).emit('gameState', currentGame.getGameState());
                                }, 1500);
                            }
                        } catch (err) {
                            console.error(`🤖 Klaida processField:`, err);
                        }
                    }, 2500);
                } else {
                    // Senas kelias (3 dubliai, kalėjimas) – siunčiam pranešimą
                    const msg = (result.rollResult.result && result.rollResult.result.message) 
                        || result.rollResult.message;
                    if (msg) {
                        io.to(gameId).emit('message', msg);
                    }
                }
            }
            
            // 🆕 Boto chat po ėjimo
            if (result && result.action) {
                let chatEvent = null;
                
                if (result.action === 'bought') chatEvent = 'buy';
                else if (result.action === 'built') chatEvent = 'build';
                else if (result.action === 'paid_jail') chatEvent = 'jail';
                else if (result.action === 'bankrupt') chatEvent = 'bankrupt';
                
                if (chatEvent) {
                    const chatMsg = currentGame.sendBotChat(currentBot.id, chatEvent);
                    if (chatMsg) {
                        io.to(gameId).emit('chatMessage', chatMsg);
                    }
                }
            }
            
            // 🆕 Boto prekybos siūlymas (10%)
            if (Math.random() < 0.1) {
                const proposeResult = await currentGame.processBotProposeTrade(currentBot.id);
                if (proposeResult && proposeResult.result && proposeResult.result.success) {
                    io.to(gameId).emit('tradeProposed', proposeResult.result);
                    
                    const chatMsg = currentGame.sendBotChat(currentBot.id, 'trade_offer');
                    if (chatMsg) {
                        io.to(gameId).emit('chatMessage', chatMsg);
                    }
                }
            }
            
            // 🆕 Boto vote-kick balsas
            if (currentGame.activeVoteKick) {
                const voteResult = await currentGame.processBotVoteKick(currentBot.id);
                if (voteResult && voteResult.result) {
                    if (voteResult.result.finished) {
                        io.to(gameId).emit('gameState', currentGame.getGameState());
                    } else {
                        const vkState = voteResult.result.voteKick;
                        if (vkState) {
                            io.to(gameId).emit('voteKickUpdate', {
                                votes: vkState.votes,
                                requiredVotes: vkState.requiredVotes,
                                timeLeft: vkState.timeLeft,
                                targetName: vkState.targetName,
                                targetId: vkState.targetId
                            });
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(`🤖 Boto klaida:`, error);
        } finally {
            currentGame.botTurnInProgress = false;
        }
        
    }, 2000);
}

// ============================================
// 🆕 JWT SOCKET.IO AUTENTIFIKACIJA
// ============================================
const authLogic = require('./authLogic');

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    
    // Svečias – leisti, bet be paskyros
    if (!token) {
        console.log('👤 Svečias prisijungė (be JWT)');
        socket.userId = null;
        socket.isGuest = true;
        return next();
    }
    
    // Tikrinti JWT
    const decoded = authLogic.verifyToken(token);
    if (!decoded) {
        console.log('❌ Neteisingas JWT – atmetama');
        return next(new Error('Neteisingas JWT'));
    }
    
    socket.userId = decoded.userId;
    socket.isGuest = false;
    
    console.log(`✅ Prisijungęs vartotojas: userId=${socket.userId}`);
    next();
});

// ============================================
// SOCKET.IO PRISIJUNGIMAS
// ============================================
io.on('connection', (socket) => {
    console.log('🎮 Naujas žaidėjas prisijungė:', socket.id);
    console.log('📊 Iš viso prisijungę:', io.engine.clientsCount);
    console.log(`👤 Tipas: ${socket.isGuest ? 'Svečias' : 'Prisijungęs'} (userId: ${socket.userId})`);
    
    socket.clientIp = getClientIp(socket);

    // ============================================
    // SUKURTI ŽAIDIMĄ
    // ============================================
    socket.on('createGame', async (data) => {
        if (!await checkSocketRateLimit(socket, 'createGame')) return;

        console.log('📥 Gauta createGame užklausa:', data);
        
        const playerName = data.name || data;
        const playerColor = data.color || null;
        const isPublic = data.isPublic === true;
        const userId = data.userId || null;
        
        if (!playerName || playerName.trim() === '') {
            socket.emit('error', 'Įvesk vardą!');
            return;
        }
        
        const check = canCreateGame(socket, isPublic);
        if (!check.can) {
            socket.emit('error', `❌ ${check.reason}`);
            return;
        }
        
        const gameId = Math.floor(100000 + Math.random() * 900000).toString();
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
        
        // 🆕 NUSKAITYTI EMOJI IŠ DB
        let emoji = null;
        if (userId) {
            try {
                const userResult = await db.pool.query('SELECT emoji FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    emoji = userResult.rows[0].emoji;
                    console.log('🎨 Gautas emoji iš DB:', emoji);
                }
            } catch (err) {
                console.error('❌ Nepavyko nuskaityti emoji:', err);
            }
        }
        
        // 🆕 Perduodame emoji į addPlayer (4 parametras)
        const player = game.addPlayer(playerName.trim(), playerColor, userId, emoji);
        
        if (player.error) {
            socket.emit('error', player.error);
            return;
        }
        
        player.ip = socket.clientIp;
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

        // 🆕 Siųsti vidurio langelius
        try {
            const centerCells = await db.getCenterCells();
            socket.emit('centerCells', centerCells);
        } catch (err) {
            console.error('❌ centerCells klaida:', err);
        }

        // 🆕 Siųsti garso nustatymus
        try {
            const soundSettings = await db.getSoundSettings();
            socket.emit('soundSettings', soundSettings);
            console.log('🔊 soundSettings išsiųstas (createGame)');
        } catch (err) {
            console.error('❌ soundSettings klaida:', err);
        }

        // 🆕 Siųsti garso failus
        try {
            const soundFiles = await db.getSoundFiles();
            socket.emit('soundFiles', soundFiles);
            console.log('📁 soundFiles išsiųstas (createGame)');
        } catch (err) {
            console.error('❌ soundFiles klaida:', err);
        }

        // 🆕 Siųsti lentos nustatymus   ← NAUJA!
        try {
            const boardSettings = await db.getBoardSettings();
            socket.emit('boardSettings', boardSettings);
            console.log('📐 boardSettings išsiųstas (createGame)');
        } catch (err) {
            console.error('❌ boardSettings klaida:', err);
        }

        if (isPublic) {
            broadcastPublicGames();
        }
    });

    // ============================================
    // PRISIJUNGTI PRIE ŽAIDIMO
    // ============================================
    socket.on('joinGame', async ({ gameId, playerName, color, userId }) => {
        console.log('📥 Gauta joinGame užklausa:', { gameId, playerName, color, userId });
        
        if (!gameId || !playerName) {
            socket.emit('error', 'Įvesk žaidimo ID ir vardą!');
            return;
        }
        
        const game = games.get(gameId);
        if (!game) {
            socket.emit('error', 'Žaidimas nerastas!');
            return;
        }
        
        if (game.gameStarted) {
            socket.emit('error', 'Žaidimas jau prasidėjo!');
            return;
        }

        // 🆕 NUSKAITYTI EMOJI IŠ DB
        let emoji = null;
        if (userId) {
            try {
                const userResult = await db.pool.query('SELECT emoji FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    emoji = userResult.rows[0].emoji;
                    console.log('🎨 Gautas emoji iš DB (joinGame):', emoji);
                }
            } catch (err) {
                console.error('❌ Nepavyko nuskaityti emoji (joinGame):', err);
            }
        }

        // 🆕 Perduodame emoji į addPlayer (4 parametras)
        const player = game.addPlayer(playerName.trim(), color, userId, emoji);
        if (player.error) {
            socket.emit('error', player.error);
            return;
        }
        
        player.ip = socket.clientIp;
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

        // 🆕 Siųsti vidurio langelius
        try {
            const centerCells = await db.getCenterCells();
            socket.emit('centerCells', centerCells);
        } catch (err) {
            console.error('❌ centerCells klaida:', err);
        }

        // 🆕 Siųsti garso nustatymus
        try {
            const soundSettings = await db.getSoundSettings();
            socket.emit('soundSettings', soundSettings);
            console.log('🔊 soundSettings išsiųstas (joinGame)');
        } catch (err) {
            console.error('❌ soundSettings klaida:', err);
        }

        // 🆕 Siųsti garso failus
        try {
            const soundFiles = await db.getSoundFiles();
            socket.emit('soundFiles', soundFiles);
            console.log('📁 soundFiles išsiųstas (joinGame)');
        } catch (err) {
            console.error('❌ soundFiles klaida:', err);
        }

        // 🆕 Siųsti lentos nustatymus   ← NAUJA!
        try {
            const boardSettings = await db.getBoardSettings();
            socket.emit('boardSettings', boardSettings);
            console.log('📐 boardSettings išsiųstas (joinGame)');
        } catch (err) {
            console.error('❌ boardSettings klaida:', err);
        }

        if (game.isPublic) {
            broadcastPublicGames();
        }
    });

    // ============================================
    // REKONEKCIJA
    // ============================================
    socket.on('reconnectPlayer', async ({ gameId, playerToken }) => {
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

        // 🆕 Siųsti vidurio langelius
        try {
            const centerCells = await db.getCenterCells();
            socket.emit('centerCells', centerCells);
        } catch (err) {
            console.error('❌ centerCells klaida:', err);
        }

        // 🆕 Siųsti garso nustatymus
        try {
            const soundSettings = await db.getSoundSettings();
            socket.emit('soundSettings', soundSettings);
            console.log('🔊 soundSettings išsiųstas (reconnectPlayer)');
        } catch (err) {
            console.error('❌ soundSettings klaida:', err);
        }

        // 🆕 Siųsti garso failus
        try {
            const soundFiles = await db.getSoundFiles();
            socket.emit('soundFiles', soundFiles);
            console.log('📁 soundFiles išsiųstas (reconnectPlayer)');
        } catch (err) {
            console.error('❌ soundFiles klaida:', err);
        }

        // 🆕 Siųsti lentos nustatymus   ← NAUJA!
        try {
            const boardSettings = await db.getBoardSettings();
            socket.emit('boardSettings', boardSettings);
            console.log('📐 boardSettings išsiųstas (reconnectPlayer)');
        } catch (err) {
            console.error('❌ boardSettings klaida:', err);
        }
    }); 

    socket.on('rollDice', async () => {
        if (!await checkSocketRateLimit(socket, 'rollDice')) return;
        
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

            // 🆕 Jei pending_purchase – nesiųsti diceRolled   ← NAUJA!
            if (result.action === 'pending_purchase') {
                console.log(`💰 pendingPurchase: ${result.player.name} gali pirkti ${result.field.name}`);
                socket.emit('pendingPurchase', {
                    playerId: result.player.id,
                    playerName: result.player.name,
                    fieldId: result.field.id,
                    fieldName: result.field.name,
                    fieldCost: result.field.cost
                });
                io.to(socket.gameId).emit('gameState', game.getGameState());
                return;
            }

            // 🆕 Jei reikia processField – laikinai išsaugom
            if (result.needsProcessField) {
                game.pendingFieldPlayerId = socket.playerId;
            }

            // 🆕 Siunčiam diceRolled (be jokių pranešimų)
            io.to(socket.gameId).emit('diceRolled', result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            
            // 🆕 SIŲSTI METIMO PRANEŠIMĄ VISIEMS   ← NAUJA!
            if (result.dice && result.player) {
                const rollMsg = `${result.player.name} metė ${result.dice[0]}+${result.dice[1]}=${result.total}`;
                io.to(socket.gameId).emit('message', rollMsg);
            }
            
            // 🆕 Jei NE needsProcessField (3 dubliai, kalėjimas) – siunčiam pranešimą IŠKART
            if (!result.needsProcessField) {
                if (result.messageKey) {
                    io.to(socket.gameId).emit('message', {
                        key: result.messageKey,
                        data: result.messageData || {}
                    });
                } else if (result.result && result.result.messageKey) {
                    io.to(socket.gameId).emit('message', {
                        key: result.result.messageKey,
                        data: result.result.messageData || {}
                    });
                } else if (result.result && result.result.message) {
                    io.to(socket.gameId).emit('message', result.result.message);
                } else if (result.message) {
                    io.to(socket.gameId).emit('message', result.message);
                }
            }
            
        } catch (err) {
            console.error('❌ rollDice klaida:', err);
            socket.emit('error', 'Serverio klaida: ' + err.message);
        }
    });

    

    // 🆕 KLIENTAS PRANEŠA, KAD ANIMACIJA BAIGTA
socket.on('movementFinished', () => {
    if (!socket.gameId || socket.playerId === undefined) {
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) return;
    
    // 🆕 Atblokuoti metimą (isRolling = false)
    game.isRolling = false;
    console.log('🔓 isRolling = false (movementFinished)');
    
    // 🆕 Apdorojam TIK jei šis žaidėjas laukia apdorojimo
    if (game.pendingFieldPlayerId !== socket.playerId) {
        console.log(`⚠️ movementFinished: laukiama ${game.pendingFieldPlayerId}, gauta ${socket.playerId} – praleista`);
        return;
    }
    
    // 🆕 Išvalom
    const playerIdToProcess = game.pendingFieldPlayerId;
    game.pendingFieldPlayerId = null;
    
    console.log(`🎯 movementFinished: apdorojam player ${playerIdToProcess}`);
    
    const result = game.processField(playerIdToProcess);
    if (result.error) {
        socket.emit('error', result.error);
        return;
    }
    
    io.to(socket.gameId).emit('fieldResult', result);
    io.to(socket.gameId).emit('gameState', game.getGameState());
    
    if (result.messageKey) {
        io.to(socket.gameId).emit('message', {
            key: result.messageKey,
            data: result.messageData || {}
        });
    } else if (result.message) {
        io.to(socket.gameId).emit('message', result.message);
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

    // 🆕 ČIA TRŪKO ŠIOS EILUTĖS!
    const result = game.buyProperty(socket.playerId);
    if (result.error) {
        socket.emit('error', result.error);
        return;
    }

    io.to(socket.gameId).emit('gameState', game.getGameState());
    
    // 🆕 messageKey blokas
    if (result.messageKey) {
        io.to(socket.gameId).emit('message', {
            key: result.messageKey,
            data: result.messageData || {}
        });
    } else if (result.message) {
        io.to(socket.gameId).emit('message', result.message);
    }
    
    // 🆕 Jei pendingPurchase – papildomas pranešimas
    if (result.pendingPurchase) {
        console.log(`💰 pendingPurchase pirkimas baigtas – žaidėjas gali mesti kauliukus`);
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
        
        // 🆕 Jei pendingPurchase – papildomas pranešimas   ← NAUJA!
        if (result.pendingPurchase) {
            console.log(`❌ pendingPurchase atsisakymas baigtas – žaidėjas gali mesti kauliukus`);
        }
    });

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

    socket.on('chatMessage', async (message) => {
    if (!await checkSocketRateLimit(socket, 'chatMessage')) return;
    
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
        
        // 🆕 Informuoti botus apie aukcioną
        const bots = game.getBots();
        bots.forEach(bot => {
            if (bot.id !== socket.playerId) {
                setTimeout(() => {
                    io.to(socket.gameId).emit('botBidAuction', { botId: bot.id, auctionId: result.auctionId });
                }, 2000 + Math.random() * 3000);
            }
        });
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
        
        // 🆕 Boto chat
        const bidChatMsg = game.sendBotChat(socket.playerId, 'auction_bid');
        if (bidChatMsg) {
            io.to(socket.gameId).emit('chatMessage', bidChatMsg);
        }
    });

    // ============================================
    // 🤖 BOTŲ BID AUKCIONE
    // ============================================
    socket.on('botBidAuction', async ({ botId, auctionId }) => {
        if (!socket.gameId) return;
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const bot = game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        await game.tradingLogic.botBidAuction(botId, auctionId);
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
        
        const target = game.getPlayerById(targetPlayerId);
        if (target && target.isBot === true) {
            console.log(`🤖 ${target.name} yra botas – apdorojamas prekybos pasiūlymas`);
            
            setTimeout(async () => {
                try {
                    const botResult = await game.processBotTradeResponse(targetPlayerId, result.tradeId);
                    
                    if (botResult) {
                        io.to(socket.gameId).emit('tradeResponded', botResult.result);
                        io.to(socket.gameId).emit('gameState', game.getGameState());
                        
                        const action = botResult.accept ? 'priėmė' : 'atmetė';
                        io.to(socket.gameId).emit('message', `🤖 ${botResult.botName} ${action} prekybą`);
                        
                        const chatEvent = botResult.accept ? 'trade_accept' : 'trade_reject';
                        const chatMsg = game.sendBotChat(targetPlayerId, chatEvent);
                        if (chatMsg) {
                            io.to(socket.gameId).emit('chatMessage', chatMsg);
                        }
                    }
                } catch (err) {
                    console.error('🤖 Boto prekybos klaida:', err);
                }
            }, 1500);
        }
    });

    // ============================================
    // 🤖 BOTŲ PREKYBOS SIŪLYMAS
    // ============================================
    socket.on('botProposeTrade', async ({ botId }) => {
        if (!socket.gameId) return;
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const bot = game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        if (game.tradingLogic.trades.size > 0) return;
        
        const result = await game.processBotProposeTrade(botId);
        
        if (result && result.result && result.result.success) {
            io.to(socket.gameId).emit('tradeProposed', result.result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            
            const chatMsg = game.sendBotChat(botId, 'trade_offer');
            if (chatMsg) {
                io.to(socket.gameId).emit('chatMessage', chatMsg);
            }
        }
    });

    // ============================================
    // 🤖 BOTŲ VOTE-KICK BALSAS
    // ============================================
    socket.on('botVoteKick', async ({ botId }) => {
        if (!socket.gameId) return;
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const bot = game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        if (!game.activeVoteKick) return;
        
        const result = await game.processBotVoteKick(botId);
        
        if (result && result.result) {
            if (result.result.finished) {
                io.to(socket.gameId).emit('gameState', game.getGameState());
            } else {
                const vkState = result.result.voteKick;
                if (vkState) {
                    io.to(socket.gameId).emit('voteKickUpdate', {
                        votes: vkState.votes,
                        requiredVotes: vkState.requiredVotes,
                        timeLeft: vkState.timeLeft,
                        targetName: vkState.targetName,
                        targetId: vkState.targetId
                    });
                }
                io.to(socket.gameId).emit('gameState', game.getGameState());
            }
        }
    });

    // ============================================
    // 🤖 BOTŲ CHAT
    // ============================================
    socket.on('botChat', ({ botId, event, data }) => {
        if (!socket.gameId) return;
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const bot = game.getPlayerById(botId);
        if (!bot || !bot.isBot) return;
        
        const chatMsg = game.sendBotChat(botId, event, data);
        
        if (chatMsg) {
            io.to(socket.gameId).emit('chatMessage', chatMsg);
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
        
        // 🆕 Informuoti botus apie balsavimą
        const bots = game.getBots();
        bots.forEach(bot => {
            if (bot.id !== socket.playerId && bot.id !== targetId) {
                setTimeout(() => {
                    io.to(socket.gameId).emit('botVoteKick', { botId: bot.id });
                }, 2000 + Math.random() * 3000);
            }
        });
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
    socket.on('addBot', async () => {
    if (!await checkSocketRateLimit(socket, 'addBot')) return;
    
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
        
        const bot = game.addBot();
        
        if (bot.error) {
            socket.emit('error', bot.error);
            return;
        }
        
        console.log(`🤖 Botas pridėtas: ${bot.name} (ID: ${bot.id})`);
        
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
        
        // 🆕 Boto chat start
        const firstBot = game.getBots()[0];
        if (firstBot) {
            setTimeout(() => {
                const chatMsg = game.sendBotChat(firstBot.id, 'start');
                if (chatMsg) {
                    io.to(socket.gameId).emit('chatMessage', chatMsg);
                }
            }, 5000);
        }
        
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
    // SPALVŲ REZERVACIJA
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
        
        // 🆕 IŠVALYTI socketId iš VISŲ žaidėjo stalų
        for (const [id, g] of games) {
            const p = g.players.find(pl => pl.socketId === socket.id);
            if (p) {
                p.socketId = null;
            }
        }
        
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
                
                const activePlayers = game.getActivePlayers();
                if (activePlayers.length <= 1 || !game.gameStarted) {
                    stopBotLoop(socket.gameId);
                }
            }
        }
    });
});

// ============================================
// SERVERIO PALEIDIMAS
// ============================================
const PORT = process.env.PORT || 3000;

db.initDatabase().then(async () => {                    // ← Pridėta "async"
    // 🆕 Įkelti board cache iš DB
    const Game = require('./gameLogic');                // ← NAUJA
    await Game.loadBoardCache();                        // ← NAUJA

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
        console.log(`🤖 Botai aktyvuoti`);
    });
}).catch(err => {
    console.error('❌ Nepavyko paleisti serverio:', err);
    process.exit(1);
});