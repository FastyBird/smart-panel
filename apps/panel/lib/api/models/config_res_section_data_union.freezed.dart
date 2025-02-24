// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_res_section_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigResSectionDataUnion _$ConfigResSectionDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'audio':
      return ConfigResSectionDataUnionAudio.fromJson(json);
    case 'display':
      return ConfigResSectionDataUnionDisplay.fromJson(json);
    case 'language':
      return ConfigResSectionDataUnionLanguage.fromJson(json);
    case 'weather':
      return ConfigResSectionDataUnionWeather.fromJson(json);

    default:
      throw CheckedFromJsonException(json, 'type', 'ConfigResSectionDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$ConfigResSectionDataUnion {
  /// Configuration section type
  Enum get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(ConfigResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigResSectionDataUnionDisplay value) display,
    required TResult Function(ConfigResSectionDataUnionLanguage value) language,
    required TResult Function(ConfigResSectionDataUnionWeather value) weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigResSectionDataUnionWeather value)? weather,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigResSectionDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigResSectionDataUnionCopyWith<$Res> {
  factory $ConfigResSectionDataUnionCopyWith(ConfigResSectionDataUnion value,
          $Res Function(ConfigResSectionDataUnion) then) =
      _$ConfigResSectionDataUnionCopyWithImpl<$Res, ConfigResSectionDataUnion>;
}

/// @nodoc
class _$ConfigResSectionDataUnionCopyWithImpl<$Res,
        $Val extends ConfigResSectionDataUnion>
    implements $ConfigResSectionDataUnionCopyWith<$Res> {
  _$ConfigResSectionDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$ConfigResSectionDataUnionAudioImplCopyWith<$Res> {
  factory _$$ConfigResSectionDataUnionAudioImplCopyWith(
          _$ConfigResSectionDataUnionAudioImpl value,
          $Res Function(_$ConfigResSectionDataUnionAudioImpl) then) =
      __$$ConfigResSectionDataUnionAudioImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigAudioType type,
      bool speaker,
      @JsonKey(name: 'speaker_volume') int speakerVolume,
      bool microphone,
      @JsonKey(name: 'microphone_volume') int microphoneVolume});
}

