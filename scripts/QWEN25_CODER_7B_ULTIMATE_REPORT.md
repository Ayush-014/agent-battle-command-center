# qwen2.5-coder:7b Ultimate Stress Test Report (40 Tasks, C1-C9)

**Date:** 2026-02-05
**Model:** qwen2.5-coder:7b (4.7 GB, Q4_K_M quantization)
**Hardware:** RTX 3060 Ti 8GB VRAM (~6GB used)
**Test Suite:** 40 tasks, complexity 1-9
**Agent Config:** CodeX-7 backstory, temp=0, 3s rest, reset every 3 tasks
**Test Script:** `scripts/ollama-stress-test-40.js`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Success Rate** | **88% (35/40)** |
| **Total Duration** | 36m 14s |
| **Avg Task Time** | 54.4s |
| **Median Task Time** | 23s |
| **Code Quality (passing)** | **8.7/10** |
| **Cost** | $0.00 (local GPU) |
| **C9 Extreme Pass Rate** | **80% (4/5)** |

---

## Results by Complexity

| Complexity | Level | Pass Rate | Tasks | Avg Time (pass) |
|------------|-------|-----------|-------|-----------------|
| C1 | Trivial | **100%** | 3/3 | 30s |
| C2 | Trivial | **100%** | 3/3 | 84s |
| C3 | Low | **100%** | 4/4 | 111s |
| C4 | Low | **80%** | 4/5 | 19s |
| C5 | Moderate | **60%** | 3/5 | 94s |
| C6 | Moderate | **100%** | 5/5 | 55s |
| C7 | Complex | **100%** | 5/5 | 25s |
| C8 | Complex | **80%** | 4/5 | 18s |
| C9 | **Extreme** | **80%** | 4/5 | 34s |

---

## Code Review: All 40 Tasks

### C1: Trivial Tasks (3/3 = 100%)

#### c1_double.py (9/10)
```python
def double(n):
    return n * 2
```
Perfect. Minimal.

#### c1_negate.py (9/10)
```python
def negate(n):
    return -n
```
Perfect.

#### c1_square.py (9/10)
```python
def square(n):
    return n * n
```
Perfect.

---

### C2: Trivial Tasks (3/3 = 100%)

#### c2_greet.py (9/10)
```python
def greet(name):
    return f'Hello, {name}!'
```
Clean f-string.

#### c2_is_even.py (9/10)
```python
def is_even(n):
    return n % 2 == 0
```
Direct boolean expression.

#### c2_to_upper.py (9/10)
```python
def to_upper(s):
    return s.upper()
```
Correct. Took 211s though - unusually slow for a trivial task (likely multiple iterations).

---

### C3: Low Complexity (4/4 = 100%)

#### c3_absolute.py (9/10)
```python
def absolute(n):
    if n < 0:
        return -n
    else:
        return n
```
Correct, explicit else.

#### c3_max_of_two.py (9/10)
```python
def max_of_two(a, b):
    if a > b:
        return a
    else:
        return b
```
Clean.

#### c3_min_of_three.py (8/10)
```python
def min_of_three(a, b, c):
    if a <= b and a <= c:
        return a
    elif b <= a and b <= c:
        return b
    else:
        return c
```
Works correctly. Uses comparison approach instead of tracking variable. Slightly verbose but unambiguous.

#### c3_leap_year.py (10/10)
```python
def is_leap_year(year):
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
```
**Better than reference.** Elegant one-liner boolean expression vs the reference's multi-branch if/elif. Correctly handles all cases.

---

### C4: Low Complexity (4/5 = 80%)

#### c4_clamp.py (10/10)
```python
def clamp(value, min_val, max_val):
    return max(min(value, max_val), min_val)
```
**Better than reference.** One-liner using nested min/max builtins vs multi-branch if/elif.

#### c4_count_vowels.py (10/10)
```python
def count_vowels(s):
    vowels = 'aeiouAEIOU'
    return sum(1 for char in s if char in vowels)
```
Pythonic generator expression.

#### c4_reverse_string.py (FAIL - 2/10)
```python
def reverse_string(s):
    reversed_str = ''
    for char in s:
        reversed_str = char + reversed_str
    return reversed_str

# Test the function
test_string = 'hello'
print(f'The reversed string of '{test_string}' is: {reverse_string(test_string)}')
```
**Failure: Added junk test code** after the function with a malformed f-string (nested quotes). The function itself is correct but the extra print statement causes a SyntaxError on import. Classic model over-generation.

#### c4_factorial.py (10/10)
```python
def factorial(n):
    if n < 0:
        raise ValueError('Factorial is not defined for negative numbers')
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result
```
**Better than reference.** Added input validation for negative numbers and optimized loop start from 2 instead of 1.

