import { PermissionType } from '../../../modules/devices/devices.constants';
import {
	ActivityMode,
	ActivityDomain as Domain,
	ActivityDomainStatus as Status,
} from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';
import { LightingIntentType, LightingMode, MediaActivityKey } from '../spaces-home-control.constants';

import { SpaceActivityDomainsService } from './space-activity-domains.service';

describe('real activity domain adapter contracts', () => {
	const lighting = { getLightsInSpace: jest.fn(), executeLightingIntent: jest.fn() };
	const covers = { executeCoversIntent: jest.fn(), supportsExactActivityPosition: jest.fn() };
	const coversState = { getCoversInSpace: jest.fn() };
	const endpoints = { buildEndpointsForSpace: jest.fn() };
	const media = { preview: jest.fn(), activate: jest.fn() };
	const platforms = { get: jest.fn() };
	const identity = {
		spaceId: 'space',
		activationId: 'trusted',
		configurationRevision: 1,
		isCurrent: () => Promise.resolve(true),
	};
	let service: SpaceActivityDomainsService;
	beforeEach(() => {
		jest.resetAllMocks();
		service = new SpaceActivityDomainsService(
			lighting as never,
			covers as never,
			coversState as never,
			endpoints as never,
			media as never,
			platforms as never,
		);
		lighting.getLightsInSpace.mockResolvedValue([]);
		coversState.getCoversInSpace.mockResolvedValue([]);
		endpoints.buildEndpointsForSpace.mockResolvedValue({ endpoints: [] });
		platforms.get.mockReturnValue({});
	});
	it('default climate sends zero; enabled security and climate explicitly unsupported while other domains continue', async () => {
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		expect((await service.run(Domain.CLIMATE, config, identity, 'space')).status).toBe(Status.DISABLED);
		config.climate = { enabled: true, thermostat_preset: 'comfort' };
		config.security.enabled = true;
		expect((await service.run(Domain.CLIMATE, config, identity, 'space')).status).toBe(Status.UNSUPPORTED);
		expect((await service.run(Domain.SECURITY, config, identity, 'space')).status).toBe(Status.UNSUPPORTED);
		expect((await service.run(Domain.LIGHTING, config, identity, 'space')).status).toBe(Status.NO_TARGETS);
	});
	it('Sleep sends actual OFF and custom brightness goes to the existing role-preserving plan', async () => {
		lighting.getLightsInSpace.mockResolvedValue([{}]);
		lighting.executeLightingIntent.mockResolvedValue({ success: true, affectedDevices: 1, failedDevices: 0 });
		const sleep = defaultActivityConfiguration(ActivityMode.SLEEP);
		await service.run(Domain.LIGHTING, sleep, identity, 'space');
		expect(lighting.executeLightingIntent).toHaveBeenLastCalledWith(
			'space',
			{ type: LightingIntentType.OFF, mode: LightingMode.OFF },
			expect.anything(),
			undefined,
			identity.isCurrent,
		);
		const relax = defaultActivityConfiguration(ActivityMode.RELAX);
		relax.lighting.brightness = 40;
		await service.run(Domain.LIGHTING, relax, identity, 'space');
		expect(lighting.executeLightingIntent).toHaveBeenLastCalledWith(
			'space',
			{ type: LightingIntentType.SET_MODE, mode: LightingMode.RELAX },
			expect.anything(),
			40,
			identity.isCurrent,
		);
	});
	it('preview never actuates; failed lighting does not throw across domains', async () => {
		lighting.getLightsInSpace.mockResolvedValue([{}]);
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		expect((await service.run(Domain.LIGHTING, config, null, 'space')).status).toBe(Status.READY);
		expect(lighting.executeLightingIntent).not.toHaveBeenCalled();
		lighting.executeLightingIntent.mockRejectedValue(new Error('offline'));
		expect((await service.run(Domain.LIGHTING, config, identity, 'space')).status).toBe(Status.FAILED);
	});
	it('missing media is no_targets and missing operator background binding is unsupported', async () => {
		const config = defaultActivityConfiguration(ActivityMode.RELAX);
		expect((await service.run(Domain.MEDIA, config, identity, 'space')).status).toBe(Status.NO_TARGETS);
		endpoints.buildEndpointsForSpace.mockResolvedValue({ endpoints: [{}] });
		media.preview.mockRejectedValue(new Error('No binding'));
		expect((await service.run(Domain.MEDIA, config, identity, 'space')).status).toBe(Status.UNSUPPORTED);
		expect(media.preview).toHaveBeenCalledWith('space', MediaActivityKey.BACKGROUND);
		expect(media.activate).not.toHaveBeenCalled();
	});
	it('never guesses percentage for command-only covers or groups', async () => {
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		coversState.getCoversInSpace.mockResolvedValue([
			{
				device: { type: 'test', enabled: true },
				commandProperty: { permissions: [PermissionType.WRITE_ONLY] },
				positionProperty: null,
			},
		]);
		expect((await service.run(Domain.COVERS, config, identity, 'space')).status).toBe(Status.UNSUPPORTED);
		coversState.getCoversInSpace.mockResolvedValue([
			{
				device: { type: 'virtual', mode: 'actuator_group' },
				positionProperty: { permissions: [PermissionType.READ_WRITE] },
			},
		]);
		expect((await service.run(Domain.COVERS, config, identity, 'space')).status).toBe(Status.UNSUPPORTED);
		expect(covers.executeCoversIntent).not.toHaveBeenCalled();
	});
	it('read-only controls cannot qualify a requested position', async () => {
		coversState.getCoversInSpace.mockResolvedValue([
			{ device: { type: 'test' }, positionProperty: { permissions: [PermissionType.READ_ONLY] } },
		]);
		expect(
			(await service.run(Domain.COVERS, defaultActivityConfiguration(ActivityMode.WORK), identity, 'space')).status,
		).toBe(Status.UNSUPPORTED);
	});
	it('stale identities do not replay a prepared physical action', async () => {
		const stale = { ...identity, isCurrent: () => Promise.resolve(false) };
		expect(
			(await service.run(Domain.LIGHTING, defaultActivityConfiguration(ActivityMode.WORK), stale, 'space')).status,
		).toBe(Status.FAILED);
		expect(lighting.executeLightingIntent).not.toHaveBeenCalled();
	});
});
