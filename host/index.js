import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";
import NDK from "@nostr-dev-kit/ndk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize NDK with specific relays
const ndk = new NDK({
  explicitRelayUrls: ["wss://purplepag.es", "wss://relay.angor.io"],
});

await ndk.connect();

// Function to fetch Nostr metadata
async function getNostrEvent(eventId) {
  try {
    // const filter = {
    //   ids: eventId,
    //   limit: 1,
    // };

    const filter = {
      //   kinds: [30078], // PROTOCOL CHANGES THIS KIND ID!
      ids: [eventId],
    };

    console.log("Nostr Filter: ", JSON.stringify(filter));

    const event = await ndk.fetchEvent(filter);
    return event;
    console.log("EVENT ID EVENTS: ", events);

    // Assuming projectId contains or maps to a Nostr pubkey
    // const user = ndk.getUser({
    //   pubkey: projectId,
    // });

    // await user.fetchProfile();

    return {
      name: user.profile?.name || projectId,
      about: user.profile?.about || "No description available",
      picture: user.profile?.picture || "https://hub.angor.io/assets/angor-hub-social.png",
    };
  } catch (error) {
    console.error("Error fetching Nostr metadata:", error);
    return null;
  }
}

// Function to fetch Nostr metadata
async function getNostrMetadata(pubkey) {
  try {
    // Assuming projectId contains or maps to a Nostr pubkey
    // const user = ndk.getUser({
    //   pubkey: pubkey,
    // });

    // console.log('User created: ', user);

    // const ndk = await this.ensureConnected();

    const filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1,
    };

    const event = await ndk.fetchEvent(filter);
    return event;
    console.log("Events:", events);
    const sub = ndk.subscribe(filter);

    sub.on("event", (event) => {
      try {
        console.log("Profile event:", event);
        // this.profileUpdates.next(event);
      } catch (error) {
        console.error("Failed to parse profile:", error);
      }
    });

    return {
      name: user.profile?.name || pubkey,
      about: user.profile?.about || "No description available",
      picture: user.profile?.picture || "https://hub.angor.io/assets/angor-hub-social.png",
    };
  } catch (error) {
    console.error("Error fetching Nostr metadata:", error);
    return null;
  }
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware for dynamic meta tags
app.use(async (req, res, next) => {
  // Skip if request is for a static asset
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|svg|woff|woff2|ttf|eot)$/)) {
    return next();
  }

  if (req.headers["user-agent"]?.toLowerCase().match(/(bot|facebookexternalhit|twitterbot|telegrambot|whatsapp|linkedin|slack|discord|signal|snapchat|pinterest|skype|googlebot|bingbot|yandexbot|duckduckbot)/i)) {
    try {
      // Extract project identifier from path
      const projectMatch = req.path.match(/\/project\/(angor1[a-zA-Z0-9]+)/);
      const projectId = projectMatch ? projectMatch[1] : null;

      if (!projectId) {
        return next();
      }

      const indexerUrl = "https://tbtc.indexer.angor.io/api/query/Angor/projects/";

      // Fetch project metadata if projectId exists
      const response = await fetch(indexerUrl + projectId);

      const projectMetadata = await response.json();
      const nostrEventId = projectMetadata.nostrEventId;

      // Fetch Nostr metadata if projectId exists
      const nostrEvent = await getNostrEvent(nostrEventId);
      const nostrParsed = JSON.parse(nostrEvent.content);
      const nostrPubKey = nostrParsed.nostrPubKey;

      if (!nostrPubKey) {
        return next();
      }

      // Fetch Nostr metadata if projectId exists
      const nostrMetadata = await getNostrMetadata(nostrPubKey);
      //   console.log("Nostr Metadata:", nostrMetadata);
      const profile = JSON.parse(nostrMetadata.content);

      const indexPath = join(__dirname, "dist/browser/index.html");
      let html = await fs.readFile(indexPath, "utf-8");

      const title = `Angor Hub - ${profile.name}`;
      const description = `${profile.about}`;
      const image = profile?.banner || "https://hub.angor.io/assets/angor-hub-social.png";

      html = html
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
        .replace(/<meta name="twitter:title" content=".*?"/, `<meta name="twitter:title" content="${title}"`)
        .replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${description}"`)
        .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${image}"`);

      return res.send(html);
    } catch (error) {
      console.error("Error modifying meta tags:", error);
      next();
    }
  } else {
    next();
  }
});

// Serve static files from the Angular app
app.use(express.static(join(__dirname, "dist/browser")));

// Handle all routes for the PWA
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist/browser/index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
