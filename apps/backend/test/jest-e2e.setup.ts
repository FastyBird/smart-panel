// App bootstrap probes graphics even in endpoint/conformance tests. On macOS, system_profiler
// can finish after a suite closes and dynamically require a sensor module from a torn-down Jest
// environment. These tests do not exercise the host GPU; keep only that probe deterministic.
// Production code and the system module's dedicated unit tests retain their own implementations.
jest.mock('systeminformation', () => {
	const systemInformation = jest.requireActual<typeof import('systeminformation')>('systeminformation');

	return {
		...systemInformation,
		graphics: () => Promise.resolve({ controllers: [], displays: [] }),
	};
});
