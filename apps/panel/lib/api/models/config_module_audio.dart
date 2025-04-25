// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_audio_type.dart';

part 'config_module_audio.freezed.dart';
part 'config_module_audio.g.dart';

/// Schema for audio configuration, including speaker and microphone controls.
@Freezed()
class ConfigModuleAudio with _$ConfigModuleAudio {
  const factory ConfigModuleAudio({
    /// Configuration section type
    @Default(ConfigModuleAudioType.audio)
    ConfigModuleAudioType type,

    /// Indicates whether the speaker is enabled.
    @Default(false)
    bool speaker,

    /// The volume level of the speaker, ranging from 0 to 100.
    @JsonKey(name: 'speaker_volume')
    @Default(0)
    int speakerVolume,

    /// Indicates whether the microphone is enabled.
    @Default(false)
    bool microphone,

    /// The volume level of the microphone, ranging from 0 to 100.
    @JsonKey(name: 'microphone_volume')
    @Default(0)
    int microphoneVolume,
  }) = _ConfigModuleAudio;
  
  factory ConfigModuleAudio.fromJson(Map<String, Object?> json) => _$ConfigModuleAudioFromJson(json);
}
