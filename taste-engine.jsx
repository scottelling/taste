import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ============================================================
// TASTE ENGINE CORE — Embedding math
// ============================================================
const EMBED_DIM = 12;

function cosineSim(a, b) {
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; mA += a[i]*a[i]; mB += b[i]*b[i]; }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) + 1e-8);
}

function centroid(vectors) {
  if (!vectors.length) return null;
  const sum = new Array(vectors[0].length).fill(0);
  vectors.forEach(v => v.forEach((x,i) => sum[i] += x));
  const mag = Math.sqrt(sum.reduce((s,x) => s + x*x, 0));
  return sum.map(x => x / (mag + 1e-8));
}

function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// DOMAIN & IMAGE DATA
// ============================================================
const DOMAINS = [
  { id: "all", label: "All", icon: "✦" },
  { id: "architecture", label: "Architecture", icon: "◻" },
  { id: "graphic-design", label: "Graphic Design", icon: "◈" },
  { id: "fashion", label: "Fashion", icon: "◇" },
  { id: "nature", label: "Nature", icon: "◉" },
  { id: "art", label: "Art", icon: "△" },
  { id: "film", label: "Film", icon: "▷" },
  { id: "product", label: "Product", icon: "○" },
  { id: "interiors", label: "Interiors", icon: "⬡" },
];

// Domain embedding signatures — each domain occupies a region of the embedding space
const DOMAIN_VECTORS = {
  "architecture": [0.8, -0.3, 0.5, -0.2, 0.1, 0.7, -0.4, 0.3, -0.1, 0.6, -0.5, 0.2],
  "graphic-design": [-0.2, 0.8, -0.3, 0.6, -0.5, 0.1, 0.7, -0.4, 0.3, -0.1, 0.5, -0.6],
  "fashion": [0.1, -0.5, 0.7, 0.3, 0.8, -0.2, -0.1, 0.6, -0.4, 0.2, -0.3, 0.5],
  "nature": [-0.6, 0.2, -0.1, 0.8, 0.3, -0.5, 0.4, 0.1, 0.7, -0.3, 0.6, -0.2],
  "art": [0.3, 0.5, -0.6, -0.1, 0.2, 0.8, -0.3, 0.7, -0.5, 0.4, -0.2, 0.1],
  "film": [-0.4, -0.1, 0.3, 0.5, -0.6, 0.2, 0.8, -0.2, 0.1, 0.7, -0.4, 0.6],
  "product": [0.5, 0.3, 0.2, -0.6, 0.4, -0.1, -0.5, 0.8, -0.3, 0.1, 0.7, -0.4],
  "interiors": [0.7, -0.4, 0.6, 0.1, -0.3, 0.5, -0.2, 0.4, 0.8, -0.6, 0.2, -0.1],
};

// Style sub-signatures that add variation within domains
const STYLE_OFFSETS = {
  "minimal": [0.3, 0.1, -0.2, -0.3, 0.1, 0.2, -0.1, 0.0, 0.2, -0.1, 0.1, -0.2],
  "bold": [-0.2, 0.3, 0.1, 0.2, 0.3, -0.1, 0.2, 0.1, -0.3, 0.2, -0.1, 0.3],
  "warm": [0.1, -0.1, 0.3, 0.2, 0.0, -0.2, 0.1, 0.3, 0.1, -0.2, 0.2, 0.0],
  "cold": [-0.1, 0.2, -0.3, 0.1, -0.2, 0.3, -0.1, -0.2, 0.0, 0.3, -0.2, 0.1],
  "dark": [0.2, -0.3, 0.0, -0.1, 0.2, 0.1, 0.3, -0.2, -0.1, 0.0, 0.3, -0.1],
  "organic": [-0.3, 0.0, 0.2, 0.3, -0.1, -0.2, 0.0, 0.2, 0.3, 0.1, -0.3, 0.2],
  "geometric": [0.2, 0.2, -0.1, -0.2, 0.3, 0.0, -0.3, 0.1, -0.2, 0.2, 0.1, -0.3],
  "textured": [0.0, -0.2, 0.1, 0.1, -0.3, 0.2, 0.1, -0.1, 0.2, -0.3, 0.0, 0.3],
  "editorial": [-0.1, 0.3, 0.2, 0.0, 0.1, -0.3, 0.2, 0.0, -0.1, 0.1, -0.2, 0.2],
  "raw": [0.1, -0.2, -0.1, 0.2, -0.2, 0.1, -0.2, 0.3, 0.0, -0.1, 0.2, -0.2],
};

