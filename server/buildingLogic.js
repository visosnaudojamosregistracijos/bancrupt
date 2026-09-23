// ============================================
// server/buildingLogic.js
// ============================================

const C = require('./gameConstants');

// ============================================
// NAMŲ IR VIEZBUČIŲ STATYMO LOGIKA
// ============================================

class BuildingLogic {
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
    // AR TAI SERVICE3 (speciali grupė be statybų)
    // ============================================
    isService3(fieldId) {
        return C.SERVICE3_IDS.includes(fieldId);
    }

    // ============================================
    // AR ŽAIDĖJAS TURI VISĄ GRUPĘ
    // ============================================
    hasFullGroup(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) return false;

        const field = this.getField(fieldId);
        if (!field || !field.color) return false;

        const groupFields = this.getGroupByColor(field.color);
        if (groupFields.length === 0) return false;

        const hasAll = groupFields.every(id => player.properties.includes(id));
        return hasAll;
    }

    // ============================================
    // GAUTI ŽAIDĖJO SKLYPUS SU NAMAIS
    // ============================================
    getPlayerPropertiesWithHouses(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return [];

        return player.properties.map(fieldId => {
            const field = this.getField(fieldId);
            if (!field) return null;
            return {
                id: fieldId,
                name: field.name,
                color: field.color,
                houses: player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0
            };
        }).filter(p => p !== null);
    }

    // ============================================
    // AR GALIMA STATYTI
    // ============================================
    canBuildHouse(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        if (!player || player.bankrupt) {
            return { can: false, reason: 'Žaidėjas neaktyvus' };
        }
        if (this.game.currentTurn !== playerId) {
            return { can: false, reason: 'Ne tavo eilė' };
        }
        if (player.position !== fieldId) {
            return { can: false, reason: 'Stovi ant kito sklypo' };
        }

        const field = this.getField(fieldId);
        if (!field) {
            return { can: false, reason: 'Sklypas nerastas' };
        }
        if (!field.color) {
            return { can: false, reason: 'Čia negalima statyti' };
        }

        // 🆕 SERVICE3 negali statyti
        if (this.isService3(fieldId)) {
            return { can: false, reason: 'Šiame sklype negalima statyti namų' };
        }

        // 🆕 Tik property tipo sklypai
        if (field.type !== 'property') {
            return { can: false, reason: 'Čia negalima statyti' };
        }

        // Ar turi visą grupę?
        if (!this.hasFullGroup(playerId, fieldId)) {
            return { can: false, reason: 'Neturi visos grupės sklypų' };
        }

        const groupFields = this.getGroupByColor(field.color);
        if (!player.houses) player.houses = {};

        const currentHouses = player.houses[fieldId] || 0;
        
        // Ar jau yra viešbutis?
        if (currentHouses >= 5) {
            return { can: false, reason: 'Jau yra viešbutis ant šio sklypo' };
        }

        // Ar visur po 4 namus (galima statyti viešbutį)?
        const allHave4 = groupFields.every(id => (player.houses[id] || 0) >= 4);
        if (allHave4) {
            const buildCost = this.getHotelCost(fieldId);
            if (player.money < buildCost) {
                return { can: false, reason: `Nepakanka pinigų viešbučiui (reikia €${buildCost})` };
            }
            return { can: true, cost: buildCost, isHotel: true };
        }

        // Ar visur vienodas namų skaičius?
        const housesInGroup = groupFields.map(id => player.houses[id] || 0);
        const minHouses = Math.min(...housesInGroup);
        const maxHouses = Math.max(...housesInGroup);

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

    // ============================================
    // STATYTI NAMĄ ARBA VIEZBUTĮ
    // ============================================
    buildHouse(playerId, fieldId) {
        const result = this.canBuildHouse(playerId, fieldId);
        if (!result.can) {
            return { error: result.reason };
        }

        const player = this.getPlayer(playerId);
        const field = this.getField(fieldId);
        
        if (!player || !field) {
            return { error: 'Žaidėjas arba sklypas nerastas' };
        }

        const cost = result.cost;
        const isHotel = result.isHotel || false;

        player.money -= cost;

        if (!player.houses) player.houses = {};

        if (isHotel) {
            player.houses[fieldId] = 5;
            const message = `🏨 ${player.name} pastatė VIEZBUTĮ ant ${field.name} už €${cost}! 🎉`;
            this.game.addMessage(message);
            this.game.turnHistory.push({
                player: player.name,
                action: 'build_hotel',
                field: field.name,
                timestamp: new Date().toISOString()
            });
            
            if (this.game.emitFunction) {
                this.game.emitFunction('buildingBuilt', {
                    playerId: player.id,
                    playerName: player.name,
                    fieldId: fieldId,
                    fieldName: field.name,
                    houseCount: 5,
                    isHotel: true,
                    cost: cost
                });
            }
            
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

            if (this.game.emitFunction) {
                this.game.emitFunction('buildingBuilt', {
                    playerId: player.id,
                    playerName: player.name,
                    fieldId: fieldId,
                    fieldName: field.name,
                    houseCount: houseCount,
                    isHotel: false,
                    cost: cost
                });
            }

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

    // ============================================
    // STATYBOS KAINOS
    // ============================================
    getBuildCost(fieldId) {
        const field = this.getField(fieldId);
        if (!field) return 0;
        return Math.floor(field.cost * C.BUILD_COST_RATIO);
    }

    getHotelCost(fieldId) {
        const field = this.getField(fieldId);
        if (!field) return 0;
        return Math.floor(field.cost * C.HOTEL_COST_RATIO);
    }

    // ============================================
    // GAUTI GRUPĖS STATUSĄ
    // ============================================
    getGroupStatus(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return [];

        const result = [];
        const processedColors = new Set();

        player.properties.forEach(fieldId => {
            const field = this.getField(fieldId);
            if (!field || !field.color) return;
            if (processedColors.has(field.color)) return;
            processedColors.add(field.color);

            const groupFields = this.getGroupByColor(field.color);
            const groupStatus = groupFields.map(id => {
                const f = this.getField(id);
                if (!f) return null;
                return {
                    id: id,
                    name: f.name,
                    owned: player.properties.includes(id),
                    houses: player.houses && player.houses[id] ? player.houses[id] : 0
                };
            }).filter(f => f !== null);

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

    // ============================================
    // NUOMOS SKAIČIAVIMAS
    // ============================================
    // Bazinė nuoma = 10% sklypo vertės
    // Daugiklis pagal namų skaičių:
    //   0 namų → × 1
    //   1 namas → × 10
    //   2 namai → × 20
    //   3 namai → × 30
    //   4 namai → × 40
    //   Viežbutis → × 50
    // ============================================
    getRentWithHouses(playerId, fieldId) {
        const player = this.getPlayer(playerId);
        const field = this.getField(fieldId);
        if (!player || !field) return 0;

        // 🆕 SERVICE3 – fiksuota nuoma pagal turimų sklypų skaičių
        if (C.SERVICE3_IDS.includes(fieldId)) {
            const ownedInGroup = player.properties.filter(id => C.SERVICE3_IDS.includes(id)).length;
            const rent = C.SERVICE_RENT[ownedInGroup] || C.SERVICE_RENT[1] || 50;
            return rent;
        }

        // 🆕 NAUJA FORMULĖ
        const houses = player.houses && player.houses[fieldId] ? player.houses[fieldId] : 0;
        
        // Patikrinti, ar žaidėjas turi pilną grupę
        const fieldColor = field.color;
        const groupFields = C.COLOR_GROUPS[fieldColor] || [];
        const hasFullGroup = groupFields.every(id => player.properties.includes(id));
        
        let rent = 0;
        
        if (houses === 0) {
            // Be namų
            if (hasFullGroup) {
                // Pilna gatvė be namų
                rent = Math.round(field.cost * 0.20);
            } else {
                // Vienas sklypas be namų
                rent = Math.round(field.cost * 0.10);
            }
        } else if (houses === 1) {
            rent = Math.round(field.cost * 1.00);
        } else if (houses === 2) {
            rent = Math.round(field.cost * 2.00);
        } else if (houses === 3) {
            rent = Math.round(field.cost * 3.00);
        } else if (houses === 4) {
            rent = Math.round(field.cost * 4.00);
        } else if (houses >= 5) {
            // Viešbutis
            rent = Math.round(field.cost * 5.00);
        }
        
        return rent;
    }
}

module.exports = BuildingLogic;