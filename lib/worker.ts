import { buildItemFolder } from "./saf_builder.ts";
import { getCookie, getUserAgent, waitForNewCookie } from "./auth.ts";

interface TargetItem {
    id: number;
    folder: string;
    name: string;
    slug: string;
    dspace_code: string;
}

async function logErrorToFile(msg: string) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${msg}\n`;
    try {
        await Deno.writeTextFile("harvest_errors.log", logLine, { append: true });
    } catch {
        
    }
}

async function fetchJsonList(url: string): Promise<any[]> {
    while (true) {
        try {
            const res = await fetch(url, {
                headers: { 
                    "Cookie": getCookie(), 
                    "User-Agent": getUserAgent() 
                }
            });

            if (res.status === 403 || res.status === 401) {
                await waitForNewCookie();
                continue;
            }

            if (!res.ok) {
                console.log(`Gagal ambil daftar JSON: ${res.statusText}`);
                return [];
            }

            const text = await res.text();
            if (!text) return [];

            return JSON.parse(text);

        } catch (e) {
            console.log(`Network Error saat ambil daftar: ${e.message}`);
            return [];
        }
    }
}

export async function processJurusan(
    target: TargetItem,
    year: string,
    baseArchiveDir: string,
    updateProgress: () => void 
) {
    const yearParam = year === "0000" ? "NULL" : year;
    const url = `https://digilib.uinsgd.ac.id/cgi/exportview/divisions/${target.slug}/${yearParam}/JSON/data.js`;

    console.log(`[Worker ${target.id}] ${target.name} (${yearParam}) -> Cek Daftar...`);

    const dataList = await fetchJsonList(url);

    if (!Array.isArray(dataList) || dataList.length === 0) {
        updateProgress(); 
        return;
    }

    console.log(`[Worker ${target.id}] ${target.name} (${yearParam}) -> Ditemukan ${dataList.length} item.`);

    const targetDir = `${baseArchiveDir}/${target.folder}`;

    let successCount = 0;
    let failCount = 0;

    for (const item of dataList) {
        try {
            await buildItemFolder(item, targetDir, String(target.id), yearParam);
            successCount++;
        } catch (err: any) {
            failCount++;
            const itemId = item.eprintid || "UNKNOWN";
            
            console.error(`[Gagal] Jurusan: ${target.folder} | ID: ${itemId}`);
            console.error(`Penyebab: ${err.message}`);

            await logErrorToFile(`JURUSAN: ${target.name} | TAHUN: ${yearParam} | ID: ${itemId} | ERROR: ${err.message}`);
        }
    }

    console.log(`[Selesai] ${target.name} (${yearParam}): Sukses ${successCount}, Gagal ${failCount}`);
    
    updateProgress(); 
}