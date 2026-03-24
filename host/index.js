import express from "express";
import escapeHtml from "escape-html";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";
import { bech32, bech32m } from "@scure/base";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const INDEXER_URL = process.env.INDEXER_URL || "https://fulcrum.angor.online/";
const BASE_URL = process.env.BASE_URL || "https://angor.io";
const DEFAULT_IMAGE = `${BASE_URL}/assets/angor-hub-social.png`;
const INDEXER_TIMEOUT_MS = 45000; 
const RELAY_TIMEOUT_MS = 15000;   // Nostr relay operations (increased for reliability)

// Determine the Bitcoin network from the indexer URL:
// URLs containing 'signet' or 'testnet' are treated as testnet (HRP 'tb'),
// everything else is mainnet (HRP 'bc').
const BITCOIN_HRP = (INDEXER_URL.includes("signet") || INDEXER_URL.includes("testnet")) ? "tb" : "bc";

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

// Fetch project metadata — 3-step: mempool indexer -> project event -> profile

// Bitcoin script opcode constants
const OP_RETURN_OPCODE = 0x6a;
const OP_PUSHDATA1_OPCODE = 0x4c;

/**
 * Converts an Angor project identifier (bech32 with "angor" HRP)
 * to a standard Bitcoin witness address for use with the mempool.space API.
 * Mirrors InvestorService.convertAngorKeyToBitcoinAddress in the Angular app.
 */
function convertAngorKeyToBitcoinAddress(projectId) {
  let decoded;
  let isBech32m = false;
  try {
    decoded = bech32m.decode(projectId);
    isBech32m = true;
  } catch {
    decoded = bech32.decode(projectId);
  }
  const witnessVersion = decoded.words[0];
  const dataWords = decoded.words.slice(1);
  if (witnessVersion === 0 || !isBech32m) {
    return bech32.encode(BITCOIN_HRP, [witnessVersion, ...dataWords]);
  } else {
    return bech32m.encode(BITCOIN_HRP, [witnessVersion, ...dataWords]);
  }
}

/**
 * Parses the OP_RETURN of a project funding transaction to extract
 * the founder public key and the embedded Nostr event ID.
 * Format: OP_RETURN <founder_pubkey 33B> <key_type 2B> <nostr_event_id 32B>
 */
function parseFounderInfoFromOpReturn(scriptpubkeyHex) {
  try {
    const bytes = [];
    for (let i = 0; i < scriptpubkeyHex.length; i += 2) {
      bytes.push(parseInt(scriptpubkeyHex.substring(i, i + 2), 16));
    }

    const ops = [];
    let i = 0;
    while (i < bytes.length) {
      const opcode = bytes[i++];
      if (opcode === OP_RETURN_OPCODE) { ops.push([]); continue; } // OP_RETURN
      if (opcode >= 0x01 && opcode <= 0x4b) {
        ops.push(bytes.slice(i, i + opcode)); i += opcode; continue;
      }
      if (opcode === OP_PUSHDATA1_OPCODE) { const len = bytes[i++]; ops.push(bytes.slice(i, i + len)); i += len; continue; }
      ops.push([]);
    }

    // ops[0]=OP_RETURN, ops[1]=33B founder key, ops[2]=2B key type, ops[3]=32B nostr event id
    if (ops.length < 4 || ops[1].length !== 33) return null;
    const toHex = (b) => b.map(x => x.toString(16).padStart(2, "0")).join("");
    return {
      founderKey: toHex(ops[1]),
      nostrEventId: ops[3].length === 32 ? toHex(ops[3]) : "",
    };
  } catch {
    return null;
  }
}

/**
 * Looks up project on-chain data using the mempool.space-compatible API.
 * Fetches all transactions at the project's Bitcoin address, finds the
 * funding transaction (first tx with OP_RETURN containing founderKey +
 * nostrEventId), and returns the extracted data.
 *
 * Mirrors IndexerService.fetchProjectFromMempool in the Angular app.
 */
async function findProjectInMempool(projectId) {
  try {
    const bitcoinAddress = convertAngorKeyToBitcoinAddress(projectId);
    console.log(`[meta] Querying mempool for ${projectId} -> ${bitcoinAddress}`);

    const txs = await fetchJson(`${INDEXER_URL}api/v1/address/${bitcoinAddress}/txs`);
    if (!Array.isArray(txs) || txs.length === 0) return null;

    // Sort oldest-first — the funding transaction is the first at this address
    const sorted = [...txs].sort((a, b) => {
      const aH = a.status?.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
      const bH = b.status?.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
      return aH - bH;
    });

    for (const tx of sorted) {
      if (!tx.vout || tx.vout.length < 2) continue;
      const opReturn = tx.vout[1];
      if (opReturn.scriptpubkey_type !== "op_return" && opReturn.scriptpubkey_type !== "nulldata") continue;
      const parsed = parseFounderInfoFromOpReturn(opReturn.scriptpubkey);
      if (parsed) {
        return {
          projectIdentifier: projectId,
          founderKey: parsed.founderKey,
          nostrEventId: parsed.nostrEventId,
          trxId: tx.txid,
          createdOnBlock: tx.status?.block_height ?? 0,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(`[meta] Mempool lookup failed for ${projectId}: ${err.message}`);
    return null;
  }
}

async function getProjectMeta(projectId) {
  const cached = cacheGet(`project:${projectId}`);
  if (cached) return cached;

  let nostrEventId = null;
  let projectDetails = null;

  // Step 1: Fetch the project's funding transaction from the blockchain
  // to get the blockchain-authoritative nostrEventId.
  try {
    console.log(`[meta] Fetching project ${projectId} from mempool API`);
    const project = await findProjectInMempool(projectId);
    nostrEventId = project?.nostrEventId;
  } catch (err) {
    console.warn(`[meta] Mempool lookup failed: ${err.message}`);
  }

  // Step 2: Fetch the kind 3030 event to get nostrPubKey and project details
  let projectEvent = null;
  if (nostrEventId) {
    console.log(`[meta] Fetching event ${nostrEventId.slice(0, 12)}...`);
    projectEvent = await fetchNostrEvent(nostrEventId);
  }
  // Fallback: search by d-tag if mempool lookup failed or event not found
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
