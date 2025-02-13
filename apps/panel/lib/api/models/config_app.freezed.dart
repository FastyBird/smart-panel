// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_app.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigApp _$ConfigAppFromJson(Map<String, dynamic> json) {
  return _ConfigApp.fromJson(json);
}

/// @nodoc
mixin _$ConfigApp {
  /// Audio configuration settings, including speaker and microphone options.
  ConfigAudio get audio => throw _privateConstructorUsedError;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  ConfigDisplay get display => throw _privateConstructorUsedError;

  /// Language and localization settings, including time zone and time format.
  ConfigLanguage get language => throw _privateConstructorUsedError;

  /// Weather settings, including location, unit preferences, and API integration.
  ConfigWeather get weather => throw _privateConstructorUsedError;

  /// Serializes this ConfigApp to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigAppCopyWith<ConfigApp> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigAppCopyWith<$Res> {
  factory $ConfigAppCopyWith(ConfigApp value, $Res Function(ConfigApp) then) =
      _$ConfigAppCopyWithImpl<$Res, ConfigApp>;
  @useResult
  $Res call(
      {ConfigAudio audio,
      ConfigDisplay display,
      ConfigLanguage language,
      ConfigWeather weather});

  $ConfigAudioCopyWith<$Res> get audio;
  $ConfigDisplayCopyWith<$Res> get display;
  $ConfigLanguageCopyWith<$Res> get language;
  $ConfigWeatherCopyWith<$Res> get weather;
}

/// @nodoc
class _$ConfigAppCopyWithImpl<$Res, $Val extends ConfigApp>
    implements $ConfigAppCopyWith<$Res> {
  _$ConfigAppCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? audio = null,
    Object? display = null,
    Object? language = null,
    Object? weather = null,
  }) {
    return _then(_value.copyWith(
      audio: null == audio
          ? _value.audio
          : audio // ignore: cast_nullable_to_non_nullable
              as ConfigAudio,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as ConfigDisplay,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigLanguage,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as ConfigWeather,
    ) as $Val);
  }

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigAudioCopyWith<$Res> get audio {
    return $ConfigAudioCopyWith<$Res>(_value.audio, (value) {
      return _then(_value.copyWith(audio: value) as $Val);
    });
  }

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigDisplayCopyWith<$Res> get display {
    return $ConfigDisplayCopyWith<$Res>(_value.display, (value) {
      return _then(_value.copyWith(display: value) as $Val);
    });
  }

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigLanguageCopyWith<$Res> get language {
    return $ConfigLanguageCopyWith<$Res>(_value.language, (value) {
      return _then(_value.copyWith(language: value) as $Val);
    });
  }

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigWeatherCopyWith<$Res> get weather {
    return $ConfigWeatherCopyWith<$Res>(_value.weather, (value) {
      return _then(_value.copyWith(weather: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConfigAppImplCopyWith<$Res>
    implements $ConfigAppCopyWith<$Res> {
  factory _$$ConfigAppImplCopyWith(
          _$ConfigAppImpl value, $Res Function(_$ConfigAppImpl) then) =
      __$$ConfigAppImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigAudio audio,
      ConfigDisplay display,
      ConfigLanguage language,
      ConfigWeather weather});

  @override
  $ConfigAudioCopyWith<$Res> get audio;
  @override
  $ConfigDisplayCopyWith<$Res> get display;
  @override
  $ConfigLanguageCopyWith<$Res> get language;
  @override
  $ConfigWeatherCopyWith<$Res> get weather;
}

/// @nodoc
class __$$ConfigAppImplCopyWithImpl<$Res>
    extends _$ConfigAppCopyWithImpl<$Res, _$ConfigAppImpl>
    implements _$$ConfigAppImplCopyWith<$Res> {
  __$$ConfigAppImplCopyWithImpl(
      _$ConfigAppImpl _value, $Res Function(_$ConfigAppImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? audio = null,
    Object? display = null,
    Object? language = null,
    Object? weather = null,
  }) {
    return _then(_$ConfigAppImpl(
      audio: null == audio
          ? _value.audio
          : audio // ignore: cast_nullable_to_non_nullable
              as ConfigAudio,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as ConfigDisplay,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigLanguage,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as ConfigWeather,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigAppImpl implements _ConfigApp {
  const _$ConfigAppImpl(
      {required this.audio,
      required this.display,
      required this.language,
      required this.weather});

  factory _$ConfigAppImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigAppImplFromJson(json);

  /// Audio configuration settings, including speaker and microphone options.
  @override
  final ConfigAudio audio;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  @override
  final ConfigDisplay display;

  /// Language and localization settings, including time zone and time format.
  @override
  final ConfigLanguage language;

  /// Weather settings, including location, unit preferences, and API integration.
  @override
  final ConfigWeather weather;

  @override
  String toString() {
    return 'ConfigApp(audio: $audio, display: $display, language: $language, weather: $weather)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigAppImpl &&
            (identical(other.audio, audio) || other.audio == audio) &&
            (identical(other.display, display) || other.display == display) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.weather, weather) || other.weather == weather));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, audio, display, language, weather);

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigAppImplCopyWith<_$ConfigAppImpl> get copyWith =>
      __$$ConfigAppImplCopyWithImpl<_$ConfigAppImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigAppImplToJson(
      this,
    );
  }
}

abstract class _ConfigApp implements ConfigApp {
  const factory _ConfigApp(
      {required final ConfigAudio audio,
      required final ConfigDisplay display,
      required final ConfigLanguage language,
      required final ConfigWeather weather}) = _$ConfigAppImpl;

  factory _ConfigApp.fromJson(Map<String, dynamic> json) =
      _$ConfigAppImpl.fromJson;

  /// Audio configuration settings, including speaker and microphone options.
  @override
  ConfigAudio get audio;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  @override
  ConfigDisplay get display;

  /// Language and localization settings, including time zone and time format.
  @override
  ConfigLanguage get language;

  /// Weather settings, including location, unit preferences, and API integration.
  @override
  ConfigWeather get weather;

  /// Create a copy of ConfigApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigAppImplCopyWith<_$ConfigAppImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
