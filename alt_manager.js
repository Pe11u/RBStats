let alts = [];
let trash = [];
let selectedAltIds = new Set();
let selectedTrashIds = new Set();

const sleep = ms => new Promise(r => setTimeout(r, ms));

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderAlts();

    document.getElementById('nav-add-btn').addEventListener('click', () => {
        document.getElementById('add-account-panel').classList.toggle('hidden');
    });

    document.getElementById('cancel-add-btn').addEventListener('click', () => {
        document.getElementById('add-account-panel').classList.add('hidden');
    });

    document.getElementById('save-account-btn').addEventListener('click', handleAddAccount);

    document.getElementById('add-multiple-btn').addEventListener('click', () => {
        document.getElementById('bulk-add-modal').classList.remove('hidden');
    });

    document.getElementById('close-bulk-add-btn').addEventListener('click', () => {
        document.getElementById('bulk-add-modal').classList.add('hidden');
    });

    document.getElementById('start-bulk-add-btn').addEventListener('click', handleBulkAdd);

    document.getElementById('nav-trash-btn').addEventListener('click', () => {
        document.getElementById('trash-modal').classList.remove('hidden');
        renderTrash();
    });

    document.getElementById('close-trash-btn').addEventListener('click', () => {
        document.getElementById('trash-modal').classList.add('hidden');
    });

    document.getElementById('select-all-cb').addEventListener('change', (e) => {
        if (e.target.checked) {
            alts.forEach(a => selectedAltIds.add(String(a.id)));
        } else {
            selectedAltIds.clear();
        }
        renderAlts();
    });

    document.getElementById('trash-select-all-cb').addEventListener('change', (e) => {
        if (e.target.checked) {
            trash.forEach(a => selectedTrashIds.add(String(a.id)));
        } else {
            selectedTrashIds.clear();
        }
        renderTrash();
    });

    document.getElementById('filter-condition').addEventListener('change', (e) => {
        const val2 = document.getElementById('filter-value-2');
        if (e.target.value === 'between' || e.target.value === 'outside') {
            val2.classList.remove('hidden');
        } else {
            val2.classList.add('hidden');
        }
    });

    document.getElementById('apply-filter-btn').addEventListener('click', () => applyFilter(false));
    document.getElementById('add-selection-btn').addEventListener('click', () => applyFilter(true));
    document.getElementById('remove-invalid-btn').addEventListener('click', removeInvalidTokens);
    document.getElementById('reverse-select-btn').addEventListener('click', reverseSelect);
    document.getElementById('bulk-check-btn').addEventListener('click', doBulkCheck);
    document.getElementById('pin-selected-btn').addEventListener('click', pinSelected);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);
    document.getElementById('restore-trash-btn').addEventListener('click', restoreSelected);
    document.getElementById('empty-trash-btn').addEventListener('click', emptyTrash);

    document.getElementById('accounts-list').addEventListener('click', (e) => {
        const item = e.target.closest('.account-item');
        if (!item) return;

        const id = item.dataset.id;

        const loginBtn = e.target.closest('.action-login-btn');
        if (loginBtn) {
            quickLogin(loginBtn.dataset.token);
            return;
        }

        const summaryBtn = e.target.closest('.action-summary-btn');
        if (summaryBtn) {
            generateSummaryWrapper(id, summaryBtn.dataset.token, summaryBtn);
            return;
        }

        if (selectedAltIds.has(id)) {
            selectedAltIds.delete(id);
            item.classList.remove('selected');
        } else {
            selectedAltIds.add(id);
            item.classList.add('selected');
        }
        updateSelectCount();
    });

    document.getElementById('trash-list').addEventListener('click', (e) => {
        const item = e.target.closest('.account-item');
        if (!item) return;

        const id = item.dataset.id;
        if (selectedTrashIds.has(id)) {
            selectedTrashIds.delete(id);
            item.classList.remove('selected');
        } else {
            selectedTrashIds.add(id);
            item.classList.add('selected');
        }
    });

});

async function loadData() {
    return new Promise(resolve => {
        chrome.storage.local.get(['rbstats_alts', 'rbstats_trash'], (result) => {
            alts = result.rbstats_alts || [];
            trash = result.rbstats_trash || [];
            resolve();
        });
    });
}

function saveData() {
    chrome.storage.local.set({ rbstats_alts: alts, rbstats_trash: trash });
}

function updateSelectCount() {
    document.getElementById('select-count').textContent = `${selectedAltIds.size} selected`;
}

