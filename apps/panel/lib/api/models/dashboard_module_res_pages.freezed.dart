// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_res_pages.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleResPages _$DashboardModuleResPagesFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleResPages.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleResPages {
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
  DashboardModuleResPagesMethod get method =>
      throw _privateConstructorUsedError;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  List<DashboardModulePage> get data => throw _privateConstructorUsedError;

  /// Additional metadata about the request and server performance metrics.
  CommonResMetadata get metadata => throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleResPages to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleResPages
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleResPagesCopyWith<DashboardModuleResPages> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleResPagesCopyWith<$Res> {
  factory $DashboardModuleResPagesCopyWith(DashboardModuleResPages value,
          $Res Function(DashboardModuleResPages) then) =
      _$DashboardModuleResPagesCopyWithImpl<$Res, DashboardModuleResPages>;
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      DashboardModuleResPagesMethod method,
      List<DashboardModulePage> data,
      CommonResMetadata metadata});

  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class _$DashboardModuleResPagesCopyWithImpl<$Res,
        $Val extends DashboardModuleResPages>
    implements $DashboardModuleResPagesCopyWith<$Res> {
  _$DashboardModuleResPagesCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleResPages
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
              as DashboardModuleResPagesMethod,
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as List<DashboardModulePage>,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ) as $Val);
  }

  /// Create a copy of DashboardModuleResPages
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
abstract class _$$DashboardModuleResPagesImplCopyWith<$Res>
    implements $DashboardModuleResPagesCopyWith<$Res> {
  factory _$$DashboardModuleResPagesImplCopyWith(
          _$DashboardModuleResPagesImpl value,
          $Res Function(_$DashboardModuleResPagesImpl) then) =
      __$$DashboardModuleResPagesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String status,
      DateTime timestamp,
      @JsonKey(name: 'request_id') String requestId,
      String path,
      DashboardModuleResPagesMethod method,
      List<DashboardModulePage> data,
      CommonResMetadata metadata});

  @override
  $CommonResMetadataCopyWith<$Res> get metadata;
}

/// @nodoc
class __$$DashboardModuleResPagesImplCopyWithImpl<$Res>
    extends _$DashboardModuleResPagesCopyWithImpl<$Res,
        _$DashboardModuleResPagesImpl>
    implements _$$DashboardModuleResPagesImplCopyWith<$Res> {
  __$$DashboardModuleResPagesImplCopyWithImpl(
      _$DashboardModuleResPagesImpl _value,
      $Res Function(_$DashboardModuleResPagesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleResPages
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
    return _then(_$DashboardModuleResPagesImpl(
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
              as DashboardModuleResPagesMethod,
      data: null == data
          ? _value._data
          : data // ignore: cast_nullable_to_non_nullable
              as List<DashboardModulePage>,
      metadata: null == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as CommonResMetadata,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleResPagesImpl implements _DashboardModuleResPages {
  const _$DashboardModuleResPagesImpl(
      {required this.status,
      required this.timestamp,
      @JsonKey(name: 'request_id') required this.requestId,
      required this.path,
      required this.method,
      required final List<DashboardModulePage> data,
      required this.metadata})
      : _data = data;

  factory _$DashboardModuleResPagesImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardModuleResPagesImplFromJson(json);

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
  final DashboardModuleResPagesMethod method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  final List<DashboardModulePage> _data;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  List<DashboardModulePage> get data {
    if (_data is EqualUnmodifiableListView) return _data;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_data);
  }

  /// Additional metadata about the request and server performance metrics.
  @override
  final CommonResMetadata metadata;

  @override
  String toString() {
    return 'DashboardModuleResPages(status: $status, timestamp: $timestamp, requestId: $requestId, path: $path, method: $method, data: $data, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleResPagesImpl &&
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

  /// Create a copy of DashboardModuleResPages
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleResPagesImplCopyWith<_$DashboardModuleResPagesImpl>
      get copyWith => __$$DashboardModuleResPagesImplCopyWithImpl<
          _$DashboardModuleResPagesImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleResPagesImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleResPages implements DashboardModuleResPages {
  const factory _DashboardModuleResPages(
          {required final String status,
          required final DateTime timestamp,
          @JsonKey(name: 'request_id') required final String requestId,
          required final String path,
          required final DashboardModuleResPagesMethod method,
          required final List<DashboardModulePage> data,
          required final CommonResMetadata metadata}) =
      _$DashboardModuleResPagesImpl;

  factory _DashboardModuleResPages.fromJson(Map<String, dynamic> json) =
      _$DashboardModuleResPagesImpl.fromJson;

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
  DashboardModuleResPagesMethod get method;

  /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
  @override
  List<DashboardModulePage> get data;

  /// Additional metadata about the request and server performance metrics.
  @override
  CommonResMetadata get metadata;

  /// Create a copy of DashboardModuleResPages
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleResPagesImplCopyWith<_$DashboardModuleResPagesImpl>
      get copyWith => throw _privateConstructorUsedError;
}
