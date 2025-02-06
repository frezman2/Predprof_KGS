// Инициализация переменных
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateRangeButton = document.getElementById('applyDateRange');
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

// Функция для загрузки данных за указанный период
function loadCustomData() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
        alert('Пожалуйста, выберите начальную и конечную даты.');
        return;
    }

    fetch(`/get_stats?start_date=${startDate}&end_date=${endDate}`)
        .then(response => response.json())
        .then(data => {
            initializeChart(data);
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных:', error);
            // Если произошла ошибка, показываем пустую таблицу
            initializeChart({
                dates: [],
                added: [],
                deleted: []
            });
        });
}

// Загрузка данных при нажатии на кнопку "Применить"
applyDateRangeButton.addEventListener('click', loadCustomData);

// Загрузка данных при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
    // Устанавливаем начальную и конечную даты по умолчанию (последние 7 дней)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0];

    startDateInput.value = startDate;
    endDateInput.value = endDate;

    // Загружаем данные за последние 7 дней по умолчанию
    loadCustomData();
});

// Функция для загрузки уведомлений
function loadNotifications() {
    fetch('/get_expiring_products')
        .then(response => response.json())
        .then(data => {
            const notificationsList = document.getElementById('notificationsList');
            const notificationCount = document.getElementById('notificationCount');

            if (data.length === 0) {
                notificationsList.innerHTML = '<p style="opacity: 0.5;">Нет уведомлений</p>';
                notificationCount.classList.add('d-none'); // Скрываем бейдж, если уведомлений нет
            } else {
                notificationsList.innerHTML = ''; // Очищаем список уведомлений
                data.forEach(product => {
                    const notificationItem = document.createElement('div');
                    notificationItem.className = 'notification-item mb-2';
                    notificationItem.innerHTML = `
                        <p><strong>${product.name}</strong> (${product.expiry_date})</p>
                        <p>Статус: ${product.status}.</p>
                    `;
                    notificationsList.appendChild(notificationItem);
                });

                // Показываем количество уведомлений
                notificationCount.textContent = data.length;
                notificationCount.classList.remove('d-none');
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке уведомлений:', error);
            const notificationsList = document.getElementById('notificationsList');
            notificationsList.innerHTML = '<p style="opacity: 0.5;">Ошибка при загрузке уведомлений</p>';
        });
}

// Загружаем уведомления при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
    loadNotifications();
});

// Обновляем уведомления при каждом открытии модального окна
document.getElementById('notificationsButton').addEventListener('click', function () {
    loadNotifications();
});
