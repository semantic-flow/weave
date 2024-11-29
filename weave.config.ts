// weave.config.ts

import { WeaveConfig } from "./src/types.ts";

export const weaveConfig: WeaveConfig = {
  global: {
    repoDir: "_source-repos", // Directory for cloned repositories
    dest: "_woven", // Directory for woven output, relative to cwd
    globalCopyStrategy: "no-overwrite",
    globalClean: true,
    watchConfig: false,
  },
  inclusions: [
    { 
      name: "lumenous-template with demo content",
      type: "git",
      url: "git@github.com:djradon/lumenous-template.git",
      options: {
        branch: "template", // Optional branch specified
        include: ["demo", "lumenous-template"],
        exclude: [],
        excludeByDefault: true,
        autoPullBeforeBuild: false,
        autoPushBeforeBuild: false,
      },
    },
    {
      type: "git",
      url: "https://github.com/another-repo/example.git",
      options: {
        active: false,
        include: ["src", "docs"],
        exclude: ["tests"],
        excludeByDefault: false,
        autoPullBeforeBuild: true,
      },
    },
    {
      type: "web",
      url: "https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/ar.the-rdf-net-challenge.md",
      options: {
        active: true,
        copyStrategy: "no-overwrite",
      },
    },
    {
      type: "local",
      url: "/path/to/local/folder",
      options: {
        active: false,
        exclude: ["tests"],
        excludeByDefault: false,
      },
    },
  ],
};