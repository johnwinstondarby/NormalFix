# NormalFix Object-Reference Identity Contract v0.2

**Status:** FROZEN August 22, 2026. Production NormalFix has not adopted this contract yet.

**Origin:** NormalFix production-manuscript diagnostics and adversarial canaries completed August 21–22, 2026. Final objective review approved freeze on August 22, 2026.

## 1. Principle

Rollback state uses two related mechanisms:

1. **identified objects**, where InDesign exposes durable semantic identity;
2. **referenced objects**, where no semantic identity exists and the snapshot can only preserve an opaque document-local reference plus verification evidence.

Resolution is exact or refused.

Snapshots store durable plain data. Live ExtendScript host references are prohibited in authoritative snapshot state.

## 2. Identified-object families

The initial identified families are:

| Family | Primary semantic identity | Supplemental evidence |
|---|---|---|
| Language | language name | concrete type, ID when exposed |
| CharacterStyle | qualified style-group path + style name | concrete type, ID |
| ParagraphStyle | qualified style-group path + style name | concrete type, ID |
| Named Swatch/Color | document-scoped name; group path where meaningful | concrete type, ID |
| Font | PostScript name; full name/name only when PostScript name is unavailable | concrete type |
| StrokeStyle | document-scoped name | concrete type, ID |
| NumberingList | document-scoped name | concrete type, ID |

An unregistered host-object family serializes as `UNSUPPORTED_TYPE`. Generic name matching is prohibited for unknown families.

## 3. Referenced-object family: anonymous document-owned Color

An anonymous document-owned `Color` has no semantic name and therefore has no semantic identity to reconstruct.

The snapshot records an **anonymous Color reference** containing:

- contract version;
- family `AnonymousColorReference`;
- concrete InDesign type;
- document-local object ID;
- color model;
- color space;
- color value;
- object specifier as a lookup path;
- diagnostic document binding metadata.

The active transaction already binds the snapshot to one InDesign document. Resolution never searches another document.

### 3.1 Digest rule

The rollback digest compares the recorded anonymous-Color tuple directly. Digest comparison does not resolve the object.

### 3.2 Restoration rule

Rollback may resolve the stored specifier only inside the bound document. The resolved candidate must agree exactly on:

- concrete type;
- object ID;
- document ownership;
- anonymous-name state;
- color model;
- color space;
- color value.

Any disagreement refuses restoration.

There is no fallback search by color value, collection index, nearest match, or another same-value Color.

### 3.3 Missing-reference rule

If the anonymous Color reference no longer resolves:

- before `mutate()` starts: `SKIPPED / RESOLVE_FAILED`;
- after mutation may have started: `HARD_STOP`.

### 3.4 Evidence

Production evidence established that:

- anonymous Colors are present in `doc.colors` but absent from `doc.swatches`;
- IDs and specifiers survive save, close, and reopen;
- `resolve(specifier)` returns the original object ID;
- many different anonymous Color objects can share identical model, space, and value;
- the tested deleted Color ID was not reused across 32 newly created Color objects;
- one-step InDesign Undo preserved the tested anonymous Color reference;
- forced verification failure followed by rollback restored the tested anonymous Color through serialized state;
- the tested snapshot record contained no live host object.

### 3.5 Version-bound ID non-reuse rule

The anonymous-Color reference rule is qualified only for the approved host build: **InDesign 21.5.1.73 / DOM 21.5**.

The canary proved that a deleted anonymous Color ID was not reused across 32 newly created Color objects on that host. This is empirical host-build evidence, not a timeless property of InDesign. A future host build must re-run the ID-reuse canary before anonymous-Color restoration is admitted. If reuse is observed, the host build is unsupported for this reference mechanism until a stronger discriminator is proven.

A resolver must never assume ID non-reuse solely because it held on a previously approved build.

## 4. Qualified-path rule

For style families, the qualified group path is part of semantic identity.

`Group A/Body Emphasis` and `Group B/Body Emphasis` are different CharacterStyles even when the leaf name is identical.

A group rename or style move changes semantic identity for rollback purposes. Resolution of the old state is refused.

## 5. Supplemental-ID rule for identified objects

ID corroborates semantic identity and never overrides it.

- semantic identity matches and stored ID matches: `RESOLVED`;
- semantic identity matches but stored ID differs: `IDENTITY_CONFLICT`;
- semantic identity has no match but the stored ID points to an object with a different name/path: `IDENTITY_CONFLICT`;
- no semantic match and no ID match: `UNRESOLVED_IDENTITY`.

A resolver never follows ID to a renamed or moved identified object and silently accepts it.

This rule does not apply to `AnonymousColorReference`, whose ID is the opaque document-local reference key defined in §3.

## 6. Specifier rule

`toSpecifier()` may be retained as a fast same-session lookup and as diagnostic evidence.

ExtendScript resolution uses the global `resolve(specifier)` function.

For identified objects, a specifier result is accepted only after family/name/path/ID verification.

For `AnonymousColorReference`, a specifier result is accepted only after the exact checks in §3.2.

A stale or conflicting specifier produces `SPECIFIER_IDENTITY_CONFLICT`.

## 7. Candidate and family-surface rule

Candidate search is family-specific and bounded. Identity serialization and comparison are also family-specific: code reads only the properties declared for that family. Generic serializers that probe family-irrelevant host properties are prohibited.

This rule is required because InDesign host proxies may throw or stall when a property is read from a family that does not expose it. The adversarial work proved that `StrokeStyle` does not expose Font-only properties such as `postscriptName` and `fullName`; the final canary passed only after the serializer stopped probing irrelevant members.

Examples:

