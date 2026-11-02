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

    // --- ENDPOINT CATALOG (API tester) ---
    // [group, method, route, sample body]
    const ENDPOINTS = [
        ['Scanner', 'GET',  '/scanner/status', null],
        ['Scanner', 'POST', '/scanner/prepare', {enable_stream: true, illumination_brightness: 1.0, z_start_mm: 32.0, z_delay: 0.001, camera_config: {quality: 95, focus: 'auto'}}],
        ['Scanner', 'POST', '/scanner/start', {job_id: null, mechanical: {turntable: {angle: 18.0, delay: 0.001, acceleration: true, ramp_percent: 0.4, decel_percent: 0.5, end_delay: 0.015}, z_axis: {distance_mm: 80.0, delay: 0.001, acceleration: false}}, cloud: {launch_runpod: true, resolution_level: 1, title: null, start_pod_with_scan: true}}],
        ['Scanner', 'POST', '/scanner/face/prepare', {enable_stream: true, illumination_brightness: 0.35, start_z_mm: 144.0, upload_r2: false, z_delay: 0.001, camera_config: {focus: 'auto'}}],
        ['Scanner', 'POST', '/scanner/face/capture', {strategy: 'direct_stop', search_range_mm: 48.0, step_mm: 8.0, manual_z: null, settle_s: 0.15, z_delay: null, title: null, reconstruct: true}],
        ['Scanner', 'POST', '/scanner/cloud/retry', null],
        ['Scanner', 'POST', '/scanner/cancel', null],
        ['Jobs', 'GET',  '/jobs', null],
        ['Jobs', 'GET',  '/jobs?id={job_id}', null],
        ['Jobs', 'GET',  '/jobs/{job_id}', null],
        ['Jobs', 'POST', '/jobs/{job_id}/cancel', null],
        ['Scanner', 'POST', '/scanner/stream/active?camera_id=2', null],
        ['Scanner', 'POST', '/scanner/stream/quality?quality=75', null],
        ['Scanner', 'GET',  '/scanner/stream/sync-status', null],
        ['Library', 'GET',   '/library/objects?offset=0&limit=20', null],
        ['Library', 'GET',   '/library/objects/{id}', null],
        ['Library', 'PATCH', '/library/objects/{id}', {title: 'Vase', description: ''}],
        ['Library', 'DELETE', '/library/objects/{id}', null],
        ['Library', 'GET',   '/library/usb', null],
        ['Library', 'POST',  '/library/objects/{id}/export/usb', null],
        ['Library', 'GET',   '/library/export/usb/status', null],
        ['Library', 'POST',  '/library/usb/eject', {}],
        ['Library', 'POST',  '/library/objects/{id}/export/qr', null],
        ['Library', 'GET',   '/library/export/qr/status', null],
        ['Library', 'GET',   '/library/export/qr/image.svg', null],
        ['System', 'GET',    '/system/status', null],
        ['System', 'GET',    '/system/wifi/status', null],
        ['System', 'POST',   '/system/wifi/power/on', null],
        ['System', 'POST',   '/system/wifi/power/off', null],
        ['System', 'GET',    '/system/wifi/scan?rescan=false', null],
        ['System', 'GET',    '/system/wifi/saved', null],
        ['System', 'DELETE', '/system/wifi/saved/{name}', null],
        ['System', 'POST',   '/system/wifi/connect', {ssid: '', password: '', identity: null}],
        ['System', 'GET',    '/system/bluetooth/status', null],
        ['System', 'POST',   '/system/bluetooth/power/on', null],
        ['System', 'POST',   '/system/bluetooth/power/off', null],
        ['System', 'GET',    '/system/bluetooth/scan?duration=8', null],
        ['System', 'POST',   '/system/bluetooth/connect', {mac_address: 'AA:BB:CC:DD:EE:FF'}],
        ['System', 'POST',   '/system/bluetooth/disconnect', {mac_address: 'AA:BB:CC:DD:EE:FF'}],
        ['System', 'GET',    '/system/ethernet/status', null],
        ['System', 'POST',   '/system/ethernet/connect', {ssid: '', password: '', identity: ''}],
        ['AI', 'GET',  '/api/ai/status', null],
        ['AI', 'POST', '/api/ai/chat', {question: 'How do I scan a vase?', history: []}],
        ['Test', 'GET',  '/test/endstops', null],
        ['Test', 'GET',  '/test/tof', null],
        ['Test', 'POST', '/test/lights/enable', {brightness: 0.5}],
        ['Test', 'POST', '/test/lights/disable', null],
        ['Test', 'GET',  '/test/motor/status', null],
        ['Test', 'POST', '/test/motor/enable?target=all', null],
        ['Test', 'POST', '/test/motor/disable?target=all', null],
        ['Test', 'POST', '/test/motor/home-bottom', null],
        ['Test', 'POST', '/test/motor/move-to-top', null],
        ['Test', 'POST', '/test/motor/z-move', {distance_mm: 8.0, direction: 'up', delay: 0.001, acceleration: false}],
        ['Test', 'POST', '/test/turntable/rotate', {angle: 18.0, clockwise: true, delay: 0.001, acceleration: true, ramp_percent: 0.4, end_delay: 0.015}],
        ['Test', 'POST', '/test/stream/start', null],
        ['Test', 'POST', '/test/stream/stop', null],
        ['Test', 'GET',  '/test/stream/status', null],
        ['Test', 'POST', '/test/stream/active?camera_id=2', null],
        ['Test', 'POST', '/test/stream/quality?quality=75', null],
        ['Test', 'GET',  '/test/stream/sync-status', null],
        ['Test', 'POST', '/test/camera/snap', null],
        ['Test', 'GET',  '/test/buzzer', null],
        ['Test', 'POST', '/test/buzzer/play', {pattern: 'success'}],
        ['Test', 'POST', '/test/buzzer/tone', {frequency_hz: 880, duration_s: 0.5}],
        ['Test', 'POST', '/test/cleanup', null],
        ['Test', 'POST', '/test/cloud/runpod-dry-run', null]
    ];

    // --- HARDWARE API TESTER ---
    const testerSelect = document.getElementById('api-tester-endpoint');
    const testerRoute = document.getElementById('api-tester-route');
    const testerJson = document.getElementById('api-tester-json');

    function fillTesterFromSelection() {
        const [, method, route, body] = ENDPOINTS[parseInt(testerSelect.value, 10)];
        testerRoute.value = route;
        testerJson.value = body ? JSON.stringify(body, null, 2) : '';
        testerJson.disabled = method === 'GET' || !body;
        testerJson.style.opacity = testerJson.disabled ? '0.5' : '1';
    }

    if (testerSelect && testerRoute && testerJson) {
        let currentGroup = null, optgroup = null;
        ENDPOINTS.forEach(([group, method, route], i) => {
            if (group !== currentGroup) {
                optgroup = document.createElement('optgroup');
                optgroup.label = group;
                testerSelect.appendChild(optgroup);
                currentGroup = group;
            }
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${method} ${route}`;
            optgroup.appendChild(opt);
        });
        testerSelect.addEventListener('change', fillTesterFromSelection);
        fillTesterFromSelection();
    }

    // Sends one request and shows status + body in the given elements
    async function sendRequest(method, route, bodyObj, statusDiv, responsePre) {
        responsePre.innerText = "Sending request...";
        statusDiv.innerText = "Status: waiting...";
        const options = { method, headers: {} };
        if (bodyObj !== null && bodyObj !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(bodyObj);
        }
        try {
            const res = await fetch(`${API_URL}${route}`, options);
            statusDiv.innerText = `Status: ${res.status} ${res.statusText}`;
            const text = await res.text();
            try { responsePre.innerText = JSON.stringify(JSON.parse(text), null, 2); }
            catch (e) { responsePre.innerText = text || '(empty body)'; }
            return res;
        } catch (error) {
            statusDiv.innerText = "Status: Fetch Error";
            responsePre.innerText = error.toString();
            return null;
        }
    }

    const btnApiSend = document.getElementById('btn-api-test-send');
    if (btnApiSend) {
        btnApiSend.addEventListener('click', () => {
            const [, method] = ENDPOINTS[parseInt(testerSelect.value, 10)];
            let bodyObj = null;
            if (method !== 'GET' && testerJson.value.trim() !== '') {
                try { bodyObj = JSON.parse(testerJson.value); }
                catch (e) {
                    document.getElementById('api-tester-response').innerText = "Invalid JSON input format!";
                    document.getElementById('api-tester-status').innerText = "Status: Error";
                    return;
                }
            }
            sendRequest(method, testerRoute.value.trim(), bodyObj,
                document.getElementById('api-tester-status'), document.getElementById('api-tester-response'));
        });
    }

    // --- HARDWARE TESTS TAB (/test/*) ---
    // field: {name, label, type, value, min, max, step, options, in: 'body' | 'query', skipIfEmpty}
    const num = (name, label, value, min, max, step, where = 'body', skipIfEmpty = false) => ({name, label, type: 'number', value, min, max, step, in: where, skipIfEmpty});
    const sel = (name, label, options, where = 'body') => ({name, label, type: 'select', options, value: options[0], in: where});
    const chk = (name, label, value, where = 'body') => ({name, label, type: 'checkbox', value, in: where});

    const motionQuery = [
        num('delay', 'Delay (s)', '', 0.0001, 0.05, 0.0001, 'query', true),
        num('start_delay', 'Start delay (s)', '', 0.0001, 0.05, 0.0001, 'query', true),
        num('ramp_percent', 'Ramp %', '', 0, 1, 0.05, 'query', true),
        chk('acceleration', 'Acceleration', false, 'query')
    ];

    const TEST_CARDS = [
        ['Sensors', [
            {title: 'Endstops', method: 'GET', path: '/test/endstops'},
            {title: 'Distance sensor (ToF)', method: 'GET', path: '/test/tof'}
        ]],
        ['Motors', [
            {title: 'Motor status', method: 'GET', path: '/test/motor/status'},
            {title: 'Enable motors', method: 'POST', path: '/test/motor/enable', fields: [sel('target', 'Target', ['all', 'turntable', 'z_axis'], 'query')]},
            {title: 'Disable motors', method: 'POST', path: '/test/motor/disable', fields: [sel('target', 'Target', ['all', 'turntable', 'z_axis'], 'query')]},
            {title: 'Home to bottom', method: 'POST', path: '/test/motor/home-bottom', fields: motionQuery},
            {title: 'Move to top', method: 'POST', path: '/test/motor/move-to-top', fields: motionQuery},
            {title: 'Move Z axis', method: 'POST', path: '/test/motor/z-move', fields: [
                num('distance_mm', 'Distance (mm)', 8, 0.01, 475, 0.01), sel('direction', 'Direction', ['up', 'down']),
                num('delay', 'Delay (s)', 0.001, 0.0001, 0.05, 0.0001), num('ramp_percent', 'Ramp %', 0.2, 0, 1, 0.05), num('decel_percent', 'Decel %', '', 0, 1, 0.05, 'body', true),
                chk('acceleration', 'Acceleration', false)]},
            {title: 'Rotate turntable', method: 'POST', path: '/test/turntable/rotate', fields: [
                num('angle', 'Angle (°)', 18, 0.1125, 360, 0.1125), chk('clockwise', 'Clockwise', true),
                num('delay', 'Delay (s)', 0.001, 0.0001, 0.05, 0.0001), chk('acceleration', 'Acceleration', true),
                num('ramp_percent', 'Ramp %', 0.4, 0, 1, 0.05), num('decel_percent', 'Decel %', 0.5, 0, 1, 0.05),
                num('end_delay', 'End delay (s)', 0.015, 0.005, 0.03, 0.001)]}
        ]],
        ['Lights', [
            {title: 'Lights on', method: 'POST', path: '/test/lights/enable', fields: [num('brightness', 'Brightness (0-1)', 0.5, 0.05, 1, 0.05)]},
            {title: 'Lights off', method: 'POST', path: '/test/lights/disable'}
        ]],
        ['Cameras', [
            {title: 'Start preview', method: 'POST', path: '/test/stream/start'},
            {title: 'Stop preview', method: 'POST', path: '/test/stream/stop'},
            {title: 'Preview status', method: 'GET', path: '/test/stream/status'},
            {title: 'Active camera', method: 'POST', path: '/test/stream/active', fields: [sel('camera_id', 'Camera', ['1', '2'], 'query')]},
            {title: 'Preview quality', method: 'POST', path: '/test/stream/quality', fields: [num('quality', 'JPEG quality', 75, 1, 100, 1, 'query')]},
            {title: 'Sync status', method: 'GET', path: '/test/stream/sync-status'},
            {title: 'Take 2 photos', method: 'POST', path: '/test/camera/snap'}
        ]],
        ['Buzzer', [
            {title: 'Buzzer status', method: 'GET', path: '/test/buzzer'},
            {title: 'Play a pattern', method: 'POST', path: '/test/buzzer/play', fields: [sel('pattern', 'Pattern', ['ready', 'start', 'hold_still', 'photo_countdown', 'success', 'error'])]},
            {title: 'Play a tone', method: 'POST', path: '/test/buzzer/tone', fields: [num('frequency_hz', 'Frequency (Hz)', 880, 110, 1760, 1), num('duration_s', 'Duration (s)', 0.5, 0.1, 5, 0.1)]}
        ]],
        ['Maintenance & cloud', [
            {title: 'Cleanup (stop everything)', method: 'POST', path: '/test/cleanup'},
            {title: 'RunPod dry run (no pod, no cost)', method: 'POST', path: '/test/cloud/runpod-dry-run', fields: [num('resolution_level', 'Resolution level', 1, 0, 3, 1, 'query')]}
        ]]
    ];

    const cardsRoot = document.getElementById('hwtest-cards');
    if (cardsRoot) {
        const statusDiv = document.getElementById('hwtest-status');
        const responsePre = document.getElementById('hwtest-response');
        const previewImg = document.getElementById('hwtest-preview');

        const showPreview = (camera) => {
            previewImg.style.display = 'block';
            previewImg.src = `${API_URL}/test/stream/mjpeg?camera=${camera}&t=${Date.now()}`;
        };
        const hidePreview = () => { previewImg.style.display = 'none'; previewImg.removeAttribute('src'); };

        TEST_CARDS.forEach(([groupName, cards]) => {
            const heading = document.createElement('div');
            heading.style.cssText = 'font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-top: 12px;';
            heading.textContent = groupName;
            cardsRoot.appendChild(heading);

            cards.forEach((card) => {
                const box = document.createElement('div');
                box.className = 'setting-row-box';
                box.style.cssText = 'padding: 14px 16px; gap: 12px; flex-wrap: wrap; align-items: center;';

                const label = document.createElement('div');
                label.style.cssText = 'flex: 1 1 200px; font-weight: 600;';
                label.innerHTML = `${card.title}<div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">${card.method} ${card.path}</div>`;
                box.appendChild(label);

                const inputs = {};
                (card.fields || []).forEach((f) => {
                    const wrap = document.createElement('label');
                    wrap.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem; color: var(--text-muted);';
                    wrap.append(f.label);
                    let input;
                    if (f.type === 'select') {
                        input = document.createElement('select');
                        f.options.forEach(o => input.add(new Option(o, o)));
                    } else {
                        input = document.createElement('input');
                        input.type = f.type === 'checkbox' ? 'checkbox' : 'number';
                        if (f.type === 'number') { input.min = f.min; input.max = f.max; input.step = f.step; input.style.width = '90px'; }
                    }
                    if (f.type === 'checkbox') input.checked = f.value; else input.value = f.value;
                    if (f.type !== 'checkbox') input.style.cssText += 'padding: 6px; background: var(--bg-primary); color: var(--text-main); border: 1px solid var(--neutral-border); border-radius: 6px;';
                    inputs[f.name] = {f, input};
                    wrap.appendChild(input);
                    box.appendChild(wrap);
                });

                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.style.cssText = 'min-height: 36px; padding: 0 18px; font-size: 0.9rem;';
                btn.textContent = card.method === 'GET' ? 'Read' : 'Run';
                btn.addEventListener('click', async () => {
                    const query = new URLSearchParams();
                    const body = {};
                    Object.values(inputs).forEach(({f, input}) => {
                        const v = f.type === 'checkbox' ? input.checked : (f.type === 'number' ? parseFloat(input.value) : input.value);
                        if (f.skipIfEmpty && (input.value === '' || Number.isNaN(v))) return;
                        if (f.in === 'query') query.set(f.name, v); else body[f.name] = v;
                    });
                    const qs = query.toString();
                    const hasBody = Object.keys(body).length > 0;
                    btn.disabled = true;
                    const res = await sendRequest(card.method, card.path + (qs ? `?${qs}` : ''), hasBody ? body : null, statusDiv, responsePre);
                    btn.disabled = false;

                    if (res && res.ok) {
                        if (card.path === '/test/stream/start') showPreview(1);
                        else if (card.path === '/test/stream/active') showPreview(query.get('camera_id'));
                        else if (card.path === '/test/stream/stop' || card.path === '/test/cleanup') hidePreview();
                    }
                });
                box.appendChild(btn);
                cardsRoot.appendChild(box);
            });
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
                window.uiAlert("Failed to communicate with the hardware to toggle lights.");
            }
        });

        // 3. Modificare Slider
        lightsSlider.addEventListener('change', () => {
            if (lightsOn) {
                sendLightsRequest().catch(() => {
                    window.uiAlert("Failed to apply new brightness.");
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
            if (await window.uiConfirm("Are you sure you want to reboot the scanner?", { title: 'Reboot', okText: 'Reboot', danger: true })) {
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
                    window.uiAlert("Failed to initiate reboot command.");
                }
            }
        });
    }
});