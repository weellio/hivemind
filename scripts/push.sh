#!/usr/bin/env bash
# Push an agent lifecycle event to the bridge so the dashboard renders it live.
# (mac/linux twin of push.ps1)
#   scripts/push.sh -i parser -n Parser -s spawning
#   scripts/push.sh -i parser -s coding -l "writing parser.js..."
#   scripts/push.sh -i parser --remove
PORT=3131; ID=""; NAME=""; STATE=""; LOG=""; PARENT=""; SHIRT=""; REMOVE=""
while [ $# -gt 0 ]; do case "$1" in
  -i|--id)     ID="$2"; shift 2;;
  -n|--name)   NAME="$2"; shift 2;;
  -s|--state)  STATE="$2"; shift 2;;
  -l|--log)    LOG="$2"; shift 2;;
  -p|--parent) PARENT="$2"; shift 2;;
  --shirt)     SHIRT="$2"; shift 2;;
  --remove)    REMOVE=1; shift;;
  --port)      PORT="$2"; shift 2;;
  *) shift;;
esac; done
[ -z "$ID" ] && { echo "usage: push.sh -i <id> [-n name] [-s state] [-l log] [--remove]"; exit 1; }

json="{\"agentId\":\"$ID\""
[ -n "$NAME" ]   && json="$json,\"name\":\"$NAME\""
[ -n "$STATE" ]  && json="$json,\"state\":\"$STATE\""
[ -n "$LOG" ]    && json="$json,\"log\":\"$LOG\""
[ -n "$PARENT" ] && json="$json,\"parentId\":\"$PARENT\""
[ -n "$SHIRT" ]  && json="$json,\"shirt\":\"$SHIRT\""
[ -n "$REMOVE" ] && json="$json,\"remove\":true"
json="$json}"

if curl -s -X POST "http://localhost:$PORT/api/event" -H 'Content-Type: application/json' -d "$json" >/dev/null; then
  echo "ok: $ID${STATE:+ -> $STATE}"
else
  echo "ERR: could not reach bridge on :$PORT"
fi
