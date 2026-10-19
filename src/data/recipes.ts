import type { RecipeItem } from '../types'

export const API_RECIPES: RecipeItem[] = [
  {
    id: 'recipe_list',
    title: '1. Fetch a list of records (GET)',
    description: 'Retrieve a collection of items with optional query parameters for pagination.',
    category: 'Basic Operations',
    request: {
      name: 'List All Users',
      method: 'GET',
      url: '{{baseUrl}}/api/test/users',
      queryParams: [
        { id: 'p1', key: 'page', value: '1', enabled: true },
        { id: 'p2', key: 'limit', value: '10', enabled: true },
      ],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
        { id: 'a2', type: 'json_path_type', path: 'users', expectedValue: 'array', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_single',
    title: '2. Fetch single record by ID (GET)',
    description: 'Retrieve a single entity using a path variable in the URL.',
    category: 'Basic Operations',
    request: {
      name: 'Get User By ID',
      method: 'GET',
      url: '{{baseUrl}}/api/test/users/{{userId}}',
      queryParams: [],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
        { id: 'a2', type: 'json_path_exists', path: 'id', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_create',
    title: '3. Create a new record (POST)',
    description: 'Send a JSON payload to create a new resource on the server.',
    category: 'State Changes',
    request: {
      name: 'Create User',
      method: 'POST',
      url: '{{baseUrl}}/api/test/users',
      queryParams: [],
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
        { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
      ],
      body: {
        type: 'json',
        rawText: JSON.stringify(
          {
            name: 'Grace Hopper',
            email: 'grace.hopper@example.com',
            role: 'Computer Scientist',
          },
          null,
          2
        ),
      },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '201', enabled: true },
        { id: 'a2', type: 'json_path_exists', path: 'id', enabled: true },
        { id: 'a3', type: 'json_path_equals', path: 'name', expectedValue: 'Grace Hopper', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_update',
    title: '4. Update an existing record (PUT)',
    description: 'Replace an entire record with updated representation.',
    category: 'State Changes',
    request: {
      name: 'Full User Update',
      method: 'PUT',
      url: '{{baseUrl}}/api/test/users/1',
      queryParams: [],
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
        { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
      ],
      body: {
        type: 'json',
        rawText: JSON.stringify(
          {
            name: 'Ada Lovelace Updated',
            email: 'ada.updated@example.com',
            role: 'Lead Mathematician',
          },
          null,
          2
        ),
      },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_patch',
    title: '5. Partial update (PATCH)',
    description: 'Modify specific fields of an existing record without replacing the entire entity.',
    category: 'State Changes',
    request: {
      name: 'Partial Update User Status',
      method: 'PATCH',
      url: '{{baseUrl}}/api/test/users/1',
      queryParams: [],
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
        { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
      ],
      body: {
        type: 'json',
        rawText: JSON.stringify({ status: 'active' }, null, 2),
      },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
        { id: 'a2', type: 'json_path_equals', path: 'status', expectedValue: 'active', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_delete',
    title: '6. Delete a record (DELETE)',
    description: 'Remove a resource from the server and verify deletion outcome.',
    category: 'State Changes',
    request: {
      name: 'Delete User',
      method: 'DELETE',
      url: '{{baseUrl}}/api/test/users/2',
      queryParams: [],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_not_found',
    title: '7. Inspect 404 Not Found error',
    description: 'Observe how client handles non-existent endpoints or missing resources.',
    category: 'Error Handling',
    request: {
      name: 'Trigger 404 Endpoint',
      method: 'GET',
      url: '{{baseUrl}}/api/test/not-found',
      queryParams: [],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '404', enabled: true },
      ],
    },
  },
  {
    id: 'recipe_assertions',
    title: '8. Check JSON structure & response assertions',
    description: 'Run multiple automated tests against response time, types, and properties.',
    category: 'Testing & QA',
    request: {
      name: 'Assertion Verification Suite',
      method: 'GET',
      url: '{{baseUrl}}/api/test/users/1',
      queryParams: [],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [
        { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
        { id: 'a2', type: 'response_time_less_than', expectedValue: '1500', enabled: true },
        { id: 'a3', type: 'json_path_exists', path: 'name', enabled: true },
        { id: 'a4', type: 'json_path_type', path: 'id', expectedValue: 'number', enabled: true },
      ],
    },
  },
]
