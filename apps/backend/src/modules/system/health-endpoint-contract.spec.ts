import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { API_PREFIX, MODULES_PREFIX } from '../../app.constants';

import { SYSTEM_MODULE_PREFIX } from './system.constants';

/**
 * The container health probes hard-code the health route. When they drift from
 * the route the app actually serves, the probe just 404s forever: the server
 * container never reports healthy, and anything gated on `service_healthy`
 * (the admin container) never starts. Nothing fails loudly, so pin the two
 * together here.
 */
describe('health endpoint deployment contract', () => {
	// src/modules/system -> src -> apps/backend -> apps -> repo root
	const repoRoot = resolve(__dirname, '../../../../..');

	// `main.ts` sets a global prefix and URI versioning with `defaultVersion: '1'`,
	// so Nest serves `/{prefix}/v1/...`. The system controller is mounted at
	// `system` inside the system module, exposing `health`.
	const healthPath = `/${API_PREFIX}/v1/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/health`;

	const probes = ['docker/dev/docker-compose.yml', 'docker/prod/docker-compose.yml', 'docker/prod/Dockerfile'];

	it.each(probes)('%s probes the health route the app serves', (file) => {
		const contents = readFileSync(join(repoRoot, file), 'utf8');

		// Guard against the stale `/api/system/health` shape that skips the
		// version segment and the modules prefix.
		expect(contents).toContain(healthPath);
	});
});
