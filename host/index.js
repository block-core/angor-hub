import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware for dynamic meta tags
app.use(async (req, res, next) => {
    if (req.headers['user-agent']?.toLowerCase().includes('bot') || 
        req.headers['user-agent']?.toLowerCase().includes('facebook') || 
        req.headers['user-agent']?.toLowerCase().includes('twitter')) {
        
        try {
            const indexPath = join(__dirname, 'dist/browser/index.html');
            let html = await fs.readFile(indexPath, 'utf-8');
            
            // Customize meta tags based on route
            const title = `Angor Hub - ${req.path}`;
            const description = 'Explore Angor Hub - Your Web3 Gateway';
            const image = 'https://yourdomain.com/assets/social-preview.jpg';
            
            html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
                       .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
                       .replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${description}"`)
                       .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${image}"`);
            
            return res.send(html);
        } catch (error) {
            console.error('Error modifying meta tags:', error);
            next();
        }
    } else {
        next();
    }
});

// Serve static files from the Angular app
app.use(express.static(join(__dirname, 'dist/browser')));

// Handle all routes for the PWA
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist/browser/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
