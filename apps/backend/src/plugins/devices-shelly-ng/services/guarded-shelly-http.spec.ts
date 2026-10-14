import { EventEmitter } from 'node:events';
import { ClientRequest, IncomingMessage, request as httpRequest } from 'node:http';
import { Socket } from 'node:net';

import { guardedShellyHttp } from './guarded-shelly-http';

class HttpFixture {
	readonly ends = jest.fn();
	readonly request = Object.assign(new EventEmitter(), {
		end: this.ends,
		destroy: jest.fn((error?: Error) => {
			if (error) this.request.emit('error', error);
		}),
	}) as unknown as ClientRequest;
	readonly socket = Object.assign(new EventEmitter(), { connecting: true }) as unknown as Socket;
	responseCallback: (response: IncomingMessage) => void;
	readonly factory = ((_url, _options, callback) => {
		this.responseCallback = callback;
		return this.request;
	}) as typeof httpRequest;
	connect(): void {
		this.request.emit('socket', this.socket);
		this.socket.emit('connect');
	}
	answer(body = '{"nonce":"fixture","result":{"output":false}}', statusCode = 200): void {
		const response = Object.assign(new EventEmitter(), {
			statusCode,
			headers: { 'content-type': 'application/json' },
			setEncoding: jest.fn(),
			resume: jest.fn(),
		}) as unknown as IncomingMessage;
		this.responseCallback(response);
		response.emit('data', body);
		response.emit('end');
	}
}
describe('guarded Shelly HTTP actual request header send', () => {
	it('does not write an ON request after authority changes during connect', async () => {
		const fixture = new HttpFixture();
		let admitted = true;
		const onSend = jest.fn();
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=on&nonce=fixture'),
			Date.now() + 1000,
			() => admitted,
			fixture.factory,
			onSend,
		).catch(() => null);
		admitted = false;
		fixture.connect();
		expect(await request).toBeNull();
		expect(fixture.ends).not.toHaveBeenCalled();
		expect(onSend).not.toHaveBeenCalled();
	});
	it('does not mark an ON send when admission throws before headers are sent', async () => {
		const fixture = new HttpFixture();
		const onSend = jest.fn();
		let inspecting = true;
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=on&nonce=fixture'),
			Date.now() + 1000,
			() => {
				if (!inspecting) throw new Error('Admission failed');
				return true;
			},
			fixture.factory,
			onSend,
		).catch(() => null);
		inspecting = false;
		fixture.connect();
		expect(await request).toBeNull();
		expect(onSend).not.toHaveBeenCalled();
		expect(fixture.ends).not.toHaveBeenCalled();
	});
	it('marks possible send before end, including a synchronous end failure', async () => {
		const fixture = new HttpFixture();
		const onSend = jest.fn();
		fixture.ends.mockImplementation(() => {
			expect(onSend).toHaveBeenCalledTimes(1);
			throw new Error('Write failed');
		});
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=on&nonce=fixture'),
			Date.now() + 1000,
			() => true,
			fixture.factory,
			onSend,
		).catch(() => null);
		fixture.connect();
		expect(await request).toBeNull();
		expect(onSend).toHaveBeenCalledTimes(1);
		expect(fixture.ends).toHaveBeenCalledTimes(1);
	});
	it('bounds connect waits and prevents a timed-out request from being sent later', async () => {
		jest.useFakeTimers();
		const fixture = new HttpFixture();
		const onSend = jest.fn();
		try {
			const request = guardedShellyHttp(
				new URL('http://fixture.invalid/script/1/spguard?action=on&nonce=fixture'),
				Date.now() + 1000,
				() => true,
				fixture.factory,
				onSend,
			).catch(() => null);
			await jest.advanceTimersByTimeAsync(1001);
			expect(await request).toBeNull();
			fixture.connect();
			expect(fixture.ends).not.toHaveBeenCalled();
			expect(onSend).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});
	it('accepts a matched live response only while source authority is current', async () => {
		const fixture = new HttpFixture();
		let admitted = true;
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=fence&nonce=fixture'),
			Date.now() + 1000,
			() => admitted,
			fixture.factory,
		).catch(() => null);
		fixture.connect();
		admitted = false;
		fixture.answer();
		expect(await request).toBeNull();
	});
	it.each([401, 302])('does not retry unauthenticated or redirected HTTP status %s', async (code) => {
		const fixture = new HttpFixture();
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=fence&nonce=fixture'),
			Date.now() + 1000,
			() => true,
			fixture.factory,
		).catch(() => null);
		fixture.connect();
		fixture.answer('', code);
		expect(await request).toBeNull();
		expect(fixture.ends).toHaveBeenCalledTimes(1);
	});
	it('refuses a cached reply with an older request nonce', async () => {
		const fixture = new HttpFixture();
		const request = guardedShellyHttp(
			new URL('http://fixture.invalid/script/1/spguard?action=fence&nonce=fixture'),
			Date.now() + 1000,
			() => true,
			fixture.factory,
		).catch(() => null);
		fixture.connect();
		fixture.answer('{"nonce":"older-request","result":{"output":false}}');
		expect(await request).toBeNull();
	});

	it('accepts only the bounded endpoint result envelope', async () => {
		const fixture = new HttpFixture();
		const request = guardedShellyHttp<{ output: boolean }>(
			new URL('http://fixture.invalid/script/1/spguard?action=fence&nonce=fixture'),
			Date.now() + 1000,
			() => true,
			fixture.factory,
		);
		fixture.connect();
		fixture.answer();
		expect(await request).toEqual({ output: false });
	});
});
