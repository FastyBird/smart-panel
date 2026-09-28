// Controlled local scheduler/clock adapter; the actual service and file writer run in this process.
const {
	PollPlacementDiagnosticsService,
} = require('../../../src/plugins/devices-shelly-ng/services/poll-placement-diagnostics.service');
const fs = require('node:fs');
let now = 1000;
PollPlacementDiagnosticsService.prototype.now = () => now;
PollPlacementDiagnosticsService.prototype.utcNow = () => new Date(Date.UTC(2026, 0, 1) + now).toISOString();
const service = new PollPlacementDiagnosticsService();
const config = JSON.parse(process.env.FB_SHELLY_POLL_PLACEMENT);
process.on('message', async (message) => {
	try {
		if (message.now !== undefined) now = message.now;
		let result;
		if (message.method) result = service[message.method](...(message.args ?? []));
		await result;
		await service.writePromise;
		process.send({ result, snapshot: service.snapshot, exists: fs.existsSync(config.exportPath) });
		if (message.method === 'onModuleDestroy') process.disconnect();
	} catch (error) {
		process.send({ error: error.message });
	}
});
