#!/usr/bin/env node
/**
 * Convert px units to rem (font-size) and em (spacing) based on project standards.
 * Base: 16px = 1rem/1em
 *
 * WARNING: This is a regex-based converter and may not catch all edge cases:
 * - Won't convert values in comments or strings
 * - Won't convert calc() expressions
 * - Won't convert multiple values on one line (e.g., margin: 10px 20px 30px)
 *
 * Run: node scripts/convert-px-to-units.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Properties that should use rem (relative to root font-size)
const REM_PROPERTIES = ['font-size'];

// Properties that should use em (relative to element's font-size)
const EM_PROPERTIES = [
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'gap', 'row-gap', 'column-gap', 'border-radius'
];

const BASE_UNIT = 16;

function convertPxValue(value, targetUnit) {
  const pxMatch = value.match(/^(\d+\.?\d*)px$/);
  if (!pxMatch) return null;

  const numValue = parseFloat(pxMatch[1]);
  const converted = numValue / BASE_UNIT;
  const rounded = converted === Math.round(converted) ? converted : converted.toFixed(2);
  return `${rounded}${targetUnit}`;
}

function convertFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let changed = false;

  // Convert rem properties (font-size, etc.)
  REM_PROPERTIES.forEach(prop => {
    const regex = new RegExp(`(${prop}\\s*:\\s*)([\\w.]+px)(?=[;\\s])`, 'g');
    modified = modified.replace(regex, (match, prefix, value) => {
      const converted = convertPxValue(value, 'rem');
      if (converted) {
        changed = true;
        return prefix + converted;
      }
      return match;
    });
  });

  // Convert em properties (margin, padding, gap, border-radius)
  EM_PROPERTIES.forEach(prop => {
    // Match margin, margin-top, etc. with px values
    const regex = new RegExp(`(${prop}(?:-[a-z]+)?\\s*:\\s*)([\\w.]+px)(?=[;\\s])`, 'g');
    modified = modified.replace(regex, (match, prefix, value) => {
      const converted = convertPxValue(value, 'em');
      if (converted) {
        changed = true;
        return prefix + converted;
      }
      return match;
    });
  });

  if (changed) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
    return 1;
  }
  return 0;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  let converted = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      converted += walkDir(filePath, callback);
    } else if (file.endsWith('.scss') || file.endsWith('.vue')) {
      converted += callback(filePath);
    }
  });

  return converted;
}

const srcDir = path.resolve(__dirname, '../src');
console.log('Converting px → rem/em in src/ ...\n');

const count = walkDir(srcDir, convertFile);
console.log(`\n✓ Converted ${count} file(s)`);
