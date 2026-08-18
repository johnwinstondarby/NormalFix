# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating and selectively correcting paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.5 scope

NormalFix v1.5 completes the guarded body-text remediation path by preserving applied character styles and standardizing red CLI text before paragraph cleanup.

It:

1. scans every paragraph in every story in the active InDesign document;
2. excludes every paragraph inside a table before any paragraph-style test;
3. audits only paragraphs outside tables whose paragraph style is exactly `Normal`;
4. detects local paragraph-style overrides with `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)`;
5. supports single-selection and Ctrl-click/Shift-click multi-selection;
6. re-checks every selected paragraph immediately before remediation;
7. detects red-family text at character precision;
8. assigns contiguous red-family ranges to the existing character style `CLI Code Red Body`;
9. applies `Normal` without clearing character attributes;
10. clears paragraph-only overrides;
11. verifies the final `Normal` state, character-style assignments, and red-text positions;
12. rescans automatically and reports corrected, skipped, and unverified totals;
13. exports only outside-table findings to CSV.

NormalFix has no document-wide **Fix All** action. Selection remains the remediation boundary.

## Ownership boundary

NormalFix owns `Normal` paragraphs outside tables.

TableFix owns all text and structure inside tables. NormalFix therefore ignores table content regardless of whether the table currently uses `Table Heading`, `Table First Column`, `Table Other Columns`, legacy `Normal`, `CLI Code Red Table`, or any future table style.

## Red CLI body text

The production character style is:

- `CLI Code Red Body`
- Aptos Display
- 11 pt
- RGB `202,23,30`

Before paragraph cleanup, NormalFix detects red-family characters and applies `CLI Code Red Body` to contiguous red ranges. The detector accepts named red swatches and color values that fall within a broad red hue family after RGB conversion. This allows older/manual reds to be standardized even when their source RGB values differ from `202,23,30`.

If red-family text is present and `CLI Code Red Body` cannot be resolved exactly once, NormalFix makes no change to the selected paragraph. If the style resolves to a clearly different RGB color, remediation is also blocked.

## Character-style preservation

v1.5 replaces the earlier `applyParagraphStyle(style, true)` remediation with:

```javascript
para.applyParagraphStyle(canonicalStyle, false);
para.clearOverrides(OverrideType.PARAGRAPH_ONLY);
```

This changes paragraph-level formatting without intentionally clearing applied character styles. NormalFix records the applied character-style pattern after red text is standardized and verifies that the pattern is unchanged after paragraph cleanup.

Red character positions are also verified after remediation.

NormalFix deliberately does not erase unrelated anonymous character-level formatting merely to force a PASS. If such formatting leaves the paragraph in a verified override state, the paragraph is reported as **Could not verify** and remains available for review.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied outside a table and local/manual formatting overrides exist. Eligible for selected remediation. |
| `NF-002` | WARNING | `Normal` is applied outside a table but NormalFix could not verify override state. Locate-only. |

Clean eligible `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
