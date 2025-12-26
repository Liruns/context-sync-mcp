#!/usr/bin/env python3
"""
PreToolUse Hook: Write 도구 실행 전 보안 스캔

- 민감 정보 노출 검사
- 위험한 코드 패턴 검사
- 보안 규칙 위반 검사
"""

import json
import sys
import re

# 민감 정보 패턴
SENSITIVE_PATTERNS = [
    # API 키 및 토큰
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'(?i)api[_-]?key["\']?\s*[:=]\s*["\'][a-zA-Z0-9_-]{20,}["\']', 'API Key'),
    (r'(?i)auth[_-]?token["\']?\s*[:=]\s*["\'][a-zA-Z0-9_-]{20,}["\']', 'Auth Token'),
    (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
    (r'gho_[a-zA-Z0-9]{36}', 'GitHub OAuth Token'),
    (r'sk-[a-zA-Z0-9]{48}', 'OpenAI API Key'),

    # 프라이빗 키
    (r'-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----', 'Private Key'),
    (r'-----BEGIN PGP PRIVATE KEY BLOCK-----', 'PGP Private Key'),

    # 비밀번호
    (r'(?i)password["\']?\s*[:=]\s*["\'][^"\']{8,}["\']', 'Hardcoded Password'),
    (r'(?i)passwd["\']?\s*[:=]\s*["\'][^"\']{8,}["\']', 'Hardcoded Password'),

    # 데이터베이스 연결 문자열
    (r'(?i)mongodb(\+srv)?://[^"\'\s]+', 'MongoDB Connection String'),
    (r'(?i)postgres(ql)?://[^"\'\s]+', 'PostgreSQL Connection String'),
    (r'(?i)mysql://[^"\'\s]+', 'MySQL Connection String'),
]

# 위험한 코드 패턴
DANGEROUS_PATTERNS = [
    (r'\beval\s*\([^)]*\$', 'Dangerous eval with variable'),
    (r'\bexec\s*\([^)]*\$', 'Dangerous exec with variable'),
    (r'child_process\.exec\s*\([^)]*\+', 'Command Injection Risk'),
    (r'innerHTML\s*=\s*[^"\']+\+', 'XSS Risk (innerHTML)'),
    (r'document\.write\s*\([^)]*\+', 'XSS Risk (document.write)'),
]


def scan_content(content: str) -> dict:
    """내용 스캔 및 문제 탐지"""
    issues = {
        'critical': [],  # 즉시 차단
        'warning': [],   # 경고
    }

    # 민감 정보 검사
    for pattern, description in SENSITIVE_PATTERNS:
        if re.search(pattern, content):
            issues['critical'].append(f"🔴 {description} detected")

    # 위험한 코드 패턴 검사
    for pattern, description in DANGEROUS_PATTERNS:
        if re.search(pattern, content):
            issues['warning'].append(f"🟡 {description}")

    return issues


def main():
    try:
        # stdin에서 도구 입력 읽기
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Write 도구만 처리 (새 파일 생성 시)
        if tool_name != 'Write':
            sys.exit(0)

        content = tool_input.get('content', '')
        file_path = tool_input.get('file_path', '')

        if not content:
            sys.exit(0)

        # 보안 스캔
        issues = scan_content(content)

        # Critical 이슈가 있으면 차단
        if issues['critical']:
            print("🚨 Security Scan Failed")
            print(f"File: {file_path}")
            print("Issues:")
            for issue in issues['critical']:
                print(f"  {issue}")
            print("\n환경 변수를 사용하거나 시크릿 관리 시스템을 활용하세요.")
            sys.exit(2)  # 차단

        # Warning 이슈가 있으면 경고
        if issues['warning']:
            print("⚠️ Security Warning")
            print(f"File: {file_path}")
            for issue in issues['warning']:
                print(f"  {issue}")
            sys.exit(1)  # 경고 (계속 진행)

        sys.exit(0)

    except Exception as e:
        # 오류 발생 시에도 계속 진행
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
