import { SHELLY_GUARD_SOURCE } from './guard-script-source';

/** Version-two artifact adds only native/converter domain admission; legacy source stays byte-identical. */
export const SHELLY_MEMBER_GUARD_SOURCE = SHELLY_GUARD_SOURCE.replace(
	'function observeFloor(status) {\n',
	'function observeFloor(status) {\n\tif (now() - floorObservedAt >= cfg.floorMaxAgeMs) floorLatched = true;\n',
)
	.replace(
		'!finiteNumber(value) || (status.errors',
		'!finiteNumber(value) || !cfg.floorDomainC || value < cfg.floorDomainC.minimum || value > cfg.floorDomainC.maximum || (status.errors',
	)
	.replace(
		'cfg.floorHysteresisC > 0\n',
		'cfg.floorHysteresisC > 0 && cfg.floorDomainC && finiteNumber(cfg.floorDomainC.minimum) && finiteNumber(cfg.floorDomainC.maximum) && cfg.floorDomainC.minimum < cfg.floorDomainC.maximum && cfg.floorLimitC <= cfg.floorDomainC.maximum && cfg.floorLimitC > cfg.floorDomainC.minimum && cfg.floorLimitC - cfg.floorHysteresisC > cfg.floorDomainC.minimum\n',
	);
