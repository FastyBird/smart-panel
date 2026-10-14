import { OpenAPIObject } from '@nestjs/swagger';

import { ExtendedDiscriminatorService } from './extended-discriminator.service';
import { SwaggerDocumentService } from './swagger-document.service';
import { SwaggerModelsRegistryService } from './swagger-models-registry.service';

describe('SwaggerDocumentService', () => {
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
