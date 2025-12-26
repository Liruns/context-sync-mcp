#!/usr/bin/env python3
"""
MCP 서버 설치 및 환경 설정 스크립트

- 필수 MCP 서버 설치 여부 확인
- 미설치 시 자동 설치
- 환경 변수 설정 가이드
"""

import subprocess
import shutil
import json
import sys
import os
from pathlib import Path

# 기본 MCP 서버 목록
DEFAULT_MCP_SERVERS = {
    'filesystem': {
        'package': '@anthropic/mcp-filesystem-server',
        'description': '파일 시스템 확장 접근',
        'required': False,
    },
    'github': {
        'package': '@anthropic/mcp-server-github',
        'description': 'GitHub 연동 (이슈, PR)',
        'required': False,
        'env': ['GITHUB_TOKEN'],
    },
    'postgres': {
        'package': '@anthropic/mcp-postgres-server',
        'description': 'PostgreSQL 데이터베이스',
        'required': False,
        'env': ['DATABASE_URL'],
    },
    'sqlite': {
        'package': '@anthropic/mcp-sqlite-server',
        'description': 'SQLite 데이터베이스',
        'required': False,
    },
    'puppeteer': {
        'package': '@anthropic/mcp-puppeteer-server',
        'description': '브라우저 자동화',
        'required': False,
    },
    'fetch': {
        'package': '@anthropic/mcp-fetch-server',
        'description': 'HTTP 요청',
        'required': False,
    },
    'memory': {
        'package': '@anthropic/mcp-memory-server',
        'description': '영구 메모리 저장소',
        'required': False,
    },
    'sequential-thinking': {
        'package': '@anthropic/mcp-sequential-thinking-server',
        'description': '순차적 사고 지원',
        'required': False,
    },
}

# 추천 MCP 서버 (개발 환경별)
RECOMMENDED_BY_STACK = {
    'web': ['github', 'fetch', 'puppeteer'],
    'backend': ['github', 'postgres', 'fetch'],
    'fullstack': ['github', 'postgres', 'fetch', 'puppeteer'],
    'data': ['postgres', 'sqlite', 'fetch'],
    'minimal': ['github', 'fetch'],
}


def check_npm():
    """npm 설치 확인"""
    return shutil.which('npm') is not None


def check_npx():
    """npx 설치 확인"""
    return shutil.which('npx') is not None


def check_claude_cli():
    """Claude CLI 설치 확인"""
    return shutil.which('claude') is not None


def check_mcp_installed(package_name: str) -> bool:
    """MCP 패키지 설치 여부 확인"""
    try:
        result = subprocess.run(
            ['npm', 'list', '-g', package_name],
            capture_output=True,
            text=True,
            timeout=30
        )
        return package_name in result.stdout
    except:
        return False


def install_mcp_package(package_name: str) -> bool:
    """MCP 패키지 전역 설치"""
    try:
        print(f"  📦 Installing {package_name}...")
        result = subprocess.run(
            ['npm', 'install', '-g', package_name],
            capture_output=True,
            text=True,
            timeout=120
        )
        return result.returncode == 0
    except Exception as e:
        print(f"  ❌ Installation failed: {e}")
        return False


def add_mcp_to_claude(name: str, config: dict) -> bool:
    """Claude CLI에 MCP 서버 추가"""
    try:
        package = config['package']

        # stdio 타입 MCP 추가
        cmd = ['claude', 'mcp', 'add', name, '--', 'npx', '-y', package]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0
    except Exception as e:
        print(f"  ❌ Failed to add to Claude: {e}")
        return False


