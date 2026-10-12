import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

import { DeviceHiddenBy } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';

import { UpdateDeviceDto } from './update-device.dto';

describe('hidden provenance OpenAPI contract', () => {
	it.each([UpdateDeviceDto, DeviceEntity])(
		'emits an exact nullable enum for %p without a typed null enum',
		(target) => {
			const schemas: Record<string, SchemaObject> = {};
			const factory = new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper());
			const name = factory.exploreModelSchema(target, schemas);
			const property = schemas[name].properties?.hidden_by as SchemaObject;

			expect(property.oneOf).toEqual([
				{ type: 'string', enum: Object.values(DeviceHiddenBy) },
				{ enum: [null], nullable: true },
			]);
			expect(property).not.toHaveProperty('type');
			expect(property).not.toHaveProperty('enum');
		},
	);
});
