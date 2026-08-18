# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the InDesign Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.2 scope

NormalFix v1.2 retains the audit and guarded remediation workflow and adds multi-selection in the findings list.

It:

1. scans every paragraph in every story in the active InDesign document;
2. inspects only paragraphs whose applied paragraph style is exactly `Normal`;
3. detects local paragraph-style overrides with Adobe's `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)` method;
4. does not count an applied character style by itself as a paragraph-style override;
5. records page, Story ID, Frame ID, paragraph index, text preview, and override-detection method;
6. supports Ctrl-click and Shift-click multi-selection in the findings list;
7. provides **Locate** for the first selected finding;
8. provides **Fix Selected to Normal** for one or more explicitly selected, verified `NF-001` findings;
9. confirms the number of eligible selected paragraphs before editing;
10. re-checks every selected paragraph immediately before editing;
11. skips rows that are stale, no longer `Normal`, or no longer have a verified override;
12. reapplies each paragraph's existing `Normal` style while clearing local/manual text attributes;
13. verifies every correction, rescans the document, and reports Corrected, Skipped, and Could not verify totals;
14. exports the current findings to CSV.

NormalFix v1.2 still has no document-wide **Fix All** action. Remediation applies only to rows explicitly selected by the user.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied and local/manual formatting overrides exist. Eligible for **Fix Selected to Normal**. |
| `NF-002` | WARNING | `Normal` is applied but NormalFix could not verify override state. Locate-only. |

Clean `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Multi-select remediation

Select one or more `NF-001` rows using normal Windows multi-selection controls, then click **Fix Selected to Normal**.

For a single row, NormalFix shows the paragraph location and text preview. For multiple rows, NormalFix confirms the number of eligible selected paragraphs. Any selected row that is not a verified `NF-001` finding is skipped.

The correction affects each entire selected paragraph. Local/manual formatting in those paragraphs can therefore be removed. Selection remains the safety boundary: NormalFix does not normalize unselected findings.

After remediation, NormalFix verifies each paragraph, rescans the document, and reports the outcome totals. Successfully corrected paragraphs disappear from the findings list.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
