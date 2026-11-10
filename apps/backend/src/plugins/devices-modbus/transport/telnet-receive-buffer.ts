import ModbusRTU from 'modbus-serial';

/** The `modbus-serial` release whose private `TelnetPort` layout this module was written and tested against. */
export const TELNET_PORT_VERIFIED_VERSION = '8.0.25';

interface TelnetPortInternals {
	_buffer: Buffer;
}

/**
 * Access to the receive buffer of `modbus-serial`'s `TelnetPort` (RTU frames over a raw TCP socket), verified against
 * modbus-serial 8.0.25. This is the only place in the plugin that touches the library's private state.
 *
 * The port appends every received chunk to `_buffer` and, once a request is outstanding, emits the first frame in it
 * that matches the request's unit, function code and length. It never clears the buffer on `write()` and keeps the
 * bytes after a matched frame, so one duplicated gateway reply stays buffered and is handed to the next request of
 * the same shape (valid CRC, wrong data), and every later answer is one request behind. RTU frames carry no
 * transaction ID, so the only fix is to discard whatever is buffered before each request: with one request on the
 * wire at a time, any byte received before it is sent cannot belong to its answer.
 *
 * Throws when the port does not have the expected shape, so a library change fails the connection loudly (and the
 * transport spec fails) instead of silently bringing the misalignment back.
 */
export function telnetReceiveBuffer(client: ModbusRTU): { discard(): number } {
	const port = (client as unknown as { _port?: Partial<TelnetPortInternals> })._port;

	if (!port || !Buffer.isBuffer(port._buffer)) {
		throw new Error(
			`modbus-serial TelnetPort internals changed (verified against ${TELNET_PORT_VERIFIED_VERSION}); ` +
				'RTU over TCP cannot discard stale reply bytes',
		);
	}

	const internals = port as TelnetPortInternals;

	return {
		discard(): number {
			const stale = internals._buffer.length;

			if (stale > 0) {
				internals._buffer = Buffer.alloc(0);
			}

			return stale;
		},
	};
}
