const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const assetsDirectory = path.join(root, "Assets");
const publicDirectory = path.join(root, "public");
const port = Number(process.env.PORT) || 3000;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function getAssets() {
  return fs.readdirSync(assetsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && contentTypes[path.extname(entry.name).toLowerCase()])
    .map((entry) => {
      const filePath = path.join(assetsDirectory, entry.name);
      const stats = fs.statSync(filePath);

      return {
        name: entry.name,
        extension: path.extname(entry.name).slice(1).toUpperCase(),
        type: contentTypes[path.extname(entry.name).toLowerCase()],
        size: stats.size,
      };
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}

function sendFile(response, filePath) {
  const contentType = contentTypes[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Unable to read file");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (pathname === "/api/links") {
    const origin = process.env.PUBLIC_ORIGIN || `http://${request.headers.host || `localhost:${port}`}`;
    const assets = getAssets().map((asset) => ({
      ...asset,
      url: `${origin}/assets/${encodeURIComponent(asset.name)}`,
    }));

    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify({ assets }));
    return;
  }

  if (pathname.startsWith("/assets/")) {
    let assetName;
    try {
      assetName = decodeURIComponent(pathname.slice("/assets/".length));
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (!assetName || assetName.includes("/") || assetName.includes("\\")) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    sendFile(response, path.join(assetsDirectory, assetName));
    return;
  }

  const publicFiles = {
    "/": "index.html",
    "/app.js": "app.js",
    "/styles.css": "styles.css",
  };
  const fileName = publicFiles[pathname];
  if (fileName) {
    sendFile(response, path.join(publicDirectory, fileName));
    return;
  }

  response.writeHead(404);
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Lyoko Asset Browser running at http://localhost:${port}`);
});