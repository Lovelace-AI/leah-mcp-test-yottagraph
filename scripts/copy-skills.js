#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const skillSource = path.join(
    __dirname,
    '..',
    'node_modules',
    '@yottagraph-app',
    'elemental-api-skill',
    'skill'
);
const skillTarget = path.join(__dirname, '..', 'skills', 'elemental-api');

if (!fs.existsSync(skillSource)) {
    console.warn('Warning: @yottagraph-app/elemental-api-skill not found in node_modules');
    console.warn('Skill files will not be available. Run npm install to fix.');
    process.exit(0);
}

fs.mkdirSync(skillTarget, { recursive: true });

const files = fs.readdirSync(skillSource).filter((f) => f.endsWith('.md'));
for (const file of files) {
    fs.copyFileSync(path.join(skillSource, file), path.join(skillTarget, file));
}

console.log(`Copied ${files.length} skill files to skills/elemental-api/`);
