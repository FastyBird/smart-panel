// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_current_day.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherCurrentDay _$WeatherCurrentDayFromJson(Map<String, dynamic> json) {
  return _WeatherCurrentDay.fromJson(json);
}

/// @nodoc
mixin _$WeatherCurrentDay {
  /// Current temperature in degrees Celsius.
  num get temperature => throw _privateConstructorUsedError;

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

  /// Timestamp for sunrise in ISO 8601 format.
  DateTime get sunrise => throw _privateConstructorUsedError;

  /// Timestamp for sunset in ISO 8601 format.
  DateTime get sunset => throw _privateConstructorUsedError;

  /// Time of data calculation
  @JsonKey(name: 'day_time')
  DateTime get dayTime => throw _privateConstructorUsedError;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @JsonKey(name: 'temperature_min')
  num? get temperatureMin => throw _privateConstructorUsedError;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @JsonKey(name: 'temperature_max')
  num? get temperatureMax => throw _privateConstructorUsedError;

  /// Serializes this WeatherCurrentDay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherCurrentDayCopyWith<WeatherCurrentDay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherCurrentDayCopyWith<$Res> {
  factory $WeatherCurrentDayCopyWith(
          WeatherCurrentDay value, $Res Function(WeatherCurrentDay) then) =
      _$WeatherCurrentDayCopyWithImpl<$Res, WeatherCurrentDay>;
  @useResult
  $Res call(
      {num temperature,
      @JsonKey(name: 'feels_like') num feelsLike,
      num pressure,
      num humidity,
      WeatherWeather weather,
      WeatherWind wind,
      num clouds,
      num? rain,
      num? snow,
      DateTime sunrise,
      DateTime sunset,
      @JsonKey(name: 'day_time') DateTime dayTime,
      @JsonKey(name: 'temperature_min') num? temperatureMin,
      @JsonKey(name: 'temperature_max') num? temperatureMax});

  $WeatherWeatherCopyWith<$Res> get weather;
  $WeatherWindCopyWith<$Res> get wind;
}

/// @nodoc
class _$WeatherCurrentDayCopyWithImpl<$Res, $Val extends WeatherCurrentDay>
    implements $WeatherCurrentDayCopyWith<$Res> {
  _$WeatherCurrentDayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? temperature = null,
    Object? feelsLike = null,
    Object? pressure = null,
    Object? humidity = null,
    Object? weather = null,
    Object? wind = null,
    Object? clouds = null,
    Object? rain = freezed,
    Object? snow = freezed,
    Object? sunrise = null,
    Object? sunset = null,
    Object? dayTime = null,
    Object? temperatureMin = freezed,
    Object? temperatureMax = freezed,
  }) {
    return _then(_value.copyWith(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
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
      sunrise: null == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunset: null == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime,
      dayTime: null == dayTime
          ? _value.dayTime
          : dayTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      temperatureMin: freezed == temperatureMin
          ? _value.temperatureMin
          : temperatureMin // ignore: cast_nullable_to_non_nullable
              as num?,
      temperatureMax: freezed == temperatureMax
          ? _value.temperatureMax
          : temperatureMax // ignore: cast_nullable_to_non_nullable
              as num?,
    ) as $Val);
  }

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherWeatherCopyWith<$Res> get weather {
    return $WeatherWeatherCopyWith<$Res>(_value.weather, (value) {
      return _then(_value.copyWith(weather: value) as $Val);
    });
  }

  /// Create a copy of WeatherCurrentDay
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
abstract class _$$WeatherCurrentDayImplCopyWith<$Res>
    implements $WeatherCurrentDayCopyWith<$Res> {
  factory _$$WeatherCurrentDayImplCopyWith(_$WeatherCurrentDayImpl value,
          $Res Function(_$WeatherCurrentDayImpl) then) =
      __$$WeatherCurrentDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num temperature,
      @JsonKey(name: 'feels_like') num feelsLike,
      num pressure,
      num humidity,
      WeatherWeather weather,
      WeatherWind wind,
      num clouds,
      num? rain,
      num? snow,
      DateTime sunrise,
      DateTime sunset,
      @JsonKey(name: 'day_time') DateTime dayTime,
      @JsonKey(name: 'temperature_min') num? temperatureMin,
      @JsonKey(name: 'temperature_max') num? temperatureMax});

  @override
  $WeatherWeatherCopyWith<$Res> get weather;
  @override
  $WeatherWindCopyWith<$Res> get wind;
}

