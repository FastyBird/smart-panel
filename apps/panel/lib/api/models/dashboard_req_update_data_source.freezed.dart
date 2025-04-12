// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdateDataSource _$DashboardReqUpdateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqUpdateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqUpdateDataSource {
  DashboardUpdateDataSource get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdateDataSourceCopyWith<DashboardReqUpdateDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdateDataSourceCopyWith<$Res> {
  factory $DashboardReqUpdateDataSourceCopyWith(
          DashboardReqUpdateDataSource value,
          $Res Function(DashboardReqUpdateDataSource) then) =
      _$DashboardReqUpdateDataSourceCopyWithImpl<$Res,
          DashboardReqUpdateDataSource>;
  @useResult
  $Res call({DashboardUpdateDataSource data});

  $DashboardUpdateDataSourceCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqUpdateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardReqUpdateDataSource>
    implements $DashboardReqUpdateDataSourceCopyWith<$Res> {
  _$DashboardReqUpdateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdateDataSource
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
              as DashboardUpdateDataSource,
    ) as $Val);
  }

  /// Create a copy of DashboardReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardUpdateDataSourceCopyWith<$Res> get data {
    return $DashboardUpdateDataSourceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdateDataSourceImplCopyWith<$Res>
    implements $DashboardReqUpdateDataSourceCopyWith<$Res> {
  factory _$$DashboardReqUpdateDataSourceImplCopyWith(
          _$DashboardReqUpdateDataSourceImpl value,
          $Res Function(_$DashboardReqUpdateDataSourceImpl) then) =
      __$$DashboardReqUpdateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardUpdateDataSource data});

  @override
  $DashboardUpdateDataSourceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqUpdateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateDataSourceCopyWithImpl<$Res,
        _$DashboardReqUpdateDataSourceImpl>
    implements _$$DashboardReqUpdateDataSourceImplCopyWith<$Res> {
  __$$DashboardReqUpdateDataSourceImplCopyWithImpl(
      _$DashboardReqUpdateDataSourceImpl _value,
      $Res Function(_$DashboardReqUpdateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqUpdateDataSourceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardUpdateDataSource,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateDataSourceImpl
    implements _DashboardReqUpdateDataSource {
  const _$DashboardReqUpdateDataSourceImpl({required this.data});

  factory _$DashboardReqUpdateDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateDataSourceImplFromJson(json);

  @override
  final DashboardUpdateDataSource data;

  @override
  String toString() {
    return 'DashboardReqUpdateDataSource(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateDataSourceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateDataSourceImplCopyWith<
          _$DashboardReqUpdateDataSourceImpl>
      get copyWith => __$$DashboardReqUpdateDataSourceImplCopyWithImpl<
          _$DashboardReqUpdateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqUpdateDataSource
    implements DashboardReqUpdateDataSource {
  const factory _DashboardReqUpdateDataSource(
          {required final DashboardUpdateDataSource data}) =
      _$DashboardReqUpdateDataSourceImpl;

  factory _DashboardReqUpdateDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardReqUpdateDataSourceImpl.fromJson;

  @override
  DashboardUpdateDataSource get data;

  /// Create a copy of DashboardReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateDataSourceImplCopyWith<
          _$DashboardReqUpdateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
