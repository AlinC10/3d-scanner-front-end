document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://127.0.0.1:8000';

    // --- FETCH & PARSE MARKDOWN ---
    async function fetchMarkdown(filename, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Afișăm spinner-ul de loading
        container.innerHTML = `
            <div style="text-align: center; margin-top: 40px;">
                <svg viewBox="0 0 24 24" class="spinner" style="width: 32px; height: 32px;">
                    <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" fill="none" stroke-linecap="round"></circle>
                </svg>
                <p style="margin-top: 16px;">Loading document from server...</p>
            </div>
        `;

        try {
            // Adăugăm ?t=timestamp ca să forțăm browserul să nu țină documentația veche în cache
            const response = await fetch(`${API_URL}/docs/${filename}?t=${new Date().getTime()}`);
            
            if (!response.ok) throw new Error('File not found');
            
            const text = await response.text();
            
            // Verificăm dacă librăria marked.js s-a încărcat corect din HTML
            if (typeof marked !== 'undefined') {
                container.innerHTML = marked.parse(text);
            } else {
                container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Error: marked.js library is missing in the HTML head.</div>`;
            }
        } catch (e) {
            container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Error loading documentation: <b>${filename}</b> could not be found. Make sure FastAPI is serving the directory.</div>`;
        }
    }

    // --- EVENT LISTENERS PENTRU CARDURILE DE HELP ---
    const userDocBtn = document.querySelector('[data-modal="doc-user-modal"]');
    if (userDocBtn) {
        userDocBtn.addEventListener('click', () => {
            fetchMarkdown('user_manual.md', 'user-manual-content');
        });
    }

    const techDocBtn = document.querySelector('[data-modal="doc-tech-modal"]');
    if (techDocBtn) {
        techDocBtn.addEventListener('click', () => {
            fetchMarkdown('technical_documentation.md', 'tech-doc-content');
        });
    }

});