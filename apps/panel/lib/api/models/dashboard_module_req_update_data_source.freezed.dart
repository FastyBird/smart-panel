// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_req_update_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleReqUpdateDataSource _$DashboardModuleReqUpdateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleReqUpdateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleReqUpdateDataSource {
  DashboardModuleUpdateDataSource get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleReqUpdateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleReqUpdateDataSourceCopyWith<
          DashboardModuleReqUpdateDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleReqUpdateDataSourceCopyWith<$Res> {
  factory $DashboardModuleReqUpdateDataSourceCopyWith(
          DashboardModuleReqUpdateDataSource value,
          $Res Function(DashboardModuleReqUpdateDataSource) then) =
      _$DashboardModuleReqUpdateDataSourceCopyWithImpl<$Res,
          DashboardModuleReqUpdateDataSource>;
  @useResult
  $Res call({DashboardModuleUpdateDataSource data});

  $DashboardModuleUpdateDataSourceCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardModuleReqUpdateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardModuleReqUpdateDataSource>
    implements $DashboardModuleReqUpdateDataSourceCopyWith<$Res> {
  _$DashboardModuleReqUpdateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleReqUpdateDataSource
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
              as DashboardModuleUpdateDataSource,
    ) as $Val);
  }

  /// Create a copy of DashboardModuleReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardModuleUpdateDataSourceCopyWith<$Res> get data {
    return $DashboardModuleUpdateDataSourceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardModuleReqUpdateDataSourceImplCopyWith<$Res>
    implements $DashboardModuleReqUpdateDataSourceCopyWith<$Res> {
  factory _$$DashboardModuleReqUpdateDataSourceImplCopyWith(
          _$DashboardModuleReqUpdateDataSourceImpl value,
          $Res Function(_$DashboardModuleReqUpdateDataSourceImpl) then) =
      __$$DashboardModuleReqUpdateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardModuleUpdateDataSource data});

  @override
  $DashboardModuleUpdateDataSourceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardModuleReqUpdateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardModuleReqUpdateDataSourceCopyWithImpl<$Res,
        _$DashboardModuleReqUpdateDataSourceImpl>
    implements _$$DashboardModuleReqUpdateDataSourceImplCopyWith<$Res> {
  __$$DashboardModuleReqUpdateDataSourceImplCopyWithImpl(
      _$DashboardModuleReqUpdateDataSourceImpl _value,
      $Res Function(_$DashboardModuleReqUpdateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardModuleReqUpdateDataSourceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardModuleUpdateDataSource,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleReqUpdateDataSourceImpl
    implements _DashboardModuleReqUpdateDataSource {
  const _$DashboardModuleReqUpdateDataSourceImpl({required this.data});

  factory _$DashboardModuleReqUpdateDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardModuleReqUpdateDataSourceImplFromJson(json);

  @override
  final DashboardModuleUpdateDataSource data;

  @override
  String toString() {
    return 'DashboardModuleReqUpdateDataSource(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleReqUpdateDataSourceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardModuleReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleReqUpdateDataSourceImplCopyWith<
          _$DashboardModuleReqUpdateDataSourceImpl>
      get copyWith => __$$DashboardModuleReqUpdateDataSourceImplCopyWithImpl<
          _$DashboardModuleReqUpdateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleReqUpdateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleReqUpdateDataSource
    implements DashboardModuleReqUpdateDataSource {
  const factory _DashboardModuleReqUpdateDataSource(
          {required final DashboardModuleUpdateDataSource data}) =
      _$DashboardModuleReqUpdateDataSourceImpl;

  factory _DashboardModuleReqUpdateDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardModuleReqUpdateDataSourceImpl.fromJson;

  @override
  DashboardModuleUpdateDataSource get data;

  /// Create a copy of DashboardModuleReqUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleReqUpdateDataSourceImplCopyWith<
          _$DashboardModuleReqUpdateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