async function handleAddAccount() {
    const usernameInput = document.getElementById('alt-username').value.trim();
    const passwordInput = document.getElementById('alt-password').value.trim();
    const tokenInput = document.getElementById('alt-token').value.trim();
    const statusDiv = document.getElementById('add-status');

    if (!tokenInput && (!usernameInput || !passwordInput)) {
        statusDiv.textContent = 'Please provide either a Token, or Username & Password.';
        statusDiv.style.color = 'var(--error)';
        return;
    }

    statusDiv.textContent = 'Authenticating...';
    statusDiv.style.color = 'var(--text-muted)';
    document.getElementById('save-account-btn').disabled = true;

    let finalToken = tokenInput;

    try {
        if (!finalToken) {
            finalToken = await attemptLogin(usernameInput, passwordInput);
        }

        let cleanToken = finalToken.includes('.ROBLOSECURITY=') ? finalToken.split('.ROBLOSECURITY=')[1].split(';')[0] : finalToken;
        cleanToken = cleanToken.trim().replace(/^"|"$/g, '');

        statusDiv.textContent = 'Fetching User Stats...';
        const stats = await fetchStatsForToken(cleanToken);

        if (!stats.valid) {
            throw new Error('Token is invalid or expired.');
        }

        if (alts.find(a => a.id === stats.id) || trash.find(a => a.id === stats.id)) {
            throw new Error('Account already registered.');
        }

        alts.push({
            id: stats.id,
            username: stats.username,
            avatarUrl: stats.avatarUrl,
            token: cleanToken,
            rap: stats.rap,
            robux: stats.robux,
            lastChecked: Date.now()
        });

        saveData();
        renderAlts();

        document.getElementById('alt-username').value = '';
        document.getElementById('alt-password').value = '';
        document.getElementById('alt-token').value = '';
        document.getElementById('add-account-panel').classList.add('hidden');
        statusDiv.textContent = 'Added successfully!';
        statusDiv.style.color = 'var(--success)';
        setTimeout(() => statusDiv.textContent = '', 3000);
    } catch (err) {
        statusDiv.textContent = err.message;
        statusDiv.style.color = 'var(--error)';
    } finally {
        document.getElementById('save-account-btn').disabled = false;
    }
}

async function handleBulkAdd() {
    const rawFormat = document.getElementById('bulk-format').value.trim();
    let accSep = document.getElementById('bulk-acc-sep').value;
    if (accSep === 'newline' || accSep.toLowerCase() === 'newline') accSep = '\n';
    const rawData = document.getElementById('bulk-data').value;
    if (!rawData.trim() || !rawFormat) return;
    let regexStr = '^' + rawFormat
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%user%/g, '(?<user>.*?)')
        .replace(/%pass%/g, '(?<pass>.*?)')
        .replace(/%token%/g, '(?<token>.*?)') + '$';
    let regex;
    try {
        regex = new RegExp(regexStr);
    } catch (e) {
        alert("Parse error. Check format.");
        return;
    }
    const accountsStr = rawData.split(accSep);
    const statusDiv = document.getElementById('bulk-status');
    const startBtn = document.getElementById('start-bulk-add-btn');
    startBtn.disabled = true;
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < accountsStr.length; i++) {
        const accStr = accountsStr[i].trim();
        if (!accStr) continue;
        statusDiv.textContent = `Processing ${i + 1}/${accountsStr.length}...`;
        statusDiv.style.color = 'var(--text-muted)';
        let user = '', pass = '', token = '';
        const match = accStr.match(regex);
        if (match && match.groups) {
            user = match.groups.user || '';
            pass = match.groups.pass || '';
            token = match.groups.token || '';
        } else {
            console.error(`Failed to parse line ${i + 1}: ${accStr} with format ${rawFormat} (regex pattern: ${regexStr})`);
            failCount++;
            continue;
        }
        try {
            let finalToken = token;
            if (!finalToken && user && pass) {
                finalToken = await attemptLogin(user, pass);
            }
            if (!finalToken) throw new Error("No token or credentials");
            let cleanToken = finalToken.includes('.ROBLOSECURITY=') ? finalToken.split('.ROBLOSECURITY=')[1].split(';')[0] : finalToken;
            cleanToken = cleanToken.trim().replace(/^"|"$/g, '');
            const stats = await fetchStatsForToken(cleanToken);
            if (!stats.valid) throw new Error("Invalid token");
            if (alts.find(a => a.id === stats.id) || trash.find(a => a.id === stats.id)) throw new Error("Already exists");
            alts.push({
                id: stats.id,
                username: stats.username,
                avatarUrl: stats.avatarUrl,
                token: cleanToken,
                rap: stats.rap,
                robux: stats.robux,
                lastChecked: Date.now()
            });
            successCount++;
        } catch (e) {
            console.error(`Error adding line ${i + 1}:`, e);
            failCount++;
        }
        saveData();
        renderAlts();
        await sleep(2000);
    }
    statusDiv.textContent = `Done! Added: ${successCount}, Failed: ${failCount}`;
    statusDiv.style.color = 'var(--success)';
    startBtn.disabled = false;
}

