const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../package.json');
const htmlPath = path.resolve(__dirname, '../public/index.html');
const publicVersionPath = path.resolve(__dirname, '../public/version.json');

// 1. Read package.json and bump the patch version (0.1.6 -> 0.1.7)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const versionParts = pkg.version.split('.').map(Number);
versionParts[2] = (versionParts[2] || 0) + 1;
pkg.version = versionParts.join('.');
const buildTimestamp = new Date().toISOString();

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Write public/version.json — this is what the browser will check
fs.writeFileSync(
  publicVersionPath,
  JSON.stringify({ version: pkg.version, buildTime: buildTimestamp }, null, 2)
);

// 3. Bonus: bump ?v=... cache-busting tags in index.html, if you use them
if (fs.existsSync(htmlPath)) {
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const updatedHtml = htmlContent.replace(/\?v=[^"'\s>]+/g, `?v=${pkg.version}`);
  fs.writeFileSync(htmlPath, updatedHtml);
}

console.log(`\x1b[32m[Auto-Versioning]\x1b[0m App updated to v${pkg.version}`);