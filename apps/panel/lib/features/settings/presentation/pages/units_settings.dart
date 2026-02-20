import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_two_column_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/system/models/system.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class UnitsSettingsPage extends StatefulWidget {
	const UnitsSettingsPage({super.key});

	@override
	State<UnitsSettingsPage> createState() => _UnitsSettingsPageState();
}

class _UnitsSettingsPageState extends State<UnitsSettingsPage> {
	final ConfigModuleService _configModule = locator<ConfigModuleService>();
	late final ModuleConfigRepository<SystemConfigModel> _repository =
			_configModule.getModuleRepository<SystemConfigModel>('system-module');

	TemperatureUnit _temperatureUnit = TemperatureUnit.celsius;
	WindSpeedUnit _windSpeedUnit = WindSpeedUnit.metersPerSecond;
	PressureUnit _pressureUnit = PressureUnit.hectopascal;
	PrecipitationUnit _precipitationUnit = PrecipitationUnit.millimeters;
	DistanceUnit _distanceUnit = DistanceUnit.kilometers;

	@override
	void initState() {
		super.initState();

		_syncStateWithRepository();

		// If repository data is null, fetch it
		if (_repository.data == null) {
			_repository.fetchConfiguration().then((_) {
				_syncStateWithRepository();
			}).catchError((_) {
				// Error fetching configuration - will be handled by UI state
			});
		}

		_repository.addListener(_syncStateWithRepository);
	}

	@override
	void dispose() {
		super.dispose();

		_repository.removeListener(_syncStateWithRepository);
	}

	void _syncStateWithRepository() {
		final config = _repository.data;
		if (config != null) {
			setState(() {
				_temperatureUnit = config.temperatureUnit;
				_windSpeedUnit = config.windSpeedUnit;
				_pressureUnit = config.pressureUnit;
				_precipitationUnit = config.precipitationUnit;
				_distanceUnit = config.distanceUnit;
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

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

		final cards = <Widget>[
			SettingsCard(
				icon: Icons.thermostat_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_units_settings_temperature_title,
				description: localizations.settings_units_settings_temperature_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_units_settings_temperature_title,
							currentValue: _temperatureUnit.value,
							options: temperatureLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handleTemperatureUnitChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: temperatureLabels[_temperatureUnit.value] ?? _temperatureUnit.value,
					),
				),
			),
			SettingsCard(
				icon: Icons.air,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_units_settings_wind_speed_title,
				description: localizations.settings_units_settings_wind_speed_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_units_settings_wind_speed_title,
							currentValue: _windSpeedUnit.value,
							options: windSpeedLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handleWindSpeedUnitChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: windSpeedLabels[_windSpeedUnit.value] ?? _windSpeedUnit.value,
					),
				),
			),
			SettingsCard(
				icon: Icons.speed,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_units_settings_pressure_title,
				description: localizations.settings_units_settings_pressure_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_units_settings_pressure_title,
							currentValue: _pressureUnit.value,
							options: pressureLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handlePressureUnitChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: pressureLabels[_pressureUnit.value] ?? _pressureUnit.value,
					),
				),
			),
			SettingsCard(
				icon: Icons.water_drop_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_units_settings_precipitation_title,
				description: localizations.settings_units_settings_precipitation_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_units_settings_precipitation_title,
							currentValue: _precipitationUnit.value,
							options: precipitationLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handlePrecipitationUnitChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: precipitationLabels[_precipitationUnit.value] ?? _precipitationUnit.value,
					),
				),
			),
			SettingsCard(
				icon: Icons.straighten,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_units_settings_distance_title,
				description: localizations.settings_units_settings_distance_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_units_settings_distance_title,
							currentValue: _distanceUnit.value,
							options: distanceLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handleDistanceUnitChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: distanceLabels[_distanceUnit.value] ?? _distanceUnit.value,
					),
				),
			),
		];

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			body: Column(
				children: [
					PageHeader(
						title: localizations.settings_units_settings_title,
						leading: HeaderIconButton(
							icon: Icons.arrow_back,
							onTap: () => Navigator.of(context).pop(),
						),
					),
					Expanded(
						child: isLandscape
								? SingleChildScrollView(
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
										child: SettingsTwoColumnLayout(cards: cards),
									)
								: ListView(
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
										children: [
											for (int i = 0; i < cards.length; i++) ...[
												cards[i],
												if (i < cards.length - 1) SizedBox(height: AppSpacings.pMd),
											],
										],
									),
					),
				],
			),
		);
	}

	Future<void> _handleTemperatureUnitChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final unit = TemperatureUnit.fromValue(value);

		if (unit == null) return;

		HapticFeedback.lightImpact();

		final TemperatureUnit backup = _temperatureUnit;

		setState(() {
			_temperatureUnit = unit;
		});

		final success = await _updateUnit('temperature_unit', value);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_temperatureUnit = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<void> _handleWindSpeedUnitChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final unit = WindSpeedUnit.fromValue(value);

		if (unit == null) return;

		HapticFeedback.lightImpact();

		final WindSpeedUnit backup = _windSpeedUnit;

		setState(() {
			_windSpeedUnit = unit;
		});

		final success = await _updateUnit('wind_speed_unit', value);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_windSpeedUnit = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<void> _handlePressureUnitChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final unit = PressureUnit.fromValue(value);

		if (unit == null) return;

		HapticFeedback.lightImpact();

		final PressureUnit backup = _pressureUnit;

		setState(() {
			_pressureUnit = unit;
		});

		final success = await _updateUnit('pressure_unit', value);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_pressureUnit = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<void> _handlePrecipitationUnitChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final unit = PrecipitationUnit.fromValue(value);

		if (unit == null) return;

		HapticFeedback.lightImpact();

		final PrecipitationUnit backup = _precipitationUnit;

		setState(() {
			_precipitationUnit = unit;
		});

		final success = await _updateUnit('precipitation_unit', value);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_precipitationUnit = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<void> _handleDistanceUnitChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final unit = DistanceUnit.fromValue(value);

		if (unit == null) return;

		HapticFeedback.lightImpact();

		final DistanceUnit backup = _distanceUnit;

		setState(() {
			_distanceUnit = unit;
		});

		final success = await _updateUnit('distance_unit', value);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_distanceUnit = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<bool> _updateUnit(String unitKey, String value) async {
		var current = _repository.data;
		if (current == null) {
			try {
				await _repository.fetchConfiguration();
				current = _repository.data;
				if (current == null) {
					return false;
				}
			} catch (e) {
				return false;
			}
		}

		final updateData = <String, dynamic>{
			'type': 'system-module',
			'language': current.language.value,
			'timezone': current.timezone,
			'time_format': current.timeFormat.value,
			'temperature_unit': current.temperatureUnit.value,
			'wind_speed_unit': current.windSpeedUnit.value,
			'pressure_unit': current.pressureUnit.value,
			'precipitation_unit': current.precipitationUnit.value,
			'distance_unit': current.distanceUnit.value,
		};

		// Override the specific unit being changed
		updateData[unitKey] = value;

		try {
			return await _repository.updateConfiguration(updateData);
		} catch (e) {
			return false;
		}
	}
}
