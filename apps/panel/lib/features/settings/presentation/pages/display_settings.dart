import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/display_configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DisplaySettingsPage extends StatefulWidget {
  const DisplaySettingsPage({super.key});

  @override
  State<DisplaySettingsPage> createState() => _DisplaySettingsPageState();
}

class _DisplaySettingsPageState extends State<DisplaySettingsPage> {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  late bool _isDarkMode;

  @override
  void initState() {
    super.initState();

    _isDarkMode = _configurationRepository.displayConfiguration.hasDarkMode;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return AnimatedTheme(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
      data: _isDarkMode ? AppTheme.darkTheme : AppTheme.lightTheme,
      child: Scaffold(
        appBar: ScreenAppBar(
          title: localizations.settings_display_settings_title,
        ),
        body: Consumer<ConfigurationRepository>(builder: (
          context,
          configurationRepository,
          _,
        ) {
          DisplayConfigurationModel configuration =
              configurationRepository.displayConfiguration;

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
                      Icons.brightness_6,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations.settings_display_settings_theme_mode_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      localizations
                          .settings_display_settings_theme_mode_description,
                      style: TextStyle(
                        fontSize: _scaler.scale(8),
                      ),
                    ),
                    trailing: IconSwitch(
                      switchState: configuration.hasDarkMode,
                      iconOn: Icons.dark_mode,
                      iconOff: Icons.light_mode,
                      toggleMode: true,
                      onChanged: (index) {
                        configurationRepository
                            .setDisplayDarkMode(!configuration.hasDarkMode);

                        setState(() {
                          _isDarkMode = !configuration.hasDarkMode;
                        });
                      },
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
                      Icons.light_mode,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations.settings_display_settings_brightness_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Icon(
                          Icons.brightness_low,
                          size: AppFontSize.large,
                        ),
                        Expanded(
                          child: Slider(
                            value: configuration.brightness,
                            min: 0,
                            max: 100,
                            divisions: 10,
                            label: '${configuration.brightness.toInt()}%',
                            onChanged: (value) {
                              configurationRepository
                                  .setDisplayBrightness(value);
                            },
                          ),
                        ),
                        Icon(
                          Icons.brightness_high,
                          size: AppFontSize.large,
                        ),
                      ],
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
                      Icons.lock_clock,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations.settings_display_settings_screen_lock_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      localizations
                          .settings_display_settings_screen_lock_description,
                      style: TextStyle(
                        fontSize: _scaler.scale(8),
                      ),
                    ),
                    trailing: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: configuration.screenLockDuration,
                        items: {
                          15: '15s',
                          30: '30s',
                          60: '1min',
                          120: '2min',
                          300: '5min',
                          600: '10min',
                          1800: '30min',
                          0: 'Never',
                        }.entries.map((entry) {
                          return DropdownMenuItem<int>(
                            value: entry.key,
                            child: Text(
                              entry.value,
                              style: TextStyle(
                                fontSize: AppFontSize.extraSmall,
                              ),
                            ),
                          );
                        }).toList(),
                        onChanged: (int? value) {
                          configurationRepository.setDisplayScreenLockDuration(
                            value ?? 0,
                          );
                        },
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                        ),
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.base),
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
                      Icons.wallpaper,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations
                          .settings_display_settings_screen_saver_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      localizations
                          .settings_display_settings_screen_saver_description,
                      style: TextStyle(
                        fontSize: _scaler.scale(8),
                      ),
                    ),
                    trailing: IconSwitch(
                      switchState: configuration.hasScreenSaver,
                      iconOn: Icons.visibility,
                      iconOff: Icons.visibility_off,
                      onChanged: (index) {
                        configurationRepository.setDisplayScreenSaver(
                            !configuration.hasScreenSaver);
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
