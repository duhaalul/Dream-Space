-- Timer sesi foto. Durasi paket dan menit tambahan diatur Owner di Kelola Paket.
-- visits.session_minutes diisi saat Mulai Foto (durasi paket + menit tambahan) agar perubahan katalog tidak mengubah sesi berjalan.
-- Komentar sengaja tanpa titik koma karena migrate memecah berkas per titik koma.
ALTER TABLE packages ADD COLUMN duration_minutes INT UNSIGNED NULL AFTER max_persons;
ALTER TABLE addons ADD COLUMN extra_minutes INT UNSIGNED NULL AFTER unit;
ALTER TABLE visits ADD COLUMN session_minutes INT UNSIGNED NULL AFTER started_at
