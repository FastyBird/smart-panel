export type HomeStateRangeDomain = 'timeseries' | 'energy';

export type HomeStateRangeErrorReason = 'invalid_or_non_ascending' | 'max_days_exceeded';

export class HomeStateDeviceNotFoundError extends Error {
	readonly code = 'device_not_found';

	constructor(readonly deviceId: string) {
		super(`Home state device ${deviceId} does not exist`);
		this.name = HomeStateDeviceNotFoundError.name;
	}
}

export class HomeStatePropertyNotFoundError extends Error {
	readonly code = 'property_not_found';

	constructor(readonly propertyId: string) {
		super(`Home state property ${propertyId} does not exist`);
		this.name = HomeStatePropertyNotFoundError.name;
	}
}

export class HomeStateInvalidRangeError extends Error {
	readonly code = 'invalid_range';

	constructor(
		readonly domain: HomeStateRangeDomain,
		readonly reason: HomeStateRangeErrorReason,
		readonly maxDays?: number,
	) {
		super(
			reason === 'max_days_exceeded'
				? `The ${domain} range may not exceed ${maxDays} days`
				: `The ${domain} range must contain valid ascending timestamps`,
		);
		this.name = HomeStateInvalidRangeError.name;
	}
}

export class HomeStateTimeseriesPointLimitError extends Error {
	readonly code = 'timeseries_point_limit_exceeded';

	constructor(readonly maxPoints: number) {
		super(`The selected timeseries bucket would exceed ${maxPoints} points`);
		this.name = HomeStateTimeseriesPointLimitError.name;
	}
}
