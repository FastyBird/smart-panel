// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePageDataSource _$DashboardReqCreatePageDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreatePageDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreatePageDataSource {
  DashboardReqCreatePageDataSourceDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePageDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePageDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageDataSourceCopyWith<DashboardReqCreatePageDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageDataSourceCopyWith<$Res> {
  factory $DashboardReqCreatePageDataSourceCopyWith(
          DashboardReqCreatePageDataSource value,
          $Res Function(DashboardReqCreatePageDataSource) then) =
      _$DashboardReqCreatePageDataSourceCopyWithImpl<$Res,
          DashboardReqCreatePageDataSource>;
  @useResult
  $Res call({DashboardReqCreatePageDataSourceDataUnion data});

  $DashboardReqCreatePageDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreatePageDataSourceCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePageDataSource>
    implements $DashboardReqCreatePageDataSourceCopyWith<$Res> {
  _$DashboardReqCreatePageDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePageDataSource
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
              as DashboardReqCreatePageDataSourceDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreatePageDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreatePageDataSourceDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreatePageDataSourceDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreatePageDataSourceImplCopyWith<$Res>
    implements $DashboardReqCreatePageDataSourceCopyWith<$Res> {
  factory _$$DashboardReqCreatePageDataSourceImplCopyWith(
          _$DashboardReqCreatePageDataSourceImpl value,
          $Res Function(_$DashboardReqCreatePageDataSourceImpl) then) =
      __$$DashboardReqCreatePageDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreatePageDataSourceDataUnion data});

  @override
  $DashboardReqCreatePageDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreatePageDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageDataSourceCopyWithImpl<$Res,
        _$DashboardReqCreatePageDataSourceImpl>
    implements _$$DashboardReqCreatePageDataSourceImplCopyWith<$Res> {
  __$$DashboardReqCreatePageDataSourceImplCopyWithImpl(
      _$DashboardReqCreatePageDataSourceImpl _value,
      $Res Function(_$DashboardReqCreatePageDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreatePageDataSourceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreatePageDataSourceDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageDataSourceImpl
    implements _DashboardReqCreatePageDataSource {
  const _$DashboardReqCreatePageDataSourceImpl({required this.data});

  factory _$DashboardReqCreatePageDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataSourceImplFromJson(json);

  @override
  final DashboardReqCreatePageDataSourceDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreatePageDataSource(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataSourceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreatePageDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageDataSourceImplCopyWith<
          _$DashboardReqCreatePageDataSourceImpl>
      get copyWith => __$$DashboardReqCreatePageDataSourceImplCopyWithImpl<
          _$DashboardReqCreatePageDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreatePageDataSource
    implements DashboardReqCreatePageDataSource {
  const factory _DashboardReqCreatePageDataSource(
          {required final DashboardReqCreatePageDataSourceDataUnion data}) =
      _$DashboardReqCreatePageDataSourceImpl;

  factory _DashboardReqCreatePageDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataSourceImpl.fromJson;

  @override
  DashboardReqCreatePageDataSourceDataUnion get data;

  /// Create a copy of DashboardReqCreatePageDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageDataSourceImplCopyWith<
          _$DashboardReqCreatePageDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
