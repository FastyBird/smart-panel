// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_data_source_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateDataSourceBase _$DashboardUpdateDataSourceBaseFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateDataSourceBase.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateDataSourceBase {
  /// The unique identifier of the associated tile.
  String get tile => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateDataSourceBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateDataSourceBaseCopyWith<DashboardUpdateDataSourceBase>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateDataSourceBaseCopyWith<$Res> {
  factory $DashboardUpdateDataSourceBaseCopyWith(
          DashboardUpdateDataSourceBase value,
          $Res Function(DashboardUpdateDataSourceBase) then) =
      _$DashboardUpdateDataSourceBaseCopyWithImpl<$Res,
          DashboardUpdateDataSourceBase>;
  @useResult
  $Res call({String tile});
}

/// @nodoc
class _$DashboardUpdateDataSourceBaseCopyWithImpl<$Res,
        $Val extends DashboardUpdateDataSourceBase>
    implements $DashboardUpdateDataSourceBaseCopyWith<$Res> {
  _$DashboardUpdateDataSourceBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tile = null,
  }) {
    return _then(_value.copyWith(
      tile: null == tile
          ? _value.tile
          : tile // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateDataSourceBaseImplCopyWith<$Res>
    implements $DashboardUpdateDataSourceBaseCopyWith<$Res> {
  factory _$$DashboardUpdateDataSourceBaseImplCopyWith(
          _$DashboardUpdateDataSourceBaseImpl value,
          $Res Function(_$DashboardUpdateDataSourceBaseImpl) then) =
      __$$DashboardUpdateDataSourceBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String tile});
}

/// @nodoc
class __$$DashboardUpdateDataSourceBaseImplCopyWithImpl<$Res>
    extends _$DashboardUpdateDataSourceBaseCopyWithImpl<$Res,
        _$DashboardUpdateDataSourceBaseImpl>
    implements _$$DashboardUpdateDataSourceBaseImplCopyWith<$Res> {
  __$$DashboardUpdateDataSourceBaseImplCopyWithImpl(
      _$DashboardUpdateDataSourceBaseImpl _value,
      $Res Function(_$DashboardUpdateDataSourceBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tile = null,
  }) {
    return _then(_$DashboardUpdateDataSourceBaseImpl(
      tile: null == tile
          ? _value.tile
          : tile // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdateDataSourceBaseImpl
    implements _DashboardUpdateDataSourceBase {
  const _$DashboardUpdateDataSourceBaseImpl({required this.tile});

  factory _$DashboardUpdateDataSourceBaseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardUpdateDataSourceBaseImplFromJson(json);

  /// The unique identifier of the associated tile.
  @override
  final String tile;

  @override
  String toString() {
    return 'DashboardUpdateDataSourceBase(tile: $tile)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateDataSourceBaseImpl &&
            (identical(other.tile, tile) || other.tile == tile));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, tile);

  /// Create a copy of DashboardUpdateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDataSourceBaseImplCopyWith<
          _$DashboardUpdateDataSourceBaseImpl>
      get copyWith => __$$DashboardUpdateDataSourceBaseImplCopyWithImpl<
          _$DashboardUpdateDataSourceBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDataSourceBaseImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateDataSourceBase
    implements DashboardUpdateDataSourceBase {
  const factory _DashboardUpdateDataSourceBase({required final String tile}) =
      _$DashboardUpdateDataSourceBaseImpl;

  factory _DashboardUpdateDataSourceBase.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateDataSourceBaseImpl.fromJson;

  /// The unique identifier of the associated tile.
  @override
  String get tile;

  /// Create a copy of DashboardUpdateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDataSourceBaseImplCopyWith<
          _$DashboardUpdateDataSourceBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
