export const weaveConfig = {
  inclusions: [
    {
      name: "lumenous-template with demo content",
      type: "git+ssh",
      url: "git@github.com:djradon/lumenous-template.git",
      options: {
        include: ["demo", "lumenous-template"],
        exclude: [],
        excludeByDefault: false,
        autoPullBeforeBuild: false,
        autoPushBeforeBuild: false,
      },
    },
    {
      type: "git+https",
      url: "https://github.com/another-repo/example.git",
      options: {
        include: ["src", "docs"],
        exclude: ["tests"],
        excludeByDefault: false,
        autoPullBeforeBuild: true,
      },
    },
    {
      type: "http",
      url: "https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/ar.the-rdf-net-challenge.md",
      options: {
        excludeByDefault: true,
      },
    },
    {
      type: "local",
      url: "/path/to/local/folder",
      options: {
        exclude: ["tests"],
        excludeByDefault: false,
      },
    }
  ],
};
