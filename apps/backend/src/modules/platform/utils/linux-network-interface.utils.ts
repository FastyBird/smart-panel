import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { Systeminformation } from 'systeminformation';

const execFileAsync = promisify(execFile);

export type DefaultNetworkInterface = Pick<Systeminformation.NetworkInterfacesData, 'iface' | 'ip4' | 'ip6' | 'mac'>;

/** Read only the fields used by system status, without systeminformation's synchronous per-NIC probes. */
export async function readLinuxDefaultNetworkInterface(): Promise<DefaultNetworkInterface> {
	let routes: unknown;

	try {
		const { stdout } = await execFileAsync('ip', ['-j', 'route', 'show', 'default'], {
			timeout: 2000,
			maxBuffer: 64 * 1024,
		});

		routes = JSON.parse(stdout) as unknown;
	} catch {
		// Minimal containers may not have iproute2. Keep the external-interface fallback,
		// including setup networks with an address but no default route.
	}

	const interfaces = Object.entries(os.networkInterfaces())
		.map(([name, addresses]) => ({ name, addresses: (addresses ?? []).filter((address) => !address.internal) }))
		.filter(({ addresses }) => addresses.length > 0);
	const routedInterface = Array.isArray(routes)
		? routes
				.filter((route: unknown): route is { dev: string } =>
					Boolean(route && typeof route === 'object' && 'dev' in route && typeof route.dev === 'string'),
				)
				.map((route) => {
					const networkInterface =
						interfaces.find(({ name }) => name === route.dev) ??
						interfaces.find(({ name }) => name.startsWith(`${route.dev}:`));

					// Address labels such as eth0:1 belong to the routed base interface eth0.
					return networkInterface ? { ...networkInterface, name: route.dev } : undefined;
				})
				.find((networkInterface) => networkInterface !== undefined)
		: undefined;
	// Match the existing fallback: prefer the external IPv6 interface with the lowest
	// scope ID, then the first external interface when no scope ID is available.
	const scopedInterfaces = interfaces.flatMap((networkInterface) =>
		networkInterface.addresses
			.filter((address): address is os.NetworkInterfaceInfoIPv6 => address.family === 'IPv6' && address.scopeid > 0)
			.map((address) => ({ networkInterface, scope: address.scopeid })),
	);
	const selected =
		routedInterface ?? scopedInterfaces.sort((a, b) => a.scope - b.scope)[0]?.networkInterface ?? interfaces[0];
	const ipv4 = selected?.addresses.filter((address) => address.family === 'IPv4') ?? [];
	const ipv6 = selected?.addresses.filter((address) => address.family === 'IPv6') ?? [];

	return {
		iface: selected?.name ?? '',
		ip4: (ipv4.find((address) => !address.address.startsWith('169.254.')) ?? ipv4[0])?.address ?? '',
		ip6: (ipv6.find((address) => !/^fe[89ab]/i.test(address.address)) ?? ipv6[0])?.address ?? '',
		mac: selected?.addresses[0]?.mac ?? '',
	};
}
