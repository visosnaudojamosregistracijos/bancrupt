// ============================================
// server/gameConstants.js
// Bendros konstantos visam žaidimui
// ============================================

module.exports = {
    // ============================================
    // SPALVŲ GRUPĖS (sklypai pagal spalvą)
    // ============================================
    COLOR_GROUPS: {
        '#ffd700': [1, 3],           // Telšiai, Plungė
        '#4a90d9': [6, 7, 9],        // Kėdainiai, Ariogala, Ramygala
        '#2ecc71': [10, 12, 15],     // Utena, Anykščiai, Zarasai
        '#9b59b6': [17, 18, 20],     // Mažeikiai, Skuodas, N.Akmenė
        '#e74c3c': [22, 23, 25],     // Marijampolė, Vilkaviškis, Kalvarija
        '#8B6914': [27, 29, 30],     // Alytus, Lazdijai, Druskininkai
        '#1abc9c': [31, 33, 34],     // Panevėžys, Pasvalys, Kupiškis
        '#ff69b4': [35, 36, 38],     // Šiauliai, Kuršėnai, Radviliškis
        '#2c3e50': [39, 40, 41],     // Klaipėda, Palanga, Gargždai
        '#1a237e': [43, 45, 47],     // Kaunas, Garliava, Raudondvaris
        '#bdc3c7': [49, 51]          // Trakai, Vilnius
    },

    // ============================================
    // SERVICE GRUPĖS
    // ============================================
    // SERVICE1: DUJOS, ŠIUKŠLĖS, ELEKTRA, VANDUO
    SERVICE1_IDS: [2, 14, 28, 44],
    
    // SERVICE2: ORO UOSTAS, GEL. STOTIS, UOSTAS, AUTOBUSŲ STOTIS
    SERVICE2_IDS: [8, 19, 37, 46],

    // SERVICE3: CIRKAS, VETERINORIUS, SAUNA, AKROPOLIS
    SERVICE3_IDS: [11, 24, 32, 48],

    // Fiksuota nuoma pagal turimų langelių skaičių (service1, service2, service3)
    SERVICE_RENT: {
        1: 50,
        2: 100,
        3: 150,
        4: 200
    },

    // ============================================
    // KAINŲ KOEFICIENTAI
    // ============================================
    // Pardavimas bankui (80% kortelės vertės)
    BANK_BUYBACK_RATIO: 0.8,
    
    // Aukciono startinė kaina (70% kortelės vertės)
    AUCTION_START_RATIO: 0.7,
    
    // Namo statyba (100% sklypo vertės)
    BUILD_COST_RATIO: 1.0,
    
    // Viešbučio statyba (100% sklypo vertės)
    HOTEL_COST_RATIO: 1.0,
    
    // Namo griovimo grąža (75% statybos kainos = 37.5% sklypo vertės)
    DEMOLISH_REFUND_RATIO: 0.375,
    
    // Viešbučio griovimo grąža (75% sklypo vertės)
    HOTEL_DEMOLISH_REFUND: 0.75,
    
    // Bazinė nuoma (10% sklypo vertės)
    RENT_BASE_RATIO: 0.1,
    
    // Nuomos daugikliai (nebereikalingi, nes naudojama nauja formulė)
    // RENT_MULTIPLIERS: [10, 20, 30, 40, 50],

    // ============================================
    // ŽAIDIMO KONSTANTOS
    // ============================================
    // Pradinis žaidėjo kapitalas
    START_MONEY: 1500,
    
    // Bonusas praėjus START (nesustojus)
    START_BONUS: 200,
    
    // Bonusas atsistojus ant START
    START_LAND_BONUS: 300,
    
    // Kalėjimo išpirkimas
    JAIL_FINE: 50,
    
    // Maksimalus žaidėjų skaičius
    MAX_PLAYERS: 8,

    // ============================================
    // VOTE-KICK KONSTANTOS
    // ============================================
    // Kiek balsų reikia UŽ pašalinimą (pagal žaidėjų skaičių)
    VOTE_KICK_REQUIRED: { 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5 },
    
    // Balsavimo trukmė (ms)
    VOTE_KICK_DURATION: 60000,

    // ============================================
    // AUKCIONO KONSTANTOS
    // ============================================
    // Aukciono trukmė (ms)
    AUCTION_DURATION: 60000,
    
    // Pratęsimas po kiekvieno bid'o (ms)
    AUCTION_EXTENSION: 10000,

    // ============================================
    // PIRKIMO TIMEOUT
    // ============================================
    // Kiek laiko žaidėjas turi nuspręsti pirkti (ms)
    BUY_TIMEOUT: 30000,

    // ============================================
    // ŽAIDĖJŲ SPALVOS
    // ============================================
    PLAYER_COLORS: [
        '#9c0505', '#e2de00', '#5506d3', '#05b130',
        '#000000', '#00adc4', '#492b1f', '#0609d6'
    ]
};