const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  console.log(`Request for ${req.url}`);
  
  let filePath = req.url;
  
  // Default to mockup.html if no path specified
  if (filePath === '/' || filePath === '') {
    filePath = '/mockup.html';
  }
  
  // Map the path to the appropriate directory
  if (filePath.startsWith('/extension/')) {
    // If requesting extension files, get them from the extension directory
    filePath = '../' + filePath;
  } else {
    // Serve files from the mockup directory
    filePath = '.' + filePath;
  }
  
  // Get file extension
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read and serve the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
      } else {
        console.error(`Server Error: ${error.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/mockup.html to view the mockup`);
  console.log(`The mockup demonstrates the sidebar UI with welcome screen and animation.`);
}); 