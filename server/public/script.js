// ============================================
// script.js - PILNAS
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
let infoMode = false;
let lastHoveredField = null;

// VOTE-KICK
let voteKickTimerInterval = null;
let amIKicked = false;

// SPALVŲ PASIRINKIMAS
const PLAYER_COLORS = [
    '#9c0505', '#e2de00', '#5506d3', '#05b130',
    '#000000', '#00adc4', '#492b1f', '#0609d6'
];

let selectedCreateColor = null;
let selectedJoinColor = null;
let availableJoinColors = [];
let joinColorCheckTimeout = null;

// WAITING ROOM
let waitingRoomState = null;

// VIEŠI STALAI
let publicGamesCheckInterval = null;

// INFO PANELĖS ŠRIFTAS
let infoResizeObserver = null;

// ============================================
// PRISIJUNGIMAS
// ============================================

function initSocket() {
    console.log('🔄 Inicijuojamas socket...');
    
    const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://responsible-nourishment-production.up.railway.app';
    
    console.log('🌐 Serverio URL:', SERVER_URL);
    
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
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
        showLobbyMessage('🔴 Nepavyko prisijungti prie serverio! Įsitikink, kad serveris paleistas.', '#dc3545');
        playErrorSound();
    });

    socket.on('disconnect', () => {
        console.log('❌ Atsijungta nuo serverio');
        isConnected = false;
        showLobbyMessage('🔴 Atsijungta nuo serverio', '#dc3545');
    });

    socket.on('error', (msg) => {
        console.log('❌ Klaida:', msg);
        playErrorSound();
        alert('❌ ' + msg);
    });

    socket.on('gameCreated', (data) => {
        console.log('✅ Žaidimas sukurtas:', data);
        gameId = data.gameId;
        playerId = data.playerId;
        myPlayer = data.player;
        
        localStorage.setItem('bancrupt_gameId', gameId);
        localStorage.setItem('bancrupt_playerToken', data.player.token);
        
        document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
        showLobbyMessage(`✅ Žaidimas sukurtas! ID: ${gameId}`, '#28a745');
        playStartSound();
        enterGame();
    });

    socket.on('joinedGame', (data) => {
        console.log('✅ Prisijungta prie žaidimo:', data);
        playerId = data.playerId;
        myPlayer = data.player;
        
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
        console.log('📊 Gauta žaidimo būsena');
        gameState = state;
        updateUI(state);
        document.getElementById('bankruptModal').style.display = 'none';
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

    socket.on('waitingRoomUpdate', (state) => {
        console.log('⏳ Waiting room update:', state);
        updateWaitingRoom(state);
    });

    socket.on('gameStarted', (data) => {
        console.log('🎮 Žaidimas pradėtas:', data);
        playStartSound();
        
        const msg = `🎮 Žaidimas pradėtas! Pirmas eina: ${data.firstPlayerName}`;
        addNotification(msg);
        addJournal(msg);
        
        hideWaitingRoom();
        
        if (gameState) updateUI(gameState);
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
            addNotification('🌐 Stalas dabar viešas!');
        } else {
            addNotification('🔒 Stalas dabar privatus');
        }
    });

    socket.on('publicGamesList', (games) => {
        console.log('🌐 Viešų stalų sąrašas:', games);
        renderPublicGames(games);
    });

    // ============================================
    // 🆕 KAULIUKŲ METIMAS - SKIRTINGAI SAU IR KITIEMS
    // ============================================
    socket.on('diceRolled', (data) => {
    console.log('🎲 Kauliukai mesti:', data);
    playDiceSound();
    updateDiceDisplay(data.dice[0], data.dice[1]);
    
    // Garsai
    if (data.field) {
        if (data.field.id === 2) playDujosSound();
        else if (data.field.id === 14) playSiukslesSound();
        else if (data.field.id === 28) playElektraSound();
        else if (data.field.id === 44) playVanduoSound();
        else if (data.field.id === 8) playAirPortSound();
        else if (data.field.id === 19) playTrainSound();
        else if (data.field.id === 37) playPortSound();
        else if (data.field.id === 46) playBusSound();
        else if (data.field.id === 13) playHospitalSound();
        else if (data.field.id === 21) playLatrasSound();
        else if (data.field.id === 32) playPirtisSound();
        else if (data.field.id === 50) playBirthdaySound();
    }
    
    // 🆕 KITIEMS - rodyk kito žaidėjo ėjimo langą
    if (!data.forSelf && data.canBuy && data.field) {
        showOtherPlayerChoice({
            playerName: data.player.name,
            fieldName: data.field.name,
            fieldCost: data.field.cost
        });
    }
    
    // 🆕 Į 5 langelį - TIK svarbūs pranešimai
    let notificationMsg = `${data.player.name} metė ${data.dice[0]}+${data.dice[1]}=${data.total}`;
    if (data.field) {
        notificationMsg += ` ir atsistojo ant "${data.field.name}"`;
    }
    
    if (data.result) {
        if (data.result.action === 'pay_rent') {
            notificationMsg += ` 💰 Sumokėjo nuomą!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'pay_tax') {
            notificationMsg += ` 💸 Sumokėjo mokesčius!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'go_to_jail') {
            notificationMsg += ` ⛓️ Keliauja į kalėjimą!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'birthday') {
            notificationMsg += ` 🎂 Gimtadienis!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'hospital') {
            notificationMsg += ` 🏥 Ligoninė!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'latras') {
            notificationMsg += ` 🍺 Latrų baras!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'pirtis') {
            notificationMsg += ` 🧖 Pirtis!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'special') {
            notificationMsg += ` 🎲 HORNY RP!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'chance') {
            notificationMsg += ` 🎲 Šansas!`;
            addNotification(notificationMsg);
        } else if (data.result.action === 'visiting_jail') {
            notificationMsg += ` 🚔 Svečiuose pas kalinius!`;
            addNotification(notificationMsg);
        }
    }
    
    // 🆕 ŽURNALE - visada
    if (data.result && data.result.message) {
        addJournal(data.result.message);
    }
    if (data.field) {
        addJournal(`${data.player.name} metė ${data.dice[0]}+${data.dice[1]}=${data.total} ir atsistojo ant "${data.field.name}"`);
    }
    updateUI(gameState);
});

    socket.on('message', (msg) => {
        console.log('📢 Pranešimas:', msg);
        
        addNotification(msg);
        
        if (msg.includes('HORNY RP') || msg.includes('gavai €200 nuo Dedo')) {
            playChanceSound();
        }
        if (msg.includes('pastatė namą')) {
            playBuildSound();
        }
        if (msg.includes('pastatė VIEZBUTĮ')) {
            playHotelSound();
        }
        if (msg.includes('Dabar eina')) {
            playMoveSound();
        }
        if (msg.includes('bankrotavo')) {
            playBankruptSound();
        }
        if (msg.includes('laimėjo aukcioną')) {
            playAuctionSound();
            playCashSound();
        }
        if (msg.includes('nusipirko')) {
            playBuySound();
            playCashSound();
        }
        if (msg.includes('nugriovė')) {
            playDemolishSound();
            playCashSound();
        }
        if (msg.includes('sumokėjo €') && msg.includes('nuomos')) {
            const isService1 = msg.includes('DUJOS') || msg.includes('ŠIUKŠLĖS') || 
                               msg.includes('ELEKTRA') || msg.includes('VANDUO');
            const isOroUostas = msg.includes('ORO UOSTAS') || msg.includes('ORO UOSTO');
            const isService2 = msg.includes('TRAUKINIŲ STOTIS') || 
                               (msg.includes('UOSTAS') && !isOroUostas) || 
                               msg.includes('AUTOBUSŲ STOTIS');
            
            if (!isService1 && !isOroUostas && !isService2) {
                playPaySound();
            }
        }
        if (msg.includes('sumokėjo') && msg.includes('mokesčių')) {
            playTaxSound();
        }
        if (msg.includes('prarado')) {
            playPaySound();
        }
        if (msg.includes('išėjo iš kalėjimo')) {
            playJailOutSound();
        }
        if (msg.includes('LAIMĖJO')) {
            playCelebrateSound();
            playWinSound();
        }
        if (msg.includes('pabėgo į kampą')) {
            playBankruptSound();
        }
        if (msg.includes('skolingas')) {
            playErrorSound();
        }
        if (msg.includes('grįžo į žaidimą')) {
            playStartSound();
        }
        
        addJournal(msg);
    });

    socket.on('chatMessage', (data) => {
        console.log('💬 Žinutė:', data);
        playNotificationSound();
        addChatMessage(data);
    });

    socket.on('showBuy', (data) => {
        console.log('🏠 Galima pirkti:', data);
        if (data.playerId === playerId) {
            showBuyChoice(data);
        }
    });

 // ============================================
// 🆕 PIRKIMAS - SKIRTINGAI SAU IR KITIEMS
// ============================================
socket.on('buyConfirmed', (data) => {
    console.log('✅ Pirkimas patvirtintas:', data);
    playBuySound();
    playCashSound();
    
    // Paslėpti pirkimo langą
    hideBuyChoice();
    
    const msg = data.forSelf 
        ? `✅ Jūs įsigijote ${data.fieldName}!` 
        : `🏠 ${data.playerName} nusipirko ${data.fieldName}!`;
    
    // 🆕 KITIEMS - parodyk sprendimo rezultatą "otherPlayerChoice" lange
    if (!data.forSelf) {
        showOtherPlayerResult({
            playerName: data.playerName,
            fieldName: data.fieldName,
            bought: true
        });
    }
    
    addNotification(msg);
    addJournal(`${data.playerName} nusipirko ${data.fieldName}`);
    if (gameState) updateUI(gameState);
});

// ============================================
// 🆕 ATSISAKYMAS - SKIRTINGAI SAU IR KITIEMS
// ============================================
    socket.on('buyCancelled', (data) => {
    console.log('❌ Pirkimas atšauktas:', data);
    playMoveSound();
    
    // Paslėpti pirkimo langą
    hideBuyChoice();
    
    const msg = data.forSelf 
        ? `❌ Jūs atsisakėte pirkti ${data.fieldName}` 
        : `❌ ${data.playerName} atsisakė pirkti ${data.fieldName}`;
    
    // 🆕 KITIEMS - parodyk sprendimo rezultatą "otherPlayerChoice" lange
    if (!data.forSelf) {
        showOtherPlayerResult({
            playerName: data.playerName,
            fieldName: data.fieldName,
            bought: false
        });
    }
    
    addNotification(msg);
    addJournal(`${data.playerName} atsisakė pirkti ${data.fieldName}`);
    if (gameState) updateUI(gameState);
});

    socket.on('bankruptConfirmed', (data) => {
        console.log('💀 GAUTAS BANKROTO PATVIRTINIMAS:', data);
        playBankruptSound();
        const msg = `💀 ${data.playerName} BANKROTAVO!`;
        addNotification(msg);
        addJournal(msg);
        if (data.playerId === playerId) {
            document.getElementById('bankruptMessage').style.display = 'flex';
        }
        updateUI(gameState);
    });

    socket.on('canBuildResult', (data) => {
        console.log('🏠 Statybos rezultatas:', data);
        if (data.can) {
            if (data.isHotel) {
                if (confirm(`🏨 Statyti viezbutį ant "${data.fieldName}" už €${data.cost}?`)) {
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
        addJournal(msg);
        
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
        } else {
            playMoveSound();
        }
        addNotification(data.message || 'Prekybos atsakymas gautas');
        addJournal(data.message || 'Prekybos atsakymas gautas');
        closeTradeOffer();
        if (gameState) updateUI(gameState);
    });

    socket.on('auctionStarted', (data) => {
        console.log('🔨 KLIENTAS GAUNA auctionStarted EVENTĄ');
        playAuctionSound();
        
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
                addJournal(msg);
            } else if (data.winnerName) {
                const msg = `🔨 ${data.winnerName} laimėjo aukcioną: ${data.fieldName} už €${data.finalBid}!`;
                addNotification(msg);
                addJournal(msg);
                playAuctionSound();
                playCashSound();
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
        addJournal(msg);
        playDemolishSound();
        playCashSound();
        if (gameState) updateUI(gameState);
    });

    socket.on('leftGame', (data) => {
        console.log('🏃 Pasitraukei iš žaidimo:', data);
        
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
        
        playWinSound();
        playCelebrateSound();
        
        setTimeout(() => {
            alert(`🏆 ŽAIDIMAS BAIGTAS!\n\nLaimėtojas: ${data.winner}`);
        }, 500);
    });

    // VOTE-KICK KLAUSYMAI

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
    
    console.log(`📏 Info panel: ${width}px → ${fontSize}px`);
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
        console.log('✅ Info ResizeObserver inicijuotas');
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
    
    selectedJoinColor = color;
    renderColorPicker('joinColorPicker', availableJoinColors, selectedJoinColor, selectJoinColor);
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
// WAITING ROOM FUNKCIJOS
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
}

function updateWaitingRoom(state) {
    waitingRoomState = state;
    
    console.log('🔄 Atnaujinu waiting room:', state);
    
    const countEl = document.getElementById('waitingPlayerCount');
    if (countEl) countEl.textContent = `${state.totalPlayers}/8`;
    
    const listEl = document.getElementById('waitingPlayersList');
    if (listEl) {
        if (state.players.length === 0) {
            listEl.innerHTML = '<p style="color:#d4b896; text-align:center;">Nėra žaidėjų</p>';
        } else {
            listEl.innerHTML = state.players.map(p => `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(255,255,255,0.08); border-radius:8px; ${p.ready ? 'border-left:3px solid #28a745;' : 'border-left:3px solid #6c757d;'}">
                    <span style="width:20px; height:20px; border-radius:50%; background:${p.color}; border:2px solid rgba(255,255,255,0.5); flex-shrink:0;"></span>
                    <span style="flex:1; color:#fff; font-weight:600; font-size:14px;">${p.name}${p.isHost ? ' 👑' : ''}${p.id === playerId ? ' (tu)' : ''}</span>
                    <span style="font-size:12px; font-weight:700; ${p.ready ? 'color:#28a745;' : 'color:#d4b896;'}">${p.ready ? '✅ Pasiruošęs' : '⏳ Laukia'}</span>
                    ${state.hostId === playerId && p.id !== playerId && !p.ready ? `
                        <button onclick="kickPlayer(${p.id})" style="padding:4px 8px; border:none; border-radius:4px; background:#dc3545; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">❌</button>
                    ` : ''}
                </div>
            `).join('');
        }
    }
    
    const statusEl = document.getElementById('waitingStatusText');
    if (statusEl) {
        if (state.canStart) {
            statusEl.innerHTML = '🎉 <strong style="color:#28a745;">Visi pasiruošę!</strong> Galima pradėti žaidimą.';
        } else if (state.totalPlayers < 2) {
            statusEl.innerHTML = `👥 Reikia bent <strong>2 žaidėjų</strong> • Turim: ${state.totalPlayers}`;
        } else {
            const notReady = state.totalPlayers - state.readyCount;
            statusEl.innerHTML = `✋ Dar <strong>${notReady} žaidėjas(-ai)</strong> nepasiruošęs(-ę)`;
        }
    }
    
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startGameBtn');
    
    if (readyBtn) {
        const me = state.players.find(p => p.id === playerId);
        if (me && me.ready) {
            readyBtn.innerHTML = '✅ Pasiruošęs (spausk atšaukti)';
            readyBtn.style.background = 'linear-gradient(145deg, #6c757d, #495057)';
        } else {
            readyBtn.innerHTML = '✋ Aš pasiruošęs';
            readyBtn.style.background = 'linear-gradient(145deg, #28a745, #1e7e34)';
        }
    }
    
    if (startBtn) {
        if (playerId === state.hostId) {
            startBtn.style.display = 'block';
            if (state.canStart) {
                startBtn.disabled = false;
                startBtn.style.opacity = '1';
                startBtn.innerHTML = '🚀 Pradėti žaidimą';
            } else {
                startBtn.disabled = true;
                startBtn.style.opacity = '0.5';
                startBtn.innerHTML = '🚀 Pradėti žaidimą (ne visi pasiruošę)';
            }
        } else {
            startBtn.style.display = 'none';
        }
    }
    
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

function startGame() {
    playClickSound();
    socket.emit('startGame');
}

function leaveGameFromWaiting() {
    if (!isConnected) {
        alert('❌ Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!socket || !socket.connected) {
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
        listEl.innerHTML = '<div class="public-games-empty">Nėra viešų stalų<br><br>Galite sukurti savo viešą stalą</div>';
        return;
    }
    
    listEl.innerHTML = games.map(g => `
        <div class="public-game-item" onclick="joinPublicGame('${g.gameId}')">
            <span style="font-size:24px;">🌐</span>
            <div style="flex:1;">
                <div class="game-host">👑 ${g.hostName}</div>
                <div class="game-count">👥 ${g.playerCount}/${g.maxPlayers} žaidėjai</div>
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
// VOTE-KICK FUNKCIJOS
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
    } else {
        panel.style.display = 'none';
    }
    playClickSound();
}

function changeVolume(value) {
    const volume = parseInt(value) / 100;
    
    if (audioManager) {
        audioManager.setVolume(volume);
        audioManager.isEnabled = volume > 0;
    }
    
    const valueDisplay = document.getElementById('volumeValue');
    if (valueDisplay) valueDisplay.textContent = value;
    
    localStorage.setItem('bancrupt_volume', value);
    
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
    const slider = document.getElementById('volumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    
    if (!slider || !muteBtn) return;
    
    if (isMuted) {
        isMuted = false;
        const volume = lastVolume || 50;
        slider.value = volume;
        changeVolume(volume);
        muteBtn.textContent = '🔇 Išjungti garsą';
    } else {
        isMuted = true;
        lastVolume = parseInt(slider.value) || 50;
        slider.value = 0;
        changeVolume(0);
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
        btn.innerHTML = 'ℹ️ Info: 🟢 ĮJ.';
        localStorage.setItem('bancrupt_infoMode', 'true');
        
        if (infoPanel) infoPanel.classList.add('show');
        
        if (lastHoveredField !== null) {
            showCellInfo(lastHoveredField);
        } else {
            hideCellInfo();
        }
    } else {
        btn.classList.remove('active');
        btn.innerHTML = 'ℹ️ Info: 🔴 IŠJ.';
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
    
    let html = `<div class="info-header">${field.icon || ''} ${field.name} (#${fieldId})</div>`;
    
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
        const baseRent = Math.floor(field.cost * 0.1);
        
        html += `<div class="info-section"><div class="info-section-title">🏘️ NUOMA</div>`;
        html += `<div class="info-row"><span class="label">Bazinė:</span><span class="value">€${baseRent}</span></div>`;
        
        const multipliers = [10, 20, 30, 40];
        for (let i = 1; i <= 4; i++) {
            const rent = Math.floor(baseRent * multipliers[i - 1]);
            html += `<div class="info-row"><span class="label">Su ${i} nam${i === 1 ? 'u' : 'ais'}:</span><span class="value">€${rent}</span></div>`;
        }
        
        const hotelRent = Math.floor(baseRent * 50);
        html += `<div class="info-row"><span class="label">🏨 Viešbutis:</span><span class="value">€${hotelRent}</span></div>`;
        html += `</div>`;
    }
    
    if (field.type === 'service1') {
        html += `<div class="info-section"><div class="info-section-title">🏘️ NUOMA</div>`;
        html += `<div class="info-row"><span class="label">1 langelis:</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">2 langeliai:</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">3 langeliai:</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">4 langeliai:</span><span class="value">€200</span></div>`;
        html += `</div>`;
    }
    
    if (field.type === 'service2') {
        html += `<div class="info-section"><div class="info-section-title">🏘️ NUOMA</div>`;
        html += `<div class="info-row"><span class="label">1 langelis:</span><span class="value">€50</span></div>`;
        html += `<div class="info-row"><span class="label">2 langeliai:</span><span class="value">€100</span></div>`;
        html += `<div class="info-row"><span class="label">3 langeliai:</span><span class="value">€150</span></div>`;
        html += `<div class="info-row"><span class="label">4 langeliai:</span><span class="value">€200</span></div>`;
        html += `</div>`;
    }
    
    if (field.type === 'tax') {
        if (field.id === 5) {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€200</span></div></div>`;
        } else if (field.id === 21) {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€10</span></div></div>`;
        } else if (field.id === 32) {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€25</span></div></div>`;
        } else if (field.id === 50) {
            html += `<div class="info-section"><div class="info-row"><span class="label">🎁 Gausi:</span><span class="value green">€200</span></div></div>`;
        } else {
            html += `<div class="info-section"><div class="info-row"><span class="label">💸 Mokestis:</span><span class="value red">€${field.cost}</span></div></div>`;
        }
    }
    
    if (field.type === 'special') {
        if (field.id === 13) {
            html += `<div class="info-section"><div class="info-row"><span class="label">🏥 Sumokėsi:</span><span class="value red">€100</span></div></div>`;
        } else if (field.id === 4) {
            html += `<div class="info-section"><div class="info-row"><span class="label">🎲 Gausi:</span><span class="value green">€200</span></div></div>`;
        }
    }
    
    tooltip.innerHTML = html;
    
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
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function hideCellInfo() {
    lastHoveredField = null;
    const tooltip = document.getElementById('cellInfoTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.innerHTML = '';
    }
}

// ============================================
// IŠŠOKANTYS PRANEŠIMAI → 5 LANGELIS
// ============================================

function showPopupMessage(message, type) {
    // Visi pranešimai eina į 5 langelį
    addNotification(message);
}

// ============================================
// 🆕 KITO ŽAIDĖJO ĖJIMO LANGAS
// ============================================

function showOtherPlayerChoice(data) {
    const choice = document.getElementById('otherPlayerChoice');
    if (!choice) return;
    
    document.getElementById('otherChoicePlayerName').textContent = data.playerName || 'Žaidėjas';
    document.getElementById('otherChoiceFieldName').textContent = data.fieldName || 'Sklypas';
    document.getElementById('otherChoiceFieldCost').textContent = '€' + (data.fieldCost || 0);
    
    choice.style.display = 'flex';
    choice.classList.add('show');
}

function hideOtherPlayerChoice() {
    const choice = document.getElementById('otherPlayerChoice');
    if (!choice) return;
    choice.style.display = 'none';
    choice.classList.remove('show');
}

const style = document.createElement('style');
style.textContent = `
    @keyframes popupFadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
    }
`;
document.head.appendChild(style);

// ============================================
// PRANEŠIMAI
// ============================================

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
    
    const isPublicCheckbox = document.getElementById('createIsPublic');
    const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;
    
    socket.emit('createGame', {
        name: name,
        color: selectedCreateColor,
        isPublic: isPublic
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
    socket.emit('joinGame', { 
        gameId: gid, 
        playerName: name,
        color: selectedJoinColor
    });
}

function enterGame() {
    if (typeof goToGame === 'function') {
        goToGame();
    }
    
    document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
    
    const gameIdLeft = document.getElementById('gameIdDisplayLeft');
    if (gameIdLeft) gameIdLeft.textContent = gameId;
    
    const savedVolume = localStorage.getItem('bancrupt_volume') || 50;
    const slider = document.getElementById('volumeSlider');
    const valueDisplay = document.getElementById('volumeValue');
    if (slider) slider.value = savedVolume;
    if (valueDisplay) valueDisplay.textContent = savedVolume;
    changeVolume(savedVolume);
    
    const savedInfoMode = localStorage.getItem('bancrupt_infoMode');
    if (savedInfoMode === 'true') {
        infoMode = true;
        const btn = document.getElementById('infoBtn');
        const infoPanel = document.getElementById('cellInfoPanel');
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = 'ℹ️ Info: 🟢 ĮJ.';
        }
        if (infoPanel) infoPanel.classList.add('show');
    }
    
    socket.emit('getGameState');
    
    setTimeout(() => {
        socket.emit('getWaitingRoom');
        showWaitingRoom();
    }, 300);
    
    setTimeout(initInfoResizeObserver, 1000);
}

// ============================================
// PASITRAUKIMAS
// ============================================

function leaveGame() {
    if (!isConnected) {
        alert('❌ Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!socket || !socket.connected) {
        alert('❌ Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!confirm('🏃 Ar tikrai nori pasitraukti?\n\nPrarasi visus pinigus ir korteles!\nNegalėsi grįžti į šį stalą.')) {
        return;
    }
    
    playClickSound();
    socket.emit('leaveGame');
}

// ============================================
// KAULIUKAI
// ============================================

function updateDiceDisplay(value1, value2) {
    updateSingleDice('centerDice1', value1);
    updateSingleDice('centerDice2', value2);
    
    const dice1 = document.getElementById('centerDice1');
    const dice2 = document.getElementById('centerDice2');
    
    if (dice1) dice1.classList.add('rolling');
    if (dice2) dice2.classList.add('rolling');
    
    setTimeout(() => {
        if (dice1) dice1.classList.remove('rolling');
        if (dice2) dice2.classList.remove('rolling');
    }, 500);
}

function updateSingleDice(diceId, value) {
    const dice = document.getElementById(diceId);
    if (!dice) return;
    
    const container = dice.querySelector('.dice-dots-container');
    if (!container) return;
    
    const allDots = container.querySelectorAll('.dice-dot');
    allDots.forEach(dot => dot.classList.remove('visible'));
    
    const patterns = {
        1: ['cc'],
        2: ['tl', 'br'],
        3: ['tl', 'cc', 'br'],
        4: ['tl', 'tr', 'bl', 'br'],
        5: ['tl', 'tr', 'cc', 'bl', 'br'],
        6: ['tl', 'cl', 'bl', 'tr', 'cr', 'br']
    };
    
    const positions = patterns[value];
    if (positions) {
        positions.forEach(pos => {
            const dot = container.querySelector(`.dot-${pos}`);
            if (dot) dot.classList.add('visible');
        });
    }
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

function hideBuyChoice() {
    const choice = document.getElementById('buyChoice');
    choice.style.display = 'none';
    choice.classList.remove('show');
}

function confirmBuy() {
    socket.emit('buyProperty');
    playClickSound();
    hideBuyChoice();
}

function cancelBuy() {
    socket.emit('cancelBuy');
    playClickSound();
    hideBuyChoice();
}

// ============================================
// ŽAIDIMO VALDYMAS
// ============================================

function rollDice() {
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
    
    playClickSound();
    socket.emit('rollDice');
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
    
    const properties = gameState.players.find(p => p.id === playerId).properties || [];
    let html = '';
    
    properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = myPlayer.houses && myPlayer.houses[fieldId] ? myPlayer.houses[fieldId] : 0;
        if (houses > 0) return;
        
        const price = Math.floor(field.cost * 0.8);
        const checked = selectedSellFields.includes(fieldId) ? 'checked' : '';
        html += `
            <div style="padding:8px; border-bottom:1px solid #ddd;">
                <input type="checkbox" ${checked} onchange="toggleSellField(${fieldId})" id="sell_${fieldId}">
                <label for="sell_${fieldId}" style="font-weight:600;">${field.name}</label>
                <span style="float:right; color:#28a745;">€${price}</span>
            </div>
        `;
    });
    
    if (!html) {
        html = '<p style="color:#6c757d;">Neturi kortelių be namų</p>';
    }
    container.innerHTML = html;
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
    
    const properties = gameState.players.find(p => p.id === playerId).properties || [];
    let html = '';
    let hasProperties = false;
    
    properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = myPlayer.houses && myPlayer.houses[fieldId] ? myPlayer.houses[fieldId] : 0;
        if (houses > 0) return;
        
        hasProperties = true;
        const checked = (selectedAuctionField === fieldId) ? 'checked' : '';
        
        html += `
            <div style="padding:8px; border-bottom:1px solid #ddd; cursor:pointer;" onclick="selectAuctionField(${fieldId})">
                <input type="radio" name="auctionField" ${checked} id="auction_${fieldId}" style="margin-right:10px;">
                <label for="auction_${fieldId}" style="font-weight:600; cursor:pointer;">${field.name}</label>
                <span style="float:right; color:#6c757d;">€${field.cost}</span>
            </div>
        `;
    });
    
    if (!hasProperties) {
        html = '<p style="color:#6c757d; padding:10px;">Neturi kortelių be namų</p>';
    }
    container.innerHTML = html;
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
    
    const currentPlayerId = myPlayer?.id !== undefined ? myPlayer.id : playerId;
    
    select.innerHTML = '';
    let found = false;
    gameState.players.forEach(p => {
        if (p.id !== currentPlayerId && p.isActive && !p.bankrupt && !p.left && !p.kicked) {
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
    
    let html = '';
    let count = 0;
    
    if (myPlayer.properties.length === 0) {
        container.innerHTML = '<p style="color:#6c757d; padding:10px;">Neturi kortelių</p>';
        return;
    }
    
    html += '<div style="display:flex; flex-wrap:wrap; gap:5px; padding:5px;">';
    
    myPlayer.properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = myPlayer.houses && myPlayer.houses[fieldId] ? myPlayer.houses[fieldId] : 0;
        if (houses > 0) return;
        
        const checked = selectedOfferFields.includes(fieldId) ? 'checked' : '';
        const color = field.color || '#c9a84c';
        
        html += `
            <div style="background:${color}; padding:4px 8px; border-radius:6px; border:2px solid ${checked ? '#28a745' : 'rgba(255,255,255,0.3)'}; display:flex; align-items:center; gap:4px; cursor:pointer; transition:all 0.2s; box-shadow: ${checked ? '0 0 10px rgba(40,167,69,0.4)' : 'none'};" 
                 onclick="document.getElementById('offer_${fieldId}').click()">
                <input type="checkbox" ${checked} onchange="toggleOfferField(${fieldId})" id="offer_${fieldId}" style="margin:0; cursor:pointer;">
                <span style="font-size:10px; color:#fff; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,0.3);">${field.name}</span>
                <span style="font-size:8px; color:rgba(255,255,255,0.7);">€${field.cost}</span>
            </div>
        `;
        count++;
    });
    
    html += '</div>';
    
    if (count === 0) {
        html = '<p style="color:#6c757d; padding:10px;">Neturi kortelių be namų</p>';
    }
    container.innerHTML = html;
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
    
    const targetId = parseInt(targetSelectElem.value);
    
    if (!gameState) {
        container.innerHTML = '<p style="color:#6c757d; padding:10px;">Nėra žaidimo būsenos</p>';
        return;
    }
    
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
    
    let html = '';
    let count = 0;
    html += '<div style="display:flex; flex-wrap:wrap; gap:5px; padding:5px;">';
    
    target.properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = target.houses && target.houses[fieldId] ? target.houses[fieldId] : 0;
        if (houses > 0) return;
        
        const checked = selectedRequestFields.includes(fieldId) ? 'checked' : '';
        const color = field.color || '#c9a84c';
        
        html += `
            <div style="background:${color}; padding:4px 8px; border-radius:6px; border:2px solid ${checked ? '#28a745' : 'rgba(255,255,255,0.3)'}; display:flex; align-items:center; gap:4px; cursor:pointer; transition:all 0.2s; box-shadow: ${checked ? '0 0 10px rgba(40,167,69,0.4)' : 'none'};" 
                 onclick="document.getElementById('request_${fieldId}').click()">
                <input type="checkbox" ${checked} onchange="toggleRequestField(${fieldId})" id="request_${fieldId}" style="margin:0; cursor:pointer;">
                <span style="font-size:10px; color:#fff; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,0.3);">${field.name}</span>
                <span style="font-size:8px; color:rgba(255,255,255,0.7);">€${field.cost}</span>
            </div>
        `;
        count++;
    });
    
    html += '</div>';
    
    if (count === 0) {
        html = '<p style="color:#6c757d; padding:10px;">Šis žaidėjas neturi kortelių be namų</p>';
    }
    container.innerHTML = html;
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
        
        socket.emit('proposeTrade', tradeData);
        closeTrading();
        const tradeMsg = `📩 Pasiūlymas išsiųstas ${target.name}`;
        addNotification(tradeMsg);
        addJournal(tradeMsg);
        playClickSound();
        playTradeSound();
    }
}

function showTradeOffer(data) {
    document.getElementById('offerFromPlayer').textContent = data.fromPlayer;
    document.getElementById('offerField').textContent = data.offerField || 'Pinigai';
    document.getElementById('offerMoney').textContent = data.offerMoney || 0;
    document.getElementById('requestField').textContent = data.requestField || 'Pinigai';
    document.getElementById('requestMoney').textContent = data.requestMoney || 0;
    
    currentTradeId = data.tradeId;
    document.getElementById('tradeOfferModal').style.display = 'flex';
    playNotificationSound();
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
    if (!currentTradeId) return;
    closeTradeOffer();
    openTrading();
    alert('🔄 Atidarytas prekybos langas. Sukurk priešingą pasiūlymą.');
    playClickSound();
}

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
        container.innerHTML = '<p style="color:#6c757d; padding:10px; text-align:center;">Neturi namų ar viezbučių kuriuos galėtum griauti.</p>';
        return;
    }
    
    let html = '';
    properties.forEach(prop => {
        let houseIcons = '';
        if (prop.isHotel) {
            houseIcons = '🏨';
        } else {
            for (let i = 0; i < prop.houses; i++) {
                houseIcons += '🏠';
            }
        }
        
        const color = prop.color || '#c9a84c';
        const typeText = prop.isHotel ? 'VIEZBUTIS' : `${prop.houses} namai`;
        
        html += `
            <div class="demolish-card" onclick="confirmDemolish(${prop.id})">
                <div class="card-color" style="background:${color};"></div>
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
    
    const currentField = gameState.board[myPlayer.position];
    if (!currentField) {
        alert('❌ Nerastas dabartinis sklypas!');
        playErrorSound();
        return;
    }
    
    if (currentField.type !== 'property' && currentField.type !== 'service2') {
        alert('❌ Čia negalima statyti namo!');
        playErrorSound();
        return;
    }
    
    if (!currentField.color) {
        alert('❌ Šis sklypas neturi spalvos!');
        playErrorSound();
        return;
    }
    
    playClickSound();
    socket.emit('canBuildHouse', { fieldId: currentField.id });
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
        playPaySound();
    }
}

function bankrupt() {
    if (!isMyTurn && !(myPlayer && myPlayer.isDebtor)) {
        alert('⏳ Ne tavo eilė!');
        playErrorSound();
        return;
    }
    document.getElementById('bankruptModal').style.display = 'flex';
    playClickSound();
}

function confirmBankrupt() {
    document.getElementById('bankruptModal').style.display = 'none';
    playClickSound();
    
    if (!socket || !socket.connected) {
        alert('Klaida: nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    socket.emit('bankrupt', playerId);
}

function cancelBankrupt() {
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
    const groups = {
        '#ffd700': [1, 3],
        '#4a90d9': [6, 7, 9],
        '#2ecc71': [10, 12, 15],
        '#9b59b6': [17, 18, 20],
        '#e74c3c': [22, 23, 25],
        '#8B6914': [27, 29, 30],
        '#1abc9c': [31, 33, 34],
        '#ff69b4': [35, 36, 38],
        '#2c3e50': [39, 40, 41],
        '#1a237e': [43, 45, 47],
        '#bdc3c7': [49, 51]
    };
    return groups[color] || [];
}

function setMode(mode) {
    const board = document.getElementById('board');
    board.className = mode;
    
    const adaptiveBtn = document.getElementById('modeAdaptive');
    const fixedBtn = document.getElementById('modeFixed');
    
    if (adaptiveBtn && fixedBtn) {
        adaptiveBtn.classList.toggle('active', mode === 'adaptive');
        fixedBtn.classList.toggle('active', mode === 'fixed');
    }
    
    localStorage.setItem('boardMode', mode);
    playClickSound();
    
    setTimeout(autoFitInfoFont, 300);
}

// ============================================
// UI ATNAUJINIMAS
// ============================================

function updateUI(state) {
    if (!state) return;
    
    document.getElementById('playerCount').textContent = `👥 ${state.players.filter(p => p.isActive && !p.left && !p.kicked).length}/${state.maxPlayers}`;
    const currentPlayer = state.players[state.currentTurn];
    document.getElementById('turnDisplay').textContent = `🎯 Eina: ${currentPlayer ? currentPlayer.name : '---'}`;
    
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
                const color = field.color || '#c9a84c';
                const tooltip = `${field.name} (#${fieldId}) • €${field.cost}`;
                miniCardsHtml += `
                    <div class="mini-card" style="--card-color:${color};" title="${tooltip}" data-field-id="${fieldId}">
                        <div class="mini-card-color"></div>
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
        
        document.getElementById('myInfo').innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; width:100%; justify-content:center;">
                <div class="player-color" style="background:${me.color}; width:20px; height:20px; border-radius:50%; border:2px solid #3d2b1f; flex-shrink:0;"></div>
                <div class="player-name" style="font-size:16px; font-weight:600;">${me.name}</div>
            </div>
            <div class="player-money" style="font-size:28px; font-weight:700; color:${me.money < 0 ? '#dc3545' : '#000000'};">💰 €${me.money}</div>
            <div style="font-size:12px; color:#3d2b1f;">📍 ${state.board[me.position]?.name || me.position}</div>
            <div style="font-size:11px; color:#3d2b1f;">🏠 ${me.properties.length} objektai (${housesInfo} namai)</div>
            ${me.inJail ? '<div style="color:#dc3545; font-size:11px;">⛓️ KALĖJIME</div>' : ''}
            ${me.bankrupt ? '<div style="color:#dc3545; font-size:11px;">💀 BANKROTAS</div>' : ''}
            ${me.left ? '<div style="color:#6c757d; font-size:11px;">😭 PASITRAUKEI</div>' : ''}
            ${me.kicked ? '<div style="color:#dc3545; font-size:14px; font-weight:700;">🚫 PAŠALINTAS</div>' : ''}
            ${me.isDebtor ? '<div style="color:#dc3545; font-size:14px; font-weight:700; animation: blink 1s infinite;">⚠️ SKOLINGAS €' + Math.abs(me.money) + '!</div>' : ''}
            <div style="width:100%; border-top:1px solid rgba(61,43,31,0.1); margin-top:4px; padding-top:4px;">
                <div style="font-size:9px; color:#6c757d; text-align:center; margin-bottom:2px;">📋 TURIMOS KORTELĖS</div>
                ${miniCardsHtml}
            </div>
        `;
    }
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = state.players.map(p => {
        const pHouses = p.houses ? Object.values(p.houses).reduce((a, b) => a + b, 0) : 0;
        const isLeft = p.left === true;
        const isKicked = p.kicked === true;
        const isDebtor = p.isDebtor === true;
        
        if (isKicked && p.id !== playerId) {
            return '';
        }
        
        return `
            <div class="player-item ${p.id === playerId ? 'me' : ''} ${p.isActive ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''} ${isLeft ? 'left' : ''} ${isKicked ? 'left' : ''}">
                <span class="dot" style="background:${p.color}"></span>
                <span class="pname">${p.name} ${p.id === playerId ? '👤' : ''}</span>
                <span class="pmoney" style="color:${p.money < 0 ? '#dc3545' : '#000000'};">€${p.money}</span>
                ${pHouses > 0 ? `🏠${pHouses}` : ''}
                ${p.inJail ? '⛓️' : ''}
                ${p.bankrupt ? '💀' : ''}
                ${isKicked ? '🚫' : ''}
                ${isDebtor && !p.bankrupt ? '⚠️' : ''}
                ${isLeft ? '😭' : ''}
                ${state.currentTurn === p.id && p.isActive && !p.left && !p.kicked ? '🎯' : ''}
            </div>
        `;
    }).filter(html => html !== '').join('');
    
    const isBankrupt = myPlayer && myPlayer.bankrupt;
    const isLeft = myPlayer && myPlayer.left;
    const isKicked = myPlayer && myPlayer.kicked;
    const isDebtor = myPlayer && myPlayer.isDebtor;
    isMyTurn = state.currentTurn === playerId && myPlayer && myPlayer.isActive && !myPlayer.bankrupt && !myPlayer.left && !myPlayer.kicked;
    
    document.getElementById('rollBtn').disabled = !isMyTurn || isBankrupt || isLeft || isKicked || isDebtor;
    
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

    const demolishBtn = document.getElementById('demolishBtn');
    if (demolishBtn) {
        if ((isMyTurn || isDebtor) && !isBankrupt && !isLeft && !isKicked && myPlayer) {
            const hasHouses = myPlayer.houses && Object.keys(myPlayer.houses).length > 0;
            if (hasHouses) {
                demolishBtn.style.display = 'block';
                demolishBtn.disabled = false;
            } else {
                demolishBtn.style.display = 'block';
                demolishBtn.disabled = true;
            }
        } else {
            demolishBtn.style.display = 'block';
            demolishBtn.disabled = true;
        }
    }

    const buildBtn = document.getElementById('buildBtn');
    if (buildBtn) {
        if (isMyTurn && !isBankrupt && !isLeft && !isKicked && !isDebtor && myPlayer && gameState) {
            const currentField = gameState.board[myPlayer.position];
            if (currentField && (currentField.type === 'property' || currentField.type === 'service2') && currentField.color) {
                const groupFields = getGroupByColor(currentField.color);
                if (groupFields && groupFields.length > 0) {
                    const hasAll = groupFields.every(id => myPlayer.properties.includes(id));
                    if (hasAll) {
                        const houses = groupFields.map(id => myPlayer.houses && myPlayer.houses[id] || 0);
                        const minHouses = Math.min(...houses);
                        const maxHouses = Math.max(...houses);
                        const isBalanced = (maxHouses - minHouses) <= 1;
                        
                        const currentHouses = myPlayer.houses && myPlayer.houses[currentField.id] || 0;
                        const canBuildOnThis = currentHouses === minHouses;
                        
                        if (isBalanced && canBuildOnThis && currentHouses < 4) {
                            buildBtn.textContent = '🏠 Statyti namą';
                            buildBtn.style.display = 'block';
                            buildBtn.disabled = false;
                        } else if (isBalanced && currentHouses === 4) {
                            const allHave4 = groupFields.every(id => (myPlayer.houses && myPlayer.houses[id] || 0) >= 4);
                            const alreadyHasHotel = currentHouses >= 5;
                            if (allHave4 && !alreadyHasHotel) {
                                buildBtn.textContent = '🏨 Statyti viezbutį';
                                buildBtn.style.display = 'block';
                                buildBtn.disabled = false;
                            } else {
                                buildBtn.style.display = 'none';
                                buildBtn.disabled = true;
                            }
                        } else {
                            buildBtn.style.display = 'none';
                            buildBtn.disabled = true;
                        }
                    } else {
                        buildBtn.style.display = 'none';
                        buildBtn.disabled = true;
                    }
                } else {
                    buildBtn.style.display = 'none';
                    buildBtn.disabled = true;
                }
            } else {
                buildBtn.style.display = 'none';
                buildBtn.disabled = true;
            }
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
}

// ============================================
// LENTOS ATNAUJINIMAS
// ============================================

function updateBoard(state) {
    const boardData = state.board;
    
    boardData.forEach((field, index) => {
        const cell = document.getElementById(`cell-${index}`);
        if (!cell) return;
        
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

        html += `<span class="cell-name">${field.name || index}</span>`;
        
        if (field.cost > 0) {
            if (owner && owner.houses && owner.houses[index] && owner.houses[index] > 0) {
                const houseCount = owner.houses[index];
                let houseIcons = '';
                if (houseCount >= 5) {
                    houseIcons = '🏨';
                } else {
                    for (let i = 0; i < Math.min(houseCount, 4); i++) {
                        houseIcons += '🏠';
                    }
                }
                html += `<span class="cell-cost" style="font-size:14px; display:block; line-height:1.2;">${houseIcons}</span>`;
            } else {
                html += `<span class="cell-cost">€${field.cost}</span>`;
            }
        }
        
        if (playersHere.length > 0) {
            html += `<div class="players-on-cell">`;
            playersHere.forEach(p => {
                html += `<span class="player-dot" style="background:${p.color}"></span>`;
            });
            html += `</div>`;
        }
        
        cell.innerHTML = html;
        
        cell.className = 'cell';
        if (field.type === 'start') cell.classList.add('start');
        else if (field.type === 'jail') cell.classList.add('jail');
        else if (field.type === 'parking') cell.classList.add('parking');
        else if (field.type === 'go-to-jail') cell.classList.add('go-to-jail');
        else if (field.type === 'property') cell.classList.add('property');
        else if (field.id === 0 || field.id === 16 || field.id === 26 || field.id === 42) {
            cell.classList.add('corner');
        }
        
        if (field.color) {
            cell.style.setProperty('--property-color', field.color);
        }
    });
}

function addChatMessage(data) {
    const time = new Date(data.timestamp).toLocaleTimeString();
    
    const container = document.getElementById('chatMessages');
    if (container) {
        container.innerHTML += `
            <div style="color:#3d2b1f; display:flex; align-items:center; gap:4px; margin-bottom:2px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${data.color}; border:1px solid rgba(0,0,0,0.2); flex-shrink:0;"></span>
                <b>${data.player}:</b> 
                <span>${data.message}</span>
                <span style="font-size:7px; color:rgba(61,43,31,0.4); margin-left:auto;">${time}</span>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
    }
    
    const waitingContainer = document.getElementById('waitingChatMessages');
    if (waitingContainer) {
        waitingContainer.innerHTML += `
            <div style="color:#3d2b1f; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${data.color}; border:1px solid rgba(0,0,0,0.2); flex-shrink:0;"></span>
                <b>${data.player}:</b> 
                <span>${data.message}</span>
                <span style="font-size:9px; color:rgba(61,43,31,0.4); margin-left:auto;">${time}</span>
            </div>
        `;
        waitingContainer.scrollTop = waitingContainer.scrollHeight;
    }
}

let journalCount = 0;

function addJournal(msg) {
    const container = document.getElementById('journal');
    if (!container) return;
    
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
    
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
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
    
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            changeVolume(this.value);
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
        updateDiceDisplay(1, 1);
    }, 500);
    
    setTimeout(initInfoResizeObserver, 800);
    
    console.log('✅ Inicijavimas baigtas');
});