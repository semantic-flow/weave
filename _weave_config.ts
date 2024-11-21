export const weaveConfig = {
  global: {
    repoDir: "_combined/_source-repos", // Directory for cloned repositories
    wovenDir: "_combined", // Directory for woven output, relative to Lume's _config.ts
  },
  inclusions: [
    {
      url: "git@github.com:djradon/lumenous-template.git",
      options: {
        include: ["demo", "lumenous-template"],
        exclude: [],
        excludeByDefault: false,
        autoPullBeforeBuild: false,
        autoPushBeforeBuild: false,
      },
    }/*,
    {
      url: "https://github.com/another-repo/example.git",
      options: {
        include: ["src", "docs"],
        exclude: ["tests"],
        excludeByDefault: false,
        autoPullBeforeBuild: true,
      },
    },*/
  ],
};
