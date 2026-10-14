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
    if [ -z "${MYJOBBOT_HOSTS:-}" ]; then
      echo "myjobbot: set MYJOBBOT_HOSTS to the host:port names you open the UI with (for example myserver.lan:8080,192.168.1.20:8080)" >&2
      exit 1
    fi
    cd /app
    export NEXT_TELEMETRY_DISABLED=1
    exec node_modules/.bin/next dev web --hostname 0.0.0.0 --port "${MYJOBBOT_PORT:-8080}"
    ;;
  *)
    exec "$@"
    ;;
esac
