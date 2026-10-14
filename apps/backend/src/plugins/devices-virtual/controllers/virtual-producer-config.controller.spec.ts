import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import { VirtualLightGroupAuthoringService } from '../services/virtual-light-group-authoring.service';
import { VirtualProducerConfigService } from '../services/virtual-producer-config.service';

import { VirtualProducerConfigController } from './virtual-producer-config.controller';

describe('producer configuration HTTP failures', () => {
	it('reports a rejected policy or stale revision as 422', async () => {
		const configs = {
			configureAggregate: jest.fn().mockRejectedValue(new DevicesValidationException('revision changed')),
		};
		const controller = new VirtualProducerConfigController(
			configs as unknown as VirtualProducerConfigService,
			{} as VirtualLightGroupAuthoringService,
		);
		await expect(controller.configureAggregate('output', new ConfigureVirtualAggregateDto())).rejects.toBeInstanceOf(
			UnprocessableEntityException,
		);
	});

	it('preserves a missing configuration response as 404', async () => {
		const configs = { getAggregate: jest.fn().mockRejectedValue(new NotFoundException('missing')) };
		const controller = new VirtualProducerConfigController(
			configs as unknown as VirtualProducerConfigService,
			{} as VirtualLightGroupAuthoringService,
		);
		await expect(controller.getAggregate('output')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('returns HTTP 201 for a created group through the Fastify route', async () => {
		const module = await Test.createTestingModule({
			controllers: [VirtualProducerConfigController],
			providers: [
				{ provide: VirtualProducerConfigService, useValue: {} },
				{
					provide: VirtualLightGroupAuthoringService,
					useValue: { create: jest.fn().mockResolvedValue({ id: 'created' }) },
				},
			],
		}).compile();
		const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		try {
			await app.init();
			const response = await app.inject({ method: 'POST', url: '/producers/light-groups', payload: {} });
			expect(response.statusCode).toBe(201);
			expect(response.body).toContain('"id":"created"');
		} finally {
			await app.close();
		}
	});
});
