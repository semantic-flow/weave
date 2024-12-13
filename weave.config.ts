// weave.config.ts

import { WeaveConfigInput } from "./src/types.ts";

export const weaveConfig: WeaveConfigInput = {
  global: {
    workspaceDir: "_source-repos", // Directory for cloned repositories
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
      order: 10,
      options: {
        branch: "template", // Optional branch specified
        include: ["demo", "lumenous-template"],
        exclude: [],
        excludeByDefault: true,
        autoPullBeforeBuild: false,
        autoPushBeforeBuild: false,
        copyStrategy: "overwrite",
      },
    },
    {
      name: "weave documentation",
      type: "git",
      url: "git@github.com:semantic-flow/weave.git",
      order: 20,
      options: {
        //branch: "template",
        include: ["documentation/weave"],
        exclude: [],
        excludeByDefault: true,
        autoPullBeforeBuild: true,
        autoPushBeforeBuild: false,
        copyStrategy: "overwrite",
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
      order: 20,
      options: {
        active: true,
        copyStrategy: "no-overwrite",
      },
    },
    {
      type: "local",
      localPath: "documentation",
      options: {
        active: true,
        exclude: ["tests"],
        excludeByDefault: false,
      },
    },
  ],
};