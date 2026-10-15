#!/usr/bin/env python3
"""Static checks for the *starter kit*, not app or game implementation tests."""
from pathlib import Path
import json
import sys

try:
    import yaml
except ImportError:
    print('PyYAML is required: python -m pip install PyYAML>=6.0')
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
ISSUES = []


def check(cond, message):
    if not cond:
        ISSUES.append(message)


def read_yaml(path):
    try:
        return yaml.safe_load(path.read_text(encoding='utf-8'))
    except Exception as exc:
        ISSUES.append(f'Invalid YAML {path.relative_to(ROOT)}: {exc}')
        return None


def read_frontmatter(path):
    text = path.read_text(encoding='utf-8')
    if not text.startswith('---\n'):
        ISSUES.append(f'Missing YAML frontmatter: {path.relative_to(ROOT)}')
        return {}
    pieces = text.split('---\n', 2)
    if len(pieces) < 3:
        ISSUES.append(f'Unclosed frontmatter: {path.relative_to(ROOT)}')
        return {}
    try:
        return yaml.safe_load(pieces[1]) or {}
    except Exception as exc:
        ISSUES.append(f'Bad frontmatter in {path.relative_to(ROOT)}: {exc}')
        return {}


required = [
    'README.md', 'MASTER_PROMPT.md', 'CLAUDE.md',
    'memory/MEMORY.md', 'memory/STATUS.md', 'memory/DECISIONS.md',
    'docs/PRD.md', 'docs/PRODUCT_VISION.md', 'docs/DESIGN_SYSTEM.md',
    'docs/GAMES.md', 'docs/ROADMAP.md', 'docs/ARCHITECTURE.md',
    'docs/API_AND_EVENTS.md', 'docs/DATA_MODEL.md', 'docs/ORCHESTRATION.md',
    'docs/QUALITY_STRATEGY.md', 'docs/SECURITY_PRIVACY.md',
    'docs/TECH_STACK.md', 'docs/SETUP.md', 'docs/REFERENCES.md',
    '.claude/settings.json', 'infra/docker-compose.yml', '.env.example',
]
for relative in required:
    check((ROOT / relative).is_file(), f'Missing required file: {relative}')

skills = {}
for p in sorted((ROOT / '.claude/skills').glob('*/SKILL.md')):
    data = read_frontmatter(p)
    name = data.get('name')
    check(isinstance(name, str) and name == p.parent.name, f'Skill directory/name mismatch: {p}')
    check(isinstance(data.get('description'), str) and len(data['description']) > 25, f'Insufficient skill description: {p}')
    check(name not in skills, f'Duplicate skill name: {name}')
    skills[name] = p
check(len(skills) >= 10, 'Expected at least 10 Claude Code skills')

agents = {}
for p in sorted((ROOT / '.claude/agents').glob('*.md')):
    data = read_frontmatter(p)
    name = data.get('name')
    check(isinstance(name, str) and name == p.stem, f'Agent directory/name mismatch: {p}')
    check(bool(data.get('description')), f'Agent missing description: {p}')
    check(bool(data.get('model')), f'Agent missing model: {p}')
    check(bool(data.get('tools')), f'Agent missing tools: {p}')
    for skill in data.get('skills', []):
        check(skill in skills, f'Agent {name} loads missing skill {skill}')
        if skill in skills:
            meta = read_frontmatter(skills[skill])
            check(not meta.get('disable-model-invocation'), f'Agent {name} preloads manual-only skill {skill}')
    check(name not in agents, f'Duplicate agent name: {name}')
    agents[name] = p
check(len(agents) >= 10, 'Expected at least 10 specialist agents')

for p in [ROOT / '.claude/settings.json', *sorted((ROOT / 'examples/game-manifests').glob('*.json'))]:
    try:
        json.loads(p.read_text(encoding='utf8'))
    except Exception as exc:
        ISSUES.append(f'Invalid JSON {p.relative_to(ROOT)}: {exc}')
for p in [ROOT / 'infra/docker-compose.yml', ROOT / '.github/workflows/blueprint-validation.yml', *sorted((ROOT / '.claude/rules').glob('*.md'))]:
    if p.suffix == '.yml':
        read_yaml(p)
    else:
        check(bool(read_frontmatter(p).get('paths')), f'Missing path-scoped rule frontmatter: {p}')

for token in ['docs/ROADMAP.md', 'memory/STATUS.md', 'docs/ORCHESTRATION.md']:
    check(token in (ROOT / 'CLAUDE.md').read_text(encoding='utf8'), f'CLAUDE.md lacks {token}')

if ISSUES:
    print('FAILED: FunFriday blueprint configuration checks:')
    for item in ISSUES:
        print(' -', item)
    sys.exit(1)
print(f'PASS: FunFriday blueprint structure: {len(required)} required files, {len(agents)} agents, {len(skills)} skills, JSON/YAML valid')
print('NOTE: This validates the documentation/starter kit only; no application, multiplayer, security or browser tests were run.')
