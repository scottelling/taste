#!/usr/bin/env python3
"""
Taste Engine — CLIP Embedding Generator
Generates real 512-dim CLIP embeddings for Unsplash images.
Output: public/embeddings.json (consumed by frontend)
Install: pip install torch torchvision ftfy clip-by-openai Pillow requests
Run: python clip-embeddings.py
"""
import json
import requests
from pathlib import Path
from PIL import Image
from io import BytesIO
import torch
import clip

UNSPLASH_ACCESS_KEY = "PlKD7h9DEFYnOnqcAuUmVEJ1VROMWxnfs4FPCe1ESlM"
IMAGES_PER_DOMAIN = 30
OUTPUT = Path("public/embeddings.json")

DOMAIN_QUERIES = {
    "architecture":  "architectural photography minimal brutalist",
    "graphic_design":"graphic design poster typography layout",
    "fashion":       "editorial fashion photography minimal",
    "nature":        "nature macro abstract botanical",
    "art":           "contemporary fine art painting abstract",
    "film":          "cinematic film photography analog grain",
    "product_design":"product design industrial minimal object",
    "interiors":     "interior design architecture minimal space",
}

def fetch_unsplash(domain, query, per_page=20):
    r = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": query, "page": 1, "per_page": per_page, "orientation": "squarish"},
        headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["results"]

def load_image(url):
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return Image.open(BytesIO(r.content)).convert("RGB")

def main():
    print("Loading CLIP ViT-B/32...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, preprocess = clip.load("ViT-B/32", device=device)
    print(f"Running on {device}\n")

    OUTPUT.parent.mkdir(exist_ok=True)
    results = []

    for domain, query in DOMAIN_QUERIES.items():
        print(f"→ {domain}")
        metas = fetch_unsplash(domain, query, per_page=IMAGES_PER_DOMAIN)

        for meta in metas:
            try:
                img = load_image(meta["urls"]["small"])
                tensor = preprocess(img).unsqueeze(0).to(device)
                with torch.no_grad():
                    emb = model.encode_image(tensor)
                    emb = emb / emb.norm(dim=-1, keepdim=True)
                    vec = emb.squeeze().cpu().tolist()  # 512-dim

                results.append({
                    "id": meta["id"],
                    "url": meta["urls"]["small"],
                    "fullUrl": meta["urls"]["regular"],
                    "thumb": meta["urls"]["thumb"],
                    "color": meta.get("color"),
                    "description": meta.get("alt_description") or meta.get("description") or "",
                    "photographer": meta.get("user", {}).get("name", ""),
                    "domain": domain,
                    "embedding": vec,
                    "liked": False,
                    "source": "unsplash",
                    "unsplashLink": meta.get("links", {}).get("html"),
                })
                print(f"   ✓ {meta['id']}")
            except Exception as e:
                print(f"   ✗ {meta.get('id', '?')}: {e}")

    OUTPUT.write_text(json.dumps(results, indent=2))
    print(f"\n✓ {len(results)} embeddings → {OUTPUT}")
    print("Update taste-engine.jsx to load /embeddings.json instead of calling Unsplash at runtime.")

if __name__ == "__main__":
    main()
