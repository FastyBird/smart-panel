// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_res_section_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleResSectionDataUnion _$ConfigModuleResSectionDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'audio':
      return ConfigModuleResSectionDataUnionAudio.fromJson(json);
    case 'display':
      return ConfigModuleResSectionDataUnionDisplay.fromJson(json);
    case 'language':
      return ConfigModuleResSectionDataUnionLanguage.fromJson(json);
    case 'weather':
      return ConfigModuleResSectionDataUnionWeather.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'ConfigModuleResSectionDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$ConfigModuleResSectionDataUnion {
  /// Configuration section type
  Enum get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigModuleResSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigModuleResSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigModuleResSectionDataUnionWeather value)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigModuleResSectionDataUnionWeather value)? weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigModuleResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleResSectionDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleResSectionDataUnionCopyWith<$Res> {
  factory $ConfigModuleResSectionDataUnionCopyWith(
          ConfigModuleResSectionDataUnion value,
          $Res Function(ConfigModuleResSectionDataUnion) then) =
      _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
          ConfigModuleResSectionDataUnion>;
}

/// @nodoc
class _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
        $Val extends ConfigModuleResSectionDataUnion>
    implements $ConfigModuleResSectionDataUnionCopyWith<$Res> {
  _$ConfigModuleResSectionDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$ConfigModuleResSectionDataUnionAudioImplCopyWith<$Res> {
  factory _$$ConfigModuleResSectionDataUnionAudioImplCopyWith(
          _$ConfigModuleResSectionDataUnionAudioImpl value,
          $Res Function(_$ConfigModuleResSectionDataUnionAudioImpl) then) =
      __$$ConfigModuleResSectionDataUnionAudioImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigModuleResSectionDataUnionAudioImplCopyWithImpl<$Res>
    extends _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleResSectionDataUnionAudioImpl>
    implements _$$ConfigModuleResSectionDataUnionAudioImplCopyWith<$Res> {
  __$$ConfigModuleResSectionDataUnionAudioImplCopyWithImpl(
      _$ConfigModuleResSectionDataUnionAudioImpl _value,
      $Res Function(_$ConfigModuleResSectionDataUnionAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleResSectionDataUnion
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
    return _then(_$ConfigModuleResSectionDataUnionAudioImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleAudioType,
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
class _$ConfigModuleResSectionDataUnionAudioImpl
    implements ConfigModuleResSectionDataUnionAudio {
  const _$ConfigModuleResSectionDataUnionAudioImpl(
      {this.type = ConfigModuleAudioType.audio,
      this.speaker = false,
      @JsonKey(name: 'speaker_volume') this.speakerVolume = 0,
      this.microphone = false,
      @JsonKey(name: 'microphone_volume') this.microphoneVolume = 0});

  factory _$ConfigModuleResSectionDataUnionAudioImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleResSectionDataUnionAudioImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleAudioType type;

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
    return 'ConfigModuleResSectionDataUnion.audio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleResSectionDataUnionAudioImpl &&
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

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleResSectionDataUnionAudioImplCopyWith<
          _$ConfigModuleResSectionDataUnionAudioImpl>
      get copyWith => __$$ConfigModuleResSectionDataUnionAudioImplCopyWithImpl<
          _$ConfigModuleResSectionDataUnionAudioImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)
        weather,
  }) {
    return audio(type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
  }) {
    return audio?.call(
        type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
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
    required TResult Function(ConfigModuleResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigModuleResSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigModuleResSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigModuleResSectionDataUnionWeather value)
        weather,
  }) {
    return audio(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigModuleResSectionDataUnionWeather value)? weather,
  }) {
    return audio?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigModuleResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (audio != null) {
      return audio(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleResSectionDataUnionAudioImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleResSectionDataUnionAudio
    implements ConfigModuleResSectionDataUnion {
  const factory ConfigModuleResSectionDataUnionAudio(
          {final ConfigModuleAudioType type,
          final bool speaker,
          @JsonKey(name: 'speaker_volume') final int speakerVolume,
          final bool microphone,
          @JsonKey(name: 'microphone_volume') final int microphoneVolume}) =
      _$ConfigModuleResSectionDataUnionAudioImpl;

  factory ConfigModuleResSectionDataUnionAudio.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleResSectionDataUnionAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleAudioType get type;

  /// Indicates whether the speaker is enabled.
  bool get speaker;

  /// The volume level of the speaker, ranging from 0 to 100.
  @JsonKey(name: 'speaker_volume')
  int get speakerVolume;

  /// Indicates whether the microphone is enabled.
  bool get microphone;

  /// The volume level of the microphone, ranging from 0 to 100.
  @JsonKey(name: 'microphone_volume')
  int get microphoneVolume;

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleResSectionDataUnionAudioImplCopyWith<
          _$ConfigModuleResSectionDataUnionAudioImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleResSectionDataUnionDisplayImplCopyWith<$Res> {
  factory _$$ConfigModuleResSectionDataUnionDisplayImplCopyWith(
          _$ConfigModuleResSectionDataUnionDisplayImpl value,
          $Res Function(_$ConfigModuleResSectionDataUnionDisplayImpl) then) =
      __$$ConfigModuleResSectionDataUnionDisplayImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigModuleResSectionDataUnionDisplayImplCopyWithImpl<$Res>
    extends _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleResSectionDataUnionDisplayImpl>
    implements _$$ConfigModuleResSectionDataUnionDisplayImplCopyWith<$Res> {
  __$$ConfigModuleResSectionDataUnionDisplayImplCopyWithImpl(
      _$ConfigModuleResSectionDataUnionDisplayImpl _value,
      $Res Function(_$ConfigModuleResSectionDataUnionDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleResSectionDataUnion
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
    return _then(_$ConfigModuleResSectionDataUnionDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleDisplayType,
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
class _$ConfigModuleResSectionDataUnionDisplayImpl
    implements ConfigModuleResSectionDataUnionDisplay {
  const _$ConfigModuleResSectionDataUnionDisplayImpl(
      {this.type = ConfigModuleDisplayType.display,
      @JsonKey(name: 'dark_mode') this.darkMode = false,
      this.brightness = 0,
      @JsonKey(name: 'screen_lock_duration') this.screenLockDuration = 30,
      @JsonKey(name: 'screen_saver') this.screenSaver = true});

  factory _$ConfigModuleResSectionDataUnionDisplayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleResSectionDataUnionDisplayImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleDisplayType type;

  /// Enables dark mode for the display.
  @override
  @JsonKey(name: 'dark_mode')
  final bool darkMode;

  /// Sets the brightness level of the display (0-100).
  @override
  @JsonKey()
  final int brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  final int screenLockDuration;

  /// Enables the screen saver when the device is idle. Value is in seconds.
  @override
  @JsonKey(name: 'screen_saver')
  final bool screenSaver;

  @override
  String toString() {
    return 'ConfigModuleResSectionDataUnion.display(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleResSectionDataUnionDisplayImpl &&
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

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleResSectionDataUnionDisplayImplCopyWith<
          _$ConfigModuleResSectionDataUnionDisplayImpl>
      get copyWith =>
          __$$ConfigModuleResSectionDataUnionDisplayImplCopyWithImpl<
              _$ConfigModuleResSectionDataUnionDisplayImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)
        weather,
  }) {
    return display(type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
  }) {
    return display?.call(
        type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
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
    required TResult Function(ConfigModuleResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigModuleResSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigModuleResSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigModuleResSectionDataUnionWeather value)
        weather,
  }) {
    return display(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigModuleResSectionDataUnionWeather value)? weather,
  }) {
    return display?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigModuleResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (display != null) {
      return display(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleResSectionDataUnionDisplayImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleResSectionDataUnionDisplay
    implements ConfigModuleResSectionDataUnion {
  const factory ConfigModuleResSectionDataUnionDisplay(
          {final ConfigModuleDisplayType type,
          @JsonKey(name: 'dark_mode') final bool darkMode,
          final int brightness,
          @JsonKey(name: 'screen_lock_duration') final int screenLockDuration,
          @JsonKey(name: 'screen_saver') final bool screenSaver}) =
      _$ConfigModuleResSectionDataUnionDisplayImpl;

  factory ConfigModuleResSectionDataUnionDisplay.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleResSectionDataUnionDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleDisplayType get type;

  /// Enables dark mode for the display.
  @JsonKey(name: 'dark_mode')
  bool get darkMode;

  /// Sets the brightness level of the display (0-100).
  int get brightness;

  /// Time in seconds before the screen automatically locks.
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration;

  /// Enables the screen saver when the device is idle. Value is in seconds.
  @JsonKey(name: 'screen_saver')
  bool get screenSaver;

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleResSectionDataUnionDisplayImplCopyWith<
          _$ConfigModuleResSectionDataUnionDisplayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleResSectionDataUnionLanguageImplCopyWith<$Res> {
  factory _$$ConfigModuleResSectionDataUnionLanguageImplCopyWith(
          _$ConfigModuleResSectionDataUnionLanguageImpl value,
          $Res Function(_$ConfigModuleResSectionDataUnionLanguageImpl) then) =
      __$$ConfigModuleResSectionDataUnionLanguageImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigModuleLanguageType type,
      ConfigModuleLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigModuleLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigModuleResSectionDataUnionLanguageImplCopyWithImpl<$Res>
    extends _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleResSectionDataUnionLanguageImpl>
    implements _$$ConfigModuleResSectionDataUnionLanguageImplCopyWith<$Res> {
  __$$ConfigModuleResSectionDataUnionLanguageImplCopyWithImpl(
      _$ConfigModuleResSectionDataUnionLanguageImpl _value,
      $Res Function(_$ConfigModuleResSectionDataUnionLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigModuleResSectionDataUnionLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleResSectionDataUnionLanguageImpl
    implements ConfigModuleResSectionDataUnionLanguage {
  const _$ConfigModuleResSectionDataUnionLanguageImpl(
      {this.type = ConfigModuleLanguageType.language,
      this.language = ConfigModuleLanguageLanguage.enUS,
      this.timezone = 'Europe/Prague',
      @JsonKey(name: 'time_format')
      this.timeFormat = ConfigModuleLanguageTimeFormat.value24h});

  factory _$ConfigModuleResSectionDataUnionLanguageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleResSectionDataUnionLanguageImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleLanguageType type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  @JsonKey()
  final ConfigModuleLanguageLanguage language;

  /// Sets the time format for displaying time on the panel.
  @override
  @JsonKey()
  final String timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  final ConfigModuleLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigModuleResSectionDataUnion.language(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleResSectionDataUnionLanguageImpl &&
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

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleResSectionDataUnionLanguageImplCopyWith<
          _$ConfigModuleResSectionDataUnionLanguageImpl>
      get copyWith =>
          __$$ConfigModuleResSectionDataUnionLanguageImplCopyWithImpl<
              _$ConfigModuleResSectionDataUnionLanguageImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)
        weather,
  }) {
    return language(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
  }) {
    return language?.call(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
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
    required TResult Function(ConfigModuleResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigModuleResSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigModuleResSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigModuleResSectionDataUnionWeather value)
        weather,
  }) {
    return language(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigModuleResSectionDataUnionWeather value)? weather,
  }) {
    return language?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigModuleResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (language != null) {
      return language(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleResSectionDataUnionLanguageImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleResSectionDataUnionLanguage
    implements ConfigModuleResSectionDataUnion {
  const factory ConfigModuleResSectionDataUnionLanguage(
          {final ConfigModuleLanguageType type,
          final ConfigModuleLanguageLanguage language,
          final String timezone,
          @JsonKey(name: 'time_format')
          final ConfigModuleLanguageTimeFormat timeFormat}) =
      _$ConfigModuleResSectionDataUnionLanguageImpl;

  factory ConfigModuleResSectionDataUnionLanguage.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleResSectionDataUnionLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleLanguageType get type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  ConfigModuleLanguageLanguage get language;

  /// Sets the time format for displaying time on the panel.
  String get timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @JsonKey(name: 'time_format')
  ConfigModuleLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleResSectionDataUnionLanguageImplCopyWith<
          _$ConfigModuleResSectionDataUnionLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigModuleResSectionDataUnionWeatherImplCopyWith<$Res> {
  factory _$$ConfigModuleResSectionDataUnionWeatherImplCopyWith(
          _$ConfigModuleResSectionDataUnionWeatherImpl value,
          $Res Function(_$ConfigModuleResSectionDataUnionWeatherImpl) then) =
      __$$ConfigModuleResSectionDataUnionWeatherImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
      ConfigModuleWeatherType type,
      @JsonKey(name: 'location_type')
      ConfigModuleWeatherLocationType locationType,
      ConfigModuleWeatherUnit unit});
}

/// @nodoc
class __$$ConfigModuleResSectionDataUnionWeatherImplCopyWithImpl<$Res>
    extends _$ConfigModuleResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigModuleResSectionDataUnionWeatherImpl>
    implements _$$ConfigModuleResSectionDataUnionWeatherImplCopyWith<$Res> {
  __$$ConfigModuleResSectionDataUnionWeatherImplCopyWithImpl(
      _$ConfigModuleResSectionDataUnionWeatherImpl _value,
      $Res Function(_$ConfigModuleResSectionDataUnionWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? location = freezed,
    Object? openWeatherApiKey = freezed,
    Object? type = null,
    Object? locationType = null,
    Object? unit = null,
  }) {
    return _then(_$ConfigModuleResSectionDataUnionWeatherImpl(
      location: freezed == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as String?,
      openWeatherApiKey: freezed == openWeatherApiKey
          ? _value.openWeatherApiKey
          : openWeatherApiKey // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleWeatherType,
      locationType: null == locationType
          ? _value.locationType
          : locationType // ignore: cast_nullable_to_non_nullable
              as ConfigModuleWeatherLocationType,
      unit: null == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as ConfigModuleWeatherUnit,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleResSectionDataUnionWeatherImpl
    implements ConfigModuleResSectionDataUnionWeather {
  const _$ConfigModuleResSectionDataUnionWeatherImpl(
      {required this.location,
      @JsonKey(name: 'open_weather_api_key') required this.openWeatherApiKey,
      this.type = ConfigModuleWeatherType.weather,
      @JsonKey(name: 'location_type')
      this.locationType = ConfigModuleWeatherLocationType.cityName,
      this.unit = ConfigModuleWeatherUnit.celsius});

  factory _$ConfigModuleResSectionDataUnionWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleResSectionDataUnionWeatherImplFromJson(json);

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  final String? location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  final String? openWeatherApiKey;

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleWeatherType type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  final ConfigModuleWeatherLocationType locationType;

  /// Defines the temperature unit for weather data.
  @override
  @JsonKey()
  final ConfigModuleWeatherUnit unit;

  @override
  String toString() {
    return 'ConfigModuleResSectionDataUnion.weather(location: $location, openWeatherApiKey: $openWeatherApiKey, type: $type, locationType: $locationType, unit: $unit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleResSectionDataUnionWeatherImpl &&
            (identical(other.location, location) ||
                other.location == location) &&
            (identical(other.openWeatherApiKey, openWeatherApiKey) ||
                other.openWeatherApiKey == openWeatherApiKey) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.locationType, locationType) ||
                other.locationType == locationType) &&
            (identical(other.unit, unit) || other.unit == unit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, location, openWeatherApiKey, type, locationType, unit);

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleResSectionDataUnionWeatherImplCopyWith<
          _$ConfigModuleResSectionDataUnionWeatherImpl>
      get copyWith =>
          __$$ConfigModuleResSectionDataUnionWeatherImplCopyWithImpl<
              _$ConfigModuleResSectionDataUnionWeatherImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)
        weather,
  }) {
    return weather(location, openWeatherApiKey, type, locationType, unit);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
  }) {
    return weather?.call(location, openWeatherApiKey, type, locationType, unit);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigModuleAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigModuleDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigModuleLanguageType type,
            ConfigModuleLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format')
            ConfigModuleLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigModuleWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigModuleWeatherLocationType locationType,
            ConfigModuleWeatherUnit unit)?
        weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(location, openWeatherApiKey, type, locationType, unit);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigModuleResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigModuleResSectionDataUnionDisplay value)
        display,
    required TResult Function(ConfigModuleResSectionDataUnionLanguage value)
        language,
    required TResult Function(ConfigModuleResSectionDataUnionWeather value)
        weather,
  }) {
    return weather(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigModuleResSectionDataUnionWeather value)? weather,
  }) {
    return weather?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigModuleResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigModuleResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigModuleResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigModuleResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleResSectionDataUnionWeatherImplToJson(
      this,
    );
  }
}

abstract class ConfigModuleResSectionDataUnionWeather
    implements ConfigModuleResSectionDataUnion {
  const factory ConfigModuleResSectionDataUnionWeather(
          {required final String? location,
          @JsonKey(name: 'open_weather_api_key')
          required final String? openWeatherApiKey,
          final ConfigModuleWeatherType type,
          @JsonKey(name: 'location_type')
          final ConfigModuleWeatherLocationType locationType,
          final ConfigModuleWeatherUnit unit}) =
      _$ConfigModuleResSectionDataUnionWeatherImpl;

  factory ConfigModuleResSectionDataUnionWeather.fromJson(
          Map<String, dynamic> json) =
      _$ConfigModuleResSectionDataUnionWeatherImpl.fromJson;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Configuration section type
  @override
  ConfigModuleWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigModuleWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  ConfigModuleWeatherUnit get unit;

  /// Create a copy of ConfigModuleResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleResSectionDataUnionWeatherImplCopyWith<
          _$ConfigModuleResSectionDataUnionWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
