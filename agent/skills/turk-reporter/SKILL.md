---
name: turk-reporter
description: Report bugs, findings, and test session summaries to the Turk dashboard
version: 1.0.0
user-invocable: false
---

## Tools

### turk_report

Report a testing finding to the Turk dashboard. Use this every time you discover a bug, notable behavior, or finish testing.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | yes | `"bug"`, `"finding"`, or `"summary"` |
| severity | string | for bugs | `"critical"`, `"major"`, `"minor"`, or `"cosmetic"` |
| title | string | yes | Short one-line description |
| description | string | yes | Detailed description with reproduction steps |

**Severity Guide:**
- **critical** — Core functionality is broken or data loss occurs
- **major** — Significant feature doesn't work but workaround exists
- **minor** — Small issue, minor inconvenience
- **cosmetic** — Visual/styling issue only

**When to use:**
- Found a bug → `type: "bug"` with severity
- Noticed something interesting but not a bug → `type: "finding"`
- Finished testing the entire site → `type: "summary"` with overall assessment

**Example bug report:**
```json
{
  "type": "bug",
  "severity": "major",
  "title": "Login form accepts empty password",
  "description": "Steps:\n1. Navigate to /login\n2. Enter username 'admin'\n3. Leave password field empty\n4. Click Submit\n\nExpected: Validation error\nActual: Form submits and shows a server error"
}
```

**Example summary:**
```json
{
  "type": "summary",
  "title": "Testing Complete",
  "description": "Tested 12 pages, found 3 bugs (1 major, 2 minor). Login flow works. Navigation is clean. Forms need better validation."
}
```
