// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_data_source_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardDataSourceBase _$DashboardDataSourceBaseFromJson(
    Map<String, dynamic> json) {
  return _DashboardDataSourceBase.fromJson(json);
}

/// @nodoc
mixin _$DashboardDataSourceBase {
  /// A unique identifier for the data source.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// The timestamp when the data source was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the data source was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DashboardDataSourceBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardDataSourceBaseCopyWith<DashboardDataSourceBase> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardDataSourceBaseCopyWith<$Res> {
  factory $DashboardDataSourceBaseCopyWith(DashboardDataSourceBase value,
          $Res Function(DashboardDataSourceBase) then) =
      _$DashboardDataSourceBaseCopyWithImpl<$Res, DashboardDataSourceBase>;
  @useResult
  $Res call(
      {String id,
      String type,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DashboardDataSourceBaseCopyWithImpl<$Res,
        $Val extends DashboardDataSourceBase>
    implements $DashboardDataSourceBaseCopyWith<$Res> {
  _$DashboardDataSourceBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardDataSourceBaseImplCopyWith<$Res>
    implements $DashboardDataSourceBaseCopyWith<$Res> {
  factory _$$DashboardDataSourceBaseImplCopyWith(
          _$DashboardDataSourceBaseImpl value,
          $Res Function(_$DashboardDataSourceBaseImpl) then) =
      __$$DashboardDataSourceBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DashboardDataSourceBaseImplCopyWithImpl<$Res>
    extends _$DashboardDataSourceBaseCopyWithImpl<$Res,
        _$DashboardDataSourceBaseImpl>
    implements _$$DashboardDataSourceBaseImplCopyWith<$Res> {
  __$$DashboardDataSourceBaseImplCopyWithImpl(
      _$DashboardDataSourceBaseImpl _value,
      $Res Function(_$DashboardDataSourceBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DashboardDataSourceBaseImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardDataSourceBaseImpl implements _DashboardDataSourceBase {
  const _$DashboardDataSourceBaseImpl(
      {required this.id,
      required this.type,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DashboardDataSourceBaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardDataSourceBaseImplFromJson(json);

  /// A unique identifier for the data source.
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'DashboardDataSourceBase(id: $id, type: $type, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardDataSourceBaseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, createdAt, updatedAt);

  /// Create a copy of DashboardDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardDataSourceBaseImplCopyWith<_$DashboardDataSourceBaseImpl>
      get copyWith => __$$DashboardDataSourceBaseImplCopyWithImpl<
          _$DashboardDataSourceBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardDataSourceBaseImplToJson(
      this,
    );
  }
}

abstract class _DashboardDataSourceBase implements DashboardDataSourceBase {
  const factory _DashboardDataSourceBase(
          {required final String id,
          required final String type,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DashboardDataSourceBaseImpl;

  factory _DashboardDataSourceBase.fromJson(Map<String, dynamic> json) =
      _$DashboardDataSourceBaseImpl.fromJson;

  /// A unique identifier for the data source.
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DashboardDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardDataSourceBaseImplCopyWith<_$DashboardDataSourceBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
