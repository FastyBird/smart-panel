/**
 * Wrapper module for the shellies library (CommonJS package)
 * The shellies package is a legacy CommonJS module without ESM/TypeScript support.
 * This wrapper isolates the require() usage to a single location, keeping the rest of the codebase clean.
 *
 * Note: Using require() here is necessary and intentional for this legacy package.
 */
import type { EventEmitter } from 'events';

import type { ShelliesLibrary, ShellyDevice } from '../interfaces/shellies.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- shellies is a CommonJS-only package
const shellies = require('shellies') as ShelliesLibrary;

export default shellies;

type CoIoTStatus = { deviceType: string; deviceId: string; serial: number; payload?: { G?: unknown } };

/**
 * The installed shellies 1.x emitter only publishes coerced, *changed* property values.
 * Subscribe to its existing CoIoT listener to recover unmodified packet fields, including
 * repeated readings. Keep these two library internals here, covered by a real-package test.
 */
export function subscribeShellyTemperatures(
	callback: (peer: ShellyDevice, serial: number, value: unknown) => void,
): () => void {
	const library = shellies as ShelliesLibrary & { _listener: EventEmitter };
	const onStatus = (packet: CoIoTStatus): void => {
		const peer = library.getDevice(packet.deviceType, packet.deviceId) as
			| (ShellyDevice & { _getPropertyName: (id: number, mode: unknown) => string | undefined })
			| undefined;
		if (!peer || !Array.isArray(packet.payload?.G)) return;
		const temperatures = packet.payload.G.filter(
			(tuple: unknown): tuple is [number, number, unknown] =>
				Array.isArray(tuple) &&
				tuple.length === 3 &&
				tuple[0] === 0 &&
				typeof tuple[1] === 'number' &&
				peer._getPropertyName(tuple[1], peer.mode) === 'temperature',
		);
		if (temperatures.length === 1) callback(peer, packet.serial, temperatures[0][2]);
	};
	library._listener.on('statusUpdate', onStatus);
	return () => library._listener.removeListener('statusUpdate', onStatus);
}
