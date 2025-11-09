import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNumber, ValidateNested } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';

export class ClientsNowModel {
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

export class Availability5mModel {
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
	@Expose({ name: 'clients_now' })
	@ValidateNested()
	@Type(() => ClientsNowModel)
	clientsNow: ClientsNowModel;

	@Expose({ name: 'availability_5m' })
	@Transform(
		({ obj }: { obj: { availability5m?: unknown; availability_5m?: unknown } }) => {
			const value: { value?: number; lastUpdated?: Date | string; last_updated?: Date | string } =
				obj.availability5m ?? obj.availability_5m ?? undefined;

			return toInstance(Availability5mModel, {
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
	@Type(() => Availability5mModel)
	availability5m: Availability5mModel;
}
