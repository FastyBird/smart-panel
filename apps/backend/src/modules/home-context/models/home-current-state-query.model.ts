import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HomeCurrentStateEqualityOperator,
	HomeCurrentStateOperation,
	HomeCurrentStateOrderingOperator,
	HomeCurrentStateProfile,
} from '../home-context.constants';

export type HomeCurrentStateScalar = string | number | boolean;

export type HomeCurrentStatePredicate =
	| {
			operator: HomeCurrentStateEqualityOperator;
			value: string | boolean;
	  }
	| {
			operator: HomeCurrentStateEqualityOperator;
			value: number;
			unit: string;
	  }
	| {
			operator: HomeCurrentStateOrderingOperator;
			value: number;
			unit: string;
	  };

interface HomeCurrentStateQueryBase {
	profile: HomeCurrentStateProfile;
	spaceId?: string;
	channelCategories?: ChannelCategory[];
	propertyCategories?: PropertyCategory[];
	dataTypes?: DataTypeType[];
	limit?: number;
}

export interface HomeCurrentStateRowsQuery extends HomeCurrentStateQueryBase {
	operation: 'rows';
	predicate?: HomeCurrentStatePredicate;
}

export interface HomeCurrentStateAggregateQuery extends HomeCurrentStateQueryBase {
	operation: Exclude<HomeCurrentStateOperation, 'rows'>;
	predicate: HomeCurrentStatePredicate;
}

export type HomeCurrentStateQuery = HomeCurrentStateRowsQuery | HomeCurrentStateAggregateQuery;
