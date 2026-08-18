# NormalFix

NormalFix is an Adobe InDesign ExtendScript utility for locating paragraphs that use the paragraph style `Normal` but contain local/manual formatting overrides. In the InDesign Paragraph Styles panel, this condition is commonly displayed as `Normal+`.

## v1.1 scope

NormalFix v1.1 retains the v1.0 audit and adds guarded, one-paragraph-at-a-time remediation.

It:

1. scans every paragraph in every story in the active InDesign document;
2. inspects only paragraphs whose applied paragraph style is exactly `Normal`;
3. detects local paragraph-style overrides with Adobe's `textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false)` method;
4. does not count an applied character style by itself as a paragraph-style override;
5. records page, Story ID, Frame ID, paragraph index, text preview, and override-detection method;
6. provides **Locate** behavior for each finding;
7. provides **Fix Selected to Normal** for one verified `NF-001` finding at a time;
8. confirms the change before editing;
9. re-checks that the paragraph still uses `Normal` and still has a verified override immediately before editing;
10. reapplies the paragraph's existing `Normal` style while clearing local/manual text attributes;
11. verifies the result, rescans the document, and reports whether the selected finding cleared;
12. exports the current findings to CSV.

There is no bulk remediation button in v1.1.

## Finding codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `NF-001` | WARNING | `Normal` is applied and local/manual formatting overrides exist. Eligible for **Fix Selected to Normal**. |
| `NF-002` | WARNING | `Normal` is applied but NormalFix could not verify override state. Locate-only. |

Clean `Normal` paragraphs are counted in the summary but are not added to the findings list.

## Selected remediation

Select one `NF-001` row and click **Fix Selected to Normal**. NormalFix displays the paragraph location and text preview and asks for confirmation.

The correction affects the entire selected paragraph. It reapplies that paragraph's existing `Normal` paragraph style with override clearing enabled. Local/manual formatting in that paragraph can therefore be removed. This is why v1.1 requires explicit selection and confirmation and does not provide a bulk fix.

After the correction, NormalFix verifies that the paragraph still uses `Normal` and no longer reports a local override, then rescans the document. A successful correction disappears from the findings list.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
