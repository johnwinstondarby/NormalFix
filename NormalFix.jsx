#target "InDesign"
#targetengine "NormalFix"

/*
NormalFix v1.4

Audits Normal paragraphs outside tables for local/manual overrides.
All paragraphs inside tables are excluded before any paragraph-style test.
TableFix owns table content regardless of paragraph style or character style.

IMPORTANT: selected remediation still uses applyParagraphStyle(style, true).
Do not use remediation on body paragraphs containing intentional inline formatting
until the character-style-preservation update.

ExtendScript / ECMAScript 3 compatible.
*/

(function () {
    var VERSION = "1.4";
    var STYLE_NAME = "Normal";
    var FINDING_CODE = "NF-001";
    var UNKNOWN_CODE = "NF-002";
    var rows = [];
    var counts = null;
    var ui = {};

    if (app.documents.length === 0) {
        alert("NormalFix v" + VERSION + "\n\nOpen an InDesign document before running NormalFix.");
        return;
    }

    buildUI();
    scan();
    ui.win.show();

    function scan() {
        var doc = app.activeDocument;
        var oldRedraw = null;
        var s, p, story, para, styleName, override;

        rows = [];
        counts = {
            paragraphsScanned: 0,
            tableParagraphsExcluded: 0,
            eligibleNormalParagraphs: 0,
            findings: 0,
            cleanNormal: 0,
            unknown: 0,
            fallback: 0
        };

        status("Scanning " + docName(doc) + "...");

        try {
            oldRedraw = app.scriptPreferences.enableRedraw;
            app.scriptPreferences.enableRedraw = false;
        } catch (eRedraw) {}

        try {
            for (s = 0; s < doc.stories.length; s++) {
                story = doc.stories.item(s);
                if (!valid(story)) { continue; }

                for (p = 0; p < story.paragraphs.length; p++) {
                    para = story.paragraphs.item(p);
                    if (!valid(para)) { continue; }

                    counts.paragraphsScanned++;

                    // Location is the ownership boundary. TableFix owns every
                    // paragraph inside a table, regardless of paragraph style
                    // or character style.
                    if (isInsideTable(para)) {
                        counts.tableParagraphsExcluded++;
                        continue;
                    }

                    styleName = paragraphStyleName(para);
                    if (styleName !== STYLE_NAME) { continue; }

                    counts.eligibleNormalParagraphs++;
                    override = overrideState(para);

                    if (override.method === "styleOverridden fallback") {
                        counts.fallback++;
                    }

                    if (override.value === true) {
                        rows.push(findingRow(para, override));
                        counts.findings++;
                    } else if (override.value === false) {
                        counts.cleanNormal++;
                    } else {
                        rows.push(unknownRow(para, override));
                        counts.unknown++;
                    }
                }
            }

            sortRows();
            refresh(doc);

            if (rows.length > 0) {
                status("Scan complete. All table paragraphs were excluded. Select one or more findings to Locate or Fix Selected to Normal.");
            } else {
                status("Scan complete. No eligible Normal+ findings were detected outside tables.");
            }
        } catch (eScan) {
            status("Scan failed: " + eScan.message);
            alert("NormalFix scan failed.\n\n" + eScan.message + "\nLine: " + errorLine(eScan));
        } finally {
            if (oldRedraw !== null) {
                try { app.scriptPreferences.enableRedraw = oldRedraw; } catch (eRestore) {}
            }
        }
    }

    function findingRow(para, override) {
        var loc = locationOf(para);
        return {
            severity: "WARNING",
            code: FINDING_CODE,
            page: loc.page,
            pageSort: loc.pageSort,
            style: STYLE_NAME,
            overrides: true,
            overrideMethod: override.method,
            storyId: loc.storyId,
            frameId: loc.frameId,
            paragraphIndex: loc.paragraphIndex,
            location: loc.text,
            preview: previewText(safeContents(para)),
            finding: "Normal is applied outside a table, but local/manual formatting overrides exist.",
            action: "Fix Selected to Normal",
            paragraph: para,
            pageRef: loc.pageRef
        };
    }

    function unknownRow(para, override) {
        var loc = locationOf(para);
        return {
            severity: "WARNING",
            code: UNKNOWN_CODE,
            page: loc.page,
            pageSort: loc.pageSort,
            style: STYLE_NAME,
            overrides: null,
            overrideMethod: override.method,
            storyId: loc.storyId,
            frameId: loc.frameId,
            paragraphIndex: loc.paragraphIndex,
            location: loc.text,
            preview: previewText(safeContents(para)),
            finding: "Normal is applied outside a table, but NormalFix could not verify override state.",
            action: "Locate",
            paragraph: para,
            pageRef: loc.pageRef
        };
    }

    function overrideState(para) {
        var value;

        try {
            value = para.textHasOverrides(StyleType.PARAGRAPH_STYLE_TYPE, false);
            return {value: value === true, method: "textHasOverrides"};
        } catch (ePrimary) {}

        try {
            value = para.styleOverridden;
            return {value: value === true, method: "styleOverridden fallback"};
        } catch (eFallback) {}

        return {value: null, method: "unavailable"};
    }

    function isInsideTable(para) {
        var node;

        try {
            if (ancestorIsCell(para)) { return true; }
        } catch (ePara) {}

        try {
            if (para.insertionPoints.length > 0) {
                node = para.insertionPoints.item(0);
                if (ancestorIsCell(node)) { return true; }
            }
        } catch (eIP) {}

        try {
            if (para.cells !== undefined && para.cells.length > 0) { return true; }
        } catch (eCells) {}

        return false;
    }

    function ancestorIsCell(startNode) {
        var node = startNode;
        var depth = 0;
        var typeName;

        while (node !== null && node !== undefined && depth < 16) {
            typeName = objectTypeName(node);
            if (typeName === "Cell") { return true; }
            if (typeName === "Story" || typeName === "Document" || typeName === "Application") {
                return false;
            }
            try { node = node.parent; } catch (eParent) { return false; }
            depth++;
        }

        return false;
    }

    function objectTypeName(obj) {
        var name = "";
        try {
            if (obj.constructor && obj.constructor.name) {
                name = String(obj.constructor.name);
                if (name.length > 0) { return name; }
            }
        } catch (eConstructor) {}
        try {
            if (obj.constructorName !== undefined) {
                name = String(obj.constructorName);
                if (name.length > 0) { return name; }
            }
        } catch (eConstructorName) {}
        try {
            if (obj.reflect && obj.reflect.name) {
                name = String(obj.reflect.name);
            }
        } catch (eReflect) {}
        return name;
    }

    function locationOf(para) {
        var storyId = property(para.parentStory, "id", "-");
        var paragraphIndex = property(para, "index", "-");
        var frame = null;
        var page = null;
        var frames;
        var frameId = "-";
        var pageName = "Overset/No page";
        var pageSort = 999999998;

        try {
            frames = para.insertionPoints.item(0).parentTextFrames;
            if (frames && frames.length > 0) { frame = frames[0]; }
        } catch (eInsertionFrame) {}

        if (frame === null) {
            try {
                frames = para.parentTextFrames;
                if (frames && frames.length > 0) { frame = frames[0]; }
            } catch (eParagraphFrame) {}
        }

        if (frame !== null && valid(frame)) {
            frameId = property(frame, "id", "-");
            try { page = frame.parentPage; } catch (ePage) {}
        }

        if (page !== null && valid(page)) {
            pageName = property(page, "name", "?");
            try { pageSort = Number(page.documentOffset); } catch (eOffset) {}
        }

        return {
            page: pageName,
            pageSort: pageSort,
            storyId: storyId,
            frameId: frameId,
            paragraphIndex: paragraphIndex,
            pageRef: page,
            text: "Page " + pageName + " | Story " + storyId + " | Frame " + frameId + " | Paragraph " + paragraphIndex
        };
    }

    function buildUI() {
        var buttons;
        var button;

        ui.win = new Window("palette", "NormalFix v" + VERSION);
        ui.win.orientation = "column";
        ui.win.alignChildren = ["fill", "top"];
        ui.win.margins = 12;
        ui.win.spacing = 8;

        ui.title = ui.win.add("statictext", undefined, "Normal+ Audit and Selected Fix");
        try { ui.title.graphics.font = ScriptUI.newFont(ui.title.graphics.font.name, "BOLD", 15); } catch (eFont) {}

        ui.summary = ui.win.add("statictext", undefined, "", {multiline: true});
        ui.summary.preferredSize = [900, 64];

        ui.list = ui.win.add("listbox", undefined, [], {multiselect: true});
        ui.list.preferredSize = [900, 400];
        ui.list.onDoubleClick = locate;

        ui.status = ui.win.add("statictext", undefined, "");
        ui.status.preferredSize = [900, 32];

        buttons = ui.win.add("group");
        buttons.alignment = ["right", "top"];

        button = buttons.add("button", undefined, "Rescan");
        button.onClick = scan;
        button = buttons.add("button", undefined, "Locate");
        button.onClick = locate;
        button = buttons.add("button", undefined, "Fix Selected to Normal");
        button.onClick = fixSelected;
        button = buttons.add("button", undefined, "Save CSV");
        button.onClick = saveCSV;
        button = buttons.add("button", undefined, "Close");
        button.onClick = function () { ui.win.close(); };
    }

    function refresh(doc) {
        var i, row, line, detection;
        ui.list.removeAll();

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            line = fixed(row.severity, 8) + "  " +
                   fixed(row.page, 12) + "  " +
                   fixed(overrideText(row.overrides), 8) + "  " +
                   fixed(row.preview, 92) + "  " +
                   row.location;
            ui.list.add("item", line);
        }

        detection = "Override check: Adobe textHasOverrides";
        if (counts.fallback > 0) {
            detection += "; styleOverridden fallback used " + counts.fallback + " time(s)";
        }

        ui.summary.text = docName(doc) + "\n" +
            "Paragraphs scanned: " + counts.paragraphsScanned +
            "    Table paragraphs excluded: " + counts.tableParagraphsExcluded + "\n" +
            "Eligible Normal outside tables: " + counts.eligibleNormalParagraphs +
            "    Normal+ findings: " + counts.findings +
            "    Clean Normal: " + counts.cleanNormal +
            (counts.unknown > 0 ? "    Override unknown: " + counts.unknown : "") + "\n" +
            detection;

        try { ui.win.layout.layout(true); } catch (eLayout) {}
    }

    function locate() {
        var selected = selectedRows();
        var row, para, located = false;

        if (selected.length === 0) {
            alert("Select a NormalFix finding first.");
            return;
        }

        row = selected[0];
        if (!row || row.paragraph === null || !valid(row.paragraph)) {
            alert("The first selected finding no longer has a valid paragraph to locate.");
            return;
        }

        para = row.paragraph;
        try {
            if (row.pageRef !== null && valid(row.pageRef)) { app.activeWindow.activePage = row.pageRef; }
        } catch (eActivePage) {}
        try { para.showText(); located = true; } catch (eShow) {}
        try {
            app.select(para);
            located = true;
        } catch (eSelect) {
            try { app.select(para.insertionPoints.item(0)); located = true; } catch (eInsertionSelect) {}
        }

        if (located) {
            status("Located " + row.code + " at " + row.location +
                   (selected.length > 1 ? ". " + selected.length + " findings are selected." : "."));
        } else {
            alert("InDesign could not navigate to this paragraph.\n\n" + row.location);
        }
    }

    function selectedRows() {
        var selection = ui.list.selection;
        var selected = [];
        var i, item;

        if (selection === null) { return selected; }

        try {
            if (selection.length !== undefined && selection.index === undefined) {
                for (i = 0; i < selection.length; i++) {
                    item = selection[i];
                    if (item && item.index !== undefined && rows[item.index] !== undefined) {
                        selected.push(rows[item.index]);
                    }
                }
            } else if (selection.index !== undefined && rows[selection.index] !== undefined) {
                selected.push(rows[selection.index]);
            }
        } catch (eSelection) {}

        return selected;
    }

    function fixSelected() {
        var selected = selectedRows();
        var targets = [];
        var ineligible = 0;
        var i, row, message;

        if (selected.length === 0) {
            alert("Select one or more verified Normal+ findings first.");
            return;
        }

        for (i = 0; i < selected.length; i++) {
            row = selected[i];
            if (isFixableFinding(row)) { targets.push(row); } else { ineligible++; }
        }

        if (targets.length === 0) {
            alert("None of the selected rows are verified NF-001 Normal+ findings outside tables.\n\nNF-002 unknown-state rows are locate-only.");
            return;
        }

        if (targets.length === 1) {
            message = "NormalFix will restore the selected paragraph to the Normal paragraph style and clear its local/manual formatting overrides.\n\n" +
                      "Table paragraphs are excluded.\n\n" +
                      targets[0].location + "\n\nText: " + shortPreview(targets[0].preview);
        } else {
            message = "NormalFix will restore " + targets.length + " selected paragraphs to Normal and clear their local/manual formatting overrides.\n\n" +
                      "Only explicitly selected NF-001 findings outside tables will be changed.";
        }

        if (ineligible > 0) {
            message += "\n\nSelected but ineligible rows that will be skipped: " + ineligible;
        }

        message += "\n\nCAUTION: v1.4 remediation still clears local text attributes. Do not continue if these paragraphs contain intentional manual or character-level formatting.";

        if (!confirm(message + "\n\nContinue?")) { return; }
        fixRows(targets);
    }

    function fixRows(targets) {
        var fixedCount = 0;
        var skippedCount = 0;
        var failedCount = 0;
        var tableSkippedCount = 0;
        var oldRedraw = null;
        var i, row, para, currentStyle, currentOverride, canonicalStyle, verification;

        status("Fixing " + targets.length + " selected Normal+ paragraph(s)...");
        try {
            oldRedraw = app.scriptPreferences.enableRedraw;
            app.scriptPreferences.enableRedraw = false;
        } catch (eRedraw) {}

        try {
            for (i = 0; i < targets.length; i++) {
                row = targets[i];
                para = row.paragraph;

                if (!valid(para)) { skippedCount++; continue; }
                if (isInsideTable(para)) {
                    skippedCount++;
                    tableSkippedCount++;
                    continue;
                }

                currentStyle = paragraphStyleName(para);
                currentOverride = overrideState(para);
                if (currentStyle !== STYLE_NAME || currentOverride.value !== true) {
                    skippedCount++;
                    continue;
                }

                try {
                    canonicalStyle = para.appliedParagraphStyle;
                    if (!valid(canonicalStyle) || String(canonicalStyle.name) !== STYLE_NAME) {
                        skippedCount++;
                        continue;
                    }

                    para.applyParagraphStyle(canonicalStyle, true);
                    verification = overrideState(para);

                    if (paragraphStyleName(para) === STYLE_NAME && verification.value === false) {
                        fixedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (eFix) {
                    failedCount++;
                }
            }
        } finally {
            if (oldRedraw !== null) {
                try { app.scriptPreferences.enableRedraw = oldRedraw; } catch (eRestore) {}
            }
        }

        scan();

        alert("NormalFix selected remediation complete.\n\n" +
              "Corrected: " + fixedCount + "\n" +
              "Skipped: " + skippedCount + "\n" +
              "Skipped because now inside a table: " + tableSkippedCount + "\n" +
              "Could not verify: " + failedCount + "\n\n" +
              "The document was rescanned. Review the result before saving the document.");
    }

    function isFixableFinding(row) {
        return row !== null && row !== undefined &&
               row.code === FINDING_CODE &&
               row.style === STYLE_NAME &&
               row.overrides === true &&
               row.paragraph !== null &&
               valid(row.paragraph) &&
               !isInsideTable(row.paragraph);
    }

    function saveCSV() {
        var doc = app.activeDocument;
        var name = baseName(doc) + "_NormalFix_" + timestamp() + ".csv";
        var target = defaultFile(doc, name).saveDlg("Save NormalFix CSV", "CSV:*.csv");
        var f, i, row;

        if (target === null) { return; }
        if (!/\.csv$/i.test(target.name)) { target = new File(target.fsName + ".csv"); }

        f = new File(target.fsName);
        f.encoding = "UTF-8";
        f.lineFeed = "Windows";
        if (!f.open("w")) {
            alert("NormalFix could not open the selected file for writing.");
            return;
        }

        f.writeln(csv([
            "Severity", "Code", "Page", "Applied Style", "Has Overrides",
            "Override Detection", "Story ID", "Frame ID", "Paragraph Index",
            "Location", "Text Preview", "Finding", "Available Action"
        ]));

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            f.writeln(csv([
                row.severity, row.code, row.page, row.style,
                overrideText(row.overrides), row.overrideMethod, row.storyId,
                row.frameId, row.paragraphIndex, row.location, row.preview,
                row.finding, row.action
            ]));
        }

        f.close();
        status("CSV saved: " + target.fsName);
        alert("NormalFix CSV saved.\n\n" + target.fsName + "\n\n" +
              "All paragraphs inside tables were excluded from this findings CSV: " +
              counts.tableParagraphsExcluded);
    }

    function sortRows() {
        rows.sort(function (a, b) {
            if (a.pageSort !== b.pageSort) { return a.pageSort - b.pageSort; }
            if (String(a.storyId) !== String(b.storyId)) { return numericOrTextCompare(a.storyId, b.storyId); }
            return numericOrTextCompare(a.paragraphIndex, b.paragraphIndex);
        });
    }

    function numericOrTextCompare(a, b) {
        var na = Number(a);
        var nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) { return na - nb; }
        a = String(a);
        b = String(b);
        if (a < b) { return -1; }
        if (a > b) { return 1; }
        return 0;
    }

    function shortPreview(value) {
        var s = String(value);
        if (s.length > 180) { s = s.substring(0, 177) + "..."; }
        return s;
    }

    function previewText(value) {
        var s = String(value).replace(/\u00A0/g, " ");
        s = s.replace(/[\r\n\t]+/g, " ");
        s = s.replace(/  +/g, " ");
        s = s.replace(/^ +/, "").replace(/ +$/, "");
        if (s.length === 0) { return "<empty paragraph>"; }
        if (s.length > 140) { s = s.substring(0, 137) + "..."; }
        return s;
    }

    function paragraphStyleName(para) {
        try { return String(para.appliedParagraphStyle.name); } catch (e) { return "<unknown>"; }
    }

    function safeContents(para) {
        try { return para.contents; } catch (e) { return ""; }
    }

    function valid(obj) {
        try { return obj !== null && obj.isValid === true; } catch (e) { return false; }
    }

    function property(obj, name, fallback) {
        try { return String(obj[name]); } catch (e) { return fallback; }
    }

    function overrideText(value) {
        if (value === true) { return "Yes"; }
        if (value === false) { return "No"; }
        if (value === null) { return "Unknown"; }
        return String(value);
    }

    function fixed(value, width) {
        var s = String(value);
        while (s.length < width) { s += " "; }
        if (s.length > width) { s = s.substring(0, width - 3) + "..."; }
        return s;
    }

    function csv(values) {
        var out = [];
        var i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/"/g, "\"\"");
            out.push("\"" + s + "\"");
        }
        return out.join(",");
    }

    function defaultFile(doc, name) {
        var folder = Folder.desktop;
        try {
            if (doc.saved && doc.filePath && doc.filePath.exists) { folder = doc.filePath; }
        } catch (e) {}
        return new File(folder.fsName + "/" + name);
    }

    function docName(doc) {
        try { return String(doc.name); } catch (e) { return "Active document"; }
    }

    function baseName(doc) {
        return docName(doc).replace(/\.indd$/i, "").replace(/[\\\/:*?"<>|]/g, "_");
    }

    function timestamp() {
        var d = new Date();
        return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "-" +
               two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    function two(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function status(text) {
        ui.status.text = text;
        try { ui.win.update(); } catch (e) {}
    }

    function errorLine(err) {
        try { return err.line; } catch (e) { return "?"; }
    }
}());
