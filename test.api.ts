export default function handler(request: Request) {
  return new Response(JSON.stringify({ status: 'ok', path: request.url }), {
    headers: { 'content-type': 'application/json' }
  });
}
