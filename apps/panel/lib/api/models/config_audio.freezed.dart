// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_audio.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigAudio _$ConfigAudioFromJson(Map<String, dynamic> json) {
  return _ConfigAudio.fromJson(json);
}

/// @nodoc
mixin _$ConfigAudio {
  /// Configuration section type
  ConfigAudioType get type => throw _privateConstructorUsedError;

  /// Indicates whether the speaker is enabled.
  bool get speaker => throw _privateConstructorUsedError;

  /// The volume level of the speaker, ranging from 0 to 100.
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume => throw _privateConstructorUsedError;

  /// Indicates whether the microphone is enabled.
  bool get microphone => throw _privateConstructorUsedError;

  /// The volume level of the microphone, ranging from 0 to 100.
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume => throw _privateConstructorUsedError;

  /// Serializes this ConfigAudio to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigAudioCopyWith<ConfigAudio> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigAudioCopyWith<$Res> {
  factory $ConfigAudioCopyWith(
          ConfigAudio value, $Res Function(ConfigAudio) then) =
      _$ConfigAudioCopyWithImpl<$Res, ConfigAudio>;
  @useResult
  $Res call(
      {ConfigAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class _$ConfigAudioCopyWithImpl<$Res, $Val extends ConfigAudio>
    implements $ConfigAudioCopyWith<$Res> {
  _$ConfigAudioCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigAudio
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? speaker = null,
    Object? speakerVolume = null,
    Object? microphone = null,
    Object? microphoneVolume = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigAudioType,
      speaker: null == speaker
          ? _value.speaker
          : speaker // ignore: cast_nullable_to_non_nullable
              as bool,
      speakerVolume: null == speakerVolume
          ? _value.speakerVolume
          : speakerVolume // ignore: cast_nullable_to_non_nullable
              as int,
      microphone: null == microphone
          ? _value.microphone
          : microphone // ignore: cast_nullable_to_non_nullable
              as bool,
      microphoneVolume: null == microphoneVolume
          ? _value.microphoneVolume
          : microphoneVolume // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigAudioImplCopyWith<$Res>
    implements $ConfigAudioCopyWith<$Res> {
  factory _$$ConfigAudioImplCopyWith(
          _$ConfigAudioImpl value, $Res Function(_$ConfigAudioImpl) then) =
      __$$ConfigAudioImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigAudioImplCopyWithImpl<$Res>
    extends _$ConfigAudioCopyWithImpl<$Res, _$ConfigAudioImpl>
    implements _$$ConfigAudioImplCopyWith<$Res> {
  __$$ConfigAudioImplCopyWithImpl(
      _$ConfigAudioImpl _value, $Res Function(_$ConfigAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigAudio
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? speaker = null,
    Object? speakerVolume = null,
    Object? microphone = null,
    Object? microphoneVolume = null,
  }) {
    return _then(_$ConfigAudioImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigAudioType,
      speaker: null == speaker
          ? _value.speaker
          : speaker // ignore: cast_nullable_to_non_nullable
              as bool,
      speakerVolume: null == speakerVolume
          ? _value.speakerVolume
          : speakerVolume // ignore: cast_nullable_to_non_nullable
              as int,
      microphone: null == microphone
          ? _value.microphone
          : microphone // ignore: cast_nullable_to_non_nullable
              as bool,
      microphoneVolume: null == microphoneVolume
          ? _value.microphoneVolume
          : microphoneVolume // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigAudioImpl implements _ConfigAudio {
  const _$ConfigAudioImpl(
      {this.type = ConfigAudioType.audio,
      this.speaker = false,
      @JsonKey(name: 'speaker_volume') this.speakerVolume = 0,
      this.microphone = false,
      @JsonKey(name: 'microphone_volume') this.microphoneVolume = 0});

  factory _$ConfigAudioImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigAudioImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigAudioType type;

  /// Indicates whether the speaker is enabled.
  @override
  @JsonKey()
  final bool speaker;

  /// The volume level of the speaker, ranging from 0 to 100.
  @override
  @JsonKey(name: 'speaker_volume')
  final int speakerVolume;

  /// Indicates whether the microphone is enabled.
  @override
  @JsonKey()
  final bool microphone;

  /// The volume level of the microphone, ranging from 0 to 100.
  @override
  @JsonKey(name: 'microphone_volume')
  final int microphoneVolume;

  @override
  String toString() {
    return 'ConfigAudio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigAudioImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.speaker, speaker) || other.speaker == speaker) &&
            (identical(other.speakerVolume, speakerVolume) ||
                other.speakerVolume == speakerVolume) &&
            (identical(other.microphone, microphone) ||
                other.microphone == microphone) &&
            (identical(other.microphoneVolume, microphoneVolume) ||
                other.microphoneVolume == microphoneVolume));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, type, speaker, speakerVolume, microphone, microphoneVolume);

  /// Create a copy of ConfigAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigAudioImplCopyWith<_$ConfigAudioImpl> get copyWith =>
      __$$ConfigAudioImplCopyWithImpl<_$ConfigAudioImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigAudioImplToJson(
      this,
    );
  }
}

abstract class _ConfigAudio implements ConfigAudio {
  const factory _ConfigAudio(
          {final ConfigAudioType type,
          final bool speaker,
          @JsonKey(name: 'speaker_volume') final int speakerVolume,
          final bool microphone,
          @JsonKey(name: 'microphone_volume') final int microphoneVolume}) =
      _$ConfigAudioImpl;

  factory _ConfigAudio.fromJson(Map<String, dynamic> json) =
      _$ConfigAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigAudioType get type;

  /// Indicates whether the speaker is enabled.
  @override
  bool get speaker;

  /// The volume level of the speaker, ranging from 0 to 100.
  @override
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume;

  /// Indicates whether the microphone is enabled.
  @override
  bool get microphone;

  /// The volume level of the microphone, ranging from 0 to 100.
  @override
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume;

  /// Create a copy of ConfigAudio
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigAudioImplCopyWith<_$ConfigAudioImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
