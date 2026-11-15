// Test Cinemeta-based API endpoints
import { GET as searchGet } from './api/search.ts';
import { GET as detailsGet } from './api/details.ts';

async function test() {
  console.log("=== Testing Search ===\n");

  // Movie search
  const movieSearch = new Request("http://localhost/api/search?type=movie&q=inception");
  const movieRes = await searchGet(movieSearch);
  const md = JSON.parse(await movieRes.text());
  console.log("Movie search results:", md.results?.length || 0);
  if (md.results && md.results.length > 0) {
    for (const r of md.results.slice(0, 3)) {
      console.log(`  - ${r.title} (${r.year}) [${r.type}] id=${r.id}`);
    }
  } else {
    console.log("Error:", md.error);
  }

  // Series search  
  const seriesSearch = new Request("http://localhost/api/search?type=series&q=breaking+bad");
  const serRes = await searchGet(seriesSearch);
  const sd = JSON.parse(await serRes.text());
  console.log("\nSeries search results:", sd.results?.length || 0);
  if (sd.results && sd.results.length > 0) {
    for (const r of sd.results.slice(0, 2)) {
      console.log(`  - ${r.title} (${r.year}) [${r.type}] id=${r.id}`);
    }
  }

  // Movie details
  console.log("\n=== Testing Details ===\n");
  const movieDetails = new Request("http://localhost/api/details?type=movie&id=tt1375666");
  const detRes = await detailsGet(movieDetails);
  const dd = JSON.parse(await detRes.text());
  console.log("Movie details:");
  console.log(`  Title: ${dd.title} | Year: ${dd.year}`);
  console.log(`  Genres: ${dd.genres?.join(', ')}`);
  console.log(`  Rating: ${dd.rating}`);
  console.log(`  Runtime: ${dd.runtime}min`);
  console.log(`  Description: ${(dd.description || '').slice(0, 80)}...`);

  // Series details
  const seriesDetails = new Request("http://localhost/api/details?type=series&id=tt0903747");
  const sdRes = await detailsGet(seriesDetails);
  const sed = JSON.parse(await sdRes.text());
  console.log("\nSeries details:");
  console.log(`  Title: ${sed.title} | Year: ${sed.year}`);
  console.log(`  Genres: ${sed.genres?.join(', ')}`);
  console.log(`  Rating: ${sed.rating}`);
  console.log(`  Runtime/ep: ${sed.runtime}min`);
  console.log(`  Seasons: ${sed.seasons} | Episodes: ${sed.episodes}`);
  if (sed.seasonEpisodes && sed.seasonEpisodes.length > 0) {
    for (const s of sed.seasonEpisodes.slice(0, 3)) {
      console.log(`  Season ${s.season}: ${s.episodes} episodes`);
    }
  }

  console.log("\n=== All tests passed! ===");
}

test().catch(e => {
  console.error("Test failed:", e.message);
  process.exit(1);
});
