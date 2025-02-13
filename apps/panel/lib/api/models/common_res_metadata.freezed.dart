// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'common_res_metadata.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

CommonResMetadata _$CommonResMetadataFromJson(Map<String, dynamic> json) {
  return _CommonResMetadata.fromJson(json);
}

/// @nodoc
mixin _$CommonResMetadata {
  /// The total time taken to process the request, in milliseconds.
  @JsonKey(name: 'request_duration_ms')
  double get requestDurationMs => throw _privateConstructorUsedError;

  /// The server's current timestamp when the response was generated, in ISO 8601 format.
  @JsonKey(name: 'server_time')
  DateTime get serverTime => throw _privateConstructorUsedError;

  /// The CPU usage percentage at the time of processing the request. This can be useful for performance monitoring.
  @JsonKey(name: 'cpu_usage')
  double get cpuUsage => throw _privateConstructorUsedError;

  /// Serializes this CommonResMetadata to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CommonResMetadata
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CommonResMetadataCopyWith<CommonResMetadata> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CommonResMetadataCopyWith<$Res> {
  factory $CommonResMetadataCopyWith(
          CommonResMetadata value, $Res Function(CommonResMetadata) then) =
      _$CommonResMetadataCopyWithImpl<$Res, CommonResMetadata>;
  @useResult
  $Res call(
      {@JsonKey(name: 'request_duration_ms') double requestDurationMs,
      @JsonKey(name: 'server_time') DateTime serverTime,
      @JsonKey(name: 'cpu_usage') double cpuUsage});
}

/// @nodoc
class _$CommonResMetadataCopyWithImpl<$Res, $Val extends CommonResMetadata>
    implements $CommonResMetadataCopyWith<$Res> {
  _$CommonResMetadataCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CommonResMetadata
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? requestDurationMs = null,
    Object? serverTime = null,
    Object? cpuUsage = null,
  }) {
    return _then(_value.copyWith(
      requestDurationMs: null == requestDurationMs
          ? _value.requestDurationMs
          : requestDurationMs // ignore: cast_nullable_to_non_nullable
              as double,
      serverTime: null == serverTime
          ? _value.serverTime
          : serverTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      cpuUsage: null == cpuUsage
          ? _value.cpuUsage
          : cpuUsage // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CommonResMetadataImplCopyWith<$Res>
    implements $CommonResMetadataCopyWith<$Res> {
  factory _$$CommonResMetadataImplCopyWith(_$CommonResMetadataImpl value,
          $Res Function(_$CommonResMetadataImpl) then) =
      __$$CommonResMetadataImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'request_duration_ms') double requestDurationMs,
      @JsonKey(name: 'server_time') DateTime serverTime,
      @JsonKey(name: 'cpu_usage') double cpuUsage});
}

/// @nodoc
class __$$CommonResMetadataImplCopyWithImpl<$Res>
    extends _$CommonResMetadataCopyWithImpl<$Res, _$CommonResMetadataImpl>
    implements _$$CommonResMetadataImplCopyWith<$Res> {
  __$$CommonResMetadataImplCopyWithImpl(_$CommonResMetadataImpl _value,
      $Res Function(_$CommonResMetadataImpl) _then)
      : super(_value, _then);

  /// Create a copy of CommonResMetadata
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? requestDurationMs = null,
    Object? serverTime = null,
    Object? cpuUsage = null,
  }) {
    return _then(_$CommonResMetadataImpl(
      requestDurationMs: null == requestDurationMs
          ? _value.requestDurationMs
          : requestDurationMs // ignore: cast_nullable_to_non_nullable
              as double,
      serverTime: null == serverTime
          ? _value.serverTime
          : serverTime // ignore: cast_nullable_to_non_nullable
              as DateTime,
      cpuUsage: null == cpuUsage
          ? _value.cpuUsage
          : cpuUsage // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CommonResMetadataImpl implements _CommonResMetadata {
  const _$CommonResMetadataImpl(
      {@JsonKey(name: 'request_duration_ms') required this.requestDurationMs,
      @JsonKey(name: 'server_time') required this.serverTime,
      @JsonKey(name: 'cpu_usage') required this.cpuUsage});

  factory _$CommonResMetadataImpl.fromJson(Map<String, dynamic> json) =>
      _$$CommonResMetadataImplFromJson(json);

  /// The total time taken to process the request, in milliseconds.
  @override
  @JsonKey(name: 'request_duration_ms')
  final double requestDurationMs;

  /// The server's current timestamp when the response was generated, in ISO 8601 format.
  @override
  @JsonKey(name: 'server_time')
  final DateTime serverTime;

  /// The CPU usage percentage at the time of processing the request. This can be useful for performance monitoring.
  @override
  @JsonKey(name: 'cpu_usage')
  final double cpuUsage;

  @override
  String toString() {
    return 'CommonResMetadata(requestDurationMs: $requestDurationMs, serverTime: $serverTime, cpuUsage: $cpuUsage)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CommonResMetadataImpl &&
            (identical(other.requestDurationMs, requestDurationMs) ||
                other.requestDurationMs == requestDurationMs) &&
            (identical(other.serverTime, serverTime) ||
                other.serverTime == serverTime) &&
            (identical(other.cpuUsage, cpuUsage) ||
                other.cpuUsage == cpuUsage));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, requestDurationMs, serverTime, cpuUsage);

  /// Create a copy of CommonResMetadata
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CommonResMetadataImplCopyWith<_$CommonResMetadataImpl> get copyWith =>
      __$$CommonResMetadataImplCopyWithImpl<_$CommonResMetadataImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CommonResMetadataImplToJson(
      this,
    );
  }
}

abstract class _CommonResMetadata implements CommonResMetadata {
  const factory _CommonResMetadata(
          {@JsonKey(name: 'request_duration_ms')
          required final double requestDurationMs,
          @JsonKey(name: 'server_time') required final DateTime serverTime,
          @JsonKey(name: 'cpu_usage') required final double cpuUsage}) =
      _$CommonResMetadataImpl;

  factory _CommonResMetadata.fromJson(Map<String, dynamic> json) =
      _$CommonResMetadataImpl.fromJson;

  /// The total time taken to process the request, in milliseconds.
  @override
  @JsonKey(name: 'request_duration_ms')
  double get requestDurationMs;

  /// The server's current timestamp when the response was generated, in ISO 8601 format.
  @override
  @JsonKey(name: 'server_time')
  DateTime get serverTime;

  /// The CPU usage percentage at the time of processing the request. This can be useful for performance monitoring.
  @override
  @JsonKey(name: 'cpu_usage')
  double get cpuUsage;

  /// Create a copy of CommonResMetadata
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CommonResMetadataImplCopyWith<_$CommonResMetadataImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
