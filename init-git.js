// Use Windows cmd.exe to run git commands - avoids shell parsing issues with &&
const { execSync } = require('child_process');

try {
  // Run all git operations in sequence using a single command string
  const cmd = 'cmd /c "C:\\Program Files\\Git\\bin\\git.exe init && C:\\Program Files\\Git\\bin\\git.exe add . && C:\\Program Files\\Git\\bin\\git.exe commit -m \"Initial commit\" && C:\\Program Files\\Git\\bin\\git.exe branch -M main && C:\\Program Files\\Git\\bin\\git.exe remote add origin https://github.com/KleitonRangel/Entretimento.git"';

  execSync(cmd, { stdio: 'inherit' });
  console.log('Git repository initialized successfully!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
