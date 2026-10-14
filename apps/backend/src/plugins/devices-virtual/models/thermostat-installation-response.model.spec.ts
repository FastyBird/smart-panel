import { firstValueFrom, of } from 'rxjs';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

import { TransformResponseInterceptor } from '../../../modules/api/interceptors/transform-response.interceptor';

import {
	ThermostatInstallationModel,
	ThermostatInstallationResponseModel,
} from './thermostat-installation-response.model';

describe('thermostat installation machine observation response contract', () => {
	const observation = {
		observedAt: '2026-10-14T12:00:00.000Z',
		configurationRevision: 3,
		state: 'blocked' as const,
		reasons: ['current_machine_verification_missing'],
		scriptHash: 'reviewed-script-hash',
		firmware: '1.7.0',
		physicalSafetyCertified: false as const,
	};

	it.each([observation, null])('serializes the nested diagnostic and false certification values: %j', async (value) => {
		// Use the controller's Object.assign path and the production interceptor.
		const response = new ThermostatInstallationResponseModel();
		response.data = Object.assign(new ThermostatInstallationModel(), {
			claim: 'fixture',
			revision: 1,
			activation_requested: false,
			machine_observation: value && { ...value, untrustedExtra: true },
			physical_safety_certified: false,
		});
		const context = {
			getHandler: () => () => undefined,
			switchToHttp: () => ({ getResponse: () => ({ sent: false }) }),
		} as unknown as ExecutionContext;
		const interceptor = new TransformResponseInterceptor(new Reflector());
		const serialized: unknown = JSON.parse(
			JSON.stringify(await firstValueFrom(interceptor.intercept(context, { handle: () => of(response) }))),
		);

		expect(serialized).toEqual({
			data: {
				claim: 'fixture',
				revision: 1,
				activation_requested: false,
				machine_observation: value,
				physical_safety_certified: false,
			},
		});
	});

	it('documents a nullable reference to the machine observation schema', () => {
		const schemas: Record<string, SchemaObject> = {};
		const factory = new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper());
		factory.exploreModelSchema(ThermostatInstallationResponseModel, schemas);
		const schema = schemas.DevicesVirtualPluginDataThermostatInstallation;

		expect(schema.properties?.machine_observation).toMatchObject({
			nullable: true,
			description: 'Diagnostic only; never trusted at restart',
			allOf: [{ $ref: '#/components/schemas/DevicesVirtualPluginDataThermostatMachineObservation' }],
		});
		expect(
			schemas.DevicesVirtualPluginDataThermostatMachineObservation.properties?.physicalSafetyCertified,
		).toMatchObject({
			type: 'boolean',
			example: false,
		});
		expect(schema.properties?.physical_safety_certified).toMatchObject({ type: 'boolean', example: false });
	});
});
