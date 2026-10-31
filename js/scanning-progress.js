document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000') 
                    ? `http://${window.location.hostname}:8000` 
                    : 'http://127.0.0.1:8000';
    let statusInterval = null;
    let hasSentStartCommand = false;

    const urlParams = new URLSearchParams(window.location.search);
    let scanMode = urlParams.get('mode') || localStorage.getItem('scanMode') || 'object';

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
    const cloudMessage = document.getElementById('scan-cloud-message');
    const btnRetryCloud = document.getElementById('btn-retry-cloud');
    const btnRetakeFace = document.getElementById('btn-retake-face');
    const uploadWarning = document.getElementById('scan-upload-warning');
    const connWarning = document.getElementById('scan-conn-warning');

    const UPLOAD_WARN_BEFORE_S = 60;   // warn this long before the upload drain timeout fails the run
    const CONN_LOST_AFTER = 3;         // failed status requests in a row (~3 s) before "connection lost"
    let statusFailures = 0;
    let scanEnded = false;             // error / completed: the red button only leads back to the menu
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
    let lastStatusKey = '';

    // --- 1. SCHIMBARE CAMERE ---
    let activeCameraId = 1;
    let retryTimer = null;
    const MAX_STREAM_RETRIES = 120; 

    function streamUrl(camId) {
        return `${API_URL}/scanner/stream/mjpeg?camera=${camId}&t=${new Date().getTime()}`;
    }

    // After the photos are taken the cameras stop: drop the <img> (its last frame would stay
    // frozen on screen), stop the reload retries and centre the status panel.
    let streamStopped = false;
    function stopStreamView() {
        if (streamStopped) return;
        streamStopped = true;
        clearTimeout(retryTimer);
        if (scanStream) {
            scanStream.onerror = null;
            scanStream.removeAttribute('src');
            scanStream.style.display = 'none';
        }
        if (btnSwitchCamera) btnSwitchCamera.style.display = 'none';
        document.querySelector('.scanning-container')?.classList.add('stream-off');
    }

    function loadStream(camId, attempt = 0) {
        if (!scanStream || streamStopped) return;
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
            if (streamStopped) return;
            activeCameraId = (activeCameraId === 1) ? 2 : 1;
            if (switchCamText) switchCamText.innerText = `Switch Camera (Cam ${activeCameraId})`;
            loadStream(activeCameraId);
        });
    }

    // Warn when the connection drops during the scan (photos are uploaded as they are taken)
    window.addEventListener('network-state', (e) => {
        if (!phaseMessage || !hasSentStartCommand || statusInterval === null) return;
        let warn = document.getElementById('scan-net-warning');
        if (!warn) {
            warn = document.createElement('div');
            warn.id = 'scan-net-warning';
            warn.style.cssText = 'color:#f59e0b; font-size:0.85rem; text-align:center; margin-bottom:16px;';
            phaseMessage.insertAdjacentElement('afterend', warn);
        }
        const offline = !e.detail.ethernet && !e.detail.wifi;
        warn.innerText = offline ? '⚠ No network connection: photo upload is paused. Plug in the Ethernet cable.' : '';
    });

    // --- 2. CANCEL ACTION ---
    async function triggerCancel() {
        if (scanEnded) {                    // nothing runs any more: no emergency stop, just leave
            markScanSeen();
            window.location.href = 'index.html';
            return;
        }
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
                    const errText = await window.apiError(faceRes);
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
                    const errText = await window.apiError(startRes);
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
    function markScanSeen() {
        try { sessionStorage.setItem('scanMonitorDismissed', lastStatusKey); } catch (e) {}
    }

    async function saveFinalDetails() {
        markScanSeen();
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
    if(btnSkipDetails) btnSkipDetails.addEventListener('click', () => { markScanSeen(); window.location.href = 'library.html'; });


    // --- 5. POLLING PENTRU STATUS ---
    function initStatusPolling(keepTitle = false) {
        if (statusTitle && !keepTitle) {
            statusTitle.innerText = scanMode === 'face'
                ? "Status: Warming up (Face Mode)..."
                : "Status: Warming up (Object Mode)...";
        }

        statusInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/scanner/status`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                {
                    const data = await res.json();
                    // answered again: a single missed request never shows the warning
                    statusFailures = 0;
                    if (connWarning) connWarning.style.display = 'none';
                    
                    // Indiferent că e trimis ca 'PREPARED', 'Prepared' sau 'prepared', îl normalizăm
                    const rawState = data.state || '';
                    const currentState = rawState.toLowerCase();
                    lastStatusKey = `${currentState}:${data.job_id || ''}:${data.result_id || ''}`;

                    // Returning to a scan that already started: do not send start again, just follow it
                    if (!hasSentStartCommand && ['running', 'processing', 'downloading'].includes(currentState)) {
                        hasSentStartCommand = true;
                        if (data.mode) scanMode = data.mode;
                    }

                    // Cameras are off once the run reaches the cloud / face reconstruction step
                    if (hasSentStartCommand && (currentState === 'processing' || currentState === 'downloading' || data.phase === 'reconstructing_face')) {
                        stopStreamView();
                    }

                    if (data.phase_message && phaseMessage && !statusTitle.innerText.includes("Rejected")) {
                        phaseMessage.innerText = data.phase_message;
                    }

                    // cloud_message: detail line of the cloud processing (null outside of it)
                    if (cloudMessage) {
                        cloudMessage.innerText = data.cloud_message || '';
                        cloudMessage.style.display = data.cloud_message ? 'block' : 'none';
                    }
                    updateUploadWarning(data, currentState);

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
                            const cap = data.photos_captured || 0;
                            const ring = data.level ? `Ring ${data.level} · ` : '';
                            progressText.innerText = `${ring}${cap} captured · ${up} / ${tot} uploaded`;
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
                        stopStreamView();
                        if (cloudMessage) cloudMessage.style.display = 'none';
                        if (uploadWarning) uploadWarning.style.display = 'none';
                        if (currentState !== 'cancelled') {
                            scanEnded = true;
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.style.borderColor = 'var(--neutral-border)';
                            btnCancel.style.color = 'var(--text-main)';
                        }

                        if (currentState === "error") {
                            if (statusTitle) {
                                statusTitle.innerText = `Error: ${data.error || "Hardware Failure"}`;
                                statusTitle.style.color = "#ef4444";
                            }
                            phaseMessage.innerText = "Please check the scanner and try again.";
                            if (data.missing && data.missing.length) phaseMessage.innerText += `\n${data.missing.length} photo(s) missing in the cloud`;
                            // an object scan that failed in the cloud step can be rebuilt from the uploaded photos
                            if (btnRetryCloud && (data.mode || scanMode) === 'object') btnRetryCloud.style.display = 'flex';
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
                            btnCancel.style.display = 'none';   // the name form has its own buttons
                            
                            if (scanMode === 'face' && data.face_result) {
                                libraryResultId = data.face_result.result_id;
                            } else {
                                libraryResultId = data.result_id;
                            }

                            const fr = scanMode === 'face' ? data.face_result : null;
                            if (fr) {
                                const bits = [];
                                if (fr.warning) bits.push(`⚠ ${fr.warning}`);
                                const m = fr.metrics;
                                if (m && m.dimensions_mm) bits.push(`Face ${Math.round(m.dimensions_mm.width)} × ${Math.round(m.dimensions_mm.height)} mm`);
                                if (m && m.interpupillary_distance_mm) bits.push(`IPD ${m.interpupillary_distance_mm.toFixed(1)} mm`);
                                if (bits.length) phaseMessage.innerText = bits.join('\n');
                                // eyes_open: 0 closed .. 1 open, null not checked; below 0.5 the server also sends a warning
                                const eyesClosed = typeof fr.eyes_open === 'number' && fr.eyes_open < 0.5;
                                if (btnRetakeFace && (eyesClosed || fr.face_detected === false)) btnRetakeFace.style.display = 'flex';
                            }
                            if (data.missing && data.missing.length) phaseMessage.innerText += `\n${data.missing.length} photo(s) missing in the cloud`;

                            // Name / description typed before the scan: show them in the final form, and save the
                            // description now (the start request only carries the name)
                            let preTitle = '', preDesc = '';
                            try {
                                preTitle = localStorage.getItem('pendingScanTitle') || '';
                                preDesc = localStorage.getItem('pendingScanDescription') || '';
                                localStorage.removeItem('pendingScanTitle');
                                localStorage.removeItem('pendingScanDescription');
                            } catch (e) {}
                            const titleInput = document.getElementById('scan-title-input');
                            const descInput = document.getElementById('scan-desc-input');
                            if (titleInput) titleInput.value = preTitle;
                            if (descInput) descInput.value = preDesc;
                            if (preDesc && libraryResultId) {
                                fetch(`${API_URL}/library/objects/${libraryResultId}`, {
                                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: preDesc })
                                }).catch(() => {});
                            }

                            // Afișăm formularul final pentru editare Titlu/Descriere
                            inputGroup.style.display = 'flex';
                        }
                    }
                }
            } catch (e) {
                console.warn("Polling error:", e);
                // keep polling: the warning goes away by itself as soon as the server answers
                if (++statusFailures >= CONN_LOST_AFTER && connWarning) {
                    connWarning.innerText = '⚠ Connection to the scanner lost. Reconnecting...';
                    connWarning.style.display = 'block';
                }
            }
        }, 1000); // Scăzut de la 1500ms la 1000ms pentru a prinde și mai repede starea PREPARED
    }

    // The run fails after upload_drain_timeout_s without a successful upload: warn during the last minute,
    // only while photos are still waiting to be uploaded
    function updateUploadWarning(data, state) {
        if (!uploadWarning) return;
        const since = data.seconds_since_last_upload;
        const limit = data.upload_drain_timeout_s;
        const pending = (data.photos_captured || 0) > (data.photos_uploaded || 0);
        const left = (typeof since === 'number' && typeof limit === 'number') ? limit - since : Infinity;
        if (state === 'running' && pending && left <= UPLOAD_WARN_BEFORE_S) {
            uploadWarning.innerText = left > 0
                ? `⚠ No photo uploaded for ${Math.round(since)} s. The scan fails in ${Math.ceil(left)} s unless the upload resumes. Check the network cable.`
                : '⚠ No photo uploaded for too long: the scan is about to fail.';
            uploadWarning.style.display = 'block';
        } else {
            uploadWarning.style.display = 'none';
        }
    }

    // --- 6. RETRY THE CLOUD RECONSTRUCTION (POST /scanner/cloud/retry) ---
    if (btnRetryCloud) btnRetryCloud.addEventListener('click', async () => {
        btnRetryCloud.disabled = true;
        try {
            const res = await fetch(`${API_URL}/scanner/cloud/retry`, { method: 'POST' });
            if (res.status === 400) {           // nothing to retry: hide the button for good
                btnRetryCloud.style.display = 'none';
                phaseMessage.innerText = await window.apiError(res);
                return;
            }
            if (!res.ok) throw new Error(await window.apiError(res));
            btnRetryCloud.style.display = 'none';
            statusTitle.style.color = '';
            statusTitle.innerText = 'Status: Processing';
            const data = await res.json().catch(() => ({}));
            phaseMessage.innerText = data.message || 'Retrying the reconstruction...';
            hasSentStartCommand = true;         // follow the run, never send start again
            scanEnded = false;
            btnCancel.innerText = 'Cancel Scan';
            btnCancel.style.borderColor = '#ef4444';
            btnCancel.style.color = '#ef4444';
            initStatusPolling(true);
        } catch (e) {
            phaseMessage.innerText = `Could not retry: ${e.message}`;
        } finally {
            btnRetryCloud.disabled = false;
        }
    });

    // each face capture needs its own prepare: back to the face preparation page
    if (btnRetakeFace) btnRetakeFace.addEventListener('click', () => {
        markScanSeen();
        window.location.href = 'scan-face.html';
    });

    initStatusPolling();
});