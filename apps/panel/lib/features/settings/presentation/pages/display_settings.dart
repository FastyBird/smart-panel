import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DisplaySettingsPage extends StatefulWidget {
  const DisplaySettingsPage({super.key});

  @override
  State<DisplaySettingsPage> createState() => _DisplaySettingsPageState();
}

class _DisplaySettingsPageState extends State<DisplaySettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigModuleRepository _configModuleRepository =
      locator<ConfigModuleRepository>();

  late bool _isDarkMode;
  late int _brightness;
  late int? _brightnessBackup;
  late bool _savingBrightness = false;
  late int _screenLockDuration;
  late bool _hasScreenSaver;

  Timer? _debounce;

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
      _isDarkMode = _configModuleRepository.displayConfiguration.hasDarkMode;
      _brightness = _configModuleRepository.displayConfiguration.brightness;
      _screenLockDuration =
          _configModuleRepository.displayConfiguration.screenLockDuration;
      _hasScreenSaver =
          _configModuleRepository.displayConfiguration.hasScreenSaver;
    });
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
                      fontSize: _screenService.scale(8),
                    ),
                  ),
                  trailing: IconSwitch(
                    switchState: _isDarkMode,
                    iconOn: Icons.dark_mode,
                    iconOff: Icons.light_mode,
                    toggleMode: true,
                    onChanged: (bool state) async {
                      HapticFeedback.lightImpact();

                      setState(() {
                        _isDarkMode = !_isDarkMode;
                      });

                      final success = await _configModuleRepository
                          .setDisplayDarkMode(_isDarkMode);

                      Future.microtask(() async {
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );

                        if (!context.mounted) return;

                        if (!success) {
                          setState(() {
                            _isDarkMode = !_isDarkMode;
                          });

                          AlertBar.showError(context,
                              message: 'Save settings failed.');
                        }
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
                      width: _screenService.scale(1),
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
                          value: _brightness.toDouble(),
                          min: 0,
                          max: 100,
                          divisions: 10,
                          label: '$_brightness%',
                          onChanged: (double value) async {
                            HapticFeedback.lightImpact();

                            setState(() {
                              _brightnessBackup = _savingBrightness
                                  ? _brightnessBackup
                                  : _brightness;
                              _savingBrightness = true;
                              _brightness = value.toInt();
                            });

                            _debounce?.cancel();

                            _debounce = Timer(
                              const Duration(milliseconds: 500),
                              () async {
                                final success = await _configModuleRepository
                                    .setDisplayBrightness(_brightness);

                                Future.microtask(() async {
                                  await Future.delayed(
                                    const Duration(milliseconds: 500),
                                  );

                                  if (!context.mounted) return;

                                  if (success) {
                                    setState(() {
                                      _brightnessBackup = null;
                                      _savingBrightness = false;
                                    });
                                  } else {
                                    setState(() {
                                      _brightness =
                                          _brightnessBackup ?? _brightness;
                                      _brightnessBackup = null;
                                      _savingBrightness = false;
                                    });

                                    AlertBar.showError(
                                      context,
                                      message: 'Save settings failed.',
                                    );
                                  }
                                });
                              },
                            );
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
                      width: _screenService.scale(1),
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
                      fontSize: _screenService.scale(8),
                    ),
                  ),
                  trailing: DropdownButtonHideUnderline(
                    child: DropdownButton<int>(
                      value: _screenLockDuration,
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
                      onChanged: (int? value) async {
                        HapticFeedback.lightImpact();

                        if (value == null) return;

                        final int backup = _screenLockDuration;

                        setState(() {
                          _screenLockDuration = value;
                        });

                        final success = await _configModuleRepository
                            .setDisplayScreenLockDuration(_screenLockDuration);

                        Future.microtask(() async {
                          await Future.delayed(
                            const Duration(milliseconds: 500),
                          );

                          if (!context.mounted) return;

                          if (!success) {
                            setState(() {
                              _screenLockDuration = backup;
                            });

                            AlertBar.showError(
                              context,
                              message: 'Save settings failed.',
                            );
                          }
                        });
                      },
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.regular
                            : AppTextColorDark.regular,
                      ),
                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
                    Icons.wallpaper,
                    size: AppFontSize.large,
                  ),
                  title: Text(
                    localizations.settings_display_settings_screen_saver_title,
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    localizations
                        .settings_display_settings_screen_saver_description,
                    style: TextStyle(
                      fontSize: _screenService.scale(8),
                    ),
                  ),
                  trailing: IconSwitch(
                    switchState: _hasScreenSaver,
                    iconOn: Icons.visibility,
                    iconOff: Icons.visibility_off,
                    onChanged: (bool state) async {
                      HapticFeedback.lightImpact();

                      setState(() {
                        _hasScreenSaver = !_hasScreenSaver;
                      });

                      final success = await _configModuleRepository
                          .setDisplayScreenSaver(_hasScreenSaver);

                      Future.microtask(() async {
                        await Future.delayed(
                          const Duration(milliseconds: 500),
                        );

                        if (!context.mounted) return;

                        if (!success) {
                          setState(() {
                            _hasScreenSaver = !_hasScreenSaver;
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
