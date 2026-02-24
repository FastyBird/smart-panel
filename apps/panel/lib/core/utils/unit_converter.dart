import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/system/models/system.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

export 'package:fastybird_smart_panel/modules/system/types/configuration.dart'
    show TemperatureUnit, WindSpeedUnit, PressureUnit, PrecipitationUnit, DistanceUnit;

/// Resolved display units combining display-level overrides with system defaults.
class DisplayUnits {
	final TemperatureUnit temperature;
	final WindSpeedUnit windSpeed;
	final PressureUnit pressure;
	final PrecipitationUnit precipitation;
	final DistanceUnit distance;

	const DisplayUnits({
		required this.temperature,
		required this.windSpeed,
		required this.pressure,
		required this.precipitation,
		required this.distance,
	});

	/// Resolves display units from the display repository and system config.
	factory DisplayUnits.resolve({
		required DisplayRepository displayRepository,
		required SystemConfigModel? systemConfig,
	}) {
		return DisplayUnits(
			temperature: displayRepository.temperatureUnit ??
				systemConfig?.temperatureUnit ??
				TemperatureUnit.celsius,
			windSpeed: displayRepository.windSpeedUnit ??
				systemConfig?.windSpeedUnit ??
				WindSpeedUnit.metersPerSecond,
			pressure: displayRepository.pressureUnit ??
				systemConfig?.pressureUnit ??
				PressureUnit.hectopascal,
			precipitation: displayRepository.precipitationUnit ??
				systemConfig?.precipitationUnit ??
				PrecipitationUnit.millimeters,
			distance: displayRepository.distanceUnit ??
				systemConfig?.distanceUnit ??
				DistanceUnit.kilometers,
		);
	}

	/// Convenience factory using locator to resolve dependencies.
	factory DisplayUnits.fromLocator() {
		final displayRepository = locator<DisplayRepository>();
		final configModule = locator<ConfigModuleService>();
		SystemConfigModel? systemConfig;
		try {
			final repo = configModule.getModuleRepository<SystemConfigModel>('system-module');
			systemConfig = repo.data;
		} catch (_) {
			// System config not yet available
		}
		return DisplayUnits.resolve(
			displayRepository: displayRepository,
			systemConfig: systemConfig,
		);
	}
}

/// Unit conversion utilities for display purposes.
///
/// All source values are expected to be in metric/SI units (the system's
/// internal representation): Celsius, m/s, hPa, mm, km.
class UnitConverter {
	UnitConverter._();

	// ===========================================================================
	// Temperature
	// ===========================================================================

	/// Converts a temperature value from Celsius to the target unit.
	static double convertTemperature(double celsius, TemperatureUnit to) {
		switch (to) {
			case TemperatureUnit.celsius:
				return celsius;
			case TemperatureUnit.fahrenheit:
				return celsius * 9 / 5 + 32;
		}
	}

	/// Converts a temperature value from the given unit back to Celsius.
	static double temperatureToCelsius(double value, TemperatureUnit from) {
		switch (from) {
			case TemperatureUnit.celsius:
				return value;
			case TemperatureUnit.fahrenheit:
				return (value - 32) * 5 / 9;
		}
	}

	/// Converts a display-unit temperature value back to Celsius, rounding
	/// to the display-unit step grid (1°F or 0.5°C) first.
	static double displayToCelsius(double displayValue, TemperatureUnit from) {
		if (from == TemperatureUnit.fahrenheit) {
			return temperatureToCelsius(displayValue.roundToDouble(), from);
		}
		return (displayValue * 2).round() / 2;
	}

	/// Computes dial-ready temperature parameters snapped to the step grid.
	///
	/// Returns a record with [value], [min], [max], and [step] suitable for
	/// passing directly to [CircularControlDial]. All inputs are in Celsius;
	/// the returned values are in the display unit.
	static ({double value, double min, double max, double step}) dialTemperatureRange({
		required double celsiusValue,
		required double celsiusMin,
		required double celsiusMax,
		required TemperatureUnit unit,
	}) {
		final step = unit == TemperatureUnit.fahrenheit ? 1.0 : 0.5;
		final rawMin = (convertTemperature(celsiusMin, unit) / step).roundToDouble() * step;
		final rawMax = (convertTemperature(celsiusMax, unit) / step).roundToDouble() * step;
		final max = rawMax <= rawMin ? rawMin + step : rawMax;
		final value = (convertTemperature(celsiusValue, unit) / step).roundToDouble() * step;
		return (value: value.clamp(rawMin, max), min: rawMin, max: max, step: step);
	}

