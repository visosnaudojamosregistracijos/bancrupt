/* ============================================================
   SIBOLIAI — NPC personažai
   Tėvas + Gražuoliukas
   ============================================================ */

(function() {
    'use strict';

    // ===== KONFIGŪRACIJA =====
    const NPC_CONFIG = {
        tevas: {
            name: 'Tėvas',
            image: '/images/tevas.svg',
            width: 120,
            speed: 8000,
            moveInterval: 16000,
            talkInterval: 14000,
            talkDuration: 5000, // kiek ms rodomas tekstas
            phrases: [
                'Tėvas viską mato!',
                'Tu dar jaunas, sūneli...',
                'Pinigai yra viskas!',
                'Bankrutuok, sūneli!',
                'Aš turiu 3 namus!',
                'Pirk, pirk, pirk!',
                'Ha! Aš žinau, ką darai.',
                'Tėvas nusprendžia!',
                'Nebūk toks godus...',
                'Aš laimėsiu!'
            ]
        },
        grazuoliukas: {
            name: 'Gražuoliukas',
            image: '/images/grazuoliukas.svg?v=5',
            width: 100,
            speed: 6000,
            moveInterval: 12000,
            talkInterval: 10000,
            talkDuration: 5000,
            phrases: [
                'Aš laimėjau!',
                'Pirk, pirk, pirk!',
                'Ha ha ha!',
                'Bankrutuok!',
                'Aš greitesnis!',
                'Tėvas, tu senas!',
                'Pinigai! Pinigai!',
                'Aš turiu 5 namus!',
                'Nebijok, aš čia!',
                'Žaiskim!'
            ]
        }
    };

    // ===== KAMPŲ POZICIJOS =====
    function getCorners() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const margin = 80;

        return [
            { x: margin, y: h - margin - 220 },           // 0: apačia kairė
            { x: w - margin - 160, y: h - margin - 220 }, // 1: apačia dešinė
            { x: margin, y: margin + 60 },                 // 2: viršus kairė
            { x: w - margin - 160, y: margin + 60 }        // 3: viršus dešinė
        ];
    }

    // ===== GLOBALUS KAMPŲ UŽIMTUMAS =====
    // Saugo, kuris NPC užima kurį kampą
    const cornerOccupancy = {
        0: null,
        1: null,
        2: null,
        3: null
    };

    // ===== NPC KLASĖ =====
    class NPC {
        constructor(config, corners, startCorner) {
            this.config = config;
            this.corners = corners;
            this.currentCorner = startCorner;
            this.element = null;
            this.bubble = null;
            this.moveTimer = null;
            this.talkTimer = null;
            this.isWalking = false;
            this.isTalking = false;

            // Užimti kampą
            cornerOccupancy[startCorner] = this.config.name;

            this.create();
            this.start();
        }

        create() {
            this.element = document.createElement('div');
            this.element.className = 'npc npc-' + this.config.name.toLowerCase();
            this.element.style.width = this.config.width + 'px';

            const img = document.createElement('img');
            img.src = this.config.image;
            img.alt = this.config.name;
            img.draggable = false;
            this.element.appendChild(img);

            this.bubble = document.createElement('div');
            this.bubble.className = 'npc-bubble';
            this.element.appendChild(this.bubble);

            const corner = this.corners[this.currentCorner];
            this.element.style.left = corner.x + 'px';
            this.element.style.top = corner.y + 'px';

            document.body.appendChild(this.element);

            this.element.classList.add('npc-appearing');
            setTimeout(() => {
                this.element.classList.remove('npc-appearing');
            }, 500);
        }

        start() {
            // Judėjimas
            this.moveTimer = setInterval(() => {
                this.move();
            }, this.config.moveInterval);

            // Kalbėjimas
            this.talkTimer = setInterval(() => {
                this.say();
            }, this.config.talkInterval);

            // Pirmas pasisakymas po 2 sek.
            setTimeout(() => this.say(), 2000);
        }

        move() {
            // Nejudėti, jei jau juda arba kalba
            if (this.isWalking || this.isTalking) return;

            // Rasti laisvą kampą (ne tą patį, ne užimtą)
            const freeCorners = [];
            for (let i = 0; i < this.corners.length; i++) {
                if (i !== this.currentCorner && cornerOccupancy[i] === null) {
                    freeCorners.push(i);
                }
            }

            // Jei nėra laisvų kampų — nejudėti
            if (freeCorners.length === 0) return;

            // Pasirinkti atsitiktinį laisvą kampą
            const newCorner = freeCorners[Math.floor(Math.random() * freeCorners.length)];

            // Atleisti seną kampą, užimti naują
            cornerOccupancy[this.currentCorner] = null;
            cornerOccupancy[newCorner] = this.config.name;
            this.currentCorner = newCorner;

            const corner = this.corners[newCorner];

            // Judėjimo animacija
            this.isWalking = true;
            this.element.classList.add('npc-walking');
            this.element.style.transition = `left ${this.config.speed}ms linear, top ${this.config.speed}ms linear`;
            this.element.style.left = corner.x + 'px';
            this.element.style.top = corner.y + 'px';

            setTimeout(() => {
                this.element.classList.remove('npc-walking');
                this.isWalking = false;
            }, this.config.speed);
        }

        say(phrase) {
            // Jei jau kalba — nekalbėti
            if (this.isTalking) return;

            // Jei juda — sustabdyti judėjimą
            if (this.isWalking) {
                // Palaukti, kol baigs judėti
                setTimeout(() => this.say(phrase), 500);
                return;
            }

            const text = phrase || this.config.phrases[Math.floor(Math.random() * this.config.phrases.length)];
            this.bubble.textContent = text;
            this.bubble.classList.add('show');
            this.element.classList.add('npc-talking');
            this.isTalking = true;

            // Paslėpti po talkDuration
            setTimeout(() => {
                this.bubble.classList.remove('show');
                this.element.classList.remove('npc-talking');
                this.isTalking = false;
            }, this.config.talkDuration);
        }

        destroy() {
            clearInterval(this.moveTimer);
            clearInterval(this.talkTimer);
            cornerOccupancy[this.currentCorner] = null;
            if (this.element && this.element.parentNode) {
                this.element.classList.add('npc-disappearing');
                setTimeout(() => {
                    if (this.element.parentNode) {
                        this.element.parentNode.removeChild(this.element);
                    }
                }, 300);
            }
        }
    }

    // ===== INICIALIZACIJA =====
    let npcs = [];

    function init() {
        const corners = getCorners();

        // Tėvas — pradeda apačia kairė (0)
        npcs.push(new NPC(NPC_CONFIG.tevas, corners, 0));

        // Gražuoliukas — pradeda viršus dešinė (3)
        npcs.push(new NPC(NPC_CONFIG.grazuoliukas, corners, 3));

        window.addEventListener('resize', () => {
            const newCorners = getCorners();
            npcs.forEach(npc => {
                npc.corners = newCorners;
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== GLOBALUS API =====
    window.Siboliai = {
        tevas: () => npcs.find(n => n.config.name === 'Tėvas'),
        grazuoliukas: () => npcs.find(n => n.config.name === 'Gražuoliukas'),
        visi: () => npcs,
        sustabdyti: () => npcs.forEach(n => n.destroy()),
        kampai: () => cornerOccupancy
    };

    console.log('🎩 Siboliai užkrauti!');
    console.log('   Tėvas + Gražuoliukas');

})();