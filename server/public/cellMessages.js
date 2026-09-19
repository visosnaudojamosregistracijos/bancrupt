// ============================================
// cellMessages.js
// Visi pranešimai kiekvienam langeliui
// ============================================

window.CELL_MESSAGES = {
    // ============================================
    // KAMPAS 0: START
    // ============================================
    0: {
        name: 'START',
        type: 'start',
        messages: {
            visitMine: '🏁 Atvykai į START – gavai €300! 💰',
            visitOthers: '🏁 {player} atvyko į START – gavo €300! 💰',
            visitObserver: '🏁 {player} atvyko į START – gavo €300! 💰'
        }
    },
    
    // ============================================
    // VIRŠUS
    // ============================================
    1: {
        name: 'Telšiai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Telšius! 🏠',
            buyOthers: '✅ {player} nusipirko Telšius! 🏠',
            
            visitMine: '🏠 Atvykai į Telšius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Telšius – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Telšius – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Telšius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Telšius ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Telšius ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Telšiuose.',
            buildOthers: '🏠 {player} pastatė namą Telšiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Telšiuose.',
            
            hotelMine: '🏨 Sklypas Telšiai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Telšiai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Telšiai jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną geltoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną geltoną gatvę ir jau gali pradėti statybas.'
        }
    },
    2: {
        name: 'DUJOS',
        type: 'service1',
        messages: {
            buyMine: '✅ Jūs nusipirkote DUJAS! ⚡',
            buyOthers: '✅ {player} nusipirko DUJAS! ⚡',
            
            visitMine: '⚡ Atvykai į DUJAS – tai tavo nuosavybė.',
            visitOthers: '⚡ {player} atvyko į DUJAS – savo nuosavybę.',
            visitObserver: '⚡ {player} atvyko į DUJAS – savo nuosavybę.',
            
            rentOwner: '⚡ {player} atvyko į DUJAS ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '⚡ Tu atvykai į DUJAS ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '⚡ {player} atvyko į DUJAS ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    3: {
        name: 'Plungė',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Plungę! 🏠',
            buyOthers: '✅ {player} nusipirko Plungę! 🏠',
            
            visitMine: '🏠 Atvykai į Plungę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Plungę – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Plungę – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Plungę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Plungę ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Plungę ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Plungėje.',
            buildOthers: '🏠 {player} pastatė namą Plungėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Plungėje.',
            
            hotelMine: '🏨 Sklypas Plungė pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Plungė jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Plungė jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną geltoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną geltoną gatvę ir jau gali pradėti statybas.'
        }
    },
    4: {
        name: 'HORNY RP',
        type: 'special',
        messages: {
            visitMine: '🎲 Atvykai į HORNY RP ir gavai €200 nuo Dedo su Juanu! 🎉',
            visitOthers: '🎲 {player} atvyko į HORNY RP ir gavo €200 nuo Dedo su Juanu! 🎉',
            visitObserver: '🎲 {player} atvyko į HORNY RP ir gavo €200 nuo Dedo su Juanu! 🎉'
        }
    },
    5: {
        name: 'VMI',
        type: 'tax',
        messages: {
            visitMine: '💸 Atvykai į VMI ir sumokėjai €200 mokesčių! 💰',
            visitOthers: '💸 {player} atvyko į VMI ir sumokėjo €200 mokesčių! 💰',
            visitObserver: '💸 {player} atvyko į VMI ir sumokėjo €200 mokesčių! 💰'
        }
    },
    6: {
        name: 'Kėdainiai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Kėdainius! 🏠',
            buyOthers: '✅ {player} nusipirko Kėdainius! 🏠',
            
            visitMine: '🏠 Atvykai į Kėdainius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kėdainius – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kėdainius – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Kėdainius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kėdainius ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kėdainius ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Kėdainiuose.',
            buildOthers: '🏠 {player} pastatė namą Kėdainiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kėdainiuose.',
            
            hotelMine: '🏨 Sklypas Kėdainiai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kėdainiai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kėdainiai jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    7: {
        name: 'Ariogala',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Ariogalą! 🏠',
            buyOthers: '✅ {player} nusipirko Ariogalą! 🏠',
            
            visitMine: '🏠 Atvykai į Ariogalą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Ariogalą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Ariogalą – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Ariogalą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Ariogalą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Ariogalą ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Ariogaloje.',
            buildOthers: '🏠 {player} pastatė namą Ariogaloje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Ariogaloje.',
            
            hotelMine: '🏨 Sklypas Ariogala pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Ariogala jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Ariogala jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    8: {
        name: 'ORO UOSTAS',
        type: 'service2',
        messages: {
            buyMine: '✅ Jūs nusipirkote ORO UOSTĄ! ✈️',
            buyOthers: '✅ {player} nusipirko ORO UOSTĄ! ✈️',
            
            visitMine: '✈️ Atvykai į ORO UOSTĄ – tai tavo nuosavybė.',
            visitOthers: '✈️ {player} atvyko į ORO UOSTĄ – savo nuosavybę.',
            visitObserver: '✈️ {player} atvyko į ORO UOSTĄ – savo nuosavybę.',
            
            rentOwner: '✈️ {player} atvyko į ORO UOSTĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '✈️ Tu atvykai į ORO UOSTĄ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '✈️ {player} atvyko į ORO UOSTĄ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    9: {
        name: 'Ramygala',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Ramygalą! 🏠',
            buyOthers: '✅ {player} nusipirko Ramygalą! 🏠',
            
            visitMine: '🏠 Atvykai į Ramygalą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Ramygalą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Ramygalą – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Ramygalą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Ramygalą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Ramygalą ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Ramygaloje.',
            buildOthers: '🏠 {player} pastatė namą Ramygaloje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Ramygaloje.',
            
            hotelMine: '🏨 Sklypas Ramygala pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Ramygala jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Ramygala jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    10: {
        name: 'Utena',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Uteną! 🏠',
            buyOthers: '✅ {player} nusipirko Uteną! 🏠',
            
            visitMine: '🏠 Atvykai į Uteną – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Uteną – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Uteną – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Uteną ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Uteną ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Uteną ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Utenoje.',
            buildOthers: '🏠 {player} pastatė namą Utenoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Utenoje.',
            
            hotelMine: '🏨 Sklypas Utena pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Utena jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Utena jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    11: {
        name: 'Cirkas',
        type: 'special',
        messages: {
            visitMine: '🎪 Atvykai į CIRKĄ – nieko neįvyko.',
            visitOthers: '🎪 {player} atvyko į CIRKĄ – nieko neįvyko.',
            visitObserver: '🎪 {player} atvyko į CIRKĄ – nieko neįvyko.'
        }
    },
    12: {
        name: 'Anykščiai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Anykščius! 🏠',
            buyOthers: '✅ {player} nusipirko Anykščius! 🏠',
            
            visitMine: '🏠 Atvykai į Anykščius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Anykščius – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Anykščius – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Anykščius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Anykščius ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Anykščius ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Anykščiuose.',
            buildOthers: '🏠 {player} pastatė namą Anykščiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Anykščiuose.',
            
            hotelMine: '🏨 Sklypas Anykščiai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Anykščiai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Anykščiai jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    13: {
        name: 'LIGONINĖ',
        type: 'special',
        messages: {
            visitMine: '🏥 Atvykai į LIGONINĘ ir sumokėjai €100 daktarui Bubauskui! 👨‍⚕️',
            visitOthers: '🏥 {player} atvyko į LIGONINĘ ir sumokėjo €100 daktarui Bubauskui! 👨‍⚕️',
            visitObserver: '🏥 {player} atvyko į LIGONINĘ ir sumokėjo €100 daktarui Bubauskui! 👨‍⚕️'
        }
    },
    14: {
        name: 'ŠIUKŠLĖS',
        type: 'service1',
        messages: {
            buyMine: '✅ Jūs nusipirkote ŠIUKŠLES! 🗑️',
            buyOthers: '✅ {player} nusipirko ŠIUKŠLES! 🗑️',
            
            visitMine: '🗑️ Atvykai į ŠIUKŠLES – tai tavo nuosavybė.',
            visitOthers: '🗑️ {player} atvyko į ŠIUKŠLES – savo nuosavybę.',
            visitObserver: '🗑️ {player} atvyko į ŠIUKŠLES – savo nuosavybę.',
            
            rentOwner: '🗑️ {player} atvyko į ŠIUKŠLES ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🗑️ Tu atvykai į ŠIUKŠLES ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🗑️ {player} atvyko į ŠIUKŠLES ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    15: {
        name: 'Zarasai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Zarasus! 🏠',
            buyOthers: '✅ {player} nusipirko Zarasus! 🏠',
            
            visitMine: '🏠 Atvykai į Zarasus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Zarasus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Zarasus – savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Zarasus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Zarasus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Zarasus ir sumokėjo {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Jūs pastatėte namą Zarasuose.',
            buildOthers: '🏠 {player} pastatė namą Zarasuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Zarasuose.',
            
            hotelMine: '🏨 Sklypas Zarasai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Zarasai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Zarasai jau pilnai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi pilną žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    16: {
        name: 'KALĖJIMAS',
        type: 'jail',
        messages: {
            visitMine: '🚔 Atvykai į KALĖJIMĄ kaip svečias / lankytojas.',
            visitOthers: '🚔 {player} atvyko į KALĖJIMĄ – svečiuojasi / lankytojas.',
            visitObserver: '🚔 {player} atvyko į KALĖJIMĄ – svečiuojasi / lankytojas.'
        }
    },
    17: {
        name: 'Mažeikiai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Mažeikius! 🏠',
            buyOthers: '✅ {player} nusipirko Mažeikius! 🏠',
            visitMine: '🏠 Atvykai į Mažeikius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Mažeikius – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Mažeikius – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Mažeikius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Mažeikius ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Mažeikius ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Mažeikiuose.',
            buildOthers: '🏠 {player} pastatė namą Mažeikiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Mažeikiuose.',
            hotelMine: '🏨 Sklypas Mažeikiai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Mažeikiai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Mažeikiai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną violetinę gatvę ir jau gali pradėti statybas.'
        }
    },
    18: {
        name: 'Skuodas',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Skuodą! 🏠',
            buyOthers: '✅ {player} nusipirko Skuodą! 🏠',
            visitMine: '🏠 Atvykai į Skuodą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Skuodą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Skuodą – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Skuodą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Skuodą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Skuodą ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Skuode.',
            buildOthers: '🏠 {player} pastatė namą Skuode. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Skuode.',
            hotelMine: '🏨 Sklypas Skuodas pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Skuodas jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Skuodas jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną violetinę gatvę ir jau gali pradėti statybas.'
        }
    },
    19: {
        name: 'GEL. STOTIS',
        type: 'service2',
        messages: {
            buyMine: '✅ Jūs nusipirkote GEL. STOTĮ! 🚂',
            buyOthers: '✅ {player} nusipirko GEL. STOTĮ! 🚂',
            visitMine: '🚂 Atvykai į GEL. STOTĮ – tai tavo nuosavybė.',
            visitOthers: '🚂 {player} atvyko į GEL. STOTĮ – savo nuosavybę.',
            visitObserver: '🚂 {player} atvyko į GEL. STOTĮ – savo nuosavybę.',
            rentOwner: '🚂 {player} atvyko į GEL. STOTĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🚂 Tu atvykai į GEL. STOTĮ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🚂 {player} atvyko į GEL. STOTĮ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    20: {
        name: 'N.Akmenė',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote N.Akmenę! 🏠',
            buyOthers: '✅ {player} nusipirko N.Akmenę! 🏠',
            visitMine: '🏠 Atvykai į N.Akmenę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į N.Akmenę – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į N.Akmenę – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į N.Akmenę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į N.Akmenę ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į N.Akmenę ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą N.Akmenėje.',
            buildOthers: '🏠 {player} pastatė namą N.Akmenėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą N.Akmenėje.',
            hotelMine: '🏨 Sklypas N.Akmenė pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas N.Akmenė jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas N.Akmenė jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną violetinę gatvę ir jau gali pradėti statybas.'
        }
    },
    21: {
        name: 'LATRŲ BARAS',
        type: 'tax',
        messages: {
            visitMine: '🍺 Atvykai į LATRŲ BARĄ ir išleidai €10! 🍺',
            visitOthers: '🍺 {player} atvyko į LATRŲ BARĄ ir išleido €10! 🍺',
            visitObserver: '🍺 {player} atvyko į LATRŲ BARĄ ir išleido €10! 🍺'
        }
    },
    22: {
        name: 'Marijampolė',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Marijampolę! 🏠',
            buyOthers: '✅ {player} nusipirko Marijampolę! 🏠',
            visitMine: '🏠 Atvykai į Marijampolę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Marijampolę – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Marijampolę – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Marijampolę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Marijampolę ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Marijampolę ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Marijampolėje.',
            buildOthers: '🏠 {player} pastatė namą Marijampolėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Marijampolėje.',
            hotelMine: '🏨 Sklypas Marijampolė pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Marijampolė jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Marijampolė jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    23: {
        name: 'Vilkaviškis',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Vilkaviškį! 🏠',
            buyOthers: '✅ {player} nusipirko Vilkaviškį! 🏠',
            visitMine: '🏠 Atvykai į Vilkaviškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Vilkaviškį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Vilkaviškį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Vilkaviškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Vilkaviškį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Vilkaviškį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Vilkaviškyje.',
            buildOthers: '🏠 {player} pastatė namą Vilkaviškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Vilkaviškyje.',
            hotelMine: '🏨 Sklypas Vilkaviškis pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Vilkaviškis jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Vilkaviškis jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    24: {
        name: 'Veterinorius',
        type: 'special',
        messages: {
            visitMine: '🐕 Atvykai pas VETERINORIŲ – nieko neįvyko.',
            visitOthers: '🐕 {player} atvyko pas VETERINORIŲ – nieko neįvyko.',
            visitObserver: '🐕 {player} atvyko pas VETERINORIŲ – nieko neįvyko.'
        }
    },
    25: {
        name: 'Kalvarija',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Kalvariją! 🏠',
            buyOthers: '✅ {player} nusipirko Kalvariją! 🏠',
            visitMine: '🏠 Atvykai į Kalvariją – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kalvariją – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kalvariją – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kalvariją ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kalvariją ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kalvariją ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Kalvarijoje.',
            buildOthers: '🏠 {player} pastatė namą Kalvarijoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kalvarijoje.',
            hotelMine: '🏨 Sklypas Kalvarija pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kalvarija jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kalvarija jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    26: {
        name: 'PARKINGAS',
        type: 'parking',
        messages: {
            visitMine: '🅿️ Atvykai į PARKINGĄ – nieko neįvyko.',
            visitOthers: '🅿️ {player} atvyko į PARKINGĄ – nieko neįvyko.',
            visitObserver: '🅿️ {player} atvyko į PARKINGĄ – nieko neįvyko.'
        }
    },
    27: {
        name: 'Alytus',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Alytų! 🏠',
            buyOthers: '✅ {player} nusipirko Alytų! 🏠',
            visitMine: '🏠 Atvykai į Alytų – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Alytų – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Alytų – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Alytų ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Alytų ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Alytų ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Alytuje.',
            buildOthers: '🏠 {player} pastatė namą Alytuje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Alytuje.',
            hotelMine: '🏨 Sklypas Alytus pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Alytus jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Alytus jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    28: {
        name: 'ELEKTRA',
        type: 'service1',
        messages: {
            buyMine: '✅ Jūs nusipirkote ELEKTRĄ! 💡',
            buyOthers: '✅ {player} nusipirko ELEKTRĄ! 💡',
            visitMine: '💡 Atvykai į ELEKTRĄ – tai tavo nuosavybė.',
            visitOthers: '💡 {player} atvyko į ELEKTRĄ – savo nuosavybę.',
            visitObserver: '💡 {player} atvyko į ELEKTRĄ – savo nuosavybę.',
            rentOwner: '💡 {player} atvyko į ELEKTRĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '💡 Tu atvykai į ELEKTRĄ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '💡 {player} atvyko į ELEKTRĄ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    29: {
        name: 'Lazdijai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Lazdijus! 🏠',
            buyOthers: '✅ {player} nusipirko Lazdijus! 🏠',
            visitMine: '🏠 Atvykai į Lazdijus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Lazdijus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Lazdijus – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Lazdijus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Lazdijus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Lazdijus ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Lazdijuose.',
            buildOthers: '🏠 {player} pastatė namą Lazdijuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Lazdijuose.',
            hotelMine: '🏨 Sklypas Lazdijai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Lazdijai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Lazdijai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    30: {
        name: 'Druskininkai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Druskininkus! 🏠',
            buyOthers: '✅ {player} nusipirko Druskininkus! 🏠',
            visitMine: '🏠 Atvykai į Druskininkus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Druskininkus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Druskininkus – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Druskininkus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Druskininkus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Druskininkus ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Druskininkuose.',
            buildOthers: '🏠 {player} pastatė namą Druskininkuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Druskininkuose.',
            hotelMine: '🏨 Sklypas Druskininkai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Druskininkai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Druskininkai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    31: {
        name: 'Panevėžys',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Panevėžį! 🏠',
            buyOthers: '✅ {player} nusipirko Panevėžį! 🏠',
            visitMine: '🏠 Atvykai į Panevėžį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Panevėžį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Panevėžį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Panevėžį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Panevėžį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Panevėžį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Panevėžyje.',
            buildOthers: '🏠 {player} pastatė namą Panevėžyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Panevėžyje.',
            hotelMine: '🏨 Sklypas Panevėžys pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Panevėžys jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Panevėžys jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    32: {
        name: 'VLADUKO PIRTIS',
        type: 'tax',
        messages: {
            visitMine: '🧖 Atvykai į VLADUKO PIRTĮ ir sumokėjai €25! 🧖',
            visitOthers: '🧖 {player} atvyko į VLADUKO PIRTĮ ir sumokėjo €25! 🧖',
            visitObserver: '🧖 {player} atvyko į VLADUKO PIRTĮ ir sumokėjo €25! 🧖'
        }
    },
    33: {
        name: 'Pasvalys',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Pasvalį! 🏠',
            buyOthers: '✅ {player} nusipirko Pasvalį! 🏠',
            visitMine: '🏠 Atvykai į Pasvalį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Pasvalį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Pasvalį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Pasvalį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Pasvalį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Pasvalį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Pasvalyje.',
            buildOthers: '🏠 {player} pastatė namą Pasvalyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Pasvalyje.',
            hotelMine: '🏨 Sklypas Pasvalys pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Pasvalys jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Pasvalys jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    34: {
        name: 'Kupiškis',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Kupiškį! 🏠',
            buyOthers: '✅ {player} nusipirko Kupiškį! 🏠',
            visitMine: '🏠 Atvykai į Kupiškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kupiškį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kupiškį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kupiškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kupiškį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kupiškį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Kupiškyje.',
            buildOthers: '🏠 {player} pastatė namą Kupiškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kupiškyje.',
            hotelMine: '🏨 Sklypas Kupiškis pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kupiškis jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kupiškis jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    35: {
        name: 'Šiauliai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Šiaulius! 🏠',
            buyOthers: '✅ {player} nusipirko Šiaulius! 🏠',
            visitMine: '🏠 Atvykai į Šiaulius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Šiaulius – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Šiaulius – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Šiaulius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Šiaulius ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Šiaulius ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Šiauliuose.',
            buildOthers: '🏠 {player} pastatė namą Šiauliuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Šiauliuose.',
            hotelMine: '🏨 Sklypas Šiauliai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Šiauliai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Šiauliai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    36: {
        name: 'Kuršėnai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Kuršėnus! 🏠',
            buyOthers: '✅ {player} nusipirko Kuršėnus! 🏠',
            visitMine: '🏠 Atvykai į Kuršėnus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kuršėnus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kuršėnus – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kuršėnus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kuršėnus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kuršėnus ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Kuršėnuose.',
            buildOthers: '🏠 {player} pastatė namą Kuršėnuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kuršėnuose.',
            hotelMine: '🏨 Sklypas Kuršėnai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kuršėnai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kuršėnai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    37: {
        name: 'UOSTAS',
        type: 'service2',
        messages: {
            buyMine: '✅ Jūs nusipirkote UOSTĄ! ⚓',
            buyOthers: '✅ {player} nusipirko UOSTĄ! ⚓',
            visitMine: '⚓ Atvykai į UOSTĄ – tai tavo nuosavybė.',
            visitOthers: '⚓ {player} atvyko į UOSTĄ – savo nuosavybę.',
            visitObserver: '⚓ {player} atvyko į UOSTĄ – savo nuosavybę.',
            rentOwner: '⚓ {player} atvyko į UOSTĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '⚓ Tu atvykai į UOSTĄ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '⚓ {player} atvyko į UOSTĄ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    38: {
        name: 'Radviliškis',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Radviliškį! 🏠',
            buyOthers: '✅ {player} nusipirko Radviliškį! 🏠',
            visitMine: '🏠 Atvykai į Radviliškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Radviliškį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Radviliškį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Radviliškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Radviliškį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Radviliškį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Radviliškyje.',
            buildOthers: '🏠 {player} pastatė namą Radviliškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Radviliškyje.',
            hotelMine: '🏨 Sklypas Radviliškis pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Radviliškis jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Radviliškis jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    39: {
        name: 'Klaipėda',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Klaipėdą! 🏠',
            buyOthers: '✅ {player} nusipirko Klaipėdą! 🏠',
            visitMine: '🏠 Atvykai į Klaipėdą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Klaipėdą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Klaipėdą – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Klaipėdą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Klaipėdą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Klaipėdą ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Klaipėdoje.',
            buildOthers: '🏠 {player} pastatė namą Klaipėdoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Klaipėdoje.',
            hotelMine: '🏨 Sklypas Klaipėda pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Klaipėda jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Klaipėda jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    40: {
        name: 'Palanga',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Palangą! 🏠',
            buyOthers: '✅ {player} nusipirko Palangą! 🏠',
            visitMine: '🏠 Atvykai į Palangą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Palangą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Palangą – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Palangą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Palangą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Palangą ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Palangoje.',
            buildOthers: '🏠 {player} pastatė namą Palangoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Palangoje.',
            hotelMine: '🏨 Sklypas Palanga pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Palanga jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Palanga jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    41: {
        name: 'Gargždai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Gargždus! 🏠',
            buyOthers: '✅ {player} nusipirko Gargždus! 🏠',
            visitMine: '🏠 Atvykai į Gargždus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Gargždus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Gargždus – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Gargždus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Gargždus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Gargždus ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Gargžduose.',
            buildOthers: '🏠 {player} pastatė namą Gargžduose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Gargžduose.',
            hotelMine: '🏨 Sklypas Gargždai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Gargždai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Gargždai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    42: {
        name: 'KELIAUK Į KALĖJIMĄ',
        type: 'go-to-jail',
        messages: {
            visitMine: '🚨 Atvykai į KELIAUK Į KALĖJIMĄ – keliauji į kalėjimą!',
            visitOthers: '🚨 {player} atvyko į KELIAUK Į KALĖJIMĄ – keliauja į kalėjimą!',
            visitObserver: '🚨 {player} atvyko į KELIAUK Į KALĖJIMĄ – keliauja į kalėjimą!'
        }
    },
    43: {
        name: 'Kaunas',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Kauną! 🏠',
            buyOthers: '✅ {player} nusipirko Kauną! 🏠',
            visitMine: '🏠 Atvykai į Kauną – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kauną – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kauną – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kauną ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kauną ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kauną ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Kaune.',
            buildOthers: '🏠 {player} pastatė namą Kaune. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kaune.',
            hotelMine: '🏨 Sklypas Kaunas pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kaunas jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kaunas jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    44: {
        name: 'VANDUO',
        type: 'service1',
        messages: {
            buyMine: '✅ Jūs nusipirkote VANDENĮ! 💧',
            buyOthers: '✅ {player} nusipirko VANDENĮ! 💧',
            visitMine: '💧 Atvykai į VANDENĮ – tai tavo nuosavybė.',
            visitOthers: '💧 {player} atvyko į VANDENĮ – savo nuosavybę.',
            visitObserver: '💧 {player} atvyko į VANDENĮ – savo nuosavybę.',
            rentOwner: '💧 {player} atvyko į VANDENĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '💧 Tu atvykai į VANDENĮ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '💧 {player} atvyko į VANDENĮ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    45: {
        name: 'Garliava',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Garliavą! 🏠',
            buyOthers: '✅ {player} nusipirko Garliavą! 🏠',
            visitMine: '🏠 Atvykai į Garliavą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Garliavą – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Garliavą – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Garliavą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Garliavą ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Garliavą ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Garliavoje.',
            buildOthers: '🏠 {player} pastatė namą Garliavoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Garliavoje.',
            hotelMine: '🏨 Sklypas Garliava pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Garliava jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Garliava jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    46: {
        name: 'AUTOBUSŲ STOTIS',
        type: 'service2',
        messages: {
            buyMine: '✅ Jūs nusipirkote AUTOBUSŲ STOTĮ! 🚌',
            buyOthers: '✅ {player} nusipirko AUTOBUSŲ STOTĮ! 🚌',
            visitMine: '🚌 Atvykai į AUTOBUSŲ STOTĮ – tai tavo nuosavybė.',
            visitOthers: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ – savo nuosavybę.',
            visitObserver: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ – savo nuosavybę.',
            rentOwner: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🚌 Tu atvykai į AUTOBUSŲ STOTĮ ir sumokėjai {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ ir sumokėjo {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    47: {
        name: 'Raudondvaris',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Raudondvarį! 🏠',
            buyOthers: '✅ {player} nusipirko Raudondvarį! 🏠',
            visitMine: '🏠 Atvykai į Raudondvarį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Raudondvarį – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Raudondvarį – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Raudondvarį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Raudondvarį ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Raudondvarį ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Raudondvaryje.',
            buildOthers: '🏠 {player} pastatė namą Raudondvaryje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Raudondvaryje.',
            hotelMine: '🏨 Sklypas Raudondvaris pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Raudondvaris jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Raudondvaris jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną tamsiai žalią gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną tamsiai žalią gatvę ir jau gali pradėti statybas.'
        }
    },
    48: {
        name: 'Akropolis',
        type: 'special',
        messages: {
            visitMine: '🛒 Atvykai į AKROPOLĮ – nieko neįvyko.',
            visitOthers: '🛒 {player} atvyko į AKROPOLĮ – nieko neįvyko.',
            visitObserver: '🛒 {player} atvyko į AKROPOLĮ – nieko neįvyko.'
        }
    },
    49: {
        name: 'Trakai',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Trakus! 🏠',
            buyOthers: '✅ {player} nusipirko Trakus! 🏠',
            visitMine: '🏠 Atvykai į Trakus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Trakus – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Trakus – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Trakus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Trakus ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Trakus ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Trakuose.',
            buildOthers: '🏠 {player} pastatė namą Trakuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Trakuose.',
            hotelMine: '🏨 Sklypas Trakai pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Trakai jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Trakai jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną pilką gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną pilką gatvę ir jau gali pradėti statybas.'
        }
    },
    50: {
        name: 'TAVO GIMTADIENIS',
        type: 'special',
        messages: {
            visitMine: '🎂 Atvykai į TAVO GIMTADIENĮ ir gavai €200! 🎉',
            visitOthers: '🎂 {player} atvyko į TAVO GIMTADIENĮ ir gavo €200! 🎉',
            visitObserver: '🎂 {player} atvyko į TAVO GIMTADIENĮ ir gavo €200! 🎉'
        }
    },
    51: {
        name: 'Vilnius',
        type: 'property',
        messages: {
            buyMine: '✅ Jūs nusipirkote Vilnių! 🏠',
            buyOthers: '✅ {player} nusipirko Vilnių! 🏠',
            visitMine: '🏠 Atvykai į Vilnių – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Vilnių – savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Vilnių – savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Vilnių ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Vilnių ir sumokėjai {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Vilnių ir sumokėjo {owner} €{rent} nuomos.',
            buildMine: '🏠 Jūs pastatėte namą Vilniuje.',
            buildOthers: '🏠 {player} pastatė namą Vilniuje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Vilniuje.',
            hotelMine: '🏨 Sklypas Vilnius pilnai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Vilnius jau pilnai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Vilnius jau pilnai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi pilną pilką gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo pilną pilką gatvę ir jau gali pradėti statybas.'
        }
    }
};