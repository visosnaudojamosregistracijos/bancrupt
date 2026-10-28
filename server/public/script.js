// ============================================
// script.js
// ============================================

let socket;
let playerId = null;
let gameId = null;
let gameState = null;
let myPlayer = null;
let isMyTurn = false;
let isConnected = false;
let currentAuctionId = null;
let auctionTimerInterval = null;
let auctionEndedSent = false;
let isMuted = false;
let lastVolume = 50;
let infoMode = true;  // 🆕 VISADA ĮJUNGTAS pagal nutylėjimą
let lastHoveredField = null;
let isAnimating = false;
let soundMode = localStorage.getItem('bancrupt_soundMode') || 'my';

let voteKickTimerInterval = null;
let amIKicked = false;

const PLAYER_COLORS = [
    '#9c0505', '#e2de00', '#5506d3', '#05b130',
    '#000000', '#00adc4', '#492b1f', '#0609d6'
];

let selectedCreateColor = null;
let selectedJoinColor = null;
let availableJoinColors = [];
let joinColorCheckTimeout = null;

let waitingRoomState = null;
let publicGamesCheckInterval = null;
let infoResizeObserver = null;

// ============================================
// KONSTANTOS (frontend)
// ============================================
const SERVICE1_IDS = [2, 14, 28, 44];
const SERVICE2_IDS = [8, 19, 37, 46];
const SERVICE3_IDS = [11, 24, 32, 48];
const SERVICE_RENT = { 1: 50, 2: 100, 3: 150, 4: 200 };

const COLOR_GROUPS = {
    '#ffd700': [1, 3],
    '#4a90d9': [6, 7, 9],
    '#ff8c00': [10, 12, 15],   // ← 🆕 ORANŽINĖ (buvo žalia)
    '#9b59b6': [17, 18, 20],
    '#e74c3c': [22, 23, 25],
    '#8B6914': [27, 29, 30],
    '#1abc9c': [31, 33, 34],
    '#ff69b4': [35, 36, 38],
    '#2c3e50': [39, 40, 41],
    '#1a237e': [43, 45, 47],
    '#bdc3c7': [49, 51]
};

// ============================================
// PRISIJUNGIMAS
// ============================================

function initSocket() {
    console.log('🔄 Inicijuojamas socket...');
    
    const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : window.location.origin;
    
    console.log('🌐 Serverio URL:', SERVER_URL);
    
    const token = localStorage.getItem('bancrupt_token');

    socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 50,          // ← DIDESNIS
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,        // ← PRIDĖK
    auth: {
        token: token
    }
});
    
    socket.on('connect', () => {
        console.log('✅ Prisijungta prie serverio');
        isConnected = true;
        showLobbyMessage(tf('cli.prisijungta_prie_serverio'), '#28a745');
        playStartSound();
        
        setTimeout(() => {
            const savedGameId = localStorage.getItem('bancrupt_gameId');
            const savedToken = localStorage.getItem('bancrupt_playerToken');
            
            if (savedGameId && savedToken) {
                console.log('🔄 Bandoma prisijungti atgal prie:', savedGameId);
                socket.emit('reconnectPlayer', {
                    gameId: savedGameId,
                    playerToken: savedToken
                });
            }
        }, 500);
    });

    socket.on('connect_error', (error) => {
        console.log('❌ Prisijungimo klaida:', error);
        showLobbyMessage(tf('cli.nepavyko_prisijungti_prie_serverio'), '#dc3545');
        playErrorSound();
    });

    socket.on('disconnect', () => {
        console.log('❌ Atsijungta nuo serverio');
        isConnected = false;
        showLobbyMessage(tf('cli.atsijungta_nuo_serverio'), '#dc3545');
    });

    socket.on('error', (msg) => {
        console.log('Klaida:', msg);
        playErrorSound();
        alert(msg);
    });

    socket.on('gameCreated', (data) => {
        clearCell5Queue();
        gaEvent('game_create');
        console.log('✅ Žaidimas sukurtas:', data);
        gameId = data.gameId;
        playerId = data.playerId;
        myPlayer = data.player;
        
        // 🆕 UŽDARYTI VISUS MODAL'US
        const buyChoice = document.getElementById('buyChoice');
        if (buyChoice) buyChoice.style.display = 'none';
        
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
        });
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.style.display = 'none';
        });
        console.log('🧹 Visi modalai uždaryti (gameCreated)');
        
        localStorage.setItem('bancrupt_gameId', gameId);
        localStorage.setItem('bancrupt_playerToken', data.player.token);
        
        document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
        showLobbyMessage(tf('cli.zaidimas_sukurtas_id', { gameId }), '#28a745');
        // playStartSound();
        enterGame();
    });

    socket.on('joinedGame', (data) => {
        clearCell5Queue();
        gaEvent('game_join');
        console.log('✅ Prisijungta prie žaidimo:', data);
        playerId = data.playerId;
        myPlayer = data.player;
        
        // 🆕 UŽDARYTI VISUS MODAL'US
        const buyChoice = document.getElementById('buyChoice');
        if (buyChoice) buyChoice.style.display = 'none';
        
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
        });
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.style.display = 'none';
        });
        console.log('🧹 Visi modalai uždaryti (joinedGame)');
        
        localStorage.setItem('bancrupt_gameId', gameId);
        localStorage.setItem('bancrupt_playerToken', data.player.token);
        
        document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
        showLobbyMessage(tf('cli.prisijungei_prie_zaidimo'), '#28a745');
        playStartSound();
        enterGame();
    });

    socket.on('reconnected', (data) => {
        console.log('✅ Sėkmingai prijungta atgal:', data);
        gameId = data.gameId;
        playerId = data.playerId;
        myPlayer = data.player;
        
        // 🆕 UŽDARYTI VISUS MODAL'US
        const buyChoice = document.getElementById('buyChoice');
        if (buyChoice) buyChoice.style.display = 'none';
        
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
        });
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.style.display = 'none';
        });
        console.log('🧹 Visi modalai uždaryti (reconnected)');
        
        showLobbyMessage(tf('cli.grizai_zaidima'), '#28a745');
        playStartSound();
        enterGame();
    });

    socket.on('reconnectFailed', (msg) => {
        console.log('❌ Reconnect nepavyko:', msg);
        localStorage.removeItem('bancrupt_gameId');
        localStorage.removeItem('bancrupt_playerToken');
    });

    socket.on('gameState', (state) => {
    // console.log('📊 Gauta žaidimo būsena');
    gameState = state;
    updateUI(state);
    handleTurnPopup(state);
        // 💀 Bankroto langas lieka atidarytas, kol žaidėjas pats paspaudžia „Taip“ arba „Ne“.
        // Uždarom tik jei bankrotuoti nebeįmanoma (jau bankrutavęs, pasitraukęs, išmestas ar žaidimas baigtas).
        {
            const me = state.players ? state.players.find(p => p.id === playerId) : null;
            if (!state.gameStarted || !me || me.bankrupt || me.left || me.kicked) {
                document.getElementById('bankruptModal').style.display = 'none';
                stopBankruptCountdown();
            }
        }
        updateExitButton();
        updateAfkBanner();
        syncPendingBuyTimer(state);
        
        // 🆕 IŠIMTA – pranešimai ateina per 'message' event
        // if (state.lastMessageKey) {
        //     const text = getTranslatedMessage(state.lastMessageKey, state.lastMessageData || {});
        //     if (text && text !== state.lastMessageKey) {
        //         addJournal(text);
        //     }
        // }
        
        if (state.players && state.players.length > 0) {
            state.players.forEach(p => {
                if (!window.gameStats.players[p.id]) {
                    initPlayerStats(p.id, p.name, p.color);
                }
            });
        }
        
        if (state.gameStarted) {
            hideWaitingRoom();
        }
    });

   // ============================================
// 🆕 BOARD ATNAUJINIMAS IŠ ADMIN PANELĖS (LIVE)
// ============================================
socket.on('boardUpdated', (newBoard) => {
    console.log('🎨 Lentos atnaujinimas iš admin panelės:', newBoard.length, 'langeliai');
    
    if (gameState) {
        gameState.board = newBoard;
        updateBoard(gameState);
        
        if (typeof updateUI === 'function' && gameState.players) {
            updateUI(gameState);
        }
    }
    
    if (typeof addNotification === 'function') {
        addNotification(tf('cli.lenta_atnaujinta_is_admin_paneles'));
    }
    
    if (typeof addJournal === 'function') {
        addJournal(tf('cli.lenta_atnaujinta'));
    }
});

// ============================================
// 🆕 VIDURIO LANGELIŲ ATNAUJINIMAS (CENTER)
// ============================================
socket.on('centerCells', (cells) => {
    console.log('🎨 Vidurio langeliai užkrauti:', cells.length);
    applyCenterCells(cells);
});

socket.on('centerUpdated', (cells) => {
    console.log('🎨 Vidurio langeliai atnaujinti:', cells.length);
    applyCenterCells(cells);
    
    if (typeof addNotification === 'function') {
        showSmallNotice(tf('cli.vidurio_langeliai_atnaujinti'));
    }
});

// ============================================
// 🆕 GARSO NUSTATYMAI IŠ SERVERIO   ← NAUJA!
// ============================================
socket.on('soundSettings', (settings) => {
    console.log('🔊 Gauti garso nustatymai:', settings);
    
    if (!settings) return;
    
    // Išsaugoti globaliai
    window.serverSoundSettings = settings;
    
    // 🆕 Mygtukas VISADA rodomas
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) soundBtn.style.display = '';
    
    if (settings.player_control_enabled === false) {
        // 🆕 Paprasta versija – naudoti standartinius nustatymus
        if (settings.default_mode) {
            soundMode = settings.default_mode;
            localStorage.setItem('bancrupt_soundMode', soundMode);
        }
        if (settings.default_sfx_volume !== undefined) {
            audioManager.setSfxVolume(settings.default_sfx_volume / 100);
            localStorage.setItem('bancrupt_sfxVolume', settings.default_sfx_volume);
        }
        
        console.log('🔇 Paprasta garso panelė (admin išjungė išplėstą)');
    } else {
        console.log('🔊 Išplėstinė garso panelė');
    }
    
    // 🆕 Atnaujinti panelės išvaizdą
    updateSoundPanelVisibility();
});

socket.on('soundSettingsUpdated', (settings) => {
    console.log('🔊 Garso nustatymai atnaujinti:', settings);
    
    if (!settings) return;
    
    window.serverSoundSettings = settings;
    
    // 🆕 Mygtukas VISADA rodomas
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) soundBtn.style.display = '';
    
    if (settings.player_control_enabled === false) {
        // 🆕 Paprasta versija – naudoti standartinius nustatymus
        if (settings.default_mode) {
            soundMode = settings.default_mode;
            localStorage.setItem('bancrupt_soundMode', soundMode);
        }
        if (settings.default_sfx_volume !== undefined) {
            audioManager.setSfxVolume(settings.default_sfx_volume / 100);
            localStorage.setItem('bancrupt_sfxVolume', settings.default_sfx_volume);
        }
        
        if (typeof addNotification === 'function') {
            showSmallNotice(tf('cli.garso_panele_perjungta_paprasta'));
        }
    } else {
        if (typeof addNotification === 'function') {
            showSmallNotice(tf('cli.garso_panele_perjungta_isplesta'));
        }
    }
    
    // 🆕 Atnaujinti panelės išvaizdą
    updateSoundPanelVisibility();
});

// ============================================
// 🆕 GARSO FAILAI IŠ SERVERIO   ← NAUJA!
// ============================================
socket.on('soundFiles', (files) => {
    console.log('📁 Gauti garso failai:', files);
    audioManager.updateSoundFiles(files);
});

socket.on('soundFilesUpdated', (files) => {
    console.log('📁 Garso failai atnaujinti:', files);
    audioManager.updateSoundFiles(files);
    
    if (typeof addNotification === 'function') {
        showSmallNotice(tf('cli.garso_failai_atnaujinti'));
    }
});

    socket.on('yourTurn', (data) => {
        console.log('🎵 Tavo eilė!', data);
        
        playYourTurnSound();
        // 5 langelyje rodomas „🎲 TAVO EILĖ!“ (handleTurnPopup)
    });

    socket.on('gameColors', (data) => {
        console.log('🎨 Gautos spalvos:', data);
        
        if (data.error) {
            availableJoinColors = [...PLAYER_COLORS];
            selectedJoinColor = null;
            renderColorPicker('joinColorPicker', availableJoinColors, null, selectJoinColor);
            
            const status = document.getElementById('joinColorStatus');
            if (status) status.textContent = '❌ ' + data.error;
            return;
        }
        
        if (!data.available || data.available.length === 0) {
            availableJoinColors = [...PLAYER_COLORS];
            selectedJoinColor = null;
            renderColorPicker('joinColorPicker', availableJoinColors, null, selectJoinColor);
            
            const status = document.getElementById('joinColorStatus');
            if (status) status.textContent = tf('cli.nera_laisvu_spalvu');
            return;
        }
        
        availableJoinColors = data.available;
        
        if (selectedJoinColor && !availableJoinColors.includes(selectedJoinColor)) {
            selectedJoinColor = null;
        }
        
        renderColorPicker('joinColorPicker', availableJoinColors, selectedJoinColor, selectJoinColor);
        
        const status = document.getElementById('joinColorStatus');
        if (status) {
            const totalColors = PLAYER_COLORS.length;
            const takenCount = data.used.length;
            status.textContent = tf('cli.zaidejai_laisvos', { takenCount, totalColors, v: availableJoinColors.length });
        }
    });

    socket.on('reserveColorResult', (data) => {
        if (data.error) {
            console.log('⚠️ Rezervacija nepavyko:', data.error);
            playErrorSound();
        } else {
            console.log('✅ Spalva rezervuota:', data.color);
        }
    });

    socket.on('gameColorsUpdated', (data) => {
        console.log('🎨 Spalvos atsinaujino:', data);
        
        const currentGameId = document.getElementById('gameIdInput')?.value.trim().toUpperCase();
        if (!currentGameId || currentGameId !== data.gameId) return;
        
        if (document.getElementById('page-join')?.classList.contains('active')) {
            availableJoinColors = data.available;
            
            if (selectedJoinColor && !availableJoinColors.includes(selectedJoinColor)) {
                console.log('⚠️ Mūsų spalva dingo iš available, bet paliekam:', selectedJoinColor);
            }
            
            const colorsToRender = [...availableJoinColors];
            if (selectedJoinColor && !colorsToRender.includes(selectedJoinColor)) {
                colorsToRender.push(selectedJoinColor);
            }
            
            renderColorPicker('joinColorPicker', colorsToRender, selectedJoinColor, selectJoinColor);
            
            const status = document.getElementById('joinColorStatus');
            if (status) {
                const totalColors = PLAYER_COLORS.length;
                status.textContent = tf('cli.laisvos', { v: availableJoinColors.length, totalColors });
            }
        }
    });

    socket.on('colorReservationExpired', (data) => {
        console.log('⏰ Spalvos rezervacija baigėsi:', data.color);
        const gid = document.getElementById('gameIdInput')?.value.trim().toUpperCase();
        if (gid) {
            socket.emit('getGameColors', { gameId: gid });
        }
    });

    socket.on('pieceAutoAssigned', (data) => {
        if (data && data.piece) flashPieceNote(data.piece);
    });

    socket.on('waitingRoomUpdate', (state) => {
    // console.log('⏳ Waiting room update:', state);
    updateWaitingRoom(state);
});

    socket.on('gameStarted', (data) => {
        console.log('🎮 Žaidimas pradėtas:', data);
        try { const ps = (gameState && gameState.players) || []; gaEvent('game_start', { players: ps.length, bots: ps.filter(p => p.isBot).length }); } catch (e) {}
        
        playGameStartSound();
        
        const msg = tf('cli.zaidimas_pradetas_pirmas_eina', { firstPlayerName: data.firstPlayerName });
        addNotification(msg);
        addJournal(msg);
        const br = (waitingRoomState && waitingRoomState.buildRule) || (gameState && gameState.buildRule) || 2;
        addJournal(tf('cli.build_rule_line', { v: tt('game.buildRuleIs', 'Statybų taisyklė'), br, v2: buildRuleLabel(br) }));
        
        hideWaitingRoom();
        
        if (gameState) updateUI(gameState);
    });

    // 🏗️ STATYBŲ LANGAS
    socket.on('buildWindow', (d) => {
        if (d.playerId === playerId) openBuildWindowPanel(d.ms, d.rollAgain);
    });
    socket.on('buildWindowClosed', (d) => {
        if (d.playerId === playerId) {
            closeBuildWindowPanel();
            // „🎲 Mesti kauliukus“ – langas užsidarė, iškart metam
            if (buildWin.rollAfter) {
                buildWin.rollAfter = false;
                // palaukiam, kol praeis trumpas pranešimas (jis laikinai blokuoja metimą)
                let tries = 0;
                const tryRoll = () => {
                    const rb = document.getElementById('rollBtn');
                    const blocked = rb && rb.dataset.blockedByAction === 'true';
                    if ((blocked || (gameState && gameState.buildWindow)) && tries++ < 24) { setTimeout(tryRoll, 250); return; }
                    if (isMyTurn && !blocked && typeof rollDice === 'function') rollDice();
                };
                setTimeout(tryRoll, 300);
            }
        }
    });

    // 🧪 Testinis perkėlimas ant TAKSI
    socket.on('debugMove', async (d) => {
        window.animatingPlayers = window.animatingPlayers || [];
        if (!window.animatingPlayers.includes(d.playerId)) window.animatingPlayers.push(d.playerId);
        try {
            if (d.to === 13 && d.from !== 13 && typeof playAmbulanceRide === 'function') await playAmbulanceRide(d.playerId, d.from, 13);
            else await animateMovement(d.playerId, d.from, d.to, null, { stepMs: 60 });
        }
        finally {
            window.animatingPlayers = window.animatingPlayers.filter(id => id !== d.playerId);
            if (gameState) updateUI(gameState);
        }
    });

    // 🚕 TAKSI
    socket.on('taxiOffer', (d) => {
        if (d.playerId === playerId) {
            openTaxiPicker(d.cost, d.durationMs, d.forbidden);
        } else if (typeof showSmallNotice === 'function') {
            showSmallNotice(tt('taxi.othersPick', '🚕 {player} renkasi, kur važiuoti taksi').replace('{player}', d.playerName));
        }
    });
    socket.on('taxiClosed', (d) => {
        if (d.playerId === playerId) closeTaxiPicker();
    });
    socket.on('taxiRide', async (d) => {
        if (d.playerId === playerId) closeTaxiPicker();
        addJournal(tt('game.taxiRide', '🚕 {player} važiuoja taksi į {field} (€{cost})')
            .replace('{player}', d.playerName).replace('{field}', (typeof trCellName === 'function' ? trCellName(d.fieldName) : d.fieldName)).replace('{cost}', d.cost));
        window.animatingPlayers = window.animatingPlayers || [];
        if (!window.animatingPlayers.includes(d.playerId)) window.animatingPlayers.push(d.playerId);
        try {
            await animateMovement(d.playerId, d.from, d.to, null, { stepMs: 75, taxi: true });
        } finally {
            window.animatingPlayers = window.animatingPlayers.filter(id => id !== d.playerId);
            if (gameState) updateUI(gameState);
        }
    });

    socket.on('youWereKicked', () => {
        console.log('❌ Buvau išmestas iš waiting room');
        playErrorSound();
        alert(tf('cli.tave_ismete_kurejas'));
        
        if (typeof goToMenu === 'function') {
            goToMenu();
        }
        
        playerId = null;
        gameId = null;
        gameState = null;
        myPlayer = null;
        localStorage.removeItem('bancrupt_gameId');
        localStorage.removeItem('bancrupt_playerToken');
    });

    socket.on('publicStatusChanged', (data) => {
        console.log('🌐 Viešumo statusas pakeistas:', data);
        if (data.isPublic) {
            showSmallNotice(tf('cli.stalas_dabar_viesas'));
        } else {
            showSmallNotice(tf('cli.stalas_dabar_privatus'));
        }
    });

    socket.on('publicGamesList', (games) => {
        console.log('🌐 Viešų stalų sąrašas:', games);
        renderPublicGames(games);
    });

   

    // ============================================   ← ČIA PRADEDAM
    // 🆕 BOARD SETTINGS (lentos nustatymai)
    // ============================================
    socket.on('boardSettings', (settings) => {
    console.log('📐 Gauti lentos nustatymai:', settings);
    
    if (!settings) {
        console.warn('⚠️ boardSettings tuščias');
        return;
    }
    
    applyBoardSettings(settings);
    console.log('✅ CSS kintamieji nustatyti');
});

    // 🆕 Kai admin pakeičia nustatymus – atnaujinti iš karto
    socket.on('boardSettingsUpdated', (settings) => {
    console.log('📐 Board settings atnaujinti (live):', settings);
    
    if (!settings) return;
    
    applyBoardSettings(settings);
    console.log('✅ CSS kintamieji atnaujinti');
});

// 🆕 Pagalbinė funkcija – pritaiko boardSettings su clamp()
function applyBoardSettings(s) {
    const root = document.documentElement;
    
    // 🎯 1. Kampų PLOTIS
    if (s.corner_width_min !== undefined && s.corner_width_vw !== undefined && s.corner_width_max !== undefined) {
        root.style.setProperty('--corner-width',
            `clamp(${s.corner_width_min}px, ${s.corner_width_vw}vw, ${s.corner_width_max}px)`);
    }
    
    // 🎯 2. Kampų AUKŠTIS
    if (s.corner_height_min !== undefined && s.corner_height_vh !== undefined && s.corner_height_max !== undefined) {
        root.style.setProperty('--corner-height',
            `clamp(${s.corner_height_min}px, ${s.corner_height_vh}vh, ${s.corner_height_max}px)`);
    }
    
    // 📏 3. KAIRĖS kolonos plotis
    if (s.left_col_width_min !== undefined && s.left_col_width_vw !== undefined && s.left_col_width_max !== undefined) {
        root.style.setProperty('--left-col-width',
            `clamp(${s.left_col_width_min}px, ${s.left_col_width_vw}vw, ${s.left_col_width_max}px)`);
    }
    
    // 📏 4. DEŠINĖS kolonos plotis
    if (s.right_col_width_min !== undefined && s.right_col_width_vw !== undefined && s.right_col_width_max !== undefined) {
        root.style.setProperty('--right-col-width',
            `clamp(${s.right_col_width_min}px, ${s.right_col_width_vw}vw, ${s.right_col_width_max}px)`);
    }
    
    // 📐 5. Viršutinės eilės aukštis
    if (s.top_row_height_min !== undefined && s.top_row_height_vh !== undefined && s.top_row_height_max !== undefined) {
        root.style.setProperty('--top-row-height',
            `clamp(${s.top_row_height_min}px, ${s.top_row_height_vh}vh, ${s.top_row_height_max}px)`);
    }
    
    // 📐 6. Apatinės eilės aukštis
    if (s.bottom_row_height_min !== undefined && s.bottom_row_height_vh !== undefined && s.bottom_row_height_max !== undefined) {
        root.style.setProperty('--bottom-row-height',
            `clamp(${s.bottom_row_height_min}px, ${s.bottom_row_height_vh}vh, ${s.bottom_row_height_max}px)`);
    }
    
    // 🔲 7. Tarpai
    if (s.gap_min !== undefined && s.gap_vw !== undefined && s.gap_max !== undefined) {
        root.style.setProperty('--board-gap',
            `clamp(${s.gap_min}px, ${s.gap_vw}vw, ${s.gap_max}px)`);
    }
    
    // 🔤 8. Bendras šriftas
    if (s.font_size_min !== undefined && s.font_size_vw !== undefined && s.font_size_max !== undefined) {
        root.style.setProperty('--board-font-size',
            `clamp(${s.font_size_min}px, ${s.font_size_vw}vw, ${s.font_size_max}px)`);
    }
    
    // 🔤 9. Langelio šriftas
    if (s.cell_font_size_min !== undefined && s.cell_font_size_vw !== undefined && s.cell_font_size_max !== undefined) {
        root.style.setProperty('--cell-font-size',
            `clamp(${s.cell_font_size_min}px, ${s.cell_font_size_vw}vw, ${s.cell_font_size_max}px)`);
    }
    
    // 🔤 10. Kampo šriftas
    if (s.corner_font_size_min !== undefined && s.corner_font_size_vw !== undefined && s.corner_font_size_max !== undefined) {
        root.style.setProperty('--corner-font-size',
            `clamp(${s.corner_font_size_min}px, ${s.corner_font_size_vw}vw, ${s.corner_font_size_max}px)`);
    }
    
    // 📊 Board min/max plotis
    if (s.board_min_width !== undefined) {
        root.style.setProperty('--board-min-width', s.board_min_width + 'px');
    }
    if (s.board_max_width !== undefined) {
        root.style.setProperty('--board-max-width', s.board_max_width + 'px');
    }
}

    // ============================================   ← ČIA BAIGIAM

    // ============================================
    // 🆕 PENDING PURCHASE (pasiūlymas prieš metimą)   ← NAUJA!
    // ============================================
    socket.on('pendingPurchase', (data) => {
    console.log('💰 Pending purchase:', data);
    
    // 🆕 Išsaugoti, kad TIK AŠ gavau pendingPurchase
    window.lastPendingPurchasePlayerId = data.playerId;
    
    // 🆕 Rodyti TIK jei tai man
    if (data.playerId === playerId) {
        showBuyChoice({
            fieldId: data.fieldId,
            fieldName: data.fieldName,
            fieldCost: data.fieldCost,
            playerId: data.playerId
        });
        
        playNotificationSound();
    }
});

    socket.on('diceRolled', async (data) => {
    console.log('🎲 Kauliukai mesti:', data);
    
    // 🆕 APSAUGA: jei pending_purchase – praleisti dice animaciją
    if (data.action === 'pending_purchase') {
        console.log('💰 pending_purchase – praleidžiame dice animaciją');
        return;
    }
    
    // 🆕 APSAUGA: jei nėra dice masyvo – praleisti
    if (!data.dice || !Array.isArray(data.dice) || data.dice.length < 2) {
        console.warn('⚠️ diceRolled: nėra dice masyvo', data);
        return;
    }
    
    playSoundForPlayer('dice', data.player.id);
    const diceLanded = updateDiceDisplay(data.dice[0], data.dice[1]);

    if (data.player && data.player.id !== undefined) {
        const isDouble = data.dice[0] === data.dice[1];
        incrementRolls(data.player.id, isDouble);
    }
    
    window.animatingPlayers = window.animatingPlayers || [];
    if (!window.animatingPlayers.includes(data.player.id)) {
        window.animatingPlayers.push(data.player.id);
    }
    
    if (data.oldPosition !== undefined && data.newPosition !== undefined) {
        isAnimating = true;
        // 🎲 Figūrėlė pajuda, kai kauliukai beveik nusileido (bet ne ilgiau nei 0,7 s)
        const waitDice = Promise.race([diceLanded, new Promise(r => setTimeout(r, 700))]);
        if (data.newPosition === 13 && data.oldPosition !== 13 && typeof playAmbulanceRide === 'function') {
            // 🚑 Ant LIGONINĖS atveža greitoji
            hidePlayerDot(data.player.id);
            await waitDice;
            await playAmbulanceRide(data.player.id, data.oldPosition, 13);
        } else {
            await animateMovement(data.player.id, data.oldPosition, data.newPosition, waitDice);
        }
        isAnimating = false;
    }
    
    window.animatingPlayers = window.animatingPlayers.filter(id => id !== data.player.id);

    // 🆕 Siunčiam movementFinished TIK jei AŠ mečiau kauliukus
    if (data.needsProcessField && data.player.id === playerId) {
        console.log('✅ Animacija baigta, siunčiam movementFinished');
        socket.emit('movementFinished');
        return;
    }
    
    const isMe = data.player.id === playerId;

    if (data.result && data.result.message && data.result.message.includes('neturi pakankamai pinigų')) {
        const msg = isMe 
            ? tf('cli.neuztenka_pinigu_pirkti', { field: data.field.name })
            : tf('cli.neuztenka_pinigu_pirkti_2', { player: data.player.name, field: data.field.name });
        
        showCellAction(msg, 'tax', isMe);
        addJournal(msg);
        
        updateUI(gameState);
        return;
    }
        
        // 🆕 Garsai pagal lauką (IŠTRINTA – fieldResult jau groja)
// if (data.field) {
//     const fpId = data.player.id;
//     
//     if (data.field.id === 2) playSoundForPlayer('dujos', fpId);
//     else if (data.field.id === 14) playSoundForPlayer('siuksles', fpId);
//     else if (data.field.id === 28) playSoundForPlayer('elektra', fpId);
//     else if (data.field.id === 44) playSoundForPlayer('vanduo', fpId);
//     else if (data.field.id === 8) playSoundForPlayer('air-port', fpId);
//     else if (data.field.id === 19) playSoundForPlayer('train', fpId);
//     else if (data.field.id === 37) playSoundForPlayer('port', fpId);
//     else if (data.field.id === 46) playSoundForPlayer('bus', fpId);
//     else if (data.field.id === 13) playSoundForPlayer('hospital', fpId);
//     else if (data.field.id === 21) playSoundForPlayer('latras', fpId, true);
//     else if (data.field.id === 32) playSoundForPlayer('pirtis', fpId);
//     else if (data.field.id === 11) playSoundForPlayer('spa', fpId);
//     else if (data.field.id === 24) playSoundForPlayer('baseinas', fpId);
//     else if (data.field.id === 48) playSoundForPlayer('papludimys', fpId);
//     else if (data.field.id === 50) playSoundForPlayer('birthday', fpId, true);
//     else if (data.field.id === 42) playSoundForPlayer('jail_in', fpId, true);
//     else if (data.field.id === 16) playSoundForPlayer('jail', fpId);
// }
        
        if (data.field && data.result) {
            const fieldId = data.field.id;
            
            const owner = gameState?.players?.find(p => 
                p.properties?.includes(fieldId) && !p.bankrupt && !p.left && !p.kicked
            );
            
            let msgKey = '';
            let msgData = {
                player: data.player.name,
                field: data.field.name,
                owner: owner?.name || '',
                rent: data.result.rent || 0
            };
            
            if (data.field.type === 'property') {
                if (owner && owner.id === data.player.id) {
                    msgKey = isMe ? 'visitMine' : 'visitOthers';
                } else if (owner && owner.id !== data.player.id) {
                    if (isMe) msgKey = 'rentPayer';
                    else if (owner.id === playerId) msgKey = 'rentOwner';
                    else msgKey = 'rentObserver';
                } else if (data.result.action === 'can_buy') {
                    updateUI(gameState);
                    return;
                }
            } else if (data.field.type === 'service1' || data.field.type === 'service2' || data.field.type === 'service3') {
                if (data.result.action === 'can_buy') {
                    updateUI(gameState);
                    return;
                }
                
                if (owner && owner.id === data.player.id) {
                    msgKey = 'visitMine';
                } else if (owner && owner.id === playerId) {
                    msgKey = 'rentOwner';
                } else if (isMe) {
                    msgKey = 'rentPayer';
                } else {
                    msgKey = 'rentObserver';
                }
                
                let serviceIds;
                if (data.field.type === 'service1') serviceIds = SERVICE1_IDS;
                else if (data.field.type === 'service2') serviceIds = SERVICE2_IDS;
                else serviceIds = SERVICE3_IDS;
                
                const count = owner?.properties?.filter(id => serviceIds.includes(id)).length || 0;
                msgData.count = count;
                msgData.countSuffix = getCountSuffix(count);
            }
            
            if (msgKey) {
                const msg = getCellMessage(fieldId, msgKey, msgData);
                if (msg) {
                    addJournal(msg);
                    
                    let actionType = 'info';
                    if (data.result.action === 'pay_rent') actionType = 'rent';
                    else if (data.result.action === 'pay_tax' || data.result.action === 'latras' || data.result.action === 'pirtis') actionType = 'tax';
                    else if (data.result.action === 'chance' || data.result.action === 'special' || data.result.action === 'birthday') actionType = 'chance';
                    else if (data.result.action === 'go_to_jail') actionType = 'jail';
                    else actionType = 'visit';
                    
                    if (actionType === 'rent' && owner) {
                        showRentPopup(data.player.id, owner.id, data.result.rent || 0, data.field.name);
                    } else {
                        showCellAction(msg, actionType, isMe);
                    }
                }
            }
            
            // 🆕 NUOMOS GARSAI
            if (data.result.action === 'pay_rent') {
                const rentFieldId = data.field?.id;
                const rentOwner = gameState?.players?.find(p => 
                    p.properties?.includes(rentFieldId) && !p.bankrupt && !p.left && !p.kicked
                );
                
                console.log('🔍 NUOMOS GARSAS:');
                console.log('  - rentFieldId:', rentFieldId);
                console.log('  - rentOwner:', rentOwner?.name);
                console.log('  - rentOwner?.id:', rentOwner?.id);
                console.log('  - playerId:', playerId);
                console.log('  - data.player.id:', data.player.id);
                console.log('  - isMe:', isMe);
                console.log('  - BENDRA SĄLYGA:', rentOwner && rentOwner.id === playerId && rentOwner.id !== data.player.id);
                
                if (rentOwner && rentOwner.id === playerId && rentOwner.id !== data.player.id) {
                    // 🎉 TU gauni nuomą
                    playSoundForPlayer('rent-received', playerId);
                    console.log('💰 Nuomos gavimo garsas:', playerId);
                } else if (isMe) {
                    // 💸 TU moki nuomą
                    playSoundForPlayer('pay1', playerId);
                    console.log('💸 Nuomos mokėjimo garsas:', playerId);
                } else {
                    console.log('⚠️ Nė vienas nelyginys netinka!');
                }
            }
        }
        
        // 🆕 IŠTRINTA – serveris jau siunčia metimo pranešimą
        
        updateUI(gameState);
    });

   socket.on('message', (msg) => {
    console.log('📢 Pranešimas:', msg);

    
    
    // 🆕 Funkcija, kuri apdoroja pranešimą
    const processMsg = () => {
    // 🆕 Jei tai objektas su messageKey
    if (typeof msg === 'object' && msg !== null && msg.key) {
        // 🆕 Konvertuoti FOR/AGAINST į vertimą (voteKickVoted)
        if (msg.key === 'game.voteKickVoted' && msg.data && msg.data.vote) {
            const voteKey = msg.data.vote === 'FOR' ? 'game.voteFor' : 'game.voteAgainst';
            msg.data.vote = t(voteKey);
        }
        
        const text = getTranslatedMessage(msg.key, msg.data || {});
        addJournal(text);
        showKeyPopup(msg.key, msg.data, text);
        try {
            if (msg.key === 'game.passedStart' || msg.key === 'game.landedOnStart') fxStart3(0, msg.data && msg.data.bonus);
            else if (msg.key === 'game.leftJail' || msg.key === 'game.paidJailFine') fxJail3(16, 'out');
            else if (msg.key === 'game.threeDoubles') fxJail3(16, 'in');
        } catch (e) { console.warn('Efekto klaida', e); }
        return;
    }
        
        if (typeof msg !== 'string') return;
        
        if (msg.includes('gali nusipirkti') && msg.includes('už €')) {
            return;
        }
        
        if (msg.includes('metė') && msg.includes('atsistojo ant')) {
            return;
        }
        
        if (msg.includes('HORNY RP') || msg.includes('gavai €200 nuo Dedo')) {
            playChanceSound();
        }
        if (msg.includes('Dabar eina')) {
            playSoundForPlayer('move', null);
        }
        if (msg.includes('bankrotavo')) {
            playSoundForPlayer('bankrupt', null, true);
            showPopupMessage(msg, 'rent');
        }
        if (msg.includes('laimėjo aukcioną')) {
            playSoundForPlayer('auction', null, true);
            playSoundForPlayer('cash', null, true);
            showPopupMessage(msg, 'buy');
        }
        if (msg.includes('nusipirko')) {
            playBuySound();
            playCashSound();
            return;
        }
        if (msg.includes('nugriovė')) {
            playSoundForPlayer('demolish', null, true);
            playSoundForPlayer('cash', null, true);
            showPopupMessage(msg, 'move');
        }
        if (msg.includes('sumokėjo €') && msg.includes('nuomos')) {
            const isService1 = msg.includes('DUJOS') || msg.includes('ŠIUKŠLĖS') || 
                               msg.includes('ELEKTRA') || msg.includes('VANDUO');
            const isOroUostas = msg.includes('ORO UOSTAS') || msg.includes('ORO UOSTO');
            const isService2 = msg.includes('TRAUKINIŲ STOTIS') || 
                               (msg.includes('UOSTAS') && !isOroUostas) || 
                               msg.includes('AUTOBUSŲ STOTIS');
            
            if (!isService1 && !isOroUostas && !isService2) {
                playSoundForPlayer('pay1', null);
            }
            showPopupMessage(msg, 'rent');
        }
        else if (msg.includes('LATRŲ BARĄ') || msg.includes('LATRŲ BARAS') || msg.includes('LATRŲ UŽEIGĄ')) {
            showPopupMessage(msg, 'tax');
        }
        else if (msg.includes('VLADUKO PIRTĮ') || msg.includes('PIRTĮ')) {
            showPopupMessage(msg, 'tax');
        }
        else if (msg.includes('švenčia gimtadienį') || msg.includes('GIMTADIENIS')) {
            showPopupMessage(msg, 'chance');
        }
        else if (msg.includes('sumokėjo') && msg.includes('mokesčių')) {
            // garsas paleidžiamas per fieldResult (langelis #5) – čia tik pranešimas
            showPopupMessage(msg, 'tax');
        }
        else if ((msg.includes('gavo €') || msg.includes('laimėjo')) && 
            !msg.includes('GIMTADIENIS') && 
            !msg.includes('gimtadienį')) {
            playSoundForPlayer('cash', null);
        }
        if (msg.includes('prarado')) {
            playSoundForPlayer('pay', null);
        }
        if (msg.includes('išėjo iš kalėjimo')) {
            playSoundForPlayer('jail_out', null, true);
        }
        if (msg.includes('LAIMĖJO')) {
            playSoundForPlayer('celebrate', null, true);
            playSoundForPlayer('win', null, true);
        }
        if (msg.includes('pabėgo į kampą')) {
            playSoundForPlayer('bankrupt', null, true);
            showPopupMessage(msg, 'rent');
        }
        if (msg.includes('skolingas')) {
            playSoundForPlayer('error', null);
            showPopupMessage(msg, 'rent');
        }
        if (msg.includes('grįžo į žaidimą')) {
            playSoundForPlayer('start', null, true);
        }
        
        addJournal(msg);
    };
    
    // 🆕 Jei animacija vyksta – laukiam, kol baigsis
    if (isAnimating) {
        const waitForAnim = setInterval(() => {
            if (!isAnimating) {
                clearInterval(waitForAnim);
                processMsg();
            }
        }, 100);
    } else {
        processMsg();
    }
});

socket.on('chatMessage', (data) => {
    console.log('💬 Chat gautas:', data);
    addChatMessage(data);
});

socket.on('buyConfirmed', (data) => {
        console.log('✅ Pirkimas patvirtintas:', data);
        playSoundForPlayer('buy', data.playerId);
        playSoundForPlayer('nope', data.playerId);

        if (data.playerId !== undefined) {
            incrementBought(data.playerId);
        }
        
        let msg;
        if (data.playerId === playerId) {
            msg = tf('cli.j_bought_me', { fieldName: data.fieldName });
        } else {
            msg = tf('cli.j_bought_other', { playerName: data.playerName, fieldName: data.fieldName });
        }
        
        addJournal(msg);
        
        if (data.fieldName && gameState && gameState.board) {
            const field = gameState.board.find(f => f.name === data.fieldName);
            const player = gameState.players.find(p => p.id === data.playerId);
            
            if (field && player) {
                highlightCell(field.id, 'green', 5000);
                showBuyCard(field, player, 'success');
            }
        }
        
        hideBuyChoice(true);
    });

    socket.on('buyCancelled', (data) => {
    console.log('❌ Pirkimas atšauktas:', data);
    playMoveSound();
    
    let msg;
    if (data.playerId === playerId) {
        msg = tf('cli.j_declined_me', { fieldName: data.fieldName });
    } else {
        msg = tf('cli.atsisake_pirkti', { playerName: data.playerName, fieldName: data.fieldName });
    }
    
    addJournal(msg);
    
    if (data.fieldName && gameState && gameState.board) {
        const field = gameState.board.find(f => f.name === data.fieldName);
        const player = gameState.players.find(p => p.id === data.playerId);
        
        if (field && player) {
            highlightCell(field.id, 'red', 5000);
            showBuyCard(field, player, 'cancel');
        }
    }
    
    // 🆕 PRIVERSTINAI UŽDARYTI — apeiti visas apsaugas
    window.buyCancelled = true;
    window.lastPendingPurchasePlayerId = null;
    
    // 🆕 Sinchronizuoti gameState
    if (gameState) {
        gameState.waitingForBuy = false;
    }
    
    // 🆕 Tiesioginis modal uždarymas
    const buyChoice = document.getElementById('buyChoice');
    if (buyChoice) {
        buyChoice.style.display = 'none';
        buyChoice.classList.remove('show');
    }
    
    // 🆕 Grąžinti flag po 500ms
    setTimeout(() => {
        window.buyCancelled = false;
    }, 500);
    
    if (gameState) updateUI(gameState);
});

    socket.on('bankruptConfirmed', (data) => {
        console.log('💀 GAUTAS BANKROTO PATVIRTINIMAS:', data);
        if (data && data.playerId === playerId) gaEvent('player_bankrupt', { reason: data.reason || 'manual' });
        playBankruptSound();
        const msg = tf('cli.j_bankrupt', { playerName: data.playerName });
        addNotification(msg);
        if (data.playerId !== playerId) {
            showPopupMessage(msg, 'rent');
        }
        addJournal(msg);
        if (data.playerId === playerId) {
            document.getElementById('bankruptMessage').style.display = 'flex';
        }
        updateUI(gameState);
    });

    // 🆕 SERVERIS APDOROJO LAUKĄ – rodom garsus, pranešimus, kortelę
    socket.on('fieldResult', (data) => {
    // 🆕 IŠIMTA – nespaminti konsolės
    // console.log('🎯 fieldResult:', data);
    // console.log('🎯 data.result:', data.result);
    // console.log('🎯 data.result.result:', data.result?.result);
    // console.log('🎯 data.result.result?.rent:', data.result?.result?.rent);
    
    if (!data || !data.field) return;
    
    const fieldId = data.field.id;
    const result = data.result || {};
        
        // 🆕 Garsai pagal lauką
        if (fieldId === 2) { playSoundForPlayer('dujos', data.playerId); fxGas2(2); }
        else if (fieldId === 5) playSoundForPlayer('tax', data.playerId);    // VMI – garsas pagal langelį (veikia visomis kalbomis)
        else if (fieldId === 14) playSoundForPlayer('siuksles', data.playerId);
        else if (fieldId === 28) playSoundForPlayer('elektra', data.playerId);
        else if (fieldId === 44) playSoundForPlayer('vanduo', data.playerId);
        else if (fieldId === 8) { playSoundForPlayer('air-port', data.playerId); fxAir2(8); }
        else if (fieldId === 19) { playSoundForPlayer('train', data.playerId); fxVehicle3(19); }
        else if (fieldId === 37) { playSoundForPlayer('port', data.playerId); fxVehicle3(37); }
        else if (fieldId === 46) { playSoundForPlayer('bus', data.playerId); fxVehicle3(46); }
        else if (fieldId === 13) playSoundForPlayer('hospital', data.playerId);
        else if (fieldId === 21) playSoundForPlayer('latras', data.playerId, true);
        else if (fieldId === 32) playSoundForPlayer('pirtis', data.playerId);
        else if (fieldId === 11) playSoundForPlayer('spa', data.playerId);
        else if (fieldId === 24) playSoundForPlayer('baseinas', data.playerId);
        else if (fieldId === 48) playSoundForPlayer('papludimys', data.playerId);
        else if (fieldId === 50) playSoundForPlayer('birthday', data.playerId, true);
        else if (fieldId === 42) {
            playSoundForPlayer('jail_in', data.playerId, true);
            if (result.action === 'go_to_jail' || data.inJail) playPoliceVanEffect(data.playerId);
        }
        else if (fieldId === 16) playSoundForPlayer('jail', data.playerId);
        if (fieldId === 0 && typeof fxStart3 === 'function') {   // 🏁 sustojo ant START
            const md = result.messageData || (result.result && result.result.messageData) || {};
            try { fxStart3(0, md.bonus || 300); } catch (e) {}
        }
        if (typeof playCellEffect === 'function') playCellEffect(fieldId);   // 🎬 langelio efektas (jei yra)
        
        // 🆕 NUOMOS GARSAI (mokėjimas arba gavimas)
        if (result.action === 'pay_rent') {
            const rentFieldId = data.field?.id;
            const rentOwner = gameState?.players?.find(p => 
                p.properties?.includes(rentFieldId) && !p.bankrupt && !p.left && !p.kicked
            );
            const isMe = data.playerId === playerId;
            
            // 🆕 IŠIMTA – nespaminti konsolės
            // console.log('🔍 NUOMOS GARSAS (fieldResult):');
            // console.log('  - rentFieldId:', rentFieldId);
            // console.log('  - rentOwner:', rentOwner?.name);
            // console.log('  - rentOwner?.id:', rentOwner?.id);
            // console.log('  - playerId:', playerId);
            // console.log('  - data.playerId:', data.playerId);
            // console.log('  - isMe:', isMe);
            
            if (rentOwner && rentOwner.id === playerId && rentOwner.id !== data.playerId) {
                // 🎉 TU gauni nuomą
                playSoundForPlayer('rent-received', playerId);
                // console.log('💰 Nuomos gavimo garsas:', playerId);
            } else if (isMe) {
                // 💸 TU moki nuomą
                playSoundForPlayer('pay1', playerId);
                // console.log('💸 Nuomos mokėjimo garsas:', playerId);
            }
        }
        
        // 🆕 Pranešimas
        let actionType = 'info';
        if (result.action === 'pay_rent') actionType = 'rent';
        else if (result.action === 'pay_tax' || result.action === 'latras' || result.action === 'pirtis') actionType = 'tax';
        else if (result.action === 'chance' || result.action === 'special' || result.action === 'birthday') actionType = 'chance';
        else if (result.action === 'can_buy') actionType = 'visit';
        else if (result.action === 'go_to_jail') actionType = 'jail';
        
        const isMeField = data.playerId === playerId;
        let popupHandled = false;
        
        // 🏠 Laisvas sklypas: kiti mato „⏳ svarsto pirkti“ kortelę, pirkėjas – savo pasirinkimą
        if (result.action === 'can_buy') {
            popupHandled = true;
            if (!isMeField && gameState && gameState.players) {
                const buyer = gameState.players.find(p => p.id === data.playerId);
                if (buyer) showBuyCard(data.field, buyer, 'pending');
            }
        }
        
        // 💰 Nuoma – didelis pranešimas „Tomas ➜ Petras €13“
        if (result.action === 'pay_rent') {
            const rentOwner = gameState?.players?.find(p =>
                p.properties?.includes(fieldId) && !p.bankrupt && !p.left && !p.kicked
            );
            if (rentOwner) {
                showRentPopup(data.playerId, rentOwner.id, result.rent || 0, data.field.name);
                popupHandled = true;
            }
        }
        
        if (result.messageKey) {
            const text = getTranslatedMessage(result.messageKey, result.messageData || {});
            addJournal(text);
            if (!popupHandled) showCellAction(text, actionType, isMeField);
        } else if (result.message) {
            addJournal(result.message);
            if (!popupHandled) showCellAction(result.message, actionType, isMeField);
        }
        
        updateUI(gameState);
    });

    socket.on('canBuildResult', (data) => {
        console.log('🏠 Statybos rezultatas:', data);
        if (data.can) {
            if (data.isHotel) {
                if (confirm(tf('cli.statyti_viesbuti_ant_uz', { fieldName: data.fieldName, cost: data.cost }))) {
                    socket.emit('buildHouse', { fieldId: data.fieldId });
                    playClickSound();
                }
            } else {
                if (confirm(tf('cli.statyti_nama_ant_uz', { fieldName: data.fieldName, cost: data.cost }))) {
                    socket.emit('buildHouse', { fieldId: data.fieldId });
                    playClickSound();
                }
            }
        } else {
            playErrorSound();
            alert(`❌ ${data.reason}`);
        }
    });

    socket.on('tradeProposed', (data) => {
    console.log('📩 Gautas prekybos pasiūlymas:', data);
    playTradeSound();
    const msg = tf('cli.pasiule_prekyba', { fromPlayer: data.fromPlayer, toPlayer: data.toPlayer });
    addNotification(msg);
    if (data.fromPlayer !== myPlayer?.name) {
        showPopupMessage(msg, 'move');
    }
    addJournal(msg);
    
    // 🆕 IŠVALYTI senus duomenis PRIEŠ rodant naują
    window.counterOfferData = null;
    window.isCounterOfferMode = false;
    selectedOfferFields = [];
    selectedRequestFields = [];
    
    if (data.toPlayer === myPlayer?.name || data.toPlayer === playerId) {
        showTradeOffer(data);
    }
    
    if (gameState) updateUI(gameState);
});

    socket.on('tradeResponded', (data) => {
    console.log('📩 Prekybos atsakymas:', data);
    if (data.success) {
        playBuySound();
        playCashSound();
        showPopupMessage(data.message || tf('cli.prekyba_ivykdyta'), 'buy');
    } else {
        playMoveSound();
        showPopupMessage(data.message || tf('cli.trade_rejected'), 'move');
    }
    addNotification(data.message || tf('cli.trade_answer'));
    addJournal(data.message || tf('cli.trade_answer'));
    
    // 🆕 IŠVALYTI VISUS prekybos duomenis
    closeTradeOffer();
    window.counterOfferData = null;
    window.isCounterOfferMode = false;
    window.lastIncomingTrade = null;
    selectedOfferFields = [];
    selectedRequestFields = [];
    currentTradeId = null;
    
    // 🆕 UŽDARYTI prekybos langą (jei atidarytas)
    const tradingModal = document.getElementById('tradingModal');
    if (tradingModal) tradingModal.style.display = 'none';
    
    // 🆕 ATNAUJINTI UI (kad kortelės atsinaujintų)
    if (gameState) updateUI(gameState);
});

    socket.on('auctionStarted', (data) => {
        console.log('🔨 KLIENTAS GAUNA auctionStarted EVENTĄ');
        playSoundForPlayer('auction', null, true);
        
        if (!data || !data.fieldName) {
            addJournal(tf('cli.klaida_aukciono_duomenys_neteisingi'));
            playErrorSound();
            return;
        }
        
        const msg = tf('cli.prasidejo_aukcionas_bankas_siulo', { fieldName: data.fieldName, currentBid: data.currentBid });
        addNotification(msg);
        addJournal(msg);
        
        showAuction(data);
        
        if (gameState) updateUI(gameState);
    });

    socket.on('auctionUpdated', (data) => {
        console.log('💰 Aukciono pasiūlymas:', data);
        playTradeSound();
        
        if (data.currentBid !== undefined) {
            document.getElementById('auctionCurrentBid').textContent = '€' + data.currentBid;
        }
        
        if (data.currentBidderName) {
            document.getElementById('auctionCurrentBidder').textContent = data.currentBidderName;
        }
        
        if (data.currentBid !== undefined) {
            const plus10 = Math.ceil(data.currentBid * 1.10);
            const plus10Btn = document.getElementById('auctionPlus10Btn');
            if (plus10Btn) {
                plus10Btn.textContent = `➕ +10% (€${plus10})`;
            }
        }
        
        if (data.endTime) {
            startAuctionTimer(data.endTime);
        }
        
        const msg = tf('cli.pasiule', { v: data.currentBidderName || tf('cli.kazkas'), currentBid: data.currentBid });
        addNotification(msg);
        addJournal(msg);
    });

    socket.on('auctionEnded', (data) => {
        console.log('🔨 AUKCIONAS BAIGĖSI:', data);
        
        auctionEndedSent = true;
        
        if (data) {
            if (data.winnerId === 'bank') {
                const msg = tf('cli.bankas_laimejo_aukciona_uz', { fieldName: data.fieldName, finalBid: data.finalBid });
                addNotification(msg);
                showPopupMessage(msg, 'move');
                addJournal(msg);
            } else if (data.winnerName) {
                const msg = tf('cli.laimejo_aukciona_uz', { winnerName: data.winnerName, fieldName: data.fieldName, finalBid: data.finalBid });
                addNotification(msg);
                showPopupMessage(msg, 'buy');
                addJournal(msg);
                playSoundForPlayer('auction', null, true);
                playSoundForPlayer('cash', null, true);
            }
        }
        
        closeAuction();
        if (gameState) updateUI(gameState);
    });

    socket.on('activeAuctions', (data) => {
        console.log('🔨 Aktyvūs aukcionai:', data);
    });

    socket.on('pendingTrades', (data) => {
        console.log('📩 Laukantys pasiūlymai:', data);
    });

    socket.on('demolishableProperties', (properties) => {
        updateDemolishList(properties);
    });

    socket.on('demolishConfirmed', (data) => {
        const msg = `🏚️ ${data.message}`;
        addNotification(msg);
        showPopupMessage(msg, 'move');
        addJournal(msg);
        playSoundForPlayer('demolish', null, true);
        playSoundForPlayer('cash', null, true);
        if (gameState) updateUI(gameState);
    });

    socket.on('buildingBuilt', (data) => {
        console.log('🏠 Statyba:', data);
        
        if (data.isHotel) {
            playSoundForPlayer('hotel', data.playerId);
        } else {
            playSoundForPlayer('build', data.playerId);
        }
        
        window.newHouseAnimations = window.newHouseAnimations || {};
        window.newHouseAnimations[data.fieldId] = true;
        
        const isMe = data.playerId === playerId;
        
        let msgKey = '';
        if (data.isHotel) {
            msgKey = isMe ? 'hotelMine' : 'hotelOthers';
        } else {
            msgKey = isMe ? 'buildMine' : 'buildOthers';
        }
        
        const msgData = {
            player: data.playerName,
            field: data.fieldName
        };
        
        const msg = getCellMessage(data.fieldId, msgKey, msgData);
        if (msg) {
            showCellAction(msg, 'visit');
            addJournal(msg);
        }
        
        updateUI(gameState);
    });

    socket.on('leftGame', (data) => {
        console.log('🏃 Pasitraukei iš žaidimo:', data);
        clearCell5Queue();
        
        localStorage.removeItem('bancrupt_gameId');
        localStorage.removeItem('bancrupt_playerToken');
        
        addNotification(tf('cli.tu_pasitraukei_is_zaidimo'));
        addJournal(tf('cli.tu_pasitraukei_is_zaidimo'));
        
        setTimeout(() => {
            if (typeof goToMenu === 'function') {
                goToMenu();
            }
            showLobbyMessage(tf('cli.pasitraukei_is_zaidimo'), '#ffd700');
            
            playerId = null;
            gameId = null;
            gameState = null;
            myPlayer = null;
            isMyTurn = false;
        }, 1500);
    });

    socket.on('gameFinished', (data) => {
        console.log('🏆 Žaidimas baigtas:', data);
        gaEvent('game_finish', { won: !!(myPlayer && data && data.winner === myPlayer.name) });
        
        localStorage.removeItem('bancrupt_gameId');
        localStorage.removeItem('bancrupt_playerToken');

         clearChat();  // 🆕 IŠVALYTI CHAT
        
        playWinSound();
        playCelebrateSound();
        
        let stats = '';
        if (gameState && gameState.players) {
            const winner = gameState.players.find(p => p.name === data.winner);
            if (winner) {
                const houses = winner.houses ? Object.values(winner.houses).reduce((a, b) => a + b, 0) : 0;
                stats = tf('cli.turejo_objektai_namai', { money: winner.money, v: winner.properties.length, houses });
            }
        }
        
        setTimeout(() => {
            showWinnerModal(data.winner, stats);
        }, 500);
    });

    // ============================================
    // VOTE-KICK
    // ============================================
    socket.on('voteKickStarted', (data) => {
        console.log('🗳️ Balsavimas pradėtas:', data);
        
        if (data.targetId === playerId) {
            console.log('🗳️ Aš esu taikinys - nerodau nieko');
            return;
        }
        
        playNotificationSound();
        addNotification(tf('cli.pradejo_balsavima_del_pasalinimo', { initiatorName: data.initiatorName, targetName: data.targetName }));
        addJournal(tf('cli.pradejo_balsavima_del_pasalinimo', { initiatorName: data.initiatorName, targetName: data.targetName }));
        
        if (playerId !== data.initiatorId && playerId !== data.targetId) {
            showVoteKickPrompt(data);
        } else if (playerId === data.initiatorId) {
            showVoteKickStatus(data);
        }
    });

    socket.on('voteKickUpdate', (data) => {
        console.log('🗳️ Balsavimo atnaujinimas:', data);
        
        if (data.targetId === playerId) return;
        
        if (data.timeLeft !== undefined) {
            const timerEl = document.getElementById('voteKickTimer');
            if (timerEl) timerEl.textContent = data.timeLeft;
        }
        
        const statusEl = document.getElementById('voteKickStatus');
        if (statusEl && data.votes) {
            const votesFor = Object.values(data.votes).filter(v => v === true).length;
            const votesAgainst = Object.values(data.votes).filter(v => v === false).length;
            statusEl.innerHTML = `
                <div class="vote-kick-timer">⏱️ ${data.timeLeft || 0}s</div>
                <div>${tf('cli.vk_votes_full', { a: votesFor, b: data.requiredVotes, c: votesAgainst })}</div>
            `;
        }
        
        if (data.votes && gameState) {
            updateVoteKickTable(data);
        }
    });

    socket.on('voteKickResult', (data) => {
        console.log('🗳️ Balsavimo rezultatas:', data);
        
        if (voteKickTimerInterval) {
            clearInterval(voteKickTimerInterval);
            voteKickTimerInterval = null;
        }
        
        if (data.targetId === playerId) {
            if (data.kicked) {
                amIKicked = true;
                playBankruptSound();
                showKickSummary(data);
            }
            return;
        }
        
        closeVoteKick();
        
        if (data.kicked) {
            playBankruptSound();
            addNotification(tf('cli.buvo_pasalintas', { targetName: data.targetName, votesFor: data.votesFor, requiredVotes: data.requiredVotes }));
            addJournal(tf('cli.buvo_pasalintas', { targetName: data.targetName, votesFor: data.votesFor, requiredVotes: data.requiredVotes }));
        } else {
            addNotification(tf('cli.balsavimas_del_nepavyko', { targetName: data.targetName, votesFor: data.votesFor, requiredVotes: data.requiredVotes }));
            addJournal(tf('cli.balsavimas_del_nepavyko', { targetName: data.targetName, votesFor: data.votesFor, requiredVotes: data.requiredVotes }));
        }
        
        if (gameState) updateUI(gameState);
    });

    socket.on('voteKickCancelled', (data) => {
        console.log('🗳️ Balsavimas atšauktas:', data.reason);
        
        if (voteKickTimerInterval) {
            clearInterval(voteKickTimerInterval);
            voteKickTimerInterval = null;
        }
        
        closeVoteKick();
        addNotification(tf('cli.balsavimas_atsauktas', { reason: data.reason }));
        addJournal(tf('cli.balsavimas_atsauktas', { reason: data.reason }));
    });
}

// ============================================
// AUTO INFO PANELĖS ŠRIFTAS
// ============================================

function autoFitInfoFont() {
    const panel = document.getElementById('cellInfoPanel');
    if (!panel || !panel.classList.contains('show')) return;
    
    const width = panel.clientWidth;
    if (width === 0) return;
    
    let fontSize = 12;
    
    if (width < 200) fontSize = 10;
    else if (width < 250) fontSize = 10;
    else if (width < 300) fontSize = 11;
    else if (width < 350) fontSize = 12;
    else if (width < 400) fontSize = 13;
    else if (width < 500) fontSize = 14;
    else if (width < 650) fontSize = 15;
    else fontSize = 16;
    
    panel.style.setProperty('--info-font-size', fontSize + 'px');
    panel.style.setProperty('--info-header-size', (fontSize + 2) + 'px');
    panel.style.setProperty('--info-section-size', (fontSize + 1) + 'px');
}

function initInfoResizeObserver() {
    const panel = document.getElementById('cellInfoPanel');
    if (!panel) return;
    
    if (infoResizeObserver) {
        infoResizeObserver.disconnect();
    }
    
    if (window.ResizeObserver) {
        infoResizeObserver = new ResizeObserver(() => {
            setTimeout(autoFitInfoFont, 50);
        });
        infoResizeObserver.observe(panel);
    }
    
    window.addEventListener('resize', () => {
        setTimeout(autoFitInfoFont, 100);
    });
    
    setTimeout(autoFitInfoFont, 200);
}

// ============================================
// SPALVŲ PASIRINKIMO FUNKCIJOS
// ============================================

function renderColorPicker(containerId, availableColors, selectedColor, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    PLAYER_COLORS.forEach(color => {
        const circle = document.createElement('div');
        circle.className = 'color-circle';
        circle.style.background = color;
        
        const isAvailable = availableColors === null || availableColors.includes(color);
        const isSelected = selectedColor === color;
        
        if (!isAvailable) {
            circle.classList.add('taken');
        }
        
        if (isSelected) {
            circle.classList.add('selected');
        }
        
        if (isAvailable) {
            circle.onclick = () => {
                playClickSound();
                onSelect(color);
            };
        }
        
        container.appendChild(circle);
    });
}

function selectCreateColor(color) {
    selectedCreateColor = color;
    renderColorPicker('createColorPicker', null, selectedCreateColor, selectCreateColor);
}

function selectJoinColor(color) {
    if (availableJoinColors.length === 0) {
        selectedJoinColor = color;
        renderColorPicker('joinColorPicker', PLAYER_COLORS, selectedJoinColor, selectJoinColor);
        return;
    }
    
    if (!availableJoinColors.includes(color)) {
        playErrorSound();
        alert(tf('cli.si_spalva_jau_uzimta'));
        return;
    }
    
    if (selectedJoinColor && selectedJoinColor !== color) {
        const gid = document.getElementById('gameIdInput').value.trim().toUpperCase();
        if (gid && socket) {
            socket.emit('releaseColor', { gameId: gid, color: selectedJoinColor });
        }
    }
    
    selectedJoinColor = color;
    renderColorPicker('joinColorPicker', availableJoinColors, selectedJoinColor, selectJoinColor);
    
    const gid = document.getElementById('gameIdInput').value.trim().toUpperCase();
    if (gid && socket) {
        socket.emit('reserveColor', { gameId: gid, color: color });
    }
}

function checkGameColors() {
    const gid = document.getElementById('gameIdInput').value.trim().toUpperCase();
    if (!gid || gid.length < 4) {
        availableJoinColors = [...PLAYER_COLORS];
        selectedJoinColor = null;
        renderColorPicker('joinColorPicker', availableJoinColors, null, selectJoinColor);
        const status = document.getElementById('joinColorStatus');
        if (status) status.textContent = tf('cli.ivesk_pilna_stalo_koda');
        return;
    }
    
    socket.emit('getGameColors', { gameId: gid });
}

// ============================================
// WAITING ROOM
// ============================================

function showWaitingRoom() {
    const overlay = document.getElementById('waitingRoomOverlay');
    if (overlay) overlay.style.display = 'flex';
    toggleBuildRuleList(false);      // naujas kambarys – taisyklių sąrašas suskleistas
    
    const codeEl = document.getElementById('waitingGameCode');
    if (codeEl && gameId) codeEl.textContent = gameId;
    
    const linkEl = document.getElementById('waitingGameLink');
    if (linkEl && gameId) {
        linkEl.textContent = window.location.origin + '/?game=' + gameId;
    }
}

function hideWaitingRoom() {
    const overlay = document.getElementById('waitingRoomOverlay');
    if (overlay) overlay.style.display = 'none';
    toggleBuildRuleList(false);
    // Žaidimo ekranas atsidengė – pritaikyti telefono vaizdą / pasukimą / užuominą
    if (typeof applyCompactLayout === 'function') setTimeout(applyCompactLayout, 60);
}

// ============================================
// 🏗️ STATYBŲ TAISYKLĖ – laukimo kambarys
// ============================================
const BUILD_RULE_TEXT = {
    1: ['waiting.buildRule1', 'Bet kada ir bet kur (turint pilną gatvę)'],
    2: ['waiting.buildRule2', 'Atsistojus ant savo sklypo – po namą visoje gatvėje'],
    3: ['waiting.buildRule3', 'Tik sklype, ant kurio stovi']
};
let buildRuleTouched = {};      // gameId -> kūrėjas jau paspaudė taisyklę (mirksėjimas sustoja)
let lastBuildRuleSeen = null;
let buildRuleOpen = false;      // ar išskleistas 1/2/3 sąrašas (pagal nutylėjimą – suskleistas)

// Išskleidžia / suskleidžia taisyklių sąrašą (1 ir 3 paslėptos, kol nepaprašai)
function toggleBuildRuleList(force) {
    buildRuleOpen = (typeof force === 'boolean') ? force : !buildRuleOpen;
    const box = document.getElementById('buildRuleBox');
    const btn = document.getElementById('buildRuleCurrent');
    const list = document.getElementById('buildRuleOptions');
    if (box) box.classList.toggle('open', buildRuleOpen);
    if (btn) btn.setAttribute('aria-expanded', buildRuleOpen ? 'true' : 'false');
    if (list) list.setAttribute('aria-hidden', buildRuleOpen ? 'false' : 'true');
    if (buildRuleOpen && typeof playClickSound === 'function') playClickSound();
}

let buildRuleLeaveTimer = null;

// Uždarymas: paspaudus šalia, paspaudus Escape, arba nukėlus pelę (desktop)
function initBuildRulePopover() {
    const box = document.getElementById('buildRuleBox');
    if (!box || box.dataset.popoverReady === '1') return;
    box.dataset.popoverReady = '1';
    box.addEventListener('mouseenter', () => clearTimeout(buildRuleLeaveTimer));
    box.addEventListener('mouseleave', () => {
        if (!buildRuleOpen) return;
        if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
        clearTimeout(buildRuleLeaveTimer);
        buildRuleLeaveTimer = setTimeout(() => toggleBuildRuleList(false), 280);
    });
    document.addEventListener('click', (e) => {
        if (!buildRuleOpen) return;
        if (!box.contains(e.target)) toggleBuildRuleList(false);
    });
    document.addEventListener('keydown', (e) => {
        if (buildRuleOpen && (e.key === 'Escape' || e.key === 'Esc')) toggleBuildRuleList(false);
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBuildRulePopover);
else initBuildRulePopover();

function renderBuildRuleBox(state) {
    const box = document.getElementById('buildRuleBox');
    if (!box || !state) return;
    const rule = state.buildRule || 2;
    const isHost = state.hostId === playerId;
    const title = document.getElementById('buildRuleTitle');
    box.classList.toggle('is-host', isHost);
    box.classList.remove('blink');
    if (title) {
        title.textContent = tt('waiting.buildRuleShort', '🏗️ Statybų taisyklė');
    }
    // Suskleista eilutė rodo, kuri taisyklė galioja
    const curNum = document.getElementById('buildRuleCurrentNum');
    const curText = document.getElementById('buildRuleCurrentText');
    const curBtn = document.getElementById('buildRuleCurrent');
    if (curNum) curNum.textContent = rule + '.';
    if (curText) curText.textContent = buildRuleLabel(rule);
    if (curBtn) {
        const changeLabel = tt('waiting.buildRuleChange', 'Keisti taisyklę');
        curBtn.title = changeLabel;
        curBtn.setAttribute('aria-label', changeLabel + ': ' + buildRuleLabel(rule));
    }
    box.querySelectorAll('.build-rule-opt').forEach(btn => {
        const r = parseInt(btn.dataset.rule, 10);
        btn.classList.toggle('active', r === rule);
        btn.disabled = !isHost;
    });
    const note = document.getElementById('buildRuleNote');
    if (note) {
        note.textContent = isHost
            ? tt('waiting.buildRuleNoteHost2', 'Galios visiems žaidėjams')
            : tt('waiting.buildRuleNoteGuest', 'Taisyklę pasirenka stalo kūrėjas 👑');
    }
    // Kitiems žaidėjams – trumpas mirktelėjimas, kai kūrėjas pakeičia taisyklę
    if (!isHost && lastBuildRuleSeen !== null && lastBuildRuleSeen !== rule) {
        box.classList.remove('changed'); void box.offsetWidth; box.classList.add('changed');
    }
    lastBuildRuleSeen = rule;
}

// 🎲 Figūrėlės pasirinkimas laukimo kambaryje
function renderPiecePicker(state) {
    const box = document.getElementById('piecePickerBox');
    if (!box || !state) return;
    const me = state.players.find(p => p.id === playerId);
    if (!me) { box.style.display = 'none'; return; }
    box.style.display = '';
    const grid = box.querySelector('.piece-grid');
    const cur = me.piece || null;
    // Kitų žaidėjų užimtos figūrėlės (kaip spalvos – viena figūrėlė vienam žaidėjui)
    const takenBy = {};
    state.players.forEach(p => { if (p.id !== playerId && p.piece) takenBy[p.piece] = p; });
    box.classList.toggle('need', !cur);
    box.classList.toggle('chosen', !!cur);
    const title = box.querySelector('.piece-title');
    if (title) {
        if (cur) {
            const nm = PIECE_NAMES[cur] || ['', cur];
            title.textContent = tt('piece.chosen', '✅ TAVO FIGŪRĖLĖ:') + ' ' + tt(nm[0], nm[1]).toUpperCase();
        } else {
            title.textContent = tt('piece.choose', '🎲 PASIRINK FIGŪRĖLĘ');
        }
    }
    const note = box.querySelector('.piece-note');
    if (note && !note.dataset.flash) {
        note.textContent = cur ? tt('piece.canChange', 'Gali pakeisti, kol žaidimas neprasidėjo')
                               : tt('piece.autoHint', 'Nepasirinkus – paspaudus „Pasiruošęs“ figūrėlė bus parinkta atsitiktinai');
    }
    grid.innerHTML = '';
    PIECE_TYPES.forEach(type => {
        const owner = takenBy[type];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'piece-opt' + (type === cur ? ' active' : '') + (owner ? ' taken' : '');
        const nm = PIECE_NAMES[type];
        const label = tt(nm[0], nm[1]);
        b.title = owner ? label + ' – ' + (owner.name || '') : label;
        b.innerHTML = pieceSvg(type, owner ? owner.color : me.color) +
            `<span class="piece-name">${escapeHtml(owner ? (owner.name || label) : label)}</span>` +
            (owner ? `<span class="piece-owner" style="background:${safeColor(owner.color)}"></span>` : '');
        if (owner) {
            b.disabled = true;
        } else {
            b.onclick = () => {
                if (type === cur) return;
                playClickSound();
                grid.querySelectorAll('.piece-opt').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                socket.emit('setPiece', { piece: type });
            };
        }
        grid.appendChild(b);
    });
}

// 🎲 Serveris parinko figūrėlę (pasiruošta nepasirinkus)
function flashPieceNote(piece) {
    const box = document.getElementById('piecePickerBox');
    const note = box && box.querySelector('.piece-note');
    if (!note) return;
    const nm = PIECE_NAMES[piece] || ['', piece];
    note.dataset.flash = '1';
    note.textContent = tt('piece.autoAssigned', '🎲 Tau parinkta figūrėlė:') + ' ' + tt(nm[0], nm[1]);
    note.classList.add('flash');
    clearTimeout(flashPieceNote._t);
    flashPieceNote._t = setTimeout(() => {
        delete note.dataset.flash;
        note.classList.remove('flash');
        if (waitingRoomState) renderPiecePicker(waitingRoomState);
    }, 4500);
}

function chooseBuildRule(rule) {
    if (!waitingRoomState || waitingRoomState.hostId !== playerId) return;
    buildRuleTouched[waitingRoomState.gameId || gameId] = true;
    if (typeof playClickSound === 'function') playClickSound();
    // Iš karto parodom pasirinkimą, serveris patvirtins
    renderBuildRuleBox(Object.assign({}, waitingRoomState, { buildRule: rule }));
    toggleBuildRuleList(false);      // pasirinkus taisyklę – vėl suskleidžiam
    if (socket) socket.emit('setBuildRule', { rule });
}

function buildRuleLabel(rule) {
    const t2 = BUILD_RULE_TEXT[rule] || BUILD_RULE_TEXT[2];
    return tt(t2[0], t2[1]);
}

function updateWaitingRoom(state) {
    waitingRoomState = state;
    
    const countEl = document.getElementById('waitingPlayerCount');
    if (countEl) countEl.textContent = `${state.totalPlayers}/8`;
    
    const listEl = document.getElementById('waitingPlayersList');
    const amHost = playerId === state.hostId;
    if (listEl) {
        const MAX_SEATS = 8;
        let html = state.players.map(p => {
            const isBot = p.isBot === true;
            const isMe = p.id === playerId;
            let badge;
            const mkBadge = (cls, icon, label) => `<span class="wr-badge ${cls}" title="${escapeHtml(label)}"><span class="wr-badge-ic">${icon}</span><span class="wr-badge-tx">${escapeHtml(label.replace(/^\S+\s/, ''))}</span></span>`;
            if (p.isHost) badge = mkBadge('host', '👑', tt('waiting.hostBadge', '👑 Kūrėjas'));
            else if (isBot) badge = mkBadge('bot', '🤖', t('game.waiting.bot'));
            else if (p.ready) badge = mkBadge('ok', '✅', tt('waiting.readyBadge', '✅ Pasiruošęs'));
            else badge = mkBadge('wait', '⏳', tt('waiting.notReadyBadge', '⏳ Ruošiasi'));
            const kick = (amHost && !isMe && !p.isHost)
                ? `<button type="button" class="wr-kick" title="${escapeHtml(tt('waiting.kick', 'Pašalinti'))}" onclick="kickPlayer(${p.id})">✕</button>` : '';
            return `<div class="wr-seat${isMe ? ' me' : ''}" style="--pc:${safeColor(p.color)}">
                        <span class="wr-piece">${p.piece ? pieceSvg(p.piece, p.color) : '<span class="wr-nopiece">❔</span>'}</span>
                        <span class="wr-seat-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}${isMe ? ' <em>' + escapeHtml(t('game.waiting.you')) + '</em>' : ''}</span>
                        ${badge}${kick}
                    </div>`;
        }).join('');
        const free = MAX_SEATS - state.players.length;
        for (let i = 0; i < free; i++) {
            if (amHost && i === 0 && !state.gameStarted) {
                html += `<button type="button" class="wr-seat empty add" onclick="addBot()">${escapeHtml(tt('waiting.addBotSeat', '➕ Pridėti botą'))}</button>`;
            } else {
                html += `<div class="wr-seat empty">${escapeHtml(tt('waiting.emptySeat', 'Laisva vieta'))}</div>`;
            }
        }
        listEl.innerHTML = html;
    }

    // Kiek ne-kūrėjų dar nepasiruošę (kūrėjas pasiruošęs automatiškai)
    const guestsNotReady = state.players.filter(p => !p.isHost && !p.ready).length;
    const statusEl = document.getElementById('waitingStatusText');
    if (statusEl) {
        if (state.totalPlayers < 2) {
            statusEl.innerHTML = amHost
                ? tt('waiting.needPlayersHost', 'Pakviesk draugą arba pridėk botą – reikia bent 2 žaidėjų')
                : t('game.waiting.needPlayers').replace('{count}', state.totalPlayers);
        } else if (guestsNotReady > 0) {
            statusEl.innerHTML = t('game.waiting.notReady').replace('{count}', guestsNotReady);
        } else {
            statusEl.innerHTML = amHost
                ? tt('waiting.readyToStart', '🎉 Visi pasiruošę – galima pradėti!')
                : tt('waiting.waitHost', '⏳ Laukiama, kol 👑 kūrėjas pradės žaidimą');
        }
        statusEl.classList.toggle('good', state.canStart === true);
    }

    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startGameBtn');
    if (readyBtn) {
        const me = state.players.find(p => p.id === playerId);
        readyBtn.style.display = amHost ? 'none' : '';
        const isReady = !!(me && me.ready);
        readyBtn.classList.toggle('is-ready', isReady);
        readyBtn.innerHTML = isReady ? t('game.waiting.readyBtnActive') : t('game.waiting.readyBtn');
    }
    if (startBtn) {
        startBtn.style.display = amHost ? '' : 'none';
        startBtn.disabled = !state.canStart;
        startBtn.innerHTML = tt('waiting.startPlain', '▶ Pradėti žaidimą');
    }

    renderBuildRuleBox(state);
    renderPiecePicker(state);

    const publicCheckbox = document.getElementById('waitingIsPublic');
    if (publicCheckbox) {
        publicCheckbox.checked = state.isPublic === true;
        if (playerId !== state.hostId) {
            publicCheckbox.disabled = true;
        } else {
            publicCheckbox.disabled = false;
        }
    }
}

function toggleReady() {
    if (!waitingRoomState) return;
    
    const me = waitingRoomState.players.find(p => p.id === playerId);
    const newReady = !(me && me.ready);
    
    playClickSound();
    socket.emit('playerReady', { ready: newReady });
}

// ============================================
// 🤖 BOTŲ FUNKCIJOS
// ============================================

function addBot() {
    if (!socket || !isConnected) {
        alert(tf('cli.nera_rysio_su_serveriu'));
        playErrorSound();
        return;
    }
    
    if (!gameId) {
        alert(tf('cli.nesi_zaidime'));
        playErrorSound();
        return;
    }
    
    if (!waitingRoomState) {
        alert(tf('cli.nera_waiting_room_busenos'));
        playErrorSound();
        return;
    }
    
    const activePlayers = waitingRoomState.players.length;
    if (activePlayers >= 8) {
        alert(tf('cli.stalas_pilnas_max_zaidejai'));
        playErrorSound();
        return;
    }
    
    if (playerId !== waitingRoomState.hostId) {
        alert(tf('cli.tik_zaidimo_kurejas_gali_prideti'));
        playErrorSound();
        return;
    }
    
    if (waitingRoomState.gameStarted) {
        alert(tf('cli.zaidimas_jau_prasidejo'));
        playErrorSound();
        return;
    }
    
    console.log('🤖 Pridedamas botas...');
    playClickSound();
    
    socket.emit('addBot');
}

function startGame() {
    playClickSound();
    socket.emit('startGame');
}

function leaveGameFromWaiting() {
    if (!isConnected || !socket || !socket.connected) {
        alert(tf('cli.nera_rysio_su_serveriu'));
        playErrorSound();
        return;
    }
    
    if (!confirm(tf('cli.ar_tikrai_nori_pasitraukti_is'))) {
        return;
    }
    
    playClickSound();
    hideWaitingRoom();
    socket.emit('leaveGame');
}

function kickPlayer(targetId) {
    if (!confirm(tf('cli.ar_tikrai_nori_ismesti_si'))) return;
    
    playClickSound();
    socket.emit('kickPlayer', { targetId: targetId });
}

function flashCopied(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.innerHTML = tt('waiting.copied', '✅ Nukopijuota!');
    btn.classList.add('copied');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.innerHTML = btn.dataset.label; delete btn.dataset.label; btn.classList.remove('copied'); }, 1800);
}

// Patikimas kopijavimas: modernus API → atsarginis execCommand → rankinis prompt
async function copyTextToClipboard(text) {
    const value = String(text == null ? '' : text);
    if (!value) return false;

    // 1) Modernus Clipboard API (reikia fokusuoto dokumento ir leidimo)
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(value);
            console.log('📋 Nukopijuota (clipboard API):', value);
            return true;
        }
    } catch (e) {
        console.warn('⚠️ clipboard.writeText nepavyko:', e && e.message);
    }

    // 2) Atsarginis būdas – paslėptas textarea + execCommand('copy')
    try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        const prevFocus = document.activeElement;
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (prevFocus && typeof prevFocus.focus === 'function') { try { prevFocus.focus(); } catch (e) {} }
        if (ok) {
            console.log('📋 Nukopijuota (execCommand):', value);
            return true;
        }
        console.warn('⚠️ execCommand("copy") grąžino false');
    } catch (e) {
        console.warn('⚠️ execCommand("copy") nepavyko:', e && e.message);
    }
    return false;
}

// Paskutinė išeitis – parodyti tekstą, kad žaidėjas nusikopijuotų pats
function manualCopyPrompt(labelKey, fallbackText, value) {
    setTimeout(() => {
        try {
            const w = window.prompt(tf(labelKey, fallbackText), value);
            if (w !== null) return;
        } catch (e) {}
        console.log('📋 Kopijuojamas tekstas:', value);
    }, 30);
}

function copyGameCode() {
    if (!gameId) return;
    copyTextToClipboard(gameId).then((ok) => {
        if (ok) {
            playNotificationSound();
            flashCopied('copyCodeBtn');
        } else {
            manualCopyPrompt('cli.nukopijuok_koda', 'Nukopijuok kodą (Ctrl+C):', String(gameId));
        }
    });
}

function copyGameLink() {
    if (!gameId) return;
    const link = window.location.origin + '/?game=' + gameId;
    copyTextToClipboard(link).then((ok) => {
        if (ok) {
            playNotificationSound();
            flashCopied('copyInviteBtn');
        } else {
            manualCopyPrompt('cli.nukopijuok_nuoroda', 'Nukopijuok nuorodą (Ctrl+C):', link);
        }
    });
}

function sendWaitingChat() {
    const input = document.getElementById('waitingChatInput');
    if (!input) return;
    
    const msg = input.value.trim();
    if (!msg) return;
    
    socket.emit('chatMessage', msg);
    input.value = '';
}

function togglePublic() {
    const checkbox = document.getElementById('waitingIsPublic');
    if (!checkbox) return;
    
    playClickSound();
    socket.emit('setGamePublic', { isPublic: checkbox.checked });
}

// ============================================
// VIEŠI STALAI
// ============================================

function refreshPublicGames() {
    if (!socket || !isConnected) return;
    socket.emit('getPublicGames');
}

function renderPublicGames(games) {
    const listEl = document.getElementById('publicGamesList');
    if (!listEl) return;
    
   if (!games || games.length === 0) {
    listEl.innerHTML = `<div class="public-games-empty">${t('game.publicGames.empty')}</div>`;
    return;
}
    
    listEl.innerHTML = games.map(g => `
        <div class="public-game-item" onclick="joinPublicGame('${g.gameId}')">
            <span style="font-size:24px;">🌐</span>
            <div style="flex:1;">
                <div class="game-host">👑 ${g.hostName}</div>
                <div class="game-count">${t('game.publicGames.players').replace('{count}', g.playerCount).replace('{max}', g.maxPlayers)}</div>
            </div>
            <div class="game-code">${g.gameId}</div>
        </div>
    `).join('');
}

function joinPublicGame(gid) {
    closePublicGamesModal();
    
    if (typeof showPage === 'function') {
        showPage('page-join');
    }
    
    setTimeout(() => {
        const input = document.getElementById('gameIdInput');
        if (input) {
            input.value = gid;
            checkGameColors();
        }
    }, 200);
}

// ============================================
// AUKCIONO FUNKCIJOS
// ============================================

function showAuction(data) {
    if (!data) {
        alert(tf('cli.klaida_gauti_neteisingi_aukciono_duomenys'));
        playErrorSound();
        return;
    }
    
    auctionEndedSent = false;
    currentAuctionId = data.auctionId;
    
    const isSeller = data.sellerId === playerId;
    
    document.getElementById('auctionSeller').textContent = data.sellerName || tf('cli.nezinomas');
    document.getElementById('auctionFieldName').textContent = data.fieldName || tf('cli.nezinoma_kortele');
    document.getElementById('auctionFieldCost').textContent = '€' + (data.fieldCost || 0);
    
    // 🆕 AUKCIONO MINI KORTELĖ
    const miniCardContainer = document.getElementById('auctionMiniCardContainer');
    if (miniCardContainer) {
        if (data.fieldIcon || data.fieldColor) {
            const isService = data.fieldType === 'service1' || data.fieldType === 'service2' || data.fieldType === 'service3';
            const color = data.fieldColor || '#c9a84c';
            const icon = data.fieldIcon || '';
            
            const topBar = isService 
                ? `<div class="mini-card-color mini-card-icon" style="background:transparent; display:flex; align-items:center; justify-content:center; font-size:24px;">${icon}</div>`
                : `<div class="mini-card-color" style="background:${color};"></div>`;
            
            miniCardContainer.innerHTML = `
                <div class="mini-card">
                    ${topBar}
                    <div class="mini-card-body">
                        <div class="mini-card-name">${data.fieldName || ''}</div>
                        <div class="mini-card-info">€${data.fieldCost || 0}</div>
                    </div>
                </div>
            `;
        } else {
            miniCardContainer.innerHTML = '';
        }
    }
    
    const bankBid = data.currentBid;
    document.getElementById('auctionBankBid').textContent = '€' + bankBid;
    
    document.getElementById('auctionCurrentBid').textContent = '€' + bankBid;
    document.getElementById('auctionCurrentBidder').textContent = tf('cli.bankas');
    
    const plus10 = Math.ceil(bankBid * 1.10);
    const plus10Btn = document.getElementById('auctionPlus10Btn');
    if (plus10Btn) {
        plus10Btn.textContent = `➕ +10% (€${plus10})`;
    }
    
    const sellerNotice = document.getElementById('auctionSellerNotice');
    const bidControls = document.getElementById('auctionBidControls');
    const closeBtn = document.getElementById('auctionCloseBtn');
    
    if (isSeller) {
        if (sellerNotice) sellerNotice.style.display = 'block';
        if (bidControls) bidControls.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'none';
    } else {
        if (sellerNotice) sellerNotice.style.display = 'none';
        if (bidControls) bidControls.style.display = 'flex';
        if (closeBtn) closeBtn.style.display = 'block';
    }
    
    const endTime = data.endTime || (Date.now() + 60000);
    startAuctionTimer(endTime);
    
    document.getElementById('auctionModal').style.display = 'flex';
    playAuctionSound();
}

function closeAuction() {
    document.getElementById('auctionModal').style.display = 'none';
    if (auctionTimerInterval) {
        clearInterval(auctionTimerInterval);
        auctionTimerInterval = null;
    }
    currentAuctionId = null;
    auctionEndedSent = true;
    playClickSound();
}

function startAuctionTimer(endTime) {
    if (auctionTimerInterval) {
        clearInterval(auctionTimerInterval);
    }
    
    auctionEndedSent = false;
    
    auctionTimerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        const timerEl = document.getElementById('auctionTimer');
        if (timerEl) timerEl.textContent = remaining;
        
        if (remaining <= 0 && !auctionEndedSent) {
            clearInterval(auctionTimerInterval);
            auctionTimerInterval = null;
            if (timerEl) timerEl.textContent = '0';
            
            auctionEndedSent = true;
        }
    }, 1000);
}

function placeBid() {
    if (!currentAuctionId) {
        alert(tf('cli.nera_aktyvaus_aukciono'));
        playErrorSound();
        return;
    }
    
    const input = document.getElementById('auctionBidInput');
    const bidAmount = parseInt(input.value);
    
    if (isNaN(bidAmount) || bidAmount <= 0) {
        alert(tf('cli.ivesk_teisinga_kaina'));
        playErrorSound();
        return;
    }
    
    const currentBidText = document.getElementById('auctionCurrentBid').textContent;
    const currentBid = parseInt(currentBidText.replace('€', '')) || 0;
    
    if (bidAmount <= currentBid) {
        alert(tf('cli.siulyk_daugiau_nei', { currentBid }));
        playErrorSound();
        return;
    }
    
    socket.emit('bidAuction', { auctionId: currentAuctionId, bidAmount });
    input.value = '';
    playClickSound();
}

function placeBidPlus10() {
    if (!currentAuctionId) {
        alert(tf('cli.nera_aktyvaus_aukciono'));
        playErrorSound();
        return;
    }
    
    const currentBidText = document.getElementById('auctionCurrentBid').textContent;
    const currentBid = parseInt(currentBidText.replace('€', '')) || 0;
    
    const newBid = Math.ceil(currentBid * 1.10);
    
    socket.emit('bidAuction', { auctionId: currentAuctionId, bidAmount: newBid });
    playClickSound();
}

// ============================================
// VOTE-KICK
// ============================================

function openVoteKick() {
    if (!socket || !isConnected) {
        alert(tf('cli.nera_rysio_su_serveriu'));
        return;
    }
    
    if (!gameState || !gameState.players) {
        alert(tf('cli.zaidimas_dar_neprasidejes'));
        return;
    }
    
    if (gameState.activeVoteKick) {
        alert(tf('cli.balsavimas_jau_vyksta_palauk_kol'));
        return;
    }
    
    const modal = document.getElementById('voteKickModal');
    const playersDiv = document.getElementById('voteKickPlayers');
    const statusDiv = document.getElementById('voteKickStatus');
    
    playersDiv.innerHTML = '';
    statusDiv.innerHTML = tf('cli.pasirink_zaideja_kuri_nori_pasalinti');
    
    const activePlayers = gameState.players.filter(p => 
        p.isActive && !p.bankrupt && !p.left && !p.kicked
    );
    
    if (activePlayers.length < 3) {
        statusDiv.innerHTML = tf('cli.reikia_bent_aktyviu_zaideju_balsavimui');
        modal.style.display = 'flex';
        return;
    }
    
    const otherPlayers = activePlayers.filter(p => p.id !== playerId);
    
    if (otherPlayers.length === 0) {
        statusDiv.innerHTML = tf('cli.nera_zaideju_kuriuos_butu_galima');
    } else {
        otherPlayers.forEach(p => {
            const card = document.createElement('div');
            card.className = 'vote-kick-card';
            card.innerHTML = `
                <div class="card-color" style="background:${p.color || '#888'}"></div>
                <div class="card-name">${p.name}</div>
                <div class="card-votes">🗳️ Balsuoti</div>
            `;
            card.onclick = () => startVoteKick(p.id, p.name);
            playersDiv.appendChild(card);
        });
    }
    
    modal.style.display = 'flex';
}

function closeVoteKick() {
    document.getElementById('voteKickModal').style.display = 'none';
    
    if (voteKickTimerInterval) {
        clearInterval(voteKickTimerInterval);
        voteKickTimerInterval = null;
    }
}

function startVoteKick(targetPlayerId, targetName) {
    if (!confirm(tf('cli.ar_tikrai_nori_pradeti_balsavima', { targetName }))) {
        return;
    }
    
    socket.emit('startVoteKick', {
        targetPlayerId: targetPlayerId
    });
    
    closeVoteKick();
    playClickSound();
}

function voteKickAction(targetPlayerId, vote) {
    socket.emit('voteKick', {
        vote: vote === true
    });
    
    closeVoteKick();
    playClickSound();
}

function showVoteKickPrompt(data) {
    const modal = document.getElementById('voteKickModal');
    const playersDiv = document.getElementById('voteKickPlayers');
    const statusDiv = document.getElementById('voteKickStatus');
    
    const requiredVotes = data.requiredVotes || 3;
    const votesFor = data.votes ? Object.values(data.votes).filter(v => v === true).length : 1;
    const timeLeft = data.timeLeft || 60;
    
    playersDiv.innerHTML = `
        <div style="padding:15px; background:rgba(255,255,255,0.3); border-radius:8px; margin:10px 0; text-align:center;">
            <div style="font-size:16px; font-weight:700; color:#3d2b1f; margin-bottom:10px;">
                ${tf('cli.vk_ask', { name: data.targetName })}
            </div>
            <div style="font-size:13px; color:#6c757d; margin-bottom:15px;">
                ${tf('cli.vk_started_by', { name: data.initiatorName })}
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button onclick="voteKickAction(${data.targetId}, true)" 
                        style="flex:1; padding:12px; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; background:linear-gradient(145deg, #dc3545, #a71d2a); color:#fff;">
                    ${tf('cli.vk_yes')}
                </button>
                <button onclick="voteKickAction(${data.targetId}, false)" 
                        style="flex:1; padding:12px; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; background:linear-gradient(145deg, #28a745, #1e7e34); color:#fff;">
                    ${tf('cli.vk_no')}
                </button>
            </div>
        </div>
    `;
    
    statusDiv.innerHTML = `
        <div class="vote-kick-timer" id="voteKickTimer">${timeLeft}</div>
        <div>${tf('cli.vk_votes', { a: votesFor, b: requiredVotes })}</div>
    `;
    
    modal.style.display = 'flex';
    
    if (voteKickTimerInterval) clearInterval(voteKickTimerInterval);
    voteKickTimerInterval = setInterval(() => {
        const timerEl = document.getElementById('voteKickTimer');
        if (timerEl) {
            let current = parseInt(timerEl.textContent);
            if (current > 0) {
                timerEl.textContent = current - 1;
            } else {
                clearInterval(voteKickTimerInterval);
            }
        }
    }, 1000);
}

function showVoteKickStatus(data) {
    const modal = document.getElementById('voteKickModal');
    const playersDiv = document.getElementById('voteKickPlayers');
    const statusDiv = document.getElementById('voteKickStatus');
    
    playersDiv.innerHTML = `
        <div style="padding:15px; background:rgba(255,255,255,0.3); border-radius:8px; margin:10px 0; text-align:center;">
            <div style="font-size:16px; font-weight:700; color:#3d2b1f; margin-bottom:10px;">
                ${tf('cli.vk_you_started', { name: data.targetName })}
            </div>
            <div style="font-size:13px; color:#6c757d;">
                ${tf('cli.vk_waiting')}
            </div>
        </div>
    `;
    
    statusDiv.innerHTML = `
        <div class="vote-kick-timer" id="voteKickTimer">${data.timeLeft || 60}</div>
        <div>${tf('cli.vk_votes_me', { b: data.requiredVotes })}</div>
    `;
    
    modal.style.display = 'flex';
}

function updateVoteKickTable(data) {
    const statusDiv = document.getElementById('voteKickStatus');
    if (!statusDiv) return;
    
    const votesFor = Object.values(data.votes).filter(v => v === true).length;
    const votesAgainst = Object.values(data.votes).filter(v => v === false).length;
    
    const voters = Object.keys(data.votes).map(pid => {
        const p = gameState.players.find(pl => pl.id === parseInt(pid));
        const vote = data.votes[pid];
        return `<span style="font-size:11px;">${p?.name || '?'} ${vote ? '✅' : '❌'}</span>`;
    }).join(', ');
    
    statusDiv.innerHTML = `
        <div class="vote-kick-timer">⏱️ ${data.timeLeft || 0}s</div>
        <div>${tf('cli.vk_votes_full', { a: votesFor, b: data.requiredVotes, c: votesAgainst })}</div>
        <div style="font-size:10px; margin-top:4px;">${voters}</div>
    `;
}

function showKickSummary(data) {
    const summaryHtml = data.voteSummary.map(v => {
        const icon = v.vote ? tf('cli.uz') : tf('cli.pries');
        return `<div style="padding:4px 8px; background:rgba(255,255,255,0.2); border-radius:4px; margin:3px 0;">
            <strong>${v.playerName}</strong>: ${icon}
        </div>`;
    }).join('');
    
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(145deg, #2d1b1b, #1a0f0f);
        border: 3px solid #dc3545;
        border-radius: 16px;
        padding: 30px 40px;
        max-width: 500px;
        width: 90%;
        z-index: 100000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.9);
        text-align: center;
        color: #fff;
    `;
    
    popup.innerHTML = `
        <div style="font-size:60px; margin-bottom:10px;">🚫</div>
        <h2 style="color:#dc3545; margin-bottom:15px;">${tf('cli.vk_kicked_t')}</h2>
        <p style="margin-bottom:15px;">${tf('cli.vk_kicked_d')}</p>
        <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:10px; margin-bottom:15px; text-align:left;">
            <div style="font-weight:700; margin-bottom:8px;">${tf('cli.vk_results', { a: data.votesFor, b: data.requiredVotes })}</div>
            ${summaryHtml}
        </div>
        <p style="font-size:13px; color:#aaa; margin-bottom:15px;">${tf('cli.vk_watch')}</p>
        <button onclick="this.parentElement.remove();" style="
            padding:10px 30px;
            border:none;
            border-radius:8px;
            background:linear-gradient(145deg, #dc3545, #a71d2a);
            color:#fff;
            font-size:14px;
            font-weight:700;
            cursor:pointer;
        ">OK, SUPRASTAU</button>
    `;
    
    document.body.appendChild(popup);
}

// ============================================
// GARSO KONTROLĖ
// ============================================

function toggleSoundPanel() {
    const panel = document.getElementById('soundPanel');
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        updateSoundPanelVisibility();
        updateSoundModeRadios();
    } else {
        panel.style.display = 'none';
    }
    playClickSound();
}

function toggleMusicPanel() {
    const panel = document.getElementById('musicPanel');
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
    playClickSound();
}

function setSoundMode(mode) {
    soundMode = mode;
    localStorage.setItem('bancrupt_soundMode', mode);
    
    // Atnaujinti radio buttons
    document.querySelectorAll('input[name="soundMode"]').forEach(r => {
        r.checked = (r.value === mode);
    });
    
    // 🆕 Jei "off" – išjungti TIK efektus (ne muziką!)
    if (mode === 'off') {
        audioManager.isEnabled = false;
    } else {
        audioManager.isEnabled = true;
    }
    
    console.log(`🎧 Garso režimas: ${mode}`);
    playClickSound();
}

// 🆕 Atnaujinti radio buttons pagal esamą režimą
function updateSoundModeRadios() {
    document.querySelectorAll('input[name="soundMode"]').forEach(r => {
        r.checked = (r.value === soundMode);
    });
}

// 🆕 Atnaujinti garso panelę pagal serverio nustatymus
function updateSoundPanelVisibility() {
    const settings = window.serverSoundSettings;
    if (!settings) return;
    
    const advancedSection = document.getElementById('soundAdvancedSection');
    
    if (settings.player_control_enabled === true) {
        if (advancedSection) advancedSection.style.display = 'block';
        renderSoundLevels();
        console.log('🔊 Išplėstinė garso panelė rodoma');
    } else {
        if (advancedSection) advancedSection.style.display = 'none';
        console.log('🔇 Paprasta garso panelė');
    }
}

// 🆕 Atvaizduoti atskirų garsų sąrašą
function renderSoundLevels() {
    const container = document.getElementById('soundLevelsList');
    if (!container) return;
    
    const soundNames = {
        dice: tf('cli.kauliuku_metimas'),
        move: tf('cli.judejimas'),
        click: tf('cli.snd_click'),
        'your-turn': tf('cli.tavo_eile'),
        cash: tf('cli.pinigu_gavimas'),
        pay: tf('cli.pinigu_mokejimas'),
        pay1: tf('cli.nuomos_mokejimas'),
        'rent-received': tf('cli.snd_rent_received'),
        buy: tf('cli.snd_buy'),
        build: tf('cli.snd_build'),
        hotel: tf('cli.viesbutis'),
        demolish: tf('cli.snd_demolish'),
        tax: tf('cli.mokesciai'),
        latras: tf('cli.latru_baras'),
        pirtis: tf('cli.snd_pirtis'),
        hospital: tf('cli.ligonine'),
        birthday: tf('cli.snd_birthday'),
        chance: tf('cli.sansas'),
        special: tf('cli.snd_special'),
        dujos: tf('cli.snd_dujos'),
        siuksles: tf('cli.siuksles'),
        elektra: tf('cli.snd_elektra'),
        vanduo: tf('cli.snd_vanduo'),
        'air-port': tf('cli.snd_air_port'),
        train: tf('cli.traukiniu_stotis'),
        port: tf('cli.snd_port'),
        bus: tf('cli.autobusu_stotis'),
        spa: tf('cli.snd_spa'),
        baseinas: tf('cli.snd_baseinas'),
        papludimys: tf('cli.papludimys'),
        jail: tf('cli.kalejimas'),
        jail_in: tf('cli.kalejima'),
        jail_out: tf('cli.is_kalejimo'),
        trade: tf('cli.snd_trade'),
        auction: tf('cli.snd_auction'),
        start: tf('cli.snd_start'),
        'game-start': tf('cli.zaidimo_startas'),
        win: tf('cli.laimejimas'),
        celebrate: tf('cli.sventimas'),
        gameover: tf('cli.zaidimo_pabaiga'),
        bankrupt: tf('cli.snd_bankrupt'),
        notification: tf('cli.pranesimas'),
        error: tf('cli.snd_error')
    };
    
    let html = '';
    for (const [soundName, label] of Object.entries(soundNames)) {
        const level = audioManager.getSoundLevel(soundName);
        html += `
            <div style="margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:4px; margin-bottom:2px;">
                    <span style="font-size:10px; color:#fff; flex:1;">${label}</span>
                    <span id="level-${soundName}" style="font-size:9px; font-weight:700; color:#ffd700;">${level}</span>
                </div>
                <input type="range" min="0" max="10" value="${level}" 
                       oninput="changeSoundLevel('${soundName}', this.value)"
                       style="width:100%; cursor:pointer;">
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// 🆕 Keisti atskiro garso lygį
function changeSoundLevel(soundName, level) {
    audioManager.setSoundLevel(soundName, level);
    const levelEl = document.getElementById('level-' + soundName);
    if (levelEl) levelEl.textContent = level;
}

// 🆕 Atkurti standartą
function resetSoundSettings() {
    if (!confirm(tf('cli.atkurti_standartinius_garso_nustatymus'))) return;
    
    audioManager.soundLevels = {
        dice: 5, move: 5, click: 5, 'your-turn': 5,
        cash: 5, pay: 5, pay1: 5, 'rent-received': 5, buy: 5,
        build: 5, hotel: 5, demolish: 5,
        tax: 5, latras: 5, pirtis: 5, hospital: 5, birthday: 5, chance: 5, special: 5,
        dujos: 5, siuksles: 5, elektra: 5, vanduo: 5,
        'air-port': 5, train: 5, port: 5, bus: 5,
        spa: 5, baseinas: 5, papludimys: 5,
        jail: 5, jail_in: 5, jail_out: 5,
        trade: 5, auction: 5,
        start: 5, 'game-start': 5, win: 5, celebrate: 5,
        gameover: 5, bankrupt: 5, notification: 5, error: 5
    };
    audioManager.saveSoundLevels();
    
    renderSoundLevels();
    playClickSound();
    
    if (typeof addNotification === 'function') {
        showSmallNotice(tf('cli.garso_nustatymai_atkurti'));
    }
}

// 🆕 Išsaugoti garso nustatymus
function saveSoundSettings() {
    audioManager.saveSoundLevels();
    playClickSound();
    
    if (typeof addNotification === 'function') {
        showSmallNotice(tf('cli.garso_nustatymai_issaugoti'));
    }
}

function playSoundForPlayer(soundName, soundPlayerId = null, isPublicSound = false) {
    if (isPublicSound) {
        audioManager.play(soundName);
        return;
    }
    
    if (soundMode === 'all') {
        audioManager.play(soundName);
        return;
    }
    
    if (soundMode === 'my') {
        if (soundPlayerId === null || soundPlayerId === playerId) {
            audioManager.play(soundName);
        }
    }
}

function changeMusicVolume(value) {
    const volume = parseInt(value) / 100;
    audioManager.setMusicVolume(volume);
    
    const valueDisplay = document.getElementById('musicVolumeValue');
    if (valueDisplay) valueDisplay.textContent = value;
    
    localStorage.setItem('bancrupt_musicVolume', value);
}

function changeSfxVolume(value) {
    const volume = parseInt(value) / 100;
    audioManager.setSfxVolume(volume);
    
    const valueDisplay = document.getElementById('sfxVolumeValue');
    if (valueDisplay) valueDisplay.textContent = value;
    
    localStorage.setItem('bancrupt_sfxVolume', value);
    
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        if (volume === 0) {
            muteBtn.textContent = tf('cli.ijungti_garsa');
        } else {
            muteBtn.textContent = tf('cli.isjungti_garsa');
        }
    }
}

function toggleMute() {
    const slider = document.getElementById('sfxVolumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    
    if (!slider || !muteBtn) return;
    
    if (isMuted) {
        isMuted = false;
        const volume = lastVolume || 50;
        slider.value = volume;
        changeSfxVolume(volume);
        muteBtn.textContent = tf('cli.isjungti_garsa');
    } else {
        isMuted = true;
        lastVolume = parseInt(slider.value) || 50;
        slider.value = 0;
        changeSfxVolume(0);
        muteBtn.textContent = tf('cli.ijungti_garsa');
    }
    playClickSound();
}

// ============================================
// INFO REŽIMAS
// ============================================

function toggleInfoMode() {
    infoMode = !infoMode;
    
    const btn = document.getElementById('infoBtn');
    const infoPanel = document.getElementById('cellInfoPanel');
    
    if (infoMode) {
        btn.classList.add('active');
        btn.innerHTML = t('game.leftPanel.infoOn');
        localStorage.setItem('bancrupt_infoMode', 'true');
        
        if (infoPanel) infoPanel.classList.add('show');
        
        if (lastHoveredField !== null) {
            showCellInfo(lastHoveredField);
        } else {
            hideCellInfo();
        }
    } else {
        btn.classList.remove('active');
        btn.innerHTML = t('game.leftPanel.info');
        localStorage.setItem('bancrupt_infoMode', 'false');
        
        if (infoPanel) infoPanel.classList.remove('show');
        hideCellInfo();
    }
    
    playClickSound();
}

// 🌐 Langelio pavadinimas pasirinkta kalba (cell.<id>.name), kitaip – originalus
function i18nCellName(f) {
    if (!f) return '';
    const k = `cell.${f.id}.name`;
    const v = (typeof t === 'function') ? t(k) : k;
    return (v && v !== k) ? v : f.name;
}

function showCellInfo(fieldId) {
    if (!infoMode) return;
    if (!gameState) return;
    
    lastHoveredField = fieldId;
    
    const tooltip = document.getElementById('cellInfoTooltip');
    if (!tooltip) return;
    
    const field = gameState.board.find(f => f.id === fieldId);
    if (!field) {
        hideCellInfo();
        return;
    }
    
    const owner = gameState.players.find(p => p.properties.includes(fieldId) && !p.bankrupt && !p.left && !p.kicked);
    
    const translationKey = `cell.${field.id}.name`;
const translated = t(translationKey);
const infoName = (translated && translated !== translationKey) ? translated : field.name;
let html = `<div class="info-header">${field.icon || ''} ${infoName} (#${fieldId})</div>`;
    
    if (owner) {
        html += `
            <div class="info-row">
                <span class="label">${tf('cli.i_owner')}</span>
                <span class="value" style="color:${owner.color};">${owner.name}</span>
            </div>
        `;
    } else if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">${tf('cli.i_owner')}</span>
                <span class="value green">${tf('cli.i_free')}</span>
            </div>
        `;
    }
    
    if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">${tf('cli.i_price')}</span>
                <span class="value">€${field.cost}</span>
            </div>
        `;
    }
    
    if (field.type === 'property' && field.color) {
        const baseRent = Math.round(field.cost * 0.10);
        const fullGroupRent = Math.round(field.cost * 0.20);
        const rent1 = Math.round(field.cost * 1.00);
        const rent2 = Math.round(field.cost * 2.00);
        const rent3 = Math.round(field.cost * 3.00);
        const rent4 = Math.round(field.cost * 4.00);
        const rentHotel = Math.round(field.cost * 5.00);
        
        html += `<div class="info-section"><div class="info-section-title">${tf('cli.i_rent_h')}</div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_one_plot')}</span><span class="value">€${baseRent}</span></div>`;
        html += tf('cli.pilna_gatve', { fullGroupRent });
        html += `<div class="info-row"><span class="label">${tf('cli.i_h1')}</span><span class="value">€${rent1}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h2')}</span><span class="value">€${rent2}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h3')}</span><span class="value">€${rent3}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h4')}</span><span class="value">€${rent4}</span></div>`;
        html += tf('cli.viesbutis_2', { rentHotel });
        html += `</div>`;
    }
    
    // 🆕 SERVICE grupės (1, 2, 3) — rodo grupės narius + savininkus
    if (field.type === 'service1' || field.type === 'service2' || field.type === 'service3' || 
        SERVICE1_IDS.includes(field.id) || SERVICE2_IDS.includes(field.id) || SERVICE3_IDS.includes(field.id)) {
        
        // Nustatyti, kuri grupė
        let groupIds = [];
        let groupName = '';
        
        if (SERVICE1_IDS.includes(field.id) || field.type === 'service1') {
            groupIds = SERVICE1_IDS;
            groupName = 'SERVICE 1';
        } else if (SERVICE2_IDS.includes(field.id) || field.type === 'service2') {
            groupIds = SERVICE2_IDS;
            groupName = 'SERVICE 2';
        } else {
            groupIds = SERVICE3_IDS;
            groupName = 'SERVICE 3';
        }
        
        // Grupės pavadinimas (pagal pirmą langelį)
        const firstField = gameState.board.find(x => x.id === groupIds[0]);
        if (firstField) groupName = i18nCellName(firstField);
        
        // Grupės nariai
        const groupFields = groupIds.map(id => {
            const f = gameState.board.find(x => x.id === id);
            const o = gameState.players.find(p => p.properties.includes(id) && !p.bankrupt && !p.left && !p.kicked);
            return { id, field: f, owner: o };
        });
        
        const ownedInGroup = owner ? owner.properties.filter(id => groupIds.includes(id)).length : 0;
        const currentRent = SERVICE_RENT[ownedInGroup] || SERVICE_RENT[1];
        
        // 🆕 Grupės nariai su savininkais
        html += tf('cli.grupe', { groupName });
        groupFields.forEach(({ id, field: f, owner: o }) => {
            if (!f) return;
            
            const ownerText = o ? `<span style="color:${o.color}; font-weight:700;">${o.name}</span>` : '<span class="value green">' + tf('cli.i_free') + '</span>';
            
            html += `
                <div class="info-row" style="font-size:10px;">
                    <span class="label">#${id} ${i18nCellName(f)}:</span>
                    <span class="value">${ownerText}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        // 🆕 Nuomos lentelė
        html += `<div class="info-section"><div class="info-section-title">${tf('cli.i_rent_s')}</div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_owns', { n: ownedInGroup })}</span><span class="value green">€${currentRent}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c1')}</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c2')}</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c3')}</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c4')}</span><span class="value">€200</span></div>`;
        html += `</div>`;
    }
    
    if (field.type === 'tax') {
        if (field.id === 5) {
    html += `<div class="info-section"><div class="info-row"><span class="label">${tf('cli.i_tax')}</span><span class="value red">€100</span></div></div>`;
        } else if (field.id === 21) {
            html += `<div class="info-section"><div class="info-row"><span class="label">${tf('cli.i_tax')}</span><span class="value red">€10</span></div></div>`;
        } else {
            html += `<div class="info-section"><div class="info-row"><span class="label">${tf('cli.i_tax')}</span><span class="value red">€${field.cost}</span></div></div>`;
        }
    }
    
    if (field.type === 'special') {
    if (field.id === 13) {
        html += tf('cli.sumokesi_50');
    } else if (field.id === 4) {
        html += `<div class="info-section"><div class="info-row"><span class="label">${tf('cli.i_get_dice')}</span><span class="value green">+€200</span></div></div>`;
    } else if (field.id === 50) {   // 🆕 GIMTADIENIS
        html += `<div class="info-section"><div class="info-row"><span class="label">${tf('cli.i_get_bday')}</span><span class="value green">+€200</span></div></div>`;
    }
}
    
    setTooltipContent(tooltip, html);
    
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    
    const cell = document.getElementById(`cell-${fieldId}`);
    if (!cell) return;
    
    const cellRect = cell.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    const boardRect = document.getElementById('board').getBoundingClientRect();
    const boardCenterX = boardRect.left + boardRect.width / 2;
    const boardCenterY = boardRect.top + boardRect.height / 2;
    
    const cellCenterX = cellRect.left + cellRect.width / 2;
    const cellCenterY = cellRect.top + cellRect.height / 2;
    
    let top, left;
    
    if (cellCenterX < boardCenterX) {
        left = cellRect.right + 10;
    } else {
        left = cellRect.left - tooltipWidth - 10;
    }
    
    if (cellCenterY < boardCenterY) {
        top = cellRect.top;
    } else {
        top = cellRect.bottom - tooltipHeight;
    }
    
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltipHeight - 10;
    }
    
    // 🔄 Pasuktame režime ekrano koordinatės nesutampa – rodom per vidurį
    if (document.body.classList.contains('force-rot')) {
        const v = viewSize();
        left = Math.max(10, (v.w - tooltipWidth) / 2);
        top = Math.max(10, (v.h - tooltipHeight) / 2);
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// ✅ Info lango turinys keičiamas taip, kad ✕ mygtukas visada liktų kampe
let cellInfoCloseBtnRef = null;
function setTooltipContent(tooltip, html) {
    if (!cellInfoCloseBtnRef) {
        cellInfoCloseBtnRef = document.getElementById('cellInfoCloseBtn');
    }
    tooltip.innerHTML = html;
    if (cellInfoCloseBtnRef) {
        tooltip.appendChild(cellInfoCloseBtnRef);
    }
}

function hideCellInfo() {
    lastHoveredField = null;
    const tooltip = document.getElementById('cellInfoTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        setTooltipContent(tooltip, '');
    }
}

// ============================================
// PREKYBOS MINI KORTELĖS
// ============================================

function renderMiniCardForTrade(field, options = {}) {
    const {
        selected = false,
        showCheckbox = false,
        showRadio = false,
        fieldId = field.id,
        onClick = null,
        houses = 0
    } = options;
    
    const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
    const color = field.color || '#c9a84c';
    const icon = field.icon || '';
    
    let houseIcon = '';
    if (houses >= 5) houseIcon = '🏨';
    else if (houses > 0) {
        for (let i = 0; i < houses; i++) houseIcon += '🏠';
    }
    
    const topBar = isService 
        ? `<div class="mini-card-color mini-card-icon" style="background:transparent; display:flex; align-items:center; justify-content:center; font-size:16px;">${icon}</div>`
        : `<div class="mini-card-color" style="background:${color};"></div>`;
    
    return `
        <div class="mini-card ${selected ? 'selected' : ''}" 
             data-field-id="${fieldId}" 
             title="${field.name} • €${field.cost}"
             ${onClick ? `onclick="${onClick}"` : ''}>
            ${topBar}
            <div class="mini-card-body">
                <div class="mini-card-name">${field.name}</div>
                <div class="mini-card-info">€${field.cost}</div>
                ${houseIcon ? `<div class="mini-card-houses">${houseIcon}</div>` : ''}
            </div>
            ${showCheckbox ? `<input type="checkbox" ${selected ? 'checked' : ''} style="position:absolute; top:2px; right:2px; width:14px; height:14px; z-index:10;">` : ''}
            ${showRadio ? `<input type="radio" ${selected ? 'checked' : ''} style="position:absolute; top:2px; right:2px; width:14px; height:14px; z-index:10;">` : ''}
        </div>
    `;
}

function initTradeMiniCardTooltips() {
    document.querySelectorAll('.trade-mini-cards .mini-card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const fieldId = parseInt(card.dataset.fieldId);
            if (!fieldId && fieldId !== 0) return;
            
            showMiniCardTooltip(fieldId, card);
        });
        
        card.addEventListener('mouseleave', () => {
            hideMiniCardTooltip();
        });
    });
}

function initMiniCardTooltips() {
    document.querySelectorAll('.mini-card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const fieldId = parseInt(card.dataset.fieldId);
            if (!fieldId && fieldId !== 0) return;
            
            showMiniCardTooltip(fieldId, card);
        });
        
        card.addEventListener('mouseleave', () => {
            hideMiniCardTooltip();
        });
    });
}

function showMiniCardTooltip(fieldId, cardElement) {
    if (!infoMode) return;
    if (!gameState) return;
    
    const tooltip = document.getElementById('cellInfoTooltip');
    if (!tooltip) return;
    
    const field = gameState.board.find(f => f.id === fieldId);
    if (!field) return;
    
    const owner = gameState.players.find(p => p.properties.includes(fieldId) && !p.bankrupt && !p.left && !p.kicked);
    
    // 🆕 Naudoti vertimą pagal kalbą, jei yra
const translationKey = `cell.${field.id}.name`;
const translated = t(translationKey);
const infoName = (translated && translated !== translationKey) ? translated : field.name;
let html = `<div class="info-header">${field.icon || ''} ${infoName} (#${fieldId})</div>`;
    
    if (owner) {
        html += `
            <div class="info-row">
                <span class="label">${tf('cli.i_owner')}</span>
                <span class="value" style="color:${owner.color};">${owner.name}</span>
            </div>
        `;
    }
    
    if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">${tf('cli.i_price')}</span>
                <span class="value">€${field.cost}</span>
            </div>
        `;
    }
    
    if (field.type === 'property' && field.color) {
        const baseRent = Math.round(field.cost * 0.10);
        const fullGroupRent = Math.round(field.cost * 0.20);
        const rent1 = Math.round(field.cost * 1.00);
        const rent2 = Math.round(field.cost * 2.00);
        const rent3 = Math.round(field.cost * 3.00);
        const rent4 = Math.round(field.cost * 4.00);
        const rentHotel = Math.round(field.cost * 5.00);
        
        html += `<div class="info-section"><div class="info-section-title">${tf('cli.i_rent_h')}</div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_one_plot')}</span><span class="value">€${baseRent}</span></div>`;
        html += tf('cli.pilna_gatve', { fullGroupRent });
        html += `<div class="info-row"><span class="label">${tf('cli.i_h1')}</span><span class="value">€${rent1}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h2')}</span><span class="value">€${rent2}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h3')}</span><span class="value">€${rent3}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_h4')}</span><span class="value">€${rent4}</span></div>`;
        html += tf('cli.viesbutis_2', { rentHotel });
        html += `</div>`;
    }
    
    // 🆕 SERVICE grupės
    if (field.type === 'service1' || field.type === 'service2' || field.type === 'service3' ||
        SERVICE1_IDS.includes(field.id) || SERVICE2_IDS.includes(field.id) || SERVICE3_IDS.includes(field.id)) {
        
        let groupIds = [];
        let groupName = '';
        
        if (SERVICE1_IDS.includes(field.id) || field.type === 'service1') {
            groupIds = SERVICE1_IDS;
            groupName = 'SERVICE 1';
        } else if (SERVICE2_IDS.includes(field.id) || field.type === 'service2') {
            groupIds = SERVICE2_IDS;
            groupName = 'SERVICE 2';
        } else {
            groupIds = SERVICE3_IDS;
            groupName = 'SERVICE 3';
        }
        
        const firstField = gameState.board.find(x => x.id === groupIds[0]);
        if (firstField) groupName = i18nCellName(firstField);
        
        const groupFields = groupIds.map(id => {
            const f = gameState.board.find(x => x.id === id);
            const o = gameState.players.find(p => p.properties.includes(id) && !p.bankrupt && !p.left && !p.kicked);
            return { id, field: f, owner: o };
        });
        
        const ownedInGroup = owner ? owner.properties.filter(id => groupIds.includes(id)).length : 0;
        const currentRent = SERVICE_RENT[ownedInGroup] || SERVICE_RENT[1];
        
        html += tf('cli.grupe', { groupName });
        groupFields.forEach(({ id, field: f, owner: o }) => {
            if (!f) return;
            
            const ownerText = o ? `<span style="color:${o.color}; font-weight:700;">${o.name}</span>` : '<span class="value green">' + tf('cli.i_free') + '</span>';
            
            html += `
                <div class="info-row" style="font-size:10px;">
                    <span class="label">#${id} ${i18nCellName(f)}:</span>
                    <span class="value">${ownerText}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        html += `<div class="info-section"><div class="info-section-title">${tf('cli.i_rent_s')}</div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_owns', { n: ownedInGroup })}</span><span class="value green">€${currentRent}</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c1')}</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c2')}</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c3')}</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">${tf('cli.i_c4')}</span><span class="value">€200</span></div>`;
        html += `</div>`;
    }
    
    setTooltipContent(tooltip, html);
    tooltip.style.display = 'block';
    
    const rect = cardElement.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 10;
    
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
    }
    if (top < 10) {
        top = rect.bottom + 10;
    }
    
    // 🔄 Pasuktame režime ekrano koordinatės nesutampa – rodom per vidurį
    if (document.body.classList.contains('force-rot')) {
        const v = viewSize();
        left = Math.max(10, (v.w - tooltipWidth) / 2);
        top = Math.max(10, (v.h - tooltipHeight) / 2);
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function hideMiniCardTooltip() {
    const tooltip = document.getElementById('cellInfoTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        setTooltipContent(tooltip, '');
    }
}

// ============================================
// PRANEŠIMAI
// ============================================

function showPopupMessage(message, type) {
    if (!message || typeof message !== 'string') return;
    // Nuoma, mokesčiai, gimtadienis rodomi per fieldResult – čia nekartojam
    if (/nuomos|mokesčių|LATRŲ|PIRT|gimtadien/i.test(message)) return;
    let popupType = 'info';
    let dedupeKey = message;
    if (/bankrot|pabėgo/i.test(message)) { popupType = 'bankrupt'; dedupeKey = 'bankrupt-event'; }
    else if (/skoling/i.test(message)) popupType = 'tax';
    else if (/aukcion/i.test(message)) popupType = 'auction';
    else if (/prekyb|pasiūl/i.test(message)) popupType = 'trade';
    else if (/nugriov/i.test(message)) popupType = 'visit';
    cell5Enqueue({ type: popupType, text: escapeHtml(message), dedupeKey: dedupeKey });
}

function addNotification(msg) {
    const container = document.getElementById('notifications');
    if (!container) return;
    const time = new Date().toLocaleTimeString();
    container.innerHTML += `<div class="notification-item"><span class="ntime">${time}</span> ${msg}</div>`;
    container.scrollTop = container.scrollHeight;
    if (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}

function showLobbyMessage(msg, color) {
    const el1 = document.getElementById('createMessages');
    const el2 = document.getElementById('joinMessages');
    if (el1) el1.innerHTML = `<span style="color:${color || '#d4b896'}">${msg}</span>`;
    if (el2) el2.innerHTML = `<span style="color:${color || '#d4b896'}">${msg}</span>`;
}

function createGame() {
    const name = document.getElementById('createPlayerName').value.trim();
    if (!name) {
        alert(tf('cli.ivesk_savo_varda'));
        playErrorSound();
        return;
    }
    if (!isConnected) {
        alert(tf('cli.nera_rysio_su_serveriu_2'));
        playErrorSound();
        return;
    }
    playClickSound();
    
    clearJournal();
    clearChat();  // 🆕 IŠVALYTI CHAT
    
    const isPublicCheckbox = document.getElementById('createIsPublic');
    const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;
    
    // 🆕 Gauti userId iš localStorage
    let userId = null;
    const userStr = localStorage.getItem('bancrupt_user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            userId = user.userId;
        } catch (e) {
            console.warn('⚠️ Nepavyko perskaityti user:', e);
        }
    }

    socket.emit('createGame', {
        name: name,
        color: selectedCreateColor,
        isPublic: isPublic,
        userId: userId
    });
}

function joinGame() {
    const name = document.getElementById('joinPlayerName').value.trim();
    const gid = document.getElementById('gameIdInput').value.trim().toUpperCase();
    if (!name) {
        alert(tf('cli.ivesk_savo_varda'));
        playErrorSound();
        return;
    }
    if (!gid) {
        alert(tf('cli.ivesk_zaidimo_koda'));
        playErrorSound();
        return;
    }
    if (!isConnected) {
        alert(tf('cli.nera_rysio_su_serveriu_2'));
        playErrorSound();
        return;
    }
    
    if (!selectedJoinColor) {
        alert(tf('cli.pasirink_savo_spalva'));
        playErrorSound();
        return;
    }
    
    gameId = gid;
    playClickSound();
    
    clearJournal();
    clearChat();  // 🆕 IŠVALYTI CHAT
    
    // 🆕 Gauti userId iš localStorage
    let userId = null;
    const userStr = localStorage.getItem('bancrupt_user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            userId = user.userId;
        } catch (e) {
            console.warn('⚠️ Nepavyko perskaityti user:', e);
        }
    }
    
    socket.emit('joinGame', { 
        gameId: gid, 
        playerName: name,
        color: selectedJoinColor,
        userId: userId
    });
}

function enterGame() {
    if (typeof goToGame === 'function') {
        goToGame();
    }
    
    // 🌐 Paslėpti viršutinį kalbos pasirinkimą žaidimo lange
    const topLangSwitcher = document.getElementById('langSwitcher');
    if (topLangSwitcher) {
        topLangSwitcher.style.display = 'none';
    }
    
    clearChat();  // 🆕 IŠVALYTI CHAT PRIEŠ ĮEINANT
    loadJournalFromStorage();

    const savedSoundMode = localStorage.getItem('bancrupt_soundMode') || 'my';
soundMode = savedSoundMode;

// 🔊 Garsas (efektams) – atskirai
if (soundMode === 'off') {
    audioManager.isEnabled = false;
} else {
    audioManager.isEnabled = true;
}

// 🎵 Muzika – ATSKIRAI!
const savedMusicSetting = localStorage.getItem('bancrupt_music');
if (savedMusicSetting === 'false') {
    audioManager.isMusicEnabled = false;
} else {
    audioManager.isMusicEnabled = true;
}
    
    if (gameState && gameState.players && gameState.players.length > 0) {
        gameState.players.forEach(p => {
            if (!window.gameStats.players[p.id]) {
                initPlayerStats(p.id, p.name, p.color);
            }
        });
    }
    
    document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
    
    const gameIdLeft = document.getElementById('gameIdDisplayLeft');
    if (gameIdLeft) gameIdLeft.textContent = gameId;
    
    const savedMusicVolume = localStorage.getItem('bancrupt_musicVolume') || 5;
    const savedSfxVolume = localStorage.getItem('bancrupt_sfxVolume') || 10;
    
    const musicSlider = document.getElementById('musicVolumeSlider');
    const sfxSlider = document.getElementById('sfxVolumeSlider');
    const musicValueDisplay = document.getElementById('musicVolumeValue');
    const sfxValueDisplay = document.getElementById('sfxValueValue');
    
    if (musicSlider) musicSlider.value = savedMusicVolume;
    if (sfxSlider) sfxSlider.value = savedSfxVolume;
    if (musicValueDisplay) musicValueDisplay.textContent = savedMusicVolume;
    if (sfxValueDisplay) sfxValueDisplay.textContent = savedSfxVolume;
    
    changeMusicVolume(savedMusicVolume);
    changeSfxVolume(savedSfxVolume);
    
    // 🎵 Muzika – atskirai
const savedMusic = localStorage.getItem('bancrupt_music');

if (savedMusic === 'false') {
    // Muzika buvo išjungta
    audioManager.isMusicEnabled = false;
    backgroundMusicStarted = false;
    if (typeof loadMusicButtonState === 'function') {
        setTimeout(loadMusicButtonState, 100);
    }
} else {
    // Muzika įjungta – grok po pirmo paspaudimo
    audioManager.isMusicEnabled = true;
    
    const startMusicOnFirstInteraction = () => {
        if (audioManager.isMusicEnabled) {
            startBackgroundMusic();
        }
        if (typeof loadMusicButtonState === 'function') {
            loadMusicButtonState();
        }
        
        document.removeEventListener('click', startMusicOnFirstInteraction);
        document.removeEventListener('keydown', startMusicOnFirstInteraction);
        document.removeEventListener('touchstart', startMusicOnFirstInteraction);
    };
    
    document.addEventListener('click', startMusicOnFirstInteraction, { once: true });
    document.addEventListener('keydown', startMusicOnFirstInteraction, { once: true });
    document.addEventListener('touchstart', startMusicOnFirstInteraction, { once: true });
}
    
    // 🆕 TELEFONE – IŠJUNGTA, KOMPIUTERYJE – ĮJUNGTI
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

if (isMobile) {
    infoMode = false;
    localStorage.setItem('bancrupt_infoMode', 'false');
    console.log('📱 Telefonas – info režimas IŠJUNGTAS');
} else {
    infoMode = true;
    localStorage.setItem('bancrupt_infoMode', 'true');
    console.log('💻 Kompiuteris – info režimas ĮJUNGTAS');
}

const btn = document.getElementById('infoBtn');
const infoPanel = document.getElementById('cellInfoPanel');

if (infoMode) {
    if (btn) {
        btn.classList.add('active');
        btn.innerHTML = t('game.leftPanel.infoOn');
    }
    if (infoPanel) infoPanel.classList.add('show');
} else {
    if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = t('game.leftPanel.info');
    }
    if (infoPanel) infoPanel.classList.remove('show');
}

// Paleisti info šriftų pritaikymą
setTimeout(autoFitInfoFont, 200);
    
    socket.emit('getGameState');
    
    setTimeout(() => {
        if (gameState && gameState.gameStarted) {
            hideWaitingRoom();
            return;
        }
        
        socket.emit('getWaitingRoom');
        showWaitingRoom();
    }, 300);
    
    setTimeout(initInfoResizeObserver, 1000);
    setTimeout(loadSoundButtonState, 100);
    setTimeout(loadSoundVolumeSlider, 100);
    setTimeout(loadMusicButtonState, 100);          // 🆕
    setTimeout(loadMusicVolumeSliderSimple, 100);   // 🆕
}


// ============================================
// 🆕 KAIRĖS PANELĖS PASLĖPIMAS / PARODYMAS
// ============================================
// ◀ mygtukas – prie dešinio panelės krašto (kompiuteryje)
function placeLeftPanelToggle() {
    const panel = document.getElementById('leftPanel');
    if (!panel || document.body.classList.contains('cmp')) return;
    const r = panel.getBoundingClientRect();
    if (r.width) document.documentElement.style.setProperty('--lp-right', Math.round(r.right) + 'px');
}
window.addEventListener('resize', () => setTimeout(placeLeftPanelToggle, 50));
setInterval(placeLeftPanelToggle, 1500);
function toggleLeftPanel() {
    const panel = document.getElementById('leftPanel');
    const btn = document.getElementById('leftPanelToggle');
    
    if (!panel || !btn) return;

    // 📱 Telefone / planšetėje panelė atsidaro virš lentos ir nekeičia išsaugotos būsenos
    if (document.body.classList.contains('cmp')) {
        const open = document.body.classList.toggle('lp-open');
        btn.innerHTML = open ? '◀' : '▶';
        btn.title = open ? tf('cli.slepti_panele') : tf('cli.parodyti_panele');
        if (typeof playClickSound === 'function') playClickSound();
        return;
    }

    const isHidden = panel.classList.toggle('hidden');
    
    if (isHidden) {
        // Paslėpti
        btn.innerHTML = '▶';
        btn.title = tf('cli.parodyti_panele');
        localStorage.setItem('bancrupt_leftPanelHidden', 'true');
        console.log('📋 Kairė panelė paslėpta');
    } else {
        // Parodyti
        btn.innerHTML = '◀';
        btn.title = tf('cli.slepti_panele');
        localStorage.setItem('bancrupt_leftPanelHidden', 'false');
        console.log('📋 Kairė panelė parodyta');
    }
    
    if (typeof playClickSound === 'function') {
        playClickSound();
    }
}

// 🆕 Įkelti būseną paleidus
function loadLeftPanelState() {
    const panel = document.getElementById('leftPanel');
    const btn = document.getElementById('leftPanelToggle');
    
    if (!panel || !btn) return;
    
    const isHidden = localStorage.getItem('bancrupt_leftPanelHidden') === 'true';
    
    if (isHidden) {
        panel.classList.add('hidden');
        btn.innerHTML = '▶';
        btn.title = tf('cli.parodyti_panele');
    } else {
        panel.classList.remove('hidden');
        btn.innerHTML = '◀';
        btn.title = tf('cli.slepti_panele');
    }
}

// 🆕 Paleisti įkėlus
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadLeftPanelState, 500);
});



// 🚪 Žaidimo metu pasitraukti galima tik bankrotuojant (mygtukas „Bankrotuoju“).
// Iškritęs žaidėjas (bankrutavęs / pašalintas) šiuo mygtuku grįžta į meniu.
function leaveGame() {
    if (!isConnected || !socket || !socket.connected) {
        alert(tf('cli.nera_rysio_su_serveriu'));
        playErrorSound();
        return;
    }
    const out = myPlayer && (myPlayer.bankrupt || myPlayer.kicked || myPlayer.left);
    if (gameState && gameState.gameStarted && !out) {
        // Dar žaidžia – siūlom bankrotuoti
        bankrupt();
        return;
    }
    playClickSound();
    socket.emit('leaveGame');
}

function updateExitButton() {
    const btn = document.getElementById('leaveBtn');
    if (!btn) return;
    const out = myPlayer && (myPlayer.bankrupt || myPlayer.kicked || myPlayer.left);
    btn.style.display = out ? '' : 'none';
}

// ⏸️ AFK juosta: „Tavo ėjimai daromi automatiškai – Aš čia!“
const afkUi = { until: 0, srcMs: null, tick: null };
function updateAfkBanner() {
    let banner = document.getElementById('afkBanner');
    const afk = myPlayer && !myPlayer.bankrupt && !myPlayer.left && !myPlayer.kicked &&
                gameState && gameState.gameStarted && (myPlayer.afkAutoMoves || 0) > 0;
    if (!afk) {
        if (banner) banner.style.display = 'none';
        return;
    }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'afkBanner';
        banner.innerHTML = `<span id="afkBannerText"></span>
            <button id="afkBackBtn" type="button"></button>`;
        document.body.appendChild(banner);
        document.getElementById('afkBackBtn').onclick = () => {
            if (socket) socket.emit('imBack');
            banner.style.display = 'none';
            playClickSound();
        };
    }
    // Kiek liko iki AFK bankroto (serveris siunčia afkMsLeft; tarp atnaujinimų skaičiuojam patys)
    if (typeof myPlayer.afkMsLeft === 'number') {
        if (afkUi.srcMs !== myPlayer.afkMsLeft) { afkUi.srcMs = myPlayer.afkMsLeft; afkUi.until = Date.now() + myPlayer.afkMsLeft; }
    } else { afkUi.srcMs = null; afkUi.until = Date.now() + 10 * 60 * 1000; }
    const renderLeft = () => {
        const el = document.getElementById('afkBannerText');
        if (!el) return;
        const ms = Math.max(0, afkUi.until - Date.now());
        const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
        el.textContent = tt('game.afk.banner', '⏸️ Tu AFK – tavo ėjimai daromi automatiškai. Iki bankroto liko: {n}').replace('{n}', m + ':' + String(s).padStart(2, '0'));
    };
    renderLeft();
    clearInterval(afkUi.tick);
    afkUi.tick = setInterval(() => {
        const b = document.getElementById('afkBanner');
        if (!b || b.style.display === 'none') { clearInterval(afkUi.tick); return; }
        renderLeft();
    }, 1000);
    document.getElementById('afkBackBtn').textContent = tt('game.afk.back', '✋ Aš čia!');
    banner.style.display = 'flex';
}

// ============================================
// 👥 4 LANGELIS: visi žaidėjai telpa be slinkimo (iki 8)
// ============================================
function fitPlayersList() {
    const list = document.getElementById('playersList');
    if (!list) return;
    const n = list.children.length;
    if (!n) return;
    list.classList.remove('pl-2col');
    const h = list.clientHeight;
    if (!h) return;
    const w = list.clientWidth || 200;
    const gap = h < 140 ? 2 : 3;
    // 1 stulpelis
    const rowH1 = (h - gap * (n - 1)) / n;
    const font1 = Math.min(18, rowH1 * 0.6, w / 13);
    // 2 stulpeliai (kai žaidėjų daug, o langelis žemas – pvz. gulsčias telefonas)
    let cols = 1, rowH = rowH1, font = font1;
    if (n > 4) {
        const rows = Math.ceil(n / 2);
        const rowH2 = (h - gap * (rows - 1)) / rows;
        const font2 = Math.min(18, rowH2 * 0.6, (w / 2 - gap) / 11);
        if (font2 > font1 + 0.5) { cols = 2; rowH = rowH2; font = font2; }
    }
    font = Math.max(5, font);
    list.classList.toggle('pl-2col', cols === 2);
    list.style.setProperty('--pl-font', font.toFixed(1) + 'px');
    list.style.setProperty('--pl-dot', Math.max(5, Math.min(18, font * 1.05)).toFixed(1) + 'px');
    list.style.setProperty('--pl-row', Math.max(1, Math.min(rowH, font * 2.6)).toFixed(1) + 'px');
    list.style.setProperty('--pl-gap', gap + 'px');
}

(function initPlayersListFit() {
    const start = () => {
        const cell = document.getElementById('center-4');
        if (!cell) return;
        if (window.ResizeObserver) {
            new ResizeObserver(() => fitPlayersList()).observe(cell);
        }
        window.addEventListener('resize', fitPlayersList);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

// ============================================
// 📱 TELEFONAS / PLANŠETĖ: lenta prisitaiko prie ekrano be slinkimo
// ============================================
// 🧊 Stalo vaizdas: 2D (tiesiai), 3D (pasvirusi lenta), 3D+ (laisvai sukiojama lenta)
const BOARD_VIEW_KEY = 'bancrupt_boardView';
function getBoardView() {
    let v = '2d';
    try { v = localStorage.getItem(BOARD_VIEW_KEY) || '2d'; } catch (e) {}
    return (v === '3d' || v === '3dp') ? v : '2d';
}
function applyBoardView() {
    const view = getBoardView();
    document.body.classList.toggle('board-3d', view === '3d');
    document.body.classList.toggle('board-3dp', view === '3dp');
    if (view === '3dp') orbitStart(); else orbitStop();
    setTimeout(placeDiceShadows, 50);
    const header = document.getElementById('gameHeader');
    if (!header) return;
    let sw = document.getElementById('boardViewSwitch');
    if (!sw) {
        sw = document.createElement('span');
        sw.id = 'boardViewSwitch';
        sw.innerHTML = '<button type="button" data-v="2d" title="' + escapeHtml(tt('game.view2d', '2D – plokščias vaizdas')) + '">2D</button>' +
            '<button type="button" data-v="3d" title="' + escapeHtml(tt('game.view3d', '3D – pakreiptas vaizdas')) + '">3D</button>' +
            '<button type="button" data-v="3dp" title="' + escapeHtml(tt('game.view3dp', '3D+ – vaizdą galima sukti tempiant pele ar pirštu')) + '">3D+</button>' +
            '<button type="button" class="bv-reset" title="' + escapeHtml(tt('game.viewReset', 'Atstatyti vaizdą')) + '">⟲</button>';
        sw.title = tt('game.boardView', 'Stalo vaizdas');
        sw.querySelectorAll('button[data-v]').forEach(b => b.onclick = () => setBoardView(b.dataset.v));
        sw.querySelector('.bv-reset').onclick = () => { orbitReset(true); if (typeof playClickSound === 'function') playClickSound(); };
        const slot = document.getElementById('lpViewSlot');   // ⚙️ Nustatymuose (kairėje panelėje)
        if (slot) slot.appendChild(sw);
        else {
            const idEl = document.getElementById('gameIdDisplay');
            if (idEl && idEl.nextSibling) header.insertBefore(sw, idEl.nextSibling);
            else header.appendChild(sw);
        }
    }
    sw.querySelectorAll('button[data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === view));
    renderCameraButton();
}
function setBoardView(v) {
    try { localStorage.setItem(BOARD_VIEW_KEY, (v === '3d' || v === '3dp') ? v : '2d'); } catch (e) {}
    if (typeof playClickSound === 'function') playClickSound();
    applyBoardView();
    if (v === '3dp' && !orbit.hinted) {
        orbit.hinted = true;
        if (typeof showSmallNotice === 'function') {
            showSmallNotice(tt('game.boardView3dpHint', '🖐️ Tempk lentą, kad pasuktum • ratukas / 2 pirštai – priartinti • ⟲ – atstatyti'));
        }
    }
}

// ---- 3D+ : lentos sukiojimas pele / pirštu, su inercija ir lengvu siūbavimu ----
const orbit = {
    on: false, rx: 28, rz: 0, sc: 0.92,          // pasvirimas, pasukimas, mastelis
    vx: 0, vz: 0, drag: null, moved: false, raf: 0, t0: 0, lastInput: 0, pinch: null, hinted: false,
    bound: false
};
const ORBIT_DEFAULT = { rx: 28, rz: 0, sc: 0.92 };
function orbitLoad() {
    try {
        const v = JSON.parse(localStorage.getItem('bancrupt_orbit') || 'null');
        if (v && isFinite(v.rx) && isFinite(v.rz) && isFinite(v.sc)) { orbit.rx = v.rx; orbit.rz = v.rz; orbit.sc = v.sc; }
    } catch (e) {}
}
function orbitSave() {
    try { localStorage.setItem('bancrupt_orbit', JSON.stringify({ rx: orbit.rx, rz: orbit.rz, sc: orbit.sc })); } catch (e) {}
}
function orbitClamp() {
    orbit.rx = Math.max(0, Math.min(65, orbit.rx));
    orbit.sc = Math.max(0.45, Math.min(1.35, orbit.sc));
    orbit.rz = ((orbit.rz + 540) % 360) - 180;
}
function orbitApply(now) {
    const board = document.getElementById('board');
    if (!board) return;
    // Lengvas siūbavimas, kai niekas neliečia (stalas „kraiposi“)
    let swayX = 0, swayZ = 0;
    if (!orbit.drag && now - orbit.lastInput > 2500) {
        const t = (now - orbit.t0) / 1000;
        swayX = Math.sin(t * 0.6) * 1.6;
        swayZ = Math.sin(t * 0.37) * 2.2;
    }
    const tf = `perspective(1700px) rotateX(${(orbit.rx + swayX).toFixed(2)}deg) rotateZ(${(orbit.rz + swayZ).toFixed(2)}deg) scale(${orbit.sc.toFixed(3)})`;
    board.style.setProperty('transform', tf, 'important');
    board.style.setProperty('transform-origin', '50% 50%', 'important');
    // Figūrėlės lieka stačios ekrano atžvilgiu, kad ir kaip pasuktum lentą
    board.style.setProperty('--piece-rz', `${-(orbit.rz + swayZ).toFixed(1)}deg`);
    board.style.setProperty('--piece-rx', `${(orbit.rx + swayX).toFixed(1)}deg`);
}
function orbitTick(now) {
    if (!orbit.on) return;
    if (!orbit.drag && (Math.abs(orbit.vx) > 0.01 || Math.abs(orbit.vz) > 0.01)) {
        orbit.rx += orbit.vx; orbit.rz += orbit.vz;
        orbit.vx *= 0.92; orbit.vz *= 0.92;
        orbitClamp();
        if (Math.abs(orbit.vx) <= 0.01 && Math.abs(orbit.vz) <= 0.01) orbitSave();
    }
    orbitApply(now);
    orbit.raf = requestAnimationFrame(orbitTick);
}
function orbitReset(animate) {
    if (!animate) { Object.assign(orbit, ORBIT_DEFAULT); orbitSave(); return; }
    const from = { rx: orbit.rx, rz: orbit.rz, sc: orbit.sc }, start = performance.now();
    orbit.vx = orbit.vz = 0;
    const step = (now) => {
        const k = Math.min(1, (now - start) / 500), e = 1 - Math.pow(1 - k, 3);
        orbit.rx = from.rx + (ORBIT_DEFAULT.rx - from.rx) * e;
        orbit.rz = from.rz + (ORBIT_DEFAULT.rz - from.rz) * e;
        orbit.sc = from.sc + (ORBIT_DEFAULT.sc - from.sc) * e;
        orbit.lastInput = now;
        if (k < 1) requestAnimationFrame(step); else orbitSave();
    };
    requestAnimationFrame(step);
}
function orbitBind() {
    if (orbit.bound) return;
    const board = document.getElementById('board');
    if (!board) return;
    orbit.bound = true;
    const pts = new Map();
    board.addEventListener('pointerdown', (e) => {
        if (!orbit.on) return;
        if (e.target.closest('input, textarea, select, button, a, .chat-input, #journal, #chatMessages')) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
            const [p1, p2] = [...pts.values()];
            orbit.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), sc: orbit.sc };
            orbit.drag = null;
            return;
        }
        orbit.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), id: e.pointerId };
        orbit.moved = false; orbit.vx = orbit.vz = 0;
    });
    window.addEventListener('pointermove', (e) => {
        if (!orbit.on || !pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        orbit.lastInput = performance.now();
        if (orbit.pinch && pts.size >= 2) {
            const [p1, p2] = [...pts.values()];
            const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            orbit.sc = orbit.pinch.sc * (d / Math.max(1, orbit.pinch.d));
            orbitClamp(); orbit.moved = true;
            e.preventDefault();
            return;
        }
        const d = orbit.drag;
        if (!d || d.id !== e.pointerId) return;
        if (!orbit.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
        if (!orbit.moved) {
            orbit.moved = true;
            try { board.setPointerCapture(e.pointerId); } catch (_) {}
            if (typeof hideCellInfo === 'function') hideCellInfo();
            document.body.classList.add('orbit-dragging');
        }
        const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
        orbit.rz -= dx * 0.35;
        orbit.rx += dy * 0.25;
        orbitClamp();
        orbit.vz = -dx * 0.35 * 0.5; orbit.vx = dy * 0.25 * 0.5;
        d.lx = e.clientX; d.ly = e.clientY; d.lt = performance.now();
        e.preventDefault();
    }, { passive: false });
    const end = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (pts.size < 2) orbit.pinch = null;
        if (orbit.drag && orbit.drag.id === e.pointerId) {
            if (performance.now() - orbit.drag.lt > 80) { orbit.vx = orbit.vz = 0; }
            orbit.drag = null;
            orbitSave();
        }
        document.body.classList.remove('orbit-dragging');
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    // Po tempimo paspaudimas neturi atidaryti langelio ar spausti mygtuko
    board.addEventListener('click', (e) => {
        if (orbit.on && orbit.moved) { e.stopPropagation(); e.preventDefault(); orbit.moved = false; }
    }, true);
    board.addEventListener('wheel', (e) => {
        if (!orbit.on) return;
        if (e.target.closest('#journal, #chatMessages, #playersList, .info-content')) return;
        orbit.sc *= Math.exp(-e.deltaY * 0.0012);
        orbitClamp(); orbit.lastInput = performance.now(); orbitSave();
        e.preventDefault();
    }, { passive: false });
    board.addEventListener('dblclick', (e) => {
        if (!orbit.on || e.target.closest('.cell, button, input')) return;
        orbitReset(true);
    });
}
function orbitStart() {
    if (orbit.on) return;
    orbitLoad();
    orbitBind();
    orbit.on = true; orbit.t0 = performance.now(); orbit.lastInput = 0;
    cancelAnimationFrame(orbit.raf);
    orbit.raf = requestAnimationFrame(orbitTick);
}
function orbitStop() {
    if (!orbit.on) return;
    orbit.on = false;
    cancelAnimationFrame(orbit.raf);
    const board = document.getElementById('board');
    if (board) { board.style.removeProperty('transform'); board.style.removeProperty('transform-origin'); board.style.removeProperty('--piece-rz'); board.style.removeProperty('--piece-rx'); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBoardView);
else applyBoardView();

// 🔄 Priverstinis gulsčias vaizdas telefone
const FORCE_LAND_KEY = 'bancrupt_forceLandscape';
function forceLandPref() {
    try { return localStorage.getItem(FORCE_LAND_KEY) === 'on'; } catch (e) { return false; }
}
function setForceLandPref(on) {
    try { localStorage.setItem(FORCE_LAND_KEY, on ? 'on' : 'off'); } catch (e) {}
}
function isPhoneScreen() {
    return Math.min(window.innerWidth, window.innerHeight) <= 600;
}
function isGameScreenVisible() {
    const g = document.getElementById('game');
    const wr = document.getElementById('waitingRoomOverlay');
    // Laukimo kambarys uždengia žaidimą – tada dar ne žaidimo ekranas
    if (wr && getComputedStyle(wr).display !== 'none') return false;
    return !!g && getComputedStyle(g).display !== 'none';
}
// Efektyvus ekrano dydis (pasuktame režime plotis ir aukštis sukeičiami)
function viewSize() {
    const rot = document.body && document.body.classList.contains('force-rot');
    return rot ? { w: window.innerHeight, h: window.innerWidth } : { w: window.innerWidth, h: window.innerHeight };
}

function applyForceRotation() {
    const body = document.body;
    if (!body) return;
    const realPortrait = window.innerHeight > window.innerWidth;
    const rot = forceLandPref() && realPortrait && isPhoneScreen() && isGameScreenVisible();
    body.classList.toggle('force-rot', rot);
    if (rot) {
        body.style.width = window.innerHeight + 'px';
        body.style.height = window.innerWidth + 'px';
    } else {
        body.style.removeProperty('width');
        body.style.removeProperty('height');
    }
    updateRotateUi();
}

function updateRotateUi() {
    const header = document.getElementById('gameHeader');
    if (!header) return;
    let btn = document.getElementById('rotateBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'rotateBtn';
        btn.type = 'button';
        btn.onclick = toggleForceLandscape;
        btn.className = 'left-btn';
        const slot = document.getElementById('lpRotateSlot');
        if (slot) slot.appendChild(btn); else header.appendChild(btn);
    }
    const on = forceLandPref();
    // Rodom tik kai telefonas stačiai (arba pasukimas įjungtas – kad būtų kaip grąžinti)
    btn.style.display = (isPhoneScreen() && (window.innerHeight > window.innerWidth || on)) ? '' : 'none';
    const label = on ? tt('game.rotate.back', '↩️ Grąžinti') : tt('game.rotate.btn', '🔄 Versti gulsčiai');
    const sp = label.indexOf(' ');
    btn.innerHTML = '';
    btn.appendChild(document.createTextNode(sp > 0 ? label.slice(0, sp) : label));
    if (sp > 0) {
        const txt = document.createElement('span');
        txt.className = 'rb-txt';
        txt.textContent = label.slice(sp);
        btn.appendChild(txt);
    }
    btn.title = label;
    btn.classList.toggle('active', on);
    maybeShowRotateHint();
}

let rotateHintShown = false;
function maybeShowRotateHint() {
    if (rotateHintShown || forceLandPref()) return;
    if (!isPhoneScreen() || window.innerHeight <= window.innerWidth || !isGameScreenVisible()) return;
    try { if (sessionStorage.getItem('bancrupt_rotateHint')) { rotateHintShown = true; return; } } catch (e) {}
    // Palaukiam truputį ir patikrinam dar kartą – kad nepasirodytų laukimo kambaryje
    if (!maybeShowRotateHint._pending) {
        maybeShowRotateHint._pending = setTimeout(() => {
            maybeShowRotateHint._pending = null;
            if (!rotateHintShown && isGameScreenVisible() && (!gameState || gameState.gameStarted)) showRotateHintNow();
        }, 1500);
    }
}

function showRotateHintNow() {
    if (rotateHintShown || forceLandPref()) return;
    if (!isPhoneScreen() || window.innerHeight <= window.innerWidth) return;
    rotateHintShown = true;
    try { sessionStorage.setItem('bancrupt_rotateHint', '1'); } catch (e) {}
    const hint = document.createElement('div');
    hint.id = 'rotateHint';
    hint.innerHTML = '<span></span><button type="button" class="rh-go"></button><button type="button" class="rh-x">✕</button>';
    hint.querySelector('span').textContent = tt('game.rotate.hint', '📱 Pasuk telefoną – bus patogiau');
    hint.querySelector('.rh-go').textContent = tt('game.rotate.btn', '🔄 Versti gulsčiai');
    const close = () => { if (hint.parentNode) hint.parentNode.removeChild(hint); };
    hint.querySelector('.rh-go').onclick = () => { close(); toggleForceLandscape(); };
    hint.querySelector('.rh-x').onclick = close;
    document.body.appendChild(hint);
    setTimeout(close, 8000);
}

async function toggleForceLandscape() {
    if (typeof playClickSound === 'function') playClickSound();
    const hint = document.getElementById('rotateHint');
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    if (forceLandPref()) {
        setForceLandPref(false);
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch (e) {}
    } else {
        setForceLandPref(true);
        // Android: visas ekranas + užrakinta gulsčia padėtis. iPhone: nepavyks – tada pasukam patį žaidimą.
        try {
            const el = document.documentElement;
            if (el.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: 'hide' });
            if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
        } catch (e) { /* palaikymo nėra – lieka CSS pasukimas */ }
    }
    setTimeout(applyCompactLayout, 60);
    setTimeout(applyCompactLayout, 400);
}

document.addEventListener('fullscreenchange', () => setTimeout(applyCompactLayout, 200));

function isCompactScreen() {
    const v = viewSize();
    return v.w <= 1024 || v.h <= 560;
}

function applyCompactLayout() {
    const body = document.body;
    const board = document.getElementById('board');
    if (!body || !board) return;

    applyForceRotation();
    const compact = isCompactScreen();
    const wasCompact = body.classList.contains('cmp');
    body.classList.toggle('cmp', compact);
    const toggleBtn = document.getElementById('leftPanelToggle');
    if (compact && !wasCompact && toggleBtn) {
        body.classList.remove('lp-open');
        toggleBtn.innerHTML = '▶';
        toggleBtn.title = tf('cli.parodyti_panele');
    }
    if (!compact) {
        if (wasCompact && typeof loadLeftPanelState === 'function') loadLeftPanelState();
        body.classList.remove('cmp-portrait', 'cmp-landscape', 'cmp-narrow', 'cmp-tiny', 'cmp-short', 'lp-open');
        ['--corner-width', '--corner-height', '--left-col-width', '--right-col-width',
         '--top-row-height', '--bottom-row-height', '--board-gap', '--cell-font-size',
         '--corner-font-size', '--board-max-width', '--board-min-width', '--c-ic-edge',
         '--c-ic-side', '--c-ic-corner', '--c-side-font', '--c-dot', '--c-num', '--c-cost', '--c-cfont',
         '--c-title', '--c-dice', '--c-money', '--c-btn', '--c-zoom'].forEach(v => board.style.removeProperty(v));
        return;
    }

    const vs = viewSize();
    const portrait = vs.h > vs.w * 1.1;
    body.classList.toggle('cmp-portrait', portrait);
    body.classList.toggle('cmp-landscape', !portrait);

    // Lentos vidinis plotas (be paddingo ir rėmelio)
    const cs = getComputedStyle(board);
    const W = Math.max(200, board.clientWidth - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)));
    const H = Math.max(150, board.clientHeight - (parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)));

    const gap = 1;
    const cw = Math.round(W * (portrait ? 0.15 : 0.115));          // kampo / šoninės kolonos plotis
    const rh = Math.round(Math.max(36, H * (portrait ? 0.10 : 0.13))); // viršutinės / apatinės eilės aukštis
    const ew = (W - 2 * cw - 16 * gap) / 15;                         // viršaus / apačios langelio plotis
    const sh = (H - 2 * rh - 10 * gap) / 9;                          // šoninio langelio aukštis
    const narrow = ew < 46 && rh > ew * 1.6;
    body.classList.toggle('cmp-narrow', narrow);
    body.classList.toggle('cmp-tiny', ew < 30);

    const s = board.style;
    const px = v => Math.round(v * 10) / 10 + 'px';
    s.setProperty('--corner-width', px(cw));
    s.setProperty('--corner-height', px(rh));
    s.setProperty('--left-col-width', px(cw));
    s.setProperty('--right-col-width', px(cw));
    s.setProperty('--top-row-height', px(rh));
    s.setProperty('--bottom-row-height', px(rh));
    s.setProperty('--board-gap', gap + 'px');
    s.setProperty('--board-max-width', '100%');
    s.setProperty('--board-min-width', '0px');

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const edgeMin = Math.min(ew, rh);
    const sideMin = Math.min(cw, sh);
    s.setProperty('--cell-font-size', px(clamp(narrow ? Math.min(ew * 0.42, rh * 0.095) : Math.min(ew * 0.2, rh * 0.17), 6, 12)));
    s.setProperty('--c-side-font', px(clamp(Math.min(cw * 0.115, sh * 0.16), 6, 12)));
    s.setProperty('--corner-font-size', px(clamp(Math.min(cw * 0.13, rh * 0.2), 6, 13)));
    s.setProperty('--c-cost', px(clamp(Math.min(ew * 0.2, rh * 0.16, sh * 0.2), 6, 12)));
    s.setProperty('--c-num', px(clamp(edgeMin * 0.22, 5, 10)));
    s.setProperty('--c-ic-edge', px(clamp(edgeMin * 0.75, 10, 60)));
    s.setProperty('--c-ic-side', px(clamp(sideMin * 0.6, 10, 50)));
    s.setProperty('--c-ic-corner', px(clamp(Math.min(cw, rh) * 0.7, 14, 70)));
    s.setProperty('--c-dot', px(clamp(Math.min(edgeMin, sideMin) * 0.42, 8, 22)));

    // Vidurio langeliai: 3×2 gulsčiai, 2×3 stačiai
    const centerW = W - 2 * cw - 2 * gap;
    const centerH = H - 2 * rh - 2 * gap;
    const cols = portrait ? 2 : 3, rows = portrait ? 3 : 2;
    const pw = centerW / cols, ph = centerH / rows;
    // 🔍 Vidurys sukuriamas „kompiuterio“ dydžiu ir proporcingai sumažinamas (zoom),
    // todėl telefone atrodo lygiai taip pat kaip kompiuteryje, tik mažiau.
    const designW = portrait ? 230 : 300;   // vieno vidurio langelio „kompiuterinis“ dydis
    const designH = portrait ? 250 : 210;
    const zoom = clamp(Math.min(pw / designW, ph / designH), 0.35, 1.1);
    s.setProperty('--c-zoom', zoom.toFixed(3));
    s.setProperty('--c-cfont', '13px');
    s.setProperty('--c-title', '11px');
    s.setProperty('--c-dice', '58px');
    s.setProperty('--c-money', '28px');
    s.setProperty('--c-btn', '12px');
    body.classList.remove('cmp-short');

    ['centerDice1', 'centerDice2'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.d3) buildDice3D(el);
    });
    if (typeof fitPlayersList === 'function') fitPlayersList();
}

(function initCompactLayout() {
    let raf = 0;
    const schedule = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(applyCompactLayout);
    };
    const start = () => {
        applyCompactLayout();
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', () => setTimeout(applyCompactLayout, 250));
        const board = document.getElementById('board');
        if (board && window.ResizeObserver) new ResizeObserver(schedule).observe(board);
        // Paspaudus ant lentos – atidaryta panelė užsidaro
        if (board) board.addEventListener('pointerdown', () => {
            if (document.body.classList.contains('lp-open')) toggleLeftPanel();
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

// ============================================
// KAULIUKAI
// ============================================

// 🎲 3D kauliukai: tikri kubeliai su 6 sienelėmis, metami į 2 langelį (VALDYMAS)
const DICE_FACE_PIPS = {
    1: ['cc'],
    2: ['tl', 'br'],
    3: ['tl', 'cc', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'cc', 'bl', 'br'],
    6: ['tl', 'cl', 'bl', 'tr', 'cr', 'br']
};
// Kubo pasukimas [X, Y], kad į žiūrovą žiūrėtų reikiama sienelė
const DICE_FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const DICE_PIP_POS = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'];

function buildDice3D(el) {
    if (!el) return null;
    if (!el.dataset.d3) {
        el.dataset.d3 = '1';
        el.classList.add('d3');
        // Vidinės sienelės (be suapvalinimų) užpildo kubą – pro suapvalintus kampus nesimato tuštumos
        el.innerHTML = '<div class="d3-stand"><div class="d3-cube">' +
            [1, 2, 3, 4, 5, 6].map(v => `<div class="d3-in d3-f${v}"></div>`).join('') +
            [1, 2, 3, 4, 5, 6].map(v =>
            `<div class="d3-face d3-f${v}"><div class="dice-dots-container">` +
            DICE_PIP_POS.map(pos => `<span class="dice-dot dot-${pos}${DICE_FACE_PIPS[v].includes(pos) ? ' visible' : ''}"></span>`).join('') +
            '</div></div>').join('') + '</div></div>';
    }
    // Kubo pusė pagal tikrą dydį (keičiasi skirtinguose ekranuose)
    const half = (el.offsetWidth || 60) / 2;
    el.style.setProperty('--d3-half', half + 'px');
    return el.querySelector('.d3-cube');
}

// Vienodas abiejų kauliukų žiūrėjimo kampas: matosi priekis, viršus ir šonas – atrodo kaip tikras kubas
const DICE_VIEW = 'rotateX(-11deg) rotateY(-13deg)';
function diceTransform(value, spinX, spinY, tiltZ) {
    const [x, y] = DICE_FACE_ROT[value] || [0, 0];
    return `${DICE_VIEW} rotateZ(${tiltZ}deg) rotateX(${x + 360 * spinX}deg) rotateY(${y + 360 * spinY}deg)`;
}

// 🎲 Šešėlis ant stalo po kauliuku (matomas 3D / 3D+ režimuose)
function getDiceShadow(el) {
    if (!el || !el.parentElement) return null;
    const box = el.parentElement;
    let sh = box.querySelector(`.dice-shadow[data-for="${el.id}"]`);
    if (!sh) {
        sh = document.createElement('div');
        sh.className = 'dice-shadow';
        sh.dataset.for = el.id;
        box.insertBefore(sh, box.firstChild);   // už kauliuko
    }
    // Padėtis – po kauliuko apačia, per visą jo plotį
    if (!box.__shObs && window.ResizeObserver) {
        box.__shObs = new ResizeObserver(() => placeDiceShadows());
        box.__shObs.observe(box);
    }
    if (!el.offsetWidth) { sh.style.visibility = 'hidden'; return sh; }
    sh.style.visibility = '';
    const w = el.offsetWidth, h = el.offsetHeight || w;
    // Kauliukas stovi ant savo apatinio krašto – šešėlis ant stalo aplink tą liniją
    sh.style.left = (el.offsetLeft - w * 0.2 + w * 0.06) + 'px';
    sh.style.top = (el.offsetTop + h - w * 0.2) + 'px';
    sh.style.width = (w * 1.4) + 'px';
    sh.style.height = (w * 0.5) + 'px';
    return sh;
}
function placeDiceShadows() {
    ['centerDice1', 'centerDice2'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.d3) getDiceShadow(el);
    });
}

function updateSingleDice(diceId, value) {
    const el = document.getElementById(diceId);
    const cube = buildDice3D(el);
    if (!cube) return;
    if (cube.getAnimations) cube.getAnimations().forEach(a => a.cancel());
    if (el.getAnimations) el.getAnimations().forEach(a => a.cancel());
    cube.style.transform = diceTransform(value, 0, 0, 0);
    el.dataset.value = value;
    const sh = getDiceShadow(el);
    if (sh && sh.getAnimations) sh.getAnimations().forEach(a => a.cancel());
}

function throwSingleDice(diceId, value, opts) {
    const el = document.getElementById(diceId);
    const cube = buildDice3D(el);
    if (!cube || !cube.animate) {
        updateSingleDice(diceId, value);
        return Promise.resolve();
    }
    if (cube.getAnimations) cube.getAnimations().forEach(a => a.cancel());
    if (el.getAnimations) el.getAnimations().forEach(a => a.cancel());

    const rnd = (a, b) => a + Math.random() * (b - a);
    const tilt = 0;   // abu kauliukai nusileidžia tuo pačiu kampu
    const finalT = diceTransform(value, opts.spinX, opts.spinY, tilt);
    const startT = `${DICE_VIEW} rotateZ(${rnd(-90, 90)}deg) rotateX(${rnd(-180, 180)}deg) rotateY(${rnd(-180, 180)}deg)`;
    const dur = opts.duration;

    // Kubelio sukimasis ore
    const spin = cube.animate([
        { transform: startT },
        { transform: finalT }
    ], { duration: dur, delay: opts.delay, easing: 'cubic-bezier(0.15, 0.6, 0.25, 1)', fill: 'both' });

    // Skrydis į langelį su atšokimu.
    // 2D – aukštis rodomas judesiu į viršų; 3D / 3D+ – tikru pakilimu virš stalo (Z ašimi)
    const fx = opts.fromX, fy = opts.fromY;
    const in3d = false;   // centras plokščias – aukštis visada rodomas judesiu į viršų
    const pos = (x, lift, sc) => in3d
        ? `translate3d(${x}px, 0px, ${lift * 1.3}px) scale(${sc})`
        : `translate(${x}px, ${-lift}px) scale(${sc})`;
    el.animate([
        { transform: pos(fx, -fy, 1.25), offset: 0 },
        { transform: pos(fx * 0.45, -(fy * 0.6 - 30), 1.18), offset: 0.32 },
        { transform: pos(0, 0, 1), offset: 0.6 },
        { transform: pos(-fx * 0.04, 14, 1.04), offset: 0.74 },
        { transform: pos(0, 0, 1), offset: 0.86 },
        { transform: pos(-fx * 0.01, 4, 1.01), offset: 0.93 },
        { transform: pos(0, 0, 1), offset: 1 }
    ], { duration: dur, delay: opts.delay, easing: 'ease-out', fill: 'none' });

    // Šešėlis lieka ant stalo: juda kartu horizontaliai, aukštai – mažas ir blankus
    const sh = getDiceShadow(el);
    if (sh && sh.animate) {
        sh.getAnimations().forEach(a => a.cancel());
        const shK = (x, lift, off) => {
            const k = Math.min(1, Math.max(0, lift / 160));
            return { translate: `${x}px 0px`, scale: String(1 - k * 0.55), opacity: String(1 - k * 0.75), offset: off };
        };
        sh.animate([
            shK(fx, -fy + 40, 0),
            shK(fx * 0.45, -(fy * 0.6 - 30) + 20, 0.32),
            shK(0, 0, 0.6),
            shK(-fx * 0.04, 14, 0.74),
            shK(0, 0, 0.86),
            shK(-fx * 0.01, 4, 0.93),
            shK(0, 0, 1)
        ], { duration: dur, delay: opts.delay, easing: 'ease-out', fill: 'both' }).finished.then(a => {}).catch(() => {});
    }

    return spin.finished.then(() => {
        cube.style.transform = finalT;
        spin.cancel();
        el.dataset.value = value;
    }).catch(() => {});
}

// Grąžina Promise, kuris išsipildo, kai kauliukai nusileidžia
function updateDiceDisplay(value1, value2) {
    if (navigator.vibrate) {
        try { navigator.vibrate([50, 30, 50, 30, 100]); } catch (e) {}
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
        updateSingleDice('centerDice1', value1);
        updateSingleDice('centerDice2', value2);
        return Promise.resolve();
    }
    const container = document.querySelector('#center-2 .dice-container');
    const panel = document.getElementById('center-2');
    const w = container ? container.offsetWidth : 200;
    // Metama iš toliau – iš už langelio dešinės pusės, iš aukščiau
    const fromX = Math.max(200, w * 1.25);
    const pick = () => (Math.random() < 0.5 ? 1 : 2);
    if (panel) panel.classList.add('dice-flying');
    return Promise.all([
        throwSingleDice('centerDice1', value1, { fromX: fromX, fromY: -70, delay: 0, duration: 1150, spinX: pick() + 1, spinY: pick() + 1 }),
        throwSingleDice('centerDice2', value2, { fromX: fromX + 60, fromY: -100, delay: 80, duration: 1150, spinX: pick() + 1, spinY: pick() + 1 })
    ]).then(() => { if (panel) panel.classList.remove('dice-flying'); });
}

window.addEventListener('resize', () => {
    ['centerDice1', 'centerDice2'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.d3) buildDice3D(el);
    });
    placeDiceShadows();
});

// ============================================
// ŽAIDĖJO JUDĖJIMO ANIMACIJA
// ============================================
// 🏗️ Statybų langas: 15 s statyboms po sustojimo
const buildWin = { open: false, deadline: 0, timer: null };
function openBuildWindowPanel(ms, rollAgain) {
    buildWin.deadline = Date.now() + (ms || 15000);
    buildWin.rollAgain = !!rollAgain;
    buildWin.rollAfter = false;
    let p = document.getElementById('buildWindowPanel');
    if (!p) {
        p = document.createElement('div');
        p.id = 'buildWindowPanel';
        p.innerHTML = `
            <div class="bw-icon">🏗️</div>
            <div class="bw-body">
                <div class="bw-title"></div>
                <div class="bw-timer"><div class="bw-bar"><span></span></div><span class="bw-left"></span></div>
                <div class="bw-btns">
                    <button type="button" class="bw-build"></button>
                    <button type="button" class="bw-end"></button>
                </div>
            </div>`;
        // 📢 Rodom 5 langelyje (pranešimuose), kaip pirkimo kortelę
        const host = document.getElementById('center-5');
        (host || document.body).appendChild(p);
        if (host) p.classList.add('in-cell5');
        p.querySelector('.bw-build').onclick = () => buildHouse();
        p.querySelector('.bw-end').onclick = () => {
            p.querySelectorAll('button').forEach(b => b.disabled = true);
            playClickSound();
            buildWin.rollAfter = !!buildWin.rollAgain;   // po dublio – iškart metam kauliukus
            socket.emit('finishBuild');
        };
    }
    p.querySelectorAll('button').forEach(b => b.disabled = false);
    p.querySelector('.bw-title').textContent = tt('build.windowTitle', 'Gali statyti!');
    p.querySelector('.bw-build').textContent = tt('game.buildHouseBtn', '🏠 Statyti namą');
    p.querySelector('.bw-end').textContent = buildWin.rollAgain
        ? tt('build.rollDice', '🎲 Mesti kauliukus')
        : tt('build.endTurn', '✅ Baigti ėjimą');
    p.classList.toggle('roll-again', buildWin.rollAgain);
    p.style.display = 'flex';
    const bar = p.querySelector('.bw-bar span');
    const total = ms || 15000;
    bar.style.transition = 'none';
    bar.style.width = Math.max(0, Math.min(100, (buildWin.deadline - Date.now()) / 15000 * 100)) + '%';
    void bar.offsetWidth;
    bar.style.transition = `width ${Math.max(0, buildWin.deadline - Date.now())}ms linear`;
    bar.style.width = '0%';
    buildWin.open = true;
    clearInterval(buildWin.timer);
    const tick = () => {
        const left = Math.max(0, Math.ceil((buildWin.deadline - Date.now()) / 1000));
        const el = p.querySelector('.bw-left');
        if (el) el.textContent = '⏱️ ' + left + ' s';
        if (left <= 0) clearInterval(buildWin.timer);
    };
    tick();
    buildWin.timer = setInterval(tick, 250);
    void total;
    refreshBuildButton();
}
function closeBuildWindowPanel() {
    buildWin.open = false;
    clearInterval(buildWin.timer);
    const p = document.getElementById('buildWindowPanel');
    if (p) p.style.display = 'none';
    const picker = document.getElementById('buildPicker');
    if (picker) picker.style.display = 'none';
    refreshBuildButton();
}

// 🚕 Taksi signalas „pyp pyp“ (sugeneruojamas, failo nereikia)
let taxiAudioCtx = null;
function taxiBeep() {
    try {
        if (typeof audioManager !== 'undefined' && audioManager.isSoundEnabled && !audioManager.isSoundEnabled()) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        taxiAudioCtx = taxiAudioCtx || new AC();
        const ctx = taxiAudioCtx, t0 = ctx.currentTime + 0.02;
        [0, 0.18].forEach(dt => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'square'; o.frequency.value = 520;
            g.gain.setValueAtTime(0.0001, t0 + dt);
            g.gain.exponentialRampToValueAtTime(0.08, t0 + dt + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.13);
            o.connect(g); g.connect(ctx.destination);
            o.start(t0 + dt); o.stop(t0 + dt + 0.15);
        });
    } catch (e) {}
}

// 🧪 Laikinas „Taksi testas“ mygtukas (rodomas tik testavimo režimu)
function updateTaxiTestButton() {
    // 🧪 Testo mygtukai pašalinti (žaidimas paruoštas naudoti). Jei kur liko – nuimam.
    ['taxiTestBtn', 'jailTestBtn', 'spaTestBtn', 'fxTestRow'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

// 💨 DUJŲ EFEKTAS – atsistojus ant DUJŲ, iš langelio kyla ir išsisklaido dujų debesėliai
function playGasEffect(fieldId) {
    const cell = document.getElementById(`cell-${fieldId}`);
    if (!cell) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Kryptis – į lentos vidurį (kad debesėliai neišplauktų už lentos)
    const board = document.getElementById('board') || cell.parentElement;
    const cr = cell.getBoundingClientRect(), br = board.getBoundingClientRect();
    let dx = (br.left + br.width / 2) - (cr.left + cr.width / 2);
    let dy = (br.top + br.height / 2) - (cr.top + cr.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const size = Math.max(40, Math.min(cr.width, cr.height) || 60);

    // Sluoksnis virš lentos (ne langelio viduje), kad debesėlių neuždengtų vidurio skydeliai
    let ox = cell.offsetWidth / 2, oy = cell.offsetHeight / 2, e = cell;
    while (e && e !== board) { ox += e.offsetLeft; oy += e.offsetTop; e = e.offsetParent; }
    if (e !== board) {   // board nėra offsetParent grandinėje – skaičiuojam pagal ekraną
        ox = cr.left - br.left + cr.width / 2; oy = cr.top - br.top + cr.height / 2;
    }
    const fx = document.createElement('div');
    fx.className = 'gas-fx';
    fx.style.left = ox.toFixed(1) + 'px';
    fx.style.top = oy.toFixed(1) + 'px';
    cell.classList.add('gas-host');
    const count = reduce ? 0 : 13;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'gas-puff';
        const spread = (Math.random() - 0.5) * 1.4;                 // šoninis išsisklaidymas
        const dist = size * (1.0 + Math.random() * 1.6);
        const tx = (dx + -dy * spread) * dist, ty = (dy + dx * spread) * dist;
        p.style.setProperty('--tx', tx.toFixed(1) + 'px');
        p.style.setProperty('--ty', ty.toFixed(1) + 'px');
        p.style.setProperty('--s', (0.55 + Math.random() * 0.6).toFixed(2));
        p.style.setProperty('--d', (Math.random() * 0.9).toFixed(2) + 's');
        p.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
        p.style.setProperty('--sz', Math.round(size * (0.8 + Math.random() * 0.5)) + 'px');
        p.style.setProperty('--h', Math.round(70 + Math.random() * 30));   // žalsvai gelsva
        fx.appendChild(p);
    }
    board.querySelectorAll('.gas-fx').forEach(x => x.remove());
    board.appendChild(fx);
    setTimeout(() => { fx.remove(); cell.classList.remove('gas-host'); }, reduce ? 1300 : 4200);
}

// ✈️ ORO UOSTO EFEKTAS – langelio lėktuvas pavažiuoja kilimo taku, pakyla ir išskrenda virš lentos
function fxBoardPoint(el, board) {
    // Elemento centras lentos koordinatėmis (veikia ir 3D, nes skaičiuojama pagal offset grandinę)
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2, e = el;
    while (e && e !== board) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    if (e === board) return { x, y };
    const r = el.getBoundingClientRect(), br = board.getBoundingClientRect();
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
}
function playAirportEffect(fieldId) {
    const cell = document.getElementById(`cell-${fieldId}`);
    const board = document.getElementById('board');
    if (!cell || !board) return;
    const icon = cell.querySelector('.cell-bg-icon');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !icon || typeof Element.prototype.animate !== 'function') {
        if (icon) { icon.classList.remove('ap-wiggle'); void icon.offsetWidth; icon.classList.add('ap-wiggle'); }
        return;
    }
    if (board.querySelector('.ap-fx')) return;   // jau skrenda – antrą kartą nepaleidžiam

    // Kilimo takas – lentos ėjimo kryptimi (į kitą langelį), kilimas – link lentos vidurio
    const total = (gameState && gameState.board && gameState.board.length) || 52;
    const nextCell = document.getElementById(`cell-${(fieldId + 1) % total}`) || cell;
    const p0 = fxBoardPoint(icon, board), pc = fxBoardPoint(cell, board), pn = fxBoardPoint(nextCell, board);
    let rx = pn.x - pc.x, ry = pn.y - pc.y; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
    let cx = board.offsetWidth / 2 - pc.x, cy = board.offsetHeight / 2 - pc.y; const cl = Math.hypot(cx, cy) || 1; cx /= cl; cy /= cl;
    let ux = rx * 0.55 + cx, uy = ry * 0.55 + cy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const deg = (x, y) => Math.atan2(y, x) * 180 / Math.PI;
    const aRun = deg(rx, ry), aFly = deg(ux, uy);
    const cellSize = Math.min(cell.offsetWidth, cell.offsetHeight) || 60;
    const fontPx = parseFloat(getComputedStyle(icon).fontSize) || 40;
    const runLen = cellSize * 0.55;
    const flyLen = Math.max(board.offsetWidth, board.offsetHeight) * 0.55;
    const tx = rx * runLen, ty = ry * runLen;            // kilimo tako galas
    const fx = tx + ux * flyLen, fy = ty + uy * flyLen;   // išskridimo taškas

    const wrap = document.createElement('div');
    wrap.className = 'ap-fx';
    wrap.style.left = p0.x.toFixed(1) + 'px';
    wrap.style.top = p0.y.toFixed(1) + 'px';
    const shadow = document.createElement('div');
    shadow.className = 'ap-shadow';
    shadow.style.width = (fontPx * 0.9) + 'px';
    shadow.style.height = (fontPx * 0.32) + 'px';
    const plane = document.createElement('div');
    plane.className = 'ap-plane';
    plane.innerHTML = '<span class="ap-trail"></span><span class="ap-emoji">✈️</span>';
    plane.querySelector('.ap-emoji').style.fontSize = fontPx + 'px';
    plane.querySelector('.ap-trail').style.height = Math.max(3, fontPx * 0.08) + 'px';
    wrap.appendChild(shadow);
    wrap.appendChild(plane);
    board.appendChild(wrap);

    // Kilimo tako žiburėliai – tame pačiame sluoksnyje (lenta gali persipiešti ir išmesti langelio vidų)
    const lights = document.createElement('span');
    lights.className = 'ap-lights';
    lights.style.width = (cellSize * 1.1) + 'px';
    lights.style.setProperty('--ar', aRun + 'deg');
    lights.style.left = (pc.x - p0.x + rx * cellSize * 0.2).toFixed(1) + 'px';
    lights.style.top = (pc.y - p0.y + cellSize * 0.18).toFixed(1) + 'px';
    wrap.insertBefore(lights, shadow);
    board.classList.add('ap-hide-' + fieldId);   // langelio lėktuvas paslepiamas, kol skrenda kopija

    const T = 3800;
    const tr = (x, y, a, s) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${a.toFixed(1)}deg) scale(${s})`;
    plane.animate([
        { transform: tr(0, 0, aRun, 1), opacity: 1, offset: 0 },
        { transform: tr(tx * 0.35, ty * 0.35, aRun, 1), offset: 0.18, easing: 'ease-in' },
        { transform: tr(tx, ty, aRun + (aFly - aRun) * 0.4, 1.08), offset: 0.36, easing: 'ease-in' },
        { transform: tr(tx + ux * flyLen * 0.35, ty + uy * flyLen * 0.35, aFly, 1.7), opacity: 1, offset: 0.62 },
        { transform: tr(fx, fy, aFly, 2.6), opacity: 0, offset: 1 }
    ], { duration: T, easing: 'linear', fill: 'forwards' });
    plane.querySelector('.ap-trail').animate([
        { width: '0px', opacity: 0, offset: 0 },
        { width: '0px', opacity: 0, offset: 0.34 },
        { width: (fontPx * 1.2) + 'px', opacity: 0.85, offset: 0.6 },
        { width: (fontPx * 2.4) + 'px', opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Šešėlis lieka ant žemės: atsilieka, mažėja ir blunka
    shadow.animate([
        { transform: tr(0, 0, aRun, 1), opacity: 0.45, offset: 0 },
        { transform: tr(tx, ty, aRun, 1), opacity: 0.45, offset: 0.36 },
        { transform: tr(tx + ux * flyLen * 0.22, ty + uy * flyLen * 0.22 + cellSize * 0.5, aFly, 0.7), opacity: 0.2, offset: 0.62 },
        { transform: tr(tx + ux * flyLen * 0.45, ty + uy * flyLen * 0.45 + cellSize * 0.9, aFly, 0.45), opacity: 0, offset: 0.85 }
    ], { duration: T, fill: 'forwards' });

    setTimeout(() => {
        wrap.remove();
        board.classList.remove('ap-hide-' + fieldId);
        const ic = document.querySelector(`#cell-${fieldId} .cell-bg-icon`);   // lenta galėjo persipiešti
        if (ic) {
            ic.classList.add('ap-return');                      // langelyje vėl atsiranda lėktuvas
            setTimeout(() => ic.classList.remove('ap-return'), 900);
        }
    }, T + 150);
}

// 🚂 🚢 🚌 STOČIŲ EFEKTAI – traukinys išvažiuoja, laivas išplaukia bangomis, autobusas nuvažiuoja
// Transportas piešiamas SVG (visada „žiūri“ į dešinę), kad visuose įrenginiuose atrodytų vienodai.
const VEHICLE_SVG = {
    train: '<svg viewBox="0 0 96 56" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="62" y="4" width="10" height="16" rx="2" fill="#2b2b2b"/><rect x="59" y="2" width="16" height="5" rx="2" fill="#444"/>' +
        '<rect x="6" y="8" width="30" height="30" rx="4" fill="#b8322a"/><rect x="11" y="13" width="9" height="10" rx="2" fill="#bfe6ff"/><rect x="23" y="13" width="9" height="10" rx="2" fill="#bfe6ff"/>' +
        '<rect x="3" y="5" width="36" height="5" rx="2" fill="#7a1d18"/>' +
        '<rect x="34" y="18" width="50" height="20" rx="9" fill="#2f6b3a"/><rect x="34" y="26" width="50" height="3" fill="#ffd23f"/>' +
        '<circle cx="84" cy="28" r="6" fill="#ffe680" stroke="#2b2b2b" stroke-width="2"/>' +
        '<path d="M80 38 L94 46 L80 46 Z" fill="#444"/><rect x="2" y="36" width="84" height="6" rx="2" fill="#333"/>' +
        '<circle cx="16" cy="45" r="8" fill="#222"/><circle cx="16" cy="45" r="3.5" fill="#bbb"/>' +
        '<circle cx="44" cy="46" r="7" fill="#222"/><circle cx="44" cy="46" r="3" fill="#bbb"/>' +
        '<circle cx="66" cy="46" r="7" fill="#222"/><circle cx="66" cy="46" r="3" fill="#bbb"/>' +
        '<rect x="14" y="44" width="54" height="3" rx="1.5" fill="#999"/></svg>',
    bus: '<svg viewBox="0 0 96 52" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="6" width="88" height="34" rx="8" fill="#f2b600"/><rect x="3" y="30" width="88" height="5" fill="#d45500"/>' +
        '<rect x="9" y="11" width="13" height="13" rx="2" fill="#bfe6ff"/><rect x="25" y="11" width="13" height="13" rx="2" fill="#bfe6ff"/>' +
        '<rect x="41" y="11" width="13" height="13" rx="2" fill="#bfe6ff"/><rect x="57" y="11" width="13" height="13" rx="2" fill="#bfe6ff"/>' +
        '<path d="M74 11 H84 Q90 11 90 18 V26 H74 Z" fill="#9fd4f5"/><rect x="74" y="27" width="7" height="11" rx="1.5" fill="#c98f00"/>' +
        '<circle cx="88" cy="32" r="2.6" fill="#fff6c4"/><rect x="1" y="34" width="5" height="4" rx="1" fill="#c0392b"/>' +
        '<circle cx="22" cy="41" r="8" fill="#222"/><circle cx="22" cy="41" r="3.5" fill="#bbb"/>' +
        '<circle cx="72" cy="41" r="8" fill="#222"/><circle cx="72" cy="41" r="3.5" fill="#bbb"/></svg>',
    ship: '<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="56" y="6" width="10" height="16" fill="#d63a2f"/><rect x="56" y="6" width="10" height="4" fill="#222"/>' +
        '<rect x="70" y="10" width="8" height="12" fill="#d63a2f"/><rect x="70" y="10" width="8" height="3" fill="#222"/>' +
        '<rect x="26" y="20" width="56" height="14" rx="2" fill="#fafafa"/><rect x="34" y="14" width="34" height="8" rx="2" fill="#eee"/>' +
        '<g fill="#3c7fb8"><circle cx="34" cy="27" r="2.3"/><circle cx="43" cy="27" r="2.3"/><circle cx="52" cy="27" r="2.3"/><circle cx="61" cy="27" r="2.3"/><circle cx="70" cy="27" r="2.3"/></g>' +
        '<path d="M4 34 H96 L86 52 H14 Z" fill="#1f3a5f"/><path d="M10 46 H90 L86 52 H14 Z" fill="#b8322a"/>' +
        '<rect x="4" y="33" width="92" height="3" fill="#fff"/></svg>'
};
const VEHICLE_FX = {
    19: { kind: 'train', dir: 'center', T: 4000, smoke: 'steam', ground: 'rails' },
    46: { kind: 'bus',   dir: 'center', T: 3400, smoke: 'exhaust', ground: 'road' },
    37: { kind: 'ship',  dir: 'path',   T: 4600, smoke: 'steam', ground: null }
};
function playVehicleEffect(fieldId) {
    const cfg = VEHICLE_FX[fieldId];
    const cell = document.getElementById(`cell-${fieldId}`);
    const board = document.getElementById('board');
    if (!cfg || !cell || !board) return;
    const icon = cell.querySelector('.cell-bg-icon');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof Element.prototype.animate !== 'function') {
        if (icon) { icon.classList.remove('ap-wiggle'); void icon.offsetWidth; icon.classList.add('ap-wiggle'); }
        return;
    }
    if (board.querySelector(`.vx-fx[data-f="${fieldId}"]`)) return;   // jau važiuoja

    const pc = fxBoardPoint(cell, board);
    const total = (gameState && gameState.board && gameState.board.length) || 52;
    let dx = 0, dy = 0;
    if (cfg.dir === 'center') {
        dx = board.offsetWidth / 2 - pc.x >= 0 ? 1 : -1;          // horizontaliai lentos vidurio link
    } else {
        const nx = document.getElementById(`cell-${(fieldId + 1) % total}`);
        const pn = nx ? fxBoardPoint(nx, board) : { x: pc.x - 1, y: pc.y };
        dx = pn.x - pc.x; dy = pn.y - pc.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    }
    const cellMin = Math.min(cell.offsetWidth, cell.offsetHeight) || 57;
    const vw = Math.max(54, Math.min(110, cellMin * 1.35));       // transporto plotis
    const dist = cfg.dir === 'center' ? board.offsetWidth * 0.42 : Math.max(board.offsetWidth, board.offsetHeight) * 0.5;
    const flip = dx < 0;                                           // SVG žiūri į dešinę – važiuojant kairėn apverčiam
    const ang = cfg.dir === 'path' && Math.abs(dy) > Math.abs(dx) ? Math.atan2(dy, dx) * 180 / Math.PI : 0;

    const wrap = document.createElement('div');
    wrap.className = 'vx-fx vx-' + cfg.kind;
    wrap.dataset.f = fieldId;
    wrap.style.left = pc.x.toFixed(1) + 'px';
    wrap.style.top = pc.y.toFixed(1) + 'px';

    // Žemė po ratais: bėgiai / kelias / bangos
    const ground = document.createElement('div');
    if (cfg.ground) {
        ground.className = 'vx-ground vx-' + cfg.ground;
        ground.style.width = (dist + vw * 1.6) + 'px';
        ground.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg) translate(${-vw * 0.8}px, ${vw * 0.12}px)`;
        wrap.appendChild(ground);
    }

    const veh = document.createElement('div');
    veh.className = 'vx-veh';
    veh.innerHTML = `<div class="vx-bob"><div class="vx-img" style="width:${vw}px;${flip ? 'transform:scaleX(-1);' : ''}">${VEHICLE_SVG[cfg.kind]}</div></div>`;
    if (cfg.kind === 'ship') veh.insertAdjacentHTML('afterbegin', '<span class="vx-wake"></span>');
    wrap.appendChild(veh);
    board.appendChild(wrap);
    board.classList.add('vx-hide-' + fieldId);

    const T = cfg.T;
    const ex = dx * dist, ey = dy * dist;
    const tr = (p, s) => `translate(${(ex * p).toFixed(1)}px, ${(ey * p).toFixed(1)}px) rotate(${ang}deg) scale(${s})`;
    const move = veh.animate([
        { transform: tr(0, 0.6), opacity: 0, offset: 0 },
        { transform: tr(0, 1), opacity: 1, offset: 0.1 },
        { transform: tr(0.02, 1), offset: 0.22, easing: 'ease-in' },      // trumpas „užsikūrimas“
        { transform: tr(0.55, 1), opacity: 1, offset: 0.7 },
        { transform: tr(1, 1), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    if (cfg.ground) ground.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: T, fill: 'forwards' });

    // Dūmai / garai – lieka ten, kur transportas buvo (pėdsakas)
    const smokeEvery = cfg.smoke === 'exhaust' ? 140 : 190;
    const chimneyX = (cfg.kind === 'train' ? 0.2 : cfg.kind === 'ship' ? 0.11 : -0.48) * vw * (flip ? -1 : 1);
    const chimneyY = cfg.kind === 'bus' ? vw * 0.13 : -vw * 0.3;
    const smokeTimer = setInterval(() => {
        const m = new DOMMatrixReadOnly(getComputedStyle(veh).transform);
        const op = parseFloat(getComputedStyle(veh).opacity);
        if (op < 0.3) return;
        const puff = document.createElement('span');
        puff.className = 'vx-puff vx-' + cfg.smoke;
        const sz = vw * (cfg.smoke === 'exhaust' ? 0.16 : 0.26) * (0.8 + Math.random() * 0.5);
        puff.style.width = puff.style.height = sz.toFixed(1) + 'px';
        puff.style.left = (m.e + chimneyX).toFixed(1) + 'px';
        puff.style.top = (m.f + chimneyY).toFixed(1) + 'px';
        puff.style.setProperty('--px', ((flip ? 1 : -1) * (6 + Math.random() * 14)).toFixed(1) + 'px');
        puff.style.setProperty('--py', (cfg.smoke === 'exhaust' ? -6 - Math.random() * 8 : -18 - Math.random() * 18).toFixed(1) + 'px');
        wrap.insertBefore(puff, veh);
        setTimeout(() => puff.remove(), 1400);
    }, smokeEvery);

    move.onfinish = () => {
        clearInterval(smokeTimer);
        setTimeout(() => {
            wrap.remove();
            board.classList.remove('vx-hide-' + fieldId);
            const ic = document.querySelector(`#cell-${fieldId} .cell-bg-icon`);
            if (ic) { ic.classList.add('ap-return'); setTimeout(() => ic.classList.remove('ap-return'), 900); }
        }, 250);
    };
}

// ============================================================
// 🎬 LANGELIŲ EFEKTAI: ŠIUKŠLĖS, BASEINAS, ELEKTRA, PIRTIS, VANDUO, PAPLŪDIMYS, GIMTADIENIS
// Visi piešiami sluoksnyje virš lentos (.fx-layer), todėl veikia 2D / 3D / 3D+.
// ============================================================
const CELL_FX = { 5: fxTax2, 11: fxSpa2, 14: fxGarbage2, 16: (id) => fxJail3(id, 'visit'), 21: fxBar3, 24: fxPool3, 26: fxTaxi3, 28: fxElectric3, 32: fxSauna3, 44: fxWater3, 48: fxBeach3, 50: fxBirthday3 };
function playCellEffect(fieldId) {
    const fn = CELL_FX[fieldId];
    if (fn) { try { fn(fieldId); } catch (e) { console.warn('Efekto klaida', fieldId, e); } }
}

// Bendras paruošimas: sluoksnis langelio centre, kryptis į lentos vidų, langelio matmenys
function fxPrep(fieldId, hideIcon) {
    const cell = document.getElementById(`cell-${fieldId}`);
    const board = document.getElementById('board');
    if (!cell || !board) return null;
    const icon = cell.querySelector('.cell-bg-icon');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof Element.prototype.animate !== 'function') {
        if (icon) { icon.classList.remove('ap-wiggle'); void icon.offsetWidth; icon.classList.add('ap-wiggle'); }
        return null;
    }
    if (board.querySelector(`.fx-layer[data-f="${fieldId}"]`)) return null;   // jau rodomas
    const pc = fxBoardPoint(cell, board);
    const cx = board.offsetWidth / 2 - pc.x, cy = board.offsetHeight / 2 - pc.y;
    const horiz = Math.abs(cx) / (board.offsetWidth || 1) > Math.abs(cy) / (board.offsetHeight || 1);
    const ix = horiz ? Math.sign(cx) || 1 : 0, iy = horiz ? 0 : Math.sign(cy) || 1;   // į lentos vidų
    const w = cell.offsetWidth || 68, h = cell.offsetHeight || 68;
    const wrap = document.createElement('div');
    wrap.className = 'fx-layer';
    wrap.dataset.f = fieldId;
    wrap.style.left = pc.x.toFixed(1) + 'px';
    wrap.style.top = pc.y.toFixed(1) + 'px';
    board.appendChild(wrap);
    if (hideIcon) board.classList.add('fx-hide-' + fieldId);
    const iconPx = icon ? (parseFloat(getComputedStyle(icon).fontSize) || 40) : 40;
    return { fieldId, cell, board, wrap, pc, ix, iy, w, h, s: Math.min(w, h), L: Math.max(w, h), iconPx, hideIcon };
}
function fxEnd(ctx, ms) {
    setTimeout(() => {
        ctx.wrap.remove();
        if (ctx.hideIcon) {
            ctx.board.classList.remove('fx-hide-' + ctx.fieldId);
            const ic = document.querySelector(`#cell-${ctx.fieldId} .cell-bg-icon`);
            if (ic) { ic.classList.add('ap-return'); setTimeout(() => ic.classList.remove('ap-return'), 900); }
        }
    }, ms);
}
function fxEl(ctx, cls, html, parent) {
    const e = document.createElement('div');
    e.className = cls;
    if (html) e.innerHTML = html;
    (parent || ctx.wrap).appendChild(e);
    return e;
}
const fxT = (x, y, r = 0, s = 1) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r}deg) scale(${s})`;
function fxPuff(ctx, x, y, size, cls, dx, dy, life) {
    const p = document.createElement('span');
    p.className = 'vx-puff ' + (cls || 'vx-steam');
    p.style.width = p.style.height = size.toFixed(1) + 'px';
    p.style.left = x.toFixed(1) + 'px';
    p.style.top = y.toFixed(1) + 'px';
    p.style.setProperty('--px', dx.toFixed(1) + 'px');
    p.style.setProperty('--py', dy.toFixed(1) + 'px');
    if (life) p.style.animationDuration = life + 'ms';
    ctx.wrap.appendChild(p);
    setTimeout(() => p.remove(), (life || 1300) + 100);
}

// ---------- SVG piešiniai (visi „žiūri“ į dešinę) ----------
const FX_SVG = {
    truck: '<svg viewBox="0 0 100 58" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="8" width="64" height="34" rx="4" fill="#2e8b57"/><rect x="3" y="8" width="64" height="7" rx="3" fill="#25734a"/>' +
        '<g fill="none" stroke="#e8f5e9" stroke-width="2.4"><path d="M27 33 l5 -9 l5 9 z"/></g>' +
        '<rect x="8" y="20" width="12" height="16" rx="2" fill="#25734a"/><rect x="52" y="20" width="10" height="16" rx="2" fill="#25734a"/>' +
        '<path d="M67 17 H84 Q92 17 95 30 V42 H67 Z" fill="#f2f2f2"/><path d="M71 21 H83 Q88 21 90 29 H71 Z" fill="#9fd4f5"/>' +
        '<rect x="0" y="37" width="98" height="6" rx="2" fill="#333"/><circle cx="93" cy="33" r="2.4" fill="#ffd23f"/>' +
        '<circle cx="20" cy="46" r="8" fill="#222"/><circle cx="20" cy="46" r="3.4" fill="#bbb"/>' +
        '<circle cx="47" cy="46" r="8" fill="#222"/><circle cx="47" cy="46" r="3.4" fill="#bbb"/>' +
        '<circle cx="82" cy="46" r="8" fill="#222"/><circle cx="82" cy="46" r="3.4" fill="#bbb"/></svg>',
    diver: '<svg viewBox="0 0 30 64" xmlns="http://www.w3.org/2000/svg"><g stroke="#e0a86b" stroke-width="5" stroke-linecap="round" fill="none">' +
        '<path d="M15 20 L8 4"/><path d="M15 20 L22 4"/><path d="M15 40 L11 60"/><path d="M15 40 L19 60"/></g>' +
        '<rect x="9" y="18" width="12" height="24" rx="5" fill="#e0a86b"/><rect x="9" y="33" width="12" height="9" rx="3" fill="#1e5aa8"/>' +
        '<circle cx="15" cy="12" r="6.5" fill="#e0a86b"/><path d="M8.5 11 A6.5 6.5 0 0 1 21.5 11 Z" fill="#d63a2f"/></svg>',
    swimmer: '<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="24" cy="15" rx="18" ry="6" fill="rgba(224,168,107,0.55)"/>' +
        '<g class="fx-arm fx-arm1"><rect x="34" y="4" width="16" height="4.5" rx="2.2" fill="#e0a86b"/></g>' +
        '<g class="fx-arm fx-arm2"><rect x="34" y="21.5" width="16" height="4.5" rx="2.2" fill="#e0a86b"/></g>' +
        '<circle cx="44" cy="15" r="6.5" fill="#e0a86b"/><path d="M44 8.5 A6.5 6.5 0 0 0 44 21.5 Z" fill="#d63a2f"/></svg>',
    hut: '<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="70" y="6" width="10" height="22" fill="#5b4636"/><rect x="68" y="4" width="14" height="5" fill="#3e2f24"/>' +
        '<path d="M4 40 L50 10 L96 40 Z" fill="#4a3a2e"/><path d="M10 40 L50 15 L90 40 Z" fill="#6b5442"/>' +
        '<rect x="12" y="40" width="76" height="46" fill="#a8743f"/>' +
        '<g stroke="#7d532b" stroke-width="2"><line x1="12" y1="48" x2="88" y2="48"/><line x1="12" y1="56" x2="88" y2="56"/>' +
        '<line x1="12" y1="64" x2="88" y2="64"/><line x1="12" y1="72" x2="88" y2="72"/><line x1="12" y1="80" x2="88" y2="80"/></g>' +
        '<circle cx="12" cy="48" r="3" fill="#8b5e34"/><circle cx="12" cy="64" r="3" fill="#8b5e34"/><circle cx="88" cy="56" r="3" fill="#8b5e34"/><circle cx="88" cy="72" r="3" fill="#8b5e34"/>' +
        '<rect x="62" y="50" width="16" height="12" fill="#ffcc66" stroke="#5b4636" stroke-width="2.5"/>' +
        '<rect x="30" y="50" width="22" height="36" fill="#2a1d14"/></svg>',
    door: '<svg viewBox="0 0 22 36" xmlns="http://www.w3.org/2000/svg"><rect width="22" height="36" fill="#8b5e34" stroke="#5b4636" stroke-width="2"/>' +
        '<line x1="7.3" y1="1" x2="7.3" y2="35" stroke="#6b4626" stroke-width="1.5"/><line x1="14.6" y1="1" x2="14.6" y2="35" stroke="#6b4626" stroke-width="1.5"/>' +
        '<circle cx="18" cy="19" r="1.8" fill="#e0c060"/></svg>',
    tap: '<svg viewBox="0 0 40 70" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="14" y="16" width="10" height="54" rx="2" fill="#4f6d7a"/><rect x="11" y="64" width="16" height="6" rx="2" fill="#37505c"/>' +
        '<path d="M14 18 H4 Q0 18 0 22 V28 H6 V24 H14 Z" fill="#4f6d7a"/><rect x="12" y="8" width="14" height="5" rx="2" fill="#c0392b"/><rect x="18" y="12" width="2" height="6" fill="#37505c"/></svg>',
    man: '<svg viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg">' +
        '<g class="fx-leg fx-leg1"><rect x="14" y="46" width="6" height="28" rx="3" fill="#2c3e66"/><rect x="13" y="72" width="10" height="5" rx="2" fill="#222"/></g>' +
        '<g class="fx-leg fx-leg2"><rect x="20" y="46" width="6" height="28" rx="3" fill="#24345a"/><rect x="19" y="72" width="10" height="5" rx="2" fill="#222"/></g>' +
        '<rect x="12" y="22" width="16" height="27" rx="6" fill="#4a7c3a"/>' +
        '<path d="M15 50 Q20 52 25 50" stroke="#24345a" stroke-width="2" fill="none"/>' +
        '<rect x="24" y="26" width="5" height="18" rx="2.5" fill="#e0a86b" transform="rotate(-8 26 26)"/>' +
        '<circle cx="20" cy="14" r="8" fill="#e0a86b"/><path d="M12 12 Q20 2 28 12 Z" fill="#555"/><rect x="11" y="11" width="20" height="3" rx="1.5" fill="#444"/>' +
        '<path d="M16 19 Q20 22 24 19" stroke="#7a4b2a" stroke-width="2" fill="none"/></svg>',
    bucket: '<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><path d="M5 2 Q15 -6 25 2" stroke="#666" stroke-width="2" fill="none"/>' +
        '<clipPath id="fxBucketClip"><path d="M4 4 H26 L23 28 H7 Z"/></clipPath>' +
        '<g clip-path="url(#fxBucketClip)"><rect x="0" y="0" width="30" height="30" fill="#b8c4cc"/><rect class="fx-bucket-water" x="0" y="4" width="30" height="26" fill="#3d9be9"/></g>' +
        '<path d="M4 4 H26 L23 28 H7 Z" fill="none" stroke="#6b7a85" stroke-width="2"/></svg>',
    umbrella: '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="22" x2="36" y2="60" stroke="#6b4f2a" stroke-width="2.5"/>' +
        '<path d="M4 24 Q30 -8 56 24 Z" fill="#e74c3c"/><path d="M17 24 Q30 -8 30 24 Z M30 24 Q30 -8 43 24 Z" fill="#fff"/>' +
        '<path d="M4 24 Q10 20 17 24 Q23 20 30 24 Q37 20 43 24 Q50 20 56 24" fill="none" stroke="#c0392b" stroke-width="1.5"/></svg>',
    bolt: '<svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg"><path d="M24 0 L6 34 H18 L12 60 L34 22 H22 Z" fill="#ffe14d" stroke="#ff9f1a" stroke-width="2.5" stroke-linejoin="round"/></svg>'
};

// ---------- 🗑️ ŠIUKŠLĖS: atvažiuoja šiukšliavežė, pakelia konteinerį, išvažiuoja ----------
function fxGarbage(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5200;
    const ax = c.iy !== 0 ? 1 : 0, ay = c.ix !== 0 ? 1 : 0;       // važiavimo ašis – išilgai eilės
    const vw = Math.max(64, Math.min(120, c.s * 1.5));
    const far = c.L * 2.4;
    const truck = fxEl(c, 'fx-obj fx-truck', `<div class="vx-img" style="width:${vw}px;transform:scaleX(-1);">${FX_SVG.truck}</div>`);
    const bin = fxEl(c, 'fx-obj fx-emoji', `<span style="font-size:${c.iconPx}px">🗑️</span>`);
    // Sunkvežimis atvažiuoja (iš +ašies), sustoja, laukia, išvažiuoja (į -ašį)
    const stopX = ax * vw * 0.12, stopY = ay * vw * 0.12;
    truck.animate([
        { transform: fxT(ax * far, ay * far), opacity: 0, offset: 0 },
        { transform: fxT(ax * far * 0.8, ay * far * 0.8), opacity: 1, offset: 0.06 },
        { transform: fxT(stopX, stopY), offset: 0.3, easing: 'ease-out' },
        { transform: fxT(stopX, stopY), offset: 0.66 },
        { transform: fxT(-ax * far, -ay * far), opacity: 1, offset: 0.94, easing: 'ease-in' },
        { transform: fxT(-ax * far * 1.1, -ay * far * 1.1), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Konteineris: stovi, pakeliamas virš sunkvežimio galo, apverčiamas ir „išpilamas“
    const backX = stopX + ax * vw * 0.3, backY = stopY + ay * vw * 0.3;
    bin.animate([
        { transform: fxT(0, 0), opacity: 1, offset: 0 },
        { transform: fxT(0, 0), offset: 0.32 },
        { transform: fxT(backX * 0.6, backY * 0.6 - c.s * 0.55, -20, 0.9), offset: 0.42 },
        { transform: fxT(backX, backY - c.s * 0.7, -150, 0.85), offset: 0.5 },
        { transform: fxT(backX, backY - c.s * 0.7, -150, 0.85), offset: 0.56 },
        { transform: fxT(backX * 0.6, backY * 0.6 - c.s * 0.5, -20, 0.9), offset: 0.62 },
        { transform: fxT(0, 0), opacity: 1, offset: 0.68 },
        { transform: fxT(0, 0), opacity: 1, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Išpilamos šiukšlės
    setTimeout(() => {
        ['🍌', '🥫', '📰', '🍎', '🧃'].forEach((em, i) => {
            const j = fxEl(c, 'fx-obj fx-emoji', `<span style="font-size:${c.iconPx * 0.32}px">${em}</span>`);
            const sx = backX + (Math.random() - 0.5) * 10, sy = backY - c.s * 0.75;
            j.animate([
                { transform: fxT(sx, sy, 0), opacity: 1 },
                { transform: fxT(sx + (Math.random() - 0.5) * 18, backY - c.s * 0.1, 200 + i * 40), opacity: 0 }
            ], { duration: 700 + i * 60, delay: i * 70, easing: 'ease-in', fill: 'forwards' });
        });
    }, T * 0.49);
    // Išmetamosios dujos išvažiuojant
    const tm = setInterval(() => {
        const m = new DOMMatrixReadOnly(getComputedStyle(truck).transform);
        fxPuff(c, m.e + ax * vw * 0.5, m.f + ay * vw * 0.5 + vw * 0.12, vw * 0.15, 'vx-exhaust', ax * 12, -8, 1100);
    }, 160);
    setTimeout(() => clearInterval(tm), T);
    fxEnd(c, T + 150);
}

// ---------- 💰 VMI: banknotai ir monetos sugeriami į VMI maišą, „−€100“ ir antspaudas ----------
FX_SVG.bill = '<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="58" height="28" rx="3" fill="#7fbf6a" stroke="#3f7a35" stroke-width="2"/>' +
    '<rect x="6" y="5" width="48" height="20" rx="2" fill="none" stroke="#3f7a35" stroke-width="1" stroke-dasharray="2 2"/>' +
    '<circle cx="30" cy="15" r="7" fill="#a9d99a" stroke="#3f7a35" stroke-width="1.2"/>' +
    '<text x="30" y="19" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#2f5e28">€</text>' +
    '<text x="8" y="12" font-family="Arial, sans-serif" font-size="6" font-weight="700" fill="#2f5e28">100</text>' +
    '<text x="41" y="25" font-family="Arial, sans-serif" font-size="6" font-weight="700" fill="#2f5e28">100</text></svg>';
function fxTax(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 3800;
    const field = gameState && gameState.board ? gameState.board[fieldId] : null;
    const amount = fieldId === 5 ? 100 : ((field && field.cost) || 100);
    const icon = c.cell.querySelector('.cell-bg-icon');
    // Pinigai išlekia iš lentos vidaus pusės ir sukasi į maišą
    const bw = Math.max(26, c.s * 0.48);
    for (let i = 0; i < 12; i++) {
        const isCoin = i % 3 === 2;
        const el = fxEl(c, 'fx-obj fx-money', isCoin
            ? `<span class="fx-coin" style="font-size:${bw * 0.55}px">🪙</span>`
            : `<div class="vx-img" style="width:${bw}px;">${FX_SVG.bill}</div>`);
        const spread = (Math.random() - 0.5) * 2.2;
        const d0 = c.L * (0.9 + Math.random() * 0.7);
        const sx = c.ix * d0 + (-c.iy) * spread * c.s * 0.7, sy = c.iy * d0 + c.ix * spread * c.s * 0.7;
        const mx = sx * 0.45 + (-c.iy) * spread * c.s * 0.5 + (Math.random() - 0.5) * 20, my = sy * 0.45 - c.s * 0.6;
        const r0 = Math.random() * 360;
        el.animate([
            { transform: fxT(sx, sy, r0, 0.2), opacity: 0 },
            { transform: fxT(sx, sy, r0 + 30, 1), opacity: 1, offset: 0.22 },
            { transform: fxT(mx, my, r0 + 260, 0.95), opacity: 1, offset: 0.62, easing: 'ease-in' },
            { transform: fxT(0, -c.s * 0.05, r0 + 520, 0.15), opacity: 0.9, offset: 0.97 },
            { transform: fxT(0, 0, r0 + 540, 0.05), opacity: 0 }
        ], { duration: 1500 + Math.random() * 500, delay: 150 + i * 110, easing: 'cubic-bezier(0.3, 0.1, 0.4, 1)', fill: 'forwards' });
    }
    // Maišas „ryja“ – pasipučia kiekvieną kartą
    if (icon) {
        icon.animate([
            { transform: 'translate(-50%, -50%) scale(1)' }, { transform: 'translate(-50%, -50%) scale(1.18) rotate(-4deg)', offset: 0.15 },
            { transform: 'translate(-50%, -50%) scale(0.95) rotate(3deg)', offset: 0.3 }, { transform: 'translate(-50%, -50%) scale(1.22) rotate(-3deg)', offset: 0.5 },
            { transform: 'translate(-50%, -50%) scale(0.97)', offset: 0.68 }, { transform: 'translate(-50%, -50%) scale(1.28)', offset: 0.82 },
            { transform: 'translate(-50%, -50%) scale(1)' }
        ], { duration: 2400, delay: 900, easing: 'ease-in-out' });
    }
    // −€100 kyla aukštyn
    const minus = fxEl(c, 'fx-obj fx-minus', `<span>−€${amount}</span>`);
    minus.style.setProperty('--fs', Math.max(16, c.s * 0.38) + 'px');
    minus.animate([
        { transform: fxT(c.ix * c.s * 0.4, c.iy * c.s * 0.4, 0, 0.4), opacity: 0, offset: 0 },
        { transform: fxT(c.ix * c.s * 0.4, c.iy * c.s * 0.4, 0, 0.4), opacity: 0, offset: 0.55 },
        { transform: fxT(c.ix * c.s * 0.5, c.iy * c.s * 0.5 - c.s * 0.25, 0, 1.15), opacity: 1, offset: 0.66 },
        { transform: fxT(c.ix * c.s * 0.5, c.iy * c.s * 0.5 - c.s * 0.75, 0, 1), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    // Antspaudas „SUMOKĖTA“
    const stamp = fxEl(c, 'fx-obj fx-stamp', `<span>${escapeHtml(tf('cli.vmi_stamp'))}</span>`);
    stamp.style.setProperty('--fs', Math.max(11, c.s * 0.2) + 'px');
    stamp.animate([
        { transform: fxT(0, 0, -14, 2.6), opacity: 0, offset: 0 },
        { transform: fxT(0, 0, -14, 2.6), opacity: 0, offset: 0.62 },
        { transform: fxT(0, 0, -14, 0.92), opacity: 1, offset: 0.7, easing: 'ease-in' },
        { transform: fxT(0, 0, -14, 1), opacity: 1, offset: 0.74 },
        { transform: fxT(0, 0, -14, 1), opacity: 1, offset: 0.92 },
        { transform: fxT(0, 0, -14, 1.05), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    fxEnd(c, T + 600);
}

// ---------- 🛁 SPA: putų vonia, atsipalaidavęs žmogus su agurkais ant akių, burbulai, guminė antytė ----------
FX_SVG.tub = '<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">' +
    // galva su rankšluosčiu ir agurkais
    '<circle cx="34" cy="30" r="12" fill="#f1c9a0"/>' +
    '<path d="M21 27 Q22 12 36 13 Q50 14 47 28 Q40 21 34 22 Q27 22 21 27 Z" fill="#ffffff" stroke="#e6e6e6" stroke-width="1"/>' +
    '<circle cx="46" cy="16" r="5" fill="#ffffff" stroke="#e6e6e6" stroke-width="1"/>' +
    '<circle cx="29" cy="30" r="3.6" fill="#7dc36b" stroke="#4f9a3f" stroke-width="1.2"/><circle cx="29" cy="30" r="1.6" fill="#c9eabf"/>' +
    '<circle cx="39" cy="30" r="3.6" fill="#7dc36b" stroke="#4f9a3f" stroke-width="1.2"/><circle cx="39" cy="30" r="1.6" fill="#c9eabf"/>' +
    '<path d="M30 37 Q34 40 38 37" stroke="#b5654a" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    // vonia
    '<path d="M6 44 H114 V50 Q112 70 92 72 H28 Q8 70 6 50 Z" fill="#eaf4fb" stroke="#7fa7c4" stroke-width="2.5"/>' +
    '<path d="M14 54 Q60 62 106 54" stroke="#bcd6e8" stroke-width="3" fill="none"/>' +
    '<rect x="4" y="41" width="112" height="6" rx="3" fill="#ffffff" stroke="#7fa7c4" stroke-width="2"/>' +
    '<rect x="22" y="71" width="6" height="7" rx="2" fill="#d4af37"/><rect x="92" y="71" width="6" height="7" rx="2" fill="#d4af37"/>' +
    // putos
    '<g fill="#ffffff" stroke="#dfe9f2" stroke-width="1"><circle cx="16" cy="42" r="7"/><circle cx="27" cy="39" r="8"/><circle cx="48" cy="40" r="8"/>' +
    '<circle cx="62" cy="37" r="9"/><circle cx="76" cy="40" r="8"/><circle cx="90" cy="38" r="9"/><circle cx="104" cy="41" r="7"/></g>' +
    // kranas
    '<path d="M108 41 V22 Q108 16 102 16 H98" stroke="#b8c2cc" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
function fxSpa(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5200;
    const tw = Math.max(110, Math.min(170, c.s * 2.0));
    const ox = c.ix * c.s * 0.75, oy = c.iy * c.s * 0.75;          // vonia – į lentos vidų, kad gerai matytųsi
    const tub = fxEl(c, 'fx-obj fx-tub', `<div class="vx-img" style="width:${tw}px;">${FX_SVG.tub}</div>`);
    tub.animate([
        { transform: fxT(ox, oy, 0, 0.2), opacity: 0 }, { transform: fxT(ox, oy, 0, 1.06), opacity: 1, offset: 0.09 },
        { transform: fxT(ox, oy, 0, 1), offset: 0.13 }, { transform: fxT(ox, oy, 0, 1), opacity: 1, offset: 0.88 }, { transform: fxT(ox, oy, 0, 0.6), opacity: 0 }
    ], { duration: T, fill: 'forwards', easing: 'ease-out' });
    // Guminė antytė supasi putose
    const duck = fxEl(c, 'fx-obj fx-emoji fx-duck', `<span style="font-size:${tw * 0.16}px">🦆</span>`);
    duck.animate([
        { transform: fxT(ox + tw * 0.27, oy - tw * 0.02, 0, 0), opacity: 0 }, { transform: fxT(ox + tw * 0.27, oy - tw * 0.02, -8, 1), opacity: 1, offset: 0.15 },
        { transform: fxT(ox + tw * 0.2, oy - tw * 0.04, 8, 1), offset: 0.4 }, { transform: fxT(ox + tw * 0.27, oy - tw * 0.02, -8, 1), offset: 0.65 },
        { transform: fxT(ox + tw * 0.2, oy - tw * 0.04, 6, 1), opacity: 1, offset: 0.86 }, { transform: fxT(ox + tw * 0.2, oy - tw * 0.04, 0, 0.5), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    // Muilo burbulai kyla aukštyn, siūbuoja ir sprogsta
    const bub = setInterval(() => {
        const b = fxEl(c, 'fx-bubble');
        const sz = tw * (0.07 + Math.random() * 0.1);
        b.style.width = b.style.height = sz.toFixed(1) + 'px';
        const x0 = ox + (Math.random() - 0.5) * tw * 0.8, y0 = oy - tw * 0.05;
        const rise = tw * (0.45 + Math.random() * 0.5), sway = (Math.random() - 0.5) * tw * 0.3;
        b.animate([
            { transform: `translate(${x0}px, ${y0}px) scale(0.3)`, opacity: 0 },
            { transform: `translate(${x0 + sway * 0.3}px, ${y0 - rise * 0.3}px) scale(1)`, opacity: 0.95, offset: 0.25 },
            { transform: `translate(${x0 - sway * 0.4}px, ${y0 - rise * 0.7}px) scale(1.05)`, opacity: 0.9, offset: 0.7 },
            { transform: `translate(${x0 + sway}px, ${y0 - rise}px) scale(1.5)`, opacity: 0 }
        ], { duration: 1500 + Math.random() * 900, easing: 'ease-out', fill: 'forwards' });
        setTimeout(() => b.remove(), 2500);
    }, 120);
    setTimeout(() => clearInterval(bub), T * 0.8);
    // Žvaigždutės – „atsipalaidavimas“
    [0.25, 0.45, 0.65].forEach((t, i) => setTimeout(() => {
        const s = fxEl(c, 'fx-obj fx-emoji', `<span style="font-size:${tw * 0.13}px">${i === 1 ? '💆' : '✨'}</span>`);
        const sx = ox + (i - 1) * tw * 0.38, sy = oy - tw * 0.42;
        s.animate([{ transform: fxT(sx, sy + 8, 0, 0.3), opacity: 0 }, { transform: fxT(sx, sy, 0, 1.1), opacity: 1, offset: 0.3 },
            { transform: fxT(sx, sy - 10, 0, 1), opacity: 0 }], { duration: 1400, fill: 'forwards' });
    }, T * t));
    fxEnd(c, T + 150);
}

// ---------- 🏊 BASEINAS: plaukikas šoka nuo starto į vandenį ir plaukia ----------
function fxPool(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5600;
    const len = c.L * 1.9, wid = Math.max(44, c.s * 1.05);
    const ang = Math.atan2(c.iy, c.ix) * 180 / Math.PI;          // baseinas – į lentos vidų
    const startOff = -c.L * 0.38;                                // startas – langelio išorinėje pusėje
    const holder = fxEl(c, 'fx-obj');
    holder.style.transform = `rotate(${ang}deg)`;
    const pool = fxEl(c, 'fx-pool', '<div class="fx-pool-lane"></div><div class="fx-pool-shine"></div>', holder);
    pool.style.width = len + 'px';
    pool.style.height = wid + 'px';
    pool.style.left = startOff + 'px';
    pool.style.top = (-wid / 2) + 'px';
    const block = fxEl(c, 'fx-pool-block', '', holder);
    block.style.left = (startOff - 10) + 'px';
    block.style.top = (-wid * 0.18) + 'px';
    pool.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.08 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }],
        { duration: T, fill: 'forwards' });
    block.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
    // Šuolis (vaizdas iš viršaus: plaukikas didėja – pakyla – ir mažėja – nėrimas)
    const dh = Math.max(34, wid * 0.85);
    const diver = fxEl(c, 'fx-obj', `<div class="vx-img" style="width:${dh * 0.47}px;transform:rotate(90deg);">${FX_SVG.diver}</div>`, holder);
    const x0 = startOff - 4, x1 = startOff + len * 0.22;
    diver.animate([
        { transform: fxT(x0, 0, 0, 0.9), opacity: 0, offset: 0 },
        { transform: fxT(x0, 0, 0, 0.9), opacity: 1, offset: 0.1 },
        { transform: fxT(x0 - 3, 0, 0, 0.85), offset: 0.2 },                       // pritūpia
        { transform: fxT((x0 + x1) / 2, 0, 0, 1.25), offset: 0.27, easing: 'ease-out' },
        { transform: fxT(x1, 0, 0, 0.6), opacity: 1, offset: 0.33, easing: 'ease-in' },
        { transform: fxT(x1, 0, 0, 0.4), opacity: 0, offset: 0.35 }
    ], { duration: T, fill: 'forwards' });
    // Purslai ir ratilai įšokus
    setTimeout(() => {
        for (let i = 0; i < 10; i++) {
            const d = fxEl(c, 'fx-drop', '', holder);
            const a = Math.random() * Math.PI * 2, r = wid * (0.35 + Math.random() * 0.45);
            d.animate([
                { transform: fxT(x1, 0, 0, 1), opacity: 1 },
                { transform: fxT(x1 + Math.cos(a) * r, Math.sin(a) * r, 0, 0.4), opacity: 0 }
            ], { duration: 650, easing: 'ease-out', fill: 'forwards' });
        }
        const ring = fxEl(c, 'fx-ring', '', holder);
        ring.style.left = x1 + 'px';
        ring.animate([{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 }],
            { duration: 900, easing: 'ease-out', fill: 'forwards' });
    }, T * 0.33);
    // Plaukia
    const sw = fxEl(c, 'fx-obj fx-swim', `<div class="vx-img" style="width:${wid * 0.95}px;">${FX_SVG.swimmer}</div>`, holder);
    const x2 = startOff + len - wid * 0.5;
    sw.animate([
        { transform: fxT(x1, 0), opacity: 0, offset: 0 },
        { transform: fxT(x1, 0), opacity: 0, offset: 0.36 },
        { transform: fxT(x1 + 4, 0), opacity: 1, offset: 0.4 },
        { transform: fxT(x2, 0), opacity: 1, offset: 0.86 },
        { transform: fxT(x2 + 4, 0), opacity: 0, offset: 0.92 }
    ], { duration: T, fill: 'forwards' });
    fxEnd(c, T + 150);
}

// ---------- 💡 ELEKTRA: žaibas trenkia į lemputę, lenta sumirksi, lekia žiežirbos ----------
function fxElectric(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 2600;
    // Lentos „užtemimas“ ir mirgėjimas
    const dim = fxEl(c, 'fx-dim');
    dim.style.left = (-c.pc.x) + 'px';
    dim.style.top = (-c.pc.y) + 'px';
    dim.style.width = c.board.offsetWidth + 'px';
    dim.style.height = c.board.offsetHeight + 'px';
    dim.animate([
        { opacity: 0 }, { opacity: 0.5, offset: 0.08 }, { opacity: 0.05, offset: 0.12 }, { opacity: 0.55, offset: 0.18 },
        { opacity: 0, offset: 0.24 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0.1, offset: 0.46 }, { opacity: 0.3, offset: 0.6 }, { opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    // Žaibas iš lentos vidurio pusės į langelį (zigzagas)
    const len = c.L * 2.2, steps = 7;
    let pts = [], d = '';
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, side = (i === 0 || i === steps) ? 0 : (Math.random() - 0.5) * c.s * 0.7;
        pts.push([c.ix * len * (1 - t) + (-c.iy) * side, c.iy * len * (1 - t) + c.ix * side]);
    }
    const minX = Math.min(...pts.map(p => p[0])) - 10, minY = Math.min(...pts.map(p => p[1])) - 10;
    const maxX = Math.max(...pts.map(p => p[0])) + 10, maxY = Math.max(...pts.map(p => p[1])) + 10;
    d = pts.map((p, i) => (i ? 'L' : 'M') + (p[0] - minX).toFixed(1) + ' ' + (p[1] - minY).toFixed(1)).join(' ');
    const bolt = fxEl(c, 'fx-bolt', `<svg width="${maxX - minX}" height="${maxY - minY}"><path d="${d}" stroke="#fffbe0" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="${d}" stroke="#ffe14d" stroke-width="2" fill="none"/></svg>`);
    bolt.style.left = minX + 'px';
    bolt.style.top = minY + 'px';
    bolt.animate([
        { opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.15 }, { opacity: 0.2, offset: 0.2 },
        { opacity: 1, offset: 0.24 }, { opacity: 0, offset: 0.32 }, { opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    // Lemputės švytėjimas
    const glow = fxEl(c, 'fx-glow');
    glow.style.width = glow.style.height = (c.s * 1.8) + 'px';
    glow.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(0.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.16 },
        { opacity: 0.4, transform: 'translate(-50%,-50%) scale(0.9)', offset: 0.3 }, { opacity: 0.9, transform: 'translate(-50%,-50%) scale(1.05)', offset: 0.42 },
        { opacity: 0.6, offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' }
    ], { duration: T, fill: 'forwards' });
    // Mažas ⚡ ženkliukas pašoka
    const zap = fxEl(c, 'fx-obj', `<div class="vx-img" style="width:${c.s * 0.45}px;">${FX_SVG.bolt}</div>`);
    zap.animate([
        { transform: fxT(0, 0, 0, 0.2), opacity: 0 }, { transform: fxT(c.ix * c.s * 0.5, c.iy * c.s * 0.5 - c.s * 0.3, -10, 1.1), opacity: 1, offset: 0.25 },
        { transform: fxT(c.ix * c.s * 0.5, c.iy * c.s * 0.5 - c.s * 0.35, 8, 1), opacity: 1, offset: 0.7 }, { transform: fxT(c.ix * c.s * 0.5, c.iy * c.s * 0.5 - c.s * 0.5, 0, 0.6), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    // Žiežirbos
    setTimeout(() => {
        for (let i = 0; i < 16; i++) {
            const sp = fxEl(c, 'fx-spark');
            const a = Math.random() * Math.PI * 2, r = c.s * (0.5 + Math.random() * 0.9);
            sp.style.transform = `rotate(${a * 180 / Math.PI}deg)`;
            sp.animate([
                { transform: `rotate(${a * 180 / Math.PI}deg) translateX(0) scaleX(1)`, opacity: 1 },
                { transform: `rotate(${a * 180 / Math.PI}deg) translateX(${r}px) scaleX(0.3)`, opacity: 0 }
            ], { duration: 500 + Math.random() * 300, easing: 'ease-out', fill: 'forwards' });
        }
    }, T * 0.07);
    fxEnd(c, T + 100);
}

// ---------- 🧖 PIRTIS: sena pirtelė, atsidaro durys, išeina garas ----------
function fxSauna(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5000;
    const hw = Math.max(60, Math.min(110, c.s * 1.3));
    const ox = c.ix * c.s * 0.25, oy = c.iy * c.s * 0.25;
    const hut = fxEl(c, 'fx-obj fx-hut', `<div class="vx-img" style="width:${hw}px;">${FX_SVG.hut}<div class="fx-door" style="left:${(30 / 100) * hw}px;top:${(50 / 90) * hw * 0.9}px;width:${(22 / 100) * hw}px;height:${(36 / 90) * hw * 0.9}px;">${FX_SVG.door}</div></div>`);
    hut.animate([
        { transform: fxT(ox, oy, 0, 0.2), opacity: 0 }, { transform: fxT(ox, oy, 0, 1.08), opacity: 1, offset: 0.1 },
        { transform: fxT(ox, oy, 0, 1), offset: 0.15 }, { transform: fxT(ox, oy, 0, 1), opacity: 1, offset: 0.88 }, { transform: fxT(ox, oy, 0, 0.6), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    const door = hut.querySelector('.fx-door');
    door.animate([
        { transform: 'perspective(200px) rotateY(0deg)', offset: 0 }, { transform: 'perspective(200px) rotateY(0deg)', offset: 0.24 },
        { transform: 'perspective(200px) rotateY(-80deg)', offset: 0.34, easing: 'ease-out' }, { transform: 'perspective(200px) rotateY(-80deg)', offset: 0.7 },
        { transform: 'perspective(200px) rotateY(0deg)', offset: 0.8, easing: 'ease-in' }, { transform: 'perspective(200px) rotateY(0deg)', offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Garai iš durų ir dūmai iš kamino
    const doorX = ox + (41 / 100 - 0.5) * hw, doorY = oy + (68 / 90 - 0.6) * hw * 0.9;
    const chimX = ox + (75 / 100 - 0.5) * hw, chimY = oy + (6 / 90 - 0.6) * hw * 0.9;
    const t1 = setTimeout(() => {
        const st = setInterval(() => {
            fxPuff(c, doorX + (Math.random() - 0.5) * 8, doorY, hw * (0.22 + Math.random() * 0.12), 'vx-steam',
                (Math.random() - 0.5) * 30 + c.ix * 18, -26 - Math.random() * 22 + c.iy * 10, 1600);
        }, 110);
        setTimeout(() => clearInterval(st), T * 0.42);
    }, T * 0.3);
    const sm = setInterval(() => fxPuff(c, chimX, chimY, hw * 0.13, 'vx-exhaust', 6, -20, 1400), 260);
    setTimeout(() => { clearInterval(sm); clearTimeout(t1); }, T * 0.85);
    fxEnd(c, T + 150);
}

// ---------- 💧 VANDUO: dėdė ateina prie krano, prisipila kibirą ir išeina ----------
function fxWater(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 6200;
    const mh = Math.max(58, Math.min(92, c.s * 1.45));            // žmogaus aukštis
    // Kranas – langelio centre, dėdė ateina iš lentos vidaus pusės (horizontaliai)
    const dir = c.ix !== 0 ? c.ix : 1;                            // iš kurios pusės ateina (+1 – iš dešinės)
    const tapH = mh * 0.95;
    const tap = fxEl(c, 'fx-obj', `<div class="vx-img" style="width:${tapH * 40 / 70}px;${dir < 0 ? '' : 'transform:scaleX(-1);'}">${FX_SVG.tap}</div>`);
    tap.animate([{ opacity: 0, transform: fxT(0, 0, 0, 0.5) }, { opacity: 1, transform: fxT(0, 0), offset: 0.06 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }],
        { duration: T, fill: 'forwards' });
    const spoutX = dir * (tapH * 40 / 70) * 0.42, spoutY = -tapH * 0.6 + tapH * 0.27;
    const far = c.L * 1.7, stand = spoutX + dir * mh * 0.32;
    const man = fxEl(c, 'fx-obj fx-man', `<div class="vx-img" style="width:${mh / 2}px;${dir > 0 ? 'transform:scaleX(-1);' : ''}">${FX_SVG.man}</div>`);
    const bucket = fxEl(c, 'fx-obj fx-bucket', `<div class="vx-img" style="width:${mh * 0.32}px;">${FX_SVG.bucket}</div>`);
    const water = bucket.querySelector('.fx-bucket-water');
    man.animate([
        { transform: fxT(dir * far, 0), opacity: 0, offset: 0 },
        { transform: fxT(dir * far * 0.85, 0), opacity: 1, offset: 0.05 },
        { transform: fxT(stand, 0), offset: 0.32 },
        { transform: fxT(stand, 0), offset: 0.66 },
        { transform: fxT(dir * far, 0), opacity: 1, offset: 0.95 },
        { transform: fxT(dir * far * 1.05, 0), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    const handY = mh * 0.05, under = spoutY + mh * 0.5;
    bucket.animate([
        { transform: fxT(dir * far - dir * mh * 0.28, handY), opacity: 0, offset: 0 },
        { transform: fxT(dir * far * 0.85 - dir * mh * 0.28, handY), opacity: 1, offset: 0.05 },
        { transform: fxT(stand - dir * mh * 0.28, handY), offset: 0.32 },
        { transform: fxT(spoutX, under), offset: 0.37 },              // pastato po kranu
        { transform: fxT(spoutX, under), offset: 0.6 },
        { transform: fxT(stand - dir * mh * 0.28, handY), offset: 0.66 },
        { transform: fxT(dir * far - dir * mh * 0.28, handY), opacity: 1, offset: 0.95 },
        { transform: fxT(dir * far * 1.05 - dir * mh * 0.28, handY), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    water.animate([
        { transform: 'translateY(100%)', offset: 0 }, { transform: 'translateY(100%)', offset: 0.39 },
        { transform: 'translateY(12%)', offset: 0.58 }, { transform: 'translateY(12%)', offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Vandens čiurkšlė
    const jet = fxEl(c, 'fx-jet');
    jet.style.left = spoutX + 'px';
    jet.style.top = spoutY + 'px';
    jet.style.height = Math.max(8, under - spoutY - mh * 0.12) + 'px';
    jet.animate([
        { transform: 'translateX(-50%) scaleY(0)', opacity: 0, offset: 0 }, { transform: 'translateX(-50%) scaleY(0)', opacity: 0, offset: 0.38 },
        { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: 0.41 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: 0.57 },
        { transform: 'translateX(-50%) scaleY(0.2)', opacity: 0, offset: 0.6 }, { opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Kojos eina tik einant
    man.classList.add('walking');
    setTimeout(() => man.classList.remove('walking'), T * 0.32);
    setTimeout(() => man.classList.add('walking'), T * 0.66);
    fxEnd(c, T + 150);
}

// ---------- 🏖️ PAPLŪDIMYS: jūra, smėlis, skėtis, saulė ----------
function fxBeach(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5200;
    const W = Math.max(150, c.L * 1.55), H = Math.max(90, c.s * 1.75);
    const ox = c.ix * c.L * 0.55, oy = c.iy * c.L * 0.55;
    const card = fxEl(c, 'fx-beach',
        '<div class="fx-sky"><div class="fx-sun"></div><div class="fx-gull">〰</div></div>' +
        '<div class="fx-sea"><div class="fx-wave w1"></div><div class="fx-wave w2"></div></div>' +
        '<div class="fx-sand"></div>' +
        `<div class="fx-umb">${FX_SVG.umbrella}</div><div class="fx-towel"></div><div class="fx-ball">🏐</div><div class="fx-shell">🐚</div>`);
    card.style.width = W + 'px';
    card.style.height = H + 'px';
    card.style.left = (ox - W / 2) + 'px';
    card.style.top = (oy - H / 2) + 'px';
    card.style.setProperty('--bw', W + 'px');
    card.style.setProperty('--bh', H + 'px');
    card.animate([
        { transform: 'scale(0.15)', opacity: 0, offset: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.1 },
        { transform: 'scale(1)', offset: 0.14 }, { transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(0.6)', opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards', easing: 'ease-out' });
    card.style.transformOrigin = `${W / 2 - ox}px ${H / 2 - oy}px`;   // išsiskleidžia iš langelio
    fxEnd(c, T + 100);
}

// ---------- 🎂 GIMTADIENIS: iš langelio šaudo konfeti ----------
function fxBirthday(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5600;
    const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#ff6fb5', '#1abc9c'];
    const burst = (n, delay) => {
        for (let i = 0; i < n; i++) {
            const p = fxEl(c, 'fx-confetti');
            p.style.background = colors[i % colors.length];
            const w = 5 + Math.random() * 6, h = 8 + Math.random() * 8;
            p.style.width = w + 'px';
            p.style.height = (Math.random() < 0.3 ? w : h) + 'px';
            if (Math.random() < 0.25) p.style.borderRadius = '50%';
            // Šaunama į lentos vidų ir aukštyn, išsisklaido, krenta
            const spread = (Math.random() - 0.5) * 1.6;
            const pw = c.L * (0.6 + Math.random() * 1.1);
            const vx = (c.ix + -c.iy * spread) * pw, vy = (c.iy + c.ix * spread) * pw - c.L * (0.4 + Math.random() * 0.5);
            const r1 = Math.random() * 360, r2 = r1 + (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
            p.animate([
                { transform: `translate(0px,0px) rotate(${r1}deg) rotateX(0deg)`, opacity: 1 },
                { transform: `translate(${vx * 0.7}px,${vy * 0.7}px) rotate(${(r1 + r2) / 2}deg) rotateX(360deg)`, opacity: 1, offset: 0.35 },
                { transform: `translate(${vx}px,${vy + c.L * 1.1}px) rotate(${r2}deg) rotateX(900deg)`, opacity: 0 }
            ], { duration: 1800 + Math.random() * 1100, delay, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' });
        }
    };
    for (let k = 0; k < 5; k++) burst(k === 0 ? 55 : 42, k * 650);   // 5 papliūpos
    const pop = fxEl(c, 'fx-obj fx-emoji', `<span style="font-size:${c.iconPx * 0.75}px">🎉</span>`);
    pop.animate([
        { transform: fxT(0, 0, -20, 0.3), opacity: 0 }, { transform: fxT(c.ix * c.s * 0.3, c.iy * c.s * 0.3 - c.s * 0.3, 10, 1.25), opacity: 1, offset: 0.15 },
        { transform: fxT(c.ix * c.s * 0.3, c.iy * c.s * 0.3 - c.s * 0.3, -6, 1), opacity: 1, offset: 0.7 }, { transform: fxT(c.ix * c.s * 0.3, c.iy * c.s * 0.3 - c.s * 0.5, 0, 0.7), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    fxEnd(c, T + 1200);
}

// 🚓 KELIAUK Į KALĖJIMĄ: atvažiuoja policijos autobusiukas, įsodina figūrėlę ir veža atgal
// (prieš laikrodžio rodyklę) iki KALĖJIMO, kur figūrėlė išlipa.
FX_SVG.police = '<svg viewBox="0 0 100 58" xmlns="http://www.w3.org/2000/svg">' +
    '<rect class="pv-l1" x="40" y="0" width="9" height="6" rx="2" fill="#2f6bff"/><rect class="pv-l2" x="50" y="0" width="9" height="6" rx="2" fill="#ff2f3a"/>' +
    '<rect x="38" y="5" width="23" height="3" rx="1" fill="#333"/>' +
    '<path d="M4 12 Q4 8 9 8 H74 Q82 8 88 16 L96 28 V42 H4 Z" fill="#f4f6f8"/>' +
    '<rect x="4" y="27" width="92" height="7" fill="#1f4fbf"/><rect x="4" y="34" width="92" height="2" fill="#ffd23f"/>' +
    '<rect x="10" y="13" width="14" height="11" rx="2" fill="#2b3440"/><rect x="28" y="13" width="14" height="11" rx="2" fill="#2b3440"/>' +
    '<g stroke="#9aa" stroke-width="1.2"><line x1="13" y1="13" x2="13" y2="24"/><line x1="17" y1="13" x2="17" y2="24"/><line x1="21" y1="13" x2="21" y2="24"/>' +
    '<line x1="31" y1="13" x2="31" y2="24"/><line x1="35" y1="13" x2="35" y2="24"/><line x1="39" y1="13" x2="39" y2="24"/></g>' +
    '<rect x="46" y="13" width="18" height="11" rx="2" fill="#9fd4f5"/><path d="M68 13 H76 Q80 13 84 20 L86 24 H68 Z" fill="#9fd4f5"/>' +
    '<text x="22" y="33.5" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#fff">POLICIJA</text>' +
    '<circle cx="93" cy="31" r="2.4" fill="#fff6c4"/><rect x="2" y="37" width="96" height="6" rx="2" fill="#333"/>' +
    '<circle cx="22" cy="45" r="8" fill="#222"/><circle cx="22" cy="45" r="3.4" fill="#bbb"/>' +
    '<circle cx="76" cy="45" r="8" fill="#222"/><circle cx="76" cy="45" r="3.4" fill="#bbb"/></svg>';

function playPoliceVanEffect(pid) {
    const board = document.getElementById('board');
    const from = document.getElementById('cell-42'), jail = document.getElementById('cell-16');
    if (!board || !from || !jail) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof Element.prototype.animate !== 'function') return;
    if (board.querySelector('.pv-fx')) return;
    const player = gameState && gameState.players ? gameState.players.find(p => p.id === pid) : null;

    // Maršrutas atgal: 42 → 41 → … → 27 → 26 → 25 → … → 17 → 16
    const pts = [];
    for (let id = 42; id >= 16; id--) {
        const el = document.getElementById(`cell-${id}`);
        if (el) pts.push(fxBoardPoint(el, board));
    }
    if (pts.length < 2) return;
    const p0 = pts[0];
    const cellS = Math.min(from.offsetWidth, from.offsetHeight) || 68;
    const vw = Math.max(64, Math.min(115, cellS * 1.05));
    // Atvažiavimas iš kairės (už lentos krašto) iki 42
    const startPt = { x: p0.x - vw * 1.6, y: p0.y };

    const wrap = document.createElement('div');
    wrap.className = 'fx-layer pv-fx';
    wrap.style.left = '0px';
    wrap.style.top = '0px';
    board.appendChild(wrap);
    const van = document.createElement('div');
    van.className = 'fx-obj pv-van';
    van.innerHTML = `<div class="pv-bob"><div class="vx-img" style="width:${vw}px;">${FX3_SVG.police}</div></div><div class="fx2-amb-glow"></div>`;
    wrap.appendChild(van);

    // Figūrėlės kopija ant langelio 42 (tikroji paslepiama, kol veža)
    window.animatingPlayers = window.animatingPlayers || [];
    if (!window.animatingPlayers.includes(pid)) window.animatingPlayers.push(pid);
    if (gameState) { try { updateBoard(gameState); } catch (e) {} }
    const pieceSize = Math.max(22, cellS * 0.42);
    const clone = document.createElement('div');
    clone.className = 'fx-obj pv-piece';
    clone.innerHTML = `<div class="pv-piece-in" style="width:${pieceSize}px;height:${pieceSize}px;">${player ? pieceSolid(player.piece || 'pawn', player.color) : '👤'}</div>`;
    wrap.appendChild(clone);

    // Laiko planas (ms)
    const tArrive = 1100, tLoad = 700, tDrive = 4200, tUnload = 800, tLeave = 700;
    const T = tArrive + tLoad + tDrive + tUnload + tLeave;
    const o1 = tArrive / T, o2 = (tArrive + tLoad) / T, o3 = (tArrive + tLoad + tDrive) / T, o4 = (tArrive + tLoad + tDrive + tUnload) / T;
    const ang = (a, b) => {
        const d = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        return Math.abs(d) < 45 ? 0 : (d < 0 ? -90 : 90);      // į dešinę – 0°, aukštyn – -90°
    };
    const tr = (pt, a, s = 1) => `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${a}deg) scale(${s})`;
    // Maršruto ilgiai – pagal juos paskirstomas važiavimo laikas
    let total = 0; const seg = [0];
    for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(total); }
    const kf = [
        { transform: tr(startPt, 0), opacity: 0, offset: 0 },
        { transform: tr({ x: startPt.x + vw * 0.4, y: startPt.y }, 0), opacity: 1, offset: o1 * 0.25 },
        { transform: tr(p0, 0), offset: o1, easing: 'ease-out' },
        { transform: tr(p0, 0), offset: o2 }
    ];
    let lastA = 0;
    for (let i = 1; i < pts.length; i++) {
        const a = ang(pts[i - 1], pts[i]);
        const off = o2 + (o3 - o2) * (seg[i] / total);
        if (a !== lastA) {   // posūkis kampe
            kf.push({ transform: tr(pts[i - 1], a), offset: Math.min(off - 0.0005, o2 + (o3 - o2) * (seg[i - 1] / total) + 0.012) });
            lastA = a;
        }
        kf.push({ transform: tr(pts[i], a), offset: off });
    }
    const pj = pts[pts.length - 1];
    kf.push({ transform: tr(pj, lastA), offset: o4 });
    kf.push({ transform: tr({ x: pj.x, y: pj.y - cellS * 1.4 }, lastA), opacity: 1, offset: 0.97, easing: 'ease-in' });
    kf.push({ transform: tr({ x: pj.x, y: pj.y - cellS * 1.6 }, lastA), opacity: 0, offset: 1 });
    // offset'ai turi didėti
    for (let i = 1; i < kf.length; i++) if (kf[i].offset <= kf[i - 1].offset) kf[i].offset = Math.min(1, kf[i - 1].offset + 0.0005);
    van.animate(kf, { duration: T, fill: 'forwards', easing: 'linear' });

    // Figūrėlė: stovi ant 42 → įlipa į autobusiuką → (vežama) → išlipa kalėjime
    clone.animate([
        { transform: tr(p0, 0, 1), opacity: 1, offset: 0 },
        { transform: tr(p0, 0, 1), offset: o1 },
        { transform: tr({ x: p0.x, y: p0.y - cellS * 0.35 }, 0, 1.1), offset: o1 + (o2 - o1) * 0.45, easing: 'ease-out' },
        { transform: tr({ x: p0.x, y: p0.y }, 0, 0.3), opacity: 0, offset: o2 - 0.01, easing: 'ease-in' },
        { transform: tr(pj, 0, 0.3), opacity: 0, offset: o3 },
        { transform: tr({ x: pj.x, y: pj.y - cellS * 0.35 }, 0, 1.1), opacity: 1, offset: o3 + (o4 - o3) * 0.5, easing: 'ease-out' },
        { transform: tr(pj, 0, 1), opacity: 1, offset: o4 },
        { transform: tr(pj, 0, 1), opacity: 1, offset: 1 }
    ], { duration: T, fill: 'forwards' });

    // Švyturėliai mirksi važiuojant
    van.classList.add('siren');
    setTimeout(() => { try { fxJail3(16, 'in'); } catch (e) {} }, tArrive + tLoad + tDrive - 200);
    setTimeout(() => {
        wrap.remove();
        window.animatingPlayers = (window.animatingPlayers || []).filter(id => id !== pid);
        if (gameState) { try { updateBoard(gameState); } catch (e) {} try { updateUI(gameState); } catch (e) {} }
    }, T + 80);
}

// 🚑 LIGONINĖ: greitoji atvažiuoja prie figūrėlės, paima ją ir nuveža lentos keliu iki LIGONINĖS
FX_SVG.ambulance = '<svg viewBox="0 0 100 58" xmlns="http://www.w3.org/2000/svg">' +
    '<rect class="pv-l1" x="16" y="0" width="9" height="6" rx="2" fill="#2f6bff"/><rect class="pv-l2" x="26" y="0" width="9" height="6" rx="2" fill="#ff2f3a"/>' +
    '<rect x="14" y="5" width="23" height="3" rx="1" fill="#333"/>' +
    '<path d="M4 9 Q4 7 7 7 H62 V42 H4 Z" fill="#ffffff" stroke="#d0d6dc" stroke-width="1.2"/>' +
    '<path d="M62 14 H78 Q86 14 91 24 L96 31 V42 H62 Z" fill="#ffffff" stroke="#d0d6dc" stroke-width="1.2"/>' +
    '<path d="M66 18 H77 Q82 18 86 26 H66 Z" fill="#9fd4f5"/>' +
    '<rect x="4" y="28" width="92" height="5" fill="#e53935"/>' +
    '<g fill="#e53935"><rect x="26" y="12" width="7" height="20" rx="1"/><rect x="19.5" y="18.5" width="20" height="7" rx="1"/></g>' +
    '<text x="44" y="39.5" font-family="Arial, sans-serif" font-size="5.6" font-weight="700" fill="#e53935">GREITOJI</text>' +
    '<circle cx="94" cy="35" r="2.2" fill="#fff6c4"/><rect x="2" y="40" width="96" height="5" rx="2" fill="#555"/>' +
    '<circle cx="20" cy="46" r="7.5" fill="#222"/><circle cx="20" cy="46" r="3.2" fill="#bbb"/>' +
    '<circle cx="78" cy="46" r="7.5" fill="#222"/><circle cx="78" cy="46" r="3.2" fill="#bbb"/></svg>';

function playAmbulanceRide(pid, fromPos, toPos) {
    return new Promise(resolve => {
        const board = document.getElementById('board');
        const total = (gameState && gameState.board && gameState.board.length) || 52;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const steps = (toPos - fromPos + total) % total;
        if (!board || reduce || steps === 0 || typeof Element.prototype.animate !== 'function') {
            animateMovement(pid, fromPos, toPos).then(resolve, resolve);
            return;
        }
        const player = gameState && gameState.players ? gameState.players.find(p => p.id === pid) : null;
        // Maršrutas pirmyn: fromPos → … → toPos
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const el = document.getElementById(`cell-${(fromPos + i) % total}`);
            if (el) pts.push(fxBoardPoint(el, board));
        }
        if (pts.length < 2) { animateMovement(pid, fromPos, toPos).then(resolve, resolve); return; }
        const firstCell = document.getElementById(`cell-${fromPos}`);
        const cellS = Math.min(firstCell.offsetWidth, firstCell.offsetHeight) || 68;
        const vw = Math.max(62, Math.min(110, cellS * 1.0));
        hidePlayerDot(pid);

        const wrap = document.createElement('div');
        wrap.className = 'fx-layer pv-fx amb-fx';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        board.appendChild(wrap);
        const van = document.createElement('div');
        van.className = 'fx-obj pv-van siren';
        van.innerHTML = `<div class="pv-bob"><div class="vx-img" style="width:${vw}px;">${FX2_SVG.ambulance}</div></div><div class="fx2-amb-glow"></div>`;
        wrap.appendChild(van);
        const pieceSize = Math.max(22, cellS * 0.42);
        const clone = document.createElement('div');
        clone.className = 'fx-obj pv-piece';
        clone.innerHTML = `<div class="pv-piece-in" style="width:${pieceSize}px;height:${pieceSize}px;">${player ? pieceSolid(player.piece || 'pawn', player.color) : '👤'}</div>`;
        wrap.appendChild(clone);

        // Kryptis kiekvienoje atkarpoje: horizontaliai – apverčiam, vertikaliai – pasukam
        const pose = (a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y;
            if (Math.abs(dx) >= Math.abs(dy)) return { r: 0, sx: dx < 0 ? -1 : 1 };
            return { r: dy < 0 ? -90 : 90, sx: 1 };
        };
        const tr = (pt, ps, s = 1) => `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${ps.r}deg) scale(${(ps.sx * s).toFixed(2)}, ${s})`;
        const p0 = pts[0], pEnd = pts[pts.length - 1];
        const first = pose(pts[0], pts[1]), last = pose(pts[pts.length - 2], pEnd);
        // Atvažiuoja iš už nugaros (priešinga kelio kryptimi)
        const bx = pts[0].x - pts[1].x, by = pts[0].y - pts[1].y, bl = Math.hypot(bx, by) || 1;
        const startPt = { x: p0.x + bx / bl * vw * 1.8, y: p0.y + by / bl * vw * 1.8 };
        const fx2 = pEnd.x - pts[pts.length - 2].x, fy2 = pEnd.y - pts[pts.length - 2].y, fl = Math.hypot(fx2, fy2) || 1;
        const leavePt = { x: pEnd.x + fx2 / fl * vw * 1.8, y: pEnd.y + fy2 / fl * vw * 1.8 };

        const stepMs = steps > 12 ? 110 : 200;
        const tArrive = 900, tLoad = 650, tDrive = Math.max(900, steps * stepMs), tUnload = 700, tLeave = 700;
        const T = tArrive + tLoad + tDrive + tUnload + tLeave;
        const o1 = tArrive / T, o2 = (tArrive + tLoad) / T, o3 = (tArrive + tLoad + tDrive) / T, o4 = (tArrive + tLoad + tDrive + tUnload) / T;
        let len = 0; const seg = [0];
        for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(len); }
        const kf = [
            { transform: tr(startPt, first), opacity: 0, offset: 0 },
            { transform: tr(startPt, first), opacity: 1, offset: o1 * 0.2 },
            { transform: tr(p0, first), offset: o1, easing: 'ease-out' },
            { transform: tr(p0, first), offset: o2 }
        ];
        let cur = first;
        for (let i = 1; i < pts.length; i++) {
            const ps = pose(pts[i - 1], pts[i]);
            const off = o2 + (o3 - o2) * (seg[i] / len);
            if (ps.r !== cur.r || ps.sx !== cur.sx) {
                kf.push({ transform: tr(pts[i - 1], ps), offset: o2 + (o3 - o2) * (seg[i - 1] / len) + 0.01 });
                cur = ps;
            }
            kf.push({ transform: tr(pts[i], ps), offset: off });
        }
        kf.push({ transform: tr(pEnd, last), offset: o4 });
        kf.push({ transform: tr(leavePt, last), opacity: 1, offset: 0.97, easing: 'ease-in' });
        kf.push({ transform: tr(leavePt, last), opacity: 0, offset: 1 });
        for (let i = 1; i < kf.length; i++) if (kf[i].offset <= kf[i - 1].offset) kf[i].offset = Math.min(1, kf[i - 1].offset + 0.0005);
        van.animate(kf, { duration: T, fill: 'forwards' });
        const nz = { r: 0, sx: 1 };
        clone.animate([
            { transform: tr(p0, nz, 1), opacity: 1, offset: 0 },
            { transform: tr(p0, nz, 1), offset: o1 },
            { transform: tr({ x: p0.x, y: p0.y - cellS * 0.35 }, nz, 1.1), offset: o1 + (o2 - o1) * 0.45, easing: 'ease-out' },
            { transform: tr(p0, nz, 0.3), opacity: 0, offset: o2 - 0.01, easing: 'ease-in' },
            { transform: tr(pEnd, nz, 0.3), opacity: 0, offset: o3 },
            { transform: tr({ x: pEnd.x, y: pEnd.y - cellS * 0.35 }, nz, 1.1), opacity: 1, offset: o3 + (o4 - o3) * 0.5, easing: 'ease-out' },
            { transform: tr(pEnd, nz, 1), opacity: 1, offset: o4 },
            { transform: tr(pEnd, nz, 1), opacity: 1, offset: 1 }
        ], { duration: T, fill: 'forwards' });
        // Langeliai, pro kuriuos važiuoja, trumpai pašviečia
        for (let i = 1; i <= steps; i++) {
            setTimeout(() => {
                const c = document.getElementById(`cell-${(fromPos + i) % total}`);
                if (!c) return;
                c.classList.add('highlight-yellow');
                if ((fromPos + i) % total === 0 && i < steps && typeof fxStart3 === 'function') { try { fxStart3(0, 200); } catch (e) {} }
                setTimeout(() => c.classList.remove('highlight-yellow'), i === steps ? 900 : stepMs + 60);
            }, tArrive + tLoad + (tDrive * i / steps) - stepMs * 0.5);
        }
        // Figūrėlė išlipo – žaidimas tęsiasi, greitoji dar nuvažiuoja
        setTimeout(() => { try { fx2EcgAt(toPos); } catch (e) {} }, tArrive + tLoad + tDrive);
        setTimeout(() => resolve(), tArrive + tLoad + tDrive + tUnload);
        setTimeout(() => {
            wrap.remove();
            showPlayerDot(pid, toPos);
            if (gameState) { try { updateBoard(gameState); } catch (e) {} }
        }, T + 60);
    });
}

// ============================================================
// ✨ FX2 – IŠPŪDINGI LANGELIŲ EFEKTAI (canvas dalelės + detalūs SVG)
// DUJOS #2 • VMI #5 • ORO UOSTAS #8 • SPA #11 • LIGONINĖ #13 • ŠIUKŠLĖS #14
// ============================================================
const FX2 = {
    sprites: {},
    // Minkštas apskritas „spraitas“ (radialinis gradientas) – dūmams, dujoms, garams, švytėjimui
    sprite(key, stops, size = 96) {
        if (this.sprites[key]) return this.sprites[key];
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        stops.forEach(([o, c]) => gr.addColorStop(o, c));
        g.fillStyle = gr;
        g.fillRect(0, 0, size, size);
        this.sprites[key] = cv;
        return cv;
    },
    // Debesėlis su netaisyklingais kraštais (keli persidengiantys burbulai) – tikroviškesni dūmai
    cloud(key, rgb, size = 128) {
        if (this.sprites[key]) return this.sprites[key];
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        let seed = key.length * 97;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (let i = 0; i < 9; i++) {
            const x = size * (0.3 + rnd() * 0.4), y = size * (0.3 + rnd() * 0.4), r = size * (0.18 + rnd() * 0.2);
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(${rgb},0.55)`);
            gr.addColorStop(0.6, `rgba(${rgb},0.25)`);
            gr.addColorStop(1, `rgba(${rgb},0)`);
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
        this.sprites[key] = cv;
        return cv;
    }
};

// Canvas sluoksnis aplink langelį: (0,0) – langelio centras. R – spindulys pikseliais.
function fx2Canvas(c, R, z) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.className = 'fx2-canvas';
    cv.width = Math.round(2 * R * dpr);
    cv.height = Math.round(2 * R * dpr);
    cv.style.width = cv.style.height = (2 * R) + 'px';
    cv.style.left = cv.style.top = (-R) + 'px';
    if (z) cv.style.zIndex = z;
    c.wrap.appendChild(cv);
    const g = cv.getContext('2d');
    const sys = {
        cv, g, R, ps: [], time: 0, shakeAmp: 0,
        add(p) {
            p.age = 0;
            p.vx = p.vx || 0; p.vy = p.vy || 0;
            p.size = p.size || 20; p.grow = p.grow || 0;
            p.rot = p.rot || 0; p.vr = p.vr || 0;
            p.a0 = p.a0 === undefined ? 1 : p.a0;
            p.fi = p.fi === undefined ? 0.15 : p.fi;
            p.drag = p.drag === undefined ? 0 : p.drag;
            this.ps.push(p);
            return p;
        },
        run(T, onFrame, onEnd) {
            let last = performance.now(); const t0 = last;
            const step = (now) => {
                if (!cv.isConnected) return;
                const dt = Math.min(0.05, (now - last) / 1000); last = now;
                const el = now - t0; this.time = el / 1000;
                if (onFrame) onFrame(el, dt);
                g.setTransform(1, 0, 0, 1, 0, 0);
                g.clearRect(0, 0, cv.width, cv.height);
                g.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);
                const keep = [];
                for (const p of this.ps) {
                    p.age += dt * 1000;
                    if (p.age >= p.life) continue;
                    const k = Math.pow(1 - p.drag, dt * 60);
                    p.vx = p.vx * k + (p.gx || 0) * dt;
                    p.vy = p.vy * k + (p.gy || 0) * dt;
                    if (p.turb) {
                        p.vx += Math.sin(p.y * 0.045 + this.time * 2.3 + (p.ph || 0)) * p.turb * dt;
                        p.vy += Math.cos(p.x * 0.045 + this.time * 1.9 + (p.ph || 0)) * p.turb * dt;
                    }
                    p.x += p.vx * dt; p.y += p.vy * dt;
                    p.size = Math.max(0.5, p.size + p.grow * dt);
                    p.rot += p.vr * dt;
                    const t = p.age / p.life;
                    let a = t < p.fi ? t / p.fi : 1 - (t - p.fi) / (1 - p.fi);
                    a = Math.max(0, a) * p.a0;
                    if (a <= 0.003) { keep.push(p); continue; }
                    g.globalAlpha = Math.min(1, a);
                    g.globalCompositeOperation = p.blend || 'source-over';
                    if (p.draw) { p.draw(g, p, t); }
                    else if (p.rect) {
                        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
                        g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size * (p.ar || 0.6) / 2, p.size, p.size * (p.ar || 0.6));
                        g.restore();
                    } else if (p.line) {
                        g.strokeStyle = p.color; g.lineWidth = p.lw || 1.5; g.lineCap = 'round';
                        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * (p.trail || 0.04), p.y - p.vy * (p.trail || 0.04)); g.stroke();
                    } else {
                        const s = p.size;
                        if (p.rot) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(p.sprite, -s / 2, -s / 2, s, s); g.restore(); }
                        else g.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
                    }
                    keep.push(p);
                }
                g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
                this.ps = keep;
                if (el < T || this.ps.length) requestAnimationFrame(step);
                else { cv.remove(); if (onEnd) onEnd(); }
            };
            requestAnimationFrame(step);
        }
    };
    return sys;
}
const fx2R = (a, b) => a + Math.random() * (b - a);
function fx2Shake(el, amp = 6, ms = 380) {
    if (!el || !el.animate) return;
    const k = [];
    for (let i = 0; i <= 8; i++) {
        const f = 1 - i / 8;
        k.push({ translate: `${(Math.random() - 0.5) * 2 * amp * f}px ${(Math.random() - 0.5) * 2 * amp * f}px` });
    }
    el.animate(k, { duration: ms });
}

// ---------- Detalūs SVG piešiniai ----------
const FX2_SVG = {
    // Pramoninis dujų vožtuvas su raudonu ratu ir manometru (žiūri į dešinę)
    valve: `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2pipeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf1"/><stop offset=".35" stop-color="#a9b3bd"/><stop offset=".7" stop-color="#6d7884"/><stop offset="1" stop-color="#3e4750"/></linearGradient>
        <linearGradient id="f2bodyG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset=".5" stop-color="#f2b705"/><stop offset="1" stop-color="#9c6b00"/></linearGradient>
        <radialGradient id="f2wheelG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff8a80"/><stop offset=".5" stop-color="#e53935"/><stop offset="1" stop-color="#7f0000"/></radialGradient>
        <radialGradient id="f2gaugeG" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd8dc"/></radialGradient>
      </defs>
      <rect x="0" y="66" width="160" height="26" rx="6" fill="url(#f2pipeG)"/>
      <rect x="10" y="62" width="12" height="34" rx="3" fill="#59636d"/><rect x="138" y="62" width="12" height="34" rx="3" fill="#59636d"/>
      <path d="M52 56 h56 l8 22 -8 22 h-56 l-8 -22z" fill="url(#f2bodyG)" stroke="#7a5300" stroke-width="2"/>
      <rect x="74" y="34" width="12" height="24" fill="url(#f2pipeG)"/>
      <g class="fx2-wheel" style="transform-origin:80px 30px">
        <circle cx="80" cy="30" r="24" fill="none" stroke="url(#f2wheelG)" stroke-width="7"/>
        <g stroke="#c62828" stroke-width="5" stroke-linecap="round"><line x1="80" y1="8" x2="80" y2="52"/><line x1="58" y1="30" x2="102" y2="30"/><line x1="64" y1="14" x2="96" y2="46"/><line x1="96" y1="14" x2="64" y2="46"/></g>
        <circle cx="80" cy="30" r="7" fill="#b71c1c" stroke="#ffcdd2" stroke-width="1.5"/>
      </g>
      <g transform="translate(118 30)">
        <circle r="17" fill="#455a64"/><circle r="14" fill="url(#f2gaugeG)"/>
        <path d="M-10 6 A12 12 0 1 1 10 6" fill="none" stroke="#e53935" stroke-width="2.5" stroke-dasharray="6 3"/>
        <g class="fx2-needle"><line x1="0" y1="0" x2="0" y2="-11" stroke="#212121" stroke-width="2" stroke-linecap="round"/></g>
        <circle r="2.2" fill="#212121"/>
      </g>
      <rect x="114" y="46" width="8" height="22" fill="url(#f2pipeG)"/>
      <text x="80" y="84" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="15" fill="#5c3d00">GAS</text>
    </svg>`,

    // Banknotas (bendras „euro“ stilius, ne tikras dizainas) su holograma
    note: (c1, c2) => `<svg viewBox="0 0 120 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2nb${c1.slice(1)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
        <pattern id="f2ng" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="rgba(255,255,255,.18)" stroke-width="1"/></pattern>
        <linearGradient id="f2holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd1ff"/><stop offset=".33" stop-color="#b3f5ff"/><stop offset=".66" stop-color="#fff3b0"/><stop offset="1" stop-color="#c8ffd4"/></linearGradient>
      </defs>
      <rect x="1" y="1" width="118" height="62" rx="5" fill="url(#f2nb${c1.slice(1)})" stroke="rgba(0,0,0,.35)"/>
      <rect x="1" y="1" width="118" height="62" rx="5" fill="url(#f2ng)"/>
      <rect x="6" y="6" width="108" height="52" rx="3" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1" stroke-dasharray="2 2"/>
      <rect x="78" y="1" width="10" height="62" fill="url(#f2holo)" opacity=".85"/>
      <circle cx="42" cy="32" r="15" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.6)"/>
      <text x="42" y="39" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="20" fill="#fff">€</text>
      <text x="10" y="18" font-family="Arial Black,Arial" font-weight="900" font-size="11" fill="#fff">100</text>
      <text x="110" y="57" text-anchor="end" font-family="Arial Black,Arial" font-weight="900" font-size="13" fill="#fff">100</text>
    </svg>`,

    coin: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="f2cg" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff8d6"/><stop offset=".35" stop-color="#ffd54f"/><stop offset=".8" stop-color="#c79100"/><stop offset="1" stop-color="#8d6400"/></radialGradient></defs>
      <circle cx="30" cy="30" r="28" fill="url(#f2cg)" stroke="#7a5600" stroke-width="2"/>
      <circle cx="30" cy="30" r="21" fill="none" stroke="rgba(122,86,0,.55)" stroke-width="2"/>
      <text x="30" y="39" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#8d6400">€</text>
      <ellipse cx="22" cy="18" rx="9" ry="4" fill="rgba(255,255,255,.55)" transform="rotate(-30 22 18)"/>
    </svg>`,

    // Lėktuvas iš viršaus (nosis į viršų)
    plane: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2fus" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9c3cc"/><stop offset=".3" stop-color="#ffffff"/><stop offset=".7" stop-color="#f4f7fa"/><stop offset="1" stop-color="#9aa6b1"/></linearGradient>
        <linearGradient id="f2wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f6f9"/><stop offset="1" stop-color="#aeb9c3"/></linearGradient>
        <linearGradient id="f2eng" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b7784"/><stop offset=".5" stop-color="#cfd6dd"/><stop offset="1" stop-color="#5a6570"/></linearGradient>
      </defs>
      <path d="M100 52 L190 108 L190 118 L104 100 Z" fill="url(#f2wing)" stroke="#8f9ba6" stroke-width="1"/>
      <path d="M100 52 L10 108 L10 118 L96 100 Z" fill="url(#f2wing)" stroke="#8f9ba6" stroke-width="1"/>
      <rect x="132" y="80" width="10" height="26" rx="4" fill="url(#f2eng)"/><rect x="58" y="80" width="10" height="26" rx="4" fill="url(#f2eng)"/>
      <rect x="160" y="94" width="8" height="20" rx="3" fill="url(#f2eng)"/><rect x="32" y="94" width="8" height="20" rx="3" fill="url(#f2eng)"/>
      <path d="M100 160 L140 182 L140 188 L102 178 Z" fill="url(#f2wing)" stroke="#8f9ba6"/>
      <path d="M100 160 L60 182 L60 188 L98 178 Z" fill="url(#f2wing)" stroke="#8f9ba6"/>
      <path d="M100 6 C110 14 112 30 112 50 L112 168 C112 182 106 194 100 198 C94 194 88 182 88 168 L88 50 C88 30 90 14 100 6 Z" fill="url(#f2fus)" stroke="#8f9ba6" stroke-width="1.2"/>
      <path d="M93 22 Q100 14 107 22 L106 28 Q100 24 94 28 Z" fill="#2b3a4a"/>
      <rect x="98.5" y="40" width="3" height="120" fill="#ffd23f"/><rect x="96" y="160" width="8" height="30" rx="3" fill="#1f7a46"/>
      <g fill="#5f7f9c">${Array.from({ length: 14 }, (_, i) => `<rect x="90.5" y="${42 + i * 8}" width="2" height="3" rx="1"/><rect x="107.5" y="${42 + i * 8}" width="2" height="3" rx="1"/>`).join('')}</g>
      <circle cx="10" cy="113" r="2.5" fill="#ff1744"/><circle cx="190" cy="113" r="2.5" fill="#00e676"/>
    </svg>`,

    lotus: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2pet" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6fa8"/><stop offset=".55" stop-color="#ffb3cf"/><stop offset="1" stop-color="#fff1f6"/></linearGradient>
        <linearGradient id="f2pet2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e94f8b"/><stop offset="1" stop-color="#ffd3e4"/></linearGradient>
        <radialGradient id="f2leaf" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#7ed957"/><stop offset=".7" stop-color="#2e9e4b"/><stop offset="1" stop-color="#1b6b33"/></radialGradient>
        <radialGradient id="f2core" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff7b0"/><stop offset="1" stop-color="#ffb300"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="84" ry="20" fill="url(#f2leaf)"/><path d="M100 118 L170 108" stroke="#1b6b33" stroke-width="2"/>
      <g class="fx2-petals">
        ${[-70, -48, -26, 26, 48, 70].map((a, i) => `<path class="fx2-petal p${i}" style="--a:${a}deg" d="M100 112 C80 86 86 52 100 34 C114 52 120 86 100 112 Z" fill="url(#f2pet2)" stroke="#d63c7a" stroke-width="1"/>`).join('')}
        ${[-22, 0, 22].map((a, i) => `<path class="fx2-petal q${i}" style="--a:${a}deg" d="M100 112 C82 84 88 46 100 26 C112 46 118 84 100 112 Z" fill="url(#f2pet)" stroke="#e05790" stroke-width="1"/>`).join('')}
      </g>
      <ellipse cx="100" cy="98" rx="12" ry="7" fill="url(#f2core)"/>
    </svg>`,

    candle: `<svg viewBox="0 0 40 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9dccb"/><stop offset=".4" stop-color="#fffaf2"/><stop offset="1" stop-color="#d8c7b1"/></linearGradient>
        <radialGradient id="f2flm" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#fff59d"/><stop offset=".75" stop-color="#ffa000"/><stop offset="1" stop-color="rgba(255,111,0,0)"/></radialGradient>
      </defs>
      <ellipse cx="20" cy="40" rx="18" ry="18" fill="rgba(255,200,90,.35)" class="fx2-halo"/>
      <rect x="10" y="40" width="20" height="46" rx="4" fill="url(#f2wax)"/>
      <ellipse cx="20" cy="40" rx="10" ry="3" fill="#f3e7d6"/>
      <line x1="20" y1="40" x2="20" y2="33" stroke="#3e2723" stroke-width="1.6"/>
      <path class="fx2-flame" d="M20 14 C26 24 26 30 20 35 C14 30 14 24 20 14 Z" fill="url(#f2flm)"/>
    </svg>`,

    ambulance: '<svg viewBox="0 0 120 64" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="f2abody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eef2f6"/><stop offset="1" stop-color="#c7d0d9"/></linearGradient>' +
        '<linearGradient id="f2aglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfeeff"/><stop offset=".45" stop-color="#6fa8d6"/><stop offset="1" stop-color="#1e3d5c"/></linearGradient>' +
        '<radialGradient id="f2awheel" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e0e0e0"/><stop offset=".35" stop-color="#9e9e9e"/><stop offset=".45" stop-color="#212121"/><stop offset="1" stop-color="#111"/></radialGradient></defs>' +
        '<ellipse cx="60" cy="58" rx="54" ry="4" fill="rgba(0,0,0,.25)"/>' +
        '<path d="M4 14 Q4 8 10 8 H76 V50 H4 Z" fill="url(#f2abody)" stroke="#aab4be"/>' +
        '<path d="M76 16 H94 Q102 16 108 28 L114 36 Q116 40 116 44 V50 H76 Z" fill="url(#f2abody)" stroke="#aab4be"/>' +
        '<path d="M80 20 H93 Q99 20 104 30 L106 34 H80 Z" fill="url(#f2aglass)"/><path d="M82 22 L90 22 L84 32 Z" fill="rgba(255,255,255,.55)"/>' +
        '<rect x="4" y="34" width="112" height="6" fill="#ff5a1f"/><rect x="4" y="41" width="112" height="2.5" fill="#1565c0"/>' +
        '<rect x="12" y="15" width="22" height="14" rx="2" fill="url(#f2aglass)"/>' +
        '<g fill="#e53935"><rect x="48" y="12" width="8" height="22" rx="1.5"/><rect x="41" y="19" width="22" height="8" rx="1.5"/></g>' +
        '<text x="40" y="48.5" font-family="Arial Black,Arial" font-size="5.6" font-weight="900" fill="#e53935" text-anchor="middle">GREITOJI</text>' +
        '<rect class="pv-l1" x="14" y="2" width="12" height="6" rx="2" fill="#2979ff"/><rect class="pv-l2" x="28" y="2" width="12" height="6" rx="2" fill="#ff1744"/>' +
        '<rect x="12" y="7" width="30" height="2" fill="#37474f"/>' +
        '<circle cx="114" cy="40" r="2.4" fill="#fff59d"/><rect x="1" y="44" width="5" height="4" rx="1" fill="#c62828"/>' +
        '<circle cx="24" cy="51" r="9" fill="url(#f2awheel)"/><circle cx="94" cy="51" r="9" fill="url(#f2awheel)"/>' +
        '<circle cx="24" cy="51" r="2" fill="#bdbdbd"/><circle cx="94" cy="51" r="2" fill="#bdbdbd"/></svg>',

    // Šiukšliavežė su hidrauline ranka (žiūri į dešinę)
    truck: `<svg viewBox="0 0 170 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f2tbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd38d"/><stop offset=".55" stop-color="#2e9e5b"/><stop offset="1" stop-color="#1b6b3c"/></linearGradient>
        <linearGradient id="f2tcab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd8dc"/></linearGradient>
        <linearGradient id="f2tglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f2ff"/><stop offset=".5" stop-color="#6aa5d4"/><stop offset="1" stop-color="#1d3b58"/></linearGradient>
        <radialGradient id="f2twheel" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e0e0e0"/><stop offset=".3" stop-color="#9e9e9e"/><stop offset=".42" stop-color="#262626"/><stop offset="1" stop-color="#0d0d0d"/></radialGradient>
      </defs>
      <ellipse cx="85" cy="84" rx="80" ry="5" fill="rgba(0,0,0,.25)"/>
      <path d="M6 18 Q6 10 14 10 H112 V66 H6 Z" fill="url(#f2tbody)" stroke="#145a32" stroke-width="1.5"/>
      <g stroke="rgba(0,0,0,.18)" stroke-width="3">${[22, 38, 54, 70, 86, 102].map(x => `<line x1="${x}" y1="14" x2="${x}" y2="62"/>`).join('')}</g>
      <path d="M50 30 l7 -12 l7 12 z M44 40 h26" fill="none" stroke="#e8f5e9" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M112 22 H140 Q152 22 158 38 L164 48 V66 H112 Z" fill="url(#f2tcab)" stroke="#90a4ae" stroke-width="1.5"/>
      <path d="M118 28 H139 Q148 28 152 40 H118 Z" fill="url(#f2tglass)"/><path d="M121 30 L130 30 L123 39 Z" fill="rgba(255,255,255,.5)"/>
      <rect x="112" y="46" width="52" height="6" fill="#2e9e5b"/>
      <rect class="tr-beacon" x="122" y="16" width="10" height="6" rx="2" fill="#ffb300"/>
      <rect x="2" y="60" width="166" height="8" rx="3" fill="#37474f"/>
      <circle cx="162" cy="56" r="2.4" fill="#fff59d"/>
      <g><circle cx="30" cy="72" r="12" fill="url(#f2twheel)"/><circle cx="62" cy="72" r="12" fill="url(#f2twheel)"/><circle cx="138" cy="72" r="12" fill="url(#f2twheel)"/>
         <circle cx="30" cy="72" r="3" fill="#bdbdbd"/><circle cx="62" cy="72" r="3" fill="#bdbdbd"/><circle cx="138" cy="72" r="3" fill="#bdbdbd"/></g>
    </svg>`,

    // Žalias konteineris su dangčiu (dangtis – atskiras elementas)
    bin: `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="f2bing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f7a3f"/><stop offset=".45" stop-color="#43b86a"/><stop offset="1" stop-color="#155c2e"/></linearGradient></defs>
      <path d="M8 18 H52 L48 74 H12 Z" fill="url(#f2bing)" stroke="#0f4421" stroke-width="1.5"/>
      <g stroke="rgba(0,0,0,.18)" stroke-width="2.5"><line x1="20" y1="24" x2="21" y2="70"/><line x1="30" y1="24" x2="30" y2="70"/><line x1="40" y1="24" x2="39" y2="70"/></g>
      <path d="M24 44 l6 -9 l6 9 z" fill="none" stroke="#e8f5e9" stroke-width="2"/>
      <circle cx="14" cy="74" r="5" fill="#222"/><circle cx="46" cy="74" r="5" fill="#222"/>
      <g class="bin-lid"><rect x="4" y="10" width="52" height="9" rx="3" fill="#2e9e5b" stroke="#0f4421" stroke-width="1.5"/><rect x="24" y="6" width="12" height="5" rx="2" fill="#155c2e"/></g>
    </svg>`
};

// ============================================================
// 💨 DUJOS #2 – vožtuvas atsisuka, šnypščia, iškyla dujų debesis, kibirkštis ir mėlyna liepsna
// ============================================================
function fxGas2(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 4600;
    const vw = Math.max(110, c.L * 1.7);
    const ox = c.ix * c.L * 0.95, oy = c.iy * c.L * 0.95;
    const flip = c.ix < 0 || (c.ix === 0 && c.pc.x > c.board.offsetWidth / 2);
    const valve = fxEl(c, 'fx-obj fx2-valve', `<div class="vx-img" style="width:${vw}px;${flip ? 'transform:scaleX(-1)' : ''}">${FX2_SVG.valve}</div>`);
    valve.animate([
        { transform: fxT(ox, oy + 18, 0, 0.3), opacity: 0 }, { transform: fxT(ox, oy, 0, 1.08), opacity: 1, offset: 0.07 },
        { transform: fxT(ox, oy, 0, 1), offset: 0.11 }, { transform: fxT(ox, oy, 0, 1), opacity: 1, offset: 0.58 },
        { transform: fxT(ox, oy - 6, flip ? 8 : -8, 1.04), offset: 0.61 }, { transform: fxT(ox, oy, 0, 1), opacity: 1, offset: 0.66 },
        { transform: fxT(ox, oy, 0, 1), opacity: 1, offset: 0.86 }, { transform: fxT(ox, oy, 0, 0.8), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    const wheel = valve.querySelector('.fx2-wheel');
    if (wheel) wheel.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)', offset: 0.09 }, { transform: 'rotate(-540deg)', offset: 0.3 }, { transform: 'rotate(-540deg)' }],
        { duration: T, fill: 'forwards' });
    const needle = valve.querySelector('.fx2-needle');
    if (needle) needle.animate([{ transform: 'rotate(-120deg)' }, { transform: 'rotate(-120deg)', offset: 0.16 }, { transform: 'rotate(95deg)', offset: 0.4 },
        { transform: 'rotate(70deg)', offset: 0.44 }, { transform: 'rotate(110deg)', offset: 0.5 }, { transform: 'rotate(85deg)', offset: 0.55 }, { transform: 'rotate(118deg)', offset: 0.6 }, { transform: 'rotate(-120deg)', offset: 0.75 }, { transform: 'rotate(-120deg)' }],
        { duration: T, fill: 'forwards' });
    // Įspėjimo ženklas
    const warn = fxEl(c, 'fx-obj fx2-warn', '<span>⚠</span>');
    warn.style.setProperty('--fs', Math.max(22, c.L * 0.42) + 'px');
    const wx = ox + (flip ? 1 : -1) * vw * 0.38, wy = oy - vw * 0.42;
    warn.animate([{ transform: fxT(wx, wy, 0, 0), opacity: 0 }, { transform: fxT(wx, wy, 0, 0), opacity: 0, offset: 0.2 }, { transform: fxT(wx, wy, -8, 1.2), opacity: 1, offset: 0.26 },
        { transform: fxT(wx, wy, 8, 1), offset: 0.34 }, { transform: fxT(wx, wy, -6, 1.1), offset: 0.42 }, { transform: fxT(wx, wy, 6, 1), offset: 0.5 }, { transform: fxT(wx, wy, 0, 1), opacity: 1, offset: 0.58 }, { transform: fxT(wx, wy, 0, 0.5), opacity: 0, offset: 0.62 }, { opacity: 0 }],
        { duration: T, fill: 'forwards' });

    const R = Math.max(c.L * 3, 320);
    const sys = fx2Canvas(c, R);
    const nozX = ox + (flip ? -1 : 1) * vw * 0.5, nozY = oy + vw * 0.05;
    let dirX = (flip ? -1 : 1) * 0.55 + c.ix * 0.8, dirY = c.iy * 0.9 + 0.15; const dl = Math.hypot(dirX, dirY) || 1; dirX /= dl; dirY /= dl;
    const gasSpr = [FX2.cloud('gasA', '150,215,40'), FX2.cloud('gasB', '200,232,80'), FX2.cloud('gasC', '110,180,60')];
    const smokeSpr = [FX2.cloud('smk', '55,58,55'), FX2.cloud('smk2', '95,95,90')];
    const blue = FX2.sprite('blueFlame', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(160,230,255,.95)'], [0.55, 'rgba(40,120,255,.7)'], [1, 'rgba(20,40,255,0)']]);
    const fire = FX2.sprite('fireBall', [[0, 'rgba(255,255,240,1)'], [0.2, 'rgba(255,230,120,.95)'], [0.5, 'rgba(255,120,20,.75)'], [0.8, 'rgba(200,30,0,.25)'], [1, 'rgba(120,0,0,0)']]);
    const warmSpr = FX2.sprite('warmGlow', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,220,120,.9)'], [1, 'rgba(255,120,0,0)']]);
    let ignited = false;
    const bx = nozX + dirX * c.L * 0.9, by = nozY + dirY * c.L * 0.9;   // debesies centras
    sys.run(T, (el) => {
        const t = el / T;
        if (t > 0.16 && t < 0.6) {
            for (let i = 0; i < 4; i++) sys.add({
                x: nozX, y: nozY, vx: dirX * fx2R(420, 620) + fx2R(-50, 50), vy: dirY * fx2R(420, 620) + fx2R(-50, 50),
                drag: 0.07, life: fx2R(260, 420), sprite: gasSpr[1], size: fx2R(8, 16), grow: 110, a0: 0.6, fi: 0.05
            });
            for (let i = 0; i < 3; i++) sys.add({
                x: nozX + dirX * fx2R(20, 80), y: nozY + dirY * fx2R(20, 80), vx: dirX * fx2R(60, 190) + fx2R(-60, 60), vy: dirY * fx2R(60, 190) + fx2R(-80, 30),
                drag: 0.025, turb: 160, ph: Math.random() * 6, life: fx2R(1600, 2600), sprite: gasSpr[i % 3], size: fx2R(40, 80), grow: fx2R(80, 140),
                rot: Math.random() * 6, vr: fx2R(-0.7, 0.7), a0: fx2R(0.55, 0.85), fi: 0.15
            });
        }
        if (!ignited && t > 0.58) {
            ignited = true;
            fx2Shake(c.board, 6, 450);
            const flash = fxEl(c, 'fx2-flash'); flash.style.width = flash.style.height = (R * 1.5) + 'px';
            flash.style.left = bx + 'px'; flash.style.top = by + 'px';
            flash.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.3)' }],
                { duration: 1000, fill: 'forwards' });
            // smūgio banga
            sys.add({ x: bx, y: by, life: 650, a0: 0.9, fi: 0.02, size: 10, grow: R * 1.6,
                draw: (g, p, tt) => { g.strokeStyle = 'rgba(255,240,200,.9)'; g.lineWidth = 6 * (1 - tt) + 1; g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.stroke(); } });
            for (let i = 0; i < 110; i++) {
                const a = Math.random() * Math.PI * 2, sp = fx2R(40, 330), isBlue = Math.random() < 0.35;
                sys.add({ x: bx + fx2R(-c.L * 0.4, c.L * 0.4), y: by + fx2R(-c.L * 0.4, c.L * 0.4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, gy: -180, drag: 0.06,
                    life: fx2R(500, 1100), sprite: isBlue ? blue : fire, size: fx2R(30, 70), grow: 40, blend: 'lighter', a0: 0.85, fi: 0.06 });
            }
            for (let i = 0; i < 40; i++) {
                const a = Math.random() * Math.PI * 2, sp = fx2R(200, 520);
                sys.add({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, gy: 520, drag: 0.02, life: fx2R(500, 1000),
                    line: true, color: '#ffe9a8', lw: 2, trail: 0.05, blend: 'lighter', a0: 1, fi: 0.02 });
            }
            sys.add({ x: bx, y: by, life: 800, sprite: warmSpr, size: R * 0.8, grow: R * 0.6, blend: 'lighter', a0: 0.5, fi: 0.05 });
            sys.ps.forEach(p => { if (p.sprite && gasSpr.includes(p.sprite)) { p.sprite = smokeSpr[Math.random() < 0.5 ? 0 : 1]; p.life = Math.min(p.life, p.age + fx2R(900, 1500)); p.a0 *= 0.55; p.gy = -40; } });
        }
        if (ignited && t > 0.62 && t < 0.88 && Math.random() < 0.6) {
            sys.add({ x: bx + fx2R(-c.L * 0.5, c.L * 0.5), y: by + fx2R(-c.L * 0.3, c.L * 0.3), vx: fx2R(-15, 15), vy: fx2R(-70, -40), turb: 50, life: fx2R(1100, 1700),
                sprite: smokeSpr[1], size: fx2R(40, 70), grow: 50, a0: 0.4, fi: 0.2 });
        }
        if (ignited && t < 0.82) {
            sys.add({ x: nozX + fx2R(-4, 4), y: nozY, vx: dirX * fx2R(80, 140), vy: dirY * fx2R(80, 140) - 60, gy: -140, life: fx2R(260, 420),
                sprite: blue, size: fx2R(18, 32), grow: -10, blend: 'lighter', a0: 0.95, fi: 0.1 });
        }
    });
    fxEnd(c, T + 1700);
}

// ============================================================
// 💰 VMI #5 – stiklinė mokėjimo kortelė, skaitiklis, banknotai/monetos į seifą, kvitas ir antspaudas
// ============================================================
function fxTax2(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5200;
    const field = gameState && gameState.board ? gameState.board[fieldId] : null;
    const amount = fieldId === 5 ? 100 : ((field && field.cost) || 100);
    const cw = Math.max(170, c.L * 1.35), ch = cw * 0.62;
    const cx = c.ix * c.L * 0.75, cy = c.iy * c.L * 0.75;
    const card = fxEl(c, 'fx2-card',
        `<div class="fx2-card-top"><span class="fx2-logo">VMI</span><span class="fx2-chip"></span></div>` +
        `<div class="fx2-card-lbl">${escapeHtml(tf('cli.vmi_tax_label'))}</div>` +
        `<div class="fx2-card-amt">−€<span class="fx2-num">0</span></div>` +
        `<div class="fx2-card-bar"><i></i></div>`);
    card.style.width = cw + 'px'; card.style.height = ch + 'px';
    card.style.left = (cx - cw / 2) + 'px'; card.style.top = (cy - ch / 2) + 'px';
    card.style.setProperty('--fs', (cw / 9) + 'px');
    card.animate([
        { transform: 'perspective(600px) rotateX(55deg) scale(.4)', opacity: 0 }, { transform: 'perspective(600px) rotateX(-8deg) scale(1.04)', opacity: 1, offset: 0.1 },
        { transform: 'perspective(600px) rotateX(0deg) scale(1)', offset: 0.14 }, { transform: 'perspective(600px) rotateX(0deg) scale(1)', opacity: 1, offset: 0.9 },
        { transform: 'perspective(600px) rotateX(20deg) scale(.85)', opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    const bar = card.querySelector('.fx2-card-bar i');
    bar.animate([{ width: '0%' }, { width: '0%', offset: 0.15 }, { width: '100%', offset: 0.66 }, { width: '100%' }], { duration: T, fill: 'forwards' });
    const num = card.querySelector('.fx2-num');
    const t0 = performance.now();
    const tick = () => {
        if (!num.isConnected) return;
        const k = Math.min(1, Math.max(0, ((performance.now() - t0) / T - 0.15) / 0.5));
        num.textContent = Math.round(amount * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Banknotai ir monetos – spirale į kortelę
    const nw = Math.max(46, c.s * 0.8);
    const notes = [['#2aa198', '#11695f'], ['#3f7bd9', '#1d3f87'], ['#8e5bd6', '#4b2a86'], ['#2e9e5b', '#145a32']];
    for (let i = 0; i < 12; i++) {
        const isCoin = i % 3 === 2;
        const [c1, c2] = notes[i % notes.length];
        const el = fxEl(c, 'fx-obj fx2-money', isCoin
            ? `<div class="vx-img fx2-spin" style="width:${nw * 0.42}px;animation-delay:${-i * 0.13}s">${FX2_SVG.coin}</div>`
            : `<div class="vx-img fx2-flip" style="width:${nw}px;animation-delay:${-i * 0.17}s">${FX2_SVG.note(c1, c2)}</div>`);
        const ang = fx2R(0, Math.PI * 2), rad = c.L * fx2R(0.9, 1.5);
        const sx = cx + Math.cos(ang) * rad - c.ix * c.L * 0.6, sy = cy + Math.sin(ang) * rad * 0.7 - c.iy * c.L * 0.6;
        const k = [];
        for (let j = 0; j <= 10; j++) {
            const f = j / 10, a = ang + f * 3.2, r = rad * (1 - f) * (1 - f * 0.1);
            k.push({ transform: fxT(cx + Math.cos(a) * r * (1 - f) + (sx - cx) * (1 - f) * 0.2, cy + Math.sin(a) * r * 0.7 * (1 - f) + (sy - cy) * (1 - f) * 0.2, (1 - f) * 260, 1 - f * 0.75), opacity: j === 0 ? 0 : (j === 10 ? 0 : 1), offset: f });
        }
        el.animate(k, { duration: fx2R(1400, 1800), delay: 600 + i * 120, fill: 'both' });
    }
    // Kibirkštėlės (canvas)
    const sys = fx2Canvas(c, Math.max(c.L * 2.2, 280), 3);
    const sparkle = FX2.sprite('gold', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,236,150,.9)'], [1, 'rgba(255,190,0,0)']], 48);
    sys.run(T * 0.75, (el) => {
        const t = el / T;
        if (t > 0.16 && t < 0.62 && Math.random() < 0.7) {
            const a = Math.random() * Math.PI * 2, r = fx2R(cw * 0.2, cw * 0.6);
            sys.add({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 40, life: fx2R(500, 900), sprite: sparkle, size: fx2R(6, 16), grow: -6, blend: 'lighter', a0: 1, fi: 0.3 });
        }
    });
    // Kvitas išlenda iš kortelės apačios
    const rc = fxEl(c, 'fx2-receipt',
        `<b>${escapeHtml(tf('cli.vmi_receipt'))}</b><span>VMI • ${new Date().toLocaleDateString()}</span>` +
        `<span class="fx2-r-line">${escapeHtml(tf('cli.vmi_tax_label'))} <i>€${amount}.00</i></span>` +
        `<span class="fx2-r-bar"></span>`);
    const rw = cw * 0.72;
    rc.style.width = rw + 'px'; rc.style.left = (cx - rw / 2) + 'px'; rc.style.top = (cy + ch / 2 - 6) + 'px';
    rc.style.setProperty('--fs', (cw / 16) + 'px');
    rc.animate([{ clipPath: 'inset(0 0 100% 0)', opacity: 1 }, { clipPath: 'inset(0 0 100% 0)', offset: 0.62 }, { clipPath: 'inset(0 0 0% 0)', offset: 0.76 }, { clipPath: 'inset(0 0 0% 0)', opacity: 1, offset: 0.9 }, { opacity: 0 }],
        { duration: T, fill: 'forwards' });
    // Antspaudas
    const st = fxEl(c, 'fx-obj fx-stamp fx2-stamp', `<span>${escapeHtml(tf('cli.vmi_stamp'))}</span>`);
    st.style.setProperty('--fs', Math.max(12, cw / 11) + 'px');
    const sx2 = cx + cw * 0.18, sy2 = cy + ch * 0.12;
    st.animate([
        { transform: fxT(sx2, sy2, -16, 3), opacity: 0, offset: 0 }, { transform: fxT(sx2, sy2, -16, 3), opacity: 0, offset: 0.7 },
        { transform: fxT(sx2, sy2, -16, 0.92), opacity: 1, offset: 0.76, easing: 'ease-in' }, { transform: fxT(sx2, sy2, -16, 1), opacity: 1, offset: 0.8 },
        { transform: fxT(sx2, sy2, -16, 1), opacity: 1, offset: 0.92 }, { transform: fxT(sx2, sy2, -16, 1.05), opacity: 0 }
    ], { duration: T, fill: 'forwards' });
    setTimeout(() => {
        fx2Shake(card, 5, 300);
        const ink = FX2.sprite('ink', [[0, 'rgba(211,47,47,.9)'], [1, 'rgba(211,47,47,0)']], 32);
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2, sp = fx2R(60, 180);
            sys.add({ x: sx2, y: sy2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.12, life: fx2R(300, 600), sprite: ink, size: fx2R(4, 9), a0: 0.9, fi: 0.05 });
        }
    }, T * 0.76);
    fxEnd(c, T + 300);
}

// ============================================================
// ✈️ ORO UOSTAS #8 – kilimo takas su šviesomis, lėktuvas įsibėgėja, atsiplėšia, kyla pro debesis
// ============================================================
function fxAir2(fieldId) {
    const cell = document.getElementById(`cell-${fieldId}`);
    const board = document.getElementById('board');
    if (!cell || !board || board.querySelector('.fx2-air')) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof Element.prototype.animate !== 'function') { if (typeof playAirportEffect === 'function') playAirportEffect(fieldId); return; }
    const c = fxPrep(fieldId, false);
    if (!c) return;
    c.wrap.classList.add('fx2-air');
    board.classList.add('ap-hide-' + fieldId);
    const T = 5000;
    const total = (gameState && gameState.board && gameState.board.length) || 52;
    const nx = document.getElementById(`cell-${(fieldId + 1) % total}`) || cell;
    const pc = c.pc, pn = fxBoardPoint(nx, board);
    let rx = pn.x - pc.x, ry = pn.y - pc.y; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
    let ux = rx * 0.5 + c.ix, uy = ry * 0.5 + c.iy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const deg = (x, y) => Math.atan2(y, x) * 180 / Math.PI + 90;   // lėktuvo nosis – į viršų
    const aRun = deg(rx, ry), aFly = deg(ux, uy);
    const pw = Math.max(95, c.L * 1.2);
    const runLen = c.L * 1.6, flyLen = Math.max(board.offsetWidth, board.offsetHeight) * 0.62;
    // Kilimo takas
    const rw = fxEl(c, 'fx2-runway', '<i class="fx2-rw-lights"></i><i class="fx2-rw-center"></i>');
    rw.style.width = (runLen + pw) + 'px'; rw.style.height = (pw * 0.62) + 'px';
    rw.style.transform = `rotate(${Math.atan2(ry, rx) * 180 / Math.PI}deg) translate(${-pw * 0.5}px, -50%)`;
    rw.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.55 }, { opacity: 0, offset: 0.75 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
    // Šešėlis ir lėktuvas
    const shadow = fxEl(c, 'fx-obj fx2-plane-shadow', `<div class="vx-img" style="width:${pw}px">${FX2_SVG.plane}</div>`);
    const plane = fxEl(c, 'fx-obj fx2-plane', `<div class="vx-img" style="width:${pw}px">${FX2_SVG.plane}</div>`);
    const tx = rx * runLen, ty = ry * runLen;
    const P = (f) => ({ x: tx + ux * flyLen * f, y: ty + uy * flyLen * f });
    const tr = (x, y, a, s) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${a.toFixed(1)}deg) scale(${s.toFixed(3)})`;
    const o1 = 0.12, o2 = 0.46;
    plane.animate([
        { transform: tr(0, 0, aRun, 0.95), opacity: 0, offset: 0 }, { transform: tr(0, 0, aRun, 0.95), opacity: 1, offset: 0.06 },
        { transform: tr(tx * 0.08, ty * 0.08, aRun, 0.95), offset: o1, easing: 'ease-in' },
        { transform: tr(tx, ty, aRun, 1.0), offset: o2, easing: 'ease-in' },
        { transform: tr(P(0.25).x, P(0.25).y, aRun + (aFly - aRun) * 0.7, 1.35), offset: 0.62 },
        { transform: tr(P(0.6).x, P(0.6).y, aFly, 1.9), opacity: 1, offset: 0.82 },
        { transform: tr(P(1).x, P(1).y, aFly, 2.6), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    const so = (f) => c.s * 0.12 + f * c.s * 1.4;
    shadow.animate([
        { transform: tr(0, so(0), aRun, 0.95), opacity: 0, offset: 0 }, { transform: tr(0, so(0), aRun, 0.95), opacity: 0.45, offset: 0.06 },
        { transform: tr(tx * 0.08, ty * 0.08 + so(0), aRun, 0.95), offset: o1, easing: 'ease-in' },
        { transform: tr(tx, ty + so(0), aRun, 0.95), opacity: 0.45, offset: o2, easing: 'ease-in' },
        { transform: tr(P(0.22).x, P(0.22).y + so(0.5), aRun + (aFly - aRun) * 0.7, 0.85), opacity: 0.25, offset: 0.62 },
        { transform: tr(P(0.45).x, P(0.45).y + so(1), aFly, 0.7), opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Dalelės: karštas oras, padangų dūmai, kondensacijos pėdsakai, debesys
    const R = Math.max(board.offsetWidth, board.offsetHeight) * 0.75;
    const sys = fx2Canvas(c, R, 5);
    const haze = FX2.sprite('haze', [[0, 'rgba(255,240,220,.5)'], [1, 'rgba(255,240,220,0)']], 48);
    const white = FX2.cloud('contrail', '255,255,255');
    const tire = FX2.cloud('tire', '200,200,205');
    let lifted = false;
    sys.run(T, (el) => {
        const t = el / T;
        const m = new DOMMatrixReadOnly(getComputedStyle(plane).transform);
        const px = m.e, py = m.f, sc = Math.hypot(m.a, m.b);
        // variklių padėtys (lėktuvo koordinatėse: ±0.31 pločio, 0.0 aukščio nuo centro)
        const ca = Math.atan2(m.b, m.a);
        const ex = (side) => px + Math.cos(ca) * side * pw * 0.31 * sc - Math.sin(ca) * pw * 0.02 * sc;
        const ey = (side) => py + Math.sin(ca) * side * pw * 0.31 * sc + Math.cos(ca) * pw * 0.02 * sc;
        const back = { x: Math.sin(ca), y: -Math.cos(ca) };   // atgal nuo nosies
        if (t > 0.08 && t < o2) {
            for (const s of [-1, 1]) sys.add({ x: ex(s), y: ey(s), vx: -back.x * -160 + fx2R(-15, 15), vy: -back.y * -160 + fx2R(-15, 15), drag: 0.05,
                life: fx2R(250, 400), sprite: haze, size: fx2R(10, 16), grow: 40, a0: 0.35, fi: 0.1 });
        }
        if (!lifted && t > o2 - 0.02) {
            lifted = true;
            for (let i = 0; i < 16; i++) sys.add({ x: px + fx2R(-10, 10), y: py + fx2R(-10, 10), vx: fx2R(-50, 50), vy: fx2R(-50, 50), drag: 0.04, turb: 40,
                life: fx2R(700, 1200), sprite: tire, size: fx2R(18, 34), grow: 40, a0: 0.5 });
        }
        if (t > o2 && t < 0.92) {
            for (const s of [-1, 1]) sys.add({ x: ex(s), y: ey(s), vx: back.x * 20, vy: back.y * 20, drag: 0.02, life: fx2R(900, 1400),
                sprite: white, size: 6 * sc, grow: 22 * sc, a0: 0.55, fi: 0.05 });
        }
        if (t > 0.58 && t < 0.8 && Math.random() < 0.25) {
            const along = fx2R(0.35, 0.8), side = fx2R(-1, 1) * c.L * 0.9;
            const q = P(along);
            sys.add({ x: q.x - uy * side, y: q.y + ux * side, vx: -ux * 30, vy: -uy * 30, life: fx2R(1400, 2000), sprite: white,
                size: fx2R(60, 110), grow: 20, a0: 0.5, fi: 0.3, rot: Math.random() * 6, vr: 0.1 });
        }
    });
    setTimeout(() => {
        c.wrap.remove();
        board.classList.remove('ap-hide-' + fieldId);
        const ic = document.querySelector(`#cell-${fieldId} .cell-bg-icon`);
        if (ic) { ic.classList.add('ap-return'); setTimeout(() => ic.classList.remove('ap-return'), 900); }
    }, T + 1500);
}

// ============================================================
// 🛀 SPA #11 – vandens ratilai, išsiskleidžiantis lotosas, žvakės, garai ir švelnūs blyksniai
// ============================================================
function fxSpa2(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5600;
    const cx = c.ix * c.L * 0.6, cy = c.iy * c.L * 0.6;
    const pr = Math.max(80, c.L * 0.85);
    const pool = fxEl(c, 'fx2-pool');
    pool.style.width = pool.style.height = (pr * 2) + 'px';
    pool.style.left = (cx - pr) + 'px'; pool.style.top = (cy - pr) + 'px';
    pool.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.03)', opacity: 1, offset: 0.1 }, { transform: 'scale(1)', offset: 0.14 }, { transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.9)', opacity: 0 }],
        { duration: T, fill: 'forwards' });
    const lw = pr * 1.75;
    const lotus = fxEl(c, 'fx-obj fx2-lotus', `<div class="vx-img" style="width:${lw}px">${FX2_SVG.lotus}</div>`);
    lotus.animate([{ transform: fxT(cx, cy + 20, 0, 0.3), opacity: 0 }, { transform: fxT(cx, cy + 20, 0, 0.3), opacity: 0, offset: 0.12 },
        { transform: fxT(cx, cy - 4, 0, 1.02), opacity: 1, offset: 0.3 }, { transform: fxT(cx, cy, 0, 1), offset: 0.36 },
        { transform: fxT(cx, cy - 3, 0, 1), opacity: 1, offset: 0.88 }, { transform: fxT(cx, cy, 0, 0.9), opacity: 0 }], { duration: T, fill: 'forwards' });
    lotus.querySelectorAll('.fx2-petal').forEach((p, i) => {
        const a = p.style.getPropertyValue('--a') || '0deg';
        p.animate([{ transform: 'rotate(0deg) scaleY(.4)' }, { transform: 'rotate(0deg) scaleY(.4)', offset: 0.22 }, { transform: `rotate(${a}) scaleY(1)`, offset: 0.48 + i * 0.01 }, { transform: `rotate(${a}) scaleY(1)` }],
            { duration: T, fill: 'forwards' });
    });
    const cs = Math.max(20, pr * 0.28);
    [0, 1, 2].forEach(i => {
        const a = -Math.PI / 2 + (i - 1) * 1.1 + Math.atan2(c.iy, c.ix) + Math.PI / 2;
        const x = cx + Math.cos(a) * pr * 1.12, y = cy + Math.sin(a) * pr * 1.12;
        const cd = fxEl(c, 'fx-obj fx2-candle', `<div class="vx-img" style="width:${cs}px">${FX2_SVG.candle}</div>`);
        cd.animate([{ transform: fxT(x, y, 0, 0), opacity: 0 }, { transform: fxT(x, y, 0, 0), opacity: 0, offset: 0.1 + i * 0.05 }, { transform: fxT(x, y, 0, 1), opacity: 1, offset: 0.2 + i * 0.05 },
            { transform: fxT(x, y, 0, 1), opacity: 1, offset: 0.88 }, { transform: fxT(x, y, 0, 0.8), opacity: 0 }], { duration: T, fill: 'forwards' });
    });
    const sys = fx2Canvas(c, Math.max(pr * 2.2, 260), 4);
    const steam = FX2.cloud('steam', '255,255,255');
    const bokeh = [FX2.sprite('bk1', [[0, 'rgba(255,255,255,.95)'], [0.4, 'rgba(255,200,230,.5)'], [1, 'rgba(255,170,210,0)']], 48),
                   FX2.sprite('bk2', [[0, 'rgba(255,255,255,.95)'], [0.4, 'rgba(255,236,170,.5)'], [1, 'rgba(255,214,120,0)']], 48)];
    let ripT = 0;
    sys.run(T, (el, dt) => {
        const t = el / T;
        ripT += dt;
        if (t > 0.1 && t < 0.85 && ripT > 0.55) {
            ripT = 0;
            sys.add({ x: cx + fx2R(-pr * 0.2, pr * 0.2), y: cy + fx2R(-pr * 0.2, pr * 0.2), life: 2000, a0: 0.8, fi: 0.05, size: 4, grow: pr * 0.7,
                draw: (g, p) => { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 0.92, 0, 0, Math.PI * 2); g.stroke(); } });
        }
        if (t > 0.2 && t < 0.85 && Math.random() < 0.5) {
            sys.add({ x: cx + fx2R(-pr * 0.6, pr * 0.6), y: cy + fx2R(-pr * 0.3, pr * 0.4), vx: fx2R(-8, 8), vy: fx2R(-60, -35), turb: 50, ph: Math.random() * 6,
                life: fx2R(1600, 2400), sprite: steam, size: fx2R(20, 38), grow: 28, a0: 0.32, fi: 0.3 });
        }
        if (t > 0.3 && t < 0.88 && Math.random() < 0.35) {
            const a = Math.random() * Math.PI * 2, r = fx2R(pr * 0.4, pr * 1.3);
            sys.add({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vy: fx2R(-25, -8), life: fx2R(900, 1500), sprite: bokeh[Math.random() < 0.5 ? 0 : 1],
                size: fx2R(6, 18), blend: 'lighter', a0: 0.9, fi: 0.4 });
        }
    });
    fxEnd(c, T + 400);
}

// ============================================================
// 🗑️ ŠIUKŠLĖS #14 – musės, šiukšliavežė su švyturėliu, ranka pakelia konteinerį, šiukšlės ir dulkės
// ============================================================
function fxGarbage2(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 6200;
    const ax = c.iy !== 0 ? 1 : 0, ay = c.ix !== 0 ? 1 : 0;
    const vw = Math.max(110, Math.min(190, c.s * 2.1)), vh = vw * 90 / 170;
    const bw = Math.max(34, c.s * 0.55), bh = bw * 80 / 60;
    const binX = c.ix * c.L * 0.85, binY = c.iy * c.L * 0.85;
    const far = c.L * 2.6;
    const stopX = binX - ax * vw * 0.12, stopY = binY - ay * vw * 0.12;
    const truck = fxEl(c, 'fx-obj fx2-truck', `<div class="vx-img" style="width:${vw}px;transform:${ay ? 'rotate(90deg) ' : ''}scaleX(-1)">${FX2_SVG.truck}</div>`);
    const bin = fxEl(c, 'fx-obj fx2-bin', `<div class="vx-img" style="width:${bw}px">${FX2_SVG.bin}</div>`);
    const lid = bin.querySelector('.bin-lid');
    truck.animate([
        { transform: fxT(stopX + ax * far, stopY + ay * far), opacity: 0, offset: 0 },
        { transform: fxT(stopX + ax * far * 0.8, stopY + ay * far * 0.8), opacity: 1, offset: 0.12 },
        { transform: fxT(stopX, stopY), offset: 0.34, easing: 'cubic-bezier(.2,.7,.3,1)' },
        { transform: fxT(stopX, stopY), offset: 0.7 },
        { transform: fxT(stopX - ax * far, stopY - ay * far), opacity: 1, offset: 0.95, easing: 'ease-in' },
        { transform: fxT(stopX - ax * far * 1.1, stopY - ay * far * 1.1), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    // Konteineris: stovi → pakeliamas ant galo → apverčiamas (dangtis atsidaro) → grąžinamas
    const backX = stopX + ax * vw * 0.36, backY = stopY + ay * vw * 0.36;
    bin.animate([
        { transform: fxT(binX, binY), offset: 0 }, { transform: fxT(binX, binY), offset: 0.36 },
        { transform: fxT(backX * 0.5, backY * 0.5 - vh * 0.55, -25, 1), offset: 0.44, easing: 'ease-out' },
        { transform: fxT(backX, backY - vh * 0.72, -165, 1), offset: 0.52 },
        { transform: fxT(backX + 1.5, backY - vh * 0.72, -158, 1), offset: 0.55 }, { transform: fxT(backX - 1.5, backY - vh * 0.72, -168, 1), offset: 0.58 },
        { transform: fxT(backX * 0.5, backY * 0.5 - vh * 0.5, -25, 1), offset: 0.64 },
        { transform: fxT(binX, binY), offset: 0.7, easing: 'ease-in' }, { transform: fxT(binX, binY), offset: 1 }
    ], { duration: T, fill: 'forwards' });
    if (lid) lid.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)', offset: 0.46 }, { transform: 'rotate(-110deg)', offset: 0.52 }, { transform: 'rotate(-110deg)', offset: 0.6 }, { transform: 'rotate(0deg)', offset: 0.66 }, { transform: 'rotate(0deg)' }],
        { duration: T, fill: 'forwards' });
    // Švyturėlio šviesa
    const beacon = fxEl(c, 'fx-obj fx2-beacon');
    beacon.animate([{ transform: fxT(stopX + ax * far, stopY + ay * far - vh * 0.42) }, { transform: fxT(stopX, stopY - vh * 0.42), offset: 0.34 }, { transform: fxT(stopX, stopY - vh * 0.42), offset: 0.7 },
        { transform: fxT(stopX - ax * far, stopY - ay * far - vh * 0.42), offset: 0.95 }], { duration: T, fill: 'forwards' });
    const R = Math.max(c.L * 2.8, 320);
    const sys = fx2Canvas(c, R, 4);
    const dust = FX2.cloud('dust', '170,150,120');
    const exhaust = FX2.cloud('exh', '60,60,60');
    const trashCols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8d6e63', '#fafafa', '#ff7043', '#ab47bc'];
    const flies = [0, 1, 2].map(i => ({ ph: i * 2.1, r: bw * (0.55 + i * 0.12) }));
    let dumped = false;
    sys.run(T, (el) => {
        const t = el / T;
        // musės aplink konteinerį
        if (t < 0.4) {
            flies.forEach(f => {
                const a = sys.time * (5 + f.ph) + f.ph;
                const x = binX + Math.cos(a) * f.r, y = binY - bh * 0.35 + Math.sin(a * 1.7) * f.r * 0.5;
                sys.add({ x, y, life: 40, a0: 1, fi: 0.01, size: 3, draw: (g, p) => {
                    g.fillStyle = '#111'; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, Math.PI * 2); g.fill();
                    g.fillStyle = 'rgba(200,220,255,.75)'; const w = Math.sin(sys.time * 80) * 2.5;
                    g.beginPath(); g.ellipse(p.x - 2, p.y - 2, 2.6, 1.2 + Math.abs(w) * 0.3, -0.6, 0, Math.PI * 2); g.fill();
                    g.beginPath(); g.ellipse(p.x + 2, p.y - 2, 2.6, 1.2 + Math.abs(w) * 0.3, 0.6, 0, Math.PI * 2); g.fill();
                } });
            });
        }
        // išmetamosios dujos
        const m = new DOMMatrixReadOnly(getComputedStyle(truck).transform);
        if (t > 0.1 && t < 0.97 && Math.random() < 0.55) {
            sys.add({ x: m.e + ax * vw * 0.48, y: m.f + ay * vw * 0.48 + vh * 0.2, vx: ax * fx2R(20, 50), vy: fx2R(-50, -25), turb: 30, life: fx2R(700, 1100),
                sprite: exhaust, size: fx2R(10, 18), grow: 26, a0: 0.45 });
        }
        // šiukšlės krenta į galą + dulkės
        if (!dumped && t > 0.52) {
            dumped = true;
            for (let i = 0; i < 34; i++) sys.add({ x: backX + fx2R(-8, 8), y: backY - vh * 0.7, vx: fx2R(-60, 60), vy: fx2R(-60, 30), gy: 700, drag: 0.01, life: fx2R(450, 750),
                rect: true, color: trashCols[i % trashCols.length], size: fx2R(4, 9), ar: fx2R(0.4, 1), rot: Math.random() * 6, vr: fx2R(-12, 12), a0: 1, fi: 0.02 });
            for (let i = 0; i < 12; i++) sys.add({ x: backX + fx2R(-20, 20), y: backY - vh * 0.4, vx: fx2R(-50, 50), vy: fx2R(-40, 10), turb: 50, life: fx2R(900, 1400),
                sprite: dust, size: fx2R(26, 44), grow: 40, a0: 0.5 });
            fx2Shake(truck, 3, 300);
        }
    });
    fxEnd(c, T + 1200);
}

// ============================================================
// 🚑 Greitosios patobulinimai: švyturėlių šviesa ir EKG atvykus
// ============================================================
function fx2EcgAt(cellId) {
    const board = document.getElementById('board');
    const cell = document.getElementById(`cell-${cellId}`);
    if (!board || !cell) return;
    const p = fxBoardPoint(cell, board);
    const w = Math.max(150, cell.offsetWidth * 2.2), h = w * 0.38;
    const el = document.createElement('div');
    el.className = 'fx-layer fx2-ecg';
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.innerHTML = `<svg viewBox="0 0 200 76" style="width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px">
        <rect x="1" y="1" width="198" height="74" rx="10" fill="rgba(5,20,12,.78)" stroke="rgba(0,255,140,.6)"/>
        <g stroke="rgba(0,255,140,.12)">${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="76"/>`).join('')}${[19, 38, 57].map(y => `<line x1="0" y1="${y}" x2="200" y2="${y}"/>`).join('')}</g>
        <path class="fx2-ecg-line" d="M8 40 H52 L58 34 L64 40 H74 L80 12 L88 66 L94 40 H112 L120 30 L128 40 H146 L152 14 L160 64 L166 40 H192" fill="none" stroke="#2bff9a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <text x="186" y="18" text-anchor="end" font-family="Arial Black,Arial" font-size="11" fill="#2bff9a">♥ 72</text></svg>`;
    board.appendChild(el);
    const line = el.querySelector('.fx2-ecg-line');
    const L = line.getTotalLength ? line.getTotalLength() : 400;
    line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
    line.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1100, fill: 'forwards' });
    el.animate([{ opacity: 0, transform: 'translateZ(36px) scale(.6)' }, { opacity: 1, transform: 'translateZ(36px) scale(1)', offset: 0.12 }, { opacity: 1, transform: 'translateZ(36px) scale(1)', offset: 0.82 }, { opacity: 0, transform: 'translateZ(36px) scale(.95)' }],
        { duration: 2200, fill: 'forwards' });
    setTimeout(() => el.remove(), 2300);
}


// ============================================================
// ✨ FX3 – IŠPŪDINGI EFEKTAI II: STOTYS, LATRŲ BARAS, BASEINAS, ELEKTRA, PIRTIS, VANDUO,
// PAPLŪDIMYS, GIMTADIENIS, TAKSI, STARTAS, KALĖJIMAS
// ============================================================

// Scena kortelėje (apvalūs kampai, viskas viduje apkarpoma). stage – kortelės centras.
function fx3Card(c, w, h, x, y, cls, T, z) {
    const card = fxEl(c, 'fx3-card ' + (cls || ''));
    card.style.width = w + 'px'; card.style.height = h + 'px';
    card.style.left = (x - w / 2) + 'px'; card.style.top = (y - h / 2) + 'px';
    if (z) card.style.zIndex = z;
    const stage = document.createElement('div');
    stage.className = 'fx3-stage';
    card.appendChild(stage);
    card.animate([
        { transform: 'scale(.35) translateY(30px)', opacity: 0, filter: 'blur(6px)', easing: 'cubic-bezier(.2,.8,.2,1)' },
        { transform: 'scale(1.04)', opacity: 1, filter: 'blur(0px)', offset: 0.07 },
        { transform: 'scale(1)', offset: 0.1 },
        { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)', offset: 0.9 },
        { transform: 'scale(.9) translateY(-10px)', opacity: 0, filter: 'blur(4px)' }
    ], { duration: T, fill: 'forwards' });
    return { card, stage, w, h, wrap: stage };
}
function fx3El(parent, cls, html, css) {
    const e = document.createElement('div');
    e.className = cls;
    if (html) e.innerHTML = html;
    if (css) Object.keys(css).forEach(k => k.startsWith('--') ? e.style.setProperty(k, css[k]) : (e.style[k] = css[k]));
    parent.appendChild(e);
    return e;
}
// Kryptis į lentos centrą (tinka ir kampams)
function fx3Inward(c) {
    const dx = c.board.offsetWidth / 2 - c.pc.x, dy = c.board.offsetHeight / 2 - c.pc.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
}
// Žaibas (vidurio taško poslinkis)
function fx3Bolt(x1, y1, x2, y2, disp, out) {
    out = out || [[x1, y1]];
    if (disp < 3) { out.push([x2, y2]); return out; }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * disp, my = (y1 + y2) / 2 + (Math.random() - 0.5) * disp;
    fx3Bolt(x1, y1, mx, my, disp / 2, out);
    fx3Bolt(mx, my, x2, y2, disp / 2, out);
    return out;
}
function fx3DrawBolt(g, pts, w, col) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    [[w * 6, 'rgba(120,170,255,.18)'], [w * 2.6, col || 'rgba(150,200,255,.7)'], [w, '#ffffff']].forEach(([lw, s]) => {
        g.strokeStyle = s; g.lineWidth = lw; g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
        g.stroke();
    });
}
// Moneta (ovalas, sukasi)
function fx3Coin(g, p) {
    const w = Math.abs(Math.cos(p.rot)) * p.size, h = p.size;
    const gr = g.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
    gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.4, '#ffd54f'); gr.addColorStop(1, '#b07d00');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(p.x, p.y, Math.max(0.8, w), h, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,80,0,.7)'; g.lineWidth = 1; g.stroke();
}
// Konfeti
function fx3Confetti(sys, x, y, n, sp, cols) {
    cols = cols || ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c', '#ffffff'];
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = fx2R(sp * 0.3, sp);
        sys.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, gy: 420, drag: 0.035, life: fx2R(1400, 2400),
            rect: true, color: cols[i % cols.length], size: fx2R(5, 10), ar: fx2R(0.35, 0.7), rot: Math.random() * 6, vr: fx2R(-14, 14), a0: 1, fi: 0.02,
            draw: (g, p) => {
                g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
                g.scale(1, Math.abs(Math.cos(p.age / 90 + p.ph0)));
                g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size * p.ar / 2, p.size, p.size * p.ar); g.restore();
            }, ph0: Math.random() * 6 });
    }
}

const FX3_SVG = {
    train: `<svg viewBox="0 0 300 76" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e7ebf0"/><stop offset="1" stop-color="#aab4bf"/></linearGradient>
      <linearGradient id="f3tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3f5ff"/><stop offset=".45" stop-color="#5f93bd"/><stop offset="1" stop-color="#1b3047"/></linearGradient>
      <radialGradient id="f3tw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ddd"/><stop offset=".4" stop-color="#888"/><stop offset=".5" stop-color="#222"/><stop offset="1" stop-color="#111"/></radialGradient></defs>
      <ellipse cx="150" cy="70" rx="148" ry="4" fill="rgba(0,0,0,.25)"/>
      <path d="M232 12 L246 2 L262 12" stroke="#2d2d2d" stroke-width="2.2" fill="none"/><line x1="238" y1="2" x2="254" y2="2" stroke="#2d2d2d" stroke-width="2"/><rect x="238" y="11" width="22" height="3" fill="#555"/>
      <rect x="2" y="14" width="94" height="46" rx="8" fill="url(#f3tb)" stroke="#8c96a0"/>
      <rect x="100" y="14" width="94" height="46" rx="6" fill="url(#f3tb)" stroke="#8c96a0"/>
      <path d="M198 14 H258 Q282 14 293 36 L298 51 Q298 60 289 60 H198 Z" fill="url(#f3tb)" stroke="#8c96a0"/>
      <path d="M263 18 Q281 20 290 38 H260 Z" fill="url(#f3tg)"/><path d="M266 20 L275 21 L266 32 Z" fill="rgba(255,255,255,.6)"/>
      <rect x="2" y="42" width="94" height="6" fill="#c8102e"/><rect x="100" y="42" width="94" height="6" fill="#c8102e"/><path d="M198 42 H297 L298 48 H198 Z" fill="#c8102e"/>
      <rect x="2" y="48" width="94" height="2" fill="#ffcf33"/><rect x="100" y="48" width="94" height="2" fill="#ffcf33"/><rect x="198" y="48" width="99" height="2" fill="#ffcf33"/>
      <g fill="url(#f3tg)">${[0, 1, 2].map(k => [0, 1, 2, 3, 4].map(i => (k === 2 && i > 2) ? '' : `<rect x="${k * 98 + 10 + i * 17}" y="22" width="12" height="13" rx="2"/>`).join('')).join('')}</g>
      <g fill="rgba(255,255,255,.45)">${[0, 1, 2].map(k => [0, 1, 2, 3, 4].map(i => (k === 2 && i > 2) ? '' : `<path d="M${k * 98 + 11 + i * 17} 23 h5 l-5 6 z"/>`).join('')).join('')}</g>
      <rect x="96" y="20" width="4" height="34" fill="#444"/><rect x="194" y="20" width="4" height="34" fill="#444"/>
      <circle class="f3-head" cx="293" cy="52" r="3" fill="#fffbe0"/><rect x="2" y="52" width="4" height="4" rx="1" fill="#e53935"/>
      <rect x="6" y="60" width="288" height="4" fill="#2f2f2f"/>
      ${[16, 80, 114, 178, 212, 276].map(x => `<circle cx="${x}" cy="66" r="6.5" fill="url(#f3tw)"/>`).join('')}
    </svg>`,

    bus: `<svg viewBox="0 0 220 92" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fc3f7"/><stop offset=".5" stop-color="#0288d1"/><stop offset="1" stop-color="#01579b"/></linearGradient>
      <linearGradient id="f3bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f1ff"/><stop offset=".5" stop-color="#4a6f8c"/><stop offset="1" stop-color="#14212d"/></linearGradient>
      <radialGradient id="f3bw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e5e5e5"/><stop offset=".35" stop-color="#9e9e9e"/><stop offset=".45" stop-color="#222"/><stop offset="1" stop-color="#0d0d0d"/></radialGradient></defs>
      <ellipse cx="110" cy="86" rx="104" ry="5" fill="rgba(0,0,0,.28)"/>
      <path d="M6 16 Q6 6 16 6 H196 Q212 6 214 22 L216 70 Q216 76 210 76 H6 Z" fill="url(#f3bb)" stroke="#014a80"/>
      <path d="M12 14 H188 V46 H12 Z" fill="url(#f3bg)"/>
      <g stroke="#0277bd" stroke-width="3">${[46, 82, 118, 154].map(x => `<line x1="${x}" y1="14" x2="${x}" y2="46"/>`).join('')}</g>
      <path d="M14 15 L40 15 L18 40 Z" fill="rgba(255,255,255,.35)"/><path d="M86 15 L110 15 L90 40 Z" fill="rgba(255,255,255,.25)"/>
      <path d="M192 12 H204 Q210 12 211 22 L212 50 H192 Z" fill="url(#f3bg)"/>
      <rect x="60" y="8" width="70" height="5" rx="1" fill="#111"/><text x="95" y="12.6" text-anchor="middle" font-family="Arial" font-weight="700" font-size="4.6" fill="#ffab00">BANCRUPT • CENTRAS</text>
      <rect x="150" y="48" width="30" height="27" fill="#0277bd" stroke="#01579b"/><line x1="165" y1="48" x2="165" y2="75" stroke="#01579b" stroke-width="1.5"/>
      <rect x="6" y="56" width="210" height="4" fill="#ffffff" opacity=".85"/>
      <circle class="f3-head" cx="212" cy="64" r="3" fill="#fffde7"/><rect x="5" y="62" width="4" height="7" rx="1" fill="#e53935"/>
      <rect x="4" y="74" width="214" height="6" rx="3" fill="#263238"/>
      <circle cx="44" cy="78" r="11" fill="url(#f3bw)"/><circle cx="176" cy="78" r="11" fill="url(#f3bw)"/>
      <circle cx="44" cy="78" r="3" fill="#ccc"/><circle cx="176" cy="78" r="3" fill="#ccc"/>
    </svg>`,

    ship: `<svg viewBox="0 0 240 110" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27466e"/><stop offset="1" stop-color="#0d1b2e"/></linearGradient>
      <linearGradient id="f3ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3dbe3"/></linearGradient>
      <linearGradient id="f3sf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b71c1c"/><stop offset=".5" stop-color="#ef5350"/><stop offset="1" stop-color="#b71c1c"/></linearGradient></defs>
      <line x1="128" y1="6" x2="128" y2="34" stroke="#555" stroke-width="2"/><rect x="120" y="10" width="16" height="3" fill="#555"/>
      <path d="M80 18 H100 L104 44 H76 Z" fill="url(#f3sf)"/><rect x="77" y="18" width="26" height="6" fill="#212121"/><rect x="78" y="30" width="24" height="4" fill="#fff"/>
      <path d="M40 40 H190 L184 30 H60 Z" fill="url(#f3ss)" stroke="#9aa6b1"/>
      <rect x="146" y="22" width="34" height="10" rx="2" fill="url(#f3ss)" stroke="#9aa6b1"/><rect x="149" y="24" width="28" height="4" rx="1" fill="#1d3b58"/>
      <path d="M28 66 H212 L206 50 H34 Z" fill="url(#f3ss)" stroke="#9aa6b1"/>
      <g fill="#2f5d86">${Array.from({ length: 16 }, (_, i) => `<rect x="${42 + i * 10.4}" y="54" width="6" height="5" rx="1.5"/>`).join('')}${Array.from({ length: 11 }, (_, i) => `<rect x="${66 + i * 10.4}" y="33" width="6" height="4" rx="1.5"/>`).join('')}</g>
      <g fill="#ff7a00"><rect x="58" y="44" width="18" height="6" rx="3"/><rect x="110" y="44" width="18" height="6" rx="3"/><rect x="162" y="44" width="18" height="6" rx="3"/></g>
      <path d="M6 66 H234 L216 96 H26 Z" fill="url(#f3sh)"/>
      <path d="M14 82 H226 L216 96 H26 Z" fill="#c62828"/><rect x="6" y="64" width="228" height="3" fill="#fff"/>
      <text x="200" y="78" text-anchor="end" font-family="Arial Black,Arial" font-weight="900" font-size="8" fill="#fff" opacity=".85">KLAIPĖDA</text>
    </svg>`,

    police: '<svg viewBox="0 0 120 64" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="f3pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9eef4"/><stop offset="1" stop-color="#b9c4cf"/></linearGradient>' +
        '<linearGradient id="f3pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe9ff"/><stop offset=".45" stop-color="#4f7da6"/><stop offset="1" stop-color="#14263a"/></linearGradient>' +
        '<radialGradient id="f3pw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e0e0e0"/><stop offset=".35" stop-color="#9e9e9e"/><stop offset=".45" stop-color="#212121"/><stop offset="1" stop-color="#111"/></radialGradient></defs>' +
        '<ellipse cx="60" cy="58" rx="54" ry="4" fill="rgba(0,0,0,.25)"/>' +
        '<path d="M4 14 Q4 8 10 8 H82 Q92 8 99 18 L112 32 Q116 36 116 42 V50 H4 Z" fill="url(#f3pb)" stroke="#9aa6b1"/>' +
        '<path d="M84 13 H90 Q96 13 101 20 L108 30 H84 Z" fill="url(#f3pg)"/><path d="M86 15 L92 15 L87 24 Z" fill="rgba(255,255,255,.55)"/>' +
        '<rect x="10" y="14" width="18" height="14" rx="2" fill="#1c2733"/><rect x="32" y="14" width="18" height="14" rx="2" fill="#1c2733"/><rect x="56" y="14" width="22" height="14" rx="2" fill="url(#f3pg)"/>' +
        '<g stroke="#aab" stroke-width="1.4">' + [13.5, 18, 22.5, 35.5, 40, 44.5].map(x => `<line x1="${x}" y1="14" x2="${x}" y2="28"/>`).join('') + '</g>' +
        '<rect x="4" y="31" width="112" height="8" fill="#1e4fd1"/><rect x="4" y="39" width="112" height="2.5" fill="#ffd600"/>' +
        '<g fill="#fff">' + Array.from({ length: 14 }, (_, i) => `<rect x="${6 + i * 8}" y="${i % 2 ? 31 : 35}" width="4" height="4"/>`).join('') + '</g>' +
        '<text x="40" y="48.6" font-family="Arial Black,Arial" font-size="6.4" font-weight="900" fill="#1e4fd1" text-anchor="middle">POLICIJA</text>' +
        '<rect class="pv-l1" x="34" y="2" width="12" height="6" rx="2" fill="#2979ff"/><rect class="pv-l2" x="48" y="2" width="12" height="6" rx="2" fill="#ff1744"/><rect x="32" y="7" width="30" height="2" fill="#37474f"/>' +
        '<circle cx="114" cy="44" r="2.4" fill="#fff59d"/><rect x="1" y="44" width="5" height="4" rx="1" fill="#c62828"/>' +
        '<circle cx="24" cy="51" r="9" fill="url(#f3pw)"/><circle cx="94" cy="51" r="9" fill="url(#f3pw)"/><circle cx="24" cy="51" r="2" fill="#bdbdbd"/><circle cx="94" cy="51" r="2" fill="#bdbdbd"/></svg>',

    // Taksi (žiūri į KAIRĘ – kaip emoji, kad tiktų esamos krypties taisyklės)
    taxi: '<svg viewBox="0 0 110 60" xmlns="http://www.w3.org/2000/svg"><defs>' +
        '<linearGradient id="f3xb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff176"/><stop offset=".5" stop-color="#fbc02d"/><stop offset="1" stop-color="#c49000"/></linearGradient>' +
        '<linearGradient id="f3xg" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f2ff"/><stop offset=".5" stop-color="#4f7da6"/><stop offset="1" stop-color="#14263a"/></linearGradient>' +
        '<radialGradient id="f3xw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ddd"/><stop offset=".35" stop-color="#999"/><stop offset=".45" stop-color="#222"/><stop offset="1" stop-color="#111"/></radialGradient></defs>' +
        '<ellipse cx="55" cy="55" rx="50" ry="4" fill="rgba(0,0,0,.3)"/>' +
        '<path d="M104 40 Q106 30 96 28 L80 26 L68 14 Q64 10 56 10 H36 Q28 10 24 16 L16 26 Q6 28 5 36 L4 44 Q4 48 9 48 H101 Q106 48 104 40 Z" fill="url(#f3xb)" stroke="#9c7000"/>' +
        '<path d="M28 17 Q31 14 37 14 H46 V26 H20 Z" fill="url(#f3xg)"/><path d="M50 14 H58 Q63 14 66 18 L73 26 H50 Z" fill="url(#f3xg)"/>' +
        '<g fill="#222">' + Array.from({ length: 12 }, (_, i) => `<rect x="${14 + i * 7}" y="${i % 2 ? 33 : 36}" width="3.5" height="3"/>`).join('') + '</g>' +
        '<rect x="38" y="3" width="22" height="8" rx="2" fill="#fff59d" stroke="#212121"/><g fill="#212121">' + [0, 1, 2, 3, 4].map(i => `<rect x="${40 + i * 4}" y="${i % 2 ? 4.5 : 7}" width="2" height="2.5"/>`).join('') + '</g>' +
        '<circle cx="7" cy="38" r="2.6" fill="#fffde7"/><rect x="101" y="36" width="4" height="4" rx="1" fill="#e53935"/>' +
        '<circle cx="26" cy="48" r="8" fill="url(#f3xw)"/><circle cx="84" cy="48" r="8" fill="url(#f3xw)"/></svg>',

    mug: (full) => `<svg viewBox="0 0 90 110" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3beer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd54f"/><stop offset=".5" stop-color="#ffb300"/><stop offset="1" stop-color="#e07a00"/></linearGradient>
      <linearGradient id="f3glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,.55)"/><stop offset=".25" stop-color="rgba(255,255,255,.08)"/><stop offset=".8" stop-color="rgba(255,255,255,.05)"/><stop offset="1" stop-color="rgba(255,255,255,.45)"/></linearGradient>
      <clipPath id="f3mc"><path d="M10 14 H64 L60 100 Q60 104 56 104 H18 Q14 104 14 100 Z"/></clipPath></defs>
      <path d="M62 30 Q86 30 86 56 Q86 80 60 82" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="7"/>
      <path d="M62 30 Q86 30 86 56 Q86 80 60 82" fill="none" stroke="rgba(160,200,220,.5)" stroke-width="3"/>
      <g clip-path="url(#f3mc)"><g class="fx3-fill" style="transform:translateY(${full ? 0 : 92}px)">
        <rect x="0" y="22" width="80" height="90" fill="url(#f3beer)"/>
        <path d="M6 24 Q14 8 24 18 Q32 6 42 16 Q52 6 60 18 Q70 12 70 26 V30 H6 Z" fill="#fffdf4"/>
        <g fill="rgba(255,255,255,.6)"><circle cx="24" cy="60" r="1.6"/><circle cx="40" cy="74" r="1.2"/><circle cx="50" cy="50" r="1.4"/><circle cx="30" cy="86" r="1.1"/></g>
      </g></g>
      <path d="M10 14 H64 L60 100 Q60 104 56 104 H18 Q14 104 14 100 Z" fill="url(#f3glass)" stroke="rgba(255,255,255,.85)" stroke-width="2.5"/>
      <g stroke="rgba(255,255,255,.35)" stroke-width="2">${[24, 36, 48].map(x => `<line x1="${x}" y1="22" x2="${x - 1}" y2="96"/>`).join('')}</g>
    </svg>`,

    bulb: `<svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="f3bl" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="rgba(255,250,210,.85)"/><stop offset="1" stop-color="rgba(255,240,170,.55)"/></radialGradient>
      <linearGradient id="f3bs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d8d8d"/><stop offset=".5" stop-color="#e0e0e0"/><stop offset="1" stop-color="#757575"/></linearGradient></defs>
      <circle class="fx3-bulb-glow" cx="30" cy="30" r="30" fill="rgba(255,235,120,.45)"/>
      <path d="M30 4 C14 4 6 16 6 28 C6 40 16 46 19 56 H41 C44 46 54 40 54 28 C54 16 46 4 30 4 Z" class="fx3-bulb-glass" fill="url(#f3bl)" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>
      <path d="M24 56 L24 40 Q30 30 36 40 L36 56" fill="none" stroke="#ff8f00" stroke-width="1.6"/>
      <path d="M25 36 q2.5 -4 5 0 q2.5 4 5 0" fill="none" class="fx3-fil" stroke="#ffe082" stroke-width="2"/>
      <rect x="18" y="56" width="24" height="18" rx="3" fill="url(#f3bs)"/><g stroke="#616161" stroke-width="1.2"><line x1="18" y1="61" x2="42" y2="63"/><line x1="18" y1="66" x2="42" y2="68"/></g>
      <path d="M22 74 H38 L34 82 H26 Z" fill="#424242"/>
    </svg>`,

    pole: `<svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3pp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d4c41"/><stop offset=".5" stop-color="#a1887f"/><stop offset="1" stop-color="#4e342e"/></linearGradient>
      <linearGradient id="f3tr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#607d8b"/><stop offset=".45" stop-color="#cfd8dc"/><stop offset="1" stop-color="#455a64"/></linearGradient></defs>
      <rect x="64" y="10" width="12" height="130" fill="url(#f3pp)"/>
      <rect x="20" y="20" width="100" height="8" rx="2" fill="#5d4037"/>
      <g fill="#e0f7fa" stroke="#00838f" stroke-width="1">${[26, 66, 106].map(x => `<rect x="${x}" y="8" width="8" height="12" rx="3"/>`).join('')}</g>
      <rect x="44" y="50" width="52" height="42" rx="6" fill="url(#f3tr)" stroke="#37474f"/>
      <g fill="#90a4ae">${[0, 1, 2, 3].map(i => `<rect x="${48 + i * 12}" y="56" width="6" height="30" rx="2"/>`).join('')}</g>
      <path d="M70 60 L62 74 H70 L66 86 L80 68 H72 L76 60 Z" fill="#ffd600" stroke="#5d4037" stroke-width="1"/>
    </svg>`,

    stove: `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3st" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#37474f"/><stop offset=".5" stop-color="#78909c"/><stop offset="1" stop-color="#263238"/></linearGradient>
      <radialGradient id="f3rk" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#9e9e9e"/><stop offset=".7" stop-color="#4e4e4e"/><stop offset="1" stop-color="#2b2b2b"/></radialGradient>
      <radialGradient id="f3hot" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="rgba(255,110,0,.95)"/><stop offset=".6" stop-color="rgba(255,60,0,.35)"/><stop offset="1" stop-color="rgba(255,40,0,0)"/></radialGradient></defs>
      <rect x="20" y="52" width="120" height="64" rx="6" fill="url(#f3st)"/>
      <rect x="38" y="78" width="40" height="26" rx="3" fill="#1b1b1b"/><rect class="fx3-fire" x="40" y="80" width="36" height="22" rx="2" fill="url(#f3hot)"/>
      <path d="M20 52 H140 L132 40 H28 Z" fill="#455a64"/>
      <ellipse class="fx3-stones-glow" cx="80" cy="40" rx="58" ry="22" fill="url(#f3hot)" opacity=".5"/>
      <g>${[[42, 34, 12], [62, 30, 14], [84, 32, 13], [104, 34, 12], [52, 22, 11], [74, 20, 12], [96, 22, 11], [64, 12, 10], [86, 12, 9]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="url(#f3rk)"/>`).join('')}</g>
      <rect x="96" y="82" width="30" height="5" rx="2" fill="#90a4ae"/>
    </svg>`,

    bucket: `<svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3wd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d5524"/><stop offset=".5" stop-color="#d9a066"/><stop offset="1" stop-color="#7a4a1d"/></linearGradient></defs>
      <path d="M14 46 H76 L70 104 H20 Z" fill="url(#f3wd)" stroke="#5d3412" stroke-width="1.5"/>
      <g stroke="rgba(80,40,10,.35)" stroke-width="1.5">${[26, 36, 46, 56, 66].map(x => `<line x1="${x}" y1="46" x2="${x - 2 + (x - 45) * 0.1}" y2="104"/>`).join('')}</g>
      <rect x="15" y="56" width="60" height="5" fill="#9e9e9e"/><rect x="18" y="90" width="54" height="5" fill="#9e9e9e"/>
      <ellipse cx="45" cy="46" rx="31" ry="6" fill="#4fc3f7"/><ellipse cx="45" cy="46" rx="31" ry="6" fill="none" stroke="#5d3412" stroke-width="1.5"/>
      <g class="fx3-ladle" style="transform-origin:46px 44px">
        <path d="M46 44 L104 8" stroke="url(#f3wd)" stroke-width="5" stroke-linecap="round"/>
        <path d="M30 40 Q30 54 44 54 Q56 54 56 42 Z" fill="url(#f3wd)" stroke="#5d3412"/>
      </g>
    </svg>`,

    thermo: `<svg viewBox="0 0 30 110" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="26" height="106" rx="13" fill="#5d3a1a" stroke="#3e2410"/>
      <rect x="11" y="10" width="8" height="74" rx="4" fill="#fff"/>
      <rect class="fx3-merc" x="12.5" y="12" width="5" height="72" rx="2.5" fill="#e53935" style="transform-origin:15px 84px;transform:scaleY(.25)"/>
      <circle cx="15" cy="92" r="9" fill="#e53935" stroke="#fff" stroke-width="2"/>
      <g stroke="#f3e3d0" stroke-width="1">${[18, 30, 42, 54, 66, 78].map(y => `<line x1="20" y1="${y}" x2="25" y2="${y}"/>`).join('')}</g>
    </svg>`,

    faucet: `<svg viewBox="0 0 150 100" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fafafa"/><stop offset=".35" stop-color="#b0bec5"/><stop offset=".6" stop-color="#eceff1"/><stop offset="1" stop-color="#607d8b"/></linearGradient>
      <linearGradient id="f3chv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#78909c"/><stop offset=".4" stop-color="#ffffff"/><stop offset=".7" stop-color="#b0bec5"/><stop offset="1" stop-color="#546e7a"/></linearGradient></defs>
      <rect x="0" y="22" width="22" height="34" rx="4" fill="url(#f3chv)"/>
      <path d="M18 30 H96 Q120 30 120 54 V70 H104 V56 Q104 46 94 46 H18 Z" fill="url(#f3ch)" stroke="#78909c"/>
      <rect x="100" y="68" width="24" height="8" rx="3" fill="url(#f3chv)"/>
      <g class="fx3-handle" style="transform-origin:56px 24px"><rect x="52" y="14" width="8" height="18" fill="url(#f3chv)"/><rect x="34" y="6" width="44" height="10" rx="5" fill="url(#f3ch)" stroke="#78909c"/><circle cx="56" cy="11" r="3" fill="#2196f3"/></g>
    </svg>`,

    sun: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="f3sun" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#fffde7"/><stop offset=".5" stop-color="#ffd54f"/><stop offset="1" stop-color="#ff9800"/></radialGradient></defs>
      <g class="fx3-rays" style="transform-origin:60px 60px">${Array.from({ length: 12 }, (_, i) => `<path d="M60 2 L66 22 L54 22 Z" fill="#ffca28" transform="rotate(${i * 30} 60 60)"/>`).join('')}</g>
      <circle cx="60" cy="60" r="30" fill="url(#f3sun)"/>
    </svg>`,

    umbrella: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
      <line x1="70" y1="30" x2="82" y2="118" stroke="#8d6e63" stroke-width="4" stroke-linecap="round"/>
      <g class="fx3-canopy" style="transform-origin:70px 30px">
        <path d="M6 50 Q70 -10 134 50 Z" fill="#ff5252"/>
        ${[0, 2, 4].map(i => { const a = 6 + i * 25.6, b = a + 25.6; return `<path d="M70 30 L${a} 50 Q${(a + b) / 2} 40 ${b} 50 Z" fill="#fff"/>`; }).join('')}
        <path d="M6 50 Q22 44 32 50 Q44 44 57 50 Q70 44 83 50 Q96 44 108 50 Q120 44 134 50" fill="none" stroke="#c62828" stroke-width="2"/>
      </g>
    </svg>`,

    ball: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="f3bc"><circle cx="30" cy="30" r="27"/></clipPath>
      <radialGradient id="f3bsh" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="rgba(255,255,255,.7)"/><stop offset=".5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,.25)"/></radialGradient></defs>
      <g clip-path="url(#f3bc)"><rect width="60" height="60" fill="#fff"/>
      <path d="M30 30 L-10 -10 L30 -20 Z" fill="#f44336"/><path d="M30 30 L70 -10 L70 30 Z" fill="#2196f3"/><path d="M30 30 L70 50 L40 80 Z" fill="#ffeb3b"/><path d="M30 30 L0 80 L-20 40 Z" fill="#4caf50"/></g>
      <circle cx="30" cy="30" r="27" fill="url(#f3bsh)" stroke="rgba(0,0,0,.2)"/><circle cx="30" cy="30" r="4" fill="#fff"/>
    </svg>`,

    gull: `<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"><g class="fx3-wing" style="transform-origin:30px 16px">
      <path d="M2 10 Q16 2 30 16 Q44 2 58 10 Q44 8 30 20 Q16 8 2 10 Z" fill="#fafafa" stroke="#607d8b" stroke-width="1.2"/></g><circle cx="30" cy="18" r="2.6" fill="#eceff1"/></svg>`,

    duck: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="f3dk" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff59d"/><stop offset="1" stop-color="#fbc02d"/></radialGradient></defs>
      <ellipse cx="36" cy="40" rx="28" ry="16" fill="url(#f3dk)"/><circle cx="24" cy="20" r="14" fill="url(#f3dk)"/>
      <path d="M8 22 Q2 24 8 28 L14 26 Z" fill="#ff7043"/><circle cx="20" cy="17" r="2.6" fill="#212121"/><circle cx="19.2" cy="16.2" r=".9" fill="#fff"/>
      <path d="M40 34 Q52 30 58 38 Q50 40 42 40 Z" fill="#f9a825"/></svg>`,

    cake: `<svg viewBox="0 0 160 170" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3c1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f06292"/><stop offset=".5" stop-color="#f8bbd0"/><stop offset="1" stop-color="#ec407a"/></linearGradient>
      <linearGradient id="f3c2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d6e63"/><stop offset=".5" stop-color="#bcaaa4"/><stop offset="1" stop-color="#6d4c41"/></linearGradient>
      <linearGradient id="f3pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b0bec5"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#90a4ae"/></linearGradient>
      <radialGradient id="f3fl" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff59d"/><stop offset=".75" stop-color="#ffa000"/><stop offset="1" stop-color="rgba(255,111,0,0)"/></radialGradient></defs>
      <ellipse cx="80" cy="160" rx="76" ry="9" fill="url(#f3pl)"/>
      <rect x="14" y="104" width="132" height="54" rx="8" fill="url(#f3c2)"/>
      <path d="M14 112 Q14 102 24 102 H136 Q146 102 146 112 V118 Q136 128 128 116 Q118 130 108 116 Q98 130 88 116 Q78 130 68 116 Q58 130 48 116 Q38 130 28 116 Q20 128 14 118 Z" fill="#fff8e1"/>
      <rect x="34" y="62" width="92" height="46" rx="7" fill="url(#f3c1)"/>
      <path d="M34 70 Q34 60 44 60 H116 Q126 60 126 70 V74 Q118 84 110 74 Q102 86 94 74 Q86 86 78 74 Q70 86 62 74 Q54 86 46 74 Q40 82 34 74 Z" fill="#fff"/>
      <g fill="#ff4081">${[44, 60, 76, 92, 108].map((x, i) => `<circle cx="${x + 4}" cy="${92 + (i % 2) * 6}" r="3"/>`).join('')}</g>
      <g fill="#ffd54f">${[26, 46, 66, 86, 106, 126].map((x, i) => `<circle cx="${x + 4}" cy="${136 + (i % 2) * 8}" r="3"/>`).join('')}</g>
      ${[52, 70, 88, 106].map((x, i) => `<g><rect x="${x}" y="34" width="7" height="28" rx="2" fill="${['#4fc3f7', '#ffeb3b', '#81c784', '#ba68c8'][i]}"/>
        <path d="M${x} 40 l7 -4 M${x} 48 l7 -4 M${x} 56 l7 -4" stroke="#fff" stroke-width="1.6"/>
        <line x1="${x + 3.5}" y1="34" x2="${x + 3.5}" y2="29" stroke="#3e2723" stroke-width="1.4"/>
        <ellipse class="fx3-cflame" cx="${x + 3.5}" cy="22" rx="5" ry="9" fill="url(#f3fl)" style="transform-origin:${x + 3.5}px 30px"/></g>`).join('')}
    </svg>`,

    balloon: (col) => `<svg viewBox="0 0 50 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="f3b${col.slice(1)}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".25" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".85"/></radialGradient></defs>
      <path d="M25 62 Q20 80 28 92 Q34 104 24 118" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.2"/>
      <ellipse cx="25" cy="30" rx="22" ry="28" fill="url(#f3b${col.slice(1)})"/><path d="M21 58 L29 58 L25 64 Z" fill="${col}"/></svg>`,

    lock: `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3lk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".4" stop-color="#ffc107"/><stop offset="1" stop-color="#9c6b00"/></linearGradient>
      <linearGradient id="f3sh2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9e9e9e"/><stop offset=".5" stop-color="#f5f5f5"/><stop offset="1" stop-color="#757575"/></linearGradient></defs>
      <path class="fx3-shackle" d="M18 48 V30 Q18 8 40 8 Q62 8 62 30 V48" fill="none" stroke="url(#f3sh2)" stroke-width="9" stroke-linecap="round"/>
      <rect x="6" y="44" width="68" height="52" rx="10" fill="url(#f3lk)" stroke="#7a5300" stroke-width="2"/>
      <circle cx="40" cy="64" r="7" fill="#4e3400"/><rect x="37" y="66" width="6" height="16" rx="2" fill="#4e3400"/>
      <path d="M12 50 h20" stroke="rgba(255,255,255,.6)" stroke-width="3" stroke-linecap="round"/>
    </svg>`
};

// ---------- Ikonėlės langeliams: KALĖJIMAS (#16) ir KELIAUK Į KALĖJIMĄ (#42) ----------
const FX3_CELL_ICONS = {
    16: `<svg class="fx3-cell-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f3jw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d99a6"/><stop offset="1" stop-color="#4b5662"/></linearGradient>
      <radialGradient id="f3jin" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#3a4552"/><stop offset="1" stop-color="#0f141a"/></radialGradient>
      <linearGradient id="f3jb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f6b78"/><stop offset=".45" stop-color="#f2f5f8"/><stop offset="1" stop-color="#3b4450"/></linearGradient>
      <linearGradient id="f3jl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffc107"/><stop offset="1" stop-color="#9c6b00"/></linearGradient></defs>
      <rect x="4" y="4" width="112" height="112" rx="14" fill="url(#f3jw)"/>
      <g stroke="rgba(0,0,0,.25)" stroke-width="1.5" fill="none">${[22, 40, 58, 76, 94].map((y, i) => `<line x1="4" y1="${y}" x2="116" y2="${y}"/>` + [0, 1, 2, 3].map(k => `<line x1="${(i % 2 ? 18 : 32) + k * 28}" y1="${y - 18}" x2="${(i % 2 ? 18 : 32) + k * 28}" y2="${y}"/>`).join('')).join('')}</g>
      <rect x="16" y="16" width="88" height="88" rx="8" fill="url(#f3jin)"/>
      <g><circle cx="60" cy="52" r="15" fill="#1e2630"/><path d="M34 104 Q36 72 60 70 Q84 72 86 104 Z" fill="#1e2630"/>
        <g fill="#f5f5f5" opacity=".9"><rect x="40" y="78" width="40" height="6"/><rect x="37" y="90" width="46" height="6"/></g>
        <circle cx="54" cy="51" r="2" fill="#fff"/><circle cx="66" cy="51" r="2" fill="#fff"/><path d="M54 60 Q60 56 66 60" stroke="#fff" stroke-width="2" fill="none"/></g>
      <g>${[24, 40, 56, 72, 88].map(x => `<rect x="${x}" y="12" width="8" height="96" rx="4" fill="url(#f3jb)"/>`).join('')}</g>
      <rect x="12" y="44" width="96" height="7" rx="3.5" fill="url(#f3jb)"/>
      <g fill="#ffe0b2" stroke="#8d5524" stroke-width="1.2"><rect x="43" y="56" width="7" height="12" rx="3"/><rect x="70" y="56" width="7" height="12" rx="3"/></g>
      <g transform="translate(78 70)"><path d="M6 12 V6 Q6 0 13 0 Q20 0 20 6 V12" fill="none" stroke="#cfd8dc" stroke-width="4"/><rect x="0" y="10" width="26" height="22" rx="4" fill="url(#f3jl)" stroke="#7a5300"/><circle cx="13" cy="19" r="3" fill="#4e3400"/><rect x="11.5" y="20" width="3" height="7" fill="#4e3400"/></g>
    </svg>`,
    42: `<svg class="fx3-cell-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="f3gb" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#3949ab"/><stop offset="1" stop-color="#0d1442"/></radialGradient>
      <radialGradient id="f3gr" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffcdd2"/><stop offset=".4" stop-color="#ff1744"/><stop offset="1" stop-color="#8e0000"/></radialGradient>
      <radialGradient id="f3gu" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#e3f2fd"/><stop offset=".4" stop-color="#2979ff"/><stop offset="1" stop-color="#0d2a7a"/></radialGradient>
      <linearGradient id="f3gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fafafa"/><stop offset=".4" stop-color="#b0bec5"/><stop offset=".7" stop-color="#eceff1"/><stop offset="1" stop-color="#546e7a"/></linearGradient></defs>
      <rect x="4" y="4" width="112" height="112" rx="14" fill="url(#f3gb)"/>
      <circle class="fx3-gl1" cx="34" cy="36" r="30" fill="rgba(255,23,68,.35)"/><circle class="fx3-gl2" cx="86" cy="36" r="30" fill="rgba(41,121,255,.35)"/>
      <rect x="18" y="42" width="84" height="10" rx="4" fill="#263238"/>
      <path d="M20 44 Q20 18 40 18 Q56 18 56 44 Z" fill="url(#f3gr)" stroke="#5d0000"/><path d="M64 44 Q64 18 80 18 Q100 18 100 44 Z" fill="url(#f3gu)" stroke="#0a1f5c"/>
      <path d="M28 30 Q32 22 40 22" stroke="rgba(255,255,255,.7)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M72 30 Q76 22 84 22" stroke="rgba(255,255,255,.7)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g fill="none" stroke="url(#f3gc)" stroke-width="7"><circle cx="40" cy="84" r="17"/><circle cx="80" cy="84" r="17"/></g>
      <g fill="none" stroke="#37474f" stroke-width="1.5"><circle cx="40" cy="84" r="20.5"/><circle cx="80" cy="84" r="20.5"/><circle cx="40" cy="84" r="13.5"/><circle cx="80" cy="84" r="13.5"/></g>
      <g stroke="url(#f3gc)" stroke-width="4"><line x1="55" y1="80" x2="65" y2="80"/></g><g fill="#90a4ae" stroke="#37474f"><rect x="52" y="76" width="6" height="8" rx="2"/><rect x="62" y="76" width="6" height="8" rx="2"/></g>
      <rect x="30" y="64" width="12" height="7" rx="2" fill="#78909c"/><rect x="78" y="64" width="12" height="7" rx="2" fill="#78909c"/>
    </svg>`
};
function fx3ApplyCellIcons() {
    Object.keys(FX3_CELL_ICONS).forEach(id => {
        const ic = document.querySelector(`#cell-${id} .cell-bg-icon`);
        if (ic && !ic.querySelector('.fx3-cell-svg')) { ic.innerHTML = FX3_CELL_ICONS[id]; ic.classList.add('has-svg'); }
    });
}

// ============================================================
// 🚆 🚢 🚌 STOTYS – nauji detalūs traukinys, laivas ir autobusas su dalelėmis
// ============================================================
const FX3_VEH = {
    19: { kind: 'train', T: 4600, w: 4.2, ground: 'rails' },
    46: { kind: 'bus', T: 4000, w: 2.4, ground: 'road' },
    37: { kind: 'ship', T: 5200, w: 2.6, ground: 'sea' }
};
function fxVehicle3(fieldId) {
    const cfg = FX3_VEH[fieldId];
    if (!cfg) return;
    const c = fxPrep(fieldId, true);
    if (!c) { return; }
    const total = (gameState && gameState.board && gameState.board.length) || 52;
    let dx, dy;
    if (cfg.kind === 'ship') {
        const nx = document.getElementById(`cell-${(fieldId + 1) % total}`);
        const pn = nx ? fxBoardPoint(nx, c.board) : { x: c.pc.x - 1, y: c.pc.y };
        dx = pn.x - c.pc.x; dy = pn.y - c.pc.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    } else { dx = c.board.offsetWidth / 2 - c.pc.x >= 0 ? 1 : -1; dy = 0; }
    const vw = Math.max(110, c.s * cfg.w);
    const VB = { train: [300, 76], bus: [220, 92], ship: [240, 110] }[cfg.kind];
    const vh = vw * VB[1] / VB[0];
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const flip = horiz && dx < 0;
    const ang = horiz ? 0 : Math.atan2(dy, dx) * 180 / Math.PI;
    const ar = ang * Math.PI / 180;
    const ux = Math.sin(ar), uy = -Math.cos(ar);           // „aukštyn“ transporto atžvilgiu
    const fx = horiz ? dx : Math.cos(ar), fy = horiz ? 0 : Math.sin(ar);   // „pirmyn“
    const ox = cfg.kind === 'ship' ? c.ix * c.L * 0.55 : 0, oy = cfg.kind === 'ship' ? c.iy * c.L * 0.55 : 0;
    const dist = horiz ? c.board.offsetWidth * 0.46 : c.board.offsetHeight * 0.5;
    const T = cfg.T;
    // Žemė
    const gr = fxEl(c, 'fx3-ground fx3-' + cfg.ground);
    gr.style.width = (dist + vw * 1.4) + 'px';
    gr.style.height = (cfg.kind === 'ship' ? vh * 1.5 : vh * 0.38) + 'px';
    gr.style.left = ox + 'px'; gr.style.top = oy + 'px';
    gr.style.transform = `rotate(${Math.atan2(fy, fx) * 180 / Math.PI}deg) translate(${-vw * 0.7}px, ${cfg.kind === 'ship' ? '-40%' : (vh * 0.32) + 'px'})`;
    gr.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
    // Signalas (traukiniui) / stotelė (autobusui)
    if (cfg.kind === 'train' || cfg.kind === 'bus') {
        const sg = fxEl(c, 'fx-obj fx3-signal ' + cfg.kind, cfg.kind === 'train'
            ? '<i class="r"></i><i class="g"></i>' : '<b>🚏</b>');
        sg.style.setProperty('--sz', Math.max(12, vh * 0.28) + 'px');
        const sx = ox - fx * vw * 0.55 - ux * vh * 0.62, sy = oy - fy * vw * 0.55 - uy * vh * 0.62;
        sg.animate([{ transform: fxT(sx, sy, 0, 0), opacity: 0 }, { transform: fxT(sx, sy, 0, 1), opacity: 1, offset: 0.08 }, { transform: fxT(sx, sy, 0, 1), opacity: 1, offset: 0.6 }, { transform: fxT(sx, sy, 0, 1), opacity: 0, offset: 0.75 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
        setTimeout(() => sg.classList.add('go'), T * 0.2);
    }
    const veh = fxEl(c, 'fx-obj fx3-veh fx3-' + cfg.kind, `<div class="fx3-bob"><div class="vx-img" style="width:${vw}px;${flip ? 'transform:scaleX(-1);' : ''}">${FX3_SVG[cfg.kind]}</div></div>`);
    const P = (p, s = 1) => `translate(${(ox + fx * dist * p).toFixed(1)}px, ${(oy + fy * dist * p).toFixed(1)}px) rotate(${ang}deg) scale(${s})`;
    veh.animate([
        { transform: P(-0.12, 0.85), opacity: 0, offset: 0 },
        { transform: P(0, 1), opacity: 1, offset: 0.1, easing: 'ease-out' },
        { transform: P(0, 1), offset: 0.26, easing: 'cubic-bezier(.55,0,.8,.4)' },
        { transform: P(0.45, 1), opacity: 1, offset: 0.72 },
        { transform: P(1, 1), opacity: 0, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    const R = Math.max(c.board.offsetWidth, c.board.offsetHeight) * 0.6;
    const sys = fx2Canvas(c, R, 1);
    const smoke = FX2.cloud('vsmk', '120,120,120'), white = FX2.cloud('vwht', '255,255,255'), dust = FX2.cloud('vdust', '160,140,110');
    const spark = FX2.sprite('vspark', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(180,220,255,.9)'], [1, 'rgba(80,140,255,0)']], 32);
    const head = FX2.sprite('vhead', [[0, 'rgba(255,255,230,.9)'], [1, 'rgba(255,255,200,0)']], 64);
    let horn = false;
    sys.run(T, (el) => {
        const t = el / T;
        const m = new DOMMatrixReadOnly(getComputedStyle(veh).transform);
        const op = parseFloat(getComputedStyle(veh).opacity) || 0;
        if (op < 0.15) return;
        const at = (al, up) => ({ x: m.e + fx * vw * al + ux * vh * up, y: m.f + fy * vw * al + uy * vh * up });
        // priekinis žibintas
        const hp = at(0.5, -0.1);
        sys.add({ x: hp.x + fx * 10, y: hp.y + fy * 10, life: 40, sprite: head, size: vh * 0.9, blend: 'lighter', a0: 0.55 * op, fi: 0.01 });
        const moving = t > 0.26;
        if (cfg.kind === 'train') {
            if (moving && Math.random() < 0.5) {
                const p = at(0.3, 0.5);
                for (let i = 0; i < 3; i++) sys.add({ x: p.x, y: p.y, vx: -fx * fx2R(40, 140) + fx2R(-60, 60), vy: fx2R(-120, -20), gy: 400, life: fx2R(200, 450), line: true, color: '#e3f2ff', lw: 1.4, trail: 0.06, blend: 'lighter', a0: 1, fi: 0.02 });
                sys.add({ x: p.x, y: p.y, life: 90, sprite: spark, size: fx2R(14, 26), blend: 'lighter', a0: 0.9, fi: 0.02 });
            }
            if (moving && Math.random() < 0.6) { const p = at(-0.5, -0.42); sys.add({ x: p.x, y: p.y, vx: -fx * 30 + fx2R(-20, 20), vy: fx2R(-20, 5), turb: 40, life: fx2R(600, 1000), sprite: dust, size: fx2R(14, 26), grow: 30, a0: 0.35 }); }
        } else if (cfg.kind === 'bus') {
            if (Math.random() < (moving ? 0.8 : 0.35)) { const p = at(-0.5, -0.38); sys.add({ x: p.x, y: p.y, vx: -fx * fx2R(30, 70), vy: fx2R(-30, -5), turb: 30, life: fx2R(600, 1100), sprite: smoke, size: fx2R(8, 16), grow: 26, a0: moving ? 0.5 : 0.3 }); }
        } else {
            if (!horn && t > 0.14) {
                horn = true;
                const p = at(-0.08, 0.42);
                for (let i = 0; i < 10; i++) sys.add({ x: p.x, y: p.y, vx: fx2R(-25, 25) + ux * 60, vy: uy * fx2R(60, 120), turb: 40, life: fx2R(900, 1400), sprite: white, size: fx2R(16, 30), grow: 40, a0: 0.75 });
            }
            if (Math.random() < 0.55) { const p = at(-0.08, 0.42); sys.add({ x: p.x, y: p.y, vx: -fx * 20 + ux * 40, vy: -fy * 20 + uy * 40, turb: 30, life: fx2R(900, 1500), sprite: smoke, size: fx2R(12, 22), grow: 26, a0: 0.45 }); }
            if (moving) for (const sgn of [-1, 1]) {
                const p = at(-0.48, -0.34);
                sys.add({ x: p.x, y: p.y, vx: -fx * fx2R(10, 30) + ux * sgn * fx2R(20, 50), vy: -fy * fx2R(10, 30) + uy * sgn * fx2R(20, 50), drag: 0.02, life: fx2R(1200, 1900), sprite: white, size: fx2R(6, 12), grow: 18, a0: 0.75, fi: 0.05 });
            }
            const bp = at(0.48, -0.36);
            if (moving && Math.random() < 0.7) sys.add({ x: bp.x, y: bp.y, vx: ux * fx2R(-40, 40), vy: uy * fx2R(-40, 40), life: fx2R(400, 700), sprite: white, size: fx2R(6, 12), grow: 20, a0: 0.8 });
        }
    });
    if (cfg.kind === 'ship') {
        for (let i = 0; i < 3; i++) {
            const g = fxEl(c, 'fx-obj fx3-gull', `<div class="vx-img" style="width:${vh * 0.32}px">${FX3_SVG.gull}</div>`);
            const sx = ox + ux * vh * (0.9 + i * 0.25) - fx * vw * 0.4, sy = oy + uy * vh * (0.9 + i * 0.25) - fy * vw * 0.4;
            g.animate([{ transform: fxT(sx, sy, 0, 0.6), opacity: 0 }, { transform: fxT(sx + fx * 20, sy + fy * 20, 0, 1), opacity: 1, offset: 0.15 },
                { transform: fxT(sx + fx * dist * 0.6 + ux * 30, sy + fy * dist * 0.6 + uy * 30, 0, 1.1), opacity: 1, offset: 0.85 }, { transform: fxT(sx + fx * dist * 0.8, sy + fy * dist * 0.8, 0, 1.1), opacity: 0 }],
                { duration: T, delay: i * 180, fill: 'both' });
        }
    }
    fxEnd(c, T + 1300);
}

// ============================================================
// 🍺 LATRŲ BARAS #21 – neonas, alaus bokalas prisipildo, putos bėga, susidaužia bokalai
// ============================================================
function fxBar3(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5400;
    const w = Math.max(190, c.L * 2.1), h = w * 0.78;
    const x = c.ix * (c.L * 0.6 + w * 0.5), y = c.iy * (c.L * 0.6 + h * 0.5);
    const S = fx3Card(c, w, h, x, y, 'fx3-bar', T);
    fx3El(S.stage, 'fx3-neon', 'BAR', { fontSize: (h * 0.2) + 'px', top: (-h * 0.4) + 'px', left: (w * 0.14) + 'px' });
    fx3El(S.stage, 'fx3-bar-counter', '', { width: w + 'px', height: (h * 0.22) + 'px', left: (-w / 2) + 'px', top: (h * 0.28) + 'px' });
    const mw = h * 0.42;
    const tap = fx3El(S.stage, 'fx3-tap', '<i></i><b></b>', { left: (-mw * 0.45) + 'px', top: (-h * 0.42) + 'px', '--s': (mw / 60) });
    const mug1 = fx3El(S.stage, 'fx-obj fx3-mug', `<div class="vx-img" style="width:${mw}px">${FX3_SVG.mug(false)}</div>`);
    const mug2 = fx3El(S.stage, 'fx-obj fx3-mug', `<div class="vx-img" style="width:${mw}px;transform:scaleX(-1)">${FX3_SVG.mug(true)}</div>`);
    const my = h * 0.12;
    mug1.animate([{ transform: fxT(-mw * 0.3, my) }, { transform: fxT(-mw * 0.3, my), offset: 0.55 }, { transform: fxT(-mw * 0.05, my - 8, 14), offset: 0.66, easing: 'ease-in' },
        { transform: fxT(-mw * 0.18, my - 4, -4), offset: 0.7 }, { transform: fxT(-mw * 0.3, my), offset: 0.8 }, { transform: fxT(-mw * 0.3, my) }], { duration: T, fill: 'forwards' });
    mug2.animate([{ transform: fxT(w * 0.7, my), opacity: 0 }, { transform: fxT(w * 0.7, my), opacity: 0, offset: 0.46 }, { transform: fxT(mw * 0.75, my), opacity: 1, offset: 0.56, easing: 'ease-out' },
        { transform: fxT(mw * 0.5, my - 8, -14), offset: 0.66, easing: 'ease-in' }, { transform: fxT(mw * 0.62, my - 4, 4), offset: 0.7 }, { transform: fxT(mw * 0.75, my), offset: 0.8 }, { transform: fxT(mw * 0.75, my) }], { duration: T, fill: 'forwards' });
    const fill = mug1.querySelector('.fx3-fill');
    if (fill) fill.animate([{ transform: 'translateY(92px)' }, { transform: 'translateY(92px)', offset: 0.1 }, { transform: 'translateY(0px)', offset: 0.42 }, { transform: 'translateY(-4px)', offset: 0.5 }, { transform: 'translateY(0px)' }], { duration: T, fill: 'forwards' });
    const sys = fx2Canvas(S, Math.max(w, h) * 0.75, 5);
    const foam = FX2.cloud('foam', '255,252,240'), amber = '#ffb300';
    const glow = FX2.sprite('neonPink', [[0, 'rgba(255,80,200,.5)'], [1, 'rgba(255,80,200,0)']], 64);
    let clinked = false;
    const mx = -mw * 0.3, mTop = my - mw * 1.22 * 0.5 + mw * 0.15;
    sys.run(T, (el) => {
        const t = el / T;
        if (t > 0.08 && t < 0.42) {
            for (let i = 0; i < 3; i++) sys.add({ x: -mw * 0.45 + mw * 0.1 + fx2R(-1.5, 1.5), y: -h * 0.34, vx: 0, vy: fx2R(200, 260), gy: 300, life: fx2R(260, 340), line: true, color: amber, lw: fx2R(2.5, 4), trail: 0.05, a0: 0.9, fi: 0.02 });
        }
        if (t > 0.12 && t < 0.9 && Math.random() < 0.5) {
            sys.add({ x: mx + fx2R(-mw * 0.22, mw * 0.18), y: my + mw * 0.45, vy: fx2R(-50, -30), life: fx2R(600, 900), a0: 0.7, fi: 0.1, size: fx2R(1, 2.2),
                draw: (g, p) => { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.8; g.beginPath(); g.arc(p.x + Math.sin(p.age / 80) * 1.2, p.y, p.size, 0, Math.PI * 2); g.stroke(); } });
        }
        if (t > 0.42 && t < 0.56 && Math.random() < 0.6) {
            const side = Math.random() < 0.5 ? -1 : 1;
            sys.add({ x: mx + side * mw * 0.3, y: mTop, vx: side * fx2R(4, 12), vy: fx2R(8, 20), gy: 35, life: fx2R(900, 1400), sprite: foam, size: fx2R(10, 18), grow: 4, a0: 0.95, fi: 0.05 });
        }
        if (!clinked && t > 0.66) {
            clinked = true;
            fx2Shake(S.card, 4, 260);
            const cx0 = mw * 0.22, cy0 = my - mw * 0.45;
            for (let i = 0; i < 28; i++) { const a = -Math.PI / 2 + fx2R(-1.3, 1.3), v = fx2R(80, 220); sys.add({ x: cx0, y: cy0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 520, life: fx2R(500, 900), size: fx2R(2, 4.5),
                draw: (g, p) => { g.fillStyle = i % 3 ? '#ffca28' : '#fffde7'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }, a0: 1, fi: 0.02 }); }
            for (let i = 0; i < 8; i++) sys.add({ x: cx0 + fx2R(-10, 10), y: cy0, vx: fx2R(-30, 30), vy: fx2R(-60, -20), gy: 80, life: fx2R(700, 1100), sprite: foam, size: fx2R(10, 18), a0: 0.9 });
            const star = FX2.sprite('clinkStar', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,180,.8)'], [1, 'rgba(255,200,80,0)']], 64);
            sys.add({ x: cx0, y: cy0, life: 400, sprite: star, size: 20, grow: 300, blend: 'lighter', a0: 0.9, fi: 0.05 });
        }
        if (Math.random() < 0.08) sys.add({ x: fx2R(-w * 0.2, w * 0.2), y: -h * 0.36, life: 120, sprite: glow, size: h * 0.6, blend: 'lighter', a0: 0.5, fi: 0.2 });
    });
    fxEnd(c, T + 300);
}

// ============================================================
// 🏊 BASEINAS #24 – baseinas su takeliais, kamuolys įkrenta, didelis pliūpsnis, ratilai, antis
// ============================================================
function fxPool3(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5400;
    const w = Math.max(200, c.L * 2.3), h = w * 0.62;
    const x = c.ix * (c.L * 0.55 + w * 0.5) * 0.85, y = c.iy * (c.L * 0.55 + h * 0.5) * 0.85;
    const S = fx3Card(c, w, h, x, y, 'fx3-pool', T);
    const water = fx3El(S.stage, 'fx3-water', '', { width: (w - 20) + 'px', height: (h - 20) + 'px', left: (-(w - 20) / 2) + 'px', top: (-(h - 20) / 2) + 'px' });
    [0.33, 0.66].forEach(f => fx3El(water, 'fx3-lane', '', { top: (f * 100) + '%' }));
    const dk = h * 0.3;
    const duck = fx3El(S.stage, 'fx-obj fx3-duck', `<div class="vx-img" style="width:${dk}px">${FX3_SVG.duck}</div>`);
    duck.animate([{ transform: fxT(-w * 0.32, -h * 0.18, 0, 0) }, { transform: fxT(-w * 0.32, -h * 0.18, 0, 1), offset: 0.12 }, { transform: fxT(-w * 0.2, -h * 0.2, -6), offset: 0.45 },
        { transform: fxT(-w * 0.26, -h * 0.05, 10), offset: 0.55 }, { transform: fxT(-w * 0.1, -h * 0.1, -4), offset: 0.85 }, { transform: fxT(-w * 0.05, -h * 0.12, 0) }], { duration: T, fill: 'forwards' });
    const ring = fx3El(S.stage, 'fx-obj fx3-ring', '<i></i>', { '--d': (h * 0.32) + 'px' });
    ring.animate([{ transform: fxT(w * 0.28, h * 0.18, 0, 0) }, { transform: fxT(w * 0.28, h * 0.18, 0, 1), offset: 0.14 }, { transform: fxT(w * 0.22, h * 0.1, 40), offset: 0.55 }, { transform: fxT(w * 0.3, h * 0.2, 120) }], { duration: T, fill: 'forwards' });
    const bs = h * 0.3;
    const ball = fx3El(S.stage, 'fx-obj fx3-ball', `<div class="vx-img" style="width:${bs}px">${FX3_SVG.ball}</div>`);
    const shadow = fx3El(S.stage, 'fx-obj fx3-bshadow', '', { '--d': bs + 'px' });
    const bx = w * 0.05, by = h * 0.02;
    ball.animate([{ transform: fxT(bx, by - h * 0.9, 0, 2.6), opacity: 0 }, { transform: fxT(bx, by - h * 0.9, 0, 2.6), opacity: 0, offset: 0.12 }, { transform: fxT(bx, by - h * 0.5, 90, 1.9), opacity: 1, offset: 0.18 },
        { transform: fxT(bx, by, 200, 1), offset: 0.3, easing: 'ease-in' }, { transform: fxT(bx, by + 6, 210, 0.9), opacity: 0.85, offset: 0.33 },
        { transform: fxT(bx + 10, by - 4, 230, 1), opacity: 1, offset: 0.5 }, { transform: fxT(bx + 30, by + 8, 300, 1), offset: 0.88 }, { transform: fxT(bx + 34, by + 8, 310, 0.9), opacity: 0 }], { duration: T, fill: 'forwards' });
    shadow.animate([{ transform: fxT(bx, by + bs * 0.4, 0, 0.3), opacity: 0 }, { transform: fxT(bx, by + bs * 0.4, 0, 0.3), opacity: 0, offset: 0.14 }, { transform: fxT(bx, by + bs * 0.3, 0, 1), opacity: 0.35, offset: 0.3 }, { opacity: 0, offset: 0.33 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
    const sys = fx2Canvas(S, Math.max(w, h) * 0.75, 6);
    const white = FX2.cloud('splash', '255,255,255');
    let splashed = false;
    sys.run(T, (el) => {
        const t = el / T;
        if (!splashed && t > 0.3) {
            splashed = true;
            fx2Shake(S.card, 3, 250);
            for (let i = 0; i < 70; i++) {
                const a = -Math.PI / 2 + fx2R(-1.4, 1.4), v = fx2R(90, 300);
                sys.add({ x: bx + fx2R(-6, 6), y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 650, life: fx2R(600, 1100), size: fx2R(1.8, 4.5), a0: 1, fi: 0.02,
                    draw: (g, p) => { g.fillStyle = 'rgba(235,250,255,.95)'; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 1.4, Math.atan2(p.vy, p.vx), 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2); g.fill(); } });
            }
            for (let i = 0; i < 12; i++) sys.add({ x: bx + fx2R(-14, 14), y: by + fx2R(-6, 6), vx: fx2R(-40, 40), vy: fx2R(-50, -10), life: fx2R(600, 1000), sprite: white, size: fx2R(18, 34), grow: 40, a0: 0.8 });
            for (let k = 0; k < 4; k++) sys.add({ x: bx, y: by, life: 1800 + k * 200, a0: 0.85, fi: 0.02, size: 8 + k * 6, grow: w * 0.25,
                draw: (g, p, tt) => { g.strokeStyle = `rgba(255,255,255,${0.9 - tt * 0.6})`; g.lineWidth = 2.2 * (1 - tt) + 0.5; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 0.55, 0, 0, Math.PI * 2); g.stroke(); } });
        }
        if (t > 0.35 && t < 0.8 && Math.random() < 0.2) sys.add({ x: bx + fx2R(-20, 20), y: by + fx2R(-10, 10), life: 1400, a0: 0.6, fi: 0.05, size: 3, grow: 40,
            draw: (g, p, tt) => { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 0.55, 0, 0, Math.PI * 2); g.stroke(); } });
    });
    fxEnd(c, T + 300);
}

// ============================================================
// ⚡ ELEKTRA #28 – naktinė scena, transformatorius, žaibai, lemputė užsidega, kibirkštys
// ============================================================
function fxElectric3(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5000;
    const w = Math.max(200, c.L * 2.2), h = w * 0.8;
    const x = c.ix * (c.L * 0.6 + w * 0.5) * 0.9, y = c.iy * (c.L * 0.6 + h * 0.5) * 0.9;
    const S = fx3Card(c, w, h, x, y, 'fx3-night', T);
    const ps = h * 0.78;
    const pole = fx3El(S.stage, 'fx-obj fx3-pole', `<div class="vx-img" style="width:${ps}px">${FX3_SVG.pole}</div>`);
    pole.style.transform = fxT(-w * 0.18, h * 0.12);
    const bw = h * 0.3;
    const bulb = fx3El(S.stage, 'fx-obj fx3-bulb', `<div class="vx-img" style="width:${bw}px">${FX3_SVG.bulb}</div>`);
    bulb.style.transform = fxT(w * 0.27, -h * 0.12);
    const wire = fx3El(S.stage, 'fx3-wire', '', { left: (-w * 0.18 + ps * 0.33) + 'px', top: (h * 0.12 - ps * 0.5 + ps * 0.1) + 'px', width: (w * 0.45 - ps * 0.33 + bw * 0.1) + 'px' });
    wire.style.transformOrigin = '0 0';
    setTimeout(() => S.card.classList.add('lit'), T * 0.5);
    const sys = fx2Canvas(S, Math.max(w, h) * 0.8, 6);
    const spark = FX2.sprite('espark', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(170,210,255,.9)'], [1, 'rgba(60,120,255,0)']], 48);
    const warm = FX2.sprite('ewarm', [[0, 'rgba(255,250,220,.95)'], [0.4, 'rgba(255,220,120,.5)'], [1, 'rgba(255,200,80,0)']], 96);
    const tops = [-0.34, 0, 0.34].map(k => ({ x: -w * 0.18 + k * ps * 0.57, y: h * 0.12 - ps * 0.5 + ps * 0.08 }));
    const bulbP = { x: w * 0.27, y: -h * 0.12 - bw * 0.35 };
    let next = 0;
    const strike = (a, b, life, wdt) => {
        let pts = fx3Bolt(a.x, a.y, b.x, b.y, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
        const br = []; if (Math.random() < 0.7) { const k = pts[Math.floor(pts.length * fx2R(0.3, 0.7))]; br.push(fx3Bolt(k[0], k[1], k[0] + fx2R(-40, 40), k[1] + fx2R(10, 50), 20)); }
        sys.add({ x: 0, y: 0, life, a0: 1, fi: 0.01, blend: 'lighter', draw: (g, p) => {
            if (Math.random() < 0.35) pts = fx3Bolt(a.x, a.y, b.x, b.y, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
            fx3DrawBolt(g, pts, wdt); br.forEach(q => fx3DrawBolt(g, q, wdt * 0.6));
        } });
        for (let i = 0; i < 16; i++) { const an = Math.random() * Math.PI * 2, v = fx2R(60, 260); sys.add({ x: b.x, y: b.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, gy: 600, life: fx2R(300, 700), line: true, color: '#e8f1ff', lw: 1.4, trail: 0.05, blend: 'lighter', a0: 1, fi: 0.02 }); }
        sys.add({ x: b.x, y: b.y, life: 200, sprite: spark, size: 40, grow: 120, blend: 'lighter', a0: 1, fi: 0.05 });
    };
    sys.run(T, (el) => {
        const t = el / T;
        if (t > 0.1 && t < 0.86 && el > next) {
            next = el + fx2R(140, 320);
            const a = tops[Math.floor(Math.random() * 3)];
            if (t < 0.48) strike(a, tops[(tops.indexOf(a) + 1 + Math.floor(Math.random() * 2)) % 3], fx2R(90, 160), 1.6);
            else if (Math.random() < 0.6) strike(a, { x: bulbP.x + fx2R(-6, 6), y: bulbP.y + fx2R(-4, 4) }, fx2R(110, 180), 2);
            else strike({ x: fx2R(-w * 0.4, w * 0.4), y: -h * 0.5 }, { x: a.x, y: a.y }, fx2R(120, 200), 2.4);
            if (Math.random() < 0.3) { fx2Shake(S.card, 3, 160); S.card.classList.remove('flash'); void S.card.offsetWidth; S.card.classList.add('flash'); }
        }
        if (t > 0.5 && t < 0.9) sys.add({ x: bulbP.x, y: bulbP.y + bw * 0.25, life: 40, sprite: warm, size: bw * 3.2 * (0.9 + Math.random() * 0.15), blend: 'lighter', a0: 0.75, fi: 0.01 });
        if (t > 0.1 && t < 0.86 && Math.random() < 0.3) { const a = tops[Math.floor(Math.random() * 3)]; sys.add({ x: a.x, y: a.y, life: 60, sprite: spark, size: fx2R(12, 26), blend: 'lighter', a0: 0.8, fi: 0.02 }); }
    });
    fxEnd(c, T + 300);
}

// ============================================================
// 🧖 PIRTIS #32 – medinė pirtis, samtis užpila vandens ant akmenų, kyla garų debesys, termometras, vantos lapai
// ============================================================
function fxSauna3(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5600;
    const w = Math.max(200, c.L * 2.2), h = w * 0.78;
    const x = c.ix * (c.L * 0.6 + w * 0.5) * 0.9, y = c.iy * (c.L * 0.6 + h * 0.5) * 0.9;
    const S = fx3Card(c, w, h, x, y, 'fx3-wood', T);
    const sw = w * 0.52;
    const stove = fx3El(S.stage, 'fx-obj fx3-stove', `<div class="vx-img" style="width:${sw}px">${FX3_SVG.stove}</div>`);
    stove.style.transform = fxT(-w * 0.14, h * 0.2);
    const bk = w * 0.36;
    const bucket = fx3El(S.stage, 'fx-obj fx3-bucket', `<div class="vx-img" style="width:${bk}px">${FX3_SVG.bucket}</div>`);
    bucket.style.transform = fxT(w * 0.27, h * 0.22);
    const th = h * 0.5;
    const thermo = fx3El(S.stage, 'fx-obj fx3-thermo', `<div class="vx-img" style="width:${th * 0.27}px">${FX3_SVG.thermo}</div><span class="fx3-deg">60°</span>`);
    thermo.style.transform = fxT(w * 0.4, -h * 0.18);
    const ladle = bucket.querySelector('.fx3-ladle');
    // samtis: pakyla, nuneša virš akmenų, apverčia
    if (ladle) ladle.animate([{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(0,0) rotate(0deg)', offset: 0.12 }, { transform: 'translate(-20px,-30px) rotate(-10deg)', offset: 0.22 },
        { transform: 'translate(-150px,-62px) rotate(-18deg)', offset: 0.32 }, { transform: 'translate(-150px,-62px) rotate(-80deg)', offset: 0.4 }, { transform: 'translate(-150px,-62px) rotate(-80deg)', offset: 0.5 },
        { transform: 'translate(0,0) rotate(0deg)', offset: 0.66 }, { transform: 'translate(0,0) rotate(0deg)' }], { duration: T, fill: 'forwards' });
    const merc = thermo.querySelector('.fx3-merc');
    if (merc) merc.animate([{ transform: 'scaleY(.45)' }, { transform: 'scaleY(.45)', offset: 0.36 }, { transform: 'scaleY(.98)', offset: 0.7 }, { transform: 'scaleY(.95)' }], { duration: T, fill: 'forwards' });
    const deg = thermo.querySelector('.fx3-deg');
    const t0 = performance.now();
    const tick = () => { if (!deg.isConnected) return; const k = Math.min(1, Math.max(0, ((performance.now() - t0) / T - 0.36) / 0.34)); deg.textContent = Math.round(60 + 40 * k) + '°'; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const sys = fx2Canvas(S, Math.max(w, h) * 0.8, 6);
    const steam = [FX2.cloud('st1', '255,255,255'), FX2.cloud('st2', '235,240,245')];
    const hot = FX2.sprite('hot', [[0, 'rgba(255,170,60,.9)'], [1, 'rgba(255,80,0,0)']], 64);
    const stonesX = -w * 0.14, stonesY = h * 0.2 - sw * 0.75 * 0.5 + sw * 0.75 * 0.25;
    let hissed = false;
    sys.run(T, (el) => {
        const t = el / T;
        if (t > 0.36 && t < 0.48) for (let i = 0; i < 3; i++) sys.add({ x: stonesX + fx2R(-10, 18), y: stonesY - h * 0.26, vx: fx2R(-20, 20), vy: fx2R(40, 90), gy: 700, life: fx2R(250, 380), size: fx2R(1.6, 3),
            draw: (g, p) => { g.fillStyle = 'rgba(120,200,255,.95)'; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 1.6, 0, 0, Math.PI * 2); g.fill(); }, a0: 1, fi: 0.02 });
        if (t > 0.4 && t < 0.85) {
            if (!hissed) { hissed = true; fx2Shake(S.card, 2, 200); }
            const k = t < 0.55 ? 3 : 1;
            for (let i = 0; i < k; i++) sys.add({ x: stonesX + fx2R(-sw * 0.3, sw * 0.3), y: stonesY, vx: fx2R(-30, 30), vy: fx2R(-120, -60), drag: 0.02, turb: 70, ph: Math.random() * 6,
                life: fx2R(1500, 2400), sprite: steam[i % 2], size: fx2R(30, 60), grow: fx2R(60, 110), rot: Math.random() * 6, vr: fx2R(-0.5, 0.5), a0: fx2R(0.5, 0.8), fi: 0.12 });
            if (Math.random() < 0.3) sys.add({ x: stonesX, y: stonesY, life: 300, sprite: hot, size: sw * 0.8, blend: 'lighter', a0: 0.4, fi: 0.3 });
        }
        if (t > 0.15 && t < 0.9 && Math.random() < 0.06) {
            sys.add({ x: fx2R(-w * 0.45, w * 0.45), y: -h * 0.55, vx: fx2R(-20, 20), vy: fx2R(25, 45), turb: 60, life: fx2R(2200, 3000), size: fx2R(5, 8), rot: Math.random() * 6, vr: fx2R(-3, 3), a0: 0.95, fi: 0.1,
                draw: (g, p) => { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = '#6dbb45'; g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#3f7d22'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-p.size, 0); g.lineTo(p.size, 0); g.stroke(); g.restore(); } });
        }
    });
    fxEnd(c, T + 300);
}

// ============================================================
// 💧 VANDUO #44 – chromuotas čiaupas, srovė, purslai, bala su ratilais
// ============================================================
function fxWater3(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 5000;
    const w = Math.max(190, c.L * 2.1), h = w * 0.82;
    const x = c.ix * (c.L * 0.6 + w * 0.5) * 0.9, y = c.iy * (c.L * 0.6 + h * 0.5) * 0.9;
    const S = fx3Card(c, w, h, x, y, 'fx3-tiles', T);
    const fw = w * 0.62;
    const fc = fx3El(S.stage, 'fx-obj fx3-faucet', `<div class="vx-img" style="width:${fw}px">${FX3_SVG.faucet}</div>`);
    fc.style.transform = fxT(-w * 0.1, -h * 0.28);
    const handle = fc.querySelector('.fx3-handle');
    if (handle) handle.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)', offset: 0.08 }, { transform: 'rotate(-35deg)', offset: 0.16 }, { transform: 'rotate(-35deg)', offset: 0.78 }, { transform: 'rotate(0deg)', offset: 0.86 }, { transform: 'rotate(0deg)' }], { duration: T, fill: 'forwards' });
    const sx = -w * 0.1 + fw * (112 / 150 - 0.5), sy = -h * 0.28 + fw * 0.66 * (76 / 100 - 0.5);
    const floorY = h * 0.32;
    const pud = fx3El(S.stage, 'fx3-puddle', '', { left: sx + 'px', top: floorY + 'px' });
    pud.animate([{ width: '0px', height: '0px', opacity: 0 }, { width: '0px', height: '0px', opacity: 0, offset: 0.18 }, { width: (w * 0.7) + 'px', height: (h * 0.2) + 'px', opacity: 1, offset: 0.7 }, { width: (w * 0.75) + 'px', height: (h * 0.22) + 'px', opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
    const sys = fx2Canvas(S, Math.max(w, h) * 0.8, 6);
    sys.run(T, (el) => {
        const t = el / T;
        const flow = t > 0.15 && t < 0.8 ? 1 : (t > 0.8 && t < 0.86 ? 0.3 : 0);
        for (let i = 0; i < Math.round(9 * flow); i++) {
            sys.add({ x: sx + fx2R(-2.5, 2.5) * (1 + t), y: sy, vx: fx2R(-6, 6), vy: fx2R(60, 120), gy: 900, life: 900, a0: 0.9, fi: 0.01, size: fx2R(2.4, 4.4),
                draw: (g, p) => {
                    if (p.y > floorY) { p.age = p.life;
                        if (Math.random() < 0.45) for (let k = 0; k < 2; k++) { const a = -Math.PI / 2 + fx2R(-1.2, 1.2), v = fx2R(40, 150); sys.add({ x: p.x, y: floorY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 700, life: fx2R(250, 450), size: fx2R(1, 2.4), a0: 0.95, fi: 0.02,
                            draw: (gg, q) => { gg.fillStyle = 'rgba(200,235,255,.95)'; gg.beginPath(); gg.arc(q.x, q.y, q.size, 0, Math.PI * 2); gg.fill(); } }); }
                        return; }
                    const len = Math.min(18, p.vy * 0.04);
                    const gr = g.createLinearGradient(p.x, p.y - len, p.x, p.y);
                    gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(1, 'rgba(180,230,255,.95)');
                    g.strokeStyle = gr; g.lineWidth = p.size * 1.6; g.lineCap = 'round';
                    g.beginPath(); g.moveTo(p.x, p.y - len); g.lineTo(p.x, p.y); g.stroke();
                } });
        }
        if (flow && Math.random() < 0.15) sys.add({ x: sx + fx2R(-w * 0.15, w * 0.15), y: floorY + fx2R(-4, 4), life: 1300, a0: 0.8, fi: 0.05, size: 4, grow: 50,
            draw: (g, p, tt) => { g.strokeStyle = `rgba(255,255,255,${0.8 - tt * 0.7})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 0.32, 0, 0, Math.PI * 2); g.stroke(); } });
    });
    // Didelis lašas – „vandens“ ženklas
    const drop = fx3El(S.stage, 'fx-obj fx3-drop', '<i></i>', { '--d': (h * 0.22) + 'px' });
    drop.animate([{ transform: fxT(w * 0.32, -h * 0.05, 0, 0), opacity: 0 }, { transform: fxT(w * 0.32, -h * 0.05, 0, 0), opacity: 0, offset: 0.25 }, { transform: fxT(w * 0.32, -h * 0.08, 0, 1.15), opacity: 1, offset: 0.33 },
        { transform: fxT(w * 0.32, -h * 0.05, 0, 1), offset: 0.4 }, { transform: fxT(w * 0.32, -h * 0.07, 0, 1), opacity: 1, offset: 0.85 }, { transform: fxT(w * 0.32, -h * 0.05, 0, 0.6), opacity: 0 }], { duration: T, fill: 'forwards' });
    fxEnd(c, T + 300);
}

// ============================================================
// 🏖️ PAPLŪDIMYS #48 – saulė, jūra su bangomis, skėtis išsiskleidžia, kamuolys šokinėja, žuvėdros
// ============================================================
function fxBeach3(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 5600;
    const w = Math.max(210, c.L * 2.3), h = w * 0.7;
    const x = c.ix * (c.L * 0.6 + w * 0.5) * 0.9, y = c.iy * (c.L * 0.6 + h * 0.5) * 0.9;
    const S = fx3Card(c, w, h, x, y, 'fx3-beach', T);
    fx3El(S.stage, 'fx3-sea', '<i class="w1"></i><i class="w2"></i><i class="w3"></i>', { width: w + 'px', height: (h * 0.42) + 'px', left: (-w / 2) + 'px', top: (-h * 0.12) + 'px' });
    fx3El(S.stage, 'fx3-sand', '', { width: w + 'px', height: (h * 0.4) + 'px', left: (-w / 2) + 'px', top: (h * 0.18) + 'px' });
    const sn = h * 0.42;
    const sun = fx3El(S.stage, 'fx-obj fx3-sun', `<div class="vx-img" style="width:${sn}px">${FX3_SVG.sun}</div>`);
    sun.animate([{ transform: fxT(w * 0.3, -h * 0.05, 0, 0.6) }, { transform: fxT(w * 0.3, -h * 0.3, 0, 1), offset: 0.25, easing: 'ease-out' }, { transform: fxT(w * 0.3, -h * 0.32, 0, 1) }], { duration: T, fill: 'forwards' });
    const um = h * 0.62;
    const umb = fx3El(S.stage, 'fx-obj fx3-umb', `<div class="vx-img" style="width:${um}px">${FX3_SVG.umbrella}</div>`);
    umb.style.transform = fxT(-w * 0.25, h * 0.08);
    const can = umb.querySelector('.fx3-canopy');
    if (can) can.animate([{ transform: 'scaleX(.05) scaleY(.6)' }, { transform: 'scaleX(.05) scaleY(.6)', offset: 0.12 }, { transform: 'scaleX(1.06) scaleY(1)', offset: 0.26, easing: 'ease-out' }, { transform: 'scaleX(1)', offset: 0.3 }, { transform: 'scaleX(1)' }], { duration: T, fill: 'forwards' });
    const bs = h * 0.17;
    const ball = fx3El(S.stage, 'fx-obj fx3-ball', `<div class="vx-img" style="width:${bs}px">${FX3_SVG.ball}</div>`);
    const kb = []; const gY = h * 0.3;
    for (let i = 0; i <= 12; i++) { const f = i / 12, bounce = Math.abs(Math.sin(f * Math.PI * 3.5)) * h * 0.28 * (1 - f * 0.5); kb.push({ transform: fxT(-w * 0.05 + f * w * 0.32, gY - bounce, f * 540, 1), offset: 0.15 + f * 0.7 }); }
    ball.animate([{ transform: fxT(-w * 0.05, gY, 0, 0), opacity: 0, offset: 0 }, { transform: fxT(-w * 0.05, gY, 0, 1), opacity: 1, offset: 0.14 }, ...kb, { transform: fxT(w * 0.27, gY, 540, 0.7), opacity: 0, offset: 1 }], { duration: T, fill: 'forwards' });
    for (let i = 0; i < 2; i++) {
        const g = fx3El(S.stage, 'fx-obj fx3-gull', `<div class="vx-img" style="width:${h * 0.16 * (1 - i * 0.25)}px">${FX3_SVG.gull}</div>`);
        g.animate([{ transform: fxT(-w * 0.6, -h * 0.32 + i * 18) }, { transform: fxT(w * 0.6, -h * 0.4 + i * 14) }], { duration: T * (0.9 + i * 0.25), delay: i * 400, fill: 'both' });
    }
    const sys = fx2Canvas(S, Math.max(w, h) * 0.8, 6);
    const glint = FX2.sprite('glint', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,220,.6)'], [1, 'rgba(255,255,200,0)']], 32);
    sys.run(T, () => {
        if (Math.random() < 0.5) sys.add({ x: fx2R(-w * 0.5, w * 0.5), y: fx2R(-h * 0.1, h * 0.17), life: fx2R(300, 700), sprite: glint, size: fx2R(4, 12), blend: 'lighter', a0: 1, fi: 0.5,
            draw: (g, p, tt) => { const s = p.size * Math.sin(tt * Math.PI); g.drawImage(p.sprite, p.x - s, p.y - s * 0.3, s * 2, s * 0.6); g.drawImage(p.sprite, p.x - s * 0.3, p.y - s, s * 0.6, s * 2); } });
    });
    fxEnd(c, T + 300);
}

// ============================================================
// 🎂 GIMTADIENIS #50 – tortas su žvakutėmis (užpučiamos), 5 fejerverkų papliūpos, konfeti ir balionai
// ============================================================
function fxBirthday3(fieldId) {
    const c = fxPrep(fieldId, true);
    if (!c) return;
    const T = 6600;
    const iw = fx3Inward(c);
    const cw = Math.max(110, c.L * 1.3);
    const ckx = iw.x * c.L * 1.0, cky = iw.y * c.L * 1.0;
    const cake = fxEl(c, 'fx-obj fx3-cake', `<div class="vx-img" style="width:${cw}px">${FX3_SVG.cake}</div>`);
    cake.animate([{ transform: fxT(ckx, cky + 30, 0, 0.2), opacity: 0 }, { transform: fxT(ckx, cky - 6, 0, 1.08), opacity: 1, offset: 0.08 }, { transform: fxT(ckx, cky, 0, 1), offset: 0.12 },
        { transform: fxT(ckx, cky, 0, 1), opacity: 1, offset: 0.88 }, { transform: fxT(ckx, cky, 0, 0.8), opacity: 0 }], { duration: T, fill: 'forwards' });
    const flames = cake.querySelectorAll('.fx3-cflame');
    flames.forEach((f, i) => f.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 + i * 0.012 }, { transform: 'scale(.4,1.3) skewX(-30deg)', opacity: 0.6, offset: 0.23 + i * 0.012 }, { transform: 'scale(0)', opacity: 0, offset: 0.25 + i * 0.012 }, { transform: 'scale(0)', opacity: 0 }], { duration: T, fill: 'forwards' }));
    // balionai
    const bcols = ['#ff4d6d', '#4cc9f0', '#ffd23f', '#b388ff', '#3ddc97'];
    bcols.forEach((col, i) => {
        const b = fxEl(c, 'fx-obj fx3-balloon', `<div class="vx-img" style="width:${cw * 0.32}px">${FX3_SVG.balloon(col)}</div>`);
        const bx = ckx + (i - 2) * cw * 0.42 + fx2R(-8, 8);
        b.animate([{ transform: fxT(bx, cky + cw * 0.2, 0, 0.3), opacity: 0 }, { transform: fxT(bx, cky - cw * 0.1, -6, 1), opacity: 1, offset: 0.12 },
            { transform: fxT(bx + 14, cky - cw * 0.9, 6, 1), offset: 0.5 }, { transform: fxT(bx - 10, cky - cw * 1.7, -6, 1), opacity: 1, offset: 0.85 }, { transform: fxT(bx, cky - cw * 2.1, 0, 1), opacity: 0 }],
            { duration: T, delay: 300 + i * 160, fill: 'both' });
    });
    const R = Math.max(c.board.offsetWidth, c.board.offsetHeight) * 0.55;
    const sys = fx2Canvas(c, R, 4);
    const smoke = FX2.cloud('csmk', '200,200,200');
    const fwCols = [['#ff1744', '#ff9100'], ['#ffc400', '#ff6d00'], ['#00b0ff', '#2962ff'], ['#00c853', '#64dd17'], ['#d500f9', '#651fff']];
    const flare = FX2.sprite('fwflare', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,200,.8)'], [1, 'rgba(255,200,120,0)']], 64);
    const launches = [0.28, 0.4, 0.52, 0.64, 0.76];
    let li = 0, smoked = false;
    const rockets = [];
    sys.run(T, (el) => {
        const t = el / T;
        if (!smoked && t > 0.25) { smoked = true; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) sys.add({ x: ckx + (-0.2 + i * 0.13) * cw + cw * 0.02, y: cky - cw * 0.45, vx: fx2R(-8, 8), vy: fx2R(-40, -25), turb: 30, life: fx2R(900, 1400), sprite: smoke, size: fx2R(6, 10), grow: 14, a0: 0.5 }); }
        if (li < launches.length && t > launches[li]) {
            const k = li++;
            const bcx = c.board.offsetWidth / 2 - c.pc.x, bcy = c.board.offsetHeight / 2 - c.pc.y;
            const tx = bcx * 0.75 + fx2R(-R * 0.45, R * 0.45), ty = bcy * 0.75 + fx2R(-R * 0.4, R * 0.05);
            rockets.push({ x: ckx + fx2R(-20, 20), y: cky - cw * 0.3, tx, ty, t0: el, k });
        }
        for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i]; const f = (el - r.t0) / 600;
            const px = r.x + (r.tx - r.x) * Math.min(1, f), py = r.y + (r.ty - r.y) * (1 - Math.pow(1 - Math.min(1, f), 2));
            sys.add({ x: px, y: py, vx: fx2R(-15, 15), vy: fx2R(10, 40), life: 380, size: 3, a0: 1, fi: 0.02, draw: (g, p) => { g.fillStyle = '#ffb300'; g.beginPath(); g.arc(p.x, p.y, p.size * (1 - p.age / p.life) + 0.8, 0, Math.PI * 2); g.fill(); } });
            if (f >= 1) {
                rockets.splice(i, 1);
                const [c1, c2] = fwCols[r.k % fwCols.length];
                sys.add({ x: px, y: py, life: 420, sprite: flare, size: 40, grow: 300, a0: 0.8, fi: 0.04 });
                const n = 110;
                for (let j = 0; j < n; j++) {
                    const a = j / n * Math.PI * 2 + fx2R(-0.05, 0.05), v = fx2R(200, 320) * (j % 2 ? 1 : 0.7);
                    sys.add({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 160, drag: 0.04, life: fx2R(1000, 1600), a0: 1, fi: 0.02, col: j % 3 ? c1 : c2, tw: Math.random() * 6,
                        draw: (g, p, tt) => { const tw = tt > 0.6 ? (Math.sin(p.age / 30 + p.tw) > 0 ? 1 : 0.3) : 1; g.globalAlpha *= tw; g.lineCap = 'round';
                            g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.stroke();
                            g.strokeStyle = p.col; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 1.8, 0, Math.PI * 2); g.fill(); } });
                }
                fx3Confetti(sys, px, py, 46, 300);
            }
        }
    });
    fxEnd(c, T + 2000);
}

// ============================================================
// 🚕 TAKSI #26 – geltonas taksi privažiuoja, mirksi žibintai, šviečia TAXI ženklas
// ============================================================
function fxTaxi3(fieldId) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 3600;
    const iw = fx3Inward(c);
    const vw = Math.max(100, c.L * 1.25);
    const tx = iw.x * c.L * 0.95, ty = iw.y * c.L * 0.95;
    const along = { x: 1, y: 0 };
    const far = c.L * 2.2;
    const car = fxEl(c, 'fx-obj fx3-taxi', `<div class="vx-img" style="width:${vw}px;transform:scaleX(-1)">${FX3_SVG.taxi}</div>`);
    car.animate([{ transform: fxT(tx - along.x * far, ty - along.y * far, 0, 1), opacity: 0 }, { transform: fxT(tx - along.x * far * 0.7, ty - along.y * far * 0.7, 0, 1), opacity: 1, offset: 0.1 },
        { transform: fxT(tx, ty, 0, 1), offset: 0.38, easing: 'cubic-bezier(.2,.7,.3,1)' }, { transform: fxT(tx + along.x * 3, ty + along.y * 3, 0, 1), offset: 0.42 }, { transform: fxT(tx, ty, 0, 1), offset: 0.46 },
        { transform: fxT(tx, ty, 0, 1), opacity: 1, offset: 0.86 }, { transform: fxT(tx, ty, 0, 0.9), opacity: 0 }], { duration: T, fill: 'forwards' });
    const sys = fx2Canvas(c, Math.max(c.L * 2.6, 260), 3);
    const head = FX2.sprite('txhead', [[0, 'rgba(255,255,220,1)'], [0.3, 'rgba(255,250,200,.6)'], [1, 'rgba(255,250,180,0)']], 64);
    const sign = FX2.sprite('txsign', [[0, 'rgba(255,240,120,.9)'], [1, 'rgba(255,220,0,0)']], 64);
    const smoke = FX2.cloud('txsmk', '130,130,130');
    sys.run(T, (el) => {
        const t = el / T;
        const m = new DOMMatrixReadOnly(getComputedStyle(car).transform);
        const op = parseFloat(getComputedStyle(car).opacity) || 0;
        if (op < 0.2) return;
        sys.add({ x: m.e, y: m.f - vw * 0.24, life: 40, sprite: sign, size: vw * 0.5, blend: 'lighter', a0: 0.6 * op, fi: 0.01 });
        const blink = t > 0.48 && t < 0.78 && Math.floor(el / 160) % 2 === 0;
        sys.add({ x: m.e + vw * 0.46, y: m.f + vw * 0.07, life: 40, sprite: head, size: vw * (blink ? 0.9 : 0.35), blend: 'lighter', a0: op, fi: 0.01 });
        if (t < 0.4 && Math.random() < 0.6) sys.add({ x: m.e - vw * 0.48, y: m.f + vw * 0.12, vx: -40, vy: -15, turb: 20, life: 700, sprite: smoke, size: 8, grow: 20, a0: 0.4 });
    });
    setTimeout(() => { if (typeof taxiBeep === 'function') { try { taxiBeep(); } catch (e) {} } }, T * 0.48);
    fxEnd(c, T + 300);
}

// ============================================================
// 🏁 STARTAS #0 – plevėsuojanti finišo vėliava, šviesos spinduliai, „+€200“, monetų fontanas
// ============================================================
function fxStart3(fieldId, bonus) {
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = 4400;
    const iw = fx3Inward(c);
    const R0 = c.L * 0.95;
    const cx = iw.x * R0, cy = iw.y * R0;
    const rays = fxEl(c, 'fx3-rays');
    const rs = c.L * 3;
    Object.assign(rays.style, { width: rs + 'px', height: rs + 'px', left: (cx - rs / 2) + 'px', top: (cy - rs / 2) + 'px' });
    rays.animate([{ transform: 'rotate(0deg) scale(.2)', opacity: 0 }, { transform: 'rotate(40deg) scale(1)', opacity: 1, offset: 0.15 }, { transform: 'rotate(160deg) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'rotate(200deg) scale(1.1)', opacity: 0 }], { duration: T, fill: 'forwards' });
    const fwid = c.L * 1.25, fh = fwid * 0.66;
    const flag = fxEl(c, 'fx-obj fx3-flag', `<div class="fx3-flag-in" style="width:${fwid}px;height:${fh}px">` + Array.from({ length: 12 }, (_, i) => `<i style="width:${fwid / 12 + 0.6}px;left:${i * fwid / 12}px;background-position:${-i * fwid / 12}px 0;background-size:${fh / 3}px ${fh / 3}px;animation-delay:${-i * 0.07}s"></i>`).join('') + `</div><b class="fx3-flagpole" style="height:${fh * 1.9}px"></b>`);
    flag.animate([{ transform: fxT(cx - fwid * 0.1, cy + fh * 0.6, -30, 0), opacity: 0 }, { transform: fxT(cx - fwid * 0.1, cy + fh * 0.45, 8, 1.1), opacity: 1, offset: 0.12, easing: 'ease-out' },
        { transform: fxT(cx - fwid * 0.1, cy + fh * 0.45, 0, 1), offset: 0.18 }, { transform: fxT(cx - fwid * 0.1, cy + fh * 0.45, 0, 1), opacity: 1, offset: 0.85 }, { transform: fxT(cx - fwid * 0.1, cy + fh * 0.45, 0, 0.7), opacity: 0 }], { duration: T, fill: 'forwards' });
    const amt = bonus || (window.START_BONUS || 200);
    const txt = fxEl(c, 'fx-obj fx3-bonus', `<span>+€${amt}</span>`);
    txt.style.setProperty('--fs', Math.max(26, c.L * 0.5) + 'px');
    txt.animate([{ transform: fxT(cx, cy + fh * 0.6, 0, 0.2), opacity: 0 }, { transform: fxT(cx, cy + fh * 0.55, 0, 0.2), opacity: 0, offset: 0.16 }, { transform: fxT(cx, cy + fh * 0.5, -4, 1.3), opacity: 1, offset: 0.26, easing: 'ease-out' },
        { transform: fxT(cx, cy + fh * 0.5, 0, 1), offset: 0.32 }, { transform: fxT(cx, cy + fh * 0.4, 0, 1), opacity: 1, offset: 0.85 }, { transform: fxT(cx, cy + fh * 0.2, 0, 0.9), opacity: 0 }], { duration: T, fill: 'forwards' });
    const sys = fx2Canvas(c, Math.max(c.L * 3, 320), 3);
    const sparkle = FX2.sprite('gold', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,236,150,.9)'], [1, 'rgba(255,190,0,0)']], 48);
    let burst = false;
    sys.run(T, (el) => {
        const t = el / T;
        if (!burst && t > 0.24) {
            burst = true;
            for (let i = 0; i < 34; i++) { const a = -Math.PI / 2 + fx2R(-1.1, 1.1), v = fx2R(180, 380); sys.add({ x: cx, y: cy + fh * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 700, life: fx2R(900, 1500), size: fx2R(5, 9), rot: Math.random() * 6, vr: fx2R(8, 16), a0: 1, fi: 0.02, draw: fx3Coin }); }
            fx3Confetti(sys, cx, cy, 40, 260, ['#111', '#fff', '#ffd23f', '#28a745']);
        }
        if (t > 0.2 && t < 0.85 && Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = fx2R(c.L * 0.3, c.L * 1.1); sys.add({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, life: fx2R(400, 800), sprite: sparkle, size: fx2R(6, 16), blend: 'lighter', a0: 1, fi: 0.4 }); }
    });
    fxEnd(c, T + 1200);
}

// ============================================================
// ⛓️ KALĖJIMAS #16 – grotos užsitrenkia, spyna užsirakina, prožektoriai šviečia
// mode: 'in' (įkalintas), 'visit' (užsuko), 'out' (išėjo)
// ============================================================
function fxJail3(fieldId, mode) {
    fieldId = fieldId || 16;
    mode = mode || 'visit';
    const c = fxPrep(fieldId, false);
    if (!c) return;
    const T = mode === 'out' ? 3000 : 3800;
    const w = c.w * 1.04, h = c.h * 1.04;
    const bars = fxEl(c, 'fx3-bars ' + mode, Array.from({ length: 6 }, () => '<i></i>').join('') + '<b></b>');
    Object.assign(bars.style, { width: w + 'px', height: h + 'px', left: (-w / 2) + 'px', top: (-h / 2) + 'px' });
    const down = [{ transform: 'translateY(-105%)', opacity: 1 }, { transform: 'translateY(0)', opacity: 1, offset: 0.16, easing: 'cubic-bezier(.6,0,1,1)' }, { transform: 'translateY(-4%)', offset: 0.2 }, { transform: 'translateY(0)', offset: 0.24 }];
    if (mode === 'out') bars.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(0)', offset: 0.3 }, { transform: 'translateY(-105%)', opacity: 1, offset: 0.62, easing: 'ease-in' }, { transform: 'translateY(-105%)', opacity: 0 }], { duration: T, fill: 'forwards' });
    else bars.animate([...down, { transform: 'translateY(0)', opacity: 1, offset: mode === 'visit' ? 0.62 : 0.86 }, mode === 'visit' ? { transform: 'translateY(-105%)', opacity: 1, offset: 0.85 } : { transform: 'translateY(0)', opacity: 0, offset: 0.98 }, { transform: mode === 'visit' ? 'translateY(-105%)' : 'translateY(0)', opacity: 0 }], { duration: T, fill: 'forwards' });
    const ls = Math.max(40, c.s * 0.55);
    const lock = fxEl(c, 'fx-obj fx3-lock', `<div class="vx-img" style="width:${ls}px">${FX3_SVG.lock}</div>`);
    const lx = 0, ly = c.h * 0.18;
    lock.animate([{ transform: fxT(lx, ly + 20, 0, 0), opacity: 0 }, { transform: fxT(lx, ly + 20, 0, 0), opacity: 0, offset: mode === 'out' ? 0 : 0.2 }, { transform: fxT(lx, ly, -10, 1.15), opacity: 1, offset: mode === 'out' ? 0.08 : 0.28 },
        { transform: fxT(lx, ly, 0, 1), offset: mode === 'out' ? 0.14 : 0.34 }, { transform: fxT(lx, ly, 0, 1), opacity: 1, offset: 0.8 }, { transform: fxT(lx, ly - 10, 0, 0.8), opacity: 0 }], { duration: T, fill: 'forwards' });
    const sh = lock.querySelector('.fx3-shackle');
    if (sh) {
        const open = 'translateY(-12px)', closed = 'translateY(0)';
        const a = mode === 'out' ? [closed, open] : [open, closed];
        const o = mode === 'out' ? 0.28 : 0.4;
        sh.animate([{ transform: a[0] }, { transform: a[0], offset: o }, { transform: a[1], offset: o + 0.05 }, { transform: a[1] }], { duration: T, fill: 'forwards' });
    }
    const sys = fx2Canvas(c, Math.max(c.L * 2.4, 260), 4);
    const dust = FX2.cloud('jdust', '170,170,170');
    const sparkle = FX2.sprite('jsp', [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,236,150,.9)'], [1, 'rgba(255,190,0,0)']], 48);
    let hit = false, clk = false;
    sys.run(T, (el) => {
        const t = el / T;
        if (mode !== 'out' && !hit && t > 0.16) {
            hit = true; fx2Shake(c.cell, 4, 300);
            for (let i = 0; i < 16; i++) sys.add({ x: fx2R(-w / 2, w / 2), y: h / 2, vx: fx2R(-50, 50), vy: fx2R(-40, -5), turb: 30, life: fx2R(600, 1000), sprite: dust, size: fx2R(14, 24), grow: 30, a0: 0.55 });
            for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + fx2R(-1.4, 1.4), v = fx2R(100, 240); sys.add({ x: fx2R(-w / 2, w / 2), y: h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 600, life: fx2R(300, 600), line: true, color: '#fff3c4', lw: 1.4, trail: 0.04, blend: 'lighter', a0: 1, fi: 0.02 }); }
        }
        const lt = mode === 'out' ? 0.3 : 0.42;
        if (!clk && t > lt) { clk = true; for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2; sys.add({ x: lx + Math.cos(a) * ls * 0.6, y: ly + Math.sin(a) * ls * 0.6, life: fx2R(400, 700), sprite: sparkle, size: fx2R(8, 16), blend: 'lighter', a0: 1, fi: 0.3 }); } }
        if (mode === 'in' && t > 0.25 && t < 0.85) {
            const iw = fx3Inward(c); const a = Math.atan2(iw.y, iw.x) + Math.sin(el / 450) * 0.6;
            sys.add({ x: 0, y: 0, life: 40, a0: 0.5, fi: 0.01, blend: 'lighter', draw: (g) => {
                const L = c.L * 2.2; const gr = g.createRadialGradient(0, 0, 0, 0, 0, L);
                gr.addColorStop(0, 'rgba(255,255,230,.55)'); gr.addColorStop(1, 'rgba(255,255,230,0)');
                g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, a - 0.75, a - 0.4); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, a + 0.4, a + 0.75); g.closePath(); g.fill();
            } });
        }
    });
    fxEnd(c, T + 300);
}

// ============================================================
// 💬 PATARIMAI UŽVEDUS PELĘ (data-tip="raktas" arba title="tekstas")
// Telefone – ilgai palaikius pirštą. Tekstas imamas pasirinkta kalba rodymo metu.
// ============================================================
const tipUi = { el: null, target: null, timer: null, hideTimer: null, longPress: false, touchTimer: null };
function tipText(el) {
    if (el.dataset.tip) {
        const v = (typeof t === 'function') ? t(el.dataset.tip) : '';
        if (v && v !== el.dataset.tip) return v;
    }
    if (el.hasAttribute('title')) {           // vietinius title paverčiam gražiais patarimais
        const tt0 = el.getAttribute('title');
        if (tt0) el.dataset.tipText = tt0;
        el.removeAttribute('title');
    }
    return el.dataset.tipText || '';
}
function tipShow(el) {
    const text = tipText(el);
    if (!text) return;
    if (!tipUi.el) {
        tipUi.el = document.createElement('div');
        tipUi.el.id = 'uiTip';
        tipUi.el.setAttribute('role', 'tooltip');
        document.body.appendChild(tipUi.el);
    }
    const tip = tipUi.el;
    tip.textContent = text;
    tip.className = '';
    tip.style.left = '0px'; tip.style.top = '0px';
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 10;
    const inLeft = !!el.closest('#leftPanel');
    let side = inLeft ? 'right' : (r.top > tr.height + 24 ? 'top' : 'bottom');
    let x, y;
    const place = () => {
        if (side === 'right') { x = r.right + gap; y = r.top + r.height / 2 - tr.height / 2; }
        else if (side === 'top') { x = r.left + r.width / 2 - tr.width / 2; y = r.top - tr.height - gap; }
        else { x = r.left + r.width / 2 - tr.width / 2; y = r.bottom + gap; }
    };
    place();
    if (side === 'right' && x + tr.width > vw - 6) { side = 'bottom'; place(); }
    if (side === 'bottom' && y + tr.height > vh - 6) { side = 'top'; place(); }
    const cx = Math.max(6, Math.min(vw - tr.width - 6, x));
    const cy = Math.max(6, Math.min(vh - tr.height - 6, y));
    tip.style.left = cx + 'px'; tip.style.top = cy + 'px';
    tip.classList.add('side-' + side);
    // rodyklė rodo į elemento centrą net jei patarimas pastumtas nuo krašto
    if (side === 'right') tip.style.setProperty('--ay', Math.max(10, Math.min(tr.height - 10, r.top + r.height / 2 - cy)) + 'px');
    else tip.style.setProperty('--ax', Math.max(12, Math.min(tr.width - 12, r.left + r.width / 2 - cx)) + 'px');
    tipUi.target = el;
}
function tipHide() {
    clearTimeout(tipUi.timer);
    if (tipUi.el) tipUi.el.classList.remove('show');
    tipUi.target = null;
}
function tipFind(node) {
    if (!node || !node.closest) return null;
    const el = node.closest('[data-tip],[title],[data-tip-text]');
    if (!el || !el.closest('#page-game, #uiTourBubble')) return null;
    if (el.closest('.modal, [id$="Modal"]')) return null;     // modaluose nerodom
    return el;
}
document.addEventListener('mouseover', (e) => {
    const el = tipFind(e.target);
    if (el === tipUi.target) return;
    tipHide();
    if (!el) return;
    tipText(el);                              // nuimam title iškart, kad nerodytų naršyklės patarimo
    tipUi.timer = setTimeout(() => tipShow(el), 380);
});
document.addEventListener('mouseout', (e) => {
    const el = tipFind(e.target);
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) tipHide();
});
document.addEventListener('mousedown', tipHide, true);
document.addEventListener('scroll', tipHide, true);
window.addEventListener('resize', tipHide);
// 📱 Ilgas paspaudimas = patarimas (paspaudimas tada nesuveikia)
document.addEventListener('touchstart', (e) => {
    const el = tipFind(e.target);
    clearTimeout(tipUi.touchTimer);
    tipUi.longPress = false;
    if (!el) return;
    tipUi.touchTimer = setTimeout(() => {
        tipUi.longPress = true;
        tipShow(el);
        clearTimeout(tipUi.hideTimer);
        tipUi.hideTimer = setTimeout(tipHide, 3500);
    }, 520);
}, { passive: true });
document.addEventListener('touchmove', () => clearTimeout(tipUi.touchTimer), { passive: true });
document.addEventListener('touchend', (e) => {
    clearTimeout(tipUi.touchTimer);
    if (tipUi.longPress) { e.preventDefault(); tipUi.longPress = false; }
}, { passive: false });
document.addEventListener('contextmenu', (e) => { if (tipUi.longPress) e.preventDefault(); });

// ============================================================
// ⚙️ Kairės panelės nustatymų grupė (išskleidžiama, būsena įsimenama)
// ============================================================
function setLpSettings(open) {
    const box = document.getElementById('lpSettings');
    const btn = document.getElementById('lpSettingsToggle');
    if (!box) return;
    box.classList.toggle('open', !!open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { localStorage.setItem('bancrupt_lpSettings', open ? '1' : '0'); } catch (e) {}
}
function toggleLpSettings() {
    const box = document.getElementById('lpSettings');
    setLpSettings(!(box && box.classList.contains('open')));
    if (typeof playClickSound === 'function') playClickSound();
}
(function initLpSettings() {
    const go = () => {
        let v = null;
        try { v = localStorage.getItem('bancrupt_lpSettings'); } catch (e) {}
        setLpSettings(v === '1');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

// ============================================================
// 🧭 PIRMO ŽAIDIMO GIDAS – keli burbulai paeiliui; vėl atidaromas „❓“ mygtuku
// ============================================================
const TOUR_KEY = 'bancrupt_tourDone';
const TOUR_STEPS = [
    { sel: '#rollBtn', key: 'tour.roll' },
    { sel: '#center-1', key: 'tour.me' },
    { sel: '#tradeBtn', key: 'tour.trade' },
    { sel: '#infoBtn', key: 'tour.info' },
    { sel: '#lpSettingsToggle', key: 'tour.settings', openPanel: true },
    { sel: '#helpTourBtn', key: 'tour.help' }
];
const tourUi = { i: 0, steps: [], active: false, autoTried: false };
function tourVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
}
function startTour(manual) {
    if (tourUi.active) return;
    const page = document.getElementById('page-game');
    if (!page || page.style.display === 'none') return;
    tourUi.steps = TOUR_STEPS.slice();
    tourUi.i = 0;
    tourUi.active = true;
    tipHide();
    if (!document.getElementById('uiTourBubble')) {
        const hole = document.createElement('div'); hole.id = 'uiTourHole';
        const b = document.createElement('div'); b.id = 'uiTourBubble';
        b.innerHTML = '<div class="tour-step"></div><div class="tour-text"></div>' +
            '<div class="tour-btns"><button type="button" class="tour-skip"></button><button type="button" class="tour-next"></button></div>';
        document.body.appendChild(hole); document.body.appendChild(b);
        b.querySelector('.tour-skip').onclick = () => endTour();
        b.querySelector('.tour-next').onclick = () => { tourUi.i++; tourShowStep(); };
        window.addEventListener('resize', () => { if (tourUi.active) tourShowStep(); });
    }
    if (manual && typeof playClickSound === 'function') playClickSound();
    tourShowStep();
}
function tourShowStep() {
    const hole = document.getElementById('uiTourHole'), b = document.getElementById('uiTourBubble');
    // praleidžiam žingsnius, kurių elementas nematomas (pvz., telefone paslėpta panelė)
    while (tourUi.i < tourUi.steps.length) {
        const st = tourUi.steps[tourUi.i];
        let el = document.querySelector(st.sel);
        if (!tourVisible(el) && document.body.classList.contains('cmp') && el && el.closest('#leftPanel')) {
            document.body.classList.add('lp-open'); tourUi.openedPanel = true;
            const tg = document.getElementById('leftPanelToggle'); if (tg) tg.innerHTML = '◀';
        }
        if (tourVisible(el)) break;
        tourUi.i++;
    }
    if (tourUi.i >= tourUi.steps.length) { endTour(); return; }
    const visibleSteps = tourUi.steps.filter(s => tourVisible(document.querySelector(s.sel)) || (document.body.classList.contains('cmp') && document.querySelector(s.sel) && document.querySelector(s.sel).closest('#leftPanel')));
    const st = tourUi.steps[tourUi.i];
    const el = document.querySelector(st.sel);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    hole.classList.add('show');
    const last = tourUi.i === tourUi.steps.length - 1;
    const num = Math.min(visibleSteps.length, visibleSteps.indexOf(st) + 1) || (tourUi.i + 1);
    b.querySelector('.tour-step').textContent = num + ' / ' + (visibleSteps.length || tourUi.steps.length);
    b.querySelector('.tour-text').textContent = t(st.key);
    b.querySelector('.tour-skip').textContent = t('tour.skip');
    b.querySelector('.tour-skip').style.visibility = last ? 'hidden' : 'visible';
    b.querySelector('.tour-next').textContent = last ? t('tour.done') : t('tour.next');
    b.className = 'show';
    b.style.left = '0px'; b.style.top = '0px';
    const br = b.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, gap = 14;
    let side, x, y;
    if (r.right + gap + br.width < vw - 8 && el.closest('#leftPanel')) { side = 'right'; x = r.right + gap; y = r.top + r.height / 2 - br.height / 2; }
    else if (r.bottom + gap + br.height < vh - 8) { side = 'bottom'; x = r.left + r.width / 2 - br.width / 2; y = r.bottom + gap; }
    else { side = 'top'; x = r.left + r.width / 2 - br.width / 2; y = r.top - br.height - gap; }
    const cx = Math.max(8, Math.min(vw - br.width - 8, x)), cy = Math.max(8, Math.min(vh - br.height - 8, y));
    b.style.left = cx + 'px'; b.style.top = cy + 'px';
    b.classList.add('side-' + side);
    if (side === 'right') b.style.setProperty('--ay', Math.max(14, Math.min(br.height - 14, r.top + r.height / 2 - cy)) + 'px');
    else b.style.setProperty('--ax', Math.max(16, Math.min(br.width - 16, r.left + r.width / 2 - cx)) + 'px');
    b.querySelector('.tour-next').focus({ preventScroll: true });
}
function endTour() {
    tourUi.active = false;
    const hole = document.getElementById('uiTourHole'), b = document.getElementById('uiTourBubble');
    if (hole) hole.classList.remove('show');
    if (b) b.className = '';
    if (tourUi.openedPanel) { tourUi.openedPanel = false; document.body.classList.remove('lp-open'); const tg = document.getElementById('leftPanelToggle'); if (tg) tg.innerHTML = '▶'; }
    try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {}
}
document.addEventListener('keydown', (e) => { if (tourUi.active && e.key === 'Escape') endTour(); });
// Automatiškai – vieną kartą, kai pirmą kartą prasideda žaidimas
function maybeAutoTour(state) {
    if (tourUi.autoTried || !state || !state.gameStarted) return;
    tourUi.autoTried = true;
    let done = null;
    try { done = localStorage.getItem(TOUR_KEY); } catch (e) {}
    if (done === '1') return;
    setTimeout(() => { if (!tourUi.active) startTour(false); }, 1800);
}


// ============================================================
// 📊 GOOGLE ANALYTICS (GA4) + 🍪 SLAPUKŲ SUTIKIMAS (BDAR)
// Be sutikimo – Consent Mode (be slapukų, anoniminiai signalai); paspaudus „Sutinku“ – pilna statistika.
// Tik tikrame domene (ne peržiūroje).
// ============================================================
const GA_ID = 'G-BJJQVWVSC0';
const GA_CONSENT_KEY = 'bancrupt_consent';
const gaUi = { loaded: false };
function gaConsent() { try { return localStorage.getItem(GA_CONSENT_KEY); } catch (e) { return null; } }
function gaAllowedHost() {
    const h = (location.hostname || '').toLowerCase();
    return /(^|\.)bankrotuoju\.lt$/.test(h) || /(^|\.)bankro\.lt$/.test(h);
}
function gaLoad(granted) {
    if (!gaAllowedHost()) return;
    if (gaUi.loaded) {
        if (granted) window.gtag('consent', 'update', { analytics_storage: 'granted' });
        return;
    }
    gaUi.loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // 🛡️ Google „Consent Mode“: be sutikimo – jokių slapukų, tik anoniminiai signalai,
    // iš kurių Google apskaičiuoja apytikrį visų lankytojų skaičių. Reklama visada išjungta.
    window.gtag('consent', 'default', {
        analytics_storage: granted ? 'granted' : 'denied',
        ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    let lang = 'lt';
    try { lang = localStorage.getItem('bancrupt_lang') || 'lt'; } catch (e) {}
    let token = null;
    try { token = localStorage.getItem('bancrupt_token'); } catch (e) {}
    window.gtag('set', 'user_properties', { game_lang: lang, user_type: token ? 'registered' : 'guest' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
}
// Įvykis (siunčiamas tik jei sutikta ir GA įkeltas)
function gaEvent(name, params) {
    try { if (gaUi.loaded && typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {}
}
function gaSetConsent(yes) {
    try { localStorage.setItem(GA_CONSENT_KEY, yes ? 'yes' : 'no'); } catch (e) {}
    const b = document.getElementById('cookieBanner');
    if (b) b.classList.remove('show');
    if (yes) gaLoad(true);
    else if (gaUi.loaded) {
        try { window.gtag('consent', 'update', { analytics_storage: 'denied' }); } catch (e) {}
        // atšaukus sutikimą – išjungiam rinkimą ir ištrinam GA slapukus
        document.cookie.split(';').forEach(c => {
            const n = c.split('=')[0].trim();
            if (/^_ga/.test(n)) {
                const host = location.hostname, base = host.split('.').slice(-2).join('.');
                [host, '.' + base, ''].forEach(d => { document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : ''); });
            }
        });
    }
}
function showCookieBanner() {
    let b = document.getElementById('cookieBanner');
    if (!b) {
        b = document.createElement('div');
        b.id = 'cookieBanner';
        b.setAttribute('role', 'dialog');
        b.innerHTML = '<div class="cb-text"></div><div class="cb-btns"><button type="button" class="cb-no"></button><button type="button" class="cb-yes"></button></div>';
        document.body.appendChild(b);
        b.querySelector('.cb-yes').onclick = () => gaSetConsent(true);
        b.querySelector('.cb-no').onclick = () => gaSetConsent(false);
    }
    b.querySelector('.cb-text').textContent = tt('cookie.text', '🍪 Naudojame „Google Analytics“ slapukus, kad matytume, kiek žmonių žaidžia ir kaip pagerinti žaidimą. Jokių reklamų.');
    b.querySelector('.cb-yes').textContent = tt('cookie.yes', 'Sutinku');
    b.querySelector('.cb-no').textContent = tt('cookie.no', 'Nesutinku');
    b.classList.add('show');
}
(function initConsent() {
    const go = () => {
        const c = gaConsent();
        gaLoad(c === 'yes');                   // visada įkeliam (be sutikimo – be slapukų)
        if (c !== 'yes' && c !== 'no') setTimeout(showCookieBanner, 1200);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

// 🚕 TAKSI: langelio pasirinkimas lentoje
const taxiUi = { open: false, target: null, cost: 100, forbidden: [16, 26, 42], timer: null, deadline: 0 };
function openTaxiPicker(cost, durationMs, forbidden) {
    if (typeof cell5DismissMyTurn === 'function') cell5DismissMyTurn();   // „Tavo eilė – mesk“ čia netinka
    taxiUi.cost = cost || 100;
    taxiUi.forbidden = Array.isArray(forbidden) ? forbidden : [16, 26, 42];
    taxiUi.target = null;
    taxiUi.deadline = Date.now() + (durationMs || 30000);
    let panel = document.getElementById('taxiPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'taxiPanel';
        panel.innerHTML = `
            <div class="tx-car">🚕</div>
            <div class="tx-body">
                <div class="tx-title"></div>
                <div class="tx-text"></div>
                <div class="tx-extra"></div>
                <div class="tx-num">
                    <label class="tx-num-lbl"></label>
                    <input type="number" class="tx-num-input" min="0" max="51" inputmode="numeric">
                </div>
                <div class="tx-btns">
                    <button type="button" class="tx-go"></button>
                    <button type="button" class="tx-stay"></button>
                    <span class="tx-left"></span>
                </div>
            </div>`;
        document.body.appendChild(panel);
        panel.querySelector('.tx-go').onclick = () => {
            if (taxiUi.target === null) return;
            panel.querySelectorAll('button').forEach(b => b.disabled = true);
            playClickSound();
            socket.emit('taxiRide', { target: taxiUi.target });
        };
        const numInput = panel.querySelector('.tx-num-input');
        const pickByNumber = () => {
            const v = parseInt(numInput.value, 10);
            if (!Number.isInteger(v)) return;
            if (v < 0 || v > 51 || taxiUi.forbidden.includes(v)) {
                numInput.classList.add('bad');
                if (typeof playErrorSound === 'function') playErrorSound();
                return;
            }
            numInput.classList.remove('bad');
            selectTaxiTarget(v);
        };
        numInput.addEventListener('input', pickByNumber);
        numInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { pickByNumber(); if (taxiUi.target !== null) panel.querySelector('.tx-go').click(); }
        });
        panel.querySelector('.tx-stay').onclick = () => {
            panel.querySelectorAll('button').forEach(b => b.disabled = true);
            playClickSound();
            socket.emit('taxiDecline');
        };
    }
    panel.querySelectorAll('button').forEach(b => b.disabled = false);
    panel.querySelector('.tx-title').textContent = tt('taxi.title', '🚕 TAKSI') + ' – €' + taxiUi.cost;
    panel.querySelector('.tx-stay').textContent = tt('taxi.stay', 'Likti čia');
    panel.querySelector('.tx-go').textContent = tt('taxi.go', '🚕 Važiuoti');
    panel.querySelector('.tx-num-lbl').textContent = tt('taxi.orNumber', 'arba įvesk langelio numerį:');
    const ni = panel.querySelector('.tx-num-input');
    ni.value = ''; ni.classList.remove('bad');
    renderTaxiChoice();
    panel.style.display = 'flex';
    document.body.classList.add('taxi-pick');
    document.querySelectorAll('#board .cell').forEach(c => {
        const id = parseInt(c.dataset.id, 10);
        c.classList.toggle('taxi-target', !taxiUi.forbidden.includes(id));
        c.classList.toggle('taxi-forbidden', taxiUi.forbidden.includes(id));
        c.classList.remove('taxi-selected');
    });
    taxiUi.open = true;
    clearInterval(taxiUi.timer);
    const tick = () => {
        const left = Math.max(0, Math.ceil((taxiUi.deadline - Date.now()) / 1000));
        const el = panel.querySelector('.tx-left');
        if (el) el.textContent = '⏱️ ' + tt('taxi.left', 'Liko {s} s').replace('{s}', left);
        if (left <= 0) clearInterval(taxiUi.timer);
    };
    tick();
    taxiUi.timer = setInterval(tick, 500);
    if (typeof playNotificationSound === 'function') playNotificationSound();
}
function renderTaxiChoice() {
    const panel = document.getElementById('taxiPanel');
    if (!panel) return;
    const text = panel.querySelector('.tx-text');
    const extra = panel.querySelector('.tx-extra');
    const go = panel.querySelector('.tx-go');
    if (taxiUi.target === null) {
        text.textContent = tt('taxi.pick', 'Paspausk šviečiantį langelį lentoje – ten ir nuvažiuosi (tik pirmyn)');
        extra.textContent = '';
        go.disabled = true;
        return;
    }
    const f = gameState && gameState.board ? gameState.board[taxiUi.target] : null;
    const nameKey = `cell.${taxiUi.target}.name`;
    const tr = t(nameKey);
    const name = (tr && tr !== nameKey) ? tr : (f ? f.name : taxiUi.target);
    text.textContent = tt('taxi.to', 'Važiuoti į {field} už €{cost}?').replace('{field}', name).replace('{cost}', taxiUi.cost);
    const from = myPlayer ? myPlayer.position : 26;
    if (taxiUi.target === 0) extra.textContent = '🏁 ' + tt('taxi.landStart', 'Sustosi ant START: +€300');
    else if (taxiUi.target < from) extra.textContent = '🏁 ' + tt('taxi.passStart', 'Pravažiuosi START: +€200');
    else extra.textContent = '';
    go.disabled = false;
}
function closeTaxiPicker() {
    taxiUi.open = false;
    taxiUi.target = null;
    clearInterval(taxiUi.timer);
    const panel = document.getElementById('taxiPanel');
    if (panel) panel.style.display = 'none';
    document.body.classList.remove('taxi-pick');
    document.querySelectorAll('#board .cell.taxi-target, #board .cell.taxi-forbidden, #board .cell.taxi-selected')
        .forEach(c => c.classList.remove('taxi-target', 'taxi-forbidden', 'taxi-selected'));
}
// Paspaudimas ant langelio taksi pasirinkimo metu
document.addEventListener('click', (e) => {
    if (!taxiUi.open) return;
    const cell = e.target.closest && e.target.closest('#board .cell');
    if (!cell) return;
    e.stopPropagation();
    e.preventDefault();
    const id = parseInt(cell.dataset.id, 10);
    if (taxiUi.forbidden.includes(id)) { if (typeof playErrorSound === 'function') playErrorSound(); return; }
    selectTaxiTarget(id);
    const ni = document.querySelector('#taxiPanel .tx-num-input');
    if (ni) { ni.value = id; ni.classList.remove('bad'); }
    playClickSound();
}, true);

function selectTaxiTarget(id) {
    taxiUi.target = id;
    document.querySelectorAll('#board .cell.taxi-selected').forEach(c => c.classList.remove('taxi-selected'));
    const cell = document.getElementById(`cell-${id}`);
    if (cell) cell.classList.add('taxi-selected');
    if (typeof hideCellInfo === 'function') hideCellInfo();
    renderTaxiChoice();
}

// 🎥 KAMERA: judant figūrėlei – priartėja ir seka ją, sustojus – nutolsta
const CAMERA_KEY = 'bancrupt_camera';
// Režimai: 'all' – sekti visus, 'mine' – tik mano ėjimą (numatyta), 'off' – nesekti
function getCameraMode() {
    let v = null;
    try { v = localStorage.getItem(CAMERA_KEY); } catch (e) {}
    return (v === 'all' || v === 'off') ? v : 'mine';
}
function cameraEnabled() { return getCameraMode() !== 'off'; }
function setCameraMode(mode) {
    try { localStorage.setItem(CAMERA_KEY, mode); } catch (e) {}
    if (typeof playClickSound === 'function') playClickSound();
    if (mode === 'off') cameraEnd();
    renderCameraButton();
}
const CAMERA_MODES = {
    all:  ['🎥', 'camera.all',  'Sekti visų ėjimus'],
    mine: ['👤', 'camera.mine', 'Sekti tik mano ėjimą'],
    off:  ['🚫', 'camera.off',  'Nesekti ėjimų']
};
function renderCameraButton() {
    const header = document.getElementById('gameHeader');
    if (!header) return;
    let wrap = document.getElementById('cameraSwitch');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.id = 'cameraSwitch';
        wrap.innerHTML = '<button type="button" class="cam-btn"></button><div class="cam-menu"></div>';
        const slot = document.getElementById('lpCamSlot');   // ⚙️ Nustatymuose (kairėje panelėje)
        if (slot) slot.appendChild(wrap);
        else {
            const anchor = document.getElementById('boardViewSwitch');
            if (anchor && anchor.nextSibling) header.insertBefore(wrap, anchor.nextSibling);
            else header.appendChild(wrap);
        }
        const btn = wrap.querySelector('.cam-btn');
        btn.onclick = (e) => { e.stopPropagation(); wrap.classList.toggle('open'); playClickSound(); };
        document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });
    }
    const mode = getCameraMode();
    const [icon, key, fb] = CAMERA_MODES[mode];
    const shortKey = { all: ['camera.shortAll', 'Visi'], mine: ['camera.shortMine', 'Mano'], off: ['camera.shortOff', 'Išj.'] }[mode];
    const btn = wrap.querySelector('.cam-btn');
    btn.innerHTML = '';
    btn.append(document.createTextNode(icon + ' '));
    const lbl = document.createElement('span');
    lbl.className = 'cam-lbl';
    lbl.textContent = tt('camera.label', 'Kamera') + ': ' + tt(shortKey[0], shortKey[1]);
    btn.appendChild(lbl);
    btn.title = tt(key, fb);
    const menu = wrap.querySelector('.cam-menu');
    menu.innerHTML = '';
    Object.keys(CAMERA_MODES).forEach(m => {
        const [ic, k, f] = CAMERA_MODES[m];
        const it = document.createElement('button');
        it.type = 'button';
        it.className = 'cam-item' + (m === mode ? ' active' : '');
        it.textContent = ic + ' ' + tt(k, f);
        it.onclick = (e) => { e.stopPropagation(); wrap.classList.remove('open'); setCameraMode(m); };
        menu.appendChild(it);
    });
}
function getBoardCam() {
    const board = document.getElementById('board');
    if (!board) return null;
    let cam = document.getElementById('boardCam');
    if (!cam) {
        // Išorinis apvalkalas kerpa vaizdą, vidinis – priartėja / pasislenka
        const clip = document.createElement('div');
        clip.id = 'boardCamClip';
        cam = document.createElement('div');
        cam.id = 'boardCam';
        board.parentNode.insertBefore(clip, board);
        clip.appendChild(cam);
        cam.appendChild(board);
    }
    return cam;
}
const camState = { on: false, base: null, k: 1, tx: 0, ty: 0 };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', getBoardCam);
else getBoardCam();

function cameraCanRun(forPlayerId) {
    const mode = getCameraMode();
    if (mode === 'off') return false;
    if (mode === 'mine' && forPlayerId !== undefined && forPlayerId != playerId) return false;
    if (document.body.classList.contains('force-rot')) return false;   // pasuktame telefono vaizde – be kameros
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
}
function cameraApply(ms) {
    const cam = getBoardCam();
    if (!cam) return;
    cam.style.transition = `transform ${ms}ms cubic-bezier(0.25, 0.8, 0.3, 1)`;
    cam.style.transform = `translate(${camState.tx.toFixed(1)}px, ${camState.ty.toFixed(1)}px) scale(${camState.k.toFixed(3)})`;
}
function cameraFollow(el, ms) {
    if (!camState.on || !el) return;
    const cam = getBoardCam();
    const b = camState.base;
    const r = el.getBoundingClientRect();
    // Taško vieta „nepriartintoje“ kameroje
    const vx = r.left + r.width / 2, vy = r.top + r.height / 2;
    const lx = (vx - b.left - camState.curTx) / camState.curK;
    const ly = (vy - b.top - camState.curTy) / camState.curK;
    let tx = b.width / 2 - camState.k * lx;
    let ty = b.height / 2 - camState.k * ly;
    // Neišvažiuoti už lentos kraštų
    tx = Math.min(0, Math.max(b.width - b.width * camState.k, tx));
    ty = Math.min(0, Math.max(b.height - b.height * camState.k, ty));
    camState.tx = tx; camState.ty = ty;
    camState.curTx = tx; camState.curTy = ty; camState.curK = camState.k;
    cameraApply(ms);
}
function cameraStart(cellEl, forPlayerId) {
    if (!cameraCanRun(forPlayerId) || !cellEl) return false;
    const cam = getBoardCam();
    if (!cam) return false;
    cam.style.transition = 'none';
    cam.style.transform = 'none';
    const b = cam.getBoundingClientRect();
    if (b.width < 50 || b.height < 50) return false;
    const cr = cellEl.getBoundingClientRect();
    const cellSize = Math.max(20, Math.min(cr.width, cr.height));
    camState.base = { left: b.left, top: b.top, width: b.width, height: b.height };
    camState.k = Math.max(1.5, Math.min(2.3, (Math.min(b.width, b.height) * 0.3) / cellSize));
    camState.curK = 1; camState.curTx = 0; camState.curTy = 0;
    camState.on = true;
    cam.classList.add('cam-active');
    cameraFollow(cellEl, 650);   // priartėjimas
    return true;
}
function cameraEnd() {
    if (!camState.on) return;
    camState.on = false;
    camState.k = 1; camState.tx = 0; camState.ty = 0;
    cameraApply(700);              // nutolimas
    const cam = document.getElementById('boardCam');
    setTimeout(() => { if (!camState.on && cam) { cam.style.transform = ''; cam.style.transition = ''; cam.classList.remove('cam-active'); } }, 720);
}

// 🚶 Figūrėlė eina per langelius kartu su švytėjimu ir niekada nedingsta
function makeWalker(playerId, taxi) {
    const p = gameState && gameState.players ? gameState.players.find(x => x.id == playerId) : null;
    if (taxi) {
        // 🚕 Figūrėlė „įsėda“ į taksi: važiuoja automobilis su žaidėjo spalvos ženklu ant stogo
        const car = document.createElement('span');
        car.className = 'taxi-car';
        car.innerHTML = '<span class="taxi-car-body">' + FX3_SVG.taxi + '</span><span class="taxi-car-roof"></span>';
        car.querySelector('.taxi-car-roof').style.background = safeColor(p ? p.color : '#888');
        const holder = document.createElement('div');
        holder.className = 'walker-holder is-taxi';
        holder.appendChild(car);
        return holder;
    }
    const dot = document.createElement('span');
    dot.className = 'player-dot walker-dot has-piece';
    dot.style.background = safeColor(p ? p.color : '#888');
    dot.innerHTML = pieceSolid((p && p.piece) || 'pawn', p ? p.color : '#888');
    if (p && p.emoji) {
        const e = document.createElement('span');
        e.className = 'player-emoji';
        e.textContent = p.emoji;
        dot.appendChild(e);
    }
    const holder = document.createElement('div');
    holder.className = 'walker-holder';
    holder.appendChild(dot);
    return holder;
}

// Langelio centro vieta lentos viduje (nepriklauso nuo 3D pasukimo / kameros)
function cellCenterInBoard(cell) {
    const board = document.getElementById('board');
    let x = cell.offsetWidth / 2, y = cell.offsetHeight / 2, el = cell;
    while (el && el !== board) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y };
}
function taxiDirection(pos) {
    if (pos < 16) return 'right';
    if (pos < 26) return 'down';
    if (pos < 42) return 'left';
    return 'up';
}

function placeWalker(holder, pos, hopMs) {
    const cell = document.getElementById(`cell-${pos}`);
    if (!cell || !holder) return;
    const isCar = holder.classList.contains('is-taxi');
    const prevCell = holder.parentNode;
    const from = (isCar && hopMs && prevCell && prevCell !== cell && prevCell.classList && prevCell.classList.contains('cell'))
        ? cellCenterInBoard(prevCell) : null;
    if (holder.parentNode !== cell) {
        // Langelis su figūrėle iškeliamas virš kaimynų (kad važiuojantis taksi nepalįstų po kitais)
        if (prevCell && prevCell.classList) prevCell.classList.remove('has-walker');
        cell.appendChild(holder);
    }
    cell.classList.add('has-walker');
    const dot = holder.firstChild;
    const size = Math.max(isCar ? 16 : 14, Math.min(isCar ? 48 : 76, Math.min(cell.clientWidth, cell.clientHeight) * (isCar ? 0.75 : 0.92)));
    if (isCar) {
        dot.style.fontSize = size + 'px';
        dot.dataset.dir = taxiDirection(pos);
        // Sklandus važiavimas: pradedam nuo ankstesnio langelio vietos ir „privažiuojam“
        if (from) {
            const to = cellCenterInBoard(cell);
            holder.style.transition = 'none';
            holder.style.transform = `translate(${from.x - to.x}px, ${from.y - to.y}px)`;
            void holder.offsetWidth;
            holder.style.transition = `transform ${hopMs}ms linear`;
            holder.style.transform = 'translate(0, 0)';
        }
        return;
    }
    dot.style.width = dot.style.height = size + 'px';
    dot.style.setProperty('--ps', size + 'px');
    if (hopMs) {
        dot.classList.remove('hop'); void dot.offsetWidth;
        dot.style.animationDuration = hopMs + 'ms';
        dot.classList.add('hop');
    }
}

async function animateMovement(playerId, fromPos, toPos, waitBefore, opts = {}) {
    if (fromPos === toPos) { if (waitBefore) await waitBefore; return; }
    
    const boardSize = 52;
    const totalSteps = (toPos - fromPos + boardSize) % boardSize;
    if (totalSteps === 0) { if (waitBefore) await waitBefore; return; }
    
    const stepDuration = opts.stepMs || (totalSteps > 8 ? 170 : 260);
    
    // Tikra figūrėlė paslepiama, o vietoj jos – „einanti“ figūrėlė, kuri visą laiką matoma
    hidePlayerDot(playerId);
    const walker = makeWalker(playerId, !!opts.taxi);
    let walkerPos = fromPos;
    placeWalker(walker, walkerPos, 0);
    // Lenta gali persipiešti (atėjus naujai būsenai) – figūrėlę grąžinam į vietą
    const keepWalker = setInterval(() => {
        if (!walker.isConnected) placeWalker(walker, walkerPos, 0);
    }, 50);

    // Kol skrenda kauliukai – figūrėlė stovi savo vietoje
    if (waitBefore) await waitBefore;

    // 🎥 Kamera priartėja prie figūrėlės
    const camOn = cameraStart(walker.firstChild, playerId);
    if (camOn) await new Promise(r => setTimeout(r, 450));
    if (opts.taxi) taxiBeep();
    
    let lastCell = null;
    for (let i = 1; i <= totalSteps; i++) {
        const currentPos = (fromPos + i) % boardSize;
        const cell = document.getElementById(`cell-${currentPos}`);
        if (!cell) continue;
        if (lastCell && i <= totalSteps) lastCell.classList.remove('highlight-yellow');
        cell.classList.add('highlight-yellow');
        walkerPos = currentPos;
        placeWalker(walker, currentPos, stepDuration);
        if (currentPos === 0 && i < totalSteps && typeof fxStart3 === 'function') { try { fxStart3(0, 200); } catch (e) {} }   // 🏁 pravažiavo START
        lastCell = cell;
        if (camOn) cameraFollow(walker.firstChild, stepDuration + 60);
        
        if (typeof playClickSound === 'function' && (!opts.taxi || i % 3 === 0 || i === totalSteps)) {
            playClickSound();
        }
        
        await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
    
    const finalCell = document.getElementById(`cell-${toPos}`);
    if (finalCell) {
        placeWalker(walker, toPos, 0);   // jei lenta persipiešė – grąžinam
        await new Promise(resolve => setTimeout(resolve, 380));
        finalCell.classList.remove('highlight-yellow');
    }
    
    clearInterval(keepWalker);
    const clearLift = () => document.querySelectorAll('#board .cell.has-walker').forEach(c => c.classList.remove('has-walker'));
    if (opts.taxi) {
        setTimeout(clearLift, 700);
        // Figūrėlė išlipa, taksi pasignalizuoja ir nuvažiuoja
        showPlayerDot(playerId, toPos);
        taxiBeep();
        walker.classList.add('drive-off');
        setTimeout(() => { if (walker.parentNode) walker.parentNode.removeChild(walker); }, 650);
    } else if (walker.parentNode) {
        walker.parentNode.removeChild(walker);
        clearLift();
    }
    showPlayerDot(playerId, toPos);
    if (camOn) setTimeout(cameraEnd, 250);   // 🎥 nutolsta, kai figūrėlė sustojo
    
    if (finalCell) {
        const playerDots = finalCell.querySelectorAll('.player-dot');
        playerDots.forEach(dot => {
            if (dot.dataset.playerId == playerId) {
                dot.classList.add('jumping');
                setTimeout(() => dot.classList.remove('jumping'), 300);
            }
        });
    }
}

function hidePlayerDot(playerId) {
    document.querySelectorAll('.player-dot').forEach(dot => {
        if (dot.dataset.playerId == playerId) {
            dot.style.display = 'none';
        }
    });
}

function showPlayerDot(playerId, position) {
    document.querySelectorAll('.player-dot').forEach(dot => {
        if (dot.dataset.playerId == playerId) {
            dot.style.display = '';
        }
    });
}

// ============================================
// PIRKIMAS
// ============================================

function showBuyChoice(data) {
    const choice = document.getElementById('buyChoice');
    document.getElementById('choiceFieldName').textContent = data.fieldName || 'Sklypas';
    document.getElementById('choiceFieldCost').textContent = '€' + (data.fieldCost || 0);
    
    if (gameState) {
        const player = gameState.players.find(p => p.id === data.playerId);
        if (player) {
            document.getElementById('choicePlayerMoney').textContent = '€' + player.money;
        }
    }
    
    choice.style.display = 'flex';
    choice.classList.add('show');
    playNotificationSound();
}

function hideBuyChoice(force = false) {
    // 🆕 Jei force=true – priverstinai uždaryti (apeiti apsaugą)
    if (!force && gameState && gameState.waitingForBuy && !window.buyCancelled) {
        console.log('⚠️ Negalima uždaryti pirkimo – laukiama sprendimo!');
        return;
    }
    
    const choice = document.getElementById('buyChoice');
    if (choice) {
        choice.style.display = 'none';
        choice.classList.remove('show');
    }
}

function confirmBuy() {
    window.buyCancelled = true;
    window.lastPendingPurchasePlayerId = null;  // 🆕 Išvalyti
    
    socket.emit('buyProperty');
    playClickSound();
    hideBuyChoice();
    
    setTimeout(() => {
        window.buyCancelled = false;
    }, 2000);
}

function cancelBuy() {
    window.buyCancelled = true;
    window.lastPendingPurchasePlayerId = null;  // 🆕 Išvalyti
    
    socket.emit('cancelBuy');
    playClickSound();
    hideBuyChoice();
    
    setTimeout(() => {
        window.buyCancelled = false;
    }, 2000);
}

// ============================================
// ŽAIDIMO VALDYMAS
// ============================================

let localRolling = false;  // 🆕 Apsauga nuo pakartotinio metimo

function rollDice() {
    if (typeof cell5DismissMyTurn === 'function') cell5DismissMyTurn();
    window.__rolledThisTurn = true;   // „Tavo eilė – mesk“ nebereikalingas
    // 🆕 APSAUGA NUO PAKARTOTINIO METIMO
    if (localRolling) {
        console.log('⚠️ Jau metama, palauk...');
        return;
    }
    
    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn && rollBtn.dataset.blockedByAction === 'true') {
        alert(tf('cli.palauk_kol_baigsis_pranesimas'));
        playErrorSound();
        return;
    }
    
    if (!isMyTurn) {
        alert(tf('cli.ne_tavo_eile'));
        playErrorSound();
        return;
    }
    
    if (myPlayer && myPlayer.isDebtor) {
        alert(tf('cli.tu_skolingas_parduok_turta_kad'));
        playErrorSound();
        return;
    }
    
    if (amIKicked) {
        alert(tf('cli.tu_buvai_pasalintas_is_zaidimo'));
        playErrorSound();
        return;
    }
    
    // 🆕 UŽBLOKUOTI METIMĄ
    localRolling = true;
// console.log('🔒 localRolling = true');
    
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    
    playClickSound();
    socket.emit('rollDice');
    
    // 🆕 ATBLOKUOTI po 3 sekundžių
    setTimeout(() => {
        localRolling = false;
// console.log('🔓 localRolling = false (po 3s)');
    }, 3000);
}

// ============================================
// PREKYBA
// ============================================

let selectedSellFields = [];
let selectedAuctionField = null;
let currentTradeId = null;
let selectedOfferFields = [];
let selectedRequestFields = [];

function openTrading() {
    if (myPlayer && (myPlayer.bankrupt || myPlayer.left || myPlayer.kicked)) {
        alert(tf('cli.tu_nebegali_prekiauti'));
        playErrorSound();
        return;
    }
    const modal = document.getElementById('tradingModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.getElementById('tradingOptions').style.display = 'block';
    document.getElementById('sellToBankPanel').style.display = 'none';
    document.getElementById('auctionPanel').style.display = 'none';
    document.getElementById('tradeToPlayerPanel').style.display = 'none';
    
    selectedOfferFields = [];
    selectedRequestFields = [];
    
    updateSellableProperties();
    updateAuctionableProperties();
    updateTradePlayers();
    updateTradeFields();
    playClickSound();
}

function closeTrading() {
    const modal = document.getElementById('tradingModal');
    if (modal) modal.style.display = 'none';
    window.isCounterOfferMode = false;
    window.counterOfferData = null;
    window.lastIncomingTrade = null;
    playClickSound();
}

function backToTradingOptions() {
    document.getElementById('tradingOptions').style.display = 'block';
    document.getElementById('sellToBankPanel').style.display = 'none';
    document.getElementById('auctionPanel').style.display = 'none';
    document.getElementById('tradeToPlayerPanel').style.display = 'none';
    playClickSound();
}

function showSellToBank() {
    document.getElementById('tradingOptions').style.display = 'none';
    document.getElementById('sellToBankPanel').style.display = 'block';
    updateSellableProperties();
    playClickSound();
}

function showAuctionPanel() {
    document.getElementById('tradingOptions').style.display = 'none';
    document.getElementById('auctionPanel').style.display = 'block';
    updateAuctionableProperties();
    playClickSound();
}

function showTradeToPlayer() {
    document.getElementById('tradingOptions').style.display = 'none';
    document.getElementById('tradeToPlayerPanel').style.display = 'block';
    
    // Naujas pasiūlymas – tikrai ne counter-offer
    window.isCounterOfferMode = false;
    window.counterOfferData = null;
    window.lastIncomingTrade = null;
    
    selectedOfferFields = [];
    selectedRequestFields = [];
    
    updateTradePlayers();
    updateOfferFields();
    playClickSound();
}

function updateSellableProperties() {
    const container = document.getElementById('sellableProperties');
    if (!container || !gameState || !myPlayer) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const properties = [...(player.properties || [])].sort((a, b) => {
        const fieldA = gameState.board.find(f => f.id === a);
        const fieldB = gameState.board.find(f => f.id === b);
        return (fieldA?.cost || 0) - (fieldB?.cost || 0);
    });
    
    let html = '<div class="trade-mini-cards">';
    let count = 0;
    
    properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) return;
        
        const checked = selectedSellFields.includes(fieldId);
        
        html += renderMiniCardForTrade(field, {
            selected: checked,
            showCheckbox: true,
            fieldId: fieldId,
            onClick: `toggleSellField(${fieldId})`,
            houses: houses
        });
        count++;
    });
    
    html += '</div>';
    
    if (count === 0) {
        html = tf('cli.neturi_korteliu_be_namu');
    }
    container.innerHTML = html;
    
    setTimeout(initTradeMiniCardTooltips, 50);
}

function toggleSellField(fieldId) {
    const index = selectedSellFields.indexOf(fieldId);
    if (index > -1) {
        selectedSellFields.splice(index, 1);
    } else {
        selectedSellFields.push(fieldId);
    }
    playClickSound();
}

function confirmSellToBank() {
    if (selectedSellFields.length === 0) {
        alert(tf('cli.pasirink_bent_viena_kortele'));
        playErrorSound();
        return;
    }
    
    const totalPrice = selectedSellFields.reduce((sum, id) => {
        const field = gameState.board.find(f => f.id === id);
        return sum + Math.floor(field.cost * 0.8);
    }, 0);
    
    if (confirm(tf('cli.parduoti_kortele_es_bankui_uz', { v: selectedSellFields.length, totalPrice }))) {
        socket.emit('sellToBank', { fieldIds: selectedSellFields });
        selectedSellFields = [];
        closeTrading();
        playClickSound();
        playCashSound();
    }
}

function updateAuctionableProperties() {
    const container = document.getElementById('auctionableProperties');
    if (!container || !gameState || !myPlayer) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const properties = [...(player.properties || [])].sort((a, b) => {
        const fieldA = gameState.board.find(f => f.id === a);
        const fieldB = gameState.board.find(f => f.id === b);
        return (fieldA?.cost || 0) - (fieldB?.cost || 0);
    });
    
    let html = '<div class="trade-mini-cards">';
    let count = 0;
    
    properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses > 0) return;
        
        const checked = (selectedAuctionField === fieldId);
        
        html += renderMiniCardForTrade(field, {
            selected: checked,
            showRadio: true,
            fieldId: fieldId,
            onClick: `selectAuctionField(${fieldId})`,
            houses: houses
        });
        count++;
    });
    
    html += '</div>';
    
    if (count === 0) {
        html = tf('cli.neturi_korteliu_be_namu');
    }
    container.innerHTML = html;
    
    setTimeout(initTradeMiniCardTooltips, 50);
}

function selectAuctionField(fieldId) {
    selectedAuctionField = fieldId;
    updateAuctionableProperties();
    playClickSound();
}

function confirmStartAuction() {
    if (!selectedAuctionField && selectedAuctionField !== 0) {
        alert(tf('cli.pasirink_kortele_aukcionui'));
        playErrorSound();
        return;
    }
    
    const field = gameState.board.find(f => f.id === selectedAuctionField);
    if (!field) {
        alert(tf('cli.kortele_nerasta'));
        playErrorSound();
        return;
    }
    
    if (confirm(tf('cli.skelbti_aukciona_bankas_siulys_70', { field: field.name, v: Math.floor(field.cost * 0.7) }))) {
        socket.emit('startAuction', { fieldId: selectedAuctionField });
        selectedAuctionField = null;
        closeTrading();
        const msg = tf('cli.auction_announced', { field: field.name });
        addNotification(msg);
        addJournal(msg);
        playClickSound();
        playAuctionSound();
    }
}

function updateTradePlayers() {
    const select = document.getElementById('tradeTargetPlayer');
    if (!select) return;
    if (!gameState) return;
    if (playerId == null) return;
    
    select.innerHTML = '';
    let found = false;
    gameState.players.forEach(p => {
        if (p.id !== playerId && p.isActive && !p.bankrupt && !p.left && !p.kicked) {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (€${p.money})`;
            select.appendChild(option);
            found = true;
        }
    });
    
    if (!found) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = tf('cli.nera_aktyviu_zaideju');
        select.appendChild(option);
    }
    
    updateRequestFields();
}

// 🤝 Prekyba: žaidėjai kaip kortelės su figūrėle ir spalva (vietoj paprasto sąrašo)
function renderTradeTargetChips() {
    const select = document.getElementById('tradeTargetPlayer');
    if (!select || !gameState) return;
    let box = document.getElementById('tradeTargetChips');
    if (!box) {
        box = document.createElement('div');
        box.id = 'tradeTargetChips';
        select.parentNode.insertBefore(box, select);
    }
    select.classList.add('trade-select-hidden');
    const players = gameState.players.filter(p => p.id !== playerId && p.isActive && !p.bankrupt && !p.left && !p.kicked);
    if (players.length === 0) {
        box.innerHTML = tf('cli.nera_aktyviu_zaideju_2');
        return;
    }
    const cur = String(select.value);
    box.innerHTML = '';
    players.forEach(p => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ttc' + (String(p.id) === cur ? ' active' : '');
        const col = safeColor(p.color);
        b.style.setProperty('--ttc-color', col);
        b.innerHTML = `<span class="ttc-piece">${pieceSvg(p.piece || 'pawn', p.color)}</span>` +
            `<span class="ttc-dot" style="background:${col}"></span>` +
            `<span class="ttc-name">${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</span>` +
            `<span class="ttc-money">€${p.money}</span>`;
        b.onclick = () => {
            if (String(select.value) === String(p.id)) return;
            select.value = String(p.id);
            playClickSound();
            select.dispatchEvent(new Event('change'));
        };
        box.appendChild(b);
    });
}

function updateTradeFields() {
    const offerContainer = document.getElementById('tradeOfferFields');
    const requestContainer = document.getElementById('tradeRequestFields');
    
    if (!offerContainer || !requestContainer) return;
    if (!gameState || !myPlayer) return;
    
    selectedOfferFields = [];
    selectedRequestFields = [];
    
    updateOfferFields();
    updateRequestFields();
}

function updateOfferFields() {
    const container = document.getElementById('tradeOfferFields');
    if (!container || !gameState || !myPlayer) return;
    
    let html = '<div class="trade-mini-cards">';
    let count = 0;
    
    // 🆕 COUNTER-OFFER REŽIMAS
    if (window.isCounterOfferMode && window.counterOfferData) {
        // Rodome JONO prašytas korteles (kurias jis nori gauti iš manęs)
        const data = window.counterOfferData;
        
        // Pirmiausia rodom JONO prašytas korteles (Ariogala)
        data.counterOfferFieldIds.forEach(fieldId => {
            const field = gameState.board.find(f => f.id === fieldId);
            if (!field) return;
            
            const checked = selectedOfferFields.includes(fieldId);
            const myPlayer = gameState.players.find(p => p.id === playerId);
            const houses = myPlayer?.houses?.[fieldId] || 0;
            
            html += renderMiniCardForTrade(field, {
                selected: checked,
                showCheckbox: true,
                fieldId: fieldId,
                onClick: `toggleOfferField(${fieldId})`,
                houses: houses
            });
            count++;
        });
        
        // Tada rodom TAVO kitas korteles (kurias gali pridėti)
        const myPlayer = gameState.players.find(p => p.id === playerId);
        const myProps = [...(myPlayer?.properties || [])].sort((a, b) => {
            const fieldA = gameState.board.find(f => f.id === a);
            const fieldB = gameState.board.find(f => f.id === b);
            return (fieldA?.cost || 0) - (fieldB?.cost || 0);
        });
        
        myProps.forEach(fieldId => {
            // Praleisti jau įtrauktas
            if (data.counterOfferFieldIds.includes(fieldId)) return;
            
            const field = gameState.board.find(f => f.id === fieldId);
            if (!field) return;
            
            const houses = myPlayer?.houses?.[fieldId] || 0;
            if (houses > 0) return;
            
            const checked = selectedOfferFields.includes(fieldId);
            
            html += renderMiniCardForTrade(field, {
                selected: checked,
                showCheckbox: true,
                fieldId: fieldId,
                onClick: `toggleOfferField(${fieldId})`,
                houses: houses
            });
            count++;
        });
    } else {
        // ĮPRASTAS REŽIMAS (naujas pasiūlymas)
        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return;
        
        const properties = [...(player.properties || [])].sort((a, b) => {
            const fieldA = gameState.board.find(f => f.id === a);
            const fieldB = gameState.board.find(f => f.id === b);
            return (fieldA?.cost || 0) - (fieldB?.cost || 0);
        });
        
        properties.forEach(fieldId => {
            const field = gameState.board.find(f => f.id === fieldId);
            if (!field) return;
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            if (houses > 0) return;
            
            const checked = selectedOfferFields.includes(fieldId);
            
            html += renderMiniCardForTrade(field, {
                selected: checked,
                showCheckbox: true,
                fieldId: fieldId,
                onClick: `toggleOfferField(${fieldId})`,
                houses: houses
            });
            count++;
        });
    }
    
    html += '</div>';
    
    if (count === 0) {
        html = tf('cli.neturi_korteliu_be_namu');
    }
    container.innerHTML = html;
    
    setTimeout(initTradeMiniCardTooltips, 50);
}

function toggleOfferField(fieldId) {
    const index = selectedOfferFields.indexOf(fieldId);
    if (index > -1) {
        selectedOfferFields.splice(index, 1);
    } else {
        selectedOfferFields.push(fieldId);
    }
    updateOfferFields();
    playClickSound();
}

function toggleRequestField(fieldId) {
    const index = selectedRequestFields.indexOf(fieldId);
    if (index > -1) {
        selectedRequestFields.splice(index, 1);
    } else {
        selectedRequestFields.push(fieldId);
    }
    updateRequestFields();
    playClickSound();
}

function updateRequestFields() {
    const targetSelectElem = document.getElementById('tradeTargetPlayer');
    const container = document.getElementById('tradeRequestFields');
    renderTradeTargetChips();
    
    if (!targetSelectElem || !container) return;
    
    if (!gameState) {
        container.innerHTML = tf('cli.nera_zaidimo_busenos');
        return;
    }
    
    let html = '<div class="trade-mini-cards">';
    let count = 0;
    
    // 🆕 COUNTER-OFFER REŽIMAS
    if (window.isCounterOfferMode && window.counterOfferData) {
        const data = window.counterOfferData;
        
        // Pirmiausia rodom JONO siūlytas korteles (ORO UOSTAS)
        data.counterRequestFieldIds.forEach(fieldId => {
            const field = gameState.board.find(f => f.id === fieldId);
            if (!field) return;
            
            const checked = selectedRequestFields.includes(fieldId);
            const jonas = gameState.players.find(p => p.id === data.incoming.fromPlayerId);
            const houses = jonas?.houses?.[fieldId] || 0;
            
            html += renderMiniCardForTrade(field, {
                selected: checked,
                showCheckbox: true,
                fieldId: fieldId,
                onClick: `toggleRequestField(${fieldId})`,
                houses: houses
            });
            count++;
        });
        
        // Tada rodom JONO kitas korteles (kurias gali paprašyti)
        const targetId = parseInt(targetSelectElem.value);
        const target = gameState.players.find(p => p.id === targetId);
        
        if (target) {
            const targetProps = [...(target.properties || [])].sort((a, b) => {
                const fieldA = gameState.board.find(f => f.id === a);
                const fieldB = gameState.board.find(f => f.id === b);
                return (fieldA?.cost || 0) - (fieldB?.cost || 0);
            });
            
            targetProps.forEach(fieldId => {
                // Praleisti jau įtrauktas
                if (data.counterRequestFieldIds.includes(fieldId)) return;
                
                const field = gameState.board.find(f => f.id === fieldId);
                if (!field) return;
                
                const houses = target.houses?.[fieldId] || 0;
                if (houses > 0) return;
                
                const checked = selectedRequestFields.includes(fieldId);
                
                html += renderMiniCardForTrade(field, {
                    selected: checked,
                    showCheckbox: true,
                    fieldId: fieldId,
                    onClick: `toggleRequestField(${fieldId})`,
                    houses: houses
                });
                count++;
            });
        }
    } else {
        // ĮPRASTAS REŽIMAS
        const targetId = parseInt(targetSelectElem.value);
        
        if (isNaN(targetId) || targetSelectElem.value === '') {
            container.innerHTML = tf('cli.pasirink_zaideja');
            return;
        }
        
        const target = gameState.players.find(p => p.id === targetId);
        
        if (!target) {
            container.innerHTML = tf('cli.zaidejas_nerastas');
            return;
        }
        
        if (target.properties.length === 0) {
            container.innerHTML = tf('cli.sis_zaidejas_neturi_korteliu');
            return;
        }
        
        const properties = [...(target.properties || [])].sort((a, b) => {
            const fieldA = gameState.board.find(f => f.id === a);
            const fieldB = gameState.board.find(f => f.id === b);
            return (fieldA?.cost || 0) - (fieldB?.cost || 0);
        });
        
        properties.forEach(fieldId => {
            const field = gameState.board.find(f => f.id === fieldId);
            if (!field) return;
            const houses = target.houses && target.houses[fieldId] ? target.houses[fieldId] : 0;
            if (houses > 0) return;
            
            const checked = selectedRequestFields.includes(fieldId);
            
            html += renderMiniCardForTrade(field, {
                selected: checked,
                showCheckbox: true,
                fieldId: fieldId,
                onClick: `toggleRequestField(${fieldId})`,
                houses: houses
            });
            count++;
        });
    }
    
    html += '</div>';
    
    if (count === 0) {
        html = tf('cli.nera_korteliu');
    }
    container.innerHTML = html;
    
    setTimeout(initTradeMiniCardTooltips, 50);
}

function confirmProposeTrade() {
    const targetId = parseInt(document.getElementById('tradeTargetPlayer').value);
    const offerMoney = parseInt(document.getElementById('tradeOfferMoney').value) || 0;
    const requestMoney = parseInt(document.getElementById('tradeRequestMoney').value) || 0;
    
    if (isNaN(targetId) || targetId === '' || document.getElementById('tradeTargetPlayer').value === '') {
        alert(tf('cli.pasirink_zaideja_2'));
        playErrorSound();
        return;
    }
    
    if (selectedOfferFields.length === 0 && offerMoney === 0) {
        alert(tf('cli.pasirink_ka_siulai_kortele_arba'));
        playErrorSound();
        return;
    }
    
    if (selectedRequestFields.length === 0 && requestMoney === 0) {
        alert(tf('cli.pasirink_ko_prasai_kortele_arba'));
        playErrorSound();
        return;
    }
    
    const target = gameState.players.find(p => p.id === targetId);
    
    let msg = tf('cli.siusti_pasiulyma', { target: target.name });
    msg += tf('cli.siulai');
    if (selectedOfferFields.length > 0) {
        selectedOfferFields.forEach(id => {
            const field = gameState.board.find(f => f.id === id);
            msg += `  - ${field.name}\n`;
        });
    }
    if (offerMoney > 0) {
        msg += tf('cli.pinigu', { offerMoney });
    }
    msg += tf('cli.prasai');
    if (selectedRequestFields.length > 0) {
        selectedRequestFields.forEach(id => {
            const field = gameState.board.find(f => f.id === id);
            msg += `  - ${field.name}\n`;
        });
    }
    if (requestMoney > 0) {
        msg += tf('cli.pinigu_2', { requestMoney });
    }
    
    if (confirm(msg)) {
        const tradeData = {
            targetPlayerId: targetId,
            offerFieldIds: selectedOfferFields,
            requestFieldIds: selectedRequestFields,
            offerMoney: offerMoney,
            requestMoney: requestMoney
        };
        
        // Counter-offer TIK jei tikrai įjungtas counter režimas (ne šiaip likęs senas pasiūlymas)
        const counterSrc = (window.isCounterOfferMode === true)
            ? ((window.counterOfferData && window.counterOfferData.incoming) || window.lastIncomingTrade)
            : null;
        if (counterSrc && counterSrc.tradeId) {
            socket.emit('counterTrade', {
                tradeId: counterSrc.tradeId,
                offerFieldIds: selectedOfferFields,
                requestFieldIds: selectedRequestFields,
                offerMoney: offerMoney,
                requestMoney: requestMoney
            });
            window.lastIncomingTrade = null;
            window.counterOfferData = null;
            window.isCounterOfferMode = false;
            
            closeTrading();
            const tradeMsg = tf('cli.pakoreguotas_pasiulymas_issiustas', { target: target.name });
            addNotification(tradeMsg);
            addJournal(tradeMsg);
            playClickSound();
            playTradeSound();
        } else {
            socket.emit('proposeTrade', tradeData);
            closeTrading();
            const tradeMsg = tf('cli.pasiulymas_issiustas', { target: target.name });
            addNotification(tradeMsg);
            addJournal(tradeMsg);
            playClickSound();
            playTradeSound();
        }
    }
}

function showTradeOffer(data) {
    // 🆕 Išjungti counter-offer režimą (naujas pasiūlymas)
    window.isCounterOfferMode = false;
    window.counterOfferData = null;

    window.lastIncomingTrade = {
        tradeId: data.tradeId,
        fromPlayer: data.fromPlayer,
        fromPlayerId: data.fromPlayerId,
        offerFieldIds: data.offerFieldIds || [],
        requestFieldIds: data.requestFieldIds || [],
        offerMoney: data.offerMoney || 0,
        requestMoney: data.requestMoney || 0
    };
    
    document.getElementById('offerFromPlayer').textContent = data.fromPlayer || tf('cli.nezinomas');
    
    const offerContainer = document.getElementById('offerFieldsContainer');
    if (offerContainer) {
        offerContainer.innerHTML = generateTradeMiniCards(data.offerFieldIds || []);
    }
    
    const requestContainer = document.getElementById('requestFieldsContainer');
    if (requestContainer) {
        requestContainer.innerHTML = generateTradeMiniCards(data.requestFieldIds || []);
    }
    
    const offerMoneyEl = document.getElementById('offerMoneyDisplay');
    if (offerMoneyEl) {
        if (data.offerMoney > 0) {
            offerMoneyEl.textContent = `💰 + €${data.offerMoney}`;
        } else {
            offerMoneyEl.textContent = '';
        }
    }
    
    const requestMoneyEl = document.getElementById('requestMoneyDisplay');
    if (requestMoneyEl) {
        if (data.requestMoney > 0) {
            requestMoneyEl.textContent = `💰 + €${data.requestMoney}`;
        } else {
            requestMoneyEl.textContent = '';
        }
    }
    
    currentTradeId = data.tradeId;
    document.getElementById('tradeOfferModal').style.display = 'flex';
    playNotificationSound();
}

function generateTradeMiniCards(fieldIds) {
    if (!fieldIds || fieldIds.length === 0) {
        return '<div style="font-size:11px; color:#6c757d; text-align:center; padding:4px;">' + tf('cli.only_money') + '</div>';
    }
    
    if (!gameState || !gameState.board) {
        return tf('cli.nera_duomenu');
    }
    
    let html = '<div style="display:flex; flex-wrap:wrap; gap:4px; justify-content:center;">';
    
    fieldIds.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        
        const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
        const color = isService ? '#f0e8d8' : (field.color || '#c9a84c');
        
        const topBar = isService 
            ? `<div style="background:#f0e8d8; display:flex; align-items:center; justify-content:center; height:20px; font-size:14px; border-bottom:1px solid rgba(61,43,31,0.2);">${field.icon || '⚙️'}</div>`
            : `<div style="background:${color}; height:20px; border-bottom:1px solid #3d2b1f;"></div>`;
        
        html += `
            <div style="background:#f5f0e8; border:2px solid #3d2b1f; border-radius:4px; overflow:hidden; width:60px; flex-shrink:0; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                ${topBar}
                <div style="padding:3px 2px; text-align:center;">
                    <div style="font-size:8px; font-weight:700; color:#3d2b1f; line-height:1.1; word-wrap:break-word;">${field.name}</div>
                    <div style="font-size:7px; color:#6c757d; margin-top:2px;">€${field.cost}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function closeTradeOffer() {
    document.getElementById('tradeOfferModal').style.display = 'none';
    currentTradeId = null;
    // Uždarę gautą pasiūlymą išeiname ir iš counter-offer režimo,
    // kad jis neperimtų kito, naujo pasiūlymo siuntimo.
    window.isCounterOfferMode = false;
    window.counterOfferData = null;
    window.lastIncomingTrade = null;
    playClickSound();
}

function acceptTrade() {
    if (!currentTradeId) return;
    if (confirm(tf('cli.ar_tikrai_nori_priimti_si'))) {
        socket.emit('respondToTrade', { tradeId: currentTradeId, accept: true });
        closeTradeOffer();
        playClickSound();
    }
}

function rejectTrade() {
    if (!currentTradeId) return;
    if (confirm(tf('cli.ar_tikrai_nori_atmesti_si'))) {
        socket.emit('respondToTrade', { tradeId: currentTradeId, accept: false });
        closeTradeOffer();
        playClickSound();
    }
}

function counterTradeOffer() {
    if (!currentTradeId || !window.lastIncomingTrade) return;
    
    const incoming = window.lastIncomingTrade;
    
    closeTradeOffer();
    
    // 🆕 NUSTATYTI COUNTER-OFFER REŽIMĄ
    window.isCounterOfferMode = true;
    
    // 🆕 IŠ KARTO atidaryti prekybos langą
    const modal = document.getElementById('tradingModal');
    modal.style.display = 'flex';
    document.getElementById('tradingOptions').style.display = 'none';
    document.getElementById('sellToBankPanel').style.display = 'none';
    document.getElementById('auctionPanel').style.display = 'none';
    document.getElementById('tradeToPlayerPanel').style.display = 'block';
    
    // 🆕 Pasirinkti Joną kaip target
    updateTradePlayers();
    const targetSelect = document.getElementById('tradeTargetPlayer');
    if (targetSelect && incoming.fromPlayerId) {
        targetSelect.value = incoming.fromPlayerId;
    }
    
    // 🆕 IŠSAUGOTI counter-offer duomenis ATSKIRAI
    window.counterOfferData = {
        incoming: incoming,
        // Jonas siūlė (dabar PRAŠAU)
        counterRequestFieldIds: [...(incoming.offerFieldIds || [])],
        counterRequestMoney: incoming.offerMoney || 0,
        // Jonas prašė (dabar SIŪLAU)
        counterOfferFieldIds: [...(incoming.requestFieldIds || [])],
        counterOfferMoney: incoming.requestMoney || 0
    };
    
    // 🆕 NUSTATYTI selected masyvus
    selectedOfferFields = [...window.counterOfferData.counterOfferFieldIds];
    selectedRequestFields = [...window.counterOfferData.counterRequestFieldIds];
    
    // 🆕 Užpildyti pinigus
    document.getElementById('tradeOfferMoney').value = window.counterOfferData.counterOfferMoney;
    document.getElementById('tradeRequestMoney').value = window.counterOfferData.counterRequestMoney;
    
    // 🆕 Užpildyti korteles
    updateOfferFields();
    setTimeout(() => updateRequestFields(), 100);
    
    playClickSound();
}

// ============================================
// GRIAUTI NAMUS
// ============================================
let demolishableProperties = [];

function openDemolish() {
    if (!isMyTurn && !(myPlayer && myPlayer.isDebtor)) {
        alert(tf('cli.ne_tavo_eile'));
        playErrorSound();
        return;
    }
    
    const modal = document.getElementById('demolishModal');
    if (!modal) return;
    
    socket.emit('getDemolishableProperties');
    modal.style.display = 'flex';
    playClickSound();
}

function closeDemolish() {
    document.getElementById('demolishModal').style.display = 'none';
    playClickSound();
}

function updateDemolishList(properties) {
    const container = document.getElementById('demolishProperties');
    if (!container) return;
    
    demolishableProperties = properties;
    
    if (properties.length === 0) {
        container.innerHTML = tf('cli.neturi_namu_ar_viezbuciu_kuriuos');
        return;
    }
    
    const sorted = [...properties].sort((a, b) => {
        return (a.cost || 0) - (b.cost || 0);
    });
    
    let html = '';
    sorted.forEach(prop => {
        let houseIcons = '';
        if (prop.isHotel) {
            houseIcons = '🏨';
        } else {
            for (let i = 0; i < prop.houses; i++) {
                houseIcons += '🏠';
            }
        }
        
        const isService = prop.type === 'service1' || prop.type === 'service2' || prop.type === 'service3';
        const icon = isService ? (prop.icon || '⚙️') : '';
        const color = isService ? 'transparent' : (prop.color || '#c9a84c');
        const typeText = prop.isHotel ? tf('cli.viezbutis') : `${prop.houses} namai`;
        
        html += `
            <div class="demolish-card" onclick="confirmDemolish(${prop.id})">
                <div class="card-color" style="background:${color}; display:flex; align-items:center; justify-content:center; font-size:14px; border:1px solid rgba(0,0,0,0.2);">${icon}</div>
                <span class="card-name">${prop.name}</span>
                <span class="card-houses">${houseIcons}</span>
                <span class="card-refund">+€${prop.refund}</span>
                <span style="font-size:10px; color:#6c757d; margin-left:4px;">(${typeText})</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function confirmDemolish(fieldId) {
    socket.emit('demolishHouse', { fieldId: fieldId });
    closeDemolish();
    playClickSound();
}

// ============================================
// STATYBA
// ============================================

// 🏗️ Kur galima statyti pagal stalo statybų taisyklę (galutinai tikrina serveris)
// 🏗️ Statybų mygtukas valdymo lange: tik kai laukiama metimo (prieš metimą / po dublio).
// Žalias – pinigų užtenka, raudonas – neužtenka. Kol atidarytas 15 s statybų langas – nerodomas.
function refreshBuildButton() {
    const buildBtn = document.getElementById('buildBtn');
    if (!buildBtn) return;
    const gs = gameState;
    const me = myPlayer;
    const moving = (typeof isAnimating !== 'undefined' && isAnimating) ||
        (window.animatingPlayers && window.animatingPlayers.includes(playerId)) ||
        (gs && (gs.isRolling || gs.pendingFieldPlayerId === playerId || gs.taxiOffer || gs.waitingForBuy));
    const windowOpen = (typeof buildWin !== 'undefined' && buildWin.open) ||
        !!(gs && gs.buildWindow && gs.buildWindow.playerId === playerId);
    const out = !me || me.bankrupt || me.left || me.kicked || me.isDebtor;
    const opts = (!moving && !windowOpen && isMyTurn && !out && gs) ? getBuildableFields() : [];
    if (opts.length > 0) {
        const onlyHotel = opts.every(o => o.isHotel);
        const canPay = opts.some(o => o.afford !== false);
        buildBtn.textContent = (onlyHotel ? tt('game.buildHotelBtn', '🏨 Statyti viešbutį') : tt('game.buildHouseBtn', '🏠 Statyti namą')) +
            (opts.length > 1 ? ` (${opts.length})` : '');
        buildBtn.classList.toggle('can-pay', canPay);
        buildBtn.classList.toggle('no-money', !canPay);
        buildBtn.title = canPay ? '' : tt('game.buildNoMoney', '💸 Nepakanka pinigų statyboms');
        buildBtn.style.display = 'block';
        buildBtn.disabled = false;
    } else {
        buildBtn.style.display = 'none';
        buildBtn.disabled = true;
    }
}

function getBuildableFields() {
    if (!gameState || !myPlayer || !gameState.board) return [];
    const rule = gameState.buildRule || 2;
    const built = gameState.builtThisTurn || {};
    const houses = myPlayer.houses || {};
    const props = myPlayer.properties || [];
    const board = gameState.board;
    const isFullGroup = (color) => {
        const g = getGroupByColor(color);
        return g && g.length > 0 && g.every(id => props.includes(id));
    };
    let candidates = [];
    const stand = board[myPlayer.position];
    // 2 ir 3 taisyklės – tik tą ėjimą, kai ką tik atsistojai
    const lp = gameState.landingPos;
    if (rule !== 1 && (!lp || lp.playerId !== playerId || lp.pos !== myPlayer.position)) return [];
    if (rule === 1) {
        candidates = props.map(id => board[id]).filter(f => f && f.type === 'property' && f.color && isFullGroup(f.color));
    } else if (rule === 2) {
        if (stand && stand.type === 'property' && stand.color && props.includes(stand.id) && isFullGroup(stand.color)) {
            candidates = getGroupByColor(stand.color).map(id => board[id]).filter(f => f && !(built[f.id] >= 1));
        }
    } else {
        if (stand && stand.type === 'property' && stand.color && isFullGroup(stand.color) && props.includes(stand.id)) {
            candidates = [stand];   // kiek namų – lemia tolygus statymas
        }
    }
    const out = [];
    candidates.forEach(f => {
        const g = getGroupByColor(f.color);
        const hs = g.map(id => houses[id] || 0);
        const min = Math.min(...hs), max = Math.max(...hs);
        const cur = houses[f.id] || 0;
        if (cur >= 5) return;
        const allHave4 = hs.every(h => h >= 4);
        const ratio = (allHave4 ? gameState.hotelCostRatio : gameState.buildCostRatio);
        const cost = Math.floor((f.cost || 0) * (typeof ratio === 'number' ? ratio : 1));
        const afford = (myPlayer.money || 0) >= cost;
        if (allHave4) { out.push({ field: f, houses: cur, isHotel: true, cost, afford }); return; }
        if (max - min <= 1 && cur === min && cur < 4) out.push({ field: f, houses: cur, isHotel: false, cost, afford });
    });
    return out;
}

// 💸 Pranešimas statytojui, kad pinigų neužtenka
function showNoMoneyForBuild(opts) {
    const cheapest = Math.min(...opts.map(o => o.cost));
    const msg = tt('game.buildNoMoney', '💸 Nepakanka pinigų statyboms') +
        `: ${tt('game.buildCheapest', 'pigiausias namas kainuoja')} €${cheapest}, ${tt('game.buildYouHave', 'turi')} €${myPlayer ? myPlayer.money : 0}`;
    if (typeof cell5Enqueue === 'function') cell5Enqueue({ type: 'build', text: escapeHtml(msg), duration: 3500, priority: true });
    else alert(msg);
    playErrorSound();
}

function buildHouse() {
    if (!isMyTurn) {
        alert(tf('cli.ne_tavo_eile'));
        playErrorSound();
        return;
    }
    if (myPlayer && myPlayer.isDebtor) {
        alert(tf('cli.tu_skolingas_pirmiausia_atsiskaityk'));
        playErrorSound();
        return;
    }
    if (!gameState || !myPlayer) {
        alert(tf('cli.nera_zaidimo_busenos_2'));
        playErrorSound();
        return;
    }
    const opts = getBuildableFields();
    if (opts.length === 0) {
        alert('❌ ' + tt('game.buildNothing', 'Pagal statybų taisyklę dabar statyti negalima'));
        playErrorSound();
        return;
    }
    const affordable = opts.filter(o => o.afford !== false);
    if (affordable.length === 0) { showNoMoneyForBuild(opts); return; }
    playClickSound();
    if (opts.length === 1) {
        socket.emit('canBuildHouse', { fieldId: opts[0].field.id });
        return;
    }
    openBuildPicker(opts);
}

// Pasirinkimas, ant kurio sklypo statyti (kai galima ant kelių)
function openBuildPicker(opts) {
    let ov = document.getElementById('buildPicker');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'buildPicker';
        ov.innerHTML = '<div class="bp-box"><div class="bp-title"></div><div class="bp-rule"></div><div class="bp-list"></div><button type="button" class="bp-close"></button></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.style.display = 'none'; });
        ov.querySelector('.bp-close').onclick = () => { ov.style.display = 'none'; playClickSound(); };
    }
    const rule = (gameState && gameState.buildRule) || 2;
    ov.querySelector('.bp-title').textContent = tt('game.buildPickTitle', '🏗️ Kur statyti?');
    ov.querySelector('.bp-rule').textContent = tf('cli.build_rule_line_picker', { v: tt('game.buildRuleIs', 'Statybų taisyklė'), rule, v2: buildRuleLabel(rule) });
    ov.querySelector('.bp-close').textContent = tt('game.close', '✕ Uždaryti');
    const list = ov.querySelector('.bp-list');
    list.innerHTML = '';
    opts.forEach(o => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bp-item';
        const sw = document.createElement('span');
        sw.className = 'bp-swatch';
        sw.style.background = safeColor(o.field.color);
        const name = document.createElement('span');
        name.className = 'bp-name';
        name.textContent = o.field.name;
        const info = document.createElement('span');
        info.className = 'bp-info';
        info.textContent = (o.isHotel ? '🏠×4 → 🏨' : ('🏠'.repeat(o.houses) || '–') + ' → ' + '🏠'.repeat(o.houses + 1)) +
            (typeof o.cost === 'number' ? `  €${o.cost}` : '');
        btn.append(sw, name, info);
        if (o.afford === false) {
            btn.classList.add('no-money');
            btn.disabled = true;
            btn.title = tt('game.buildNoMoney', '💸 Nepakanka pinigų statyboms');
        }
        btn.onclick = () => {
            ov.style.display = 'none';
            playClickSound();
            socket.emit('canBuildHouse', { fieldId: o.field.id });
        };
        list.appendChild(btn);
    });
    ov.style.display = 'flex';
}

function payJailFine() {
    if (!isMyTurn) {
        alert(tf('cli.ne_tavo_eile'));
        playErrorSound();
        return;
    }
    
    if (!myPlayer || !myPlayer.inJail) {
        alert(tf('cli.nesi_kalejime'));
        playErrorSound();
        return;
    }
    
    if (myPlayer.money < 50) {
        alert(tf('cli.neturi_pakankamai_pinigu_reikia_50'));
        playErrorSound();
        return;
    }
    
    if (confirm(tf('cli.sumoketi_50_ir_iseiti_is'))) {
        socket.emit('payJailFine');
        playClickSound();
        // playPaySound();
    }
}

// 💀 Bankrotuoti galima bet kada žaidimo metu (tai ir vienintelis būdas pasitraukti).
// Langas laukia sprendimo 60 s – po to savaime atšaukiamas (ėjimo laikas tuo metu tiksi).
const BANKRUPT_CONFIRM_SECONDS = 60;
let bankruptCountdownTimer = null;

function bankrupt() {
    if (!myPlayer || myPlayer.bankrupt || myPlayer.left || myPlayer.kicked || !gameState || !gameState.gameStarted) {
        return;
    }
    const modal = document.getElementById('bankruptModal');
    modal.style.display = 'flex';
    playClickSound();
    startBankruptCountdown();
}

function startBankruptCountdown() {
    stopBankruptCountdown();
    const el = document.getElementById('bankruptCountdown');
    const endAt = Date.now() + BANKRUPT_CONFIRM_SECONDS * 1000;
    const tick = () => {
        const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        if (el) {
            el.textContent = tt('game.bankruptModal.countdown', '⏱️ Liko {s} s apsispręsti').replace('{s}', left);
            el.style.color = left <= 10 ? '#dc3545' : '#6c757d';
        }
        if (left <= 0) {
            stopBankruptCountdown();
            document.getElementById('bankruptModal').style.display = 'none';
        }
    };
    tick();
    bankruptCountdownTimer = setInterval(tick, 250);
}

function stopBankruptCountdown() {
    if (bankruptCountdownTimer) {
        clearInterval(bankruptCountdownTimer);
        bankruptCountdownTimer = null;
    }
}

function confirmBankrupt() {
    stopBankruptCountdown();
    document.getElementById('bankruptModal').style.display = 'none';
    playClickSound();
    
    if (!socket || !socket.connected) {
        alert(tf('cli.klaida_nera_rysio_su_serveriu'));
        playErrorSound();
        return;
    }
    
    socket.emit('bankrupt');
}

function cancelBankrupt() {
    stopBankruptCountdown();
    document.getElementById('bankruptModal').style.display = 'none';
    playClickSound();
}

function closeBankruptMessage() {
    document.getElementById('bankruptMessage').style.display = 'none';
    playClickSound();
    if (gameState) {
        updateUI(gameState);
    }
}

function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit('chatMessage', msg);
    input.value = '';
    playClickSound();
}

function getGroupByColor(color) {
    return COLOR_GROUPS[color] || [];
}

function setMode(mode) {
    const board = document.getElementById('board');
    board.className = mode;
    
    const modeBtn = document.getElementById('modeBtn');
    if (modeBtn) {
        if (mode === 'adaptive') {
            modeBtn.innerHTML = t('game.leftPanel.mode');
        } else {
            modeBtn.innerHTML = t('game.leftPanel.modeFixed');
        }
    }
    
    localStorage.setItem('boardMode', mode);
    playClickSound();
    
    setTimeout(autoFitInfoFont, 300);
}

function toggleMode() {
    const board = document.getElementById('board');
    if (!board) return;
    
    const currentMode = localStorage.getItem('boardMode') || 'adaptive';
    const newMode = currentMode === 'adaptive' ? 'fixed' : 'adaptive';
    
    setMode(newMode);
    
    console.log(`📊 Režimas pakeistas: ${currentMode} → ${newMode}`);
}



// ============================================
// UI ATNAUJINIMAS
// ============================================

function updateUI(state) {
    if (!state) return;
    updateTaxiTestButton();
    maybeAutoTour(state);
    // 🏗️ Statybų langas (sinchronizuojam laiką su serveriu)
    if (state.buildWindow && state.buildWindow.playerId === playerId) {
        const dl = Date.now() + state.buildWindow.msLeft;
        if (!buildWin.open || Math.abs(dl - buildWin.deadline) > 1200 || buildWin.rollAgain !== !!state.buildWindow.rollAgain) {
            openBuildWindowPanel(state.buildWindow.msLeft, state.buildWindow.rollAgain);
        }
    } else if (buildWin.open) {
        closeBuildWindowPanel();
    }
    // 🚕 Taksi pasirinkimas (pvz., po persikrovimo)
    if (state.taxiOffer && state.taxiOffer.playerId === playerId) {
        if (!taxiUi.open) openTaxiPicker(state.taxiOffer.cost, state.taxiOffer.msLeft, null);
    } else if (taxiUi.open) {
        closeTaxiPicker();
    }
    const rcb = document.getElementById('rulesCurrentBuildRule');
    if (rcb && state.buildRule) rcb.textContent = tf('cli.build_rule_this_table', { v: tt('game.buildRuleThisTable', 'Šiame stale'), buildRule: state.buildRule, v2: buildRuleLabel(state.buildRule) });
    
    document.getElementById('playerCount').textContent = `👥 ${state.players.filter(p => p.isActive && !p.left && !p.kicked).length}/${state.maxPlayers}`;
    
    const currentPlayer = state.players.find(p => p.id === state.currentTurn);
    // ✅ Keičiam tik vardą – laikmatis šalia lieka
    const turnNameEl = document.getElementById('turnDisplayName');
    if (turnNameEl) {
        turnNameEl.textContent = currentPlayer ? currentPlayer.name : '---';
    } else {
        document.getElementById('turnDisplay').textContent = `🎯 ${t('game.turnDisplay')}: ${currentPlayer ? currentPlayer.name : '---'}`;
    }

    const turnIndicatorName = document.getElementById('turnIndicatorName');
    const turnIndicatorNext = document.getElementById('turnIndicatorNext');
    const indicator = document.getElementById('turnIndicator');

    if (currentPlayer) {
        if (turnIndicatorName) {
            turnIndicatorName.textContent = currentPlayer.name;
            turnIndicatorName.style.color = currentPlayer.color || '#1a6b3c';
            turnIndicatorName.classList.toggle('cell5-light', cell5IsLight(currentPlayer.color));
            turnIndicatorName.classList.toggle('cell5-dark', cell5IsDark(currentPlayer.color));
        }
        
        if (indicator && currentPlayer.color) {
            indicator.style.borderColor = currentPlayer.color;
            indicator.style.background = currentPlayer.color + '20';
        }
        
        const activePlayers = state.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked);
        const currentIndex = activePlayers.findIndex(p => p.id === currentPlayer.id);
        
        let nextPlayer = null;
        if (activePlayers.length > 1) {
            nextPlayer = activePlayers[(currentIndex + 1) % activePlayers.length];
        }
        
        if (turnIndicatorNext) {
            if (nextPlayer && nextPlayer.id !== currentPlayer.id) {
                turnIndicatorNext.textContent = nextPlayer.name;
                turnIndicatorNext.style.color = nextPlayer.color || '#3d2b1f';
                turnIndicatorNext.classList.toggle('cell5-light', cell5IsLight(nextPlayer.color));
                turnIndicatorNext.classList.toggle('cell5-dark', cell5IsDark(nextPlayer.color));
            } else {
                turnIndicatorNext.textContent = '---';
            }
        }
    }
    
    const gameIdLeft = document.getElementById('gameIdDisplayLeft');
    if (gameIdLeft && gameId) gameIdLeft.textContent = gameId;

    const playerCountLeft = document.getElementById('playerCountLeft');
    if (playerCountLeft) {
        playerCountLeft.textContent = `${state.players.filter(p => p.isActive && !p.bankrupt && !p.left && !p.kicked).length}/${state.maxPlayers}`;
    }

    const turnDisplayLeft = document.getElementById('turnDisplayLeft');
    if (turnDisplayLeft && currentPlayer) {
        turnDisplayLeft.textContent = currentPlayer.name;
    }
    
    const me = state.players.find(p => p.id === playerId);
    if (me) {
        myPlayer = me;
        const housesInfo = me.houses ? Object.values(me.houses).reduce((a, b) => a + b, 0) : 0;
        
        let miniCardsHtml = '';
        if (me.properties.length > 0) {
            miniCardsHtml = '<div class="mini-cards-container">';
            
            let cardsWithPrice = [];
            me.properties.forEach(fieldId => {
                const field = state.board.find(f => f.id === fieldId);
                if (field) {
                    cardsWithPrice.push({
                        fieldId: fieldId,
                        field: field,
                        houses: me.houses && me.houses[fieldId] ? me.houses[fieldId] : 0
                    });
                }
            });
            
            cardsWithPrice.sort((a, b) => a.field.cost - b.field.cost);
            
            cardsWithPrice.forEach(({ fieldId, field, houses }) => {
                let houseIcon = '';
                if (houses >= 5) houseIcon = '🏨';
                else if (houses > 0) {
                    for (let i = 0; i < houses; i++) houseIcon += '🏠';
                }
                
                const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';
                const color = field.color || '#c9a84c';
                
                const tooltip = `${field.name} (#${fieldId}) • €${field.cost}`;
                
                const topBar = isService 
                    ? `<div class="mini-card-color mini-card-icon" style="background:transparent; display:flex; align-items:center; justify-content:center; font-size:16px;">${field.icon || '⚙️'}</div>`
                    : `<div class="mini-card-color" style="background:${color};"></div>`;
                
                miniCardsHtml += `
                    <div class="mini-card" title="${tooltip}" data-field-id="${fieldId}">
                        ${topBar}
                        <div class="mini-card-body">
                            <div class="mini-card-name">${field.name}</div>
                            <div class="mini-card-info">€${field.cost} • #${fieldId}</div>
                            ${houseIcon ? `<div class="mini-card-houses">${houseIcon}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            miniCardsHtml += '</div>';
        } else {
            miniCardsHtml = tf('cli.neturi_korteliu');
        }
        
        const oldMoneyEl = document.querySelector('#myInfo .player-money');
        const oldMoney = oldMoneyEl ? parseInt(oldMoneyEl.textContent.replace(/[^0-9-]/g, '')) : me.money;
        const newMoney = me.money;
        
        // „Griauti“ mygtukas gyvena vardo eilutėje – prieš perpiešimą jį išsaugom
        const demolishEl = document.getElementById('demolishBtn');
        if (demolishEl && demolishEl.parentNode) demolishEl.parentNode.removeChild(demolishEl);
        document.getElementById('myInfo').innerHTML = `
    <div class="myinfo-name-row" style="display:flex; align-items:center; gap:8px; width:100%; justify-content:center;">
        <div class="player-color" style="background:${me.color}; width:20px; height:20px; border-radius:50%; border:2px solid #3d2b1f; flex-shrink:0;"></div>
        <div class="player-name">${me.name}</div>
        <span class="myinfo-demolish-slot"></span>
    </div>

    <div class="player-money ${me.money < 0 ? 'negative' : ''}" data-target="${newMoney}">💰 €${newMoney}</div>
    <div style="color:#3d2b1f;">📍 ${state.board[me.position]?.name || me.position}</div>
    <div style="color:#3d2b1f;">${tf('cli.my_props', { n: me.properties.length, h: housesInfo })}</div>
    ${me.inJail ? tf('cli.kalejime') : ''}
    ${me.bankrupt ? '<div style="color:#dc3545; font-weight:700;">' + tf('cli.my_bankrupt') + '</div>' : ''}
    ${me.left ? '<div style="color:#6c757d; font-weight:700;">' + tf('cli.my_left') + '</div>' : ''}
    ${me.kicked ? tf('cli.pasalintas') : ''}
    ${me.isDebtor ? '<div style="color:#dc3545; font-weight:700; animation: blink 1s infinite;">' + tf('cli.my_debtor', { v: Math.abs(me.money) }) + '</div>' : ''}
    ${me.isDebtor ? '<div class="debtor-hint">' + escapeHtml(tt('game.debtorHint', 'Parduok turtą arba griauk namus. „💀 Bankrotuoju“ rasi kairiajame meniu po stalo ID ◀')) + '</div>' : ''}
`;
        const slot = document.querySelector('#myInfo .myinfo-demolish-slot');
        if (slot && demolishEl) slot.appendChild(demolishEl);

        const center1 = document.getElementById('center-1');
        let miniCardsContainer = center1.querySelector('.mini-cards-container');

        if (!miniCardsContainer) {
            miniCardsContainer = document.createElement('div');
            miniCardsContainer.className = 'mini-cards-container';
            center1.appendChild(miniCardsContainer);
        }

       if (me.properties.length > 0) {
    miniCardsContainer.innerHTML = miniCardsHtml;
        } else {
            miniCardsContainer.innerHTML = tf('cli.neturi_korteliu_2');
        }
        
        if (oldMoney !== newMoney) {
            setTimeout(() => {
                animateMoney(document.querySelector('#myInfo .player-money'), oldMoney, newMoney, 800);
            }, 50);
        }
    }
    
    const playersList = document.getElementById('playersList');
playersList.innerHTML = state.players.map(p => {
    const pHouses = p.houses ? Object.values(p.houses).reduce((a, b) => a + b, 0) : 0;
    const isLeft = p.left === true;
    const isKicked = p.kicked === true;
    const isDebtor = p.isDebtor === true;
    
    if (isLeft) {
        return '';
    }
    
    if (isKicked && p.id !== playerId) {
        return '';
    }
    
    const playerEmoji = p.emoji || '';
    return `
        <div class="player-item ${p.id === playerId ? 'me' : ''} ${state.currentTurn === p.id && !p.bankrupt && !isKicked ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''} ${isKicked ? 'left' : ''}">
            <span class="dot has-piece" style="position:relative; display:inline-flex; align-items:center; justify-content:center;">${pieceSvg(p.piece || 'pawn', p.color)}
                ${playerEmoji ? `<span class="player-emoji-list">${playerEmoji}</span>` : ''}
            </span>
            <span class="pname">${p.isBot ? '<span class="pbot">🤖 </span>' : ''}${p.name} ${p.id === playerId ? '👤' : ''}${p.disconnected ? tf('cli.offline_icon') : ((p.afkAutoMoves || 0) > 0 && !p.bankrupt ? ' <span title="AFK">💤</span>' : '')}</span>
            <span class="pmoney" style="color:${p.money < 0 ? '#dc3545' : '#000000'};">€${p.money}</span>
            <span class="picons">${pHouses > 0 ? `🏠${pHouses}` : ''}${p.inJail ? '⛓️' : ''}${p.bankrupt ? '💀' : ''}${isKicked ? '🚫' : ''}${isDebtor && !p.bankrupt ? '⚠️' : ''}${state.currentTurn === p.id && p.isActive && !p.left && !p.kicked ? '🎯' : ''}</span>
        </div>
    `;
}).filter(html => html !== '').join('');
fitPlayersList();

const isBankrupt = myPlayer && myPlayer.bankrupt;
const isLeft = myPlayer && myPlayer.left;
const isKicked = myPlayer && myPlayer.kicked;
const isDebtor = myPlayer && myPlayer.isDebtor;
isMyTurn = state.currentTurn === playerId && myPlayer && myPlayer.isActive && !myPlayer.bankrupt && !myPlayer.left && !myPlayer.kicked;

const rollBtn = document.getElementById('rollBtn');
if (rollBtn) {
    const blockedByAction = rollBtn.dataset.blockedByAction === 'true';
    
    // Kol laukiama pirkimo / taksi / statybų sprendimo – mesti negalima
    const waitingDecision = !!(state.waitingForBuy || state.taxiOffer || state.buildWindow);
    if (blockedByAction) {
        rollBtn.disabled = true;
    } else {
        rollBtn.disabled = !isMyTurn || isBankrupt || isLeft || isKicked || isDebtor || waitingDecision;
    }
}

const tradeBtn = document.getElementById('tradeBtn');
if (tradeBtn) {
    tradeBtn.disabled = isBankrupt || isLeft || isKicked;
}

document.getElementById('bankruptBtn').disabled = isBankrupt || isLeft || isKicked || !myPlayer || !myPlayer.isActive;

const jailBtn = document.getElementById('jailBtn');
if (jailBtn) {
    if (isMyTurn && !isBankrupt && !isLeft && !isKicked && !isDebtor && myPlayer && myPlayer.inJail) {
        jailBtn.style.display = 'block';
        jailBtn.disabled = false;
    } else {
        jailBtn.style.display = 'none';
        jailBtn.disabled = true;
    }
}

    // 🏚️ „Griauti“ – tik kai turi bent vieną namą; spausti galima savo eilėje arba būnant skolingam
    const demolishBtn = document.getElementById('demolishBtn');
    if (demolishBtn) {
        const hasHouses = !!(myPlayer && myPlayer.houses && Object.values(myPlayer.houses).some(v => v > 0));
        if (hasHouses && !isBankrupt && !isLeft && !isKicked) {
            demolishBtn.style.display = '';
            demolishBtn.disabled = !(isMyTurn || isDebtor);
        } else {
            demolishBtn.style.display = 'none';
            demolishBtn.disabled = true;
        }
    }

    refreshBuildButton();
    
    const centerCells = document.querySelectorAll('.center-cell');
    centerCells.forEach(cell => {
        if (cell.id === 'center-3') {
            if (isBankrupt || isLeft || isKicked) {
                cell.style.opacity = '1';
                cell.style.filter = 'none';
                cell.style.background = 'linear-gradient(145deg, #d4b896, #c4a886)';
                cell.style.pointerEvents = 'auto';
            } else {
                cell.style.opacity = '1';
                cell.style.filter = 'none';
                cell.style.background = '';
                cell.style.pointerEvents = 'auto';
            }
        } else {
            if (isBankrupt || isLeft || isKicked) {
                cell.style.opacity = '0.4';
                cell.style.filter = 'grayscale(1)';
                cell.style.pointerEvents = 'none';
                cell.style.background = 'linear-gradient(145deg, #888888, #666666)';
            } else {
                cell.style.opacity = '1';
                cell.style.filter = 'none';
                cell.style.pointerEvents = 'auto';
                cell.style.background = '';
            }
        }
    });
    
    if (isBankrupt || isLeft || isKicked) {
        document.getElementById('board').style.opacity = '0.5';
        document.getElementById('board').style.filter = 'grayscale(0.8)';
    } else {
        document.getElementById('board').style.opacity = '1';
        document.getElementById('board').style.filter = 'none';
    }
    
    updateBoard(state);
    
    autoUpdateLeaders();
    
    setTimeout(initMiniCardTooltips, 100);

    // 🆕 Jei serveris išvalė waitingForBuy – uždaryti modalą
    if (!state.waitingForBuy) {
        const buyChoice = document.getElementById('buyChoice');
        if (buyChoice && buyChoice.style.display === 'flex') {
            console.log('🆕 updateUI: serveris išvalė waitingForBuy – uždarome buyChoice');
            buyChoice.style.display = 'none';
            buyChoice.classList.remove('show');
            window.lastPendingPurchasePlayerId = null;
        }
    }
    
// 🆕 Jei laukiama pirkimo – atidaryti modalą iš naujo
    // BET ne, jei ką tik atsisakėme
    if (state.waitingForBuy && !window.buyCancelled) {
        const me = state.players.find(p => p.id === playerId);
        if (me && state.currentTurn === playerId) {
            // 🆕 APSAUGA: praleisti TIK jei lastPendingPurchasePlayerId NUSTATYTAS ir NE man
            if (window.lastPendingPurchasePlayerId && 
                window.lastPendingPurchasePlayerId !== playerId) {
                console.log('⚠️ waitingForBuy=true, bet pendingPurchase ne man – praleidžiam buyChoice');
                // 🆕 NĖRA return! Tik praleisti buyChoice
            } else {
                const field = state.board[me.position];
                if (field && field.cost > 0) {
                    const buyChoice = document.getElementById('buyChoice');
                    if (buyChoice && buyChoice.style.display !== 'flex') {
                        console.log('🆕 updateUI: atidarome buyChoice (waitingForBuy)');
                        showBuyChoice({
                            fieldId: field.id,
                            fieldName: field.name,
                            fieldCost: field.cost,
                            playerId: me.id
                        });
                    }
                }
            }
        }
    }
}   // ← updateUI pabaiga

// ============================================
// 🆕 VIDURIO LANGELIŲ PRITAIKYMAS
// ============================================
function applyCenterCells(cells) {
    if (!cells || !Array.isArray(cells)) return;
    
    cells.forEach(c => {
        const cellEl = document.getElementById('center-' + c.cell_id);
        if (!cellEl) return;
        
        // Fonas (gradientas) — per CSS kintamąjį
        if (c.bg_color && c.bg_color2) {
            cellEl.style.setProperty('--center-bg', `linear-gradient(145deg, ${c.bg_color}, ${c.bg_color2})`);
        } else if (c.bg_color) {
            cellEl.style.setProperty('--center-bg', c.bg_color);
        }
        
        // Border — per CSS kintamąjį
        if (c.border_color) {
            cellEl.style.setProperty('--center-border', c.border_color);
        }
        
        // Teksto spalva ir dydis — per CSS kintamuosius
        if (c.font_color) {
            cellEl.style.setProperty('--center-font-color', c.font_color);
        }
        if (c.font_size) {
            cellEl.style.setProperty('--center-font-size', c.font_size + 'px');
        }
        if (c.font_size_min) {
            cellEl.style.setProperty('--center-font-size-min', c.font_size_min + 'px');
        }
        if (c.font_size_max) {
            cellEl.style.setProperty('--center-font-size-max', c.font_size_max + 'px');
        }
        
        // 🆕 #myInfo elementai — vardas, pinigai, bendras tekstas
        if (c.myinfo_name_size) {
            cellEl.style.setProperty('--myinfo-name-size', c.myinfo_name_size + 'px');
        }
        if (c.myinfo_name_color) {
            cellEl.style.setProperty('--myinfo-name-color', c.myinfo_name_color);
        }
        if (c.myinfo_money_size) {
            cellEl.style.setProperty('--myinfo-money-size', c.myinfo_money_size + 'px');
        }
        if (c.myinfo_money_color) {
            cellEl.style.setProperty('--myinfo-money-color', c.myinfo_money_color);
        }
        if (c.myinfo_text_size) {
            cellEl.style.setProperty('--myinfo-text-size', c.myinfo_text_size + 'px');
        }
        if (c.myinfo_text_color) {
            cellEl.style.setProperty('--myinfo-text-color', c.myinfo_text_color);
        }
        
        // Antraštė (h4) — tekstas, spalva, dydis
        const h4 = cellEl.querySelector('h4');
        if (h4) {
            const iconPart = c.icon || '';
            const titlePart = c.title || '';
            h4.textContent = iconPart + (iconPart && titlePart ? ' ' : '') + titlePart;
            
            if (c.title_color) {
                h4.style.setProperty('--center-title-color', c.title_color);
            }
            if (c.title_size) {
                h4.style.setProperty('--center-title-size', c.title_size + 'px');
            }
            if (c.title_size_min) {
                h4.style.setProperty('--center-title-size-min', c.title_size_min + 'px');
            }
            if (c.title_size_max) {
                h4.style.setProperty('--center-title-size-max', c.title_size_max + 'px');
            }
        }
    });
}

// ============================================
// LENTOS ATNAUJINIMAS
// ============================================

function updateBoard(state) {
    const boardData = state.board;
    
    boardData.forEach((field, index) => {
        const cell = document.getElementById(`cell-${index}`);
        if (!cell) return;
        
        // 🆕 IŠSAUGOTI seną innerHTML — kad neperpieštų, jei nesikeitė
        const oldHTML = cell.innerHTML;
        
        const playersHere = state.players.filter(p => p.position === index && p.isActive && !p.bankrupt && !p.left && !p.kicked);
        
        const owner = state.players.find(p => p.properties.includes(index) && !p.bankrupt && !p.kicked);
        let topBarHtml = '';
        if (owner) {
            topBarHtml = `<span class="cell-owner" style="background:${owner.color}"></span>`;
        }
        
        let html = `<div class="cell-top-bar">${topBarHtml}<span class="cell-number">${index}</span></div>`;

        if (field.icon) {
            html += FX3_CELL_ICONS[field.id] ? `<span class="cell-bg-icon has-svg">${FX3_CELL_ICONS[field.id]}</span>` : `<span class="cell-bg-icon">${field.icon}</span>`;
        }

        // 🆕 Naudoti vertimą pagal kalbą, jei yra
        const translationKey = `cell.${field.id}.name`;
        const translated = t(translationKey);
        const cellName = (translated && translated !== translationKey) ? translated : (field.name || index);
        html += `<span class="cell-name">${cellName}</span>`;

        // 🆕 PIRMIAUSIA specialūs langeliai (su fiksuotu tekstu)
        if (field.id === 4) {          // HORNY RP
            html += `<span class="cell-cost" style="color:#28a745; font-weight:900;">€200</span>`;
        } else if (field.id === 5) {   // VMI
            html += `<span class="cell-cost" style="color:#dc3545; font-weight:900;">€100</span>`;
        } else if (field.id === 13) {  // Ligoninė
            html += `<span class="cell-cost" style="color:#dc3545; font-weight:900;">€50</span>`;
        } else if (field.id === 21) {  // Latrų baras
            html += `<span class="cell-cost" style="color:#dc3545; font-weight:900;">€10</span>`;
        } else if (field.id === 50) {  // Gimtadienis
            html += `<span class="cell-cost" style="color:#28a745; font-weight:900;">€200</span>`;
        } else if (field.cost > 0) {
            // 🆕 Namai / kaina (TIK property / service)
            if (owner && owner.houses && owner.houses[index] && owner.houses[index] > 0) {
                const houseCount = owner.houses[index];
                let houseIcons = '';
                
                const isNewHouse = window.newHouseAnimations && window.newHouseAnimations[index];
                const isNewHotel = houseCount >= 5 && isNewHouse;
                
                if (houseCount >= 5) {
                    houseIcons = `<span class="${isNewHotel ? 'new-hotel' : ''}">🏨</span>`;
                } else {
                    for (let i = 0; i < Math.min(houseCount, 4); i++) {
                        if (i === houseCount - 1 && isNewHouse) {
                            houseIcons += `<span class="new-house">🏠</span>`;
                        } else {
                            houseIcons += '🏠';
                        }
                    }
                }
                html += `<span class="cell-cost" style="font-size:14px; display:block; line-height:1.2;">${houseIcons}</span>`;
                
                if (isNewHouse) {
                    setTimeout(() => {
                        if (window.newHouseAnimations) {
                            delete window.newHouseAnimations[index];
                        }
                    }, 1000);
                }
            } else {
                html += `<span class="cell-cost">€${field.cost}</span>`;
            }
        }
        
        // 🆕 IŠIMTA – figūrėlės bus atskirai per updatePlayersOnCell()
        // if (playersHere.length > 0) {
        //     html += `<div class="players-on-cell" data-count="${playersHere.length}">`;
        //     playersHere.forEach(p => {
        //         const isAnimating = window.animatingPlayers && window.animatingPlayers.includes(p.id);
        //         const displayStyle = isAnimating ? 'display:none;' : '';
        //         const emoji = p.emoji || '';
        //         const emojiClass = emoji ? 'dancing' : '';
        //         html += `<span class="player-dot" style="background:${p.color};${displayStyle}" data-player-id="${p.id}">`;
        //         if (emoji) {
        //             html += `<span class="player-emoji ${emojiClass}">${emoji}</span>`;
        //         }
        //         html += `</span>`;
        //     });
        //     html += `</div>`;
        // }
        
         // 🆕 PERPIEŠTI TIK JEI PASIKĖITĖ
        if (oldHTML !== html) {
            // 🚶 Einanti figūrėlė neturi dingti, kai langelis persipiešia
            const walkerHolder = cell.querySelector(':scope > .walker-holder');
            cell.innerHTML = html;
            if (walkerHolder) cell.appendChild(walkerHolder);
        }
        
        // 🆕 FIGŪRĖLIŲ ATNAUJINIMAS (ATSKIRAI nuo langelio turinio)
        updatePlayersOnCell(cell, playersHere);
        
        // 🆕 KLASES PERPIEŠTI TIK JEI PASIKĖITĖ
        const newClassName = 'cell' +
            (field.type === 'start' ? ' start corner' : '') +
            (field.type === 'jail' ? ' jail corner' : '') +
            (field.type === 'parking' ? ' parking corner' : '') +
            (field.type === 'taxi' ? ' taxi corner' : '') +
            (field.type === 'go-to-jail' ? ' go-to-jail corner' : '') +
            (field.type === 'property' ? ' property' : '') +
            (field.type === 'service1' ? ' service1' : '') +
            (field.type === 'service2' ? ' service2' : '') +
            (field.type === 'service3' ? ' service3' : '') +
            (field.id !== 0 && field.id !== 16 && field.id !== 26 && field.id !== 42 ? ' edge' : '');
        
        // Laikinos klasės (figūrėlės, švytėjimas, taksi pasirinkimas) neturi dingti
        const keepCls = ['has-pieces', 'has-walker', 'highlight-yellow', 'taxi-target', 'taxi-forbidden', 'taxi-selected']
            .filter(c => cell.classList.contains(c));
        if (playersHere.length > 0 && !keepCls.includes('has-pieces')) keepCls.push('has-pieces');
        if (playersHere.length === 0) { const i = keepCls.indexOf('has-pieces'); if (i >= 0) keepCls.splice(i, 1); }
        const fullCls = keepCls.length ? newClassName + ' ' + keepCls.join(' ') : newClassName;
        if (cell.className !== fullCls) {
            cell.className = fullCls;
        }
        
        // 🆕 VISIEMS langeliams su color — nustatyti data-group ir --group-color
        if (field.color) {
            const currentGroup = cell.getAttribute('data-group');
            if (currentGroup !== field.color) {
                cell.setAttribute('data-group', field.color);
                cell.style.setProperty('--group-color', field.color);
                cell.style.setProperty('--property-color', field.color);
            }
        } else {
            if (cell.hasAttribute('data-group')) {
                cell.removeAttribute('data-group');
                cell.style.removeProperty('--group-color');
                cell.style.removeProperty('--property-color');
            }
        }

        // 🆕 Antra spalva (gradientui)
        if (field.color2) {
            cell.style.setProperty('--group-color2', field.color2);
        } else {
            cell.style.removeProperty('--group-color2');
        }

        // 🆕 Owner logika TIK property tipo langeliams
        if (field.color && field.type === 'property') {
            if (owner) {
                cell.style.setProperty('--owner-color', owner.color || '#ffd700');
                
                // 🆕 has-owner klasė – kai turi BENT 1 sklypą
                if (!cell.classList.contains('has-owner')) {
                    cell.classList.add('has-owner');
                }
                
                const group = COLOR_GROUPS[field.color] || [];
                if (group.length > 0) {
                    const hasAll = group.every(id => owner.properties.includes(id));
                    if (hasAll) {
                        if (!cell.classList.contains('full-group')) {
                            cell.classList.add('full-group');
                        }
                    } else {
                        if (cell.classList.contains('full-group')) {
                            cell.classList.remove('full-group');
                        }
                    }
                }
            } else {
                if (cell.classList.contains('has-owner')) {
                    cell.classList.remove('has-owner');
                }
                if (cell.classList.contains('full-group')) {
                    cell.classList.remove('full-group');
                }
                cell.style.removeProperty('--owner-color');
            }
        } else {
            if (cell.classList.contains('has-owner')) {
                cell.classList.remove('has-owner');
            }
            if (cell.classList.contains('full-group')) {
                cell.classList.remove('full-group');
            }
            cell.style.removeProperty('--owner-color');
        }
    });
}         // ← 🆕 IR ŠITĄ (funkcijos pabaiga)

// 🆕 Figūrėlių atnaujinimas ATSKIRAI nuo langelio turinio
function sizePiecesOnCell(cell, div, n) {
    const w = cell.clientWidth || 40, h = cell.clientHeight || 40;
    const topRow = !!cell.closest('.row-top');
    const availW = w * 0.94;
    const availH = h * (topRow ? 0.70 : 0.84);   // virš spalvotos juostos / nuo apačios
    let size, cols = 1, rows = 1;
    if (n <= 1) {
        const m = Math.min(w, h);
        // Viena figūrėlė siaurame (telefono) langelyje gali kiek išlįsti, kad nebūtų mažytė
        size = m < 30 ? Math.min(Math.max(w, h) * 0.5, m * 2.2) : Math.min(availW, availH);
    } else {
        // Kelios figūrėlės – visos turi tilpti langelyje: renkamės eilučių skaičių, kuris duoda didžiausias figūrėles
        size = 0;
        for (let r = 1; r <= Math.min(3, n); r++) {
            const c = Math.ceil(n / r);
            const sW = availW / (1 + 0.64 * (c - 1));   // greta stovinčios šiek tiek persidengia
            const sH = availH / (1 + 0.62 * (r - 1));   // galinė eilė – šiek tiek aukščiau
            const sz = Math.min(sW, sH);
            if (sz > size + 0.5) { size = sz; cols = c; rows = r; }
        }
    }
    size = Math.max(9, Math.min(76, size));
    div.style.setProperty('--ps', size.toFixed(1) + 'px');
    div.style.setProperty('--pw', (cols * size * 0.64 + 1).toFixed(1) + 'px');
    div.classList.toggle('multi', n > 1);
    cell.classList.toggle('has-pieces', n > 0);
}

function updatePlayersOnCell(cell, playersHere) {
    let playersDiv = cell.querySelector('.players-on-cell');
    
    // 🆕 Jei nėra figūrėlių — pašalinti players-on-cell
    if (playersHere.length === 0) {
        if (playersDiv) playersDiv.remove();
        cell.classList.remove('has-pieces');
        return;
    }
    
    // 🆕 Jei nėra players-on-cell — sukurti
    if (!playersDiv) {
        playersDiv = document.createElement('div');
        playersDiv.className = 'players-on-cell';
        cell.appendChild(playersDiv);
    }
    
    // 🎲 Figūrėlės stovi ANT langelio: dydis pagal langelį ir figūrėlių skaičių
    sizePiecesOnCell(cell, playersDiv, playersHere.length);

    // 🆕 Atnaujinti data-count
    const currentCount = playersDiv.getAttribute('data-count');
    if (currentCount !== String(playersHere.length)) {
        playersDiv.setAttribute('data-count', playersHere.length);
    }
    
    // 🆕 Patikrinti, ar figūrėlių sąrašas pasikeitė
    const existingDots = playersDiv.querySelectorAll('.player-dot');
    const existingIds = Array.from(existingDots).map(d => d.dataset.playerId);
    const newIds = playersHere.map(p => String(p.id));
    
    const sameCount = existingIds.length === newIds.length;
    const sameIds = sameCount && newIds.every(id => existingIds.includes(id));
    
    // 🆕 Jei figūrėlių skaičius/tapatybė pasikeitė — perpiešti
    if (!sameIds) {
        playersDiv.innerHTML = '';
        playersHere.forEach(p => {
            const dot = createPlayerDot(p);
            playersDiv.appendChild(dot);
        });
        return;
    }
    
    // 🆕 Jei figūrėlės tos pačios — tik atnaujinti jų būseną
    playersHere.forEach(p => {
        const dot = playersDiv.querySelector(`.player-dot[data-player-id="${p.id}"]`);
        if (!dot) return;
        
        const isAnimating = window.animatingPlayers && window.animatingPlayers.includes(p.id);
        const displayStyle = isAnimating ? 'none' : '';
        
        if (dot.style.display !== displayStyle) {
            dot.style.display = displayStyle;
        }
    });
}

// 🆕 Sukurti player-dot elementą
function createPlayerDot(p) {
    const isAnimating = window.animatingPlayers && window.animatingPlayers.includes(p.id);
    const emoji = p.emoji || '';
    const emojiClass = emoji ? 'dancing' : '';
    
    const dot = document.createElement('span');
    dot.className = 'player-dot has-piece';
    dot.style.background = p.color;
    if (isAnimating) dot.style.display = 'none';
    dot.dataset.playerId = p.id;
    // 🎲 Figūrėlė žaidėjo spalva (pėstininkas, puodelis, obuolys…)
    dot.innerHTML = pieceSolid(p.piece || 'pawn', p.color);
    
    if (emoji) {
        const emojiSpan = document.createElement('span');
        emojiSpan.className = `player-emoji ${emojiClass}`;
        emojiSpan.textContent = emoji;
        dot.appendChild(emojiSpan);
    }
    
    return dot;
}

// ============================================
// 🎲 FIGŪRĖLĖS (SVG, žaidėjo spalva)
// ============================================
const PIECE_TYPES = ['pawn', 'cup', 'lamp', 'cat', 'knight', 'piggy', 'basketball', 'tractor'];
const PIECE_NAMES = {
    pawn: ['piece.pawn', 'Pėstininkas'], cup: ['piece.cup', 'Kavos puodelis'], lamp: ['piece.lamp', 'Stalinė lempa'],
    cat: ['piece.cat', 'Katinas'], knight: ['piece.knight', 'Žirgas'], piggy: ['piece.piggy', 'Taupyklė'],
    basketball: ['piece.basketball', 'Krepšinio kamuolys'], tractor: ['piece.tractor', 'Traktorius']
};
function pieceShade(hex, amt) {
    // amt < 0 – tamsiau, > 0 – šviesiau
    let h = String(hex || '#888').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) h = '888888';
    const n = parseInt(h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function pieceSvg(type, color) {
    const c = /^#[0-9a-f]{3,8}$/i.test(String(color || '')) ? color : '#888888';
    const d = pieceShade(c, -0.38), dd = pieceShade(c, -0.6), l = pieceShade(c, 0.45);
    // Šviesumas – kad akys / raštai matytųsi ir ant labai tamsios ar labai šviesios spalvos
    const hx = c.replace('#', '').padEnd(6, '0').slice(0, 6);
    const lum = (0.299 * parseInt(hx.slice(0, 2), 16) + 0.587 * parseInt(hx.slice(2, 4), 16) + 0.114 * parseInt(hx.slice(4, 6), 16)) / 255;
    const eye = lum < 0.25 ? '#ffd23f' : '#111';
    const patch = lum > 0.85 ? '#555' : c;
    const seam = lum < 0.25 ? '#9a9a9a' : dd;
    const shadow = '<ellipse cx="50" cy="93" rx="30" ry="6" fill="rgba(0,0,0,0.28)"/>';
    const shine = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="0.45"/>`;
    let body = '';
    switch (type) {
        case 'cup':
            body = `${shadow}
                <ellipse cx="50" cy="86" rx="38" ry="8" fill="${d}"/><ellipse cx="50" cy="84" rx="36" ry="7" fill="${l}"/>
                <path d="M68 42 q18 0 18 16 q0 16 -20 18" fill="none" stroke="${d}" stroke-width="7" stroke-linecap="round"/>
                <path d="M22 34 h50 l-5 44 q-1 6 -7 6 h-26 q-6 0 -7 -6 z" fill="${c}"/>
                <path d="M22 34 h50 l-1 8 h-48 z" fill="${d}" opacity="0.5"/>
                <ellipse cx="47" cy="34" rx="25" ry="6" fill="${dd}"/><ellipse cx="47" cy="34" rx="21" ry="4" fill="#5b3a1e"/>
                ${shine(33, 55, 4, 14)}
                <path d="M38 24 q-5 -6 0 -12 M50 24 q-5 -7 0 -14 M62 24 q-5 -6 0 -12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
            break;
        case 'lamp':
            body = `${shadow}
                <path d="M54 62 L84 92 L20 92 z" fill="rgba(255,230,120,0.28)"/>
                <ellipse cx="34" cy="88" rx="22" ry="6" fill="${dd}"/>
                <path d="M14 88 q0 -7 8 -8 h24 q8 1 8 8 z" fill="${d}"/>
                <path d="M34 80 L26 48 L56 26" fill="none" stroke="#9aa0a6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M34 80 L26 48 L56 26" fill="none" stroke="#e8eaed" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
                <circle cx="26" cy="48" r="4" fill="#5f6368"/><circle cx="56" cy="26" r="4" fill="#5f6368"/>
                <path d="M50 16 L80 38 L66 58 L40 30 z" fill="${c}"/>
                <path d="M50 16 L80 38 L76 44 L46 21 z" fill="${l}" opacity="0.55"/>
                <ellipse cx="62" cy="50" rx="12" ry="5" transform="rotate(38 62 50)" fill="#fff6c4"/>
                <ellipse cx="62" cy="50" rx="7" ry="3" transform="rotate(38 62 50)" fill="#ffe066"/>`;
            break;
        case 'cat':
            // Sėdi / stovi – kas kelias sekundes keičia pozą
            body = `${shadow}
                <g class="tok-cat-sit">
                    <path d="M70 80 q22 -2 16 -22 q-4 -10 -10 -4 q6 4 2 12 q-4 8 -14 8 z" fill="${d}"/>
                    <path d="M28 88 q-6 -30 10 -46 h24 q16 16 10 46 z" fill="${c}"/>
                    <path d="M40 88 v-14 M60 88 v-14" stroke="${d}" stroke-width="4" stroke-linecap="round"/>
                    <circle cx="50" cy="34" r="17" fill="${c}"/>
                    <path d="M35 26 l-2 -18 l14 10 z M65 26 l2 -18 l-14 10 z" fill="${c}"/>
                    <path d="M37 23 l-1 -9 l7 5 z M63 23 l1 -9 l-7 5 z" fill="${l}"/>
                    <ellipse cx="44" cy="33" rx="2.6" ry="3.6" fill="${eye}"/><ellipse cx="56" cy="33" rx="2.6" ry="3.6" fill="${eye}"/>
                    <path d="M47 40 l3 3 l3 -3 z" fill="#e88"/>
                    <path d="M36 40 h-10 M36 43 l-9 3 M64 40 h10 M64 43 l9 3" stroke="#fff" stroke-width="1.4" opacity="0.8"/>
                    ${shine(40, 60, 4, 10)}
                </g>
                <g class="tok-cat-stand">
                    <path d="M76 56 q14 -6 10 -26 q-1 -6 -6 -4 q4 8 0 16 q-4 8 -10 8 z" fill="${d}"/>
                    <rect x="22" y="48" width="56" height="24" rx="12" fill="${c}"/>
                    <path d="M28 70 v18 M40 70 v18 M62 70 v18 M72 70 v18" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
                    <circle cx="26" cy="44" r="14" fill="${c}"/>
                    <path d="M15 37 l-2 -15 l11 8 z M34 35 l3 -14 l-12 7 z" fill="${c}"/>
                    <ellipse cx="21" cy="43" rx="2.2" ry="3.2" fill="${eye}"/><ellipse cx="31" cy="43" rx="2.2" ry="3.2" fill="${eye}"/>
                    <path d="M24 49 l2 2 l2 -2 z" fill="#e88"/>
                    ${shine(46, 54, 12, 3)}
                </g>`;
            break;
        case 'knight':
            body = `${shadow}
                <ellipse cx="50" cy="86" rx="32" ry="7" fill="${d}"/>
                <path d="M20 86 q0 -8 6 -10 h48 q6 2 6 10 z" fill="${c}"/>
                <path d="M30 76 q-2 -18 8 -28 q-14 2 -18 -6 q-2 -8 6 -14 q8 -8 18 -14 l4 -8 l4 8 q20 4 22 30 q2 18 -6 32 z" fill="${c}"/>
                <path d="M62 22 q18 8 14 36 q-2 10 -6 18 h-6 q8 -14 6 -30 q-2 -16 -12 -22 z" fill="${d}" opacity="0.55"/>
                <circle cx="42" cy="30" r="3" fill="${eye}"/>
                <path d="M22 38 q-3 -3 0 -6" stroke="${dd}" stroke-width="2" fill="none"/>
                <path d="M50 14 q10 2 16 10" stroke="${d}" stroke-width="3" fill="none"/>
                ${shine(40, 54, 4, 12)}`;
            break;
        case 'piggy':
            // Atidaryta, jau tuščia taupyklė
            body = `${shadow}
                <path d="M28 82 v8 M40 84 v8 M60 84 v8 M72 82 v8" stroke="${d}" stroke-width="8" stroke-linecap="round"/>
                <ellipse cx="50" cy="60" rx="38" ry="28" fill="${c}"/>
                <path d="M84 52 q10 -6 6 6 q-2 6 6 6" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
                <ellipse cx="16" cy="60" rx="8" ry="10" fill="${l}"/><circle cx="14" cy="57" r="1.8" fill="${dd}"/><circle cx="14" cy="63" r="1.8" fill="${dd}"/>
                <path d="M30 34 l4 -14 l10 12 z" fill="${d}"/>
                <circle cx="30" cy="50" r="3" fill="${eye}"/>
                <path d="M40 46 a24 18 0 0 1 36 4 l-2 14 a22 16 0 0 0 -32 -4 z" fill="${dd}"/>
                <path d="M42 46 q16 -26 36 -4" fill="${l}" stroke="${d}" stroke-width="2"/>
                <rect x="52" y="30" width="16" height="3" rx="1.5" fill="${dd}" transform="rotate(-18 60 31)"/>
                ${shine(40, 72, 10, 4)}`;
            break;
        case 'basketball':
            body = `${shadow}
                <circle cx="50" cy="50" r="38" fill="${c}"/>
                <path d="M50 12 v76 M12 50 h76 M24 22 q18 28 0 56 M76 22 q-18 28 0 56" fill="none" stroke="${seam}" stroke-width="3.2"/>
                <circle cx="50" cy="50" r="38" fill="none" stroke="${seam}" stroke-width="2"/>
                ${shine(36, 32, 10, 6)}`;
            break;
        case 'tractor':
            body = `${shadow}<g transform="translate(-12 -17) scale(1.2)">
                <rect x="58" y="44" width="5" height="16" rx="2" fill="#555"/>
                <path d="M57 44 q3 -6 8 -4" fill="none" stroke="#777" stroke-width="2"/>
                <path d="M30 34 h22 v26 h-26 z" fill="${d}"/>
                <rect x="33" y="37" width="16" height="15" rx="2" fill="#bfe3ff"/>
                <path d="M33 37 h16 v4 h-16 z" fill="#fff" opacity="0.5"/>
                <path d="M22 60 h56 q8 0 8 8 v6 h-66 v-8 q0 -6 2 -6 z" fill="${c}"/>
                <path d="M52 52 h22 q6 0 6 8 h-28 z" fill="${c}"/>
                <rect x="26" y="30" width="30" height="5" rx="2" fill="${dd}"/>
                ${shine(64, 56, 8, 2)}
                <circle cx="32" cy="74" r="17" fill="#2b2b2b"/>
                <circle cx="32" cy="74" r="12" fill="#3a3a3a" stroke="#1d1d1d" stroke-width="2" stroke-dasharray="3 3"/>
                <circle cx="32" cy="74" r="6" fill="${l}"/>
                <circle cx="74" cy="80" r="10" fill="#2b2b2b"/>
                <circle cx="74" cy="80" r="4" fill="${l}"/></g>`;
            break;
        default: // pawn
            body = `${shadow}
                <ellipse cx="50" cy="86" rx="30" ry="7" fill="${d}"/>
                <path d="M22 86 q0 -9 8 -11 h40 q8 2 8 11 z" fill="${c}"/>
                <path d="M34 75 q4 -18 8 -30 h16 q4 12 8 30 z" fill="${c}"/>
                <ellipse cx="50" cy="45" rx="16" ry="5" fill="${d}"/>
                <circle cx="50" cy="28" r="15" fill="${c}"/>
                <path d="M58 46 q4 14 7 29 h-6 q-2 -14 -6 -29 z" fill="${d}" opacity="0.45"/>
                ${shine(44, 22, 5, 7)}${shine(42, 62, 3, 9)}`;
    }
    return `<svg class="tok tok-${type}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

// 🧱 Tūrinė figūrėlė ant lentos: priekis + storio sluoksniai + nugarėlė.
// 2D režime matosi tik priekis; 3D / 3D+ – figūrėlė su tikru storiu ir šešėliu ant langelio.
const PIECE_LAYERS = 9;
function pieceSolid(type, color) {
    const c = /^#[0-9a-f]{3,8}$/i.test(String(color || '')) ? color : '#888888';
    const front = pieceSvg(type, c);
    const noShadow = front.replace(/<ellipse cx="50" cy="93" rx="30" ry="6" fill="rgba\(0,0,0,0.28\)"\/>/, '');
    // Storio sluoksnis – tas pats siluetas viena tamsesne spalva (be blizgesių ir permatomų detalių)
    const edge = pieceShade(c, -0.45);
    const sil = noShadow
        .replace(/<(path|ellipse|circle|rect|polygon)\b[^>]*\bopacity="[^"]*"[^>]*\/>/g, '')
        .replace(/fill="rgba\([^"]*\)"/g, 'fill="none"')
        .replace(/fill="(?!none)[^"]*"/g, `fill="${edge}"`)
        .replace(/stroke="(?!none)[^"]*"/g, `stroke="${edge}"`)
        .replace('<svg class="tok ', '<svg class="tok tok-layer ');
    const half = (PIECE_LAYERS + 1) / 2;
    let layers = '';
    for (let i = 1; i <= PIECE_LAYERS; i++) layers += sil.replace('<svg ', `<svg style="--k:${(half - i).toFixed(2)}" `);
    const back = '';   // nugarėlės su piešiniu nebėra – atrodė kaip dviguba figūrėlė
    const frontFace = noShadow.replace('<svg class="tok ', `<svg style="--k:${half.toFixed(2)}" class="tok tok-front `);
    return `<span class="tok-floor"></span><span class="tok3d"><span class="tok3d-in">${back}${layers}${frontFace}</span><span class="tok-flat">${front}</span></span>`;
}

// 🛡️ Saugus teksto ir spalvos įdėjimas į HTML
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

function safeColor(value, fallback = '#888888') {
    return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(value || '')) ? value : fallback;
}

function addChatMessage(data) {
    data = Object.assign({}, data, {
        player: escapeHtml(data && data.player),
        message: escapeHtml(data && data.message),
        color: safeColor(data && data.color)
    });
    const time = new Date(data.timestamp).toLocaleTimeString();
    
    const container = document.getElementById('chatMessages');
    if (container) {
        const isBot = data.isBot === true;
        const botIcon = isBot ? '🤖 ' : '';
        
        container.innerHTML += `
            <div style="color:#3d2b1f; display:flex; align-items:center; gap:4px; margin-bottom:2px; ${isBot ? 'background:rgba(111,66,193,0.1); padding:2px 4px; border-radius:4px;' : ''}">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${data.color}; border:1px solid rgba(0,0,0,0.2); flex-shrink:0;"></span>
                <b>${botIcon}${data.player}:</b> 
                <span>${data.message}</span>
                <span style="font-size:7px; color:rgba(61,43,31,0.4); margin-left:auto;">${time}</span>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
    }
    
    const waitingContainer = document.getElementById('waitingChatMessages');
    if (waitingContainer) {
        const isBot = data.isBot === true;
        const botIcon = isBot ? '🤖 ' : '';
        
        waitingContainer.innerHTML += `
            <div style="color:#fff; display:flex; align-items:center; gap:4px; margin-bottom:4px; ${isBot ? 'background:rgba(111,66,193,0.2); padding:2px 4px; border-radius:4px;' : ''}">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${data.color}; border:1px solid rgba(255,255,255,0.5); flex-shrink:0;"></span>
                <b style="color:${data.color};">${botIcon}${data.player}:</b> 
                <span style="color:#fff;">${data.message}</span>
                <span style="font-size:9px; color:rgba(255,255,255,0.5); margin-left:auto;">${time}</span>
            </div>
        `;
        waitingContainer.scrollTop = waitingContainer.scrollHeight;
    }
}

let journalCount = 0;

// 🆕 Anti-dublikatas
let lastJournalMessage = '';
let lastJournalTime = 0;

function addJournal(msg) {
    const container = document.getElementById('journal');
    if (!container) return;
    
    // 🆕 Anti-dublikatas (500ms)
    const now = Date.now();
    if (msg === lastJournalMessage && now - lastJournalTime < 500) {
        console.log('⚠️ Dublikatas praleistas:', msg);
        return;
    }
    lastJournalMessage = msg;
    lastJournalTime = now;
    
    journalCount++;
    const time = new Date().toLocaleTimeString();
    
    const item = document.createElement('div');
    item.className = 'journal-item';
    item.innerHTML = `
        <span class="jnum">#${journalCount}</span>
        <span class="jtext">${msg}</span>
        <span class="jtime">${time}</span>
    `;
    
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
    
    try {
        const history = JSON.parse(localStorage.getItem('bancrupt_journal') || '[]');
        history.push({ num: journalCount, text: msg, time: time });
        localStorage.setItem('bancrupt_journal', JSON.stringify(history));
    } catch (e) {
        console.warn('⚠️ Nepavyko išsaugoti žurnalo:', e);
    }
    
    while (container.children.length > 500) {
        container.removeChild(container.firstChild);
    }
}

function loadJournalFromStorage() {
    journalCount = 0;
    
    try {
        const history = JSON.parse(localStorage.getItem('bancrupt_journal') || '[]');
        const container = document.getElementById('journal');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (history.length === 0) {
            console.log('📜 Žurnalas tuščias');
            return;
        }
        
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'journal-item';
            div.innerHTML = `
                <span class="jnum">#${item.num}</span>
                <span class="jtext">${item.text}</span>
                <span class="jtime">${item.time}</span>
            `;
            container.appendChild(div);
            journalCount = item.num;
        });
        
        container.scrollTop = container.scrollHeight;
        console.log(`📜 Žurnalas užkrautas: ${history.length} įrašų`);
    } catch (e) {
        console.warn('⚠️ Nepavyko užkrauti žurnalo:', e);
        journalCount = 0;
    }
}

// 🆕 Išvalyti chat
function clearChat() {
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
    
    const waitingChatContainer = document.getElementById('waitingChatMessages');
    if (waitingChatContainer) {
        waitingChatContainer.innerHTML = '';
    }
    
    console.log('💬 Chat išvalytas');
}

function clearJournal() {
    try {
        localStorage.removeItem('bancrupt_journal');
        const container = document.getElementById('journal');
        if (container) container.innerHTML = '';
        journalCount = 0;
        console.log('📜 Žurnalas išvalytas');
    } catch (e) {
        console.warn('⚠️ Nepavyko išvalyti žurnalo:', e);
        journalCount = 0;
    }
}

function getCellMessage(cellId, type, data = {}) {
    // 🌐 Langelių pranešimai – iš lang/*.json (raktai cellmsg.<langelis>.<tipas>)
    const key = `cellmsg.${cellId}.${type}`;
    let msg = t(key);
    if (!msg || msg === key) return '';
    
    for (const [key, value] of Object.entries(data)) {
        msg = msg.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    
    return msg;
}

function getTranslatedMessage(key, data = {}) {
    if (!key) return '';
    
    let text = t(key);
    if (!text || text === key) {
        console.warn('⚠️ Nėra vertimo:', key);
        return key;
    }
    
    return tf(key, data);   // tf() – su duomenimis ir langelių pavadinimais pasirinkta kalba
}

function getCountSuffix(count) {
    // Galūnė pagal kalbą: „objekt{countSuffix}“ / „propert{countSuffix}“ / „объект{countSuffix}“
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'lt';
    const n = Math.abs(count) % 100, n1 = n % 10;
    if (lang === 'en') return count === 1 ? 'y' : 'ies';
    if (lang === 'ru') return (n1 === 1 && n !== 11) ? '' : (n1 >= 2 && n1 <= 4 && (n < 12 || n > 14)) ? 'а' : 'ов';
    if (lang === 'lt') return (n1 === 1 && n !== 11) ? 'as' : (n1 === 0 || (n >= 11 && n <= 19)) ? 'ų' : 'ai';
    return '';
}

let cellActionTimeout = null;

// ============================================
// 📢 5 LANGELIO IŠŠOKANTYS PRANEŠIMAI (EILĖ)
// Pranešimai rodomi vienas po kito, kiekvienas ~3 s,
// po jų vėl matosi „Dabar eina / Kitas“.
// ============================================
const CELL5_DEFAULT_DURATION = 3000;
const cell5Queue = [];
let cell5Current = null;
let cell5Recent = [];
let cell5WaitTimer = null;
let lastTurnPopupId = null;

function tt(key, fallback) {
    const v = (typeof t === 'function') ? t(key) : key;
    return (!v || v === key) ? fallback : v;
}

function cell5IsLight(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    if ([r, g, b].some(isNaN)) return false;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

function cell5IsDark(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    if ([r, g, b].some(isNaN)) return false;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 70;
}

function cell5PlayerChip(player, fallbackName) {
    const name = escapeHtml(player ? player.name : (fallbackName || '?'));
    const color = safeColor(player && player.color, '#6c757d');
    const light = cell5IsLight(color);
    return `<span class="cell5-chip" style="background:${color};${light ? 'color:#1a1a1a;text-shadow:none;' : ''}">${name}</span>`;
}

function cell5FindPlayer(idOrName) {
    if (!gameState || !gameState.players) return null;
    return gameState.players.find(p => p.id === idOrName) ||
           gameState.players.find(p => p.name === idOrName) || null;
}

function isBuyCardVisible() {
    const card = document.getElementById('buyCard');
    return !!(card && card.style.display !== 'none' && card.style.display !== '');
}

// item: { type, header, html, text, duration, blockRoll, tag, dedupeKey }
function cell5Enqueue(item) {
    if (!item) return;
    const key = item.dedupeKey || item.text || item.html;
    const now = Date.now();
    cell5Recent = cell5Recent.filter(r => now - r.t < 5000);
    if (key && cell5Recent.some(r => r.key === key)) return;
    if (key) cell5Recent.push({ key, t: now });

    // Naujas eilės pranešimas pakeičia dar neparodytą seną
    if (item.tag) {
        for (let i = cell5Queue.length - 1; i >= 0; i--) {
            if (cell5Queue[i].tag === item.tag) cell5Queue.splice(i, 1);
        }
    }
    if (item.priority || item.tag === 'turn') {
        // 🎯 Eilės pranešimas – rodom kuo greičiau: į eilės priekį
        cell5Queue.unshift(item);
        // Mano eilė: pirkimo rezultato kortelė (ne laukimas) gali užleisti vietą
        const card = document.getElementById('buyCard');
        if (item.priority && card && isBuyCardVisible() && !card.classList.contains('pending')) hideBuyCard();
        // Dabartinį pranešimą trumpinam (bet leidžiam jį matyti bent ~1,2 s)
        if (cell5Current && cell5Current.tag !== 'turn') {
            const left = Math.max(0, 1200 - (Date.now() - (cell5Current.shownAt || 0)));
            if (cellActionTimeout) clearTimeout(cellActionTimeout);
            cellActionTimeout = setTimeout(() => { cellActionTimeout = null; cell5Finish(); }, left);
        }
    } else {
        cell5Queue.push(item);
    }
    cell5Next();
}

// Kai metu kauliukus – „TAVO EILĖ“ nebereikalingas
function cell5DismissMyTurn() {
    for (let i = cell5Queue.length - 1; i >= 0; i--) {
        if (cell5Queue[i].type === 'turn-mine') cell5Queue.splice(i, 1);
    }
    if (cell5Current && cell5Current.type === 'turn-mine') hideCellAction();
}

function cell5Next() {
    if (cell5Current || cell5Queue.length === 0) return;

    // Kol rodoma pirkimo kortelė – laukiam
    if (isBuyCardVisible()) {
        if (!cell5WaitTimer) {
            cell5WaitTimer = setTimeout(() => { cell5WaitTimer = null; cell5Next(); }, 300);
        }
        return;
    }

    const item = cell5Queue.shift();
    item.shownAt = Date.now();
    cell5Current = item;
    cell5Render(item);

    let duration = item.duration || CELL5_DEFAULT_DURATION;
    // Jei susikaupė daug pranešimų – rodom trumpiau, kad nevėluotų
    if (cell5Queue.length >= 3) duration = Math.min(duration, 1500);

    cellActionTimeout = setTimeout(() => {
        cellActionTimeout = null;
        cell5Finish();
    }, duration);
}

function cell5Render(item) {
    const box = document.getElementById('cellActionInfo');
    const header = document.getElementById('cellActionHeader');
    const body = document.getElementById('cellActionBody');
    if (!box || !header || !body) return;

    const styles = {
        info:   { header: tt('game.cellActionInfo', '📢 PRANEŠIMAS'), color: '#1a6b3c' },
        rent:   { header: tt('game.cellActionRent', '💰 NUOMA'), color: '#28a745' },
        tax:    { header: tt('game.cellActionTax', '💸 MOKESČIAI'), color: '#dc3545' },
        visit:  { header: tt('game.cellActionVisit', '🏠 ATVYKIMAS'), color: '#17a2b8' },
        chance: { header: tt('game.cellActionChance', '🎲 ŠANSAS'), color: '#e0a800' },
        start:  { header: tt('game.popup.start', '🏁 START'), color: '#28a745' },
        jail:   { header: tt('game.popup.jail', '⛓️ KALĖJIMAS'), color: '#6c757d' },
        bankrupt: { header: tt('game.popup.bankrupt', '💀 BANKROTAS'), color: '#dc3545' },
        trade:  { header: tt('game.popup.trade', '🤝 PREKYBA'), color: '#17a2b8' },
        auction: { header: tt('game.popup.auction', '🔨 AUKCIONAS'), color: '#e0a800' },
        double: { header: tt('game.popup.double', '🎲 DUBLIS'), color: '#e0a800' },
        build:  { header: tt('game.cellActionBuild', '🏗️ STATYBOS'), color: '#dc3545' },
        small:  { header: '', color: '#3d2b1f' },
        turn:   { header: '', color: '#1a6b3c' },
        'turn-mine': { header: '', color: '#ffffff' }
    };
    const st = styles[item.type] || styles.info;

    box.classList.remove('cell5-turn', 'cell5-turn-mine', 'cell5-small', 'cell5-rent');
    if (item.type === 'turn') box.classList.add('cell5-turn');
    if (item.type === 'turn-mine') box.classList.add('cell5-turn-mine');
    if (item.type === 'small') box.classList.add('cell5-small');
    if (item.type === 'rent' && item.html) box.classList.add('cell5-rent');

    const headerText = item.header !== undefined ? item.header : st.header;
    header.textContent = headerText;
    header.style.display = headerText ? '' : 'none';
    header.style.color = st.color;
    header.style.borderBottomColor = st.color;

    if (item.html) {
        body.innerHTML = item.html;
    } else {
        body.innerHTML = `<p>${item.text || ''}</p>`;
    }

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn && item.blockRoll) {
        rollBtn.disabled = true;
        rollBtn.dataset.blockedByAction = 'true';
    }

    box.style.display = 'flex';
    box.classList.add('show');
    box.style.animation = 'none';
    void box.offsetHeight;
    box.style.animation = 'choiceFadeIn 0.25s ease';
}

function cell5Finish() {
    const box = document.getElementById('cellActionInfo');
    if (box) {
        box.style.display = 'none';
        box.classList.remove('show', 'cell5-turn', 'cell5-turn-mine', 'cell5-small', 'cell5-rent');
    }
    cell5Current = null;

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn && rollBtn.dataset.blockedByAction === 'true') {
        delete rollBtn.dataset.blockedByAction;
        if (gameState) updateUI(gameState);
    }
    cell5Next();
}

// Senas pavadinimas – visi esami kvietimai eina per eilę.
// blockRoll: užrakinti „Mesti“ tik kai pranešimas apie MANO veiksmą.
function showCellAction(message, type = 'info', blockRoll = false) {
    if (!message) return;
    cell5Enqueue({ type: type, text: message, blockRoll: !!blockRoll });
}

function hideCellAction() {
    if (cellActionTimeout) {
        clearTimeout(cellActionTimeout);
        cellActionTimeout = null;
    }
    cell5Finish();
}

function clearCell5Queue() {
    cell5Queue.length = 0;
    cell5Recent = [];
    lastTurnPopupId = null;
    if (cell5Current) hideCellAction();
}

// 💰 Didelis nuomos pranešimas: Tomas ➜ Petras €13
function showRentPopup(payerIdOrName, ownerIdOrName, amount, fieldName) {
    const payer = cell5FindPlayer(payerIdOrName);
    const owner = cell5FindPlayer(ownerIdOrName);
    const isMine = payer && payer.id === playerId;
    const html = `
        <div class="cell5-rent-field">${escapeHtml(fieldName || '')}</div>
        <div class="cell5-rent-row">${cell5PlayerChip(payer, payerIdOrName)} <span class="cell5-arrow">➜</span> ${cell5PlayerChip(owner, ownerIdOrName)}</div>
        <div class="cell5-rent-amount">€${Number(amount) || 0}</div>`;
    cell5Enqueue({
        type: 'rent',
        html: html,
        blockRoll: isMine,
        dedupeKey: `rent:${payer ? payer.id : payerIdOrName}:${owner ? owner.id : ownerIdOrName}:${amount}`
    });
}

// 🎯 Eilės pasikeitimo pranešimas
function handleTurnPopup(state) {
    if (!state || !state.gameStarted || state.currentTurn === undefined || state.currentTurn === null) {
        if (state && !state.gameStarted) lastTurnPopupId = null;
        return;
    }
    if (state.currentTurn === lastTurnPopupId) return;
    lastTurnPopupId = state.currentTurn;
    window.__rolledThisTurn = false;

    const enqueueTurn = () => {
        const p = cell5FindPlayer(state.currentTurn);
        if (!p) return;
        // Kol laukėm animacijos, eilė galėjo pasikeisti arba jau mesta
        if (gameState && gameState.currentTurn !== p.id) return;
        if (p.id === playerId && (window.__rolledThisTurn || (gameState && (gameState.taxiOffer || gameState.buildWindow || gameState.isRolling || gameState.pendingFieldPlayerId === playerId)))) return;
        if (p.id === playerId) {
            cell5Enqueue({
                type: 'turn-mine',
                tag: 'turn',
                priority: true,
                dedupeKey: 'turn:' + p.id + ':' + Date.now(),
                html: `<div class="cell5-turn-title">${tt('game.popup.yourTurn', '🎲 TAVO EILĖ!')}</div>
                       <div class="cell5-turn-sub">${tt('game.popup.rollDice', 'Mesk kauliukus!')}</div>`
            });
        } else {
            cell5Enqueue({
                type: 'turn',
                tag: 'turn',
                dedupeKey: 'turn:' + p.id + ':' + Date.now(),
                html: `<div class="cell5-turn-label">${tt('game.popup.nowPlaying', '🎯 Dabar eina')}</div>
                       <div class="cell5-turn-name${cell5IsLight(p.color) ? ' cell5-light' : ''}${cell5IsDark(p.color) ? ' cell5-dark' : ''}" style="color:${safeColor(p.color, '#1a6b3c')};">${escapeHtml(p.name)}</div>`
            });
        }
    };

    if (typeof isAnimating !== 'undefined' && isAnimating) {
        const wait = setInterval(() => {
            if (!isAnimating) { clearInterval(wait); enqueueTurn(); }
        }, 100);
    } else {
        enqueueTurn();
    }
}

// Mažas pranešimas (garsas įjungtas, stalas viešas ir pan.)
function showSmallNotice(msg) {
    if (!msg) return;
    cell5Enqueue({ type: 'small', text: escapeHtml(msg), duration: 2000 });
}

// Svarbūs žurnalo įvykiai, kuriuos verta parodyti 5 langelyje
const CELL5_KEY_TYPES = {
    'game.passedStart': 'start',
    'game.goToJail': 'jail',
    'game.wentToJail': 'jail',
    'game.threeDoubles': 'jail',
    'game.leftJail': 'jail',
    'game.paidJailFine': 'jail',
    'game.bankrupt': 'bankrupt',
    'game.debtor': 'tax',
    'game.doubleRollAgain': 'double'
};

function showKeyPopup(key, data, text) {
    const type = CELL5_KEY_TYPES[key];
    if (!type || !text) return;
    const d = data || {};
    let dedupeKey = text;
    if (key === 'game.bankrupt') dedupeKey = 'bankrupt-event';
    if (key === 'game.goToJail' || key === 'game.wentToJail' || key === 'game.threeDoubles') dedupeKey = 'jail-in:' + d.player;
    if (key === 'game.leftJail' || key === 'game.paidJailFine') dedupeKey = 'jail-out:' + d.player;
    cell5Enqueue({ type: type, text: escapeHtml(text), dedupeKey: dedupeKey });
}

// ============================================
// 🎨 TEMŲ VALDYMAS (Šviesus / Tamsus / Neonas)
// ============================================

function toggleThemeMenu() {
    const menu = document.getElementById('themeMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    }
}

function setTheme(theme) {
    // Nuimam senas klases
    document.body.classList.remove('dark-mode', 'theme-neon');
    
    // Pridedam naują
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = '🌙';
    } else if (theme === 'neon') {
        document.body.classList.add('theme-neon');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = '🌌';
    } else {
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = '☀️';
    }
    
    // Išsaugom
    localStorage.setItem('bancrupt_theme', theme);
    
    // Uždarom meniu
    const menu = document.getElementById('themeMenu');
    if (menu) menu.style.display = 'none';
    
    if (typeof playClickSound === 'function') playClickSound();
}

function loadTheme() {
    const saved = localStorage.getItem('bancrupt_theme') || 'light';
    setTheme(saved);
}

// Uždarom meniu paspaudus šalia
document.addEventListener('click', (e) => {
    const menu = document.getElementById('themeMenu');
    const btn = document.getElementById('themeBtn');
    if (menu && menu.style.display === 'flex' && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// Paleidžiam temą įkėlus puslapį
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTheme);
} else {
    loadTheme();
}

// ============================================
// INICIJAVIMAS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Puslapis įkeltas');
    
    const createNameInput = document.getElementById('createPlayerName');
    if (createNameInput) {
        createNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createGame();
        });
    }
    
    const joinNameInput = document.getElementById('joinPlayerName');
    if (joinNameInput) {
        joinNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinGame();
        });
    }
    
    const gameIdInputEl = document.getElementById('gameIdInput');
    if (gameIdInputEl) {
        gameIdInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinGame();
        });
    }
    
    const targetSelect = document.getElementById('tradeTargetPlayer');
    if (targetSelect) {
        targetSelect.addEventListener('change', function() {
            selectedRequestFields = [];
            updateRequestFields();
        });
        targetSelect.addEventListener('input', function() {
            selectedRequestFields = [];
            updateRequestFields();
        });
    }
    
    renderColorPicker('createColorPicker', null, null, selectCreateColor);
   
    availableJoinColors = [...PLAYER_COLORS];
    renderColorPicker('joinColorPicker', availableJoinColors, null, selectJoinColor);
    
    if (gameIdInputEl) {
        gameIdInputEl.addEventListener('input', function() {
            if (joinColorCheckTimeout) clearTimeout(joinColorCheckTimeout);
            joinColorCheckTimeout = setTimeout(() => {
                checkGameColors();
            }, 500);
        });
    }
    
    document.querySelectorAll('.cell').forEach(cell => {
        const fieldId = parseInt(cell.dataset.id);
        
        cell.addEventListener('mouseenter', () => {
            if (infoMode) {
                showCellInfo(fieldId);
            }
        });
        
        cell.addEventListener('mouseleave', () => {
            if (infoMode) {
                hideCellInfo();
            }
        });
        
        cell.addEventListener('touchstart', (e) => {
            if (typeof taxiUi !== 'undefined' && taxiUi.open) return;   // 🚕 renkamasi taksi kryptis – paspaudimas skirtas pasirinkimui
            if (infoMode) {
                e.preventDefault();
                showCellInfo(fieldId);
            }
        }, { passive: false });
        
        cell.addEventListener('touchend', (e) => {
            if (infoMode) {
                setTimeout(() => hideCellInfo(), 3000);
            }
        });
    });
    
    const savedMode = localStorage.getItem('boardMode') || 'adaptive';
    setMode(savedMode);
    
    initSocket();
    
    setTimeout(() => {
        const dice1 = document.getElementById('centerDice1');
        const dice2 = document.getElementById('centerDice2');
        
        if (dice1) updateSingleDice('centerDice1', 1);
        if (dice2) updateSingleDice('centerDice2', 1);
    }, 500);
    
    setTimeout(initInfoResizeObserver, 800);
    
    console.log('✅ Inicijavimas baigtas');
});

// FIX: kampai
function fixCornerClasses() {
    const corners = {
        'cell-0':  'cell corner start',
        'cell-16': 'cell corner jail',
        'cell-26': 'cell corner taxi',
        'cell-42': 'cell corner go-to-jail'
    };
    
    Object.entries(corners).forEach(([id, correctClass]) => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('corner')) {
            el.className = correctClass;
        }
    });
}

fixCornerClasses();

function fixPropertyClasses() {
    const buyableIds = [11, 24, 32, 48];
    
    buyableIds.forEach(id => {
        const cell = document.getElementById(`cell-${id}`);
        if (cell) {
            cell.classList.remove('property');
            if (!cell.classList.contains('service3')) {
                cell.classList.add('service3');
            }
            if (!cell.classList.contains('edge')) {
                cell.classList.add('edge');
            }
        }
    });
}

fixPropertyClasses();

// ============================================
// LAIMĖJIMO EKRANAS SU KONFETI
// ============================================
function showWinnerModal(winnerName, stats) {
    const modal = document.getElementById('winnerModal');
    if (!modal) return;
    
    const nameEl = document.getElementById('winnerName');
    if (nameEl) nameEl.textContent = winnerName || tf('cli.nezinomas');
    
    const statsEl = document.getElementById('winnerStats');
    if (statsEl && stats) {
        statsEl.innerHTML = stats;
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    createConfetti();
    
    if (typeof playWinSound === 'function') playWinSound();
    if (typeof playCelebrateSound === 'function') playCelebrateSound();
}

function closeWinnerModal() {
    const modal = document.getElementById('winnerModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    
    document.querySelectorAll('.confetti-piece').forEach(c => c.remove());
    
    if (typeof goToMenu === 'function') {
        goToMenu();
    }
    
    if (typeof playClickSound === 'function') playClickSound();
}

function createConfetti() {
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181', '#aa96da', '#fcbad3', '#ffffd2'];
    const shapes = ['rect', 'circle', 'triangle'];
    const totalConfetti = 150;
    
    document.querySelectorAll('.confetti-piece').forEach(c => c.remove());
    
    for (let i = 0; i < totalConfetti; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            confetti.className = `confetti-piece ${shape}`;
            confetti.style.left = Math.random() * 100 + '%';
            
            if (shape === 'triangle') {
                confetti.style.borderBottomColor = color;
            } else {
                confetti.style.background = color;
            }
            
            const size = 0.5 + Math.random() * 1.5;
            if (shape !== 'triangle') {
                confetti.style.transform = `scale(${size})`;
            }
            
            const duration = 3 + Math.random() * 3;
            confetti.style.animationDuration = duration + 's';
            confetti.style.animationDelay = (Math.random() * 0.5) + 's';
            confetti.style.animationTimingFunction = 'linear';
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), (duration + 1) * 1000);
        }, i * 20);
    }
}

// ============================================
// PINIGŲ ANIMACIJA
// ============================================
function animateMoney(element, from, to, duration = 800) {
    if (!element) return;
    if (from === to) return;
    
    if (element._moneyAnimFrame) {
        cancelAnimationFrame(element._moneyAnimFrame);
    }
    
    const start = performance.now();
    const diff = to - from;
    
    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + diff * easeOut);
        
        element.textContent = '💰 €' + current;
        
        if (current < 0) {
            element.style.color = '#dc3545';
        } else {
            element.style.color = '#000000';
        }
        
        if (progress < 1) {
            element._moneyAnimFrame = requestAnimationFrame(update);
        } else {
            element.textContent = '💰 €' + to;
            element._moneyAnimFrame = null;
        }
    }
    
    element._moneyAnimFrame = requestAnimationFrame(update);
}

// ============================================
// HIGHLIGHT
// ============================================
function highlightCell(cellId, color = 'yellow', duration = 1500) {
    const cell = document.getElementById(`cell-${cellId}`);
    if (!cell) return;
    
    cell.classList.remove('highlight-yellow', 'highlight-green', 'highlight-red');
    
    const className = `highlight-${color}`;
    cell.classList.add(className);
    
    setTimeout(() => {
        cell.classList.remove(className);
    }, duration);
}

// ============================================
// BUY CARD (5 langelyje)
// ============================================
let buyCardTimeout = null;

function showBuyCard(field, player, type) {
    const card = document.getElementById('buyCard');
    if (!card || !field || !player) return;
    
    card.classList.remove('pending', 'success', 'cancel');
    delete card.dataset.buyEnd;
    
    const header = document.getElementById('buyCardHeader');
    
    if (type === 'pending') {
        card.classList.add('pending');
        header.textContent = t('game.buyCardPending');
    } else if (type === 'success') {
        card.classList.add('success');
        header.textContent = t('game.buyCardSuccess');
    } else if (type === 'cancel') {
        card.classList.add('cancel');
        header.textContent = t('game.buyCardCancel');
    }
    
    const colorEl = document.getElementById('buyCardColor');
    const isService = field.type === 'service1' || field.type === 'service2' || field.type === 'service3';

    if (isService) {
        colorEl.style.background = 'linear-gradient(145deg, #f0e8d8, #e0d5c0)';
        colorEl.style.display = 'flex';
        colorEl.style.alignItems = 'center';
        colorEl.style.justifyContent = 'center';
        colorEl.style.fontSize = '20px';
        colorEl.textContent = field.icon || '⚙️';
    } else {
        colorEl.style.background = field.color || '#c9a84c';
        colorEl.textContent = '';
        colorEl.style.display = 'block';
    }
    
    document.getElementById('buyCardName').textContent = `${field.icon || ''} ${field.name}`;
    document.getElementById('buyCardPrice').textContent = `€${field.cost}`;
    
    let infoHtml = '';
    if (field.type === 'property') {
        const baseRent = Math.floor(field.cost * 0.1);
        infoHtml = t('game.buyCardRentProperty').replace('{rent}', baseRent);
    } else if (field.type === 'service1' || field.type === 'service2' || field.type === 'service3') {
        infoHtml = t('game.buyCardRentShort');
    }
    document.getElementById('buyCardInfo').textContent = infoHtml;
    
    const playerEl = document.getElementById('buyCardPlayer');
    if (type === 'pending') {
        playerEl.textContent = t('game.buyCardCanBuy').replace('{player}', player.name);
        playerEl.style.color = '#e0a800';
    } else if (type === 'success') {
        playerEl.textContent = t('game.buyCardBought').replace('{player}', player.name);
        playerEl.style.color = '#28a745';
    } else if (type === 'cancel') {
        playerEl.textContent = t('game.buyCardCancelled').replace('{player}', player.name);
        playerEl.style.color = '#dc3545';
    }
    
    card.style.display = 'flex';
    
    // ⏳ Laukiant sprendimo – mažėjanti laiko juosta
    let timerBar = document.getElementById('buyCardTimer');
    if (!timerBar) {
        timerBar = document.createElement('div');
        timerBar.id = 'buyCardTimer';
        timerBar.innerHTML = '<div id="buyCardTimerFill"></div>';
        const box = document.getElementById('buyCardBox');
        if (box) box.appendChild(timerBar);
    }
    const timerFill = document.getElementById('buyCardTimerFill');
    if (type === 'pending' && timerFill) {
        timerBar.style.display = 'block';
        timerFill.style.transition = 'none';
        timerFill.style.width = '100%';
        void timerFill.offsetWidth;
        timerFill.style.transition = 'width 30s linear';
        timerFill.style.width = '0%';
    } else if (timerBar) {
        timerBar.style.display = 'none';
    }
    
    if (buyCardTimeout) clearTimeout(buyCardTimeout);
    const duration = type === 'pending' ? 30000 : 3000;
    buyCardTimeout = setTimeout(() => {
        hideBuyCard();
    }, duration);
}

// Pirkimo laikas gali būti trumpesnis (AFK) – juostą derinam su serverio laiku
function syncPendingBuyTimer(state) {
    const card = document.getElementById('buyCard');
    const fill = document.getElementById('buyCardTimerFill');
    if (!card || !fill || !card.classList.contains('pending') || !isBuyCardVisible()) return;
    if (!state || !state.buyTimeoutActive || !state.buyTimeoutEndTime) return;
    if (card.dataset.buyEnd === String(state.buyTimeoutEndTime)) return;
    card.dataset.buyEnd = String(state.buyTimeoutEndTime);
    const leftMs = Math.max(0, state.buyTimeoutEndTime - Date.now());
    fill.style.transition = 'none';
    fill.style.width = '100%';
    void fill.offsetWidth;
    fill.style.transition = `width ${leftMs}ms linear`;
    fill.style.width = '0%';
    if (buyCardTimeout) clearTimeout(buyCardTimeout);
    buyCardTimeout = setTimeout(() => hideBuyCard(), leftMs + 300);
}

function hideBuyCard() {
    const card = document.getElementById('buyCard');
    if (!card) return;
    card.style.display = 'none';
    
    if (buyCardTimeout) {
        clearTimeout(buyCardTimeout);
        buyCardTimeout = null;
    }
}

// ============================================
// STATISTIKA
// ============================================
window.gameStats = {
    players: {},
    gameStartTime: null,
    totalRolls: 0,
    totalDoubles: 0
};

function initPlayerStats(playerId, playerName, playerColor) {
    if (!window.gameStats.players[playerId]) {
        window.gameStats.players[playerId] = {
            id: playerId,
            name: playerName,
            color: playerColor,
            metimai: 0,
            dubliai: 0,
            kalėjimai: 0,
            nusipirko: 0,
            pastate: 0,
            nuomaGavo: 0,
            nuomaSumokejo: 0,
            bankrotai: 0,
            patekoIKalejima: 0
        };
    }
}

function openStats() {
    const modal = document.getElementById('gameStatsModal');
    if (!modal) return;
    
    updateStatsDisplay();
    modal.style.display = 'flex';
    playClickSound();
}

function closeStats() {
    const modal = document.getElementById('gameStatsModal');
    if (!modal) return;
    modal.style.display = 'none';
    playClickSound();
}

function updateStatsDisplay() {
    const content = document.getElementById('gameStatsContent');
    if (!content) return;
    
    let html = '';
    
    if (window.gameStats.gameStartTime) {
        const elapsed = Math.floor((Date.now() - window.gameStats.gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        html += `
            <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:12px; margin-bottom:15px; text-align:center; border:2px solid #c9a84c;">
                <div style="color:#d4b896; font-size:13px; margin-bottom:4px;">${tf('cli.st_duration')}</div>
                <div style="color:#ffd700; font-size:24px; font-weight:700;">${minutes}:${seconds.toString().padStart(2, '0')}</div>
            </div>
        `;
    }
    
    html += `
        <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin-bottom:15px;">
            <div style="color:#ffd700; font-size:14px; font-weight:700; margin-bottom:8px;">${tf('cli.st_totals')}</div>
            <div style="display:flex; justify-content:space-between; color:#fff; font-size:13px; margin-bottom:4px;">
                <span>${tf('cli.st_rolls_all')}</span>
                <strong>${window.gameStats.totalRolls}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; color:#fff; font-size:13px;">
                <span>${tf('cli.st_doubles_all')}</span>
                <strong>${window.gameStats.totalDoubles}</strong>
            </div>
        </div>
    `;
    
    const players = Object.values(window.gameStats.players);
    
    if (players.length === 0) {
        html += tf('cli.nera_statistikos');
    } else {
        html += tf('cli.zaideju_statistika');
        
        players.forEach(p => {
            html += `
                <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:12px; margin-bottom:10px; border-left:4px solid ${p.color};">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="width:16px; height:16px; border-radius:50%; background:${p.color}; border:2px solid rgba(255,255,255,0.5);"></span>
                        <span style="color:#fff; font-weight:700; font-size:14px;">${p.name}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px; color:#d4b896;">
                        <div>${tf('cli.st_rolls')} <strong style="color:#fff;">${p.metimai}</strong></div>
                        <div>${tf('cli.st_doubles')} <strong style="color:#fff;">${p.dubliai}</strong></div>
                        <div>${tf('cli.st_jail')} <strong style="color:#fff;">${p.patekoIKalejima}</strong></div>
                        <div>${tf('cli.st_bought')} <strong style="color:#fff;">${p.nusipirko}</strong></div>
                        <div>${tf('cli.st_built')} <strong style="color:#fff;">${p.pastate}</strong></div>
                        <div>${tf('cli.st_rent_in')} <strong style="color:#28a745;">€${p.nuomaGavo}</strong></div>
                        <div>${tf('cli.st_rent_out')} <strong style="color:#dc3545;">€${p.nuomaSumokejo}</strong></div>
                        <div>${tf('cli.st_bankr')} <strong style="color:#fff;">${p.bankrotai}</strong></div>
                    </div>
                </div>
            `;
        });
    }
    
    content.innerHTML = html;
}

function updateStatsFromGameState(state) {
    if (!state || !state.players) return;
    
    state.players.forEach(p => {
        initPlayerStats(p.id, p.name, p.color);
    });
    
    if (state.gameStarted && !window.gameStats.gameStartTime) {
        window.gameStats.gameStartTime = Date.now();
    }
}

function incrementRolls(playerId, isDouble) {
    if (!window.gameStats.players[playerId]) return;
    
    window.gameStats.players[playerId].metimai++;
    window.gameStats.totalRolls++;
    
    if (isDouble) {
        window.gameStats.players[playerId].dubliai++;
        window.gameStats.totalDoubles++;
    }
}

function incrementJail(playerId) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].patekoIKalejima++;
}

function incrementBought(playerId) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].nusipirko++;
}

function incrementBuilt(playerId) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].pastate++;
}

function addRentReceived(playerId, amount) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].nuomaGavo += amount;
}

function addRentPaid(playerId, amount) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].nuomaSumokejo += amount;
}

function incrementBankrupt(playerId) {
    if (!window.gameStats.players[playerId]) return;
    window.gameStats.players[playerId].bankrotai++;
}

// ============================================
// LYDERIŲ LENTELĖ
// ============================================
function openLeaders() {
    const modal = document.getElementById('leadersModal');
    if (!modal) return;
    
    updateLeadersDisplay();
    modal.style.display = 'flex';
    playClickSound();
}

function closeLeaders() {
    const modal = document.getElementById('leadersModal');
    if (!modal) return;
    modal.style.display = 'none';
    playClickSound();
}

async function updateLeadersDisplay() {
    const content = document.getElementById('leadersContent');
    if (!content) return;
    
    content.innerHTML = `<div style="color:#d4b896; text-align:center; padding:20px;">${t('common.loading')}</div>`;
    
    try {
        const response = await fetch('/api/auth/leaders?limit=10');
        
        if (!response.ok) {
            content.innerHTML = `<div style="color:#dc3545; text-align:center; padding:20px;">${t('game.leaders.error')}</div>`;
            return;
        }
        
        const data = await response.json();
        const leaders = data.leaders || [];
        
        if (leaders.length === 0) {
            content.innerHTML = `<div style="color:#d4b896; text-align:center; padding:20px;">${t('game.leaders.empty')}</div>`;
            return;
        }
        
        let html = '';
        
        html += `
            <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin-bottom:15px; text-align:center;">
                <div style="color:#d4b896; font-size:13px; margin-bottom:4px;">${t('game.leaders.top').replace('{count}', leaders.length)}</div>
            </div>
        `;
        
        leaders.forEach((p, index) => {
            let medal = '';
            let bgColor = 'rgba(255,255,255,0.1)';
            let borderColor = '#ffd700';
            
            if (index === 0) {
                medal = '🥇';
                bgColor = 'rgba(255,215,0,0.15)';
                borderColor = '#ffd700';
            } else if (index === 1) {
                medal = '🥈';
                bgColor = 'rgba(192,192,192,0.15)';
                borderColor = '#c0c0c0';
            } else if (index === 2) {
                medal = '🥉';
                bgColor = 'rgba(205,127,50,0.15)';
                borderColor = '#cd7f32';
            } else {
                medal = `#${index + 1}`;
                borderColor = '#c9a84c';
            }
            
            const winRate = p.games_played > 0 
                ? Math.round((p.games_won / p.games_played) * 100) 
                : 0;
            
            html += `
                <div style="background:${bgColor}; border-radius:10px; padding:12px; margin-bottom:10px; border-left:4px solid ${borderColor};">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <span style="font-size:24px; min-width:30px; text-align:center;">${medal}</span>
                        <span style="color:#fff; font-weight:700; font-size:15px; flex:1;">${p.username}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:12px; color:#d4b896;">
                        <div>🏆 <strong style="color:#ffd700;">${p.games_won}</strong></div>
                        <div>🎮 <strong style="color:#fff;">${p.games_played}</strong></div>
                        <div>📊 <strong style="color:#28a745;">${winRate}%</strong></div>
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = html;
        
    } catch (err) {
        console.error('❌ Lyderių klaida:', err);
        content.innerHTML = `<div style="color:#dc3545; text-align:center; padding:20px;">${t('game.leaders.serverError')}</div>`;
    }
}

function autoUpdateLeaders() {
    const modal = document.getElementById('leadersModal');
    if (modal && modal.style.display === 'flex') {
        updateLeadersDisplay();
    }
}

// ============================================
// FONO MUZIKA
// ============================================
let backgroundMusicStarted = false;

function startBackgroundMusic() {
    if (backgroundMusicStarted) return;
    if (!audioManager.isMusicEnabled) return;   // 🆕 Apsauga
    
    audioManager.playLoop('background');
    backgroundMusicStarted = true;
    console.log('🎵 Fono muzika įjungta');
}

function stopBackgroundMusic() {
    audioManager.stopLoop('background');
    backgroundMusicStarted = false;
    console.log('🔇 Fono muzika išjungta');
}

function toggleBackgroundMusic() {
    const btn = document.getElementById('musicBtn');
    const toggleBtn = document.getElementById('musicToggleBtn');
    
    if (backgroundMusicStarted) {
        stopBackgroundMusic();
        if (btn) {
            btn.innerHTML = tf('cli.muzika_isj');
            btn.classList.remove('active');
        }
        if (toggleBtn) {
            toggleBtn.textContent = tf('cli.ijungti_muzika');
        }
        localStorage.setItem('bancrupt_music', 'false');
    } else {
        startBackgroundMusic();
        if (btn) {
            btn.innerHTML = tf('cli.muzika_ij');
            btn.classList.add('active');
        }
        if (toggleBtn) {
            toggleBtn.textContent = tf('cli.isjungti_muzika');
        }
        localStorage.setItem('bancrupt_music', 'true');
    }
    
    playClickSound();
}

// ============================================
// PABAIGA
// ============================================
console.log('✅ script.js užkrautas pilnai!');

// ============================================
// 🆕 APSAUGA NUO PIRKIMO UŽDARYMO
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 🆕 Neleisti uždaryti pirkimo su ESC
        if (gameState && gameState.waitingForBuy) {
            console.log('⚠️ Negalima uždaryti pirkimo su ESC!');
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
}, true);

// ============================================
// 🆕 PAPRASTAS GARSO MYGTUKAS
// ============================================

function toggleSoundSimple() {
    const dot = document.getElementById('soundStatusDot');
    
    if (soundMode === 'off') {
        // ĮJUNGIAM GARSĄ (efektus)
        soundMode = 'my';
        audioManager.isEnabled = true;
        
        if (dot) {
            dot.style.background = '#28a745';
            dot.style.boxShadow = '0 0 6px #28a745';
        }
        
        console.log('🔊 Garsas įjungtas');
        playClickSound();
    } else {
        // IŠJUNGIAM GARSĄ (efektus)
        soundMode = 'off';
        audioManager.isEnabled = false;
        
        if (dot) {
            dot.style.background = '#dc3545';
            dot.style.boxShadow = '0 0 6px #dc3545';
        }
        
        console.log('🔇 Garsas išjungtas');
    }
    
    localStorage.setItem('bancrupt_soundMode', soundMode);
    // 🆕 NEjudinam muzikos!
}

// ============================================
// 🆕 GARSO REGULIATORIUS
// ============================================

function changeSoundVolume(value) {
    const volume = parseInt(value) / 100;
    
    // Nustatyti SFX garsumą
    if (typeof audioManager !== 'undefined' && typeof audioManager.setSfxVolume === 'function') {
        audioManager.setSfxVolume(volume);
    }
    
    // Atnaujinti rodomą reikšmę
    const valueDisplay = document.getElementById('soundVolumeValue');
    if (valueDisplay) valueDisplay.textContent = value;
    
    // Išsaugoti localStorage
    localStorage.setItem('bancrupt_sfxVolume', value);
    
    // 🆕 Jei volume 0 — išjungti TIK efektus
    if (volume === 0) {
        soundMode = 'off';
        audioManager.isEnabled = false;
    } else {
        if (soundMode === 'off') {
            soundMode = 'my';
            audioManager.isEnabled = true;
        }
    }
    
    // Atnaujinti mygtuko būseną
    if (typeof loadSoundButtonState === 'function') {
        loadSoundButtonState();
    }
    
    console.log('🔊 Garsas:', value);
}

function loadSoundVolumeSlider() {
    const slider = document.getElementById('soundVolumeSlider');
    const valueDisplay = document.getElementById('soundVolumeValue');
    if (!slider) return;
    
    const saved = localStorage.getItem('bancrupt_sfxVolume') || 50;
    slider.value = saved;
    if (valueDisplay) valueDisplay.textContent = saved;
}

// ============================================
// 🆕 PAPRASTAS MUZIKOS MYGTUKAS
// ============================================

function toggleMusicSimple() {
    const dot = document.getElementById('musicStatusDot');
    
    // 🆕 Tikrinam isMusicEnabled, ne backgroundMusicStarted
    if (audioManager.isMusicEnabled) {
        // IŠJUNGIAM MUZIKĄ
        audioManager.isMusicEnabled = false;
        
        if (typeof stopBackgroundMusic === 'function') {
            stopBackgroundMusic();
        } else {
            audioManager.stopLoop('background');
            backgroundMusicStarted = false;
        }
        
        if (dot) {
            dot.style.background = '#dc3545';
            dot.style.boxShadow = '0 0 6px #dc3545';
        }
        
        localStorage.setItem('bancrupt_music', 'false');
        console.log('🔇 Muzika išjungta');
    } else {
        // ĮJUNGIAM MUZIKĄ
        audioManager.isMusicEnabled = true;
        
        if (typeof startBackgroundMusic === 'function') {
            startBackgroundMusic();
        } else {
            audioManager.playLoop('background');
            backgroundMusicStarted = true;
        }
        
        if (dot) {
            dot.style.background = '#28a745';
            dot.style.boxShadow = '0 0 6px #28a745';
        }
        
        localStorage.setItem('bancrupt_music', 'true');
        console.log('🎵 Muzika įjungta');
    }
    
    playClickSound();
}

function loadMusicButtonState() {
    const dot = document.getElementById('musicStatusDot');
    if (!dot) return;
    
    // 🆕 Tikrinam isMusicEnabled (vėliavėlę), o ne backgroundMusicStarted
    if (audioManager.isMusicEnabled) {
        dot.style.background = '#28a745';
        dot.style.boxShadow = '0 0 6px #28a745';
    } else {
        dot.style.background = '#dc3545';
        dot.style.boxShadow = '0 0 6px #dc3545';
    }
}

function changeMusicVolumeSimple(value) {
    const volume = parseInt(value) / 100;
    
    if (typeof audioManager !== 'undefined' && typeof audioManager.setMusicVolume === 'function') {
        audioManager.setMusicVolume(volume);
    }
    
    const valueDisplay = document.getElementById('musicVolumeValueSimple');
    if (valueDisplay) valueDisplay.textContent = value;
    
    localStorage.setItem('bancrupt_musicVolume', value);
    console.log('🎵 Muzikos garsumas:', value);
}

function loadMusicVolumeSliderSimple() {
    const slider = document.getElementById('musicVolumeSliderSimple');
    const valueDisplay = document.getElementById('musicVolumeValueSimple');
    if (!slider) return;
    
    const saved = localStorage.getItem('bancrupt_musicVolume') || 15;
    slider.value = saved;
    if (valueDisplay) valueDisplay.textContent = saved;
}

function loadSoundButtonState() {
    const dot = document.getElementById('soundStatusDot');
    if (!dot) return;
    
    if (soundMode === 'off') {
        dot.style.background = '#dc3545';
        dot.style.boxShadow = '0 0 6px #dc3545';
    } else {
        dot.style.background = '#28a745';
        dot.style.boxShadow = '0 0 6px #28a745';
    }
}

console.log('✅ Pirkimo apsauga aktyvuota!');

// ============================================
// 🆕 FEEDBACK (PRANEŠTI / PASIŪLYTI)
// ============================================

function openFeedback() {
    document.getElementById('feedbackModal').style.display = 'flex';
    
    // 🆕 Įkelti mano pranešimus
    loadMyFeedback();
}

// ============================================
// 📬 MANO PRANEŠIMAI
// ============================================

async function loadMyFeedback() {
    const content = document.getElementById('myFeedbackContent');
    const countEl = document.getElementById('myFeedbackCount');
    
    if (!content) return;
    
    content.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:13px;">' + tf('cli.loading') + '</p>';
    if (countEl) countEl.textContent = '';
    
    try {
        const token = localStorage.getItem('bancrupt_token');
        
        const response = await fetch('/api/auth/my-feedback', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        const items = data.feedback || [];
        
        renderMyFeedback(items);
        
    } catch (err) {
        console.error('❌ loadMyFeedback klaida:', err);
        content.innerHTML = tf('cli.nepavyko_ikelti_pranesimu');
    }
}

function renderMyFeedback(items) {
    const content = document.getElementById('myFeedbackContent');
    const countEl = document.getElementById('myFeedbackCount');
    
    if (!content) return;
    
    if (countEl) {
        countEl.textContent = items.length > 0 ? `(${items.length})` : '';
    }
    
    if (!items || items.length === 0) {
        content.innerHTML = tf('cli.neturi_pranesimu');
        return;
    }
    
    const typeIcons = {
        bug: tf('cli.fb_bug'),
        idea: tf('cli.pasiulymas'),
        complaint: tf('cli.fb_complaint')
    };
    
    const statusBadges = {
        new: { icon: '🆕', text: 'Naujas', color: '#ffc107', textColor: '#000' },
        in_progress: { icon: '🔄', text: 'Vykdoma', color: '#17a2b8', textColor: '#fff' },
        resolved: { icon: '✅', text: tf('cli.isspresta'), color: '#28a745', textColor: '#fff' },
        rejected: { icon: '❌', text: 'Atmesta', color: '#6c757d', textColor: '#fff' }
    };
    
    let html = '';
    
    items.forEach(item => {
        const date = new Date(item.created_at).toLocaleString('lt-LT', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
        
        const status = statusBadges[item.status] || { icon: '', text: item.status, color: '#888', textColor: '#fff' };
        const typeLabel = typeIcons[item.type] || item.type;
        
        const message = (item.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html += `
            <div style="background:rgba(255,255,255,0.5); border-radius:8px; padding:10px; margin-bottom:8px; border-left:4px solid ${status.color};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                    <span style="font-weight:700; color:#1a6b3c; font-size:13px;">${typeLabel}</span>
                    <span style="background:${status.color}; color:${status.textColor}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;">${status.icon} ${status.text}</span>
                </div>
                <div style="font-size:11px; color:#6c757d; margin-bottom:6px;">${date}</div>
                <div style="font-size:12px; color:#3d2b1f; white-space:pre-wrap; word-wrap:break-word; margin-bottom:${item.admin_response ? '8px' : '0'};">${message}</div>
                ${item.admin_response ? `
                    <div style="background:rgba(40,167,69,0.15); border-left:3px solid #28a745; padding:8px; border-radius:4px; margin-top:6px;">
                        <div style="font-size:11px; font-weight:700; color:#28a745; margin-bottom:4px;">💬 ADMIN ATSAKYMAS:</div>
                        <div style="font-size:12px; color:#3d2b1f; white-space:pre-wrap; word-wrap:break-word;">${item.admin_response.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    content.innerHTML = html;
}

function closeFeedback() {
    document.getElementById('feedbackModal').style.display = 'none';
    document.getElementById('feedbackMessage').value = '';
    document.getElementById('feedbackEmail').value = '';
    document.getElementById('feedbackError').textContent = '';
    
    // 🆕 Išvalyti sąrašą
    const content = document.getElementById('myFeedbackContent');
    if (content) {
        content.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:13px;">' + tf('cli.loading') + '</p>';
    }
    const countEl = document.getElementById('myFeedbackCount');
    if (countEl) countEl.textContent = '';
}

async function submitFeedback() {
    const type = document.querySelector('input[name="feedbackType"]:checked').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    const email = document.getElementById('feedbackEmail').value.trim();
    const errorEl = document.getElementById('feedbackError');
    
    errorEl.textContent = '';
    
    // Validacija
    if (!message || message.length < 5) {
        errorEl.textContent = tf('cli.aprasymas_per_trumpas_bent_simboliai');
        return;
    }
    
    if (message.length > 2000) {
        errorEl.textContent = tf('cli.aprasymas_per_ilgas_max_2000');
        return;
    }
    
    // Gauti vartotojo info
    let username = null;
    let userId = null;
    const userStr = localStorage.getItem('bancrupt_user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            username = user.username;
            userId = user.userId;   // 🆕 PRIDĖTA
        } catch (e) {}
    }
    
    // Gauti puslapį
    let page = 'unknown';
    const activePage = document.querySelector('.page.active');
    if (activePage) page = activePage.id.replace('page-', '');
    
    console.log('📤 Siunčiam feedback:', { type, message, email, page, username, userId });
    
    try {
        const fbToken = localStorage.getItem('bancrupt_token');
        const response = await fetch('/api/feedback', {
            method: 'POST',
            // 🛡️ Serveris vardą nustato pagal prisijungimą
            headers: fbToken
                ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + fbToken }
                : { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                message,
                email: email || null,
                page,
                username,
                userId   // 🆕 PRIDĖTA
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            errorEl.textContent = '❌ ' + data.error;
            return;
        }
        
        alert(tf('cli.dekojame_pranesimas_gautas'));
        closeFeedback();
    } catch (err) {
        console.error('❌ Feedback klaida:', err);
        errorEl.textContent = tf('cli.serverio_klaida_bandyk_dar_karta');
    }
}

// ============================================
// ⏱️ LAIKMATIS 5 LANGELYJE – po „Dabar eina“ vardu, su trumpėjančia juostele
// ============================================
const ttcUi = { end: 0, total: 0 };
function updateCenterTimer() {
    const box = document.getElementById('turnTimerCenter');
    if (!box) return;
    const timeEl = box.querySelector('.ttc-time'), bar = box.querySelector('.ttc-bar i');
    const now = Date.now();
    let mode = null, end = 0;
    if (gameState?.turnTimerPaused) mode = 'paused';
    else if (gameState?.turnTimerActive && gameState?.turnTimerEndTime && gameState.turnTimerEndTime > now) { mode = 'turn'; end = gameState.turnTimerEndTime; }
    // pirkimo metu jis turi savo laikmatį – čia slepiam
    if (gameState?.buyTimeoutActive && gameState?.buyTimeoutEndTime && gameState.buyTimeoutEndTime > now) mode = null;
    if (!mode) { box.classList.remove('show', 'warn', 'paused'); ttcUi.end = 0; return; }
    box.classList.add('show');
    box.classList.toggle('paused', mode === 'paused');
    if (mode === 'paused') {
        timeEl.textContent = '⏸️ ' + tt('game.timerPaused', 'laikas sustabdytas');
        box.classList.remove('warn');
        return;
    }
    if (Math.abs(end - ttcUi.end) > 1500) { ttcUi.end = end; ttcUi.total = Math.max(1000, end - now); }   // naujas ėjimas
    const left = Math.max(0, end - now), secs = Math.ceil(left / 1000);
    const mine = gameState && gameState.currentTurn === playerId;
    const t = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    timeEl.textContent = mine ? tt('game.timerMine', '⏱️ Tavo eilė – liko {t}').replace('{t}', t) : '⏱️ ' + t;
    bar.style.width = Math.max(0, Math.min(100, left / ttcUi.total * 100)) + '%';
    box.classList.toggle('warn', secs <= 10);
}

// ============================================
// 🆕 TURN TIMER + BUY TIMER
// ============================================
setInterval(() => {
    const turnTimerBox = document.getElementById('turnTimerBox');
    const turnTimerEl = document.getElementById('turnTimer');
    const turnTimerPlayer = document.getElementById('turnTimerPlayer');
    const turnTimerLabel = document.getElementById('turnTimerLabel');
    
    // ✅ Viršutinės juostos laikmatis (atskiras elementas)
    const headerTimer = document.getElementById('headerTurnTimer');
    if (headerTimer) {
        let txt = '', color = '#ffd700';
        if (gameState?.buyTimeoutActive && gameState?.buyTimeoutEndTime && gameState.buyTimeoutEndTime > Date.now()) {
            const left = Math.max(0, Math.floor((gameState.buyTimeoutEndTime - Date.now()) / 1000));
            txt = `🛒 ${left}s`;
            color = left <= 5 ? '#ff4d4d' : (left <= 10 ? '#ff8c00' : '#7CFC00');
        } else if (gameState?.turnTimerPaused) {
            txt = '⏸️ ' + tt('game.timerPaused', 'laikas sustabdytas');
            color = '#9ad0ff';
        } else if (gameState?.turnTimerActive && gameState?.turnTimerEndTime && gameState.turnTimerEndTime > Date.now()) {
            const left = Math.max(0, Math.floor((gameState.turnTimerEndTime - Date.now()) / 1000));
            txt = `⏱️ ${left}s`;
            color = left <= 10 ? '#ff4d4d' : (left <= 30 ? '#ff8c00' : '#ffd700');
        }
        headerTimer.textContent = txt;
        headerTimer.style.color = color;
        headerTimer.style.display = txt ? '' : 'none';
    }
    
    updateCenterTimer();
    if (!turnTimerBox || !turnTimerEl) return;
    
    // 🆕 1. PIRKIMO LAIKAS (prioritetas)
    if (gameState?.buyTimeoutActive && gameState?.buyTimeoutEndTime) {
        const buyTimeLeft = Math.max(0, Math.floor((gameState.buyTimeoutEndTime - Date.now()) / 1000));
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        
        if (buyTimeLeft > 0) {
            if (turnTimerLabel) turnTimerLabel.textContent = tf('cli.pirkimo_laikas');
            turnTimerEl.textContent = `${buyTimeLeft}s`;
            if (turnTimerPlayer) turnTimerPlayer.textContent = currentPlayer?.name || '---';
            turnTimerBox.style.display = 'block';
            
            if (buyTimeLeft <= 5) {
                turnTimerEl.style.color = '#ff1a1a';   // Raudona
            } else if (buyTimeLeft <= 10) {
                turnTimerEl.style.color = '#ff8c00';   // Oranžinė
            } else {
                turnTimerEl.style.color = '#28a745';   // Žalia
            }
            return;
        }
    }
    
    // ⏸️ Aukcionas / mainai – ėjimo laikas sustabdytas
    if (gameState?.turnTimerPaused) {
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        if (turnTimerLabel) turnTimerLabel.textContent = '⏸️ ' + tt('game.timerPausedLabel', 'LAIKAS SUSTABDYTAS');
        turnTimerEl.textContent = '⏸️';
        turnTimerEl.style.color = '#9ad0ff';
        if (turnTimerPlayer) turnTimerPlayer.textContent = currentPlayer?.name || '---';
        turnTimerBox.style.display = 'block';
        return;
    }

    // 🆕 2. ĖJIMO LAIKAS
    if (gameState?.turnTimerActive && gameState?.turnTimerEndTime) {
        const timeLeft = Math.max(0, Math.floor((gameState.turnTimerEndTime - Date.now()) / 1000));
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        
        if (timeLeft > 0) {
            if (turnTimerLabel) turnTimerLabel.textContent = tf('cli.liko_laiko');
            turnTimerEl.textContent = `${timeLeft}s`;
            if (turnTimerPlayer) turnTimerPlayer.textContent = currentPlayer?.name || '---';
            turnTimerBox.style.display = 'block';
            
            if (timeLeft <= 10) {
                turnTimerEl.style.color = '#ff1a1a';
            } else if (timeLeft <= 30) {
                turnTimerEl.style.color = '#ff8c00';
            } else {
                turnTimerEl.style.color = '#fff';
            }
            return;
        }
    }
    
    // 🆕 3. Niekas neaktyvus
    turnTimerBox.style.display = 'none';
}, 500);

console.log('✅ Feedback funkcijos užkrautos!');
