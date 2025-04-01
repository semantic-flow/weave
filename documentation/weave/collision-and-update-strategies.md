# Collision and Update Strategies in Weave

Weave provides flexible strategies for handling file collisions and updates during the build process. This document explains the available strategies and how to configure them.

## Collision Strategies

Collision strategies determine how Weave handles situations where multiple inclusions would copy files to the same destination path.

### Available Collision Strategies

- **fail**: Fails the build if any collisions are detected. This is the default strategy.
- **first**: Uses the file from the inclusion with the lowest order (first in the list).
- **last**: Uses the file from the inclusion with the highest order (last in the list).
- **prompt**: (Not yet implemented) Prompts the user to choose which file to use.

### Configuration

Collision strategies can be configured at both the global and inclusion level:

```typescript
// Global configuration
const config: WeaveConfigInput = {
  global: {
    globalCollisionStrategy: "fail", // Default
    // ...
  },
  // ...
};

// Inclusion-level configuration
const inclusion: GitInclusion = {
  // ...
  options: {
    collisionStrategy: "first", // Overrides global strategy for this inclusion
    // ...
  },
};
```

## Update Strategies

Update strategies determine how Weave handles situations where a file already exists in the destination directory.

### Available Update Strategies

- **never**: Never updates existing files. This is the default strategy.
- **always**: Always updates existing files, regardless of content or timestamp.
- **if-different**: Updates the file only if the content is different.
- **if-newer**: Updates the file only if the source file is newer than the destination file.
- **prompt**: (Not yet implemented) Prompts the user to choose whether to update the file.

### Configuration

Update strategies can be configured at both the global and inclusion level:

```typescript
// Global configuration
const config: WeaveConfigInput = {
  global: {
    globalUpdateStrategy: "never", // Default
    // ...
  },
  // ...
};

// Inclusion-level configuration
const inclusion: GitInclusion = {
  // ...
  options: {
    updateStrategy: "if-newer", // Overrides global strategy for this inclusion
    // ...
  },
};
```

## Timestamp Handling

When using the `if-newer` update strategy, Weave compares timestamps between source and destination files. The timestamp source depends on the inclusion type:

- **Git inclusions**: Uses the git commit timestamp if available, falls back to file modification time.
- **Web inclusions**: Uses the HTTP Last-Modified header if available (not yet implemented).
- **Local inclusions**: Uses the file modification time.

If a timestamp cannot be determined (e.g., for web inclusions), Weave will by default fail the build. You can configure Weave to ignore missing timestamps:

```typescript
// Global configuration
const config: WeaveConfigInput = {
  global: {
    ignoreMissingTimestamps: false, // Default
    // ...
  },
  // ...
};

// Inclusion-level configuration
const inclusion: GitInclusion = {
  // ...
  options: {
    ignoreMissingTimestamps: true, // Overrides global setting for this inclusion
    // ...
  },
};
```

## Best Practices

- Use `fail` collision strategy during development to catch unexpected collisions.
- Use `first` or `last` collision strategy in production to ensure deterministic builds.
- Use `if-different` update strategy to avoid unnecessary file updates.
- Use `if-newer` update strategy when working with files that are frequently updated.
- Set `ignoreMissingTimestamps` to `true` when using web inclusions with the `if-newer` update strategy.
