// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_update_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigUpdateWeather _$ConfigUpdateWeatherFromJson(Map<String, dynamic> json) {
  return _ConfigUpdateWeather.fromJson(json);
}

/// @nodoc
mixin _$ConfigUpdateWeather {
  /// Configuration section type
  ConfigUpdateWeatherType get type => throw _privateConstructorUsedError;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigUpdateWeatherLocationType get locationType =>
      throw _privateConstructorUsedError;

  /// Defines the temperature unit for weather data.
  ConfigUpdateWeatherUnit get unit => throw _privateConstructorUsedError;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location => throw _privateConstructorUsedError;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey => throw _privateConstructorUsedError;

  /// Serializes this ConfigUpdateWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigUpdateWeatherCopyWith<ConfigUpdateWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigUpdateWeatherCopyWith<$Res> {
  factory $ConfigUpdateWeatherCopyWith(
          ConfigUpdateWeather value, $Res Function(ConfigUpdateWeather) then) =
      _$ConfigUpdateWeatherCopyWithImpl<$Res, ConfigUpdateWeather>;
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
class _$ConfigUpdateWeatherCopyWithImpl<$Res, $Val extends ConfigUpdateWeather>
    implements $ConfigUpdateWeatherCopyWith<$Res> {
  _$ConfigUpdateWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigUpdateWeather
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
    return _then(_value.copyWith(
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigUpdateWeatherImplCopyWith<$Res>
    implements $ConfigUpdateWeatherCopyWith<$Res> {
  factory _$$ConfigUpdateWeatherImplCopyWith(_$ConfigUpdateWeatherImpl value,
          $Res Function(_$ConfigUpdateWeatherImpl) then) =
      __$$ConfigUpdateWeatherImplCopyWithImpl<$Res>;
  @override
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
class __$$ConfigUpdateWeatherImplCopyWithImpl<$Res>
    extends _$ConfigUpdateWeatherCopyWithImpl<$Res, _$ConfigUpdateWeatherImpl>
    implements _$$ConfigUpdateWeatherImplCopyWith<$Res> {
  __$$ConfigUpdateWeatherImplCopyWithImpl(_$ConfigUpdateWeatherImpl _value,
      $Res Function(_$ConfigUpdateWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigUpdateWeather
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
    return _then(_$ConfigUpdateWeatherImpl(
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
class _$ConfigUpdateWeatherImpl implements _ConfigUpdateWeather {
  const _$ConfigUpdateWeatherImpl(
      {required this.type,
      @JsonKey(name: 'location_type') required this.locationType,
      required this.unit,
      this.location,
      @JsonKey(name: 'open_weather_api_key') this.openWeatherApiKey});

  factory _$ConfigUpdateWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigUpdateWeatherImplFromJson(json);

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
    return 'ConfigUpdateWeather(type: $type, locationType: $locationType, unit: $unit, location: $location, openWeatherApiKey: $openWeatherApiKey)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigUpdateWeatherImpl &&
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

  /// Create a copy of ConfigUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigUpdateWeatherImplCopyWith<_$ConfigUpdateWeatherImpl> get copyWith =>
      __$$ConfigUpdateWeatherImplCopyWithImpl<_$ConfigUpdateWeatherImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigUpdateWeatherImplToJson(
      this,
    );
  }
}

abstract class _ConfigUpdateWeather implements ConfigUpdateWeather {
  const factory _ConfigUpdateWeather(
      {required final ConfigUpdateWeatherType type,
      @JsonKey(name: 'location_type')
      required final ConfigUpdateWeatherLocationType locationType,
      required final ConfigUpdateWeatherUnit unit,
      final String? location,
      @JsonKey(name: 'open_weather_api_key')
      final String? openWeatherApiKey}) = _$ConfigUpdateWeatherImpl;

  factory _ConfigUpdateWeather.fromJson(Map<String, dynamic> json) =
      _$ConfigUpdateWeatherImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  ConfigUpdateWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  @override
  ConfigUpdateWeatherUnit get unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Create a copy of ConfigUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigUpdateWeatherImplCopyWith<_$ConfigUpdateWeatherImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
