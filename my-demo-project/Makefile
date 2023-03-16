DOCKER_COMPOSE  = docker compose

EXEC            = $(DOCKER_COMPOSE) exec -u dev php
EXEC_ROOT       = $(DOCKER_COMPOSE) exec php

SYMFONY         = $(EXEC) bin/console
YARN            = $(EXEC) yarn
COMPOSER        = $(EXEC) composer

AWS_ECR_BASE_URL = 586412372178.dkr.ecr.eu-west-3.amazonaws.com

##
## Project
## -------
##

dev: ## Install and start the project (For everyday use)
dev: build start vendor
	sleep 5 # Hacky: let's sleep a little to wait for MySQL to be 100%, or we risk "connection refused"
	make migrations
	@echo You are up! go to http://www.app.mydocker/

exec-php: ## Go inside the php container
	$(EXEC) bash

exec-php-root: ## Go inside the php container as root
	$(EXEC_ROOT) bash

build:
	$(DOCKER_COMPOSE) build --pull

kill:
	$(DOCKER_COMPOSE) kill
	$(DOCKER_COMPOSE) down --volumes --remove-orphans

start: ## Start the project
	$(DOCKER_COMPOSE) up -d --force-recreate --remove-orphans

stop: ## Stop the project
	$(DOCKER_COMPOSE) stop

no-docker:
	$(eval DOCKER_COMPOSE := \#)
	$(eval EXEC := )
	$(eval EXEC_ROOT := )

migrations:
	$(EXEC) bin/console doctrine:migrations:migrate -n --allow-no-migration

fixtures:
	$(EXEC) bin/console doctrine:fixtures:load -n

.PHONY: build kill install start stop no-docker migrations

##
## QA
## -----
##

cs-fixer:  ## Fixes checkstyle in code & tests
	$(EXEC) sh -c './vendor/bin/php-cs-fixer fix --config .php-cs-fixer.dist.php && \
		./vendor/bin/php-cs-fixer fix --config tests/.php-cs-fixer.dist.php'

phpstan:  ## Runs PHPStan
	$(EXEC) ./vendor/bin/phpstan analyse -c phpstan.neon.dist

qa: cs-fixer phpstan ## Runs full QA (CSFixer + PHPStan)

.PHONY: cs-fixer phpstan qa

##
## Tests
## -----
##

test: ## Run unit tests
test: tu tf

tu: ## Run unit tests
tu:
	$(EXEC) bin/phpunit

.PHONY: test tu

# rules based on files

vendor:
	$(COMPOSER) install --ignore-platform-reqs

.PHONY: vendor

##
## AWS Dev
## -------
##

aws-ecr-login: ## Log to AWS ECR repositories, for nginx et php
	aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin $(AWS_ECR_BASE_URL)/afup-demo-app-nginx-dev
	aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin $(AWS_ECR_BASE_URL)/afup-demo-app-php-dev

aws-ecr-build-push-images: ## Log to AWS ECR repositories, for nginx et php
	docker compose -f docker-compose.ci.yml build
	docker tag my-demo-project-nginx:latest $(AWS_ECR_BASE_URL)/afup-demo-app-nginx-dev:$(VERSION)
	docker tag my-demo-project-php:latest $(AWS_ECR_BASE_URL)/afup-demo-app-php-dev:$(VERSION)
	docker push $(AWS_ECR_BASE_URL)/afup-demo-app-nginx-dev:$(VERSION)
	docker push $(AWS_ECR_BASE_URL)/afup-demo-app-php-dev:$(VERSION)

aws-exec-dev-phpfpm-www-data: ## Connect to the ECS current task on the PHP-FPM container for the DEV env
	aws ecs execute-command --cluster afup-demo-app-dev  --task `aws ecs list-tasks --cluster afup-demo-app-dev  --service afup-demo-app-dev | jq -r '.taskArns[0]'` --container php-fpm --interactive --command "sudo -E -u www-data /bin/sh -l"

aws-exec-dev-phpfpm-root: ## Connect to the ECS current task on the PHP-FPM container for the DEV env
	aws ecs execute-command --cluster afup-demo-app-dev  --task `aws ecs list-tasks --cluster afup-demo-app-dev  --service afup-demo-app-dev | jq -r '.taskArns[0]'` --container php-fpm --interactive --command "sh"

aws-exec-dev-supervisord-www-data: ## Connect to the ECS current task on the supervisord container for the DEV env
	aws ecs execute-command --cluster afup-demo-app-dev  --task `aws ecs list-tasks --cluster afup-demo-app-dev  --service afup-demo-app-dev \
	| jq -r '.taskArns[0]'` --container supervisor --interactive --command "sudo -E -u www-data /bin/sh -l"

aws-exec-dev-supervisord-root: ## Connect to the ECS current task on the supervisord container for the DEV env
	aws ecs execute-command --cluster afup-demo-app-dev  --task `aws ecs list-tasks --cluster afup-demo-app-dev  --service afup-demo-app-dev | jq -r '.taskArns[0]'` --container supervisor --interactive --command "sh"

aws-exec-dev-nginx-root: ## Connect to the ECS current task on the NGINX container for the DEV env
	aws ecs execute-command --cluster afup-demo-app-dev  --task `aws ecs list-tasks --cluster afup-demo-app-dev  --service afup-demo-app-dev | jq -r '.taskArns[0]'` --container nginx --interactive --command "sh"


.DEFAULT_GOAL := help
help:
	@grep -E '(^[a-zA-Z_-]+:.*?##.*$$)|(^##)' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[32m%-30s\033[0m %s\n", $$1, $$2}' | sed -e 's/\[32m##/[33m/'
.PHONY: help
