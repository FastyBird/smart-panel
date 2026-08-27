'use strict';

const Homey = require('homey');

const DEVICE_MARKER = 'fbsp-lifecycle-disposable-device';
const INITIAL_NAME = 'FBSP Lifecycle Initial';

module.exports = class LifecycleTestDriver extends Homey.Driver {
	async onPairListDevices() {
		return [
			{
				name: INITIAL_NAME,
				data: { id: DEVICE_MARKER },
			},
		];
	}
};
