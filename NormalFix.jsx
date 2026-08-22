/*
 * NormalFix - body paragraph style repair for Adobe InDesign documents
 * Copyright (C) 2026 John Darby
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// SPDX-License-Identifier: GPL-3.0-or-later

#target "InDesign"
#targetengine "NormalFix"

/*
NormalFix v1.5

Audits Normal paragraphs outside tables for local/manual overrides and provides
guarded selected remediation that preserves applied character styles.

v1.5 remediation:
  - excludes all table content before any paragraph-style test;
  - detects red-family text at character precision before paragraph cleanup;
  - applies the existing character style CLI Code Red Body to red-family ranges;
  - applies Normal without clearing character attributes;
  - clears paragraph-only overrides;
  - verifies Normal, override state, character-style assignments, and red-text positions.

CLI Code Red Body is expected to use RGB 202,23,30. Red-family detection is broader
than that exact RGB value so older/manual reds can be standardized safely.

No document-wide Fix All action is provided.

ExtendScript / ECMAScript 3 compatible.
*/

(function () {
    var VERSION = "1.5";
    var STYLE_NAME = "Normal";
    var FINDING_CODE = "NF-001";
    var UNKNOWN_CODE = "NF-002";
    var CLI_RED_BODY_STYLE = "CLI Code Red Body";
    var PARAGRAPH_ONLY_OVERRIDE_VALUE = 1885434479;
    var TARGET_RED_R = 202;
    var TARGET_RED_G = 23;
    var TARGET_RED_B = 30;
    var cliRedBodyStyle = null;
    var cliRedBodyColorStatus = "Missing";
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

        cliRedBodyStyle = findCharacterStyle(doc, CLI_RED_BODY_STYLE);
        cliRedBodyColorStatus = characterStyleTargetColorStatus(cliRedBodyStyle);

        status("Scanning " + docName(doc) + "...");

        try {
            oldRedraw = app.scriptPreferences.enableRedraw;
            app.scriptPreferences.enableRedraw = false;
        } catch (eRedraw) {}

        try {
            for (s = 0; s < doc.stories.length; s++) {
                story = doc.stories.item(s);
                if (!valid(story)) {
                    continue;
                }

                for (p = 0; p < story.paragraphs.length; p++) {
                    para = story.paragraphs.item(p);
                    if (!valid(para)) {
                        continue;
                    }

                    counts.paragraphsScanned++;

                    // TableFix owns every paragraph inside a table, regardless of
                    // paragraph style or applied character styles. Exclude table
                    // content before testing for Normal.
                    if (isInsideTable(para)) {
                        counts.tableParagraphsExcluded++;
                        continue;
                    }

                    styleName = paragraphStyleName(para);
                    if (styleName !== STYLE_NAME) {
                        continue;
                    }

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
                status("Scan complete. Table paragraphs were excluded. Select one or more findings to Locate or Fix Selected to Normal.");
            } else {
                status("Scan complete. No eligible Normal+ findings were detected outside tables.");
            }
        } catch (eScan) {
            status("Scan failed: " + eScan.message);
            alert("NormalFix scan failed.\n\n" + eScan.message + "\nLine: " + errorLine(eScan));
        } finally {
            if (oldRedraw !== null) {
                try {
                    app.scriptPreferences.enableRedraw = oldRedraw;
                } catch (eRestore) {}
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

        // false means an applied character style by itself is not counted
        // as a paragraph-style override.
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

        // Primary path: walk upward from the paragraph.
        try {
            node = para;
            if (ancestorIsCell(node)) {
                return true;
            }
        } catch (eParaChain) {}

        // Secondary path: table-cell text commonly exposes the Cell through
        // the first insertion point's parent chain.
        try {
            if (para.insertionPoints.length > 0) {
                node = para.insertionPoints.item(0);
                if (ancestorIsCell(node)) {
                    return true;
                }
            }
        } catch (eIPChain) {}

        // Conservative fallback. Some DOM variants expose cells on text objects.
        try {
            if (para.cells !== undefined && para.cells.length > 0) {
                return true;
            }
        } catch (eCells) {}

        return false;
    }

    function ancestorIsCell(startNode) {
        var node = startNode;
        var depth = 0;
        var typeName;

        while (node !== null && node !== undefined && depth < 16) {
            typeName = objectTypeName(node);
            if (typeName === "Cell") {
                return true;
            }

            // Stop at broad document containers. A Cell, if present, would
            // appear before these in the parent chain.
            if (typeName === "Story" ||
                typeName === "Document" ||
                typeName === "Application") {
                return false;
            }

            try {
                node = node.parent;
            } catch (eParent) {
                return false;
            }

            depth++;
        }

        return false;
    }

    function objectTypeName(obj) {
        var name = "";

        if (obj === null || obj === undefined) {
            return name;
        }

        try {
            if (obj.constructor && obj.constructor.name) {
                name = String(obj.constructor.name);
                if (name.length > 0) {
                    return name;
                }
            }
        } catch (eConstructor) {}

        try {
            if (obj.constructorName !== undefined) {
                name = String(obj.constructorName);
                if (name.length > 0) {
                    return name;
                }
            }
        } catch (eConstructorName) {}

        try {
            if (obj.reflect && obj.reflect.name) {
                name = String(obj.reflect.name);
                if (name.length > 0) {
                    return name;
                }
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
            if (frames && frames.length > 0) {
                frame = frames[0];
            }
        } catch (eInsertionFrame) {}

        if (frame === null) {
            try {
                frames = para.parentTextFrames;
                if (frames && frames.length > 0) {
                    frame = frames[0];
                }
            } catch (eParagraphFrame) {}
        }

        if (frame !== null && valid(frame)) {
            frameId = property(frame, "id", "-");
            try {
                page = frame.parentPage;
            } catch (ePage) {}
        }

        if (page !== null && valid(page)) {
            pageName = property(page, "name", "?");
            try {
                pageSort = Number(page.documentOffset);
            } catch (eOffset) {}
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
        try {
            ui.title.graphics.font = ScriptUI.newFont(ui.title.graphics.font.name, "BOLD", 15);
        } catch (eFont) {}

        ui.summary = ui.win.add("statictext", undefined, "", {multiline: true});
        ui.summary.preferredSize = [900, 82];

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
            "CLI Code Red Body: " + (cliRedBodyStyle !== null ? "Yes" : "No") +
            "    RGB 202,23,30: " + cliRedBodyColorStatus + "    " + detection;

        try {
            ui.win.layout.layout(true);
        } catch (eLayout) {}
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
            if (row.pageRef !== null && valid(row.pageRef)) {
                app.activeWindow.activePage = row.pageRef;
            }
        } catch (eActivePage) {}

        try {
            para.showText();
            located = true;
        } catch (eShow) {}

        try {
            app.select(para);
            located = true;
        } catch (eSelect) {
            try {
                app.select(para.insertionPoints.item(0));
                located = true;
            } catch (eInsertionSelect) {}
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

        if (selection === null) {
            return selected;
        }

        try {
            if (selection.length !== undefined && selection.index === undefined) {
                for (i = 0; i < selection.length; i++) {
                    item = selection[i];
                    if (item !== null &&
                        item !== undefined &&
                        item.index !== undefined &&
                        rows[item.index] !== undefined) {
                        selected.push(rows[item.index]);
                    }
                }
            } else if (selection.index !== undefined &&
                       rows[selection.index] !== undefined) {
                selected.push(rows[selection.index]);
            }
        } catch (eSelection) {}

        return selected;
    }

    function fixSelected() {
        var selected = selectedRows();
        var targets = [];
        var ineligible = 0;
        var redRunCount = 0;
        var i, row, runs;
        var message;

        if (selected.length === 0) {
            alert("Select one or more verified Normal+ findings first.");
            return;
        }

        for (i = 0; i < selected.length; i++) {
            row = selected[i];
            if (isFixableFinding(row)) {
                targets.push(row);
                runs = findRedRuns(row.paragraph);
                redRunCount += runs.length;
            } else {
                ineligible++;
            }
        }

        if (targets.length === 0) {
            alert("None of the selected rows are verified NF-001 Normal+ findings outside tables.\n\nNF-002 unknown-state rows are locate-only.");
            return;
        }

        cliRedBodyStyle = findCharacterStyle(app.activeDocument, CLI_RED_BODY_STYLE);
        cliRedBodyColorStatus = characterStyleTargetColorStatus(cliRedBodyStyle);

        if (redRunCount > 0 && cliRedBodyStyle === null) {
            alert("NormalFix found red-family text in the selected paragraph(s), but the required character style could not be resolved exactly once:\n\n" +
                  CLI_RED_BODY_STYLE + "\n\nNo change was made.");
            return;
        }

        if (redRunCount > 0 && cliRedBodyColorStatus.indexOf("Mismatch") === 0) {
            alert("NormalFix found red-family text, but " + CLI_RED_BODY_STYLE +
                  " does not match the expected RGB 202,23,30 definition.\n\n" +
                  cliRedBodyColorStatus + "\n\nNo change was made.");
            return;
        }

        if (targets.length === 1) {
            message = "NormalFix will restore the selected paragraph to Normal while preserving applied character styles.\n\n" +
                      "Before paragraph cleanup, red-family text will be assigned " + CLI_RED_BODY_STYLE + ".\n\n" +
                      "Red-family runs detected: " + redRunCount + "\n\n" +
                      targets[0].location + "\n\n" +
                      "Text: " + shortPreview(targets[0].preview);
        } else {
            message = "NormalFix will remediate " + targets.length + " selected Normal+ body paragraphs while preserving applied character styles.\n\n" +
                      "Red-family text will be assigned " + CLI_RED_BODY_STYLE + " before paragraph cleanup.\n\n" +
                      "Red-family runs detected: " + redRunCount;
        }

        if (ineligible > 0) {
            message += "\n\nSelected but ineligible rows that will be skipped: " + ineligible;
        }

        message += "\n\nTable paragraphs remain excluded. Paragraph cleanup uses paragraph-only override clearing.";

        if (!confirm(message + "\n\nContinue?")) {
            return;
        }

        fixRows(targets);
    }

    function fixRows(targets) {
        var fixedCount = 0;
        var skippedCount = 0;
        var failedCount = 0;
        var tableSkippedCount = 0;
        var redRunsProcessed = 0;
        var oldRedraw = null;
        var failureNotes = [];
        var i, row, para, outcome;

        status("Fixing " + targets.length + " selected Normal+ paragraph(s)...");

        try {
            oldRedraw = app.scriptPreferences.enableRedraw;
            app.scriptPreferences.enableRedraw = false;
        } catch (eRedraw) {}

        try {
            for (i = 0; i < targets.length; i++) {
                row = targets[i];
                para = row.paragraph;

                if (!valid(para)) {
                    skippedCount++;
                    continue;
                }

                if (isInsideTable(para)) {
                    skippedCount++;
                    tableSkippedCount++;
                    continue;
                }

                outcome = fixOneParagraph(row);
                redRunsProcessed += outcome.redRuns;

                if (outcome.status === "fixed") {
                    fixedCount++;
                } else if (outcome.status === "skipped") {
                    skippedCount++;
                } else {
                    failedCount++;
                    if (failureNotes.length < 5 && outcome.reason.length > 0) {
                        failureNotes.push(outcome.reason);
                    }
                }
            }
        } finally {
            if (oldRedraw !== null) {
                try {
                    app.scriptPreferences.enableRedraw = oldRedraw;
                } catch (eRestore) {}
            }
        }

        scan();

        alert("NormalFix selected remediation complete.\n\n" +
              "Corrected and verified: " + fixedCount + "\n" +
              "Skipped: " + skippedCount + "\n" +
              "Skipped because now inside a table: " + tableSkippedCount + "\n" +
              "Could not verify: " + failedCount + "\n" +
              "Red-family runs assigned " + CLI_RED_BODY_STYLE + ": " + redRunsProcessed +
              (failureNotes.length > 0 ? "\n\nFirst verification notes:\n" + failureNotes.join("\n") : "") +
              "\n\nThe document was rescanned. Review the changed paragraphs before saving the document.");
    }

    function fixOneParagraph(row) {
        var para = row.paragraph;
        var currentStyle;
        var currentOverride;
        var canonicalStyle;
        var redRuns;
        var charStyleAfterRed;
        var redAfterRed;
        var verification;
        var charStyleAfterFix;
        var redAfterFix;
        var reason = [];

        if (!valid(para)) {
            return {status: "skipped", reason: "Paragraph is no longer valid.", redRuns: 0};
        }

        if (isInsideTable(para)) {
            return {status: "skipped", reason: "Paragraph is now inside a table.", redRuns: 0};
        }

        currentStyle = paragraphStyleName(para);
        currentOverride = overrideState(para);

        if (currentStyle !== STYLE_NAME || currentOverride.value !== true) {
            return {status: "skipped", reason: "Paragraph no longer has verified Normal+ state.", redRuns: 0};
        }

        try {
            canonicalStyle = para.appliedParagraphStyle;
            if (!valid(canonicalStyle) || String(canonicalStyle.name) !== STYLE_NAME) {
                return {status: "skipped", reason: "Normal paragraph style could not be resolved.", redRuns: 0};
            }
        } catch (eStyle) {
            return {status: "skipped", reason: "Normal paragraph style could not be resolved.", redRuns: 0};
        }

        redRuns = findRedRuns(para);

        if (redRuns.length > 0) {
            cliRedBodyStyle = findCharacterStyle(app.activeDocument, CLI_RED_BODY_STYLE);
            if (cliRedBodyStyle === null) {
                return {status: "failed", reason: row.location + " - " + CLI_RED_BODY_STYLE + " could not be resolved.", redRuns: 0};
            }

            cliRedBodyColorStatus = characterStyleTargetColorStatus(cliRedBodyStyle);
            if (cliRedBodyColorStatus.indexOf("Mismatch") === 0) {
                return {status: "failed", reason: row.location + " - " + CLI_RED_BODY_STYLE + " RGB definition is mismatched.", redRuns: 0};
            }

            try {
                applyCharacterStyleToRuns(para, redRuns, cliRedBodyStyle);
            } catch (eRedStyle) {
                return {status: "failed", reason: row.location + " - Could not apply " + CLI_RED_BODY_STYLE + ": " + eRedStyle.message, redRuns: 0};
            }
        }

        // This is the preservation baseline. Red text has already been standardized,
        // while all other existing character-style assignments remain untouched.
        charStyleAfterRed = characterStyleSignature(para);
        redAfterRed = redPositionSignature(para);

        try {
            para.applyParagraphStyle(canonicalStyle, false);
            if (!clearParagraphOnlyOverrides(para)) {
                reason.push("Paragraph-only overrides could not be cleared.");
            }
        } catch (eFix) {
            reason.push("InDesign error while applying Normal: " + eFix.message);
        }

        verification = overrideState(para);
        charStyleAfterFix = characterStyleSignature(para);
        redAfterFix = redPositionSignature(para);

        if (paragraphStyleName(para) !== STYLE_NAME) {
            reason.push("Normal paragraph style could not be verified.");
        }

        if (verification.value !== false) {
            reason.push("A local override remains after paragraph-only cleanup.");
        }

        if (charStyleAfterRed !== charStyleAfterFix) {
            reason.push("Applied character-style assignments changed during paragraph cleanup.");
        }

        if (redAfterRed !== redAfterFix) {
            reason.push("Red character positions changed during paragraph cleanup.");
        }

        if (!allRedTextUsesCLIStyle(para)) {
            reason.push("One or more red-family characters do not use " + CLI_RED_BODY_STYLE + ".");
        }

        if (reason.length === 0) {
            return {status: "fixed", reason: "", redRuns: redRuns.length};
        }

        return {status: "failed", reason: row.location + " - " + reason.join(" "), redRuns: redRuns.length};
    }

    function clearParagraphOnlyOverrides(para) {
        try {
            para.clearOverrides(OverrideType.PARAGRAPH_ONLY);
            return true;
        } catch (eEnum) {}

        try {
            para.clearOverrides(PARAGRAPH_ONLY_OVERRIDE_VALUE);
            return true;
        } catch (eNumeric) {}

        return false;
    }

    function findRedRuns(para) {
        var runs = [];
        var chars;
        var i, ch, start = -1;
        var isRed;

        try {
            chars = para.characters;
            for (i = 0; i < chars.length; i++) {
                ch = chars.item(i);
                isRed = valid(ch) && isEligibleRedCharacter(ch);

                if (isRed && start < 0) {
                    start = i;
                } else if (!isRed && start >= 0) {
                    runs.push({from: start, to: i - 1});
                    start = -1;
                }
            }

            if (start >= 0) {
                runs.push({from: start, to: chars.length - 1});
            }
        } catch (eChars) {}

        return runs;
    }

    function isEligibleRedCharacter(ch) {
        var content = "";
        try { content = String(ch.contents); } catch (eContents) {}

        // Do not style the paragraph return. Styling it can affect subsequent typing.
        if (content === "\r" || content === "\n") {
            return false;
        }

        return isRedColor(safePropertyObject(ch, "fillColor"));
    }

    function applyCharacterStyleToRuns(para, runs, style) {
        var i, range;

        for (i = 0; i < runs.length; i++) {
            range = para.characters.itemByRange(runs[i].from, runs[i].to);
            range.applyCharacterStyle(style);
        }
    }

    function allRedTextUsesCLIStyle(para) {
        var chars;
        var i, ch;

        try {
            chars = para.characters;
            for (i = 0; i < chars.length; i++) {
                ch = chars.item(i);
                if (valid(ch) && isEligibleRedCharacter(ch) &&
                    appliedCharacterStyleName(ch) !== CLI_RED_BODY_STYLE) {
                    return false;
                }
            }
        } catch (eChars) {
            return false;
        }

        return true;
    }

    function characterStyleSignature(para) {
        var parts = [];
        var chars;
        var i, ch, key, current = null, run = 0;

        try {
            chars = para.characters;
            for (i = 0; i < chars.length; i++) {
                ch = chars.item(i);
                key = characterStyleKey(ch);

                if (current === null) {
                    current = key;
                    run = 1;
                } else if (key === current) {
                    run++;
                } else {
                    parts.push(current + "x" + run + ";");
                    current = key;
                    run = 1;
                }
            }

            if (current !== null) {
                parts.push(current + "x" + run + ";");
            }
        } catch (eChars) {}

        return parts.join("");
    }

    function characterStyleKey(ch) {
        var style;

        try {
            style = ch.appliedCharacterStyle;
            if (valid(style)) {
                return "ID" + String(style.id);
            }
            if (style !== null && style !== undefined && style.name !== undefined) {
                return "N" + String(style.name);
            }
        } catch (eStyle) {}

        return "?";
    }

    function appliedCharacterStyleName(ch) {
        try {
            return String(ch.appliedCharacterStyle.name);
        } catch (e) {
            return "<unknown>";
        }
    }

    function redPositionSignature(para) {
        var parts = [];
        var chars;
        var i, ch;

        try {
            chars = para.characters;
            for (i = 0; i < chars.length; i++) {
                ch = chars.item(i);
                if (valid(ch) && isEligibleRedCharacter(ch)) {
                    parts.push(String(i));
                }
            }
        } catch (eChars) {}

        return parts.join("|");
    }

    function isRedColor(color) {
        var name = swatchName(color).toLowerCase();
        var rgb;
        var r, g, b;
        var max, min, delta, sat, hue;

        // Named red swatches are accepted even when color conversion is unavailable.
        if (name.indexOf("red") >= 0) {
            return true;
        }

        rgb = colorToRGB(color);
        if (rgb === null) {
            return false;
        }

        r = rgb[0] / 255;
        g = rgb[1] / 255;
        b = rgb[2] / 255;

        max = Math.max(r, g, b);
        min = Math.min(r, g, b);
        delta = max - min;

        if (max < 0.12 || delta <= 0) {
            return false;
        }

        sat = delta / max;
        if (sat < 0.30 || r <= g || r <= b) {
            return false;
        }

        if (max === r) {
            hue = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            hue = 60 * (((b - r) / delta) + 2);
        } else {
            hue = 60 * (((r - g) / delta) + 4);
        }

        if (hue < 0) {
            hue += 360;
        }

        // A broad red-family window captures dark, bright, muted, and pinkish reds
        // while avoiding most oranges, purples, browns, and neutral colors.
        return hue <= 20 || hue >= 340;
    }

    function colorToRGB(color) {
        var values;
        var space;
        var converted;

        if (color === null || color === undefined) {
            return null;
        }

        try {
            values = color.colorValue;
            space = color.space;
        } catch (eColor) {
            return null;
        }

        try {
            if (space === ColorSpace.RGB && values.length >= 3) {
                return [Number(values[0]), Number(values[1]), Number(values[2])];
            }
        } catch (eDirect) {}

        try {
            converted = app.colorTransform(values, space, ColorSpace.RGB);
            if (converted !== null && converted !== undefined && converted.length >= 3) {
                return [Number(converted[0]), Number(converted[1]), Number(converted[2])];
            }
        } catch (eTransform) {}

        return null;
    }

    function characterStyleTargetColorStatus(style) {
        var rgb;
        var dr, dg, db;

        if (style === null || !valid(style)) {
            return "Missing";
        }

        rgb = colorToRGB(safePropertyObject(style, "fillColor"));
        if (rgb === null) {
            return "Unknown";
        }

        dr = Math.abs(rgb[0] - TARGET_RED_R);
        dg = Math.abs(rgb[1] - TARGET_RED_G);
        db = Math.abs(rgb[2] - TARGET_RED_B);

        if (dr <= 5 && dg <= 5 && db <= 5) {
            return "Match";
        }

        return "Mismatch (" +
               Math.round(rgb[0]) + "," +
               Math.round(rgb[1]) + "," +
               Math.round(rgb[2]) + ")";
    }

    function findCharacterStyle(doc, name) {
        var all;
        var matches = [];
        var i, style;

        try {
            all = doc.allCharacterStyles;
            for (i = 0; i < all.length; i++) {
                style = all[i];
                if (valid(style) && String(style.name) === name) {
                    matches.push(style);
                }
            }
        } catch (eAll) {}

        if (matches.length === 1) {
            return matches[0];
        }

        return null;
    }

    function swatchName(swatch) {
        try {
            return String(swatch.name);
        } catch (e) {
            try { return String(swatch); } catch (e2) { return ""; }
        }
    }

    function safePropertyObject(obj, name) {
        try {
            return obj[name];
        } catch (e) {
            return null;
        }
    }

    function shortPreview(value) {
        var s = String(value);
        if (s.length > 180) {
            s = s.substring(0, 177) + "...";
        }
        return s;
    }

    function isFixableFinding(row) {
        return row !== null &&
               row !== undefined &&
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

        if (target === null) {
            return;
        }

        if (!/\.csv$/i.test(target.name)) {
            target = new File(target.fsName + ".csv");
        }

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
            if (a.pageSort !== b.pageSort) {
                return a.pageSort - b.pageSort;
            }
            if (String(a.storyId) !== String(b.storyId)) {
                return numericOrTextCompare(a.storyId, b.storyId);
            }
            return numericOrTextCompare(a.paragraphIndex, b.paragraphIndex);
        });
    }

    function numericOrTextCompare(a, b) {
        var na = Number(a);
        var nb = Number(b);

        if (!isNaN(na) && !isNaN(nb)) {
            return na - nb;
        }

        a = String(a);
        b = String(b);

        if (a < b) { return -1; }
        if (a > b) { return 1; }
        return 0;
    }

    function previewText(value) {
        var s = String(value).replace(/\u00A0/g, " ");

        s = s.replace(/[\r\n\t]+/g, " ");
        s = s.replace(/  +/g, " ");
        s = s.replace(/^ +/, "").replace(/ +$/, "");

        if (s.length === 0) {
            return "<empty paragraph>";
        }

        if (s.length > 140) {
            s = s.substring(0, 137) + "...";
        }

        return s;
    }

    function paragraphStyleName(para) {
        try {
            return String(para.appliedParagraphStyle.name);
        } catch (e) {
            return "<unknown>";
        }
    }

    function safeContents(para) {
        try {
            return para.contents;
        } catch (e) {
            return "";
        }
    }

    function valid(obj) {
        try {
            return obj !== null && obj.isValid === true;
        } catch (e) {
            return false;
        }
    }

    function property(obj, name, fallback) {
        try {
            return String(obj[name]);
        } catch (e) {
            return fallback;
        }
    }

    function overrideText(value) {
        if (value === true) { return "Yes"; }
        if (value === false) { return "No"; }
        if (value === null) { return "Unknown"; }
        return String(value);
    }

    function fixed(value, width) {
        var s = String(value);

        while (s.length < width) {
            s += " ";
        }

        if (s.length > width) {
            s = s.substring(0, width - 3) + "...";
        }

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
            if (doc.saved && doc.filePath && doc.filePath.exists) {
                folder = doc.filePath;
            }
        } catch (e) {}

        return new File(folder.fsName + "/" + name);
    }

    function docName(doc) {
        try {
            return String(doc.name);
        } catch (e) {
            return "Active document";
        }
    }

    function baseName(doc) {
        return docName(doc)
            .replace(/\.indd$/i, "")
            .replace(/[\\\/:*?"<>|]/g, "_");
    }

    function timestamp() {
        var d = new Date();

        return d.getFullYear() +
               two(d.getMonth() + 1) +
               two(d.getDate()) + "-" +
               two(d.getHours()) +
               two(d.getMinutes()) +
               two(d.getSeconds());
    }

    function two(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function status(text) {
        ui.status.text = text;
        try {
            ui.win.update();
        } catch (e) {}
    }

    function errorLine(err) {
        try {
            return err.line;
        } catch (e) {
            return "?";
        }
    }
}());
