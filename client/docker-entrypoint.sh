#!/bin/sh
set -eu

runtime_file=/app/public/runtime-env.js

node - "$runtime_file" <<'NODE'
const fs = require('fs');

const target = process.argv[2];
const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  gameSocketUrl: process.env.NEXT_PUBLIC_GAME_SOCKET_URL || 'http://localhost:3001'
};

fs.writeFileSync(
  target,
  `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config)};\n`,
  { mode: 0o644 }
);
NODE

npm start &
next_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

terminate() {
  kill "$next_pid" "$nginx_pid" 2>/dev/null || true
}

trap terminate INT TERM

set +e
wait "$next_pid"
status=$?
set -e
terminate
wait "$nginx_pid" 2>/dev/null || true
exit "$status"
