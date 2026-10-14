import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInstallationCli } from './thermostat-installation.mjs';

const claim = '00000000-0000-4000-8000-000000000001';
const environment = { SP_API_URL: 'http://127.0.0.1:3000', SP_USER_ACCESS_TOKEN: 'fixture-only' };
test('inspect uses the authenticated panel API without leaking the credential or artifact', async () => {
	let display;
	await runInstallationCli(['inspect',claim],environment,async (url, options) => {
		assert.equal(url.pathname, `/api/v1/plugins/devices-virtual/producers/thermostat-installations/${claim}`);
		assert.equal(options.method,'GET');
		assert.equal(options.headers.Authorization, 'Bearer fixture-only');
		return { ok: true, json: async () => ({ data: { readiness: 'blocked', artifact: 'review source' } }) };
	}, (value) => { display = value; });
	assert.equal(display.includes('fixture-only'),false);
	assert.equal(display.includes('review source'),false);
});
test('verification is explicit and carries the expected revision', async () => {
	await runInstallationCli(['verify',claim,'2'],environment,async (url, options) => {
		assert.equal(url.pathname.endsWith('/verify'),true);
		assert.equal(options.method,'POST'); assert.deepEqual(JSON.parse(options.body),{ expected_revision: 2 });
		return { ok: true, json: async () => ({ data: { readiness: 'blocked' } }) };
	}, () => {});
});
test('refuses missing revision, credential-bearing URLs and unauthenticated operations before any request', async () => {
	const request = () => { throw new Error('unexpected network'); };
	await assert.rejects(runInstallationCli(['verify',claim],environment,request),/revision/);
	await assert.rejects(runInstallationCli(['inspect',claim],{...environment,SP_API_URL:'http://user:pass@localhost'},request),/credentials/);
	await assert.rejects(runInstallationCli(['inspect',claim],{...environment,SP_USER_ACCESS_TOKEN:''},request),/SP_USER_ACCESS_TOKEN/);
});
