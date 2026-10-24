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
            buyMine: '✅ Nusipirkai Telšius! 🏠',
            buyOthers: '✅ {player} nusipirko Telšius! 🏠',
            
            visitMine: '🏠 Atvykai į Telšius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Telšius – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Telšius – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Telšius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Telšius ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Telšius ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Telšiuose.',
            buildOthers: '🏠 {player} pastatė namą Telšiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Telšiuose.',
            
            hotelMine: '🏨 Sklypas Telšiai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Telšiai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Telšiai jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą geltoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą geltoną gatvę ir jau gali pradėti statybas.'
        }
    },
    2: {
        name: 'DUJOS',
        type: 'service1',
        messages: {
            buyMine: '✅ Nusipirkai DUJAS! ⚡',
            buyOthers: '✅ {player} nusipirko DUJAS! ⚡',
            
            visitMine: '⚡ Atvykai į DUJAS – tai tavo nuosavybė.',
            visitOthers: '⚡ {player} atvyko į DUJAS – į savo nuosavybę.',
            visitObserver: '⚡ {player} atvyko į DUJAS – į savo nuosavybę.',
            
            rentOwner: '⚡ {player} atvyko į DUJAS ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '⚡ Tu atvykai į DUJAS ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '⚡ {player} atvyko į DUJAS ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    3: {
        name: 'Plungė',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Plungę! 🏠',
            buyOthers: '✅ {player} nusipirko Plungę! 🏠',
            
            visitMine: '🏠 Atvykai į Plungę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Plungę – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Plungę – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Plungę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Plungę ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Plungę ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Plungėje.',
            buildOthers: '🏠 {player} pastatė namą Plungėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Plungėje.',
            
            hotelMine: '🏨 Sklypas Plungė visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Plungė jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Plungė jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą geltoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą geltoną gatvę ir jau gali pradėti statybas.'
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
            visitMine: '💸 Atvykai į VMI ir sumokėjai €100 mokesčių! 💰',
            visitOthers: '💸 {player} atvyko į VMI ir sumokėjo €100 mokesčių! 💰',
            visitObserver: '💸 {player} atvyko į VMI ir sumokėjo €100 mokesčių! 💰'
        }
    },
    6: {
        name: 'Kėdainiai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Kėdainius! 🏠',
            buyOthers: '✅ {player} nusipirko Kėdainius! 🏠',
            
            visitMine: '🏠 Atvykai į Kėdainius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kėdainius – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kėdainius – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Kėdainius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kėdainius ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kėdainius ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Kėdainiuose.',
            buildOthers: '🏠 {player} pastatė namą Kėdainiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kėdainiuose.',
            
            hotelMine: '🏨 Sklypas Kėdainiai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kėdainiai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kėdainiai jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    7: {
        name: 'Ariogala',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Ariogalą! 🏠',
            buyOthers: '✅ {player} nusipirko Ariogalą! 🏠',
            
            visitMine: '🏠 Atvykai į Ariogalą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Ariogalą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Ariogalą – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Ariogalą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Ariogalą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Ariogalą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Ariogaloje.',
            buildOthers: '🏠 {player} pastatė namą Ariogaloje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Ariogaloje.',
            
            hotelMine: '🏨 Sklypas Ariogala visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Ariogala jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Ariogala jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    8: {
        name: 'ORO UOSTAS',
        type: 'service2',
        messages: {
            buyMine: '✅ Nusipirkai ORO UOSTĄ! ✈️',
            buyOthers: '✅ {player} nusipirko ORO UOSTĄ! ✈️',
            
            visitMine: '✈️ Atvykai į ORO UOSTĄ – tai tavo nuosavybė.',
            visitOthers: '✈️ {player} atvyko į ORO UOSTĄ – į savo nuosavybę.',
            visitObserver: '✈️ {player} atvyko į ORO UOSTĄ – į savo nuosavybę.',
            
            rentOwner: '✈️ {player} atvyko į ORO UOSTĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '✈️ Tu atvykai į ORO UOSTĄ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '✈️ {player} atvyko į ORO UOSTĄ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    9: {
        name: 'Ramygala',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Ramygalą! 🏠',
            buyOthers: '✅ {player} nusipirko Ramygalą! 🏠',
            
            visitMine: '🏠 Atvykai į Ramygalą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Ramygalą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Ramygalą – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Ramygalą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Ramygalą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Ramygalą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Ramygaloje.',
            buildOthers: '🏠 {player} pastatė namą Ramygaloje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Ramygaloje.',
            
            hotelMine: '🏨 Sklypas Ramygala visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Ramygala jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Ramygala jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    10: {
        name: 'Utena',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Uteną! 🏠',
            buyOthers: '✅ {player} nusipirko Uteną! 🏠',
            
            visitMine: '🏠 Atvykai į Uteną – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Uteną – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Uteną – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Uteną ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Uteną ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Uteną ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Utenoje.',
            buildOthers: '🏠 {player} pastatė namą Utenoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Utenoje.',
            
            hotelMine: '🏨 Sklypas Utena visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Utena jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Utena jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą oranžinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą oranžinę gatvę ir jau gali pradėti statybas.'
        }
    },
    // 🆕 11 CIRKAS – service3
    11: {
        name: 'SPA',
        type: 'service3',
        messages: {
            buyMine: '✅ Nusipirkai SPA saloną! 🛀',
            buyOthers: '✅ {player} nusipirko SPA saloną! 🛀',
            
            visitMine: '🛀 Atvykai į SPA – tai tavo nuosavybė.',
            visitOthers: '🛀 {player} atvyko į SPA – į savo nuosavybę.',
            visitObserver: '🛀 {player} atvyko į SPA – į savo nuosavybę.',
            
            rentOwner: '🛀 {player} atvyko į SPA saloną ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🛀 Tu atvykai į SPA saloną ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🛀 {player} atvyko į SPA saloną ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    12: {
        name: 'Anykščiai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Anykščius! 🏠',
            buyOthers: '✅ {player} nusipirko Anykščius! 🏠',
            
            visitMine: '🏠 Atvykai į Anykščius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Anykščius – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Anykščius – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Anykščius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Anykščius ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Anykščius ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Anykščiuose.',
            buildOthers: '🏠 {player} pastatė namą Anykščiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Anykščiuose.',
            
            hotelMine: '🏨 Sklypas Anykščiai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Anykščiai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Anykščiai jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą oranžinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą oranžinę gatvę ir jau gali pradėti statybas.'
        }
    },
    13: {
        name: 'LIGONINĖ',
        type: 'special',
        messages: {
            visitMine: '🏥 Atvykai į LIGONINĘ ir sumokėjai €50 daktarui Bubauskui! 👨‍⚕️',
            visitOthers: '🏥 {player} atvyko į LIGONINĘ ir sumokėjo €50 daktarui Bubauskui! 👨‍⚕️',
            visitObserver: '🏥 {player} atvyko į LIGONINĘ ir sumokėjo €50 daktarui Bubauskui! 👨‍⚕️'
        }
    },
    14: {
        name: 'ŠIUKŠLĖS',
        type: 'service1',
        messages: {
            buyMine: '✅ Nusipirkai ŠIUKŠLES! 🗑️',
            buyOthers: '✅ {player} nusipirko ŠIUKŠLES! 🗑️',
            
            visitMine: '🗑️ Atvykai į ŠIUKŠLES – tai tavo nuosavybė.',
            visitOthers: '🗑️ {player} atvyko į ŠIUKŠLES – į savo nuosavybę.',
            visitObserver: '🗑️ {player} atvyko į ŠIUKŠLES – į savo nuosavybę.',
            
            rentOwner: '🗑️ {player} atvyko į ŠIUKŠLES ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🗑️ Tu atvykai į ŠIUKŠLES ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🗑️ {player} atvyko į ŠIUKŠLES ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    15: {
        name: 'Zarasai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Zarasus! 🏠',
            buyOthers: '✅ {player} nusipirko Zarasus! 🏠',
            
            visitMine: '🏠 Atvykai į Zarasus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Zarasus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Zarasus – į savo nuosavybę.',
            
            rentOwner: '💰 {player} atvyko į Zarasus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Zarasus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Zarasus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            
            buildMine: '🏠 Pastatei namą Zarasuose.',
            buildOthers: '🏠 {player} pastatė namą Zarasuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Zarasuose.',
            
            hotelMine: '🏨 Sklypas Zarasai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Zarasai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Zarasai jau visiškai užstatytas – stovi viešbutis.',
            
            fullGroupMine: '🏘️ Turi visą oranžinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą oranžinę gatvę ir jau gali pradėti statybas.'
        }
    },
    16: {
        name: 'KALĖJIMAS',
        type: 'jail',
        messages: {
            visitMine: '🚔 Užsukai į KALĖJIMĄ kaip lankytojas.',
            visitOthers: '🚔 {player} užsuko į KALĖJIMĄ kaip lankytojas.',
            visitObserver: '🚔 {player} užsuko į KALĖJIMĄ kaip lankytojas.'
        }
    },
    17: {
        name: 'Mažeikiai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Mažeikius! 🏠',
            buyOthers: '✅ {player} nusipirko Mažeikius! 🏠',
            visitMine: '🏠 Atvykai į Mažeikius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Mažeikius – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Mažeikius – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Mažeikius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Mažeikius ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Mažeikius ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Mažeikiuose.',
            buildOthers: '🏠 {player} pastatė namą Mažeikiuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Mažeikiuose.',
            hotelMine: '🏨 Sklypas Mažeikiai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Mažeikiai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Mažeikiai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą violetinę gatvę ir jau gali pradėti statybas.'
        }
    },
    18: {
        name: 'Skuodas',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Skuodą! 🏠',
            buyOthers: '✅ {player} nusipirko Skuodą! 🏠',
            visitMine: '🏠 Atvykai į Skuodą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Skuodą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Skuodą – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Skuodą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Skuodą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Skuodą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Skuode.',
            buildOthers: '🏠 {player} pastatė namą Skuode. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Skuode.',
            hotelMine: '🏨 Sklypas Skuodas visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Skuodas jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Skuodas jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą violetinę gatvę ir jau gali pradėti statybas.'
        }
    },
    19: {
        name: 'GEL. STOTIS',
        type: 'service2',
        messages: {
            buyMine: '✅ Nusipirkai GEL. STOTĮ! 🚂',
            buyOthers: '✅ {player} nusipirko GEL. STOTĮ! 🚂',
            visitMine: '🚂 Atvykai į GEL. STOTĮ – tai tavo nuosavybė.',
            visitOthers: '🚂 {player} atvyko į GEL. STOTĮ – į savo nuosavybę.',
            visitObserver: '🚂 {player} atvyko į GEL. STOTĮ – į savo nuosavybę.',
            rentOwner: '🚂 {player} atvyko į GEL. STOTĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🚂 Tu atvykai į GEL. STOTĮ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🚂 {player} atvyko į GEL. STOTĮ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    20: {
        name: 'N.Akmenė',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai N.Akmenę! 🏠',
            buyOthers: '✅ {player} nusipirko N.Akmenę! 🏠',
            visitMine: '🏠 Atvykai į N.Akmenę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į N.Akmenę – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į N.Akmenę – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į N.Akmenę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į N.Akmenę ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į N.Akmenę ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą N.Akmenėje.',
            buildOthers: '🏠 {player} pastatė namą N.Akmenėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą N.Akmenėje.',
            hotelMine: '🏨 Sklypas N.Akmenė visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas N.Akmenė jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas N.Akmenė jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą violetinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą violetinę gatvę ir jau gali pradėti statybas.'
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
            buyMine: '✅ Nusipirkai Marijampolę! 🏠',
            buyOthers: '✅ {player} nusipirko Marijampolę! 🏠',
            visitMine: '🏠 Atvykai į Marijampolę – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Marijampolę – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Marijampolę – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Marijampolę ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Marijampolę ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Marijampolę ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Marijampolėje.',
            buildOthers: '🏠 {player} pastatė namą Marijampolėje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Marijampolėje.',
            hotelMine: '🏨 Sklypas Marijampolė visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Marijampolė jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Marijampolė jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    23: {
        name: 'Vilkaviškis',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Vilkaviškį! 🏠',
            buyOthers: '✅ {player} nusipirko Vilkaviškį! 🏠',
            visitMine: '🏠 Atvykai į Vilkaviškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Vilkaviškį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Vilkaviškį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Vilkaviškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Vilkaviškį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Vilkaviškį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Vilkaviškyje.',
            buildOthers: '🏠 {player} pastatė namą Vilkaviškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Vilkaviškyje.',
            hotelMine: '🏨 Sklypas Vilkaviškis visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Vilkaviškis jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Vilkaviškis jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    // 🆕 24 VETERINORIUS – service3
    24: {
        name: 'Baseinas',
        type: 'service3',
        messages: {
            buyMine: '✅ Nusipirkai BASEINĄ! 🏊',
            buyOthers: '✅ {player} nusipirko BASEINĄ! 🏊',
            
            visitMine: '🏊 Atvykai į baseiną – tai tavo nuosavybė.',
            visitOthers: '🏊 {player} atvyko į baseiną – į savo nuosavybę.',
            visitObserver: '🏊 {player} atvyko į baseiną – į savo nuosavybę.',
            
            rentOwner: '🏊 {player} atvyko į baseiną ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🏊 Tu atvykai į baseiną ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🏊 {player} atvyko į baseiną ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    25: {
        name: 'Kalvarija',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Kalvariją! 🏠',
            buyOthers: '✅ {player} nusipirko Kalvariją! 🏠',
            visitMine: '🏠 Atvykai į Kalvariją – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kalvariją – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kalvariją – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kalvariją ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kalvariją ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kalvariją ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Kalvarijoje.',
            buildOthers: '🏠 {player} pastatė namą Kalvarijoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kalvarijoje.',
            hotelMine: '🏨 Sklypas Kalvarija visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kalvarija jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kalvarija jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą raudoną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą raudoną gatvę ir jau gali pradėti statybas.'
        }
    },
    26: {
        name: 'TAKSI',
        type: 'taxi',
        messages: {
            visitMine: '🚕 Atvažiavai į TAKSI stotelę.',
            visitOthers: '🚕 {player} atvyko į TAKSI stotelę.',
            visitObserver: '🚕 {player} atvyko į TAKSI stotelę.'
        }
    },
    27: {
        name: 'Alytus',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Alytų! 🏠',
            buyOthers: '✅ {player} nusipirko Alytų! 🏠',
            visitMine: '🏠 Atvykai į Alytų – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Alytų – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Alytų – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Alytų ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Alytų ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Alytų ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Alytuje.',
            buildOthers: '🏠 {player} pastatė namą Alytuje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Alytuje.',
            hotelMine: '🏨 Sklypas Alytus visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Alytus jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Alytus jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    28: {
        name: 'ELEKTRA',
        type: 'service1',
        messages: {
            buyMine: '✅ Nusipirkai ELEKTRĄ! 💡',
            buyOthers: '✅ {player} nusipirko ELEKTRĄ! 💡',
            visitMine: '💡 Atvykai į ELEKTRĄ – tai tavo nuosavybė.',
            visitOthers: '💡 {player} atvyko į ELEKTRĄ – į savo nuosavybę.',
            visitObserver: '💡 {player} atvyko į ELEKTRĄ – į savo nuosavybę.',
            rentOwner: '💡 {player} atvyko į ELEKTRĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '💡 Tu atvykai į ELEKTRĄ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '💡 {player} atvyko į ELEKTRĄ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    29: {
        name: 'Lazdijai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Lazdijus! 🏠',
            buyOthers: '✅ {player} nusipirko Lazdijus! 🏠',
            visitMine: '🏠 Atvykai į Lazdijus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Lazdijus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Lazdijus – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Lazdijus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Lazdijus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Lazdijus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Lazdijuose.',
            buildOthers: '🏠 {player} pastatė namą Lazdijuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Lazdijuose.',
            hotelMine: '🏨 Sklypas Lazdijai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Lazdijai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Lazdijai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    30: {
        name: 'Druskininkai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Druskininkus! 🏠',
            buyOthers: '✅ {player} nusipirko Druskininkus! 🏠',
            visitMine: '🏠 Atvykai į Druskininkus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Druskininkus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Druskininkus – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Druskininkus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Druskininkus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Druskininkus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Druskininkuose.',
            buildOthers: '🏠 {player} pastatė namą Druskininkuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Druskininkuose.',
            hotelMine: '🏨 Sklypas Druskininkai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Druskininkai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Druskininkai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rudą gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rudą gatvę ir jau gali pradėti statybas.'
        }
    },
    31: {
        name: 'Panevėžys',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Panevėžį! 🏠',
            buyOthers: '✅ {player} nusipirko Panevėžį! 🏠',
            visitMine: '🏠 Atvykai į Panevėžį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Panevėžį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Panevėžį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Panevėžį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Panevėžį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Panevėžį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Panevėžyje.',
            buildOthers: '🏠 {player} pastatė namą Panevėžyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Panevėžyje.',
            hotelMine: '🏨 Sklypas Panevėžys visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Panevėžys jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Panevėžys jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    // 🆕 32 SAUNA – service3 (anksčiau buvo VLADUKO PIRTIS tax)
    32: {
        name: 'SAUNA',
        type: 'service3',
        messages: {
            buyMine: '✅ Nusipirkai SAUNĄ! 🧖',
            buyOthers: '✅ {player} nusipirko SAUNĄ! 🧖',
            
            visitMine: '🧖 Atvykai į SAUNĄ – tai tavo nuosavybė.',
            visitOthers: '🧖 {player} atvyko į SAUNĄ – į savo nuosavybę.',
            visitObserver: '🧖 {player} atvyko į SAUNĄ – į savo nuosavybę.',
            
            rentOwner: '🧖 {player} atvyko į SAUNĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🧖 Tu atvykai į SAUNĄ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🧖 {player} atvyko į SAUNĄ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    33: {
        name: 'Pasvalys',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Pasvalį! 🏠',
            buyOthers: '✅ {player} nusipirko Pasvalį! 🏠',
            visitMine: '🏠 Atvykai į Pasvalį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Pasvalį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Pasvalį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Pasvalį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Pasvalį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Pasvalį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Pasvalyje.',
            buildOthers: '🏠 {player} pastatė namą Pasvalyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Pasvalyje.',
            hotelMine: '🏨 Sklypas Pasvalys visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Pasvalys jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Pasvalys jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    34: {
        name: 'Kupiškis',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Kupiškį! 🏠',
            buyOthers: '✅ {player} nusipirko Kupiškį! 🏠',
            visitMine: '🏠 Atvykai į Kupiškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kupiškį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kupiškį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kupiškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kupiškį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kupiškį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Kupiškyje.',
            buildOthers: '🏠 {player} pastatė namą Kupiškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kupiškyje.',
            hotelMine: '🏨 Sklypas Kupiškis visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kupiškis jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kupiškis jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą turkio gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą turkio gatvę ir jau gali pradėti statybas.'
        }
    },
    35: {
        name: 'Šiauliai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Šiaulius! 🏠',
            buyOthers: '✅ {player} nusipirko Šiaulius! 🏠',
            visitMine: '🏠 Atvykai į Šiaulius – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Šiaulius – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Šiaulius – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Šiaulius ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Šiaulius ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Šiaulius ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Šiauliuose.',
            buildOthers: '🏠 {player} pastatė namą Šiauliuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Šiauliuose.',
            hotelMine: '🏨 Sklypas Šiauliai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Šiauliai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Šiauliai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    36: {
        name: 'Kuršėnai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Kuršėnus! 🏠',
            buyOthers: '✅ {player} nusipirko Kuršėnus! 🏠',
            visitMine: '🏠 Atvykai į Kuršėnus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kuršėnus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kuršėnus – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kuršėnus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kuršėnus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kuršėnus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Kuršėnuose.',
            buildOthers: '🏠 {player} pastatė namą Kuršėnuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kuršėnuose.',
            hotelMine: '🏨 Sklypas Kuršėnai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kuršėnai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kuršėnai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    37: {
        name: 'UOSTAS',
        type: 'service2',
        messages: {
            buyMine: '✅ Nusipirkai UOSTĄ! ⚓',
            buyOthers: '✅ {player} nusipirko UOSTĄ! ⚓',
            visitMine: '⚓ Atvykai į UOSTĄ – tai tavo nuosavybė.',
            visitOthers: '⚓ {player} atvyko į UOSTĄ – į savo nuosavybę.',
            visitObserver: '⚓ {player} atvyko į UOSTĄ – į savo nuosavybę.',
            rentOwner: '⚓ {player} atvyko į UOSTĄ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '⚓ Tu atvykai į UOSTĄ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '⚓ {player} atvyko į UOSTĄ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    38: {
        name: 'Radviliškis',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Radviliškį! 🏠',
            buyOthers: '✅ {player} nusipirko Radviliškį! 🏠',
            visitMine: '🏠 Atvykai į Radviliškį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Radviliškį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Radviliškį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Radviliškį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Radviliškį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Radviliškį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Radviliškyje.',
            buildOthers: '🏠 {player} pastatė namą Radviliškyje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Radviliškyje.',
            hotelMine: '🏨 Sklypas Radviliškis visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Radviliškis jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Radviliškis jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą rožinę gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą rožinę gatvę ir jau gali pradėti statybas.'
        }
    },
    39: {
        name: 'Klaipėda',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Klaipėdą! 🏠',
            buyOthers: '✅ {player} nusipirko Klaipėdą! 🏠',
            visitMine: '🏠 Atvykai į Klaipėdą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Klaipėdą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Klaipėdą – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Klaipėdą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Klaipėdą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Klaipėdą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Klaipėdoje.',
            buildOthers: '🏠 {player} pastatė namą Klaipėdoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Klaipėdoje.',
            hotelMine: '🏨 Sklypas Klaipėda visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Klaipėda jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Klaipėda jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą grafito spalvos gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą grafito spalvos gatvę ir jau gali pradėti statybas.'
        }
    },
    40: {
        name: 'Palanga',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Palangą! 🏠',
            buyOthers: '✅ {player} nusipirko Palangą! 🏠',
            visitMine: '🏠 Atvykai į Palangą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Palangą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Palangą – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Palangą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Palangą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Palangą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Palangoje.',
            buildOthers: '🏠 {player} pastatė namą Palangoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Palangoje.',
            hotelMine: '🏨 Sklypas Palanga visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Palanga jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Palanga jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą grafito spalvos gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą grafito spalvos gatvę ir jau gali pradėti statybas.'
        }
    },
    41: {
        name: 'Gargždai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Gargždus! 🏠',
            buyOthers: '✅ {player} nusipirko Gargždus! 🏠',
            visitMine: '🏠 Atvykai į Gargždus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Gargždus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Gargždus – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Gargždus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Gargždus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Gargždus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Gargžduose.',
            buildOthers: '🏠 {player} pastatė namą Gargžduose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Gargžduose.',
            hotelMine: '🏨 Sklypas Gargždai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Gargždai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Gargždai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą grafito spalvos gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą grafito spalvos gatvę ir jau gali pradėti statybas.'
        }
    },
    42: {
        name: 'KELIAUK Į KALĖJIMĄ',
        type: 'go-to-jail',
        messages: {
            visitMine: '🚨 Atsistojai ant „KELIAUK Į KALĖJIMĄ“ – keliauji į kalėjimą!',
            visitOthers: '🚨 {player} atsistojo ant „KELIAUK Į KALĖJIMĄ“ – keliauja į kalėjimą!',
            visitObserver: '🚨 {player} atsistojo ant „KELIAUK Į KALĖJIMĄ“ – keliauja į kalėjimą!'
        }
    },
    43: {
        name: 'Kaunas',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Kauną! 🏠',
            buyOthers: '✅ {player} nusipirko Kauną! 🏠',
            visitMine: '🏠 Atvykai į Kauną – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Kauną – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Kauną – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Kauną ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Kauną ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Kauną ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Kaune.',
            buildOthers: '🏠 {player} pastatė namą Kaune. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Kaune.',
            hotelMine: '🏨 Sklypas Kaunas visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Kaunas jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Kaunas jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    44: {
        name: 'VANDUO',
        type: 'service1',
        messages: {
            buyMine: '✅ Nusipirkai VANDENĮ! 💧',
            buyOthers: '✅ {player} nusipirko VANDENĮ! 💧',
            visitMine: '💧 Atvykai į VANDENĮ – tai tavo nuosavybė.',
            visitOthers: '💧 {player} atvyko į VANDENĮ – į savo nuosavybę.',
            visitObserver: '💧 {player} atvyko į VANDENĮ – į savo nuosavybę.',
            rentOwner: '💧 {player} atvyko į VANDENĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '💧 Tu atvykai į VANDENĮ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '💧 {player} atvyko į VANDENĮ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    45: {
        name: 'Garliava',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Garliavą! 🏠',
            buyOthers: '✅ {player} nusipirko Garliavą! 🏠',
            visitMine: '🏠 Atvykai į Garliavą – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Garliavą – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Garliavą – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Garliavą ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Garliavą ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Garliavą ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Garliavoje.',
            buildOthers: '🏠 {player} pastatė namą Garliavoje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Garliavoje.',
            hotelMine: '🏨 Sklypas Garliava visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Garliava jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Garliava jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    46: {
        name: 'AUTOBUSŲ STOTIS',
        type: 'service2',
        messages: {
            buyMine: '✅ Nusipirkai AUTOBUSŲ STOTĮ! 🚌',
            buyOthers: '✅ {player} nusipirko AUTOBUSŲ STOTĮ! 🚌',
            visitMine: '🚌 Atvykai į AUTOBUSŲ STOTĮ – tai tavo nuosavybė.',
            visitOthers: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ – į savo nuosavybę.',
            visitObserver: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ – į savo nuosavybę.',
            rentOwner: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🚌 Tu atvykai į AUTOBUSŲ STOTĮ ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🚌 {player} atvyko į AUTOBUSŲ STOTĮ ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    47: {
        name: 'Raudondvaris',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Raudondvarį! 🏠',
            buyOthers: '✅ {player} nusipirko Raudondvarį! 🏠',
            visitMine: '🏠 Atvykai į Raudondvarį – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Raudondvarį – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Raudondvarį – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Raudondvarį ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Raudondvarį ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Raudondvarį ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Raudondvaryje.',
            buildOthers: '🏠 {player} pastatė namą Raudondvaryje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Raudondvaryje.',
            hotelMine: '🏨 Sklypas Raudondvaris visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Raudondvaris jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Raudondvaris jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą tamsiai mėlyną gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą tamsiai mėlyną gatvę ir jau gali pradėti statybas.'
        }
    },
    // 🆕 48 AKROPOLIS – service3
    48: {
        name: 'Paplūdimys',
        type: 'service3',
        messages: {
            buyMine: '✅ Nusipirkai paplūdimio dalį! 🏖️',
            buyOthers: '✅ {player} nusipirko paplūdimio dalį! 🏖️',
            
            visitMine: '🏖️ Atvykai į paplūdimį – tai tavo nuosavybė.',
            visitOthers: '🏖️ {player} atvyko į paplūdimį – į savo nuosavybę.',
            visitObserver: '🏖️ {player} atvyko į paplūdimį – į savo nuosavybę.',
            
            rentOwner: '🏖️ {player} atvyko į palūdimį ir sumokėjo tau €{rent} ({count} objekt{countSuffix} grupėje).',
            rentPayer: '🏖️ Tu atvykai į paplūdimį ir sumokėjai žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).',
            rentObserver: '🏖️ {player} atvyko į paplūdimį ir sumokėjo žaidėjui {owner} €{rent} ({owner} turi {count} objekt{countSuffix} grupėje).'
        }
    },
    49: {
        name: 'Trakai',
        type: 'property',
        messages: {
            buyMine: '✅ Nusipirkai Trakus! 🏠',
            buyOthers: '✅ {player} nusipirko Trakus! 🏠',
            visitMine: '🏠 Atvykai į Trakus – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Trakus – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Trakus – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Trakus ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Trakus ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Trakus ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Trakuose.',
            buildOthers: '🏠 {player} pastatė namą Trakuose. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Trakuose.',
            hotelMine: '🏨 Sklypas Trakai visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Trakai jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Trakai jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą pilką gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą pilką gatvę ir jau gali pradėti statybas.'
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
            buyMine: '✅ Nusipirkai Vilnių! 🏠',
            buyOthers: '✅ {player} nusipirko Vilnių! 🏠',
            visitMine: '🏠 Atvykai į Vilnių – tai tavo sklypas. Nuomos mokėti nereikia.',
            visitOthers: '🏠 {player} atvyko į Vilnių – į savo nuosavybę.',
            visitObserver: '🏠 {player} atvyko į Vilnių – į savo nuosavybę.',
            rentOwner: '💰 {player} atvyko į Vilnių ir sumokėjo tau €{rent} nuomos.',
            rentPayer: '💰 Tu atvykai į Vilnių ir sumokėjai žaidėjui {owner} €{rent} nuomos.',
            rentObserver: '💰 {player} atvyko į Vilnių ir sumokėjo žaidėjui {owner} €{rent} nuomos.',
            buildMine: '🏠 Pastatei namą Vilniuje.',
            buildOthers: '🏠 {player} pastatė namą Vilniuje. Nuoma brangesnė.',
            buildObserver: '🏠 {player} pastatė namą Vilniuje.',
            hotelMine: '🏨 Sklypas Vilnius visiškai užstatytas – stovi viešbutis.',
            hotelOthers: '🏨 Sklypas Vilnius jau visiškai užstatytas – stovi viešbutis.',
            hotelObserver: '🏨 Sklypas Vilnius jau visiškai užstatytas – stovi viešbutis.',
            fullGroupMine: '🏘️ Turi visą pilką gatvę! Jau gali pradėti statybas.',
            fullGroupOthers: '🏘️ {player} įsigijo visą pilką gatvę ir jau gali pradėti statybas.'
        }
    }
};