/// @nodoc
class __$$WeatherCurrentDayImplCopyWithImpl<$Res>
    extends _$WeatherCurrentDayCopyWithImpl<$Res, _$WeatherCurrentDayImpl>
    implements _$$WeatherCurrentDayImplCopyWith<$Res> {
  __$$WeatherCurrentDayImplCopyWithImpl(_$WeatherCurrentDayImpl _value,
      $Res Function(_$WeatherCurrentDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? temperature = null,
    Object? feelsLike = null,
    Object? pressure = null,
    Object? humidity = null,
    Object? weather = null,
    Object? wind = null,
    Object? clouds = null,
    Object? rain = freezed,
    Object? snow = freezed,
    Object? sunrise = null,
    Object? sunset = null,
    Object? dayTime = null,
    Object? temperatureMin = freezed,
    Object? temperatureMax = freezed,
  }) {
    return _then(_$WeatherCurrentDayImpl(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
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
      sunrise: null == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunset: null == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime,
      dayTime: null == dayTime
          ? _value.dayTime
          : dayTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      temperatureMin: freezed == temperatureMin
          ? _value.temperatureMin
          : temperatureMin // ignore: cast_nullable_to_non_nullable
              as num?,
      temperatureMax: freezed == temperatureMax
          ? _value.temperatureMax
          : temperatureMax // ignore: cast_nullable_to_non_nullable
              as num?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherCurrentDayImpl implements _WeatherCurrentDay {
  const _$WeatherCurrentDayImpl(
      {required this.temperature,
      @JsonKey(name: 'feels_like') required this.feelsLike,
      required this.pressure,
      required this.humidity,
      required this.weather,
      required this.wind,
      required this.clouds,
      required this.rain,
      required this.snow,
      required this.sunrise,
      required this.sunset,
      @JsonKey(name: 'day_time') required this.dayTime,
      @JsonKey(name: 'temperature_min') this.temperatureMin,
      @JsonKey(name: 'temperature_max') this.temperatureMax});

  factory _$WeatherCurrentDayImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherCurrentDayImplFromJson(json);

  /// Current temperature in degrees Celsius.
  @override
  final num temperature;

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

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  final DateTime sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  final DateTime sunset;

  /// Time of data calculation
  @override
  @JsonKey(name: 'day_time')
  final DateTime dayTime;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_min')
  final num? temperatureMin;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_max')
  final num? temperatureMax;

  @override
  String toString() {
    return 'WeatherCurrentDay(temperature: $temperature, feelsLike: $feelsLike, pressure: $pressure, humidity: $humidity, weather: $weather, wind: $wind, clouds: $clouds, rain: $rain, snow: $snow, sunrise: $sunrise, sunset: $sunset, dayTime: $dayTime, temperatureMin: $temperatureMin, temperatureMax: $temperatureMax)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherCurrentDayImpl &&
            (identical(other.temperature, temperature) ||
                other.temperature == temperature) &&
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
            (identical(other.sunrise, sunrise) || other.sunrise == sunrise) &&
            (identical(other.sunset, sunset) || other.sunset == sunset) &&
            (identical(other.dayTime, dayTime) || other.dayTime == dayTime) &&
            (identical(other.temperatureMin, temperatureMin) ||
                other.temperatureMin == temperatureMin) &&
            (identical(other.temperatureMax, temperatureMax) ||
                other.temperatureMax == temperatureMax));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      temperature,
      feelsLike,
      pressure,
      humidity,
      weather,
      wind,
      clouds,
      rain,
      snow,
      sunrise,
      sunset,
      dayTime,
      temperatureMin,
      temperatureMax);

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherCurrentDayImplCopyWith<_$WeatherCurrentDayImpl> get copyWith =>
      __$$WeatherCurrentDayImplCopyWithImpl<_$WeatherCurrentDayImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherCurrentDayImplToJson(
      this,
    );
  }
}

abstract class _WeatherCurrentDay implements WeatherCurrentDay {
  const factory _WeatherCurrentDay(
          {required final num temperature,
          @JsonKey(name: 'feels_like') required final num feelsLike,
          required final num pressure,
          required final num humidity,
          required final WeatherWeather weather,
          required final WeatherWind wind,
          required final num clouds,
          required final num? rain,
          required final num? snow,
          required final DateTime sunrise,
          required final DateTime sunset,
          @JsonKey(name: 'day_time') required final DateTime dayTime,
          @JsonKey(name: 'temperature_min') final num? temperatureMin,
          @JsonKey(name: 'temperature_max') final num? temperatureMax}) =
      _$WeatherCurrentDayImpl;

  factory _WeatherCurrentDay.fromJson(Map<String, dynamic> json) =
      _$WeatherCurrentDayImpl.fromJson;

  /// Current temperature in degrees Celsius.
  @override
  num get temperature;

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

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  DateTime get sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  DateTime get sunset;

  /// Time of data calculation
  @override
  @JsonKey(name: 'day_time')
  DateTime get dayTime;

  /// Minimum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_min')
  num? get temperatureMin;

  /// Maximum recorded temperature for the day in degrees Celsius.
  @override
  @JsonKey(name: 'temperature_max')
  num? get temperatureMax;

  /// Create a copy of WeatherCurrentDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherCurrentDayImplCopyWith<_$WeatherCurrentDayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
