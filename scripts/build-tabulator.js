#!/usr/bin/env node

// Build script for Tabulator - processes include directives without Gulp
// 
// This script:
// 1. Reads Tabulator source files
// 2. Recursively processes include directives (slash-star-equals-include path star-slash)
// 3. Transpiles to ES5 and ESM formats using Babel
// 4. Minifies output using Terser
// 5. Outputs to dist/js/ directory

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from '@babel/core';
import { minify } from 'terser';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TABULATOR_DIR = path.resolve(__dirname, '../app/lib/tabulator/tabulator-tables');
const SRC_DIR = path.join(TABULATOR_DIR, 'src/js');
const DIST_DIR = path.join(TABULATOR_DIR, 'dist/js');
const SCSS_SRC = path.join(TABULATOR_DIR, 'src/scss/tabulator.scss');
const CSS_DIST = path.join(TABULATOR_DIR, 'dist/css/tabulator.css');

// Track processed files to detect circular includes
const processingStack = [];
let processedFileCount = 0;

// Read a file with error handling
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err.message}`);
  }
}

// Write a file with directory creation
function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ Created ${path.relative(TABULATOR_DIR, filePath)}`);
}

// Recursively process include directives
// Replaces comments like slash-star-equals-include filename star-slash
function processIncludes(content, baseDir) {
  const includeRegex = /\/\*=include\s+([^*]+)\*\//g;
  
  return content.replace(includeRegex, (match, includePath) => {
    // Clean up the path (remove quotes and trim)
    const cleanPath = includePath.trim().replace(/['"]/g, '');
    const fullPath = path.resolve(baseDir, cleanPath);
    
    // Check for circular includes
    if (processingStack.includes(fullPath)) {
      throw new Error(`Circular include detected: ${processingStack.join(' -> ')} -> ${fullPath}`);
    }
    
    // Read the included file
    processingStack.push(fullPath);
    processedFileCount++;
    const includedContent = readFile(fullPath);
    
    // Recursively process includes in the included file
    const includedDir = path.dirname(fullPath);
    const processed = processIncludes(includedContent, includedDir);
    
    processingStack.pop();
    
    return `\n// ===== Included from ${cleanPath} =====\n${processed}\n// ===== End of ${cleanPath} =====\n`;
  });
}

// Build the core Tabulator file from sources
function buildCore() {
  console.log('\n📦 Building Tabulator core from sources...');
  
  const coreFile = path.join(SRC_DIR, 'core.js');
  const coreContent = readFile(coreFile);
  
  // Process all includes
  const processed = processIncludes(coreContent, SRC_DIR);
  
  // Add modules
  const modulesFile = path.join(SRC_DIR, 'modules_enabled.js');
  const modulesContent = readFile(modulesFile);
  const processedModules = processIncludes(modulesContent, SRC_DIR);
  
  return processed + '\n' + processedModules;
}

// Create UMD wrapper
function wrapUMD(code) {
  return `(function(global, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Tabulator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';
  
${code}

  return Tabulator;
}));`;
}

// Create ESM wrapper
function wrapESM(code) {
  return `${code}

export default Tabulator;
`;
}

// Transpile code using Babel
function transpile(code, options = {}) {
  try {
    const result = transformSync(code, {
      presets: [
        ['@babel/preset-env', {
          targets: options.esm ? { esmodules: true } : { ie: 11 },
          modules: options.esm ? false : 'umd',
        }]
      ],
      comments: true,
      compact: false,
    });
    return result.code;
  } catch (err) {
    console.error('Babel transpilation error:', err.message);
    throw err;
  }
}

// Minify code using Terser
async function minifyCode(code, filename) {
  console.log(`🗜️  Minifying ${filename}...`);
  try {
    const result = await minify(code, {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: [],
      },
      mangle: true,
      output: {
        comments: /^!/,
      },
    });
    return result.code;
  } catch (err) {
    console.error('Minification error:', err.message);
    throw err;
  }
}

// Compile SCSS to CSS using Sass
function compileCSS() {
  console.log('\n🎨 Compiling SCSS to CSS...');
  try {
    // Ensure dist/css directory exists
    const cssDir = path.dirname(CSS_DIST);
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true });
    }
    
    // Run sass compiler
    execSync(`sass "${SCSS_SRC}" "${CSS_DIST}" --no-source-map`, {
      stdio: 'inherit',
      cwd: TABULATOR_DIR
    });
    
    console.log(`✓ Created ${path.relative(TABULATOR_DIR, CSS_DIST)}`);
    
    // Display file size
    if (fs.existsSync(CSS_DIST)) {
      const size = (fs.statSync(CSS_DIST).size / 1024).toFixed(2);
      console.log(`  CSS file size: ${size} KB`);
    }
  } catch (err) {
    console.error('⚠️  CSS compilation failed:', err.message);
    console.error('Make sure sass is installed: npm install -g sass');
    // Don't fail the build if CSS compilation fails
  }
}

