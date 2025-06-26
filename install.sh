#!/bin/sh

# Chezmoi dotfiles installation script
# This script installs chezmoi and applies the dotfiles configuration
#
# Usage: ./install.sh
# 
# Options:
#   -e: exit immediately if any command fails
#   -u: exit if any variable is unset

set -eu

# Load environment variables from .env file
# This function reads environment variables from ${XDG_CACHE_HOME}/.env or ${HOME}/.env
# and exports them to the current shell session
load_env_file() {
  env_file="${XDG_CACHE_HOME:-$HOME}/.env"
  
  # Check if the environment file exists and is readable
  if [ -r "$env_file" ]; then
    echo "Loading environment variables from '${env_file}'" >&2
    
    # Read each line from the environment file
    while IFS='=' read -r key value; do
      # Skip comments (lines starting with #) and empty lines
      case "$key" in
        \#*|"") continue ;;
      esac
      
      # Export the key-value pair as an environment variable
      export "$key"="$value"
    done < "$env_file"
  else
    echo "No environment file found at '${env_file}'" >&2
  fi
}

# Install chezmoi and apply dotfiles configuration
# This function handles the complete setup process:
# 1. Installs chezmoi if not already present
# 2. Initializes and applies the dotfiles configuration
# 3. Updates git submodules
# 4. Applies configuration again to let submodule take effect
install_chezmoi() {
  # Check if chezmoi is already installed
  if ! chezmoi="$(command -v chezmoi)"; then
    # Install chezmoi to user's local bin directory
    bin_dir="${HOME}/.local/bin"
    chezmoi="${bin_dir}/chezmoi"
    echo "Installing chezmoi to '${chezmoi}'" >&2
    
    # Download and execute chezmoi installation script
    if command -v curl >/dev/null; then
      chezmoi_install_script="$(curl -fsSL get.chezmoi.io)"
    elif command -v wget >/dev/null; then
      chezmoi_install_script="$(wget -qO- get.chezmoi.io)"
    else
      echo "Error: To install chezmoi, you must have curl or wget installed." >&2
      exit 1
    fi
    
    # Execute the installation script
    sh -c "${chezmoi_install_script}" -- -b "${bin_dir}"
    unset chezmoi_install_script bin_dir
  fi

  # Get the absolute path of this script to use as source directory
  script="$(readlink --canonicalize-existing "$0")"
  script_path="$(dirname "$script")"
  
  # Prepare chezmoi arguments for initialization and application
  set -- init --apply --source="${script_path}"

  # Initialize and apply the dotfiles configuration
  echo "Running 'chezmoi $*'" >&2
  "$chezmoi" "$@"
  
  # Update git submodules to ensure all dependencies are available
  echo "Updating submodules..." >&2
  if ! git submodule update --init --recursive; then
    echo "Warning: Failed to update git submodules" >&2
  fi

  # Apply configuration again to let submodule take effect
  echo "Applying again to let submodule take effect..." >&2
  "$chezmoi" apply --source="${script_path}"
  
  echo "Chezmoi installation and configuration completed successfully!" >&2
}

# Main execution flow
# 1. Load environment variables from .env file
# 2. Install and configure chezmoi with dotfiles
main() {
  echo "Starting dotfiles installation process..." >&2
  load_env_file
  install_chezmoi
  echo "Dotfiles installation process completed!" >&2
}

# Execute main function
main
