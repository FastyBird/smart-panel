import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/local_preferences.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class DisplaySettingsPage extends StatefulWidget {
	const DisplaySettingsPage({super.key});

	@override
	State<DisplaySettingsPage> createState() => _DisplaySettingsPageState();
}

class _DisplaySettingsPageState extends State<DisplaySettingsPage> {
	final DisplayRepository _repository = locator<DisplayRepository>();
	final LocalPreferencesService _localPrefs = locator<LocalPreferencesService>();

	late bool _isDarkMode;

	late int _brightness;
	late int? _brightnessBackup;
	late bool _savingBrightness = false;

	late int _screenLockDuration;

	late bool _hasScreenSaver;

	late bool _screenPowerOff;

	// Unit override state (null = system default)
	TemperatureUnit? _temperatureUnit;
	WindSpeedUnit? _windSpeedUnit;
	PressureUnit? _pressureUnit;
	PrecipitationUnit? _precipitationUnit;
	DistanceUnit? _distanceUnit;

	Timer? _debounce;

	@override
	void initState() {
		super.initState();

		_syncStateWithRepository();

		_repository.addListener(_syncStateWithRepository);
	}

	@override
	void dispose() {
		_debounce?.cancel();
		_repository.removeListener(_syncStateWithRepository);
		super.dispose();
	}

	void _syncStateWithRepository() {
		setState(() {
			_isDarkMode = _repository.hasDarkMode;
			_brightness = _repository.brightness;
			_screenLockDuration = _repository.screenLockDuration;
			_hasScreenSaver = _repository.hasScreenSaver;
			_screenPowerOff = _localPrefs.screenPowerOff;
			_temperatureUnit = _repository.temperatureUnit;
			_windSpeedUnit = _repository.windSpeedUnit;
			_pressureUnit = _repository.pressureUnit;
			_precipitationUnit = _repository.precipitationUnit;
			_distanceUnit = _repository.distanceUnit;
		});
	}

	static const Map<int, String> _screenLockDurationLabels = {
		15: '15s',
		30: '30s',
		60: '1min',
		120: '2min',
		300: '5min',
		600: '10min',
		1800: '30min',
		0: 'Never',
	};

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		final primaryColor = _isDarkMode ? AppColorsDark.primary : AppColorsLight.primary;
		final primaryBg = _isDarkMode ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;
		final infoColor = _isDarkMode ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = _isDarkMode ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		final systemDefaultLabel = localizations.unit_system_default;

		final temperatureLabels = {
			TemperatureUnit.celsius.value: localizations.unit_celsius,
			TemperatureUnit.fahrenheit.value: localizations.unit_fahrenheit,
		};

		final windSpeedLabels = {
			WindSpeedUnit.metersPerSecond.value: localizations.unit_wind_speed_ms,
			WindSpeedUnit.kilometersPerHour.value: localizations.unit_wind_speed_kmh,
			WindSpeedUnit.milesPerHour.value: localizations.unit_wind_speed_mph,
			WindSpeedUnit.knots.value: localizations.unit_wind_speed_knots,
		};

		final pressureLabels = {
			PressureUnit.hectopascal.value: localizations.unit_pressure_hpa,
			PressureUnit.millibar.value: localizations.unit_pressure_mbar,
			PressureUnit.inchesOfMercury.value: localizations.unit_pressure_inhg,
			PressureUnit.millimetersOfMercury.value: localizations.unit_pressure_mmhg,
		};

		final precipitationLabels = {
			PrecipitationUnit.millimeters.value: localizations.unit_precipitation_mm,
			PrecipitationUnit.inches.value: localizations.unit_precipitation_inches,
		};

		final distanceLabels = {
			DistanceUnit.kilometers.value: localizations.unit_distance_km,
			DistanceUnit.miles.value: localizations.unit_distance_miles,
			DistanceUnit.meters.value: localizations.unit_distance_meters,
			DistanceUnit.feet.value: localizations.unit_distance_feet,
		};

