export function shellyV1Address(identifier: string | null | undefined): string | null {
	const suffix = identifier?.split('-').at(-1)?.toUpperCase();
	return suffix && /^(?:[0-9A-F]{6}|[0-9A-F]{12})$/.test(suffix) ? suffix : null;
}

export function shellyV1PinMatches(identifier: string | null | undefined, mac: string): boolean {
	const address = shellyV1Address(identifier);
	return !!address && typeof mac === 'string' && /^[0-9A-F]{12}$/.test(mac) && mac.endsWith(address);
}
