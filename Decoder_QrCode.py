from flask import Flask, Response, render_template, redirect, url_for, jsonify
import cv2
import threading
import sqlite3
import json

app = Flask(__name__, static_folder='static')
qr_data = None
qr_detected = False

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
        cursor.execute('''
            INSERT INTO products (id, name, type, manufacture_date, expiry_date, weight, nutrition_value, measurement_type)
            VALUES (:id, :name, :type, :manufacture_date, :expiry_date, :weight, :nutrition_value, :measurement_type)
        ''', product_data)
        conn.commit()
    except sqlite3.IntegrityError:
        print(f"Продукт с ID {product_data['id']} уже существует в базе данных.")
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
    detector = cv2.QRCodeDetector()

    while True:
        success, frame = camera.read()
        if not success:
            print("Failed to grab frame")
            break
        else:
            frame = cv2.flip(frame, 1)
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

            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                print("Failed to encode frame")
                continue

            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

# Функция для получения данных из базы данных
def get_products_by_category():
    db_name = "products.db"
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Получаем все продукты, отсортированные по типу
    cursor.execute('SELECT * FROM products ORDER BY type')
    products = cursor.fetchall()

    # Группируем продукты по категориям
    categories = {}
    for product in products:
        product_type = product[2]  # type находится на индексе 2
        if product_type not in categories:
            categories[product_type] = []
        categories[product_type].append({
            "id": product[0],
            "name": product[1],
            "manufacture_date": product[3],
            "expiry_date": product[4],
            "weight": product[5],
            "nutrition_value": product[6],
            "measurement_type": product[7]
        })

    conn.close()
    return categories
    
# Маршрут для получения данных
@app.route('/get_products')
def get_products():
    categories = get_products_by_category()
    return jsonify(categories)

# Маршрут для видеопотока
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

# Главная страница
@app.route('/')
def index():
    return render_template('main.html')

# Страница успешного сканирования
@app.route('/success')
def success():
    return render_template('success.html')

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