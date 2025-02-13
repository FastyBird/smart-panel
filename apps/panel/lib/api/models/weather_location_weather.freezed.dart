// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_location_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherLocationWeather _$WeatherLocationWeatherFromJson(
    Map<String, dynamic> json) {
  return _WeatherLocationWeather.fromJson(json);
}

/// @nodoc
mixin _$WeatherLocationWeather {
  /// Current weather conditions at the specified location.
  WeatherDay get current => throw _privateConstructorUsedError;

  /// List of daily weather forecasts.
  List<WeatherDay> get forecast => throw _privateConstructorUsedError;

  /// Details of the location where the weather data is recorded.
  WeatherLocation get location => throw _privateConstructorUsedError;

  /// Timestamp for sunrise in ISO 8601 format.
  DateTime get sunrise => throw _privateConstructorUsedError;

  /// Timestamp for sunset in ISO 8601 format.
  DateTime get sunset => throw _privateConstructorUsedError;

  /// Timestamp when the weather data was last updated.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this WeatherLocationWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherLocationWeatherCopyWith<WeatherLocationWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherLocationWeatherCopyWith<$Res> {
  factory $WeatherLocationWeatherCopyWith(WeatherLocationWeather value,
          $Res Function(WeatherLocationWeather) then) =
      _$WeatherLocationWeatherCopyWithImpl<$Res, WeatherLocationWeather>;
  @useResult
  $Res call(
      {WeatherDay current,
      List<WeatherDay> forecast,
      WeatherLocation location,
      DateTime sunrise,
      DateTime sunset,
      @JsonKey(name: 'created_at') DateTime createdAt});

  $WeatherDayCopyWith<$Res> get current;
  $WeatherLocationCopyWith<$Res> get location;
}

/// @nodoc
class _$WeatherLocationWeatherCopyWithImpl<$Res,
        $Val extends WeatherLocationWeather>
    implements $WeatherLocationWeatherCopyWith<$Res> {
  _$WeatherLocationWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? forecast = null,
    Object? location = null,
    Object? sunrise = null,
    Object? sunset = null,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherDay,
      forecast: null == forecast
          ? _value.forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherLocation,
      sunrise: null == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunset: null == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherDayCopyWith<$Res> get current {
    return $WeatherDayCopyWith<$Res>(_value.current, (value) {
      return _then(_value.copyWith(current: value) as $Val);
    });
  }

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherLocationCopyWith<$Res> get location {
    return $WeatherLocationCopyWith<$Res>(_value.location, (value) {
      return _then(_value.copyWith(location: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WeatherLocationWeatherImplCopyWith<$Res>
    implements $WeatherLocationWeatherCopyWith<$Res> {
  factory _$$WeatherLocationWeatherImplCopyWith(
          _$WeatherLocationWeatherImpl value,
          $Res Function(_$WeatherLocationWeatherImpl) then) =
      __$$WeatherLocationWeatherImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {WeatherDay current,
      List<WeatherDay> forecast,
      WeatherLocation location,
      DateTime sunrise,
      DateTime sunset,
      @JsonKey(name: 'created_at') DateTime createdAt});

  @override
  $WeatherDayCopyWith<$Res> get current;
  @override
  $WeatherLocationCopyWith<$Res> get location;
}

/// @nodoc
class __$$WeatherLocationWeatherImplCopyWithImpl<$Res>
    extends _$WeatherLocationWeatherCopyWithImpl<$Res,
        _$WeatherLocationWeatherImpl>
    implements _$$WeatherLocationWeatherImplCopyWith<$Res> {
  __$$WeatherLocationWeatherImplCopyWithImpl(
      _$WeatherLocationWeatherImpl _value,
      $Res Function(_$WeatherLocationWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? forecast = null,
    Object? location = null,
    Object? sunrise = null,
    Object? sunset = null,
    Object? createdAt = null,
  }) {
    return _then(_$WeatherLocationWeatherImpl(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherDay,
      forecast: null == forecast
          ? _value._forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherLocation,
      sunrise: null == sunrise
          ? _value.sunrise
          : sunrise // ignore: cast_nullable_to_non_nullable
              as DateTime,
      sunset: null == sunset
          ? _value.sunset
          : sunset // ignore: cast_nullable_to_non_nullable
              as DateTime,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherLocationWeatherImpl implements _WeatherLocationWeather {
  const _$WeatherLocationWeatherImpl(
      {required this.current,
      required final List<WeatherDay> forecast,
      required this.location,
      required this.sunrise,
      required this.sunset,
      @JsonKey(name: 'created_at') required this.createdAt})
      : _forecast = forecast;

  factory _$WeatherLocationWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherLocationWeatherImplFromJson(json);

  /// Current weather conditions at the specified location.
  @override
  final WeatherDay current;

  /// List of daily weather forecasts.
  final List<WeatherDay> _forecast;

  /// List of daily weather forecasts.
  @override
  List<WeatherDay> get forecast {
    if (_forecast is EqualUnmodifiableListView) return _forecast;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_forecast);
  }

  /// Details of the location where the weather data is recorded.
  @override
  final WeatherLocation location;

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  final DateTime sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  final DateTime sunset;

  /// Timestamp when the weather data was last updated.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  @override
  String toString() {
    return 'WeatherLocationWeather(current: $current, forecast: $forecast, location: $location, sunrise: $sunrise, sunset: $sunset, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherLocationWeatherImpl &&
            (identical(other.current, current) || other.current == current) &&
            const DeepCollectionEquality().equals(other._forecast, _forecast) &&
            (identical(other.location, location) ||
                other.location == location) &&
            (identical(other.sunrise, sunrise) || other.sunrise == sunrise) &&
            (identical(other.sunset, sunset) || other.sunset == sunset) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      current,
      const DeepCollectionEquality().hash(_forecast),
      location,
      sunrise,
      sunset,
      createdAt);

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherLocationWeatherImplCopyWith<_$WeatherLocationWeatherImpl>
      get copyWith => __$$WeatherLocationWeatherImplCopyWithImpl<
          _$WeatherLocationWeatherImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherLocationWeatherImplToJson(
      this,
    );
  }
}

abstract class _WeatherLocationWeather implements WeatherLocationWeather {
  const factory _WeatherLocationWeather(
          {required final WeatherDay current,
          required final List<WeatherDay> forecast,
          required final WeatherLocation location,
          required final DateTime sunrise,
          required final DateTime sunset,
          @JsonKey(name: 'created_at') required final DateTime createdAt}) =
      _$WeatherLocationWeatherImpl;

  factory _WeatherLocationWeather.fromJson(Map<String, dynamic> json) =
      _$WeatherLocationWeatherImpl.fromJson;

  /// Current weather conditions at the specified location.
  @override
  WeatherDay get current;

  /// List of daily weather forecasts.
  @override
  List<WeatherDay> get forecast;

  /// Details of the location where the weather data is recorded.
  @override
  WeatherLocation get location;

  /// Timestamp for sunrise in ISO 8601 format.
  @override
  DateTime get sunrise;

  /// Timestamp for sunset in ISO 8601 format.
  @override
  DateTime get sunset;

  /// Timestamp when the weather data was last updated.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherLocationWeatherImplCopyWith<_$WeatherLocationWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
