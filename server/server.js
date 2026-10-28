// server/server.js
require('dotenv').config();

const express = require('express');
const { L } = require('./i18nSrv');   // 🌐 tekstai iš lang/lt.json
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const os = require('os');
const Game = require('./gameLogic');
const db = require('./db');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { v4: uuidv4 } = require('uuid');           // 🆕 PRIDĖTA
const visitStats = require('./visitStats');      // 📊 lankytojai be slapukų
const cookieParser = require('cookie-parser');

// 🛡️ Teksto valymas (vardai, chat) – apsauga nuo kodo įterpimo
const MAX_NAME_LENGTH = 20;
const MAX_CHAT_LENGTH = 300;
function cleanText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/[<>&"'`]/g, '')
        .trim()
        .slice(0, maxLength);
}

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
    'https://www.bankrotuoju.lt',
    'http://bankro.lt',               // 🆕
    'http://www.bankro.lt',           // 🆕
    'https://bankro.lt',              // 🆕
    'https://www.bankro.lt'           // 🆕
];

// ============================================
// LIMITAI
// ============================================
const LIMITS = {
    MAX_PUBLIC_GAMES: 100,
    MAX_PRIVATE_GAMES: 100,
    MAX_TOTAL_GAMES: 200,
    MAX_PLAYERS_TOTAL: 2400,
    MAX_GAMES_PER_PLAYER: 5,     // vienas žaidėjas – iki 5 aktyvių stalų vienu metu
    MAX_GAMES_PER_IP: 10,        // iš vieno IP (pvz., namų internetas) – iki 10 stalų
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

app.use(cookieParser());   // 🆕

// 🆕 LANKYTOJŲ SKAIČIAVIMAS – be slapukų (žr. visitStats.js)
app.use((req, res, next) => {
    // Neskaičiuojame API, admin panelės, socket.io ar statinių failų
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin') &&
        !req.path.startsWith('/socket.io') && !req.path.includes('.')) {
        visitStats.trackPage(req);
    }
    next();
});

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
            res.status(429).json({ error: L('srv.server.per_daug_uzklausu_palauk_minute') });
        });
}

function authRateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    authRateLimiter.consume(ip)
        .then(() => next())
        .catch(() => {
            console.log(`⚠️ Rate limit viršytas (auth): ${ip}`);
            res.status(429).json({ error: L('srv.server.per_daug_bandymu_palauk_minutes') });
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
    const body = req.body || {};
    const type = body.type;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    // 🛡️ Vardas ir ID imami TIK iš prisijungimo (JWT), ne iš to, ką atsiunčia naršyklė
    let userId = null;
    let username = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const decoded = authLogic.verifyToken(authHeader.slice(7));
        if (decoded && decoded.userId) {
            userId = decoded.userId;
            try {
                const u = await db.findUserById(decoded.userId);
                if (u) username = u.username;
            } catch (e) { /* nieko */ }
        }
    }

    // 🛡️ El. paštas – tik tikras el. pašto adresas (arba nieko)
    let email = typeof body.email === 'string' ? body.email.trim().slice(0, 100) : '';
    if (email && !/^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/.test(email)) {
        return res.status(400).json({ error: L('srv.server.neteisingas_el_pasto_adresas') });
    }
    if (!email) email = null;

    const page = cleanText(typeof body.page === 'string' ? body.page : '', 30) || 'unknown';
    
    console.log('📬 Gautas feedback:', { type, message: message.substring(0, 50), page, username, userId });
    
    // Validacija
    if (!message || message.length < 5) {
        return res.status(400).json({ error: L('srv.server.aprasymas_per_trumpas') });
    }
    
    if (!type || !['bug', 'idea', 'complaint'].includes(type)) {
        return res.status(400).json({ error: L('srv.server.neteisingas_tipas') });
    }
    
    if (message.length > 2000) {
        return res.status(400).json({ error: L('srv.server.aprasymas_per_ilgas_max_2000') });
    }
    
    try {
        await db.pool.query(
            `INSERT INTO feedback (type, message, email, page, username, user_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,                        // ← PRIDĖTA user_id
            [type, message, email, page, username, userId || null]           // ← PRIDĖTA userId
        );
        
        console.log(`✅ Feedback išsaugotas: [${type}] nuo ${username || 'svečias'} (userId: ${userId || 'nėra'})`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Feedback DB klaida:', err);
        res.status(500).json({ error: L('srv.server.serverio_klaida') });
    }
});

// 📊 Lankytojų statistika (ADMIN) – dabar routes/admin.js → GET /api/admin/stats/visitors (su admin prisijungimu)

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
// 🛡️ Stalo kodo spėliojimas: daugiausiai 20 nesėkmingų bandymų per minutę, tada 5 min. pertrauka
const joinFailLimiter = new RateLimiterMemory({
    points: 20,
    duration: 60,
    blockDuration: 300
});

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
                socket.emit('error', L('srv.server.per_daug_uzklausu_palauk_kelias'));
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
// 🛡️ Pirmą X-Forwarded-For reikšmę gali įrašyti pats žaidėjas (F12 / įrankiai),
// todėl imam X-Real-IP (nustato nginx) arba PASKUTINĘ reikšmę (ją prideda nginx).
function getClientIp(socket) {
    const headers = socket.handshake.headers || {};
    const realIp = headers['x-real-ip'];
    if (realIp) return String(realIp).trim();
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
        const parts = String(forwarded).split(',').map(x => x.trim()).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
    }
    return socket.handshake.address;
}

// ============================================
// 🛡️ ĖJIMO LAIKMAČIO APSAUGA (žaidimas neturi užstrigti)
// ============================================
setInterval(() => {
    for (const [, game] of games) {
        try { if (typeof game.ensureTurnTimer === 'function') game.ensureTurnTimer(); }
        catch (e) { console.error('❌ ensureTurnTimer klaida:', e.message); }
    }
}, 4000);

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
        return { can: false, reason: L('srv.server.serveris_pilnas_max_stalu', { MAX_TOTAL_GAMES: LIMITS.MAX_TOTAL_GAMES }) };
    }
    
    if (isPublic) {
        let publicCount = 0;
        for (const [id, g] of games) {
            if (g.isPublic && !g.gameStarted) publicCount++;
        }
        if (publicCount >= LIMITS.MAX_PUBLIC_GAMES) {
            return { can: false, reason: L('srv.server.viesu_stalu_limitas', { MAX_PUBLIC_GAMES: LIMITS.MAX_PUBLIC_GAMES }) };
        }
    }
    
    if (!isPublic) {
        let privateCount = 0;
        for (const [id, g] of games) {
            if (!g.isPublic && !g.gameStarted) privateCount++;
        }
        if (privateCount >= LIMITS.MAX_PRIVATE_GAMES) {
            return { can: false, reason: L('srv.server.privaciu_stalu_limitas', { MAX_PRIVATE_GAMES: LIMITS.MAX_PRIVATE_GAMES }) };
        }
    }
    
    // Skaičiuojam tik stalus, kuriuose žaidėjas dar tikrai yra (neišėjęs, neišmestas)
    const playerGames = [...games.values()].filter(g => 
        g.players.some(p => p.socketId === socket.id && !p.left && !p.kicked)
    ).length;
    if (playerGames >= LIMITS.MAX_GAMES_PER_PLAYER) {
        return { can: false, reason: L('srv.server.tu_jau_turi_aktyvius_stalus', { MAX_GAMES_PER_PLAYER: LIMITS.MAX_GAMES_PER_PLAYER }) };
    }
    
    const ip = getClientIp(socket);
    const ipGames = [...games.values()].filter(g => 
        g.players.some(p => p.ip === ip && !p.left && !p.kicked)
    ).length;
    if (ipGames >= LIMITS.MAX_GAMES_PER_IP) {
        return { can: false, reason: L('srv.server.per_daug_stalu_is_tavo', { MAX_GAMES_PER_IP: LIMITS.MAX_GAMES_PER_IP }) };
    }
    
    const totalPlayers = [...games.values()].reduce((sum, g) => 
        sum + g.players.filter(p => !p.left && !p.kicked).length, 0
    );
    if (totalPlayers >= LIMITS.MAX_PLAYERS_TOTAL) {
        return { can: false, reason: L('srv.server.serveris_pilnas_max_zaideju', { MAX_PLAYERS_TOTAL: LIMITS.MAX_PLAYERS_TOTAL }) };
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
                    hostName: activePlayers[0] ? activePlayers[0].name : L('srv.word.unknown'),
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

        // 🚕 Laukiama taksi sprendimo / 🏗️ vyksta statybų laikas – botas nemeta
        if (currentGame.waitingForTaxi || currentGame.waitingForBuild) {
            return;
        }

        if (currentGame.isRolling) {
    // console.log(`⏳ Botų ciklas: laukiama, kol baigsis metimas`);
    return;
}

// 🆕 Jei laukiama processField – praleisti
if (currentGame.pendingFieldPlayerId !== null && currentGame.pendingFieldPlayerId !== undefined) {
    console.log(`⏳ Botų ciklas: laukiama processField (pending=${currentGame.pendingFieldPlayerId})`);
    return;
}

currentGame.botTurnInProgress = true;

try {
    // console.log(`🤖 Botas ${currentBot.name} pradeda...`);
    
    // 🆕 Jei laukiama pirkimo sprendimo – praleisti
    if (currentGame.waitingForBuy) {
        console.log(`⏳ Botų ciklas: laukiama pirkimo sprendimo`);
        return;
    }

    const result = await currentGame.botTurn(currentBot.id, (event, data) => {
        io.to(gameId).emit(event, data);
    });
    
    console.log(`🤖 Botas ${currentBot.name} baigė: action=${result.action}, dice=${result.rollResult?.dice?.join('+') || '-'}=${result.rollResult?.total || '-'}`);
    
    io.to(gameId).emit('gameState', currentGame.getGameState());
            
           if (result && result.rollResult) {
                io.to(gameId).emit('diceRolled', result.rollResult);
                
                // 🆕 SIŲSTI METIMO PRANEŠIMĄ VISIEMS
                if (result.rollResult.dice && result.rollResult.player) {
                    const rollMsg = L('srv.game.rolled', { player: result.rollResult.player.name, d1: result.rollResult.dice[0], d2: result.rollResult.dice[1], total: result.rollResult.total });
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
                         //   console.log('🔓 isRolling = false (botLoop processField)');
                            
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
    visitStats.trackSocket(socket, socket.clientIp);   // 📊 tikras lankytojas (naršyklė)

    // 🛡️ Visi įvykiai apsaugoti: blogi duomenys (F12) nebegali „nuversti“ serverio,
    // o stalo kodas visada paverčiamas trumpu tekstu
    const originalOn = socket.on.bind(socket);
    socket.on = (eventName, handler) => originalOn(eventName, (...args) => {
        try {
            const payload = args[0];
            if (payload && typeof payload === 'object' && !Array.isArray(payload) &&
                Object.prototype.hasOwnProperty.call(payload, 'gameId') && payload.gameId !== null && payload.gameId !== undefined) {
                payload.gameId = String(payload.gameId).slice(0, 12);
            }
            if (eventName !== 'disconnect' && payload === undefined && handler.length > 0) {
                args[0] = {};
            }
            const result = handler(...args);
            if (result && typeof result.catch === 'function') {
                result.catch(err => console.error(`❌ Įvykio „${eventName}“ klaida:`, err));
            }
            return result;
        } catch (err) {
            console.error(`❌ Įvykio „${eventName}“ klaida:`, err);
        }
    });

    // ============================================
    // 🆕 AFK: bet koks paties žaidėjo veiksmas reiškia, kad jis prie stalo
    // ============================================
    const AFK_RESET_EVENTS = new Set([
        'rollDice', 'buyProperty', 'cancelBuy', 'payJailFine', 'canBuildHouse', 'buildHouse',
        'demolishHouse', 'sellToBank', 'startAuction', 'bidAuction', 'proposeTrade',
        'respondToTrade', 'counterTrade', 'chatMessage', 'startVoteKick', 'voteKick', 'imBack',
        'taxiRide', 'taxiDecline', 'finishBuild'
    ]);
    // ⏱️ Veiksmai savo eilėje atnaujina ėjimo laikmatį (iki 3 min); aukcionas / mainai jį sustabdo
    const TURN_ACTION_EVENTS = new Set([
        'canBuildHouse', 'buildHouse', 'demolishHouse', 'sellToBank', 'startAuction',
        'proposeTrade', 'respondToTrade', 'counterTrade', 'payJailFine'
    ]);
    const TURN_CHECK_EVENTS = new Set(['bidAuction', 'respondToTrade', 'counterTrade', 'proposeTrade', 'startAuction']);
    socket.onAny((eventName) => {
        if (!TURN_ACTION_EVENTS.has(eventName) && !TURN_CHECK_EVENTS.has(eventName)) return;
        if (!socket.gameId || socket.playerId === undefined) return;
        const gid = socket.gameId, pid = socket.playerId;
        // po to, kai pats įvykis apdorotas
        setTimeout(() => {
            const g = games.get(gid);
            if (g && typeof g.updateTurnTimerAfterAction === 'function') {
                g.updateTurnTimerAfterAction(pid, TURN_ACTION_EVENTS.has(eventName));
            }
        }, 50);
    });

    socket.onAny((eventName) => {
        if (!AFK_RESET_EVENTS.has(eventName)) return;
        if (!socket.gameId || socket.playerId === undefined) return;
        const g = games.get(socket.gameId);
        if (!g) return;
        const wasAfk = g.markPlayerActive(socket.playerId);
        if (wasAfk) {
            const p = g.getPlayerById(socket.playerId);
            io.to(socket.gameId).emit('message', L('srv.server.grizo_prie_stalo', { v: p ? p.name : L('srv.word.player') }));
            io.to(socket.gameId).emit('gameState', g.getGameState());
        }
    });

    // ============================================
    // SUKURTI ŽAIDIMĄ
    // ============================================
    socket.on('createGame', async (data) => {
        if (!await checkSocketRateLimit(socket, 'createGame')) return;

        console.log('📥 Gauta createGame užklausa:', data);
        
        let playerName = cleanText(data && typeof data === 'object' ? data.name : data, MAX_NAME_LENGTH);
        const playerColor = (data && data.color) || null;
        const isPublic = data.isPublic === true;
        // 🛡️ Paskyra – tik iš prisijungimo (JWT), ne iš naršyklės atsiųstų duomenų
        const userId = socket.userId || null;
        
        if (!playerName || playerName.trim() === '') {
            socket.emit('error', L('srv.server.ivesk_varda'));
            return;
        }
        
        const check = canCreateGame(socket, isPublic);
        if (!check.can) {
            socket.emit('error', L('srv.server.txt', { reason: check.reason }));
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
            if (event === 'gameFinished') visitStats.trackGame('finished');
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
                const userResult = await db.pool.query('SELECT emoji, username FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    emoji = userResult.rows[0].emoji;
                    // 🛡️ Prisijungęs žaidėjas visada žaidžia savo paskyros vardu
                    if (userResult.rows[0].username) playerName = cleanText(userResult.rows[0].username, MAX_NAME_LENGTH) || playerName;
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
        
        visitStats.trackGame('created');
        socket.emit('gameCreated', { 
            gameId, 
            playerId: player.id,
            player: Object.assign({}, player, { token: player.token })   // 🛡️ raktą gauna tik pats žaidėjas
        });

        io.to(gameId).emit('gameState', game.getGameState());
        io.to(gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId).emit('message', L('srv.server.sukure_zaidima', { playerName }));

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
    socket.on('joinGame', async (joinData) => {
        let { gameId, playerName, color } = joinData || {};
        // 🛡️ Paskyra – tik iš prisijungimo (JWT), ne iš naršyklės atsiųstų duomenų
        const userId = socket.userId || null;
        playerName = cleanText(playerName, MAX_NAME_LENGTH);
        console.log('📥 Gauta joinGame užklausa:', { gameId, playerName, color, userId });
        
        if (!gameId || !playerName) {
            socket.emit('error', L('srv.server.ivesk_zaidimo_id_ir_varda'));
            return;
        }
        
        // 🛡️ Jei jau užblokuotas dėl spėliojimo – net netikrinam
        const joinKey = 'join:' + (socket.clientIp || socket.handshake.address);
        try {
            const st = await joinFailLimiter.get(joinKey);
            if (st && st.consumedPoints >= 20) {
                socket.emit('error', L('srv.server.per_daug_neteisingu_kodu_pabandyk'));
                return;
            }
        } catch (e) { /* nieko */ }

        const game = games.get(gameId);
        if (!game) {
            joinFailLimiter.consume(joinKey).catch(() => {});
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }
        
        if (game.gameStarted) {
            socket.emit('error', L('srv.server.zaidimas_jau_prasidejo'));
            return;
        }

        // 🆕 NUSKAITYTI EMOJI IŠ DB
        let emoji = null;
        if (userId) {
            try {
                const userResult = await db.pool.query('SELECT emoji, username FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    emoji = userResult.rows[0].emoji;
                    // 🛡️ Prisijungęs žaidėjas visada žaidžia savo paskyros vardu
                    if (userResult.rows[0].username) playerName = cleanText(userResult.rows[0].username, MAX_NAME_LENGTH) || playerName;
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
            player: Object.assign({}, player, { token: player.token })   // 🛡️ raktą gauna tik pats žaidėjas
        });

        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId.toUpperCase()).emit('message', L('srv.server.prisijunge_prie_zaidimo', { playerName }));

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
            socket.emit('reconnectFailed', L('srv.server.truksta_duomenu'));
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            console.log('❌ Žaidimas nerastas:', gameId);
            socket.emit('reconnectFailed', L('srv.server.zaidimas_nerastas_2'));
            return;
        }
        
        const player = game.players.find(p => p.token === playerToken);
        if (!player) {
            console.log('❌ Žaidėjas nerastas pagal token');
            socket.emit('reconnectFailed', L('srv.game.zaidejas_nerastas'));
            return;
        }
        
        if (player.bankrupt) {
            socket.emit('reconnectFailed', L('srv.game.zaidejas_jau_bankrutaves'));
            return;
        }
        
        if (player.left) {
            socket.emit('reconnectFailed', L('srv.trade.zaidejas_pasitraukes'));
            return;
        }
        
        if (player.kicked) {
            socket.emit('reconnectFailed', L('srv.trade.zaidejas_pasalintas'));
            return;
        }
        
        socket.join(gameId.toUpperCase());
        socket.gameId = gameId.toUpperCase();
        socket.playerId = player.id;
        
        player.socketId = socket.id;
        player.isActive = true;
        player.ip = socket.clientIp;
        game.playerReconnected(player.id);   // 🆕 atšaukti 10 min. bankroto laikmatį
        
        console.log('✅ Žaidėjas sėkmingai prijungtas atgal:', player.name);

        // 🆕 RESTART BOT LOOP (jei žaidimas prasidėjęs)
    if (game.gameStarted) {
        console.log(`🤖 RESTART botų ciklas po rekonekcijos: ${gameId}`);
        startBotLoop(gameId.toUpperCase());
    }
        
        socket.emit('reconnected', {
            gameId: gameId.toUpperCase(),
            playerId: player.id,
            player: Object.assign({}, player, { token: player.token })   // 🛡️ raktą gauna tik pats žaidėjas
        });

        io.to(gameId.toUpperCase()).emit('gameState', game.getGameState());
        io.to(gameId.toUpperCase()).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(gameId.toUpperCase()).emit('message', L('srv.server.grizo_zaidima', { player: player.name }));

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
                socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
                return;
            }
            
            const game = games.get(socket.gameId);
            if (!game) {
                socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
    
    // 🆕 Siųsti pendingPurchase TIK tam žaidėjui
    socket.emit('pendingPurchase', {
        playerId: result.player.id,
        playerName: result.player.name,
        fieldId: result.field.id,
        fieldName: result.field.name,
        fieldCost: result.field.cost
    });
    
    // 🆕 gameState VISIEMS, bet su waitingForBuy tik TAM žaidėjui
    const state = game.getGameState();
    io.to(socket.gameId).emit('gameState', state);
    
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
                const rollMsg = L('srv.game.rolled', { player: result.player.name, d1: result.dice[0], d2: result.dice[1], total: result.total });
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
            socket.emit('error', L('srv.server.server_error', { err: err.message }));
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
        socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) {
        socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
        io.to(socket.gameId).emit('message', L('srv.game.bankrotavo', { playerName: result.playerName }));
    });

    socket.on('endTurn', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        // 🛡️ Baigti ėjimą gali tik tas, kurio eilė, ir tik kai nieko nelaukiama
        if (game.currentTurn !== socket.playerId || game.isRolling || game.waitingForBuy ||
            game.pendingFieldPlayerId !== null && game.pendingFieldPlayerId !== undefined) {
            socket.emit('error', L('srv.server.dabar_negali_baigti_ejimo'));
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

        const cleanMessage = cleanText(message, MAX_CHAT_LENGTH);
        if (!cleanMessage) return;
        
        io.to(socket.gameId).emit('chatMessage', {
            player: player.name,
            color: player.color,
            message: cleanMessage,
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const result = game.sellToBank(socket.playerId, fieldIds, false);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', result.message);
    });

    socket.on('startAuction', ({ fieldId }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
            game.emitFunction('message', L('srv.server.paskelbe_aukciona', { v: game.players.find(p => p.id === socket.playerId).name }));
        } else {
            io.to(socket.gameId).emit('auctionStarted', result);
            io.to(socket.gameId).emit('gameState', game.getGameState());
            io.to(socket.gameId).emit('message', L('srv.server.paskelbe_aukciona', { v: game.players.find(p => p.id === socket.playerId).name }));
        }
    });

    socket.on('bidAuction', ({ auctionId, bidAmount }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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

    socket.on('endAuction', ({ auctionId }) => {
        if (!socket.gameId) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        // 🛡️ Aukcioną galima užbaigti tik pasibaigus jo laikui (kitaip jį užbaigia serveris pats)
        const auctionToEnd = game.tradingLogic.auctions.get(auctionId);
        if (!auctionToEnd || Date.now() < auctionToEnd.endTime - 500) return;

        const result = game.endAuction(auctionId);
        
        if (!result) return;

        io.to(socket.gameId).emit('auctionEnded', result);
        io.to(socket.gameId).emit('gameState', game.getGameState());
        io.to(socket.gameId).emit('message', L('srv.server.aukcionas_baigesi', { v: result.winnerName || L('srv.word.nobodyWon') }));
    });

    socket.on('proposeTrade', (data) => {
        const { targetPlayerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney } = data;
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
                        
                        const action = botResult.accept ? L('srv.word.accepted') : L('srv.word.rejected');
                        io.to(socket.gameId).emit('message', L('srv.server.prekyba', { botName: botResult.botName, action }));
                        
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

    socket.on('respondToTrade', ({ tradeId, accept }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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

    socket.on('counterTrade', ({ tradeId, offerFieldIds, requestFieldIds, offerMoney, requestMoney }) => {
    if (!socket.gameId || socket.playerId === undefined) {
        socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) {
        socket.emit('error', L('srv.server.zaidimas_nerastas'));
        return;
    }

    const result = game.counterTrade(tradeId, socket.playerId, offerFieldIds, requestFieldIds, offerMoney, requestMoney);
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) return;
        
        const trades = game.getPendingTrades(socket.playerId);
        socket.emit('pendingTrades', trades);
    });

    socket.on('getDemolishableProperties', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const properties = game.getDemolishableProperties(socket.playerId);
        socket.emit('demolishableProperties', properties);
    });

    socket.on('demolishHouse', ({ fieldId }) => {
    if (!socket.gameId || socket.playerId === undefined) {
        socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
        return;
    }
    
    const game = games.get(socket.gameId);
    if (!game) {
        socket.emit('error', L('srv.server.zaidimas_nerastas'));
        return;
    }

    const result = game.demolishHouse(socket.playerId, fieldId, false);   // ← false = žaidėjas pats
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const targetId = parseInt(targetPlayerId);
        if (isNaN(targetId)) {
            socket.emit('error', L('srv.server.neteisingas_zaidejo_id'));
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
            initiatorName: initiator ? initiator.name : L('srv.word.unknown'),
            targetId: targetId,
            targetName: target ? target.name : L('srv.word.unknown'),
            requiredVotes: result.voteKick.requiredVotes,
            timeLeft: result.voteKick.timeLeft,
            votes: result.voteKick.votes,
            activePlayerCount: result.voteKick.activePlayerCount
        });

        io.to(socket.gameId).emit('gameState', game.getGameState());
        
    });

    socket.on('voteKick', ({ vote }) => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        if (!game.activeVoteKick) {
            socket.emit('error', L('srv.game.balsavimas_nevyksta'));
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const result = game.setPlayerReady(socket.playerId, ready);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }
        // 🎲 Nepasirinko figūrėlės – pranešam, kokia parinkta
        if (result.autoPiece) socket.emit('pieceAutoAssigned', { piece: result.autoPiece });

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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }
        
        const hostPlayer = game.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;
        
        if (socket.playerId !== hostId) {
            socket.emit('error', L('srv.server.tik_zaidimo_kurejas_gali_prideti'));
            return;
        }
        
        if (game.gameStarted) {
            socket.emit('error', L('srv.server.zaidimas_jau_prasidejo'));
            return;
        }
        
        const bot = game.addBot();
        
        if (bot.error) {
            socket.emit('error', bot.error);
            return;
        }
        
        console.log(`🤖 Botas pridėtas: ${bot.name} (ID: ${bot.id})`);
        
        io.to(socket.gameId).emit('message', L('srv.server.prisijunge_prie_zaidimo_2', { bot: bot.name }));
        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    socket.on('startGame', () => {
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const result = game.startGame(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        visitStats.trackGame('started');
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
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
        io.to(socket.gameId).emit('message', L('srv.server.buvo_ismestas', { targetName: result.targetName }));
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
            socket.emit('reserveColorResult', { error: L('srv.server.truksta_duomenu') });
            return;
        }
        
        const game = games.get(gameId.toUpperCase());
        if (!game) {
            joinFailLimiter.consume('join:' + (socket.clientIp || socket.handshake.address)).catch(() => {});
            socket.emit('reserveColorResult', { error: L('srv.server.zaidimas_nerastas_2') });
            return;
        }
        socket.join('colors:' + gameId.toUpperCase());
        
        const result = game.reserveColor(color, socket.id);
        socket.emit('reserveColorResult', result);
        
        if (result.success) {
            const used = game.getUsedColors();
            const available = game.getAvailableColors();
            
            io.to('colors:' + gameId.toUpperCase()).emit('gameColorsUpdated', {
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
            
            io.to('colors:' + gameId.toUpperCase()).emit('gameColorsUpdated', {
                gameId: gameId.toUpperCase(),
                available: available,
                used: used
            });
        }
    });

    // ============================================
    // SPALVŲ GAVIMAS
    // ============================================
    socket.on('getGameColors', async ({ gameId }) => {
        console.log('🎨 Gauta getGameColors užklausa:', gameId);
        
        if (!gameId) {
            socket.emit('gameColors', { error: L('srv.server.nera_stalo_kodo'), available: [], used: [] });
            return;
        }
        
        // 🛡️ Kodų spėliojimas per spalvų užklausą irgi ribojamas
        const colorsKey = 'join:' + (socket.clientIp || socket.handshake.address);
        try {
            const st = await joinFailLimiter.get(colorsKey);
            if (st && st.consumedPoints >= 20) {
                socket.emit('gameColors', { error: L('srv.server.per_daug_neteisingu_kodu_pabandyk'), available: [], used: [] });
                return;
            }
        } catch (e) { /* nieko */ }

        const game = games.get(gameId.toUpperCase());
        
        if (!game) {
            joinFailLimiter.consume(colorsKey).catch(() => {});
            socket.emit('gameColors', { 
                error: L('srv.server.zaidimas_nerastas_2'), 
                available: [], 
                used: [] 
            });
            return;
        }
        socket.join('colors:' + gameId.toUpperCase());
        
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
                        hostName: activePlayers[0] ? activePlayers[0].name : L('srv.word.unknown'),
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
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }
        
        const hostPlayer = game.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;
        
        if (socket.playerId !== hostId) {
            socket.emit('error', L('srv.server.tik_zaidimo_kurejas_gali_keisti'));
            return;
        }
        
        if (game.gameStarted) {
            socket.emit('error', L('srv.game.zaidimas_jau_prasidejo'));
            return;
        }
        
        if (isPublic) {
            let publicCount = 0;
            for (const [id, g] of games) {
                if (g.isPublic && !g.gameStarted && id !== socket.gameId) publicCount++;
            }
            
            if (publicCount >= LIMITS.MAX_PUBLIC_GAMES) {
                socket.emit('error', L('srv.server.jau_yra_viesi_stalai', { MAX_PUBLIC_GAMES: LIMITS.MAX_PUBLIC_GAMES }));
                return;
            }
        }
        
        game.setPublic(isPublic);
        
        socket.emit('publicStatusChanged', { isPublic: game.isPublic });
        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
        
        broadcastPublicGames();
    });

    // ============================================
    // 🚕 TAKSI
    // ============================================
    socket.on('taxiRide', ({ target }) => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const result = game.taxiRide(socket.playerId, target);
        if (result.error) socket.emit('error', result.error);
    });

    // 🧪 Taksi testas (tik su BANCRUPT_TEST=1)
    socket.on('debugTaxi', () => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const result = game.debugToTaxi(socket.playerId);
        if (result.error) socket.emit('error', result.error);
        else io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // 🧪 Efektų testai (tik su BANCRUPT_TEST=1) – perkelia ant langelio su efektu
    socket.on('debugField', (data) => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const fieldId = data && parseInt(data.fieldId, 10);
        if (![2, 5, 8, 11, 13, 14, 19, 24, 28, 32, 37, 42, 44, 46, 48, 50].includes(fieldId)) return socket.emit('error', L('srv.game.neteisingas_langelis'));
        const result = game.debugToField(socket.playerId, fieldId);
        if (result.error) socket.emit('error', result.error);
        else io.to(socket.gameId).emit('gameState', game.getGameState());
    });

    // 🏗️ „Baigti ėjimą“ statybų lange
    socket.on('finishBuild', () => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const result = game.finishBuildWindow(socket.playerId, 'manual');
        if (result.error) socket.emit('error', result.error);
    });

    socket.on('taxiDecline', () => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const result = game.taxiDecline(socket.playerId, false);
        if (result.error) socket.emit('error', result.error);
    });

    // 🎲 Figūrėlės pasirinkimas laukimo kambaryje
    socket.on('setPiece', ({ piece }) => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const result = game.setPiece(socket.playerId, String(piece || ''));
        if (result.error) { socket.emit('error', result.error); return; }
        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
    });

    // ============================================
    // 🏗️ STATYBŲ TAISYKLĖ (keičia tik stalo kūrėjas, iki starto)
    // ============================================
    socket.on('setBuildRule', ({ rule }) => {
        if (!socket.gameId || socket.playerId === undefined) return;
        const game = games.get(socket.gameId);
        if (!game) return;
        const hostPlayer = game.players.find(p => p.isHost === true);
        const hostId = hostPlayer ? hostPlayer.id : 0;
        if (socket.playerId !== hostId) {
            socket.emit('error', L('srv.server.statybu_taisykle_gali_keisti_tik'));
            return;
        }
        const result = game.setBuildRule(rule);
        if (result.error) { socket.emit('error', result.error); return; }
        io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
    });

    // ============================================
    // PASITRAUKIMAS
    // ============================================
    socket.on('leaveGame', () => {
        console.log('🏃 GAUTA leaveGame UŽKLAUSA:', { socketId: socket.id, playerId: socket.playerId });
        
        if (!socket.gameId || socket.playerId === undefined) {
            socket.emit('error', L('srv.server.neprisijungei_prie_zaidimo'));
            return;
        }
        
        const game = games.get(socket.gameId);
        if (!game) {
            socket.emit('error', L('srv.server.zaidimas_nerastas'));
            return;
        }

        const gameIdCopy = socket.gameId;

        // 🆕 Žaidimo metu pasitraukti galima tik bankrotuojant.
        // Jau iškritęs (bankrutavęs / išmestas) žaidėjas tiesiog išeina į meniu.
        const leavingPlayer = game.getPlayerById(socket.playerId);
        if (game.gameStarted && leavingPlayer) {
            if (!leavingPlayer.bankrupt && !leavingPlayer.left && !leavingPlayer.kicked) {
                const bres = game.bankruptPlayer(socket.playerId);
                if (bres.error) {
                    socket.emit('error', bres.error);
                    return;
                }
                game.announceBankrupt(socket.playerId, bres, null);
            }
            leavingPlayer.socketId = null;
            socket.leave(gameIdCopy);
            socket.gameId = null;
            socket.playerId = undefined;
            socket.emit('leftGame', { playerName: leavingPlayer.name, gameId: gameIdCopy, spectatorExit: true });
            return;
        }
        
        const result = game.leaveGame(socket.playerId);
        if (result.error) {
            socket.emit('error', result.error);
            return;
        }

        io.to(gameIdCopy).emit('message', L('srv.server.susinervino_ir_pabego_kampa', { playerName: result.playerName }));
        
        if (result.winner) {
            io.to(gameIdCopy).emit('message', L('srv.server.laimejo_visi_kiti_pabego', { winner: result.winner }));
            visitStats.trackGame('finished');
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
            // 🆕 Tik jei atsijungė būtent šis jungimas (ne senas, jau pakeistas nauju)
            if (player && player.socketId === socket.id) {
                if (game.gameStarted && !player.bankrupt && !player.left && !player.kicked) {
                    // 🆕 Žaidimas vyksta: žaidėjas lieka žaidime, jo ėjimai daromi automatiškai,
                    // o jei per 10 min. negrįžta – bankrotuoja
                    game.playerDisconnected(player.id);
                    io.to(socket.gameId).emit('gameState', game.getGameState());
                    io.to(socket.gameId).emit('message', L('srv.server.atsijunge_turi_min_grizti_kitaip', { player: player.name }));
                } else if (!game.gameStarted) {
                    player.isActive = false;
                    io.to(socket.gameId).emit('gameState', game.getGameState());
                    io.to(socket.gameId).emit('waitingRoomUpdate', game.getWaitingRoomState());
                    io.to(socket.gameId).emit('message', L('srv.server.paliko_zaidima', { player: player.name }));
                }
            }
            
            const activePlayers = game.getActivePlayers();
            
            // 🆕 SUSTABDYTI BOTUS TIK JEI:
            // - Žaidimas NEPRASIDĖJĘS
            // - ARBA nebeliko NĖ VIENO žaidėjo
            if (!game.gameStarted || activePlayers.length === 0) {
                stopBotLoop(socket.gameId);
            }
        }
    }
});
});

// ============================================
// SERVERIO PALEIDIMAS
// ============================================
// 🛡️ Netikėta klaida neturi išjungti viso serverio (visi stalai dingtų)
if (typeof process.on === 'function') {
    process.on('uncaughtException', (err) => {
        console.error('❌ Nepagauta klaida:', err);
    });
    process.on('unhandledRejection', (err) => {
        console.error('❌ Nepagautas pažadas (Promise):', err);
    });
}

const PORT = process.env.PORT || 3000;

db.initDatabase().then(async () => {
    await visitStats.init(db.pool);                    // ← Pridėta "async"
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