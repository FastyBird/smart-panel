import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { AddressInfo } from 'net';
import * as tls from 'tls';

import { protectTlsServerOptions } from './protect-tls';

// TEST SUPPORT ONLY: a loopback HTTPS server with the committed test certificates, for the Protect client specs.

export interface ProtectTestServer {
	port: number;
	secureConnections: number;
	requests: http.IncomingMessage[];
	close: () => Promise<void>;
}

export async function startProtectTestServer(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
	options: https.ServerOptions = protectTlsServerOptions(),
): Promise<ProtectTestServer> {
	const sockets = new Set<net.Socket>();
	const requests: http.IncomingMessage[] = [];
	const state = { secureConnections: 0 };
	const server = https.createServer(options, (req, res) => {
		requests.push(req);
		handler(req, res);
	});

	server.on('secureConnection', (socket: tls.TLSSocket) => {
		state.secureConnections += 1;
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		socket.on('error', () => undefined);
	});
	server.on('tlsClientError', () => undefined);

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	return {
		port: (server.address() as AddressInfo).port,
		get secureConnections() {
			return state.secureConnections;
		},
		requests,
		close: () =>
			new Promise<void>((resolve) => {
				sockets.forEach((socket) => socket.destroy());
				server.close(() => resolve());
			}),
	};
}
