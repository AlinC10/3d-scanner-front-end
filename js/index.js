document.addEventListener('DOMContentLoaded', () => {
    
    const bootScreen = document.getElementById('boot-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const mainMenu = document.getElementById('main-menu');

    // Verificăm dacă aplicația a fost deja pornită în această sesiune
    if (sessionStorage.getItem('scancore_booted') !== 'true') {
        
        // Dacă e prima dată, rulăm secvența de BOOT
        if (bootScreen && appWrapper) {
            setTimeout(() => {
                bootScreen.style.opacity = '0';
                setTimeout(() => {
                    bootScreen.style.display = 'none';
                    appWrapper.style.opacity = '1';
                    if(mainMenu) mainMenu.classList.add('active');
                    
                    // Salvăm în memorie faptul că OS-ul a pornit
                    sessionStorage.setItem('scancore_booted', 'true');
                }, 600); 
            }, 1500);
        }

    } else {
        // Dacă a mai fost pornit, asigurăm vizibilitatea instant fără nicio animație
        if(bootScreen) bootScreen.style.display = 'none';
        if(appWrapper) {
            appWrapper.style.transition = 'none';
            appWrapper.style.opacity = '1';
        }
        if(mainMenu) mainMenu.classList.add('active');
    }

});