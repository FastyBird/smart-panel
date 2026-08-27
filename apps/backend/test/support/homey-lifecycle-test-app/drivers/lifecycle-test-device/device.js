'use strict';

const Homey = require('homey');

const { scheduleAvailabilityCycle } = require('./availability-cycle');

module.exports = class LifecycleTestDevice extends Homey.Device {
	async onInit() {
		this.cancelAvailabilityCycle = null;
		this.log('Disposable lifecycle test device initialized');
	}

	async onRenamed() {
		this.cancelAvailabilityCycle?.();
		this.cancelAvailabilityCycle = scheduleAvailabilityCycle({
			makeAvailable: () => this.setAvailable(),
			makeUnavailable: () => this.setUnavailable('Smart Panel lifecycle evidence in progress'),
			onError: () => this.error('Lifecycle availability cycle failed'),
		});
	}

	async onDeleted() {
		this.cancelAvailabilityCycle?.();
		this.cancelAvailabilityCycle = null;
	}
};
