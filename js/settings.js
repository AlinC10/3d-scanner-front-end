document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';

    const btnApiSend = document.getElementById('btn-api-test-send');
    
    if (btnApiSend) {
        btnApiSend.addEventListener('click', async () => {
            const endpointSelect = document.getElementById('api-tester-endpoint').value.split('|');
            const method = endpointSelect[0];
            const route = endpointSelect[1];
            const jsonBodyRaw = document.getElementById('api-tester-json').value;
            const responsePre = document.getElementById('api-tester-response');
            const statusDiv = document.getElementById('api-tester-status');
            
            responsePre.innerText = "Sending request...";
            statusDiv.innerText = "Status: waiting...";

            let fetchOptions = { 
                method: method, 
                headers: {} 
            };

            if (method !== 'GET') {
                fetchOptions.headers['Content-Type'] = 'application/json';
                try { 
                    JSON.parse(jsonBodyRaw); // Validăm JSON-ul
                    fetchOptions.body = jsonBodyRaw; 
                } catch(e) { 
                    responsePre.innerText = "Invalid JSON input format!"; 
                    statusDiv.innerText = "Status: Error";
                    return; 
                }
            }

            try {
                const res = await fetch(`${API_URL}${route}`, fetchOptions);
                statusDiv.innerText = `Status: ${res.status} ${res.statusText}`;
                
                try {
                    const data = await res.json();
                    responsePre.innerText = JSON.stringify(data, null, 2);
                } catch(e) {
                    responsePre.innerText = await res.text();
                }
            } catch(error) {
                statusDiv.innerText = "Status: Fetch Error";
                responsePre.innerText = error.toString();
            }
        });
    }
});