	/// Returns the display symbol for a temperature unit.
	static String temperatureSymbol(TemperatureUnit unit) {
		switch (unit) {
			case TemperatureUnit.celsius:
				return '°C';
			case TemperatureUnit.fahrenheit:
				return '°F';
		}
	}

	/// Returns a short degree symbol for a temperature unit.
	static String temperatureDegreeSymbol(TemperatureUnit unit) {
		switch (unit) {
			case TemperatureUnit.celsius:
				return '°';
			case TemperatureUnit.fahrenheit:
				return '°';
		}
	}

	// ===========================================================================
	// Wind speed
	// ===========================================================================

	/// Converts wind speed from m/s to the target unit.
	static double convertWindSpeed(double ms, WindSpeedUnit to) {
		switch (to) {
			case WindSpeedUnit.metersPerSecond:
				return ms;
			case WindSpeedUnit.kilometersPerHour:
				return ms * 3.6;
			case WindSpeedUnit.milesPerHour:
				return ms * 2.23694;
			case WindSpeedUnit.knots:
				return ms * 1.94384;
		}
	}

	/// Returns the display symbol for a wind speed unit.
	static String windSpeedSymbol(WindSpeedUnit unit) {
		switch (unit) {
			case WindSpeedUnit.metersPerSecond:
				return 'm/s';
			case WindSpeedUnit.kilometersPerHour:
				return 'km/h';
			case WindSpeedUnit.milesPerHour:
				return 'mph';
			case WindSpeedUnit.knots:
				return 'kn';
		}
	}

	// ===========================================================================
	// Pressure
	// ===========================================================================

	/// Converts pressure from hPa to the target unit.
	static double convertPressure(double hpa, PressureUnit to) {
		switch (to) {
			case PressureUnit.hectopascal:
				return hpa;
			case PressureUnit.millibar:
				return hpa; // 1 hPa = 1 mbar
			case PressureUnit.inchesOfMercury:
				return hpa * 0.02953;
			case PressureUnit.millimetersOfMercury:
				return hpa * 0.750062;
		}
	}

	/// Returns the display symbol for a pressure unit.
	static String pressureSymbol(PressureUnit unit) {
		switch (unit) {
			case PressureUnit.hectopascal:
				return 'hPa';
			case PressureUnit.millibar:
				return 'mbar';
			case PressureUnit.inchesOfMercury:
				return 'inHg';
			case PressureUnit.millimetersOfMercury:
				return 'mmHg';
		}
	}

	/// Returns the number of decimal places appropriate for the pressure unit.
	static int pressureDecimals(PressureUnit unit) {
		switch (unit) {
			case PressureUnit.hectopascal:
			case PressureUnit.millibar:
				return 0;
			case PressureUnit.inchesOfMercury:
				return 2;
			case PressureUnit.millimetersOfMercury:
				return 1;
		}
	}

	// ===========================================================================
	// Precipitation
	// ===========================================================================

	/// Converts precipitation from mm to the target unit.
	static double convertPrecipitation(double mm, PrecipitationUnit to) {
		switch (to) {
			case PrecipitationUnit.millimeters:
				return mm;
			case PrecipitationUnit.inches:
				return mm * 0.0393701;
		}
	}

	/// Returns the display symbol for a precipitation unit.
	static String precipitationSymbol(PrecipitationUnit unit) {
		switch (unit) {
			case PrecipitationUnit.millimeters:
				return 'mm';
			case PrecipitationUnit.inches:
				return 'in';
		}
	}

	// ===========================================================================
	// Distance
	// ===========================================================================

	/// Converts distance from km to the target unit.
	static double convertDistance(double km, DistanceUnit to) {
		switch (to) {
			case DistanceUnit.kilometers:
				return km;
			case DistanceUnit.miles:
				return km * 0.621371;
			case DistanceUnit.meters:
				return km * 1000;
			case DistanceUnit.feet:
				return km * 3280.84;
		}
	}

	/// Returns the display symbol for a distance unit.
	static String distanceSymbol(DistanceUnit unit) {
		switch (unit) {
			case DistanceUnit.kilometers:
				return 'km';
			case DistanceUnit.miles:
				return 'mi';
			case DistanceUnit.meters:
				return 'm';
			case DistanceUnit.feet:
				return 'ft';
		}
	}
}
