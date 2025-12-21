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

		it('should find a rule for alarm control panel', () => {
			const rule = findMatchingRule(HomeAssistantDomain.ALARM_CONTROL_PANEL, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.ALARM);
		});

		it('should find a rule for siren', () => {
			const rule = findMatchingRule(HomeAssistantDomain.SIREN, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.ALARM);
		});

		it('should find a rule for input boolean', () => {
			const rule = findMatchingRule(HomeAssistantDomain.INPUT_BOOLEAN, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.SWITCHER);
		});

		it('should find a rule for water heater', () => {
			const rule = findMatchingRule(HomeAssistantDomain.WATER_HEATER, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.HEATER);
		});

		it('should find a fallback rule for media player', () => {
			const rule = findMatchingRule(HomeAssistantDomain.MEDIA_PLAYER, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.MEDIA_PLAYBACK);
		});

		it('should find a rule for vibration sensor', () => {
			const rule = findMatchingRule(HomeAssistantDomain.BINARY_SENSOR, 'vibration');

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.MOTION);
		});

		it('should find a rule for tamper sensor', () => {
			const rule = findMatchingRule(HomeAssistantDomain.BINARY_SENSOR, 'tamper');

			expect(rule).not.toBeNull();
		});

		it('should find a rule for button entity', () => {
			const rule = findMatchingRule(HomeAssistantDomain.BUTTON, null);

			expect(rule).not.toBeNull();
			expect(rule?.channel_category).toBe(ChannelCategory.GENERIC);
		});

		it('should find a rule for remote entity', () => {
			const rule = findMatchingRule(HomeAssistantDomain.REMOTE, null);

			expect(rule).not.toBeNull();
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

			// With primary domain-based inference, LIGHTING should be selected
			expect(category).toBe(DeviceCategory.LIGHTING);
		});
	});

	describe('inferDeviceCategory with domain roles', () => {
		it('should return LIGHTING for device with light + multiple sensors', () => {
			const channels = [
				ChannelCategory.LIGHT,
				ChannelCategory.ELECTRICAL_POWER,
				ChannelCategory.TEMPERATURE,
				ChannelCategory.HUMIDITY,
			];
			const domains = [
				HomeAssistantDomain.LIGHT,
				HomeAssistantDomain.SENSOR,
				HomeAssistantDomain.SENSOR,
				HomeAssistantDomain.SENSOR,
			];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.LIGHTING);
		});

		it('should return SENSOR for sensor-only device', () => {
			const channels = [ChannelCategory.TEMPERATURE, ChannelCategory.HUMIDITY];
			const domains = [HomeAssistantDomain.SENSOR, HomeAssistantDomain.SENSOR];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.SENSOR);
		});

		it('should return THERMOSTAT for climate device with sensors', () => {
			const channels = [ChannelCategory.THERMOSTAT, ChannelCategory.TEMPERATURE];
			const domains = [HomeAssistantDomain.CLIMATE, HomeAssistantDomain.SENSOR];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.THERMOSTAT);
		});

		it('should return OUTLET for outlet device with power sensors', () => {
			// Note: The first SWITCH rule in the rules array is for outlet (higher priority)
			// so the function finds outlet rule first
			const channels = [ChannelCategory.OUTLET, ChannelCategory.ELECTRICAL_POWER];
			const domains = [HomeAssistantDomain.SWITCH, HomeAssistantDomain.SENSOR];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.OUTLET);
		});

		it('should return FAN for fan device with temperature sensor', () => {
			const channels = [ChannelCategory.FAN, ChannelCategory.TEMPERATURE];
			const domains = [HomeAssistantDomain.FAN, HomeAssistantDomain.SENSOR];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.FAN);
		});

		it('should use fallback scoring when no domains provided', () => {
			// Test backward compatibility - when domains are not provided
			const channels = [ChannelCategory.LIGHT, ChannelCategory.TEMPERATURE];

			const category = inferDeviceCategory(channels);

			// Should use priority-based scoring fallback
			expect(category).toBe(DeviceCategory.LIGHTING);
		});

		it('should return SWITCHER for generic switch with SWITCHER channel', () => {
			// A generic switch (no device_class) maps to SWITCHER channel
			// It should NOT incorrectly return OUTLET just because that's the first SWITCH rule
			const channels = [ChannelCategory.SWITCHER];
			const domains = [HomeAssistantDomain.SWITCH];

			const category = inferDeviceCategory(channels, domains);

			// SWITCHER channel with SWITCH domain should return SWITCHER (not OUTLET)
			// because the matching rule for SWITCHER has device_category_hint: SWITCHER
			expect(category).toBe(DeviceCategory.SWITCHER);
		});

		it('should match device category based on mapped channels, not first rule for domain', () => {
			// A door cover should get DOOR (door rule's hint), not WINDOW_COVERING (first cover rule)
			const channels = [ChannelCategory.DOOR];
			const domains = [HomeAssistantDomain.COVER];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.DOOR);
		});

		it('should return TELEVISION for media player with TELEVISION channel', () => {
			// A TV media player should get TELEVISION, not SPEAKER (first media_player rule)
			const channels = [ChannelCategory.TELEVISION];
			const domains = [HomeAssistantDomain.MEDIA_PLAYER];

			const category = inferDeviceCategory(channels, domains);

			expect(category).toBe(DeviceCategory.TELEVISION);
		});
	});
});
