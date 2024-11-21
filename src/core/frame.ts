import { join, posix } from "../deps/path.ts";
import { merge } from "./utils/object.ts";
import { normalizePath } from "./utils/path.ts";

import FS from "./fs.ts";


/** Default options of the frame */
const defaults: FrameOptions = {
  cwd: Deno.cwd(),
  repoDir: "./_source_repos",
  dest: "./_woven",
  emptyDest: true,
  caseSensitiveUrls: false,
  watcher: {
    ignore: [],
    debounce: 100,
    include: [],
  },
};


/**
 * Frame is the heart of Weave,
 * it contains everything needed to combine the sources
 */
export default class Frame {
  options: FrameOptions;

  /** To read the files from the filesystem */
  fs: FS;


  constructor(options: Partial<FrameOptions> = {}) {
    this.options = merge(defaults, options);

    const repoDir = this.repoDir();
    const dest = this.dest();
    const { cwd, caseSensitiveUrls } =
      this.options;

    // To load source files
    const fs = new FS({ root: src });

    const source = new Source({
      fs,
    });

    // Other stuff
    const events = new Events<SiteEvent>();
    const writer = new FSWriter({ dest, caseSensitiveUrls });

    // Save everything in the site instance
    this.fs = fs;
    this.source = source;
    this.events = events;
    this.writer = writer;

    // Ignore the "dest" directory if it's inside repoDir
    if (this.dest().startsWith(this.repoDir())) {
      this.ignore(this.options.dest);
    }

    // Ignore the dest folder by the watcher
    this.options.watcher.ignore.push(normalizePath(this.options.dest));
    this.fs.options.ignore = this.options.watcher.ignore;

    // Create the fetch function for `deno serve`
    let fetchServer: Server | undefined;

    this.fetch = (request: Request, info: Deno.ServeHandlerInfo) => {
      if (!fetchServer) {
        fetchServer = this.server();
      }

      return fetchServer.handle(request, info);
    };
  }

  /**
 * Returns the full path to the root directory.
 * Use the arguments to return a subpath
 */
  root(...path: string[]): string {
    return normalizePath(join(this.options.cwd, ...path));
  }

  /**
   * Returns the full path to the src directory.
   * Use the arguments to return a subpath
   */
  repoDir(...path: string[]): string {
    return this.root(this.options.repoDir, ...path);
  }

  /**
   * Returns the full path to the dest directory.
   * Use the arguments to return a subpath
   */
  dest(...path: string[]): string {
    return this.root(this.options.dest, ...path);
  }


}

/** The options to configure the frame build */
export interface FrameOptions {
  /** The path of the current working directory */
  cwd: string;

  /** The path of the site source */
  repoDir: string;

  /** The path of the built destination */
  dest: string;

  /** Whether the empty folder should be emptied before the build */
  emptyDest?: boolean;

  /** false means two urls are equal if the only difference is the case */
  caseSensitiveUrls: boolean;

  /** The local watcher options */
  watcher: WatcherOptions;

}

/** The options to configure the local watcher */
export interface WatcherOptions {
  /** Paths to ignore by the watcher */
  ignore: (string | ((path: string) => boolean))[];

  /** The interval in milliseconds to check for changes */
  debounce: number;

  /** Extra files and folders to watch (ouside the src folder) */
  include: string[];
}
