// Функция для добавления продукта в список
function addProduct() {
    const productName = document.getElementById('productName').value;
    const productQuantity = document.getElementById('productQuantity').value;
    const measurementType = document.getElementById('measurementType').value;

    if (productName && productQuantity) {
        const item = document.createElement('li');
        item.innerHTML = `
            <span>${productName} (${productQuantity} ${measurementType})</span>
            <button onclick="removeProduct(this)">Удалить</button>
        `;
        document.getElementById('itemsList').appendChild(item);

        // Отправляем данные на сервер для сохранения в базе данных
        fetch('/save_shopping_list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: productName,
                quantity: productQuantity,
                measurement_type: measurementType
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Продукт добавлен в список покупок');
                loadShoppingList();
            } else {
                console.error('Ошибка при добавлении продукта:', data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при отправке данных:', error);
        });

        // Очистка полей ввода
        document.getElementById('productName').value = '';
        document.getElementById('productQuantity').value = '';
    } else {
        alert('Пожалуйста, заполните все поля!');
    }
}

// Функция для удаления продукта из списка покупок
function removeProduct(itemId) {
    fetch('/delete_shopping_item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: itemId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log('Продукт удален из списка покупок');
            loadShoppingList(); // Обновляем список покупок после удаления
        } else {
            console.error('Ошибка при удалении продукта:', data.message);
        }
    })
    .catch(error => {
        console.error('Ошибка при отправке данных:', error);
    });
}

// Функция для загрузки списка покупок
function loadShoppingList() {
    fetch('/get_shopping_list')
        .then(response => response.json())
        .then(data => {
            const itemsList = document.getElementById('itemsList');
            itemsList.innerHTML = ''; // Очищаем список перед добавлением новых элементов

            data.forEach(item => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${item[1]} (${item[2]} ${item[3]})</span>
                    <button onclick="removeProduct(${item[0]})">Удалить</button>
                `;
                itemsList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке списка покупок:', error);
        });
}

// Загружаем список покупок при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
    loadShoppingList();
});

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
