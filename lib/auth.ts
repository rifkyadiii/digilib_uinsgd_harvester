import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

let currentConfig = config({ safe: true });
let isPaused = false;

export function reloadConfig() {
    currentConfig = config({ safe: true });
    console.log("Konfigurasi (.env) dimuat ulang.");
    return currentConfig;
}

export function getCookie() {
    return currentConfig.EPRINTS_COOKIE;
}

export function getUserAgent() {
    return currentConfig.USER_AGENT;
}

export function getWorkerLimit() {
    return Number(currentConfig.WORKER_LIMIT) || 5;
}

export async function waitForNewCookie() {
    if (isPaused) return; 
    isPaused = true;

    console.clear();
    console.log("\n==================================================");
    console.log("       AKSES DITOLAK - COOKIE BERMASALAH!");
    console.log("==================================================");
    console.log("Script dipause otomatis.\n");
    console.log("LAKUKAN HAL BERIKUT:");
    console.log("   1. Buka Browser -> Login Digilib -> Ambil Cookie Baru.");
    console.log("       Ambil Cookies: eprints_session & secure_eprints_session:digilib.uinsgd.ac.id");
    console.log("   2. Buka file '.env' di text editor.");
    console.log("   3. Paste cookie baru ke 'EPRINTS_COOKIE'.");
    console.log("   4. SAVE file .env.");
    console.log("\nMenunggu perubahan file .env ... (Jangan tutup terminal)");

    const watcher = Deno.watchFs("./.env");

    for await (const event of watcher) {
        if (event.kind === "modify") {
            console.log("\nPerubahan terdeteksi!");
            await new Promise(r => setTimeout(r, 500));
            
            reloadConfig();
            
            console.log("Melanjutkan download...");
            isPaused = false;
            break;
        }
    }
}