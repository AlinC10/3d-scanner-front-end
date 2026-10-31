// Every API error is {"detail": "<message>"}; a 422 has "detail" as a list of field errors.
window.apiError = async function (response) {
    let body = null;
    try { body = await response.json(); } catch (e) { return `HTTP ${response.status}`; }
    const detail = body && body.detail;
    if (Array.isArray(detail)) {
        return detail.map(d => `${(d.loc || []).filter(p => p !== 'body').join('.')}: ${d.msg}`).join('\n');
    }
    return typeof detail === 'string' ? detail : `HTTP ${response.status}`;
};

// --- IN-APP DIALOGS (replace alert / confirm / prompt, which look like browser windows in the kiosk) ---
// Each returns a Promise: uiAlert -> undefined, uiConfirm -> true/false, uiPrompt -> the text or null (Cancel).
(function () {
    let dialog = null;
    let queue = Promise.resolve(); // one dialog at a time, in call order

    function build() {
        dialog = document.createElement('div');
        dialog.id = 'ui-dialog';
        dialog.innerHTML = `
            <div class="ui-dialog-box" role="dialog" aria-modal="true">
                <div class="ui-dialog-title"></div>
                <div class="ui-dialog-msg"></div>
                <input class="ui-dialog-input custom-input" type="text" autocomplete="off">
                <div class="ui-dialog-actions">
                    <button class="btn-secondary ui-dialog-cancel">Cancel</button>
                    <button class="btn-primary ui-dialog-ok">OK</button>
                </div>
            </div>`;
        document.body.appendChild(dialog);
        if (window.attachKeyboard) window.attachKeyboard(dialog.querySelector('.ui-dialog-input'));
    }

    function open(kind, message, opts = {}) {
        const run = () => new Promise((resolve) => {
            if (!dialog) build();
            const title = dialog.querySelector('.ui-dialog-title');
            const msg = dialog.querySelector('.ui-dialog-msg');
            const input = dialog.querySelector('.ui-dialog-input');
            const ok = dialog.querySelector('.ui-dialog-ok');
            const cancel = dialog.querySelector('.ui-dialog-cancel');

            title.textContent = opts.title || (kind === 'alert' ? 'Notice' : kind === 'confirm' ? 'Please confirm' : 'Input needed');
            title.style.display = opts.title === '' ? 'none' : 'block';
            msg.textContent = message;
            input.style.display = kind === 'prompt' ? 'block' : 'none';
            input.type = opts.password ? 'password' : 'text';
            input.value = opts.value || '';
            cancel.style.display = kind === 'alert' ? 'none' : '';
            ok.textContent = opts.okText || 'OK';
            ok.classList.toggle('ui-dialog-danger', !!opts.danger);
            cancel.textContent = opts.cancelText || 'Cancel';

            const close = (result) => {
                dialog.classList.remove('show');
                ok.onclick = cancel.onclick = null;
                const kb = document.getElementById('keyboard-super-wrapper');
                if (kb) kb.style.display = 'none';
                document.body.classList.remove('keyboard-is-open');
                input.blur();
                resolve(result);
            };
            ok.onclick = () => close(kind === 'prompt' ? input.value : (kind === 'confirm' ? true : undefined));
            cancel.onclick = () => close(kind === 'prompt' ? null : false);
            dialog.classList.add('show');
            if (kind === 'prompt') setTimeout(() => input.focus(), 50);
        });
        const p = queue.then(run);
        queue = p.catch(() => {});
        return p;
    }

    window.uiAlert = (message, opts) => open('alert', String(message), opts);
    window.uiConfirm = (message, opts) => open('confirm', String(message), opts);
    window.uiPrompt = (message, value = '', opts = {}) => open('prompt', String(message), { ...opts, value });
})();

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

    const Keyboard = window.SimpleKeyboard.default;
    const wrapper = document.getElementById('keyboard-super-wrapper');
    let selectedInput = null;
    
    const myKeyboard = new Keyboard({
        // ==========================================
        // AICI DEFINIM LAYOUT-UL PERSONALIZAT
        // ==========================================
        layout: {
            'default': [
                '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
                '{tab} q w e r t y u i o p [ ] \\',
                '{lock} a s d f g h j k l ; \' {enter}',
                '{shift} z x c v b n m , . ? {send}',
                '.com {space} @'
            ],
            'shift': [
                '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                '{tab} Q W E R T Y U I O P { } |',
                '{lock} A S D F G H J K L : " {enter}',
                '{shift} Z X C V B N M < > / {send}',
                '.com {space} @'
            ]
        },
        display: {
            '{send}': 'send ➔',
            '{bksp}': 'backspace',
            '{enter}': 'enter',
            '{shift}': 'shift',
            '{tab}': 'tab',
            '{lock}': 'caps',
            '{space}': ' '
        },
        newLineOnEnter: true,
        // ==========================================
        tabCharOnTab: true,
        onChange: input => {
            if (selectedInput) {
                selectedInput.value = input;
            }
        },
        onKeyPress: button => {
            // Dacă apasă Enter sau Escape, se închide tastatura
            if ( button === "{escape}") {
                closeKeyboard();
            }
            if (button === "{send}") {
                if (selectedInput && selectedInput.id === 'ai-input') {
                    const sendBtn = document.getElementById('ai-send-btn');
                    if (sendBtn) sendBtn.click(); // Apasă butonul real de trimitere
                }
            }
            // Dacă apasă Shift sau Caps Lock, schimbăm layout-ul
            if (button === "{shift}" || button === "{lock}") {
                handleShift();
            }
        }
    });

    // Funcția care comută între litere mici (default) și mari (shift)
    function handleShift() {
        let currentLayout = myKeyboard.options.layoutName;
        let shiftToggle = currentLayout === "default" ? "shift" : "default";

        myKeyboard.setOptions({
            layoutName: shiftToggle
        });
    }

    function closeKeyboard() {
        wrapper.style.display = "none";
        document.body.classList.remove("keyboard-is-open");
        if (selectedInput) selectedInput.blur();
    }

    // Also used for inputs created later (the in-app dialogs)
    window.attachKeyboard = (input) => {
        input.addEventListener("focus", (e) => {
            selectedInput = e.target;
            myKeyboard.setInput(e.target.value); 
            wrapper.style.display = "block"; 
            document.body.classList.add("keyboard-is-open");
        });
    };
    document.querySelectorAll("input[type='text'], input[type='password'], input[type='email'], input[type='number'], textarea").forEach(window.attachKeyboard);

    document.addEventListener('click', (e) => {
        if (selectedInput && !wrapper.contains(e.target) && e.target !== selectedInput) {
            closeKeyboard();
        }
    });
    // --- DRAG TO SCROLL (touchscreen) ---
    // Any element that has a scroll bar can be dragged with a finger: the nearest scrollable ancestor of the
    // touched point scrolls (works for elements added later too, e.g. the library cards and the test cards).
    // Buttons, labels and toggles may start a drag too (a drag cancels their click below); text fields, sliders,
    // lists and the 3D viewer keep their own touch handling.
    const NO_DRAG = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select, option, canvas, #model-3d-canvas, .simple-keyboard';
    const DRAG_THRESHOLD = 8; // px before a touch counts as a drag (a smaller move is a tap)

    function scrollableAncestor(el) {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
            const overflowY = getComputedStyle(n).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
        }
        return null;
    }

    let drag = null;       // { el, startY, startTop, active }
    let dragHappened = false;

    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest && e.target.closest(NO_DRAG)) return;
        const el = scrollableAncestor(e.target);
        drag = el ? { el, startY: e.clientY, startTop: el.scrollTop, active: false } : null;
    });

    document.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dy = e.clientY - drag.startY;
        if (!drag.active && Math.abs(dy) < DRAG_THRESHOLD) return;
        if (!drag.active) {
            drag.active = true;
            dragHappened = true;
            const sel = window.getSelection && window.getSelection();
            if (sel) sel.removeAllRanges(); // a mouse-emulated touch would otherwise select text while dragging
        }
        drag.el.scrollTop = drag.startTop - dy * 1.5; // 1.5 = scroll speed
    });

    const endDrag = () => {
        drag = null;
        setTimeout(() => { dragHappened = false; }, 50);
    };
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    // A drag must not "click" the card / button under the finger when it ends
    document.addEventListener('click', (e) => {
        if (dragHappened) { e.stopPropagation(); e.preventDefault(); }
    }, true);
});

