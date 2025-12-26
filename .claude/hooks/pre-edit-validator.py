#!/usr/bin/env python3
"""
PreToolUse Hook: Edit/Write 도구 실행 전 파일 검증

- 보호된 파일 수정 방지
- 파일 형식 검증
- 민감 정보 패턴 검사
"""

import json
import sys
import re
from pathlib import Path

# 수정 금지 파일 패턴
PROTECTED_PATTERNS = [
    r'\.env$',
    r'\.env\.',
    r'package-lock\.json$',
    r'yarn\.lock$',
    r'pnpm-lock\.yaml$',
    r'\.git/',
    r'node_modules/',
    r'__pycache__/',
]

# 민감 정보 패턴 (새로 작성되는 내용에서 검사)
SENSITIVE_PATTERNS = [
    (r'password\s*[=:]\s*["\'][^"\']+["\']', '하드코딩된 비밀번호'),
    (r'api[_-]?key\s*[=:]\s*["\'][a-zA-Z0-9]{20,}["\']', '하드코딩된 API 키'),
    (r'secret\s*[=:]\s*["\'][^"\']+["\']', '하드코딩된 시크릿'),
    (r'-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----', '프라이빗 키'),
]


def is_protected_file(file_path: str) -> bool:
    """보호된 파일인지 확인"""
    for pattern in PROTECTED_PATTERNS:
        if re.search(pattern, file_path, re.IGNORECASE):
            return True
    return False


def check_sensitive_content(content: str) -> list:
    """민감 정보 패턴 검사"""
    issues = []
    for pattern, description in SENSITIVE_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            issues.append(description)
    return issues


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

        # 보호된 파일 검사
        if is_protected_file(file_path):
            print(f"⚠️ 보호된 파일입니다: {file_path}")
            print("이 파일은 수정할 수 없습니다.")
            sys.exit(2)  # 2 = 차단

        # 새 내용에서 민감 정보 검사
        new_content = tool_input.get('new_string', '') or tool_input.get('content', '')
        if new_content:
            issues = check_sensitive_content(new_content)
            if issues:
                print(f"⚠️ 민감 정보 감지: {', '.join(issues)}")
                print("환경 변수를 사용하세요.")
                sys.exit(1)  # 1 = 경고 (계속 진행)

        # 검증 통과
        sys.exit(0)

    except Exception as e:
        # 오류 발생 시에도 계속 진행
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
