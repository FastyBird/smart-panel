'use strict';

const Homey = require('homey');

const { applyAvailabilitySetting } = require('./availability-setting');

module.exports = class LifecycleTestDevice extends Homey.Device {
	async onInit() {
		this.log('Disposable lifecycle test device initialized');
	}

	async onSettings({ changedKeys, newSettings }) {
		await applyAvailabilitySetting({
			changedKeys,
			makeAvailable: () => this.setAvailable(),
			makeUnavailable: () => this.setUnavailable('Smart Panel lifecycle evidence in progress'),
			newSettings,
		});
	}
};
