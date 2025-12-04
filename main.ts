import { Checkbox, Confirm } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.221.0/fs/ensure_dir.ts";

import { processJurusan } from "./lib/worker.ts";
import { getWorkerLimit } from "./lib/auth.ts";

const TARGETS_FILE = "targets.json";
const OUTPUT_DIR = "archives";

let tasksCompleted = 0;
let totalTasks = 0;

function taskCompletedCallback() {
    tasksCompleted++;
    updateProgressBar(totalTasks);
}

function updateProgressBar(total: number) {
    const percentage = ((tasksCompleted / total) * 100).toFixed(1);
    Deno.stdout.write(new TextEncoder().encode(`\rProgress: ${tasksCompleted}/${total} tasks (${percentage}%) `));
}

async function loadTargets() {
    try {
        const text = await Deno.readTextFile(TARGETS_FILE);
        const data = JSON.parse(text);
        return data.sort((a: any, b: any) => a.id - b.id);
    } catch (e) {
        console.error(`Gagal membaca ${TARGETS_FILE}. Jalankan 'python slug_scraper.py' dulu!`);
        Deno.exit(1);
    }
}

function generateYearList() {
    const currentYear = new Date().getFullYear() + 1;
    const startYear = 1990;
    const years = [];

    years.push({ name: "ALL YEARS (Pilih Semua Tahun)", value: "ALL_YEARS", checked: false });
    years.push({ name: "Not Specified (0000)", value: "0000", checked: false });
    years.push(Checkbox.separator);

    for (let y = currentYear; y >= startYear; y--) {
        years.push({ name: String(y), value: String(y) });
    }
    return years;
}

async function main() {
    console.clear();
    console.log("============================================");
    console.log("         DIGILIB UIN SGD HARVESTER");
    console.log("============================================\n");

    const allTargets = await loadTargets();
    console.log(`Terdeteksi ${allTargets.length} Jurusan di database.\n`);

    const jurusanOptions = allTargets.map((t: any) => ({
        name: `[${t.id}] ${t.name}`, 
        value: t.id                   
    }));
    
    const jurusanSelectOptions = [
        { name: "ALL JURUSAN (Pilih Semua Jurusan)", value: "ALL_PRODI", checked: false },
        Checkbox.separator,
        ...jurusanOptions
    ];

    const selectedIds: (number | string)[] = await Checkbox.prompt({
        message: "Pilih Jurusan yang mau didownload:",
        options: jurusanSelectOptions,
        minOptions: 1,
        search: true, 
        hint: "Gunakan panah, Spasi untuk pilih/batalkan, Enter konfirmasi.",
    });

    const selectedTargets = selectedIds.includes("ALL_PRODI")
        ? allTargets
        : allTargets.filter((t: any) => selectedIds.includes(t.id));

    const selectedYearsRaw: string[] = await Checkbox.prompt({
        message: "Pilih Tahun Wisuda:",
        options: generateYearList(),
        minOptions: 1,
        hint: "Gunakan panah, Spasi untuk pilih/batalkan, Enter konfirmasi.",
    });
    
    const yearsToProcess = selectedYearsRaw.includes("ALL_YEARS")
        ? generateYearList().filter(y => y.value !== "ALL_YEARS" && y.value !== "SEPARATOR" && y.value !== "-").map(y => y.value)
        : selectedYearsRaw;

    totalTasks = selectedTargets.length * yearsToProcess.length;

    console.log("\n--------------------------------------------");
    console.log(`Target: ${selectedTargets.length} Jurusan`);
    console.log(`Tahun : ${yearsToProcess.length} tahun`);
    console.log(`Total Tugas: ${totalTasks} tugas`);
    console.log(`Concurrent Workers: ${getWorkerLimit()}`);
    console.log("--------------------------------------------");

    const ready = await Confirm.prompt("Mulai Download Data?");
    if (!ready) {
        console.log("Dibatalkan.");
        Deno.exit(0);
    }

    await ensureDir(OUTPUT_DIR);
    
    const limit = pLimit(getWorkerLimit());
    const tasks = [];

    console.log("\nMemulai Worker Pool...");
    updateProgressBar(totalTasks); 

    for (const target of selectedTargets) {
        for (const year of yearsToProcess) {
            const task = limit(() => processJurusan(target, year, OUTPUT_DIR, taskCompletedCallback));
            tasks.push(task);
        }
    }

    await Promise.all(tasks);

    Deno.stdout.write(new TextEncoder().encode("\r" + " ".repeat(80))); // Clear line
    console.log("\r\n============================================");
    console.log("SEMUA TUGAS SELESAI!");
    console.log("Silakan cek folder 'archives/' dan zip folder jurusan untuk diupload.");
    console.log("============================================\n");
}

if (import.meta.main) {
    main();
}