#!/usr/bin/env python3
"""
환경 체크 스크립트

Claude Code 사용에 필요한 환경을 확인합니다.
- 필수 도구 설치 여부
- MCP 서버 상태
- 훅 실행 가능 여부
"""

import subprocess
import shutil
import sys
import os
import json
import io
from pathlib import Path

# Windows 콘솔 UTF-8 인코딩 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 체크할 도구들
REQUIRED_TOOLS = {
    'node': {
        'check': ['node', '--version'],
        'min_version': '18.0.0',
        'install_url': 'https://nodejs.org/',
        'required': True,
    },
    'npm': {
        'check': ['npm', '--version'],
        'min_version': '9.0.0',
        'install_url': 'https://nodejs.org/',
        'required': True,
    },
    'python': {
        'check': ['python', '--version'],
        'min_version': '3.8.0',
        'install_url': 'https://www.python.org/',
        'required': True,
    },
    'git': {
        'check': ['git', '--version'],
        'min_version': '2.0.0',
        'install_url': 'https://git-scm.com/',
        'required': True,
    },
    'claude': {
        'check': ['claude', '--version'],
        'install_url': 'npm install -g @anthropic-ai/claude-code',
        'required': True,
    },
}

OPTIONAL_TOOLS = {
    'docker': {
        'check': ['docker', '--version'],
        'install_url': 'https://docker.com/',
    },
    'prettier': {
        'check': ['npx', 'prettier', '--version'],
        'install_url': 'npm install -g prettier',
    },
    'eslint': {
        'check': ['npx', 'eslint', '--version'],
        'install_url': 'npm install -g eslint',
    },
    'black': {
        'check': ['python', '-m', 'black', '--version'],
        'install_url': 'pip install black',
    },
}


