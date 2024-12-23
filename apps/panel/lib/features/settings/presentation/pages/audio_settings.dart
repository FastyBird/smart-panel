import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/audio_configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

class AudioSettingsPage extends StatelessWidget {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();

  AudioSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_audio_settings_title,
      ),
      body: Consumer<ConfigurationRepository>(builder: (
        context,
        configurationRepository,
        _,
      ) {
        AudioConfigurationModel configuration =
            configurationRepository.audioConfiguration;

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
                      fontSize: _scaler.scale(8),
                    ),
                  ),
                  trailing: IconSwitch(
                    switchState: configuration.hasSpeakerEnabled,
                    iconOn: Icons.volume_up,
                    iconOff: Icons.volume_off,
                    onChanged: (index) {
                      configurationRepository.setSpeakerState(
                        !configuration.hasSpeakerEnabled,
                      );
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
                          value: configuration.speakerVolume,
                          min: 0,
                          max: 100,
                          divisions: 10,
                          label: '${configuration.speakerVolume.toInt()}%',
                          onChanged: configuration.hasSpeakerEnabled
                              ? (value) {
                                  HapticFeedback.lightImpact();
                                  configurationRepository
                                      .setSpeakerVolume(value);
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
                      width: _scaler.scale(1),
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
                    localizations
                        .settings_audio_settings_microphone_description,
                    style: TextStyle(
                      fontSize: _scaler.scale(8),
                    ),
                  ),
                  trailing: IconSwitch(
                    switchState: configuration.hasMicrophoneEnabled,
                    iconOn: Icons.mic,
                    iconOff: Icons.mic_off,
                    onChanged: (index) {
                      configurationRepository.setMicrophoneState(
                        !configuration.hasMicrophoneEnabled,
                      );
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
                    Icons.mic,
                    size: AppFontSize.large,
                  ),
                  title: Text(
                    localizations
                        .settings_audio_settings_microphone_volume_title,
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
                          value: configuration.microphoneVolume,
                          min: 0,
                          max: 100,
                          divisions: 10,
                          label: '${configuration.microphoneVolume.toInt()}%',
                          onChanged: configuration.hasMicrophoneEnabled
                              ? (value) {
                                  HapticFeedback.lightImpact();
                                  configurationRepository
                                      .setMicrophoneVolume(value);
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
        );
      }),
    );
  }
}
