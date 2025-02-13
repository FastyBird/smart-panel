// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_day.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherDay _$WeatherDayFromJson(Map<String, dynamic> json) {
  return _WeatherDay.fromJson(json);
}

/// @nodoc
mixin _$WeatherDay {
  /// Current temperature in degrees Celsius.
  num get temperature => throw _privateConstructorUsedError;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @JsonKey(name: 'temperature_min')
  num get temperatureMin => throw _privateConstructorUsedError;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @JsonKey(name: 'temperature_max')
  num get temperatureMax => throw _privateConstructorUsedError;

  /// Perceived temperature based on wind and humidity.
  @JsonKey(name: 'feels_like')
  num get feelsLike => throw _privateConstructorUsedError;

  /// Atmospheric pressure in hPa.
  num get pressure => throw _privateConstructorUsedError;

  /// Humidity level as a percentage.
  num get humidity => throw _privateConstructorUsedError;

  /// Detailed weather status.
  WeatherWeather get weather => throw _privateConstructorUsedError;

  /// Wind conditions at the location.
  WeatherWind get wind => throw _privateConstructorUsedError;

  /// Cloudiness percentage.
  num get clouds => throw _privateConstructorUsedError;

  /// Rain volume in the last hour (mm).
  num? get rain => throw _privateConstructorUsedError;

  /// Snow volume in the last hour (mm).
  num? get snow => throw _privateConstructorUsedError;

  /// Timestamp when the weather data was last updated.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this WeatherDay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherDayCopyWith<WeatherDay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherDayCopyWith<$Res> {
  factory $WeatherDayCopyWith(
          WeatherDay value, $Res Function(WeatherDay) then) =
      _$WeatherDayCopyWithImpl<$Res, WeatherDay>;
  @useResult
  $Res call(
      {num temperature,
      @JsonKey(name: 'temperature_min') num temperatureMin,
      @JsonKey(name: 'temperature_max') num temperatureMax,
      @JsonKey(name: 'feels_like') num feelsLike,
      num pressure,
      num humidity,
      WeatherWeather weather,
      WeatherWind wind,
      num clouds,
      num? rain,
      num? snow,
      @JsonKey(name: 'created_at') DateTime createdAt});

  $WeatherWeatherCopyWith<$Res> get weather;
  $WeatherWindCopyWith<$Res> get wind;
}

