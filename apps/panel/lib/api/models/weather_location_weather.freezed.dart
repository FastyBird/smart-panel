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
  WeatherCurrentDay get current => throw _privateConstructorUsedError;

  /// List of daily weather forecasts.
  List<WeatherForecastDay> get forecast => throw _privateConstructorUsedError;

  /// Details of the location where the weather data is recorded.
  WeatherLocation get location => throw _privateConstructorUsedError;

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
      {WeatherCurrentDay current,
      List<WeatherForecastDay> forecast,
      WeatherLocation location});

  $WeatherCurrentDayCopyWith<$Res> get current;
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
  }) {
    return _then(_value.copyWith(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherCurrentDay,
      forecast: null == forecast
          ? _value.forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherForecastDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherLocation,
    ) as $Val);
  }

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherCurrentDayCopyWith<$Res> get current {
    return $WeatherCurrentDayCopyWith<$Res>(_value.current, (value) {
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
      {WeatherCurrentDay current,
      List<WeatherForecastDay> forecast,
      WeatherLocation location});

  @override
  $WeatherCurrentDayCopyWith<$Res> get current;
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
  }) {
    return _then(_$WeatherLocationWeatherImpl(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherCurrentDay,
      forecast: null == forecast
          ? _value._forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherForecastDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherLocation,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherLocationWeatherImpl implements _WeatherLocationWeather {
  const _$WeatherLocationWeatherImpl(
      {required this.current,
      required final List<WeatherForecastDay> forecast,
      required this.location})
      : _forecast = forecast;

  factory _$WeatherLocationWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherLocationWeatherImplFromJson(json);

  /// Current weather conditions at the specified location.
  @override
  final WeatherCurrentDay current;

  /// List of daily weather forecasts.
  final List<WeatherForecastDay> _forecast;

  /// List of daily weather forecasts.
  @override
  List<WeatherForecastDay> get forecast {
    if (_forecast is EqualUnmodifiableListView) return _forecast;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_forecast);
  }

  /// Details of the location where the weather data is recorded.
  @override
  final WeatherLocation location;

  @override
  String toString() {
    return 'WeatherLocationWeather(current: $current, forecast: $forecast, location: $location)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherLocationWeatherImpl &&
            (identical(other.current, current) || other.current == current) &&
            const DeepCollectionEquality().equals(other._forecast, _forecast) &&
            (identical(other.location, location) ||
                other.location == location));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, current,
      const DeepCollectionEquality().hash(_forecast), location);

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
      {required final WeatherCurrentDay current,
      required final List<WeatherForecastDay> forecast,
      required final WeatherLocation location}) = _$WeatherLocationWeatherImpl;

  factory _WeatherLocationWeather.fromJson(Map<String, dynamic> json) =
      _$WeatherLocationWeatherImpl.fromJson;

  /// Current weather conditions at the specified location.
  @override
  WeatherCurrentDay get current;

  /// List of daily weather forecasts.
  @override
  List<WeatherForecastDay> get forecast;

  /// Details of the location where the weather data is recorded.
  @override
  WeatherLocation get location;

  /// Create a copy of WeatherLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherLocationWeatherImplCopyWith<_$WeatherLocationWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
