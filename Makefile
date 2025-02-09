_: list

# TESTS

.PHONY: tests
server-unit-tests: ## Run all unit tests
	cd apps/backend && yarn test:unit $(ARGS)

server-e2e-tests: ## Run all integration tests
	cd apps/backend && yarn test:e2e $(ARGS)

server-cov-tests: ## Run all coverage tests
	cd apps/backend && yarn test:cov $(ARGS)

# DOCKER

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-bash:
	docker-compose exec -u www-data server bash

docker-bash-root:
	docker-compose exec -u 0 server bash

# UTILITIES

.SILENT: $(shell grep -h -E '^[a-zA-Z_-]+:.*?$$' $(MAKEFILE_LIST) | sort -u | awk 'BEGIN {FS = ":.*?"}; {printf "%s ", $$1}')

LIST_PAD=20
list:
	awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"}'
	grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort -u | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-$(LIST_PAD)s\033[0m %s\n", $$1, $$2}'
