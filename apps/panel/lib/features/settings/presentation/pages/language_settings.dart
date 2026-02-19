import 'dart:async';

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_two_column_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/system/models/system.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
				_timezone = config.timezone;
				_language = config.language;
				_timeFormat = config.timeFormat;
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

		final List<String> timezones = [
			'Africa/Cairo',
			'Africa/Johannesburg',
			'America/New_York',
			'America/Los_Angeles',
			'Asia/Dubai',
			'Asia/Tokyo',
			'Asia/Kolkata',
			'Australia/Sydney',
			'Europe/London',
			'Europe/Berlin',
			'Europe/Prague',
		];

		final languageLabels = {
			Language.english.value: 'English',
			Language.czech.value: 'Česky',
		};

		final cards = <Widget>[
			SettingsCard(
				icon: Icons.language,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_language_title,
				description: localizations.settings_language_settings_language_description,
				trailing: DropdownButtonHideUnderline(
					child: DropdownButton2<String>(
						isExpanded: false,
						isDense: true,
						items: _getLanguageItems(),
						value: _language.value,
						onChanged: (String? value) async {
							_handleLanguageChange(context, value);
						},
						customButton: SettingsDropdownValue(
							value: languageLabels[_language.value] ?? _language.value,
						),
						menuItemStyleData: MenuItemStyleData(
							padding: EdgeInsets.symmetric(
								vertical: 0,
								horizontal: AppSpacings.pLg,
							),
							height: AppSpacings.scale(35),
						),
						dropdownStyleData: DropdownStyleData(
							padding: EdgeInsets.all(0),
							maxHeight: AppSpacings.scale(200),
						),
					),
				),
			),
			SettingsCard(
				icon: Icons.access_time,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_timezone_title,
				description: localizations.settings_language_settings_timezone_description,
				trailing: DropdownButtonHideUnderline(
					child: DropdownButton2<String>(
						isExpanded: false,
						isDense: true,
						items: _getTimezoneItems(timezones),
						value: _timezone,
						onChanged: (String? value) async {
							_handleTimeZoneChange(context, value);
						},
						customButton: SettingsDropdownValue(
							value: _timezone ?? '—',
						),
						menuItemStyleData: MenuItemStyleData(
							padding: EdgeInsets.symmetric(
								vertical: 0,
								horizontal: AppSpacings.pLg,
							),
							height: AppSpacings.scale(35),
						),
						dropdownStyleData: DropdownStyleData(
							padding: EdgeInsets.all(0),
							width: AppSpacings.scale(150),
							maxHeight: AppSpacings.scale(200),
						),
					),
				),
			),
			SettingsCard(
				icon: Icons.calendar_today_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_language_settings_time_format_title,
				description: localizations.settings_language_settings_time_format_description,
				trailing: DropdownButtonHideUnderline(
					child: DropdownButton2<String>(
						isExpanded: false,
						isDense: true,
						items: _getTimeFormatItems(context),
						value: _timeFormat.value,
						onChanged: (String? value) async {
							_handleTimeFormatChange(context, value);
						},
						customButton: SettingsDropdownValue(
							value: _timeFormat == TimeFormat.twelveHour
									? localizations.time_format_12h
									: localizations.time_format_24h,
						),
						menuItemStyleData: MenuItemStyleData(
							padding: EdgeInsets.symmetric(
								vertical: 0,
								horizontal: AppSpacings.pLg,
							),
							height: AppSpacings.scale(35),
						),
						dropdownStyleData: DropdownStyleData(
							padding: EdgeInsets.all(0),
							maxHeight: AppSpacings.scale(200),
						),
					),
				),
			),
		];

		return Scaffold(
			appBar: AppTopBar(
				title: localizations.settings_language_settings_title,
			),
			body: isLandscape
					? Padding(
							padding: EdgeInsets.all(AppSpacings.pLg),
							child: SettingsTwoColumnLayout(cards: cards),
						)
					: ListView(
							padding: EdgeInsets.all(AppSpacings.pLg),
							children: [
								for (int i = 0; i < cards.length; i++) ...[
									cards[i],
									if (i < cards.length - 1) SizedBox(height: AppSpacings.pMd),
								],
							],
						),
		);
	}

	List<DropdownMenuItem<String>> _getTimezoneItems(List<String> timezones) {
		return timezones.map((timezone) {
			return DropdownMenuItem<String>(
				value: timezone,
				child: Text(
					timezone,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			);
		}).toList();
	}

	List<DropdownMenuItem<String>> _getLanguageItems() {
		return {
			Language.english.value: 'English',
			Language.czech.value: 'Česky',
		}.entries.map((entry) {
			return DropdownMenuItem<String>(
				value: entry.key,
				child: Text(
					entry.value,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			);
		}).toList();
	}

	List<DropdownMenuItem<String>> _getTimeFormatItems(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		return [
			DropdownMenuItem(
				value: TimeFormat.twelveHour.value,
				child: Text(
					localizations.time_format_12h,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			),
			DropdownMenuItem(
				value: TimeFormat.twentyFourHour.value,
				child: Text(
					localizations.time_format_24h,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			),
		];
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

					AppToast.showError(
						context,
						message: 'Save settings failed.',
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

					AppToast.showError(
						context,
						message: 'Save settings failed.',
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

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
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
		};

		return await _repository.updateConfiguration(updateData);
	}
}
