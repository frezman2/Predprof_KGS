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
const closeModalButton = document.getElementById('closeModal');
const qrDetectedModal = document.getElementById('qrDetectedModal');
const okButton = document.getElementById('okButton');
const qrDataElement = document.getElementById('qrData');

addItemButton.addEventListener('click', () => {
    qrModal.style.display = 'flex';
    checkQRCode();
});

closeModalButton.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

okButton.addEventListener('click', () => {
    qrDetectedModal.style.display = 'none';
    qrModal.style.display = 'none';
    loadProducts(); // Перезагружаем товары после добавления нового
});

window.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
});

// Menu functionality
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

// Функция для проверки QR-кода
function checkQRCode() {
    fetch('/qr_detected')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                qrDataElement.textContent = `QR-код: ${data.data}`;
                qrDetectedModal.style.display = 'flex';
                qrModal.style.display = 'none';
            } else {
                setTimeout(checkQRCode, 1000);
            }
        });
}

// Функция для загрузки товаров из базы данных
function loadProducts() {
    fetch('/get_products')
        .then(response => response.json())
        .then(data => {
            console.log("Данные с сервера:", data);

            // Очищаем категории
            document.getElementById('bread').innerHTML = '';
            document.getElementById('dairy').innerHTML = '';
            document.getElementById('fruits').innerHTML = '';
            document.getElementById('meat').innerHTML = '';

            // Проверяем, есть ли данные в ответе
            if (Object.keys(data).length === 0) {
                // Если данных нет, выводим сообщение во всех категориях
                document.getElementById('bread').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                document.getElementById('dairy').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                document.getElementById('fruits').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                document.getElementById('meat').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                return;
            }

            // Если данные есть, распределяем их по категориям
            for (const [category, products] of Object.entries(data)) {
                console.log(`Категория: ${category}, Товары:`, products);

                let categoryElement;
                if (category.includes('Хлеб')) {
                    categoryElement = document.getElementById('bread');
                } else if (category.includes('Молоч')) {
                    categoryElement = document.getElementById('dairy');
                } else if (category.includes('Фрукты') || category.includes('овощи')) {
                    categoryElement = document.getElementById('fruits');
                } else if (category.includes('Мясо') || category.includes('птица')) {
                    categoryElement = document.getElementById('meat');
                } else {
                    continue;
                }

                if (products.length === 0) {
                    // Если в категории нет товаров, выводим сообщение
                    categoryElement.innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
                } else {
                    // Если товары есть, отображаем их
                    products.forEach(product => {
                        const item = document.createElement('div');
                        item.className = 'item';

                        // Determine the expiry status
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
                            <p>${product.name}</p>
                        `;
                        categoryElement.appendChild(item);
                    });
                }
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных:', error);
            // Если произошла ошибка, выводим сообщение во всех категориях
            document.getElementById('bread').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
            document.getElementById('dairy').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
            document.getElementById('fruits').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
            document.getElementById('meat').innerHTML = '<p style="opacity: 0.5;">Товаров нет</p>';
        });
}

// Функция для поиска товаров по названию
function searchProducts() {
    const searchInput = document.getElementById('search').value.toLowerCase();
    const categories = document.querySelectorAll('.category');
    const searchResults = document.getElementById('searchResults');

    // Clear previous search results
    searchResults.innerHTML = '';

    // Hide all categories
    categories.forEach(category => {
        category.style.display = 'none';
    });

    // Show search results
    searchResults.style.display = 'block';

    // Fetch all products
    fetch('/get_products')
        .then(response => response.json())
        .then(data => {
            let found = false;
            for (const [category, products] of Object.entries(data)) {
                products.forEach(product => {
                    if (product.name.toLowerCase().includes(searchInput)) {
                        found = true;
                        const item = document.createElement('div');
                        item.className = 'item';

                        // Determine the expiry status
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
                            <p>${product.name}</p>
                        `;
                        searchResults.appendChild(item);
                    }
                });
            }

            if (!found) {
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
    loadLogs();
    document.getElementById('searchButton').addEventListener('click', searchProducts);
});



