#!/usr/bin/env python3
"""
PostToolUse Hook: 코드 변경 시 관련 테스트 자동 실행

- 변경된 파일의 테스트 파일 탐지
- 테스트 실행 및 결과 보고
- 실패 시 경고
"""

import json
import sys
import subprocess
from pathlib import Path
import re

# 테스트 파일 패턴
TEST_PATTERNS = {
    '.ts': ['{name}.test.ts', '{name}.spec.ts', '__tests__/{name}.ts'],
    '.tsx': ['{name}.test.tsx', '{name}.spec.tsx', '__tests__/{name}.tsx'],
    '.js': ['{name}.test.js', '{name}.spec.js', '__tests__/{name}.js'],
    '.jsx': ['{name}.test.jsx', '{name}.spec.jsx', '__tests__/{name}.jsx'],
    '.py': ['test_{name}.py', '{name}_test.py', 'tests/test_{name}.py'],
}

# 테스트 실행기
TEST_RUNNERS = {
    'js': {
        'detect': ['package.json'],
        'jest': ['npx', 'jest', '--testPathPattern'],
        'vitest': ['npx', 'vitest', 'run'],
        'mocha': ['npx', 'mocha'],
    },
    'py': {
        'detect': ['pytest.ini', 'pyproject.toml', 'setup.py'],
        'pytest': ['python', '-m', 'pytest', '-v'],
        'unittest': ['python', '-m', 'unittest'],
    },
}


def find_test_file(source_path: str) -> str:
    """소스 파일에 대응하는 테스트 파일 찾기"""
    path = Path(source_path)
    ext = path.suffix
    name = path.stem

    # 이미 테스트 파일인 경우
    if any(pattern in name for pattern in ['test', 'spec', 'Test', 'Spec']):
        return source_path

    patterns = TEST_PATTERNS.get(ext, [])

    for pattern in patterns:
        test_name = pattern.format(name=name)

        # 같은 디렉토리에서 찾기
        test_path = path.parent / test_name
        if test_path.exists():
            return str(test_path)

        # __tests__ 디렉토리에서 찾기
        tests_dir = path.parent / '__tests__'
        if tests_dir.exists():
            for test_file in tests_dir.glob(f'*{name}*'):
                return str(test_file)

        # tests 디렉토리에서 찾기 (Python)
        tests_dir = path.parent / 'tests'
        if tests_dir.exists():
            for test_file in tests_dir.glob(f'*{name}*'):
                return str(test_file)

    return None


def detect_test_runner(project_dir: str) -> tuple:
    """프로젝트의 테스트 러너 감지"""
    project_path = Path(project_dir)

    # package.json 확인 (JS/TS)
    package_json = project_path / 'package.json'
    if package_json.exists():
        try:
            with open(package_json) as f:
                pkg = json.load(f)
                scripts = pkg.get('scripts', {})
                deps = {**pkg.get('devDependencies', {}), **pkg.get('dependencies', {})}

                if 'vitest' in deps or 'vitest' in scripts.get('test', ''):
                    return ('vitest', ['npx', 'vitest', 'run'])
                if 'jest' in deps or 'jest' in scripts.get('test', ''):
                    return ('jest', ['npx', 'jest'])
        except:
            pass

    # Python 프로젝트 확인
    if (project_path / 'pytest.ini').exists() or (project_path / 'pyproject.toml').exists():
        return ('pytest', ['python', '-m', 'pytest', '-v', '--tb=short'])

    return (None, None)


def run_test(test_path: str, runner: tuple) -> dict:
    """테스트 실행"""
    runner_name, runner_cmd = runner

    if not runner_cmd:
        return {'success': False, 'reason': 'No test runner found'}

    try:
        cmd = runner_cmd + [test_path]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=Path(test_path).parent.parent  # 프로젝트 루트 추정
        )

        # 결과 요약 추출
        output = result.stdout + result.stderr
        summary = extract_test_summary(runner_name, output)

        return {
            'success': result.returncode == 0,
            'summary': summary,
            'output': output[-500:] if len(output) > 500 else output  # 마지막 500자
        }

    except subprocess.TimeoutExpired:
        return {'success': False, 'reason': 'Test timeout (60s)'}
    except Exception as e:
        return {'success': False, 'reason': str(e)}


def extract_test_summary(runner: str, output: str) -> str:
    """테스트 출력에서 요약 추출"""
    if runner in ['jest', 'vitest']:
        # Jest/Vitest 요약 패턴
        match = re.search(r'Tests:.*?(\d+\s+passed.*?\d+\s+total)', output, re.IGNORECASE)
        if match:
            return match.group(1)

    elif runner == 'pytest':
        # Pytest 요약 패턴
        match = re.search(r'=+ (.*? passed.*?) =+', output)
        if match:
            return match.group(1)

    return 'See output for details'


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
        if ext not in TEST_PATTERNS:
            sys.exit(0)

        # 테스트 파일 찾기
        test_path = find_test_file(file_path)

        if not test_path:
            # 테스트 파일이 없으면 조용히 종료
            sys.exit(0)

        # 테스트 러너 감지
        project_dir = Path(file_path).parent
        while project_dir != project_dir.parent:
            if (project_dir / 'package.json').exists() or (project_dir / 'pyproject.toml').exists():
                break
            project_dir = project_dir.parent

        runner = detect_test_runner(str(project_dir))

        if not runner[0]:
            sys.exit(0)

        print(f"🧪 Running tests: {Path(test_path).name}")

        result = run_test(test_path, runner)

        if result.get('success'):
            print(f"✅ Tests passed: {result.get('summary', '')}")
            sys.exit(0)
        else:
            reason = result.get('reason', result.get('summary', 'Unknown error'))
            print(f"❌ Tests failed: {reason}")

            # 실패 출력 일부 표시
            if 'output' in result:
                lines = result['output'].strip().split('\n')
                for line in lines[-10:]:  # 마지막 10줄
                    print(f"   {line}")

            sys.exit(1)  # 경고 (차단하지 않음)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
