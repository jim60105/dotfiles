#!/bin/sh

# -e: exit on error
# -u: exit on unset variables
set -eu

installChezmoi() {
	if ! chezmoi="$(command -v chezmoi)"; then
		bin_dir="${HOME}/.local/bin"
		chezmoi="${bin_dir}/chezmoi"
		echo "Installing chezmoi to '${chezmoi}'" >&2
		if command -v curl >/dev/null; then
			chezmoi_install_script="$(curl -fsSL get.chezmoi.io)"
		elif command -v wget >/dev/null; then
			chezmoi_install_script="$(wget -qO- get.chezmoi.io)"
		else
			echo "To install chezmoi, you must have curl or wget installed." >&2
			exit 1
		fi
		sh -c "${chezmoi_install_script}" -- -b "${bin_dir}"
		unset chezmoi_install_script bin_dir
	fi

	script="$(readlink --canonicalize-existing "$0")"
	script_path="$(dirname "$script")"
	set -- init --apply --source="${script_path}"

	echo "Running 'chezmoi $*'" >&2
	"$chezmoi" "$@"
	echo "Updating submodules..." >&2
	git submodule update --init --recursive
	"$chezmoi" apply --source="${script_path}"
}

installChezmoi
