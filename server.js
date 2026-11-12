const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  const filePath = path.join(__dirname, url);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, "index.html"), (e2, d2) => {
        res.writeHead(e2 ? 404 : 200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
        res.end(e2 ? "Not Found" : d2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" });
    res.end(data);
  });
}).listen(PORT, () => console.log("\n Office Desk running at http://localhost:" + PORT + "\n"));
