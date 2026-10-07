import { describe, expect, it } from 'vitest';

import { getTailscaleSetupStages } from './setup-progress';

describe('Tailscale setup stage results', () => {
	it('does not show progress without an accepted job', () => {
		expect(getTailscaleSetupStages(null)).toEqual([]);
		expect(getTailscaleSetupStages({ state: 'complete', step: 'complete' })).toEqual([]);
	});

	it.each([
		['running', 'install', ['running', 'pending', 'pending']],
		['running', 'daemon', ['complete', 'running', 'pending']],
		['running', 'operator', ['complete', 'complete', 'running']],
		['failed', 'install', ['failed', 'pending', 'pending']],
		['failed', 'daemon', ['complete', 'failed', 'pending']],
		['failed', 'operator', ['complete', 'complete', 'failed']],
		['complete', 'complete', ['complete', 'complete', 'complete']],
	])('reconstructs ordered script results from a %s/%s snapshot', (state, step, expected) => {
		expect(getTailscaleSetupStages({ job: 'job-1', state, step }).map((stage) => stage.state)).toEqual(expected);
	});

	it.each([
		['failed', 'unknown'],
		['failed', undefined],
		['timeout', 'operator'],
		['timeout', undefined],
		['complete', 'unknown'],
		['complete', undefined],
	])('does not invent successes for %s/%s', (state, step) => {
		expect(getTailscaleSetupStages({ job: 'job-1', state, step }).map((stage) => stage.state)).toEqual(['interrupted', 'interrupted', 'interrupted']);
	});

	it('waits for a known script stage after job acceptance', () => {
		expect(getTailscaleSetupStages({ job: 'job-1', state: 'running' }).map((stage) => stage.state)).toEqual(['pending', 'pending', 'pending']);
	});
});
