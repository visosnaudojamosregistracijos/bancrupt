// ============================================
// audioManager.js
// ============================================

class AudioManager {
    constructor() {
    this.sounds = {};
    this.isEnabled = true;          // 🔊 Efektams
    this.isMusicEnabled = true;     // 🎵 Muzikai (NAUJA!)
    this.musicVolume = 0.05;
    this.sfxVolume = 0.10;
    
    // 🆕 Garso lygiai kiekvienam garsui (0-10)
    this.soundLevels = {
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
    
    this.loadSounds();
    this.loadSoundLevels();
}
    
    // 🆕 Įkelti garso lygius iš localStorage
    loadSoundLevels() {
        try {
            const saved = localStorage.getItem('bancrupt_soundLevels');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.soundLevels = { ...this.soundLevels, ...parsed };
                console.log('🔊 Garso lygiai įkelti:', this.soundLevels);
            }
        } catch (e) {
            console.warn('⚠️ Nepavyko įkelti garso lygių:', e);
        }
    }
    
    // 🆕 Išsaugoti garso lygius
    saveSoundLevels() {
        try {
            localStorage.setItem('bancrupt_soundLevels', JSON.stringify(this.soundLevels));
            console.log('💾 Garso lygiai išsaugoti');
        } catch (e) {
            console.warn('⚠️ Nepavyko išsaugoti garso lygių:', e);
        }
    }
    
    // 🆕 Nustatyti garso lygį
    setSoundLevel(soundName, level) {
        this.soundLevels[soundName] = Math.max(0, Math.min(10, parseInt(level) || 0));
        this.saveSoundLevels();
    }
    
    // 🆕 Gauti garso lygį
    getSoundLevel(soundName) {
        return this.soundLevels[soundName] !== undefined ? this.soundLevels[soundName] : 5;
    }

    loadSounds() {
        const soundFiles = {
            'background': 'sounds/background.mp3',
            'spa': 'sounds/spa.mp3',
            'baseinas': 'sounds/baseinas.mp3',
            'papludimys': 'sounds/papludimys.mp3',
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
            'auction': 'sounds/auction.mp3',
            'bankrupt': 'sounds/bankrupt.mp3',
            'build': 'sounds/build.mp3',
            'buy': 'sounds/buy.mp3',
            'cash': 'sounds/cash.mp3',
            'click': 'sounds/click.mp3',
            'demolish': 'sounds/demolish.mp3',
            'dice': 'sounds/dice.mp3',
            'hotel': 'sounds/hotel.mp3',
            'jail_in': 'sounds/jail_in.mp3',
            'jail_out': 'sounds/jail_out.mp3',
            'jail': 'sounds/jail.mp3',
            'move': 'sounds/move.mp3',
            'pay': 'sounds/pay.mp3',
            'pay1': 'sounds/pay1.mp3',
            'roll': 'sounds/roll.mp3',
            'trade': 'sounds/trade.mp3',
            'win': 'sounds/win.mp3',
            'tax': 'sounds/tax.mp3',
            'chance': 'sounds/chance.mp3',
            'special': 'sounds/special.mp3',
            'notification': 'sounds/notification.mp3',
            'error': 'sounds/error.mp3',
            'start': 'sounds/start.mp3',
            'gameover': 'sounds/gameover.mp3',
            'celebrate': 'sounds/celebrate.mp3',
            'your-turn': 'sounds/your-turn.mp3',
'game-start': 'sounds/game-start.mp3',
'rent-received': 'sounds/rent-received.mp3'
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            const audio = new Audio(path);
            // 🆕 Skirtingi volume'ai
            if (name === 'background') {
                audio.volume = this.musicVolume;
            } else {
                audio.volume = this.sfxVolume;
            }
            audio.preload = 'auto';
            this.sounds[name] = audio;
        }
    }
    
    // 🆕 Atnaujinti garso failus iš DB   ← NAUJA!
    updateSoundFiles(files) {
        if (!files || !Array.isArray(files)) return;
        
        console.log('📁 Atnaujinami garso failai iš DB:', files.length);
        
        files.forEach(f => {
            // Sukurti naują Audio su DB keliu
            const audio = new Audio(f.file_path);
            audio.volume = f.sound_name === 'background' ? this.musicVolume : this.sfxVolume;
            audio.preload = 'auto';
            
            this.sounds[f.sound_name] = audio;
            
            console.log(`  ✅ ${f.sound_name}: ${f.file_path}`);
        });
    }

    // 🆕 Groti vieną kartą (restart + play)
    play(soundName) {
        if (!this.isEnabled) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn('⚠️ Garso nėra:', soundName);
            return;
        }
        
        // 🆕 Patikrinti garso lygį
        const level = this.getSoundLevel(soundName);
        if (level <= 0) return;   // 0 = tylu
        
        try {
            sound.currentTime = 0;
            // 🆕 Galutinis garsumas = bendras × (lygis / 10)
            sound.volume = this.sfxVolume * (level / 10);
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {});
            }
        } catch (e) {
            // Ignoruoti
        }
    }

    // 🆕 Groti fono muziką (loop)
    // 🆕 Groti fono muziką (loop)
playLoop(soundName) {
    if (!this.isMusicEnabled) return;   // 🆕 TIK muzikos patikra!
    
    const sound = this.sounds[soundName];
    if (!sound) {
        console.warn('⚠️ Garso nėra:', soundName);
        return;
    }
    
    try {
        sound.loop = true;
        sound.volume = this.musicVolume;
        sound.currentTime = 0;
        
        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    } catch (e) {}
}

    // 🆕 Sustabdyti fono muziką
    stopLoop(soundName) {
        const sound = this.sounds[soundName];
        if (!sound) return;
        
        try {
            sound.pause();
            sound.currentTime = 0;
        } catch (e) {}
    }

    // 🆕 Groti garsą, kuris gali persidengti
    playOverlap(soundName) {
        if (!this.isEnabled) return;
        
        const original = this.sounds[soundName];
        if (!original) return;
        
        // 🆕 Patikrinti garso lygį
        const level = this.getSoundLevel(soundName);
        if (level <= 0) return;
        
        try {
            const clone = original.cloneNode();
            // 🆕 Galutinis garsumas = bendras × (lygis / 10)
            clone.volume = this.sfxVolume * (level / 10);
            clone.play().catch(() => {});
        } catch (e) {
            // Ignoruoti
        }
    }

    // 🆕 Nustatyti fono muzikos garsumą
setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    const bg = this.sounds['background'];
    if (bg) bg.volume = this.musicVolume;
    
    // 🆕 Jei volume > 0 ir muzika įjungta – paleisti
    if (this.musicVolume > 0 && this.isMusicEnabled && bg && bg.paused) {
        bg.play().catch(() => {});
    }
}

    // 🆕 Nustatyti žaidimo garsų garsumą
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        // Atnaujinti visus garsus, išskyrus background
        for (const [name, sound] of Object.entries(this.sounds)) {
            if (name !== 'background') {
                sound.volume = this.sfxVolume;
            }
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
// SERVICE1 GARSAI
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
// SERVICE2 GARSAI
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
// SPECIALŪS GARSAI
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
function playYourTurnSound() {
    audioManager.play('your-turn');
}
// 🆕 Žaidimo pradžia
function playGameStartSound() {
    audioManager.play('game-start');
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
    audioManager.playOverlap('click');
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