// ============================================
// ADMIN PANELĖ — Vartotojai + Lenta
// ============================================

const token = localStorage.getItem('bancrupt_token');

if (!token) {
    document.body.innerHTML = '<h1>❌ Reikia prisijungti</h1><a href="/">Grįžti</a>';
    throw new Error('Nėra token');
}

let allBoardCells = []; // Laikom visus langelius filtravimui

// ============================================
// TAB SWITCH
// ============================================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');

    if (tab === 'board' && allBoardCells.length === 0) {
        loadBoard();
    }
    
    if (tab === 'center') {
        loadCenter();
    }
    
    if (tab === 'sounds') {
        loadSoundSettings();
    }
    
    if (tab === 'sound-files') {                    // ← NAUJA!
        loadSoundFiles();
    }
}

// ============================================
// MSG
// ============================================
function showMsg(text, isOk) {
    const msg = document.getElementById('msg');
    msg.innerHTML = `<div class="msg ${isOk ? 'ok' : 'err'}">${text}</div>`;
    setTimeout(() => msg.innerHTML = '', 3000);
}

// ============================================
// VARTOTOJAI
// ============================================
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                document.body.innerHTML = `
                    <h1>❌ Ne admin arba sesija baigėsi</h1>
                    <p>Prisijunk iš naujo su admin vartotoju.</p>
                    <a href="/">Grįžti į žaidimą</a>
                `;
                return;
            }
            throw new Error('HTTP ' + res.status);
        }

        const users = await res.json();
        renderUsers(users);
    } catch (err) {
        showMsg('Klaida: ' + err.message, false);
        document.getElementById('usersTable').innerHTML =
            '<tr><td colspan="5" style="text-align:center;color:red;">❌ Klaida: ' + err.message + '</td></tr>';
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nėra vartotojų</td></tr>';
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username} ${u.is_admin ? '👑' : ''}</td>
            <td class="emoji-cell">${u.emoji || '—'}</td>
            <td><input type="text" id="emoji-${u.id}" value="${u.emoji || ''}" maxlength="4" style="width:60px;text-align:center;"></td>
            <td><button onclick="saveEmoji(${u.id})">💾 Išsaugoti</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveEmoji(userId) {
    const emoji = document.getElementById('emoji-' + userId).value.trim();
    if (!emoji) {
        showMsg('Įvesk emoji', false);
        return;
    }

    try {
        const res = await fetch('/api/admin/emoji', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ userId, emoji })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        showMsg('✅ Emoji išsaugotas!', true);
        loadUsers();
    } catch (err) {
        showMsg('Klaida: ' + err.message, false);
    }
}

// ============================================
// 🆕 VIDURIO LANGELIAI (CENTER)
// ============================================
let allCenterCells = [];

