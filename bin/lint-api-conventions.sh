#!/usr/bin/env bash
set -euo pipefail

# API conventions lint for Smart Panel backend
# This script enforces a subset of the rules defined in:
#   /.architecture/backend/API_CONVENTIONS.md
#   /.ai-rules/BACKEND_API_RULES.md
#
# It is intentionally simple (grep-based) and should be extended over time as needed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/apps/backend/src"

echo "▶ Running API conventions lint..."
echo "  Backend directory: ${BACKEND_DIR}"
echo

if [ ! -d "${BACKEND_DIR}" ]; then
  echo "❌ Backend directory not found at: ${BACKEND_DIR}"
  echo "   Adjust BACKEND_DIR in scripts/lint-api-conventions.sh to match your repo layout."
  exit 1
fi

# Helper: fail if pattern matches
fail_if_matches() {
  local description="$1"
  local pattern="$2"
  local path="$3"

  if grep -REn "${pattern}" "${path}" > /tmp/lint_api_tmp 2>/dev/null; then
    echo "❌ ${description}"
    echo "   Offending locations:"
    cat /tmp/lint_api_tmp
    rm -f /tmp/lint_api_tmp
    exit 1
  else
    echo "✅ ${description}"
  fi
}

echo "== DTO usage checks =="

# 1) DTOs MUST NOT be used as response types in custom success decorators
#    Custom decorators:
#      - @ApiSuccessResponse
#      - @ApiCreatedSuccessResponse
#      - @ApiAcceptedSuccessResponse
#    They MUST NOT reference any *Dto type.
fail_if_matches   "No DTO types allowed in @ApiSuccessResponse/@ApiCreatedSuccessResponse/@ApiAcceptedSuccessResponse"   "@Api(Success|CreatedSuccess|AcceptedSuccess)Response\([^)]*Dto"   "${BACKEND_DIR}"

# 2) DTOs MUST NOT be used as controller return types (Promise<SomethingDto>)
#    -> apply ONLY to files that actually contain @Controller(...) AND look like real controllers
echo "Checking: controllers must not return Promise<...Dto>"

controller_files="$(grep -RIl "@Controller(" "${BACKEND_DIR}/modules" | grep '\.controller\.ts$' || true)"

if [ -n "${controller_files}" ]; then
  # shellcheck disable=SC2086
  dto_returns="$(grep -En "Promise<[^>]*Dto>" ${controller_files} || true)"

  if [ -n "${dto_returns}" ]; then
    echo "❌ Controllers must not return Promise<...Dto>"
    echo "   Offending locations:"
    echo "${dto_returns}"
    exit 1
  else
    echo "✅ Controllers do not return Promise<...Dto>"
  fi
else
  echo "ℹ️ No controller files found for DTO return-type check"
fi

echo
echo "== Controller structure checks =="

# 3) All controller files must have @ApiTags
#    We approximate by: *.controller.ts containing @Controller( must also contain @ApiTags(
missing_tags_files=""
while IFS= read -r file; do
  if ! grep -q "@ApiTags(" "$file"; then
    missing_tags_files+="${file}
"
  fi
done < <(grep -RIl "@Controller(" "${BACKEND_DIR}/modules" | grep '\.controller\.ts$' || true)

if [ -n "${missing_tags_files}" ]; then
  echo "❌ Controllers without @ApiTags detected:"
  # Print unique file list
  printf "%b" "${missing_tags_files}" | sort -u
  exit 1
else
  echo "✅ All controller files with @Controller(...) also contain @ApiTags(...)"
fi

echo
echo "== ResponseModel checks =="

# 4) Every concrete *ResponseModel class must extend BaseSuccessResponseModel
#    We ignore the shared base definitions in api-response.model.ts.
bad_response_models="$(
  grep -REn "class .*ResponseModel" "${BACKEND_DIR}"     | grep -v "extends BaseSuccessResponseModel"     | grep -v "modules/api/models/api-response.model.ts"     || true
)"

if [ -n "${bad_response_models}" ]; then
  echo "❌ All *ResponseModel classes must extend BaseSuccessResponseModel<T>:"
  echo "${bad_response_models}"
  exit 1
else
  echo "✅ All *ResponseModel classes extend BaseSuccessResponseModel<T>"
fi

