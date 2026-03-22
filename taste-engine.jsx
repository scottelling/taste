import { useState, useEffect, useRef } from "react";
// ─── Config ───────────────────────────────────────────────────────────────────
const UNSPLASH_ACCESS_KEY = "PlKD7h9DEFYnOnqcAuUmVEJ1VROMWxnfs4FPCe1ESlM";
const IMAGES_PER_FETCH = 20;
const LIKES_FOR_PROFILE = 3;
const DOMAINS = [
  { id: "architecture", label: "Architecture", emoji: "\u25A3", query: "architectural photography minimal brutalist" },
  { id: "graphic_design", label: "Graphic Design", emoji: "◉", query: "graphic design poster typography layout" },
  { id: "fashion", label: "Fashion", emoji: "✦", query: "editorial fashion photography minimal" },
  { id: "nature", label: "Nature", emoji: "◈", query: "nature macro abstract botanical" },
  { id: "art", label: "Art", emoji: "◆", query: "contemporary fine art painting abstract" },
  { id: "film", label: "Film", emoji: "◎", query: "cinematic film photography analog grain" },
  { id: "product_design", label: "Product", emoji: "⬡", query: "product design industrial minimal object" },
  { id: "interiors", label: "Interiors", emoji: "⊞", query: "interior design architecture minimal space" },
];
const ACCENT = {
  architecture: "#BB86FC",
  graphic_design: "#03DAC6",
  fashion: "#F48FB1",
  nature: "#69F0AE",
  art: "#EA80FC",
  film: "#FFB74D",
  product_design: "#80DEEA",
  interiors: "#CE93D8",
};
// ─── Embedding Engine ─────────────────────────────────────────────────────────
// 12-dim aesthetic space:
// [0] warmth  [1] complexity  [2] organic  [3] brightness
// [4] texture [5] saturation  [6] structural [7] natural
// [8] human   [9] abstract    [10] vintage   [11] contemporary
const TAG_MAP = {
  warm: [0, 0.8], golden: [0, 0.9], amber: [0, 0.8], sunset: [0, 0.7],
  cool: [0, -0.7], blue: [0, -0.4], cold: [0, -0.7], ice: [0, -0.8],
  minimal: [1, -0.9], clean: [1, -0.7], simple: [1, -0.8], sparse: [1, -0.8],
  complex: [1, 0.8], detailed: [1, 0.7], ornate: [1, 0.9], dense: [1, 0.8],
  organic: [2, 0.9], natural: [2, 0.8], curved: [2, 0.6], flowing: [2, 0.7],
  geometric: [2, -0.9], angular: [2, -0.7], grid: [2, -0.8], linear: [2, -0.7],
  bright: [3, 0.8], light: [3, 0.7], white: [3, 0.9], airy: [3, 0.8],
  dark: [3, -0.9], black: [3, -0.7], shadow: [3, -0.6], moody: [3, -0.7],
  textured: [4, 0.8], rough: [4, 0.9], raw: [4, 0.7], concrete: [4, 0.6],
  smooth: [4, -0.8], glass: [4, -0.7], polished: [4, -0.8],
  colorful: [5, 0.9], vibrant: [5, 0.8], saturated: [5, 0.9], bold: [5, 0.7],
  muted: [5, -0.7], monochrome: [5, -0.9], desaturated: [5, -0.8], pastel: [5, 0.3],
  architecture: [6, 0.9], building: [6, 0.8], structure: [6, 0.8], urban: [6, 0.6],
  botanical: [7, 0.9], plant: [7, 0.8], forest: [7, 0.9], landscape: [7, 0.8],
  portrait: [8, 0.9], fashion: [8, 0.8], person: [8, 0.9], model: [8, 0.8],
  abstract: [9, 0.9], conceptual: [9, 0.8], pattern: [9, 0.6],
  vintage: [10, 0.9], analog: [10, 0.8], film: [10, 0.7], retro: [10, 0.9], grain: [10, 0.6],
  modern: [11, 0.8], contemporary: [11, 0.9], futuristic: [11, 0.8], sleek: [11, 0.7],
};
const DOMAIN_BASE = {
  architecture:  [0.2, -0.3, -0.5,  0.3,  0.5, -0.2,  0.9, -0.3, -0.7,  0.1,  0.0,  0.6],
  graphic_design:[-0.1,  0.4, -0.6,  0.5, -0.4,  0.6,  0.2, -0.5, -0.3,  0.7, -0.2,  0.8],
  fashion:       [ 0.3,  0.0,  0.1,  0.4,  0.0,  0.3, -0.3, -0.2,  0.9,  0.2,  0.2,  0.6],
  nature:        [ 0.4, -0.4,  0.9,  0.5,  0.6,  0.4, -0.7,  0.9, -0.6,  0.1, -0.1,  0.0],
  art:           [ 0.2,  0.5,  0.4,  0.0,  0.4,  0.7, -0.2,  0.0,  0.1,  0.8,  0.2,  0.4],
  film:          [-0.3,  0.2,  0.2, -0.5,  0.5, -0.3,  0.1,  0.3,  0.4,  0.5,  0.8,  0.0],
  product_design:[ 0.0, -0.6, -0.7,  0.6, -0.5, -0.1,  0.5, -0.4, -0.5,  0.3, -0.3,  0.9],
  interiors:     [ 0.5, -0.2,  0.1,  0.5,  0.4,  0.1,  0.6,  0.0, -0.3,  0.0,  0.3,  0.5],
};
// ─── Training Cards ───────────────────────────────────────────────────────────
const TRAINING_CARDS = [
  // IDEAS
  { type:"idea", id:"i01", text:"Constraints produce creativity.", category:"craft" },
  { type:"idea", id:"i02", text:"Systems outlast strategies.", category:"thinking" },
  { type:"idea", id:"i03", text:"The solo operator is a legitimate power structure.", category:"work" },
  { type:"idea", id:"i04", text:"Conviction matters more than consensus.", category:"values" },
  { type:"idea", id:"i05", text:"Ship ugly, then make it beautiful.", category:"craft" },
  { type:"idea", id:"i06", text:"Taste is a competitive advantage.", category:"work" },
  { type:"idea", id:"i07", text:"Identity is architected, not discovered.", category:"thinking" },
  { type:"idea", id:"i08", text:"Leverage compounds. Effort doesn\u2019t.", category:"work" },
  { type:"idea", id:"i09", text:"The best tools disappear.", category:"craft" },
  { type:"idea", id:"i10", text:"What you remove defines you as much as what you add.", category:"craft" },
  { type:"idea", id:"i11", text:"Most people optimize for visibility. Build for depth.", category:"values" },
  { type:"idea", id:"i12", text:"Simplicity on the far side of complexity.", category:"thinking" },
  { type:"idea", id:"i13", text:"The gap between appearance and reality is where all the interesting stuff lives.", category:"thinking" },
  { type:"idea", id:"i14", text:"Attention is the raw material of meaning.", category:"values" },
  { type:"idea", id:"i15", text:"Execution is the strategy.", category:"work" },
  { type:"idea", id:"i16", text:"Speed is a design choice.", category:"craft" },
  { type:"idea", id:"i17", text:"The map is not the territory.", category:"thinking" },
  { type:"idea", id:"i18", text:"Form follows function. Function follows meaning.", category:"craft" },

  // REFERENCES
  { type:"reference", id:"r01", name:"Stanley Kubrick", descriptor:"Filmmaker", domain:"film", note:"Visual control as meaning" },
  { type:"reference", id:"r02", name:"Dieter Rams", descriptor:"Industrial Designer", domain:"product_design", note:"10 principles of good design" },
  { type:"reference", id:"r03", name:"Le Corbusier", descriptor:"Architect", domain:"architecture", note:"Machine for living in" },
  { type:"reference", id:"r04", name:"Paul Rand", descriptor:"Graphic Designer", domain:"graphic_design", note:"Logic and intuition in tension" },
  { type:"reference", id:"r05", name:"Hiroshi Sugimoto", descriptor:"Photographer", domain:"art", note:"Time made visible" },
  { type:"reference", id:"r06", name:"Rick Owens", descriptor:"Fashion Designer", domain:"fashion", note:"Darkness as elegance" },
  { type:"reference", id:"r07", name:"Wim Wenders", descriptor:"Filmmaker", domain:"film", note:"Road as philosophy" },
  { type:"reference", id:"r08", name:"Kenya Hara", descriptor:"Designer", domain:"graphic_design", note:"Emptiness as design language" },
  { type:"reference", id:"r09", name:"Rem Koolhaas", descriptor:"Architect", domain:"architecture", note:"Architecture as cultural critique" },
  { type:"reference", id:"r10", name:"Agnes Martin", descriptor:"Painter", domain:"art", note:"Repetition as transcendence" },
  { type:"reference", id:"r11", name:"Jony Ive", descriptor:"Product Designer", domain:"product_design", note:"Material honesty" },
  { type:"reference", id:"r12", name:"Tadao Ando", descriptor:"Architect", domain:"architecture", note:"Concrete, light, silence" },
  { type:"reference", id:"r13", name:"Peter Saville", descriptor:"Graphic Designer", domain:"graphic_design", note:"Typography as emotion" },
  { type:"reference", id:"r14", name:"Ingmar Bergman", descriptor:"Filmmaker", domain:"film", note:"The face as landscape" },
  { type:"reference", id:"r15", name:"Massimo Vignelli", descriptor:"Designer", domain:"graphic_design", note:"The Vignelli canon" },
  { type:"reference", id:"r16", name:"Herzog & de Meuron", descriptor:"Architecture Studio", domain:"architecture", note:"Materiality as identity" },
  { type:"reference", id:"r17", name:"Wolfgang Tillmans", descriptor:"Photographer", domain:"art", note:"The vernacular as sacred" },
  { type:"reference", id:"r18", name:"Neri Oxman", descriptor:"Designer & Architect", domain:"product_design", note:"Nature as blueprint" },

  // CONTRASTS
  { type:"contrast", id:"c01", optionA:"Minimal",   optionB:"Maximal",     dim:1,  aVal:-1,   bVal:1   },
  { type:"contrast", id:"c02", optionA:"Systems",   optionB:"Stories",     dim:6,  aVal:0.8,  bVal:-0.8 },
  { type:"contrast", id:"c03", optionA:"Gut",       optionB:"Data",        dim:9,  aVal:0.5,  bVal:-0.5 },
  { type:"contrast", id:"c04", optionA:"Dark",      optionB:"Light",       dim:3,  aVal:-1,   bVal:1   },
  { type:"contrast", id:"c05", optionA:"Analog",    optionB:"Digital",     dim:10, aVal:1,    bVal:-1  },
  { type:"contrast", id:"c06", optionA:"Sparse",    optionB:"Dense",       dim:1,  aVal:-0.8, bVal:0.8 },
  { type:"contrast", id:"c07", optionA:"Warm",      optionB:"Cool",        dim:0,  aVal:1,    bVal:-1  },
  { type:"contrast", id:"c08", optionA:"Craft",     optionB:"Scale",       dim:6,  aVal:-0.3, bVal:0.9 },
  { type:"contrast", id:"c09", optionA:"Depth",     optionB:"Breadth",     dim:1,  aVal:0.5,  bVal:-0.5 },
  { type:"contrast", id:"c10", optionA:"Geometric", optionB:"Organic",     dim:2,  aVal:-1,   bVal:1   },
  { type:"contrast", id:"c11", optionA:"Textured",  optionB:"Smooth",      dim:4,  aVal:1,    bVal:-1  },
  { type:"contrast", id:"c12", optionA:"Vibrant",   optionB:"Muted",       dim:5,  aVal:1,    bVal:-1  },
  { type:"contrast", id:"c13", optionA:"Fast",      optionB:"Considered",  dim:11, aVal:0.7,  bVal:-0.3 },
  { type:"contrast", id:"c14", optionA:"Solo",      optionB:"Collective",  dim:8,  aVal:-0.5, bVal:0.5 },
  { type:"contrast", id:"c15", optionA:"Timeless",  optionB:"Contemporary",dim:10, aVal:0.5,  bVal:-0.5 },
  { type:"contrast", id:"c16", optionA:"Raw",       optionB:"Refined",     dim:4,  aVal:0.9,  bVal:-0.7 },
  { type:"contrast", id:"c17", optionA:"Structured",optionB:"Intuitive",   dim:9,  aVal:-0.6, bVal:0.6 },
  { type:"contrast", id:"c18", optionA:"Abstract",  optionB:"Literal",     dim:9,  aVal:0.9,  bVal:-0.9 },

  // QUOTES
  { type:"quote", id:"q01", text:"Have nothing in your house that you do not know to be useful, or believe to be beautiful.", author:"William Morris" },
  { type:"quote", id:"q02", text:"Good design is as little design as possible.", author:"Dieter Rams" },
  { type:"quote", id:"q03", text:"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", author:"Antoine de Saint-Exup\u00e9ry" },
  { type:"quote", id:"q04", text:"Style is knowing who you are, what you want to say, and not giving a damn.", author:"Orson Welles" },
  { type:"quote", id:"q05", text:"The details are not the details. They make the design.", author:"Charles Eames" },
  { type:"quote", id:"q06", text:"Everything should be made as simple as possible, but not simpler.", author:"Albert Einstein" },
  { type:"quote", id:"q07", text:"The enemy of art is the absence of limitations.", author:"Orson Welles" },
  { type:"quote", id:"q08", text:"Design is not just what it looks like. Design is how it works.", author:"Steve Jobs" },
  { type:"quote", id:"q09", text:"In the beginner\u2019s mind there are many possibilities. In the expert\u2019s mind there are few.", author:"Shunryu Suzuki" },
  { type:"quote", id:"q10", text:"The future is already here \u2014 it\u2019s just not evenly distributed.", author:"William Gibson" },
  { type:"quote", id:"q11", text:"Architecture is frozen music.", author:"Schopenhauer" },
  { type:"quote", id:"q12", text:"Less is more.", author:"Mies van der Rohe" },
  { type:"quote", id:"q13", text:"The most important decisions are not what to do, but what not to do.", author:"Steve Jobs" },
  { type:"quote", id:"q14", text:"Simplicity is the consequence of refined emotions.", author:"Jean d\u2019Alembert" },
  { type:"quote", id:"q15", text:"Every tool is a weapon if you hold it right.", author:"Ani DiFranco" },
  { type:"quote", id:"q16", text:"You can\u2019t use up creativity. The more you use, the more you have.", author:"Maya Angelou" },
  { type:"quote", id:"q17", text:"The role of the designer is that of a good, thoughtful host anticipating the needs of guests.", author:"Charles Eames" },
  { type:"quote", id:"q18", text:"Whoever controls the media controls the mind.", author:"Jim Morrison" },
];
function generateEmbedding(image, domain) {
  const base = [...(DOMAIN_BASE[domain] || new Array(12).fill(0))];
  const tags = (image.tags || []).map(t => (t.title || "").toLowerCase());
  const altWords = (image.alt_description || "").toLowerCase().split(/\s+/);
  const allTerms = [...tags, ...altWords];
  allTerms.forEach(term => {
    if (TAG_MAP[term]) {
      const [dim, val] = TAG_MAP[term];
      base[dim] = Math.max(-1, Math.min(1, base[dim] + val * 0.25));
    }
  });
  // Color-informed dims
  if (image.color) {
    const hex = image.color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    base[0] = Math.max(-1, Math.min(1, (r - b) * 0.6 + base[0] * 0.4));
    base[3] = Math.max(-1, Math.min(1, (r + g + b) / 3 * 2 - 1));
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    base[5] = Math.max(-1, Math.min(1, sat * 2 - 0.5 + base[5] * 0.4));
  }
  const mag = Math.sqrt(base.reduce((s, x) => s + x * x, 0)) || 1;
  return base.map(x => x / mag);
}
function cosineSimilarity(a, b) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const magB = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return dot / (magA * magB + 1e-8);
}
function computeCentroid(embeddings) {
  if (!embeddings.length) return null;
  const sum = new Array(12).fill(0);
  embeddings.forEach(e => e.forEach((v, i) => { sum[i] += v; }));
  const avg = sum.map(v => v / embeddings.length);
  const mag = Math.sqrt(avg.reduce((s, x) => s + x * x, 0)) || 1;
  return avg.map(x => x / mag);
}
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDailyFeed(seenIds = new Set()) {
  const today = new Date().toISOString().split("T")[0];
  const seed = today.split("-").reduce((acc, n) => acc * 31 + parseInt(n), 7);
  const byType = { idea:[], reference:[], contrast:[], quote:[] };
  TRAINING_CARDS.forEach(c => { if (!seenIds.has(c.id)) byType[c.type]?.push(c); });
  const feed = [
    ...seededShuffle(byType.idea,      seed    ).slice(0,5),
    ...seededShuffle(byType.reference, seed+1  ).slice(0,5),
    ...seededShuffle(byType.contrast,  seed+2  ).slice(0,5),
    ...seededShuffle(byType.quote,     seed+3  ).slice(0,5),
  ];
  return seededShuffle(feed, seed+4);
}
function buildExportProfile(tasteProfile, likedImages, images) {
  const domainCounts = {};
  likedImages.forEach(img => {
    domainCounts[img.domain] = (domainCounts[img.domain] || 0) + 1;
  });
  const total = likedImages.length || 1;
  const domainAffinities = Object.fromEntries(
    Object.entries(domainCounts).map(([k, v]) => [k, parseFloat((v / total).toFixed(2))])
  );

  const dimLabels = ["warmth","complexity","organic","brightness","texture","saturation","structural","natural","human","abstract","vintage","contemporary"];
  const styleFingerprint = {};
  if (tasteProfile) {
    tasteProfile.forEach((val, i) => {
      styleFingerprint[dimLabels[i]] = parseFloat(val.toFixed(3));
    });
  }

  // Generate plain-English summary from top dims
  const descriptions = [];
  if (tasteProfile) {
    const sorted = tasteProfile.map((v, i) => ({ dim: dimLabels[i], val: v })).sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
    const top = sorted.slice(0, 3);
    top.forEach(({ dim, val }) => {
      const map = {
        warmth:       val > 0 ? "warm tonal ranges" : "cool, restrained palettes",
        complexity:   val > 0 ? "layered, dense compositions" : "minimal, stripped-back forms",
        organic:      val > 0 ? "organic, natural shapes" : "geometric precision",
        brightness:   val > 0 ? "bright, airy spaces" : "dark, moody atmospheres",
        texture:      val > 0 ? "raw texture and materiality" : "smooth, polished surfaces",
        saturation:   val > 0 ? "vibrant, saturated color" : "muted, desaturated tones",
        structural:   val > 0 ? "strong architectural structure" : "fluid, unstructured forms",
        natural:      val > 0 ? "the natural world" : "built environments",
        human:        val > 0 ? "human presence and portraiture" : "absence of the human figure",
        abstract:     val > 0 ? "abstract and conceptual work" : "representational imagery",
        vintage:      val > 0 ? "analog, vintage aesthetics" : "clean contemporary forms",
        contemporary: val > 0 ? "modern, contemporary design" : "timeless, classical sensibility",
      };
      if (map[dim]) descriptions.push(map[dim]);
    });
  }
  const topDomains = Object.entries(domainAffinities).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k.replace("_", " "));

  const summary = descriptions.length
    ? `Drawn to ${descriptions.join(", ")}. Primary domains: ${topDomains.join(" and ")}.`
    : "Still building your aesthetic profile.";

  return {
    version: "1.0",
    generated: new Date().toISOString().split("T")[0],
    source: "taste-engine",
    embedding_centroid: tasteProfile ? tasteProfile.map(v => parseFloat(v.toFixed(4))) : null,
    domain_affinities: domainAffinities,
    style_fingerprint: styleFingerprint,
    aesthetic_summary: summary,
    liked_count: likedImages.length,
  };
}
// ─── Unsplash API ─────────────────────────────────────────────────────────────
async function fetchUnsplashImages(domain, page = 1) {
  const d = DOMAINS.find(x => x.id === domain);
  if (!d) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(d.query)}&page=${page}&per_page=${IMAGES_PER_FETCH}&orientation=squarish`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const data = await res.json();
  return data.results.map(img => ({
    id: img.id,
    url: img.urls.small,
    fullUrl: img.urls.regular,
    thumb: img.urls.thumb,
    color: img.color,
    description: img.alt_description || img.description || "",
    photographer: img.user?.name || "",
    domain,
    tags: img.tags || [],
    embedding: generateEmbedding(img, domain),
    liked: false,
    source: "unsplash",
    unsplashLink: img.links?.html,
  }));
}
// ─── Storage ──────────────────────────────────────────────────────────────────
const LS_KEY = "taste-engine-v2";
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function saveState(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
// ─── Sub-components ───────────────────────────────────────────────────────────
function SkeletonCard({ height = 200 }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      borderRadius: 12, height,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}
function ImageCard({ image, onLike, matchScore, isNew }) {
  const [loaded, setLoaded] = useState(false);
  const [hover, setHover] = useState(false);
  const accent = ACCENT[image.domain];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", borderRadius: 12, overflow: "hidden",
        background: image.color || "#1E1E2E",
        transform: hover ? "scale(1.015)" : "scale(1)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: hover ? "0 12px 40px rgba(0,0,0,0.6)" : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <img
        src={image.url} alt={image.description}
        onLoad={() => setLoaded(true)}
        style={{ width: "100%", display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
      />
      {!loaded && <div style={{ position: "absolute", inset: 0, background: image.color || "#1E1E2E" }} />}
      {/* Hover overlay */}
      {hover && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 55%)",
        }}>
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: accent + "28", border: `1px solid ${accent}55`,
            borderRadius: 6, padding: "2px 8px",
            fontSize: 11, color: accent, fontFamily: "monospace", letterSpacing: "0.05em",
          }}>
            {DOMAINS.find(d => d.id === image.domain)?.label}
          </div>
          {matchScore !== undefined && (
            <div style={{
              position: "absolute", top: 8, right: 44,
              background: "rgba(0,0,0,0.75)", borderRadius: 6, padding: "2px 8px",
              fontSize: 11, fontFamily: "monospace",
              color: matchScore > 0.7 ? "#69F0AE" : matchScore > 0.4 ? "#FFB74D" : "#E0E0E0",
            }}>
              {Math.round(matchScore * 100)}%
            </div>
          )}
          <div style={{
            position: "absolute", bottom: 10, left: 10,
            fontSize: 11, color: "rgba(255,255,255,0.5)",
          }}>
            {image.photographer}
          </div>
        </div>
      )}
      {/* Like button */}
      <button
        onClick={e => { e.stopPropagation(); onLike(image.id); }}
        style={{
          position: "absolute", top: 8, right: 8,
          width: 34, height: 34, borderRadius: "50%", border: "none",
          background: image.liked ? accent : "rgba(0,0,0,0.55)",
          color: image.liked ? "#000" : "#fff",
          fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hover || image.liked ? 1 : 0,
          transition: "opacity 0.2s, background 0.2s, transform 0.15s",
          transform: image.liked ? "scale(1.15)" : "scale(1)",
        }}
      >
        {image.liked ? "♥" : "♡"}
      </button>
      {isNew && (
        <div style={{
          position: "absolute", bottom: 8, left: 8,
          background: "#BB86FC", borderRadius: 4,
          padding: "1px 6px", fontSize: 10, color: "#000", fontWeight: 700, letterSpacing: "0.08em",
        }}>NEW</div>
      )}
    </div>
  );
}
// ─── Training Components ──────────────────────────────────────────────────────
function SignalButtons({ signal, onSignal, color="#BB86FC" }) {
  const btns = [
    { val:"pass", label:"\u2014", flex:1 },
    { val:"like", label:"\u2665", flex:2 },
    { val:"strong", label:"\u2726", flex:1 },
  ];
  return (
    <div style={{ display:"flex", gap:10 }}>
      {btns.map(b => (
        <button key={b.val} onClick={() => onSignal(b.val)} style={{
          flex:b.flex, padding:"12px 0",
          background: signal===b.val ? color+"22" : "rgba(255,255,255,0.03)",
          border:`1px solid ${signal===b.val ? color+"66" : "rgba(255,255,255,0.07)"}`,
          borderRadius:10, cursor:"pointer",
          color: signal===b.val ? color : "rgba(255,255,255,0.3)",
          fontSize:18, fontWeight:b.val==="strong"?700:400,
          transition:"all 0.15s",
        }}>{b.label}</button>
      ))}
    </div>
  );
}

function IdeaCard({ card, signal, onSignal }) {
  const catColor = { craft:"#03DAC6", thinking:"#BB86FC", work:"#69F0AE", values:"#F48FB1" };
  const color = catColor[card.category] || "#BB86FC";
  return (
    <div style={{
      background:"#1E1E2E", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:"32px 24px", position:"relative", overflow:"hidden",
    }}>
      <div style={{
        position:"absolute", top:-40, right:-40, width:140, height:140,
        borderRadius:"50%", background:color+"10", filter:"blur(40px)", pointerEvents:"none",
      }}/>
      <div style={{ fontSize:11, letterSpacing:"0.12em", color, marginBottom:20, textTransform:"uppercase" }}>
        {card.category}
      </div>
      <div style={{ fontSize:22, fontWeight:600, lineHeight:1.4, color:"#E0E0E0", marginBottom:32, letterSpacing:"-0.02em" }}>
        {card.text}
      </div>
      <SignalButtons signal={signal} onSignal={onSignal} color={color} />
    </div>
  );
}

function ReferenceCard({ card, signal, onSignal }) {
  const accent = ACCENT[card.domain] || "#BB86FC";
  const d = DOMAINS.find(x => x.id === card.domain);
  return (
    <div style={{
      background:"#1E1E2E", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:"28px 24px", position:"relative", overflow:"hidden",
    }}>
      <div style={{
        position:"absolute", bottom:-20, right:-20, width:120, height:120,
        borderRadius:"50%", background:accent+"12", filter:"blur(30px)", pointerEvents:"none",
      }}/>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ fontSize:11, letterSpacing:"0.1em", color:accent }}>
          {d?.emoji} {d?.label?.toUpperCase()}
        </div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:"0.08em" }}>REFERENCE</div>
      </div>
      <div style={{ fontSize:26, fontWeight:700, color:"#E0E0E0", marginBottom:6, letterSpacing:"-0.02em" }}>
        {card.name}
      </div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>{card.descriptor}</div>
      {card.note && (
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", fontStyle:"italic", marginBottom:28 }}>
          "{card.note}"
        </div>
      )}
      <SignalButtons signal={signal} onSignal={onSignal} color={accent} />
    </div>
  );
}

function ContrastCard({ card, signal, onSignal }) {
  const opts = [
    { key:"A", label:card.optionA, color:"#BB86FC" },
    { key:"B", label:card.optionB, color:"#03DAC6" },
  ];
  return (
    <div style={{
      background:"#1E1E2E", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:"28px 24px",
    }}>
      <div style={{ fontSize:11, letterSpacing:"0.12em", color:"rgba(255,255,255,0.3)", marginBottom:24, textTransform:"uppercase" }}>
        Which pulls you?
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {opts.map(opt => (
          <button key={opt.key} onClick={() => onSignal(opt.key)} style={{
            padding:"28px 16px",
            background: signal===opt.key ? opt.color+"18" : "rgba(255,255,255,0.03)",
            border:`1px solid ${signal===opt.key ? opt.color+"66" : "rgba(255,255,255,0.08)"}`,
            borderRadius:12, cursor:"pointer",
            color: signal===opt.key ? opt.color : "rgba(255,255,255,0.5)",
            fontSize:20, fontWeight:700, letterSpacing:"-0.02em",
            transition:"all 0.2s",
            transform: signal===opt.key ? "scale(1.02)" : "scale(1)",
          }}>{opt.label}</button>
        ))}
      </div>
      {signal && (
        <div style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.25)" }}>
          {signal==="A" ? card.optionA : card.optionB} resonates
        </div>
      )}
    </div>
  );
}

function QuoteCard({ card, signal, onSignal }) {
  return (
    <div style={{
      background:"#1E1E2E", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:"32px 24px", position:"relative", overflow:"hidden",
    }}>
      <div style={{
        position:"absolute", top:16, left:20, fontSize:80,
        color:"rgba(187,134,252,0.06)", fontFamily:"Georgia, serif",
        lineHeight:1, pointerEvents:"none", userSelect:"none",
      }}>"</div>
      <div style={{ fontSize:10, letterSpacing:"0.14em", color:"rgba(255,255,255,0.2)", marginBottom:20, textTransform:"uppercase" }}>
        Quote
      </div>
      <div style={{ fontSize:18, lineHeight:1.65, color:"#E0E0E0", fontStyle:"italic", marginBottom:20, position:"relative", zIndex:1 }}>
        {card.text}
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:28, letterSpacing:"0.04em" }}>
        {"\u2014"} {card.author}
      </div>
      <SignalButtons signal={signal} onSignal={onSignal} color="#BB86FC" />
    </div>
  );
}

function TrainingCard({ card, signal, onSignal }) {
  const props = { card, signal, onSignal };
  if (card.type==="idea")      return <IdeaCard {...props} />;
  if (card.type==="reference") return <ReferenceCard {...props} />;
  if (card.type==="contrast")  return <ContrastCard {...props} />;
  if (card.type==="quote")     return <QuoteCard {...props} />;
  return null;
}

function FeedComplete({ feed, signals }) {
  const liked = feed.filter(c => ["like","strong","A","B"].includes(signals[c.id]?.value)).length;
  const strong = feed.filter(c => signals[c.id]?.value === "strong").length;
  return (
    <div style={{ padding:"80px 24px", textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:16 }}>\u2726</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:8, color:"#E0E0E0" }}>Feed complete</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.7, marginBottom:32 }}>
        {liked} signals recorded today.
        {strong > 0 && <><br />{strong} strong {strong===1?"resonance":"resonances"}.</>}
      </div>
      <div style={{
        background:"rgba(187,134,252,0.08)", border:"1px solid rgba(187,134,252,0.2)",
        borderRadius:12, padding:"14px 20px",
        fontSize:13, color:"rgba(255,255,255,0.4)",
      }}>
        Come back tomorrow for a new feed
      </div>
    </div>
  );
}

function TrainingFeed({ trainingSignals, onSignal }) {
  const today = new Date().toISOString().split("T")[0];
  const [feed] = useState(() => {
    const seenIds = new Set(
      Object.entries(trainingSignals)
        .filter(([,s]) => s.date === today)
        .map(([id]) => id)
    );
    return generateDailyFeed(seenIds);
  });

  const completed = feed.filter(c => trainingSignals[c.id]?.date === today).length;
  const total = feed.length;

  if (completed === total) return <FeedComplete feed={feed} signals={trainingSignals} />;

  return (
    <div style={{ padding:"16px 12px 100px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#E0E0E0" }}>Today's Training</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontFamily:"monospace" }}>{completed}/{total}</div>
        </div>
        <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
          <div style={{
            height:"100%", borderRadius:2,
            background:"linear-gradient(90deg, #BB86FC, #03DAC6)",
            width:`${(completed/total)*100}%`, transition:"width 0.4s ease",
          }}/>
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:8 }}>{today}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {feed.map(card => (
          <TrainingCard
            key={card.id}
            card={card}
            signal={trainingSignals[card.id]?.value}
            onSignal={val => onSignal(card.id, val, card)}
          />
        ))}
      </div>
    </div>
  );
}
function AestheticDNA({ tasteProfile, likedImages, images }) {
  const [copied, setCopied] = useState(false);
  const profile = buildExportProfile(tasteProfile, likedImages, images);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taste-profile-${profile.generated}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "16px 16px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 6 }}>
          AESTHETIC DNA
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6,
          background: "rgba(187,134,252,0.06)", border: "1px solid rgba(187,134,252,0.15)",
          borderRadius: 10, padding: "12px 14px",
        }}>
          {profile.aesthetic_summary}
        </div>
      </div>

      {/* Domain affinities */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 10 }}>
          DOMAIN AFFINITIES
        </div>
        {Object.entries(profile.domain_affinities).sort((a, b) => b[1] - a[1]).map(([domain, score]) => {
          const d = DOMAINS.find(x => x.id === domain);
          const accent = ACCENT[domain];
          return (
            <div key={domain} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: "#E0E0E0" }}>{d?.emoji} {d?.label}</span>
                <span style={{ color: accent, fontFamily: "monospace" }}>{Math.round(score * 100)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", borderRadius: 2, background: accent,
                  width: `${score * 100}%`, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Style fingerprint — top 6 dims */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 10 }}>
          STYLE FINGERPRINT
        </div>
        {Object.entries(profile.style_fingerprint).slice(0, 6).map(([dim, val]) => {
          const pct = (val + 1) / 2 * 100;
          return (
            <div key={dim} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{dim}</span>
                <span style={{ color: val > 0 ? "#BB86FC" : "#03DAC6", fontFamily: "monospace", fontSize: 11 }}>
                  {val > 0 ? "+" : ""}{val.toFixed(2)}
                </span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative" }}>
                <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 5, background: "rgba(255,255,255,0.15)" }} />
                <div style={{
                  height: "100%", borderRadius: 2,
                  marginLeft: val >= 0 ? "50%" : `${pct}%`,
                  width: `${Math.abs(val) * 50}%`,
                  background: val >= 0 ? "#BB86FC" : "#03DAC6",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw JSON preview */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 8 }}>
          EXPORT SCHEMA · v{profile.version}
        </div>
        <pre style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: 12, fontSize: 10.5, color: "rgba(255,255,255,0.45)",
          fontFamily: "monospace", lineHeight: 1.6, overflowX: "auto",
          maxHeight: 180, overflowY: "auto",
        }}>
          {JSON.stringify({ ...profile, embedding_centroid: "[512 dims...]" }, null, 2)}
        </pre>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCopy} style={{
          flex: 1, padding: "12px 0",
          background: copied ? "rgba(105,240,174,0.15)" : "rgba(187,134,252,0.12)",
          border: `1px solid ${copied ? "#69F0AE55" : "#BB86FC44"}`,
          borderRadius: 10, cursor: "pointer",
          color: copied ? "#69F0AE" : "#BB86FC",
          fontSize: 13, fontWeight: 600, transition: "all 0.2s",
        }}>
          {copied ? "\u2713 Copied" : "Copy JSON"}
        </button>
        <button onClick={handleDownload} style={{
          flex: 1, padding: "12px 0",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, cursor: "pointer",
          color: "rgba(255,255,255,0.6)", fontSize: 13,
        }}>
          Download
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", lineHeight: 1.5 }}>
        This profile syncs to Duet when connected.<br />Schema version 1.0
      </div>
    </div>
  );
}
function TastePanel({ tasteProfile, likedImages, images }) {
  const [view, setView] = useState("profile");
  if (!tasteProfile) {
    const remaining = Math.max(0, LIKES_FOR_PROFILE - likedImages.length);
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>◎</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#E0E0E0" }}>Building your profile</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
          Like {remaining} more image{remaining !== 1 ? "s" : ""} to activate
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {Array.from({ length: LIKES_FOR_PROFILE }).map((_, i) => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: "50%",
              background: i < likedImages.length ? "#BB86FC" : "rgba(255,255,255,0.15)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>
    );
  }
  const domainCounts = {};
  likedImages.forEach(img => { domainCounts[img.domain] = (domainCounts[img.domain] || 0) + 1; });
  const maxCount = Math.max(...Object.values(domainCounts), 1);
  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  const dims = [
    { label: "Warmth",     neg: "Cool",       pos: "Warm"      },
    { label: "Complexity", neg: "Minimal",     pos: "Dense"     },
    { label: "Form",       neg: "Geometric",   pos: "Organic"   },
    { label: "Light",      neg: "Dark",        pos: "Bright"    },
    { label: "Texture",    neg: "Smooth",      pos: "Textured"  },
    { label: "Saturation", neg: "Muted",       pos: "Vibrant"   },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Panel tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        {[{ id: "profile", label: "Profile" }, { id: "dna", label: "Aesthetic DNA" }].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            flex: 1, padding: "11px 0", background: "transparent", border: "none",
            color: view === t.id ? "#BB86FC" : "rgba(255,255,255,0.35)",
            fontSize: 12, fontWeight: view === t.id ? 600 : 400, cursor: "pointer",
            borderBottom: `2px solid ${view === t.id ? "#BB86FC" : "transparent"}`,
            transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "profile" ? (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 18 }}>
              TASTE PROFILE · {likedImages.length} LIKES
            </div>
            {/* Domain affinity */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 10 }}>DOMAIN AFFINITY</div>
              {sortedDomains.map(([domain, count]) => {
                const accent = ACCENT[domain];
                const d = DOMAINS.find(x => x.id === domain);
                return (
                  <div key={domain} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: "#E0E0E0" }}>{d?.emoji} {d?.label}</span>
                      <span style={{ color: "rgba(255,255,255,0.35)" }}>{count}</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
                      <div style={{
                        height: "100%", borderRadius: 2, background: accent,
                        width: `${(count / maxCount) * 100}%`, transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Style fingerprint */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 10 }}>STYLE FINGERPRINT</div>
              {dims.map((dim, i) => {
                const val = tasteProfile[i];
                const label = val > 0.3 ? dim.pos : val < -0.3 ? dim.neg : "Balanced";
                const pct = (val + 1) / 2 * 100;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>{dim.label}</span>
                      <span style={{ color: "#BB86FC", fontSize: 11 }}>{label}</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative" }}>
                      <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 5, background: "rgba(255,255,255,0.2)" }} />
                      <div style={{
                        height: "100%", borderRadius: 2,
                        marginLeft: val >= 0 ? "50%" : `${pct}%`,
                        width: `${Math.abs(val) * 50}%`,
                        background: val >= 0 ? "#BB86FC" : "#03DAC6",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Liked grid */}
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 10 }}>
                LIKED ({likedImages.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {likedImages.map(img => (
                  <img key={img.id} src={img.thumb || img.url} alt="" style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 6, display: "block",
                  }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AestheticDNA tasteProfile={tasteProfile} likedImages={likedImages} images={images} />
        )}
      </div>
    </div>
  );
}
function AddReferenceModal({ onAdd, onClose }) {
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("architecture");
  const [showPreview, setShowPreview] = useState(false);
  const handleAdd = () => {
    if (!url.trim()) return;
    onAdd({ url: url.trim(), domain });
    onClose();
  };
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1A1A2E", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#E0E0E0", marginBottom: 4 }}>Add Reference Image</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
          Paste any image URL to shift your taste profile
        </div>
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setShowPreview(!!e.target.value); }}
          placeholder="https://..."
          autoFocus
          style={{
            width: "100%", padding: "12px 14px", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#E0E0E0", fontSize: 14, outline: "none",
            fontFamily: "monospace", marginBottom: 12,
          }}
        />
        {showPreview && url && (
          <img src={url} alt="preview" style={{
            width: "100%", height: 150, objectFit: "cover",
            borderRadius: 10, marginBottom: 12, border: "1px solid rgba(255,255,255,0.08)",
          }} onError={() => setShowPreview(false)} />
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 8 }}>DOMAIN</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {DOMAINS.map(d => (
              <button key={d.id} onClick={() => setDomain(d.id)} style={{
                padding: "8px 4px",
                background: domain === d.id ? ACCENT[d.id] + "20" : "rgba(255,255,255,0.04)",
                border: `1px solid ${domain === d.id ? ACCENT[d.id] : "rgba(255,255,255,0.1)"}`,
                borderRadius: 8, cursor: "pointer", textAlign: "center",
                color: domain === d.id ? ACCENT[d.id] : "rgba(255,255,255,0.45)",
                fontSize: 10,
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{d.emoji}</div>
                {d.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 13, background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
            color: "rgba(255,255,255,0.5)", fontSize: 15, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={!url.trim()} style={{
            flex: 1, padding: 13, background: url.trim() ? "#BB86FC" : "rgba(187,134,252,0.2)",
            border: "none", borderRadius: 10,
            color: url.trim() ? "#000" : "rgba(255,255,255,0.3)",
            fontSize: 15, fontWeight: 600, cursor: url.trim() ? "pointer" : "default",
            transition: "all 0.2s",
          }}>Add to Profile</button>
        </div>
      </div>
    </div>
  );
}
// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TasteEngine() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pageMap, setPageMap] = useState({});
  const [tasteProfile, setTasteProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("discover");
  const [activeDomain, setActiveDomain] = useState("all");
  const [columns, setColumns] = useState(2);
  const [showAddRef, setShowAddRef] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [newImageIds, setNewImageIds] = useState(new Set());
  const [trainingSignals, setTrainingSignals] = useState({});
  const loaderRef = useRef(null);
  const domainRotateRef = useRef(0);
  const likedImages = images.filter(img => img.liked);
  // Restore from storage
  useEffect(() => {
    const saved = loadState();
    if (saved.images?.length) {
      setImages(saved.images);
      if (saved.pageMap) setPageMap(saved.pageMap);
    }
    if (saved.tasteProfile) setTasteProfile(saved.tasteProfile);
    if (saved.columns) setColumns(saved.columns);
    if (saved.trainingSignals) setTrainingSignals(saved.trainingSignals);
  }, []);
  // Initial load if empty
  useEffect(() => {
    if (images.length === 0) loadAllDomains();
  }, []);
  // Rebuild taste profile on likes change
  useEffect(() => {
    const liked = images.filter(img => img.liked);
    if (liked.length >= LIKES_FOR_PROFILE) {
      setTasteProfile(computeCentroid(liked.map(img => img.embedding)));
    } else {
      setTasteProfile(null);
    }
  }, [images]);
  // Persist
  useEffect(() => {
    if (images.length > 0) saveState({ images, tasteProfile, columns, pageMap, trainingSignals });
  }, [images, tasteProfile, columns, trainingSignals]);
  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loadingMore) loadMore(); },
      { rootMargin: "300px" }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [loadingMore, activeDomain, images.length]);
  async function loadAllDomains() {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(DOMAINS.map(d => fetchUnsplashImages(d.id, 1)));
      const all = results.flat().sort(() => Math.random() - 0.5);
      setImages(all);
      setPageMap(Object.fromEntries(DOMAINS.map(d => [d.id, 1])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      // Round-robin through domains
      const domainList = activeDomain === "all" ? DOMAINS.map(d => d.id) : [activeDomain];
      const domain = domainList[domainRotateRef.current % domainList.length];
      domainRotateRef.current++;
      const nextPage = (pageMap[domain] || 1) + 1;
      const newImgs = await fetchUnsplashImages(domain, nextPage);
      const existingIds = new Set(images.map(i => i.id));
      const fresh = newImgs.filter(img => !existingIds.has(img.id));
      if (fresh.length) {
        setImages(prev => [...prev, ...fresh]);
        setNewImageIds(new Set(fresh.map(i => i.id)));
        setPageMap(prev => ({ ...prev, [domain]: nextPage }));
        setTimeout(() => setNewImageIds(new Set()), 3000);
      }
    } catch {
      // Silent fail — don't break the feed
    } finally {
      setLoadingMore(false);
    }
  }
  function handleLike(id) {
    setImages(prev => prev.map(img => img.id === id ? { ...img, liked: !img.liked } : img));
  }
  function handleAddReference({ url, domain }) {
    const base = DOMAIN_BASE[domain] || new Array(12).fill(0);
    const mag = Math.sqrt(base.reduce((s, x) => s + x * x, 0)) || 1;
    setImages(prev => [{
      id: `ref-${Date.now()}`,
      url, fullUrl: url, thumb: url,
      color: "#1E1E2E",
      description: "Reference image",
      photographer: "You",
      domain, tags: [],
      embedding: base.map(x => x / mag),
      liked: true,
      source: "reference",
    }, ...prev]);
  }
  function handleTrainingSignal(cardId, value, card) {
    const today = new Date().toISOString().split("T")[0];
    setTrainingSignals(prev => ({
      ...prev,
      [cardId]: { value, date: today, timestamp: Date.now() },
    }));
    // Contrast cards directly nudge the taste centroid
    if (card.type === "contrast" && tasteProfile) {
      const val = value === "A" ? card.aVal : card.bVal;
      const nudged = tasteProfile.map((v, i) =>
        i === card.dim ? Math.max(-1, Math.min(1, v + val * 0.15)) : v
      );
      const mag = Math.sqrt(nudged.reduce((s, x) => s + x*x, 0)) || 1;
      setTasteProfile(nudged.map(x => x / mag));
    }
  }
  // Feed logic
  const displayedImages = (() => {
    let imgs = images.filter(img => activeDomain === "all" || img.domain === activeDomain);
    if (activeTab === "foryou") {
      if (!tasteProfile) return [];
      return imgs
        .map(img => ({ ...img, matchScore: cosineSimilarity(img.embedding, tasteProfile) }))
        .sort((a, b) => b.matchScore - a.matchScore);
    }
    return imgs;
  })();
  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0A", color: "#E0E0E0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        input, button { font-family: inherit; }
        input::placeholder { color: rgba(255,255,255,0.28); }
        ::-webkit-scrollbar-horizontal { display: none; }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,10,0.92)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>◎</span>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em" }}>Taste Engine</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Column control */}
            <div style={{ display: "flex", gap: 4 }}>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setColumns(n)} style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: columns === n ? "rgba(187,134,252,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${columns === n ? "#BB86FC55" : "rgba(255,255,255,0.08)"}`,
                  color: columns === n ? "#BB86FC" : "rgba(255,255,255,0.35)",
                  fontSize: 11, cursor: "pointer", fontWeight: 600,
                }}>{n}</button>
              ))}
            </div>
            <button onClick={() => setShowAddRef(true)} style={{
              height: 34, padding: "0 12px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9, color: "#E0E0E0", fontSize: 13, cursor: "pointer",
            }}>+ Ref</button>
            <button onClick={() => setShowPanel(!showPanel)} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: tasteProfile
                ? (showPanel ? "#BB86FC" : "rgba(187,134,252,0.25)")
                : "rgba(255,255,255,0.05)",
              border: `2px solid ${tasteProfile ? "#BB86FC66" : "rgba(255,255,255,0.1)"}`,
              color: tasteProfile ? (showPanel ? "#000" : "#BB86FC") : "#E0E0E0",
              fontSize: 15, cursor: "pointer", transition: "all 0.2s",
            }}>
              {tasteProfile ? "✦" : "○"}
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 8px" }}>
          {[
            { id: "discover", label: "Discover" },
            { id: "foryou", label: "For You" },
            { id: "train", label: "Train" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 14px", background: "transparent", border: "none",
              color: activeTab === tab.id ? "#BB86FC" : "rgba(255,255,255,0.4)",
              fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400, cursor: "pointer",
              borderBottom: `2px solid ${activeTab === tab.id ? "#BB86FC" : "transparent"}`,
              transition: "all 0.2s",
            }}>
              {tab.label}
              {tab.id === "foryou" && tasteProfile && (
                <span style={{
                  marginLeft: 6, background: "#BB86FC", borderRadius: 10,
                  padding: "1px 5px", fontSize: 10, color: "#000", fontWeight: 700,
                }}>✦</span>
              )}
            </button>
          ))}
        </div>
        {/* Domain pills */}
        <div style={{
          display: "flex", gap: 6, overflowX: "auto", padding: "8px 12px",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          <button onClick={() => setActiveDomain("all")} style={{
            flexShrink: 0, padding: "5px 12px",
            background: activeDomain === "all" ? "rgba(187,134,252,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${activeDomain === "all" ? "#BB86FC66" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 20, color: activeDomain === "all" ? "#BB86FC" : "rgba(255,255,255,0.45)",
            fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
          }}>All</button>
          {DOMAINS.map(d => (
            <button key={d.id} onClick={() => setActiveDomain(d.id)} style={{
              flexShrink: 0, padding: "5px 12px",
              background: activeDomain === d.id ? ACCENT[d.id] + "20" : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeDomain === d.id ? ACCENT[d.id] + "66" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 20, color: activeDomain === d.id ? ACCENT[d.id] : "rgba(255,255,255,0.45)",
              fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
            }}>{d.emoji} {d.label}</button>
          ))}
        </div>
      </div>
      {/* ── Body ── */}
      <div style={{ display: "flex" }}>
        {/* Feed */}
        <div style={{ flex: 1, padding: "10px 10px 100px", minWidth: 0 }}>
          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(255,82,82,0.08)", border: "1px solid rgba(255,82,82,0.25)",
              borderRadius: 12, padding: "14px 16px", marginBottom: 12,
              color: "#FF6B6B", fontSize: 13,
            }}>
              ⚠ {error} — Check your Unsplash API key.
            </div>
          )}
          {/* Training Feed */}
          {activeTab === "train" && (
            <TrainingFeed trainingSignals={trainingSignals} onSignal={handleTrainingSignal} />
          )}
          {activeTab !== "train" && (
            <>
              {/* For You locked */}
              {activeTab === "foryou" && !tasteProfile && (
                <div style={{ textAlign: "center", padding: "80px 24px" }}>
                  <div style={{ fontSize: 44, marginBottom: 16 }}>◎</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Unlock Your Feed</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, lineHeight: 1.6 }}>
                    Like {LIKES_FOR_PROFILE} images in Discover<br />to activate your personalized feed
                  </div>
                </div>
              )}
              {/* Skeleton loading */}
              {loading && (
                <div style={{ columnCount: columns, columnGap: 8 }}>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} style={{ marginBottom: 8, breakInside: "avoid" }}>
                      <SkeletonCard height={[200, 260, 170, 230, 190, 280][i % 6]} />
                    </div>
                  ))}
                </div>
              )}
              {/* Grid */}
              {!loading && displayedImages.length > 0 && (
                <div style={{ columnCount: columns, columnGap: 8 }}>
                  {displayedImages.map(img => (
                    <div key={img.id} style={{ marginBottom: 8, breakInside: "avoid" }}>
                      <ImageCard
                        image={img}
                        onLike={handleLike}
                        matchScore={img.matchScore}
                        isNew={newImageIds.has(img.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {/* Infinite scroll trigger */}
              <div ref={loaderRef} style={{
                height: 48, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {loadingMore && (
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, letterSpacing: "0.08em" }}>
                    LOADING MORE
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {/* Taste panel — sticky sidebar */}
        {showPanel && (
          <div style={{
            width: 276, flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
            position: "sticky", top: 160,
            height: "calc(100vh - 160px)",
            overflowY: "auto",
          }}>
            <TastePanel tasteProfile={tasteProfile} likedImages={likedImages} images={images} />
          </div>
        )}
      </div>
      {/* Floating unlock progress */}
      {likedImages.length > 0 && !tasteProfile && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A2E", border: "1px solid rgba(187,134,252,0.35)",
          borderRadius: 28, padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          zIndex: 40, pointerEvents: "none",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: LIKES_FOR_PROFILE }).map((_, i) => (
              <div key={i} style={{
                width: 9, height: 9, borderRadius: "50%",
                background: i < likedImages.length ? "#BB86FC" : "rgba(255,255,255,0.12)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>
            {LIKES_FOR_PROFILE - likedImages.length} more to unlock For You
          </span>
        </div>
      )}
      {showAddRef && <AddReferenceModal onAdd={handleAddReference} onClose={() => setShowAddRef(false)} />}
    </div>
  );
}
