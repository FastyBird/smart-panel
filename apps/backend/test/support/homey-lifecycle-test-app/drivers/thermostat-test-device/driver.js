'use strict';

const Homey = require('homey');

const DEVICE_MARKER = 'fbsp-thermostat-disposable-device';
const INITIAL_NAME = 'FBSP Thermostat Test';

module.exports = class ThermostatTestDriver extends Homey.Driver {
	async onPairListDevices() {
		return [
			{
				name: INITIAL_NAME,
				data: { id: DEVICE_MARKER },
			},
		];
	}
};
