from flask import Flask, Response, render_template, redirect, url_for, jsonify, request
import cv2
import threading
import sqlite3
import json
from datetime import datetime, timedelta
import time

app = Flask(__name__, static_folder='static')
qr_data = None
qr_detected = False
# Глобальная переменная для управления потоком сканирования
scanning_active = False


# Функция для создания базы данных и таблицы
def ensure_database():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            manufacture_date TEXT,
            expiry_date TEXT,
            weight TEXT,
            nutrition_value TEXT,
            measurement_type TEXT,
            quantity INTEGER DEFAULT 1
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS product_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT,
            action TEXT,
            timestamp TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shopping_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            quantity INTEGER,
            measurement_type TEXT
        )
    ''')
    conn.commit()
    conn.close()

# Функция для сохранения данных в базу данных
def save_to_database(product_data):
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    try:
        # Проверяем, существует ли продукт с таким ID
        cursor.execute('SELECT * FROM products WHERE id = ?', (product_data['id'],))
        existing_product = cursor.fetchone()

        if existing_product:
            # Если продукт существует, увеличиваем количество
            cursor.execute('''
                UPDATE products
                SET quantity = quantity + 1
                WHERE id = ?
            ''', (product_data['id'],))
        else:
            # Если продукта нет, добавляем его с количеством 1
            cursor.execute('''
                INSERT INTO products (id, name, type, manufacture_date, expiry_date, weight, nutrition_value, measurement_type, quantity)
                VALUES (:id, :name, :type, :manufacture_date, :expiry_date, :weight, :nutrition_value, :measurement_type, 1)
            ''', product_data)

        conn.commit()

        # Логируем добавление
        cursor.execute('''
            INSERT INTO product_logs (product_id, action, timestamp)
            VALUES (?, ?, ?)
        ''', (product_data['id'], 'added', datetime.now().date().isoformat()))
        conn.commit()
    except sqlite3.IntegrityError:
        print(f"Продукт с ID {product_data['id']} уже существует в базе данных.")
    finally:
        conn.close()

# Функция для удаления данных из базы данных
def delete_from_database(product_id):
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        # Log the deletion
        cursor.execute('''
            INSERT INTO product_logs (product_id, action, timestamp)
            VALUES (?, ?, ?)
        ''', (product_id, 'deleted', datetime.now().date().isoformat()))
        conn.commit()
    except sqlite3.Error as e:
        print(f"Ошибка при удалении продукта: {e}")
    finally:
        conn.close()

# Функция для декодирования данных QR-кода
def decode_qr_data(qr_data):
    try:
        decoded_data = json.loads(qr_data)
        print("Декодированные данные:", decoded_data)
        return decoded_data
    except json.JSONDecodeError as e:
        print("Ошибка декодирования JSON:", e)
        return None

# Генерация кадров с камеры и распознавание QR-кода
def generate_frames():
    global qr_data, qr_detected
    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        print("Камера не доступна.")
        return

    detector = cv2.QRCodeDetector()

    while True:
        try:
            success, frame = camera.read()
            if not success:
                print("Не удалось захватить кадр с камеры.")
                break

            # Переворачиваем кадр для удобства
            frame = cv2.flip(frame, 1)

            # Пытаемся обнаружить QR-код
            data, bbox, _ = detector.detectAndDecode(frame)

            if bbox is not None:
                bbox = bbox.astype(int)
                for i in range(len(bbox)):
                    pt1 = tuple(bbox[i][0])
                    pt2 = tuple(bbox[(i + 1) % len(bbox)][0])
                    cv2.line(frame, pt1, pt2, color=(255, 0, 0), thickness=2)

                if data:
                    qr_data = data
                    qr_detected = True
                    print(f"[+] QR Code detected, data: {data}")
                    # Декодируем данные и сохраняем в базу данных
                    product_data = decode_qr_data(qr_data)
                    if product_data:
                        save_to_database(product_data)
                    break  # Выход из цикла после обнаружения QR-кода

            # Кодируем кадр в формат JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                print("Не удалось закодировать кадр.")
                continue

            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

            # Добавляем небольшую задержку для стабильности
            time.sleep(0.1)

        except cv2.error as e:
            print(f"Ошибка OpenCV: {e}")
            continue
        except Exception as e:
            print(f"Неожиданная ошибка: {e}")
            break

    # Освобождаем камеру
    camera.release()

# Функция для получения данных из базы данных
def get_products_by_category():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Используем более эффективный запрос
    cursor.execute('SELECT * FROM products ORDER BY type')
    products = cursor.fetchall()

    categories = {}
    for product in products:
        product_type = product[2]
        if product_type not in categories:
            categories[product_type] = []
        categories[product_type].append({
            "id": product[0],
            "name": product[1],
            "type": product[2],
            "manufacture_date": product[3],
            "expiry_date": product[4],
            "weight": product[5],
            "nutrition_value": product[6],
            "measurement_type": product[7],
            "quantity": product[8]
        })

    conn.close()
    return categories

# Функция для получения количества добавленных и удаленных продуктов за последние 7 дней
def get_product_stats():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Получаем текущую дату и дату 7 дней назад
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=6)  # Включаем сегодняшний день

    # Получаем количество добавленных продуктов за последние 7 дней
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM product_logs
        WHERE action = 'added' AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
        GROUP BY DATE(timestamp)
    ''', (start_date.isoformat(), end_date.isoformat()))
    added_stats = cursor.fetchall()

    # Получаем количество удаленных продуктов за последние 7 дней
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM product_logs
        WHERE action = 'deleted' AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
        GROUP BY DATE(timestamp)
    ''', (start_date.isoformat(), end_date.isoformat()))
    deleted_stats = cursor.fetchall()

    conn.close()

    # Преобразуем данные в удобный для использования формат
    added_data = {date: count for date, count in added_stats}
    deleted_data = {date: count for date, count in deleted_stats}

    # Заполняем данные для всех дней, даже если в какой-то день не было действий
    dates = [(start_date + timedelta(days=i)).isoformat() for i in range(7)]
    added_counts = [added_data.get(date, 0) for date in dates]
    deleted_counts = [deleted_data.get(date, 0) for date in dates]

    return {
        "dates": dates,
        "added": added_counts,
        "deleted": deleted_counts
    }

# Функция для получения логов из базы данных
def get_product_logs():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Получаем все логи
    cursor.execute('SELECT * FROM product_logs ORDER BY timestamp DESC')
    logs = cursor.fetchall()

    conn.close()
    return logs

# Маршрут для удаления продукта
@app.route('/delete_product', methods=['POST'])
def delete_product():
    data = request.json
    qr_data = data.get('qr_data')

    if not qr_data:
        return jsonify({"status": "error", "message": "Необходимо предоставить данные QR-кода"}), 400

    # Декодируем данные QR-кода
    product_data = decode_qr_data(qr_data)
    if not product_data:
        return jsonify({"status": "error", "message": "Ошибка декодирования данных QR-кода"}), 400

    # Удаляем продукт из базы данных
    delete_from_database(product_data['id'])

    return

# Маршрут для получения статистики
@app.route('/get_stats')
def get_stats():
    # Получаем параметры из запроса
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Проверяем, что даты указаны
    if not start_date or not end_date:
        return jsonify({"status": "error", "message": "Необходимо указать начальную и конечную даты."}), 400

    try:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Неверный формат даты. Используйте YYYY-MM-DD."}), 400

    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Получаем количество добавленных продуктов за указанный период
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM product_logs
        WHERE action = 'added' AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
        GROUP BY DATE(timestamp)
    ''', (start_date.isoformat(), end_date.isoformat()))
    added_stats = cursor.fetchall()

    # Получаем количество удаленных продуктов за указанный период
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM product_logs
        WHERE action = 'deleted' AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
        GROUP BY DATE(timestamp)
    ''', (start_date.isoformat(), end_date.isoformat()))
    deleted_stats = cursor.fetchall()

    conn.close()

    # Преобразуем данные в удобный для использования формат
    added_data = {date: count for date, count in added_stats}
    deleted_data = {date: count for date, count in deleted_stats}

    # Заполняем данные для всех дней в указанном периоде
    dates = []
    current_date = start_date
    while current_date <= end_date:
        dates.append(current_date.isoformat())
        current_date += timedelta(days=1)

    added_counts = [added_data.get(date, 0) for date in dates]
    deleted_counts = [deleted_data.get(date, 0) for date in dates]

    return jsonify({
        "dates": dates,
        "added": added_counts,
        "deleted": deleted_counts
    })

@app.route('/save_shopping_list', methods=['POST'])
def save_shopping_list():
    data = request.json
    name = data.get('name')
    quantity = data.get('quantity')
    measurement_type = data.get('measurement_type')

    if not name or not quantity or not measurement_type:
        return jsonify({"status": "error", "message": "Необходимо предоставить все данные"}), 400

    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO shopping_list (name, quantity, measurement_type)
            VALUES (?, ?, ?)
        ''', (name, quantity, measurement_type))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "Ошибка при сохранении данных"}), 500
    finally:
        conn.close()

    return jsonify({"status": "success", "message": "Продукт добавлен в список покупок"})

