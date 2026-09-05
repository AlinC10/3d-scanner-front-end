from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import time

app = Flask(__name__)
CORS(app) # Permite interfeței web (JS) să acceseze API-ul

# --- WI-FI API ---
@app.route('/api/wifi/scan', methods=['GET'])
def scan_wifi():
    try:
        # Folosim nmcli (NetworkManager) pentru a scana retelele
        result = subprocess.run(['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi'], capture_output=True, text=True)
        networks = []
        # Parsam rezultatul (linii de forma: NumeRetea:80:WPA2)
        for line in result.stdout.split('\n'):
            if line:
                parts = line.split(':')
                if len(parts) >= 3 and parts[0]: # Ignoram retelele ascunse fara SSID
                    networks.append({
                        "ssid": parts[0],
                        "signal": parts[1],
                        "security": parts[2]
                    })
        # Eliminam duplicatele
        unique_networks = {v['ssid']:v for v in networks}.values()
        return jsonify(list(unique_networks))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/wifi/connect', methods=['POST'])
def connect_wifi():
    data = request.json
    ssid = data.get('ssid')
    password = data.get('password', '')
    
    try:
        if password:
            cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid, 'password', password]
        else:
            cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
            
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if "successfully activated" in result.stdout:
            return jsonify({"status": "success", "message": f"Conectat la {ssid}"})
        else:
            return jsonify({"status": "error", "message": result.stderr or result.stdout}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- BLUETOOTH API (MOCK pentru moment, necesita bluetoothctl) ---
@app.route('/api/bluetooth/scan', methods=['GET'])
def scan_bt():
    # Pentru un produs real, aici s-ar integra biblioteca 'pybluez' sau comenzi 'bluetoothctl'
    # Returnam date simulate pentru a testa integrarea frontend-backend
    mock_devices = [
        {"name": "Turntable_V2", "address": "00:11:22:33:44:55", "status": "Paired"},
        {"name": "Laser_Calibration_Tool", "address": "AA:BB:CC:DD:EE:FF", "status": "Available"}
    ]
    time.sleep(1) # Simulam timpul de scanare
    return jsonify(mock_devices)

if __name__ == '__main__':
    # Rulam serverul pe portul 5000, accesibil doar local (pentru kiosk)
    app.run(host='127.0.0.1', port=5000, debug=True)