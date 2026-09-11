// ============================================
// audioManager.js
// ============================================

class AudioManager {
    constructor() {
        this.sounds = {};
        this.isEnabled = true;
        this.volume = 0.5;
        this.loadSounds();
    }

    loadSounds() {
        const soundFiles = {
            'air-port': 'sounds/air-port.mp3',
            'air-in': 'sounds/air-in.mp3',
            'hospital': 'sounds/hospital.mp3',
            'dujos': 'sounds/dujos.mp3',
            'dujos1': 'sounds/dujos1.mp3',
            'siuksles': 'sounds/siuksles.mp3',
            'elektra': 'sounds/elektra.mp3',
            'vanduo': 'sounds/vanduo.mp3',
            'train': 'sounds/train.mp3',
            'port': 'sounds/port.mp3',
            'bus': 'sounds/bus.mp3',
            'latras': 'sounds/latras.mp3',
            'pirtis': 'sounds/pirtis.mp3',
            'birthday': 'sounds/birthday.mp3',
            auction: 'sounds/auction.mp3',
            bankrupt: 'sounds/bankrupt.mp3',
            build: 'sounds/build.mp3',
            buy: 'sounds/buy.mp3',
            cash: 'sounds/cash.mp3',
            click: 'sounds/click.mp3',
            demolish: 'sounds/demolish.mp3',
            dice: 'sounds/dice.mp3',
            hotel: 'sounds/hotel.mp3',
            jail_in: 'sounds/jail_in.mp3',
            jail_out: 'sounds/jail_out.mp3',
            jail: 'sounds/jail.mp3',
            move: 'sounds/move.mp3',
            pay: 'sounds/pay.mp3',
            roll: 'sounds/roll.mp3',
            trade: 'sounds/trade.mp3',
            win: 'sounds/win.mp3',
            tax: 'sounds/tax.mp3',
            chance: 'sounds/chance.mp3',
            special: 'sounds/special.mp3',
            notification: 'sounds/notification.mp3',
            error: 'sounds/error.mp3',
            start: 'sounds/start.mp3',
            gameover: 'sounds/gameover.mp3',
            celebrate: 'sounds/celebrate.mp3'
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            this.sounds[name] = new Audio(path);
            this.sounds[name].volume = this.volume;
        }
    }

    play(soundName) {
        if (!this.isEnabled) return;
        try {
            const sound = new Audio(`sounds/${soundName}.mp3`);
            sound.volume = this.volume;
            sound.play().catch(e => {});
        } catch (e) {}
    }

    playWithOverlap(soundName) {
        if (!this.isEnabled) return;
        try {
            const sound = new Audio(`sounds/${soundName}.mp3`);
            sound.volume = this.volume;
            sound.play().catch(e => {});
        } catch (e) {}
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        for (const sound of Object.values(this.sounds)) {
            sound.volume = this.volume;
        }
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }

    isSoundEnabled() {
        return this.isEnabled;
    }
}

const audioManager = new AudioManager();

// ============================================
// TRUMPOS FUNKCIJOS (patogumui)
// ============================================

function playSound(soundName) {
    audioManager.play(soundName);
}

// ============================================
// SERVICE1 GARSAI (DUJOS, ŠIUKŠLĖS, ELEKTRA, VANDUO)
// ============================================

function playDujosSound() {
    audioManager.play('dujos');
    setTimeout(() => audioManager.play('dujos1'), 100);
}

function playSiukslesSound() {
    audioManager.play('siuksles');
    setTimeout(() => audioManager.play('siuksles'), 300);
}

function playElektraSound() {
    audioManager.play('elektra');
}

function playVanduoSound() {
    audioManager.play('vanduo');
}

// ============================================
// SERVICE2 GARSAI (ORO UOSTAS, TRAUKINIŲ STOTIS, UOSTAS, AUTOBUSŲ STOTIS)
// ============================================

function playAirPortSound() {
    audioManager.play('air-port');
}

function playAirInSound() {
    audioManager.play('air-in');
}

function playTrainSound() {
    audioManager.play('train');
}

function playPortSound() {
    audioManager.play('port');
}

function playBusSound() {
    audioManager.play('bus');
}

// ============================================
// LIGONINĖS GARSAS
// ============================================

function playHospitalSound() {
    audioManager.play('hospital');
}

// ============================================
// SPECIALŪS GARSAI (LATRŲ UŽEIGA, PIRTIS, GIMTADIENIS)
// ============================================

function playLatrasSound() {
    audioManager.play('latras');
}

function playPirtisSound() {
    audioManager.play('pirtis');
}

function playBirthdaySound() {
    audioManager.play('birthday');
}

// ============================================
// PAGRINDINIAI GARSAI
// ============================================

function playDiceSound() {
    audioManager.play('dice');
}

function playRollSound() {
    audioManager.play('roll');
}

function playBuySound() {
    audioManager.play('buy');
}

function playMoveSound() {
    audioManager.play('move');
}

function playTradeSound() {
    audioManager.play('trade');
}

function playAuctionSound() {
    audioManager.play('auction');
}

function playBankruptSound() {
    audioManager.play('bankrupt');
}

function playJailSound() {
    audioManager.play('jail');
}

function playJailInSound() {
    audioManager.play('jail_in');
}

function playJailOutSound() {
    audioManager.play('jail_out');
}

function playWinSound() {
    audioManager.play('win');
}

// ============================================
// KITI GARSAI
// ============================================

function playCashSound() {
    audioManager.play('cash');
}

function playPaySound() {
    audioManager.play('pay');
}

function playBuildSound() {
    audioManager.play('build');
}

function playHotelSound() {
    audioManager.play('hotel');
}

function playDemolishSound() {
    audioManager.play('demolish');
}

function playTaxSound() {
    audioManager.play('tax');
}

function playChanceSound() {
    audioManager.play('chance');
}

function playSpecialSound() {
    audioManager.play('special');
}

function playNotificationSound() {
    audioManager.play('notification');
}

function playErrorSound() {
    audioManager.play('error');
}

function playStartSound() {
    audioManager.play('start');
}

function playGameOverSound() {
    audioManager.play('gameover');
}

function playCelebrateSound() {
    audioManager.play('celebrate');
}

function playClickSound() {
    audioManager.play('click');
}

function toggleSound() {
    const enabled = audioManager.toggle();
    const status = enabled ? 'ĮJUNGTI' : 'IŠJUNGTI';
    console.log(`🔊 Garsai: ${status}`);
    if (typeof addNotification === 'function') {
        addNotification(`🔊 Garsai ${status}`);
    }
    return enabled;
}