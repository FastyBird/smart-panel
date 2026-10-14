#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

/** Authenticated operator workflow. Device deployment is deliberately a separate approved action. */
export async function runInstallationCli(args, environment, request = fetch, output = console.log) {
	const [action, claim, revisionOrFile, file] = args;
	if (!['inspect', 'stage', 'artifact', 'verify', 'revoke'].includes(action) || !/^[a-f\d-]{36}$/i.test(claim ?? ''))
		throw new Error('Usage: thermostat-installation.mjs inspect|artifact|stage|verify|revoke CLAIM [REVISION|FILE] [SETUP_JSON]');
	const base = new URL(environment.SP_API_URL);
	if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
		throw new Error('SP_API_URL must be the panel origin without credentials/query.');
	if (!environment.SP_USER_ACCESS_TOKEN) throw new Error('Provide an owner/admin user-session SP_USER_ACCESS_TOKEN through the environment.');
	const revision = ['stage', 'verify', 'revoke'].includes(action) ? Number(revisionOrFile) : undefined;
	if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < (action === 'stage' ? 0 : 1)))
		throw new Error('A current CAS revision is required.');
	let body;
	if (action === 'stage') {
		const input = JSON.parse(await readFile(file, 'utf8'));
		if (Object.keys(input).some((key) => !['setup', 'operator_attestations'].includes(key)))
			throw new Error('Setup file accepts only setup and operator_attestations; no qualification/proof flags.');
		body = { expected_revision: revision, ...input };
	} else if (revision !== undefined) body = { expected_revision: revision };
	const url = new URL(`/api/v1/plugins/devices-virtual/producers/thermostat-installations/${claim}${['verify', 'revoke'].includes(action) ? '/' + action : ''}`, base);
	const result = await request(url, {
		method: action === 'stage' ? 'PUT' : ['verify', 'revoke'].includes(action) ? 'POST' : 'GET',
		redirect: 'error', signal: AbortSignal.timeout(15000),
		headers: { Authorization: `Bearer ${environment.SP_USER_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	if (!result.ok) throw new Error(`Panel rejected the operation (${result.status}); inspect the current revision/readiness.`);
	const { data } = await result.json();
	if (action === 'artifact') {
		if (!data.artifact || !revisionOrFile) throw new Error('No artifact available; supply an output filename and inspect blockers.');
		await writeFile(revisionOrFile, data.artifact, { mode: 0o600, flag: 'wx' });
		output(JSON.stringify({ file: revisionOrFile, source_hash: data.source_hash, readiness: data.readiness, reasons: data.reasons }));
	} else {
		const { artifact: _artifact, ...review } = data;
		output(JSON.stringify(review, null, 2));
	}
}
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
	runInstallationCli(process.argv.slice(2), process.env).catch((error) => {
		console.error(error instanceof Error ? error.message : 'Installation operation failed.');
		process.exitCode = 1;
	});
}
