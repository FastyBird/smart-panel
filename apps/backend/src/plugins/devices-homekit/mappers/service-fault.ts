import { Characteristic } from '@homebridge/hap-nodejs';

import { bindCharacteristicGet } from './characteristic-get';
import { HomeKitMapperContext } from './homekit-mapper.interface';

interface FaultEntry {
	fault: boolean;
	read?: () => unknown;
}
const ledgers = new WeakMap<Characteristic, Map<Characteristic, FaultEntry>>();

/** One successful component read cannot clear another component's fault. */
export function updateServiceFault(
	fault: Characteristic | undefined,
	component: Characteristic,
	failed: boolean,
): void {
	if (!fault) return;
	let ledger = ledgers.get(fault);
	if (!ledger) ledgers.set(fault, (ledger = new Map<Characteristic, FaultEntry>()));
	ledger.set(component, { ...ledger.get(component), fault: failed });
	fault.updateValue(
		[...ledger.values()].some((entry) => entry.fault)
			? Characteristic.StatusFault.GENERAL_FAULT
			: Characteristic.StatusFault.NO_FAULT,
	);
}

export function bindServiceFault(
	context: HomeKitMapperContext,
	fault: Characteristic,
	component: Characteristic,
	read: () => unknown,
): void {
	updateServiceFault(fault, component, ledgers.get(fault)?.get(component)?.fault ?? true);
	ledgers.get(fault).get(component).read = read;
	bindCharacteristicGet(context, fault, () => {
		for (const entry of ledgers.get(fault).values()) {
			try {
				entry.read?.();
			} catch {
				// A component failure leaves its fault readable.
			}
		}
		return fault.value;
	});
}
