document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SYSTEM CLOCK ---
    function updateClock() {
        const clockEl = document.getElementById('clock');
        if (clockEl) clockEl.innerText = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    setInterval(updateClock, 1000); updateClock();

    // --- 2. THEME TOGGLE (Persistent across pages) ---
    const btnTheme = document.getElementById('btn-theme');
    
    function updateThemeIcon(isLight) {
        if (!btnTheme) return;
        if (isLight) {
            btnTheme.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        } else {
            btnTheme.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        }
    }

    const savedTheme = localStorage.getItem('scancore_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // AICI S-A FĂCUT REPARAȚIA PENTRU ICONIȚA DE TEMĂ
    updateThemeIcon(savedTheme === 'light');

    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('scancore_theme', isLight ? 'light' : 'dark');
            updateThemeIcon(isLight);
        });
    }

    // --- 3. NAVIGATION MULTI-PAGE ---
    function navigateToPage(targetId) {
        let page = targetId;
        if (targetId === 'main-menu') page = 'index';
        if (targetId === 'settings-screen') page = 'settings';
        if (targetId === 'help-screen') page = 'help';
        
        window.location.href = `${page}.html`;
    }

    document.querySelectorAll('[data-action="nav"], .nav-tab').forEach(el => {
        el.addEventListener('click', function(e) { 
            e.stopPropagation();
            navigateToPage(this.getAttribute('data-target'));
        });
    });

    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        const target = tab.getAttribute('data-target');
        
        if (currentPath.includes('index.html') && target === 'main-menu') tab.classList.add('active');
        else if (currentPath.includes('library.html') && target === 'library') tab.classList.add('active');
        else if (currentPath.includes('help.html') && target === 'help-screen') tab.classList.add('active');
    });

    // --- 4. GENERIC UI TOGGLES ---
    document.querySelectorAll('.toggle-switch:not([id])').forEach(toggle => {
        toggle.addEventListener('click', function() { this.classList.toggle('active'); });
    });

    // --- 5. GLOBAL MODAL LOGIC ---
    const overlay = document.getElementById('modal-overlay');
    
    function closeAllModals() {
        if(overlay) overlay.classList.remove('show');
        document.querySelectorAll('.os-modal').forEach(m => m.classList.remove('show'));
        const aiModal = document.getElementById('ai-modal');
        const btnFab = document.getElementById('btn-fab');
        if (aiModal && aiModal.classList.contains('show')) {
            aiModal.classList.remove('show');
            if(btnFab) btnFab.style.display = 'flex';
        }
        
        // Dacă funcția stopAutoScan există (încărcată din network.js), o apelăm
        if(typeof window.stopAutoScan === 'function') window.stopAutoScan();
    }
    
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeAllModals));
    if(overlay) overlay.addEventListener('click', closeAllModals);
    window.closeAllModals = closeAllModals; 

    // Deschidem modalele generice (WIFI, BT, Export)
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            const modalEl = document.getElementById(modalId);
            if(overlay && modalEl) {
                overlay.classList.add('show');
                modalEl.classList.add('show');
            }
            
            // Logica specifică de rețea e declanșată global
            if (typeof window.triggerNetworkModalScan === 'function') {
                window.triggerNetworkModalScan(modalId);
            }
        });
    });
});