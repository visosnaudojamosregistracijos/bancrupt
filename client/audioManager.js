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

// PAGRINDINIAI GARSAI
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

// NAUJI GARSAI
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