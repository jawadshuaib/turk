---
name: qa-testing
description: QA testing methodology, best practices, and structured approach for web application testing
version: 1.0.0
user-invocable: false
---

## QA Testing Methodology

Follow this systematic approach when testing web applications. Adapt based on your specific instructions.

### Phase 1: Smoke Test (do this first)
1. **Page loads** — Navigate to the URL. Does it render? Any blank page or error screen?
2. **Console check** — Note any JavaScript errors in the console
3. **Navigation** — Click through the main nav. Do all links work?
4. **Visual check** — Is the layout broken? Missing images? Overlapping elements?

### Phase 2: Authentication (if credentials provided)
1. **Login** — Use provided credentials. Does login succeed?
2. **Invalid login** — Try wrong password. Is the error message helpful?
3. **Empty fields** — Submit the form with empty fields. Validation?
4. **Session** — After login, refresh the page. Still logged in?
5. **Logout** — Does logout work? Can you access protected pages after?

### Phase 3: Forms & Input
1. **Valid input** — Fill forms with correct data. Does submission work?
2. **Empty submission** — Submit empty. Are required fields enforced?
3. **Invalid input** — Wrong format (e.g., email without @). Validation?
4. **Special characters** — Try `<script>alert(1)</script>`, emoji, Unicode
5. **Long input** — Paste 5000 characters. Handled gracefully?
6. **SQL injection** — Try `' OR 1=1 --` in text fields (report if not sanitized)

### Phase 4: Interactive Elements
1. **Buttons** — Click every button. Does it do something? Any dead buttons?
2. **Links** — Click every link. Any 404s or broken links?
3. **Dropdowns/Selects** — Do they open? Can you select values?
4. **Modals/Dialogs** — Do they open and close properly?
5. **Tabs** — Do tab switches work? Content updates?

### Phase 5: Edge Cases
1. **Back button** — Navigate forward then back. Page state correct?
2. **Refresh** — Refresh mid-operation. Data preserved or lost?
3. **Double-click** — Click a submit button twice rapidly. Duplicate submission?
4. **Network** — If a request is slow, is there a loading indicator?
5. **Empty states** — Pages with no data. Is there a helpful empty state?

### Phase 6: Accessibility Quick Check
1. **Images** — Do images have alt text?
2. **Contrast** — Is text readable against backgrounds?
3. **Labels** — Are form inputs labeled?
4. **Focus** — Can you see which element is focused?
5. **Keyboard** — Can major actions be done without a mouse?

### Reporting Checklist
For every bug found, include:
- ✅ Severity level
- ✅ Step-by-step reproduction
- ✅ Expected vs actual behavior
- ✅ Screenshot evidence
- ✅ Browser/page URL at time of bug