@app.route('/get_expiring_products')
def get_expiring_products():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Получаем текущую дату
    current_date = datetime.now().date()

    # Получаем продукты, срок годности которых истекает в ближайшие 7 дней или уже истек
    cursor.execute('''
        SELECT name, expiry_date, 
               (julianday(expiry_date) - julianday(?)) as days_until_expiry
        FROM products
        WHERE julianday(expiry_date) - julianday(?) <= 7
        ORDER BY expiry_date
    ''', (current_date.isoformat(), current_date.isoformat()))
    expiring_products = cursor.fetchall()

    conn.close()

    # Преобразуем данные в JSON
    products = []
    for product in expiring_products:
        days_until_expiry = int(product[2])
        status = "просрочен" if days_until_expiry < 0 else f"истекает через {days_until_expiry} дней"
        products.append({
            "name": product[0],
            "expiry_date": product[1],
            "status": status
        })

    return jsonify(products)

@app.route('/get_shopping_list')
def get_shopping_list():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM shopping_list')
    shopping_list = cursor.fetchall()

    conn.close()

    return jsonify(shopping_list)

@app.route('/delete_shopping_item', methods=['POST'])
def delete_shopping_item():
    data = request.json
    item_id = data.get('id')

    if not item_id:
        return jsonify({"status": "error", "message": "Необходимо предоставить ID продукта"}), 400

    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM shopping_list WHERE id = ?', (item_id,))
        conn.commit()
    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Ошибка при удалении продукта: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"status": "success", "message": "Продукт удален из списка покупок"})

