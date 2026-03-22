import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_celestial_elements.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_clouds_layer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_content_overlay.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_gradient_background.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_weather_overlays.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_overview_model_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Main sky panel widget that shows weather-aware gradients, celestial elements,
/// weather particles, clock, and scene pills.
///
/// Owns its own [WeatherService] listener and clock [Timer].
class SkyPanel extends StatefulWidget {
	final String roomName;
	final bool isPortrait;
	final bool isCompact;
	final List<QuickScene> scenes;
	final bool isSceneTriggering;
	final String? triggeringSceneId;
	final ValueChanged<String>? onSceneTap;
	final VoidCallback? onWeatherTap;

	const SkyPanel({
		super.key,
		required this.roomName,
		required this.isPortrait,
		this.isCompact = false,
		this.scenes = const [],
		this.isSceneTriggering = false,
		this.triggeringSceneId,
		this.onSceneTap,
		this.onWeatherTap,
	});

	@override
	State<SkyPanel> createState() => _SkyPanelState();
}

class _SkyPanelState extends State<SkyPanel> {
	WeatherService? _weatherService;
	DisplayRepository? _displayRepository;
	Timer? _clockTimer;
	DateTime _now = DateTime.now();

	SkyVisualConfig _config = SkyVisualConfig.defaultSky();
	String? _temperature;
	String? _weatherDescription;
	IconData? _weatherIcon;

	@override
	void initState() {
		super.initState();

		try {
			_weatherService = locator<WeatherService>();
			_weatherService?.addListener(_onWeatherChanged);
		} catch (_) {
			// Weather module not available
		}

		try {
			_displayRepository = locator<DisplayRepository>();
			_displayRepository?.addListener(_onWeatherChanged);
		} catch (_) {
			// Display module not available
		}

		_updateFromWeather();
		_startClock();
	}

	@override
	void dispose() {
		_weatherService?.removeListener(_onWeatherChanged);
		_displayRepository?.removeListener(_onWeatherChanged);
		_clockTimer?.cancel();
		super.dispose();
	}

	void _startClock() {
		_clockTimer = Timer.periodic(const Duration(seconds: 30), (_) {
			if (mounted) {
				setState(() {
					_now = DateTime.now();
				});
				_updateFromWeather();
			}
		});
	}

	void _onWeatherChanged() {
		if (mounted) {
			_updateFromWeather();
		}
	}

	void _updateFromWeather() {
		final locationId = _displayRepository?.weatherLocationId;
		final currentDay = _weatherService?.getCurrentDayByLocation(locationId);
		_now = DateTime.now();

		if (currentDay != null) {
			final weatherCode = currentDay.weatherCode;
			final sunrise = currentDay.sunrise;
			final sunset = currentDay.sunset;
			final condition = mapWeatherCodeToSkyCondition(weatherCode);
			final timeOfDay = resolveSkyTimeOfDay(_now, sunrise, sunset);

			final temp = NumberUtils.formatDecimal(
				currentDay.temperature,
				decimalPlaces: 0,
			);

			setState(() {
				_config = SkyVisualConfig.fromCondition(condition, timeOfDay);
				_temperature = '$temp\u00B0';
				_weatherDescription = currentDay.weatherModel.weather.description;
				_weatherIcon = WeatherConditionMapper.getIcon(weatherCode, _config.isNight);
			});
		} else {
			// Fallback: use time-based 4-period resolution with clear sky
			final hour = _now.hour;
			final timeOfDay = (hour >= 6 && hour < 11)
					? SkyTimeOfDay.morning
					: (hour >= 11 && hour < 17)
							? SkyTimeOfDay.noon
							: (hour >= 17 && hour < 21)
									? SkyTimeOfDay.evening
									: SkyTimeOfDay.night;

			setState(() {
				_config = SkyVisualConfig.fromCondition(SkyCondition.clear, timeOfDay);
				_temperature = null;
				_weatherDescription = null;
				_weatherIcon = null;
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		final timeStr = DateFormat('HH:mm').format(_now);
		final dateStr = DateFormat('EEEE, d MMMM').format(_now);

		return ClipRect(
			child: Stack(
				fit: StackFit.expand,
				children: [
					SkyGradientBackground(
						gradientColors: _config.gradientColors,
						isPortrait: widget.isPortrait,
					),
					SkyCelestialElements(
						config: _config,
						isPortrait: widget.isPortrait,
					),
					SkyCloudsLayer(
						config: _config,
						isPortrait: widget.isPortrait,
					),
					SkyWeatherOverlays(config: _config),
					Positioned.fill(
						child: SkyContentOverlay(
							isPortrait: widget.isPortrait,
							isDark: _config.isDark,
							isCompact: widget.isCompact,
							roomName: widget.roomName,
							time: timeStr,
							date: dateStr,
							temperature: _temperature,
							weatherDescription: _weatherDescription,
							weatherIcon: _weatherIcon,
							primaryTextColor: _config.primaryTextColor,
							secondaryTextColor: _config.secondaryTextColor,
							scenes: widget.isPortrait ? [] : widget.scenes,
							isSceneTriggering: widget.isSceneTriggering,
							triggeringSceneId: widget.triggeringSceneId,
							onSceneTap: widget.onSceneTap,
							onWeatherTap: widget.onWeatherTap,
						),
					),
				],
			),
		);
	}
}
