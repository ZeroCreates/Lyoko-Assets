# Lyoko Asset Browser

A small, dependency-free Node.js app for browsing files in `Assets/` and sharing direct links.

## Run

Requires Node.js 18 or later.

```sh
npm start
```

Open <http://localhost:3000>. Set `PORT` to use a different port. Set `PUBLIC_ORIGIN` when the server is behind a proxy or needs to publish links using a public hostname.

## Link provider

`GET /api/links` returns JSON with a persistent ID, ID-based URL, and basic file metadata for every supported asset in `Assets/`:

```json
{
  "assets": [
    {
      "id": "a1b2c3d4e5",
      "name": "Lyoko Form Normal.png",
      "extension": "PNG",
      "type": "image/png",
      "size": 12345,
      "url": "http://localhost:3000/asset/a1b2c3d4e5.png"
    }
  ]
}
```

Open the browser and choose **Add assets** to upload PNG, JPEG, GIF, WebP, or AVIF images up to 25 MB each. Each upload gets a persistent ID. Click an ID in its asset card to copy the full link, or use its direct URL, for example `GET /asset/a1b2c3d4e5.png`. IDs are saved in `.asset-index.json` and remain stable across restarts. Existing direct filename links at `GET /assets/<filename>` continue to work.

`POST /api/assets` accepts one raw image per request with its URL-encoded original name in the `X-File-Name` header. The browser handles this automatically. The link-provider endpoint remains read-only and allows cross-origin GET requests.