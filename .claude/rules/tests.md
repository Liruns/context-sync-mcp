---
paths: tests/**, __tests__/**, *.test.ts, *.test.js, *.spec.ts, *.spec.js, test_*.py, *_test.py
---

# 테스트 작성 규칙

## 테스트 구조

### JavaScript/TypeScript (Jest)
```javascript
describe('ComponentName', () => {
  // 공통 설정
  beforeEach(() => {
    // setup
  });

  afterEach(() => {
    // cleanup
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = method(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should throw on invalid input', () => {
      expect(() => method(null)).toThrow();
    });
  });
});
```

### Python (pytest)
```python
class TestClassName:
    def setup_method(self):
        """각 테스트 전 실행"""
        pass

    def test_normal_case(self):
        # Arrange
        input_data = 'test'

        # Act
        result = function(input_data)

        # Assert
        assert result == 'expected'

    def test_raises_on_invalid(self):
        with pytest.raises(ValueError):
            function(None)
```

## 네이밍 규칙

```javascript
// Good
'should return empty array when no items'
'should throw error when input is null'
'should calculate discount for premium users'

// Bad
'test1'
'it works'
'getTotal test'
```

## 모킹

```javascript
// 함수 모킹
jest.mock('./api');

// 구현 변경
api.fetchUser.mockResolvedValue({ id: 1 });

// 호출 확인
expect(api.fetchUser).toHaveBeenCalledWith(1);
```

## 주의사항

- 테스트 간 독립성 유지
- 실제 외부 서비스 호출 금지
- 비결정적 테스트 (flaky) 금지
- 구현 세부사항 테스트 지양
