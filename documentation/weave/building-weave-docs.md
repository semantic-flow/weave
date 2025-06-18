---
title: Building Weave Docs
description: Dogfooding it - How Weave documentation is built using Lume and the footlight theme
created: "2025-06-15"
updated: "2025-06-17"
---

# Building Weave Docs

This document explains how the Weave documentation is built

Eventually, we should be demonstrating Weave's own capabilities by using it to do some pre-processing.

## Overview

The Weave documentation system uses:
- **[Lume](https://lume.land/)** - A static site generator for Deno
- **[Footlight Theme](https://github.com/lumeland/theme-footlight)** - A clean, modern documentation theme
- **Weave itself** - To manage and sync documentation sources

## Architecture

### Directory Structure

```
weave/
├── documentation/
│   ├── lume/              # Lume configuration and build setup
│   │   ├── _config.ts     # Main Lume configuration
│   │   └── deno.json      # Deno tasks and dependencies
│   └── weave/             # Documentation content (markdown files)
│       ├── _data.yml      # Layout configuration
│       ├── index.md       # Main documentation page
│       ├── building-weave-docs.md  # This file
│       └── collision-and-update-strategies.md
└── docs/                  # Generated static site (GitHub Pages ready)
```

### How It Works

1. **Content Creation**: Documentation is written in Markdown files in `weave/documentation/weave/`
2. **Theme Application**: The footlight theme provides layout, styling, and navigation
3. **Build Process**: Lume processes the content and generates a static site in `weave/docs/`
4. **Deployment**: The `docs/` folder can be served directly by GitHub Pages

## Development Workflow

### Building the Documentation

```bash
# Navigate to the Lume configuration directory
cd weave/documentation/lume

# Build the static site
deno task build

# Start development server with live reload
deno task serve
```

### Available Commands

- **`deno task build`** - Generates the static site in `weave/docs/`
- **`deno task serve`** - Starts development server at http://localhost:3000/
- **`deno task cms`** - Launches the content management system (if configured)

### Adding New Documentation

1. Create new `.md` files in `weave/documentation/weave/`
2. Add frontmatter with title, description, and dates:
   ```yaml
   ---
   title: Your Page Title
   description: Brief description
   created: "2025-06-17"
   updated: "2025-06-17"
   ---
   ```
3. Write content in Markdown
4. Run `deno task build` to regenerate the site

## Theme Configuration

The documentation uses the **Footlight theme**, which provides:
- Clean, responsive design
- Built-in search functionality (via Pagefind)
- Navigation sidebar
- Dark/light theme toggle
- Code syntax highlighting
- Table of contents generation

### Theme Customization

The theme is configured in `weave/documentation/lume/_config.ts`:

```typescript
import lume from "lume/mod.ts";
import theme from "theme/mod.ts";

const site = lume();

site.use(theme({
  // Theme options can be configured here
  // languages: ["en", "es"],  // Multi-language support
  // favicon: { input: "path/to/favicon.svg" }
}));

export default site;
```

### Changing Themes

To switch to a different Lume theme:

1. **Update the import** in `_config.ts`:
   ```typescript
   // Replace this:
   import theme from "theme/mod.ts";
   
   // With your new theme:
   import newTheme from "https://deno.land/x/lume_theme_name@version/mod.ts";
   ```

2. **Update the theme usage**:
   ```typescript
   site.use(newTheme({
     // New theme options
   }));
   ```

3. **Update deno.json imports** if needed:
   ```json
   {
     "imports": {
       "theme/": "https://deno.land/x/new_theme@version/"
     }
   }
   ```

4. **Rebuild the site**:
   ```bash
   deno task build
   ```

### Popular Lume Themes

- **[Simple Blog](https://github.com/lumeland/theme-simple-blog)** - Minimal blog theme
- **[Docs](https://github.com/lumeland/theme-docs)** - Documentation-focused theme
- **[Base Blog](https://github.com/lumeland/theme-base-blog)** - Feature-rich blog theme
- **[Footlight](https://github.com/lumeland/theme-footlight)** - Current theme (clean docs)

## Weave Integration

This documentation system demonstrates Weave's capabilities:

### Content Sources

The documentation could be configured to pull from multiple sources:
- Local markdown files (current setup)
- External repositories (via git inclusions)
- Remote documentation (via web inclusions)
- Generated content (via local inclusions)

### Example Weave Configuration

```typescript
// weave.config.ts (hypothetical)
export const weaveConfig = {
  global: {
    dest: "docs",
    globalClean: true,
  },
  inclusions: [
    {
      type: "local",
      localPath: "documentation/weave",
      order: 10,
      options: {
        include: ["**/*.md"],
        active: true,
      }
    },
    {
      type: "git",
      url: "https://github.com/external/docs.git",
      order: 20,
      options: {
        include: ["api-docs/"],
        remappings: [
          { source: "api-docs/", target: "api/" }
        ]
      }
    }
  ]
};
```

## Features

### Search

The footlight theme includes built-in search powered by [Pagefind](https://pagefind.app/):
- Automatically indexes all content
- Client-side search (no server required)
- Fast, fuzzy search results
- Works in static deployments

### Navigation

- Automatic sidebar generation from file structure
- Breadcrumb navigation
- Mobile-responsive menu
- Theme toggle (dark/light mode)

### Code Highlighting

Syntax highlighting is provided by the `codeHighlight` plugin:
- Supports many programming languages
- Automatic language detection
- Copy-to-clipboard functionality
- Line number support

## Deployment

### GitHub Pages

The generated `docs/` folder is ready for GitHub Pages:

1. Push changes to your repository
2. Go to Settings → Pages in your GitHub repository
3. Select "Deploy from a branch"
4. Choose "main" branch and "/docs" folder
5. Your site will be available at `https://username.github.io/repository-name/`

### Other Platforms

The static files in `docs/` can be deployed to:
- Netlify
- Vercel
- Cloudflare Pages
- Any static hosting service

## Troubleshooting

### Common Issues

**Build fails with "self is not defined"**
- This was a PrismJS compatibility issue, fixed by switching to `codeHighlight` plugin

**Serve command doesn't work**
- Ensure you're in the `weave/documentation/lume/` directory
- Check that all dependencies are installed: `deno cache _config.ts`

**Theme not loading**
- Verify the theme import path in `_config.ts`
- Check that `deno.json` has correct import mappings

**Content not updating**
- Run `deno task build` to regenerate the site
- Clear browser cache if using development server

### Getting Help

- [Lume Documentation](https://lume.land/)
- [Footlight Theme Repository](https://github.com/lumeland/theme-footlight)
- [Deno Documentation](https://deno.land/manual)

## Contributing

To contribute to the Weave documentation:

1. Edit markdown files in `weave/documentation/weave/`
2. Test changes with `deno task serve`
3. Build the final site with `deno task build`
4. Commit both source files and generated `docs/` folder
5. Submit a pull request

The documentation system is designed to be simple, fast, and maintainable while demonstrating Weave's capabilities for managing complex content workflows.
