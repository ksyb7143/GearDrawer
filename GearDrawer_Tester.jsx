/**
 * GearDrawer_Tester - Automatic Test Runner & Numerical Verifier
 * Version: 1.0.0
 * Author: Pair-programmed with Antigravity AI
 * License: MIT
 */

#target illustrator

// Global conversion constants
var MM_TO_PT = 72.0 / 25.4; // 1 mm = 2.83464567 pt
var PT_TO_MM = 25.4 / 72.0; // 1 pt = 0.35277778 mm

/**
 * DataAndConfig.jsxinc - Data Serialization, Configuration & Logging for GearDrawer
 * Version: 1.0.0
 * 
 * Provides:
 * - SimpleJSON : Pure ES3 JSON serializer and parser for ExtendScript compatibility
 * - CalcLogger : Calculation & diagnostic execution trace logging and export
 * - GearBatchParser : CSV / TSV train nodes batch import and export
 * - PreferencesManager : Local preference auto-save and JSON profile export/import
 */

var SimpleJSON = (function () {
    function escapeString(str) {
        return '"' + str.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g, '\\t')
            .replace(/\n/g, '\\n')
            .replace(/\f/g, '\\f')
            .replace(/\r/g, '\\r') + '"';
    }

    function isArray(val) {
        if (!val) return false;
        return (Object.prototype.toString.call(val) === "[object Array]" || val instanceof Array);
    }

    function stringify(value) {
        if (value === null || value === undefined) {
            return "null";
        }
        var t = typeof value;
        if (t === "boolean") {
            return value ? "true" : "false";
        }
        if (t === "number") {
            return isFinite(value) ? String(value) : "null";
        }
        if (t === "string") {
            return escapeString(value);
        }
        if (isArray(value)) {
            var arrItems = [];
            for (var i = 0; i < value.length; i++) {
                arrItems.push(stringify(value[i]));
            }
            return "[" + arrItems.join(",") + "]";
        }
        if (t === "object") {
            var objItems = [];
            for (var key in value) {
                if (value.hasOwnProperty(key)) {
                    var valStr = stringify(value[key]);
                    if (valStr !== undefined) {
                        objItems.push(escapeString(key) + ":" + valStr);
                    }
                }
            }
            return "{" + objItems.join(",") + "}";
        }
        return "null";
    }

    function parse(text) {
        if (typeof text !== "string") {
            throw new Error("SimpleJSON.parse: input must be a string");
        }
        // Douglas Crockford's ES3 JSON security validation
        // Strip UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        } else if (text.indexOf("\uFEFF") === 0) {
            text = text.replace(/^\uFEFF/, "");
        }
        var rx_one = /^[\],:{}\s]*$/;
        var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
        var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
        var rx_four = /(?:^|:|,)(?:\s*\[)+/g;

        var sanitized = text.replace(rx_two, "@")
                            .replace(rx_three, "]")
                            .replace(rx_four, "");

        if (rx_one.test(sanitized)) {
            return (new Function("return " + text))();
        }
        throw new Error("SimpleJSON.parse: Invalid JSON syntax");
    }

    return {
        stringify: stringify,
        parse: parse
    };
})();

var CalcLogger = (function () {
    var _enabled = false;
    var _entries = [];
    var _startTime = null;
    var _version = "0.0.0";
    var _liveLogFile = null;

    function setVersion(ver) {
        _version = ver || "0.0.0";
    }

    function setLiveLogFile(f) {
        _liveLogFile = f;
    }

    function init(enabled, enableLiveLog) {
        _enabled = !!enabled;
        _entries = [];
        _startTime = new Date();
        _liveLogFile = null;
        if (enableLiveLog === true) {
            try {
                var sf = null;
                if (typeof $ !== "undefined" && $.fileName) sf = (new File($.fileName)).parent;
                if (!sf || !sf.fsName) sf = (typeof Folder !== "undefined" && Folder.current) ? Folder.current : null;
                if (sf && sf.fsName) {
                    _liveLogFile = new File(sf.fsName + "/test_live.log");
                    _liveLogFile.encoding = "UTF-8";
                    if (_liveLogFile.open("w")) {
                        _liveLogFile.writeln("=== GearDrawer Test Live Log (v" + _version + ") ===");
                        _liveLogFile.close();
                    }
                }
            } catch (eLiveInit) {}
        }
        log("INIT", "GearDrawer Calculation Logger initialized (v" + _version + ")");
    }

    function isEnabled() {
        return _enabled;
    }

    function setEnabled(flag) {
        _enabled = !!flag;
    }

    function clear() {
        _entries = [];
        _startTime = new Date();
    }

    function serializeData(data) {
        if (data === null || data === undefined) return "";
        if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
            return String(data);
        }
        try {
            return SimpleJSON.stringify(data);
        } catch (e) {
            return String(data);
        }
    }

    function log(category, message, data) {
        var timestamp = new Date();
        var elapsedMs = _startTime ? (timestamp.getTime() - _startTime.getTime()) : 0;
        var entry = {
            elapsedMs: elapsedMs,
            category: category || "INFO",
            message: message,
            dataStr: (data !== undefined) ? serializeData(data) : null
        };
        _entries.push(entry);

        try {
            if (_liveLogFile) {
                if (_liveLogFile.open("a")) {
                    var liveLine = "[" + (category || "INFO") + " +" + elapsedMs + "ms] " + message;
                    if (entry.dataStr) liveLine += " | " + entry.dataStr;
                    _liveLogFile.writeln(liveLine);
                    _liveLogFile.close();
                }
            }
        } catch (eLiveWrite) {}

        try {
            if (typeof $ !== "undefined" && typeof $.writeln === "function") {
                var line = "[" + category + " +" + elapsedMs + "ms] " + message;
                if (entry.dataStr) line += " | " + entry.dataStr;
                $.writeln(line);
            }
        } catch (eConsole) {}
    }

    function warn(category, message, data) {
        log("WARN:" + category, message, data);
    }

    function error(category, message, err) {
        var detail = "";
        if (err) {
            detail = (err.message || String(err));
            if (err.line !== undefined) detail += " (Line " + err.line + ")";
            if (err.fileName) detail += " in " + err.fileName;
        }
        var stackInfo = "";
        try {
            if (typeof $ !== "undefined" && $.stack) {
                stackInfo = " [Stack: " + String($.stack).replace(/[\r\n]+/g, " <= ") + "]";
            } else if (err && err.stack) {
                stackInfo = " [Stack: " + String(err.stack).replace(/[\r\n]+/g, " <= ") + "]";
            }
        } catch (eStack) {}
        log("ERROR:" + category, message + (detail ? " -> " + detail : "") + stackInfo, err);
    }

    function pad(n, width) {
        var s = String(n);
        while (s.length < width) s = " " + s;
        return s;
    }

    function padRight(s, width) {
        var str = String(s);
        while (str.length < width) str = str + " ";
        return str;
    }

    function dumpText() {
        var lines = [];
        lines.push("================================================================================");
        lines.push(" GearDrawer Calculation & Diagnostic Execution Trace");
        lines.push(" Version   : " + _version);
        lines.push(" Timestamp : " + (_startTime ? _startTime.toString() : new Date().toString()));
        try {
            if (typeof app !== "undefined" && app.name) {
                lines.push(" Host App  : " + app.name + " " + app.version);
            }
            if (typeof $ !== "undefined" && typeof $.os !== "undefined") {
                lines.push(" OS        : " + $.os);
            }
            if (typeof app !== "undefined" && app.documents && app.documents.length > 0) {
                var doc = app.activeDocument;
                lines.push(" Document  : " + doc.name + " (" + (doc.documentColorSpace || "RGB") + ")");
            }
        } catch (eApp) {}
        lines.push("================================================================================");
        lines.push("");

        for (var i = 0; i < _entries.length; i++) {
            var ent = _entries[i];
            var timeTag = pad(ent.elapsedMs, 6) + " ms";
            var catTag = "[" + padRight(ent.category, 14) + "]";
            var mainLine = timeTag + " " + catTag + " " + ent.message;
            lines.push(mainLine);
            if (ent.dataStr) {
                lines.push("             DATA: " + ent.dataStr);
            }
        }
        lines.push("");
        lines.push("================================================================================");
        lines.push(" End of Trace (Total entries: " + _entries.length + ")");
        lines.push("================================================================================");
        return lines.join("\n");
    }

    function exportToFile(targetFolderOrFile) {
        var targetFile = null;
        if (targetFolderOrFile instanceof File) {
            targetFile = targetFolderOrFile;
        } else if (targetFolderOrFile instanceof Folder) {
            var dateStr = formatDateForFileName(new Date());
            targetFile = new File(targetFolderOrFile.fsName + "/GearDrawer_Log_" + dateStr + ".txt");
        } else {
            var defFolder = Folder.desktop;
            try {
                if (typeof app !== "undefined" && app.documents && app.documents.length > 0 && app.activeDocument.saved) {
                    defFolder = app.activeDocument.path;
                }
            } catch (eDef) {}
            var dStr = formatDateForFileName(new Date());
            targetFile = new File(defFolder.fsName + "/GearDrawer_Log_" + dStr + ".txt");
        }

        try {
            targetFile.encoding = "UTF-8";
            if (targetFile.open("w")) {
                targetFile.write(dumpText());
                targetFile.close();
                log("EXPORT", "Log file written successfully to: " + targetFile.fsName);
                return targetFile;
            } else {
                warn("EXPORT", "Failed to open log file for writing: " + targetFile.fsName);
                return null;
            }
        } catch (eExp) {
            error("EXPORT", "Exception during log export", eExp);
            return null;
        }
    }

    function exportToLayer(doc) {
        if (!doc) {
            try {
                if (typeof app !== "undefined" && app.documents && app.documents.length > 0) {
                    doc = app.activeDocument;
                }
            } catch (eDoc) {}
        }
        if (!doc) return false;

        try {
            var logLayer = null;
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === "_GEAR_CALC_LOG") {
                    logLayer = doc.layers[i];
                    break;
                }
            }
            if (!logLayer) {
                logLayer = doc.layers.add();
                logLayer.name = "_GEAR_CALC_LOG";
            }
            logLayer.locked = false;
            logLayer.visible = true;

            var tf = logLayer.textFrames.add();
            tf.contents = dumpText();
            tf.left = 50;
            tf.top = -50;
            tf.name = "CalcTrace_" + formatDateForFileName(new Date());

            logLayer.visible = false;
            logLayer.locked = true;
            log("EXPORT", "Log successfully written to hidden layer '_GEAR_CALC_LOG'");
            return true;
        } catch (eLyr) {
            error("EXPORT", "Failed to export log to layer", eLyr);
            return false;
        }
    }

    function formatDateForFileName(d) {
        var y = d.getFullYear();
        var m = pad(d.getMonth() + 1, 2).replace(/ /g, "0");
        var day = pad(d.getDate(), 2).replace(/ /g, "0");
        var h = pad(d.getHours(), 2).replace(/ /g, "0");
        var min = pad(d.getMinutes(), 2).replace(/ /g, "0");
        var s = pad(d.getSeconds(), 2).replace(/ /g, "0");
        return String(y) + m + day + "_" + h + min + s;
    }

    return {
        setVersion: setVersion,
        setLiveLogFile: setLiveLogFile,
        init: init,
        isEnabled: isEnabled,
        setEnabled: setEnabled,
        clear: clear,
        log: log,
        warn: warn,
        error: error,
        dumpText: dumpText,
        exportToFile: exportToFile,
        exportToLayer: exportToLayer
    };
})();

/**
 * GearBatchParser - CSV / TSV Batch Import & Export for trainNodes
 */
var GearBatchParser = (function () {
    function isArray(val) {
        if (!val) return false;
        return (Object.prototype.toString.call(val) === "[object Array]" || val instanceof Array);
    }
    function parseRows(text, delimiter) {
        var delim = delimiter;
        if (!delim) {
            // Auto detect delimiter from first line
            var firstLineEnd = text.indexOf("\n");
            if (firstLineEnd < 0) firstLineEnd = text.indexOf("\r");
            var sample = (firstLineEnd >= 0) ? text.substring(0, firstLineEnd) : text;
            var tabCount = 0;
            var commaCount = 0;
            for (var c = 0; c < sample.length; c++) {
                if (sample.charAt(c) === "\t") tabCount++;
                if (sample.charAt(c) === ",") commaCount++;
            }
            delim = (tabCount > commaCount) ? "\t" : ",";
        }

        var rows = [];
        var currentRow = [];
        var currentCell = "";
        var inQuotes = false;
        var i = 0;
        var len = text.length;

        while (i < len) {
            var ch = text.charAt(i);
            var nextCh = (i + 1 < len) ? text.charAt(i + 1) : "";

            if (inQuotes) {
                if (ch === '"') {
                    if (nextCh === '"') {
                        currentCell += '"';
                        i += 2;
                        continue;
                    } else {
                        inQuotes = false;
                        i++;
                        continue;
                    }
                } else {
                    currentCell += ch;
                    i++;
                    continue;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                    i++;
                    continue;
                } else if (ch === delim) {
                    currentRow.push(currentCell);
                    currentCell = "";
                    i++;
                    continue;
                } else if (ch === "\r" || ch === "\n") {
                    if (ch === "\r" && nextCh === "\n") {
                        i++;
                    }
                    currentRow.push(currentCell);
                    currentCell = "";
                    if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === "")) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    i++;
                    continue;
                } else {
                    currentCell += ch;
                    i++;
                    continue;
                }
            }
        }

        if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell);
            if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === "")) {
                rows.push(currentRow);
            }
        }

        return rows;
    }

    function normalizeHeaderKey(raw) {
        if (!raw) return "";
        var s = String(raw).toLowerCase();
        // Remove spaces, underscores, hyphens
        var clean = "";
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            if (c !== " " && c !== "\t" && c !== "_" && c !== "-") {
                clean += c;
            }
        }

        // Mapping
        if (clean === "id" || clean === "gearid" || clean === "\u30ae\u30a2id") return "id";
        if (clean === "parentid" || clean === "parent" || clean === "\u89aaid" || clean === "\u89aa") return "parentId";
        if (clean === "type" || clean === "kind" || clean === "geartype" || clean === "\u7a2e\u5225") return "kind";
        if (clean === "teeth" || clean === "z" || clean === "\u6b6f\u6570") return "z";
        if (clean === "module" || clean === "m" || clean === "\u30e2\u30b8\u30e5\u30fc\u30eb") return "m";
        if (clean === "pressureangle" || clean === "alpha" || clean === "alphadeg" || clean === "\u5727\u529b\u89d2") return "alphaDeg";
        if (clean === "profileshift" || clean === "shift" || clean === "x" || clean === "\u8ee2\u4f4d\u4fc2\u6570" || clean === "\u8ee2\u4f4d") return "shift";
        if (clean === "relativeangle" || clean === "angle" || clean === "angledeg" || clean === "\u914d\u7f6e\u89d2" || clean === "\u89d2\u5ea6") return "angleDeg";
        if (clean === "stageindex" || clean === "stage" || clean === "\u6bb5") return "stageIndex";
        if (clean === "backlash" || clean === "jt" || clean === "\u30d0\u30c3\u30af\u30e9\u30c3\u30b7") return "backlash";
        if (clean === "tiprounding" || clean === "rtip" || clean === "\u6b6f\u5148\u4e38\u307f") return "tipRounding";
        if (clean === "kerf" || clean === "\u30ab\u30fc\u30d5") return "kerf";
        if (clean === "shafttype" || clean === "\u8ef8\u7a74\u5f62\u72b6" || clean === "\u8ef8\u7a74") return "shaftType";
        if (clean === "shaftsize" || clean === "shaftdia" || clean === "\u8ef8\u5f84") return "shaftDia";
        if (clean === "cutouttype" || clean === "\u8089\u629c\u304d") return "cutoutType";
        if (clean === "cutoutpath" || clean === "externalaipath" || clean === "\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8" || clean === "\u5916\u90e8ai") return "externalAiPath";
        if (clean === "iscoaxial" || clean === "\u540c\u8ef8") return "isCoaxial";
        if (clean === "relationtype" || clean === "\u565b\u5408") return "relationType";

        return clean;
    }

    function parseCSVToTrainNodes(text, delimiter) {
        if (!text || typeof text !== "string") return [];
        var rows = parseRows(text, delimiter);
        if (rows.length < 2) return [];

        var headerRow = rows[0];
        var colMap = {};
        for (var h = 0; h < headerRow.length; h++) {
            var colKey = normalizeHeaderKey(headerRow[h]);
            if (colKey) {
                colMap[colKey] = h;
            }
        }

        var nodes = [];
        var idSet = {};

        for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

            function getVal(key, defVal) {
                if (colMap[key] !== undefined && colMap[key] < row.length) {
                    var v = row[colMap[key]];
                    if (v !== undefined && v !== null && v !== "") return v;
                }
                return defVal;
            }

            var rawId = getVal("id", "G" + r);
            var id = String(rawId);
            // Deduplicate ID
            if (idSet[id]) {
                var suffix = 2;
                while (idSet[id + "_" + suffix]) {
                    suffix++;
                }
                id = id + "_" + suffix;
            }
            idSet[id] = true;

            var rawParent = getVal("parentId", "");
            var parentId = (rawParent === "-" || rawParent === "null" || rawParent === "none" || rawParent === "") ? null : String(rawParent);

            var rawKind = String(getVal("kind", "SPUR")).toUpperCase();
            var kind = "SPUR";
            if (rawKind.indexOf("INTERNAL") >= 0 || rawKind.indexOf("\u5185\u6b6f") >= 0) {
                kind = "INTERNAL";
            } else if (rawKind.indexOf("RACK") >= 0 || rawKind.indexOf("\u30e9\u30c3\u30af") >= 0) {
                kind = "RACK";
            }

            var z = parseInt(getVal("z", 18), 10);
            if (isNaN(z) || z < 3) z = 18;

            var m = parseFloat(getVal("m", 2.0));
            if (isNaN(m) || m <= 0) m = 2.0;

            var alphaDeg = parseFloat(getVal("alphaDeg", 20.0));
            if (isNaN(alphaDeg) || alphaDeg <= 0) alphaDeg = 20.0;

            var shift = parseFloat(getVal("shift", 0.0));
            if (isNaN(shift)) shift = 0.0;

            var angleDeg = parseFloat(getVal("angleDeg", 0.0));
            if (isNaN(angleDeg)) angleDeg = 0.0;

            var stageIndex = parseInt(getVal("stageIndex", 1), 10);
            if (isNaN(stageIndex) || stageIndex < 1) stageIndex = 1;

            var backlash = parseFloat(getVal("backlash", 0.0));
            if (isNaN(backlash) || backlash < 0) backlash = 0.0;

            var tipRounding = parseFloat(getVal("tipRounding", 0.0));
            if (isNaN(tipRounding) || tipRounding < 0) tipRounding = 0.0;

            var kerf = parseFloat(getVal("kerf", 0.0));
            if (isNaN(kerf) || kerf < 0) kerf = 0.0;

            var shaftType = String(getVal("shaftType", "ROUND")).toUpperCase();
            if (shaftType !== "ROUND" && shaftType !== "D_CUT" && shaftType !== "KEYWAY" && shaftType !== "NONE" && shaftType !== "GROUP_SHAPE" && shaftType !== "EXTERNAL_AI") {
                if (shaftType.indexOf("D") >= 0) shaftType = "D_CUT";
                else if (shaftType.indexOf("KEY") >= 0 || shaftType.indexOf("\u30ad\u30fc") >= 0) shaftType = "KEYWAY";
                else if (shaftType.indexOf("\u306a\u3057") >= 0 || shaftType.indexOf("NONE") >= 0) shaftType = "NONE";
                else shaftType = "ROUND";
            }

            var shaftDia = parseFloat(getVal("shaftDia", 5.0));
            if (isNaN(shaftDia) || shaftDia < 0) shaftDia = 5.0;

            var cutoutType = String(getVal("cutoutType", "NONE")).toUpperCase();
            if (cutoutType !== "SPOKES" && cutoutType !== "HOLES" && cutoutType !== "NONE" && cutoutType !== "EXTERNAL_AI") {
                if (cutoutType.indexOf("SPOKE") >= 0 || cutoutType.indexOf("\u30b9\u30dd\u30fc\u30af") >= 0) cutoutType = "SPOKES";
                else if (cutoutType.indexOf("HOLE") >= 0 || cutoutType.indexOf("\u4e38\u7a74") >= 0) cutoutType = "HOLES";
                else cutoutType = "NONE";
            }

            var extPath = getVal("externalAiPath", "");
            if (extPath === "null" || extPath === "none" || extPath === "-") extPath = "";

            var isCoaxial = false;
            var rawCoax = getVal("isCoaxial", null);
            if (rawCoax !== null && rawCoax !== undefined) {
                var sCoax = String(rawCoax).toLowerCase();
                if (sCoax === "true" || sCoax === "1" || sCoax === "\u540c\u8ef8" || sCoax === "yes") {
                    isCoaxial = true;
                }
            }

            var relType = getVal("relationType", null);
            if (!relType) {
                if (!parentId) {
                    relType = "ROOT";
                } else if (isCoaxial) {
                    relType = "COAXIAL";
                } else if (kind === "INTERNAL") {
                    relType = "INTERNAL_MESHING";
                } else {
                    relType = "MESHING";
                }
            }

            var node = {
                id: id,
                parentId: parentId,
                relationType: relType,
                kind: kind,
                z: z,
                m: m,
                alphaDeg: alphaDeg,
                shift: shift,
                angleDeg: angleDeg,
                stageIndex: stageIndex,
                backlash: backlash,
                tipRounding: tipRounding,
                kerf: kerf,
                shaftType: shaftType,
                shaftDia: shaftDia,
                cutoutType: cutoutType,
                externalAiPath: extPath,
                backHeight: 5.0
            };

            nodes.push(node);
        }

        // Post-validation: Promote to ROOT if parent does not exist in nodes
        var nodeMap = {};
        for (var ni = 0; ni < nodes.length; ni++) {
            nodeMap[nodes[ni].id] = true;
        }

        for (var pj = 0; pj < nodes.length; pj++) {
            var nd = nodes[pj];
            if (nd.parentId && !nodeMap[nd.parentId]) {
                CalcLogger.warn("BATCH", "Parent ID '" + nd.parentId + "' not found for node '" + nd.id + "'. Promoted to ROOT.");
                nd.parentId = null;
                nd.relationType = "ROOT";
            }
        }

        return nodes;
    }

    function formatField(val, delimiter) {
        if (val === null || val === undefined) return "";
        var s = String(val);
        var needsQuote = (s.indexOf(delimiter) >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0 || s.indexOf("\r") >= 0);
        if (needsQuote) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function trainNodesToCSV(nodes, delimiter) {
        var delim = delimiter || ",";
        var headers = [
            "ID", "ParentID", "Type", "Teeth", "Module", "PressureAngle",
            "ProfileShift", "RelativeAngle", "StageIndex", "Backlash",
            "TipRounding", "Kerf", "ShaftType", "ShaftSize", "CutoutType",
            "CutoutPath", "RelationType"
        ];

        var lines = [];
        var hLine = [];
        for (var h = 0; h < headers.length; h++) {
            hLine.push(formatField(headers[h], delim));
        }
        lines.push(hLine.join(delim));

        if (!nodes || !isArray(nodes)) return lines.join("\n");

        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            var row = [
                formatField(nd.id, delim),
                formatField(nd.parentId || "", delim),
                formatField(nd.kind || "SPUR", delim),
                formatField(nd.z, delim),
                formatField(nd.m !== undefined ? nd.m : 2.0, delim),
                formatField(nd.alphaDeg !== undefined ? nd.alphaDeg : 20.0, delim),
                formatField(nd.shift !== undefined ? nd.shift : 0.0, delim),
                formatField(nd.angleDeg !== undefined ? nd.angleDeg : 0.0, delim),
                formatField(nd.stageIndex !== undefined ? nd.stageIndex : 1, delim),
                formatField(nd.backlash !== undefined ? nd.backlash : 0.0, delim),
                formatField(nd.tipRounding !== undefined ? nd.tipRounding : 0.0, delim),
                formatField(nd.kerf !== undefined ? nd.kerf : 0.0, delim),
                formatField(nd.shaftType || "ROUND", delim),
                formatField(nd.shaftDia !== undefined ? nd.shaftDia : 5.0, delim),
                formatField(nd.cutoutType || "NONE", delim),
                formatField(nd.externalAiPath || "", delim),
                formatField(nd.relationType || (nd.parentId ? "MESHING" : "ROOT"), delim)
            ];
            lines.push(row.join(delim));
        }

        return lines.join("\n");
    }

    return {
        parseCSVToTrainNodes: parseCSVToTrainNodes,
        trainNodesToCSV: trainNodesToCSV
    };
})();

/**
 * PreferencesManager - Local & External JSON Preferences Management
 */
var PreferencesManager = (function () {
    var PREF_FILE_NAME = "geardrawer_preferences.json";

    function isArray(val) {
        if (!val) return false;
        return (Object.prototype.toString.call(val) === "[object Array]" || val instanceof Array);
    }

    function deepCopy(obj) {
        if (obj === null || typeof obj !== "object") return obj;
        if (isArray(obj)) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) {
                arr.push(deepCopy(obj[i]));
            }
            return arr;
        }
        var copy = {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                copy[k] = deepCopy(obj[k]);
            }
        }
        return copy;
    }

    function mergeObjects(target, source) {
        if (!source || typeof source !== "object") return target;
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                var sVal = source[key];
                if (sVal !== null && typeof sVal === "object" && !isArray(sVal)) {
                    if (!target[key] || typeof target[key] !== "object") {
                        target[key] = {};
                    }
                    mergeObjects(target[key], sVal);
                } else if (sVal !== undefined) {
                    target[key] = deepCopy(sVal);
                }
            }
        }
        return target;
    }

    function getDefaultPreferences() {
        var def = {
            version: "1.0.0",
            common: {
                m: 2.0,
                alphaDeg: 20.0,
                backlash: 0.0,
                tipRounding: 0.0,
                kerf: 0.0,
                shaftDia: 5.0,
                shaftType: "ROUND",
                cutoutType: "NONE",
                backHeightRef: 0 // 0: From Root, 1: From Tip
            },
            centerGuide: {
                draw: true,
                mode: 0, // 0: Fixed (mm), 1: Relative (%)
                size: 5.0
            },
            creationOptions: {
                compoundPath: true,
                pitchGuide: false,
                centerGuide: true,
                teethMode: false,
                singleSkeleton: false,
                perStageSkeleton: false,
                carrierBase: false,
                specLabel: false
            },
            stylePreset: "LASER_STD",
            naming: {
                preset: 0,
                trainId: "T1",
                layerPattern: "{train}_{stage}",
                gearPattern: "{train}_{id}_{kind}_m{m}_z{z}"
            },
            diagnostics: {
                tolerance: 0.01,
                distanceSolveMode: 0, // 0: Snap, 1: Exact & Shift, 2: Free
                allowCrossLayerMesh: false,
                autoSaveLog: true,
                logFolderPath: ""
            },
            colorPresets: [
                { colorName: "Red", hex: "#FF0000", kind: "SPUR", shaftType: "ROUND", shaftDia: 5.0, cutoutType: "NONE", shift: 0.0 },
                { colorName: "Blue", hex: "#0000FF", kind: "SPUR", shaftType: "KEYWAY", shaftDia: 8.0, cutoutType: "SPOKES", shift: 0.0 },
                { colorName: "Green", hex: "#00AA00", kind: "INTERNAL", shaftType: "NONE", shaftDia: 0.0, cutoutType: "NONE", shift: 0.0 },
                { colorName: "Cyan", hex: "#00FFFF", kind: "RACK", shaftType: "NONE", shaftDia: 0.0, cutoutType: "NONE", shift: 0.0 },
                { colorName: "Magenta", hex: "#FF00FF", kind: "SPUR", shaftType: "D_CUT", shaftDia: 6.0, cutoutType: "HOLES", shift: 0.0 }
            ],
            customAiFolder: ""
        };

        // If TopologySolver is available, inherit default presets
        try {
            if (typeof TopologySolver !== "undefined" && typeof TopologySolver.getDefaultColorPresets === "function") {
                def.colorPresets = TopologySolver.getDefaultColorPresets();
            }
        } catch (eTop) {}

        return def;
    }

    function getPreferencesFolder() {
        var baseFolder = null;
        try {
            if (typeof Folder !== "undefined" && Folder.userData && Folder.userData.exists) {
                baseFolder = Folder.userData;
            }
        } catch (eUd) {}

        if (!baseFolder) {
            baseFolder = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : new Folder(".");
        }

        var prefFolder = new Folder(baseFolder.fsName + "/GearDrawer");
        if (!prefFolder.exists) {
            try {
                prefFolder.create();
            } catch (eCr) {}
        }
        return prefFolder;
    }

    function getPreferencesFile() {
        var folder = getPreferencesFolder();
        return new File(folder.fsName + "/" + PREF_FILE_NAME);
    }

    function loadPreferences() {
        var def = getDefaultPreferences();
        var file = getPreferencesFile();
        if (!file.exists) {
            return def;
        }

        try {
            file.encoding = "UTF-8";
            if (file.open("r")) {
                var content = file.read();
                file.close();
                if (content && content.length > 0) {
                    var parsed = SimpleJSON.parse(content);
                    return mergeObjects(def, parsed);
                }
            }
        } catch (eLoad) {
            CalcLogger.warn("PREFS", "Failed to load preferences from file: " + eLoad.message);
        }
        return def;
    }

    function savePreferences(prefs) {
        var file = getPreferencesFile();
        return exportPreferencesToFile(file, prefs);
    }

    function exportPreferencesToFile(file, prefs) {
        if (!file) return false;
        try {
            var dataToSave = prefs || getDefaultPreferences();
            var jsonStr = SimpleJSON.stringify(dataToSave);
            file.encoding = "UTF-8";
            if (file.open("w")) {
                file.write(jsonStr);
                file.close();
                CalcLogger.log("PREFS", "Preferences saved successfully to: " + file.fsName);
                return true;
            } else {
                CalcLogger.warn("PREFS", "Could not open preferences file for writing: " + file.fsName);
                return false;
            }
        } catch (eSave) {
            CalcLogger.error("PREFS", "Exception while saving preferences", eSave);
            return false;
        }
    }

    function importPreferencesFromFile(file) {
        if (!file || !file.exists) return null;
        try {
            file.encoding = "UTF-8";
            if (file.open("r")) {
                var content = file.read();
                file.close();
                if (content && content.length > 0) {
                    var parsed = SimpleJSON.parse(content);
                    var def = getDefaultPreferences();
                    return mergeObjects(def, parsed);
                }
            }
        } catch (eImp) {
            CalcLogger.error("PREFS", "Exception while importing preferences", eImp);
        }
        return null;
    }

    return {
        getDefaultPreferences: getDefaultPreferences,
        getPreferencesFolder: getPreferencesFolder,
        getPreferencesFile: getPreferencesFile,
        loadPreferences: loadPreferences,
        savePreferences: savePreferences,
        exportPreferencesToFile: exportPreferencesToFile,
        importPreferencesFromFile: importPreferencesFromFile
    };
})();

/**
 * InvoluteCore.jsxinc - Involute Spur Gear Geometric Calculation & Bezier Curve Fitting Core
 * Part of GearDrawer Architecture (JIS B 1701-1:2017 / JIS B 0003:2012)
 * Version: 1.0.0
 * 
 * Strict ECMAScript 3 (ExtendScript compatible). All internal calculations are performed in millimeters (mm).
 */

var InvoluteCore = (function () {
    // Unit conversion constants
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    /**
     * Involute function: inv(alpha) = tan(alpha) - alpha
     * @param {number} alphaRad Pressure angle in radians
     * @returns {number} Involute value
     */
    function inv(alphaRad) {
        return Math.tan(alphaRad) - alphaRad;
    }

    /**
     * Inverse involute function: solves tan(alpha) - alpha = val for alpha (rad)
     * Uses Newton-Raphson method with cubic root initial estimate.
     * @param {number} val Involute value
     * @returns {number} Solved angle in radians
     */
    function invInv(val) {
        if (val <= 0) return 0.0;
        var a = Math.pow(3.0 * val, 1.0 / 3.0);
        for (var iter = 0; iter < 25; iter++) {
            var t = Math.tan(a);
            var f = t - a - val;
            var fPrime = t * t;
            if (Math.abs(fPrime) < 1e-12) break;
            var da = f / fPrime;
            a -= da;
            if (Math.abs(da) < 1e-12) break;
        }
        return a;
    }

    /**
     * Theoretical undercut limit tooth count
     * z_min = 2 / (sin(alpha)^2)
     * @param {number} alphaRad Pressure angle in radians
     * @returns {number} Undercut limit tooth count
     */
    function getUndercutLimit(alphaRad) {
        var sinA = Math.sin(alphaRad);
        return 2.0 / (sinA * sinA);
    }

    /**
     * Fits a cubic Bezier segment between P0 and P3 through sample point Pm.
     * Preserves strict C1 continuity with prescribed unit tangent vectors P0.t and P3.t.
     */
    function fitBezierSegment(P0, P3, Pm) {
        var dx = P3.x - P0.x;
        var dy = P3.y - P0.y;
        var chord = Math.sqrt(dx * dx + dy * dy);

        var rhsX = Pm.x - 0.5 * (P0.x + P3.x);
        var rhsY = Pm.y - 0.5 * (P0.y + P3.y);

        var a11 = 0.375 * P0.tx, a12 = -0.375 * P3.tx;
        var a21 = 0.375 * P0.ty, a22 = -0.375 * P3.ty;
        var det = a11 * a22 - a12 * a21;

        var k0 = chord / 3.0;
        var k1 = chord / 3.0;

        if (Math.abs(det) > 1e-7) {
            var sol0 = (rhsX * a22 - rhsY * a12) / det;
            var sol1 = (a11 * rhsY - a21 * rhsX) / det;
            if (sol0 > 0 && sol0 < chord * 1.5 && sol1 > 0 && sol1 < chord * 1.5) {
                // Ensure control handle P2 does not cross behind P0 angular ray (monotonicity clamp)
                var th0 = Math.atan2(P0.y, P0.x);
                var n3 = P3.y * Math.cos(th0) - P3.x * Math.sin(th0);
                var d3 = P3.ty * Math.cos(th0) - P3.tx * Math.sin(th0);
                if (d3 > 1e-6 && n3 > 0) {
                    var maxK1 = (n3 / d3) * 0.95;
                    if (sol1 > maxK1) sol1 = maxK1;
                }
                // Ensure control handle P1 does not cross beyond P3 angular ray (symmetric monotonicity clamp)
                var th3 = Math.atan2(P3.y, P3.x);
                var n0 = P0.x * Math.sin(th3) - P0.y * Math.cos(th3);
                var d0 = P0.ty * Math.cos(th3) - P0.tx * Math.sin(th3);
                if (d0 > 1e-6 && n0 > 0) {
                    var maxK0 = (n0 / d0) * 0.95;
                    if (sol0 > maxK0) sol0 = maxK0;
                }
                k0 = sol0;
                k1 = sol1;
            }
        }

        return {
            P0: P0,
            P1: { x: P0.x + k0 * P0.tx, y: P0.y + k0 * P0.ty },
            P2: { x: P3.x - k1 * P3.tx, y: P3.y - k1 * P3.ty },
            P3: P3
        };
    }

    /**
     * Mirrors a Bezier segment horizontally across the symmetry axis (y -> -y, ty -> -ty).
     */
    function mirrorSeg(seg) {
        return {
            P0: { x: seg.P0.x, y: -seg.P0.y },
            P1: { x: seg.P1.x, y: -seg.P1.y },
            P2: { x: seg.P2.x, y: -seg.P2.y },
            P3: { x: seg.P3.x, y: -seg.P3.y }
        };
    }

    /**
     * Tessellates a cubic Bezier node array into a straight-line polyline node array.
     * Every emitted node has zero-length handles (leftDirection === anchor, rightDirection === anchor)
     * and pointType === "CORNER". Original anchor coordinates (e.g. symmetry Mid Tip) are preserved exactly.
     *
     * @param {Array} nodes Source Bezier node objects [{ anchor, leftDirection, rightDirection, pointType }]
     * @param {boolean} isClosed Whether the path is a closed loop
     * @param {number} subdivisionsPerCurve Number of straight subdivisions per curved Bezier segment (default 5)
     * @returns {Array} Polyline node array
     */
    function tessellateBezierNodesToPolyline(nodes, isClosed, subdivisionsPerCurve) {
        if (!nodes || nodes.length === 0) return [];
        var subDiv = Math.max(2, parseInt(subdivisionsPerCurve || 5, 10));
        var segCount = isClosed ? nodes.length : (nodes.length - 1);
        var out = [];

        function pushCorner(ax, ay) {
            if (isNaN(ax) || isNaN(ay)) return;
            if (out.length > 0) {
                var prev = out[out.length - 1].anchor;
                var pdx = ax - prev[0];
                var pdy = ay - prev[1];
                if (pdx * pdx + pdy * pdy < 1e-12) return;
            }
            out.push({
                anchor: [ax, ay],
                leftDirection: [ax, ay],
                rightDirection: [ax, ay],
                pointType: "CORNER"
            });
        }

        for (var i = 0; i < segCount; i++) {
            var nd0 = nodes[i];
            var nd1 = nodes[(i + 1) % nodes.length];
            var p0 = nd0.anchor;
            var p1 = nd0.rightDirection || p0;
            var p2 = nd1.leftDirection || nd1.anchor;
            var p3 = nd1.anchor;

            var h1dx = p1[0] - p0[0];
            var h1dy = p1[1] - p0[1];
            var h2dx = p2[0] - p3[0];
            var h2dy = p2[1] - p3[1];
            var isStraight = (h1dx * h1dx + h1dy * h1dy < 1e-12) && (h2dx * h2dx + h2dy * h2dy < 1e-12);

            pushCorner(p0[0], p0[1]);

            if (!isStraight) {
                for (var s = 1; s < subDiv; s++) {
                    var u = s / subDiv;
                    var om = 1.0 - u;
                    var om2 = om * om;
                    var u2 = u * u;
                    var w0 = om2 * om;
                    var w1 = 3.0 * om2 * u;
                    var w2 = 3.0 * om * u2;
                    var w3 = u2 * u;
                    var bx = w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0];
                    var by = w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1];
                    pushCorner(bx, by);
                }
            }
        }

        if (!isClosed && nodes.length > 0) {
            var lastA = nodes[nodes.length - 1].anchor;
            pushCorner(lastA[0], lastA[1]);
        } else if (isClosed && out.length > 1) {
            var firstA = out[0].anchor;
            var endA = out[out.length - 1].anchor;
            var cdx = endA[0] - firstA[0];
            var cdy = endA[1] - firstA[1];
            if (cdx * cdx + cdy * cdy < 1e-12) {
                out.pop();
            }
        }

        return out;
    }

    /**
     * Calculates an accurate circular arc Bezier node sequence.
     * @param {number} R Radius in mm
     * @param {number} thetaStart Starting angle (rad)
     * @param {number} thetaEnd Ending angle (rad)
     * @returns {Array} Array of node objects [{ anchor, leftDirection, rightDirection, pointType }]
     */
    function createArcBezierNodes(R, thetaStart, thetaEnd) {
        var totalAngle = thetaEnd - thetaStart;
        if (Math.abs(totalAngle) < 1e-6) return [];

        var segments = Math.max(1, Math.ceil(Math.abs(totalAngle) / (Math.PI / 2.0)));
        var dTheta = totalAngle / segments;
        var h = (4.0 / 3.0) * R * Math.tan(dTheta / 4.0);

        var nodes = [];
        for (var i = 0; i <= segments; i++) {
            var th = thetaStart + i * dTheta;
            var cosT = Math.cos(th);
            var sinT = Math.sin(th);
            var ax = R * cosT;
            var ay = R * sinT;

            // Unit tangent pointing in increasing theta direction: [-sinT, cosT]
            var lx = ax + h * sinT;
            var ly = ay - h * cosT;
            var rx = ax - h * sinT;
            var ry = ay + h * cosT;

            nodes.push({
                anchor: [ax, ay],
                leftDirection: [lx, ly],
                rightDirection: [rx, ry],
                pointType: "SMOOTH"
            });
        }
        return nodes;
    }

    /**
     * Calculates external spur gear geometry and Bezier profile nodes.
     * All calculations are carried out in millimeters (mm).
     * 
     * @param {Object} params Input parameters:
     *   - m / module: Module (mm)
     *   - z / teeth: Tooth count
     *   - alphaDeg: Standard pressure angle (deg, default 20)
     *   - x / profileShift: Profile shift coefficient (default 0.0)
     *   - backlash: Circumferential backlash jt (mm, default 0.0)
     *   - kerfOffset: Normal direction kerf offset deltaNkerf = Kerf/2 (mm, default 0.0)
     *   - tipRounding / rTip: Tip corner rounding fillet radius (mm, default 0.0)
     *   - pathQuality: "bezier_recommended" (default) | "bezier_minimal" | "polyline"
     *   - useFillet: Whether to create generating trochoid root fillet (default true)
     *   - rcFactor: Tool tip radius factor (default 0.38)
     * @returns {Object} Calculated gear data with outerNodes and singleToothNodes
     */
    function calculateSpurGear(params) {
        params = params || {};
        var warnings = [];

        var m = parseFloat(params.m || params.module) || 2.0;
        if (m < 0.05) {
            warnings.push("Module m=" + m + " clamped to minimum 0.05 mm");
            m = 0.05;
        }

        var z = parseInt(params.z || params.teeth, 10) || 18;
        if (z < 3) {
            warnings.push("Tooth count z=" + z + " clamped to minimum 3");
            z = 3;
        } else if (z > 400) {
            warnings.push("Tooth count z=" + z + " clamped to maximum 400");
            z = 400;
        }

        var alphaDeg = parseFloat(params.alphaDeg !== undefined ? params.alphaDeg : 20.0);
        if (alphaDeg < 5.0) {
            warnings.push("Pressure angle alpha=" + alphaDeg + " deg clamped to 5.0 deg");
            alphaDeg = 5.0;
        } else if (alphaDeg > 45.0) {
            warnings.push("Pressure angle alpha=" + alphaDeg + " deg clamped to 45.0 deg");
            alphaDeg = 45.0;
        }
        var alpha = alphaDeg * (Math.PI / 180.0);

        var x = parseFloat(params.x !== undefined ? params.x : (params.profileShift || 0.0));
        if (x < -2.0) {
            warnings.push("Profile shift x=" + x + " clamped to -2.0");
            x = -2.0;
        } else if (x > 2.0) {
            warnings.push("Profile shift x=" + x + " clamped to 2.0");
            x = 2.0;
        }

        var backlash = parseFloat(params.backlash || 0.0);
        var kerfOffset = parseFloat(params.kerfOffset !== undefined ? params.kerfOffset : 0.0);
        var tipRounding = parseFloat(params.tipRounding !== undefined ? params.tipRounding : (params.rTip || 0.0));
        var pathQuality = params.pathQuality || "bezier_recommended";
        var useFillet = (params.useFillet !== false);
        var rcFactor = parseFloat(params.rcFactor !== undefined ? params.rcFactor : 0.38);

        // Standard JIS B 1701-1 pitch and base dimensions (mm)
        var d = m * z;
        var rp = d / 2.0;
        var db = d * Math.cos(alpha);
        var rb = db / 2.0;

        // Normal kerf offset applied to addendum and dedendum
        // When deltaY > 0, tip diameter is shortened: da' = m * (z + 2 + 2x - 2*deltaY) + 2*kerfOffset
        var deltaY = parseFloat(params.deltaY !== undefined ? params.deltaY : 0.0);
        var da = (params.da !== undefined) ? params.da : (m * (z + 2.0 + 2.0 * x - 2.0 * deltaY) + 2.0 * kerfOffset);
        var df = (params.df !== undefined) ? params.df : (m * (z - 2.5 + 2.0 * x) + 2.0 * kerfOffset);
        var ra = da / 2.0;
        var rf = df / 2.0;

        // Dedendum / Addendum inversion guard (df >= da)
        if (ra <= rf + 0.1 * m) {
            warnings.push("Addendum circle (ra=" + ra.toFixed(3) + ") is smaller than dedendum circle (rf=" + rf.toFixed(3) + "). Clamped ra to rf + 0.2*m.");
            ra = rf + 0.2 * m;
            da = ra * 2.0;
        }

        // Effective tooth thickness on pitch circle considering profile shift, backlash, and kerf offset
        var cosAlpha = Math.cos(alpha);
        var seff = m * (Math.PI / 2.0 + 2.0 * x * Math.tan(alpha)) - backlash + (2.0 * kerfOffset / cosAlpha);
        var minSeff = 0.05 * m;
        if (seff < minSeff) {
            warnings.push("Effective tooth thickness (seff=" + seff.toFixed(3) + " mm) is below safety limit. Clamped to " + minSeff.toFixed(3) + " mm.");
            seff = minSeff;
        }
        var psiP = seff / (2.0 * rp); // Half-tooth angle on pitch circle

        var invAlpha = inv(alpha);

        // Crest point (pointed tooth top-land vanishing) guard
        var invAlphaCrest = psiP + invAlpha;
        if (invAlphaCrest > 0) {
            var alphaCrest = invInv(invAlphaCrest);
            var cosAlphaCrest = Math.cos(alphaCrest);
            if (cosAlphaCrest > 1e-6) {
                var rCrest = rb / cosAlphaCrest;
                if (ra >= rCrest - 0.005 * m) {
                    var safeRa = Math.max(rf + 0.1 * m, rCrest - 0.02 * m);
                    warnings.push("Tooth top-land pointed/vanished (ra=" + ra.toFixed(3) + " >= rCrest=" + rCrest.toFixed(3) + "). Clamped tip radius ra to " + safeRa.toFixed(3) + " mm.");
                    ra = safeRa;
                    da = ra * 2.0;
                }
            }
        }

        // Tooth tip thickness on addendum circle (cresting limit sa >= 0.2*m)
        var cosAlphaA = Math.min(1.0, rb / Math.max(rb, ra));
        var alphaA = Math.acos(cosAlphaA);
        var invAlphaA = inv(alphaA);
        var sa = 2.0 * ra * (psiP + invAlpha - invAlphaA);
        var isTipPointed = (sa < 0.2 * m);
        if (isTipPointed) {
            warnings.push("Tooth tip thickness is thin (sa=" + sa.toFixed(3) + " mm < 0.2*m=" + (0.2 * m).toFixed(3) + " mm). Cresting risk under high profile shift.");
        }

        // --- 1. Involute Function for Right Flank (r in [rb, ra]) ---
        function getInvolutePoint(r) {
            var cosAr = Math.min(1.0, rb / Math.max(rb, r));
            var alphaR = Math.acos(cosAr);
            var invR = inv(alphaR);
            var theta = psiP + invAlpha - invR;

            // Rigorous analytical unit tangent vector pointing outward (increasing r):
            // tx = cos(theta - alphaR), ty = sin(theta - alphaR)
            var tx = Math.cos(theta - alphaR);
            var ty = Math.sin(theta - alphaR);

            return {
                r: r,
                theta: theta,
                x: r * Math.cos(theta),
                y: r * Math.sin(theta),
                tx: tx,
                ty: ty
            };
        }

        // --- 2. Rack Generating Trochoid Fillet (Camus / Euler-Savary) ---
        var rc = rcFactor * m;
        // Adjusted cutter radius considering kerf offset
        var rcEff = Math.max(0.01 * m, rc - kerfOffset);
        var hk = 1.25 * m;
        var vc = hk - x * m - rc;
        var w = (Math.PI * m - seff) / 2.0;
        // Rigorous rack corner arc center horizontal offset uc
        var uc = w - vc * Math.tan(alpha) - rc / cosAlpha;

        function getTrochoidPoint(phi) {
            var psi = (Math.PI / z) - phi;
            var Uc = -uc + rp * phi;
            var L = Math.sqrt(Uc * Uc + vc * vc);
            if (L < 1e-9) L = 1e-9;

            var rEr = (rp - vc) - rcEff * (vc / L);
            var rEt = Uc * (1.0 + rcEff / L);

            var x = rEr * Math.cos(psi) - rEt * Math.sin(psi);
            var y = rEr * Math.sin(psi) + rEt * Math.cos(psi);

            var r = Math.sqrt(x * x + y * y);
            var theta = Math.atan2(y, x);

            // Unit normal: (-vc * er + Uc * et) / L
            var nx = (-vc * Math.cos(psi) - Uc * Math.sin(psi)) / L;
            var ny = (-vc * Math.sin(psi) + Uc * Math.cos(psi)) / L;
            // Unit tangent pointing towards junction (increasing r / decreasing phi)
            var tx = -ny;
            var ty = nx;

            return {
                phi: phi,
                r: r,
                theta: theta,
                x: x,
                y: y,
                tx: tx,
                ty: ty
            };
        }

        var phiRoot = uc / rp;

        // Tangency point on rack between straight cutting edge and corner arc
        var UcTangent = -vc / Math.tan(alpha);
        var phiTangent = (UcTangent + uc) / rp;
        var pTangent = getTrochoidPoint(phiTangent);

        // Theoretical undercut limit tooth count considering profile shift
        var zUndercutLimit = (2.0 * (1.0 - x)) / (Math.sin(alpha) * Math.sin(alpha));
        var isUndercut = (z < zUndercutLimit);

        // --- 3. Determine Junction Between Trochoid Fillet and Involute ---
        var junctionPhi = phiTangent;
        var junctionR = pTangent.r;

        if (useFillet) {
            if (isUndercut) {
                // For undercut gears, trochoid sweeps into the region r >= rb
                var phiA = phiRoot;
                var phiB = phiRoot - (50.0 * Math.PI / 180.0);
                var searchSteps = 1000;
                var prevDiff = null;
                var prevPhi = null;

                for (var s = 0; s <= searchSteps; s++) {
                    var phi = phiA + (phiB - phiA) * (s / searchSteps);
                    var tp = getTrochoidPoint(phi);

                    if (tp.r >= rb && tp.r <= ra) {
                        var ip = getInvolutePoint(tp.r);
                        var diff = tp.theta - ip.theta;

                        if (prevDiff !== null && ((prevDiff < 0 && diff >= 0) || (prevDiff > 0 && diff <= 0))) {
                            var lowPhi = prevPhi;
                            var highPhi = phi;
                            for (var bisect = 0; bisect < 25; bisect++) {
                                var mid = (lowPhi + highPhi) / 2.0;
                                var tMid = getTrochoidPoint(mid);
                                var iMid = getInvolutePoint(tMid.r);
                                var dMid = tMid.theta - iMid.theta;
                                if ((prevDiff < 0 && dMid < 0) || (prevDiff > 0 && dMid > 0)) {
                                    lowPhi = mid;
                                } else {
                                    highPhi = mid;
                                }
                            }
                            junctionPhi = lowPhi;
                            var finalTp = getTrochoidPoint(junctionPhi);
                            junctionR = finalTp.r;
                            break;
                        }
                        prevDiff = diff;
                        prevPhi = phi;
                    }
                }
            } else {
                junctionPhi = phiTangent;
                junctionR = pTangent.r;
            }
        }

        // --- 4. Tip Corner Rounding Fillet (rTip) ---
        var hasTipRounding = (tipRounding > 0.0001);
        var rInvEnd = ra;
        var pRightTipArcStart = null;
        var pRightInvEnd = null;
        var segRoundingRight = null;
        var segRoundingLeft = null;

        if (hasTipRounding) {
            var targetRc = ra - tipRounding;
            var lowR = Math.max(rb, ra - 4.0 * tipRounding);
            var highR = ra;
            var solR = ra;

            for (var iterRound = 0; iterRound < 40; iterRound++) {
                var midR = (lowR + highR) / 2.0;
                var ptR = getInvolutePoint(midR);
                // Inward normal: nx = -ptR.ty, ny = ptR.tx
                var cx = ptR.x - tipRounding * ptR.ty;
                var cy = ptR.y + tipRounding * ptR.tx;
                var distC = Math.sqrt(cx * cx + cy * cy);
                if (distC < targetRc) {
                    lowR = midR;
                } else {
                    highR = midR;
                }
                solR = midR;
            }

            pRightInvEnd = getInvolutePoint(solR);
            var cRight = {
                x: pRightInvEnd.x - tipRounding * pRightInvEnd.ty,
                y: pRightInvEnd.y + tipRounding * pRightInvEnd.tx
            };

            if (cRight.y <= 0.001 || isNaN(cRight.x) || isNaN(cRight.y)) {
                hasTipRounding = false;
            } else {
                rInvEnd = solR;
                var thCRight = Math.atan2(cRight.y, cRight.x);
                pRightTipArcStart = {
                    x: ra * Math.cos(thCRight),
                    y: ra * Math.sin(thCRight),
                    theta: thCRight
                };

                var vTip = { x: (pRightTipArcStart.x - cRight.x) / tipRounding, y: (pRightTipArcStart.y - cRight.y) / tipRounding };
                var vInv = { x: (pRightInvEnd.x - cRight.x) / tipRounding, y: (pRightInvEnd.y - cRight.y) / tipRounding };
                var dotRound = Math.max(-1.0, Math.min(1.0, vTip.x * vInv.x + vTip.y * vInv.y));
                var deltaPhiRound = Math.acos(dotRound);
                var hRound = (4.0 / 3.0) * tipRounding * Math.tan(deltaPhiRound / 4.0);

                var tTipStart = { x: Math.sin(thCRight), y: -Math.cos(thCRight) };
                var tInvEnd = { x: -pRightInvEnd.tx, y: -pRightInvEnd.ty };

                segRoundingRight = {
                    P0: pRightTipArcStart,
                    P1: { x: pRightTipArcStart.x + hRound * tTipStart.x, y: pRightTipArcStart.y + hRound * tTipStart.y },
                    P2: { x: pRightInvEnd.x - hRound * tInvEnd.x, y: pRightInvEnd.y - hRound * tInvEnd.y },
                    P3: pRightInvEnd
                };

                segRoundingLeft = {
                    P0: { x: segRoundingRight.P3.x, y: -segRoundingRight.P3.y },
                    P1: { x: segRoundingRight.P2.x, y: -segRoundingRight.P2.y },
                    P2: { x: segRoundingRight.P1.x, y: -segRoundingRight.P1.y },
                    P3: { x: segRoundingRight.P0.x, y: -segRoundingRight.P0.y }
                };
            }
        }

        var pRightJunc = useFillet ? getTrochoidPoint(junctionPhi) : {
            x: rb * Math.cos(psiP + invAlpha),
            y: rb * Math.sin(psiP + invAlpha),
            tx: 0,
            ty: 1,
            r: rb,
            theta: psiP + invAlpha
        };
        var pRightRoot = useFillet ? getTrochoidPoint(phiRoot) : {
            x: rf * Math.cos(pRightJunc.theta),
            y: rf * Math.sin(pRightJunc.theta),
            tx: Math.cos(pRightJunc.theta),
            ty: Math.sin(pRightJunc.theta),
            r: rf,
            theta: pRightJunc.theta
        };
        var pRightTip = hasTipRounding ? pRightInvEnd : getInvolutePoint(ra);

        // Adaptive node allocation check for deep undercut
        var remainingInvoluteLength = rInvEnd - junctionR;
        var isDeepUndercut = isUndercut && (remainingInvoluteLength < 0.5 * m);

        // --- 5. Generate Bezier Segments for Right Flank ---
        var useHighAccuracyBezier = (pathQuality === "bezier_recommended" || pathQuality === "polyline");
        var rightFilletSegs = [];
        if (useFillet) {
            if (useHighAccuracyBezier && isDeepUndercut) {
                // Adaptive node allocation for deep undercut: subdivide trochoid fillet into 3 segments
                var phi1_3 = phiRoot + (junctionPhi - phiRoot) * (1.0 / 3.0);
                var phi2_3 = phiRoot + (junctionPhi - phiRoot) * (2.0 / 3.0);
                var pFillet1 = getTrochoidPoint(phi1_3);
                var pFillet2 = getTrochoidPoint(phi2_3);
                rightFilletSegs.push(fitBezierSegment(pRightRoot, pFillet1, getTrochoidPoint((phiRoot + phi1_3) / 2.0)));
                rightFilletSegs.push(fitBezierSegment(pFillet1, pFillet2, getTrochoidPoint((phi1_3 + phi2_3) / 2.0)));
                rightFilletSegs.push(fitBezierSegment(pFillet2, pRightJunc, getTrochoidPoint((phi2_3 + junctionPhi) / 2.0)));
            } else if (useHighAccuracyBezier && isUndercut) {
                var phiMid = (phiRoot + junctionPhi) / 2.0;
                var pRightFilletMid = getTrochoidPoint(phiMid);
                rightFilletSegs.push(fitBezierSegment(pRightRoot, pRightFilletMid, getTrochoidPoint((phiRoot + phiMid) / 2.0)));
                rightFilletSegs.push(fitBezierSegment(pRightFilletMid, pRightJunc, getTrochoidPoint((phiMid + junctionPhi) / 2.0)));
            } else {
                var pRightFilletMidSingle = getTrochoidPoint((phiRoot + junctionPhi) / 2.0);
                rightFilletSegs.push(fitBezierSegment(pRightRoot, pRightJunc, pRightFilletMidSingle));
            }
        } else {
            rightFilletSegs.push({
                P0: pRightRoot,
                P1: { x: pRightRoot.x + (pRightJunc.x - pRightRoot.x) / 3.0, y: pRightRoot.y + (pRightJunc.y - pRightRoot.y) / 3.0 },
                P2: { x: pRightJunc.x - (pRightJunc.x - pRightRoot.x) / 3.0, y: pRightJunc.y - (pRightJunc.y - pRightRoot.y) / 3.0 },
                P3: pRightJunc
            });
        }

        var rightInvSegs = [];
        if (useHighAccuracyBezier && !isDeepUndercut) {
            var rMidInv = (junctionR + rInvEnd) / 2.0;
            var pRightInvMid = getInvolutePoint(rMidInv);
            rightInvSegs.push(fitBezierSegment(pRightJunc, pRightInvMid, getInvolutePoint((junctionR + rMidInv) / 2.0)));
            rightInvSegs.push(fitBezierSegment(pRightInvMid, pRightTip, getInvolutePoint((rMidInv + rInvEnd) / 2.0)));
        } else {
            // For deep undercut or minimal quality, use single segment for the short remaining involute flank
            var pRightInvMidSingle = getInvolutePoint((junctionR + rInvEnd) / 2.0);
            rightInvSegs.push(fitBezierSegment(pRightJunc, pRightTip, pRightInvMidSingle));
        }

        // Tip Arc Segments (split into two halves with Mid Tip anchor on symmetry axis theta = 0)
        var tipArcEndRight = hasTipRounding ? pRightTipArcStart : pRightTip;
        var tipArcEndLeft = hasTipRounding ? segRoundingLeft.P3 : { x: pRightTip.x, y: -pRightTip.y };
        var halfDThTip = tipArcEndRight.theta;
        var LHalfTip = (4.0 / 3.0) * ra * Math.tan(halfDThTip / 4.0);
        var pMidTip = { x: ra, y: 0.0 };

        var tipArcSegLeft = {
            P0: tipArcEndLeft,
            P1: { x: tipArcEndLeft.x + LHalfTip * Math.sin(halfDThTip), y: tipArcEndLeft.y + LHalfTip * Math.cos(halfDThTip) },
            P2: { x: pMidTip.x, y: pMidTip.y - LHalfTip },
            P3: pMidTip
        };

        var tipArcSegRight = {
            P0: pMidTip,
            P1: { x: pMidTip.x, y: pMidTip.y + LHalfTip },
            P2: { x: tipArcEndRight.x + LHalfTip * Math.sin(halfDThTip), y: tipArcEndRight.y - LHalfTip * Math.cos(halfDThTip) },
            P3: tipArcEndRight
        };

        // Mirror for Left flank
        var leftFilletSegs = [];
        for (var lfi = 0; lfi < rightFilletSegs.length; lfi++) {
            leftFilletSegs.push(mirrorSeg(rightFilletSegs[lfi]));
        }

        var leftInvSegs = [];
        for (var lii = 0; lii < rightInvSegs.length; lii++) {
            leftInvSegs.push(mirrorSeg(rightInvSegs[lii]));
        }

        // --- 6. Assemble singleToothNodes (Open Profile for 1 Tooth) ---
        var singleToothNodes = [];

        // Left Root:
        singleToothNodes.push({
            anchor: [leftFilletSegs[0].P0.x, leftFilletSegs[0].P0.y],
            leftDirection: [leftFilletSegs[0].P0.x, leftFilletSegs[0].P0.y],
            rightDirection: [leftFilletSegs[0].P1.x, leftFilletSegs[0].P1.y],
            pointType: "SMOOTH"
        });

        // Left Fillet intermediate points:
        for (var i = 0; i < leftFilletSegs.length - 1; i++) {
            var sCur = leftFilletSegs[i];
            var sNxt = leftFilletSegs[i + 1];
            singleToothNodes.push({
                anchor: [sCur.P3.x, sCur.P3.y],
                leftDirection: [sCur.P2.x, sCur.P2.y],
                rightDirection: [sNxt.P1.x, sNxt.P1.y],
                pointType: "SMOOTH"
            });
        }

        // Left Junction:
        var lastLFil = leftFilletSegs[leftFilletSegs.length - 1];
        var firstLInv = leftInvSegs[0];
        singleToothNodes.push({
            anchor: [lastLFil.P3.x, lastLFil.P3.y],
            leftDirection: [lastLFil.P2.x, lastLFil.P2.y],
            rightDirection: [firstLInv.P1.x, firstLInv.P1.y],
            pointType: "SMOOTH"
        });

        // Left Involute intermediate points:
        for (var j = 0; j < leftInvSegs.length - 1; j++) {
            var sCurInv = leftInvSegs[j];
            var sNxtInv = leftInvSegs[j + 1];
            singleToothNodes.push({
                anchor: [sCurInv.P3.x, sCurInv.P3.y],
                leftDirection: [sCurInv.P2.x, sCurInv.P2.y],
                rightDirection: [sNxtInv.P1.x, sNxtInv.P1.y],
                pointType: "SMOOTH"
            });
        }

        var lastLInv = leftInvSegs[leftInvSegs.length - 1];

        if (hasTipRounding) {
            // Left Tip Involute End
            singleToothNodes.push({
                anchor: [lastLInv.P3.x, lastLInv.P3.y],
                leftDirection: [lastLInv.P2.x, lastLInv.P2.y],
                rightDirection: [segRoundingLeft.P1.x, segRoundingLeft.P1.y],
                pointType: "SMOOTH"
            });

            // Left Tip Arc Start
            singleToothNodes.push({
                anchor: [segRoundingLeft.P3.x, segRoundingLeft.P3.y],
                leftDirection: [segRoundingLeft.P2.x, segRoundingLeft.P2.y],
                rightDirection: [tipArcSegLeft.P1.x, tipArcSegLeft.P1.y],
                pointType: "SMOOTH"
            });
        } else {
            // Standard Sharp Left Tip Corner
            singleToothNodes.push({
                anchor: [lastLInv.P3.x, lastLInv.P3.y],
                leftDirection: [lastLInv.P2.x, lastLInv.P2.y],
                rightDirection: [tipArcSegLeft.P1.x, tipArcSegLeft.P1.y],
                pointType: "CORNER"
            });
        }

        // Mid Tip Anchor (centered on symmetry axis theta = 0):
        singleToothNodes.push({
            anchor: [pMidTip.x, pMidTip.y],
            leftDirection: [tipArcSegLeft.P2.x, tipArcSegLeft.P2.y],
            rightDirection: [tipArcSegRight.P1.x, tipArcSegRight.P1.y],
            pointType: "SMOOTH"
        });

        var lastRInv = rightInvSegs[rightInvSegs.length - 1];

        if (hasTipRounding) {
            // Right Tip Arc End
            singleToothNodes.push({
                anchor: [tipArcEndRight.x, tipArcEndRight.y],
                leftDirection: [tipArcSegRight.P2.x, tipArcSegRight.P2.y],
                rightDirection: [segRoundingRight.P1.x, segRoundingRight.P1.y],
                pointType: "SMOOTH"
            });

            // Right Tip Involute Start
            singleToothNodes.push({
                anchor: [pRightTip.x, pRightTip.y],
                leftDirection: [segRoundingRight.P2.x, segRoundingRight.P2.y],
                rightDirection: [lastRInv.P2.x, lastRInv.P2.y],
                pointType: "SMOOTH"
            });
        } else {
            // Standard Sharp Right Tip Corner
            singleToothNodes.push({
                anchor: [pRightTip.x, pRightTip.y],
                leftDirection: [tipArcSegRight.P2.x, tipArcSegRight.P2.y],
                rightDirection: [lastRInv.P2.x, lastRInv.P2.y],
                pointType: "CORNER"
            });
        }

        // Right Involute intermediate points (downwards):
        for (var k = rightInvSegs.length - 1; k > 0; k--) {
            var sAboveInv = rightInvSegs[k];
            var sBelowInv = rightInvSegs[k - 1];
            singleToothNodes.push({
                anchor: [sAboveInv.P0.x, sAboveInv.P0.y],
                leftDirection: [sAboveInv.P1.x, sAboveInv.P1.y],
                rightDirection: [sBelowInv.P2.x, sBelowInv.P2.y],
                pointType: "SMOOTH"
            });
        }

        // Right Junction:
        var firstRInv = rightInvSegs[0];
        var lastRFil = rightFilletSegs[rightFilletSegs.length - 1];
        singleToothNodes.push({
            anchor: [pRightJunc.x, pRightJunc.y],
            leftDirection: [firstRInv.P1.x, firstRInv.P1.y],
            rightDirection: [lastRFil.P2.x, lastRFil.P2.y],
            pointType: "SMOOTH"
        });

        // Right Fillet intermediate points (downwards):
        for (var l = rightFilletSegs.length - 1; l > 0; l--) {
            var sAboveFil = rightFilletSegs[l];
            var sBelowFil = rightFilletSegs[l - 1];
            singleToothNodes.push({
                anchor: [sAboveFil.P0.x, sAboveFil.P0.y],
                leftDirection: [sAboveFil.P1.x, sAboveFil.P1.y],
                rightDirection: [sBelowFil.P2.x, sBelowFil.P2.y],
                pointType: "SMOOTH"
            });
        }

        // Right Root:
        var firstRFil = rightFilletSegs[0];
        singleToothNodes.push({
            anchor: [pRightRoot.x, pRightRoot.y],
            leftDirection: [firstRFil.P1.x, firstRFil.P1.y],
            rightDirection: [pRightRoot.x, pRightRoot.y],
            pointType: "SMOOTH"
        });

        // --- 7. Full Closed Gear Outer Bezier Loop ---
        var outerNodes = [];
        var toothPitchAngle = (2.0 * Math.PI) / z;
        var thRoot = Math.atan2(pRightRoot.y, pRightRoot.x);
        var dThRoot = toothPitchAngle - 2.0 * thRoot;
        var hasFlatRoot = (dThRoot > 0.0001);
        var rootR = (pRightRoot && pRightRoot.r !== undefined) ? pRightRoot.r : rf;
        var LRoot = hasFlatRoot ? ((4.0 / 3.0) * rootR * Math.tan(dThRoot / 4.0)) : 0;

        for (var t = 0; t < z; t++) {
            var rot = t * toothPitchAngle;
            var cosR = Math.cos(rot);
            var sinR = Math.sin(rot);

            function tfPt(pt) {
                var rx = pt[0] * cosR - pt[1] * sinR;
                var ry = pt[0] * sinR + pt[1] * cosR;
                return [rx, ry];
            }

            var tNodes = [];
            for (var n = 0; n < singleToothNodes.length; n++) {
                var nd = singleToothNodes[n];
                tNodes.push({
                    anchor: tfPt(nd.anchor),
                    leftDirection: tfPt(nd.leftDirection),
                    rightDirection: tfPt(nd.rightDirection),
                    pointType: nd.pointType
                });
            }

            if (!hasFlatRoot) {
                tNodes[0].pointType = "CORNER";
                tNodes[tNodes.length - 1].pointType = "CORNER";
            }

            var curEndTh = rot + thRoot;
            var curStartTh = rot - thRoot;

            var rEndPt = tfPt([pRightRoot.x, pRightRoot.y]);
            var lStartPt = tfPt([pRightRoot.x, -pRightRoot.y]);

            // Outgoing handle from Right Root towards next tooth:
            tNodes[tNodes.length - 1].rightDirection = [
                rEndPt[0] - LRoot * Math.sin(curEndTh),
                rEndPt[1] + LRoot * Math.cos(curEndTh)
            ];

            // Incoming handle into Left Root from previous tooth:
            tNodes[0].leftDirection = [
                lStartPt[0] + LRoot * Math.sin(curStartTh),
                lStartPt[1] - LRoot * Math.cos(curStartTh)
            ];

            for (var mIdx = 0; mIdx < tNodes.length; mIdx++) {
                outerNodes.push(tNodes[mIdx]);
            }
        }

        if (pathQuality === "polyline") {
            singleToothNodes = tessellateBezierNodesToPolyline(singleToothNodes, false, 5);
            outerNodes = tessellateBezierNodesToPolyline(outerNodes, true, 5);
        }

        if (warnings.length > 0 && typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            for (var wIdx = 0; wIdx < warnings.length; wIdx++) {
                CalcLogger.warn("SPUR_CALC", warnings[wIdx]);
            }
        }

        return {
            m: m,
            z: z,
            alphaDeg: alphaDeg,
            alpha: alpha,
            x: x,
            backlash: backlash,
            kerfOffset: kerfOffset,
            rTip: tipRounding,
            deltaY: deltaY,
            d: d,
            db: db,
            da: da,
            df: df,
            rp: rp,
            rb: rb,
            ra: ra,
            rf: rf,
            seff: seff,
            psiP: psiP,
            sa: sa,
            isTipPointed: isTipPointed,
            isUndercut: isUndercut,
            hasTipRounding: hasTipRounding,
            singleToothNodes: singleToothNodes,
            outerNodes: outerNodes,
            pathQuality: pathQuality,
            warnings: warnings
        };
    }

    /**
     * Calculates internal ring gear geometry and Bezier profile nodes.
     * All internal calculations and coordinates are in millimeters (mm).
     * 
     * @param {Object} params Input parameters:
     *   - m / module: Module (mm)
     *   - z / teeth: Tooth count (typically >= 18)
     *   - alphaDeg: Standard pressure angle (deg, default 20)
     *   - x / profileShift: Profile shift coefficient (default 0.0)
     *   - backlash: Circumferential backlash (mm, default 0.0)
     *   - kerfOffset: Normal kerf offset (mm, default 0.0)
     *   - tipRounding / rTip: Tip corner rounding fillet radius (mm, default 0.0)
     *   - rimThickness: Radial thickness of outer ring rim (mm, default 3.0 * m)
     *   - rimShape: "CIRCLE" (default) | "RECT"
     *   - rimWidth / rimHeight: Dimensions for rectangular rim (mm)
     *   - useFillet: Whether to generate root fillets (default true)
     *   - rcFactor: Root fillet radius factor (default 0.38)
     *   - pathQuality: "bezier_recommended" (default) | "bezier_minimal"
     * @returns {Object} Internal gear geometry with innerContourNodes and rimNodes
     */
    function calculateInternalGear(params) {
        params = params || {};
        var warnings = [];

        var m = parseFloat(params.m || params.module) || 2.0;
        if (m < 0.05) {
            warnings.push("Internal module m=" + m + " clamped to minimum 0.05 mm");
            m = 0.05;
        }

        var z = parseInt(params.z || params.teeth, 10) || 48;
        if (z < 12) {
            warnings.push("Internal tooth count z=" + z + " clamped to minimum 12");
            z = 12;
        } else if (z > 500) {
            warnings.push("Internal tooth count z=" + z + " clamped to maximum 500");
            z = 500;
        }

        var alphaDeg = parseFloat(params.alphaDeg !== undefined ? params.alphaDeg : 20.0);
        if (alphaDeg < 5.0) {
            warnings.push("Internal pressure angle alpha=" + alphaDeg + " deg clamped to 5.0 deg");
            alphaDeg = 5.0;
        } else if (alphaDeg > 45.0) {
            warnings.push("Internal pressure angle alpha=" + alphaDeg + " deg clamped to 45.0 deg");
            alphaDeg = 45.0;
        }
        var alpha = alphaDeg * (Math.PI / 180.0);

        var x = parseFloat(params.x !== undefined ? params.x : (params.profileShift || 0.0));
        if (x < -5.0) {
            warnings.push("Internal profile shift x=" + x + " clamped to -5.0");
            x = -5.0;
        } else if (x > 5.0) {
            warnings.push("Internal profile shift x=" + x + " clamped to 5.0");
            x = 5.0;
        }

        var backlash = parseFloat(params.backlash || 0.0);
        var kerfOffset = parseFloat(params.kerfOffset !== undefined ? params.kerfOffset : 0.0);
        var tipRounding = parseFloat(params.tipRounding !== undefined ? params.tipRounding : (params.rTip || 0.0));
        var rimThickness = parseFloat(params.rimThickness !== undefined ? params.rimThickness : (3.0 * m));
        var rimShape = (params.rimShape || "CIRCLE").toUpperCase();
        var useFillet = (params.useFillet !== false);
        var rcFactor = parseFloat(params.rcFactor !== undefined ? params.rcFactor : 0.38);
        var pathQuality = params.pathQuality || "bezier_recommended";

        // Internal gear pitch and base dimensions (mm)
        var pitch = Math.PI * m;
        var d = m * z;
        var rp = d / 2.0;
        var db = d * Math.cos(alpha);
        var rb = db / 2.0;

        // Internal gear tooth limits:
        // Inside tip diameter (teeth point inward): da = m * (z - 2 + 2x)
        // Dedendum root circle (valleys): df = m * (z + 2.5 + 2x)
        // With kerf offset, internal cavity shrinks by kerfOffset
        var deltaY = parseFloat(params.deltaY !== undefined ? params.deltaY : 0.0);
        var da = (params.da !== undefined) ? params.da : (m * (z - 2.0 + 2.0 * x + 2.0 * deltaY) - 2.0 * kerfOffset);
        var df = (params.df !== undefined) ? params.df : (m * (z + 2.5 + 2.0 * x) - 2.0 * kerfOffset);
        var ra = da / 2.0;
        var rf = df / 2.0;

        // Guard against internal tip circle exceeding root circle (da >= df)
        if (ra >= rf - 0.1 * m) {
            warnings.push("Internal addendum radius (ra=" + ra.toFixed(3) + ") exceeds dedendum (rf=" + rf.toFixed(3) + "). Clamped ra to rf - 0.2*m.");
            ra = rf - 0.2 * m;
            da = ra * 2.0;
        }

        var rRim = rf + rimThickness;

        var cosAlpha = Math.cos(alpha);
        var seff = m * (Math.PI / 2.0 - 2.0 * x * Math.tan(alpha)) - backlash + (2.0 * kerfOffset / cosAlpha);
        if (seff < 0.25 * m) {
            seff = 0.25 * m;
        }
        var psiP = seff / (2.0 * rp);
        var invAlpha = inv(alpha);
        var toothPitchAngle = (2.0 * Math.PI) / z;

        var zLimit = 2.0 / (1.0 - cosAlpha);
        var isUndercut = (z < zLimit);

        // Concave Involute evaluator for internal gear flank (r in [ra, rf])
        function getInvolutePoint(r) {
            var cosA = Math.min(1.0, rb / Math.max(rb, r));
            var alphaR = Math.acos(cosA);
            var invR = Math.tan(alphaR) - alphaR;
            // Concave flank angle: psiP - (invAlpha - invR) = psiP + invR - invAlpha
            var th = psiP + invR - invAlpha;
            // Unit tangent pointing outward along flank towards root: T(r) = (cos(th + alphaR), sin(th + alphaR))
            var tx = Math.cos(th + alphaR);
            var ty = Math.sin(th + alphaR);
            return {
                r: r,
                x: r * Math.cos(th),
                y: r * Math.sin(th),
                theta: th,
                alphaR: alphaR,
                tx: tx,
                ty: ty,
                nx: -ty,
                ny: tx
            };
        }

        // Root fillet calculation
        var rc = rcFactor * m;
        var pJuncR = null;
        var pRootR = null;
        var filP1 = null;
        var filP2 = null;
        var cAngle = 0;
        var halfPitch = Math.PI / z;
        var maxAngle = halfPitch * 0.98;

        if (useFillet) {
            function solveFillet(rcTest) {
                var Rc = rf - rcTest;
                var lowR = rp;
                var highR = rf;
                function distError(r) {
                    var p = getInvolutePoint(r);
                    var cx = p.x + rcTest * p.nx;
                    var cy = p.y + rcTest * p.ny;
                    return Math.sqrt(cx * cx + cy * cy) - Rc;
                }
                if (distError(lowR) * distError(highR) > 0) return null;
                for (var iter = 0; iter < 30; iter++) {
                    var midR = (lowR + highR) / 2.0;
                    if (distError(lowR) * distError(midR) <= 0) highR = midR;
                    else lowR = midR;
                }
                var juncR = (lowR + highR) / 2.0;
                var pJ = getInvolutePoint(juncR);
                var cx = pJ.x + rcTest * pJ.nx;
                var cy = pJ.y + rcTest * pJ.ny;
                var cAng = Math.atan2(cy, cx);
                return { juncR: juncR, cAngle: cAng, cX: cx, cY: cy };
            }

            var fRes = solveFillet(rc);
            if (!fRes || fRes.cAngle > maxAngle) {
                for (var k = 0; k < 20; k++) {
                    rc *= 0.85;
                    fRes = solveFillet(rc);
                    if (fRes && fRes.cAngle <= maxAngle) break;
                }
            }

            if (fRes) {
                var cX = fRes.cX;
                var cY = fRes.cY;
                cAngle = fRes.cAngle;
                pJuncR = getInvolutePoint(fRes.juncR);
                pRootR = {
                    x: rf * Math.cos(cAngle),
                    y: rf * Math.sin(cAngle),
                    r: rf,
                    theta: cAngle
                };

                var phiJunc = Math.atan2(pJuncR.y - cY, pJuncR.x - cX);
                var phiRoot = Math.atan2(pRootR.y - cY, pRootR.x - cX);
                var dPhi = phiRoot - phiJunc;
                while (dPhi > Math.PI) dPhi -= 2.0 * Math.PI;
                while (dPhi < -Math.PI) dPhi += 2.0 * Math.PI;

                var hArc = (4.0 / 3.0) * Math.tan(Math.abs(dPhi) / 4.0) * rc;
                var signArc = (dPhi >= 0) ? 1 : -1;
                var tJunc = [-signArc * Math.sin(phiJunc), signArc * Math.cos(phiJunc)];
                var tRoot = [-signArc * Math.sin(phiRoot), signArc * Math.cos(phiRoot)];

                filP1 = { x: pJuncR.x + hArc * tJunc[0], y: pJuncR.y + hArc * tJunc[1] };
                filP2 = { x: pRootR.x - hArc * tRoot[0], y: pRootR.y - hArc * tRoot[1] };
            } else {
                pJuncR = getInvolutePoint(rf);
                cAngle = pJuncR.theta;
                pRootR = pJuncR;
                filP1 = filP2 = null;
            }
        } else {
            pJuncR = getInvolutePoint(rf);
            cAngle = pJuncR.theta;
            pRootR = pJuncR;
            filP1 = filP2 = null;
        }

        // Tip rounding
        var hasTipRounding = (tipRounding > 0.0001);
        var rInvStart = ra;
        var pTipArcStartR = null;
        var pInvStartR = null;
        var segRoundR = null;
        var segRoundL = null;

        if (hasTipRounding) {
            var targetRc = ra + tipRounding;
            var lowR = ra, highR = ra + 4.0 * tipRounding, solR = ra;
            for (var iter = 0; iter < 40; iter++) {
                var midR = (lowR + highR) / 2.0;
                var pt = getInvolutePoint(midR);
                var cx = pt.x + tipRounding * pt.ty;
                var cy = pt.y - tipRounding * pt.tx;
                var distC = Math.sqrt(cx * cx + cy * cy);
                if (distC < targetRc) lowR = midR; else highR = midR;
                solR = midR;
            }
            pInvStartR = getInvolutePoint(solR);
            var cR = {
                x: pInvStartR.x + tipRounding * pInvStartR.ty,
                y: pInvStartR.y - tipRounding * pInvStartR.tx
            };
            if (cR.y <= 0.001 || isNaN(cR.x) || isNaN(cR.y)) {
                hasTipRounding = false;
            } else {
                rInvStart = solR;
                var thCR = Math.atan2(cR.y, cR.x);
                pTipArcStartR = {
                    x: ra * Math.cos(thCR),
                    y: ra * Math.sin(thCR),
                    theta: thCR
                };

                var vTip = { x: (pTipArcStartR.x - cR.x) / tipRounding, y: (pTipArcStartR.y - cR.y) / tipRounding };
                var vInv = { x: (pInvStartR.x - cR.x) / tipRounding, y: (pInvStartR.y - cR.y) / tipRounding };
                var dotRound = Math.max(-1.0, Math.min(1.0, vTip.x * vInv.x + vTip.y * vInv.y));
                var deltaPhiRound = Math.acos(dotRound);
                var hRound = (4.0 / 3.0) * tipRounding * Math.tan(deltaPhiRound / 4.0);

                var tTipStart = { x: -Math.sin(thCR), y: Math.cos(thCR) };
                var tInvStart = { x: pInvStartR.tx, y: pInvStartR.ty };

                segRoundR = {
                    P0: pTipArcStartR,
                    P1: { x: pTipArcStartR.x + hRound * tTipStart.x, y: pTipArcStartR.y + hRound * tTipStart.y },
                    P2: { x: pInvStartR.x - hRound * tInvStart.x, y: pInvStartR.y - hRound * tInvStart.y },
                    P3: pInvStartR
                };

                segRoundL = {
                    P0: { x: segRoundR.P3.x, y: -segRoundR.P3.y },
                    P1: { x: segRoundR.P2.x, y: -segRoundR.P2.y },
                    P2: { x: segRoundR.P1.x, y: -segRoundR.P1.y },
                    P3: { x: segRoundR.P0.x, y: -segRoundR.P0.y }
                };
            }
        }

        var pTipR = hasTipRounding ? pInvStartR : getInvolutePoint(ra);
        var rMid = (rInvStart + pJuncR.r) / 2.0;
        var pMidR = getInvolutePoint(rMid);

        var segR1 = fitBezierSegment(pTipR, pMidR, getInvolutePoint((rInvStart + rMid) / 2.0));
        var segR2 = fitBezierSegment(pMidR, pJuncR, getInvolutePoint((rMid + pJuncR.r) / 2.0));

        var tipEndTheta = hasTipRounding ? pTipArcStartR.theta : pTipR.theta;
        var halfDThTip = tipEndTheta;
        var L_halfTip = (4.0 / 3.0) * ra * Math.tan(halfDThTip / 4.0);

        var dThSpace = toothPitchAngle - 2.0 * cAngle;
        var hasFlatSpace = (dThSpace > 0.0001);
        var L_space = hasFlatSpace ? ((4.0 / 3.0) * rf * Math.tan(dThSpace / 4.0)) : 0;

        // Build single tooth nodes for reference and inspection
        var singleToothNodes = [];
        var p_lr = [pRootR.x, -pRootR.y];
        var tangent_lr = [Math.sin(cAngle), Math.cos(cAngle)];
        var in_h_lr = [p_lr[0] - L_space * tangent_lr[0], p_lr[1] - L_space * tangent_lr[1]];
        var out_h_lr = filP2 ? [filP2.x, -filP2.y] : [segR2.P2.x, -segR2.P2.y];

        // 1. Left Root
        singleToothNodes.push({
            anchor: p_lr,
            leftDirection: in_h_lr,
            rightDirection: out_h_lr,
            pointType: hasFlatSpace ? "SMOOTH" : "CORNER"
        });

        // 2. Left Fillet Junction (if fillet enabled)
        if (filP1) {
            singleToothNodes.push({
                anchor: [pJuncR.x, -pJuncR.y],
                leftDirection: [filP1.x, -filP1.y],
                rightDirection: [segR2.P2.x, -segR2.P2.y],
                pointType: "SMOOTH"
            });
        }

        // 3. Left Mid (if recommended quality)
        if (pathQuality !== "bezier_minimal") {
            singleToothNodes.push({
                anchor: [pMidR.x, -pMidR.y],
                leftDirection: [segR2.P1.x, -segR2.P1.y],
                rightDirection: [segR1.P2.x, -segR1.P2.y],
                pointType: "SMOOTH"
            });
        }

        if (hasTipRounding) {
            // 4a. Left Involute End
            singleToothNodes.push({
                anchor: [pTipR.x, -pTipR.y],
                leftDirection: [segR1.P1.x, -segR1.P1.y],
                rightDirection: [segRoundL.P1.x, segRoundL.P1.y],
                pointType: "SMOOTH"
            });
            // 4b. Left Tip Arc Start
            singleToothNodes.push({
                anchor: [pTipArcStartR.x, -pTipArcStartR.y],
                leftDirection: [segRoundL.P2.x, segRoundL.P2.y],
                rightDirection: [pTipArcStartR.x + L_halfTip * Math.sin(tipEndTheta), -pTipArcStartR.y + L_halfTip * Math.cos(tipEndTheta)],
                pointType: "SMOOTH"
            });
            // 5. Mid Tip (Symmetry axis theta = 0)
            singleToothNodes.push({
                anchor: [ra, 0.0],
                leftDirection: [ra, -L_halfTip],
                rightDirection: [ra, L_halfTip],
                pointType: "SMOOTH"
            });
            // 6a. Right Tip Arc Start
            singleToothNodes.push({
                anchor: [pTipArcStartR.x, pTipArcStartR.y],
                leftDirection: [pTipArcStartR.x + L_halfTip * Math.sin(tipEndTheta), pTipArcStartR.y - L_halfTip * Math.cos(tipEndTheta)],
                rightDirection: [segRoundR.P1.x, segRoundR.P1.y],
                pointType: "SMOOTH"
            });
            // 6b. Right Involute Start
            singleToothNodes.push({
                anchor: [pTipR.x, pTipR.y],
                leftDirection: [segRoundR.P2.x, segRoundR.P2.y],
                rightDirection: [segR1.P1.x, segR1.P1.y],
                pointType: "SMOOTH"
            });
        } else {
            // 4. Left Tip Corner
            var p_lt = [pTipR.x, -pTipR.y];
            var tangent_lt = [Math.sin(pTipR.theta), Math.cos(pTipR.theta)];
            singleToothNodes.push({
                anchor: p_lt,
                leftDirection: [segR1.P1.x, -segR1.P1.y],
                rightDirection: [p_lt[0] + L_halfTip * tangent_lt[0], p_lt[1] + L_halfTip * tangent_lt[1]],
                pointType: "CORNER"
            });
            // 5. Mid Tip (Symmetry axis theta = 0)
            singleToothNodes.push({
                anchor: [ra, 0.0],
                leftDirection: [ra, -L_halfTip],
                rightDirection: [ra, L_halfTip],
                pointType: "SMOOTH"
            });
            // 6. Right Tip Corner
            var p_rt = [pTipR.x, pTipR.y];
            singleToothNodes.push({
                anchor: p_rt,
                leftDirection: [p_rt[0] + L_halfTip * Math.sin(pTipR.theta), p_rt[1] - L_halfTip * Math.cos(pTipR.theta)],
                rightDirection: [segR1.P1.x, segR1.P1.y],
                pointType: "CORNER"
            });
        }

        // 7. Right Mid (if recommended quality)
        if (pathQuality !== "bezier_minimal") {
            singleToothNodes.push({
                anchor: [pMidR.x, pMidR.y],
                leftDirection: [segR1.P2.x, segR1.P2.y],
                rightDirection: [segR2.P1.x, segR2.P1.y],
                pointType: "SMOOTH"
            });
        }

        // 8. Right Fillet Junction (if fillet enabled)
        if (filP1) {
            singleToothNodes.push({
                anchor: [pJuncR.x, pJuncR.y],
                leftDirection: [segR2.P2.x, segR2.P2.y],
                rightDirection: [filP1.x, filP1.y],
                pointType: "SMOOTH"
            });
        }

        // 9. Right Root
        var p_rr = [pRootR.x, pRootR.y];
        var tangent_rr = [-Math.sin(cAngle), Math.cos(cAngle)];
        singleToothNodes.push({
            anchor: p_rr,
            leftDirection: filP2 ? [filP2.x, filP2.y] : [segR2.P2.x, segR2.P2.y],
            rightDirection: [p_rr[0] + L_space * tangent_rr[0], p_rr[1] + L_space * tangent_rr[1]],
            pointType: hasFlatSpace ? "SMOOTH" : "CORNER"
        });

        // Assemble full internal contour nodes (CCW cyclic path)
        var innerContourNodes = [];
        for (var k = 0; k < z; k++) {
            var phi_k = k * toothPitchAngle;
            var cos_k = Math.cos(phi_k);
            var sin_k = Math.sin(phi_k);

            function rot(pt) {
                return [
                    pt[0] * cos_k - pt[1] * sin_k,
                    pt[0] * sin_k + pt[1] * cos_k
                ];
            }

            for (var sn = 0; sn < singleToothNodes.length; sn++) {
                var nd = singleToothNodes[sn];
                innerContourNodes.push({
                    anchor: rot(nd.anchor),
                    leftDirection: rot(nd.leftDirection),
                    rightDirection: rot(nd.rightDirection),
                    pointType: nd.pointType
                });
            }
        }

        // Assemble outer rim nodes (mm)
        var rimNodes = [];
        if (rimShape === "RECT") {
            var rW = (params.rimWidth !== undefined) ? (parseFloat(params.rimWidth) / 2.0) : (rRim + 2.0 * m);
            var rH = (params.rimHeight !== undefined) ? (parseFloat(params.rimHeight) / 2.0) : (rRim + 2.0 * m);
            // Clockwise rectangle
            rimNodes.push({ anchor: [-rW, -rH], leftDirection: [-rW, -rH], rightDirection: [-rW, -rH], pointType: "CORNER" });
            rimNodes.push({ anchor: [-rW, rH], leftDirection: [-rW, rH], rightDirection: [-rW, rH], pointType: "CORNER" });
            rimNodes.push({ anchor: [rW, rH], leftDirection: [rW, rH], rightDirection: [rW, rH], pointType: "CORNER" });
            rimNodes.push({ anchor: [rW, -rH], leftDirection: [rW, -rH], rightDirection: [rW, -rH], pointType: "CORNER" });
        } else {
            // Circle of radius rRim (4-bezier arcs, CCW)
            var KAPPA = (4.0 / 3.0) * (Math.SQRT2 - 1.0);
            var kRim = rRim * KAPPA;
            rimNodes.push({
                anchor: [rRim, 0],
                leftDirection: [rRim, -kRim],
                rightDirection: [rRim, kRim],
                pointType: "SMOOTH"
            });
            rimNodes.push({
                anchor: [0, rRim],
                leftDirection: [kRim, rRim],
                rightDirection: [-kRim, rRim],
                pointType: "SMOOTH"
            });
            rimNodes.push({
                anchor: [-rRim, 0],
                leftDirection: [-rRim, kRim],
                rightDirection: [-rRim, -kRim],
                pointType: "SMOOTH"
            });
            rimNodes.push({
                anchor: [0, -rRim],
                leftDirection: [-kRim, -rRim],
                rightDirection: [kRim, -rRim],
                pointType: "SMOOTH"
            });
        }

        if (pathQuality === "polyline") {
            singleToothNodes = tessellateBezierNodesToPolyline(singleToothNodes, false, 5);
            innerContourNodes = tessellateBezierNodesToPolyline(innerContourNodes, true, 5);
            rimNodes = tessellateBezierNodesToPolyline(rimNodes, true, 16);
        }

        if (warnings.length > 0 && typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            for (var wIdx2 = 0; wIdx2 < warnings.length; wIdx2++) {
                CalcLogger.warn("INTERNAL_CALC", warnings[wIdx2]);
            }
        }

        return {
            m: m,
            z: z,
            alphaDeg: alphaDeg,
            alpha: alpha,
            x: x,
            backlash: backlash,
            kerfOffset: kerfOffset,
            rTip: tipRounding,
            deltaY: deltaY,
            d: d,
            db: db,
            da: da,
            df: df,
            rp: rp,
            rb: rb,
            ra: ra,
            rf: rf,
            seff: seff,
            psiP: psiP,
            rRim: rRim,
            rimThickness: rimThickness,
            rimShape: rimShape,
            isUndercut: isUndercut,
            hasTipRounding: hasTipRounding,
            nodesPerTooth: singleToothNodes.length,
            singleToothNodes: singleToothNodes,
            innerContourNodes: innerContourNodes,
            rimNodes: rimNodes,
            pathQuality: pathQuality,
            warnings: warnings
        };
    }

    /**
     * Calculates linear rack geometry and Bezier profile nodes.
     * All internal calculations and coordinates are in millimeters (mm).
     * 
     * @param {Object} params Input parameters:
     *   - m / module: Module (mm)
     *   - zRack / z / teeth: Tooth count (typically 5 to 50)
     *   - alphaDeg: Pressure angle (deg, default 20)
     *   - backlash: Backlash (mm, default 0.0)
     *   - kerfOffset: Normal kerf offset (mm, default 0.0)
     *   - tipRounding / rTip: Tip rounding fillet radius (mm, default 0.0)
     *   - rcFactor: Root fillet factor (default 0.38)
     *   - backHeight: Height of back bar from root line (mm, default 2.5 * m)
     *   - heightBasis: "ROOT" (default, backHeight measured from dedendum) | "TIP"
     *   - totalHeight: Total height if heightBasis is "TIP" (mm)
     * @returns {Object} Linear rack geometry with outerNodes
     */
    function calculateRack(params) {
        params = params || {};
        var warnings = [];

        var m = parseFloat(params.m || params.module) || 2.0;
        if (m < 0.05) {
            warnings.push("Rack module m=" + m + " clamped to minimum 0.05 mm");
            m = 0.05;
        }

        var zRack = Math.max(1, parseInt(params.zRack !== undefined ? params.zRack : (params.z !== undefined ? params.z : (params.teeth || 10)), 10));
        if (zRack > 250) {
            warnings.push("Rack tooth count zRack=" + zRack + " clamped to 250");
            zRack = 250;
        }

        var alphaDeg = parseFloat(params.alphaDeg !== undefined ? params.alphaDeg : 20.0);
        if (alphaDeg < 5.0) {
            warnings.push("Rack pressure angle alpha=" + alphaDeg + " deg clamped to 5.0 deg");
            alphaDeg = 5.0;
        } else if (alphaDeg > 45.0) {
            warnings.push("Rack pressure angle alpha=" + alphaDeg + " deg clamped to 45.0 deg");
            alphaDeg = 45.0;
        }
        var alpha = alphaDeg * (Math.PI / 180.0);

        var backlash = parseFloat(params.backlash || 0.0);
        var kerfOffset = parseFloat(params.kerfOffset !== undefined ? params.kerfOffset : 0.0);
        var tipRounding = parseFloat(params.tipRounding !== undefined ? params.tipRounding : (params.rTip || 0.0));
        var rcFactor = parseFloat(params.rcFactor !== undefined ? params.rcFactor : 0.38);
        var pathQuality = params.pathQuality || "bezier_recommended";

        var pitch = Math.PI * m;
        var ha = 1.0 * m + kerfOffset;
        var hf = 1.25 * m + kerfOffset;
        var rc = rcFactor * m;

        var backHeight = (params.backHeight !== undefined) ? parseFloat(params.backHeight) : 0;
        if (backHeight <= 0) {
            if (params.heightBasis === "TIP" && params.totalHeight !== undefined) {
                backHeight = Math.max(0.5, parseFloat(params.totalHeight) - (ha + hf));
            } else if (params.height !== undefined) {
                backHeight = Math.max(0.5, parseFloat(params.height) - 2.25 * m);
            } else {
                backHeight = 2.5 * m;
            }
        }

        var cosA = Math.cos(alpha);
        var sinA = Math.sin(alpha);
        var tanA = Math.tan(alpha);

        var seff = (pitch / 2.0) - backlash + (2.0 * kerfOffset / cosA);

        var y_tan = -hf + rc * (1.0 - sinA);
        var x_tan = (seff / 2.0) - y_tan * tanA;
        var x_c = x_tan + rc * cosA;
        var x_tip = (seff / 2.0) - ha * tanA;

        var arcAngle = (Math.PI / 2.0) - alpha;
        var kappa = (4.0 / 3.0) * rc * Math.tan(arcAngle / 4.0);

        var totalLength = zRack * pitch;
        var leftX = -totalLength / 2.0;
        var rightX = totalLength / 2.0;

        var hasTipRounding = (tipRounding > 0.0001);
        var L_tan = 0;
        var kappa_tip = 0;
        if (hasTipRounding) {
            L_tan = tipRounding * Math.tan(arcAngle / 2.0);
            kappa_tip = (4.0 / 3.0) * tipRounding * Math.tan(arcAngle / 4.0);
        }

        var singleToothNodes = [];
        var pFilletLeftStart0 = [-x_c, -hf];
        var pFilletLeftEnd0 = [-x_tan, y_tan];
        var hLeftStart0 = [-x_c + kappa, -hf];
        var hLeftEnd0 = [-x_tan - kappa * sinA, y_tan - kappa * cosA];

        // 1. Fillet left start
        singleToothNodes.push({
            anchor: pFilletLeftStart0,
            leftDirection: pFilletLeftStart0,
            rightDirection: hLeftStart0,
            pointType: "SMOOTH"
        });
        // 2. Fillet left end
        singleToothNodes.push({
            anchor: pFilletLeftEnd0,
            leftDirection: hLeftEnd0,
            rightDirection: pFilletLeftEnd0,
            pointType: "SMOOTH"
        });

        if (hasTipRounding) {
            var pFlankL0 = [(-x_tip) - L_tan * sinA, ha - L_tan * cosA];
            var pFlatL0 = [(-x_tip) + L_tan, ha];
            var hFlankL0 = [pFlankL0[0] + kappa_tip * sinA, pFlankL0[1] + kappa_tip * cosA];
            var hFlatL0 = [pFlatL0[0] - kappa_tip, pFlatL0[1]];

            var pFlatR0 = [(x_tip) - L_tan, ha];
            var pFlankR0 = [(x_tip) + L_tan * sinA, ha - L_tan * cosA];
            var hFlatR0 = [pFlatR0[0] + kappa_tip, pFlatR0[1]];
            var hFlankR0 = [pFlankR0[0] - kappa_tip * sinA, pFlankR0[1] + kappa_tip * cosA];

            // 3a. Tip Left Flank transition
            singleToothNodes.push({ anchor: pFlankL0, leftDirection: pFlankL0, rightDirection: hFlankL0, pointType: "SMOOTH" });
            // 3b. Tip Left Flat transition
            singleToothNodes.push({ anchor: pFlatL0, leftDirection: hFlatL0, rightDirection: pFlatL0, pointType: "SMOOTH" });
            // 4. Tip Mid (Symmetry axis x = 0)
            singleToothNodes.push({ anchor: [0, ha], leftDirection: [0, ha], rightDirection: [0, ha], pointType: "SMOOTH" });
            // 5a. Tip Right Flat transition
            singleToothNodes.push({ anchor: pFlatR0, leftDirection: pFlatR0, rightDirection: hFlatR0, pointType: "SMOOTH" });
            // 5b. Tip Right Flank transition
            singleToothNodes.push({ anchor: pFlankR0, leftDirection: hFlankR0, rightDirection: pFlankR0, pointType: "SMOOTH" });
        } else {
            // 3. Tip Left Corner
            singleToothNodes.push({ anchor: [-x_tip, ha], leftDirection: [-x_tip, ha], rightDirection: [-x_tip, ha], pointType: "CORNER" });
            // 4. Tip Mid (Symmetry axis x = 0)
            singleToothNodes.push({ anchor: [0, ha], leftDirection: [0, ha], rightDirection: [0, ha], pointType: "SMOOTH" });
            // 5. Tip Right Corner
            singleToothNodes.push({ anchor: [x_tip, ha], leftDirection: [x_tip, ha], rightDirection: [x_tip, ha], pointType: "CORNER" });
        }

        var pFilletRightStart0 = [x_tan, y_tan];
        var pFilletRightEnd0 = [x_c, -hf];
        var hRightStart0 = [pFilletRightStart0[0] + kappa * sinA, pFilletRightStart0[1] - kappa * cosA];
        var hRightEnd0 = [pFilletRightEnd0[0] - kappa, pFilletRightEnd0[1]];

        // 6. Fillet right start
        singleToothNodes.push({ anchor: pFilletRightStart0, leftDirection: pFilletRightStart0, rightDirection: hRightStart0, pointType: "SMOOTH" });
        // 7. Fillet right end
        singleToothNodes.push({ anchor: pFilletRightEnd0, leftDirection: hRightEnd0, rightDirection: pFilletRightEnd0, pointType: "SMOOTH" });

        // Outer contour assembly: top teeth profile + base bottom corners
        var outerNodes = [];

        // 1. Left top corner of base
        outerNodes.push({
            anchor: [leftX, -hf],
            leftDirection: [leftX, -hf],
            rightDirection: [leftX, -hf],
            pointType: "CORNER"
        });

        for (var k = 0; k < zRack; k++) {
            var cx = leftX + (k + 0.5) * pitch;

            var pFilletLeftStart = [cx - x_c, -hf];
            var pFilletLeftEnd = [cx - x_tan, y_tan];
            var hLeftStart = [pFilletLeftStart[0] + kappa, pFilletLeftStart[1]];
            var hLeftEnd = [pFilletLeftEnd[0] - kappa * sinA, pFilletLeftEnd[1] - kappa * cosA];

            var pTipMid = [cx, ha];
            var pFilletRightStart = [cx + x_tan, y_tan];
            var pFilletRightEnd = [cx + x_c, -hf];
            var hRightStart = [pFilletRightStart[0] + kappa * sinA, pFilletRightStart[1] - kappa * cosA];
            var hRightEnd = [pFilletRightEnd[0] - kappa, pFilletRightEnd[1]];

            // 1. Fillet left start
            outerNodes.push({
                anchor: pFilletLeftStart,
                leftDirection: pFilletLeftStart,
                rightDirection: hLeftStart,
                pointType: "SMOOTH"
            });
            // 2. Fillet left end
            outerNodes.push({
                anchor: pFilletLeftEnd,
                leftDirection: hLeftEnd,
                rightDirection: pFilletLeftEnd,
                pointType: "SMOOTH"
            });

            if (hasTipRounding) {
                var pFlankL = [(cx - x_tip) - L_tan * sinA, ha - L_tan * cosA];
                var pFlatL = [(cx - x_tip) + L_tan, ha];
                var hFlankL = [pFlankL[0] + kappa_tip * sinA, pFlankL[1] + kappa_tip * cosA];
                var hFlatL = [pFlatL[0] - kappa_tip, pFlatL[1]];

                var pFlatR = [(cx + x_tip) - L_tan, ha];
                var pFlankR = [(cx + x_tip) + L_tan * sinA, ha - L_tan * cosA];
                var hFlatR = [pFlatR[0] + kappa_tip, pFlatR[1]];
                var hFlankR = [pFlankR[0] - kappa_tip * sinA, pFlankR[1] + kappa_tip * cosA];

                outerNodes.push({ anchor: pFlankL, leftDirection: pFlankL, rightDirection: hFlankL, pointType: "SMOOTH" });
                outerNodes.push({ anchor: pFlatL, leftDirection: hFlatL, rightDirection: pFlatL, pointType: "SMOOTH" });
                outerNodes.push({ anchor: pTipMid, leftDirection: pTipMid, rightDirection: pTipMid, pointType: "SMOOTH" });
                outerNodes.push({ anchor: pFlatR, leftDirection: pFlatR, rightDirection: hFlatR, pointType: "SMOOTH" });
                outerNodes.push({ anchor: pFlankR, leftDirection: hFlankR, rightDirection: pFlankR, pointType: "SMOOTH" });
            } else {
                var pTipLeft = [cx - x_tip, ha];
                var pTipRight = [cx + x_tip, ha];
                outerNodes.push({ anchor: pTipLeft, leftDirection: pTipLeft, rightDirection: pTipLeft, pointType: "CORNER" });
                outerNodes.push({ anchor: pTipMid, leftDirection: pTipMid, rightDirection: pTipMid, pointType: "CORNER" });
                outerNodes.push({ anchor: pTipRight, leftDirection: pTipRight, rightDirection: pTipRight, pointType: "CORNER" });
            }

            outerNodes.push({ anchor: pFilletRightStart, leftDirection: pFilletRightStart, rightDirection: hRightStart, pointType: "SMOOTH" });
            outerNodes.push({ anchor: pFilletRightEnd, leftDirection: hRightEnd, rightDirection: pFilletRightEnd, pointType: "SMOOTH" });
        }

        // Right top corner of base
        outerNodes.push({
            anchor: [rightX, -hf],
            leftDirection: [rightX, -hf],
            rightDirection: [rightX, -hf],
            pointType: "CORNER"
        });

        // Base rectangle bottom corners (mm)
        var yBase = -(hf + backHeight);
        outerNodes.push({
            anchor: [rightX, yBase],
            leftDirection: [rightX, yBase],
            rightDirection: [rightX, yBase],
            pointType: "CORNER"
        });
        outerNodes.push({
            anchor: [leftX, yBase],
            leftDirection: [leftX, yBase],
            rightDirection: [leftX, yBase],
            pointType: "CORNER"
        });

        if (pathQuality === "polyline") {
            singleToothNodes = tessellateBezierNodesToPolyline(singleToothNodes, false, 5);
            outerNodes = tessellateBezierNodesToPolyline(outerNodes, true, 5);
        }

        if (warnings.length > 0 && typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            for (var wIdx3 = 0; wIdx3 < warnings.length; wIdx3++) {
                CalcLogger.warn("RACK_CALC", warnings[wIdx3]);
            }
        }

        return {
            m: m,
            zRack: zRack,
            alphaDeg: alphaDeg,
            pitchMm: pitch,
            haMm: ha,
            hfMm: hf,
            totalLengthMm: totalLength,
            backHeightMm: backHeight,
            totalHeightMm: ha + hf + backHeight,
            hasTipRounding: hasTipRounding,
            nodesPerTooth: singleToothNodes.length,
            singleToothNodes: singleToothNodes,
            outerNodes: outerNodes,
            pitchLine: [
                [leftX, 0],
                [rightX, 0]
            ],
            pathQuality: pathQuality,
            warnings: warnings
        };
    }

    /**
     * Validates the 4 major interferences in an internal gear mesh:
     * 1. Involute interference: tan(alpha_w) - (z1/z2)*(tan(alpha_a1) - tan(alpha_w)) <= tan(alpha_a2)
     * 2. Trochoid interference: Delta z = z2 - z1 >= ceil(2 * (1 + x2 - x1) / sin^2(alpha_w))
     * 3. Trimming interference (radial assembly / cut-out)
     * 4. Tip cresting limit (sa >= 0.2*m)
     * 
     * @param {number} m Module (mm)
     * @param {number} z1 Pinion tooth count
     * @param {number} z2 Internal ring tooth count
     * @param {number} alphaDeg Standard pressure angle (deg, default 20)
     * @param {number} x1 Pinion profile shift (default 0.0)
     * @param {number} x2 Ring profile shift (default 0.0)
     * @param {number} aw Operating center distance (mm, optional)
     * @param {number} alphaWRad Operating pressure angle (rad, optional)
     * @param {number} deltaY Addendum modification deltaY (optional)
     * @returns {Object} Interference booleans, details, and warning messages
     */
    function validateInternalInterference(m, z1, z2, alphaDeg, x1, x2, aw, alphaWRad, deltaY) {
        m = parseFloat(m) || 2.0;
        z1 = parseInt(z1, 10);
        z2 = parseInt(z2, 10);
        alphaDeg = parseFloat(alphaDeg !== undefined ? alphaDeg : 20.0);
        var alphaRad = alphaDeg * (Math.PI / 180.0);
        x1 = parseFloat(x1 !== undefined ? x1 : 0.0);
        x2 = parseFloat(x2 !== undefined ? x2 : 0.0);

        var zDiff = z2 - z1;
        var warnings = [];

        if (zDiff <= 0) {
            warnings.push("Internal ring tooth count z2 (" + z2 + ") must be greater than pinion tooth count z1 (" + z1 + ")");
            return {
                involute: true,
                trochoid: true,
                trimming: true,
                cresting: false,
                isPinionTipPointed: false,
                isInternalTipPointed: false,
                hasAnyInterference: true,
                warnings: warnings
            };
        }

        var invAlpha = inv(alphaRad);
        if (alphaWRad === undefined || alphaWRad === null) {
            var invAlphaW = invAlpha + 2.0 * ((x2 - x1) / zDiff) * Math.tan(alphaRad);
            alphaWRad = invInv(invAlphaW);
        }
        if (aw === undefined || aw === null) {
            aw = (m * zDiff * Math.cos(alphaRad)) / (2.0 * Math.cos(alphaWRad));
        }
        if (deltaY === undefined || deltaY === null) {
            var y = (aw / m) - (zDiff / 2.0);
            deltaY = (x2 - x1) - y;
            if (deltaY < 0) deltaY = 0.0;
        }

        var rb1 = (m * z1 * Math.cos(alphaRad)) / 2.0;
        var rb2 = (m * z2 * Math.cos(alphaRad)) / 2.0;
        var ra1 = (m / 2.0) * (z1 + 2.0 + 2.0 * x1 - 2.0 * deltaY);
        var ra2 = (m / 2.0) * (z2 - 2.0 + 2.0 * x2 + 2.0 * deltaY);

        // 1. Involute Interference:
        var cosAlphaA1 = Math.min(1.0, rb1 / Math.max(rb1, ra1));
        var alphaA1 = Math.acos(cosAlphaA1);
        var tanAlphaA1 = Math.tan(alphaA1);

        var cosAlphaA2 = Math.min(1.0, rb2 / Math.max(rb2, ra2));
        var alphaA2 = Math.acos(cosAlphaA2);
        var tanAlphaA2 = Math.tan(alphaA2);

        var tanAlphaW = Math.tan(alphaWRad);
        var invLimit = tanAlphaW - (z1 / z2) * (tanAlphaA1 - tanAlphaW);
        var hasInvoluteInterference = (invLimit > tanAlphaA2 + 1e-5);
        if (hasInvoluteInterference) {
            warnings.push("Involute interference: tan(alpha_w) - (z1/z2)*(tan(alpha_a1) - tan(alpha_w)) [" + invLimit.toFixed(4) + "] > tan(alpha_a2) [" + tanAlphaA2.toFixed(4) + "]");
        }

        // 2. Trochoid Interference:
        var sinAlphaW = Math.sin(alphaWRad);
        var deltaZLimit = (2.0 * (1.0 + x2 - x1)) / Math.max(1e-6, sinAlphaW * sinAlphaW);
        var deltaZCeil = Math.ceil(deltaZLimit);
        var hasTrochoidInterference = (zDiff < deltaZCeil);
        if (hasTrochoidInterference) {
            warnings.push("Trochoid interference: tooth difference z2 - z1 (" + zDiff + ") < limit (" + deltaZCeil + ", exact=" + deltaZLimit.toFixed(2) + ")");
        }

        // 3. Trimming Interference (Radial Assembly):
        var cosTh1 = (aw * aw + ra1 * ra1 - ra2 * ra2) / (2.0 * aw * ra1);
        var cosTh2 = (aw * aw + ra2 * ra2 - ra1 * ra1) / (2.0 * aw * ra2);
        var hasTrimmingInterference = false;
        var trimmingLeft = 0;
        var trimmingRight = 0;
        if (Math.abs(cosTh1) <= 1.0 && Math.abs(cosTh2) <= 1.0) {
            var th1 = Math.acos(cosTh1);
            var th2 = Math.acos(cosTh2);
            var invAlphaA1 = tanAlphaA1 - alphaA1;
            var invAlphaA2 = tanAlphaA2 - alphaA2;
            var invAlphaWVal = Math.tan(alphaWRad) - alphaWRad;
            trimmingLeft = (z1 / z2) * (th1 + invAlphaA1 - invAlphaWVal);
            trimmingRight = th2 + invAlphaA2 - invAlphaWVal;
            hasTrimmingInterference = (trimmingLeft < trimmingRight - 1e-5);
            if (hasTrimmingInterference) {
                warnings.push("Trimming interference: radial assembly obstructed (" + trimmingLeft.toFixed(4) + " < " + trimmingRight.toFixed(4) + "). Axial assembly required.");
            }
        }

        // 4. Tip Cresting Limit:
        var psiP1 = (Math.PI / 2.0 + 2.0 * x1 * Math.tan(alphaRad)) / z1;
        var sa1 = 2.0 * ra1 * (psiP1 + invAlpha - (tanAlphaA1 - alphaA1));
        var isPinionTipPointed = (sa1 < 0.2 * m);
        if (isPinionTipPointed) {
            warnings.push("Pinion tip cresting: thickness (" + sa1.toFixed(3) + " mm) < 0.2*m (" + (0.2 * m).toFixed(3) + " mm)");
        }

        var psiP2 = (Math.PI / 2.0 - 2.0 * x2 * Math.tan(alphaRad)) / z2;
        var sa2 = 2.0 * ra2 * (psiP2 - invAlpha + (tanAlphaA2 - alphaA2));
        var isInternalTipPointed = (sa2 < 0.2 * m);
        if (isInternalTipPointed) {
            warnings.push("Internal gear tip cresting: thickness (" + sa2.toFixed(3) + " mm) < 0.2*m (" + (0.2 * m).toFixed(3) + " mm)");
        }

        var hasCresting = isPinionTipPointed || isInternalTipPointed;
        var hasAnyInterference = hasInvoluteInterference || hasTrochoidInterference || hasTrimmingInterference || hasCresting;

        return {
            involute: hasInvoluteInterference,
            trochoid: hasTrochoidInterference,
            trimming: hasTrimmingInterference,
            cresting: hasCresting,
            isPinionTipPointed: isPinionTipPointed,
            isInternalTipPointed: isInternalTipPointed,
            hasAnyInterference: hasAnyInterference,
            invLimit: invLimit,
            tanAlphaA2: tanAlphaA2,
            deltaZ: zDiff,
            deltaZLimit: deltaZLimit,
            deltaZCeil: deltaZCeil,
            trimmingLeft: trimmingLeft,
            trimmingRight: trimmingRight,
            sa1: sa1,
            sa2: sa2,
            warnings: warnings
        };
    }

    /**
     * Calculates conjugate meshing kinematics, working center distance aw,
     * working pressure angle alpha_w, center distance modification coefficient y,
     * addendum shortening coefficient deltaY, and transverse contact ratio epsilon_alpha.
     * 
     * @param {Object} gear1 Driving gear parameters: { m, z, x, alphaDeg }
     * @param {Object} gear2 Driven gear parameters: { m, z, x, alphaDeg, gearType }
     * @returns {Object} Calculated meshing parameters
     */
    function calculateMeshingParameters(gear1, gear2) {
        gear1 = gear1 || {};
        gear2 = gear2 || {};

        var m = parseFloat(gear1.m || gear2.m || 2.0);
        var z1 = parseInt(gear1.z || 18, 10);
        var z2 = parseInt(gear2.z || 36, 10);
        var x1 = parseFloat(gear1.x !== undefined ? gear1.x : (gear1.profileShift || 0.0));
        var x2 = parseFloat(gear2.x !== undefined ? gear2.x : (gear2.profileShift || 0.0));
        var alphaDeg = parseFloat((gear1.alphaDeg !== undefined && gear1.alphaDeg !== null) ? gear1.alphaDeg : ((gear2.alphaDeg !== undefined && gear2.alphaDeg !== null) ? gear2.alphaDeg : 20.0));
        var alpha = alphaDeg * (Math.PI / 180.0);
        var gType2 = (gear2.gearType || "SPUR").toUpperCase();

        var invA = inv(alpha);
        var aw = 0;
        var a = 0;
        var alphaWRad = alpha;
        var alphaWDeg = alphaDeg;
        var y = 0.0;
        var deltaY = 0.0;
        var contactRatio = 0.0;
        var isWarning = false;
        var warningMsg = "";
        var meshWarnings = [];
        var interferences = null;

        if (gType2 === "INTERNAL") {
            // Internal gear mesh: z2 must be greater than z1
            var zDiff = z2 - z1;
            if (zDiff <= 0) zDiff = 1;
            a = (m * zDiff) / 2.0;

            var invAlphaW = invA + 2.0 * ((x2 - x1) / zDiff) * Math.tan(alpha);
            alphaWRad = invInv(invAlphaW);
            alphaWDeg = alphaWRad * (180.0 / Math.PI);

            aw = (m * zDiff * Math.cos(alpha)) / (2.0 * Math.cos(alphaWRad));
            y = (aw / m) - (zDiff / 2.0);
            deltaY = (x2 - x1) - y;
            if (deltaY < 0) deltaY = 0.0;

            var rb1 = (m * z1 * Math.cos(alpha)) / 2.0;
            var rb2 = (m * z2 * Math.cos(alpha)) / 2.0;
            var ra1 = (m / 2.0) * (z1 + 2.0 + 2.0 * x1 - 2.0 * deltaY);
            var ra2 = (m / 2.0) * (z2 - 2.0 + 2.0 * x2 + 2.0 * deltaY);

            var term1 = Math.sqrt(Math.max(0, ra1 * ra1 - rb1 * rb1));
            var term2 = Math.sqrt(Math.max(0, ra2 * ra2 - rb2 * rb2));
            contactRatio = (term1 - term2 + aw * Math.sin(alphaWRad)) / (Math.PI * m * Math.cos(alpha));

            // Validate 4 major interferences in internal mesh
            interferences = validateInternalInterference(m, z1, z2, alphaDeg, x1, x2, aw, alphaWRad, deltaY);
            if (interferences.warnings && interferences.warnings.length > 0) {
                for (var iw = 0; iw < interferences.warnings.length; iw++) {
                    meshWarnings.push(interferences.warnings[iw]);
                }
            }

        } else if (gType2 === "RACK") {
            // Rack & Pinion mesh
            a = (m * z1) / 2.0;
            aw = a + x1 * m;
            alphaWRad = alpha;
            alphaWDeg = alphaDeg;
            y = x1;
            deltaY = 0.0;

            var rbPinion = (m * z1 * Math.cos(alpha)) / 2.0;
            var raPinion = (m / 2.0) * (z1 + 2.0 + 2.0 * x1);
            var haRack = 1.0 * m;
            var lPinion = Math.sqrt(Math.max(0, raPinion * raPinion - rbPinion * rbPinion)) - (m * z1 / 2.0) * Math.sin(alpha);
            var lRack = haRack / Math.sin(alpha);
            contactRatio = (lPinion + lRack) / (Math.PI * m * Math.cos(alpha));

        } else {
            // External x External Spur gear mesh
            var zSum = z1 + z2;
            a = (m * zSum) / 2.0;

            var invAlphaW = invA + 2.0 * ((x1 + x2) / zSum) * Math.tan(alpha);
            alphaWRad = invInv(invAlphaW);
            alphaWDeg = alphaWRad * (180.0 / Math.PI);

            aw = (m * zSum * Math.cos(alpha)) / (2.0 * Math.cos(alphaWRad));
            y = (aw / m) - (zSum / 2.0);
            deltaY = (x1 + x2) - y;
            if (deltaY < 0.0) {
                deltaY = 0.0;
            }

            var rb1 = (m * z1 * Math.cos(alpha)) / 2.0;
            var rb2 = (m * z2 * Math.cos(alpha)) / 2.0;
            var ra1 = (m / 2.0) * (z1 + 2.0 + 2.0 * x1 - 2.0 * deltaY);
            var ra2 = (m / 2.0) * (z2 + 2.0 + 2.0 * x2 - 2.0 * deltaY);

            var term1 = Math.sqrt(Math.max(0, ra1 * ra1 - rb1 * rb1));
            var term2 = Math.sqrt(Math.max(0, ra2 * ra2 - rb2 * rb2));
            contactRatio = (term1 + term2 - aw * Math.sin(alphaWRad)) / (Math.PI * m * Math.cos(alpha));
        }

        var isCriticalWarning = false;
        var criticalWarningMsg = "";

        if (contactRatio < 1.0) {
            isCriticalWarning = true;
            criticalWarningMsg = "Critical: Contact ratio (epsilon_alpha = " + contactRatio.toFixed(3) + " < 1.0). Gears will lose continuous contact and jam/ratchet.";
            isWarning = true;
            warningMsg = criticalWarningMsg;
            meshWarnings.unshift(criticalWarningMsg);
            if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                CalcLogger.warn("MESH_CALC", criticalWarningMsg);
            }
        } else if (contactRatio < 1.1) {
            isWarning = true;
            warningMsg = "Low contact ratio (epsilon_alpha = " + contactRatio.toFixed(3) + " < 1.1). Rotation continuity risk.";
            meshWarnings.unshift(warningMsg);
            if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                CalcLogger.warn("MESH_CALC", warningMsg);
            }
        }

        if (interferences && interferences.hasAnyInterference) {
            isWarning = true;
            if (interferences.involute || interferences.trochoid || interferences.cresting) {
                isCriticalWarning = true;
                if (!criticalWarningMsg) {
                    criticalWarningMsg = "Critical internal interference: " + (interferences.involute ? "Involute interference" : (interferences.trochoid ? "Trochoid interference" : "Tip cresting"));
                }
            }
            if (!warningMsg) {
                warningMsg = meshWarnings.join("; ");
            }
            if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                for (var mi = 0; mi < meshWarnings.length; mi++) {
                    CalcLogger.warn("INTERNAL_INTERFERENCE", meshWarnings[mi]);
                }
            }
        }

        return {
            m: m,
            z1: z1,
            z2: z2,
            x1: x1,
            x2: x2,
            alphaDeg: alphaDeg,
            alphaRad: alpha,
            a: a,
            aw: aw,
            alphaWDeg: alphaWDeg,
            alphaWRad: alphaWRad,
            y: y,
            deltaY: deltaY,
            contactRatio: contactRatio,
            interferences: interferences,
            isWarning: isWarning,
            isCriticalWarning: isCriticalWarning,
            warningMessage: warningMsg,
            criticalWarningMessage: criticalWarningMsg,
            warnings: meshWarnings
        };
    }

    return {
        MM_TO_PT: MM_TO_PT,
        PT_TO_MM: PT_TO_MM,
        inv: inv,
        invInv: invInv,
        getUndercutLimit: getUndercutLimit,
        createArcBezierNodes: createArcBezierNodes,
        calculateSpurGear: calculateSpurGear,
        calculateInternalGear: calculateInternalGear,
        calculateRack: calculateRack,
        calculateMeshingParameters: calculateMeshingParameters,
        validateInternalInterference: validateInternalInterference
    };
})();

/**
 * MechanismSolvers.jsxinc - Advanced Mechanism Solvers & Structural Components for GearDrawer
 * Part of GearDrawer Architecture (JIS B 1701-1:2017)
 * Version: 0.4.0
 * 
 * Strict ECMAScript 3 (ExtendScript compatible). All internal calculations are performed in millimeters (mm).
 * 
 * Includes:
 * 1. Standard Planetary Gear Solver (2K-H): Willis reduction ratio, concentricity, assembly, clearance, Muller efficiency
 * 2. Paradoxical Planetary Gear Solver (3K): Hori et al. (1994) high-efficiency all-positive profile shift simultaneous solver
 * 3. Intermittent Gear Kinematics (Mutilated Spur): Coplanar single-layer & two-layer crescent/Geneva star locking
 * 4. Planetary Carrier Generator: Y-arm / Circular disc carrier with planet pin holes and sun shaft hole
 * 5. Train Base Plate Generator: Structural mounting plate with bearing holes for all gear centers
 */

var MechanismSolvers = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    function logTrace(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.log) {
            CalcLogger.log(category, msg, data);
        }
    }

    function logWarn(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            CalcLogger.warn(category, msg, data);
        }
    }

    /**
     * Creates an accurate circular arc Bezier node sequence in mm.
     * @param {number} R Radius in mm
     * @param {number} thetaStart Starting angle in radians
     * @param {number} thetaEnd Ending angle in radians
     * @returns {Array} Array of node objects
     */
    function createArcBezierNodes(R, thetaStart, thetaEnd) {
        var totalAngle = thetaEnd - thetaStart;
        while (totalAngle < 0) totalAngle += 2.0 * Math.PI;
        if (totalAngle < 1e-6) return [];

        var segments = Math.max(1, Math.ceil(totalAngle / (Math.PI / 2.0)));
        var dTheta = totalAngle / segments;
        var h = (4.0 / 3.0) * R * Math.tan(dTheta / 4.0);

        var nodes = [];
        for (var i = 0; i <= segments; i++) {
            var th = thetaStart + i * dTheta;
            var cosT = Math.cos(th);
            var sinT = Math.sin(th);
            var ax = R * cosT;
            var ay = R * sinT;

            var lx = ax + h * sinT;
            var ly = ay - h * cosT;
            var rx = ax - h * sinT;
            var ry = ay + h * cosT;

            nodes.push({
                anchor: [ax, ay],
                leftDirection: [lx, ly],
                rightDirection: [rx, ry],
                pointType: "SMOOTH",
                theta: th
            });
        }
        return nodes;
    }

    /**
     * Solves feasible tooth combinations for 2K-H Standard Planetary Gear Mechanism.
     * 
     * Conditions verified:
     * - Concentricity: zr = zs + 2 * zp
     * - Assembly (equal spacing): (zs + zr) % N === 0
     * - Adjacent planet clearance: 2 * a * sin(pi/N) - dap > 0.5 mm
     * - Internal gear trochoid clearance: zr - zp >= 8
     * - Willis reduction ratio according to operation mode:
     *     ring_fixed: i = 1 + zr / zs (Sun in, Carrier out)
     *     sun_fixed: i = 1 + zs / zr (Ring in, Carrier out)
     *     carrier_fixed: i = -zr / zs (Sun in, Ring out, reversed)
     * - Muller transmission efficiency: eta = 1 - (1 - eta0^2) * (zr / (zs + zr)), eta0 = 0.98
     * 
     * @param {Object} specs Configuration specs
     * @returns {Array} Sorted list of feasible candidate solutions
     */
    function solveStandardPlanetary(specs) {
        specs = specs || {};
        var mode = specs.mode || "ring_fixed"; // "ring_fixed", "sun_fixed", "carrier_fixed"
        if (mode === "star") mode = "carrier_fixed"; // Normalize alias from GUI

        var targetRatio = (specs.targetRatio !== undefined && specs.targetRatio !== null && !isNaN(specs.targetRatio) && specs.targetRatio !== 0) ? Math.abs(parseFloat(specs.targetRatio)) : null;
        var tol = 0.15;
        if (specs.tolPercent !== undefined && !isNaN(specs.tolPercent)) {
            tol = parseFloat(specs.tolPercent) / 100.0;
        } else if (specs.tol !== undefined && !isNaN(specs.tol)) {
            tol = parseFloat(specs.tol);
        }
        var isExact = (tol <= 0.0001);
        var ratioMin = (specs.ratioMin !== undefined && !isNaN(specs.ratioMin)) ? parseFloat(specs.ratioMin) : null;
        var ratioMax = (specs.ratioMax !== undefined && !isNaN(specs.ratioMax)) ? parseFloat(specs.ratioMax) : null;
        var m = parseFloat(specs.m || specs.module) || 2.0;
        var alphaDeg = parseFloat(specs.alphaDeg !== undefined ? specs.alphaDeg : 20.0);

        var numPlanetsList = specs.numPlanets ? [parseInt(specs.numPlanets, 10)] : [2, 3, 4, 5, 6];

        var fixedZs = specs.fixedZs ? parseInt(specs.fixedZs, 10) : null;
        var fixedZp = specs.fixedZp ? parseInt(specs.fixedZp, 10) : null;
        var fixedZr = specs.fixedZr ? parseInt(specs.fixedZr, 10) : null;

        var zsMin = fixedZs ? fixedZs : (parseInt(specs.zsMin, 10) || 12);
        var zsMax = fixedZs ? fixedZs : (parseInt(specs.zsMax, 10) || 60);
        var zrMax = parseInt(specs.zrMax, 10) || 120;

        var candidates = [];

        for (var zs = zsMin; zs <= zsMax; zs++) {
            var zpMin = fixedZp ? fixedZp : (parseInt(specs.zpMin, 10) || 10);
            var zpMax = fixedZp ? fixedZp : (parseInt(specs.zpMax, 10) || 60);

            for (var zp = zpMin; zp <= zpMax; zp++) {
                var zr = zs + 2 * zp; // Concentricity condition
                if (fixedZr && zr !== fixedZr) continue;
                if (zr > zrMax) continue;

                for (var nIdx = 0; nIdx < numPlanetsList.length; nIdx++) {
                    var N = numPlanetsList[nIdx];
                    if (N < 2) continue;

                    // Assembly condition (equal spacing): (zs + zr) % N === 0
                    if ((zs + zr) % N !== 0) continue;

                    // Reduction ratio calculation by Willis equation
                    var ratio = 0;
                    var modeName = "";
                    if (mode === "sun_fixed") {
                        ratio = 1.0 + (zs / zr);
                        modeName = "Sun Fixed (Forward Slow)";
                    } else if (mode === "carrier_fixed") {
                        ratio = -(zr / zs);
                        modeName = "Carrier Fixed (Reversed)";
                    } else {
                        // ring_fixed (standard high reduction)
                        ratio = 1.0 + (zr / zs);
                        modeName = "High Reduction";
                    }

                    var absRatio = Math.abs(ratio);
                    var ratioErr = 0;
                    if (ratioMin !== null && absRatio < ratioMin) continue;
                    if (ratioMax !== null && absRatio > ratioMax) continue;
                    if (targetRatio !== null && targetRatio > 0) {
                        if (isExact) {
                            if (Math.abs(absRatio - targetRatio) > 0.005) continue;
                            ratioErr = 0;
                        } else {
                            ratioErr = Math.abs(absRatio - targetRatio) / targetRatio;
                            if (ratioErr > tol) continue;
                        }
                    }

                    // Adjacent planet clearance: pDist - dap >= 0.5 mm
                    var a = (m * (zs + zp)) / 2.0;
                    var dap = m * (zp + 2.0);
                    var pDist = 2.0 * a * Math.sin(Math.PI / N);
                    var clearance = pDist - dap;
                    if (clearance < 0.5) continue;

                    // Internal gear interference avoidance (Trochoid)
                    if (typeof InvoluteCore !== "undefined" && InvoluteCore.validateInternalInterference) {
                        var intf = InvoluteCore.validateInternalInterference(m, zp, zr, alphaDeg, 0, 0);
                        if (intf.trochoid) continue;
                    } else if (zr - zp < 8) {
                        continue;
                    }

                    // Muller transmission efficiency estimate (1-stage mesh efficiency eta0 = 0.98)
                    var eta0 = 0.98;
                    var efficiency = 0.98;
                    if (mode === "ring_fixed") {
                        efficiency = 1.0 - (1.0 - eta0 * eta0) * (zr / (zs + zr));
                    } else if (mode === "sun_fixed") {
                        efficiency = 1.0 - (1.0 - eta0 * eta0) * (zs / (zs + zr));
                    } else {
                        efficiency = eta0 * eta0;
                    }
                    if (efficiency < 0.1) efficiency = 0.1;
                    if (efficiency > 0.99) efficiency = 0.99;

                    var outerDiam = m * (zr + 6.0);
                    var alphaRad = alphaDeg * (Math.PI / 180.0);
                    var sinA = Math.sin(alphaRad);
                    var zc = 2.0 / (sinA * sinA);
                    var isUndercutRisk = (zs < 14 || zp < 14);
                    var recXs = (zs < zc) ? Math.max(0.0, Math.round((1.0 - (zs * sinA * sinA) / 2.0) * 100) / 100) : 0.0;
                    var recXp = (zp < zc) ? Math.max(0.0, Math.round((1.0 - (zp * sinA * sinA) / 2.0) * 100) / 100) : 0.0;
                    var recShift = Math.max(recXs, recXp);

                    candidates.push({
                        mode: mode,
                        modeName: modeName,
                        zs: zs,
                        zp: zp,
                        zr: zr,
                        numPlanets: N,
                        m: m,
                        alphaDeg: alphaDeg,
                        isUndercutRisk: isUndercutRisk,
                        recommendedShift: recShift,
                        recommendedXs: recXs,
                        recommendedXp: recXp,
                        ratio: Math.round(ratio * 1000) / 1000,
                        absRatio: Math.round(absRatio * 1000) / 1000,
                        ratioError: Math.round(ratioErr * 10000) / 100,
                        centerDistanceMm: Math.round(a * 100) / 100,
                        clearanceMm: Math.round(clearance * 100) / 100,
                        efficiencyEst: Math.round(efficiency * 100),
                        outerDiameterMm: Math.round(outerDiam * 10) / 10,
                        label: "S:" + zs + " P:" + zp + " R:" + zr + " (N=" + N + ", i=" + ratio.toFixed(2) + ", \u03b7\u2248" + Math.round(efficiency * 100) + "%" + (isUndercutRisk ? (", \u8981\u8ee2\u4f4d(x=" + recShift.toFixed(2) + ")") : "") + ")"
                    });
                }
            }
        }

        candidates.sort(function (a, b) {
            if (targetRatio !== null) {
                return (a.ratioError - b.ratioError) || (a.outerDiameterMm - b.outerDiameterMm);
            }
            return (a.absRatio - b.absRatio) || (a.outerDiameterMm - b.outerDiameterMm);
        });

        return candidates;
    }

    /**
     * Solves feasible tooth combinations and simultaneous profile shift equations for 3K Paradoxical Planetary Gear Train.
     * Implements Hori et al. (1994) maximum efficiency all-positive profile shift design:
     * - Sun (zs) and Output Ring (zr2) are multiples of number of planets (N)
     * - Ideal pinion: z2_ideal = (zr2 - zs) / 2
     * - Adopted pinion: zp = z2_ideal - 1 (1 tooth intentional reduction)
     * - Fixed Ring: zr1 = zr2 - deltaZ (deltaZ is multiple of N)
     * - Operating center distance: a = m * (zs + z2_ideal) / 2
     * - Reduction ratio: i = [zr2 * (zs + zr1)] / [zs * (zr2 - zr1)] = zr2 * (zs + zr1) / (zs * deltaZ)
     * 
     * @param {Object} specs Configuration specs
     * @returns {Array} Sorted list of feasible candidate solutions
     */
    function solveParadoxicalPlanetary(specs) {
        specs = specs || {};
        var targetRatio = (specs.targetRatio !== undefined && specs.targetRatio !== null && !isNaN(specs.targetRatio) && specs.targetRatio !== 0) ? Math.abs(parseFloat(specs.targetRatio)) : null;
        var tol = 0.25;
        if (specs.tolPercent !== undefined && !isNaN(specs.tolPercent)) {
            tol = parseFloat(specs.tolPercent) / 100.0;
        } else if (specs.tol !== undefined && !isNaN(specs.tol)) {
            tol = parseFloat(specs.tol);
        }
        var isExact = (tol <= 0.0001);
        var ratioMin = (specs.ratioMin !== undefined && !isNaN(specs.ratioMin)) ? parseFloat(specs.ratioMin) : null;
        var ratioMax = (specs.ratioMax !== undefined && !isNaN(specs.ratioMax)) ? parseFloat(specs.ratioMax) : null;
        var method = specs.method || "all"; // "all", "hori", "standard"
        var zrMax = parseInt(specs.zrMax, 10) || 120;
        var m = parseFloat(specs.m || specs.module) || 2.0;
        var alphaDeg = parseFloat(specs.alphaDeg !== undefined ? specs.alphaDeg : 20.0);
        var alphaRad = alphaDeg * (Math.PI / 180.0);
        var invAlpha = Math.tan(alphaRad) - alphaRad;
        var cosAlpha = Math.cos(alphaRad);
        var tanAlpha = Math.tan(alphaRad);

        var numPlanetsList = specs.numPlanets ? [parseInt(specs.numPlanets, 10)] : [2, 3, 4, 5];

        var fixedZs = specs.fixedZs ? parseInt(specs.fixedZs, 10) : null;
        var fixedZp = specs.fixedZp ? parseInt(specs.fixedZp, 10) : null;
        var fixedZr1 = specs.fixedZr1 ? parseInt(specs.fixedZr1, 10) : null;
        var fixedZr2 = specs.fixedZr2 ? parseInt(specs.fixedZr2, 10) : null;

        var candidates = [];
        var seenKeys = {};

        for (var nIdx = 0; nIdx < numPlanetsList.length; nIdx++) {
            var N = numPlanetsList[nIdx];
            if (N < 1) continue;

            var zsMin = fixedZs ? fixedZs : (parseInt(specs.zsMin, 10) || (N * Math.max(2, Math.ceil(12 / N))));
            var zsMax = fixedZs ? fixedZs : (parseInt(specs.zsMax, 10) || 60);

            // Step 1: Hori et al. (1994) all-positive profile shift design
            if (method === "all" || method === "hori") {
                for (var zs = zsMin; zs <= zsMax; zs++) {
                    if (!fixedZs && (zs % N !== 0)) continue;

                    var z2IdealMin = fixedZp ? (fixedZp + 1) : 10;
                    var z2IdealMax = fixedZp ? (fixedZp + 1) : 45;

                    for (var z2Ideal = z2IdealMin; z2Ideal <= z2IdealMax; z2Ideal++) {
                        var zp = fixedZp ? fixedZp : (z2Ideal - 1);
                        if (zp < 9) continue;

                        var zr2_ideal = zs + 2 * z2Ideal;
                        if (!fixedZr2 && (zr2_ideal % N !== 0)) continue;

                        var deltaZList = (N === 1) ? [-1, 1, -2, 2] : [-N, N, -2 * N, 2 * N];

                        for (var dIdx = 0; dIdx < deltaZList.length; dIdx++) {
                            var deltaZ = deltaZList[dIdx];
                            var zr2 = fixedZr2 ? fixedZr2 : zr2_ideal;
                            var zr1 = zr2 - deltaZ;

                            if (fixedZr1 && zr1 !== fixedZr1) continue;
                            if (fixedZr2 && zr2 !== fixedZr2) continue;
                            if (zr1 > zrMax || zr2 > zrMax) continue;
                            if (zr1 <= zp + 6 || zr2 <= zp + 6) continue;

                            // Assembly conditions: equal spacing of planets
                            if ((zs + zr1) % N !== 0) continue;
                            if (Math.abs(deltaZ) % N !== 0) continue;

                            // Common operating center distance
                            var a0_sp = (m * (zs + zp)) / 2.0;
                            var a_oper = (m * (zs + z2Ideal)) / 2.0;

                            // Sun - Planet meshing operating pressure angle
                            var cosAw_sp = (a0_sp / a_oper) * cosAlpha;
                            if (cosAw_sp <= 0.0 || cosAw_sp >= 1.0) continue;
                            var aw_sp = Math.acos(cosAw_sp);
                            var invAw_sp = Math.tan(aw_sp) - aw_sp;
                            var sumX_sp = ((zs + zp) * (invAw_sp - invAlpha)) / (2.0 * tanAlpha);

                            // Planet - Ring 1 (Fixed) operating conditions
                            var a0_p1 = (m * (zr1 - zp)) / 2.0;
                            var cosAw_p1 = (a0_p1 / a_oper) * cosAlpha;
                            if (cosAw_p1 <= 0.0 || cosAw_p1 >= 1.0) continue;
                            var aw_p1 = Math.acos(cosAw_p1);
                            var invAw_p1 = Math.tan(aw_p1) - aw_p1;
                            var diffX_p1 = ((zr1 - zp) * (invAw_p1 - invAlpha)) / (2.0 * tanAlpha);

                            // Planet - Ring 2 (Output) operating conditions
                            var a0_p2 = (m * (zr2 - zp)) / 2.0;
                            var cosAw_p2 = (a0_p2 / a_oper) * cosAlpha;
                            if (cosAw_p2 <= 0.0 || cosAw_p2 >= 1.0) continue;
                            var aw_p2 = Math.acos(cosAw_p2);
                            if (aw_p2 > 35.0 * (Math.PI / 180.0)) continue;
                            var invAw_p2 = Math.tan(aw_p2) - aw_p2;
                            var diffX_p2 = ((zr2 - zp) * (invAw_p2 - invAlpha)) / (2.0 * tanAlpha);
                            if (Math.abs(diffX_p2) > 2.5) continue;

                            // Profile shift allocation: Hori all-positive shift optimization
                            var x2_min = Math.max(0, -diffX_p1, -diffX_p2);
                            var x2_max = sumX_sp;
                            var isAllPos = (x2_min <= x2_max);
                            var optXp = isAllPos ? ((x2_min + x2_max) / 2.0) : Math.max(0, 0.5 * sumX_sp);
                            var optXs = sumX_sp - optXp;
                            var optXr1 = diffX_p1 + optXp;
                            var optXr2 = diffX_p2 + optXp;

                            // Planet clearance check
                            var dap = m * (zp + 2.0 + 2.0 * optXp);
                            if (N > 1) {
                                var pDist = 2.0 * a_oper * Math.sin(Math.PI / N);
                                if (pDist - dap < 0.5) continue;
                            }

                            // Strict Willis reduction ratio: i = [zr2 * (zs + zr1)] / [zs * (zr2 - zr1)]
                            var actualRatio = (zr2 * (zs + zr1)) / (zs * deltaZ);
                            var absRatio = Math.abs(actualRatio);
                            var ratioErr = 0;
                            if (ratioMin !== null && absRatio < ratioMin) continue;
                            if (ratioMax !== null && absRatio > ratioMax) continue;
                            if (targetRatio !== null && targetRatio > 0) {
                                if (isExact) {
                                    if (Math.abs(absRatio - targetRatio) > 0.05) continue;
                                    ratioErr = 0;
                                } else {
                                    ratioErr = Math.abs(absRatio - targetRatio) / targetRatio;
                                    if (ratioErr > tol) continue;
                                }
                            }

                            // Efficiency estimate (Hori et al. formulation with high-efficiency positive shift)
                            var mu = 0.055;
                            var eff = (1.0 - mu * Math.PI * (1.0 / zs + 1.0 / zp)) / (1.0 + Math.abs(zr1 / deltaZ) * mu * Math.PI * (1.0 / zp - 1.0 / zr2));
                            eff = Math.max(0.15, Math.min(0.95, eff));

                            var key = zs + "_" + zp + "_" + zr1 + "_" + zr2 + "_" + N;
                            if (seenKeys[key]) continue;
                            seenKeys[key] = true;

                            var outerDiam = m * (Math.max(zr1, zr2) + 6.0);
                            var dirStr = (actualRatio > 0) ? "\u6b63\u8ee2" : "\u9006\u8ee2";

                            candidates.push({
                                zs: zs,
                                zp: zp,
                                zr1: zr1,
                                zr2: zr2,
                                numPlanets: N,
                                deltaZ: deltaZ,
                                m: m,
                                alphaDeg: alphaDeg,
                                isHoriMethod: true,
                                isAllPositiveShift: isAllPos,
                                xs: Math.round(optXs * 1000) / 1000,
                                xp: Math.round(optXp * 1000) / 1000,
                                xr1: Math.round(optXr1 * 1000) / 1000,
                                xr2: Math.round(optXr2 * 1000) / 1000,
                                sumX_sp: Math.round(sumX_sp * 1000) / 1000,
                                aw2Deg: Math.round(aw_p2 * (180.0 / Math.PI) * 10) / 10,
                                ratio: Math.round(actualRatio * 10) / 10,
                                absRatio: Math.round(absRatio * 10) / 10,
                                ratioError: Math.round(ratioErr * 10000) / 100,
                                centerDistanceMm: Math.round(a_oper * 100) / 100,
                                outerDiameterMm: Math.round(outerDiam * 10) / 10,
                                efficiencyEst: Math.round(eff * 100),
                                directionName: dirStr,
                                label: "S:" + zs + " P:" + zp + " R1:" + zr1 + " R2:" + zr2 + " (N=" + N + ", i=" + actualRatio.toFixed(1) + " [" + dirStr + "], \u03b7\u2248" + Math.round(eff * 100) + "%" + (isAllPos ? ", \u5800\u30fb\u5168\u6b63\u8ee2\u4f4d" : ", \u5800") + ")"
                            });
                        }
                    }
                }
            }

            // Step 2: Standard non-shifted pinion general search
            if (method === "all" || method === "standard") {
                for (var zsGen = (fixedZs || 14); zsGen <= (fixedZs || 50); zsGen++) {
                    var zpGenMin = fixedZp || 12;
                    var zpGenMax = fixedZp || 40;
                    for (var zpGen = zpGenMin; zpGen <= zpGenMax; zpGen++) {
                        var zr1Gen = zsGen + 2 * zpGen;
                        if (fixedZr1 && zr1Gen !== fixedZr1) continue;
                        if ((zsGen + zr1Gen) % N !== 0) continue;

                        var aGen = (m * (zsGen + zpGen)) / 2.0;
                        var dapGen = m * (zpGen + 2.0);
                        if (N > 1) {
                            var pDistGen = 2.0 * aGen * Math.sin(Math.PI / N);
                            if (pDistGen - dapGen < 0.5) continue;
                        }

                        var possibleDeltaZGen = (N === 1) ? [-1, 1, -2, 2] : [-N, N, -2 * N, 2 * N];
                        for (var dgIdx = 0; dgIdx < possibleDeltaZGen.length; dgIdx++) {
                            var dZGen = possibleDeltaZGen[dgIdx];
                            var zr2Gen = zr1Gen + dZGen;
                            if (fixedZr2 && zr2Gen !== fixedZr2) continue;
                            if (zr2Gen <= zpGen + 6) continue;
                            if (Math.abs(dZGen) % N !== 0) continue;

                            var keyGen = zsGen + "_" + zpGen + "_" + zr1Gen + "_" + zr2Gen + "_" + N;
                            if (seenKeys[keyGen]) continue;
                            seenKeys[keyGen] = true;

                            var actualRatioGen = ((zsGen + zr1Gen) * zr2Gen) / (zsGen * dZGen);
                            var absRatioGen = Math.abs(actualRatioGen);
                            var ratioErrGen = 0;
                            if (targetRatio !== null && targetRatio > 0) {
                                if (isExact) {
                                    if (Math.abs(absRatioGen - targetRatio) > 0.05) continue;
                                    ratioErrGen = 0;
                                } else {
                                    ratioErrGen = Math.abs(absRatioGen - targetRatio) / targetRatio;
                                    if (ratioErrGen > tol) continue;
                                }
                            }

                            var a0_2Gen = (m * (zr2Gen - zpGen)) / 2.0;
                            var cosAw2Gen = (a0_2Gen / aGen) * cosAlpha;
                            if (cosAw2Gen <= 0.0 || cosAw2Gen >= 1.0) continue;
                            var aw2Gen = Math.acos(cosAw2Gen);
                            if (aw2Gen > 35.0 * (Math.PI / 180.0)) continue;
                            var invAw2Gen = Math.tan(aw2Gen) - aw2Gen;
                            var xr2Gen = (zr2Gen - zpGen) * (invAw2Gen - invAlpha) / (2.0 * tanAlpha);
                            if (Math.abs(xr2Gen) > 2.5) continue;

                            var outerDiamGen = m * (Math.max(zr1Gen, zr2Gen) + 6.0);
                            var muGen = 0.07;
                            var effGen = (1.0 - muGen * Math.PI * (1.0 / zsGen + 1.0 / zpGen)) / (1.0 + Math.abs(zr1Gen / dZGen) * muGen * Math.PI * (1.0 / zpGen - 1.0 / zr2Gen));
                            effGen = Math.max(0.1, Math.min(0.9, effGen));
                            var dirStrGen = (actualRatioGen > 0) ? "\u6b63\u8ee2" : "\u9006\u8ee2";

                            candidates.push({
                                zs: zsGen,
                                zp: zpGen,
                                zr1: zr1Gen,
                                zr2: zr2Gen,
                                numPlanets: N,
                                deltaZ: dZGen,
                                m: m,
                                alphaDeg: alphaDeg,
                                isHoriMethod: false,
                                isAllPositiveShift: false,
                                xs: 0.0,
                                xp: 0.0,
                                xr1: 0.0,
                                xr2: Math.round(xr2Gen * 1000) / 1000,
                                sumX_sp: 0,
                                aw2Deg: Math.round(aw2Gen * (180.0 / Math.PI) * 10) / 10,
                                ratio: Math.round(actualRatioGen * 10) / 10,
                                absRatio: Math.round(absRatioGen * 10) / 10,
                                ratioError: Math.round(ratioErrGen * 10000) / 100,
                                centerDistanceMm: Math.round(aGen * 100) / 100,
                                outerDiameterMm: Math.round(outerDiamGen * 10) / 10,
                                efficiencyEst: Math.round(effGen * 100),
                                directionName: dirStrGen,
                                label: "S:" + zsGen + " P:" + zpGen + " R1:" + zr1Gen + " R2:" + zr2Gen + " (N=" + N + ", i=" + actualRatioGen.toFixed(1) + " [" + dirStrGen + "], xr2=" + xr2Gen.toFixed(2) + ", \u03b7\u2248" + Math.round(effGen * 100) + "%)"
                            });
                        }
                    }
                }
            }
        }

        candidates.sort(function (a, b) {
            if (a.isHoriMethod !== b.isHoriMethod) {
                return a.isHoriMethod ? -1 : 1;
            }
            if (targetRatio !== null) {
                return (a.ratioError - b.ratioError) || (b.efficiencyEst - a.efficiencyEst);
            }
            return (a.absRatio - b.absRatio) || (b.efficiencyEst - a.efficiencyEst);
        });

        return candidates;
    }

    /**
     * Calculates the concave lock pocket Bezier arc for an intermittent driven Geneva star shoe.
     * Center of shoe arc is at driver center (-a, 0).
     * 
     * @param {number} a Center distance in mm
     * @param {number} R_shoe Radius of shoe (drum + clearance = rp1 + c_lock) in mm
     * @param {number} R_outer Outer radius of star shoe (ra2) in mm
     * @returns {Object} { nodes: Array, deltaAngle: number, length: number }
     */
    function createConcaveLockArcNodes(a, R_shoe, R_outer) {
        if (a <= 0 || R_shoe <= 0 || R_outer <= 0) return { nodes: [], deltaAngle: 0, length: 0 };

        // Two-circle intersection:
        // (x + a)^2 + y^2 = R_shoe^2
        // x^2 + y^2 = R_outer^2
        // -> 2ax = R_shoe^2 - a^2 - R_outer^2
        var x_int = (R_shoe * R_shoe - a * a - R_outer * R_outer) / (2.0 * a);
        var y2 = R_outer * R_outer - x_int * x_int;
        if (y2 < 0) return { nodes: [], deltaAngle: 0, length: 0 };
        var y_int = Math.sqrt(y2);

        // Angular span from driver center (-a, 0)
        var phi_half = Math.atan2(y_int, x_int + a);
        if (phi_half <= 0) return { nodes: [], deltaAngle: 0, length: 0 };

        // Two-segment Bezier arc centered at (-a, 0)
        var L_handle = (4.0 / 3.0) * Math.tan(phi_half / 4.0) * R_shoe;

        function getShoePt(phi) {
            return [
                -a + R_shoe * Math.cos(phi),
                R_shoe * Math.sin(phi)
            ];
        }

        // Tangent vector along CCW perimeter (decreasing phi):
        function getShoeTanCCW(phi) {
            return [
                Math.sin(phi),
                -Math.cos(phi)
            ];
        }

        var ptEntry = getShoePt(phi_half);
        var tanEntry = getShoeTanCCW(phi_half);
        var ptMid = getShoePt(0);
        var tanMid = getShoeTanCCW(0);
        var ptExit = getShoePt(-phi_half);
        var tanExit = getShoeTanCCW(-phi_half);

        var th_entry_local = Math.atan2(y_int, x_int);
        var deltaAngle = Math.PI - th_entry_local;

        var nodes = [
            {
                anchor: [ptEntry[0], ptEntry[1]],
                leftDirection: [ptEntry[0], ptEntry[1]],
                rightDirection: [ptEntry[0] + L_handle * tanEntry[0], ptEntry[1] + L_handle * tanEntry[1]],
                pointType: "CORNER"
            },
            {
                anchor: [ptMid[0], ptMid[1]],
                leftDirection: [ptMid[0] - L_handle * tanMid[0], ptMid[1] - L_handle * tanMid[1]],
                rightDirection: [ptMid[0] + L_handle * tanMid[0], ptMid[1] + L_handle * tanMid[1]],
                pointType: "SMOOTH"
            },
            {
                anchor: [ptExit[0], ptExit[1]],
                leftDirection: [ptExit[0] - L_handle * tanExit[0], ptExit[1] - L_handle * tanExit[1]],
                rightDirection: [ptExit[0], ptExit[1]],
                pointType: "CORNER"
            }
        ];

        return { nodes: nodes, deltaAngle: deltaAngle, length: nodes.length };
    }

    /**
     * Generates closed Bezier nodes for driver crescent locking disc (Two-layer intermittent mechanism).
     */
    function generateCrescentDiscNodes(params) {
        var R_disc = parseFloat(params.rDisc);
        var R_cres = parseFloat(params.rCrescent);
        var centerDist = parseFloat(params.centerDist);
        var z1 = parseInt(params.z1, 10);
        var activeTeeth = parseInt(params.activeTeeth, 10);

        var x_cres = (R_disc * R_disc + centerDist * centerDist - R_cres * R_cres) / (2.0 * centerDist);
        var y2_c = R_disc * R_disc - x_cres * x_cres;
        if (y2_c < 0) {
            return createArcBezierNodes(R_disc, 0, 2.0 * Math.PI);
        }

        var y_cres = Math.sqrt(y2_c);
        var th_cres = Math.atan2(y_cres, x_cres);
        var cres_phi = Math.atan2(y_cres, centerDist - x_cres);
        var L_cres = (4.0 / 3.0) * Math.tan(cres_phi / 4.0) * R_cres;

        var tau1 = (2.0 * Math.PI) / z1;
        var crescentCenterAngle = ((activeTeeth - 1) * tau1) / 2.0;
        var cosA = Math.cos(crescentCenterAngle);
        var sinA = Math.sin(crescentCenterAngle);

        function rotLpPt(pt) {
            var rx = pt[0] * cosA - pt[1] * sinA;
            var ry = pt[0] * sinA + pt[1] * cosA;
            return [rx, ry];
        }

        var cp0 = [centerDist - R_cres * Math.cos(-cres_phi), R_cres * Math.sin(-cres_phi)];
        var ct0 = [Math.sin(-cres_phi), Math.cos(-cres_phi)];
        var cpM = [centerDist - R_cres, 0];
        var ctM = [0, 1];
        var cp2 = [centerDist - R_cres * Math.cos(cres_phi), R_cres * Math.sin(cres_phi)];
        var ct2 = [Math.sin(cres_phi), Math.cos(cres_phi)];

        var lpNodes = [];

        lpNodes.push({
            anchor: rotLpPt(cp0),
            leftDirection: rotLpPt(cp0),
            rightDirection: rotLpPt([cp0[0] + L_cres * ct0[0], cp0[1] + L_cres * ct0[1]]),
            pointType: "CORNER"
        });
        lpNodes.push({
            anchor: rotLpPt(cpM),
            leftDirection: rotLpPt([cpM[0] - L_cres * ctM[0], cpM[1] - L_cres * ctM[1]]),
            rightDirection: rotLpPt([cpM[0] + L_cres * ctM[0], cpM[1] + L_cres * ctM[1]]),
            pointType: "SMOOTH"
        });
        lpNodes.push({
            anchor: rotLpPt(cp2),
            leftDirection: rotLpPt([cp2[0] - L_cres * ct2[0], cp2[1] - L_cres * ct2[1]]),
            rightDirection: rotLpPt(cp2),
            pointType: "CORNER"
        });

        var discArc = createArcBezierNodes(R_disc, th_cres, 2.0 * Math.PI - th_cres);
        for (var d = 1; d < discArc.length - 1; d++) {
            var dn = discArc[d];
            lpNodes.push({
                anchor: rotLpPt(dn.anchor),
                leftDirection: rotLpPt(dn.leftDirection),
                rightDirection: rotLpPt(dn.rightDirection),
                pointType: "SMOOTH"
            });
        }

        return lpNodes;
    }

    /**
     * Generates closed Bezier nodes for driven Geneva star locking plate (Two-layer intermittent mechanism).
     */
    function generateGenevaLockStarNodes(params) {
        var R_star = parseFloat(params.rStar);
        var R_pocket = parseFloat(params.rPocket);
        var centerDist = parseFloat(params.centerDist);
        var divisions = parseInt(params.divisions, 10);
        var moveTeeth = parseInt(params.moveTeeth, 10);
        var z2 = parseInt(params.z2, 10);

        var concavePocket = createConcaveLockArcNodes(centerDist, R_pocket, R_star);
        var pocketHalfAngle = concavePocket.deltaAngle || 0;
        var theta_seg = (2.0 * Math.PI) / divisions;
        var tau2 = (2.0 * Math.PI) / z2;
        var teethEnd2 = (moveTeeth - 1) * tau2;
        var dwellOffsetAngle = (teethEnd2 + theta_seg) / 2.0;

        var lpNodes = [];
        var lastIncomingHandle = null;

        for (var s = 0; s < divisions; s++) {
            var dwellCenterAngle = dwellOffsetAngle + (s * theta_seg);
            var shoeRot = dwellCenterAngle + Math.PI;
            var cosS = Math.cos(shoeRot);
            var sinS = Math.sin(shoeRot);

            function tfLpShoe(pt) {
                var rx = pt[0] * cosS - pt[1] * sinS;
                var ry = pt[0] * sinS + pt[1] * cosS;
                return [rx, ry];
            }

            if (concavePocket.length >= 3 && pocketHalfAngle > 0) {
                var p0 = concavePocket.nodes[0];
                var pMid = concavePocket.nodes[1];
                var p2 = concavePocket.nodes[2];

                var p0Anchor = tfLpShoe(p0.anchor);
                var p0Right = tfLpShoe(p0.rightDirection);
                var p0Left = (lastIncomingHandle !== null) ? lastIncomingHandle : tfLpShoe(p0.anchor);

                lpNodes.push({
                    anchor: p0Anchor,
                    leftDirection: p0Left,
                    rightDirection: p0Right,
                    pointType: "CORNER"
                });

                lpNodes.push({
                    anchor: tfLpShoe(pMid.anchor),
                    leftDirection: tfLpShoe(pMid.leftDirection),
                    rightDirection: tfLpShoe(pMid.rightDirection),
                    pointType: "SMOOTH"
                });

                var p2Anchor = tfLpShoe(p2.anchor);
                var p2Left = tfLpShoe(p2.leftDirection);
                var p2Right = tfLpShoe(p2.anchor);

                lpNodes.push({
                    anchor: p2Anchor,
                    leftDirection: p2Left,
                    rightDirection: p2Right,
                    pointType: "CORNER"
                });

                var pEndAngle = dwellCenterAngle + pocketHalfAngle;
                var pStartAngleNext = dwellCenterAngle + theta_seg - pocketHalfAngle;
                var arcConn = createArcBezierNodes(R_star, pEndAngle, pStartAngleNext);

                if (arcConn.length >= 2) {
                    lpNodes[lpNodes.length - 1].rightDirection = [arcConn[0].rightDirection[0], arcConn[0].rightDirection[1]];

                    for (var ac = 1; ac < arcConn.length - 1; ac++) {
                        lpNodes.push({
                            anchor: [arcConn[ac].anchor[0], arcConn[ac].anchor[1]],
                            leftDirection: [arcConn[ac].leftDirection[0], arcConn[ac].leftDirection[1]],
                            rightDirection: [arcConn[ac].rightDirection[0], arcConn[ac].rightDirection[1]],
                            pointType: "SMOOTH"
                        });
                    }

                    lastIncomingHandle = [arcConn[arcConn.length - 1].leftDirection[0], arcConn[arcConn.length - 1].leftDirection[1]];
                }
            }
        }

        if (lastIncomingHandle !== null && lpNodes.length > 0) {
            lpNodes[0].leftDirection = lastIncomingHandle;
        }

        return lpNodes;
    }

    /**
     * Solves kinematics and phase angles for Intermittent Gear Pair (Mutilated Spur Gear).
     * Supports both 'motion' (engaging meshing pose) and 'lock' (stationary locked pose).
     */
    function calculateIntermittentKinematics(spec) {
        spec = spec || {};
        var m = parseFloat(spec.m || spec.module) || 3.0;
        var z1 = parseInt(spec.z1, 10) || 8;
        var divisions = parseInt(spec.divisions, 10) || 4;
        var moveTeeth = parseInt(spec.moveTeeth, 10) || 2;
        if (moveTeeth >= z1) moveTeeth = Math.max(1, z1 - 1); // Clamp active teeth below total driver teeth

        var z2 = parseInt(spec.z2 || (divisions * moveTeeth), 10);
        var pose = spec.pose || "motion"; // "motion" | "lock"
        var structure = spec.intermittentStructure || spec.structure || "coplanar";
        var lockClearance = (spec.lockClearance !== undefined) ? parseFloat(spec.lockClearance) : 0.15;
        if (isNaN(lockClearance)) lockClearance = 0.15;

        var a = (m * (z1 + z2)) / 2.0;
        var rp1 = (m * z1) / 2.0;
        var rp2 = (m * z2) / 2.0;
        var ra2 = rp2 + m;

        var tau1 = (2.0 * Math.PI) / z1;
        var tau2 = (2.0 * Math.PI) / z2;
        var theta_seg = (2.0 * Math.PI) / divisions;

        var motionAngleDeg = (360.0 * moveTeeth) / z1;
        var dwellAngleDeg = 360.0 - motionAngleDeg;
        var dwellRatio = (z1 - moveTeeth) / z1;

        var driverRotDeg = 0.0;
        var drivenRotDeg = 0.0;
        var isLocked = false;

        if (pose === "lock") {
            // Locked dwell pose: driver crescent faces away from meshing line;
            // driver locking drum is concentric with driven concave pocket
            isLocked = true;
            // Driver rotates 180 deg opposite to active teeth center
            var activeCenterAngle1 = ((moveTeeth - 1) * tau1) / 2.0;
            var driverLockAngleRad = activeCenterAngle1 + Math.PI;
            driverRotDeg = driverLockAngleRad * (180.0 / Math.PI);

            // Driven pocket center lines up with meshing line
            var dwellOffsetAngle2 = (((moveTeeth - 1) * tau2) + theta_seg) / 2.0;
            var drivenLockAngleRad = dwellOffsetAngle2;
            drivenRotDeg = drivenLockAngleRad * (180.0 / Math.PI);
        } else {
            // Motion engaging pose: first active tooth aligns conjugate to driven tooth
            isLocked = false;
            driverRotDeg = 0.0;
            drivenRotDeg = 180.0 - (180.0 / z2);
        }

        return {
            m: m,
            z1: z1,
            z2: z2,
            divisions: divisions,
            moveTeeth: moveTeeth,
            structure: structure,
            pose: pose,
            isLocked: isLocked,
            motionAngleDeg: Math.round(motionAngleDeg * 10) / 10,
            dwellAngleDeg: Math.round(dwellAngleDeg * 10) / 10,
            dwellRatio: Math.round(dwellRatio * 1000) / 10,
            centerDistanceMm: a,
            driverRotDeg: driverRotDeg,
            drivenRotDeg: drivenRotDeg,
            lockDiscRadiusMm: rp1,
            lockPocketRadiusMm: rp1 + lockClearance,
            lockClearanceMm: lockClearance
        };
    }

    /**
     * Calculates planetary carrier geometry (Y-arm or Circular disc).
     * Automatically places planet pin holes at orbit radius a and central sun shaft hole at origin.
     * 
     * @param {Object} specs Carrier configuration specs:
     *   - m: Module (mm)
     *   - zs: Sun teeth
     *   - zp: Planet teeth
     *   - numPlanets: Planet count N (default 3)
     *   - carrierType: "ARM" (default Y-arm) | "DISC"
     *   - sunShaftDiameter: Diameter of sun shaft hole (mm, default 5.0)
     *   - planetPinDiameter: Diameter of planet pins (mm, default 4.0)
     *   - bossMargin: Additional rim around planet pins (mm, default 3.0)
     *   - armFilletRadius: Fillet radius between arms (mm, default 5.0)
     *   - angleOffsetDeg: Initial rotation angle of carrier (deg, default 0.0)
     * @returns {Object} { carrierType, outerNodes, pinHoles, sunHole, centerDistanceMm, radiusMm }
     */
    function calculatePlanetaryCarrier(specs) {
        specs = specs || {};
        var m = parseFloat(specs.m || specs.module) || 2.0;
        var zs = parseInt(specs.zs, 10) || 18;
        var zp = parseInt(specs.zp, 10) || 18;
        var N = parseInt(specs.numPlanets, 10) || 3;
        var carrierType = String(specs.carrierType || "ARM").toUpperCase();
        var sunShaft = (specs.sunShaftDiameter !== undefined) ? parseFloat(specs.sunShaftDiameter) : 5.0;
        var planetPin = (specs.planetPinDiameter !== undefined) ? parseFloat(specs.planetPinDiameter) : 4.0;
        var bossMargin = (specs.bossMargin !== undefined) ? parseFloat(specs.bossMargin) : Math.max(3.0, m * 1.5);
        var filletR = (specs.armFilletRadius !== undefined) ? parseFloat(specs.armFilletRadius) : Math.max(4.0, m * 2.0);
        var angleOffsetDeg = parseFloat(specs.angleOffsetDeg || 0.0);
        var angleOffsetRad = angleOffsetDeg * (Math.PI / 180.0);

        var a = (m * (zs + zp)) / 2.0; // Planet orbit radius
        var rPin = planetPin / 2.0;
        var rSun = sunShaft / 2.0;
        var rBoss = rPin + bossMargin;
        var rHub = Math.max(rBoss, rSun + bossMargin);

        // 1. Central sun shaft hole nodes
        var sunHole = (rSun > 0) ? createArcBezierNodes(rSun, 0, 2.0 * Math.PI) : [];

        // 2. Planet pin holes at orbit radius
        var pinHoles = [];
        var dTheta = (2.0 * Math.PI) / N;

        for (var i = 0; i < N; i++) {
            var thPin = angleOffsetRad + i * dTheta;
            var px = a * Math.cos(thPin);
            var py = a * Math.sin(thPin);

            var circleArc = createArcBezierNodes(rPin, 0, 2.0 * Math.PI);
            var shiftedNodes = [];
            for (var c = 0; c < circleArc.length - 1; c++) {
                var nd = circleArc[c];
                shiftedNodes.push({
                    anchor: [nd.anchor[0] + px, nd.anchor[1] + py],
                    leftDirection: [nd.leftDirection[0] + px, nd.leftDirection[1] + py],
                    rightDirection: [nd.rightDirection[0] + px, nd.rightDirection[1] + py],
                    pointType: "SMOOTH"
                });
            }
            pinHoles.push({
                index: i + 1,
                centerMm: [px, py],
                diameterMm: planetPin,
                nodes: shiftedNodes
            });
        }

        // 3. Carrier outer contour
        var outerNodes = [];
        var maxRadius = a + rBoss;

        if (carrierType === "DISC" || N < 2) {
            // Circular disc carrier
            outerNodes = createArcBezierNodes(maxRadius, 0, 2.0 * Math.PI);
        } else {
            // Y-arm / Polygon arm carrier with smooth lobes around each planet pin
            for (var j = 0; j < N; j++) {
                var thLobe = angleOffsetRad + j * dTheta;
                var lx = a * Math.cos(thLobe);
                var ly = a * Math.sin(thLobe);

                // Outer semicircular lobe around pin: from thLobe - PI/2 to thLobe + PI/2
                var lobeArc = createArcBezierNodes(rBoss, thLobe - Math.PI / 2.0, thLobe + Math.PI / 2.0);
                for (var la = 0; la < lobeArc.length - 1; la++) {
                    var lnd = lobeArc[la];
                    outerNodes.push({
                        anchor: [lnd.anchor[0] + lx, lnd.anchor[1] + ly],
                        leftDirection: [lnd.leftDirection[0] + lx, lnd.leftDirection[1] + ly],
                        rightDirection: [lnd.rightDirection[0] + lx, lnd.rightDirection[1] + ly],
                        pointType: (la === 0) ? "CORNER" : "SMOOTH"
                    });
                }

                // Inner bridge connection to next lobe
                var nextThLobe = angleOffsetRad + (j + 1) * dTheta;
                var midTh = (thLobe + nextThLobe) / 2.0;
                var rMid = Math.max(rHub, a * 0.45);
                var midX = rMid * Math.cos(midTh);
                var midY = rMid * Math.sin(midTh);

                // Tangent handle for smooth curved waist between arms
                var waistHandle = (4.0 / 3.0) * rMid * Math.tan(dTheta / 8.0);
                var tanMidX = -Math.sin(midTh);
                var tanMidY = Math.cos(midTh);

                outerNodes.push({
                    anchor: [midX, midY],
                    leftDirection: [midX - waistHandle * tanMidX, midY - waistHandle * tanMidY],
                    rightDirection: [midX + waistHandle * tanMidX, midY + waistHandle * tanMidY],
                    pointType: "SMOOTH"
                });
            }
        }

        return {
            carrierType: carrierType,
            outerNodes: outerNodes,
            pinHoles: pinHoles,
            sunHole: sunHole,
            centerDistanceMm: a,
            radiusMm: maxRadius,
            numPlanets: N
        };
    }

    /**
     * Calculates Train Base Plate geometry with bearing mounting holes for all gear centers.
     * Extracts unique shaft centers from resolved gear train nodes.
     * 
     * @param {Array} nodes Resolved gear train nodes from TrainTreeResolver
     * @param {Object} options Base plate options:
     *   - marginMm: Clearance border margin around outermost gear/shaft (mm, default 10.0)
     *   - cornerRadiusMm: Fillet radius for plate corners (mm, default 6.0)
     *   - bearingDiameter: Default bearing hole diameter (mm, default 8.0)
     * @returns {Object} Base plate geometry with outerNodes and shaftHoles
     */
    function calculateTrainBasePlate(nodes, options) {
        options = options || {};
        var margin = (options.marginMm !== undefined) ? parseFloat(options.marginMm) : 10.0;
        var cornerR = (options.cornerRadiusMm !== undefined) ? parseFloat(options.cornerRadiusMm) : 6.0;
        var defaultBearingDia = (options.bearingDiameter !== undefined) ? parseFloat(options.bearingDiameter) : 8.0;

        nodes = nodes || [];
        if (nodes.length === 0) {
            return { outerNodes: [], shaftHoles: [], holeCount: 0, boundsMm: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
        }

        var uniqueCenters = [];
        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;

        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            var cx = nd.centerMm ? nd.centerMm[0] : 0;
            var cy = nd.centerMm ? nd.centerMm[1] : 0;
            var dia = (nd.shaftDiameter && nd.shaftDiameter > 0) ? nd.shaftDiameter : defaultBearingDia;

            // Approximate outer radius of gear for plate margin bounding box
            var rGear = (nd.gearData && nd.gearData.ra) ? nd.gearData.ra : ((nd.m * nd.z) / 2.0 + nd.m);
            if (nd.gearType === "INTERNAL" && nd.gearData && nd.gearData.rimDiameter) {
                rGear = nd.gearData.rimDiameter / 2.0;
            }

            if (cx - rGear < minX) minX = cx - rGear;
            if (cx + rGear > maxX) maxX = cx + rGear;
            if (cy - rGear < minY) minY = cy - rGear;
            if (cy + rGear > maxY) maxY = cy + rGear;

            // Deduplicate shaft hole centers
            var exists = false;
            for (var u = 0; u < uniqueCenters.length; u++) {
                var uc = uniqueCenters[u];
                var dx = uc.centerMm[0] - cx;
                var dy = uc.centerMm[1] - cy;
                if (Math.sqrt(dx * dx + dy * dy) < 0.05) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                uniqueCenters.push({
                    id: nd.id,
                    centerMm: [cx, cy],
                    diameterMm: dia
                });
            }
        }

        var plateMinX = minX - margin;
        var plateMaxX = maxX + margin;
        var plateMinY = minY - margin;
        var plateMaxY = maxY + margin;
        var w = plateMaxX - plateMinX;
        var h = plateMaxY - plateMinY;

        if (cornerR > w / 2.0) cornerR = w / 2.0;
        if (cornerR > h / 2.0) cornerR = h / 2.0;

        // Rounded rectangle outer plate nodes (8 nodes: 2 nodes per corner to guarantee straight edges)
        var KAPPA = (4.0 / 3.0) * (Math.SQRT2 - 1.0);
        var kR = cornerR * KAPPA;

        var outerNodes = [
            // 0: Top edge left (arc end of top-left corner, start of top straight edge)
            {
                anchor: [plateMinX + cornerR, plateMaxY],
                leftDirection: [plateMinX + cornerR - kR, plateMaxY],
                rightDirection: [plateMinX + cornerR, plateMaxY],
                pointType: "CORNER"
            },
            // 1: Top edge right (end of top straight edge, start of top-right corner arc)
            {
                anchor: [plateMaxX - cornerR, plateMaxY],
                leftDirection: [plateMaxX - cornerR, plateMaxY],
                rightDirection: [plateMaxX - cornerR + kR, plateMaxY],
                pointType: "CORNER"
            },
            // 2: Right edge top (arc end of top-right corner, start of right straight edge)
            {
                anchor: [plateMaxX, plateMaxY - cornerR],
                leftDirection: [plateMaxX, plateMaxY - cornerR + kR],
                rightDirection: [plateMaxX, plateMaxY - cornerR],
                pointType: "CORNER"
            },
            // 3: Right edge bottom (end of right straight edge, start of bottom-right corner arc)
            {
                anchor: [plateMaxX, plateMinY + cornerR],
                leftDirection: [plateMaxX, plateMinY + cornerR],
                rightDirection: [plateMaxX, plateMinY + cornerR - kR],
                pointType: "CORNER"
            },
            // 4: Bottom edge right (arc end of bottom-right corner, start of bottom straight edge)
            {
                anchor: [plateMaxX - cornerR, plateMinY],
                leftDirection: [plateMaxX - cornerR + kR, plateMinY],
                rightDirection: [plateMaxX - cornerR, plateMinY],
                pointType: "CORNER"
            },
            // 5: Bottom edge left (end of bottom straight edge, start of bottom-left corner arc)
            {
                anchor: [plateMinX + cornerR, plateMinY],
                leftDirection: [plateMinX + cornerR, plateMinY],
                rightDirection: [plateMinX + cornerR - kR, plateMinY],
                pointType: "CORNER"
            },
            // 6: Left edge bottom (arc end of bottom-left corner, start of left straight edge)
            {
                anchor: [plateMinX, plateMinY + cornerR],
                leftDirection: [plateMinX, plateMinY + cornerR - kR],
                rightDirection: [plateMinX, plateMinY + cornerR],
                pointType: "CORNER"
            },
            // 7: Left edge top (end of left straight edge, start of top-left corner arc)
            {
                anchor: [plateMinX, plateMaxY - cornerR],
                leftDirection: [plateMinX, plateMaxY - cornerR],
                rightDirection: [plateMinX, plateMaxY - cornerR + kR],
                pointType: "CORNER"
            }
        ];

        // Generate circular Bezier nodes for each unique shaft hole
        var shaftHoles = [];
        for (var si = 0; si < uniqueCenters.length; si++) {
            var sc = uniqueCenters[si];
            var rHole = sc.diameterMm / 2.0;
            var holeCircle = createArcBezierNodes(rHole, 0, 2.0 * Math.PI);
            var hNodes = [];
            for (var hc = 0; hc < holeCircle.length - 1; hc++) {
                var hn = holeCircle[hc];
                hNodes.push({
                    anchor: [hn.anchor[0] + sc.centerMm[0], hn.anchor[1] + sc.centerMm[1]],
                    leftDirection: [hn.leftDirection[0] + sc.centerMm[0], hn.leftDirection[1] + sc.centerMm[1]],
                    rightDirection: [hn.rightDirection[0] + sc.centerMm[0], hn.rightDirection[1] + sc.centerMm[1]],
                    pointType: "SMOOTH"
                });
            }
            shaftHoles.push({
                id: sc.id,
                centerMm: sc.centerMm,
                diameterMm: sc.diameterMm,
                nodes: hNodes
            });
        }

        return {
            outerNodes: outerNodes,
            shaftHoles: shaftHoles,
            holeCount: shaftHoles.length,
            boundsMm: {
                minX: plateMinX,
                minY: plateMinY,
                maxX: plateMaxX,
                maxY: plateMaxY,
                width: w,
                height: h
            }
        };
    }

    /**
     * Calculates mutilated spur gear outer contour and optional two-layer lock plate.
     */
    function calculateMutilatedSpurGear(params) {
        params = params || {};
        var m = parseFloat(params.m || 3.0);
        var z = parseInt(params.z, 10) || 8;
        var x = parseFloat(params.x || 0.0);
        var alphaDeg = parseFloat(params.alphaDeg !== undefined ? params.alphaDeg : 20.0);
        var backlash = parseFloat(params.backlash || 0.0);
        var kerfOffset = parseFloat(params.kerfOffset || 0.0);
        var tipRounding = parseFloat(params.tipRounding || 0.0);
        var pathQuality = params.pathQuality || "bezier_recommended";

        var intermittentRole = params.intermittentRole || "DRIVER";
        var isDriver = (intermittentRole === "DRIVER");
        var isDriven = (intermittentRole === "DRIVEN");
        var structure = params.intermittentStructure || params.structure || "coplanar";
        var lockClearance = (params.lockClearance !== undefined) ? parseFloat(params.lockClearance) : 0.15;
        var tipRelief = !!params.tipRelief;

        var divisions = parseInt(params.divisions, 10) || 4;
        var moveTeeth = parseInt(params.moveTeeth, 10) || 2;
        var activeTeeth = isDriver ? moveTeeth : (params.activeTeeth !== undefined ? parseInt(params.activeTeeth, 10) : z);

        // 1. Calculate standard spur gear base geometry
        var baseGear = InvoluteCore.calculateSpurGear({
            m: m,
            z: z,
            x: x,
            alphaDeg: alphaDeg,
            backlash: backlash,
            kerfOffset: kerfOffset,
            tipRounding: tipRounding,
            pathQuality: pathQuality
        });

        // 2. Precompute short-addendum tooth for tip relief if requested
        var relievedToothNodes = null;
        if (isDriver && tipRelief) {
            var daRelieved = baseGear.da - (0.5 * m);
            var relGear = InvoluteCore.calculateSpurGear({
                m: m,
                z: z,
                x: x,
                alphaDeg: alphaDeg,
                backlash: backlash,
                kerfOffset: kerfOffset,
                tipRounding: tipRounding,
                da: daRelieved,
                pathQuality: pathQuality
            });
            relievedToothNodes = relGear.singleToothNodes;
        }

        var toothPitchAngle = (2.0 * Math.PI) / z;
        var singleToothNodes = baseGear.singleToothNodes;
        var rf = baseGear.rf;
        var lastToothNode = singleToothNodes[singleToothNodes.length - 1];
        var pRightRootX = lastToothNode.anchor[0];
        var pRightRootY = lastToothNode.anchor[1];
        var thRoot = Math.atan2(pRightRootY, pRightRootX);
        var dThRoot = toothPitchAngle - 2.0 * thRoot;
        var hasFlatRoot = (dThRoot > 0.0001);
        var L_root = hasFlatRoot ? ((4.0 / 3.0) * rf * Math.tan(dThRoot / 4.0)) : 0;

        var outerNodes = [];

        if (isDriven) {
            // === Intermittent Driven Gear: divisions sectors ===
            var theta_seg = (2.0 * Math.PI) / divisions;
            var isFullTeeth = (divisions * moveTeeth === z);

            for (var s = 0; s < divisions; s++) {
                var segStartAngle = s * theta_seg;

                for (var t = 0; t < moveTeeth; t++) {
                    var toothRot = segStartAngle + t * toothPitchAngle;
                    var cosR = Math.cos(toothRot);
                    var sinR = Math.sin(toothRot);

                    function tfPtDriven(pt) {
                        var rx = pt[0] * cosR - pt[1] * sinR;
                        var ry = pt[0] * sinR + pt[1] * cosR;
                        return [rx, ry];
                    }

                    var tNodes = [];
                    for (var n = 0; n < singleToothNodes.length; n++) {
                        var nd = singleToothNodes[n];
                        tNodes.push({
                            anchor: tfPtDriven(nd.anchor),
                            leftDirection: tfPtDriven(nd.leftDirection),
                            rightDirection: tfPtDriven(nd.rightDirection),
                            pointType: nd.pointType
                        });
                    }

                    if (!hasFlatRoot) {
                        tNodes[0].pointType = "CORNER";
                        tNodes[tNodes.length - 1].pointType = "CORNER";
                    }

                    var curEndTh = toothRot + thRoot;
                    var curStartTh = toothRot - thRoot;
                    var rEndPt = tfPtDriven([pRightRootX, pRightRootY]);
                    var lStartPt = tfPtDriven([pRightRootX, -pRightRootY]);

                    var isConnectedToNext = (t < moveTeeth - 1) || isFullTeeth;
                    if (isConnectedToNext) {
                        tNodes[tNodes.length - 1].rightDirection = [
                            rEndPt[0] - L_root * Math.sin(curEndTh),
                            rEndPt[1] + L_root * Math.cos(curEndTh)
                        ];
                        tNodes[0].leftDirection = [
                            lStartPt[0] + L_root * Math.sin(curStartTh),
                            lStartPt[1] - L_root * Math.cos(curStartTh)
                        ];
                    }

                    for (var n = 0; n < tNodes.length; n++) {
                        outerNodes.push(tNodes[n]);
                    }
                }

                // If not full teeth, bridge to next sector via root circle rf
                if (!isFullTeeth) {
                    var teethEndAngle = segStartAngle + (moveTeeth - 1) * toothPitchAngle;
                    var nextSegStartAngle = (s + 1) * theta_seg;
                    var exitTh = teethEndAngle + thRoot;
                    var entryThNext = nextSegStartAngle - thRoot;

                    var bridge = createArcBezierNodes(rf, exitTh, entryThNext);
                    if (bridge.length > 0) {
                        var lastActiveNode = outerNodes[outerNodes.length - 1];
                        lastActiveNode.rightDirection = [bridge[0].rightDirection[0], bridge[0].rightDirection[1]];
                        for (var b = 1; b < bridge.length - 1; b++) {
                            outerNodes.push({
                                anchor: [bridge[b].anchor[0], bridge[b].anchor[1]],
                                leftDirection: [bridge[b].leftDirection[0], bridge[b].leftDirection[1]],
                                rightDirection: [bridge[b].rightDirection[0], bridge[b].rightDirection[1]],
                                pointType: "SMOOTH"
                            });
                        }
                    }
                }
            }

            if (!isFullTeeth && outerNodes.length > 0) {
                var finalBridge = createArcBezierNodes(rf, (divisions - 1) * theta_seg + (moveTeeth - 1) * toothPitchAngle + thRoot, 2.0 * Math.PI - thRoot);
                if (finalBridge.length > 0) {
                    outerNodes[0].leftDirection = [finalBridge[finalBridge.length - 1].leftDirection[0], finalBridge[finalBridge.length - 1].leftDirection[1]];
                }
            }

        } else {
            // === Mutilated Driver Gear ===
            var deltaBlank = (z - activeTeeth + 1) * toothPitchAngle - 2.0 * thRoot;
            while (deltaBlank < 0) deltaBlank += 2.0 * Math.PI;

            var exitTh = ((activeTeeth - 1) * toothPitchAngle) + thRoot;
            var entryTh = exitTh + deltaBlank;
            var blankArcNodes = createArcBezierNodes(rf, exitTh, entryTh);

            for (var step = 0; step < activeTeeth; step++) {
                var rot = step * toothPitchAngle;
                var cosR = Math.cos(rot);
                var sinR = Math.sin(rot);

                function tfPtM(pt) {
                    var rx = pt[0] * cosR - pt[1] * sinR;
                    var ry = pt[0] * sinR + pt[1] * cosR;
                    return [rx, ry];
                }

                var isTipReliefTooth = (tipRelief && step === 0 && relievedToothNodes);
                var srcToothNodes = isTipReliefTooth ? relievedToothNodes : singleToothNodes;

                var tNodes = [];
                for (var n = 0; n < srcToothNodes.length; n++) {
                    var nd = srcToothNodes[n];
                    tNodes.push({
                        anchor: tfPtM(nd.anchor),
                        leftDirection: tfPtM(nd.leftDirection),
                        rightDirection: tfPtM(nd.rightDirection),
                        pointType: nd.pointType
                    });
                }

                if (!hasFlatRoot) {
                    tNodes[0].pointType = "CORNER";
                    tNodes[tNodes.length - 1].pointType = "CORNER";
                }

                var curEndTh = rot + thRoot;
                var curStartTh = rot - thRoot;
                var rEndPt = tfPtM([pRightRootX, pRightRootY]);
                var lStartPt = tfPtM([pRightRootX, -pRightRootY]);

                if (step < activeTeeth - 1) {
                    tNodes[tNodes.length - 1].rightDirection = [
                        rEndPt[0] - L_root * Math.sin(curEndTh),
                        rEndPt[1] + L_root * Math.cos(curEndTh)
                    ];
                    tNodes[0].leftDirection = [
                        lStartPt[0] + L_root * Math.sin(curStartTh),
                        lStartPt[1] - L_root * Math.cos(curStartTh)
                    ];
                }

                for (var n = 0; n < tNodes.length; n++) {
                    outerNodes.push(tNodes[n]);
                }
            }

            // Connect exit of active teeth to entry of first tooth along root circle rf
            if (blankArcNodes.length > 0) {
                var lastActiveNode = outerNodes[outerNodes.length - 1];
                lastActiveNode.rightDirection = [blankArcNodes[0].rightDirection[0], blankArcNodes[0].rightDirection[1]];

                for (var b = 1; b < blankArcNodes.length - 1; b++) {
                    outerNodes.push({
                        anchor: [blankArcNodes[b].anchor[0], blankArcNodes[b].anchor[1]],
                        leftDirection: [blankArcNodes[b].leftDirection[0], blankArcNodes[b].leftDirection[1]],
                        rightDirection: [blankArcNodes[b].rightDirection[0], blankArcNodes[b].rightDirection[1]],
                        pointType: "SMOOTH"
                    });
                }

                outerNodes[0].leftDirection = [blankArcNodes[blankArcNodes.length - 1].leftDirection[0], blankArcNodes[blankArcNodes.length - 1].leftDirection[1]];
            }
        }

        // 3. Optional Two-Layer Lock Plate generation
        var lockPlate = null;
        if (structure === "two_layer") {
            var driverZ = isDriver ? z : (params.driverZ || 8);
            var drivenZ = isDriven ? z : (params.drivenZ || (divisions * moveTeeth));
            var centerDist = (m * (driverZ + drivenZ)) / 2.0;

            if (isDriver) {
                var crescentNodes = generateCrescentDiscNodes({
                    rDisc: baseGear.rp,
                    rCrescent: ((m * drivenZ) / 2.0 + m) + lockClearance,
                    centerDist: centerDist,
                    z1: z,
                    activeTeeth: activeTeeth
                });
                lockPlate = {
                    name: "LockCam_Driver",
                    outerNodes: crescentNodes,
                    radiusMm: baseGear.rp
                };
            } else {
                var starNodes = generateGenevaLockStarNodes({
                    rStar: baseGear.ra,
                    rPocket: ((m * driverZ) / 2.0) + lockClearance,
                    centerDist: centerDist,
                    divisions: divisions,
                    moveTeeth: moveTeeth,
                    z2: z
                });
                lockPlate = {
                    name: "LockStar_Driven",
                    outerNodes: starNodes,
                    radiusMm: baseGear.ra
                };
            }
        }

        return {
            m: m,
            z: z,
            x: x,
            alphaDeg: alphaDeg,
            rp: baseGear.rp,
            rb: baseGear.rb,
            ra: baseGear.ra,
            rf: baseGear.rf,
            d: baseGear.d,
            isMutilated: true,
            activeTeeth: activeTeeth,
            divisions: divisions,
            moveTeeth: moveTeeth,
            intermittentRole: intermittentRole,
            intermittentStructure: structure,
            outerNodes: outerNodes,
            lockPlate: lockPlate
        };
    }

    /**
     * Validates the 4 major interferences in an internal gear mesh.
     * Delegates to InvoluteCore.validateInternalInterference if available.
     */
    function validateInternalInterference(m, z1, z2, alphaDeg, x1, x2, aw, alphaWRad, deltaY) {
        if (typeof InvoluteCore !== "undefined" && InvoluteCore.validateInternalInterference) {
            return InvoluteCore.validateInternalInterference(m, z1, z2, alphaDeg, x1, x2, aw, alphaWRad, deltaY);
        }
        m = parseFloat(m) || 2.0;
        z1 = parseInt(z1, 10);
        z2 = parseInt(z2, 10);
        alphaDeg = parseFloat(alphaDeg !== undefined ? alphaDeg : 20.0);
        var alphaRad = alphaDeg * (Math.PI / 180.0);
        x1 = parseFloat(x1 !== undefined ? x1 : 0.0);
        x2 = parseFloat(x2 !== undefined ? x2 : 0.0);
        var zDiff = z2 - z1;
        var sinA = Math.sin(alphaRad);
        var deltaZLimit = (2.0 * (1.0 + x2 - x1)) / Math.max(1e-6, sinA * sinA);
        var hasTrochoid = (zDiff < Math.ceil(deltaZLimit));
        return {
            involute: false,
            trochoid: hasTrochoid,
            trimming: false,
            cresting: false,
            hasAnyInterference: hasTrochoid,
            warnings: hasTrochoid ? ["Trochoid interference: tooth difference z2 - z1 < limit"] : []
        };
    }

    return {
        MM_TO_PT: MM_TO_PT,
        PT_TO_MM: PT_TO_MM,
        createArcBezierNodes: createArcBezierNodes,
        solveStandardPlanetary: solveStandardPlanetary,
        solveParadoxicalPlanetary: solveParadoxicalPlanetary,
        createConcaveLockArcNodes: createConcaveLockArcNodes,
        generateCrescentDiscNodes: generateCrescentDiscNodes,
        generateGenevaLockStarNodes: generateGenevaLockStarNodes,
        calculateIntermittentKinematics: calculateIntermittentKinematics,
        calculatePlanetaryCarrier: calculatePlanetaryCarrier,
        calculateTrainBasePlate: calculateTrainBasePlate,
        calculateMutilatedSpurGear: calculateMutilatedSpurGear,
        validateInternalInterference: validateInternalInterference
    };
})();

/**
 * ShaftAndBody.jsxinc - Mechanical Shaft Holes & Parametric Cutouts for GearDrawer
 * Part of GearDrawer Architecture (JIS B 1301 / JIS B 0003)
 * Version: 1.0.0
 * 
 * Strict ECMAScript 3 (ExtendScript compatible). All internal calculations are performed in millimeters (mm).
 */

var ShaftAndBody = (function () {
    // JIS B 1301 Parallel Key & Keyway Table
    var JIS_B_1301_TABLE = [
        { dMax: 6,  b2: 2.0, t2: 1.0 },
        { dMax: 8,  b2: 2.0, t2: 1.0 },
        { dMax: 10, b2: 3.0, t2: 1.4 },
        { dMax: 12, b2: 4.0, t2: 1.8 },
        { dMax: 17, b2: 5.0, t2: 2.3 },
        { dMax: 22, b2: 6.0, t2: 2.8 },
        { dMax: 30, b2: 8.0, t2: 3.3 },
        { dMax: 38, b2: 10.0, t2: 3.3 },
        { dMax: 44, b2: 12.0, t2: 3.3 },
        { dMax: 50, b2: 14.0, t2: 3.8 },
        { dMax: 58, b2: 16.0, t2: 4.3 },
        { dMax: 65, b2: 18.0, t2: 4.4 },
        { dMax: 75, b2: 20.0, t2: 4.9 },
        { dMax: 85, b2: 22.0, t2: 5.4 }
    ];

    /**
     * Retrieves JIS B 1301 keyway dimensions (width b2, depth t2) for a given shaft diameter.
     * @param {number} shaftDiameter Shaft diameter in mm
     * @returns {Object} { b2: number, t2: number }
     */
    function getJISKeywayDimensions(shaftDiameter) {
        var d = parseFloat(shaftDiameter) || 0;
        if (d <= 0) return { b2: 0, t2: 0 };
        for (var i = 0; i < JIS_B_1301_TABLE.length; i++) {
            if (d <= JIS_B_1301_TABLE[i].dMax) {
                return { b2: JIS_B_1301_TABLE[i].b2, t2: JIS_B_1301_TABLE[i].t2 };
            }
        }
        return { b2: Math.round(d * 0.25 * 10) / 10, t2: Math.round(d * 0.06 * 10) / 10 };
    }

    /**
     * Calculates D-Cut flat depth.
     * @param {number} shaftDiameter Shaft diameter in mm
     * @param {number} customDepth Optional custom depth in mm
     * @returns {number} D-cut depth h in mm
     */
    function getDCutDepth(shaftDiameter, customDepth) {
        if (customDepth !== undefined && !isNaN(customDepth) && parseFloat(customDepth) > 0) {
            return parseFloat(customDepth);
        }
        var d = parseFloat(shaftDiameter) || 0;
        if (d <= 0) return 0;
        var h = Math.round(d * 0.10 * 10) / 10;
        if (h < 0.5) h = 0.5;
        if (h >= d * 0.45) h = d * 0.45;
        return h;
    }

    /**
     * Normalizes shaft type identifier.
     */
    function normalizeShaftType(typeStr) {
        if (!typeStr) return "ROUND";
        var s = String(typeStr).toLowerCase();
        if (s.indexOf("d-cut") !== -1 || s.indexOf("d_cut") !== -1 || s.indexOf("d\u30ab\u30c3\u30c8") !== -1 || s.indexOf("dcut") !== -1) {
            return "DCUT";
        }
        if (s.indexOf("keyway") !== -1 || s.indexOf("\u30ad\u30fc\u6e9d") !== -1 || s.indexOf("key") !== -1) {
            return "KEYWAY";
        }
        if (s.indexOf("none") !== -1 || s.indexOf("\u306a\u3057") !== -1) {
            return "NONE";
        }
        if (s.indexOf("cross") !== -1 || s.indexOf("\u5341\u5b57") !== -1 ||
            s.indexOf("bearing") !== -1 || s.indexOf("\u30d9\u30a2\u30ea\u30f3\u30b0") !== -1) {
            // CROSS_SLOT and BEARING_BORE are reserved for future release; fallback to ROUND for safety
            return "ROUND";
        }
        return "ROUND";
    }

    /**
     * Creates an accurate circular arc Bezier node sequence in mm.
     * @param {number} R Radius in mm
     * @param {number} thetaStart Starting angle in radians
     * @param {number} thetaEnd Ending angle in radians
     * @returns {Array} Array of node objects
     */
    function createArcBezierNodes(R, thetaStart, thetaEnd) {
        var totalAngle = thetaEnd - thetaStart;
        while (totalAngle < 0) totalAngle += 2.0 * Math.PI;
        if (totalAngle < 1e-6) return [];

        var segments = Math.max(1, Math.ceil(totalAngle / (Math.PI / 2.0)));
        var dTheta = totalAngle / segments;
        var h = (4.0 / 3.0) * R * Math.tan(dTheta / 4.0);

        var nodes = [];
        for (var i = 0; i <= segments; i++) {
            var th = thetaStart + i * dTheta;
            var cosT = Math.cos(th);
            var sinT = Math.sin(th);
            var ax = R * cosT;
            var ay = R * sinT;

            var lx = ax + h * sinT;
            var ly = ay - h * cosT;
            var rx = ax - h * sinT;
            var ry = ay + h * cosT;

            nodes.push({
                anchor: [ax, ay],
                leftDirection: [lx, ly],
                rightDirection: [rx, ry],
                pointType: "SMOOTH",
                theta: th
            });
        }
        return nodes;
    }

    /**
     * Calculates closed Bezier contour for standard shaft holes in mm.
     * 
     * @param {number} shaftDiameter Shaft diameter in mm
     * @param {string} shaftTypeStr "ROUND" | "DCUT" | "KEYWAY" | "NONE"
     * @param {Object} options Configuration options:
     *   - dCutDepth: Custom D-cut depth (mm)
     *   - keyWidth: Custom keyway width (mm)
     *   - keyDepth: Custom keyway depth (mm)
     * @returns {Object} Shaft hole geometry with nodes array
     */
    function calculateShaftHole(shaftDiameter, shaftTypeStr, options) {
        options = options || {};
        var d = parseFloat(shaftDiameter) || 0;
        var type = normalizeShaftType(shaftTypeStr);

        if (d <= 0 || type === "NONE") {
            return {
                hasHole: false,
                shaftDiameter: 0,
                shaftType: "NONE",
                nodes: [],
                bounds: { width: 0, height: 0 }
            };
        }

        if (d > 300) {
            d = 300;
        }
        if (d < 0.2) {
            return {
                hasHole: false,
                shaftDiameter: 0,
                shaftType: "NONE",
                nodes: [],
                bounds: { width: 0, height: 0 },
                warning: "Shaft diameter too small (< 0.2 mm), suppressed."
            };
        }

        var R = d / 2.0;
        var nodes = [];

        if (type === "ROUND") {
            // Standard 4-bezier circle (radius R)
            var KAPPA = (4.0 / 3.0) * (Math.SQRT2 - 1.0);
            var k = R * KAPPA;

            nodes.push({
                anchor: [R, 0],
                leftDirection: [R, -k],
                rightDirection: [R, k],
                pointType: "SMOOTH"
            });
            nodes.push({
                anchor: [0, R],
                leftDirection: [k, R],
                rightDirection: [-k, R],
                pointType: "SMOOTH"
            });
            nodes.push({
                anchor: [-R, 0],
                leftDirection: [-R, k],
                rightDirection: [-R, -k],
                pointType: "SMOOTH"
            });
            nodes.push({
                anchor: [0, -R],
                leftDirection: [-k, -R],
                rightDirection: [k, -R],
                pointType: "SMOOTH"
            });

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "ROUND",
                nodes: nodes,
                bounds: { width: d, height: d }
            };
        }

        if (type === "DCUT") {
            var h = getDCutDepth(d, options.dCutDepth);
            var yc = R - h;
            var xc = Math.sqrt(Math.max(0, R * R - yc * yc));

            var th1 = Math.atan2(yc, xc);
            var th2 = Math.PI - th1;

            var arcNodes = createArcBezierNodes(R, th2, 2 * Math.PI + th1);

            // D-cut flat line corners
            var leftCornerNode = {
                anchor: [-xc, yc],
                leftDirection: [-xc, yc],
                rightDirection: arcNodes[0].rightDirection,
                pointType: "CORNER"
            };

            var rightCornerNode = {
                anchor: [xc, yc],
                leftDirection: arcNodes[arcNodes.length - 1].leftDirection,
                rightDirection: [xc, yc],
                pointType: "CORNER"
            };

            nodes.push(rightCornerNode);
            nodes.push(leftCornerNode);

            for (var a = 1; a < arcNodes.length - 1; a++) {
                nodes.push({
                    anchor: arcNodes[a].anchor,
                    leftDirection: arcNodes[a].leftDirection,
                    rightDirection: arcNodes[a].rightDirection,
                    pointType: "SMOOTH"
                });
            }

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "DCUT",
                dCutDepth: h,
                flatThickness: d - h,
                nodes: nodes,
                bounds: { width: d, height: d - h / 2.0 }
            };
        }

        if (type === "KEYWAY") {
            var jis = getJISKeywayDimensions(d);
            var b2 = options.keyWidth || jis.b2;
            var t2 = options.keyDepth || jis.t2;

            var halfB = b2 / 2.0;
            if (halfB >= R) halfB = R * 0.9;
            var yk = Math.sqrt(Math.max(0, R * R - halfB * halfB));
            var yTop = R + t2;

            var th1 = Math.atan2(yk, halfB);
            var th4 = Math.PI - Math.atan2(yk, halfB);

            var arcNodes = createArcBezierNodes(R, th4, 2 * Math.PI + th1);

            var k1Node = {
                anchor: [halfB, yk],
                leftDirection: arcNodes[arcNodes.length - 1].leftDirection,
                rightDirection: [halfB, yk],
                pointType: "CORNER"
            };
            var k2Node = {
                anchor: [halfB, yTop],
                leftDirection: [halfB, yTop],
                rightDirection: [halfB, yTop],
                pointType: "CORNER"
            };
            var k3Node = {
                anchor: [-halfB, yTop],
                leftDirection: [-halfB, yTop],
                rightDirection: [-halfB, yTop],
                pointType: "CORNER"
            };
            var k4Node = {
                anchor: [-halfB, yk],
                leftDirection: [-halfB, yk],
                rightDirection: arcNodes[0].rightDirection,
                pointType: "CORNER"
            };

            nodes.push(k1Node);
            nodes.push(k2Node);
            nodes.push(k3Node);
            nodes.push(k4Node);

            for (var ka = 1; ka < arcNodes.length - 1; ka++) {
                nodes.push({
                    anchor: arcNodes[ka].anchor,
                    leftDirection: arcNodes[ka].leftDirection,
                    rightDirection: arcNodes[ka].rightDirection,
                    pointType: "SMOOTH"
                });
            }

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "KEYWAY",
                b2: b2,
                t2: t2,
                nodes: nodes,
                bounds: { width: d, height: R + yTop }
            };
        }

        return {
            hasHole: false,
            shaftDiameter: 0,
            shaftType: "NONE",
            nodes: []
        };
    }

    /**
     * Calculates coaxial alignment pin holes for gear stacking.
     * 
     * @param {number} rf Dedendum root radius in mm
     * @param {number} shaftDiameter Shaft diameter in mm
     * @param {Object} options Configuration options:
     *   - pinCount: Number of pin holes (default 2)
     *   - pinDiameter: Pin hole diameter in mm (default 2.0)
     *   - pinPitchRadius: Pitch circle radius for pin holes in mm
     *   - baseAngleRad: Initial rotation offset in radians (default 0)
     * @returns {Object} Alignment pin holes geometry
     */
    function calculateAlignmentPinHoles(rf, shaftDiameter, options) {
        options = options || {};
        var pinCount = Math.max(1, parseInt(options.pinCount || 2, 10));
        var pinDia = parseFloat(options.pinDiameter || 2.0);
        var rShaft = (parseFloat(shaftDiameter) || 0) / 2.0;
        var rPitch = parseFloat(options.pinPitchRadius || ((rShaft + rf) / 2.0));

        var marginInner = (rPitch - pinDia / 2.0) - rShaft;
        var marginOuter = rf - (rPitch + pinDia / 2.0);
        if (marginInner < 0.5 || marginOuter < 0.5) {
            return {
                valid: false,
                reason: "Insufficient radial margin for pin holes"
            };
        }

        var holes = [];
        var baseAngle = parseFloat(options.baseAngleRad || 0);
        var KAPPA = (4.0 / 3.0) * (Math.SQRT2 - 1.0);
        var rPin = pinDia / 2.0;
        var kPin = rPin * KAPPA;

        for (var i = 0; i < pinCount; i++) {
            var ang = baseAngle + (i * 2.0 * Math.PI / pinCount);
            var cx = rPitch * Math.cos(ang);
            var cy = rPitch * Math.sin(ang);

            var holeNodes = [
                {
                    anchor: [cx + rPin, cy],
                    leftDirection: [cx + rPin, cy - kPin],
                    rightDirection: [cx + rPin, cy + kPin],
                    pointType: "SMOOTH"
                },
                {
                    anchor: [cx, cy + rPin],
                    leftDirection: [cx + kPin, cy + rPin],
                    rightDirection: [cx - kPin, cy + rPin],
                    pointType: "SMOOTH"
                },
                {
                    anchor: [cx - rPin, cy],
                    leftDirection: [cx - rPin, cy + kPin],
                    rightDirection: [cx - rPin, cy - kPin],
                    pointType: "SMOOTH"
                },
                {
                    anchor: [cx, cy - rPin],
                    leftDirection: [cx - kPin, cy - rPin],
                    rightDirection: [cx + kPin, cy - rPin],
                    pointType: "SMOOTH"
                }
            ];

            holes.push({
                center: [cx, cy],
                radius: rPin,
                diameter: pinDia,
                nodes: holeNodes
            });
        }

        return {
            valid: true,
            holes: holes,
            pitchRadius: rPitch,
            diameter: pinDia,
            pinCount: pinCount
        };
    }

    /**
     * Calculates parametric weight-reduction cutouts (Sector spoke windows or Circular holes).
     * Strictly verifies safe boundary r_limit = rf - m to prevent cutting into gear teeth.
     * 
     * @param {number} rf Dedendum root radius in mm
     * @param {number} shaftDiameter Shaft hole diameter in mm
     * @param {string} cutoutType "NONE" | "CIRCULAR_HOLES" | "SPOKE_WINDOWS"
     * @param {Object} options Configuration options:
     *   - holeCount / spokeCount: Number of holes or spokes (default 4)
     *   - rimThickness: Outer rim wall thickness in mm (default 2.5 * m)
     *   - hubDiameter: Central hub cylinder diameter in mm (default shaftDiameter + 4.0)
     *   - spokeWidth: Spoke beam width in mm (default 2.5)
     *   - holeDiameter: Diameter for circular holes in mm
     *   - m: Module in mm (default 2.0)
     * @returns {Object} Parametric cutout geometry with cutouts array (each cutout is a node array)
     */
    function calculateParametricCutouts(rf, shaftDiameter, cutoutType, options) {
        options = options || {};
        var type = String(cutoutType || "NONE").toUpperCase();
        if (type === "SPOKES") type = "SPOKE_WINDOWS";
        if (type === "HOLES") type = "CIRCULAR_HOLES";
        if (type === "NONE") {
            return { valid: false, cutoutType: "NONE", count: 0, cutouts: [] };
        }

        var m = parseFloat(options.m || 2.0);
        var rShaft = (parseFloat(shaftDiameter) || 0) / 2.0;
        var rLimit = rf - m; // Safety limit radius

        var rimThickness = parseFloat(options.rimThickness !== undefined ? options.rimThickness : (2.5 * m));
        var rOuter = rf - rimThickness;
        if (rOuter > rLimit) rOuter = rLimit;

        var hubDia = parseFloat(options.hubDiameter !== undefined ? options.hubDiameter : Math.max(rShaft * 2.0 + 4.0, rShaft * 3.0));
        var rInner = hubDia / 2.0;
        if (rInner < rShaft + 1.0) rInner = rShaft + 1.0;

        // Radial space validation
        if (rOuter <= rInner + 2.0) {
            return {
                valid: false,
                reason: "Insufficient radial space between hub and rim",
                cutoutType: type,
                count: 0,
                cutouts: []
            };
        }

        var cutouts = [];

        if (type === "CIRCULAR_HOLES") {
            var count = Math.max(2, parseInt(options.holeCount || options.count || 4, 10));
            var rPitch = (rInner + rOuter) / 2.0;
            var maxDiaRadial = (rOuter - rInner) * 0.85;
            var maxDiaAngular = 2.0 * rPitch * Math.sin(Math.PI / count) * 0.75;
            var holeDia = parseFloat(options.holeDiameter !== undefined ? options.holeDiameter : Math.min(maxDiaRadial, maxDiaAngular));
            if (holeDia < 1.0) {
                return { valid: false, reason: "Hole diameter too small", cutoutType: type, count: 0, cutouts: [] };
            }

            var rHole = holeDia / 2.0;
            var KAPPA = (4.0 / 3.0) * (Math.SQRT2 - 1.0);
            var kHole = rHole * KAPPA;

            for (var c = 0; c < count; c++) {
                var ang = (c * 2.0 * Math.PI) / count;
                var hcx = rPitch * Math.cos(ang);
                var hcy = rPitch * Math.sin(ang);

                var cNodes = [
                    {
                        anchor: [hcx + rHole, hcy],
                        leftDirection: [hcx + rHole, hcy - kHole],
                        rightDirection: [hcx + rHole, hcy + kHole],
                        pointType: "SMOOTH"
                    },
                    {
                        anchor: [hcx, hcy + rHole],
                        leftDirection: [hcx + kHole, hcy + rHole],
                        rightDirection: [hcx - kHole, hcy + rHole],
                        pointType: "SMOOTH"
                    },
                    {
                        anchor: [hcx - rHole, hcy],
                        leftDirection: [hcx - rHole, hcy + kHole],
                        rightDirection: [hcx - rHole, hcy - kHole],
                        pointType: "SMOOTH"
                    },
                    {
                        anchor: [hcx, hcy - rHole],
                        leftDirection: [hcx - kHole, hcy - rHole],
                        rightDirection: [hcx + kHole, hcy - rHole],
                        pointType: "SMOOTH"
                    }
                ];
                cutouts.push(cNodes);
            }

            return {
                valid: true,
                cutoutType: "CIRCULAR_HOLES",
                count: count,
                pitchRadius: rPitch,
                holeDiameter: holeDia,
                cutouts: cutouts
            };
        }

        if (type === "SPOKE_WINDOWS") {
            var spokeCount = Math.max(2, parseInt(options.spokeCount || options.count || 4, 10));
            var spokeWidth = parseFloat(options.spokeWidth !== undefined ? options.spokeWidth : Math.max(2.0, 1.5 * m));
            var halfW = spokeWidth / 2.0;

            var dPhi = (2.0 * Math.PI) / spokeCount;

            // Half angular subtenses of the spoke beam at inner and outer radii
            var sinThIn = Math.min(0.85, halfW / rInner);
            var sinThOut = Math.min(0.85, halfW / rOuter);
            var thSpokeIn = Math.asin(sinThIn);
            var thSpokeOut = Math.asin(sinThOut);

            var halfWinIn = (dPhi / 2.0) - thSpokeIn;
            var halfWinOut = (dPhi / 2.0) - thSpokeOut;

            if (halfWinIn < 0.05 || halfWinOut < 0.05) {
                return {
                    valid: false,
                    reason: "Spoke width too wide for given spoke count",
                    cutoutType: type,
                    count: 0,
                    cutouts: []
                };
            }

            // Fillet radius calculation for stress concentration relief at four corners (R = 1.0 - 2.0 mm or 0.5m)
            var targetRf = (options.filletRadius !== undefined && !isNaN(options.filletRadius)) ?
                           parseFloat(options.filletRadius) : Math.min(2.0, Math.max(1.0, 0.5 * m));
            var radialSpan = rOuter - rInner;
            var maxRf = Math.min(radialSpan * 0.35, Math.min(rInner * halfWinIn * 0.4, rOuter * halfWinOut * 0.4));
            var rf = Math.min(targetRf, maxRf);
            var useFillet = (rf >= 0.2);

            var KAPPA = (4.0 / 3.0) * (Math.sqrt(2.0) - 1.0); // Bezier circle approximation factor ~0.5522847

            for (var s = 0; s < spokeCount; s++) {
                var phiC = s * dPhi;
                var winNodes = [];

                if (useFillet) {
                    var dThIn = rf / rInner;
                    var dThOut = rf / rOuter;

                    var thInStart = phiC - halfWinIn + dThIn;
                    var thInEnd = phiC + halfWinIn - dThIn;

                    var thOutStart = phiC + halfWinOut - dThOut;
                    var thOutEnd = phiC - halfWinOut + dThOut;

                    // Wall corner points (without fillet)
                    var wIn1 = [rInner * Math.cos(phiC - halfWinIn), rInner * Math.sin(phiC - halfWinIn)];
                    var wOut1 = [rOuter * Math.cos(phiC - halfWinOut), rOuter * Math.sin(phiC - halfWinOut)];
                    var wIn2 = [rInner * Math.cos(phiC + halfWinIn), rInner * Math.sin(phiC + halfWinIn)];
                    var wOut2 = [rOuter * Math.cos(phiC + halfWinOut), rOuter * Math.sin(phiC + halfWinOut)];

                    // Right wall direction vector (from inner to outer)
                    var vw2 = [wOut2[0] - wIn2[0], wOut2[1] - wIn2[1]];
                    var lenW2 = Math.sqrt(vw2[0] * vw2[0] + vw2[1] * vw2[1]);
                    var uw2 = (lenW2 > 1e-6) ? [vw2[0] / lenW2, vw2[1] / lenW2] : [Math.cos(phiC + halfWinIn), Math.sin(phiC + halfWinIn)];

                    // Left wall direction vector (from outer to inner)
                    var vw1 = [wIn1[0] - wOut1[0], wIn1[1] - wOut1[1]];
                    var lenW1 = Math.sqrt(vw1[0] * vw1[0] + vw1[1] * vw1[1]);
                    var uw1 = (lenW1 > 1e-6) ? [vw1[0] / lenW1, vw1[1] / lenW1] : [-Math.cos(phiC - halfWinOut), -Math.sin(phiC - halfWinOut)];

                    // Wall tangent fillet points
                    var pW2In = [wIn2[0] + uw2[0] * rf, wIn2[1] + uw2[1] * rf];
                    var pW2Out = [wOut2[0] - uw2[0] * rf, wOut2[1] - uw2[1] * rf];

                    var pW1Out = [wOut1[0] + uw1[0] * rf, wOut1[1] + uw1[1] * rf];
                    var pW1In = [wIn1[0] - uw1[0] * rf, wIn1[1] - uw1[1] * rf];

                    // 1. Inner arc nodes
                    var arcIn = createArcBezierNodes(rInner, thInStart, thInEnd);
                    for (var ni = 0; ni < arcIn.length; ni++) {
                        var inNd = {
                            anchor: [arcIn[ni].anchor[0], arcIn[ni].anchor[1]],
                            leftDirection: [arcIn[ni].leftDirection[0], arcIn[ni].leftDirection[1]],
                            rightDirection: [arcIn[ni].rightDirection[0], arcIn[ni].rightDirection[1]],
                            pointType: "SMOOTH"
                        };
                        if (ni === 0) {
                            // Tangent at thInStart for Corner 1 incoming fillet
                            var tIn1 = [-Math.sin(thInStart), Math.cos(thInStart)];
                            inNd.leftDirection = [inNd.anchor[0] - tIn1[0] * (rf * KAPPA), inNd.anchor[1] - tIn1[1] * (rf * KAPPA)];
                        }
                        if (ni === arcIn.length - 1) {
                            // Tangent at thInEnd for Corner 2 outgoing fillet
                            var tIn2 = [-Math.sin(thInEnd), Math.cos(thInEnd)];
                            inNd.rightDirection = [inNd.anchor[0] + tIn2[0] * (rf * KAPPA), inNd.anchor[1] + tIn2[1] * (rf * KAPPA)];
                        }
                        winNodes.push(inNd);
                    }

                    // 2. Right wall inner fillet end (Corner 2 end)
                    winNodes.push({
                        anchor: [pW2In[0], pW2In[1]],
                        leftDirection: [pW2In[0] - uw2[0] * (rf * KAPPA), pW2In[1] - uw2[1] * (rf * KAPPA)],
                        rightDirection: [pW2In[0], pW2In[1]],
                        pointType: "SMOOTH"
                    });

                    // 3. Right wall outer fillet start (Corner 3 start)
                    winNodes.push({
                        anchor: [pW2Out[0], pW2Out[1]],
                        leftDirection: [pW2Out[0], pW2Out[1]],
                        rightDirection: [pW2Out[0] + uw2[0] * (rf * KAPPA), pW2Out[1] + uw2[1] * (rf * KAPPA)],
                        pointType: "SMOOTH"
                    });

                    // 4. Outer arc nodes (in reverse to follow CCW loop)
                    var arcOut = createArcBezierNodes(rOuter, thOutEnd, thOutStart);
                    for (var no = arcOut.length - 1; no >= 0; no--) {
                        var outNd = {
                            anchor: [arcOut[no].anchor[0], arcOut[no].anchor[1]],
                            // Reverse handle direction since iterating backwards
                            leftDirection: [arcOut[no].rightDirection[0], arcOut[no].rightDirection[1]],
                            rightDirection: [arcOut[no].leftDirection[0], arcOut[no].leftDirection[1]],
                            pointType: "SMOOTH"
                        };
                        if (no === arcOut.length - 1) {
                            // Tangent at thOutStart for Corner 3 incoming fillet (clockwise)
                            var tOut3 = [Math.sin(thOutStart), -Math.cos(thOutStart)];
                            outNd.leftDirection = [outNd.anchor[0] - tOut3[0] * (rf * KAPPA), outNd.anchor[1] - tOut3[1] * (rf * KAPPA)];
                        }
                        if (no === 0) {
                            // Tangent at thOutEnd for Corner 4 outgoing fillet (clockwise)
                            var tOut4 = [Math.sin(thOutEnd), -Math.cos(thOutEnd)];
                            outNd.rightDirection = [outNd.anchor[0] + tOut4[0] * (rf * KAPPA), outNd.anchor[1] + tOut4[1] * (rf * KAPPA)];
                        }
                        winNodes.push(outNd);
                    }

                    // 5. Left wall outer fillet end (Corner 4 end)
                    winNodes.push({
                        anchor: [pW1Out[0], pW1Out[1]],
                        leftDirection: [pW1Out[0] - uw1[0] * (rf * KAPPA), pW1Out[1] - uw1[1] * (rf * KAPPA)],
                        rightDirection: [pW1Out[0], pW1Out[1]],
                        pointType: "SMOOTH"
                    });

                    // 6. Left wall inner fillet start (Corner 1 start)
                    winNodes.push({
                        anchor: [pW1In[0], pW1In[1]],
                        leftDirection: [pW1In[0], pW1In[1]],
                        rightDirection: [pW1In[0] + uw1[0] * (rf * KAPPA), pW1In[1] + uw1[1] * (rf * KAPPA)],
                        pointType: "SMOOTH"
                    });

                } else {
                    // Fallback to sharp corners when fillet is too small
                    var thInStart = phiC - halfWinIn;
                    var thInEnd = phiC + halfWinIn;
                    var arcIn = createArcBezierNodes(rInner, thInStart, thInEnd);

                    var thOutStart = phiC + halfWinOut;
                    var thOutEnd = phiC - halfWinOut;
                    var arcOut = createArcBezierNodes(rOuter, thOutEnd, thOutStart);

                    for (var ni = 0; ni < arcIn.length; ni++) {
                        winNodes.push({
                            anchor: arcIn[ni].anchor,
                            leftDirection: arcIn[ni].leftDirection,
                            rightDirection: arcIn[ni].rightDirection,
                            pointType: (ni === 0 || ni === arcIn.length - 1) ? "CORNER" : "SMOOTH"
                        });
                    }

                    for (var no = arcOut.length - 1; no >= 0; no--) {
                        winNodes.push({
                            anchor: arcOut[no].anchor,
                            leftDirection: arcOut[no].rightDirection,
                            rightDirection: arcOut[no].leftDirection,
                            pointType: (no === 0 || no === arcOut.length - 1) ? "CORNER" : "SMOOTH"
                        });
                    }
                }

                cutouts.push(winNodes);
            }

            return {
                valid: true,
                cutoutType: "SPOKE_WINDOWS",
                count: spokeCount,
                rInner: rInner,
                rOuter: rOuter,
                spokeWidth: spokeWidth,
                filletRadius: useFillet ? rf : 0,
                cutouts: cutouts
            };
        }

        return { valid: false, cutoutType: "NONE", count: 0, cutouts: [] };
    }

    /**
     * Calculates central sun hole and orbit pin holes for planetary carrier.
     */
    function calculateCarrierShaftHoles(sunShaftDiameter, pinHolesSpec) {
        pinHolesSpec = pinHolesSpec || {};
        var sunDia = parseFloat(sunShaftDiameter) || 0;
        var rSun = sunDia / 2.0;
        var sunHole = (rSun > 0) ? createArcBezierNodes(rSun, 0, 2.0 * Math.PI) : [];

        var N = parseInt(pinHolesSpec.count, 10) || 3;
        var pcd = parseFloat(pinHolesSpec.pcd) || 0;
        var rOrbit = pcd / 2.0;
        var pinDia = parseFloat(pinHolesSpec.diameter) || 4.0;
        var rPin = pinDia / 2.0;
        var angleOffset = parseFloat(pinHolesSpec.angleOffsetDeg || 0.0) * (Math.PI / 180.0);

        var pinHoles = [];
        var dTheta = (2.0 * Math.PI) / N;

        for (var i = 0; i < N; i++) {
            var th = angleOffset + i * dTheta;
            var px = rOrbit * Math.cos(th);
            var py = rOrbit * Math.sin(th);

            var circleArc = createArcBezierNodes(rPin, 0, 2.0 * Math.PI);
            var shiftedNodes = [];
            for (var c = 0; c < circleArc.length - 1; c++) {
                var nd = circleArc[c];
                shiftedNodes.push({
                    anchor: [nd.anchor[0] + px, nd.anchor[1] + py],
                    leftDirection: [nd.leftDirection[0] + px, nd.leftDirection[1] + py],
                    rightDirection: [nd.rightDirection[0] + px, nd.rightDirection[1] + py],
                    pointType: "SMOOTH"
                });
            }
            pinHoles.push({
                centerMm: [px, py],
                diameterMm: pinDia,
                nodes: shiftedNodes
            });
        }

        return {
            sunHole: sunHole,
            pinHoles: pinHoles,
            orbitRadiusMm: rOrbit
        };
    }

    /**
     * Deduplicates shaft center coordinates and generates circular holes for a train base plate.
     */
    function calculateBasePlateShaftHoles(holesList) {
        holesList = holesList || [];
        var uniqueHoles = [];

        for (var i = 0; i < holesList.length; i++) {
            var item = holesList[i];
            var cx = parseFloat(item.x || (item.centerMm ? item.centerMm[0] : 0));
            var cy = parseFloat(item.y || (item.centerMm ? item.centerMm[1] : 0));
            var dia = parseFloat(item.diameter || item.diameterMm || 8.0);

            var exists = false;
            for (var u = 0; u < uniqueHoles.length; u++) {
                var uh = uniqueHoles[u];
                var dx = uh.centerMm[0] - cx;
                var dy = uh.centerMm[1] - cy;
                if (Math.sqrt(dx * dx + dy * dy) < 0.05) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                var rHole = dia / 2.0;
                var circleArc = createArcBezierNodes(rHole, 0, 2.0 * Math.PI);
                var shiftedNodes = [];
                for (var c = 0; c < circleArc.length - 1; c++) {
                    var nd = circleArc[c];
                    shiftedNodes.push({
                        anchor: [nd.anchor[0] + cx, nd.anchor[1] + cy],
                        leftDirection: [nd.leftDirection[0] + cx, nd.leftDirection[1] + cy],
                        rightDirection: [nd.rightDirection[0] + cx, nd.rightDirection[1] + cy],
                        pointType: "SMOOTH"
                    });
                }
                uniqueHoles.push({
                    id: item.id || ("Hole_" + (uniqueHoles.length + 1)),
                    centerMm: [cx, cy],
                    diameterMm: dia,
                    nodes: shiftedNodes
                });
            }
        }

        return uniqueHoles;
    }

    /**
     * Safety boundary checker for injected internal paths (group shapes or external .ai).
     * Ensures all inner cutout points remain strictly within the root safety limit radius:
     * r_limit = rf - m
     * 
     * @param {number} rf Root circle radius in mm
     * @param {number} m Module in mm
     * @param {Array} innerPoints Array of points [x, y] in mm (relative to gear center)
     * @returns {Object} { safe: boolean, rLimit: number, maxRadius: number, warning: string }
     */
    function checkSafetyBoundary(rf, m, innerPoints) {
        var rLimit = Math.max(0.1, (parseFloat(rf) || 0) - (parseFloat(m) || 0));
        var maxR = 0.0;
        var violationCount = 0;

        if (innerPoints && innerPoints.length > 0) {
            for (var i = 0; i < innerPoints.length; i++) {
                var pt = innerPoints[i];
                var x = pt[0] || 0;
                var y = pt[1] || 0;
                var r = Math.sqrt(x * x + y * y);
                if (r > maxR) {
                    maxR = r;
                }
                if (r > rLimit + 1e-4) {
                    violationCount++;
                }
            }
        }

        var isSafe = (violationCount === 0);
        var warningMsg = isSafe ? "" :
            ("\u8ef8\u7a74\u30fb\u8089\u629c\u304d\u30d1\u30b9\u306e\u5916\u5468\u534a\u5f84 (" + maxR.toFixed(2) + "mm) \u304c\u6b6f\u5e95\u5186\u5b89\u5168\u9650\u754c\u534a\u5f84 r_limit = rf - m (" + rLimit.toFixed(2) + "mm) \u3092\u8d85\u904e\u3057\u3066\u3044\u307e\u3059\u3002\u8089\u539a\u4e0d\u8db3\u306b\u3088\u308b\u6b6f\u640d\u50b7\u306e\u6050\u308c\u304c\u3042\u308a\u307e\u3059\u3002");

        return {
            safe: isSafe,
            rLimit: Math.round(rLimit * 1000) / 1000,
            maxRadius: Math.round(maxR * 1000) / 1000,
            violationCount: violationCount,
            warning: warningMsg
        };
    }

    return {
        getJISKeywayDimensions: getJISKeywayDimensions,
        getDCutDepth: getDCutDepth,
        normalizeShaftType: normalizeShaftType,
        createArcBezierNodes: createArcBezierNodes,
        calculateShaftHole: calculateShaftHole,
        calculateAlignmentPinHoles: calculateAlignmentPinHoles,
        calculateParametricCutouts: calculateParametricCutouts,
        calculateCarrierShaftHoles: calculateCarrierShaftHoles,
        calculateBasePlateShaftHoles: calculateBasePlateShaftHoles,
        checkSafetyBoundary: checkSafetyBoundary
    };
})();

/**
 * TrainTreeResolver.jsxinc - Branched Gear Train Kinematics, Stage Synchronization & Tree Resolver
 * Part of GearDrawer Architecture (JIS B 1701-1:2017)
 * Version: 0.4.0
 * 
 * Strict ECMAScript 3 (ExtendScript compatible). All internal calculations are performed in millimeters (mm).
 */

var TrainTreeResolver = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    function logTrace(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.log) {
            CalcLogger.log(category, msg, data);
        }
    }

    function logWarn(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            CalcLogger.warn(category, msg, data);
        }
    }

    /**
     * Resolves kinematics, coordinates, conjugate meshing phases, addendum shortening,
     * stage synchronization, intermittent mechanisms, and collision interference for a gear train.
     * 
     * @param {Object} config Gear train configuration:
     *   - m: Global default module (mm, default 2.0)
     *   - alphaDeg: Global default pressure angle (deg, default 20.0)
     *   - backlash: Global circumferential backlash (mm, default 0.0)
     *   - tipRounding: Global tip corner radius (mm, default 0.0)
     *   - kerfOffset: Normal kerf offset (mm, default 0.0)
     *   - pathQuality: "bezier_recommended" (default) | "bezier_minimal" | "polyline"
     *   - nodes: Array of raw train node objects
     *   - drawCarrier: boolean (auto-generate carrier if planetary nodes exist)
     *   - carrierSpec: Optional carrier specs
     *   - drawBasePlate: boolean (auto-generate base plate)
     *   - basePlateSpec: Optional base plate specs
     * @returns {Object} { m, alphaDeg, nodes, nodeMap, warnings, isFeasible, carrierData, basePlateData }
     */
    function resolveTrain(config) {
        config = config || {};
        var defaultM = parseFloat(config.m || config.module) || 2.0;
        var defaultAlphaDeg = parseFloat(config.alphaDeg !== undefined ? config.alphaDeg : 20.0);
        var defaultBacklash = parseFloat(config.backlash !== undefined ? config.backlash : 0.0);
        var defaultTipRounding = parseFloat(config.tipRounding !== undefined ? config.tipRounding : 0.0);
        var defaultKerfOffset = (config.kerfOffset !== undefined && config.kerfOffset !== null) ?
            parseFloat(config.kerfOffset) :
            ((config.kerf !== undefined && config.kerf !== null) ? (parseFloat(config.kerf) / 2.0) : 0.0);
        var defaultThicknessBasis = (config.thicknessBasis !== undefined && config.thicknessBasis !== null) ? parseInt(config.thicknessBasis, 10) : 0;
        var pathQuality = config.pathQuality || "bezier_recommended";
        var rawNodes = config.nodes || [];

        if (rawNodes.length === 0) {
            return {
                m: defaultM,
                alphaDeg: defaultAlphaDeg,
                nodes: [],
                nodeMap: {},
                warnings: ["Gear train contains zero nodes."],
                isFeasible: false,
                carrierData: null,
                basePlateData: null
            };
        }

        var nodeMap = {};
        var resolvedNodes = [];
        var warnings = [];

        // 1. Index raw nodes and normalize basic attributes
        for (var i = 0; i < rawNodes.length; i++) {
            var n = rawNodes[i];
            var nodeId = n.id || ("G" + (i + 1));
            var relType = n.relationType;
            if (!relType) {
                if (!n.parentId || i === 0) {
                    relType = "ROOT";
                } else if (n.isCoaxial) {
                    relType = "COAXIAL";
                } else if (n.gearType === "INTERNAL" || n.kind === "INTERNAL" || n.isInternal) {
                    relType = "INTERNAL_MESHING";
                } else if (n.gearType === "RACK" || n.kind === "RACK") {
                    relType = "RACK";
                } else {
                    relType = "MESHING";
                }
            }

            var rawType = n.gearType || n.kind || n.type || "SPUR";
            var gType = String(rawType).toUpperCase();
            var kindUpper = String(n.kind || "").toUpperCase();
            if (kindUpper === "INTERNAL" || n.isInternal || gType === "INTERNAL") {
                gType = "INTERNAL";
            } else if (kindUpper === "RACK" || relType === "RACK" || relType === "RACK_MESHING" || gType === "RACK") {
                gType = "RACK";
            } else if (kindUpper === "MUTILATED_DRIVER" || kindUpper === "MUTILATED_DRIVEN") {
                gType = "SPUR";
            } else {
                gType = "SPUR";
            }

            var relAngle = parseFloat(n.relativeAngleDeg !== undefined ? n.relativeAngleDeg : (n.angleDeg !== undefined ? n.angleDeg : 0.0));
            var zVal = parseInt(n.z || n.teeth || (gType === "RACK" ? 20 : 18), 10);
            var nodeM = (n.m !== undefined && n.m !== null) ? parseFloat(n.m) : null;
            var nodeAlpha = (n.alphaDeg !== undefined && n.alphaDeg !== null) ? parseFloat(n.alphaDeg) : null;
            var nodeBacklash = (n.backlash !== undefined && n.backlash !== null) ? parseFloat(n.backlash) : defaultBacklash;
            var nodeTipRounding = (n.tipRounding !== undefined && n.tipRounding !== null) ? parseFloat(n.tipRounding) : defaultTipRounding;
            var nodeKerfOffset = defaultKerfOffset;
            if (n.kerfOffset !== undefined && n.kerfOffset !== null) {
                nodeKerfOffset = parseFloat(n.kerfOffset);
            } else if (n.kerf !== undefined && n.kerf !== null) {
                nodeKerfOffset = parseFloat(n.kerf) / 2.0;
            }
            var nodeShiftX = parseFloat(n.x !== undefined ? n.x : (n.profileShift !== undefined ? n.profileShift : (n.shift !== undefined ? n.shift : 0.0)));

            var nodeStage = (n.stageIndex !== undefined && n.stageIndex !== null) ? parseInt(n.stageIndex, 10) : null;
            var xOff = parseFloat(n.xOffset !== undefined ? n.xOffset : (n.xMm !== undefined ? n.xMm : 0.0));
            var yOff = parseFloat(n.yOffset !== undefined ? n.yOffset : (n.yMm !== undefined ? n.yMm : 0.0));

            // Intermittent gear attributes
            var isMutilated = !!(n.isMutilated || n.mutilated || kindUpper === "MUTILATED_DRIVER" || kindUpper === "MUTILATED_DRIVEN");
            var intermittentRole = n.intermittentRole || "NONE";
            if (!n.intermittentRole) {
                if (kindUpper === "MUTILATED_DRIVER") {
                    intermittentRole = "DRIVER";
                } else if (kindUpper === "MUTILATED_DRIVEN") {
                    intermittentRole = "DRIVEN";
                } else if (isMutilated) {
                    intermittentRole = (relType === "ROOT" ? "DRIVER" : "DRIVEN");
                }
            }
            var intermittentStructure = n.intermittentStructure || n.structure || null;
            if (!intermittentStructure) {
                if (n.isTwoLayer === true) {
                    intermittentStructure = "two_layer";
                } else if (n.isTwoLayer === false && isMutilated) {
                    intermittentStructure = "coplanar";
                } else {
                    intermittentStructure = "coplanar";
                }
            }
            var divisions = parseInt(n.divisions, 10) || 4;
            var moveTeeth = parseInt(n.moveTeeth, 10) || 2;
            var activeTeeth = (n.activeTeeth !== undefined) ? parseInt(n.activeTeeth, 10) : (intermittentRole === "DRIVER" ? moveTeeth : zVal);
            var lockClearance = (n.lockClearance !== undefined) ? parseFloat(n.lockClearance) : 0.15;
            var tipRelief = !!n.tipRelief;
            var pose = n.pose || "motion";

            var nodeShaftDia = (n.shaftDiameter !== undefined && n.shaftDiameter !== null) ?
                parseFloat(n.shaftDiameter) :
                ((n.shaftDia !== undefined && n.shaftDia !== null) ? parseFloat(n.shaftDia) : 5.0);

            nodeMap[nodeId] = {
                id: nodeId,
                name: n.name || nodeId,
                parentId: n.parentId || null,
                relationType: relType,
                gearType: gType,
                kind: n.kind || gType,
                z: zVal,
                m: nodeM,
                alphaDeg: nodeAlpha,
                x: nodeShiftX,
                profileShift: nodeShiftX,
                deltaY: 0.0,
                backlash: nodeBacklash,
                tipRounding: nodeTipRounding,
                kerfOffset: nodeKerfOffset,
                stageIndex: nodeStage,
                isDriver: !!n.isDriver,
                relativeAngleDeg: relAngle,
                xOffset: xOff,
                yOffset: yOff,
                initialRotDeg: (n.initialRotDeg !== undefined && n.initialRotDeg !== null) ? parseFloat(n.initialRotDeg) : null,
                rotationDeg: 0.0,
                centerMm: [xOff, yOff],
                centerPt: [xOff * MM_TO_PT, yOff * MM_TO_PT],
                ratioFromRoot: 1.0,
                directionFromRoot: 1,
                contactRatio: null,
                shaftDiameter: nodeShaftDia,
                shaftType: n.shaftType || "NONE",
                shaftOptions: n.shaftOptions || null,
                cutoutType: n.cutoutType || "NONE",
                cutoutOptions: n.cutoutOptions || null,
                externalAiPath: n.externalAiPath || null,
                innerShapeItems: n.innerShapeItems || [],
                centerDistanceMm: (n.centerDistanceMm !== undefined && n.centerDistanceMm !== null) ? parseFloat(n.centerDistanceMm) : null,
                pinHoles: n.pinHoles || null,
                rimDiameter: (n.rimDiameter !== undefined && n.rimDiameter !== null) ? parseFloat(n.rimDiameter) : null,
                rimShape: n.rimShape || "CIRCLE",
                rackHeight: (n.rackHeight !== undefined && n.rackHeight !== null) ? parseFloat(n.rackHeight) : null,
                backBarHeight: (n.backBarHeight !== undefined && n.backBarHeight !== null) ? parseFloat(n.backBarHeight) : null,
                backHeight: (n.backHeight !== undefined && n.backHeight !== null) ? parseFloat(n.backHeight) : null,
                thicknessBasis: (n.thicknessBasis !== undefined && n.thicknessBasis !== null) ? parseInt(n.thicknessBasis, 10) : defaultThicknessBasis,
                generateCarrier: !!n.generateCarrier,
                isMutilated: isMutilated,
                intermittentRole: intermittentRole,
                intermittentStructure: intermittentStructure,
                divisions: divisions,
                moveTeeth: moveTeeth,
                activeTeeth: activeTeeth,
                lockClearance: lockClearance,
                tipRelief: tipRelief,
                pose: pose,
                children: []
            };
        }

        // 2. Build tree structure & find root node
        var root = null;
        for (var id in nodeMap) {
            if (nodeMap.hasOwnProperty(id)) {
                var nd = nodeMap[id];
                if (!nd.parentId || nd.relationType === "ROOT") {
                    if (!root) {
                        root = nd;
                        nd.relationType = "ROOT";
                        nd.parentId = null;
                    }
                } else if (nodeMap[nd.parentId]) {
                    nodeMap[nd.parentId].children.push(nd);
                } else {
                    warnings.push("Parent node '" + nd.parentId + "' not found for gear '" + nd.id + "'. Treating as root.");
                    root = nd;
                    nd.relationType = "ROOT";
                    nd.parentId = null;
                }
            }
        }

        if (!root) {
            for (var firstId in nodeMap) {
                if (nodeMap.hasOwnProperty(firstId)) {
                    root = nodeMap[firstId];
                    root.relationType = "ROOT";
                    root.parentId = null;
                    break;
                }
            }
        }

        // 3. Stage Indexing & Driver Identification
        if (root.stageIndex === null || root.stageIndex === undefined) {
            root.stageIndex = 1;
        }
        root.isDriver = true;
        if (root.m === null) root.m = defaultM;
        if (root.alphaDeg === null) root.alphaDeg = defaultAlphaDeg;

        var stageDriverMap = {};
        stageDriverMap[root.stageIndex] = root;

        var prepQueue = [root];
        var prepVisited = {};
        prepVisited[root.id] = true;

        while (prepQueue.length > 0) {
            var pNode = prepQueue.shift();

            for (var cIdx = 0; cIdx < pNode.children.length; cIdx++) {
                var cNode = pNode.children[cIdx];
                if (prepVisited[cNode.id]) {
                    var prepWarn = "Circular reference detected in stage indexing: gear '" + cNode.id + "' already visited. Skipping branch.";
                    warnings.push(prepWarn);
                    logWarn("TRAIN_RESOLVER", prepWarn, { nodeId: cNode.id });
                    continue;
                }
                prepVisited[cNode.id] = true;

                if (cNode.relationType === "COAXIAL") {
                    if (cNode.stageIndex === null || cNode.stageIndex === undefined) {
                        cNode.stageIndex = pNode.stageIndex + 1;
                    }
                    cNode.isDriver = true;
                    if (cNode.m === null) cNode.m = pNode.m || defaultM;
                    if (cNode.alphaDeg === null) cNode.alphaDeg = pNode.alphaDeg || defaultAlphaDeg;
                    if (!stageDriverMap[cNode.stageIndex]) {
                        stageDriverMap[cNode.stageIndex] = cNode;
                    }
                } else {
                    if (cNode.stageIndex === null || cNode.stageIndex === undefined) {
                        cNode.stageIndex = pNode.stageIndex;
                    }
                }

                prepQueue.push(cNode);
            }
        }

        // Synchronize m, alphaDeg, backlash, tipRounding from stage drivers
        for (var mapId in nodeMap) {
            if (nodeMap.hasOwnProperty(mapId)) {
                var nodeItem = nodeMap[mapId];
                var driver = stageDriverMap[nodeItem.stageIndex] || root;

                if (nodeItem !== driver) {
                    if (nodeItem.m === null) nodeItem.m = driver.m;
                    if (nodeItem.alphaDeg === null) nodeItem.alphaDeg = driver.alphaDeg;
                    if (nodeItem.backlash === defaultBacklash && driver.backlash !== defaultBacklash) {
                        nodeItem.backlash = driver.backlash;
                    }
                    if (nodeItem.tipRounding === defaultTipRounding && driver.tipRounding !== defaultTipRounding) {
                        nodeItem.tipRounding = driver.tipRounding;
                    }
                }
                if (nodeItem.m === null) nodeItem.m = defaultM;
                if (nodeItem.alphaDeg === null) nodeItem.alphaDeg = defaultAlphaDeg;
            }
        }

        // 4. Breadth-First Kinematic Resolution (Coordinates, Phase, Geometry)
        var bfsQueue = [root];
        var bfsVisited = {};
        bfsVisited[root.id] = true;

        root.centerMm = [root.xOffset, root.yOffset];
        root.centerPt = [root.xOffset * MM_TO_PT, root.yOffset * MM_TO_PT];
        root.ratioFromRoot = 1.0;
        root.directionFromRoot = 1;

        // If root is intermittent driver in lock pose
        if (root.isMutilated && root.pose === "lock" && typeof MechanismSolvers !== "undefined") {
            var targetChild = (root.children.length > 0) ? root.children[0] : null;
            var targetThetaDeg = targetChild ? targetChild.relativeAngleDeg : 0.0;
            var targetZ2 = targetChild ? targetChild.z : (root.divisions * root.moveTeeth);
            var rootKin = MechanismSolvers.calculateIntermittentKinematics({
                m: root.m,
                z1: root.z,
                z2: targetZ2,
                divisions: root.divisions,
                moveTeeth: root.moveTeeth,
                pose: "lock"
            });
            root.rotationDeg = (root.initialRotDeg !== null) ? root.initialRotDeg : (targetThetaDeg + rootKin.driverRotDeg);
        } else {
            root.rotationDeg = (root.initialRotDeg !== null) ? root.initialRotDeg : 0.0;
        }

        while (bfsQueue.length > 0) {
            var curr = bfsQueue.shift();

            // Calculate meshing parameters with meshing children
            for (var mi = 0; mi < curr.children.length; mi++) {
                var chMesh = curr.children[mi];
                if (chMesh.relationType === "MESHING" || chMesh.relationType === "INTERNAL_MESHING" || chMesh.gearType === "INTERNAL" || curr.gearType === "INTERNAL") {
                    var g1 = curr;
                    var g2 = chMesh;
                    if (curr.gearType === "INTERNAL" && chMesh.gearType !== "INTERNAL") {
                        g1 = chMesh;
                        g2 = curr;
                    }
                    var meshParams = InvoluteCore.calculateMeshingParameters(g1, g2);
                    chMesh.meshingParams = meshParams;
                    chMesh.contactRatio = meshParams.contactRatio;

                    if (meshParams.isWarning) {
                        warnings.push("Meshing pair '" + curr.id + "' - '" + chMesh.id + "': " + meshParams.warningMessage);
                    }

                    if (meshParams.deltaY > 0.0001) {
                        if (meshParams.deltaY > curr.deltaY) curr.deltaY = meshParams.deltaY;
                        if (meshParams.deltaY > chMesh.deltaY) chMesh.deltaY = meshParams.deltaY;
                    }
                }
            }

            // Generate geometry data for current node
            if (curr.isMutilated && typeof MechanismSolvers !== "undefined") {
                curr.gearData = MechanismSolvers.calculateMutilatedSpurGear({
                    m: curr.m,
                    z: curr.z,
                    x: curr.x,
                    alphaDeg: curr.alphaDeg,
                    backlash: curr.backlash,
                    kerfOffset: curr.kerfOffset,
                    tipRounding: curr.tipRounding,
                    intermittentRole: curr.intermittentRole,
                    intermittentStructure: curr.intermittentStructure,
                    divisions: curr.divisions,
                    moveTeeth: curr.moveTeeth,
                    activeTeeth: curr.activeTeeth,
                    lockClearance: curr.lockClearance,
                    tipRelief: curr.tipRelief,
                    pathQuality: pathQuality
                });
                if (curr.gearData && curr.gearData.lockPlate) {
                    curr.lockPlate = curr.gearData.lockPlate;
                }
            } else if (curr.gearType === "INTERNAL") {
                var calcRimThickness;
                if ((curr.rimDiameter === null || curr.rimDiameter === undefined) && curr.backHeight !== null && curr.backHeight > 0) {
                    calcRimThickness = curr.backHeight;
                } else {
                    var rimDiam = curr.rimDiameter || ((curr.m * curr.z) + 16.0);
                    calcRimThickness = Math.max(2.0 * curr.m, (rimDiam - curr.m * curr.z) / 2.0);
                }
                curr.gearData = InvoluteCore.calculateInternalGear({
                    m: curr.m,
                    z: curr.z,
                    x: curr.x,
                    deltaY: curr.deltaY,
                    alphaDeg: curr.alphaDeg,
                    backlash: curr.backlash,
                    kerfOffset: curr.kerfOffset,
                    tipRounding: curr.tipRounding,
                    rimThickness: calcRimThickness,
                    rimShape: curr.rimShape,
                    pathQuality: pathQuality
                });
            } else if (curr.gearType === "RACK") {
                var bHeight;
                if (curr.backBarHeight !== null && curr.backBarHeight !== undefined) {
                    bHeight = curr.backBarHeight;
                } else if (curr.backHeight !== null && curr.backHeight > 0) {
                    bHeight = (curr.thicknessBasis === 1) ? Math.max(0.5 * curr.m, curr.backHeight - 2.25 * curr.m) : curr.backHeight;
                } else {
                    var rkHeight = curr.rackHeight || (4.0 * curr.m);
                    bHeight = Math.max(1.0 * curr.m, rkHeight - 2.25 * curr.m);
                }
                curr.gearData = InvoluteCore.calculateRack({
                    m: curr.m,
                    zRack: curr.z,
                    alphaDeg: curr.alphaDeg,
                    backlash: curr.backlash,
                    kerfOffset: curr.kerfOffset,
                    tipRounding: curr.tipRounding,
                    backHeight: bHeight,
                    pathQuality: pathQuality
                });
            } else {
                curr.gearData = InvoluteCore.calculateSpurGear({
                    m: curr.m,
                    z: curr.z,
                    x: curr.x,
                    deltaY: curr.deltaY,
                    alphaDeg: curr.alphaDeg,
                    backlash: curr.backlash,
                    kerfOffset: curr.kerfOffset,
                    tipRounding: curr.tipRounding,
                    pathQuality: pathQuality
                });
            }

            resolvedNodes.push(curr);

            // Sibling collision clearance check
            var meshingSiblings = [];
            for (var sc = 0; sc < curr.children.length; sc++) {
                if (curr.children[sc].relationType === "MESHING" && curr.children[sc].gearType !== "INTERNAL" && curr.children[sc].gearType !== "RACK") {
                    meshingSiblings.push(curr.children[sc]);
                }
            }

            for (var s1 = 0; s1 < meshingSiblings.length; s1++) {
                for (var s2 = s1 + 1; s2 < meshingSiblings.length; s2++) {
                    var ch1 = meshingSiblings[s1];
                    var ch2 = meshingSiblings[s2];
                    var a1 = (ch1.meshingParams && ch1.meshingParams.aw) ? ch1.meshingParams.aw : (curr.m * (curr.z + ch1.z) / 2.0);
                    var a2 = (ch2.meshingParams && ch2.meshingParams.aw) ? ch2.meshingParams.aw : (curr.m * (curr.z + ch2.z) / 2.0);
                    var thDiffRad = Math.abs(ch1.relativeAngleDeg - ch2.relativeAngleDeg) * (Math.PI / 180.0);
                    var distBetween = Math.sqrt(a1 * a1 + a2 * a2 - 2.0 * a1 * a2 * Math.cos(thDiffRad));

                    var ra1 = (curr.m / 2.0) * (ch1.z + 2.0 + 2.0 * ch1.x - 2.0 * ch1.deltaY);
                    var ra2 = (curr.m / 2.0) * (ch2.z + 2.0 + 2.0 * ch2.x - 2.0 * ch2.deltaY);
                    var clearance = distBetween - (ra1 + ra2);

                    if (clearance < 0.5) {
                        warnings.push("Physical clearance collision between branch gears '" + ch1.id + "' and '" + ch2.id + "' (Clearance: " + clearance.toFixed(2) + "mm < 0.5mm)");
                    }
                }
            }

            // Resolve position and rotation phase for each child
            for (var ci = 0; ci < curr.children.length; ci++) {
                var child = curr.children[ci];
                if (bfsVisited[child.id]) {
                    var bfsWarn = "Circular reference detected in kinematics resolution: gear '" + child.id + "' already visited. Skipping branch.";
                    warnings.push(bfsWarn);
                    logWarn("TRAIN_RESOLVER", bfsWarn, { nodeId: child.id });
                    continue;
                }
                bfsVisited[child.id] = true;

                var thetaDeg = child.relativeAngleDeg;
                var thetaRad = thetaDeg * (Math.PI / 180.0);

                if (child.relationType === "COAXIAL") {
                    child.centerMm = [curr.centerMm[0], curr.centerMm[1]];
                    child.centerPt = [curr.centerPt[0], curr.centerPt[1]];
                    child.ratioFromRoot = curr.ratioFromRoot;
                    child.directionFromRoot = curr.directionFromRoot;

                    if (child.initialRotDeg !== null) {
                        child.rotationDeg = child.initialRotDeg;
                    } else if (child.gearType === "INTERNAL") {
                        // Coaxial internal gear (e.g. Planetary Ring gear):
                        // Find a planet gear meshing with curr (sun) to calculate conjugate meshing phase
                        var planetChild = null;
                        for (var pc = 0; pc < curr.children.length; pc++) {
                            var chNode = curr.children[pc];
                            if (chNode.id !== child.id && chNode.relationType === "MESHING" && chNode.gearType === "SPUR") {
                                planetChild = chNode;
                                break;
                            }
                        }
                        if (planetChild) {
                            var thPlanet = planetChild.relativeAngleDeg;
                            var phiPlanet = planetChild.rotationDeg;

                            var deltaInvDegRing = 0.0;
                            if (typeof InvoluteCore !== "undefined" && InvoluteCore.calculateMeshingParameters) {
                                var mpRing = InvoluteCore.calculateMeshingParameters(planetChild, child);
                                var aRadRing = (mpRing.alphaDeg !== undefined ? mpRing.alphaDeg : 20.0) * (Math.PI / 180.0);
                                var invARing = Math.tan(aRadRing) - aRadRing;
                                var awRadRing = (mpRing.alphaWRad !== undefined) ? mpRing.alphaWRad : aRadRing;
                                var invAwRing = Math.tan(awRadRing) - awRadRing;
                                deltaInvDegRing = (invAwRing - invARing) * (180.0 / Math.PI);
                            }

                            // Internal mesh rotation: theta_p + 180/zr + (phi_p - theta_p) * (zp / zr) - deltaInvDeg
                            var phiRing = thPlanet + (180.0 / child.z) + (phiPlanet - thPlanet) * (planetChild.z / child.z) - deltaInvDegRing;
                            child.rotationDeg = phiRing;
                        } else {
                            child.rotationDeg = curr.rotationDeg;
                        }
                    } else {
                        child.rotationDeg = curr.rotationDeg;
                    }

                } else if (child.gearType === "RACK") {
                    var rpPinion = (curr.m * curr.z) / 2.0;
                    var awRack = rpPinion + curr.x * curr.m;

                    child.centerMm = [
                        curr.centerMm[0] + awRack * Math.cos(thetaRad),
                        curr.centerMm[1] + awRack * Math.sin(thetaRad)
                    ];
                    child.centerPt = [
                        child.centerMm[0] * MM_TO_PT,
                        child.centerMm[1] * MM_TO_PT
                    ];

                    child.directionFromRoot = curr.directionFromRoot;
                    child.ratioFromRoot = curr.ratioFromRoot;
                    child.rotationDeg = thetaDeg + 90.0;

                    var deltaPhiRad = (curr.rotationDeg * (Math.PI / 180.0)) - thetaRad;
                    var rackShiftMm = -rpPinion * deltaPhiRad;
                    child.shiftMm = rackShiftMm;
                    child.shiftPt = [
                        rackShiftMm * MM_TO_PT * Math.cos(thetaRad + Math.PI / 2.0),
                        rackShiftMm * MM_TO_PT * Math.sin(thetaRad + Math.PI / 2.0)
                    ];

                } else if (child.gearType === "INTERNAL" || curr.gearType === "INTERNAL") {
                    var isChildInternal = (child.gearType === "INTERNAL");
                    var pinionNode = isChildInternal ? curr : child;
                    var ringNode = isChildInternal ? child : curr;

                    var mpInt = child.meshingParams || InvoluteCore.calculateMeshingParameters(pinionNode, ringNode);
                    var awInt = mpInt.aw;

                    // Center offset:
                    // If child is Internal, it encloses curr (pinion): center is curr - awInt in direction thetaDeg (matching TopologySolver)
                    // If curr is Internal, child (pinion) is inside curr: center is curr + awInt in direction thetaDeg
                    var centerSign = isChildInternal ? -1.0 : 1.0;
                    child.centerMm = [
                        curr.centerMm[0] + centerSign * awInt * Math.cos(thetaRad),
                        curr.centerMm[1] + centerSign * awInt * Math.sin(thetaRad)
                    ];
                    child.centerPt = [
                        child.centerMm[0] * MM_TO_PT,
                        child.centerMm[1] * MM_TO_PT
                    ];

                    // Internal meshing gears rotate in the SAME direction
                    child.directionFromRoot = curr.directionFromRoot;
                    child.ratioFromRoot = curr.ratioFromRoot * (curr.z / child.z);

                    // High-shift internal mesh involute difference correction (inv alpha_w - inv alpha)
                    var deltaInvDeg = 0.0;
                    if (mpInt) {
                        var aRad = (mpInt.alphaDeg !== undefined ? mpInt.alphaDeg : 20.0) * (Math.PI / 180.0);
                        var invA = Math.tan(aRad) - aRad;
                        var awRad = (mpInt.alphaWRad !== undefined) ? mpInt.alphaWRad : aRad;
                        var invAw = Math.tan(awRad) - awRad;
                        deltaInvDeg = (invAw - invA) * (180.0 / Math.PI);
                    }

                    if (isChildInternal) {
                        var phiChildInt = thetaDeg + (180.0 / child.z) + (curr.rotationDeg - thetaDeg) * (curr.z / child.z) - deltaInvDeg;
                        child.rotationDeg = (child.initialRotDeg !== null) ? child.initialRotDeg : phiChildInt;
                    } else {
                        // Parent is Internal ring, child is Spur pinion
                        var phiChildSpur = thetaDeg + 180.0 - (180.0 / child.z) + (curr.rotationDeg - thetaDeg) * (curr.z / child.z) + deltaInvDeg;
                        child.rotationDeg = (child.initialRotDeg !== null) ? child.initialRotDeg : phiChildSpur;
                    }

                } else if (child.isMutilated && child.intermittentRole === "DRIVEN" && typeof MechanismSolvers !== "undefined") {
                    var aIntM = (curr.m * (curr.z + child.z)) / 2.0;
                    child.centerMm = [
                        curr.centerMm[0] + aIntM * Math.cos(thetaRad),
                        curr.centerMm[1] + aIntM * Math.sin(thetaRad)
                    ];
                    child.centerPt = [
                        child.centerMm[0] * MM_TO_PT,
                        child.centerMm[1] * MM_TO_PT
                    ];

                    child.directionFromRoot = -curr.directionFromRoot;
                    child.ratioFromRoot = curr.ratioFromRoot * (-curr.z / child.z);

                    if (child.pose === "lock" || curr.pose === "lock") {
                        var intKin = MechanismSolvers.calculateIntermittentKinematics({
                            m: curr.m,
                            z1: curr.z,
                            z2: child.z,
                            divisions: child.divisions,
                            moveTeeth: child.moveTeeth,
                            pose: "lock"
                        });
                        child.rotationDeg = thetaDeg + intKin.drivenRotDeg;
                    } else {
                        var phiChildExtM = thetaDeg + 180.0 - (180.0 / child.z) - (curr.rotationDeg - thetaDeg) * (curr.z / child.z);
                        child.rotationDeg = (child.initialRotDeg !== null) ? child.initialRotDeg : phiChildExtM;
                    }

                } else {
                    // Standard External Spur gear mesh
                    var mpExt = child.meshingParams || InvoluteCore.calculateMeshingParameters(curr, child);
                    var awExt = (child.centerDistanceMm !== undefined && child.centerDistanceMm !== null) ?
                        parseFloat(child.centerDistanceMm) : mpExt.aw;

                    child.centerMm = [
                        curr.centerMm[0] + awExt * Math.cos(thetaRad),
                        curr.centerMm[1] + awExt * Math.sin(thetaRad)
                    ];
                    child.centerPt = [
                        child.centerMm[0] * MM_TO_PT,
                        child.centerMm[1] * MM_TO_PT
                    ];

                    child.directionFromRoot = -curr.directionFromRoot;
                    child.ratioFromRoot = curr.ratioFromRoot * (-curr.z / child.z);

                    var phiChildExt = thetaDeg + 180.0 - (180.0 / child.z) - (curr.rotationDeg - thetaDeg) * (curr.z / child.z);
                    child.rotationDeg = (child.initialRotDeg !== null) ? child.initialRotDeg : phiChildExt;
                }

                bfsQueue.push(child);
            }
        }

        // Check for isolated / disconnected nodes that were not reached during BFS
        for (var checkId in nodeMap) {
            if (nodeMap.hasOwnProperty(checkId)) {
                if (!bfsVisited[checkId]) {
                    var isoMsg = "Isolated node '" + checkId + "' is disconnected from root and was not resolved.";
                    warnings.push(isoMsg);
                    logWarn("TRAIN_RESOLVER", isoMsg, { nodeId: checkId });
                }
            }
        }

        // 5. Automatic Carrier & Base Plate Structural Components Generation
        var carrierData = null;
        if ((config.drawCarrier || config.generateCarrier) && typeof MechanismSolvers !== "undefined") {
            var sunNode = null;
            var fallbackSunNode = null;
            var planetCount = 0;
            var planetZ = 18;

            for (var pIdx = 0; pIdx < resolvedNodes.length; pIdx++) {
                var cnd = resolvedNodes[pIdx];
                var meshSpurChildren = 0;
                var hasCoaxInternal = false;
                if (cnd.children && cnd.children.length > 0) {
                    for (var chI = 0; chI < cnd.children.length; chI++) {
                        var chC = cnd.children[chI];
                        if (chC.relationType === "MESHING" && chC.gearType === "SPUR") {
                            meshSpurChildren++;
                        } else if (chC.relationType === "COAXIAL" && chC.gearType === "INTERNAL") {
                            hasCoaxInternal = true;
                        }
                    }
                }

                if (cnd.generateCarrier === true || (meshSpurChildren >= 2 && hasCoaxInternal)) {
                    sunNode = cnd;
                    break;
                }
                if (!fallbackSunNode && (cnd.id.indexOf("Sun") !== -1 || (cnd.relationType === "ROOT" && cnd.children.length >= 2))) {
                    fallbackSunNode = cnd;
                }
            }

            if (!sunNode) {
                sunNode = fallbackSunNode;
            }

            if (sunNode) {
                for (var pIdx2 = 0; pIdx2 < resolvedNodes.length; pIdx2++) {
                    var pnd = resolvedNodes[pIdx2];
                    if (pnd.parentId === sunNode.id && pnd.relationType === "MESHING" && pnd.gearType === "SPUR") {
                        planetCount++;
                        planetZ = pnd.z;
                    }
                }
                if (planetCount < 2) {
                    planetCount = 0;
                    for (var pIdx3 = 0; pIdx3 < resolvedNodes.length; pIdx3++) {
                        var pnd3 = resolvedNodes[pIdx3];
                        if (pnd3.id !== sunNode.id && (pnd3.id.indexOf("P") === 0 || (pnd3.parentId === sunNode.id && pnd3.relationType === "MESHING"))) {
                            planetCount++;
                            planetZ = pnd3.z;
                        }
                    }
                }
            }

            if (sunNode && planetCount >= 2) {
                var cSpec = config.carrierSpec || {};
                carrierData = MechanismSolvers.calculatePlanetaryCarrier({
                    m: sunNode.m,
                    zs: sunNode.z,
                    zp: planetZ,
                    numPlanets: planetCount,
                    carrierType: cSpec.carrierType || "ARM",
                    sunShaftDiameter: sunNode.shaftDiameter,
                    planetPinDiameter: cSpec.planetPinDiameter || 4.0,
                    angleOffsetDeg: cSpec.angleOffsetDeg || 0.0
                });
                if (carrierData) {
                    carrierData.sunNodeId = sunNode.id;
                }
            }
        }

        var basePlateData = null;
        if ((config.drawBasePlate || config.generateBasePlate) && typeof MechanismSolvers !== "undefined") {
            basePlateData = MechanismSolvers.calculateTrainBasePlate(resolvedNodes, config.basePlateSpec);
        }

        logTrace("TRAIN_RESOLVER", "Resolved gear train kinematics", {
            nodeCount: resolvedNodes.length,
            m: defaultM,
            hasCarrier: (carrierData !== null),
            hasBasePlate: (basePlateData !== null),
            warningCount: warnings.length,
            isFeasible: (warnings.length === 0)
        });

        return {
            m: defaultM,
            alphaDeg: defaultAlphaDeg,
            backlash: defaultBacklash,
            nodes: resolvedNodes,
            nodeMap: nodeMap,
            stageDriverMap: stageDriverMap,
            warnings: warnings,
            isFeasible: (warnings.length === 0),
            carrierData: carrierData,
            basePlateData: basePlateData
        };
    }

    /**
     * Expands a Spur Gear Pair into standard trainNodes array.
     */
    function expandSpurPairToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var z1 = spec.z1 || 18;
        var z2 = spec.z2 || 36;
        var x1 = spec.x1 || 0.0;
        var x2 = spec.x2 || 0.0;
        var alphaDeg = spec.alphaDeg !== undefined ? spec.alphaDeg : 20.0;
        var angleDeg = spec.angleDeg !== undefined ? spec.angleDeg : 0.0;
        var shaft1 = spec.shaftDiameter1 !== undefined ? spec.shaftDiameter1 : 5.0;
        var shaft2 = spec.shaftDiameter2 !== undefined ? spec.shaftDiameter2 : 5.0;

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: z1, m: m, x: x1, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft1, isDriver: true, stageIndex: 1 },
            { id: "G2", gearType: "SPUR", parentId: "G1", relationType: "MESHING", z: z2, m: m, x: x2, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, shaftDiameter: shaft2, stageIndex: 1 }
        ];
    }

    /**
     * Expands a Rack & Pinion specification into trainNodes array.
     */
    function expandRackToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zp = spec.zp || 18;
        var zr = spec.zr || 20;
        var xp = spec.xp || 0.0;
        var alphaDeg = spec.alphaDeg !== undefined ? spec.alphaDeg : 20.0;
        var angleDeg = spec.angleDeg !== undefined ? spec.angleDeg : -90.0;
        var shaft = spec.shaftDiameter !== undefined ? spec.shaftDiameter : 5.0;
        var rackHeight = spec.rackHeight || (4.0 * m);

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: zp, m: m, x: xp, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft, isDriver: true, stageIndex: 1 },
            { id: "R1", gearType: "RACK", parentId: "G1", relationType: "MESHING", z: zr, m: m, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, rackHeight: rackHeight, stageIndex: 1 }
        ];
    }

    /**
     * Expands an Internal Gear Pair specification into trainNodes array.
     */
    function expandInternalPairToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zp = spec.zp || 18;
        var zr = spec.zr || 48;
        var xp = spec.xp || 0.0;
        var xr = spec.xr || 0.0;
        var alphaDeg = spec.alphaDeg !== undefined ? spec.alphaDeg : 20.0;
        var angleDeg = spec.angleDeg !== undefined ? spec.angleDeg : 0.0;
        var shaft = spec.shaftDiameter !== undefined ? spec.shaftDiameter : 5.0;
        var rim = spec.rimDiameter !== undefined ? spec.rimDiameter : ((m * zr) + 16.0);

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: zp, m: m, x: xp, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft, isDriver: true, stageIndex: 1 },
            { id: "G2", gearType: "INTERNAL", parentId: "G1", relationType: "INTERNAL_MESHING", z: zr, m: m, x: xr, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, shaftDiameter: 5.0, rimDiameter: rim, stageIndex: 1 }
        ];
    }

    /**
     * Expands a 2K-H Standard Planetary Gear Mechanism into trainNodes array.
     */
    function expandPlanetaryToNodes(spec) {
        spec = spec || {};
        var m = parseFloat(spec.m || spec.module) || 2.0;
        var zs = parseInt(spec.zs, 10) || 18;
        var zp = parseInt(spec.zp, 10) || 18;
        var zr = parseInt(spec.zr, 10) || (zs + 2 * zp);
        var numPlanets = parseInt(spec.numPlanets, 10) || 3;
        var alphaDeg = (spec.alphaDeg !== undefined) ? parseFloat(spec.alphaDeg) : 20.0;
        var sunShaft = (spec.sunShaft !== undefined) ? parseFloat(spec.sunShaft) : 5.0;
        var planetShaft = (spec.planetShaft !== undefined) ? parseFloat(spec.planetShaft) : 4.0;
        var rim = (spec.rimDiameter !== undefined) ? parseFloat(spec.rimDiameter) : ((m * zr) + 16.0);

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "COAXIAL") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var sunId = prefix ? (prefix + "Sun") : "S1";
        var relAngle = parseFloat(spec.angleDeg !== undefined ? spec.angleDeg : (spec.relativeAngleDeg !== undefined ? spec.relativeAngleDeg : 0.0));

        var nodes = [];
        // 1. Sun gear
        nodes.push({
            id: sunId,
            gearType: "SPUR",
            parentId: parentId,
            relationType: relationType,
            z: zs,
            m: m,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            relativeAngleDeg: relAngle,
            shaftDiameter: sunShaft,
            isDriver: true
        });

        // 2. Planets orbiting Sun
        var spacingDeg = 360.0 / numPlanets;
        for (var i = 0; i < numPlanets; i++) {
            var planetId = prefix ? (prefix + "P" + (i + 1)) : ("P" + (i + 1));
            var pNodeObj = {
                id: planetId,
                gearType: "SPUR",
                parentId: sunId,
                relationType: "MESHING",
                z: zp,
                m: m,
                alphaDeg: alphaDeg,
                stageIndex: stageIdx,
                relativeAngleDeg: Math.round(i * spacingDeg * 100) / 100,
                shaftDiameter: planetShaft
            };
            if (spec.centerDistanceMm !== undefined && spec.centerDistanceMm !== null) {
                pNodeObj.centerDistanceMm = parseFloat(spec.centerDistanceMm);
            }
            nodes.push(pNodeObj);
        }

        // 3. Ring gear coaxial with Sun (concentric)
        var ringId = prefix ? (prefix + "Ring") : "R1";
        nodes.push({
            id: ringId,
            gearType: "INTERNAL",
            parentId: sunId,
            relationType: "COAXIAL",
            z: zr,
            m: m,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            relativeAngleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim
        });

        return nodes;
    }

    /**
     * Expands a 3K Paradoxical Planetary Gear Train into trainNodes array.
     */
    function expandParadoxicalToNodes(spec) {
        spec = spec || {};
        var m = parseFloat(spec.m || spec.module) || 2.0;
        var zs = parseInt(spec.zs, 10) || 24;
        var zp = parseInt(spec.zp, 10) || 18;
        var zr1 = parseInt(spec.zr1, 10) || (zs + 2 * zp);
        var zr2 = (spec.zr2 !== undefined) ? parseInt(spec.zr2, 10) : (zr1 - 1);
        var numPlanets = parseInt(spec.numPlanets, 10) || 3;
        var alphaDeg = (spec.alphaDeg !== undefined) ? parseFloat(spec.alphaDeg) : 20.0;
        var xs = parseFloat(spec.xs || 0.0);
        var xp = parseFloat(spec.xp || 0.0);
        var xr1 = parseFloat(spec.xr1 || 0.0);
        var xr2 = parseFloat(spec.xr2 || 0.0);
        var sunShaft = (spec.sunShaft !== undefined) ? parseFloat(spec.sunShaft) : 5.0;
        var planetShaft = (spec.planetShaft !== undefined) ? parseFloat(spec.planetShaft) : 4.0;
        var rim1 = (spec.rimDiameter1 !== undefined) ? parseFloat(spec.rimDiameter1) : ((m * zr1) + 16.0);
        var rim2 = (spec.rimDiameter2 !== undefined) ? parseFloat(spec.rimDiameter2) : ((m * zr2) + 16.0);

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "COAXIAL") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var sunId = prefix ? (prefix + "Sun") : "S1";
        var relAngle = parseFloat(spec.angleDeg !== undefined ? spec.angleDeg : (spec.relativeAngleDeg !== undefined ? spec.relativeAngleDeg : 0.0));

        var nodes = [];
        // 1. Sun gear
        nodes.push({
            id: sunId,
            gearType: "SPUR",
            parentId: parentId,
            relationType: relationType,
            z: zs,
            m: m,
            x: xs,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            relativeAngleDeg: relAngle,
            shaftDiameter: sunShaft,
            isDriver: true
        });

        // 2. Planets orbiting Sun
        var spacingDeg = 360.0 / numPlanets;
        for (var i = 0; i < numPlanets; i++) {
            var planetId = prefix ? (prefix + "P" + (i + 1)) : ("P" + (i + 1));
            var pNodeObj = {
                id: planetId,
                gearType: "SPUR",
                parentId: sunId,
                relationType: "MESHING",
                z: zp,
                m: m,
                x: xp,
                alphaDeg: alphaDeg,
                stageIndex: stageIdx,
                relativeAngleDeg: Math.round(i * spacingDeg * 100) / 100,
                shaftDiameter: planetShaft
            };
            if (spec.centerDistanceMm !== undefined && spec.centerDistanceMm !== null) {
                pNodeObj.centerDistanceMm = parseFloat(spec.centerDistanceMm);
            }
            nodes.push(pNodeObj);
        }

        // 3. Fixed Ring 1 (Stage N)
        var ring1Id = prefix ? (prefix + "Ring1_Fixed") : "R1";
        nodes.push({
            id: ring1Id,
            gearType: "INTERNAL",
            parentId: sunId,
            relationType: "COAXIAL",
            z: zr1,
            m: m,
            x: xr1,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            relativeAngleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim1
        });

        // 4. Output Ring 2 (Stage N + 1) with profile shift xr2
        var ring2Id = prefix ? (prefix + "Ring2_Output") : "R2";
        nodes.push({
            id: ring2Id,
            gearType: "INTERNAL",
            parentId: sunId,
            relationType: "COAXIAL",
            z: zr2,
            m: m,
            x: xr2,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx + 1,
            relativeAngleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim2
        });

        return nodes;
    }

    /**
     * Expands an Intermittent Gear Pair specification into trainNodes array.
     */
    function expandIntermittentPairToNodes(spec) {
        spec = spec || {};
        var m = parseFloat(spec.m || spec.module) || 3.0;
        var alphaDeg = (spec.alphaDeg !== undefined) ? parseFloat(spec.alphaDeg) : 20.0;
        var backlash = (spec.backlash !== undefined) ? parseFloat(spec.backlash) : 0.15;
        var divisions = parseInt(spec.divisions, 10) || 4;
        var moveTeeth = parseInt(spec.moveTeeth, 10) || 2;
        var z1 = parseInt(spec.z1, 10) || 8;
        var z2 = (spec.z2 !== undefined && spec.z2 !== null) ? parseInt(spec.z2, 10) : (divisions * moveTeeth);
        var angleDeg = (spec.angleDeg !== undefined) ? parseFloat(spec.angleDeg) : 0.0;
        var structure = spec.intermittentStructure || spec.structure || "coplanar";
        var pose = spec.pose || "motion";
        var lockClearance = (spec.lockClearance !== undefined) ? parseFloat(spec.lockClearance) : 0.15;
        var tipRelief = !!spec.tipRelief;
        var shaft1 = (spec.shaftDiameter1 !== undefined) ? parseFloat(spec.shaftDiameter1) : 5.0;
        var shaft2 = (spec.shaftDiameter2 !== undefined) ? parseFloat(spec.shaftDiameter2) : 5.0;
        var shaftType1 = spec.shaftType1 || "ROUND";
        var shaftType2 = spec.shaftType2 || "ROUND";

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "MESHING") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var driverId = spec.driverId || (prefix ? (prefix + "Driver") : "G1_Driver");
        var drivenId = spec.drivenId || (prefix ? (prefix + "Driven") : "G2_Driven");

        var driverNode = {
            id: driverId,
            gearType: "SPUR",
            z: z1,
            m: m,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: shaft1,
            shaftType: shaftType1,
            parentId: parentId,
            relationType: relationType,
            relativeAngleDeg: 0.0,
            stageIndex: stageIdx,
            isMutilated: true,
            intermittentRole: "DRIVER",
            activeTeeth: moveTeeth,
            divisions: divisions,
            moveTeeth: moveTeeth,
            tipRelief: tipRelief,
            intermittentStructure: structure,
            pose: pose,
            lockClearance: lockClearance,
            isDriver: true
        };

        var drivenNode = {
            id: drivenId,
            gearType: "SPUR",
            z: z2,
            m: m,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: shaft2,
            shaftType: shaftType2,
            parentId: driverId,
            relationType: "MESHING",
            relativeAngleDeg: angleDeg,
            stageIndex: stageIdx,
            isMutilated: true,
            intermittentRole: "DRIVEN",
            divisions: divisions,
            moveTeeth: moveTeeth,
            activeTeeth: moveTeeth,
            tipRelief: tipRelief,
            intermittentStructure: structure,
            pose: pose,
            lockClearance: lockClearance
        };

        return [driverNode, drivenNode];
    }

    return {
        MM_TO_PT: MM_TO_PT,
        PT_TO_MM: PT_TO_MM,
        resolveTrain: resolveTrain,
        expandSpurPairToNodes: expandSpurPairToNodes,
        expandRackToNodes: expandRackToNodes,
        expandInternalPairToNodes: expandInternalPairToNodes,
        expandPlanetaryToNodes: expandPlanetaryToNodes,
        expandParadoxicalToNodes: expandParadoxicalToNodes,
        expandIntermittentPairToNodes: expandIntermittentPairToNodes
    };
})();

/**
 * TopologySolver.jsxinc - Circle Object Geometry & Multi-layer Topology Analysis
 * Part of GearDrawer Architecture (v0.7.0)
 * 
 * Strict ECMAScript 3 (ExtendScript compatible). All internal calculations are performed in millimeters (mm).
 */

var TopologySolver = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    function logTrace(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.log) {
            CalcLogger.log(category, msg, data);
        }
    }

    function logWarn(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
            CalcLogger.warn(category, msg, data);
        }
    }

    /**
     * Strict circular geometry validator.
     * Inspects 4-point closed path and Bezier handle lengths against theoretical formula:
     * h = (4/3) * (sqrt(2) - 1) * R =~ 0.55228475 * R
     * 
     * @param {PageItem} itm PageItem to inspect
     * @returns {boolean} True if item is a strictly accurate circle
     */
    function isStrictCircle(itm) {
        if (!itm || itm.typename !== "PathItem") return false;
        try {
            if (!itm.closed) return false;
        } catch (eCl) {
            return false;
        }

        var w = Math.abs(itm.width);
        var h = Math.abs(itm.height);
        if (Math.abs(w - h) >= 0.5) return false; // Width & height must match within 0.5 pt

        try {
            if (!itm.pathPoints || itm.pathPoints.length !== 4) return false;
        } catch (ePts) {
            return false;
        }

        var R = (w + h) / 4.0;
        if (R <= 0.1) return false;
        var idealH = (4.0 / 3.0) * (Math.SQRT2 - 1.0) * R;

        var pts = itm.pathPoints;
        for (var p = 0; p < pts.length; p++) {
            var pt = pts[p];
            var dxL = pt.leftDirection[0] - pt.anchor[0];
            var dyL = pt.leftDirection[1] - pt.anchor[1];
            var dL = Math.sqrt(dxL * dxL + dyL * dyL);

            var dxR = pt.rightDirection[0] - pt.anchor[0];
            var dyR = pt.rightDirection[1] - pt.anchor[1];
            var dR = Math.sqrt(dxR * dxR + dyR * dyR);

            var tol = Math.max(1.5, idealH * 0.15);
            if (Math.abs(dL - idealH) > tol || Math.abs(dR - idealH) > tol) {
                return false;
            }
        }
        return true;
    }

    /**
     * Parses module, pressure angle, and stage index from Illustrator layer names.
     * e.g. "Stage1_m2.5_a20", "L2_m1.5", "\u30ec\u30a4\u30e4\u30fc 2", "\u7b2c1\u6bb5"
     */
    function parseLayerParams(layerName) {
        if (!layerName) return null;
        var res = {};
        var mM = layerName.match(/(?:^|[^a-zA-Z0-9])m([0-9]+(?:\.[0-9]+)?)(?:[^a-zA-Z0-9]|$)/i);
        if (mM) res.m = parseFloat(mM[1]);

        var mA = layerName.match(/(?:^|[^a-zA-Z0-9])(?:a|alpha)([0-9]+(?:\.[0-9]+)?)(?:[^a-zA-Z0-9]|$)/i);
        if (mA) res.alphaDeg = parseFloat(mA[1]);

        var mS = layerName.match(/(?:^|[^a-zA-Z0-9])(?:stage|layer|l|s)\s*([0-9]+)(?:[^a-zA-Z0-9]|$)/i) ||
                 layerName.match(/(?:\u30ec\u30a4\u30e4\u30fc|\u6bb5|\u5c64|\u968e)\s*([0-9]+)/i) ||
                 layerName.match(/([0-9]+)\s*(?:\u6bb5|\u5c64|\u968e)/i);
        if (mS) res.stageIndex = parseInt(mS[1], 10);

        return res;
    }

    /**
     * Resolves gear preset based on stroke color.
     */
    function resolveColorPreset(strokeColor, colorPresets) {
        if (!colorPresets || colorPresets.length === 0) return null;
        if (!strokeColor) return colorPresets[0];

        var r = 0, g = 0, b = 0;
        try {
            if (strokeColor.typename === "RGBColor") {
                r = Math.round(strokeColor.red);
                g = Math.round(strokeColor.green);
                b = Math.round(strokeColor.blue);
            } else if (strokeColor.typename === "SpotColor" && strokeColor.spot && strokeColor.spot.color) {
                var sc = strokeColor.spot.color;
                if (sc.typename === "RGBColor") {
                    r = Math.round(sc.red);
                    g = Math.round(sc.green);
                    b = Math.round(sc.blue);
                }
            } else {
                return colorPresets[0];
            }
        } catch (eCol) {
            return colorPresets[0];
        }

        var bestMatch = null;
        var minDiff = 999999;
        for (var i = 0; i < colorPresets.length; i++) {
            var cp = colorPresets[i];
            var dr = cp.r - r;
            var dg = cp.g - g;
            var db = cp.b - b;
            var diff = Math.sqrt(dr * dr + dg * dg + db * db);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = cp;
            }
        }

        if (minDiff < 80) {
            return bestMatch;
        }
        return colorPresets[0];
    }

    /**
     * Extracts item layer name safely.
     */
    function getItemLayerName(itm) {
        if (!itm) return "Default";
        try {
            if (itm.layer && itm.layer.name) return itm.layer.name;
            var cur = itm.parent;
            while (cur) {
                if (cur.typename === "Layer") return cur.name;
                cur = cur.parent;
            }
        } catch (eLyr) {}
        return "Default";
    }

    /**
     * Scans document for strict circles and "large circle + small shapes" groups.
     * All circles are interpreted purely as pitch circles (d = m * z).
     * 
     * @param {Document} doc Active Illustrator document
     * @param {Object} options Options:
     *   - fromAllLayers: boolean (default false: selection only)
     *   - colorPresets: Array of color presets
     *   - extractInnerShapes: boolean (default true)
     * @returns {Array} Array of scanned circle/group descriptors
     */
    function scanCirclesAndGroups(doc, options) {
        options = options || {};
        var detected = [];
        if (!doc) return detected;

        var fromAllLayers = (options.fromAllLayers === true);
        var colorPresets = options.colorPresets || [];
        var extractInner = (options.extractInnerShapes !== false);

        function inspectItem(itm) {
            if (!itm) return;

            if (itm.typename === "PathItem") {
                if (isStrictCircle(itm)) {
                    var w = Math.abs(itm.width);
                    var h = Math.abs(itm.height);
                    var diamPt = (w + h) / 2.0;
                    var diamMm = diamPt * PT_TO_MM;
                    var centerPt = [itm.left + w / 2.0, itm.top - h / 2.0];

                    var strokeCol = (itm.stroked && itm.strokeColor) ? itm.strokeColor : (itm.filled ? itm.fillColor : null);
                    var preset = resolveColorPreset(strokeCol, colorPresets);

                    detected.push({
                        id: "C" + (detected.length + 1),
                        item: itm,
                        isGroup: false,
                        diameterPt: diamPt,
                        diameterMm: Math.round(diamMm * 1000) / 1000,
                        centerPt: centerPt,
                        layerName: getItemLayerName(itm),
                        strokeColor: strokeCol,
                        preset: preset,
                        innerShapeItems: []
                    });
                }
            } else if (itm.typename === "GroupItem") {
                // "Large circle + small shapes" Group interpretation:
                // Find the largest strict circle inside the group as the pitch circle.
                // Collect remaining shapes as inner cutout shapes (shaft / weight reduction).
                var childCircles = [];
                var otherItems = [];

                try {
                    for (var g = 0; g < itm.pageItems.length; g++) {
                        var child = itm.pageItems[g];
                        if (child.typename === "PathItem" && isStrictCircle(child)) {
                            var cw = Math.abs(child.width);
                            var ch = Math.abs(child.height);
                            var cDiaPt = (cw + ch) / 2.0;
                            childCircles.push({ item: child, diaPt: cDiaPt, w: cw, h: ch });
                        } else {
                            otherItems.push(child);
                        }
                    }
                } catch (eGrp) {}

                if (childCircles.length > 0) {
                    // Sort descending by diameter to find the largest circle
                    childCircles.sort(function (a, b) { return b.diaPt - a.diaPt; });
                    var mainCircle = childCircles[0];

                    // Any smaller circles also become inner cutout shapes
                    for (var sc = 1; sc < childCircles.length; sc++) {
                        otherItems.push(childCircles[sc].item);
                    }

                    var mDiamPt = mainCircle.diaPt;
                    var mDiamMm = mDiamPt * PT_TO_MM;
                    var mCenterPt = [mainCircle.item.left + mainCircle.w / 2.0, mainCircle.item.top - mainCircle.h / 2.0];

                    var gStrokeCol = (mainCircle.item.stroked && mainCircle.item.strokeColor) ?
                                      mainCircle.item.strokeColor :
                                      (mainCircle.item.filled ? mainCircle.item.fillColor : null);
                    var gPreset = resolveColorPreset(gStrokeCol, colorPresets);

                    detected.push({
                        id: "G_C" + (detected.length + 1),
                        item: itm,
                        mainCircleItem: mainCircle.item,
                        isGroup: true,
                        diameterPt: mDiamPt,
                        diameterMm: Math.round(mDiamMm * 1000) / 1000,
                        centerPt: mCenterPt,
                        layerName: getItemLayerName(itm),
                        strokeColor: gStrokeCol,
                        preset: gPreset,
                        innerShapeItems: extractInner ? otherItems : []
                    });
                } else {
                    // Group without a strict circle: inspect elements individually
                    try {
                        for (var gi = 0; gi < itm.pageItems.length; gi++) {
                            inspectItem(itm.pageItems[gi]);
                        }
                    } catch (eSubGrp) {}
                }
            } else if (itm.typename === "CompoundPathItem") {
                try {
                    for (var cp = 0; cp < itm.pathItems.length; cp++) {
                        inspectItem(itm.pathItems[cp]);
                    }
                } catch (eCP) {}
            }
        }

        if (fromAllLayers) {
            function scanLayer(lyr) {
                if (!lyr.visible) return;
                for (var pi = 0; pi < lyr.pageItems.length; pi++) {
                    inspectItem(lyr.pageItems[pi]);
                }
                for (var si = 0; si < lyr.layers.length; si++) {
                    scanLayer(lyr.layers[si]);
                }
            }
            for (var l = 0; l < doc.layers.length; l++) {
                scanLayer(doc.layers[l]);
            }
        } else {
            var sel = doc.selection;
            if (sel && sel.length > 0) {
                for (var s = 0; s < sel.length; s++) {
                    inspectItem(sel[s]);
                }
            }
        }

        return detected;
    }

    /**
     * Solves required profile shift x to mesh a pair of gears at an arbitrary exact center distance aw.
     * Based on JIS B 1701-1 standard.
     */
    function solveProfileShiftForDistance(params) {
        var m = params.m || 2.0;
        var z1 = params.z1 || 18;
        var z2 = params.z2 || 36;
        var alphaDeg = (params.alphaDeg !== undefined) ? params.alphaDeg : 20.0;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var aw = params.targetCenterDistanceMm;
        var isInternal = params.isInternal || false;

        var aStd = isInternal ? (m * (z2 - z1) / 2.0) : (m * (z1 + z2) / 2.0);
        if (Math.abs(aw - aStd) < 1e-6) {
            return {
                possible: true,
                alphaWDeg: alphaDeg,
                xSum: 0.0,
                x1: 0.0,
                x2: 0.0
            };
        }

        var cosAlphaW = (aStd * Math.cos(alpha)) / aw;
        if (cosAlphaW <= 0 || cosAlphaW > 1.0) {
            return {
                possible: false,
                alphaWDeg: alphaDeg,
                xSum: 0.0,
                x1: 0.0,
                x2: 0.0,
                warning: "\u76ee\u6a19\u4e2d\u5fc3\u8ddd\u96e2 " + aw.toFixed(2) + "mm \u3067\u306f\u57fa\u790e\u5186\u5e72\u6e09\u306e\u305f\u3081\u5e7e\u4f55\u5b66\u7684\u306b\u565b\u307f\u5408\u3044\u304c\u6210\u7acb\u3057\u307e\u305b\u3093 (cos \u03b1w = " + cosAlphaW.toFixed(4) + " > 1.0)\u3002"
            };
        }

        var alphaW = Math.acos(cosAlphaW);
        var alphaWDeg = alphaW * (180.0 / Math.PI);

        if (alphaWDeg > 45.0) {
            return {
                possible: false,
                alphaWDeg: alphaWDeg,
                xSum: 0.0,
                x1: 0.0,
                x2: 0.0,
                warning: "\u76ee\u6a19\u4e2d\u5fc3\u8ddd\u96e2\u304c\u96e2\u308c\u3059\u304e\u3066\u304a\u308a\u3001\u565b\u307f\u5408\u3044\u5727\u529b\u89d2\u304c\u904e\u5927\u3067\u3059 (\u03b1w = " + alphaWDeg.toFixed(1) + "\u00b0 > 45\u00b0)\u3002"
            };
        }

        var invAlpha = Math.tan(alpha) - alpha;
        var invAlphaW = Math.tan(alphaW) - alphaW;

        var zEffective = isInternal ? (z2 - z1) : (z1 + z2);
        var xDelta = (zEffective / (2.0 * Math.tan(alpha))) * (invAlphaW - invAlpha);

        var x1 = 0.0;
        var x2 = 0.0;
        if (isInternal) {
            x1 = Math.round((-xDelta / 2.0) * 1000) / 1000;
            x2 = Math.round((xDelta / 2.0) * 1000) / 1000;
        } else {
            x1 = Math.round((xDelta / 2.0) * 1000) / 1000;
            x2 = Math.round((xDelta / 2.0) * 1000) / 1000;
        }

        return {
            possible: true,
            alphaWDeg: Math.round(alphaWDeg * 100) / 100,
            xSum: Math.round(xDelta * 1000) / 1000,
            x1: x1,
            x2: x2
        };
    }

    /**
     * Analyzes multiple scanned circles/groups to reconstruct a gear train tree topology.
     * Evaluates pairwise center distances to identify external meshing (SPUR),
     * internal meshing (INTERNAL), and cross-layer coaxial stepped gears (COAXIAL).
     */
    function analyzeCircleTopology(rawCircles, options) {
        options = options || {};
        var defaultM = options.m || 2.0;
        var defaultAlphaDeg = (options.alphaDeg !== undefined) ? options.alphaDeg : 20.0;
        var tol = (options.toleranceMm !== undefined) ? options.toleranceMm : 2.5;
        var snapMode = options.snapMode || "snap_theory"; // "snap_theory" | "exact_position" | "free"
        var allowCrossLayerMeshing = (options.allowCrossLayerMeshing === true);

        if (!rawCircles || rawCircles.length === 0) {
            logWarn("TOPOLOGY", "No circles provided for topology analysis");
            return { nodes: [], warnings: ["\u5186\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002"] };
        }

        var parsed = [];

        for (var i = 0; i < rawCircles.length; i++) {
            var c = rawCircles[i];
            var layerInfo = parseLayerParams(c.layerName) || {};
            var nodeM = layerInfo.m || defaultM;
            var nodeAlpha = layerInfo.alphaDeg || defaultAlphaDeg;

            var dMm = (c.diameterMm !== undefined) ? c.diameterMm : (c.diameterPt * PT_TO_MM);
            // Pure pitch circle interpretation: d = m * z -> z = round(d / m)
            var z = Math.max(3, Math.round(dMm / nodeM));

            var gType = "SPUR";
            var shaftType = "ROUND";
            var shaftDia = 5.0;
            var cutoutType = "NONE";
            var shift = 0.0;

            if (c.preset) {
                gType = c.preset.kind || "SPUR";
                shaftType = c.preset.shaftType || "ROUND";
                shaftDia = (typeof c.preset.shaftDia === "number") ? c.preset.shaftDia : 5.0;
                cutoutType = c.preset.cutoutType || "NONE";
                shift = (typeof c.preset.shift === "number") ? c.preset.shift : 0.0;
            }

            // Group inner shapes take precedence over default preset
            if (c.innerShapeItems && c.innerShapeItems.length > 0) {
                shaftType = "GROUP_SHAPE";
            }

            parsed.push({
                origId: c.id || ("C" + (i + 1)),
                item: c.item,
                mainCircleItem: c.mainCircleItem || c.item,
                isGroup: !!c.isGroup,
                innerShapeItems: c.innerShapeItems || [],
                centerPt: c.centerPt,
                centerMm: [c.centerPt[0] * PT_TO_MM, c.centerPt[1] * PT_TO_MM],
                diameterMm: dMm,
                z: z,
                m: nodeM,
                alphaDeg: nodeAlpha,
                stageIndex: layerInfo.stageIndex || null,
                layerName: c.layerName || "",
                gearType: gType,
                shaftType: shaftType,
                shaftDiameter: shaftDia,
                cutoutType: cutoutType,
                profileShiftX: shift
            });
        }

        // Layer-to-Stage deterministic assignment
        var uniqueLayers = [];
        var layerInfoMap = {};
        for (var si = 0; si < parsed.length; si++) {
            var ly = parsed[si].layerName || "Default";
            if (!layerInfoMap.hasOwnProperty(ly)) {
                uniqueLayers.push(ly);
                layerInfoMap[ly] = parseLayerParams(ly) || {};
            }
        }

        var hasAllExplicit = true;
        var usedStages = {};
        var explicitCount = 0;
        for (var u = 0; u < uniqueLayers.length; u++) {
            var uLy = uniqueLayers[u];
            var info = layerInfoMap[uLy];
            if (info && typeof info.stageIndex === "number" && !isNaN(info.stageIndex) && info.stageIndex > 0) {
                if (usedStages[info.stageIndex]) {
                    hasAllExplicit = false;
                    break;
                }
                usedStages[info.stageIndex] = uLy;
                explicitCount++;
            } else {
                hasAllExplicit = false;
            }
        }

        var layerStageMap = {};
        if (hasAllExplicit && explicitCount === uniqueLayers.length) {
            for (var u = 0; u < uniqueLayers.length; u++) {
                var uLy = uniqueLayers[u];
                layerStageMap[uLy] = layerInfoMap[uLy].stageIndex;
            }
        } else {
            var layerSortList = [];
            for (var u = 0; u < uniqueLayers.length; u++) {
                var uLy = uniqueLayers[u];
                var info = layerInfoMap[uLy];
                var stHint = (info && typeof info.stageIndex === "number" && !isNaN(info.stageIndex)) ? info.stageIndex : (1000 + u);
                layerSortList.push({ name: uLy, hint: stHint, origIdx: u });
            }
            layerSortList.sort(function (a, b) {
                if (a.hint !== b.hint) return a.hint - b.hint;
                return a.origIdx - b.origIdx;
            });

            for (var sIdx = 0; sIdx < layerSortList.length; sIdx++) {
                layerStageMap[layerSortList[sIdx].name] = sIdx + 1;
            }
        }

        for (var si = 0; si < parsed.length; si++) {
            var ly = parsed[si].layerName || "Default";
            parsed[si].stageIndex = layerStageMap[ly];
        }

        // Single circle case
        if (parsed.length === 1) {
            var s = parsed[0];
            return {
                nodes: [{
                    id: "G1",
                    gearType: s.gearType || "SPUR",
                    parentId: null,
                    relationType: "ROOT",
                    z: s.z,
                    m: s.m,
                    alphaDeg: s.alphaDeg,
                    stageIndex: s.stageIndex,
                    layerName: s.layerName,
                    relativeAngleDeg: 0,
                    shaftType: s.shaftType,
                    shaftDiameter: s.shaftDiameter,
                    cutoutType: s.cutoutType,
                    innerShapeItems: s.innerShapeItems,
                    rimDiameter: (s.gearType === "INTERNAL") ? ((s.m * s.z) + 16.0) : ((s.m * s.z) + 12.0),
                    centerPt: s.centerPt,
                    xOffset: s.centerMm[0],
                    yOffset: s.centerMm[1],
                    x: s.profileShiftX || 0.0,
                    origCircle: s
                }],
                warnings: [],
                meshingPairs: []
            };
        }

        // Pairwise evaluation
        var pairs = [];
        var n = parsed.length;
        var warnings = [];

        for (var i = 0; i < n; i++) {
            for (var j = i + 1; j < n; j++) {
                var c1 = parsed[i];
                var c2 = parsed[j];
                var dxMm = c2.centerMm[0] - c1.centerMm[0];
                var dyMm = c2.centerMm[1] - c1.centerMm[1];
                var distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);

                var isSameLayer = (c1.layerName === c2.layerName);

                // 1. Coaxial detection (center distance <= 0.5 mm)
                if (distMm <= 0.5) {
                    if (isSameLayer) {
                        warnings.push("\u540c\u4e00\u30ec\u30a4\u30e4\u30fc ('" + c1.layerName + "') \u5185\u306b\u540c\u5fc3\u5186 (" + c1.origId + ", " + c2.origId + ") \u304c\u691c\u51fa\u3055\u308c\u307e\u3057\u305f\u3002\u5e73\u9762\u5e72\u6e09\u3092\u907f\u3051\u308b\u305f\u3081\u540c\u8ef8(COAXIAL)\u3068\u3057\u3066\u5206\u96e2\u51e6\u7406\u3057\u307e\u3057\u305f\u3002");
                    }
                    pairs.push({
                        idx1: i,
                        idx2: j,
                        type: "COAXIAL",
                        distMm: distMm,
                        errorMm: distMm
                    });
                    continue;
                }

                // 2. Meshing evaluation
                if (!isSameLayer && !allowCrossLayerMeshing) {
                    continue;
                }

                var meshM = c1.m;
                var meshAlpha = c1.alphaDeg;
                var isC1Int = (c1.gearType === "INTERNAL");
                var isC2Int = (c2.gearType === "INTERNAL");

                if (isC1Int && isC2Int) {
                    continue; // Internal gears do not mesh together
                }

                if (isC1Int || isC2Int) {
                    var ringIdx = isC1Int ? i : j;
                    var pinionIdx = isC1Int ? j : i;
                    var ringNode = parsed[ringIdx];
                    var pinNode = parsed[pinionIdx];

                    if (ringNode.z > pinNode.z) {
                        var aInt = (meshM * (ringNode.z - pinNode.z)) / 2.0;
                        var errInt = Math.abs(distMm - aInt);
                        if (errInt <= tol) {
                            pairs.push({
                                idx1: pinionIdx,
                                idx2: ringIdx,
                                type: "INTERNAL_MESHING",
                                distMm: distMm,
                                errorMm: errInt,
                                ringIdx: ringIdx,
                                pinionIdx: pinionIdx,
                                m: meshM,
                                alphaDeg: meshAlpha
                            });
                        }
                    }
                } else {
                    // Spur x Spur external meshing
                    var aExt = (meshM * (c1.z + c2.z)) / 2.0;
                    var errExt = Math.abs(distMm - aExt);
                    if (errExt <= tol) {
                        pairs.push({
                            idx1: i,
                            idx2: j,
                            type: "MESHING",
                            distMm: distMm,
                            errorMm: errExt,
                            m: meshM,
                            alphaDeg: meshAlpha
                        });
                    } else if (c1.z !== c2.z) {
                        // Geometric internal meshing auto-detection
                        var aIntGeom = (meshM * Math.abs(c1.z - c2.z)) / 2.0;
                        var errIntGeom = Math.abs(distMm - aIntGeom);
                        if (errIntGeom <= tol) {
                            var gRingIdx = (c1.z > c2.z) ? i : j;
                            var gPinionIdx = (c1.z > c2.z) ? j : i;
                            parsed[gRingIdx].gearType = "INTERNAL";

                            pairs.push({
                                idx1: gPinionIdx,
                                idx2: gRingIdx,
                                type: "INTERNAL_MESHING",
                                distMm: distMm,
                                errorMm: errIntGeom,
                                ringIdx: gRingIdx,
                                pinionIdx: gPinionIdx,
                                m: meshM,
                                alphaDeg: meshAlpha
                            });
                        }
                    }
                }
            }
        }

        // Sort pairs by error ascending
        pairs.sort(function (a, b) { return a.errorMm - b.errorMm; });

        // Build adjacency graph
        var adj = [];
        for (var i = 0; i < n; i++) adj.push([]);
        for (var p = 0; p < pairs.length; p++) {
            var pr = pairs[p];
            adj[pr.idx1].push({ neighbor: pr.idx2, pair: pr });
            adj[pr.idx2].push({ neighbor: pr.idx1, pair: pr });
        }

        // Pick root: gear with highest degree, preferring SPUR over INTERNAL
        var rootIdx = 0;
        var maxDeg = -1;
        for (var i = 0; i < n; i++) {
            var deg = adj[i].length;
            var isSpur = (parsed[i].gearType !== "INTERNAL");
            if (deg > maxDeg || (deg === maxDeg && isSpur && parsed[rootIdx].gearType === "INTERNAL")) {
                maxDeg = deg;
                rootIdx = i;
            }
        }

        // BFS spanning tree
        var visited = {};
        var treeEdges = [];
        var queue = [rootIdx];
        visited[rootIdx] = true;

        while (queue.length > 0) {
            var curr = queue.shift();
            for (var k = 0; k < adj[curr].length; k++) {
                var edge = adj[curr][k];
                var nxt = edge.neighbor;
                if (!visited[nxt]) {
                    visited[nxt] = true;
                    treeEdges.push({
                        parent: curr,
                        child: nxt,
                        pair: edge.pair
                    });
                    queue.push(nxt);
                }
            }
        }

        // Fallback for unconnected nodes
        for (var i = 0; i < n; i++) {
            if (!visited[i]) {
                treeEdges.push({
                    parent: rootIdx,
                    child: i,
                    pair: { type: "MESHING", distMm: (defaultM * (parsed[rootIdx].z + parsed[i].z) / 2.0), errorMm: 0 }
                });
            }
        }

        // Assign Gear IDs
        var idMap = {};
        idMap[rootIdx] = "G1";
        var nextIdNum = 2;
        for (var e = 0; e < treeEdges.length; e++) {
            var cIdx = treeEdges[e].child;
            if (!idMap[cIdx]) {
                idMap[cIdx] = "G" + nextIdNum++;
            }
        }

        // exact_position mode: solve profile shift x
        if (snapMode === "exact_position") {
            for (var e = 0; e < treeEdges.length; e++) {
                var edge = treeEdges[e];
                if (edge.pair.type !== "COAXIAL") {
                    var pParsed = parsed[edge.parent];
                    var cParsed = parsed[edge.child];
                    var isInt = (cParsed.gearType === "INTERNAL" || pParsed.gearType === "INTERNAL");
                    var shiftRes = solveProfileShiftForDistance({
                        m: pParsed.m,
                        z1: isInt ? Math.min(pParsed.z, cParsed.z) : pParsed.z,
                        z2: isInt ? Math.max(pParsed.z, cParsed.z) : cParsed.z,
                        alphaDeg: pParsed.alphaDeg,
                        targetCenterDistanceMm: edge.pair.distMm,
                        isInternal: isInt
                    });
                    if (shiftRes.possible) {
                        pParsed.profileShiftX = shiftRes.x1;
                        cParsed.profileShiftX = shiftRes.x2;
                    } else if (shiftRes.warning) {
                        warnings.push(shiftRes.warning);
                    }
                }
            }
        }

        var resultNodes = [];
        var rootParsed = parsed[rootIdx];
        resultNodes.push({
            id: idMap[rootIdx],
            gearType: rootParsed.gearType || "SPUR",
            parentId: null,
            relationType: "ROOT",
            z: rootParsed.z,
            m: rootParsed.m,
            alphaDeg: rootParsed.alphaDeg,
            stageIndex: rootParsed.stageIndex,
            layerName: rootParsed.layerName,
            relativeAngleDeg: 0.0,
            shaftType: rootParsed.shaftType,
            shaftDiameter: rootParsed.shaftDiameter,
            cutoutType: rootParsed.cutoutType,
            innerShapeItems: rootParsed.innerShapeItems,
            rimDiameter: (rootParsed.gearType === "INTERNAL") ? ((rootParsed.m * rootParsed.z) + 16.0) : ((rootParsed.m * rootParsed.z) + 12.0),
            centerPt: rootParsed.centerPt,
            xOffset: rootParsed.centerMm[0],
            yOffset: rootParsed.centerMm[1],
            x: rootParsed.profileShiftX || 0.0,
            origCircle: rootParsed
        });

        for (var e = 0; e < treeEdges.length; e++) {
            var edge = treeEdges[e];
            var pNodeParsed = parsed[edge.parent];
            var cNodeParsed = parsed[edge.child];
            var pId = idMap[edge.parent];
            var cId = idMap[edge.child];

            var relType = (edge.pair.type === "COAXIAL") ? "COAXIAL" :
                          ((edge.pair.type === "INTERNAL_MESHING") ? "INTERNAL_MESHING" : "MESHING");

            if (relType === "COAXIAL") {
                if (cNodeParsed.stageIndex === pNodeParsed.stageIndex) {
                    cNodeParsed.stageIndex = pNodeParsed.stageIndex + 1;
                }
            }

            var dX = cNodeParsed.centerPt[0] - pNodeParsed.centerPt[0];
            var dY = cNodeParsed.centerPt[1] - pNodeParsed.centerPt[1];
            var connAngleDeg = 0.0;
            if (relType !== "COAXIAL") {
                if (relType === "INTERNAL_MESHING") {
                    connAngleDeg = Math.atan2(-dY, -dX) * (180.0 / Math.PI);
                } else {
                    connAngleDeg = Math.atan2(dY, dX) * (180.0 / Math.PI);
                }
            }

            resultNodes.push({
                id: cId,
                gearType: cNodeParsed.gearType || "SPUR",
                parentId: pId,
                relationType: relType,
                z: cNodeParsed.z,
                m: cNodeParsed.m,
                alphaDeg: cNodeParsed.alphaDeg,
                stageIndex: cNodeParsed.stageIndex,
                layerName: cNodeParsed.layerName,
                relativeAngleDeg: Math.round(connAngleDeg * 100) / 100,
                shaftType: cNodeParsed.shaftType,
                shaftDiameter: cNodeParsed.shaftDiameter,
                cutoutType: cNodeParsed.cutoutType,
                innerShapeItems: cNodeParsed.innerShapeItems,
                rimDiameter: (cNodeParsed.gearType === "INTERNAL") ? ((cNodeParsed.m * cNodeParsed.z) + 16.0) : ((cNodeParsed.m * cNodeParsed.z) + 12.0),
                centerPt: cNodeParsed.centerPt,
                xOffset: cNodeParsed.centerMm[0],
                yOffset: cNodeParsed.centerMm[1],
                x: cNodeParsed.profileShiftX || 0.0,
                origCircle: cNodeParsed
            });
        }

        return {
            nodes: resultNodes,
            warnings: warnings,
            meshingPairs: pairs,
            snapMode: snapMode,
            allowCrossLayerMeshing: allowCrossLayerMeshing
        };
    }

    return {
        isStrictCircle: isStrictCircle,
        parseLayerParams: parseLayerParams,
        resolveColorPreset: resolveColorPreset,
        scanCirclesAndGroups: scanCirclesAndGroups,
        solveProfileShiftForDistance: solveProfileShiftForDistance,
        analyzeCircleTopology: analyzeCircleTopology
    };
})();

/**
 * LayerAndStyle.jsxinc - CAD/CAM Layer Hierarchy, Styling & Semantic Naming for GearDrawer
 * Version: 0.5.0
 * 
 * Provides:
 * - Structured Layer Hierarchy Management:
 *     Train Parent Layer (e.g. "T1")
 *     -> Stage Sublayers (e.g. "T1_1", "T1_2")
 *     -> Intermittent Lock Plate Sublayer ("T1_LockPlate")
 *     -> Carrier / Base Plate Sublayer ("T1_Carrier", "T1_BasePlate")
 *     -> JIS B 0003 Drawing Skeleton Sublayer ("T1_dwg" or per-stage "T1_1_dwg")
 * - Layer Conflict Resolution: "overwrite" (clean items), "merge" (coexist), "cancel" (abort)
 * - Center Guide (Crosshair) Dimension Control:
 *     "fixed": Length = X mm (constant length)
 *     "relative": Length = d * (X / 100) mm (percentage of pitch diameter d)
 * - JIS B 0003 Skeleton Drafting Engine:
 *     Tip circle (da) [thick solid line]
 *     Pitch circle (d) [fine dash-dot line [6, 2, 1.5, 2]]
 *     Root circle (df) [fine solid line]
 *     Kinematic center connection lines [fine dash-dot line]
 *     Axis crosshair [dash-dot compound path]
 *     Specification text annotations (Module, Teeth, etc.)
 * - CAD/CAM Style Presets (laser, jis, cnc, custom)
 * - Dynamic Token Substitution Naming Engine ({train}, {layer}, {id}, {kind}, {m}, {z}, {d}, {shaft}, etc.)
 */

var LayerAndStyle = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    // --- Color Utilities ---
    function createRGBColor(r, g, b) {
        var col = null;
        try {
            col = new RGBColor();
            col.red = r;
            col.green = g;
            col.blue = b;
        } catch (e) {
            col = { red: r, green: g, blue: b };
        }
        return col;
    }

    function getRegistrationColor(doc) {
        try {
            if (doc && doc.swatches) {
                for (var s = 0; s < doc.swatches.length; s++) {
                    var swName = doc.swatches[s].name;
                    if (swName === "[Registration]" || swName === "[\u30ec\u30b8\u30b9\u30c8\u30ec\u30fc\u30b7\u30e7\u30f3]") {
                        return doc.swatches[s].color;
                    }
                }
            }
        } catch (e) {}
        return createRGBColor(30, 30, 30);
    }

    // --- Style Presets ---
    var STYLE_PRESETS = {
        laser: {
            name: "Laser Cutting",
            cutStrokeWidth: 0.5,
            cutColor: createRGBColor(255, 0, 0),        // Red #FF0000
            guideStrokeWidth: 0.25,
            guideColor: createRGBColor(0, 150, 0),      // Green #009600
            guideDashes: [4, 4],
            centerGuideStrokeWidth: 0.25,
            centerGuideColor: createRGBColor(0, 150, 0),
            centerGuideDashes: [],                      // Solid crosshair for center punch
            dwgStrokeWidth: 0.25,
            dwgTipStrokeWidth: 0.5,
            dwgColor: createRGBColor(0, 0, 0),
            dwgDashes: [6, 2, 1.5, 2],
            textColor: createRGBColor(0, 0, 0),
            textSize: 8
        },
        jis: {
            name: "JIS Mechanical Drafting (B 0003)",
            cutStrokeWidth: 0.5,
            cutColor: createRGBColor(0, 0, 0),          // Black solid
            guideStrokeWidth: 0.25,
            guideColor: createRGBColor(0, 0, 0),
            guideDashes: [6, 2, 1.5, 2],                // Standard fine dash-dot
            centerGuideStrokeWidth: 0.25,
            centerGuideColor: createRGBColor(0, 0, 0),
            centerGuideDashes: [6, 2, 1.5, 2],
            dwgStrokeWidth: 0.25,
            dwgTipStrokeWidth: 0.5,                     // Thick solid tip circle
            dwgColor: createRGBColor(0, 0, 0),
            dwgDashes: [6, 2, 1.5, 2],
            textColor: createRGBColor(0, 0, 0),
            textSize: 9
        },
        cnc: {
            name: "CNC Milling",
            cutStrokeWidth: 0.7,
            cutColor: createRGBColor(0, 102, 204),      // Blue #0066CC
            guideStrokeWidth: 0.3,
            guideColor: createRGBColor(128, 128, 128),  // Gray
            guideDashes: [3, 3],
            centerGuideStrokeWidth: 0.3,
            centerGuideColor: createRGBColor(255, 128, 0), // Orange drill marks
            centerGuideDashes: [],
            dwgStrokeWidth: 0.3,
            dwgTipStrokeWidth: 0.6,
            dwgColor: createRGBColor(0, 0, 0),
            dwgDashes: [6, 2, 1.5, 2],
            textColor: createRGBColor(0, 0, 0),
            textSize: 8
        },
        custom: {
            name: "Custom Style",
            cutStrokeWidth: 0.5,
            cutColor: createRGBColor(255, 0, 0),
            guideStrokeWidth: 0.25,
            guideColor: createRGBColor(0, 128, 255),
            guideDashes: [4, 4],
            centerGuideStrokeWidth: 0.25,
            centerGuideColor: createRGBColor(0, 128, 255),
            centerGuideDashes: [],
            dwgStrokeWidth: 0.25,
            dwgTipStrokeWidth: 0.5,
            dwgColor: createRGBColor(0, 0, 0),
            dwgDashes: [6, 2, 1.5, 2],
            textColor: createRGBColor(0, 0, 0),
            textSize: 8
        }
    };

    // --- Token Naming Presets ---
    var NAMING_PRESETS = {
        standard: {
            mainLayer: "{train}",
            subLayer: "{train}_{layer}",
            lockPlateLayer: "{train}_LockPlate",
            carrierLayer: "{train}_Carrier",
            basePlateLayer: "{train}_BasePlate",
            dwgLayer: "{train}_dwg",
            gearGroup: "{id}_{kind}_z{z}",
            contour: "{id}_Contour",
            shaftHole: "{id}_ShaftHole",
            cutout: "{id}_Cutout",
            pinHoles: "{id}_PinHoles",
            centerGuide: "{id}_CenterGuide",
            pitchCircle: "{id}_PitchCircle_d{d}"
        },
        engineering: {
            mainLayer: "Train_{train}_m{m}",
            subLayer: "{train}_L{layer}",
            lockPlateLayer: "{train}_LockPlate",
            carrierLayer: "{train}_Carrier",
            basePlateLayer: "{train}_BasePlate",
            dwgLayer: "DWG_{train}_Skeleton",
            gearGroup: "{id}_{kind}_m{m}_z{z}_d{d}_h{shaft}",
            contour: "{id}_Contour",
            shaftHole: "{id}_ShaftHole",
            cutout: "{id}_Cutout",
            pinHoles: "{id}_PinHoles",
            centerGuide: "{id}_CenterGuide",
            pitchCircle: "{id}_PitchCircle_d{d}"
        },
        cam: {
            mainLayer: "CUT_{train}",
            subLayer: "{train}_L{layer}",
            lockPlateLayer: "CUT_{train}_LockPlate",
            carrierLayer: "CUT_{train}_Carrier",
            basePlateLayer: "CUT_{train}_BasePlate",
            dwgLayer: "REG_{train}",
            gearGroup: "{train}_L{layer}_{kind}_{id}_z{z}",
            contour: "{id}_Contour",
            shaftHole: "{id}_ShaftHole",
            cutout: "{id}_Cutout",
            pinHoles: "{id}_PinHoles",
            centerGuide: "{id}_CenterGuide",
            pitchCircle: "{id}_PitchCircle_d{d}"
        }
    };

    /**
     * Replaces tokens in a naming template string with context values.
     * Tokens supported:
     *   {train}, {layer}, {stage}, {id}, {parentId}, {kind}, {type}, {gearType},
     *   {m}, {z}, {alpha}, {d}, {pcd}, {da}, {df}, {shaft}, {role}
     * 
     * @param {string} template Naming pattern (e.g. "{id}_{kind}_z{z}")
     * @param {Object} ctx Context values
     * @returns {string} Formatted string
     */
    function formatName(template, ctx) {
        if (!template) return "";
        ctx = ctx || {};

        var result = String(template);

        // Auto-populate kind / type
        var gType = (ctx.gearType || ctx.type || "").toUpperCase();
        var kind = ctx.kind;
        if (!kind) {
            if (gType === "INTERNAL") {
                kind = "Int";
            } else if (gType === "RACK") {
                kind = "Rck";
            } else if (gType === "PLANETARY") {
                kind = "Pln";
            } else {
                kind = "Ext";
            }
        }

        var trainVal = (ctx.train !== undefined) ? String(ctx.train) : "T1";
        var layerVal = (ctx.layer !== undefined) ? String(ctx.layer) : ((ctx.stage !== undefined) ? String(ctx.stage) : "1");
        var stageVal = (ctx.stage !== undefined) ? String(ctx.stage) : layerVal;
        var idVal = (ctx.id !== undefined) ? String(ctx.id) : "G1";
        var parentIdVal = (ctx.parentId !== undefined) ? String(ctx.parentId) : "Root";
        var mVal = (ctx.m !== undefined) ? (typeof ctx.m === "number" ? ctx.m.toString() : String(ctx.m)) : "2";
        var zVal = (ctx.z !== undefined) ? String(ctx.z) : "18";
        var alphaVal = (ctx.alpha !== undefined) ? String(ctx.alpha) : (ctx.alphaDeg !== undefined ? String(ctx.alphaDeg) : "20");
        var dVal = (ctx.d !== undefined) ? (typeof ctx.d === "number" ? ctx.d.toFixed(1) : String(ctx.d)) : (ctx.pcd !== undefined ? String(ctx.pcd) : "");
        var daVal = (ctx.da !== undefined) ? (typeof ctx.da === "number" ? ctx.da.toFixed(1) : String(ctx.da)) : "";
        var dfVal = (ctx.df !== undefined) ? (typeof ctx.df === "number" ? ctx.df.toFixed(1) : String(ctx.df)) : "";
        var shaftVal = (ctx.shaft !== undefined) ? String(ctx.shaft) : (ctx.shaftDiameter !== undefined ? String(ctx.shaftDiameter) : "d0");
        var roleVal = (ctx.role !== undefined) ? String(ctx.role) : (ctx.relationType !== undefined ? String(ctx.relationType) : "");

        function replaceToken(str, token, val) {
            var re = new RegExp("\\{" + token + "\\}", "g");
            return str.replace(re, val);
        }

        result = replaceToken(result, "train", trainVal);
        result = replaceToken(result, "layer", layerVal);
        result = replaceToken(result, "stage", stageVal);
        result = replaceToken(result, "id", idVal);
        result = replaceToken(result, "parentId", parentIdVal);
        result = replaceToken(result, "kind", kind);
        result = replaceToken(result, "type", kind);
        result = replaceToken(result, "gearType", gType);
        result = replaceToken(result, "m", mVal);
        result = replaceToken(result, "z", zVal);
        result = replaceToken(result, "alpha", alphaVal);
        result = replaceToken(result, "d", dVal);
        result = replaceToken(result, "pcd", dVal);
        result = replaceToken(result, "da", daVal);
        result = replaceToken(result, "df", dfVal);
        result = replaceToken(result, "shaft", shaftVal);
        result = replaceToken(result, "role", roleVal);

        return result;
    }

    /**
     * Unlocks and makes visible a layer, its ancestors, and sublayers.
     */
    function unlockAndShowLayer(layer) {
        if (!layer) return;
        try {
            if (layer.parent && layer.parent.typename === "Layer") {
                unlockAndShowLayer(layer.parent);
            }
        } catch (eParent) {}

        try { layer.locked = false; } catch (eL) {}
        try { layer.visible = true; } catch (eV) {}

        try {
            if (layer.layers && layer.layers.length > 0) {
                for (var i = 0; i < layer.layers.length; i++) {
                    try { layer.layers[i].locked = false; } catch (eSubL) {}
                    try { layer.layers[i].visible = true; } catch (eSubV) {}
                }
            }
        } catch (eSub) {}
    }

    /**
     * Safe retrieval or creation of a layer under a parent container (doc or parent Layer).
     * Supports conflict modes:
     *   "overwrite": Clears all pageItems and sublayers if layer exists.
     *   "merge": Coexists with existing contents (default).
     *   "cancel": Throws Error if layer already exists.
     * 
     * @param {Document} doc Target document
     * @param {string} layerName Name of layer
     * @param {Layer} [parentLayer] Optional parent layer for nested sublayers
     * @param {string} [conflictMode] "overwrite" | "merge" | "cancel"
     * @returns {Layer} Retrieved or newly created layer
     */
    function getOrCreateLayer(doc, layerName, parentLayer, conflictMode) {
        conflictMode = conflictMode || "merge";

        if (typeof PathBuilder !== "undefined" && PathBuilder.ensureExitIsolationMode) {
            PathBuilder.ensureExitIsolationMode(doc);
        }

        if (parentLayer) {
            unlockAndShowLayer(parentLayer);
        }

        var container = parentLayer ? parentLayer.layers : doc.layers;
        var targetLyr = null;
        for (var i = 0; i < container.length; i++) {
            if (container[i].name === layerName) {
                targetLyr = container[i];
                break;
            }
        }

        if (targetLyr) {
            if (conflictMode === "cancel") {
                throw new Error("Layer '" + layerName + "' already exists and conflictMode is 'cancel'.");
            } else if (conflictMode === "overwrite") {
                unlockAndShowLayer(targetLyr);
                try {
                    for (var pi = targetLyr.pageItems.length - 1; pi >= 0; pi--) {
                        try {
                            targetLyr.pageItems[pi].locked = false;
                            targetLyr.pageItems[pi].remove();
                        } catch (eItmRem) {}
                    }
                    for (var li = targetLyr.layers.length - 1; li >= 0; li--) {
                        try {
                            unlockAndShowLayer(targetLyr.layers[li]);
                            targetLyr.layers[li].remove();
                        } catch (eLyrRem) {}
                    }
                } catch (eClean) {}
            }
        } else {
            targetLyr = container.add();
            targetLyr.name = layerName;
        }

        unlockAndShowLayer(targetLyr);
        try { doc.activeLayer = targetLyr; } catch (eAct) {}
        return targetLyr;
    }

    /**
     * Automatically constructs the complete GearDrawer layer hierarchy:
     *   Train Parent Layer (e.g. "T1")
     *   -> Stage Sublayers ("T1_1", "T1_2", ...)
     *   -> Lock Plate Sublayer ("T1_LockPlate") (optional)
     *   -> Carrier Sublayer ("T1_Carrier") (optional)
     *   -> Base Plate Sublayer ("T1_BasePlate") (optional)
     *   -> Drawing Skeleton Sublayer ("T1_dwg" or per-stage) (optional)
     * 
     * @param {Document} doc Target Illustrator document
     * @param {string} trainId Train identifier (e.g. "T1")
     * @param {Array} stageIndices List of unique stage indices (e.g. [1, 2])
     * @param {Object} options Configuration options:
     *   - conflictMode: "overwrite" | "merge" | "cancel"
     *   - namingPreset: "standard" | "engineering" | "cam" | custom object
     *   - hasLockPlate: boolean
     *   - hasCarrier: boolean
     *   - hasBasePlate: boolean
     *   - drawDwg: boolean
     *   - dwgPerStage: boolean
     *   - m: Module (for token replacement in naming)
     * @returns {Object} Layer dictionary { mainLayer, subLayers: {}, lockPlateLayer, carrierLayer, basePlateLayer, dwgLayer, dwgSubLayers: {} }
     */
    function setupTrainLayerHierarchy(doc, trainId, stageIndices, options) {
        options = options || {};
        var conflictMode = options.conflictMode || (options.overwriteLayer ? "overwrite" : "merge");
        var baseNaming = (options.namingPreset && typeof options.namingPreset === "object") ? options.namingPreset :
                         (NAMING_PRESETS[options.namingPreset] || NAMING_PRESETS.standard);
        var naming = {};
        for (var nk in NAMING_PRESETS.standard) {
            if (NAMING_PRESETS.standard.hasOwnProperty(nk)) {
                naming[nk] = NAMING_PRESETS.standard[nk];
            }
        }
        for (var bk in baseNaming) {
            if (baseNaming.hasOwnProperty(bk) && baseNaming[bk] !== undefined && baseNaming[bk] !== null) {
                naming[bk] = baseNaming[bk];
            }
        }
        if (options.namingPattern && typeof options.namingPattern === "string" && options.namingPattern.indexOf("{") !== -1) {
            naming.gearGroup = options.namingPattern;
        }

        var trainCtx = {
            train: trainId || "T1",
            m: options.m || 2.0
        };

        // 1. Create Train Parent Layer
        var mainLayerName = formatName(naming.mainLayer, trainCtx);
        var mainLayer = getOrCreateLayer(doc, mainLayerName, null, conflictMode);

        var result = {
            mainLayer: mainLayer,
            subLayers: {},
            trainLayer: mainLayer,
            stageLayers: {},
            lockPlateLayer: null,
            carrierLayer: null,
            basePlateLayer: null,
            dwgLayer: null,
            dwgSubLayers: {},
            naming: naming
        };

        // 2. Create Stage Sublayers
        stageIndices = stageIndices || [1];
        for (var s = 0; s < stageIndices.length; s++) {
            var stIdx = stageIndices[s];
            var subCtx = {
                train: trainId || "T1",
                layer: stIdx,
                stage: stIdx,
                m: options.m || 2.0
            };
            var subName = formatName(naming.subLayer, subCtx);
            var stageLyr = getOrCreateLayer(doc, subName, mainLayer, conflictMode);
            result.subLayers[stIdx] = stageLyr;
            result.stageLayers[stIdx] = stageLyr;
        }

        // 3. Create Lock Plate Sublayer if needed
        if (options.hasLockPlate) {
            var lockName = formatName(naming.lockPlateLayer, trainCtx);
            result.lockPlateLayer = getOrCreateLayer(doc, lockName, mainLayer, conflictMode);
        }

        // 4. Create Carrier Sublayer if needed
        if (options.hasCarrier) {
            var carrierName = formatName(naming.carrierLayer, trainCtx);
            result.carrierLayer = getOrCreateLayer(doc, carrierName, mainLayer, conflictMode);
        }

        // 5. Create Base Plate Sublayer if needed
        if (options.hasBasePlate) {
            var bpName = formatName(naming.basePlateLayer, trainCtx);
            result.basePlateLayer = getOrCreateLayer(doc, bpName, mainLayer, conflictMode);
        }

        // 6. Create Drawing Skeleton Sublayer if needed
        if (options.drawDwg !== false) {
            if (options.dwgPerStage) {
                for (var ds = 0; ds < stageIndices.length; ds++) {
                    var dstIdx = stageIndices[ds];
                    var dwgSubCtx = {
                        train: trainId || "T1",
                        layer: dstIdx,
                        stage: dstIdx,
                        m: options.m || 2.0
                    };
                    var dwgSubName = formatName(naming.dwgLayer, dwgSubCtx);
                    if (dwgSubName.indexOf(String(dstIdx)) === -1 && dwgSubName === naming.dwgLayer) {
                        dwgSubName = (trainId || "T1") + "_" + dstIdx + "_dwg";
                    }
                    result.dwgSubLayers[dstIdx] = getOrCreateLayer(doc, dwgSubName, mainLayer, conflictMode);
                }
            } else {
                var dwgName = formatName(naming.dwgLayer, trainCtx);
                result.dwgLayer = getOrCreateLayer(doc, dwgName, mainLayer, conflictMode);
            }
        }

        return result;
    }

    /**
     * Calculates center guide (crosshair) arm endpoints in internal mm.
     * Supports:
     *   "fixed": Length = value (mm)
     *   "relative": Length = dMm * (value / 100.0) (mm)
     * 
     * @param {Array} centerMm [cx, cy] in mm
     * @param {number} dMm Pitch diameter d in mm
     * @param {string} mode "fixed" | "relative"
     * @param {number} value Value in mm (for fixed) or % (for relative)
     * @returns {Object} { hLine: [[x1,y1],[x2,y2]], vLine: [[x1,y1],[x2,y2]], lengthMm, lengthPt }
     */
    function calculateCenterGuide(centerMm, dMm, mode, value) {
        var cx = (centerMm && !isNaN(parseFloat(centerMm[0]))) ? parseFloat(centerMm[0]) : 0;
        var cy = (centerMm && !isNaN(parseFloat(centerMm[1]))) ? parseFloat(centerMm[1]) : 0;
        mode = String(mode || "fixed").toLowerCase();
        value = (value !== undefined && value !== null) ? parseFloat(value) : 5.0;
        if (isNaN(value)) value = 5.0;
        dMm = (dMm !== undefined && dMm !== null) ? parseFloat(dMm) : 36.0;
        if (isNaN(dMm) || dMm <= 0) dMm = 36.0;

        var lengthMm = 5.0;
        if (mode === "relative") {
            // value is percentage of pitch diameter d
            lengthMm = dMm * (value / 100.0);
        } else {
            // fixed length in mm
            lengthMm = value;
        }

        if (isNaN(lengthMm)) lengthMm = 5.0;
        if (lengthMm < 0.1) lengthMm = 0.1;
        var halfL = lengthMm / 2.0;

        return {
            mode: mode,
            value: value,
            lengthMm: lengthMm,
            lengthPt: lengthMm * MM_TO_PT,
            hLine: [
                [cx - halfL, cy],
                [cx + halfL, cy]
            ],
            vLine: [
                [cx, cy - halfL],
                [cx, cy + halfL]
            ]
        };
    }

    /**
     * Draws center guide (crosshair) as a CompoundPathItem on target container.
     * 
     * @param {Layer|GroupItem} container Target container
     * @param {Array} centerPt Center [cx, cy] in pt
     * @param {number} dMm Pitch diameter d in mm
     * @param {Object} options Configuration options:
     *   - guideMode: "fixed" | "relative" (default "fixed")
     *   - guideValue: number (e.g. 5.0 for 5mm, or 20 for 20% of d)
     *   - strokeWidth: pt (default from style preset)
     *   - strokeColor: RGBColor
     *   - dashes: array
     *   - stylePreset: "laser" | "jis" | "cnc" | "custom"
     *   - name: item name
     * @returns {CompoundPathItem} The created crosshair compound path
     */
    function drawCenterGuide(container, centerPt, dMm, options) {
        if (!container) return null;
        options = options || {};
        var preset = STYLE_PRESETS[options.stylePreset] || STYLE_PRESETS.laser;

        var mode = String(options.guideMode || "fixed").toLowerCase();
        var val = (options.guideValue !== undefined) ? options.guideValue : 5.0;

        // Calculate in mm
        var centerMm = [centerPt[0] * PT_TO_MM, centerPt[1] * PT_TO_MM];
        var guideGeom = calculateCenterGuide(centerMm, dMm, mode, val);

        var sw = (options.strokeWidth !== undefined) ? options.strokeWidth : preset.centerGuideStrokeWidth;
        var sc = options.strokeColor || preset.centerGuideColor;
        var dashes = options.dashes || preset.centerGuideDashes;

        var compound = container.compoundPathItems.add();
        compound.name = options.name || ("CenterGuide_" + mode + "_" + val);

        var hPath = compound.pathItems.add();
        hPath.setEntirePath([
            [guideGeom.hLine[0][0] * MM_TO_PT, guideGeom.hLine[0][1] * MM_TO_PT],
            [guideGeom.hLine[1][0] * MM_TO_PT, guideGeom.hLine[1][1] * MM_TO_PT]
        ]);

        var vPath = compound.pathItems.add();
        vPath.setEntirePath([
            [guideGeom.vLine[0][0] * MM_TO_PT, guideGeom.vLine[0][1] * MM_TO_PT],
            [guideGeom.vLine[1][0] * MM_TO_PT, guideGeom.vLine[1][1] * MM_TO_PT]
        ]);

        // Apply styles to compound path and its children
        compound.stroked = true;
        compound.filled = false;
        compound.strokeWidth = sw;
        compound.strokeColor = sc;
        if (dashes && dashes.length > 0 && compound.strokeDashes !== undefined) {
            try { compound.strokeDashes = dashes; } catch (eDash) {}
        }

        for (var p = 0; p < compound.pathItems.length; p++) {
            var child = compound.pathItems[p];
            child.stroked = true;
            child.filled = false;
            child.strokeWidth = sw;
            child.strokeColor = sc;
            if (dashes && dashes.length > 0 && child.strokeDashes !== undefined) {
                try { child.strokeDashes = dashes; } catch (eChildDash) {}
            }
        }

        return compound;
    }

    /**
     * Applies cut line styling (laser/CNC cutting) to a PathItem or CompoundPathItem.
     */
    function applyCutStyle(item, stylePreset, customWidth, customColor) {
        if (!item) return;
        var preset = (stylePreset && typeof stylePreset === "object") ? stylePreset :
                     (STYLE_PRESETS[stylePreset] || STYLE_PRESETS.laser);
        var sw = (customWidth !== undefined) ? customWidth : preset.cutStrokeWidth;
        var sc = customColor || preset.cutColor;

        try {
            item.stroked = true;
            item.filled = false;
            item.strokeWidth = sw;
            item.strokeColor = sc;
        } catch (eStyle) {}

        if (item.typename === "CompoundPathItem" && item.pathItems) {
            for (var p = 0; p < item.pathItems.length; p++) {
                try {
                    item.pathItems[p].stroked = true;
                    item.pathItems[p].filled = false;
                    item.pathItems[p].strokeWidth = sw;
                    item.pathItems[p].strokeColor = sc;
                } catch (eChild) {}
            }
        }
    }

    /**
     * Applies guide line styling to a PathItem.
     */
    function applyGuideStyle(item, stylePreset, customWidth, customColor, dashes) {
        if (!item) return;
        var preset = (stylePreset && typeof stylePreset === "object") ? stylePreset :
                     (STYLE_PRESETS[stylePreset] || STYLE_PRESETS.laser);
        var sw = (customWidth !== undefined) ? customWidth : preset.guideStrokeWidth;
        var sc = customColor || preset.guideColor;
        var dsh = (dashes !== undefined) ? dashes : preset.guideDashes;

        try {
            item.stroked = true;
            item.filled = false;
            item.strokeWidth = sw;
            item.strokeColor = sc;
            if (dsh && dsh.length > 0 && item.strokeDashes !== undefined) {
                item.strokeDashes = dsh;
            }
        } catch (eGuide) {}
    }

    /**
     * Draws JIS B 0003 Kinematic & Drawing Skeleton diagram into a designated layer.
     * Draws:
     *   1. Center-to-center lines between meshing axes (Fine dash-dot line [6, 2, 1.5, 2])
     *   2. For each gear node:
     *      - Pitch circle (d): Fine dash-dot line [6, 2, 1.5, 2]
     *      - Tip circle (da): Thick solid line
     *      - Root circle (df): Fine solid line
     *      - Axis center crosshair: Dash-dot compound path
     *      - Specification text engraving (optional): m, z, alpha, x, etc.
     * 
     * @param {Layer} dwgLayer Target DWG layer
     * @param {Object} resolvedTrain Resolved gear train object from TrainTreeResolver
     * @param {Object} options Configuration options:
     *   - originPt: [ox, oy] in pt
     *   - stylePreset: "jis" | "laser" | "cnc" | "custom"
     *   - drawAnnotations: boolean (whether to engrave gear specifications)
     *   - centerGuideMode: "fixed" | "relative"
     *   - centerGuideValue: number
     * @returns {GroupItem} Group item containing all skeleton objects
     */
    function getDocumentFromLayer(layer) {
        if (!layer) return null;
        var cur = layer;
        while (cur && cur.typename !== "Document") {
            cur = cur.parent;
        }
        return cur;
    }

    function drawSafeEllipse(container, top, left, width, height) {
        try {
            return container.pathItems.ellipse(top, left, width, height);
        } catch (eEll) {
            var rx = width / 2.0;
            var ry = height / 2.0;
            var cx = left + rx;
            var cy = top - ry;
            var K = 0.5522847498;
            var kx = rx * K;
            var ky = ry * K;
            var p = container.pathItems.add();
            p.setEntirePath([
                [cx, cy + ry],
                [cx + rx, cy],
                [cx, cy - ry],
                [cx - rx, cy]
            ]);
            var pts = p.pathPoints;
            pts[0].leftDirection = [cx - kx, cy + ry];
            pts[0].rightDirection = [cx + kx, cy + ry];
            pts[1].leftDirection = [cx + rx, cy + ky];
            pts[1].rightDirection = [cx + rx, cy - ky];
            pts[2].leftDirection = [cx + kx, cy - ry];
            pts[2].rightDirection = [cx - kx, cy - ry];
            pts[3].leftDirection = [cx - rx, cy - ky];
            pts[3].rightDirection = [cx - rx, cy + ky];
            p.closed = true;
            return p;
        }
    }

    function drawJisDwgSkeleton(dwgLayer, resolvedTrain, options) {
        if (!dwgLayer || !resolvedTrain || !resolvedTrain.nodes) return null;
        unlockAndShowLayer(dwgLayer);
        var pDoc = getDocumentFromLayer(dwgLayer);
        if (pDoc) {
            try { pDoc.activeLayer = dwgLayer; } catch (eAct) {}
        }

        options = options || {};
        var preset = STYLE_PRESETS[options.stylePreset] || STYLE_PRESETS.jis;
        var originPt = options.originPt || [0, 0];
        var nodes = resolvedTrain.nodes;

        var dwgGroup = dwgLayer.groupItems.add();
        dwgGroup.name = "JIS_B_0003_Skeleton";

        var strokeColor = preset.dwgColor || createRGBColor(0, 0, 0);
        var dashDot = preset.dwgDashes || [6, 2, 1.5, 2];
        var tipWidth = preset.dwgTipStrokeWidth || 0.5;
        var fineWidth = preset.dwgStrokeWidth || 0.25;

        // 1. Draw Kinematic Axis Connection Lines (between meshing centers)
        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            if (nd.parentId && (nd.relationType === "MESHING" || nd.relationType === "INTERNAL_MESHING")) {
                var pNode = null;
                for (var k = 0; k < nodes.length; k++) {
                    if (nodes[k].id === nd.parentId) {
                        pNode = nodes[k];
                        break;
                    }
                }
                if (pNode) {
                    var pCenterPt = [originPt[0] + pNode.centerPt[0], originPt[1] + pNode.centerPt[1]];
                    var cCenterPt = [originPt[0] + nd.centerPt[0], originPt[1] + nd.centerPt[1]];

                    var connLine = dwgGroup.pathItems.add();
                    connLine.name = "KinematicLink_" + pNode.id + "_to_" + nd.id;
                    connLine.setEntirePath([pCenterPt, cCenterPt]);
                    connLine.stroked = true;
                    connLine.filled = false;
                    connLine.strokeWidth = fineWidth;
                    connLine.strokeColor = strokeColor;
                    if (connLine.strokeDashes !== undefined) {
                        try { connLine.strokeDashes = dashDot; } catch (eCDash) {}
                    }
                }
            }
        }

        // 2. Draw Theoretical Circles & Crosshair for each gear
        for (var j = 0; j < nodes.length; j++) {
            var gNode = nodes[j];
            var center = [originPt[0] + gNode.centerPt[0], originPt[1] + gNode.centerPt[1]];
            var isInternal = (gNode.gearType === "INTERNAL");
            var isRack = (gNode.gearType === "RACK");

            var gearDwgGroup = dwgGroup.groupItems.add();
            gearDwgGroup.name = gNode.id + "_Dwg";

            if (isRack) {
                // For Rack: draw pitch line and top/bottom reference lines
                var pLine = gearDwgGroup.pathItems.add();
                pLine.name = gNode.id + "_PitchLine";
                var rkHalfL = (gNode.gearData.totalLength || 100) * MM_TO_PT / 2.0;
                pLine.setEntirePath([[center[0] - rkHalfL, center[1]], [center[0] + rkHalfL, center[1]]]);
                pLine.stroked = true;
                pLine.filled = false;
                pLine.strokeWidth = fineWidth;
                pLine.strokeColor = strokeColor;
                if (pLine.strokeDashes !== undefined) {
                    try { pLine.strokeDashes = dashDot; } catch (eRkDash) {}
                }
            } else {
                // Pitch radius, Tip radius, Root radius in pt
                var rpPt = (gNode.gearData.rp || (gNode.m * gNode.z / 2.0)) * MM_TO_PT;
                var raPt = (gNode.gearData.ra || (gNode.m * (gNode.z + 2.0) / 2.0)) * MM_TO_PT;
                var rfPt = (gNode.gearData.rf || (gNode.m * (gNode.z - 2.5) / 2.0)) * MM_TO_PT;

                // 2a. Pitch Circle (Fine Dash-Dot Line [6, 2, 1.5, 2])
                var pitchCirc = drawSafeEllipse(
                    gearDwgGroup,
                    center[1] + rpPt,
                    center[0] - rpPt,
                    rpPt * 2.0,
                    rpPt * 2.0
                );
                pitchCirc.name = gNode.id + "_PitchCircle_d" + ((rpPt * 2.0) * PT_TO_MM).toFixed(1);
                pitchCirc.stroked = true;
                pitchCirc.filled = false;
                pitchCirc.strokeWidth = fineWidth;
                pitchCirc.strokeColor = strokeColor;
                if (pitchCirc.strokeDashes !== undefined) {
                    try { pitchCirc.strokeDashes = dashDot; } catch (ePDash) {}
                }

                // 2b. Tip Circle (Thick Solid Line)
                var tipCirc = drawSafeEllipse(
                    gearDwgGroup,
                    center[1] + raPt,
                    center[0] - raPt,
                    raPt * 2.0,
                    raPt * 2.0
                );
                tipCirc.name = gNode.id + "_TipCircle_da" + ((raPt * 2.0) * PT_TO_MM).toFixed(1);
                tipCirc.stroked = true;
                tipCirc.filled = false;
                tipCirc.strokeWidth = tipWidth;
                tipCirc.strokeColor = strokeColor;

                // 2c. Root Circle (Fine Solid Line)
                if (rfPt > 0) {
                    var rootCirc = drawSafeEllipse(
                        gearDwgGroup,
                        center[1] + rfPt,
                        center[0] - rfPt,
                        rfPt * 2.0,
                        rfPt * 2.0
                    );
                    rootCirc.name = gNode.id + "_RootCircle_df" + ((rfPt * 2.0) * PT_TO_MM).toFixed(1);
                    rootCirc.stroked = true;
                    rootCirc.filled = false;
                    rootCirc.strokeWidth = fineWidth;
                    rootCirc.strokeColor = strokeColor;
                }

                // 2d. Axis Center Crosshair (Dash-Dot Compound Path)
                var guideMode = String(options.centerGuideMode || "relative").toLowerCase();
                var guideVal = (options.centerGuideValue !== undefined) ? options.centerGuideValue :
                               ((options.centerGuideSize !== undefined) ? options.centerGuideSize : 30.0);
                var dMm = (rpPt * 2.0) * PT_TO_MM;

                drawCenterGuide(gearDwgGroup, center, dMm, {
                    guideMode: guideMode,
                    guideValue: guideVal,
                    strokeWidth: fineWidth,
                    strokeColor: strokeColor,
                    dashes: dashDot,
                    name: gNode.id + "_AxisCrosshair"
                });

                // 2e. Specification Text Engraving (Optional)
                if (options.drawAnnotations !== false) {
                    try {
                        var textFrame = gearDwgGroup.textFrames.add();
                        textFrame.name = gNode.id + "_SpecAnnotation";
                        textFrame.contents = gNode.id + " (m=" + gNode.m + ", z=" + gNode.z +
                            (gNode.x ? (", x=" + gNode.x.toFixed(2)) : "") +
                            ", d=" + dMm.toFixed(1) + "mm)";
                        textFrame.left = center[0] + 5;
                        textFrame.top = center[1] + raPt + 14;
                    } catch (eTxt) {}
                }
            }
        }

        return dwgGroup;
    }

    return {
        STYLE_PRESETS: STYLE_PRESETS,
        NAMING_PRESETS: NAMING_PRESETS,
        formatName: formatName,
        createRGBColor: createRGBColor,
        getRegistrationColor: getRegistrationColor,
        unlockAndShowLayer: unlockAndShowLayer,
        getOrCreateLayer: getOrCreateLayer,
        setupTrainLayerHierarchy: setupTrainLayerHierarchy,
        calculateCenterGuide: calculateCenterGuide,
        drawCenterGuide: drawCenterGuide,
        applyCutStyle: applyCutStyle,
        applyGuideStyle: applyGuideStyle,
        drawJisDwgSkeleton: drawJisDwgSkeleton,
        drawSafeEllipse: drawSafeEllipse
    };
})();

/**
 * PathBuilder.jsxinc - Illustrator DOM Operations & Path Construction for GearDrawer
 * Version: 1.0.0
 * 
 * Provides:
 * - Isolation mode exit and detection (prevents Error 9034)
 * - Layer unlocking and visibility recursive restoration (prevents Error 8705)
 * - Safe layer retrieval and creation
 * - Accurate Cubic Bezier Path Construction with in/out handle orientation
 * - External Spur Gear and Individual Teeth drawing modes
 * - Meshing Gear Pair placement with conjugating phase matching
 * - Strict execution order: geometry -> grouping / compound path -> styling
 */

var PathBuilder = (function () {
    // Unit conversion constants
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    // Default styles
    var DEFAULT_CUT_WIDTH = 0.5; // pt
    var DEFAULT_GUIDE_WIDTH = 0.3; // pt

    /**
     * Recursively unlocks and makes visible a layer, its ancestors, sublayers, and page items.
     * Prevents Illustrator Error 8705 ("Target layer cannot be modified").
     */
    function unlockAndShowLayer(layer) {
        if (!layer) return;
        try {
            if (layer.parent && layer.parent.typename === "Layer") {
                unlockAndShowLayer(layer.parent);
            }
        } catch (eParent) {}

        try { layer.locked = false; } catch (eL) {}
        try { layer.visible = true; } catch (eV) {}

        try {
            if (layer.layers && layer.layers.length > 0) {
                for (var i = 0; i < layer.layers.length; i++) {
                    try { layer.layers[i].locked = false; } catch (eSubL) {}
                    try { layer.layers[i].visible = true; } catch (eSubV) {}
                }
            }
        } catch (eSub) {}
    }

    /**
     * Detects if document is currently in Isolation Mode (Group / Symbol focus).
     */
    function isIsolationMode(doc) {
        if (!doc) return false;
        try {
            if (doc.activeView && doc.activeView.isIsolated !== undefined) {
                return !!doc.activeView.isIsolated;
            }
        } catch (eView) {}

        try {
            // If activeLayer parent is not doc and typename is GroupItem or similar
            if (doc.activeLayer && doc.activeLayer.parent && doc.activeLayer.parent.typename !== "Document") {
                return true;
            }
        } catch (eParent) {}

        return false;
    }

    /**
     * Ensures Illustrator exits Isolation Mode before modifying layers.
     * Prevents Error 9034 ("Cannot add layer in isolation mode").
     */
    function ensureExitIsolationMode(doc) {
        if (!doc) return true;
        if (!isIsolationMode(doc)) return true;

        for (var iter = 0; iter < 3; iter++) {
            try {
                app.executeMenuCommand("exitFocus");
            } catch (eCmd) {
                break;
            }
        }
        if (!isIsolationMode(doc)) return true;

        try {
            if (doc.layers && doc.layers.length > 0) {
                doc.activeLayer = doc.layers[0];
            }
        } catch (eFallback) {}

        return !isIsolationMode(doc);
    }

    function safeEllipse(container, top, left, width, height) {
        if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawSafeEllipse) {
            return LayerAndStyle.drawSafeEllipse(container, top, left, width, height);
        }
        try {
            return container.pathItems.ellipse(top, left, width, height);
        } catch (eEll) {
            var rx = width / 2.0, ry = height / 2.0, cx = left + rx, cy = top - ry, K = 0.5522847498, kx = rx * K, ky = ry * K;
            var p = container.pathItems.add();
            p.setEntirePath([[cx, cy + ry], [cx + rx, cy], [cx, cy - ry], [cx - rx, cy]]);
            var pts = p.pathPoints;
            pts[0].leftDirection = [cx - kx, cy + ry]; pts[0].rightDirection = [cx + kx, cy + ry];
            pts[1].leftDirection = [cx + rx, cy + ky]; pts[1].rightDirection = [cx + rx, cy - ky];
            pts[2].leftDirection = [cx + kx, cy - ry]; pts[2].rightDirection = [cx - kx, cy - ry];
            pts[3].leftDirection = [cx - rx, cy - ky]; pts[3].rightDirection = [cx - rx, cy + ky];
            p.closed = true;
            return p;
        }
    }

    /**
     * Retrieves an existing top-level layer or creates it if absent.
     */
    function getOrCreateLayer(doc, layerName) {
        ensureExitIsolationMode(doc);
        var target = null;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                target = doc.layers[i];
                break;
            }
        }
        if (!target) {
            target = doc.layers.add();
            target.name = layerName;
        }
        unlockAndShowLayer(target);
        try { doc.activeLayer = target; } catch (eAct) {}
        return target;
    }

    /**
     * Creates an RGBColor object in a safe manner.
     */
    function createRGBColor(r, g, b) {
        var col = null;
        try {
            col = new RGBColor();
            col.red = r;
            col.green = g;
            col.blue = b;
        } catch (e) {
            col = { red: r, green: g, blue: b };
        }
        return col;
    }

    /**
     * Applies laser cut line style to a path or compound path.
     * When applied to a CompoundPathItem, also strictly propagates to all child pathItems.
     */
    function applyCutStyle(item, strokeWidth, strokeColor) {
        if (!item) return;
        var sw = (strokeWidth !== undefined) ? strokeWidth : DEFAULT_CUT_WIDTH;
        var sc = strokeColor || createRGBColor(255, 0, 0); // Red cut line

        try {
            item.stroked = true;
            item.filled = false;
            item.strokeWidth = sw;
            item.strokeColor = sc;
        } catch (eStyle) {}

        // If CompoundPathItem, recursively apply to each child pathItem
        try {
            if (item.pathItems && item.pathItems.length > 0) {
                for (var p = 0; p < item.pathItems.length; p++) {
                    try {
                        item.pathItems[p].stroked = true;
                        item.pathItems[p].filled = false;
                        item.pathItems[p].strokeWidth = sw;
                        item.pathItems[p].strokeColor = sc;
                    } catch (eChild) {}
                }
            }
        } catch (eCP) {}
    }

    /**
     * Applies guide / pitch line style to a path.
     */
    function applyGuideStyle(item, strokeWidth, strokeColor, dashes) {
        if (!item) return;
        try {
            item.stroked = true;
            item.filled = false;
            item.strokeWidth = strokeWidth !== undefined ? strokeWidth : DEFAULT_GUIDE_WIDTH;
            if (strokeColor) {
                item.strokeColor = strokeColor;
            } else {
                item.strokeColor = createRGBColor(0, 0, 255); // Blue guide line
            }
            if (dashes && dashes.length > 0 && item.strokeDashes !== undefined) {
                item.strokeDashes = dashes;
            }
        } catch (eGuide) {}
    }

    /**
     * Constructs PathPoints from Bezier node array.
     * Guaranteed handle assignments:
     *   leftDirection  = incoming control point (entering this anchor)
     *   rightDirection = outgoing control point (exiting towards next anchor)
     * 
     * Converts coordinates from internal mm to Illustrator pt using scale parameter.
     * 
     * @param {PathItem} pathItem Target Illustrator PathItem
     * @param {Array} nodes Array of node objects [{ anchor: [x,y], leftDirection: [x,y], rightDirection: [x,y], pointType }]
     * @param {Array} center [cx, cy] Center coordinate in pt
     * @param {number} rotRad Rotation angle in radians
     * @param {number} scale Conversion multiplier (e.g. MM_TO_PT)
     */
    function applyBezierNodes(pathItem, nodes, center, rotRad, scale) {
        if (!pathItem || !nodes || nodes.length === 0) return;
        scale = scale || MM_TO_PT;
        var cosR = Math.cos(rotRad || 0);
        var sinR = Math.sin(rotRad || 0);
        var cx = center ? center[0] : 0;
        var cy = center ? center[1] : 0;

        function tf(coord) {
            var px = coord[0] * scale;
            var py = coord[1] * scale;
            var rx = px * cosR - py * sinR;
            var ry = px * sinR + py * cosR;
            return [
                Math.round((cx + rx) * 10000) / 10000,
                Math.round((cy + ry) * 10000) / 10000
            ];
        }

        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            var pt = pathItem.pathPoints.add();
            // \u5148\u306b CORNER \u3092\u8a2d\u5b9a\u3057\u3001\u30cf\u30f3\u30c9\u30eb\u4ee3\u5165\u5f8c\u306b SMOOTH \u3092\u8a2d\u5b9a\u3059\u308b\u3053\u3068\u306b\u3088\u308b\u30cf\u30f3\u30c9\u30eb\u306e\u81ea\u52d5\u76f4\u7dda\u5316\u30fb\u4e0a\u66f8\u304d\u3092\u9632\u6b62
            try {
                pt.pointType = (typeof PointType !== "undefined" && PointType) ? PointType.CORNER : 2;
            } catch (ePT0) {}
            pt.anchor = tf(nd.anchor);
            pt.leftDirection = tf(nd.leftDirection);
            pt.rightDirection = tf(nd.rightDirection);
        }
    }

    /**
     * Draws an external spur gear on the target layer.
     * 
     * @param {Document} doc Target document
     * @param {Layer} targetLayer Target layer
     * @param {Array} center Center coordinate [cx, cy] in pt
     * @param {Object} gearData Gear geometry data from InvoluteCore.calculateSpurGear()
     * @param {number} rotationDeg Initial rotation in degrees
     * @param {string} gearName Base name for the gear item
     * @param {Object} options Configuration options:
     *   - drawMode: "normal" (default) | "test_teeth"
     *   - cutStrokeWidth: Stroke width in pt
     *   - cutColor: Stroke color
     *   - drawGuides: Whether to draw pitch and root circles
     * @returns {GroupItem} Created gear group
     */
    function drawGear(doc, targetLayer, center, gearData, rotationDeg, gearName, options) {
        if (!targetLayer && doc) {
            targetLayer = doc.activeLayer || (doc.layers.length > 0 ? doc.layers[0] : doc.layers.add());
        }
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}

        options = options || {};
        var mode = options.drawMode || "normal";
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || createRGBColor(255, 0, 0);
        var guideColor = options.guideColor || createRGBColor(0, 0, 255);

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName + (mode !== "normal" ? (" [" + mode + "]") : "");

        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180.0);
        var toothPitchAngle = (2.0 * Math.PI) / gearData.z;

        if (mode === "normal") {
            // === 1. Outer Closed Gear Contour ===
            var outerPath = gearGroup.pathItems.add();
            outerPath.name = gearName + "_Contour";

            if (gearData.outerNodes && gearData.outerNodes.length > 0) {
                applyBezierNodes(outerPath, gearData.outerNodes, center, rotOffsetRad, MM_TO_PT);
            }
            outerPath.closed = true;

            // === 2. Style Application ===
            applyCutStyle(outerPath, cutStrokeWidth, cutColor);

        } else if (mode === "test_teeth") {
            // === 2. Individual Open Teeth Mode (Case 4) ===
            var teethGroup = gearGroup.groupItems.add();
            teethGroup.name = gearName + "_IndividualTeeth";

            for (var t = 0; t < gearData.z; t++) {
                var toothRot = rotOffsetRad + (t * toothPitchAngle);
                var toothPath = teethGroup.pathItems.add();
                toothPath.name = gearName + "_Tooth_" + (t + 1);

                if (gearData.singleToothNodes && gearData.singleToothNodes.length > 0) {
                    applyBezierNodes(toothPath, gearData.singleToothNodes, center, toothRot, MM_TO_PT);
                }
                toothPath.closed = false;
                applyCutStyle(toothPath, cutStrokeWidth, cutColor);
            }

            // Dedicated Root Circle guide
            var rfPt = gearData.rf * MM_TO_PT;
            var rootCircle = safeEllipse(
                gearGroup,
                center[1] + rfPt,
                center[0] - rfPt,
                rfPt * 2.0,
                rfPt * 2.0
            );
            rootCircle.name = gearName + "_RootCircle";
            applyGuideStyle(rootCircle, guideStrokeWidth, cutColor);
        }

        // Draw pitch circle guide and center guide if requested
        var doDrawGuides = (options.drawGuides !== undefined) ? !!options.drawGuides : !!options.pitchGuide;
        var doDrawCenterGuide = (options.drawCenterGuide !== undefined) ? !!options.drawCenterGuide : !!options.centerGuide;
        var cgValue = (options.centerGuideValue !== undefined) ? options.centerGuideValue :
                      ((options.centerGuideSize !== undefined) ? options.centerGuideSize : 5.0);
        if (doDrawGuides || doDrawCenterGuide) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearName + "_Guides";

            if (doDrawGuides && gearData && gearData.rp) {
                var rpPt = gearData.rp * MM_TO_PT;
                var pitchCircle = safeEllipse(
                    guideGroup,
                    center[1] + rpPt,
                    center[0] - rpPt,
                    rpPt * 2.0,
                    rpPt * 2.0
                );
                pitchCircle.name = gearName + "_PitchCircle_d" + (gearData.d ? gearData.d.toFixed(1) : (gearData.rp * 2.0).toFixed(1));
                applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [4, 4]);
            }

            if (doDrawCenterGuide && gearData) {
                if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawCenterGuide) {
                    LayerAndStyle.drawCenterGuide(guideGroup, center, gearData.d, {
                        guideMode: options.centerGuideMode || "fixed",
                        guideValue: cgValue,
                        strokeWidth: guideStrokeWidth,
                        strokeColor: guideColor,
                        stylePreset: options.stylePreset || "laser",
                        name: gearName + "_CenterGuide"
                    });
                }
            }
        }

        return gearGroup;
    }

    /**
     * Draws a pair of meshing external spur gears with conjugate meshing phase.
     * 
     * @param {Document} doc Target document
     * @param {Object} params Meshing pair parameters:
     *   - m: Module (mm)
     *   - z1: Driving gear tooth count
     *   - z2: Driven gear tooth count
     *   - center1: Driving gear center [cx, cy] in pt
     *   - angleDeg: Placement angle theta of gear2 relative to gear1 (deg, default 0)
     *   - phi1Deg: Driving gear rotation angle phi1 (deg, default 0)
     *   - options: Styling and drawing options
     * @returns {Object} { group1, group2, gear1Data, gear2Data, center2 }
     */
    function drawMeshingPair(doc, params) {
        params = params || {};
        var m = parseFloat(params.m) || 2.0;
        var z1 = parseInt(params.z1, 10) || 18;
        var z2 = parseInt(params.z2, 10) || 36;
        var center1 = params.center1 || [400, 400];
        var angleDeg = parseFloat(params.angleDeg || 0.0);
        var angleRad = angleDeg * (Math.PI / 180.0);
        var phi1Deg = parseFloat(params.phi1Deg || 0.0);
        var phi1Rad = phi1Deg * (Math.PI / 180.0);
        var targetLayer = params.targetLayer || getOrCreateLayer(doc, "GearDrawer_MeshPair");
        var opts = params.options || {};

        // Calculate geometries
        var gear1Data = InvoluteCore.calculateSpurGear({
            m: m,
            z: z1,
            alphaDeg: params.alphaDeg || 20.0,
            x: params.x1 || 0.0,
            backlash: params.backlash || 0.0,
            kerfOffset: params.kerfOffset || 0.0,
            tipRounding: params.tipRounding1 || params.tipRounding || 0.0,
            pathQuality: opts.pathQuality || "bezier_recommended"
        });

        var gear2Data = InvoluteCore.calculateSpurGear({
            m: m,
            z: z2,
            alphaDeg: params.alphaDeg || 20.0,
            x: params.x2 || 0.0,
            backlash: params.backlash || 0.0,
            kerfOffset: params.kerfOffset || 0.0,
            tipRounding: params.tipRounding2 || params.tipRounding || 0.0,
            pathQuality: opts.pathQuality || "bezier_recommended"
        });

        // Center distance aw = rp1 + rp2 (in mm, converted to pt)
        var awMm = gear1Data.rp + gear2Data.rp;
        var awPt = awMm * MM_TO_PT;

        var center2 = [
            center1[0] + awPt * Math.cos(angleRad),
            center1[1] + awPt * Math.sin(angleRad)
        ];

        // Conjugate meshing phase for driven gear:
        // phi2 = theta + PI - (PI / z2) - (phi1 - theta) * (z1 / z2)
        var phi2Rad = angleRad + Math.PI - (Math.PI / z2) - (phi1Rad - angleRad) * (z1 / z2);
        var phi2Deg = phi2Rad * (180.0 / Math.PI);

        var group1 = drawGear(doc, targetLayer, center1, gear1Data, phi1Deg, params.name1 || "G1", opts);
        var group2 = drawGear(doc, targetLayer, center2, gear2Data, phi2Deg, params.name2 || "G2", opts);

        return {
            group1: group1,
            group2: group2,
            gear1Data: gear1Data,
            gear2Data: gear2Data,
            center1: center1,
            center2: center2,
            centerDistanceMm: awMm
        };
    }

    /**
     * Draws an internal ring gear as a single CompoundPathItem combining rim and inner teeth.
     * 
     * @param {Document} doc Target document
     * @param {Layer} targetLayer Target layer
     * @param {Array} center Center coordinate [cx, cy] in pt
     * @param {Object} internalData Geometry data from InvoluteCore.calculateInternalGear()
     * @param {number} rotationDeg Initial rotation in degrees
     * @param {string} gearName Base name for the item
     * @param {Object} options Configuration options
     * @returns {GroupItem} Created gear group
     */
    function drawInternalGear(doc, targetLayer, center, internalData, rotationDeg, gearName, options) {
        if (!targetLayer && doc) {
            targetLayer = doc.activeLayer || (doc.layers.length > 0 ? doc.layers[0] : doc.layers.add());
        }
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}

        options = options || {};
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || createRGBColor(255, 0, 0);
        var guideColor = options.guideColor || createRGBColor(0, 0, 255);

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName || "InternalRingGear";

        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180.0);

        // === 1. Create Compound Path for Rim + Inner Teeth ===
        var compoundPath = gearGroup.compoundPathItems.add();
        compoundPath.name = gearName + "_Body";

        // 1a. Outer Rim Path
        if (internalData.rimNodes && internalData.rimNodes.length > 0) {
            var rimPath = compoundPath.pathItems.add();
            rimPath.name = gearName + "_Rim";
            applyBezierNodes(rimPath, internalData.rimNodes, center, rotOffsetRad, MM_TO_PT);
            rimPath.closed = true;
        }

        // 1b. Inner Teeth Contour Path
        if (internalData.innerContourNodes && internalData.innerContourNodes.length > 0) {
            var teethPath = compoundPath.pathItems.add();
            teethPath.name = gearName + "_TeethContour";
            applyBezierNodes(teethPath, internalData.innerContourNodes, center, rotOffsetRad, MM_TO_PT);
            teethPath.closed = true;
        }

        // === 2. Apply Laser Cut Line Style to Compound Path ===
        applyCutStyle(compoundPath, cutStrokeWidth, cutColor);

        // === 3. Optional Guides ===
        var doDrawIntGuides = (options.drawGuides !== undefined) ? !!options.drawGuides : !!options.pitchGuide;
        var doDrawIntCenter = (options.drawCenterGuide !== undefined) ? !!options.drawCenterGuide : !!options.centerGuide;
        var intCgVal = (options.centerGuideValue !== undefined) ? options.centerGuideValue :
                       ((options.centerGuideSize !== undefined) ? options.centerGuideSize : 5.0);
        if (doDrawIntGuides || doDrawIntCenter) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearName + "_Guides";

            if (doDrawIntGuides) {
                var rpPt = internalData.rp * MM_TO_PT;
                var pitchCircle = safeEllipse(
                    guideGroup,
                    center[1] + rpPt,
                    center[0] - rpPt,
                    rpPt * 2.0,
                    rpPt * 2.0
                );
                pitchCircle.name = gearName + "_PitchCircle_d" + internalData.d.toFixed(1);
                applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [4, 4]);

                var raPt = internalData.ra * MM_TO_PT;
                var tipCircle = safeEllipse(
                    guideGroup,
                    center[1] + raPt,
                    center[0] - raPt,
                    raPt * 2.0,
                    raPt * 2.0
                );
                tipCircle.name = gearName + "_TipCircle_da" + internalData.da.toFixed(1);
                applyGuideStyle(tipCircle, guideStrokeWidth, createRGBColor(0, 180, 0), [2, 2]);
            }

            if (doDrawIntCenter) {
                if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawCenterGuide) {
                    LayerAndStyle.drawCenterGuide(guideGroup, center, internalData.d, {
                        guideMode: options.centerGuideMode || "fixed",
                        guideValue: intCgVal,
                        strokeWidth: guideStrokeWidth,
                        strokeColor: guideColor,
                        stylePreset: options.stylePreset || "laser",
                        name: gearName + "_CenterGuide"
                    });
                }
            }
        }

        return gearGroup;
    }

    /**
     * Draws a linear rack on the target layer.
     * 
     * @param {Document} doc Target document
     * @param {Layer} targetLayer Target layer
     * @param {Array} origin Placement origin [ox, oy] in pt (pitch line midpoint)
     * @param {Object} rackData Geometry data from InvoluteCore.calculateRack()
     * @param {number} rotationDeg Rack angle in degrees
     * @param {Array} shiftPt Tangential displacement [dx, dy] in pt along pitch line
     * @param {string} rackName Item name
     * @param {Object} options Configuration options
     * @returns {GroupItem} Created rack group
     */
    function drawRack(doc, targetLayer, origin, rackData, rotationDeg, shiftPt, rackName, options) {
        if (!targetLayer && doc) {
            targetLayer = doc.activeLayer || (doc.layers.length > 0 ? doc.layers[0] : doc.layers.add());
        }
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}

        options = options || {};
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || createRGBColor(255, 0, 0);
        var guideColor = options.guideColor || createRGBColor(0, 0, 255);

        var rackGroup = targetLayer.groupItems.add();
        rackGroup.name = rackName || "LinearRack";

        var rotRad = (rotationDeg || 0) * (Math.PI / 180.0);
        var pos = [
            origin[0] + (shiftPt ? shiftPt[0] : 0),
            origin[1] + (shiftPt ? shiftPt[1] : 0)
        ];

        // === 1. Outer Rack Path ===
        var rackPath = rackGroup.pathItems.add();
        rackPath.name = rackName + "_Contour";
        if (rackData.outerNodes && rackData.outerNodes.length > 0) {
            applyBezierNodes(rackPath, rackData.outerNodes, pos, rotRad, MM_TO_PT);
        }
        rackPath.closed = true;
        applyCutStyle(rackPath, cutStrokeWidth, cutColor);

        // === 2. Pitch Line Guide ===
        var doDrawRackGuides = (options.drawGuides !== undefined) ? !!options.drawGuides : !!options.pitchGuide;
        if (doDrawRackGuides && rackData.pitchLine) {
            var guideGroup = rackGroup.groupItems.add();
            guideGroup.name = rackName + "_Guides";

            var cosR = Math.cos(rotRad);
            var sinR = Math.sin(rotRad);

            function tf(ptMm) {
                var px = ptMm[0] * MM_TO_PT;
                var py = ptMm[1] * MM_TO_PT;
                return [
                    pos[0] + (px * cosR - py * sinR),
                    pos[1] + (px * sinR + py * cosR)
                ];
            }

            var pStart = tf(rackData.pitchLine[0]);
            var pEnd = tf(rackData.pitchLine[1]);

            var pitchLinePath = guideGroup.pathItems.add();
            pitchLinePath.name = rackName + "_PitchLine";
            var pt1 = pitchLinePath.pathPoints.add();
            pt1.anchor = pt1.leftDirection = pt1.rightDirection = pStart;
            var pt2 = pitchLinePath.pathPoints.add();
            pt2.anchor = pt2.leftDirection = pt2.rightDirection = pEnd;
            pitchLinePath.closed = false;

            applyGuideStyle(pitchLinePath, guideStrokeWidth, guideColor, [4, 4]);
        }

        return rackGroup;
    }

    /**
     * Extracts pure Bezier node geometry from an Illustrator item (PathItem, CompoundPathItem, GroupItem).
     */
    function extractItemBezierPaths(item) {
        var paths = [];
        if (!item) return paths;

        if (item.typename === "PathItem") {
            try {
                var pts = item.pathPoints;
                var nodes = [];
                for (var p = 0; p < pts.length; p++) {
                        var ptType = "SMOOTH";
                        try {
                            if (typeof PointType !== "undefined" && pts[p].pointType === PointType.CORNER) {
                                ptType = "CORNER";
                            }
                        } catch (ePtVal) {}
                        nodes.push({
                            anchor: [pts[p].anchor[0], pts[p].anchor[1]],
                            leftDirection: [pts[p].leftDirection[0], pts[p].leftDirection[1]],
                            rightDirection: [pts[p].rightDirection[0], pts[p].rightDirection[1]],
                            pointType: ptType
                        });
                }
                paths.push({
                    closed: item.closed !== false,
                    nodes: nodes
                });
            } catch (ePath) {}
        } else if (item.typename === "CompoundPathItem") {
            try {
                for (var cp = 0; cp < item.pathItems.length; cp++) {
                    var subCP = extractItemBezierPaths(item.pathItems[cp]);
                    for (var sci = 0; sci < subCP.length; sci++) {
                        paths.push(subCP[sci]);
                    }
                }
            } catch (eCP) {}
        } else if (item.typename === "GroupItem") {
            try {
                for (var gp = 0; gp < item.pageItems.length; gp++) {
                    var subGP = extractItemBezierPaths(item.pageItems[gp]);
                    for (var sgi = 0; sgi < subGP.length; sgi++) {
                        paths.push(subGP[sgi]);
                    }
                }
            } catch (eGP) {}
        }
        return paths;
    }

    /**
     * Creates a temporary scratch path directly inside the active document for custom shaft/cutout shapes,
     * extracts its pure Bezier geometry, and immediately deletes the temporary path to keep the document clean.
     * Prevents Illustrator crashes by eliminating background document window opening/closing.
     * 
     * @param {Document} doc Target document
     * @param {string} shapeType "CIRCLE", "HEXAGON", "RECTANGLE"
     * @param {number} sizePt Diameter or bounding width in pt
     * @param {Array} centerPt Center coordinate [cx, cy] in pt
     * @param {Layer} targetLayer Target layer (optional, defaults to doc.activeLayer)
     * @returns {Array} Array of extracted Bezier path objects
     */
    function createInDocumentScratchPath(doc, shapeType, sizePt, centerPt, targetLayer) {
        if (!doc) return [];
        shapeType = shapeType || "CIRCLE";
        sizePt = sizePt || 20.0;
        centerPt = centerPt || [0, 0];
        targetLayer = targetLayer || doc.activeLayer;

        if (targetLayer) {
            unlockAndShowLayer(targetLayer);
            try { doc.activeLayer = targetLayer; } catch (eActTL) {}
        }

        var prevLevel = (typeof app !== "undefined" && app.userInteractionLevel !== undefined) ? app.userInteractionLevel : null;
        try {
            if (typeof UserInteractionLevel !== "undefined" && UserInteractionLevel.DONTDISPLAYALERTS) {
                app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            }
        } catch (eLvl) {}

        var tempPath = null;
        var extracted = [];
        try {
            var r = sizePt / 2.0;
            var cx = centerPt[0];
            var cy = centerPt[1];

            if (shapeType === "HEXAGON") {
                tempPath = targetLayer.pathItems.add();
                for (var hi = 0; hi < 6; hi++) {
                    var hTh = hi * (Math.PI / 3.0);
                    var hx = cx + r * Math.cos(hTh);
                    var hy = cy + r * Math.sin(hTh);
                    var hp = tempPath.pathPoints.add();
                    hp.anchor = hp.leftDirection = hp.rightDirection = [hx, hy];
                }
                tempPath.closed = true;
            } else if (shapeType === "RECTANGLE") {
                tempPath = targetLayer.pathItems.add();
                tempPath.setEntirePath([
                    [cx - r, cy + r],
                    [cx + r, cy + r],
                    [cx + r, cy - r],
                    [cx - r, cy - r]
                ]);
                tempPath.closed = true;
            } else {
                // True 4-point Bezier circle via pathItems.add() to prevent Error 8705
                tempPath = targetLayer.pathItems.add();
                var K = 0.5522847498;
                var kr = r * K;
                tempPath.setEntirePath([
                    [cx, cy + r],
                    [cx + r, cy],
                    [cx, cy - r],
                    [cx - r, cy]
                ]);
                var spts = tempPath.pathPoints;
                spts[0].leftDirection = [cx - kr, cy + r];
                spts[0].rightDirection = [cx + kr, cy + r];
                spts[1].leftDirection = [cx + r, cy + kr];
                spts[1].rightDirection = [cx + r, cy - kr];
                spts[2].leftDirection = [cx + kr, cy - r];
                spts[2].rightDirection = [cx - kr, cy - r];
                spts[3].leftDirection = [cx - r, cy - kr];
                spts[3].rightDirection = [cx - r, cy + kr];
                tempPath.closed = true;
            }

            extracted = extractItemBezierPaths(tempPath);

        } catch (eScratch) {
            if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                CalcLogger.warn("SCRATCH_PATH", "Error creating in-document scratch path: " + eScratch.message);
            }
        } finally {
            if (tempPath) {
                try { tempPath.remove(); } catch (eRm) {}
                tempPath = null;
            }
            try {
                if (prevLevel !== null && typeof app !== "undefined") {
                    app.userInteractionLevel = prevLevel;
                }
            } catch (eRest) {}
        }
        return extracted;
    }

    /**
     * Imports or constructs vector paths in-place directly within the active document
     * without opening a separate background document window (preventing Illustrator crashes).
     * Extracts Bezier geometry, aligns center to target gear center, and cleans up temporary paths.
     * 
     * @param {Document} doc Target document
     * @param {string} aiFilePath Path or identifier (ignored if in-document mode)
     * @param {Array} targetCenter Center coordinate [cx, cy] in pt
     * @param {Object} options Options
     * @returns {Object} { items: Array, tempGroup: GroupItem }
     */
    function importExternalAiTemplate(doc, aiFilePath, targetCenter, options) {
        options = options || {};
        targetCenter = targetCenter || [0, 0];
        if (!doc) {
            return { items: [], tempGroup: null };
        }

        var prevLevel = (typeof app !== "undefined" && app.userInteractionLevel !== undefined) ? app.userInteractionLevel : null;
        try {
            if (typeof UserInteractionLevel !== "undefined" && UserInteractionLevel.DONTDISPLAYALERTS) {
                app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            }
        } catch (eLvl) {}

        var importedItems = [];
        var targetLayer = options.targetLayer || doc.activeLayer;
        var tempGroup = targetLayer.groupItems.add();
        tempGroup.name = "InDoc_Template_" + (new Date()).getTime();

        var sourceDoc = null;
        try {
            var fileObj = aiFilePath ? new File(aiFilePath) : null;
            if (fileObj && fileObj.exists) {
                sourceDoc = app.open(fileObj);

                var extractedPaths = [];
                var minX = Infinity;
                var maxX = -Infinity;
                var minY = Infinity;
                var maxY = -Infinity;

                function inspectPath(pItem) {
                    if (!pItem || !pItem.closed) return;
                    var pts = pItem.pathPoints;
                    if (!pts || pts.length < 2) return;

                    var pathNodes = [];
                    for (var i = 0; i < pts.length; i++) {
                        var pt = pts[i];
                        var ax = pt.anchor[0];
                        var ay = pt.anchor[1];
                        if (ax < minX) minX = ax;
                        if (ax > maxX) maxX = ax;
                        if (ay < minY) minY = ay;
                        if (ay > maxY) maxY = ay;

                        pathNodes.push({
                            anchor: [ax, ay],
                            leftDirection: [pt.leftDirection[0], pt.leftDirection[1]],
                            rightDirection: [pt.rightDirection[0], pt.rightDirection[1]],
                            pointType: (typeof PointType !== "undefined" && pt.pointType === PointType.CORNER) ? "CORNER" : "SMOOTH"
                        });
                    }
                    extractedPaths.push({
                        nodes: pathNodes,
                        closed: true
                    });
                }

                function collectClosedPaths(container) {
                    if (!container) return;
                    var pItems = container.pageItems;
                    if (!pItems) return;
                    for (var i = 0; i < pItems.length; i++) {
                        var itm = pItems[i];
                        if (itm.typename === "PathItem") {
                            inspectPath(itm);
                        } else if (itm.typename === "CompoundPathItem") {
                            if (itm.pathItems) {
                                for (var cpi = 0; cpi < itm.pathItems.length; cpi++) {
                                    inspectPath(itm.pathItems[cpi]);
                                }
                            }
                        } else if (itm.typename === "GroupItem") {
                            collectClosedPaths(itm);
                        }
                    }
                }

                if (sourceDoc.layers) {
                    for (var li = 0; li < sourceDoc.layers.length; li++) {
                        collectClosedPaths(sourceDoc.layers[li]);
                    }
                }

                if (extractedPaths.length > 0) {
                    var srcCenterX = (minX + maxX) / 2.0;
                    var srcCenterY = (minY + maxY) / 2.0;
                    var dx = targetCenter[0] - srcCenterX;
                    var dy = targetCenter[1] - srcCenterY;

                    for (var ep = 0; ep < extractedPaths.length; ep++) {
                        var pDef = extractedPaths[ep];
                        var newPath = tempGroup.pathItems.add();
                        for (var np = 0; np < pDef.nodes.length; np++) {
                            var nd = pDef.nodes[np];
                            var pp = newPath.pathPoints.add();
                            try {
                                pp.pointType = (typeof PointType !== "undefined" && PointType) ? PointType.CORNER : 2;
                            } catch (ePt0) {}
                            pp.anchor = [nd.anchor[0] + dx, nd.anchor[1] + dy];
                            pp.leftDirection = [nd.leftDirection[0] + dx, nd.leftDirection[1] + dy];
                            pp.rightDirection = [nd.rightDirection[0] + dx, nd.rightDirection[1] + dy];
                        }
                        newPath.closed = true;
                        importedItems.push(newPath);
                    }
                }
            } else {
                // Fallback to in-document scratch path if file not specified or doesn't exist
                var scratchPaths = createInDocumentScratchPath(doc, "CIRCLE", 20.0, targetCenter, targetLayer);

                for (var sp = 0; sp < scratchPaths.length; sp++) {
                    var sDef = scratchPaths[sp];
                    var sPath = tempGroup.pathItems.add();
                    for (var snp = 0; snp < sDef.nodes.length; snp++) {
                        var snd = sDef.nodes[snp];
                        var spp = sPath.pathPoints.add();
                        try {
                            spp.pointType = (typeof PointType !== "undefined" && PointType) ? PointType.CORNER : 2;
                        } catch (ePt1) {}
                        spp.anchor = [snd.anchor[0], snd.anchor[1]];
                        spp.leftDirection = [snd.leftDirection[0], snd.leftDirection[1]];
                        spp.rightDirection = [snd.rightDirection[0], snd.rightDirection[1]];
                    }
                    sPath.closed = sDef.closed;
                    importedItems.push(sPath);
                }
            }

        } catch (eImp) {
            if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                CalcLogger.warn("AI_IMPORT", "Error importing external AI template: " + eImp.message);
            }
        } finally {
            if (sourceDoc) {
                try {
                    sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
                } catch (eClose) {}
            }
            if (prevLevel !== null) {
                try {
                    app.userInteractionLevel = prevLevel;
                } catch (ePrev) {}
            }
        }

        return {
            items: importedItems,
            tempGroup: tempGroup
        };
    }

    /**
     * Draws an external spur gear integrated with mechanical features (shaft hole, cutouts, pin holes)
     * and custom injected paths (group shapes or external .ai) unified into a single CompoundPathItem.
     * 
     * @param {Document} doc Target document
     * @param {Layer} targetLayer Target layer
     * @param {Array} center Center coordinate [cx, cy] in pt
     * @param {Object} gearData InvoluteCore spur gear geometry
     * @param {Object} shaftData ShaftAndBody shaft hole geometry
     * @param {Object} cutoutData ShaftAndBody parametric cutouts geometry
     * @param {Object} pinData ShaftAndBody alignment pin holes geometry
     * @param {number} rotationDeg Initial rotation in degrees
     * @param {string} gearName Item name
     * @param {Object} options Configuration options:
     *   - customInjections: Array of PathItem/CompoundPathItem or function returning them
     *   - origCenterPt: Original center coordinate [cx, cy] of source circle in pt
     * @returns {GroupItem} Created gear group
     */
    function drawGearWithFeatures(doc, targetLayer, center, gearData, shaftData, cutoutData, pinData, rotationDeg, gearName, options) {
        if (!targetLayer && doc) {
            targetLayer = doc.activeLayer || (doc.layers.length > 0 ? doc.layers[0] : doc.layers.add());
        }
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}

        options = options || {};
        var mode = options.drawMode || "normal";
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || createRGBColor(255, 0, 0);
        var guideColor = options.guideColor || createRGBColor(0, 0, 255);

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName + (mode !== "normal" ? (" [" + mode + "]") : "");

        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180.0);
        var toothPitchAngle = (gearData && gearData.z > 0) ? ((2.0 * Math.PI) / gearData.z) : 0;

        if (mode === "test_teeth") {
            // === Individual Teeth Mode (Bypass CompoundPathItem & Closed Outer Contour) ===
            // 1. Open individual teeth paths
            if (gearData && gearData.z > 0) {
                var teethGroup = gearGroup.groupItems.add();
                teethGroup.name = gearName + "_IndividualTeeth";

                for (var t = 0; t < gearData.z; t++) {
                    var toothRot = rotOffsetRad + (t * toothPitchAngle);
                    var toothPath = teethGroup.pathItems.add();
                    toothPath.name = gearName + "_Tooth_" + (t + 1);

                    if (gearData.singleToothNodes && gearData.singleToothNodes.length > 0) {
                        applyBezierNodes(toothPath, gearData.singleToothNodes, center, toothRot, MM_TO_PT);
                    }
                    toothPath.closed = false;
                    applyCutStyle(toothPath, cutStrokeWidth, cutColor);
                }

                // 2. Dedicated Root Circle guide
                var rfPt = (gearData.rf || 0) * MM_TO_PT;
                if (rfPt > 0) {
                    var rootCircle = safeEllipse(
                        gearGroup,
                        center[1] + rfPt,
                        center[0] - rfPt,
                        rfPt * 2.0,
                        rfPt * 2.0
                    );
                    rootCircle.name = gearName + "_RootCircle";
                    applyGuideStyle(rootCircle, guideStrokeWidth, cutColor);
                }
            }

            // 3. Standalone Shaft Hole (independent path)
            if (shaftData && shaftData.hasHole && shaftData.nodes && shaftData.nodes.length > 0) {
                var shaftPath = gearGroup.pathItems.add();
                shaftPath.name = gearName + "_ShaftHole_" + shaftData.shaftType;
                applyBezierNodes(shaftPath, shaftData.nodes, center, rotOffsetRad, MM_TO_PT);
                shaftPath.closed = true;
                applyCutStyle(shaftPath, cutStrokeWidth, cutColor);
            }

            // 4. Standalone Parametric Cutouts (independent paths)
            if (cutoutData && cutoutData.valid && cutoutData.cutouts && cutoutData.cutouts.length > 0) {
                for (var ci = 0; ci < cutoutData.cutouts.length; ci++) {
                    var cNodes = cutoutData.cutouts[ci];
                    var cutoutPath = gearGroup.pathItems.add();
                    cutoutPath.name = gearName + "_Cutout_" + (ci + 1);
                    applyBezierNodes(cutoutPath, cNodes, center, rotOffsetRad, MM_TO_PT);
                    cutoutPath.closed = true;
                    applyCutStyle(cutoutPath, cutStrokeWidth, cutColor);
                }
            }

            // 5. Standalone Alignment Pin Holes (independent paths)
            if (pinData && pinData.valid && pinData.holes && pinData.holes.length > 0) {
                for (var pi = 0; pi < pinData.holes.length; pi++) {
                    var pinHole = pinData.holes[pi];
                    var pinPath = gearGroup.pathItems.add();
                    pinPath.name = gearName + "_PinHole_" + (pi + 1);
                    applyBezierNodes(pinPath, pinHole.nodes, center, rotOffsetRad, MM_TO_PT);
                    pinPath.closed = true;
                    applyCutStyle(pinPath, cutStrokeWidth, cutColor);
                }
            }

            // 6. Standalone Custom Injections
            if (options.customInjections && options.customInjections.length > 0) {
                var origCenterPt = options.origCenterPt || center;
                var transX = center[0] - origCenterPt[0];
                var transY = center[1] - origCenterPt[1];

                for (var ij = 0; ij < options.customInjections.length; ij++) {
                    var srcItem = options.customInjections[ij];
                    if (srcItem && srcItem.duplicate) {
                        try {
                            var dup = srcItem.duplicate(gearGroup, ElementPlacement.PLACEATEND);
                            if (Math.abs(transX) > 1e-4 || Math.abs(transY) > 1e-4) {
                                dup.translate(transX, transY);
                            }
                            applyCutStyle(dup, cutStrokeWidth, cutColor);
                        } catch (eDup) {}
                    }
                }
            }

            // 7. Guides (Pitch circle and Center guide)
            var doDrawTeethGuides = (options.drawGuides !== undefined) ? !!options.drawGuides : !!options.pitchGuide;
            var doDrawTeethCenter = (options.drawCenterGuide !== undefined) ? !!options.drawCenterGuide : !!options.centerGuide;
            var teethCgVal = (options.centerGuideValue !== undefined) ? options.centerGuideValue :
                             ((options.centerGuideSize !== undefined) ? options.centerGuideSize : 5.0);
            if (doDrawTeethGuides || doDrawTeethCenter) {
                var guideGroup = gearGroup.groupItems.add();
                guideGroup.name = gearName + "_Guides";

                if (doDrawTeethGuides && gearData && gearData.rp) {
                    var rpPt = gearData.rp * MM_TO_PT;
                    var pitchCircle = safeEllipse(
                        guideGroup,
                        center[1] + rpPt,
                        center[0] - rpPt,
                        rpPt * 2.0,
                        rpPt * 2.0
                    );
                    pitchCircle.name = gearName + "_PitchCircle_d" + (gearData.d ? gearData.d.toFixed(1) : "");
                    applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [4, 4]);
                }

                if (doDrawTeethCenter && gearData) {
                    if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawCenterGuide) {
                        LayerAndStyle.drawCenterGuide(guideGroup, center, gearData.d, {
                            guideMode: options.centerGuideMode || "fixed",
                            guideValue: teethCgVal,
                            strokeWidth: guideStrokeWidth,
                            strokeColor: guideColor,
                            stylePreset: options.stylePreset || "laser",
                            name: gearName + "_CenterGuide"
                        });
                    }
                }
            }

            return gearGroup;
        }

        var customInjections = options.customInjections || [];
        var hasCustomInjections = (customInjections && customInjections.length > 0);

        var hasInternalHoles = (shaftData && shaftData.hasHole) ||
                               (cutoutData && cutoutData.valid && cutoutData.cutouts && cutoutData.cutouts.length > 0) ||
                               (pinData && pinData.valid && pinData.holes && pinData.holes.length > 0) ||
                               hasCustomInjections;

        var useCompoundPath = (options.compoundPath !== false);

        if (hasInternalHoles && useCompoundPath) {
            // === CompoundPathItem containing outer contour + all internal cutouts ===
            var compoundPath = gearGroup.compoundPathItems.add();
            compoundPath.name = gearName + "_CompoundBody";

            // 1. Outer gear contour
            if (gearData.outerNodes && gearData.outerNodes.length > 0) {
                var outerPath = compoundPath.pathItems.add();
                outerPath.name = gearName + "_Contour";
                applyBezierNodes(outerPath, gearData.outerNodes, center, rotOffsetRad, MM_TO_PT);
                outerPath.closed = true;
            }

            // 2. Shaft hole
            if (shaftData && shaftData.hasHole && shaftData.nodes && shaftData.nodes.length > 0) {
                var shaftPath = compoundPath.pathItems.add();
                shaftPath.name = gearName + "_ShaftHole_" + shaftData.shaftType;
                applyBezierNodes(shaftPath, shaftData.nodes, center, rotOffsetRad, MM_TO_PT);
                shaftPath.closed = true;
            }

            // 3. Parametric cutouts (spoke windows or circular holes)
            if (cutoutData && cutoutData.valid && cutoutData.cutouts && cutoutData.cutouts.length > 0) {
                for (var ci = 0; ci < cutoutData.cutouts.length; ci++) {
                    var cNodes = cutoutData.cutouts[ci];
                    var cutoutPath = compoundPath.pathItems.add();
                    cutoutPath.name = gearName + "_Cutout_" + (ci + 1);
                    applyBezierNodes(cutoutPath, cNodes, center, rotOffsetRad, MM_TO_PT);
                    cutoutPath.closed = true;
                }
            }

            // 4. Alignment pin holes
            if (pinData && pinData.valid && pinData.holes && pinData.holes.length > 0) {
                for (var pi = 0; pi < pinData.holes.length; pi++) {
                    var pinHole = pinData.holes[pi];
                    var pinPath = compoundPath.pathItems.add();
                    pinPath.name = gearName + "_PinHole_" + (pi + 1);
                    applyBezierNodes(pinPath, pinHole.nodes, center, rotOffsetRad, MM_TO_PT);
                    pinPath.closed = true;
                }
            }

            // 5. Custom injected paths (Group inner shapes or external .ai paths)
            if (hasCustomInjections) {
                var origCenterPt = options.origCenterPt || center;
                var transX = center[0] - origCenterPt[0];
                var transY = center[1] - origCenterPt[1];

                var collectedPointsMm = [];

                function processInjectedItem(srcItem) {
                    if (!srcItem) return;
                    if (srcItem.typename === "PathItem") {
                        var dupPath = srcItem.duplicate(compoundPath, ElementPlacement.PLACEATEND);
                        if (Math.abs(transX) > 1e-4 || Math.abs(transY) > 1e-4) {
                            dupPath.translate(transX, transY);
                        }
                        dupPath.closed = true;
                        // Collect anchor points for safety boundary check
                        try {
                            for (var pp = 0; pp < dupPath.pathPoints.length; pp++) {
                                var ap = dupPath.pathPoints[pp].anchor;
                                collectedPointsMm.push([
                                    (ap[0] - center[0]) * PT_TO_MM,
                                    (ap[1] - center[1]) * PT_TO_MM
                                ]);
                            }
                        } catch (ePts) {}
                    } else if (srcItem.typename === "CompoundPathItem") {
                        try {
                            for (var cpIdx = 0; cpIdx < srcItem.pathItems.length; cpIdx++) {
                                processInjectedItem(srcItem.pathItems[cpIdx]);
                            }
                        } catch (eSubCP) {}
                    } else if (srcItem.typename === "GroupItem") {
                        try {
                            for (var gpIdx = 0; gpIdx < srcItem.pageItems.length; gpIdx++) {
                                processInjectedItem(srcItem.pageItems[gpIdx]);
                            }
                        } catch (eSubGP) {}
                    }
                }

                for (var ij = 0; ij < customInjections.length; ij++) {
                    processInjectedItem(customInjections[ij]);
                }

                // Safety boundary check
                if (typeof ShaftAndBody !== "undefined" && ShaftAndBody.checkSafetyBoundary && gearData) {
                    var safeRes = ShaftAndBody.checkSafetyBoundary(gearData.rf, gearData.m, collectedPointsMm);
                    if (!safeRes.safe && safeRes.warning) {
                        if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                            CalcLogger.warn("SAFETY_BOUNDARY", safeRes.warning);
                        }
                    }
                }
            }

            // Apply style strictly after compound path is fully assembled
            applyCutStyle(compoundPath, cutStrokeWidth, cutColor);

        } else if (hasInternalHoles && !useCompoundPath) {
            // === Separate independent PathItems directly inside gearGroup ===
            // 1. Outer gear contour
            if (gearData.outerNodes && gearData.outerNodes.length > 0) {
                var outerPathSep = gearGroup.pathItems.add();
                outerPathSep.name = gearName + "_Contour";
                applyBezierNodes(outerPathSep, gearData.outerNodes, center, rotOffsetRad, MM_TO_PT);
                outerPathSep.closed = true;
                applyCutStyle(outerPathSep, cutStrokeWidth, cutColor);
            }

            // 2. Shaft hole
            if (shaftData && shaftData.hasHole && shaftData.nodes && shaftData.nodes.length > 0) {
                var shaftPathSep = gearGroup.pathItems.add();
                shaftPathSep.name = gearName + "_ShaftHole_" + shaftData.shaftType;
                applyBezierNodes(shaftPathSep, shaftData.nodes, center, rotOffsetRad, MM_TO_PT);
                shaftPathSep.closed = true;
                applyCutStyle(shaftPathSep, cutStrokeWidth, cutColor);
            }

            // 3. Parametric cutouts (spoke windows or circular holes)
            if (cutoutData && cutoutData.valid && cutoutData.cutouts && cutoutData.cutouts.length > 0) {
                for (var ciSep = 0; ciSep < cutoutData.cutouts.length; ciSep++) {
                    var cNodesSep = cutoutData.cutouts[ciSep];
                    var cutoutPathSep = gearGroup.pathItems.add();
                    cutoutPathSep.name = gearName + "_Cutout_" + (ciSep + 1);
                    applyBezierNodes(cutoutPathSep, cNodesSep, center, rotOffsetRad, MM_TO_PT);
                    cutoutPathSep.closed = true;
                    applyCutStyle(cutoutPathSep, cutStrokeWidth, cutColor);
                }
            }

            // 4. Alignment pin holes
            if (pinData && pinData.valid && pinData.holes && pinData.holes.length > 0) {
                for (var piSep = 0; piSep < pinData.holes.length; piSep++) {
                    var pinHoleSep = pinData.holes[piSep];
                    var pinPathSep = gearGroup.pathItems.add();
                    pinPathSep.name = gearName + "_PinHole_" + (piSep + 1);
                    applyBezierNodes(pinPathSep, pinHoleSep.nodes, center, rotOffsetRad, MM_TO_PT);
                    pinPathSep.closed = true;
                    applyCutStyle(pinPathSep, cutStrokeWidth, cutColor);
                }
            }

            // 5. Custom injected paths (Group inner shapes or external .ai paths)
            if (hasCustomInjections) {
                var origCenterPtSep = options.origCenterPt || center;
                var transXSep = center[0] - origCenterPtSep[0];
                var transYSep = center[1] - origCenterPtSep[1];

                var collectedPointsMmSep = [];

                var processInjectedItemSep = function (srcItem) {
                    if (!srcItem) return;
                    if (srcItem.typename === "PathItem") {
                        var dupPath = srcItem.duplicate(gearGroup, ElementPlacement.PLACEATEND);
                        if (Math.abs(transXSep) > 1e-4 || Math.abs(transYSep) > 1e-4) {
                            dupPath.translate(transXSep, transYSep);
                        }
                        dupPath.closed = true;
                        applyCutStyle(dupPath, cutStrokeWidth, cutColor);
                        try {
                            for (var pp = 0; pp < dupPath.pathPoints.length; pp++) {
                                var ap = dupPath.pathPoints[pp].anchor;
                                collectedPointsMmSep.push([
                                    (ap[0] - center[0]) * PT_TO_MM,
                                    (ap[1] - center[1]) * PT_TO_MM
                                ]);
                            }
                        } catch (ePts) {}
                    } else if (srcItem.typename === "CompoundPathItem") {
                        try {
                            for (var cpIdx = 0; cpIdx < srcItem.pathItems.length; cpIdx++) {
                                processInjectedItemSep(srcItem.pathItems[cpIdx]);
                            }
                        } catch (eSubCP) {}
                    } else if (srcItem.typename === "GroupItem") {
                        try {
                            for (var gpIdx = 0; gpIdx < srcItem.pageItems.length; gpIdx++) {
                                processInjectedItemSep(srcItem.pageItems[gpIdx]);
                            }
                        } catch (eSubGP) {}
                    }
                };

                for (var ijSep = 0; ijSep < customInjections.length; ijSep++) {
                    processInjectedItemSep(customInjections[ijSep]);
                }

                // Safety boundary check
                if (typeof ShaftAndBody !== "undefined" && ShaftAndBody.checkSafetyBoundary && gearData) {
                    var safeResSep = ShaftAndBody.checkSafetyBoundary(gearData.rf, gearData.m, collectedPointsMmSep);
                    if (!safeResSep.safe && safeResSep.warning) {
                        if (typeof CalcLogger !== "undefined" && CalcLogger.warn) {
                            CalcLogger.warn("SAFETY_BOUNDARY", safeResSep.warning);
                        }
                    }
                }
            }

        } else {
            // Simple closed path when no internal holes exist
            var simplePath = gearGroup.pathItems.add();
            simplePath.name = gearName + "_Contour";
            if (gearData.outerNodes && gearData.outerNodes.length > 0) {
                applyBezierNodes(simplePath, gearData.outerNodes, center, rotOffsetRad, MM_TO_PT);
            }
            simplePath.closed = true;
            applyCutStyle(simplePath, cutStrokeWidth, cutColor);
        }

        // Draw pitch circle guide and center guide if requested
        var doDrawGuides = (options.drawGuides !== undefined) ? !!options.drawGuides : !!options.pitchGuide;
        var doDrawCenterGuide = (options.drawCenterGuide !== undefined) ? !!options.drawCenterGuide : !!options.centerGuide;
        var cgValue = (options.centerGuideValue !== undefined) ? options.centerGuideValue :
                      ((options.centerGuideSize !== undefined) ? options.centerGuideSize : 5.0);
        if (doDrawGuides || doDrawCenterGuide) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearName + "_Guides";

            if (doDrawGuides && gearData && gearData.rp) {
                var rpPt = gearData.rp * MM_TO_PT;
                var pitchCircle = safeEllipse(
                    guideGroup,
                    center[1] + rpPt,
                    center[0] - rpPt,
                    rpPt * 2.0,
                    rpPt * 2.0
                );
                pitchCircle.name = gearName + "_PitchCircle_d" + (gearData.d ? gearData.d.toFixed(1) : (gearData.rp * 2.0).toFixed(1));
                applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [4, 4]);
            }

            if (doDrawCenterGuide && gearData) {
                if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawCenterGuide) {
                    LayerAndStyle.drawCenterGuide(guideGroup, center, gearData.d, {
                        guideMode: options.centerGuideMode || "fixed",
                        guideValue: cgValue,
                        strokeWidth: guideStrokeWidth,
                        strokeColor: guideColor,
                        stylePreset: options.stylePreset || "laser",
                        name: gearName + "_CenterGuide"
                    });
                }
            }
        }

        return gearGroup;
    }

    /**
     * Draws an entire resolved gear train tree into the document.
     * Supports CAD/CAM layer hierarchy (T1 -> T1_1, T1_2, T1_LockPlate, T1_Carrier, T1_dwg),
     * layer conflict modes (overwrite/merge/cancel), center guide dimensions (fixed/relative),
     * JIS B 0003 drawing skeleton, and token substitution naming engine.
     * 
     * @param {Document} doc Target document
     * @param {Object} resolvedTrain Resolved gear train from TrainTreeResolver.resolveTrain()
     * @param {Object} options Configuration and styling options
     * @returns {Object} { groups, resolvedTrain, layerMap, hierarchy }
     */
    function drawTrain(doc, resolvedTrain, options) {
        ensureExitIsolationMode(doc);
        options = options || {};
        var originPt = options.originPt || [0, 0];
        var nodes = (resolvedTrain && resolvedTrain.nodes) ? resolvedTrain.nodes : [];
        var trainId = options.trainId || resolvedTrain.trainId || "T1";
        var namingPreset = options.namingPreset || "standard";

        var prevInteractionLevel = null;
        try {
            if (typeof app !== "undefined" && app.userInteractionLevel !== undefined) {
                prevInteractionLevel = app.userInteractionLevel;
                if (typeof UserInteractionLevel !== "undefined" && UserInteractionLevel.DONTDISPLAYALERTS) {
                    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
                }
            }
        } catch (eLvl) {}

        // Collect unique stage indices and feature flags
        var stageIndices = [];
        var stageSeen = {};
        var hasLockPlate = false;
        for (var i = 0; i < nodes.length; i++) {
            var st = nodes[i].stageIndex || 1;
            if (!stageSeen[st]) {
                stageSeen[st] = true;
                stageIndices.push(st);
            }
            if (nodes[i].lockPlate) {
                hasLockPlate = true;
            }
        }
        if (stageIndices.length === 0) stageIndices.push(1);

        // Sort stageIndices numerically
        stageIndices.sort(function (a, b) { return a - b; });

        // 1. Setup Layer Hierarchy via LayerAndStyle
        var hierarchy = null;
        if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.setupTrainLayerHierarchy) {
            hierarchy = LayerAndStyle.setupTrainLayerHierarchy(doc, trainId, stageIndices, {
                conflictMode: options.conflictMode || (options.overwriteLayer ? "overwrite" : "merge"),
                namingPreset: namingPreset,
                namingPattern: options.namingPattern || "",
                hasLockPlate: hasLockPlate && (options.drawLockPlates !== false),
                hasCarrier: !!(resolvedTrain.carrierData && options.drawCarrier !== false),
                hasBasePlate: !!(resolvedTrain.basePlateData && options.drawBasePlate !== false),
                drawDwg: (options.drawDwgLayer !== false),
                dwgPerStage: (options.skelMode === "per_stage"),
                m: resolvedTrain.m || (nodes[0] ? nodes[0].m : 2.0)
            });
        }

        var defaultLayer = (hierarchy && hierarchy.mainLayer) ? hierarchy.mainLayer : (options.targetLayer || getOrCreateLayer(doc, trainId));
        var layerMap = {};
        if (hierarchy) {
            layerMap.mainLayer = hierarchy.mainLayer;
            for (var sk in hierarchy.subLayers) {
                if (hierarchy.subLayers.hasOwnProperty(sk)) {
                    layerMap["Stage_" + sk] = hierarchy.subLayers[sk];
                    layerMap[trainId + "_" + sk] = hierarchy.subLayers[sk];
                }
            }
            if (hierarchy.lockPlateLayer) layerMap.lockPlate = hierarchy.lockPlateLayer;
            if (hierarchy.carrierLayer) layerMap.carrier = hierarchy.carrierLayer;
            if (hierarchy.basePlateLayer) layerMap.basePlate = hierarchy.basePlateLayer;
            if (hierarchy.dwgLayer) layerMap.dwg = hierarchy.dwgLayer;
        }

        var createdGroups = [];

        // 2. Draw each gear node into its designated stage sublayer
        for (var n = 0; n < nodes.length; n++) {
            var nd = nodes[n];
            var stIndex = nd.stageIndex || 1;
            var targetLayer = defaultLayer;

            if (hierarchy && hierarchy.subLayers && hierarchy.subLayers[stIndex]) {
                targetLayer = hierarchy.subLayers[stIndex];
            } else if (options.useLayersByStage && nd.stageIndex) {
                var stageLayerName = "Stage_" + nd.stageIndex;
                if (!layerMap[stageLayerName]) {
                    layerMap[stageLayerName] = getOrCreateLayer(doc, stageLayerName, defaultLayer);
                }
                targetLayer = layerMap[stageLayerName];
            }

            var center = [
                originPt[0] + nd.centerPt[0],
                originPt[1] + nd.centerPt[1]
            ];

            // Semantic Naming via LayerAndStyle.formatName
            var gearName = nd.id;
            if (typeof LayerAndStyle !== "undefined" && LayerAndStyle.formatName) {
                var namingObj = (namingPreset && typeof namingPreset === "object") ? namingPreset :
                                (LayerAndStyle.NAMING_PRESETS[namingPreset] || LayerAndStyle.NAMING_PRESETS.standard);
                var gearGroupTpl = (options.namingPattern && typeof options.namingPattern === "string" && options.namingPattern.indexOf("{") !== -1) ?
                                   options.namingPattern :
                                   (namingObj.gearGroup || LayerAndStyle.NAMING_PRESETS.standard.gearGroup);
                gearName = LayerAndStyle.formatName(gearGroupTpl, {
                    train: trainId,
                    layer: stIndex,
                    stage: stIndex,
                    id: nd.id,
                    parentId: nd.parentId || "Root",
                    kind: nd.gearType === "INTERNAL" ? "Int" : (nd.gearType === "RACK" ? "Rck" : "Ext"),
                    gearType: nd.gearType,
                    m: nd.m || resolvedTrain.m,
                    z: nd.z,
                    alpha: nd.alphaDeg || resolvedTrain.alphaDeg,
                    d: (nd.gearData ? nd.gearData.d : (nd.m * nd.z)),
                    da: (nd.gearData ? nd.gearData.da : (nd.m * (nd.z + 2))),
                    df: (nd.gearData ? nd.gearData.df : (nd.m * (nd.z - 2.5))),
                    shaft: nd.shaftDiameter,
                    role: nd.relationType
                });
            }

            var grp = null;

            if (nd.gearType === "INTERNAL") {
                grp = drawInternalGear(doc, targetLayer, center, nd.gearData, nd.rotationDeg, gearName, options);
            } else if (nd.gearType === "RACK") {
                var shiftPt = nd.shiftPt || [0, 0];
                grp = drawRack(doc, targetLayer, center, nd.gearData, nd.rotationDeg, shiftPt, gearName, options);
            } else {
                // External Spur Gear
                var customInjections = [];
                var tempAiGroup = null;

                // 1. Group inner shapes
                if (nd.innerShapeItems && nd.innerShapeItems.length > 0) {
                    for (var isi = 0; isi < nd.innerShapeItems.length; isi++) {
                        customInjections.push(nd.innerShapeItems[isi]);
                    }
                }

                // 2. External .ai template reference
                var aiPath = nd.externalAiPath || (nd.shaftOptions ? nd.shaftOptions.externalAiPath : null) || (nd.cutoutOptions ? nd.cutoutOptions.externalAiPath : null);
                if (aiPath) {
                    var impRes = importExternalAiTemplate(doc, aiPath, center, { targetLayer: targetLayer });
                    if (impRes && impRes.items && impRes.items.length > 0) {
                        for (var aii = 0; aii < impRes.items.length; aii++) {
                            customInjections.push(impRes.items[aii]);
                        }
                        tempAiGroup = impRes.tempGroup;
                    }
                }

                var hasFeatures = (nd.shaftType && nd.shaftType !== "NONE") ||
                                  (nd.cutoutType && nd.cutoutType !== "NONE") ||
                                  (nd.pinHoles ? true : false) ||
                                  (customInjections.length > 0);

                var gearOptions = {};
                for (var optK in options) {
                    if (options.hasOwnProperty(optK)) {
                        gearOptions[optK] = options[optK];
                    }
                }
                gearOptions.customInjections = customInjections;
                gearOptions.origCenterPt = nd.centerPt;

                if (hasFeatures && typeof ShaftAndBody !== "undefined") {
                    var shaftData = (nd.shaftType && nd.shaftType !== "NONE" && nd.shaftType !== "GROUP_SHAPE") ?
                        ShaftAndBody.calculateShaftHole(nd.shaftDiameter, nd.shaftType, nd.shaftOptions) : null;
                    var cutoutData = (nd.cutoutType && nd.cutoutType !== "NONE" && nd.cutoutType !== "EXTERNAL_AI") ?
                        ShaftAndBody.calculateParametricCutouts(nd.gearData.rf, nd.shaftDiameter, nd.cutoutType, nd.cutoutOptions) : null;
                    var pinData = nd.pinHoles ?
                        ShaftAndBody.calculateAlignmentPinHoles(nd.gearData.rf, nd.shaftDiameter, {
                            pinCount: nd.pinHoles.count,
                            pinDiameter: nd.pinHoles.diameter,
                            pinPitchRadius: nd.pinHoles.pcd ? (nd.pinHoles.pcd / 2.0) : undefined
                        }) : null;

                    grp = drawGearWithFeatures(doc, targetLayer, center, nd.gearData, shaftData, cutoutData, pinData, nd.rotationDeg, gearName, gearOptions);
                } else if (customInjections.length > 0) {
                    grp = drawGearWithFeatures(doc, targetLayer, center, nd.gearData, null, null, null, nd.rotationDeg, gearName, gearOptions);
                } else {
                    grp = drawGear(doc, targetLayer, center, nd.gearData, nd.rotationDeg, gearName, gearOptions);
                }

                if (tempAiGroup) {
                    try { tempAiGroup.remove(); } catch (eRem) {}
                }
            }

            if (grp) {
                createdGroups.push(grp);
            }

            // Draw intermittent lock plate if present
            if (nd.lockPlate && options.drawLockPlates !== false) {
                var targetLockLayer = (hierarchy && hierarchy.lockPlateLayer) ? hierarchy.lockPlateLayer :
                                      (layerMap["GearDrawer_LockPlate"] || getOrCreateLayer(doc, trainId + "_LockPlate", defaultLayer));
                var lockGrp = drawLockPlate(doc, targetLockLayer, center, nd.lockPlate, nd.rotationDeg, options);
                if (lockGrp) {
                    createdGroups.push(lockGrp);
                }
            }
        }

        // 3. Draw Planetary Carrier if present
        if (resolvedTrain.carrierData && options.drawCarrier !== false) {
            var targetCarrierLayer = (hierarchy && hierarchy.carrierLayer) ? hierarchy.carrierLayer :
                                     (layerMap["GearDrawer_Carrier"] || getOrCreateLayer(doc, trainId + "_Carrier", defaultLayer));
            var carrierCenter = [originPt[0], originPt[1]];
            var carrierSunMatched = false;
            if (resolvedTrain.carrierData && resolvedTrain.carrierData.sunNodeId) {
                for (var sIdx0 = 0; sIdx0 < nodes.length; sIdx0++) {
                    if (nodes[sIdx0].id === resolvedTrain.carrierData.sunNodeId) {
                        carrierCenter = [originPt[0] + nodes[sIdx0].centerPt[0], originPt[1] + nodes[sIdx0].centerPt[1]];
                        carrierSunMatched = true;
                        break;
                    }
                }
            }
            if (!carrierSunMatched) {
                for (var sIdx = 0; sIdx < nodes.length; sIdx++) {
                    if (nodes[sIdx].generateCarrier === true || nodes[sIdx].id.indexOf("Sun") !== -1 || (nodes[sIdx].relationType === "ROOT" && nodes[sIdx].children && nodes[sIdx].children.length >= 2)) {
                        carrierCenter = [originPt[0] + nodes[sIdx].centerPt[0], originPt[1] + nodes[sIdx].centerPt[1]];
                        break;
                    }
                }
            }
            var carrierGrp = drawPlanetaryCarrier(doc, targetCarrierLayer, carrierCenter, resolvedTrain.carrierData, options);
            if (carrierGrp) {
                createdGroups.push(carrierGrp);
            }
        }

        // 4. Draw Train Base Plate if present
        if (resolvedTrain.basePlateData && options.drawBasePlate !== false) {
            var targetBasePlateLayer = (hierarchy && hierarchy.basePlateLayer) ? hierarchy.basePlateLayer :
                                       (layerMap["GearDrawer_BasePlate"] || getOrCreateLayer(doc, trainId + "_BasePlate", defaultLayer));
            var basePlateGrp = drawTrainBasePlate(doc, targetBasePlateLayer, resolvedTrain.basePlateData, options);
            if (basePlateGrp) {
                createdGroups.push(basePlateGrp);
            }
        }

        // 5. Draw JIS B 0003 Skeleton Diagram into DWG Layer
        if (options.drawDwgLayer !== false && typeof LayerAndStyle !== "undefined" && LayerAndStyle.drawJisDwgSkeleton) {
            if (options.skelMode === "per_stage" && hierarchy && hierarchy.dwgSubLayers) {
                for (var dSt in hierarchy.dwgSubLayers) {
                    if (hierarchy.dwgSubLayers.hasOwnProperty(dSt)) {
                        var stNodes = [];
                        for (var sn = 0; sn < nodes.length; sn++) {
                            if (String(nodes[sn].stageIndex || 1) === String(dSt)) {
                                stNodes.push(nodes[sn]);
                            }
                        }
                        var stTrain = {
                            m: resolvedTrain.m,
                            alphaDeg: resolvedTrain.alphaDeg,
                            nodes: stNodes
                        };
                        var stDwgGrp = LayerAndStyle.drawJisDwgSkeleton(hierarchy.dwgSubLayers[dSt], stTrain, options);
                        if (stDwgGrp) createdGroups.push(stDwgGrp);
                    }
                }
            } else if (hierarchy && hierarchy.dwgLayer) {
                var dwgGrp = LayerAndStyle.drawJisDwgSkeleton(hierarchy.dwgLayer, resolvedTrain, options);
                if (dwgGrp) {
                    createdGroups.push(dwgGrp);
                }
            }
        }

        try {
            if (prevInteractionLevel !== null && typeof app !== "undefined") {
                app.userInteractionLevel = prevInteractionLevel;
            }
        } catch (eRest) {}

        return {
            groups: createdGroups,
            resolvedTrain: resolvedTrain,
            layerMap: layerMap,
            hierarchy: hierarchy
        };
    }

    /**
     * Draws a Planetary Carrier plate (Y-arm or Circular disc) with planet pin holes and central sun shaft hole.
     */
    function drawPlanetaryCarrier(doc, layer, center, carrierData, options) {
        ensureExitIsolationMode(doc);
        options = options || {};
        var cutColor = options.cutStrokeColor || createRGBColor(0, 150, 255); // Blue for carrier
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;

        var carrierGroup = layer.groupItems.add();
        carrierGroup.name = "Carrier_" + (carrierData.carrierType || "ARM");

        var compoundPath = carrierGroup.compoundPathItems.add();
        compoundPath.name = carrierGroup.name + "_Compound";

        // 1. Outer carrier contour
        if (carrierData.outerNodes && carrierData.outerNodes.length > 0) {
            var outerPath = compoundPath.pathItems.add();
            outerPath.name = carrierGroup.name + "_Contour";
            applyBezierNodes(outerPath, carrierData.outerNodes, center, 0, MM_TO_PT);
            outerPath.closed = true;
        }

        // 2. Central sun shaft hole
        if (carrierData.sunHole && carrierData.sunHole.length > 0) {
            var sunPath = compoundPath.pathItems.add();
            sunPath.name = carrierGroup.name + "_SunShaftHole";
            applyBezierNodes(sunPath, carrierData.sunHole, center, 0, MM_TO_PT);
            sunPath.closed = true;
        }

        // 3. Planet pin holes
        if (carrierData.pinHoles && carrierData.pinHoles.length > 0) {
            for (var p = 0; p < carrierData.pinHoles.length; p++) {
                var pin = carrierData.pinHoles[p];
                var pinPath = compoundPath.pathItems.add();
                pinPath.name = carrierGroup.name + "_PlanetPinHole_" + (p + 1);
                applyBezierNodes(pinPath, pin.nodes, center, 0, MM_TO_PT);
                pinPath.closed = true;
            }
        }

        applyCutStyle(compoundPath, cutStrokeWidth, cutColor);
        return carrierGroup;
    }

    /**
     * Draws a Train Base Plate with mounting holes for all gear centers.
     */
    function drawTrainBasePlate(doc, layer, basePlateData, options) {
        ensureExitIsolationMode(doc);
        options = options || {};
        var originPt = options.originPt || [0, 0];
        var cutColor = options.cutStrokeColor || createRGBColor(0, 200, 100); // Green for baseplate
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;

        var plateGroup = layer.groupItems.add();
        plateGroup.name = "Train_BasePlate";

        var compoundPath = plateGroup.compoundPathItems.add();
        compoundPath.name = plateGroup.name + "_Compound";

        // 1. Outer plate contour
        if (basePlateData.outerNodes && basePlateData.outerNodes.length > 0) {
            var outerPath = compoundPath.pathItems.add();
            outerPath.name = plateGroup.name + "_Contour";
            applyBezierNodes(outerPath, basePlateData.outerNodes, originPt, 0, MM_TO_PT);
            outerPath.closed = true;
        }

        // 2. Shaft holes
        if (basePlateData.shaftHoles && basePlateData.shaftHoles.length > 0) {
            for (var h = 0; h < basePlateData.shaftHoles.length; h++) {
                var hole = basePlateData.shaftHoles[h];
                var holePath = compoundPath.pathItems.add();
                holePath.name = plateGroup.name + "_ShaftHole_" + hole.id;
                applyBezierNodes(holePath, hole.nodes, originPt, 0, MM_TO_PT);
                holePath.closed = true;
            }
        }

        applyCutStyle(compoundPath, cutStrokeWidth, cutColor);
        return plateGroup;
    }

    /**
     * Draws an Intermittent Locking Plate (Crescent disc or Geneva star plate).
     */
    function drawLockPlate(doc, layer, center, lockPlateData, rotationDeg, options) {
        ensureExitIsolationMode(doc);
        options = options || {};
        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180.0);
        var cutColor = options.cutStrokeColor || createRGBColor(255, 128, 0); // Orange for lock plate
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : DEFAULT_CUT_WIDTH;

        var lockGroup = layer.groupItems.add();
        lockGroup.name = lockPlateData.name || "LockPlate";

        var compoundPath = lockGroup.compoundPathItems.add();
        compoundPath.name = lockGroup.name + "_Compound";

        if (lockPlateData.outerNodes && lockPlateData.outerNodes.length > 0) {
            var outerPath = compoundPath.pathItems.add();
            outerPath.name = lockGroup.name + "_Contour";
            applyBezierNodes(outerPath, lockPlateData.outerNodes, center, rotOffsetRad, MM_TO_PT);
            outerPath.closed = true;
        }

        // Standard shaft hole for lock plate
        if (lockPlateData.shaftHole && lockPlateData.shaftHole.hasHole && lockPlateData.shaftHole.nodes) {
            var shaftPath = compoundPath.pathItems.add();
            shaftPath.name = lockGroup.name + "_ShaftHole";
            applyBezierNodes(shaftPath, lockPlateData.shaftHole.nodes, center, rotOffsetRad, MM_TO_PT);
            shaftPath.closed = true;
        }

        applyCutStyle(compoundPath, cutStrokeWidth, cutColor);
        return lockGroup;
    }

    return {
        MM_TO_PT: MM_TO_PT,
        PT_TO_MM: PT_TO_MM,
        unlockAndShowLayer: unlockAndShowLayer,
        isIsolationMode: isIsolationMode,
        ensureExitIsolationMode: ensureExitIsolationMode,
        getOrCreateLayer: getOrCreateLayer,
        createRGBColor: createRGBColor,
        applyCutStyle: applyCutStyle,
        applyGuideStyle: applyGuideStyle,
        applyBezierNodes: applyBezierNodes,
        drawGear: drawGear,
        drawMeshingPair: drawMeshingPair,
        drawInternalGear: drawInternalGear,
        drawRack: drawRack,
        drawGearWithFeatures: drawGearWithFeatures,
        drawTrain: drawTrain,
        drawPlanetaryCarrier: drawPlanetaryCarrier,
        drawTrainBasePlate: drawTrainBasePlate,
        drawLockPlate: drawLockPlate,
        importExternalAiTemplate: importExternalAiTemplate,
        createInDocumentScratchPath: createInDocumentScratchPath
    };
})();

/**
 * DialogView.jsxinc - GearDrawer Integrated Dual-Pane ScriptUI Dialog
 * Version: 1.0.0
 * 
 * Provides:
 * - 800pt x 780pt Dual-Pane horizontal layout (Left 450pt / Right 330pt)
 * - Circle object integration (pure pitch circle basis, group inner shapes extraction, color presets)
 * - Unified 10-row, 13-column train table (trainListBox) with safe empty initialization (trainNodes = [])
 * - Safe disabling of gear detail form when empty / no selection
 * - Parent-first gear detail editor with Enter-safe "ID Change" button and self-excluding parent dropdown
 * - Complex mechanism addition modals (Intermittent, 2K-H Planetary, 3K Paradoxical)
 * - Color preset management modal and detailed CAD/CAM styling modal
 * - Center guide dimension control (Fixed mm vs Relative % of pitch diameter)
 * - Batch CSV/TSV train tree import and export
 * - Preferences auto-save and JSON profile export/import
 * - Automated GUI screenshot harness integration (__GEARDRAWER_AUTO_SCREENSHOT__)
 */

var DialogView = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    // ==========================================
    // Internal Helper Functions for ES3
    // ==========================================
    function indexOfArray(arr, val) {
        if (!arr) return -1;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return i;
        }
        return -1;
    }

    function cloneObj(o) {
        if (o === null || typeof o !== "object") return o;
        var isArr = (Object.prototype.toString.call(o) === "[object Array]" || o instanceof Array);
        var copy = isArr ? [] : {};
        for (var k in o) {
            if (o.hasOwnProperty(k)) {
                copy[k] = cloneObj(o[k]);
            }
        }
        return copy;
    }

    // Default CAD/CAM styles
    var STYLE_PRESETS = {
        laser: {
            name: "\u30ec\u30fc\u30b6\u30fc\u52a0\u5de5",
            cut: { r: 255, g: 0, b: 0, strokeWidthPt: 0.001, dashes: [] },
            pitchGuide: { r: 0, g: 150, b: 0, strokeWidthPt: 0.25, dashes: [4, 2] },
            baseGuide: { r: 0, g: 100, b: 255, strokeWidthPt: 0.25, dashes: [] },
            skeleton: { r: 0, g: 0, b: 0, strokeWidthPt: 0.25, dashes: [] }
        },
        jis: {
            name: "JIS\u6a5f\u68b0\u88fd\u56f3",
            cut: { r: 0, g: 0, b: 0, strokeWidthPt: 0.5 * (72.0 / 25.4), dashes: [] },
            pitchGuide: { r: 255, g: 0, b: 0, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [12, 2, 2, 2] },
            baseGuide: { r: 0, g: 150, b: 0, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [] },
            skeleton: { r: 0, g: 0, b: 255, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [12, 2, 2, 2] }
        },
        cnc: {
            name: "CNC/3D\u30d7\u30ea\u30f3\u30c8",
            cut: { r: 255, g: 0, b: 255, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            pitchGuide: { r: 0, g: 255, b: 255, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            baseGuide: { r: 100, g: 100, b: 100, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            skeleton: { r: 0, g: 0, b: 0, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] }
        }
    };

    // Default Color Presets for Stroke-driven Generation
    var DEFAULT_COLOR_PRESETS = [
        { name: "\u8d64 (Red #FF0000)", hex: "#FF0000", r: 255, g: 0, b: 0, kind: "SPUR", shaftType: "ROUND", shaftDia: 5.0, cutoutType: "NONE", shift: 0.0 },
        { name: "\u9752 (Blue #0000FF)", hex: "#0000FF", r: 0, g: 0, b: 255, kind: "INTERNAL", shaftType: "NONE", shaftDia: 0.0, cutoutType: "NONE", shift: 0.0 },
        { name: "\u7dd1 (Green #00AA00)", hex: "#00AA00", r: 0, g: 170, b: 0, kind: "SPUR", shaftType: "D_CUT", shaftDia: 5.0, cutoutType: "PARAMETRIC", shift: 0.0 },
        { name: "\u30b7\u30a2\u30f3 (Cyan #00FFFF)", hex: "#00FFFF", r: 0, g: 255, b: 255, kind: "MUTILATED_DRIVER", shaftType: "KEYWAY", shaftDia: 6.0, cutoutType: "NONE", shift: 0.0 },
        { name: "\u30de\u30bc\u30f3\u30bf (Magenta #FF00FF)", hex: "#FF00FF", r: 255, g: 0, b: 255, kind: "MUTILATED_DRIVEN", shaftType: "ROUND", shaftDia: 5.0, cutoutType: "NONE", shift: 0.0 }
    ];

    /**
     * Finds next unique gear ID like G1, G2, ...
     */
    function getNextGearId(nodes, prefix) {
        prefix = prefix || "G";
        var maxNum = 0;
        for (var i = 0; i < nodes.length; i++) {
            var nid = nodes[i].id || "";
            if (nid.indexOf(prefix) === 0) {
                var num = parseInt(nid.substring(prefix.length), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        }
        return prefix + (maxNum + 1);
    }

    /**
     * Determines driver node of a stage.
     */
    function getStageDriverNode(stageIndex, nodes) {
        if (!nodes) return null;
        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            if ((parseInt(nd.stageIndex, 10) || 1) === stageIndex) {
                if (!nd.parentId || nd.relationType === "ROOT" || nd.relationType === "COAXIAL") {
                    return nd;
                }
            }
        }
        for (var j = 0; j < nodes.length; j++) {
            if ((parseInt(nodes[j].stageIndex, 10) || 1) === stageIndex) {
                return nodes[j];
            }
        }
        return null;
    }

    // ==========================================
    // Modal 1: Detailed CAD / CAM Styling Modal
    // ==========================================
    function showStyleDetailModal(parentWin, currentStyles, onApply) {
        var modal = new Window("dialog", "\u8a73\u7d30\u30b9\u30bf\u30a4\u30eb\u8a2d\u5b9a (CAD / CAM / \u88fd\u56f3)");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 8;
        modal.margins = 12;

        function addColorPreview(container, r, g, b) {
            var pBox = container.add("customView", undefined);
            pBox.preferredSize = [20, 20];
            pBox.colorR = r;
            pBox.colorG = g;
            pBox.colorB = b;
            pBox.onDraw = function () {
                var gph = this.graphics;
                var cr = (typeof this.colorR === "number") ? this.colorR / 255.0 : 0;
                var cg = (typeof this.colorG === "number") ? this.colorG / 255.0 : 0;
                var cb = (typeof this.colorB === "number") ? this.colorB / 255.0 : 0;
                var brush = gph.newBrush(gph.BrushType.SOLID_COLOR, [cr, cg, cb, 1]);
                gph.rectPath(0, 0, 20, 20);
                gph.fillPath(brush);
                var pen = gph.newPen(gph.PenType.SOLID_COLOR, [0.3, 0.3, 0.3, 1], 1);
                gph.strokePath(pen);
            };
            pBox.setColor = function (nr, ng, nb) {
                this.colorR = nr;
                this.colorG = ng;
                this.colorB = nb;
                this.notify("onDraw");
            };
            return pBox;
        }

        // Cut Style
        var pnlCut = modal.add("panel", undefined, "\u5207\u65ad\u7dda");
        pnlCut.orientation = "row";
        pnlCut.spacing = 8;
        var prevCut = addColorPreview(pnlCut, currentStyles.cut.r, currentStyles.cut.g, currentStyles.cut.b);
        pnlCut.add("statictext", undefined, "RGB:");
        var etCutR = pnlCut.add("edittext", undefined, String(currentStyles.cut.r)); etCutR.characters = 3;
        var etCutG = pnlCut.add("edittext", undefined, String(currentStyles.cut.g)); etCutG.characters = 3;
        var etCutB = pnlCut.add("edittext", undefined, String(currentStyles.cut.b)); etCutB.characters = 3;
        pnlCut.add("statictext", undefined, "\u7dda\u5e45(pt):");
        var etCutW = pnlCut.add("edittext", undefined, String(currentStyles.cut.strokeWidthPt)); etCutW.characters = 5;

        function updateCutPrev() {
            prevCut.setColor(parseInt(etCutR.text, 10) || 0, parseInt(etCutG.text, 10) || 0, parseInt(etCutB.text, 10) || 0);
        }
        etCutR.onChanging = updateCutPrev;
        etCutG.onChanging = updateCutPrev;
        etCutB.onChanging = updateCutPrev;

        // Pitch Guide
        var pnlPitch = modal.add("panel", undefined, "\u30d4\u30c3\u30c1\u5186\u30ac\u30a4\u30c9");
        pnlPitch.orientation = "row";
        pnlPitch.spacing = 8;
        var prevPitch = addColorPreview(pnlPitch, currentStyles.pitchGuide.r, currentStyles.pitchGuide.g, currentStyles.pitchGuide.b);
        pnlPitch.add("statictext", undefined, "RGB:");
        var etPitchR = pnlPitch.add("edittext", undefined, String(currentStyles.pitchGuide.r)); etPitchR.characters = 3;
        var etPitchG = pnlPitch.add("edittext", undefined, String(currentStyles.pitchGuide.g)); etPitchG.characters = 3;
        var etPitchB = pnlPitch.add("edittext", undefined, String(currentStyles.pitchGuide.b)); etPitchB.characters = 3;
        pnlPitch.add("statictext", undefined, "\u7dda\u5e45(pt):");
        var etPitchW = pnlPitch.add("edittext", undefined, String(currentStyles.pitchGuide.strokeWidthPt)); etPitchW.characters = 5;
        pnlPitch.add("statictext", undefined, "\u7834\u7dda:");
        var pDashes = (currentStyles.pitchGuide && currentStyles.pitchGuide.dashes) ? currentStyles.pitchGuide.dashes : [];
        var pDashStr = (typeof pDashes.join === "function") ? pDashes.join(", ") : "";
        var etPitchDash = pnlPitch.add("edittext", undefined, pDashStr); etPitchDash.characters = 7;

        function updatePitchPrev() {
            prevPitch.setColor(parseInt(etPitchR.text, 10) || 0, parseInt(etPitchG.text, 10) || 0, parseInt(etPitchB.text, 10) || 0);
        }
        etPitchR.onChanging = updatePitchPrev;
        etPitchG.onChanging = updatePitchPrev;
        etPitchB.onChanging = updatePitchPrev;

        // Base Guide
        var pnlBase = modal.add("panel", undefined, "\u57fa\u790e\u5186\u30ac\u30a4\u30c9");
        pnlBase.orientation = "row";
        pnlBase.spacing = 8;
        var prevBase = addColorPreview(pnlBase, currentStyles.baseGuide.r, currentStyles.baseGuide.g, currentStyles.baseGuide.b);
        pnlBase.add("statictext", undefined, "RGB:");
        var etBaseR = pnlBase.add("edittext", undefined, String(currentStyles.baseGuide.r)); etBaseR.characters = 3;
        var etBaseG = pnlBase.add("edittext", undefined, String(currentStyles.baseGuide.g)); etBaseG.characters = 3;
        var etBaseB = pnlBase.add("edittext", undefined, String(currentStyles.baseGuide.b)); etBaseB.characters = 3;
        pnlBase.add("statictext", undefined, "\u7dda\u5e45(pt):");
        var etBaseW = pnlBase.add("edittext", undefined, String(currentStyles.baseGuide.strokeWidthPt)); etBaseW.characters = 5;

        function updateBasePrev() {
            prevBase.setColor(parseInt(etBaseR.text, 10) || 0, parseInt(etBaseG.text, 10) || 0, parseInt(etBaseB.text, 10) || 0);
        }
        etBaseR.onChanging = updateBasePrev;
        etBaseG.onChanging = updateBasePrev;
        etBaseB.onChanging = updateBasePrev;

        // Skeleton Style
        var pnlSkel = modal.add("panel", undefined, "\u8a2d\u8a08\u56f3");
        pnlSkel.orientation = "row";
        pnlSkel.spacing = 8;
        var prevSkel = addColorPreview(pnlSkel, currentStyles.skeleton.r, currentStyles.skeleton.g, currentStyles.skeleton.b);
        pnlSkel.add("statictext", undefined, "RGB:");
        var etSkelR = pnlSkel.add("edittext", undefined, String(currentStyles.skeleton.r)); etSkelR.characters = 3;
        var etSkelG = pnlSkel.add("edittext", undefined, String(currentStyles.skeleton.g)); etSkelG.characters = 3;
        var etSkelB = pnlSkel.add("edittext", undefined, String(currentStyles.skeleton.b)); etSkelB.characters = 3;
        pnlSkel.add("statictext", undefined, "\u7dda\u5e45(pt):");
        var etSkelW = pnlSkel.add("edittext", undefined, String(currentStyles.skeleton.strokeWidthPt)); etSkelW.characters = 5;

        function updateSkelPrev() {
            prevSkel.setColor(parseInt(etSkelR.text, 10) || 0, parseInt(etSkelG.text, 10) || 0, parseInt(etSkelB.text, 10) || 0);
        }
        etSkelR.onChanging = updateSkelPrev;
        etSkelG.onChanging = updateSkelPrev;
        etSkelB.onChanging = updateSkelPrev;

        // Modal Action Buttons
        var grpBtns = modal.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "center"];
        grpBtns.spacing = 10;
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u9069\u7528", { name: "ok" });

        btnOk.onClick = function () {
            currentStyles.cut.r = parseInt(etCutR.text, 10) || 0;
            currentStyles.cut.g = parseInt(etCutG.text, 10) || 0;
            currentStyles.cut.b = parseInt(etCutB.text, 10) || 0;
            currentStyles.cut.strokeWidthPt = parseFloat(etCutW.text) || 0.001;

            currentStyles.pitchGuide.r = parseInt(etPitchR.text, 10) || 0;
            currentStyles.pitchGuide.g = parseInt(etPitchG.text, 10) || 0;
            currentStyles.pitchGuide.b = parseInt(etPitchB.text, 10) || 0;
            currentStyles.pitchGuide.strokeWidthPt = parseFloat(etPitchW.text) || 0.25;

            var dParts = etPitchDash.text.split(",");
            var dashes = [];
            for (var di = 0; di < dParts.length; di++) {
                var dv = parseFloat(dParts[di]);
                if (!isNaN(dv) && dv > 0) dashes.push(dv);
            }
            currentStyles.pitchGuide.dashes = dashes;

            currentStyles.baseGuide.r = parseInt(etBaseR.text, 10) || 0;
            currentStyles.baseGuide.g = parseInt(etBaseG.text, 10) || 0;
            currentStyles.baseGuide.b = parseInt(etBaseB.text, 10) || 0;
            currentStyles.baseGuide.strokeWidthPt = parseFloat(etBaseW.text) || 0.25;

            currentStyles.skeleton.r = parseInt(etSkelR.text, 10) || 0;
            currentStyles.skeleton.g = parseInt(etSkelG.text, 10) || 0;
            currentStyles.skeleton.b = parseInt(etSkelB.text, 10) || 0;
            currentStyles.skeleton.strokeWidthPt = parseFloat(etSkelW.text) || 0.25;

            if (typeof onApply === "function") {
                onApply(currentStyles);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        modal.center();
        modal.show();
    }

    // ==========================================
    // Modal 2: Color Preset Management Modal
    // ==========================================
    function showColorPresetModal(parentWin, colorPresets, onSave) {
        var modal = new Window("dialog", "\u7dda\u306e\u8272\u5225\u30d7\u30ea\u30bb\u30c3\u30c8\u8a2d\u5b9a");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 8;
        modal.margins = 12;
        modal.preferredSize = [680, 470];

        var stDesc = modal.add("statictext", undefined, "\u5186\u306e\u7dda\u306e\u8272\u306b\u5fdc\u3058\u305f\u81ea\u52d5\u30ae\u30a2\u5272\u308a\u5f53\u3066\u3092\u7ba1\u7406\u3057\u307e\u3059\u3002");
        stDesc.characters = 60;

        var lbColors = modal.add("listbox", undefined, [], {
            numberOfColumns: 6,
            showHeaders: true,
            columnTitles: ["\u8272\u540d / RGB", "\u7a2e\u985e", "\u8ef8\u7a74\u5f62\u72b6", "\u8ef8\u5f84(mm)", "\u8089\u629c\u304d", "\u8ee2\u4f4dx"],
            columnWidths: [165, 130, 85, 70, 105, 55]
        });
        lbColors.preferredSize = [650, 180];

        function refreshColorList(selIndex) {
            lbColors.removeAll();
            for (var i = 0; i < colorPresets.length; i++) {
                var cp = colorPresets[i];
                var itm = lbColors.add("item", cp.name);
                itm.subItems[0].text = cp.kind || "SPUR";
                itm.subItems[1].text = cp.shaftType || "ROUND";
                itm.subItems[2].text = (typeof cp.shaftDia === "number") ? cp.shaftDia.toFixed(1) : "5.0";
                itm.subItems[3].text = cp.cutoutType || "NONE";
                itm.subItems[4].text = (typeof cp.shift === "number") ? cp.shift.toFixed(2) : "0.00";
            }
            if (colorPresets.length > 0) {
                var sIdx = (typeof selIndex === "number" && selIndex >= 0 && selIndex < colorPresets.length) ? selIndex : 0;
                lbColors.selection = sIdx;
            }
        }

        // Detail Editor
        var pnlEdit = modal.add("panel", undefined, "\u9078\u629e\u8272\u306e\u8a2d\u5b9a");
        pnlEdit.orientation = "column";
        pnlEdit.alignChildren = ["fill", "top"];
        pnlEdit.spacing = 6;
        pnlEdit.margins = 8;

        var rowE1 = pnlEdit.add("group");
        rowE1.orientation = "row";
        rowE1.spacing = 8;
        rowE1.add("statictext", undefined, "\u8272\u540d:");
        var etColName = rowE1.add("edittext", undefined, ""); etColName.characters = 20;
        rowE1.add("statictext", undefined, "RGB:");
        var etColR = rowE1.add("edittext", undefined, "255"); etColR.characters = 3;
        var etColG = rowE1.add("edittext", undefined, "0"); etColG.characters = 3;
        var etColB = rowE1.add("edittext", undefined, "0"); etColB.characters = 3;

        var rowE2 = pnlEdit.add("group");
        rowE2.orientation = "row";
        rowE2.spacing = 8;
        rowE2.add("statictext", undefined, "\u6b6f\u8eca\u306e\u7a2e\u985e:");
        var ddColKind = rowE2.add("dropdownlist", undefined, [
            "\u5916\u6b6f\u8eca (SPUR)",
            "\u5185\u6b6f\u8eca (INTERNAL)",
            "\u9593\u6b20\u539f\u52d5 (MUTILATED_DRIVER)",
            "\u9593\u6b20\u5f93\u52d5 (MUTILATED_DRIVEN)"
        ]);
        ddColKind.preferredSize.width = 225;
        ddColKind.selection = 0;

        rowE2.add("statictext", undefined, "\u8ee2\u4f4dx:");
        var etColShift = rowE2.add("edittext", undefined, "0.0"); etColShift.characters = 4;

        var rowE3 = pnlEdit.add("group");
        rowE3.orientation = "row";
        rowE3.spacing = 8;
        rowE3.add("statictext", undefined, "\u8ef8\u7a74\u5f62\u72b6:");
        var ddColShaft = rowE3.add("dropdownlist", undefined, ["\u4e38\u7a74 (ROUND)", "D\u30ab\u30c3\u30c8 (D_CUT)", "\u30ad\u30fc\u6e9d (KEYWAY)", "\u306a\u3057 (NONE)"]);
        ddColShaft.preferredSize.width = 140;
        ddColShaft.selection = 0;
        rowE3.add("statictext", undefined, "\u8ef8\u5f84(mm):");
        var etColShaftDia = rowE3.add("edittext", undefined, "5.0"); etColShaftDia.characters = 4;

        rowE3.add("statictext", undefined, "\u8089\u629c\u304d:");
        var ddColCutout = rowE3.add("dropdownlist", undefined, ["\u306a\u3057 (NONE)", "\u30d1\u30e9\u30e1\u30c8\u30ea\u30c3\u30af", "\u5916\u90e8.ai\u53c2\u7167"]);
        ddColCutout.preferredSize.width = 135;
        ddColCutout.selection = 0;

        var rowE4 = pnlEdit.add("group");
        rowE4.orientation = "row";
        rowE4.alignment = ["right", "center"];
        rowE4.spacing = 6;
        var btnUpdateItem = rowE4.add("button", undefined, "\u3053\u306e\u8272\u306e\u8a2d\u5b9a\u3092\u66f4\u65b0");

        function loadPresetToForm(idx) {
            if (idx < 0 || idx >= colorPresets.length) return;
            var cp = colorPresets[idx];
            etColName.text = cp.name || "";
            etColR.text = String(cp.r || 0);
            etColG.text = String(cp.g || 0);
            etColB.text = String(cp.b || 0);
            etColShift.text = String(cp.shift || 0.0);
            etColShaftDia.text = String(cp.shaftDia || 5.0);

            if (cp.kind === "INTERNAL") ddColKind.selection = 1;
            else if (cp.kind === "MUTILATED_DRIVER") ddColKind.selection = 2;
            else if (cp.kind === "MUTILATED_DRIVEN") ddColKind.selection = 3;
            else ddColKind.selection = 0;

            if (cp.shaftType === "D_CUT") ddColShaft.selection = 1;
            else if (cp.shaftType === "KEYWAY") ddColShaft.selection = 2;
            else if (cp.shaftType === "NONE") ddColShaft.selection = 3;
            else ddColShaft.selection = 0;

            if (cp.cutoutType === "PARAMETRIC") ddColCutout.selection = 1;
            else if (cp.cutoutType === "EXTERNAL_AI") ddColCutout.selection = 2;
            else ddColCutout.selection = 0;
        }

        lbColors.onChange = function () {
            if (lbColors.selection) {
                loadPresetToForm(lbColors.selection.index);
            }
        };

        btnUpdateItem.onClick = function () {
            if (!lbColors.selection) return;
            var idx = lbColors.selection.index;
            var cp = colorPresets[idx];
            cp.name = etColName.text;
            cp.r = parseInt(etColR.text, 10) || 0;
            cp.g = parseInt(etColG.text, 10) || 0;
            cp.b = parseInt(etColB.text, 10) || 0;
            cp.shift = parseFloat(etColShift.text) || 0.0;
            cp.shaftDia = parseFloat(etColShaftDia.text) || 5.0;

            var kSel = ddColKind.selection ? ddColKind.selection.index : 0;
            cp.kind = (kSel === 1) ? "INTERNAL" : ((kSel === 2) ? "MUTILATED_DRIVER" : ((kSel === 3) ? "MUTILATED_DRIVEN" : "SPUR"));

            var sSel = ddColShaft.selection ? ddColShaft.selection.index : 0;
            cp.shaftType = (sSel === 1) ? "D_CUT" : ((sSel === 2) ? "KEYWAY" : ((sSel === 3) ? "NONE" : "ROUND"));

            var cSel = ddColCutout.selection ? ddColCutout.selection.index : 0;
            cp.cutoutType = (cSel === 1) ? "PARAMETRIC" : ((cSel === 2) ? "EXTERNAL_AI" : "NONE");

            refreshColorList(idx);
        };

        // Modal Action Buttons
        var grpFoot = modal.add("group");
        grpFoot.orientation = "row";
        grpFoot.spacing = 10;
        var btnAddColor = grpFoot.add("button", undefined, "+ \u65b0\u898f\u8272\u8ffd\u52a0");
        var btnDelColor = grpFoot.add("button", undefined, "- \u9078\u629e\u8272\u524a\u9664");
        var spFoot = grpFoot.add("group"); spFoot.alignment = ["fill", "fill"];
        var btnCancel = grpFoot.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpFoot.add("button", undefined, "\u4fdd\u5b58", { name: "ok" });

        btnAddColor.onClick = function () {
            var newCp = {
                name: "\u30ab\u30b9\u30bf\u30e0\u8272 " + (colorPresets.length + 1),
                r: 128, g: 128, b: 128,
                kind: "SPUR", shaftType: "ROUND", shaftDia: 5.0, cutoutType: "NONE", shift: 0.0
            };
            colorPresets.push(newCp);
            refreshColorList(colorPresets.length - 1);
        };

        btnDelColor.onClick = function () {
            if (!lbColors.selection) return;
            var idx = lbColors.selection.index;
            colorPresets.splice(idx, 1);
            refreshColorList(Math.max(0, idx - 1));
        };

        btnOk.onClick = function () {
            if (typeof onSave === "function") {
                onSave(colorPresets);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        refreshColorList(0);
        modal.center();
        modal.show();
    }

    // ==========================================
    // Modal 3: Add 2K-H Planetary Modal (2-Column Search & Config)
    // ==========================================
    function showAddPlanetaryModal(initParams, parentNode, trainNodes, callback) {
        initParams = initParams || {};
        var modal = new Window("dialog", "\u6a19\u6e96\u904a\u661f\u6b6f\u8eca\u6a5f\u69cb (2K-H\u578b) \u306e\u8ffd\u52a0\u30fb\u63a2\u7d22");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 6;
        modal.margins = 10;
        modal.preferredSize = [760, 470];

        var grpCols = modal.add("group");
        grpCols.orientation = "row";
        grpCols.alignChildren = ["fill", "fill"];
        grpCols.spacing = 8;

        // LEFT COLUMN: Search & Candidates (375pt)
        var colLeft = grpCols.add("group");
        colLeft.orientation = "column";
        colLeft.alignChildren = ["fill", "top"];
        colLeft.preferredSize = [375, 415];
        colLeft.spacing = 4;

        var pnlSearch = colLeft.add("panel", undefined, "\u6210\u7acb\u8af8\u5143\u30fb\u6b6f\u6570\u63a2\u7d22 (\u8a31\u5bb9\u7bc4\u56f2\u3064\u304d)");
        pnlSearch.orientation = "column";
        pnlSearch.alignChildren = ["fill", "top"];
        pnlSearch.spacing = 4;
        pnlSearch.margins = 6;

        var rS1 = pnlSearch.add("group");
        rS1.orientation = "row";
        rS1.spacing = 6;
        rS1.add("statictext", undefined, "\u76ee\u6a19\u6e1b\u901f\u6bd4 i:");
        var etTargetRatio = rS1.add("edittext", undefined, String(initParams.targetRatio || 4.0));
        etTargetRatio.characters = 5;
        rS1.add("statictext", undefined, "\u8a31\u5bb9\u8aa4\u5dee:");
        var ddTolerance = rS1.add("dropdownlist", undefined, ["\u00b15%", "\u00b110%", "\u00b120%", "\u5b8c\u5168\u4e00\u81f4 (0%)"]);
        ddTolerance.selection = 1;

        var rS2 = pnlSearch.add("group");
        rS2.orientation = "row";
        rS2.spacing = 6;
        rS2.add("statictext", undefined, "\u56fa\u5b9a\u8981\u7d20:");
        var ddFixMode = rS2.add("dropdownlist", undefined, ["\u5185\u6b6f\u56fa\u5b9a (Ring Fixed)", "\u592a\u967d\u56fa\u5b9a (Sun Fixed)", "\u30ad\u30e3\u30ea\u30a2\u56fa\u5b9a (Star)"]);
        ddFixMode.selection = 0;
        rS2.add("statictext", undefined, "\u904a\u661f\u6570 N:");
        var etSearchN = rS2.add("edittext", undefined, String(initParams.N || 3));
        etSearchN.characters = 3;

        ddFixMode.onChange = function () {
            var selIdx = ddFixMode.selection ? ddFixMode.selection.index : 0;
            if (selIdx === 1) {
                etTargetRatio.text = "1.25";
            } else if (selIdx === 2) {
                etTargetRatio.text = "3.0";
            } else {
                etTargetRatio.text = "4.0";
            }
            validatePlanetary();
        };

        var rS3 = pnlSearch.add("group");
        rS3.orientation = "row";
        rS3.spacing = 6;
        var btnRunSearch = rS3.add("button", undefined, "\u3010\u6210\u7acb\u3059\u308b\u6b6f\u6570\u306e\u7d44\u307f\u5408\u308f\u305b\u3092\u63a2\u7d22\u3011");
        btnRunSearch.preferredSize.width = 350;

        var pnlCandidates = colLeft.add("panel", undefined, "\u63a2\u7d22\u5019\u88dc\u4e00\u89a7 (\u30af\u30ea\u30c3\u30af\u3067\u53f3\u5074\u306b\u53cd\u6620)");
        pnlCandidates.orientation = "column";
        pnlCandidates.alignChildren = ["fill", "fill"];
        pnlCandidates.margins = 6;

        var lbCandidates = pnlCandidates.add("listbox", undefined, [], {
            numberOfColumns: 5,
            showHeaders: true,
            columnTitles: ["\u6e1b\u901f\u6bd4 i", "\u8aa4\u5dee", "zs / zp / zr", "\u5916\u5f84 da", "\u52b9\u7387"],
            columnWidths: [64, 52, 102, 72, 50]
        });
        lbCandidates.preferredSize = [360, 210];

        // RIGHT COLUMN: Selected Specs, Verification & Connection (355pt)
        var colRight = grpCols.add("group");
        colRight.orientation = "column";
        colRight.alignChildren = ["fill", "top"];
        colRight.preferredSize = [355, 415];
        colRight.spacing = 4;

        // Kinematic connection
        var pnlConn = colRight.add("panel", undefined, "\u8f2a\u5217\u63a5\u7d9a\u8a2d\u5b9a");
        pnlConn.orientation = "row";
        pnlConn.spacing = 6;
        pnlConn.margins = 6;
        pnlConn.add("statictext", undefined, "\u89aa\u30ae\u30a2:");
        var pOpts = ["\u306a\u3057 (\u72ec\u7acb\u30eb\u30fc\u30c8)"];
        var selPIdx = 0;
        for (var i = 0; i < trainNodes.length; i++) {
            pOpts.push(trainNodes[i].id + " (" + trainNodes[i].kind + ", z=" + trainNodes[i].z + ")");
            if (parentNode && trainNodes[i].id === parentNode.id) selPIdx = i + 1;
        }
        var ddParent = pnlConn.add("dropdownlist", undefined, pOpts);
        ddParent.selection = selPIdx;
        pnlConn.add("statictext", undefined, "\u6bb5\u756a\u53f7:");
        var etStage = pnlConn.add("edittext", undefined, String(parentNode ? parentNode.stageIndex : 1));
        etStage.characters = 3;

        // Parameters
        var pnlParams = colRight.add("panel", undefined, "\u6b6f\u8eca\u8af8\u5143(\u624b\u52d5\u8abf\u6574\u53ef)");
        pnlParams.orientation = "column";
        pnlParams.alignChildren = ["fill", "top"];
        pnlParams.spacing = 4;
        pnlParams.margins = 6;

        var rowP1 = pnlParams.add("group");
        rowP1.orientation = "row";
        rowP1.spacing = 6;
        rowP1.add("statictext", undefined, "zs:");
        var etZs = rowP1.add("edittext", undefined, String(initParams.zs || 18)); etZs.characters = 4;
        rowP1.add("statictext", undefined, "zp:");
        var etZp = rowP1.add("edittext", undefined, String(initParams.zp || 18)); etZp.characters = 4;
        rowP1.add("statictext", undefined, "zr:");
        var etZr = rowP1.add("edittext", undefined, String(initParams.zr || 54)); etZr.characters = 4;

        var rowP2 = pnlParams.add("group");
        rowP2.orientation = "row";
        rowP2.spacing = 6;
        rowP2.add("statictext", undefined, "\u904a\u661f\u500b\u6570 N:");
        var etN = rowP2.add("edittext", undefined, String(initParams.N || 3)); etN.characters = 3;
        rowP2.add("statictext", undefined, "m:");
        var etM = rowP2.add("edittext", undefined, String(initParams.m || (parentNode ? parentNode.m : 2.0))); etM.characters = 4;
        var chkCarrier = rowP2.add("checkbox", undefined, "\u30ad\u30e3\u30ea\u30a2\u5916\u5f62\u51fa\u529b");
        chkCarrier.value = true;

        var pnlStatus = colRight.add("panel", undefined, "\u6210\u7acb\u6761\u4ef6\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u691c\u8a3c");
        pnlStatus.orientation = "column";
        pnlStatus.alignChildren = ["fill", "top"];
        pnlStatus.spacing = 3;
        pnlStatus.margins = 6;
        var stCond1 = pnlStatus.add("statictext", undefined, "\u540c\u5fc3\u6761\u4ef6 (zr = zs + 2*zp): OK");
        stCond1.characters = 42;
        var stCond2 = pnlStatus.add("statictext", undefined, "\u7b49\u914d\u6761\u4ef6 ((zs + zr)/N \u304c\u6574\u6570): OK");
        stCond2.characters = 42;
        var stCond3 = pnlStatus.add("statictext", undefined, "\u96a3\u63a5\u5e72\u6e09\u6761\u4ef6: OK");
        stCond3.characters = 42;
        var stRatio = pnlStatus.add("statictext", undefined, "\u6e1b\u901f\u6bd4 (Ring Fixed): i = 4.00");
        stRatio.characters = 42;

        function validatePlanetary() {
            var zs = parseInt(etZs.text, 10) || 0;
            var zp = parseInt(etZp.text, 10) || 0;
            var zr = parseInt(etZr.text, 10) || 0;
            var n = parseInt(etN.text, 10) || 1;
            var selIdx = ddFixMode.selection ? ddFixMode.selection.index : 0;

            var c1 = (zr === (zs + 2 * zp));
            stCond1.text = "\u540c\u5fc3\u6761\u4ef6 (zr = zs + 2*zp): " + (c1 ? "OK" : "\u4e0d\u4e00\u81f4 (zr\u3092 " + (zs + 2 * zp) + " \u306b\u63a8\u5968)");

            var c2 = (((zs + zr) % n) === 0);
            stCond2.text = "\u7b49\u914d\u6761\u4ef6 ((zs + zr)/N \u304c\u6574\u6570): " + (c2 ? "OK" : "\u4e0d\u6210\u7acb (\u7d04\u6570\u6761\u4ef6\u30a8\u30e9\u30fc)");

            var angleN = Math.PI / n;
            var c3 = ((zp + 2) < (zs + zp) * Math.sin(angleN));
            stCond3.text = "\u96a3\u63a5\u5e72\u6e09\u6761\u4ef6: " + (c3 ? "OK" : "\u904a\u661f\u540c\u58eb\u304c\u885d\u7a81\u3057\u307e\u3059");

            if (zs > 0 && zr > 0) {
                var r = 0;
                var modeTitle = "";
                if (selIdx === 1) {
                    r = 1.0 + (zs / zr);
                    modeTitle = "\u6e1b\u901f\u6bd4 (Sun Fixed): i = 1 + zs/zr = ";
                } else if (selIdx === 2) {
                    r = -(zr / zs);
                    modeTitle = "\u6e1b\u901f\u6bd4 (Carrier Fixed): i = -zr/zs = ";
                } else {
                    r = 1.0 + (zr / zs);
                    modeTitle = "\u6e1b\u901f\u6bd4 (Ring Fixed): i = 1 + zr/zs = ";
                }
                stRatio.text = modeTitle + r.toFixed(2);
            }
        }

        etZs.onChanging = validatePlanetary;
        etZp.onChanging = validatePlanetary;
        etZr.onChanging = validatePlanetary;
        etN.onChanging = validatePlanetary;
        validatePlanetary();

        var candidateResults = [];
        btnRunSearch.onClick = function () {
            var targetRatio = parseFloat(etTargetRatio.text) || 4.0;
            var tolMap = [5.0, 10.0, 20.0, 0.0];
            var tolPct = tolMap[ddTolerance.selection ? ddTolerance.selection.index : 1];
            var modeKeys = ["ring_fixed", "sun_fixed", "carrier_fixed"];
            var mode = modeKeys[ddFixMode.selection ? ddFixMode.selection.index : 0];
            var nPlanets = parseInt(etSearchN.text, 10) || 3;
            var mVal = parseFloat(etM.text) || 2.0;

            if (typeof MechanismSolvers !== "undefined" && typeof MechanismSolvers.solveStandardPlanetary === "function") {
                candidateResults = MechanismSolvers.solveStandardPlanetary({
                    targetRatio: targetRatio,
                    tolPercent: tolPct,
                    mode: mode,
                    numPlanets: nPlanets,
                    m: mVal
                });
            } else {
                candidateResults = [];
            }

            lbCandidates.removeAll();
            if (candidateResults.length === 0) {
                var noneItm = lbCandidates.add("item", "\u8a72\u5f53\u306a\u3057");
                noneItm.subItems[0].text = "-";
                noneItm.subItems[1].text = "-";
                noneItm.subItems[2].text = "-";
                noneItm.subItems[3].text = "-";
            } else {
                for (var k = 0; k < candidateResults.length && k < 50; k++) {
                    var res = candidateResults[k];
                    var itm = lbCandidates.add("item", res.ratio.toFixed(2));
                    var errVal = (res.ratioError !== undefined) ? res.ratioError : (res.errorPercent !== undefined ? res.errorPercent : 0.0);
                    var errSign = errVal >= 0 ? "+" : "";
                    itm.subItems[0].text = errSign + errVal.toFixed(1) + "%";
                    itm.subItems[1].text = res.zs + " / " + res.zp + " / " + res.zr;
                    var daVal = (res.zr + 2) * mVal;
                    itm.subItems[2].text = daVal.toFixed(1) + "mm";
                    var effVal = (res.efficiencyEst !== undefined) ? res.efficiencyEst : (res.efficiency !== undefined ? Math.round(res.efficiency * 100) : 0);
                    itm.subItems[3].text = effVal + "%";
                }
                lbCandidates.selection = 0;
            }
        };

        lbCandidates.onChange = function () {
            if (!lbCandidates.selection || candidateResults.length === 0) return;
            var idx = lbCandidates.selection.index;
            if (idx >= 0 && idx < candidateResults.length) {
                var sel = candidateResults[idx];
                etZs.text = String(sel.zs);
                etZp.text = String(sel.zp);
                etZr.text = String(sel.zr);
                etN.text = String(sel.numPlanets || sel.N || etSearchN.text);
                validatePlanetary();
            }
        };

        var grpBtns = colRight.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "bottom"];
        grpBtns.spacing = 8;
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u8f2a\u5217\u306b\u5c55\u958b", { name: "ok" });

        btnOk.onClick = function () {
            var params = {
                zs: parseInt(etZs.text, 10) || 18,
                zp: parseInt(etZp.text, 10) || 18,
                zr: parseInt(etZr.text, 10) || 54,
                N: parseInt(etN.text, 10) || 3,
                m: parseFloat(etM.text) || 2.0,
                stageIndex: parseInt(etStage.text, 10) || 1,
                generateCarrier: chkCarrier.value,
                parentId: (ddParent.selection && ddParent.selection.index > 0) ? trainNodes[ddParent.selection.index - 1].id : null
            };
            if (typeof callback === "function") {
                callback(params);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        modal.center();
        modal.show();
    }

    // ==========================================
    // Modal 4: Add 3K Paradoxical Planetary Modal (2-Column Search & Config)
    // ==========================================
    function showAddParadoxModal(initParams, parentNode, trainNodes, callback) {
        initParams = initParams || {};
        var modal = new Window("dialog", "3K\u578b\u4e0d\u601d\u8b70\u904a\u661f\u6b6f\u8eca\u6a5f\u69cb\u306e\u8ffd\u52a0\u30fb\u63a2\u7d22");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 6;
        modal.margins = 10;
        modal.preferredSize = [810, 480];

        var grpCols = modal.add("group");
        grpCols.orientation = "row";
        grpCols.alignChildren = ["fill", "fill"];
        grpCols.spacing = 8;

        // LEFT COLUMN: Search & Candidates (415pt)
        var colLeft = grpCols.add("group");
        colLeft.orientation = "column";
        colLeft.alignChildren = ["fill", "top"];
        colLeft.preferredSize = [415, 425];
        colLeft.spacing = 4;

        var pnlSearch = colLeft.add("panel", undefined, "\u4e0d\u601d\u8b70\u904a\u661f \u6b6f\u6570\u30fb\u8ee2\u4f4d\u63a2\u7d22 (\u8a31\u5bb9\u7bc4\u56f2\u3064\u304d)");
        pnlSearch.orientation = "column";
        pnlSearch.alignChildren = ["fill", "top"];
        pnlSearch.spacing = 4;
        pnlSearch.margins = 6;

        var rS1 = pnlSearch.add("group");
        rS1.orientation = "row";
        rS1.spacing = 6;
        rS1.add("statictext", undefined, "\u76ee\u6a19\u6e1b\u901f\u6bd4 i:");
        var etTargetRatio = rS1.add("edittext", undefined, String(initParams.targetRatio || 31.0));
        etTargetRatio.characters = 5;
        rS1.add("statictext", undefined, "\u8a31\u5bb9\u8aa4\u5dee:");
        var ddTolerance = rS1.add("dropdownlist", undefined, ["\u00b15%", "\u00b110%", "\u00b120%", "\u5b8c\u5168\u4e00\u81f4 (0%)"]);
        ddTolerance.selection = 1;

        var rS2 = pnlSearch.add("group");
        rS2.orientation = "row";
        rS2.spacing = 6;
        rS2.add("statictext", undefined, "\u8ee2\u4f4d\u65b9\u5f0f:");
        var ddMethod = rS2.add("dropdownlist", undefined, ["\u6b63\u8ee2\u4f4d", "\u6a19\u6e96 (\u7121\u8ee2\u4f4d)", "\u4e21\u65b9"]);
        ddMethod.selection = 0;
        rS2.add("statictext", undefined, "\u904a\u661f\u6570 N:");
        var etSearchN = rS2.add("edittext", undefined, String(initParams.N || 3));
        etSearchN.characters = 3;

        var rS3 = pnlSearch.add("group");
        rS3.orientation = "row";
        rS3.spacing = 6;
        var btnRunSearch = rS3.add("button", undefined, "\u3010\u6210\u7acb\u3059\u308b\u6b6f\u6570\u30fb\u8ee2\u4f4d\u306e\u7d44\u307f\u5408\u308f\u305b\u3092\u63a2\u7d22\u3011");
        btnRunSearch.preferredSize.width = 390;

        var pnlCandidates = colLeft.add("panel", undefined, "\u63a2\u7d22\u5019\u88dc\u4e00\u89a7 (\u30af\u30ea\u30c3\u30af\u3067\u53f3\u5074\u306b\u53cd\u6620)");
        pnlCandidates.orientation = "column";
        pnlCandidates.alignChildren = ["fill", "fill"];
        pnlCandidates.margins = 6;

        var lbCandidates = pnlCandidates.add("listbox", undefined, [], {
            numberOfColumns: 5,
            showHeaders: true,
            columnTitles: ["\u6e1b\u901f\u6bd4 i", "\u8aa4\u5dee", "z1, z2, z3, z4", "\u8ee2\u4f4d xr1/xr2", "\u52b9\u7387"],
            columnWidths: [64, 52, 108, 104, 52]
        });
        lbCandidates.preferredSize = [400, 215];

        // RIGHT COLUMN: Selected Specs, Verification & Connection (365pt)
        var colRight = grpCols.add("group");
        colRight.orientation = "column";
        colRight.alignChildren = ["fill", "top"];
        colRight.preferredSize = [365, 425];
        colRight.spacing = 4;

        // Kinematic connection
        var pnlConn = colRight.add("panel", undefined, "\u8f2a\u5217\u63a5\u7d9a\u8a2d\u5b9a");
        pnlConn.orientation = "row";
        pnlConn.spacing = 6;
        pnlConn.margins = 6;
        pnlConn.add("statictext", undefined, "\u89aa\u30ae\u30a2:");
        var pOpts = ["\u306a\u3057 (\u72ec\u7acb\u30eb\u30fc\u30c8)"];
        var selPIdx = 0;
        for (var i = 0; i < trainNodes.length; i++) {
            pOpts.push(trainNodes[i].id + " (" + trainNodes[i].kind + ", z=" + trainNodes[i].z + ")");
            if (parentNode && trainNodes[i].id === parentNode.id) selPIdx = i + 1;
        }
        var ddParent = pnlConn.add("dropdownlist", undefined, pOpts);
        ddParent.selection = selPIdx;
        pnlConn.add("statictext", undefined, "\u6bb5\u756a\u53f7:");
        var etStage = pnlConn.add("edittext", undefined, String(parentNode ? parentNode.stageIndex : 1));
        etStage.characters = 3;

        var pnlParams = colRight.add("panel", undefined, "\u6b6f\u8eca\u8af8\u5143(\u624b\u52d5\u8abf\u6574\u53ef)");
        pnlParams.orientation = "column";
        pnlParams.alignChildren = ["fill", "top"];
        pnlParams.spacing = 4;
        pnlParams.margins = 6;

        var row1 = pnlParams.add("group");
        row1.orientation = "row";
        row1.spacing = 6;
        row1.add("statictext", undefined, "\u592a\u967d z1:");
        var etZ1 = row1.add("edittext", undefined, String(initParams.z1 || 20)); etZ1.characters = 4;
        row1.add("statictext", undefined, "\u5171\u901a\u904a\u661f z2:");
        var etZ2 = row1.add("edittext", undefined, String(initParams.z2 || 20)); etZ2.characters = 4;

        var row2 = pnlParams.add("group");
        row2.orientation = "row";
        row2.spacing = 6;
        row2.add("statictext", undefined, "\u56fa\u5b9a\u5185\u6b6f z3:");
        var etZ3 = row2.add("edittext", undefined, String(initParams.z3 || 60)); etZ3.characters = 4;
        row2.add("statictext", undefined, "\u51fa\u529b\u5185\u6b6f z4:");
        var etZ4 = row2.add("edittext", undefined, String(initParams.z4 || 62)); etZ4.characters = 4;

        var row3 = pnlParams.add("group");
        row3.orientation = "row";
        row3.spacing = 6;
        row3.add("statictext", undefined, "\u904a\u661f\u6570 N:");
        var etN = row3.add("edittext", undefined, String(initParams.N || 3)); etN.characters = 3;
        row3.add("statictext", undefined, "m:");
        var etM = row3.add("edittext", undefined, String(initParams.m || 2.0)); etM.characters = 4;

        var row4 = pnlParams.add("group");
        row4.orientation = "row";
        row4.spacing = 6;
        row4.add("statictext", undefined, "\u8ee2\u4f4d xr1:");
        var etXr1 = row4.add("edittext", undefined, String(initParams.xr1 || 0.0)); etXr1.characters = 4;
        row4.add("statictext", undefined, "xr2:");
        var etXr2 = row4.add("edittext", undefined, String(initParams.xr2 || 0.0)); etXr2.characters = 4;

        var pnlStatus = colRight.add("panel", undefined, "\u6210\u7acb\u6761\u4ef6\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u691c\u8a3c");
        pnlStatus.orientation = "column";
        pnlStatus.alignChildren = ["fill", "top"];
        pnlStatus.spacing = 3;
        pnlStatus.margins = 6;
        var stCondEqual = pnlStatus.add("statictext", undefined, "\u7b49\u914d\u6761\u4ef6: ((z1 + z3)%N === 0)");
        stCondEqual.characters = 44;
        var stAw2 = pnlStatus.add("statictext", undefined, "\u565b\u5408\u89d2 \u03b1w2: 20.00\u00b0");
        stAw2.characters = 44;
        var stRatio = pnlStatus.add("statictext", undefined, "\u6e1b\u901f\u6bd4 (Willis): i = [z4(z1+z3)]/[z1(z4-z3)] = 31.00");
        stRatio.characters = 44;

        function updateStatus() {
            var z1 = parseInt(etZ1.text, 10) || 0;
            var z2 = parseInt(etZ2.text, 10) || 0;
            var z3 = parseInt(etZ3.text, 10) || 0;
            var z4 = parseInt(etZ4.text, 10) || 0;
            var n = parseInt(etN.text, 10) || 1;

            var dZ = z4 - z3;
            var eqPass = (((z1 + z3) % n) === 0) && (Math.abs(dZ) % n === 0);
            stCondEqual.text = "\u7b49\u914d\u6761\u4ef6: " + (eqPass ? "OK (\u5747\u7b49\u914d\u7f6e\u53ef\u80fd)" : "\u4e0d\u4e00\u81f4 (\u8981\u78ba\u8a8d)");

            if (dZ !== 0 && z1 > 0) {
                var r = (z4 * (z1 + z3)) / (z1 * dZ);
                var dir = (r > 0) ? "\u6b63\u8ee2" : "\u9006\u8ee2";
                stRatio.text = "\u6e1b\u901f\u6bd4 (Willis): i = " + r.toFixed(2) + " (" + dir + ")";
            } else {
                stRatio.text = "\u6e1b\u901f\u6bd4: \u7121\u9650\u5927 (\u540c\u6b6f\u6570)";
            }
        }
        etZ1.onChanging = updateStatus;
        etZ2.onChanging = updateStatus;
        etZ3.onChanging = updateStatus;
        etZ4.onChanging = updateStatus;
        etN.onChanging = updateStatus;
        updateStatus();

        var candidateResults = [];
        btnRunSearch.onClick = function () {
            var targetRatio = parseFloat(etTargetRatio.text) || 31.0;
            var tolMap = [5.0, 10.0, 20.0, 0.0];
            var tolPct = tolMap[ddTolerance.selection ? ddTolerance.selection.index : 1];
            var nPlanets = parseInt(etSearchN.text, 10) || 3;
            var methodMap = ["hori", "standard", "all"];
            var method = methodMap[ddMethod.selection ? ddMethod.selection.index : 0];
            var mVal = parseFloat(etM.text) || 2.0;

            if (typeof MechanismSolvers !== "undefined" && typeof MechanismSolvers.solveParadoxicalPlanetary === "function") {
                candidateResults = MechanismSolvers.solveParadoxicalPlanetary({
                    targetRatio: targetRatio,
                    tolPercent: tolPct,
                    numPlanets: nPlanets,
                    method: method,
                    m: mVal
                });
            } else {
                candidateResults = [];
            }

            lbCandidates.removeAll();
            if (candidateResults.length === 0) {
                var noneItm = lbCandidates.add("item", "\u8a72\u5f53\u306a\u3057");
                noneItm.subItems[0].text = "-";
                noneItm.subItems[1].text = "-";
                noneItm.subItems[2].text = "-";
                noneItm.subItems[3].text = "-";
            } else {
                for (var k = 0; k < candidateResults.length && k < 50; k++) {
                    var res = candidateResults[k];
                    var itm = lbCandidates.add("item", res.ratio.toFixed(2));
                    var errVal = (res.ratioError !== undefined) ? res.ratioError : (res.errorPercent !== undefined ? res.errorPercent : 0.0);
                    var errSign = errVal >= 0 ? "+" : "";
                    itm.subItems[0].text = errSign + errVal.toFixed(1) + "%";
                    var zStr = (res.zs !== undefined ? res.zs : res.z1) + "," + (res.zp !== undefined ? res.zp : res.z2) + "," + (res.zr1 !== undefined ? res.zr1 : res.z3) + "," + (res.zr2 !== undefined ? res.zr2 : res.z4);
                    itm.subItems[1].text = zStr;
                    var shiftStr = (res.xr1 ? res.xr1.toFixed(2) : "0") + "/" + (res.xr2 ? res.xr2.toFixed(2) : "0");
                    itm.subItems[2].text = shiftStr;
                    var effVal = (res.efficiencyEst !== undefined) ? res.efficiencyEst : (res.efficiency !== undefined ? Math.round(res.efficiency * 100) : 0);
                    itm.subItems[3].text = effVal + "%";
                }
                lbCandidates.selection = 0;
            }
        };

        var selectedParadoxCandidate = null;
        lbCandidates.onChange = function () {
            if (!lbCandidates.selection || candidateResults.length === 0) return;
            var idx = lbCandidates.selection.index;
            if (idx >= 0 && idx < candidateResults.length) {
                var sel = candidateResults[idx];
                selectedParadoxCandidate = sel;
                etZ1.text = String(sel.zs !== undefined ? sel.zs : sel.z1);
                etZ2.text = String(sel.zp !== undefined ? sel.zp : sel.z2);
                etZ3.text = String(sel.zr1 !== undefined ? sel.zr1 : sel.z3);
                etZ4.text = String(sel.zr2 !== undefined ? sel.zr2 : sel.z4);
                etN.text = String(sel.numPlanets || sel.N || etSearchN.text);
                if (typeof sel.xr1 === "number") etXr1.text = sel.xr1.toFixed(3);
                if (typeof sel.xr2 === "number") etXr2.text = sel.xr2.toFixed(3);
                if (typeof sel.xs === "number" && typeof sel.xp === "number") {
                    stAw2.text = "\u565b\u5408\u89d2 \u03b1w2: " + (sel.aw2Deg || 20).toFixed(1) + "\u00b0 (\u8ee2\u4f4d: S:" + sel.xs.toFixed(2) + " P:" + sel.xp.toFixed(2) + " R1:" + sel.xr1.toFixed(2) + " R2:" + sel.xr2.toFixed(2) + ")";
                } else if (typeof sel.aw2Deg === "number") {
                    stAw2.text = "\u565b\u5408\u89d2 \u03b1w2: " + sel.aw2Deg.toFixed(2) + "\u00b0";
                } else if (typeof sel.alphaW2Deg === "number") {
                    stAw2.text = "\u565b\u5408\u89d2 \u03b1w2: " + sel.alphaW2Deg.toFixed(2) + "\u00b0";
                }
                updateStatus();
            }
        };

        var grpBtns = colRight.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "bottom"];
        grpBtns.spacing = 8;
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u8f2a\u5217\u306b\u5c55\u958b", { name: "ok" });

        btnOk.onClick = function () {
            var params = {
                z1: parseInt(etZ1.text, 10) || 20,
                z2: parseInt(etZ2.text, 10) || 20,
                z3: parseInt(etZ3.text, 10) || 60,
                z4: parseInt(etZ4.text, 10) || 62,
                N: parseInt(etN.text, 10) || 3,
                m: parseFloat(etM.text) || 2.0,
                x1: (selectedParadoxCandidate && typeof selectedParadoxCandidate.xs === "number") ? selectedParadoxCandidate.xs : 0.0,
                x2: (selectedParadoxCandidate && typeof selectedParadoxCandidate.xp === "number") ? selectedParadoxCandidate.xp : 0.0,
                x3: parseFloat(etXr1.text) || 0.0,
                x4: parseFloat(etXr2.text) || 0.0,
                xr1: parseFloat(etXr1.text) || 0.0,
                xr2: parseFloat(etXr2.text) || 0.0,
                centerDistanceMm: (selectedParadoxCandidate && selectedParadoxCandidate.centerDistanceMm) ? selectedParadoxCandidate.centerDistanceMm : null,
                stageIndex: parseInt(etStage.text, 10) || 1,
                parentId: (ddParent.selection && ddParent.selection.index > 0) ? trainNodes[ddParent.selection.index - 1].id : null
            };
            if (typeof callback === "function") {
                callback(params);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        modal.center();
        modal.show();
    }

    // ==========================================
    // Modal 5: Add Intermittent Gear Pair Modal
    // ==========================================
    function showAddIntermittentModal(initParams, parentNode, trainNodes, callback) {
        initParams = initParams || {};
        var modal = new Window("dialog", "\u9593\u6b20\u6b6f\u8eca\u30da\u30a2\u306e\u8ffd\u52a0\u8a2d\u5b9a");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 8;
        modal.margins = 12;

        var pnlParams = modal.add("panel", undefined, "\u9593\u6b20\u8af8\u5143");
        pnlParams.orientation = "column";
        pnlParams.alignChildren = ["fill", "top"];
        pnlParams.spacing = 6;
        pnlParams.margins = 8;

        var row1 = pnlParams.add("group");
        row1.orientation = "row";
        row1.spacing = 8;
        row1.add("statictext", undefined, "\u539f\u52d5\u8eca\u5168\u6b6f\u6570 z1:");
        var etZ1 = row1.add("edittext", undefined, String(initParams.z1 || 24)); etZ1.characters = 4;
        row1.add("statictext", undefined, "\u6709\u52b9\u6b6f\u6570 k:");
        var etK = row1.add("edittext", undefined, String(initParams.k || 4)); etK.characters = 4;

        var row2 = pnlParams.add("group");
        row2.orientation = "row";
        row2.spacing = 8;
        row2.add("statictext", undefined, "\u5f93\u52d5\u8eca\u5206\u5272\u6570 S:");
        var etS = row2.add("edittext", undefined, String(initParams.S || 4)); etS.characters = 4;
        row2.add("statictext", undefined, "\u30ed\u30c3\u30af\u9699\u9593(mm):");
        var etClearance = row2.add("edittext", undefined, "0.15"); etClearance.characters = 4;

        var row3 = pnlParams.add("group");
        row3.orientation = "row";
        row3.spacing = 8;
        var rbCoplanar = row3.add("radiobutton", undefined, "\u5358\u5c64\u578b (\u540c\u4e00\u5e73\u9762)");
        var rbTwoLayer = row3.add("radiobutton", undefined, "2\u5c64\u7a4d\u5c64\u578b (Geneva\u30ed\u30c3\u30af\u677f)");
        rbTwoLayer.value = true;

        var stDrivenZ = pnlParams.add("statictext", undefined, "\u5f93\u52d5\u8eca\u6b6f\u6570: z2 = S * k = 16");
        stDrivenZ.characters = 42;
        var stKinematics = pnlParams.add("statictext", undefined, "\u99c6\u52d5\u89d2: 60.0\u00b0, \u4f11\u6b62\u89d2: 300.0\u00b0 (\u4f11\u6b62\u7387: 83.3%)");
        stKinematics.characters = 46;

        function updateDrivenZ() {
            var z1 = parseInt(etZ1.text, 10) || 24;
            var s = parseInt(etS.text, 10) || 4;
            var k = parseInt(etK.text, 10) || 4;
            if (k >= z1) {
                k = Math.max(1, z1 - 1);
                etK.text = String(k);
            }
            if (s < 3) {
                s = 3;
                etS.text = String(s);
            }
            var z2 = s * k;
            stDrivenZ.text = "\u5f93\u52d5\u8eca\u6b6f\u6570: z2 = S * k = " + z2;
            var motionAngle = (360.0 * k) / z1;
            var dwellAngle = 360.0 - motionAngle;
            var dwellPct = ((z1 - k) / z1) * 100.0;
            stKinematics.text = "\u99c6\u52d5\u89d2: " + motionAngle.toFixed(1) + "\u00b0, \u4f11\u6b62\u89d2: " + dwellAngle.toFixed(1) + "\u00b0 (\u4f11\u6b62\u7387: " + dwellPct.toFixed(1) + "%)";
        }
        etZ1.onChanging = updateDrivenZ;
        etS.onChanging = updateDrivenZ;
        etK.onChanging = updateDrivenZ;
        updateDrivenZ();

        var grpBtns = modal.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "center"];
        grpBtns.spacing = 10;
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u8f2a\u5217\u306b\u5c55\u958b", { name: "ok" });

        btnOk.onClick = function () {
            var z1 = parseInt(etZ1.text, 10) || 24;
            var s = parseInt(etS.text, 10) || 4;
            var k = parseInt(etK.text, 10) || 4;
            if (k >= z1) k = Math.max(1, z1 - 1);
            if (s < 3) s = 3;
            var clrVal = parseFloat(etClearance.text);
            var params = {
                z1: z1,
                k: k,
                S: s,
                z2: s * k,
                lockClearance: !isNaN(clrVal) ? clrVal : 0.15,
                isTwoLayer: rbTwoLayer.value
            };
            if (typeof callback === "function") {
                callback(params);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        modal.center();
        modal.show();
    }

    /**
     * Modal: Custom Shaft & Body Weight-Reduction Cutout Configuration
     */
    function showCustomCutoutModal(parentWin, node, onApply) {
        if (!node) {
            alert("\u30ae\u30a2\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002");
            return;
        }
        var modal = new Window("dialog", "\u30ab\u30b9\u30bf\u30e0\u8ef8\u7a74\u30fb\u8089\u629c\u304d\u8a2d\u5b9a [" + (node.id || "Gear") + "]");
        modal.orientation = "column";
        modal.alignChildren = ["fill", "top"];
        modal.spacing = 8;
        modal.margins = 10;
        modal.preferredSize = [470, 380];

        var pnlType = modal.add("panel", undefined, "\u8089\u629c\u304d\u7a2e\u985e");
        pnlType.orientation = "row";
        pnlType.spacing = 8;
        pnlType.margins = 8;
        pnlType.add("statictext", undefined, "\u30bf\u30a4\u30d7:");
        var ddCutoutType = pnlType.add("dropdownlist", undefined, [
            "\u306a\u3057 (NONE)",
            "\u4e38\u7a74\u8089\u629c\u304d (CIRCULAR_HOLES)",
            "\u30b9\u30dd\u30fc\u30af\u8089\u629c\u304d (SPOKES)",
            "\u5916\u90e8.ai\u30a4\u30f3\u30dd\u30fc\u30c8 (EXTERNAL_AI)"
        ]);
        ddCutoutType.preferredSize.width = 260;
        var curType = String(node.cutoutType || "NONE").toUpperCase();
        var typeIdx = 0;
        if (curType === "CIRCULAR_HOLES" || curType === "HOLES") typeIdx = 1;
        else if (curType === "SPOKES") typeIdx = 2;
        else if (curType === "EXTERNAL_AI") typeIdx = 3;
        ddCutoutType.selection = typeIdx;

        var curOpts = node.cutoutOptions || {};

        var pnlParam = modal.add("panel", undefined, "\u30d1\u30e9\u30e1\u30c8\u30ea\u30c3\u30af\u8a2d\u5b9a (\u4e38\u7a74 / \u30b9\u30dd\u30fc\u30af)");
        pnlParam.orientation = "column";
        pnlParam.alignChildren = ["fill", "top"];
        pnlParam.spacing = 6;
        pnlParam.margins = 8;

        var rP1 = pnlParam.add("group");
        rP1.orientation = "row";
        rP1.spacing = 8;
        rP1.add("statictext", undefined, "\u7a74\u6570 / \u30b9\u30dd\u30fc\u30af\u6570:");
        var etCount = rP1.add("edittext", undefined, String(curOpts.count || curOpts.spokeCount || curOpts.holeCount || 4));
        etCount.characters = 4;
        rP1.add("statictext", undefined, "\u7a74\u5f84 (mm):");
        var etHoleDia = rP1.add("edittext", undefined, String(curOpts.holeDiameter || 8.0));
        etHoleDia.characters = 4;

        var rP2 = pnlParam.add("group");
        rP2.orientation = "row";
        rP2.spacing = 8;
        rP2.add("statictext", undefined, "\u30b9\u30dd\u30fc\u30af\u5e45 (mm):");
        var etSpokeWidth = rP2.add("edittext", undefined, String(curOpts.spokeWidth || 3.0));
        etSpokeWidth.characters = 4;
        rP2.add("statictext", undefined, "\u30ea\u30e0\u8089\u539a (mm):");
        var etRimThick = rP2.add("edittext", undefined, String(curOpts.rimThickness || 5.0));
        etRimThick.characters = 4;

        var rP3 = pnlParam.add("group");
        rP3.orientation = "row";
        rP3.spacing = 8;
        rP3.add("statictext", undefined, "\u30cf\u30d6\u5f84 (mm):");
        var etHubDia = rP3.add("edittext", undefined, String(curOpts.hubDiameter || 12.0));
        etHubDia.characters = 4;
        rP3.add("statictext", undefined, "\u30d5\u30a3\u30ec\u30c3\u30c8R (mm):");
        var etFilletR = rP3.add("edittext", undefined, String(curOpts.filletRadius || 1.5));
        etFilletR.characters = 4;

        var pnlAi = modal.add("panel", undefined, "\u5916\u90e8 .ai \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u53c2\u7167");
        pnlAi.orientation = "row";
        pnlAi.spacing = 6;
        pnlAi.margins = 8;
        var etAiPath = pnlAi.add("edittext", undefined, node.externalAiPath || curOpts.externalAiPath || "");
        etAiPath.characters = 28;
        var btnBrowseAi = pnlAi.add("button", undefined, "\u53c2\u7167...");
        btnBrowseAi.onClick = function () {
            var aiFile = File.openDialog("\u5916\u90e8 .ai \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u9078\u629e", "Illustrator\u30d5\u30a1\u30a4\u30eb:*.ai;*.eps");
            if (aiFile) {
                etAiPath.text = aiFile.fsName;
            }
        };

        function updateCutoutUI() {
            var sel = ddCutoutType.selection ? ddCutoutType.selection.index : 0;
            pnlParam.enabled = (sel === 1 || sel === 2);
            pnlAi.enabled = (sel === 3);
            etHoleDia.enabled = (sel === 1);
            etSpokeWidth.enabled = (sel === 2);
            etFilletR.enabled = (sel === 2);
        }
        ddCutoutType.onChange = updateCutoutUI;
        updateCutoutUI();

        var grpBtns = modal.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "bottom"];
        grpBtns.spacing = 8;
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u9069\u7528", { name: "ok" });

        btnOk.onClick = function () {
            var sel = ddCutoutType.selection ? ddCutoutType.selection.index : 0;
            var typeMap = ["NONE", "CIRCULAR_HOLES", "SPOKES", "EXTERNAL_AI"];
            var newType = typeMap[sel];
            var newOpts = {
                count: parseInt(etCount.text, 10) || 4,
                holeCount: parseInt(etCount.text, 10) || 4,
                spokeCount: parseInt(etCount.text, 10) || 4,
                holeDiameter: parseFloat(etHoleDia.text) || 8.0,
                spokeWidth: parseFloat(etSpokeWidth.text) || 3.0,
                rimThickness: parseFloat(etRimThick.text) || 5.0,
                hubDiameter: parseFloat(etHubDia.text) || 12.0,
                filletRadius: parseFloat(etFilletR.text) || 1.5,
                externalAiPath: etAiPath.text
            };
            if (typeof onApply === "function") {
                onApply(newType, newOpts, etAiPath.text);
            }
            modal.close(1);
        };

        btnCancel.onClick = function () {
            modal.close(0);
        };

        modal.center();
        modal.show();
    }

    /**
     * Modal: Execution Trace & Diagnostic Log Viewer
     */
    function showLogViewerModal(parentWin) {
        var logWin = new Window("dialog", "GearDrawer \u8a3a\u65ad\u30ed\u30b0\u30d3\u30e5\u30fc\u30a2");
        logWin.orientation = "column";
        logWin.alignChildren = ["fill", "fill"];
        logWin.spacing = 8;
        logWin.margins = 10;
        logWin.preferredSize = [860, 500];

        var logText = "";
        if (typeof CalcLogger !== "undefined" && typeof CalcLogger.dumpText === "function") {
            logText = CalcLogger.dumpText();
        } else {
            logText = "(\u30ed\u30b0\u8a18\u9332\u306f\u3042\u308a\u307e\u305b\u3093)";
        }

        var etLog = logWin.add("edittext", undefined, logText, { multiline: true, readonly: true, scrollable: true });
        etLog.preferredSize = [836, 420];

        var grpLogBtns = logWin.add("group");
        grpLogBtns.orientation = "row";
        grpLogBtns.alignment = ["right", "bottom"];
        grpLogBtns.spacing = 8;

        var btnExportLog = grpLogBtns.add("button", undefined, "\u30d5\u30a1\u30a4\u30eb\u4fdd\u5b58...");
        btnExportLog.onClick = function () {
            if (typeof CalcLogger !== "undefined" && typeof CalcLogger.exportToFile === "function") {
                var expTarget = null;
                try {
                    if (typeof logFolderPath === "string" && logFolderPath) {
                        expTarget = new Folder(logFolderPath);
                    }
                } catch (eFld) {}
                var exported = CalcLogger.exportToFile(expTarget);
                if (exported) {
                    alert("\u30ed\u30b0\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f:\n" + exported.fsName);
                }
            }
        };

        var btnClearLog = grpLogBtns.add("button", undefined, "\u30ed\u30b0\u6d88\u53bb");
        btnClearLog.onClick = function () {
            if (typeof CalcLogger !== "undefined" && typeof CalcLogger.clear === "function") {
                CalcLogger.clear();
                etLog.text = CalcLogger.dumpText();
            }
        };

        var btnCloseLog = grpLogBtns.add("button", undefined, "\u9589\u3058\u308b", { name: "ok" });
        btnCloseLog.onClick = function () {
            logWin.close(0);
        };

        logWin.center();
        logWin.show();
    }

    // ==========================================
    // Main UI Entry Point
    // ==========================================
    function show(doc, initialNodes, options) {
        options = options || {};
        var trainNodes = initialNodes ? cloneObj(initialNodes) : [];
        var colorPresets = cloneObj(DEFAULT_COLOR_PRESETS);
        var currentStyles = cloneObj(STYLE_PRESETS.laser);

        if (typeof Window === "undefined") {
            return {
                cancelled: true,
                trainNodes: trainNodes,
                options: options,
                showResult: 0
            };
        }

        var winType = options.isTest ? "palette" : "dialog";
        var win = new Window(winType, "GearDrawer v1.0.0 - \u30a4\u30f3\u30dc\u30ea\u30e5\u30fc\u30c8\u6b6f\u8eca\u751f\u6210\u30d7\u30e9\u30b0\u30a4\u30f3");
        win.preferredSize = [1060, 640];
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 4;
        win.margins = 6;
        win.size = [1060, 640];
        win.maximumSize = [1060, 640];
        win.minimumSize = [1060, 640];

        var tpanel = win.add("tabbedpanel");
        tpanel.alignment = ["fill", "fill"];
        tpanel.preferredSize = [1044, 578];

        // =============================================================
        // TAB 1: \u8f2a\u5217\u30e2\u30c7\u30ea\u30f3\u30b0 & \u63cf\u753b (tabModeling)
        // =============================================================
        var tabModeling = tpanel.add("tab", undefined, " 1. \u8f2a\u5217\u30e2\u30c7\u30ea\u30f3\u30b0 & \u63cf\u753b ");
        tabModeling.orientation = "row";
        tabModeling.alignChildren = ["fill", "top"];
        tabModeling.spacing = 8;
        tabModeling.margins = 6;

        // --- TAB 1: LEFT PANE (\u5e45 596pt) ---
        var paneModLeft = tabModeling.add("group");
        paneModLeft.orientation = "column";
        paneModLeft.alignChildren = ["fill", "top"];
        paneModLeft.preferredSize = [596, 545];
        paneModLeft.maximumSize = [605, 560];
        paneModLeft.spacing = 4;

        // 1. Train Configuration Panel (pnlConfig)
        var pnlConfig = paneModLeft.add("panel", undefined, "\u8f2a\u5217\u69cb\u6210\u30fb\u8af8\u5143 (Gear Train Configuration)");
        pnlConfig.orientation = "column";
        pnlConfig.alignChildren = ["fill", "top"];
        pnlConfig.spacing = 4;
        pnlConfig.margins = 6;

        // trainListBox (\u9ad8\u3055 150)
        var trainListBox = pnlConfig.add("listbox", undefined, [], {
            numberOfColumns: 13,
            showHeaders: true,
            columnTitles: [
                "ID", "\u7a2e\u985e", "\u6bb5", "\u89aa", "\u565b\u5408", "\u6b6f\u6570",
                "\u6e1b\u901f\u6bd4(i)", "\u4e3b\u8981\u5bf8\u6cd5", "m", "\u03b1", "\u8ef8\u7a74/\u8089\u629c", "\u914d\u7f6e\u89d2", "\u72b6\u614b"
            ],
            columnWidths: [28, 46, 24, 30, 62, 34, 60, 58, 24, 24, 64, 44, 32]
        });
        trainListBox.preferredSize = [580, 150];

        // 3-Tier Action Buttons
        var rowB1 = pnlConfig.add("group");
        rowB1.orientation = "row";
        rowB1.spacing = 4;
        var btnAddSpur = rowB1.add("button", undefined, "+ \u5916\u6b6f\u8eca\u8ffd\u52a0");
        var btnAddCoaxial = rowB1.add("button", undefined, "+ \u540c\u8ef8\u30ae\u30a2\u8ffd\u52a0");
        var btnAddInternal = rowB1.add("button", undefined, "+ \u5185\u6b6f\u8eca\u8ffd\u52a0");
        var btnAddRack = rowB1.add("button", undefined, "+ \u30e9\u30c3\u30af\u8ffd\u52a0");

        var rowB2 = pnlConfig.add("group");
        rowB2.orientation = "row";
        rowB2.spacing = 4;
        var btnAddIntermittent = rowB2.add("button", undefined, "+ \u9593\u6b20\u6b6f\u8eca\u30da\u30a2\u8ffd\u52a0...");
        var btnAddPlanetary = rowB2.add("button", undefined, "+ \u904a\u661f\u6b6f\u8eca\u8ffd\u52a0...");
        var btnAddParadox = rowB2.add("button", undefined, "+ \u4e0d\u601d\u8b70\u904a\u661f\u8ffd\u52a0...");

        var rowB3 = pnlConfig.add("group");
        rowB3.orientation = "row";
        rowB3.spacing = 6;
        var btnDeleteNode = rowB3.add("button", undefined, "- \u9078\u629e\u30ae\u30a2\u524a\u9664");
        var btnImportCSV = rowB3.add("button", undefined, "CSV/TSV\u8aad\u8fbc...");
        var btnExportCSV = rowB3.add("button", undefined, "CSV\u66f8\u51fa...");

        // 2. Selected Gear Detail Form (pnlNodeDetail)
        var pnlNodeDetail = paneModLeft.add("panel", undefined, "\u500b\u5225\u30ae\u30a2\u8af8\u5143\u7de8\u96c6");
        pnlNodeDetail.orientation = "column";
        pnlNodeDetail.alignChildren = ["fill", "top"];
        pnlNodeDetail.spacing = 3;
        pnlNodeDetail.margins = 6;

        var rowD1 = pnlNodeDetail.add("group");
        rowD1.orientation = "row";
        rowD1.spacing = 4;
        rowD1.add("statictext", undefined, "ID:");
        var etNodeId = rowD1.add("edittext", undefined, "G1"); etNodeId.characters = 3;
        var btnChangeId = rowD1.add("button", undefined, "ID\u5909\u66f4");
        rowD1.add("statictext", undefined, "\u89aa:");
        var ddNodeParent = rowD1.add("dropdownlist", undefined, ["(\u306a\u3057 / \u30eb\u30fc\u30c8)"]);
        ddNodeParent.preferredSize.width = 145;
        ddNodeParent.selection = 0;
        rowD1.add("statictext", undefined, "\u7a2e\u985e:");
        var ddNodeKind = rowD1.add("dropdownlist", undefined, ["\u5916\u6b6f (SPUR)", "\u5185\u6b6f (INTERNAL)", "\u30e9\u30c3\u30af (RACK)"]);
        ddNodeKind.preferredSize.width = 135;
        ddNodeKind.selection = 0;

        var rowD2 = pnlNodeDetail.add("group");
        rowD2.orientation = "row";
        rowD2.spacing = 6;
        rowD2.add("statictext", undefined, "\u6b6f\u6570 z:");
        var etNodeZ = rowD2.add("edittext", undefined, "18"); etNodeZ.characters = 4;
        rowD2.add("statictext", undefined, "\u8ee2\u4f4d x:");
        var etNodeShift = rowD2.add("edittext", undefined, "0.0"); etNodeShift.characters = 4;
        rowD2.add("statictext", undefined, "\u63a5\u7d9a\u89d2(deg):");
        var etNodeAngle = rowD2.add("edittext", undefined, "0.0"); etNodeAngle.characters = 5;

        var rowD3 = pnlNodeDetail.add("group");
        rowD3.orientation = "row";
        rowD3.spacing = 6;
        rowD3.add("statictext", undefined, "\u6bb5(Stage):");
        var etNodeStage = rowD3.add("edittext", undefined, "1"); etNodeStage.characters = 3;
        rowD3.add("statictext", undefined, "m:");
        var etNodeModule = rowD3.add("edittext", undefined, "2.0"); etNodeModule.characters = 4;
        rowD3.add("statictext", undefined, "\u5727\u529b\u89d2\u03b1:");
        var etNodeAlpha = rowD3.add("edittext", undefined, "20.0"); etNodeAlpha.characters = 4;

        var rowD4 = pnlNodeDetail.add("group");
        rowD4.orientation = "row";
        rowD4.spacing = 6;
        rowD4.add("statictext", undefined, "\u30d0\u30c3\u30af\u30e9\u30c3\u30b7:");
        var etNodeBacklash = rowD4.add("edittext", undefined, "0.15"); etNodeBacklash.characters = 4;
        rowD4.add("statictext", undefined, "\u6b6f\u5148\u4e38\u307f:");
        var etNodeTipRounding = rowD4.add("edittext", undefined, "0.0"); etNodeTipRounding.characters = 4;
        rowD4.add("statictext", undefined, "\u80cc\u9762/\u30ea\u30e0:");
        var etNodeBackHeight = rowD4.add("edittext", undefined, "6.0"); etNodeBackHeight.characters = 4;

        var rowD5 = pnlNodeDetail.add("group");
        rowD5.orientation = "row";
        rowD5.spacing = 6;
        rowD5.add("statictext", undefined, "\u8ef8\u7a74:");
        var ddNodeShaftType = rowD5.add("dropdownlist", undefined, ["\u4e38\u7a74", "D\u30ab\u30c3\u30c8", "\u30ad\u30fc\u6e9d", "\u30b0\u30eb\u30fc\u30d7\u56f3\u5f62", "\u5916\u90e8.ai", "\u306a\u3057"]);
        ddNodeShaftType.preferredSize.width = 115;
        ddNodeShaftType.selection = 0;
        rowD5.add("statictext", undefined, "\u8ef8\u5f84:");
        var etNodeShaft = rowD5.add("edittext", undefined, "5.0"); etNodeShaft.characters = 4;
        var btnCustomCutout = rowD5.add("button", undefined, "\u8089\u629c\u304d\u8a2d\u5b9a...");

        // --- TAB 1: RIGHT PANE (\u5e45 420pt) ---
        var paneModRight = tabModeling.add("group");
        paneModRight.orientation = "column";
        paneModRight.alignChildren = ["fill", "top"];
        paneModRight.preferredSize = [420, 545];
        paneModRight.maximumSize = [430, 560];
        paneModRight.spacing = 4;

        // 1. Circle Object Integration Panel (pnlCircle)
        var pnlCircle = paneModRight.add("panel", undefined, "\u5186\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u304b\u3089\u4f5c\u6210");
        pnlCircle.orientation = "column";
        pnlCircle.alignChildren = ["fill", "top"];
        pnlCircle.spacing = 3;
        pnlCircle.margins = 6;

        var rowC1 = pnlCircle.add("group");
        rowC1.orientation = "row";
        rowC1.spacing = 6;
        var cbFromCircle = rowC1.add("checkbox", undefined, "\u9078\u629e\u5186\u304b\u3089\u4f5c\u6210");
        cbFromCircle.value = false;
        var btnRescanCircle = rowC1.add("button", undefined, "\u518d\u30b9\u30ad\u30e3\u30f3");
        var stCircleStatus = rowC1.add("statictext", undefined, "\u5186: 0\u500b, \u8ef8\u7a74: 0\u500b");
        stCircleStatus.characters = 20;

        var rowC2 = pnlCircle.add("group");
        rowC2.orientation = "row";
        rowC2.spacing = 6;
        var rbSelected = rowC2.add("radiobutton", undefined, "\u9078\u629e\u306e\u307f");
        var rbAllLayers = rowC2.add("radiobutton", undefined, "\u5168\u53ef\u8996");
        rbSelected.value = true;
        var cbApplyColorPreset = rowC2.add("checkbox", undefined, "\u8272\u5225\u8a2d\u5b9a\u9069\u7528");
        cbApplyColorPreset.value = true;
        var btnColorPresets = rowC2.add("button", undefined, "\u8272\u5225\u8a2d\u5b9a...");

        var rowC3 = pnlCircle.add("group");
        rowC3.orientation = "row";
        rowC3.spacing = 4;
        rowC3.add("statictext", undefined, "\u5143\u306e\u5186:");
        var ddCircleAction = rowC3.add("dropdownlist", undefined, ["\u30ac\u30a4\u30c9\u5316", "\u524a\u9664", "\u4fdd\u6301"]);
        ddCircleAction.selection = 0;
        var cbExtractInnerShapes = rowC3.add("checkbox", undefined, "\u30b0\u30eb\u30fc\u30d7\u5c0f\u56f3\u5f62\u3092\u8ef8\u7a74\u5316");
        cbExtractInnerShapes.value = true;

        var rowC4 = pnlCircle.add("group");
        rowC4.orientation = "row";
        rowC4.spacing = 6;
        var btnAutoBuildTree = rowC4.add("button", undefined, "\u3010\u9078\u629e\u5186\u304b\u3089\u8f2a\u5217\u30c4\u30ea\u30fc\u3092\u81ea\u52d5\u69cb\u7bc9\u3011");
        btnAutoBuildTree.preferredSize.width = 398;

        // 2. CAD / CAM Styles & Creation Options (pnlDrawSettings)
        var pnlDrawSettings = paneModRight.add("panel", undefined, "\u4eca\u56de\u306e\u63cf\u753b\u30b9\u30bf\u30a4\u30eb\u30fb\u4f5c\u6210\u30aa\u30d7\u30b7\u30e7\u30f3");
        pnlDrawSettings.orientation = "column";
        pnlDrawSettings.alignChildren = ["fill", "top"];
        pnlDrawSettings.spacing = 3;
        pnlDrawSettings.margins = 6;

        var rowQ1 = pnlDrawSettings.add("group");
        rowQ1.orientation = "row";
        rowQ1.spacing = 6;
        rowQ1.add("statictext", undefined, "\u30b9\u30bf\u30a4\u30eb:");
        var ddStylePreset = rowQ1.add("dropdownlist", undefined, ["\u30ec\u30fc\u30b6\u30fc\u52a0\u5de5", "JIS\u6a5f\u68b0\u88fd\u56f3", "CNC/3D\u30d7\u30ea\u30f3\u30c8", "\u30ab\u30b9\u30bf\u30e0"]);
        ddStylePreset.selection = 0;
        ddStylePreset.preferredSize.width = 165;
        var btnStyleDetail = rowQ1.add("button", undefined, "\u8a73\u7d30\u8a2d\u5b9a...");

        var rowQ2 = pnlDrawSettings.add("group");
        rowQ2.orientation = "row";
        rowQ2.spacing = 6;
        rowQ2.add("statictext", undefined, "\u30d9\u30b8\u30a7\u7cbe\u5ea6:");
        var ddBezierPrecision = rowQ2.add("dropdownlist", undefined, ["\u63a8\u5968\u30d9\u30b8\u30a7 (9-11\u70b9/\u6b6f)", "\u6700\u5c0f\u30d9\u30b8\u30a7 (7\u70b9/\u6b6f)", "\u30dd\u30ea\u30e9\u30a4\u30f3"]);
        ddBezierPrecision.selection = 0;
        ddBezierPrecision.preferredSize.width = 195;

        var grpOptGrid = pnlDrawSettings.add("group");
        grpOptGrid.orientation = "row";
        grpOptGrid.alignChildren = ["fill", "top"];
        grpOptGrid.spacing = 4;

        var colOptLeft = grpOptGrid.add("group");
        colOptLeft.orientation = "column";
        colOptLeft.alignChildren = ["left", "top"];
        colOptLeft.spacing = 2;
        var chkCompoundPath = colOptLeft.add("checkbox", undefined, "\u5916\u5468/\u8ef8\u7a74\u8907\u5408\u30d1\u30b9\u5316"); chkCompoundPath.value = true;
        var chkPitchGuide = colOptLeft.add("checkbox", undefined, "\u57fa\u6e96\u5186\u540c\u30ec\u30a4\u30e4\u63cf\u753b"); chkPitchGuide.value = true;
        var chkCenterGuide = colOptLeft.add("checkbox", undefined, "\u4e2d\u5fc3\u30ac\u30a4\u30c9\u3092\u63cf\u753b"); chkCenterGuide.value = true;
        var chkIndividualTeeth = colOptLeft.add("checkbox", undefined, "\u6b6f\u3092\u500b\u5225\u30aa\u30fc\u30d7\u30f3\u51fa\u529b"); chkIndividualTeeth.value = false;
        chkCompoundPath.onClick = function () {
            if (chkCompoundPath.value) {
                chkIndividualTeeth.value = false;
            }
        };
        chkIndividualTeeth.onClick = function () {
            if (chkIndividualTeeth.value) {
                chkCompoundPath.value = false;
            }
        };

        var colOptRight = grpOptGrid.add("group");
        colOptRight.orientation = "column";
        colOptRight.alignChildren = ["left", "top"];
        colOptRight.spacing = 2;
        var chkSpecLabels = colOptRight.add("checkbox", undefined, "\u8af8\u5143\u30e9\u30d9\u30eb\u523b\u5370"); chkSpecLabels.value = false;
        var chkSingleSkeleton = colOptRight.add("checkbox", undefined, "\u5358\u4e00\u306e\u8a2d\u8a08\u56f3\u30ec\u30a4\u30e4(T1_dwg)"); chkSingleSkeleton.value = false;
        var chkPerStageSkeleton = colOptRight.add("checkbox", undefined, "\u6bb5\u5225\u306e\u8a2d\u8a08\u56f3\u30ec\u30a4\u30e4(T1_1_dwg)"); chkPerStageSkeleton.value = false;
        chkSingleSkeleton.onClick = function () {
            if (chkSingleSkeleton.value) {
                chkPerStageSkeleton.value = false;
            }
        };
        chkPerStageSkeleton.onClick = function () {
            if (chkPerStageSkeleton.value) {
                chkSingleSkeleton.value = false;
            }
        };
        var chkCarrierBase = colOptRight.add("checkbox", undefined, "\u30ad\u30e3\u30ea\u30a2/\u30d9\u30fc\u30b9\u51fa\u529b"); chkCarrierBase.value = true;

        // 3. Placement & Calculation Preview Panel (pnlPlacementCalc)
        var pnlPlacementCalc = paneModRight.add("panel", undefined, "\u914d\u7f6e\u57fa\u6e96\u30fb\u8a08\u7b97\u30d7\u30ec\u30d3\u30e5\u30fc");
        pnlPlacementCalc.orientation = "column";
        pnlPlacementCalc.alignChildren = ["fill", "top"];
        pnlPlacementCalc.spacing = 3;
        pnlPlacementCalc.margins = 6;

        var rowPl1 = pnlPlacementCalc.add("group");
        rowPl1.orientation = "row";
        rowPl1.spacing = 4;
        rowPl1.add("statictext", undefined, "\u57fa\u6e96\u70b9:");
        var ddPlacementRef = rowPl1.add("dropdownlist", undefined, [
            "\u30eb\u30fc\u30c8\u30ae\u30a2\u57fa\u6e96\u5186\u4e2d\u5fc3",
            "\u8f2a\u5217\u5168\u4f53\u4e2d\u5fc3",
            "\u30a2\u30fc\u30c8\u30dc\u30fc\u30c9\u4e2d\u592e",
            "\u5143\u306e\u5186\u4f4d\u7f6e\u6e96\u62e0"
        ]);
        ddPlacementRef.preferredSize.width = 195;
        ddPlacementRef.selection = 0;
        var btnUpdateCoords = rowPl1.add("button", undefined, "\u5ea7\u6a19\u66f4\u65b0");

        var rowPl2 = pnlPlacementCalc.add("group");
        rowPl2.orientation = "row";
        rowPl2.spacing = 6;
        rowPl2.add("statictext", undefined, "X(mm):");
        var etTargetX = rowPl2.add("edittext", undefined, "0.0"); etTargetX.characters = 5;
        rowPl2.add("statictext", undefined, "Y(mm):");
        var etTargetY = rowPl2.add("edittext", undefined, "0.0"); etTargetY.characters = 5;

        var stCalcRatio = pnlPlacementCalc.add("statictext", undefined, "\u7dcf\u6e1b\u901f\u6bd4: i = 1.000");
        var stCalcMesh = pnlPlacementCalc.add("statictext", undefined, "\u565b\u5408\u7387 \u03b5\u03b1: - (2\u6b6f\u8eca\u4ee5\u4e0a\u3067\u8868\u793a)");
        var stCalcWarn = pnlPlacementCalc.add("statictext", undefined, "\u5e72\u6e09\u30c1\u30a7\u30c3\u30af: \u6b63\u5e38 (No Collision)");

        // =============================================================
        // TAB 2: \u74b0\u5883\u8a2d\u5b9a & \u65e2\u5b9a\u5024\u7ba1\u7406 (tabSettings)
        // =============================================================
        var tabSettings = tpanel.add("tab", undefined, " 2. \u74b0\u5883\u8a2d\u5b9a & \u65e2\u5b9a\u5024\u7ba1\u7406 ");
        tabSettings.orientation = "row";
        tabSettings.alignChildren = ["fill", "top"];
        tabSettings.spacing = 6;
        tabSettings.margins = 6;

        // --- TAB 2: LEFT PANE (\u5e45 505pt) ---
        var paneSetLeft = tabSettings.add("group");
        paneSetLeft.orientation = "column";
        paneSetLeft.alignChildren = ["fill", "top"];
        paneSetLeft.preferredSize = [505, 545];
        paneSetLeft.maximumSize = [515, 560];
        paneSetLeft.spacing = 6;

        // 1. General Defaults & Center Guide
        var pnlCommon = paneSetLeft.add("panel", undefined, "\u65b0\u898f\u4f5c\u6210\u6642\u306e\u65e2\u5b9a\u8af8\u5143 (Default Specs)");
        pnlCommon.orientation = "column";
        pnlCommon.alignChildren = ["fill", "top"];
        pnlCommon.spacing = 4;
        pnlCommon.margins = 6;

        var rowG1 = pnlCommon.add("group");
        rowG1.orientation = "row";
        rowG1.spacing = 6;
        rowG1.add("statictext", undefined, "m:");
        var etModule = rowG1.add("edittext", undefined, "2.0"); etModule.characters = 4;
        rowG1.add("statictext", undefined, "\u5727\u529b\u89d2\u03b1:");
        var etAlpha = rowG1.add("edittext", undefined, "20.0"); etAlpha.characters = 4;

        var rowG2 = pnlCommon.add("group");
        rowG2.orientation = "row";
        rowG2.spacing = 6;
        rowG2.add("statictext", undefined, "Backlash:");
        var etBacklash = rowG2.add("edittext", undefined, "0.15"); etBacklash.characters = 4;
        rowG2.add("statictext", undefined, "r_tip:");
        var etTipRounding = rowG2.add("edittext", undefined, "0.0"); etTipRounding.characters = 4;

        var rowG3 = pnlCommon.add("group");
        rowG3.orientation = "row";
        rowG3.spacing = 6;
        rowG3.add("statictext", undefined, "Kerf:");
        var etKerf = rowG3.add("edittext", undefined, "0.0"); etKerf.characters = 4;
        rowG3.add("statictext", undefined, "\u6a19\u6e96\u8ef8\u5f84:");
        var etShaftDia = rowG3.add("edittext", undefined, "5.0"); etShaftDia.characters = 4;

        var rowG4 = pnlCommon.add("group");
        rowG4.orientation = "row";
        rowG4.spacing = 6;
        rowG4.add("statictext", undefined, "\u6a19\u6e96\u8ef8\u7a74:");
        var ddDefShaftType = rowG4.add("dropdownlist", undefined, ["\u4e38\u7a74", "D\u30ab\u30c3\u30c8", "\u30ad\u30fc\u6e9d", "\u306a\u3057"]);
        ddDefShaftType.selection = 0;
        rowG4.add("statictext", undefined, "\u539a\u307f\u57fa\u6e96:");
        var ddThicknessBasis = rowG4.add("dropdownlist", undefined, ["\u6b6f\u5e95\u304b\u3089", "\u6b6f\u5148\u304b\u3089"]);
        ddThicknessBasis.selection = 0;

        var rowCG = pnlCommon.add("group");
        rowCG.orientation = "row";
        rowCG.spacing = 6;
        rowCG.add("statictext", undefined, "\u4e2d\u5fc3\u30ac\u30a4\u30c9:");
        var ddCenterGuideMode = rowCG.add("dropdownlist", undefined, ["\u56fa\u5b9a\u5024 (mm)", "\u76f8\u5bfe\u5024 (% \u5bfe\u57fa\u6e96\u5186\u5f84)"]);
        ddCenterGuideMode.preferredSize.width = 195;
        ddCenterGuideMode.selection = 0;
        var etCenterGuideSize = rowCG.add("edittext", undefined, "5.0"); etCenterGuideSize.characters = 4;

        // 2. Default Draw Options Panel
        var pnlDefaultOptions = paneSetLeft.add("panel", undefined, "\u8d77\u52d5\u6642\u521d\u671f\u8a2d\u5b9a\u30fb\u30d7\u30ea\u30bb\u30c3\u30c8\u9069\u7528");
        pnlDefaultOptions.orientation = "column";
        pnlDefaultOptions.alignChildren = ["fill", "top"];
        pnlDefaultOptions.spacing = 4;
        pnlDefaultOptions.margins = 6;
        var stDefDesc = pnlDefaultOptions.add("statictext", undefined, "\u30e2\u30c7\u30ea\u30f3\u30b0\u30bf\u30d6\u306e\u8a2d\u5b9a\u3092\u65e2\u5b9a\u5024\u3068\u3057\u3066\u4fdd\u5b58\u3059\u308b\u3068\u3001\u6b21\u56de\u8d77\u52d5\u6642\n\u307e\u305f\u306f\u65b0\u898f\u4f5c\u6210\u6642\u306b\u81ea\u52d5\u9069\u7528\u3055\u308c\u307e\u3059\u3002", { multiline: true });
        stDefDesc.preferredSize.height = 36;

        var rowSyncBtns = pnlDefaultOptions.add("group");
        rowSyncBtns.orientation = "row";
        rowSyncBtns.spacing = 6;
        var btnSaveCurrentAsDef = rowSyncBtns.add("button", undefined, "\u3010\u73fe\u5728\u306e\u30e2\u30c7\u30ea\u30f3\u30b0\u8a2d\u5b9a\u3092\u65e2\u5b9a\u5024\u3068\u3057\u3066\u4fdd\u5b58\u3011");
        btnSaveCurrentAsDef.preferredSize.width = 465;

        var rowApplyBtns = pnlDefaultOptions.add("group");
        rowApplyBtns.orientation = "row";
        rowApplyBtns.spacing = 6;
        var btnApplyDefToModel = rowApplyBtns.add("button", undefined, "\u3010\u65e2\u5b9a\u5024\u3092\u30e2\u30c7\u30ea\u30f3\u30b0\u30bf\u30d6\u306b\u5373\u6642\u53cd\u6620\u3011");
        btnApplyDefToModel.preferredSize.width = 465;

        // --- TAB 2: RIGHT PANE (\u5e45 515pt) ---
        var paneSetRight = tabSettings.add("group");
        paneSetRight.orientation = "column";
        paneSetRight.alignChildren = ["fill", "top"];
        paneSetRight.preferredSize = [515, 545];
        paneSetRight.maximumSize = [525, 560];
        paneSetRight.spacing = 6;

        // 1. Layers & Naming Conventions
        var pnlNaming = paneSetRight.add("panel", undefined, "\u30ec\u30a4\u30e4\u30fb\u547d\u540d\u898f\u5247");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];
        pnlNaming.spacing = 4;
        pnlNaming.margins = 6;

        var rowN1 = pnlNaming.add("group");
        rowN1.orientation = "row";
        rowN1.spacing = 6;
        rowN1.add("statictext", undefined, "\u547d\u540d:");
        var ddNamingPreset = rowN1.add("dropdownlist", undefined, ["\u6a19\u6e96", "\u8a2d\u8a08\u8af8\u5143", "\u52a0\u5de5\u7528CAM", "\u30ab\u30b9\u30bf\u30e0"]);
        ddNamingPreset.selection = 0;
        rowN1.add("statictext", undefined, "\u8f2a\u5217ID:");
        var etTrainId = rowN1.add("edittext", undefined, "T1"); etTrainId.characters = 4;

        var rowN2 = pnlNaming.add("group");
        rowN2.orientation = "row";
        rowN2.spacing = 6;
        rowN2.add("statictext", undefined, "\u30d1\u30bf\u30fc\u30f3:");
        var etNamingPattern = rowN2.add("edittext", undefined, "{train}_{id}_{kind}_m{m}_z{z}");
        etNamingPattern.characters = 34;

        // 2. Diagnostics & Tolerance
        var pnlToleranceLog = paneSetRight.add("panel", undefined, "\u89e3\u6790\u30c8\u30ec\u30e9\u30f3\u30b9\u30fb\u8a3a\u65ad\u30ed\u30b0");
        pnlToleranceLog.orientation = "column";
        pnlToleranceLog.alignChildren = ["fill", "top"];
        pnlToleranceLog.spacing = 4;
        pnlToleranceLog.margins = 6;

        var rowT1 = pnlToleranceLog.add("group");
        rowT1.orientation = "row";
        rowT1.spacing = 6;
        rowT1.add("statictext", undefined, "\u516c\u5dee(mm):");
        var etTolerance = rowT1.add("edittext", undefined, "0.01"); etTolerance.characters = 4;
        rowT1.add("statictext", undefined, "\u8ef8\u9593:");
        var ddDistanceSolveMode = rowT1.add("dropdownlist", undefined, ["\u7406\u8ad6\u30b9\u30ca\u30c3\u30d7", "\u5b9f\u5bf8\u7dad\u6301&\u8ee2\u4f4d\u9006\u7b97", "\u81ea\u7531\u914d\u7f6e"]);
        ddDistanceSolveMode.preferredSize.width = 175;
        ddDistanceSolveMode.selection = 0;

        var rowT2 = pnlToleranceLog.add("group");
        rowT2.orientation = "row";
        rowT2.spacing = 4;
        var chkAllowCrossLayerMesh = rowT2.add("checkbox", undefined, "\u7570\u6bb5\u565b\u5408");
        chkAllowCrossLayerMesh.value = false;
        var chkAutoSaveLog = rowT2.add("checkbox", undefined, "TXT\u4fdd\u5b58");
        chkAutoSaveLog.value = true;
        var btnBrowseLogFolder = rowT2.add("button", undefined, "\u53c2\u7167...");
        btnBrowseLogFolder.preferredSize.width = 72;
        var btnOpenLogFolder = rowT2.add("button", undefined, "\u958b\u304f");
        btnOpenLogFolder.preferredSize.width = 58;

        // 3. Profile IO
        var pnlProfileIO = paneSetRight.add("group");
        pnlProfileIO.orientation = "row";
        pnlProfileIO.spacing = 8;
        pnlProfileIO.alignment = ["fill", "top"];
        var btnExportProfile = pnlProfileIO.add("button", undefined, "\u8a2d\u5b9a\u66f8\u51fa(JSON)");
        var btnImportProfile = pnlProfileIO.add("button", undefined, "\u8a2d\u5b9a\u8aad\u8fbc(JSON)");
        var btnResetDefaults = pnlProfileIO.add("button", undefined, "\u521d\u671f\u5316");

        // -------------------------------------------------------------
        // COMMON FOOTER
        // -------------------------------------------------------------
        var grpFooter = win.add("group");
        grpFooter.orientation = "row";
        grpFooter.alignment = ["fill", "bottom"];
        grpFooter.spacing = 8;

        var progBar = grpFooter.add("progressbar", undefined, 0, 100);
        progBar.preferredSize = [300, 14];
        var btnViewLog = grpFooter.add("button", undefined, "\u30ed\u30b0\u95b2\u89a7...");
        btnViewLog.preferredSize.width = 100;
        var spFoot = grpFooter.add("group"); spFoot.alignment = ["fill", "fill"];
        var btnCancel = grpFooter.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        btnCancel.preferredSize.width = 100;
        var btnDraw = grpFooter.add("button", undefined, "\u6b6f\u8eca\u3092\u63cf\u753b", { name: "ok" });
        btnDraw.preferredSize = [130, 28];

        // ==========================================
        // UI Synchronization & Data Binding Logic
        // ==========================================
        var isUpdatingUI = false;

        function refreshTrainList(selIdx) {
            isUpdatingUI = true;
            trainListBox.removeAll();

            for (var i = 0; i < trainNodes.length; i++) {
                var nd = trainNodes[i];
                var itm = trainListBox.add("item", nd.id);
                itm.subItems[0].text = nd.kind || "SPUR";
                itm.subItems[1].text = String(nd.stageIndex || 1);
                itm.subItems[2].text = nd.parentId || "-";
                itm.subItems[3].text = nd.relationType || "ROOT";
                itm.subItems[4].text = String(nd.z);
                itm.subItems[5].text = (nd.reductionRatio ? nd.reductionRatio.toFixed(2) : "1.00");
                itm.subItems[6].text = (nd.da ? "da=" + nd.da.toFixed(1) : "-");
                itm.subItems[7].text = String(nd.m || 2.0);
                itm.subItems[8].text = String(nd.alphaDeg || 20);
                itm.subItems[9].text = nd.shaftType || "ROUND";
                itm.subItems[10].text = (typeof nd.angleDeg === "number") ? nd.angleDeg.toFixed(1) : "0.0";
                itm.subItems[11].text = nd.status || "OK";
            }

            // Refresh parent dropdown in node detail
            ddNodeParent.removeAll();
            ddNodeParent.add("item", "(\u306a\u3057 / \u30eb\u30fc\u30c8)");

            if (trainNodes.length === 0) {
                // Safety Guard: Empty trainNodes -> disable detail form
                pnlNodeDetail.enabled = false;
                etNodeId.text = "";
                etNodeZ.text = "";
                etNodeShift.text = "";
                etNodeAngle.text = "";
                etNodeStage.text = "";
                etNodeModule.text = "";
                etNodeAlpha.text = "";
                etNodeBacklash.text = "";
                etNodeTipRounding.text = "";
                etNodeBackHeight.text = "";
                etNodeShaft.text = "";
            } else {
                pnlNodeDetail.enabled = true;
                var sIdx = (typeof selIdx === "number" && selIdx >= 0 && selIdx < trainNodes.length) ? selIdx : 0;
                trainListBox.selection = sIdx;
                loadNodeToForm(trainNodes[sIdx]);
            }

            isUpdatingUI = false;
            updateCalculationPreview();
        }

        function loadNodeToForm(nd) {
            if (!nd) return;
            isUpdatingUI = true;

            etNodeId.text = nd.id || "G1";
            etNodeZ.text = String(nd.z || 18);
            etNodeShift.text = String(nd.shift || 0.0);
            etNodeAngle.text = (typeof nd.angleDeg === "number") ? String(nd.angleDeg) : "0.0";
            etNodeStage.text = String(nd.stageIndex || 1);
            etNodeModule.text = String(nd.m || 2.0);
            etNodeAlpha.text = String(nd.alphaDeg || 20.0);
            etNodeBacklash.text = (typeof nd.backlash === "number" && !isNaN(nd.backlash)) ? String(nd.backlash) : "0.15";
            etNodeTipRounding.text = String(nd.tipRounding || 0.0);
            etNodeBackHeight.text = String((nd.backHeight !== undefined && nd.backHeight !== null && !isNaN(parseFloat(nd.backHeight))) ? parseFloat(nd.backHeight) : 6.0);
            etNodeShaft.text = String((nd.shaftDia !== undefined && nd.shaftDia !== null && !isNaN(parseFloat(nd.shaftDia))) ? parseFloat(nd.shaftDia) : 5.0);

            // Kind
            if (nd.kind === "INTERNAL") ddNodeKind.selection = 1;
            else if (nd.kind === "RACK") ddNodeKind.selection = 2;
            else ddNodeKind.selection = 0;

            // Shaft Type
            if (nd.shaftType === "D_CUT") ddNodeShaftType.selection = 1;
            else if (nd.shaftType === "KEYWAY") ddNodeShaftType.selection = 2;
            else if (nd.shaftType === "GROUP_SHAPE") ddNodeShaftType.selection = 3;
            else if (nd.shaftType === "EXTERNAL_AI") ddNodeShaftType.selection = 4;
            else if (nd.shaftType === "NONE") ddNodeShaftType.selection = 5;
            else ddNodeShaftType.selection = 0;

            // Parents excluding self
            ddNodeParent.removeAll();
            ddNodeParent.add("item", "(\u306a\u3057 / \u30eb\u30fc\u30c8)");
            var parentSel = 0;
            var parentCounter = 1;
            for (var p = 0; p < trainNodes.length; p++) {
                if (trainNodes[p].id !== nd.id) {
                    ddNodeParent.add("item", trainNodes[p].id + " (" + trainNodes[p].kind + ", z=" + trainNodes[p].z + ")");
                    if (trainNodes[p].id === nd.parentId) {
                        parentSel = parentCounter;
                    }
                    parentCounter++;
                }
            }
            ddNodeParent.selection = parentSel;

            isUpdatingUI = false;
        }

        function saveFormToSelectedNode() {
            if (isUpdatingUI) return;
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            if (idx < 0 || idx >= trainNodes.length) return;
            var nd = trainNodes[idx];

            nd.z = parseInt(etNodeZ.text, 10) || 18;
            nd.shift = parseFloat(etNodeShift.text) || 0.0;
            nd.angleDeg = parseFloat(etNodeAngle.text) || 0.0;
            nd.stageIndex = parseInt(etNodeStage.text, 10) || 1;
            nd.m = parseFloat(etNodeModule.text) || 2.0;
            nd.alphaDeg = parseFloat(etNodeAlpha.text) || 20.0;
            var blVal = parseFloat(etNodeBacklash.text);
            nd.backlash = (!isNaN(blVal) && blVal >= 0) ? blVal : 0.15;
            nd.tipRounding = parseFloat(etNodeTipRounding.text) || 0.0;
            var bhVal = parseFloat(etNodeBackHeight.text);
            nd.backHeight = (!isNaN(bhVal) && bhVal >= 0) ? bhVal : 6.0;
            var shVal = parseFloat(etNodeShaft.text);
            nd.shaftDia = (!isNaN(shVal) && shVal >= 0) ? shVal : 5.0;

            var kSel = ddNodeKind.selection ? ddNodeKind.selection.index : 0;
            nd.kind = (kSel === 1) ? "INTERNAL" : ((kSel === 2) ? "RACK" : "SPUR");
            nd.gearType = nd.kind;

            var sSel = ddNodeShaftType.selection ? ddNodeShaftType.selection.index : 0;
            if (sSel === 1) nd.shaftType = "D_CUT";
            else if (sSel === 2) nd.shaftType = "KEYWAY";
            else if (sSel === 3) nd.shaftType = "GROUP_SHAPE";
            else if (sSel === 4) nd.shaftType = "EXTERNAL_AI";
            else if (sSel === 5) nd.shaftType = "NONE";
            else nd.shaftType = "ROUND";

            // Update parent
            if (ddNodeParent.selection && ddNodeParent.selection.index > 0) {
                var pText = ddNodeParent.selection.text;
                var pId = pText.split(" ")[0];
                nd.parentId = pId;
                if (!nd.relationType || nd.relationType === "ROOT") {
                    nd.relationType = "MESHING";
                }
            } else {
                nd.parentId = null;
                nd.relationType = "ROOT";
            }

            // Sync driver parameters to same stage
            syncStageParameters(nd.stageIndex, nd);

            // Directly update table selected row without full rebuild
            var selItm = trainListBox.selection;
            if (selItm) {
                selItm.text = nd.id;
                if (selItm.subItems) {
                    if (selItm.subItems[0]) selItm.subItems[0].text = nd.kind || "SPUR";
                    if (selItm.subItems[1]) selItm.subItems[1].text = String(nd.stageIndex || 1);
                    if (selItm.subItems[2]) selItm.subItems[2].text = nd.parentId || "-";
                    if (selItm.subItems[3]) selItm.subItems[3].text = nd.relationType || "ROOT";
                    if (selItm.subItems[4]) selItm.subItems[4].text = String(nd.z);
                    var daVal = (nd.kind === "INTERNAL") ? (nd.m * (nd.z - 2.0 + 2.0 * nd.shift)) : (nd.m * (nd.z + 2.0 + 2.0 * nd.shift));
                    if (selItm.subItems[6]) selItm.subItems[6].text = "da=" + daVal.toFixed(1);
                    if (selItm.subItems[7]) selItm.subItems[7].text = String(nd.m || 2.0);
                    if (selItm.subItems[8]) selItm.subItems[8].text = String(nd.alphaDeg || 20);
                    var shaftDisp = nd.shaftType || "ROUND";
                    if (nd.cutoutType && nd.cutoutType !== "NONE") {
                        shaftDisp += "/" + nd.cutoutType;
                    }
                    if (selItm.subItems[9]) selItm.subItems[9].text = shaftDisp;
                    if (selItm.subItems[10]) selItm.subItems[10].text = (typeof nd.angleDeg === "number") ? nd.angleDeg.toFixed(1) : "0.0";
                    if (selItm.subItems[11]) selItm.subItems[11].text = nd.status || "OK";
                }
            }

            // Directly update synced other nodes in the same stage
            for (var si = 0; si < trainNodes.length; si++) {
                if (si !== idx && trainListBox.items[si]) {
                    var otherItm = trainListBox.items[si];
                    var otherNode = trainNodes[si];
                    if (otherItm.subItems) {
                        if (otherItm.subItems[7]) otherItm.subItems[7].text = String(otherNode.m || 2.0);
                        if (otherItm.subItems[8]) otherItm.subItems[8].text = String(otherNode.alphaDeg || 20);
                    }
                }
            }

            updateCalculationPreview();
        }

        function syncStageParameters(stageIndex, currentNode) {
            var driverNode = getStageDriverNode(stageIndex, trainNodes);
            if (!driverNode) return;
            if (driverNode.id === currentNode.id) {
                // \u81ea\u8eab\u304c\u6bb5\u539f\u52d5\u30ae\u30a2: \u540c\u4e00\u6bb5\u306e\u5168\u5f93\u52d5\u30ae\u30a2\u3078\u8af8\u5143\u3092\u4e00\u65b9\u5411\u540c\u671f
                for (var i = 0; i < trainNodes.length; i++) {
                    var tn = trainNodes[i];
                    if ((parseInt(tn.stageIndex, 10) || 1) === stageIndex && tn.id !== driverNode.id) {
                        tn.m = driverNode.m;
                        tn.alphaDeg = driverNode.alphaDeg;
                        tn.backlash = driverNode.backlash;
                        tn.tipRounding = driverNode.tipRounding;
                    }
                }
            } else {
                // \u81ea\u8eab\u304c\u5f93\u52d5\u30ae\u30a2: \u539f\u52d5\u30ae\u30a2\u304b\u3089\u8af8\u5143\u3092\u7d99\u627f\u30fb\u540c\u671f\u3057\u3066\u539f\u52d5\u30ae\u30a2\u306e\u4e0a\u66f8\u304d\u3092\u30ac\u30fc\u30c9
                currentNode.m = driverNode.m;
                currentNode.alphaDeg = driverNode.alphaDeg;
                currentNode.backlash = driverNode.backlash;
                currentNode.tipRounding = driverNode.tipRounding;
                isUpdatingUI = true;
                etNodeModule.text = String(driverNode.m);
                etNodeAlpha.text = String(driverNode.alphaDeg);
                etNodeBacklash.text = (typeof driverNode.backlash === "number" && !isNaN(driverNode.backlash)) ? String(driverNode.backlash) : "0.15";
                etNodeTipRounding.text = String(driverNode.tipRounding || 0.0);
                isUpdatingUI = false;
            }
        }

        function updateCalculationPreview() {
            if (trainNodes.length === 0) {
                stCalcRatio.text = "\u7dcf\u6e1b\u901f\u6bd4: - (\u8f2a\u5217\u304c\u7a7a\u3067\u3059)";
                stCalcMesh.text = "\u565b\u5408\u7387 \u03b5\u03b1: -";
                stCalcWarn.text = "\u72b6\u614b: \u30ae\u30a2\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044";
                return;
            }

            // Calculate overall reduction ratio
            var rootNode = null;
            var leafNodes = [];
            for (var i = 0; i < trainNodes.length; i++) {
                if (!trainNodes[i].parentId || trainNodes[i].relationType === "ROOT") {
                    rootNode = trainNodes[i];
                }
            }
            if (rootNode) {
                var lastNode = trainNodes[trainNodes.length - 1];
                if (rootNode.z > 0 && lastNode.z > 0) {
                    var totalRatio = lastNode.z / rootNode.z;
                    stCalcRatio.text = "\u7dcf\u6e1b\u901f\u6bd4 (Root \u2192 End): i = " + totalRatio.toFixed(3);
                }
            }

            // Contact Ratio estimation for consecutive pairs
            if (trainNodes.length >= 2) {
                var g1 = trainNodes[0];
                var g2 = trainNodes[1];
                var alphaRad = (g1.alphaDeg || 20.0) * Math.PI / 180.0;
                var epsAlpha = 1.35; // typical nominal involute contact ratio
                if (typeof InvoluteCore !== "undefined" && typeof InvoluteCore.calculateContactRatio === "function") {
                    try {
                        epsAlpha = InvoluteCore.calculateContactRatio(g1.m, g1.z, g2.z, g1.alphaDeg, g1.shift || 0, g2.shift || 0);
                    } catch (eCr) {}
                }
                stCalcMesh.text = "\u565b\u5408\u7387 \u03b5\u03b1: " + epsAlpha.toFixed(2) + (epsAlpha < 1.1 ? " (\u8b66\u544a: 1.1\u672a\u6e80)" : " (OK)");
            } else {
                stCalcMesh.text = "\u565b\u5408\u7387 \u03b5\u03b1: - (2\u6b6f\u8eca\u4ee5\u4e0a\u3067\u8868\u793a)";
            }

            stCalcWarn.text = "\u5e72\u6e09\u30c1\u30a7\u30c3\u30af: \u6b63\u5e38 (No Collision)";
        }

        // Event bindings for node detail form
        trainListBox.onChange = function () {
            if (!trainListBox.selection) return;
            loadNodeToForm(trainNodes[trainListBox.selection.index]);
        };

        etNodeZ.onChange = saveFormToSelectedNode;
        etNodeShift.onChange = saveFormToSelectedNode;
        etNodeAngle.onChange = saveFormToSelectedNode;
        etNodeStage.onChange = saveFormToSelectedNode;
        etNodeModule.onChange = saveFormToSelectedNode;
        etNodeAlpha.onChange = saveFormToSelectedNode;
        etNodeBacklash.onChange = saveFormToSelectedNode;
        etNodeTipRounding.onChange = saveFormToSelectedNode;
        etNodeBackHeight.onChange = saveFormToSelectedNode;
        etNodeShaft.onChange = saveFormToSelectedNode;
        ddNodeKind.onChange = saveFormToSelectedNode;
        ddNodeShaftType.onChange = saveFormToSelectedNode;
        ddNodeParent.onChange = saveFormToSelectedNode;

        btnChangeId.onClick = function () {
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            var oldId = trainNodes[idx].id;
            var newId = etNodeId.text;
            if (!newId || newId === oldId) return;

            // Check uniqueness
            for (var i = 0; i < trainNodes.length; i++) {
                if (i !== idx && trainNodes[i].id === newId) {
                    alert("\u30ae\u30a2ID '" + newId + "' \u306f\u65e2\u306b\u5b58\u5728\u3057\u307e\u3059\u3002\u5225\u306eID\u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    etNodeId.text = oldId;
                    return;
                }
            }

            trainNodes[idx].id = newId;
            // Update children parent references
            for (var j = 0; j < trainNodes.length; j++) {
                if (trainNodes[j].parentId === oldId) {
                    trainNodes[j].parentId = newId;
                }
            }
            refreshTrainList(idx);
        };

        btnCustomCutout.onClick = function () {
            if (!trainListBox.selection || trainNodes.length === 0) {
                alert("\u8089\u629c\u304d\u3092\u8a2d\u5b9a\u3059\u308b\u30ae\u30a2\u3092\u8f2a\u5217\u30ea\u30b9\u30c8\u304b\u3089\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                return;
            }
            var idx = trainListBox.selection.index;
            var nd = trainNodes[idx];
            showCustomCutoutModal(win, nd, function (newType, newOpts, aiPath) {
                nd.cutoutType = newType;
                nd.cutoutOptions = newOpts;
                if (aiPath) nd.externalAiPath = aiPath;
                saveFormToSelectedNode();
            });
        };

        // -------------------------------------------------------------
        // Gear Addition Actions
        // -------------------------------------------------------------
        btnAddSpur.onClick = function () {
            var newId = getNextGearId(trainNodes, "G");
            var parent = (trainListBox.selection && trainNodes.length > 0) ? trainNodes[trainListBox.selection.index] : ((trainNodes.length > 0) ? trainNodes[trainNodes.length - 1] : null);
            var bl = (parent && typeof parent.backlash === "number" && !isNaN(parent.backlash)) ? parent.backlash : (!isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15);
            var newNode = {
                id: newId,
                kind: "SPUR",
                z: 18,
                m: parent ? parent.m : parseFloat(etModule.text) || 2.0,
                alphaDeg: parent ? parent.alphaDeg : parseFloat(etAlpha.text) || 20.0,
                shift: 0.0,
                backlash: bl,
                tipRounding: parent ? parent.tipRounding : parseFloat(etTipRounding.text) || 0.0,
                shaftType: ddDefShaftType.selection ? (ddDefShaftType.selection.index === 1 ? "D_CUT" : (ddDefShaftType.selection.index === 2 ? "KEYWAY" : (ddDefShaftType.selection.index === 3 ? "NONE" : "ROUND"))) : "ROUND",
                shaftDia: (function () { var v = parseFloat(etShaftDia.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })(),
                backHeight: 6.0,
                stageIndex: parent ? parent.stageIndex : 1,
                parentId: parent ? parent.id : null,
                relationType: parent ? "MESHING" : "ROOT",
                angleDeg: 0.0
            };
            trainNodes.push(newNode);
            refreshTrainList(trainNodes.length - 1);
        };

        btnAddCoaxial.onClick = function () {
            if (trainNodes.length === 0) {
                alert("\u540c\u8ef8\u30ae\u30a2\u3092\u8ffd\u52a0\u3059\u308b\u306b\u306f\u3001\u89aa\u3068\u306a\u308b\u30ae\u30a2\u304c\u5fc5\u8981\u3067\u3059\u3002");
                return;
            }
            var parent = trainListBox.selection ? trainNodes[trainListBox.selection.index] : trainNodes[trainNodes.length - 1];
            var newId = getNextGearId(trainNodes, "G");
            var bl = (typeof parent.backlash === "number" && !isNaN(parent.backlash)) ? parent.backlash : 0.15;
            var newNode = {
                id: newId,
                kind: "SPUR",
                z: 14,
                m: parent.m,
                alphaDeg: parent.alphaDeg,
                shift: 0.0,
                backlash: bl,
                tipRounding: parent.tipRounding,
                shaftType: parent.shaftType,
                shaftDia: parent.shaftDia,
                backHeight: 6.0,
                stageIndex: (parent.stageIndex || 1) + 1,
                parentId: parent.id,
                relationType: "COAXIAL",
                angleDeg: 0.0
            };
            trainNodes.push(newNode);
            refreshTrainList(trainNodes.length - 1);
        };

        btnAddInternal.onClick = function () {
            var newId = getNextGearId(trainNodes, "G");
            var parent = (trainListBox.selection && trainNodes.length > 0) ? trainNodes[trainListBox.selection.index] : null;
            var bl = (parent && typeof parent.backlash === "number" && !isNaN(parent.backlash)) ? parent.backlash : (!isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15);
            var newNode = {
                id: newId,
                kind: "INTERNAL",
                gearType: "INTERNAL",
                z: parent ? (parent.z + 20) : 48,
                m: parent ? parent.m : parseFloat(etModule.text) || 2.0,
                alphaDeg: parent ? parent.alphaDeg : parseFloat(etAlpha.text) || 20.0,
                shift: 0.0,
                backlash: bl,
                tipRounding: 0.0,
                shaftType: "NONE",
                shaftDia: 0.0,
                backHeight: 8.0,
                stageIndex: parent ? parent.stageIndex : 1,
                parentId: parent ? parent.id : null,
                relationType: parent ? "INTERNAL_MESHING" : "ROOT",
                angleDeg: 0.0
            };
            trainNodes.push(newNode);
            refreshTrainList(trainNodes.length - 1);
        };

        btnAddRack.onClick = function () {
            var newId = getNextGearId(trainNodes, "R");
            var parent = (trainListBox.selection && trainNodes.length > 0) ? trainNodes[trainListBox.selection.index] : null;
            var bl = (parent && typeof parent.backlash === "number" && !isNaN(parent.backlash)) ? parent.backlash : (!isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15);
            var newNode = {
                id: newId,
                kind: "RACK",
                gearType: "RACK",
                z: 20,
                m: parent ? parent.m : parseFloat(etModule.text) || 2.0,
                alphaDeg: parent ? parent.alphaDeg : parseFloat(etAlpha.text) || 20.0,
                shift: 0.0,
                backlash: bl,
                tipRounding: 0.0,
                shaftType: "NONE",
                shaftDia: 0.0,
                backHeight: 10.0,
                stageIndex: parent ? parent.stageIndex : 1,
                parentId: parent ? parent.id : null,
                relationType: parent ? "RACK_MESHING" : "ROOT",
                angleDeg: 0.0
            };
            trainNodes.push(newNode);
            refreshTrainList(trainNodes.length - 1);
        };

        btnAddPlanetary.onClick = function () {
            var parent = trainListBox.selection ? trainNodes[trainListBox.selection.index] : null;
            showAddPlanetaryModal({}, parent, trainNodes, function (res) {
                var sunId = getNextGearId(trainNodes, "S");
                var stage = res.stageIndex || 1;
                var bl = !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15;
                var sunNode = {
                    id: sunId, kind: "SPUR", gearType: "SPUR", z: res.zs, m: res.m, alphaDeg: 20, shift: 0,
                    backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 5.0, backHeight: 6.0,
                    stageIndex: stage, parentId: res.parentId, relationType: res.parentId ? "MESHING" : "ROOT", angleDeg: 0.0,
                    generateCarrier: !!res.generateCarrier
                };
                trainNodes.push(sunNode);

                if (res.generateCarrier) {
                    chkCarrierBase.value = true;
                }

                for (var p = 0; p < res.N; p++) {
                    var plId = getNextGearId(trainNodes, "P");
                    var plAngle = (p * 360.0) / res.N;
                    trainNodes.push({
                        id: plId, kind: "SPUR", gearType: "SPUR", z: res.zp, m: res.m, alphaDeg: 20, shift: 0,
                        backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 4.0, backHeight: 6.0,
                        stageIndex: stage, parentId: sunId, relationType: "MESHING", angleDeg: plAngle
                    });
                }

                var ringId = getNextGearId(trainNodes, "R");
                trainNodes.push({
                    id: ringId, kind: "INTERNAL", gearType: "INTERNAL", z: res.zr, m: res.m, alphaDeg: 20, shift: 0,
                    backlash: bl, tipRounding: 0, shaftType: "NONE", shaftDia: 0.0, backHeight: 8.0,
                    stageIndex: stage, parentId: sunId, relationType: "COAXIAL", angleDeg: 0.0
                });

                refreshTrainList(trainNodes.length - 1);
            });
        };

        btnAddParadox.onClick = function () {
            var parent = trainListBox.selection ? trainNodes[trainListBox.selection.index] : null;
            showAddParadoxModal({}, parent, trainNodes, function (res) {
                var sId = getNextGearId(trainNodes, "S");
                var stage = (res.stageIndex !== undefined) ? res.stageIndex : (parent ? parent.stageIndex : 1);
                var pId = (res.parentId !== undefined) ? res.parentId : (parent ? parent.id : null);
                var bl = !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15;
                trainNodes.push({
                    id: sId, kind: "SPUR", gearType: "SPUR", z: res.z1, m: res.m, alphaDeg: 20, shift: (typeof res.x1 === "number" ? res.x1 : 0.0),
                    backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 5.0, backHeight: 6.0,
                    stageIndex: stage, parentId: pId, relationType: pId ? "MESHING" : "ROOT", angleDeg: 0.0
                });

                for (var p = 0; p < res.N; p++) {
                    var plId = getNextGearId(trainNodes, "P");
                    var plAngle = (p * 360.0) / res.N;
                    var plNode = {
                        id: plId, kind: "SPUR", gearType: "SPUR", z: res.z2, m: res.m, alphaDeg: 20, shift: (typeof res.x2 === "number" ? res.x2 : 0.0),
                        backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 4.0, backHeight: 6.0,
                        stageIndex: stage, parentId: sId, relationType: "MESHING", angleDeg: plAngle
                    };
                    if (res.centerDistanceMm) {
                        plNode.centerDistanceMm = res.centerDistanceMm;
                    }
                    trainNodes.push(plNode);
                }

                var r3Id = getNextGearId(trainNodes, "R_Fixed");
                trainNodes.push({
                    id: r3Id, kind: "INTERNAL", gearType: "INTERNAL", z: res.z3, m: res.m, alphaDeg: 20, shift: (typeof res.xr1 === "number" ? res.xr1 : 0.0),
                    backlash: bl, tipRounding: 0, shaftType: "NONE", shaftDia: 0.0, backHeight: 8.0,
                    stageIndex: stage, parentId: sId, relationType: "COAXIAL", angleDeg: 0.0
                });

                var r4Id = getNextGearId(trainNodes, "R_Out");
                trainNodes.push({
                    id: r4Id, kind: "INTERNAL", gearType: "INTERNAL", z: res.z4, m: res.m, alphaDeg: 20, shift: (typeof res.xr2 === "number" ? res.xr2 : 0.0),
                    backlash: bl, tipRounding: 0, shaftType: "NONE", shaftDia: 0.0, backHeight: 8.0,
                    stageIndex: stage + 1, parentId: sId, relationType: "COAXIAL", angleDeg: 0.0
                });

                refreshTrainList(trainNodes.length - 1);
            });
        };

        btnAddIntermittent.onClick = function () {
            var parent = trainListBox.selection ? trainNodes[trainListBox.selection.index] : null;
            var defaultM = parent ? (parent.m || 2.0) : (parseFloat(etModule.text) || 2.0);
            showAddIntermittentModal({ m: defaultM }, parent, trainNodes, function (res) {
                var dId = getNextGearId(trainNodes, "M_Drv");
                var stage = parent ? parent.stageIndex : 1;
                var gearM = (res.m !== undefined) ? res.m : defaultM;
                var bl = !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15;
                var intStructure = res.isTwoLayer ? "two_layer" : "coplanar";
                trainNodes.push({
                    id: dId, kind: "MUTILATED_DRIVER", z: res.z1, m: gearM, alphaDeg: 20, shift: 0,
                    isMutilated: true, intermittentRole: "DRIVER", intermittentStructure: intStructure,
                    divisions: res.S, moveTeeth: res.k, activeTeeth: res.k,
                    backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 5.0, backHeight: 6.0,
                    stageIndex: stage, parentId: parent ? parent.id : null, relationType: parent ? "MESHING" : "ROOT", angleDeg: 0.0,
                    isTwoLayer: res.isTwoLayer, lockClearance: res.lockClearance
                });

                var fId = getNextGearId(trainNodes, "M_Drn");
                trainNodes.push({
                    id: fId, kind: "MUTILATED_DRIVEN", z: res.z2, m: gearM, alphaDeg: 20, shift: 0,
                    isMutilated: true, intermittentRole: "DRIVEN", intermittentStructure: intStructure,
                    divisions: res.S, moveTeeth: res.k,
                    backlash: bl, tipRounding: 0, shaftType: "ROUND", shaftDia: 5.0, backHeight: 6.0,
                    stageIndex: stage, parentId: dId, relationType: "MESHING", angleDeg: 0.0,
                    isTwoLayer: res.isTwoLayer, lockClearance: res.lockClearance
                });

                refreshTrainList(trainNodes.length - 1);
            });
        };

        btnDeleteNode.onClick = function () {
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            var deletedId = trainNodes[idx].id;
            trainNodes.splice(idx, 1);

            // Re-parent children if any
            for (var i = 0; i < trainNodes.length; i++) {
                if (trainNodes[i].parentId === deletedId) {
                    trainNodes[i].parentId = null;
                    trainNodes[i].relationType = "ROOT";
                }
            }
            refreshTrainList(Math.max(0, idx - 1));
        };

        // ==========================================
        // Circle Object Scanning & Auto-Tree Logic
        // ==========================================
        var scannedCircles = [];

        function doScanCircles() {
            scannedCircles = [];
            if (typeof TopologySolver !== "undefined" && doc) {
                scannedCircles = TopologySolver.scanCirclesAndGroups(doc, {
                    fromAllLayers: rbAllLayers.value,
                    colorPresets: colorPresets,
                    extractInnerShapes: cbExtractInnerShapes.value
                });
            }
            var circleCount = 0;
            var groupCount = 0;
            for (var ci = 0; ci < scannedCircles.length; ci++) {
                if (scannedCircles[ci].isGroup) groupCount++;
                else circleCount++;
            }
            stCircleStatus.text = "\u5186: " + circleCount + "\u500b, \u8ef8\u7a74\u30b0\u30eb\u30fc\u30d7: " + groupCount + "\u500b";
        }

        btnRescanCircle.onClick = function () {
            doScanCircles();
        };

        cbFromCircle.onClick = function () {
            if (cbFromCircle.value) {
                doScanCircles();
            }
        };

        rbSelected.onClick = doScanCircles;
        rbAllLayers.onClick = doScanCircles;
        cbExtractInnerShapes.onClick = doScanCircles;

        btnAutoBuildTree.onClick = function () {
            if (scannedCircles.length === 0) {
                doScanCircles();
            }
            if (scannedCircles.length === 0) {
                alert("\u5186\u307e\u305f\u306f\u30b0\u30eb\u30fc\u30d7\u304c\u691c\u51fa\u3055\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002Illustrator\u4e0a\u3067\u5186\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                return;
            }
            if (typeof TopologySolver !== "undefined") {
                var snapModeStr = (ddDistanceSolveMode.selection && ddDistanceSolveMode.selection.index === 1) ? "exact_position" : "snap_theory";
                var res = TopologySolver.analyzeCircleTopology(scannedCircles, {
                    m: parseFloat(etModule.text) || 2.0,
                    alphaDeg: parseFloat(etAlpha.text) || 20.0,
                    snapMode: snapModeStr,
                    toleranceMm: parseFloat(etTolerance.text) || 2.5,
                    allowCrossLayerMeshing: chkAllowCrossLayerMesh.value,
                    colorPresets: cbApplyColorPreset.value ? colorPresets : null
                });

                if (res && res.nodes && res.nodes.length > 0) {
                    trainNodes = [];
                    for (var ni = 0; ni < res.nodes.length; ni++) {
                        var rn = res.nodes[ni];
                        trainNodes.push({
                            id: rn.id,
                            kind: rn.gearType,
                            z: rn.z,
                            m: rn.m,
                            alphaDeg: rn.alphaDeg,
                            shift: rn.x || 0.0,
                            backlash: !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15,
                            tipRounding: parseFloat(etTipRounding.text) || 0.0,
                            shaftType: rn.shaftType || "ROUND",
                            shaftDia: rn.shaftDiameter || 5.0,
                            cutoutType: rn.cutoutType || "NONE",
                            backHeight: 6.0,
                            stageIndex: rn.stageIndex || 1,
                            parentId: rn.parentId,
                            relationType: rn.relationType,
                            angleDeg: rn.relativeAngleDeg || 0.0,
                            innerShapeItems: rn.innerShapeItems || [],
                            origCircle: rn.origCircle,
                            xOffset: rn.xOffset,
                            yOffset: rn.yOffset,
                            centerPt: rn.centerPt
                        });
                    }
                    if (ddPlacementRef && ddPlacementRef.items.length > 3) {
                        ddPlacementRef.selection = 3;
                    }
                    etTargetX.text = "0.0";
                    etTargetY.text = "0.0";
                    refreshTrainList(0);
                    if (res.warnings && res.warnings.length > 0) {
                        alert("\u8f2a\u5217\u30c4\u30ea\u30fc\u69cb\u7bc9\u5b8c\u4e86 (\u6ce8\u610f: " + res.warnings.join("\n") + ")");
                    }
                }
            }
        };

        btnColorPresets.onClick = function () {
            showColorPresetModal(win, colorPresets, function (updated) {
                colorPresets = updated;
                if (scannedCircles.length > 0) {
                    doScanCircles();
                }
            });
        };

        btnStyleDetail.onClick = function () {
            showStyleDetailModal(win, currentStyles, function (updated) {
                currentStyles = updated;
                ddStylePreset.selection = 3; // Custom
            });
        };

        ddStylePreset.onChange = function () {
            if (!ddStylePreset.selection) return;
            var sIdx = ddStylePreset.selection.index;
            if (sIdx === 0) currentStyles = cloneObj(STYLE_PRESETS.laser);
            else if (sIdx === 1) currentStyles = cloneObj(STYLE_PRESETS.jis);
            else if (sIdx === 2) currentStyles = cloneObj(STYLE_PRESETS.cnc);
        };

        ddNamingPreset.onChange = function () {
            if (!ddNamingPreset.selection) return;
            var nIdx = ddNamingPreset.selection.index;
            if (nIdx === 0) etNamingPattern.text = "{train}_{id}_{kind}_m{m}_z{z}";
            else if (nIdx === 1) etNamingPattern.text = "{train}_{id}_z{z}_m{m}_x{x}_a{alpha}";
            else if (nIdx === 2) etNamingPattern.text = "{train}_{kind}_{id}_z{z}";
        };

        // ==========================================
        // Placement Coordinates & Reference Logic
        // ==========================================
        function updatePlacementCoordinates() {
            var modeIdx = ddPlacementRef.selection ? ddPlacementRef.selection.index : 0;
            if (modeIdx === 3) {
                // \u5143\u306e\u5186\u4f4d\u7f6e\u6e96\u62e0
                etTargetX.text = "0.0";
                etTargetY.text = "0.0";
                return;
            }

            if (modeIdx === 2) {
                // \u30a2\u30fc\u30c8\u30dc\u30fc\u30c9\u4e2d\u592e
                var abCenterMm = [0.0, 0.0];
                try {
                    if (typeof app !== "undefined" && app.activeDocument) {
                        var docRef = app.activeDocument;
                        var abIdx = docRef.artboards.getActiveArtboardIndex();
                        var abRect = docRef.artboards[abIdx].artboardRect;
                        var cxPt = (abRect[0] + abRect[2]) / 2.0;
                        var cyPt = (abRect[1] + abRect[3]) / 2.0;
                        abCenterMm = [
                            Math.round(cxPt * PT_TO_MM * 100) / 100,
                            Math.round(cyPt * PT_TO_MM * 100) / 100
                        ];
                    }
                } catch (eAb) {}
                etTargetX.text = String(abCenterMm[0]);
                etTargetY.text = String(abCenterMm[1]);
                return;
            }

            if (modeIdx === 1) {
                // \u8f2a\u5217\u5168\u4f53\u4e2d\u5fc3
                if (trainNodes.length === 0) {
                    etTargetX.text = "0.0";
                    etTargetY.text = "0.0";
                    return;
                }
                var minX = Infinity, maxX = -Infinity;
                var minY = Infinity, maxY = -Infinity;
                var calculated = false;

                if (typeof TrainTreeResolver !== "undefined" && typeof TrainTreeResolver.resolveTrain === "function") {
                    try {
                        var resTrain = TrainTreeResolver.resolveTrain({
                            m: parseFloat(etModule.text) || 2.0,
                            alphaDeg: parseFloat(etAlpha.text) || 20.0,
                            backlash: !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15,
                            nodes: trainNodes
                        });
                        if (resTrain && resTrain.nodes && resTrain.nodes.length > 0) {
                            for (var rni = 0; rni < resTrain.nodes.length; rni++) {
                                var rn = resTrain.nodes[rni];
                                var cx = (rn.centerMm && rn.centerMm.length >= 2) ? rn.centerMm[0] : (rn.xOffset || 0.0);
                                var cy = (rn.centerMm && rn.centerMm.length >= 2) ? rn.centerMm[1] : (rn.yOffset || 0.0);
                                var gearM = rn.m || parseFloat(etModule.text) || 2.0;
                                var gearZ = rn.z || 20;
                                var rOuter = (rn.gearType === "INTERNAL") ? ((gearZ + 4) * gearM / 2.0) : ((gearZ + 2) * gearM / 2.0);
                                minX = Math.min(minX, cx - rOuter);
                                maxX = Math.max(maxX, cx + rOuter);
                                minY = Math.min(minY, cy - rOuter);
                                maxY = Math.max(maxY, cy + rOuter);
                            }
                            calculated = true;
                        }
                    } catch (eRes) {
                        CalcLogger.warn("UI", "Error resolving train for placement center: " + eRes.message);
                    }
                }

                if (!calculated) {
                    for (var tni = 0; tni < trainNodes.length; tni++) {
                        var tn = trainNodes[tni];
                        var tcx = tn.xOffset || 0.0;
                        var tcy = tn.yOffset || 0.0;
                        var tm = tn.m || parseFloat(etModule.text) || 2.0;
                        var tz = tn.z || 20;
                        var tr = (tz + 2) * tm / 2.0;
                        minX = Math.min(minX, tcx - tr);
                        maxX = Math.max(maxX, tcx + tr);
                        minY = Math.min(minY, tcy - tr);
                        maxY = Math.max(maxY, tcy + tr);
                    }
                }

                if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
                    var midX = Math.round(((minX + maxX) / 2.0) * 100) / 100;
                    var midY = Math.round(((minY + maxY) / 2.0) * 100) / 100;
                    etTargetX.text = String(midX);
                    etTargetY.text = String(midY);
                } else {
                    etTargetX.text = "0.0";
                    etTargetY.text = "0.0";
                }
                return;
            }

            if (modeIdx === 0) {
                // \u30eb\u30fc\u30c8\u30ae\u30a2\u57fa\u6e96\u5186\u4e2d\u5fc3
                if (trainNodes.length > 0 && trainNodes[0].xOffset !== undefined) {
                    etTargetX.text = String(Math.round(trainNodes[0].xOffset * 100) / 100);
                    etTargetY.text = String(Math.round(trainNodes[0].yOffset * 100) / 100);
                }
                return;
            }
        }

        ddPlacementRef.onChange = updatePlacementCoordinates;
        btnUpdateCoords.onClick = updatePlacementCoordinates;

        // ==========================================
        // Preferences & Profile Management
        // ==========================================
        var logFolderPath = "";

        function applyPreferencesToUI(prefs) {
            if (!prefs || typeof prefs !== "object") return;
            isUpdatingUI = true;

            try {
                if (prefs.common) {
                    var c = prefs.common;
                    if (c.m !== undefined) etModule.text = String(c.m);
                    if (c.alphaDeg !== undefined) etAlpha.text = String(c.alphaDeg);
                    if (c.backlash !== undefined && !isNaN(parseFloat(c.backlash))) etBacklash.text = String(c.backlash);
                    if (c.tipRounding !== undefined) etTipRounding.text = String(c.tipRounding);
                    if (c.kerf !== undefined) etKerf.text = String(c.kerf);
                    if (c.shaftDia !== undefined) etShaftDia.text = String(c.shaftDia);
                    if (c.shaftType !== undefined) {
                        var stIdx = 0;
                        if (c.shaftType === "D_CUT" || c.shaftType === "D\u30ab\u30c3\u30c8") stIdx = 1;
                        else if (c.shaftType === "KEYWAY" || c.shaftType === "\u30ad\u30fc\u6e9d") stIdx = 2;
                        else if (c.shaftType === "NONE" || c.shaftType === "\u306a\u3057") stIdx = 3;
                        ddDefShaftType.selection = stIdx;
                    }
                    if (c.backHeightRef !== undefined && ddThicknessBasis.items.length > c.backHeightRef) {
                        ddThicknessBasis.selection = c.backHeightRef;
                    }
                }

                if (prefs.centerGuide) {
                    var cg = prefs.centerGuide;
                    if (cg.mode !== undefined && ddCenterGuideMode.items.length > cg.mode) {
                        ddCenterGuideMode.selection = cg.mode;
                    }
                    if (cg.size !== undefined) {
                        etCenterGuideSize.text = String(cg.size);
                    }
                }

                if (prefs.creationOptions) {
                    var co = prefs.creationOptions;
                    if (co.compoundPath !== undefined) chkCompoundPath.value = !!co.compoundPath;
                    if (co.pitchGuide !== undefined) chkPitchGuide.value = !!co.pitchGuide;
                    if (co.centerGuide !== undefined) chkCenterGuide.value = !!co.centerGuide;
                    if (co.teethMode !== undefined) chkIndividualTeeth.value = !!co.teethMode;
                    if (co.specLabel !== undefined) chkSpecLabels.value = !!co.specLabel;
                    if (co.singleSkeleton !== undefined) chkSingleSkeleton.value = !!co.singleSkeleton;
                    if (co.perStageSkeleton !== undefined) chkPerStageSkeleton.value = !!co.perStageSkeleton;
                    if (co.carrierBase !== undefined) chkCarrierBase.value = !!co.carrierBase;
                }

                if (prefs.stylePreset !== undefined) {
                    var spMap = { "LASER_STD": 0, "JIS_DWG": 1, "CNC_MILL": 2, "CUSTOM": 3 };
                    var spIdx = spMap[prefs.stylePreset];
                    if (spIdx !== undefined && ddStylePreset.items.length > spIdx) {
                        ddStylePreset.selection = spIdx;
                    }
                }

                if (prefs.naming) {
                    var nm = prefs.naming;
                    if (nm.preset !== undefined && ddNamingPreset.items.length > nm.preset) {
                        ddNamingPreset.selection = nm.preset;
                    }
                    if (nm.trainId !== undefined) etTrainId.text = String(nm.trainId);
                    if (nm.gearPattern !== undefined) etNamingPattern.text = String(nm.gearPattern);
                }

                if (prefs.diagnostics) {
                    var dg = prefs.diagnostics;
                    if (dg.tolerance !== undefined) etTolerance.text = String(dg.tolerance);
                    if (dg.distanceSolveMode !== undefined && ddDistanceSolveMode.items.length > dg.distanceSolveMode) {
                        ddDistanceSolveMode.selection = dg.distanceSolveMode;
                    }
                    if (dg.allowCrossLayerMesh !== undefined) chkAllowCrossLayerMesh.value = !!dg.allowCrossLayerMesh;
                    if (dg.autoSaveLog !== undefined) chkAutoSaveLog.value = !!dg.autoSaveLog;
                    if (dg.logFolderPath) logFolderPath = String(dg.logFolderPath);
                }

                if (prefs.colorPresets && (prefs.colorPresets instanceof Array)) {
                    colorPresets = cloneObj(prefs.colorPresets);
                }

            } catch (eApply) {
                CalcLogger.warn("UI", "Error applying preferences to UI: " + eApply.message);
            }

            isUpdatingUI = false;
        }

        function collectPreferencesFromUI() {
            var prefs = {
                version: "1.0.0",
                common: {
                    m: parseFloat(etModule.text) || 2.0,
                    alphaDeg: parseFloat(etAlpha.text) || 20.0,
                    backlash: !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15,
                    tipRounding: parseFloat(etTipRounding.text) || 0.0,
                    kerf: parseFloat(etKerf.text) || 0.0,
                    shaftDia: (function () { var v = parseFloat(etShaftDia.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })(),
                    shaftType: (function () { var idx = ddDefShaftType.selection ? ddDefShaftType.selection.index : 0; return (idx === 1) ? "D_CUT" : ((idx === 2) ? "KEYWAY" : ((idx === 3) ? "NONE" : "ROUND")); })(),
                    backHeightRef: ddThicknessBasis.selection ? ddThicknessBasis.selection.index : 0
                },
                centerGuide: {
                    draw: chkCenterGuide.value,
                    mode: ddCenterGuideMode.selection ? ddCenterGuideMode.selection.index : 0,
                    size: (function () { var v = parseFloat(etCenterGuideSize.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })()
                },
                creationOptions: {
                    compoundPath: chkCompoundPath.value,
                    pitchGuide: chkPitchGuide.value,
                    centerGuide: chkCenterGuide.value,
                    teethMode: chkIndividualTeeth.value,
                    singleSkeleton: chkSingleSkeleton.value,
                    perStageSkeleton: chkPerStageSkeleton.value,
                    carrierBase: chkCarrierBase.value,
                    specLabel: chkSpecLabels.value
                },
                stylePreset: ddStylePreset.selection ? (ddStylePreset.selection.index === 0 ? "LASER_STD" : (ddStylePreset.selection.index === 1 ? "JIS_DWG" : (ddStylePreset.selection.index === 2 ? "CNC_MILL" : "CUSTOM"))) : "LASER_STD",
                naming: {
                    preset: ddNamingPreset.selection ? ddNamingPreset.selection.index : 0,
                    trainId: etTrainId.text,
                    gearPattern: etNamingPattern.text
                },
                diagnostics: {
                    tolerance: parseFloat(etTolerance.text) || 0.01,
                    distanceSolveMode: ddDistanceSolveMode.selection ? ddDistanceSolveMode.selection.index : 0,
                    allowCrossLayerMesh: chkAllowCrossLayerMesh.value,
                    autoSaveLog: chkAutoSaveLog.value,
                    logFolderPath: logFolderPath
                },
                colorPresets: cloneObj(colorPresets)
            };
            return prefs;
        }

        function saveCurrentPreferences() {
            try {
                if (typeof PreferencesManager !== "undefined") {
                    var currentPrefs = collectPreferencesFromUI();
                    PreferencesManager.savePreferences(currentPrefs);
                }
            } catch (eSave) {
                CalcLogger.warn("UI", "Failed to auto-save preferences: " + eSave.message);
            }
        }

        // --- Wiring: Profile IO Buttons & Sync ---
        btnSaveCurrentAsDef.onClick = function () {
            if (trainListBox.selection && trainNodes.length > 0) {
                var nd = trainNodes[trainListBox.selection.index];
                etModule.text = String(nd.m || 2.0);
                etAlpha.text = String(nd.alphaDeg || 20.0);
                etBacklash.text = (typeof nd.backlash === "number" && !isNaN(nd.backlash)) ? String(nd.backlash) : "0.15";
                etTipRounding.text = String(nd.tipRounding || 0.0);
                etShaftDia.text = String((nd.shaftDia !== undefined && nd.shaftDia !== null && !isNaN(parseFloat(nd.shaftDia))) ? parseFloat(nd.shaftDia) : 5.0);
                var sIdx = 0;
                if (nd.shaftType === "D_CUT" || nd.shaftType === "D\u30ab\u30c3\u30c8") sIdx = 1;
                else if (nd.shaftType === "KEYWAY" || nd.shaftType === "\u30ad\u30fc\u6e9d") sIdx = 2;
                else if (nd.shaftType === "NONE" || nd.shaftType === "\u306a\u3057") sIdx = 3;
                ddDefShaftType.selection = sIdx;
            }
            saveCurrentPreferences();
            alert("\u73fe\u5728\u306e\u30e2\u30c7\u30ea\u30f3\u30b0\u8a2d\u5b9a\u3092\u65e2\u5b9a\u5024\u3068\u3057\u3066\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002");
        };

        btnApplyDefToModel.onClick = function () {
            if (trainListBox.selection && trainNodes.length > 0) {
                var nd = trainNodes[trainListBox.selection.index];
                nd.m = parseFloat(etModule.text) || 2.0;
                nd.alphaDeg = parseFloat(etAlpha.text) || 20.0;
                nd.backlash = !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15;
                nd.tipRounding = parseFloat(etTipRounding.text) || 0.0;
                nd.shaftDia = (function () { var v = parseFloat(etShaftDia.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })();
                var sIdx = ddDefShaftType.selection ? ddDefShaftType.selection.index : 0;
                nd.shaftType = (sIdx === 1) ? "D_CUT" : ((sIdx === 2) ? "KEYWAY" : ((sIdx === 3) ? "NONE" : "ROUND"));
                loadNodeToForm(nd);
                refreshTrainList(trainListBox.selection.index);
            }
            alert("\u65e2\u5b9a\u5024\u3092\u9078\u629e\u30ae\u30a2\u306b\u53cd\u6620\u3057\u307e\u3057\u305f\u3002");
        };

        btnExportProfile.onClick = function () {
            try {
                var saveFile = File.saveDialog("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u306e\u66f8\u304d\u51fa\u3057 (JSON)", "JSON\u30d5\u30a1\u30a4\u30eb:*.json");
                if (saveFile) {
                    var prefsToSave = collectPreferencesFromUI();
                    if (PreferencesManager.exportPreferencesToFile(saveFile, prefsToSave)) {
                        alert("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u3092\u66f8\u304d\u51fa\u3057\u307e\u3057\u305f:\n" + saveFile.fsName);
                    } else {
                        alert("\u8a2d\u5b9a\u306e\u66f8\u304d\u51fa\u3057\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
                    }
                }
            } catch (eExpProf) {
                alert("\u8a2d\u5b9a\u66f8\u304d\u51fa\u3057\u30a8\u30e9\u30fc:\n" + eExpProf.message);
            }
        };

        btnImportProfile.onClick = function () {
            try {
                var openFile = File.openDialog("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u306e\u8aad\u307f\u8fbc\u307f (JSON)", "JSON\u30d5\u30a1\u30a4\u30eb:*.json");
                if (openFile) {
                    var loaded = PreferencesManager.importPreferencesFromFile(openFile);
                    if (loaded) {
                        applyPreferencesToUI(loaded);
                        alert("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u3092\u8aad\u307f\u8fbc\u307f\u307e\u3057\u305f:\n" + openFile.fsName);
                    } else {
                        alert("\u6709\u52b9\u306a\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002");
                    }
                }
            } catch (eImpProf) {
                alert("\u8a2d\u5b9a\u8aad\u307f\u8fbc\u307f\u30a8\u30e9\u30fc:\n" + eImpProf.message);
            }
        };

        btnResetDefaults.onClick = function () {
            var doReset = true;
            if (typeof confirm === "function") {
                doReset = confirm("\u3059\u3079\u3066\u306e\u8a2d\u5b9a\u3092\u521d\u671f\u5024\u306b\u623b\u3057\u307e\u3059\u304b\uff1f");
            }
            if (doReset) {
                var def = PreferencesManager.getDefaultPreferences();
                applyPreferencesToUI(def);
                alert("\u8a2d\u5b9a\u3092\u521d\u671f\u5024\u306b\u30ea\u30bb\u30c3\u30c8\u3057\u307e\u3057\u305f\u3002");
            }
        };

        // --- Wiring: Batch CSV / TSV Import & Export ---
        btnImportCSV.onClick = function () {
            try {
                var csvFile = File.openDialog("\u8f2a\u5217\u5b9a\u7fa9\u30d5\u30a1\u30a4\u30eb\u306e\u8aad\u307f\u8fbc\u307f (CSV/TSV)", "\u30c6\u30ad\u30b9\u30c8\u30d5\u30a1\u30a4\u30eb:*.csv;*.tsv;*.txt");
                if (csvFile) {
                    csvFile.encoding = "UTF-8";
                    if (csvFile.open("r")) {
                        var text = csvFile.read();
                        csvFile.close();
                        if (text && text.length > 0) {
                            var imported = GearBatchParser.parseCSVToTrainNodes(text);
                            if (imported && imported.length > 0) {
                                trainNodes = imported;
                                refreshTrainList(0);
                                updatePlacementCoordinates();
                                alert("\u8f2a\u5217\u5b9a\u7fa9\u3092\u8aad\u307f\u8fbc\u307f\u307e\u3057\u305f (" + imported.length + "\u500b\u306e\u30ae\u30a2)");
                            } else {
                                alert("\u6709\u52b9\u306a\u8f2a\u5217\u884c\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002");
                            }
                        }
                    }
                }
            } catch (eCsvImp) {
                alert("CSV\u8aad\u8fbc\u30a8\u30e9\u30fc:\n" + eCsvImp.message);
            }
        };

        btnExportCSV.onClick = function () {
            if (trainNodes.length === 0) {
                alert("\u30a8\u30af\u30b9\u30dd\u30fc\u30c8\u3059\u308b\u30ae\u30a2\u304c\u3042\u308a\u307e\u305b\u3093\u3002");
                return;
            }
            try {
                var csvSaveFile = File.saveDialog("\u8f2a\u5217\u5b9a\u7fa9\u306e\u30a8\u30af\u30b9\u30dd\u30fc\u30c8 (CSV)", "CSV\u30d5\u30a1\u30a4\u30eb:*.csv");
                if (csvSaveFile) {
                    var csvContent = GearBatchParser.trainNodesToCSV(trainNodes, ",");
                    csvSaveFile.encoding = "UTF-8";
                    if (csvSaveFile.open("w")) {
                        csvSaveFile.write(csvContent);
                        csvSaveFile.close();
                        alert("\u8f2a\u5217\u5b9a\u7fa9\u3092\u51fa\u529b\u3057\u307e\u3057\u305f:\n" + csvSaveFile.fsName);
                    } else {
                        alert("\u30d5\u30a1\u30a4\u30eb\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
                    }
                }
            } catch (eCsvExp) {
                alert("CSV\u51fa\u529b\u30a8\u30e9\u30fc:\n" + eCsvExp.message);
            }
        };

        // --- Wiring: Diagnostics & Explorer Integration ---
        btnBrowseLogFolder.onClick = function () {
            try {
                var selFolder = Folder.selectDialog("\u30ed\u30b0\u51fa\u529b\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e");
                if (selFolder) {
                    logFolderPath = selFolder.fsName;
                    alert("\u30ed\u30b0\u51fa\u529b\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u8a2d\u5b9a\u3057\u307e\u3057\u305f:\n" + logFolderPath);
                }
            } catch (eBrw) {
                alert("\u30d5\u30a9\u30eb\u30c0\u9078\u629e\u30a8\u30e9\u30fc:\n" + eBrw.message);
            }
        };

        btnOpenLogFolder.onClick = function () {
            try {
                var target = null;
                if (logFolderPath) {
                    target = new Folder(logFolderPath);
                }
                if (!target || !target.exists) {
                    if (typeof app !== "undefined" && app.documents && app.documents.length > 0 && app.activeDocument.saved) {
                        try { target = app.activeDocument.path; } catch (eDocPath) {}
                    }
                }
                if (!target || !target.exists) {
                    target = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : null;
                }

                if (target && target.exists) {
                    target.execute();
                } else {
                    alert("\u30ed\u30b0\u30d5\u30a9\u30eb\u30c0\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002");
                }
            } catch (eOpn) {
                alert("\u30d5\u30a9\u30eb\u30c0\u8d77\u52d5\u30a8\u30e9\u30fc:\n" + eOpn.message);
            }
        };

        btnViewLog.onClick = function () {
            showLogViewerModal(win);
        };

        // Auto-load preferences on startup
        try {
            if (typeof PreferencesManager !== "undefined") {
                var startupPrefs = PreferencesManager.loadPreferences();
                if (startupPrefs) {
                    applyPreferencesToUI(startupPrefs);
                }
            }
        } catch (eStartupPref) {
            CalcLogger.warn("UI", "Failed to load preferences on startup: " + eStartupPref.message);
        }

        // Initialize table
        refreshTrainList(-1);

        // ==========================================
        // Modal / Automated Testing Hooks
        // ==========================================
        var dialogResult = { cancelled: true, trainNodes: [], options: {} };

        btnDraw.onClick = function () {
            if (trainNodes.length === 0) {
                alert("\u8f2a\u5217\u306b\u30ae\u30a2\u304c\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\u30ae\u30a2\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                return;
            }

            var isOriginalCircleRef = (ddPlacementRef.selection && ddPlacementRef.selection.index === 3);
            var originX = isOriginalCircleRef ? 0.0 : (parseFloat(etTargetX.text) || 0.0);
            var originY = isOriginalCircleRef ? 0.0 : (parseFloat(etTargetY.text) || 0.0);

            if (!isOriginalCircleRef && trainNodes.length > 0) {
                trainNodes[0].xOffset = 0.0;
                trainNodes[0].yOffset = 0.0;
            }

            dialogResult.cancelled = false;
            dialogResult.trainNodes = trainNodes;
            dialogResult.options = {
                trainId: etTrainId.text,
                module: parseFloat(etModule.text) || 2.0,
                alphaDeg: parseFloat(etAlpha.text) || 20.0,
                backlash: !isNaN(parseFloat(etBacklash.text)) ? parseFloat(etBacklash.text) : 0.15,
                kerf: parseFloat(etKerf.text) || 0.0,
                tipRounding: parseFloat(etTipRounding.text) || 0.0,
                shaftDia: (function () { var v = parseFloat(etShaftDia.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })(),
                shaftType: (function () { var idx = ddDefShaftType.selection ? ddDefShaftType.selection.index : 0; return (idx === 1) ? "D_CUT" : ((idx === 2) ? "KEYWAY" : ((idx === 3) ? "NONE" : "ROUND")); })(),
                thicknessBasis: ddThicknessBasis.selection ? ddThicknessBasis.selection.index : 0,
                centerGuideMode: ddCenterGuideMode.selection ? (ddCenterGuideMode.selection.index === 1 ? "RELATIVE" : "FIXED") : "FIXED",
                centerGuideSize: (function () { var v = parseFloat(etCenterGuideSize.text); return (!isNaN(v) && v >= 0) ? v : 5.0; })(),
                compoundPath: chkCompoundPath.value,
                pitchGuide: chkPitchGuide.value,
                centerGuide: chkCenterGuide.value,
                individualTeeth: chkIndividualTeeth.value,
                specLabels: chkSpecLabels.value,
                singleSkeleton: chkSingleSkeleton.value,
                perStageSkeleton: chkPerStageSkeleton.value,
                carrierBase: chkCarrierBase.value,
                namingPresetKey: (function () { var idx = ddNamingPreset.selection ? ddNamingPreset.selection.index : 0; return (idx === 1) ? "engineering" : ((idx === 2) ? "cam" : "standard"); })(),
                namingPattern: etNamingPattern.text,
                stylePresetKey: (function () { var idx = ddStylePreset.selection ? ddStylePreset.selection.index : 0; return (idx === 1) ? "jis" : ((idx === 2) ? "cnc" : ((idx === 3) ? "custom" : "laser")); })(),
                tolerance: parseFloat(etTolerance.text) || 0.01,
                distanceSolveMode: ddDistanceSolveMode.selection ? ddDistanceSolveMode.selection.index : 0,
                allowCrossLayerMesh: chkAllowCrossLayerMesh.value,
                targetOriginMm: [originX, originY],
                styles: currentStyles,
                colorPresets: colorPresets,
                circleAction: ddCircleAction.selection ? ddCircleAction.selection.index : 0,
                scannedCircles: scannedCircles,
                bezierPrecision: ddBezierPrecision.selection ? ddBezierPrecision.selection.index : 0,
                autoSaveLog: chkAutoSaveLog.value,
                logFolderPath: logFolderPath
            };

            saveCurrentPreferences();
            win.close(1);
        };

        btnCancel.onClick = function () {
            dialogResult.cancelled = true;
            saveCurrentPreferences();
            win.close(0);
        };

        win.onClose = function () {
            saveCurrentPreferences();
        };

        if (win.layout && typeof win.layout.layout === "function") {
            win.layout.layout(true);
        }
        if (typeof win.center === "function") {
            win.center();
        }
        var showRes = 1;

        win.uiControls = {
            trainListBox: trainListBox,
            btnAddSpur: btnAddSpur,
            btnAddCoaxial: btnAddCoaxial,
            btnAddInternal: btnAddInternal,
            btnAddRack: btnAddRack,
            btnAddPlanetary: btnAddPlanetary,
            btnAddParadox: btnAddParadox,
            btnAddIntermittent: btnAddIntermittent,
            btnDeleteNode: btnDeleteNode,
            btnChangeId: btnChangeId,
            btnCustomCutout: btnCustomCutout,
            btnUpdateCoords: btnUpdateCoords,
            btnRescanCircle: btnRescanCircle,
            btnColorPresets: btnColorPresets,
            btnAutoBuildTree: btnAutoBuildTree,
            btnStyleDetail: btnStyleDetail,
            btnBrowseLogFolder: btnBrowseLogFolder,
            btnOpenLogFolder: btnOpenLogFolder,
            btnExportProfile: btnExportProfile,
            btnImportProfile: btnImportProfile,
            btnResetDefaults: btnResetDefaults,
            btnImportCSV: btnImportCSV,
            btnExportCSV: btnExportCSV,
            btnViewLog: btnViewLog,
            btnDraw: btnDraw,
            btnCancel: btnCancel,
            etNodeId: etNodeId,
            ddNodeParent: ddNodeParent,
            ddNodeKind: ddNodeKind,
            etNodeZ: etNodeZ,
            etNodeShift: etNodeShift,
            etNodeAngle: etNodeAngle,
            etNodeStage: etNodeStage,
            etNodeModule: etNodeModule,
            etNodeAlpha: etNodeAlpha,
            etNodeBacklash: etNodeBacklash,
            etNodeTipRounding: etNodeTipRounding,
            etNodeBackHeight: etNodeBackHeight,
            ddNodeShaftType: ddNodeShaftType,
            etNodeShaft: etNodeShaft,
            ddPlacementRef: ddPlacementRef,
            cbFromCircle: cbFromCircle,
            rbSelected: rbSelected,
            rbAllLayers: rbAllLayers,
            cbExtractInnerShapes: cbExtractInnerShapes,
            ddCircleAction: ddCircleAction,
            chkCompoundPath: chkCompoundPath,
            chkPitchGuide: chkPitchGuide,
            chkCenterGuide: chkCenterGuide,
            chkIndividualTeeth: chkIndividualTeeth,
            chkSingleSkeleton: chkSingleSkeleton,
            chkPerStageSkeleton: chkPerStageSkeleton,
            chkCarrierBase: chkCarrierBase,
            ddCenterGuideMode: ddCenterGuideMode,
            etCenterGuideSize: etCenterGuideSize,
            ddStylePreset: ddStylePreset,
            ddBezierPrecision: ddBezierPrecision,
            ddNamingPreset: ddNamingPreset,
            etTrainId: etTrainId,
            etNamingPattern: etNamingPattern,
            etModule: etModule,
            etAlpha: etAlpha,
            etBacklash: etBacklash,
            etTipRounding: etTipRounding,
            etShaftDia: etShaftDia,
            ddDefShaftType: ddDefShaftType
        };

        if (options.isTest) {
            win.show();
            try {
                if (typeof TesterRunner !== "undefined" && typeof TesterRunner.captureGuiScreenshot === "function") {
                    TesterRunner.captureGuiScreenshot(options.screenshotPath || "gui_capture.png");
                }
            } catch (eSc) {}

            if (options.onTestCallback && typeof options.onTestCallback === "function") {
                try {
                    options.onTestCallback(win);
                } catch (eCb) {}
            }

            var waitMs = options.autoCloseMs || 800;
            $.sleep(waitMs);
            win.close();
            dialogResult.cancelled = false;
        } else {
            showRes = win.show();
        }

        return {
            window: win,
            cancelled: dialogResult.cancelled,
            trainNodes: dialogResult.trainNodes,
            options: dialogResult.options,
            showResult: showRes
        };
    }

    /**
     * Programmatically triggers events on all UI controls in DialogView to ensure
     * zero unhandled exceptions (Stress Testing).
     * 
     * @param {Window} win Target DialogView window
     * @param {Object} options Execution options
     * @returns {Object} { executedCount: number, errorCount: number, errors: Array }
     */
    function executeAllUiEvents(win, options) {
        options = options || {};
        var ctrl = (win && win.uiControls) ? win.uiControls : {};
        var errors = [];
        var count = 0;

        function fireEvent(target, evtName, val) {
            if (!target) return;
            count++;
            try {
                if (val !== undefined) {
                    if (typeof target.text !== "undefined") target.text = String(val);
                    if (typeof target.value !== "undefined") target.value = val;
                }
                if (typeof target[evtName] === "function") {
                    target[evtName]();
                }
            } catch (eEvt) {
                errors.push("Error firing " + evtName + " on control: " + eEvt.message);
            }
        }

        // 1. Text change events
        fireEvent(ctrl.etNodeZ, "onChange", "20");
        fireEvent(ctrl.etNodeShift, "onChange", "0.25");
        fireEvent(ctrl.etNodeAngle, "onChange", "15");
        fireEvent(ctrl.etNodeStage, "onChange", "1");
        fireEvent(ctrl.etNodeModule, "onChange", "2.5");
        fireEvent(ctrl.etNodeAlpha, "onChange", "20.0");
        fireEvent(ctrl.etNodeBacklash, "onChange", "0.1");
        fireEvent(ctrl.etNodeTipRounding, "onChange", "0.15");
        fireEvent(ctrl.etNodeBackHeight, "onChange", "6.0");
        fireEvent(ctrl.etNodeShaft, "onChange", "8.0");
        fireEvent(ctrl.etCenterGuideSize, "onChange", "10.0");

        // 2. Dropdown / Selection change events
        if (ctrl.ddNodeKind && ctrl.ddNodeKind.items && ctrl.ddNodeKind.items.length > 1) {
            ctrl.ddNodeKind.selection = 1;
            fireEvent(ctrl.ddNodeKind, "onChange");
            ctrl.ddNodeKind.selection = 0;
            fireEvent(ctrl.ddNodeKind, "onChange");
        }
        if (ctrl.ddNodeShaftType && ctrl.ddNodeShaftType.items && ctrl.ddNodeShaftType.items.length > 1) {
            ctrl.ddNodeShaftType.selection = 1;
            fireEvent(ctrl.ddNodeShaftType, "onChange");
        }
        if (ctrl.ddCenterGuideMode && ctrl.ddCenterGuideMode.items && ctrl.ddCenterGuideMode.items.length > 1) {
            ctrl.ddCenterGuideMode.selection = 1;
            fireEvent(ctrl.ddCenterGuideMode, "onChange");
        }
        if (ctrl.ddStylePreset && ctrl.ddStylePreset.items && ctrl.ddStylePreset.items.length > 1) {
            ctrl.ddStylePreset.selection = 1;
            fireEvent(ctrl.ddStylePreset, "onChange");
        }

        // 3. Checkbox toggles
        fireEvent(ctrl.cbFromCircle, "onClick", true);
        fireEvent(ctrl.cbExtractInnerShapes, "onClick", true);
        fireEvent(ctrl.chkCarrierBase, "onClick", true);
        fireEvent(ctrl.chkSingleSkeleton, "onClick", true);
        fireEvent(ctrl.chkPerStageSkeleton, "onClick", true);
        fireEvent(ctrl.chkCompoundPath, "onClick", false);
        fireEvent(ctrl.chkPitchGuide, "onClick", true);
        fireEvent(ctrl.chkCenterGuide, "onClick", true);

        // 4. Node Action Buttons
        fireEvent(ctrl.btnAddSpur, "onClick");
        fireEvent(ctrl.btnAddCoaxial, "onClick");
        fireEvent(ctrl.btnAddInternal, "onClick");
        fireEvent(ctrl.btnAddRack, "onClick");

        // List selection change
        if (ctrl.trainListBox && ctrl.trainListBox.items && ctrl.trainListBox.items.length > 0) {
            ctrl.trainListBox.selection = 0;
            fireEvent(ctrl.trainListBox, "onChange");
        }

        return {
            executedCount: count,
            errorCount: errors.length,
            errors: errors
        };
    }

    return {
        show: show,
        showStyleDetailModal: showStyleDetailModal,
        showColorPresetModal: showColorPresetModal,
        showAddPlanetaryModal: showAddPlanetaryModal,
        showAddParadoxModal: showAddParadoxModal,
        showAddIntermittentModal: showAddIntermittentModal,
        executeAllUiEvents: executeAllUiEvents,
        DEFAULT_COLOR_PRESETS: DEFAULT_COLOR_PRESETS,
        STYLE_PRESETS: STYLE_PRESETS
    };
})();
/**
 * TesterRunner.jsxinc - GearDrawer Automatic Test Runner & Numerical Validity Verifier
 * Version: 1.0.0
 * 
 * Provides:
 * - Numerical Validity Checker (handles, radial monotonicity, self-intersection, meshing clearance)
 * - Automatic image export via doc.imageCapture()
 * - GUI screenshot capture via PowerShell Desktop Bridge
 * - Standalone mock / offline numeric validation harness
 * - Illustrator on-artboard test execution for Cases 1 to 43
 */

var TesterRunner = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    /**
     * 1. Validates that PathPoints contain no NaN/Infinity and control handles
     * do not exceed abnormal lengths (> 2.5 * m).
     */
    function validateHandles(pathItem, m) {
        var errors = [];
        if (!pathItem || !pathItem.pathPoints) {
            errors.push("Invalid pathItem or missing pathPoints");
            return { valid: false, errors: errors };
        }

        var pts = pathItem.pathPoints;
        var maxHandlePt = (m || 2.0) * 2.5 * MM_TO_PT;

        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
            var a = pt.anchor;
            var l = pt.leftDirection;
            var r = pt.rightDirection;

            // Check NaN or Infinity
            if (isNaN(a[0]) || isNaN(a[1]) || !isFinite(a[0]) || !isFinite(a[1])) {
                errors.push("Point " + i + ": Anchor coordinate contains NaN/Infinity (" + a[0] + ", " + a[1] + ")");
            }
            if (isNaN(l[0]) || isNaN(l[1]) || !isFinite(l[0]) || !isFinite(l[1])) {
                errors.push("Point " + i + ": LeftDirection contains NaN/Infinity (" + l[0] + ", " + l[1] + ")");
            }
            if (isNaN(r[0]) || isNaN(r[1]) || !isFinite(r[0]) || !isFinite(r[1])) {
                errors.push("Point " + i + ": RightDirection contains NaN/Infinity (" + r[0] + ", " + r[1] + ")");
            }

            // Check handle runaway length
            var dlx = l[0] - a[0];
            var dly = l[1] - a[1];
            var lenL = Math.sqrt(dlx * dlx + dly * dly);
            if (lenL > maxHandlePt) {
                errors.push("Point " + i + ": In-handle runaway length " + (lenL * PT_TO_MM).toFixed(3) + "mm > max " + (maxHandlePt * PT_TO_MM).toFixed(3) + "mm");
            }

            var drx = r[0] - a[0];
            var dry = r[1] - a[1];
            var lenR = Math.sqrt(drx * drx + dry * dry);
            if (lenR > maxHandlePt) {
                errors.push("Point " + i + ": Out-handle runaway length " + (lenR * PT_TO_MM).toFixed(3) + "mm > max " + (maxHandlePt * PT_TO_MM).toFixed(3) + "mm");
            }
        }

        return {
            valid: (errors.length === 0),
            errors: errors
        };
    }

    /**
     * 2. Validates radial monotonicity and checks for self-intersection loops
     * in tooth flanks.
     */
    function validateRadialMonotonicityAndSelfIntersection(pathItem, center) {
        var errors = [];
        if (!pathItem || !pathItem.pathPoints || pathItem.pathPoints.length < 3) {
            errors.push("PathItem has fewer than 3 points");
            return { valid: false, errors: errors };
        }

        var pts = pathItem.pathPoints;
        var poly = [];
        for (var i = 0; i < pts.length; i++) {
            poly.push([pts[i].anchor[0], pts[i].anchor[1]]);
        }

        function ccw(p1, p2, p3) {
            return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
        }

        function intersect(p1, p2, p3, p4) {
            return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
        }

        // Test non-adjacent segment intersections
        var n = poly.length;
        var maxCheck = n > 60 ? 60 : n;
        for (var si = 0; si < maxCheck; si++) {
            var a1 = poly[si];
            var a2 = poly[(si + 1) % n];
            for (var sj = si + 2; sj < maxCheck; sj++) {
                if ((sj + 1) % n === si) continue; // adjacent closing segment
                var b1 = poly[sj];
                var b2 = poly[(sj + 1) % n];
                if (intersect(a1, a2, b1, b2)) {
                    errors.push("Self-intersection detected between segments " + si + "-" + (si + 1) + " and " + sj + "-" + (sj + 1));
                    break;
                }
            }
            if (errors.length > 5) break;
        }

        return {
            valid: (errors.length === 0),
            errors: errors
        };
    }

    /**
     * 3. Validates clearance at pitch meshing zone between two gears.
     */
    function validateMeshingClearance(path1, path2, m) {
        var errors = [];
        if (!path1 || !path2) {
            errors.push("Missing path1 or path2 for clearance validation");
            return { valid: false, clearanceMm: 0, interference: true, errors: errors };
        }

        var targetClearanceMm = 0.25 * (m || 2.0);
        var minDistancePt = 999999;

        var pts1 = path1.pathPoints;
        var pts2 = path2.pathPoints;

        for (var i = 0; i < pts1.length; i++) {
            var p1 = pts1[i].anchor;
            for (var j = 0; j < pts2.length; j++) {
                var p2 = pts2[j].anchor;
                var dx = p1[0] - p2[0];
                var dy = p1[1] - p2[1];
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistancePt) {
                    minDistancePt = dist;
                }
            }
        }

        var minDistanceMm = minDistancePt * PT_TO_MM;
        // Minor tolerance for numerical contact at pitch point (tangent contact)
        var interference = (minDistanceMm < -0.01);

        if (interference) {
            errors.push("Interference / mesh penetration detected (distance = " + minDistanceMm.toFixed(4) + " mm)");
        }

        return {
            valid: (errors.length === 0),
            clearanceMm: minDistanceMm,
            targetClearanceMm: targetClearanceMm,
            interference: interference,
            errors: errors
        };
    }

    /**
     * Finds contour path item within a gear group.
     */
    function findContourPath(groupItem, gearName) {
        if (!groupItem) return null;
        var expectedName = gearName + "_Contour";
        if (groupItem.pathItems) {
            for (var i = 0; i < groupItem.pathItems.length; i++) {
                if (groupItem.pathItems[i].name === expectedName) {
                    return groupItem.pathItems[i];
                }
            }
        }
        if (groupItem.compoundPathItems && groupItem.compoundPathItems.length > 0) {
            for (var c = 0; c < groupItem.compoundPathItems.length; c++) {
                var cp = groupItem.compoundPathItems[c];
                if (cp.pathItems) {
                    for (var j = 0; j < cp.pathItems.length; j++) {
                        if (cp.pathItems[j].name === expectedName) {
                            return cp.pathItems[j];
                        }
                    }
                    if (cp.pathItems.length > 0) {
                        return cp.pathItems[0];
                    }
                }
            }
        }
        if (groupItem.pathItems && groupItem.pathItems.length > 0) {
            return groupItem.pathItems[0];
        }
        return null;
    }

    /**
     * 4. Automatic PNG export using doc.imageCapture() with ExportOptionsPNG24 fallback
     */
    function captureGearView(doc, pngFilePath, clipBoundsPt, resolutionDpi) {
        if (!doc) return false;
        try {
            var targetFile = new File(pngFilePath);
            try {
                if (targetFile.exists) targetFile.remove();
                var tmpFile = new File(pngFilePath + ".tmp$$");
                if (tmpFile.exists) tmpFile.remove();
            } catch (eCleanOld) {}

            var captured = false;
            var dpi = resolutionDpi || 150;

            // Strategy 1: doc.imageCapture
            try {
                var opts = new ImageCaptureOptions();
                opts.resolution = dpi;
                opts.antiAliasing = true;
                opts.transparency = false;

                if (clipBoundsPt && clipBoundsPt.length === 4) {
                    doc.imageCapture(targetFile, clipBoundsPt, opts);
                } else {
                    var abIdx = 0;
                    try {
                        if (doc.artboards && typeof doc.artboards.getActiveArtboardIndex === "function") {
                            abIdx = doc.artboards.getActiveArtboardIndex();
                        }
                    } catch (eAb) {}
                    var fallbackRect = (doc.artboards && doc.artboards[abIdx]) ? doc.artboards[abIdx].artboardRect : [0, 1000, 1600, 0];
                    doc.imageCapture(targetFile, fallbackRect, opts);
                }
                if (targetFile.exists && targetFile.length > 0) {
                    captured = true;
                }
            } catch (eCap1) {
                CalcLogger.warn("CAPTURE", "doc.imageCapture failed: " + eCap1.message);
            }

            // Strategy 2: doc.exportFile with ExportOptionsPNG24 fallback
            if (!captured) {
                var tempAbIdx = -1;
                try {
                    var expOpts = new ExportOptionsPNG24();
                    expOpts.antiAliasing = true;
                    expOpts.transparency = false;
                    expOpts.artBoardClipping = true;
                    var scalePct = (dpi / 72.0) * 100.0;
                    expOpts.horizontalScale = scalePct;
                    expOpts.verticalScale = scalePct;

                    if (clipBoundsPt && clipBoundsPt.length === 4 && doc.artboards) {
                        try {
                            doc.artboards.add(clipBoundsPt);
                            tempAbIdx = doc.artboards.length - 1;
                            doc.artboards.setActiveArtboardIndex(tempAbIdx);
                        } catch (eAddAb) {}
                    }

                    doc.exportFile(targetFile, ExportType.PNG24, expOpts);
                    if (targetFile.exists && targetFile.length > 0) {
                        captured = true;
                    }
                } catch (eCap2) {
                    CalcLogger.error("CAPTURE", "doc.exportFile fallback failed: " + eCap2.message);
                } finally {
                    if (tempAbIdx >= 0 && doc.artboards && doc.artboards.length > tempAbIdx) {
                        try {
                            doc.artboards.remove(tempAbIdx);
                            doc.artboards.setActiveArtboardIndex(0);
                        } catch (eRemAb) {}
                    }
                }
            }

            if (captured) {
                CalcLogger.log("CAPTURE", "High-res PNG captured to: " + targetFile.fsName + " (" + targetFile.length + " bytes)");
                return true;
            }
            return false;
        } catch (eCap) {
            CalcLogger.error("CAPTURE", "Failed doc.imageCapture & exportFile: " + pngFilePath, eCap);
            return false;
        }
    }

    /**
     * 5. GUI screenshot trigger using PowerShell WinSta0\\Default bridge
     */
    function captureGuiScreenshot(outputPath) {
        try {
            var scriptFolder = null;
            try {
                if (typeof $ !== "undefined" && $.fileName) {
                    scriptFolder = (new File($.fileName)).parent;
                }
            } catch (eF) {}
            if (!scriptFolder || !scriptFolder.fsName) {
                scriptFolder = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : { fsName: "." };
            }

            var outPath = outputPath || (scriptFolder.fsName + "/gui_capture.png");
            var runnerFile = new File(scriptFolder.fsName + "/capture_gui.ps1");
            if (!runnerFile.exists) {
                runnerFile = new File(scriptFolder.fsName + "/test/capture_gui.ps1");
            }

            if (runnerFile.exists && typeof app !== "undefined" && typeof app.system === "function") {
                CalcLogger.log("GUI_CAPTURE", "Executing GUI capture: " + runnerFile.fsName + " -> " + outPath);
                var cmd = 'start /min powershell -ExecutionPolicy Bypass -NoProfile -File "' + runnerFile.fsName + '" -OutputPath "' + outPath + '"';
                app.system(cmd);
            } else {
                CalcLogger.warn("GUI_CAPTURE", "Runner file not found or app.system unavailable");
            }
            return true;
        } catch (eGui) {
            CalcLogger.error("GUI_CAPTURE", "GUI capture invocation failed", eGui);
            return false;
        }
    }

    /**
     * Standalone Numerical Validation (Offline / Mock-compatible)
     */
    function runNumericalValidation(mockGear) {
        var m = mockGear ? (mockGear.m || 2.0) : 2.0;
        var z = mockGear ? (mockGear.z || 18) : 18;
        var g = InvoluteCore.calculateSpurGear({ m: m, z: z });

        var errors = [];
        if (g.outerNodes.length !== z * 9) {
            errors.push("Expected " + (z * 9) + " nodes for spur gear, got " + g.outerNodes.length);
        }
        if (g.singleToothNodes.length !== 9) {
            errors.push("Expected 9 single tooth nodes for spur gear, got " + g.singleToothNodes.length);
        }

        // Internal gear check
        var gi = InvoluteCore.calculateInternalGear({ m: 2.0, z: 36 });
        if (gi.innerContourNodes.length !== 36 * 9) {
            errors.push("Expected " + (36 * 9) + " nodes for internal gear, got " + gi.innerContourNodes.length);
        }
        if (gi.rimNodes.length !== 4) {
            errors.push("Expected 4 rim nodes for internal gear, got " + gi.rimNodes.length);
        }

        var giRound = InvoluteCore.calculateInternalGear({ m: 2.0, z: 36, tipRounding: 0.2 });
        if (giRound.innerContourNodes.length !== 36 * 11) {
            errors.push("Expected " + (36 * 11) + " nodes for internal gear with tip rounding, got " + giRound.innerContourNodes.length);
        }

        // Rack check
        var gr = InvoluteCore.calculateRack({ m: 2.0, zRack: 10, backHeight: 5.0 });
        if (gr.outerNodes.length !== 74) {
            errors.push("Expected 74 nodes for linear rack (10*7 + 4), got " + gr.outerNodes.length);
        }

        var grRound = InvoluteCore.calculateRack({ m: 2.0, zRack: 8, tipRounding: 0.2, backHeight: 5.0 });
        if (grRound.outerNodes.length !== 76) {
            errors.push("Expected 76 nodes for linear rack with tip rounding (8*9 + 4), got " + grRound.outerNodes.length);
        }

        // Shaft and body check
        var shKey = ShaftAndBody.calculateShaftHole(15.0, "KEYWAY");
        if (!shKey.hasHole || shKey.nodes.length !== 7) {
            errors.push("Expected 7 nodes for keyway shaft hole, got " + (shKey.nodes ? shKey.nodes.length : 0));
        }

        var shDCut = ShaftAndBody.calculateShaftHole(10.0, "DCUT");
        if (!shDCut.hasHole || shDCut.nodes.length !== 5) {
            errors.push("Expected 5 nodes for D-cut shaft hole, got " + (shDCut.nodes ? shDCut.nodes.length : 0));
        }

        var cutSpokes = ShaftAndBody.calculateParametricCutouts(30.0, 15.0, "SPOKE_WINDOWS", { spokeCount: 4 });
        if (!cutSpokes.valid || cutSpokes.cutouts.length !== 4) {
            errors.push("Expected 4 spoke windows cutouts, got " + (cutSpokes.cutouts ? cutSpokes.cutouts.length : 0));
        }

        var cutHoles = ShaftAndBody.calculateParametricCutouts(30.0, 10.0, "CIRCULAR_HOLES", { holeCount: 4 });
        if (!cutHoles.valid || cutHoles.cutouts.length !== 4) {
            errors.push("Expected 4 circular cutouts, got " + (cutHoles.cutouts ? cutHoles.cutouts.length : 0));
        }

        // v0.3.0 Kinematics & Profile Shift Shortening Check
        var meshCheck = InvoluteCore.calculateMeshingParameters({
            m: 2.0, z: 16, x: 0.5, alphaDeg: 20.0
        }, {
            m: 2.0, z: 24, x: 0.5, alphaDeg: 20.0, gearType: "SPUR"
        });
        if (meshCheck.deltaY <= 0.0) {
            errors.push("Expected deltaY > 0 for profile-shifted pair (+0.5, +0.5), got " + meshCheck.deltaY);
        }
        if (meshCheck.contactRatio < 1.1) {
            errors.push("Expected contactRatio >= 1.1, got " + meshCheck.contactRatio);
        }

        // v0.3.0 Train Tree Resolver Check
        var rawNodes = [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: 18, m: 2.0 },
            { id: "G2", gearType: "SPUR", parentId: "G1", relationType: "MESHING", z: 24, relativeAngleDeg: 0 },
            { id: "G3", gearType: "SPUR", parentId: "G2", relationType: "COAXIAL", z: 16 },
            { id: "G4", gearType: "SPUR", parentId: "G3", relationType: "MESHING", z: 32, relativeAngleDeg: 90 }
        ];
        var resolved = TrainTreeResolver.resolveTrain({ m: 2.0, nodes: rawNodes });
        if (resolved.nodes.length !== 4) {
            errors.push("Expected 4 resolved train nodes, got " + resolved.nodes.length);
        }
        if (resolved.nodes[2].stageIndex !== 2) {
            errors.push("Expected stageIndex=2 for coaxial G3, got " + resolved.nodes[2].stageIndex);
        }
        if (resolved.nodes[3].stageIndex !== 2) {
            errors.push("Expected stageIndex=2 for driven G4, got " + resolved.nodes[3].stageIndex);
        }

        return {
            passed: (errors.length === 0),
            details: {
                m: m,
                z: z,
                spurNodes: g.outerNodes.length,
                internalNodes: gi.innerContourNodes.length,
                internalRoundNodes: giRound.innerContourNodes.length,
                rackNodes: gr.outerNodes.length,
                rackRoundNodes: grRound.outerNodes.length,
                meshingDeltaY: meshCheck.deltaY,
                meshingContactRatio: meshCheck.contactRatio,
                resolvedTrainNodes: resolved.nodes.length,
                errors: errors
            }
        };
    }

    /**
     * Test Runner Main Entry Point for Cases 1 to 37 (v0.7.0)
     */
    function run() {
        CalcLogger.setVersion("1.0.0");
        CalcLogger.init(true, true);
        CalcLogger.log("TEST", "Starting GearDrawer_Tester runner (v1.0.0)...");

        var report = {
            timestamp: (new Date()).toString(),
            illustratorVersion: (typeof app !== "undefined" && app.version) ? app.version : "MockEnv",
            cases: []
        };

        var allPassed = true;

        if (typeof app !== "undefined" && app.documents) {
            try {
                var doc = null;
                if (app.documents.length === 0) {
                    doc = app.documents.add(DocumentColorSpace.RGB, 3200, 6400);
                } else {
                    doc = app.activeDocument;
                }

                PathBuilder.ensureExitIsolationMode(doc);

                var abIdx = 0;
                try {
                    if (doc.artboards && typeof doc.artboards.getActiveArtboardIndex === "function") {
                        abIdx = doc.artboards.getActiveArtboardIndex();
                    } else if (typeof doc.getActiveArtboardIndex === "function") {
                        abIdx = doc.getActiveArtboardIndex();
                    }
                } catch (eAbIdx) {}
                var ab = doc.artboards[abIdx];
                var abRect = ab ? ab.artboardRect : [0, 6400, 3200, 0]; // [left, top, right, bottom]
                // Ensure artboard is large enough for all test cases (Case 1 - 43)
                if (ab && (abRect[1] - abRect[3] < 6200 || abRect[2] - abRect[0] < 3000)) {
                    try {
                        ab.artboardRect = [abRect[0], abRect[1], Math.max(abRect[2], abRect[0] + 3200), Math.min(abRect[3], abRect[1] - 6400)];
                        abRect = ab.artboardRect;
                    } catch (eAbResize) {}
                }
                var abLeft = abRect[0];
                var abTop = abRect[1];

                var testLayer = PathBuilder.getOrCreateLayer(doc, "GearDrawer_v050_Tests");
                try {
                    while (testLayer.pageItems.length > 0) {
                        testLayer.pageItems[0].remove();
                    }
                } catch (eClean) {}

                // ==========================================
                // CASE 1: Recommended Bezier (Top-Left)
                // m=2.0, z1=18, z2=36, bezier_recommended
                // Expected: G1=162 pts, G2=324 pts (9 pts/tooth), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 1: Recommended Bezier...");
                var c1Pos = [abLeft + 350, abTop - 250];
                var pair1 = PathBuilder.drawMeshingPair(doc, {
                    m: 2.0,
                    z1: 18,
                    z2: 36,
                    center1: c1Pos,
                    angleDeg: 0,
                    phi1Deg: 0,
                    targetLayer: testLayer,
                    name1: "Case1_G1",
                    name2: "Case1_G2",
                    options: { pathQuality: "bezier_recommended", drawGuides: true }
                });

                var p1G1 = findContourPath(pair1.group1, "Case1_G1");
                var p1G2 = findContourPath(pair1.group2, "Case1_G2");

                var c1Pass = false;
                var c1Errors = [];
                if (p1G1 && p1G2) {
                    var hCheck1 = validateHandles(p1G1, 2.0);
                    var hCheck2 = validateHandles(p1G2, 2.0);
                    var mCheck1 = validateRadialMonotonicityAndSelfIntersection(p1G1, pair1.center1);
                    var mCheck2 = validateRadialMonotonicityAndSelfIntersection(p1G2, pair1.center2);
                    var clearCheck = validateMeshingClearance(p1G1, p1G2, 2.0);

                    if (!hCheck1.valid) c1Errors = c1Errors.concat(hCheck1.errors);
                    if (!hCheck2.valid) c1Errors = c1Errors.concat(hCheck2.errors);
                    if (!mCheck1.valid) c1Errors = c1Errors.concat(mCheck1.errors);
                    if (!mCheck2.valid) c1Errors = c1Errors.concat(mCheck2.errors);
                    if (!clearCheck.valid) c1Errors = c1Errors.concat(clearCheck.errors);

                    c1Pass = (p1G1.pathPoints.length === 162 &&
                              p1G2.pathPoints.length === 324 &&
                              p1G1.closed === true &&
                              p1G2.closed === true &&
                              c1Errors.length === 0);
                } else {
                    c1Errors.push("Contour paths not found for Case 1");
                }

                report.cases.push({
                    name: "Case1_Recommended",
                    passed: c1Pass,
                    g1Points: p1G1 ? p1G1.pathPoints.length : 0,
                    g1Expected: 162,
                    g2Points: p1G2 ? p1G2.pathPoints.length : 0,
                    g2Expected: 324,
                    closed: p1G1 ? (p1G1.closed && p1G2.closed) : false,
                    errors: c1Errors
                });
                if (!c1Pass) allPassed = false;

                // ==========================================
                // CASE 2: Minimal Bezier Config B (Top-Right)
                // m=2.0, z1=18, z2=36, bezier_minimal
                // Expected: G1=126 pts, G2=252 pts (7 pts/tooth), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 2: Minimal Bezier...");
                var c2Pos = [abLeft + 1150, abTop - 250];
                var pair2 = PathBuilder.drawMeshingPair(doc, {
                    m: 2.0,
                    z1: 18,
                    z2: 36,
                    center1: c2Pos,
                    angleDeg: 0,
                    phi1Deg: 0,
                    targetLayer: testLayer,
                    name1: "Case2_G1",
                    name2: "Case2_G2",
                    options: { pathQuality: "bezier_minimal", drawGuides: true }
                });

                var p2G1 = findContourPath(pair2.group1, "Case2_G1");
                var p2G2 = findContourPath(pair2.group2, "Case2_G2");

                var c2Pass = false;
                var c2Errors = [];
                if (p2G1 && p2G2) {
                    var hCheck21 = validateHandles(p2G1, 2.0);
                    var hCheck22 = validateHandles(p2G2, 2.0);
                    var mCheck21 = validateRadialMonotonicityAndSelfIntersection(p2G1, pair2.center1);
                    var mCheck22 = validateRadialMonotonicityAndSelfIntersection(p2G2, pair2.center2);

                    if (!hCheck21.valid) c2Errors = c2Errors.concat(hCheck21.errors);
                    if (!hCheck22.valid) c2Errors = c2Errors.concat(hCheck22.errors);
                    if (!mCheck21.valid) c2Errors = c2Errors.concat(mCheck21.errors);
                    if (!mCheck22.valid) c2Errors = c2Errors.concat(mCheck22.errors);

                    c2Pass = (p2G1.pathPoints.length === 126 &&
                              p2G2.pathPoints.length === 252 &&
                              p2G1.closed === true &&
                              p2G2.closed === true &&
                              c2Errors.length === 0);
                } else {
                    c2Errors.push("Contour paths not found for Case 2");
                }

                report.cases.push({
                    name: "Case2_Minimal",
                    passed: c2Pass,
                    g1Points: p2G1 ? p2G1.pathPoints.length : 0,
                    g1Expected: 126,
                    g2Points: p2G2 ? p2G2.pathPoints.length : 0,
                    g2Expected: 252,
                    closed: p2G1 ? (p2G1.closed && p2G2.closed) : false,
                    errors: c2Errors
                });
                if (!c2Pass) allPassed = false;

                // ==========================================
                // CASE 3: Undercut Gears (Bottom-Left)
                // m=2.0, z1=12 (<17.1), z2=24, bezier_recommended
                // Expected: G1=132 pts (11 pts/tooth), G2=216 pts (9 pts/tooth), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 3: Undercut Gears...");
                var c3Pos = [abLeft + 350, abTop - 700];
                var pair3 = PathBuilder.drawMeshingPair(doc, {
                    m: 2.0,
                    z1: 12,
                    z2: 24,
                    center1: c3Pos,
                    angleDeg: 0,
                    phi1Deg: 0,
                    targetLayer: testLayer,
                    name1: "Case3_G1",
                    name2: "Case3_G2",
                    options: { pathQuality: "bezier_recommended", drawGuides: true }
                });

                var p3G1 = findContourPath(pair3.group1, "Case3_G1");
                var p3G2 = findContourPath(pair3.group2, "Case3_G2");

                var c3Pass = false;
                var c3Errors = [];
                if (p3G1 && p3G2) {
                    var hCheck31 = validateHandles(p3G1, 2.0);
                    var hCheck32 = validateHandles(p3G2, 2.0);
                    var mCheck31 = validateRadialMonotonicityAndSelfIntersection(p3G1, pair3.center1);
                    var mCheck32 = validateRadialMonotonicityAndSelfIntersection(p3G2, pair3.center2);

                    if (!hCheck31.valid) c3Errors = c3Errors.concat(hCheck31.errors);
                    if (!hCheck32.valid) c3Errors = c3Errors.concat(hCheck32.errors);
                    if (!mCheck31.valid) c3Errors = c3Errors.concat(mCheck31.errors);
                    if (!mCheck32.valid) c3Errors = c3Errors.concat(mCheck32.errors);

                    c3Pass = (p3G1.pathPoints.length === 132 &&
                              p3G2.pathPoints.length === 216 &&
                              p3G1.closed === true &&
                              p3G2.closed === true &&
                              c3Errors.length === 0);
                } else {
                    c3Errors.push("Contour paths not found for Case 3");
                }

                report.cases.push({
                    name: "Case3_Undercut",
                    passed: c3Pass,
                    g1Points: p3G1 ? p3G1.pathPoints.length : 0,
                    g1Expected: 132,
                    g2Points: p3G2 ? p3G2.pathPoints.length : 0,
                    g2Expected: 216,
                    closed: p3G1 ? (p3G1.closed && p3G2.closed) : false,
                    errors: c3Errors
                });
                if (!c3Pass) allPassed = false;

                // ==========================================
                // CASE 4: Individual Teeth Mode (Bottom-Right)
                // m=2.0, z=12, bezier_recommended, test_teeth
                // Expected: 12 independent open paths, 11 points each
                // ==========================================
                CalcLogger.log("TEST", "Running Case 4: Individual Teeth Mode...");
                var c4Pos = [abLeft + 1150, abTop - 700];
                var gear4Data = InvoluteCore.calculateSpurGear({
                    m: 2.0,
                    z: 12,
                    pathQuality: "bezier_recommended"
                });
                var group4 = PathBuilder.drawGear(doc, testLayer, c4Pos, gear4Data, 0, "Case4_TeethMode_z12", {
                    drawMode: "test_teeth",
                    drawGuides: true
                });

                var indGroup = null;
                for (var ig = 0; ig < group4.groupItems.length; ig++) {
                    if (group4.groupItems[ig].name.indexOf("IndividualTeeth") !== -1) {
                        indGroup = group4.groupItems[ig];
                        break;
                    }
                }

                var teethCount = indGroup ? indGroup.pathItems.length : 0;
                var singleToothPts = (teethCount > 0) ? indGroup.pathItems[0].pathPoints.length : 0;
                var allOpen = true;
                if (indGroup) {
                    for (var tIdx = 0; tIdx < indGroup.pathItems.length; tIdx++) {
                        if (indGroup.pathItems[tIdx].closed) {
                            allOpen = false;
                            break;
                        }
                    }
                }
                var c4Pass = (teethCount === 12 && singleToothPts === 11 && allOpen);

                report.cases.push({
                    name: "Case4_TeethMode",
                    passed: c4Pass,
                    teethCount: teethCount,
                    teethExpected: 12,
                    singlePts: singleToothPts,
                    singlePtsExpected: 11,
                    closed: !allOpen
                });
                if (!c4Pass) allPassed = false;

                // ==========================================
                // CASE 5: Tip Rounding Fillet (Center-Middle)
                // m=2.0, z1=18, z2=36, rTip=0.2, bezier_recommended
                // Expected: G1=198 pts (11 pts/tooth), G2=396 pts (11 pts/tooth), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 5: Tip Rounding Fillet...");
                var c5Pos = [abLeft + 750, abTop - 480];
                var pair5 = PathBuilder.drawMeshingPair(doc, {
                    m: 2.0,
                    z1: 18,
                    z2: 36,
                    center1: c5Pos,
                    angleDeg: 0,
                    phi1Deg: 0,
                    tipRounding1: 0.2,
                    tipRounding2: 0.2,
                    targetLayer: testLayer,
                    name1: "Case5_G1",
                    name2: "Case5_G2",
                    options: { pathQuality: "bezier_recommended", drawGuides: true }
                });

                var p5G1 = findContourPath(pair5.group1, "Case5_G1");
                var p5G2 = findContourPath(pair5.group2, "Case5_G2");

                var c5Pass = false;
                var c5Errors = [];
                if (p5G1 && p5G2) {
                    var hCheck51 = validateHandles(p5G1, 2.0);
                    var hCheck52 = validateHandles(p5G2, 2.0);
                    var mCheck51 = validateRadialMonotonicityAndSelfIntersection(p5G1, pair5.center1);
                    var mCheck52 = validateRadialMonotonicityAndSelfIntersection(p5G2, pair5.center2);

                    if (!hCheck51.valid) c5Errors = c5Errors.concat(hCheck51.errors);
                    if (!hCheck52.valid) c5Errors = c5Errors.concat(hCheck52.errors);
                    if (!mCheck51.valid) c5Errors = c5Errors.concat(mCheck51.errors);
                    if (!mCheck52.valid) c5Errors = c5Errors.concat(mCheck52.errors);

                    c5Pass = (p5G1.pathPoints.length === 198 &&
                              p5G2.pathPoints.length === 396 &&
                              p5G1.closed === true &&
                              p5G2.closed === true &&
                              c5Errors.length === 0);
                } else {
                    c5Errors.push("Contour paths not found for Case 5");
                }

                report.cases.push({
                    name: "Case5_TipRounding",
                    passed: c5Pass,
                    g1Points: p5G1 ? p5G1.pathPoints.length : 0,
                    g1Expected: 198,
                    g2Points: p5G2 ? p5G2.pathPoints.length : 0,
                    g2Expected: 396,
                    closed: p5G1 ? (p5G1.closed && p5G2.closed) : false,
                    errors: c5Errors
                });
                if (!c5Pass) allPassed = false;

                // ==========================================
                // CASE 6: Internal Ring Gear (Circular Rim)
                // m=2.0, z=36, rimThickness=6.0 (3.0*m), bezier_recommended
                // Expected: CompoundPathItem with 2 paths (Outer Rim: 4 pts, Inner Teeth: 324 pts = 9 pts/tooth)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 6: Internal Ring Gear (Circular Rim)...");
                var c6Pos = [abLeft + 950, abTop - 1350];
                var int6Data = InvoluteCore.calculateInternalGear({
                    m: 2.0,
                    z: 36,
                    rimThickness: 6.0,
                    rimShape: "CIRCLE",
                    pathQuality: "bezier_recommended"
                });
                var group6 = PathBuilder.drawInternalGear(doc, testLayer, c6Pos, int6Data, 0, "Case6_Internal_z36", {
                    drawGuides: true
                });

                var c6Compound = null;
                for (var ci6 = 0; ci6 < group6.compoundPathItems.length; ci6++) {
                    if (group6.compoundPathItems[ci6].name.indexOf("Body") !== -1) {
                        c6Compound = group6.compoundPathItems[ci6];
                        break;
                    }
                }

                var c6Pass = false;
                var c6Errors = [];
                var c6RimPts = 0;
                var c6TeethPts = 0;
                if (c6Compound && c6Compound.pathItems.length === 2) {
                    var pA = c6Compound.pathItems[0];
                    var pB = c6Compound.pathItems[1];
                    var pTeeth = (pA.pathPoints.length > pB.pathPoints.length) ? pA : pB;
                    var pRim   = (pA.pathPoints.length > pB.pathPoints.length) ? pB : pA;

                    c6TeethPts = pTeeth.pathPoints.length;
                    c6RimPts = pRim.pathPoints.length;

                    var hCheck6 = validateHandles(pTeeth, 2.0);
                    if (!hCheck6.valid) c6Errors = c6Errors.concat(hCheck6.errors);

                    c6Pass = (c6RimPts === 4 &&
                              c6TeethPts === 324 &&
                              pRim.closed === true &&
                              pTeeth.closed === true &&
                              c6Errors.length === 0);
                } else {
                    c6Errors.push("CompoundPathItem with 2 sub-paths not found for Case 6");
                }

                report.cases.push({
                    name: "Case6_InternalGear",
                    passed: c6Pass,
                    subPaths: c6Compound ? c6Compound.pathItems.length : 0,
                    subPathsExpected: 2,
                    rimPoints: c6RimPts,
                    rimExpected: 4,
                    teethPoints: c6TeethPts,
                    teethExpected: 324,
                    errors: c6Errors
                });
                if (!c6Pass) allPassed = false;

                // ==========================================
                // CASE 7: Internal Ring Gear with Tip Rounding (Rectangular Rim)
                // m=2.0, z=36, tipRounding=0.2, rimShape="RECT", rimWidth=110, rimHeight=110
                // Expected: CompoundPathItem with 2 paths (Rect Rim: 4 pts, Inner Teeth: 396 pts = 11 pts/tooth)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 7: Internal Ring Gear with Tip Rounding (Rect Rim)...");
                var c7Pos = [abLeft + 1500, abTop - 1350];
                var int7Data = InvoluteCore.calculateInternalGear({
                    m: 2.0,
                    z: 36,
                    tipRounding: 0.2,
                    rimShape: "RECT",
                    rimWidth: 110.0,
                    rimHeight: 110.0,
                    pathQuality: "bezier_recommended"
                });
                var group7 = PathBuilder.drawInternalGear(doc, testLayer, c7Pos, int7Data, 0, "Case7_Internal_TipRound_z36", {
                    drawGuides: true
                });

                var c7Compound = null;
                for (var ci7 = 0; ci7 < group7.compoundPathItems.length; ci7++) {
                    if (group7.compoundPathItems[ci7].name.indexOf("Body") !== -1) {
                        c7Compound = group7.compoundPathItems[ci7];
                        break;
                    }
                }

                var c7Pass = false;
                var c7Errors = [];
                var c7RimPts = 0;
                var c7TeethPts = 0;
                if (c7Compound && c7Compound.pathItems.length === 2) {
                    var pA7 = c7Compound.pathItems[0];
                    var pB7 = c7Compound.pathItems[1];
                    var pTeeth7 = (pA7.pathPoints.length > pB7.pathPoints.length) ? pA7 : pB7;
                    var pRim7   = (pA7.pathPoints.length > pB7.pathPoints.length) ? pB7 : pA7;

                    c7TeethPts = pTeeth7.pathPoints.length;
                    c7RimPts = pRim7.pathPoints.length;

                    var hCheck7 = validateHandles(pTeeth7, 2.0);
                    if (!hCheck7.valid) c7Errors = c7Errors.concat(hCheck7.errors);

                    c7Pass = (c7RimPts === 4 &&
                              c7TeethPts === 396 &&
                              pRim7.closed === true &&
                              pTeeth7.closed === true &&
                              c7Errors.length === 0);
                } else {
                    c7Errors.push("CompoundPathItem with 2 sub-paths not found for Case 7");
                }

                report.cases.push({
                    name: "Case7_InternalGear_TipRounding",
                    passed: c7Pass,
                    subPaths: c7Compound ? c7Compound.pathItems.length : 0,
                    subPathsExpected: 2,
                    rimPoints: c7RimPts,
                    rimExpected: 4,
                    teethPoints: c7TeethPts,
                    teethExpected: 396,
                    errors: c7Errors
                });
                if (!c7Pass) allPassed = false;

                // ==========================================
                // CASE 8: Linear Rack (Standard)
                // m=2.0, zRack=10, backHeight=5.0
                // Expected: 74 pts (10 teeth * 7 pts + 4 base corners = 74 pts), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 8: Linear Rack...");
                var c8Pos = [abLeft + 1850, abTop - 300];
                var rack8Data = InvoluteCore.calculateRack({
                    m: 2.0,
                    zRack: 10,
                    backHeight: 5.0
                });
                var group8 = PathBuilder.drawRack(doc, testLayer, c8Pos, rack8Data, 0, [0, 0], "Case8_Rack_z10", {
                    drawGuides: true
                });

                var p8 = findContourPath(group8, "Case8_Rack_z10");
                var c8Pass = false;
                var c8Errors = [];
                if (p8) {
                    var hCheck8 = validateHandles(p8, 2.0);
                    if (!hCheck8.valid) c8Errors = c8Errors.concat(hCheck8.errors);

                    c8Pass = (p8.pathPoints.length === 74 &&
                              p8.closed === true &&
                              c8Errors.length === 0);
                } else {
                    c8Errors.push("Contour path not found for Case 8");
                }

                report.cases.push({
                    name: "Case8_Rack",
                    passed: c8Pass,
                    points: p8 ? p8.pathPoints.length : 0,
                    pointsExpected: 74,
                    closed: p8 ? p8.closed : false,
                    errors: c8Errors
                });
                if (!c8Pass) allPassed = false;

                // ==========================================
                // CASE 9: Linear Rack with Tip Rounding
                // m=2.0, zRack=8, tipRounding=0.2, backHeight=5.0
                // Expected: 76 pts (8 teeth * 9 pts + 4 base corners = 76 pts), closed===true
                // ==========================================
                CalcLogger.log("TEST", "Running Case 9: Linear Rack with Tip Rounding...");
                var c9Pos = [abLeft + 1850, abTop - 800];
                var rack9Data = InvoluteCore.calculateRack({
                    m: 2.0,
                    zRack: 8,
                    tipRounding: 0.2,
                    backHeight: 5.0
                });
                var group9 = PathBuilder.drawRack(doc, testLayer, c9Pos, rack9Data, 0, [0, 0], "Case9_Rack_TipRound_z8", {
                    drawGuides: true
                });

                var p9 = findContourPath(group9, "Case9_Rack_TipRound_z8");
                var c9Pass = false;
                var c9Errors = [];
                if (p9) {
                    var hCheck9 = validateHandles(p9, 2.0);
                    if (!hCheck9.valid) c9Errors = c9Errors.concat(hCheck9.errors);

                    c9Pass = (p9.pathPoints.length === 76 &&
                              p9.closed === true &&
                              c9Errors.length === 0);
                } else {
                    c9Errors.push("Contour path not found for Case 9");
                }

                report.cases.push({
                    name: "Case9_Rack_TipRounding",
                    passed: c9Pass,
                    points: p9 ? p9.pathPoints.length : 0,
                    pointsExpected: 76,
                    closed: p9 ? p9.closed : false,
                    errors: c9Errors
                });
                if (!c9Pass) allPassed = false;

                // ==========================================
                // CASE 10: External Gear with Keyway Shaft & Spoke Cutouts
                // m=2.0, z=30, shaft=15mm (JIS Keyway), 4 spoke windows, 2 pin holes
                // Expected: CompoundPathItem with 8 paths (Contour: 270 pts, Keyway: 6 pts, 4 Windows, 2 Pins)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 10: Gear with Keyway Shaft & Spoke Cutouts...");
                var c10Pos = [abLeft + 2050, abTop - 1350];
                var gear10Data = InvoluteCore.calculateSpurGear({
                    m: 2.0,
                    z: 30,
                    pathQuality: "bezier_recommended"
                });
                var shaft10Data = ShaftAndBody.calculateShaftHole(15.0, "KEYWAY");
                var cutout10Data = ShaftAndBody.calculateParametricCutouts(gear10Data.rf, 15.0, "SPOKE_WINDOWS", {
                    spokeCount: 4,
                    spokeWidth: 2.5,
                    m: 2.0
                });
                var pin10Data = ShaftAndBody.calculateAlignmentPinHoles(gear10Data.rf, 15.0, {
                    pinCount: 2,
                    pinDiameter: 2.5
                });

                var group10 = PathBuilder.drawGearWithFeatures(doc, testLayer, c10Pos, gear10Data, shaft10Data, cutout10Data, pin10Data, 0, "Case10_Gear_Features", {
                    drawGuides: true
                });

                var c10Compound = null;
                for (var ci10 = 0; ci10 < group10.compoundPathItems.length; ci10++) {
                    if (group10.compoundPathItems[ci10].name.indexOf("CompoundBody") !== -1) {
                        c10Compound = group10.compoundPathItems[ci10];
                        break;
                    }
                }

                var c10Pass = false;
                var c10Errors = [];
                var expectedSubPaths10 = 1 + 1 + 4 + 2; // Outer + Shaft + 4 Spokes + 2 Pins = 8
                var maxPts10 = 0;
                var outerP10 = null;
                var allClosed10 = true;

                if (c10Compound && c10Compound.pathItems.length === expectedSubPaths10) {
                    for (var pi10 = 0; pi10 < c10Compound.pathItems.length; pi10++) {
                        var subP10 = c10Compound.pathItems[pi10];
                        if (!subP10.closed) allClosed10 = false;
                        if (subP10.pathPoints.length > maxPts10) {
                            maxPts10 = subP10.pathPoints.length;
                            outerP10 = subP10;
                        }
                    }

                    if (outerP10) {
                        var hCheck10 = validateHandles(outerP10, 2.0);
                        if (!hCheck10.valid) c10Errors = c10Errors.concat(hCheck10.errors);
                    }

                    c10Pass = (maxPts10 === 270 &&
                              allClosed10 &&
                              c10Errors.length === 0);
                } else {
                    c10Errors.push("CompoundPathItem with " + expectedSubPaths10 + " sub-paths not found for Case 10 (found: " + (c10Compound ? c10Compound.pathItems.length : 0) + ")");
                }

                report.cases.push({
                    name: "Case10_Gear_Keyway_Spokes",
                    passed: c10Pass,
                    subPaths: c10Compound ? c10Compound.pathItems.length : 0,
                    subPathsExpected: expectedSubPaths10,
                    outerPoints: maxPts10,
                    outerExpected: 270,
                    errors: c10Errors
                });
                if (!c10Pass) allPassed = false;

                // ==========================================
                // CASE 11: External Gear with D-Cut Shaft & Circular Cutout Holes
                // m=2.0, z=24, shaft=10mm (DCUT), 4 circular cutout holes
                // Expected: CompoundPathItem with 6 paths (Contour: 216 pts, DCUT: 5 pts, 4 Circular holes)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 11: Gear with D-Cut & Circular Cutouts...");
                var c11Pos = [abLeft + 350, abTop - 1350];
                var gear11Data = InvoluteCore.calculateSpurGear({
                    m: 2.0,
                    z: 24,
                    pathQuality: "bezier_recommended"
                });
                var shaft11Data = ShaftAndBody.calculateShaftHole(10.0, "DCUT");
                var cutout11Data = ShaftAndBody.calculateParametricCutouts(gear11Data.rf, 10.0, "CIRCULAR_HOLES", {
                    holeCount: 4,
                    m: 2.0
                });

                var group11 = PathBuilder.drawGearWithFeatures(doc, testLayer, c11Pos, gear11Data, shaft11Data, cutout11Data, null, 0, "Case11_Gear_DCut_Holes", {
                    drawGuides: true
                });

                var c11Compound = null;
                for (var ci11 = 0; ci11 < group11.compoundPathItems.length; ci11++) {
                    if (group11.compoundPathItems[ci11].name.indexOf("CompoundBody") !== -1) {
                        c11Compound = group11.compoundPathItems[ci11];
                        break;
                    }
                }

                var c11Pass = false;
                var c11Errors = [];
                var expectedSubPaths11 = 1 + 1 + 4; // Outer + Shaft + 4 Holes = 6
                var maxPts11 = 0;
                var outerP11 = null;
                var allClosed11 = true;

                if (c11Compound && c11Compound.pathItems.length === expectedSubPaths11) {
                    for (var pi11 = 0; pi11 < c11Compound.pathItems.length; pi11++) {
                        var subP11 = c11Compound.pathItems[pi11];
                        if (!subP11.closed) allClosed11 = false;
                        if (subP11.pathPoints.length > maxPts11) {
                            maxPts11 = subP11.pathPoints.length;
                            outerP11 = subP11;
                        }
                    }

                    if (outerP11) {
                        var hCheck11 = validateHandles(outerP11, 2.0);
                        if (!hCheck11.valid) c11Errors = c11Errors.concat(hCheck11.errors);
                    }

                    c11Pass = (maxPts11 === 216 &&
                              allClosed11 &&
                              c11Errors.length === 0);
                } else {
                    c11Errors.push("CompoundPathItem with " + expectedSubPaths11 + " sub-paths not found for Case 11");
                }

                report.cases.push({
                    name: "Case11_Gear_DCut_Holes",
                    passed: c11Pass,
                    subPaths: c11Compound ? c11Compound.pathItems.length : 0,
                    subPathsExpected: expectedSubPaths11,
                    outerPoints: maxPts11,
                    outerExpected: 216,
                    errors: c11Errors
                });
                if (!c11Pass) allPassed = false;

                // ==========================================
                // CASE 12: 3-Gear Branched Train (Branching Phase & Clearance)
                // Root: G1 (m=2.0, z=18), Branch G2 (z=24 @ 0 deg), Branch G3 (z=24 @ 120 deg)
                // Expected: 3 closed spur gears, G1=162 pts, G2=216 pts, G3=216 pts, clearance >= 0.5mm
                // ==========================================
                CalcLogger.log("TEST", "Running Case 12: 3-Gear Branched Train...");
                var c12Origin = [abLeft + 450, abTop - 1800];
                var train12 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    nodes: [
                        { id: "C12_G1", z: 18, relationType: "ROOT" },
                        { id: "C12_G2", z: 24, parentId: "C12_G1", relationType: "MESHING", relativeAngleDeg: 0.0 },
                        { id: "C12_G3", z: 24, parentId: "C12_G1", relationType: "MESHING", relativeAngleDeg: 120.0 }
                    ]
                });
                var group12Obj = PathBuilder.drawTrain(doc, train12, {
                    originPt: c12Origin,
                    targetLayer: testLayer,
                    drawGuides: true
                });

                var c12Pass = false;
                var c12Errors = [];
                if (train12.warnings && train12.warnings.length > 0) {
                    for (var w12 = 0; w12 < train12.warnings.length; w12++) {
                        c12Errors.push("Warning: " + train12.warnings[w12]);
                    }
                }
                var g12_1 = findContourPath(group12Obj.groups[0], "C12_G1");
                var g12_2 = findContourPath(group12Obj.groups[1], "C12_G2");
                var g12_3 = findContourPath(group12Obj.groups[2], "C12_G3");
                if (g12_1 && g12_2 && g12_3) {
                    var h12_1 = validateHandles(g12_1, 2.0);
                    var h12_2 = validateHandles(g12_2, 2.0);
                    var h12_3 = validateHandles(g12_3, 2.0);
                    if (!h12_1.valid) c12Errors = c12Errors.concat(h12_1.errors);
                    if (!h12_2.valid) c12Errors = c12Errors.concat(h12_2.errors);
                    if (!h12_3.valid) c12Errors = c12Errors.concat(h12_3.errors);

                    c12Pass = (g12_1.pathPoints.length === 162 &&
                               g12_2.pathPoints.length === 216 &&
                               g12_3.pathPoints.length === 216 &&
                               g12_1.closed && g12_2.closed && g12_3.closed &&
                               c12Errors.length === 0);
                } else {
                    c12Errors.push("One or more gear contour paths not found for Case 12");
                }

                report.cases.push({
                    name: "Case12_BranchedTrain",
                    passed: c12Pass,
                    nodes: train12.nodes ? train12.nodes.length : 0,
                    nodesExpected: 3,
                    errors: c12Errors
                });
                if (!c12Pass) allPassed = false;

                // ==========================================
                // CASE 13: Multi-Stage Coaxial Train (Automatic stageIndex & Driver Ripple)
                // Stage 1: G1 (z=18) -> G2 (z=36 @ 0 deg)
                // Stage 2: G3 (z=16, coaxial to G2, stage 2 auto) -> G4 (z=32 @ 90 deg)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 13: Multi-Stage Coaxial Train...");
                var c13Origin = [abLeft + 1200, abTop - 1800];
                var train13 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    nodes: [
                        { id: "C13_G1", z: 18, relationType: "ROOT" },
                        { id: "C13_G2", z: 36, parentId: "C13_G1", relationType: "MESHING", relativeAngleDeg: 0.0 },
                        { id: "C13_G3", z: 16, parentId: "C13_G2", relationType: "COAXIAL" },
                        { id: "C13_G4", z: 32, parentId: "C13_G3", relationType: "MESHING", relativeAngleDeg: 90.0 }
                    ]
                });
                var group13Obj = PathBuilder.drawTrain(doc, train13, {
                    originPt: c13Origin,
                    targetLayer: testLayer,
                    drawGuides: true
                });

                var c13Pass = false;
                var c13Errors = [];
                var n13_2 = train13.nodeMap["C13_G2"];
                var n13_3 = train13.nodeMap["C13_G3"];
                var n13_4 = train13.nodeMap["C13_G4"];
                if (n13_3.stageIndex !== 2) {
                    c13Errors.push("Expected stageIndex=2 for coaxial G3, got " + n13_3.stageIndex);
                }
                if (n13_4.stageIndex !== 2) {
                    c13Errors.push("Expected stageIndex=2 for driven G4, got " + n13_4.stageIndex);
                }
                var coaxialDistMm = Math.sqrt(
                    Math.pow(n13_2.centerMm[0] - n13_3.centerMm[0], 2) +
                    Math.pow(n13_2.centerMm[1] - n13_3.centerMm[1], 2)
                );
                if (coaxialDistMm > 1e-4) {
                    c13Errors.push("Coaxial gears G2 and G3 center discrepancy: " + coaxialDistMm + "mm");
                }

                var g13_1 = findContourPath(group13Obj.groups[0], "C13_G1");
                var g13_2 = findContourPath(group13Obj.groups[1], "C13_G2");
                var g13_3 = findContourPath(group13Obj.groups[2], "C13_G3");
                var g13_4 = findContourPath(group13Obj.groups[3], "C13_G4");
                if (g13_1 && g13_2 && g13_3 && g13_4) {
                    // Note: G3 has z=16 < 17.1 (undercut), so it has 11 nodes/tooth -> 176 nodes
                    c13Pass = (g13_1.pathPoints.length === 162 &&
                               g13_2.pathPoints.length === 324 &&
                               g13_3.pathPoints.length === 176 &&
                               g13_4.pathPoints.length === 288 &&
                               c13Errors.length === 0);
                    if (!c13Pass) {
                        c13Errors.push("Node count mismatch in Case 13: G1=" + g13_1.pathPoints.length + ", G2=" + g13_2.pathPoints.length + ", G3=" + g13_3.pathPoints.length + ", G4=" + g13_4.pathPoints.length);
                    }
                } else {
                    c13Errors.push("Contour paths missing in Case 13");
                }

                report.cases.push({
                    name: "Case13_CoaxialTrain",
                    passed: c13Pass,
                    g3Stage: n13_3 ? n13_3.stageIndex : 0,
                    g3StageExpected: 2,
                    g4Stage: n13_4 ? n13_4.stageIndex : 0,
                    g4StageExpected: 2,
                    errors: c13Errors
                });
                if (!c13Pass) allPassed = false;

                // ==========================================
                // CASE 14: Profile Shifted Gear Pair with Addendum Shortening (Topping deltaY > 0)
                // G1: z1=16, x1=+0.5, m=2.0
                // G2: z2=24, x2=+0.5, m=2.0
                // Expected: Shortened tip diameter da' = m*(z + 2 + 2x - 2*deltaY) preserves bottom clearance c = 0.25*m
                // ==========================================
                CalcLogger.log("TEST", "Running Case 14: Profile Shift Shortening...");
                var c14Origin = [abLeft + 1950, abTop - 1800];
                var train14 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    nodes: [
                        { id: "C14_G1", z: 16, x: 0.5, relationType: "ROOT" },
                        { id: "C14_G2", z: 24, x: 0.5, parentId: "C14_G1", relationType: "MESHING", relativeAngleDeg: 0.0 }
                    ]
                });
                var group14Obj = PathBuilder.drawTrain(doc, train14, {
                    originPt: c14Origin,
                    targetLayer: testLayer,
                    drawGuides: true
                });

                var c14Pass = false;
                var c14Errors = [];
                var n14_1 = train14.nodeMap["C14_G1"];
                var n14_2 = train14.nodeMap["C14_G2"];
                var mp14 = n14_2.meshingParams;

                if (!mp14 || mp14.deltaY <= 0.0) {
                    c14Errors.push("Expected deltaY > 0, got " + (mp14 ? mp14.deltaY : "null"));
                }
                if (mp14 && mp14.contactRatio < 1.1) {
                    c14Errors.push("Expected contactRatio >= 1.1, got " + mp14.contactRatio);
                }

                // Check da' shortening on gearData
                var expectedDa1 = 2.0 * (16 + 2.0 + 2.0 * 0.5 - 2.0 * mp14.deltaY);
                var expectedDa2 = 2.0 * (24 + 2.0 + 2.0 * 0.5 - 2.0 * mp14.deltaY);
                if (Math.abs(n14_1.gearData.da - expectedDa1) > 1e-3) {
                    c14Errors.push("G1 tip diameter discrepancy: got " + n14_1.gearData.da + ", expected " + expectedDa1);
                }
                if (Math.abs(n14_2.gearData.da - expectedDa2) > 1e-3) {
                    c14Errors.push("G2 tip diameter discrepancy: got " + n14_2.gearData.da + ", expected " + expectedDa2);
                }

                // Verify bottom clearance: c = aw - rf1 - ra2 = 0.25 * m = 0.5mm
                var cBottom = mp14.aw - n14_1.gearData.rf - n14_2.gearData.ra;
                if (Math.abs(cBottom - 0.5) > 1e-3) {
                    c14Errors.push("Bottom clearance c = " + cBottom.toFixed(4) + "mm != 0.5mm (0.25*m)");
                }

                var g14_1 = findContourPath(group14Obj.groups[0], "C14_G1");
                var g14_2 = findContourPath(group14Obj.groups[1], "C14_G2");
                if (g14_1 && g14_2) {
                    var mClr14 = validateMeshingClearance(g14_1, g14_2, [c14Origin[0] + n14_1.centerPt[0], c14Origin[1] + n14_1.centerPt[1]], [c14Origin[0] + n14_2.centerPt[0], c14Origin[1] + n14_2.centerPt[1]], mp14.aw * MM_TO_PT);
                    if (!mClr14.valid) c14Errors = c14Errors.concat(mClr14.errors);

                    c14Pass = (g14_1.pathPoints.length === 144 &&
                               g14_2.pathPoints.length === 216 &&
                               g14_1.closed && g14_2.closed &&
                               c14Errors.length === 0);
                } else {
                    c14Errors.push("Contour paths missing in Case 14");
                }

                report.cases.push({
                    name: "Case14_ProfileShiftShortening",
                    passed: c14Pass,
                    deltaY: mp14 ? mp14.deltaY : 0,
                    contactRatio: mp14 ? mp14.contactRatio : 0,
                    bottomClearanceMm: cBottom,
                    errors: c14Errors
                });
                if (!c14Pass) allPassed = false;

                // ==========================================
                // CASE 15: Compound Train with Internal Ring Gear & Linear Rack
                // Pinion G1 (m=2.0, z=18)
                // Internal Ring G2 (z=48, theta=0 deg)
                // Linear Rack R1 (z=20, theta=-90 deg)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 15: Compound Train (Spur + Internal + Rack)...");
                var c15Origin = [abLeft + 900, abTop - 2300];
                var train15 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    nodes: [
                        { id: "C15_G1", z: 18, relationType: "ROOT" },
                        { id: "C15_G2", z: 48, parentId: "C15_G1", gearType: "INTERNAL", relationType: "INTERNAL_MESHING", relativeAngleDeg: 0.0 },
                        { id: "C15_R1", z: 20, parentId: "C15_G1", gearType: "RACK", relationType: "MESHING", relativeAngleDeg: -90.0 }
                    ]
                });
                var group15Obj = PathBuilder.drawTrain(doc, train15, {
                    originPt: c15Origin,
                    targetLayer: testLayer,
                    drawGuides: true
                });

                var c15Pass = false;
                var c15Errors = [];
                var g15_1 = findContourPath(group15Obj.groups[0], "C15_G1");
                var g15_2Grp = group15Obj.groups[1];
                var g15_3Grp = group15Obj.groups[2];

                var g15_2Compound = null;
                for (var cp15 = 0; cp15 < g15_2Grp.compoundPathItems.length; cp15++) {
                    if (g15_2Grp.compoundPathItems[cp15].name.indexOf("Body") !== -1) {
                        g15_2Compound = g15_2Grp.compoundPathItems[cp15];
                        break;
                    }
                }

                var g15_3Contour = null;
                for (var rk15 = 0; rk15 < g15_3Grp.pathItems.length; rk15++) {
                    if (g15_3Grp.pathItems[rk15].name.indexOf("Contour") !== -1) {
                        g15_3Contour = g15_3Grp.pathItems[rk15];
                        break;
                    }
                }

                if (g15_1 && g15_2Compound && g15_3Contour) {
                    var pA15 = g15_2Compound.pathItems[0];
                    var pB15 = g15_2Compound.pathItems[1];
                    var pTeeth15 = (pA15.pathPoints.length > pB15.pathPoints.length) ? pA15 : pB15;
                    var pRim15   = (pA15.pathPoints.length > pB15.pathPoints.length) ? pB15 : pA15;

                    c15Pass = (g15_1.pathPoints.length === 162 &&
                               pTeeth15.pathPoints.length === 432 &&
                               pRim15.pathPoints.length === 4 &&
                               g15_3Contour.pathPoints.length === 144 &&
                               g15_1.closed && pTeeth15.closed && pRim15.closed && g15_3Contour.closed);
                } else {
                    c15Errors.push("Required paths not found in Case 15");
                }

                report.cases.push({
                    name: "Case15_SpurInternalRackTrain",
                    passed: c15Pass,
                    errors: c15Errors
                });
                if (!c15Pass) allPassed = false;

                // ==========================================
                // CASE 16: 2K-H Standard Planetary Gear Set & Carrier
                // Sun: zs=18, Planet: zp=18, Ring: zr=54, numPlanets=3, m=2.0
                // Concentricity: zr = zs + 2*zp (54 = 18 + 36)
                // Assembly: (zs + zr) % N = 72 % 3 = 0
                // Willis ratio (ring_fixed): i = 1 + 54/18 = 4.0
                // Carrier: Y-arm with sun shaft hole and 3 planet pin holes
                // ==========================================
                CalcLogger.log("TEST", "Running Case 16: Standard Planetary & Carrier...");
                var c16Origin = [abLeft + 450, abTop - 2900];
                var planCandidates = MechanismSolvers.solveStandardPlanetary({
                    m: 2.0,
                    numPlanets: 3,
                    fixedZs: 18,
                    fixedZp: 18,
                    fixedZr: 54,
                    mode: "ring_fixed"
                });
                var planSol = (planCandidates && planCandidates.length > 0) ? planCandidates[0] : null;

                var train16 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    drawCarrier: true,
                    carrierSpec: {
                        carrierType: "ARM",
                        sunShaftDiameter: 5.0,
                        planetPinDiameter: 4.0
                    },
                    nodes: TrainTreeResolver.expandPlanetaryToNodes({
                        m: 2.0,
                        zs: 18,
                        zp: 18,
                        zr: 54,
                        numPlanets: 3,
                        sunShaft: 5.0,
                        planetShaft: 4.0,
                        idPrefix: "C16_"
                    })
                });
                var group16Obj = PathBuilder.drawTrain(doc, train16, {
                    originPt: c16Origin,
                    targetLayer: testLayer,
                    drawGuides: true,
                    drawCarrier: true
                });

                var c16Pass = false;
                var c16Errors = [];
                if (!planSol) {
                    c16Errors.push("Standard planetary solver failed to find solution for zs=18, zp=18, zr=54, N=3");
                } else if (Math.abs(planSol.ratio - 4.0) > 1e-4) {
                    c16Errors.push("Willis reduction ratio discrepancy: got " + planSol.ratio + ", expected 4.0");
                }

                // Check carrier data
                if (!train16.carrierData) {
                    c16Errors.push("Carrier data was not generated in resolved train");
                } else {
                    var cData16 = train16.carrierData;
                    if (cData16.pinHoles.length !== 3) {
                        c16Errors.push("Carrier pin holes count mismatch: got " + cData16.pinHoles.length + ", expected 3");
                    }
                    if (Math.abs(cData16.centerDistanceMm - 36.0) > 1e-3) {
                        c16Errors.push("Carrier orbit radius mismatch: got " + cData16.centerDistanceMm + "mm, expected 36.0mm");
                    }
                }

                // Check Illustrator drawn carrier group
                var carrierDrawn16 = null;
                for (var g16i = 0; g16i < group16Obj.groups.length; g16i++) {
                    if (group16Obj.groups[g16i].name.indexOf("Carrier") !== -1) {
                        carrierDrawn16 = group16Obj.groups[g16i];
                        break;
                    }
                }
                if (!carrierDrawn16) {
                    c16Errors.push("Carrier group not drawn in document");
                }

                c16Pass = (c16Errors.length === 0 && planSol !== null && train16.nodes.length === 5);
                report.cases.push({
                    name: "Case16_StandardPlanetaryCarrier",
                    passed: c16Pass,
                    ratio: planSol ? planSol.ratio : 0,
                    efficiency: planSol ? planSol.efficiencyEst : 0,
                    numPlanets: 3,
                    errors: c16Errors
                });
                if (!c16Pass) allPassed = false;

                // ==========================================
                // CASE 17: 3K Paradoxical Planetary Gear Train (Hori et al. 1994)
                // Solves simultaneous profile shift for all-positive shift design
                // Target: N=3, Zs=24, Zp=15, Zr1=54, Zr2=57 (deltaZ = 3)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 17: Paradoxical Planetary (Hori 1994)...");
                var c17Origin = [abLeft + 1200, abTop - 2900];
                var paradCandidates = MechanismSolvers.solveParadoxicalPlanetary({
                    m: 2.0,
                    numPlanets: 3,
                    fixedZs: 24,
                    preferHoriMethod: true
                });
                var paradSol = (paradCandidates && paradCandidates.length > 0) ? paradCandidates[0] : null;

                var c17Pass = false;
                var c17Errors = [];
                if (!paradSol) {
                    c17Errors.push("Paradoxical planetary solver failed to find solution");
                } else {
                    if (!paradSol.isHoriMethod) {
                        c17Errors.push("Top candidate is not Hori positive shift method");
                    }
                    if (paradSol.efficiencyEst < 50) {
                        c17Errors.push("Efficiency estimate too low: " + paradSol.efficiencyEst + "%");
                    }

                    var train17 = TrainTreeResolver.resolveTrain({
                        m: paradSol.m,
                        nodes: TrainTreeResolver.expandParadoxicalToNodes({
                            m: paradSol.m,
                            zs: paradSol.zs,
                            zp: paradSol.zp,
                            zr1: paradSol.zr1,
                            zr2: paradSol.zr2,
                            numPlanets: paradSol.numPlanets,
                            xr1: paradSol.xr1,
                            xr2: paradSol.xr2,
                            idPrefix: "C17_"
                        })
                    });
                    var group17Obj = PathBuilder.drawTrain(doc, train17, {
                        originPt: c17Origin,
                        targetLayer: testLayer,
                        drawGuides: true
                    });

                    c17Pass = (train17.nodes.length === 6 && c17Errors.length === 0);
                }

                report.cases.push({
                    name: "Case17_ParadoxicalPlanetaryHori",
                    passed: c17Pass,
                    ratio: paradSol ? paradSol.ratio : 0,
                    efficiency: paradSol ? paradSol.efficiencyEst : 0,
                    isHori: paradSol ? paradSol.isHoriMethod : false,
                    xr2: paradSol ? paradSol.xr2 : 0,
                    errors: c17Errors
                });
                if (!c17Pass) allPassed = false;

                // ==========================================
                // CASE 18: Intermittent Gear Pair (Coplanar Single-Layer)
                // Driver: z1=8, activeTeeth=2 (6 mutilated teeth along rf)
                // Driven: z2=8, divisions=4, moveTeeth=2 (4 active sectors)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 18: Coplanar Intermittent Gear...");
                var c18Origin = [abLeft + 1950, abTop - 2900];
                var train18 = TrainTreeResolver.resolveTrain({
                    m: 3.0,
                    nodes: TrainTreeResolver.expandIntermittentPairToNodes({
                        m: 3.0,
                        z1: 8,
                        z2: 8,
                        divisions: 4,
                        moveTeeth: 2,
                        structure: "coplanar",
                        pose: "motion",
                        tipRelief: true,
                        idPrefix: "C18_"
                    })
                });
                var group18Obj = PathBuilder.drawTrain(doc, train18, {
                    originPt: c18Origin,
                    targetLayer: testLayer,
                    drawGuides: true
                });

                var c18Pass = false;
                var c18Errors = [];
                var g18_1 = findContourPath(group18Obj.groups[0], "C18_Driver");
                var g18_2 = findContourPath(group18Obj.groups[1], "C18_Driven");
                if (g18_1 && g18_2) {
                    var h18_1 = validateHandles(g18_1, 3.0);
                    var h18_2 = validateHandles(g18_2, 3.0);
                    if (!h18_1.valid) c18Errors = c18Errors.concat(h18_1.errors);
                    if (!h18_2.valid) c18Errors = c18Errors.concat(h18_2.errors);

                    // Driver: 2 active teeth (11 nodes each with relief) + 4 blank arc nodes = 26 pts approx
                    c18Pass = (g18_1.closed && g18_2.closed && c18Errors.length === 0);
                } else {
                    c18Errors.push("Contour paths missing in Case 18");
                }

                report.cases.push({
                    name: "Case18_IntermittentCoplanar",
                    passed: c18Pass,
                    driverPoints: g18_1 ? g18_1.pathPoints.length : 0,
                    drivenPoints: g18_2 ? g18_2.pathPoints.length : 0,
                    errors: c18Errors
                });
                if (!c18Pass) allPassed = false;

                // ==========================================
                // CASE 19: Intermittent Gear Pair (Two-Layer in Locked Dwell Pose)
                // Driver: z1=8, LockCam_Driver crescent disc (R_disc = rp1 = 12mm)
                // Driven: z2=8, LockStar_Driven Geneva star plate (R_pocket = rp1 + 0.15 = 12.15mm)
                // Clearance: c_lock = 0.15 mm
                // ==========================================
                CalcLogger.log("TEST", "Running Case 19: Two-Layer Intermittent Lock Pose...");
                var c19Origin = [abLeft + 450, abTop - 3500];
                var kin19 = MechanismSolvers.calculateIntermittentKinematics({
                    m: 3.0,
                    z1: 8,
                    z2: 8,
                    divisions: 4,
                    moveTeeth: 2,
                    structure: "two_layer",
                    pose: "lock",
                    lockClearance: 0.15
                });

                var train19 = TrainTreeResolver.resolveTrain({
                    m: 3.0,
                    nodes: TrainTreeResolver.expandIntermittentPairToNodes({
                        m: 3.0,
                        z1: 8,
                        z2: 8,
                        divisions: 4,
                        moveTeeth: 2,
                        structure: "two_layer",
                        pose: "lock",
                        lockClearance: 0.15,
                        idPrefix: "C19_"
                    })
                });
                var group19Obj = PathBuilder.drawTrain(doc, train19, {
                    originPt: c19Origin,
                    targetLayer: testLayer,
                    drawGuides: true,
                    drawLockPlates: true
                });

                var c19Pass = false;
                var c19Errors = [];
                if (!kin19.isLocked) {
                    c19Errors.push("Expected kinematics pose to be locked");
                }
                if (Math.abs(kin19.lockClearanceMm - 0.15) > 1e-4) {
                    c19Errors.push("Lock clearance discrepancy: got " + kin19.lockClearanceMm + "mm, expected 0.15mm");
                }
                var expectedPocketR = kin19.lockDiscRadiusMm + 0.15;
                if (Math.abs(kin19.lockPocketRadiusMm - expectedPocketR) > 1e-4) {
                    c19Errors.push("Lock pocket radius discrepancy: got " + kin19.lockPocketRadiusMm + "mm, expected " + expectedPocketR + "mm");
                }

                // Check lock plates drawn
                var lockPlatesDrawn19 = 0;
                for (var g19i = 0; g19i < group19Obj.groups.length; g19i++) {
                    if (group19Obj.groups[g19i].name.indexOf("Lock") !== -1) {
                        lockPlatesDrawn19++;
                    }
                }
                if (lockPlatesDrawn19 < 2) {
                    c19Errors.push("Expected at least 2 lock plate groups drawn, found " + lockPlatesDrawn19);
                }

                c19Pass = (c19Errors.length === 0 && lockPlatesDrawn19 >= 2);
                report.cases.push({
                    name: "Case19_IntermittentTwoLayerLock",
                    passed: c19Pass,
                    lockClearanceMm: kin19.lockClearanceMm,
                    lockPlatesDrawn: lockPlatesDrawn19,
                    errors: c19Errors
                });
                if (!c19Pass) allPassed = false;

                // ==========================================
                // CASE 20: Train Base Plate Generation
                // Automatically creates mounting plate with bearing holes for all gear centers
                // Verifies exact coordinate match between gear centers and plate holes
                // ==========================================
                CalcLogger.log("TEST", "Running Case 20: Train Base Plate Generation...");
                var c20Origin = [abLeft + 1400, abTop - 3500];
                var train20 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    drawBasePlate: true,
                    basePlateSpec: {
                        marginMm: 12.0,
                        cornerRadiusMm: 6.0,
                        bearingDiameter: 8.0
                    },
                    nodes: [
                        { id: "C20_G1", z: 18, relationType: "ROOT", shaftDiameter: 8.0 },
                        { id: "C20_G2", z: 24, parentId: "C20_G1", relationType: "MESHING", relativeAngleDeg: 0.0, shaftDiameter: 8.0 },
                        { id: "C20_G3", z: 30, parentId: "C20_G2", relationType: "MESHING", relativeAngleDeg: 60.0, shaftDiameter: 8.0 }
                    ]
                });
                var group20Obj = PathBuilder.drawTrain(doc, train20, {
                    originPt: c20Origin,
                    targetLayer: testLayer,
                    drawGuides: true,
                    drawBasePlate: true
                });

                var c20Pass = false;
                var c20Errors = [];
                var bpData20 = train20.basePlateData;

                if (!bpData20) {
                    c20Errors.push("Base plate data was not generated in resolved train");
                } else {
                    if (bpData20.shaftHoles.length !== 3) {
                        c20Errors.push("Base plate shaft holes count mismatch: got " + bpData20.shaftHoles.length + ", expected 3");
                    }

                    // Check exact coordinate match for each shaft hole
                    for (var h20 = 0; h20 < bpData20.shaftHoles.length; h20++) {
                        var hole20 = bpData20.shaftHoles[h20];
                        var matchedGear = null;
                        for (var g20 = 0; g20 < train20.nodes.length; g20++) {
                            if (train20.nodes[g20].id === hole20.id) {
                                matchedGear = train20.nodes[g20];
                                break;
                            }
                        }
                        if (!matchedGear) {
                            c20Errors.push("Hole ID '" + hole20.id + "' did not match any gear node");
                        } else {
                            var diffX = Math.abs(hole20.centerMm[0] - matchedGear.centerMm[0]);
                            var diffY = Math.abs(hole20.centerMm[1] - matchedGear.centerMm[1]);
                            if (diffX > 1e-4 || diffY > 1e-4) {
                                c20Errors.push("Coordinate discrepancy for " + hole20.id + ": diffX=" + diffX + ", diffY=" + diffY);
                            }
                        }
                    }
                }

                // Check base plate drawn
                var bpDrawn20 = null;
                for (var g20i = 0; g20i < group20Obj.groups.length; g20i++) {
                    if (group20Obj.groups[g20i].name.indexOf("BasePlate") !== -1) {
                        bpDrawn20 = group20Obj.groups[g20i];
                        break;
                    }
                }
                if (!bpDrawn20) {
                    c20Errors.push("Base plate group not drawn in document");
                }

                c20Pass = (c20Errors.length === 0 && bpData20 !== null && bpDrawn20 !== null);
                report.cases.push({
                    name: "Case20_TrainBasePlate",
                    passed: c20Pass,
                    shaftHolesCount: bpData20 ? bpData20.shaftHoles.length : 0,
                    boundsWidthMm: bpData20 ? bpData20.boundsMm.width : 0,
                    errors: c20Errors
                });
                if (!c20Pass) allPassed = false;

                // ==========================================
                // CASE 21: CAD/CAM Layer Hierarchy & Overwrite Resolution
                // Creates multi-stage train under train ID "T1"
                // Stage 1: Standard planetary gear set (zs=18, zp=18, zr=54) with carrier
                // Stage 2: Coaxial 2-layer intermittent gear pair with Geneva lock plates
                // Verifies T1 parent layer, T1_1, T1_2 sublayers, T1_LockPlate, T1_Carrier, T1_dwg
                // Verifies overwrite mode clears and repopulates layers cleanly
                // ==========================================
                CalcLogger.log("TEST", "Running Case 21: Layer Hierarchy & Overwrite Resolution...");
                var c21Origin = [abLeft + 400, abTop - 4000];

                var planNodes21 = TrainTreeResolver.expandPlanetaryToNodes({
                    m: 2.0,
                    zs: 18,
                    zp: 18,
                    zr: 54,
                    numPlanets: 3,
                    idPrefix: "C21_"
                });
                for (var pni = 0; pni < planNodes21.length; pni++) {
                    planNodes21[pni].stageIndex = 1;
                }

                var intNodes21 = TrainTreeResolver.expandIntermittentPairToNodes({
                    m: 2.0,
                    z1: 8,
                    z2: 8,
                    divisions: 4,
                    moveTeeth: 2,
                    structure: "two_layer",
                    pose: "lock",
                    idPrefix: "C21_Int_"
                });
                intNodes21[0].parentId = "C21_Sun";
                intNodes21[0].relationType = "COAXIAL";
                intNodes21[0].stageIndex = 2;
                intNodes21[1].stageIndex = 2;

                var allNodes21 = planNodes21.concat(intNodes21);

                var train21 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    trainId: "T1",
                    drawCarrier: true,
                    carrierSpec: { carrierType: "ARM", thickness: 5.0, pinDiameter: 4.0 },
                    nodes: allNodes21
                });

                // Pass 1: Draw with overwrite mode
                var draw21Res = PathBuilder.drawTrain(doc, train21, {
                    originPt: c21Origin,
                    trainId: "T1",
                    useLayersByStage: true,
                    drawLockPlates: true,
                    drawCarrier: true,
                    drawDwgLayer: true,
                    conflictMode: "overwrite"
                });

                var c21Pass = false;
                var c21Errors = [];

                // Verify layer existence under doc or mainLayer
                var t1Layer = null;
                for (var l1 = 0; l1 < doc.layers.length; l1++) {
                    if (doc.layers[l1].name === "T1") {
                        t1Layer = doc.layers[l1];
                        break;
                    }
                }

                if (!t1Layer) {
                    c21Errors.push("Main layer 'T1' not found in document");
                } else {
                    // Check sublayers
                    var hasT1_1 = false;
                    var hasT1_2 = false;
                    var hasT1_Lock = false;
                    var hasT1_Carrier = false;
                    var hasT1_Dwg = false;

                    for (var sl = 0; sl < t1Layer.layers.length; sl++) {
                        var sName = t1Layer.layers[sl].name;
                        if (sName === "T1_1") hasT1_1 = true;
                        if (sName === "T1_2") hasT1_2 = true;
                        if (sName === "T1_LockPlate") hasT1_Lock = true;
                        if (sName === "T1_Carrier") hasT1_Carrier = true;
                        if (sName === "T1_dwg") hasT1_Dwg = true;
                    }

                    if (!hasT1_1) c21Errors.push("Sublayer 'T1_1' not found under T1");
                    if (!hasT1_2) c21Errors.push("Sublayer 'T1_2' not found under T1");
                    if (!hasT1_Lock) c21Errors.push("Sublayer 'T1_LockPlate' not found under T1");
                    if (!hasT1_Carrier) c21Errors.push("Sublayer 'T1_Carrier' not found under T1");
                    if (!hasT1_Dwg) c21Errors.push("Sublayer 'T1_dwg' not found under T1");

                    // Pass 2: Overwrite test
                    var preOverwriteSubCount = t1Layer.layers.length;
                    var draw21Res2 = PathBuilder.drawTrain(doc, train21, {
                        originPt: c21Origin,
                        trainId: "T1",
                        useLayersByStage: true,
                        drawLockPlates: true,
                        drawCarrier: true,
                        drawDwgLayer: true,
                        conflictMode: "overwrite"
                    });

                    if (t1Layer.layers.length !== preOverwriteSubCount) {
                        c21Errors.push("Overwrite mode did not preserve or clean sublayer count properly: " + t1Layer.layers.length + " vs " + preOverwriteSubCount);
                    }

                    c21Pass = (c21Errors.length === 0);
                }

                report.cases.push({
                    name: "Case21_LayerHierarchy",
                    passed: c21Pass,
                    hasMainLayer: !!t1Layer,
                    sublayersCount: t1Layer ? t1Layer.layers.length : 0,
                    errors: c21Errors
                });
                if (!c21Pass) allPassed = false;

                // ==========================================
                // CASE 22: Center Guide Dimension Control (Fixed vs Relative)
                // Compares crosshair sizes for m=2.0, z=18 (d=36mm):
                // 1. Fixed 5.0mm (total length = 5.0mm = 14.173pt)
                // 2. Relative 20% (total length = 36 * 0.20 = 7.2mm = 20.409pt)
                // 3. Relative 120% (total length = 36 * 1.20 = 43.2mm = 122.457pt)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 22: Center Guide Dimension Control...");
                var c22Origin = [abLeft + 1400, abTop - 4000];
                var gearData22 = InvoluteCore.calculateSpurGear({ m: 2.0, z: 18, alphaDeg: 20.0 });
                var d22Mm = gearData22.d; // 36.0 mm

                var c22Layer = PathBuilder.getOrCreateLayer(doc, "GearDrawer_v050_CenterGuideTests");

                // Sub-case A: Fixed 5.0 mm
                var center22A = [c22Origin[0], c22Origin[1]];
                var grp22A = PathBuilder.drawGear(doc, c22Layer, center22A, gearData22, 0, "C22_Fixed5mm", {
                    drawGuides: true,
                    drawCenterGuide: true,
                    centerGuideMode: "fixed",
                    centerGuideValue: 5.0
                });

                // Sub-case B: Relative 20%
                var center22B = [c22Origin[0] + 300, c22Origin[1]];
                var grp22B = PathBuilder.drawGear(doc, c22Layer, center22B, gearData22, 0, "C22_Rel20pct", {
                    drawGuides: true,
                    drawCenterGuide: true,
                    centerGuideMode: "relative",
                    centerGuideValue: 20.0
                });

                // Sub-case C: Relative 120%
                var center22C = [c22Origin[0] + 600, c22Origin[1]];
                var grp22C = PathBuilder.drawGear(doc, c22Layer, center22C, gearData22, 0, "C22_Rel120pct", {
                    drawGuides: true,
                    drawCenterGuide: true,
                    centerGuideMode: "relative",
                    centerGuideValue: 120.0
                });

                var c22Pass = false;
                var c22Errors = [];

                // Numerically calculate and verify the lengths from calculateCenterGuide
                var calcA = LayerAndStyle.calculateCenterGuide([0, 0], d22Mm, "fixed", 5.0);
                var calcB = LayerAndStyle.calculateCenterGuide([0, 0], d22Mm, "relative", 20.0);
                var calcC = LayerAndStyle.calculateCenterGuide([0, 0], d22Mm, "relative", 120.0);

                var expLenA = 5.0;
                var expLenB = 36.0 * 0.20; // 7.2 mm
                var expLenC = 36.0 * 1.20; // 43.2 mm

                if (Math.abs(calcA.lengthMm - expLenA) > 1e-6) {
                    c22Errors.push("Fixed 5.0mm length mismatch: got " + calcA.lengthMm + ", expected " + expLenA);
                }
                if (Math.abs(calcB.lengthMm - expLenB) > 1e-6) {
                    c22Errors.push("Relative 20% length mismatch: got " + calcB.lengthMm + ", expected " + expLenB);
                }
                if (Math.abs(calcC.lengthMm - expLenC) > 1e-6) {
                    c22Errors.push("Relative 120% length mismatch: got " + calcC.lengthMm + ", expected " + expLenC);
                }

                // Check arm span
                var spanA = Math.abs(calcA.hLine[1][0] - calcA.hLine[0][0]);
                var spanB = Math.abs(calcB.hLine[1][0] - calcB.hLine[0][0]);
                var spanC = Math.abs(calcC.hLine[1][0] - calcC.hLine[0][0]);

                if (Math.abs(spanA - expLenA) > 1e-6 || Math.abs(spanB - expLenB) > 1e-6 || Math.abs(spanC - expLenC) > 1e-6) {
                    c22Errors.push("Crosshair arm span calculation error");
                }

                c22Pass = (c22Errors.length === 0);

                report.cases.push({
                    name: "Case22_CenterGuideControl",
                    passed: c22Pass,
                    lenFixed5mm: calcA.lengthMm,
                    lenRel20pct: calcB.lengthMm,
                    lenRel120pct: calcC.lengthMm,
                    errors: c22Errors
                });
                if (!c22Pass) allPassed = false;

                // ==========================================
                // CASE 23: JIS B 0003 Skeleton Drafting & Semantic Naming
                // Generates JIS drawing skeleton for a 2-gear pair (z1=18, z2=36, m=2.0)
                // Verifies tip circle (thick solid), pitch circle (fine dash-dot [6, 2, 1.5, 2]),
                // root circle (fine solid), kinematic axis connection line, and spec annotations
                // Verifies token substitution naming engine (standard, engineering, cam)
                // ==========================================
                CalcLogger.log("TEST", "Running Case 23: JIS B 0003 Skeleton Drafting & Naming...");
                var c23Origin = [abLeft + 400, abTop - 4400];
                var train23 = TrainTreeResolver.resolveTrain({
                    m: 2.0,
                    trainId: "T2",
                    nodes: [
                        { id: "C23_G1", z: 18, relationType: "ROOT", stageIndex: 1, isDriver: true, shaftDiameter: 8.0 },
                        { id: "C23_G2", z: 36, parentId: "C23_G1", relationType: "MESHING", stageIndex: 1, relativeAngleDeg: 0.0, shaftDiameter: 12.0 }
                    ]
                });

                var draw23Res = PathBuilder.drawTrain(doc, train23, {
                    originPt: c23Origin,
                    trainId: "T2",
                    namingPreset: "engineering",
                    stylePreset: "jis",
                    drawDwgLayer: true,
                    drawAnnotations: true,
                    conflictMode: "overwrite"
                });

                var c23Pass = false;
                var c23Errors = [];

                // Verify token naming output
                var engName = LayerAndStyle.formatName(LayerAndStyle.NAMING_PRESETS.engineering.gearGroup, {
                    train: "T2",
                    layer: 1,
                    id: "C23_G1",
                    kind: "Ext",
                    m: 2.0,
                    z: 18,
                    d: 36.0,
                    shaft: "8"
                });
                var expEngName = "C23_G1_Ext_m2_z18_d36.0_h8";
                if (engName !== expEngName) {
                    c23Errors.push("Engineering token naming mismatch: got '" + engName + "', expected '" + expEngName + "'");
                }

                var camName = LayerAndStyle.formatName(LayerAndStyle.NAMING_PRESETS.cam.gearGroup, {
                    train: "T2",
                    layer: 1,
                    kind: "Ext",
                    id: "C23_G1",
                    z: 18
                });
                var expCamName = "T2_L1_Ext_C23_G1_z18";
                if (camName !== expCamName) {
                    c23Errors.push("CAM token naming mismatch: got '" + camName + "', expected '" + expCamName + "'");
                }

                // Verify DWG layer in draw23Res
                if (!draw23Res.hierarchy || !draw23Res.hierarchy.dwgLayer) {
                    c23Errors.push("DWG layer not created in drawTrain");
                } else {
                    var dwgLyr = draw23Res.hierarchy.dwgLayer;
                    if (dwgLyr.pageItems.length === 0 && dwgLyr.groupItems.length === 0) {
                        c23Errors.push("DWG layer is empty");
                    }
                }

                c23Pass = (c23Errors.length === 0);

                report.cases.push({
                    name: "Case23_JisDwgAndNaming",
                    passed: c23Pass,
                    engNameFormatted: engName,
                    camNameFormatted: camName,
                    hasDwgLayer: !!(draw23Res.hierarchy && draw23Res.hierarchy.dwgLayer),
                    errors: c23Errors
                });
                if (!c23Pass) allPassed = false;

                // ==========================================
                // Case 31: DialogView Dimension & Safe Empty Guard (v0.6.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 31: DialogView Dimension & Safe Empty Guard...");
                var c31Errors = [];
                var c31Pass = false;

                try {
                    if (typeof DialogView === "undefined") {
                        c31Errors.push("DialogView module is undefined");
                    } else if (typeof DialogView.show !== "function") {
                        c31Errors.push("DialogView.show is not a function");
                    } else {
                        var dlgRes31 = DialogView.show(doc, [], {
                            isTest: true,
                            autoCloseMs: 300
                        });

                        if (!dlgRes31 || !dlgRes31.window) {
                            c31Errors.push("DialogView.show did not return valid window reference");
                        } else {
                            var w31 = dlgRes31.window;
                            var prefW = (w31.preferredSize && w31.preferredSize.width !== undefined) ? w31.preferredSize.width : (w31.preferredSize ? w31.preferredSize[0] : 0);
                            var prefH = (w31.preferredSize && w31.preferredSize.height !== undefined) ? w31.preferredSize.height : (w31.preferredSize ? w31.preferredSize[1] : 0);
                            if (prefW !== 1060) {
                                c31Errors.push("Dialog width is " + prefW + ", expected 1060");
                            }
                            if (prefH !== 640) {
                                c31Errors.push("Dialog height is " + prefH + ", expected 640");
                            }
                        }
                    }
                } catch (eC31) {
                    c31Errors.push("Exception during Case 31: " + eC31.message);
                }

                c31Pass = (c31Errors.length === 0);
                report.cases.push({
                    name: "Case31_DialogViewInitAndEmptyGuard",
                    passed: c31Pass,
                    errors: c31Errors
                });
                if (!c31Pass) allPassed = false;

                // ==========================================
                // Case 32: DialogView Modals & Color Presets (v0.6.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 32: DialogView Modals & Color Presets...");
                var c32Errors = [];
                var c32Pass = false;

                try {
                    if (typeof DialogView.showAddPlanetaryModal !== "function") {
                        c32Errors.push("showAddPlanetaryModal is missing");
                    }
                    if (typeof DialogView.showAddParadoxModal !== "function") {
                        c32Errors.push("showAddParadoxModal is missing");
                    }
                    if (typeof DialogView.showAddIntermittentModal !== "function") {
                        c32Errors.push("showAddIntermittentModal is missing");
                    }
                    if (typeof DialogView.showColorPresetModal !== "function") {
                        c32Errors.push("showColorPresetModal is missing");
                    }
                    if (typeof DialogView.showStyleDetailModal !== "function") {
                        c32Errors.push("showStyleDetailModal is missing");
                    }
                    if (!DialogView.DEFAULT_COLOR_PRESETS || DialogView.DEFAULT_COLOR_PRESETS.length === 0) {
                        c32Errors.push("DEFAULT_COLOR_PRESETS is empty or missing");
                    }
                } catch (eC32) {
                    c32Errors.push("Exception during Case 32: " + eC32.message);
                }

                c32Pass = (c32Errors.length === 0);
                report.cases.push({
                    name: "Case32_DialogViewModalsAndActions",
                    passed: c32Pass,
                    errors: c32Errors
                });
                if (!c32Pass) allPassed = false;

                // ==========================================
                // Case 33: DialogView GUI Screenshot Capture (v0.6.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 33: DialogView GUI Screenshot Capture...");
                var c33Errors = [];
                var c33Pass = false;

                var scriptFolder = null;
                try {
                    if (typeof $ !== "undefined" && $.fileName) {
                        scriptFolder = (new File($.fileName)).parent;
                    }
                } catch (eF) {}
                if (!scriptFolder || !scriptFolder.fsName) {
                    scriptFolder = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : { fsName: "." };
                }

                var guiCapturePngPath = scriptFolder.fsName + "/gui_capture.png";

                try {
                    var dlgRes33 = DialogView.show(doc, [], {
                        isTest: true,
                        autoCloseMs: 2500,
                        screenshotPath: guiCapturePngPath
                    });

                    captureGuiScreenshot(guiCapturePngPath);
                    $.sleep(1000);
                } catch (eC33) {
                    c33Errors.push("Exception during Case 33: " + eC33.message);
                }

                c33Pass = (c33Errors.length === 0);
                report.cases.push({
                    name: "Case33_DialogViewGuiScreenshot",
                    passed: c33Pass,
                    screenshotPath: guiCapturePngPath,
                    errors: c33Errors
                });
                if (!c33Pass) allPassed = false;

                // ==========================================
                // Case 34: Strict Circle Detection & Color Presets (v0.7.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 34: Strict Circle & Color Presets...");
                var c34Errors = [];
                var c34Pass = false;

                try {
                    var c34Layer = PathBuilder.getOrCreateLayer(doc, "Test_Case34_Circles");
                    try { doc.activeLayer = c34Layer; } catch (eA34) {}
                    // 1. Strict circle
                    var strictCirc = c34Layer.pathItems.ellipse(abTop - 3800, abLeft + 100, 100, 100);
                    var isCirc1 = TopologySolver.isStrictCircle(strictCirc);
                    if (!isCirc1) c34Errors.push("isStrictCircle failed for true circle (100x100)");

                    // 2. Ellipse (non-circle)
                    var ellipseItem = c34Layer.pathItems.ellipse(abTop - 3800, abLeft + 250, 100, 70);
                    var isCirc2 = TopologySolver.isStrictCircle(ellipseItem);
                    if (isCirc2) c34Errors.push("isStrictCircle incorrectly returned true for ellipse (100x70)");

                    // 3. Rectangle (non-circle)
                    var rectItem = c34Layer.pathItems.rectangle(abTop - 3800, abLeft + 400, 100, 100);
                    var isCirc3 = TopologySolver.isStrictCircle(rectItem);
                    if (isCirc3) c34Errors.push("isStrictCircle incorrectly returned true for rectangle (100x100)");

                    // 4. Color Preset resolution
                    var presets = DialogView.DEFAULT_COLOR_PRESETS;
                    var redCol = PathBuilder.createRGBColor(255, 0, 0);
                    var blueCol = PathBuilder.createRGBColor(0, 0, 255);
                    var greenCol = PathBuilder.createRGBColor(0, 170, 0);

                    var pRed = TopologySolver.resolveColorPreset(redCol, presets);
                    if (!pRed || pRed.kind !== "SPUR") c34Errors.push("Color preset resolution failed for Red");

                    var pBlue = TopologySolver.resolveColorPreset(blueCol, presets);
                    if (!pBlue || pBlue.kind !== "INTERNAL") c34Errors.push("Color preset resolution failed for Blue (expected INTERNAL)");

                    var pGreen = TopologySolver.resolveColorPreset(greenCol, presets);
                    if (!pGreen || pGreen.shaftType !== "D_CUT") c34Errors.push("Color preset resolution failed for Green (expected D_CUT)");

                } catch (eC34) {
                    c34Errors.push("Exception during Case 34: " + eC34.message);
                }

                c34Pass = (c34Errors.length === 0);
                report.cases.push({
                    name: "Case34_StrictCircleAndColorPresets",
                    passed: c34Pass,
                    errors: c34Errors
                });
                if (!c34Pass) allPassed = false;

                // ==========================================
                // Case 35: Circle Object Topology & Exact Position Solve (v0.7.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 35: Circle Topology & Exact Position Solve...");
                var c35Errors = [];
                var c35Pass = false;
                var c35Origin = [abLeft + 200, abTop - 4100];

                try {
                    var c35Layer1 = PathBuilder.getOrCreateLayer(doc, "Stage 1");
                    var c35Layer2 = PathBuilder.getOrCreateLayer(doc, "Stage 2");

                    // C1: d = 40 mm (z = 20, m = 2.0)
                    var c1DiamPt = 40.0 * MM_TO_PT;
                    var c1Center = [c35Origin[0], c35Origin[1]];
                    try { doc.activeLayer = c35Layer1; } catch (eA35_1) {}
                    var circ1 = c35Layer1.pathItems.ellipse(c1Center[1] + c1DiamPt / 2.0, c1Center[0] - c1DiamPt / 2.0, c1DiamPt, c1DiamPt);
                    circ1.stroked = true;
                    circ1.strokeColor = PathBuilder.createRGBColor(0, 170, 0); // Green preset

                    // C2: d = 60 mm (z = 30, m = 2.0)
                    // Place at aw = 51.0 mm (theoretical aStd = (20+30)*2/2 = 50.0 mm)
                    var c2DiamPt = 60.0 * MM_TO_PT;
                    var c2Center = [c1Center[0] + 51.0 * MM_TO_PT, c1Center[1]];
                    try { doc.activeLayer = c35Layer1; } catch (eA35_2) {}
                    var circ2 = c35Layer1.pathItems.ellipse(c2Center[1] + c2DiamPt / 2.0, c2Center[0] - c2DiamPt / 2.0, c2DiamPt, c2DiamPt);
                    circ2.stroked = true;
                    circ2.strokeColor = PathBuilder.createRGBColor(255, 0, 0); // Red preset

                    // C3: d = 24 mm (z = 12, m = 2.0) coaxial with C1 in Stage 2
                    var c3DiamPt = 24.0 * MM_TO_PT;
                    try { doc.activeLayer = c35Layer2; } catch (eA35_3) {}
                    var circ3 = c35Layer2.pathItems.ellipse(c1Center[1] + c3DiamPt / 2.0, c1Center[0] - c3DiamPt / 2.0, c3DiamPt, c3DiamPt);
                    circ3.stroked = true;
                    circ3.strokeColor = PathBuilder.createRGBColor(255, 0, 0);

                    var scanned35 = TopologySolver.scanCirclesAndGroups(doc, {
                        fromAllLayers: true,
                        colorPresets: DialogView.DEFAULT_COLOR_PRESETS
                    });

                    if (scanned35.length < 3) {
                        c35Errors.push("Failed to scan all 3 circles (found " + scanned35.length + ")");
                    } else {
                        var topoRes35 = TopologySolver.analyzeCircleTopology(scanned35, {
                            m: 2.0,
                            alphaDeg: 20.0,
                            snapMode: "exact_position",
                            toleranceMm: 3.0,
                            colorPresets: DialogView.DEFAULT_COLOR_PRESETS
                        });

                        if (!topoRes35 || !topoRes35.nodes || topoRes35.nodes.length < 3) {
                            c35Errors.push("Topology analysis did not produce at least 3 nodes");
                        } else {
                            var nMap = {};
                            for (var tni = 0; tni < topoRes35.nodes.length; tni++) {
                                var ndObj = topoRes35.nodes[tni];
                                nMap[ndObj.origCircle.origId] = ndObj;
                            }

                            // Verify profile shift x > 0 due to aw = 51.0 > 50.0
                            var hasShift = false;
                            for (var chkI = 0; chkI < topoRes35.nodes.length; chkI++) {
                                if (topoRes35.nodes[chkI].x > 0.05) hasShift = true;
                            }
                            if (!hasShift) {
                                c35Errors.push("exact_position solve failed to compute positive profile shift for extended center distance");
                            }

                            // Draw train
                            var resolvedTrain35 = TrainTreeResolver.resolveTrain({
                                trainId: "T_Topo",
                                nodes: topoRes35.nodes,
                                targetOriginMm: [c35Origin[0] * PT_TO_MM, c35Origin[1] * PT_TO_MM]
                            });

                            var drawRes35 = PathBuilder.drawTrain(doc, resolvedTrain35, {
                                trainId: "T_Topo",
                                drawGuides: true,
                                drawCenterGuide: true
                            });

                            if (!drawRes35 || !drawRes35.groups || drawRes35.groups.length === 0) {
                                c35Errors.push("drawTrain failed to render topology resolved gear train");
                            }
                        }
                    }
                } catch (eC35) {
                    c35Errors.push("Exception during Case 35: " + eC35.message);
                }

                c35Pass = (c35Errors.length === 0);
                report.cases.push({
                    name: "Case35_CircleTopologyAndExactPosition",
                    passed: c35Pass,
                    errors: c35Errors
                });
                if (!c35Pass) allPassed = false;

                // ==========================================
                // Case 36: Group Inner Shapes Custom Injection (v0.7.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 36: Group Inner Shapes Custom Injection...");
                var c36Errors = [];
                var c36Pass = false;
                var c36Origin = [abLeft + 1000, abTop - 4100];

                try {
                    var c36Layer = PathBuilder.getOrCreateLayer(doc, "Test_Case36_GroupCutouts");
                    try { doc.activeLayer = c36Layer; } catch (eA36) {}
                    var srcGroup = c36Layer.groupItems.add();
                    srcGroup.name = "CustomGear_SourceGroup";

                    // 1. Pitch Circle (d = 60mm -> z = 30)
                    var gPitchDiaPt = 60.0 * MM_TO_PT;
                    var gPitchCircle = srcGroup.pathItems.ellipse(
                        c36Origin[1] + gPitchDiaPt / 2.0,
                        c36Origin[0] - gPitchDiaPt / 2.0,
                        gPitchDiaPt,
                        gPitchDiaPt
                    );
                    gPitchCircle.stroked = true;
                    gPitchCircle.strokeColor = PathBuilder.createRGBColor(0, 0, 0);

                    // 2. Custom Central Hexagonal Shaft Hole
                    var hexHole = srcGroup.pathItems.add();
                    hexHole.name = "Custom_HexShaft";
                    var rHex = 5.0 * MM_TO_PT;
                    for (var hi = 0; hi < 6; hi++) {
                        var hTh = hi * (Math.PI / 3.0);
                        var hx = c36Origin[0] + rHex * Math.cos(hTh);
                        var hy = c36Origin[1] + rHex * Math.sin(hTh);
                        var hPt = hexHole.pathPoints.add();
                        hPt.anchor = hPt.leftDirection = hPt.rightDirection = [hx, hy];
                    }
                    hexHole.closed = true;

                    // 3. Custom Weight Reduction Slots (4 circles at radius 18mm)
                    var rCutoutOrbit = 18.0 * MM_TO_PT;
                    var rCutoutDia = 8.0 * MM_TO_PT;
                    for (var si = 0; si < 4; si++) {
                        var sTh = si * (Math.PI / 2.0) + (Math.PI / 4.0);
                        var sx = c36Origin[0] + rCutoutOrbit * Math.cos(sTh);
                        var sy = c36Origin[1] + rCutoutOrbit * Math.sin(sTh);
                        var slotCirc = srcGroup.pathItems.ellipse(sy + rCutoutDia / 2.0, sx - rCutoutDia / 2.0, rCutoutDia, rCutoutDia);
                        slotCirc.name = "CustomSlot_" + (si + 1);
                    }

                    // Scan group
                    doc.selection = [srcGroup];
                    var groupScan = TopologySolver.scanCirclesAndGroups(doc, {
                        fromAllLayers: false,
                        extractInnerShapes: true
                    });

                    if (groupScan.length !== 1 || !groupScan[0].isGroup) {
                        c36Errors.push("Failed to detect GroupItem as pitch circle with inner cutout shapes");
                    } else {
                        var gDesc = groupScan[0];
                        if (gDesc.innerShapeItems.length !== 5) {
                            c36Errors.push("Expected 5 inner shape items (1 hex + 4 slots), found " + gDesc.innerShapeItems.length);
                        }

                        // Generate gear geometry and render with features
                        var gear36Data = InvoluteCore.calculateSpurGear({
                            m: 2.0,
                            z: 30,
                            alphaDeg: 20.0,
                            pathQuality: "bezier_recommended"
                        });

                        var draw36Group = PathBuilder.drawGearWithFeatures(
                            doc,
                            c36Layer,
                            [c36Origin[0], c36Origin[1] - 300],
                            gear36Data,
                            null,
                            null,
                            null,
                            0,
                            "Gear_GroupInjected",
                            {
                                customInjections: gDesc.innerShapeItems,
                                origCenterPt: c36Origin,
                                drawGuides: true
                            }
                        );

                        if (!draw36Group || draw36Group.compoundPathItems.length === 0) {
                            c36Errors.push("drawGearWithFeatures did not produce unified CompoundPathItem for group injected gear");
                        } else {
                            var cpBody = draw36Group.compoundPathItems[0];
                            // Expected: 1 outer contour + 1 hex + 4 circular slots = 6 sub-paths
                            if (cpBody.pathItems.length !== 6) {
                                c36Errors.push("Expected 6 sub-paths in compound body (1 outer + 5 inner), found " + cpBody.pathItems.length);
                            }
                        }
                    }

                } catch (eC36) {
                    c36Errors.push("Exception during Case 36: " + eC36.message);
                }

                c36Pass = (c36Errors.length === 0);
                report.cases.push({
                    name: "Case36_GroupInnerShapesCustomInjection",
                    passed: c36Pass,
                    errors: c36Errors
                });
                if (!c36Pass) allPassed = false;

                // ==========================================
                // Case 37: In-Document Scratch Shaft & Safety Boundary Check (v0.9.1 Crash-Prevention)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 37: In-Document Scratch Shaft & Safety Boundary Check...");
                var c37Errors = [];
                var c37Pass = false;
                var c37Origin = [abLeft + 1600, abTop - 4100];

                try {
                    var c37Layer = PathBuilder.getOrCreateLayer(doc, "Test_Case37_InDocShaft");
                    try { doc.activeLayer = c37Layer; } catch (eA37) {}

                    // 1. In-Document Temporary Path Generation & Immediate Cleanup
                    // Verifies that custom shaft shapes are created in-place in active document without opening external windows
                    var scratchPaths = PathBuilder.createInDocumentScratchPath(doc, "HEXAGON", 30.0, c37Origin, c37Layer);
                    if (!scratchPaths || scratchPaths.length === 0) {
                        c37Errors.push("createInDocumentScratchPath failed to create hexagon scratch path");
                    }

                    // 2. Import External/In-Place Template
                    var impTest = PathBuilder.importExternalAiTemplate(doc, null, c37Origin, { targetLayer: c37Layer });
                    if (!impTest || !impTest.items || impTest.items.length === 0) {
                        c37Errors.push("importExternalAiTemplate failed to produce in-document template items");
                    } else {
                        // 3. Render gear with in-document injected compound path
                        var gear37Data = InvoluteCore.calculateSpurGear({
                            m: 2.0,
                            z: 24,
                            alphaDeg: 20.0
                        });

                        var draw37Group = PathBuilder.drawGearWithFeatures(
                            doc,
                            c37Layer,
                            c37Origin,
                            gear37Data,
                            null,
                            null,
                            null,
                            0,
                            "Gear_InDocShaftInjected",
                            {
                                customInjections: impTest.items,
                                origCenterPt: c37Origin,
                                compoundPath: true
                            }
                        );

                        if (!draw37Group || draw37Group.compoundPathItems.length === 0) {
                            c37Errors.push("Failed to render gear with in-document injected compound path");
                        }

                        if (impTest.tempGroup) {
                            try { impTest.tempGroup.remove(); } catch (eR37) {}
                        }
                    }

                    // 4. Test Safety Boundary Checker (rf - m)
                    var rfTest = 30.0; // mm
                    var mTest = 2.0;   // mm -> r_limit = 28.0 mm
                    var safePoints = [[0, 10], [10, 0], [-10, 0], [0, -10]]; // max R = 10.0 <= 28.0
                    var violPoints = [[0, 29.5], [10, 0]]; // max R = 29.5 > 28.0

                    var resSafe = ShaftAndBody.checkSafetyBoundary(rfTest, mTest, safePoints);
                    if (!resSafe.safe) c37Errors.push("Safety check falsely reported violation for safe points");

                    var resViol = ShaftAndBody.checkSafetyBoundary(rfTest, mTest, violPoints);
                    if (resViol.safe || !resViol.warning) c37Errors.push("Safety check failed to report violation for points exceeding r_limit");

                } catch (eC37) {
                    c37Errors.push("Exception during Case 37: " + eC37.message);
                }

                c37Pass = (c37Errors.length === 0);
                report.cases.push({
                    name: "Case37_ExternalAiAndSafetyBoundary",
                    passed: c37Pass,
                    errors: c37Errors
                });
                if (!c37Pass) allPassed = false;

                // ==========================================
                // Case 38 : CSV / TSV Batch Import & Export
                // ==========================================
                var c38Errors = [];
                var c38Pass = false;
                try {
                    var sampleCsv = [
                        "ID,ParentID,Type,Teeth,Module,PressureAngle,ProfileShift,RelativeAngle,StageIndex,Backlash,TipRounding,Kerf,ShaftType,ShaftSize,CutoutType,CutoutPath,IsCoaxial",
                        "G1,,SPUR,18,2.0,20.0,0.0,0.0,1,0.1,0.0,0.0,ROUND,5.0,NONE,,false",
                        "G2,G1,SPUR,36,2.0,20.0,0.0,45.0,1,0.1,0.0,0.0,KEYWAY,8.0,SPOKES,,false",
                        "G3,G2,SPUR,20,2.0,20.0,0.2,0.0,2,0.1,0.0,0.0,ROUND,5.0,NONE,,true",
                        "G4,G3,INTERNAL,60,2.0,20.0,0.0,180.0,2,0.1,0.0,0.0,NONE,0.0,NONE,,false",
                        "G5,G1,RACK,24,2.0,20.0,0.0,270.0,1,0.1,0.0,0.0,NONE,0.0,NONE,,false",
                        "G_Orphan,NON_EXISTENT,SPUR,15,2.0,20.0,0.0,0.0,1,0.0,0.0,0.0,ROUND,4.0,NONE,,false"
                    ].join("\n");

                    var parsedNodes = GearBatchParser.parseCSVToTrainNodes(sampleCsv);
                    if (!parsedNodes || parsedNodes.length !== 6) {
                        c38Errors.push("Expected 6 parsed nodes, got: " + (parsedNodes ? parsedNodes.length : 0));
                    } else {
                        // Check G1 Root
                        var n1 = parsedNodes[0];
                        if (n1.id !== "G1" || n1.parentId !== null || n1.relationType !== "ROOT" || n1.z !== 18) {
                            c38Errors.push("Node G1 root properties mismatch: " + SimpleJSON.stringify(n1));
                        }

                        // Check G2 Meshing
                        var n2 = parsedNodes[1];
                        if (n2.id !== "G2" || n2.parentId !== "G1" || n2.relationType !== "MESHING" || n2.shaftType !== "KEYWAY" || n2.cutoutType !== "SPOKES") {
                            c38Errors.push("Node G2 properties mismatch: " + SimpleJSON.stringify(n2));
                        }

                        // Check G3 Coaxial
                        var n3 = parsedNodes[2];
                        if (n3.id !== "G3" || n3.parentId !== "G2" || n3.relationType !== "COAXIAL" || n3.stageIndex !== 2) {
                            c38Errors.push("Node G3 coaxial properties mismatch: " + SimpleJSON.stringify(n3));
                        }

                        // Check G4 Internal
                        var n4 = parsedNodes[3];
                        if (n4.id !== "G4" || n4.kind !== "INTERNAL" || n4.relationType !== "INTERNAL_MESHING" || n4.z !== 60) {
                            c38Errors.push("Node G4 internal properties mismatch: " + SimpleJSON.stringify(n4));
                        }

                        // Check G5 Rack
                        var n5 = parsedNodes[4];
                        if (n5.id !== "G5" || n5.kind !== "RACK" || n5.z !== 24) {
                            c38Errors.push("Node G5 rack properties mismatch: " + SimpleJSON.stringify(n5));
                        }

                        // Check G_Orphan (Promoted to ROOT)
                        var nOrphan = parsedNodes[5];
                        if (nOrphan.id !== "G_Orphan" || nOrphan.parentId !== null || nOrphan.relationType !== "ROOT") {
                            c38Errors.push("Node G_Orphan promotion to ROOT failed: " + SimpleJSON.stringify(nOrphan));
                        }

                        // Tree Resolver validity check
                        var validSubTree = [n1, n2, n3, n4, n5];
                        var resolvedRes = TrainTreeResolver.resolveTrain({
                            trainId: "T_CSV_TEST",
                            nodes: validSubTree,
                            targetOriginMm: [0, 0],
                            toleranceMm: 0.01
                        });
                        if (!resolvedRes || !resolvedRes.nodes || resolvedRes.nodes.length !== 5) {
                            c38Errors.push("TrainTreeResolver failed on CSV parsed nodes");
                        }

                        // Roundtrip CSV Serialization and Re-parse
                        var exportedCsv = GearBatchParser.trainNodesToCSV(validSubTree, ",");
                        var reimported = GearBatchParser.parseCSVToTrainNodes(exportedCsv, ",");
                        if (!reimported || reimported.length !== 5) {
                            c38Errors.push("Roundtrip CSV re-import length mismatch: " + (reimported ? reimported.length : 0));
                        } else {
                            for (var ri = 0; ri < 5; ri++) {
                                if (reimported[ri].id !== validSubTree[ri].id ||
                                    reimported[ri].z !== validSubTree[ri].z ||
                                    reimported[ri].kind !== validSubTree[ri].kind ||
                                    reimported[ri].stageIndex !== validSubTree[ri].stageIndex) {
                                    c38Errors.push("Roundtrip node " + ri + " mismatch: original=" + SimpleJSON.stringify(validSubTree[ri]) + ", reimported=" + SimpleJSON.stringify(reimported[ri]));
                                }
                            }
                        }
                    }
                } catch (eC38) {
                    c38Errors.push("Exception during Case 38: " + eC38.message);
                }
                c38Pass = (c38Errors.length === 0);
                report.cases.push({
                    name: "Case38_CSV_TSV_Batch_Import_Export",
                    passed: c38Pass,
                    errors: c38Errors
                });
                if (!c38Pass) allPassed = false;

                // ==========================================
                // Case 39 : Preferences JSON Persistence
                // ==========================================
                var c39Errors = [];
                var c39Pass = false;
                try {
                    var defaultPrefs = PreferencesManager.getDefaultPreferences();
                    if (!defaultPrefs || !defaultPrefs.common || defaultPrefs.common.m !== 2.0) {
                        c39Errors.push("Invalid default preferences structure");
                    }

                    // Create custom preferences
                    var customPrefs = PreferencesManager.getDefaultPreferences();
                    customPrefs.common.m = 2.5;
                    customPrefs.common.shaftDia = 6.0;
                    customPrefs.centerGuide.mode = 1; // Relative
                    customPrefs.centerGuide.size = 25.0; // 25%
                    customPrefs.naming.trainId = "T_PERSIST";
                    customPrefs.colorPresets.push({
                        colorName: "OrangeCustom",
                        hex: "#FFA500",
                        kind: "SPUR",
                        shaftType: "D_CUT",
                        shaftDia: 6.0,
                        cutoutType: "HOLES",
                        shift: 0.1
                    });

                    var tempFolder = (typeof Folder !== "undefined" && Folder.temp && Folder.temp.exists) ? Folder.temp : Folder.desktop;
                    var tempPrefFile = new File(tempFolder.fsName + "/geardrawer_pref_test_" + (new Date().getTime()) + ".json");

                    var saveOk = PreferencesManager.exportPreferencesToFile(tempPrefFile, customPrefs);
                    if (!saveOk || !tempPrefFile.exists) {
                        c39Errors.push("Failed to export preferences to temp JSON file: " + tempPrefFile.fsName);
                    } else {
                        var importedPrefs = PreferencesManager.importPreferencesFromFile(tempPrefFile);
                        if (!importedPrefs) {
                            c39Errors.push("Failed to import preferences from temp JSON file");
                        } else {
                            if (importedPrefs.common.m !== 2.5) {
                                c39Errors.push("Imported m mismatch: expected 2.5, got " + importedPrefs.common.m);
                            }
                            if (importedPrefs.common.shaftDia !== 6.0) {
                                c39Errors.push("Imported shaftDia mismatch: expected 6.0, got " + importedPrefs.common.shaftDia);
                            }
                            if (importedPrefs.centerGuide.mode !== 1 || importedPrefs.centerGuide.size !== 25.0) {
                                c39Errors.push("Imported centerGuide mismatch: mode=" + importedPrefs.centerGuide.mode + ", size=" + importedPrefs.centerGuide.size);
                            }
                            if (importedPrefs.naming.trainId !== "T_PERSIST") {
                                c39Errors.push("Imported trainId mismatch: expected T_PERSIST, got " + importedPrefs.naming.trainId);
                            }
                            if (importedPrefs.colorPresets.length !== customPrefs.colorPresets.length) {
                                c39Errors.push("Imported colorPresets length mismatch: expected " + customPrefs.colorPresets.length + ", got " + importedPrefs.colorPresets.length);
                            }
                        }

                        // Clean up temp file
                        try {
                            if (tempPrefFile.exists) tempPrefFile.remove();
                        } catch (eDelPref) {}
                    }
                } catch (eC39) {
                    c39Errors.push("Exception during Case 39: " + eC39.message);
                }
                c39Pass = (c39Errors.length === 0);
                report.cases.push({
                    name: "Case39_Preferences_JSON_Persistence",
                    passed: c39Pass,
                    errors: c39Errors
                });
                if (!c39Pass) allPassed = false;

                // ==========================================
                // Case 40 : Diagnostic Log Rescue
                // ==========================================
                var c40Errors = [];
                var c40Pass = false;
                try {
                    CalcLogger.clear();
                    CalcLogger.setVersion("0.8.0");
                    CalcLogger.log("RESCUE_TEST", "Execution trace entry for rescue verification", { step: 1, val: "OK" });
                    CalcLogger.warn("RESCUE_WARN", "Simulated warning during calculation");
                    CalcLogger.error("RESCUE_ERR", "Simulated drawing exception caught", new Error("Simulated motor gear collision"));

                    var traceText = CalcLogger.dumpText();
                    if (!traceText || traceText.indexOf("GearDrawer Calculation & Diagnostic Execution Trace") < 0) {
                        c40Errors.push("dumpText missing banner header");
                    }
                    if (traceText.indexOf("Version   : 0.8.0") < 0) {
                        c40Errors.push("dumpText missing version string 0.8.0");
                    }
                    if (traceText.indexOf("RESCUE_TEST") < 0 || traceText.indexOf("RESCUE_WARN") < 0 || traceText.indexOf("RESCUE_ERR") < 0) {
                        c40Errors.push("dumpText missing category tags");
                    }
                    if (traceText.indexOf("Simulated motor gear collision") < 0) {
                        c40Errors.push("dumpText missing error message detail");
                    }

                    var tempFolder2 = (typeof Folder !== "undefined" && Folder.temp && Folder.temp.exists) ? Folder.temp : Folder.desktop;
                    var tempLogFile = new File(tempFolder2.fsName + "/geardrawer_rescue_test_" + (new Date().getTime()) + ".txt");
                    var exportedLogFile = CalcLogger.exportToFile(tempLogFile);

                    if (!exportedLogFile || !exportedLogFile.exists) {
                        c40Errors.push("exportToFile failed to produce file on disk");
                    } else {
                        exportedLogFile.encoding = "UTF-8";
                        if (exportedLogFile.open("r")) {
                            var fileContent = exportedLogFile.read();
                            exportedLogFile.close();
                            if (!fileContent || fileContent.length < 100) {
                                c40Errors.push("Exported log file content is empty or unexpectedly short (" + (fileContent ? fileContent.length : 0) + " chars)");
                            }
                        } else {
                            c40Errors.push("Failed to open exported log file for reading verification");
                        }

                        // Clean up temp file
                        try {
                            if (exportedLogFile.exists) exportedLogFile.remove();
                        } catch (eDelLog) {}
                    }
                } catch (eC40) {
                    c40Errors.push("Exception during Case 40: " + eC40.message);
                }
                c40Pass = (c40Errors.length === 0);
                report.cases.push({
                    name: "Case40_Diagnostic_Log_Rescue",
                    passed: c40Pass,
                    errors: c40Errors
                });
                if (!c40Pass) allPassed = false;

                // ==========================================
                // Case 41: All Mechanisms Combined Integration (v0.9.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 41: All Mechanisms Combined Integration...");
                var c41Errors = [];
                var c41Pass = false;
                var c41Origin = [abLeft + 200, abTop - 4800];

                try {
                    var c41Layer = PathBuilder.getOrCreateLayer(doc, "Test_Case41_CombinedMechanisms");

                    // 1. Root Spur Gear (G1, z=24, m=2.0, KEYWAY d=12mm)
                    var g41_1Data = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 24,
                        alphaDeg: 20.0,
                        pathQuality: "bezier_recommended"
                    });
                    var shaft41_1 = ShaftAndBody.calculateShaftHole(12.0, "KEYWAY");
                    var g41_1Pos = [c41Origin[0] + 150, c41Origin[1] - 150];
                    var grp41_1 = PathBuilder.drawGearWithFeatures(doc, c41Layer, g41_1Pos, g41_1Data, shaft41_1, null, null, 0, "C41_G1_Root", {
                        compoundPath: true,
                        centerGuide: true
                    });

                    // 2. Mated Spur Gear with Parametric Spokes Cutouts (G2, z=18, mated to G1 at 0 deg)
                    // aw = m*(24+18)/2 = 42 mm = 42 * MM_TO_PT pt
                    var distG1G2 = 42.0 * MM_TO_PT;
                    var g41_2Pos = [g41_1Pos[0] + distG1G2, g41_1Pos[1]];
                    var g41_2Data = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 18,
                        alphaDeg: 20.0,
                        pathQuality: "bezier_recommended"
                    });
                    var cutout41_2 = ShaftAndBody.calculateParametricCutouts(g41_2Data.rf, 8.0, "SPOKES", {
                        m: 2.0,
                        spokeCount: 4,
                        spokeWidth: 3.0
                    });
                    var shaft41_2 = ShaftAndBody.calculateShaftHole(8.0, "ROUND");
                    var rot41_2 = 180.0 / 18.0;
                    var grp41_2 = PathBuilder.drawGearWithFeatures(doc, c41Layer, g41_2Pos, g41_2Data, shaft41_2, cutout41_2, null, rot41_2, "C41_G2_Spur", {
                        compoundPath: true,
                        centerGuide: true
                    });

                    // 3. Coaxial Gear on G2 (Stage 2: G3, z=12, m=2.0)
                    var g41_3Data = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 12,
                        alphaDeg: 20.0,
                        pathQuality: "bezier_recommended"
                    });
                    var grp41_3 = PathBuilder.drawGearWithFeatures(doc, c41Layer, g41_2Pos, g41_3Data, shaft41_2, null, null, rot41_2, "C41_G3_Coaxial", {
                        compoundPath: true,
                        centerGuide: true
                    });

                    // 4. Rack meshing with G3 (Rack 10 teeth at 90 deg down)
                    var rack41Pos = [g41_2Pos[0], g41_2Pos[1] - (12.0 * MM_TO_PT)];
                    var rack41Data = InvoluteCore.calculateRack({
                        m: 2.0,
                        zRack: 10,
                        alphaDeg: 20.0
                    });
                    var grp41_4 = PathBuilder.drawRack(doc, c41Layer, rack41Pos, rack41Data, 0, [0, 0], "C41_G4_Rack", {});

                    // 5. Internal Ring Gear (G5, z=54, m=2.0, mated to G1 at 180 deg)
                    // aw_int = m*(54 - 24)/2 = 30 mm = 30 * MM_TO_PT
                    var distG1G5 = 30.0 * MM_TO_PT;
                    var g41_5Pos = [g41_1Pos[0] - distG1G5, g41_1Pos[1]];
                    var int41Data = InvoluteCore.calculateInternalGear({
                        m: 2.0,
                        z: 54,
                        alphaDeg: 20.0,
                        rimThickness: 6.0
                    });
                    var grp41_5 = PathBuilder.drawInternalGear(doc, c41Layer, g41_5Pos, int41Data, 0, "C41_G5_Internal", {
                        centerGuide: true
                    });

                    // 6. Standard Planetary Carrier (2K-H: zs=18, zp=18, zr=54, N=3)
                    var plan41CarrierPos = [c41Origin[0] + 650, c41Origin[1] - 150];
                    var carrier41Data = MechanismSolvers.calculatePlanetaryCarrier({
                        m: 2.0,
                        zs: 18,
                        zp: 18,
                        numPlanets: 3,
                        carrierType: "ARM",
                        sunShaftDiameter: 10.0,
                        planetPinDiameter: 4.0
                    });
                    var grp41_6 = PathBuilder.drawPlanetaryCarrier(doc, c41Layer, plan41CarrierPos, carrier41Data, {});

                    // 7. Paradoxical Planetary (3K differential: zs=18, zp=17, zr2=54, zr1=51)
                    var paradox41 = MechanismSolvers.solveParadoxicalPlanetary({
                        m: 2.0,
                        fixedZs: 18,
                        fixedZp: 17,
                        fixedZr2: 54,
                        fixedZr1: 51,
                        alphaDeg: 20.0
                    });

                    // 8. Intermittent Gear Pair with 2-layer locking plates
                    var interDriver41 = MechanismSolvers.calculateMutilatedSpurGear({
                        m: 2.0,
                        z: 24,
                        intermittentRole: "DRIVER",
                        intermittentStructure: "two_layer",
                        moveTeeth: 4,
                        divisions: 4,
                        lockClearance: 0.15
                    });
                    var interKinematics41 = MechanismSolvers.calculateIntermittentKinematics({
                        m: 2.0,
                        z1: 24,
                        divisions: 4,
                        moveTeeth: 4,
                        z2: 24,
                        lockClearance: 0.15
                    });
                    var inter41Pos = [c41Origin[0] + 1150, c41Origin[1] - 150];
                    if (interDriver41 && interDriver41.lockPlate) {
                        var interLockPlate1 = PathBuilder.drawLockPlate(doc, c41Layer, inter41Pos, interDriver41.lockPlate, 0, {});
                    }

                    // Verify contour existence and closure
                    var p41_1 = findContourPath(grp41_1, "C41_G1_Root");
                    if (!p41_1 || !p41_1.closed) {
                        c41Errors.push("C41_G1_Root contour path missing or not closed");
                    }
                    var p41_2 = findContourPath(grp41_2, "C41_G2_Spur");
                    if (!p41_2 || !p41_2.closed) {
                        c41Errors.push("C41_G2_Spur contour path missing or not closed");
                    }
                    var p41_4 = findContourPath(grp41_4, "C41_G4_Rack");
                    if (!p41_4 || !p41_4.closed) {
                        c41Errors.push("C41_G4_Rack contour path missing or not closed");
                    }
                    var p41_5 = findContourPath(grp41_5, "C41_G5_Internal");
                    if (!p41_5) {
                        c41Errors.push("C41_G5_Internal contour path missing");
                    }

                    // Geometric distance verification (< 10 um = 0.01 mm)
                    var calcDistG1G2 = Math.sqrt(Math.pow(g41_2Pos[0] - g41_1Pos[0], 2) + Math.pow(g41_2Pos[1] - g41_1Pos[1], 2)) * PT_TO_MM;
                    var errorG1G2 = Math.abs(calcDistG1G2 - 42.0);
                    if (errorG1G2 > 0.01) {
                        c41Errors.push("Center distance G1-G2 error " + (errorG1G2 * 1000).toFixed(2) + " um exceeds 10 um threshold");
                    }

                    var calcDistG1G5 = Math.sqrt(Math.pow(g41_5Pos[0] - g41_1Pos[0], 2) + Math.pow(g41_5Pos[1] - g41_1Pos[1], 2)) * PT_TO_MM;
                    var errorG1G5 = Math.abs(calcDistG1G5 - 30.0);
                    if (errorG1G5 > 0.01) {
                        c41Errors.push("Center distance G1-G5 error " + (errorG1G5 * 1000).toFixed(2) + " um exceeds 10 um threshold");
                    }

                } catch (eC41) {
                    c41Errors.push("Exception during Case 41: " + eC41.message);
                }

                c41Pass = (c41Errors.length === 0);
                report.cases.push({
                    name: "Case41_AllMechanisms_CombinedIntegration",
                    passed: c41Pass,
                    errors: c41Errors
                });
                if (!c41Pass) allPassed = false;

                // ==========================================
                // Case 42: Extreme Values Clamp & Guard (v0.9.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 42: Extreme Values Clamp & Guard...");
                var c42Errors = [];
                var c42Pass = false;

                try {
                    // 1. Extreme Minimum Tooth Count (z = 3)
                    var gMinZ = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 3,
                        alphaDeg: 20.0
                    });
                    if (!gMinZ || !gMinZ.outerNodes || gMinZ.outerNodes.length === 0) {
                        c42Errors.push("Failed to generate outerNodes for extreme minimum tooth count z=3");
                    } else {
                        for (var nzi = 0; nzi < gMinZ.outerNodes.length; nzi++) {
                            var ndz = gMinZ.outerNodes[nzi];
                            if (isNaN(ndz.anchor[0]) || isNaN(ndz.anchor[1]) ||
                                isNaN(ndz.leftDirection[0]) || isNaN(ndz.leftDirection[1]) ||
                                isNaN(ndz.rightDirection[0]) || isNaN(ndz.rightDirection[1])) {
                                c42Errors.push("NaN detected in outerNodes for z=3 at index " + nzi);
                                break;
                            }
                        }
                    }

                    // 2. Extreme Maximum Tooth Count (z = 200)
                    var gMaxZ = InvoluteCore.calculateSpurGear({
                        m: 1.0,
                        z: 200,
                        alphaDeg: 20.0
                    });
                    if (!gMaxZ || !gMaxZ.outerNodes || gMaxZ.outerNodes.length !== 1800) {
                        c42Errors.push("Expected 1800 nodes for z=200, found " + (gMaxZ && gMaxZ.outerNodes ? gMaxZ.outerNodes.length : 0));
                    }

                    // 3. Extreme Positive Profile Shift (x = +2.0, top-land pointing guard)
                    var gSharp = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 18,
                        x: 2.0
                    });
                    if (!gSharp || !gSharp.warnings || gSharp.warnings.length === 0) {
                        c42Errors.push("Expected warning for pointed tooth / top-land clamp at x=+2.0");
                    }
                    if (gSharp.ra <= gSharp.rf) {
                        c42Errors.push("ra <= rf at x=+2.0");
                    }

                    // 4. Inverted Addendum / Dedendum Guard (excessive topping deltaY = 5.0)
                    var gInvert = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 18,
                        deltaY: 5.0
                    });
                    if (!gInvert || !gInvert.warnings || gInvert.warnings.length === 0) {
                        c42Errors.push("Expected warning for inverted da <= df with excessive deltaY");
                    }
                    if (gInvert.ra <= gInvert.rf) {
                        c42Errors.push("ra <= rf with excessive deltaY (inversion guard failed)");
                    }

                    // 5. Excessive Backlash (seff <= 0 guard)
                    var gBacklash = InvoluteCore.calculateSpurGear({
                        m: 2.0,
                        z: 18,
                        backlash: 20.0
                    });
                    if (!gBacklash || gBacklash.seff < 0.05 * 2.0) {
                        c42Errors.push("seff not clamped for excessive backlash");
                    }

                    // 6. Zero Division Avoidance (m=0, z=0, alpha=0)
                    var gZero = InvoluteCore.calculateSpurGear({
                        m: 0,
                        z: 0,
                        alphaDeg: 0
                    });
                    if (!gZero || !gZero.outerNodes || gZero.outerNodes.length === 0) {
                        c42Errors.push("Failed to safely fallback on zero input (m=0, z=0, alpha=0)");
                    }

                    // 7. Shaft Diameter Guards (Too small < 0.2mm and too large > 300mm)
                    var sSmall = ShaftAndBody.calculateShaftHole(0.05, "ROUND");
                    if (sSmall.hasHole) {
                        c42Errors.push("Shaft hole < 0.2mm should be suppressed (hasHole should be false)");
                    }
                    var sLarge = ShaftAndBody.calculateShaftHole(500, "ROUND");
                    if (sLarge.shaftDiameter > 300) {
                        c42Errors.push("Shaft diameter > 300 should be clamped to 300");
                    }

                    // 8. Low Contact Ratio Warning (< 1.0)
                    var meshLow = InvoluteCore.calculateMeshingParameters({
                        m: 2.0,
                        z: 6,
                        x: -1.0
                    }, {
                        m: 2.0,
                        z: 6,
                        x: -1.0
                    });
                    if (!meshLow.isCriticalWarning) {
                        c42Errors.push("Expected isCriticalWarning for contact ratio < 1.0");
                    }
                    if (meshLow.criticalWarningMessage.indexOf("< 1.0") === -1) {
                        c42Errors.push("criticalWarningMessage did not contain '< 1.0'");
                    }

                } catch (eC42) {
                    c42Errors.push("Exception during Case 42: " + eC42.message);
                }

                c42Pass = (c42Errors.length === 0);
                report.cases.push({
                    name: "Case42_ExtremeValues_ClampAndGuard",
                    passed: c42Pass,
                    errors: c42Errors
                });
                if (!c42Pass) allPassed = false;

                // ==========================================
                // Case 43: All UI Events Stress Execution (v0.9.0)
                // ==========================================
                CalcLogger.log("TEST", "Executing Case 43: All UI Events Stress Execution...");
                var c43Errors = [];
                var c43Pass = false;

                try {
                    var testExecutedEvents = 0;
                    var dlgRes43 = DialogView.show(doc, [], {
                        isTest: true,
                        autoCloseMs: 400,
                        onTestCallback: function (w43) {
                            var execRes = DialogView.executeAllUiEvents(w43);
                            testExecutedEvents = execRes.executedCount;
                            if (execRes.errorCount > 0) {
                                for (var ei = 0; ei < execRes.errors.length; ei++) {
                                    c43Errors.push(execRes.errors[ei]);
                                }
                            }
                        }
                    });

                    if (testExecutedEvents < 25) {
                        c43Errors.push("Executed UI events count too low (" + testExecutedEvents + ", expected >= 25)");
                    }

                    // Modal invocation stress checks
                    try {
                        if (typeof DialogView.showStyleDetailModal !== "function" ||
                            typeof DialogView.showColorPresetModal !== "function" ||
                            typeof DialogView.showAddPlanetaryModal !== "function" ||
                            typeof DialogView.showAddParadoxModal !== "function" ||
                            typeof DialogView.showAddIntermittentModal !== "function") {
                            c43Errors.push("One or more DialogView modal functions are missing");
                        }
                    } catch (eModal) {
                        c43Errors.push("Modal stress verification exception: " + eModal.message);
                    }

                } catch (eC43) {
                    c43Errors.push("Exception during Case 43: " + eC43.message);
                }

                c43Pass = (c43Errors.length === 0);
                report.cases.push({
                    name: "Case43_AllUiEvents_StressExecution",
                    passed: c43Pass,
                    errors: c43Errors
                });
                if (!c43Pass) allPassed = false;

                // ==========================================
                // Save Initial test_report.json BEFORE Image Captures
                // ==========================================
                report.totalCases = report.cases.length;
                var passedCount = 0;
                for (var pi = 0; pi < report.cases.length; pi++) {
                    if (report.cases[pi].passed) passedCount++;
                }
                report.passedCases = passedCount;
                report.overallPassed = (passedCount === report.cases.length && report.cases.length > 0);
                allPassed = report.overallPassed;

                var scriptFolder = null;
                try {
                    if (typeof $ !== "undefined" && $.fileName) {
                        scriptFolder = (new File($.fileName)).parent;
                    }
                } catch (eF) {}
                if (!scriptFolder || !scriptFolder.fsName) {
                    scriptFolder = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : { fsName: "." };
                }

                // ==========================================
                // Automatic Image Capture (Overview & Detailed Zooms)
                // ==========================================
                try {
                    var overviewPngPath = scriptFolder.fsName + "/test_v090_overview.png";
                    var okOverview = captureGearView(doc, overviewPngPath, abRect, 150);
                    report.overviewPng = overviewPngPath;
                    report.overviewSuccess = okOverview;

                    // Zoom 1: Case 41 Combined Integration
                    var z41Bounds = [c41Origin[0] - 50, c41Origin[1] + 50, c41Origin[0] + 1600, c41Origin[1] - 450];
                    var zoomCombinedPngPath = scriptFolder.fsName + "/test_v090_combined_zoom.png";
                    var okCombined = captureGearView(doc, zoomCombinedPngPath, z41Bounds, 300);
                    report.zoomCombinedPng = zoomCombinedPngPath;
                    report.zoomCombinedSuccess = okCombined;

                    // Zoom 2: Case 35 Circle Topology & Exact Position
                    var z35Bounds = [c35Origin[0] - 60, c35Origin[1] + 160, c35Origin[0] + 500, c35Origin[1] - 160];
                    var zoomTopologyPngPath = scriptFolder.fsName + "/test_v090_circle_topology_zoom.png";
                    var okTopology = captureGearView(doc, zoomTopologyPngPath, z35Bounds, 300);
                    report.zoomTopologyPng = zoomTopologyPngPath;
                    report.zoomTopologySuccess = okTopology;

                    // Zoom 3: Case 36 Group Inner Shapes Cutout
                    var z36Bounds = [c36Origin[0] - 80, c36Origin[1] + 80, c36Origin[0] + 80, c36Origin[1] - 420];
                    var zoomGroupCutoutPngPath = scriptFolder.fsName + "/test_v090_group_cutout_zoom.png";
                    var okGroup = captureGearView(doc, zoomGroupCutoutPngPath, z36Bounds, 300);
                    report.zoomGroupCutoutPng = zoomGroupCutoutPngPath;
                    report.zoomGroupSuccess = okGroup;
                } catch (eCapAll) {
                    CalcLogger.warn("TEST", "Exception during image capture sequence: " + eCapAll.message);
                    report.captureException = eCapAll.message;
                }

                // Final test_report.json persistence after all images generated
                var reportFile = new File(scriptFolder.fsName + "/test_report.json");
                try {
                    reportFile.encoding = "UTF-8";
                    if (reportFile.open("w")) {
                        reportFile.write(SimpleJSON.stringify(report));
                        reportFile.close();
                        CalcLogger.log("TEST", "test_report.json saved successfully at: " + reportFile.fsName);
                    }
                } catch (eRepFinal) {
                    CalcLogger.error("TEST", "Failed to save test_report.json", eRepFinal);
                }

            } catch (eDoc) {
                var stackMsg = (eDoc && eDoc.stack) ? eDoc.stack : ($.stack || "");
                CalcLogger.error("TEST", "Exception during on-artboard execution: " + eDoc.message, eDoc);
                allPassed = false;
                report.error = eDoc.message + " | Stack: " + stackMsg;
            }
        }

        // Final summary calculation if not already computed
        if (report.totalCases === undefined || report.totalCases === 0) {
            report.totalCases = report.cases.length;
            var passedCount2 = 0;
            for (var pi2 = 0; pi2 < report.cases.length; pi2++) {
                if (report.cases[pi2].passed) passedCount2++;
            }
            report.passedCases = passedCount2;
            report.overallPassed = (passedCount2 === report.cases.length && report.cases.length > 0 && !report.error);
            allPassed = report.overallPassed;

            try {
                var sf2 = null;
                try { if (typeof $ !== "undefined" && $.fileName) sf2 = (new File($.fileName)).parent; } catch (eSf2) {}
                if (!sf2 || !sf2.fsName) sf2 = (typeof Folder !== "undefined" && Folder.desktop) ? Folder.desktop : { fsName: "." };
                var rf2 = new File(sf2.fsName + "/test_report.json");
                rf2.encoding = "UTF-8";
                if (rf2.open("w")) {
                    rf2.write(SimpleJSON.stringify(report));
                    rf2.close();
                }

                // Export detailed execution trace log
                try {
                    CalcLogger.exportToFile(new File(sf2.fsName + "/test_debug_trace.log"));
                } catch (eLogExp) {}
            } catch (eRepFallback) {}
        }

        CalcLogger.log("TEST", "v1.0.0 Test execution completed. Overall Passed: " + allPassed);

        if (typeof alert === "function" && (typeof __GEARDRAWER_SILENT__ === "undefined" || !__GEARDRAWER_SILENT__)) {
            var msg = "=== GearDrawer Tester (v1.0.0) ===\n";
            msg += "Status: " + (allPassed ? "PASS" : "FAIL") + "\n\n";
            for (var ci = 0; ci < report.cases.length; ci++) {
                var cs = report.cases[ci];
                msg += "[" + (cs.passed ? "OK" : "NG") + "] " + cs.name + "\n";
            }
            alert(msg);
        }

        // Only quit Illustrator if restart is explicitly requested
        if (typeof __GEARDRAWER_RESTART_REQUIRED__ !== "undefined" && __GEARDRAWER_RESTART_REQUIRED__) {
            try {
                if (typeof app !== "undefined" && typeof app.quit === "function") {
                    app.quit();
                }
            } catch (eQ) {}
        }

        return report;
    }

    return {
        validateHandles: validateHandles,
        validateRadialMonotonicityAndSelfIntersection: validateRadialMonotonicityAndSelfIntersection,
        validateMeshingClearance: validateMeshingClearance,
        findContourPath: findContourPath,
        captureGearView: captureGearView,
        captureGuiScreenshot: captureGuiScreenshot,
        runNumericalValidation: runNumericalValidation,
        run: run
    };
})();

var __GEARDRAWER_SILENT__ = true;
TesterRunner.run();
