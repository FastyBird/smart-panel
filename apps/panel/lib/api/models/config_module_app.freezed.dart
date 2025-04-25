// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_app.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleApp _$ConfigModuleAppFromJson(Map<String, dynamic> json) {
  return _ConfigModuleApp.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleApp {
  /// Audio configuration settings, including speaker and microphone options.
  ConfigModuleAudio get audio => throw _privateConstructorUsedError;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  ConfigModuleDisplay get display => throw _privateConstructorUsedError;

  /// Language and localization settings, including time zone and time format.
  ConfigModuleLanguage get language => throw _privateConstructorUsedError;

  /// Weather settings, including location, unit preferences, and API integration.
  ConfigModuleWeather get weather => throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleApp to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleAppCopyWith<ConfigModuleApp> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleAppCopyWith<$Res> {
  factory $ConfigModuleAppCopyWith(
          ConfigModuleApp value, $Res Function(ConfigModuleApp) then) =
      _$ConfigModuleAppCopyWithImpl<$Res, ConfigModuleApp>;
  @useResult
  $Res call(
      {ConfigModuleAudio audio,
      ConfigModuleDisplay display,
      ConfigModuleLanguage language,
      ConfigModuleWeather weather});

  $ConfigModuleAudioCopyWith<$Res> get audio;
  $ConfigModuleDisplayCopyWith<$Res> get display;
  $ConfigModuleLanguageCopyWith<$Res> get language;
  $ConfigModuleWeatherCopyWith<$Res> get weather;
}

/// @nodoc
class _$ConfigModuleAppCopyWithImpl<$Res, $Val extends ConfigModuleApp>
    implements $ConfigModuleAppCopyWith<$Res> {
  _$ConfigModuleAppCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleApp
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
              as ConfigModuleAudio,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as ConfigModuleDisplay,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguage,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as ConfigModuleWeather,
    ) as $Val);
  }

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleAudioCopyWith<$Res> get audio {
    return $ConfigModuleAudioCopyWith<$Res>(_value.audio, (value) {
      return _then(_value.copyWith(audio: value) as $Val);
    });
  }

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleDisplayCopyWith<$Res> get display {
    return $ConfigModuleDisplayCopyWith<$Res>(_value.display, (value) {
      return _then(_value.copyWith(display: value) as $Val);
    });
  }

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleLanguageCopyWith<$Res> get language {
    return $ConfigModuleLanguageCopyWith<$Res>(_value.language, (value) {
      return _then(_value.copyWith(language: value) as $Val);
    });
  }

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleWeatherCopyWith<$Res> get weather {
    return $ConfigModuleWeatherCopyWith<$Res>(_value.weather, (value) {
      return _then(_value.copyWith(weather: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConfigModuleAppImplCopyWith<$Res>
    implements $ConfigModuleAppCopyWith<$Res> {
  factory _$$ConfigModuleAppImplCopyWith(_$ConfigModuleAppImpl value,
          $Res Function(_$ConfigModuleAppImpl) then) =
      __$$ConfigModuleAppImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleAudio audio,
      ConfigModuleDisplay display,
      ConfigModuleLanguage language,
      ConfigModuleWeather weather});

  @override
  $ConfigModuleAudioCopyWith<$Res> get audio;
  @override
  $ConfigModuleDisplayCopyWith<$Res> get display;
  @override
  $ConfigModuleLanguageCopyWith<$Res> get language;
  @override
  $ConfigModuleWeatherCopyWith<$Res> get weather;
}

/// @nodoc
class __$$ConfigModuleAppImplCopyWithImpl<$Res>
    extends _$ConfigModuleAppCopyWithImpl<$Res, _$ConfigModuleAppImpl>
    implements _$$ConfigModuleAppImplCopyWith<$Res> {
  __$$ConfigModuleAppImplCopyWithImpl(
      _$ConfigModuleAppImpl _value, $Res Function(_$ConfigModuleAppImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? audio = null,
    Object? display = null,
    Object? language = null,
    Object? weather = null,
  }) {
    return _then(_$ConfigModuleAppImpl(
      audio: null == audio
          ? _value.audio
          : audio // ignore: cast_nullable_to_non_nullable
              as ConfigModuleAudio,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as ConfigModuleDisplay,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguage,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as ConfigModuleWeather,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleAppImpl implements _ConfigModuleApp {
  const _$ConfigModuleAppImpl(
      {required this.audio,
      required this.display,
      required this.language,
      required this.weather});

  factory _$ConfigModuleAppImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleAppImplFromJson(json);

  /// Audio configuration settings, including speaker and microphone options.
  @override
  final ConfigModuleAudio audio;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  @override
  final ConfigModuleDisplay display;

  /// Language and localization settings, including time zone and time format.
  @override
  final ConfigModuleLanguage language;

  /// Weather settings, including location, unit preferences, and API integration.
  @override
  final ConfigModuleWeather weather;

  @override
  String toString() {
    return 'ConfigModuleApp(audio: $audio, display: $display, language: $language, weather: $weather)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleAppImpl &&
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

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleAppImplCopyWith<_$ConfigModuleAppImpl> get copyWith =>
      __$$ConfigModuleAppImplCopyWithImpl<_$ConfigModuleAppImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleAppImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleApp implements ConfigModuleApp {
  const factory _ConfigModuleApp(
      {required final ConfigModuleAudio audio,
      required final ConfigModuleDisplay display,
      required final ConfigModuleLanguage language,
      required final ConfigModuleWeather weather}) = _$ConfigModuleAppImpl;

  factory _ConfigModuleApp.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleAppImpl.fromJson;

  /// Audio configuration settings, including speaker and microphone options.
  @override
  ConfigModuleAudio get audio;

  /// Display settings, including brightness, dark mode, and screen lock duration.
  @override
  ConfigModuleDisplay get display;

  /// Language and localization settings, including time zone and time format.
  @override
  ConfigModuleLanguage get language;

  /// Weather settings, including location, unit preferences, and API integration.
  @override
  ConfigModuleWeather get weather;

  /// Create a copy of ConfigModuleApp
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleAppImplCopyWith<_$ConfigModuleAppImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