# 5) Controllers MUST NOT return raw Entity/Model (they should return *ResponseModel)
#    -> check ONLY real controller files (*.controller.ts with @Controller())
controller_files="$(grep -RIl "@Controller(" "${BACKEND_DIR}/modules" | grep '\.controller\.ts$' || true)"

if [ -n "${controller_files}" ]; then
  # shellcheck disable=SC2086
  raw_entity_returns="$(grep -En "return .*Entity" ${controller_files} || true)"
  # shellcheck disable=SC2086
  raw_model_returns="$(grep -En "return .*Model" ${controller_files} | grep -v "ResponseModel" || true)"

  if [ -n "${raw_entity_returns}${raw_model_returns}" ]; then
    echo "❌ Controllers must not return raw Entity/Model instances (use *ResponseModel instead):"
    [ -n "${raw_entity_returns}" ] && echo "${raw_entity_returns}"
    [ -n "${raw_model_returns}" ] && echo "${raw_model_returns}"
    exit 1
  else
    echo "✅ Controllers do not return raw Entity/Model instances"
  fi
else
  echo "ℹ️ No controller files found for raw Entity/Model return check"
fi

echo
echo "== Forbidden Swagger decorators check =="

# 6a) Enforce usage of custom Api*SuccessResponse decorators only
#     Forbidden:
#       - @ApiOkResponse
#       - @ApiCreatedResponse
#       - @ApiAcceptedResponse

forbidden_success_decorators="$(
  grep -REn "@Api(Ok|Created|Accepted)Response" "${BACKEND_DIR}" || true
)"

if [ -n "${forbidden_success_decorators}" ]; then
  echo "❌ Forbidden NestJS Swagger decorators detected (use custom Api*SuccessResponse instead):"
  echo "${forbidden_success_decorators}"
  exit 1
else
  echo "✅ No forbidden Swagger success decorators (@ApiOkResponse/@ApiCreatedResponse/@ApiAcceptedResponse) found"
fi

# 6b) Direct @ApiResponse(...) usage is forbidden outside:
#     - modules/api/decorators
#     - modules/stats/controllers/prometheus.controller.ts
direct_api_response="$(
  grep -REn "@ApiResponse\(" "${BACKEND_DIR}"     | grep -v "modules/api/decorators"     | grep -v "modules/stats/controllers/prometheus.controller.ts"     || true
)"

if [ -n "${direct_api_response}" ]; then
  echo "❌ Direct @ApiResponse(...) usage detected outside custom decorators (modules/api/decorators / prometheus):"
  echo "${direct_api_response}"
  exit 1
else
  echo "✅ No direct @ApiResponse(...) usage outside custom decorators (except Prometheus endpoint)"
fi

echo
echo "== ApiSchema naming conventions check =="

# 7) ApiSchema names for data models/entities MUST contain "Data"
#    Pattern:
#      {ModuleOrPluginPrefix}Data{ModelOrEntityName}
#
#    This rule DOES NOT apply to:
#      - DTOs (files under /dto/)
#      - Response models (names containing "Res")
#      - Request wrappers (names containing "Req")
#      - Base API response models in modules/api/models/api-response.model.ts

api_schema_lines="$(
  grep -REn "@ApiSchema\(\s*{[^}]*name:" "${BACKEND_DIR}" || true
)"

violations=""

while IFS= read -r line; do
  [ -z "${line}" ] && continue

  # line format: /path/to/file.ts:LINE:@ApiSchema({ name: 'Something' })
  file="${line%%:*}"

  # Extract schema name from the line
  schema_name="$(echo "${line}" | sed -E "s/.*name:\s*'([^']+)'.*//")"

  # If we can't parse the name, skip silently
  [ -z "${schema_name}" ] && continue

  # Skip DTOs (input-only types have their own naming convention)
  if [[ "${file}" == *"/dto/"* ]]; then
    continue
  fi

  # Skip base API response models (internal shared models)
  if [[ "${file}" == *"modules/api/models/api-response.model.ts"* ]]; then
    continue
  fi

  # Skip Response models (Res*) – they have their own pattern
  if echo "${schema_name}" | grep -q "Res"; then
    continue
  fi

  # Skip Request wrapper models (Req*) – they have their own pattern
  if echo "${schema_name}" | grep -q "Req"; then
    continue
  fi

  # For everything else (data models/entities), require "Data" in the name
  if ! echo "${schema_name}" | grep -q "Data"; then
    violations+="${line}
"
  fi

done <<< "${api_schema_lines}"

if [ -n "${violations}" ]; then
  echo "❌ ApiSchema names missing "Data" prefix for data models/entities:"
  printf "%b" "${violations}"
  exit 1
else
  echo "✅ All ApiSchema names for data models/entities follow the Data naming convention"
fi

echo
echo "✅ API conventions lint passed."
