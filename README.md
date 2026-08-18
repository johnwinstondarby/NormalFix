# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the InDesign Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.0 scope

NormalFix v1.0 is intentionally read-only. It:

1. scans every paragraph in every story in the active InDesign document;
2. inspects only paragraphs whose applied paragraph style is exactly `Normal`;
3. detects local paragraph-style overrides with Adobe's `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)` method;
4. does not count an applied character style by itself as a paragraph-style override;
5. records page, Story ID, Frame ID, paragraph index, text preview, and override-detection method;
6. provides **Locate** behavior for each finding;
7. exports findings to CSV;
8. makes no formatting changes.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied and local/manual formatting overrides exist. |
| `NF-002` | WARNING | `Normal` is applied but NormalFix could not verify override state. |

Clean `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Why v1 is audit-only

Unlike the four fixed section markers handled by HeaderFix, ordinary `Normal` paragraphs may contain intentional direct formatting. Clearing a `Normal+` state can remove local bold, italic, size, color, spacing, indentation, or other manual formatting. The first production scan should therefore establish what the findings represent before correction is enabled.

## Planned remediation after field validation

A later version can add guarded actions such as:

- Clear Selected Override
- Clear All Verified Overrides

Before changing a paragraph, NormalFix should re-check that the paragraph still uses `Normal` and still has a verified override, then rescan after the correction and verify that the override has cleared.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
