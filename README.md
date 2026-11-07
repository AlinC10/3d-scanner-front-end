# ScanCore-3D OS - Front-End Interface

ScanCore-3D OS is a web-based operating system interface designed to control a dual-camera photogrammetry 3D scanner. Optimized for touchscreen kiosk displays (Raspberry Pi 4/5 running Chromium in kiosk mode), the interface delivers a fluid, responsive, desktop-grade experience with an Edge-to-Cloud architecture.

---

## 1. System Overview & Architecture

The system utilizes an **Edge-to-Cloud architecture**:

* **Edge (Local Raspberry Pi):** The front-end communicates directly with a local FastAPI server (`http://127.0.0.1:8000`) hosted on the scanner's internal Raspberry Pi. This handles immediate physical tasks: dual IMX477 camera feeds, stepper motors (turntable rotation, Z-axis lead screw), LED ring illumination, hardware homing, and local network management.
* **Cloud (RunPod GPU & Cloudflare R2):** Heavy photogrammetry reconstruction (Meshroom / Turntable Studio stitching photos into dense 3D meshes) is offloaded to remote GPU cloud instances via Cloudflare R2 object storage.
* **Decoupled Parallel Scanning:** Immediately after physical photography and upload verification finish on the Pi, the physical rig decouples and returns to an idle/available state (`processing`). A new scan can be prepared and started immediately on the physical hardware while previous 3D models reconstruct concurrently in the cloud.

---

## 2. Project & File Structure

The application is structured as a modular Multi-Page Application (MPA) designed to feel like a Single-Page Application (SPA) with seamless anti-flicker transitions.

```
.
├── index.html              # Main dashboard launcher & status overview
├── scan-object.html        # Object photogrammetry configuration & preparation
├── scan-face.html          # Facial 3D stereo scanning configuration
├── scanning.html           # Live telemetry, dual camera MJPEG stream & progress
├── library.html            # Three.js 3D model viewer, mesh inspector & export
├── settings.html           # System diagnostics, device controls & API tester
├── help.html               # User guide, photogrammetry best practices & FAQ
├── css/
│   ├── theme.css           # Design tokens, color palettes (Dark/Light), typography
│   ├── layout.css          # Header, navigation, touch layout structure
│   ├── components.css       # Buttons, range sliders, switches, badges, notifications
│   ├── modals.css          # Modal dialogs, Wi-Fi selector, QR code & export modals
│   ├── scanner.css         # Hardware setting cards & disclosures
│   ├── scanning.css        # Stream viewports, dual-camera switchers, telemetry cards
│   ├── library.css         # 3D canvas viewport, gallery cards, inspector sidebar
│   ├── settings.css        # Developer API tester workbench & diagnostic widgets
│   ├── ai-chat.css         # ScanAssist AI chat drawer & suggestion chips
│   ├── keyb.css            # Virtual touch on-screen keyboard styling
│   ├── markdown.css        # Markdown rendering styles for AI and help
│   └── index.css           # Hero section and dashboard tiles
└── js/
    ├── global.js           # Core OS runtime, touch-drag scroll, virtual keyboard, theme
    ├── scan-monitor.js     # Persistent multi-scan background tracker & floating drawer
    ├── scanning-progress.js# Telemetry engine, MJPEG stream loader, decoupled cancel
    ├── scanner.js          # Hardware parameter synchronizer & pre-flight checks
    ├── library.js          # Three.js 3D engine, mesh decimation, QR code exporter
    ├── network.js          # Ethernet & Wi-Fi state management & modal scanner
    ├── ai-chat.js          # ScanAssist conversational assistant drawer
    ├── settings.js         # API endpoint tester & hardware diagnostic tools
    ├── help.js             # Collapsible documentation and FAQ search
    └── index.js            # Dashboard quick stats & tile interactions
```

---

## 3. Core Workflows & Features

### 3.1 Object Scanning Workflow (`scan-object.html`)
Designed for automated 360° photogrammetry on the motorized turntable:
* **Mechanical Settings:** Adjust Z-axis start height, turntable rotation step angle (e.g., 18.0°/step = 20 photos per ring), Z vertical climb distance, motor deceleration/acceleration ramp percentages, and rotation delays.
* **Camera & Illumination:** Fine-tune LED ring illumination brightness (0–100%) and capture photo quality (JPEG compression ratio).
* **Focus Modes:**
  * **Recommended (`"optim"`):** Automatically sets calibrated fixed focal positions `(100, 100)` matching the turntable distance. Bypasses the noisy, slow VCM autofocus sweep, cutting 5–10 seconds from prep time and keeping focal length perfectly constant for 3D reconstruction.
  * **Auto:** Classic sharpness-based VCM autofocus sweep.
  * **None (`null`):** Restores last saved manual lens position.
  * **Manual Single:** Synchronized manual focus slider (0–1023) for both cameras simultaneously.
  * **Manual Per-Camera:** Individual focus sliders for Camera 1 and Camera 2 independently.
