# Dotfiles Repository

This repository contains my personal dotfiles.

I use [Chezmoi](https://www.chezmoi.io) to manage this dotfiles repo.

For more information on how to personalize GitHub Codespaces with your own dotfiles, please refer to the [GitHub documentation](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles).

## Start with chezmoi

> [!CAUTION]  
> This repository contains my personal configurations.  
> Please fork it first and make your changes before applying them.  
> Pay special attention to `.chezmoi.toml.tmpl` and `.gitconfig`.  

```shell
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply $GITHUB_USERNAME
```

## License

<img src="https://github.com/user-attachments/assets/f39af0c7-aa0a-4824-9b2b-bfa9f93ba4e5" alt="gplv3" width="300" />

[GNU GENERAL PUBLIC LICENSE Version 3](LICENSE)

Copyright (C) 2024 Jim Chen <Jim@ChenJ.im>.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see [https://www.gnu.org/licenses/](https://www.gnu.org/licenses/).
