const ROBLOX_DOMAINS = ["https://www.roblox.com", "https://roblox.com", "https://web.roblox.com"];

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('login-section');
    const profileSection = document.getElementById('profile-section');
    const authStatus = document.getElementById('auth-status');
    const tokenInput = document.getElementById('token-input');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const generateBtn = document.getElementById('generate-image-btn');
    const previewSection = document.getElementById('preview-section');
    const closePreviewBtn = document.getElementById('close-preview');
    const downloadBtn = document.getElementById('download-btn');
    const copyTokenBtn = document.getElementById('copy-token-btn');
    const altManagerBtn = document.getElementById('global-alt-manager-btn');

    let currentUser = null;

    checkLoginStatus();

    async function reloadRobloxTabs() {
        chrome.tabs.query({ url: "*://*.roblox.com/*" }, (tabs) => {
            tabs.forEach(tab => chrome.tabs.reload(tab.id));
        });
    }

    if (altManagerBtn) {
        altManagerBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('alt_manager.html') });
        });
    }

    loginBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) return alert('Please enter a token.');

        const cleanToken = token.includes('.ROBLOSECURITY=') ?
            token.split('.ROBLOSECURITY=')[1].split(';')[0] : token;

        await setRobloxCookie(cleanToken);
        await reloadRobloxTabs();
        checkLoginStatus();
    });

    logoutBtn.addEventListener('click', async () => {
        await clearRobloxCookie();
        await reloadRobloxTabs();
        checkLoginStatus();
    });

    generateBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        showLoading(true);
        try {
            await generateStatsImage(currentUser);
            previewSection.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            alert('Failed to generate image: ' + err.message);
        } finally {
            showLoading(false);
        }
    });

    closePreviewBtn.addEventListener('click', () => {
        previewSection.classList.add('hidden');
    });

    downloadBtn.addEventListener('click', () => {
        const canvas = document.getElementById('stats-canvas');
        const link = document.createElement('a');
        link.download = `RBStats_${currentUser.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    copyTokenBtn.addEventListener('click', async () => {
        const cookie = await chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
        if (cookie) {
            navigator.clipboard.writeText(cookie.value);
            const originalText = copyTokenBtn.innerHTML;
            copyTokenBtn.innerHTML = '<span>✅</span> Copied!';
            setTimeout(() => copyTokenBtn.innerHTML = originalText, 2000);
        } else {
            alert('Cookie not found.');
        }
    });

    async function checkLoginStatus() {
        authStatus.textContent = 'Checking...';
        authStatus.className = 'status-badge';

        try {
            const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const cookie = await chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
                    throw new Error('Unauthorized');
                }
                throw new Error(`Network error: ${response.status}`);
            }

            const data = await response.json();
            authStatus.textContent = 'Active';
            authStatus.className = 'status-badge online';

            try {
                const fullUserData = await fetchFullUserData(data.id);
                currentUser = fullUserData;
                updateUI(fullUserData);
            } catch (detailErr) {
                updateBasicUI(data.id, data.name);
                alert('Partially logged in: Could not fetch stats.');
            }
        } catch (err) {
            currentUser = null;
            loginSection.classList.remove('hidden');
            profileSection.classList.add('hidden');
            if (copyTokenBtn) copyTokenBtn.classList.add('hidden');
            authStatus.textContent = 'Logged Out';
            authStatus.className = 'status-badge';
        }
    }

    async function getCsrfToken() {
        const response = await fetch('https://auth.roblox.com/v2/logout', {
            method: 'POST',
            credentials: 'include'
        });
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
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ userIds: [userId] })
            });
            if (presenceRes.ok) presenceJson = await presenceRes.json();
        } catch (e) {}

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
        } catch (e) {}

        let rapValue = 0;
        let limitedCount = 0;
        let offsaleCount = 0;
        try {
            const collectibles = await fetchUserCollectiblesData(userId);
            rapValue = collectibles.totalRAP;
            limitedCount = collectibles.count;
            offsaleCount = collectibles.offsaleCount;
        } catch (e) {}
        const rap = rapValue > 0 ? rapValue.toLocaleString() : "0";

        let robux = "N/A";
        try {
            const robuxRes = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { credentials: 'include' });
            if (robuxRes.ok) {
                const robuxJson = await robuxRes.json();
                robux = robuxJson.robux.toLocaleString();
            }
        } catch (e) {}

        let emailVerified = false;
        try {
            const emailRes = await fetch(`https://accountsettings.roblox.com/v1/email`, { credentials: 'include' });
            if (emailRes.ok) {
                const emailJson = await emailRes.json();
                emailVerified = emailJson.verified;
            }
        } catch (e) {}

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

    async function fetchUserCollectiblesData(userId) {
        let totalRAP = 0;
        let count = 0;
        let offsaleCount = 0;
        let cursor = "";
        try {
            do {
                const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&cursor=${cursor}`;
                const res = await fetch(url, { credentials: 'include' });
                if (!res.ok) break;
                const json = await res.json();
                json.data.forEach(item => {
                    totalRAP += (item.recentAveragePrice || 0);
                    count++;
                });
                cursor = json.nextPageCursor;
            } while (cursor);
        } catch (err) {}
        return { totalRAP, count, offsaleCount };
    }

    function updateUI(user) {
        loginSection.classList.add('hidden');
        profileSection.classList.remove('hidden');
        if (copyTokenBtn) copyTokenBtn.classList.remove('hidden');
        authStatus.textContent = 'Active';
        authStatus.className = 'status-badge online';
        document.getElementById('username').textContent = user.displayName;
        document.getElementById('user-id').textContent = `ID: ${user.id}`;
        document.getElementById('user-avatar').src = user.avatarUrl;
        document.getElementById('stat-rap').textContent = user.rap;

        const presenceDot = document.getElementById('user-presence');
        if (user.presence) {
            const lastSeen = new Date(user.presence);
            const now = new Date();
            const diffMinutes = (now - lastSeen) / 1000 / 60;
            if (diffMinutes < 5) {
                presenceDot.className = 'presence-indicator online';
            } else {
                presenceDot.className = 'presence-indicator offline';
            }
        } else {
            presenceDot.className = 'presence-indicator offline';
        }
    }

    function updateBasicUI(userId, username) {
        loginSection.classList.add('hidden');
        profileSection.classList.remove('hidden');
        if (copyTokenBtn) copyTokenBtn.classList.remove('hidden');
        document.getElementById('username').textContent = username;
        document.getElementById('user-id').textContent = `ID: ${userId}`;
        document.getElementById('stat-rap').textContent = "???";
    }

    async function setRobloxCookie(token) {
        let value = token;
        if (token.includes('.ROBLOSECURITY=')) {
            value = token.split('.ROBLOSECURITY=')[1].split(';')[0];
        }
        value = value.trim().replace(/^"|"$/g, '');
        return new Promise((resolve) => {
            chrome.cookies.set({
                url: "https://www.roblox.com/",
                name: ".ROBLOSECURITY",
                value: value,
                domain: ".roblox.com",
                path: "/",
                secure: true,
                httpOnly: true,
                sameSite: 'no_restriction',
                expirationDate: (new Date().getTime() / 1000) + 31536000
            }, resolve);
        });
    }

    async function clearRobloxCookie() {
        return new Promise((resolve) => {
            chrome.cookies.remove({
                url: "https://www.roblox.com",
                name: ".ROBLOSECURITY"
            }, resolve);
        });
    }

    function showLoading(show) {
        generateBtn.disabled = show;
        generateBtn.innerHTML = show ? '<span>⏳</span> Processing...' : '<span>🖼️</span> Generate Summary Image';
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

        const avatarImg = await loadImage(user.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(220, 220, 120, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, 100, 100, 240, 240);
        ctx.restore();

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
});
