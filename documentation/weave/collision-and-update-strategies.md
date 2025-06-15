# Collision and Update Strategies in Weave

Weave provides flexible strategies for handling file collisions and updates during the build process. This document explains the available strategies and how to configure them.

## Collision Strategies

Collision strategies determine how Weave handles situations where multiple inclusions would copy files to the same destination path.

### Available Collision Strategies

- **fail**: Fails the build if any collisions are detected. This is the default strategy.
- **no-overwrite**: Uses the file from the inclusion that processes it first (lowest order number). Don't overwrite existing files.
- **overwrite**: Uses the file from the inclusion that processes it last (highest order number). Always overwrite with the latest file.
- **prompt**: (Not yet implemented) Prompts the user to choose which file to use.

#### How Order and Collision Strategy Interact

Inclusions are processed in order from lowest to highest order number. When a collision occurs:

- **no-overwrite**: The file from the inclusion with the lower order number wins (first to claim the destination path)
- **overwrite**: The file from the inclusion with the higher order number wins (overwrites any previous file)

**Example:**
```typescript
inclusions: [
  {
    name: "template",
    order: 10,
    options: { collisionStrategy: "overwrite" }
  },
  {
    name: "content", 
    order: 20,
    options: { collisionStrategy: "no-overwrite" }
  }
]
```

If both inclusions have an `index.md` file:
- Template processes first (order 10) with "overwrite" strategy → places its file
- Content processes second (order 20) with "no-overwrite" strategy → keeps template's file (doesn't overwrite)
- Result: Template's `index.md` is used

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
    collisionStrategy: "overwrite", // Overrides global strategy for this inclusion
    // ...
  },
};
```

## Update Strategies

Update strategies determine how Weave handles situations where a file from the same inclusion source already exists in the destination directory. Update strategies only apply when the same inclusion tries to update its own previously placed file.

### Available Update Strategies

- **never**: Never updates existing files. This is the default strategy.
- **always**: Always updates existing files, regardless of content or timestamp.
- **if-different**: Updates the file only if the content is different.
- **if-newer**: Updates the file only if the source file is newer than the destination file.
- **prompt**: (Not yet implemented) Prompts the user to choose whether to update the file.

### Important: Update vs Collision Strategies

- **Update strategies** apply when the same inclusion wants to update its own file
- **Collision strategies** apply when different inclusions want to place files at the same destination
- If inclusion A places a file, then inclusion B wants to place a file at the same location, collision strategy determines the winner
- If inclusion A runs again and wants to update its own previously placed file, update strategy applies

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
- Use `no-overwrite` or `overwrite` collision strategy in production to ensure deterministic builds.
- Use `if-different` update strategy to avoid unnecessary file updates.
- Use `if-newer` update strategy when working with files that are frequently updated.
- Set `ignoreMissingTimestamps` to `true` when using web inclusions with the `if-newer` update strategy.
