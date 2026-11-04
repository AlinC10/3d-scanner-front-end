document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000') 
                    ? `http://${window.location.hostname}:8000` 
                    : 'http://127.0.0.1:8000';
    let statusInterval = null;
    let hasSentStartCommand = false;

    const urlParams = new URLSearchParams(window.location.search);
    let scanMode = urlParams.get('mode') || localStorage.getItem('scanMode') || 'object';
    let targetJobId = urlParams.get('job_id') || null;
    if (targetJobId === 'active-rig' || targetJobId === 'undefined' || targetJobId === 'null') {
        targetJobId = null;
    }
    let latestRigJobId = null;
    let isViewingRig = false;

    // Extragem setările avansate pregătite din pasul anterior
    let pendingScanSettings = {};
    try {
        const storedSettings = localStorage.getItem('pendingScanSettings');
        if (storedSettings) pendingScanSettings = JSON.parse(storedSettings);
    } catch (e) {
        console.error("Failed to parse pendingScanSettings:", e);
    }

    const jobLabel = document.getElementById('scan-job-label');
    const statusTitle = document.getElementById('scan-status-title');
    const phaseMessage = document.getElementById('scan-phase-message');
    const cloudMessage = document.getElementById('scan-cloud-message');
    const btnRetryCloud = document.getElementById('btn-retry-cloud');
    const btnRetakeFace = document.getElementById('btn-retake-face');
    const btnNewScan = document.getElementById('btn-new-scan');
    const uploadWarning = document.getElementById('scan-upload-warning');
    const connWarning = document.getElementById('scan-conn-warning');

    const UPLOAD_WARN_BEFORE_S = 60;   // warn this long before upload drain timeout fails the run
    const CONN_LOST_AFTER = 3;         // failed status requests before warning
    let statusFailures = 0;
    let scanEnded = false;             // error / completed: button leads back to menu
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

    if (btnNewScan) {
        btnNewScan.addEventListener('click', () => {
            window.location.href = scanMode === 'face' ? 'scan-face.html' : 'scan-object.html';
        });
    }

    // --- 1. SCHIMBARE CAMERE ---
    let activeCameraId = 1;
    let retryTimer = null;
    const MAX_STREAM_RETRIES = 120; 

    function streamUrl(camId) {
        return `${API_URL}/scanner/stream/mjpeg?camera=${camId}&t=${new Date().getTime()}`;
    }

    let streamStopped = false;
    function stopStreamView() {
        if (streamStopped && scanStream && scanStream.style.display === 'none') return;
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

    function resumeStreamView() {
        if (!streamStopped && scanStream && scanStream.style.display !== 'none' && scanStream.src) return;
        streamStopped = false;
        if (scanStream) {
            scanStream.style.display = 'block';
        }
        if (btnSwitchCamera) btnSwitchCamera.style.display = 'flex';
        document.querySelector('.scanning-container')?.classList.remove('stream-off');
        if (!scanStream.src || scanStream.src === '') {
            loadStream(activeCameraId);
        }
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
                    if (statusTitle && !hasSentStartCommand) statusTitle.innerText = "Camera stream failed to load.";
                }
            };
            scanStream.src = streamUrl(camId);
        }, 150);
    }

    // Only load stream initially if not explicitly pointing to an offline background job
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

    // Warn when the connection drops during the scan
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
        if (scanEnded) {
            markScanSeen();
            window.location.href = 'index.html';
            return;
        }
        if (statusInterval) clearInterval(statusInterval);
        clearTimeout(retryTimer);
        if (statusTitle) statusTitle.innerText = "Canceling...";
        if (btnCancel) btnCancel.disabled = true;

        // Dacă avem un job identificabil (fie cel selectat explicit din cloud, fie cel de pe rig):
        // apelăm exclusiv POST /jobs/{job_id}/cancel.
        // Backend-ul gestionează oprirea pod-ului sau oprirea motoarelor dacă e pe rig,
        // fără a afecta cealaltă scanare!
        // Doar dacă rig-ul se pregătește (preparing/prepared) și nu există încă niciun job_id:
        // apelăm POST /scanner/cancel pentru oprirea hardware-ului.
        const jobIdToCancel = isViewingRig ? (latestRigJobId || targetJobId) : targetJobId;

        if (jobIdToCancel && jobIdToCancel !== 'active-rig') {
            try {
                await fetch(`${API_URL}/jobs/${encodeURIComponent(jobIdToCancel)}/cancel`, { method: 'POST' });
            } catch (e) {}
        } else {
            try {
                await fetch(`${API_URL}/scanner/cancel`, { method: 'POST' });
            } catch (e) {}
        }

        window.location.href = 'index.html';
    }
    if (btnCancel) btnCancel.addEventListener('click', triggerCancel);

    // --- 3. AUTO-START SCAN (Când hardware este PREPARED) ---
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

                // Asigurăm că parametrii de cloud au întotdeauna start_pod_with_scan = true by default!
                const finalStartPayload = Object.assign({}, pendingScanSettings);
                if (!finalStartPayload.cloud || typeof finalStartPayload.cloud !== 'object') {
                    finalStartPayload.cloud = {};
                }
                finalStartPayload.cloud.launch_runpod = true;
                finalStartPayload.cloud.start_pod_with_scan = true;
                if (!finalStartPayload.cloud.resolution_level) {
                    finalStartPayload.cloud.resolution_level = 1;
                }

                const startRes = await fetch(`${API_URL}/scanner/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalStartPayload)
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
        try {
            sessionStorage.setItem('scanMonitorDismissed', lastStatusKey);
            const jid = targetJobId || (lastStatusKey && lastStatusKey.split(':')[1]);
            const rid = libraryResultId || (lastStatusKey && lastStatusKey.split(':')[2]);
            if (jid && jid !== 'active-rig') {
                sessionStorage.setItem('sm_dismiss_' + jid, '1');
                localStorage.setItem('sm_dismiss_' + jid, '1');
            }
            if (rid) {
                sessionStorage.setItem('sm_dismiss_' + rid, '1');
                localStorage.setItem('sm_dismiss_' + rid, '1');
            }
        } catch (e) {}
    }

    async function saveFinalDetails() {
        markScanSeen();
        if (!libraryResultId) return window.location.href = 'library.html';
        
        const t = document.getElementById('scan-title-input').value.trim();
        const d = document.getElementById('scan-desc-input').value.trim();
        const payload = {};
        if (t) payload.title = t;
        if (d) payload.description = d;
        
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

    if (btnSaveDetails) btnSaveDetails.addEventListener('click', saveFinalDetails);
    if (btnSkipDetails) btnSkipDetails.addEventListener('click', () => { markScanSeen(); window.location.href = 'library.html'; });

    // --- 5. POLLING PENTRU STATUS ---
    function initStatusPolling(keepTitle = false) {
        if (statusInterval) clearInterval(statusInterval);
        if (statusTitle && !keepTitle) {
            statusTitle.innerText = scanMode === 'face'
                ? "Status: Warming up (Face Mode)..."
                : "Status: Warming up (Object Mode)...";
        }

        statusInterval = setInterval(async () => {
            try {
                // 1. Interogăm starea hardware
                let scannerData = null;
                try {
                    const sRes = await fetch(`${API_URL}/scanner/status`, { cache: 'no-store' });
                    if (sRes.ok) scannerData = await sRes.json();
                } catch (se) {}

                if (scannerData) {
                    statusFailures = 0;
                    if (connWarning) connWarning.style.display = 'none';
                }

                const rawRigState = (scannerData && scannerData.state || '').toLowerCase();
                const isRigLive = ['preparing', 'prepared', 'running'].includes(rawRigState);

                // 2. Interogăm job specific dacă a fost cerut în URL
                let targetJob = null;
                if (targetJobId) {
                    try {
                        const jRes = await fetch(`${API_URL}/jobs?id=${encodeURIComponent(targetJobId)}`, { cache: 'no-store' });
                        if (jRes.ok) targetJob = await jRes.json();
                    } catch (je) {}
                }

                // Determinăm dacă ecranul ar trebui să afișeze stream-ul live de pe rig-ul fizic:
                // Dacă utilizatorul a deschis explicit din drawer un job cu un targetJobId specific,
                // iar acel job este în /jobs în starea processing / uploading / queued / completed / failed:
                const isExplicitJobView = Boolean(targetJobId && targetJobId !== 'active-rig' && targetJob);
                isViewingRig = isRigLive && (!isExplicitJobView || ['running', 'uploading'].includes((targetJob.status || '').toLowerCase()));

                // --- CAZUL A: Scanare fizică ACTIVĂ pe aparat (Stream MJPEG activ) ---
                if (isViewingRig) {
                    resumeStreamView();

                    if (scannerData.mode) scanMode = scannerData.mode;

                    // Reținem job_id-ul curent activ pe aparat
                    if (scannerData.job_id && ['running', 'uploading', 'verifying'].includes(rawRigState)) {
                        latestRigJobId = scannerData.job_id;
                    }

                    // Doar în starea running sincronizăm targetJobId cu noul job creat pe aparat
                    if (rawRigState === 'running' && scannerData.job_id && scannerData.job_id !== targetJobId) {
                        targetJobId = scannerData.job_id;
                        try {
                            const u = new URL(window.location.href);
                            u.searchParams.set('job_id', targetJobId);
                            window.history.replaceState(null, '', u.toString());
                        } catch (e) {}
                    }

                    if (jobLabel) {
                        const displayJobId = (scannerData.job_id && rawRigState === 'running') ? scannerData.job_id : targetJobId;
                        jobLabel.innerText = displayJobId ? `Job: ${displayJobId} (${scanMode.toUpperCase()})` : `Rig Active (${scanMode.toUpperCase()})`;
                        jobLabel.style.display = 'block';
                    }

                    lastStatusKey = `${rawRigState}:${scannerData.job_id || ''}:${scannerData.result_id || ''}`;

                    if (cloudMessage) {
                        cloudMessage.innerText = scannerData.cloud_message || '';
                        cloudMessage.style.display = scannerData.cloud_message ? 'block' : 'none';
                    }
                    updateUploadWarning(scannerData, rawRigState);

                    if (btnNewScan) btnNewScan.style.display = 'none';

                    // Sub-stare 1: PREPARING (Homing Z, stabilizare lumini, calibrare camere)
                    if (rawRigState === 'preparing') {
                        statusTitle.innerText = "Status: Preparing Hardware...";
                        statusTitle.style.color = "var(--accent)";
                        phaseMessage.innerText = scannerData.phase_message || (scanMode === 'face'
                            ? "Homing axes and positioning cameras for face capture..."
                            : "Homing Z axis, climbing to start height, and stabilizing lights...");

                        progressContainer.style.display = 'block';
                        progressBar.style.width = '100%';
                        progressBar.style.opacity = '0.4';
                        progressText.innerText = scannerData.phase_message || "Preparing hardware...";
                        progressPct.innerText = "Warming up";

                        btnCancel.style.display = 'block';
                        btnCancel.innerText = 'Cancel Scan';
                        btnCancel.style.borderColor = '#ef4444';
                        btnCancel.style.color = '#ef4444';
                        btnCancel.onclick = triggerCancel;

                    // Sub-stare 2: PREPARED (Hardware gata, trimitem automat start către rig)
                    } else if (rawRigState === 'prepared') {
                        statusTitle.innerText = scanMode === 'face' ? "Status: Capturing Face..." : "Status: Initializing Capture...";
                        statusTitle.style.color = "var(--accent)";
                        phaseMessage.innerText = scannerData.phase_message || "Hardware prepared. Triggering capture sequence...";

                        progressContainer.style.display = 'block';
                        progressBar.style.width = '100%';
                        progressBar.style.opacity = '0.7';
                        progressText.innerText = "Starting capture...";
                        progressPct.innerText = "Ready";

                        btnCancel.style.display = 'block';
                        btnCancel.innerText = 'Cancel Scan';
                        btnCancel.style.borderColor = '#ef4444';
                        btnCancel.style.color = '#ef4444';
                        btnCancel.onclick = triggerCancel;

                        if (!hasSentStartCommand) {
                            hasSentStartCommand = true;
                            fireStartCommand();
                        }

                    // Sub-stare 3: RUNNING (Fotografiere fizică pe rig)
                    } else if (rawRigState === 'running') {
                        if (!hasSentStartCommand) hasSentStartCommand = true;

                        statusTitle.innerText = scanMode === 'face' ? "Status: Face Capture Running" : "Status: Running";
                        statusTitle.style.color = "var(--text-main)";
                        progressContainer.style.display = 'block';

                        if (scannerData.total_photos && scannerData.total_photos > 0) {
                            const up = scannerData.photos_uploaded || 0;
                            const tot = scannerData.total_photos;
                            const pct = Math.round((up / tot) * 100);
                            progressBar.style.width = `${pct}%`;
                            progressBar.style.opacity = '1';
                            const cap = scannerData.photos_captured || 0;
                            const ring = scannerData.level ? `Ring ${scannerData.level} · ` : '';
                            progressText.innerText = `${ring}${cap} captured · ${up} / ${tot} uploaded`;
                            progressPct.innerText = `${pct}%`;
                        } else {
                            progressBar.style.width = '100%';
                            progressBar.style.opacity = '0.5';
                            progressText.innerText = scannerData.phase_message || "Scanning in progress...";
                            progressPct.innerText = "Running";
                        }

                        if (scannerData.phase_message && phaseMessage && !statusTitle.innerText.includes("Rejected")) {
                            phaseMessage.innerText = scannerData.phase_message;
                        }

                        btnCancel.style.display = 'block';
                        btnCancel.innerText = 'Cancel Scan';
                        btnCancel.style.borderColor = '#ef4444';
                        btnCancel.style.color = '#ef4444';
                        btnCancel.onclick = triggerCancel;
                    }

                } else {
                    // --- CAZUL B: Reconstrucție în Cloud / Job specific pe Server (/jobs) sau scanare încheiată ---
                    stopStreamView();

                    // Prioritate 1: Detalii din /jobs
                    if (targetJob) {
                        const jStatus = (targetJob.status || '').toLowerCase();
                        scanMode = targetJob.kind || scanMode;
                        lastStatusKey = `${jStatus}:${targetJob.job_id || ''}:${targetJob.result_id || ''}`;

                        if (jobLabel) {
                            const jobTitle = targetJob.meta?.title ? `${targetJob.meta.title} (${(targetJob.kind || 'object').toUpperCase()})` : `Job: ${targetJob.job_id}`;
                            jobLabel.innerText = jobTitle;
                            jobLabel.style.display = 'block';
                        }

                        if (phaseMessage) {
                            phaseMessage.innerText = targetJob.phase_message || 'Processing 3D model in background...';
                        }

                        if (cloudMessage) {
                            const cm = targetJob.cloud_message || (targetJob.pod_id ? `Pod ID: ${targetJob.pod_id}` : '');
                            cloudMessage.innerText = cm;
                            cloudMessage.style.display = cm ? 'block' : 'none';
                        }

                        // Statusuri active în cloud
                        if (['processing', 'uploading', 'running', 'queued'].includes(jStatus)) {
                            hasSentStartCommand = true;
                            statusTitle.innerText = jStatus === 'processing' 
                                ? "Status: Cloud Reconstruction (Processing)" 
                                : `Status: ${jStatus.charAt(0).toUpperCase() + jStatus.slice(1)}`;
                            statusTitle.style.color = "var(--accent)";

                            progressContainer.style.display = 'block';
                            progressBar.style.width = '100%';
                            progressBar.style.opacity = '0.6';
                            progressText.innerText = targetJob.phase_message || "Processing Model in Cloud...";
                            progressPct.innerText = "Wait";

                            // Rig este liber: oferim buton de scanare nouă
                            if (btnNewScan) btnNewScan.style.display = 'flex';

                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Cancel Scan';
                            btnCancel.style.borderColor = '#ef4444';
                            btnCancel.style.color = '#ef4444';
                            btnCancel.onclick = triggerCancel;

                        } else if (jStatus === 'completed') {
                            statusTitle.innerText = "Scan completed successfully!";
                            statusTitle.style.color = "#10b981";
                            progressContainer.style.display = 'none';

                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            libraryResultId = targetJob.result_id;

                            inputGroup.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Open in Library';
                            btnCancel.style.borderColor = 'var(--accent)';
                            btnCancel.style.color = 'var(--accent)';
                            btnCancel.onclick = () => {
                                markScanSeen();
                                window.location.href = 'library.html';
                            };

                        } else if (jStatus === 'failed') {
                            statusTitle.innerText = `Error: ${targetJob.error || "Reconstruction Failed"}`;
                            statusTitle.style.color = "#ef4444";
                            progressContainer.style.display = 'none';

                            if (btnRetryCloud && (targetJob.kind || scanMode) === 'object') {
                                btnRetryCloud.style.display = 'flex';
                            }
                            if (btnNewScan) btnNewScan.style.display = 'flex';

                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.style.borderColor = 'var(--neutral-border)';
                            btnCancel.style.color = 'var(--text-main)';
                            btnCancel.onclick = () => window.location.href = 'index.html';

                        } else if (jStatus === 'cancelled') {
                            statusTitle.innerText = "Scan Cancelled.";
                            statusTitle.style.color = "#f59e0b";
                            progressContainer.style.display = 'none';
                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.onclick = () => window.location.href = 'index.html';
                        }

                    // Prioritate 2: Fallback pe scannerData (când /jobs nu este disponibil sau datele vin direct din rig)
                    } else if (scannerData) {
                        const currentState = rawRigState;
                        lastStatusKey = `${currentState}:${scannerData.job_id || ''}:${scannerData.result_id || ''}`;

                        if (scannerData.phase_message && phaseMessage && !statusTitle.innerText.includes("Rejected")) {
                            phaseMessage.innerText = scannerData.phase_message;
                        }
                        if (cloudMessage) {
                            cloudMessage.innerText = scannerData.cloud_message || '';
                            cloudMessage.style.display = scannerData.cloud_message ? 'block' : 'none';
                        }

                        if (['processing', 'downloading'].includes(currentState)) {
                            statusTitle.innerText = "Status: Cloud Reconstruction (Processing)";
                            statusTitle.style.color = "var(--accent)";
                            progressContainer.style.display = 'block';
                            progressBar.style.width = '100%';
                            progressBar.style.opacity = '0.6';
                            progressText.innerText = scannerData.phase_message || "Processing Model in Cloud...";
                            progressPct.innerText = "Wait";

                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Cancel Scan';
                            btnCancel.style.borderColor = '#ef4444';
                            btnCancel.style.color = '#ef4444';
                            btnCancel.onclick = triggerCancel;

                        } else if (currentState === 'completed') {
                            statusTitle.innerText = "Scan completed successfully!";
                            statusTitle.style.color = "#10b981";
                            progressContainer.style.display = 'none';
                            btnCancel.style.display = 'none';
                            libraryResultId = (scanMode === 'face' && scannerData.face_result) 
                                ? scannerData.face_result.result_id 
                                : scannerData.result_id;
                            inputGroup.style.display = 'flex';
                            if (btnNewScan) btnNewScan.style.display = 'flex';

                        } else if (currentState === 'error') {
                            statusTitle.innerText = `Error: ${scannerData.error || "Hardware Failure"}`;
                            statusTitle.style.color = "#ef4444";
                            progressContainer.style.display = 'none';
                            if (btnRetryCloud && (scannerData.mode || scanMode) === 'object') {
                                btnRetryCloud.style.display = 'flex';
                            }
                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.onclick = () => window.location.href = 'index.html';

                        } else if (currentState === 'cancelled') {
                            statusTitle.innerText = "Scan Cancelled.";
                            statusTitle.style.color = "#f59e0b";
                            progressContainer.style.display = 'none';
                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.onclick = () => window.location.href = 'index.html';

                        } else if (currentState === 'idle') {
                            statusTitle.innerText = "Scanner is ready";
                            statusTitle.style.color = "var(--text-main)";
                            phaseMessage.innerText = "No active scan in progress. Ready to scan.";
                            progressContainer.style.display = 'none';
                            if (btnNewScan) btnNewScan.style.display = 'flex';
                            btnCancel.style.display = 'block';
                            btnCancel.innerText = 'Back to menu';
                            btnCancel.onclick = () => window.location.href = 'index.html';
                        }
                    }
                }

            } catch (e) {
                console.warn("Polling error:", e);
                if (++statusFailures >= CONN_LOST_AFTER && connWarning) {
                    connWarning.innerText = '⚠ Connection to scanner lost. Reconnecting...';
                    connWarning.style.display = 'block';
                }
            }
        }, 1000);
    }

    function updateUploadWarning(data, state) {
        if (!uploadWarning) return;
        const since = data.seconds_since_last_upload;
        const limit = data.upload_drain_timeout_s;
        const pending = (data.photos_captured || 0) > (data.photos_uploaded || 0);
        const left = (typeof since === 'number' && typeof limit === 'number') ? limit - since : Infinity;
        if (state === 'running' && pending && left <= UPLOAD_WARN_BEFORE_S) {
            uploadWarning.innerText = left > 0
                ? `⚠ No photo uploaded for ${Math.round(since)} s. Scan fails in ${Math.ceil(left)} s. Check network cable.`
                : '⚠ No photo uploaded for too long: scan is about to fail.';
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
            if (res.status === 400) {
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
            hasSentStartCommand = true;
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

    if (btnRetakeFace) btnRetakeFace.addEventListener('click', () => {
        markScanSeen();
        window.location.href = 'scan-face.html';
    });

    initStatusPolling();
});
