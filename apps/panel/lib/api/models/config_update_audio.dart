// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_update_audio_type.dart';

part 'config_update_audio.freezed.dart';
part 'config_update_audio.g.dart';

/// Schema for partial update settings for audio configuration, allowing changes to speaker and microphone settings.
@Freezed()
class ConfigUpdateAudio with _$ConfigUpdateAudio {
  const factory ConfigUpdateAudio({
    /// Configuration section type
    required ConfigUpdateAudioType type,

    /// Enables or disables the speaker.
    required bool speaker,

    /// Sets the speaker volume (0-100).
    @JsonKey(name: 'speaker_volume')
    required int speakerVolume,

    /// Enables or disables the microphone.
    required bool microphone,

    /// Sets the microphone volume (0-100).
    @JsonKey(name: 'microphone_volume')
    required int microphoneVolume,
  }) = _ConfigUpdateAudio;
  
  factory ConfigUpdateAudio.fromJson(Map<String, Object?> json) => _$ConfigUpdateAudioFromJson(json);
}
