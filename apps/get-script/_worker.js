/**
 * Cloudflare Pages Advanced Mode Worker
 *
 * Routes:
 *   GET /         → curl/wget: proxies install-server.sh from GitHub
 *                    browser:   serves index.html landing page
 *   GET /display  → proxies install-display.sh from GitHub
 *
 * Deploy: Cloudflare Pages with this file in the project root.
 * The /public directory holds static assets (index.html).
 */

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/FastyBird/smart-panel/main/scripts';

const SCRIPT_ROUTES = {
	'/': `${GITHUB_RAW_BASE}/install-server.sh`,
	'/display': `${GITHUB_RAW_BASE}/install-display.sh`,
};

/**
 * Detect whether the request comes from a CLI tool (curl, wget, etc.)
 * rather than a web browser.
 */
function isCLI(request) {
	const ua = (request.headers.get('user-agent') || '').toLowerCase();
	const accept = (request.headers.get('accept') || '').toLowerCase();

	// Explicit CLI user-agents
	if (/^(curl|wget|httpie|fetch|powershell|python-requests)/.test(ua)) {
		return true;
	}

	// If the client doesn't accept HTML, it's most likely a CLI tool
	if (!accept.includes('text/html')) {
		return true;
	}

	return false;
}

async function proxyScript(url) {
	const response = await fetch(url, {
		headers: { 'User-Agent': 'get.smart-panel.fastybird.com' },
	});

	if (!response.ok) {
		return new Response('Script not found.\n', { status: 502 });
	}

	return new Response(response.body, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
		},
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '') || '/';

		// /display always returns the script (no HTML alternative)
		if (path === '/display') {
			return proxyScript(SCRIPT_ROUTES['/display']);
		}

		// Root path: CLI gets the script, browsers get the landing page
		if (path === '/') {
			if (isCLI(request)) {
				return proxyScript(SCRIPT_ROUTES['/']);
			}

			// Serve the static index.html for browsers
			return env.ASSETS.fetch(request);
		}

		// All other paths: try static assets (404 if not found)
		return env.ASSETS.fetch(request);
	},
};
