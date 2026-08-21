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

## Development validation

A production-manuscript read-only sweep on August 21, 2026 exercised all 2,883 `NF-001` targets in the 505-page production manuscript against the frozen 243-key read surface. The locator resolved 2,883 of 2,883 targets with zero locator failures. Exact-key checks produced zero key-set mismatches and zero unexpected `NOT_APPLICABLE` results.

The same sweep exposed a production-only snapshot-readiness defect in object-valued properties. The affected properties were `characters.appliedLanguage`, `characters.fillColor`, `paragraph.bulletsCharacterStyle`, and `paragraph.numberingCharacterStyle`. The current development hypothesis is one common host-object identity/serialization defect rather than four property-specific defects. `composition.frameSpanSignature` also failed on every production target and remains a separate diagnostic question until the production canary identifies its failing operation.

Development artifacts for that work live under `docs/` and `canary/`:

- `docs/NORMALFIX_OBJECT_IDENTITY_CONTRACT_v0_1.md` defines the proposed durable semantic identity and refusal contract. Exact semantic identity is required; supplemental ID or object specifier data cannot authorize a partial match.
- `canary/NormalFix_ObjectIdentity_Reference_v0_1_0.jsxinc` is a test-only reference implementation of that contract. Passing canaries does not promote it into production code.
- `canary/NormalFix_ProductionIdentity_Diagnostic_v0_1_0.jsx` is a **read-only, no-Harness** production-manuscript diagnostic. It uses pre-existing manuscript targets, probes the object-valued properties, positive `strokeColor`/`kerningValue` discrimination surface, legacy-resolution timing, and two independent frame-span paths.
- `canary/NormalFix_ObjectIdentity_Adversarial_v0_1_0.jsx` creates a disposable saved/reopened document and proves refusal behavior for duplicate style names, qualified-path changes, swatch renames, and conflicting supplemental IDs. It does not modify the production manuscript.

The production `NormalFix.jsx` remains unchanged while these diagnostics run. ScriptWatch Harness 1.2 is intentionally absent from the production diagnostic canary so the serializer/frame investigation has one variable. Harness adoption begins with the first 20-to-50-target post-fix production rerun after the failure mechanism is established.

### Production discrimination rule

Object-valued, container-sensitive, and universally sentinel-valued properties require evidence from pre-existing document-resident state before they are trusted on a production proof surface. Synthetic fixtures remain useful but cannot be the sole authority for those property classes.

A universally `NOT_APPLICABLE`, null, or default result also requires at least one deliberate positive case proving that the property can produce a real discriminating value. This is the current gate for `characters.kerningValue` and for a non-default `characters.strokeColor` case.