async function attemptLogin(username, password) {
    try {
        let csrfRes = await fetch('https://auth.roblox.com/v2/login', { method: 'POST' });
        let csrfToken = csrfRes.headers.get('x-csrf-token');

        let loginRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers: {
                'x-csrf-token': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ctype: "Username", cvalue: username, password: password })
        });

        if (loginRes.ok) {
            const newCookie = await chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
            if (newCookie) return newCookie.value;
            throw new Error('Login succeeded but token cookie was not found.');
        } else {
            const errBody = await loginRes.json();
            throw new Error(errBody.errors?.[0]?.message || 'Login failed. Captcha/2FA required? Please provide Token instead.');
        }
    } catch (e) {
        throw new Error(e.message || 'Network error during login attempt.');
    }
}

async function fetchStatsForToken(token) {
    const origCookie = await chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
    const originalToken = origCookie ? origCookie.value : null;

    try {
        await setRobloxCookie(token);
        let data = { rap: 0, robux: 0, id: null, username: null, avatarUrl: '', valid: false };

        const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include', cache: 'no-cache' });
        if (authRes.ok) {
            const authJson = await authRes.json();
            data.id = authJson.id;
            data.username = authJson.name;
            data.valid = true;

            const [thumbRes, rxRes] = await Promise.all([
                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${data.id}&size=150x150&format=Png&isCircular=false`),
                fetch(`https://economy.roblox.com/v1/users/${data.id}/currency`, { credentials: 'include', cache: 'no-cache' })
            ]);

            if (thumbRes.ok) data.avatarUrl = (await thumbRes.json()).data[0]?.imageUrl || '';
            if (rxRes.ok) data.robux = (await rxRes.json()).robux || 0;

            let rap = 0; let cursor = "";
            do {
                const url = `https://inventory.roblox.com/v1/users/${data.id}/assets/collectibles?limit=100&cursor=${cursor}`;
                const invRes = await fetch(url, { credentials: 'include' });
                if (!invRes.ok) break;
                const invJson = await invRes.json();
                invJson.data.forEach(i => rap += (i.recentAveragePrice || 0));
                cursor = invJson.nextPageCursor;
            } while (cursor);
            data.rap = rap;
        }
        return data;
    } finally {
        if (originalToken) await setRobloxCookie(originalToken);
        else await clearRobloxCookie();
    }
}

function setRobloxCookie(token) {
    return new Promise(resolve => {
        chrome.cookies.set({
            url: "https://www.roblox.com/",
            name: ".ROBLOSECURITY",
            value: token,
            domain: ".roblox.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: 'no_restriction',
            expirationDate: (new Date().getTime() / 1000) + 31536000
        }, resolve);
    });
}

function clearRobloxCookie() {
    return new Promise(resolve => {
        chrome.cookies.remove({ url: "https://www.roblox.com", name: ".ROBLOSECURITY" }, resolve);
    });
}

function renderAlts() {
    const list = document.getElementById('accounts-list');
    list.innerHTML = '';

    if (alts.length === 0) {
        list.innerHTML = '<div class="empty-state">No accounts added yet.</div>';
        updateSelectCount();
        return;
    }

    const sortedAlts = [...alts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
    });

    sortedAlts.forEach(alt => {
        const div = document.createElement('div');
        div.className = 'account-item' + (alt.isPinned ? ' pinned' : '') + (selectedAltIds.has(String(alt.id)) ? ' selected' : '');
        div.dataset.id = alt.id;
        div.innerHTML = `
            <img src="${alt.avatarUrl || 'icons/icon48.png'}" class="account-avatar">
            <div class="account-info">
                <div class="account-name">${alt.isPinned ? '📌 ' : ''}${alt.username}</div>
                <div class="account-stats">
                    <div class="stat-row"><span>RAP:</span> <span class="stat-val">${alt.rap.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Robux:</span> <span class="stat-val">${alt.robux.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Last Checked:</span> <span>${new Date(alt.lastChecked).toLocaleString()}</span></div>
                </div>
            </div>
            <div class="account-actions" style="min-width: 90px;">
                <div style="flex-grow:1"></div>
                <button class="login-sm-btn primary-btn action-login-btn" style="width:100%; margin-bottom:5px" data-token="${alt.token}">Login</button>
                <button class="login-sm-btn primary-btn action-summary-btn" style="width:100%; font-size:0.7rem; background: linear-gradient(135deg, #a855f7, #d946ef);" data-id="${alt.id}" data-token="${alt.token}">Summary</button>
            </div>
        `;
        list.appendChild(div);
    });
    updateSelectCount();
}

