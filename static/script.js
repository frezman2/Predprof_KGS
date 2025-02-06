// Toggle category items visibility
document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
        const items = header.nextElementSibling;
        const arrow = header.querySelector('span:last-child');
        if (items.style.display === 'block') {
            items.style.display = 'none';
            arrow.innerHTML = '&#9662;';
        } else {
            items.style.display = 'block';
            arrow.innerHTML = '&#9652;';
        }
    });
});

// Modal functionality
const qrModal = document.getElementById('qrModal');
const addItemButton = document.getElementById('addItem');
const deleteItemButton = document.getElementById('deleteItem'); // Новая кнопка
const closeModalButton = document.getElementById('closeModal');
const qrDetectedModal = document.getElementById('qrDetectedModal');
const okButton = document.getElementById('okButton');
const qrDataElement = document.getElementById('qrData');
const productInfoModal = document.getElementById('productInfoModal');
const closeProductInfoModalButton = document.getElementById('closeProductInfoModal');

let isDeleteMode = false; // Флаг для режима удаления

// Обработчик для кнопки "Добавить товар"
addItemButton.addEventListener('click', () => {
    isDeleteMode = false; // Режим добавления
    qrModal.style.display = 'flex';
    checkQRCode();
});

// Обработчик для кнопки "Удалить товар"
deleteItemButton.addEventListener('click', () => {
    isDeleteMode = true; // Режим удаления
    qrModal.style.display = 'flex';
    checkQRCode();
});

closeModalButton.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

okButton.addEventListener('click', () => {
    qrDetectedModal.style.display = 'none';
    qrModal.style.display = 'none';
    loadProducts(); // Перезагружаем товары после удаления или добавления
});

closeProductInfoModalButton.addEventListener('click', () => {
    productInfoModal.style.display = 'none';
});

// Функция для проверки QR-кода
function checkQRCode() {
    fetch('/qr_detected')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                qrDataElement.textContent = `QR-код: ${data.data}`;
                qrDetectedModal.style.display = 'flex';
                qrModal.style.display = 'none';

                // Если режим удаления, отправляем запрос на удаление
                if (isDeleteMode) {
                    deleteProduct(data.data);
                } else {
                    // Получаем информацию о продукте
                    fetch('/get_products')
                        .then(response => response.json())
                        .then(products => {
                            for (const category in products) {
                                const product = products[category].find(p => p.id === data.data);
                                if (product) {
                                    showProductInfo(product);
                                    break;
                                }
                            }
                        });
                }
            } else {
                setTimeout(checkQRCode, 1000);
            }
        });
}

const translations = {
    ru: {
        searchPlaceholder: "Поиск товаров...",
        addItem: "Добавить товар",
        deleteItem: "Удалить товар",
    },
    en: {
        searchPlaceholder: "Search products...",
        addItem: "Add item",
        deleteItem: "Delete item",
    }
};

document.getElementById('languageSelector').addEventListener('change', function() {
    const lang = this.value;
    document.getElementById('search').placeholder = translations[lang].searchPlaceholder;
    document.getElementById('addItem').textContent = translations[lang].addItem;
    document.getElementById('deleteItem').textContent = translations[lang].deleteItem;
});

function showNotification(title, message) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: message });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body: message });
            }
        });
    }
}

// Функция для удаления продукта
function deleteProduct(qrData) {
    fetch('/delete_product', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qr_data: qrData }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Товар успешно удален');
                loadProducts(); // Перезагружаем список товаров
            } else {
                alert('Ошибка при удалении товара');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при удалении товара');
        });
}

window.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
    if (e.target === qrDetectedModal) {
        qrDetectedModal.style.display = 'none';
    }
    if (e.target === productInfoModal) {
        productInfoModal.style.display = 'none';
    }
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