* **Streaming Turntable Studio (RunPod GPU Acceleration):** Enabled by default (`cloud.start_pod_with_scan: true`). The cloud GPU pod automatically warms up during the final capture tier so 3D reconstruction starts instantly when photo upload completes.
* **Pre-Scan Metadata:** Optional title and notes assigned before starting the scan.

### 3.2 Facial 3D Scanning Workflow (`scan-face.html`)
Tailored for fast, comfortable 3D portrait capture:
* **Automated Face Search:** Configurable search range, search step, and strategies (`direct_stop` or manual Z override).
* **Eyes-Open Verification & Countdown:** Features a safety audio countdown and photo burst selector that selects the frame where the subject's eyes are most open.
* **Gentle Illumination:** Reduced default LED brightness (35%) to protect the subject's eyes.
* **Recommended Focus (`"optim"`):** Pre-calibrated lens position `(120, 120)` tuned for seated subjects.

### 3.3 Live Telemetry & Scanning View (`scanning.html`)
The live dashboard active during scan execution:
* **Dual-Camera Live Stream:** Real-time MJPEG camera stream with an instant toggle between Camera 1 (Upper) and Camera 2 (Lower).
* **Hardware Preparation Telemetry:** Monitors homing, camera warmup, and sensor validation (`preparing` / `prepared`).
* **Real-time Capture Counters:** Live counter tracking photos captured vs. photos uploaded and verified in cloud storage.
* **Decoupled Job Cancellation:** Pressing "Cancel Scan" invokes targeted cancellation (`POST /jobs/{job_id}/cancel`). If another scan is reconstructing in the background, it remains unaffected; if cancelling during hardware homing, it securely stops the motors.
* **Upload Timeout Alerts:** Real-time warning banners if Wi-Fi degrades or network drain approaches timeout limits.
* **Post-Scan Metadata Prompt:** Inline dialog to save/edit title and description before saving directly to the Library.

### 3.4 Multi-Scan Background Tracker (`scan-monitor.js`)
* **Unified Multi-Scan Drawer:** A floating status widget visible across every page showing the number of active scans.
* **Live Job Monitoring:** Periodically polls `GET /jobs` and `GET /scanner/status`. Displays both active physical hardware scans and concurrent cloud reconstructions.
* **One-Click Navigation:** Clicking any job card in the drawer immediately opens its detailed progress view on `scanning.html`.
* **Dismissible Cards:** Completed, failed, or cancelled scans can be dismissed individually (`✕`) or cleared automatically once inspected.

### 3.5 3D Model Library & WebGL Viewer (`library.html`)
* **Interactive Three.js 3D Viewport:** Direct rendering of `.glb` (with Draco decompression), `.obj`, and `.stl` models. Supports orbit rotation, panning, zoom, lighting adjustment, and wireframe toggle.
* **Mesh Inspection:** Displays model dimensions, vertex count, and face/triangle count.
* **Metadata Editing:** Inline editing and saving of model title, description, and tags via `PATCH /library/objects/{id}`.
* **Model Deletion:** Permanent deletion of 3D models and raw photo captures with confirmation modal.
* **Mesh Decimation & Export Formats:**
  * **GLB:** Best for web and mobile AR (Draco compression enabled).
  * **OBJ:** Retains full photogrammetry texture fidelity for 3D modeling packages.
  * **STL / 3MF:** Watertight geometry optimized for 3D printing.
  * **Mesh Decimation:** Optional vertex reduction slider to simplify heavy models for mobile/web use.
* **Mobile QR Code Export:** Replaces legacy Bluetooth transfer. Clicking "Download on Phone" archives the model to Cloudflare R2 and displays an instant QR code. Scanning the code with any smartphone or tablet downloads the model archive directly via a signed URL valid for 24 hours.

### 3.6 ScanAssist AI Assistant (`ai-chat.js`)
* Slide-out conversational AI drawer powered by local or cloud LLM endpoints.
* Specialized in photogrammetry guidance: diagnosing reconstruction failures, recommending spray treatments for reflective/transparent surfaces, and advising on lighting and turntable settings.
* Includes quick-prompt suggestion chips and full Markdown response formatting.

### 3.7 Network & Connectivity Manager (`network.js`)
* **Auto-Discovery:** Automatically detects physical Ethernet cable attachment or Wi-Fi connection.
* **Wi-Fi Manager Modal:** Scans available SSIDs, displays signal strength bars, and facilitates WPA/WPA2 password entry via the on-screen keyboard.
* **Cloud Safety Pre-Flight Check:** Warns users if attempting a cloud photogrammetry scan over unstable Wi-Fi or when offline.

