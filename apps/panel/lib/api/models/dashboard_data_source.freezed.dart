// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardDataSource _$DashboardDataSourceFromJson(Map<String, dynamic> json) {
  return _DashboardDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardDataSource {
  /// A unique identifier for the data source.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  Parent2 get parent => throw _privateConstructorUsedError;

  /// The timestamp when the data source was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the data source was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DashboardDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardDataSourceCopyWith<DashboardDataSource> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardDataSourceCopyWith<$Res> {
  factory $DashboardDataSourceCopyWith(
          DashboardDataSource value, $Res Function(DashboardDataSource) then) =
      _$DashboardDataSourceCopyWithImpl<$Res, DashboardDataSource>;
  @useResult
  $Res call(
      {String id,
      String type,
      Parent2 parent,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});

  $Parent2CopyWith<$Res> get parent;
}

/// @nodoc
class _$DashboardDataSourceCopyWithImpl<$Res, $Val extends DashboardDataSource>
    implements $DashboardDataSourceCopyWith<$Res> {
  _$DashboardDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? parent = null,
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
      parent: null == parent
          ? _value.parent
          : parent // ignore: cast_nullable_to_non_nullable
              as Parent2,
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

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Parent2CopyWith<$Res> get parent {
    return $Parent2CopyWith<$Res>(_value.parent, (value) {
      return _then(_value.copyWith(parent: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardDataSourceImplCopyWith<$Res>
    implements $DashboardDataSourceCopyWith<$Res> {
  factory _$$DashboardDataSourceImplCopyWith(_$DashboardDataSourceImpl value,
          $Res Function(_$DashboardDataSourceImpl) then) =
      __$$DashboardDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      Parent2 parent,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});

  @override
  $Parent2CopyWith<$Res> get parent;
}

/// @nodoc
class __$$DashboardDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardDataSourceCopyWithImpl<$Res, _$DashboardDataSourceImpl>
    implements _$$DashboardDataSourceImplCopyWith<$Res> {
  __$$DashboardDataSourceImplCopyWithImpl(_$DashboardDataSourceImpl _value,
      $Res Function(_$DashboardDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? parent = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DashboardDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      parent: null == parent
          ? _value.parent
          : parent // ignore: cast_nullable_to_non_nullable
              as Parent2,
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
class _$DashboardDataSourceImpl implements _DashboardDataSource {
  const _$DashboardDataSourceImpl(
      {required this.id,
      required this.type,
      required this.parent,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DashboardDataSourceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardDataSourceImplFromJson(json);

  /// A unique identifier for the data source.
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  /// Discriminator for the data source type
  @override
  final Parent2 parent;

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
    return 'DashboardDataSource(id: $id, type: $type, parent: $parent, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.parent, parent) || other.parent == parent) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, parent, createdAt, updatedAt);

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardDataSourceImplCopyWith<_$DashboardDataSourceImpl> get copyWith =>
      __$$DashboardDataSourceImplCopyWithImpl<_$DashboardDataSourceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardDataSource implements DashboardDataSource {
  const factory _DashboardDataSource(
          {required final String id,
          required final String type,
          required final Parent2 parent,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DashboardDataSourceImpl;

  factory _DashboardDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardDataSourceImpl.fromJson;

  /// A unique identifier for the data source.
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// Discriminator for the data source type
  @override
  Parent2 get parent;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DashboardDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardDataSourceImplCopyWith<_$DashboardDataSourceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
