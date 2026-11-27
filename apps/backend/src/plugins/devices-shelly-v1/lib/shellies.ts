/**
 * Wrapper module for the shellies library (CommonJS package)
 * The shellies package is a legacy CommonJS module without ESM/TypeScript support.
 * This wrapper isolates the require() usage to a single location, keeping the rest of the codebase clean.
 *
 * Note: Using require() here is necessary and intentional for this legacy package.
 */
import type { EventEmitter } from 'events';
import type { ClientRequest } from 'node:http';

import type { ShelliesLibrary, ShellyDevice } from '../interfaces/shellies.interface';
import type { ShellyStatusResponse } from '../interfaces/shelly-http.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- shellies is a CommonJS-only package
const shellies = require('shellies') as ShelliesLibrary;

export default shellies;

type StatusRequest = PromiseLike<{ body: ShellyStatusResponse }> & {
	once(event: 'request', handler: (request: { req: ClientRequest }) => void): void;
	redirects(max: number): StatusRequest;
};

/** Use the same authenticated GET as shellies.getStatus(), retaining its native dispatch evidence. */
export async function readShellyRelayStatus(
	peer: ShellyDevice,
	dispatching: () => void,
): Promise<{ sent: boolean; status?: ShellyStatusResponse }> {
	let sent = false;
	try {
		const transport = peer as ShellyDevice & { request: { get(url: string): StatusRequest } };
		const request = transport.request.get(`${peer.host}/status`).redirects(0);
		request.once('request', ({ req }) => {
			req.once('finish', () => {
				sent = true;
				dispatching();
			});
		});
		const response = await request;
		return sent ? { sent, status: response.body } : { sent };
	} catch {
		// A refused connection never flushed a request. An HTTP error or lost reply after flush was sent.
		return { sent };
	}
}

type CoIoTStatus = {
	deviceType: string;
	deviceId: string;
	host: string;
	serial: number;
	payload?: { G?: unknown };
	msg?: { code: string; _packet?: { ack: boolean } };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- use the same CoAP agent and option decoding as shellies
const coap = require('shellies/lib/coap') as { getStatus(host: string): Promise<CoIoTStatus> };

function temperatureField(peer: ShellyDevice, packet: CoIoTStatus): { serial: number; value: unknown } | null {
	if (
		!Array.isArray(packet.payload?.G) ||
		!Number.isInteger(packet.serial) ||
		packet.serial < 1 ||
		packet.serial > 65535
	)
		return null;
	const mapped = peer as ShellyDevice & { _getPropertyName: (id: number, mode: unknown) => string | undefined };
	const temperatures = packet.payload.G.filter(
		(tuple: unknown): tuple is [number, number, unknown] =>
			Array.isArray(tuple) &&
			tuple.length === 3 &&
			tuple[0] === 0 &&
			typeof tuple[1] === 'number' &&
			mapped._getPropertyName(tuple[1], peer.mode) === 'temperature',
	);
	return temperatures.length === 1 ? { serial: packet.serial, value: temperatures[0][2] } : null;
}

/** The Gen1 protocol specifies a piggybacked response to GET /cit/s. Its serial is the device's current status. */
export async function readShellyTemperature(peer: ShellyDevice): Promise<{ serial: number; value: unknown } | null> {
	const host = peer.host;
	const packet = await coap.getStatus(host);
	if (
		packet.host !== host ||
		packet.deviceType !== peer.type ||
		packet.deviceId !== peer.id ||
		packet.msg?.code !== '2.05' ||
		packet.msg._packet?.ack !== true
	)
		return null;
	return temperatureField(peer, packet);
}

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
		const peer = library.getDevice(packet.deviceType, packet.deviceId);
		const field = peer && temperatureField(peer, packet);
		if (field) callback(peer, field.serial, field.value);
	};
	library._listener.on('statusUpdate', onStatus);
	return () => library._listener.removeListener('statusUpdate', onStatus);
}