### 3.8 Kiosk & Touchscreen Optimization
* **Virtual On-Screen Touch Keyboard:** Integrated `SimpleKeyboard` (`css/keyb.css` & `js/global.js`) automatically pops up when tapping input fields or textareas on kiosk touchscreens.
* **Touch-Drag Scrolling:** Global pointer event listeners enable natural kinetic touch dragging across the interface without relying on small scrollbars.
* **Anti-Flicker Boot Sequence:** Initial 1.5s boot line animation with `sessionStorage` caching (`scancore_booted = true`) to prevent flickering during cross-page navigation.

### 3.9 Developer Tools & Diagnostics (`settings.html`)
* **API Tester Workbench:** Built-in interactive REST API client containing pre-configured request templates for `/scanner/*`, `/jobs/*`, `/library/*`, and `/system/*`.
* **JSON Payload Editor & Response Inspector:** Edit request bodies and inspect HTTP status codes, headers, and formatted JSON output.
* **Hardware Diagnostics & Controls:** System temperature, CPU usage, RAM, disk space, and safe reboot/shutdown controls.

---

## 4. Key API Endpoints Reference

The front-end integrates with the local scanner backend listening at `http://127.0.0.1:8000`:

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Scanner** | `GET` | `/scanner/status` | Current rig hardware state (`idle`, `preparing`, `prepared`, `running`, `processing`) |
| **Scanner** | `POST` | `/scanner/prepare` | Homing, lights, camera configuration, focus mode (`"optim"`, `"auto"`, `null`, `val`) |
| **Scanner** | `POST` | `/scanner/start` | Trigger physical rotation, capture sequence, and cloud upload |
| **Scanner** | `POST` | `/scanner/cancel` | Emergency stop of physical hardware preparation |
| **Face** | `POST` | `/scanner/face/prepare` | Prepare hardware for facial capture (focus, Z-axis, lighting) |
| **Face** | `POST` | `/scanner/face/capture` | Capture facial stereo photo pair and initiate local reconstruction |
| **Jobs** | `GET` | `/jobs` | Unified registry of all past and active scans (RunPod & local) |
| **Jobs** | `GET` | `/jobs/{id}` | Detailed telemetry for a specific job (phase, cloud message, pod status) |
| **Jobs** | `POST` | `/jobs/{id}/cancel` | Targeted cancel: stops RunPod GPU or rig motion without affecting other jobs |
| **Stream** | `GET` | `/scanner/stream/mjpeg?camera={id}` | Dual-camera live MJPEG video stream (camera 1 or 2) |
| **Library** | `GET` | `/library/objects` | List all processed 3D models and metadata |
| **Library** | `PATCH` | `/library/objects/{id}` | Update title, description, or metadata for an object |
| **Library** | `DELETE` | `/library/objects/{id}` | Delete 3D model files and associated capture photos |
| **Export** | `POST` | `/library/objects/{id}/export/qr`| Generate signed mobile QR download link via Cloudflare R2 |
| **System** | `GET` | `/system/status` | Network status (Ethernet/Wi-Fi), storage, CPU, and USB connectivity |
| **System** | `POST` | `/system/wifi/connect` | Connect to a Wi-Fi network with SSID and password |

---

## 5. Local Development & Setup

To preview or develop the front-end locally:

```bash
# Clone the repository
git clone https://github.com/AlinC10/3d-scanner-front-end.git
cd 3d-scanner-front-end

# Serve with any static web server (e.g. Python 3)
python3 -m http.server 3000
```

Open `http://localhost:3000` in Google Chrome or Chromium. 

> **Note:** The UI connects to `http://127.0.0.1:8000` by default when accessed from localhost. If developing against a physical scanner on your local network, access the frontend through the scanner's IP address (e.g., `http://192.168.1.50:8000/`) and relative API requests will automatically route to that device.

---

## 6. Architecture Roadmap: Single-Page Application (SPA)

While the platform currently operates as a Multi-Page Application (MPA) with smooth CSS and boot transitions, an upcoming architectural migration will transition the codebase into a pure **Single-Page Application (SPA)**:
* **Zero Page-Reload Kiosk UX:** Instant client-side view swapping without document reloads on the Raspberry Pi display.
* **Persistent WebGL & Video Context:** Keeps Three.js 3D viewport canvas instances, Draco decoders, and MJPEG camera stream connections warm in memory across screen navigations.
* **Unified Global State Store:** Centralizes multi-scan job queues, network status, touch keyboard interactions, and ScanAssist AI conversation history in a single reactive in-memory state.

Detailed specifications and technical proposals can be found in [FUTURE_IMPROVEMENTS.md](file:///home/alin/Desktop/3d-scanner-front-end/FUTURE_IMPROVEMENTS.md).
