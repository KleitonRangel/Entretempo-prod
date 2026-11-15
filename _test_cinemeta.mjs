const res = await fetch('https://v3-cinemeta.strem.io/meta/series/tt0903747.json');
const data = await res.json();
const m = data.meta || {};

console.log('=== Series Meta Structure ===');
console.log('name:', m.name);
console.log('year:', m.year);
console.log('genres:', JSON.stringify(m.genres));
console.log('rating:', m.imdbRating);
console.log('runtime:', m.runtime);
console.log('description (first 100):', (m.description || '').slice(0, 100));
console.log('poster:', m.poster?.slice(0, 80));
console.log('videos count:', m.videos?.length ?? 'undefined');

if (m.videos && m.videos.length > 0) {
  console.log('\n=== First video entry ===');
  const v = m.videos[0];
  console.log(JSON.stringify({ id: v.id, name: v.name, season: v.season, episode: v.episode }, null, 2));
}

// Check videos structure for all seasons
if (m.videos) {
  const seasons = new Set(m.videos.map(v => v.season));
  console.log('\nSeasons found:', [...seasons].sort((a,b) => a-b).join(', '));
  
  // Count episodes per season
  const counts = {};
  m.videos.forEach(v => {
    if (!counts[v.season]) counts[v.season] = 0;
    counts[v.season]++;
  });
  console.log('Episodes per season:', JSON.stringify(counts));
}

// Also test movie meta
const mr = await fetch('https://v3-cinemeta.strem.io/meta/movie/tt1375666.json');
const md = await mr.json();
const mm = md.meta || {};
console.log('\n=== Movie Meta Structure ===');
console.log('name:', mm.name);
console.log('year:', mm.year);
console.log('genres:', JSON.stringify(mm.genres));
console.log('rating:', mm.imdbRating);
console.log('runtime:', mm.runtime);
