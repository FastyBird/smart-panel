// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_req_update_section_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigReqUpdateSectionDataUnion _$ConfigReqUpdateSectionDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'audio':
      return ConfigReqUpdateSectionDataUnionAudio.fromJson(json);
    case 'display':
      return ConfigReqUpdateSectionDataUnionDisplay.fromJson(json);
    case 'language':
      return ConfigReqUpdateSectionDataUnionLanguage.fromJson(json);
    case 'weather':
      return ConfigReqUpdateSectionDataUnionWeather.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'ConfigReqUpdateSectionDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$ConfigReqUpdateSectionDataUnion {
  /// Configuration section type
  Enum get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey)?
        weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigReqUpdateSectionDataUnionAudio value) audio,
    required TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigReqUpdateSectionDataUnionWeather value)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigReqUpdateSectionDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigReqUpdateSectionDataUnionCopyWith<$Res> {
  factory $ConfigReqUpdateSectionDataUnionCopyWith(
          ConfigReqUpdateSectionDataUnion value,
          $Res Function(ConfigReqUpdateSectionDataUnion) then) =
      _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
          ConfigReqUpdateSectionDataUnion>;
}

/// @nodoc
class _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
        $Val extends ConfigReqUpdateSectionDataUnion>
    implements $ConfigReqUpdateSectionDataUnionCopyWith<$Res> {
  _$ConfigReqUpdateSectionDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$ConfigReqUpdateSectionDataUnionAudioImplCopyWith<$Res> {
  factory _$$ConfigReqUpdateSectionDataUnionAudioImplCopyWith(
          _$ConfigReqUpdateSectionDataUnionAudioImpl value,
          $Res Function(_$ConfigReqUpdateSectionDataUnionAudioImpl) then) =
      __$$ConfigReqUpdateSectionDataUnionAudioImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigUpdateAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigReqUpdateSectionDataUnionAudioImplCopyWithImpl<$Res>
    extends _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigReqUpdateSectionDataUnionAudioImpl>
    implements _$$ConfigReqUpdateSectionDataUnionAudioImplCopyWith<$Res> {
  __$$ConfigReqUpdateSectionDataUnionAudioImplCopyWithImpl(
      _$ConfigReqUpdateSectionDataUnionAudioImpl _value,
      $Res Function(_$ConfigReqUpdateSectionDataUnionAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigReqUpdateSectionDataUnion
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
    return _then(_$ConfigReqUpdateSectionDataUnionAudioImpl(
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
class _$ConfigReqUpdateSectionDataUnionAudioImpl
    implements ConfigReqUpdateSectionDataUnionAudio {
  const _$ConfigReqUpdateSectionDataUnionAudioImpl(
      {required this.type,
      required this.speaker,
      @JsonKey(name: 'speaker_volume') required this.speakerVolume,
      required this.microphone,
      @JsonKey(name: 'microphone_volume') required this.microphoneVolume});

  factory _$ConfigReqUpdateSectionDataUnionAudioImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigReqUpdateSectionDataUnionAudioImplFromJson(json);

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
    return 'ConfigReqUpdateSectionDataUnion.audio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigReqUpdateSectionDataUnionAudioImpl &&
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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigReqUpdateSectionDataUnionAudioImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionAudioImpl>
      get copyWith => __$$ConfigReqUpdateSectionDataUnionAudioImplCopyWithImpl<
          _$ConfigReqUpdateSectionDataUnionAudioImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
    required TResult Function(ConfigReqUpdateSectionDataUnionAudio value) audio,
    required TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return audio(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
  }) {
    return audio?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (audio != null) {
      return audio(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigReqUpdateSectionDataUnionAudioImplToJson(
      this,
    );
  }
}

abstract class ConfigReqUpdateSectionDataUnionAudio
    implements ConfigReqUpdateSectionDataUnion {
  const factory ConfigReqUpdateSectionDataUnionAudio(
          {required final ConfigUpdateAudioType type,
          required final bool speaker,
          @JsonKey(name: 'speaker_volume') required final int speakerVolume,
          required final bool microphone,
          @JsonKey(name: 'microphone_volume')
          required final int microphoneVolume}) =
      _$ConfigReqUpdateSectionDataUnionAudioImpl;

  factory ConfigReqUpdateSectionDataUnionAudio.fromJson(
          Map<String, dynamic> json) =
      _$ConfigReqUpdateSectionDataUnionAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateAudioType get type;

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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigReqUpdateSectionDataUnionAudioImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionAudioImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWith<$Res> {
  factory _$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWith(
          _$ConfigReqUpdateSectionDataUnionDisplayImpl value,
          $Res Function(_$ConfigReqUpdateSectionDataUnionDisplayImpl) then) =
      __$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWithImpl<$Res>
    extends _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigReqUpdateSectionDataUnionDisplayImpl>
    implements _$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWith<$Res> {
  __$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWithImpl(
      _$ConfigReqUpdateSectionDataUnionDisplayImpl _value,
      $Res Function(_$ConfigReqUpdateSectionDataUnionDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigReqUpdateSectionDataUnion
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
    return _then(_$ConfigReqUpdateSectionDataUnionDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateDisplayType,
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
class _$ConfigReqUpdateSectionDataUnionDisplayImpl
    implements ConfigReqUpdateSectionDataUnionDisplay {
  const _$ConfigReqUpdateSectionDataUnionDisplayImpl(
      {required this.type,
      @JsonKey(name: 'dark_mode') required this.darkMode,
      required this.brightness,
      @JsonKey(name: 'screen_lock_duration') required this.screenLockDuration,
      @JsonKey(name: 'screen_saver') required this.screenSaver});

  factory _$ConfigReqUpdateSectionDataUnionDisplayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigReqUpdateSectionDataUnionDisplayImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateDisplayType type;

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
    return 'ConfigReqUpdateSectionDataUnion.display(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigReqUpdateSectionDataUnionDisplayImpl &&
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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionDisplayImpl>
      get copyWith =>
          __$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWithImpl<
              _$ConfigReqUpdateSectionDataUnionDisplayImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
    required TResult Function(ConfigReqUpdateSectionDataUnionAudio value) audio,
    required TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return display(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
  }) {
    return display?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (display != null) {
      return display(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigReqUpdateSectionDataUnionDisplayImplToJson(
      this,
    );
  }
}

abstract class ConfigReqUpdateSectionDataUnionDisplay
    implements ConfigReqUpdateSectionDataUnion {
  const factory ConfigReqUpdateSectionDataUnionDisplay(
          {required final ConfigUpdateDisplayType type,
          @JsonKey(name: 'dark_mode') required final bool darkMode,
          required final int brightness,
          @JsonKey(name: 'screen_lock_duration')
          required final int screenLockDuration,
          @JsonKey(name: 'screen_saver') required final bool screenSaver}) =
      _$ConfigReqUpdateSectionDataUnionDisplayImpl;

  factory ConfigReqUpdateSectionDataUnionDisplay.fromJson(
          Map<String, dynamic> json) =
      _$ConfigReqUpdateSectionDataUnionDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateDisplayType get type;

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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigReqUpdateSectionDataUnionDisplayImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionDisplayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWith<$Res> {
  factory _$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWith(
          _$ConfigReqUpdateSectionDataUnionLanguageImpl value,
          $Res Function(_$ConfigReqUpdateSectionDataUnionLanguageImpl) then) =
      __$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigUpdateLanguageType type,
      ConfigUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWithImpl<$Res>
    extends _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigReqUpdateSectionDataUnionLanguageImpl>
    implements _$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWith<$Res> {
  __$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWithImpl(
      _$ConfigReqUpdateSectionDataUnionLanguageImpl _value,
      $Res Function(_$ConfigReqUpdateSectionDataUnionLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigReqUpdateSectionDataUnionLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigReqUpdateSectionDataUnionLanguageImpl
    implements ConfigReqUpdateSectionDataUnionLanguage {
  const _$ConfigReqUpdateSectionDataUnionLanguageImpl(
      {required this.type,
      required this.language,
      required this.timezone,
      @JsonKey(name: 'time_format') required this.timeFormat});

  factory _$ConfigReqUpdateSectionDataUnionLanguageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigReqUpdateSectionDataUnionLanguageImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateLanguageType type;

  /// Defines the language and region format.
  @override
  final ConfigUpdateLanguageLanguage language;

  /// Defines the time zone using the IANA time zone format.
  @override
  final String timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  final ConfigUpdateLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigReqUpdateSectionDataUnion.language(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigReqUpdateSectionDataUnionLanguageImpl &&
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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionLanguageImpl>
      get copyWith =>
          __$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWithImpl<
              _$ConfigReqUpdateSectionDataUnionLanguageImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
    required TResult Function(ConfigReqUpdateSectionDataUnionAudio value) audio,
    required TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return language(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
  }) {
    return language?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (language != null) {
      return language(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigReqUpdateSectionDataUnionLanguageImplToJson(
      this,
    );
  }
}

abstract class ConfigReqUpdateSectionDataUnionLanguage
    implements ConfigReqUpdateSectionDataUnion {
  const factory ConfigReqUpdateSectionDataUnionLanguage(
          {required final ConfigUpdateLanguageType type,
          required final ConfigUpdateLanguageLanguage language,
          required final String timezone,
          @JsonKey(name: 'time_format')
          required final ConfigUpdateLanguageTimeFormat timeFormat}) =
      _$ConfigReqUpdateSectionDataUnionLanguageImpl;

  factory ConfigReqUpdateSectionDataUnionLanguage.fromJson(
          Map<String, dynamic> json) =
      _$ConfigReqUpdateSectionDataUnionLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateLanguageType get type;

  /// Defines the language and region format.
  ConfigUpdateLanguageLanguage get language;

  /// Defines the time zone using the IANA time zone format.
  String get timezone;

  /// Sets the time format (12-hour or 24-hour).
  @JsonKey(name: 'time_format')
  ConfigUpdateLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigReqUpdateSectionDataUnionLanguageImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWith<$Res> {
  factory _$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWith(
          _$ConfigReqUpdateSectionDataUnionWeatherImpl value,
          $Res Function(_$ConfigReqUpdateSectionDataUnionWeatherImpl) then) =
      __$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigUpdateWeatherType type,
      @JsonKey(name: 'location_type')
      ConfigUpdateWeatherLocationType locationType,
      ConfigUpdateWeatherUnit unit,
      String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey});
}

/// @nodoc
class __$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWithImpl<$Res>
    extends _$ConfigReqUpdateSectionDataUnionCopyWithImpl<$Res,
        _$ConfigReqUpdateSectionDataUnionWeatherImpl>
    implements _$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWith<$Res> {
  __$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWithImpl(
      _$ConfigReqUpdateSectionDataUnionWeatherImpl _value,
      $Res Function(_$ConfigReqUpdateSectionDataUnionWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigReqUpdateSectionDataUnion
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
    return _then(_$ConfigReqUpdateSectionDataUnionWeatherImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateWeatherType,
      locationType: null == locationType
          ? _value.locationType
          : locationType // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateWeatherLocationType,
      unit: null == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateWeatherUnit,
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
class _$ConfigReqUpdateSectionDataUnionWeatherImpl
    implements ConfigReqUpdateSectionDataUnionWeather {
  const _$ConfigReqUpdateSectionDataUnionWeatherImpl(
      {required this.type,
      @JsonKey(name: 'location_type') required this.locationType,
      required this.unit,
      this.location,
      @JsonKey(name: 'open_weather_api_key') this.openWeatherApiKey});

  factory _$ConfigReqUpdateSectionDataUnionWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigReqUpdateSectionDataUnionWeatherImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateWeatherType type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  final ConfigUpdateWeatherLocationType locationType;

  /// Defines the temperature unit for weather data.
  @override
  final ConfigUpdateWeatherUnit unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  final String? location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  final String? openWeatherApiKey;

  @override
  String toString() {
    return 'ConfigReqUpdateSectionDataUnion.weather(type: $type, locationType: $locationType, unit: $unit, location: $location, openWeatherApiKey: $openWeatherApiKey)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigReqUpdateSectionDataUnionWeatherImpl &&
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

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionWeatherImpl>
      get copyWith =>
          __$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWithImpl<
              _$ConfigReqUpdateSectionDataUnionWeatherImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
            ConfigUpdateAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigUpdateDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigUpdateLanguageType type,
            ConfigUpdateLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigUpdateLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            ConfigUpdateWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigUpdateWeatherLocationType locationType,
            ConfigUpdateWeatherUnit unit,
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
    required TResult Function(ConfigReqUpdateSectionDataUnionAudio value) audio,
    required TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigReqUpdateSectionDataUnionWeather value)
        weather,
  }) {
    return weather(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
  }) {
    return weather?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigReqUpdateSectionDataUnionAudio value)? audio,
    TResult Function(ConfigReqUpdateSectionDataUnionDisplay value)? display,
    TResult Function(ConfigReqUpdateSectionDataUnionLanguage value)? language,
    TResult Function(ConfigReqUpdateSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigReqUpdateSectionDataUnionWeatherImplToJson(
      this,
    );
  }
}

abstract class ConfigReqUpdateSectionDataUnionWeather
    implements ConfigReqUpdateSectionDataUnion {
  const factory ConfigReqUpdateSectionDataUnionWeather(
          {required final ConfigUpdateWeatherType type,
          @JsonKey(name: 'location_type')
          required final ConfigUpdateWeatherLocationType locationType,
          required final ConfigUpdateWeatherUnit unit,
          final String? location,
          @JsonKey(name: 'open_weather_api_key')
          final String? openWeatherApiKey}) =
      _$ConfigReqUpdateSectionDataUnionWeatherImpl;

  factory ConfigReqUpdateSectionDataUnionWeather.fromJson(
          Map<String, dynamic> json) =
      _$ConfigReqUpdateSectionDataUnionWeatherImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigUpdateWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  ConfigUpdateWeatherUnit get unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Create a copy of ConfigReqUpdateSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigReqUpdateSectionDataUnionWeatherImplCopyWith<
          _$ConfigReqUpdateSectionDataUnionWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
