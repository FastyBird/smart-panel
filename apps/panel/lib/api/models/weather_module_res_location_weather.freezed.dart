// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_res_location_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleResLocationWeather _$WeatherModuleResLocationWeatherFromJson(
    Map<String, dynamic> json) {
  return _WeatherModuleResLocationWeather.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleResLocationWeather {
  /// Indicates whether the API request was successful (`success`) or encountered an error (`error`).
  String get status => throw _privateConstructorUsedError;

  /// Timestamp when the response was generated, in ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`).
  DateTime get timestamp => throw _privateConstructorUsedError;

  /// A unique identifier assigned to this API request. Useful for debugging and tracking API calls.
  @JsonKey(name: 'request_id')
  String get requestId => throw _privateConstructorUsedError;

  /// The API endpoint that was requested, including any dynamic parameters.
  String get path => throw _privateConstructorUsedError;

  /// The HTTP method used for the request (`GET`, `POST`, `PATCH`, `DELETE`).
  WeatherModuleResLocationWeatherMethod get method =>
      throw _privateConstructorUsedError;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  WeatherModuleLocationWeather get data => throw _privateConstructorUsedError;

  /// Additional metadata about the request and server performance metrics.
  CommonResMetadata get metadata => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleResLocationWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleResLocationWeatherCopyWith<WeatherModuleResLocationWeather>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleResLocationWeatherCopyWith<$Res> {
  factory $WeatherModuleResLocationWeatherCopyWith(
          WeatherModuleResLocationWeather value,
          $Res Function(WeatherModuleResLocationWeather) then) =
      _$WeatherModuleResLocationWeatherCopyWithImpl<$Res,
          WeatherModuleResLocationWeather>;
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      WeatherModuleResLocationWeatherMethod method,
      WeatherModuleLocationWeather data,
      CommonResMetadata metadata});

  $WeatherModuleLocationWeatherCopyWith<$Res> get data;
  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class _$WeatherModuleResLocationWeatherCopyWithImpl<$Res,
        $Val extends WeatherModuleResLocationWeather>
    implements $WeatherModuleResLocationWeatherCopyWith<$Res> {
  _$WeatherModuleResLocationWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? timestamp = null,
    Object? requestId = null,
    Object? path = null,
    Object? method = null,
    Object? data = null,
    Object? metadata = null,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      timestamp: null == timestamp
          ? _value.timestamp
          : timestamp // ignore: cast_nullable_to_non_nullable
              as DateTime,
      requestId: null == requestId
          ? _value.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String,
      path: null == path
          ? _value.path
          : path // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as WeatherModuleResLocationWeatherMethod,
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as WeatherModuleLocationWeather,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ) as $Val);
  }

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherModuleLocationWeatherCopyWith<$Res> get data {
    return $WeatherModuleLocationWeatherCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CommonResMetadataCopyWith<$Res> get metadata {
    return $CommonResMetadataCopyWith<$Res>(_value.metadata, (value) {
      return _then(_value.copyWith(metadata: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WeatherModuleResLocationWeatherImplCopyWith<$Res>
    implements $WeatherModuleResLocationWeatherCopyWith<$Res> {
  factory _$$WeatherModuleResLocationWeatherImplCopyWith(
          _$WeatherModuleResLocationWeatherImpl value,
          $Res Function(_$WeatherModuleResLocationWeatherImpl) then) =
      __$$WeatherModuleResLocationWeatherImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      WeatherModuleResLocationWeatherMethod method,
      WeatherModuleLocationWeather data,
      CommonResMetadata metadata});

  @override
  $WeatherModuleLocationWeatherCopyWith<$Res> get data;
  @override
  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class __$$WeatherModuleResLocationWeatherImplCopyWithImpl<$Res>
    extends _$WeatherModuleResLocationWeatherCopyWithImpl<$Res,
        _$WeatherModuleResLocationWeatherImpl>
    implements _$$WeatherModuleResLocationWeatherImplCopyWith<$Res> {
  __$$WeatherModuleResLocationWeatherImplCopyWithImpl(
      _$WeatherModuleResLocationWeatherImpl _value,
      $Res Function(_$WeatherModuleResLocationWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? timestamp = null,
    Object? requestId = null,
    Object? path = null,
    Object? method = null,
    Object? data = null,
    Object? metadata = null,
  }) {
    return _then(_$WeatherModuleResLocationWeatherImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      timestamp: null == timestamp
          ? _value.timestamp
          : timestamp // ignore: cast_nullable_to_non_nullable
              as DateTime,
      requestId: null == requestId
          ? _value.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String,
      path: null == path
          ? _value.path
          : path // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as WeatherModuleResLocationWeatherMethod,
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as WeatherModuleLocationWeather,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleResLocationWeatherImpl
    implements _WeatherModuleResLocationWeather {
  const _$WeatherModuleResLocationWeatherImpl(
      {required this.status,
      required this.timestamp,
      @JsonKey(name: 'request_id') required this.requestId,
      required this.path,
      required this.method,
      required this.data,
      required this.metadata});

  factory _$WeatherModuleResLocationWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$WeatherModuleResLocationWeatherImplFromJson(json);

  /// Indicates whether the API request was successful (`success`) or encountered an error (`error`).
  @override
  final String status;

  /// Timestamp when the response was generated, in ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`).
  @override
  final DateTime timestamp;

  /// A unique identifier assigned to this API request. Useful for debugging and tracking API calls.
  @override
  @JsonKey(name: 'request_id')
  final String requestId;

  /// The API endpoint that was requested, including any dynamic parameters.
  @override
  final String path;

  /// The HTTP method used for the request (`GET`, `POST`, `PATCH`, `DELETE`).
  @override
  final WeatherModuleResLocationWeatherMethod method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  final WeatherModuleLocationWeather data;

  /// Additional metadata about the request and server performance metrics.
  @override
  final CommonResMetadata metadata;

  @override
  String toString() {
    return 'WeatherModuleResLocationWeather(status: $status, timestamp: $timestamp, requestId: $requestId, path: $path, method: $method, data: $data, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleResLocationWeatherImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.timestamp, timestamp) ||
                other.timestamp == timestamp) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            (identical(other.path, path) || other.path == path) &&
            (identical(other.method, method) || other.method == method) &&
            (identical(other.data, data) || other.data == data) &&
            (identical(other.metadata, metadata) ||
                other.metadata == metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, status, timestamp, requestId, path, method, data, metadata);

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleResLocationWeatherImplCopyWith<
          _$WeatherModuleResLocationWeatherImpl>
      get copyWith => __$$WeatherModuleResLocationWeatherImplCopyWithImpl<
          _$WeatherModuleResLocationWeatherImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleResLocationWeatherImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleResLocationWeather
    implements WeatherModuleResLocationWeather {
  const factory _WeatherModuleResLocationWeather(
          {required final String status,
          required final DateTime timestamp,
          @JsonKey(name: 'request_id') required final String requestId,
          required final String path,
          required final WeatherModuleResLocationWeatherMethod method,
          required final WeatherModuleLocationWeather data,
          required final CommonResMetadata metadata}) =
      _$WeatherModuleResLocationWeatherImpl;

  factory _WeatherModuleResLocationWeather.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleResLocationWeatherImpl.fromJson;

  /// Indicates whether the API request was successful (`success`) or encountered an error (`error`).
  @override
  String get status;

  /// Timestamp when the response was generated, in ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`).
  @override
  DateTime get timestamp;

  /// A unique identifier assigned to this API request. Useful for debugging and tracking API calls.
  @override
  @JsonKey(name: 'request_id')
  String get requestId;

  /// The API endpoint that was requested, including any dynamic parameters.
  @override
  String get path;

  /// The HTTP method used for the request (`GET`, `POST`, `PATCH`, `DELETE`).
  @override
  WeatherModuleResLocationWeatherMethod get method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  WeatherModuleLocationWeather get data;

  /// Additional metadata about the request and server performance metrics.
  @override
  CommonResMetadata get metadata;

  /// Create a copy of WeatherModuleResLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleResLocationWeatherImplCopyWith<
          _$WeatherModuleResLocationWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
