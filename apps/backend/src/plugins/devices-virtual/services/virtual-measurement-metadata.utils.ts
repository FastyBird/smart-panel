import { EntityManager } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualDewPointConfigEntity } from '../entities/virtual-dew-point.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

import { transformContractErrors } from './virtual-transform-contract.utils';

/** Hydrate contract metadata only; never read history, producer leases or connectivity. */
export async function hydrateMeasurementContract(
	manager: EntityManager,
	property: ChannelPropertyEntity,
): Promise<void> {
	property.unit = resolvePropertyUnit(property);
	if (!(property instanceof VirtualChannelPropertyEntity) || !property.isDerived) return;
	const dewPoint = await manager.findOneBy(VirtualDewPointConfigEntity, { outputPropertyId: property.id });
	if (dewPoint) {
		property.unit = '°C';
		property.measurementQuantity = 'dew_point';
		return;
	}
	const config = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: property.id });
	if (!config || transformContractErrors(config, property, null).some((error) => error !== 'operator_unavailable'))
		return;
	property.unit = config.unit;
	property.measurementQuantity = config.quantity;
}
