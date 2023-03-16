###
## PHP Base
###
FROM php:8.1.4-fpm-alpine AS php_base

RUN apk add --no-cache \
    jq \
    acl \
    sudo \
    fcgi \
    file \
    gettext \
    git \
    gnu-libiconv \
    supervisor \
    libpng  \
    libpng-dev \
    libxslt \
    libxslt-dev \
    imagemagick \
    libtool \
    libexecinfo \
    linux-headers \
;

ENV LD_PRELOAD /usr/lib/preloadable_libiconv.so

RUN set -eux; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        icu-dev \
        libzip-dev \
        zlib-dev \
        libxml2-dev \
        imagemagick-dev \
    ;\
    docker-php-ext-configure zip; \
    docker-php-ext-configure sockets; \
    docker-php-ext-install -j$(nproc) \
        bcmath \
        dom \
        gd \
        intl \
        pdo_mysql \
        soap \
        sockets \
        xsl \
        zip \
    ; \
    pecl install \
        apcu \
        imagick \
        redis \
    ; \
    pecl clear-cache; \
    docker-php-ext-enable \
        apcu \
        dom \
        opcache \
        imagick \
        redis \
        sockets \
    ; \
    runDeps="$( \
        scanelf --needed --nobanner --format '%n#p' --recursive /usr/local/lib/php/extensions \
            | tr ',' '\n' \
            | sort -u \
            | awk 'system("[ -e /usr/local/lib/" $1 " ]") == 0 { next } { print "so:" $1 }' \
    )"; \
    apk add --no-cache --virtual .api-phpexts-rundeps $runDeps; \
    apk del .build-deps

RUN ln -s $PHP_INI_DIR/php.ini-production $PHP_INI_DIR/php.ini
COPY docker/php/conf.d/app.prod.ini $PHP_INI_DIR/conf.d/app.ini
COPY docker/php/php-fpm.d/php-fpm.conf /usr/local/etc/php-fpm.d/zz-app.conf

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
ENV PATH="${PATH}:/root/.composer/vendor/bin"

COPY docker/php/cron.d/daily/ /etc/periodic/daily/

COPY supervisord.conf /etc/supervisord.conf

COPY docker/php/docker-healthcheck.sh /usr/local/bin/docker-healthcheck
HEALTHCHECK --interval=1s --timeout=1s --retries=60 CMD ["docker-healthcheck"]

WORKDIR /var/www/
CMD ["php-fpm"]

###
## NGINX Base
###
# Before upgrade please make sure that a matching package exists:
# https://github.com/opentracing-contrib/nginx-opentracing/releases/tag/v0.24.0
FROM nginx:1.21.6 as nginx_base

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/templates/ /etc/nginx/templates/

RUN apt-get update && \
  apt-get install -y wget tar


###
## PHP Build
###
FROM composer:2 as php_vendors

WORKDIR /build

COPY composer.json composer.lock symfony.lock .composer-* ./
RUN composer config -g cache-dir ".composer-cache"
RUN composer install --prefer-dist --no-dev --no-scripts --no-progress --ignore-platform-reqs

###
## PHP Prod
###
FROM php_base as php_prod

# build for production
ARG APP_ENV=prod

COPY --from=php_vendors /build/vendor vendor/

# copy only specifically what we need
COPY composer.json composer.lock symfony.lock ./
COPY .env ./
COPY bin bin/
COPY config config/
COPY public public/
COPY src src/
COPY templates templates/
COPY migrations migrations/

# Only needed for CI.
# Maybe something to do here.
COPY .env.test  phpunit.xml.dist ./
COPY tests tests/


RUN set -eux; \
    mkdir -p var/cache var/log; \
    composer dump-autoload --classmap-authoritative --no-dev; \
    composer dump-env prod; \
    composer run-script --no-dev post-install-cmd; \
    chown -R www-data:www-data var/; \
    chmod +x bin/console; sync

###
## NGINX Prod
###
FROM nginx_base as nginx_prod

COPY --from=php_prod /var/www/public /var/www/public/

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

###
## PHP Dev
###
FROM php_base AS php_dev

ENV SYMFONY_PHPUNIT_VERSION=9

# su-exec
RUN apk add --no-cache su-exec \
    && addgroup dev \
    && adduser dev -h /home/dev/ -G dev -s /bin/bash -D

# NodeJS
RUN apk add --no-cache npm yarn

# Xdebug
RUN set -eux; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS; \
    pecl install xdebug; \
    pecl clear-cache; \
    docker-php-ext-enable xdebug; \
    apk del .build-deps;

COPY docker/php/conf.d/app.dev.ini $PHP_INI_DIR/conf.d/app.ini
COPY docker/php/conf.d/xdebug.ini /usr/local/etc/php/conf.d/

COPY docker/php/docker-entrypoint.sh /sbin/docker-entrypoint

RUN apk add --no-cache bash make

ENTRYPOINT ["/sbin/docker-entrypoint"]
CMD ["php-fpm"]