// Main build process
async function build() {
  console.log('🚀 Starting Tabulator build...\n');
  const startTime = Date.now();
  
  try {
    // Step 1: Build core from sources
    processedFileCount = 0;
    const coreSource = buildCore();
    console.log(`✓ Processed ${processedFileCount} source files`);
    
    // Step 2: Build UMD version (ES5)
    console.log('\n📦 Building UMD version (tabulator.js)...');
    const umdWrapped = wrapUMD(coreSource);
    const umdTranspiled = transpile(umdWrapped, { esm: false });
    writeFile(path.join(DIST_DIR, 'tabulator.js'), umdTranspiled);
    
    // Step 3: Build ESM version (ES2015+)
    console.log('\n📦 Building ESM version (tabulator.es2015.js)...');
    const esmWrapped = wrapESM(coreSource);
    const esmTranspiled = transpile(esmWrapped, { esm: true });
    writeFile(path.join(DIST_DIR, 'tabulator.es2015.js'), esmTranspiled);
    
    // Step 4: Minify UMD version
    console.log('\n📦 Building minified UMD version (tabulator.min.js)...');
    const umdMinified = await minifyCode(umdTranspiled, 'tabulator.min.js');
    writeFile(path.join(DIST_DIR, 'tabulator.min.js'), umdMinified);
    
    // Step 5: Minify ESM version
    console.log('\n📦 Building minified ESM version (tabulator.es2015.min.js)...');
    const esmMinified = await minifyCode(esmTranspiled, 'tabulator.es2015.min.js');
    writeFile(path.join(DIST_DIR, 'tabulator.es2015.min.js'), esmMinified);
    
    // Step 6: Compile SCSS to CSS
    compileCSS();
    
    // Step 7: Copy CSS to all tabulator locations
    console.log('\n📋 Copying CSS to all tabulator locations...');
    const cssLocations = [
      path.resolve(__dirname, '../app/lib/tabulator/styles/tabulator.css'),
      path.resolve(__dirname, '../app/lib/tabulator/react-tabulator/css/tabulator.css'),
      path.resolve(__dirname, '../app/lib/tabulator/react-tabulator/lib/css/tabulator.css'),
    ];
    
    cssLocations.forEach(dest => {
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.copyFileSync(CSS_DIST, dest);
      console.log(`  ✓ Copied to ${path.relative(path.resolve(__dirname, '..'), dest)}`);
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Build completed successfully in ${duration}s\n`);
    
    // Display file sizes
    console.log('📊 Output file sizes:');
    const files = [
      'tabulator.js',
      'tabulator.es2015.js',
      'tabulator.min.js',
      'tabulator.es2015.min.js'
    ];
    
    files.forEach(file => {
      const filePath = path.join(DIST_DIR, file);
      if (fs.existsSync(filePath)) {
        const size = (fs.statSync(filePath).size / 1024).toFixed(2);
        console.log(`  ${file.padEnd(30)} ${size} KB`);
      }
    });
    
  } catch (err) {
    console.error('\n❌ Build failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run the build
build();
