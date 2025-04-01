# Collision and Update Strategies in Weave

Weave provides flexible strategies for handling file collisions and updates during the build process. This document explains the available strategies and how to configure them.

## Collision Strategies

Collision strategies determine how Weave handles situations where multiple inclusions would copy files to the same destination path.

### Available Collision Strategies

- **fail**: Fail the build if any collisions are detected. This is the default strategy.
- **first**: Use the file from the inclusion with the lowest order (first inclusion).
- **last**: Use the file from the inclusion with the highest order (last inclusion).
- **prompt**: Prompt the user to choose which file to use (not implemented in non-interactive mode).

### Configuration

You can set the collision strategy globally in your `weave.config.ts` file:

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalCollisionStrategy: "fail", // Default strategy
    // Other global settings...
  },
  // Inclusions...
};
```

You can also override the global strategy for specific inclusions:

```typescript
{
  name: "my-inclusion",
  type: "git",
  // Other inclusion properties...
  options: {
    collisionStrategy: "last", // Override for this inclusion
    // Other options...
  },
}
```

## Update Strategies

Update strategies determine how Weave handles situations where a file already exists in the destination directory.

### Available Update Strategies

- **never**: Never update existing files. This is the default strategy.
- **always**: Always update existing files.
- **if-newer**: Update only if the source file is newer than the destination file.
- **if-different**: Update only if the source file content is different from the destination file.
- **prompt**: Prompt the user to choose whether to update (not implemented in non-interactive mode).

### Configuration

You can set the update strategy globally in your `weave.config.ts` file:

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalUpdateStrategy: "never", // Default strategy
    ignoreMissingTimestamps: false, // Whether to ignore missing timestamps when using if-newer
    // Other global settings...
  },
  // Inclusions...
};
```

You can also override the global strategy for specific inclusions:

```typescript
{
  name: "my-inclusion",
  type: "git",
  // Other inclusion properties...
  options: {
    updateStrategy: "if-different", // Override for this inclusion
    ignoreMissingTimestamps: true, // Override for this inclusion
    // Other options...
  },
}
```

## Timestamp Handling

When using the `if-newer` update strategy, Weave compares the timestamps of the source and destination files to determine if an update is needed. The timestamp source depends on the inclusion type:

- **Git inclusions**: Uses the git commit timestamp if available, falls back to file modification time.
- **Web inclusions**: Uses the HTTP Last-Modified header if available.
- **Local inclusions**: Uses the file modification time.

If a timestamp is not available (e.g., for web inclusions), Weave will not update the file unless `ignoreMissingTimestamps` is set to `true`.

## Relationship with Copy Strategy and Global Clean

The collision and update strategies work alongside the existing copy strategy and global clean option:

- **Global Clean**: When set to `true`, the destination directory is completely cleaned (removed and recreated) before building. This ensures a fresh start for each build.
- **Copy strategy**: Determines whether to copy a file if it already exists in the destination.
- **Collision strategy**: Determines which file to use when multiple inclusions would copy to the same destination.
- **Update strategy**: Determines whether to update an existing file in the destination.

The global clean is performed first (if enabled), then the copy strategy is checked, followed by the collision strategy, and finally the update strategy.

### Global Clean Option

The `globalClean` option in the configuration file determines whether the destination directory should be cleaned before building:

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalClean: true, // Clean destination directory before building
    // Other global settings...
  },
  // Inclusions...
};
```

When `globalClean` is set to `true`, Weave will:
1. Log a message indicating that the destination directory is being cleaned
2. Remove the destination directory and all its contents
3. Recreate the destination directory
4. Proceed with the build process

This is useful when you want to ensure that the destination directory only contains files from the current build, without any leftover files from previous builds.

## Path Remapping

When copying files from inclusions to the destination directory, you can use remappings to change the destination path of files. This is particularly useful when you want to:

- Copy files from a subdirectory to the top level of the destination
- Organize files from different inclusions into a specific directory structure
- Rename files or directories during the copy process

### Remapping Configuration

Remappings are specified in the `remappings` array of an inclusion's options:

```typescript
{
  name: "my-inclusion",
  type: "git",
  // Other inclusion properties...
  options: {
    // Other options...
    remappings: [
      {
        source: "source-path/", // Source path or pattern
        target: "target-path/" // Target path
      }
    ]
  }
}
```

### Common Remapping Scenarios

#### Copying Files from a Subdirectory to the Top Level

To copy files from a subdirectory to the top level of the destination, use an empty string as the target:

```typescript
remappings: [
  {
    source: "subdirectory/", // Source directory within the repository
    target: "" // Target is empty string to copy to top level of destination
  }
]
```

#### Organizing Files into a Different Directory Structure

To organize files into a different directory structure:

```typescript
remappings: [
  {
    source: "docs/", // Source directory
    target: "documentation/" // Target directory
  }
]
```

#### Renaming Files or Directories

To rename files or directories:

```typescript
remappings: [
  {
    source: "README.md", // Source file
    target: "docs/index.md" // Target file with new name and location
  }
]
```

## Examples

### Example 1: Conservative Approach

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalCopyStrategy: "no-overwrite",
    globalCollisionStrategy: "fail",
    globalUpdateStrategy: "never",
    // Other global settings...
  },
  // Inclusions...
};
```

This configuration will:
- Never overwrite existing files
- Fail the build if any collisions are detected
- Never update existing files

### Example 2: Aggressive Approach

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalCopyStrategy: "overwrite",
    globalCollisionStrategy: "last",
    globalUpdateStrategy: "always",
    // Other global settings...
  },
  // Inclusions...
};
```

This configuration will:
- Always overwrite existing files
- Use the file from the last inclusion in case of collisions
- Always update existing files

### Example 3: Smart Updates

```typescript
export const weaveConfig: WeaveConfigInput = {
  global: {
    globalCopyStrategy: "overwrite",
    globalCollisionStrategy: "first",
    globalUpdateStrategy: "if-different",
    // Other global settings...
  },
  // Inclusions...
};
```

This configuration will:
- Overwrite existing files
- Use the file from the first inclusion in case of collisions
- Update files only if the content is different

### Example 4: Using Remappings with Git Inclusion

```typescript
{
  name: "template-repository",
  type: "git",
  url: "git@github.com:user/template-repo.git",
  options: {
    include: ["template", "assets"],
    excludeByDefault: true,
    collisionStrategy: "last",
    updateStrategy: "if-newer",
    remappings: [
      {
        source: "template/", // Source directory within the repository
        target: "" // Copy to top level of destination
      },
      {
        source: "assets/images/", // Source directory for images
        target: "img/" // Copy to img directory in destination
      }
    ]
  }
}
```

This configuration will:
- Copy files from the "template" directory to the top level of the destination
- Copy files from the "assets/images" directory to the "img" directory in the destination
- Use the "last" collision strategy if there are collisions
- Update files only if the source is newer than the destination
