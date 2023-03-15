#!/bin/sh

uid=$(stat -c %u /var/www)
gid=$(stat -c %g /var/www)

sed -i -r "s/dev:x:\d+:\d+:/dev:x:$uid:$gid:/g" /etc/passwd
sed -i -r "s/dev:x:\d+:/dev:x:$gid:/g" /etc/group

user=$(grep ":x:$uid:" /etc/passwd | cut -d: -f1)

if [ "$1" = "php-fpm" ]; then
    echo su-exec root "$@"
    su-exec root "$@"
else
    echo su-exec $user "$@"
    exec su-exec $user "$@"
fi