// ==========================================
// AI BRIDGE COMPANION SERVER (PORT 9421)
// Master Handler: Digest, Push All & Rollback
// ==========================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9421;
const WORKSPACE_DIR = process.cwd();
const BACKUP_DIR = path.join(WORKSPACE_DIR, '.bridge_backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Function to generate the workspace digest
function getWorkspaceDigest() {
    const files = ['watch.html', 'style.css', 'player.js', 'index.html', 'app.js'];
    let combinedText = "=== FLIXSTREAM CURRENT WORKSPACE CODE ===\n\n";
    const filesMap = {};

    files.forEach(f => {
        const p = path.join(WORKSPACE_DIR, f);
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf-8');
            filesMap[f] = content;
            combinedText += `\n/* ==================== FILE: ${f} ==================== */\n${content}\n`;
        }
    });

    return { combinedText, filesMap };
}

const server = http.createServer((req, res) => {
    // CORS & Private Network Access Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. GET Requests (Ping / Status / Direct Digest)
    if (req.method === 'GET') {
        if (req.url === '/' || req.url === '/status' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'online', ready: true }));
            return;
        }

        if (req.url.startsWith('/digest')) {
            const { combinedText, filesMap } = getWorkspaceDigest();
            console.log(`[AI Bridge] Digest sent (GET).`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                digest: combinedText, 
                text: combinedText, 
                content: combinedText,
                files: filesMap 
            }));
            return;
        }
    }

    // 2. POST Requests (Action Handler: Digest, Push All, etc.)
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                let data = {};
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    data = { raw: body };
                }

                const action = (data.action || data.type || data.command || '').toLowerCase();

                // CASE A: DIGEST REQUEST (Via POST from extension)
                if (action === 'digest' || req.url.includes('digest')) {
                    const { combinedText, filesMap } = getWorkspaceDigest();
                    console.log(`[AI Bridge] Digest requested by extension! Sending ${Object.keys(filesMap).length} files.`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        digest: combinedText,
                        text: combinedText,
                        content: combinedText,
                        data: combinedText,
                        files: filesMap
                    }));
                    return;
                }

                // CASE B: PUSH ALL REQUEST (Writing code to VS Code files)
                const updatedFiles = [];
                const timestamp = Date.now();

                if (Array.isArray(data.files) || Array.isArray(data)) {
                    const list = data.files || data;
                    list.forEach(item => {
                        const relPath = item.path || item.filename || item.name;
                        const content = item.content || item.code || item.text;
                        if (relPath && typeof content === 'string') {
                            writeFileSafely(relPath, content, timestamp);
                            updatedFiles.push(relPath);
                        }
                    });
                } else if (typeof data === 'object') {
                    for (const [key, val] of Object.entries(data)) {
                        if (key === 'action' || key === 'token') continue;
                        const content = typeof val === 'string' ? val : (val && val.content);
                        if (content && typeof content === 'string') {
                            writeFileSafely(key, content, timestamp);
                            updatedFiles.push(key);
                        }
                    }
                }

                console.log(`[AI Bridge] Push All synced ${updatedFiles.length} file(s): ${updatedFiles.join(', ')}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, updated: updatedFiles }));

            } catch (err) {
                console.error('[AI Bridge Error]:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

function writeFileSafely(relPath, content, timestamp) {
    const fullPath = path.join(WORKSPACE_DIR, relPath);
    if (fs.existsSync(fullPath)) {
        const backupName = `${path.basename(relPath)}.${timestamp}.bak`;
        fs.copyFileSync(fullPath, path.join(BACKUP_DIR, backupName));
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`==========================================`);
    console.log(`[AI Bridge] Online & Ready on port ${PORT}`);
    console.log(`==========================================`);
});