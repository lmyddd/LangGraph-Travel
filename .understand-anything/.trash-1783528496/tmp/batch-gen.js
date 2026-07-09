const fs = require('fs');

const scanResult = JSON.parse(fs.readFileSync('.understand-anything/intermediate/scan-result.json', 'utf8'));
const files = scanResult.files;
const importMap = scanResult.importMap;

// Helper to resolve relative imports to file paths
function resolveImport(importPath, fromFile) {
  const fromDir = fromFile.replace(/\/[^/]+$/, '');
  
  if (importPath.startsWith('@/')) {
    const pkg = fromFile.includes('travel-h5') ? 'travel-h5' : 'travel-server';
    const rel = importPath.replace('@/', '');
    return './' + pkg + '/src/' + rel;
  }
  
  if (importPath.startsWith('../')) {
    const parts = importPath.split('/');
    let dir = fromDir;
    for (const part of parts) {
      if (part === '..') {
        dir = dir.replace(/\/[^/]+$/, '');
      } else if (part !== '.') {
        dir += '/' + part;
      }
    }
    return dir;
  }
  
  if (importPath.startsWith('./')) {
    const rest = importPath.replace('./', '');
    return fromDir + '/' + rest;
  }
  
  return null;
}

function normPath(p) {
  return p.replace(/\/g, '/').replace(/^\.\//, '');
}

const fileSet = new Set(files.map(f => normPath(f.path)));

const groups = {
  'shared-types': [],
  'root-docs-config': [],
  'h5-entry-config': [],
  'h5-views': [],
  'h5-components': [],
  'h5-composables': [],
  'h5-stores': [],
  'h5-router': [],
  'h5-utils': [],
  'h5-style': [],
  'server-entry-config': [],
  'server-routes': [],
  'server-middleware': [],
  'server-services': [],
  'server-agent-graph': [],
  'server-agent-tools': [],
  'server-agent-misc': [],
  'server-generated': [],
  'server-prisma': [],
  'server-utils': [],
};

files.forEach(f => {
  const p = normPath(f.path);
  
  if (p === 'shared/types.ts') { groups['shared-types'].push(f); }
  else if (['README.md', 'nginx.conf', '.gitignore', 'JD面试准备-针对性问答.md', '面试学习指南.md'].includes(p)) { groups['root-docs-config'].push(f); }
  else if (p.startsWith('travel-h5/package.json') || p.startsWith('travel-h5/tsconfig.json') || p.startsWith('travel-h5/vite.config.ts') || p === 'travel-h5/index.html' || p === 'travel-h5/components.d.ts' || p === 'travel-h5/src/env.d.ts' || p === 'travel-h5/src/main.ts' || p === 'travel-h5/README.md' || p === 'travel-h5/.gitignore') { groups['h5-entry-config'].push(f); }
  else if (p.startsWith('travel-h5/src/views/')) { groups['h5-views'].push(f); }
  else if (p.startsWith('travel-h5/src/components/')) { groups['h5-components'].push(f); }
  else if (p.startsWith('travel-h5/src/composables/')) { groups['h5-composables'].push(f); }
  else if (p.startsWith('travel-h5/src/store/')) { groups['h5-stores'].push(f); }
  else if (p.startsWith('travel-h5/src/router/')) { groups['h5-router'].push(f); }
  else if (p.startsWith('travel-h5/src/utils/')) { groups['h5-utils'].push(f); }
  else if (p.startsWith('travel-h5/src/style/')) { groups['h5-style'].push(f); }
  else if (p === 'travel-server/package.json' || p === 'travel-server/tsconfig.json' || p === 'travel-server/nodemon.json' || p === 'travel-server/.env' || p === 'travel-server/.env.example' || p === 'travel-server/.gitignore' || p === 'travel-server/prisma.config.ts' || p === 'travel-server/src/index.ts') { groups['server-entry-config'].push(f); }
  else if (p.startsWith('travel-server/src/routes/')) { groups['server-routes'].push(f); }
  else if (p.startsWith('travel-server/src/middleware/')) { groups['server-middleware'].push(f); }
  else if (p.match(/travel-server\/src\/services\/(chat|travel|trip|user|db)\.[jt]s/)) { groups['server-services'].push(f); }
  else if (p.startsWith('travel-server/src/services/agent/graph/')) { groups['server-agent-graph'].push(f); }
  else if (p.startsWith('travel-server/src/services/agent/tools/')) { groups['server-agent-tools'].push(f); }
  else if (p.startsWith('travel-server/src/services/agent/') && !p.includes('/tools/') && !p.includes('/graph/')) { groups['server-agent-misc'].push(f); }
  else if (p.startsWith('travel-server/src/generated/')) { groups['server-generated'].push(f); }
  else if (p.startsWith('travel-server/prisma/')) { groups['server-prisma'].push(f); }
  else if (p.startsWith('travel-server/src/utils/')) { groups['server-utils'].push(f); }
  else { groups['root-docs-config'].push(f); }
});

let batchIndex = 0;
const batchArray = [];

Object.entries(groups).forEach(([name, batchFiles]) => {
  if (batchFiles.length === 0) return;
  
  const batchImportData = {};
  const batchFilePaths = new Set(batchFiles.map(f => './' + normPath(f.path)));
  
  batchFiles.forEach(f => {
    const filePath = './' + normPath(f.path);
    const imports = importMap[filePath] || [];
    batchImportData[filePath] = imports;
  });
  
  const neighborMap = {};
  batchFiles.forEach(f => {
    const filePath = './' + normPath(f.path);
    const imports = batchImportData[filePath] || [];
    imports.forEach(imp => {
      const resolved = resolveImport(imp, filePath);
      if (resolved && !batchFilePaths.has(resolved)) {
        // Check if exists in fileSet
        const resolvedNorm = resolved.replace(/^\.\//, '');
        if (fileSet.has(resolvedNorm)) {
          if (!neighborMap[filePath]) neighborMap[filePath] = [];
          neighborMap[filePath].push(resolved);
        }
      }
    });
  });
  
  batchArray.push({
    batchIndex,
    batchName: name,
    files: batchFiles.map(f => ({
      path: normPath(f.path),
      language: f.language,
      sizeLines: f.sizeLines,
      fileCategory: f.fileCategory
    })),
    batchImportData,
    neighborMap
  });
  
  batchIndex++;
});

const output = { batches: batchArray };
fs.writeFileSync('.understand-anything/intermediate/batches.json', JSON.stringify(output, null, 2));
console.log(`Batches: ${batchArray.length}`);
batchArray.forEach(b => {
  console.log(`  Batch ${b.batchIndex}: ${b.batchName} (${b.files.length} files)`);
});
