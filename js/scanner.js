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
    const setSliderValue = (id, val, textSuffix = '') => {
        const slider = document.getElementById(id);
        const textVal = document.getElementById(id + '-val');
        if (slider && textVal) {
            slider.value = val;
            textVal.innerText = parseFloat(val).toFixed(1) + textSuffix;
        }
    };

    // --- SYNC SLIDERS ---
    const syncSlider = (id, suffix = '', isFloat = false) => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        if(slider && val) {
            slider.addEventListener('input', () => {
                let displayVal = slider.value;
                if (isFloat) displayVal = parseFloat(slider.value).toFixed(1);
                val.innerText = displayVal + suffix;
            });
        }
    };
    
    // Sync Sliders: Object Scan
    syncSlider('cfg-obj-z');
    syncSlider('cfg-obj-delay-tt');
    syncSlider('cfg-obj-photo-q', '%'); 
    syncSlider('cfg-adv-delay-z');
    syncSlider('cfg-adv-led', '%'); 
    
    // Noul slider pentru rotație (valori continue, pas de 1.8)
    syncSlider('cfg-obj-turntable', '°', true); 

    // Sync Sliders: Face Scan
    syncSlider('cfg-face-start-z');
    syncSlider('cfg-face-photo-q', '%');
    syncSlider('cfg-face-led', '%');
    syncSlider('cfg-face-search-range');
    syncSlider('cfg-face-step');
    syncSlider('cfg-face-manual-z');

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
            setSliderValue('cfg-obj-z', 80);
            setSliderValue('cfg-obj-turntable', 18.0, '°');
            setSliderValue('cfg-obj-delay-tt', 0.01);
            setSliderValue('cfg-obj-photo-q', 95, '%');
            setSliderValue('cfg-adv-delay-z', 0.01);
            
            const objRes = document.getElementById('cfg-obj-preview-res');
            if (objRes) objRes.value = '1012x760';

            setSliderValue('cfg-adv-led', 100, '%');
        });
    }

    const btnResetFace = document.getElementById('btn-reset-face-defaults');
    if (btnResetFace) {
        btnResetFace.addEventListener('click', () => {
            setSliderValue('cfg-face-start-z', 150);
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
        });
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
                const errorData = await response.text();
                alert(`Backend Validation Error:\n${errorData}`);
                
                const btnObjPrep = document.getElementById('btn-start-obj-prep');
                if (btnObjPrep) btnObjPrep.innerText = "▶ Prepare Scan";
                const btnFacePrep = document.getElementById('btn-start-face-prep');
                if (btnFacePrep) btnFacePrep.innerText = "▶ Prepare Face Scan";
            }
        } catch (error) {
            alert("Error calling prepare endpoint. Is the backend running?");
            const btnObjPrep = document.getElementById('btn-start-obj-prep');
            if (btnObjPrep) btnObjPrep.innerText = "▶ Prepare Scan";
            const btnFacePrep = document.getElementById('btn-start-face-prep');
            if (btnFacePrep) btnFacePrep.innerText = "▶ Prepare Face Scan";
        }
    }

    // --- START BUTTON (OBJECT SCAN) ---
    const btnObjPrep = document.getElementById('btn-start-obj-prep');
    if(btnObjPrep) {
        btnObjPrep.addEventListener('click', () => {
            let previewRes = [1012, 760];
            const uiPrevRes = document.getElementById('cfg-obj-preview-res')?.value;
            if (uiPrevRes) {
                const parts = uiPrevRes.split('x');
                if (parts.length === 2) previewRes = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
            }

            const ledBrightness = parseFloat(document.getElementById('cfg-adv-led')?.value || 100) / 100;
            const photoQuality = parseInt(document.getElementById('cfg-obj-photo-q')?.value || 95);

            // PAYLOAD 1: Doar ce cere /scanner/prepare
            const preparePayload = {
                "enable_stream": true,
                "illumination_brightness": ledBrightness,
                "z_start_mm": parseFloat(document.getElementById('cfg-obj-z')?.value || 80),
                "camera_config": {
                    "quality": photoQuality,
                    "photo_resolution": [4056, 3040],
                    "preview_resolution": previewRes,
                    "focus": "auto"
                }
            };

            const turntableAngle = parseFloat(document.getElementById('cfg-obj-turntable')?.value || 18.0); 

            // PAYLOAD 2: Ce vom trimite la /scanner/start de pe pagina de progres
            const startPayload = {
                "job_id": null,
                "mechanical": {
                    "turntable": {
                        "angle": turntableAngle,
                        "delay": parseFloat(document.getElementById('cfg-obj-delay-tt')?.value || 0.01),
                        "acceleration": true,
                        "ramp_percent": 0.2,
                        "end_delay": 0.015
                    },
                    "z_axis": {
                        "distance_mm": 100.0, 
                        "delay": parseFloat(document.getElementById('cfg-adv-delay-z')?.value || 0.01),
                        "acceleration": false,
                        "ramp_percent": 0.2
                    }
                },
                "cloud": {
                    "launch_runpod": true,
                    "resolution_level": 1,
                    "title": null
                }
            };

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
            const startZ = parseFloat(document.getElementById('cfg-face-start-z')?.value || 150);
            
            // PAYLOAD 1: Doar ce cere /scanner/face/prepare
            const preparePayload = {
                "enable_stream": true,
                "illumination_brightness": faceBrightness,
                "start_z_mm": startZ,
                "upload_r2": true, // Să fie salvate în cloud
                "camera_config": {
                    "quality": faceQuality,
                    "focus": "auto" // Auto focus la captură
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
                "reconstruct": true // Vrem model 3D
            };

            btnFacePrep.innerText = "Preparing Hardware...";
            callPrepareAndRedirect(preparePayload, startPayload, 'face', '/scanner/face/prepare');
        });
    }
});