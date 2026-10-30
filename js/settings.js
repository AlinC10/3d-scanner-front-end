document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';

    // --- TAB NAVIGATION ---
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const settingsPanes = document.querySelectorAll('.settings-pane');

    sidebarTabs.forEach(tab => {
        tab.style.pointerEvents = 'auto'; 
        
        tab.addEventListener('click', () => {
            sidebarTabs.forEach(t => t.classList.remove('active'));
            settingsPanes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');

            const targetId = tab.getAttribute('data-tab-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // --- HARDWARE API TESTER ---
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
                try { 
                    JSON.parse(jsonBodyRaw);
                    fetchOptions.body = jsonBodyRaw; 
                } catch(e) { 
                    responsePre.innerText = "Invalid JSON input format!"; 
                    statusDiv.innerText = "Status: Error";
                    return; 
                }
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

   // --- LIGHTS CONTROL ---
    const toggleManualLights = document.getElementById('toggle-manual-lights');
    const lightsSlider = document.getElementById('lights-brightness-slider');
    const lightsVal = document.getElementById('lights-brightness-val');
    
    if (toggleManualLights && lightsSlider) {
        let lightsOn = false;

        // 1. Actualizează textul procentului
        lightsSlider.addEventListener('input', () => {
            lightsVal.innerText = lightsSlider.value + '%';
        });

        // Funcția de comunicare cu API-ul hardware
        const sendLightsRequest = async () => {
            try {
                if (lightsOn) {
                    const brightnessFloat = parseInt(lightsSlider.value) / 100;
                    const res = await fetch(`${API_URL}/test/lights/enable`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brightness: brightnessFloat })
                    });
                    if (!res.ok) throw new Error("API error on enable");
                } else {
                    const res = await fetch(`${API_URL}/test/lights/disable`, {
                        method: 'POST',
                        headers: { 'accept': '*/*' },
                        body: ''
                    });
                    if (!res.ok) throw new Error("API error on disable");
                }
            } catch (error) {
                console.error("Lights API error:", error);
                throw error;
            }
        };

        // 2. Click pe ON/OFF
        toggleManualLights.addEventListener('click', async () => {
            lightsOn = !lightsOn;
            if(lightsOn) toggleManualLights.classList.add('active');
            else toggleManualLights.classList.remove('active');

            try {
                await sendLightsRequest();
            } catch (error) {
                lightsOn = !lightsOn;
                if(lightsOn) toggleManualLights.classList.add('active');
                else toggleManualLights.classList.remove('active');
                alert("Failed to communicate with the hardware to toggle lights.");
            }
        });

        // 3. Modificare Slider
        lightsSlider.addEventListener('change', () => {
            if (lightsOn) {
                sendLightsRequest().catch(() => {
                    alert("Failed to apply new brightness.");
                });
            }
        });

        // 4. AUTO-OFF LA PĂRĂSIREA PAGINII
        // Se aplică dacă dă click pe orice buton de navigare (ex: Main Menu, Library, Help)
        const navButtons = document.querySelectorAll('[data-action="nav"]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (lightsOn) {
                    // Trimitere rapidă în background (fără await ca să nu blocheze navigația)
                    fetch(`${API_URL}/test/lights/disable`, {
                        method: 'POST',
                        headers: { 'accept': '*/*' },
                        body: ''
                    }).catch(() => {});
                    lightsOn = false; 
                }
            });
        });

        // Se aplică dacă dă refresh la pagină, folosește butonul Back din browser sau închide tab-ul
        window.addEventListener('beforeunload', () => {
            if (lightsOn) {
                // navigator.sendBeacon e special conceput să trimită o ultimă cerere în timp ce pagina "moare"
                navigator.sendBeacon(`${API_URL}/test/lights/disable`);
            }
        });
    }
    // --- SYSTEM POWER (SHUTDOWN & REBOOT) ---

    const btnReboot = document.getElementById('btn-system-reboot');
    if (btnReboot) {
        btnReboot.addEventListener('click', async () => {
            if (confirm("Are you sure you want to reboot the scanner?")) {
                try {
                    // Apelăm endpoint-ul specificat în imagine: GET /system/reboot
                    await fetch(`${API_URL}/system/reboot`, { 
                        method: 'GET',
                        headers: { 'accept': 'application/json' }
                    });
                    
                    document.body.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
                            <h1 style="margin-bottom: 20px; font-family: 'Inter', sans-serif; color: #0ea5e9;">System Rebooting...</h1>
                            <p style="color: #aaa; font-family: 'Inter', sans-serif;">The interface will attempt to reload in 30 seconds.</p>
                        </div>
                    `;
                    
                    // Încearcă să reîncarce pagina automat după 30 secunde
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);

                } catch (error) {
                    console.error("Reboot error:", error);
                    alert("Failed to initiate reboot command.");
                }
            }
        });
    }
});