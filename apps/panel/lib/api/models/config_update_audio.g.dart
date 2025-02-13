// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_update_audio.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigUpdateAudioImpl _$$ConfigUpdateAudioImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigUpdateAudioImpl(
      type: ConfigUpdateAudioType.fromJson(json['type'] as String),
      speaker: json['speaker'] as bool,
      speakerVolume: (json['speaker_volume'] as num).toInt(),
      microphone: json['microphone'] as bool,
      microphoneVolume: (json['microphone_volume'] as num).toInt(),
    );

Map<String, dynamic> _$$ConfigUpdateAudioImplToJson(
        _$ConfigUpdateAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigUpdateAudioTypeEnumMap = {
  ConfigUpdateAudioType.audio: 'audio',
  ConfigUpdateAudioType.$unknown: r'$unknown',
};
