#!/usr/bin/env python3
"""
PostToolUse Hook: 코드 변경 후 린트 검사

- ESLint (JS/TS)
- Pylint/Ruff (Python)
- 린트 에러 보고
"""

import json
import sys
import subprocess
from pathlib import Path

# 확장자별 린터 설정
LINTERS = {
    '.js': {
        'eslint': ['npx', 'eslint', '--format', 'compact'],
        'biome': ['npx', 'biome', 'lint'],
    },
    '.jsx': {
        'eslint': ['npx', 'eslint', '--format', 'compact'],
    },
    '.ts': {
        'eslint': ['npx', 'eslint', '--format', 'compact'],
        'biome': ['npx', 'biome', 'lint'],
    },
    '.tsx': {
        'eslint': ['npx', 'eslint', '--format', 'compact'],
    },
    '.py': {
        'ruff': ['ruff', 'check', '--output-format', 'text'],
        'pylint': ['pylint', '--output-format=text', '--score=no'],
    },
    '.go': {
        'golint': ['golangci-lint', 'run'],
    },
    '.rs': {
        'clippy': ['cargo', 'clippy', '--message-format=short'],
    },
}

# 무시할 규칙 (너무 엄격하거나 스타일 관련)
IGNORED_RULES = {
    'eslint': ['no-console', 'prettier/prettier'],
    'pylint': ['C0114', 'C0115', 'C0116'],  # docstring 관련
    'ruff': ['E501'],  # 줄 길이
}


def detect_linter(file_path: str) -> tuple:
    """파일 타입에 맞는 린터 감지"""
    ext = Path(file_path).suffix
    linters = LINTERS.get(ext, {})

    if not linters:
        return (None, None)

    project_dir = Path(file_path).parent
    while project_dir != project_dir.parent:
        # ESLint 설정 확인
        if ext in ['.js', '.jsx', '.ts', '.tsx']:
            for config in ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js']:
                if (project_dir / config).exists():
                    return ('eslint', linters['eslint'])

            # biome.json 확인
            if (project_dir / 'biome.json').exists():
                return ('biome', linters.get('biome', linters.get('eslint')))

        # Python 린터 확인
        if ext == '.py':
            if (project_dir / 'ruff.toml').exists() or (project_dir / 'pyproject.toml').exists():
                return ('ruff', linters.get('ruff'))
            return ('pylint', linters.get('pylint'))

        project_dir = project_dir.parent

    # 기본 린터 반환
    linter_name = list(linters.keys())[0]
    return (linter_name, linters[linter_name])


def run_linter(linter: tuple, file_path: str) -> dict:
    """린터 실행"""
    linter_name, linter_cmd = linter

    if not linter_cmd:
        return {'checked': False, 'reason': 'No linter configured'}

    try:
        cmd = linter_cmd + [file_path]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        # 결과 파싱
        issues = parse_lint_result(linter_name, result.stdout + result.stderr, file_path)

        # 무시할 규칙 필터링
        ignored = IGNORED_RULES.get(linter_name, [])
        issues = [i for i in issues if i.get('rule') not in ignored]

        return {
            'checked': True,
            'issues': issues,
            'error_count': len([i for i in issues if i.get('severity') == 'error']),
            'warning_count': len([i for i in issues if i.get('severity') == 'warning']),
        }

    except FileNotFoundError:
        return {'checked': False, 'reason': f'{linter_name} not installed'}
    except subprocess.TimeoutExpired:
        return {'checked': False, 'reason': 'Lint timeout'}
    except Exception as e:
        return {'checked': False, 'reason': str(e)}


def parse_lint_result(linter: str, output: str, file_path: str) -> list:
    """린트 결과 파싱"""
    issues = []

    if not output.strip():
        return issues

    lines = output.strip().split('\n')

    for line in lines:
        if not line.strip():
            continue

        # ESLint compact 형식: file:line:col: message (rule)
        if linter == 'eslint':
            if file_path in line and ':' in line:
                parts = line.split(':')
                if len(parts) >= 4:
                    try:
                        line_num = parts[1]
                        message = ':'.join(parts[3:]).strip()
                        severity = 'error' if 'error' in message.lower() else 'warning'
                        rule = ''
                        if '(' in message and ')' in message:
                            rule = message[message.rfind('(')+1:message.rfind(')')]
                        issues.append({
                            'line': line_num,
                            'message': message,
                            'severity': severity,
                            'rule': rule,
                        })
                    except:
                        pass

        # Ruff 형식: file:line:col: CODE message
        elif linter == 'ruff':
            if file_path in line or line.startswith(Path(file_path).name):
                parts = line.split(':')
                if len(parts) >= 4:
                    try:
                        issues.append({
                            'line': parts[1],
                            'message': ':'.join(parts[3:]).strip(),
                            'severity': 'error',
                            'rule': '',
                        })
                    except:
                        pass

        # Pylint 형식
        elif linter == 'pylint':
            if ':' in line and ('error' in line.lower() or 'warning' in line.lower() or 'convention' in line.lower()):
                issues.append({
                    'line': '?',
                    'message': line.strip(),
                    'severity': 'error' if 'error' in line.lower() else 'warning',
                    'rule': '',
                })

    return issues[:10]  # 최대 10개


def main():
    try:
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Edit/Write 도구만 처리
        if tool_name not in ['Edit', 'Write']:
            sys.exit(0)

        file_path = tool_input.get('file_path', '')
        ext = Path(file_path).suffix

        # 지원하는 파일 타입인지 확인
        if ext not in LINTERS:
            sys.exit(0)

        # 린터 감지
        linter = detect_linter(file_path)

        if not linter[0]:
            sys.exit(0)

        result = run_linter(linter, file_path)

        if not result.get('checked'):
            sys.exit(0)

        issues = result.get('issues', [])
        error_count = result.get('error_count', 0)
        warning_count = result.get('warning_count', 0)

        if issues:
            print(f"📋 Lint: {error_count} errors, {warning_count} warnings")

            for issue in issues[:5]:
                severity_icon = '🔴' if issue['severity'] == 'error' else '🟡'
                print(f"  {severity_icon} Line {issue['line']}: {issue['message'][:60]}")

            if len(issues) > 5:
                print(f"  ... and {len(issues) - 5} more issues")

            # 에러가 있으면 경고
            if error_count > 0:
                sys.exit(1)
        else:
            print("✅ No lint issues")

        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
