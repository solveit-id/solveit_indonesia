# syntax=docker/dockerfile:1
# Solveit Indonesia backend: Laravel 13 on PHP 8.5 (at least 8.5.7).
# Build context: the repository root (Dockerfile.dockerignore next to this file allowlists it).
#   dev   artisan serve, Composer, dev dependencies; the source is bind-mounted (compose.dev.yaml)
#   prod  PHP-FPM, `composer install --no-dev`, code baked in, non-root (compose.prod.yaml)
# Guides: docs/development/docker-development.md and docs/development/docker-production.md.

ARG PHP_IMAGE=php:8.5.11-fpm-bookworm
ARG COMPOSER_IMAGE=composer:2.10.3

FROM ${COMPOSER_IMAGE} AS composer

# --- Shared runtime: PHP 8.5 with the extensions the API needs -------------------------------
FROM ${PHP_IMAGE} AS base

# mbstring, openssl, fileinfo, and OPcache are built into the official image (OPcache is part
# of every PHP 8.5 build). libicu-dev is only needed to compile intl; the runtime library stays.
# libfcgi-bin provides cgi-fcgi for the PHP-FPM health check.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends libicu-dev libfcgi-bin; \
    docker-php-ext-install -j"$(nproc)" bcmath intl pdo_mysql; \
    apt-mark manual $(dpkg-query -W -f '${Package} ' 'libicu[0-9]*'); \
    apt-get purge -y --auto-remove libicu-dev; \
    rm -rf /var/lib/apt/lists/*; \
    php -r 'exit(PHP_VERSION_ID >= 80507 && PHP_VERSION_ID < 80600 ? 0 : 1);'; \
    for extension in bcmath intl mbstring pdo_mysql 'Zend OPcache'; do php -m | grep -qx "$extension"; done

WORKDIR /var/www/html

# --- Development: source bind-mounted, dependencies in named volumes -------------------------
FROM base AS dev

ARG SOLVEIT_UID=1000
ARG SOLVEIT_GID=1000

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends unzip; \
    rm -rf /var/lib/apt/lists/*; \
    cp "$PHP_INI_DIR/php.ini-development" "$PHP_INI_DIR/php.ini"; \
    groupadd --gid "$SOLVEIT_GID" solveit; \
    useradd --uid "$SOLVEIT_UID" --gid solveit --create-home --shell /bin/bash solveit; \
    mkdir -p /var/www/html/vendor /var/cache/composer; \
    chown solveit:solveit /var/www/html /var/www/html/vendor /var/cache/composer

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --chmod=0755 infra/docker/backend/entrypoint-dev.sh /usr/local/bin/solveit-entrypoint

ENV COMPOSER_CACHE_DIR=/var/cache/composer

USER solveit
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:8000/up") === false ? 1 : 0);'
ENTRYPOINT ["solveit-entrypoint"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

# --- Production dependencies: no dev packages (no Boost, PHPUnit, Pint, Pail) ----------------
FROM base AS vendor

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends unzip; \
    rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress
COPY backend/ ./
# Runs package:discover through post-autoload-dump; needs no .env and no database.
RUN set -eux; \
    composer dump-autoload --no-dev --optimize --classmap-authoritative --no-interaction; \
    composer check-platform-reqs --no-dev; \
    if [ -d vendor/laravel/boost ] || [ -d vendor/phpunit ] || [ -d vendor/laravel/pint ]; then \
        echo "dev packages present in a --no-dev install" >&2; exit 1; \
    fi

# --- Production runtime: PHP-FPM as www-data, code read-only ---------------------------------
FROM base AS prod

RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY infra/docker/backend/php/production.ini "$PHP_INI_DIR/conf.d/zz-solveit.ini"
COPY infra/docker/backend/php-fpm/production.conf /usr/local/etc/php-fpm.d/zz-solveit.conf
COPY --chmod=0755 infra/docker/backend/entrypoint-prod.sh /usr/local/bin/solveit-entrypoint
COPY --from=vendor /var/www/html /var/www/html

# Code belongs to root and is only readable by PHP. Runtime writes go to storage/ and
# bootstrap/cache/, which compose.prod.yaml mounts as tmpfs on a read-only container.
RUN set -eux; \
    rm -f /usr/local/etc/php-fpm.d/www.conf.default; \
    chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

USER www-data
EXPOSE 9000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD SCRIPT_NAME=/fpm-ping SCRIPT_FILENAME=/fpm-ping REQUEST_METHOD=GET cgi-fcgi -bind -connect 127.0.0.1:9000 | grep -q pong
ENTRYPOINT ["solveit-entrypoint"]
CMD ["php-fpm", "--nodaemonize"]