#### c4_title_case.py (9/10)
```python
def title_case(s):
    return ' '.join(word.capitalize() for word in s.split())
```
Clean, Pythonic.

---

### C5: Moderate Complexity (3/5 = 60%)

#### c5_fizzbuzz.py (9/10)
```python
def fizzbuzz(n):
    if n % 3 == 0 and n % 5 == 0:
        return 'FizzBuzz'
    elif n % 3 == 0:
        return 'Fizz'
    elif n % 5 == 0:
        return 'Buzz'
    else:
        return str(n)
```
Correct. Used explicit `and` instead of `% 15`.

#### c5_palindrome.py (10/10)
```python
def is_palindrome(s):
    cleaned = ''.join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]
```
**Better than reference.** Strips ALL non-alphanumeric characters (not just spaces), making it more robust. The reference only did `.lower().replace(' ', '')`.

#### c5_safe_divide.py (9/10)
```python
def safe_divide(a, b):
    if b == 0:
        return None
    else:
        return a / b
```
Correct.

#### c5_flatten.py (FAIL - 3/10)
```python
def flatten(nested):
    return [item for sublist in nested for item in sublist]
```
**Failure: Doesn't handle mixed lists.** Assumes every element is iterable. `flatten([1, [2, 3]])` fails because `int` is not iterable. The task explicitly said "one level deep" which means non-list items should pass through. The model chose the simpler list comprehension pattern without the isinstance check.

#### c5_truncate.py (FAIL - 4/10)
```python
def truncate(s, max_len):
    if len(s) <= max_len:
        return s
    else:
        return s[:max_len] + '...'
```
**Failure: Off-by-one error.** Returns `s[:max_len] + '...'` which gives a string of length `max_len + 3`, not `max_len`. The reference does `s[:max_len - 3] + '...'` so the total is exactly `max_len`. The model understood the concept but didn't account for the ellipsis length.

---

### C6: Moderate Complexity (5/5 = 100%)

#### c6_sum_digits.py (10/10)
```python
def sum_of_digits(n):
    return sum(int(digit) for digit in str(abs(n)))
```
Elegant one-liner. Better than reference.

#### c6_second_largest.py (9/10)
```python
def find_second_largest(numbers):
    unique_numbers = set(numbers)
    if len(unique_numbers) < 2:
        return None
    sorted_numbers = sorted(unique_numbers, reverse=True)
    return sorted_numbers[1]
```
Clean, correct.

#### c6_is_prime.py (8/10)
```python
def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True
```
Correct with sqrt optimization. Missing even-number shortcut (same as 10-task run).

#### c6_caesar.py (10/10)
```python
def caesar_encrypt(text, shift):
    result = ''
    for char in text:
        if char.isalpha():
            ascii_offset = 65 if char.isupper() else 97
            shifted_char = chr((ord(char) - ascii_offset + shift) % 26 + ascii_offset)
            result += shifted_char
        else:
            result += char
    return result
```
Textbook caesar cipher. Clean variable names. Handles upper/lower correctly.

#### c6_unique_sorted.py (9/10)
```python
def unique_sorted(lst):
    return sorted(set(lst))
```
One-liner, correct. Took 170s though.

---

### C7: Complex (5/5 = 100%) 🏆

#### c7_fibonacci.py (9/10)
```python
def fibonacci(n):
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    fib_sequence = [0, 1]
    for i in range(2, n):
        next_value = fib_sequence[-1] + fib_sequence[-2]
        fib_sequence.append(next_value)
    return fib_sequence
```
Clean iterative. Good edge cases.

#### c7_word_freq.py (9/10)
```python
def word_frequency(text):
    words = text.lower().split()
    freq = {}
    for word in words:
        if word in freq:
            freq[word] += 1
        else:
            freq[word] = 1
    return freq
```
Correct manual counting.

#### c7_transpose.py (10/10)
```python
def transpose(matrix):
    return [list(row) for row in zip(*matrix)]
```
**Excellent.** Pythonic one-liner using `zip(*matrix)`. Much more elegant than the reference's nested loop approach.

#### c7_group_by.py (9/10)
```python
def group_by(items, key_func):
    result = {}
    for item in items:
        key = key_func(item)
        if key not in result:
            result[key] = []
        result[key].append(item)
    return result
```
Correct. Higher-order function handling.

#### c7_roman.py (10/10)
```python
def roman_to_int(s):
    value = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    total = 0
    prev_value = 0
    for char in s[::-1]:
        if value[char] >= prev_value:
            total += value[char]
        else:
            total -= value[char]
        prev_value = value[char]
    return total
```
**Excellent.** Used reverse iteration approach (right-to-left) which is arguably cleaner than the reference's forward-looking approach. Handles subtractive notation correctly.

