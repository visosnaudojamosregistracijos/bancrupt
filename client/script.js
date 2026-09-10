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

// ============================================
// PRISIJUNGIMAS
// ============================================

function initSocket() {
    console.log('🔄 Inicijuojamas socket...');
    
    socket = io('https://responsible-nourishment-production.up.railway.app', {
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
        document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
        showLobbyMessage(`✅ Žaidimas sukurtas! ID: ${gameId}`, '#28a745');
        playStartSound();
        enterGame();
    });

    socket.on('joinedGame', (data) => {
        console.log('✅ Prisijungta prie žaidimo:', data);
        playerId = data.playerId;
        myPlayer = data.player;
        document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
        showLobbyMessage(`✅ Prisijungei prie žaidimo!`, '#28a745');
        playStartSound();
        enterGame();
    });

    socket.on('gameState', (state) => {
        console.log('📊 Gauta žaidimo būsena');
        gameState = state;
        updateUI(state);
        document.getElementById('bankruptModal').style.display = 'none';
    });

    socket.on('diceRolled', (data) => {
        console.log('🎲 Kauliukai mesti:', data);
        playDiceSound();
        updateDiceDisplay(data.dice[0], data.dice[1]);
        
        let notificationMsg = `${data.player.name} metė ${data.dice[0]}+${data.dice[1]}=${data.total}`;
        let popupMsg = notificationMsg;
        let popupType = 'move';
        
        if (data.field) {
            notificationMsg += ` ir atsistojo ant "${data.field.name}"`;
            popupMsg += ` ir atsistojo ant "${data.field.name}"`;
            
            if (data.result) {
                if (data.result.action === 'can_buy') {
                    const buyMsg = ` 🏠 Gali nusipirkti už €${data.field.cost}!`;
                    notificationMsg += buyMsg;
                    popupMsg += buyMsg;
                    popupType = 'buy';
                } else if (data.result.action === 'pay_rent') {
                    const rentMsg = ` 💰 Sumokėjo nuomą!`;
                    notificationMsg += rentMsg;
                    popupMsg += rentMsg;
                    popupType = 'rent';
                    playPaySound();
                } else if (data.result.action === 'pay_tax') {
                    const taxMsg = ` 💸 Sumokėjo mokesčius!`;
                    notificationMsg += taxMsg;
                    popupMsg += taxMsg;
                    popupType = 'tax';
                    playTaxSound();
                } else if (data.result.action === 'go_to_jail') {
                    const jailMsg = ` ⛓️ Keliauja į kalėjimą!`;
                    notificationMsg += jailMsg;
                    popupMsg += jailMsg;
                    popupType = 'jail';
                    playJailInSound();
                } else if (data.result.action === 'chance') {
                    const chanceMsg = ` 🎲 Gavosi šansas!`;
                    notificationMsg += chanceMsg;
                    popupMsg += chanceMsg;
                    popupType = 'chance';
                    playChanceSound();
                }
            }
            
            if (data.canBuy) {
                const buyMsg = ` 🏠 Gali nusipirkti ${data.field.name} už €${data.field.cost}!`;
                notificationMsg += buyMsg;
                popupMsg += buyMsg;
                popupType = 'buy';
                playNotificationSound();
            }
        }
        
        addNotification(notificationMsg);
        
        if (data.player.id !== playerId) {
            showPopupMessage(popupMsg, popupType);
        }
        
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
        
        if (msg.includes('pastatė namą')) {
            playBuildSound();
            showPopupMessage(msg, 'buy');
        }
        if (msg.includes('pastatė VIEZBUTĮ')) {
            playHotelSound();
            showPopupMessage(msg, 'buy');
        }
        if (msg.includes('Dabar eina')) {
            playMoveSound();
        }
        if (msg.includes('bankrotavo')) {
            playBankruptSound();
            showPopupMessage(msg, 'rent');
        }
        if (msg.includes('laimėjo aukcioną')) {
            playAuctionSound();
            playCashSound();
            showPopupMessage(msg, 'buy');
        }
        if (msg.includes('nusipirko')) {
            playBuySound();
            playCashSound();
            showPopupMessage(msg, 'buy');
        }
        if (msg.includes('nugriovė')) {
            playDemolishSound();
            playCashSound();
            showPopupMessage(msg, 'move');
        }
        if (msg.includes('sumokėjo €') && msg.includes('nuomos')) {
            playPaySound();
            showPopupMessage(msg, 'rent');
        }
        if (msg.includes('sumokėjo') && msg.includes('mokesčių')) {
            playTaxSound();
            showPopupMessage(msg, 'tax');
        }
        if (msg.includes('gavo €') || msg.includes('laimėjo')) {
            playCashSound();
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
            showPopupMessage(msg, 'rent');
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

    socket.on('buyConfirmed', (data) => {
        console.log('✅ Pirkimas patvirtintas:', data);
        playBuySound();
        playCashSound();
        const msg = `✅ ${data.playerName} nusipirko ${data.fieldName}! 🏠`;
        addNotification(msg);
        if (data.playerId !== playerId) {
            showPopupMessage(msg, 'buy');
        }
        addJournal(msg);
        hideBuyChoice();
    });

    socket.on('buyCancelled', (data) => {
        console.log('❌ Pirkimas atšauktas:', data);
        playMoveSound();
        const msg = `❌ ${data.playerName} atsisakė pirkti ${data.fieldName}`;
        addNotification(msg);
        if (data.playerId !== playerId) {
            showPopupMessage(msg, 'move');
        }
        addJournal(msg);
        hideBuyChoice();
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

    // ============================================
    // PREKYBOS SOCKET EVENTAI
    // ============================================

    socket.on('tradeProposed', (data) => {
        console.log('📩 Gautas prekybos pasiūlymas:', data);
        playTradeSound();
        const msg = `📩 ${data.fromPlayer} pasiūlė prekybą ${data.toPlayer}!`;
        addNotification(msg);
        if (data.fromPlayer !== myPlayer?.name) {
            showPopupMessage(msg, 'move');
        }
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
            showPopupMessage(data.message || 'Prekyba įvykdyta!', 'buy');
        } else {
            playMoveSound();
            showPopupMessage(data.message || 'Prekyba atmesta', 'move');
        }
        addNotification(data.message || 'Prekybos atsakymas gautas');
        addJournal(data.message || 'Prekybos atsakymas gautas');
        closeTradeOffer();
        if (gameState) updateUI(gameState);
    });

    // ============================================
    // AUKCIONO SOCKET EVENTAI
    // ============================================

    socket.on('auctionStarted', (data) => {
        console.log('🔨🔨🔨 KLIENTAS GAUNA auctionStarted EVENTĄ');
        console.log('🔨🔨🔨 Duomenys:', data);
        playAuctionSound();
        
        if (!data) {
            console.error('❌❌❌ Aukciono duomenys yra undefined');
            addJournal('❌ Klaida: gauti neteisingi aukciono duomenys');
            playErrorSound();
            return;
        }
        
        if (!data.fieldName) {
            console.error('❌❌❌ Trūksta fieldName');
            addJournal('❌ Klaida: aukciono duomenys neteisingi');
            playErrorSound();
            return;
        }
        
        const msg = `🔨 Prasidėjo aukcionas: ${data.fieldName}!`;
        addNotification(msg);
        if (data.sellerId !== playerId) {
            showPopupMessage(msg, 'buy');
        }
        addJournal(msg);
        
        if (data.sellerId !== playerId) {
            showAuction(data);
        } else {
            const sellerMsg = `📢 Tu paskelbei aukcioną! Kiti žaidėjai siūlo kainas.`;
            addNotification(sellerMsg);
            addJournal(sellerMsg);
        }
        
        if (gameState) updateUI(gameState);
    });

    socket.on('auctionUpdated', (data) => {
        console.log('💰 Aukciono pasiūlymas:', data);
        playTradeSound();
        if (data.currentBid !== undefined) {
            document.getElementById('auctionCurrentBid').textContent = data.currentBid;
        }
        if (data.endTime) {
            startAuctionTimer(data.endTime);
        }
        const msg = `💰 Naujas pasiūlymas: €${data.currentBid}`;
        addNotification(msg);
        showPopupMessage(msg, 'move');
        addJournal(msg);
    });

    socket.on('auctionEnded', (data) => {
        console.log('🔨🔨🔨 AUKCIONAS BAIGĖSI:', data);
        
        auctionEndedSent = true;
        
        if (data && data.winnerName) {
            const msg = `🔨 ${data.winnerName} laimėjo aukcioną: ${data.fieldName} už €${data.finalBid}!`;
            addNotification(msg);
            if (data.winnerId !== playerId) {
                showPopupMessage(msg, 'buy');
            }
            addJournal(msg);
            playAuctionSound();
            playCashSound();
        } else if (data) {
            const msg = `🔨 Aukcionas baigėsi be laimėtojo`;
            addNotification(msg);
            showPopupMessage(msg, 'move');
            addJournal(msg);
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

    // ============================================
    // GRIAUTI NAMUS - SOCKET EVENTAI
    // ============================================

    socket.on('demolishableProperties', (properties) => {
        updateDemolishList(properties);
    });

    socket.on('demolishConfirmed', (data) => {
        const msg = `🏚️ ${data.message}`;
        addNotification(msg);
        showPopupMessage(msg, 'move');
        addJournal(msg);
        playDemolishSound();
        playCashSound();
        if (gameState) updateUI(gameState);
    });

    // ============================================
    // PASITRAUKIMAS IŠ ŽAIDIMO
    // ============================================

    socket.on('leftGame', (data) => {
        console.log('🏃 Pasitraukei iš žaidimo:', data);
        addNotification(`🏃 Tu pasitraukei iš žaidimo`);
        addJournal(`🏃 Tu pasitraukei iš žaidimo`);
        
        setTimeout(() => {
            document.getElementById('game').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';
            showLobbyMessage('🏃 Pasitraukei iš žaidimo. Gali kurti naują arba jungtis prie kito.', '#ffd700');
            
            playerId = null;
            gameId = null;
            gameState = null;
            myPlayer = null;
            isMyTurn = false;
        }, 1500);
    });

    socket.on('gameFinished', (data) => {
        console.log('🏆 Žaidimas baigtas:', data);
        playWinSound();
        playCelebrateSound();
        
        setTimeout(() => {
            alert(`🏆 ŽAIDIMAS BAIGTAS!\n\nLaimėtojas: ${data.winner}`);
        }, 500);
    });
}

// ============================================
// IŠŠOKANTYS PRANEŠIMAI
// ============================================

function showPopupMessage(message, type) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(145deg, #f5f0e8, #e8d5b5);
        border: 3px solid #c9a84c;
        border-radius: 16px;
        padding: 30px 40px;
        max-width: 500px;
        width: 90%;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        text-align: center;
        animation: popupFadeIn 0.3s ease;
    `;
    
    let icon = '🎲';
    let color = '#1a6b3c';
    if (type === 'buy') { icon = '🏠'; color = '#28a745'; }
    else if (type === 'rent') { icon = '💰'; color = '#dc3545'; }
    else if (type === 'jail') { icon = '⛓️'; color = '#6c757d'; }
    else if (type === 'tax') { icon = '💸'; color = '#dc3545'; }
    else if (type === 'chance') { icon = '🎲'; color = '#fd7e14'; }
    else if (type === 'move') { icon = '🎲'; color = '#1a6b3c'; }
    
    popup.innerHTML = `
        <div style="font-size:48px; margin-bottom:10px;">${icon}</div>
        <div style="font-size:18px; font-weight:700; color:${color}; margin-bottom:8px; white-space:pre-line;">${message}</div>
        <button onclick="this.parentElement.remove(); playClickSound();" style="
            margin-top:15px;
            padding:8px 30px;
            border:none;
            border-radius:8px;
            background:linear-gradient(145deg, #1a6b3c, #0f4a2a);
            color:#fff;
            font-size:14px;
            font-weight:700;
            cursor:pointer;
            transition:all 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            OK, SUPRASTAU
        </button>
    `;
    
    document.body.appendChild(popup);
    playNotificationSound();
    
    setTimeout(() => {
        if (popup.parentElement) {
            popup.style.opacity = '0';
            popup.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (popup.parentElement) popup.remove();
            }, 500);
        }
    }, 5000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes popupFadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
`;
document.head.appendChild(style);

// ============================================
// PRANEŠIMAI - 5 LANGELIS
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
    const el = document.getElementById('lobbyMessages');
    el.innerHTML = `<span style="color:${color || '#d4b896'}">${msg}</span>`;
}

function createGame() {
    const name = document.getElementById('playerName').value.trim();
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
    console.log('📤 Siunčiama createGame užklausa:', name);
    playClickSound();
    socket.emit('createGame', name);
}

function joinGame() {
    const name = document.getElementById('playerName').value.trim();
    const gid = document.getElementById('gameIdInput').value.trim().toUpperCase();
    if (!name) {
        alert('Įvesk savo vardą!');
        playErrorSound();
        return;
    }
    if (!gid) {
        alert('Įvesk žaidimo ID!');
        playErrorSound();
        return;
    }
    if (!isConnected) {
        alert('Nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    gameId = gid;
    console.log('📤 Siunčiama joinGame užklausa:', { gameId: gid, playerName: name });
    playClickSound();
    socket.emit('joinGame', { gameId: gid, playerName: name });
}

function enterGame() {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    document.getElementById('gameIdDisplay').textContent = '📋 ID: ' + gameId;
    
    const gameIdLeft = document.getElementById('gameIdDisplayLeft');
    if (gameIdLeft) gameIdLeft.textContent = gameId;
    
    socket.emit('getGameState');
}

// ============================================
// PASITRAUKIMAS IŠ ŽAIDIMO
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
    if (!isMyTurn) {
        alert('⏳ Ne tavo eilė!');
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
    console.log('🔨 Atidaromas aukciono panelis');
    document.getElementById('tradingOptions').style.display = 'none';
    document.getElementById('auctionPanel').style.display = 'block';
    updateAuctionableProperties();
    playClickSound();
}

function showTradeToPlayer() {
    console.log('🔄 Atidaromas "Siūlyti žaidėjui" panelis');
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
    
    console.log('🔨 Atnaujinamos aukcionuojamos kortelės');
    console.log('🔨 Dabartinis selectedAuctionField:', selectedAuctionField);
    
    const properties = gameState.players.find(p => p.id === playerId).properties || [];
    let html = '';
    let hasProperties = false;
    
    properties.forEach(fieldId => {
        const field = gameState.board.find(f => f.id === fieldId);
        if (!field) return;
        const houses = myPlayer.houses && myPlayer.houses[fieldId] ? myPlayer.houses[fieldId] : 0;
        if (houses > 0) {
            console.log(`⛔ ${field.name} turi namų (${houses}), negalima aukcionuoti`);
            return;
        }
        
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
    console.log('🔨🔨🔨 selectAuctionField iškviesta su:', fieldId);
    selectedAuctionField = fieldId;
    updateAuctionableProperties();
    playClickSound();
}

function confirmStartAuction() {
    console.log('🔨🔨🔨 confirmStartAuction() iškviesta');
    console.log('🔨🔨🔨 selectedAuctionField:', selectedAuctionField);
    
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
    
    if (confirm(`🔨 Skelbti aukcioną: ${field.name}?`)) {
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
    if (!select) {
        console.log('❌ tradeTargetPlayer nerastas');
        return;
    }
    if (!gameState) {
        console.log('❌ gameState nėra');
        return;
    }
    
    const currentPlayerId = myPlayer?.id !== undefined ? myPlayer.id : playerId;
    
    console.log('🔄 Atnaujinami žaidėjai prekybai');
    
    select.innerHTML = '';
    let found = false;
    gameState.players.forEach(p => {
        if (p.id !== currentPlayerId && p.isActive && !p.bankrupt && !p.left) {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} ${p.icon || '🚗'} (€${p.money})`;
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
        if (count >= 3) return;
        
        const checked = selectedOfferFields.includes(fieldId) ? 'checked' : '';
        const color = field.color || '#c9a84c';
        
        let houseIcon = '';
        if (houses >= 5) houseIcon = '🏨';
        else if (houses > 0) {
            for (let i = 0; i < houses; i++) houseIcon += '🏠';
        }
        
        html += `
            <div style="background:${color}; padding:4px 8px; border-radius:6px; border:2px solid ${checked ? '#28a745' : 'rgba(255,255,255,0.3)'}; display:flex; align-items:center; gap:4px; cursor:pointer; transition:all 0.2s; box-shadow: ${checked ? '0 0 10px rgba(40,167,69,0.4)' : 'none'};" 
                 onclick="document.getElementById('offer_${fieldId}').click()">
                <input type="checkbox" ${checked} onchange="toggleOfferField(${fieldId})" id="offer_${fieldId}" style="margin:0; cursor:pointer;">
                <span style="font-size:12px;">${houseIcon}</span>
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
        if (selectedOfferFields.length >= 3) {
            alert('❌ Galima pasirinkti ne daugiau kaip 3 korteles!');
            playErrorSound();
            return;
        }
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
        if (selectedRequestFields.length >= 3) {
            alert('❌ Galima pasirinkti ne daugiau kaip 3 korteles!');
            playErrorSound();
            return;
        }
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
        if (count >= 3) return;
        
        const checked = selectedRequestFields.includes(fieldId) ? 'checked' : '';
        const color = field.color || '#c9a84c';
        
        let houseIcon = '';
        if (houses >= 5) houseIcon = '🏨';
        else if (houses > 0) {
            for (let i = 0; i < houses; i++) houseIcon += '🏠';
        }
        
        html += `
            <div style="background:${color}; padding:4px 8px; border-radius:6px; border:2px solid ${checked ? '#28a745' : 'rgba(255,255,255,0.3)'}; display:flex; align-items:center; gap:4px; cursor:pointer; transition:all 0.2s; box-shadow: ${checked ? '0 0 10px rgba(40,167,69,0.4)' : 'none'};" 
                 onclick="document.getElementById('request_${fieldId}').click()">
                <input type="checkbox" ${checked} onchange="toggleRequestField(${fieldId})" id="request_${fieldId}" style="margin:0; cursor:pointer;">
                <span style="font-size:12px;">${houseIcon}</span>
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

// ============================================
// PASIŪLYMO GAVIMAS
// ============================================

function showTradeOffer(data) {
    console.log('📩 Rodomas pasiūlymo langas:', data);
    
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

// ============================================
// AUKCIONAS
// ============================================

function showAuction(data) {
    console.log('🔨 Rodomas aukciono langas, gauti duomenys:', data);
    
    if (!data) {
        console.error('❌ Aukciono duomenys yra undefined');
        alert('❌ Klaida: gauti neteisingi aukciono duomenys');
        playErrorSound();
        return;
    }
    
    auctionEndedSent = false;
    
    document.getElementById('auctionSeller').textContent = data.sellerName || 'Nežinomas';
    document.getElementById('auctionFieldName').textContent = data.fieldName || 'Nežinoma kortelė';
    document.getElementById('auctionCurrentBid').textContent = data.currentBid || 0;
    
    currentAuctionId = data.auctionId;
    
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
        document.getElementById('auctionTimer').textContent = remaining;
        
        if (remaining <= 0 && !auctionEndedSent) {
            clearInterval(auctionTimerInterval);
            auctionTimerInterval = null;
            document.getElementById('auctionTimer').textContent = '0';
            
            auctionEndedSent = true;
            console.log('🔨 Aukcionas baigėsi, siunčiama endAuction');
            if (currentAuctionId) {
                socket.emit('endAuction', { auctionId: currentAuctionId });
            }
        }
    }, 1000);
}

function placeBid() {
    const input = document.getElementById('auctionBidInput');
    const bidAmount = parseInt(input.value);
    
    if (!currentAuctionId) {
        alert('❌ Nėra aktyvaus aukciono!');
        playErrorSound();
        return;
    }
    
    if (isNaN(bidAmount) || bidAmount <= 0) {
        alert('❌ Įvesk teisingą kainą!');
        playErrorSound();
        return;
    }
    
    const currentBid = parseInt(document.getElementById('auctionCurrentBid').textContent) || 0;
    if (bidAmount <= currentBid) {
        alert(`❌ Siūlyk daugiau nei dabartinė kaina (€${currentBid})!`);
        playErrorSound();
        return;
    }
    
    socket.emit('bidAuction', { auctionId: currentAuctionId, bidAmount });
    input.value = '';
    playClickSound();
}

// ============================================
// GRIAUTI NAMUS
// ============================================

let demolishableProperties = [];

function openDemolish() {
    if (!isMyTurn) {
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

// ============================================
// NAMŲ STATYMAS
// ============================================

function buildHouse() {
    if (!isMyTurn) {
        alert('⏳ Ne tavo eilė!');
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

// ============================================
// KALĖJIMAS
// ============================================

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

// ============================================
// BANKROTAS
// ============================================

function bankrupt() {
    if (!isMyTurn) {
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
    
    if (!socket) {
        alert('Klaida: nėra ryšio su serveriu!');
        playErrorSound();
        return;
    }
    
    if (!socket.connected) {
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

// ============================================
// CHATAS
// ============================================

function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit('chatMessage', msg);
    input.value = '';
    playClickSound();
}

// ============================================
// GRUPĖS PAGAL SPALVĄ
// ============================================

function getGroupByColor(color) {
    const groups = {
        '#ffd700': [1, 3],
        '#4a90d9': [6, 7, 9],
        '#2ecc71': [10, 11, 12],
        '#e67e22': [15, 17, 18],
        '#9b59b6': [20, 21, 22],
        '#e74c3c': [24, 25, 27],
        '#8B6914': [28, 30, 31],
        '#1abc9c': [32, 34, 35],
        '#ff69b4': [36, 37, 38],
        '#2c3e50': [39, 41, 43],
        '#1a237e': [44, 46, 48],
        '#bdc3c7': [49, 51]
    };
    return groups[color] || [];
}

// ============================================
// GARSAI
// ============================================

function toggleSound() {
    if (audioManager) {
        const enabled = audioManager.toggle();
        const status = enabled ? 'ĮJUNGTI' : 'IŠJUNGTI';
        console.log(`🔊 Garsai: ${status}`);
        const msg = `🔊 Garsai ${status}`;
        addNotification(msg);
        addJournal(msg);
        playClickSound();
        return enabled;
    }
    return false;
}

// ============================================
// REŽIMO PERJUNGIMAS
// ============================================

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
}

// ============================================
// UI ATNAUJINIMAS
// ============================================

function updateUI(state) {
    if (!state) return;
    
    document.getElementById('playerCount').textContent = `👥 ${state.players.filter(p => p.isActive && !p.left).length}/${state.maxPlayers}`;
    const currentPlayer = state.players[state.currentTurn];
    document.getElementById('turnDisplay').textContent = `🎯 Eina: ${currentPlayer ? currentPlayer.name : '---'}`;
    
    // Kairės panelės atnaujinimas
    const gameIdLeft = document.getElementById('gameIdDisplayLeft');
    if (gameIdLeft && gameId) gameIdLeft.textContent = gameId;

    const playerCountLeft = document.getElementById('playerCountLeft');
    if (playerCountLeft) {
        playerCountLeft.textContent = `${state.players.filter(p => p.isActive && !p.bankrupt && !p.left).length}/${state.maxPlayers}`;
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
            miniCardsHtml = '<div style="display:flex; flex-wrap:wrap; gap:3px; justify-content:center; margin-top:4px; max-height:60px; overflow-y:auto;">';
            
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
                miniCardsHtml += `
                    <div style="background:${color}; padding:2px 6px; border-radius:4px; font-size:9px; color:#fff; font-weight:600; border:1px solid rgba(255,255,255,0.3); display:flex; align-items:center; gap:3px;">
                        ${houseIcon}
                        <span style="font-size:8px;">${field.name}</span>
                        <span style="font-size:7px; opacity:0.7;">€${field.cost}</span>
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
                <div class="player-name" style="font-size:16px; font-weight:600;">${me.name} ${me.icon || '🚗'}</div>
            </div>
            <div class="player-money" style="font-size:28px; font-weight:700; color:#000000;">💰 €${me.money}</div>
            <div style="font-size:12px; color:#3d2b1f;">📍 ${state.board[me.position]?.name || me.position}</div>
            <div style="font-size:11px; color:#3d2b1f;">🏠 ${me.properties.length} objektai (${housesInfo} namai)</div>
            ${me.inJail ? '<div style="color:#dc3545; font-size:11px;">⛓️ KALĖJIME</div>' : ''}
            ${me.bankrupt ? '<div style="color:#dc3545; font-size:11px;">💀 BANKROTAS</div>' : ''}
            ${me.left ? '<div style="color:#6c757d; font-size:11px;">😭 PASITRAUKEI</div>' : ''}
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
        return `
            <div class="player-item ${p.id === playerId ? 'me' : ''} ${p.isActive ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''} ${isLeft ? 'left' : ''}">
                <span class="dot" style="background:${p.color}"></span>
                <span class="pname">${p.name} ${p.icon || '🚗'} ${p.id === playerId ? '👤' : ''}</span>
                <span class="pmoney">€${p.money}</span>
                ${pHouses > 0 ? `🏠${pHouses}` : ''}
                ${p.inJail ? '⛓️' : ''}
                ${p.bankrupt ? '💀' : ''}
                ${isLeft ? '😭' : ''}
                ${state.currentTurn === p.id && p.isActive && !p.left ? '🎯' : ''}
            </div>
        `;
    }).join('');
    
    const isBankrupt = myPlayer && myPlayer.bankrupt;
    const isLeft = myPlayer && myPlayer.left;
    isMyTurn = state.currentTurn === playerId && myPlayer && myPlayer.isActive && !myPlayer.bankrupt && !myPlayer.left;
    
    document.getElementById('rollBtn').disabled = !isMyTurn || isBankrupt || isLeft;
    
    const tradeBtn = document.getElementById('tradeBtn');
    if (tradeBtn) {
        tradeBtn.disabled = !isMyTurn || isBankrupt || isLeft;
    }
    
    document.getElementById('bankruptBtn').disabled = isBankrupt || isLeft || !myPlayer || !myPlayer.isActive;

    const jailBtn = document.getElementById('jailBtn');
    if (jailBtn) {
        if (isMyTurn && !isBankrupt && !isLeft && myPlayer && myPlayer.inJail) {
            jailBtn.style.display = 'block';
            jailBtn.disabled = false;
        } else {
            jailBtn.style.display = 'none';
            jailBtn.disabled = true;
        }
    }

    const demolishBtn = document.getElementById('demolishBtn');
    if (demolishBtn) {
        if (isMyTurn && !isBankrupt && !isLeft && myPlayer) {
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
        if (isMyTurn && !isBankrupt && !isLeft && myPlayer && gameState) {
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
            if (isBankrupt || isLeft) {
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
            if (isBankrupt || isLeft) {
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
    
    if (isBankrupt || isLeft) {
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
        
        const playersHere = state.players.filter(p => p.position === index && p.isActive && !p.bankrupt && !p.left);
        
        let html = `<span class="cell-number">${index}</span>`;
        
        const owner = state.players.find(p => p.properties.includes(index) && !p.bankrupt);
        if (owner) {
            html += `<span class="cell-owner">${owner.icon || '🚗'}</span>`;
        }
        
        html += `<span class="cell-icon">${field.icon || ''}</span>`;
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
                html += `<span class="player-dot" style="background:${p.color}">${p.icon || '🚗'}</span>`;
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

// ============================================
// CHATAS
// ============================================

function addChatMessage(data) {
    const container = document.getElementById('chatMessages');
    const time = new Date(data.timestamp).toLocaleTimeString();
    container.innerHTML += `<div style="color:${data.color}"><b>${data.player}:</b> ${data.message} <span style="font-size:7px;color:rgba(61,43,31,0.4)">${time}</span></div>`;
    container.scrollTop = container.scrollHeight;
}

// ============================================
// ŽURNALAS
// ============================================

let journalCount = 0;

function addJournal(msg) {
    const container = document.getElementById('journal');
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
    
    document.getElementById('playerName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGame();
    });
    document.getElementById('gameIdInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
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
    
    const savedMode = localStorage.getItem('boardMode') || 'adaptive';
    setMode(savedMode);
    
    initSocket();
    
    setTimeout(() => {
        updateDiceDisplay(1, 1);
    }, 500);
    
    console.log('✅ Inicijavimas baigtas');
});