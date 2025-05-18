#!/bin/bash
# 在啟動 adguard-cli 之前清空日誌檔案
truncate -s 0 /home/jim60105/.local/share/adguard-cli/access.log
truncate -s 0 /home/jim60105/.local/share/adguard-cli/proxy.log
truncate -s 0 /home/jim60105/.local/share/adguard-cli/proxy.log.*
truncate -s 0 /home/jim60105/.local/share/adguard-cli/app.log

adguard-cli start