- Language searches language collections.
- CharacterStyle searches character styles and validates qualified group path.
- ParagraphStyle searches paragraph styles and validates qualified group path.
- Named Swatch/Color searches the appropriate document swatch/color surface.
- Font enumeration is permitted only for Font state.
- AnonymousColorReference performs no semantic candidate search and no fallback search.

Cross-family exhaustive fallback is prohibited.

## 8. Cardinality rule

For identified objects:

- exactly one candidate satisfying primary semantic identity: continue to supplemental checks;
- zero candidates: `UNRESOLVED_IDENTITY`, unless supplemental ID exposes a changed object, which is `IDENTITY_CONFLICT`;
- more than one candidate: `AMBIGUOUS_IDENTITY`.

No first-match or best-match behavior is permitted.

AnonymousColorReference does not use candidate cardinality. Its stored reference either resolves and verifies exactly or refuses.

## 9. Snapshot-readiness consequence

Any of the following makes a target snapshot unready:

- `UNSUPPORTED_TYPE`;
- `INCOMPLETE_IDENTITY`;
- `UNRESOLVED_IDENTITY`;
- `AMBIGUOUS_IDENTITY`;
- `IDENTITY_CONFLICT`;
- `SPECIFIER_IDENTITY_CONFLICT`;
- `RESOLVE_FAILED`.

NormalFix refuses mutation for an unready target. `core/mutate` remains responsible for final transaction state and hard-stop policy.

## 10. Production discrimination gate

Object-valued, container-sensitive, and universally sentinel-valued properties require evidence from pre-existing document-resident state before admission to a production proof surface.

The gate requires:

1. at least one value that existed before the diagnostic script started;
2. a positive discriminating case proving that a non-default/non-sentinel value can be read;
3. for identified host objects, a same-session serialize/strict-resolve round trip;
4. for referenced objects, a strict reference round trip plus mutation/rollback and Undo evidence;
5. a negative/refusal case proving changed semantic identity, conflicting supplemental ID, or invalid reference state is rejected;
6. production-shaped container coverage for container-sensitive properties.

Synthetic fixtures remain valid for deliberate positive discrimination when the production manuscript contains no positive case, provided the fixture is saved and closed before the read-only verifier starts.

## 11. Production-discrimination actuals

The NormalFix production-discrimination gate established:

- production object-valued properties resolve through strict family-specific identity except anonymous Colors, which use §3;
- `Paragraph.parentTextFrames` returns an Array on the approved host, and production `frameSpanSignature` must use array indexing rather than Collection `.item()`;
- direct frame IDs and independent line-derived frame IDs agree on tested production targets;
- the production manuscript contained no positive manual `kerningValue` or non-default `strokeColor` case;
- a saved, closed document-resident fixture proved two distinct manual kerning values through direct `textStyleRange` reads and production-shaped one-fetch `textStyleRange.properties`;
- the same fixture proved a named non-default stroke color, weight, and tint through direct and one-fetch production-shaped reads;
- control/default state remained distinct and the read-only verifier left the fixture unmodified.

## 12. Adversarial refusal gate

A disposable-document canary must prove the identified-object resolver refuses unsafe substitutions.

Required cases:

1. two CharacterStyles with the same leaf name in different groups remain distinct by qualified path;
2. renaming a style group after snapshot makes the old CharacterStyle identity refuse even when the stored ID still points to the moved object;
3. changing stored CharacterStyle ID while name/path match produces `IDENTITY_CONFLICT`;
4. renaming a named swatch after snapshot makes the old identity refuse rather than following ID;
5. two ParagraphStyles with the same leaf name in different groups remain distinct by qualified path;
6. a stored ParagraphStyle ID conflict refuses;
7. a Language name mismatch refuses rather than following ID;
8. a NumberingList name mismatch refuses rather than following ID;
9. a StrokeStyle name mismatch refuses rather than following ID;
10. a Font PostScript-name mismatch refuses;
11. an unsupported host-object family returns `UNSUPPORTED_TYPE`;
12. snapshot records contain no live host objects.

The disposable document is saved, closed, and reopened before the adversarial tests so the tested objects are document-resident rather than transient setup objects.

**Final actual:** `NormalFix_CoreIdentity_AdversarialRefusal_Canary_v0_1_3.jsx` passed **12/12** on InDesign 21.5.1.73 / DOM 21.5. ScriptWatch Harness 1.2 independently reported `DONE`, target `12/12`, pass `12`, fail `0`.

Two implementation defects were found and corrected before the final pass: a strict-equality operation on an InDesign `Color` host proxy could throw, and a generic serializer could probe family-irrelevant StrokeStyle properties. Neither correction weakened the refusal taxonomy.

## 13. DOM return-shape registry requirement

Member-name probing alone is insufficient for suite compatibility.

The shared DOM contract registry must record and probe expected return shape where code depends on shape. Examples include Array, Collection, scalar, Enumerator, host object, and plain object.

The production `parentTextFrames` failure established this requirement: the member exists, but it returns an Array on the approved host and therefore does not support Collection methods such as `.item()`.

This requirement belongs to the shared DOM contract surface, not to object identity resolution.

## 14. Freeze record and promotion rule

The canary implementation under `canary/` is test code. It does not become production code by passing.

The freeze conditions were satisfied on August 22, 2026:

1. the adversarial refusal gate in §12 passed 12/12;
2. implementation outcomes matched the taxonomy in this document;
3. the approved host remained InDesign `21.5.1.73` / DOM `21.5`;
4. final objective review found no remaining blocking safety case.

**Contract state: FROZEN.**

Promotion into shared `core/identity` remains a separate implementation step. NormalFix snapshot/digest code adopts the shared implementation only after promotion and adapter conformance. A future host build must requalify version-bound claims, including anonymous-Color ID non-reuse.
