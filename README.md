# DIGILIB UIN SGD HARVESTER

Command Line Interface untuk memanen data Skripsi/Tesis dari Digilib UIN Sunan Gunung Djati Bandung (EPrints) dan menyusunnya dalam format **Simple Archive Format (SAF)** untuk diunggah ke DSpace.

---

## 🛠️ Persyaratan & Teknologi

| Komponen | Bahasa | Tujuan |
| :--- | :--- | :--- |
| **Harvester Utama** | Deno (TypeScript) | Download Pararel, SAF Builder, CLI Interaktif |
| **Mapper Data** | Python 3.x | Scraping dan Cleaning Data Awal |
| **Konfigurasi** | `.env` | Menyimpan Cookie Session dan Worker Limit |
| **Concurrency** | Deno p-limit | Menjalankan 5 download Jurusan secara bersamaan |

### ⚙️ Instalasi Prasyarat

1\. Deno Runtime

Deno diperlukan untuk menjalankan script utama (**`main.ts`**) karena menyediakan lingkungan TypeScript, fitur keamanan, dan I/O *async* yang efisien.

| Sistem Operasi | Metode Instalasi | Perintah |
| :--- | :--- | :--- |
| **Arch/Manjaro (sudah ada)** | Repository Resmi | `sudo pacman -S deno` |
| **Debian/Ubuntu** | Shell Script (Direkomendasikan) | `curl -fsSL https://deno.land/install.sh | sh` |
| **Fedora/RHEL** | Package Manager | `sudo dnf install deno` |
| **macOS (via Homebrew)** | Package Manager | `brew install deno` |
| **Windows (via Scoop)** | Package Manager | `scoop install deno` |

> *Catatan:* Jika  menggunakan metode **Shell Script** (`curl`), Anda mungkin perlu menambahkan folder instalasi Deno ke dalam variabel lingkungan `$PATH` Anda.

2\. Python & Library Scraping

Python diperlukan untuk menjalankan script pra-pemrosesan data (**`slug_scraper.py`**). Script ini bergantung pada dua library standar.

| Library | Tujuan | Perintah Instalasi |
| :--- | :--- | :--- |
| **requests** | Untuk melakukan permintaan HTTP (mengambil HTML). | `pip install requests` |
| **beautifulsoup4** | Untuk memecah (parse) dan menavigasi struktur HTML. | `pip install beautifulsoup4` |

**Perintah Instalasi Umum (Setelah Python terpasang):**

```bash
pip install requests beautifulsoup4
```

> *Penting:* Selalu disarankan untuk menggunakan *virtual environment* (seperti `venv` atau `conda`) untuk proyek Python agar dependensi proyek tidak mengganggu sistem global Anda.

Setelah semua terinstal, mulai alur kerja sistem seperti berikut: `python slug_scraper.py` -\> `deno run main.ts`.

---

## 🚀 Alur Kerja (Setup Awal)

Proyek ini menggunakan dua tahap: Persiapan data (Python) dan Eksekusi download (Deno).

### Fase 0: Setup Konfigurasi (.env)

Buat file **`.env`** di root folder dan isi dengan cookie dari browser (Pastikan sudah login [Digilib UIN SGD](https://digilib.uinsgd.ac.id)
):

```env
# Ambil dari F12 -> Network -> Cookie, gabungkan eprints_session dan secure_eprints_session
EPRINTS_COOKIE="eprints_session=ISI_DI_SINI; secure_eprints_session=ISI_DI_SINI"

# Konfigurasi User-Agent agar request HTTP dikenali sebagai permintaan dari browser normal
USER_AGENT="ISI_DI_SINI"
# DEFAULT: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36

# Batasi jumlah worker pararel (Maksimal 5-10)
WORKER_LIMIT=5
````

### Fase 1: Mempersiapkan Data Target (Python)

Jalankan script Python untuk men-scrape daftar jurusan UIN dan meratakannya menjadi format yang dimengerti Deno:

```bash
python slug_scraper.py
```

  * **Output:** File **`targets.json`** yang berisi daftar rata (flat list) semua Program Studi dan Konsentrasi yang ditemukan.

-----

## 💻 Penggunaan Program Utama (`main.ts`)

Setelah `targets.json` tersedia, jalankan Harvester utama.

**Jalankan Perintah Utama:**

```bash
deno run --allow-net --allow-read --allow-write --allow-env main.ts
```

### Fitur CLI Interaktif:

1.  **Pilihan Jurusan:** Menggunakan menu *checkbox* (Spasi untuk memilih) yang diambil dari `targets.json`.
2.  **Pilihan Tahun:** Menggunakan menu *checkbox* yang mencakup tahun **1990 hingga 2026** ditambah kategori khusus **"0000"** (untuk data "Not Specified").

### 🔒 Fitur Anti-Timeout (Hot-Swap Cookie)

Sistem ini dirancang untuk tidak mati total jika cookie habis (error 403):

1.  Jika salah satu Worker gagal autentikasi, **semua proses akan PAUSE**.
2.  Terminal akan menampilkan pesan **"AKSES DITOLAK - COOKIE BERMASALAH!"**.
3.  **Langkah Penyelesaian:** Ambil cookie baru dari browser, replace baris `EPRINTS_COOKIE` di file **`.env`**, lalu **SAVE**.
4.  Script akan mendeteksi perubahan file dan **RESUME** download secara otomatis.

-----

## 📦 Output & Struktur SAF

Hasil panen disimpan di folder **`archives/`**.

### Struktur Folder Output:

```text
archives/
└── [NAMA_JURUSAN]/     (Contoh: teknik_informatika)
    └── item_[NIM]/             <-- Jika NIM ada (Contoh: item_1217050091)
    └── item_null[ID]/          <-- Jika NIM kosong (Contoh: item_null11234)
        ├── dublin_core.xml     (Metadata XML)
        ├── contents            (Manifest file untuk file PDF dan hak akses)
        ├── collections         (Isi: digilib/TEMP_XX)
        ├── handle              (Isi: digilib/[NIM/NULL_ID])
        └── [ID_PRODI]-[TAHUN]-[ID_UNIK]-COVER.pdf
```

### ✅ Penanganan Data Penting

| File / Metadata | Format Penamaan | Tujuan |
| :--- | :--- | :--- |
| **Folder Item** | `item_{NIM}` (Fallback: `item_null{ID}`) | Memudahkan pencarian data berdasarkan NIM. |
| **Nama File PDF** | `{ID_PRODI}-{Tahun}-{NIM/NULL_ID}-...` | Prefix: **Angka ID** dari `targets.json` (Contoh: `58-2024-1217...pdf`) |
| **Tahun Kosong** | Ditandai sebagai **`0000`** di nama file. | Konsisten dengan data EPrints "Not Specified". |
| **Collections File** | `digilib/TEMP_[ID]` | **Placeholder Sementara** (Wajib diganti nanti). |

### 🔄 Update Kode DSpace (Post-Harvest)

Untuk mengganti kode `TEMP_ID` menjadi ID Handle DSpace asli (`12345/67`):

1.  Buat file `tools/dspace_map.json` dengan pemetaan ID asli.
2.  Jalankan script `tools/fix_collections.ts`.

Ini memastikan tidak perlu download ulang PDF hanya karena label ID DSpace berubah.
