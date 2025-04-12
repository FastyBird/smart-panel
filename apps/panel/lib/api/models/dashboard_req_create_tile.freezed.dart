// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateTile _$DashboardReqCreateTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreateTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreateTile {
  dynamic get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateTileCopyWith<DashboardReqCreateTile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateTileCopyWith<$Res> {
  factory $DashboardReqCreateTileCopyWith(DashboardReqCreateTile value,
          $Res Function(DashboardReqCreateTile) then) =
      _$DashboardReqCreateTileCopyWithImpl<$Res, DashboardReqCreateTile>;
  @useResult
  $Res call({dynamic data});
}

/// @nodoc
class _$DashboardReqCreateTileCopyWithImpl<$Res,
        $Val extends DashboardReqCreateTile>
    implements $DashboardReqCreateTileCopyWith<$Res> {
  _$DashboardReqCreateTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = freezed,
  }) {
    return _then(_value.copyWith(
      data: freezed == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardReqCreateTileImplCopyWith<$Res>
    implements $DashboardReqCreateTileCopyWith<$Res> {
  factory _$$DashboardReqCreateTileImplCopyWith(
          _$DashboardReqCreateTileImpl value,
          $Res Function(_$DashboardReqCreateTileImpl) then) =
      __$$DashboardReqCreateTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({dynamic data});
}

/// @nodoc
class __$$DashboardReqCreateTileImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateTileCopyWithImpl<$Res,
        _$DashboardReqCreateTileImpl>
    implements _$$DashboardReqCreateTileImplCopyWith<$Res> {
  __$$DashboardReqCreateTileImplCopyWithImpl(
      _$DashboardReqCreateTileImpl _value,
      $Res Function(_$DashboardReqCreateTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = freezed,
  }) {
    return _then(_$DashboardReqCreateTileImpl(
      data: freezed == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreateTileImpl implements _DashboardReqCreateTile {
  const _$DashboardReqCreateTileImpl({required this.data});

  factory _$DashboardReqCreateTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqCreateTileImplFromJson(json);

  @override
  final dynamic data;

  @override
  String toString() {
    return 'DashboardReqCreateTile(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateTileImpl &&
            const DeepCollectionEquality().equals(other.data, data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(data));

  /// Create a copy of DashboardReqCreateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateTileImplCopyWith<_$DashboardReqCreateTileImpl>
      get copyWith => __$$DashboardReqCreateTileImplCopyWithImpl<
          _$DashboardReqCreateTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreateTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreateTile implements DashboardReqCreateTile {
  const factory _DashboardReqCreateTile({required final dynamic data}) =
      _$DashboardReqCreateTileImpl;

  factory _DashboardReqCreateTile.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreateTileImpl.fromJson;

  @override
  dynamic get data;

  /// Create a copy of DashboardReqCreateTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateTileImplCopyWith<_$DashboardReqCreateTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
