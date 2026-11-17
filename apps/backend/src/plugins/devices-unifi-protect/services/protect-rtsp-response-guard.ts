import { Transform, TransformCallback } from 'stream';

import { PROTECT_RTSP_MAX_BODY_BYTES, PROTECT_RTSP_MAX_HEADER_BYTES } from '../devices-unifi-protect.constants';

export type ProtectRtspGuardFailure = 'redirect' | 'header_too_large' | 'body_too_large' | 'malformed';

/** Carries only the verdict: no byte of the refused message (URL, alias, header) ever reaches the error. */
export class ProtectRtspGuardError extends Error {
	readonly reason: ProtectRtspGuardFailure;

	constructor(reason: ProtectRtspGuardFailure) {
		super(`RTSP stream refused (${reason})`);

		this.name = 'ProtectRtspGuardError';
		this.reason = reason;
	}
}

const EMPTY = Buffer.alloc(0);
const LF = 0x0a;
const CR = 0x0d;
const DOLLAR = 0x24;
const FRAME_HEADER_BYTES = 4;

// go2rtc 1.9.15 `pkg/rtsp/conn.go` handleTCPData: after PLAY a message is classified by its first four bytes.
const RESPONSE_PREFIX = 'RTSP';
const REQUEST_PREFIXES = new Set(['OPTI', 'TEAR', 'DESC', 'SETU', 'PLAY', 'PAUS', 'RECO', 'ANNO', 'GET_', 'SET_']);

// Go's strconv.Atoi accepts a sign and leading zeros, so `+302` and `0302` are a 302 to go2rtc.
const ATOI_INTEGER = /^[+-]?\d+$/;
const RESPONSE_STATUS = /^\d{3}$/;
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const CONTENT_LENGTH = /^\d{1,5}$/;
const HEADER_WHITESPACE = /^[ \t]+|[ \t]+$/g;

type MessageKind = 'frame' | 'text';

interface RtspTextHeader {
	/** The first line split on single spaces into at most three parts, like Go's `strings.SplitN(line, " ", 3)`. */
	firstLine: string[];
	contentLength: number;
}

interface RtspFramerRules {
	/** Kind of the message starting at `start` (at least one byte), a failure, or null to wait for more bytes. */
	classify(start: Buffer): MessageKind | ProtectRtspGuardFailure | null;
	/** Judges a complete text header; `stop` ends parsing for good. */
	inspect(header: RtspTextHeader): ProtectRtspGuardFailure | 'stop' | null;
}

const splitN = (line: string, parts: number): string[] => {
	const result: string[] = [];
	let rest = line;

	while (result.length < parts - 1) {
		const space = rest.indexOf(' ');

		if (space === -1) {
			break;
		}

		result.push(rest.slice(0, space));
		rest = rest.slice(space + 1);
	}

	result.push(rest);

	return result;
};

/** True when go2rtc would read `part` as a status of 300–399 (it follows `Location` on 301 and 302). */
const isRedirectStatus = (part: string | undefined): boolean => {
	if (part === undefined || !ATOI_INTEGER.test(part) || part.startsWith('-')) {
		return false;
	}

	const digits = part.replace(/^[+]/, '').replace(/^0+/, '');

	return digits.length === 3 && digits.startsWith('3');
};

/** Parses a complete text header (ending with its empty line); framing is held to what go2rtc reads unambiguously. */
const parseTextHeader = (header: Buffer): RtspTextHeader | ProtectRtspGuardFailure => {
	const lines = header
		.toString('latin1')
		.split('\n')
		.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
	// The last two entries are the empty line that ended the header and the nothing after its LF.
	const [first, ...fields] = lines.slice(0, -2);
	const firstLine = splitN(first, 3);
	let contentLength: number | null = null;

	for (const field of fields) {
		// Go folds continuation lines into the previous field, which could hide a second Content-Length.
		if (field.startsWith(' ') || field.startsWith('\t')) {
			return 'malformed';
		}

		const colon = field.indexOf(':');

		if (colon <= 0 || !HEADER_NAME.test(field.slice(0, colon))) {
			return 'malformed';
		}

		if (field.slice(0, colon).toLowerCase() !== 'content-length') {
			continue;
		}

		const value = field.slice(colon + 1).replace(HEADER_WHITESPACE, '');

		if (contentLength !== null || !CONTENT_LENGTH.test(value)) {
			return 'malformed';
		}

		contentLength = Number(value);
	}

	return { firstLine, contentLength: contentLength ?? 0 };
};

/**
 * Incremental RTSP framing as go2rtc reads it: `$` + channel + 2-byte big-endian length + payload, or a text header
 * up to its first empty line (LF with an optional CR) followed by `Content-Length` bytes of body. A text header is held
 * whole until it is complete; frame payloads and bodies pass through unparsed.
 */
class RtspFramer {
	private pending: Buffer = EMPTY;
	private kind: MessageKind | null = null;
	private lineStart = 0;
	private passthrough = 0;
	private stopped = false;

	constructor(private readonly rules: RtspFramerRules) {}

	/** Feeds bytes in order; `forward` receives every accepted byte in order. Returns the first failure, if any. */
	feed(chunk: Buffer, forward: (bytes: Buffer) => void): ProtectRtspGuardFailure | null {
		let rest = chunk;

		while (!this.stopped) {
			if (this.passthrough > 0 && rest.length > 0) {
				const size = Math.min(this.passthrough, rest.length);

				forward(rest.subarray(0, size));
				this.passthrough -= size;
				rest = rest.subarray(size);

				continue;
			}

			if (rest.length === 0) {
				return null;
			}

			this.pending = this.pending.length === 0 ? rest : Buffer.concat([this.pending, rest]);

			const result = this.readMessage(forward);

			if (result !== null) {
				return result === 'wait' ? null : result;
			}

			rest = this.pending;
			this.pending = EMPTY;
		}

		return null;
	}

