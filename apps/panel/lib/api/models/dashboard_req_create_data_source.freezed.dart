// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateDataSource _$DashboardReqCreateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreateDataSource {
  DashboardReqCreateDataSourceDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateDataSourceCopyWith<DashboardReqCreateDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateDataSourceCopyWith<$Res> {
  factory $DashboardReqCreateDataSourceCopyWith(
          DashboardReqCreateDataSource value,
          $Res Function(DashboardReqCreateDataSource) then) =
      _$DashboardReqCreateDataSourceCopyWithImpl<$Res,
          DashboardReqCreateDataSource>;
  @useResult
  $Res call({DashboardReqCreateDataSourceDataUnion data});

  $DashboardReqCreateDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardReqCreateDataSource>
    implements $DashboardReqCreateDataSourceCopyWith<$Res> {
  _$DashboardReqCreateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreateDataSourceDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreateDataSourceDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreateDataSourceDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreateDataSourceImplCopyWith<$Res>
    implements $DashboardReqCreateDataSourceCopyWith<$Res> {
  factory _$$DashboardReqCreateDataSourceImplCopyWith(
          _$DashboardReqCreateDataSourceImpl value,
          $Res Function(_$DashboardReqCreateDataSourceImpl) then) =
      __$$DashboardReqCreateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreateDataSourceDataUnion data});

  @override
  $DashboardReqCreateDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateDataSourceCopyWithImpl<$Res,
        _$DashboardReqCreateDataSourceImpl>
    implements _$$DashboardReqCreateDataSourceImplCopyWith<$Res> {
  __$$DashboardReqCreateDataSourceImplCopyWithImpl(
      _$DashboardReqCreateDataSourceImpl _value,
      $Res Function(_$DashboardReqCreateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreateDataSourceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreateDataSourceDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreateDataSourceImpl
    implements _DashboardReqCreateDataSource {
  const _$DashboardReqCreateDataSourceImpl({required this.data});

  factory _$DashboardReqCreateDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateDataSourceImplFromJson(json);

  @override
  final DashboardReqCreateDataSourceDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreateDataSource(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateDataSourceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateDataSourceImplCopyWith<
          _$DashboardReqCreateDataSourceImpl>
      get copyWith => __$$DashboardReqCreateDataSourceImplCopyWithImpl<
          _$DashboardReqCreateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreateDataSource
    implements DashboardReqCreateDataSource {
  const factory _DashboardReqCreateDataSource(
          {required final DashboardReqCreateDataSourceDataUnion data}) =
      _$DashboardReqCreateDataSourceImpl;

  factory _DashboardReqCreateDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreateDataSourceImpl.fromJson;

  @override
  DashboardReqCreateDataSourceDataUnion get data;

  /// Create a copy of DashboardReqCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateDataSourceImplCopyWith<
          _$DashboardReqCreateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
