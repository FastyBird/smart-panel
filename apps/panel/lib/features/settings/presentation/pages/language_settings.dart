import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
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
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LanguageSettingsPage extends StatefulWidget {
	const LanguageSettingsPage({super.key});

	@override
	State<LanguageSettingsPage> createState() => _LanguageSettingsPageState();
}

class _LanguageSettingsPageState extends State<LanguageSettingsPage> {
	final ConfigModuleService _configModule = locator<ConfigModuleService>();
	late final ModuleConfigRepository<SystemConfigModel> _repository =
			_configModule.getModuleRepository<SystemConfigModel>('system-module');

	String? _timezone;
	Language _language = Language.english;
	TimeFormat _timeFormat = TimeFormat.twentyFourHour;
	NumberFormatSetting _numberFormat = NumberFormatSetting.commaDot;

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
		_repository.removeListener(_syncStateWithRepository);

		super.dispose();
	}

	void _syncStateWithRepository() {
		final config = _repository.data;
		if (config != null) {
			setState(() {
				_timezone = config.timezone;
				_language = config.language;
				_timeFormat = config.timeFormat;
				_numberFormat = config.numberFormat;
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		final List<String> timezones = [
			// Africa
			'Africa/Cairo',
			'Africa/Johannesburg',
			// Americas
			'America/Anchorage',
			'America/Chicago',
			'America/Denver',
			'America/Halifax',
			'America/Los_Angeles',
			'America/Mexico_City',
			'America/New_York',
			'America/Phoenix',
			'America/St_Johns',
			'America/Toronto',
			'America/Vancouver',
			// Asia
			'Asia/Dubai',
			'Asia/Kolkata',
			'Asia/Tokyo',
			// Australia
			'Australia/Sydney',
			// Europe
			'Europe/Amsterdam',
			'Europe/Athens',
			'Europe/Belgrade',
			'Europe/Berlin',
			'Europe/Bratislava',
			'Europe/Brussels',
			'Europe/Bucharest',
			'Europe/Budapest',
			'Europe/Copenhagen',
			'Europe/Dublin',
			'Europe/Helsinki',
			'Europe/Istanbul',
			'Europe/Kyiv',
			'Europe/Lisbon',
			'Europe/London',
			'Europe/Madrid',
			'Europe/Moscow',
			'Europe/Oslo',
			'Europe/Paris',
			'Europe/Prague',
			'Europe/Rome',
			'Europe/Stockholm',
			'Europe/Vienna',
			'Europe/Vilnius',
			'Europe/Warsaw',
			'Europe/Zurich',
			// Pacific
			'Pacific/Honolulu',
		];

		final languageLabels = {
			Language.english.value: 'English',
			Language.czech.value: 'Česky',
			Language.german.value: 'Deutsch',
			Language.spanish.value: 'Español',
			Language.polish.value: 'Polski',
			Language.slovak.value: 'Slovensky',
		};

		final cards = <Widget>[
			SettingsCard(
				icon: MdiIcons.translate,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_language_title,
				description: localizations.settings_language_settings_language_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_language_settings_language_title,
							currentValue: _language.value,
							options: languageLabels.entries
									.map((e) => SelectionOption(value: e.key, label: e.value))
									.toList(),
						);
						if (result != null && context.mounted) {
							_handleLanguageChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: languageLabels[_language.value] ?? _language.value,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.clockOutline,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_timezone_title,
				description: localizations.settings_language_settings_timezone_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_language_settings_timezone_title,
							currentValue: _timezone,
							options: timezones.map((tz) {
								final parts = tz.split('/');
								return SelectionOption(
									value: tz,
									label: parts.last.replaceAll('_', ' '),
									group: parts.first,
								);
							}).toList(),
						);
						if (result != null && context.mounted) {
							_handleTimeZoneChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: _formatTimezoneCity(_timezone),
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.calendarTodayOutline,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_time_format_title,
				description: localizations.settings_language_settings_time_format_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_language_settings_time_format_title,
							currentValue: _timeFormat.value,
							options: [
								SelectionOption(
									value: TimeFormat.twelveHour.value,
									label: localizations.time_format_12h,
								),
								SelectionOption(
									value: TimeFormat.twentyFourHour.value,
									label: localizations.time_format_24h,
								),
							],
						);
						if (result != null && context.mounted) {
							_handleTimeFormatChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: _timeFormat == TimeFormat.twelveHour
								? localizations.time_format_12h
								: localizations.time_format_24h,
					),
				),
			),
			SettingsCard(
				icon: MdiIcons.numeric,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_number_format_title,
				description: localizations.settings_language_settings_number_format_description,
				trailing: GestureDetector(
					onTap: () async {
						final result = await showSettingsSelectionDialog<String>(
							context: context,
							title: localizations.settings_language_settings_number_format_title,
							currentValue: _numberFormat.value,
							options: [
								SelectionOption(
									value: NumberFormatSetting.commaDot.value,
									label: localizations.number_format_comma_dot,
								),
								SelectionOption(
									value: NumberFormatSetting.dotComma.value,
									label: localizations.number_format_dot_comma,
								),
								SelectionOption(
									value: NumberFormatSetting.spaceComma.value,
									label: localizations.number_format_space_comma,
								),
								SelectionOption(
									value: NumberFormatSetting.none.value,
									label: localizations.number_format_none,
								),
							],
						);
						if (result != null && context.mounted) {
							_handleNumberFormatChange(context, result);
						}
					},
					child: SettingsDropdownValue(
						value: _getNumberFormatLabel(localizations),
					),
				),
			),
		];

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				final isLandscape = locator<ScreenService>().isLandscape;

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: Column(
						children: [
							PageHeader(
								title: localizations.settings_language_settings_title,
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
												itemBuilder: (context, index) => SettingsTwoColumnLayout(cards: cards),
											)
										: VerticalScrollWithGradient(
												itemCount: cards.length,
												separatorHeight: AppSpacings.pMd,
												padding: EdgeInsets.only(left: AppSpacings.pMd, right: AppSpacings.pMd, bottom: AppSpacings.pMd),
												itemBuilder: (context, index) => cards[index],
											),
							),
						],
					),
				);
			},
		);
	}

	String _formatTimezoneCity(String? timezone) {
		if (timezone == null) return '—';
		final parts = timezone.split('/');
		return parts.last.replaceAll('_', ' ');
	}

	Future<void> _handleLanguageChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final language = Language.fromValue(value);

		if (language == null) return;

		HapticFeedback.lightImpact();

		final Language backup = _language;

		setState(() {
			_language = language;
		});

		final success = await _updateLanguage(_language);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_language = backup;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	Future<void> _handleTimeZoneChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		HapticFeedback.lightImpact();

		final String? backup = _timezone;

		setState(() {
			_timezone = value;
		});

		final success = await _updateTimezone(_timezone);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_timezone = backup;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	Future<void> _handleTimeFormatChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final timeFormat = TimeFormat.fromValue(value);

		if (timeFormat == null) return;

		HapticFeedback.lightImpact();

		final TimeFormat backup = _timeFormat;

		setState(() {
			_timeFormat = timeFormat;
		});

		final success = await _updateTimeFormat(_timeFormat);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_timeFormat = backup;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	String _getNumberFormatLabel(AppLocalizations localizations) {
		switch (_numberFormat) {
			case NumberFormatSetting.commaDot:
				return localizations.number_format_comma_dot;
			case NumberFormatSetting.dotComma:
				return localizations.number_format_dot_comma;
			case NumberFormatSetting.spaceComma:
				return localizations.number_format_space_comma;
			case NumberFormatSetting.none:
				return localizations.number_format_none;
		}
	}

	Future<void> _handleNumberFormatChange(
		BuildContext context,
		String? value,
	) async {
		if (value == null) return;

		final format = NumberFormatSetting.fromValue(value);

		if (format == null) return;

		HapticFeedback.lightImpact();

		final NumberFormatSetting backup = _numberFormat;

		setState(() {
			_numberFormat = format;
		});

		final success = await _updateNumberFormat(_numberFormat);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_numberFormat = backup;
					});

					Toast.showError(
						context,
						message: AppLocalizations.of(context)!.settings_save_failed,
					);
				}
			},
		);
	}

	Future<bool> _updateNumberFormat(NumberFormatSetting format) async {
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
			'number_format': format.value,
		};

		try {
			return await _repository.updateConfiguration(updateData);
		} catch (e) {
			return false;
		}
	}

	Future<bool> _updateLanguage(Language language) async {
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
			'language': language.value,
			'timezone': current.timezone,
			'time_format': current.timeFormat.value,
			'number_format': current.numberFormat.value,
		};

		try {
			return await _repository.updateConfiguration(updateData);
		} catch (e) {
			return false;
		}
	}

	Future<bool> _updateTimezone(String? timezone) async {
		if (timezone == null) return false;

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
			'timezone': timezone,
			'time_format': current.timeFormat.value,
			'number_format': current.numberFormat.value,
		};

		return await _repository.updateConfiguration(updateData);
	}

	Future<bool> _updateTimeFormat(TimeFormat format) async {
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
			'time_format': format.value,
			'number_format': current.numberFormat.value,
		};

		return await _repository.updateConfiguration(updateData);
	}
}
