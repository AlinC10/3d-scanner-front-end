# ScanCore-3D OS - Complete UI/UX Documentation

## 1. System Overview
ScanCore-3D OS is a web-based operating system interface designed to control a highly advanced hardware 3D scanner. Unlike traditional desktop applications, this system runs entirely in a web browser (Chromium-based), providing a modern, fluid, and responsive user experience.

The system utilizes an **Edge-to-Cloud architecture**:
*   **Edge (Local):** The UI communicates directly with a local FastAPI server (`http://127.0.0.1:8000`) running on the scanner's internal computer. This handles immediate hardware tasks like moving stepper motors, turning on lasers, taking photos, and managing Wi-Fi/Bluetooth radios.
*   **Cloud (Remote):** Heavy photogrammetry computation (stitching photos into a 3D mesh) is offloaded to remote servers, saving local processing power and battery.

---

## 2. Interface Architecture & Modularization
To ensure long-term maintainability and high performance, the application is built using a strict modular architecture. It is a Multi-Page Application (MPA) that feels like a Single-Page Application (SPA) thanks to carefully crafted transition states.

### 2.1 File Structure
Instead of a single massive file, the project is divided logically:
*   **HTML Pages:** `index.html` (Main Menu), `scan-object.html`, `scan-face.html`, `scanning.html` (Live Stream), `library.html`, `settings.html`, `help.html`.
*   **CSS Directory (`/css/`):**
    *   `theme.css`: Core design tokens, color variables (Dark/Light mode), and typography.
    *   `layout.css`: Structural rules for the Header, Main Container, and Boot Screen.
    *   `components.css`: Reusable UI elements (Buttons, Sliders, Scrollbars).
    *   `modals.css`: Overlay rules and pop-up window styling.
    *   `ai-chat.css`: Dedicated styling for the ScanAssist AI module.
*   **JavaScript Directory (`/js/`):**
    *   `global.js`: Handles logic shared across all pages (Theme toggling, cross-page navigation, clock).
    *   `network.js`: Manages Network (Wi-Fi/Ethernet) and Bluetooth states.
    *   `ai-chat.js`: Handles API calls and UI for the AI assistant.

### 2.2 The Anti-Flicker Boot Sequence
To provide a seamless experience when navigating between pages, the OS features an intelligent boot sequence. 
*   When the user first opens the app, a 1.5-second boot animation (Scanner Line) is displayed.
*   The system then writes a flag (`scancore_booted = true`) to the browser's `sessionStorage`.
*   A lightweight script placed in the `<head>` of every HTML file checks this flag. If the system has already booted, it instantly hides the boot screen before the browser even renders the page, eliminating screen flickering during navigation.

---

## 3. Core Workflows & How to Use the Interface

### 3.1 Network Management (Wi-Fi & Ethernet)
The OS intelligently monitors network connectivity to ensure data can be offloaded to the cloud.

*   **The Default State (The Globe):** Upon startup, the system displays a "Globe/Offline" icon. It waits for 1.2 seconds while pinging the local hardware API to check if an Ethernet cable is physically connected.
*   **Ethernet Connection:** If a cable is detected, the Globe smoothly transitions into the Ethernet icon.
*   **Wi-Fi Connection:** If no cable is found, the Globe remains. The user must click the Globe to open the **Wi-Fi Manager Modal**.
    1. Toggle the Wi-Fi power switch to ON.
    2. The system scans and lists nearby SSIDs (displaying signal strength and security type).
    3. The user clicks a network, enters the password if prompted, and connects.
    4. Upon successful connection, the Globe icon in the header transforms into a Wi-Fi signal icon.

### 3.2 Preparing an Object Scan
Navigating to **Scan Object** brings up the hardware configuration panel. This screen is crucial for achieving high-quality photogrammetry results.
*   **Basic Settings:** The user can adjust the Z-Axis scanner height (50-150mm) and the turntable rotation step (e.g., 18 degrees per photo).
*   **Advanced Settings:** Hidden under a dropdown, these allow power users to fine-tune motor acceleration/deceleration, camera exposure, and LED ring intensity to prevent glare on reflective objects.

### 3.3 The Library and Exporting
The **Library** tab acts as the local archive. It displays thumbnail cards for all previously processed scans.
*   Clicking **Export Options** opens a dedicated modal for mesh optimization.
*   Users can select the target file format based on their needs:
    *   **GLB:** Best for web embedding and Augmented Reality (AR), utilizing Draco compression to shrink file sizes.
    *   **OBJ:** Best for 3D artists, retaining maximum texture quality.
    *   **STL / 3MF:** Best for 3D printing (removes color data, ensures manifold geometry).
*   Users can manually adjust the maximum vertex count (Decimation) to simplify complex meshes.

---

## 4. Developer Tools (Settings Page)
The Settings page acts as a Developer API Tester. It features a built-in JSON payload editor, allowing developers to manually trigger local hardware API endpoints (e.g., `POST /scanner/scan`) and view the raw server responses in a dedicated output window.