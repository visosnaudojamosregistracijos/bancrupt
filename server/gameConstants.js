module.exports = {
    // ============================================
    // SPALVŲ GRUPĖS (sklypai pagal spalvą)
    // ============================================
    COLOR_GROUPS: {
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
    },

    // ============================================
    // PASLAUGŲ GRUPĖS
    // ============================================
    // SERVICE1: DUJOS, ŠIUKŠLĖS, ELEKTRA, VANDUO
    SERVICE1_IDS: [2, 14, 29, 45],
    
     // SERVICE2: ORO UOSTAS, GEL. STOTIS, UOSTAS, AUTOBUSŲ STOTIS
    SERVICE2_IDS: [8, 19, 40, 47],

    // ============================================
    // KAINŲ KOEFICIENTAI
    // ============================================
    // Pardavimas bankui (80% kortelės vertės)
    BANK_BUYBACK_RATIO: 0.8,
    
    // Aukciono startinė kaina (70% kortelės vertės)
    AUCTION_START_RATIO: 0.7,
    
    // Namo statyba (50% sklypo vertės)
    BUILD_COST_RATIO: 0.5,
    
    // Viešbučio statyba (100% sklypo vertės)
    HOTEL_COST_RATIO: 1.0,
    
    // Namo griovimo grąža (75% statybos kainos = 37.5% sklypo vertės)
    DEMOLISH_REFUND_RATIO: 0.375,
    
    // Viešbučio griovimo grąža (75% sklypo vertės)
    HOTEL_DEMOLISH_REFUND: 0.75,
    
    // Bazinė nuoma (10% sklypo vertės)
    RENT_BASE_RATIO: 0.1,
    
    // Nuomos daugikliai: [1 namas, 2, 3, 4, viešbutis]
    RENT_MULTIPLIERS: [10, 20, 30, 40, 50]
};