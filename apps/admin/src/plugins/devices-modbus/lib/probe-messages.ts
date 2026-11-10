const PREFIX = 'devicesModbusPlugin.wizard.probe.errors.';

/** Returns the i18n key of the hint that explains a failed probe. */
export function explainProbeError(error: { kind: string; exceptionCode: number | null }): string {
	switch (error.kind) {
		case 'connection':
			return `${PREFIX}connection`;
		case 'timeout':
			return `${PREFIX}timeout`;
		case 'busy':
			return `${PREFIX}busy`;
		case 'rate_limited':
			return `${PREFIX}rateLimited`;
		case 'unavailable':
			return `${PREFIX}unavailable`;
		case 'exception':
			if (error.exceptionCode === 1) {
				return `${PREFIX}illegalFunction`;
			}

			if (error.exceptionCode === 2) {
				return `${PREFIX}illegalAddress`;
			}

			if (error.exceptionCode === 0x0a || error.exceptionCode === 0x0b) {
				return `${PREFIX}gatewayUnreachable`;
			}

			return `${PREFIX}generic`;
		default:
			return `${PREFIX}generic`;
	}
}
