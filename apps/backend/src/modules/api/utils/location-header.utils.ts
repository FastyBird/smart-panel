import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import { API_PREFIX, PLUGINS_PREFIX } from '../../../app.constants';

interface LocationHeaderOptions {
	isPlugin?: boolean;
}

/**
 * Sets the Location header dynamically for newly created resources
 * @param req - Fastify request object
 * @param res - Fastify response object
 * @param prefix - The module or plugin prefix (e.g., DEVICES_MODULE_PREFIX or PAGES_CARDS_PLUGIN_PREFIX)
 * @param pathSegments - Path segments to build the Location URL (e.g., 'devices', deviceId, 'channels', channelId)
 * @param options - Optional configuration. Set isPlugin: true for plugin routes (plugins are prefixed with 'plugins' in the URL).
 */
export function setLocationHeader(
	req: Request,
	res: Response,
	prefix: string,
	...args: (string | number | LocationHeaderOptions)[]
): void {
	// Extract API version from request URL
	const versionMatch = req.url.match(new RegExp(`/${API_PREFIX}/(v\\d+)`));
	const version = versionMatch ? versionMatch[1] : 'v1';

	// Build base URL from request
	const protocol = req.protocol || 'http';
	const host = req.hostname || req.headers.host || 'localhost';
	const port = req.socket?.localPort ? `:${req.socket.localPort}` : '';
	const baseUrl = `${protocol}://${host}${port}/${API_PREFIX}/${version}`;

	// Check if the last argument is an options object
	let pathSegments: (string | number)[];
	let isPlugin = false;

	if (args.length > 0) {
		const lastArg = args[args.length - 1];
		// Check if last argument is an options object (has isPlugin property or is an empty object)
		if (
			typeof lastArg === 'object' &&
			lastArg !== null &&
			!Array.isArray(lastArg) &&
			('isPlugin' in lastArg || Object.keys(lastArg).length === 0)
		) {
			const options = lastArg;
			isPlugin = options.isPlugin ?? false;
			pathSegments = args.slice(0, -1) as (string | number)[];
		} else {
			pathSegments = args as (string | number)[];
		}
	} else {
		pathSegments = [];
	}

	// Build the Location URL
	const path = pathSegments.map(String).join('/');
	const routePrefix = isPlugin ? `${PLUGINS_PREFIX}/${prefix}` : prefix;
	const locationUrl = `${baseUrl}/${routePrefix}/${path}`;

	// Set the Location header
	res.header('Location', locationUrl);
}
