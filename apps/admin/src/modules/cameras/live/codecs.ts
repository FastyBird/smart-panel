/**
 * Codecs offered to go2rtc in the `mse` request, in go2rtc's own order.
 */
export const MSE_CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus'] as const;

const H264_PROBE = 'avc1.640029';
const H265_PROBE = 'hvc1.1.6.L153.B0';

const probe = (codec: string): string => `video/mp4; codecs="${codec}"`;

/**
 * The Media Source constructor of the browser: `MediaSource`, or Safari's `ManagedMediaSource` (iPhone), or `null`.
 * Both expose a static `isTypeSupported`.
 */
export const getMediaSourceCtor = (win: Window = window): typeof MediaSource | null => {
	const scope = win as Window & { MediaSource?: typeof MediaSource; ManagedMediaSource?: typeof MediaSource };

	return scope.MediaSource ?? scope.ManagedMediaSource ?? null;
};

/**
 * The comma-joined subset of `MSE_CODECS` the browser can play; an empty string when it can play none.
 */
export const supportedCodecs = (ctor: typeof MediaSource): string => MSE_CODECS.filter((codec) => ctor.isTypeSupported(probe(codec))).join(',');

/**
 * Whether the browser can play a profile's video codec. A missing or unknown codec is assumed playable; the `mse`
 * reply is checked again once the stream starts.
 */
export const canPlayProfileCodec = (videoCodec: string | null, ctor: typeof MediaSource): boolean => {
	switch (videoCodec?.trim().toLowerCase()) {
		case 'h264':
		case 'avc':
			return ctor.isTypeSupported(probe(H264_PROBE));
		case 'h265':
		case 'hevc':
			return ctor.isTypeSupported(probe(H265_PROBE));
		default:
			return true;
	}
};

const describeCodec = (codec: string): { kind: 'video' | 'audio'; label: string } | null => {
	if (codec.startsWith('avc1.')) {
		return { kind: 'video', label: 'H.264' };
	}

	if (codec.startsWith('hvc1.') || codec.startsWith('hev1.')) {
		return { kind: 'video', label: 'H.265' };
	}

	if (codec.startsWith('mp4a.')) {
		return { kind: 'audio', label: 'AAC' };
	}

	if (codec === 'opus') {
		return { kind: 'audio', label: 'Opus' };
	}

	if (codec === 'flac') {
		return { kind: 'audio', label: 'FLAC' };
	}

	return null;
};

/**
 * Human-readable video and audio codecs of a mime type such as `video/mp4; codecs="avc1.640029,mp4a.40.2"`.
 */
export const describeMime = (mime: string): { video: string | null; audio: string | null } => {
	const result: { video: string | null; audio: string | null } = { video: null, audio: null };
	const list = /codecs="?([^";]*)"?/i.exec(mime)?.[1] ?? '';

	for (const codec of list.split(',')) {
		const described = describeCodec(codec.trim());

		if (described !== null && result[described.kind] === null) {
			result[described.kind] = described.label;
		}
	}

	return result;
};
