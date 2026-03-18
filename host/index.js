import express from "express";
import escapeHtml from "escape-html";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const INDEXER_URL = process.env.INDEXER_URL || "https://fulcrum.angor.online/api/query/Angor/projects/";
const BASE_URL = process.env.BASE_URL || "https://hub.angor.io";
const DEFAULT_IMAGE = `${BASE_URL}/assets/angor-hub-social.png`;
const INDEXER_TIMEOUT_MS = 45000; 
const RELAY_TIMEOUT_MS = 10000;   // Nostr relay operations

// Relays used for fetching Nostr data (events + profiles)
const NOSTR_RELAYS = (process.env.NOSTR_RELAYS || "wss://relay.angor.io,wss://relay2.angor.io").split(",");


const cache = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > CACHE_TTL_MS) cache.delete(key);
  }
}, 10 * 60 * 1000);


/** Fetch JSON */
async function fetchJson(url, timeoutMs = INDEXER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Truncate description to a reasonable length for meta tags */
function truncate(str, maxLen = 200) {
  if (!str || str.length <= maxLen) return str || "";
  return str.slice(0, maxLen - 1) + "\u2026";
}

const BOT_UA_PATTERN = /bot|facebookexternalhit|twitterbot|telegrambot|whatsapp|linkedin|slack|discord|signal|snapchat|pinterest|skype|googlebot|bingbot|yandexbot|duckduckbot/i;


/**
 * Fetch a single Nostr event by filter from a relay.
 * Opens a short-lived WebSocket, sends REQ, returns the first matching event.
 */
function fetchFromRelay(filter, relayUrl) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error(`Relay ${relayUrl} timeout`));
    }, RELAY_TIMEOUT_MS);

    const subId = `meta_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ws = new WebSocket(relayUrl);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(["REQ", subId, filter]));
    });

    ws.addEventListener("message", (msg) => {
      try {
        const raw = typeof msg.data === "string" ? msg.data : msg.data.toString();
        const data = JSON.parse(raw);

        if (data[0] === "EVENT" && data[1] === subId && data[2]) {
          clearTimeout(timer);
          ws.send(JSON.stringify(["CLOSE", subId]));
          ws.close();
          resolve(data[2]);
        } else if (data[0] === "EOSE" && data[1] === subId) {
          clearTimeout(timer);
          ws.send(JSON.stringify(["CLOSE", subId]));
          ws.close();
          resolve(null);
        }
      } catch {}
    });

    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`Relay ${relayUrl} connection failed`));
    });

    ws.addEventListener("close", () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Try fetching from multiple relays, return the first successful result.
 */
async function fetchFromRelays(filter, relayUrls = NOSTR_RELAYS) {
  for (const relay of relayUrls) {
    try {
      const result = await fetchFromRelay(filter, relay);
      if (result) return result;
    } catch (err) {
      console.warn(`[meta] ${relay}: ${err.message}`);
    }
  }
  return null;
}

/** Fetch a Nostr profile (kind 0) by pubkey */
async function fetchNostrProfile(pubkey) {
  return fetchFromRelays({ kinds: [0], authors: [pubkey], limit: 1 });
}

// Fetch project metadata

async function getProjectMeta(projectId) {
  const cached = cacheGet(`project:${projectId}`);
  if (cached) return cached;

  // Fetch project from the indexer — needed to resolve projectId  to a Nostr pubkey
  console.log(`[meta] Fetching project ${projectId} from indexer`);
  const project = await fetchJson(INDEXER_URL + encodeURIComponent(projectId));
  const nostrPubKey = project?.founderKey;
  if (!nostrPubKey) {
    console.warn("[meta] No founderKey in indexer response");
    return null;
  }

  // Fetch the founder's profile (kind 0) from relays
  console.log(`[meta] Fetching profile ${nostrPubKey.slice(0, 12)}...`);
  let profile = {};
  try {
    const profileEvent = await fetchNostrProfile(nostrPubKey);
    if (profileEvent?.content) {
      profile = typeof profileEvent.content === "string"
        ? JSON.parse(profileEvent.content)
        : profileEvent.content;
    }
  } catch (err) {
    console.warn("[meta] Failed to fetch profile:", err.message);
  }

  const name = profile.display_name || profile.name || projectId;
  const about = profile.about || "";
  const banner = profile.banner || profile.picture || "";

  const meta = {
    title: `Angor Hub - ${name}`,
    description: truncate(about) || "Decentralized crowdfunding on Bitcoin.",
    image: banner || DEFAULT_IMAGE,
    url: `${BASE_URL}/project/${projectId}`,
  };

  cacheSet(`project:${projectId}`, meta);
  console.log(`[meta] Resolved: "${meta.title}"`);
  return meta;
}


const app = express();
const port = process.env.PORT || 3000;

// Read index.html at startup
const indexPath = join(__dirname, "dist/browser/index.html");
const indexHtml = await fs.readFile(indexPath, "utf-8");

/** Inject Open Graph / Twitter Card meta tags into the base HTML */
function injectMetaTags(html, meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);

  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
    .replace(/<meta name="twitter:title" content=".*?"/, `<meta name="twitter:title" content="${title}"`)
    .replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${description}"`)
    .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`)
    .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${image}"`)
    .replace(/<meta property="og:url" content=".*?"/, `<meta property="og:url" content="${url}"`);
}

// Middleware for dynamic meta tags (bot requests only)
app.use(async (req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|svg|woff|woff2|ttf|eot|map)$/)) {
    return next();
  }

  const ua = req.headers["user-agent"] || "";
  if (!BOT_UA_PATTERN.test(ua)) {
    return next();
  }

  try {
    const projectMatch = req.path.match(/\/project\/(angor1[a-zA-Z0-9]+)/);
    const projectId = projectMatch ? projectMatch[1] : null;

    if (!projectId) {
      return next();
    }

    const meta = await getProjectMeta(projectId);
    if (!meta) {
      return next();
    }

    const html = injectMetaTags(indexHtml, meta);
    res.set("Content-Type", "text/html");
    return res.send(html);
  } catch (error) {
    console.error("[meta] Error generating meta tags for", req.path, error.message);
    next();
  }
});

// Serve static files from the Angular app
app.use(express.static(join(__dirname, "dist/browser")));

// Handle all routes for the SPA
app.get("/{*splat}", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(indexHtml);
});

app.listen(port, () => {
  console.log(`Angor Hub server running on port ${port}`);
  console.log(`  Indexer:  ${INDEXER_URL}`);
  console.log(`  Relays:   ${NOSTR_RELAYS.join(", ")}`);
  console.log(`  Base URL: ${BASE_URL}`);
});
