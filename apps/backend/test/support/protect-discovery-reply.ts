export interface BuildDiscoveryReplyOptions {
	version?: number;
	command?: number;
	tlvs: ReadonlyArray<readonly [type: number, value: Buffer | string]>;
	/** Overrides the computed header length. */
	declaredLength?: number;
}

/** Builds a `>BBH` header followed by `type(1) length(2) value` records. */
export const buildDiscoveryReply = (opts: BuildDiscoveryReplyOptions): Buffer => {
	const body = Buffer.concat(
		opts.tlvs.map(([type, value]) => {
			const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
			const header = Buffer.alloc(3);

			header.writeUInt8(type, 0);
			header.writeUInt16BE(bytes.length, 1);

			return Buffer.concat([header, bytes]);
		}),
	);
	const header = Buffer.alloc(4);

	header.writeUInt8(opts.version ?? 1, 0);
	header.writeUInt8(opts.command ?? 0, 1);
	header.writeUInt16BE(opts.declaredLength ?? body.length, 2);

	return Buffer.concat([header, body]);
};

const MAC = Buffer.from([0xaa, 0xbb, 0xcc, 0x00, 0x00, 0x01]);

export const HAND_BUILT_CONSOLE_TLVS: ReadonlyArray<readonly [number, Buffer | string]> = [
	[0x01, MAC],
	[0x02, Buffer.concat([MAC, Buffer.from([192, 168, 1, 10])])],
	[0x03, '6.0.17'],
	[0x0b, 'Dream-Machine-Pro'],
	[0x0c, 'UNVR'],
	[0x30, 'abc123.id.ui.direct'],
	[0x33, '00112233-4455-6677-8899-aabbccddeeff'],
];
