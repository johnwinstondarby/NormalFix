# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the InDesign Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.3 scope

NormalFix v1.3 adds a table exclusion boundary so that table text is owned by TableFix rather than NormalFix.

It:

1. scans every paragraph in every story in the active InDesign document;
2. identifies paragraphs whose applied paragraph style is exactly `Normal`;
3. excludes `Normal` paragraphs that are inside table cells;
4. reports the number of table `Normal` paragraphs excluded from the audit;
5. audits only eligible `Normal` paragraphs outside tables;
6. detects local paragraph-style overrides with Adobe's `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)` method;
7. does not count an applied character style by itself as a paragraph-style override;
8. records page, Story ID, Frame ID, paragraph index, text preview, and override-detection method;
9. supports Ctrl-click and Shift-click multi-selection in the findings list;
10. provides **Locate** for the first selected finding;
11. provides **Fix Selected to Normal** for one or more explicitly selected, verified `NF-001` findings outside tables;
12. re-checks the table exclusion immediately before remediation so a stale row cannot be changed after moving into a table;
13. verifies every correction, rescans the document, and reports outcome totals;
14. exports only eligible outside-table findings to CSV.

NormalFix v1.3 has no document-wide **Fix All** action.

## Ownership boundary

NormalFix owns `Normal` paragraphs outside tables.

TableFix owns paragraph-style normalization and structural remediation inside tables.

A `Normal` paragraph inside a table is excluded from NormalFix even when it contains local/manual overrides.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied outside a table and local/manual formatting overrides exist. Eligible for **Fix Selected to Normal**. |
| `NF-002` | WARNING | `Normal` is applied outside a table but NormalFix could not verify override state. Locate-only. |

Clean eligible `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Current remediation caution

v1.3 retains the v1.2 remediation operation `applyParagraphStyle(style, true)`. That operation can remove intentional character-level or manual formatting from a selected body paragraph.

Do not use **Fix Selected to Normal** on body paragraphs containing intentional inline formatting until the character-style-preservation update is completed.

The scanner remains useful because applied character styles are not counted by themselves as paragraph-style overrides.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
