#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

git pull origin master

function installGhCli() {
	apk update
	apk add -u -X \"https://dl-cdn.alpinelinux.org/alpine/edge/main\" -X \"https://dl-cdn.alpinelinux.org/alpine/edge/community\" github-cli
}

function installCodeGPT() {
	gh run download --repo jim60105/CodeGPT -n amd64 -D /bin && sudo chmod 755 /bin/codegpt
}

rsync --exclude ".git/" \
	--exclude ".DS_Store" \
	--exclude ".osx" \
	--exclude "bootstrap.sh" \
	--exclude "README.md" \
	--exclude "LICENSE" \
	-avh --no-perms . ~
installGhCli && installCodeGPT
source ~/.bash_profile
