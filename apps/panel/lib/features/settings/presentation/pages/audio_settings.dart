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

class AudioSettingsPage extends StatefulWidget {
  const AudioSettingsPage({super.key});

  @override
  State<AudioSettingsPage> createState() => _AudioSettingsPageState();
}

class _AudioSettingsPageState extends State<AudioSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigModuleRepository _configModuleRepository =
      locator<ConfigModuleRepository>();

  late bool _speakerEnabled;
  late int _speakerVolume;
  late int? _speakerVolumeBackup;
  late bool _savingSpeakerVolume = false;
  late bool _microphoneEnabled;
  late int _microphoneVolume;
  late int? _microphoneVolumeBackup;
  late bool _savingMicrophoneVolume = false;

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
      _speakerEnabled =
          _configModuleRepository.audioConfiguration.hasSpeakerEnabled;
      _speakerVolume = _configModuleRepository.audioConfiguration.speakerVolume;
      _microphoneEnabled =
          _configModuleRepository.audioConfiguration.hasMicrophoneEnabled;
      _microphoneVolume =
          _configModuleRepository.audioConfiguration.microphoneVolume;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_audio_settings_title,
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
                  Icons.speaker_phone,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_audio_settings_speaker_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_audio_settings_speaker_description,
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: IconSwitch(
                  switchState: _speakerEnabled,
                  iconOn: Icons.volume_up,
                  iconOff: Icons.volume_off,
                  onChanged: (bool state) async {
                    HapticFeedback.lightImpact();

                    setState(() {
                      _speakerEnabled = !_speakerEnabled;
                    });

                    final success = await _configModuleRepository
                        .setSpeakerState(_speakerEnabled);

                    Future.microtask(() async {
                      await Future.delayed(
                        const Duration(milliseconds: 500),
                      );

                      if (!context.mounted) return;

                      if (!success) {
                        setState(() {
                          _speakerEnabled = !_speakerEnabled;
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
                  Icons.volume_up,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_audio_settings_speaker_volume_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(
                      Icons.volume_down,
                      size: AppFontSize.large,
                    ),
                    Expanded(
                      child: Slider(
                        value: _speakerVolume.toDouble(),
                        min: 0,
                        max: 100,
                        divisions: 10,
                        label: '$_speakerVolume%',
                        onChanged: _speakerEnabled
                            ? (double value) async {
                                HapticFeedback.lightImpact();

                                setState(() {
                                  _speakerVolumeBackup = _savingSpeakerVolume
                                      ? _speakerVolumeBackup
                                      : _speakerVolume;
                                  _savingSpeakerVolume = true;
                                  _speakerVolume = value.toInt();
                                });

                                _debounce?.cancel();

                                _debounce =
                                    Timer(const Duration(milliseconds: 500),
                                        () async {
                                  final success = await _configModuleRepository
                                      .setSpeakerVolume(_speakerVolume);

                                  Future.microtask(() async {
                                    await Future.delayed(
                                      const Duration(milliseconds: 500),
                                    );

                                    if (!context.mounted) return;

                                    if (success) {
                                      setState(() {
                                        _speakerVolumeBackup = null;
                                        _savingSpeakerVolume = false;
                                      });
                                    } else {
                                      setState(() {
                                        _speakerVolume = _speakerVolumeBackup ??
                                            _speakerVolume;
                                        _speakerVolumeBackup = null;
                                        _savingSpeakerVolume = false;
                                      });

                                      AlertBar.showError(
                                        context,
                                        message: 'Save settings failed.',
                                      );
                                    }
                                  });
                                });
                              }
                            : null,
                      ),
                    ),
                    Icon(
                      Icons.volume_up,
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
                  Icons.mic_external_on,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_audio_settings_microphone_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_audio_settings_microphone_description,
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: IconSwitch(
                  switchState: _microphoneEnabled,
                  iconOn: Icons.mic,
                  iconOff: Icons.mic_off,
                  onChanged: (bool state) async {
                    HapticFeedback.lightImpact();

                    setState(() {
                      _microphoneEnabled = !_microphoneEnabled;
                    });

                    final success = await _configModuleRepository
                        .setMicrophoneState(_microphoneEnabled);

                    Future.microtask(() async {
                      await Future.delayed(
                        const Duration(milliseconds: 500),
                      );

                      if (!context.mounted) return;

                      if (!success) {
                        setState(() {
                          _microphoneEnabled = !_microphoneEnabled;
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
                  Icons.mic,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_audio_settings_microphone_volume_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(
                      Icons.mic_none,
                      size: AppFontSize.large,
                    ),
                    Expanded(
                      child: Slider(
                        value: _microphoneVolume.toDouble(),
                        min: 0,
                        max: 100,
                        divisions: 10,
                        label: '$_microphoneVolume%',
                        onChanged: _microphoneEnabled
                            ? (double value) async {
                                HapticFeedback.lightImpact();

                                setState(() {
                                  _microphoneVolumeBackup =
                                      _savingMicrophoneVolume
                                          ? _microphoneVolumeBackup
                                          : _microphoneVolume;
                                  _savingMicrophoneVolume = true;
                                  _microphoneVolume = value.toInt();
                                });

                                _debounce?.cancel();

                                _debounce =
                                    Timer(const Duration(milliseconds: 500),
                                        () async {
                                  final success = await _configModuleRepository
                                      .setMicrophoneVolume(_microphoneVolume);

                                  Future.microtask(() async {
                                    await Future.delayed(
                                      const Duration(milliseconds: 500),
                                    );

                                    if (!context.mounted) return;

                                    if (success) {
                                      setState(() {
                                        _microphoneVolumeBackup = null;
                                        _savingMicrophoneVolume = false;
                                      });
                                    } else {
                                      setState(() {
                                        _microphoneVolume =
                                            _microphoneVolumeBackup ??
                                                _microphoneVolume;
                                        _microphoneVolumeBackup = null;
                                        _savingMicrophoneVolume = false;
                                      });

                                      AlertBar.showError(
                                        context,
                                        message: 'Save settings failed.',
                                      );
                                    }
                                  });
                                });
                              }
                            : null,
                      ),
                    ),
                    Icon(
                      Icons.mic_sharp,
                      size: AppFontSize.large,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
