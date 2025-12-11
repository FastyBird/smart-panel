import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_slider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class AudioSettingsPage extends StatefulWidget {
  const AudioSettingsPage({super.key});

  @override
  State<AudioSettingsPage> createState() => _AudioSettingsPageState();
}

class _AudioSettingsPageState extends State<AudioSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DisplayRepository _repository = locator<DisplayRepository>();

  late bool _audioOutputSupported;
  late bool _audioInputSupported;

  late bool _hasSpeakerEnabled;
  late int _speakerVolume;
  late int? _speakerVolumeBackup;
  late bool _savingSpeakerVolume = false;

  late bool _hasMicrophoneEnabled;
  late int _microphoneVolume;
  late int? _microphoneVolumeBackup;
  late bool _savingMicrophoneVolume = false;

  Timer? _speakerDebounce;
  Timer? _microphoneDebounce;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _speakerDebounce?.cancel();
    _microphoneDebounce?.cancel();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    setState(() {
      _audioOutputSupported = _repository.audioOutputSupported;
      _audioInputSupported = _repository.audioInputSupported;
      _hasSpeakerEnabled = _repository.hasSpeakerEnabled;
      _speakerVolume = _repository.speakerVolume;
      _hasMicrophoneEnabled = _repository.hasMicrophoneEnabled;
      _microphoneVolume = _repository.microphoneVolume;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppTopBar(
        title: localizations.settings_audio_settings_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!_audioOutputSupported && !_audioInputSupported)
                _buildNoAudioSupportMessage(localizations)
              else ...[
                if (_audioOutputSupported) ...[
                  _buildSpeakerSection(localizations),
                  if (_audioInputSupported) AppSpacings.spacingMdVertical,
                ],
                if (_audioInputSupported) _buildMicrophoneSection(localizations),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNoAudioSupportMessage(AppLocalizations localizations) {
    return Center(
      child: Padding(
        padding: AppSpacings.paddingLg,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.volumeOff,
              size: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).disabledColor,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.settings_audio_settings_no_support,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: Theme.of(context).disabledColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpeakerSection(AppLocalizations localizations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingRow(
          icon: MdiIcons.volumeHigh,
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
              fontSize: _screenService.scale(
                8,
                density: _visualDensityService.density,
              ),
            ),
          ),
          trailing: IconSwitch(
            switchState: _hasSpeakerEnabled,
            iconOn: MdiIcons.volumeHigh,
            iconOff: MdiIcons.volumeOff,
            onChanged: (bool state) async {
              _handleSpeakerStateChange(context, state);
            },
          ),
        ),
        AppSpacings.spacingMdVertical,
        SettingRow(
          icon: MdiIcons.volumeMedium,
          title: Text(
            localizations.settings_audio_settings_speaker_volume_title,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: SettingSlider(
            leftIcon: MdiIcons.volumeLow,
            rightIcon: MdiIcons.volumeHigh,
            value: _speakerVolume.toDouble(),
            enabled: _hasSpeakerEnabled,
            onChanged: (double value) async {
              _handleSpeakerVolumeChange(context, value);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMicrophoneSection(AppLocalizations localizations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingRow(
          icon: MdiIcons.microphone,
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
              fontSize: _screenService.scale(
                8,
                density: _visualDensityService.density,
              ),
            ),
          ),
          trailing: IconSwitch(
            switchState: _hasMicrophoneEnabled,
            iconOn: MdiIcons.microphone,
            iconOff: MdiIcons.microphoneOff,
            onChanged: (bool state) async {
              _handleMicrophoneStateChange(context, state);
            },
          ),
        ),
        AppSpacings.spacingMdVertical,
        SettingRow(
          icon: MdiIcons.microphone,
          title: Text(
            localizations.settings_audio_settings_microphone_volume_title,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: SettingSlider(
            leftIcon: MdiIcons.volumeLow,
            rightIcon: MdiIcons.volumeHigh,
            value: _microphoneVolume.toDouble(),
            enabled: _hasMicrophoneEnabled,
            onChanged: (double value) async {
              _handleMicrophoneVolumeChange(context, value);
            },
          ),
        ),
      ],
    );
  }

  Future<void> _handleSpeakerStateChange(
    BuildContext context,
    bool state,
  ) async {
    HapticFeedback.lightImpact();

    setState(() {
      _hasSpeakerEnabled = !_hasSpeakerEnabled;
    });

    final success = await _repository.setSpeakerState(_hasSpeakerEnabled);

    Future.microtask(
      () async {
        await Future.delayed(
          const Duration(milliseconds: 500),
        );

        if (!context.mounted) return;

        if (!success) {
          setState(() {
            _hasSpeakerEnabled = !_hasSpeakerEnabled;
          });

          AlertBar.showError(context, message: 'Save settings failed.');
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

    _speakerDebounce?.cancel();

    _speakerDebounce = Timer(
      const Duration(milliseconds: 500),
      () async {
        final success = await _repository.setSpeakerVolume(_speakerVolume);

        Future.microtask(() async {
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
              _speakerVolume = _speakerVolumeBackup ?? 50;
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

  Future<void> _handleMicrophoneStateChange(
    BuildContext context,
    bool state,
  ) async {
    HapticFeedback.lightImpact();

    setState(() {
      _hasMicrophoneEnabled = !_hasMicrophoneEnabled;
    });

    final success = await _repository.setMicrophoneState(_hasMicrophoneEnabled);

    Future.microtask(
      () async {
        await Future.delayed(
          const Duration(milliseconds: 500),
        );

        if (!context.mounted) return;

        if (!success) {
          setState(() {
            _hasMicrophoneEnabled = !_hasMicrophoneEnabled;
          });

          AlertBar.showError(context, message: 'Save settings failed.');
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

    _microphoneDebounce?.cancel();

    _microphoneDebounce = Timer(
      const Duration(milliseconds: 500),
      () async {
        final success = await _repository.setMicrophoneVolume(_microphoneVolume);

        Future.microtask(() async {
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
              _microphoneVolume = _microphoneVolumeBackup ?? 50;
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
}