function renderTrash() {
    const list = document.getElementById('trash-list');
    list.innerHTML = '';

    if (trash.length === 0) {
        list.innerHTML = '<div class="empty-state">Trash is empty.</div>';
        return;
    }

    trash.forEach(alt => {
        const div = document.createElement('div');
        div.className = 'account-item' + (selectedTrashIds.has(String(alt.id)) ? ' selected' : '');
        div.dataset.id = alt.id;
        div.innerHTML = `
            <img src="${alt.avatarUrl || 'icons/icon48.png'}" class="account-avatar">
            <div class="account-info">
                <div class="account-name">${alt.username}</div>
            </div>
        `;
        list.appendChild(div);
    });
}

function applyFilter(isAddMode) {
    const target = document.getElementById('filter-target').value;
    const condition = document.getElementById('filter-condition').value;
    const v1 = parseFloat(document.getElementById('filter-value-1').value);
    const v2 = parseFloat(document.getElementById('filter-value-2').value);

    if (!isAddMode) {
        selectedAltIds.clear();
        document.getElementById('select-all-cb').checked = false;
    }

    alts.forEach(alt => {
        let val = target === 'rap' ? alt.rap : alt.robux;
        let match = false;

        if (!isNaN(v1)) {
            switch (condition) {
                case '>': match = val > v1; break;
                case '<': match = val < v1; break;
                case '>=': match = val >= v1; break;
                case '<=': match = val <= v1; break;
                case '==': match = val === v1; break;
                case 'between': match = !isNaN(v2) && val >= v1 && val <= v2; break;
                case 'outside': match = !isNaN(v2) && (val < v1 || val > v2); break;
            }
        }

        if (isAddMode) {
            if (match) selectedAltIds.add(String(alt.id));
        } else {
            if (match) selectedAltIds.add(String(alt.id));
            else selectedAltIds.delete(String(alt.id));
        }
    });

    renderAlts();
}

function reverseSelect() {
    alts.forEach(alt => {
        if (selectedAltIds.has(String(alt.id))) selectedAltIds.delete(String(alt.id));
        else selectedAltIds.add(String(alt.id));
    });
    renderAlts();
}

async function doBulkCheck() {
    if (selectedAltIds.size === 0) return alert('No accounts selected!');

    const btn = document.getElementById('bulk-check-btn');
    btn.disabled = true;
    let origText = btn.innerHTML;

    let checkedCount = 0;
    const arrayToCheck = Array.from(selectedAltIds);

    for (let id of arrayToCheck) {
        const altIndex = alts.findIndex(a => a.id == id);
        if (altIndex > -1) {
            btn.innerHTML = `<span>⏳</span> Checking ${++checkedCount}/${arrayToCheck.length}...`;

            let data = await fetchStatsForToken(alts[altIndex].token);
            if (data.valid) {
                alts[altIndex].username = data.username;
                alts[altIndex].avatarUrl = data.avatarUrl;
                alts[altIndex].rap = data.rap;
                alts[altIndex].robux = data.robux;
                alts[altIndex].lastChecked = Date.now();
            } else {
                alts[altIndex].username = "INVALID TOKEN";
                alts[altIndex].avatarUrl = 'icons/icon48.png';
            }
            saveData();
            renderAlts();

            if (checkedCount < arrayToCheck.length) {
                await sleep(2000);
            }
        }
    }

    btn.disabled = false;
    btn.innerHTML = origText;
    alert('Bulk Check Complete!');
}

function pinSelected() {
    if (selectedAltIds.size === 0) return;

    selectedAltIds.forEach(id => {
        const alt = alts.find(a => a.id == id);
        if (alt) {
            alt.isPinned = !alt.isPinned;
        }
    });

    saveData();
    renderAlts();
}

