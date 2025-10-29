import type { App } from 'vue';

export default {
	install(app: App, _options?: unknown) {
		// example: global component or route registration
		// app.component('ExampleWidget', ExampleWidget)
		// or inject routes via provided router in options, etc.
		// keep it minimal for the demo
		console.info('[example-admin] installed');
	},
};
