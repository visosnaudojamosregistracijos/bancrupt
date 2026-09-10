const boardData = [
    // KAMPAS 1: START
    { id: 0, name: 'START', type: 'start', color: '#28a745', cost: 0, icon: '🏁' },
    
    // VIRŠUS
    { id: 1, name: 'Vytauto g.', type: 'property', color: '#ffd700', cost: 60, icon: '' },
    { id: 2, name: 'DUJOS', type: 'service1', color: null, cost: 150, icon: '⚡' },
    { id: 3, name: 'Gostauto g.', type: 'property', color: '#ffd700', cost: 73, icon: '' },
    { id: 4, name: 'HORNY RP', type: 'special', color: '#fd7e14', cost: 0, icon: '🎲' },
    { id: 5, name: 'VMI', type: 'tax', color: '#dc3545', cost: 200, icon: '💰' },
    { id: 6, name: 'Donelaičio', type: 'property', color: '#4a90d9', cost: 86, icon: '' },
    { id: 7, name: 'Laisvės al.', type: 'property', color: '#4a90d9', cost: 99, icon: '' },
    { id: 8, name: 'ORO UOSTAS', type: 'service2', color: null, cost: 200, icon: '✈️' },  // ← PAKEISTA
    { id: 9, name: 'K. Petrausko', type: 'property', color: '#4a90d9', cost: 112, icon: '' },
    { id: 10, name: 'V. Kudirkos', type: 'property', color: '#2ecc71', cost: 125, icon: '' },
    { id: 11, name: 'S. Daukanto', type: 'property', color: '#2ecc71', cost: 138, icon: '' },
    { id: 12, name: 'J. Basanavič.', type: 'property', color: '#2ecc71', cost: 151, icon: '' },
    { id: 13, name: 'LIGONINĖ', type: 'special', color: '#6f42c1', cost: 100, icon: '🏥' },
    { id: 14, name: 'ŠIUKŠLĖS', type: 'service1', color: null, cost: 150, icon: '🗑️' },
    { id: 15, name: 'Laisvės g.', type: 'property', color: '#e67e22', cost: 164, icon: '' },
    
    // KAMPAS 2: KALĖJIMAS
    { id: 16, name: 'KALĖJIMAS', type: 'jail', color: '#6c757d', cost: 0, icon: '⛓️' },
    
    // DEŠINĖ
    { id: 17, name: 'Vilniaus g.', type: 'property', color: '#e67e22', cost: 177, icon: '' },
    { id: 18, name: 'Šv. Jono g.', type: 'property', color: '#e67e22', cost: 190, icon: '' },
    { id: 19, name: 'TRAUKINIŲ STOTIS', type: 'service2', color: null, cost: 200, icon: '🚂' },  // ← PAKEISTA
    { id: 20, name: 'Aušros g.', type: 'property', color: '#9b59b6', cost: 203, icon: '' },
    { id: 21, name: 'Maironio g.', type: 'property', color: '#9b59b6', cost: 216, icon: '' },
    { id: 22, name: 'V. Krėvės g.', type: 'property', color: '#9b59b6', cost: 229, icon: '' },
    { id: 23, name: 'LATRU UŽEIGA', type: 'tax', color: '#dc3545', cost: 0, icon: '🍺' },
    { id: 24, name: 'Pilies g.', type: 'property', color: '#e74c3c', cost: 242, icon: '' },
    { id: 25, name: 'Gedimino pr.', type: 'property', color: '#e74c3c', cost: 255, icon: '' },
    
    // KAMPAS 3: PARKINGAS
    { id: 26, name: 'PARKINGAS', type: 'parking', color: '#007bff', cost: 0, icon: '🅿️' },
    
    // APAČIA
    { id: 27, name: 'Kauno g.', type: 'property', color: '#e74c3c', cost: 268, icon: '' },
    { id: 28, name: 'Kęstučio g.', type: 'property', color: '#8B6914', cost: 281, icon: '' },
    { id: 29, name: 'ELEKTRA', type: 'service1', color: null, cost: 150, icon: '💡' },
    { id: 30, name: 'Laisvės al.', type: 'property', color: '#8B6914', cost: 294, icon: '' },
    { id: 31, name: 'S. Daukanto g.', type: 'property', color: '#8B6914', cost: 307, icon: '' },
    { id: 32, name: 'V. Kudirkos g.', type: 'property', color: '#1abc9c', cost: 320, icon: '' },
    { id: 33, name: 'VLADUKO PIRTIS', type: 'tax', color: '#dc3545', cost: 25, icon: '🧖' },
    { id: 34, name: 'K. Petrausko g.', type: 'property', color: '#1abc9c', cost: 333, icon: '' },
    { id: 35, name: 'J. Basanavič.', type: 'property', color: '#1abc9c', cost: 346, icon: '' },
    { id: 36, name: 'Donelaičio g.', type: 'property', color: '#ff69b4', cost: 359, icon: '' },
    { id: 37, name: 'Vytauto g.', type: 'property', color: '#ff69b4', cost: 372, icon: '' },
    { id: 38, name: 'Pižiaus g.', type: 'property', color: '#ff69b4', cost: 385, icon: '' },
    { id: 39, name: 'A. Gostauto g.', type: 'property', color: '#2c3e50', cost: 398, icon: '' },
    { id: 40, name: 'UOSTAS', type: 'service2', color: null, cost: 200, icon: '⚓' },  // ← PAKEISTA
    { id: 41, name: 'V. Krėvės g.', type: 'property', color: '#2c3e50', cost: 411, icon: '' },
    
    // KAMPAS 4: KELIAUK Į KALĖJIMĄ
    { id: 42, name: 'KELIAUK Į KALĖJIMĄ', type: 'go-to-jail', color: '#dc3545', cost: 0, icon: '🚨' },
    
    // KAIRĖ
    { id: 43, name: 'Maironio g.', type: 'property', color: '#2c3e50', cost: 424, icon: '' },
    { id: 44, name: 'Aušros g.', type: 'property', color: '#1a237e', cost: 437, icon: '' },
    { id: 45, name: 'VANDUO', type: 'service1', color: null, cost: 150, icon: '💧' },
    { id: 46, name: 'Pilies g.', type: 'property', color: '#1a237e', cost: 450, icon: '' },
    { id: 47, name: 'AUTOBUSŲ STOTIS', type: 'service2', color: null, cost: 200, icon: '🚌' },  // ← PAKEISTA
    { id: 48, name: 'Klaipedos g.', type: 'property', color: '#1a237e', cost: 463, icon: '' },
    { id: 49, name: 'Kauno g.', type: 'property', color: '#bdc3c7', cost: 476, icon: '' },
    { id: 50, name: 'Gimtadienis', type: 'tax', color: '#dc3545', cost: 0, icon: '🎂' },
    { id: 51, name: 'Vilniaus g.', type: 'property', color: '#bdc3c7', cost: 500, icon: '' },
];

module.exports = boardData;