import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for sensor devices (temperature, humidity, motion, etc.)
 * Generates realistic sensor readings based on environmental conditions.
 */
export class SensorSimulator extends BaseDeviceSimulator {
	// Indoor temperature offset from outdoor (buildings are climate controlled)
	private static readonly INDOOR_TEMP_OFFSET = 18; // Target ~20-22°C indoor

	// Track raw battery values per device to accumulate small decreases without rounding loss
	private rawBatteryValues: Map<string, number> = new Map();

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.SENSOR;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Temperature sensor simulation
		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			values.push(...this.simulateTemperature(context, previousValues));
		}

		// Humidity sensor simulation
		if (this.hasChannel(device, ChannelCategory.HUMIDITY)) {
			values.push(...this.simulateHumidity(context, previousValues));
		}

		// Motion sensor simulation
		if (this.hasChannel(device, ChannelCategory.MOTION)) {
			values.push(...this.simulateMotion(context));
		}

		// Illuminance sensor simulation
		if (this.hasChannel(device, ChannelCategory.ILLUMINANCE)) {
			values.push(...this.simulateIlluminance(context));
		}

		// Pressure sensor simulation
		if (this.hasChannel(device, ChannelCategory.PRESSURE)) {
			values.push(...this.simulatePressure(context, previousValues));
		}

		// Contact sensor simulation
		if (this.hasChannel(device, ChannelCategory.CONTACT)) {
			values.push(...this.simulateContact(context));
		}

		// Leak sensor simulation
		if (this.hasChannel(device, ChannelCategory.LEAK)) {
			values.push(...this.simulateLeak());
		}

		// Smoke sensor simulation
		if (this.hasChannel(device, ChannelCategory.SMOKE)) {
			values.push(...this.simulateSmoke());
		}

		// Carbon monoxide sensor simulation
		if (this.hasChannel(device, ChannelCategory.CARBON_MONOXIDE)) {
			values.push(...this.simulateCarbonMonoxide());
		}

		// Carbon dioxide sensor simulation
		if (this.hasChannel(device, ChannelCategory.CARBON_DIOXIDE)) {
			values.push(...this.simulateCarbonDioxide(context, previousValues));
		}

		// Air quality sensor simulation
		if (this.hasChannel(device, ChannelCategory.AIR_QUALITY)) {
			values.push(...this.simulateAirQuality(context, previousValues));
		}

		// Battery channel (common for sensors)
		if (this.hasChannel(device, ChannelCategory.BATTERY)) {
			values.push(...this.simulateBattery(device.id, previousValues));
		}

		return values;
	}

	/**
	 * Simulate indoor temperature based on outdoor conditions
	 */
	private simulateTemperature(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Indoor temperature is relatively stable, influenced slightly by outdoor temp
		const outdoorInfluence = 0.1; // 10% influence from outdoor
		const baseIndoor = 21; // Target indoor temp

		// Calculate target indoor temp (slightly influenced by outdoor)
		const targetTemp = baseIndoor + (context.outdoorTemperature - baseIndoor) * outdoorInfluence;

		// Get previous value for smooth transition
		const prevTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.MEASURED,
			targetTemp,
		) as number;

		// Smooth transition with small noise
		const currentTemp = this.smoothTransition(prevTemp, targetTemp, 0.3);
		const finalTemp = this.addNoise(currentTemp, 0.4, 1);

		return [
			{
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(finalTemp, -40, 80),
			},
		];
	}

	/**
	 * Simulate indoor humidity
	 */
	private simulateHumidity(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Indoor humidity target ranges
		const targetHumidity = {
			winter: 35, // Lower in winter (heating dries air)
			spring: 45,
			summer: 55,
			autumn: 50,
		};

		const target = targetHumidity[context.season];

		// Get previous value for smooth transition
		const prevHumidity = this.getPreviousValue(
			previousValues,
			ChannelCategory.HUMIDITY,
			PropertyCategory.MEASURED,
			target,
		) as number;

		// Smooth transition with noise
		const currentHumidity = this.smoothTransition(prevHumidity, target, 2);
		const finalHumidity = this.addNoise(currentHumidity, 3, 0);

		return [
			{
				channelCategory: ChannelCategory.HUMIDITY,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(Math.round(finalHumidity), 0, 100),
			},
		];
	}

	/**
	 * Simulate motion detection
	 */
	private simulateMotion(context: SimulationContext): SimulatedPropertyValue[] {
		// Motion probability based on time of day
		// Higher during active hours (7am-11pm), very low at night
		let motionProbability: number;
		if (context.hour >= 7 && context.hour <= 9) {
			motionProbability = 0.8; // Morning rush
		} else if (context.hour >= 17 && context.hour <= 21) {
			motionProbability = 0.7; // Evening activity
		} else if (context.hour >= 10 && context.hour <= 16) {
			motionProbability = 0.4; // Daytime
		} else if (context.hour >= 22 || context.hour <= 6) {
			motionProbability = 0.05; // Night time
		} else {
			motionProbability = 0.3;
		}

		const detected = Math.random() < motionProbability;

		return [
			{
				channelCategory: ChannelCategory.MOTION,
				propertyCategory: PropertyCategory.DETECTED,
				value: detected,
			},
		];
	}

	/**
	 * Simulate illuminance (light level)
	 */
	private simulateIlluminance(context: SimulationContext): SimulatedPropertyValue[] {
		let lux: number;

		if (context.isNight) {
			// Night time - artificial lighting or darkness
			const hasLights = Math.random() > 0.3;
			lux = hasLights ? this.addNoise(300, 100, 0) : this.addNoise(5, 3, 0);
		} else {
			// Daytime - varies based on time
			const peakHour = 12;
			const hourDiff = Math.abs(context.hour - peakHour);
			const dayLightFactor = 1 - hourDiff / 12;

			// Peak daylight ~10000 lux, morning/evening ~1000 lux
			lux = 1000 + dayLightFactor * 9000;
			lux = this.addNoise(lux, lux * 0.2, 0);
		}

		return [
			{
				channelCategory: ChannelCategory.ILLUMINANCE,
				propertyCategory: PropertyCategory.MEASURED,
				value: Math.max(0, Math.round(lux)),
			},
		];
	}

	/**
	 * Simulate atmospheric pressure
	 */
	private simulatePressure(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Normal atmospheric pressure: 1013 hPa (mbar)
		// Range: typically 980-1040 hPa
		const basePressure = 1013;

		// Seasonal variation
		const seasonalOffset = {
			winter: 5, // Higher pressure in winter
			spring: -2,
			summer: -5, // Lower in summer
			autumn: 0,
		};

		const target = basePressure + seasonalOffset[context.season];

		const prevPressure = this.getPreviousValue(
			previousValues,
			ChannelCategory.PRESSURE,
			PropertyCategory.MEASURED,
			target,
		) as number;

		// Pressure changes slowly
		const currentPressure = this.smoothTransition(prevPressure, target, 1);
		const finalPressure = this.addNoise(currentPressure, 3, 1);

		return [
			{
				channelCategory: ChannelCategory.PRESSURE,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(finalPressure, 900, 1100),
			},
		];
	}

	/**
	 * Simulate contact sensor (door/window open/closed)
	 */
	private simulateContact(context: SimulationContext): SimulatedPropertyValue[] {
		// Most of the time closed, occasionally opens
		// Higher chance of being open during active hours
		let openProbability: number;
		if (context.hour >= 8 && context.hour <= 20) {
			openProbability = 0.1; // 10% chance open during day
		} else {
			openProbability = 0.02; // 2% at night
		}

		// For contact sensors, detected=true usually means "contact" (closed)
		const isClosed = Math.random() >= openProbability;

		return [
			{
				channelCategory: ChannelCategory.CONTACT,
				propertyCategory: PropertyCategory.DETECTED,
				value: isClosed,
			},
		];
	}

	/**
	 * Simulate leak sensor
	 */
	private simulateLeak(): SimulatedPropertyValue[] {
		// Leaks are rare events (0.1% probability)
		const leakDetected = Math.random() < 0.001;

		return [
			{
				channelCategory: ChannelCategory.LEAK,
				propertyCategory: PropertyCategory.DETECTED,
				value: leakDetected,
			},
		];
	}

	/**
	 * Simulate smoke detector
	 */
	private simulateSmoke(): SimulatedPropertyValue[] {
		// Smoke is very rare (0.05% probability)
		const smokeDetected = Math.random() < 0.0005;

		return [
			{
				channelCategory: ChannelCategory.SMOKE,
				propertyCategory: PropertyCategory.DETECTED,
				value: smokeDetected,
			},
		];
	}

	/**
	 * Simulate carbon monoxide detector
	 */
	private simulateCarbonMonoxide(): SimulatedPropertyValue[] {
		// CO should normally be very low (0-9 ppm is normal)
		// Rarely above threshold
		const isNormal = Math.random() > 0.001;
		const density = isNormal ? this.addNoise(2, 3, 0) : this.addNoise(50, 20, 0);

		return [
			{
				channelCategory: ChannelCategory.CARBON_MONOXIDE,
				propertyCategory: PropertyCategory.DENSITY,
				value: Math.max(0, Math.round(density)),
			},
			{
				channelCategory: ChannelCategory.CARBON_MONOXIDE,
				propertyCategory: PropertyCategory.DETECTED,
				value: density > 35, // Alarm threshold
			},
		];
	}

	/**
	 * Simulate CO2 levels
	 */
	private simulateCarbonDioxide(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Normal outdoor: ~400 ppm
		// Indoor with people: 600-1000 ppm
		// Crowded/poor ventilation: 1000-2000 ppm

		// Higher during occupied hours
		let targetCO2: number;
		if (context.hour >= 9 && context.hour <= 17) {
			targetCO2 = 800; // Work hours, people present
		} else if (context.hour >= 18 && context.hour <= 22) {
			targetCO2 = 700; // Evening
		} else {
			targetCO2 = 500; // Night, less occupancy
		}

		const prevCO2 = this.getPreviousValue(
			previousValues,
			ChannelCategory.CARBON_DIOXIDE,
			PropertyCategory.DENSITY,
			targetCO2,
		) as number;

		const currentCO2 = this.smoothTransition(prevCO2, targetCO2, 20);
		const finalCO2 = this.addNoise(currentCO2, 50, 0);

		return [
			{
				channelCategory: ChannelCategory.CARBON_DIOXIDE,
				propertyCategory: PropertyCategory.DENSITY,
				value: this.clamp(Math.round(finalCO2), 350, 5000),
			},
		];
	}

	/**
	 * Simulate air quality index
	 */
	private simulateAirQuality(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// AQI typically 0-500
		// Good: 0-50, Moderate: 51-100, Unhealthy for sensitive: 101-150
		// Usually indoor AQI is better than outdoor

		// Base AQI varies by season (more pollution in winter due to heating)
		const baseAQI = {
			winter: 55,
			spring: 35,
			summer: 45, // Can be higher due to ozone
			autumn: 40,
		};

		const targetAQI = baseAQI[context.season];

		const prevAQI = this.getPreviousValue(
			previousValues,
			ChannelCategory.AIR_QUALITY,
			PropertyCategory.AQI,
			targetAQI,
		) as number;

		const currentAQI = this.smoothTransition(prevAQI, targetAQI, 5);
		const finalAQI = this.addNoise(currentAQI, 15, 0);

		return [
			{
				channelCategory: ChannelCategory.AIR_QUALITY,
				propertyCategory: PropertyCategory.AQI,
				value: this.clamp(Math.round(finalAQI), 0, 500),
			},
		];
	}

	/**
	 * Simulate battery level (slowly decreasing)
	 * Uses internal raw value tracking to accumulate small decreases without rounding loss.
	 */
	private simulateBattery(
		deviceId: string,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Get raw battery value (unrounded) from internal tracking, or initialize from previousValues
		let rawBattery = this.rawBatteryValues.get(deviceId);
		if (rawBattery === undefined) {
			// Initialize from stored value (which is rounded) or default to 100
			rawBattery = this.getPreviousValue(
				previousValues,
				ChannelCategory.BATTERY,
				PropertyCategory.PERCENTAGE,
				100,
			) as number;
		}

		// Battery decreases slowly (0.01-0.05% per update cycle)
		const decrease = Math.random() * 0.04 + 0.01;
		rawBattery -= decrease;

		// Reset if too low (simulating battery replacement)
		if (rawBattery < 10) {
			rawBattery = 100;
		}

		// Store the raw (unrounded) value for next cycle
		this.rawBatteryValues.set(deviceId, rawBattery);

		return [
			{
				channelCategory: ChannelCategory.BATTERY,
				propertyCategory: PropertyCategory.PERCENTAGE,
				value: Math.round(rawBattery),
			},
		];
	}
}