def get_installed_mcp_servers() -> list:
    """현재 설치된 MCP 서버 목록"""
    try:
        result = subprocess.run(
            ['claude', 'mcp', 'list'],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            # 출력 파싱 (형식에 따라 조정 필요)
            lines = result.stdout.strip().split('\n')
            servers = [line.split()[0] for line in lines if line.strip()]
            return servers
    except:
        pass
    return []


def interactive_setup():
    """대화형 설정"""
    print("\n" + "=" * 60)
    print("🔧 Claude Code MCP 서버 설정")
    print("=" * 60)

    # 환경 체크
    print("\n📋 환경 확인 중...")

    checks = {
        'npm': check_npm(),
        'npx': check_npx(),
        'claude': check_claude_cli(),
    }

    for tool, installed in checks.items():
        status = "✅" if installed else "❌"
        print(f"  {status} {tool}")

    if not all(checks.values()):
        print("\n⚠️ 필수 도구가 설치되지 않았습니다.")
        if not checks['npm']:
            print("  → Node.js를 설치하세요: https://nodejs.org/")
        if not checks['claude']:
            print("  → Claude CLI를 설치하세요: npm install -g @anthropic-ai/claude-code")
        return False

    # 현재 설치된 MCP 확인
    print("\n📋 현재 설치된 MCP 서버 확인 중...")
    installed = get_installed_mcp_servers()

    if installed:
        print(f"  설치됨: {', '.join(installed)}")
    else:
        print("  설치된 MCP 서버 없음")

    # 개발 스택 선택
    print("\n📦 개발 스택을 선택하세요:")
    print("  1. web       - 웹 프론트엔드 (github, fetch, puppeteer)")
    print("  2. backend   - 백엔드 (github, postgres, fetch)")
    print("  3. fullstack - 풀스택 (github, postgres, fetch, puppeteer)")
    print("  4. data      - 데이터 (postgres, sqlite, fetch)")
    print("  5. minimal   - 최소 (github, fetch)")
    print("  6. custom    - 직접 선택")
    print("  7. skip      - 건너뛰기")

    choice = input("\n선택 (1-7): ").strip()

    if choice == '7':
        print("\n⏭️ MCP 설정을 건너뜁니다.")
        return True

    if choice == '6':
        # 직접 선택
        print("\n사용 가능한 MCP 서버:")
        for i, (name, config) in enumerate(DEFAULT_MCP_SERVERS.items(), 1):
            installed_mark = "✅" if name in installed else "  "
            print(f"  {installed_mark} {i}. {name}: {config['description']}")

        selections = input("\n설치할 번호 (쉼표로 구분, 예: 1,2,3): ").strip()
        try:
            indices = [int(x.strip()) - 1 for x in selections.split(',')]
            server_names = list(DEFAULT_MCP_SERVERS.keys())
            to_install = [server_names[i] for i in indices if 0 <= i < len(server_names)]
        except:
            print("❌ 잘못된 입력입니다.")
            return False
    else:
        stack_map = {'1': 'web', '2': 'backend', '3': 'fullstack', '4': 'data', '5': 'minimal'}
        stack = stack_map.get(choice, 'minimal')
        to_install = RECOMMENDED_BY_STACK.get(stack, [])

    # 이미 설치된 것 제외
    to_install = [s for s in to_install if s not in installed]

    if not to_install:
        print("\n✅ 모든 MCP 서버가 이미 설치되어 있습니다.")
        return True

    print(f"\n📥 설치할 MCP 서버: {', '.join(to_install)}")
    confirm = input("계속하시겠습니까? (y/n): ").strip().lower()

    if confirm != 'y':
        print("⏭️ 설치를 취소합니다.")
        return True

    # 설치 진행
    print("\n🚀 MCP 서버 설치 중...")
    success_count = 0
    failed = []

    for server_name in to_install:
        config = DEFAULT_MCP_SERVERS[server_name]
        print(f"\n[{server_name}]")

        # npm 패키지 설치
        if install_mcp_package(config['package']):
            # Claude에 추가
            if add_mcp_to_claude(server_name, config):
                print(f"  ✅ {server_name} 설치 완료")
                success_count += 1

                # 환경 변수 필요 시 안내
                if 'env' in config:
                    print(f"  ℹ️ 필요한 환경 변수: {', '.join(config['env'])}")
            else:
                failed.append(server_name)
        else:
            failed.append(server_name)

    # 결과 요약
    print("\n" + "=" * 60)
    print("📊 설치 결과")
    print("=" * 60)
    print(f"  ✅ 성공: {success_count}개")
    if failed:
        print(f"  ❌ 실패: {', '.join(failed)}")

    # 환경 변수 설정 안내
    env_needed = []
    for server in to_install:
        config = DEFAULT_MCP_SERVERS.get(server, {})
        env_needed.extend(config.get('env', []))

    if env_needed:
        print("\n⚙️ 환경 변수 설정이 필요합니다:")
        for env in set(env_needed):
            print(f"  export {env}=<your-value>")

    print("\n✅ MCP 설정 완료!")
    return True


def quick_check():
    """빠른 환경 체크 (비대화형)"""
    result = {
        'npm': check_npm(),
        'npx': check_npx(),
        'claude': check_claude_cli(),
        'mcp_servers': get_installed_mcp_servers(),
    }

    print(json.dumps(result, indent=2))
    return all([result['npm'], result['npx'], result['claude']])


def main():
    import argparse

    parser = argparse.ArgumentParser(description='MCP 서버 설치 및 설정')
    parser.add_argument('--check', action='store_true', help='환경 체크만 수행')
    parser.add_argument('--install', nargs='+', help='특정 MCP 서버 설치')
    parser.add_argument('--list', action='store_true', help='사용 가능한 MCP 서버 목록')

    args = parser.parse_args()

    if args.check:
        sys.exit(0 if quick_check() else 1)

    if args.list:
        print("\n사용 가능한 MCP 서버:")
        for name, config in DEFAULT_MCP_SERVERS.items():
            print(f"  - {name}: {config['description']}")
        sys.exit(0)

    if args.install:
        for server in args.install:
            if server in DEFAULT_MCP_SERVERS:
                config = DEFAULT_MCP_SERVERS[server]
                print(f"Installing {server}...")
                if install_mcp_package(config['package']):
                    add_mcp_to_claude(server, config)
        sys.exit(0)

    # 대화형 설정
    success = interactive_setup()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
