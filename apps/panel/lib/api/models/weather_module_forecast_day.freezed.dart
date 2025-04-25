// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_forecast_day.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleForecastDay _$WeatherModuleForecastDayFromJson(
    Map<String, dynamic> json) {
  return _WeatherModuleForecastDay.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleForecastDay {
  /// Current temperatures during the day in degrees Celsius.
  Temperature get temperature => throw _privateConstructorUsedError;

  /// Perceived temperatures during the day based on wind and humidity.
  @JsonKey(name: 'feels_like')
  FeelsLike get feelsLike => throw _privateConstructorUsedError;

  /// Atmospheric pressure in hPa.
  num get pressure => throw _privateConstructorUsedError;

  /// Humidity level as a percentage.
  num get humidity => throw _privateConstructorUsedError;

  /// Detailed weather status.
  WeatherModuleWeather get weather => throw _privateConstructorUsedError;

  /// Wind conditions at the location.
  WeatherModuleWind get wind => throw _privateConstructorUsedError;

  /// Cloudiness percentage.
  num get clouds => throw _privateConstructorUsedError;

  /// Rain volume in the last hour (mm).
  num? get rain => throw _privateConstructorUsedError;

  /// Snow volume in the last hour (mm).
  num? get snow => throw _privateConstructorUsedError;

  /// Time of data calculation
  @JsonKey(name: 'day_time')
  DateTime get dayTime => throw _privateConstructorUsedError;

  /// Timestamp for sunrise in ISO 8601 format.
  DateTime? get sunrise => throw _privateConstructorUsedError;

  /// Timestamp for sunset in ISO 8601 format.
  DateTime? get sunset => throw _privateConstructorUsedError;

  /// Timestamp for moonrise in ISO 8601 format.
  DateTime? get moonrise => throw _privateConstructorUsedError;

  /// Timestamp for moonset in ISO 8601 format.
  DateTime? get moonset => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleForecastDay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleForecastDayCopyWith<WeatherModuleForecastDay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleForecastDayCopyWith<$Res> {
  factory $WeatherModuleForecastDayCopyWith(WeatherModuleForecastDay value,
          $Res Function(WeatherModuleForecastDay) then) =
      _$WeatherModuleForecastDayCopyWithImpl<$Res, WeatherModuleForecastDay>;
  @useResult
  $Res call(
      {Temperature temperature,
      @JsonKey(name: 'feels_like') FeelsLike feelsLike,
      num pressure,
      num humidity,
      WeatherModuleWeather weather,
      WeatherModuleWind wind,
      num clouds,
      num? rain,
      num? snow,
      @JsonKey(name: 'day_time') DateTime dayTime,
      DateTime? sunrise,
      DateTime? sunset,
      DateTime? moonrise,
      DateTime? moonset});

  $TemperatureCopyWith<$Res> get temperature;
  $FeelsLikeCopyWith<$Res> get feelsLike;
  $WeatherModuleWeatherCopyWith<$Res> get weather;
  $WeatherModuleWindCopyWith<$Res> get wind;
}

/// @nodoc
class _$WeatherModuleForecastDayCopyWithImpl<$Res,
        $Val extends WeatherModuleForecastDay>
    implements $WeatherModuleForecastDayCopyWith<$Res> {
  _$WeatherModuleForecastDayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleForecastDay
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
    Object? dayTime = null,
    Object? sunrise = freezed,
    Object? sunset = freezed,
    Object? moonrise = freezed,
    Object? moonset = freezed,
  }) {
    return _then(_value.copyWith(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as Temperature,
      feelsLike: null == feelsLike
          ? _value.feelsLike
          : feelsLike // ignore: cast_nullable_to_non_nullable
              as FeelsLike,
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
              as WeatherModuleWeather,
      wind: null == wind
          ? _value.wind
          : wind // ignore: cast_nullable_to_non_nullable
              as WeatherModuleWind,
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
      dayTime: null == dayTime
          ? _value.dayTime
          : dayTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunrise: freezed == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      sunset: freezed == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      moonrise: freezed == moonrise
          ? _value.moonrise
          : moonrise // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      moonset: freezed == moonset
          ? _value.moonset
          : moonset // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $TemperatureCopyWith<$Res> get temperature {
    return $TemperatureCopyWith<$Res>(_value.temperature, (value) {
      return _then(_value.copyWith(temperature: value) as $Val);
    });
  }

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $FeelsLikeCopyWith<$Res> get feelsLike {
    return $FeelsLikeCopyWith<$Res>(_value.feelsLike, (value) {
      return _then(_value.copyWith(feelsLike: value) as $Val);
    });
  }

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherModuleWeatherCopyWith<$Res> get weather {
    return $WeatherModuleWeatherCopyWith<$Res>(_value.weather, (value) {
      return _then(_value.copyWith(weather: value) as $Val);
    });
  }

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherModuleWindCopyWith<$Res> get wind {
    return $WeatherModuleWindCopyWith<$Res>(_value.wind, (value) {
      return _then(_value.copyWith(wind: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WeatherModuleForecastDayImplCopyWith<$Res>
    implements $WeatherModuleForecastDayCopyWith<$Res> {
  factory _$$WeatherModuleForecastDayImplCopyWith(
          _$WeatherModuleForecastDayImpl value,
          $Res Function(_$WeatherModuleForecastDayImpl) then) =
      __$$WeatherModuleForecastDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {Temperature temperature,
      @JsonKey(name: 'feels_like') FeelsLike feelsLike,
      num pressure,
      num humidity,
      WeatherModuleWeather weather,
      WeatherModuleWind wind,
      num clouds,
      num? rain,
      num? snow,
      @JsonKey(name: 'day_time') DateTime dayTime,
      DateTime? sunrise,
      DateTime? sunset,
      DateTime? moonrise,
      DateTime? moonset});

  @override
  $TemperatureCopyWith<$Res> get temperature;
  @override
  $FeelsLikeCopyWith<$Res> get feelsLike;
  @override
  $WeatherModuleWeatherCopyWith<$Res> get weather;
  @override
  $WeatherModuleWindCopyWith<$Res> get wind;
}

/// @nodoc
class __$$WeatherModuleForecastDayImplCopyWithImpl<$Res>
    extends _$WeatherModuleForecastDayCopyWithImpl<$Res,
        _$WeatherModuleForecastDayImpl>
    implements _$$WeatherModuleForecastDayImplCopyWith<$Res> {
  __$$WeatherModuleForecastDayImplCopyWithImpl(
      _$WeatherModuleForecastDayImpl _value,
      $Res Function(_$WeatherModuleForecastDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleForecastDay
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
    Object? dayTime = null,
    Object? sunrise = freezed,
    Object? sunset = freezed,
    Object? moonrise = freezed,
    Object? moonset = freezed,
  }) {
    return _then(_$WeatherModuleForecastDayImpl(
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as Temperature,
      feelsLike: null == feelsLike
          ? _value.feelsLike
          : feelsLike // ignore: cast_nullable_to_non_nullable
              as FeelsLike,
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
              as WeatherModuleWeather,
      wind: null == wind
          ? _value.wind
          : wind // ignore: cast_nullable_to_non_nullable
              as WeatherModuleWind,
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
      dayTime: null == dayTime
          ? _value.dayTime
          : dayTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunrise: freezed == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      sunset: freezed == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      moonrise: freezed == moonrise
          ? _value.moonrise
          : moonrise // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      moonset: freezed == moonset
          ? _value.moonset
          : moonset // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleForecastDayImpl implements _WeatherModuleForecastDay {
  const _$WeatherModuleForecastDayImpl(
      {required this.temperature,
      @JsonKey(name: 'feels_like') required this.feelsLike,
      required this.pressure,
      required this.humidity,
      required this.weather,
      required this.wind,
      required this.clouds,
      required this.rain,
      required this.snow,
      @JsonKey(name: 'day_time') required this.dayTime,
      this.sunrise,
      this.sunset,
      this.moonrise,
      this.moonset});

  factory _$WeatherModuleForecastDayImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherModuleForecastDayImplFromJson(json);

  /// Current temperatures during the day in degrees Celsius.
  @override
  final Temperature temperature;

  /// Perceived temperatures during the day based on wind and humidity.
  @override
  @JsonKey(name: 'feels_like')
  final FeelsLike feelsLike;

  /// Atmospheric pressure in hPa.
  @override
  final num pressure;

  /// Humidity level as a percentage.
  @override
  final num humidity;

  /// Detailed weather status.
  @override
  final WeatherModuleWeather weather;

  /// Wind conditions at the location.
  @override
  final WeatherModuleWind wind;

  /// Cloudiness percentage.
  @override
  final num clouds;

  /// Rain volume in the last hour (mm).
  @override
  final num? rain;

  /// Snow volume in the last hour (mm).
  @override
  final num? snow;

  /// Time of data calculation
  @override
  @JsonKey(name: 'day_time')
  final DateTime dayTime;

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  final DateTime? sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  final DateTime? sunset;

  /// Timestamp for moonrise in ISO 8601 format.
  @override
  final DateTime? moonrise;

  /// Timestamp for moonset in ISO 8601 format.
  @override
  final DateTime? moonset;

  @override
  String toString() {
    return 'WeatherModuleForecastDay(temperature: $temperature, feelsLike: $feelsLike, pressure: $pressure, humidity: $humidity, weather: $weather, wind: $wind, clouds: $clouds, rain: $rain, snow: $snow, dayTime: $dayTime, sunrise: $sunrise, sunset: $sunset, moonrise: $moonrise, moonset: $moonset)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleForecastDayImpl &&
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
            (identical(other.dayTime, dayTime) || other.dayTime == dayTime) &&
            (identical(other.sunrise, sunrise) || other.sunrise == sunrise) &&
            (identical(other.sunset, sunset) || other.sunset == sunset) &&
            (identical(other.moonrise, moonrise) ||
                other.moonrise == moonrise) &&
            (identical(other.moonset, moonset) || other.moonset == moonset));
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
      dayTime,
      sunrise,
      sunset,
      moonrise,
      moonset);

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleForecastDayImplCopyWith<_$WeatherModuleForecastDayImpl>
      get copyWith => __$$WeatherModuleForecastDayImplCopyWithImpl<
          _$WeatherModuleForecastDayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleForecastDayImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleForecastDay implements WeatherModuleForecastDay {
  const factory _WeatherModuleForecastDay(
      {required final Temperature temperature,
      @JsonKey(name: 'feels_like') required final FeelsLike feelsLike,
      required final num pressure,
      required final num humidity,
      required final WeatherModuleWeather weather,
      required final WeatherModuleWind wind,
      required final num clouds,
      required final num? rain,
      required final num? snow,
      @JsonKey(name: 'day_time') required final DateTime dayTime,
      final DateTime? sunrise,
      final DateTime? sunset,
      final DateTime? moonrise,
      final DateTime? moonset}) = _$WeatherModuleForecastDayImpl;

  factory _WeatherModuleForecastDay.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleForecastDayImpl.fromJson;

  /// Current temperatures during the day in degrees Celsius.
  @override
  Temperature get temperature;

  /// Perceived temperatures during the day based on wind and humidity.
  @override
  @JsonKey(name: 'feels_like')
  FeelsLike get feelsLike;

  /// Atmospheric pressure in hPa.
  @override
  num get pressure;

  /// Humidity level as a percentage.
  @override
  num get humidity;

  /// Detailed weather status.
  @override
  WeatherModuleWeather get weather;

  /// Wind conditions at the location.
  @override
  WeatherModuleWind get wind;

  /// Cloudiness percentage.
  @override
  num get clouds;

  /// Rain volume in the last hour (mm).
  @override
  num? get rain;

  /// Snow volume in the last hour (mm).
  @override
  num? get snow;

  /// Time of data calculation
  @override
  @JsonKey(name: 'day_time')
  DateTime get dayTime;

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  DateTime? get sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  DateTime? get sunset;

  /// Timestamp for moonrise in ISO 8601 format.
  @override
  DateTime? get moonrise;

  /// Timestamp for moonset in ISO 8601 format.
  @override
  DateTime? get moonset;

  /// Create a copy of WeatherModuleForecastDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleForecastDayImplCopyWith<_$WeatherModuleForecastDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}
