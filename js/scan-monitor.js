// Multiscan Monitor Widget (bottom-right)
// Tracks unified jobs (/jobs) and physical rig status (/scanner/status).
// Shows primary scan details with a counter badge (e.g. "2 ▲") that expands
// to list all active scans and allows switching to any scan's status or live stream.
(function () {
    if (window.__scanMonitorLoaded) return;
    window.__scanMonitorLoaded = true;

    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000')
                    ? `http://${window.location.hostname}:8000`
                    : 'http://127.0.0.1:8000';

    const isOnScanningPage = !!document.getElementById('active-scan-stream');

    const PHASE_TEXT = {
        preparing: 'Preparing the scanner',
        prepared: 'Ready, starting capture',
        scanning: 'Taking photos',
        uploading: 'Uploading photos',
        verifying: 'Checking upload',
        reconstructing_face: 'Building face model',
        processing: 'Building 3D model in cloud'
    };

    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #scan-monitor {
            position: fixed; right: 24px; bottom: 24px; width: 320px; z-index: 2147483000; display: none;
            background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: 12px; padding: 14px 16px;
            color: var(--text-main); cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,0.45); font-family: var(--font-main);
            user-select: none; transition: transform 0.15s ease, border-color 0.2s ease;
        }
        #scan-monitor:hover { border-color: var(--accent); }
        #scan-monitor .sm-head { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.95rem; }
        #scan-monitor .sm-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; animation: sm-pulse 1.4s infinite; }
        #scan-monitor.done .sm-dot { background: #10b981; animation: none; }
        #scan-monitor.error .sm-dot { background: #ef4444; animation: none; }
        #scan-monitor .sm-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        /* Counter badge with up arrow */
        #scan-monitor .sm-counter-badge {
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--bg-primary); border: 1px solid var(--accent); color: var(--accent);
            padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;
            font-family: var(--font-mono); cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;
        }
        #scan-monitor .sm-counter-badge:hover, #scan-monitor.drawer-open .sm-counter-badge {
            background: var(--accent); color: var(--bg-primary);
        }
        #scan-monitor .sm-arrow-icon {
            width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2.5;
            stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s ease;
        }
        #scan-monitor.drawer-open .sm-arrow-icon { transform: rotate(180deg); }

        #scan-monitor .sm-close { margin-left: 4px; display: none; font-size: 1.1rem; line-height: 1; color: var(--text-muted); padding: 0 4px; cursor: pointer; }
        #scan-monitor .sm-close:hover { color: var(--text-main); }
        #scan-monitor.done .sm-close, #scan-monitor.error .sm-close { display: block; }

        #scan-monitor .sm-msg { margin-top: 6px; font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #scan-monitor .sm-warn { margin-top: 6px; font-size: 0.8rem; color: #f59e0b; }
        #scan-monitor .sm-bar { margin-top: 8px; height: 5px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
        #scan-monitor .sm-bar > div { height: 100%; width: 0; background: var(--accent); transition: width 0.4s; }

        /* Scans list drawer (attached directly above card) */
        #sm-drawer {
            position: absolute; bottom: calc(100% + 10px); right: 0; width: 330px; max-height: 310px;
            background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: 12px;
            box-shadow: 0 10px 36px rgba(0,0,0,0.55); display: none; flex-direction: column; overflow: hidden;
            font-family: var(--font-main); cursor: default;
        }
        #sm-drawer.open { display: flex; animation: sm-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .sm-drawer-head {
            padding: 10px 14px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.5px; border-bottom: 1px solid var(--neutral-border); color: var(--accent);
            display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.15);
        }
        .sm-drawer-list {
            overflow-y: auto; max-height: 260px; display: flex; flex-direction: column; gap: 4px; padding: 6px;
        }
        .sm-drawer-item {
            padding: 10px 12px; border-radius: 8px; cursor: pointer; border: 1px solid transparent;
            background: rgba(255,255,255,0.02); transition: all 0.15s ease;
        }
        .sm-drawer-item:hover { background: var(--bg-primary); border-color: var(--accent); }
        .sm-drawer-item.active-item { border-color: var(--accent); background: rgba(0, 229, 255, 0.08); }
        .sm-item-top { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; }
        .sm-item-kind-badge {
            font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
            background: var(--bg-primary); color: var(--text-muted); font-family: var(--font-mono);
        }
        .sm-item-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main); }
        .sm-item-status-badge {
            font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; text-transform: capitalize;
        }
        .sm-item-status-badge.status-running,
        .sm-item-status-badge.status-processing,
        .sm-item-status-badge.status-uploading { background: rgba(0, 229, 255, 0.15); color: var(--accent); }
        .sm-item-status-badge.status-completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .sm-item-status-badge.status-failed,
        .sm-item-status-badge.status-error { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .sm-item-msg { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sm-item-bar { margin-top: 5px; height: 3px; background: var(--bg-primary); border-radius: 2px; overflow: hidden; }
        .sm-item-bar > div { height: 100%; background: var(--accent); }

        @keyframes sm-pulse { 50% { opacity: 0.3; } }
        @keyframes sm-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    // Build DOM container
    const box = document.createElement('div');
    box.id = 'scan-monitor';
    box.innerHTML = `
        <div id="sm-drawer">
            <div class="sm-drawer-head">
                <span>Active Scans</span>
                <span id="sm-drawer-count" style="font-family: var(--font-mono);">0</span>
            </div>
            <div class="sm-drawer-list" id="sm-drawer-list"></div>
        </div>
        <div class="sm-head">
            <span class="sm-dot"></span>
            <span class="sm-title">Scan in progress</span>
            <div class="sm-counter-badge" id="sm-toggle-list" title="View all active scans">
                <span class="sm-count-num">1</span>
                <svg class="sm-arrow-icon" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </div>
            <span class="sm-close" title="Dismiss">✕</span>
        </div>
        <div class="sm-msg"></div>
        <div class="sm-warn" style="display:none;"></div>
        <div class="sm-bar" style="display:none;"><div></div></div>
    `;
    document.body.appendChild(box);

    const drawer = box.querySelector('#sm-drawer');
    const drawerList = box.querySelector('#sm-drawer-list');
    const drawerCount = box.querySelector('#sm-drawer-count');
    const elTitle = box.querySelector('.sm-title');
    const elMsg = box.querySelector('.sm-msg');
    const elWarn = box.querySelector('.sm-warn');
    const elBar = box.querySelector('.sm-bar');
    const elBarFill = elBar.firstElementChild;
    const countBadge = box.querySelector('#sm-toggle-list');
    const countNum = box.querySelector('.sm-count-num');
    const closeBtn = box.querySelector('.sm-close');

    let allScans = [];
    let primaryScan = null;
    let isDrawerOpen = false;
    let netOffline = false;
    let pollFailures = 0;

    // Toggle drawer
    countBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDrawer();
    });

    function toggleDrawer(force) {
        isDrawerOpen = typeof force === 'boolean' ? force : !isDrawerOpen;
        if (isDrawerOpen) {
            drawer.classList.add('open');
            box.classList.add('drawer-open');
        } else {
            drawer.classList.remove('open');
            box.classList.remove('drawer-open');
        }
    }

    // Dismiss primary scan
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (primaryScan && primaryScan.job_id) {
            try { sessionStorage.setItem('sm_dismiss_' + primaryScan.job_id, '1'); } catch (err) {}
        }
        allScans = allScans.filter(s => s.job_id !== primaryScan?.job_id);
        render();
    });

    // Clicking the main card navigates to the primary scan
    box.addEventListener('click', (e) => {
        if (e.target.closest('#sm-drawer') || e.target.closest('#sm-toggle-list') || e.target.closest('.sm-close')) {
            return;
        }
        if (primaryScan) {
            navigateToScan(primaryScan);
        }
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
        if (isDrawerOpen && !box.contains(e.target)) {
            toggleDrawer(false);
        }
    });

    function navigateToScan(scan) {
        const jobId = scan.job_id || '';
        const kind = scan.kind || 'object';
        if (scan.is_hardware) {
            window.location.href = `scanning.html?mode=${encodeURIComponent(kind)}${jobId && jobId !== 'active-rig' ? '&job_id=' + encodeURIComponent(jobId) : ''}`;
        } else {
            window.location.href = `scanning.html?job_id=${encodeURIComponent(jobId)}&mode=${encodeURIComponent(kind)}`;
        }
    }

    // Network status listener
    window.addEventListener('network-state', (e) => {
        netOffline = !e.detail.ethernet && !e.detail.wifi;
        updateWarning();
    });

    function updateWarning() {
        const hasActive = allScans.some(s => ['running', 'uploading', 'preparing'].includes(s.status));
        const show = hasActive && netOffline;
        elWarn.style.display = show ? 'block' : 'none';
        elWarn.innerText = '⚠ No network connection: photo upload paused';
    }

    function readableMsg(scan) {
        const m = (scan.phase_message || '').trim();
        if (m && m.length <= 90 && !/^[\[{]/.test(m)) return m;
        return PHASE_TEXT[scan.phase] || PHASE_TEXT[scan.status] || scan.status;
    }

    function isDismissed(jobId) {
        try { return sessionStorage.getItem('sm_dismiss_' + jobId) === '1'; } catch (e) { return false; }
    }

    function render() {
        if (allScans.length === 0) {
            box.style.display = 'none';
            toggleDrawer(false);
            return;
        }

        // On scanning.html with only 1 scan (already displayed in main view), hide floating widget
        if (isOnScanningPage && allScans.length <= 1) {
            box.style.display = 'none';
            toggleDrawer(false);
            return;
        }

        box.style.display = 'block';

        // Choose primary scan:
        // Priority 1: Hardware scan taking photos / moving
        // Priority 2: Scan in processing/running
        // Priority 3: First available scan
        primaryScan = allScans.find(s => s.is_hardware) ||
                      allScans.find(s => ['running', 'uploading', 'processing'].includes(s.status)) ||
                      allScans[0];

        // Status class for dot
        const st = (primaryScan.status || '').toLowerCase();
        box.className = st === 'completed' ? 'done' : (['failed', 'error'].includes(st) ? 'error' : '');
        if (isDrawerOpen) box.classList.add('drawer-open');

        // Title and description
        const titleText = primaryScan.meta?.title || (primaryScan.kind === 'face' ? 'Face Scan' : 'Object Scan');
        elTitle.innerText = primaryScan.is_hardware ? `${titleText} (Rig Active)` : titleText;

        if (st === 'completed') {
            elMsg.innerText = 'Scan finished · Tap to open in Library';
        } else if (['failed', 'error'].includes(st)) {
            elMsg.innerText = primaryScan.error || 'Scan failed · Tap for details';
        } else if (st === 'prepared') {
            elMsg.innerText = 'Ready: tap to continue scan';
        } else {
            elMsg.innerText = readableMsg(primaryScan);
        }

        // Progress bar for primary
        const showBar = primaryScan.total_photos > 0 && st === 'running';
        elBar.style.display = showBar ? 'block' : 'none';
        if (showBar) {
            const up = primaryScan.photos_uploaded || 0;
            const pct = Math.min(100, Math.round((up / primaryScan.total_photos) * 100));
            elBarFill.style.width = `${pct}%`;
        }

        // Counter badge
        countNum.innerText = allScans.length;
        drawerCount.innerText = `${allScans.length} active`;

        // Render Drawer List
        drawerList.innerHTML = '';
        allScans.forEach(scan => {
            const itemEl = document.createElement('div');
            itemEl.className = 'sm-drawer-item' + (scan === primaryScan ? ' active-item' : '');
            
            const scanTitle = scan.meta?.title || (scan.kind === 'face' ? 'Face Scan' : 'Object Scan');
            const scanStatus = scan.status || 'running';
            const scanKind = (scan.kind || 'object').toUpperCase();
            const msg = readableMsg(scan);

            let barHtml = '';
            if (scan.total_photos > 0 && scanStatus === 'running') {
                const pct = Math.min(100, Math.round(((scan.photos_uploaded || 0) / scan.total_photos) * 100));
                barHtml = `<div class="sm-item-bar"><div style="width: ${pct}%"></div></div>`;
            }

            itemEl.innerHTML = `
                <div class="sm-item-top">
                    <span class="sm-dot ${scanStatus === 'completed' ? 'done' : (['failed', 'error'].includes(scanStatus) ? 'error' : '')}"></span>
                    <span class="sm-item-kind-badge">${scanKind}</span>
                    <span class="sm-item-title">${esc(scanTitle)}</span>
                    <span class="sm-item-status-badge status-${scanStatus}">${scanStatus}</span>
                </div>
                <div class="sm-item-msg">${esc(msg)}</div>
                ${barHtml}
            `;

            itemEl.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateToScan(scan);
            });

            drawerList.appendChild(itemEl);
        });

        updateWarning();
    }

    async function poll() {
        try {
            // 1. Query /jobs (Unified Jobs API from FRONTEND_CHANGES.md)
            let jobsList = [];
            try {
                const jobsRes = await fetch(`${API_URL}/jobs`, { cache: 'no-store' });
                if (jobsRes.ok) {
                    const data = await jobsRes.json();
                    jobsList = Array.isArray(data) ? data : (data.items || []);
                }
            } catch (je) {
                // Ignore if backend doesn't have /jobs yet, fallback to /scanner/status
            }

            // 2. Query /scanner/status
            let scannerData = null;
            try {
                const scanRes = await fetch(`${API_URL}/scanner/status`, { cache: 'no-store' });
                if (scanRes.ok) {
                    scannerData = await scanRes.json();
                }
            } catch (se) {}

            pollFailures = 0;

            // Merge active scans
            const merged = [];
            const activeStatuses = ['queued', 'running', 'uploading', 'processing', 'preparing', 'prepared'];

            // Process jobs
            jobsList.forEach(job => {
                const status = (job.status || '').toLowerCase();
                const isActive = activeStatuses.includes(status);
                const isRecent = ['completed', 'failed'].includes(status) && !isDismissed(job.job_id);

                if (isActive || isRecent) {
                    merged.push({
                        job_id: job.job_id,
                        kind: job.kind || 'object',
                        status: status,
                        phase: job.phase,
                        phase_message: job.phase_message,
                        cloud_message: job.cloud_message,
                        error: job.error,
                        result_id: job.result_id,
                        meta: job.meta,
                        created_at: job.created_at,
                        is_hardware: false,
                        photos_uploaded: 0,
                        total_photos: 0
                    });
                }
            });

            // Match physical hardware scanner status
            if (scannerData && scannerData.state) {
                const rawState = (scannerData.state || '').toLowerCase();
                const isRigActive = ['preparing', 'prepared', 'running', 'processing'].includes(rawState);

                if (isRigActive) {
                    // Match existing job ONLY if it's currently active (not completed/failed)
                    const existing = scannerData.job_id 
                        ? merged.find(m => m.job_id === scannerData.job_id && !['completed', 'failed', 'cancelled'].includes(m.status))
                        : null;

                    if (existing) {
                        existing.is_hardware = rawState !== 'processing'; // rig is decoupled once in processing
                        existing.status = rawState;
                        existing.photos_uploaded = scannerData.photos_uploaded || existing.photos_uploaded;
                        existing.total_photos = scannerData.total_photos || existing.total_photos;
                        if (scannerData.phase_message) existing.phase_message = scannerData.phase_message;
                    } else if (rawState !== 'idle') {
                        // Prepend newly started hardware scan not yet reflected in /jobs
                        merged.unshift({
                            job_id: (rawState === 'running' && scannerData.job_id) ? scannerData.job_id : 'active-rig',
                            kind: scannerData.mode || 'object',
                            status: rawState,
                            phase: scannerData.phase,
                            phase_message: scannerData.phase_message,
                            error: scannerData.error,
                            result_id: scannerData.result_id,
                            meta: { title: scannerData.mode === 'face' ? 'Face Scan' : 'Object Scan' },
                            is_hardware: rawState !== 'processing',
                            photos_uploaded: scannerData.photos_uploaded || 0,
                            total_photos: scannerData.total_photos || 0
                        });
                    }
                }
            }

            allScans = merged;
            render();

        } catch (e) {
            console.warn('scan-monitor poll error', e);
            if (++pollFailures >= 6) {
                box.style.display = 'none';
            }
        }
    }

    poll();
    setInterval(poll, 2000);
    window.addEventListener('pageshow', poll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();
