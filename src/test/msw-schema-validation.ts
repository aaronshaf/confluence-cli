import { Schema } from 'effect';

/**
 * Validate mock data against a schema and return it
 * Throws an error if validation fails, helping catch mock data issues early
 */
export function validateAndReturn<A, I>(schema: Schema.Schema<A, I>, data: unknown, description: string): A {
  try {
    return Schema.decodeUnknownSync(schema)(data);
  } catch (error) {
    console.error(`Schema validation failed for ${description}:`, error);
    throw error;
  }
}

/**
 * Create a valid user object for mocking
 */
export function createValidUser(overrides: Partial<{ accountId: string; displayName: string; email: string }> = {}): {
  accountId: string;
  displayName?: string;
  email?: string;
} {
  return {
    accountId: overrides.accountId || 'test-account-id',
    displayName: overrides.displayName || 'Test User',
    email: overrides.email || 'test@example.com',
  };
}

/**
 * Create a valid space object for mocking
 */
export function createValidSpace(
  overrides: Partial<{ id: string; key: string; name: string; homepageId: string }> = {},
): {
  id: string;
  key: string;
  name: string;
  homepageId?: string;
} {
  return {
    id: overrides.id || 'space-123',
    key: overrides.key || 'TEST',
    name: overrides.name || 'Test Space',
    homepageId: overrides.homepageId,
  };
}

/**
 * Create a valid page object for mocking
 */
export function createValidPage(
  overrides: Partial<{
    id: string;
    title: string;
    spaceId: string;
    parentId: string | null;
    authorId: string;
    version: number;
    body: string;
  }> = {},
): {
  id: string;
  title: string;
  spaceId: string;
  parentId?: string | null;
  authorId?: string;
  version?: { number: number; createdAt?: string };
  body?: { storage?: { value: string; representation?: string } };
} {
  return {
    id: overrides.id || 'page-123',
    title: overrides.title || 'Test Page',
    spaceId: overrides.spaceId || 'space-123',
    parentId: overrides.parentId,
    authorId: overrides.authorId || 'user-123',
    version: {
      number: overrides.version || 1,
      createdAt: new Date().toISOString(),
    },
    body: overrides.body
      ? {
          storage: {
            value: overrides.body,
            representation: 'storage',
          },
        }
      : undefined,
  };
}
