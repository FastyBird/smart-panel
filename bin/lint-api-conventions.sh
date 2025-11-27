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

# 1) DTOs MUST NOT be used as response types in Swagger decorators
fail_if_matches   "No DTO types allowed in @ApiOkResponse/@ApiCreatedResponse/@ApiAcceptedResponse"   "@Api\(Ok\|Created\|Accepted\)Response\([^)]*Dto"   "${BACKEND_DIR}"

# 2) DTOs MUST NOT be used as controller return types (Promise<SomethingDto>)
fail_if_matches   "Controllers must not return Promise<...Dto>"   "Promise<[^>]*Dto>"   "${BACKEND_DIR}/modules"

echo
echo "== Controller structure checks =="

# 3) All controller files must have @ApiTags
#    We approximate by: any file containing @Controller( must also contain @ApiTags(
missing_tags_files=""
while IFS= read -r file; do
  if ! grep -q "@ApiTags(" "$file"; then
    missing_tags_files+="${file}
"
  fi
done < <(grep -RIl "@Controller(" "${BACKEND_DIR}/modules" || true)

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

# 4) Every *ResponseModel class must extend BaseSuccessResponseModel
#    We assume class declaration is on a single line.
bad_response_models="$(grep -REn "class .*ResponseModel" "${BACKEND_DIR}" | grep -v "extends BaseSuccessResponseModel" || true)"

if [ -n "${bad_response_models}" ]; then
  echo "❌ All *ResponseModel classes must extend BaseSuccessResponseModel<T>:"
  echo "${bad_response_models}"
  exit 1
else
  echo "✅ All *ResponseModel classes extend BaseSuccessResponseModel<T>"
fi

# 5) Controllers MUST NOT return raw Entity/Model (they should return *ResponseModel)
#    This is a heuristic and may need tuning for your naming conventions.
#    We limit it to controller files in modules.
controller_dir="${BACKEND_DIR}/modules"
raw_entity_returns="$(grep -REn "return .*Entity" "${controller_dir}" || true)"
raw_model_returns="$(grep -REn "return .*Model" "${controller_dir}" | grep -v "ResponseModel" || true)"

if [ -n "${raw_entity_returns}${raw_model_returns}" ]; then
  echo "❌ Controllers must not return raw Entity/Model instances (use *ResponseModel instead):"
  [ -n "${raw_entity_returns}" ] && echo "${raw_entity_returns}"
  [ -n "${raw_model_returns}" ] && echo "${raw_model_returns}"
  exit 1
else
  echo "✅ Controllers do not return raw Entity/Model instances"
fi

echo
echo "✅ API conventions lint passed."
