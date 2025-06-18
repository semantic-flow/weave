import lume from "lume/mod.ts";
import footlight from "../../../footlight-lume-theme/mod.ts";

const site = lume(
  {
    dest: "../../docs",
    src: "../weave",
    //location: new URL("https://semantic-flow.github.io/weave/"),
  },
);

site
  .use(footlight());

export default site;
