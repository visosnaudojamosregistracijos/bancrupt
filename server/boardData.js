const boardData = [
    // KAMPAS 1: START
    { id: 0, name: 'START', type: 'start', color: '#28a745', cost: 0, icon: '🏁' },
    
    // VIRŠUS
    { id: 1, name: 'Telšiai', type: 'property', color: '#ffd700', cost: 60, icon: '' },
    { id: 2, name: 'DUJOS', type: 'service1', color: null, cost: 150, icon: '⚡' },
    { id: 3, name: 'Plungė', type: 'property', color: '#ffd700', cost: 73, icon: '' },
    { id: 4, name: 'HORNY RP', type: 'special', color: '#fd7e14', cost: 0, icon: '🎲' },
    { id: 5, name: 'VMI', type: 'tax', color: '#dc3545', cost: 200, icon: '💰' },
    { id: 6, name: 'Kėdainiai', type: 'property', color: '#4a90d9', cost: 86, icon: '' },
    { id: 7, name: 'Ariogala', type: 'property', color: '#4a90d9', cost: 99, icon: '' },
    { id: 8, name: 'ORO UOSTAS', type: 'service2', color: null, cost: 200, icon: '✈️' },  // ← PAKEISTA
    { id: 9, name: 'Ramygala', type: 'property', color: '#4a90d9', cost: 112, icon: '' },
    { id: 10, name: 'Utena', type: 'property', color: '#2ecc71', cost: 125, icon: '' },
    { id: 11, name: 'Anykščiai', type: 'property', color: '#2ecc71', cost: 138, icon: '' },
    { id: 12, name: 'Zarasai', type: 'property', color: '#2ecc71', cost: 151, icon: '' },
    { id: 13, name: 'LIGONINĖ', type: 'special', color: '#6f42c1', cost: 100, icon: '🏥' },
    { id: 14, name: 'ŠIUKŠLĖS', type: 'service1', color: null, cost: 150, icon: '🗑️' },
    { id: 15, name: 'Jonava', type: 'property', color: '#e67e22', cost: 164, icon: '' },
    
    // KAMPAS 2: KALĖJIMAS
    { id: 16, name: 'KALĖJIMAS', type: 'jail', color: '#6c757d', cost: 0, icon: '⛓️' },
    
    // DEŠINĖ
    { id: 17, name: 'Rukla', type: 'property', color: '#e67e22', cost: 177, icon: '' },
    { id: 18, name: 'Karmėlava', type: 'property', color: '#e67e22', cost: 190, icon: '' },
    { id: 19, name: 'TRAUKINIŲ STOTIS', type: 'service2', color: null, cost: 200, icon: '🚂' },  // ← PAKEISTA
    { id: 20, name: 'Mažeikiai', type: 'property', color: '#9b59b6', cost: 203, icon: '' },
    { id: 21, name: 'Skuodas', type: 'property', color: '#9b59b6', cost: 216, icon: '' },
    { id: 22, name: 'N.Akmenė', type: 'property', color: '#9b59b6', cost: 229, icon: '' },
    { id: 23, name: 'LATRU UŽEIGA', type: 'tax', color: '#dc3545', cost: 0, icon: '🍺' },
    { id: 24, name: 'Marijampolė', type: 'property', color: '#e74c3c', cost: 242, icon: '' },
    { id: 25, name: 'Vilkaviškis', type: 'property', color: '#e74c3c', cost: 255, icon: '' },
    
    // KAMPAS 3: PARKINGAS
    { id: 26, name: 'PARKINGAS', type: 'parking', color: '#007bff', cost: 0, icon: '🅿️' },
    
    // APAČIA
    { id: 27, name: 'Kalvarija', type: 'property', color: '#e74c3c', cost: 268, icon: '' },
    { id: 28, name: 'Alytus', type: 'property', color: '#8B6914', cost: 281, icon: '' },
    { id: 29, name: 'ELEKTRA', type: 'service1', color: null, cost: 150, icon: '💡' },
    { id: 30, name: 'Lazdijai', type: 'property', color: '#8B6914', cost: 294, icon: '' },
    { id: 31, name: 'Druskininkai', type: 'property', color: '#8B6914', cost: 307, icon: '' },
    { id: 32, name: 'Panevėžys', type: 'property', color: '#1abc9c', cost: 320, icon: '' },
    { id: 33, name: 'VLADUKO PIRTIS', type: 'tax', color: '#dc3545', cost: 25, icon: '🧖' },
    { id: 34, name: 'Pasvalys', type: 'property', color: '#1abc9c', cost: 333, icon: '' },
    { id: 35, name: 'Kupiškis', type: 'property', color: '#1abc9c', cost: 346, icon: '' },
    { id: 36, name: 'Šiauliai', type: 'property', color: '#ff69b4', cost: 359, icon: '' },
    { id: 37, name: 'Kuršėnai', type: 'property', color: '#ff69b4', cost: 372, icon: '' },
    { id: 38, name: 'Radviliškis', type: 'property', color: '#ff69b4', cost: 385, icon: '' },
    { id: 39, name: 'Klaipėda', type: 'property', color: '#2c3e50', cost: 398, icon: '' },
    { id: 40, name: 'UOSTAS', type: 'service2', color: null, cost: 200, icon: '⚓' },  // ← PAKEISTA
    { id: 41, name: 'Palanga', type: 'property', color: '#2c3e50', cost: 411, icon: '' },
    
    // KAMPAS 4: KELIAUK Į KALĖJIMĄ
    { id: 42, name: 'KELIAUK Į KALĖJIMĄ', type: 'go-to-jail', color: '#dc3545', cost: 0, icon: '🚨' },
    
    // KAIRĖ
    { id: 43, name: 'Gargždai', type: 'property', color: '#2c3e50', cost: 424, icon: '' },
    { id: 44, name: 'Kaunas', type: 'property', color: '#1a237e', cost: 437, icon: '' },
    { id: 45, name: 'VANDUO', type: 'service1', color: null, cost: 150, icon: '💧' },
    { id: 46, name: 'Garliava', type: 'property', color: '#1a237e', cost: 450, icon: '' },
    { id: 47, name: 'AUTOBUSŲ STOTIS', type: 'service2', color: null, cost: 200, icon: '🚌' },  // ← PAKEISTA
    { id: 48, name: 'Raudondvaris', type: 'property', color: '#1a237e', cost: 463, icon: '' },
    { id: 49, name: 'Trakai', type: 'property', color: '#bdc3c7', cost: 476, icon: '' },
    { id: 50, name: 'Gimtadienis', type: 'tax', color: '#dc3545', cost: 0, icon: '🎂' },
    { id: 51, name: 'Vilnius', type: 'property', color: '#bdc3c7', cost: 500, icon: '' },
];

module.exports = boardData;