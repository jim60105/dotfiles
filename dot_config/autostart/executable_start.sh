#!/bin/bash
# 在啟動 adguard-cli 之前清空日誌檔案
truncate -s 0 /home/jim60105/.local/share/adguard-cli/logs/*

adguard-cli start > /dev/null

gpgconf --launch gpg-agent

# This one is config with visudo NOPASSWD
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml > /dev/null 2>&1
