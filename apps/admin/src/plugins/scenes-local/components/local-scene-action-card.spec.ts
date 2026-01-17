import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import LocalSceneActionCard from './local-scene-action-card.vue';

// Mock composables
const mockDevices = ref<Array<{ id: string; name: string }>>([]);
const mockChannels = ref<Array<{ id: string; name: string }>>([]);
const mockProperties = ref<Array<{ id: string; name: string | null; category: string }>>([]);
const mockDevicesLoaded = ref(true);
const mockFetchDevices = vi.fn();
const mockFetchChannels = vi.fn();
const mockFetchProperties = vi.fn();

vi.mock('../../../modules/devices', () => ({
	useDevices: () => ({
		devices: mockDevices,
		fetchDevices: mockFetchDevices,
		loaded: mockDevicesLoaded,
	}),
	useChannels: () => ({
		channels: mockChannels,
		fetchChannels: mockFetchChannels,
	}),
	useChannelsProperties: () => ({
		properties: mockProperties,
		fetchProperties: mockFetchProperties,
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				'scenesLocalPlugin.actionCard.unknownDevice': 'Unknown device',
				'scenesLocalPlugin.actionCard.unknownChannel': 'Unknown channel',
				'scenesLocalPlugin.actionCard.unknownProperty': 'Unknown property',
				'scenesLocalPlugin.actionCard.missingResource': 'This action references a deleted device, channel, or property',
				'devicesModule.categories.channelsProperties.on': 'On/Off',
				'devicesModule.categories.channelsProperties.brightness': 'Brightness',
			};
			return translations[key] ?? key;
		},
	}),
}));

// =============================================================================
// Tests for LocalSceneActionCard Missing Resource Detection
// =============================================================================

