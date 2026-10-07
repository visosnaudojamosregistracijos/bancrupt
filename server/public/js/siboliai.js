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
            speed: 4000,       // ms per judėjimą
            moveInterval: 8000, // kas kiek ms juda
            talkInterval: 12000, // kas kiek ms kalba
            walkAnimation: true, // ar animuoti kojas
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
            image: '/images/grazuoliukas.svg',
            width: 100,
            speed: 2500,
            moveInterval: 5000,
            talkInterval: 8000,
            walkAnimation: true,
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
        const margin = 100;

        return [
            { x: margin, y: h - margin - 200 },           // apačia kairė
            { x: w - margin - 150, y: h - margin - 200 }, // apačia dešinė
            { x: margin, y: margin },                      // viršus kairė
            { x: w - margin - 150, y: margin }             // viršus dešinė
        ];
    }

    // ===== NPC KLASĖ =====
    class NPC {
        constructor(config, corners) {
            this.config = config;
            this.corners = corners;
            this.currentCorner = Math.floor(Math.random() * corners.length);
            this.element = null;
            this.bubble = null;
            this.moveTimer = null;
            this.talkTimer = null;
            this.isWalking = false;

            this.create();
            this.start();
        }

        create() {
            // Konteineris
            this.element = document.createElement('div');
            this.element.className = 'npc npc-' + this.config.name.toLowerCase();
            this.element.style.width = this.config.width + 'px';

            // Paveikslėlis
            const img = document.createElement('img');
            img.src = this.config.image;
            img.alt = this.config.name;
            img.draggable = false;
            this.element.appendChild(img);

            // Kalbos burbuliukas
            this.bubble = document.createElement('div');
            this.bubble.className = 'npc-bubble';
            this.element.appendChild(this.bubble);

            // Pradinė pozicija
            const corner = this.corners[this.currentCorner];
            this.element.style.left = corner.x + 'px';
            this.element.style.top = corner.y + 'px';

            // Įterpti į DOM
            document.body.appendChild(this.element);

            // Pasirodymo animacija
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
            if (this.isWalking) return; // nejudėti, jei jau juda

            // Pasirinkti kitą kampą (ne tą patį)
            let newCorner;
            do {
                newCorner = Math.floor(Math.random() * this.corners.length);
            } while (newCorner === this.currentCorner && this.corners.length > 1);

            this.currentCorner = newCorner;
            const corner = this.corners[this.currentCorner];

            // Judėjimo animacija
            this.isWalking = true;
            this.element.classList.add('npc-walking');
            this.element.style.transition = `left ${this.config.speed}ms ease-in-out, top ${this.config.speed}ms ease-in-out`;
            this.element.style.left = corner.x + 'px';
            this.element.style.top = corner.y + 'px';

            // Sustabdyti po judėjimo
            setTimeout(() => {
                this.element.classList.remove('npc-walking');
                this.isWalking = false;
            }, this.config.speed);
        }

        say(phrase) {
            const text = phrase || this.config.phrases[Math.floor(Math.random() * this.config.phrases.length)];
            this.bubble.textContent = text;
            this.bubble.classList.add('show');
            this.element.classList.add('npc-talking');

            // Paslėpti po 3 sek.
            setTimeout(() => {
                this.bubble.classList.remove('show');
                this.element.classList.remove('npc-talking');
            }, 3000);
        }

        destroy() {
            clearInterval(this.moveTimer);
            clearInterval(this.talkTimer);
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

        // Sukurti Tėvą
        npcs.push(new NPC(NPC_CONFIG.tevas, corners));

        // Gražuoliuką pridėsime vėliau
        npcs.push(new NPC(NPC_CONFIG.grazuoliukas, corners));

        // Atnaujinti kampus pasikeitus ekrano dydžiui
        window.addEventListener('resize', () => {
            const newCorners = getCorners();
            npcs.forEach(npc => {
                npc.corners = newCorners;
            });
        });
    }

    // Paleisti, kai DOM paruoštas
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== GLOBALUS API =====
    window.Siboliai = {
        tevas: () => npcs.find(n => n.config.name === 'Tėvas'),
        visi: () => npcs,
        sustabdyti: () => npcs.forEach(n => n.destroy()),
        // Pagalbinė funkcija — paleisti NPC
        paleisti: () => init()
    };

    console.log('🎩 Siboliai užkrauti!');
    console.log('   Naudok: Siboliai.visi(), Siboliai.tevas(), Siboliai.sustabdyti()');

})();