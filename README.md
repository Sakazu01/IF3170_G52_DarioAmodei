# IF3170_G52_DarioAmodei

Tugas Besar 1 IF3170 Inteligensi Buatan: memasukkan paket ke satu atau beberapa truk
(memaksimalkan total value paket yang terangkut) dengan algoritma local search: Hill-Climbing (steepest ascent,
sideways move, stochastic, random restart), Simulated Annealing, dan Genetic Algorithm. Visualisasi state
(awal dan akhir), grafik, dan hasil eksperimen ada di aplikasi web (`src/frontend`).

Laporan lengkap (PDF) ada di folder `docs/`.

## Anggota Kelompok (G52)
| Nama | NIM |
|---|---|
| Kloce Paul William Saragih | 13524040 |
| Ariel Cornelius Sitorus | 13524085 |
| Yayat Nurhidayat | 13223071 |

## Deskripsi Singkat Persoalan
- **Truk**: ruang muat balok `w x l x h` dan batas bobot `max_capacity`. Jumlah truk ditentukan oleh data masukan.
- **Paket**: dimensi `w x l x h`, `value`, `weight`, `fragile`, `eta`. Paket boleh diputar ke 6 orientasi.
- **Tujuan**: memaksimalkan jumlah `value` paket yang berhasil dimuat.
- **Constraint** (semua diperiksa oleh `violations()` di `core/constraints.py`):
  1. paket berada di dalam batas truk,
  2. paket tidak saling tumpang tindih,
  3. paket tidak melayang (harus ditopang lantai atau paket lain),
  4. paket `fragile` tidak boleh menjadi penopang paket lain,
  5. total bobot per truk tidak melebihi `max_capacity`.
- **State**: kamus `id paket -> Placement(truck, x, y, z, orient)` atau `None` bila paket tidak dimuat. Nilai `z`
  ditentukan oleh `settle()` (gravitasi), sehingga paket tidak pernah melayang.
- **Neighbor**: `relocate` (0,35), `swap` (0,35), `transfer` antar truk (0,15), dan `rotate` (0,15). Hasil yang
  melanggar constraint dibuang.
- Atribut `eta` ada pada data tetapi tidak dipakai pada objective maupun constraint.

## Struktur Repository
```
docs/              laporan (PDF)
output/            hasil run algoritma (state, metrics) dan hasil eksperimen
  experiments/       hill_climbing/, simulated_annealing/, genetic_algorithm/ (45 berkas JSON)
src/
  backend/         algoritma dan logika (Python, pandas untuk membaca hasil eksperimen)
    core/            model, io, constraints, objective, generator, moves, stats
    algorithms/      hill_climbing, simulated_annealing, genetic_algorithm
    experiments/     kerangka eksperimen manual dan eksperimen per algoritma
    data/            instance JSON (dasar_* untuk analisis, edge_* untuk kasus batas)
    run.py           menjalankan satu algoritma dari terminal
    run_common.py    daftar algoritma, alias, dan penyimpanan hasil run
    generate_instance.py  membuat instance acak
    server.py        API untuk frontend
  frontend/        visualisasi (React + TypeScript + Tailwind, Three.js, Recharts)
requirements.txt   dependensi Python (pandas)
```

Algoritma inti (hill climbing, simulated annealing, genetic algorithm) dan kerangka eksperimen ditulis manual.
Pustaka dipakai hanya untuk pembacaan hasil (pandas) dan visualisasi (React, Three.js, Recharts, Tailwind).

## Setup
Kebutuhan:
- **Python 3.10+**. Install dependensi sekali dari root repo: `pip install -r requirements.txt` (pandas).
- **Node.js 18+**, hanya untuk membangun atau mengubah frontend.

Folder `src/frontend/dist` tidak ikut di repository, jadi bangun frontend dulu sebelum membuka visualisasi:
```
cd src/frontend
npm install
npm run build
```
Algoritma dan eksperimen dari terminal tidak membutuhkan Node.js.

## Menjalankan
### 1. Satu algoritma dari terminal
Hasil disimpan di `output/<algoritma>/` (`run1/`, `run2/`, ... berisi `initial_state.json`, `final_state.json`,
`metrics.json`, serta `summary.json`).
```
cd src/backend
python run.py data/dasar_1truk_50paket.json -a sa --runs 3
python run.py data/dasar_3truk_beda_ukuran_50paket.json -a hc_sideways --seed 7 --set max_sideways=100
```
| Opsi | Arti |
|---|---|
| `-a` | algoritma (wajib), lihat tabel di bawah |
| `--runs` | jumlah run dengan seed berurutan (default 3) |
| `--seed` | seed awal (default 42) |
| `--set KEY=VALUE` | mengganti parameter algoritma, boleh diulang |
| `--output` | folder keluaran (default `output/<algoritma>`) |

| Algoritma | Alias | Parameter (bawaan) |
|---|---|---|
| `steepest_ascent` | `hc`, `hc_steepest` | `max_iter` (300), `n_neighbors` (30) |
| `sideways_move` | `hc_sideways` | `max_iter` (300), `n_neighbors` (30), `max_sideways` (50) |
| `stochastic` | `hc_stochastic` | `max_iter` (300), `n_neighbors` (30) |
| `random_restart` | `hc_restart` | `max_iter` (200), `n_neighbors` (25), `max_restarts` (5) |
| `simulated_annealing` | `sa` | `initial_temp` (100), `min_temp` (0,01), `cooling_rate` (0,95), `iterations_per_temp` (50) |
| `genetic_algorithm` | `ga` | `population_size` (20), `iterations` (50), `mutation_prob` (0,2) |

