// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdateTile _$DashboardReqUpdateTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqUpdateTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqUpdateTile {
  DashboardUpdateTile get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdateTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdateTileCopyWith<DashboardReqUpdateTile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdateTileCopyWith<$Res> {
  factory $DashboardReqUpdateTileCopyWith(DashboardReqUpdateTile value,
          $Res Function(DashboardReqUpdateTile) then) =
      _$DashboardReqUpdateTileCopyWithImpl<$Res, DashboardReqUpdateTile>;
  @useResult
  $Res call({DashboardUpdateTile data});

  $DashboardUpdateTileCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqUpdateTileCopyWithImpl<$Res,
        $Val extends DashboardReqUpdateTile>
    implements $DashboardReqUpdateTileCopyWith<$Res> {
  _$DashboardReqUpdateTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdateTile
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
              as DashboardUpdateTile,
    ) as $Val);
  }

  /// Create a copy of DashboardReqUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardUpdateTileCopyWith<$Res> get data {
    return $DashboardUpdateTileCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdateTileImplCopyWith<$Res>
    implements $DashboardReqUpdateTileCopyWith<$Res> {
  factory _$$DashboardReqUpdateTileImplCopyWith(
          _$DashboardReqUpdateTileImpl value,
          $Res Function(_$DashboardReqUpdateTileImpl) then) =
      __$$DashboardReqUpdateTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardUpdateTile data});

  @override
  $DashboardUpdateTileCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqUpdateTileImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileCopyWithImpl<$Res,
        _$DashboardReqUpdateTileImpl>
    implements _$$DashboardReqUpdateTileImplCopyWith<$Res> {
  __$$DashboardReqUpdateTileImplCopyWithImpl(
      _$DashboardReqUpdateTileImpl _value,
      $Res Function(_$DashboardReqUpdateTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqUpdateTileImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardUpdateTile,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateTileImpl implements _DashboardReqUpdateTile {
  const _$DashboardReqUpdateTileImpl({required this.data});

  factory _$DashboardReqUpdateTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqUpdateTileImplFromJson(json);

  @override
  final DashboardUpdateTile data;

  @override
  String toString() {
    return 'DashboardReqUpdateTile(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateTileImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateTileImplCopyWith<_$DashboardReqUpdateTileImpl>
      get copyWith => __$$DashboardReqUpdateTileImplCopyWithImpl<
          _$DashboardReqUpdateTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqUpdateTile implements DashboardReqUpdateTile {
  const factory _DashboardReqUpdateTile(
      {required final DashboardUpdateTile data}) = _$DashboardReqUpdateTileImpl;

  factory _DashboardReqUpdateTile.fromJson(Map<String, dynamic> json) =
      _$DashboardReqUpdateTileImpl.fromJson;

  @override
  DashboardUpdateTile get data;

  /// Create a copy of DashboardReqUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateTileImplCopyWith<_$DashboardReqUpdateTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
