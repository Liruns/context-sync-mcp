#!/usr/bin/env python3
"""
PostToolUse Hook: Bash 명령어 로깅

- 실행된 명령어 기록
- 타임스탬프 포함
- 일일 로그 파일 생성
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

# 로그 디렉토리
LOG_DIR = Path.home() / '.claude' / 'logs'

# 로깅 제외 명령어 패턴 (보안상 민감한 명령)
EXCLUDE_PATTERNS = [
    'password',
    'secret',
    'token',
    'api_key',
    'apikey',
]


def should_log(command: str) -> bool:
    """로깅 여부 결정"""
    cmd_lower = command.lower()
    for pattern in EXCLUDE_PATTERNS:
        if pattern in cmd_lower:
            return False
    return True


def log_command(command: str, exit_code: int = None):
    """명령어를 로그 파일에 기록"""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)

        # 일일 로그 파일
        today = datetime.now().strftime('%Y-%m-%d')
        log_file = LOG_DIR / f'commands-{today}.log'

        # 타임스탬프
        timestamp = datetime.now().strftime('%H:%M:%S')

        # 로그 항목 작성
        log_entry = f"[{timestamp}] {command}"
        if exit_code is not None:
            log_entry += f" (exit: {exit_code})"
        log_entry += "\n"

        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)

    except Exception as e:
        # 로깅 실패는 무시
        pass


def main():
    try:
        # stdin에서 도구 입력 읽기
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        tool_output = input_data.get('tool_output', {})

        # Bash 도구만 처리
        if tool_name != 'Bash':
            sys.exit(0)

        command = tool_input.get('command', '')

        if command and should_log(command):
            exit_code = tool_output.get('exit_code')
            log_command(command, exit_code)

        sys.exit(0)

    except Exception as e:
        # 오류 발생 시에도 계속 진행
        sys.exit(0)


if __name__ == '__main__':
    main()
