// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateDataSource _$DashboardCreateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateDataSource {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateDataSourceCopyWith<DashboardCreateDataSource> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateDataSourceCopyWith<$Res> {
  factory $DashboardCreateDataSourceCopyWith(DashboardCreateDataSource value,
          $Res Function(DashboardCreateDataSource) then) =
      _$DashboardCreateDataSourceCopyWithImpl<$Res, DashboardCreateDataSource>;
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class _$DashboardCreateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardCreateDataSource>
    implements $DashboardCreateDataSourceCopyWith<$Res> {
  _$DashboardCreateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateDataSourceImplCopyWith<$Res>
    implements $DashboardCreateDataSourceCopyWith<$Res> {
  factory _$$DashboardCreateDataSourceImplCopyWith(
          _$DashboardCreateDataSourceImpl value,
          $Res Function(_$DashboardCreateDataSourceImpl) then) =
      __$$DashboardCreateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class __$$DashboardCreateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardCreateDataSourceCopyWithImpl<$Res,
        _$DashboardCreateDataSourceImpl>
    implements _$$DashboardCreateDataSourceImplCopyWith<$Res> {
  __$$DashboardCreateDataSourceImplCopyWithImpl(
      _$DashboardCreateDataSourceImpl _value,
      $Res Function(_$DashboardCreateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateDataSourceImpl implements _DashboardCreateDataSource {
  const _$DashboardCreateDataSourceImpl({required this.id, required this.type});

  factory _$DashboardCreateDataSourceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateDataSourceImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  @override
  String toString() {
    return 'DashboardCreateDataSource(id: $id, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type);

  /// Create a copy of DashboardCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDataSourceImplCopyWith<_$DashboardCreateDataSourceImpl>
      get copyWith => __$$DashboardCreateDataSourceImplCopyWithImpl<
          _$DashboardCreateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateDataSource implements DashboardCreateDataSource {
  const factory _DashboardCreateDataSource(
      {required final String id,
      required final String type}) = _$DashboardCreateDataSourceImpl;

  factory _DashboardCreateDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDataSourceImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// Create a copy of DashboardCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDataSourceImplCopyWith<_$DashboardCreateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
