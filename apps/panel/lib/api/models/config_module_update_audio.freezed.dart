// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_update_audio.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleUpdateAudio _$ConfigModuleUpdateAudioFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleUpdateAudio.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleUpdateAudio {
  /// Configuration section type
  ConfigModuleUpdateAudioType get type => throw _privateConstructorUsedError;

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

  /// Serializes this ConfigModuleUpdateAudio to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleUpdateAudioCopyWith<ConfigModuleUpdateAudio> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleUpdateAudioCopyWith<$Res> {
  factory $ConfigModuleUpdateAudioCopyWith(ConfigModuleUpdateAudio value,
          $Res Function(ConfigModuleUpdateAudio) then) =
      _$ConfigModuleUpdateAudioCopyWithImpl<$Res, ConfigModuleUpdateAudio>;
  @useResult
  $Res call(
      {ConfigModuleUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class _$ConfigModuleUpdateAudioCopyWithImpl<$Res,
        $Val extends ConfigModuleUpdateAudio>
    implements $ConfigModuleUpdateAudioCopyWith<$Res> {
  _$ConfigModuleUpdateAudioCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleUpdateAudio
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
              as ConfigModuleUpdateAudioType,
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
abstract class _$$ConfigModuleUpdateAudioImplCopyWith<$Res>
    implements $ConfigModuleUpdateAudioCopyWith<$Res> {
  factory _$$ConfigModuleUpdateAudioImplCopyWith(
          _$ConfigModuleUpdateAudioImpl value,
          $Res Function(_$ConfigModuleUpdateAudioImpl) then) =
      __$$ConfigModuleUpdateAudioImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigModuleUpdateAudioImplCopyWithImpl<$Res>
    extends _$ConfigModuleUpdateAudioCopyWithImpl<$Res,
        _$ConfigModuleUpdateAudioImpl>
    implements _$$ConfigModuleUpdateAudioImplCopyWith<$Res> {
  __$$ConfigModuleUpdateAudioImplCopyWithImpl(
      _$ConfigModuleUpdateAudioImpl _value,
      $Res Function(_$ConfigModuleUpdateAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleUpdateAudio
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
    return _then(_$ConfigModuleUpdateAudioImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateAudioType,
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
class _$ConfigModuleUpdateAudioImpl implements _ConfigModuleUpdateAudio {
  const _$ConfigModuleUpdateAudioImpl(
      {required this.type,
      required this.speaker,
      @JsonKey(name: 'speaker_volume') required this.speakerVolume,
      required this.microphone,
      @JsonKey(name: 'microphone_volume') required this.microphoneVolume});

  factory _$ConfigModuleUpdateAudioImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleUpdateAudioImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateAudioType type;

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
    return 'ConfigModuleUpdateAudio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleUpdateAudioImpl &&
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

  /// Create a copy of ConfigModuleUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleUpdateAudioImplCopyWith<_$ConfigModuleUpdateAudioImpl>
      get copyWith => __$$ConfigModuleUpdateAudioImplCopyWithImpl<
          _$ConfigModuleUpdateAudioImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleUpdateAudioImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleUpdateAudio implements ConfigModuleUpdateAudio {
  const factory _ConfigModuleUpdateAudio(
      {required final ConfigModuleUpdateAudioType type,
      required final bool speaker,
      @JsonKey(name: 'speaker_volume') required final int speakerVolume,
      required final bool microphone,
      @JsonKey(name: 'microphone_volume')
      required final int microphoneVolume}) = _$ConfigModuleUpdateAudioImpl;

  factory _ConfigModuleUpdateAudio.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleUpdateAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateAudioType get type;

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

  /// Create a copy of ConfigModuleUpdateAudio
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleUpdateAudioImplCopyWith<_$ConfigModuleUpdateAudioImpl>
      get copyWith => throw _privateConstructorUsedError;
}