function makeEmbedding(domain, styles, seed) {
  const r = mulberry32(seed);
  const base = [...DOMAIN_VECTORS[domain]];
  styles.forEach(s => {
    const off = STYLE_OFFSETS[s] || STYLE_OFFSETS.minimal;
    off.forEach((v, i) => base[i] += v * 0.4);
  });
  // Add noise
  base.forEach((_, i) => base[i] += (r() - 0.5) * 0.3);
  const mag = Math.sqrt(base.reduce((s, x) => s + x * x, 0));
  return base.map(x => x / mag);
}

// Curated image catalog — picsum IDs with domain assignments
// In production these come from the ingestion pipeline
function buildCatalog() {
  const items = [
    // Architecture
    { id: "a1", picsum: 1040, domain: "architecture", styles: ["bold", "geometric"], title: "Concrete Cathedral", creator: "Tadao Ando Studio", h: 380 },
    { id: "a2", picsum: 1048, domain: "architecture", styles: ["minimal", "cold"], title: "Glass Pavilion", creator: "SANAA", h: 320 },
    { id: "a3", picsum: 1031, domain: "architecture", styles: ["dark", "bold"], title: "Brutalist Tower", creator: "Zaha Hadid Architects", h: 420 },
    { id: "a4", picsum: 1015, domain: "architecture", styles: ["warm", "organic"], title: "Desert Dwelling", creator: "Studio KO", h: 340 },
    { id: "a5", picsum: 1036, domain: "architecture", styles: ["minimal", "geometric"], title: "Grid House", creator: "John Pawson", h: 360 },
    { id: "a6", picsum: 1044, domain: "architecture", styles: ["cold", "editorial"], title: "Nordic Library", creator: "Snøhetta", h: 300 },
    { id: "a7", picsum: 1038, domain: "architecture", styles: ["textured", "warm"], title: "Rammed Earth", creator: "Peter Zumthor", h: 380 },
    { id: "a8", picsum: 1067, domain: "architecture", styles: ["bold", "dark"], title: "Shadow Staircase", creator: "Aires Mateus", h: 440 },
    { id: "a9", picsum: 1018, domain: "architecture", styles: ["organic", "warm"], title: "Timber Frame", creator: "Kengo Kuma", h: 350 },
    { id: "a10", picsum: 1022, domain: "architecture", styles: ["geometric", "cold"], title: "Parametric Shell", creator: "BIG", h: 320 },

    // Graphic Design
    { id: "g1", picsum: 1047, domain: "graphic-design", styles: ["bold", "editorial"], title: "Swiss Grid", creator: "Josef Müller-Brockmann", h: 340 },
    { id: "g2", picsum: 1052, domain: "graphic-design", styles: ["minimal", "cold"], title: "Type Specimen", creator: "Norm Studio", h: 380 },
    { id: "g3", picsum: 1053, domain: "graphic-design", styles: ["bold", "geometric"], title: "Bauhaus Revival", creator: "Studio Feixen", h: 300 },
    { id: "g4", picsum: 1055, domain: "graphic-design", styles: ["dark", "editorial"], title: "Noir Poster", creator: "Non-Format", h: 420 },
    { id: "g5", picsum: 1057, domain: "graphic-design", styles: ["warm", "textured"], title: "Risograph Layers", creator: "Hey Studio", h: 360 },
    { id: "g6", picsum: 1058, domain: "graphic-design", styles: ["minimal", "geometric"], title: "Monogram System", creator: "Pentagram", h: 320 },
    { id: "g7", picsum: 1059, domain: "graphic-design", styles: ["raw", "bold"], title: "Punk Zine", creator: "David Carson", h: 400 },
    { id: "g8", picsum: 1060, domain: "graphic-design", styles: ["cold", "minimal"], title: "Identity System", creator: "Spin Studio", h: 340 },
    { id: "g9", picsum: 1061, domain: "graphic-design", styles: ["warm", "organic"], title: "Hand Lettering", creator: "Jessica Hische", h: 380 },
    { id: "g10", picsum: 1062, domain: "graphic-design", styles: ["editorial", "dark"], title: "Editorial Spread", creator: "Matt Willey", h: 360 },

    // Fashion
    { id: "f1", picsum: 1005, domain: "fashion", styles: ["dark", "editorial"], title: "Shadow Drape", creator: "Rick Owens", h: 440 },
    { id: "f2", picsum: 1006, domain: "fashion", styles: ["minimal", "cold"], title: "Clean Lines", creator: "Jil Sander", h: 360 },
    { id: "f3", picsum: 1009, domain: "fashion", styles: ["bold", "warm"], title: "Street Layer", creator: "Aimé Leon Dore", h: 380 },
    { id: "f4", picsum: 1011, domain: "fashion", styles: ["raw", "textured"], title: "Washed Denim", creator: "Kapital", h: 320 },
    { id: "f5", picsum: 1012, domain: "fashion", styles: ["minimal", "editorial"], title: "Quiet Luxury", creator: "The Row", h: 400 },
    { id: "f6", picsum: 1013, domain: "fashion", styles: ["bold", "geometric"], title: "Pattern Clash", creator: "Marni", h: 340 },
    { id: "f7", picsum: 1014, domain: "fashion", styles: ["dark", "raw"], title: "Deconstructed", creator: "Comme des Garçons", h: 420 },
    { id: "f8", picsum: 1016, domain: "fashion", styles: ["warm", "organic"], title: "Earth Palette", creator: "Lemaire", h: 360 },
    { id: "f9", picsum: 1019, domain: "fashion", styles: ["cold", "minimal"], title: "Technical Shell", creator: "Arc'teryx Veilance", h: 380 },
    { id: "f10", picsum: 1020, domain: "fashion", styles: ["editorial", "bold"], title: "Campaign Still", creator: "Bottega Veneta", h: 340 },

    // Nature
    { id: "n1", picsum: 1039, domain: "nature", styles: ["warm", "organic"], title: "Golden Hour", creator: "Chris Burkard", h: 360 },
    { id: "n2", picsum: 1041, domain: "nature", styles: ["cold", "minimal"], title: "Arctic Light", creator: "Ragnar Axelsson", h: 320 },
    { id: "n3", picsum: 1042, domain: "nature", styles: ["dark", "textured"], title: "Forest Floor", creator: "Edward Burtynsky", h: 400 },
    { id: "n4", picsum: 1043, domain: "nature", styles: ["bold", "warm"], title: "Canyon Wall", creator: "Art Wolfe", h: 440 },
    { id: "n5", picsum: 1045, domain: "nature", styles: ["minimal", "cold"], title: "Fog Valley", creator: "Michael Kenna", h: 300 },
    { id: "n6", picsum: 1046, domain: "nature", styles: ["organic", "warm"], title: "Moss Garden", creator: "Yoshihiro Togashi", h: 380 },
    { id: "n7", picsum: 1049, domain: "nature", styles: ["bold", "dark"], title: "Volcanic Black", creator: "Sebastião Salgado", h: 360 },
    { id: "n8", picsum: 1050, domain: "nature", styles: ["geometric", "cold"], title: "Ice Pattern", creator: "Paul Nicklen", h: 340 },
    { id: "n9", picsum: 1051, domain: "nature", styles: ["warm", "textured"], title: "Desert Bloom", creator: "Beth Moon", h: 420 },
    { id: "n10", picsum: 1054, domain: "nature", styles: ["organic", "minimal"], title: "Still Water", creator: "Hiroshi Sugimoto", h: 320 },

    // Art
    { id: "t1", picsum: 1001, domain: "art", styles: ["bold", "warm"], title: "Color Field", creator: "Mark Rothko Estate", h: 380 },
    { id: "t2", picsum: 1002, domain: "art", styles: ["geometric", "cold"], title: "Hard Edge", creator: "Bridget Riley", h: 340 },
    { id: "t3", picsum: 1003, domain: "art", styles: ["dark", "raw"], title: "Charcoal Study", creator: "William Kentridge", h: 420 },
    { id: "t4", picsum: 1004, domain: "art", styles: ["organic", "warm"], title: "Fluid Form", creator: "Olafur Eliasson", h: 360 },
    { id: "t5", picsum: 1007, domain: "art", styles: ["minimal", "cold"], title: "White Canvas", creator: "Agnes Martin", h: 300 },
    { id: "t6", picsum: 1008, domain: "art", styles: ["bold", "editorial"], title: "Pop Fragment", creator: "KAWS", h: 400 },
    { id: "t7", picsum: 1021, domain: "art", styles: ["textured", "warm"], title: "Impasto Layer", creator: "Gerhard Richter", h: 380 },
    { id: "t8", picsum: 1023, domain: "art", styles: ["dark", "geometric"], title: "Neon Void", creator: "Dan Flavin", h: 360 },
    { id: "t9", picsum: 1024, domain: "art", styles: ["organic", "bold"], title: "Steel Bloom", creator: "Jeff Koons", h: 340 },
    { id: "t10", picsum: 1025, domain: "art", styles: ["raw", "textured"], title: "Found Object", creator: "Robert Rauschenberg", h: 420 },

    // Film
    { id: "m1", picsum: 1026, domain: "film", styles: ["dark", "editorial"], title: "Blade Runner Fog", creator: "Roger Deakins", h: 340 },
    { id: "m2", picsum: 1027, domain: "film", styles: ["warm", "textured"], title: "70mm Grain", creator: "Emmanuel Lubezki", h: 380 },
    { id: "m3", picsum: 1028, domain: "film", styles: ["cold", "minimal"], title: "Nordic Silence", creator: "Hoyte van Hoytema", h: 320 },
    { id: "m4", picsum: 1029, domain: "film", styles: ["bold", "warm"], title: "Neon Night", creator: "Natasha Braier", h: 400 },
    { id: "m5", picsum: 1030, domain: "film", styles: ["dark", "raw"], title: "Handheld Shadow", creator: "Bradford Young", h: 360 },
    { id: "m6", picsum: 1032, domain: "film", styles: ["editorial", "cold"], title: "Symmetric Frame", creator: "Robert Yeoman", h: 340 },
    { id: "m7", picsum: 1033, domain: "film", styles: ["warm", "organic"], title: "Magic Hour", creator: "Vittorio Storaro", h: 420 },
    { id: "m8", picsum: 1034, domain: "film", styles: ["geometric", "dark"], title: "One Point", creator: "Larry Smith", h: 300 },
    { id: "m9", picsum: 1035, domain: "film", styles: ["bold", "editorial"], title: "Widescreen Epic", creator: "Janusz Kamiński", h: 360 },
    { id: "m10", picsum: 1037, domain: "film", styles: ["textured", "warm"], title: "Film Noir", creator: "Darius Khondji", h: 380 },

    // Product Design
    { id: "p1", picsum: 1063, domain: "product", styles: ["minimal", "cold"], title: "Ceramic Form", creator: "Jasper Morrison", h: 340 },
    { id: "p2", picsum: 1064, domain: "product", styles: ["bold", "geometric"], title: "Steel Tool", creator: "Dieter Rams", h: 380 },
    { id: "p3", picsum: 1065, domain: "product", styles: ["warm", "organic"], title: "Wood Turn", creator: "George Nakashima", h: 320 },
    { id: "p4", picsum: 1066, domain: "product", styles: ["dark", "minimal"], title: "Matte Black", creator: "Teenage Engineering", h: 400 },
    { id: "p5", picsum: 1068, domain: "product", styles: ["textured", "warm"], title: "Leather Craft", creator: "Hermès Atelier", h: 360 },
    { id: "p6", picsum: 1069, domain: "product", styles: ["cold", "geometric"], title: "Precision Cut", creator: "Apple Design", h: 340 },
    { id: "p7", picsum: 1070, domain: "product", styles: ["organic", "bold"], title: "Blown Glass", creator: "Murano Studio", h: 420 },
    { id: "p8", picsum: 1071, domain: "product", styles: ["raw", "textured"], title: "Cast Iron", creator: "Staub", h: 300 },
    { id: "p9", picsum: 1072, domain: "product", styles: ["minimal", "editorial"], title: "Desk Object", creator: "Ugmonk", h: 380 },
    { id: "p10", picsum: 1073, domain: "product", styles: ["warm", "minimal"], title: "Stoneware", creator: "Heath Ceramics", h: 360 },

    // Interiors
    { id: "i1", picsum: 1074, domain: "interiors", styles: ["warm", "textured"], title: "Wabi Sabi Room", creator: "Axel Vervoordt", h: 380 },
    { id: "i2", picsum: 1075, domain: "interiors", styles: ["minimal", "cold"], title: "White Gallery", creator: "John Pawson", h: 340 },
    { id: "i3", picsum: 1076, domain: "interiors", styles: ["dark", "bold"], title: "Moody Library", creator: "Kelly Wearstler", h: 420 },
    { id: "i4", picsum: 1077, domain: "interiors", styles: ["organic", "warm"], title: "Natural Light", creator: "Tadao Ando", h: 360 },
    { id: "i5", picsum: 1078, domain: "interiors", styles: ["geometric", "editorial"], title: "Grid Loft", creator: "Vincent Van Duysen", h: 300 },
    { id: "i6", picsum: 1079, domain: "interiors", styles: ["textured", "warm"], title: "Clay Walls", creator: "Studio Mumbai", h: 400 },
    { id: "i7", picsum: 1080, domain: "interiors", styles: ["cold", "minimal"], title: "Concrete Bath", creator: "Norm Architects", h: 340 },
    { id: "i8", picsum: 1081, domain: "interiors", styles: ["bold", "dark"], title: "Velvet Noir", creator: "Joseph Dirand", h: 420 },
    { id: "i9", picsum: 1082, domain: "interiors", styles: ["warm", "organic"], title: "Timber Ceiling", creator: "Kengo Kuma", h: 360 },
    { id: "i10", picsum: 1083, domain: "interiors", styles: ["raw", "textured"], title: "Exposed Brick", creator: "Ilse Crawford", h: 380 },
  ];

  return items.map(item => ({
    ...item,
    imageUrl: `https://picsum.photos/id/${item.picsum}/400/${item.h}`,
    embedding: makeEmbedding(item.domain, item.styles, item.picsum),
    tags: [item.domain, ...item.styles],
  }));
}

