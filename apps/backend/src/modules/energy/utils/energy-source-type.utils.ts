import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { EnergySourceType } from '../energy.constants';

export interface EnergySourceMapping {
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	sourceType: EnergySourceType;
}

/**
 * Which (channel, property) pairs the energy module reads as meters.
 *
 * Lives here rather than inside the ingestion listener because two callers need the same answer and
 * must not drift: the listener, deciding whether an event is energy at all, and the virtual devices
 * plugin, deciding whether a projection is a *meter* — which is what makes it subject to the
 * one-claimant rule, and what its claim has to agree with.
 */
const SOURCE_TYPE_MAP: EnergySourceMapping[] = [
	{
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		propertyCategory: PropertyCategory.CONSUMPTION,
		sourceType: EnergySourceType.CONSUMPTION_IMPORT,
	},
	{
		channelCategory: ChannelCategory.ELECTRICAL_GENERATION,
		propertyCategory: PropertyCategory.PRODUCTION,
		sourceType: EnergySourceType.GENERATION_PRODUCTION,
	},
	{
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		propertyCategory: PropertyCategory.GRID_IMPORT,
		sourceType: EnergySourceType.GRID_IMPORT,
	},
	{
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		propertyCategory: PropertyCategory.GRID_EXPORT,
		sourceType: EnergySourceType.GRID_EXPORT,
	},
];

/** The energy classification of a (channel, property) pair, or null when it is not a meter at all. */
export const findEnergySourceType = (
	channelCategory: ChannelCategory | undefined,
	propertyCategory: PropertyCategory | undefined,
): EnergySourceMapping | null =>
	SOURCE_TYPE_MAP.find(
		(mapping) => mapping.channelCategory === channelCategory && mapping.propertyCategory === propertyCategory,
	) ?? null;
