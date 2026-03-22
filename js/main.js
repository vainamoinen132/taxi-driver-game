// ============================================================
// MAIN - Entry point, menu navigation
// ============================================================

(function () {
    const game = new Game();

    // Screen management
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // Main menu buttons
    document.getElementById('btn-new-game').addEventListener('click', () => {
        showScreen('game-screen');
        game.start();
    });

    document.getElementById('btn-how-to-play').addEventListener('click', () => {
        showScreen('how-to-play');
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
        showScreen('main-menu');
    });

    // Pause menu buttons
    document.getElementById('btn-resume').addEventListener('click', () => {
        game.togglePause();
    });

    document.getElementById('btn-upgrades').addEventListener('click', () => {
        game.showGarage();
    });

    document.getElementById('btn-stats').addEventListener('click', () => {
        game.showStats();
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
        game.quit();
        showScreen('main-menu');
    });

    // Garage close
    document.getElementById('btn-close-garage').addEventListener('click', () => {
        document.getElementById('garage-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    // Stats close
    document.getElementById('btn-close-stats').addEventListener('click', () => {
        document.getElementById('stats-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    // Start on main menu
    showScreen('main-menu');
})();
