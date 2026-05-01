/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Z2mWizardService } from '../services/wizard.service';

import { Zigbee2mqttWizardController } from './zigbee2mqtt-wizard.controller';

describe('Zigbee2mqttWizardController', () => {
	let controller: Zigbee2mqttWizardController;
	let wizardService: jest.Mocked<Z2mWizardService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [Zigbee2mqttWizardController],
			providers: [
				{
					provide: Z2mWizardService,
					useValue: {
						start: jest.fn(),
						get: jest.fn(),
						end: jest.fn(),
						enablePermitJoin: jest.fn(),
						disablePermitJoin: jest.fn(),
						adopt: jest.fn(),
					},
				},
			],
		}).compile();
		controller = module.get(Zigbee2mqttWizardController);
		wizardService = module.get(Z2mWizardService);
	});

	it('POST /wizard returns the new session', async () => {
		const session = {
			id: 'a',
			bridgeOnline: true,
			startedAt: 't',
			permitJoin: { active: false, expiresAt: null, remainingSeconds: 0 },
			devices: [],
		};
		wizardService.start.mockResolvedValueOnce(session as any);
		const res = await controller.startSession();
		expect(res.data).toEqual(session);
	});

	it('GET /wizard/:id throws 404 for unknown id', () => {
		wizardService.get.mockReturnValue(null);
		expect(() => controller.getSession('nope')).toThrow(NotFoundException);
	});

	it('DELETE /wizard/:id calls service.end()', async () => {
		wizardService.end.mockResolvedValueOnce(undefined);
		await controller.endSession('a');
		expect(wizardService.end).toHaveBeenCalledWith('a');
	});

	it('POST /wizard/:id/permit-join returns updated session', async () => {
		const updated = {
			id: 'a',
			bridgeOnline: true,
			startedAt: 't',
			permitJoin: { active: true, expiresAt: 'x', remainingSeconds: 254 },
			devices: [],
		};
		wizardService.enablePermitJoin.mockResolvedValueOnce(updated as any);
		const res = await controller.enablePermitJoin('a');
		expect(res.data).toEqual(updated);
	});

	it('POST /wizard/:id/permit-join throws 404 when service returns null', async () => {
		wizardService.enablePermitJoin.mockResolvedValueOnce(null);
		await expect(controller.enablePermitJoin('nope')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('DELETE /wizard/:id/permit-join returns updated session', async () => {
		const updated = {
			id: 'a',
			bridgeOnline: true,
			startedAt: 't',
			permitJoin: { active: false, expiresAt: null, remainingSeconds: 0 },
			devices: [],
		};
		wizardService.disablePermitJoin.mockResolvedValueOnce(updated as any);
		const res = await controller.disablePermitJoin('a');
		expect(res.data).toEqual(updated);
	});

	it('POST /wizard/:id/adopt returns adoption results', async () => {
		wizardService.adopt.mockResolvedValueOnce([{ ieeeAddress: 'x', name: 'X', status: 'created', error: null }]);
		const res = await controller.adopt('a', {
			data: { devices: [{ ieeeAddress: 'x', name: 'X', category: 'lighting' as any }] },
		} as any);
		expect(res.data.results).toHaveLength(1);
		expect(res.data.results[0]?.status).toBe('created');
	});

	it('POST /wizard/:id/adopt throws 404 when service returns null (unknown session)', async () => {
		wizardService.adopt.mockResolvedValueOnce(null);
		await expect(
			controller.adopt('nope', {
				data: { devices: [{ ieeeAddress: 'x', name: 'X', category: 'lighting' as any }] },
			} as any)
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
