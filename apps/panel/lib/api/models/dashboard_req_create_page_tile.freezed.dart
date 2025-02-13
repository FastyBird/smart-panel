// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePageTile _$DashboardReqCreatePageTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreatePageTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreatePageTile {
  DashboardReqCreatePageTileDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePageTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePageTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageTileCopyWith<DashboardReqCreatePageTile>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageTileCopyWith<$Res> {
  factory $DashboardReqCreatePageTileCopyWith(DashboardReqCreatePageTile value,
          $Res Function(DashboardReqCreatePageTile) then) =
      _$DashboardReqCreatePageTileCopyWithImpl<$Res,
          DashboardReqCreatePageTile>;
  @useResult
  $Res call({DashboardReqCreatePageTileDataUnion data});

  $DashboardReqCreatePageTileDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreatePageTileCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePageTile>
    implements $DashboardReqCreatePageTileCopyWith<$Res> {
  _$DashboardReqCreatePageTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePageTile
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
              as DashboardReqCreatePageTileDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreatePageTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreatePageTileDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreatePageTileDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreatePageTileImplCopyWith<$Res>
    implements $DashboardReqCreatePageTileCopyWith<$Res> {
  factory _$$DashboardReqCreatePageTileImplCopyWith(
          _$DashboardReqCreatePageTileImpl value,
          $Res Function(_$DashboardReqCreatePageTileImpl) then) =
      __$$DashboardReqCreatePageTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreatePageTileDataUnion data});

  @override
  $DashboardReqCreatePageTileDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreatePageTileImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageTileCopyWithImpl<$Res,
        _$DashboardReqCreatePageTileImpl>
    implements _$$DashboardReqCreatePageTileImplCopyWith<$Res> {
  __$$DashboardReqCreatePageTileImplCopyWithImpl(
      _$DashboardReqCreatePageTileImpl _value,
      $Res Function(_$DashboardReqCreatePageTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreatePageTileImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreatePageTileDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageTileImpl implements _DashboardReqCreatePageTile {
  const _$DashboardReqCreatePageTileImpl({required this.data});

  factory _$DashboardReqCreatePageTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageTileImplFromJson(json);

  @override
  final DashboardReqCreatePageTileDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreatePageTile(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageTileImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreatePageTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageTileImplCopyWith<_$DashboardReqCreatePageTileImpl>
      get copyWith => __$$DashboardReqCreatePageTileImplCopyWithImpl<
          _$DashboardReqCreatePageTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreatePageTile
    implements DashboardReqCreatePageTile {
  const factory _DashboardReqCreatePageTile(
          {required final DashboardReqCreatePageTileDataUnion data}) =
      _$DashboardReqCreatePageTileImpl;

  factory _DashboardReqCreatePageTile.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreatePageTileImpl.fromJson;

  @override
  DashboardReqCreatePageTileDataUnion get data;

  /// Create a copy of DashboardReqCreatePageTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageTileImplCopyWith<_$DashboardReqCreatePageTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
