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

class AudioSettingsPage extends StatefulWidget {
  const AudioSettingsPage({super.key});

  @override
  State<AudioSettingsPage> createState() => _AudioSettingsPageState();
}

class _AudioSettingsPageState extends State<AudioSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigModuleRepository _repository = locator<ConfigModuleRepository>();

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

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    ConfigAudioModel config = _repository.audioConfiguration;

    setState(() {
      _speakerEnabled = config.hasSpeakerEnabled;
      _speakerVolume = config.speakerVolume;
      _microphoneEnabled = config.hasMicrophoneEnabled;
      _microphoneVolume = config.microphoneVolume;
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
              SettingRow(
                icon: Symbols.speaker,
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
                  iconOn: Symbols.volume_up,
                  iconOff: Symbols.volume_off,
                  switchState: _speakerEnabled,
                  onChanged: (bool state) async {
                    _handleSpeakerChange(context, state);
                  },
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: Symbols.volume_up,
                title: Text(
                  localizations.settings_audio_settings_speaker_volume_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: SettingSlider(
                  leftIcon: Symbols.volume_down,
                  rightIcon: Symbols.volume_up,
                  value: _speakerVolume.toDouble(),
                  enabled: _speakerEnabled,
                  onChanged: (double value) async {
                    _handleSpeakerVolumeChange(
                      context,
                      value,
                    );
                  },
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: Symbols.mic_external_on,
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
                  iconOn: Symbols.mic,
                  iconOff: Symbols.mic_off,
                  switchState: _microphoneEnabled,
                  onChanged: (bool state) async {
                    _handleMicrophoneChange(context, state);
                  },
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: Symbols.mic,
                title: Text(
                  localizations.settings_audio_settings_microphone_volume_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: SettingSlider(
                  leftIcon: Symbols.mic_off,
                  rightIcon: Symbols.mic_sharp,
                  value: _microphoneVolume.toDouble(),
                  enabled: _microphoneEnabled,
                  onChanged: (double value) async {
                    _handleMicrophoneVolumeChange(
                      context,
                      value,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleSpeakerChange(
    BuildContext context,
    bool state,
  ) async {
    HapticFeedback.lightImpact();

    setState(() {
      _speakerEnabled = !_speakerEnabled;
    });

    final success = await _repository.setSpeakerState(
      _speakerEnabled,
    );

    Future.microtask(
      () async {
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
      },
    );
  }

  Future<void> _handleSpeakerVolumeChange(
    BuildContext context,
    double value,
  ) async {
    HapticFeedback.lightImpact();

    if (!_savingSpeakerVolume) {
      setState(() {
        _speakerVolumeBackup = _speakerVolume;
        _savingSpeakerVolume = true;
      });
    }

    setState(() {
      _speakerVolume = value.toInt();
    });

    _debounce?.cancel();

    _debounce = Timer(
      const Duration(milliseconds: 500),
      () async {
        final success = await _repository.setSpeakerVolume(
          _speakerVolume,
        );

        Future.microtask(
          () async {
            await Future.delayed(
              const Duration(milliseconds: 500),
            );

            if (!context.mounted) return;

            setState(() {
              _speakerVolumeBackup = null;
              _savingSpeakerVolume = false;
            });

            if (!success) {
              setState(() {
                _speakerVolume = _speakerVolumeBackup ?? 0;
              });

              AlertBar.showError(
                context,
                message: 'Save settings failed.',
              );
            }
          },
        );
      },
    );
  }

  Future<void> _handleMicrophoneChange(
    BuildContext context,
    bool state,
  ) async {
    HapticFeedback.lightImpact();

    setState(() {
      _microphoneEnabled = !_microphoneEnabled;
    });

    final success = await _repository.setMicrophoneState(
      _microphoneEnabled,
    );

    Future.microtask(
      () async {
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
      },
    );
  }

  Future<void> _handleMicrophoneVolumeChange(
    BuildContext context,
    double value,
  ) async {
    HapticFeedback.lightImpact();

    if (!_savingMicrophoneVolume) {
      setState(() {
        _microphoneVolumeBackup = _microphoneVolume;
        _savingMicrophoneVolume = true;
      });
    }

    setState(() {
      _microphoneVolume = value.toInt();
    });

    _debounce?.cancel();

    _debounce = Timer(
      const Duration(milliseconds: 500),
      () async {
        final success = await _repository.setMicrophoneVolume(
          _microphoneVolume,
        );

        Future.microtask(
          () async {
            await Future.delayed(
              const Duration(milliseconds: 500),
            );

            if (!context.mounted) return;

            setState(() {
              _microphoneVolumeBackup = null;
              _savingMicrophoneVolume = false;
            });

            if (!success) {
              setState(() {
                _microphoneVolume = _microphoneVolumeBackup ?? 0;
              });

              AlertBar.showError(
                context,
                message: 'Save settings failed.',
              );
            }
          },
        );
      },
    );
  }
}