		// Left column cards (landscape) / top cards (portrait)
		final leftCards = <Widget>[
			// Theme Mode
			SettingsCard(
				icon: MdiIcons.weatherNight,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_theme_mode_title,
				description: localizations.settings_display_settings_theme_mode_description,
				trailing: SettingsToggle(
					value: _isDarkMode,
					onChanged: (v) => _handleDarkModeChange(context, v),
				),
			),
			// Screen Saver
			SettingsCard(
				icon: MdiIcons.monitorDashboard,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_screen_saver_title,
				description: localizations.settings_display_settings_screen_saver_description,
				trailing: SettingsToggle(
					value: _hasScreenSaver,
					onChanged: (v) => _handleScreenSaverChange(context, v),
				),
			),
			// Screen Power Off
			SettingsCard(
				icon: MdiIcons.monitorOff,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_screen_power_off_title,
				description: localizations.settings_display_settings_screen_power_off_description,
				trailing: SettingsToggle(
					value: _screenPowerOff,
					onChanged: (v) => _handleScreenPowerOffChange(v),
				),
			),
		];

		// Screen Lock card — right column on landscape
		final screenLockCard = SettingsCard(
			icon: MdiIcons.lockOutline,
			iconColor: primaryColor,
			iconBgColor: primaryBg,
			label: localizations.settings_display_settings_screen_lock_title,
			description: localizations.settings_display_settings_screen_lock_description,
			trailing: GestureDetector(
				onTap: () async {
					final result = await showSettingsSelectionDialog<int>(
						context: context,
						title: localizations.settings_display_settings_screen_lock_title,
						currentValue: _screenLockDuration,
						options: _screenLockDurationLabels.entries
								.map((e) => SelectionOption(
									value: e.key,
									label: e.key == 0 ? localizations.settings_display_screen_lock_never : e.value,
								))
								.toList(),
					);
					if (result != null && context.mounted) {
						_handleScreenLockDurationChange(context, result);
					}
				},
				child: SettingsDropdownValue(
					value: _getScreenLockLabel(_screenLockDuration, localizations),
				),
			),
		);

		// Brightness card (with slider) — placed in right column on landscape
		final brightnessCard = SettingsCard(
			icon: MdiIcons.weatherSunny,
			iconColor: primaryColor,
			iconBgColor: primaryBg,
			label: localizations.settings_display_settings_brightness_title,
			description: localizations.settings_display_settings_brightness_description,
			bottom: SettingsSlider(
				value: _brightness / 100.0,
				iconSmall: MdiIcons.weatherSunny,
				iconLarge: MdiIcons.weatherSunny,
				onChanged: (v) => _handleBrightnessChange(context, v * 100),
			),
		);

		// Sentinel value for "System default" in selection dialogs
		// (empty string distinguishes it from dialog dismissal which returns null)
		const systemDefaultValue = '';

