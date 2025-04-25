// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_audio.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleAudioImpl _$$ConfigModuleAudioImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleAudioImpl(
      type: json['type'] == null
          ? ConfigModuleAudioType.audio
          : ConfigModuleAudioType.fromJson(json['type'] as String),
      speaker: json['speaker'] as bool? ?? false,
      speakerVolume: (json['speaker_volume'] as num?)?.toInt() ?? 0,
      microphone: json['microphone'] as bool? ?? false,
      microphoneVolume: (json['microphone_volume'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$ConfigModuleAudioImplToJson(
        _$ConfigModuleAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigModuleAudioTypeEnumMap = {
  ConfigModuleAudioType.audio: 'audio',
  ConfigModuleAudioType.$unknown: r'$unknown',
};
