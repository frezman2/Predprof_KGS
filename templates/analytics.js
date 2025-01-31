const dateInput = document.getElementById('date');
const typeFilter = document.getElementById('typeFilter');
const ctx = document.getElementById('analyticsChart').getContext('2d');

const menuButton_anal = document.getElementById('menuButton_anal');
const menu_anal = document.getElementById('menu_anal');
menu_anal.style.visibility = 'hidden';
menuButton_anal.addEventListener('click', () => {
    if (menu_anal.style.display === 'block') {
        menu_anal.style.visibility = 'visible';
        menu_anal.style.display = 'none';
    } else {
        menu_anal.style.display = 'block';
        menu_anal.style.visibility = 'visible';
    }
});

// Пример данных
const sampleData = {
    added: [12, 19, 3, 5, 2, 3],
    removed: [8, 15, 2, 6, 4, 7],
    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн']
};

// Инициализация диаграммы


// Обновление диаграммы при изменении фильтра или даты
function updateChart() {
    const selectedType = typeFilter.value;
    chart.data.datasets[0].label = selectedType === 'added' ? 'Добавлено' : 'Удалено';
    chart.data.datasets[0].data = selectedType === 'added' ? sampleData.added : sampleData.removed;
    chart.update();
}

// Слушатели событий
dateInput.addEventListener('change', updateChart);
typeFilter.addEventListener('change', updateChart);