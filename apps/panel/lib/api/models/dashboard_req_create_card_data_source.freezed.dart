// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_card_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateCardDataSource _$DashboardReqCreateCardDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreateCardDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreateCardDataSource {
  DashboardReqCreateCardDataSourceDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateCardDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateCardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateCardDataSourceCopyWith<DashboardReqCreateCardDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateCardDataSourceCopyWith<$Res> {
  factory $DashboardReqCreateCardDataSourceCopyWith(
          DashboardReqCreateCardDataSource value,
          $Res Function(DashboardReqCreateCardDataSource) then) =
      _$DashboardReqCreateCardDataSourceCopyWithImpl<$Res,
          DashboardReqCreateCardDataSource>;
  @useResult
  $Res call({DashboardReqCreateCardDataSourceDataUnion data});

  $DashboardReqCreateCardDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreateCardDataSourceCopyWithImpl<$Res,
        $Val extends DashboardReqCreateCardDataSource>
    implements $DashboardReqCreateCardDataSourceCopyWith<$Res> {
  _$DashboardReqCreateCardDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateCardDataSource
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
              as DashboardReqCreateCardDataSourceDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreateCardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreateCardDataSourceDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreateCardDataSourceDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreateCardDataSourceImplCopyWith<$Res>
    implements $DashboardReqCreateCardDataSourceCopyWith<$Res> {
  factory _$$DashboardReqCreateCardDataSourceImplCopyWith(
          _$DashboardReqCreateCardDataSourceImpl value,
          $Res Function(_$DashboardReqCreateCardDataSourceImpl) then) =
      __$$DashboardReqCreateCardDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreateCardDataSourceDataUnion data});

  @override
  $DashboardReqCreateCardDataSourceDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreateCardDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardDataSourceCopyWithImpl<$Res,
        _$DashboardReqCreateCardDataSourceImpl>
    implements _$$DashboardReqCreateCardDataSourceImplCopyWith<$Res> {
  __$$DashboardReqCreateCardDataSourceImplCopyWithImpl(
      _$DashboardReqCreateCardDataSourceImpl _value,
      $Res Function(_$DashboardReqCreateCardDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreateCardDataSourceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreateCardDataSourceDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreateCardDataSourceImpl
    implements _DashboardReqCreateCardDataSource {
  const _$DashboardReqCreateCardDataSourceImpl({required this.data});

  factory _$DashboardReqCreateCardDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardDataSourceImplFromJson(json);

  @override
  final DashboardReqCreateCardDataSourceDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreateCardDataSource(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardDataSourceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreateCardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardDataSourceImplCopyWith<
          _$DashboardReqCreateCardDataSourceImpl>
      get copyWith => __$$DashboardReqCreateCardDataSourceImplCopyWithImpl<
          _$DashboardReqCreateCardDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreateCardDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreateCardDataSource
    implements DashboardReqCreateCardDataSource {
  const factory _DashboardReqCreateCardDataSource(
          {required final DashboardReqCreateCardDataSourceDataUnion data}) =
      _$DashboardReqCreateCardDataSourceImpl;

  factory _DashboardReqCreateCardDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardDataSourceImpl.fromJson;

  @override
  DashboardReqCreateCardDataSourceDataUnion get data;

  /// Create a copy of DashboardReqCreateCardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardDataSourceImplCopyWith<
          _$DashboardReqCreateCardDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
