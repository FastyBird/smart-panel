import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceContributionRegistryService } from '../../../modules/devices/services/device-contribution.registry.service';
import { CoversRole } from '../spaces-home-control.constants';

import { LightingContributionPlannerService } from './lighting-contribution-planner.service';
import { SpaceCoversStateService } from './space-covers-state.service';

describe('room cover group actual contribution state', () => {
	it('deduplicates raw members, never averages group positions or falls back to cached values; preserves refusal and expiry', async () => {
		const devices = ['a', 'b', 'group', 'other'].map((id) => ({
			id,
			type: ['group', 'other'].includes(id) ? 'virtual' : 'physical',
			mode: 'actuator_group',
			category: DeviceCategory.WINDOW_COVERING,
			channels: [
				{
					id,
					type: 'virtual',
					category: ChannelCategory.WINDOW_COVERING,
					properties: [
						{ id: `${id}-position`, category: PropertyCategory.POSITION, value: { value: 99 } },
						{ id: `${id}-command`, category: PropertyCategory.COMMAND },
					],
				},
			],
		}));
		const registry = new DeviceContributionRegistryService();
		let positions: (number | null)[] = [20, 80];
		let expiresAt = Date.now() + 300000;
		registry.register({
			getCoverage: (channel) =>
				Promise.resolve(
					['group', 'other'].includes(channel.id)
						? {
								leaves: channel.id === 'group' ? ['a', 'b'] : ['c', 'd'],
								isCurrent: () => true,
								operations: [{ operation: 'open', commandable: false, reasons: ['b: tag_unavailable'] }],
								reported: {
									total: 2,
									on: 0,
									unknown: 0,
									mixed: false,
									mixedProperties: [],
									properties: [
										{
											category: PropertyCategory.POSITION,
											value: positions[channel.id === 'group' ? 0 : 1],
											contributors: 2,
											expiresAt,
										},
									],
								},
							}
						: null,
				),
		});
		const service = new SpaceCoversStateService(
			{ findOne: () => Promise.resolve({}), findDevicesBySpace: () => Promise.resolve(devices) } as never,
			{ getRoleMap: () => Promise.resolve(new Map()) } as never,
			{ getLastCoversMode: () => Promise.resolve(null), getModeValidity: () => Promise.resolve(null) } as never,
			{ getAllCoversModeOrchestrations: () => new Map() } as never,
			new LightingContributionPlannerService(registry),
		);
		const mixed = await service.getCoversState('room');
		expect(mixed.devicesCount).toBe(4);
		expect(mixed.coversByRole[CoversRole.PRIMARY]).toBe(4);
		expect(mixed.averagePosition).toBeNull();
		expect(mixed.isPositionMixed).toBe(true);
		expect(mixed.roles[CoversRole.PRIMARY].position).toBeNull();
		expect(mixed.groupOperations.find((operation) => operation.operation === 'open')).toMatchObject({
			commandable: false,
			reasons: ['b: tag_unavailable', 'b: tag_unavailable'],
		});
		expect(Date.parse(mixed.groupExpiresAt)).toBe(expiresAt);
		positions = [20, 20];
		expect((await service.getCoversState('room')).averagePosition).toBe(20);
		expiresAt = Date.now() - 1;
		const expired = await service.getCoversState('room');
		expect(expired.averagePosition).toBeNull();
		expect(expired.allClosed).toBe(false);
		expect(expired.detectedMode).toBeNull();
		positions = [null, 20];
		expiresAt = Date.now() + 300000;
		expect((await service.getCoversState('room')).averagePosition).toBeNull();
	});
});
