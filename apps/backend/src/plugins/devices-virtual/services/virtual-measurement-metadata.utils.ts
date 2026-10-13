import { EntityManager } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

import { transformContractErrors } from './virtual-transform-contract.utils';

/** Hydrate contract metadata only; never read history, producer leases or connectivity. */
export async function hydrateMeasurementContract(
	manager: EntityManager,
	property: ChannelPropertyEntity,
): Promise<void> {
	property.unit = resolvePropertyUnit(property);
	if (!(property instanceof VirtualChannelPropertyEntity) || !property.isDerived) return;
	const config = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: property.id });
	if (!config || transformContractErrors(config, property, null).length) return;
	property.unit = config.unit;
	property.measurementQuantity = config.quantity;
}
