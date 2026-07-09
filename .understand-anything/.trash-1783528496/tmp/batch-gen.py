import json
import os
import re

with open('.understand-anything/intermediate/scan-result.json', 'r', encoding='utf-8') as f:
    scan = json.load(f)

files = scan['files']
import_map = scan.get('importMap', {})

def norm_path(p):
    return p.replace('\\', '/').replace('./', '', 1)

file_set = set(norm_path(f['path']) for f in files)

groups = {
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
}

def classify(f):
    p = norm_path(f['path'])
    if p == 'shared/types.ts':
        return 'shared-types'
    if p in ['README.md', 'nginx.conf', '.gitignore',
             'JD面试准备-针对性问答.md', '面试学习指南.md']:
        return 'root-docs-config'
    if re.match(r'^travel-h5/(package\.json|tsconfig\.json|vite\.config\.ts|index\.html|components\.d\.ts|README\.md|\.gitignore|src/env\.d\.ts|src/main\.ts)$', p):
        return 'h5-entry-config'
    if p.startswith('travel-h5/src/views/'):
        return 'h5-views'
    if p.startswith('travel-h5/src/components/'):
        return 'h5-components'
    if p.startswith('travel-h5/src/composables/'):
        return 'h5-composables'
    if p.startswith('travel-h5/src/store/'):
        return 'h5-stores'
    if p.startswith('travel-h5/src/router/'):
        return 'h5-router'
    if p.startswith('travel-h5/src/utils/'):
        return 'h5-utils'
    if p.startswith('travel-h5/src/style/'):
        return 'h5-style'
    if re.match(r'^travel-server/(package\.json|tsconfig\.json|nodemon\.json|\.env|\.env\.example|\.gitignore|prisma\.config\.ts|src/index\.ts)$', p):
        return 'server-entry-config'
    if p.startswith('travel-server/src/routes/'):
        return 'server-routes'
    if p.startswith('travel-server/src/middleware/'):
        return 'server-middleware'
    if re.match(r'travel-server/src/services/(chat|travel|trip|user|db)\.[jt]s', p):
        return 'server-services'
    if p.startswith('travel-server/src/services/agent/graph/'):
        return 'server-agent-graph'
    if p.startswith('travel-server/src/services/agent/tools/'):
        return 'server-agent-tools'
    if p.startswith('travel-server/src/services/agent/') and '/tools/' not in p and '/graph/' not in p:
        return 'server-agent-misc'
    if p.startswith('travel-server/src/generated/'):
        return 'server-generated'
    if p.startswith('travel-server/prisma/'):
        return 'server-prisma'
    if p.startswith('travel-server/src/utils/'):
        return 'server-utils'
    return 'root-docs-config'

for f in files:
    g = classify(f)
    groups[g].append(f)

batches = []
batch_index = 0
for name, batch_files in groups.items():
    if not batch_files:
        continue
    batch_file_paths = set('./' + norm_path(f['path']) for f in batch_files)
    batch_import_data = {}
    for f in batch_files:
        fp = './' + norm_path(f['path'])
        batch_import_data[fp] = import_map.get(fp, [])

    neighbor_map = {}
    for f in batch_files:
        fp = './' + norm_path(f['path'])
        imps = batch_import_data.get(fp, [])
        for imp in imps:
            resolved = None
            from_dir = re.sub(r'/[^/]+$', '', fp)
            if imp.startswith('@/'):
                pkg = 'travel-h5' if 'travel-h5' in fp else 'travel-server'
                resolved = './' + pkg + '/src/' + imp.replace('@/', '')
            elif imp.startswith('../'):
                parts = imp.split('/')
                d = from_dir
                for part in parts:
                    if part == '..':
                        d = re.sub(r'/[^/]+$', '', d)
                    elif part != '.':
                        d += '/' + part
                resolved = d
            elif imp.startswith('./'):
                resolved = from_dir + '/' + imp.replace('./', '')

            if resolved and resolved not in batch_file_paths:
                rn = resolved.replace('./', '', 1)
                if rn in file_set:
                    neighbor_map.setdefault(fp, []).append(resolved)

    batches.append({
        'batchIndex': batch_index,
        'batchName': name,
        'files': [{
            'path': norm_path(f['path']),
            'language': f['language'],
            'sizeLines': f['sizeLines'],
            'fileCategory': f['fileCategory']
        } for f in batch_files],
        'batchImportData': batch_import_data,
        'neighborMap': neighbor_map
    })
    batch_index += 1

with open('.understand-anything/intermediate/batches.json', 'w', encoding='utf-8') as f:
    json.dump({'batches': batches}, f, ensure_ascii=False, indent=2)

print(f'Batches: {len(batches)}')
for b in batches:
    print(f'  Batch {b["batchIndex"]}: {b["batchName"]} ({len(b["files"])} files)')
