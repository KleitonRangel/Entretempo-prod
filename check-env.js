// Check if npm is available and the project builds
const fs = require('fs');
const path = require('path');

const dir = '/c/Users/kleyt/Downloads/Entretempo';
const pkgPath = path.join(dir, 'package.json');

console.log('Package.json exists:', fs.existsSync(pkgPath));
console.log('Has build script:', fs.readFileSync(pkgPath, 'utf-8').includes('"build"'));
console.log('Has test script:', fs.readFileSync(pkgPath, 'utf-8').includes('"test"'));