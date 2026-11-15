CREATE TABLE users (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL, username VARCHAR(60) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, role ENUM('ADMIN','OWNER') NOT NULL UNIQUE,
 must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
CREATE TABLE sessions (
 id CHAR(36) PRIMARY KEY, user_id INT UNSIGNED NOT NULL,
 last_activity_at DATETIME(3) NOT NULL, revoked_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX(user_id,revoked_at)
);
CREATE TABLE packages (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
 queue_code VARCHAR(10) NOT NULL UNIQUE,
 price_type ENUM('PER_SESI','PER_ORANG','PER_KELOMPOK') NOT NULL,
 price BIGINT UNSIGNED NOT NULL, included_persons INT UNSIGNED NULL,
 extra_person_price BIGINT UNSIGNED NULL, min_persons INT UNSIGNED NULL, max_persons INT UNSIGNED NULL,
 description TEXT NULL, is_open BOOLEAN NOT NULL DEFAULT TRUE, closed_reason VARCHAR(500) NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, updated_by INT UNSIGNED NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(updated_by) REFERENCES users(id),
 CHECK(price <= 1000000000000), CHECK(min_persons IS NULL OR max_persons IS NULL OR min_persons <= max_persons)
);
CREATE TABLE package_backgrounds (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, package_id INT UNSIGNED NOT NULL,
 name VARCHAR(100) NOT NULL, max_persons INT UNSIGNED NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(package_id) REFERENCES packages(id), UNIQUE(id,package_id), UNIQUE(package_id,name)
);
CREATE TABLE addons (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
 price BIGINT UNSIGNED NOT NULL, unit VARCHAR(40) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK(price <= 1000000000000)
);
CREATE TABLE package_addons (
 package_id INT UNSIGNED NOT NULL, addon_id INT UNSIGNED NOT NULL,
 PRIMARY KEY(package_id,addon_id), FOREIGN KEY(package_id) REFERENCES packages(id), FOREIGN KEY(addon_id) REFERENCES addons(id)
);
CREATE TABLE visits (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_name VARCHAR(100) NOT NULL,
 customer_type ENUM('WALK_IN','RESERVASI') NOT NULL, appointment_at DATETIME(3) NULL,
 service_date DATE NOT NULL, package_id INT UNSIGNED NULL, background_id INT UNSIGNED NULL,
 persons INT UNSIGNED NULL, queue_number INT UNSIGNED NULL, queue_entered_at DATETIME(3) NULL,
 queue_code_snapshot VARCHAR(10) NULL, has_priority BOOLEAN NOT NULL DEFAULT FALSE,
 status ENUM('RESERVASI','MENUNGGU','DIPANGGIL','SEDANG_DILAYANI','DILEWATI','SELESAI','DIBATALKAN') NOT NULL,
 called_at DATETIME(3) NULL, started_at DATETIME(3) NULL, finished_at DATETIME(3) NULL,
 cancel_reason VARCHAR(500) NULL, note VARCHAR(500) NULL,
 client_request_id CHAR(36) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL,
 created_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY(package_id) REFERENCES packages(id),
 FOREIGN KEY(background_id,package_id) REFERENCES package_backgrounds(id,package_id),
 FOREIGN KEY(created_by) REFERENCES users(id),
 UNIQUE(package_id,service_date,queue_number), INDEX(service_date,status,package_id), INDEX(package_id,status),
 CHECK(persons IS NULL OR persons > 0), CHECK(background_id IS NULL OR package_id IS NOT NULL),
 CHECK(customer_type <> 'RESERVASI' OR appointment_at IS NOT NULL)
);
CREATE TABLE queue_counters (
 package_id INT UNSIGNED NOT NULL, service_date DATE NOT NULL, last_number INT UNSIGNED NOT NULL,
 PRIMARY KEY(package_id,service_date), FOREIGN KEY(package_id) REFERENCES packages(id)
);
CREATE TABLE visit_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, visit_id BIGINT UNSIGNED NOT NULL,
 event_type VARCHAR(40) NOT NULL, from_status VARCHAR(30) NULL, to_status VARCHAR(30) NOT NULL,
 package_id INT UNSIGNED NULL, queue_number INT UNSIGNED NULL, service_date_snapshot DATE NOT NULL,
 queue_code_snapshot VARCHAR(10) NULL, reason VARCHAR(500) NULL, created_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(visit_id) REFERENCES visits(id), FOREIGN KEY(created_by) REFERENCES users(id), INDEX(visit_id,created_at)
);
CREATE TABLE transactions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_no VARCHAR(50) NOT NULL UNIQUE,
 visit_id BIGINT UNSIGNED NOT NULL UNIQUE,
 price_type_snapshot ENUM('PER_SESI','PER_ORANG','PER_KELOMPOK') NULL,
 price_snapshot BIGINT UNSIGNED NULL, included_persons_snapshot INT UNSIGNED NULL,
 extra_person_price_snapshot BIGINT UNSIGNED NULL, background_snapshot VARCHAR(100) NULL,
 subtotal BIGINT UNSIGNED NOT NULL DEFAULT 0, total BIGINT UNSIGNED NOT NULL DEFAULT 0,
 payment_status ENUM('BELUM_DIBAYAR','BELUM_LUNAS','LUNAS','KELEBIHAN_BAYAR','TIDAK_ADA_TAGIHAN') NOT NULL DEFAULT 'BELUM_DIBAYAR',
 refund_status ENUM('BELUM_ADA','SEBAGIAN','PENUH') NOT NULL DEFAULT 'BELUM_ADA',
 completed_at DATETIME(3) NULL, cancelled_at DATETIME(3) NULL,
 created_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY(visit_id) REFERENCES visits(id), FOREIGN KEY(created_by) REFERENCES users(id),
 INDEX(completed_at), INDEX(cancelled_at), CHECK(total <= 1000000000000)
);
CREATE TABLE transaction_items (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED NOT NULL,
 item_type ENUM('PAKET','TAMBAH_ORANG','TAMBAHAN') NOT NULL, addon_id INT UNSIGNED NULL,
 description VARCHAR(255) NOT NULL, qty INT UNSIGNED NOT NULL, unit_snapshot VARCHAR(40) NOT NULL,
 unit_price BIGINT UNSIGNED NOT NULL, amount BIGINT UNSIGNED NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, reason VARCHAR(500) NULL, created_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(transaction_id) REFERENCES transactions(id), FOREIGN KEY(addon_id) REFERENCES addons(id),
 FOREIGN KEY(created_by) REFERENCES users(id), INDEX(transaction_id,is_active),
 CHECK(qty > 0), CHECK(amount = qty * unit_price), CHECK(amount <= 1000000000000),
 CHECK((item_type = 'TAMBAHAN' AND addon_id IS NOT NULL) OR (item_type <> 'TAMBAHAN' AND addon_id IS NULL))
);
CREATE TABLE payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED NOT NULL,
 payment_type ENUM('DP','PEMBAYARAN') NOT NULL, method ENUM('TUNAI','TRANSFER','QRIS') NOT NULL,
 amount BIGINT UNSIGNED NOT NULL, cash_received BIGINT UNSIGNED NULL, change_amount BIGINT UNSIGNED NULL,
 paid_at DATETIME(3) NOT NULL, reference VARCHAR(100) NULL UNIQUE,
 client_request_id CHAR(36) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL,
 created_by INT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(transaction_id) REFERENCES transactions(id), FOREIGN KEY(created_by) REFERENCES users(id),
 INDEX(paid_at), CHECK(amount > 0 AND amount <= 1000000000000),
 CHECK((method = 'TUNAI' AND cash_received IS NOT NULL AND change_amount IS NOT NULL AND cash_received = amount + change_amount)
 OR (method <> 'TUNAI' AND cash_received IS NULL AND change_amount IS NULL))
);
CREATE TABLE refunds (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED NOT NULL,
 amount BIGINT UNSIGNED NOT NULL, method ENUM('TUNAI','TRANSFER','QRIS') NOT NULL,
 reason VARCHAR(500) NOT NULL, refunded_at DATETIME(3) NOT NULL,
 client_request_id CHAR(36) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL,
 created_by INT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(transaction_id) REFERENCES transactions(id), FOREIGN KEY(created_by) REFERENCES users(id),
 INDEX(refunded_at), CHECK(amount > 0 AND amount <= 1000000000000)
);
CREATE TABLE audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, entity VARCHAR(40) NOT NULL,
 entity_id VARCHAR(60) NOT NULL, action VARCHAR(50) NOT NULL,
 old_values JSON NULL, new_values JSON NULL, reason VARCHAR(500) NULL,
 user_id INT UNSIGNED NOT NULL, session_id CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(session_id) REFERENCES sessions(id), INDEX(entity,entity_id,created_at)
);
