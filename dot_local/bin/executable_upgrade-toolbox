#!/bin/zsh
# Copyright (C) 2026 Jim Chen <Jim@ChenJ.im>, licensed under GPL-3.0-or-later
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
# ==================================================================
#
# Pull the latest toolbox container images, remove all existing toolboxes,
# and recreate them from the updated images.
#
# Usage: upgrade-toolbox

set -eu

RED='\033[0;31m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
RESET='\033[0m'

for cmd in podman toolbox; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "${RED}ERROR: $cmd is required but not installed${RESET}" >&2
        exit 1
    fi
done

# Toolbox definitions: name → image
typeset -A toolbox_map
toolbox_map=(
    fedora-toolbox-43 ghcr.io/jim60105/toolbx:latest
    vscode            ghcr.io/jim60105/toolbx-vscode:latest
    sourcegit         ghcr.io/jim60105/toolbx-sourcegit:latest
    video             ghcr.io/jim60105/toolbx-video:latest
    kubernetes        ghcr.io/jim60105/toolbx-kubernetes:latest
)

echo "${YELLOW}Pulling latest toolbox images...${RESET}"
podman pull ${(v)toolbox_map[@]}

echo "${YELLOW}Removing all existing toolboxes...${RESET}"
toolbox rm -af

echo "${YELLOW}Recreating toolboxes...${RESET}"
for name image in ${(kv)toolbox_map}; do
    toolbox create -i "$image" "$name"
done

echo "${GRAY}Done.${RESET}"
