import { HttpResponse, http } from 'msw';
import {
  SpaceSchema,
  SpacesResponseSchema,
  PagesResponseSchema,
  PageSchema,
} from '../../lib/confluence-client/types.js';
import { createValidPage, createValidSpace, validateAndReturn } from '../msw-schema-validation.js';

/**
 * Shared MSW handlers with schema validation
 * These handlers ensure all mock responses conform to our Effect schemas
 *
 * IMPORTANT: These are DEFAULT/FALLBACK handlers that prevent unhandled requests.
 * Individual tests should override these with server.use() for specific test scenarios.
 */
export const handlers = [
  // Confluence spaces mock
  http.get('*/wiki/api/v2/spaces', ({ request }) => {
    const url = new URL(request.url);
    const keys = url.searchParams.get('keys');

    if (keys) {
      // Return specific space
      const space = createValidSpace({ key: keys });
      const response = { results: [space] };
      return HttpResponse.json(validateAndReturn(SpacesResponseSchema, response, 'Spaces by key'));
    }

    // Return default spaces list
    const spaces = [
      createValidSpace({ id: 'space-1', key: 'TEST', name: 'Test Space' }),
      createValidSpace({ id: 'space-2', key: 'DOCS', name: 'Documentation' }),
    ];

    return HttpResponse.json(validateAndReturn(SpacesResponseSchema, { results: spaces }, 'Spaces List'));
  }),

  // Confluence single space mock
  http.get('*/wiki/api/v2/spaces/:spaceId', ({ params }) => {
    const space = createValidSpace({ id: params.spaceId as string });
    return HttpResponse.json(validateAndReturn(SpaceSchema, space, 'Single Space'));
  }),

  // Confluence pages in space mock
  http.get('*/wiki/api/v2/spaces/:spaceId/pages', ({ params }) => {
    const pages = [
      createValidPage({ id: 'page-1', title: 'Home', spaceId: params.spaceId as string }),
      createValidPage({
        id: 'page-2',
        title: 'Getting Started',
        spaceId: params.spaceId as string,
        parentId: 'page-1',
      }),
    ];

    return HttpResponse.json(validateAndReturn(PagesResponseSchema, { results: pages }, 'Pages in Space'));
  }),

  // Confluence single page mock
  http.get('*/wiki/api/v2/pages/:pageId', ({ params }) => {
    const page = createValidPage({
      id: params.pageId as string,
      title: 'Test Page',
      body: '<p>Test content</p>',
    });

    return HttpResponse.json(validateAndReturn(PageSchema, page, 'Single Page'));
  }),

  // Confluence child pages mock
  http.get('*/wiki/api/v2/pages/:pageId/children', () => {
    return HttpResponse.json(validateAndReturn(PagesResponseSchema, { results: [] }, 'Child Pages'));
  }),

  // Confluence labels mock
  http.get('*/wiki/api/v2/pages/:pageId/labels', () => {
    return HttpResponse.json({ results: [] });
  }),

  // CATCH-ALL: Return 404 for any unhandled requests
  http.get('*', ({ request }) => {
    console.warn(`[MSW] Unhandled GET request: ${request.url}`);
    return HttpResponse.json(
      { errorMessages: ['Unhandled request - add a handler for this endpoint'] },
      { status: 404 },
    );
  }),

  http.post('*', ({ request }) => {
    console.warn(`[MSW] Unhandled POST request: ${request.url}`);
    return HttpResponse.json(
      { errorMessages: ['Unhandled request - add a handler for this endpoint'] },
      { status: 404 },
    );
  }),

  http.put('*', ({ request }) => {
    console.warn(`[MSW] Unhandled PUT request: ${request.url}`);
    return HttpResponse.json(
      { errorMessages: ['Unhandled request - add a handler for this endpoint'] },
      { status: 404 },
    );
  }),
];
