#!/usr/bin/env python3
"""Re-scan imports from all TypeScript/Vue/JavaScript files."""
import json
import os
import re

with open('.understand-anything/intermediate/scan-result.json', 'r', encoding='utf-8') as f:
    scan = json.load(f)

files = scan['files']
import_map = {}

import_patterns = [
    # import { foo } from '...'
    re.compile(r"import\s+\{[^}]*\}\s+from\s+['\"]([^'\"]+)['\"]"),
    # import foo from '...'
    re.compile(r"import\s+(?:type\s+)?(\w+)\s+from\s+['\"]([^'\"]+)['\"]"),
    # import * as foo from '...'
    re.compile(r"import\s+\*\s+as\s+\w+\s+from\s+['\"]([^'\"]+)['\"]"),
    # import '...'  (side-effect)
    re.compile(r"import\s+['\"]([^'\"]+)['\"]"),
    # await import('...')
    re.compile(r"await\s+import\s*\(\s*['\"]([^'\"]+)['\"]"),
    # export ... from '...'
    re.compile(r"export\s+(?:\{[^}]*\}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]"),
    # require('...')
    re.compile(r"require\s*\(\s*['\"]([^'\"]+)['\"]"),
    # defineAsyncComponent(() => import('...'))
    re.compile(r"import\s*\(\s*['\"]([^'\"]+)['\"]"),
]

for f in files:
    p = f['path'].replace('\\', '/')
    ext = os.path.splitext(p)[1]
    if ext not in ('.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs', '.cjs'):
        continue

    fp = './' + p
    try:
        content = open(p, 'r', encoding='utf-8').read()
    except Exception:
        import_map[fp] = []
        continue

    imports = []
    for pattern in import_patterns:
        for m in pattern.finditer(content):
            groups = m.groups()
            # Get the path argument (last group)
            imp_path = groups[-1] if groups else None
            if not imp_path:
                continue
            # Only internal imports (relative or @/ alias)
            if imp_path.startswith('@/') or imp_path.startswith('.'):
                imports.append(imp_path)

    # De-duplicate
    imports = list(dict.fromkeys(imports))
    import_map[fp] = imports

# Update the import map back to scan result
scan['importMap'] = import_map

with open('.understand-anything/intermediate/scan-result.json', 'w', encoding='utf-8') as f:
    json.dump(scan, f, ensure_ascii=False, indent=2)

total_imports = sum(len(v) for v in import_map.values())
files_with_imports = sum(1 for v in import_map.values() if v)
print(f'Import map: {total_imports} total imports across {files_with_imports} files')
