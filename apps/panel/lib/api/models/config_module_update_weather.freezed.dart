// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_update_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleUpdateWeather _$ConfigModuleUpdateWeatherFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleUpdateWeather.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleUpdateWeather {
  /// Configuration section type
  ConfigModuleUpdateWeatherType get type => throw _privateConstructorUsedError;

  /// Specifies the method used to determine the location for weather updates.
  @JsonKey(name: 'location_type')
  ConfigModuleUpdateWeatherLocationType get locationType =>
      throw _privateConstructorUsedError;

  /// Defines the temperature unit for weather data.
  ConfigModuleUpdateWeatherUnit get unit => throw _privateConstructorUsedError;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  String? get location => throw _privateConstructorUsedError;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey => throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleUpdateWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleUpdateWeatherCopyWith<ConfigModuleUpdateWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleUpdateWeatherCopyWith<$Res> {
  factory $ConfigModuleUpdateWeatherCopyWith(ConfigModuleUpdateWeather value,
          $Res Function(ConfigModuleUpdateWeather) then) =
      _$ConfigModuleUpdateWeatherCopyWithImpl<$Res, ConfigModuleUpdateWeather>;
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
class _$ConfigModuleUpdateWeatherCopyWithImpl<$Res,
        $Val extends ConfigModuleUpdateWeather>
    implements $ConfigModuleUpdateWeatherCopyWith<$Res> {
  _$ConfigModuleUpdateWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleUpdateWeather
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigModuleUpdateWeatherImplCopyWith<$Res>
    implements $ConfigModuleUpdateWeatherCopyWith<$Res> {
  factory _$$ConfigModuleUpdateWeatherImplCopyWith(
          _$ConfigModuleUpdateWeatherImpl value,
          $Res Function(_$ConfigModuleUpdateWeatherImpl) then) =
      __$$ConfigModuleUpdateWeatherImplCopyWithImpl<$Res>;
  @override
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
class __$$ConfigModuleUpdateWeatherImplCopyWithImpl<$Res>
    extends _$ConfigModuleUpdateWeatherCopyWithImpl<$Res,
        _$ConfigModuleUpdateWeatherImpl>
    implements _$$ConfigModuleUpdateWeatherImplCopyWith<$Res> {
  __$$ConfigModuleUpdateWeatherImplCopyWithImpl(
      _$ConfigModuleUpdateWeatherImpl _value,
      $Res Function(_$ConfigModuleUpdateWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleUpdateWeather
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
    return _then(_$ConfigModuleUpdateWeatherImpl(
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
class _$ConfigModuleUpdateWeatherImpl implements _ConfigModuleUpdateWeather {
  const _$ConfigModuleUpdateWeatherImpl(
      {required this.type,
      @JsonKey(name: 'location_type') required this.locationType,
      required this.unit,
      this.location,
      @JsonKey(name: 'open_weather_api_key') this.openWeatherApiKey});

  factory _$ConfigModuleUpdateWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleUpdateWeatherImplFromJson(json);

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
    return 'ConfigModuleUpdateWeather(type: $type, locationType: $locationType, unit: $unit, location: $location, openWeatherApiKey: $openWeatherApiKey)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleUpdateWeatherImpl &&
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

  /// Create a copy of ConfigModuleUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleUpdateWeatherImplCopyWith<_$ConfigModuleUpdateWeatherImpl>
      get copyWith => __$$ConfigModuleUpdateWeatherImplCopyWithImpl<
          _$ConfigModuleUpdateWeatherImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleUpdateWeatherImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleUpdateWeather implements ConfigModuleUpdateWeather {
  const factory _ConfigModuleUpdateWeather(
      {required final ConfigModuleUpdateWeatherType type,
      @JsonKey(name: 'location_type')
      required final ConfigModuleUpdateWeatherLocationType locationType,
      required final ConfigModuleUpdateWeatherUnit unit,
      final String? location,
      @JsonKey(name: 'open_weather_api_key')
      final String? openWeatherApiKey}) = _$ConfigModuleUpdateWeatherImpl;

  factory _ConfigModuleUpdateWeather.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleUpdateWeatherImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateWeatherType get type;

  /// Specifies the method used to determine the location for weather updates.
  @override
  @JsonKey(name: 'location_type')
  ConfigModuleUpdateWeatherLocationType get locationType;

  /// Defines the temperature unit for weather data.
  @override
  ConfigModuleUpdateWeatherUnit get unit;

  /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
  @override
  String? get location;

  /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
  @override
  @JsonKey(name: 'open_weather_api_key')
  String? get openWeatherApiKey;

  /// Create a copy of ConfigModuleUpdateWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleUpdateWeatherImplCopyWith<_$ConfigModuleUpdateWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
