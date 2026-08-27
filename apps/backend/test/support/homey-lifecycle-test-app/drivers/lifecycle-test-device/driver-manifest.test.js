'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const manifest = require('./driver.compose.json');

test('declares the device-list and add-device pairing flow', () => {
	assert.deepEqual(manifest.pair, [
		{
			id: 'list_devices',
			template: 'list_devices',
			navigation: { next: 'add_devices' },
			options: { singular: true },
		},
		{
			id: 'add_devices',
			template: 'add_devices',
		},
	]);
});
