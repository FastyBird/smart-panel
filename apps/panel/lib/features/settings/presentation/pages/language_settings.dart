import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/types/configuration.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class LanguageSettingsPage extends StatefulWidget {
  const LanguageSettingsPage({super.key});

  @override
  State<LanguageSettingsPage> createState() => _LanguageSettingsPageState();
}

class _LanguageSettingsPageState extends State<LanguageSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigModuleRepository _configModuleRepository =
      locator<ConfigModuleRepository>();

  late String _timezone;
  late String? _timezoneBackup;
  late bool _savingTimezone = false;
  late Language _language;
  late Language? _languageBackup;
  late bool _savingLanguage = false;
  late TimeFormat _timeFormat;
  late TimeFormat? _timeFormatBackup;
  late bool _savingTimeFormat = false;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _configModuleRepository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    _configModuleRepository.removeListener(_syncStateWithRepository);
    super.dispose();
  }

  void _syncStateWithRepository() {
    setState(() {
      _timezone = _configModuleRepository.languageConfiguration.timezone;
      _language = _configModuleRepository.languageConfiguration.language;
      _timeFormat = _configModuleRepository.languageConfiguration.timeFormat;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

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

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_language_settings_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _screenService.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.translate,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_language_settings_language_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_language_settings_language_description,
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _language.value,
                    items: {
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
                    }).toList(),
                    onChanged: (String? value) async {
                      if (value == null) return;

                      final language = Language.fromValue(value);

                      if (language == null) return;

                      HapticFeedback.lightImpact();

                      setState(() {
                        _languageBackup =
                            _savingLanguage ? _languageBackup : _language;
                        _savingLanguage = true;
                        _language = language;
                      });

                      final success =
                          await _configModuleRepository.setLanguage(_language);

                      Future.microtask(() async {
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );

                        if (!context.mounted) return;

                        if (success) {
                          setState(() {
                            _languageBackup = null;
                            _savingLanguage = false;
                          });
                        } else {
                          setState(() {
                            _language = _languageBackup ?? _language;
                            _languageBackup = null;
                            _savingLanguage = false;
                          });

                          AlertBar.showError(
                            context,
                            message: 'Save settings failed.',
                          );
                        }
                      });
                    },
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _screenService.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.language,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_language_settings_timezone_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_language_settings_timezone_description,
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _timezone,
                    selectedItemBuilder: (BuildContext context) {
                      return timezones.map<Widget>((String item) {
                        return Container(
                          alignment: Alignment.centerRight,
                          width: 180,
                          child: Text(
                            item,
                            textAlign: TextAlign.end,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                            ),
                          ),
                        );
                      }).toList();
                    },
                    items: timezones.map((timezone) {
                      return DropdownMenuItem<String>(
                        value: timezone,
                        child: Text(
                          timezone,
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (String? value) async {
                      if (value == null) return;

                      HapticFeedback.lightImpact();

                      setState(() {
                        _timezoneBackup =
                            _savingTimezone ? _timezoneBackup : _timezone;
                        _savingTimezone = true;
                        _timezone = value;
                      });

                      final success =
                          await _configModuleRepository.setTimezone(_timezone);

                      Future.microtask(() async {
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );

                        if (!context.mounted) return;

                        if (success) {
                          setState(() {
                            _timezoneBackup = null;
                            _savingTimezone = false;
                          });
                        } else {
                          setState(() {
                            _timezone = _timezoneBackup ?? _timezone;
                            _timezoneBackup = null;
                            _savingTimezone = false;
                          });

                          AlertBar.showError(
                            context,
                            message: 'Save settings failed.',
                          );
                        }
                      });
                    },
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _screenService.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.access_time,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_language_settings_time_format_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations
                      .settings_language_settings_time_format_description,
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _timeFormat.value,
                    items: [
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
                    ],
                    onChanged: (String? value) async {
                      if (value == null) return;

                      final timeFormat = TimeFormat.fromValue(value);

                      if (timeFormat == null) return;

                      HapticFeedback.lightImpact();

                      setState(() {
                        _timeFormatBackup =
                            _savingTimeFormat ? _timeFormatBackup : _timeFormat;
                        _savingTimeFormat = true;
                        _timeFormat = timeFormat;
                      });

                      final success = await _configModuleRepository
                          .setTimeFormat(_timeFormat);

                      Future.microtask(() async {
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );

                        if (!context.mounted) return;

                        if (success) {
                          setState(() {
                            _timeFormatBackup = null;
                            _savingTimeFormat = false;
                          });
                        } else {
                          setState(() {
                            _timeFormat = _timeFormatBackup ?? _timeFormat;
                            _timeFormatBackup = null;
                            _savingTimeFormat = false;
                          });

                          AlertBar.showError(
                            context,
                            message: 'Save settings failed.',
                          );
                        }
                      });
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
