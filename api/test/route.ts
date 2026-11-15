export default async function handler(_request: Request) {
  return new Response(JSON.stringify({ status: 'ok', path: _request.url }), {
    headers: { 'content-type': 'application/json' }
  });
}