/// @nodoc
class _$WeatherDayCopyWithImpl<$Res, $Val extends WeatherDay>
    implements $WeatherDayCopyWith<$Res> {
  _$WeatherDayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? temperature = null,
    Object? temperatureMin = null,
    Object? temperatureMax = null,
    Object? feelsLike = null,
    Object? pressure = null,
    Object? humidity = null,
    Object? weather = null,
    Object? wind = null,
    Object? clouds = null,
    Object? rain = freezed,
    Object? snow = freezed,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as num,
      temperatureMin: null == temperatureMin
          ? _value.temperatureMin
          : temperatureMin // ignore: cast_nullable_to_non_nullable
              as num,
      temperatureMax: null == temperatureMax
          ? _value.temperatureMax
          : temperatureMax // ignore: cast_nullable_to_non_nullable
              as num,
      feelsLike: null == feelsLike
          ? _value.feelsLike
          : feelsLike // ignore: cast_nullable_to_non_nullable
              as num,
      pressure: null == pressure
          ? _value.pressure
          : pressure // ignore: cast_nullable_to_non_nullable
              as num,
      humidity: null == humidity
          ? _value.humidity
          : humidity // ignore: cast_nullable_to_non_nullable
              as num,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as WeatherWeather,
      wind: null == wind
          ? _value.wind
          : wind // ignore: cast_nullable_to_non_nullable
              as WeatherWind,
      clouds: null == clouds
          ? _value.clouds
          : clouds // ignore: cast_nullable_to_non_nullable
              as num,
      rain: freezed == rain
          ? _value.rain
          : rain // ignore: cast_nullable_to_non_nullable
              as num?,
      snow: freezed == snow
          ? _value.snow
          : snow // ignore: cast_nullable_to_non_nullable
              as num?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherWeatherCopyWith<$Res> get weather {
    return $WeatherWeatherCopyWith<$Res>(_value.weather, (value) {
      return _then(_value.copyWith(weather: value) as $Val);
    });
  }

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherWindCopyWith<$Res> get wind {
    return $WeatherWindCopyWith<$Res>(_value.wind, (value) {
      return _then(_value.copyWith(wind: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WeatherDayImplCopyWith<$Res>
    implements $WeatherDayCopyWith<$Res> {
  factory _$$WeatherDayImplCopyWith(
          _$WeatherDayImpl value, $Res Function(_$WeatherDayImpl) then) =
      __$$WeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num temperature,
      @JsonKey(name: 'temperature_min') num temperatureMin,
      @JsonKey(name: 'temperature_max') num temperatureMax,
      @JsonKey(name: 'feels_like') num feelsLike,
      num pressure,
      num humidity,
      WeatherWeather weather,
      WeatherWind wind,
      num clouds,
      num? rain,
      num? snow,
      @JsonKey(name: 'created_at') DateTime createdAt});

  @override
  $WeatherWeatherCopyWith<$Res> get weather;
  @override
  $WeatherWindCopyWith<$Res> get wind;
}

/// @nodoc
class __$$WeatherDayImplCopyWithImpl<$Res>
    extends _$WeatherDayCopyWithImpl<$Res, _$WeatherDayImpl>
    implements _$$WeatherDayImplCopyWith<$Res> {
  __$$WeatherDayImplCopyWithImpl(
      _$WeatherDayImpl _value, $Res Function(_$WeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? temperature = null,
    Object? temperatureMin = null,
    Object? temperatureMax = null,
    Object? feelsLike = null,
    Object? pressure = null,
    Object? humidity = null,
    Object? weather = null,
    Object? wind = null,
    Object? clouds = null,
    Object? rain = freezed,
    Object? snow = freezed,
    Object? createdAt = null,
  }) {
    return _then(_$WeatherDayImpl(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as num,
      temperatureMin: null == temperatureMin
          ? _value.temperatureMin
          : temperatureMin // ignore: cast_nullable_to_non_nullable
              as num,
      temperatureMax: null == temperatureMax
          ? _value.temperatureMax
          : temperatureMax // ignore: cast_nullable_to_non_nullable
              as num,
      feelsLike: null == feelsLike
          ? _value.feelsLike
          : feelsLike // ignore: cast_nullable_to_non_nullable
              as num,
      pressure: null == pressure
          ? _value.pressure
          : pressure // ignore: cast_nullable_to_non_nullable
              as num,
      humidity: null == humidity
          ? _value.humidity
          : humidity // ignore: cast_nullable_to_non_nullable
              as num,
      weather: null == weather
          ? _value.weather
          : weather // ignore: cast_nullable_to_non_nullable
              as WeatherWeather,
      wind: null == wind
          ? _value.wind
          : wind // ignore: cast_nullable_to_non_nullable
              as WeatherWind,
      clouds: null == clouds
          ? _value.clouds
          : clouds // ignore: cast_nullable_to_non_nullable
              as num,
      rain: freezed == rain
          ? _value.rain
          : rain // ignore: cast_nullable_to_non_nullable
              as num?,
      snow: freezed == snow
          ? _value.snow
          : snow // ignore: cast_nullable_to_non_nullable
              as num?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherDayImpl implements _WeatherDay {
  const _$WeatherDayImpl(
      {required this.temperature,
      @JsonKey(name: 'temperature_min') required this.temperatureMin,
      @JsonKey(name: 'temperature_max') required this.temperatureMax,
      @JsonKey(name: 'feels_like') required this.feelsLike,
      required this.pressure,
      required this.humidity,
      required this.weather,
      required this.wind,
      required this.clouds,
      required this.rain,
      required this.snow,
      @JsonKey(name: 'created_at') required this.createdAt});

  factory _$WeatherDayImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherDayImplFromJson(json);

  /// Current temperature in degrees Celsius.
  @override
  final num temperature;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_min')
  final num temperatureMin;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_max')
  final num temperatureMax;

  /// Perceived temperature based on wind and humidity.
  @override
  @JsonKey(name: 'feels_like')
  final num feelsLike;

  /// Atmospheric pressure in hPa.
  @override
  final num pressure;

  /// Humidity level as a percentage.
  @override
  final num humidity;

  /// Detailed weather status.
  @override
  final WeatherWeather weather;

  /// Wind conditions at the location.
  @override
  final WeatherWind wind;

  /// Cloudiness percentage.
  @override
  final num clouds;

  /// Rain volume in the last hour (mm).
  @override
  final num? rain;

  /// Snow volume in the last hour (mm).
  @override
  final num? snow;

  /// Timestamp when the weather data was last updated.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  @override
  String toString() {
    return 'WeatherDay(temperature: $temperature, temperatureMin: $temperatureMin, temperatureMax: $temperatureMax, feelsLike: $feelsLike, pressure: $pressure, humidity: $humidity, weather: $weather, wind: $wind, clouds: $clouds, rain: $rain, snow: $snow, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherDayImpl &&
            (identical(other.temperature, temperature) ||
                other.temperature == temperature) &&
            (identical(other.temperatureMin, temperatureMin) ||
                other.temperatureMin == temperatureMin) &&
            (identical(other.temperatureMax, temperatureMax) ||
                other.temperatureMax == temperatureMax) &&
            (identical(other.feelsLike, feelsLike) ||
                other.feelsLike == feelsLike) &&
            (identical(other.pressure, pressure) ||
                other.pressure == pressure) &&
            (identical(other.humidity, humidity) ||
                other.humidity == humidity) &&
            (identical(other.weather, weather) || other.weather == weather) &&
            (identical(other.wind, wind) || other.wind == wind) &&
            (identical(other.clouds, clouds) || other.clouds == clouds) &&
            (identical(other.rain, rain) || other.rain == rain) &&
            (identical(other.snow, snow) || other.snow == snow) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      temperature,
      temperatureMin,
      temperatureMax,
      feelsLike,
      pressure,
      humidity,
      weather,
      wind,
      clouds,
      rain,
      snow,
      createdAt);

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherDayImplCopyWith<_$WeatherDayImpl> get copyWith =>
      __$$WeatherDayImplCopyWithImpl<_$WeatherDayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherDayImplToJson(
      this,
    );
  }
}

abstract class _WeatherDay implements WeatherDay {
  const factory _WeatherDay(
          {required final num temperature,
          @JsonKey(name: 'temperature_min') required final num temperatureMin,
          @JsonKey(name: 'temperature_max') required final num temperatureMax,
          @JsonKey(name: 'feels_like') required final num feelsLike,
          required final num pressure,
          required final num humidity,
          required final WeatherWeather weather,
          required final WeatherWind wind,
          required final num clouds,
          required final num? rain,
          required final num? snow,
          @JsonKey(name: 'created_at') required final DateTime createdAt}) =
      _$WeatherDayImpl;

  factory _WeatherDay.fromJson(Map<String, dynamic> json) =
      _$WeatherDayImpl.fromJson;

  /// Current temperature in degrees Celsius.
  @override
  num get temperature;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_min')
  num get temperatureMin;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_max')
  num get temperatureMax;

  /// Perceived temperature based on wind and humidity.
  @override
  @JsonKey(name: 'feels_like')
  num get feelsLike;

  /// Atmospheric pressure in hPa.
  @override
  num get pressure;

  /// Humidity level as a percentage.
  @override
  num get humidity;

  /// Detailed weather status.
  @override
  WeatherWeather get weather;

  /// Wind conditions at the location.
  @override
  WeatherWind get wind;

  /// Cloudiness percentage.
  @override
  num get clouds;

  /// Rain volume in the last hour (mm).
  @override
  num? get rain;

  /// Snow volume in the last hour (mm).
  @override
  num? get snow;

  /// Timestamp when the weather data was last updated.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Create a copy of WeatherDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherDayImplCopyWith<_$WeatherDayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
