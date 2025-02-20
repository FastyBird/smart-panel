import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_slider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';

class DisplaySettingsPage extends StatefulWidget {
  const DisplaySettingsPage({super.key});

  @override
  State<DisplaySettingsPage> createState() => _DisplaySettingsPageState();
}

class _DisplaySettingsPageState extends State<DisplaySettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigModuleRepository _repository = locator<ConfigModuleRepository>();

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

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    ConfigDisplayModel config = _repository.displayConfiguration;

    setState(() {
      _isDarkMode = config.hasDarkMode;
      _brightness = config.brightness;
      _screenLockDuration = config.screenLockDuration;
      _hasScreenSaver = config.hasScreenSaver;
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
                SettingRow(
                  icon: Symbols.brightness_medium,
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
                    iconOn: Symbols.dark_mode,
                    iconOff: Symbols.light_mode,
                    toggleMode: true,
                    onChanged: (bool state) async {
                      _handleDarkModeChange(context, state);
                    },
                  ),
                ),
                AppSpacings.spacingMdVertical,
                SettingRow(
                  icon: Symbols.light_mode,
                  title: Text(
                    localizations.settings_display_settings_brightness_title,
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  subtitle: SettingSlider(
                    leftIcon: Symbols.brightness_low,
                    rightIcon: Symbols.brightness_high,
                    value: _brightness.toDouble(),
                    enabled: true,
                    onChanged: (double value) async {
                      _handleBrightnessChange(context, value);
                    },
                  ),
                ),
                AppSpacings.spacingMdVertical,
                SettingRow(
                  icon: Symbols.screen_lock_portrait,
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
                      items: _getScreenLockDurationItems(),
                      onChanged: (int? value) async {
                        _handleScreenLockDurationChange(context, value);
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
                SettingRow(
                  icon: Symbols.wallpaper,
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
                    iconOn: Symbols.visibility,
                    iconOff: Symbols.visibility_off,
                    onChanged: (bool state) async {
                      _handleScreenSaverChange(context, state);
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

  List<DropdownMenuItem<int>> _getScreenLockDurationItems() {
    return {
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
    }).toList();
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

          AlertBar.showError(context, message: 'Save settings failed.');
        }
      },
    );
  }

  Future<void> _handleBrightnessChange(
    BuildContext context,
    double value,
  ) async {
    HapticFeedback.lightImpact();

    if (!_savingBrightness) {
      setState(() {
        _brightnessBackup = _brightness;
        _savingBrightness = true;
      });
    }

    setState(() {
      _brightness = value.toInt();
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

          setState(() {
            _brightnessBackup = null;
            _savingBrightness = false;
          });

          if (!success) {
            setState(() {
              _brightness = _brightnessBackup ?? 0;
            });

            AlertBar.showError(
              context,
              message: 'Save settings failed.',
            );
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

          AlertBar.showError(
            context,
            message: 'Save settings failed.',
          );
        }
      },
    );
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

          AlertBar.showError(
            context,
            message: 'Save settings failed.',
          );
        }
      },
    );
  }
}
