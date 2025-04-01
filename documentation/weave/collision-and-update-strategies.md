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

## Relationship with Copy Strategy

The collision and update strategies work alongside the existing copy strategy:

- **Copy strategy**: Determines whether to copy a file if it already exists in the destination.
- **Collision strategy**: Determines which file to use when multiple inclusions would copy to the same destination.
- **Update strategy**: Determines whether to update an existing file in the destination.

The copy strategy is checked first, then the collision strategy, and finally the update strategy.

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
