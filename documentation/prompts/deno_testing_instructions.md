# Deno Testing Guidelines

## Core Testing Tools

### 1. Deno Testing Library

Use Deno's built-in testing library for core functionality:

```typescript
import { stub } from "jsr:@std/testing/mock";
import { assertEquals, assertRejects } from "../../deps/assert.ts";

// Stubbing functions
const stubFn = stub(module, "function", () => "mock result");
try {
  // test code
} finally {
  stubFn.restore();
}

// Assertions
assertEquals(actual, expected);
await assertRejects(() => throwingFunction());
```

### 2. Project Test Utilities

Use testUtils.ts for common test patterns, especially logging:

```typescript
import { restoreLogStubs, setupLogCapture } from "../../testUtils.ts";

// Capturing logs
const { capture, stubs } = setupLogCapture();
try {
  await functionThatLogs();
  assertEquals(capture.info.some((msg) => msg.includes("Success")), true);
} finally {
  restoreLogStubs(stubs);
}
```

## Test Structure and Organization

### 1. Basic Test Structure

```typescript
// Import from JSR modules
import { assertEquals } from "jsr:@std/assert@1.0";
import { assertSpyCalls, spy } from "jsr:@std/testing@1.0/mock";

Deno.test({
  name: "descriptive test name",
  async fn(t) {
    // Use t.step() for logical grouping
    await t.step("specific behavior being tested", () => {
      // Setup - create spies, test data
      const someSpy = spy(someObj, "method");

      // Exercise - call the code being tested
      const result = functionUnderTest();

      // Verify - make assertions
      assertEquals(result, expectedValue);
      assertSpyCalls(someSpy, expectedCalls);

      // Cleanup - restore spies
      someSpy.restore();
    });
  },
  sanitizeResources: false, // When using file system
  sanitizeOps: false, // When using async operations
});
```

### 2. Key Testing Principles

1. Test behavior, not implementation details
   - Focus on what the code does, not how it does it
   - Avoid testing private implementation details
   - Test the public interface and observable outcomes

2. Use t.step() for organization
   - Group related test cases logically
   - Use descriptive names that explain the behavior
   - Keep each step focused and independent

3. Proper test isolation
   - Setup/cleanup spies within each step
   - Clean up resources after each test
   - Avoid test interdependence

4. Mock external dependencies
   - Use spies for logging and external calls
   - Mock file operations with Deno.Command
   - Simulate network calls and I/O
   - Mock dynamic imports for JS/TS config files:
     ```typescript
     // Store original function
     const originalImport = (globalThis as unknown as { import: Function }).import;
     
     try {
       // Mock import
       (globalThis as unknown as { import: Function }).import = async (path) => {
         return { exportedValue: mockValue };
       };
       
       // Test code
     } finally {
       // Restore original
       (globalThis as unknown as { import: Function }).import = originalImport;
     }
     ```
   - Use dependency injection for better testability:
     ```typescript
     // Define an interface for the functionality
     export interface ConfigLoader {
       loadConfig(filePath: string): Promise<Config>;
     }

     // Default implementation
     export class DefaultConfigLoader implements ConfigLoader {
       async loadConfig(filePath: string): Promise<Config> {
         // Real implementation
       }
     }

     // Allow injection for testing
     let configLoader: ConfigLoader = new DefaultConfigLoader();
     export function setConfigLoader(loader: ConfigLoader) {
       configLoader = loader;
     }

     // Use the loader
     export async function loadConfig(path: string): Promise<Config> {
       return await configLoader.loadConfig(path);
     }
     ```

   - Mock the loader in tests:
     ```typescript
     // Create mock loader
     const mockLoader: ConfigLoader = {
       async loadConfig(filePath: string): Promise<Config> {
         if (filePath === "valid.js") {
           return mockConfig;
         }
         throw new Error("Mock error");
       }
     };

     // Use in tests
     try {
       setConfigLoader(mockLoader);
       const result = await loadConfig("valid.js");
       assertEquals(result, mockConfig);
     } finally {
       setConfigLoader(new DefaultConfigLoader());
     }
     ```

   - Use custom protocols for testing:
     ```typescript
     // Base class with protected method that handles test protocol
     export class DefaultLoader {
       protected async importModule(path: string): Promise<unknown> {
         // Handle test protocol
         if (path.startsWith("memory://")) {
           throw new Error("memory:// protocol is only for testing");
         }
         // Real implementation
         return await import(path);
       }
     }

     // Test class that overrides importModule
     class TestLoader extends DefaultLoader {
       protected override async importModule(path: string): Promise<unknown> {
         // Handle test protocol
         if (path === "memory://valid.js") {
           return { config: mockConfig };
         }
         throw new Error("Unexpected import path");
       }
     }

     // Use in tests with memory:// protocol
     const loader = new TestLoader();
     const result = await loader.load("memory://valid.js");
     assertEquals(result, mockConfig);
     ```

   - Benefits of custom protocols:
     - Avoids file system resolution during testing
     - Prevents coverage tool from trying to find actual files
     - Makes test intentions clearer
     - Separates test paths from real paths

   - Mock file system operations when needed:
     ```typescript
     // Store original function
     const originalRealPath = Deno.realPath;
     
     try {
       // Mock file system operation
       Deno.realPath = async (path: string | URL) => {
         // Return consistent paths for testing
         return `/test/${path}`;
       };
       
       // Test code
     } finally {
       // Restore original
       Deno.realPath = originalRealPath;
     }
     ```

   - Test error handling comprehensively:
     ```typescript
     // Test different error types
     await t.step("handles different error scenarios", async () => {
       // Test known errors with specific messages
       await assertRejects(
         () => functionThatThrows(),
         KnownError,
         "Expected error message"
       );

       // Test error wrapping
       await assertRejects(
         () => functionThatWrapsErrors(),
         Error,
         "Wrapped error message"
       );

       // Test non-Error objects
       await assertRejects(
         async () => {
           throw { message: "string error" };
         },
         Error,
         "Generic error message"
       );

       // Test error propagation
       const mockFn = spy(async () => {
         throw new Error("Original error");
       });
       await assertRejects(
         () => functionThatUsesCallback(mockFn),
         Error,
         "Original error"
       );
     });

     // Test error recovery
     await t.step("recovers from errors", async () => {
       // Test fallback behavior
       const result = await functionWithFallback();
       assertEquals(result, fallbackValue);

       // Test cleanup after errors
       const resource = await createResource();
       try {
         await functionThatThrows();
       } catch {
         // Verify resource was cleaned up
         assertEquals(await resourceExists(), false);
       }
     });
     ```

   - Mock remote operations:
     ```typescript
     // Mock fetch responses
     const mockFetch = async (url: string | URL | Request) => {
       // Return different responses based on URL
       if (url === "https://example.com/valid.json") {
         return new Response(JSON.stringify(validData), {
           status: 200,
           headers: { "Content-Type": "application/json" }
         });
       } else if (url === "https://example.com/error.json") {
         return new Response(null, {
           status: 404,
           statusText: "Not Found"
         });
       }
       // Test different content types
       return new Response("not json", {
         status: 200,
         headers: { "Content-Type": "text/plain" }
       });
     };

     // Replace global fetch
     const originalFetch = globalThis.fetch;
     try {
       globalThis.fetch = mockFetch as typeof fetch;
       
       // Test success case
       const result = await loadRemoteConfig("https://example.com/valid.json");
       assertEquals(result, expectedData);
       
       // Test error cases
       await assertRejects(
         () => loadRemoteConfig("https://example.com/error.json"),
         Error,
         "Failed to fetch"
       );
     } finally {
       // Restore original fetch
       globalThis.fetch = originalFetch;
     }
     ```

