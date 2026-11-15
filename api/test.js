module.exports = function handler(request) {
  return new Response(JSON.stringify({ status: "ok", path: request.url }), {
    headers: { "content-type": "application/json" }
  });
};