# Маршрут для получения данных
@app.route('/get_products')
def get_products():
    categories = get_products_by_category()
    return jsonify(categories)

# Маршрут для получения логов
@app.route('/get_logs')
def get_logs():
    logs = get_product_logs()
    return jsonify(logs)

# Маршрут для видеопотока
@app.route('/video_feed')
def video_feed():
    try:
        return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
    except Exception as e:
        print(f"Ошибка в маршруте /video_feed: {e}")
        return "Ошибка при захвате видео.", 500

# Главная страница
@app.route('/')
def index():
    return render_template('Main.html')

@app.route('/analytics')
def analytics():
    return render_template('analytics.html')

@app.route('/Main')
def Main():
    return render_template('Main.html')

@app.route('/shopping_list')
def shopping_list():
    return render_template('shopping_list.html')

# Маршрут для проверки обнаружения QR-кода
@app.route('/qr_detected')
def qr_detected_route():
    global qr_detected, qr_data
    if qr_detected:
        qr_detected = False
        return jsonify({"status": "success", "data": qr_data})
    return jsonify({"status": "waiting"})

# Поток для перенаправления после обнаружения QR-кода
def qr_redirect_thread():
    global qr_detected, qr_data
    while True:
        if qr_detected:
            with app.test_request_context():
                print(f"QR Code detected: {qr_data}")
                qr_detected = False
        threading.Event().wait(1)

# Инициализация базы данных при запуске приложения
ensure_database()

# Запуск приложения
if __name__ == '__main__':
    threading.Thread(target=qr_redirect_thread, daemon=True).start()
    app.run(host='0.0.0.0', port=5000)
