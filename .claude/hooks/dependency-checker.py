#!/usr/bin/env python3
"""
PostToolUse Hook: 의존성 변경 시 취약점 검사

- package.json, requirements.txt 등 변경 감지
- npm audit, pip-audit 실행
- 취약점 발견 시 경고
"""

import json
import sys
import subprocess
from pathlib import Path

# 의존성 파일 및 대응 검사 도구
DEPENDENCY_FILES = {
    'package.json': {
        'lock': ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
        'audit_cmd': ['npm', 'audit', '--json'],
        'alt_audit': ['yarn', 'audit', '--json'],
    },
    'requirements.txt': {
        'audit_cmd': ['pip-audit', '-f', 'json', '-r'],
        'needs_file': True,
    },
    'pyproject.toml': {
        'audit_cmd': ['pip-audit', '-f', 'json'],
    },
    'Gemfile': {
        'audit_cmd': ['bundle', 'audit', 'check', '--format', 'json'],
    },
    'go.mod': {
        'audit_cmd': ['govulncheck', '-json', './...'],
    },
}


def check_vulnerabilities(file_path: str) -> dict:
    """취약점 검사 실행"""
    file_name = Path(file_path).name
    config = DEPENDENCY_FILES.get(file_name)

    if not config:
        return {'checked': False}

    audit_cmd = config.get('audit_cmd', [])
    if not audit_cmd:
        return {'checked': False}

    try:
        # 명령어 구성
        cmd = audit_cmd.copy()
        if config.get('needs_file'):
            cmd.append(file_path)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=Path(file_path).parent
        )

        # 결과 파싱
        vulnerabilities = parse_audit_result(file_name, result.stdout)

        return {
            'checked': True,
            'vulnerabilities': vulnerabilities,
            'exit_code': result.returncode
        }

    except FileNotFoundError:
        # 도구가 설치되지 않은 경우
        return {'checked': False, 'reason': 'Audit tool not installed'}
    except subprocess.TimeoutExpired:
        return {'checked': False, 'reason': 'Audit timeout'}
    except Exception as e:
        return {'checked': False, 'reason': str(e)}


def parse_audit_result(file_name: str, output: str) -> list:
    """검사 결과 파싱"""
    vulnerabilities = []

    try:
        if not output.strip():
            return vulnerabilities

        data = json.loads(output)

        # npm audit 결과
        if file_name == 'package.json':
            if 'vulnerabilities' in data:
                for name, vuln in data.get('vulnerabilities', {}).items():
                    vulnerabilities.append({
                        'package': name,
                        'severity': vuln.get('severity', 'unknown'),
                        'title': vuln.get('via', [{}])[0].get('title', 'Unknown vulnerability') if isinstance(vuln.get('via', [{}])[0], dict) else str(vuln.get('via', ['Unknown'])[0]),
                    })

        # pip-audit 결과
        elif file_name in ['requirements.txt', 'pyproject.toml']:
            for vuln in data if isinstance(data, list) else data.get('vulnerabilities', []):
                vulnerabilities.append({
                    'package': vuln.get('name', 'unknown'),
                    'severity': vuln.get('fix_versions', ['no fix'])[0] if vuln.get('fix_versions') else 'no fix available',
                    'title': vuln.get('id', 'Unknown vulnerability'),
                })

    except json.JSONDecodeError:
        pass

    return vulnerabilities


def format_severity(severity: str) -> str:
    """심각도에 따른 이모지"""
    severity_map = {
        'critical': '🔴',
        'high': '🟠',
        'moderate': '🟡',
        'medium': '🟡',
        'low': '🟢',
    }
    return severity_map.get(severity.lower(), '⚪')


def main():
    try:
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Edit/Write 도구만 처리
        if tool_name not in ['Edit', 'Write']:
            sys.exit(0)

        file_path = tool_input.get('file_path', '')
        file_name = Path(file_path).name

        # 의존성 파일인지 확인
        if file_name not in DEPENDENCY_FILES:
            sys.exit(0)

        print(f"🔍 Checking dependencies in {file_name}...")

        result = check_vulnerabilities(file_path)

        if not result.get('checked'):
            reason = result.get('reason', 'Unknown')
            print(f"⚠️ Could not check vulnerabilities: {reason}")
            sys.exit(0)

        vulnerabilities = result.get('vulnerabilities', [])

        if vulnerabilities:
            # 심각도별 그룹화
            critical_high = [v for v in vulnerabilities if v['severity'].lower() in ['critical', 'high']]
            others = [v for v in vulnerabilities if v['severity'].lower() not in ['critical', 'high']]

            print(f"\n⚠️ Found {len(vulnerabilities)} vulnerabilities:")

            for vuln in critical_high[:5]:  # 상위 5개만 표시
                print(f"  {format_severity(vuln['severity'])} {vuln['package']}: {vuln['title']}")

            if len(vulnerabilities) > 5:
                print(f"  ... and {len(vulnerabilities) - 5} more")

            print(f"\nRun 'npm audit fix' or update packages to resolve.")

            # Critical/High 취약점이 있으면 경고 (차단하지는 않음)
            if critical_high:
                sys.exit(1)  # 경고
        else:
            print("✅ No vulnerabilities found")

        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
