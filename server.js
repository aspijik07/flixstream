import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Serve static assets from project root
app.use(express.static(__dirname));

// Route handlers for clean URLs
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'watch.html'));
});

app.get('/unlocked', (req, res) => {
  res.sendFile(path.join(__dirname, 'unlocked.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`FlixStream server running on http://${HOST}:${PORT}`);
});