def check_tool(name: str, config: dict) -> dict:
    """도구 설치 및 버전 확인"""
    result = {
        'name': name,
        'installed': False,
        'version': None,
        'meets_requirement': False,
    }

    try:
        proc = subprocess.run(
            config['check'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if proc.returncode == 0:
            result['installed'] = True
            # 버전 추출 시도
            output = proc.stdout.strip() or proc.stderr.strip()
            # 버전 번호 추출 (간단한 패턴)
            import re
            version_match = re.search(r'(\d+\.\d+\.\d+)', output)
            if version_match:
                result['version'] = version_match.group(1)

            # 최소 버전 체크
            min_version = config.get('min_version')
            if min_version and result['version']:
                result['meets_requirement'] = compare_versions(result['version'], min_version) >= 0
            else:
                result['meets_requirement'] = True

    except FileNotFoundError:
        pass
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass

    return result


def compare_versions(v1: str, v2: str) -> int:
    """버전 비교 (-1: v1<v2, 0: v1==v2, 1: v1>v2)"""
    try:
        parts1 = [int(x) for x in v1.split('.')[:3]]
        parts2 = [int(x) for x in v2.split('.')[:3]]

        # 길이 맞추기
        while len(parts1) < 3:
            parts1.append(0)
        while len(parts2) < 3:
            parts2.append(0)

        for p1, p2 in zip(parts1, parts2):
            if p1 < p2:
                return -1
            if p1 > p2:
                return 1
        return 0
    except:
        return 0


def check_mcp_servers() -> list:
    """설치된 MCP 서버 확인"""
    try:
        result = subprocess.run(
            ['claude', 'mcp', 'list'],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            lines = result.stdout.strip().split('\n')
            return [line.strip() for line in lines if line.strip()]
    except:
        pass
    return []


def check_hooks_executable() -> dict:
    """훅 파일 실행 가능 여부"""
    hooks_dir = Path('.claude/hooks')
    result = {'found': [], 'not_found': [], 'not_executable': []}

    expected_hooks = [
        'pre-edit-validator.py',
        'post-edit-formatter.py',
        'security-scanner.py',
        'command-logger.py',
        'dependency-checker.py',
        'test-runner.py',
        'lint-checker.py',
        'code-complexity.py',
        'commit-validator.py',
    ]

    for hook in expected_hooks:
        hook_path = hooks_dir / hook
        if hook_path.exists():
            result['found'].append(hook)
            # Unix에서만 실행 권한 체크
            if os.name != 'nt' and not os.access(hook_path, os.X_OK):
                result['not_executable'].append(hook)
        else:
            result['not_found'].append(hook)

    return result


def check_env_variables() -> dict:
    """환경 변수 확인"""
    vars_to_check = {
        'GITHUB_TOKEN': 'GitHub API 접근',
        'DATABASE_URL': 'PostgreSQL 연결',
        'OPENAI_API_KEY': 'OpenAI API',
        'ANTHROPIC_API_KEY': 'Anthropic API',
    }

    result = {}
    for var, description in vars_to_check.items():
        value = os.environ.get(var)
        result[var] = {
            'set': value is not None,
            'description': description,
            # 값이 있으면 마스킹하여 표시
            'preview': f"{value[:4]}...{value[-4:]}" if value and len(value) > 8 else ('***' if value else None)
        }

    return result


def run_full_check(verbose: bool = True) -> dict:
    """전체 환경 체크"""
    results = {
        'required_tools': {},
        'optional_tools': {},
        'mcp_servers': [],
        'hooks': {},
        'env_variables': {},
        'overall_status': 'ok',
        'issues': [],
    }

    if verbose:
        print("\n" + "=" * 60)
        print("🔍 Claude Code 환경 체크")
        print("=" * 60)

    # 필수 도구 체크
    if verbose:
        print("\n📋 필수 도구:")

    all_required_ok = True
    for name, config in REQUIRED_TOOLS.items():
        check_result = check_tool(name, config)
        results['required_tools'][name] = check_result

        if verbose:
            if check_result['installed'] and check_result['meets_requirement']:
                status = f"✅ {name} v{check_result['version'] or '?'}"
            elif check_result['installed']:
                status = f"⚠️ {name} v{check_result['version']} (업데이트 필요)"
                results['issues'].append(f"{name} 버전이 낮습니다: {config.get('install_url', '')}")
            else:
                status = f"❌ {name} (미설치)"
                results['issues'].append(f"{name} 설치 필요: {config.get('install_url', '')}")
                all_required_ok = False
            print(f"  {status}")

    # 선택 도구 체크
    if verbose:
        print("\n📋 선택 도구:")

    for name, config in OPTIONAL_TOOLS.items():
        check_result = check_tool(name, config)
        results['optional_tools'][name] = check_result

        if verbose:
            if check_result['installed']:
                status = f"✅ {name} v{check_result['version'] or '?'}"
            else:
                status = f"⬚ {name} (미설치, 선택사항)"
            print(f"  {status}")

    # MCP 서버 체크
    results['mcp_servers'] = check_mcp_servers()
    if verbose:
        print(f"\n📋 MCP 서버:")
        if results['mcp_servers']:
            for server in results['mcp_servers']:
                print(f"  ✅ {server}")
        else:
            print("  ⬚ 설치된 MCP 서버 없음")
            print("  → /setup mcp 로 설치하세요")

    # 훅 체크
    results['hooks'] = check_hooks_executable()
    if verbose:
        print(f"\n📋 훅 상태:")
        print(f"  ✅ 발견: {len(results['hooks']['found'])}개")
        if results['hooks']['not_found']:
            print(f"  ⚠️ 누락: {', '.join(results['hooks']['not_found'])}")
        if results['hooks']['not_executable']:
            print(f"  ⚠️ 실행 불가: {', '.join(results['hooks']['not_executable'])}")

    # 환경 변수 체크
    results['env_variables'] = check_env_variables()
    if verbose:
        print(f"\n📋 환경 변수:")
        for var, info in results['env_variables'].items():
            if info['set']:
                print(f"  ✅ {var}: {info['preview']}")
            else:
                print(f"  ⬚ {var}: 미설정 ({info['description']})")

    # 전체 상태 결정
    if not all_required_ok:
        results['overall_status'] = 'error'
    elif results['issues']:
        results['overall_status'] = 'warning'

    if verbose:
        print("\n" + "=" * 60)
        if results['overall_status'] == 'ok':
            print("✅ 환경이 정상입니다!")
        elif results['overall_status'] == 'warning':
            print("⚠️ 일부 권장 사항이 충족되지 않았습니다.")
        else:
            print("❌ 필수 요구 사항이 충족되지 않았습니다.")

        if results['issues']:
            print("\n📌 조치 필요:")
            for issue in results['issues']:
                print(f"  • {issue}")

    return results


def main():
    import argparse

    parser = argparse.ArgumentParser(description='환경 체크')
    parser.add_argument('--json', action='store_true', help='JSON 형식 출력')
    parser.add_argument('--quiet', action='store_true', help='간단 출력')

    args = parser.parse_args()

    results = run_full_check(verbose=not args.json)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))

    # 종료 코드
    if results['overall_status'] == 'error':
        sys.exit(1)
    elif results['overall_status'] == 'warning':
        sys.exit(0)  # 경고는 성공으로 처리
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
