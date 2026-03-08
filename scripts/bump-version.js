#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function incrementVersion(version) {
  const parts = version.split('.');
  parts[2] = (parseInt(parts[2]) + 1).toString();
  return parts.join('.');
}

function updateVersion() {
  const configPath = path.join(__dirname, '..', 'config.yaml');

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');

    const versionMatch = configContent.match(/version:\s*([\d.]+)/);
    if (!versionMatch) {
      console.error('Could not find version in config.yaml');
      process.exit(1);
    }

    const currentVersion = versionMatch[1];
    const newVersion = incrementVersion(currentVersion);

    const updatedContent = configContent.replace(
      /version:\s*[\d.]+/,
      `version: ${newVersion}`
    );
    fs.writeFileSync(configPath, updatedContent, 'utf8');
    console.log(`Version bumped from ${currentVersion} to ${newVersion}`);

    const packagePath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packageContent.version = newVersion;
      fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2) + '\n');
      console.log(`package.json version updated to ${newVersion}`);
    }

    const { execSync } = require('child_process');
    execSync('git add config.yaml package.json', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error updating version:', error.message);
    process.exit(1);
  }
}

updateVersion();