// Функция для загрузки товаров из базы данных
function loadProducts() {
    fetch('/get_products')
        .then(response => response.json())
        .then(data => {
            console.log("Данные с сервера:", data);

            // Очищаем контейнер категорий
            const categoriesContainer = document.querySelector('.categories');
            categoriesContainer.innerHTML = '';

            // Проверяем, есть ли данные в ответе
            if (Object.keys(data).length === 0) {
                // Если данных нет, выводим сообщение
                categoriesContainer.innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                return;
            }

            // Создаем категории на основе данных
            for (const [category, products] of Object.entries(data)) {
                const categoryElement = document.createElement('div');
                categoryElement.className = 'category';

                // Заголовок категории
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'category-header';
                categoryHeader.innerHTML = `
                    <span>${category}</span>
                    <span>&#9662;</span>
                `;

                // Список товаров в категории
                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'items';

                // Добавляем товары в категорию
                products.forEach(product => {
                    const item = document.createElement('div');
                    item.className = 'item';

                    // Определяем статус срока годности
                    const currentDate = new Date();
                    const expiryDate = new Date(product.expiry_date);
                    const timeDiff = expiryDate - currentDate;
                    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                    if (daysDiff <= 0) {
                        item.classList.add('expired');
                    } else if (daysDiff <= 7) {
                        item.classList.add('expiring');
                    }

                    // Добавляем информацию о продукте
                    item.innerHTML = `<p>${product.name} (${product.quantity} шт.)</p>`;
                    item.addEventListener('click', () => {
                        showProductInfo(product);
                    });
                    itemsContainer.appendChild(item);
                });

                // Добавляем заголовок и список товаров в категорию
                categoryElement.appendChild(categoryHeader);
                categoryElement.appendChild(itemsContainer);

                // Добавляем категорию в контейнер
                categoriesContainer.appendChild(categoryElement);
            }

            // Добавляем обработчики для сворачивания/разворачивания категорий
            document.querySelectorAll('.category-header').forEach(header => {
                header.addEventListener('click', () => {
                    const items = header.nextElementSibling;
                    const arrow = header.querySelector('span:last-child');
                    if (items.style.display === 'block') {
                        items.style.display = 'none';
                        arrow.innerHTML = '&#9662;';
                    } else {
                        items.style.display = 'block';
                        arrow.innerHTML = '&#9652;';
                    }
                });
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных:', error);
            const categoriesContainer = document.querySelector('.categories');
            categoriesContainer.innerHTML = '<p style="opacity: 0.5;">Ошибка при загрузке данных</p>';
        });
}

// Функция для показа информации о продукте
function showProductInfo(product) {
    document.getElementById('productName').textContent = `Название: ${product.name}`;
    document.getElementById('productType').textContent = `Тип: ${product.type}`;
    document.getElementById('productManufactureDate').textContent = `Дата производства: ${product.manufacture_date}`;
    document.getElementById('productExpiryDate').textContent = `Срок годности: ${product.expiry_date}`;
    document.getElementById('productWeight').textContent = `Вес: ${product.weight}`;
    document.getElementById('productNutritionValue').textContent = `Пищевая ценность: ${product.nutrition_value}`;
    document.getElementById('productMeasurementType').textContent = `Единица измерения: ${product.measurement_type}`;
    productInfoModal.style.display = 'flex';
}

// Функция для поиска товаров по названию
function searchProducts() {
    const searchInput = document.getElementById('search').value.toLowerCase();
    const categories = document.querySelectorAll('.category');
    const searchResults = document.getElementById('searchResults');

    // Очищаем предыдущие результаты поиска
    searchResults.innerHTML = '';

    // Если поисковый запрос пустой, показываем все категории
    if (searchInput.trim() === '') {
        categories.forEach(category => {
            category.style.display = 'block';
        });
        searchResults.style.display = 'none';
        return;
    }

    // Получаем все продукты
    fetch('/get_products')
        .then(response => response.json())
        .then(data => {
            let found = false;
            for (const [category, products] of Object.entries(data)) {
                products.forEach(product => {
                    if (
                        product.name.toLowerCase().includes(searchInput) ||
                        product.type.toLowerCase().includes(searchInput)
                    ) {
                        found = true;
                        const item = document.createElement('div');
                        item.className = 'item';

                        // Определяем статус срока годности
                        const currentDate = new Date();
                        const expiryDate = new Date(product.expiry_date);
                        const timeDiff = expiryDate - currentDate;
                        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                        if (daysDiff <= 0) {
                            item.classList.add('expired');
                        } else if (daysDiff <= 7) {
                            item.classList.add('expiring');
                        }

                        item.innerHTML = `
                            <p>${product.name} (${product.weight} ${product.measurement_type})</p>
                        `;
                        item.addEventListener('click', () => {
                            showProductInfo(product);
                        });
                        searchResults.appendChild(item);
                    }
                });
            }

            if (found) {
                // Скрываем все категории
                categories.forEach(category => {
                    category.style.display = 'none';
                });
                // Показываем результаты поиска
                searchResults.style.display = 'block';
            } else {
                // Показываем все категории
                categories.forEach(category => {
                    category.style.display = 'block';
                });
                // Скрываем результаты поиска
                searchResults.style.display = 'none';
                // Показываем сообщение, что товары не найдены
                searchResults.innerHTML = '<p style="opacity: 0.5;">Товаров не найдено</p>';
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных:', error);
            searchResults.innerHTML = '<p style="opacity: 0.5;">Ошибка при поиске товаров</p>';
        });
}

// Загружаем товары при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
    loadProducts();
    document.getElementById('searchButton').addEventListener('click', searchProducts);
});
