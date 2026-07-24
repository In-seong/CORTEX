#!/bin/bash
export HOME=/Users/scoop
source $HOME/.nvm/nvm.sh
nvm use 20
cd /Users/scoop/scoop-brain

# 기존 프로세스 정리
lsof -ti :7777 | xargs kill -9 2>/dev/null
sleep 1

NITRO_PORT=7777 NITRO_HOST=127.0.0.1 node .output/server/index.mjs
