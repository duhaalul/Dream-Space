# Klarifikasi pembayaran - 11 November 2026

Instruksi terbaru pengguna: "mulai foto harus lunas namun jika ada dia menambah ad on misalnya nambah waktu itu nanti diakhir bayar nya".

Aturan yang diterapkan:

1. Reservasi dapat menerima DP dan walk-in dapat menerima pembayaran bertahap sebelum foto.
2. Admin boleh memanggil pelanggan untuk bersiap/melunasi, tetapi **START foto ditolak sampai seluruh tagihan yang sudah tercatat lunas**. DP atau pembayaran sebagian belum cukup.
3. Saat sesi sudah berjalan, Admin dapat menambah layanan (misalnya tambah waktu/cetak). Tagihan bertambah dan status pembayaran boleh menjadi BELUM_LUNAS sementara, tanpa menghentikan sesi.
4. Konfirmasi akhir mencatat seluruh tambahan dan jumlah orang akhir. Semua sisa tagihan harus dilunasi sebelum SELESAI/nota.
5. Bila ada kelebihan bayar, selesaikan melalui refund sebelum START/SELESAI. Tagihan nol tidak memerlukan pembayaran fiktif.

Contoh: paket Rp100.000 dilunasi → foto mulai → tambah waktu Rp20.000 → sisa Rp20.000 dibayar di akhir → selesai dan nota.

Tidak perlu tabel DP atau tabel tagihan awal terpisah. `transaction_items` mencatat rincian, `payments` menyimpan beberapa penerimaan, dan `transactions.payment_status` dihitung ulang. Audit `START_PAYMENT_CHECK` menyimpan total dan pembayaran bersih saat sesi dimulai. Struktur ERD tetap 14 tabel bisnis/teknis utama; `request_hash` ditambahkan untuk keamanan retry dan `schema_migrations` hanya pencatat migrasi.

Kalimat SRS lama yang membolehkan mulai foto sebelum lunas perlu diselaraskan oleh tim System Analyst. Dokumen SRS sumber tidak diedit diam-diam; klarifikasi ini menjadi keputusan terbaru pada backend dan ERD Revisi 05.
