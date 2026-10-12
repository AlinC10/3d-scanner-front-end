document.addEventListener('DOMContentLoaded', () => {

    // --- 1. BOOT SCREEN LOGIC ---
    const bootScreen = document.getElementById('boot-screen');
    const appWrapper = document.getElementById('app-wrapper');

    setTimeout(() => {
        bootScreen.style.opacity = '0';
        setTimeout(() => {
            bootScreen.style.display = 'none';
            appWrapper.style.opacity = '1';
            document.getElementById('main-menu').classList.add('active');
        }, 600); 
    }, 2000);

    // --- 2. SYSTEM CLOCK ---
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 3. THEME TOGGLE ---
    const btnTheme = document.getElementById('btn-theme');
    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        if(document.body.classList.contains('light-theme')) {
            btnTheme.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        } else {
            btnTheme.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        }
    });

    // --- 4. NAVIGATION ---
    function openSettingsTab(tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        const tabBtn = document.querySelector(`.sidebar-tab[data-tab-target="${tabId}"]`);
        if (tabBtn) tabBtn.classList.add('active');

        document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(tabId);
        if (pane) pane.classList.add('active');
    }

    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', function() { openSettingsTab(this.getAttribute('data-tab-target')); });
    });

    function navigateTo(targetId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) { void targetScreen.offsetWidth; targetScreen.classList.add('active'); }
        
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        if (['main-menu', 'pre-scan', 'scanning', 'scan-face', 'settings-screen'].includes(targetId)) {
            document.querySelector('.nav-tab[data-target="main-menu"]').classList.add('active');
        } else if (targetId === 'library') {
            document.querySelector('.nav-tab[data-target="library"]').classList.add('active');
        } else if (targetId === 'help-screen') {
            document.querySelector('.nav-tab[data-target="help-screen"]').classList.add('active');
        }

        const aiModal = document.getElementById('ai-modal');
        const btnFab = document.getElementById('btn-fab');
        if (aiModal && aiModal.classList.contains('show')) {
            aiModal.classList.remove('show');
            btnFab.style.display = 'flex';
        }
    }

    document.querySelectorAll('[data-action="nav"]').forEach(el => {
        el.addEventListener('click', function(e) { 
            e.stopPropagation();
            const targetScreen = this.getAttribute('data-target');
            const targetTab = this.getAttribute('data-tab');
            navigateTo(targetScreen);
            if (targetScreen === 'settings-screen' && targetTab) openSettingsTab(targetTab);
        });
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function(e) { e.stopPropagation(); navigateTo(this.getAttribute('data-target')); });
    });

    // --- 5. UI INTERACTIONS ---
    const slider = document.getElementById('rotation-slider');
    const sliderVal = document.getElementById('rotation-val');
    if (slider && sliderVal) {
        slider.addEventListener('input', function() { sliderVal.innerText = this.value + '°'; });
    }

    document.querySelectorAll('.toggle-switch:not([id])').forEach(toggle => {
        toggle.addEventListener('click', function() { this.classList.toggle('active'); });
    });

    document.querySelectorAll('.segment').forEach(segment => {
        segment.addEventListener('click', function() {
            const parent = this.parentElement;
            parent.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const aiModal = document.getElementById('ai-modal');
    const btnFab = document.getElementById('btn-fab');
    
    btnFab.addEventListener('click', () => {
        aiModal.classList.add('show');
        btnFab.style.display = 'none';
    });
    
    document.getElementById('close-ai').addEventListener('click', () => {
        aiModal.classList.remove('show');
        btnFab.style.display = 'flex'; 
    });

    // --- 6. SCANNING SIMULATOR ---
    let scanInterval;
    const bar = document.getElementById('scan-progress-fill');
    const pct = document.getElementById('scan-percent');
    const eta = document.getElementById('scan-eta');

    function startMockScan() {
        const turntableAngle = parseInt(document.getElementById('rotation-slider').value);
        navigateTo('scanning');
        let progress = 0;
        bar.style.width = '0%'; bar.style.backgroundColor = 'var(--accent)';
        pct.innerText = '0% COMPLETE'; eta.innerText = 'ETA: 45s';
        
        clearInterval(scanInterval);
        scanInterval = setInterval(() => {
            progress += Math.random() * 2.5 + 1;
            if (progress >= 100) {
                progress = 100; clearInterval(scanInterval);
                eta.innerText = "ETA: 0s - SCAN COMPLETE";
                bar.style.backgroundColor = "#10B981"; 
            } else {
                let secondsLeft = Math.floor((100 - progress) / 2);
                eta.innerText = `ETA: ${secondsLeft}s`;
            }
            bar.style.width = `${progress}%`; pct.innerText = `${Math.floor(progress)}% COMPLETE`;
        }, 600);
    }

    document.getElementById('btn-start-scan').addEventListener('click', startMockScan);
    document.getElementById('btn-start-face-scan').addEventListener('click', startMockScan);
    document.getElementById('btn-cancel-scan').addEventListener('click', async () => {
        clearInterval(scanInterval); navigateTo('main-menu');
        try { await fetch('http://127.0.0.1:8000/scanner/cancel', { method: 'POST' }); } catch(e){}
    });

    // --- 7. WIFI / BT / ETHERNET MODALS ---
    const overlay = document.getElementById('modal-overlay');
    const API_URL = 'http://127.0.0.1:8000';
    
    let wifiScanInterval = null;
    let currentConnectedSSID = null;

    let isWifiPowerOn = true;
    let isBtPowerOn = true;

    const autoScanToggle = document.getElementById('auto-scan-wifi');
    const btnRefreshWifi = document.getElementById('btn-refresh-wifi');
    const btnRefreshBt = document.getElementById('btn-refresh-bt');
    const toggleWifiPower = document.getElementById('toggle-wifi-power');
    const toggleBtPower = document.getElementById('toggle-bt-power');

    // Ethernet Polling
    setInterval(async () => {
        const iconEthernet = document.getElementById('icon-ethernet');
        const iconWifi = document.querySelector('[data-modal="wifi-modal"]');
        
        try {
            const res = await fetch(`${API_URL}/system/ethernet/status`);
            if (res.ok) {
                // Cablul este conectat: Arătăm Ethernet, Ascundem Wi-Fi
                iconEthernet.style.display = 'block'; 
                if (iconWifi) iconWifi.style.display = 'none';
            } else {
                // Nu este cablu: Ascundem Ethernet, Arătăm Wi-Fi
                iconEthernet.style.display = 'none';
                if (iconWifi) iconWifi.style.display = 'block';
            }
        } catch(e) {
            // Dacă pică backend-ul, revenim la starea implicită (fără cablu)
            iconEthernet.style.display = 'none';
            if (iconWifi) iconWifi.style.display = 'block';
        }
    }, 5000);

    const loadingSVG = `<svg viewBox="0 0 24 24" class="spinner" style="width: 32px; height: 32px;"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" fill="none" stroke-linecap="round"></circle></svg>`;

    function renderDisabledState(containerId, title, desc) {
        document.getElementById(containerId).innerHTML = `
            <div style="padding: 40px 10px; text-align: left;">
                <h2 style="margin-bottom: 12px; font-size: 1.3rem;">${title}</h2>
                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;">${desc}</p>
            </div>
        `;
    }

    toggleWifiPower.addEventListener('click', async function() {
        isWifiPowerOn = !isWifiPowerOn;
        if(isWifiPowerOn) {
            this.classList.add('active');
            loadWiFiNetworks();
            if(autoScanToggle.checked) startAutoScan();
        } else {
            this.classList.remove('active');
            stopAutoScan();
            renderDisabledState('wifi-list', 'Wi-Fi dezactivat', 'Conectați-vă la rețelele din apropiere activând Wi-Fi cu comutatorul de mai sus.');
        }
        try { await fetch(`${API_URL}/system/wifi/power/${isWifiPowerOn ? 'on' : 'off'}`); } catch(e){}
    });

    toggleBtPower.addEventListener('click', async function() {
        isBtPowerOn = !isBtPowerOn;
        if(isBtPowerOn) {
            this.classList.add('active');
            loadBluetoothDevices();
        } else {
            this.classList.remove('active');
            renderDisabledState('bt-list', 'Bluetooth dezactivat', 'Conectați-vă la dispozitivele Bluetooth din apropiere activând Bluetooth cu comutatorul de mai sus.');
        }
        try { await fetch(`${API_URL}/system/bluetooth/power/${isBtPowerOn ? 'on' : 'off'}`); } catch(e){}
    });

    function startAutoScan() {
        if(autoScanToggle.checked && isWifiPowerOn) {
            wifiScanInterval = setInterval(loadWiFiNetworks, 10000);
        }
    }
    
    function stopAutoScan() {
        if(wifiScanInterval) clearInterval(wifiScanInterval);
    }

    autoScanToggle.addEventListener('change', (e) => {
        if(e.target.checked) startAutoScan();
        else stopAutoScan();
    });

    btnRefreshWifi.addEventListener('click', () => {
        if(!isWifiPowerOn) return;
        btnRefreshWifi.style.opacity = '0.5';
        loadWiFiNetworks().then(() => btnRefreshWifi.style.opacity = '1');
    });

    btnRefreshBt.addEventListener('click', () => {
        if(!isBtPowerOn) return;
        btnRefreshBt.style.opacity = '0.5';
        loadBluetoothDevices().then(() => btnRefreshBt.style.opacity = '1');
    });

    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            overlay.classList.add('show');
            document.getElementById(modalId).classList.add('show');
            
            if(modalId === 'wifi-modal' && isWifiPowerOn) {
                loadWiFiNetworks();
                startAutoScan();
            } else if(modalId === 'bt-modal' && isBtPowerOn) {
                loadBluetoothDevices();
            }
        });
    });

    function closeAllModals() {
        overlay.classList.remove('show');
        document.querySelectorAll('.os-modal').forEach(m => m.classList.remove('show'));
        stopAutoScan();
    }
    
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeAllModals));
    overlay.addEventListener('click', closeAllModals);

    async function loadWiFiNetworks() {
        if(!isWifiPowerOn) return;
        const listContainer = document.getElementById('wifi-list');
        if (!listContainer.innerHTML.includes('list-item')) listContainer.innerHTML = loadingSVG;
        
        try {
            const response = await fetch(`${API_URL}/system/wifi/scan`);
            let networks = [];
            
            if (!response.ok) {
                console.warn("Backend WiFi scan failed. Using UI mock data.");
                networks = [
                    { ssid: "Scancore_Test_Net", signal: 95, security: "WPA2" },
                    { ssid: "Home_WiFi", signal: 70, security: "WPA2" },
                    { ssid: "Guest_Open", signal: 45, security: "open" }
                ];
            } else {
                networks = await response.json();
            }

            listContainer.innerHTML = ''; 
            if(networks.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No networks found.</div>';
                return;
            }

            networks.forEach((net) => {
                const isSecure = net.security && net.security !== "open"; 
                const isConnected = (net.ssid === currentConnectedSSID) || (net.connected === true); 
                
                const securityIcon = isSecure ? '<svg viewBox="0 0 24 24" style="width:16px;height:16px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></path><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : '';
                
                const item = document.createElement('div');
                item.className = `list-item ${isConnected ? 'active' : ''}`;
                if (isConnected) item.style.borderColor = 'var(--accent)';

                item.innerHTML = `
                    <div class="list-info">
                        <span style="${isConnected ? 'color: var(--accent);' : ''}">${net.ssid}</span>
                        <small>Signal: ${net.signal}% | ${isSecure ? 'Secure' : 'Open'}</small>
                    </div>
                    ${isConnected ? '<svg class="connected-icon" viewBox="0 0 24 24" style="color:var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>' : securityIcon}
                `;
                item.addEventListener('click', () => connectToWiFi(item, net.ssid, isSecure));
                listContainer.appendChild(item);
            });
        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">Eroare de conexiune cu API-ul.</div>`;
        }
    }

    async function connectToWiFi(element, ssid, isSecure) {
        if(!isWifiPowerOn) return;
        let password = '';
        if (isSecure) {
            password = prompt(`Enter password for ${ssid}:`); 
            if (password === null) return; 
        }

        const parent = element.parentElement;
        parent.querySelectorAll('.list-item').forEach(el => {
            el.classList.remove('active');
            el.style.borderColor = '';
            const span = el.querySelector('span');
            if(span) span.style.color = '';
            const checkIcon = el.querySelector('.connected-icon');
            if(checkIcon) checkIcon.remove();
            
            if(!el.innerHTML.includes('<svg') && !el.innerHTML.includes('Open')) {
                 el.innerHTML += '<svg viewBox="0 0 24 24" style="width:16px;height:16px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
            }
        });

        const smallText = element.querySelector('small');
        smallText.innerText = 'Connecting...';
        element.classList.add('active');
        element.style.borderColor = 'var(--accent)';

        try {
            const response = await fetch(`${API_URL}/system/wifi/connect`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssid: ssid, password: password })
            });
            
            if(response.ok) {
                smallText.innerText = 'Connected';
                element.querySelector('span').style.color = 'var(--accent)';
                element.innerHTML += '<svg class="connected-icon" viewBox="0 0 24 24" style="color:var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                currentConnectedSSID = ssid;
            } else {
                smallText.innerText = 'Connection Failed';
                element.classList.remove('active'); element.style.borderColor = '';
            }
        } catch (e) {
            smallText.innerText = 'Error talking to OS';
            element.classList.remove('active'); element.style.borderColor = '';
        }
    }

    async function loadBluetoothDevices() {
        if(!isBtPowerOn) return;
        const listContainer = document.getElementById('bt-list');
        if (!listContainer.innerHTML.includes('list-item')) listContainer.innerHTML = loadingSVG;
        
        try {
            const response = await fetch(`${API_URL}/system/bluetooth/scan`);
            let devices = [];

            if (!response.ok) {
                console.warn("Backend BT scan failed. Using UI mock data.");
                devices = [
                    { name: "iPhone 15 Pro", mac_address: "AA:BB:CC:DD:EE:11", status: "Found" },
                    { name: "Scancore Remote", mac_address: "11:22:33:44:55:66", status: "Paired" }
                ];
            } else {
                devices = await response.json();
            }

            listContainer.innerHTML = '';
            if(devices.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No devices found.</div>';
                return;
            }
            
            devices.forEach(dev => {
                const item = document.createElement('div');
                item.className = 'list-item';
                if(dev.status === "Paired") item.classList.add('active');
                
                const connectedIcon = dev.status === "Paired" ? '<svg viewBox="0 0 24 24" style="color:var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '';

                item.innerHTML = `
                    <div class="list-info">
                        <span>${dev.name || dev.mac_address}</span>
                        <small>${dev.status || 'Found'} | ${dev.mac_address}</small>
                    </div>
                    ${connectedIcon}
                `;
                
                item.addEventListener('click', async () => {
                    try {
                        item.querySelector('small').innerText = "Pairing...";
                        const res = await fetch(`${API_URL}/system/bluetooth/connect`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mac_address: dev.mac_address })
                        });
                        setTimeout(() => { item.querySelector('small').innerText = "Paired"; }, 1000);
                    } catch(e) {}
                });

                listContainer.appendChild(item);
            });
        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">Eroare de conexiune cu API-ul.</div>`;
        }
    }

    // --- 8. AI CHAT LOGIC ---
    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');
    const aiChatHistory = document.getElementById('ai-chat-history');
    let aiConversationHistory = []; 
    let msgCounter = 0; 

    async function sendAiMessage() {
        const text = aiInput.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        aiInput.value = '';
        
        const loadingId = appendChatMessage('ai', 'Thinking...');

        try {
            const response = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: text, history: aiConversationHistory })
            });
            
            const data = await response.json();
            
            document.getElementById(loadingId).remove();
            appendChatMessage('ai', data.response);

            aiConversationHistory.push({ role: 'user', text: text });
            aiConversationHistory.push({ role: 'assistant', text: data.response });
            if(aiConversationHistory.length > 10) aiConversationHistory = aiConversationHistory.slice(-10);

        } catch (error) {
            document.getElementById(loadingId).remove();
            appendChatMessage('error', 'Connection to AI Server failed.');
        }
    }

    function appendChatMessage(sender, text) {
        const msgDiv = document.createElement('div');
        const msgId = 'msg-' + Date.now() + '-' + (msgCounter++);
        msgDiv.id = msgId;
        
        msgDiv.className = 'ai-message'; 
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.alignSelf = sender === 'user' ? 'flex-end' : (sender === 'ai' ? 'flex-start' : 'center');
        
        if (sender === 'user') {
            msgDiv.style.background = 'var(--accent)';
            msgDiv.style.color = 'var(--bg-primary)';
            msgDiv.style.borderLeft = 'none';
        } else if (sender === 'error') {
            msgDiv.style.background = '#ef4444'; 
            msgDiv.style.color = 'white';
            msgDiv.style.borderLeft = 'none';
        }

        msgDiv.innerText = text;
        aiChatHistory.appendChild(msgDiv);
        aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
        return msgId;
    }

    aiSendBtn.addEventListener('click', sendAiMessage);
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAiMessage();
    });

});