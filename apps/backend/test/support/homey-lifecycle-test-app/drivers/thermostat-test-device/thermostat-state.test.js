'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeTargetTemperature, normalizeThermostatMode } = require('./thermostat-state');

test('normalizes reversible target temperatures to the advertised half-degree step', () => {
	assert.equal(normalizeTargetTemperature(22.24), 22);
	assert.equal(normalizeTargetTemperature(22.26), 22.5);
	assert.equal(normalizeTargetTemperature(4), 4);
	assert.equal(normalizeTargetTemperature(35), 35);
});

test('rejects invalid target temperatures', () => {
	for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 3.5, 35.5, '22']) {
		assert.throws(() => normalizeTargetTemperature(value), TypeError);
	}
});

test('accepts only the thermostat modes exposed by the disposable driver', () => {
	for (const mode of ['off', 'heat', 'cool', 'auto']) assert.equal(normalizeThermostatMode(mode), mode);
	for (const mode of ['heat_cool', 'fan', '', true]) assert.throws(() => normalizeThermostatMode(mode), TypeError);
});
