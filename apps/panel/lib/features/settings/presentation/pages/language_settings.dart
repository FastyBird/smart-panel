import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/language_configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class LanguageSettingsPage extends StatelessWidget {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();

  LanguageSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_language_settings_title,
      ),
      body: Consumer<ConfigurationRepository>(builder: (
        context,
        configurationRepository,
        _,
      ) {
        LanguageConfigurationModel configuration =
            configurationRepository.languageConfiguration;

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

        return SingleChildScrollView(
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
                      width: _scaler.scale(1),
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
                    localizations
                        .settings_language_settings_language_description,
                    style: TextStyle(
                      fontSize: _scaler.scale(8),
                    ),
                  ),
                  trailing: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: configuration.language.value,
                      items: {
                        LanguageType.english.value: 'English',
                        LanguageType.czech.value: 'Česky',
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
                      onChanged: (value) {
                        if (value != null) {
                          LanguageType? setLanguage =
                              LanguageType.fromValue(value);

                          if (setLanguage != null) {
                            configurationRepository.setLanguage(setLanguage);
                          }
                        }
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
                      width: _scaler.scale(1),
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
                    localizations
                        .settings_language_settings_timezone_description,
                    style: TextStyle(
                      fontSize: _scaler.scale(8),
                    ),
                  ),
                  trailing: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: configuration.timezone,
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
                      onChanged: (value) {
                        if (value != null) {
                          configurationRepository.setTimezone(value);
                        }
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
                      width: _scaler.scale(1),
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
                      fontSize: _scaler.scale(8),
                    ),
                  ),
                  trailing: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: configuration.timeFormat.value,
                      items: [
                        DropdownMenuItem(
                          value: '12h',
                          child: Text(
                            localizations.time_format_12h,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                            ),
                          ),
                        ),
                        DropdownMenuItem(
                          value: '24h',
                          child: Text(
                            localizations.time_format_24h,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                            ),
                          ),
                        ),
                      ],
                      onChanged: (String? value) {
                        if (value != null) {
                          TimeFormatType? setTimeFormat =
                              TimeFormatType.fromValue(value);

                          if (setTimeFormat != null) {
                            configurationRepository
                                .setTimeFormat(setTimeFormat);
                          }
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
