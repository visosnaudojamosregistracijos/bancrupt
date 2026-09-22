// ============================================
// server/demolishLogic.js
// ============================================

const C = require('./gameConstants');

class DemolishLogic {
    constructor(game) {
        this.game = game;
    }

    // 🆕 Gauti žaidėją pagal ID
    getPlayer(playerId) {
        return this.game.players.find(p => p.id === playerId);
    }

    // 🆕 Gauti sklypą pagal ID
    getField(fieldId) {
        if (fieldId === undefined || fieldId === null) return null;
        return this.game.board.find(f => f.id === fieldId) || null;
    }

    // 🆕 Gauti grupę pagal spalvą
    getGroupByColor(color) {
        if (!color) return [];
        return C.COLOR_GROUPS[color] || [];
    }

    // ============================================
    // GAUTI SKLYPUS SU NAMAIS – TIK TUOS, KURIUOS GALIMA GRIAUTI
    // ============================================
    getPlayerPropertiesWithHouses(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return [];

        const result = [];

        // Surinkti visus sklypus su namais pagal spalvas
        const propertiesByColor = {};
        player.properties.forEach(fieldId => {
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            if (houses > 0) {
                const field = this.getField(fieldId);
                if (field && field.color) {
                    // 🆕 SERVICE3 neturi namų – bet jei kas nors įrašė, praleisti
                    if (C.SERVICE3_IDS.includes(fieldId)) return;
                    
                    if (!propertiesByColor[field.color]) {
                        propertiesByColor[field.color] = [];
                    }
                    propertiesByColor[field.color].push({
                        id: fieldId,
                        name: field.name,
                        color: field.color,
                        cost: field.cost,
                        houses: houses,
                        isHotel: houses >= 5,
                        refund: this.getRefundAmount(fieldId, playerId)
                    });
                }
            }
        });

        // Kiekvienai spalvai patikrinti ar galima griauti
        for (const color in propertiesByColor) {
            const props = propertiesByColor[color];
            
            if (props.length === 0) continue;

            // Rasti max ir min namų skaičių grupėje
            const maxHouses = Math.max(...props.map(p => p.houses));
            const minHouses = Math.min(...props.map(p => p.houses));
            
            // Galima griauti TIK iš tų, kurie turi DAUGIAUSIAI namų
            if (maxHouses - minHouses <= 1) {
                // Jei visi vienodi - galima griauti iš VISŲ
                props.forEach(p => {
                    result.push({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        cost: p.cost,
                        houses: p.houses,
                        isHotel: p.isHotel,
                        refund: p.refund
                    });
                });
            } else {
                // Jei skirtumas > 1 - galima griauti TIK iš tų, kurie turi MAX
                props.forEach(p => {
                    if (p.houses === maxHouses) {
                        result.push({
                            id: p.id,
                            name: p.name,
                            color: p.color,
                            cost: p.cost,
                            houses: p.houses,
                            isHotel: p.isHotel,
                            refund: p.refund
                        });
                    }
                });
            }
        }

        // Rikiuoti pagal kainą
        result.sort((a, b) => a.cost - b.cost);

        return result;
    }

    // ============================================
    // GAUTI GRĄŽOS SUMĄ
    // ============================================
    getRefundAmount(fieldId, playerId) {
        // 🆕 Naudoti perduotą playerId, arba currentTurn
        const playerIdToUse = (playerId !== undefined && playerId !== null) 
            ? playerId 
            : this.game.currentTurn;
        
        const player = this.getPlayer(playerIdToUse);
        if (!player) return 0;
        
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        const field = this.getField(fieldId);
        if (!field) return 0;

        if (houses >= 5) {
            // Viešbutis - 75% sklypo vertės
            return Math.floor(field.cost * C.HOTEL_DEMOLISH_REFUND);
        } else {
            // Namas - 37.5% sklypo vertės
            return Math.floor(field.cost * C.DEMOLISH_REFUND_RATIO);
        }
    }

    // ============================================
    // AR GALIMA GRIAUTI
    // ============================================
    canDemolish(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) {
            return { can: false, reason: 'Žaidėjas neaktyvus' };
        }
        if (this.game.currentTurn !== playerId) {
            return { can: false, reason: 'Ne tavo eilė' };
        }
        if (!player.properties.includes(fieldId)) {
            return { can: false, reason: 'Neturi šio sklypo' };
        }

        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        if (houses === 0) {
            return { can: false, reason: 'Nėra namų ant šio sklypo' };
        }

        const field = this.getField(fieldId);
        if (!field || !field.color) {
            return { can: false, reason: 'Čia negalima griauti' };
        }

        // 🆕 SERVICE3 neturi namų
        if (C.SERVICE3_IDS.includes(fieldId)) {
            return { can: false, reason: 'Šiame sklype negalima griauti' };
        }

        // Patikrinti ar galima griauti pagal grupės taisykles
        const groupFields = this.getGroupByColor(field.color);
        if (groupFields.length === 0) {
            return { can: false, reason: 'Nerasta grupė' };
        }

        // Ar žaidėjas turi visus grupės sklypus?
        const hasAll = groupFields.every(id => player.properties.includes(id));
        if (!hasAll) {
            return { can: false, reason: 'Neturi visos grupės sklypų' };
        }

        // Patikrinti tolygumą
        const housesInGroup = groupFields.map(id => 
            player.houses && player.houses[id] ? player.houses[id] : 0
        );
        const minHouses = Math.min(...housesInGroup);
        const maxHouses = Math.max(...housesInGroup);

        // Galima griauti tik iš tų sklypų, kurie turi DAUGIAUSIAI namų
        if (houses < maxHouses) {
            return { can: false, reason: 'Pirmiausia griauk iš sklypų kurie turi daugiausiai namų' };
        }

        if (maxHouses - minHouses > 1) {
            return { can: false, reason: 'Pirmiausia išlygink namų skaičių visuose grupės sklypuose' };
        }

        const refund = this.getRefundAmount(fieldId, playerId);
        return { can: true, refund: refund };
    }

    // ============================================
    // GRIAUTI NAMĄ
    // ============================================
    demolishHouse(playerId, fieldId) {
        const result = this.canDemolish(playerId, fieldId);
        if (!result.can) {
            return { error: result.reason };
        }

        const player = this.getPlayer(playerId);
        const field = this.getField(fieldId);
        
        if (!player || !field) {
            return { error: 'Žaidėjas arba sklypas nerastas' };
        }

        const refund = result.refund;

        // Nuimti vieną namą
        player.houses[fieldId] = player.houses[fieldId] - 1;
        
        // Jei namų skaičius tapo 0 - ištrinti
        if (player.houses[fieldId] === 0) {
            delete player.houses[fieldId];
        }

        // Pridėti pinigus
        player.money += refund;

        const remainingHouses = player.houses[fieldId] || 0;
        const isHotel = remainingHouses >= 5;
        const typeText = isHotel ? 'VIEŽBUTĮ' : 'namą';
        const message = `🏚️ ${player.name} nugriovė ${typeText} ant ${field.name} ir gavo €${refund}!`;

        this.game.addMessage(message);
        this.game.turnHistory.push({
            player: player.name,
            action: 'demolish',
            field: field.name,
            refund: refund,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            fieldId: fieldId,
            fieldName: field.name,
            houses: remainingHouses,
            refund: refund,
            message: message
        };
    }
}

module.exports = DemolishLogic;