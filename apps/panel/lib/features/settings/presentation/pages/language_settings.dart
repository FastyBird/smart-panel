import 'dart:async';

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/export.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LanguageSettingsPage extends StatefulWidget {
  const LanguageSettingsPage({super.key});

  @override
  State<LanguageSettingsPage> createState() => _LanguageSettingsPageState();
}

class _LanguageSettingsPageState extends State<LanguageSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final LanguageConfigRepository _repository =
      locator<LanguageConfigRepository>();

  late String _timezone;
  late Language _language;
  late TimeFormat _timeFormat;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    setState(() {
      _timezone = _repository.timezone;
      _language = _repository.language;
      _timeFormat = _repository.timeFormat;
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
      appBar: AppTopBar(
        title: localizations.settings_language_settings_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SettingRow(
                icon: MdiIcons.translate,
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
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton2<String>(
                    isExpanded: false,
                    isDense: true,
                    items: getLanguageItems(),
                    value: _language.value,
                    onChanged: (String? value) async {
                      _handleLanguageChange(context, value);
                    },
                    menuItemStyleData: MenuItemStyleData(
                      padding: EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: AppSpacings.pLg,
                      ),
                      height: _screenService.scale(
                        35,
                        density: _visualDensityService.density,
                      ),
                    ),
                    dropdownStyleData: DropdownStyleData(
                      padding: EdgeInsets.all(0),
                      maxHeight: _screenService.scale(
                        200,
                        density: _visualDensityService.density,
                      ),
                    ),
                    iconStyleData: const IconStyleData(
                      openMenuIcon: Icon(Icons.arrow_drop_up),
                    ),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: MdiIcons.web,
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
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton2<String>(
                    isExpanded: false,
                    isDense: true,
                    items: getTimezoneItems(timezones),
                    value: _timezone,
                    onChanged: (String? value) async {
                      _handleTimeZoneChange(context, value);
                    },
                    selectedItemBuilder: (BuildContext context) {
                      return timezones.map<Widget>((String item) {
                        return Container(
                          alignment: Alignment.centerRight,
                          width: _screenService.scale(
                            120,
                            density: _visualDensityService.density,
                          ),
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
                    menuItemStyleData: MenuItemStyleData(
                      padding: EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: AppSpacings.pLg,
                      ),
                      height: _screenService.scale(
                        35,
                        density: _visualDensityService.density,
                      ),
                    ),
                    dropdownStyleData: DropdownStyleData(
                      padding: EdgeInsets.all(0),
                      width: _screenService.scale(
                        150,
                        density: _visualDensityService.density,
                      ),
                      maxHeight: _screenService.scale(
                        200,
                        density: _visualDensityService.density,
                      ),
                    ),
                    iconStyleData: const IconStyleData(
                      openMenuIcon: Icon(Icons.arrow_drop_up),
                    ),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: MdiIcons.clockOutline,
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
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton2<String>(
                    isExpanded: false,
                    isDense: true,
                    items: getTimeFormatItems(context),
                    value: _timeFormat.value,
                    onChanged: (String? value) async {
                      _handleTimeFormatChange(context, value);
                    },
                    menuItemStyleData: MenuItemStyleData(
                      padding: EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: AppSpacings.pLg,
                      ),
                      height: _screenService.scale(
                        35,
                        density: _visualDensityService.density,
                      ),
                    ),
                    dropdownStyleData: DropdownStyleData(
                      padding: EdgeInsets.all(0),
                      maxHeight: _screenService.scale(
                        200,
                        density: _visualDensityService.density,
                      ),
                    ),
                    iconStyleData: const IconStyleData(
                      openMenuIcon: Icon(Icons.arrow_drop_up),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<DropdownMenuItem<String>> getTimezoneItems(List<String> timezones) {
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

  List<DropdownMenuItem<String>> getLanguageItems() {
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

  List<DropdownMenuItem<String>> getTimeFormatItems(BuildContext context) {
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

    final success = await _repository.setLanguage(_language);

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

          AlertBar.showError(
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

    final String backup = _timezone;

    setState(() {
      _timezone = value;
    });

    final success = await _repository.setTimezone(_timezone);

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

          AlertBar.showError(
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

    final success = await _repository.setTimeFormat(_timeFormat);

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

          AlertBar.showError(
            context,
            message: 'Save settings failed.',
          );
        }
      },
    );
  }
}
