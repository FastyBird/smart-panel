// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_audio.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigAudioImpl _$$ConfigAudioImplFromJson(Map<String, dynamic> json) =>
    _$ConfigAudioImpl(
      type: json['type'] == null
          ? ConfigAudioType.audio
          : ConfigAudioType.fromJson(json['type'] as String),
      speaker: json['speaker'] as bool? ?? false,
      speakerVolume: (json['speaker_volume'] as num?)?.toInt() ?? 0,
      microphone: json['microphone'] as bool? ?? false,
      microphoneVolume: (json['microphone_volume'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$ConfigAudioImplToJson(_$ConfigAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigAudioTypeEnumMap = {
  ConfigAudioType.audio: 'audio',
  ConfigAudioType.$unknown: r'$unknown',
};
