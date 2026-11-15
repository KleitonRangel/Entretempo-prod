<<<<<<< HEAD
<<<<<<< HEAD
export function GET(_request: Request) {
=======
export default function handler(request: Request) {
>>>>>>> f6f306c (test: individual api/health.ts for Vercel auto-detection)
=======
export default function handler() {
>>>>>>> fac0dae (test: minimal handler without Request param)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
