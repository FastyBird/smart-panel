import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { ICamera } from '../store';

import CameraProfilesTable from './camera-profiles-table.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const camera = (profiles: Partial<ICamera['profiles'][number]>[]): ICamera => ({
	deviceId: 'cam-1',
	name: 'Front door',
	category: 'camera',
	type: 'devices-unifi-protect',
	liveView: true,
	profiles: profiles.map((profile, index) => ({
		id: `profile-${index}`,
		channelId: null,
		width: 1280,
		height: 720,
		fps: 25,
		videoCodec: 'h264',
		audioCodec: 'aac',
		available: true,
		unavailableReason: null,
		...profile,
	})),
});

const tableText = async (value: ICamera): Promise<string> => {
	const wrapper = mount(CameraProfilesTable, { props: { camera: value }, global: { stubs: { Icon: true } } });

	await flushPromises();

	return wrapper.text();
};

describe('CameraProfilesTable', () => {
	it('renders resolution and codecs', async () => {
		const text = await tableText(camera([{ id: 'high' }]));

		expect(text).toContain('high');
		expect(text).toContain('1280 × 720');
		expect(text).toContain('25');
		expect(text).toContain('h264');
		expect(text).toContain('aac');
		expect(text).toContain('camerasModule.profiles.available');
	});

	it('shows a dash for missing values', async () => {
		const text = await tableText(camera([{ width: null, height: null, fps: null, videoCodec: null, audioCodec: null }]));

		expect(text.match(/—/g)?.length).toBe(4);
	});

	it('shows the reason sentence for stream_not_enabled', async () => {
		const text = await tableText(camera([{ available: false, unavailableReason: 'stream_not_enabled' }]));

		expect(text).toContain('camerasModule.profiles.unavailable');
		expect(text).toContain('camerasModule.reasons.stream_not_enabled');
	});

	it('shows the generic sentence for an unknown reason code', async () => {
		const text = await tableText(camera([{ available: false, unavailableReason: 'something_new' }]));

		expect(text).toContain('camerasModule.reasons.unknown');
		expect(text).not.toContain('something_new');
	});

	it('shows the generic sentence for an unavailable profile without a reason', async () => {
		expect(await tableText(camera([{ available: false }]))).toContain('camerasModule.reasons.unknown');
	});
});
