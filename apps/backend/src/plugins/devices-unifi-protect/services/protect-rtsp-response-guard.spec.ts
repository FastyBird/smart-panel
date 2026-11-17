import { PROTECT_RTSP_MAX_BODY_BYTES, PROTECT_RTSP_MAX_HEADER_BYTES } from '../devices-unifi-protect.constants';

import { ProtectRtspGuardError, ProtectRtspResponseGuard } from './protect-rtsp-response-guard';

const ALIAS = 'SENTINELALIASx1y2z3';

const EMPTY_PAYLOAD = Buffer.alloc(0);

const text = (value: string): Buffer => Buffer.from(value, 'latin1');

const frame = (channel: number, payload: Buffer): Buffer => {
	const header = Buffer.alloc(4);

	header[0] = 0x24;
	header[1] = channel;
	header.writeUInt16BE(payload.length, 2);

	return Buffer.concat([header, payload]);
};

const SDP = text(
	`v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=Protect\r\na=control:rtsps://h:7441/${ALIAS}/\r\n` +
		'RTSP/1.0 302 Found\r\nLocation: rtsps://10.0.0.9:7441/x\r\n\r\n',
);

const DESCRIBE_RESPONSE = Buffer.concat([
	text(
		'RTSP/1.0 200 OK\r\nCSeq: 2\r\n' +
			`Content-Base: rtsps://h:7441/${ALIAS}/\r\n` +
			`Content-Type: application/sdp\r\nContent-Length: ${SDP.length}\r\n\r\n`,
	),
	SDP,
]);

const OPTIONS_REQUEST = text(`OPTIONS rtsps://h:7441/${ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n`);
const OPTIONS_RESPONSE = text('RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY\r\n\r\n');
const DESCRIBE_REQUEST = text(
	`DESCRIBE rtsps://h:7441/${ALIAS} RTSP/1.0\r\nCSeq: 2\r\nAccept: application/sdp\r\n\r\n`,
);
const SETUP_REQUEST = text(`SETUP rtsps://h:7441/${ALIAS}/trackID=0 RTSP/1.0\r\nCSeq: 3\r\n\r\n`);
const SETUP_RESPONSE = text(
	'RTSP/1.0 200 OK\r\nCSeq: 3\r\nSession: 1\r\nTransport: RTP/AVP/TCP;interleaved=0-1\r\n\r\n',
);
const PLAY_REQUEST = text(`PLAY rtsps://h:7441/${ALIAS}/ RTSP/1.0\r\nCSeq: 4\r\nSession: 1\r\n\r\n`);
const PLAY_RESPONSE = text('RTSP/1.0 200 OK\r\nCSeq: 4\r\nSession: 1\r\n\r\n');

const FRAMES = Buffer.concat([
	frame(0, Buffer.concat([Buffer.from([0x80, 0x60]), text('RTSP/1.0 302 Found\r\nLocation: rtsps://x\r\n\r\n')])),
	frame(1, Buffer.alloc(300, 0x24)),
]);

// go2rtc's Do reads this as `$ 302 Found` (ReadResponse splits on spaces): a 302 hidden in an interleaved frame header.
const SMUGGLED_REDIRECT = Buffer.concat([
	Buffer.from([0x24, 0x20]),
	text('30'),
	text(`2 Found\r\nLocation: rtsps://10.0.0.9:7441/${ALIAS}/\r\n\r\n`),
]);

const redirectTo = (status: string): Buffer =>
	text(`RTSP/1.0 ${status} Moved\r\nCSeq: 2\r\nLocation: rtsps://10.0.0.9:7441/${ALIAS}\r\n\r\n`);

type Step = { console: Buffer } | { go2rtc: Buffer };

interface Outcome {
	output: Buffer;
	error: unknown;
}

