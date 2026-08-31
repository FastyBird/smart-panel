'use strict';

const Homey = require('homey');

const { normalizeTargetTemperature, normalizeThermostatMode } = require('./thermostat-state');

const INITIAL_VALUES = {
	measure_temperature: 21,
	target_temperature: 22,
	thermostat_mode: 'off',
};

module.exports = class ThermostatTestDevice extends Homey.Device {
	async onInit() {
		for (const [capabilityId, value] of Object.entries(INITIAL_VALUES)) {
			if (this.getCapabilityValue(capabilityId) === null) {
				await this.setCapabilityValue(capabilityId, value);
			}
		}

		this.registerCapabilityListener('target_temperature', async (value) => {
			await this.setCapabilityValue('target_temperature', normalizeTargetTemperature(value));
		});
		this.registerCapabilityListener('thermostat_mode', async (value) => {
			await this.setCapabilityValue('thermostat_mode', normalizeThermostatMode(value));
		});

		this.log('Disposable thermostat test device initialized');
	}
};
