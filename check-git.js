// Check if this is a git repo
const fs = require('fs');
const path = require('path');

const dir = '/c/Users/kleyt/Downloads/Entretempo';
console.log('Checking Entretengo project structure:');
console.log('Git dir exists:', fs.existsSync(path.join(dir, '.git')));
console.log('package.json exists:', fs.existsSync(path.join(dir, 'package.json')));

// List all directories and files at the root
const entries = fs.readdirSync(dir, { withFileTypes: true });
for (const e of entries) {
  console.log(e.isDirectory() ? '[DIR] ' : '[FILE] ', e.name);
}