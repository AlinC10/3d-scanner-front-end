document.addEventListener('DOMContentLoaded', () => {
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

    function showNetworkIcon(type) {
        const iconEthernet = document.getElementById('icon-ethernet');
        const iconWifiMain = document.getElementById('icon-wifi');
        const iconNoNet = document.getElementById('icon-no-net');

        if (iconEthernet) iconEthernet.style.display = (type === 'ethernet') ? 'block' : 'none';
        if (iconWifiMain) iconWifiMain.style.display = (type === 'wifi') ? 'block' : 'none';
        if (iconNoNet) iconNoNet.style.display = (type === 'none') ? 'block' : 'none';
    }

    async function initNetworkDetection() {
        if (!navigator.onLine) {
            showNetworkIcon('none');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/system/ethernet/status`);
            await new Promise(resolve => setTimeout(resolve, 1200)); // Delay vizual

            if (res.ok) {
                showNetworkIcon('ethernet');
            } else {
                showNetworkIcon('none'); // Rămâne pe Glob așteptând utilizatorul
            }
        } catch(e) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            showNetworkIcon('none'); 
        }
    }

    window.addEventListener('online', initNetworkDetection);
    window.addEventListener('offline', () => showNetworkIcon('none'));
    
    initNetworkDetection();

    const loadingSVG = `<svg viewBox="0 0 24 24" class="spinner" style="width: 32px; height: 32px;"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" fill="none" stroke-linecap="round"></circle></svg>`;

    function renderDisabledState(containerId, title, desc) {
        const el = document.getElementById(containerId);
        if(el) el.innerHTML = `
            <div style="padding: 40px 10px; text-align: left;">
                <h2 style="margin-bottom: 12px; font-size: 1.3rem;">${title}</h2>
                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;">${desc}</p>
            </div>
        `;
    }

    if(toggleWifiPower) {
        toggleWifiPower.addEventListener('click', async function() {
            isWifiPowerOn = !isWifiPowerOn;
            
            if(isWifiPowerOn) {
                this.classList.add('active');
                loadWiFiNetworks();
                if(autoScanToggle && autoScanToggle.checked) startAutoScan();
            } else {
                this.classList.remove('active');
                window.stopAutoScan();
                renderDisabledState('wifi-list', 'Wi-Fi Disabled', 'Connect to nearby networks by turning on Wi-Fi using the toggle above.');
                showNetworkIcon('none'); // Revine la glob daca opresti wifi
            }
            try { await fetch(`${API_URL}/system/wifi/power/${isWifiPowerOn ? 'on' : 'off'}`); } catch(e){}
        });
    }

    if(toggleBtPower) {
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
    }

    function startAutoScan() {
        if(autoScanToggle && autoScanToggle.checked && isWifiPowerOn) {
            wifiScanInterval = setInterval(loadWiFiNetworks, 10000);
        }
    }
    
    window.stopAutoScan = function() {
        if(wifiScanInterval) clearInterval(wifiScanInterval);
    }

    if(autoScanToggle) {
        autoScanToggle.addEventListener('change', (e) => {
            if(e.target.checked) startAutoScan();
            else window.stopAutoScan();
        });
    }

    if(btnRefreshWifi) {
        btnRefreshWifi.addEventListener('click', () => {
            if(!isWifiPowerOn) return;
            btnRefreshWifi.style.opacity = '0.5';
            loadWiFiNetworks().then(() => btnRefreshWifi.style.opacity = '1');
        });
    }

    if(btnRefreshBt) {
        btnRefreshBt.addEventListener('click', () => {
            if(!isBtPowerOn) return;
            btnRefreshBt.style.opacity = '0.5';
            loadBluetoothDevices().then(() => btnRefreshBt.style.opacity = '1');
        });
    }

    window.triggerNetworkModalScan = function(modalId) {
        if(modalId === 'wifi-modal' && isWifiPowerOn) {
            loadWiFiNetworks();
            startAutoScan();
        } else if(modalId === 'bt-modal' && isBtPowerOn) {
            loadBluetoothDevices();
        }
    }

    async function loadWiFiNetworks() {
        if(!isWifiPowerOn) return;
        const listContainer = document.getElementById('wifi-list');
        if(!listContainer) return;

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
                showNetworkIcon('none');
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
            
            // Dacă descoperim că suntem deja conectați la o rețea, schimbăm în iconița de Wi-Fi
            if (anyConnected) showNetworkIcon('wifi');

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
                
                // SCHIMBĂM GLOBUL ÎN WI-FI DUPĂ CONECTAREA REUȘITĂ
                showNetworkIcon('wifi');
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
        if(!listContainer) return;

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
});