// ============================================================
// STORAGE HELPERS
// ============================================================
const STORAGE_KEY = "taste-engine-v1";

async function loadTasteData() {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    return result ? JSON.parse(result.value) : null;
  } catch { return null; }
}

async function saveTasteData(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error("Storage save failed:", e); }
}

// ============================================================
// ICONS
// ============================================================
const HeartIcon = ({ filled, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#F48FB1" : "none"} stroke={filled ? "#F48FB1" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const SparkleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
  </svg>
);

const LinkIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const CrossIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const UploadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);

// ============================================================
// IMAGE CARD
// ============================================================
function ImageCard({ item, liked, onLike, showScore, animDelay }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [pulse, setPulse] = useState(false);

  const handleLike = (e) => {
    e.stopPropagation();
    setPulse(true);
    setTimeout(() => setPulse(false), 500);
    onLike(item.id);
  };

  const domainColors = {
    "architecture": "#03DAC6",
    "graphic-design": "#BB86FC",
    "fashion": "#F48FB1",
    "nature": "#69F0AE",
    "art": "#FFB74D",
    "film": "#90CAF9",
    "product": "#CFD8DC",
    "interiors": "#FFCC80",
    "reference": "#EA80FC",
  };

  const domainColor = domainColors[item.domain] || "#BB86FC";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        background: "#151515",
        cursor: "pointer",
        transition: "transform 0.3s cubic-bezier(0.2,0,0,1), box-shadow 0.3s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? "0 12px 32px rgba(0,0,0,0.6)" : "0 1px 4px rgba(0,0,0,0.3)",
        opacity: 0,
        animation: `fadeIn 0.4s ease forwards`,
        animationDelay: `${animDelay}ms`,
      }}
    >
      {/* Domain dot */}
      <div style={{
        position: "absolute", top: 8, left: 8, zIndex: 3,
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: domainColor,
          boxShadow: `0 0 6px ${domainColor}40`,
        }}/>
        {showScore && item.similarity != null && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            fontFamily: "'SF Mono', monospace",
            color: item.similarity > 0.65 ? "#69F0AE" : item.similarity > 0.35 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            borderRadius: 6, padding: "2px 6px",
          }}>{Math.round(item.similarity * 100)}%</span>
        )}
      </div>

      {/* Image */}
      <div style={{
        width: "100%",
        minHeight: item.isReference ? 200 : Math.min(item.h || 340, 440),
        maxHeight: 440,
        background: imgError ? `linear-gradient(135deg, ${domainColor}15, ${domainColor}05)` : "#0D0D0D",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {!imgError && (
          <img
            src={item.imageUrl}
            alt={item.title}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute", top: 0, left: 0,
              opacity: imgLoaded ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />
        )}
        {(imgError || !imgLoaded) && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8, padding: 20,
            color: domainColor, opacity: 0.4,
          }}>
            <span style={{ fontSize: 28 }}>
              {DOMAINS.find(d => d.id === item.domain)?.icon || "◈"}
            </span>
            <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
              {item.domain}
            </span>
          </div>
        )}
      </div>

      {/* Info overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.88))",
        padding: "36px 12px 10px",
        transition: "opacity 0.25s ease",
        opacity: hovered ? 1 : 0.65,
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#F0F0F0",
              fontFamily: "'Georgia', serif",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{item.title}</div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{item.creator}</div>
          </div>
          <button onClick={handleLike} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 6, marginLeft: 6,
            transform: pulse ? "scale(1.35)" : "scale(1)",
            transition: "transform 0.3s cubic-bezier(0.2,0,0,1.5)",
            flexShrink: 0,
          }}>
            <HeartIcon filled={liked}/>
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{
              fontSize: 8, padding: "2px 6px", borderRadius: 8,
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.35)",
              textTransform: "capitalize",
            }}>{tag.replace("-", " ")}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REFERENCE INPUT (URL paste / image upload)
// ============================================================
function ReferenceInput({ onAdd, visible, onClose }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("art");

  const handleSubmit = () => {
    if (!url.trim()) return;
    onAdd({
      url: url.trim(),
      label: label.trim() || "Reference",
      domain: selectedDomain,
    });
    setUrl("");
    setLabel("");
    onClose();
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#161616",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 420,
        animation: "scaleIn 0.25s cubic-bezier(0.2,0,0,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F5F5" }}>Add Reference</div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4,
          }}><CrossIcon/></button>
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 16, lineHeight: 1.5 }}>
          Paste an image URL from anywhere — a t-shirt, building, painting, film still. It'll shift your taste profile.
        </div>

        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste image URL..."
          style={{
            width: "100%", padding: "10px 14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#E0E0E0", fontSize: 13,
            outline: "none", marginBottom: 10,
            fontFamily: "inherit",
          }}
          onFocus={e => e.target.style.borderColor = "rgba(187,134,252,0.4)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
        />

        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (optional)..."
          style={{
            width: "100%", padding: "10px 14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#E0E0E0", fontSize: 13,
            outline: "none", marginBottom: 12,
            fontFamily: "inherit",
          }}
        />

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5 }}>Domain</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {DOMAINS.filter(d => d.id !== "all").map(d => (
            <button key={d.id} onClick={() => setSelectedDomain(d.id)} style={{
              background: selectedDomain === d.id ? "rgba(187,134,252,0.15)" : "rgba(255,255,255,0.04)",
              border: selectedDomain === d.id ? "1px solid rgba(187,134,252,0.3)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: "5px 10px",
              color: selectedDomain === d.id ? "#BB86FC" : "rgba(255,255,255,0.35)",
              fontSize: 11, cursor: "pointer",
            }}>{d.icon} {d.label}</button>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={!url.trim()} style={{
          width: "100%", padding: "11px 0",
          background: url.trim() ? "linear-gradient(135deg, #BB86FC, #7C4DFF)" : "rgba(255,255,255,0.05)",
          border: "none", borderRadius: 10,
          color: url.trim() ? "#FFF" : "rgba(255,255,255,0.2)",
          fontSize: 13, fontWeight: 700, cursor: url.trim() ? "pointer" : "default",
          transition: "all 0.2s",
        }}>
          Add to Taste Profile
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TASTE PANEL
// ============================================================
function TastePanel({ visible, onClose, catalog, likedIds, tasteActive }) {
  const likedItems = catalog.filter(d => likedIds.has(d.id));

  const domainCounts = {};
  const styleCounts = {};
  likedItems.forEach(item => {
    domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
    item.styles.forEach(s => {
      styleCounts[s] = (styleCounts[s] || 0) + 1;
    });
  });
  const domainRanked = Object.entries(domainCounts).sort((a,b) => b[1] - a[1]);
  const styleRanked = Object.entries(styleCounts).sort((a,b) => b[1] - a[1]);

  const domainColors = {
    "architecture": "#03DAC6", "graphic-design": "#BB86FC", "fashion": "#F48FB1",
    "nature": "#69F0AE", "art": "#FFB74D", "film": "#90CAF9",
    "product": "#CFD8DC", "interiors": "#FFCC80", "reference": "#EA80FC",
  };

  if (!visible) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}/>
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: Math.min(380, typeof window !== 'undefined' ? window.innerWidth * 0.88 : 380),
        zIndex: 201, background: "#111",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        animation: "slideIn 0.3s cubic-bezier(0.2,0,0,1)",
        overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F5F5" }}>Taste Profile</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              {likedIds.size} signals · {tasteActive ? "Engine active" : `${3 - likedIds.size} more to activate`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4, fontSize: 20,
          }}>×</button>
        </div>

        <div style={{ padding: 18, flex: 1 }}>
          {!tasteActive ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "rgba(255,255,255,0.25)", fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>✦</div>
              Like at least 3 images across any domain to activate your taste profile. Each like maps a point in your aesthetic identity.
            </div>
          ) : (
            <>
              {/* Status */}
              <div style={{
                background: "rgba(105,240,174,0.05)",
                border: "1px solid rgba(105,240,174,0.1)",
                borderRadius: 10, padding: 14, marginBottom: 18,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#69F0AE", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                  Taste Engine Active
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                  "For You" ranks by similarity to your cross-domain taste profile. Every like sharpens it.
                </div>
              </div>

              {/* Domain breakdown */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                  Domain Affinity
                </div>
                {domainRanked.map(([domain, count]) => (
                  <div key={domain} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: domainColors[domain] || "#999",
                      flexShrink: 0,
                    }}/>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        background: domainColors[domain] || "#999",
                        width: `${(count / likedIds.size) * 100}%`,
                        opacity: 0.7,
                        transition: "width 0.4s ease",
                      }}/>
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", width: 80, textTransform: "capitalize" }}>
                      {domain.replace("-", " ")}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", width: 16, textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Style breakdown */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                  Style Fingerprint
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {styleRanked.map(([style, count]) => (
                    <div key={style} style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8, padding: "5px 10px",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{style}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>×{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liked mini grid */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                  Liked ({likedItems.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                  {likedItems.slice(0, 12).map(item => (
                    <div key={item.id} style={{
                      borderRadius: 6, overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.05)",
                      aspectRatio: "1", position: "relative",
                      background: "#0D0D0D",
                    }}>
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => e.target.style.display = "none"}
                      />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                        padding: "8px 4px 3px", fontSize: 7, color: "rgba(255,255,255,0.4)",
                        textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5,
                      }}>{item.domain.replace("-"," ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function TasteEngine() {
  const [catalog, setCatalog] = useState(() => buildCatalog());
  const [likedIds, setLikedIds] = useState(new Set());
  const [activeDomain, setActiveDomain] = useState("all");
  const [feedMode, setFeedMode] = useState("discover");
  const [showTaste, setShowTaste] = useState(false);
  const [showRefInput, setShowRefInput] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [gridCols, setGridCols] = useState(3);
  const [loaded, setLoaded] = useState(false);

  // Load persisted taste data
  useEffect(() => {
    loadTasteData().then(data => {
      if (data) {
        if (data.likedIds) setLikedIds(new Set(data.likedIds));
        if (data.references) {
          setCatalog(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newRefs = data.references.filter(r => !existingIds.has(r.id));
            return [...prev, ...newRefs];
          });
        }
      }
      setLoaded(true);
    });
  }, []);

  // Persist on changes
  useEffect(() => {
    if (!loaded) return;
    const references = catalog.filter(c => c.isReference);
    saveTasteData({ likedIds: [...likedIds], references });
  }, [likedIds, catalog, loaded]);

  const tasteActive = likedIds.size >= 3;

  const likedEmbeddings = useMemo(() =>
    catalog.filter(d => likedIds.has(d.id)).map(d => d.embedding),
    [likedIds, catalog]
  );
  const tasteCentroid = useMemo(() => centroid(likedEmbeddings), [likedEmbeddings]);

  const scoredCatalog = useMemo(() =>
    catalog.map(d => ({
      ...d,
      similarity: tasteCentroid ? cosineSim(d.embedding, tasteCentroid) : null,
    })),
    [catalog, tasteCentroid]
  );

  const feed = useMemo(() => {
    let items = [...scoredCatalog];
    if (activeDomain !== "all") {
      items = items.filter(d => d.domain === activeDomain);
    }
    if (feedMode === "curated" && tasteActive) {
      items.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    } else {
      const rng = mulberry32(shuffleSeed + 777);
      items.sort(() => rng() - 0.5);
    }
    return items;
  }, [scoredCatalog, activeDomain, feedMode, tasteActive, shuffleSeed]);

  const handleLike = useCallback((id) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddReference = useCallback(({ url, label, domain }) => {
    const seed = Date.now();
    const styles = ["bold", "editorial"]; // default — in production CLIP determines this
    const newItem = {
      id: `ref-${seed}`,
      imageUrl: url,
      title: label,
      creator: "Your Reference",
      domain: domain,
      styles,
      tags: [domain, ...styles, "reference"],
      embedding: makeEmbedding(domain, styles, seed),
      h: 340,
      isReference: true,
    };
    setCatalog(prev => [newItem, ...prev]);
    // Auto-like references
    setLikedIds(prev => new Set([...prev, newItem.id]));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      color: "#E0E0E0",
      fontFamily: "-apple-system, 'Helvetica Neue', sans-serif",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 8px rgba(105,240,174,0.3); } 50% { box-shadow:0 0 16px rgba(105,240,174,0.6); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }
        button { font-family: inherit; }
      `}</style>

      {/* HEADER */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.88)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "12px 16px" }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "linear-gradient(135deg, #BB86FC 0%, #7C4DFF 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: "#0A0A0A",
              }}>✦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3, color: "#F5F5F5" }}>Taste Engine</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase" }}>Cross-domain aesthetic intelligence</div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Feed mode toggle */}
              <div style={{
                display: "flex", gap: 2,
                background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2,
              }}>
                {[{ key: "discover", label: "Discover" }, { key: "curated", label: "For You" }].map(({ key, label }) => (
                  <button key={key} onClick={() => setFeedMode(key)} style={{
                    background: feedMode === key ? "rgba(187,134,252,0.18)" : "transparent",
                    color: feedMode === key ? "#BB86FC" : "rgba(255,255,255,0.35)",
                    border: "none", borderRadius: 6, padding: "5px 12px",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.2s", position: "relative",
                  }}>
                    {label}
                    {key === "curated" && tasteActive && (
                      <span style={{
                        position: "absolute", top: -1, right: -1,
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#69F0AE",
                        animation: "pulseGlow 2s ease infinite",
                      }}/>
                    )}
                  </button>
                ))}
              </div>

              {/* Add reference */}
              <button onClick={() => setShowRefInput(true)} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "6px 10px",
                color: "rgba(255,255,255,0.45)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
                transition: "all 0.2s",
              }}>
                <UploadIcon/> <span style={{ display: "inline-block" }}>Add</span>
              </button>

              {/* Shuffle */}
              <button onClick={() => setShuffleSeed(s => s + 1)} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "6px 10px",
                color: "rgba(255,255,255,0.45)", cursor: "pointer",
                fontSize: 11, fontWeight: 600, transition: "all 0.2s",
              }}>↻</button>

              {/* Grid columns */}
              <div style={{
                display: "flex", alignItems: "center", gap: 0,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, overflow: "hidden",
              }}>
                <button onClick={() => setGridCols(c => Math.max(2, c - 1))} style={{
                  background: "none", border: "none",
                  color: gridCols <= 2 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)",
                  cursor: gridCols <= 2 ? "default" : "pointer",
                  padding: "5px 8px", fontSize: 13, fontWeight: 600,
                  lineHeight: 1, transition: "color 0.2s",
                }}>−</button>
                <div style={{
                  display: "flex", alignItems: "center", gap: 3,
                  padding: "0 2px",
                }}>
                  {[...Array(gridCols)].map((_, i) => (
                    <div key={i} style={{
                      width: 3, height: 10, borderRadius: 1,
                      background: "rgba(255,255,255,0.35)",
                      transition: "all 0.2s",
                    }}/>
                  ))}
                </div>
                <button onClick={() => setGridCols(c => Math.min(6, c + 1))} style={{
                  background: "none", border: "none",
                  color: gridCols >= 6 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)",
                  cursor: gridCols >= 6 ? "default" : "pointer",
                  padding: "5px 8px", fontSize: 13, fontWeight: 600,
                  lineHeight: 1, transition: "color 0.2s",
                }}>+</button>
              </div>

              {/* Taste panel */}
              <button onClick={() => setShowTaste(true)} style={{
                background: tasteActive ? "rgba(187,134,252,0.12)" : "rgba(255,255,255,0.04)",
                border: tasteActive ? "1px solid rgba(187,134,252,0.25)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "6px 10px",
                color: tasteActive ? "#BB86FC" : "rgba(255,255,255,0.45)",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
              }}>
                <SparkleIcon/>
                {likedIds.size > 0 && (
                  <span style={{
                    background: tasteActive ? "#BB86FC" : "rgba(255,255,255,0.15)",
                    color: tasteActive ? "#0A0A0A" : "rgba(255,255,255,0.5)",
                    borderRadius: 8, padding: "1px 5px", fontSize: 9, fontWeight: 800,
                  }}>{likedIds.size}</span>
                )}
              </button>
            </div>
          </div>

          {/* Domain filters */}
          <div style={{
            display: "flex", gap: 4, marginTop: 10,
            overflowX: "auto", paddingBottom: 2,
            scrollbarWidth: "none",
          }}>
            {DOMAINS.map(d => (
              <button key={d.id} onClick={() => setActiveDomain(d.id)} style={{
                background: activeDomain === d.id ? "rgba(255,255,255,0.1)" : "transparent",
                border: activeDomain === d.id ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.04)",
                borderRadius: 20, padding: "4px 12px",
                color: activeDomain === d.id ? "#F0F0F0" : "rgba(255,255,255,0.3)",
                fontSize: 10, fontWeight: 500, cursor: "pointer",
                whiteSpace: "nowrap", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 9 }}>{d.icon}</span>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Status bar */}
      {tasteActive && feedMode === "curated" && (
        <div style={{
          textAlign: "center", padding: "8px 16px",
          background: "rgba(105,240,174,0.03)",
          borderBottom: "1px solid rgba(105,240,174,0.06)",
          fontSize: 10, color: "rgba(105,240,174,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <SparkleIcon size={10}/> Ranked by your taste profile across {Object.keys(
            catalog.filter(c => likedIds.has(c.id)).reduce((acc, c) => { acc[c.domain] = true; return acc; }, {})
          ).length} domains
        </div>
      )}
      {!tasteActive && likedIds.size > 0 && (
        <div style={{
          textAlign: "center", padding: "8px 16px",
          background: "rgba(187,134,252,0.03)",
          borderBottom: "1px solid rgba(187,134,252,0.06)",
          fontSize: 10, color: "rgba(187,134,252,0.5)",
        }}>
          Like {3 - likedIds.size} more to activate taste engine
        </div>
      )}

      {/* MASONRY FEED */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "16px 12px" }}>
        <div style={{ columnCount: gridCols, columnGap: 12, transition: "all 0.3s ease" }}>
          {feed.map((item, i) => (
            <div key={item.id} style={{ breakInside: "avoid", marginBottom: 12 }}>
              <ImageCard
                item={item}
                liked={likedIds.has(item.id)}
                onLike={handleLike}
                showScore={tasteActive && feedMode === "curated"}
                animDelay={Math.min(i * 25, 500)}
              />
            </div>
          ))}
        </div>
        {feed.length === 0 && (
          <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
            No images in this domain yet
          </div>
        )}
      </div>

      {/* Modals */}
      <ReferenceInput
        visible={showRefInput}
        onClose={() => setShowRefInput(false)}
        onAdd={handleAddReference}
      />
      <TastePanel
        visible={showTaste}
        onClose={() => setShowTaste(false)}
        catalog={catalog}
        likedIds={likedIds}
        tasteActive={tasteActive}
      />
    </div>
  );
}