describe('LocalSceneActionCard.vue', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset mock data
		mockDevices.value = [];
		mockChannels.value = [];
		mockProperties.value = [];
		mockDevicesLoaded.value = true;
	});

	describe('Missing Resource Detection', () => {
		describe('When all resources exist', () => {
			beforeEach(() => {
				mockDevices.value = [{ id: 'device-1', name: 'Living Room Light' }];
				mockChannels.value = [{ id: 'channel-1', name: 'Light Channel' }];
				mockProperties.value = [{ id: 'property-1', name: 'On/Off', category: 'on' }];
			});

			it('should not show warning indicator when device exists', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'device-1',
							channelId: 'channel-1',
							propertyId: 'property-1',
							value: true,
						},
					},
				});

				// Should not have warning icon
				expect(wrapper.find('.warning-icon').exists()).toBe(false);
				// Should not have missing resource class
				expect(wrapper.find('.has-missing-resource').exists()).toBe(false);
			});

			it('should display device name correctly', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'device-1',
							channelId: 'channel-1',
							propertyId: 'property-1',
							value: true,
						},
					},
				});

				expect(wrapper.text()).toContain('Living Room Light');
			});
		});

		describe('When device is missing', () => {
			beforeEach(() => {
				mockDevices.value = []; // No devices
				mockChannels.value = [];
				mockProperties.value = [];
			});

			it('should show warning indicator when device is deleted', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'deleted-device-id',
							channelId: 'channel-1',
							propertyId: 'property-1',
							value: true,
						},
					},
				});

				// Should have warning icon
				expect(wrapper.find('.warning-icon').exists()).toBe(true);
				// Should have missing resource class
				expect(wrapper.find('.has-missing-resource').exists()).toBe(true);
			});

			it('should display "Unknown device" text', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'deleted-device-id',
							channelId: 'channel-1',
							propertyId: 'property-1',
							value: true,
						},
					},
				});

				expect(wrapper.text()).toContain('Unknown device');
			});
		});

		describe('When channel is missing', () => {
			beforeEach(() => {
				mockDevices.value = [{ id: 'device-1', name: 'Living Room Light' }];
				mockChannels.value = []; // No channels
				mockProperties.value = [];
			});

			it('should show warning indicator when channel is deleted', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'device-1',
							channelId: 'deleted-channel-id',
							propertyId: 'property-1',
							value: true,
						},
					},
				});

				expect(wrapper.find('.warning-icon').exists()).toBe(true);
				expect(wrapper.find('.has-missing-resource').exists()).toBe(true);
			});
		});

		describe('When property is missing', () => {
			beforeEach(() => {
				mockDevices.value = [{ id: 'device-1', name: 'Living Room Light' }];
				mockChannels.value = [{ id: 'channel-1', name: 'Light Channel' }];
				mockProperties.value = []; // No properties
			});

			it('should show warning indicator when property is deleted', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'device-1',
							channelId: 'channel-1',
							propertyId: 'deleted-property-id',
							value: true,
						},
					},
				});

				expect(wrapper.find('.warning-icon').exists()).toBe(true);
				expect(wrapper.find('.has-missing-resource').exists()).toBe(true);
			});

			it('should display "Unknown property" text', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: 'device-1',
							channelId: 'channel-1',
							propertyId: 'deleted-property-id',
							value: true,
						},
					},
				});

				expect(wrapper.text()).toContain('Unknown property');
			});
		});

		describe('When no IDs are provided', () => {
			it('should not show warning when deviceId is empty string', () => {
				const wrapper = mount(LocalSceneActionCard, {
					props: {
						action: {
							id: 'action-1',
							type: 'local',
							deviceId: '',
							channelId: '',
							propertyId: '',
							value: true,
						},
					},
				});

				// Empty IDs should not trigger "missing" state
				// (missing = has ID but resource not found)
				expect(wrapper.find('.warning-icon').exists()).toBe(false);
			});
		});
	});

	describe('Value Formatting', () => {
		beforeEach(() => {
			mockDevices.value = [{ id: 'device-1', name: 'Light' }];
			mockChannels.value = [{ id: 'channel-1', name: 'Channel' }];
			mockProperties.value = [{ id: 'property-1', name: 'On/Off', category: 'on' }];
		});

		it('should display "ON" for boolean true value', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						channelId: 'channel-1',
						propertyId: 'property-1',
						value: true,
					},
				},
			});

			expect(wrapper.text()).toContain('ON');
		});

		it('should display "OFF" for boolean false value', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						channelId: 'channel-1',
						propertyId: 'property-1',
						value: false,
					},
				},
			});

			expect(wrapper.text()).toContain('OFF');
		});

		it('should display numeric value as string', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						channelId: 'channel-1',
						propertyId: 'property-1',
						value: 75,
					},
				},
			});

			expect(wrapper.text()).toContain('75');
		});

		it('should display string value as-is', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						channelId: 'channel-1',
						propertyId: 'property-1',
						value: 'custom_mode',
					},
				},
			});

			expect(wrapper.text()).toContain('custom_mode');
		});
	});

	describe('Backwards Compatibility', () => {
		beforeEach(() => {
			mockDevices.value = [{ id: 'device-1', name: 'Light' }];
			mockChannels.value = [{ id: 'channel-1', name: 'Channel' }];
			mockProperties.value = [{ id: 'property-1', name: 'On/Off', category: 'on' }];
		});

		it('should support camelCase IDs at root level', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						channelId: 'channel-1',
						propertyId: 'property-1',
						value: true,
					},
				},
			});

			expect(wrapper.text()).toContain('Light');
			expect(wrapper.find('.warning-icon').exists()).toBe(false);
		});

		it('should support snake_case IDs in configuration for backwards compatibility', () => {
			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						configuration: {
							device_id: 'device-1',
							channel_id: 'channel-1',
							property_id: 'property-1',
							value: true,
						},
					},
				},
			});

			expect(wrapper.text()).toContain('Light');
			expect(wrapper.find('.warning-icon').exists()).toBe(false);
		});

		it('should prefer root-level IDs over configuration', () => {
			mockDevices.value = [
				{ id: 'device-1', name: 'Root Device' },
				{ id: 'config-device', name: 'Config Device' },
			];

			const wrapper = mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1', // Root level takes precedence
						configuration: {
							device_id: 'config-device',
							channel_id: 'channel-1',
							property_id: 'property-1',
							value: true,
						},
					},
				},
			});

			expect(wrapper.text()).toContain('Root Device');
		});
	});

	describe('Data Fetching', () => {
		it('should fetch devices if not loaded', async () => {
			mockDevicesLoaded.value = false;

			mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						value: true,
					},
				},
			});

			// Wait for onBeforeMount to execute
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockFetchDevices).toHaveBeenCalled();
		});

		it('should not fetch devices if already loaded', async () => {
			mockDevicesLoaded.value = true;

			mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'device-1',
						value: true,
					},
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockFetchDevices).not.toHaveBeenCalled();
		});

		it('should skip fetching channels when device is deleted', async () => {
			mockDevicesLoaded.value = true;
			mockDevices.value = []; // Device was deleted

			mount(LocalSceneActionCard, {
				props: {
					action: {
						id: 'action-1',
						type: 'local',
						deviceId: 'deleted-device',
						channelId: 'channel-1',
						value: true,
					},
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			// Should not try to fetch channels for deleted device
			expect(mockFetchChannels).not.toHaveBeenCalled();
		});
	});
});
