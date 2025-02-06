const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');
menu.style.visibility = 'hidden';
menuButton.addEventListener('click', () => {
    if (menu.style.display === 'block') {
        menu.style.visibility = 'visible';
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
        menu.style.visibility = 'visible';
    }
});

window.addEventListener('click', (e) => {
    if (e.target !== menu && e.target !== menuButton) {
        menu.style.display = 'none';
    }
});