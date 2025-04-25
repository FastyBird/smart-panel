// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleWeather _$ConfigModuleWeatherFromJson(Map<String, dynamic> json) {
  return _ConfigModuleWeather.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleWeather {
  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location => throw _privateConstructorUsedError;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey => throw _privateConstructorUsedError;

  /// Configuration section type
  ConfigModuleWeatherType get type => throw _privateConstructorUsedError;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigModuleWeatherLocationType get locationType =>
      throw _privateConstructorUsedError;

  /// Defines the temperature unit for weather data.
  ConfigModuleWeatherUnit get unit => throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleWeatherCopyWith<ConfigModuleWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleWeatherCopyWith<$Res> {
  factory $ConfigModuleWeatherCopyWith(
          ConfigModuleWeather value, $Res Function(ConfigModuleWeather) then) =
      _$ConfigModuleWeatherCopyWithImpl<$Res, ConfigModuleWeather>;
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
class _$ConfigModuleWeatherCopyWithImpl<$Res, $Val extends ConfigModuleWeather>
    implements $ConfigModuleWeatherCopyWith<$Res> {
  _$ConfigModuleWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleWeather
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
    return _then(_value.copyWith(
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigModuleWeatherImplCopyWith<$Res>
    implements $ConfigModuleWeatherCopyWith<$Res> {
  factory _$$ConfigModuleWeatherImplCopyWith(_$ConfigModuleWeatherImpl value,
          $Res Function(_$ConfigModuleWeatherImpl) then) =
      __$$ConfigModuleWeatherImplCopyWithImpl<$Res>;
  @override
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
class __$$ConfigModuleWeatherImplCopyWithImpl<$Res>
    extends _$ConfigModuleWeatherCopyWithImpl<$Res, _$ConfigModuleWeatherImpl>
    implements _$$ConfigModuleWeatherImplCopyWith<$Res> {
  __$$ConfigModuleWeatherImplCopyWithImpl(_$ConfigModuleWeatherImpl _value,
      $Res Function(_$ConfigModuleWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleWeather
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
    return _then(_$ConfigModuleWeatherImpl(
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
class _$ConfigModuleWeatherImpl implements _ConfigModuleWeather {
  const _$ConfigModuleWeatherImpl(
      {required this.location,
      @JsonKey(name: 'open_weather_api_key') required this.openWeatherApiKey,
      this.type = ConfigModuleWeatherType.weather,
      @JsonKey(name: 'location_type')
      this.locationType = ConfigModuleWeatherLocationType.cityName,
      this.unit = ConfigModuleWeatherUnit.celsius});

  factory _$ConfigModuleWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleWeatherImplFromJson(json);

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
    return 'ConfigModuleWeather(location: $location, openWeatherApiKey: $openWeatherApiKey, type: $type, locationType: $locationType, unit: $unit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleWeatherImpl &&
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

  /// Create a copy of ConfigModuleWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleWeatherImplCopyWith<_$ConfigModuleWeatherImpl> get copyWith =>
      __$$ConfigModuleWeatherImplCopyWithImpl<_$ConfigModuleWeatherImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleWeatherImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleWeather implements ConfigModuleWeather {
  const factory _ConfigModuleWeather(
      {required final String? location,
      @JsonKey(name: 'open_weather_api_key')
      required final String? openWeatherApiKey,
      final ConfigModuleWeatherType type,
      @JsonKey(name: 'location_type')
      final ConfigModuleWeatherLocationType locationType,
      final ConfigModuleWeatherUnit unit}) = _$ConfigModuleWeatherImpl;

  factory _ConfigModuleWeather.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleWeatherImpl.fromJson;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Configuration section type
  @override
  ConfigModuleWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  ConfigModuleWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  @override
  ConfigModuleWeatherUnit get unit;

  /// Create a copy of ConfigModuleWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleWeatherImplCopyWith<_$ConfigModuleWeatherImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
