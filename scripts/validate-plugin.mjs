#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const pluginDir = repoRoot;
const errors = [];
const warnings = [];

const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath, context) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    addError(`${context} is missing: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`${context} contains invalid JSON (${filePath}): ${error.message}`);
    return null;
  }
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return null;
  }
  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return null;
  }
  const block = normalized.slice(4, closingIndex);
  const fields = {};
  for (const line of block.split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) {
      continue;
    }
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return fields;
}

async function walkFiles(dirPath) {
  const files = [];
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  return files;
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value.length) {
    return false;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return true;
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return !normalized.startsWith('../') && normalized !== '..';
}

async function validateReferencedPath(fieldName, pathValue, pluginName) {
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) {
    return;
  }
  if (!isSafeRelativePath(pathValue)) {
    addError(`${pluginName}: "${fieldName}" has invalid path "${pathValue}"`);
    return;
  }
  const resolved = path.resolve(pluginDir, pathValue);
  if (!(await pathExists(resolved))) {
    addError(`${pluginName}: "${fieldName}" references missing path "${pathValue}"`);
  }
}

async function validateFrontmatterFile(filePath, componentName, requiredKeys, pluginName) {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  const rel = path.relative(repoRoot, filePath);
  if (!parsed) {
    addError(`${pluginName}: ${componentName} missing YAML frontmatter: ${rel}`);
    return;
  }
  for (const key of requiredKeys) {
    if (!parsed[key]) {
      addError(`${pluginName}: ${componentName} missing "${key}" in frontmatter: ${rel}`);
    }
  }
}

async function validateComponents(pluginName) {
  const rulesDir = path.join(pluginDir, 'rules');
  if (await pathExists(rulesDir)) {
    for (const file of await walkFiles(rulesDir)) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.md' || ext === '.mdc' || ext === '.markdown') {
        await validateFrontmatterFile(file, 'rule', ['description'], pluginName);
      }
    }
  }

  const skillsDir = path.join(pluginDir, 'skills');
  if (await pathExists(skillsDir)) {
    for (const file of await walkFiles(skillsDir)) {
      if (path.basename(file) === 'SKILL.md') {
        await validateFrontmatterFile(file, 'skill', ['name', 'description'], pluginName);
      }
    }
  }

  const commandsDir = path.join(pluginDir, 'commands');
  if (await pathExists(commandsDir)) {
    for (const file of await walkFiles(commandsDir)) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.md' || ext === '.mdc' || ext === '.markdown' || ext === '.txt') {
        await validateFrontmatterFile(file, 'command', ['name', 'description'], pluginName);
      }
    }
  }
}

async function main() {
  const manifestPath = path.join(pluginDir, '.cursor-plugin', 'plugin.json');
  const manifest = await readJsonFile(manifestPath, 'Plugin manifest');
  if (!manifest) {
    summarize();
    return;
  }

  if (typeof manifest.name !== 'string' || !pluginNamePattern.test(manifest.name)) {
    addError('plugin.json "name" must be lowercase kebab-case.');
  }

  for (const field of ['logo', 'rules', 'skills', 'commands']) {
    const value = manifest[field];
    if (typeof value === 'string') {
      const normalized = value.replace(/^\.\//, '').replace(/\/$/, '');
      await validateReferencedPath(field, normalized, manifest.name ?? 'plugin');
    }
  }

  await validateComponents(manifest.name ?? 'plugin');

  if (!(await pathExists(path.join(pluginDir, 'package.json')))) {
    addWarning('No package.json at repo root (VS Code extension host). Required for sidebar build.');
  }

  summarize();
}

function summarize() {
  if (warnings.length) {
    console.log('Warnings:');
    for (const w of warnings) {
      console.log(`- ${w}`);
    }
    console.log('');
  }
  if (errors.length) {
    console.error('Validation failed:');
    for (const e of errors) {
      console.error(`- ${e}`);
    }
    process.exit(1);
  }
  console.log('Cursor plugin validation passed.');
}

await main();
