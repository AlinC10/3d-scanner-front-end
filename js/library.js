document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.origin.includes(':') && !window.location.origin.includes(':8000') 
                    ? `http://${window.location.hostname}:8000` 
                    : 'http://127.0.0.1:8000';

    const gridView = document.getElementById('library-grid-view');
    const detailView = document.getElementById('library-detail-view');
    const gridContainer = document.getElementById('library-items-container');
    const btnBack = document.getElementById('btn-back-library');
    const btnExport = document.getElementById('btn-export-model');
    const btnDelete = document.getElementById('btn-delete-model');
    
    // Controale Format si LOD
    const btnFmtGlb = document.getElementById('btn-fmt-glb');
    const btnFmtStl = document.getElementById('btn-fmt-stl');
    const btnLodLow = document.getElementById('btn-lod-low');
    const btnLodHigh = document.getElementById('btn-lod-high');
    
    const searchInput = document.getElementById('library-search-input');
    const libTabs = document.querySelectorAll('.lib-tab');

    const btnExportQr = document.getElementById('btn-export-qr');
    const btnShowQr = document.getElementById('btn-show-qr');
    const exportStatus = document.getElementById('export-status');
    const exportProgress = document.getElementById('export-progress');
    const exportProgressFill = document.getElementById('export-progress-fill');
    const qrModal = document.getElementById('qr-modal');
    const qrImage = document.getElementById('qr-image');
    const qrExpiry = document.getElementById('qr-expiry');
    const btnCloseQr = document.getElementById('btn-close-qr');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    let currentItem = null;
    let exportPollTimer = null;
    let currentCategory = 'all'; // all | object | face (query of GET /library/objects)
    let currentLoadedModelId = null;
    let currentFmt = 'glb'; 
    let currentLod = 'low'; 
    
    let mainScene, mainCamera, mainRenderer, mainControls;
    let mainModelObject = null;
    let mainAnimationFrameId = null;

    // --- CONFIGURARE LOADERE THREE.JS ---
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    const stlLoader = new THREE.STLLoader();


    if (btnBack) {
        btnBack.addEventListener('click', () => {
            stopExportPolling();
            window.location.href = 'library.html';
        });
    }

    function showExportStatus(text, isError = false) {
        if (!exportStatus) return;
        exportStatus.style.display = text ? 'block' : 'none';
        exportStatus.style.color = isError ? '#ef4444' : 'var(--text-muted)';
        exportStatus.innerText = text || '';
    }

    // pct: 0..100, or null to hide the bar
    function showExportProgress(pct) {
        if (!exportProgress) return;
        exportProgress.style.display = pct === null ? 'none' : 'block';
        if (pct !== null) exportProgressFill.style.width = `${pct}%`;
    }

    function stopExportPolling() {
        clearTimeout(exportPollTimer);
        exportPollTimer = null;
        showExportProgress(null);
        if (btnExport) btnExport.disabled = false;
        if (btnExportQr) btnExportQr.disabled = false;
    }

    // Poll every second until the export ends; onState returns true when finished
    function pollExport(path, onState) {
        const tick = async () => {
            try {
                const res = await fetch(`${API_URL}${path}`);
                if (!res.ok) throw new Error(await window.apiError(res));
                if (onState(await res.json())) return stopExportPolling();
            } catch (e) {
                showExportStatus(e.message, true);
                return stopExportPolling();
            }
            exportPollTimer = setTimeout(tick, 1000);
        };
        tick();
    }

    async function startExport(kind) {
        if (!currentLoadedModelId) return;
        const isUsb = kind === 'usb';
        showExportStatus('');
        btnExport.disabled = true;
        btnExportQr.disabled = true;
        if (btnShowQr) btnShowQr.style.display = 'none';
        try {
            // GET /library/usb lists the sticks; with several, the user picks one
            let body = null;
            if (isUsb) {
                const listRes = await fetch(`${API_URL}/library/usb`);
                if (listRes.ok) {
                    const sticks = await listRes.json();
                    if (sticks.length === 0) {
                        showExportStatus('Insert a USB stick.', true);
                        return stopExportPolling();
                    }
                    if (sticks.length > 1) {
                        const names = sticks.map((st, i) => `${i + 1}. ${st.label || st.device}`).join('\n');
                        const pick = parseInt(await window.uiPrompt(`Which USB stick? Type its number.\n${names}`, '1', { title: 'USB stick' }), 10);
                        if (!(pick >= 1 && pick <= sticks.length)) return stopExportPolling();
                        body = { device: sticks[pick - 1].device };
                    }
                }
            }
            const res = await fetch(`${API_URL}/library/objects/${currentLoadedModelId}/export/${kind}`, {
                method: 'POST',
                headers: body ? { 'Content-Type': 'application/json' } : {},
                body: body ? JSON.stringify(body) : undefined
            });
            if (res.status === 503) {
                showExportStatus(isUsb ? 'Insert a USB stick.' : await window.apiError(res), true);
                return stopExportPolling();
            }
            if (!res.ok) {
                showExportStatus(await window.apiError(res), true);
                return stopExportPolling();
            }
        } catch (e) {
            showExportStatus('Could not reach the scanner.', true);
            return stopExportPolling();
        }

        if (isUsb) {
            showExportStatus('Copying to USB...');
            pollExport('/library/export/usb/status', (st) => {
                if (st.state === 'error') { showExportStatus(st.error || 'USB export failed.', true); return true; }
                if (st.state === 'done' && st.safe_to_remove) { showExportStatus('Done. You can remove the stick.'); return true; }
                const pct = st.bytes_total ? Math.round((st.bytes_done / st.bytes_total) * 100) : 0;
                if (st.state === 'syncing') showExportStatus('Finishing, do not remove the stick yet...');
                else if (st.state === 'mounting') showExportStatus('Opening the USB stick...');
                else showExportStatus(`Copying to USB... ${pct}%`);
                return false;
            });
        } else {
            // QR: archive, upload to Cloudflare R2, then a signed link valid 24 h
            const exportedId = currentLoadedModelId;
            showExportStatus('Preparing the archive...');
            showExportProgress(0);
            pollExport('/library/export/qr/status', (st) => {
                if (st.state === 'error') { showExportStatus(st.error || 'The upload failed.', true); return true; }
                if (st.state === 'expired') { showExportStatus('The link expired. Try again.', true); return true; }
                if (st.state === 'done') {
                    showExportStatus('');
                    if (exportedId === currentLoadedModelId) {
                        lastQr = { id: exportedId, expiresAt: st.expires_at };
                        showQr();
                    }
                    return true;
                }
                const pct = st.bytes_total ? Math.round((st.bytes_done / st.bytes_total) * 100) : 0;
                showExportProgress(pct);
                showExportStatus(st.state === 'uploading' ? `Uploading to the cloud... ${pct}%` : `Preparing the archive... ${pct}%`);
                return false;
            });
        }
    }

    // --- QR CODE ---
    let lastQr = null; // { id, expiresAt }: the link made for the model open now

    function showQr() {
        if (!qrModal || !lastQr) return;
        qrImage.src = `${API_URL}/library/export/qr/image.svg?t=${Date.now()}`; // a new link has a new code
        qrExpiry.textContent = lastQr.expiresAt
            ? `Valid until ${new Date(lastQr.expiresAt * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (24 h)`
            : 'Valid 24 h';
        qrModal.classList.add('show');
        if (btnShowQr) btnShowQr.style.display = 'flex';
    }

    if (qrImage) qrImage.addEventListener('error', () => {
        qrModal.classList.remove('show');
        showExportStatus('The QR code is not available. Try again.', true);
    });
    if (btnCloseQr) btnCloseQr.addEventListener('click', () => qrModal.classList.remove('show'));
    if (btnShowQr) btnShowQr.addEventListener('click', showQr);

    if (btnExport) btnExport.addEventListener('click', () => startExport('usb'));
    if (btnExportQr) btnExportQr.addEventListener('click', () => startExport('qr'));

    // --- EDIT (PATCH only the changed fields) ---
    function fillDetailForm() {
        if (!currentItem) return;
        document.getElementById('detail-title').value = currentItem.object.title || currentItem.id;
        document.getElementById('detail-desc').value = currentItem.object.description || '';
    }

    if (btnCancelEdit) btnCancelEdit.addEventListener('click', fillDetailForm);

    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', async () => {
            if (!currentItem) return;
            const title = document.getElementById('detail-title').value.trim();
            const description = document.getElementById('detail-desc').value.trim();
            const patch = {};
            if (title && title !== (currentItem.object.title || currentItem.id)) patch.title = title;
            if (description !== (currentItem.object.description || '')) patch.description = description;
            if (Object.keys(patch).length === 0) return;

            btnSaveEdit.innerText = 'Saving...';
            try {
                const res = await fetch(`${API_URL}/library/objects/${currentItem.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
                });
                if (!res.ok) throw new Error(await window.apiError(res));
                const updated = await res.json();
                Object.assign(currentItem.object, updated.object || patch);
                libraryDirty = true; // the card shows the old title until the list is reloaded
            } catch (e) {
                window.uiAlert(`Could not save: ${e.message}`);
            }
            btnSaveEdit.innerText = 'Save Changes';
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!currentLoadedModelId) return;
            if (await window.uiConfirm("Are you sure you want to delete this scan? This action cannot be undone.", { title: 'Delete scan', okText: 'Delete', danger: true })) {
                try {
                    const res = await fetch(`${API_URL}/library/objects/${currentLoadedModelId}`, { method: 'DELETE' });
                    // 405 = the server has no delete route for the library (yet)
                    if (res.status === 405) throw new Error("This scanner version cannot delete models yet.");
                    if (!res.ok) throw new Error(await window.apiError(res));
                    window.uiAlert("Scan deleted successfully.");
                    libraryDirty = true;
                    btnBack.click();
                } catch (error) {
                    window.uiAlert(`Failed to delete the scan: ${error.message}`);
                }
            }
        });
    }

    // --- LIST: filter, search and paging are done by the server (GET /library/objects) ---
    const CATEGORY_BY_TAB = { all: 'all', objects: 'object', faces: 'face' };
    const PAGE_SIZE = 6;     // models per page
    let currentPage = 1;     // 1-based
    let totalPages = 1;
    const pager = document.getElementById('library-pager');
    let requestSeq = 0;      // only the newest answer is drawn
    let libraryDirty = false; // an item was edited: reload the list when going back
    let searchTimer = null;

    libTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            libTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = CATEGORY_BY_TAB[e.target.innerText.trim().toLowerCase()] || 'all';
            loadLibrary(1);      // new filter: back to the first page (offset 0)
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadLibrary(1), 400); // after a short pause in typing
        });
    }

    const messageHtml = (text, color = 'var(--text-muted)') =>
        `<div style="grid-column: 1/-1; text-align: center; color: ${color}; padding: 40px;">${esc(text)}</div>`;

    async function loadLibrary(page = 1) {
        const seq = ++requestSeq;
        currentPage = Math.max(1, page);
        gridContainer.innerHTML = messageHtml('Loading library archives...');
        gridContainer.scrollTop = 0;

        const params = new URLSearchParams({ offset: (currentPage - 1) * PAGE_SIZE, limit: PAGE_SIZE, category: currentCategory });
        const term = (searchInput ? searchInput.value : '').trim().slice(0, 120);
        if (term) params.set('search', term);

        try {
            const res = await fetch(`${API_URL}/library/objects?${params}`);
            if (!res.ok) throw new Error(await window.apiError(res));
            const data = await res.json();
            if (seq !== requestSeq) return;

            totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
            // the page vanished (last model of it deleted): go to the new last page
            if (data.items.length === 0 && data.total > 0 && currentPage > totalPages) return loadLibrary(totalPages);

            gridContainer.innerHTML = '';
            if (data.items.length === 0) {
                gridContainer.innerHTML = messageHtml('No scans found matching criteria.');
            } else {
                appendCards(data.items);
            }
        } catch (error) {
            if (seq !== requestSeq) return;
            totalPages = 1;
            gridContainer.innerHTML = messageHtml(`Could not load the library: ${error.message}`, '#ef4444');
        }
        renderPager();
    }

    // Boxes with the page numbers: 1, last, the current page and its neighbours, "…" for the gaps
    function renderPager() {
        if (!pager) return;
        pager.innerHTML = '';
        if (totalPages <= 1) return;

        const pages = [];
        for (let n = 1; n <= totalPages; n++) {
            if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1) pages.push(n);
            else if (pages[pages.length - 1] !== '…') pages.push('…');
        }
        pages.forEach((n) => {
            const box = document.createElement(n === '…' ? 'div' : 'button');
            box.textContent = n;
            box.style.cssText = 'width: 48px; height: 48px; flex-shrink: 0; border-radius: 8px; font-size: 1rem; font-weight: 600; font-family: var(--font-mono); display: flex; align-items: center; justify-content: center;';
            if (n === '…') {
                box.style.color = 'var(--text-muted)';
            } else {
                const active = n === currentPage;
                box.style.border = `1px solid ${active ? 'var(--accent)' : 'var(--neutral-border)'}`;
                box.style.background = active ? 'var(--accent)' : 'var(--bg-secondary)';
                box.style.color = active ? 'var(--bg-primary)' : 'var(--text-main)';
                box.style.cursor = 'pointer';
                box.addEventListener('click', () => { if (!active) loadLibrary(n); });
            }
            pager.appendChild(box);
        });
    }

    function appendCards(items) {
        items.forEach(item => {
            const dateRaw = item.object.created_at ? new Date(item.object.created_at) : new Date();
            const dateStr = `${dateRaw.toLocaleString('en-US', { month: 'short' })} ${dateRaw.getDate()}`;
            const format = (item.models && item.models['.glb']) ? 'glb' : ((item.models && item.models['.stl']) ? 'stl' : 'glb');
            const cardId = `thumb-${item.id}`;
            const categoryLabel = item.category === 'face' ? 'FACE' : 'OBJECT';

            const card = document.createElement('div');
            card.className = 'lib-card';
            card.style.height = '264px';
            card.style.maxHeight = '264px';
            
            card.innerHTML = `
                <div class="lib-card-preview" id="${cardId}" style="flex: 1; background: rgba(0,0,0,0.2); position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--neutral-border); overflow: hidden;">
                    <div class="lib-card-badge" style="position: absolute; top:10px; left:10px; right:auto; background:var(--bg-secondary); color: var(--accent); padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; z-index: 10;">${categoryLabel}</div>
                    <div class="lib-card-badge" style="position: absolute; top:10px; right:10px; background:var(--bg-secondary); padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; z-index: 10;">${format.toUpperCase()}</div>
                </div>
                <div class="lib-card-info" style="padding: 16px; height: 80px; box-sizing: border-box;">
                    <div class="lib-card-title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 8px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(item.object.title || item.id)}</div>
                    <div class="lib-card-meta" style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); font-family: var(--font-mono);">
                        <span>Scan ${item.id.substring(item.id.length - 4)}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => openDetailView(item));
            gridContainer.appendChild(card);
            renderThumbnail(item.id, format, cardId);
        });
    }

    function centerObject(object3D) {
        const box = new THREE.Box3().setFromObject(object3D);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        object3D.position.set(-center.x, -center.y, -center.z);
        return size;
    }

    function renderThumbnail(id, format, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0); 
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6)); 
        const dLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dLight.position.set(50, 50, 50);
        scene.add(dLight);

        const group = new THREE.Group();
        scene.add(group);
        
        const animateThumb = () => {
            requestAnimationFrame(animateThumb);
            group.rotation.y += 0.005;
            renderer.render(scene, camera);
        };

        const url = `${API_URL}/library/objects/${id}/model?format=${format}&lod=low`;
        if (format === 'glb' || format === 'gltf') {
            gltfLoader.load(url, (gltf) => {
                const size = centerObject(gltf.scene);
                group.add(gltf.scene);
                camera.position.z = Math.abs(Math.max(size.x, size.y, size.z) / 2 / Math.tan(camera.fov * (Math.PI / 360))) * 1.5; 
                animateThumb();
            });
        } else {
            stlLoader.load(url, (geometry) => {
                const material = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 200 });
                const mesh = new THREE.Mesh(geometry, material);
                const size = centerObject(mesh);
                group.add(mesh);
                camera.position.z = Math.abs(Math.max(size.x, size.y, size.z) / 2 / Math.tan(camera.fov * (Math.PI / 360))) * 1.5; 
                animateThumb();
            });
        }
    }

    function openDetailView(item) {
        gridView.style.display = 'none';
        detailView.style.display = 'flex';
        currentLoadedModelId = item.id;
        currentItem = item;
        showExportStatus('');
        // the QR shown before belongs to another model
        if (btnShowQr) btnShowQr.style.display = lastQr && lastQr.id === item.id ? 'flex' : 'none';
        
        currentFmt = (item.models && item.models['.glb']) ? 'glb' : 'stl';
        currentLod = 'low';
        
        if(btnFmtGlb) btnFmtGlb.classList.toggle('active', currentFmt === 'glb');
        if(btnFmtStl) btnFmtStl.classList.toggle('active', currentFmt === 'stl');
        if(btnLodLow) btnLodLow.classList.add('active');
        if(btnLodHigh) btnLodHigh.classList.remove('active');

        document.getElementById('detail-title').value = item.object.title || item.id;
        document.getElementById('detail-desc').value = item.object.description || '';
        
        const dimsEl = document.getElementById('detail-dims');
        if (item.object.dimensions_mm) {
            const d = item.object.dimensions_mm;
            dimsEl.innerText = `${Math.round(d.length)} × ${Math.round(d.width)} × ${Math.round(d.height)}`;
        } else dimsEl.innerText = 'N/A';
        
        document.getElementById('detail-vol').innerText = item.object.volume_cm3 ? item.object.volume_cm3.toFixed(1) : 'N/A';
        
        loadMain3DModel(currentLoadedModelId, currentFmt, currentLod);
    }

    const updateModel = () => loadMain3DModel(currentLoadedModelId, currentFmt, currentLod);

    if(btnFmtGlb) btnFmtGlb.addEventListener('click', () => {
        if(currentFmt === 'glb' || !currentLoadedModelId) return;
        currentFmt = 'glb';
        btnFmtGlb.classList.add('active');
        btnFmtStl.classList.remove('active');
        updateModel();
    });

    if(btnFmtStl) btnFmtStl.addEventListener('click', () => {
        if(currentFmt === 'stl' || !currentLoadedModelId) return;
        currentFmt = 'stl';
        btnFmtStl.classList.add('active');
        btnFmtGlb.classList.remove('active');
        updateModel();
    });

    if(btnLodLow) btnLodLow.addEventListener('click', () => {
        if(currentLod === 'low' || !currentLoadedModelId) return;
        currentLod = 'low';
        btnLodLow.classList.add('active');
        btnLodHigh.classList.remove('active');
        updateModel();
    });
    
    if(btnLodHigh) btnLodHigh.addEventListener('click', () => {
        if(currentLod === 'high' || !currentLoadedModelId) return;
        currentLod = 'high';
        btnLodHigh.classList.add('active');
        btnLodLow.classList.remove('active');
        updateModel();
    });

    function initMainThreeJS() {
        if (mainScene) return; 
        const container = document.getElementById('model-3d-canvas');
        if (!container) return;
        
        container.style.position = 'relative';

        mainScene = new THREE.Scene();
        mainCamera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
        
        mainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        mainRenderer.outputEncoding = THREE.sRGBEncoding;
        mainRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        mainRenderer.setSize(container.clientWidth, container.clientHeight);
        mainRenderer.setClearColor(0x000000, 0); 
        mainRenderer.domElement.style.touchAction = 'none';
        container.appendChild(mainRenderer.domElement);
        
        mainControls = new THREE.OrbitControls(mainCamera, mainRenderer.domElement);
        mainControls.enableDamping = true;
        mainControls.dampingFactor = 0.1;
        mainControls.enableZoom = true; 

        // POARTA DE AFIȘAJ / PORTALUL PENTRU ZOOM TACTIL
        const zoomPortal = document.createElement('div');
        zoomPortal.style.position = 'absolute';
        zoomPortal.style.right = '0';
        zoomPortal.style.top = '0';
        zoomPortal.style.width = '60px'; 
        zoomPortal.style.height = '100%';
        zoomPortal.style.zIndex = '10';
        zoomPortal.style.background = 'linear-gradient(to right, rgba(0,0,0,0), rgba(255,255,255,0.15))'; 
        zoomPortal.style.display = 'flex';
        zoomPortal.style.alignItems = 'center';
        zoomPortal.style.justifyContent = 'center';
        zoomPortal.style.cursor = 'ns-resize';
        zoomPortal.style.touchAction = 'none'; 
        
        zoomPortal.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; opacity:0.6; color:var(--text-main, white);">
                <span style="font-size:24px;">▲</span>
                <span style="writing-mode: vertical-rl; margin:10px 0; font-size:12px; letter-spacing:2px; font-weight:bold;">ZOOM</span>
                <span style="font-size:24px;">▼</span>
            </div>
        `;
        container.appendChild(zoomPortal);

        let isPortalZooming = false;
        let lastPortalY = 0;

        zoomPortal.addEventListener('pointerdown', (e) => {
            isPortalZooming = true;
            lastPortalY = e.clientY;
            zoomPortal.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        zoomPortal.addEventListener('pointermove', (e) => {
            if (!isPortalZooming) return;
            const deltaY = e.clientY - lastPortalY;
            lastPortalY = e.clientY;
            const currentCamDist = mainCamera.position.distanceTo(mainControls.target);
            const scale = 1 + (deltaY * 0.015); 
            const direction = new THREE.Vector3().subVectors(mainCamera.position, mainControls.target).normalize();
            mainCamera.position.copy(mainControls.target).add(direction.multiplyScalar(currentCamDist * scale));
            mainControls.update();
        });

        zoomPortal.addEventListener('pointerup', (e) => {
            isPortalZooming = false;
            zoomPortal.releasePointerCapture(e.pointerId);
        });

        mainScene.add(new THREE.AmbientLight(0xffffff, 0.4));
        
        const light1 = new THREE.DirectionalLight(0xffffff, 1.2); 
        light1.position.set(100, 100, 100); 
        mainScene.add(light1);
        
        const light2 = new THREE.DirectionalLight(0xffffff, 0.6); 
        light2.position.set(-100, -50, -100); 
        mainScene.add(light2);
        
        const light3 = new THREE.DirectionalLight(0xffffff, 0.4); 
        light3.position.set(0, 100, -100); 
        mainScene.add(light3);

        window.addEventListener('resize', () => {
            if (detailView && detailView.style.display !== 'none' && container.clientWidth > 0) {
                mainCamera.aspect = container.clientWidth / container.clientHeight;
                mainCamera.updateProjectionMatrix();
                mainRenderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

    }

    function animateMain() {
        mainAnimationFrameId = requestAnimationFrame(animateMain);
        mainControls.update();
        mainRenderer.render(mainScene, mainCamera);
    }

    function loadMain3DModel(id, format, lod) {
        initMainThreeJS();
        // the Back button stops the loop: without this the canvas keeps the last frame of the previous model
        if (!mainAnimationFrameId) animateMain();
        const container = document.getElementById('model-3d-canvas');
        if (container && container.clientWidth > 0) {
            mainCamera.aspect = container.clientWidth / container.clientHeight;
            mainCamera.updateProjectionMatrix();
            mainRenderer.setSize(container.clientWidth, container.clientHeight);
        }
        
        if (mainModelObject && mainScene) {
            mainScene.remove(mainModelObject);
            mainModelObject = null;
        }

        const modelUrl = `${API_URL}/library/objects/${id}/model?format=${format}&lod=${lod}`;
        const wrapper = new THREE.Group();
        mainScene.add(wrapper);
        mainModelObject = wrapper; 

        const applyCameraMain = (size) => {
            const maxDim = Math.max(size.x, size.y, size.z);
            mainCamera.position.set(0, maxDim * 0.5, Math.abs(maxDim / 2 / Math.tan(mainCamera.fov * (Math.PI / 360))) * 1.5);
            mainCamera.lookAt(0, 0, 0);
            mainControls.target.set(0, 0, 0);
            mainControls.update();
        };

        if (format === 'glb' || format === 'gltf') {
            gltfLoader.load(modelUrl, (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.metalness = 0.0;
                        child.material.roughness = 0.8;
                        child.material.needsUpdate = true;
                    }
                });
                const size = centerObject(model);
                wrapper.add(model);
                applyCameraMain(size);
            });
        } else {
            stlLoader.load(modelUrl, (geometry) => {
                const material = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 200 });
                const mesh = new THREE.Mesh(geometry, material);
                const size = centerObject(mesh);
                wrapper.add(mesh);
                applyCameraMain(size);
            });
        }
    }

    loadLibrary(1); // last: it uses the state declared above
});
