document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';
    let statusInterval = null;

    const statusTitle = document.getElementById('scan-status-title');
    const scanStream = document.getElementById('active-scan-stream');
    const btnCancel = document.getElementById('btn-cancel-scan');

    // Pornim MJPEG stream-ul imediat ce intrăm pe pagină
    if (scanStream) {
        scanStream.src = `${API_URL}/scanner/stream`;
    }

    // Funcția globală de cancel (Trimite semnal la hardware și ne întoarce la meniu)
    async function triggerCancel() {
        if(statusInterval) clearInterval(statusInterval);
        
        statusTitle.innerText = "Canceling...";
        try { 
            await fetch(`${API_URL}/scanner/cancel`, { method: 'POST' }); 
        } catch(e) {
            console.error("Failed to call cancel endpoint.");
        }
        
        // Ieșim din pagină înapoi la meniul principal
        window.location.href = 'index.html';
    }
    
    if (btnCancel) {
        btnCancel.addEventListener('click', triggerCancel);
    }

    // Începem polling-ul automat pentru a verifica starea hardware-ului
    if (statusTitle) {
        statusTitle.innerText = "Status: Preparing Hardware...";
        
        statusInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/scanner/status`);
                const data = await res.json();
                
                // Când backend-ul spune că e gata de treabă
                if(data.status === 'ready_to_scan' || data.status === 'scanning') {
                    clearInterval(statusInterval);
                    statusTitle.innerText = "Status: Scanning in progress...";
                    
                    // Declanșăm scanarea efectivă
                    await fetch(`${API_URL}/scanner/scan`, { method: 'POST' });
                } else if (data.status === 'error') {
                    clearInterval(statusInterval);
                    statusTitle.innerText = "Hardware Error!";
                    statusTitle.style.color = "#ef4444";
                }
            } catch(e) { 
                console.error("Status polling failed", e); 
            }
        }, 5000);
    }
});