---

### C8: Complex (4/5 = 80%)

#### c8_merge_sorted.py (10/10)
```python
def merge_sorted(list1, list2):
    merged_list = []
    i, j = 0, 0
    while i < len(list1) and j < len(list2):
        if list1[i] <= list2[j]:
            merged_list.append(list1[i])
            i += 1
        else:
            merged_list.append(list2[j])
            j += 1
    while i < len(list1):
        merged_list.append(list1[i])
        i += 1
    while j < len(list2):
        merged_list.append(list2[j])
        j += 1
    return merged_list
```
**Proper O(n) two-pointer merge!** Unlike the 10-task run where it cheated with `sorted()`, the 40-task run produced the real algorithm. Used explicit while loops for remainder instead of `.extend()` - equally valid.

#### c8_binary_search.py (10/10)
```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```
Textbook binary search.

#### c8_rle.py (FAIL - 5/10)
```python
def rle_encode(s):
    if not s:
        return ''
    count = 1
    prev_char = s[0]
    result = []
    for char in s[1:]:
        if char == prev_char:
            count += 1
        else:
            result.append(f'{prev_char}{count}')
            prev_char = char
            count = 1
    result.append(f'{prev_char}{count})  # <-- missing closing quote!
    return ''.join(result)
```
**Failure: Unterminated string literal.** The algorithm is 100% correct but the final f-string is missing its closing quote: `f'{prev_char}{count})` instead of `f'{prev_char}{count}')`. A single character caused the failure. This is a generation/formatting error, not a logic error.

#### c8_power_set.py (10/10)
```python
def power_set(s):
    if not s:
        return [[]]
    first, *rest = s
    subsets_without_first = power_set(rest)
    subsets_with_first = [[first] + subset for subset in subsets_without_first]
    return subsets_without_first + subsets_with_first
```
**Excellent.** Elegant recursive approach using Python unpacking (`first, *rest = s`). The reference used an iterative approach. Both are valid; this is arguably more readable.

#### c8_parens.py (10/10)
```python
def is_balanced(s):
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    for char in s:
        if char in mapping.values():
            stack.append(char)
        elif char in mapping.keys():
            if not stack or stack.pop() != mapping[char]:
                return False
    return len(stack) == 0
```
Classic stack-based solution. Clean mapping dict.

---

### C9: Extreme (4/5 = 80%) 🔴

#### c9_stack.py (10/10)
```python
class Stack:
    def __init__(self):
        self.items = []
    def push(self, item):
        self.items.append(item)
    def pop(self):
        if not self.is_empty():
            return self.items.pop()
        return None
    def peek(self):
        if not self.is_empty():
            return self.items[-1]
        return None
    def size(self):
        return len(self.items)
    def is_empty(self):
        return len(self.items) == 0
```
**Perfect class implementation.** All 5 methods correct. Uses `is_empty()` internally for DRY. Clean, well-structured.

#### c9_lru.py (10/10)
```python
class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}
        self.order = []
    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        else:
            self.order.remove(key)
            self.order.append(key)
            return self.cache[key]
    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache[key] = value
            self.order.remove(key)
            self.order.append(key)
        else:
            if len(self.cache) >= self.capacity:
                oldest_key = self.order.pop(0)
                del self.cache[oldest_key]
            self.cache[key] = value
            self.order.append(key)
```
**Impressive.** Complete LRU Cache with eviction. Added type hints unprompted. Handles both update-existing and insert-new cases correctly. Even updates the order on `put()` when key already exists. This is a LeetCode medium problem solved correctly by a 7B model.

#### c9_rpn.py (9/10)
```python
def rpn_calc(expression):
    stack = []
    tokens = expression.split()
    for token in tokens:
        if token.isdigit():
            stack.append(float(token))
        else:
            b = stack.pop()
            a = stack.pop()
            if token == '+': stack.append(a + b)
            elif token == '-': stack.append(a - b)
            elif token == '*': stack.append(a * b)
            elif token == '/': stack.append(a / b)
    return stack.pop()
```
Correct RPN calculator using stack. Minor note: `isdigit()` won't handle negative numbers or decimals in tokens, but sufficient for the test cases.

#### c9_text_stats.py (10/10)
```python
class TextStats:
    def __init__(self, text):
        self.text = text
        self.words = text.split()
        self.chars = ''.join(self.words)
    def word_count(self):
        return len(self.words)
    def char_count(self):
        return len(self.chars)
    def most_common_word(self):
        from collections import Counter
        words = [word.lower() for word in self.words]
        if not words:
            return None
        return Counter(words).most_common(1)[0][0]
```
**Excellent.** Pre-computes words and chars in constructor. Uses `Counter` from collections for most_common (more Pythonic than manual counting). Added empty list guard.