async function run(steps: Step[]): Promise<Outcome> {
	const guard = new ProtectRtspResponseGuard();
	const output: Buffer[] = [];
	const done = new Promise<unknown>((resolve) => {
		guard.on('error', resolve);
		guard.on('end', () => resolve(null));
	});

	guard.on('data', (chunk: Buffer) => output.push(chunk));

	for (const step of steps) {
		if (guard.destroyed) {
			break;
		}

		if ('go2rtc' in step) {
			guard.observeRequests(step.go2rtc);
		} else {
			guard.write(step.console);
		}
	}

	if (!guard.destroyed) {
		guard.end();
	}

	const error = await done;

	return { output: Buffer.concat(output), error };
}

const fromConsole = (...chunks: Buffer[]): Step[] => chunks.map((chunk) => ({ console: chunk }));

const bytewise = (input: Buffer): Step[] => [...input].map((byte) => ({ console: Buffer.from([byte]) }));

const afterPlay = (...chunks: Buffer[]): Step[] => [{ go2rtc: PLAY_REQUEST }, ...fromConsole(...chunks)];

const reasonOf = (outcome: Outcome): string | null =>
	outcome.error instanceof ProtectRtspGuardError ? outcome.error.reason : null;

describe('ProtectRtspResponseGuard', () => {
	it('forwards interleaved frames and responses byte for byte at every split point', async () => {
		const before = DESCRIBE_RESPONSE;
		const after = Buffer.concat([PLAY_RESPONSE, FRAMES]);
		const input = Buffer.concat([before, after]);

		for (let index = 0; index <= before.length; index += 1) {
			const outcome = await run([
				{ go2rtc: DESCRIBE_REQUEST },
				...fromConsole(before.subarray(0, index), before.subarray(index)),
				{ go2rtc: PLAY_REQUEST },
				...fromConsole(after),
			]);

			expect(outcome.error).toBeNull();
			expect(outcome.output.equals(input)).toBe(true);
		}

		for (let index = 0; index <= after.length; index += 1) {
			const outcome = await run([
				...fromConsole(before),
				{ go2rtc: PLAY_REQUEST },
				...fromConsole(after.subarray(0, index), after.subarray(index)),
			]);

			expect(outcome.error).toBeNull();
			expect(outcome.output.equals(input)).toBe(true);
		}

		const bytes = await run([...bytewise(before), { go2rtc: PLAY_REQUEST }, ...bytewise(after)]);

		expect(bytes.error).toBeNull();
		expect(bytes.output.equals(input)).toBe(true);
	});

	it('forwards the go2rtc 1.9.15 sequence: Do for OPTIONS, DESCRIBE and each SETUP, then PLAY and frames', async () => {
		const tail = Buffer.concat([PLAY_RESPONSE, FRAMES]);
		const steps: Step[] = [
			{ go2rtc: OPTIONS_REQUEST },
			...fromConsole(OPTIONS_RESPONSE),
			{ go2rtc: DESCRIBE_REQUEST },
			...fromConsole(DESCRIBE_RESPONSE),
			{ go2rtc: SETUP_REQUEST },
			...fromConsole(SETUP_RESPONSE),
			{ go2rtc: SETUP_REQUEST },
			...fromConsole(SETUP_RESPONSE),
			{ go2rtc: PLAY_REQUEST },
			...fromConsole(tail),
		];
		const input = Buffer.concat([OPTIONS_RESPONSE, DESCRIBE_RESPONSE, SETUP_RESPONSE, SETUP_RESPONSE, tail]);

		for (let index = 0; index <= tail.length; index += 1) {
			const outcome = await run([...steps.slice(0, -1), ...fromConsole(tail.subarray(0, index), tail.subarray(index))]);

			expect(outcome.error).toBeNull();
			expect(outcome.output.equals(input)).toBe(true);
		}
	});

	it('refuses a frame before the responses to pipelined requests', async () => {
		// A go2rtc that pipelined SETUP with PLAY would still read the SETUP answer inside Do, where `$ 302` redirects.
		const pipelined = { go2rtc: Buffer.concat([SETUP_REQUEST, PLAY_REQUEST]) };

		for (const steps of [
			[pipelined, ...fromConsole(SMUGGLED_REDIRECT)],
			[pipelined, ...bytewise(SMUGGLED_REDIRECT)],
			[pipelined, ...fromConsole(FRAMES)],
		]) {
			const outcome = await run(steps);

			expect(reasonOf(outcome)).toBe('malformed');
			expect(outcome.output).toHaveLength(0);
		}

		// Once the SETUP answer is through, the PLAY answer and frames belong to go2rtc's frame loop.
		const answered = Buffer.concat([SETUP_RESPONSE, PLAY_RESPONSE, FRAMES]);
		const outcome = await run([pipelined, ...fromConsole(answered)]);

		expect(outcome.error).toBeNull();
		expect(outcome.output.equals(answered)).toBe(true);
	});

	it('forwards empty and maximum-length frames and frame headers split at every offset', async () => {
		const empty = frame(0, EMPTY_PAYLOAD);
		const largest = frame(1, Buffer.alloc(0xffff, 0x52));
		const input = Buffer.concat([empty, largest, empty, PLAY_RESPONSE]);

		const whole = await run(afterPlay(input));

		expect(whole.error).toBeNull();
		expect(whole.output.equals(input)).toBe(true);

		for (const offset of [1, 2, 3]) {
			const split = await run(afterPlay(largest.subarray(0, offset), largest.subarray(offset), PLAY_RESPONSE));

			expect(split.error).toBeNull();
			expect(split.output.equals(Buffer.concat([largest, PLAY_RESPONSE]))).toBe(true);
		}
	});

	it('emits nothing after a refusal', async () => {
		const guard = new ProtectRtspResponseGuard();
		const output: Buffer[] = [];
		const errors: unknown[] = [];

		guard.on('data', (chunk: Buffer) => output.push(chunk));
		guard.on('error', (error) => errors.push(error));
		guard.write(redirectTo('302'));

		await new Promise((resolve) => setImmediate(resolve));

		guard.write(OPTIONS_RESPONSE, () => undefined);
		guard.observeRequests(PLAY_REQUEST);
		guard.write(FRAMES, () => undefined);

		await new Promise((resolve) => setImmediate(resolve));

		expect(output).toHaveLength(0);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ reason: 'redirect' });
	});

	it('forwards interleaved frames after PLAY', async () => {
		const outcome = await run(afterPlay(FRAMES));

		expect(outcome.error).toBeNull();
		expect(outcome.output.equals(FRAMES)).toBe(true);
	});

	it('detects PLAY split across go2rtc chunks and not inside a request body', async () => {
		const body = text(`PLAY rtsps://h/${ALIAS} RTSP/1.0\r\n\r\n`);
		const parameter = Buffer.concat([
			text(`SET_PARAMETER rtsps://h/${ALIAS} RTSP/1.0\r\nCSeq: 5\r\nContent-Length: ${body.length}\r\n\r\n`),
			body,
		]);

		// A PLAY line inside a Content-Length body is no PLAY request, so a frame still counts as before PLAY.
		expect(reasonOf(await run([{ go2rtc: parameter }, ...fromConsole(FRAMES)]))).toBe('malformed');

		const split = await run([
			{ go2rtc: SETUP_REQUEST },
			...fromConsole(SETUP_RESPONSE),
			{ go2rtc: PLAY_REQUEST.subarray(0, 2) },
			{ go2rtc: PLAY_REQUEST.subarray(2) },
			...fromConsole(FRAMES),
		]);

		expect(split.error).toBeNull();
		expect(split.output.equals(Buffer.concat([SETUP_RESPONSE, FRAMES]))).toBe(true);
	});

	it('forwards a body that looks like RTSP without parsing it', async () => {
		const input = Buffer.concat([DESCRIBE_RESPONSE, PLAY_RESPONSE]);

		const whole = await run(fromConsole(input));
		const bytes = await run(bytewise(input));

		expect(whole.error).toBeNull();
		expect(whole.output.equals(input)).toBe(true);
		expect(bytes.error).toBeNull();
		expect(bytes.output.equals(input)).toBe(true);
	});

	it.each([301, 302, 303, 307])('refuses any 3xx response (%i)', async (status) => {
		const refused = redirectTo(String(status));
		const ok = text('RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n');

		for (const steps of [
			fromConsole(Buffer.concat([ok, refused])),
			bytewise(Buffer.concat([ok, refused])),
			afterPlay(Buffer.concat([ok, refused])),
		]) {
			const outcome = await run(steps);

			expect(reasonOf(outcome)).toBe('redirect');
			expect(outcome.output.includes(text('Location'))).toBe(false);
			expect(outcome.output.includes(text(ALIAS))).toBe(false);
			expect(ok.subarray(0, outcome.output.length).equals(outcome.output)).toBe(true);
		}
	});

	it.each([
		['a request line with a 3xx second part', `OPTIONS 302 Found\r\nLocation: rtsps://10.0.0.9:7441/${ALIAS}\r\n\r\n`],
		['a short protocol name', 'RTSP 302 x\r\n\r\n'],
		['a signed status', 'RTSP/1.0 +302 Found\r\nLocation: rtsps://x\r\n\r\n'],
		['a zero-padded status', 'RTSP/1.0 0302 Found\r\nLocation: rtsps://x\r\n\r\n'],
		['a long zero-padded status', 'RTSP/1.0 0000000302 Found\r\n\r\n'],
		['LF-only line endings', 'RTSP/1.0 302 Found\nLocation: rtsps://x\n\n'],
		['LF-only pipelined messages', 'RTSP/1.0 200 OK\nCSeq: 1\n\nRTSP/1.0 302 Found\nLocation: rtsps://x\n\n'],
		['a message with only two parts', 'RTSP/1.0 302\r\n\r\n'],
	])('refuses %s as a redirect', async (_name, message) => {
		for (const steps of [fromConsole(text(message)), bytewise(text(message)), afterPlay(text(message))]) {
			const outcome = await run(steps);

			expect(reasonOf(outcome)).toBe('redirect');
			expect(outcome.output.includes(text('302'))).toBe(false);
		}
	});

	it('refuses an interleaved frame before PLAY', async () => {
		for (const steps of [
			fromConsole(SMUGGLED_REDIRECT),
			bytewise(SMUGGLED_REDIRECT),
			[{ go2rtc: SETUP_REQUEST }, ...fromConsole(SMUGGLED_REDIRECT)],
		]) {
			const outcome = await run(steps);

			expect(reasonOf(outcome)).toBe('malformed');
			expect(outcome.output).toHaveLength(0);
		}
	});

	it('lets a request from the server pass', async () => {
		const request = text('SET_PARAMETER rtsp://h/x RTSP/1.0\r\nCSeq: 3\r\n\r\n');

		for (const steps of [fromConsole(request), afterPlay(request), afterPlay(FRAMES, request, FRAMES)]) {
			const outcome = await run(steps);
			const expected = Buffer.concat(steps.flatMap((step) => ('console' in step ? [step.console] : [])));

			expect(outcome.error).toBeNull();
			expect(outcome.output.equals(expected)).toBe(true);
		}
	});

	it('refuses an oversized header or body', async () => {
		const headerOf = (size: number): Buffer => {
			const start = 'RTSP/1.0 200 OK\r\nX-Pad: ';
			const end = '\r\n\r\n';

			return text(start + 'a'.repeat(size - start.length - end.length) + end);
		};

		const fits = headerOf(PROTECT_RTSP_MAX_HEADER_BYTES);

		expect(fits).toHaveLength(PROTECT_RTSP_MAX_HEADER_BYTES);
		expect((await run(fromConsole(fits))).error).toBeNull();

		const tooLarge = headerOf(PROTECT_RTSP_MAX_HEADER_BYTES + 1);

		expect(reasonOf(await run(fromConsole(tooLarge)))).toBe('header_too_large');

		// A header that never ends is refused as soon as it passes the limit.
		const endless = await run(fromConsole(tooLarge.subarray(0, PROTECT_RTSP_MAX_HEADER_BYTES + 1)));

		expect(reasonOf(endless)).toBe('header_too_large');
		expect(endless.output).toHaveLength(0);

		const body = Buffer.alloc(PROTECT_RTSP_MAX_BODY_BYTES, 0x41);
		const fitting = Buffer.concat([text(`RTSP/1.0 200 OK\r\nContent-Length: ${body.length}\r\n\r\n`), body]);
		const accepted = await run(fromConsole(fitting));

		expect(accepted.error).toBeNull();
		expect(accepted.output.equals(fitting)).toBe(true);

		const oversized = await run(
			fromConsole(text(`RTSP/1.0 200 OK\r\nContent-Length: ${PROTECT_RTSP_MAX_BODY_BYTES + 1}\r\n\r\n`)),
		);

		expect(reasonOf(oversized)).toBe('body_too_large');
		expect(oversized.output).toHaveLength(0);
	});

	it.each([
		['a non-numeric status', 'RTSP/1.0 abc\r\n\r\n'],
		['a signed non-redirect status', 'RTSP/1.0 +200 OK\r\n\r\n'],
		['a negative Content-Length', 'RTSP/1.0 200 OK\r\nContent-Length: -1\r\n\r\n'],
		['a non-numeric Content-Length', 'RTSP/1.0 200 OK\r\nContent-Length: 12a\r\n\r\n'],
		['a six-digit Content-Length', 'RTSP/1.0 200 OK\r\nContent-Length: 000005\r\n\r\nhello'],
		['an empty Content-Length', 'RTSP/1.0 200 OK\r\nContent-Length:  \r\n\r\n'],
		['a continuation line', 'RTSP/1.0 200 OK\r\nCSeq: 1\r\n Content-Length: 5\r\n\r\n'],
		['a tab continuation line', 'RTSP/1.0 200 OK\r\nCSeq: 1\r\n\tLocation: rtsps://x\r\n\r\n'],
		[
			'a duplicate Content-Length',
			'RTSP/1.0 200 OK\r\nContent-Length: 0\r\ncontent-length: 33\r\n\r\nRTSP/1.0 302 Found\r\nLocation: x\r\n\r\n',
		],
		['a header line without a colon', 'RTSP/1.0 200 OK\r\nCSeq 1\r\n\r\n'],
		['a header name with a space', 'RTSP/1.0 200 OK\r\nContent-Length : 5\r\n\r\nhello'],
		['an empty first line', '\r\nRTSP/1.0 200 OK\r\n\r\n'],
	])('refuses %s as malformed', async (_name, message) => {
		for (const steps of [fromConsole(text(message)), bytewise(text(message))]) {
			const outcome = await run(steps);

			expect(reasonOf(outcome)).toBe('malformed');
			expect(outcome.output).toHaveLength(0);
		}
	});

	it('refuses an unknown message start after PLAY', async () => {
		const outcome = await run(afterPlay(text('HELLO 200 OK\r\n\r\n')));

		expect(reasonOf(outcome)).toBe('malformed');
		expect(outcome.output).toHaveLength(0);
	});

	it('refuses an oversized go2rtc request header', async () => {
		const outcome = await run([{ go2rtc: text(`OPTIONS rtsps://h/${'a'.repeat(PROTECT_RTSP_MAX_HEADER_BYTES)}`) }]);

		expect(reasonOf(outcome)).toBe('header_too_large');
	});

	it('drops an incomplete header when the console ends', async () => {
		const outcome = await run(fromConsole(text('RTSP/1.0 302 Found\r\nLocation: rtsps://x\r\n')));

		expect(outcome.error).toBeNull();
		expect(outcome.output).toHaveLength(0);
	});

	it('never puts message bytes into the error', async () => {
		const outcome = await run(fromConsole(redirectTo('302')));

		expect(outcome.error).toBeInstanceOf(ProtectRtspGuardError);

		const error = outcome.error as ProtectRtspGuardError;

		expect(error.message).toBe('RTSP stream refused (redirect)');
		expect(error.reason).toBe('redirect');
		expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(ALIAS);
		expect(String(error.stack)).not.toContain('10.0.0.9');
	});
});
