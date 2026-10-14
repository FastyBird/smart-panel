import { instanceToPlain } from 'class-transformer';

import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

import {
	VirtualThermostatRecoveriesResponseModel,
	VirtualThermostatRecoveryModel,
	VirtualThermostatRuntimeModel,
	VirtualThermostatRuntimeResponseModel,
} from './thermostat-response.model';

describe('thermostat recovery response contract', () => {
	const row = {
		id: 'recovery-id',
		controllerId: 'internal-controller-id',
		claimId: 'claim-id',
		physicalIdentity: 'shelly:device:output:0',
		previousPropertyIdentity: 'previous-property-id',
		restoredPropertyId: 'restored-property-id',
		actorId: 'operator-id',
		reason: 'Verified the old endpoint is disconnected',
		createdAt: new Date('2026-10-14T12:00:00.000Z'),
		disconnectionAcknowledged: true,
		configurationRevision: 12,
		claimRevision: 4,
	};
	const expected = {
		id: row.id,
		claim: row.claimId,
		physical_identity: row.physicalIdentity,
		previous_property_identity: row.previousPropertyIdentity,
		restored_property: row.restoredPropertyId,
		actor: row.actorId,
		reason: row.reason,
		created_at: row.createdAt.toISOString(),
		disconnection_acknowledged: row.disconnectionAcknowledged,
		configuration_revision: row.configurationRevision,
		claim_revision: row.claimRevision,
	};

	it('serializes entity-backed recovery rows with snake_case wire names and original values', () => {
		const response = new VirtualThermostatRecoveriesResponseModel();
		response.data = [Object.assign(new VirtualThermostatRecoveryModel(), row)];

		// Match the options used by TransformResponseInterceptor, then encode dates as HTTP JSON does.
		const serialized: unknown = JSON.parse(
			JSON.stringify(
				instanceToPlain(response, {
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
					ignoreDecorators: false,
					groups: ['api'],
					enableCircularCheck: true,
				}),
			),
		);

		expect(serialized).toEqual({ data: [expected] });
		expect(response.data[0].claimId).toBe(row.claimId);
	});

	it('documents the same recovery field names in OpenAPI', () => {
		const schemas: Record<string, SchemaObject> = {};
		const factory = new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper());
		factory.exploreModelSchema(VirtualThermostatRecoveriesResponseModel, schemas);
		const schema = schemas.DevicesVirtualPluginDataThermostatRecovery;

		expect(Object.keys(schema.properties ?? {}).sort()).toEqual(Object.keys(expected).sort());
		expect(schema.required?.slice().sort()).toEqual(Object.keys(expected).sort());
		expect(schema.properties?.created_at).toMatchObject({ type: 'string', format: 'date-time' });
	});
});

describe('thermostat input freshness HTTP contract', () => {
	it('retains typed nested snake_case diagnostics under the HTTP serializer', () => {
		const input = {
			binding: 'ambient',
			role: 'ambient',
			source_property: 'sensor',
			source_kind: 'physical',
			status: 'stale',
			quality: 'unavailable',
			sampled_at: '2026-10-14T10:00:00.000Z',
			age_seconds: 120,
			maximum_age_seconds: 60,
			expires_at: '2026-10-14T10:01:00.000Z',
			reasons: ['expired'],
		};
		const response = new VirtualThermostatRuntimeResponseModel();
		response.data = Object.assign(new VirtualThermostatRuntimeModel(), {
			inputs: [input],
			epoch: 'process-epoch',
			sequence: 12,
			configuration_revision: 3,
			decision_revision: 4,
		});
		expect(
			instanceToPlain(response, { excludeExtraneousValues: true, exposeUnsetFields: false, groups: ['api'] }),
		).toEqual({
			data: { inputs: [input], epoch: 'process-epoch', sequence: 12, configuration_revision: 3, decision_revision: 4 },
		});
		const schemas: Record<string, SchemaObject> = {};
		new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper()).exploreModelSchema(
			VirtualThermostatRuntimeResponseModel,
			schemas,
		);
		expect(Object.keys(schemas.DevicesVirtualPluginDataThermostatInputRuntime.properties ?? {}).sort()).toEqual(
			Object.keys(input).sort(),
		);
	});
});
