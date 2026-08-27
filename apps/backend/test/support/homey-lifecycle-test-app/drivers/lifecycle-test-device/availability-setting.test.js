'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { AVAILABILITY_SETTING_ID, applyAvailabilitySetting } = require('./availability-setting');

test('applies the unavailable state only when its setting changes', async () => {
	const calls = [];

	await applyAvailabilitySetting({
		changedKeys: [AVAILABILITY_SETTING_ID],
		makeAvailable: () => calls.push('available'),
		makeUnavailable: () => calls.push('unavailable'),
		newSettings: { [AVAILABILITY_SETTING_ID]: 'unavailable' },
	});

	assert.deepEqual(calls, ['unavailable']);
});

test('applies the available state only when its setting changes', async () => {
	const calls = [];

	await applyAvailabilitySetting({
		changedKeys: [AVAILABILITY_SETTING_ID],
		makeAvailable: () => calls.push('available'),
		makeUnavailable: () => calls.push('unavailable'),
		newSettings: { [AVAILABILITY_SETTING_ID]: 'available' },
	});

	assert.deepEqual(calls, ['available']);
});

test('ignores unrelated setting updates', async () => {
	const calls = [];

	await applyAvailabilitySetting({
		changedKeys: ['unrelated'],
		makeAvailable: () => calls.push('available'),
		makeUnavailable: () => calls.push('unavailable'),
		newSettings: { [AVAILABILITY_SETTING_ID]: 'unavailable' },
	});

	assert.deepEqual(calls, []);
});

test('rejects unsupported availability values', async () => {
	await assert.rejects(
		applyAvailabilitySetting({
			changedKeys: [AVAILABILITY_SETTING_ID],
			makeAvailable: () => undefined,
			makeUnavailable: () => undefined,
			newSettings: { [AVAILABILITY_SETTING_ID]: 'unexpected' },
		}),
		/Unsupported lifecycle availability setting/,
	);
});