5. Comprehensive testing
   - Test both success and error paths
   - Include edge cases and boundary conditions
   - Verify both return values and side effects

## Best Practices

1. Use Deno's testing library when possible
   - For mocking and stubbing
   - For assertions
   - For test organization

2. Use testUtils.ts for common code
   - For log capture and verification
   - For test setup/cleanup
   - For shared test utilities

3. Common Testing Patterns
   - Use spies to verify function calls and arguments
   - Test error handling with assertRejects
   - Group related test cases using t.step()
   - Clean up resources and restore spies after tests
   - Test edge cases and error conditions
   - Create temporary test files:
     ```typescript
     const testDir = await Deno.makeTempDir();
     try {
       await Deno.writeTextFile(`${testDir}/test.js`, content);
       // Test code
     } finally {
       await Deno.remove(testDir, { recursive: true });
     }
     ```
   - Mock multiple related functions together:
     ```typescript
     // Store all original functions
     const originals = {
       import: (globalThis as unknown as { import: Function }).import,
       readTextFile: Deno.readTextFile,
       realPath: Deno.realPath
     };
     
     try {
       // Setup all mocks together
       (globalThis as unknown as { import: Function }).import = mockImport;
       Deno.readTextFile = mockReadTextFile;
       Deno.realPath = mockRealPath;
       
       // Test code
     } finally {
       // Restore all originals together
       (globalThis as unknown as { import: Function }).import = originals.import;
       Deno.readTextFile = originals.readTextFile;
       Deno.realPath = originals.realPath;
     }
     ```

   - Combine real files with mocked operations:
     ```typescript
     // Create test files first
     const testDir = await Deno.makeTempDir();
     await Deno.writeTextFile(`${testDir}/config.js`, `
       export const config = { /* test data */ };
     `);

     try {
       // Then set up mocks that will handle these files
       Deno.readTextFile = async (path: string | URL) => {
         // Mock readTextFile but still use real paths
         throw new Error("Force import path");
       };
       (globalThis as unknown as { import: Function }).import = async (path) => {
         // Mock import using the real file paths
         if (path.includes(`${testDir}/config.js`)) {
           return mockConfig;
         }
         throw new Error("Unexpected import");
       };

       // Test code using real paths but mocked operations
       await loadConfig(`${testDir}/config.js`);
     } finally {
       // Clean up both mocks and real files
       await Deno.remove(testDir, { recursive: true });
     }
     ```
