document.addEventListener('DOMContentLoaded', () => {

    // --- LOGICA PENTRU MENIUL DE EXPORT ---
    const exportFormat = document.getElementById('export-format');
    const settingTexture = document.getElementById('export-setting-texture');
    const settingDraco = document.getElementById('export-setting-draco');

    if (exportFormat) {
        exportFormat.addEventListener('change', (e) => {
            const val = e.target.value;
            // Draco e valabil doar pentru GLB (Web)
            if (settingDraco) settingDraco.style.display = (val === 'glb') ? 'flex' : 'none';
            // STL nu are culori, deci ascundem texturile
            if (settingTexture) settingTexture.style.display = (val === 'stl') ? 'none' : 'flex';
        });
    }

    // --- SYNC PENTRU SLIDERELE DE EXPORT ---
    const syncSlider = (id) => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        if(slider && val) {
            slider.addEventListener('input', () => val.innerText = slider.value);
        }
    }
    
    syncSlider('export-decimation'); 
    syncSlider('export-draco');

});