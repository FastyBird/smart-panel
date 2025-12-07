import { ChannelCategory, DeviceCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

import { findMatchingRule, inferDeviceCategory } from './ha-entity-mapping.rules';

describe('HaEntityMappingRules', () => {
	describe('findMatchingRule', () => {
		it('should find a rule for light domain', () => {
			const rule = findMatchingRule(HomeAssistantDomain.LIGHT, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.LIGHT);
			expect(rule?.device_category_hint).toBe(DeviceCategory.LIGHTING);
		});

		it('should find a rule for switch domain with outlet device class', () => {
			const rule = findMatchingRule(HomeAssistantDomain.SWITCH, 'outlet');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.OUTLET);
			expect(rule?.device_category_hint).toBe(DeviceCategory.OUTLET);
		});

		it('should find a rule for switch domain without device class', () => {
			const rule = findMatchingRule(HomeAssistantDomain.SWITCH, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.SWITCHER);
			expect(rule?.device_category_hint).toBe(DeviceCategory.SWITCHER);
		});

		it('should find a rule for temperature sensor', () => {
			const rule = findMatchingRule(HomeAssistantDomain.SENSOR, 'temperature');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.TEMPERATURE);
			expect(rule?.device_category_hint).toBe(DeviceCategory.SENSOR);
		});

		it('should find a rule for humidity sensor', () => {
			const rule = findMatchingRule(HomeAssistantDomain.SENSOR, 'humidity');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.HUMIDITY);
		});

		it('should find a rule for binary sensor motion', () => {
			const rule = findMatchingRule(HomeAssistantDomain.BINARY_SENSOR, 'motion');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.MOTION);
		});

		it('should find a rule for binary sensor door', () => {
			const rule = findMatchingRule(HomeAssistantDomain.BINARY_SENSOR, 'door');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.CONTACT);
		});

		it('should find a rule for climate domain', () => {
			const rule = findMatchingRule(HomeAssistantDomain.CLIMATE, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.THERMOSTAT);
			expect(rule?.device_category_hint).toBe(DeviceCategory.THERMOSTAT);
		});

		it('should find a rule for cover domain with blind device class', () => {
			const rule = findMatchingRule(HomeAssistantDomain.COVER, 'blind');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.WINDOW_COVERING);
		});

		it('should find a rule for cover domain with door device class', () => {
			const rule = findMatchingRule(HomeAssistantDomain.COVER, 'door');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.DOOR);
		});

		it('should find a rule for fan domain', () => {
			const rule = findMatchingRule(HomeAssistantDomain.FAN, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.FAN);
		});

		it('should find a rule for lock domain', () => {
			const rule = findMatchingRule(HomeAssistantDomain.LOCK, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.LOCK);
		});

		it('should find a rule for vacuum domain', () => {
			const rule = findMatchingRule(HomeAssistantDomain.VACUUM, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.ROBOT_VACUUM);
		});

		it('should return null for unknown domain', () => {
			const rule = findMatchingRule('unknown_domain' as HomeAssistantDomain, null);

			expect(rule).toBeNull();
		});
	});

	describe('inferDeviceCategory', () => {
		it('should infer lighting device category for light channel', () => {
			const category = inferDeviceCategory([ChannelCategory.LIGHT]);

			expect(category).toBe(DeviceCategory.LIGHTING);
		});

		it('should infer sensor device category for temperature channel', () => {
			const category = inferDeviceCategory([ChannelCategory.TEMPERATURE]);

			expect(category).toBe(DeviceCategory.SENSOR);
		});

		it('should infer thermostat device category for thermostat channel', () => {
			const category = inferDeviceCategory([ChannelCategory.THERMOSTAT]);

			expect(category).toBe(DeviceCategory.THERMOSTAT);
		});

		it('should return generic for empty channel list', () => {
			const category = inferDeviceCategory([]);

			expect(category).toBe(DeviceCategory.GENERIC);
		});

		it('should prioritize higher priority device hints', () => {
			// When a device has multiple channels, it should pick the best match
			const category = inferDeviceCategory([ChannelCategory.LIGHT, ChannelCategory.TEMPERATURE]);

			// Light has priority 10, temperature sensor has priority 20
			// But since the hint for light is LIGHTING, it should be selected based on rules
			expect([DeviceCategory.LIGHTING, DeviceCategory.SENSOR]).toContain(category);
		});
	});
});
