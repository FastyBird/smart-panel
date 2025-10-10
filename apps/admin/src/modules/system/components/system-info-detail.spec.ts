import type { ComponentPublicInstance } from 'vue';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

import type { ISystemInfoDetailProps } from './system-info-detail.types';
import SystemInfoDetail from './system-info-detail.vue';

type SystemInfoDetailInstance = ComponentPublicInstance<ISystemInfoDetailProps>;

const displayId = uuid();
const displayUid = uuid();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		formatNumber: (value: number) => value.toString(),
	};
});

const mockSystemInfo: ISystemInfo = {
	cpuLoad: 12.34,
	memory: {
		used: 1024 * 1024 * 2,
		total: 1024 * 1024 * 4,
		free: 0,
	},
	temperature: {
		cpu: 55,
		gpu: 60,
	},
	os: {
		platform: 'linux',
		distro: 'Ubuntu',
		release: '22.04',
		uptime: 1400,
	},
	defaultNetwork: {
		interface: 'eth0',
		ip4: '192.168.1.100',
		ip6: 'fe80::1',
		mac: 'AA:BB:CC:DD:EE:FF',
	},
	display: {
		resolutionX: 1920,
		resolutionY: 1080,
		currentResX: 1920,
		currentResY: 1080,
	},
} as ISystemInfo;

const mockThrottleStatus: IThrottleStatus = {
	undervoltage: true,
	frequencyCapping: false,
	throttling: true,
	softTempLimit: false,
};

const mockDisplays: IDisplayProfile[] = [
	{
		id: displayId,
		uid: displayUid,
		screenWidth: 1920,
		screenHeight: 1080,
		pixelRatio: 2,
		unitSize: 70,
		rows: 6,
		cols: 4,
		primary: true,
		createdAt: new Date(),
		updatedAt: null,
	},
];

describe('SystemInfoDetail.vue', () => {
	let wrapper: VueWrapper<SystemInfoDetailInstance>;

	beforeEach(() => {
		wrapper = mount(SystemInfoDetail, {
			props: {
				systemInfo: mockSystemInfo,
				throttleStatus: mockThrottleStatus,
				displays: mockDisplays,
			},
		});
	});

	it('renders hardware info section', () => {
		expect(wrapper.text()).toContain('systemModule.systemInfo.cpuLoad');
		expect(wrapper.text()).toContain('55'); // CPU temp
		expect(wrapper.text()).toContain('60'); // GPU temp
	});

	it('renders operating system section', () => {
		expect(wrapper.text()).toContain('Ubuntu');
		expect(wrapper.text()).toContain('22.04');
	});

	it('renders network section', () => {
		expect(wrapper.text()).toContain('eth0');
		expect(wrapper.text()).toContain('192.168.1.100');
	});

	it('renders display section', () => {
		expect(wrapper.text()).toContain('1920px');
		expect(wrapper.text()).toContain('1080px');
	});

	it('renders throttle status tags correctly', () => {
		const tags = wrapper.findAllComponents({ name: 'ElTag' });

		expect(tags).toHaveLength(4);
		expect(tags[0].props('type')).toBe('danger'); // undervoltage
		expect(tags[1].props('type')).toBe('success'); // frequencyCapping
		expect(tags[2].props('type')).toBe('danger'); // throttling
		expect(tags[3].props('type')).toBe('success'); // softTempLimit
	});

	it('renders fallback values if throttleStatus is not provided', () => {
		const noStatusWrapper = mount(SystemInfoDetail, {
			props: {
				systemInfo: mockSystemInfo,
				throttleStatus: null,
				displays: mockDisplays,
			},
		});

		expect(noStatusWrapper.text()).toContain('application.value.notAvailable');
	});
});
