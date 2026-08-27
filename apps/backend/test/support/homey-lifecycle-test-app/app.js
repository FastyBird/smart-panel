'use strict';

const Homey = require('homey');

module.exports = class LifecycleTestApp extends Homey.App {
	async onInit() {
		this.log('Smart Panel lifecycle test app initialized');
	}
};
