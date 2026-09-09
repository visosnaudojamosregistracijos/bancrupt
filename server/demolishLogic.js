// server/demolishLogic.js

class DemolishLogic {
    constructor(game) {
        this.game = game;
    }

    // Gauti sklypus su namais - TIK TUOS KURIUOS GALIMA GRIAUTI
    getPlayerPropertiesWithHouses(playerId) {
        const player = this.game.players[playerId];
        if (!player) return [];

        const result = [];

        // Surinkti visus sklypus su namais pagal spalvas
        const propertiesByColor = {};
        player.properties.forEach(fieldId => {
            const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
            if (houses > 0) {
                const field = this.game.board.find(f => f.id === fieldId);
                if (field && field.color) {
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
            
            // Rasti max ir min namų skaičių grupėje
            const maxHouses = Math.max(...props.map(p => p.houses));
            const minHouses = Math.min(...props.map(p => p.houses));
            
            // Galima griauti TIK iš tų, kurie turi DAUGIAUSIAI namų
            // IR skirtumas tarp max ir min <= 1
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

        // Rikiuoti pagal kainą (nuo pigiausio iki brangiausio)
        result.sort((a, b) => a.cost - b.cost);

        return result;
    }

    // Gauti grąžos sumą (75% statybos/viezbučio kainos)
    getRefundAmount(fieldId, playerId) {
        const player = this.game.players[playerId || this.game.currentTurn];
        if (!player) return 0;
        
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        const field = this.game.board.find(f => f.id === fieldId);
        if (!field) return 0;

        if (houses >= 5) {
            // Viezbutis - grąža 75% nuo sklypo vertės
            return Math.floor(field.cost * 0.75);
        } else {
            // Namas - grąža 75% nuo 50% sklypo vertės (t.y. 37.5% sklypo vertės)
            return Math.floor(field.cost * 0.375);
        }
    }

    // Patikrinti ar galima griauti ant konkretaus sklypo
    canDemolish(playerId, fieldId) {
        const player = this.game.players[playerId];
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

        const field = this.game.board.find(f => f.id === fieldId);
        if (!field || !field.color) {
            return { can: false, reason: 'Čia negalima griauti' };
        }

        // Patikrinti ar galima griauti pagal grupės taisykles (atvirkščiai nei statyba)
        const groupFields = this.getGroupByColor(field.color);
        if (groupFields.length === 0) {
            return { can: false, reason: 'Nerasta grupė' };
        }

        // Patikrinti ar žaidėjas turi visus grupės sklypus
        const hasAll = groupFields.every(id => player.properties.includes(id));
        if (!hasAll) {
            return { can: false, reason: 'Neturi visos grupės sklypų' };
        }

        // Patikrinti ar galima griauti pagal tolygumo taisyklę (atvirkščiai)
        const housesInGroup = groupFields.map(id => player.houses && player.houses[id] ? player.houses[id] : 0);
        const minHouses = Math.min(...housesInGroup);
        const maxHouses = Math.max(...housesInGroup);

        // Galima griauti tik iš tų sklypų, kurie turi DAUGIAUSIAI namų
        if (houses < maxHouses) {
            return { can: false, reason: 'Pirmiausia griauk iš sklypų kurie turi daugiausiai namų' };
        }

        // Jei skirtumas tarp max ir min > 1 - negalima griauti
        if (maxHouses - minHouses > 1) {
            return { can: false, reason: 'Pirmiausia išlygink namų skaičių visuose grupės sklypuose' };
        }

        const refund = this.getRefundAmount(fieldId, playerId);
        return { can: true, refund: refund };
    }

    // Griauti namą - BE PATVIRTINIMO
    demolishHouse(playerId, fieldId) {
        const result = this.canDemolish(playerId, fieldId);
        if (!result.can) {
            return { error: result.reason };
        }

        const player = this.game.players[playerId];
        const field = this.game.board.find(f => f.id === fieldId);
        const refund = result.refund;

        // Nuimti vieną namą
        player.houses[fieldId] = player.houses[fieldId] - 1;
        
        // Jei namų skaičius tapo 0 - ištrinti iš objekto
        if (player.houses[fieldId] === 0) {
            delete player.houses[fieldId];
        }

        // Pridėti pinigus
        player.money += refund;

        const remainingHouses = player.houses[fieldId] || 0;
        const isHotel = remainingHouses >= 5;
        const typeText = isHotel ? 'VIEZBUTĮ' : 'namą';
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

    // Gauti grupės sklypus pagal spalvą
    getGroupByColor(color) {
        const groups = {
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
        };
        return groups[color] || [];
    }
}

module.exports = DemolishLogic;