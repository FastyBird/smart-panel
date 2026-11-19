import { DataSource } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';

import { VirtualSourceReportingService } from './virtual-source-reporting.service';

describe('VirtualSourceReportingService', () => {
	const findOne = jest.fn();
	const readReportingProfile = jest.fn();
	const service = new VirtualSourceReportingService(
		{ manager: { findOne } } as unknown as DataSource,
		{ readReportingProfile } as unknown as PropertyValueService,
	);
	const property = (deviceType: string): ChannelPropertyEntity =>
		({ id: 'property', channel: { id: 'channel', device: { id: 'device', type: deviceType } } }) as never;

	beforeEach(() => jest.resetAllMocks());

	it('describes a physical source by its observed reporting and recommends a fitting maximum age', async () => {
		findOne.mockResolvedValue(property('zigbee2mqtt'));
		readReportingProfile.mockReturnValue({
			reports: 5,
			typicalIntervalMs: 3_300_000,
			longestIntervalMs: 3_600_000,
			firstReportAt: new Date('2026-11-18T08:00:00Z'),
			lastReportAt: new Date('2026-11-18T12:00:00Z'),
		});
		await expect(service.sourceReporting('property')).resolves.toEqual({
			property: 'property',
			source_kind: 'physical',
			reports: 5,
			typical_interval_seconds: 3_300,
			longest_interval_seconds: 3_600,
			last_report_at: '2026-11-18T12:00:00.000Z',
			recommended_maximum_age_seconds: 5_400,
		});
	});

	it('reports no cadence before enough reports were seen', async () => {
		findOne.mockResolvedValue(property('zigbee2mqtt'));
		readReportingProfile.mockReturnValue(null);
		await expect(service.sourceReporting('property')).resolves.toMatchObject({
			source_kind: 'physical',
			reports: 0,
			typical_interval_seconds: null,
			recommended_maximum_age_seconds: null,
		});
	});

	it('leaves a derived source to its own freshness policy', async () => {
		findOne.mockResolvedValue(property('virtual'));
		await expect(service.sourceReporting('property')).resolves.toMatchObject({
			source_kind: 'derived',
			recommended_maximum_age_seconds: null,
		});
		expect(readReportingProfile).not.toHaveBeenCalled();
	});

	it('returns null for an unknown property', async () => {
		findOne.mockResolvedValue(null);
		await expect(service.sourceReporting('missing')).resolves.toBeNull();
	});
});
