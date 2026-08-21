#target "InDesign"
#include "NormalFix_ObjectIdentity_Reference_v0_1_0.jsxinc"

/*
NormalFix object-identity adversarial canary v0.1.0

Creates a disposable document, saves it, closes it, reopens it, and only then
executes identity/refusal tests. The tested objects are therefore document-
resident before the test phase begins.

The production manuscript is never modified.
*/

(function () {
    var CANARY_VERSION = "0.1.0";
    var EXPECTED_APP_VERSION = "21.5.1.73";
    var EXPECTED_DOM_VERSION = "21.5";
    var OUTPUT_PATH = "D:/Recovery Community Dropbox/DARBY FAMILY/!!!New Business 2025/AI Ecosystem/DocStats";
    var GROUP_A = "NF Identity Group A";
    var GROUP_B = "NF Identity Group B";
    var STYLE_NAME = "NF Identity Style";
    var SWATCH_NAME = "NF Identity Swatch";
    var results = [];
    var tempDoc = null;
    var tempFile = null;
    var reportFile = null;

    function pad(n) { return n < 10 ? "0" + n : String(n); }
    function stamp() {
        var d = new Date();
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
               pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    function outputDir() {
        var f = new Folder(OUTPUT_PATH);
        if (f.exists) { return f; }
        f = new Folder(Folder.temp.fsName + "/NormalFixDiagnostic");
        if (!f.exists) { f.create(); }
        return f;
    }

    function addResult(id, expected, actual, detail) {
        results.push({
            id:id,
            expected:expected,
            actual:actual,
            pass:String(expected) === String(actual),
            detail:detail || ""
        });
    }

    function requireValid(obj, label) {
        if (!NormalFixObjectIdentity.valid(obj)) {
            throw new Error(label + " is not valid");
        }
        return obj;
    }

    function createAndPersistFixture(file) {
        var doc = app.documents.add();
        var groupA, groupB;
        try {
            groupA = doc.characterStyleGroups.add({name:GROUP_A});
            groupB = doc.characterStyleGroups.add({name:GROUP_B});
            groupA.characterStyles.add({name:STYLE_NAME});
            groupB.characterStyles.add({name:STYLE_NAME});
            doc.colors.add({
                name:SWATCH_NAME,
                model:ColorModel.PROCESS,
                space:ColorSpace.RGB,
                colorValue:[17, 83, 137]
            });
            doc.save(file);
        } finally {
            try { doc.close(SaveOptions.NO); } catch (eClose) {}
        }
    }

    function runTests(doc) {
        var groupA = requireValid(doc.characterStyleGroups.itemByName(GROUP_A), "Group A");
        var groupB = requireValid(doc.characterStyleGroups.itemByName(GROUP_B), "Group B");
        var styleA = requireValid(groupA.characterStyles.itemByName(STYLE_NAME), "Style A");
        var styleB = requireValid(groupB.characterStyles.itemByName(STYLE_NAME), "Style B");
        var swatch = requireValid(doc.swatches.itemByName(SWATCH_NAME), "Swatch");
        var styleIdentity = NormalFixObjectIdentity.identity(styleA);
        var swatchIdentity = NormalFixObjectIdentity.identity(swatch);
        var resolved, changed, clone;

        if (!styleIdentity.ok) { throw new Error("Style identity serialization failed: " + styleIdentity.status); }
        if (!swatchIdentity.ok) { throw new Error("Swatch identity serialization failed: " + swatchIdentity.status); }

        resolved = NormalFixObjectIdentity.resolve(doc, styleIdentity.state);
        addResult("A01_STYLE_PATH_DISAMBIGUATES_DUPLICATE_NAME", "RESOLVED", resolved.status,
                  "Group A and Group B contain the same leaf style name; qualified path must select Group A only.");
        if (resolved.ok) {
            addResult("A02_STYLE_BASELINE_ID", String(styleA.id), String(resolved.candidate.id),
                      "Resolved candidate must be the Group A style.");
        } else {
            addResult("A02_STYLE_BASELINE_ID", String(styleA.id), "<unresolved>", "Baseline resolver did not return candidate.");
        }

        changed = groupA.name;
        groupA.name = GROUP_A + " Renamed";
        resolved = NormalFixObjectIdentity.resolve(doc, styleIdentity.state);
        addResult("A03_GROUP_RENAME_REFUSES_OLD_PATH", "IDENTITY_CONFLICT", resolved.status,
                  "Stored ID still points to the style, but its qualified semantic path changed.");
        groupA.name = changed;

        clone = NormalFixObjectIdentity.cloneState(styleIdentity.state);
        clone.id = String(styleB.id);
        resolved = NormalFixObjectIdentity.resolve(doc, clone);
        addResult("A04_SUPPLEMENTAL_ID_CONFLICT_REFUSES", "IDENTITY_CONFLICT", resolved.status,
                  "Name/path match Style A while supplemental ID names Style B.");

        resolved = NormalFixObjectIdentity.resolve(doc, swatchIdentity.state);
        addResult("A05_SWATCH_BASELINE", "RESOLVED", resolved.status,
                  "Document-resident swatch should round-trip before mutation.");

        changed = swatch.name;
        swatch.name = SWATCH_NAME + " Renamed";
        resolved = NormalFixObjectIdentity.resolve(doc, swatchIdentity.state);
        addResult("A06_SWATCH_RENAME_REFUSES", "IDENTITY_CONFLICT", resolved.status,
                  "Stored ID may still identify the object; old semantic name must not resolve.");
        swatch.name = changed;

        clone = NormalFixObjectIdentity.cloneState(swatchIdentity.state);
        clone.id = "-999999999";
        resolved = NormalFixObjectIdentity.resolve(doc, clone);
        addResult("A07_SWATCH_ID_CONFLICT_REFUSES", "IDENTITY_CONFLICT", resolved.status,
                  "Semantic name matches while supplemental ID disagrees.");
    }

    function writeReport(file) {
        var i, passed = 0;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) { throw new Error("Could not write report: " + file.fsName); }
        file.writeln("NormalFix object-identity adversarial canary");
        file.writeln("version=" + CANARY_VERSION);
        file.writeln("identityReference=" + NormalFixObjectIdentity.VERSION);
        file.writeln("InDesignVersion=" + app.version);
        try { file.writeln("DOMVersion=" + app.scriptPreferences.version); } catch (eDom) {}
        file.writeln("fixturePersistence=save-close-reopen-before-test");
        file.writeln("productionDocumentMutation=false");
        file.writeln("");
        for (i = 0; i < results.length; i++) {
            if (results[i].pass) { passed++; }
            file.writeln((results[i].pass ? "PASS" : "FAIL") + "\t" +
                         results[i].id + "\texpected=" + results[i].expected +
                         "\tactual=" + results[i].actual +
                         "\t" + results[i].detail);
        }
        file.writeln("");
        file.writeln("SUMMARY=" + passed + "/" + results.length + " PASS");
        file.close();
        return passed;
    }

    function cleanup() {
        if (tempDoc && NormalFixObjectIdentity.valid(tempDoc)) {
            try { tempDoc.close(SaveOptions.NO); } catch (eClose) {}
        }
        tempDoc = null;
        if (tempFile && tempFile.exists) {
            try { tempFile.remove(); } catch (eRemove) {}
        }
    }

    function main() {
        var folder, passed = 0;
        if (String(app.version) !== EXPECTED_APP_VERSION) {
            alert("NormalFix adversarial canary REFUSED\n\nExpected InDesign " + EXPECTED_APP_VERSION + "\nFound " + app.version);
            return;
        }
        try {
            if (String(app.scriptPreferences.version) !== EXPECTED_DOM_VERSION) {
                alert("NormalFix adversarial canary REFUSED\n\nExpected DOM " + EXPECTED_DOM_VERSION + "\nFound " + app.scriptPreferences.version);
                return;
            }
        } catch (eVersion) {
            alert("NormalFix adversarial canary REFUSED\n\nCould not read DOM version: " + eVersion.message);
            return;
        }

        folder = outputDir();
        tempFile = new File(folder.fsName + "/NormalFix_ObjectIdentity_Adversarial_CANARY_" + stamp() + ".indd");
        reportFile = new File(folder.fsName + "/NormalFix_ObjectIdentity_Adversarial_" + stamp() + ".txt");

        try {
            createAndPersistFixture(tempFile);
            tempDoc = app.open(tempFile);
            runTests(tempDoc);
            passed = writeReport(reportFile);
            alert("NormalFix object-identity adversarial canary " + CANARY_VERSION +
                  "\n\n" + passed + "/" + results.length + " PASS" +
                  "\n\nReport:\n" + reportFile.fsName);
        } catch (e) {
            try {
                if (reportFile) {
                    reportFile.encoding = "UTF-8";
                    if (reportFile.open("a")) {
                        reportFile.writeln("FATAL\t" + e.message);
                        reportFile.close();
                    }
                }
            } catch (eReport) {}
            alert("NormalFix adversarial canary FAILED\n\n" + e.message);
        } finally {
            cleanup();
        }
    }

    main();
}());
