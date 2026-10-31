document.addEventListener('DOMContentLoaded', () => {
    // Folosim IP-ul fix, obligatoriu pentru funcționarea pe modulul Kiosk al Pi-ului
    const API_URL = 'http://127.0.0.1:8000';

    let wifiScanInterval = null;
    let currentConnectedSSID = null;
    let currentConnectedBT = null;
    
    let isWifiPowerOn = true;
    let isBtPowerOn = true;

    // Nouă variabilă de stare pentru a bloca acțiunile pe rețea în timpul scanării 3D (Eroarea 409 din doc)
    let isScannerBusy = false;
    let lastSys = null; // last GET /system/status answer (reading is allowed during a scan)

    const btnRefreshWifi = document.getElementById('btn-refresh-wifi');
    const btnRefreshBt = document.getElementById('btn-refresh-bt');
    const toggleWifiPower = document.getElementById('toggle-wifi-power');
    const toggleBtPower = document.getElementById('toggle-bt-power');
    
    // SSIDs and device names are untrusted text (SYS-1): never put them in innerHTML raw
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const loadingSVG = `<svg viewBox="0 0 24 24" class="spinner" style="width: 32px; height: 32px;"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" fill="none" stroke-linecap="round"></circle></svg>`;

    // --- FUNCȚII UI DE BAZĂ ---
    function showNetworkIcon(type) {
        const iconEthernet = document.getElementById('icon-ethernet');
        const iconWifiMain = document.getElementById('icon-wifi');
        const iconNoNet = document.getElementById('icon-no-net');

        if (iconEthernet) iconEthernet.style.display = (type === 'ethernet') ? 'block' : 'none';
        if (iconWifiMain) iconWifiMain.style.display = (type === 'wifi') ? 'block' : 'none';
        if (iconNoNet) iconNoNet.style.display = (type === 'none') ? 'block' : 'none';
    }

    function renderDisabledState(containerId, title, desc) {
        const el = document.getElementById(containerId);
        if(el) el.innerHTML = `
            <div style="padding: 40px 10px; text-align: left;">
                <h2 style="margin-bottom: 12px; font-size: 1.3rem;">${title}</h2>
                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;">${desc}</p>
            </div>
        `;
    }

    // The server answers 409 to network changes while a scan runs: show what is connected instead
    function renderLockedState(containerId, kind) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const eth = lastSys && lastSys.ethernet;
        const lines = [`Ethernet cable: ${eth && eth.connected ? 'connected' : 'not connected'}`];
        if (kind === 'wifi') {
            const w = lastSys && lastSys.wifi;
            lines.push(w && w.connected ? `Wi-Fi: ${esc(w.ssid)} (signal ${w.signal}%)` : 'Wi-Fi: not connected');
        } else {
            const devs = (lastSys && lastSys.bluetooth && lastSys.bluetooth.devices) || [];
            lines.push(devs.length ? `Bluetooth: ${devs.map(d => esc(d.name || d.mac_address)).join(', ')}` : 'Bluetooth: no device connected');
        }
        el.innerHTML = `
            <div style="padding: 24px 10px;">
                <h2 style="margin-bottom: 12px; font-size: 1.2rem;">Locked during a scan</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 14px;">
                    The scanner does not allow network changes while it scans. If the Wi-Fi drops now the upload stops, so use the Ethernet cable for long scans.
                </p>
                <div style="font-size: 0.9rem; line-height: 1.8;">${lines.join('<br>')}</div>
            </div>`;
    }

    // --- USB STICK (GET /system/status "usb", POST /library/usb/eject) ---
    // Header icon shown while a stick is plugged in; a tap ejects it. Disabled while an export writes to it.
    let usbIcon = null;
    let usbSafe = false;
    let usbEjecting = false;

    function ensureUsbIcon() {
        if (usbIcon) return usbIcon;
        const bar = document.querySelector('header .system-status');
        if (!bar) return null;
        usbIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        usbIcon.setAttribute('viewBox', '0 0 24 24');
        usbIcon.setAttribute('class', 'status-icon');
        usbIcon.id = 'icon-usb';
        usbIcon.style.display = 'none';
        usbIcon.style.cursor = 'pointer';
        // a stick with an "eject" arrow on it
        usbIcon.innerHTML = '<title>USB stick</title><rect x="7" y="9" width="10" height="13" rx="2"></rect><path d="M9 9V3h6v6"></path><polyline points="9.5 17 12 14.5 14.5 17"></polyline>';
        usbIcon.addEventListener('click', ejectUsb);
        bar.insertBefore(usbIcon, document.getElementById('icon-settings'));
        return usbIcon;
    }

    function renderUsbIcon(usb) {
        const icon = ensureUsbIcon();
        if (!icon) return;
        const connected = !!(usb && !usb.error && usb.connected);
        usbSafe = connected && usb.safe_to_remove === true;
        icon.style.display = connected ? 'block' : 'none';
        icon.style.opacity = usbSafe && !usbEjecting ? '1' : '0.35';
        const title = icon.querySelector('title');
        if (title) title.textContent = usbSafe ? 'USB stick: tap to eject' : 'USB stick: export in progress, wait before ejecting';
    }

    async function ejectUsb(e) {
        e.stopPropagation();
        if (!usbSafe || usbEjecting) return;
        if (!(await window.uiConfirm('Eject the USB stick?', { title: 'USB stick', okText: 'Eject' }))) return;
        usbEjecting = true;
        if (usbIcon) usbIcon.style.opacity = '0.35';
        try {
            const res = await fetch(`${API_URL}/library/usb/eject`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            if (!res.ok) throw new Error(await window.apiError(res));
            const data = await res.json();
            window.uiAlert(data.safe_to_remove ? 'You can remove the USB stick.' : 'The stick was unmounted.');
        } catch (err) {
            window.uiAlert(`Could not eject the USB stick: ${err.message}`);
        } finally {
            usbEjecting = false;
            checkGlobalNetworkState();
        }
    }

    // --- NOU: VERIFICARE STATUS GLOBAL (Sursa unică de adevăr) ---
    // Conform "GET /system/status NEW" - Polled every 5-15s
    async function checkGlobalNetworkState() {
        let isEthernetActive = false;
        let isWifiActive = false;
        let gotStatus = false;

        try {
            // Mai întâi verificăm starea scanerului pentru a ști dacă blocăm butoanele de rețea
            const scannerRes = await fetch(`${API_URL}/scanner/status?t=${Date.now()}`).catch(() => null);
            if (scannerRes && scannerRes.ok) {
                const scannerData = await scannerRes.json();
                // Blocăm rețeaua doar dacă scanerul lucrează activ
                isScannerBusy = ["preparing", "running", "processing", "downloading", "uploading"].includes(scannerData.state);
            }

            // Apoi tragem starea globală a sistemului
            const sysRes = await fetch(`${API_URL}/system/status?t=${Date.now()}`).catch(() => null);
            
            if (sysRes && sysRes.ok) {
                const sysData = await sysRes.json();
                lastSys = sysData;
                gotStatus = true;

                // 1. Verificare ETHERNET din structura nouă
                if (sysData.ethernet) {
                    if (sysData.ethernet.cable_plugged === true && sysData.ethernet.state === 'connected') {
                        isEthernetActive = true;
                    }
                }

                // 2. Verificare WI-FI din structura nouă
                if (sysData.wifi) {
                    isWifiPowerOn = sysData.wifi.enabled === true;
                    
                    if (sysData.wifi.state === 'connected' && sysData.wifi.connected === true && sysData.wifi.ssid) {
                        isWifiActive = true;
                        currentConnectedSSID = sysData.wifi.ssid;
                    } else {
                        currentConnectedSSID = null;
                    }
                }

                // USB stick: icon + "Eject" from the same poll (no extra request)
                renderUsbIcon(sysData.usb);

                // 3. Verificare BLUETOOTH
                if (sysData.bluetooth) {
                    isBtPowerOn = sysData.bluetooth.powered === true;
                }
                
                // Actualizăm butoanele de power conform realității
                if (toggleWifiPower) {
                    isWifiPowerOn ? toggleWifiPower.classList.add('active') : toggleWifiPower.classList.remove('active');
                }
                if (toggleBtPower) {
                    isBtPowerOn ? toggleBtPower.classList.add('active') : toggleBtPower.classList.remove('active');
                }
            }
        } catch(e) {
            console.warn("Nu mă pot conecta la API-ul Python.");
        }

        // Other scripts (scan widget, scanning page) warn when the connection drops during a scan
        if (gotStatus) {
            window.dispatchEvent(new CustomEvent('network-state', {
                detail: { ethernet: isEthernetActive, wifi: isWifiActive, ssid: currentConnectedSSID, scanning: isScannerBusy }
            }));
        }

        // --- APLICARE INTERFAȚĂ ICONIȚE ---
        if (isEthernetActive) {
            showNetworkIcon('ethernet');
        } else if (isWifiActive) {
            showNetworkIcon('wifi');
        } else {
            showNetworkIcon('none');
        }
    }

    // Inițializare (Polled every 5 secunde conform documentației)
    checkGlobalNetworkState().then(() => {
        setInterval(checkGlobalNetworkState, 5000);
    });

    window.addEventListener('online', checkGlobalNetworkState);
    window.addEventListener('offline', checkGlobalNetworkState);


    // --- WIFI TOGGLE & SCAN (Cu protecție 409) ---
    if(toggleWifiPower) {
        toggleWifiPower.addEventListener('click', async function() {
            if (isScannerBusy) { window.uiAlert("Network actions are disabled during an active scan."); return; }

            isWifiPowerOn = !isWifiPowerOn;
            if(isWifiPowerOn) {
                this.classList.add('active');
                loadWiFiNetworks(false);
                startAutoScan(); 
            } else {
                this.classList.remove('active');
                window.stopAutoScan();
                currentConnectedSSID = null; 
                renderDisabledState('wifi-list', 'Wi-Fi Disabled', 'Turn on Wi-Fi to connect to nearby networks.');
                checkGlobalNetworkState(); 
            }
            try { 
                await fetch(`${API_URL}/system/wifi/power/${isWifiPowerOn ? 'on' : 'off'}`, { method: 'POST' }); 
            } catch(e){}
        });
    }

    if(toggleBtPower) {
        toggleBtPower.addEventListener('click', async function() {
            if (isScannerBusy) { window.uiAlert("Network actions are disabled during an active scan."); return; }

            isBtPowerOn = !isBtPowerOn;
            this.classList.toggle('active', isBtPowerOn);
            try {
                const res = await fetch(`${API_URL}/system/bluetooth/power/${isBtPowerOn ? 'on' : 'off'}`, { method: 'POST' });
                if (!res.ok) throw new Error(await window.apiError(res));
            } catch(e) {
                isBtPowerOn = !isBtPowerOn;
                this.classList.toggle('active', isBtPowerOn);
                window.uiAlert(`Bluetooth: ${e.message}`);
            }
            if (isBtPowerOn) loadBluetoothDevices();
            else renderDisabledState('bt-list', 'Bluetooth Disabled', 'Turn on Bluetooth to connect to nearby devices.');
        });
    }

    if(btnRefreshBt) {
        btnRefreshBt.addEventListener('click', () => {
            if(!isBtPowerOn || isScannerBusy) return;
            loadBluetoothDevices();
        });
    }

    function startAutoScan() {
        window.stopAutoScan();
        if(isWifiPowerOn) {
            wifiScanInterval = setInterval(() => loadWiFiNetworks(false), 10000);
        }
    }
    
    window.stopAutoScan = function() {
        if(wifiScanInterval) clearInterval(wifiScanInterval);
    }

    if(btnRefreshWifi) {
        btnRefreshWifi.addEventListener('click', () => {
            if(!isWifiPowerOn || isScannerBusy) return;
            btnRefreshWifi.style.opacity = '0.5';
            // Când apasă refresh, cerem API-ului o scanare hardware reală (?rescan=true)
            loadWiFiNetworks(true).then(() => btnRefreshWifi.style.opacity = '1');
            startAutoScan(); 
        });
    }

    // Funcție apelată din global.js la deschiderea modalelor
    window.triggerNetworkModalScan = async function(modalId) {
        await checkGlobalNetworkState(); // refreshes isScannerBusy before deciding what to show
        if(modalId === 'wifi-modal' && isWifiPowerOn) {
            loadWiFiNetworks(false);
            startAutoScan();
        } else if(modalId === 'bt-modal' && isBtPowerOn) {
            loadBluetoothDevices();
        }
    }


    // DELETE /system/wifi/saved/{name}: the saved connection name can differ from the SSID
    async function forgetNetwork(ssid) {
        const saved = await (await fetch(`${API_URL}/system/wifi/saved`)).json();
        const entry = saved.find(n => n.ssid === ssid);
        if (!entry) return;
        const res = await fetch(`${API_URL}/system/wifi/saved/${encodeURIComponent(entry.name)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) window.uiAlert(await window.apiError(res));
    }

    // --- LOAD WIFI NETWORKS ---
    async function loadWiFiNetworks(forceRescan = false) {
        if(!isWifiPowerOn) return;
        const listContainer = document.getElementById('wifi-list');
        if(!listContainer) return;
        if (isScannerBusy) return renderLockedState('wifi-list', 'wifi');

        if (!listContainer.innerHTML.includes('list-item') && !forceRescan) {
            listContainer.innerHTML = loadingSVG;
        }
        
        try {
            // Folosim query parametrul `rescan` descris în documentație
            const response = await fetch(`${API_URL}/system/wifi/scan?rescan=${forceRescan}`);
            let networks = [];
            
            if (response.ok) {
                networks = await response.json();
            } else if (response.status === 409) {
                console.warn("Scan blocked: System busy (409).");
                return;
            }

            if(networks.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No networks found.</div>';
                return;
            }

            // Structura din documentatie are "saved" si "in_use" sau putem folosi currentConnectedSSID
            networks.sort((a, b) => {
                const isAConnected = a.ssid === currentConnectedSSID || (a.in_use && a.in_use.trim() !== "");
                const isBConnected = b.ssid === currentConnectedSSID || (b.in_use && b.in_use.trim() !== "");
                
                if (isAConnected && !isBConnected) return -1;
                if (!isAConnected && isBConnected) return 1;
                return 0; 
            });

            listContainer.innerHTML = ''; 

            networks.forEach((net) => {
                const isConnected = net.ssid === currentConnectedSSID || (net.in_use && net.in_use.trim() !== "");
                const isSecure = net.security && net.security.trim() !== "" && net.security.trim() !== "open" && net.security.trim() !== "--"; 
                
                let signalIcon = '';
                if(net.signal >= 75) {
                    signalIcon = `<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
                } else if(net.signal >= 50) {
                    signalIcon = `<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
                } else if(net.signal >= 25) {
                    signalIcon = `<path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>`;
                } else {
                    signalIcon = `<line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3"></line>`;
                }

                const securityIcon = isSecure ? `<svg viewBox="0 0 24 24" style="width:16px;height:16px; color:var(--text-muted);"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : '';
                
                const item = document.createElement('div');
                item.className = `list-item ${isConnected ? 'active' : ''}`;
                if (isConnected) item.style.borderColor = 'var(--accent)';

                const btnText = isConnected ? 'Forget' : (net.saved ? 'Connect (Saved)' : 'Connect');
                const btnClass = isConnected ? 'btn-secondary' : 'btn-primary';

                item.innerHTML = `
                    <div style="display:flex; align-items:center; flex: 1;">
                        <svg viewBox="0 0 24 24" style="width:20px;height:20px; margin-right:12px; color:var(--text-main); fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;">${signalIcon}</svg>
                        <div class="list-info">
                            <span style="${isConnected ? 'color: var(--accent);' : ''}">${esc(net.ssid)}</span>
                            <small>Signal: ${net.signal}% | ${isSecure ? 'Secure' : 'Open'}</small>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 12px;">
                        ${securityIcon}
                        ${net.saved && !isConnected ? '<button class="btn-secondary forget-btn" style="padding: 6px 10px; font-size: 0.8rem; min-height: 28px; width: auto;">Forget</button>' : ''}
                        <button class="${btnClass} action-btn" style="padding: 6px 14px; font-size: 0.8rem; min-height: 28px; width: auto; min-width: 90px; text-align: center;">${btnText}</button>
                    </div>
                `;
                
                const actionBtn = item.querySelector('.action-btn');
                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isScannerBusy) { window.uiAlert("Action blocked during scan (409)."); return; }
                    toggleWiFiConnection(item, net.ssid, isSecure, isConnected, net.saved, actionBtn, null, net.security || '');
                });
                const forgetBtn = item.querySelector('.forget-btn');
                if (forgetBtn) forgetBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (isScannerBusy) { window.uiAlert("Action blocked during scan (409)."); return; }
                    forgetBtn.innerText = '...';
                    try { await forgetNetwork(net.ssid); } catch(err) {}
                    loadWiFiNetworks(false);
                });

                listContainer.appendChild(item);
            });
            
        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">API connection error.</div>`;
        }
    }


    // --- CONNECT / DISCONNECT WIFI ---
    async function toggleWiFiConnection(element, ssid, isSecure, isConnected, isSaved, btnElement, knownPassword = null, security = '') {
        if(!isWifiPowerOn) return;
        const smallText = element.querySelector('small');

        // "FORGET": API-ul nu are disconnect, doar DELETE /system/wifi/saved/{name}
        if (isConnected) {
            btnElement.innerText = '...';
            try { await forgetNetwork(ssid); } catch(e) {}
            
            currentConnectedSSID = null;
            checkGlobalNetworkState(); 
            loadWiFiNetworks(false); 
            return;
        }

        // CONECTARE
        let password = knownPassword ?? "";
        
        // Dacă NU e salvată și E securizată, cerem parolă (401 o va cere oricum, dar o cerem proactiv)
        if (knownPassword === null && !isSaved && isSecure) {
            password = await window.uiPrompt(`Enter the password for ${ssid}:`, '', { title: 'Wi-Fi password', password: true, okText: 'Connect' });
            if (password === null) return; 
        }

        // 802.1X (enterprise) networks also need a user name
        let identity = null;
        if (!isSaved && /802\.1X|EAP/i.test(security)) {
            identity = await window.uiPrompt(`Enter the user name for ${ssid}:`, '', { title: 'Wi-Fi user name' });
            if (identity === null) return;
        }

        btnElement.innerText = 'Working...';
        smallText.innerText = 'Authenticating...';
        btnElement.disabled = true;

        try {
            const response = await fetch(`${API_URL}/system/wifi/connect`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ ssid: ssid, password: password, identity: identity })
            });
            
            if(response.ok) {
                currentConnectedSSID = ssid;
                checkGlobalNetworkState(); 
                loadWiFiNetworks(false); 
            } else if (response.status === 401) {
                // Dacă ne-a dat 401, rețeaua salvată are parola greșită SAU trebuie parolă. O cerem din nou.
                smallText.innerText = 'Wrong password.';
                btnElement.innerText = 'Retry';
                btnElement.disabled = false;
                
                // Opțional, redeschidem promptul automat
                let retryPwd = await window.uiPrompt(`Wrong password. Enter the password for ${ssid} again:`, '', { title: 'Wi-Fi password', password: true, okText: 'Connect' });
                if (retryPwd !== null) {
                    toggleWiFiConnection(element, ssid, true, false, false, btnElement, retryPwd, security);
                }

            } else {
                smallText.innerText = response.status === 409 ? 'Not possible during a scan' : await window.apiError(response);
                smallText.style.color = '#EF4444';
                btnElement.innerText = 'Connect';
                btnElement.disabled = false;
            }
        } catch (e) {
            smallText.innerText = 'API Offline';
            smallText.style.color = '#EF4444';
            btnElement.innerText = 'Connect';
            btnElement.disabled = false;
        }
    }

    // --- BLUETOOTH LIST & CONNECT ---
    // (Implementat utilizând aceleași principii din documentație, durata 8s)
    async function loadBluetoothDevices() {
        if(!isBtPowerOn) return;
        const listContainer = document.getElementById('bt-list');
        if(!listContainer) return;
        if (isScannerBusy) return renderLockedState('bt-list', 'bt');

        if (!listContainer.innerHTML.includes('list-item')) listContainer.innerHTML = loadingSVG;
        
        try {
            const response = await fetch(`${API_URL}/system/bluetooth/scan?duration=8`);
            let devices = [];

            if (response.ok) {
                devices = await response.json();
            } else if (response.status === 409) {
                console.warn("BT Scan blocked: System busy.");
                return;
            }

            if(devices.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No devices found.</div>';
                return;
            }
            
            listContainer.innerHTML = '';
            
            devices.forEach(dev => {
                const isConnected = dev.connected === true;

                const item = document.createElement('div');
                item.className = `list-item ${isConnected ? 'active' : ''}`;
                if (isConnected) item.style.borderColor = 'var(--accent)';
                
                const btnText = isConnected ? 'Disconnect' : 'Connect';
                const btnClass = isConnected ? 'btn-secondary' : 'btn-primary';

                item.innerHTML = `
                    <div class="list-info" style="flex: 1;">
                        <span style="${isConnected ? 'color: var(--accent);' : ''}">${esc(dev.name || dev.mac_address)}</span>
                        <small>${isConnected ? 'Connected' : (dev.paired ? 'Paired' : 'Found')} | Signal: ${dev.rssi || '-'} dBm</small>
                    </div>
                    <button class="${btnClass} action-btn" style="padding: 6px 14px; font-size: 0.8rem; min-height: 28px; width: 90px; text-align: center;">${btnText}</button>
                `;
                
                const actionBtn = item.querySelector('.action-btn');
                actionBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (isScannerBusy) { window.uiAlert("Action blocked during scan (409)."); return; }
                    
                    if (isConnected) {
                        actionBtn.innerText = '...';
                        try {
                            const res = await fetch(`${API_URL}/system/bluetooth/disconnect`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mac_address: dev.mac_address })
                            });
                            if (!res.ok) window.uiAlert(await window.apiError(res));
                        } catch(err){}
                        loadBluetoothDevices(); 
                        return;
                    }

                    actionBtn.innerText = 'Pairing...';
                    item.querySelector('small').innerText = "Connecting...";
                    try {
                        const res = await fetch(`${API_URL}/system/bluetooth/connect`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mac_address: dev.mac_address })
                        });
                        if (!res.ok) window.uiAlert(await window.apiError(res));
                        loadBluetoothDevices(); 
                    } catch(err) {
                        item.querySelector('small').innerText = "Failed";
                        loadBluetoothDevices();
                    }
                });

                listContainer.appendChild(item);
            });
        } catch (error) {
            listContainer.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">API connection error.</div>`;
        }
    }

});