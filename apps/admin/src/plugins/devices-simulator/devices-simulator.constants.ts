export const DEVICES_SIMULATOR_PLUGIN_PREFIX = 'devices-simulator';

export const DEVICES_SIMULATOR_PLUGIN_NAME = 'devices-simulator-plugin';

export const DEVICES_SIMULATOR_TYPE = 'devices-simulator';

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
