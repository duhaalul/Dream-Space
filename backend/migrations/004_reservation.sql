-- Reservasi WhatsApp: nomor WhatsApp pelanggan dan nomor antrean reservasi sendiri per paket per hari.
-- Datang langsung tetap RG-001, RG-002 dan reservasi yang sudah datang mendapat RG-R001, RG-R002.
-- Komentar sengaja tanpa titik koma karena migrate memecah berkas per titik koma.
ALTER TABLE visits ADD COLUMN phone VARCHAR(20) NULL AFTER customer_name;
-- Indeks unik baru dibuat dulu supaya foreign key package_id selalu punya indeks, baru indeks lama dihapus.
ALTER TABLE visits ADD UNIQUE INDEX visits_queue_number (package_id,service_date,customer_type,queue_number);
ALTER TABLE visits DROP INDEX package_id;
ALTER TABLE queue_counters ADD COLUMN kind ENUM('WALK_IN','RESERVASI') NOT NULL DEFAULT 'WALK_IN' AFTER service_date;
ALTER TABLE queue_counters DROP PRIMARY KEY, ADD PRIMARY KEY (package_id,service_date,kind)
