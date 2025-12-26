#!/usr/bin/env python3
"""
PostToolUse Hook: Edit/Write 도구 실행 후 자동 포맷팅

- Prettier (JS/TS/JSON/CSS/MD)
- Black (Python)
- 파일 확장자에 따라 적절한 포맷터 실행
"""

import json
import sys
import subprocess
import shutil
from pathlib import Path

# 확장자별 포맷터 설정
FORMATTERS = {
    # Prettier 대상
    '.js': ['npx', 'prettier', '--write'],
    '.jsx': ['npx', 'prettier', '--write'],
    '.ts': ['npx', 'prettier', '--write'],
    '.tsx': ['npx', 'prettier', '--write'],
    '.json': ['npx', 'prettier', '--write'],
    '.css': ['npx', 'prettier', '--write'],
    '.scss': ['npx', 'prettier', '--write'],
    '.md': ['npx', 'prettier', '--write'],
    '.yaml': ['npx', 'prettier', '--write'],
    '.yml': ['npx', 'prettier', '--write'],

    # Python
    '.py': ['python', '-m', 'black', '-q'],
}


def get_formatter(file_path: str) -> list:
    """파일 확장자에 맞는 포맷터 반환"""
    ext = Path(file_path).suffix.lower()
    return FORMATTERS.get(ext)


def run_formatter(formatter_cmd: list, file_path: str) -> bool:
    """포맷터 실행"""
    try:
        # 포맷터 존재 확인
        tool = formatter_cmd[0]
        if tool == 'npx':
            # npx는 항상 사용 가능하다고 가정
            pass
        elif not shutil.which(tool):
            return False

        cmd = formatter_cmd + [file_path]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            print(f"✓ Formatted: {Path(file_path).name}")
            return True
        else:
            # 포맷터 실패는 무시 (파일은 이미 수정됨)
            return False

    except subprocess.TimeoutExpired:
        print(f"⚠️ Formatter timeout: {file_path}")
        return False
    except Exception as e:
        return False


def main():
    try:
        # stdin에서 도구 입력 읽기
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Edit/Write 도구만 처리
        if tool_name not in ['Edit', 'Write']:
            sys.exit(0)

        file_path = tool_input.get('file_path', '')

        if not file_path or not Path(file_path).exists():
            sys.exit(0)

        # 포맷터 찾기 및 실행
        formatter = get_formatter(file_path)
        if formatter:
            run_formatter(formatter, file_path)

        sys.exit(0)

    except Exception as e:
        # 오류 발생 시에도 계속 진행
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
