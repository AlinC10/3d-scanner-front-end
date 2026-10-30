document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000') 
                    ? `http://${window.location.hostname}:8000` 
                    : 'http://127.0.0.1:8000';
    let statusInterval = null;
    let hasSentStartCommand = false;

    const urlParams = new URLSearchParams(window.location.search);
    const scanMode = urlParams.get('mode') || localStorage.getItem('scanMode') || 'object';

    // Extragem setările avansate pregătite din pasul anterior
    let pendingScanSettings = {};
    try {
        const storedSettings = localStorage.getItem('pendingScanSettings');
        if (storedSettings) pendingScanSettings = JSON.parse(storedSettings);
    } catch (e) {
        console.error("Failed to parse pendingScanSettings:", e);
    }

    const statusTitle = document.getElementById('scan-status-title');
    const phaseMessage = document.getElementById('scan-phase-message');
    const scanStream = document.getElementById('active-scan-stream');
    
    const inputGroup = document.getElementById('scan-input-group'); 
    
    const progressContainer = document.getElementById('scan-progress-container');
    const progressBar = document.getElementById('scan-progress-bar');
    const progressText = document.getElementById('scan-progress-text');
    const progressPct = document.getElementById('scan-progress-pct');

    const btnCancel = document.getElementById('btn-cancel-scan');
    const btnSwitchCamera = document.getElementById('btn-switch-camera');
    const switchCamText = document.getElementById('switch-cam-text');
    const actionsGroup = document.getElementById('scan-actions-group');

    // UI pt Salvare Detalii
    const btnSaveDetails = document.getElementById('btn-save-details');
    const btnSkipDetails = document.getElementById('btn-skip-details');
    let libraryResultId = null;

    // --- 1. SCHIMBARE CAMERE ---
    let activeCameraId = 1;
    let retryTimer = null;
    const MAX_STREAM_RETRIES = 120; 

    function streamUrl(camId) {
        return `${API_URL}/scanner/stream/mjpeg?camera=${camId}&t=${new Date().getTime()}`;
    }

    function loadStream(camId, attempt = 0) {
        if (!scanStream) return;
        clearTimeout(retryTimer);
        scanStream.onerror = null;
        scanStream.removeAttribute('src');

        retryTimer = setTimeout(() => {
            scanStream.onerror = () => {
                if (attempt < MAX_STREAM_RETRIES) {
                    retryTimer = setTimeout(() => loadStream(camId, attempt + 1), 1000);
                } else {
                    console.error(`Camera ${camId} timeout.`);
                    if(statusTitle && !hasSentStartCommand) statusTitle.innerText = "Camera stream failed to load.";
                }
            };
            scanStream.src = streamUrl(camId);
        }, 150);
    }

    loadStream(activeCameraId);

    if (btnSwitchCamera) {
        btnSwitchCamera.addEventListener('click', (e) => {
            e.preventDefault();
            activeCameraId = (activeCameraId === 1) ? 2 : 1;
            if (switchCamText) switchCamText.innerText = `Switch Camera (Cam ${activeCameraId})`;
            loadStream(activeCameraId);
        });
    }

    // --- 2. CANCEL ACTION ---
    async function triggerCancel() {
        if (statusInterval) clearInterval(statusInterval);
        clearTimeout(retryTimer);
        if (statusTitle) statusTitle.innerText = "Canceling...";
        try { await fetch(`${API_URL}/scanner/cancel`, { method: 'POST' }); } catch (e) {}
        window.location.href = 'index.html';
    }
    if (btnCancel) btnCancel.addEventListener('click', triggerCancel);


    // --- 3. AUTO-START SCAN (Se declanșează instant când e PREPARED) ---
    async function fireStartCommand() {
        try {
            progressContainer.style.display = 'block'; 

            if (scanMode === 'face') {
                statusTitle.innerText = "Status: Capturing Face...";
                const faceRes = await fetch(`${API_URL}/scanner/face/capture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pendingScanSettings)
                });
                
                if (!faceRes.ok) {
                    const errText = await faceRes.text();
                    statusTitle.innerText = "Server Rejected Start Command!";
                    phaseMessage.innerText = errText;
                    statusTitle.style.color = "#ef4444";
                    progressContainer.style.display = 'none';
                    return; 
                }
            } else {
                statusTitle.innerText = "Status: Starting Object Scan...";
                const startRes = await fetch(`${API_URL}/scanner/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pendingScanSettings)
                });
                
                if (!startRes.ok) {
                    const errText = await startRes.text();
                    statusTitle.innerText = "Server Rejected Start Command!";
                    phaseMessage.innerText = errText;
                    statusTitle.style.color = "#ef4444";
                    progressContainer.style.display = 'none';
                    return; 
                }
            }
            
            localStorage.removeItem('pendingScanSettings'); 
        } catch (error) {
            console.error(error);
            statusTitle.innerText = "Network Error Triggering Scan!";
            statusTitle.style.color = "#ef4444";
        }
    }

    // --- 4. SALVARE METADATE (Titlu/Descriere la final) ---
    async function saveFinalDetails() {
        if (!libraryResultId) return window.location.href = 'library.html';
        
        const t = document.getElementById('scan-title-input').value.trim();
        const d = document.getElementById('scan-desc-input').value.trim();
        const payload = {};
        if(t) payload.title = t;
        if(d) payload.description = d;
        
        if (Object.keys(payload).length > 0) {
            btnSaveDetails.innerText = "Saving...";
            try {
                await fetch(`${API_URL}/library/objects/${libraryResultId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload) 
                });
            } catch(e) { console.error("Could not save metadata", e); }
        }
        window.location.href = 'library.html';
    }

    if(btnSaveDetails) btnSaveDetails.addEventListener('click', saveFinalDetails);
    if(btnSkipDetails) btnSkipDetails.addEventListener('click', () => window.location.href = 'library.html');


    // --- 5. POLLING PENTRU STATUS ---
    function initStatusPolling() {
        if (statusTitle) {
            statusTitle.innerText = scanMode === 'face'
                ? "Status: Warming up (Face Mode)..."
                : "Status: Warming up (Object Mode)...";
        }

        statusInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/scanner/status`);
                if (res.ok) {
                    const data = await res.json();
                    
                    // Indiferent că e trimis ca 'PREPARED', 'Prepared' sau 'prepared', îl normalizăm
                    const rawState = data.state || '';
                    const currentState = rawState.toLowerCase();

                    if (data.phase_message && phaseMessage && !statusTitle.innerText.includes("Rejected")) {
                        phaseMessage.innerText = data.phase_message;
                    }

                    // 👉 5.1 PREPARED TRIGGER - Instant FĂRĂ delay!
                    if (currentState === 'prepared' && !hasSentStartCommand) {
                        hasSentStartCommand = true;
                        statusTitle.innerText = "Status: Initializing Capture...";
                        
                        // Firing instant!
                        fireStartCommand();
                    }

                    // 5.2 PROGRESS BAR (Când chiar e în mișcare)
                    if ((currentState === 'running' || currentState === 'processing' || currentState === 'downloading') && hasSentStartCommand) {
                        let displayState = currentState.charAt(0).toUpperCase() + currentState.slice(1);
                        statusTitle.innerText = `Status: ${displayState}`;
                        progressContainer.style.display = 'block';
                        
                        if (currentState === 'running' && data.total_photos && data.total_photos > 0) {
                            const up = data.photos_uploaded || 0;
                            const tot = data.total_photos;
                            const pct = Math.round((up / tot) * 100);
                            
                            progressBar.style.width = `${pct}%`;
                            progressText.innerText = `${up} / ${tot} Photos Uploaded`;
                            progressPct.innerText = `${pct}%`;
                            progressBar.style.opacity = '1';
                        } else {
                            progressBar.style.width = '100%';
                            progressBar.style.opacity = '0.5';
                            progressText.innerText = data.phase_message ? "Working..." : "Processing Model in Cloud...";
                            progressPct.innerText = "Wait";
                        }
                    }

                    // 5.3 FINALIZAREA
                    const finalStates = ["completed", "error", "cancelled"];
                    if (finalStates.includes(currentState)) {
                        clearInterval(statusInterval);

                        if (currentState === "error") {
                            if (statusTitle) {
                                statusTitle.innerText = `Error: ${data.error || "Hardware Failure"}`;
                                statusTitle.style.color = "#ef4444";
                            }
                            phaseMessage.innerText = "Please check the scanner and try again.";
                        } 
                        else if (currentState === "cancelled") {
                            if (statusTitle) {
                                statusTitle.innerText = "Scan Cancelled.";
                                statusTitle.style.color = "#f59e0b";
                            }
                            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
                        } 
                        else if (currentState === "completed") {
                            if (statusTitle) {
                                statusTitle.innerText = "Scan completed successfully!";
                                statusTitle.style.color = "#10b981";
                            }
                            phaseMessage.innerText = "Please name your scan before viewing it.";
                            
                            progressContainer.style.display = 'none';
                            btnCancel.style.display = 'none';
                            btnSwitchCamera.style.display = 'none';
                            
                            if (scanMode === 'face' && data.face_result) {
                                libraryResultId = data.face_result.result_id;
                            } else {
                                libraryResultId = data.result_id;
                            }

                            // Afișăm formularul final pentru editare Titlu/Descriere
                            inputGroup.style.display = 'flex';
                        }
                    }
                }
            } catch (e) {
                console.warn("Polling error:", e);
            }
        }, 1000); // Scăzut de la 1500ms la 1000ms pentru a prinde și mai repede starea PREPARED
    }

    initStatusPolling();
});