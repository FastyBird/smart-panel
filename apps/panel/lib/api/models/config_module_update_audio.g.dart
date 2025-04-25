// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_update_audio.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleUpdateAudioImpl _$$ConfigModuleUpdateAudioImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleUpdateAudioImpl(
      type: ConfigModuleUpdateAudioType.fromJson(json['type'] as String),
      speaker: json['speaker'] as bool,
      speakerVolume: (json['speaker_volume'] as num).toInt(),
      microphone: json['microphone'] as bool,
      microphoneVolume: (json['microphone_volume'] as num).toInt(),
    );

Map<String, dynamic> _$$ConfigModuleUpdateAudioImplToJson(
        _$ConfigModuleUpdateAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigModuleUpdateAudioTypeEnumMap = {
  ConfigModuleUpdateAudioType.audio: 'audio',
  ConfigModuleUpdateAudioType.$unknown: r'$unknown',
};
