import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { VirtualAggregateOutlierFilterDto } from '../../../plugins/devices-virtual/dto/producer-config.dto';
import { VirtualAggregateOutlierFilterModel } from '../../../plugins/devices-virtual/models/producer-response.model';

import { ExtendedDiscriminatorService } from './extended-discriminator.service';
import { SwaggerDocumentService } from './swagger-document.service';
import { SwaggerModelsRegistryService } from './swagger-models-registry.service';

describe('SwaggerDocumentService', () => {
	const service = new SwaggerDocumentService({} as SwaggerModelsRegistryService, {} as ExtendedDiscriminatorService);
	const normalize = (schema: Record<string, unknown>): void => {
		service['normalizeExclusiveBounds']({ components: { schemas: { Test: schema } } } as unknown as OpenAPIObject);
	};

	it('converts the actual threshold DTO/model emissions to strictly positive OpenAPI 3.1 bounds', async () => {
		const module = await Test.createTestingModule({}).compile();
		const app = module.createNestApplication();
		const registry = new SwaggerModelsRegistryService();
		registry.register(VirtualAggregateOutlierFilterDto);
		registry.register(VirtualAggregateOutlierFilterModel);
		try {
			await app.init();
			const legacy = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
				extraModels: registry.getAll(),
			});
			const document = new SwaggerDocumentService(registry, new ExtendedDiscriminatorService()).createDocument(app);
			expect(document.openapi).toBe('3.1.0');
			for (const name of [
				'DevicesVirtualPluginAggregateOutlierFilter',
				'DevicesVirtualPluginDataAggregateOutlierFilter',
			]) {
				expect(legacy.components.schemas[name]).toMatchObject({
					properties: { threshold: { minimum: 0, exclusiveMinimum: true } },
				});
				expect(document.components.schemas[name]).toMatchObject({
					properties: { threshold: { type: 'number', exclusiveMinimum: 0 } },
				});
				expect(document.components.schemas[name]).not.toHaveProperty('properties.threshold.minimum');
			}
		} finally {
			await app.close();
		}
	});

	it('converts both exclusive bounds and preserves inclusive and already numeric bounds', () => {
		const schema = {
			properties: {
				legacy: { minimum: 0, exclusiveMinimum: true, maximum: 10, exclusiveMaximum: true },
				inclusive: { minimum: 0, exclusiveMinimum: false, maximum: 10, exclusiveMaximum: false },
				numeric: { minimum: -1, exclusiveMinimum: 0, maximum: 11, exclusiveMaximum: 10 },
			},
		};
		normalize(schema);
		expect(schema.properties).toEqual({
			legacy: { exclusiveMinimum: 0, exclusiveMaximum: 10 },
			inclusive: { minimum: 0, maximum: 10 },
			numeric: { minimum: -1, exclusiveMinimum: 0, maximum: 11, exclusiveMaximum: 10 },
		});
	});

	it.each(['exclusiveMinimum', 'exclusiveMaximum'])('fails clearly for %s without a finite bound', (exclusive) => {
		const inclusive = exclusive === 'exclusiveMinimum' ? 'minimum' : 'maximum';
		for (const bound of [undefined, null, '0', NaN, Infinity, -Infinity]) {
			expect(() => normalize({ [exclusive]: true, [inclusive]: bound })).toThrow(
				`Cannot convert components.schemas.Test.${exclusive}: true requires a finite numeric ${inclusive}`,
			);
		}
	});

	it('visits schema positions in compositions, arrays and maps while preserving application data', () => {
		const bound = () => ({ minimum: 0, exclusiveMinimum: true });
		const data = { properties: { threshold: bound() }, items: bound(), allOf: [bound()] };
		const schema = {
			allOf: [{ anyOf: [{ oneOf: [{ type: 'array', items: bound() }] }] }],
			additionalProperties: bound(),
			properties: { minimum: bound(), exclusiveMinimum: bound(), map: { additionalProperties: bound() } },
			prefixItems: [bound()],
			patternProperties: { '^value': bound() },
			$defs: { Bound: bound() },
			not: bound(),
			example: structuredClone(data),
			examples: [structuredClone(data)],
			default: structuredClone(data),
			'x-custom': structuredClone(data),
		};
		normalize(schema);
		expect(schema).toMatchObject({
			allOf: [{ anyOf: [{ oneOf: [{ items: { exclusiveMinimum: 0 } }] }] }],
			additionalProperties: { exclusiveMinimum: 0 },
			properties: {
				minimum: { exclusiveMinimum: 0 },
				exclusiveMinimum: { exclusiveMinimum: 0 },
				map: { additionalProperties: { exclusiveMinimum: 0 } },
			},
			prefixItems: [{ exclusiveMinimum: 0 }],
			patternProperties: { '^value': { exclusiveMinimum: 0 } },
			$defs: { Bound: { exclusiveMinimum: 0 } },
			not: { exclusiveMinimum: 0 },
		});
		expect(schema.example).toEqual(data);
		expect(schema.examples).toEqual([data]);
		expect(schema.default).toEqual(data);
		expect(schema['x-custom']).toEqual(data);
	});

	it('encodes a nullable reference as an OpenAPI 3.1 union while preserving metadata', () => {
		const ref = '#/components/schemas/DevicesVirtualPluginDataLightGroupReportedState';
		const document = {
			components: {
				schemas: {
					DevicesVirtualPluginDataLightGroupConfiguration: {
						properties: {
							reported_state: {
								allOf: [{ $ref: ref, description: 'Referenced state' }],
								nullable: true,
								description: 'Last reported state',
								deprecated: true,
							},
						},
					},
				},
			},
		} as unknown as OpenAPIObject;
		const service = new SwaggerDocumentService({} as SwaggerModelsRegistryService, {} as ExtendedDiscriminatorService);

		service['transformAllOfToRef'](document);

		expect(document.components.schemas.DevicesVirtualPluginDataLightGroupConfiguration).toMatchObject({
			properties: {
				reported_state: {
					description: 'Last reported state',
					deprecated: true,
					anyOf: [{ $ref: ref, description: 'Referenced state' }, { type: 'null' }],
				},
			},
		});
		expect(
			(
				document.components.schemas.DevicesVirtualPluginDataLightGroupConfiguration as {
					properties: Record<string, unknown>;
				}
			).properties.reported_state,
		).not.toHaveProperty('nullable');
	});

	it('leaves nullable allOf schemas with additional constraints intact', () => {
		const reportedState = {
			allOf: [{ $ref: '#/components/schemas/ReportedState' }, { properties: { value: { minimum: 0 } } }],
			nullable: true,
			description: 'Constrained state',
		};
		const document = {
			components: { schemas: { Configuration: { properties: { reported_state: reportedState } } } },
		} as unknown as OpenAPIObject;
		const service = new SwaggerDocumentService({} as SwaggerModelsRegistryService, {} as ExtendedDiscriminatorService);

		service['transformAllOfToRef'](document);

		expect(
			(document.components.schemas.Configuration as { properties: Record<string, unknown> }).properties.reported_state,
		).toBe(reportedState);
	});
});
