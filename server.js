const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const assetsDirectory = path.join(root, "Assets");
const publicDirectory = path.join(root, "public");
const indexPath = path.join(root, ".asset-index.json");
const port = Number(process.env.PORT) || 4000;
const maxUploadSize = 25 * 1024 * 1024;

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const uploadExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function saveAssets() {
  const temporaryPath = `${indexPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(assets, null, 2));
  fs.renameSync(temporaryPath, indexPath);
}

function createAssetId() {
  let id;
  do {
    id = crypto.randomBytes(5).toString("hex");
  } while (assets.some((asset) => asset.id === id));
  return id;
}

function syncAssets() {
  const previous = JSON.stringify(assets);
  assets = assets.filter((asset) => fs.existsSync(path.join(assetsDirectory, asset.fileName)));
  const knownFiles = new Set(assets.map((asset) => asset.fileName));

  for (const entry of fs.readdirSync(assetsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || knownFiles.has(entry.name)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!contentTypes[extension]) continue;

    const stats = fs.statSync(path.join(assetsDirectory, entry.name));
    assets.push({
      id: createAssetId(),
      name: entry.name,
      fileName: entry.name,
      type: contentTypes[extension],
      size: stats.size,
    });
    knownFiles.add(entry.name);
  }

  assets.sort((first, second) => first.name.localeCompare(second.name));
  if (JSON.stringify(assets) !== previous) saveAssets();
}

function readAssetIndex() {
  try {
    const indexedAssets = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    if (!Array.isArray(indexedAssets)) throw new Error("Asset index must be an array.");
    return indexedAssets.filter((asset) =>
      asset && /^[a-f0-9]{10}$/.test(asset.id) &&
      typeof asset.name === "string" && typeof asset.fileName === "string" &&
      typeof asset.type === "string" && Number.isFinite(asset.size));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

let assets = readAssetIndex();
syncAssets();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function sendFile(request, response, filePath) {
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
    response.end(request.method === "HEAD" ? undefined : contents);
  });
}

function handleUpload(request, response) {
  const encodedName = request.headers["x-file-name"];
  if (typeof encodedName !== "string") {
    request.resume();
    sendJson(response, 400, { error: "X-File-Name header is required." });
    return;
  }

  let name;
  try {
    name = path.basename(decodeURIComponent(encodedName).replace(/[\\/]/g, "/"))
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim();
  } catch {
    request.resume();
    sendJson(response, 400, { error: "Invalid file name." });
    return;
  }

  const extension = path.extname(name).toLowerCase();
  if (!name || name.length > 255 || !uploadExtensions.has(extension)) {
    request.resume();
    sendJson(response, 415, { error: "Upload a PNG, JPEG, GIF, WebP, or AVIF image." });
    return;
  }

  if (Number(request.headers["content-length"]) > maxUploadSize) {
    request.resume();
    sendJson(response, 413, { error: "Images must be 25 MB or smaller." });
    return;
  }

  const chunks = [];
  let size = 0;
  let rejected = false;
  request.on("data", (chunk) => {
    if (rejected) return;
    size += chunk.length;
    if (size > maxUploadSize) {
      rejected = true;
      chunks.length = 0;
      sendJson(response, 413, { error: "Images must be 25 MB or smaller." });
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    if (rejected) return;

    const id = createAssetId();
    const fileName = `${id}${extension}`;
    const filePath = path.join(assetsDirectory, fileName);
    const asset = {
      id,
      name,
      fileName,
      type: contentTypes[extension],
      size,
    };

    try {
      fs.writeFileSync(filePath, Buffer.concat(chunks), { flag: "wx" });
      assets.push(asset);
      assets.sort((first, second) => first.name.localeCompare(second.name));
      saveAssets();
    } catch {
      assets = assets.filter((item) => item.id !== id);
      fs.rmSync(filePath, { force: true });
      sendJson(response, 500, { error: "Unable to save this image." });
      return;
    }

    const origin = (process.env.PUBLIC_ORIGIN || `http://${request.headers.host || `localhost:${port}`}`).replace(/\/$/, "");
    sendJson(response, 201, {
      ...asset,
      extension: extension.slice(1).toUpperCase(),
      url: `${origin}/asset/${id}`,
    });
  });
}

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (request.method === "POST" && pathname === "/api/assets") {
    handleUpload(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD, POST" });
    response.end("Method not allowed");
    return;
  }

  if (pathname === "/api/links") {
    syncAssets();
    const origin = (process.env.PUBLIC_ORIGIN || `http://${request.headers.host || `localhost:${port}`}`).replace(/\/$/, "");
    const listedAssets = assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      extension: path.extname(asset.name).slice(1).toUpperCase(),
      type: asset.type,
      size: asset.size,
      url: `${origin}/asset/${asset.id}`,
    }));

    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify({ assets: listedAssets }));
    return;
  }

  if (pathname.startsWith("/asset/")) {
    const id = pathname.slice("/asset/".length);
    const asset = assets.find((item) => item.id === id);
    if (!asset || !/^[a-f0-9]{10}$/.test(id)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    sendFile(request, response, path.join(assetsDirectory, asset.fileName));
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

    sendFile(request, response, path.join(assetsDirectory, assetName));
    return;
  }

  const publicFiles = {
    "/": "index.html",
    "/app.js": "app.js",
    "/styles.css": "styles.css",
  };
  const fileName = publicFiles[pathname];
  if (fileName) {
    sendFile(request, response, path.join(publicDirectory, fileName));
    return;
  }

  response.writeHead(404);
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Lyoko Asset Browser running at http://localhost:${port}`);
});