### 2. Eksperimen parameter
Hasil di `output/experiments/<jenis algoritma>/<data>_<nama>_<parameter>.json` (ringkasan mean, best, stdev,
rata-rata waktu dan iterasi, serta rekaman tiap run).
```
cd src/backend/experiments
python run_experiment.py hc            # hc, sa, ga, all (variasi parameter), atau base (satu konfigurasi tiap algoritma)
python run_experiment.py all --runs 5 --instance ../data/dasar_3truk_beda_ukuran_50paket.json
python run_experiment.py base --instance ../data/edge_1paket.json
```
Bawaan: 3 run (seed 0, 1, 2) pada `dasar_1truk_50paket.json`. Menjalankan ulang pada data dan parameter yang sama
menimpa berkas hasil yang bersesuaian.

### 3. Visualisasi web
```
cd src/backend
python server.py                       # lalu buka http://127.0.0.1:8000  (ganti port: --port 8080)
```
Pilih data dan algoritma, atur parameter dan seed, tekan **Jalankan**. Fitur:
- peta 3D isometrik (putar, zoom, fokus per truk) untuk state awal dan state akhir, dengan label paket,
- pewarnaan berdasarkan value, bobot, atau status fragile, serta kartu detail paket,
- grafik: objective per iterasi, peluang penerimaan dan iterasi stuck (SA), nilai per truk, populasi (GA),
- panel eksperimen yang membaca `output/experiments/` dan dapat membuka ulang konfigurasi di peta,
- unggah data JSON sendiri (disimpan di `src/backend/uploads/`).

Untuk mengubah tampilan: `npm run dev` di `src/frontend`, lalu `npm run build` lagi.

### 4. Membuat data sendiri
```
cd src/backend
python generate_instance.py --trucks 3 --packages 60 --hetero --seed 1 --output data/uji_saya.json
```

## Format Data (JSON)
```json
{
  "trucks":   [ { "dimensions": {"w": 6, "l": 8, "h": 4}, "max_capacity": 120 } ],
  "packages": [ { "id": "S1", "dimensions": {"w": 2, "l": 3, "h": 1},
                  "value": 40, "weight": 10, "fragile": false, "eta": 2 } ]
}
```
Data divalidasi sebelum dijalankan: ada minimal satu truk, dimensi dan kapasitas positif, id unik, nilai tidak
negatif, dan setiap paket muat di salah satu truk pada salah satu orientasi.

## Data Uji
| Berkas | Truk | Paket | Tujuan |
|---|---|---|---|
| `dasar_1truk_8paket.json` | 1 | 8 | kasus kecil, optimum diketahui (465, semua paket muat) |
| `dasar_1truk_50paket.json` | 1 | 50 | kasus utama, semua variasi parameter |
| `dasar_3truk_beda_ukuran_50paket.json` | 3 | 50 | banyak truk berukuran berbeda |
| `edge_1paket.json` | 1 | 1 | kasus batas: satu paket |
| `edge_semua_kelebihan_berat.json` | 1 | 3 | kasus batas: tidak ada paket yang bisa dimuat (optimum 0) |

## Ringkasan Hasil Eksperimen (`dasar_1truk_50paket`, rata-rata 3 run)
Batas atas relaksasi bobot = 2544.

| Algoritma (konfigurasi) | Rata-rata | Waktu per run |
|---|---|---|
| Steepest ascent (n_neighbors=30) | 1780 | 0,5 s |
| Stochastic (n_neighbors=30) | 1717 | 0,7 s |
| Sideways move (max_sideways=50) | 2217 | 11,6 s |
| Random restart (max_restarts=5) | 1906 | 2,2 s |
| Simulated annealing (cooling_rate=0,95) | 2016 | 1,2 s |
| Genetic algorithm (populasi 20, 150 generasi) | 2179 | 6,2 s |

Hasil lengkap dan analisisnya ada di laporan (`docs/`). Catatan: tiap konfigurasi hanya 3 run, sehingga selisih kecil
belum bermakna secara statistik.

## Pembagian Tugas
| Anggota | Tugas |
|---|---|
| Ariel Cornelius Sitorus | Model data, input/output, generator state awal, objective function, constraint; Hill-Climbing (4 varian) dan eksperimennya; visualisasi web (`frontend`) dan perapian struktur repository |
| Kloce Paul William Saragih | Simulated Annealing; dukungan multi-truk (move antar truk, statistik per truk, generator instance); CLI `run.py`; harness eksperimen dan pelaporan |
| Yayat Nurhidayat | Genetic Algorithm dan eksperimennya |

## Pemecahan Masalah
- **Halaman web tidak tampil**: frontend belum dibangun. Jalankan `npm install && npm run build` di `src/frontend`.
- **`ModuleNotFoundError: pandas`**: jalankan `pip install -r requirements.txt`.
- **Port 8000 terpakai**: jalankan `python server.py --port 8080`.
- **Berkas data ditolak**: baca pesan galat, biasanya dimensi tidak positif, id kembar, atau ada paket yang tidak
  muat di truk mana pun.
