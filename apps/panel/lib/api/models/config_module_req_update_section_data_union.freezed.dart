// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_req_update_section_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleReqUpdateSectionDataUnion
    _$ConfigModuleReqUpdateSectionDataUnionFromJson(Map<String, dynamic> json) {
  switch (json['type']) {
    case 'audio':
      return ConfigModuleReqUpdateSectionDataUnionAudio.fromJson(json);
    case 'display':
      return ConfigModuleReqUpdateSectionDataUnionDisplay.fromJson(json);
    case 'language':
      return ConfigModuleReqUpdateSectionDataUnionLanguage.fromJson(json);
    case 'weather':
      return ConfigModuleReqUpdateSectionDataUnionWeather.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'ConfigModuleReqUpdateSectionDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$ConfigModuleReqUpdateSectionDataUnion {
  /// Configuration section type
  Enum get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)
        audio,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionWeather value)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleReqUpdateSectionDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res> {
  factory $ConfigModuleReqUpdateSectionDataUnionCopyWith(
          ConfigModuleReqUpdateSectionDataUnion value,
          $Res Function(ConfigModuleReqUpdateSectionDataUnion) then) =
      _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
          ConfigModuleReqUpdateSectionDataUnion>;
}

/// @nodoc
class _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
        $Val extends ConfigModuleReqUpdateSectionDataUnion>
    implements $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res> {
  _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWith<$Res> {
  factory _$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWith(
          _$ConfigModuleReqUpdateSectionDataUnionAudioImpl value,
          $Res Function(_$ConfigModuleReqUpdateSectionDataUnionAudioImpl)
              then) =
      __$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleReqUpdateSectionDataUnionAudioImpl>
    implements _$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWithImpl(
      _$ConfigModuleReqUpdateSectionDataUnionAudioImpl _value,
      $Res Function(_$ConfigModuleReqUpdateSectionDataUnionAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
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
    return _then(_$ConfigModuleReqUpdateSectionDataUnionAudioImpl(
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
class _$ConfigModuleReqUpdateSectionDataUnionAudioImpl
    implements ConfigModuleReqUpdateSectionDataUnionAudio {
  const _$ConfigModuleReqUpdateSectionDataUnionAudioImpl(
      {required this.type,
      required this.speaker,
      @JsonKey(name: 'speaker_volume') required this.speakerVolume,
      required this.microphone,
      @JsonKey(name: 'microphone_volume') required this.microphoneVolume});

  factory _$ConfigModuleReqUpdateSectionDataUnionAudioImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdateSectionDataUnionAudioImplFromJson(json);

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
    return 'ConfigModuleReqUpdateSectionDataUnion.audio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdateSectionDataUnionAudioImpl &&
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

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionAudioImpl>
      get copyWith =>
          __$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWithImpl<
                  _$ConfigModuleReqUpdateSectionDataUnionAudioImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) {
    return audio(type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) {
    return audio?.call(
        type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) {
    if (audio != null) {
      return audio(type, speaker, speakerVolume, microphone, microphoneVolume);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)
        audio,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return audio(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
  }) {
    return audio?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
    required TResult orElse(),
  }) {
    if (audio != null) {
      return audio(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdateSectionDataUnionAudioImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleReqUpdateSectionDataUnionAudio
    implements ConfigModuleReqUpdateSectionDataUnion {
  const factory ConfigModuleReqUpdateSectionDataUnionAudio(
          {required final ConfigModuleUpdateAudioType type,
          required final bool speaker,
          @JsonKey(name: 'speaker_volume') required final int speakerVolume,
          required final bool microphone,
          @JsonKey(name: 'microphone_volume')
          required final int microphoneVolume}) =
      _$ConfigModuleReqUpdateSectionDataUnionAudioImpl;

  factory ConfigModuleReqUpdateSectionDataUnionAudio.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleReqUpdateSectionDataUnionAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateAudioType get type;

  /// Enables or disables the speaker.
  bool get speaker;

  /// Sets the speaker volume (0-100).
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume;

  /// Enables or disables the microphone.
  bool get microphone;

  /// Sets the microphone volume (0-100).
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume;

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdateSectionDataUnionAudioImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionAudioImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWith<
    $Res> {
  factory _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWith(
          _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl value,
          $Res Function(_$ConfigModuleReqUpdateSectionDataUnionDisplayImpl)
              then) =
      __$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl>
    implements
        _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWithImpl(
      _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl _value,
      $Res Function(_$ConfigModuleReqUpdateSectionDataUnionDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? darkMode = null,
    Object? brightness = null,
    Object? screenLockDuration = null,
    Object? screenSaver = null,
  }) {
    return _then(_$ConfigModuleReqUpdateSectionDataUnionDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateDisplayType,
      darkMode: null == darkMode
          ? _value.darkMode
          : darkMode // ignore: cast_nullable_to_non_nullable
              as bool,
      brightness: null == brightness
          ? _value.brightness
          : brightness // ignore: cast_nullable_to_non_nullable
              as int,
      screenLockDuration: null == screenLockDuration
          ? _value.screenLockDuration
          : screenLockDuration // ignore: cast_nullable_to_non_nullable
              as int,
      screenSaver: null == screenSaver
          ? _value.screenSaver
          : screenSaver // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl
    implements ConfigModuleReqUpdateSectionDataUnionDisplay {
  const _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl(
      {required this.type,
      @JsonKey(name: 'dark_mode') required this.darkMode,
      required this.brightness,
      @JsonKey(name: 'screen_lock_duration') required this.screenLockDuration,
      @JsonKey(name: 'screen_saver') required this.screenSaver});

  factory _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateDisplayType type;

  /// Enables or disables dark mode.
  @override
  @JsonKey(name: 'dark_mode')
  final bool darkMode;

  /// Sets the brightness level (0-100).
  @override
  final int brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  final int screenLockDuration;

  /// Enables or disables the screen saver.
  @override
  @JsonKey(name: 'screen_saver')
  final bool screenSaver;

  @override
  String toString() {
    return 'ConfigModuleReqUpdateSectionDataUnion.display(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.darkMode, darkMode) ||
                other.darkMode == darkMode) &&
            (identical(other.brightness, brightness) ||
                other.brightness == brightness) &&
            (identical(other.screenLockDuration, screenLockDuration) ||
                other.screenLockDuration == screenLockDuration) &&
            (identical(other.screenSaver, screenSaver) ||
                other.screenSaver == screenSaver));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, type, darkMode, brightness, screenLockDuration, screenSaver);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl>
      get copyWith =>
          __$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWithImpl<
                  _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) {
    return display(type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) {
    return display?.call(
        type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) {
    if (display != null) {
      return display(
          type, darkMode, brightness, screenLockDuration, screenSaver);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)
        audio,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return display(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
  }) {
    return display?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
    required TResult orElse(),
  }) {
    if (display != null) {
      return display(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleReqUpdateSectionDataUnionDisplay
    implements ConfigModuleReqUpdateSectionDataUnion {
  const factory ConfigModuleReqUpdateSectionDataUnionDisplay(
          {required final ConfigModuleUpdateDisplayType type,
          @JsonKey(name: 'dark_mode') required final bool darkMode,
          required final int brightness,
          @JsonKey(name: 'screen_lock_duration')
          required final int screenLockDuration,
          @JsonKey(name: 'screen_saver') required final bool screenSaver}) =
      _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl;

  factory ConfigModuleReqUpdateSectionDataUnionDisplay.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateDisplayType get type;

  /// Enables or disables dark mode.
  @JsonKey(name: 'dark_mode')
  bool get darkMode;

  /// Sets the brightness level (0-100).
  int get brightness;

  /// Time in seconds before the screen automatically locks.
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration;

  /// Enables or disables the screen saver.
  @JsonKey(name: 'screen_saver')
  bool get screenSaver;

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWith<
    $Res> {
  factory _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWith(
          _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl value,
          $Res Function(_$ConfigModuleReqUpdateSectionDataUnionLanguageImpl)
              then) =
      __$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleUpdateLanguageType type,
      ConfigModuleUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format')
      ConfigModuleUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl>
    implements
        _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWithImpl(
      _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl _value,
      $Res Function(_$ConfigModuleReqUpdateSectionDataUnionLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigModuleReqUpdateSectionDataUnionLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl
    implements ConfigModuleReqUpdateSectionDataUnionLanguage {
  const _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl(
      {required this.type,
      required this.language,
      required this.timezone,
      @JsonKey(name: 'time_format') required this.timeFormat});

  factory _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateLanguageType type;

  /// Defines the language and region format.
  @override
  final ConfigModuleUpdateLanguageLanguage language;

  /// Defines the time zone using the IANA time zone format.
  @override
  final String timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  final ConfigModuleUpdateLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigModuleReqUpdateSectionDataUnion.language(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.timezone, timezone) ||
                other.timezone == timezone) &&
            (identical(other.timeFormat, timeFormat) ||
                other.timeFormat == timeFormat));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, language, timezone, timeFormat);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl>
      get copyWith =>
          __$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWithImpl<
                  _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) {
    return language(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) {
    return language?.call(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) {
    if (language != null) {
      return language(type, this.language, timezone, timeFormat);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)
        audio,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return language(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
  }) {
    return language?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
    required TResult orElse(),
  }) {
    if (language != null) {
      return language(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleReqUpdateSectionDataUnionLanguage
    implements ConfigModuleReqUpdateSectionDataUnion {
  const factory ConfigModuleReqUpdateSectionDataUnionLanguage(
          {required final ConfigModuleUpdateLanguageType type,
          required final ConfigModuleUpdateLanguageLanguage language,
          required final String timezone,
          @JsonKey(name: 'time_format')
          required final ConfigModuleUpdateLanguageTimeFormat timeFormat}) =
      _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl;

  factory ConfigModuleReqUpdateSectionDataUnionLanguage.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateLanguageType get type;

  /// Defines the language and region format.
  ConfigModuleUpdateLanguageLanguage get language;

  /// Defines the time zone using the IANA time zone format.
  String get timezone;

  /// Sets the time format (12-hour or 24-hour).
  @JsonKey(name: 'time_format')
  ConfigModuleUpdateLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWith<
    $Res> {
  factory _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWith(
          _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl value,
          $Res Function(_$ConfigModuleReqUpdateSectionDataUnionWeatherImpl)
              then) =
      __$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleUpdateWeatherType type,
      @JsonKey(name: 'location_type')
      ConfigModuleUpdateWeatherLocationType locationType,
      ConfigModuleUpdateWeatherUnit unit,
      String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey});
}

/// @nodoc
class __$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl>
    implements
        _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWithImpl(
      _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl _value,
      $Res Function(_$ConfigModuleReqUpdateSectionDataUnionWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? locationType = null,
    Object? unit = null,
    Object? location = freezed,
    Object? openWeatherApiKey = freezed,
  }) {
    return _then(_$ConfigModuleReqUpdateSectionDataUnionWeatherImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateWeatherType,
      locationType: null == locationType
          ? _value.locationType
          : locationType // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateWeatherLocationType,
      unit: null == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateWeatherUnit,
      location: freezed == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as String?,
      openWeatherApiKey: freezed == openWeatherApiKey
          ? _value.openWeatherApiKey
          : openWeatherApiKey // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl
    implements ConfigModuleReqUpdateSectionDataUnionWeather {
  const _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl(
      {required this.type,
      @JsonKey(name: 'location_type') required this.locationType,
      required this.unit,
      this.location,
      @JsonKey(name: 'open_weather_api_key') this.openWeatherApiKey});

  factory _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateWeatherType type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  final ConfigModuleUpdateWeatherLocationType locationType;

  /// Defines the temperature unit for weather data.
  @override
  final ConfigModuleUpdateWeatherUnit unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  final String? location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  final String? openWeatherApiKey;

  @override
  String toString() {
    return 'ConfigModuleReqUpdateSectionDataUnion.weather(type: $type, locationType: $locationType, unit: $unit, location: $location, openWeatherApiKey: $openWeatherApiKey)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.locationType, locationType) ||
                other.locationType == locationType) &&
            (identical(other.unit, unit) || other.unit == unit) &&
            (identical(other.location, location) ||
                other.location == location) &&
            (identical(other.openWeatherApiKey, openWeatherApiKey) ||
                other.openWeatherApiKey == openWeatherApiKey));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, type, locationType, unit, location, openWeatherApiKey);

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl>
      get copyWith =>
          __$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWithImpl<
                  _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) {
    return weather(type, locationType, unit, location, openWeatherApiKey);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) {
    return weather?.call(type, locationType, unit, location, openWeatherApiKey);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleUpdateLanguageType type,
            ConfigModuleUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigModuleUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleUpdateWeatherLocationType locationType,
            ConfigModuleUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(type, locationType, unit, location, openWeatherApiKey);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)
        audio,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(
            ConfigModuleReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return weather(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult? Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
  }) {
    return weather?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionDisplay value)?
        display,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionLanguage value)?
        language,
    TResult Function(ConfigModuleReqUpdateSectionDataUnionWeather value)?
        weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleReqUpdateSectionDataUnionWeather
    implements ConfigModuleReqUpdateSectionDataUnion {
  const factory ConfigModuleReqUpdateSectionDataUnionWeather(
          {required final ConfigModuleUpdateWeatherType type,
          @JsonKey(name: 'location_type')
          required final ConfigModuleUpdateWeatherLocationType locationType,
          required final ConfigModuleUpdateWeatherUnit unit,
          final String? location,
          @JsonKey(name: 'open_weather_api_key')
          final String? openWeatherApiKey}) =
      _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl;

  factory ConfigModuleReqUpdateSectionDataUnionWeather.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigModuleUpdateWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  ConfigModuleUpdateWeatherUnit get unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Create a copy of ConfigModuleReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplCopyWith<
          _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
