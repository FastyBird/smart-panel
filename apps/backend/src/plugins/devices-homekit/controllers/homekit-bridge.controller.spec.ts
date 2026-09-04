import { HomeKitCandidatesResponseModel, HomeKitDeviceCandidateModel } from '../models/bridge-candidate.model';
import { HomeKitBridgeStatusModel, HomeKitBridgeStatusResponseModel } from '../models/bridge-status.model';
import { HomeKitBridgeService } from '../services/homekit-bridge.service';
import { HomeKitWizardService } from '../services/homekit-wizard.service';

import { HomeKitBridgeController } from './homekit-bridge.controller';

describe('HomeKitBridgeController', () => {
	let controller: HomeKitBridgeController;
	let bridgeService: { getStatus: jest.Mock; resetPairing: jest.Mock };
	let wizardService: { getCandidates: jest.Mock; mapDevices: jest.Mock };

	beforeEach(() => {
		bridgeService = {
			getStatus: jest.fn(),
			resetPairing: jest.fn(),
		};
		wizardService = {
			getCandidates: jest.fn(),
			mapDevices: jest.fn(),
		};

		controller = new HomeKitBridgeController(
			bridgeService as unknown as HomeKitBridgeService,
			wizardService as unknown as HomeKitWizardService,
		);
	});

	it('should return bridge status wrapped in response model', async () => {
		const mockStatus = new HomeKitBridgeStatusModel();
		mockStatus.running = true;
		mockStatus.bridgeName = 'Smart Panel Bridge';
		mockStatus.port = 51826;
		mockStatus.pincode = '031-45-154';
		mockStatus.username = 'CC:22:3D:E3:CE:30';

		bridgeService.getStatus.mockResolvedValue(mockStatus);

		const result = await controller.getStatus();
		expect(result).toBeInstanceOf(HomeKitBridgeStatusResponseModel);
		expect(result.data).toEqual(mockStatus);
	});

	it('should reset pairing and return updated status', async () => {
		const mockStatus = new HomeKitBridgeStatusModel();
		mockStatus.running = true;
		mockStatus.paired = false;

		bridgeService.resetPairing.mockResolvedValue(undefined);
		bridgeService.getStatus.mockResolvedValue(mockStatus);

		const result = await controller.resetPairing();
		expect(bridgeService.resetPairing).toHaveBeenCalled();
		expect(result.data).toEqual(mockStatus);
	});

	it('should return device candidates for mapping', async () => {
		const candidate = new HomeKitDeviceCandidateModel();
		candidate.id = 'dev-1';
		candidate.name = 'Ceiling Light';
		candidate.isCompatible = true;
		candidate.isMapped = true;

		wizardService.getCandidates.mockResolvedValue([candidate]);

		const result = await controller.getCandidates();
		expect(result).toBeInstanceOf(HomeKitCandidatesResponseModel);
		expect(result.data).toEqual([candidate]);
	});

	it('should update mapped devices and return refreshed candidates', async () => {
		const candidate = new HomeKitDeviceCandidateModel();
		candidate.id = 'dev-1';
		candidate.isMapped = true;

		wizardService.mapDevices.mockResolvedValue(undefined);
		wizardService.getCandidates.mockResolvedValue([candidate]);

		const result = await controller.mapDevices({ data: { device_ids: ['dev-1'] } });
		expect(wizardService.mapDevices).toHaveBeenCalledWith(['dev-1']);
		expect(result.data).toEqual([candidate]);
	});
});
