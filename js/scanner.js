document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';

    // --- TOGGLE ADVANCED SETTINGS (Object Scan) ---
    const btnToggleAdv = document.getElementById('btn-toggle-adv');
    const advContainer = document.getElementById('advanced-settings-container');
    if(btnToggleAdv && advContainer) {
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

    // --- TOGGLE ADVANCED SETTINGS (Face Scan) ---
    const btnToggleAdvFace = document.getElementById('btn-toggle-adv-face');
    const advContainerFace = document.getElementById('advanced-settings-container-face');
    if(btnToggleAdvFace && advContainerFace) {
        btnToggleAdvFace.addEventListener('click', () => {
            if(advContainerFace.style.display === 'none') {
                advContainerFace.style.display = 'flex';
                btnToggleAdvFace.innerText = 'Hide Advanced Settings ▲';
            } else {
                advContainerFace.style.display = 'none';
                btnToggleAdvFace.innerText = 'Show Advanced Settings ▼';
            }
        });
    }

    // --- HELPER: SET VALUE ---
    const setSliderValue = (id, val, textSuffix = '', decimals = 0) => {
        const slider = document.getElementById(id);
        const textVal = document.getElementById(id + '-val');
        if (slider && textVal) {
            slider.value = val;
            textVal.innerText = parseFloat(slider.value).toFixed(decimals) + textSuffix;
        }
    };

    // --- SYNC SLIDERS ---
    const syncSlider = (id, suffix = '', decimals = 0) => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        if(slider && val) {
            slider.addEventListener('input', () => {
                val.innerText = parseFloat(slider.value).toFixed(decimals) + suffix;
            });
        }
    };
    
    // Sync Sliders: Object Scan
    syncSlider('cfg-obj-z', '', 1);          // z_start_mm: multiple of 8
    syncSlider('cfg-obj-delay-tt', '', 3);
    syncSlider('cfg-obj-photo-q', '%'); 
    syncSlider('cfg-adv-delay-z', '', 4);    // 0.001 - 0.003
    syncSlider('cfg-adv-distance-z');        // z_axis.distance_mm: multiple of 8
    syncSlider('cfg-adv-led', '%'); 
    syncSlider('cfg-obj-turntable', '°', 1);
    syncSlider('cfg-obj-focus-val');
    syncSlider('cfg-obj-focus-cam1');
    syncSlider('cfg-obj-focus-cam2');

    // Sync Sliders: Face Scan
    syncSlider('cfg-face-start-z');
    syncSlider('cfg-face-photo-q', '%');
    syncSlider('cfg-face-led', '%');
    syncSlider('cfg-face-search-range');
    syncSlider('cfg-face-step');
    syncSlider('cfg-face-manual-z');
    syncSlider('cfg-face-delay-z', '', 4);   // 0.001 - 0.003
    syncSlider('cfg-face-focus-val');
    syncSlider('cfg-face-focus-cam1');
    syncSlider('cfg-face-focus-cam2');

    // --- TOGGLE STREAM RUNPOD (Streaming Pod) ---
    const toggleStreamPod = document.getElementById('toggle-stream-pod');
    if (toggleStreamPod) {
        toggleStreamPod.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    }

    // --- FOCUS MODE TOGGLES (Object & Face) ---
    const focusObjMode = document.getElementById('cfg-obj-focus-mode');
    const boxObjFocusVal = document.getElementById('box-obj-focus-val');
    const boxObjFocusTuple = document.getElementById('box-obj-focus-tuple');
    if (focusObjMode) {
        focusObjMode.addEventListener('change', (e) => {
            const v = e.target.value;
            if (boxObjFocusVal) boxObjFocusVal.style.display = v === 'custom' ? 'flex' : 'none';
            if (boxObjFocusTuple) boxObjFocusTuple.style.display = v === 'tuple' ? 'flex' : 'none';
        });
    }

    const focusFaceMode = document.getElementById('cfg-face-focus-mode');
    const boxFaceFocusVal = document.getElementById('box-face-focus-val');
    const boxFaceFocusTuple = document.getElementById('box-face-focus-tuple');
    if (focusFaceMode) {
        focusFaceMode.addEventListener('change', (e) => {
            const v = e.target.value;
            if (boxFaceFocusVal) boxFaceFocusVal.style.display = v === 'custom' ? 'flex' : 'none';
            if (boxFaceFocusTuple) boxFaceFocusTuple.style.display = v === 'tuple' ? 'flex' : 'none';
        });
    }

    function getFocusParam(prefix) {
        const mode = document.getElementById(`${prefix}-focus-mode`)?.value || 'auto';
        if (mode === 'none') return null;
        if (mode === 'custom') {
            const raw = parseInt(document.getElementById(`${prefix}-focus-val`)?.value || '512', 10);
            return isNaN(raw) ? 512 : Math.max(0, Math.min(1023, raw));
        }
        if (mode === 'tuple') {
            const c1 = parseInt(document.getElementById(`${prefix}-focus-cam1`)?.value || '512', 10);
            const c2 = parseInt(document.getElementById(`${prefix}-focus-cam2`)?.value || '512', 10);
            const val1 = isNaN(c1) ? 512 : Math.max(0, Math.min(1023, c1));
            const val2 = isNaN(c2) ? 512 : Math.max(0, Math.min(1023, c2));
            return [val1, val2];
        }
        return 'auto';
    }

    // Logică pentru a activa Manual Z doar când Search Strategy este 'none'
    const strategySelect = document.getElementById('cfg-face-strategy');
    const boxManualZ = document.getElementById('box-face-manual-z');
    if(strategySelect && boxManualZ) {
        strategySelect.addEventListener('change', (e) => {
            if(e.target.value === 'none') {
                boxManualZ.style.opacity = '1';
                boxManualZ.style.pointerEvents = 'auto';
            } else {
                boxManualZ.style.opacity = '0.5';
                boxManualZ.style.pointerEvents = 'none';
            }
        });
    }

    // --- RESET DEFAULTS ---
    const btnResetObj = document.getElementById('btn-reset-obj-defaults');
    if (btnResetObj) {
        btnResetObj.addEventListener('click', () => {
            setSliderValue('cfg-obj-z', 32, '', 1);
            setSliderValue('cfg-obj-turntable', 18.0, '°', 1);
            setSliderValue('cfg-obj-delay-tt', 0.01, '', 3);
            setSliderValue('cfg-obj-photo-q', 95, '%');
            setSliderValue('cfg-adv-delay-z', 0.001, '', 4);
            setSliderValue('cfg-adv-distance-z', 80);
            
            const objRes = document.getElementById('cfg-obj-preview-res');
            if (objRes) objRes.value = '960x720';

            setSliderValue('cfg-adv-led', 100, '%');
            if (toggleStreamPod) toggleStreamPod.classList.add('active');
            if (focusObjMode) focusObjMode.value = 'auto';
            if (boxObjFocusVal) boxObjFocusVal.style.display = 'none';
            if (boxObjFocusTuple) boxObjFocusTuple.style.display = 'none';
            setSliderValue('cfg-obj-focus-val', 512);
            setSliderValue('cfg-obj-focus-cam1', 512);
            setSliderValue('cfg-obj-focus-cam2', 512);
        });
    }

    const btnResetFace = document.getElementById('btn-reset-face-defaults');
    if (btnResetFace) {
        btnResetFace.addEventListener('click', () => {
            setSliderValue('cfg-face-start-z', 144);
            setSliderValue('cfg-face-delay-z', 0.001, '', 4);
            setSliderValue('cfg-face-photo-q', 95, '%');
            setSliderValue('cfg-face-led', 35, '%');
            
            if(strategySelect) strategySelect.value = 'direct_stop';
            if(boxManualZ) {
                boxManualZ.style.opacity = '0.5';
                boxManualZ.style.pointerEvents = 'none';
            }
            
            setSliderValue('cfg-face-search-range', 48);
            setSliderValue('cfg-face-step', 8);
            setSliderValue('cfg-face-manual-z', 200);
            if (focusFaceMode) focusFaceMode.value = 'auto';
            if (boxFaceFocusVal) boxFaceFocusVal.style.display = 'none';
            if (boxFaceFocusTuple) boxFaceFocusTuple.style.display = 'none';
            setSliderValue('cfg-face-focus-val', 512);
            setSliderValue('cfg-face-focus-cam1', 512);
            setSliderValue('cfg-face-focus-cam2', 512);
        });
    }

    // Optional name / description typed before the scan. The name goes in the start request (title);
    // the API has no description field there, so scanning-progress.js saves it with PATCH once the model exists.
    const readTitle = (id) => document.getElementById(id)?.value.trim() || null;
    function savePendingDetails(titleId, descId) {
        const title = readTitle(titleId);
        const desc = document.getElementById(descId)?.value.trim();
        try {
            title ? localStorage.setItem('pendingScanTitle', title) : localStorage.removeItem('pendingScanTitle');
            desc ? localStorage.setItem('pendingScanDescription', desc) : localStorage.removeItem('pendingScanDescription');
        } catch (e) {}
    }

    // --- TRIGGER HARDWARE PREPARE ---
    async function callPrepareAndRedirect(preparePayload, startPayload, mode, endpoint) {
        try {
            localStorage.setItem('scanMode', mode);
            // Salvăm setările pentru a doua etapă în locaStorage
            localStorage.setItem('pendingScanSettings', JSON.stringify(startPayload));

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preparePayload)
            });

            if (response.ok || response.status === 202) {
                window.location.href = `scanning.html?mode=${mode}`;
            } else {
                window.uiAlert(`Scanner refused the request:\n${await window.apiError(response)}`);
                
                const btnObjPrep = document.getElementById('btn-start-obj-prep');
                if (btnObjPrep) btnObjPrep.innerText = "▶ Prepare Scan";
                const btnFacePrep = document.getElementById('btn-start-face-prep');
                if (btnFacePrep) btnFacePrep.innerText = "▶ Prepare Face Scan";
            }
        } catch (error) {
            window.uiAlert("Error calling prepare endpoint. Is the backend running?");
            const btnObjPrep = document.getElementById('btn-start-obj-prep');
            if (btnObjPrep) btnObjPrep.innerText = "▶ Prepare Scan";
            const btnFacePrep = document.getElementById('btn-start-face-prep');
            if (btnFacePrep) btnFacePrep.innerText = "▶ Prepare Face Scan";
        }
    }

    // An object scan uploads the photos as they are taken, and the server refuses network changes
    // while it runs: a dropped Wi-Fi then loses the scan. Warn before starting without a cable.
    async function confirmNetworkForCloudScan() {
        try {
            const res = await fetch(`${API_URL}/system/status`);
            if (!res.ok) return true;
            const sys = await res.json();
            const cable = sys.ethernet && sys.ethernet.connected;
            const wifi = sys.wifi && sys.wifi.connected;
            if (!cable && !wifi) {
                return window.uiConfirm("The scanner is not connected to any network, so the photos cannot be uploaded and the scan will fail.\n\nStart anyway?");
            }
            if (!cable) {
                return window.uiConfirm("The scanner is connected by Wi-Fi only. Network settings are locked during a scan, and if the Wi-Fi drops the scan is lost.\n\nPlug in the Ethernet cable if you can. Start anyway?");
            }
        } catch (e) {}
        return true;
    }

    // --- START BUTTON (OBJECT SCAN) ---
    const btnObjPrep = document.getElementById('btn-start-obj-prep');
    if(btnObjPrep) {
        btnObjPrep.addEventListener('click', async () => {
            if (!(await confirmNetworkForCloudScan())) return;

            let previewRes = [960, 720];
            const uiPrevRes = document.getElementById('cfg-obj-preview-res')?.value;
            if (uiPrevRes) {
                const parts = uiPrevRes.split('x');
                if (parts.length === 2) previewRes = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
            }

            const ledBrightness = parseFloat(document.getElementById('cfg-adv-led')?.value || 100) / 100;
            const photoQuality = parseInt(document.getElementById('cfg-obj-photo-q')?.value || 95);
            const zDelay = parseFloat(document.getElementById('cfg-adv-delay-z')?.value || 0.001);

            // PAYLOAD 1: Doar ce cere /scanner/prepare
            const preparePayload = {
                "enable_stream": true,
                "illumination_brightness": ledBrightness,
                "z_start_mm": parseFloat(document.getElementById('cfg-obj-z')?.value ?? 32),
                "camera_config": {
                    "quality": photoQuality,
                    "photo_resolution": [4056, 3040],
                    "preview_resolution": previewRes,
                    "focus": getFocusParam('cfg-obj')
                }
            };

            const turntableAngle = parseFloat(document.getElementById('cfg-obj-turntable')?.value || 18.0); 
            const streamPod = toggleStreamPod ? toggleStreamPod.classList.contains('active') : true;

            // PAYLOAD 2: Ce vom trimite la /scanner/start de pe pagina de progres
            const startPayload = {
                "job_id": null,
                "mechanical": {
                    "turntable": {
                        "angle": turntableAngle,
                        "delay": parseFloat(document.getElementById('cfg-obj-delay-tt')?.value || 0.01),
                        "acceleration": true,
                        "ramp_percent": 0.4,   // acceleration
                        "decel_percent": 0.5,  // deceleration
                        "end_delay": 0.015
                    },
                    "z_axis": {
                        "distance_mm": parseFloat(document.getElementById('cfg-adv-distance-z')?.value || 80), 
                        "delay": zDelay,
                        "acceleration": false,
                        "ramp_percent": 0.2
                    }
                },
                "cloud": {
                    "launch_runpod": true,
                    "resolution_level": 1,
                    "title": readTitle('cfg-obj-title'),
                    "start_pod_with_scan": streamPod
                }
            };
            savePendingDetails('cfg-obj-title', 'cfg-obj-desc');

            btnObjPrep.innerText = "Preparing Hardware...";
            callPrepareAndRedirect(preparePayload, startPayload, 'object', '/scanner/prepare');
        });
    }

    // --- START BUTTON (FACE SCAN) ---
    const btnFacePrep = document.getElementById('btn-start-face-prep');
    if(btnFacePrep) {
        btnFacePrep.addEventListener('click', () => {
            const faceQuality = parseInt(document.getElementById('cfg-face-photo-q')?.value || 95);
            const faceBrightness = parseFloat(document.getElementById('cfg-face-led')?.value || 35) / 100;
            const startZ = parseFloat(document.getElementById('cfg-face-start-z')?.value || 144);
            const zDelay = parseFloat(document.getElementById('cfg-face-delay-z')?.value || 0.001);
            
            // PAYLOAD 1: Doar ce cere /scanner/face/prepare
            const preparePayload = {
                "enable_stream": true,
                "illumination_brightness": faceBrightness,
                "start_z_mm": startZ,
                "upload_r2": false, // fața rămâne pe Pi (default API)
                "z_delay": zDelay,
                "camera_config": {
                    "quality": faceQuality,
                    "focus": getFocusParam('cfg-face')
                }
            };
            
            const strategy = document.getElementById('cfg-face-strategy')?.value || 'direct_stop';
            const searchRange = parseFloat(document.getElementById('cfg-face-search-range')?.value || 48);
            const stepMm = parseFloat(document.getElementById('cfg-face-step')?.value || 8);
            const manualZVal = parseFloat(document.getElementById('cfg-face-manual-z')?.value || 200);
            
            const manualZ = strategy === 'none' ? manualZVal : null;

            // PAYLOAD 2: Ce vom trimite la /scanner/face/capture de pe pagina de progres
            const startPayload = {
                "strategy": strategy,
                "search_range_mm": searchRange,
                "step_mm": stepMm,
                "manual_z": manualZ,
                "settle_s": 0.15,
                "title": readTitle('cfg-face-title'),
                "reconstruct": true // Vrem model 3D
            };
            savePendingDetails('cfg-face-title', 'cfg-face-desc');

            btnFacePrep.innerText = "Preparing Hardware...";
            callPrepareAndRedirect(preparePayload, startPayload, 'face', '/scanner/face/prepare');
        });
    }
});