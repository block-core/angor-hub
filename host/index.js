import express from "express";
import escapeHtml from "escape-html";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const INDEXER_URL = process.env.INDEXER_URL || "https://fulcrum.angor.online/";
const BASE_URL = process.env.BASE_URL || "https://angor.io";
const DEFAULT_IMAGE = `${BASE_URL}/assets/angor-hub-social.png`;
const INDEXER_TIMEOUT_MS = 45000; 
const RELAY_TIMEOUT_MS = 15000;   // Nostr relay operations (increased for reliability)

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
 * Try fetching from multiple relays in parallel, return the first successful result.
 */
async function fetchFromRelays(filter, relayUrls = NOSTR_RELAYS) {
  const results = await Promise.allSettled(
    relayUrls.map(url => fetchFromRelay(filter, url))
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }
  // Log failures
  for (const r of results) {
    if (r.status === "rejected") console.warn(`[meta] relay: ${r.reason.message}`);
  }
  return null;
}

/** Fetch a Nostr profile (kind 0) by pubkey */
async function fetchNostrProfile(pubkey) {
  return fetchFromRelays({ kinds: [0], authors: [pubkey], limit: 1 });
}

/** Fetch a Nostr event by its ID */
async function fetchNostrEvent(eventId) {
  return fetchFromRelays({ ids: [eventId], limit: 1 });
}

/** Fetch an Angor project event (kind 3030/30078) by projectIdentifier d-tag */
async function fetchProjectByDTag(projectIdentifier) {
  // Try kind 3030 first (newer), then 30078 (legacy)
  const event = await fetchFromRelays({ kinds: [3030], "#d": [projectIdentifier], limit: 1 });
  if (event) return event;
  return fetchFromRelays({ kinds: [30078], "#d": [projectIdentifier], limit: 1 });
}

/** Parse project details from a kind 3030/30078 event content */
function parseProjectContent(event) {
  try {
    const content = typeof event.content === "string" ? JSON.parse(event.content) : event.content;
    return content;
  } catch {
    return null;
  }
}

/** Format satoshis as BTC string */
function satsToBtc(sats) {
  if (!sats || sats <= 0) return null;
  return (sats / 1e8).toFixed(8).replace(/\.?0+$/, "");
}

// Fetch project metadata — 3-step: indexer -> project event -> profile

/**
 * Scans the indexer's paginated project list to find a single project by ID.
 * Uses the list endpoint instead of the (potentially unavailable) per-project endpoint.
 * PAGE_LIMIT and MAX_PAGES match the constants used in the Angular IndexerService.
 */
async function findProjectInIndexer(projectId) {
  const PAGE_LIMIT = 50; // max page size allowed by the API
  const MAX_PAGES = 10;  // safety cap: covers up to 500 on-chain projects

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_LIMIT;
    try {
      const batch = await fetchJson(
        `${INDEXER_URL}api/query/Angor/projects?offset=${offset}&limit=${PAGE_LIMIT}`
      );
      if (!Array.isArray(batch) || batch.length === 0) break;

      const found = batch.find(p => p.projectIdentifier === projectId);
      if (found) return found;

      if (batch.length < PAGE_LIMIT) break; // last page
    } catch (err) {
      console.warn(`[meta] Indexer list lookup failed (page ${page}): ${err.message}`);
      break;
    }
  }
  return null;
}

async function getProjectMeta(projectId) {
  const cached = cacheGet(`project:${projectId}`);
  if (cached) return cached;

  let nostrEventId = null;
  let projectDetails = null;

  // Step 1: Try the indexer list to get the nostrEventId
  try {
    console.log(`[meta] Fetching project ${projectId} from indexer list`);
    const project = await findProjectInIndexer(projectId);
    nostrEventId = project?.nostrEventId;
  } catch (err) {
    console.warn(`[meta] Indexer lookup failed: ${err.message}`);
  }

  // Step 2: Fetch the kind 3030 event to get nostrPubKey and project details
  let projectEvent = null;
  if (nostrEventId) {
    console.log(`[meta] Fetching event ${nostrEventId.slice(0, 12)}...`);
    projectEvent = await fetchNostrEvent(nostrEventId);
  }
  // Fallback: search by d-tag if indexer failed or event not found
  if (!projectEvent) {
    console.log(`[meta] Searching relays for project by d-tag: ${projectId}`);
    projectEvent = await fetchProjectByDTag(projectId);
  }
  if (!projectEvent) {
    console.warn("[meta] Could not find project event on relays");
    return null;
  }

  projectDetails = parseProjectContent(projectEvent);
  const nostrPubKey = projectDetails?.nostrPubKey;
  if (!nostrPubKey) {
    console.warn("[meta] No nostrPubKey in project event content");
    return null;
  }

  // Step 3: Fetch the profile (kind 0) using the correct Nostr pubkey
  console.log(`[meta] Fetching profile for ${nostrPubKey.slice(0, 12)}...`);
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

  // Build rich description from project details
  const name = profile.display_name || profile.name || projectId;
  const about = profile.about || "";
  const banner = profile.banner || profile.picture || "";

  const descParts = [];
  if (about) descParts.push(truncate(about, 140));
  if (projectDetails.targetAmount) {
    descParts.push(`Target: ${satsToBtc(projectDetails.targetAmount)} BTC`);
  }
  const typeLabels = { 0: "Invest", 1: "Fund", 2: "Subscribe" };
  const typeLabel = typeLabels[projectDetails.projectType] || "Invest";
  descParts.push(`Type: ${typeLabel}`);
  if (projectDetails.endDate) {
    const endDate = new Date(projectDetails.endDate * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    descParts.push(`Ends: ${endDate}`);
  }

  const meta = {
    title: `${name} - Angor Hub`,
    description: descParts.join(" | ") || "Decentralized crowdfunding on Bitcoin.",
    image: banner || DEFAULT_IMAGE,
    url: `${BASE_URL}/project/${projectId}`,
  };

  cacheSet(`project:${projectId}`, meta);
  console.log(`[meta] Resolved: "${meta.title}" — ${meta.description}`);
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

// Redirect legacy /docs path to docs subdomain
app.get("/docs", (req, res) => {
  res.redirect(301, "https://docs.angor.io");
});

// Serve static files from the Angular app
app.use(express.static(join(__dirname, "dist/browser")));

// Handle all routes for the SPA
app.get("*", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(indexHtml);
});

app.listen(port, () => {
  console.log(`Angor Hub server running on port ${port}`);
  console.log(`  Indexer:  ${INDEXER_URL}`);
  console.log(`  Relays:   ${NOSTR_RELAYS.join(", ")}`);
  console.log(`  Base URL: ${BASE_URL}`);
});
