/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(Logger.prototype.warn).toHaveBeenCalledWith(...)` reads the
mocked method off the prototype directly (the established pattern for
asserting on `createExtensionLogger` output in this codebase), which ESLint
otherwise flags as an unsafe unbound reference.
*/
import { FastifyRequest } from 'fastify';
import { IncomingMessage } from 'node:http';
import { Socket } from 'socket.io';

import { Logger } from '@nestjs/common';

import { ClientAddressService } from './client-address.service';
import { TrustedProxyRegistryService } from './trusted-proxy-registry.service';

type Handshake = Socket['handshake'];

function fastifyRequest(
	headers: Record<string, string | string[]>,
	remoteAddress: string,
	encrypted = false,
): FastifyRequest {
	return {
		headers,
		raw: { socket: { remoteAddress, encrypted } },
	} as unknown as FastifyRequest;
}

function incomingMessage(headers: Record<string, string | string[]>, remoteAddress: string): IncomingMessage {
	return {
		headers,
		socket: { remoteAddress },
	} as unknown as IncomingMessage;
}

function handshake(headers: Record<string, string | string[]>, address: string, secure = false): Handshake {
	return { headers, address, secure } as unknown as Handshake;
}

describe('ClientAddressService', () => {
	let registry: TrustedProxyRegistryService;
	let service: ClientAddressService;

	const trust = (...addresses: string[]) => registry.register({ id: 'test', addresses: () => addresses });

	beforeEach(() => {
		registry = new TrustedProxyRegistryService();
		service = new ClientAddressService(registry);
		// `jest.setup.ts` re-installs this spy every test but reuses the
		// same mock instance, so call history otherwise leaks across `it`
		// blocks within this file.
		(Logger.prototype.warn as jest.Mock).mockClear();
	});

	describe('untrusted peer', () => {
		it('returns the peer address and ignores X-Forwarded-For', () => {
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '198.51.100.1',
				forwarded: false,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('ignores X-Forwarded-Proto too, falling back to the raw connection state', () => {
			const request = fastifyRequest(
				{ 'x-forwarded-for': '203.0.113.5', 'x-forwarded-proto': 'https' },
				'198.51.100.1',
				false,
			);

			expect(service.resolve(request).secure).toBe(false);
		});

		it('logs a warning once per peer per hour when forwarded headers are present', () => {
			const nowSpy = jest.spyOn(Date, 'now');
			nowSpy.mockReturnValue(1_000_000);

			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1');
			service.resolve(request);
			service.resolve(request);

			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				'[ClientAddressService] Forwarded headers ignored from untrusted peer: 198.51.100.1',
				expect.objectContaining({ tag: 'api-module' }),
			);

			// Still inside the one-hour window: no additional warning.
			nowSpy.mockReturnValue(1_000_000 + 30 * 60 * 1000);
			service.resolve(request);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);

			// Past the one-hour window: warns again.
			nowSpy.mockReturnValue(1_000_000 + 61 * 60 * 1000);
			service.resolve(request);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);

			nowSpy.mockRestore();
		});

		it('does not warn when no forwarded headers are present', () => {
			const request = fastifyRequest({}, '198.51.100.1');
			service.resolve(request);

			expect(Logger.prototype.warn).not.toHaveBeenCalled();
		});

		it('bounds the per-peer warning map so it cannot grow without limit', () => {
			for (let i = 0; i < 1500; i++) {
				const peer = `198.51.${Math.floor(i / 256)}.${i % 256}`;
				service.resolve(fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, peer));
			}

			const warnings = (service as unknown as { untrustedWarnings: Map<string, number> }).untrustedWarnings;
			expect(warnings.size).toBeLessThanOrEqual(1000);
		});
	});

	describe('trusted peer', () => {
		it('resolves a single untrusted hop in X-Forwarded-For', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.5',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('walks past two trusted hops to the right-most untrusted entry', () => {
			trust('198.51.100.1', '198.51.100.2');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5, 198.51.100.2, 198.51.100.1' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.5',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('falls back to the left-most entry when every hop is trusted', () => {
			trust('198.51.100.1', '198.51.100.2');
			const request = fastifyRequest({ 'x-forwarded-for': '198.51.100.2, 198.51.100.1' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '198.51.100.2',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('trusts a peer inside a registered IPv4 CIDR range', () => {
			trust('10.0.0.0/8');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '10.1.2.3');

			expect(service.resolve(request).address).toBe('203.0.113.5');
			expect(service.resolve(request).forwarded).toBe(true);
		});

		it('trusts a peer inside a registered IPv6 CIDR range', () => {
			trust('fc00::/7');
			const request = fastifyRequest({ 'x-forwarded-for': '2001:db8::1' }, 'fc00::1234');

			expect(service.resolve(request)).toEqual({
				address: '2001:db8::1',
				forwarded: true,
				secure: false,
				peer: 'fc00::1234',
			});
		});

		it('falls back to the peer address when X-Forwarded-For is malformed', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5, not-an-ip' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '198.51.100.1',
				forwarded: false,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('does not fall through to X-Real-IP when X-Forwarded-For is malformed', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': 'garbage', 'x-real-ip': '203.0.113.9' }, '198.51.100.1');

			expect(service.resolve(request).address).toBe('198.51.100.1');
			expect(service.resolve(request).forwarded).toBe(false);
		});

		it('falls back to the peer address when no forwarded headers are present at all', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({}, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '198.51.100.1',
				forwarded: false,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('falls back to X-Real-IP when X-Forwarded-For is absent', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-real-ip': '203.0.113.9' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.9',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('falls back to CF-Connecting-IP when neither X-Forwarded-For nor X-Real-IP are present', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'cf-connecting-ip': '203.0.113.9' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.9',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('marks the resolved address secure when X-Forwarded-Proto is https', () => {
			trust('198.51.100.1');
			const request = fastifyRequest(
				{ 'x-forwarded-for': '203.0.113.5', 'x-forwarded-proto': 'https' },
				'198.51.100.1',
			);

			expect(service.resolve(request).secure).toBe(true);
		});

		it('is not secure when X-Forwarded-Proto is present but not https', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5', 'x-forwarded-proto': 'http' }, '198.51.100.1');

			expect(service.resolve(request).secure).toBe(false);
		});

		it('falls back to the raw connection state when X-Forwarded-Proto is absent', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1', true);

			expect(service.resolve(request).secure).toBe(true);
		});
	});

	describe('request shape adapters', () => {
		it('resolves a plain IncomingMessage the same way as a FastifyRequest', () => {
			trust('198.51.100.1');
			const request = incomingMessage({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.5',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('resolves a socket.io handshake using handshake.headers and handshake.address', () => {
			trust('198.51.100.1');
			const client = handshake({ 'x-forwarded-for': '203.0.113.5' }, '198.51.100.1');

			expect(service.resolve(client)).toEqual({
				address: '203.0.113.5',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});

		it('does not corrupt an IPv6 handshake address (no port to strip)', () => {
			trust('::1');
			const client = handshake({ 'x-forwarded-for': '2001:db8::42' }, '::1');

			expect(service.resolve(client).peer).toBe('::1');
			expect(service.resolve(client).address).toBe('2001:db8::42');
		});

		it('uses handshake.secure as the base secure state', () => {
			const client = handshake({}, '198.51.100.1', true);

			expect(service.resolve(client)).toEqual({
				address: '198.51.100.1',
				forwarded: false,
				secure: true,
				peer: '198.51.100.1',
			});
		});
	});

	describe('address normalisation', () => {
		it('normalises an IPv4-mapped IPv6 peer before matching the trust set', () => {
			trust('198.51.100.1');
			const request = fastifyRequest({ 'x-forwarded-for': '203.0.113.5' }, '::ffff:198.51.100.1');

			expect(service.resolve(request)).toEqual({
				address: '203.0.113.5',
				forwarded: true,
				secure: false,
				peer: '198.51.100.1',
			});
		});
	});
});
