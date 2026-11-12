import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page, Request, Route } from '@playwright/test';

/*
 * A backend for the admin, held in memory by the test: every call of the admin to `/api/v1` is answered here,
 * so the editor runs without the backend, its database or its devices. Only what the shell of the app and
 * the automation editor read is served; anything else is answered 404 and listed in `unhandled`, so a test
 * can tell when the app starts to depend on something new.
 *
 * The node type catalogue and the devices are snapshots of what the backend answers for its built-in cards
 * and for two simulator devices (`e2e/fixtures`).
 */

const API_PREFIX = '/api/v1/';

export interface IGraphNode {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

export interface IGraphEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

export interface IGraph {
	version: number;
	nodes: IGraphNode[];
	edges: IGraphEdge[];
}

export interface IStoredAutomation {
	id: string;
	name: string;
	description: string | null;
	icon: string | null;
	enabled: boolean;
	space_id: string | null;
	mode: string;
	graph: IGraph;
	revision: number;
	status: string;
	last_triggered_at: string | null;
	last_run_status: string | null;
	created_at: string;
	updated_at: string | null;
}

/** A run of an automation as the backend stores it, with its trace */
export interface IStoredRun {
	id: string;
	automation_id: string;
	revision: number;
	status: string;
	trigger_node_id: string;
	manual: boolean;
	started_at: string;
	finished_at: string | null;
	duration_ms: number | null;
	end_reason: string | null;
	trace: { trigger: { node_id: string; manual: boolean; data: Record<string, unknown> }; steps: Record<string, unknown>[]; truncated: boolean };
}

export interface IMockBackend {
	/** The automations as stored, by id */
	automations: Map<string, IStoredAutomation>;
	/** The runs as stored, newest first */
	runs: IStoredRun[];
	/** The manual runs the admin asked for: the automation and the body of each request */
	triggers: { id: string; body: Record<string, unknown> }[];
	/** The bodies of every update the admin sent */
	updates: { id: string; body: Record<string, unknown> }[];
	/** Calls nothing here answers */
	unhandled: string[];
}

interface IFixtureChannel {
	id: string;
	properties: unknown[];
}

interface IFixtureDevice {
	id: string;
	channels: IFixtureChannel[];
}

const fixture = <T>(name: string): T =>
	JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', name), 'utf-8')) as T;

const NOW = '2026-11-01T10:00:00.000Z';

const USER = {
	id: '00000000-0000-4000-8000-0000000000aa',
	created_at: NOW,
	updated_at: null,
	is_hidden: false,
	email: 'owner@example.com',
	first_name: null,
	last_name: null,
	username: 'owner',
	role: 'owner',
	language: null,
};

const base64Url = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A token the admin can read; nothing checks its signature here */
const token = (type: string): string => {
	const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

	return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: USER.id, role: USER.role, type, exp })}.signature`;
};

const envelope = (request: Request, data: unknown): string =>
	JSON.stringify({
		status: 'success',
		timestamp: new Date().toISOString(),
		request_id: '00000000-0000-4000-8000-0000000000ff',
		path: new URL(request.url()).pathname,
		method: request.method(),
		data,
		metadata: { request_duration_ms: 1, server_time: new Date().toISOString(), cpu_usage: 0 },
	});

/** A list of automations comes without their graphs */
const withoutGraph = (automation: IStoredAutomation): Partial<IStoredAutomation> => {
	const listed: Partial<IStoredAutomation> = { ...automation };

	delete listed.graph;

	return listed;
};

/**
 * Signs the page in and serves the backend from memory. Call before the first navigation.
 */
export const mockBackend = async (page: Page, baseURL: string, automations: IStoredAutomation[], runs: IStoredRun[] = []): Promise<IMockBackend> => {
	const state: IMockBackend = {
		automations: new Map(automations.map((automation) => [automation.id, structuredClone(automation)])),
		runs: structuredClone(runs),
		triggers: [],
		updates: [],
		unhandled: [],
	};

	const nodeTypes = fixture<unknown[]>('node-types.json');
	const devices = fixture<IFixtureDevice[]>('devices.json');
	const channels = devices.flatMap((device) => device.channels);

	await page.context().addCookies([
		{ name: 'token', value: token('access'), url: baseURL },
		{ name: 'refresh_token', value: token('refresh'), url: baseURL },
	]);

	// The live updates are not part of these tests: the admin works on without the socket
	await page.route('**/socket.io/**', (route: Route) => route.abort());
	await page.routeWebSocket(/\/socket\.io\//, (socket) => socket.close());

	await page.route(
		(url: URL): boolean => url.pathname.startsWith(API_PREFIX),
		async (route: Route): Promise<void> => {
			const request = route.request();
			const path = new URL(request.url()).pathname.slice(API_PREFIX.length);
			const method = request.method();

			const reply = (data: unknown, status = 200): Promise<void> =>
				route.fulfill({ status, contentType: 'application/json', body: envelope(request, data) });

			const fail = (status: number, message: string): Promise<void> =>
				route.fulfill({
					status,
					contentType: 'application/json',
					body: JSON.stringify({ status: 'error', error: { code: status, message } }),
				});

			if (method === 'GET' && path === 'modules/auth/auth/profile') {
				return reply(USER);
			}

			if (method === 'GET' && path === 'modules/system/system/onboarding') {
				return reply({ has_owner: true, onboarding_completed: true, devices_count: 2, spaces_count: 0, displays_count: 0 });
			}

			if (
				method === 'GET' &&
				(path === 'modules/extensions/discovered' ||
					path === 'modules/config/config/modules' ||
					path === 'modules/config/config/plugins' ||
					path === 'modules/notifications/notifications')
			) {
				return reply([]);
			}

			if (method === 'GET' && path === 'modules/automations/node-types') {
				return reply(nodeTypes);
			}

			if (method === 'GET' && path === 'modules/devices/devices') {
				return reply(devices);
			}

			const deviceChannels = /^modules\/devices\/devices\/([0-9a-f-]{36})\/channels$/.exec(path);

			if (method === 'GET' && deviceChannels) {
				return reply(devices.find((device) => device.id === deviceChannels[1])?.channels ?? []);
			}

			const channelProperties = /^modules\/devices\/channels\/([0-9a-f-]{36})\/properties$/.exec(path);

			if (method === 'GET' && channelProperties) {
				return reply(channels.find((channel) => channel.id === channelProperties[1])?.properties ?? []);
			}

			if (method === 'GET' && path === 'modules/automations/automations') {
				return reply([...state.automations.values()].map(withoutGraph));
			}

			if (method === 'POST' && path === 'modules/automations/automations/validate') {
				return reply({ valid: true, issues: [] });
			}

			// The editor reads the run history along with the automation, without the traces
			const history = /^modules\/automations\/automations\/([0-9a-f-]{36})\/runs$/.exec(path);

			if (method === 'GET' && history) {
				if (!state.automations.has(history[1] as string)) {
					return fail(404, 'The automation was not found.');
				}

				return reply(
					state.runs
						.filter((run) => run.automation_id === history[1])
						.map((run) => {
							const listed: Partial<IStoredRun> = { ...run };

							delete listed.trace;

							return listed;
						})
				);
			}

			const storedRun = /^modules\/automations\/runs\/([0-9a-f-]{36})$/.exec(path);

			if (method === 'GET' && storedRun) {
				const run = state.runs.find((item) => item.id === storedRun[1]);

				return run ? reply(run) : fail(404, 'Requested run does not exist');
			}

			// A manual run is started and never ends here: the steps of a run come over the socket, which these tests do not open
			const trigger = /^modules\/automations\/automations\/([0-9a-f-]{36})\/trigger$/.exec(path);

			if (method === 'POST' && trigger) {
				state.triggers.push({ id: trigger[1] as string, body: (request.postDataJSON() as Record<string, unknown> | null) ?? {} });

				return reply({
					automation_id: trigger[1],
					started: true,
					outcome: 'started',
					run_id: `00000000-0000-4000-8000-${String(state.triggers.length).padStart(12, '0')}`,
					reason: null,
				});
			}

			const detail = /^modules\/automations\/automations\/([0-9a-f-]{36})$/.exec(path);

			if (detail) {
				const automation = state.automations.get(detail[1] as string);

				if (!automation) {
					return fail(404, 'The automation was not found.');
				}

				if (method === 'GET') {
					return reply(automation);
				}

				if (method === 'PATCH') {
					const body = (request.postDataJSON() as { data: Record<string, unknown> }).data;

					state.updates.push({ id: automation.id, body: structuredClone(body) });

					// The save carries the revision it is based on (compare-and-swap)
					const { revision, ...changes } = body;

					if (revision !== automation.revision) {
						return fail(409, 'The automation was changed in the meantime.');
					}

					const updated: IStoredAutomation = {
						...automation,
						...(changes as Partial<IStoredAutomation>),
						revision: automation.revision + 1,
						updated_at: new Date().toISOString(),
					};

					state.automations.set(updated.id, updated);

					return reply(updated);
				}
			}

			state.unhandled.push(`${method} ${path}`);

			return fail(404, 'Not served by the test backend.');
		}
	);

	return state;
};
