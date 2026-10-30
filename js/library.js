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

    let allLibraryItems = [];
    let currentCategory = 'All';
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

    fetchLibraryData();

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            detailView.style.display = 'none';
            gridView.style.display = 'flex';
            if (mainModelObject && mainScene) {
                mainScene.remove(mainModelObject);
                mainModelObject = null;
            }
            if (mainAnimationFrameId) cancelAnimationFrame(mainAnimationFrameId);
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (!currentLoadedModelId) return;
            // Descarcăm modelul direct ca fișier utilizând un link temporar
            const url = `${API_URL}/library/objects/${currentLoadedModelId}/model?format=${currentFmt}&lod=${currentLod}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `scan_${currentLoadedModelId}_${currentLod}.${currentFmt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!currentLoadedModelId) return;
            if (confirm("Are you sure you want to delete this scan? This action cannot be undone.")) {
                try {
                    const res = await fetch(`${API_URL}/library/objects/${currentLoadedModelId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Delete failed");
                    alert("Scan deleted successfully.");
                    fetchLibraryData();
                    btnBack.click();
                } catch (error) {
                    alert("Failed to delete the scan.");
                }
            }
        });
    }

    libTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            libTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.innerText.trim();
            renderGrid(searchInput ? searchInput.value : '');
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderGrid(e.target.value));
    }

    function getCategory(item) {
        const title = (item.object.title || item.id).toLowerCase();
        const desc = (item.object.description || '').toLowerCase();
        if (title.includes('face') || title.includes('profile') || title.includes('subject') || title.includes('head') || desc.includes('face') || desc.includes('profile')) return 'Faces';
        return 'Objects';
    }

    // Preluăm o limită mult mai mare pentru a asigura prezența majorității obiectelor în view
    // Paginarea avansată pe server presupune implementarea infinite-scroll cu request-uri succesive.
    async function fetchLibraryData() {
        gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Loading library archives...</div>`;
        try {
            const res = await fetch(`${API_URL}/library/objects?offset=0&limit=100`);
            if (!res.ok) throw new Error("API Error");
            const data = await res.json();
            allLibraryItems = data.items && data.items.length > 0 ? data.items : [];
        } catch (error) {
            allLibraryItems = []; 
        }
        renderGrid(searchInput ? searchInput.value : '');
    }

    function renderGrid(searchTerm = '') {
        gridContainer.innerHTML = '';
        const lowerSearch = searchTerm.toLowerCase();

        const filteredItems = allLibraryItems.filter(item => {
            const title = (item.object.title || item.id).toLowerCase();
            return title.includes(lowerSearch) && (currentCategory === 'All' || getCategory(item) === currentCategory);
        });

        if (filteredItems.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No scans found matching criteria.</div>`;
            return;
        }
        
        filteredItems.forEach(item => {
            const dateRaw = item.object.created_at ? new Date(item.object.created_at) : new Date();
            const dateStr = `${dateRaw.toLocaleString('en-US', { month: 'short' })} ${dateRaw.getDate()}`;
            const format = (item.models && item.models['.glb']) ? 'glb' : ((item.models && item.models['.stl']) ? 'stl' : 'glb');
            const cardId = `thumb-${item.id}`;

            const card = document.createElement('div');
            card.className = 'lib-card';
            card.style.height = '280px';
            card.style.maxHeight = '280px';
            
            card.innerHTML = `
                <div class="lib-card-preview" id="${cardId}" style="flex: 1; background: rgba(0,0,0,0.2); position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--neutral-border); overflow: hidden;">
                    <div class="lib-card-badge" style="position: absolute; top:10px; right:10px; background:var(--bg-secondary); padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; z-index: 10;">${format.toUpperCase()}</div>
                </div>
                <div class="lib-card-info" style="padding: 16px; height: 80px; box-sizing: border-box;">
                    <div class="lib-card-title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 8px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.object.title || item.id}</div>
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

        function animateMain() {
            mainAnimationFrameId = requestAnimationFrame(animateMain);
            mainControls.update();
            mainRenderer.render(mainScene, mainCamera);
        }
        animateMain();
    }

    function loadMain3DModel(id, format, lod) {
        initMainThreeJS();
        
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
});