#### c9_linked_list.py (FAIL - 1/10)
```python
class Node:
    def __init__(self
```
**Failure: Truncated output.** Only 3 lines written. The model started the class but generation was cut off or the tool call was malformed. This is the most complex C9 task (2 classes, insert_sorted with pointer manipulation) and the model failed to produce complete output.

---

## Failure Analysis Summary

| # | Task | C | Failure Type | Root Cause |
|---|------|---|--------------|------------|
| 1 | reverse_string | 4 | Junk code appended | Model added test print with bad f-string |
| 2 | flatten_list | 5 | Logic error | Assumed all items are iterable |
| 3 | truncate | 5 | Off-by-one | Didn't subtract ellipsis length from max_len |
| 4 | run_length_encode | 8 | Syntax error | Missing closing quote in f-string |
| 5 | sorted_linked_list | 9 | Truncated output | Generation cut off after 3 lines |

**Pattern:** 3/5 failures are syntax/format errors (not logic). Only 2/5 are actual logic bugs. The model *understands* the algorithms but occasionally garbles the output.

---

## Notable Code Quality Highlights

### Solutions Better Than Reference (7 tasks)
1. **c3_leap_year** - One-liner boolean vs multi-branch if/elif
2. **c4_clamp** - `max(min(value, max_val), min_val)` one-liner
3. **c4_factorial** - Added negative number validation
4. **c5_palindrome** - Strips all non-alphanumeric (more robust)
5. **c7_transpose** - `zip(*matrix)` one-liner vs nested loops
6. **c7_roman** - Reverse iteration approach (cleaner)
7. **c8_power_set** - Recursive with Python unpacking

### Algorithmic Wins
- **c8_merge_sorted** - Proper O(n) two-pointer merge (fixed from 10-task run where it cheated)
- **c9_lru_cache** - LeetCode medium solved correctly with eviction logic
- **c8_parens** - Stack-based bracket matching, handles 3 bracket types
- **c9_rpn** - Stack-based RPN calculator

---

## Timing Analysis

```
Duration Distribution (35 passing tasks):
  < 15s:   8 tasks  (23%)  - instant tool calls
  15-30s: 15 tasks  (43%)  - single iteration
  30-80s:  4 tasks  (11%)  - 2-3 iterations
  80-200s: 7 tasks  (20%)  - multiple iterations / slow generation
  > 200s:  1 task   (3%)   - C2 to_upper at 211s (outlier)

Interesting: C7-C9 are FASTER than C2-C5 on average!
  C7 avg: 25s | C8 avg: 18s | C9 avg: 34s
  C2 avg: 84s | C3 avg: 111s | C5 avg: 94s

Hypothesis: Complex tasks have more explicit instructions and
code in the prompt, giving the model clearer guidance. Simple
tasks leave more room for the model to overthink/iterate.
```

---

## Comparison: 10-Task vs 40-Task Run

| Metric | 10-Task Run | 40-Task Run |
|--------|-------------|-------------|
| Success Rate | 100% (10/10) | 88% (35/40) |
| C1-C6 Rate | 100% | 91% (22/24) |
| C7-C8 Rate | 100% | 90% (9/10) |
| C9 Rate | N/A | 80% (4/5) |
| Code Quality | 8.5/10 | 8.7/10 |
| Better-than-ref | 2/10 (20%) | 7/35 (20%) |
| merge_sorted | Cheated (sorted()) | Proper O(n) merge |
| Avg Time | 49s | 54s |
| Reset Interval | Every 5 tasks | Every 3 tasks |

---

## Recommendations

### For Production Routing

```
Complexity 1-6  → Ollama (88-100% success, FREE)
Complexity 7-8  → Ollama primary, Haiku fallback (80-100%)
Complexity 9    → Ollama for single-class tasks (80%)
                  Haiku/Sonnet for multi-class (linked lists, trees)
Complexity 10   → Sonnet only
```

### Configuration
- **Reset every 3 tasks** (proven effective at preventing context pollution)
- **5-minute timeout** for C7+ tasks
- **Retry on syntax errors** - 3/5 failures were format errors that might pass on retry

---

*Report generated: 2026-02-05T22:00Z*
*Test data: scripts/ollama-stress-results-40.json*
*Test script: scripts/ollama-stress-test-40.js*
*Previous reports: scripts/QWEN25_CODER_7B_REPORT.md, scripts/QWEN25_CODER_7B_vs_14B_REPORT.md*
