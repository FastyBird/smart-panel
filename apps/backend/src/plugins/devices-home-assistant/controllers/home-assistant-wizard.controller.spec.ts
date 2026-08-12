import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { HomeAssistantWizardService } from '../services/wizard.service';

import { HomeAssistantWizardController } from './home-assistant-wizard.controller';

describe('HomeAssistantWizardController', () => {
	let controller: HomeAssistantWizardController;
	let wizardService: jest.Mocked<HomeAssistantWizardService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [HomeAssistantWizardController],
			providers: [
				{
					provide: HomeAssistantWizardService,
					useValue: {
						start: jest.fn(),
						get: jest.fn(),
						end: jest.fn(),
						adopt: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get(HomeAssistantWizardController);
		wizardService = module.get(HomeAssistantWizardService);
	});

	it('starts a bulk wizard session', async () => {
		const session = { id: 'session-1', startedAt: '2026-08-12T10:00:00.000Z', candidates: [] };
		wizardService.start.mockResolvedValueOnce(session);

		await expect(controller.startSession()).resolves.toEqual(expect.objectContaining({ data: session }));
	});

	it('returns not found for an unknown session', () => {
		wizardService.get.mockReturnValueOnce(null);

		expect(() => controller.getSession('missing')).toThrow(NotFoundException);
	});

	it('passes only selected candidate keys to adoption', async () => {
		wizardService.adopt.mockResolvedValueOnce([
			{ key: 'device:ha-device-1', name: 'Lamp', status: 'created', error: null },
		]);

		const response = await controller.adopt('session-1', {
			data: { keys: ['device:ha-device-1'] },
		});

		expect(wizardService.adopt.mock.calls).toEqual([['session-1', ['device:ha-device-1']]]);
		expect(response.data.results[0]?.status).toBe('created');
	});

	it('ends a wizard session', () => {
		controller.endSession('session-1');

		expect(wizardService.end.mock.calls).toEqual([['session-1']]);
	});
});
