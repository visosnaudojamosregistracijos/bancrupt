// ============================================
// buildingLogic.js
// ============================================

// ============================================
// NAMŲ IR VIEZBUČIŲ STATYMO LOGIKA
// ============================================

class BuildingLogic {
    constructor(game) {
        this.game = game;
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

    // Patikrinti ar žaidėjas turi VISUS grupės sklypus
    hasFullGroup(playerId, fieldId) {
        const player = this.game.players[playerId];
        if (!player || player.bankrupt) return false;

        const field = this.game.board[fieldId];
        if (!field || !field.color) return false;

        const groupFields = this.getGroupByColor(field.color);
        if (groupFields.length === 0) return false;

        const hasAll = groupFields.every(id => player.properties.includes(id));
        return hasAll;
    }

    // Gauti žaidėjo visus sklypus su namų skaičiumi
    getPlayerPropertiesWithHouses(playerId) {
        const player = this.game.players[playerId];
        if (!player) return [];

        return player.properties.map(fieldId => {
            const field = this.game.board[fieldId];
            return {
                id: fieldId,
                name: field.name,
                color: field.color,
                houses: player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0
            };
        });
    }

    // Patikrinti ar galima statyti namą/viezbutį ant konkretaus sklypo
    canBuildHouse(playerId, fieldId) {
        const player = this.game.players[playerId];
        if (!player || player.bankrupt) return { can: false, reason: 'Žaidėjas neaktyvus' };
        if (this.game.currentTurn !== playerId) return { can: false, reason: 'Ne tavo eilė' };
        if (player.position !== fieldId) return { can: false, reason: 'Stovi ant kito sklypo' };

        const field = this.game.board[fieldId];
        if (!field || !field.color) return { can: false, reason: 'Čia negalima statyti' };
        if (!this.hasFullGroup(playerId, fieldId)) {
            return { can: false, reason: 'Neturi visos grupės sklypų' };
        }

        const groupFields = this.getGroupByColor(field.color);
        if (!player.houses) player.houses = {};

        const currentHouses = player.houses[fieldId] || 0;
        
        // Patikrinti ar jau yra viezbutis ant šio sklypo
        if (currentHouses >= 5) {
            return { can: false, reason: 'Jau yra viezbutis ant šio sklypo' };
        }

        // Patikrinti ar visur po 4 namus (galima statyti viezbutį)
        const allHave4 = groupFields.every(id => (player.houses[id] || 0) >= 4);
        if (allHave4) {
            // Jei visur po 4, galima statyti viezbutį ANT ŠIO SKLYPO
            const buildCost = this.getHotelCost(fieldId);
            if (player.money < buildCost) {
                return { can: false, reason: `Nepakanka pinigų viezbučiui (reikia €${buildCost})` };
            }
            return { can: true, cost: buildCost, isHotel: true };
        }

        // Patikrinti ar visur yra po vienodą namų skaičių (paprastas namas)
        const minHouses = Math.min(...groupFields.map(id => player.houses[id] || 0));
        const maxHouses = Math.max(...groupFields.map(id => player.houses[id] || 0));

        // Jei jau yra 4 namai ant šio sklypo, bet ne visur po 4
        if (currentHouses >= 4) {
            return { can: false, reason: 'Pirmiausia pastatyk po 4 namus visuose grupės sklypuose' };
        }

        if (maxHouses - minHouses > 1) {
            return { can: false, reason: 'Pirmiausia išlygink namų skaičių visuose grupės sklypuose' };
        }

        if (currentHouses > minHouses) {
            return { can: false, reason: 'Kiti grupės sklypai turi mažiau namų' };
        }

        const buildCost = this.getBuildCost(fieldId);
        if (player.money < buildCost) {
            return { can: false, reason: `Nepakanka pinigų (reikia €${buildCost})` };
        }

        return { can: true, cost: buildCost, isHotel: false };
    }

    // Statyti namą arba viezbutį
    buildHouse(playerId, fieldId) {
        const result = this.canBuildHouse(playerId, fieldId);
        if (!result.can) {
            return { error: result.reason };
        }

        const player = this.game.players[playerId];
        const field = this.game.board[fieldId];
        const cost = result.cost;
        const isHotel = result.isHotel || false;

        player.money -= cost;

        if (!player.houses) player.houses = {};

        if (isHotel) {
            // Statyti viezbutį TIK ANT ŠIO SKLYPO
            player.houses[fieldId] = 5;  // 5 = viezbutis
            const message = `🏨 ${player.name} pastatė VIEZBUTĮ ant ${field.name} už €${cost}! 🎉`;
            this.game.addMessage(message);
            this.game.turnHistory.push({
                player: player.name,
                action: 'build_hotel',
                field: field.name,
                timestamp: new Date().toISOString()
            });
            return { 
                success: true, 
                fieldId: fieldId,
                fieldName: field.name,
                houses: 5,
                isHotel: true,
                cost: cost,
                message: message
            };
        } else {
            // Statyti paprastą namą
            player.houses[fieldId] = (player.houses[fieldId] || 0) + 1;
            const houseCount = player.houses[fieldId];
            const message = `🏠 ${player.name} pastatė namą ant ${field.name} (dabar ${houseCount} namai) už €${cost}!`;
            this.game.addMessage(message);
            this.game.turnHistory.push({
                player: player.name,
                action: 'build_house',
                field: field.name,
                houses: houseCount,
                timestamp: new Date().toISOString()
            });

            // Patikrinti ar visur po 4 namus
            const groupFields = this.getGroupByColor(field.color);
            const allHave4 = groupFields.every(id => (player.houses[id] || 0) >= 4);
            if (allHave4) {
                this.game.addMessage(`🏆 ${player.name} gali statyti VIEZBUTĮ ant ${field.color} grupės!`);
            }

            return { 
                success: true, 
                fieldId: fieldId,
                fieldName: field.name,
                houses: houseCount,
                isHotel: false,
                cost: cost,
                message: message
            };
        }
    }

    // Gauti statybos kainą pagal sklypo ID (50% sklypo vertės)
    getBuildCost(fieldId) {
        const field = this.game.board[fieldId];
        if (!field) return 0;
        return Math.floor(field.cost * 0.5);
    }

    // Gauti viezbučio kainą (100% sklypo vertės)
    getHotelCost(fieldId) {
        const field = this.game.board[fieldId];
        if (!field) return 0;
        return field.cost;  // 100% sklypo vertės
    }

    // Gauti informaciją apie visus žaidėjo sklypus su namais
    getGroupStatus(playerId) {
        const player = this.game.players[playerId];
        if (!player) return [];

        const result = [];
        const processedColors = new Set();

        player.properties.forEach(fieldId => {
            const field = this.game.board[fieldId];
            if (!field || !field.color) return;
            if (processedColors.has(field.color)) return;
            processedColors.add(field.color);

            const groupFields = this.getGroupByColor(field.color);
            const groupStatus = groupFields.map(id => {
                const f = this.game.board[id];
                return {
                    id: id,
                    name: f.name,
                    owned: player.properties.includes(id),
                    houses: player.houses && player.houses[id] ? player.houses[id] : 0
                };
            });

            const hasFull = this.hasFullGroup(playerId, fieldId);
            result.push({
                color: field.color,
                fields: groupStatus,
                hasFull: hasFull,
                totalHouses: groupStatus.reduce((sum, f) => sum + f.houses, 0)
            });
        });

        return result;
    }

    // Gauti nuomą su namais ir viezbučiais
    getRentWithHouses(playerId, fieldId) {
        const player = this.game.players[playerId];
        const field = this.game.board[fieldId];
        if (!player || !field) return 0;

        // Bazinė nuoma (10% sklypo vertės)
        let rent = Math.floor(field.cost * 0.1);
        
        // Jei turi visą grupę - nuoma padvigubėja
        if (this.hasFullGroup(playerId, fieldId)) {
            rent = rent * 2;
        }

        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        
        if (houses >= 5) {
            // Viezbutis - 3x nuoma (bazinė + 2x)
            rent = rent * 3;
        } else {
            // Paprasti namai - kiekvienas namas prideda 30% sklypo vertės
            const houseRent = houses * Math.floor(field.cost * 0.3);
            rent += houseRent;
        }

        return rent;
    }
}

module.exports = BuildingLogic;