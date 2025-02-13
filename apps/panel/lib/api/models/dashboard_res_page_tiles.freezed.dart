// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_res_page_tiles.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardResPageTiles _$DashboardResPageTilesFromJson(
    Map<String, dynamic> json) {
  return _DashboardResPageTiles.fromJson(json);
}

/// @nodoc
mixin _$DashboardResPageTiles {
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
  DashboardResPageTilesMethod get method => throw _privateConstructorUsedError;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  List<DashboardResPageTilesDataUnion> get data =>
      throw _privateConstructorUsedError;

  /// Additional metadata about the request and server performance metrics.
  CommonResMetadata get metadata => throw _privateConstructorUsedError;

  /// Serializes this DashboardResPageTiles to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardResPageTiles
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardResPageTilesCopyWith<DashboardResPageTiles> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardResPageTilesCopyWith<$Res> {
  factory $DashboardResPageTilesCopyWith(DashboardResPageTiles value,
          $Res Function(DashboardResPageTiles) then) =
      _$DashboardResPageTilesCopyWithImpl<$Res, DashboardResPageTiles>;
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      DashboardResPageTilesMethod method,
      List<DashboardResPageTilesDataUnion> data,
      CommonResMetadata metadata});

  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class _$DashboardResPageTilesCopyWithImpl<$Res,
        $Val extends DashboardResPageTiles>
    implements $DashboardResPageTilesCopyWith<$Res> {
  _$DashboardResPageTilesCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardResPageTiles
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
              as DashboardResPageTilesMethod,
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as List<DashboardResPageTilesDataUnion>,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ) as $Val);
  }

  /// Create a copy of DashboardResPageTiles
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
abstract class _$$DashboardResPageTilesImplCopyWith<$Res>
    implements $DashboardResPageTilesCopyWith<$Res> {
  factory _$$DashboardResPageTilesImplCopyWith(
          _$DashboardResPageTilesImpl value,
          $Res Function(_$DashboardResPageTilesImpl) then) =
      __$$DashboardResPageTilesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      DashboardResPageTilesMethod method,
      List<DashboardResPageTilesDataUnion> data,
      CommonResMetadata metadata});

  @override
  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class __$$DashboardResPageTilesImplCopyWithImpl<$Res>
    extends _$DashboardResPageTilesCopyWithImpl<$Res,
        _$DashboardResPageTilesImpl>
    implements _$$DashboardResPageTilesImplCopyWith<$Res> {
  __$$DashboardResPageTilesImplCopyWithImpl(_$DashboardResPageTilesImpl _value,
      $Res Function(_$DashboardResPageTilesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageTiles
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
    return _then(_$DashboardResPageTilesImpl(
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
              as DashboardResPageTilesMethod,
      data: null == data
          ? _value._data
          : data // ignore: cast_nullable_to_non_nullable
              as List<DashboardResPageTilesDataUnion>,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageTilesImpl implements _DashboardResPageTiles {
  const _$DashboardResPageTilesImpl(
      {required this.status,
      required this.timestamp,
      @JsonKey(name: 'request_id') required this.requestId,
      required this.path,
      required this.method,
      required final List<DashboardResPageTilesDataUnion> data,
      required this.metadata})
      : _data = data;

  factory _$DashboardResPageTilesImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardResPageTilesImplFromJson(json);

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
  final DashboardResPageTilesMethod method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  final List<DashboardResPageTilesDataUnion> _data;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  List<DashboardResPageTilesDataUnion> get data {
    if (_data is EqualUnmodifiableListView) return _data;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_data);
  }

  /// Additional metadata about the request and server performance metrics.
  @override
  final CommonResMetadata metadata;

  @override
  String toString() {
    return 'DashboardResPageTiles(status: $status, timestamp: $timestamp, requestId: $requestId, path: $path, method: $method, data: $data, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageTilesImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.timestamp, timestamp) ||
                other.timestamp == timestamp) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            (identical(other.path, path) || other.path == path) &&
            (identical(other.method, method) || other.method == method) &&
            const DeepCollectionEquality().equals(other._data, _data) &&
            (identical(other.metadata, metadata) ||
                other.metadata == metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, timestamp, requestId,
      path, method, const DeepCollectionEquality().hash(_data), metadata);

  /// Create a copy of DashboardResPageTiles
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageTilesImplCopyWith<_$DashboardResPageTilesImpl>
      get copyWith => __$$DashboardResPageTilesImplCopyWithImpl<
          _$DashboardResPageTilesImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageTilesImplToJson(
      this,
    );
  }
}

abstract class _DashboardResPageTiles implements DashboardResPageTiles {
  const factory _DashboardResPageTiles(
      {required final String status,
      required final DateTime timestamp,
      @JsonKey(name: 'request_id') required final String requestId,
      required final String path,
      required final DashboardResPageTilesMethod method,
      required final List<DashboardResPageTilesDataUnion> data,
      required final CommonResMetadata metadata}) = _$DashboardResPageTilesImpl;

  factory _DashboardResPageTiles.fromJson(Map<String, dynamic> json) =
      _$DashboardResPageTilesImpl.fromJson;

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
  DashboardResPageTilesMethod get method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  List<DashboardResPageTilesDataUnion> get data;

  /// Additional metadata about the request and server performance metrics.
  @override
  CommonResMetadata get metadata;

  /// Create a copy of DashboardResPageTiles
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageTilesImplCopyWith<_$DashboardResPageTilesImpl>
      get copyWith => throw _privateConstructorUsedError;
}
