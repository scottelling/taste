# Taste Engine

## What This Is
A cross-domain aesthetic intelligence feed. Users browse curated images across architecture, graphic design, fashion, nature, art, film, product design, and interiors. Every "like" trains a taste profile using simulated CLIP embeddings (cosine similarity in 12-dimensional space). The "For You" feed ranks by proximity to the user's taste centroid.

## Project Structure
```
taste-engine/
├── index.html          # Thin wrapper — CDN React 18 + Babel + localStorage polyfill
├── taste-engine.jsx    # Single-file React app (all components)
├── CLAUDE.md           # This file
└── README.md           # Setup instructions
```

## Deployment
- Lives at `scottelling.com/taste-engine/`
- GitHub Pages — push to repo, it's live
- Static files only — no build step, no bundler
- Babel transpiles JSX in-browser via CDN

## Architecture

### Taste Engine (front-end, current)
- **Embedding simulation**: Each image gets a 12-dim vector based on domain + style attributes
- **Taste profile**: Centroid of all liked image embeddings
- **Feed ranking**: Cosine similarity between each image and taste centroid
- **Persistence**: localStorage via `window.storage` polyfill (was Claude sandbox storage, now localStorage)
- **Reference input**: Users paste image URLs from the wild → auto-liked → shifts taste profile

### Taste Engine (backend, future — not yet built)
- **Image ingestion**: Python cron scripts pulling from Unsplash API, Reddit API, Are.na API, RSS feeds, museum APIs
- **Storage**: Cloudflare R2 for images, Postgres + pgvector for metadata + embeddings
- **CLIP processing**: Batch embed new images daily (openai/clip-vit-base-patch32)
- **API**: Simple REST endpoints serving feed data + accepting likes

## Design System
- Purple Rain tokens: bg `#0A0A0A`, surface `#151515`, text `#E0E0E0`
- Accents: purple `#BB86FC`, teal `#03DAC6`, pink `#F48FB1`, green `#69F0AE`
- Domain colors: architecture=teal, graphic-design=purple, fashion=pink, nature=green, art=amber, film=blue, product=gray, interiors=warm
- Mobile-first, dark mode only
- 44px+ touch targets on all interactive elements

## Key Interactions
1. **Browse** — Masonry grid, domain filter tabs, shuffle button
2. **Like** — Heart icon on hover, each like is a taste signal
3. **Taste activation** — 3+ likes activates the engine, unlocks "For You" ranking
4. **Add Reference** — Paste URL from anywhere, tag with domain, auto-liked
5. **Grid density** — Column stepper (2-6 columns)
6. **Taste Panel** — Slide-out showing domain affinity, style fingerprint, liked grid

## Current Image Source
Using picsum.photos placeholder images. In production, replace `imageUrl` fields with real CDN URLs from the ingestion pipeline.

## Rules
- Mobile-first always
- No build tools — this must work as static files on GitHub Pages
- Scott's Eye checklist: 17-18px body text, 6-8px card gaps, dark mode, 44px touch targets
- Never use DM Sans, Instrument Serif, JetBrains Mono, Inter, or Roboto
- Purple Rain is the design foundation — depart only with justification