	/** Consumes one message from `pending`; null when one was consumed (its leftover stays in `pending`). */
	private readMessage(forward: (bytes: Buffer) => void): ProtectRtspGuardFailure | 'wait' | null {
		if (this.kind === null) {
			const kind = this.rules.classify(this.pending);

			if (kind === null) {
				return 'wait';
			}

			if (kind !== 'frame' && kind !== 'text') {
				return kind;
			}

			this.kind = kind;
		}

		return this.kind === 'frame' ? this.readFrame(forward) : this.readText(forward);
	}

	private readFrame(forward: (bytes: Buffer) => void): 'wait' | null {
		if (this.pending.length < FRAME_HEADER_BYTES) {
			return 'wait';
		}

		const total = FRAME_HEADER_BYTES + this.pending.readUInt16BE(2);
		const size = Math.min(total, this.pending.length);

		forward(this.pending.subarray(0, size));
		this.consumed(size, total - size);

		return null;
	}

	private readText(forward: (bytes: Buffer) => void): ProtectRtspGuardFailure | 'wait' | null {
		let end = -1;

		while (end === -1) {
			const newline = this.pending.indexOf(LF, this.lineStart);

			if (newline === -1) {
				return this.pending.length > PROTECT_RTSP_MAX_HEADER_BYTES ? 'header_too_large' : 'wait';
			}

			const empty =
				newline === this.lineStart || (newline === this.lineStart + 1 && this.pending[this.lineStart] === CR);

			if (empty) {
				if (this.lineStart === 0) {
					// go2rtc refuses an empty first line; a leading blank line is never a valid message start.
					return 'malformed';
				}

				end = newline + 1;
			}

			this.lineStart = newline + 1;
		}

		if (end > PROTECT_RTSP_MAX_HEADER_BYTES) {
			return 'header_too_large';
		}

		const header = parseTextHeader(this.pending.subarray(0, end));

		if (typeof header === 'string') {
			return header;
		}

		const verdict = this.rules.inspect(header);

		if (verdict === 'stop') {
			this.stopped = true;
		} else if (verdict !== null) {
			return verdict;
		}

		if (header.contentLength > PROTECT_RTSP_MAX_BODY_BYTES) {
			return 'body_too_large';
		}

		forward(this.pending.subarray(0, end));
		this.consumed(end, header.contentLength);

		return null;
	}

	private consumed(size: number, passthrough: number): void {
		this.pending = this.pending.subarray(size);
		this.passthrough = passthrough;
		this.kind = null;
		this.lineStart = 0;
	}
}

/**
 * Console -> go2rtc direction. Forwards every byte unchanged and in order; errors with ProtectRtspGuardError on a 3xx
 * response, a text header over PROTECT_RTSP_MAX_HEADER_BYTES, a body over PROTECT_RTSP_MAX_BODY_BYTES or a malformed
 * frame. The framing copies go2rtc 1.9.15 (`pkg/rtsp/client.go` Do, `pkg/rtsp/conn.go` handleTCPData,
 * `pkg/tcp/textproto.go` ReadResponse), so nothing go2rtc would follow as a redirect gets through, whatever the chunk
 * boundaries. The go2rtc -> console bytes are only observed (`observeRequests`) to learn when PLAY was sent: before
 * it go2rtc reads every message as a response, after it a `$` starts an interleaved frame.
 */
export class ProtectRtspResponseGuard extends Transform {
	private playing = false;
	private failed = false;

	private readonly responses = new RtspFramer({
		classify: (start) => this.classifyResponse(start),
		inspect: (header) => {
			if (isRedirectStatus(header.firstLine[1])) {
				return 'redirect';
			}

			if (header.firstLine[0].startsWith(RESPONSE_PREFIX) && !RESPONSE_STATUS.test(header.firstLine[1] ?? '')) {
				return 'malformed';
			}

			return null;
		},
	});

	private readonly requests = new RtspFramer({
		classify: (start) => (start[0] === DOLLAR ? 'frame' : 'text'),
		inspect: (header) => {
			if (header.firstLine[0] !== 'PLAY') {
				return null;
			}

			this.playing = true;

			return 'stop';
		},
	});

	/** go2rtc -> console bytes, read-only and in order; call before forwarding them to the console. */
	observeRequests(chunk: Buffer): void {
		if (this.playing || this.failed || this.destroyed) {
			return;
		}

		const failure = this.requests.feed(chunk, () => undefined);

		if (failure !== null) {
			this.failed = true;
			this.destroy(new ProtectRtspGuardError(failure));
		}
	}

	_transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
		if (this.failed) {
			callback();

			return;
		}

		const failure = this.responses.feed(chunk, (bytes) => {
			this.push(bytes);
		});

		if (failure !== null) {
			this.failed = true;
			callback(new ProtectRtspGuardError(failure));

			return;
		}

		callback();
	}

	/** An incomplete header at the end is dropped: go2rtc would not act on it either. */
	_flush(callback: TransformCallback): void {
		callback();
	}

	private classifyResponse(start: Buffer): MessageKind | ProtectRtspGuardFailure | null {
		if (!this.playing) {
			// Before PLAY go2rtc reads every message as a response (Do -> ReadResponse); a `$` there is no frame.
			return start[0] === DOLLAR ? 'malformed' : 'text';
		}

		if (start[0] === DOLLAR) {
			return 'frame';
		}

		if (start.length < 4) {
			return null;
		}

		const prefix = start.toString('latin1', 0, 4);

		return prefix === RESPONSE_PREFIX || REQUEST_PREFIXES.has(prefix) ? 'text' : 'malformed';
	}
}