async function loadCenter() {
    try {
        const res = await fetch('/api/admin/center', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        allCenterCells = await res.json();
        renderCenter(allCenterCells);
    } catch (err) {
        showMsg('Klaida kraunant vidurio langelius: ' + err.message, false);
        document.getElementById('centerTable').innerHTML =
            '<tr><td colspan="21" style="text-align:center;color:red;">❌ Klaida: ' + err.message + '</td></tr>';
    }
}

function renderCenter(cells) {
    const tbody = document.getElementById('centerTable');
    tbody.innerHTML = '';

    if (!cells || cells.length === 0) {
        tbody.innerHTML = '<tr><td colspan="21" style="text-align:center;">Nėra langelių</td></tr>';
        return;
    }

    cells.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.cell_id}</strong></td>
            <td><input type="text" id="c-icon-${c.cell_id}" value="${(c.icon || '').replace(/"/g, '&quot;')}" maxlength="4" style="width:50px;text-align:center;"></td>
            <td><input type="text" id="c-title-${c.cell_id}" value="${(c.title || '').replace(/"/g, '&quot;')}"></td>
            <td><input type="color" id="c-title-color-${c.cell_id}" value="${c.title_color || '#3d2b1f'}"></td>
            <td><input type="number" id="c-title-size-${c.cell_id}" value="${c.title_size ?? 10}" style="width:50px;"></td>
            <td><input type="number" id="c-title-size-min-${c.cell_id}" value="${c.title_size_min ?? 8}" style="width:50px;"></td>
            <td><input type="number" id="c-title-size-max-${c.cell_id}" value="${c.title_size_max ?? 16}" style="width:50px;"></td>
            <td><input type="color" id="c-bg-${c.cell_id}" value="${c.bg_color || '#d4b896'}"></td>
            <td><input type="color" id="c-bg2-${c.cell_id}" value="${c.bg_color2 || '#c4a886'}"></td>
            <td><input type="color" id="c-border-${c.cell_id}" value="${c.border_color || '#b8966a'}"></td>
            <td><input type="color" id="c-font-${c.cell_id}" value="${c.font_color || '#3d2b1f'}"></td>
            <td><input type="number" id="c-font-size-${c.cell_id}" value="${c.font_size ?? 13}" style="width:50px;"></td>
            <td><input type="number" id="c-font-size-min-${c.cell_id}" value="${c.font_size_min ?? 10}" style="width:50px;"></td>
            <td><input type="number" id="c-font-size-max-${c.cell_id}" value="${c.font_size_max ?? 18}" style="width:50px;"></td>
            <td><input type="number" id="c-myinfo-name-size-${c.cell_id}" value="${c.myinfo_name_size ?? 18}" style="width:50px;"></td>
            <td><input type="color" id="c-myinfo-name-color-${c.cell_id}" value="${c.myinfo_name_color || '#3d2b1f'}"></td>
            <td><input type="number" id="c-myinfo-money-size-${c.cell_id}" value="${c.myinfo_money_size ?? 34}" style="width:50px;"></td>
            <td><input type="color" id="c-myinfo-money-color-${c.cell_id}" value="${c.myinfo_money_color || '#000000'}"></td>
            <td><input type="number" id="c-myinfo-text-size-${c.cell_id}" value="${c.myinfo_text_size ?? 13}" style="width:50px;"></td>
            <td><input type="color" id="c-myinfo-text-color-${c.cell_id}" value="${c.myinfo_text_color || '#3d2b1f'}"></td>
            <td><button onclick="saveCenter(${c.cell_id})">💾</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveCenter(cellId) {
    const data = {
        icon: document.getElementById('c-icon-' + cellId).value,
        title: document.getElementById('c-title-' + cellId).value,
        title_color: document.getElementById('c-title-color-' + cellId).value,
        title_size: parseInt(document.getElementById('c-title-size-' + cellId).value) || 10,
        title_size_min: parseInt(document.getElementById('c-title-size-min-' + cellId).value) || 8,
        title_size_max: parseInt(document.getElementById('c-title-size-max-' + cellId).value) || 16,
        bg_color: document.getElementById('c-bg-' + cellId).value,
        bg_color2: document.getElementById('c-bg2-' + cellId).value,
        border_color: document.getElementById('c-border-' + cellId).value,
        font_color: document.getElementById('c-font-' + cellId).value,
        font_size: parseInt(document.getElementById('c-font-size-' + cellId).value) || 13,
        font_size_min: parseInt(document.getElementById('c-font-size-min-' + cellId).value) || 10,
        font_size_max: parseInt(document.getElementById('c-font-size-max-' + cellId).value) || 18,
        myinfo_name_size: parseInt(document.getElementById('c-myinfo-name-size-' + cellId).value) || 18,
        myinfo_name_color: document.getElementById('c-myinfo-name-color-' + cellId).value,
        myinfo_money_size: parseInt(document.getElementById('c-myinfo-money-size-' + cellId).value) || 34,
        myinfo_money_color: document.getElementById('c-myinfo-money-color-' + cellId).value,
        myinfo_text_size: parseInt(document.getElementById('c-myinfo-text-size-' + cellId).value) || 13,
        myinfo_text_color: document.getElementById('c-myinfo-text-color-' + cellId).value,
        custom_data: null
    };

    try {
        const res = await fetch('/api/admin/center/' + cellId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        showMsg(`✅ Vidurio langelis ${cellId} išsaugotas!`, true);
        loadCenter();
    } catch (err) {
        showMsg('Klaida: ' + err.message, false);
    }
}

// ============================================
// LENTA
// ============================================
async function loadBoard() {
    try {
        const res = await fetch('/api/admin/board', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        allBoardCells = await res.json();
        renderBoard(allBoardCells);
    } catch (err) {
        showMsg('Klaida kraunant lentą: ' + err.message, false);
        document.getElementById('boardTable').innerHTML =
    '<tr><td colspan="10" style="text-align:center;color:red;">❌ Klaida: ' + err.message + '</td></tr>';
    }
}

function renderBoard(cells) {
    const tbody = document.getElementById('boardTable');
    tbody.innerHTML = '';

    if (!cells || cells.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Nėra langelių</td></tr>';
        return;
    }

    cells.forEach(c => {
        const tr = document.createElement('tr');
        const colorValue = c.color || '#000000';
        const color2Value = c.color2 || '#000000';
        const badge = c._hasOverride
            ? '<span class="badge badge-override">REDAGUOTA</span>'
            : '<span class="badge badge-default">DEFAULT</span>';

        tr.innerHTML = `
            <td><strong>${c.id}</strong><br>${badge}</td>
            <td><input type="color" id="color-${c.id}" value="${colorValue}"></td>
            <td><input type="color" id="color2-${c.id}" value="${color2Value}"></td>
            <td>
                <input type="text" id="name-${c.id}" value="${(c.name || '').replace(/"/g, '&quot;')}">
            </td>
            <td>
                <select id="type-${c.id}">
                    <option value="property" ${c.type === 'property' ? 'selected' : ''}>property</option>
                    <option value="tax" ${c.type === 'tax' ? 'selected' : ''}>tax</option>
                    <option value="special" ${c.type === 'special' ? 'selected' : ''}>special</option>
                    <option value="service1" ${c.type === 'service1' ? 'selected' : ''}>service1</option>
                    <option value="service2" ${c.type === 'service2' ? 'selected' : ''}>service2</option>
                    <option value="service3" ${c.type === 'service3' ? 'selected' : ''}>service3</option>
                    <option value="start" ${c.type === 'start' ? 'selected' : ''}>start</option>
                    <option value="jail" ${c.type === 'jail' ? 'selected' : ''}>jail</option>
                    <option value="parking" ${c.type === 'parking' ? 'selected' : ''}>parking</option>
                    <option value="go-to-jail" ${c.type === 'go-to-jail' ? 'selected' : ''}>go-to-jail</option>
                </select>
            </td>
            <td><input type="number" id="cost-${c.id}" value="${c.cost ?? 0}" style="width:70px;"></td>
            <td><input type="text" id="icon-${c.id}" value="${(c.icon || '').replace(/"/g, '&quot;')}" maxlength="4" style="width:50px;text-align:center;"></td>
            <td><input type="text" id="music-${c.id}" value="${c.music || ''}" placeholder=".mp3" style="width:110px;"></td>
            <td><input type="number" id="fontsize-${c.id}" value="${c.font_size ?? 14}" style="width:60px;"></td>
            <td>
                <button onclick="saveCell(${c.id})">💾</button>
                ${c._hasOverride ? `<button class="danger" onclick="deleteOverride(${c.id})">🗑️</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterBoard() {
    const textFilter = document.getElementById('boardFilter').value.toLowerCase();
    const typeFilter = document.getElementById('boardTypeFilter').value;
    const filtered = allBoardCells.filter(c => {
        const matchText = !textFilter || (c.name || '').toLowerCase().includes(textFilter);
        const matchType = !typeFilter || c.type === typeFilter;
        return matchText && matchType;
    });

    renderBoard(filtered);
}

async function saveCell(cellIndex) {
    const data = {
        name: document.getElementById('name-' + cellIndex).value,
        type: document.getElementById('type-' + cellIndex).value,
        color: document.getElementById('color-' + cellIndex).value,
        color2: document.getElementById('color2-' + cellIndex).value,
        cost: parseInt(document.getElementById('cost-' + cellIndex).value) || 0,
        icon: document.getElementById('icon-' + cellIndex).value,
        music: document.getElementById('music-' + cellIndex).value || null,
        font_size: parseInt(document.getElementById('fontsize-' + cellIndex).value) || 14,
        font_color: null,
        description: null,
        custom_data: null
    };

    try {
        const res = await fetch('/api/admin/board/' + cellIndex, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        showMsg(`✅ Langelis ${cellIndex} išsaugotas!`, true);
        loadBoard();
    } catch (err) {
        showMsg('Klaida: ' + err.message, false);
    }
}

async function deleteOverride(cellIndex) {
    if (!confirm(`Ar tikrai grąžinti langelį ${cellIndex} į default?`)) return;

    try {
        const res = await fetch('/api/admin/board/' + cellIndex, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        showMsg(`🗑️ Langelis ${cellIndex} grąžintas į default`, true);
        loadBoard();
    } catch (err) {
        showMsg('Klaida: ' + err.message, false);
    }
}

// ============================================
// 🆕 GARSO NUSTATYMAI
// ============================================

async function loadSoundSettings() {
    try {
        const res = await fetch('/api/admin/sounds', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const settings = await res.json();
        
        // Užpildyti UI
        const enabledEl = document.getElementById('soundPlayerControlEnabled');
        if (enabledEl) enabledEl.checked = settings.player_control_enabled === true;
        
        const modeEl = document.getElementById('soundDefaultMode');
        if (modeEl) modeEl.value = settings.default_mode || 'my';
        
        const sfxEl = document.getElementById('soundDefaultSfxVolume');
        if (sfxEl) {
            sfxEl.value = settings.default_sfx_volume || 50;
            const valueEl = document.getElementById('soundSfxValue');
            if (valueEl) valueEl.textContent = settings.default_sfx_volume || 50;
        }
        
        console.log('✅ Garso nustatymai įkelti:', settings);
    } catch (err) {
        console.error('❌ Garso nustatymų klaida:', err);
        showMsg('Klaida kraunant garso nustatymus: ' + err.message, false);
    }
}

async function saveSoundSettings() {
    try {
        const enabledEl = document.getElementById('soundPlayerControlEnabled');
        const modeEl = document.getElementById('soundDefaultMode');
        const sfxEl = document.getElementById('soundDefaultSfxVolume');
        
        const data = {
            player_control_enabled: enabledEl ? enabledEl.checked : true,
            default_mode: modeEl ? modeEl.value : 'my',
            default_sfx_volume: sfxEl ? parseInt(sfxEl.value) : 50,
            default_sound_levels: {}
        };
        
        const res = await fetch('/api/admin/sounds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        showMsg('✅ Garso nustatymai išsaugoti!', true);
        console.log('✅ Garso nustatymai išsaugoti:', data);
    } catch (err) {
        console.error('❌ Garso išsaugojimo klaida:', err);
        showMsg('Klaida: ' + err.message, false);
    }
}

// ============================================
// 🆕 GARSO FAILAI   ← NAUJA!
// ============================================

let allSoundFiles = [];
let allSoundFilesList = [];   // 🆕 Visi .mp3 failai iš sounds/ katalogo

async function loadSoundFiles() {
    try {
        // 🆕 Gauti visų .mp3 failų sąrašą
        try {
            const soundsRes = await fetch('/api/admin/sounds-list', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (soundsRes.ok) {
                allSoundFilesList = await soundsRes.json();
                console.log('📁 Garso failų sąrašas:', allSoundFilesList.length, 'failai');
            }
        } catch (err) {
            console.warn('⚠️ Nepavyko gauti garso failų sąrašo:', err);
        }
        
        // Gauti garso failų priskyrimus iš DB
        const res = await fetch('/api/admin/sound-files', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        allSoundFiles = await res.json();
        renderSoundFiles(allSoundFiles);
    } catch (err) {
        console.error('❌ Garso failų klaida:', err);
        showMsg('Klaida kraunant garso failus: ' + err.message, false);
        document.getElementById('soundFilesTable').innerHTML =
            '<tr><td colspan="5" style="text-align:center;color:red;">❌ Klaida: ' + err.message + '</td></tr>';
    }
}

function renderSoundFiles(files) {
    const tbody = document.getElementById('soundFilesTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!files || files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nėra garso failų</td></tr>';
        return;
    }
    
    files.forEach(f => {
        const tr = document.createElement('tr');
        
        // 🆕 Select su visais garso failais
        let selectHtml = `<select id="file-${f.sound_name}" 
                                  onchange="playSoundFile(this.value)"
                                  style="width:100%; padding:4px; font-size:12px; background:#0f3460; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer;">`;
        
        allSoundFilesList.forEach(soundFile => {
            const selected = (soundFile === f.file_path) ? 'selected' : '';
            selectHtml += `<option value="${soundFile}" ${selected}>${soundFile}</option>`;
        });
        
        // Jei esamas kelias nėra sąraše – pridėti jį
        if (!allSoundFilesList.includes(f.file_path)) {
            selectHtml += `<option value="${f.file_path}" selected>${f.file_path} (nėra kataloge)</option>`;
        }
        
        selectHtml += `</select>`;
        
        tr.innerHTML = `
            <td>${f.description || f.sound_name}</td>
            <td><code style="font-size:11px; background:rgba(0,0,0,0.2); padding:2px 4px; border-radius:3px;">${f.sound_name}</code></td>
            <td>${selectHtml}</td>
            <td style="text-align:center;">
                <button onclick="playSoundFile(document.getElementById('file-${f.sound_name}').value)" title="Klausytis" style="padding:4px 8px;">🔊</button>
            </td>
            <td style="text-align:center;">
                <button onclick="saveSoundFile('${f.sound_name}')" title="Išsaugoti" style="padding:4px 8px;">💾</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function playSoundFile(filePath) {
    if (!filePath) return;
    try {
        const audio = new Audio(filePath);
        audio.volume = 0.5;
        audio.play().catch(err => {
            console.warn('⚠️ Nepavyko paleisti garso:', err);
            showMsg('❌ Nepavyko paleisti: ' + filePath, false);
        });
    } catch (err) {
        showMsg('❌ Klaida: ' + err.message, false);
    }
}

async function saveSoundFile(soundName) {
    const selectEl = document.getElementById('file-' + soundName);
    if (!selectEl) {
        showMsg('❌ Nerastas elementas!', false);
        return;
    }
    
    const filePath = selectEl.value;
    
    if (!filePath) {
        showMsg('❌ Pasirink garso failą!', false);
        return;
    }
    
    console.log(`💾 Saugoma: ${soundName} → ${filePath}`);
    
    try {
        const res = await fetch('/api/admin/sound-files/' + soundName, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ file_path: filePath })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        const result = await res.json();
        console.log(`✅ Išsaugota:`, result);
        
        showMsg(`✅ ${soundName} → ${filePath}`, true);
        
        // 🆕 Perkrauti lentelę, kad atsinaujintų
        setTimeout(() => {
            loadSoundFiles();
        }, 500);
    } catch (err) {
        console.error('❌ Klaida:', err);
        showMsg('Klaida: ' + err.message, false);
    }
}

// ============================================
// PALEISTI
// ============================================
loadUsers();
