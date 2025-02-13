// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigWeather _$ConfigWeatherFromJson(Map<String, dynamic> json) {
  return _ConfigWeather.fromJson(json);
}

/// @nodoc
mixin _$ConfigWeather {
  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location => throw _privateConstructorUsedError;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey => throw _privateConstructorUsedError;

  /// Configuration section type
  ConfigWeatherType get type => throw _privateConstructorUsedError;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigWeatherLocationType get locationType =>
      throw _privateConstructorUsedError;

  /// Defines the temperature unit for weather data.
  ConfigWeatherUnit get unit => throw _privateConstructorUsedError;

  /// Serializes this ConfigWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigWeatherCopyWith<ConfigWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigWeatherCopyWith<$Res> {
  factory $ConfigWeatherCopyWith(
          ConfigWeather value, $Res Function(ConfigWeather) then) =
      _$ConfigWeatherCopyWithImpl<$Res, ConfigWeather>;
  @useResult
  $Res call(
      {String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
      ConfigWeatherType type,
      @JsonKey(name: 'location_type') ConfigWeatherLocationType locationType,
      ConfigWeatherUnit unit});
}

/// @nodoc
class _$ConfigWeatherCopyWithImpl<$Res, $Val extends ConfigWeather>
    implements $ConfigWeatherCopyWith<$Res> {
  _$ConfigWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigWeather
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
              as ConfigWeatherType,
      locationType: null == locationType
          ? _value.locationType
          : locationType // ignore: cast_nullable_to_non_nullable
              as ConfigWeatherLocationType,
      unit: null == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as ConfigWeatherUnit,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigWeatherImplCopyWith<$Res>
    implements $ConfigWeatherCopyWith<$Res> {
  factory _$$ConfigWeatherImplCopyWith(
          _$ConfigWeatherImpl value, $Res Function(_$ConfigWeatherImpl) then) =
      __$$ConfigWeatherImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? location,
      @JsonKey(name: 'open_weather_api_key') String? openWeatherApiKey,
      ConfigWeatherType type,
      @JsonKey(name: 'location_type') ConfigWeatherLocationType locationType,
      ConfigWeatherUnit unit});
}

/// @nodoc
class __$$ConfigWeatherImplCopyWithImpl<$Res>
    extends _$ConfigWeatherCopyWithImpl<$Res, _$ConfigWeatherImpl>
    implements _$$ConfigWeatherImplCopyWith<$Res> {
  __$$ConfigWeatherImplCopyWithImpl(
      _$ConfigWeatherImpl _value, $Res Function(_$ConfigWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigWeather
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
    return _then(_$ConfigWeatherImpl(
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
class _$ConfigWeatherImpl implements _ConfigWeather {
  const _$ConfigWeatherImpl(
      {required this.location,
      @JsonKey(name: 'open_weather_api_key') required this.openWeatherApiKey,
      this.type = ConfigWeatherType.weather,
      @JsonKey(name: 'location_type')
      this.locationType = ConfigWeatherLocationType.cityName,
      this.unit = ConfigWeatherUnit.celsius});

  factory _$ConfigWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigWeatherImplFromJson(json);

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
    return 'ConfigWeather(location: $location, openWeatherApiKey: $openWeatherApiKey, type: $type, locationType: $locationType, unit: $unit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigWeatherImpl &&
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

  /// Create a copy of ConfigWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigWeatherImplCopyWith<_$ConfigWeatherImpl> get copyWith =>
      __$$ConfigWeatherImplCopyWithImpl<_$ConfigWeatherImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigWeatherImplToJson(
      this,
    );
  }
}

abstract class _ConfigWeather implements ConfigWeather {
  const factory _ConfigWeather(
      {required final String? location,
      @JsonKey(name: 'open_weather_api_key')
      required final String? openWeatherApiKey,
      final ConfigWeatherType type,
      @JsonKey(name: 'location_type')
      final ConfigWeatherLocationType locationType,
      final ConfigWeatherUnit unit}) = _$ConfigWeatherImpl;

  factory _ConfigWeather.fromJson(Map<String, dynamic> json) =
      _$ConfigWeatherImpl.fromJson;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Configuration section type
  @override
  ConfigWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  ConfigWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  @override
  ConfigWeatherUnit get unit;

  /// Create a copy of ConfigWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigWeatherImplCopyWith<_$ConfigWeatherImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
