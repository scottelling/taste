import { useState, useEffect, useRef } from "react";
// ─── Config ───────────────────────────────────────────────────────────────────
const UNSPLASH_ACCESS_KEY = "PlKD7h9DEFYnOnqcAuUmVEJ1VROMWxnfs4FPCe1ESlM";
const IMAGES_PER_FETCH = 20;
const LIKES_FOR_PROFILE = 3;
const DOMAINS = [
  { id: "architecture", label: "Architecture", emoji: "🏛", query: "architectural photography minimal brutalist" },
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
function TastePanel({ tasteProfile, likedImages }) {
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
    <div style={{ padding: 16, overflowY: "auto" }}>
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
    if (images.length > 0) saveState({ images, tasteProfile, columns, pageMap });
  }, [images, tasteProfile, columns]);
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
            <TastePanel tasteProfile={tasteProfile} likedImages={likedImages} />
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
