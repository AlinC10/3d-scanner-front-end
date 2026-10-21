document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';

    // --- TOGGLE ADVANCED SETTINGS ---
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

    // --- SYNC SLIDERS ---
    const syncSlider = (id) => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        if(slider && val) slider.addEventListener('input', () => val.innerText = slider.value);
    }
    
    syncSlider('cfg-obj-photo-q'); 
    syncSlider('cfg-adv-stream-q'); 
    syncSlider('cfg-adv-acc'); 
    syncSlider('cfg-adv-dec'); 
    syncSlider('cfg-adv-bright'); 
    syncSlider('cfg-adv-led');

    // --- BUILD JSON PAYLOAD ---
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

    // --- TRIGGER HARDWARE PREPARE ---
    async function callPrepareAndRedirect(payload) {
        try {
            const response = await fetch(`${API_URL}/scanner/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Redirecționăm către ecranul de monitorizare a scanării
                window.location.href = 'scanning.html';
            } else {
                alert("Failed to prepare scanner hardware. Check connections.");
            }
        } catch (error) {
            alert("Error calling prepare endpoint. Is the backend running?");
        }
    }

    // --- BUTOANELE DE START ---
    const btnObjPrep = document.getElementById('btn-start-obj-prep');
    if(btnObjPrep) {
        btnObjPrep.addEventListener('click', () => {
            const objPayload = buildObjectConfigJSON();
            btnObjPrep.innerText = "Preparing...";
            callPrepareAndRedirect(objPayload);
        });
    }

    const btnFacePrep = document.getElementById('btn-start-face-prep');
    if(btnFacePrep) {
        btnFacePrep.addEventListener('click', () => {
            // Setări implicite pentru scanare facială
            const facePayload = {
                basic: { photo_resolution: "1920x1080", preview_resolution: "1012x760" }
            };
            btnFacePrep.innerText = "Preparing...";
            callPrepareAndRedirect(facePayload);
        });
    }
});