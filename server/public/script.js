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
        showLobbyMessage('🟢 Prisijungta prie serverio', '#28a745');
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
        showLobbyMessage('🔴 Nepavyko prisijungti prie serverio!', '#dc3545');
        playErrorSound();
    });

    socket.on('disconnect', () => {
        console.log('❌ Atsijungta nuo serverio');
        isConnected = false;
        showLobbyMessage('🔴 Atsijungta nuo serverio', '#dc3545');
    });

    socket.on('error', (msg) => {
        console.log('Klaida:', msg);
        playErrorSound();
        alert(msg);
    });

    socket.on('gameCreated', (data) => {
        clearCell5Queue();
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
        showLobbyMessage(`✅ Žaidimas sukurtas! ID: ${gameId}`, '#28a745');
        // playStartSound();
        enterGame();
    });

    socket.on('joinedGame', (data) => {
        clearCell5Queue();
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
        showLobbyMessage(`✅ Prisijungei prie žaidimo!`, '#28a745');
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
        
        showLobbyMessage(`🔄 Grįžai į žaidimą!`, '#28a745');
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
        addNotification('🎨 Lenta atnaujinta iš admin panelės!');
    }
    
    if (typeof addJournal === 'function') {
        addJournal('🎨 Lenta atnaujinta!');
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
        showSmallNotice('🎨 Vidurio langeliai atnaujinti!');
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
            showSmallNotice('🔇 Garso panelė perjungta į paprastą');
        }
    } else {
        if (typeof addNotification === 'function') {
            showSmallNotice('🔊 Garso panelė perjungta į išplėstą');
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
        showSmallNotice('📁 Garso failai atnaujinti!');
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
            if (status) status.textContent = '⚠️ Nėra laisvų spalvų!';
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
            status.textContent = `👥 Žaidėjai: ${takenCount}/${totalColors} • Laisvos: ${availableJoinColors.length}`;
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
                status.textContent = `👥 Laisvos: ${availableJoinColors.length}/${totalColors}`;
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
        
        playGameStartSound();
        
        const msg = `🎮 Žaidimas pradėtas! Pirmas eina: ${data.firstPlayerName}`;
        addNotification(msg);
        addJournal(msg);
        const br = (waitingRoomState && waitingRoomState.buildRule) || (gameState && gameState.buildRule) || 2;
        addJournal(`🏗️ ${tt('game.buildRuleIs', 'Statybų taisyklė')}: ${br}. ${buildRuleLabel(br)}`);
        
        hideWaitingRoom();
        
        if (gameState) updateUI(gameState);
    });

    // 🏗️ STATYBŲ LANGAS
    socket.on('buildWindow', (d) => {
        if (d.playerId === playerId) openBuildWindowPanel(d.ms);
    });
    socket.on('buildWindowClosed', (d) => {
        if (d.playerId === playerId) closeBuildWindowPanel();
    });

    // 🧪 Testinis perkėlimas ant TAKSI
    socket.on('debugMove', async (d) => {
        window.animatingPlayers = window.animatingPlayers || [];
        if (!window.animatingPlayers.includes(d.playerId)) window.animatingPlayers.push(d.playerId);
        try { await animateMovement(d.playerId, d.from, d.to, null, { stepMs: 60 }); }
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
            .replace('{player}', d.playerName).replace('{field}', d.fieldName).replace('{cost}', d.cost));
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
        alert('❌ Tave išmetė kūrėjas!');
        
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
            showSmallNotice('🌐 Stalas dabar viešas!');
        } else {
            showSmallNotice('🔒 Stalas dabar privatus');
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
        await animateMovement(data.player.id, data.oldPosition, data.newPosition,
            Promise.race([diceLanded, new Promise(r => setTimeout(r, 700))]));
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
            ? `❌ Neužtenka pinigų ${data.field.name} pirkti!`
            : `❌ ${data.player.name} neužtenka pinigų ${data.field.name} pirkti!`;
        
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
            playSoundForPlayer('tax', null);
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
            msg = `✅ Nusipirkai ${data.fieldName}! 🏠`;
        } else {
            msg = `✅ ${data.playerName} nusipirko ${data.fieldName}! 🏠`;
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
        msg = `❌ Atsisakei pirkti ${data.fieldName}`;
    } else {
        msg = `❌ ${data.playerName} atsisakė pirkti ${data.fieldName}`;
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
        playBankruptSound();
        const msg = `💀 ${data.playerName} BANKROTAVO!`;
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
        if (fieldId === 2) playSoundForPlayer('dujos', data.playerId);
        else if (fieldId === 14) playSoundForPlayer('siuksles', data.playerId);
        else if (fieldId === 28) playSoundForPlayer('elektra', data.playerId);
        else if (fieldId === 44) playSoundForPlayer('vanduo', data.playerId);
        else if (fieldId === 8) playSoundForPlayer('air-port', data.playerId);
        else if (fieldId === 19) playSoundForPlayer('train', data.playerId);
        else if (fieldId === 37) playSoundForPlayer('port', data.playerId);
        else if (fieldId === 46) playSoundForPlayer('bus', data.playerId);
        else if (fieldId === 13) playSoundForPlayer('hospital', data.playerId);
        else if (fieldId === 21) playSoundForPlayer('latras', data.playerId, true);
        else if (fieldId === 32) playSoundForPlayer('pirtis', data.playerId);
        else if (fieldId === 11) playSoundForPlayer('spa', data.playerId);
        else if (fieldId === 24) playSoundForPlayer('baseinas', data.playerId);
        else if (fieldId === 48) playSoundForPlayer('papludimys', data.playerId);
        else if (fieldId === 50) playSoundForPlayer('birthday', data.playerId, true);
        else if (fieldId === 42) playSoundForPlayer('jail_in', data.playerId, true);
        else if (fieldId === 16) playSoundForPlayer('jail', data.playerId);
        
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
                if (confirm(`🏨 Statyti viešbutį ant "${data.fieldName}" už €${data.cost}?`)) {
                    socket.emit('buildHouse', { fieldId: data.fieldId });
                    playClickSound();
                }
            } else {
                if (confirm(`🏠 Statyti namą ant "${data.fieldName}" už €${data.cost}?`)) {
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
    const msg = `📩 ${data.fromPlayer} pasiūlė prekybą ${data.toPlayer}!`;
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
        showPopupMessage(data.message || 'Prekyba įvykdyta!', 'buy');
    } else {
        playMoveSound();
        showPopupMessage(data.message || 'Prekyba atmesta', 'move');
    }
    addNotification(data.message || 'Prekybos atsakymas gautas');
    addJournal(data.message || 'Prekybos atsakymas gautas');
    
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
            addJournal('❌ Klaida: aukciono duomenys neteisingi');
            playErrorSound();
            return;
        }
        
        const msg = `🔨 Prasidėjo aukcionas: ${data.fieldName}! Bankas siūlo €${data.currentBid}`;
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
        
        const msg = `💰 ${data.currentBidderName || 'Kažkas'} pasiūlė €${data.currentBid}`;
        addNotification(msg);
        addJournal(msg);
    });

    socket.on('auctionEnded', (data) => {
        console.log('🔨 AUKCIONAS BAIGĖSI:', data);
        
        auctionEndedSent = true;
        
        if (data) {
            if (data.winnerId === 'bank') {
                const msg = `🏦 Bankas laimėjo aukcioną: ${data.fieldName} už €${data.finalBid}`;
                addNotification(msg);
                showPopupMessage(msg, 'move');
                addJournal(msg);
            } else if (data.winnerName) {
                const msg = `🔨 ${data.winnerName} laimėjo aukcioną: ${data.fieldName} už €${data.finalBid}!`;
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
        
        addNotification(`🏃 Tu pasitraukei iš žaidimo`);
        addJournal(`🏃 Tu pasitraukei iš žaidimo`);
        
        setTimeout(() => {
            if (typeof goToMenu === 'function') {
                goToMenu();
            }
            showLobbyMessage('🏃 Pasitraukei iš žaidimo.', '#ffd700');
            
            playerId = null;
            gameId = null;
            gameState = null;
            myPlayer = null;
            isMyTurn = false;
        }, 1500);
    });

    socket.on('gameFinished', (data) => {
        console.log('🏆 Žaidimas baigtas:', data);
        
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
                stats = `💰 Turėjo: €${winner.money} • 🏠 ${winner.properties.length} objektai (${houses} namai)`;
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
        addNotification(`🗳️ ${data.initiatorName} pradėjo balsavimą dėl "${data.targetName}" pašalinimo!`);
        addJournal(`🗳️ ${data.initiatorName} pradėjo balsavimą dėl "${data.targetName}" pašalinimo!`);
        
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
                <div>Balsai: <strong>${votesFor}/${data.requiredVotes}</strong> UŽ, ${votesAgainst} PRIEŠ</div>
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
            addNotification(`✅ ${data.targetName} buvo pašalintas! (${data.votesFor}/${data.requiredVotes})`);
            addJournal(`✅ ${data.targetName} buvo pašalintas! (${data.votesFor}/${data.requiredVotes})`);
        } else {
            addNotification(`❌ Balsavimas dėl ${data.targetName} nepavyko (${data.votesFor}/${data.requiredVotes})`);
            addJournal(`❌ Balsavimas dėl ${data.targetName} nepavyko (${data.votesFor}/${data.requiredVotes})`);
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
        addNotification(`🗳️ Balsavimas atšauktas: ${data.reason}`);
        addJournal(`🗳️ Balsavimas atšauktas: ${data.reason}`);
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
        alert('❌ Ši spalva jau užimta!');
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
        if (status) status.textContent = 'Įvesk pilną stalo kodą';
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

function renderBuildRuleBox(state) {
    const box = document.getElementById('buildRuleBox');
    if (!box || !state) return;
    const rule = state.buildRule || 2;
    const isHost = state.hostId === playerId;
    const title = document.getElementById('buildRuleTitle');
    const gid = state.gameId || gameId;
    box.classList.toggle('is-host', isHost);
    box.classList.toggle('blink', isHost && !buildRuleTouched[gid]);
    if (title) {
        title.textContent = isHost
            ? tt('waiting.buildRuleTitleHost', '🏗️ STATYBŲ TAISYKLĖ – GALITE PAKEISTI')
            : tt('waiting.buildRuleTitle', '🏗️ STATYBŲ TAISYKLĖ');
    }
    box.querySelectorAll('.build-rule-opt').forEach(btn => {
        const r = parseInt(btn.dataset.rule, 10);
        btn.classList.toggle('active', r === rule);
        btn.disabled = !isHost;
    });
    const note = document.getElementById('buildRuleNote');
    if (note) {
        note.textContent = isHost
            ? tt('waiting.buildRuleNoteHost', 'Pasirinkta: {n}. Visiems žaidėjams galios ši taisyklė.').replace('{n}', rule)
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
    if (listEl) {
        if (state.players.length === 0) {
    listEl.innerHTML = `<p style="color:#d4b896; text-align:center;">${t('game.waiting.noPlayers')}</p>`;
} else {
            listEl.innerHTML = state.players.map(p => {
                const isBot = p.isBot === true;
                const botIcon = isBot ? '🤖 ' : '';
                const botBadge = isBot ? `<span style="font-size:11px; color:#8b5cf6; font-weight:700; background:rgba(111,66,193,0.2); padding:2px 6px; border-radius:4px;">${t('game.waiting.bot')}</span>` : '';
                
                return `
                    <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(255,255,255,0.08); border-radius:8px; ${p.ready ? 'border-left:3px solid #28a745;' : 'border-left:3px solid #6c757d;'} ${isBot ? 'border-left-color:#8b5cf6;' : ''}">
                        <span class="wr-piece">${p.piece ? pieceSvg(p.piece, p.color) : '<span class="wr-nopiece">❔</span>'}</span>
                        <span style="flex:1; color:#fff; font-weight:600; font-size:14px;">${botIcon}${p.name}${p.isHost ? ' 👑' : ''}${p.id === playerId ? ' ' + t('game.waiting.you') : ''}</span>
                        ${botBadge}
                        <span style="font-size:12px; font-weight:700; ${p.ready ? 'color:#28a745;' : 'color:#d4b896;'}">${p.ready ? '✅' : '⏳'}</span>
                        ${!isBot && state.hostId === playerId && p.id !== playerId && !p.ready ? `
                            <button onclick="kickPlayer(${p.id})" style="padding:4px 8px; border:none; border-radius:4px; background:#dc3545; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">❌</button>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    }
    
    const statusEl = document.getElementById('waitingStatusText');
if (statusEl) {
    if (state.canStart) {
        statusEl.innerHTML = t('game.waiting.allReady');
    } else if (state.totalPlayers < 2) {
        statusEl.innerHTML = t('game.waiting.needPlayers').replace('{count}', state.totalPlayers);
    } else {
        const notReady = state.totalPlayers - state.readyCount;
        statusEl.innerHTML = t('game.waiting.notReady').replace('{count}', notReady);
    }
}
    
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startGameBtn');
    
    if (readyBtn) {
    const me = state.players.find(p => p.id === playerId);
    if (me && me.ready) {
        readyBtn.innerHTML = t('game.waiting.readyBtnActive');
        readyBtn.style.background = 'linear-gradient(145deg, #6c757d, #495057)';
    } else {
        readyBtn.innerHTML = t('game.waiting.readyBtn');
        readyBtn.style.background = 'linear-gradient(145deg, #28a745, #1e7e34)';
    }
}
    
    if (startBtn) {
    if (playerId === state.hostId) {
        startBtn.style.display = 'block';
        if (state.canStart) {
            // 🆕 VISI PASIRUOŠĘ – ŽALIAS
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.style.background = 'linear-gradient(145deg, #28a745, #1e7e34)';   // 🆕 ŽALIA
            startBtn.style.borderColor = '#4ade80';                                     // 🆕 ŽALIA
            startBtn.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.5)';              // 🆕 ŠVYTĖJIMAS
            startBtn.innerHTML = t('game.waiting.startBtn');
        } else {
            // 🆕 NE VISI PASIRUOŠĘ – RAUDONAS
            startBtn.disabled = true;
            startBtn.style.opacity = '0.7';
            startBtn.style.background = 'linear-gradient(145deg, #dc3545, #a71d2a)';   // 🆕 RAUDONA
            startBtn.style.borderColor = '#ff6b6b';                                     // 🆕 RAUDONA
            startBtn.style.boxShadow = 'none';                                          // 🆕 Be švytėjimo
            startBtn.innerHTML = t('game.waiting.startBtnDisabled');
        }
    } else {
        startBtn.style.display = 'none';
    }
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
        alert('❌ Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!gameId) {
        alert('❌ Nesi žaidime!');
        playErrorSound();
        return;
    }
    
    if (!waitingRoomState) {
        alert('❌ Nėra waiting room būsenos!');
        playErrorSound();
        return;
    }
    
    const activePlayers = waitingRoomState.players.length;
    if (activePlayers >= 8) {
        alert('❌ Stalas pilnas! (max 8 žaidėjai)');
        playErrorSound();
        return;
    }
    
    if (playerId !== waitingRoomState.hostId) {
        alert('❌ Tik žaidimo kūrėjas gali pridėti botus!');
        playErrorSound();
        return;
    }
    
    if (waitingRoomState.gameStarted) {
        alert('❌ Žaidimas jau prasidėjo!');
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
        alert('❌ Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!confirm('🏃 Ar tikrai nori pasitraukti iš stalo?\n\nPrarasi savo vietą!\nGalėsi kurti naują arba jungtis prie kito.')) {
        return;
    }
    
    playClickSound();
    hideWaitingRoom();
    socket.emit('leaveGame');
}

function kickPlayer(targetId) {
    if (!confirm('❌ Ar tikrai nori išmesti šį žaidėją?')) return;
    
    playClickSound();
    socket.emit('kickPlayer', { targetId: targetId });
}

function copyGameCode() {
    if (!gameId) return;
    
    navigator.clipboard.writeText(gameId).then(() => {
        playNotificationSound();
        alert('📋 Kodas nukopijuotas: ' + gameId);
    }).catch(() => {
        prompt('Nukopijuok kodą:', gameId);
    });
}

function copyGameLink() {
    if (!gameId) return;
    
    const link = window.location.origin + '/?game=' + gameId;
    
    navigator.clipboard.writeText(link).then(() => {
        playNotificationSound();
        alert('🔗 Nuoroda nukopijuota!');
    }).catch(() => {
        prompt('Nukopijuok nuorodą:', link);
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
        alert('❌ Klaida: gauti neteisingi aukciono duomenys');
        playErrorSound();
        return;
    }
    
    auctionEndedSent = false;
    currentAuctionId = data.auctionId;
    
    const isSeller = data.sellerId === playerId;
    
    document.getElementById('auctionSeller').textContent = data.sellerName || 'Nežinomas';
    document.getElementById('auctionFieldName').textContent = data.fieldName || 'Nežinoma kortelė';
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
    document.getElementById('auctionCurrentBidder').textContent = '🏦 Bankas';
    
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
        alert('❌ Nėra aktyvaus aukciono!');
        playErrorSound();
        return;
    }
    
    const input = document.getElementById('auctionBidInput');
    const bidAmount = parseInt(input.value);
    
    if (isNaN(bidAmount) || bidAmount <= 0) {
        alert('❌ Įvesk teisingą kainą!');
        playErrorSound();
        return;
    }
    
    const currentBidText = document.getElementById('auctionCurrentBid').textContent;
    const currentBid = parseInt(currentBidText.replace('€', '')) || 0;
    
    if (bidAmount <= currentBid) {
        alert(`❌ Siūlyk daugiau nei €${currentBid}!`);
        playErrorSound();
        return;
    }
    
    socket.emit('bidAuction', { auctionId: currentAuctionId, bidAmount });
    input.value = '';
    playClickSound();
}

function placeBidPlus10() {
    if (!currentAuctionId) {
        alert('❌ Nėra aktyvaus aukciono!');
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
        alert('❌ Nėra ryšio su serveriu!');
        return;
    }
    
    if (!gameState || !gameState.players) {
        alert('❌ Žaidimas dar neprasidėjęs!');
        return;
    }
    
    if (gameState.activeVoteKick) {
        alert('⚠️ Balsavimas jau vyksta! Palauk kol baigsis.');
        return;
    }
    
    const modal = document.getElementById('voteKickModal');
    const playersDiv = document.getElementById('voteKickPlayers');
    const statusDiv = document.getElementById('voteKickStatus');
    
    playersDiv.innerHTML = '';
    statusDiv.innerHTML = 'Pasirink žaidėją, kurį nori pašalinti.';
    
    const activePlayers = gameState.players.filter(p => 
        p.isActive && !p.bankrupt && !p.left && !p.kicked
    );
    
    if (activePlayers.length < 3) {
        statusDiv.innerHTML = '❌ Reikia bent 3 aktyvių žaidėjų balsavimui.';
        modal.style.display = 'flex';
        return;
    }
    
    const otherPlayers = activePlayers.filter(p => p.id !== playerId);
    
    if (otherPlayers.length === 0) {
        statusDiv.innerHTML = '❌ Nėra žaidėjų, kuriuos būtų galima pašalinti.';
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
    if (!confirm(`Ar tikrai nori pradėti balsavimą dėl "${targetName}" pašalinimo?`)) {
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
                Ar pašalinti "${data.targetName}"?
            </div>
            <div style="font-size:13px; color:#6c757d; margin-bottom:15px;">
                Balsavimą pradėjo: ${data.initiatorName}
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button onclick="voteKickAction(${data.targetId}, true)" 
                        style="flex:1; padding:12px; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; background:linear-gradient(145deg, #dc3545, #a71d2a); color:#fff;">
                    ✅ TAIP, ŠALINTI
                </button>
                <button onclick="voteKickAction(${data.targetId}, false)" 
                        style="flex:1; padding:12px; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; background:linear-gradient(145deg, #28a745, #1e7e34); color:#fff;">
                    ❌ NE, PALIKTI
                </button>
            </div>
        </div>
    `;
    
    statusDiv.innerHTML = `
        <div class="vote-kick-timer" id="voteKickTimer">${timeLeft}</div>
        <div>Balsai: <strong>${votesFor}/${requiredVotes}</strong> UŽ</div>
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
                🗳️ Tu pradėjai balsavimą dėl "${data.targetName}"
            </div>
            <div style="font-size:13px; color:#6c757d;">
                Laukiame kitų žaidėjų balsų...
            </div>
        </div>
    `;
    
    statusDiv.innerHTML = `
        <div class="vote-kick-timer" id="voteKickTimer">${data.timeLeft || 60}</div>
        <div>Balsai: <strong>1/${data.requiredVotes}</strong> UŽ (tu)</div>
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
        <div>Balsai: <strong>${votesFor}/${data.requiredVotes}</strong> UŽ, ${votesAgainst} PRIEŠ</div>
        <div style="font-size:10px; margin-top:4px;">${voters}</div>
    `;
}

function showKickSummary(data) {
    const summaryHtml = data.voteSummary.map(v => {
        const icon = v.vote ? '✅ UŽ' : '❌ PRIEŠ';
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
        <h2 style="color:#dc3545; margin-bottom:15px;">TU BUVAI PAŠALINTAS!</h2>
        <p style="margin-bottom:15px;">Žaidėjai nubalsavo už tavo pašalinimą nuo stalo.</p>
        <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:10px; margin-bottom:15px; text-align:left;">
            <div style="font-weight:700; margin-bottom:8px;">🗳️ Balsavimo rezultatai (${data.votesFor}/${data.requiredVotes}):</div>
            ${summaryHtml}
        </div>
        <p style="font-size:13px; color:#aaa; margin-bottom:15px;">Dabar gali tik stebėti žaidimą.</p>
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
        dice: '🎲 Kauliukų metimas',
        move: '🚶 Judėjimas',
        click: '👆 Paspaudimas',
        'your-turn': '🎵 Tavo eilė',
        cash: '💰 Pinigų gavimas',
        pay: '💸 Pinigų mokėjimas',
        pay1: '💸 Nuomos mokėjimas',
        'rent-received': '💰 Nuomos gavimas',
        buy: '🏠 Pirkimas',
        build: '🏗️ Statyba',
        hotel: '🏨 Viešbutis',
        demolish: '🏚️ Griovimas',
        tax: '💸 Mokesčiai',
        latras: '🍺 Latrų baras',
        pirtis: '🧖 Pirtis',
        hospital: '🏥 Ligoninė',
        birthday: '🎂 Gimtadienis',
        chance: '🎲 Šansas',
        special: '⭐ Specialus',
        dujos: '🔥 Dujos',
        siuksles: '🗑️ Šiukšlės',
        elektra: '💡 Elektra',
        vanduo: '💧 Vanduo',
        'air-port': '✈️ Oro uostas',
        train: '🚂 Traukinių stotis',
        port: '⚓ Uostas',
        bus: '🚌 Autobusų stotis',
        spa: '🛀 SPA',
        baseinas: '🏊 Baseinas',
        papludimys: '🏖️ Paplūdimys',
        jail: '⛓️ Kalėjimas',
        jail_in: '🚔 Į kalėjimą',
        jail_out: '🚪 Iš kalėjimo',
        trade: '🤝 Prekyba',
        auction: '🔨 Aukcionas',
        start: '🏁 Start',
        'game-start': '🎮 Žaidimo startas',
        win: '🏆 Laimėjimas',
        celebrate: '🎉 Šventimas',
        gameover: '🏁 Žaidimo pabaiga',
        bankrupt: '💀 Bankrotas',
        notification: '📢 Pranešimas',
        error: '❌ Klaida'
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
    if (!confirm('🔄 Atkurti standartinius garso nustatymus?')) return;
    
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
        showSmallNotice('🔄 Garso nustatymai atkurti');
    }
}

// 🆕 Išsaugoti garso nustatymus
function saveSoundSettings() {
    audioManager.saveSoundLevels();
    playClickSound();
    
    if (typeof addNotification === 'function') {
        showSmallNotice('💾 Garso nustatymai išsaugoti');
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
            muteBtn.textContent = '🔊 Įjungti garsą';
        } else {
            muteBtn.textContent = '🔇 Išjungti garsą';
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
        muteBtn.textContent = '🔇 Išjungti garsą';
    } else {
        isMuted = true;
        lastVolume = parseInt(slider.value) || 50;
        slider.value = 0;
        changeSfxVolume(0);
        muteBtn.textContent = '🔊 Įjungti garsą';
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
                <span class="label">👤 Savininkas:</span>
                <span class="value" style="color:${owner.color};">${owner.name}</span>
            </div>
        `;
    } else if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">👤 Savininkas:</span>
                <span class="value green">Laisvas</span>
            </div>
        `;
    }
    
    if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">💰 Kaina:</span>
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
        
        html += `<div class="info-section"><div class="info-section-title">🏘️ NUOMA</div>`;
        html += `<div class="info-row"><span class="label">Vienas sklypas:</span><span class="value">€${baseRent}</span></div>`;
        html += `<div class="info-row"><span class="label">Pilna gatvė:</span><span class="value">€${fullGroupRent}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 1 namu:</span><span class="value">€${rent1}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 2 namais:</span><span class="value">€${rent2}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 3 namais:</span><span class="value">€${rent3}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 4 namais:</span><span class="value">€${rent4}</span></div>`;
        html += `<div class="info-row"><span class="label">🏨 Viešbutis:</span><span class="value">€${rentHotel}</span></div>`;
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
        if (firstField) groupName = firstField.name;
        
        // Grupės nariai
        const groupFields = groupIds.map(id => {
            const f = gameState.board.find(x => x.id === id);
            const o = gameState.players.find(p => p.properties.includes(id) && !p.bankrupt && !p.left && !p.kicked);
            return { id, field: f, owner: o };
        });
        
        const ownedInGroup = owner ? owner.properties.filter(id => groupIds.includes(id)).length : 0;
        const currentRent = SERVICE_RENT[ownedInGroup] || SERVICE_RENT[1];
        
        // 🆕 Grupės nariai su savininkais
        html += `<div class="info-section"><div class="info-section-title">🏘️ GRUPĖ: ${groupName}</div>`;
        groupFields.forEach(({ id, field: f, owner: o }) => {
            if (!f) return;
            
            const ownerText = o ? `<span style="color:${o.color}; font-weight:700;">${o.name}</span>` : '<span class="value green">Laisvas</span>';
            
            html += `
                <div class="info-row" style="font-size:10px;">
                    <span class="label">#${id} ${f.name}:</span>
                    <span class="value">${ownerText}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        // 🆕 Nuomos lentelė
        html += `<div class="info-section"><div class="info-section-title">💰 NUOMA</div>`;
        html += `<div class="info-row"><span class="label">Turi ${ownedInGroup}/4:</span><span class="value green">€${currentRent}</span></div>`;
        html += `<div class="info-row"><span class="label">1 langelis:</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">2 langeliai:</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">3 langeliai:</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">4 langeliai:</span><span class="value">€200</span></div>`;
        html += `</div>`;
    }
    
    if (field.type === 'tax') {
        if (field.id === 5) {
    html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€100</span></div></div>`;
        } else if (field.id === 21) {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€10</span></div></div>`;
        } else {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€${field.cost}</span></div></div>`;
        }
    }
    
    if (field.type === 'special') {
    if (field.id === 13) {
        html += `<div class="info-section"><div class="info-row"><span class="label">🏥 Sumokėsi:</span><span class="value red">€50</span></div></div>`;
    } else if (field.id === 4) {
        html += `<div class="info-section"><div class="info-row"><span class="label">🎲 Gausi:</span><span class="value green">+€200</span></div></div>`;
    } else if (field.id === 50) {   // 🆕 GIMTADIENIS
        html += `<div class="info-section"><div class="info-row"><span class="label">🎂 Gausi:</span><span class="value green">+€200</span></div></div>`;
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
                <span class="label">👤 Savininkas:</span>
                <span class="value" style="color:${owner.color};">${owner.name}</span>
            </div>
        `;
    }
    
    if (field.cost > 0) {
        html += `
            <div class="info-row">
                <span class="label">💰 Kaina:</span>
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
        
        html += `<div class="info-section"><div class="info-section-title">🏘️ NUOMA</div>`;
        html += `<div class="info-row"><span class="label">Vienas sklypas:</span><span class="value">€${baseRent}</span></div>`;
        html += `<div class="info-row"><span class="label">Pilna gatvė:</span><span class="value">€${fullGroupRent}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 1 namu:</span><span class="value">€${rent1}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 2 namais:</span><span class="value">€${rent2}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 3 namais:</span><span class="value">€${rent3}</span></div>`;
        html += `<div class="info-row"><span class="label">Su 4 namais:</span><span class="value">€${rent4}</span></div>`;
        html += `<div class="info-row"><span class="label">🏨 Viešbutis:</span><span class="value">€${rentHotel}</span></div>`;
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
        if (firstField) groupName = firstField.name;
        
        const groupFields = groupIds.map(id => {
            const f = gameState.board.find(x => x.id === id);
            const o = gameState.players.find(p => p.properties.includes(id) && !p.bankrupt && !p.left && !p.kicked);
            return { id, field: f, owner: o };
        });
        
        const ownedInGroup = owner ? owner.properties.filter(id => groupIds.includes(id)).length : 0;
        const currentRent = SERVICE_RENT[ownedInGroup] || SERVICE_RENT[1];
        
        html += `<div class="info-section"><div class="info-section-title">🏘️ GRUPĖ: ${groupName}</div>`;
        groupFields.forEach(({ id, field: f, owner: o }) => {
            if (!f) return;
            
            const ownerText = o ? `<span style="color:${o.color}; font-weight:700;">${o.name}</span>` : '<span class="value green">Laisvas</span>';
            
            html += `
                <div class="info-row" style="font-size:10px;">
                    <span class="label">#${id} ${f.name}:</span>
                    <span class="value">${ownerText}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        html += `<div class="info-section"><div class="info-section-title">💰 NUOMA</div>`;
        html += `<div class="info-row"><span class="label">Turi ${ownedInGroup}/4:</span><span class="value green">€${currentRent}</span></div>`;
        html += `<div class="info-row"><span class="label">1 langelis:</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">2 langeliai:</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">3 langeliai:</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">4 langeliai:</span><span class="value">€200</span></div>`;
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
        alert('Įvesk savo vardą!');
        playErrorSound();
        return;
    }
    if (!isConnected) {
        alert('Nėra ryšio su serveriu!');
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
        alert('Įvesk savo vardą!');
        playErrorSound();
        return;
    }
    if (!gid) {
        alert('Įvesk žaidimo kodą!');
        playErrorSound();
        return;
    }
    if (!isConnected) {
        alert('Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!selectedJoinColor) {
        alert('Pasirink savo spalvą!');
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
function toggleLeftPanel() {
    const panel = document.getElementById('leftPanel');
    const btn = document.getElementById('leftPanelToggle');
    
    if (!panel || !btn) return;

    // 📱 Telefone / planšetėje panelė atsidaro virš lentos ir nekeičia išsaugotos būsenos
    if (document.body.classList.contains('cmp')) {
        const open = document.body.classList.toggle('lp-open');
        btn.innerHTML = open ? '◀' : '▶';
        btn.title = open ? 'Slėpti panelę' : 'Parodyti panelę';
        if (typeof playClickSound === 'function') playClickSound();
        return;
    }

    const isHidden = panel.classList.toggle('hidden');
    
    if (isHidden) {
        // Paslėpti
        btn.innerHTML = '▶';
        btn.title = 'Parodyti panelę';
        localStorage.setItem('bancrupt_leftPanelHidden', 'true');
        console.log('📋 Kairė panelė paslėpta');
    } else {
        // Parodyti
        btn.innerHTML = '◀';
        btn.title = 'Slėpti panelę';
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
        btn.title = 'Parodyti panelę';
    } else {
        panel.classList.remove('hidden');
        btn.innerHTML = '◀';
        btn.title = 'Slėpti panelę';
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
        alert('❌ Nėra ryšio su serveriu!');
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
    const left = Math.max(0, 10 - (myPlayer.afkAutoMoves || 0));
    document.getElementById('afkBannerText').textContent =
        tt('game.afk.banner', '⏸️ Tu AFK – tavo ėjimai daromi automatiškai. Liko automatinių ėjimų iki bankroto: {n}').replace('{n}', left);
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
        sw.innerHTML = '<button type="button" data-v="2d">2D</button><button type="button" data-v="3d">3D</button><button type="button" data-v="3dp">3D+</button><button type="button" class="bv-reset" title="Atstatyti">⟲</button>';
        sw.title = tt('game.boardView', 'Stalo vaizdas');
        sw.querySelectorAll('button[data-v]').forEach(b => b.onclick = () => setBoardView(b.dataset.v));
        sw.querySelector('.bv-reset').onclick = () => { orbitReset(true); if (typeof playClickSound === 'function') playClickSound(); };
        const idEl = document.getElementById('gameIdDisplay');
        if (idEl && idEl.nextSibling) header.insertBefore(sw, idEl.nextSibling);
        else header.appendChild(sw);
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
        const fb = document.getElementById('feedbackBtn');
        header.insertBefore(btn, fb || null);
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
        toggleBtn.title = 'Parodyti panelę';
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
function openBuildWindowPanel(ms) {
    buildWin.deadline = Date.now() + (ms || 15000);
    let p = document.getElementById('buildWindowPanel');
    if (!p) {
        p = document.createElement('div');
        p.id = 'buildWindowPanel';
        p.innerHTML = `
            <div class="bw-icon">🏗️</div>
            <div class="bw-body">
                <div class="bw-title"></div>
                <div class="bw-bar"><span></span></div>
                <div class="bw-btns">
                    <button type="button" class="bw-build"></button>
                    <button type="button" class="bw-end"></button>
                    <span class="bw-left"></span>
                </div>
            </div>`;
        document.body.appendChild(p);
        p.querySelector('.bw-build').onclick = () => buildHouse();
        p.querySelector('.bw-end').onclick = () => {
            p.querySelectorAll('button').forEach(b => b.disabled = true);
            playClickSound();
            socket.emit('finishBuild');
        };
    }
    p.querySelectorAll('button').forEach(b => b.disabled = false);
    p.querySelector('.bw-title').textContent = tt('build.windowTitle', 'Gali statyti!');
    p.querySelector('.bw-build').textContent = tt('game.buildHouseBtn', '🏠 Statyti namą');
    p.querySelector('.bw-end').textContent = tt('build.endTurn', '✅ Baigti ėjimą');
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
}
function closeBuildWindowPanel() {
    buildWin.open = false;
    clearInterval(buildWin.timer);
    const p = document.getElementById('buildWindowPanel');
    if (p) p.style.display = 'none';
    const picker = document.getElementById('buildPicker');
    if (picker) picker.style.display = 'none';
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
    const holder = document.querySelector('#center-2 .control-buttons');
    if (!holder) return;
    let btn = document.getElementById('taxiTestBtn');
    const show = gameState && gameState.testMode && gameState.gameStarted;
    if (!show) { if (btn) btn.style.display = 'none'; return; }
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'taxiTestBtn';
        btn.type = 'button';
        btn.textContent = '🧪 Taksi testas';
        btn.title = 'Laikinas mygtukas: perkelia tave ant TAKSI langelio';
        btn.onclick = () => { playClickSound(); socket.emit('debugTaxi'); };
        holder.appendChild(btn);
    }
    btn.style.display = '';
    btn.disabled = !(gameState && gameState.currentTurn === playerId && !gameState.isRolling && !gameState.waitingForBuy &&
        !gameState.pendingFieldPlayerId && !gameState.taxiOffer && !gameState.buildWindow);
}

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
        const anchor = document.getElementById('boardViewSwitch');
        if (anchor && anchor.nextSibling) header.insertBefore(wrap, anchor.nextSibling);
        else header.appendChild(wrap);
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
        car.innerHTML = '<span class="taxi-car-body">🚕</span><span class="taxi-car-roof"></span>';
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
        alert('⏳ Palauk, kol baigsis pranešimas!');
        playErrorSound();
        return;
    }
    
    if (!isMyTurn) {
        alert('⏳ Ne tavo eilė!');
        playErrorSound();
        return;
    }
    
    if (myPlayer && myPlayer.isDebtor) {
        alert('⚠️ Tu skolingas! Parduok turtą, kad išsigelbėtum!');
        playErrorSound();
        return;
    }
    
    if (amIKicked) {
        alert('🚫 Tu buvai pašalintas iš žaidimo!');
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
        alert('❌ Tu nebegali prekiauti!');
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
        html = '<p style="color:#6c757d; padding:10px;">Neturi kortelių be namų</p>';
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
        alert('❌ Pasirink bent vieną kortelę!');
        playErrorSound();
        return;
    }
    
    const totalPrice = selectedSellFields.reduce((sum, id) => {
        const field = gameState.board.find(f => f.id === id);
        return sum + Math.floor(field.cost * 0.8);
    }, 0);
    
    if (confirm(`🏦 Parduoti ${selectedSellFields.length} kortelę(-es) bankui už €${totalPrice}?`)) {
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
        html = '<p style="color:#6c757d; padding:10px;">Neturi kortelių be namų</p>';
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
        alert('❌ Pasirink kortelę aukcionui!');
        playErrorSound();
        return;
    }
    
    const field = gameState.board.find(f => f.id === selectedAuctionField);
    if (!field) {
        alert('❌ Kortelė nerasta!');
        playErrorSound();
        return;
    }
    
    if (confirm(`🔨 Skelbti aukcioną: ${field.name}?\n\nBankas siūlys 70% (€${Math.floor(field.cost * 0.7)}) startinę kainą.`)) {
        socket.emit('startAuction', { fieldId: selectedAuctionField });
        selectedAuctionField = null;
        closeTrading();
        const msg = `🔨 Aukcionas paskelbtas: ${field.name}!`;
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
        option.textContent = '--- Nėra aktyvių žaidėjų ---';
        select.appendChild(option);
    }
    
    updateRequestFields();
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
        html = '<p style="color:#6c757d; padding:10px;">Neturi kortelių be namų</p>';
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
    
    if (!targetSelectElem || !container) return;
    
    if (!gameState) {
        container.innerHTML = '<p style="color:#6c757d; padding:10px;">Nėra žaidimo būsenos</p>';
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
            container.innerHTML = '<p style="color:#6c757d; padding:10px;">Pasirink žaidėją</p>';
            return;
        }
        
        const target = gameState.players.find(p => p.id === targetId);
        
        if (!target) {
            container.innerHTML = '<p style="color:#dc3545; padding:10px;">Žaidėjas nerastas</p>';
            return;
        }
        
        if (target.properties.length === 0) {
            container.innerHTML = '<p style="color:#6c757d; padding:10px;">Šis žaidėjas neturi kortelių</p>';
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
        html = '<p style="color:#6c757d; padding:10px;">Nėra kortelių</p>';
    }
    container.innerHTML = html;
    
    setTimeout(initTradeMiniCardTooltips, 50);
}

function confirmProposeTrade() {
    const targetId = parseInt(document.getElementById('tradeTargetPlayer').value);
    const offerMoney = parseInt(document.getElementById('tradeOfferMoney').value) || 0;
    const requestMoney = parseInt(document.getElementById('tradeRequestMoney').value) || 0;
    
    if (isNaN(targetId) || targetId === '' || document.getElementById('tradeTargetPlayer').value === '') {
        alert('❌ Pasirink žaidėją!');
        playErrorSound();
        return;
    }
    
    if (selectedOfferFields.length === 0 && offerMoney === 0) {
        alert('❌ Pasirink ką siūlai (kortelę arba pinigus)!');
        playErrorSound();
        return;
    }
    
    if (selectedRequestFields.length === 0 && requestMoney === 0) {
        alert('❌ Pasirink ko prašai (kortelę arba pinigus)!');
        playErrorSound();
        return;
    }
    
    const target = gameState.players.find(p => p.id === targetId);
    
    let msg = `🤝 Siųsti pasiūlymą ${target.name}:\n\n`;
    msg += `📤 SIŪLAI:\n`;
    if (selectedOfferFields.length > 0) {
        selectedOfferFields.forEach(id => {
            const field = gameState.board.find(f => f.id === id);
            msg += `  - ${field.name}\n`;
        });
    }
    if (offerMoney > 0) {
        msg += `  - €${offerMoney} pinigų\n`;
    }
    msg += `\n📥 PRAŠAI:\n`;
    if (selectedRequestFields.length > 0) {
        selectedRequestFields.forEach(id => {
            const field = gameState.board.find(f => f.id === id);
            msg += `  - ${field.name}\n`;
        });
    }
    if (requestMoney > 0) {
        msg += `  - €${requestMoney} pinigų\n`;
    }
    
    if (confirm(msg)) {
        const tradeData = {
            targetPlayerId: targetId,
            offerFieldIds: selectedOfferFields,
            requestFieldIds: selectedRequestFields,
            offerMoney: offerMoney,
            requestMoney: requestMoney
        };
        
        // 🆕 Counter-offer arba naujas pasiūlymas
        if (window.lastIncomingTrade) {
            socket.emit('counterTrade', {
                tradeId: window.lastIncomingTrade.tradeId,
                offerFieldIds: selectedOfferFields,
                requestFieldIds: selectedRequestFields,
                offerMoney: offerMoney,
                requestMoney: requestMoney
            });
            window.lastIncomingTrade = null;
            
            closeTrading();
            const tradeMsg = `🔄 Pakoreguotas pasiūlymas išsiųstas ${target.name}`;
            addNotification(tradeMsg);
            addJournal(tradeMsg);
            playClickSound();
            playTradeSound();
        } else {
            socket.emit('proposeTrade', tradeData);
            closeTrading();
            const tradeMsg = `📩 Pasiūlymas išsiųstas ${target.name}`;
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
    
    document.getElementById('offerFromPlayer').textContent = data.fromPlayer || 'Nežinomas';
    
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
        return '<div style="font-size:11px; color:#6c757d; text-align:center; padding:4px;">Tik pinigai</div>';
    }
    
    if (!gameState || !gameState.board) {
        return '<div style="font-size:11px; color:#6c757d;">Nėra duomenų</div>';
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
    playClickSound();
}

function acceptTrade() {
    if (!currentTradeId) return;
    if (confirm('✅ Ar tikrai nori priimti šį pasiūlymą?')) {
        socket.emit('respondToTrade', { tradeId: currentTradeId, accept: true });
        closeTradeOffer();
        playClickSound();
    }
}

function rejectTrade() {
    if (!currentTradeId) return;
    if (confirm('❌ Ar tikrai nori atmesti šį pasiūlymą?')) {
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
        alert('⏳ Ne tavo eilė!');
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
        container.innerHTML = '<p style="color:#6c757d; padding:10px; text-align:center;">Neturi namų ar viežbučių kuriuos galėtum griauti.</p>';
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
        const typeText = prop.isHotel ? 'VIEŽBUTIS' : `${prop.houses} namai`;
        
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
    if (rule === 1) {
        candidates = props.map(id => board[id]).filter(f => f && f.type === 'property' && f.color && isFullGroup(f.color));
    } else if (rule === 2) {
        if (stand && stand.type === 'property' && stand.color && props.includes(stand.id) && isFullGroup(stand.color)) {
            candidates = getGroupByColor(stand.color).map(id => board[id]).filter(f => f && !(built[f.id] >= 1));
        }
    } else {
        if (stand && stand.type === 'property' && stand.color && isFullGroup(stand.color) && !(built[stand.id] >= 1)) {
            candidates = [stand];
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
        if (allHave4) { out.push({ field: f, houses: cur, isHotel: true }); return; }
        if (max - min <= 1 && cur === min && cur < 4) out.push({ field: f, houses: cur, isHotel: false });
    });
    return out;
}

function buildHouse() {
    if (!isMyTurn) {
        alert('⏳ Ne tavo eilė!');
        playErrorSound();
        return;
    }
    if (myPlayer && myPlayer.isDebtor) {
        alert('⚠️ Tu skolingas! Pirmiausia atsiskaityk!');
        playErrorSound();
        return;
    }
    if (!gameState || !myPlayer) {
        alert('❌ Nėra žaidimo būsenos!');
        playErrorSound();
        return;
    }
    const opts = getBuildableFields();
    if (opts.length === 0) {
        alert('❌ ' + tt('game.buildNothing', 'Pagal statybų taisyklę dabar statyti negalima'));
        playErrorSound();
        return;
    }
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
    ov.querySelector('.bp-rule').textContent = `${tt('game.buildRuleIs', 'Statybų taisyklė')}: ${rule}. ${buildRuleLabel(rule)}`;
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
        info.textContent = o.isHotel ? '🏠×4 → 🏨' : ('🏠'.repeat(o.houses) || '–') + ' → ' + '🏠'.repeat(o.houses + 1);
        btn.append(sw, name, info);
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
        alert('⏳ Ne tavo eilė!');
        playErrorSound();
        return;
    }
    
    if (!myPlayer || !myPlayer.inJail) {
        alert('❌ Nesi kalėjime!');
        playErrorSound();
        return;
    }
    
    if (myPlayer.money < 50) {
        alert('❌ Neturi pakankamai pinigų! (reikia €50)');
        playErrorSound();
        return;
    }
    
    if (confirm(`⛓️ Sumokėti €50 ir išeiti iš kalėjimo?`)) {
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
        alert('Klaida: nėra ryšio su serveriu!');
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
    // 🏗️ Statybų langas (sinchronizuojam laiką su serveriu)
    if (state.buildWindow && state.buildWindow.playerId === playerId) {
        const dl = Date.now() + state.buildWindow.msLeft;
        if (!buildWin.open || Math.abs(dl - buildWin.deadline) > 1200) openBuildWindowPanel(state.buildWindow.msLeft);
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
    if (rcb && state.buildRule) rcb.textContent = `👉 ${tt('game.buildRuleThisTable', 'Šiame stale')}: ${state.buildRule}. ${buildRuleLabel(state.buildRule)}`;
    
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
            miniCardsHtml = '<div style="font-size:9px; color:#6c757d; margin-top:4px;">Neturi kortelių</div>';
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
    <div style="color:#3d2b1f;">🏠 ${me.properties.length} objektai (${housesInfo} namai)</div>
    ${me.inJail ? '<div style="color:#dc3545; font-weight:700;">⛓️ KALĖJIME</div>' : ''}
    ${me.bankrupt ? '<div style="color:#dc3545; font-weight:700;">💀 BANKROTAS</div>' : ''}
    ${me.left ? '<div style="color:#6c757d; font-weight:700;">😭 PASITRAUKEI</div>' : ''}
    ${me.kicked ? '<div style="color:#dc3545; font-weight:700;">🚫 PAŠALINTAS</div>' : ''}
    ${me.isDebtor ? '<div style="color:#dc3545; font-weight:700; animation: blink 1s infinite;">⚠️ SKOLINGAS €' + Math.abs(me.money) + '!</div>' : ''}
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
            miniCardsContainer.innerHTML = `<div style="font-size:9px; color:#6c757d; margin-top:4px; text-align:center; width:100%;">Neturi kortelių</div>`;
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
            <span class="pname">${p.isBot ? '<span class="pbot">🤖 </span>' : ''}${p.name} ${p.id === playerId ? '👤' : ''}${p.disconnected ? ' <span title="Atsijungęs">📴</span>' : ((p.afkAutoMoves || 0) > 0 && !p.bankrupt ? ' <span title="AFK">💤</span>' : '')}</span>
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
    
    if (blockedByAction) {
        rollBtn.disabled = true;
    } else {
        rollBtn.disabled = !isMyTurn || isBankrupt || isLeft || isKicked || isDebtor;
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

    const buildBtn = document.getElementById('buildBtn');
    if (buildBtn) {
        // Kol figūrėlė eina / laukiama langelio apdorojimo – mygtuko nerodom
        const moving = (typeof isAnimating !== 'undefined' && isAnimating) ||
            (window.animatingPlayers && window.animatingPlayers.includes(playerId)) ||
            (gameState && (gameState.isRolling || gameState.pendingFieldPlayerId === playerId || gameState.taxiOffer));
        const opts = (!moving && isMyTurn && !isBankrupt && !isLeft && !isKicked && !isDebtor && myPlayer && gameState)
            ? getBuildableFields() : [];
        if (opts.length > 0) {
            const onlyHotel = opts.every(o => o.isHotel);
            buildBtn.textContent = (onlyHotel ? tt('game.buildHotelBtn', '🏨 Statyti viešbutį') : tt('game.buildHouseBtn', '🏠 Statyti namą')) +
                (opts.length > 1 ? ` (${opts.length})` : '');
            buildBtn.style.display = 'block';
            buildBtn.disabled = false;
        } else {
            buildBtn.style.display = 'none';
            buildBtn.disabled = true;
        }
    }
    
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
            html += `<span class="cell-bg-icon">${field.icon}</span>`;
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
    const cell = window.CELL_MESSAGES?.[cellId];
    if (!cell) {
        console.warn('⚠️ Nėra pranešimų langeliui:', cellId);
        return '';
    }
    
    let msg = cell.messages?.[type] || '';
    if (!msg) return '';
    
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
    
    for (const [k, v] of Object.entries(data)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    
    return text;
}

function getCountSuffix(count) {
    if (count === 1) return 'as';
    return 'ai';
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
    if (nameEl) nameEl.textContent = winnerName || 'Nežinomas';
    
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
                <div style="color:#d4b896; font-size:13px; margin-bottom:4px;">⏱️ Žaidimo trukmė</div>
                <div style="color:#ffd700; font-size:24px; font-weight:700;">${minutes}:${seconds.toString().padStart(2, '0')}</div>
            </div>
        `;
    }
    
    html += `
        <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin-bottom:15px;">
            <div style="color:#ffd700; font-size:14px; font-weight:700; margin-bottom:8px;">🎯 BENDRI SKAIČIAI</div>
            <div style="display:flex; justify-content:space-between; color:#fff; font-size:13px; margin-bottom:4px;">
                <span>🎲 Iš viso metimų:</span>
                <strong>${window.gameStats.totalRolls}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; color:#fff; font-size:13px;">
                <span>🎲 Iš viso dublių:</span>
                <strong>${window.gameStats.totalDoubles}</strong>
            </div>
        </div>
    `;
    
    const players = Object.values(window.gameStats.players);
    
    if (players.length === 0) {
        html += `<div style="color:#d4b896; text-align:center; padding:20px;">Nėra statistikos</div>`;
    } else {
        html += `<div style="color:#ffd700; font-size:14px; font-weight:700; margin-bottom:8px;">👥 ŽAIDĖJŲ STATISTIKA</div>`;
        
        players.forEach(p => {
            html += `
                <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:12px; margin-bottom:10px; border-left:4px solid ${p.color};">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="width:16px; height:16px; border-radius:50%; background:${p.color}; border:2px solid rgba(255,255,255,0.5);"></span>
                        <span style="color:#fff; font-weight:700; font-size:14px;">${p.name}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px; color:#d4b896;">
                        <div>🎲 Metimai: <strong style="color:#fff;">${p.metimai}</strong></div>
                        <div>🎲 Dubliai: <strong style="color:#fff;">${p.dubliai}</strong></div>
                        <div>⛓️ Kalėjimai: <strong style="color:#fff;">${p.patekoIKalejima}</strong></div>
                        <div>🏠 Nusipirko: <strong style="color:#fff;">${p.nusipirko}</strong></div>
                        <div>🏠 Pastatė: <strong style="color:#fff;">${p.pastate}</strong></div>
                        <div>💰 Gauta nuomos: <strong style="color:#28a745;">€${p.nuomaGavo}</strong></div>
                        <div>💸 Sumokėta nuomos: <strong style="color:#dc3545;">€${p.nuomaSumokejo}</strong></div>
                        <div>💀 Bankrotai: <strong style="color:#fff;">${p.bankrotai}</strong></div>
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
            btn.innerHTML = '🎵 Muzika: 🔴 IŠJ.';
            btn.classList.remove('active');
        }
        if (toggleBtn) {
            toggleBtn.textContent = '🔊 Įjungti muziką';
        }
        localStorage.setItem('bancrupt_music', 'false');
    } else {
        startBackgroundMusic();
        if (btn) {
            btn.innerHTML = '🎵 Muzika: 🟢 ĮJ.';
            btn.classList.add('active');
        }
        if (toggleBtn) {
            toggleBtn.textContent = '🔇 Išjungti muziką';
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
    
    content.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:13px;">⏳ Kraunama...</p>';
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
        content.innerHTML = '<p style="color:#dc3545; text-align:center; font-size:13px;">❌ Nepavyko įkelti pranešimų</p>';
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
        content.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:13px;">📭 Neturi pranešimų</p>';
        return;
    }
    
    const typeIcons = {
        bug: '🐛 Klaida',
        idea: '💡 Pasiūlymas',
        complaint: '⚠️ Nusiskundimas'
    };
    
    const statusBadges = {
        new: { icon: '🆕', text: 'Naujas', color: '#ffc107', textColor: '#000' },
        in_progress: { icon: '🔄', text: 'Vykdoma', color: '#17a2b8', textColor: '#fff' },
        resolved: { icon: '✅', text: 'Išspręsta', color: '#28a745', textColor: '#fff' },
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
        content.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:13px;">⏳ Kraunama...</p>';
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
        errorEl.textContent = '❌ Aprašymas per trumpas (bent 5 simboliai)';
        return;
    }
    
    if (message.length > 2000) {
        errorEl.textContent = '❌ Aprašymas per ilgas (max 2000 simbolių)';
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
        
        alert('✅ Dėkojame! Pranešimas gautas.');
        closeFeedback();
    } catch (err) {
        console.error('❌ Feedback klaida:', err);
        errorEl.textContent = '❌ Serverio klaida. Bandyk dar kartą.';
    }
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
        } else if (gameState?.turnTimerActive && gameState?.turnTimerEndTime && gameState.turnTimerEndTime > Date.now()) {
            const left = Math.max(0, Math.floor((gameState.turnTimerEndTime - Date.now()) / 1000));
            txt = `⏱️ ${left}s`;
            color = left <= 10 ? '#ff4d4d' : (left <= 30 ? '#ff8c00' : '#ffd700');
        }
        headerTimer.textContent = txt;
        headerTimer.style.color = color;
        headerTimer.style.display = txt ? '' : 'none';
    }
    
    if (!turnTimerBox || !turnTimerEl) return;
    
    // 🆕 1. PIRKIMO LAIKAS (prioritetas)
    if (gameState?.buyTimeoutActive && gameState?.buyTimeoutEndTime) {
        const buyTimeLeft = Math.max(0, Math.floor((gameState.buyTimeoutEndTime - Date.now()) / 1000));
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        
        if (buyTimeLeft > 0) {
            if (turnTimerLabel) turnTimerLabel.textContent = '🛒 PIRKIMO LAIKAS';
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
    
    // 🆕 2. ĖJIMO LAIKAS
    if (gameState?.turnTimerActive && gameState?.turnTimerEndTime) {
        const timeLeft = Math.max(0, Math.floor((gameState.turnTimerEndTime - Date.now()) / 1000));
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        
        if (timeLeft > 0) {
            if (turnTimerLabel) turnTimerLabel.textContent = '⏱️ LIKO LAIKO';
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
