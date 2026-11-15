export default async function handler(request, response) {
  console.log("HEALTH HIT");
  response.json({ ok: true });
}
