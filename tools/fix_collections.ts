import { walk } from "https://deno.land/std@0.221.0/fs/walk.ts";

const MAPPING_FILE = "dspace_map.json";
const ARCHIVE_DIR = "../archives";

async function main() {
    console.log("📂 Membaca Peta DSpace...");
    const mapText = await Deno.readTextFile(MAPPING_FILE);
    const mapData = JSON.parse(mapText);

    console.log("🚀 Memulai Update Massal...");
    let count = 0;

    for await (const entry of walk(ARCHIVE_DIR, { includeFiles: true })) {
        if (entry.name === "collections") {
            const content = await Deno.readTextFile(entry.path);
            const currentCode = content.replace("digilib/", "").trim();

            if (mapData[currentCode]) {
                const realHandle = mapData[currentCode];
                
                await Deno.writeTextFile(entry.path, realHandle);
                
                count++;
                if (count % 100 === 0) process.stdout.write(".");
            }
        }
    }

    console.log(`\nSELESAI! ${count} file 'collections' berhasil diupdate ke ID Asli.`);
}

main();