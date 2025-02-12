import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware for dynamic meta tags
app.use(async (req, res, next) => {
  // Skip if request is for a static asset
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|svg|woff|woff2|ttf|eot)$/)) {
    return next();
  }

  // console.log(req.path.match(/\/$/));
  // console.log(req.path.match(/\.html$/));
  // console.log(req.path !== '/');

  // // Only process index.html-like requests (root, directories, or .html files)
  // if (!req.path.match(/\/$/) && !req.path.match(/\.html$/) && req.path !== '/') {
  //     return next();
  // }

  console.log("Passed the static asset check...");

  if (true || req.headers["user-agent"]?.toLowerCase().includes("bot") || req.headers["user-agent"]?.toLowerCase().includes("facebook") || req.headers["user-agent"]?.toLowerCase().includes("twitter")) {
    try {
      // Extract project identifier from path
      const projectMatch = req.path.match(/\/project\/(angor1[a-zA-Z0-9]+)/);
      const projectId = projectMatch ? projectMatch[1] : null;

      console.log("Project ID:", projectId);

      const indexPath = join(__dirname, "dist/browser/index.html");
      let html = await fs.readFile(indexPath, "utf-8");

      // Customize meta tags based on route and project
      const title = projectId ? `Angor Hub - Project ${projectId}` : `Angor Hub - ${req.path}`;
      const description = projectId ? `View project ${projectId} on Angor Hub - Your Investement Gateway` : "Explore Angor Hub - Your INvestement Gateway";
      const image = "https://hub.angor.io/assets/angor-hub-social.png";

      html = html
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
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