function deleteSelected() {
    if (selectedAltIds.size === 0) {
        alert("Please select at least one account to delete.");
        return;
    }
    if (!confirm(`Move ${selectedAltIds.size} accounts to Trash?`)) return;

    const remainingAlts = [];
    alts.forEach(alt => {
        if (selectedAltIds.has(String(alt.id))) {
            trash.push(alt);
        } else {
            remainingAlts.push(alt);
        }
    });
    alts = remainingAlts;

    selectedAltIds.clear();
    document.getElementById('select-all-cb').checked = false;
    saveData();
    renderAlts();
}

function removeInvalidTokens() {
    const invalidAlts = alts.filter(a => a.username === "INVALID TOKEN");
    if (invalidAlts.length === 0) {
        alert('No INVALID TOKEN accounts found.');
        return;
    }

    if (!confirm(`Move ${invalidAlts.length} INVALID TOKEN accounts directly to Trash?`)) return;

    const remainingAlts = [];
    alts.forEach(alt => {
        if (alt.username === "INVALID TOKEN") {
            trash.push(alt);
            selectedAltIds.delete(String(alt.id));
        } else {
            remainingAlts.push(alt);
        }
    });
    alts = remainingAlts;

    saveData();
    renderAlts();
}

function restoreSelected() {
    if (selectedTrashIds.size === 0) {
        alert("Please select at least one account to restore.");
        return;
    }

    const remainingTrash = [];
    trash.forEach(alt => {
        if (selectedTrashIds.has(String(alt.id))) {
            alts.push(alt);
        } else {
            remainingTrash.push(alt);
        }
    });
    trash = remainingTrash;

    selectedTrashIds.clear();
    document.getElementById('trash-select-all-cb').checked = false;
    saveData();
    renderTrash();
    renderAlts();
}

function emptyTrash() {
    if (trash.length === 0) return;
    if (confirm('Are you sure you want to permanently delete all accounts in the Trash? This cannot be undone.')) {
        trash = [];
        selectedTrashIds.clear();
        document.getElementById('trash-select-all-cb').checked = false;
        saveData();
        renderTrash();
    }
}

async function quickLogin(token) {
    if (confirm('Login to this account? This will replace your current Roblox session.')) {
        await setRobloxCookie(token);
        chrome.tabs.query({ url: "*://*.roblox.com/*" }, (tabs) => {
            tabs.forEach(tab => chrome.tabs.reload(tab.id));
        });
        alert('Status updated! Connected to alt account.');
    }
}

async function generateSummaryWrapper(id, token, sourceBtn) {
    const alt = alts.find(a => String(a.id) === String(id));
    if (!alt) return;

    let originalHtml = sourceBtn.innerHTML;
    sourceBtn.innerHTML = '⏳';
    sourceBtn.disabled = true;

    const origCookie = await chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
    const originalToken = origCookie ? origCookie.value : null;

    try {
        await setRobloxCookie(token);
        const fullData = await fetchFullUserData(id);
        await generateStatsImage(fullData);

        const canvas = document.getElementById('stats-canvas');
        const link = document.createElement('a');
        link.download = `RBStats_${fullData.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        alert("Failed to generate summary: " + err.message);
    } finally {
        if (originalToken) await setRobloxCookie(originalToken);
        else await clearRobloxCookie();

        sourceBtn.innerHTML = originalHtml;
        sourceBtn.disabled = false;
    }
}

async function getCsrfToken() {
    const response = await fetch('https://auth.roblox.com/v2/logout', { method: 'POST', credentials: 'include' });
    return response.headers.get('x-csrf-token');
}

async function fetchFullUserData(userId) {
    const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    const userJson = await userRes.json();
    const csrfToken = await getCsrfToken();

    let presenceJson = { lastOnlineTimestamps: [] };
    try {
        const presenceRes = await fetch(`https://presence.roblox.com/v1/presence/last-online`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            credentials: 'include',
            body: JSON.stringify({ userIds: [userId] })
        });
        if (presenceRes.ok) presenceJson = await presenceRes.json();
    } catch (e) { }

    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const thumbJson = await thumbRes.json();

    const invRes = await fetch(`https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`);
    const invJson = await invRes.json();

    let ageStatus = "No";
    try {
        const [ageRes, bracketRes] = await Promise.all([
            fetch(`https://accountsettings.roblox.com/v1/age-verification/status`, { credentials: 'include' }),
            fetch(`https://users.roblox.com/v1/users/${userId}/age-bracket`, { credentials: 'include' })
        ]);
        let isVerified = false;
        if (ageRes.ok) isVerified = (await ageRes.json()).isVerified;
        let bracket = "Unknown";
        if (bracketRes.ok) {
            const bJson = await bracketRes.json();
            if (bJson.ageBracket === 0) bracket = "<13";
            else if (bJson.ageBracket === 1) bracket = "13+";
            else if (bJson.ageBracket === 2) bracket = "17+";
        }
        ageStatus = isVerified ? `Verified (${bracket})` : `No (${bracket})`;
    } catch (e) { }

    let rapValue = 0; let limitedCount = 0; let offsaleCount = 0;
    try {
        let cursor = "";
        do {
            const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&cursor=${cursor}`;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) break;
            const json = await res.json();
            json.data.forEach(item => {
                rapValue += (item.recentAveragePrice || 0);
                limitedCount++;
            });
            cursor = json.nextPageCursor;
        } while (cursor);
    } catch (e) { }
    const rap = rapValue > 0 ? rapValue.toLocaleString() : "0";

    let robux = "N/A";
    try {
        const robuxRes = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { credentials: 'include' });
        if (robuxRes.ok) robux = (await robuxRes.json()).robux.toLocaleString();
    } catch (e) { }

    let emailVerified = false;
    try {
        const emailRes = await fetch(`https://accountsettings.roblox.com/v1/email`, { credentials: 'include' });
        if (emailRes.ok) emailVerified = (await emailRes.json()).verified;
    } catch (e) { }

    return {
        id: userId,
        name: userJson.name,
        displayName: userJson.displayName,
        description: userJson.description || "No description provided.",
        created: new Date(userJson.created).toLocaleDateString(),
        isVerified: userJson.hasVerifiedBadge,
        emailVerified,
        avatarUrl: thumbJson.data[0]?.imageUrl,
        presence: presenceJson.lastOnlineTimestamps[0]?.lastOnline,
        inventoryPublic: invJson.canView,
        rap,
        robux,
        limitedCount,
        offsaleCount,
        ageStatus
    };
}

