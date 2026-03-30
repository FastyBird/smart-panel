# get.smart-panel.fastybird.com

Minimal site that serves Smart Panel install scripts from the GitHub repository.

- **Browsers** visiting the root see a landing page with install commands
- **`curl`/`wget`** hitting the root get the server install script directly
- **`/display`** always returns the display install script

## How it works

A Cloudflare Pages project with an Advanced Mode Worker (`_worker.js`) that detects CLI
tools via `User-Agent` / `Accept` headers and proxies the corresponding script from
`raw.githubusercontent.com`. Browser requests fall through to the static `index.html`.

## Deploy to Cloudflare Pages

1. Create a new Cloudflare Pages project
2. Set the build output directory to `public`
3. Point the custom domain to `get.smart-panel.fastybird.com`

The `_worker.js` file is automatically picked up by Cloudflare Pages in Advanced Mode.

## Routes

| Path | CLI (`curl`, `wget`) | Browser |
|------|---------------------|---------|
| `/` | `scripts/install-server.sh` | Landing page |
| `/display` | `scripts/install-display.sh` | `scripts/install-display.sh` |

## Test locally

```bash
# Should return the install script
curl -fsSL http://localhost:8788

# Should return the display install script
curl -fsSL http://localhost:8788/display
```

Use [Wrangler](https://developers.cloudflare.com/workers/wrangler/) to run locally:

```bash
npx wrangler pages dev public
```
