# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the InDesign Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.4 scope

NormalFix v1.4 makes table membership the exclusion boundary.

It:

1. scans every paragraph in every story in the active InDesign document;
2. checks whether each paragraph is inside a table before testing paragraph style;
3. excludes every paragraph inside a table, regardless of paragraph style;
4. therefore ignores table paragraphs using `Table Heading`, `Table First Column`, `Table Other Columns`, `Normal`, or any future table paragraph style;
5. leaves applied table character styles, including `CLI Code Red Table`, entirely outside NormalFix scope;
6. reports the total number of table paragraphs excluded;
7. audits only `Normal` paragraphs outside tables;
8. detects local paragraph-style overrides with Adobe's `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)` method;
9. does not count an applied character style by itself as a paragraph-style override;
10. records page, Story ID, Frame ID, paragraph index, text preview, and override-detection method;
11. supports Ctrl-click and Shift-click multi-selection in the findings list;
12. provides **Locate** for the first selected finding;
13. provides **Fix Selected to Normal** for one or more explicitly selected, verified `NF-001` findings outside tables;
14. re-checks the table exclusion immediately before remediation so a stale row cannot be changed after moving into a table;
15. verifies every correction, rescans the document, and reports outcome totals;
16. exports only eligible outside-table findings to CSV.

NormalFix v1.4 has no document-wide **Fix All** action.

## Ownership boundary

NormalFix owns `Normal` paragraphs outside tables.

TableFix owns all paragraph-style, character-style, cell-formatting, and structural remediation inside tables.

This boundary is based on location rather than style name. Once a paragraph is inside a table, NormalFix ignores it even if the paragraph still uses `Normal` because the table has not yet completed its TableFix QA pass.

Current table styles include:

- Paragraph style `Table Heading`
- Paragraph style `Table First Column`
- Paragraph style `Table Other Columns`
- Legacy/unremediated paragraph style `Normal`
- Character style `CLI Code Red Table`

These names document the current table model; the exclusion does not depend on them.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied outside a table and local/manual formatting overrides exist. Eligible for **Fix Selected to Normal**. |
| `NF-002` | WARNING | `Normal` is applied outside a table but NormalFix could not verify override state. Locate-only. |

Clean eligible `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Current remediation caution

v1.4 retains the current remediation operation `applyParagraphStyle(style, true)`. That operation can remove intentional character-level or manual formatting from a selected body paragraph.

Do not use **Fix Selected to Normal** on body paragraphs containing intentional inline formatting until the character-style-preservation update is completed.

The scanner remains useful because applied character styles are not counted by themselves as paragraph-style overrides.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
