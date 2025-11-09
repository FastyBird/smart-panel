import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNumber, ValidateNested } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';

export class RequestsPerMinModel {
	@Expose()
	@IsNumber()
	value: number;

	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

export class ErrorRate5MinModel {
	@Expose()
	@IsNumber()
	value: number;

	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

export class P95Ms5MModel {
	@Expose()
	@IsNumber()
	value: number;

	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

export class ModuleStatsModel {
	@Expose({ name: 'req_per_min' })
	@ValidateNested()
	@Type(() => RequestsPerMinModel)
	reqPerMin: RequestsPerMinModel;

	@Expose({ name: 'error_rate_5m' })
	@Transform(
		({ obj }: { obj: { errorRate5m?: unknown; error_rate5m?: unknown; error_rate_5m?: unknown } }) => {
			const value: { value?: number; lastUpdated?: Date | string; last_updated?: Date | string } =
				obj.errorRate5m ?? obj.error_rate5m ?? obj.error_rate_5m ?? undefined;

			return toInstance(ErrorRate5MinModel, {
				value: 'value' in value ? value['value'] : undefined,
				lastUpdated:
					'lastUpdated' in value ? value['lastUpdated'] : 'last_updated' in value ? value['last_updated'] : undefined,
			});
		},
		{
			toClassOnly: true,
		},
	)
	@ValidateNested()
	@Type(() => ErrorRate5MinModel)
	errorRate5m: ErrorRate5MinModel;

	@Expose({ name: 'p95_ms_5m' })
	@Transform(
		({ obj }: { obj: { p95ms5m?: unknown; p95_ms_5m?: unknown } }) => {
			const value: { value?: number; lastUpdated?: Date | string; last_updated?: Date | string } =
				obj.p95ms5m ?? obj.p95_ms_5m ?? undefined;

			return toInstance(P95Ms5MModel, {
				value: 'value' in value ? value['value'] : undefined,
				lastUpdated:
					'lastUpdated' in value ? value['lastUpdated'] : 'last_updated' in value ? value['last_updated'] : undefined,
			});
		},
		{
			toClassOnly: true,
		},
	)
	@ValidateNested()
	@Type(() => P95Ms5MModel)
	p95ms5m: P95Ms5MModel;
}
