import { VirtualAggregateFilter, VirtualAggregateFilterKind } from '../entities/virtual-producer.entity';

/** Inclusive bounds limit input ratios to 10^12; defaults preserve all v1 configurations. */
export const MIN_AGGREGATE_WEIGHT = 0.000001;
export const MAX_AGGREGATE_WEIGHT = 1000000;

export const isValidAggregateWeight = (weight: unknown): weight is number =>
	typeof weight === 'number' &&
	Number.isFinite(weight) &&
	weight >= MIN_AGGREGATE_WEIGHT &&
	weight <= MAX_AGGREGATE_WEIGHT;

export const isValidAggregateFilter = (filter: VirtualAggregateFilter | null | undefined): boolean =>
	filter == null ||
	(filter.kind === VirtualAggregateFilterKind.ABSOLUTE_DEVIATION_FROM_MEDIAN &&
		typeof filter.threshold === 'number' &&
		Number.isFinite(filter.threshold) &&
		filter.threshold > 0);
