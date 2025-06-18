import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import footlight from "../../../footlight-lume-theme/mod.ts";

const site = lume(
  {
    dest: "../../docs",
    src: "../weave",
    location: new URL("https://semantic-flow.github.io/weave/"),
  },
);

site
  .use(basePath())
  .use(footlight());

export default site;
