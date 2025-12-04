import { ensureDir } from "https://deno.land/std@0.221.0/fs/ensure_dir.ts";
import { getCookie, getUserAgent, waitForNewCookie } from "./auth.ts";

function escapeXML(str: string): string {
    if (!str) return "";
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

function createDublinCore(data: any): string {
    let xml = `<dublin_core>\n`;
    
    xml += `  <dcvalue element="title" qualifier="none">${escapeXML(data.title)}</dcvalue>\n`;
    
    if (data.date) {
        xml += `  <dcvalue element="date" qualifier="issued">${data.date}</dcvalue>\n`;
    }

    if (data.creators && Array.isArray(data.creators)) {
        for (const c of data.creators) {
            const name = c.name ? `${c.name.family}, ${c.name.given}` : "Unknown";
            xml += `  <dcvalue element="contributor" qualifier="author">${escapeXML(name)}</dcvalue>\n`;
        }
    }

    if (data.contributors && Array.isArray(data.contributors)) {
        for (const c of data.contributors) {
            const name = c.name ? `${c.name.family}, ${c.name.given}` : "Unknown";
            xml += `  <dcvalue element="contributor" qualifier="advisor">${escapeXML(name)}</dcvalue>\n`;
        }
    }

    if (data.abstract) {
        xml += `  <dcvalue element="description" qualifier="abstract">${escapeXML(data.abstract)}</dcvalue>\n`;
    }

    if (data.subjects && Array.isArray(data.subjects)) {
        for (const s of data.subjects) {
            xml += `  <dcvalue element="subject" qualifier="none">${escapeXML(s)}</dcvalue>\n`;
        }
    }

    xml += `  <dcvalue element="identifier" qualifier="uri">${escapeXML(data.uri)}</dcvalue>\n`;
    xml += `</dublin_core>`;
    
    return xml;
}

async function downloadFile(url: string, filepath: string): Promise<boolean> {
    while (true) {
        try {
            const cookie = getCookie();
            const ua = getUserAgent();

            const res = await fetch(url, {
                headers: {
                    "Cookie": cookie,
                    "User-Agent": ua
                }
            });

            if (res.status === 403 || res.status === 401) {
                await waitForNewCookie();
                continue; 
            }

            if (!res.ok) return false;

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                await waitForNewCookie(); 
                continue;
            }

            const fileData = await res.arrayBuffer();
            await Deno.writeFile(filepath, new Uint8Array(fileData));
            return true;

        } catch (error) {
            return false;
        }
    }
}

export async function buildItemFolder(
    itemData: any, 
    baseDir: string, 
    prodiId: string, 
    yearContext: string 
) {
    const eprintId = itemData.eprintid;
    let nim = "";

    if (itemData.creators && itemData.creators.length > 0) {
        nim = itemData.creators[0].id;
    }

    const uniqueId = nim ? nim : `null${eprintId}`;
    
    const folderName = `item_${uniqueId}`;
    const itemPath = `${baseDir}/${folderName}`;

    await ensureDir(itemPath);

    await Deno.writeTextFile(`${itemPath}/dublin_core.xml`, createDublinCore(itemData));

    await Deno.writeTextFile(`${itemPath}/handle`, `digilib/${uniqueId}`);
    
    await Deno.writeTextFile(`${itemPath}/collections`, `digilib/${prodiId}`);

    let contentsStr = "";
    
    if (itemData.documents && Array.isArray(itemData.documents)) {
        for (const doc of itemData.documents) {
            const docUri = doc.uri;
            const docDesc = doc.formatdesc || "FILE";
            
            const safeDesc = docDesc.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
            const safeYear = yearContext === "NULL" ? "0000" : yearContext;
            
            const fileName = `${prodiId}-${safeYear}-${uniqueId}-${safeDesc}.pdf`;
            
            const success = await downloadFile(docUri, `${itemPath}/${fileName}`);

            if (success) {
                let flags = "";
                
                if (doc.security === "public") {
                    if (safeDesc.includes("COVER")) {
                        flags = "\tprimary:true";
                    } else {
                        flags = "\tpermissions:-r 'Anonymous'";
                    }
                } else {
                    flags = "\tpermissions:-r 'Mahasiswa'";
                }

                contentsStr += `${fileName}${flags}\n`;
            }
        }
    }

    await Deno.writeTextFile(`${itemPath}/contents`, contentsStr);
}