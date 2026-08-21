#target "InDesign"
#include "NormalFix_ObjectIdentity_Reference_v0_1_0.jsxinc"

/*
NormalFix production object-identity diagnostic v0.1.0

READ ONLY. No Harness. No mutation.

Purpose:
  Diagnose the production-manuscript failures exposed by the 2,883-target
  read-only sweep without changing the document or repairing production code.

This canary deliberately uses paragraphs from the production sweep, including
one-to-five appliedLanguage host-object instances and known bullets, numbering,
and fillColor failures. It also compares the production sweep's direct
Paragraph.parentTextFrames path with the line/insertion-point path that passed
NormalFix's composition stability canary.

Outputs TXT + CSV to the suite DocStats runtime directory.
*/

(function () {
    var CANARY_VERSION = "0.1.0";
    var EXPECTED_APP_VERSION = "21.5.1.73";
    var EXPECTED_DOM_VERSION = "21.5";
    var OUTPUT_PATH = "D:/Recovery Community Dropbox/DARBY FAMILY/!!!New Business 2025/AI Ecosystem/DocStats";

    var TARGETS = [
        {id:"P01-LANG1", page:"211", storyId:"10743", paragraphIndex:"15076", prefix:"The at-rest domain also includes the assets that make A"},
        {id:"P02-LANG2", page:"213", storyId:"10743", paragraphIndex:"20680", prefix:"Net-new emphasis: Manage data in transit as a priority "},
        {id:"P03-LANG3", page:"212", storyId:"10743", paragraphIndex:"18764", prefix:"The mechanics of those paths are covered under reads an"},
        {id:"P04-LANG4", page:"211", storyId:"10743", paragraphIndex:"14631", prefix:"Copy sprawl is the uncontrolled proliferation of redund"},
        {id:"P05-LANG5", page:"212", storyId:"10743", paragraphIndex:"17616", prefix:"In-transit AI data is content that moves between system"},
        {id:"P06-BULLET", page:"213", storyId:"10743", paragraphIndex:"22295", prefix:"Google Cloud’s Colossus write-up (control plane compone"},
        {id:"P07-BULLET2", page:"386", storyId:"16476", paragraphIndex:"25584", prefix:"Incident response and on-call — 6%"},
        {id:"P08-NUMBER", page:"207", storyId:"10743", paragraphIndex:"5561", prefix:"Ingest (collect, land, quarantine)"},
        {id:"P09-NUMBER2", page:"122", storyId:"5415", paragraphIndex:"11918", prefix:"Data sources and governance"},
        {id:"P10-FILL", page:"149", storyId:"6139", paragraphIndex:"18973", prefix:"The job demands forces scheduling and resource manageme"},
        {id:"P11-FILL-BULLET", page:"184", storyId:"7794", paragraphIndex:"28636", prefix:"NVIDIA DCGM diagnostics (GPU health and burn-in)"},
        {id:"P12-FILL-NUM", page:"114", storyId:"3282", paragraphIndex:"74545", prefix:"Site Reliability Engineering (Beyer, Jones, Petoff, Mur"}
    ];

    var csvRows = [];
    var summary = [];
    var legacyTypeDone = {};
    var objectFamilyCounts = {};
    var strictStatusCounts = {};
    var outputFolder, txtFile, csvFile;

    function ms() { return new Date().getTime(); }

    function safeContents(obj) {
        try { return String(obj.contents); } catch (e) { return ""; }
    }

    function safeProp(obj, prop) {
        try { return {ok:true, value:obj[prop], error:""}; }
        catch (e) { return {ok:false, value:null, error:e.message}; }
    }

    function safeString(value) {
        try { return String(value); } catch (e) { return "<unstringable>"; }
    }

    function outputDir() {
        var f = new Folder(OUTPUT_PATH);
        if (f.exists) { return f; }
        f = new Folder(Folder.temp.fsName + "/NormalFixDiagnostic");
        if (!f.exists) { f.create(); }
        return f;
    }

    function pad(n) { return n < 10 ? "0" + n : String(n); }
    function stamp() {
        var d = new Date();
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
               pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    function csv(value) {
        var s = value === null || value === undefined ? "" : String(value);
        return '"' + s.replace(/"/g, '""').replace(/[\r\n\t]/g, " ") + '"';
    }

    function addCount(map, key) {
        key = String(key || "<empty>");
        map[key] = (map[key] || 0) + 1;
    }

    function row(target, scope, segment, propertyName, result) {
        result = result || {};
        csvRows.push({
            target: target ? target.id : "",
            page: target ? target.page : "",
            storyId: target ? target.storyId : "",
            paragraphIndex: target ? target.paragraphIndex : "",
            scope: scope || "",
            segment: segment === undefined ? "" : segment,
            property: propertyName || "",
            readStatus: result.readStatus || "",
            readMs: result.readMs === undefined ? "" : result.readMs,
            family: result.family || "",
            typeName: result.typeName || "",
            name: result.name || "",
            id: result.id || "",
            path: result.path || "",
            fullName: result.fullName || "",
            postscriptName: result.postscriptName || "",
            specifierPresent: result.specifierPresent || "",
            strictStatus: result.strictStatus || "",
            strictMs: result.strictMs === undefined ? "" : result.strictMs,
            specifierStatus: result.specifierStatus || "",
            specifierMs: result.specifierMs === undefined ? "" : result.specifierMs,
            legacyStatus: result.legacyStatus || "",
            legacyMs: result.legacyMs === undefined ? "" : result.legacyMs,
            value: result.value || "",
            note: result.note || ""
        });
    }

    function findStory(doc, id) {
        var i, s;
        for (i = 0; i < doc.stories.length; i++) {
            try {
                s = doc.stories.item(i);
                if (String(s.id) === String(id)) { return s; }
            } catch (eStory) {}
        }
        return null;
    }

    function findParagraph(story, paragraphIndex) {
        var i, p;
        if (!NormalFixObjectIdentity.valid(story)) { return null; }
        for (i = 0; i < story.paragraphs.length; i++) {
            try {
                p = story.paragraphs.item(i);
                if (String(p.index) === String(paragraphIndex)) { return p; }
            } catch (ePara) {}
        }
        return null;
    }

    function describeObjectValue(doc, value, readMs) {
        var ident = NormalFixObjectIdentity.identity(value);
        var d = ident.state || NormalFixObjectIdentity.describe(value);
        var strict, spec, legacy = null;
        var typeKey = d.typeName || d.family || "<unknown>";

        addCount(objectFamilyCounts, d.family || "Unsupported");

        if (ident.ok) {
            strict = NormalFixObjectIdentity.resolve(doc, d);
            spec = NormalFixObjectIdentity.resolveSpecifierVerified(doc, d);
        } else {
            strict = {status:ident.status, elapsedMs:0};
            spec = {status:"NOT_TESTED", elapsedMs:0};
        }
        addCount(strictStatusCounts, strict.status);

        if (!legacyTypeDone[typeKey]) {
            legacyTypeDone[typeKey] = true;
            legacy = legacyResolutionProbe(doc, d);
        }

        return {
            readStatus:"OBJECT",
            readMs:readMs,
            family:d.family,
            typeName:d.typeName,
            name:d.name,
            id:d.id,
            path:d.path,
            fullName:d.fullName,
            postscriptName:d.postscriptName,
            specifierPresent:d.specifier && d.specifier.length > 0 ? "yes" : "no",
            strictStatus:strict.status,
            strictMs:strict.elapsedMs,
            specifierStatus:spec.status,
            specifierMs:spec.elapsedMs,
            legacyStatus:legacy ? legacy.status : "not repeated",
            legacyMs:legacy ? legacy.elapsedMs : "",
            value:"",
            note:(legacy && legacy.detail) ? legacy.detail : (strict.detail || "")
        };
    }

    function legacyResolutionProbe(doc, state) {
        var started = ms();
        var resolved, candidate, i;
        var fontScan = false;
        if (!state) { return {status:"NO_STATE", elapsedMs:0}; }

        if (state.specifier && state.specifier.length > 0) {
            try {
                resolved = app.resolve(state.specifier);
                if (resolved && resolved.length > 0 && NormalFixObjectIdentity.valid(resolved[0])) {
                    return {status:"LEGACY_SPECIFIER_RESOLVED", elapsedMs:ms() - started};
                }
            } catch (eResolve) {}
        }

        try {
            if (state.typeName.indexOf("CharacterStyle") >= 0) {
                candidate = doc.characterStyles.itemByName(state.name);
            } else if (state.typeName.indexOf("ParagraphStyle") >= 0) {
                candidate = doc.paragraphStyles.itemByName(state.name);
            } else if (state.typeName.indexOf("NumberingList") >= 0) {
                candidate = doc.numberingLists.itemByName(state.name);
            } else if (state.typeName.indexOf("StrokeStyle") >= 0) {
                candidate = doc.strokeStyles.itemByName(state.name);
            } else if (state.typeName.indexOf("Color") >= 0 || state.typeName.indexOf("Swatch") >= 0) {
                candidate = doc.swatches.itemByName(state.name);
            }
            if (candidate && NormalFixObjectIdentity.valid(candidate)) {
                return {status:"LEGACY_DOC_FALLBACK_RESOLVED", elapsedMs:ms() - started};
            }
        } catch (eDoc) {}

        if (state.typeName.indexOf("Font") >= 0 ||
            (state.postscriptName && state.postscriptName.length > 0) ||
            (state.fullName && state.fullName.length > 0)) {
            fontScan = true;
            try {
                for (i = 0; i < app.fonts.length; i++) {
                    candidate = app.fonts.item(i);
                    if (!NormalFixObjectIdentity.valid(candidate)) { continue; }
                    if (state.postscriptName && state.postscriptName.length > 0 &&
                        NormalFixObjectIdentity.safeStringProperty(candidate, "postscriptName") === state.postscriptName) {
                        return {status:"LEGACY_FONT_SCAN_RESOLVED", elapsedMs:ms() - started,
                                detail:"entered global font enumeration"};
                    }
                    if (state.fullName && state.fullName.length > 0 &&
                        NormalFixObjectIdentity.safeStringProperty(candidate, "fullName") === state.fullName) {
                        return {status:"LEGACY_FONT_SCAN_RESOLVED", elapsedMs:ms() - started,
                                detail:"entered global font enumeration"};
                    }
                    if (state.name && state.name.length > 0 &&
                        NormalFixObjectIdentity.safeStringProperty(candidate, "name") === state.name) {
                        return {status:"LEGACY_FONT_SCAN_RESOLVED", elapsedMs:ms() - started,
                                detail:"entered global font enumeration"};
                    }
                }
            } catch (eFonts) {
                return {status:"LEGACY_FONT_SCAN_ERROR", elapsedMs:ms() - started,
                        detail:eFonts.message};
            }
        }
        return {status:"LEGACY_UNRESOLVED", elapsedMs:ms() - started,
                detail:fontScan ? "entered global font enumeration" : "no matching resolver"};
    }

    function probeProperty(doc, target, scope, segment, obj, prop) {
        var started = ms();
        var got = safeProp(obj, prop);
        var elapsed = ms() - started;
        var value, t, reflectName = "";
        if (!got.ok) {
            row(target, scope, segment, prop, {readStatus:"READ_ERROR", readMs:elapsed, note:got.error});
            return;
        }
        value = got.value;
        t = typeof value;
        if (value === null) {
            row(target, scope, segment, prop, {readStatus:"NULL", readMs:elapsed, value:"null"});
            return;
        }
        try { reflectName = value.reflect && value.reflect.name ? String(value.reflect.name) : ""; }
        catch (eReflect) {}
        if (t === "object" && reflectName !== "Enumerator" && NormalFixObjectIdentity.valid(value)) {
            row(target, scope, segment, prop, describeObjectValue(doc, value, elapsed));
            return;
        }
        row(target, scope, segment, prop, {
            readStatus:reflectName === "Enumerator" ? "ENUM" : "SCALAR",
            readMs:elapsed,
            typeName:reflectName,
            value:safeString(value)
        });
    }

    function frameDiagnostics(target, para) {
        var started, frames, i, parts, line, id, directError = "", lineError = "";

        started = ms();
        parts = [];
        try {
            frames = para.parentTextFrames;
            for (i = 0; i < frames.length; i++) {
                parts.push(String(frames.item ? frames.item(i).id : frames[i].id));
            }
            row(target, "composition", "", "frameSpan.directParagraphParentTextFrames", {
                readStatus:"READ_OK", readMs:ms() - started, value:parts.join(",")
            });
        } catch (eDirect) {
            directError = eDirect.message;
            row(target, "composition", "", "frameSpan.directParagraphParentTextFrames", {
                readStatus:"READ_ERROR", readMs:ms() - started, note:eDirect.message
            });
        }

        started = ms();
        parts = [];
        try {
            for (i = 0; i < para.lines.length; i++) {
                line = para.lines.item(i);
                id = firstFrameIdForLine(line);
                if (parts.length === 0 || parts[parts.length - 1] !== id) { parts.push(id); }
            }
            row(target, "composition", "", "frameSpan.lineInsertionPointPath", {
                readStatus:"READ_OK", readMs:ms() - started, value:parts.join(">"),
                note:directError ? "direct paragraph path failed while line path succeeded" : ""
            });
        } catch (eLine) {
            lineError = eLine.message;
            row(target, "composition", "", "frameSpan.lineInsertionPointPath", {
                readStatus:"READ_ERROR", readMs:ms() - started, note:eLine.message
            });
        }

        summary.push(target.id + " frame direct=" + (directError ? "ERROR:" + directError : "OK") +
                     " line=" + (lineError ? "ERROR:" + lineError : "OK"));
    }

    function firstFrameIdForLine(line) {
        var frames;
        try {
            if (line.insertionPoints.length > 0) {
                frames = line.insertionPoints.item(0).parentTextFrames;
                if (frames && frames.length > 0 && NormalFixObjectIdentity.valid(frames[0])) {
                    return String(frames[0].id);
                }
            }
        } catch (eIP) {}
        try {
            frames = line.parentTextFrames;
            if (frames && frames.length > 0 && NormalFixObjectIdentity.valid(frames[0])) {
                return String(frames[0].id);
            }
        } catch (eLineFrames) {}
        return "@NOFRAME";
    }

    function probeTarget(doc, target, para) {
        var contents = safeContents(para);
        var ranges, i;
        if (contents.substr(0, target.prefix.length) !== target.prefix) {
            row(target, "target", "", "anchor", {readStatus:"REFUSED", note:"preview prefix mismatch"});
            summary.push(target.id + " REFUSED preview prefix mismatch");
            return false;
        }

        probeProperty(doc, target, "paragraph", "", para, "bulletsCharacterStyle");
        probeProperty(doc, target, "paragraph", "", para, "numberingCharacterStyle");

        try { ranges = para.textStyleRanges; }
        catch (eRanges) {
            row(target, "characters", "", "textStyleRanges", {readStatus:"READ_ERROR", note:eRanges.message});
            return false;
        }

        for (i = 0; i < ranges.length; i++) {
            probeProperty(doc, target, "characters", i, ranges.item(i), "appliedLanguage");
            probeProperty(doc, target, "characters", i, ranges.item(i), "fillColor");
            probeProperty(doc, target, "characters", i, ranges.item(i), "strokeColor");
            probeProperty(doc, target, "characters", i, ranges.item(i), "kerningValue");
        }

        frameDiagnostics(target, para);
        return true;
    }

    function writeCsv(file) {
        var headers = ["Target","Page","Story ID","Paragraph Index","Scope","Segment","Property",
            "Read status","Read ms","Family","Type","Name","ID","Qualified path","Full name",
            "PostScript name","Specifier present","Strict status","Strict ms","Specifier status",
            "Specifier ms","Legacy status","Legacy ms","Value","Note"];
        var i, r, values, j;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) { throw new Error("Could not open CSV: " + file.fsName); }
        values = [];
        for (j = 0; j < headers.length; j++) { values.push(csv(headers[j])); }
        file.writeln(values.join(","));
        for (i = 0; i < csvRows.length; i++) {
            r = csvRows[i];
            values = [r.target,r.page,r.storyId,r.paragraphIndex,r.scope,r.segment,r.property,
                r.readStatus,r.readMs,r.family,r.typeName,r.name,r.id,r.path,r.fullName,
                r.postscriptName,r.specifierPresent,r.strictStatus,r.strictMs,r.specifierStatus,
                r.specifierMs,r.legacyStatus,r.legacyMs,r.value,r.note];
            for (j = 0; j < values.length; j++) { values[j] = csv(values[j]); }
            file.writeln(values.join(","));
        }
        file.close();
    }

    function writeTxt(file, doc, resolvedTargets, refusedTargets, startModified, endModified) {
        var key, i;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) { throw new Error("Could not open TXT: " + file.fsName); }
        file.writeln("NormalFix production object-identity diagnostic");
        file.writeln("version=" + CANARY_VERSION);
        file.writeln("identityReference=" + NormalFixObjectIdentity.VERSION);
        file.writeln("document=" + doc.name);
        file.writeln("InDesignVersion=" + app.version);
        try { file.writeln("DOMVersion=" + app.scriptPreferences.version); } catch (eDom) {}
        file.writeln("READ_ONLY=true");
        file.writeln("Harness=false");
        file.writeln("targetsRequested=" + TARGETS.length);
        file.writeln("targetsResolved=" + resolvedTargets);
        file.writeln("targetsRefused=" + refusedTargets);
        file.writeln("documentModifiedAtStart=" + startModified);
        file.writeln("documentModifiedAtEnd=" + endModified);
        file.writeln("");
        file.writeln("OBJECT FAMILY COUNTS");
        for (key in objectFamilyCounts) { file.writeln(key + "=" + objectFamilyCounts[key]); }
        file.writeln("");
        file.writeln("STRICT RESOLUTION STATUS COUNTS");
        for (key in strictStatusCounts) { file.writeln(key + "=" + strictStatusCounts[key]); }
        file.writeln("");
        file.writeln("FRAME DIAGNOSTICS");
        for (i = 0; i < summary.length; i++) { file.writeln(summary[i]); }
        file.writeln("");
        file.writeln("INTERPRETATION RULES");
        file.writeln("- A semantic identity resolves only on exact family/name/qualified-path agreement.");
        file.writeln("- Supplemental ID disagreement is IDENTITY_CONFLICT, never a fallback match.");
        file.writeln("- app.resolve(specifier) is diagnostic/fast-path evidence only and must verify semantic identity.");
        file.writeln("- Legacy resolver timing is performed once per host type to expose expensive fallback behavior.");
        file.writeln("- direct Paragraph.parentTextFrames and line/insertion-point frame paths are reported separately.");
        file.writeln("");
        file.writeln("CSV=" + csvFile.fsName);
        file.close();
    }

    function main() {
        var doc, startModified, endModified, resolvedTargets = 0, refusedTargets = 0;
        var i, target, story, para;

        if (app.documents.length === 0) {
            alert("NormalFix diagnostic: open the production manuscript first.");
            return;
        }
        doc = app.activeDocument;
        if (String(app.version) !== EXPECTED_APP_VERSION) {
            alert("NormalFix diagnostic REFUSED\n\nExpected InDesign " + EXPECTED_APP_VERSION + "\nFound " + app.version);
            return;
        }
        try {
            if (String(app.scriptPreferences.version) !== EXPECTED_DOM_VERSION) {
                alert("NormalFix diagnostic REFUSED\n\nExpected DOM " + EXPECTED_DOM_VERSION + "\nFound " + app.scriptPreferences.version);
                return;
            }
        } catch (eVersion) {
            alert("NormalFix diagnostic REFUSED\n\nCould not read DOM version: " + eVersion.message);
            return;
        }

        outputFolder = outputDir();
        txtFile = new File(outputFolder.fsName + "/NormalFix_ProductionIdentityDiagnostic_" + stamp() + ".txt");
        csvFile = new File(outputFolder.fsName + "/NormalFix_ProductionIdentityDiagnostic_" + stamp() + ".csv");
        startModified = doc.modified;

        for (i = 0; i < TARGETS.length; i++) {
            target = TARGETS[i];
            story = findStory(doc, target.storyId);
            if (!NormalFixObjectIdentity.valid(story)) {
                row(target, "target", "", "anchor", {readStatus:"REFUSED", note:"story ID not found"});
                refusedTargets++;
                continue;
            }
            para = findParagraph(story, target.paragraphIndex);
            if (!NormalFixObjectIdentity.valid(para)) {
                row(target, "target", "", "anchor", {readStatus:"REFUSED", note:"paragraph index not found"});
                refusedTargets++;
                continue;
            }
            if (probeTarget(doc, target, para)) { resolvedTargets++; }
            else { refusedTargets++; }
        }

        endModified = doc.modified;
        writeCsv(csvFile);
        writeTxt(txtFile, doc, resolvedTargets, refusedTargets, startModified, endModified);

        alert("NormalFix production identity diagnostic " + CANARY_VERSION +
              "\n\nREAD ONLY / NO HARNESS" +
              "\nResolved targets: " + resolvedTargets + "/" + TARGETS.length +
              "\nRefused: " + refusedTargets +
              "\nRows: " + csvRows.length +
              "\n\nTXT:\n" + txtFile.fsName +
              "\n\nCSV:\n" + csvFile.fsName);
    }

    main();
}());
