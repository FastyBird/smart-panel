import { randomUUID } from 'node:crypto';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { DisplayEntity } from '../../../modules/displays/entities/displays.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { ActivityDomain, ActivityDomainStatus, ActivityMode } from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';
import { MediaActivationState, MediaActivityKey } from '../spaces-home-control.constants';

import { activityTestDatabase } from './activity-test-support';
import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { MediaCapabilityService } from './media-capability.service';
import { SpaceActivityDomainsService } from './space-activity-domains.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpaceMediaActivityService } from './space-media-activity.service';

jest.setTimeout(30000);
describe('activity OFF through persisted real media deactivation', () => {
	let harness: Awaited<ReturnType<typeof activityTestDatabase>>;
	let media: SpaceMediaActivityService;
	let domains: SpaceActivityDomainsService;
	let dispatch: jest.Mock<Promise<{ success: boolean }>, [IDevicePropertyData[]]>;
	let playback: ChannelPropertyEntity;
	let state: SpaceActiveMediaActivityEntity;
	beforeEach(async () => {
		harness = await activityTestDatabase();
		const { database, room, events, lifecycle } = harness;
		const devices = database.getRepository(DeviceEntity);
		const device = await devices.save(
			devices.create({ name: 'Persisted speaker', roomId: room.id, category: DeviceCategory.SPEAKER }),
		);
		const channels = database.getRepository(ChannelEntity);
		const channel = await channels.save(
			channels.create({ name: 'Playback', device: device.id, category: ChannelCategory.MEDIA_PLAYBACK }),
		);
		const properties = database.getRepository(ChannelPropertyEntity);
		playback = await properties.save(
			properties.create({
				name: 'Command',
				channel: channel.id,
				category: PropertyCategory.COMMAND,
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.WRITE_ONLY],
				format: ['play', 'pause', 'stop'],
				step: null,
				invalid: null,
			}),
		);
		const spaces = new SpacesService(
			database.getRepository(SpaceEntity),
			devices,
			database.getRepository(DisplayEntity),
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			database,
			events,
			new SpacesTypeMapperService(),
			lifecycle,
		);
		const platforms = new PlatformRegistryService();
		platforms.register({ getType: () => device.type } as never);
		const capabilities = new MediaCapabilityService(spaces);
		const endpoints = new DerivedMediaEndpointService(spaces, capabilities);
		const bindings = new SpaceMediaActivityBindingService(
			database.getRepository(SpaceMediaActivityBindingEntity),
			spaces,
			endpoints,
			capabilities,
			events,
		);
		dispatch = jest.fn((updates) =>
			Promise.resolve({
				success: updates.every((update) => validatePropertyCommandValue(update.property, update.value).valid),
			}),
		);
		media = new SpaceMediaActivityService(
			database.getRepository(SpaceActiveMediaActivityEntity),
			spaces,
			bindings,
			endpoints,
			platforms,
			{ dispatchBatch: dispatch } as never,
			events,
		);
		domains = new SpaceActivityDomainsService({} as never, {} as never, {} as never, endpoints, media, platforms);
		state = await database.getRepository(SpaceActiveMediaActivityEntity).save(
			database.getRepository(SpaceActiveMediaActivityEntity).create({
				spaceId: room.id,
				activityKey: MediaActivityKey.BACKGROUND,
				state: MediaActivationState.ACTIVE,
				resolved: JSON.stringify({ audio_device_id: device.id }),
			}),
		);
	});
	afterEach(async () => {
		await harness.database.destroy();
	});
	const identity = () => ({
		spaceId: harness.room.id,
		activationId: randomUUID(),
		configurationRevision: 1,
		isCurrent: () => Promise.resolve(true),
	});
	it('previews OFF without activation preview or writes, then physically pauses and persists deactivation', async () => {
		const preview = jest.spyOn(media, 'preview');
		const deactivate = jest.spyOn(media, 'deactivate');
		const config = defaultActivityConfiguration(ActivityMode.SLEEP);
		expect((await domains.run(ActivityDomain.MEDIA, config, null, harness.room.id)).status).toBe(
			ActivityDomainStatus.READY,
		);
		expect(dispatch).not.toHaveBeenCalled();
		expect(
			(await harness.database.getRepository(SpaceActiveMediaActivityEntity).findOneByOrFail({ id: state.id })).state,
		).toBe(MediaActivationState.ACTIVE);
		expect((await domains.run(ActivityDomain.MEDIA, config, identity(), harness.room.id)).status).toBe(
			ActivityDomainStatus.SUCCEEDED,
		);
		expect(preview).not.toHaveBeenCalled();
		expect(deactivate).toHaveBeenCalledWith(harness.room.id, expect.any(Function));
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toHaveLength(1);
		expect(dispatch.mock.calls[0][0][0].property.id).toBe(playback.id);
		expect(dispatch.mock.calls[0][0][0].value).toBe('pause');
		expect(
			await harness.database.getRepository(SpaceActiveMediaActivityEntity).findOneByOrFail({ id: state.id }),
		).toMatchObject({ state: MediaActivationState.DEACTIVATED, activityKey: null });
		expect(await harness.database.getRepository(SpaceMediaActivityBindingEntity).count()).toBe(0);
	});
	it('ordinary deactivation also resolves the actual persisted snake_case IDs and pauses playback', async () => {
		const result = await media.deactivate(harness.room.id);
		expect(result.state).toBe(MediaActivationState.DEACTIVATED);
		expect(result.warnings).toBeUndefined();
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toHaveLength(1);
		expect(dispatch.mock.calls[0][0][0].property.id).toBe(playback.id);
		expect(dispatch.mock.calls[0][0][0].value).toBe('pause');
	});
	it('reports failed physical stop honestly even though the media service clears its selection', async () => {
		dispatch.mockResolvedValue({ success: false });
		expect(
			(
				await domains.run(
					ActivityDomain.MEDIA,
					defaultActivityConfiguration(ActivityMode.WORK),
					identity(),
					harness.room.id,
				)
			).status,
		).toBe(ActivityDomainStatus.FAILED);
		expect(
			(await harness.database.getRepository(SpaceActiveMediaActivityEntity).findOneByOrFail({ id: state.id })).state,
		).toBe(MediaActivationState.DEACTIVATED);
	});
	it('refuses invalid persisted JSON and incompatible pause controls without dispatch or pretending ready', async () => {
		await harness.database.getRepository(SpaceActiveMediaActivityEntity).update(state.id, { resolved: '{invalid' });
		const config = defaultActivityConfiguration(ActivityMode.SLEEP);
		expect((await domains.run(ActivityDomain.MEDIA, config, null, harness.room.id)).status).toBe(
			ActivityDomainStatus.UNSUPPORTED,
		);
		expect((await domains.run(ActivityDomain.MEDIA, config, identity(), harness.room.id)).status).toBe(
			ActivityDomainStatus.UNSUPPORTED,
		);
		expect(dispatch).not.toHaveBeenCalled();
	});
	it('rejects missing pause enum support before deactivation', async () => {
		await harness.database.getRepository(ChannelPropertyEntity).update(playback.id, { format: ['play', 'stop'] });
		expect(
			(
				await domains.run(
					ActivityDomain.MEDIA,
					defaultActivityConfiguration(ActivityMode.WORK),
					identity(),
					harness.room.id,
				)
			).status,
		).toBe(ActivityDomainStatus.UNSUPPORTED);
		expect(dispatch).not.toHaveBeenCalled();
	});
	it('preserves no_targets and fences a deactivation that becomes stale after admission', async () => {
		const current = jest.fn<Promise<boolean>, []>().mockResolvedValueOnce(true).mockResolvedValue(false);
		const stale = { ...identity(), isCurrent: current };
		expect(
			(await domains.run(ActivityDomain.MEDIA, defaultActivityConfiguration(ActivityMode.WORK), stale, harness.room.id))
				.status,
		).toBe(ActivityDomainStatus.FAILED);
		expect(dispatch).not.toHaveBeenCalled();
		await harness.database.getRepository(SpaceActiveMediaActivityEntity).delete(state.id);
		expect(
			(
				await domains.run(
					ActivityDomain.MEDIA,
					defaultActivityConfiguration(ActivityMode.WORK),
					identity(),
					harness.room.id,
				)
			).status,
		).toBe(ActivityDomainStatus.NO_TARGETS);
		expect(dispatch).not.toHaveBeenCalled();
	});
	it('rechecks the trusted identity inside the real deactivation action before physical pause', async () => {
		const current = jest.fn<Promise<boolean>, []>().mockResolvedValueOnce(true).mockResolvedValue(false);
		await expect(media.deactivate(harness.room.id, current)).rejects.toThrow('superseded');
		expect(dispatch).not.toHaveBeenCalled();
		expect(
			(await harness.database.getRepository(SpaceActiveMediaActivityEntity).findOneByOrFail({ id: state.id })).state,
		).toBe(MediaActivationState.ACTIVE);
	});
	it('retains the existing binding preview path for Background and never creates a binding', async () => {
		const preview = jest.spyOn(media, 'preview');
		expect(
			(
				await domains.run(
					ActivityDomain.MEDIA,
					defaultActivityConfiguration(ActivityMode.RELAX),
					identity(),
					harness.room.id,
				)
			).status,
		).toBe(ActivityDomainStatus.UNSUPPORTED);
		expect(preview).toHaveBeenCalledWith(harness.room.id, MediaActivityKey.BACKGROUND);
		expect(dispatch).not.toHaveBeenCalled();
		expect(await harness.database.getRepository(SpaceMediaActivityBindingEntity).count()).toBe(0);
	});
});
