// Quick test for wrapped response format
import { GET as detailsGet } from './api/details.ts';

async function test() {
  console.log("=== Testing Details Response Format ===\n");

  // Movie details
  const movieDetails = new Request("http://localhost/api/details?type=movie&id=tt1375666");
  const movieRes = await detailsGet(movieDetails);
  const movieText = await movieRes.text();
  const movieData = JSON.parse(movieText);
  console.log("Movie response keys:", Object.keys(movieData));
  console.log("Has 'details' wrapper?", "details" in movieData);
  if (movieData.details) {
    console.log("Title:", movieData.details.title);
    console.log("Runtime:", movieData.details.runtime);
  } else {
    console.log("ERROR: No 'details' wrapper found!");
    console.log("Full response:", movieText.slice(0, 200));
  }

  // Series details (anime)
  const seriesDetails = new Request("http://localhost/api/details?type=series&id=tt9054364");
  const serRes = await detailsGet(seriesDetails);
  const serText = await serRes.text();
  const serData = JSON.parse(serText);
  console.log("\nSeries (anime) response keys:", Object.keys(serData));
  if (serData.details) {
    console.log("Title:", serData.details.title);
    console.log("Runtime/ep:", serData.details.episodeMinutes);
    console.log("Seasons:", serData.details.seasons);
    console.log("Episodes:", serData.details.episodes);
  }

  // Test that frontend can access data.details.runtime without crash
  if (movieData.details) {
    const runtime = movieData.details.runtime;
    console.log("\n✅ Frontend-safe: data.details.runtime =", runtime);
  } else {
    console.log("\n❌ FAIL: data.details is undefined — would crash frontend!");
  }

  console.log("\n=== Test complete ===");
}

test().catch(e => {
  console.error("Test failed:", e.message);
  process.exit(1);
});
