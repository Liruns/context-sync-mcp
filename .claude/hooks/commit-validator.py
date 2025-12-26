#!/usr/bin/env python3
"""
Notification Hook: 커밋 메시지 검증

- Conventional Commits 형식 검사
- 메시지 길이 검사
- 이슈 번호 참조 확인
"""

import json
import sys
import re

# Conventional Commits 타입
VALID_TYPES = [
    'feat',      # 새로운 기능
    'fix',       # 버그 수정
    'docs',      # 문서 변경
    'style',     # 포맷팅, 세미콜론 등
    'refactor',  # 리팩토링
    'perf',      # 성능 개선
    'test',      # 테스트 추가/수정
    'build',     # 빌드 시스템/외부 의존성
    'ci',        # CI 설정
    'chore',     # 기타 변경
    'revert',    # 되돌리기
]

# 커밋 메시지 패턴
CONVENTIONAL_PATTERN = r'^(?P<type>' + '|'.join(VALID_TYPES) + r')(?:\((?P<scope>[a-z0-9-]+)\))?(?P<breaking>!)?: (?P<description>.+)$'

# 설정
CONFIG = {
    'max_subject_length': 72,
    'min_subject_length': 10,
    'require_issue_reference': False,  # #123 형식 참조 필수 여부
    'allow_merge_commits': True,
    'allow_revert_commits': True,
}


def validate_commit_message(message: str) -> dict:
    """커밋 메시지 검증"""
    issues = []
    warnings = []

    lines = message.strip().split('\n')

    if not lines:
        return {'valid': False, 'issues': ['Empty commit message']}

    subject = lines[0].strip()

    # Merge 커밋 허용
    if CONFIG['allow_merge_commits'] and subject.startswith('Merge '):
        return {'valid': True, 'issues': [], 'warnings': []}

    # Revert 커밋 허용
    if CONFIG['allow_revert_commits'] and subject.startswith('Revert '):
        return {'valid': True, 'issues': [], 'warnings': []}

    # Conventional Commits 형식 검사
    match = re.match(CONVENTIONAL_PATTERN, subject, re.IGNORECASE)

    if not match:
        issues.append(f"Subject doesn't follow Conventional Commits format")
        issues.append(f"Expected: <type>[optional scope]: <description>")
        issues.append(f"Types: {', '.join(VALID_TYPES)}")
    else:
        commit_type = match.group('type').lower()
        scope = match.group('scope')
        breaking = match.group('breaking')
        description = match.group('description')

        # 타입 검증
        if commit_type not in VALID_TYPES:
            issues.append(f"Invalid type: '{commit_type}'. Valid types: {', '.join(VALID_TYPES)}")

        # 설명 첫 글자 소문자 권장
        if description and description[0].isupper():
            warnings.append("Description should start with lowercase")

        # 설명 끝에 마침표 없어야 함
        if description and description.endswith('.'):
            warnings.append("Description should not end with a period")

        # Breaking change 표시
        if breaking:
            if len(lines) < 3 or 'BREAKING CHANGE:' not in message:
                warnings.append("Breaking changes should be documented in the body")

    # 제목 길이 검사
    if len(subject) > CONFIG['max_subject_length']:
        issues.append(f"Subject too long ({len(subject)} chars, max {CONFIG['max_subject_length']})")

    if len(subject) < CONFIG['min_subject_length']:
        warnings.append(f"Subject too short ({len(subject)} chars, min {CONFIG['min_subject_length']})")

    # 이슈 참조 검사
    if CONFIG['require_issue_reference']:
        if not re.search(r'#\d+', message):
            warnings.append("No issue reference found (e.g., #123)")

    # 본문과 제목 사이 빈 줄
    if len(lines) > 1 and lines[1].strip():
        warnings.append("Add a blank line between subject and body")

    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings,
    }


def format_example():
    """올바른 커밋 메시지 예시"""
    return """
Examples of valid commit messages:
  feat: add user authentication
  fix(api): resolve null pointer exception
  docs: update installation guide
  refactor!: change API response format

  feat(auth): add OAuth2 support

  Implement OAuth2 authentication with Google and GitHub providers.

  BREAKING CHANGE: The login endpoint now returns a different response format.

  Closes #123
"""


def main():
    try:
        input_data = json.load(sys.stdin)

        # 커밋 알림인지 확인
        notification_type = input_data.get('notification_type', '')

        if notification_type != 'commit':
            sys.exit(0)

        # 커밋 메시지 추출
        commit_message = input_data.get('message', '')

        if not commit_message:
            sys.exit(0)

        result = validate_commit_message(commit_message)

        if not result['valid']:
            print("❌ Commit Message Validation Failed")
            print()
            for issue in result['issues']:
                print(f"  🔴 {issue}")

            if result['warnings']:
                print()
                for warning in result['warnings']:
                    print(f"  🟡 {warning}")

            print(format_example())

            # 차단하지는 않고 경고만
            sys.exit(1)

        if result['warnings']:
            print("⚠️ Commit Message Warnings")
            for warning in result['warnings']:
                print(f"  🟡 {warning}")
            sys.exit(1)

        print("✅ Commit message is valid")
        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
