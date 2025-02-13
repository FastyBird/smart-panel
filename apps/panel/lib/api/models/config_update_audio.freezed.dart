// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_update_audio.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigUpdateAudio _$ConfigUpdateAudioFromJson(Map<String, dynamic> json) {
  return _ConfigUpdateAudio.fromJson(json);
}

/// @nodoc
mixin _$ConfigUpdateAudio {
  /// Configuration section type
  ConfigUpdateAudioType get type => throw _privateConstructorUsedError;

  /// Enables or disables the speaker.
  bool get speaker => throw _privateConstructorUsedError;

  /// Sets the speaker volume (0-100).
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume => throw _privateConstructorUsedError;

  /// Enables or disables the microphone.
  bool get microphone => throw _privateConstructorUsedError;

  /// Sets the microphone volume (0-100).
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume => throw _privateConstructorUsedError;

  /// Serializes this ConfigUpdateAudio to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigUpdateAudioCopyWith<ConfigUpdateAudio> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigUpdateAudioCopyWith<$Res> {
  factory $ConfigUpdateAudioCopyWith(
          ConfigUpdateAudio value, $Res Function(ConfigUpdateAudio) then) =
      _$ConfigUpdateAudioCopyWithImpl<$Res, ConfigUpdateAudio>;
  @useResult
  $Res call(
      {ConfigUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class _$ConfigUpdateAudioCopyWithImpl<$Res, $Val extends ConfigUpdateAudio>
    implements $ConfigUpdateAudioCopyWith<$Res> {
  _$ConfigUpdateAudioCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigUpdateAudio
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
              as ConfigUpdateAudioType,
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
abstract class _$$ConfigUpdateAudioImplCopyWith<$Res>
    implements $ConfigUpdateAudioCopyWith<$Res> {
  factory _$$ConfigUpdateAudioImplCopyWith(_$ConfigUpdateAudioImpl value,
          $Res Function(_$ConfigUpdateAudioImpl) then) =
      __$$ConfigUpdateAudioImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigUpdateAudioImplCopyWithImpl<$Res>
    extends _$ConfigUpdateAudioCopyWithImpl<$Res, _$ConfigUpdateAudioImpl>
    implements _$$ConfigUpdateAudioImplCopyWith<$Res> {
  __$$ConfigUpdateAudioImplCopyWithImpl(_$ConfigUpdateAudioImpl _value,
      $Res Function(_$ConfigUpdateAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigUpdateAudio
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
    return _then(_$ConfigUpdateAudioImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateAudioType,
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
class _$ConfigUpdateAudioImpl implements _ConfigUpdateAudio {
  const _$ConfigUpdateAudioImpl(
      {required this.type,
      required this.speaker,
      @JsonKey(name: 'speaker_volume') required this.speakerVolume,
      required this.microphone,
      @JsonKey(name: 'microphone_volume') required this.microphoneVolume});

  factory _$ConfigUpdateAudioImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigUpdateAudioImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateAudioType type;

  /// Enables or disables the speaker.
  @override
  final bool speaker;

  /// Sets the speaker volume (0-100).
  @override
  @JsonKey(name: 'speaker_volume')
  final int speakerVolume;

  /// Enables or disables the microphone.
  @override
  final bool microphone;

  /// Sets the microphone volume (0-100).
  @override
  @JsonKey(name: 'microphone_volume')
  final int microphoneVolume;

  @override
  String toString() {
    return 'ConfigUpdateAudio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigUpdateAudioImpl &&
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

  /// Create a copy of ConfigUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigUpdateAudioImplCopyWith<_$ConfigUpdateAudioImpl> get copyWith =>
      __$$ConfigUpdateAudioImplCopyWithImpl<_$ConfigUpdateAudioImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigUpdateAudioImplToJson(
      this,
    );
  }
}

abstract class _ConfigUpdateAudio implements ConfigUpdateAudio {
  const factory _ConfigUpdateAudio(
      {required final ConfigUpdateAudioType type,
      required final bool speaker,
      @JsonKey(name: 'speaker_volume') required final int speakerVolume,
      required final bool microphone,
      @JsonKey(name: 'microphone_volume')
      required final int microphoneVolume}) = _$ConfigUpdateAudioImpl;

  factory _ConfigUpdateAudio.fromJson(Map<String, dynamic> json) =
      _$ConfigUpdateAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateAudioType get type;

  /// Enables or disables the speaker.
  @override
  bool get speaker;

  /// Sets the speaker volume (0-100).
  @override
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume;

  /// Enables or disables the microphone.
  @override
  bool get microphone;

  /// Sets the microphone volume (0-100).
  @override
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume;

  /// Create a copy of ConfigUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigUpdateAudioImplCopyWith<_$ConfigUpdateAudioImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
