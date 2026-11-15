export default function handler(request: Request) {
  console.log('TEST HANDLER CALLED');
  return new Response(JSON.stringify({ 
    status: 'ok', 
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries())
  }), {
    headers: { 'content-type': 'application/json' }
  });
}
