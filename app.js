document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://127.0.0.1:8000';
    
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
    }, 1500);

    // --- 2. SYSTEM CLOCK ---
    function updateClock() {
        document.getElementById('clock').innerText = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    setInterval(updateClock, 1000); updateClock();

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

    // --- 4. NAVIGATION & MJPEG STREAM ROUTING ---
    function navigateTo(targetId) {
        if (typeof closeAllModals === 'function') {
            closeAllModals();
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) { void targetScreen.offsetWidth; targetScreen.classList.add('active'); }
        
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.status-icon').forEach(icon => icon.classList.remove('active-icon'));

        if (['main-menu', 'pre-scan', 'scan-face', 'scanning'].includes(targetId)) {
            document.querySelector('.nav-tab[data-target="main-menu"]')?.classList.add('active');
        } else if (targetId === 'library') {
            document.querySelector('.nav-tab[data-target="library"]')?.classList.add('active');
        } else if (targetId === 'help-screen') {
            document.querySelector('.nav-tab[data-target="help-screen"]')?.classList.add('active');
        } else if (targetId === 'settings-screen') {
            document.getElementById('icon-settings')?.classList.add('active-icon');
        }

        const scanStream = document.getElementById('active-scan-stream');
        if (scanStream) {
            scanStream.src = targetId === 'scanning' ? `${API_URL}/scanner/stream` : '';
        }
    }

    document.querySelectorAll('[data-action="nav"], .nav-tab').forEach(el => {
        el.addEventListener('click', function(e) { 
            e.stopPropagation();
            navigateTo(this.getAttribute('data-target'));
        });
    });

    // --- 5. UI INTERACTIONS ---
    const btnToggleAdv = document.getElementById('btn-toggle-adv');
    const advContainer = document.getElementById('advanced-settings-container');
    if(btnToggleAdv) {
        btnToggleAdv.addEventListener('click', () => {
            if(advContainer.style.display === 'none') {
                advContainer.style.display = 'flex';
                btnToggleAdv.innerText = 'Hide Advanced Settings ▲';
            } else {
                advContainer.style.display = 'none';
                btnToggleAdv.innerText = 'Show Advanced Settings ▼';
            }
        });
    }

    const syncSlider = (id) => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        if(slider && val) slider.addEventListener('input', () => val.innerText = slider.value);
    }
    syncSlider('cfg-obj-photo-q'); syncSlider('cfg-adv-stream-q'); 
    syncSlider('cfg-adv-acc'); syncSlider('cfg-adv-dec'); 
    syncSlider('cfg-adv-bright'); syncSlider('cfg-adv-led');
    
    syncSlider('export-decimation'); syncSlider('export-draco');

    document.querySelectorAll('.toggle-switch:not([id])').forEach(toggle => {
        toggle.addEventListener('click', function() { this.classList.toggle('active'); });
    });

    const aiModal = document.getElementById('ai-modal');
    const btnFab = document.getElementById('btn-fab');
    if(btnFab) btnFab.addEventListener('click', () => { aiModal.classList.add('show'); btnFab.style.display = 'none'; });
    const closeAiBtn = document.getElementById('close-ai');
    if(closeAiBtn) closeAiBtn.addEventListener('click', () => { aiModal.classList.remove('show'); btnFab.style.display = 'flex'; });

    const clearAiBtn = document.getElementById('clear-ai');
    if(clearAiBtn) {
        clearAiBtn.addEventListener('click', () => {
            aiConversationHistory = [];
            msgCounter = 0;
            aiChatHistory.innerHTML = '<div class="ai-message">System calibrated. Ready for scanning. Would you like guidance?</div>';
        });
    }

    // --- LOGICA PENTRU MENIUL DE EXPORT ---
    const exportFormat = document.getElementById('export-format');
    const settingTexture = document.getElementById('export-setting-texture');
    const settingDraco = document.getElementById('export-setting-draco');

    if(exportFormat) {
        exportFormat.addEventListener('change', (e) => {
            const val = e.target.value;
            settingDraco.style.display = (val === 'glb') ? 'flex' : 'none';
            settingTexture.style.display = (val === 'stl') ? 'none' : 'flex';
        });
    }

    // --- 6. SCANNER LOGIC (PREPARE, POLL, SCAN, CANCEL) ---
    let statusInterval = null;

    async function triggerCancel() {
        if(statusInterval) clearInterval(statusInterval);
        navigateTo('main-menu');
        try { await fetch(`${API_URL}/scanner/cancel`, { method: 'POST' }); } catch(e){}
    }
    
    document.getElementById('btn-cancel-scan').addEventListener('click', triggerCancel);

    function buildObjectConfigJSON() {
        return {
            basic: {
                z_axis_height: parseInt(document.getElementById('cfg-obj-z').value || 100),
                turntable_angle: parseFloat(document.getElementById('cfg-obj-turntable').value || 18),
                photo_resolution: document.getElementById('cfg-obj-photo-res').value || "1920x1080",
                preview_resolution: document.getElementById('cfg-obj-preview-res').value || "1012x760",
                photo_quality: parseInt(document.getElementById('cfg-obj-photo-q').value || 90)
            },
            advanced: {
                stream_quality: parseInt(document.getElementById('cfg-adv-stream-q').value || 80),
                motor_acceleration: parseInt(document.getElementById('cfg-adv-acc').value || 10),
                motor_deceleration: parseInt(document.getElementById('cfg-adv-dec').value || 10),
                camera_brightness: parseInt(document.getElementById('cfg-adv-bright').value || 50),
                led_intensity: parseFloat(document.getElementById('cfg-adv-led').value || 0.5)
            }
        };
    }

    async function startScanSequence(payload) {
        navigateTo('scanning');
        const statusTitle = document.getElementById('scan-status-title');
        statusTitle.innerText = "Status: Calling Prepare...";

        try {
            await fetch(`${API_URL}/scanner/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            statusTitle.innerText = "Status: Preparing Hardware...";
            statusInterval = setInterval(async () => {
                try {
                    const res = await fetch(`${API_URL}/scanner/status`);
                    const data = await res.json();
                    
                    if(data.status === 'prepare' || data.status === 'ready_to_scan') {
                        clearInterval(statusInterval);
                        statusTitle.innerText = "Status: Scanning in progress...";
                        await fetch(`${API_URL}/scanner/scan`, { method: 'POST' });
                    }
                } catch(e) { console.error("Status polling failed", e); }
            }, 5000);

        } catch (error) {
            statusTitle.innerText = "Error calling prepare endpoint.";
            setTimeout(() => triggerCancel(), 3000);
        }
    }

    const btnObjPrep = document.getElementById('btn-start-obj-prep');
    if(btnObjPrep) {
        btnObjPrep.addEventListener('click', () => {
            const objPayload = buildObjectConfigJSON();
            startScanSequence(objPayload);
        });
    }

    const btnFacePrep = document.getElementById('btn-start-face-prep');
    if(btnFacePrep) {
        btnFacePrep.addEventListener('click', () => {
            const facePayload = {
                basic: { photo_resolution: "1920x1080", preview_resolution: "1012x760" }
            };
            startScanSequence(facePayload);
        });
    }

    // --- 7. WIFI / BT / ETHERNET LOGIC ---
    const overlay = document.getElementById('modal-overlay');
    let wifiScanInterval = null;
    let currentConnectedSSID = null;

    let isWifiPowerOn = true;
    let isBtPowerOn = true;

    const autoScanToggle = document.getElementById('auto-scan-wifi');
    const btnRefreshWifi = document.getElementById('btn-refresh-wifi');
    const btnRefreshBt = document.getElementById('btn-refresh-bt');
    const toggleWifiPower = document.getElementById('toggle-wifi-power');
    const toggleBtPower = document.getElementById('toggle-bt-power');

    const iconNoNet = document.getElementById('icon-no-net');
    const iconWifiMain = document.getElementById('icon-wifi');
    
    function updateNetworkStatus() {
        if (!navigator.onLine) {
            if(iconNoNet) iconNoNet.style.display = 'block';
            if(iconWifiMain) iconWifiMain.style.display = 'none';
        } else {
            if(iconNoNet) iconNoNet.style.display = 'none';
            if(iconWifiMain) iconWifiMain.style.display = 'block';
        }
    }
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    function updateMainWifiIcon(powerOn, isConnected) {
        if(!navigator.onLine) return; 
        const iconWifi = document.getElementById('icon-wifi');
        if(!iconWifi) return;
        
        if(!powerOn) {
            iconWifi.innerHTML = `<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"></line>`;
            iconWifi.style.opacity = '0.4';
        } else if (!isConnected) {
            iconWifi.innerHTML = `<line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3"></line>`;
            iconWifi.style.opacity = '1';
        } else {
            iconWifi.innerHTML = `<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
            iconWifi.style.opacity = '1';
        }
    }

    setInterval(async () => {
        const iconEthernet = document.getElementById('icon-ethernet');
        
        try {
            const res = await fetch(`${API_URL}/system/ethernet/status`);
            if (res.ok) {
                if (iconEthernet) iconEthernet.style.display = 'block'; 
                if (iconWifiMain) iconWifiMain.style.display = 'none';
                if (iconNoNet) iconNoNet.style.display = 'none';
            } else {
                if (iconEthernet) iconEthernet.style.display = 'none';
                updateNetworkStatus();
            }
        } catch(e) {
            if (iconEthernet) iconEthernet.style.display = 'none';
            updateNetworkStatus();
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
        updateMainWifiIcon(isWifiPowerOn, currentConnectedSSID !== null);
        
        if(isWifiPowerOn) {
            this.classList.add('active');
            loadWiFiNetworks();
            if(autoScanToggle.checked) startAutoScan();
        } else {
            this.classList.remove('active');
            stopAutoScan();
            renderDisabledState('wifi-list', 'Wi-Fi Disabled', 'Connect to nearby networks by turning on Wi-Fi using the toggle above.');
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
            renderDisabledState('bt-list', 'Bluetooth Disabled', 'Connect to nearby Bluetooth devices by using the toggle above.');
        }
        try { await fetch(`${API_URL}/system/bluetooth/power/${isBtPowerOn ? 'on' : 'off'}`); } catch(e){}
    });

    function startAutoScan() {
        if(autoScanToggle.checked && isWifiPowerOn) wifiScanInterval = setInterval(loadWiFiNetworks, 10000);
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

    async function fetchMarkdown(filename, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `<div style="text-align: center; margin-top: 40px;"><svg viewBox="0 0 24 24" class="spinner" style="width: 32px; height: 32px;"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" fill="none" stroke-linecap="round"></circle></svg><p style="margin-top: 16px;">Loading document from server...</p></div>`;
        try {
            const response = await fetch(`${API_URL}/docs/${filename}?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error('File not found');
            const text = await response.text();
            container.innerHTML = marked.parse(text);
        } catch (e) {
            container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Error loading documentation: <b>${filename}</b> could not be found. Make sure FastAPI is serving the directory.</div>`;
        }
    }

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
            } else if(modalId === 'doc-user-modal') {
                fetchMarkdown('user_manual.md', 'user-manual-content');
            } else if(modalId === 'doc-tech-modal') {
                fetchMarkdown('technical_documentation.md', 'tech-doc-content');
            }
        });
    });

    function closeAllModals() {
        overlay.classList.remove('show');
        document.querySelectorAll('.os-modal').forEach(m => m.classList.remove('show'));
        const aiModal = document.getElementById('ai-modal');
        const btnFab = document.getElementById('btn-fab');
        if (aiModal && aiModal.classList.contains('show')) {
            aiModal.classList.remove('show');
            btnFab.style.display = 'flex';
        }
        stopAutoScan();
    }
    
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeAllModals));
    overlay.addEventListener('click', closeAllModals);

    window.closeAllModals = closeAllModals; 

    async function loadWiFiNetworks() {
        if(!isWifiPowerOn) return;
        const listContainer = document.getElementById('wifi-list');
        if (!listContainer.innerHTML.includes('list-item')) listContainer.innerHTML = loadingSVG;
        
        try {
            const response = await fetch(`${API_URL}/system/wifi/scan`);
            let networks = [];
            
            if (!response.ok) {
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
                updateMainWifiIcon(true, false);
                return;
            }

            let anyConnected = false;

            networks.forEach((net) => {
                const isSecure = net.security && net.security !== "open"; 
                const isConnected = (net.ssid === currentConnectedSSID) || (net.connected === true); 
                if (isConnected) anyConnected = true;

                let signalIcon = '';
                if(net.signal > 75) signalIcon = `<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
                else if(net.signal > 40) signalIcon = `<path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
                else signalIcon = `<line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3"></line>`;

                const securityIcon = isSecure ? `<svg viewBox="0 0 24 24" style="width:16px;height:16px; margin-left:8px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : '';
                
                const item = document.createElement('div');
                item.className = `list-item ${isConnected ? 'active' : ''}`;
                if (isConnected) item.style.borderColor = 'var(--accent)';

                item.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <svg viewBox="0 0 24 24" style="width:20px;height:20px; margin-right:12px; color:var(--text-main);">${signalIcon}</svg>
                        <div class="list-info">
                            <span style="${isConnected ? 'color: var(--accent);' : ''}">${net.ssid}</span>
                            <small>Signal: ${net.signal}% | ${isSecure ? 'Secure' : 'Open'}</small>
                        </div>
                    </div>
                    ${isConnected ? '<svg class="connected-icon" viewBox="0 0 24 24" style="color:var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>' : securityIcon}
                `;
                item.addEventListener('click', () => connectToWiFi(item, net.ssid, isSecure));
                listContainer.appendChild(item);
            });
            
            updateMainWifiIcon(true, anyConnected);

        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">API connection error.</div>`;
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
                updateMainWifiIcon(true, true);
            } else {
                smallText.innerText = 'Connection Failed';
                element.classList.remove('active'); element.style.borderColor = '';
            }
        } catch (e) {
            smallText.innerText = 'Error interacting with OS API';
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
                devices = [
                    { name: "My Phone", mac_address: "AA:BB:CC:DD:EE:11", status: "Found" },
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
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">API connection error.</div>`;
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
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, history: aiConversationHistory })
            });
            const data = await response.json();
            
            document.getElementById(loadingId).remove();
            appendChatMessage('ai', data.response);

            aiConversationHistory.push({ role: 'user', text: text }, { role: 'assistant', text: data.response });
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

    if(aiSendBtn) aiSendBtn.addEventListener('click', sendAiMessage);
    if(aiInput) aiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAiMessage(); });

    // --- 9. API TESTER TAB ---
    const btnApiSend = document.getElementById('btn-api-test-send');
    if (btnApiSend) {
        btnApiSend.addEventListener('click', async () => {
            const endpointSelect = document.getElementById('api-tester-endpoint').value.split('|');
            const method = endpointSelect[0];
            const route = endpointSelect[1];
            const jsonBodyRaw = document.getElementById('api-tester-json').value;
            const responsePre = document.getElementById('api-tester-response');
            const statusDiv = document.getElementById('api-tester-status');
            
            responsePre.innerText = "Sending request...";
            statusDiv.innerText = "Status: waiting...";

            let fetchOptions = { method: method, headers: {} };
            if (method !== 'GET') {
                fetchOptions.headers['Content-Type'] = 'application/json';
                try { JSON.parse(jsonBodyRaw); fetchOptions.body = jsonBodyRaw; } 
                catch(e) { responsePre.innerText = "Invalid JSON input format!"; return; }
            }

            try {
                const res = await fetch(`${API_URL}${route}`, fetchOptions);
                statusDiv.innerText = `Status: ${res.status} ${res.statusText}`;
                try {
                    const data = await res.json();
                    responsePre.innerText = JSON.stringify(data, null, 2);
                } catch(e) {
                    responsePre.innerText = await res.text();
                }
            } catch(error) {
                statusDiv.innerText = "Status: Fetch Error";
                responsePre.innerText = error.toString();
            }
        });
    }
});