async function generateStatsImage(user) {
    const canvas = document.getElementById('stats-canvas');
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 675;
    canvas.width = width;
    canvas.height = height;

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 200, 0, Math.PI * 2);
        ctx.fillStyle = '#8b5cf6';
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    drawRoundedRect(ctx, 50, 50, width - 100, height - 100, 30, 'rgba(30, 41, 59, 0.7)');
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (user.avatarUrl) {
        const avatarImg = await loadImage(user.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(220, 220, 120, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, 100, 100, 240, 240);
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Outfit, sans-serif';
    ctx.fillText(user.displayName, 420, 150);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '30px Inter, sans-serif';
    ctx.fillText(`@${user.name} | ID: ${user.id}`, 420, 200);

    if (user.isVerified) {
        ctx.fillStyle = '#0ea5e9';
        ctx.fillText('✓ Verified', 420, 245);
    }

    const startX = 420;
    const startY = 265;
    const colWidth = 350;
    const rowHeight = 85;

    const stats = [
        { label: 'TOTAL RAP', value: user.rap },
        { label: 'ROBUX BALANCE', value: user.robux },
        { label: 'LIMITED COUNT', value: user.limitedCount.toString() },
        { label: 'AGE VERIFIED', value: user.ageStatus },
        { label: 'EMAIL VERIFIED', value: user.emailVerified ? 'YES' : 'NO' },
        { label: 'CREATED', value: user.created },
        { label: 'INVENTORY', value: user.inventoryPublic ? 'PUBLIC' : 'PRIVATE' },
        { label: 'STATUS', value: (user.presence && (new Date() - new Date(user.presence)) / 1000 / 60 < 5) ? 'ONLINE' : 'OFFLINE' }
    ];

    stats.forEach((stat, i) => {
        const x = startX + (i % 2) * colWidth;
        const y = startY + Math.floor(i / 2) * rowHeight;
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText(stat.label, x, y);
        ctx.fillStyle = (stat.label === 'TOTAL RAP' || stat.label === 'ROBUX BALANCE') ? '#d946ef' : '#f8fafc';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.fillText(stat.value, x, y + 35);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'italic 18px Inter, sans-serif';
    const desc = user.description.length > 85 ? user.description.substring(0, 82) + '...' : user.description;
    ctx.fillText(`"${desc}"`, 420, 610);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '600 22px Outfit, sans-serif';
    ctx.fillText('RBStats - @t4ruta', 100, 610);
}

function drawRoundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}
