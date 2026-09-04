export interface CommentHttpService {
  list(itemId: string): Promise<unknown>;
  create(itemId: string, body: string, author?: string): Promise<unknown>;
}

export interface CommentHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCommentRequest(
  method: string,
  path: string,
  body: unknown,
  service: CommentHttpService,
): Promise<CommentHttpResponse> {
  const match = path.match(/^\/api\/items\/([^/]+)\/comments$/);
  if (!match) return { status: 404, body: { error: 'Not found' } };
  const itemId = match[1];

  try {
    if (method === 'GET') return { status: 200, body: await service.list(itemId) };
    if (method === 'POST') {
      const input = parseCreate(body);
      return { status: 201, body: await service.create(itemId, input.body, input.author) };
    }
    return { status: 405, body: { error: 'Method not allowed' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return { status: 400, body: { error: message } };
  }
}

function parseCreate(body: unknown): { body: string; author?: string } {
  if (!body || typeof body !== 'object') throw new Error('Invalid comment payload');
  const input = body as Record<string, unknown>;
  if (typeof input.body !== 'string') throw new Error('Comment body is required');
  return {
    body: input.body,
    ...(typeof input.author === 'string' ? { author: input.author } : {}),
  };
}
