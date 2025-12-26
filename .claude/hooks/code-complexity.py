#!/usr/bin/env python3
"""
PostToolUse Hook: 코드 복잡도 검사

- 순환 복잡도 (Cyclomatic Complexity)
- 함수/메서드 길이
- 파라미터 수
- 과도하게 복잡한 코드에 대해 경고
"""

import json
import sys
import re
from pathlib import Path

# 복잡도 임계값
THRESHOLDS = {
    'cyclomatic_complexity': 10,  # 순환 복잡도
    'function_length': 50,  # 함수 길이 (줄)
    'parameter_count': 5,  # 파라미터 수
    'nesting_depth': 4,  # 중첩 깊이
}

# 지원 언어
SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py']


def count_cyclomatic_complexity(code: str, language: str) -> list:
    """순환 복잡도 계산 (간단한 휴리스틱)"""
    issues = []

    # 함수/메서드 추출
    if language in ['js', 'ts']:
        # JavaScript/TypeScript 함수 패턴
        func_pattern = r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*{)'
    else:
        # Python 함수 패턴
        func_pattern = r'def\s+(\w+)\s*\('

    functions = re.finditer(func_pattern, code)

    for match in functions:
        func_name = match.group(1) or match.group(2) or match.group(3) or 'anonymous'
        start_pos = match.start()

        # 함수 범위 추정 (간단한 방법)
        func_code = extract_function_body(code[start_pos:], language)

        if not func_code:
            continue

        # 분기점 카운트
        complexity = 1  # 기본값

        # 분기 키워드
        branch_keywords = [
            r'\bif\b', r'\belse\s+if\b', r'\belif\b',
            r'\bfor\b', r'\bwhile\b',
            r'\bcase\b', r'\bcatch\b',
            r'\band\b', r'\bor\b', r'&&', r'\|\|',
            r'\?.*:',  # 삼항 연산자
        ]

        for keyword in branch_keywords:
            complexity += len(re.findall(keyword, func_code))

        if complexity > THRESHOLDS['cyclomatic_complexity']:
            issues.append({
                'type': 'complexity',
                'name': func_name,
                'value': complexity,
                'threshold': THRESHOLDS['cyclomatic_complexity'],
                'message': f"Function '{func_name}' has high complexity ({complexity})"
            })

        # 함수 길이 검사
        line_count = func_code.count('\n') + 1
        if line_count > THRESHOLDS['function_length']:
            issues.append({
                'type': 'length',
                'name': func_name,
                'value': line_count,
                'threshold': THRESHOLDS['function_length'],
                'message': f"Function '{func_name}' is too long ({line_count} lines)"
            })

    return issues


def extract_function_body(code: str, language: str) -> str:
    """함수 본문 추출 (간단한 방법)"""
    if language in ['js', 'ts']:
        # 중괄호 매칭
        brace_count = 0
        started = False
        end_pos = 0

        for i, char in enumerate(code):
            if char == '{':
                brace_count += 1
                started = True
            elif char == '}':
                brace_count -= 1
                if started and brace_count == 0:
                    end_pos = i + 1
                    break

        return code[:end_pos] if end_pos > 0 else code[:500]

    else:
        # Python: 들여쓰기 기반
        lines = code.split('\n')
        if not lines:
            return code

        # 첫 번째 줄의 들여쓰기
        first_line = lines[0]
        base_indent = len(first_line) - len(first_line.lstrip())

        func_lines = [lines[0]]
        for line in lines[1:]:
            if line.strip() and not line.startswith(' ' * (base_indent + 1)) and not line.startswith('\t' * ((base_indent // 4) + 1)):
                break
            func_lines.append(line)

        return '\n'.join(func_lines[:100])  # 최대 100줄


def check_parameter_count(code: str, language: str) -> list:
    """파라미터 수 검사"""
    issues = []

    if language in ['js', 'ts']:
        # JavaScript/TypeScript
        func_pattern = r'(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)|(\w+)\s*\(([^)]*)\))'
    else:
        # Python
        func_pattern = r'def\s+(\w+)\s*\(([^)]*)\)'

    for match in re.finditer(func_pattern, code):
        groups = [g for g in match.groups() if g]
        if len(groups) >= 2:
            func_name = groups[0]
            params = groups[1] if len(groups) > 1 else ''

            # 파라미터 카운트
            if params.strip():
                # 기본값과 타입 어노테이션 제거 후 카운트
                param_count = len([p.strip() for p in params.split(',') if p.strip()])

                if param_count > THRESHOLDS['parameter_count']:
                    issues.append({
                        'type': 'parameters',
                        'name': func_name,
                        'value': param_count,
                        'threshold': THRESHOLDS['parameter_count'],
                        'message': f"Function '{func_name}' has too many parameters ({param_count})"
                    })

    return issues


def check_nesting_depth(code: str, language: str) -> list:
    """중첩 깊이 검사"""
    issues = []
    max_depth = 0
    current_depth = 0
    max_depth_line = 0

    lines = code.split('\n')

    for i, line in enumerate(lines):
        if language in ['js', 'ts']:
            current_depth += line.count('{') - line.count('}')
        else:
            # Python: 들여쓰기 기반
            if line.strip():
                indent = len(line) - len(line.lstrip())
                current_depth = indent // 4

        if current_depth > max_depth:
            max_depth = current_depth
            max_depth_line = i + 1

    if max_depth > THRESHOLDS['nesting_depth']:
        issues.append({
            'type': 'nesting',
            'name': f'Line {max_depth_line}',
            'value': max_depth,
            'threshold': THRESHOLDS['nesting_depth'],
            'message': f"Deep nesting detected ({max_depth} levels at line {max_depth_line})"
        })

    return issues


def analyze_complexity(file_path: str, content: str) -> list:
    """전체 복잡도 분석"""
    ext = Path(file_path).suffix
    language = 'py' if ext == '.py' else 'js'

    issues = []

    # 순환 복잡도 및 함수 길이
    issues.extend(count_cyclomatic_complexity(content, language))

    # 파라미터 수
    issues.extend(check_parameter_count(content, language))

    # 중첩 깊이
    issues.extend(check_nesting_depth(content, language))

    return issues


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
        if ext not in SUPPORTED_EXTENSIONS:
            sys.exit(0)

        # 파일 내용 읽기
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            sys.exit(0)

        issues = analyze_complexity(file_path, content)

        if issues:
            print(f"📊 Complexity Analysis: {len(issues)} issues found")

            for issue in issues[:5]:
                icon = {
                    'complexity': '🔄',
                    'length': '📏',
                    'parameters': '📝',
                    'nesting': '🪆',
                }.get(issue['type'], '⚠️')

                print(f"  {icon} {issue['message']}")

            if len(issues) > 5:
                print(f"  ... and {len(issues) - 5} more")

            print("\nConsider refactoring for better maintainability.")

            # 경고만 (차단하지 않음)
            sys.exit(1)

        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
