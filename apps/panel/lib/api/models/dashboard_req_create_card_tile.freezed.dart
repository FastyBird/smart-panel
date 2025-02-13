// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_card_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateCardTile _$DashboardReqCreateCardTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreateCardTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreateCardTile {
  DashboardReqCreateCardTileDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateCardTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateCardTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateCardTileCopyWith<DashboardReqCreateCardTile>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateCardTileCopyWith<$Res> {
  factory $DashboardReqCreateCardTileCopyWith(DashboardReqCreateCardTile value,
          $Res Function(DashboardReqCreateCardTile) then) =
      _$DashboardReqCreateCardTileCopyWithImpl<$Res,
          DashboardReqCreateCardTile>;
  @useResult
  $Res call({DashboardReqCreateCardTileDataUnion data});

  $DashboardReqCreateCardTileDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreateCardTileCopyWithImpl<$Res,
        $Val extends DashboardReqCreateCardTile>
    implements $DashboardReqCreateCardTileCopyWith<$Res> {
  _$DashboardReqCreateCardTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateCardTile
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
              as DashboardReqCreateCardTileDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreateCardTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreateCardTileDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreateCardTileDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileImplCopyWith<$Res>
    implements $DashboardReqCreateCardTileCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileImplCopyWith(
          _$DashboardReqCreateCardTileImpl value,
          $Res Function(_$DashboardReqCreateCardTileImpl) then) =
      __$$DashboardReqCreateCardTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreateCardTileDataUnion data});

  @override
  $DashboardReqCreateCardTileDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreateCardTileImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileImpl>
    implements _$$DashboardReqCreateCardTileImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileImplCopyWithImpl(
      _$DashboardReqCreateCardTileImpl _value,
      $Res Function(_$DashboardReqCreateCardTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreateCardTileImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreateCardTileDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreateCardTileImpl implements _DashboardReqCreateCardTile {
  const _$DashboardReqCreateCardTileImpl({required this.data});

  factory _$DashboardReqCreateCardTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileImplFromJson(json);

  @override
  final DashboardReqCreateCardTileDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreateCardTile(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreateCardTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileImplCopyWith<_$DashboardReqCreateCardTileImpl>
      get copyWith => __$$DashboardReqCreateCardTileImplCopyWithImpl<
          _$DashboardReqCreateCardTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreateCardTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreateCardTile
    implements DashboardReqCreateCardTile {
  const factory _DashboardReqCreateCardTile(
          {required final DashboardReqCreateCardTileDataUnion data}) =
      _$DashboardReqCreateCardTileImpl;

  factory _DashboardReqCreateCardTile.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileImpl.fromJson;

  @override
  DashboardReqCreateCardTileDataUnion get data;

  /// Create a copy of DashboardReqCreateCardTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileImplCopyWith<_$DashboardReqCreateCardTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
