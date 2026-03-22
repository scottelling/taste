# Taste Engine

Cross-domain aesthetic intelligence feed. Learns your visual taste across architecture, design, fashion, nature, art, film, and more.

## Quick Start

```bash
# Clone into your scottelling.com repo
cd ~/Projects/scottelling.com
mkdir -p taste-engine
cp -r /path/to/taste-engine/* taste-engine/

# Test locally
cd taste-engine
python3 -m http.server 8080
# Open http://localhost:8080

# Deploy
git add taste-engine/
git commit -m "Add Taste Engine prototype"
git push
# Live at scottelling.com/taste-engine/
```

## Local Development
No build step needed. Just serve the directory with any static server:

```bash
python3 -m http.server 8080
# or
npx serve .
# or
php -S localhost:8080
```

## Next Steps (Backend)
1. Set up Cloudflare R2 bucket for image storage
2. Write ingestion scripts (Unsplash, Reddit, Are.na)
3. Run CLIP embeddings locally on MacBook Pro
4. Store vectors in Supabase (free tier pgvector)
5. Replace picsum placeholder URLs with real images
6. Add API endpoint serving feed data
