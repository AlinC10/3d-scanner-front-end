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

    // --- 3. THEME TOGGLE (Dark / Light) ---
    const btnTheme = document.getElementById('btn-theme');
    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        if(document.body.classList.contains('light-theme')) {
            btnTheme.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        } else {
            btnTheme.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        }
    });

    // --- 4. NAVIGATION (SPA Logic) & SETTINGS TABS ---
    function openSettingsTab(tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        const tabBtn = document.querySelector(`.sidebar-tab[data-tab-target="${tabId}"]`);
        if (tabBtn) tabBtn.classList.add('active');

        document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(tabId);
        if (pane) pane.classList.add('active');
    }

    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            openSettingsTab(this.getAttribute('data-tab-target'));
        });
    });

    function navigateTo(targetId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) {
            void targetScreen.offsetWidth; 
            targetScreen.classList.add('active');
        }
        
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        if (['main-menu', 'pre-scan', 'scanning', 'scan-face', 'settings-screen'].includes(targetId)) {
            document.querySelector('.nav-tab[data-target="main-menu"]').classList.add('active');
        } else if (targetId === 'library') {
            document.querySelector('.nav-tab[data-target="library"]').classList.add('active');
        } else if (targetId === 'help-screen') {
            document.querySelector('.nav-tab[data-target="help-screen"]').classList.add('active');
        }

        // Ascunde chat-ul AI la schimbarea paginii
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
            if (targetScreen === 'settings-screen' && targetTab) {
                openSettingsTab(targetTab);
            }
        });
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function(e) { 
            e.stopPropagation();
            navigateTo(this.getAttribute('data-target')); 
        });
    });

    // --- 5. UI INTERACTIONS ---
    const slider = document.getElementById('rotation-slider');
    const sliderVal = document.getElementById('rotation-val');
    if (slider && sliderVal) {
        slider.addEventListener('input', function() { sliderVal.innerText = this.value + '°'; });
    }

    document.querySelectorAll('.toggle-switch').forEach(toggle => {
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

    // --- 6. SCANNING SIMULATOR & HARDWARE PARAMS ---
    let scanInterval;
    const bar = document.getElementById('scan-progress-fill');
    const pct = document.getElementById('scan-percent');
    const eta = document.getElementById('scan-eta');

    function startMockScan() {
        const turntableAngle = parseInt(document.getElementById('rotation-slider').value);
        console.log("-> Starting scan with Turntable Angle:", turntableAngle, "degrees");

        /* Exemplu request real:
        fetch('http://127.0.0.1:8000/scanner/start', {
            method: 'POST', body: JSON.stringify({ mechanical: { turntable: { angle: turntableAngle } } })
        });
        */

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
        clearInterval(scanInterval); 
        navigateTo('main-menu');
        try { await fetch('http://127.0.0.1:8000/scanner/cancel', { method: 'POST' }); } catch(e){}
    });

    // --- 7. WIFI / BT MODALS (ACTUAL API CONNECTIONS) ---
    const overlay = document.getElementById('modal-overlay');
    const API_URL = '';
    
    let wifiScanInterval = null;
    let currentConnectedSSID = null;

    const autoScanToggle = document.getElementById('auto-scan-wifi');
    const btnRefreshWifi = document.getElementById('btn-refresh-wifi');

    function startAutoScan() {
        if(autoScanToggle.checked) {
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
        btnRefreshWifi.style.opacity = '0.5';
        loadWiFiNetworks().then(() => btnRefreshWifi.style.opacity = '1');
    });

    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            overlay.classList.add('show');
            document.getElementById(modalId).classList.add('show');
            
            if(modalId === 'wifi-modal') {
                loadWiFiNetworks();
                startAutoScan();
            } else if(modalId === 'bt-modal') {
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
        const listContainer = document.getElementById('wifi-list');
        if (!listContainer.innerHTML) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Scanning for networks...</div>';
        }
        
        try {
            const response = await fetch(`${API_URL}/system/wifi/scan`);
            const networks = await response.json();
            listContainer.innerHTML = ''; 
            
            if(networks.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No networks found.</div>';
                return;
            }

            networks.forEach((net, index) => {
                const isSecure = net.security && net.security !== "open"; 
                const isConnected = (net.ssid === currentConnectedSSID) || (net.connected === true) || (index === 0 && !currentConnectedSSID); 
                
                const securityIcon = isSecure ? '<svg viewBox="0 0 24 24" style="width:16px;height:16px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : '';
                
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
            console.error("Eroare reală la fetch Wi-Fi:", error);
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">Eroare de rețea. Apasă F12 (Console) pentru detalii.</div>`;
        }
    }

    async function connectToWiFi(element, ssid, isSecure) {
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
        });

        const smallText = element.querySelector('small');
        smallText.innerText = 'Connecting...';
        element.classList.add('active');
        element.style.borderColor = 'var(--accent)';

        try {
            const response = await fetch(`${API_URL}/system/wifi/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: ssid, password: password })
            });
            
            if(response.ok) {
                smallText.innerText = 'Connected';
                element.querySelector('span').style.color = 'var(--accent)';
                element.innerHTML += '<svg class="connected-icon" viewBox="0 0 24 24" style="color:var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                currentConnectedSSID = ssid;
            } else {
                smallText.innerText = 'Connection Failed';
                element.classList.remove('active');
                element.style.borderColor = '';
            }
        } catch (e) {
            smallText.innerText = 'Error talking to OS';
            element.classList.remove('active');
            element.style.borderColor = '';
        }
    }

    async function loadBluetoothDevices() {
        const listContainer = document.getElementById('bt-list');
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Scanning Bluetooth devices...</div>';
        
        try {
            const response = await fetch(`${API_URL}/system/bluetooth/scan`);
            const devices = await response.json();
            listContainer.innerHTML = '';
            
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
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mac_address: dev.mac_address })
                        });
                        if (res.ok) item.querySelector('small').innerText = "Paired";
                    } catch(e) {}
                });

                listContainer.appendChild(item);
            });
        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">Backend offline. Check FastAPI server.</div>`;
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
        
        msgDiv.style.padding = '10px 14px';
        msgDiv.style.borderRadius = '8px';
        msgDiv.style.fontSize = '0.9rem';
        msgDiv.style.lineHeight = '1.4';
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.wordWrap = 'break-word';

        if (sender === 'user') {
            msgDiv.style.background = 'var(--accent)';
            msgDiv.style.color = 'var(--bg-primary)';
            msgDiv.style.alignSelf = 'flex-end';
        } else if (sender === 'ai') {
            msgDiv.style.background = 'var(--bg-primary)';
            msgDiv.style.color = 'var(--text-muted)';
            msgDiv.style.borderLeft = '2px solid var(--accent)';
            msgDiv.style.alignSelf = 'flex-start';
        } else {
            msgDiv.style.background = '#ef4444'; 
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'center';
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