/// @nodoc
class __$$ConfigResSectionDataUnionAudioImplCopyWithImpl<$Res>
    extends _$ConfigResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigResSectionDataUnionAudioImpl>
    implements _$$ConfigResSectionDataUnionAudioImplCopyWith<$Res> {
  __$$ConfigResSectionDataUnionAudioImplCopyWithImpl(
      _$ConfigResSectionDataUnionAudioImpl _value,
      $Res Function(_$ConfigResSectionDataUnionAudioImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigResSectionDataUnion
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
    return _then(_$ConfigResSectionDataUnionAudioImpl(
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
class _$ConfigResSectionDataUnionAudioImpl
    implements ConfigResSectionDataUnionAudio {
  const _$ConfigResSectionDataUnionAudioImpl(
      {this.type = ConfigAudioType.audio,
      this.speaker = false,
      @JsonKey(name: 'speaker_volume') this.speakerVolume = 0,
      this.microphone = false,
      @JsonKey(name: 'microphone_volume') this.microphoneVolume = 0});

  factory _$ConfigResSectionDataUnionAudioImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigResSectionDataUnionAudioImplFromJson(json);

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
    return 'ConfigResSectionDataUnion.audio(type: $type, speaker: $speaker, speakerVolume: $speakerVolume, microphone: $microphone, microphoneVolume: $microphoneVolume)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigResSectionDataUnionAudioImpl &&
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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigResSectionDataUnionAudioImplCopyWith<
          _$ConfigResSectionDataUnionAudioImpl>
      get copyWith => __$$ConfigResSectionDataUnionAudioImplCopyWithImpl<
          _$ConfigResSectionDataUnionAudioImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)
        weather,
  }) {
    return audio(type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
  }) {
    return audio?.call(
        type, speaker, speakerVolume, microphone, microphoneVolume);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
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
    required TResult Function(ConfigResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigResSectionDataUnionDisplay value) display,
    required TResult Function(ConfigResSectionDataUnionLanguage value) language,
    required TResult Function(ConfigResSectionDataUnionWeather value) weather,
  }) {
    return audio(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigResSectionDataUnionWeather value)? weather,
  }) {
    return audio?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (audio != null) {
      return audio(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigResSectionDataUnionAudioImplToJson(
      this,
    );
  }
}

abstract class ConfigResSectionDataUnionAudio
    implements ConfigResSectionDataUnion {
  const factory ConfigResSectionDataUnionAudio(
          {final ConfigAudioType type,
          final bool speaker,
          @JsonKey(name: 'speaker_volume') final int speakerVolume,
          final bool microphone,
          @JsonKey(name: 'microphone_volume') final int microphoneVolume}) =
      _$ConfigResSectionDataUnionAudioImpl;

  factory ConfigResSectionDataUnionAudio.fromJson(Map<String, dynamic> json) =
      _$ConfigResSectionDataUnionAudioImpl.fromJson;

  /// Configuration section type
  @override
  ConfigAudioType get type;

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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigResSectionDataUnionAudioImplCopyWith<
          _$ConfigResSectionDataUnionAudioImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigResSectionDataUnionDisplayImplCopyWith<$Res> {
  factory _$$ConfigResSectionDataUnionDisplayImplCopyWith(
          _$ConfigResSectionDataUnionDisplayImpl value,
          $Res Function(_$ConfigResSectionDataUnionDisplayImpl) then) =
      __$$ConfigResSectionDataUnionDisplayImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigResSectionDataUnionDisplayImplCopyWithImpl<$Res>
    extends _$ConfigResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigResSectionDataUnionDisplayImpl>
    implements _$$ConfigResSectionDataUnionDisplayImplCopyWith<$Res> {
  __$$ConfigResSectionDataUnionDisplayImplCopyWithImpl(
      _$ConfigResSectionDataUnionDisplayImpl _value,
      $Res Function(_$ConfigResSectionDataUnionDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigResSectionDataUnion
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
    return _then(_$ConfigResSectionDataUnionDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigDisplayType,
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
class _$ConfigResSectionDataUnionDisplayImpl
    implements ConfigResSectionDataUnionDisplay {
  const _$ConfigResSectionDataUnionDisplayImpl(
      {this.type = ConfigDisplayType.display,
      @JsonKey(name: 'dark_mode') this.darkMode = false,
      this.brightness = 0,
      @JsonKey(name: 'screen_lock_duration') this.screenLockDuration = 30,
      @JsonKey(name: 'screen_saver') this.screenSaver = true});

  factory _$ConfigResSectionDataUnionDisplayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigResSectionDataUnionDisplayImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigDisplayType type;

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
    return 'ConfigResSectionDataUnion.display(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigResSectionDataUnionDisplayImpl &&
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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigResSectionDataUnionDisplayImplCopyWith<
          _$ConfigResSectionDataUnionDisplayImpl>
      get copyWith => __$$ConfigResSectionDataUnionDisplayImplCopyWithImpl<
          _$ConfigResSectionDataUnionDisplayImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)
        weather,
  }) {
    return display(type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
  }) {
    return display?.call(
        type, darkMode, brightness, screenLockDuration, screenSaver);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
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
    required TResult Function(ConfigResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigResSectionDataUnionDisplay value) display,
    required TResult Function(ConfigResSectionDataUnionLanguage value) language,
    required TResult Function(ConfigResSectionDataUnionWeather value) weather,
  }) {
    return display(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigResSectionDataUnionWeather value)? weather,
  }) {
    return display?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (display != null) {
      return display(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigResSectionDataUnionDisplayImplToJson(
      this,
    );
  }
}

abstract class ConfigResSectionDataUnionDisplay
    implements ConfigResSectionDataUnion {
  const factory ConfigResSectionDataUnionDisplay(
          {final ConfigDisplayType type,
          @JsonKey(name: 'dark_mode') final bool darkMode,
          final int brightness,
          @JsonKey(name: 'screen_lock_duration') final int screenLockDuration,
          @JsonKey(name: 'screen_saver') final bool screenSaver}) =
      _$ConfigResSectionDataUnionDisplayImpl;

  factory ConfigResSectionDataUnionDisplay.fromJson(Map<String, dynamic> json) =
      _$ConfigResSectionDataUnionDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigDisplayType get type;

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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigResSectionDataUnionDisplayImplCopyWith<
          _$ConfigResSectionDataUnionDisplayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigResSectionDataUnionLanguageImplCopyWith<$Res> {
  factory _$$ConfigResSectionDataUnionLanguageImplCopyWith(
          _$ConfigResSectionDataUnionLanguageImpl value,
          $Res Function(_$ConfigResSectionDataUnionLanguageImpl) then) =
      __$$ConfigResSectionDataUnionLanguageImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {ConfigLanguageType type,
      ConfigLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigResSectionDataUnionLanguageImplCopyWithImpl<$Res>
    extends _$ConfigResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigResSectionDataUnionLanguageImpl>
    implements _$$ConfigResSectionDataUnionLanguageImplCopyWith<$Res> {
  __$$ConfigResSectionDataUnionLanguageImplCopyWithImpl(
      _$ConfigResSectionDataUnionLanguageImpl _value,
      $Res Function(_$ConfigResSectionDataUnionLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigResSectionDataUnionLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigResSectionDataUnionLanguageImpl
    implements ConfigResSectionDataUnionLanguage {
  const _$ConfigResSectionDataUnionLanguageImpl(
      {this.type = ConfigLanguageType.language,
      this.language = ConfigLanguageLanguage.enUS,
      this.timezone = 'Europe/Prague',
      @JsonKey(name: 'time_format')
      this.timeFormat = ConfigLanguageTimeFormat.value24h});

  factory _$ConfigResSectionDataUnionLanguageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigResSectionDataUnionLanguageImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigLanguageType type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  @JsonKey()
  final ConfigLanguageLanguage language;

  /// Sets the time format for displaying time on the panel.
  @override
  @JsonKey()
  final String timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  final ConfigLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigResSectionDataUnion.language(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigResSectionDataUnionLanguageImpl &&
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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigResSectionDataUnionLanguageImplCopyWith<
          _$ConfigResSectionDataUnionLanguageImpl>
      get copyWith => __$$ConfigResSectionDataUnionLanguageImplCopyWithImpl<
          _$ConfigResSectionDataUnionLanguageImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)
        weather,
  }) {
    return language(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
  }) {
    return language?.call(type, this.language, timezone, timeFormat);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
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
    required TResult Function(ConfigResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigResSectionDataUnionDisplay value) display,
    required TResult Function(ConfigResSectionDataUnionLanguage value) language,
    required TResult Function(ConfigResSectionDataUnionWeather value) weather,
  }) {
    return language(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigResSectionDataUnionWeather value)? weather,
  }) {
    return language?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (language != null) {
      return language(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigResSectionDataUnionLanguageImplToJson(
      this,
    );
  }
}

abstract class ConfigResSectionDataUnionLanguage
    implements ConfigResSectionDataUnion {
  const factory ConfigResSectionDataUnionLanguage(
          {final ConfigLanguageType type,
          final ConfigLanguageLanguage language,
          final String timezone,
          @JsonKey(name: 'time_format')
          final ConfigLanguageTimeFormat timeFormat}) =
      _$ConfigResSectionDataUnionLanguageImpl;

  factory ConfigResSectionDataUnionLanguage.fromJson(
          Map<String, dynamic> json) =
      _$ConfigResSectionDataUnionLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigLanguageType get type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  ConfigLanguageLanguage get language;

  /// Sets the time format for displaying time on the panel.
  String get timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @JsonKey(name: 'time_format')
  ConfigLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigResSectionDataUnionLanguageImplCopyWith<
          _$ConfigResSectionDataUnionLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConfigResSectionDataUnionWeatherImplCopyWith<$Res> {
  factory _$$ConfigResSectionDataUnionWeatherImplCopyWith(
          _$ConfigResSectionDataUnionWeatherImpl value,
          $Res Function(_$ConfigResSectionDataUnionWeatherImpl) then) =
      __$$ConfigResSectionDataUnionWeatherImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
      ConfigWeatherType type,
      @JsonKey(name: 'location_type') ConfigWeatherLocationType locationType,
      ConfigWeatherUnit unit});
}

/// @nodoc
class __$$ConfigResSectionDataUnionWeatherImplCopyWithImpl<$Res>
    extends _$ConfigResSectionDataUnionCopyWithImpl<$Res,
        _$ConfigResSectionDataUnionWeatherImpl>
    implements _$$ConfigResSectionDataUnionWeatherImplCopyWith<$Res> {
  __$$ConfigResSectionDataUnionWeatherImplCopyWithImpl(
      _$ConfigResSectionDataUnionWeatherImpl _value,
      $Res Function(_$ConfigResSectionDataUnionWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigResSectionDataUnion
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
    return _then(_$ConfigResSectionDataUnionWeatherImpl(
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
              as ConfigWeatherType,
      locationType: null == locationType
          ? _value.locationType
          : locationType // ignore: cast_nullable_to_non_nullable
              as ConfigWeatherLocationType,
      unit: null == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as ConfigWeatherUnit,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigResSectionDataUnionWeatherImpl
    implements ConfigResSectionDataUnionWeather {
  const _$ConfigResSectionDataUnionWeatherImpl(
      {required this.location,
      @JsonKey(name: 'open_weather_api_key') required this.openWeatherApiKey,
      this.type = ConfigWeatherType.weather,
      @JsonKey(name: 'location_type')
      this.locationType = ConfigWeatherLocationType.cityName,
      this.unit = ConfigWeatherUnit.celsius});

  factory _$ConfigResSectionDataUnionWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigResSectionDataUnionWeatherImplFromJson(json);

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
  final ConfigWeatherType type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  final ConfigWeatherLocationType locationType;

  /// Defines the temperature unit for weather data.
  @override
  @JsonKey()
  final ConfigWeatherUnit unit;

  @override
  String toString() {
    return 'ConfigResSectionDataUnion.weather(location: $location, openWeatherApiKey: $openWeatherApiKey, type: $type, locationType: $locationType, unit: $unit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigResSectionDataUnionWeatherImpl &&
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

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigResSectionDataUnionWeatherImplCopyWith<
          _$ConfigResSectionDataUnionWeatherImpl>
      get copyWith => __$$ConfigResSectionDataUnionWeatherImplCopyWithImpl<
          _$ConfigResSectionDataUnionWeatherImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)
        audio,
    required TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)
        display,
    required TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)
        language,
    required TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)
        weather,
  }) {
    return weather(location, openWeatherApiKey, type, locationType, unit);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult? Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult? Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult? Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
        weather,
  }) {
    return weather?.call(location, openWeatherApiKey, type, locationType, unit);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            ConfigAudioType type,
            bool speaker,
            @JsonKey(name: 'speaker_volume') int speakerVolume,
            bool microphone,
            @JsonKey(name: 'microphone_volume') int microphoneVolume)?
        audio,
    TResult Function(
            ConfigDisplayType type,
            @JsonKey(name: 'dark_mode') bool darkMode,
            int brightness,
            @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
            @JsonKey(name: 'screen_saver') bool screenSaver)?
        display,
    TResult Function(
            ConfigLanguageType type,
            ConfigLanguageLanguage language,
            String timezone,
            @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat)?
        language,
    TResult Function(
            String? location,
            @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
            ConfigWeatherType type,
            @JsonKey(name: 'location_type')
            ConfigWeatherLocationType locationType,
            ConfigWeatherUnit unit)?
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
    required TResult Function(ConfigResSectionDataUnionAudio value) audio,
    required TResult Function(ConfigResSectionDataUnionDisplay value) display,
    required TResult Function(ConfigResSectionDataUnionLanguage value) language,
    required TResult Function(ConfigResSectionDataUnionWeather value) weather,
  }) {
    return weather(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult? Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult? Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult? Function(ConfigResSectionDataUnionWeather value)? weather,
  }) {
    return weather?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(ConfigResSectionDataUnionAudio value)? audio,
    TResult Function(ConfigResSectionDataUnionDisplay value)? display,
    TResult Function(ConfigResSectionDataUnionLanguage value)? language,
    TResult Function(ConfigResSectionDataUnionWeather value)? weather,
    required TResult orElse(),
  }) {
    if (weather != null) {
      return weather(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigResSectionDataUnionWeatherImplToJson(
      this,
    );
  }
}

abstract class ConfigResSectionDataUnionWeather
    implements ConfigResSectionDataUnion {
  const factory ConfigResSectionDataUnionWeather(
      {required final String? location,
      @JsonKey(name: 'open_weather_api_key')
      required final String? openWeatherApiKey,
      final ConfigWeatherType type,
      @JsonKey(name: 'location_type')
      final ConfigWeatherLocationType locationType,
      final ConfigWeatherUnit unit}) = _$ConfigResSectionDataUnionWeatherImpl;

  factory ConfigResSectionDataUnionWeather.fromJson(Map<String, dynamic> json) =
      _$ConfigResSectionDataUnionWeatherImpl.fromJson;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Configuration section type
  @override
  ConfigWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  ConfigWeatherUnit get unit;

  /// Create a copy of ConfigResSectionDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigResSectionDataUnionWeatherImplCopyWith<
          _$ConfigResSectionDataUnionWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
