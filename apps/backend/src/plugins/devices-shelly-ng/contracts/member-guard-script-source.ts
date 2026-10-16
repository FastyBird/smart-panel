import { SHELLY_GUARD_SOURCE } from './guard-script-source';

/** Reject incompatible base artifacts before exposing a version-two installation script. */
export function buildShellyMemberGuardSource(source: string): string {
	const patches = [
		[
			'function observeFloor(status) {\n',
			'function observeFloor(status) {\n\tif (now() - floorObservedAt >= cfg.floorMaxAgeMs) floorLatched = true;\n',
		],
		[
			'!finiteNumber(value) || (status.errors',
			'!finiteNumber(value) || !cfg.floorDomainC || value < cfg.floorDomainC.minimum || value > cfg.floorDomainC.maximum || (status.errors',
		],
		[
			'cfg.floorHysteresisC > 0\n',
			'cfg.floorHysteresisC > 0 && cfg.floorDomainC && finiteNumber(cfg.floorDomainC.minimum) && finiteNumber(cfg.floorDomainC.maximum) && cfg.floorDomainC.minimum < cfg.floorDomainC.maximum && cfg.floorLimitC <= cfg.floorDomainC.maximum && cfg.floorLimitC > cfg.floorDomainC.minimum && cfg.floorLimitC - cfg.floorHysteresisC > cfg.floorDomainC.minimum\n',
		],
	] as const;
	for (const [anchor] of patches)
		if (source.split(anchor).length !== 2)
			throw new Error(`Member guard patch anchor must occur exactly once: ${anchor}`);
	return patches.reduce((result, [anchor, replacement]) => result.replace(anchor, replacement), source);
}

/** Version-two artifact adds only native/converter domain admission; legacy source stays byte-identical. */
export const SHELLY_MEMBER_GUARD_SOURCE = buildShellyMemberGuardSource(SHELLY_GUARD_SOURCE);