		// Unit override cards
		final unitOverrideCards = <Widget>[
			SettingsCard(
				icon: MdiIcons.thermometer,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_display_settings_temperature_unit_title,
				description: localizations.settings_display_settings_temperature_unit_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_display_settings_temperature_unit_title,
							currentValue: _temperatureUnit?.value ?? systemDefaultValue,
							options: [
								SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
								...temperatureLabels.entries
										.map((e) => SelectionOption(value: e.key, label: e.value)),
							],
						);
						if (result != null && context.mounted) {
							_handleTemperatureUnitChange(context, result.isEmpty ? null : result);
						}
					},
					child: SettingsDropdownValue(
						value: _temperatureUnit != null
								? temperatureLabels[_temperatureUnit!.value] ?? _temperatureUnit!.value
								: systemDefaultLabel,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.weatherWindy,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_display_settings_wind_speed_unit_title,
				description: localizations.settings_display_settings_wind_speed_unit_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_display_settings_wind_speed_unit_title,
							currentValue: _windSpeedUnit?.value ?? systemDefaultValue,
							options: [
								SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
								...windSpeedLabels.entries
										.map((e) => SelectionOption(value: e.key, label: e.value)),
							],
						);
						if (result != null && context.mounted) {
							_handleWindSpeedUnitChange(context, result.isEmpty ? null : result);
						}
					},
					child: SettingsDropdownValue(
						value: _windSpeedUnit != null
								? windSpeedLabels[_windSpeedUnit!.value] ?? _windSpeedUnit!.value
								: systemDefaultLabel,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.speedometer,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_display_settings_pressure_unit_title,
				description: localizations.settings_display_settings_pressure_unit_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_display_settings_pressure_unit_title,
							currentValue: _pressureUnit?.value ?? systemDefaultValue,
							options: [
								SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
								...pressureLabels.entries
										.map((e) => SelectionOption(value: e.key, label: e.value)),
							],
						);
						if (result != null && context.mounted) {
							_handlePressureUnitChange(context, result.isEmpty ? null : result);
						}
					},
					child: SettingsDropdownValue(
						value: _pressureUnit != null
								? pressureLabels[_pressureUnit!.value] ?? _pressureUnit!.value
								: systemDefaultLabel,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.waterOutline,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_display_settings_precipitation_unit_title,
				description: localizations.settings_display_settings_precipitation_unit_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_display_settings_precipitation_unit_title,
							currentValue: _precipitationUnit?.value ?? systemDefaultValue,
							options: [
								SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
								...precipitationLabels.entries
										.map((e) => SelectionOption(value: e.key, label: e.value)),
							],
						);
						if (result != null && context.mounted) {
							_handlePrecipitationUnitChange(context, result.isEmpty ? null : result);
						}
					},
					child: SettingsDropdownValue(
						value: _precipitationUnit != null
								? precipitationLabels[_precipitationUnit!.value] ?? _precipitationUnit!.value
								: systemDefaultLabel,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.ruler,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_display_settings_distance_unit_title,
				description: localizations.settings_display_settings_distance_unit_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_display_settings_distance_unit_title,
							currentValue: _distanceUnit?.value ?? systemDefaultValue,
							options: [
								SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
								...distanceLabels.entries
										.map((e) => SelectionOption(value: e.key, label: e.value)),
							],
						);
						if (result != null && context.mounted) {
							_handleDistanceUnitChange(context, result.isEmpty ? null : result);
						}
					},
					child: SettingsDropdownValue(
						value: _distanceUnit != null
								? distanceLabels[_distanceUnit!.value] ?? _distanceUnit!.value
								: systemDefaultLabel,
					),
				),
			),
		];

		final themeData = (_isDarkMode ? AppTheme.darkTheme : AppTheme.lightTheme).copyWith(
			scaffoldBackgroundColor: _isDarkMode ? AppBgColorDark.page : AppBgColorLight.page,
		);

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				final isLandscape = locator<ScreenService>().isLandscape;

				return AnimatedTheme(
					duration: const Duration(milliseconds: 500),
					curve: Curves.easeInOut,
					data: themeData,
					child: Scaffold(
						body: Column(
							children: [
								PageHeader(
									title: localizations.settings_display_settings_title,
									leading: HeaderIconButton(
										icon: MdiIcons.arrowLeft,
										onTap: () => Navigator.of(context).pop(),
									),
								),
								Expanded(
									child: isLandscape
									? VerticalScrollWithGradient(
											itemCount: 1,
											padding: EdgeInsets.only(left: AppSpacings.pMd, right: AppSpacings.pMd, bottom: AppSpacings.pMd),
											itemBuilder: (context, index) => Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														Row(
															crossAxisAlignment: CrossAxisAlignment.start,
															children: [
																Expanded(
																	child: Column(
																		mainAxisSize: MainAxisSize.min,
																		children: [
																			for (int i = 0; i < leftCards.length; i++) ...[
																				leftCards[i],
																				if (i < leftCards.length - 1) SizedBox(height: AppSpacings.pMd),
																			],
																		],
																	),
																),
																SizedBox(width: AppSpacings.pMd),
																Expanded(
																	child: Column(
																		mainAxisSize: MainAxisSize.min,
																		children: [
																			brightnessCard,
																			SizedBox(height: AppSpacings.pMd),
																			screenLockCard,
																		],
																	),
																),
															],
														),
														SizedBox(height: AppSpacings.pLg),
														SectionTitle(
															title: localizations.settings_display_settings_unit_overrides_section,
															icon: MdiIcons.ruler,
														),
														SizedBox(height: AppSpacings.pSm),
														for (int i = 0; i < unitOverrideCards.length; i += 2) ...[
															if (i > 0) SizedBox(height: AppSpacings.pMd),
															Row(
																crossAxisAlignment: CrossAxisAlignment.start,
																children: [
																	Expanded(child: unitOverrideCards[i]),
																	SizedBox(width: AppSpacings.pMd),
																	if (i + 1 < unitOverrideCards.length)
																		Expanded(child: unitOverrideCards[i + 1])
																	else
																		const Expanded(child: SizedBox.shrink()),
																],
															),
														],
													],
												),
										)
									: VerticalScrollWithGradient(
											itemCount: 1,
											padding: EdgeInsets.only(left: AppSpacings.pMd, right: AppSpacings.pMd, bottom: AppSpacings.pMd),
											itemBuilder: (context, index) => Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														for (int i = 0; i < leftCards.length; i++) ...[
															leftCards[i],
															if (i < leftCards.length - 1) SizedBox(height: AppSpacings.pMd),
														],
														SizedBox(height: AppSpacings.pMd),
														brightnessCard,
														SizedBox(height: AppSpacings.pMd),
														screenLockCard,
														SizedBox(height: AppSpacings.pLg),
														SectionTitle(
															title: localizations.settings_display_settings_unit_overrides_section,
															icon: MdiIcons.ruler,
														),
														SizedBox(height: AppSpacings.pSm),
														for (int i = 0; i < unitOverrideCards.length; i++) ...[
															unitOverrideCards[i],
															if (i < unitOverrideCards.length - 1) SizedBox(height: AppSpacings.pMd),
														],
													],
												),
										),
								),
							],
						),
					),
				);
			},
		);
	}

	String _getScreenLockLabel(int duration, AppLocalizations localizations) {
		if (duration == 0) return localizations.settings_display_screen_lock_never;
		return _screenLockDurationLabels[duration] ?? '${duration}s';
	}

	Future<void> _handleDarkModeChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_isDarkMode = !_isDarkMode;
		});

		final success = await _repository.setDisplayDarkMode(_isDarkMode);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_isDarkMode = !_isDarkMode;
					});

					Toast.showError(context, message: AppLocalizations.of(context)!.settings_save_failed);
				}
			},
		);
	}

	Future<void> _handleBrightnessChange(
		BuildContext context,
		double value,
	) async {
		if (!_savingBrightness) {
			setState(() {
				_brightnessBackup = _brightness;
				_savingBrightness = true;
			});
		}

		setState(() {
			_brightness = value.round();
		});

		_debounce?.cancel();

		_debounce = Timer(
			const Duration(milliseconds: 500),
			() async {
				final success = await _repository.setDisplayBrightness(_brightness);

				Future.microtask(() async {
					await Future.delayed(
						const Duration(milliseconds: 500),
					);

					if (!context.mounted) return;

					if (!success) {
						setState(() {
							_brightness = _brightnessBackup ?? 0;
							_brightnessBackup = null;
							_savingBrightness = false;
						});

						Toast.showError(
							context,
							message: AppLocalizations.of(context)!.settings_save_failed,
						);
					} else {
						setState(() {
							_brightnessBackup = null;
							_savingBrightness = false;
						});
					}
				});
			},
		);
	}

	Future<void> _handleScreenLockDurationChange(
		BuildContext context,
		int? value,
	) async {
		if (value == null) return;

		HapticFeedback.lightImpact();

		final int backup = _screenLockDuration;

		setState(() {
			_screenLockDuration = value;
		});

		final success = await _repository.setDisplayScreenLockDuration(
			_screenLockDuration,
		);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_screenLockDuration = backup;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	void _handleScreenPowerOffChange(bool state) {
		HapticFeedback.lightImpact();

		setState(() {
			_screenPowerOff = !_screenPowerOff;
		});

		_localPrefs.setScreenPowerOff(_screenPowerOff);
	}

	Future<void> _handleScreenSaverChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_hasScreenSaver = !_hasScreenSaver;
		});

		final success = await _repository.setDisplayScreenSaver(_hasScreenSaver);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_hasScreenSaver = !_hasScreenSaver;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	Future<void> _handleTemperatureUnitChange(BuildContext context, String? value) async {
		final TemperatureUnit? unit = value != null ? TemperatureUnit.fromValue(value) : null;

		HapticFeedback.lightImpact();

		final TemperatureUnit? backup = _temperatureUnit;

		setState(() {
			_temperatureUnit = unit;
		});

		final success = await _repository.setTemperatureUnit(unit);

		if (!context.mounted) return;

		_revertOnFailure(context, success, () {
			_temperatureUnit = backup;
		});
	}

	Future<void> _handleWindSpeedUnitChange(BuildContext context, String? value) async {
		final WindSpeedUnit? unit = value != null ? WindSpeedUnit.fromValue(value) : null;

		HapticFeedback.lightImpact();

		final WindSpeedUnit? backup = _windSpeedUnit;

		setState(() {
			_windSpeedUnit = unit;
		});

		final success = await _repository.setWindSpeedUnit(unit);

		if (!context.mounted) return;

		_revertOnFailure(context, success, () {
			_windSpeedUnit = backup;
		});
	}

	Future<void> _handlePressureUnitChange(BuildContext context, String? value) async {
		final PressureUnit? unit = value != null ? PressureUnit.fromValue(value) : null;

		HapticFeedback.lightImpact();

		final PressureUnit? backup = _pressureUnit;

		setState(() {
			_pressureUnit = unit;
		});

		final success = await _repository.setPressureUnit(unit);

		if (!context.mounted) return;

		_revertOnFailure(context, success, () {
			_pressureUnit = backup;
		});
	}

	Future<void> _handlePrecipitationUnitChange(BuildContext context, String? value) async {
		final PrecipitationUnit? unit = value != null ? PrecipitationUnit.fromValue(value) : null;

		HapticFeedback.lightImpact();

		final PrecipitationUnit? backup = _precipitationUnit;

		setState(() {
			_precipitationUnit = unit;
		});

		final success = await _repository.setPrecipitationUnit(unit);

		if (!context.mounted) return;

		_revertOnFailure(context, success, () {
			_precipitationUnit = backup;
		});
	}

	Future<void> _handleDistanceUnitChange(BuildContext context, String? value) async {
		final DistanceUnit? unit = value != null ? DistanceUnit.fromValue(value) : null;

		HapticFeedback.lightImpact();

		final DistanceUnit? backup = _distanceUnit;

		setState(() {
			_distanceUnit = unit;
		});

		final success = await _repository.setDistanceUnit(unit);

		if (!context.mounted) return;

		_revertOnFailure(context, success, () {
			_distanceUnit = backup;
		});
	}

	void _revertOnFailure(BuildContext context, bool success, VoidCallback revert) {
		Future.microtask(
			() async {
				await Future.delayed(const Duration(milliseconds: 500));

				if (!context.mounted) return;

				if (!success) {
					setState(revert);

					Toast.showError(context, message: AppLocalizations.of(context)!.settings_save_failed);
				}
			},
		);
	}
}
