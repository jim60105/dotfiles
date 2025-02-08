# Dotfiles Repository

This repository contains my personal dotfiles.

I use [Chezmoi](https://www.chezmoi.io) to manage this dotfiles repo.

For more information on how to personalize GitHub Codespaces with your own dotfiles, please refer to the [GitHub documentation](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles).

## Start with chezmoi

> [!CAUTION]  
> This repository contains my personal settings.  
> Please fork it first, make your modifications before apply them.  
> Especially for `.gitconfig`.  

```shell
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply $GITHUB_USERNAME
```

## License

This repository is licensed under the GNU General Public License. See the [LICENSE](LICENSE) file for more details.
