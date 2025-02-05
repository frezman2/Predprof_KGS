// Инициализация переменных
const timeRange = document.getElementById('timeRange');
const ctx = document.getElementById('myChart').getContext('2d');

// Инициализация диаграммы
let chart;

function initializeChart(data) {
    if (chart) {
        chart.destroy(); // Уничтожаем старую диаграмму, если она существует
    }
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Добавленные',
                    data: data.added,
                    backgroundColor: 'rgba(153,205,1,0.6)',
                    borderColor: 'rgba(153,205,1,1)',
                    fill: false,
                },
                {
                    label: 'Удаленные',
                    data: data.deleted,
                    backgroundColor: 'rgba(155,153,10,0.6)',
                    borderColor: 'rgba(155,153,10,1)',
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Динамика добавления и удаления товаров', // Заголовок диаграммы
                },
            },
            scales: {
                y: {
                    beginAtZero: true, // Ось Y начинается с нуля
                },
            },
        },
    });
}

// Функция для загрузки данных
function loadData(days) {
    $.getJSON('/get_stats?days=' + days, function(data) {
        initializeChart(data);
    });
}

// Загрузка данных при изменении промежутка времени
timeRange.addEventListener('change', function() {
    const selectedDays = timeRange.value;
    loadData(selectedDays);
});

// Загрузка данных при загрузке страницы
$(document).ready(function() {
    const initialDays = timeRange.value; // Получаем значение по умолчанию
    loadData(initialDays);
});