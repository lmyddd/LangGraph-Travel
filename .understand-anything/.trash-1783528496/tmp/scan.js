const fs = require('fs');
const path = require('path');

const outputPath = process.argv[2];
const fileListPath = process.argv[3];

const files = fs.readFileSync(fileListPath, 'utf8').trim().split('\n').filter(Boolean);

function getFileCategory(p, lang) {
  const name = path.basename(p);
  if (['.md', '.rst', '.txt'].some(ext => name.endsWith(ext)) && !p.includes('/prisma/') && !p.includes('/generated/')) return 'docs';
  if (['.json', '.yaml', '.yml', '.toml', '.env', '.env.example'].some(ext => name.endsWith(ext)) || name === '.env' || name === '.env.example' || name === 'tsconfig.json' || name === 'nodemon.json' || name === 'package.json' || name === '.gitignore') return 'config';
  if (p === 'nginx.conf') return 'infra';
  if (p.endsWith('.prisma') || p.endsWith('.graphql') || p.endsWith('.proto')) return 'schema';
  if (p.endsWith('.sql')) return 'data';
  if (p.includes('/prisma/seed') || name === 'seed.ts') return 'script';
  if (p.endsWith('.html')) return 'markup';
  return 'code';
}

function getLanguage(p) {
  if (p.endsWith('.ts')) return 'typescript';
  if (p.endsWith('.vue')) return 'vue';
  if (p.endsWith('.js')) return 'javascript';
  if (p.endsWith('.json')) return 'json';
  if (p.endsWith('.css')) return 'css';
  if (p.endsWith('.html')) return 'html';
  if (p.endsWith('.md')) return 'markdown';
  if (p.endsWith('.sql')) return 'sql';
  if (p.endsWith('.prisma')) return 'prisma';
  if (p.endsWith('.toml')) return 'toml';
  if (p.endsWith('.env') || p.endsWith('.env.example')) return 'dotenv';
  if (p.endsWith('.conf')) return 'nginx';
  return 'text';
}

const results = [];
const importMap = {};

files.forEach(p => {
  try {
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n').length;
    const lang = getLanguage(p);
    const category = getFileCategory(p, lang);
    
    results.push({ path: p, language: lang, sizeLines: lines, fileCategory: category });
    
    if (['typescript', 'javascript', 'vue'].includes(lang)) {
      const imports = [];
      const lines_arr = content.split('\n');
      lines_arr.forEach(line => {
        const importMatch = line.match(/import\s+(?:(?:type\s+)?\{[^}]*\}|[^'"\s]+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/);
        const sideEffectMatch = line.match(/import\s+['"]([^'"]+)['"]/);
        if (importMatch && (importMatch[1].startsWith('.') || importMatch[1].startsWith('@/'))) {
          imports.push(importMatch[1]);
        }
        if (sideEffectMatch && (sideEffectMatch[1].startsWith('.') || sideEffectMatch[1].startsWith('@/'))) {
          imports.push(sideEffectMatch[1]);
        }
      });
      importMap[`./${p}`] = imports;
    } else {
      importMap[`./${p}`] = [];
    }
  } catch(e) {
    results.push({ path: p, language: 'unknown', sizeLines: 0, fileCategory: 'unknown' });
    importMap[`./${p}`] = [];
  }
});

const result = {
  projectName: '智游 (Travel-AI)',
  description: '基于 Vue 3 + TypeScript 的移动端 AI 旅行规划应用，采用 LangGraph 多 Agent 协作架构，通过 SSE 实时流式推送 Agent 工作进度',
  languages: ['typescript', 'vue', 'javascript', 'css', 'html', 'json', 'markdown', 'sql', 'prisma', 'toml', 'nginx', 'dotenv'],
  frameworks: ['Vue 3', 'Vite', 'Pinia', 'Vue Router', 'Vant 4', 'Express', 'LangGraph', 'LangChain', 'Prisma'],
  files: results,
  importMap: importMap,
  complexityEstimate: 'medium',
  fileCounts: { code: 0, config: 0, docs: 0, infra: 0, data: 0, script: 0, schema: 0, markup: 0 }
};

results.forEach(r => {
  if (result.fileCounts[r.fileCategory] !== undefined) {
    result.fileCounts[r.fileCategory]++;
  }
});

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`Scan complete: ${results.length} files, categories: ${JSON.stringify(result.fileCounts)}`);
