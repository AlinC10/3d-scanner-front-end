// Floating "scan in progress" card (bottom-right) on every page except the scanning page.
// A scan keeps running on the Pi when the user leaves scanning.html; this card shows its
// current state and leads back to it.
(function () {
    if (document.getElementById('active-scan-stream')) return; // we are on the scanning page
    if (window.__scanMonitorLoaded) return;                    // never two cards
    window.__scanMonitorLoaded = true;

    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000')
                    ? `http://${window.location.hostname}:8000`
                    : 'http://127.0.0.1:8000';

    const ACTIVE = ['preparing', 'prepared', 'running', 'processing', 'downloading'];
    const PHASE_TEXT = {
        preparing: 'Preparing the scanner',
        prepared: 'Ready, starting',
        scanning: 'Taking photos',
        uploading: 'Uploading photos',
        verifying: 'Checking the upload',
        reconstructing_face: 'Building the face model',
        processing: 'Building the 3D model in the cloud'
    };

    const style = document.createElement('style');
    style.textContent = `
        #scan-monitor { position: fixed; right: 24px; bottom: 24px; width: 320px; z-index: 2147483000; display: none;
            background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: 12px; padding: 14px 16px;
            color: var(--text-main); cursor: pointer; box-shadow: 0 6px 24px rgba(0,0,0,0.35); font-family: var(--font-main); }
        #scan-monitor .sm-head { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.95rem; }
        #scan-monitor .sm-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; animation: sm-pulse 1.4s infinite; }
        #scan-monitor.done .sm-dot { background: #10b981; animation: none; }
        #scan-monitor.error .sm-dot { background: #ef4444; animation: none; }
        #scan-monitor .sm-msg { margin-top: 6px; font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #scan-monitor .sm-warn { margin-top: 6px; font-size: 0.8rem; color: #f59e0b; }
        #scan-monitor .sm-bar { margin-top: 8px; height: 5px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
        #scan-monitor .sm-bar > div { height: 100%; width: 0; background: var(--accent); transition: width 0.4s; }
        #scan-monitor .sm-close { margin-left: auto; display: none; font-size: 1.1rem; line-height: 1; color: var(--text-muted); padding: 0 4px; }
        #scan-monitor.done .sm-close, #scan-monitor.error .sm-close { display: block; }
        @keyframes sm-pulse { 50% { opacity: 0.3; } }
    `;
    document.head.appendChild(style);

    const box = document.createElement('div');
    box.id = 'scan-monitor';
    box.innerHTML = `
        <div class="sm-head"><span class="sm-dot"></span><span class="sm-title"></span><span class="sm-close" title="Dismiss">✕</span></div>
        <div class="sm-msg"></div>
        <div class="sm-warn" style="display:none;"></div>
        <div class="sm-bar" style="display:none;"><div></div></div>`;
    document.body.appendChild(box);

    const elTitle = box.querySelector('.sm-title');
    const elMsg = box.querySelector('.sm-msg');
    const elWarn = box.querySelector('.sm-warn');
    const elBar = box.querySelector('.sm-bar');
    const elBarFill = elBar.firstElementChild;

    let mode = 'object';
    let statusKey = null;
    let failures = 0;
    let scanActive = false;
    let netOffline = false;

    const dismissedKey = () => { try { return sessionStorage.getItem('scanMonitorDismissed'); } catch (e) { return null; } };

    box.addEventListener('click', (e) => {
        if (e.target.classList.contains('sm-close')) {
            try { sessionStorage.setItem('scanMonitorDismissed', statusKey); } catch (err) {}
            box.style.display = 'none';
            return;
        }
        window.location.href = `scanning.html?mode=${mode}`;
    });

    // network.js tells us when neither cable nor Wi-Fi is connected: the photo upload stops then
    window.addEventListener('network-state', (e) => {
        netOffline = !e.detail.ethernet && !e.detail.wifi;
        updateWarning();
    });

    function updateWarning() {
        const show = scanActive && netOffline;
        elWarn.style.display = show ? 'block' : 'none';
        elWarn.innerText = '⚠ No network connection: uploads are paused';
    }

    // phase_message can carry raw cloud output; the card only shows short readable text
    function readable(data) {
        const m = (data.phase_message || '').trim();
        if (m && m.length <= 90 && !/^[\[{]/.test(m)) return m;
        return PHASE_TEXT[data.phase] || PHASE_TEXT[data.state] || '';
    }

    function render(data) {
        const state = (data.state || '').toLowerCase();
        mode = data.mode || mode;
        statusKey = `${state}:${data.job_id || ''}:${data.result_id || ''}`;
        const label = mode === 'face' ? 'Face scan' : 'Object scan';

        const finished = state === 'completed' || state === 'error';
        scanActive = ACTIVE.includes(state);
        if (!scanActive && !(finished && dismissedKey() !== statusKey)) {
            box.style.display = 'none';
            return;
        }

        box.className = state === 'completed' ? 'done' : (state === 'error' ? 'error' : '');
        box.style.display = 'block';

        if (state === 'completed') {
            elTitle.innerText = `${label} finished`;
            elMsg.innerText = 'Tap to name it and open the library';
        } else if (state === 'error') {
            elTitle.innerText = `${label} failed`;
            elMsg.innerText = data.error || 'Tap for details';
        } else {
            elTitle.innerText = `${label} in progress`;
            elMsg.innerText = state === 'prepared' ? 'Ready: tap to continue the scan' : readable(data);
        }

        const showBar = state === 'running' && data.total_photos > 0;
        elBar.style.display = showBar ? 'block' : 'none';
        if (showBar) {
            elBarFill.style.width = `${Math.min(100, Math.round(((data.photos_uploaded || 0) / data.total_photos) * 100))}%`;
        }
        updateWarning();
    }

    async function poll() {
        try {
            const res = await fetch(`${API_URL}/scanner/status`, { cache: 'no-store' });
            if (!res.ok) throw new Error(res.status);
            failures = 0;
            render(await res.json());
        } catch (e) {
            console.warn('scan-monitor: status request failed', e);
            if (++failures >= 5) box.style.display = 'none';
        }
    }

    poll();
    setInterval(poll, 2000);
    // coming back to the page (history Back, tab shown again): do not wait for the next tick
    window.addEventListener('pageshow', poll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();
