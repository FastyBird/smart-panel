'use strict';

const THERMOSTAT_MODES = new Set(['off', 'heat', 'cool', 'auto']);

const normalizeTargetTemperature = (value) => {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 4 || value > 35) {
		throw new TypeError('Target temperature must be a finite number between 4 and 35');
	}

	return Math.round(value * 2) / 2;
};

const normalizeThermostatMode = (value) => {
	if (typeof value !== 'string' || !THERMOSTAT_MODES.has(value)) {
		throw new TypeError('Thermostat mode must be off, heat, cool, or auto');
	}

	return value;
};

module.exports = { normalizeTargetTemperature, normalizeThermostatMode };
