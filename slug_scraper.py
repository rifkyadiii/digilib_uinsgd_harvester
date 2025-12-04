import requests
from bs4 import BeautifulSoup
import json
import sys
import re
import os

sys.setrecursionlimit(5000)

URL_TARGET = "https://digilib.uinsgd.ac.id/view/divisions/"
OUTPUT_FILE = "targets.json"
HEADERS = os.getenv("USER_AGENT")


def generate_folder_name_from_label(label):
    clean = label.lower()
    
    clean = clean.replace("program studi", "")
    clean = clean.replace("fakultas", "")
    clean = clean.replace("pascasarjana", "")
    
    clean = re.sub(r'[^\w\s]', '', clean)
    clean = clean.strip().replace(" ", "_")
    clean = re.sub(r'_+', '_', clean)
    
    return clean

def get_type_hybrid(href, text_label):
    label_lower = text_label.lower()
    
    if "fakultas" in label_lower: return "Fakultas"
    if "pascasarjana" in label_lower: return "Pascasarjana"
    
    if label_lower.startswith("konsentrasi"): return "Konsentrasi"
    
    if "fak=" in href: return "Fakultas"
    if "prodi=" in href: return "Program Studi"
    if "konsentrasi=" in href: return "Konsentrasi"
    
    if "program studi" in label_lower: return "Program Studi"
    
    return "Lainnya"

def parse_ul_recursive(ul_element):
    results = []
    list_items = ul_element.find_all('li', recursive=False)
    
    for li in list_items:
        a_tag = li.find('a', recursive=False)
        if a_tag:
            raw_href = a_tag.get('href', '')
            text_label = a_tag.get_text(strip=True)
            
            clean_href = raw_href.rstrip('/')
            slug_only = clean_href.split('/')[-1].replace(".html", "")
            
            current_type = get_type_hybrid(clean_href, text_label)
            
            data_item = {
                "nama": text_label,
                "slug": slug_only, 
                "href": clean_href,
                "type": current_type 
            }
            
            all_child_uls = li.find_all('ul', recursive=False)
            raw_children = []
            for child_ul in all_child_uls:
                raw_children.extend(parse_ul_recursive(child_ul))
            
            if raw_children:
                grouped_contents = {}
                for child in raw_children:
                    child_type = child.get('type', 'Lainnya')
                    if child_type not in grouped_contents:
                        grouped_contents[child_type] = []
                    grouped_contents[child_type].append(child)
                data_item['contents'] = grouped_contents
            
            results.append(data_item)
    return results

def flatten_tree(node, flat_list, context_fakultas="", context_induk=""):
    current_name = node['nama']
    current_type = node['type']
    
    next_fakultas = context_fakultas
    if current_type in ["Fakultas", "Pascasarjana"]:
        next_fakultas = current_name
        
    next_induk = context_induk
    if current_type == "Program Studi":
        next_induk = current_name

    if current_type in ["Program Studi", "Konsentrasi"]:
        folder_name = generate_folder_name_from_label(current_name)
        
        induk_value = ""
        if current_type == "Konsentrasi":
            induk_value = context_induk

        exists = any(x['slug'] == node['slug'] for x in flat_list)
        if not exists:
            flat_list.append({
                "folder": folder_name,
                "name": current_name,
                "slug": node['slug'],
                "fakultas": next_fakultas, 
                "induk": induk_value 
            })

    if 'contents' in node:
        for group_name in node['contents']:
            for child in node['contents'][group_name]:
                flatten_tree(child, flat_list, next_fakultas, next_induk)

def main():
    print(f"Mengambil data dari: {URL_TARGET} ...")
    try:
        response = requests.get(URL_TARGET, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Gagal koneksi: {e}")
        return

    menu_container = soup.find('div', class_='ep_view_menu')
    
    if menu_container:
        root_ul = menu_container.find('ul', recursive=False)
        
        if root_ul:
            raw_tree_data = parse_ul_recursive(root_ul)
            
            final_targets = []
            
            for node in raw_tree_data:
                flatten_tree(node, final_targets)

            for idx, item in enumerate(final_targets, 1):
                item['id'] = idx
                item['dspace_code'] = f"TEMP_{idx}" 

            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(final_targets, f, indent=2, ensure_ascii=False)
            
            print(f"SUKSES! {len(final_targets)} Jurusan ditemukan.")
            print(f"Data tersimpan di '{OUTPUT_FILE}'")
        else:
            print("Gagal menemukan UL root.")
    else:
        print("Gagal menemukan container menu.")

if __name__ == "__main__":
    main()