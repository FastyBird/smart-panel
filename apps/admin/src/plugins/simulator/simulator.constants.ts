export const SIMULATOR_PLUGIN_PREFIX = 'simulator';

export const SIMULATOR_PLUGIN_NAME = 'simulator-plugin';

export const SIMULATOR_TYPE = 'simulator';

export const SIMULATOR_CONNECTION_STATES = [
	'connected',
	'disconnected',
	'init',
	'ready',
	'running',
	'sleeping',
	'stopped',
	'lost',
	'alert',
	'unknown',
] as const;
export type SimulatorConnectionState = (typeof SIMULATOR_CONNECTION_STATES)[number];
