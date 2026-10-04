#!/bin/sh
set -eu

check_prerequisites() {
  for file in config.json resume.md; do
    if [ ! -f "$MYJOBBOT_DATA_DIR/$file" ]; then
      echo "myjobbot: missing $MYJOBBOT_DATA_DIR/$file (put it in the host data/ folder)" >&2
      exit 1
    fi
  done
  if [ ! -w "$MYJOBBOT_DATA_DIR" ]; then
    echo "myjobbot: $MYJOBBOT_DATA_DIR is not writable by uid $(id -u); on the host run: sudo chown -R $(id -u):$(id -g) data" >&2
    exit 1
  fi
}

case "${1:-schedule}" in
  schedule)
    check_prerequisites
    printf '%s /app/docker/run.sh\n' "$SCHEDULE" > /tmp/crontab
    echo "myjobbot: scheduling runs at '$SCHEDULE' ($TZ)"
    exec supercronic /tmp/crontab
    ;;
  run)
    check_prerequisites
    exec /app/docker/run.sh
    ;;
  serve)
    check_prerequisites
    cd /app
    exec node_modules/.bin/tsx src/cli.ts serve
    ;;
  *)
    exec "$@"
    ;;
esac
