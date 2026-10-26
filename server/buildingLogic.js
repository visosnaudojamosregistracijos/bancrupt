// ============================================
// server/buildingLogic.js
// ============================================

const C = require('./gameConstants');
const { L } = require('./i18nSrv');   // 🌐 tekstai iš lang/lt.json
const db = require('./db');

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
            return { can: false, reason: L('srv.game.zaidejas_neaktyvus') };
        }
        if (this.game.currentTurn !== playerId) {
            return { can: false, reason: L('srv.game.ne_tavo_eile') };
        }
        if (!player.isBot && (this.game.isRolling || this.game.pendingFieldPlayerId === playerId)) {
            return { can: false, reason: L('srv.build.palauk_kol_figurele_sustos') };
        }

        const field = this.getField(fieldId);
        if (!field) {
            return { can: false, reason: L('srv.build.sklypas_nerastas') };
        }

        // 🏗️ STATYBŲ TAISYKLĖ (pasirenka stalo kūrėjas)
        const rule = this.game.buildRule || 2;
        const built = this.game.builtThisTurn || {};
        const standField = this.getField(player.position);
        // 2 ir 3 taisyklės: statyti galima tik tą ėjimą, kai ką tik atsistojai (ne stovint nuo praėjusio ėjimo)
        if (rule !== 1) {
            const lp = this.game.landingPos;
            if (!lp || lp.playerId !== playerId || lp.pos !== player.position) {
                return { can: false, reason: L('srv.build.statyti_galima_tik_ta_ejima') };
            }
        }
        if (rule === 3) {
            // 3 – tik sklype, ant kurio stovi; kiek namų – lemia tolygus statymas
            // (dažniausiai vienas; du – kai atsilikusį sklypą išlygini ir pradedi kitą lygį)
            if (player.position !== fieldId) {
                return { can: false, reason: L('srv.build.pagal_taisykle_statyti_galima_tik') };
            }
        } else if (rule === 2) {
            // 2 – atsistojus ant savo gatvės sklypo: po vieną namą ant kiekvieno tos gatvės sklypo
            if (!standField || standField.type !== 'property' || !standField.color ||
                standField.color !== field.color || !player.properties.includes(standField.id)) {
                return { can: false, reason: L('srv.build.pagal_taisykle_statyti_galima_tik_2') };
            }
            if ((built[fieldId] || 0) >= 1) {
                return { can: false, reason: L('srv.build.siame_sklype_si_karta_jau') };
            }
        }
        // 1 – bet kada ir bet kur (savo ėjimo metu, turint pilną gatvę)
        if (!field.color) {
            return { can: false, reason: L('srv.build.cia_negalima_statyti') };
        }

        // 🆕 SERVICE3 negali statyti
        if (this.isService3(fieldId)) {
            return { can: false, reason: L('srv.build.siame_sklype_negalima_statyti_namu') };
        }

        // 🆕 Tik property tipo sklypai
        if (field.type !== 'property') {
            return { can: false, reason: L('srv.build.cia_negalima_statyti') };
        }

        // Ar turi visą grupę?
        if (!this.hasFullGroup(playerId, fieldId)) {
            return { can: false, reason: L('srv.build.neturi_visos_grupes_sklypu') };
        }

        const groupFields = this.getGroupByColor(field.color);
        if (!player.houses) player.houses = {};

        const currentHouses = player.houses[fieldId] || 0;
        
        // Ar jau yra viešbutis?
        if (currentHouses >= 5) {
            return { can: false, reason: L('srv.build.jau_yra_viesbutis_ant_sio') };
        }

        // Ar visur po 4 namus (galima statyti viešbutį)?
        const allHave4 = groupFields.every(id => (player.houses[id] || 0) >= 4);
        if (allHave4) {
            const buildCost = this.getHotelCost(fieldId);
            if (player.money < buildCost) {
                return { can: false, reason: L('srv.build.nepakanka_pinigu_viesbuciui_reikia', { buildCost }) };
            }
            return { can: true, cost: buildCost, isHotel: true };
        }

        // Ar visur vienodas namų skaičius?
        const housesInGroup = groupFields.map(id => player.houses[id] || 0);
        const minHouses = Math.min(...housesInGroup);
        const maxHouses = Math.max(...housesInGroup);

        // Jei jau yra 4 namai ant šio sklypo, bet ne visur po 4
        if (currentHouses >= 4) {
            return { can: false, reason: L('srv.build.pirmiausia_pastatyk_po_namus_visuose') };
        }

        if (maxHouses - minHouses > 1) {
            return { can: false, reason: L('srv.build.pirmiausia_islygink_namu_skaiciu_visuose') };
        }

        if (currentHouses > minHouses) {
            return { can: false, reason: L('srv.build.kiti_grupes_sklypai_turi_maziau') };
        }

        const buildCost = this.getBuildCost(fieldId);
        if (player.money < buildCost) {
            return { can: false, reason: L('srv.build.nepakanka_pinigu_reikia', { buildCost }) };
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
            return { error: L('srv.build.zaidejas_arba_sklypas_nerastas') };
        }

        const cost = result.cost;
        const isHotel = result.isHotel || false;

        player.money -= cost;

        if (!player.houses) player.houses = {};
        if (!this.game.builtThisTurn) this.game.builtThisTurn = {};
        this.game.builtThisTurn[fieldId] = (this.game.builtThisTurn[fieldId] || 0) + 1;

        if (isHotel) {
            player.houses[fieldId] = 5;
            const message = L('srv.build.pastate_viezbuti_ant_uz', { player: player.name, field: field.name, cost });
            this.game.addMessage(message);

            // 🆕 ĮRAŠYTI STATISTIKĄ
            if (player.userId && !player.isBot) {
                db.updateStats(player.userId, { houses_built: 1 }).catch(err => {
                    console.error('❌ houses_built klaida:', err);
                });
            }

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
            const message = L('srv.build.pastate_nama_ant_dabar_namai', { player: player.name, field: field.name, houseCount, cost });
            this.game.addMessage(message);

            // 🆕 ĮRAŠYTI STATISTIKĄ
            if (player.userId && !player.isBot) {
                db.updateStats(player.userId, { houses_built: 1 }).catch(err => {
                    console.error('❌ houses_built klaida:', err);
                });
            }

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
                this.game.addMessage(L('srv.build.gali_statyti_viezbuti_ant_grupes', { player: player.name, color: field.color }));
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
    //   Viešbutis → × 50
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