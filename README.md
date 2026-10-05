# Lyoko Asset Browser

A small, dependency-free Node.js app for browsing files in `Assets/` and sharing direct links.

## Run

Requires Node.js 18 or later.

```sh
npm start
```

Open <http://localhost:3000>. Set `PORT` to use a different port. Set `PUBLIC_ORIGIN` when the server is behind a proxy or needs to publish links using a public hostname.

## Link provider

`GET /api/links` returns JSON with the direct URL and basic file metadata for every supported asset in `Assets/`:

```json
{
  "assets": [
    {
      "name": "Lyoko Form Normal.png",
      "extension": "PNG",
      "type": "image/png",
      "size": 12345,
      "url": "http://localhost:3000/assets/Lyoko%20Form%20Normal.png"
    }
  ]
}
```

The app refreshes the listing each time the endpoint is requested. Direct files are served from `GET /assets/<filename>`. The endpoint is read-only and allows cross-origin GET requests.