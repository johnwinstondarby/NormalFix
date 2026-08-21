# NormalFix Object-Reference Identity Contract v0.1

**Status:** diagnostic contract candidate. Production NormalFix has not adopted this contract yet.

**Origin:** NormalFix production-manuscript read-only sweep v0.1.0, completed August 21, 2026.

The 2,883-target production sweep exposed one serializer class failure across four properties: `characters.appliedLanguage`, `characters.fillColor`, `paragraph.bulletsCharacterStyle`, and `paragraph.numberingCharacterStyle`. Every failing property is object-valued. Scalar and enum properties did not produce the same snapshot-readiness failure. The repair therefore belongs in a shared host-object identity layer rather than four property-specific patches.

The production sweep also exposed `composition.frameSpanSignature` as unreadable for every target. That composition failure remains separate from the object-reference identity contract. Source comparison shows that the production sweep used direct `Paragraph.parentTextFrames`, while the earlier composition stability canary used line/insertion-point frame resolution. The production diagnostic canary must confirm that this implementation divergence explains the production failure before any shared location code changes.

## 1. Principle

A rollback snapshot stores durable semantic identity, never a live ExtendScript host object and never a serialized host reference that is accepted only because it resolves to something.

Resolution is exact or refused.

A nearby name, an ID that points to an object whose semantic identity changed, or a stale specifier does not authorize substitution.

## 2. Identity fields

Every supported host-object snapshot state carries:

- contract version;
- object family;
- concrete InDesign type name;
- semantic name when the family has one;
- qualified path when hierarchy changes identity;
- object ID as supplemental same-session evidence when exposed;
- PostScript/full name for Font identity when exposed;
- object specifier as diagnostic or verified fast-path evidence only.

The initial family rules are:

| Family | Primary semantic identity | Supplemental evidence |
|---|---|---|
| Language | language name | concrete type, ID when exposed |
| CharacterStyle | qualified style-group path + style name | concrete type, ID |
| ParagraphStyle | qualified style-group path + style name | concrete type, ID |
| Swatch/Color | document-scoped swatch name; group path when the host exposes meaningful grouping | concrete type, ID |
| Font | PostScript name; full name/name only when PostScript name is unavailable | concrete type |
| StrokeStyle | document-scoped name | concrete type, ID |
| NumberingList | document-scoped name | concrete type, ID |

An unregistered host-object family serializes as `UNSUPPORTED_TYPE`. Generic name matching is prohibited for unknown families.

## 3. Qualified-path rule

For style families, the qualified path is part of identity.

`Group A/Body Emphasis` and `Group B/Body Emphasis` are different CharacterStyles even though the leaf name matches. A resolver presented with the first identity must not select the second.

A group rename or style move after snapshot changes semantic identity for rollback purposes. Resolution of the old state is refused.

## 4. Supplemental-ID rule

ID is corroborating evidence, not an override.

- Semantic identity matches and stored ID matches: `RESOLVED`.
- Semantic identity matches but stored ID differs: `IDENTITY_CONFLICT`.
- Semantic identity has no match but the stored ID points to an object with a different name/path: `IDENTITY_CONFLICT`.
- No semantic match and no ID match: `UNRESOLVED_IDENTITY`.

A resolver never follows ID to a renamed or moved object and silently calls that a match.

## 5. Specifier rule

`toSpecifier()` may be retained because it can be a fast same-session lookup and useful diagnostic evidence. It is never accepted without identity verification.

A successful `app.resolve(specifier)` is followed by the same family/name/path/ID checks as any other candidate. A stale specifier that resolves to a different object produces `SPECIFIER_IDENTITY_CONFLICT`.

## 6. Candidate rule

Candidate search is family-specific and bounded.

A Language resolver searches language collections. A CharacterStyle resolver searches character styles. A Swatch resolver searches swatches. Font enumeration is permitted only for Font state.

Cross-family exhaustive fallback is prohibited.

This directly addresses the production-sweep timing pattern: the old generic resolver allowed non-Font host state carrying `fullName` or `postscriptName` fields to enter global font enumeration. The diagnostic canary measures the old path once per host type rather than repeating it across every target.

## 7. Cardinality rule

- exactly one candidate satisfying primary semantic identity: continue to supplemental checks;
- zero candidates: `UNRESOLVED_IDENTITY`, unless supplemental ID exposes a changed object, which is `IDENTITY_CONFLICT`;
- more than one candidate: `AMBIGUOUS_IDENTITY`.

No first-match or best-match behavior is permitted.

## 8. Snapshot-readiness consequence

Any of the following makes the target snapshot unready:

- `UNSUPPORTED_TYPE`;
- `INCOMPLETE_IDENTITY`;
- `UNRESOLVED_IDENTITY`;
- `AMBIGUOUS_IDENTITY`;
- `IDENTITY_CONFLICT`;
- `SPECIFIER_IDENTITY_CONFLICT` when the specifier path is used.

NormalFix must refuse mutation for that target. The transaction engine remains responsible for the final state and hard-stop policy.

## 9. Production discrimination gate

Object-valued, container-sensitive, and universally sentinel-valued properties require evidence from pre-existing document-resident state before the property is admitted to a production proof surface.

Synthetic fixtures remain useful but cannot be the sole authority for these property classes.

The gate requires:

1. at least one value that existed in the document before the diagnostic script started;
2. a positive discriminating case proving that a non-default/non-sentinel value can be read;
3. for host-object identity, a same-session serialize/strict-resolve round trip;
4. a negative/refusal case proving that a changed name/path or conflicting supplemental ID is rejected;
5. production-shaped container coverage for container-sensitive properties.

A property that is universally `NOT_APPLICABLE`, null, or default-valued in one production manuscript still requires a deliberate positive case before that universal result is accepted as meaningful. This rule applies to `characters.kerningValue` and to future sentinel-valued properties.

## 10. Current NormalFix diagnostic set

The bare production diagnostic canary covers twelve anchors taken directly from the 2,883-target sweep. The set includes:

- one through five `appliedLanguage` instances per target;
- pre-existing bullets CharacterStyle cases;
- pre-existing numbering CharacterStyle cases;
- pre-existing fillColor cases;
- combined fill/style cases across multiple stories;
- `strokeColor` reads on every selected text-style range;
- `kerningValue` reads on every selected text-style range;
- direct Paragraph frame-span access and line/insertion-point frame-span access side by side.

The canary carries no ScriptWatch Harness. Harness 1.2 enters on the first 20-to-50-target post-fix production rerun, after the failure mechanism is understood.

## 11. Adversarial refusal gate

A separate disposable-document canary tests the resolver rather than the production manuscript:

- two CharacterStyles with the same leaf name in different groups remain distinct by qualified path;
- renaming a style group after snapshot makes the old identity refuse even when the stored ID still points to the moved identity;
- changing the stored ID while name/path match produces `IDENTITY_CONFLICT`;
- renaming a swatch after snapshot makes the old identity refuse rather than following ID;
- the canary document is saved, closed, and reopened before the identity tests so tested objects are document-resident rather than transient same-session fixture objects.

## 12. Promotion rule

The reference implementation under `canary/` is test code. It does not become production code by passing the canaries.

After production and adversarial results agree with this contract, the implementation is reviewed for promotion into shared `core/identity`, then NormalFix snapshot/digest code adopts that shared resolver. StyleFix must pass the same production-discrimination rule before its object-valued fingerprint fields are trusted.
