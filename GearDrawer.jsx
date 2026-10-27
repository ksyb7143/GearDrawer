/**
 * GearDrawer - Involute Spur Gear Generator for Adobe Illustrator
 * Version: 0.9.37
 * Author: Pair-programmed with Antigravity AI
 * License: MIT
 * 
 * Generates mathematically accurate, meshing involute spur gear pairs
 * with true generating trochoid root fillets, tailored for laser cutting,
 * CNC milling, and physical mechanism fabrication.
 * 
 * Supports:
 * - Pure theoretical geometry calculation (Approach 1: Kerf separation)
 * - Cubic Bezier curve optimization (Recommended: 8-10 pts/tooth, Minimal: 6 pts/tooth)
 * - Test mode (Individual teeth x z + Root Circle + Shaft Hole)
 * - Disassembled test mode (Tip arc, Involutes, Trochoid fillets as independent paths)
 */

#target illustrator

// Global conversion constants
var MM_TO_PT = 72.0 / 25.4; // 1 mm = 2.83464567 pt
var PT_TO_MM = 25.4 / 72.0; // 1 pt = 0.35277778 mm

/**
 * CalcLogger.jsxinc - Calculation & Diagnostic Logging Module for GearDrawer
 * Version: 0.9.0
 * 
 * Provides execution trace recording, geometric calculation verification,
 * and error reporting capabilities.
 * 
 * Supports:
 * - In-memory structured trace collection
 * - ExtendScript console output ($.writeln)
 * - Formatted text log generation
 * - Export to hidden document layer (_GEAR_CALC_LOG)
 * - Export to text file on disk (Folder.desktop or document folder)
 * - Interactive ScriptUI Log Viewer dialog for copy-pasting bug reports
 * 
 * All UI labels and text are Unicode-escaped for 100% environment compatibility.
 */

var CalcLogger = (function () {
    var _enabled = false;
    var _entries = [];
    var _startTime = null;
    var _version = "0.9.0";

    function setVersion(ver) {
        _version = ver || "0.9.0";
    }

    function init(enabled) {
        _enabled = !!enabled;
        _entries = [];
        _startTime = new Date();
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
            if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
                return JSON.stringify(data);
            }
        } catch (e) {}

        // Fallback serializer for ES3 / ExtendScript
        try {
            if (data instanceof Array) {
                var arrStr = [];
                for (var i = 0; i < data.length; i++) {
                    arrStr.push(serializeData(data[i]));
                }
                return "[" + arrStr.join(", ") + "]";
            }
            if (typeof data === "object") {
                var pairs = [];
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        pairs.push(k + ":" + serializeData(data[k]));
                    }
                }
                return "{" + pairs.join(", ") + "}";
            }
        } catch (e2) {}
        return String(data);
    }

    function log(category, message, data) {
        // Always record entries so emergency crash logs can be retrieved even if user didn't check option
        var timestamp = new Date();
        var elapsedMs = _startTime ? (timestamp.getTime() - _startTime.getTime()) : 0;
        var entry = {
            elapsedMs: elapsedMs,
            category: category || "INFO",
            message: message,
            dataStr: (data !== undefined) ? serializeData(data) : null
        };
        _entries.push(entry);

        // Mirror to ExtendScript debug console if available
        try {
            if (typeof $ !== "undefined" && typeof $.writeln === "function") {
                var line = "[" + category + " +" + elapsedMs + "ms] " + message;
                if (entry.dataStr) line += " | " + entry.dataStr;
                $.writeln(line);
            }
        } catch (e) {}
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
        log("ERROR:" + category, message + (detail ? " -> " + detail : ""), err);
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
        } catch (e) {}
        lines.push("================================================================================");
        lines.push("");

        for (var i = 0; i < _entries.length; i++) {
            var e = _entries[i];
            var prefix = "[" + pad(e.elapsedMs, 5) + "ms] [" + padRight(e.category, 20) + "] ";
            lines.push(prefix + e.message);
            if (e.dataStr) {
                lines.push("            DATA: " + e.dataStr);
            }
        }
        lines.push("");
        lines.push("================================================================================");
        lines.push(" End of Log (" + _entries.length + " events recorded)");
        lines.push("================================================================================");
        return lines.join("\n");
    }

    function exportToFile(targetFolder) {
        try {
            if (typeof Folder === "undefined" || typeof File === "undefined") {
                return null;
            }

            var fObj = null;
            if (targetFolder) {
                if (typeof targetFolder === "string") {
                    fObj = new Folder(targetFolder);
                } else if (targetFolder instanceof Folder) {
                    fObj = targetFolder;
                }
            }
            if (!fObj || !fObj.exists) {
                try {
                    if (fObj && typeof fObj.create === "function") {
                        fObj.create();
                    }
                } catch (eF) {}
            }
            if (!fObj || !fObj.exists) {
                try {
                    if (typeof app !== "undefined" && app.documents && app.documents.length > 0 && app.activeDocument.saved) {
                        fObj = app.activeDocument.path;
                    }
                } catch (eDoc) {}
            }
            if (!fObj || !fObj.exists) {
                fObj = Folder.desktop;
            }

            var now = new Date();
            var y = now.getFullYear();
            var m = ("0" + (now.getMonth() + 1)).slice(-2);
            var d = ("0" + now.getDate()).slice(-2);
            var h = ("0" + now.getHours()).slice(-2);
            var min = ("0" + now.getMinutes()).slice(-2);
            var s = ("0" + now.getSeconds()).slice(-2);
            var filename = "GearDrawer_Log_" + y + m + d + "_" + h + min + s + ".txt";

            var file = new File(fObj.fsName + "/" + filename);
            file.encoding = "UTF-8";
            if (file.open("w")) {
                file.write(dumpText());
                file.close();
                return file.fsName;
            }
        } catch (err) {}
        return null;
    }

    function showLogWindow(title, headerMsg) {
        try {
            if (typeof Window === "undefined") return;

            var win = new Window("dialog", title || "\u8a08\u7b97\u904e\u7a0b\u30ed\u30b0 (Calculation Log)");
            win.orientation = "column";
            win.alignChildren = ["fill", "top"];
            win.spacing = 8;
            win.margins = 10;

            if (headerMsg) {
                var lblHeader = win.add("statictext", undefined, headerMsg, { multiline: true });
                lblHeader.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.8, 0.2, 0.2, 1], 1);
            }

            var etLog = win.add("edittext", undefined, dumpText(), { multiline: true, scrolling: true });
            etLog.preferredSize = [600, 360];

            var grpActions = win.add("group");
            grpActions.orientation = "row";
            grpActions.alignChildren = ["right", "center"];

            var btnSave = grpActions.add("button", undefined, "\u30c6\u30ad\u30b9\u30c8\u30d5\u30a1\u30a4\u30eb\u306b\u4fdd\u5b58...");
            var btnClose = grpActions.add("button", undefined, "\u9589\u3058\u308b", { name: "ok" });

            btnSave.onClick = function () {
                var selectedFolder = Folder.selectDialog("\u30ed\u30b0\u30d5\u30a1\u30a4\u30eb\u306e\u4fdd\u5b58\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e");
                var path = exportToFile(selectedFolder);
                if (path) {
                    alert("\u8a08\u7b97\u30ed\u30b0\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f:\n" + path);
                } else {
                    alert("\u30ed\u30b0\u30d5\u30a1\u30a4\u30eb\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
                }
            };

            btnClose.onClick = function () {
                win.close();
            };

            win.show();
        } catch (e) {}
    }

    return {
        init: init,
        isEnabled: isEnabled,
        setEnabled: setEnabled,
        clear: clear,
        setVersion: setVersion,
        log: log,
        warn: warn,
        error: error,
        getEntries: function () { return _entries; },
        dumpText: dumpText,
        exportToFile: exportToFile,
        showLogWindow: showLogWindow
    };
})();

/**
 * InvoluteMath.jsxinc - Complete Involute Mechanism Math Engine (Modular Facade)
 * Version: 0.9.16
 * Part of GearDrawer Architecture (JIS B 1701 / JIS B 0003)
 * 
 * Aggregates:
 * - InvoluteCore.jsxinc (Pure Involute & Trochoid Geometry, Bezier Optimization)
 * - MechanismSolvers.jsxinc (Planetary & Paradoxical Inverse Search Solvers)
 * - TopologySolver.jsxinc (Circle Object Geometry & Multi-layer Topology Engine)
 * - TrainTreeResolver.jsxinc (Branched Gear Train Kinematics & Node Expansion)
 */

/**
 * InvoluteCore.jsxinc - Pure Involute Gear Geometry & Curve Fitting
 * Part of GearDrawer Architecture (JIS B 1701 / JIS B 0003)
 */

var InvoluteMath = InvoluteMath || {};

(function (exports) {
// Global conversion constants & helpers
var MM_TO_PT = 72.0 / 25.4;
var PT_TO_MM = 25.4 / 72.0;

function logTrace(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.log(category, msg, data);
    }
}

function logWarn(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.warn(category, msg, data);
    }
}

    /**
     * Involute function: inv(alpha) = tan(alpha) - alpha
     */
    function inv(alphaRad) {
        return Math.tan(alphaRad) - alphaRad;
    }

    /**
     * Inverse involute function: solve tan(alpha) - alpha = val for alpha (rad)
     * Uses Newton-Raphson method with cubic root initial estimate.
     */
    function invInv(val) {
        if (val <= 0) return 0.0;
        var a = Math.pow(3.0 * val, 1.0 / 3.0);
        for (var iter = 0; iter < 20; iter++) {
            var t = Math.tan(a);
            var f = t - a - val;
            var f_prime = t * t;
            if (Math.abs(f_prime) < 1e-12) break;
            var da = f / f_prime;
            a -= da;
            if (Math.abs(da) < 1e-12) break;
        }
        return a;
    }

    /**
     * Dynamic undercut limit tooth count
     * z_min = 2 / (sin(alpha)^2)
     */
    function getUndercutLimit(alphaRad) {
        var sinA = Math.sin(alphaRad);
        return 2.0 / (sinA * sinA);
    }

    // === SHAFT HOLE & KEYWAY GEOMETRY (JIS B 1301 / D-CUT) ===
    var JIS_B_1301_TABLE = [
        { dMax: 6,   b2: 1.5, t2: 0.8 },
        { dMax: 8,   b2: 2.0, t2: 1.0 },
        { dMax: 10,  b2: 3.0, t2: 1.4 },
        { dMax: 12,  b2: 4.0, t2: 1.8 },
        { dMax: 17,  b2: 5.0, t2: 2.3 },
        { dMax: 22,  b2: 6.0, t2: 2.8 },
        { dMax: 30,  b2: 8.0, t2: 3.3 },
        { dMax: 38,  b2: 10.0, t2: 3.3 },
        { dMax: 44,  b2: 12.0, t2: 3.3 },
        { dMax: 50,  b2: 14.0, t2: 3.8 },
        { dMax: 58,  b2: 16.0, t2: 4.3 },
        { dMax: 65,  b2: 18.0, t2: 4.4 },
        { dMax: 75,  b2: 20.0, t2: 4.9 },
        { dMax: 85,  b2: 22.0, t2: 5.4 }
    ];

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

    function getDCutDepth(shaftDiameter, customDepth) {
        if (customDepth !== undefined && !isNaN(customDepth) && customDepth > 0) {
            return customDepth;
        }
        var d = parseFloat(shaftDiameter) || 0;
        if (d <= 0) return 0;
        var h = Math.round(d * 0.10 * 10) / 10;
        if (h < 0.5) h = 0.5;
        if (h >= d * 0.45) h = d * 0.45;
        return h;
    }

    function normalizeShaftType(typeStr) {
        if (!typeStr) return "ROUND";
        var s = String(typeStr).toLowerCase();
        if (s.indexOf("d-cut") !== -1 || s.indexOf("dカット") !== -1 || s.indexOf("dcut") !== -1) {
            return "DCUT";
        }
        if (s.indexOf("keyway") !== -1 || s.indexOf("キー溝") !== -1 || s.indexOf("key") !== -1) {
            return "KEYWAY";
        }
        if (s.indexOf("none") !== -1 || s.indexOf("なし") !== -1) {
            return "NONE";
        }
        return "ROUND";
    }

    function createArcBezierNodes(R, thetaStart, thetaEnd) {
        var delta = thetaEnd - thetaStart;
        while (delta < 0) delta += 2 * Math.PI;
        if (delta < 1e-6) return [];

        var nSeg = Math.ceil(delta / (Math.PI / 2.0));
        var dTheta = delta / nSeg;
        var k = (4.0 / 3.0) * Math.tan(dTheta / 4.0);

        var nodes = [];
        for (var i = 0; i <= nSeg; i++) {
            var th = thetaStart + i * dTheta;
            var cosT = Math.cos(th);
            var sinT = Math.sin(th);
            var ax = R * cosT;
            var ay = R * sinT;

            var inX = ax + R * k * sinT;
            var inY = ay - R * k * cosT;
            var outX = ax - R * k * sinT;
            var outY = ay + R * k * cosT;

            nodes.push({
                anchor: [Math.round(ax * 10000) / 10000, Math.round(ay * 10000) / 10000],
                leftDirection: [Math.round(inX * 10000) / 10000, Math.round(inY * 10000) / 10000],
                rightDirection: [Math.round(outX * 10000) / 10000, Math.round(outY * 10000) / 10000],
                theta: th
            });
        }
        return nodes;
    }

    /**
     * Generates Bezier nodes for a concave locking pocket (shoe) on a driven intermittent gear.
     * The pocket is a circular arc of radius R_shoe centered at (-a, 0) relative to driven center (0,0).
     * Intersects with driven outer boundary R_outer (e.g. tip circle ra).
     * Progression is strictly COUNTER-CLOCKWISE (CCW) along the driven gear perimeter:
     * Entry (upper, phi = +phi_half) -> Mid (phi = 0) -> Exit (lower, phi = -phi_half).
     */
    function createConcaveLockArcNodes(a, R_shoe, R_outer) {
        if (a <= 0 || R_shoe <= 0 || R_outer <= 0) return { nodes: [], deltaAngle: 0, length: 0 };
        // Two-circle intersection:
        // (x + a)^2 + y^2 = R_shoe^2
        // x^2 + y^2 = R_outer^2
        // => 2ax = R_shoe^2 - a^2 - R_outer^2
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
        // Tangent vector in direction of CCW along driven perimeter (decreasing phi):
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
                anchor: [Math.round(ptEntry[0] * 10000) / 10000, Math.round(ptEntry[1] * 10000) / 10000],
                leftDirection: [Math.round(ptEntry[0] * 10000) / 10000, Math.round(ptEntry[1] * 10000) / 10000],
                rightDirection: [Math.round((ptEntry[0] + L_handle * tanEntry[0]) * 10000) / 10000, Math.round((ptEntry[1] + L_handle * tanEntry[1]) * 10000) / 10000],
                pointType: "CORNER"
            },
            {
                anchor: [Math.round(ptMid[0] * 10000) / 10000, Math.round(ptMid[1] * 10000) / 10000],
                leftDirection: [Math.round((ptMid[0] - L_handle * tanMid[0]) * 10000) / 10000, Math.round((ptMid[1] - L_handle * tanMid[1]) * 10000) / 10000],
                rightDirection: [Math.round((ptMid[0] + L_handle * tanMid[0]) * 10000) / 10000, Math.round((ptMid[1] + L_handle * tanMid[1]) * 10000) / 10000],
                pointType: "SMOOTH"
            },
            {
                anchor: [Math.round(ptExit[0] * 10000) / 10000, Math.round(ptExit[1] * 10000) / 10000],
                leftDirection: [Math.round((ptExit[0] - L_handle * tanExit[0]) * 10000) / 10000, Math.round((ptExit[1] - L_handle * tanExit[1]) * 10000) / 10000],
                rightDirection: [Math.round(ptExit[0] * 10000) / 10000, Math.round(ptExit[1] * 10000) / 10000],
                pointType: "CORNER"
            }
        ];

        nodes.deltaAngle = deltaAngle;
        nodes.nodes = nodes;
        return nodes;
    }

    function calculateShaftHoleGeometry(shaftDiameter, shaftTypeStr, options) {
        options = options || {};
        var d = parseFloat(shaftDiameter) || 0;
        var type = normalizeShaftType(shaftTypeStr);

        if (d <= 0 || type === "NONE") {
            return {
                hasHole: false,
                shaftDiameter: 0,
                shaftType: "NONE",
                nodes: [],
                points: [],
                bounds: { width: 0, height: 0 }
            };
        }

        var R = d / 2.0;
        var nodes = [];
        var points = [];

        if (type === "ROUND") {
            var k = (4.0 / 3.0) * (Math.SQRT2 - 1.0) * R;
            nodes.push({
                anchor: [R, 0],
                leftDirection: [R, -k],
                rightDirection: [R, k]
            });
            nodes.push({
                anchor: [0, R],
                leftDirection: [k, R],
                rightDirection: [-k, R]
            });
            nodes.push({
                anchor: [-R, 0],
                leftDirection: [-R, k],
                rightDirection: [-R, -k]
            });
            nodes.push({
                anchor: [0, -R],
                leftDirection: [-k, -R],
                rightDirection: [k, -R]
            });

            for (var p = 0; p < 36; p++) {
                var th = (p / 36.0) * 2 * Math.PI;
                points.push([
                    Math.round(R * Math.cos(th) * 10000) / 10000,
                    Math.round(R * Math.sin(th) * 10000) / 10000
                ]);
            }

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "ROUND",
                nodes: nodes,
                points: points,
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

            var leftCornerNode = {
                anchor: [-xc, yc],
                leftDirection: [-xc, yc],
                rightDirection: arcNodes[0].rightDirection
            };

            var rightCornerNode = {
                anchor: [xc, yc],
                leftDirection: arcNodes[arcNodes.length - 1].leftDirection,
                rightDirection: [xc, yc]
            };

            nodes.push(rightCornerNode);
            nodes.push(leftCornerNode);

            for (var a = 1; a < arcNodes.length - 1; a++) {
                nodes.push({
                    anchor: arcNodes[a].anchor,
                    leftDirection: arcNodes[a].leftDirection,
                    rightDirection: arcNodes[a].rightDirection
                });
            }

            points.push([Math.round(xc * 10000) / 10000, Math.round(yc * 10000) / 10000]);
            points.push([Math.round(-xc * 10000) / 10000, Math.round(yc * 10000) / 10000]);
            var nArcPts = 32;
            var arcSpan = (2 * Math.PI + th1) - th2;
            for (var ap = 1; ap < nArcPts; ap++) {
                var ath = th2 + (ap / nArcPts) * arcSpan;
                points.push([
                    Math.round(R * Math.cos(ath) * 10000) / 10000,
                    Math.round(R * Math.sin(ath) * 10000) / 10000
                ]);
            }

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "DCUT",
                dCutDepth: h,
                flatThickness: d - h,
                nodes: nodes,
                points: points,
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
                rightDirection: [halfB, yk]
            };
            var k2Node = {
                anchor: [halfB, yTop],
                leftDirection: [halfB, yTop],
                rightDirection: [halfB, yTop]
            };
            var k3Node = {
                anchor: [-halfB, yTop],
                leftDirection: [-halfB, yTop],
                rightDirection: [-halfB, yTop]
            };
            var k4Node = {
                anchor: [-halfB, yk],
                leftDirection: [-halfB, yk],
                rightDirection: arcNodes[0].rightDirection
            };

            nodes.push(k1Node);
            nodes.push(k2Node);
            nodes.push(k3Node);
            nodes.push(k4Node);

            for (var ka = 1; ka < arcNodes.length - 1; ka++) {
                nodes.push({
                    anchor: arcNodes[ka].anchor,
                    leftDirection: arcNodes[ka].leftDirection,
                    rightDirection: arcNodes[ka].rightDirection
                });
            }

            points.push([Math.round(halfB * 10000) / 10000, Math.round(yk * 10000) / 10000]);
            points.push([Math.round(halfB * 10000) / 10000, Math.round(yTop * 10000) / 10000]);
            points.push([Math.round(-halfB * 10000) / 10000, Math.round(yTop * 10000) / 10000]);
            points.push([Math.round(-halfB * 10000) / 10000, Math.round(yk * 10000) / 10000]);

            var nArcPts = 32;
            var arcSpan = (2 * Math.PI + th1) - th4;
            for (var ap = 1; ap < nArcPts; ap++) {
                var ath = th4 + (ap / nArcPts) * arcSpan;
                points.push([
                    Math.round(R * Math.cos(ath) * 10000) / 10000,
                    Math.round(R * Math.sin(ath) * 10000) / 10000
                ]);
            }

            return {
                hasHole: true,
                shaftDiameter: d,
                shaftType: "KEYWAY",
                b2: b2,
                t2: t2,
                nodes: nodes,
                points: points,
                bounds: { width: d, height: R + yTop }
            };
        }

        return {
            hasHole: false,
            shaftDiameter: 0,
            shaftType: "NONE",
            nodes: [],
            points: []
        };
    }

    function calculateAlignmentPinHoles(rfMm, shaftDiameterMm, options) {
        options = options || {};
        var pinCount = options.pinCount || 2;
        var pinDia = options.pinDiameter || 2.0;
        var rShaft = (shaftDiameterMm || 0) / 2.0;
        var rPitch = options.pinPitchRadius || ((rShaft + rfMm) / 2.0);
        var marginInner = (rPitch - pinDia / 2.0) - rShaft;
        var marginOuter = rfMm - (rPitch + pinDia / 2.0);
        if (marginInner < 0.5 || marginOuter < 0.5) {
            return { valid: false, reason: "Insufficient margin for pin holes" };
        }
        var holes = [];
        var baseAngle = options.baseAngleRad || 0;
        for (var i = 0; i < pinCount; i++) {
            var ang = baseAngle + (i * 2 * Math.PI / pinCount);
            holes.push({
                center: [Math.round(rPitch * Math.cos(ang) * 10000) / 10000, Math.round(rPitch * Math.sin(ang) * 10000) / 10000],
                diameter: pinDia,
                radius: pinDia / 2.0
            });
        }
        return { valid: true, holes: holes, pitchRadius: rPitch, diameter: pinDia };
    }

    /**
     * Calculate tooth profile coordinates and Bezier nodes for a spur gear.
     * 
     * @param {Object} params
     *   - m: Module (mm)
     *   - z: Number of teeth
     *   - x: Profile shift coefficient (default 0.0)
     *   - alphaDeg: Pressure angle (deg, usually 20)
     *   - backlash: Circumferential backlash (mm, default 0.0)
     *   - shaftDiameter: Shaft hole diameter (mm, 0 for none)
     *   - useFillet: boolean (default true)
     *   - rcFactor: Tool tip radius factor (default 0.38)
     *   - pathQuality: "bezier_recommended" (default) | "bezier_minimal" | "polyline"
     */
    function calculateSpurGear(params) {
        var m = params.m;
        var z = params.z;
        var x = params.x || 0.0;
        var alphaDeg = params.alphaDeg || 20;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var backlash = params.backlash || 0.0;
        var shaftDiameter = params.shaftDiameter || 0.0;
        var useFillet = (params.useFillet !== false);
        var rcFactor = params.rcFactor || 0.38;
        var pathQuality = params.pathQuality || "bezier_recommended"; // "bezier_recommended" | "bezier_minimal" | "polyline"

        // Pure standard dimensions (mm) with profile shift x - JIS B 1701-1
        var d = m * z;
        var db = d * Math.cos(alpha);
        var da = (params.da !== undefined) ? params.da : (m * (z + 2.0 + 2.0 * x));
        var df = (params.df !== undefined) ? params.df : (m * (z - 2.5 + 2.0 * x));

        var rp = d / 2.0;
        var rb = db / 2.0;
        var ra = da / 2.0;
        var rf = df / 2.0;

        logTrace("SPUR_GEAR", "Calculated spur gear dimensions", {
            m: m, z: z, x: x, alphaDeg: alphaDeg,
            d: Math.round(d * 1000) / 1000,
            da: Math.round(da * 1000) / 1000,
            df: Math.round(df * 1000) / 1000,
            db: Math.round(db * 1000) / 1000,
            backlash: backlash,
            shaftDiameter: shaftDiameter
        });

        // Effective tooth thickness on pitch circle considering profile shift x & backlash
        var s_eff = (Math.PI * m / 2.0) + (2.0 * x * m * Math.tan(alpha)) - backlash;
        var psi_p = s_eff / (2.0 * rp); // Half-tooth angle on pitch circle

        var invAlpha = inv(alpha);

        // --- 1. Involute function for right flank (r >= rb) ---
        function getInvolutePoint(r) {
            var cosA = Math.min(1.0, rb / Math.max(rb, r));
            var alphaR = Math.acos(cosA);
            var invR = inv(alphaR);
            var theta = psi_p + invAlpha - invR;

            // Rigorous analytical unit tangent vector pointing outward (r increasing):
            // dx/dalphaR = rb * (sin alphaR / cos^3 alphaR) * cos(theta - alphaR)
            // dy/dalphaR = rb * (sin alphaR / cos^3 alphaR) * sin(theta - alphaR)
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

        // --- 2. Generating Trochoid function for right flank fillet ---
        var rc = rcFactor * m;
        var hk = 1.25 * m;
        var vc = hk - x * m - rc;
        var w = (Math.PI * m - s_eff) / 2.0;
        // Rigorous rack corner arc center coordinate uc:
        // Distance from center (uc, vc) to straight cutting edge (u + v*tan(alpha) = w) must strictly equal rc:
        // (w - uc - vc*tan(alpha))*cos(alpha) = rc  ==>  uc = w - vc*tan(alpha) - rc/cos(alpha)
        var uc = w - vc * Math.tan(alpha) - rc / Math.cos(alpha);

        function getTrochoidPoint(phi) {
            var psi = (Math.PI / z) - phi;
            var Uc = -uc + rp * phi;
            var L = Math.sqrt(Uc * Uc + vc * vc);

            var r_er = (rp - vc) - rc * (vc / L);
            var r_et = Uc * (1.0 + rc / L);

            var x = r_er * Math.cos(psi) - r_et * Math.sin(psi);
            var y = r_er * Math.sin(psi) + r_et * Math.cos(psi);

            var r = Math.sqrt(x * x + y * y);
            var theta = Math.atan2(y, x);

            // Unit normal: (-vc * er + Uc * et) / L
            var nx = (-vc * Math.cos(psi) - Uc * Math.sin(psi)) / L;
            var ny = (-vc * Math.sin(psi) + Uc * Math.cos(psi)) / L;
            // Unit tangent along curve towards junction (increasing r / decreasing phi):
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

        var phi_root = uc / rp;

        // Tangency point on rack between straight cutting edge and corner arc:
        // Envelope condition for point K (normal angle = alpha): Uc_tangent = -vc * cot(alpha) = -vc / tan(alpha)
        var Uc_tangent = -vc / Math.tan(alpha);
        var phi_tangent = (Uc_tangent + uc) / rp;
        var pTangent = getTrochoidPoint(phi_tangent);

        // Theoretical undercut limit tooth count considering profile shift x
        var z_undercut_limit = (2.0 * (1.0 - x)) / (Math.sin(alpha) * Math.sin(alpha));
        var isUndercut = (z < z_undercut_limit);

        // --- 3. Determine exact junction between Fillet and Involute ---
        var junctionPhi = phi_tangent;
        var junctionR = pTangent.r;

        if (useFillet) {
            if (isUndercut) {
                // For undercut gears, corner radius or straight cutting edge sweeps into involute zone (r > rb)
                var phi_a = phi_root;
                var phi_b = phi_root - (50.0 * Math.PI / 180.0);
                var searchSteps = 1000;
                var prevDiff = null;
                var prevPhi = null;

                for (var s = 0; s <= searchSteps; s++) {
                    var phi = phi_a + (phi_b - phi_a) * (s / searchSteps);
                    var tp = getTrochoidPoint(phi);

                    if (tp.r >= rb && tp.r <= ra) {
                        var ip = getInvolutePoint(tp.r);
                        var diff = tp.theta - ip.theta;

                        if (prevDiff !== null && ((prevDiff < 0 && diff >= 0) || (prevDiff > 0 && diff <= 0))) {
                            var lowPhi = prevPhi;
                            var highPhi = phi;
                            for (var bisect = 0; bisect < 20; bisect++) {
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
                // For non-undercut gears, corner fillet strictly ends at tangency point!
                // Straight cutting edge generates pure involute above pTangent.r
                junctionPhi = phi_tangent;
                junctionR = pTangent.r;
            }
        }

        // --- 4. Cubic Bezier Segment Fitting Utility ---
        function fitBezierSegment(P0, P3, Pm) {
            var chord = Math.sqrt(Math.pow(P3.x - P0.x, 2) + Math.pow(P3.y - P0.y, 2));
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

        function mirrorSeg(seg) {
            return {
                P0: { x: seg.P0.x, y: -seg.P0.y },
                P1: { x: seg.P1.x, y: -seg.P1.y },
                P2: { x: seg.P2.x, y: -seg.P2.y },
                P3: { x: seg.P3.x, y: -seg.P3.y }
            };
        }

        // --- 5. Build Bezier Segments for Recommended or Minimal ---
        var pRightRoot = getTrochoidPoint(phi_root);
        var pRightJunc = useFillet ? getTrochoidPoint(junctionPhi) : { x: rb * Math.cos(psi_p + invAlpha), y: rb * Math.sin(psi_p + invAlpha), tx: 0, ty: 1, r: rb };
        var pRightTip = getInvolutePoint(ra);

        var rightFilletSegs = [];
        if (useFillet) {
            if (pathQuality === "bezier_recommended" && isUndercut) {
                var phiMid = (phi_root + junctionPhi) / 2.0;
                var pRightFilletMid = getTrochoidPoint(phiMid);
                rightFilletSegs.push(fitBezierSegment(pRightRoot, pRightFilletMid, getTrochoidPoint((phi_root + phiMid) / 2.0)));
                rightFilletSegs.push(fitBezierSegment(pRightFilletMid, pRightJunc, getTrochoidPoint((phiMid + junctionPhi) / 2.0)));
            } else {
                var pRightFilletMidSingle = getTrochoidPoint((phi_root + junctionPhi) / 2.0);
                rightFilletSegs.push(fitBezierSegment(pRightRoot, pRightJunc, pRightFilletMidSingle));
            }
        } else {
            // Straight radial fallback segment
            var pRootRadial = { x: rf * Math.cos(pRightJunc.theta), y: rf * Math.sin(pRightJunc.theta), tx: Math.cos(pRightJunc.theta), ty: Math.sin(pRightJunc.theta) };
            rightFilletSegs.push({
                P0: pRootRadial,
                P1: { x: pRootRadial.x + (pRightJunc.x - pRootRadial.x)/3.0, y: pRootRadial.y + (pRightJunc.y - pRootRadial.y)/3.0 },
                P2: { x: pRightJunc.x - (pRightJunc.x - pRootRadial.x)/3.0, y: pRightJunc.y - (pRightJunc.y - pRootRadial.y)/3.0 },
                P3: pRightJunc
            });
        }

        var rightInvSegs = [];
        if (pathQuality === "bezier_recommended") {
            var rMidInv = (junctionR + ra) / 2.0;
            var pRightInvMid = getInvolutePoint(rMidInv);
            rightInvSegs.push(fitBezierSegment(pRightJunc, pRightInvMid, getInvolutePoint((junctionR + rMidInv) / 2.0)));
            rightInvSegs.push(fitBezierSegment(pRightInvMid, pRightTip, getInvolutePoint((rMidInv + ra) / 2.0)));
        } else {
            var pRightInvMidSingle = getInvolutePoint((junctionR + ra) / 2.0);
            rightInvSegs.push(fitBezierSegment(pRightJunc, pRightTip, pRightInvMidSingle));
        }

        // Tip Arc Segments (split in half with midpoint anchor on symmetry axis)
        var dThTip = 2.0 * pRightTip.theta;
        var halfDThTip = pRightTip.theta;
        var L_halfTip = (4.0 / 3.0) * ra * Math.tan(halfDThTip / 4.0);
        var pLeftTip = { x: pRightTip.x, y: -pRightTip.y };
        var pMidTip = { x: ra, y: 0.0 };

        // Left half tip arc: pLeftTip -> pMidTip
        var tipArcSegLeft = {
            P0: pLeftTip,
            P1: { x: pLeftTip.x + L_halfTip * Math.sin(pRightTip.theta), y: pLeftTip.y + L_halfTip * Math.cos(pRightTip.theta) },
            P2: { x: pMidTip.x, y: pMidTip.y - L_halfTip },
            P3: pMidTip
        };

        // Right half tip arc: pMidTip -> pRightTip
        var tipArcSegRight = {
            P0: pMidTip,
            P1: { x: pMidTip.x, y: pMidTip.y + L_halfTip },
            P2: { x: pRightTip.x + L_halfTip * Math.sin(pRightTip.theta), y: pRightTip.y - L_halfTip * Math.cos(pRightTip.theta) },
            P3: pRightTip
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

        // --- 6. Assemble singleToothNodes (Bezier format) ---
        var singleToothNodes = [];

        // 1. Left Root
        singleToothNodes.push({
            anchor: [leftFilletSegs[0].P0.x, leftFilletSegs[0].P0.y],
            leftDirection: [leftFilletSegs[0].P0.x, leftFilletSegs[0].P0.y], // filled in full contour
            rightDirection: [leftFilletSegs[0].P1.x, leftFilletSegs[0].P1.y],
            pointType: "SMOOTH"
        });

        // Left Fillet intermediates:
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

        // Left Involute intermediates:
        for (var i = 0; i < leftInvSegs.length - 1; i++) {
            var sCur = leftInvSegs[i];
            var sNxt = leftInvSegs[i + 1];
            singleToothNodes.push({
                anchor: [sCur.P3.x, sCur.P3.y],
                leftDirection: [sCur.P2.x, sCur.P2.y],
                rightDirection: [sNxt.P1.x, sNxt.P1.y],
                pointType: "SMOOTH"
            });
        }

        // Left Tip Corner:
        var lastLInv = leftInvSegs[leftInvSegs.length - 1];
        singleToothNodes.push({
            anchor: [lastLInv.P3.x, lastLInv.P3.y],
            leftDirection: [lastLInv.P2.x, lastLInv.P2.y],
            rightDirection: [tipArcSegLeft.P1.x, tipArcSegLeft.P1.y],
            pointType: "CORNER"
        });

        // Mid Tip Anchor (centered on symmetry axis theta = 0):
        singleToothNodes.push({
            anchor: [pMidTip.x, pMidTip.y],
            leftDirection: [tipArcSegLeft.P2.x, tipArcSegLeft.P2.y],
            rightDirection: [tipArcSegRight.P1.x, tipArcSegRight.P1.y],
            pointType: "SMOOTH"
        });

        // Right Tip Corner:
        var lastRInv = rightInvSegs[rightInvSegs.length - 1];
        singleToothNodes.push({
            anchor: [pRightTip.x, pRightTip.y],
            leftDirection: [tipArcSegRight.P2.x, tipArcSegRight.P2.y],
            rightDirection: [lastRInv.P2.x, lastRInv.P2.y],
            pointType: "CORNER"
        });

        // Right Involute intermediates (downwards):
        for (var i = rightInvSegs.length - 1; i > 0; i--) {
            var sAbove = rightInvSegs[i];
            var sBelow = rightInvSegs[i - 1];
            singleToothNodes.push({
                anchor: [sAbove.P0.x, sAbove.P0.y],
                leftDirection: [sAbove.P1.x, sAbove.P1.y],
                rightDirection: [sBelow.P2.x, sBelow.P2.y],
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

        // Right Fillet intermediates (downwards):
        for (var i = rightFilletSegs.length - 1; i > 0; i--) {
            var sAbove = rightFilletSegs[i];
            var sBelow = rightFilletSegs[i - 1];
            singleToothNodes.push({
                anchor: [sAbove.P0.x, sAbove.P0.y],
                leftDirection: [sAbove.P1.x, sAbove.P1.y],
                rightDirection: [sBelow.P2.x, sBelow.P2.y],
                pointType: "SMOOTH"
            });
        }

        // Right Root:
        var firstRFil = rightFilletSegs[0];
        singleToothNodes.push({
            anchor: [pRightRoot.x, pRightRoot.y],
            leftDirection: [firstRFil.P1.x, firstRFil.P1.y],
            rightDirection: [pRightRoot.x, pRightRoot.y], // filled in full contour
            pointType: "SMOOTH"
        });

        // --- 7. Full Closed Gear Outer Nodes (Bezier loop) ---
        var outerNodes = [];
        var toothPitchAngle = (2.0 * Math.PI) / z;
        var thRoot = Math.atan2(pRightRoot.y, pRightRoot.x);
        var dThRoot = toothPitchAngle - 2.0 * thRoot;
        var hasFlatRoot = (dThRoot > 0.0001);
        var L_root = hasFlatRoot ? ((4.0 / 3.0) * rf * Math.tan(dThRoot / 4.0)) : 0;

        var isMutilated = !!(params.isMutilated || params.mutilated);
        var intermittentRole = params.intermittentRole || (params.intermittent && params.intermittent.role) || "NONE";
        var isIntermittentDriver = (intermittentRole === "DRIVER");
        var isIntermittentDriven = (intermittentRole === "DRIVEN");
        var intermittentStructure = params.intermittentStructure || (params.intermittent && params.intermittent.structure) || "coplanar";
        var lockClearance = (params.lockClearance !== undefined) ? parseFloat(params.lockClearance) : 0.15;
        if (isNaN(lockClearance)) lockClearance = 0.15;
        var tipRelief = (params.tipRelief !== undefined) ? !!params.tipRelief : false;
        var divisions = (params.divisions !== undefined) ? parseInt(params.divisions, 10) : 4;
        if (isNaN(divisions) || divisions < 2) divisions = 4;
        var moveTeeth = (params.moveTeeth !== undefined) ? parseInt(params.moveTeeth, 10) : 2;
        if (isNaN(moveTeeth) || moveTeeth < 1) moveTeeth = 1;

        if (isIntermittentDriver) {
            isMutilated = true;
        }

        var activeTeeth = (params.activeTeeth !== undefined) ? parseInt(params.activeTeeth, 10) : (isIntermittentDriver ? moveTeeth : z);
        if (isNaN(activeTeeth) || activeTeeth > z) activeTeeth = z;
        if (activeTeeth < 0) activeTeeth = 0;

        var startTooth = (params.startTooth !== undefined) ? parseInt(params.startTooth, 10) : 1;
        if (isNaN(startTooth)) startTooth = 1;
        var startIdx = ((startTooth - 1) % z + z) % z; // 0-based

        var blankRadiusType = params.blankRadiusType || "root"; // Always default to root circle (rf) for spur gears and mutilated gears
        var R_blank = rf; // default root circle
        if (blankRadiusType === "tip") {
            R_blank = ra;
        } else if (blankRadiusType === "pitch") {
            R_blank = rp;
        } else if (blankRadiusType === "custom" && params.blankRadius) {
            R_blank = parseFloat(params.blankRadius) || rf;
        }

        if (isIntermittentDriven) {
            // === Intermittent Driven Gear Outer Bezier Loop ===
            // In both coplanar and two-layer setups, the gear layer consists of divisions sectors.
            // Each sector has moveTeeth active involute teeth.
            // If divisions * moveTeeth === z, the gear has teeth all around (full gear meshing).
            // If divisions * moveTeeth < z, the space between sector exit and next sector entry is
            // connected smoothly by the root circle (rf), identically to mutilated driver teeth.
            // In two-layer mode, the separate star lock shoe (lpNodes) is exported to the _LockPlate layer.
            var theta_seg = (2.0 * Math.PI) / divisions;
            var isFullTeeth = (divisions * moveTeeth === z);

            for (var s = 0; s < divisions; s++) {
                var segStartAngle = s * theta_seg;

                // 1. Add active teeth for this sector (moveTeeth)
                for (var t = 0; t < moveTeeth; t++) {
                    var toothRot = segStartAngle + t * toothPitchAngle;
                    var cosR = Math.cos(toothRot);
                    var sinR = Math.sin(toothRot);

                    function tfPtDriven(pt) {
                        var rx = (pt[0] * cosR - pt[1] * sinR) * MM_TO_PT;
                        var ry = (pt[0] * sinR + pt[1] * cosR) * MM_TO_PT;
                        return [Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000];
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
                    var rEndPt = tfPtDriven([pRightRoot.x, pRightRoot.y]);
                    var lStartPt = tfPtDriven([pRightRoot.x, -pRightRoot.y]);

                    var isConnectedToNext = (t < moveTeeth - 1) || isFullTeeth;

                    if (isConnectedToNext) {
                        tNodes[tNodes.length - 1].rightDirection = [
                            Math.round((rEndPt[0] - L_root * Math.sin(curEndTh) * MM_TO_PT) * 10000) / 10000,
                            Math.round((rEndPt[1] + L_root * Math.cos(curEndTh) * MM_TO_PT) * 10000) / 10000
                        ];
                        tNodes[0].leftDirection = [
                            Math.round((lStartPt[0] + L_root * Math.sin(curStartTh) * MM_TO_PT) * 10000) / 10000,
                            Math.round((lStartPt[1] - L_root * Math.cos(curStartTh) * MM_TO_PT) * 10000) / 10000
                        ];
                    }

                    for (var n = 0; n < tNodes.length; n++) {
                        outerNodes.push(tNodes[n]);
                    }
                }

                // 2. Connect to next sector if there is an empty gap (divisions * moveTeeth < z)
                if (!isFullTeeth) {
                    var teethEndAngle = segStartAngle + (moveTeeth - 1) * toothPitchAngle;
                    var nextSegStartAngle = (s + 1) * theta_seg;
                    var exitTh = teethEndAngle + thRoot;
                    var entryThNext = nextSegStartAngle - thRoot;

                    var bridge = createArcBezierNodes(rf, exitTh, entryThNext);
                    if (bridge.length > 0) {
                        var lastActiveNode = outerNodes[outerNodes.length - 1];
                        lastActiveNode.rightDirection = [
                            Math.round(bridge[0].rightDirection[0] * MM_TO_PT * 10000) / 10000,
                            Math.round(bridge[0].rightDirection[1] * MM_TO_PT * 10000) / 10000
                        ];
                        for (var b = 1; b < bridge.length - 1; b++) {
                            var bNode = bridge[b];
                            outerNodes.push({
                                anchor: [Math.round(bNode.anchor[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.anchor[1] * MM_TO_PT * 10000) / 10000],
                                leftDirection: [Math.round(bNode.leftDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.leftDirection[1] * MM_TO_PT * 10000) / 10000],
                                rightDirection: [Math.round(bNode.rightDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.rightDirection[1] * MM_TO_PT * 10000) / 10000],
                                pointType: "SMOOTH"
                            });
                        }
                    }
                }
            }

            // Close final bridge to tooth 0 leftDirection if !isFullTeeth
            if (!isFullTeeth && outerNodes.length > 0) {
                var lastExitTh = (divisions - 1) * theta_seg + (moveTeeth - 1) * toothPitchAngle + thRoot;
                var firstEntryTh = 2.0 * Math.PI - thRoot;
                var finalBridge = createArcBezierNodes(rf, lastExitTh, 2.0 * Math.PI - thRoot);
                if (finalBridge.length > 0) {
                    outerNodes[0].leftDirection = [
                        Math.round(finalBridge[finalBridge.length - 1].leftDirection[0] * MM_TO_PT * 10000) / 10000,
                        Math.round(finalBridge[finalBridge.length - 1].leftDirection[1] * MM_TO_PT * 10000) / 10000
                    ];
                }
            }
        } else if (!isMutilated || activeTeeth >= z) {
            // === Standard Full Gear Outer Bezier Loop ===
            for (var t = 0; t < z; t++) {
                var rot = t * toothPitchAngle;
                var cosR = Math.cos(rot);
                var sinR = Math.sin(rot);

                function tfPt(pt) {
                    var rx = (pt[0] * cosR - pt[1] * sinR) * MM_TO_PT;
                    var ry = (pt[0] * sinR + pt[1] * cosR) * MM_TO_PT;
                    return [Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000];
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

                // Fill root bottom arc handles for tooth t
                var curEndTh = rot + thRoot;
                var curStartTh = rot - thRoot;

                var rEndPt = tfPt([pRightRoot.x, pRightRoot.y]);
                var lStartPt = tfPt([pRightRoot.x, -pRightRoot.y]);

                // Outgoing handle from Right Root towards next tooth:
                tNodes[tNodes.length - 1].rightDirection = [
                    Math.round((rEndPt[0] - L_root * Math.sin(curEndTh) * MM_TO_PT) * 10000) / 10000,
                    Math.round((rEndPt[1] + L_root * Math.cos(curEndTh) * MM_TO_PT) * 10000) / 10000
                ];

                // Incoming handle into Left Root from previous tooth:
                tNodes[0].leftDirection = [
                    Math.round((lStartPt[0] + L_root * Math.sin(curStartTh) * MM_TO_PT) * 10000) / 10000,
                    Math.round((lStartPt[1] - L_root * Math.cos(curStartTh) * MM_TO_PT) * 10000) / 10000
                ];

                for (var n = 0; n < tNodes.length; n++) {
                    outerNodes.push(tNodes[n]);
                }
            }
        } else if (activeTeeth <= 0) {
            // === Zero Active Teeth: Full Blank Circle (4-Bezier) ===
            var blankCircleNodes = createArcBezierNodes(R_blank, 0, 2.0 * Math.PI);
            for (var bi = 0; bi < blankCircleNodes.length - 1; bi++) {
                var bnd = blankCircleNodes[bi];
                outerNodes.push({
                    anchor: [Math.round(bnd.anchor[0] * MM_TO_PT * 10000) / 10000, Math.round(bnd.anchor[1] * MM_TO_PT * 10000) / 10000],
                    leftDirection: [Math.round(bnd.leftDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bnd.leftDirection[1] * MM_TO_PT * 10000) / 10000],
                    rightDirection: [Math.round(bnd.rightDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bnd.rightDirection[1] * MM_TO_PT * 10000) / 10000],
                    pointType: "SMOOTH"
                });
            }
        } else {
            // === Mutilated / Intermittent Gear Outer Bezier Loop ===
            var endIdx = (startIdx + activeTeeth - 1) % z;
            var deltaBlank = (z - activeTeeth + 1) * toothPitchAngle - 2.0 * thRoot;
            while (deltaBlank < 0) deltaBlank += 2.0 * Math.PI;

            var exitTh = (endIdx * toothPitchAngle) + thRoot;
            var entryTh = exitTh + deltaBlank;

            // Generate blank bridging arc nodes (in mm)
            var blankArcNodes = createArcBezierNodes(R_blank, exitTh, entryTh);

            // Precompute mathematically exact shortened tooth for tip relief (Short Addendum Tooth)
            var relievedToothNodes = null;
            if (isIntermittentDriver && tipRelief && !params._isReliefRecursion) {
                var daRelieved = da - (0.5 * m); // ra' = ra - 0.25 * m
                var relGear = calculateSpurGear({
                    m: m,
                    z: z,
                    x: x,
                    alphaDeg: alphaDeg,
                    backlash: backlash,
                    useFillet: useFillet,
                    rcFactor: rcFactor,
                    pathQuality: pathQuality,
                    da: daRelieved,
                    df: df,
                    isMutilated: false,
                    _isReliefRecursion: true
                });
                relievedToothNodes = relGear.singleToothNodes;
            }

            // Precompute mathematically exact shortened tooth for tip relief (Short Addendum Tooth)
            var relievedToothNodes = null;
            if (isIntermittentDriver && tipRelief && !params._isReliefRecursion) {
                var daRelieved = da - (0.5 * m); // ra' = ra - 0.25 * m
                var relGear = calculateSpurGear({
                    m: m,
                    z: z,
                    x: x,
                    alphaDeg: alphaDeg,
                    backlash: backlash,
                    useFillet: useFillet,
                    rcFactor: rcFactor,
                    pathQuality: pathQuality,
                    da: daRelieved,
                    df: df,
                    isMutilated: false,
                    _isReliefRecursion: true
                });
                relievedToothNodes = relGear.singleToothNodes;
            }

            for (var step = 0; step < activeTeeth; step++) {
                var t = (startIdx + step) % z;
                var rot = t * toothPitchAngle;
                var cosR = Math.cos(rot);
                var sinR = Math.sin(rot);

                function tfPtM(pt) {
                    var rx = (pt[0] * cosR - pt[1] * sinR) * MM_TO_PT;
                    var ry = (pt[0] * sinR + pt[1] * cosR) * MM_TO_PT;
                    return [Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000];
                }

                var tNodes = [];
                var isTipReliefTooth = (isIntermittentDriver && tipRelief && step === 0 && relievedToothNodes);
                var srcToothNodes = isTipReliefTooth ? relievedToothNodes : singleToothNodes;

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
                var rEndPt = tfPtM([pRightRoot.x, pRightRoot.y]);
                var lStartPt = tfPtM([pRightRoot.x, -pRightRoot.y]);

                if (step < activeTeeth - 1) {
                    // Next tooth is active: regular root bottom arc
                    tNodes[tNodes.length - 1].rightDirection = [
                        Math.round((rEndPt[0] - L_root * Math.sin(curEndTh) * MM_TO_PT) * 10000) / 10000,
                        Math.round((rEndPt[1] + L_root * Math.cos(curEndTh) * MM_TO_PT) * 10000) / 10000
                    ];
                    tNodes[0].leftDirection = [
                        Math.round((lStartPt[0] + L_root * Math.sin(curStartTh) * MM_TO_PT) * 10000) / 10000,
                        Math.round((lStartPt[1] - L_root * Math.cos(curStartTh) * MM_TO_PT) * 10000) / 10000
                    ];
                }

                for (var n = 0; n < tNodes.length; n++) {
                    outerNodes.push(tNodes[n]);
                }
            }

            // Connect exit of last active tooth to entry of first active tooth via blank arc along root circle
            var isRadiusMatched = Math.abs(R_blank - rf) < 0.001;

            if (isRadiusMatched && blankArcNodes.length > 0) {
                // Smooth C1 transition along root circle (Pure Mutilated Spur Gear Geometry)
                var lastActiveNode = outerNodes[outerNodes.length - 1];
                lastActiveNode.rightDirection = [
                    Math.round(blankArcNodes[0].rightDirection[0] * MM_TO_PT * 10000) / 10000,
                    Math.round(blankArcNodes[0].rightDirection[1] * MM_TO_PT * 10000) / 10000
                ];

                for (var b = 1; b < blankArcNodes.length - 1; b++) {
                    var bNode = blankArcNodes[b];
                    outerNodes.push({
                        anchor: [Math.round(bNode.anchor[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.anchor[1] * MM_TO_PT * 10000) / 10000],
                        leftDirection: [Math.round(bNode.leftDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.leftDirection[1] * MM_TO_PT * 10000) / 10000],
                        rightDirection: [Math.round(bNode.rightDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.rightDirection[1] * MM_TO_PT * 10000) / 10000],
                        pointType: "SMOOTH"
                    });
                }

                outerNodes[0].leftDirection = [
                    Math.round(blankArcNodes[blankArcNodes.length - 1].leftDirection[0] * MM_TO_PT * 10000) / 10000,
                    Math.round(blankArcNodes[blankArcNodes.length - 1].leftDirection[1] * MM_TO_PT * 10000) / 10000
                ];
            } else if (blankArcNodes.length > 0) {
                // Step transition to different radius (e.g. tip blank or custom)
                var lastActiveNode = outerNodes[outerNodes.length - 1];
                lastActiveNode.pointType = "CORNER";
                lastActiveNode.rightDirection = [lastActiveNode.anchor[0], lastActiveNode.anchor[1]];

                outerNodes[0].pointType = "CORNER";
                outerNodes[0].leftDirection = [outerNodes[0].anchor[0], outerNodes[0].anchor[1]];

                for (var b = 0; b < blankArcNodes.length; b++) {
                    var bNode = blankArcNodes[b];
                    var ptAnchor = [Math.round(bNode.anchor[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.anchor[1] * MM_TO_PT * 10000) / 10000];
                    var ptLeft = [Math.round(bNode.leftDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.leftDirection[1] * MM_TO_PT * 10000) / 10000];
                    var ptRight = [Math.round(bNode.rightDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(bNode.rightDirection[1] * MM_TO_PT * 10000) / 10000];

                    if (b === 0) {
                        ptLeft = [ptAnchor[0], ptAnchor[1]];
                    }
                    if (b === blankArcNodes.length - 1) {
                        ptRight = [ptAnchor[0], ptAnchor[1]];
                    }

                    outerNodes.push({
                        anchor: ptAnchor,
                        leftDirection: ptLeft,
                        rightDirection: ptRight,
                        pointType: (b === 0 || b === blankArcNodes.length - 1) ? "CORNER" : "SMOOTH"
                    });
                }
            }
        }

        // --- 8. Polyline Fallback / Disassembled Segments ---
        // (Maintains 100% backward compatibility for polyline mode & disassembled test mode)
        var rightFilletDown = [];
        for (var f = 0; f <= 6; f++) {
            var pF = junctionPhi + (phi_root - junctionPhi) * (f / 6.0);
            rightFilletDown.push(getTrochoidPoint(pF));
        }

        var rightInvoluteUp = [];
        for (var v = 0; v <= 6; v++) {
            var rVal = junctionR + (ra - junctionR) * (v / 6.0);
            rightInvoluteUp.push(getInvolutePoint(rVal));
        }

        var rightInvoluteDown = [];
        for (var i = rightInvoluteUp.length - 1; i >= 0; i--) {
            rightInvoluteDown.push(rightInvoluteUp[i]);
        }

        var leftInvoluteUp = [];
        for (var i = 0; i < rightInvoluteUp.length; i++) {
            var p = rightInvoluteUp[i];
            leftInvoluteUp.push({ r: p.r, theta: -p.theta, x: p.r * Math.cos(-p.theta), y: p.r * Math.sin(-p.theta) });
        }

        var leftFilletUp = [];
        for (var i = rightFilletDown.length - 1; i >= 0; i--) {
            var p = rightFilletDown[i];
            leftFilletUp.push({ r: p.r, theta: -p.theta, x: p.r * Math.cos(-p.theta), y: p.r * Math.sin(-p.theta) });
        }

        var tipArcAcross = [];
        for (var ts = 0; ts <= 4; ts++) {
            var tipAngle = -pRightTip.theta + (2.0 * pRightTip.theta) * (ts / 4.0);
            tipArcAcross.push({ r: ra, theta: tipAngle, x: ra * Math.cos(tipAngle), y: ra * Math.sin(tipAngle) });
        }

        var singleToothCombined = [];
        for (var i = 0; i < leftFilletUp.length; i++) singleToothCombined.push(leftFilletUp[i]);
        for (var i = 1; i < leftInvoluteUp.length; i++) singleToothCombined.push(leftInvoluteUp[i]);
        for (var i = 1; i < tipArcAcross.length - 1; i++) singleToothCombined.push(tipArcAcross[i]);
        for (var i = 0; i < rightInvoluteDown.length; i++) singleToothCombined.push(rightInvoluteDown[i]);
        for (var i = 1; i < rightFilletDown.length; i++) singleToothCombined.push(rightFilletDown[i]);

        var outerPoints = [];
        if (!isMutilated || activeTeeth >= z) {
            for (var t = 0; t < z; t++) {
                var rot = t * toothPitchAngle;
                var cosRot = Math.cos(rot);
                var sinRot = Math.sin(rot);

                for (var ptIdx = 0; ptIdx < singleToothCombined.length; ptIdx++) {
                    var px = singleToothCombined[ptIdx].x;
                    var py = singleToothCombined[ptIdx].y;
                    var rx = (px * cosRot - py * sinRot) * MM_TO_PT;
                    var ry = (px * sinRot + py * cosRot) * MM_TO_PT;
                    outerPoints.push([Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000]);
                }

                if (hasFlatRoot) {
                    var nextRot = (t + 1) * toothPitchAngle;
                    var curEndTheta = rot + rightFilletDown[rightFilletDown.length - 1].theta;
                    var nextStartTheta = nextRot + leftFilletUp[0].theta;
                    var rootRadiusPt = rf * MM_TO_PT;

                    for (var sub = 1; sub <= 2; sub++) {
                        var rTheta = curEndTheta + (nextStartTheta - curEndTheta) * (sub / 3.0);
                        outerPoints.push([
                            Math.round(rootRadiusPt * Math.cos(rTheta) * 10000) / 10000,
                            Math.round(rootRadiusPt * Math.sin(rTheta) * 10000) / 10000
                        ]);
                    }
                }
            }
        } else if (activeTeeth <= 0) {
            var nCircPts = 72;
            for (var cp = 0; cp < nCircPts; cp++) {
                var cTh = cp * (2.0 * Math.PI / nCircPts);
                outerPoints.push([
                    Math.round(R_blank * MM_TO_PT * Math.cos(cTh) * 10000) / 10000,
                    Math.round(R_blank * MM_TO_PT * Math.sin(cTh) * 10000) / 10000
                ]);
            }
        } else {
            var endIdx = (startIdx + activeTeeth - 1) % z;
            var deltaBlank = (z - activeTeeth + 1) * toothPitchAngle - 2.0 * thRoot;
            while (deltaBlank < 0) deltaBlank += 2.0 * Math.PI;

            for (var step = 0; step < activeTeeth; step++) {
                var t = (startIdx + step) % z;
                var rot = t * toothPitchAngle;
                var cosRot = Math.cos(rot);
                var sinRot = Math.sin(rot);

                for (var ptIdx = 0; ptIdx < singleToothCombined.length; ptIdx++) {
                    var px = singleToothCombined[ptIdx].x;
                    var py = singleToothCombined[ptIdx].y;
                    var rx = (px * cosRot - py * sinRot) * MM_TO_PT;
                    var ry = (px * sinRot + py * cosRot) * MM_TO_PT;
                    outerPoints.push([Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000]);
                }

                if (step < activeTeeth - 1 && hasFlatRoot) {
                    var nextRot = ((t + 1) % z) * toothPitchAngle;
                    var curEndTheta = rot + rightFilletDown[rightFilletDown.length - 1].theta;
                    var nextStartTheta = nextRot + leftFilletUp[0].theta;
                    var rootRadiusPt = rf * MM_TO_PT;

                    for (var sub = 1; sub <= 2; sub++) {
                        var rTheta = curEndTheta + (nextStartTheta - curEndTheta) * (sub / 3.0);
                        outerPoints.push([
                            Math.round(rootRadiusPt * Math.cos(rTheta) * 10000) / 10000,
                            Math.round(rootRadiusPt * Math.sin(rTheta) * 10000) / 10000
                        ]);
                    }
                }
            }

            // Sample blank arc points
            var exitTheta = (endIdx * toothPitchAngle) + rightFilletDown[rightFilletDown.length - 1].theta;
            var numBlankSteps = Math.max(4, Math.ceil(deltaBlank / (Math.PI / 18.0)));
            var blankRadiusPt = R_blank * MM_TO_PT;
            for (var bs = 1; bs <= numBlankSteps; bs++) {
                var bTh = exitTheta + deltaBlank * (bs / (numBlankSteps + 1.0));
                outerPoints.push([
                    Math.round(blankRadiusPt * Math.cos(bTh) * 10000) / 10000,
                    Math.round(blankRadiusPt * Math.sin(bTh) * 10000) / 10000
                ]);
            }
        }

        var shaftType = params.shaftType || "丸穴";
        var shaftOptions = params.shaftOptions || {};
        var shaftHole = calculateShaftHoleGeometry(shaftDiameter, shaftType, shaftOptions);
        var holeRadius = (shaftHole.hasHole) ? (shaftDiameter / 2.0) : 0;

        var pinHoles = null;
        if (params.pinHoles || (shaftOptions && shaftOptions.drawPinHoles)) {
            var pinOpt = (typeof params.pinHoles === "object") ? params.pinHoles : (shaftOptions.pinHoles || {});
            pinHoles = calculateAlignmentPinHoles(rf, shaftDiameter, pinOpt);
        }

        var lockPlate = null;
        if (intermittentStructure === "two_layer") {
            var driverZ = params.driverZ ? parseInt(params.driverZ, 10) : z;
            var centerDist = params.centerDistance ? parseFloat(params.centerDistance) : ((m * (z + driverZ)) / 2.0);
            if (isIntermittentDriver) {
                var R_disc = rp;
                var drivenRa = ((m * (params.drivenZ || z)) / 2.0) + m;
                var R_cres = drivenRa + lockClearance;
                var x_cres = (R_disc * R_disc + centerDist * centerDist - R_cres * R_cres) / (2.0 * centerDist);
                var y2_c = R_disc * R_disc - x_cres * x_cres;
                if (y2_c >= 0) {
                    var y_cres = Math.sqrt(y2_c);
                    var th_cres = Math.atan2(y_cres, x_cres);
                    var cres_phi = Math.atan2(y_cres, centerDist - x_cres);
                    var L_cres = (4.0 / 3.0) * Math.tan(cres_phi / 4.0) * R_cres;
                    var tau1 = (2.0 * Math.PI) / z;
                    var crescentCenterAngle = ((activeTeeth - 1) * tau1) / 2.0;
                    var cosA = Math.cos(crescentCenterAngle);
                    var sinA = Math.sin(crescentCenterAngle);

                    function rotLpPt(pt) {
                        var rx = (pt[0] * cosA - pt[1] * sinA) * MM_TO_PT;
                        var ry = (pt[0] * sinA + pt[1] * cosA) * MM_TO_PT;
                        return [Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000];
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
                    lockPlate = {
                        name: "LockCam_Driver",
                        outerNodes: lpNodes,
                        shaftHole: shaftHole,
                        radiusMm: R_disc
                    };
                }
            } else if (isIntermittentDriven) {
                var R_drum = (m * driverZ) / 2.0;
                var R_shoe = R_drum + lockClearance;
                var R_star = ra;
                var concavePocket = createConcaveLockArcNodes(centerDist, R_shoe, R_star);
                var pocketHalfAngle = concavePocket.deltaAngle || 0;
                var theta_seg = (2.0 * Math.PI) / divisions;
                var nTeethDriven = moveTeeth || (z / divisions);
                var tau2 = (2.0 * Math.PI) / z;
                var teethEnd2 = (nTeethDriven - 1) * tau2;
                var dwellOffsetAngle = (teethEnd2 + theta_seg) / 2.0;
                var lpNodes = [];
                var lastIncomingHandle = null;

                for (var s = 0; s < divisions; s++) {
                    var dwellCenterAngle = dwellOffsetAngle + (s * theta_seg);
                    var shoeRot = dwellCenterAngle + Math.PI;
                    var cosS = Math.cos(shoeRot);
                    var sinS = Math.sin(shoeRot);

                    function tfLpShoe(pt) {
                        var rx = (pt[0] * cosS - pt[1] * sinS) * MM_TO_PT;
                        var ry = (pt[0] * sinS + pt[1] * cosS) * MM_TO_PT;
                        return [Math.round(rx * 10000) / 10000, Math.round(ry * 10000) / 10000];
                    }

                    if (concavePocket.length >= 3 && pocketHalfAngle > 0) {
                        var p0 = concavePocket[0]; // Entry at R_star
                        var pMid = concavePocket[1]; // Mid at deepest point
                        var p2 = concavePocket[2]; // Exit at R_star

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
                            lpNodes[lpNodes.length - 1].rightDirection = [
                                Math.round(arcConn[0].rightDirection[0] * MM_TO_PT * 10000) / 10000,
                                Math.round(arcConn[0].rightDirection[1] * MM_TO_PT * 10000) / 10000
                            ];

                            for (var ac = 1; ac < arcConn.length - 1; ac++) {
                                lpNodes.push({
                                    anchor: [Math.round(arcConn[ac].anchor[0] * MM_TO_PT * 10000) / 10000, Math.round(arcConn[ac].anchor[1] * MM_TO_PT * 10000) / 10000],
                                    leftDirection: [Math.round(arcConn[ac].leftDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(arcConn[ac].leftDirection[1] * MM_TO_PT * 10000) / 10000],
                                    rightDirection: [Math.round(arcConn[ac].rightDirection[0] * MM_TO_PT * 10000) / 10000, Math.round(arcConn[ac].rightDirection[1] * MM_TO_PT * 10000) / 10000],
                                    pointType: "SMOOTH"
                                });
                            }

                            lastIncomingHandle = [
                                Math.round(arcConn[arcConn.length - 1].leftDirection[0] * MM_TO_PT * 10000) / 10000,
                                Math.round(arcConn[arcConn.length - 1].leftDirection[1] * MM_TO_PT * 10000) / 10000
                            ];
                        }
                    }
                }

                if (lastIncomingHandle !== null && lpNodes.length > 0) {
                    lpNodes[0].leftDirection = lastIncomingHandle;
                }

                lockPlate = {
                    name: "LockStar_Driven",
                    outerNodes: lpNodes,
                    shaftHole: shaftHole,
                    radiusMm: R_star
                };
            }
        }

        return {
            m: m,
            z: z,
            x: x,
            alphaDeg: alphaDeg,
            pathQuality: pathQuality,
            isMutilated: isMutilated,
            activeTeeth: isMutilated ? activeTeeth : z,
            startTooth: isMutilated ? startTooth : 1,
            blankRadiusType: blankRadiusType,
            blankRadiusMm: R_blank,
            blankRadiusPt: R_blank * MM_TO_PT,
            pitchDiameter: d,
            baseDiameter: db,
            tipDiameter: da,
            rootDiameter: df,
            actualRootDiameter: pRightRoot.r * 2.0,
            rpMm: rp,
            rbMm: rb,
            raMm: ra,
            rfMm: rf,
            actualRootRadiusMm: pRightRoot.r,
            rpPt: rp * MM_TO_PT,
            rbPt: rb * MM_TO_PT,
            raPt: ra * MM_TO_PT,
            rfPt: rf * MM_TO_PT,
            actualRootRadiusPt: pRightRoot.r * MM_TO_PT,
            pitchRadiusPt: rp * MM_TO_PT,
            baseRadiusPt: rb * MM_TO_PT,
            tipRadiusPt: ra * MM_TO_PT,
            rootRadiusPt: pRightRoot.r * MM_TO_PT,
            holeRadiusPt: holeRadius * MM_TO_PT,
            hasHole: shaftHole.hasHole,
            shaftDiameter: shaftDiameter,
            shaftType: shaftHole.shaftType,
            shaftHole: shaftHole,
            pinHoles: pinHoles,
            intermittentRole: intermittentRole,
            intermittentStructure: intermittentStructure,
            divisions: divisions,
            moveTeeth: moveTeeth,
            lockClearance: lockClearance,
            tipRelief: tipRelief,
            lockPlate: lockPlate,
            outerNodes: outerNodes,             // Bezier nodes for full closed contour
            singleToothNodes: singleToothNodes, // Bezier nodes for 1 tooth
            outerPoints: outerPoints,           // Polyline points fallback
            singleToothCombined: singleToothCombined,
            singleToothSegments: {
                leftFillet: leftFilletUp,
                leftInvolute: leftInvoluteUp,
                tipArc: tipArcAcross,
                rightInvolute: rightInvoluteDown,
                rightFillet: rightFilletDown
            },
            undercutLimit: getUndercutLimit(alpha),
            hasUndercut: isUndercut,
            useFillet: useFillet
        };
    }

    /**
     * Calculate meshing center distance and phase angle for two gears
     */
    function calculateMeshingPair(m, z1, z2, angleDeg, phi1Deg) {
        var theta = (angleDeg || 0) * (Math.PI / 180.0);
        var phi1 = (phi1Deg || 0) * (Math.PI / 180.0);

        var a_mm = m * (z1 + z2) / 2.0;
        var a_pt = a_mm * MM_TO_PT;

        var dx = a_pt * Math.cos(theta);
        var dy = a_pt * Math.sin(theta);

        var phi2 = theta + Math.PI - (Math.PI / z2) - (phi1 - theta) * (z1 / z2);

        return {
            centerDistanceMm: a_mm,
            centerDistancePt: a_pt,
            gear2OffsetX: dx,
            gear2OffsetY: dy,
            gear1RotationDeg: phi1 * (180.0 / Math.PI),
            gear2RotationDeg: phi2 * (180.0 / Math.PI),
            gearRatio: z2 / z1
        };
    }

    /**
     * Calculate rack profile geometry and Bezier contour nodes compliant with JIS B 1701.
     * 
     * @param {Object} params
     *   - m: Module (mm)
     *   - zRack: Number of teeth on rack (integer, default 10)
     *   - alphaDeg: Pressure angle (deg, default 20)
     *   - backlash: Circumferential backlash (mm, default 0.0)
     *   - backHeight: Base backing thickness from root line downward (mm, default 2.5 * m)
     *   - rcFactor: Root fillet radius factor (default 0.38)
     */
    function calculateRack(params) {
        var m = params.m;
        var zRack = Math.max(1, Math.round(params.zRack !== undefined ? params.zRack : (params.z !== undefined ? params.z : 10)));
        var alphaDeg = params.alphaDeg || 20;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var backlash = params.backlash || 0.0;
        var rcFactor = params.rcFactor || 0.38;
        var backHeight = (params.backHeight !== undefined) ? params.backHeight : ((params.height !== undefined) ? Math.max(0.5, params.height - 2.25 * m) : (2.5 * m));

        var pitch = Math.PI * m;
        var ha = 1.0 * m;
        var hf = 1.25 * m;
        var rc = rcFactor * m;

        var s_eff = (pitch / 2.0) - backlash;
        var tanA = Math.tan(alpha);
        var cosA = Math.cos(alpha);
        var sinA = Math.sin(alpha);

        var y_tan = -hf + rc * (1.0 - sinA);
        var x_tan = (s_eff / 2.0) - y_tan * tanA;
        var x_c = x_tan + rc * cosA;
        var x_tip = (s_eff / 2.0) - ha * tanA;

        // Fillet Bezier arc parameter: arcAngle = PI/2 - alpha
        var arcAngle = (Math.PI / 2.0) - alpha;
        var kappa = (4.0 / 3.0) * rc * Math.tan(arcAngle / 4.0);

        var totalLength = zRack * pitch;
        var leftX = -totalLength / 2.0;
        var rightX = totalLength / 2.0;

        var outerNodes = [];

        // 1. Left top corner of base / start of rack line
        outerNodes.push({
            anchor: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            leftDirection: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            rightDirection: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            pointType: "CORNER"
        });

        for (var k = 0; k < zRack; k++) {
            var cx = leftX + (k + 0.5) * pitch;

            var pFilletLeftStart = [cx - x_c, -hf];
            var pFilletLeftEnd = [cx - x_tan, y_tan];

            var hLeftStart = [pFilletLeftStart[0] + kappa, pFilletLeftStart[1]];
            var hLeftEnd = [pFilletLeftEnd[0] - kappa * sinA, pFilletLeftEnd[1] - kappa * cosA];

            var pTipLeft = [cx - x_tip, ha];
            var pTipMid = [cx, ha];
            var pTipRight = [cx + x_tip, ha];

            var pFilletRightStart = [cx + x_tan, y_tan];
            var pFilletRightEnd = [cx + x_c, -hf];
            var hRightStart = [pFilletRightStart[0] + kappa * sinA, pFilletRightStart[1] - kappa * cosA];
            var hRightEnd = [pFilletRightEnd[0] - kappa, pFilletRightEnd[1]];

            // 1. Fillet left start (Root flat to fillet arc - Red circle)
            outerNodes.push({
                anchor: [Math.round(pFilletLeftStart[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletLeftStart[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(pFilletLeftStart[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletLeftStart[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(hLeftStart[0] * MM_TO_PT * 10000) / 10000, Math.round(hLeftStart[1] * MM_TO_PT * 10000) / 10000],
                pointType: "SMOOTH"
            });

            // 2. Fillet left end (Fillet arc to straight flank - Red circle)
            outerNodes.push({
                anchor: [Math.round(pFilletLeftEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletLeftEnd[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(hLeftEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(hLeftEnd[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(pFilletLeftEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletLeftEnd[1] * MM_TO_PT * 10000) / 10000],
                pointType: "SMOOTH"
            });

            // 3. Tip Left Corner (Straight flank to tip flat - Red circle)
            outerNodes.push({
                anchor: [Math.round(pTipLeft[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipLeft[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(pTipLeft[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipLeft[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(pTipLeft[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipLeft[1] * MM_TO_PT * 10000) / 10000],
                pointType: "CORNER"
            });

            // 4. Tip Mid (Intersection with tooth symmetry axis x = cx - Blue circle)
            outerNodes.push({
                anchor: [Math.round(pTipMid[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipMid[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(pTipMid[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipMid[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(pTipMid[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipMid[1] * MM_TO_PT * 10000) / 10000],
                pointType: "CORNER"
            });

            // 5. Tip Right Corner (Tip flat to straight flank - Red circle)
            outerNodes.push({
                anchor: [Math.round(pTipRight[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipRight[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(pTipRight[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipRight[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(pTipRight[0] * MM_TO_PT * 10000) / 10000, Math.round(pTipRight[1] * MM_TO_PT * 10000) / 10000],
                pointType: "CORNER"
            });

            // 6. Fillet right start (Straight flank to fillet arc - Red circle)
            outerNodes.push({
                anchor: [Math.round(pFilletRightStart[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletRightStart[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(pFilletRightStart[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletRightStart[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(hRightStart[0] * MM_TO_PT * 10000) / 10000, Math.round(hRightStart[1] * MM_TO_PT * 10000) / 10000],
                pointType: "SMOOTH"
            });

            // 7. Fillet right end (Fillet arc to root flat - Red circle)
            outerNodes.push({
                anchor: [Math.round(pFilletRightEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletRightEnd[1] * MM_TO_PT * 10000) / 10000],
                leftDirection: [Math.round(hRightEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(hRightEnd[1] * MM_TO_PT * 10000) / 10000],
                rightDirection: [Math.round(pFilletRightEnd[0] * MM_TO_PT * 10000) / 10000, Math.round(pFilletRightEnd[1] * MM_TO_PT * 10000) / 10000],
                pointType: "SMOOTH"
            });
        }

        // 8. Right top corner of base / end of rack line
        outerNodes.push({
            anchor: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            leftDirection: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            rightDirection: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(-hf * MM_TO_PT * 10000) / 10000],
            pointType: "CORNER"
        });

        // Base rectangle bottom corners
        var y_base_mm = -(hf + backHeight);
        var y_base_pt = y_base_mm * MM_TO_PT;

        outerNodes.push({
            anchor: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            leftDirection: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            rightDirection: [Math.round(rightX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            pointType: "CORNER"
        });

        outerNodes.push({
            anchor: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            leftDirection: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            rightDirection: [Math.round(leftX * MM_TO_PT * 10000) / 10000, Math.round(y_base_pt * 10000) / 10000],
            pointType: "CORNER"
        });

        var result = {
            m: m,
            zRack: zRack,
            alphaDeg: alphaDeg,
            pitchMm: pitch,
            haMm: ha,
            hfMm: hf,
            totalLengthMm: totalLength,
            totalLengthPt: totalLength * MM_TO_PT,
            backHeightMm: backHeight,
            totalHeightMm: ha + hf + backHeight,
            pitchLinePt: {
                start: [Math.round(leftX * MM_TO_PT * 10000) / 10000, 0],
                end: [Math.round(rightX * MM_TO_PT * 10000) / 10000, 0]
            },
            outerNodes: outerNodes,
            singleToothNodes: [
                { anchor: [-x_c, -hf], leftDirection: [-x_c, -hf], rightDirection: [-x_c + kappa, -hf], pointType: "SMOOTH" },
                { anchor: [-x_tan, y_tan], leftDirection: [-x_tan - kappa * sinA, y_tan - kappa * cosA], rightDirection: [-x_tan, y_tan], pointType: "SMOOTH" },
                { anchor: [-x_tip, ha], leftDirection: [-x_tip, ha], rightDirection: [-x_tip, ha], pointType: "CORNER" },
                { anchor: [0, ha], leftDirection: [0, ha], rightDirection: [0, ha], pointType: "CORNER" },
                { anchor: [x_tip, ha], leftDirection: [x_tip, ha], rightDirection: [x_tip, ha], pointType: "CORNER" },
                { anchor: [x_tan, y_tan], leftDirection: [x_tan, y_tan], rightDirection: [x_tan + kappa * sinA, y_tan - kappa * cosA], pointType: "SMOOTH" },
                { anchor: [x_c, -hf], leftDirection: [x_c - kappa, -hf], rightDirection: [x_c, -hf], pointType: "SMOOTH" }
            ]
        };

        logTrace("RACK", "Calculated rack dimensions", {
            m: m,
            zRack: zRack,
            alphaDeg: alphaDeg,
            totalLengthMm: Math.round(totalLength * 100) / 100,
            backHeightMm: Math.round(backHeight * 100) / 100,
            totalHeightMm: Math.round((ha + hf + backHeight) * 100) / 100
        });

        return result;
    }

    /**
     * Calculate meshing offset and rotation for Pinion and Rack.
     * 
     * @param {number} m Module
     * @param {number} zPinion Pinion tooth count
     * @param {number} zRack Rack tooth count
     * @param {number} angleDeg Placement direction of rack from pinion center (default -90 for bottom)
     * @param {number} phiPinionDeg Initial rotation of pinion
     */
    function calculateRackMeshing(m, zPinion, zRack, angleDeg, phiPinionDeg) {
        var angleRad = ((angleDeg !== undefined) ? angleDeg : -90.0) * (Math.PI / 180.0);
        var phiPinion = (phiPinionDeg || 0) * (Math.PI / 180.0);

        var rp_mm = (m * zPinion) / 2.0;
        var rp_pt = rp_mm * MM_TO_PT;
        var pitch = Math.PI * m;

        var contactPtX = rp_pt * Math.cos(angleRad);
        var contactPtY = rp_pt * Math.sin(angleRad);

        // Rack tangential direction: angleRad + 90 deg
        var rackRotDeg = (angleDeg !== undefined ? angleDeg : -90.0) + 90.0;

        // Kinematic shift along rack axis:
        // When pinion rotates by deltaPhi, it rolls without slipping along rack pitch line: deltaX = -rp * deltaPhi
        // Initial phase alignment:
        // When pinion tooth points directly towards contact point (phiPinion = angleRad, so deltaPhi = 0),
        // rack origin (x = 0) is already at a tooth space center (between teeth k=5 and k=6).
        // Therefore, at deltaPhi = 0, no additional phase shift is needed (rackShiftMm = 0).
        var deltaPhi = phiPinion - angleRad;
        var rackShiftMm = -rp_mm * deltaPhi;
        var rackShiftPt = rackShiftMm * MM_TO_PT;

        return {
            pinionRadiusPt: rp_pt,
            contactPointX: contactPtX,
            contactPointY: contactPtY,
            rackOriginX: contactPtX,
            rackOriginY: contactPtY,
            rackRotationDeg: rackRotDeg,
            rackShiftPt: rackShiftPt,
            pinionRotationDeg: phiPinion * (180.0 / Math.PI)
        };
    }

    /**
     * Calculate internal ring gear geometric profile using cubic Bezier curve fitting.
     * Follows JIS B 1701-1 standard proportions for internal gears:
     * - Tip circle (internal inner diameter): ra = m * (z - 2) / 2
     * - Pitch circle: rp = m * z / 2
     * - Base circle: rb = rp * cos(alpha)
     * - Root circle (external outer tooth base): rf = m * (z + 2.5) / 2
     * - Rim outer circle: r_rim = rf + rimThickness
     * 
     * @param {Object} params
     *   m: Module (mm)
     *   z: Tooth count (z >= 34 for fully involute at 20 deg)
     *   alphaDeg: Pressure angle in degrees (default 20.0)
     *   backlash: Normal backlash in mm (default 0.0)
     *   rimThickness: Rim wall thickness in mm (default 3.0 * m)
     *   pathQuality: "bezier_recommended" (6 nodes/tooth) or "bezier_minimal" (4 nodes/tooth)
     */
    function calculateInternalGear(params) {
        var m = params.m || 2.0;
        var z = params.z || 48;
        var x = params.x || 0.0;
        var alphaDeg = (params.alphaDeg !== undefined) ? params.alphaDeg : 20.0;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var backlash = params.backlash || 0.0;
        var rimThickness = (params.rimThickness !== undefined) ? params.rimThickness : (3.0 * m);
        var pathQuality = params.pathQuality || "bezier_recommended";

        var pitch = Math.PI * m;
        var rp = (m * z) / 2.0;
        var rb = rp * Math.cos(alpha);
        var ha = m;
        var hf = 1.25 * m;
        var ra = (params.ra !== undefined) ? params.ra : ((m * (z - 2.0 + 2.0 * x)) / 2.0);
        var rf = (params.rf !== undefined) ? params.rf : ((m * (z + 2.5 + 2.0 * x)) / 2.0);
        var rRim = rf + rimThickness;

        var s_eff = (pitch / 2.0) - (2.0 * x * m * Math.tan(alpha)) - backlash;
        var psi_p = s_eff / (2.0 * rp);
        var invAlpha = Math.tan(alpha) - alpha;
        var toothPitch = (2.0 * Math.PI) / z;

        var z_limit = 2.0 / (1.0 - Math.cos(alpha));
        var isUndercut = (z < z_limit);

        logTrace("INTERNAL_GEAR", "Calculated internal gear dimensions", {
            m: m, z: z, x: x, alphaDeg: alphaDeg,
            dp: Math.round(2.0 * rp * 1000) / 1000,
            da: Math.round(2.0 * ra * 1000) / 1000,
            df: Math.round(2.0 * rf * 1000) / 1000,
            db: Math.round(2.0 * rb * 1000) / 1000,
            rRim: Math.round(rRim * 1000) / 1000,
            isUndercut: isUndercut
        });

        // Concave Involute evaluator
        function getInvolutePoint(r) {
            var cos_a = Math.min(1.0, rb / Math.max(rb, r));
            var alpha_r = Math.acos(cos_a);
            var inv_r = Math.tan(alpha_r) - alpha_r;
            var th = psi_p + inv_r - invAlpha;
            var tx = Math.cos(th + alpha_r);
            var ty = Math.sin(th + alpha_r);
            return {
                r: r,
                x: r * Math.cos(th),
                y: r * Math.sin(th),
                theta: th,
                alpha_r: alpha_r,
                tx: tx,
                ty: ty
            };
        }

        // Cubic Bezier Segment Fitting Utility
        function fitBezierSegment(P0, P3, Pm) {
            var chord = Math.sqrt(Math.pow(P3.x - P0.x, 2) + Math.pow(P3.y - P0.y, 2));
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

        var useFillet = (params.useFillet !== false);
        var rcFactor = (params.rcFactor !== undefined) ? params.rcFactor : 0.38;
        var rc = rcFactor * m;

        // Inward normal for internal gear involute (towards space center)
        function getInvolutePointWithNormal(r) {
            var pt = getInvolutePoint(r);
            pt.nx = -pt.ty;
            pt.ny = pt.tx;
            return pt;
        }

        var pJuncR, pRootR, filP1, filP2, cAngle;
        var halfPitch = Math.PI / z;
        var maxAngle = halfPitch * 0.98;

        if (useFillet) {
            function solveFillet(rcTest) {
                var R_c = rf - rcTest;
                var lowR = rp;
                var highR = rf;
                function distError(r) {
                    var p = getInvolutePointWithNormal(r);
                    var cx = p.x + rcTest * p.nx;
                    var cy = p.y + rcTest * p.ny;
                    return Math.sqrt(cx * cx + cy * cy) - R_c;
                }
                if (distError(lowR) * distError(highR) > 0) return null;
                for (var iter = 0; iter < 30; iter++) {
                    var midR = (lowR + highR) / 2.0;
                    if (distError(lowR) * distError(midR) <= 0) highR = midR;
                    else lowR = midR;
                }
                var juncR = (lowR + highR) / 2.0;
                var pJ = getInvolutePointWithNormal(juncR);
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

                // Rigorous 3rd-order Bezier arc approximation for fillet (pJuncR to pRootR)
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

        var rMid = (ra + pJuncR.r) / 2.0;
        var pTipR = getInvolutePoint(ra);
        var pMidR = getInvolutePoint(rMid);

        var segR1 = fitBezierSegment(pTipR, pMidR, getInvolutePoint((ra + rMid) / 2.0));
        var segR2 = fitBezierSegment(pMidR, pJuncR, getInvolutePoint((rMid + pJuncR.r) / 2.0));

        // Tip arc control handle length (split in half with midpoint anchor on symmetry axis)
        var dThTip = 2.0 * pTipR.theta;
        var halfDThTip = pTipR.theta;
        var L_halfTip = (4.0 / 3.0) * ra * Math.tan(halfDThTip / 4.0);

        // Root space arc control handle length (dynamic check)
        var dThSpace = toothPitch - 2.0 * cAngle;
        var hasFlatSpace = (dThSpace > 0.0001);
        var L_space = hasFlatSpace ? ((4.0 / 3.0) * rf * Math.tan(dThSpace / 4.0)) : 0;

        // Assemble inner contour nodes (CCW cyclic path)
        var innerContourNodes = [];

        for (var k = 0; k < z; k++) {
            var phi_k = k * toothPitch;
            var cos_k = Math.cos(phi_k);
            var sin_k = Math.sin(phi_k);

            function rot(pt) {
                return [
                    Math.round((pt[0] * cos_k - pt[1] * sin_k) * MM_TO_PT * 10000) / 10000,
                    Math.round((pt[0] * sin_k + pt[1] * cos_k) * MM_TO_PT * 10000) / 10000
                ];
            }

            // 1. Left Root Node (at angle -cAngle)
            var p_lr = [pRootR.x, -pRootR.y];
            var tangent_lr = [Math.sin(cAngle), Math.cos(cAngle)];
            var in_h_lr = [p_lr[0] - L_space * tangent_lr[0], p_lr[1] - L_space * tangent_lr[1]];
            var out_h_lr = filP2 ? [filP2.x, -filP2.y] : [segR2.P2.x, -segR2.P2.y];

            innerContourNodes.push({
                anchor: rot(p_lr),
                leftDirection: rot(in_h_lr),
                rightDirection: rot(out_h_lr),
                pointType: hasFlatSpace ? "SMOOTH" : "CORNER"
            });

            // 2. Left Fillet Junction Node (if fillet enabled)
            if (filP1) {
                var p_lj = [pJuncR.x, -pJuncR.y];
                var in_h_lj = [filP1.x, -filP1.y];
                var out_h_lj = [segR2.P2.x, -segR2.P2.y];
                innerContourNodes.push({
                    anchor: rot(p_lj),
                    leftDirection: rot(in_h_lj),
                    rightDirection: rot(out_h_lj),
                    pointType: "SMOOTH"
                });
            }

            // 3. Left Mid Node (at angle -th_mid)
            var p_lm = [pMidR.x, -pMidR.y];
            var in_h_lm = [segR2.P1.x, -segR2.P1.y];
            var out_h_lm = [segR1.P2.x, -segR1.P2.y];

            innerContourNodes.push({
                anchor: rot(p_lm),
                leftDirection: rot(in_h_lm),
                rightDirection: rot(out_h_lm),
                pointType: "SMOOTH"
            });

            // 4. Left Tip Corner Node (at angle -th_a - Red circle)
            var p_lt = [pTipR.x, -pTipR.y];
            var in_h_lt = [segR1.P1.x, -segR1.P1.y];
            var tangent_lt = [Math.sin(pTipR.theta), Math.cos(pTipR.theta)];
            var out_h_lt = [p_lt[0] + L_halfTip * tangent_lt[0], p_lt[1] + L_halfTip * tangent_lt[1]];

            innerContourNodes.push({
                anchor: rot(p_lt),
                leftDirection: rot(in_h_lt),
                rightDirection: rot(out_h_lt),
                pointType: "CORNER"
            });

            // 5. Mid Tip Node (on tooth symmetry axis theta = 0 - Blue circle)
            var p_mt = [ra, 0.0];
            var in_h_mt = [ra, -L_halfTip];
            var out_h_mt = [ra, L_halfTip];

            innerContourNodes.push({
                anchor: rot(p_mt),
                leftDirection: rot(in_h_mt),
                rightDirection: rot(out_h_mt),
                pointType: "SMOOTH"
            });

            // 6. Right Tip Corner Node (at angle +th_a - Red circle)
            var p_rt = [pTipR.x, pTipR.y];
            var in_h_rt = [p_rt[0] + L_halfTip * Math.sin(pTipR.theta), p_rt[1] - L_halfTip * Math.cos(pTipR.theta)];
            var out_h_rt = [segR1.P1.x, segR1.P1.y];

            innerContourNodes.push({
                anchor: rot(p_rt),
                leftDirection: rot(in_h_rt),
                rightDirection: rot(out_h_rt),
                pointType: "CORNER"
            });

            // 6. Right Mid Node (at angle +th_mid)
            var p_rm = [pMidR.x, pMidR.y];
            var in_h_rm = [segR1.P2.x, segR1.P2.y];
            var out_h_rm = [segR2.P1.x, segR2.P1.y];

            innerContourNodes.push({
                anchor: rot(p_rm),
                leftDirection: rot(in_h_rm),
                rightDirection: rot(out_h_rm),
                pointType: "SMOOTH"
            });

            // 7. Right Fillet Junction Node (if fillet enabled)
            if (filP1) {
                var p_rj = [pJuncR.x, pJuncR.y];
                var in_h_rj = [segR2.P2.x, segR2.P2.y];
                var out_h_rj = [filP1.x, filP1.y];
                innerContourNodes.push({
                    anchor: rot(p_rj),
                    leftDirection: rot(in_h_rj),
                    rightDirection: rot(out_h_rj),
                    pointType: "SMOOTH"
                });
            }

            // 8. Right Root Node (at angle +cAngle)
            var p_rr = [pRootR.x, pRootR.y];
            var in_h_rr = filP2 ? [filP2.x, filP2.y] : [segR2.P2.x, segR2.P2.y];
            var tangent_rr = [-Math.sin(cAngle), Math.cos(cAngle)];
            var out_h_rr = [p_rr[0] + L_space * tangent_rr[0], p_rr[1] + L_space * tangent_rr[1]];

            innerContourNodes.push({
                anchor: rot(p_rr),
                leftDirection: rot(in_h_rr),
                rightDirection: rot(out_h_rr),
                pointType: hasFlatSpace ? "SMOOTH" : "CORNER"
            });
        }

        // Rim outer circle nodes (standard 4-bezier circle)
        var rimCircleNodes = [];
        var KAPPA = (4.0 / 3.0) * (Math.sqrt(2.0) - 1.0); // ~0.5522847
        var rRimPt = rRim * MM_TO_PT;
        var kRimPt = rRimPt * KAPPA;

        // Node 0: Right (rRim, 0)
        rimCircleNodes.push({
            anchor: [Math.round(rRimPt * 10000) / 10000, 0],
            leftDirection: [Math.round(rRimPt * 10000) / 10000, Math.round(-kRimPt * 10000) / 10000],
            rightDirection: [Math.round(rRimPt * 10000) / 10000, Math.round(kRimPt * 10000) / 10000],
            pointType: "SMOOTH"
        });
        // Node 1: Top (0, rRim)
        rimCircleNodes.push({
            anchor: [0, Math.round(rRimPt * 10000) / 10000],
            leftDirection: [Math.round(kRimPt * 10000) / 10000, Math.round(rRimPt * 10000) / 10000],
            rightDirection: [Math.round(-kRimPt * 10000) / 10000, Math.round(rRimPt * 10000) / 10000],
            pointType: "SMOOTH"
        });
        // Node 2: Left (-rRim, 0)
        rimCircleNodes.push({
            anchor: [Math.round(-rRimPt * 10000) / 10000, 0],
            leftDirection: [Math.round(-rRimPt * 10000) / 10000, Math.round(kRimPt * 10000) / 10000],
            rightDirection: [Math.round(-rRimPt * 10000) / 10000, Math.round(-kRimPt * 10000) / 10000],
            pointType: "SMOOTH"
        });
        // Node 3: Bottom (0, -rRim)
        rimCircleNodes.push({
            anchor: [0, Math.round(-rRimPt * 10000) / 10000],
            leftDirection: [Math.round(-kRimPt * 10000) / 10000, Math.round(-rRimPt * 10000) / 10000],
            rightDirection: [Math.round(kRimPt * 10000) / 10000, Math.round(-rRimPt * 10000) / 10000],
            pointType: "SMOOTH"
        });

        return {
            m: m,
            z: z,
            x: x,
            alphaDeg: alphaDeg,
            pitchMm: pitch,
            rpMm: rp,
            rbMm: rb,
            raMm: ra,
            rfMm: rf,
            rRimMm: rRim,
            rpPt: rp * MM_TO_PT,
            rbPt: rb * MM_TO_PT,
            raPt: ra * MM_TO_PT,
            rfPt: rf * MM_TO_PT,
            rRimPt: rRimPt,
            isUndercut: isUndercut,
            innerContourNodes: innerContourNodes,
            rimCircleNodes: rimCircleNodes,
            singleToothNodes: (function() {
                var stn = [];
                stn.push({ anchor: [pRootR.x, -pRootR.y], leftDirection: [pRootR.x - L_space * Math.sin(cAngle), -pRootR.y - L_space * Math.cos(cAngle)], rightDirection: (filP2 ? [filP2.x, -filP2.y] : [segR2.P2.x, -segR2.P2.y]), pointType: hasFlatSpace ? "SMOOTH" : "CORNER" });
                if (filP1) stn.push({ anchor: [pJuncR.x, -pJuncR.y], leftDirection: [filP1.x, -filP1.y], rightDirection: [segR2.P2.x, -segR2.P2.y], pointType: "SMOOTH" });
                stn.push({ anchor: [pMidR.x, -pMidR.y], leftDirection: [segR2.P1.x, -segR2.P1.y], rightDirection: [segR1.P2.x, -segR1.P2.y], pointType: "SMOOTH" });
                stn.push({ anchor: [pTipR.x, -pTipR.y], leftDirection: [segR1.P1.x, -segR1.P1.y], rightDirection: [pTipR.x + L_halfTip * Math.sin(pTipR.theta), -pTipR.y + L_halfTip * Math.cos(pTipR.theta)], pointType: "CORNER" });
                stn.push({ anchor: [ra, 0.0], leftDirection: [ra, -L_halfTip], rightDirection: [ra, L_halfTip], pointType: "SMOOTH" });
                stn.push({ anchor: [pTipR.x, pTipR.y], leftDirection: [pTipR.x + L_halfTip * Math.sin(pTipR.theta), pTipR.y - L_halfTip * Math.cos(pTipR.theta)], rightDirection: [segR1.P1.x, segR1.P1.y], pointType: "CORNER" });
                stn.push({ anchor: [pMidR.x, pMidR.y], leftDirection: [segR1.P2.x, segR1.P2.y], rightDirection: [segR2.P1.x, segR2.P1.y], pointType: "SMOOTH" });
                if (filP1) stn.push({ anchor: [pJuncR.x, pJuncR.y], leftDirection: [segR2.P2.x, segR2.P2.y], rightDirection: [filP1.x, filP1.y], pointType: "SMOOTH" });
                stn.push({ anchor: [pRootR.x, pRootR.y], leftDirection: (filP2 ? [filP2.x, filP2.y] : [segR2.P2.x, segR2.P2.y]), rightDirection: [pRootR.x - L_space * Math.sin(cAngle), pRootR.y + L_space * Math.cos(cAngle)], pointType: hasFlatSpace ? "SMOOTH" : "CORNER" });
                return stn;
            })()
        };
    }

    /**
     * Calculate internal gear pair meshing parameters (Pinion inside Internal Ring Gear).
     * 
     * @param {number} m Module
     * @param {number} zPinion Pinion tooth count
     * @param {number} zInternal Internal gear tooth count
     * @param {number} angleDeg Contact point direction from pinion center (default -90 for bottom)
     * @param {number} phiPinionDeg Pinion rotation angle in degrees
     */
    function calculateInternalMeshing(m, zPinion, zInternal, angleDeg, phiPinionDeg) {
        var angleRad = ((angleDeg !== undefined) ? angleDeg : -90.0) * (Math.PI / 180.0);
        var phiPinion = (phiPinionDeg || 0) * (Math.PI / 180.0);

        var rp1_mm = (m * zPinion) / 2.0;
        var rp2_mm = (m * zInternal) / 2.0;
        var a_center_mm = rp2_mm - rp1_mm;

        var rp1_pt = rp1_mm * MM_TO_PT;
        var rp2_pt = rp2_mm * MM_TO_PT;
        var a_center_pt = a_center_mm * MM_TO_PT;

        // Pinion center is at (0, 0)
        // Contact point C is at distance rp1 along angleRad:
        var contactPtX = rp1_pt * Math.cos(angleRad);
        var contactPtY = rp1_pt * Math.sin(angleRad);

        // Internal gear center is at distance (rp2 - rp1) in the opposite direction (-angleRad)
        // C = O_pinion + rp1 * u = O_internal + rp2 * u
        // O_internal = C - rp2 * u = O_pinion + (rp1 - rp2) * u = O_pinion - a_center * u
        var internalCenterX = -a_center_pt * Math.cos(angleRad);
        var internalCenterY = -a_center_pt * Math.sin(angleRad);

        // Rotation phase alignment:
        // Nearest tooth space on pinion and nearest tooth on internal gear relative to contact angle:
        var tau1 = (2.0 * Math.PI) / zPinion;
        var tau2 = (2.0 * Math.PI) / zInternal;

        var phase1 = (angleRad / tau1) - 0.5;
        var k1 = Math.round(phase1);
        var delta1 = (k1 + 0.5) * tau1 - angleRad;

        var phase2 = angleRad / tau2;
        var k2 = Math.round(phase2);
        var delta2 = k2 * tau2 - angleRad;

        // Kinematic relation: same rotational direction!
        var phi2 = (phiPinion + delta1) * (zPinion / zInternal) - delta2;

        return {
            centerDistanceMm: a_center_mm,
            centerDistancePt: a_center_pt,
            contactPointX: contactPtX,
            contactPointY: contactPtY,
            pinionCenterX: 0,
            pinionCenterY: 0,
            internalCenterX: internalCenterX,
            internalCenterY: internalCenterY,
            pinionRotationDeg: phiPinion * (180.0 / Math.PI),
            internalRotationDeg: phi2 * (180.0 / Math.PI)
        };
    }

    /**
     * Calculate 3K Paradoxical Planetary Gear System (differential planetary gear).
     * Solves required profile shift xr2 for Ring 2 to strictly equal center distance a.
     * 
     * @param {Object} params
     *   m: Module (mm)
     *   zs: Sun tooth count
     *   zp: Common planet tooth count
     *   zr1: Fixed ring gear tooth count (must equal zs + 2*zp)
     *   zr2: Output ring gear tooth count (e.g. zr1 - 1 or zr1 + 1)
     *   alphaDeg: Base pressure angle (default 20.0)
     *   numPlanets: Number of planets (default 3)
     *   backlash: Backlash (default 0.0)
     *   rimThickness: Ring rim thickness (default 3*m)
     */
    function calculateParadoxicalPlanetary(params) {
        var m = params.m || 2.0;
        var zs = params.zs || 12;
        var zp = params.zp || 18;
        var zr1 = params.zr1 || (zs + 2 * zp);
        var zr2 = (params.zr2 !== undefined) ? params.zr2 : (zr1 - 1);
        var alphaDeg = (params.alphaDeg !== undefined) ? params.alphaDeg : 20.0;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var numPlanets = params.numPlanets || 3;
        var backlash = params.backlash || 0.0;
        var rimThickness = (params.rimThickness !== undefined) ? params.rimThickness : (3.0 * m);

        // 1. Concentricity validation
        if (zr1 !== (zs + 2 * zp)) {
            throw new Error("Concentricity error: zr1 must equal zs + 2*zp (" + (zs + 2 * zp) + ")");
        }

        // Common center distance (mm)
        var a_center_mm = (m * (zs + zp)) / 2.0;
        var a_center_pt = a_center_mm * MM_TO_PT;

        // 2. Reduction ratio: i = zr2 / (zr2 - zr1)
        var deltaZ = zr2 - zr1;
        var reductionRatio = (deltaZ !== 0) ? (zr2 / deltaZ) : 0;

        // 3. Solve profile shift for Ring 2
        var a0_2 = (m * (zr2 - zp)) / 2.0;
        var cos_aw2 = (a0_2 / a_center_mm) * Math.cos(alpha);

        if (cos_aw2 <= 0.0 || cos_aw2 > 1.0) {
            throw new Error("Geometric impossibility: cos(alpha_w2) = " + cos_aw2 + " > 1. Cannot mesh common planet zp=" + zp + " with zr2=" + zr2 + " at a=" + a_center_mm + "mm");
        }

        var alpha_w2 = Math.acos(cos_aw2);
        var inv_a = inv(alpha);
        var inv_aw2 = inv(alpha_w2);

        // Profile shift difference (xr2 - xp) with xp = 0:
        var xr2 = (zr2 - zp) * (inv_aw2 - inv_a) / (2.0 * Math.tan(alpha));

        // 4. Generate gear geometries
        var sunData = calculateSpurGear({
            m: m,
            z: zs,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: 5.0,
            pathQuality: "bezier_recommended"
        });

        var planetData = calculateSpurGear({
            m: m,
            z: zp,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: 4.0,
            pathQuality: "bezier_recommended"
        });

        var ring1Data = calculateInternalGear({
            m: m,
            z: zr1,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            rimThickness: rimThickness,
            pathQuality: "bezier_recommended"
        });

        var ring2Data = calculateInternalGear({
            m: m,
            z: zr2,
            x: xr2,
            alphaDeg: alphaDeg,
            backlash: backlash,
            rimThickness: rimThickness,
            pathQuality: "bezier_recommended"
        });

        // 5. Planet positions and rotations
        var planets = [];
        var planetSpacingDeg = 360.0 / numPlanets;

        // Assembly validation for identical common planets:
        // To mesh simultaneously with both rings, deltaZ must be a multiple of numPlanets
        var isMultiPlanetValid = (Math.abs(deltaZ) % numPlanets === 0);

        for (var i = 0; i < numPlanets; i++) {
            var orbitDeg = i * planetSpacingDeg;
            var orbitRad = orbitDeg * (Math.PI / 180.0);

            var px = a_center_pt * Math.cos(orbitRad);
            var py = a_center_pt * Math.sin(orbitRad);

            // Planet rotation phase:
            // Aligns tooth space with Sun at (orbitDeg + 180) and tooth space with Ring at orbitDeg:
            var phiPlanetDeg = orbitDeg - (180.0 / zp);

            planets.push({
                index: i,
                orbitDeg: orbitDeg,
                centerX: px,
                centerY: py,
                rotationDeg: phiPlanetDeg
            });
        }

        return {
            m: m,
            zs: zs,
            zp: zp,
            zr1: zr1,
            zr2: zr2,
            deltaZ: deltaZ,
            isMultiPlanetValid: isMultiPlanetValid,
            reductionRatio: reductionRatio,
            centerDistanceMm: a_center_mm,
            centerDistancePt: a_center_pt,
            alphaDeg: alphaDeg,
            alpha_w2_deg: alpha_w2 * (180.0 / Math.PI),
            xr2: xr2,
            sunData: sunData,
            planetData: planetData,
            ring1Data: ring1Data,
            ring2Data: ring2Data,
            planets: planets
        };
    }

    /**
     * Calculate Standard 2K-H Planetary Gear System (Sun, N Planets, 1 Ring Gear).
     * 
     * @param {Object} params
     *   m: Module (mm)
     *   zs: Sun tooth count
     *   zp: Planet tooth count
     *   zr: Ring gear tooth count (default zs + 2*zp)
     *   alphaDeg: Base pressure angle (default 20.0)
     *   numPlanets: Number of planets (default 3)
     *   backlash: Backlash (default 0.0)
     *   rimThickness: Ring rim thickness (default 3*m)
     *   pathQuality: Bezier path quality (default "bezier_recommended")
     */
    function calculateStandardPlanetary(params) {
        var m = params.m || 2.0;
        var zs = params.zs || 18;
        var zp = params.zp || 18;
        var zr = params.zr || (zs + 2 * zp);
        var alphaDeg = (params.alphaDeg !== undefined) ? params.alphaDeg : 20.0;
        var numPlanets = params.numPlanets || 3;
        var backlash = params.backlash || 0.0;
        var rimThickness = (params.rimThickness !== undefined) ? params.rimThickness : (3.0 * m);
        var pathQuality = params.pathQuality || "bezier_recommended";

        // Concentricity validation
        if (zr !== (zs + 2 * zp)) {
            throw new Error("Concentricity error: zr (" + zr + ") must equal zs + 2*zp (" + (zs + 2 * zp) + ")");
        }

        // Assembly validation
        var isAssemblyValid = ((zs + zr) % numPlanets === 0);

        var a_center_mm = (m * (zs + zp)) / 2.0;
        var a_center_pt = a_center_mm * MM_TO_PT;

        // Reduction ratio (Fixed Ring): i = 1 + zr / zs
        var reductionRatio = 1.0 + (zr / zs);

        // Generate gears
        var sunData = calculateSpurGear({
            m: m,
            z: zs,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: 5.0,
            pathQuality: pathQuality
        });

        var planetData = calculateSpurGear({
            m: m,
            z: zp,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: 4.0,
            pathQuality: pathQuality
        });

        var ringData = calculateInternalGear({
            m: m,
            z: zr,
            x: 0.0,
            alphaDeg: alphaDeg,
            backlash: backlash,
            rimThickness: rimThickness,
            pathQuality: pathQuality
        });

        // Planets array
        var planets = [];
        var planetSpacingDeg = 360.0 / numPlanets;

        for (var i = 0; i < numPlanets; i++) {
            var orbitDeg = i * planetSpacingDeg;
            var orbitRad = orbitDeg * (Math.PI / 180.0);

            var px = a_center_pt * Math.cos(orbitRad);
            var py = a_center_pt * Math.sin(orbitRad);

            // Phase alignment
            var phiPlanetDeg = orbitDeg - (180.0 / zp);

            planets.push({
                index: i,
                orbitDeg: orbitDeg,
                centerX: px,
                centerY: py,
                rotationDeg: phiPlanetDeg
            });
        }

        // Adjacent planets clearance check
        var dap = m * (zp + 2.0);
        var planetDistance = 2.0 * a_center_mm * Math.sin(Math.PI / numPlanets);
        var planetClearance = planetDistance - dap;

        return {
            m: m,
            zs: zs,
            zp: zp,
            zr: zr,
            numPlanets: numPlanets,
            isAssemblyValid: isAssemblyValid,
            reductionRatio: reductionRatio,
            centerDistanceMm: a_center_mm,
            centerDistancePt: a_center_pt,
            alphaDeg: alphaDeg,
            planetClearanceMm: planetClearance,
            sunData: sunData,
            planetData: planetData,
            ringData: ringData,
            planets: planets
        };
    }

    /**
     * Design Solver: Automatically search and rank feasible tooth combinations for 2K-H Planetary Gear System.
     * Supports flexible constraints: targetRatio, fixed tooth counts (fixedZs, fixedZp, fixedZr),
     * planet counts (numPlanets), and operation modes (ring_fixed, sun_fixed, carrier_fixed).
     * 
     * @param {Object} specs
     *   mode: "ring_fixed" | "sun_fixed" | "carrier_fixed" (default "ring_fixed")
     *   targetRatio: Target reduction ratio (optional)
     *   m: Module (mm, default 2.0)
     *   numPlanets: Number of planets (optional, default [2, 3, 4, 5, 6])
     *   alphaDeg: Pressure angle (default 20.0)
     *   tol: Ratio tolerance (default 0.10)
     *   fixedZs: Fixed sun teeth (optional)
     *   fixedZp: Fixed planet teeth (optional)
     *   fixedZr: Fixed ring teeth (optional)
     *   zsMin, zsMax, zpMin, zpMax: Search ranges
     * @returns {Array} List of candidate solution objects
     */

    /**
     * Replaces template tokens like {id}, {z}, {m}, {toothType}, {kind}, etc. with context values.
     * 
     * @param {String} template 
     * @param {Object} ctx 
     * @returns {String}
     */
    function formatName(template, ctx) {
        if (!template) return "";
        ctx = ctx || {};

        // Auto-populate tooth type tokens if not explicitly provided
        if (!ctx.toothType) {
            var gType = (ctx.gearType || ctx.type || "").toUpperCase();
            if (gType === "INTERNAL") {
                ctx.toothType = "Internal";
                ctx.kind = ctx.kind || "Int";
                ctx.form = ctx.form || "Int";
                ctx.toothTypeJP = ctx.toothTypeJP || "\u5185\u6b6f";
            } else if (gType === "RACK") {
                ctx.toothType = "Rack";
                ctx.kind = ctx.kind || "Rck";
                ctx.form = ctx.form || "Rck";
                ctx.toothTypeJP = ctx.toothTypeJP || "\u30e9\u30c3\u30af";
            } else {
                ctx.toothType = "External";
                ctx.kind = ctx.kind || "Ext";
                ctx.form = ctx.form || "Ext";
                ctx.toothTypeJP = ctx.toothTypeJP || "\u5916\u6b6f";
            }
        }

        return template.replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, key) {
            if (ctx.hasOwnProperty(key)) {
                var val = ctx[key];
                if (typeof val === "number") {
                    if (key === "m" || key === "shaft" || key === "ratio") {
                        return val.toFixed(1).replace(/\.0$/, "");
                    } else if (key === "d" || key === "pcd" || key === "da") {
                        return val.toFixed(1);
                    }
                }
                return (val !== undefined && val !== null) ? String(val) : "";
            }
            return match;
        });
    }

    var NAMING_PRESETS = {
        standard: {
            mainLayer: "{train}",
            subLayer: "{train}_{layer}",
            dwgLayer: "{train}_dwg",
            gearGroup: "{id}_{kind}_z{z}"
        },
        engineering: {
            mainLayer: "Train_{train}_m{m}",
            subLayer: "{train}_L{layer}",
            dwgLayer: "DWG_{train}_Skeleton",
            gearGroup: "{id}_{toothType}_m{m}_z{z}_d{d}_h{shaft}"
        },
        cam: {
            mainLayer: "CUT_{train}",
            subLayer: "{train}_L{layer}",
            dwgLayer: "REG_{train}",
            gearGroup: "{train}_L{layer}_{kind}_{id}_z{z}"
        }
    };


    exports.MM_TO_PT = MM_TO_PT;
    exports.PT_TO_MM = PT_TO_MM;
    exports.inv = inv;
    exports.invInv = invInv;
    exports.getUndercutLimit = getUndercutLimit;
    exports.JIS_B_1301_TABLE = JIS_B_1301_TABLE;
    exports.getJISKeywayDimensions = getJISKeywayDimensions;
    exports.getDCutDepth = getDCutDepth;
    exports.normalizeShaftType = normalizeShaftType;
    exports.calculateShaftHoleGeometry = calculateShaftHoleGeometry;
    exports.calculateAlignmentPinHoles = calculateAlignmentPinHoles;
    exports.createArcBezierNodes = createArcBezierNodes;
    exports.createConcaveLockArcNodes = createConcaveLockArcNodes;
    exports.calculateSpurGear = calculateSpurGear;
    exports.calculateMeshingPair = calculateMeshingPair;
    exports.calculateRack = calculateRack;
    exports.calculateRackMeshing = calculateRackMeshing;
    exports.calculateInternalGear = calculateInternalGear;
    exports.calculateInternalMeshing = calculateInternalMeshing;
    exports.calculateParadoxicalPlanetary = calculateParadoxicalPlanetary;
    exports.calculateStandardPlanetary = calculateStandardPlanetary;
    exports.formatName = formatName;
    exports.NAMING_PRESETS = NAMING_PRESETS;
})(InvoluteMath);

/**
 * MechanismSolvers.jsxinc - Planetary & Paradoxical Inverse Solvers
 * Part of GearDrawer Architecture (Hori et al. 1994 High-efficiency Paradoxical Design)
 */

var InvoluteMath = InvoluteMath || {};

(function (exports) {
// Global conversion constants & helpers
var MM_TO_PT = 72.0 / 25.4;
var PT_TO_MM = 25.4 / 72.0;

function logTrace(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.log(category, msg, data);
    }
}

function logWarn(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.warn(category, msg, data);
    }
}

    function solveStandardPlanetary(specs) {
        specs = specs || {};
        var mode = specs.mode || "ring_fixed"; // "ring_fixed", "sun_fixed", "carrier_fixed"
        var targetRatio = (specs.targetRatio !== undefined && specs.targetRatio !== null && !isNaN(specs.targetRatio) && specs.targetRatio !== 0) ? specs.targetRatio : null;
        var tol = (specs.tol !== undefined) ? specs.tol : 0.10;
        var m = specs.m || 2.0;
        var alphaDeg = specs.alphaDeg || 20.0;

        var numPlanetsList = specs.numPlanets ? [specs.numPlanets] : [2, 3, 4, 5, 6];

        var fixedZs = specs.fixedZs || null;
        var fixedZp = specs.fixedZp || null;
        var fixedZr = specs.fixedZr || null;

        var zsMin = fixedZs ? fixedZs : (specs.zsMin || 12);
        var zsMax = fixedZs ? fixedZs : (specs.zsMax || 60);

        var candidates = [];

        for (var zs = zsMin; zs <= zsMax; zs++) {
            var zpMin = fixedZp ? fixedZp : 12;
            var zpMax = fixedZp ? fixedZp : 60;

            for (var zp = zpMin; zp <= zpMax; zp++) {
                var zr = zs + 2 * zp; // Concentricity condition
                if (fixedZr && zr !== fixedZr) continue;

                for (var nIdx = 0; nIdx < numPlanetsList.length; nIdx++) {
                    var N = numPlanetsList[nIdx];

                    // Assembly condition: (zs + zr) % N === 0
                    if ((zs + zr) % N !== 0) continue;

                    // Ratio calculation according to mode
                    var ratio = 0;
                    var modeName = "";
                    if (mode === "sun_fixed") {
                        ratio = 1.0 + (zs / zr); // Ring in, Carrier out
                        modeName = "太陽固定";
                    } else if (mode === "carrier_fixed") {
                        ratio = zr / zs; // Sun in, Ring out (reversed)
                        modeName = "キャリア固定";
                    } else {
                        ratio = 1.0 + (zr / zs); // Sun in, Carrier out
                        modeName = "内歯車固定";
                    }

                    // If targetRatio specified, filter by tol
                    var ratioErr = 0;
                    if (targetRatio !== null && targetRatio > 0) {
                        ratioErr = Math.abs(ratio - targetRatio) / targetRatio;
                        if (ratioErr > tol) continue;
                    }

                    // Adjacent planet clearance
                    var a = (m * (zs + zp)) / 2.0;
                    var dap = m * (zp + 2.0);
                    var pDist = 2.0 * a * Math.sin(Math.PI / N);
                    var clearance = pDist - dap;
                    if (clearance < 0.5) continue; // Min 0.5mm clearance

                    // Internal gear trochoid clearance
                    if (zr - zp < 8) continue;

                    var outerDiam = m * (zr + 6.0);

                    candidates.push({
                        mode: mode,
                        zs: zs,
                        zp: zp,
                        zr: zr,
                        numPlanets: N,
                        ratio: Math.round(ratio * 1000) / 1000,
                        ratioError: Math.round(ratioErr * 10000) / 100,
                        centerDistanceMm: Math.round(a * 100) / 100,
                        clearanceMm: Math.round(clearance * 100) / 100,
                        outerDiameterMm: Math.round(outerDiam * 10) / 10,
                        label: "S:" + zs + " P:" + zp + " R:" + zr + " (N=" + N + ", i=" + ratio.toFixed(2) + (targetRatio ? (", Err=" + (ratioErr * 100).toFixed(1) + "%") : "") + ", OD=" + outerDiam.toFixed(0) + "mm)"
                    });
                }
            }
        }

        candidates.sort(function (a, b) {
            if (targetRatio !== null) {
                return (a.ratioError - b.ratioError) || (a.outerDiameterMm - b.outerDiameterMm);
            }
            return (a.ratio - b.ratio) || (a.outerDiameterMm - b.outerDiameterMm);
        });

        return candidates;
    }

    /**
     * Design Solver: Automatically search and rank feasible tooth combinations for 3K Paradoxical Planetary Gear System.
     * Supports flexible constraints: targetRatio, fixed teeth (fixedZs, fixedZp, fixedZr1, fixedZr2),
     * planet counts (numPlanets).
     * 
     * @param {Object} specs
     *   targetRatio: Target reduction ratio (optional, e.g. 50.0 to 400.0)
     *   m: Module (mm, default 2.0)
     *   numPlanets: Number of planets (optional, default [2, 3, 4])
     *   alphaDeg: Pressure angle (default 20.0)
     *   tol: Ratio tolerance (default 0.20)
     *   fixedZs, fixedZp, fixedZr1, fixedZr2: Optional fixed teeth constraints
     *   zsMin, zsMax, zpMin, zpMax: Search ranges
     * @returns {Array} List of candidate solution objects
     */
    /**
     * Solves gear tooth count combinations for 3K paradoxical planetary gear train.
     * Implements Hori et al. (1994) / InvoluteGearSoft algorithm for maximum efficiency and positive profile shift:
     *   - Sun (Zs) and Output Ring (Zr2) are multiples of number of planets (N)
     *   - Ideal pinion: Z2_ideal = (Zr2 - Zs) / 2
     *   - Adopted pinion: Zp = Z2_ideal - 1 (intentional tooth reduction for all-positive shift)
     *   - Fixed Ring: Zr1 = Zr2 - DeltaZ, where DeltaZ is a multiple of N (+/- N, +/- 2N)
     *   - Ratio: i = [Zr2 * (Zs + Zr1)] / [Zs * (Zr2 - Zr1)]
     * Also supports general constraints search with specified fixed teeth or N.
     * 
     * @param {Object} specs
     *   targetRatio: Target reduction ratio (optional)
     *   numPlanets: Number of planets (optional, e.g. 2, 3, 4, 5; or array of candidates)
     *   alphaDeg: Pressure angle (default 20.0)
     *   tol: Ratio tolerance (default 0.25)
     *   fixedZs, fixedZp, fixedZr1, fixedZr2: Optional fixed teeth constraints
     *   zsMin, zsMax, zpMin, zpMax: Search ranges
     *   preferHoriMethod: boolean (default true)
     * @returns {Array} List of candidate solution objects
     */
    function solveParadoxicalPlanetary(specs) {
        specs = specs || {};
        var targetRatio = (specs.targetRatio !== undefined && specs.targetRatio !== null && !isNaN(specs.targetRatio) && specs.targetRatio !== 0) ? specs.targetRatio : null;
        var tol = (specs.tol !== undefined) ? specs.tol : 0.25;
        var m = specs.m || 2.0;
        var alphaDeg = specs.alphaDeg || 20.0;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var invAlpha = Math.tan(alpha) - alpha;
        var cosAlpha = Math.cos(alpha);

        var numPlanetsList = specs.numPlanets ? [specs.numPlanets] : [2, 3, 4, 5];

        var fixedZs = specs.fixedZs || null;
        var fixedZp = specs.fixedZp || null;
        var fixedZr1 = specs.fixedZr1 || null;
        var fixedZr2 = specs.fixedZr2 || null;

        var candidates = [];
        var seenKeys = {};

        for (var nIdx = 0; nIdx < numPlanetsList.length; nIdx++) {
            var N = numPlanetsList[nIdx];
            if (N < 1) continue;

            // Determine search range for Zs (Sun)
            var zsMin = fixedZs ? fixedZs : (specs.zsMin || (N * Math.max(2, Math.ceil(12 / N))));
            var zsMax = fixedZs ? fixedZs : (specs.zsMax || 60);

            // Step 1: Hori et al. (1994) positive profile shift method
            // Sun Zs and Output Ring Zr2 are multiples of N
            for (var zs = zsMin; zs <= zsMax; zs++) {
                if (!fixedZs && (zs % N !== 0)) continue; // Must be multiple of N in Hori method

                // Loop over possible Z2_ideal
                var z2IdealMin = fixedZp ? (fixedZp + 1) : 10;
                var z2IdealMax = fixedZp ? (fixedZp + 1) : 45;

                for (var z2Ideal = z2IdealMin; z2Ideal <= z2IdealMax; z2Ideal++) {
                    var zp = fixedZp ? fixedZp : (z2Ideal - 1); // 1 tooth reduced
                    if (zp < 9) continue; // Minimum feasible pinion teeth

                    var zr2_ideal = zs + 2 * z2Ideal;
                    if (!fixedZr2 && (zr2_ideal % N !== 0)) continue; // Must be multiple of N

                    // Allowed DeltaZ values: multiples of N (+/- N, +/- 2N)
                    var deltaZList = (N === 1) ? [-1, 1, -2, 2] : [-N, N, -2 * N, 2 * N];

                    for (var dIdx = 0; dIdx < deltaZList.length; dIdx++) {
                        var deltaZ = deltaZList[dIdx];
                        var zr2 = fixedZr2 ? fixedZr2 : zr2_ideal;
                        var zr1 = zr2 - deltaZ;

                        if (fixedZr1 && zr1 !== fixedZr1) continue;
                        if (fixedZr2 && zr2 !== fixedZr2) continue;
                        if (zr1 <= zp + 6 || zr2 <= zp + 6) continue; // Interference margin

                        // Assembly condition check
                        if ((zs + zr1) % N !== 0) continue;
                        if ((zs + zr2) % N !== 0) continue;

                        // Calculate center distance based on sun & planet with positive profile shift
                        // Standard center distance for sun-planet
                        var a0_sp = (m * (zs + zp)) / 2.0;
                        // Center distance given by ideal geometry:
                        var a_oper = (m * (zs + z2Ideal)) / 2.0; // Nominal operating center distance

                        // Operating pressure angle between Sun and Pinion
                        var cosAw_sp = (a0_sp / a_oper) * cosAlpha;
                        if (cosAw_sp <= 0.0 || cosAw_sp >= 1.0) continue;
                        var aw_sp = Math.acos(cosAw_sp);
                        var invAw_sp = Math.tan(aw_sp) - aw_sp;
                        var sumX_sp = ((zs + zp) * (invAw_sp - invAlpha)) / (2.0 * Math.tan(alpha));

                        // Operating conditions for Pinion and Ring 1 (Fixed)
                        var a0_p1 = (m * (zr1 - zp)) / 2.0;
                        var cosAw_p1 = (a0_p1 / a_oper) * cosAlpha;
                        if (cosAw_p1 <= 0.0 || cosAw_p1 >= 1.0) continue;
                        var aw_p1 = Math.acos(cosAw_p1);
                        var invAw_p1 = Math.tan(aw_p1) - aw_p1;
                        var diffX_p1 = ((zr1 - zp) * (invAw_p1 - invAlpha)) / (2.0 * Math.tan(alpha));

                        // Operating conditions for Pinion and Ring 2 (Output)
                        var a0_p2 = (m * (zr2 - zp)) / 2.0;
                        var cosAw_p2 = (a0_p2 / a_oper) * cosAlpha;
                        if (cosAw_p2 <= 0.0 || cosAw_p2 >= 1.0) continue;
                        var aw_p2 = Math.acos(cosAw_p2);
                        if (aw_p2 > 35.0 * (Math.PI / 180.0)) continue;
                        var invAw_p2 = Math.tan(aw_p2) - aw_p2;
                        var diffX_p2 = ((zr2 - zp) * (invAw_p2 - invAlpha)) / (2.0 * Math.tan(alpha));
                        if (Math.abs(diffX_p2) > 2.2) continue;

                        // Pinion outer diameter and adjacent planet clearance
                        var dap = m * (zp + 2.0);
                        if (N > 1) {
                            var pDist = 2.0 * a_oper * Math.sin(Math.PI / N);
                            if (pDist - dap < 0.5) continue; // Clearance check
                        }

                        // Reduction ratio: i = [Zr2 * (Zs + Zr1)] / [Zs * (Zr2 - Zr1)]
                        var actualRatio = (zr2 * (zs + zr1)) / (zs * deltaZ);
                        var ratioErr = 0;
                        if (targetRatio !== null) {
                            ratioErr = Math.abs(actualRatio - targetRatio) / Math.abs(targetRatio);
                            if (ratioErr > tol) continue;
                        }

                        // Efficiency estimate (Hori et al. formulation with high-efficiency positive shift)
                        var mu = 0.055; // Lower friction coefficient due to positive shift and lower sliding velocity
                        var eff = (1.0 - mu * Math.PI * (1.0 / zs + 1.0 / zp)) / (1.0 + Math.abs(zr1 / deltaZ) * mu * Math.PI * (1.0 / zp - 1.0 / zr2));
                        eff = Math.max(0.15, Math.min(0.95, eff));

                        var key = zs + "_" + zp + "_" + zr1 + "_" + zr2 + "_" + N;
                        if (seenKeys[key]) continue;
                        seenKeys[key] = true;

                        var outerDiam = m * (Math.max(zr1, zr2) + 6.0);

                        candidates.push({
                            zs: zs,
                            zp: zp,
                            zr1: zr1,
                            zr2: zr2,
                            numPlanets: N,
                            deltaZ: deltaZ,
                            isHoriMethod: (zp === z2Ideal - 1),
                            xr2: Math.round(diffX_p2 * 1000) / 1000,
                            sumX_sp: Math.round(sumX_sp * 1000) / 1000,
                            aw2Deg: Math.round(aw_p2 * (180.0 / Math.PI) * 10) / 10,
                            ratio: Math.round(actualRatio * 10) / 10,
                            ratioError: Math.round(ratioErr * 10000) / 100,
                            centerDistanceMm: Math.round(a_oper * 100) / 100,
                            outerDiameterMm: Math.round(outerDiam * 10) / 10,
                            efficiencyEst: Math.round(eff * 100),
                            label: "S:" + zs + " P:" + zp + " R1:" + zr1 + " R2:" + zr2 + " (N=" + N + ", i=" + actualRatio.toFixed(1) + ", \u03b7\u2248" + Math.round(eff * 100) + "%" + (zp === z2Ideal - 1 ? ", 堀・正転位" : "") + ")"
                        });
                    }
                }
            }

            // Step 2: Fallback general search (standard meshing with Zr1 = Zs + 2*Zp)
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
                        if ((zsGen + zr2Gen) % N !== 0) continue;

                        var keyGen = zsGen + "_" + zpGen + "_" + zr1Gen + "_" + zr2Gen + "_" + N;
                        if (seenKeys[keyGen]) continue;
                        seenKeys[keyGen] = true;

                        var actualRatioGen = ((zsGen + zr1Gen) * zr2Gen) / (zsGen * dZGen);
                        var ratioErrGen = 0;
                        if (targetRatio !== null) {
                            ratioErrGen = Math.abs(actualRatioGen - targetRatio) / Math.abs(targetRatio);
                            if (ratioErrGen > tol) continue;
                        }

                        var a0_2Gen = (m * (zr2Gen - zpGen)) / 2.0;
                        var cosAw2Gen = (a0_2Gen / aGen) * cosAlpha;
                        if (cosAw2Gen <= 0.0 || cosAw2Gen >= 1.0) continue;
                        var aw2Gen = Math.acos(cosAw2Gen);
                        if (aw2Gen > 35.0 * (Math.PI / 180.0)) continue;
                        var invAw2Gen = Math.tan(aw2Gen) - aw2Gen;
                        var xr2Gen = (zr2Gen - zpGen) * (invAw2Gen - invAlpha) / (2.0 * Math.tan(alpha));
                        if (Math.abs(xr2Gen) > 2.2) continue;

                        var outerDiamGen = m * (Math.max(zr1Gen, zr2Gen) + 6.0);
                        var muGen = 0.07;
                        var effGen = (1.0 - muGen * Math.PI * (1.0 / zsGen + 1.0 / zpGen)) / (1.0 + Math.abs(zr1Gen / dZGen) * muGen * Math.PI * (1.0 / zpGen - 1.0 / zr2Gen));
                        effGen = Math.max(0.1, Math.min(0.9, effGen));

                        candidates.push({
                            zs: zsGen,
                            zp: zpGen,
                            zr1: zr1Gen,
                            zr2: zr2Gen,
                            numPlanets: N,
                            deltaZ: dZGen,
                            isHoriMethod: false,
                            xr2: Math.round(xr2Gen * 1000) / 1000,
                            sumX_sp: 0,
                            aw2Deg: Math.round(aw2Gen * (180.0 / Math.PI) * 10) / 10,
                            ratio: Math.round(actualRatioGen * 10) / 10,
                            ratioError: Math.round(ratioErrGen * 10000) / 100,
                            centerDistanceMm: Math.round(aGen * 100) / 100,
                            outerDiameterMm: Math.round(outerDiamGen * 10) / 10,
                            efficiencyEst: Math.round(effGen * 100),
                            label: "S:" + zsGen + " P:" + zpGen + " R1:" + zr1Gen + " R2:" + zr2Gen + " (N=" + N + ", i=" + actualRatioGen.toFixed(1) + ", xr2=" + xr2Gen.toFixed(2) + ", \u03b7\u2248" + Math.round(effGen * 100) + "%)"
                        });
                    }
                }
            }
        }

        candidates.sort(function (a, b) {
            // Prioritize Hori method
            if (a.isHoriMethod !== b.isHoriMethod) {
                return a.isHoriMethod ? -1 : 1;
            }
            if (targetRatio !== null) {
                return (a.ratioError - b.ratioError) || (b.efficiencyEst - a.efficiencyEst);
            }
            return (Math.abs(a.ratio) - Math.abs(b.ratio)) || (b.efficiencyEst - a.efficiencyEst);
        });

        return candidates;
    }

    /**
     * Parses an Illustrator circle geometry (diameter and center) into gear tooth count and profile shift.
     * 
     * @param {Object} params
     *   diameterPt: Diameter in points
     *   centerPt: Center [cx, cy] in points
     *   m: Module in mm
     *   mode: "pitch" (meshing pitch circle) | "tip" (max outer diameter envelope)
     *   keepExactSize: boolean (if true in pitch mode, applies profile shift x to match exact diameter)
     */

    exports.solveStandardPlanetary = solveStandardPlanetary;
    exports.solveParadoxicalPlanetary = solveParadoxicalPlanetary;
})(InvoluteMath);

/**
 * TopologySolver.jsxinc - Circle Object Geometry & Multi-layer Topology Analysis
 * Part of GearDrawer Architecture
 */

var InvoluteMath = InvoluteMath || {};

(function (exports) {
// Global conversion constants & helpers
var MM_TO_PT = 72.0 / 25.4;
var PT_TO_MM = 25.4 / 72.0;

function logTrace(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.log(category, msg, data);
    }
}

function logWarn(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.warn(category, msg, data);
    }
}

    function parseCircleGeometry(params) {
        var PT_TO_MM = 25.4 / 72.0;
        var diamMm = params.diameterPt * PT_TO_MM;
        var m = params.m || 2.0;
        var mode = params.mode || "pitch";
        var keepExact = (params.keepExactSize !== undefined) ? params.keepExactSize : false;

        var centerMm = [
            params.centerPt[0] * PT_TO_MM,
            params.centerPt[1] * PT_TO_MM
        ];

        var z = 18;
        var x = 0.0;
        var nominalDiamMm = diamMm;

        if (mode === "pitch") {
            // Pitch circle d = m * z
            var idealZ = diamMm / m;
            z = Math.max(3, Math.round(idealZ));
            if (keepExact) {
                // Profile shift x to keep center distance / pitch diameter exact: d_eff = m*(z + 2*x)
                x = (diamMm / m - z) / 2.0;
                nominalDiamMm = diamMm;
            } else {
                nominalDiamMm = m * z;
            }
        } else if (mode === "tip") {
            // Tip circle da = m * (z + 2)
            var maxZ = Math.floor(diamMm / m - 2.0);
            z = Math.max(3, maxZ);
            x = 0.0;
            nominalDiamMm = m * (z + 2.0);
        }

        return {
            z: z,
            x: Math.round(x * 1000) / 1000,
            module: m,
            mode: mode,
            targetDiameterMm: diamMm,
            actualDiameterMm: nominalDiamMm,
            centerMm: centerMm,
            centerPt: params.centerPt
        };
    }

    /**
     * Solves required profile shift x (equal distribution or shift sum)
     * to mesh a pair of gears at an arbitrary exact center distance aw.
     * Based on JIS B 1701-1 / ISO 21771 involute gear standards.
     * 
     * @param {Object} params
     *   m: Module in mm
     *   z1: Tooth count gear 1 (Pinion)
     *   z2: Tooth count gear 2 (Gear / Internal Ring)
     *   alphaDeg: Base pressure angle (default 20.0)
     *   targetCenterDistanceMm: Target center distance aw in mm
     *   isInternal: boolean (default false, true for external pinion & internal ring)
     * @returns {Object}
     *   - possible: boolean
     *   - alphaWDeg: Operating pressure angle in degrees
     *   - xSum: Total profile shift sum (x1 + x2 for spur, x2 - x1 for internal)
     *   - x1: Profile shift for gear 1
     *   - x2: Profile shift for gear 2
     *   - warning: String (if any)
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

        // Operating pressure angle alpha_w: cos(alpha_w) = aStd * cos(alpha) / aw
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
            // Internal meshing: x2 - x1 = xDelta
            x1 = Math.round((-xDelta / 2.0) * 1000) / 1000;
            x2 = Math.round((xDelta / 2.0) * 1000) / 1000;
        } else {
            // External meshing: x1 + x2 = xDelta
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
     * Parses module, pressure angle, and stage index from Illustrator layer names.
     * e.g. "Stage1_m2.5_a20", "L2_m1.5", "Train_m3.0"
     */
    function parseLayerParams(layerName) {
        if (!layerName) return null;
        var res = {};
        var mM = layerName.match(/(?:^|[^a-zA-Z0-9])m([0-9]+(?:\.[0-9]+)?)(?:[^a-zA-Z0-9]|$)/i);
        if (mM) res.m = parseFloat(mM[1]);

        var mA = layerName.match(/(?:^|[^a-zA-Z0-9])(?:a|alpha)([0-9]+(?:\.[0-9]+)?)(?:[^a-zA-Z0-9]|$)/i);
        if (mA) res.alphaDeg = parseFloat(mA[1]);

        // Support English and Japanese layer naming conventions:
        // "Stage 1", "Stage1", "Layer 2", "Layer2", "L1", "S1", "レイヤー 1", "レイヤー1", "第1段", "1段", "1層"
        var mS = layerName.match(/(?:^|[^a-zA-Z0-9])(?:stage|layer|l|s)\s*([0-9]+)(?:[^a-zA-Z0-9]|$)/i) ||
                 layerName.match(/(?:\u30ec\u30a4\u30e4\u30fc|\u6bb5|\u5c64|\u968e)\s*([0-9]+)/i) ||
                 layerName.match(/([0-9]+)\s*(?:\u6bb5|\u5c64|\u968e)/i);
        if (mS) res.stageIndex = parseInt(mS[1], 10);

        return res;
    }

    /**
     * Analyzes multiple Illustrator circles to reconstruct a gear train tree topology.
     * Evaluates pairwise center distances to identify external meshing (SPUR),
     * internal meshing (INTERNAL), and cross-layer coaxial stepped gears (COAXIAL).
     * Supports:
     * - "snap_theory": Snaps center distance to theoretical integer gear distance
     * - "exact_position": Keeps circle center coordinates 100% exact by applying profile shift x
     * - "free": Batch independent placement without meshing constraints
     * 
     * @param {Array} rawCircles Array of circle objects
     * @param {Object} options
     */
    function analyzeCircleTopology(rawCircles, options) {
        options = options || {};
        var defaultM = options.m || 2.0;
        var defaultAlphaDeg = (options.alphaDeg !== undefined) ? options.alphaDeg : 20.0;
        var mode = options.mode || "pitch";
        var tol = (options.toleranceMm !== undefined) ? options.toleranceMm : 2.5;
        var snapMode = options.snapMode || "snap_theory"; // "snap_theory" | "exact_position" | "free"
        var allowCrossLayerMeshing = (options.allowCrossLayerMeshing === true);

        if (!rawCircles || rawCircles.length === 0) {
            logWarn("TOPOLOGY", "No circles provided for topology analysis");
            return { nodes: [], warnings: ["\u5186\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002"] };
        }

        logTrace("TOPOLOGY", "Starting circle topology analysis", {
            circleCount: rawCircles.length,
            snapMode: snapMode,
            allowCrossLayerMeshing: allowCrossLayerMeshing,
            mode: mode,
            toleranceMm: tol,
            defaultM: defaultM,
            defaultAlphaDeg: defaultAlphaDeg
        });

        var PT_TO_MM = 25.4 / 72.0;
        var parsed = [];

        for (var i = 0; i < rawCircles.length; i++) {
            var c = rawCircles[i];
            var layerInfo = parseLayerParams(c.layerName) || {};
            var nodeM = layerInfo.m || defaultM;
            var nodeAlpha = layerInfo.alphaDeg || defaultAlphaDeg;

            var dMm = (c.diameterMm !== undefined) ? c.diameterMm : (c.diameterPt * PT_TO_MM);
            var z = 18;
            if (mode === "tip") {
                z = Math.max(3, Math.floor(dMm / nodeM - 2.0));
            } else {
                z = Math.max(3, Math.round(dMm / nodeM));
            }
            var gType = "SPUR";
            if (c.gearType) {
                gType = c.gearType;
            } else if (c.rgb) {
                // Exact RGB match #FF0000: Red=255, Green=0, Blue=0 (ignoring opacity)
                if (Math.round(c.rgb[0]) === 255 && Math.round(c.rgb[1]) === 0 && Math.round(c.rgb[2]) === 0) {
                    gType = "INTERNAL";
                }
            } else if (c.item) {
                try {
                    var col = (c.item.stroked && c.item.strokeColor) ? c.item.strokeColor : (c.item.filled ? c.item.fillColor : null);
                    if (col && col.typename === "RGBColor") {
                        if (Math.round(col.red) === 255 && Math.round(col.green) === 0 && Math.round(col.blue) === 0) {
                            gType = "INTERNAL";
                        }
                    }
                } catch (e) {}
            }

            parsed.push({
                origId: c.id || ("C" + (i + 1)),
                item: c.item,
                centerPt: c.centerPt,
                centerMm: [c.centerPt[0] * PT_TO_MM, c.centerPt[1] * PT_TO_MM],
                diameterMm: dMm,
                z: z,
                m: nodeM,
                alphaDeg: nodeAlpha,
                stageIndex: layerInfo.stageIndex || null,
                layerName: c.layerName || "",
                gearType: gType,
                profileShiftX: 0.0
            });
        }

        // Assign stageIndex: circles in the same layer belong to the same stage,
        // and strictly guarantee that different layers have different stageIndex values.
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
            // Perfect match: each layer explicitly specified a unique stage index (e.g. L1, レイヤー 2, レイヤー 3)
            for (var u = 0; u < uniqueLayers.length; u++) {
                var uLy = uniqueLayers[u];
                layerStageMap[uLy] = layerInfoMap[uLy].stageIndex;
            }
        } else {
            // Fallback / Auto-resolution:
            // Sort layers intelligently:
            // Layers with explicit numbers come first sorted by their numbers, then remaining layers by appearance
            // Then assign strictly unique 1, 2, 3...
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

        for (var pi = 0; pi < parsed.length; pi++) {
            var po = parsed[pi];
            logTrace("TOPOLOGY_NODE", "Parsed circle " + po.origId, {
                origId: po.origId,
                layerName: po.layerName,
                stageIndex: po.stageIndex,
                diameterMm: Math.round(po.diameterMm * 100) / 100,
                z: po.z,
                m: po.m,
                gearType: po.gearType,
                centerMm: [Math.round(po.centerMm[0] * 100) / 100, Math.round(po.centerMm[1] * 100) / 100]
            });
        }

        // --- Free Mode: Batch independent placement without constraints ---
        if (snapMode === "free") {
            var freeNodes = [];
            for (var f = 0; f < parsed.length; f++) {
                var pObj = parsed[f];
                var fGType = pObj.gearType || "SPUR";
                var fRim = (fGType === "INTERNAL") ? ((pObj.m * pObj.z) + 16.0) : ((pObj.m * pObj.z) + 12.0);
                freeNodes.push({
                    id: "G" + (f + 1),
                    gearType: fGType,
                    parentId: null,
                    relationType: "ROOT",
                    z: pObj.z,
                    m: pObj.m,
                    alphaDeg: pObj.alphaDeg,
                    relativeAngleDeg: 0.0,
                    shaftDiameter: 5.0,
                    rimDiameter: fRim,
                    centerPt: pObj.centerPt,
                    xOffset: pObj.centerMm[0],
                    yOffset: pObj.centerMm[1],
                    x: 0.0,
                    origCircle: pObj
                });
            }
            return {
                nodes: freeNodes,
                warnings: [],
                meshingPairs: []
            };
        }

        if (parsed.length === 1) {
            var single = parsed[0];
            var sGType = single.gearType || "SPUR";
            var sRim = (sGType === "INTERNAL") ? ((single.m * single.z) + 16.0) : ((single.m * single.z) + 12.0);
            return {
                nodes: [{
                    id: "G1",
                    gearType: sGType,
                    parentId: null,
                    relationType: "ROOT",
                    z: single.z,
                    m: single.m,
                    alphaDeg: single.alphaDeg,
                    relativeAngleDeg: 0,
                    shaftDiameter: 5.0,
                    rimDiameter: sRim,
                    centerPt: single.centerPt,
                    xOffset: single.centerMm[0],
                    yOffset: single.centerMm[1],
                    x: 0.0,
                    origCircle: single
                }],
                warnings: [],
                meshingPairs: []
            };
        }

        // Pairwise evaluation (Hierarchical: Same layer = Same stage meshing, Different layer = Different stage coaxial)
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

                // --- 1. 同心（同軸連結 COAXIAL）の判定 ---
                if (distMm <= 0.5) {
                    if (isSameLayer) {
                        warnings.push("同一レイヤー ('" + c1.layerName + "') 内に同心円 (" + c1.origId + ", " + c2.origId + ") が検出されました。同一平面上での干渉を回避するため、同軸(COAXIAL)として分離処理しました。");
                    } else {
                        logTrace("TOPOLOGY_PAIR", "Detected cross-layer COAXIAL relation", {
                            circle1: c1.origId,
                            layer1: c1.layerName,
                            circle2: c2.origId,
                            layer2: c2.layerName,
                            distMm: Math.round(distMm * 1000) / 1000
                        });
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

                // --- 2. 噛み合い（MESHING / INTERNAL_MESHING）の判定 ---
                // 異なるレイヤー間の噛み合いは、allowCrossLayerMeshing が有効な場合のみ判定
                if (!isSameLayer && !allowCrossLayerMeshing) {
                    continue;
                }

                // 同一レイヤー内噛合および異レイヤー間（段間伝動）噛合の計算
                var meshM = c1.m;
                var meshAlpha = c1.alphaDeg;

                var isC1Int = (c1.gearType === "INTERNAL");
                var isC2Int = (c2.gearType === "INTERNAL");

                if (isC1Int && isC2Int) {
                    // 内歯車同士は噛み合わない
                    continue;
                }

                if (isC1Int || isC2Int) {
                    // 内歯車(Ring) x 外歯車(Pinion) の噛み合い
                    var ringIdx = isC1Int ? i : j;
                    var pinionIdx = isC1Int ? j : i;
                    var ringNode = parsed[ringIdx];
                    var pinNode = parsed[pinionIdx];

                    if (ringNode.z > pinNode.z) {
                        var aInt = (meshM * (ringNode.z - pinNode.z)) / 2.0;
                        var errInt = Math.abs(distMm - aInt);
                        if (errInt <= tol) {
                            logTrace("TOPOLOGY_PAIR", "Detected " + (isSameLayer ? "" : "cross-layer ") + "INTERNAL_MESHING relation", {
                                ringId: ringNode.origId,
                                ringLayer: ringNode.layerName,
                                pinionId: pinNode.origId,
                                pinionLayer: pinNode.layerName,
                                distMm: Math.round(distMm * 1000) / 1000,
                                theoryDistMm: Math.round(aInt * 1000) / 1000,
                                errorMm: Math.round(errInt * 1000) / 1000
                            });
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
                    // 外歯車(Spur) x 外歯車(Spur) の外接噛み合い
                    var aExt = (meshM * (c1.z + c2.z)) / 2.0;
                    var errExt = Math.abs(distMm - aExt);
                    if (errExt <= tol) {
                        logTrace("TOPOLOGY_PAIR", "Detected " + (isSameLayer ? "" : "cross-layer ") + "MESHING relation", {
                            circle1: c1.origId,
                            layer1: c1.layerName,
                            circle2: c2.origId,
                            layer2: c2.layerName,
                            distMm: Math.round(distMm * 1000) / 1000,
                            theoryDistMm: Math.round(aExt * 1000) / 1000,
                            errorMm: Math.round(errExt * 1000) / 1000
                        });
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
                        // 幾何学的内接判定: 赤色指定されていない円でも、内接噛み合い条件を満たす場合は内歯車として自動判定
                        var aIntGeom = (meshM * Math.abs(c1.z - c2.z)) / 2.0;
                        var errIntGeom = Math.abs(distMm - aIntGeom);
                        if (errIntGeom <= tol) {
                            var gRingIdx = (c1.z > c2.z) ? i : j;
                            var gPinionIdx = (c1.z > c2.z) ? j : i;
                            parsed[gRingIdx].gearType = "INTERNAL";

                            logTrace("TOPOLOGY_PAIR", "Geometric internal meshing auto-detected (" + parsed[gRingIdx].origId + " promoted to INTERNAL)", {
                                ringId: parsed[gRingIdx].origId,
                                ringLayer: parsed[gRingIdx].layerName,
                                pinionId: parsed[gPinionIdx].origId,
                                pinionLayer: parsed[gPinionIdx].layerName,
                                distMm: Math.round(distMm * 1000) / 1000,
                                theoryDistMm: Math.round(aIntGeom * 1000) / 1000,
                                errorMm: Math.round(errIntGeom * 1000) / 1000
                            });
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

        // Sort pairs by error ascending for greedy spanning tree
        pairs.sort(function (a, b) { return a.errorMm - b.errorMm; });

        // Build adjacency
        var adj = [];
        for (var i = 0; i < n; i++) adj.push([]);
        for (var p = 0; p < pairs.length; p++) {
            var pr = pairs[p];
            adj[pr.idx1].push({ neighbor: pr.idx2, pair: pr });
            adj[pr.idx2].push({ neighbor: pr.idx1, pair: pr });
        }

        // Pick root: circle with highest degree, preferring SPUR over INTERNAL if tied
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

        // Check if any circle was not connected
        var unvisited = [];
        for (var i = 0; i < n; i++) {
            if (!visited[i]) {
                unvisited.push(parsed[i].origId);
                // Connect to root as fallback
                treeEdges.push({
                    parent: rootIdx,
                    child: i,
                    pair: { type: "MESHING", distMm: (defaultM * (parsed[rootIdx].z + parsed[i].z) / 2.0), errorMm: 0 }
                });
            }
        }
        if (unvisited.length > 0) {
            warnings.push("\u565b\u307f\u5408\u3044\u8ddd\u96e2\u306e\u7bc4\u56f2\u5916\u306b\u3042\u308b\u5186\u3092\u691c\u51fa\u3057\u307e\u3057\u305f (" + unvisited.join(", ") + ")\u3002\u3053\u308c\u3089\u306f\u6700\u3082\u8fd1\u3044\u30ae\u30a2\u306e\u565b\u307f\u5408\u3044\u5019\u88dc\u3068\u3057\u3066\u4eee\u63a5\u7d9a\u3055\u308c\u307e\u3057\u305f\u3002");
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

        // If exact_position mode, calculate required profile shift x for each meshing edge
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
        var rootNode = {
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
            shaftDiameter: 5.0,
            rimDiameter: (rootParsed.m * rootParsed.z) + 12.0,
            centerPt: rootParsed.centerPt,
            xOffset: rootParsed.centerMm[0],
            yOffset: rootParsed.centerMm[1],
            x: rootParsed.profileShiftX || 0.0,
            origCircle: rootParsed
        };
        resultNodes.push(rootNode);

        for (var e = 0; e < treeEdges.length; e++) {
            var edge = treeEdges[e];
            var pNodeParsed = parsed[edge.parent];
            var cNodeParsed = parsed[edge.child];
            var pId = idMap[edge.parent];
            var cId = idMap[edge.child];

            var relType = "MESHING";
            var gType = cNodeParsed.gearType || "SPUR";

            if (edge.pair.type === "COAXIAL") {
                relType = "COAXIAL";
                // Guarantee strictly different stage for coaxial gears to avoid physical planar interference
                if (cNodeParsed.stageIndex === pNodeParsed.stageIndex) {
                    cNodeParsed.stageIndex = pNodeParsed.stageIndex + 1;
                    warnings.push("同軸ギア (" + cId + ") が親ギア (" + pId + ") と同じ段であったため、平面干渉を回避するため段番号を " + cNodeParsed.stageIndex + " に自動変更しました。");
                }
            }

            // Connection angle from parent to child (in degrees)
            var dX = cNodeParsed.centerPt[0] - pNodeParsed.centerPt[0];
            var dY = cNodeParsed.centerPt[1] - pNodeParsed.centerPt[1];
            var connAngleDeg = 0.0;
            if (relType !== "COAXIAL") {
                connAngleDeg = Math.atan2(dY, dX) * (180.0 / Math.PI);
            }

            var defaultRim = (cNodeParsed.m * cNodeParsed.z) + 12.0;

            resultNodes.push({
                id: cId,
                gearType: gType,
                parentId: pId,
                relationType: relType,
                z: cNodeParsed.z,
                m: cNodeParsed.m,
                alphaDeg: cNodeParsed.alphaDeg,
                stageIndex: cNodeParsed.stageIndex,
                layerName: cNodeParsed.layerName,
                relativeAngleDeg: Math.round(connAngleDeg * 100) / 100,
                shaftDiameter: 5.0,
                rimDiameter: defaultRim,
                centerPt: cNodeParsed.centerPt,
                xOffset: cNodeParsed.centerMm[0],
                yOffset: cNodeParsed.centerMm[1],
                x: cNodeParsed.profileShiftX || 0.0,
                origCircle: cNodeParsed
            });
        }

        logTrace("TOPOLOGY_TREE", "Circle topology analysis completed successfully", {
            resultNodeCount: resultNodes.length,
            rootId: rootNode.id,
            pairCount: pairs.length,
            snapMode: snapMode,
            warningCount: warnings.length
        });

        return {
            nodes: resultNodes,
            warnings: warnings,
            meshingPairs: pairs,
            snapMode: snapMode,
            allowCrossLayerMeshing: allowCrossLayerMeshing
        };
    }

    /**
     * Solves and calculates a complete branched gear train (tree graph of meshing and coaxial gears).
     * Computes absolute center coordinates, exact conjugate meshing phase for every branch,
     * reduction ratios from root, and adjacent child gear interference clearance.
     * 
     * @param {Object} config
     *   m: Module (mm)
     *   alphaDeg: Base pressure angle (default 20.0)
     *   backlash: Backlash in mm (default 0.15)
     *   pathQuality: "bezier_recommended" | "bezier_minimal" | "polyline"
     *   nodes: Array of gear node definitions:
     *     - id: String (e.g. "G1", "G2")
     *     - parentId: String | null
     *     - relationType: "ROOT" | "MESHING" | "COAXIAL"
     *     - z: Number of teeth
     *     - relativeAngleDeg: Number (relative angle from parent in deg, for MESHING)
     *     - shaftDiameter: Number in mm (default 5.0)
     *     - x: Number (optional root X offset in mm)
     *     - y: Number (optional root Y offset in mm)
     *     - initialRotDeg: Number (optional root initial rotation in deg)
     */

    exports.parseCircleGeometry = parseCircleGeometry;
    exports.solveProfileShiftForDistance = solveProfileShiftForDistance;
    exports.parseLayerParams = parseLayerParams;
    exports.analyzeCircleTopology = analyzeCircleTopology;
})(InvoluteMath);

/**
 * TrainTreeResolver.jsxinc - Branched Gear Train Kinematics & Node Expansion
 * Part of GearDrawer Architecture
 */

var InvoluteMath = InvoluteMath || {};

(function (exports) {
// Global conversion constants & helpers
var MM_TO_PT = 72.0 / 25.4;
var PT_TO_MM = 25.4 / 72.0;

function logTrace(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.log(category, msg, data);
    }
}

function logWarn(category, msg, data) {
    if (typeof CalcLogger !== "undefined") {
        CalcLogger.warn(category, msg, data);
    }
}

    var calculateSpurGear = exports.calculateSpurGear || InvoluteMath.calculateSpurGear;
    var calculateInternalGear = exports.calculateInternalGear || InvoluteMath.calculateInternalGear;
    var calculateRack = exports.calculateRack || InvoluteMath.calculateRack;

    function calculateBranchedGearTrain(config) {
        var m = config.m || 2.0;
        var alphaDeg = (config.alphaDeg !== undefined) ? config.alphaDeg : 20.0;
        var backlash = (config.backlash !== undefined) ? config.backlash : 0.15;
        var pathQuality = config.pathQuality || "bezier_recommended";
        var rawNodes = config.nodes || [];

        if (rawNodes.length === 0) {
            throw new Error("Branched gear train requires at least one root gear node.");
        }

        var nodeMap = {};
        var resolvedNodes = [];
        var warnings = [];

        // 1. Index nodes
        for (var i = 0; i < rawNodes.length; i++) {
            var n = rawNodes[i];
            var relType = n.relationType;
            if (!relType) {
                if (!n.parentId) relType = "ROOT";
                else if (n.isCoaxial) relType = "COAXIAL";
                else relType = "MESHING";
            }
            var relAngle = (n.relativeAngleDeg !== undefined) ? n.relativeAngleDeg : ((n.angleDeg !== undefined) ? n.angleDeg : 0.0);
            var gType = (n.gearType || "SPUR").toUpperCase(); // "SPUR" or "INTERNAL"
            var zVal = n.z || 18;
            var nodeM = (n.m !== undefined && n.m !== null) ? parseFloat(n.m) : null;
            var nodeAlpha = (n.alphaDeg !== undefined && n.alphaDeg !== null) ? parseFloat(n.alphaDeg) : null;
            var defaultRim = ((nodeM || m) * zVal) + 12.0;

            var nodeX = (n.profileShiftX !== undefined) ? n.profileShiftX : ((n.x !== undefined && n.xOffset !== undefined) ? n.x : 0.0);
            var xOff = (n.xOffset !== undefined) ? n.xOffset : (n.x || 0.0);
            var yOff = (n.yOffset !== undefined) ? n.yOffset : (n.y || 0.0);

            var nodeStage = (n.stageIndex !== undefined && n.stageIndex !== null) ? n.stageIndex : ((n.origCircle && n.origCircle.stageIndex !== undefined) ? n.origCircle.stageIndex : null);
            var nodeLayerName = n.layerName || ((n.origCircle && n.origCircle.layerName) ? n.origCircle.layerName : "");

            nodeMap[n.id] = {
                id: n.id,
                parentId: n.parentId,
                relationType: relType,
                gearType: gType,
                z: zVal,
                m: nodeM,
                alphaDeg: nodeAlpha,
                stageIndex: nodeStage,
                layerName: nodeLayerName,
                relativeAngleDeg: relAngle,
                shaftDiameter: (n.shaftDiameter !== undefined) ? n.shaftDiameter : 5.0,
                shaftType: n.shaftType || "丸穴",
                shaftOptions: n.shaftOptions || null,
                isMutilated: !!(n.isMutilated || n.mutilated),
                intermittentRole: n.intermittentRole || (n.intermittent && n.intermittent.role) || "NONE",
                intermittentStructure: n.intermittentStructure || (n.intermittent && n.intermittent.structure) || "coplanar",
                divisions: (n.divisions !== undefined) ? parseInt(n.divisions, 10) : 4,
                moveTeeth: (n.moveTeeth !== undefined) ? parseInt(n.moveTeeth, 10) : 2,
                lockClearance: (n.lockClearance !== undefined) ? parseFloat(n.lockClearance) : 0.15,
                tipRelief: (n.tipRelief !== undefined) ? !!n.tipRelief : false,
                driverZ: n.driverZ || null,
                drivenZ: n.drivenZ || null,
                activeTeeth: (n.activeTeeth !== undefined) ? parseInt(n.activeTeeth, 10) : zVal,
                startTooth: (n.startTooth !== undefined) ? parseInt(n.startTooth, 10) : 1,
                blankRadiusType: n.blankRadiusType || "root",
                blankRadius: n.blankRadius,
                rimDiameter: (n.rimDiameter !== undefined) ? n.rimDiameter : defaultRim,
                rimType: n.rimType || "circle",
                xOffset: xOff,
                yOffset: yOff,
                profileShiftX: nodeX,
                x: nodeX,
                origCircle: n.origCircle || null,
                initialRotDeg: (n.initialRotDeg !== undefined && n.initialRotDeg !== null) ? n.initialRotDeg : null,
                children: []
            };
        }

        // 2. Build tree structure & find root
        var root = null;
        for (var id in nodeMap) {
            if (nodeMap.hasOwnProperty(id)) {
                var nd = nodeMap[id];
                if (!nd.parentId || nd.relationType === "ROOT") {
                    root = nd;
                } else if (nodeMap[nd.parentId]) {
                    nodeMap[nd.parentId].children.push(nd);
                } else {
                    throw new Error("Parent node '" + nd.parentId + "' not found for node '" + nd.id + "'.");
                }
            }
        }

        if (!root) {
            root = rawNodes[0];
        }

        // 3. Breadth-first resolution of kinematics & center coordinates
        var queue = [];

        // Initialize root
        root.m = (root.m !== null && root.m !== undefined) ? root.m : m;
        root.alphaDeg = (root.alphaDeg !== null && root.alphaDeg !== undefined) ? root.alphaDeg : alphaDeg;
        root.stageIndex = (root.stageIndex !== null && root.stageIndex !== undefined) ? root.stageIndex : 1;
        root.layerIndex = root.stageIndex;
        root.centerMm = [root.xOffset, root.yOffset];
        root.centerPt = [root.xOffset * MM_TO_PT, root.yOffset * MM_TO_PT];
        root.rotationDeg = (root.initialRotDeg !== null) ? root.initialRotDeg : 0.0;
        root.ratioFromRoot = 1.0;
        root.directionFromRoot = 1; // 1 = same, -1 = reversed
        queue.push(root);

        while (queue.length > 0) {
            var curr = queue.shift();

            var currShiftX = curr.profileShiftX || 0.0;

            // Calculate gear geometry for current node based on its stage-specific m and alphaDeg
            if (curr.gearType === "INTERNAL") {
                curr.gearData = calculateInternalGear({
                    m: curr.m,
                    z: curr.z,
                    x: currShiftX,
                    alphaDeg: curr.alphaDeg,
                    backlash: backlash,
                    rimDiameter: curr.rimDiameter,
                    rimType: curr.rimType,
                    pathQuality: pathQuality
                });
            } else if (curr.gearType === "RACK") {
                curr.gearData = calculateRack({
                    m: curr.m,
                    zRack: curr.z,
                    z: curr.z,
                    alphaDeg: curr.alphaDeg,
                    backlash: backlash,
                    backHeight: (curr.backBarHeight !== undefined) ? curr.backBarHeight : ((curr.rackHeight !== undefined) ? Math.max(0.5, curr.rackHeight - 2.25 * curr.m) : (2.5 * curr.m)),
                    height: curr.rackHeight,
                    pathQuality: pathQuality
                });
            } else {
                curr.gearData = calculateSpurGear({
                    m: curr.m,
                    z: curr.z,
                    x: currShiftX,
                    alphaDeg: curr.alphaDeg,
                    backlash: backlash,
                    shaftDiameter: curr.shaftDiameter,
                    shaftType: curr.shaftType,
                    shaftOptions: curr.shaftOptions,
                    isMutilated: curr.isMutilated,
                    intermittentRole: curr.intermittentRole,
                    intermittentStructure: curr.intermittentStructure,
                    divisions: curr.divisions,
                    moveTeeth: curr.moveTeeth,
                    lockClearance: curr.lockClearance,
                    tipRelief: curr.tipRelief,
                    driverZ: curr.driverZ || (curr.parentId && nodeMap[curr.parentId] ? nodeMap[curr.parentId].z : null),
                    drivenZ: curr.drivenZ || (curr.children && curr.children.length > 0 ? curr.children[0].z : null),
                    centerDistance: curr.centerDistance,
                    activeTeeth: curr.activeTeeth,
                    startTooth: curr.startTooth,
                    blankRadiusType: curr.blankRadiusType,
                    blankRadius: curr.blankRadius,
                    useFillet: true,
                    pathQuality: pathQuality
                });
            }

            resolvedNodes.push(curr);

            // Check interference between siblings (children of curr that are MESHING)
            var meshingChildren = [];
            for (var c = 0; c < curr.children.length; c++) {
                if (curr.children[c].relationType === "MESHING") {
                    meshingChildren.push(curr.children[c]);
                }
            }

            for (var i1 = 0; i1 < meshingChildren.length; i1++) {
                for (var i2 = i1 + 1; i2 < meshingChildren.length; i2++) {
                    var ch1 = meshingChildren[i1];
                    var ch2 = meshingChildren[i2];
                    if (ch1.gearType !== "INTERNAL" && ch2.gearType !== "INTERNAL") {
                        var a1 = (curr.m * (curr.z + ch1.z)) / 2.0;
                        var a2 = (curr.m * (curr.z + ch2.z)) / 2.0;
                        var thetaDiffRad = Math.abs(ch1.relativeAngleDeg - ch2.relativeAngleDeg) * (Math.PI / 180.0);
                        var distBetweenChildren = Math.sqrt(a1 * a1 + a2 * a2 - 2.0 * a1 * a2 * Math.cos(thetaDiffRad));
                        var ra1 = curr.m * (ch1.z + 2.0) / 2.0;
                        var ra2 = curr.m * (ch2.z + 2.0) / 2.0;
                        var clearance = distBetweenChildren - (ra1 + ra2);
                        if (clearance < 0.5) {
                            warnings.push("Physical collision between branch gears '" + ch1.id + "' and '" + ch2.id + "' (Clearance: " + clearance.toFixed(2) + "mm < 0.5mm)");
                        }
                    }
                }
            }

            // Resolve each child
            for (var chIdx = 0; chIdx < curr.children.length; chIdx++) {
                var child = curr.children[chIdx];

                if (child.relationType === "COAXIAL") {
                    // Coaxial stepped gear: preserve layer-based stageIndex if present, else increment
                    if (child.stageIndex !== null && child.stageIndex !== undefined) {
                        child.layerIndex = child.stageIndex;
                    } else {
                        child.stageIndex = curr.stageIndex + 1;
                        child.layerIndex = child.stageIndex;
                    }
                    child.m = (child.m !== null && child.m !== undefined) ? child.m : curr.m;
                    child.alphaDeg = (child.alphaDeg !== null && child.alphaDeg !== undefined) ? child.alphaDeg : curr.alphaDeg;

                    child.centerMm = [curr.centerMm[0], curr.centerMm[1]];
                    child.centerPt = [curr.centerPt[0], curr.centerPt[1]];
                    child.rotationDeg = curr.rotationDeg;
                    child.ratioFromRoot = curr.ratioFromRoot;
                    child.directionFromRoot = curr.directionFromRoot;
                } else {
                    // Meshing gear (External or Internal): preserve layer-based stageIndex if present, else inherit from parent
                    if (child.stageIndex !== null && child.stageIndex !== undefined) {
                        child.layerIndex = child.stageIndex;
                    } else {
                        child.stageIndex = curr.stageIndex;
                        child.layerIndex = child.stageIndex;
                    }
                    child.m = curr.m;
                    child.alphaDeg = curr.alphaDeg;

                    var thetaDeg = child.relativeAngleDeg;
                    var angleRad = thetaDeg * (Math.PI / 180.0);

                    var a_mm = 0;
                    if (child.gearType === "RACK") {
                        // Pinion (curr) driving Rack (child)
                        var rpRackMm = (curr.m * curr.z) / 2.0;
                        a_mm = rpRackMm;
                        child.directionFromRoot = curr.directionFromRoot;
                        child.ratioFromRoot = curr.ratioFromRoot;

                        // Rack orientation: pitch line perpendicular to radial line from pinion center
                        var rackRotDeg = thetaDeg + 90.0;
                        child.rotationDeg = rackRotDeg;

                        // Phase alignment: sliding offset along rack pitch line
                        var deltaPhiRack = (curr.rotationDeg * (Math.PI / 180.0)) - angleRad;
                        var rackShiftMm = -rpRackMm * deltaPhiRack;
                        child.shiftMm = rackShiftMm;
                        child.shiftPt = rackShiftMm * MM_TO_PT;
                    } else if (curr.gearType !== "INTERNAL" && child.gearType !== "INTERNAL") {
                        // External x External
                        a_mm = (curr.m * (curr.z + child.z)) / 2.0;
                        child.directionFromRoot = -curr.directionFromRoot;
                        child.ratioFromRoot = curr.ratioFromRoot * (-curr.z / child.z);

                        // Intermittent or Standard External meshing phase
                        if (curr.intermittentRole === "DRIVER" && child.intermittentRole === "DRIVEN") {
                            // Kinematic Intermittent Resolver:
                            // Synchronize Driver convex locking drum & Driven concave locking shoe
                            var nTeeth1 = curr.activeTeeth || curr.moveTeeth || 2;
                            var tau1 = 360.0 / curr.z;
                            var teethCenter1 = ((nTeeth1 - 1) * tau1) / 2.0;
                            var drumCenter1 = teethCenter1 + 180.0;
                            var phiDriverDwell = thetaDeg - drumCenter1;

                            var nDiv2 = child.divisions || 4;
                            var nTeeth2 = child.moveTeeth || (child.z / nDiv2);
                            var tau2 = 360.0 / child.z;
                            var thetaSeg2 = 360.0 / nDiv2;
                            var teethEnd2 = (nTeeth2 - 1) * tau2;
                            var dwellCenter2 = (teethEnd2 + thetaSeg2) / 2.0;
                            var phiDrivenDwell = thetaDeg + 180.0 - dwellCenter2;

                            // Automatically align to Dwell Lock phase if no explicit initial rotation was set
                            if (curr.initialRotDeg === null || curr.initialRotDeg === undefined) {
                                curr.rotationDeg = phiDriverDwell;
                            }

                            // Determine whether driver is facing pitch point with teeth (Motion) or drum (Dwell)
                            var facingAngle = thetaDeg - curr.rotationDeg;
                            while (facingAngle < 0) facingAngle += 360.0;
                            while (facingAngle >= 360.0) facingAngle -= 360.0;

                            var halfToothSpan = (nTeeth1 * tau1) / 2.0 + 1.0; // 1 deg safety margin
                            var spanStart = teethCenter1 - halfToothSpan;
                            while (spanStart < 0) spanStart += 360.0;
                            var spanEnd = teethCenter1 + halfToothSpan;
                            while (spanEnd < 0) spanEnd += 360.0;

                            var inMotion = false;
                            if (spanStart < spanEnd) {
                                inMotion = (facingAngle >= spanStart && facingAngle <= spanEnd);
                            } else {
                                inMotion = (facingAngle >= spanStart || facingAngle <= spanEnd);
                            }

                            if (!inMotion) {
                                // Dwell Phase: Driven gear is locked stationary facing pitch point
                                child.rotationDeg = phiDrivenDwell;
                            } else {
                                // Motion Phase: Driven gear meshes in conjugate involute phase
                                var phiChildMesh = thetaDeg + 180.0 - (180.0 / child.z) - (curr.rotationDeg - thetaDeg) * (curr.z / child.z);
                                child.rotationDeg = phiChildMesh;
                            }
                        } else {
                            // phi_c = theta + 180 - (180 / z_c) - (phi_p - theta) * (z_p / z_c)
                            var phiChildDeg = thetaDeg + 180.0 - (180.0 / child.z) - (curr.rotationDeg - thetaDeg) * (curr.z / child.z);
                            child.rotationDeg = phiChildDeg;
                        }
                    } else if (curr.gearType !== "INTERNAL" && child.gearType === "INTERNAL") {
                        // External Pinion (Parent) x Internal Ring (Child)
                        if (child.z <= curr.z) {
                            warnings.push("Internal gear '" + child.id + "' (z=" + child.z + ") must have more teeth than pinion '" + curr.id + "' (z=" + curr.z + ").");
                        }
                        a_mm = (curr.m * (child.z - curr.z)) / 2.0;
                        child.directionFromRoot = curr.directionFromRoot; // Same rotation direction
                        child.ratioFromRoot = curr.ratioFromRoot * (curr.z / child.z);

                        // Conjugate internal meshing phase
                        var tauP = (2.0 * Math.PI) / curr.z;
                        var psiP = angleRad - (curr.rotationDeg * (Math.PI / 180.0));
                        var kP = Math.round((psiP - 0.5 * tauP) / tauP);
                        var deltaP = (kP * tauP + 0.5 * tauP) - psiP;
                        var phiCRad = angleRad - deltaP * (curr.z / child.z);
                        child.rotationDeg = phiCRad * (180.0 / Math.PI);
                    } else if (curr.gearType === "INTERNAL" && child.gearType !== "INTERNAL") {
                        // Internal Ring (Parent) x External Pinion (Child)
                        if (curr.z <= child.z) {
                            warnings.push("Internal gear '" + curr.id + "' (z=" + curr.z + ") must have more teeth than pinion '" + child.id + "' (z=" + child.z + ").");
                        }
                        a_mm = (curr.m * (curr.z - child.z)) / 2.0;
                        child.directionFromRoot = curr.directionFromRoot;
                        child.ratioFromRoot = curr.ratioFromRoot * (curr.z / child.z);

                        // Inverse conjugate internal meshing phase
                        var tauR = (2.0 * Math.PI) / curr.z;
                        var psiR = angleRad - (curr.rotationDeg * (Math.PI / 180.0));
                        var kR = Math.round(psiR / tauR);
                        var deltaR = kR * tauR - psiR;
                        var phiChildRad = angleRad - deltaR * (curr.z / child.z) + (Math.PI / child.z);
                        child.rotationDeg = phiChildRad * (180.0 / Math.PI);
                    }

                    // Check if child has a real selected circle from Illustrator
                    var hasExplicitCircle = !!(child.origCircle);
                    var useExactCirclePosition = hasExplicitCircle && (config.keepExactCenterPositions || config.snapMode === "exact_position" || config.snapMode === "free");

                    if (useExactCirclePosition) {
                        child.centerMm = [child.xOffset, child.yOffset];
                        child.centerPt = [child.xOffset * MM_TO_PT, child.yOffset * MM_TO_PT];
                    } else {
                        // Kinematic center placement based on parent and connection angle
                        // User specification: Pitch circle contacts at angle thetaDeg from parent center (X+ axis reference)
                        if (child.gearType === "RACK") {
                            // Rack pitch line contacts pinion pitch circle at (rp * cos(angleRad), rp * sin(angleRad))
                            var rpPinion = (curr.m * curr.z) / 2.0;
                            child.centerMm = [
                                curr.centerMm[0] + rpPinion * Math.cos(angleRad),
                                curr.centerMm[1] + rpPinion * Math.sin(angleRad)
                            ];
                        } else if (curr.gearType !== "INTERNAL" && child.gearType === "INTERNAL") {
                            // External Pinion (parent) inside Internal Ring (child)
                            // Contact is at parent + rp_parent * (cos theta, sin theta).
                            // Ring center is shifted in opposite direction by a_mm = (z_ring - z_pinion)*m / 2:
                            child.centerMm = [
                                curr.centerMm[0] - a_mm * Math.cos(angleRad),
                                curr.centerMm[1] - a_mm * Math.sin(angleRad)
                            ];
                        } else {
                            // External x External or Internal x External:
                            child.centerMm = [
                                curr.centerMm[0] + a_mm * Math.cos(angleRad),
                                curr.centerMm[1] + a_mm * Math.sin(angleRad)
                            ];
                        }
                        child.centerPt = [
                            child.centerMm[0] * MM_TO_PT,
                            child.centerMm[1] * MM_TO_PT
                        ];
                    }
                }

                queue.push(child);
            }
        }

        logTrace("BRANCHED_TRAIN", "Branched gear train resolved", {
            nodeCount: resolvedNodes.length,
            m: m,
            alphaDeg: alphaDeg,
            warningCount: warnings.length,
            isFeasible: (warnings.length === 0)
        });

        return {
            m: m,
            alphaDeg: alphaDeg,
            backlash: backlash,
            nodes: resolvedNodes,
            nodeMap: nodeMap,
            warnings: warnings,
            isFeasible: (warnings.length === 0)
        };
    }

    /**
     * Expands a Spur Gear Pair specification into trainNodes array for branched train integration.
     */
    function expandSpurPairToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var z1 = spec.z1 || 18;
        var z2 = spec.z2 || 36;
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var angleDeg = (spec.angleDeg !== undefined) ? spec.angleDeg : 0.0;
        var shaft1 = (spec.shaftDiameter1 !== undefined) ? spec.shaftDiameter1 : 5.0;
        var shaft2 = (spec.shaftDiameter2 !== undefined) ? spec.shaftDiameter2 : 5.0;

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: z1, m: m, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft1, rimDiameter: (m * z1) + 12.0 },
            { id: "G2", gearType: "SPUR", parentId: "G1", relationType: "MESHING", z: z2, m: m, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, shaftDiameter: shaft2, rimDiameter: (m * z2) + 12.0 }
        ];
    }

    /**
     * Expands a Rack & Pinion specification into trainNodes array for branched train integration.
     */
    function expandRackToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zp = spec.zp || 18;
        var zr = spec.zr || 20;
        var rackHeight = spec.rackHeight || (4.0 * m);
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var angleDeg = (spec.angleDeg !== undefined) ? spec.angleDeg : -90.0; // default rack placed below pinion
        var shaft = (spec.shaftDiameter !== undefined) ? spec.shaftDiameter : 5.0;

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: zp, m: m, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft, rimDiameter: (m * zp) + 12.0 },
            { id: "R1", gearType: "RACK", parentId: "G1", relationType: "MESHING", z: zr, m: m, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, rackHeight: rackHeight }
        ];
    }

    /**
     * Expands an Internal Gear Pair specification into trainNodes array for branched train integration.
     */
    function expandInternalPairToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zp = spec.zp || 18;
        var zr = spec.zr || 48;
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var angleDeg = (spec.angleDeg !== undefined) ? spec.angleDeg : 0.0;
        var shaft = (spec.shaftDiameter !== undefined) ? spec.shaftDiameter : 5.0;
        var rim = (spec.rimDiameter !== undefined) ? spec.rimDiameter : ((m * zr) + 16.0);

        return [
            { id: "G1", gearType: "SPUR", parentId: null, relationType: "ROOT", z: zp, m: m, alphaDeg: alphaDeg, relativeAngleDeg: 0.0, shaftDiameter: shaft, rimDiameter: (m * zp) + 12.0 },
            { id: "G2", gearType: "INTERNAL", parentId: "G1", relationType: "MESHING", z: zr, m: m, alphaDeg: alphaDeg, relativeAngleDeg: angleDeg, shaftDiameter: 5.0, rimDiameter: rim }
        ];
    }

    /**
     * Expands a Standard 2K-H Planetary Gear System into trainNodes array for branched train integration.
     */
    function expandPlanetaryToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zs = spec.zs || 18;
        var zp = spec.zp || 18;
        var zr = spec.zr || (zs + 2 * zp);
        var numPlanets = spec.numPlanets || 3;
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var sunShaft = (spec.sunShaft !== undefined) ? spec.sunShaft : 5.0;
        var planetShaft = (spec.planetShaft !== undefined) ? spec.planetShaft : 4.0;
        var rim = (spec.rimDiameter !== undefined) ? spec.rimDiameter : ((m * zr) + 16.0);

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "COAXIAL") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var sunId = prefix ? (prefix + "Sun") : "S1";
        var relAngle = (spec.angleDeg !== undefined) ? spec.angleDeg : ((spec.relativeAngleDeg !== undefined) ? spec.relativeAngleDeg : 0.0);

        var nodes = [];
        // 1. Sun gear (connected to parent if specified)
        nodes.push({
            id: sunId,
            gearType: "SPUR",
            parentId: parentId,
            relationType: relationType,
            z: zs,
            m: m,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            layerIndex: stageIdx,
            relativeAngleDeg: relAngle,
            angleDeg: relAngle,
            shaftDiameter: sunShaft,
            rimDiameter: (m * zs) + 12.0
        });

        // 2. Planets orbiting Sun
        var spacingDeg = 360.0 / numPlanets;
        for (var i = 0; i < numPlanets; i++) {
            var planetId = prefix ? (prefix + "P" + (i + 1)) : ("P" + (i + 1));
            nodes.push({
                id: planetId,
                gearType: "SPUR",
                parentId: sunId,
                relationType: "MESHING",
                z: zp,
                m: m,
                alphaDeg: alphaDeg,
                stageIndex: stageIdx,
                layerIndex: stageIdx,
                relativeAngleDeg: Math.round(i * spacingDeg * 100) / 100,
                angleDeg: Math.round(i * spacingDeg * 100) / 100,
                shaftDiameter: planetShaft,
                rimDiameter: (m * zp) + 12.0
            });
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
            layerIndex: stageIdx,
            relativeAngleDeg: 0.0,
            angleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim
        });

        return nodes;
    }

    /**
     * Expands a 3K Paradoxical Planetary Gear System into trainNodes array for branched train integration.
     */
    function expandParadoxicalToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 2.0;
        var zs = spec.zs || 24;
        var zp = spec.zp || 18;
        var zr1 = spec.zr1 || (zs + 2 * zp);
        var zr2 = (spec.zr2 !== undefined) ? spec.zr2 : (zr1 - 1);
        var numPlanets = spec.numPlanets || 3;
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var xr2 = spec.xr2 || 0.0;
        var sunShaft = (spec.sunShaft !== undefined) ? spec.sunShaft : 5.0;
        var planetShaft = (spec.planetShaft !== undefined) ? spec.planetShaft : 4.0;
        var rim1 = (spec.rimDiameter1 !== undefined) ? spec.rimDiameter1 : ((m * zr1) + 16.0);
        var rim2 = (spec.rimDiameter2 !== undefined) ? spec.rimDiameter2 : ((m * zr2) + 16.0);

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "COAXIAL") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var sunId = prefix ? (prefix + "Sun") : "S1";
        var relAngle = (spec.angleDeg !== undefined) ? spec.angleDeg : ((spec.relativeAngleDeg !== undefined) ? spec.relativeAngleDeg : 0.0);

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
            layerIndex: stageIdx,
            relativeAngleDeg: relAngle,
            angleDeg: relAngle,
            shaftDiameter: sunShaft,
            rimDiameter: (m * zs) + 12.0
        });

        // 2. Planets orbiting Sun
        var spacingDeg = 360.0 / numPlanets;
        for (var i = 0; i < numPlanets; i++) {
            var planetId = prefix ? (prefix + "P" + (i + 1)) : ("P" + (i + 1));
            nodes.push({
                id: planetId,
                gearType: "SPUR",
                parentId: sunId,
                relationType: "MESHING",
                z: zp,
                m: m,
                alphaDeg: alphaDeg,
                stageIndex: stageIdx,
                layerIndex: stageIdx,
                relativeAngleDeg: Math.round(i * spacingDeg * 100) / 100,
                angleDeg: Math.round(i * spacingDeg * 100) / 100,
                shaftDiameter: planetShaft,
                rimDiameter: (m * zp) + 12.0
            });
        }

        // 3. Fixed Ring 1 coaxial with Sun (Stage N)
        var ring1Id = prefix ? (prefix + "Ring1_Fixed") : "R1";
        nodes.push({
            id: ring1Id,
            gearType: "INTERNAL",
            parentId: sunId,
            relationType: "COAXIAL",
            z: zr1,
            m: m,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx,
            layerIndex: stageIdx,
            layerName: ring1Id,
            relativeAngleDeg: 0.0,
            angleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim1
        });

        // 4. Output Ring 2 coaxial with Sun (Stage N + 1) with profile shift xr2
        var ring2Id = prefix ? (prefix + "Ring2_Output") : "R2";
        nodes.push({
            id: ring2Id,
            gearType: "INTERNAL",
            parentId: sunId,
            relationType: "COAXIAL",
            z: zr2,
            m: m,
            x: xr2,
            profileShiftX: xr2,
            alphaDeg: alphaDeg,
            stageIndex: stageIdx + 1,
            layerIndex: stageIdx + 1,
            layerName: ring2Id,
            relativeAngleDeg: 0.0,
            angleDeg: 0.0,
            shaftDiameter: 5.0,
            rimDiameter: rim2
        });

        return nodes;
    }

    /**
     * Expands an Intermittent Gear Pair specification into trainNodes array for branched train integration.
     */
    function expandIntermittentPairToNodes(spec) {
        spec = spec || {};
        var m = spec.m || 3.0;
        var alphaDeg = (spec.alphaDeg !== undefined) ? spec.alphaDeg : 20.0;
        var backlash = (spec.backlash !== undefined) ? spec.backlash : 0.15;
        var divisions = spec.divisions || 4;
        var moveTeeth = spec.moveTeeth || 2;
        var z1 = spec.z1 || 8;
        var z2 = (spec.z2 !== undefined && spec.z2 !== null) ? spec.z2 : (divisions * moveTeeth);
        var angleDeg = (spec.angleDeg !== undefined) ? spec.angleDeg : 0.0;
        var structure = spec.intermittentStructure || spec.structure || "coplanar";
        var lockClearance = (spec.lockClearance !== undefined) ? spec.lockClearance : 0.15;
        var tipRelief = !!spec.tipRelief;
        var shaft1 = (spec.shaftDiameter1 !== undefined) ? spec.shaftDiameter1 : 5.0;
        var shaft2 = (spec.shaftDiameter2 !== undefined) ? spec.shaftDiameter2 : 5.0;
        var shaftType1 = spec.shaftType1 || "丸穴";
        var shaftType2 = spec.shaftType2 || "丸穴";
        var shaftOpt1 = spec.shaftOptions1 || null;
        var shaftOpt2 = spec.shaftOptions2 || null;

        var parentId = spec.parentId || null;
        var relationType = parentId ? (spec.relationType || "MESHING") : "ROOT";
        var stageIdx = (spec.stageIndex !== undefined && spec.stageIndex !== null) ? parseInt(spec.stageIndex, 10) : 1;
        var prefix = spec.idPrefix || "";
        var driverId = spec.driverId || (prefix ? (prefix + "Driver") : "G1_Driver");
        var drivenId = spec.drivenId || (prefix ? (prefix + "Driven") : "G2_Driven");
        var driverRelAngle = (spec.driverAngleDeg !== undefined) ? spec.driverAngleDeg : 0.0;

        var driverNode = {
            id: driverId,
            kind: "SPUR",
            gearType: "SPUR",
            z: z1,
            m: m,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: shaft1,
            shaftType: shaftType1,
            shaftOptions: shaftOpt1,
            parentId: parentId,
            relationType: relationType,
            angleDeg: driverRelAngle,
            relativeAngleDeg: driverRelAngle,
            stageIndex: stageIdx,
            layerIndex: stageIdx,
            isMutilated: true,
            intermittentRole: "DRIVER",
            activeTeeth: moveTeeth,
            startTooth: 1,
            tipRelief: tipRelief,
            intermittentStructure: structure,
            blankRadiusType: "root",
            x: 0.0
        };

        var drivenNode = {
            id: drivenId,
            kind: "SPUR",
            gearType: "SPUR",
            z: z2,
            m: m,
            alphaDeg: alphaDeg,
            backlash: backlash,
            shaftDiameter: shaft2,
            shaftType: shaftType2,
            shaftOptions: shaftOpt2,
            parentId: driverId,
            relationType: "MESHING",
            angleDeg: angleDeg,
            relativeAngleDeg: angleDeg,
            stageIndex: stageIdx,
            layerIndex: stageIdx,
            isMutilated: true,
            intermittentRole: "DRIVEN",
            divisions: divisions,
            moveTeeth: moveTeeth,
            activeTeeth: moveTeeth,
            lockClearance: lockClearance,
            intermittentStructure: structure,
            blankRadiusType: "root",
            x: 0.0
        };

        return [driverNode, drivenNode];
    }

    exports.calculateBranchedGearTrain = calculateBranchedGearTrain;
    exports.expandSpurPairToNodes = expandSpurPairToNodes;
    exports.expandRackToNodes = expandRackToNodes;
    exports.expandInternalPairToNodes = expandInternalPairToNodes;
    exports.expandPlanetaryToNodes = expandPlanetaryToNodes;
    exports.expandParadoxicalToNodes = expandParadoxicalToNodes;
    exports.expandIntermittentPairToNodes = expandIntermittentPairToNodes;
})(InvoluteMath);


/**
 * PathBuilder.jsxinc - GearDrawer Illustrator DOM Builder
 * Version: 0.2.0
 * 
 * Handles Illustrator vector object creation, styling, grouping,
 * compound paths, guide lines, and semantic metadata naming.
 * Supports:
 * - Cubic Bezier anchor nodes (Recommended / Minimal) with true tangent handles
 * - High-density polyline fallback
 * - Normal mode: Complete closed gear contour + shaft hole + guides
 * - Test mode (connected teeth): Individual single tooth x z + root circle + shaft hole
 * - Test mode (disassembled): Tip arc, involutes, fillets as raw independent paths + root circle + shaft hole
 */

var PathBuilder = (function () {
    var MM_TO_PT = 72 / 25.4;

    function logTrace(category, msg, data) {
        if (typeof CalcLogger !== "undefined" && CalcLogger && typeof CalcLogger.log === "function") {
            CalcLogger.log(category, msg, data);
        }
    }

    // --- Standard Style Presets & Defaults ---
    var STYLES = {
        DEFAULT_CUT_WIDTH: 0.5,    // Default cut stroke width in pt
        DEFAULT_GUIDE_WIDTH: 0.25, // Default guide stroke width in pt
        COLOR_CUT: createRGBColor(255, 0, 0),    // Red (#FF0000) for Laser/CNC Cutting
        COLOR_GUIDE: createRGBColor(0, 150, 0),  // Green (#009600) for Pitch/Center Guides
        COLOR_TEXT: createRGBColor(0, 0, 0)      // Black for Annotations
    };

    /**
     * Safely retrieves the active artboard rectangle [left, top, right, bottom] in pt.
     */
    function getActiveArtboardRect(doc) {
        if (!doc || !doc.artboards || doc.artboards.length === 0) {
            return [0, 1000, 1000, 0];
        }
        var idx = 0;
        try {
            if (typeof doc.artboards.getActiveArtboardIndex === "function") {
                idx = doc.artboards.getActiveArtboardIndex();
            }
        } catch (e) {}
        if (idx < 0 || idx >= doc.artboards.length) idx = 0;
        var ab = doc.artboards[idx];
        return (ab && ab.artboardRect) ? ab.artboardRect : [0, 1000, 1000, 0];
    }

    /**
     * Recursively unlocks and makes visible a layer, its ancestors, sublayers, and page items.
     * Prevents Illustrator Error 8705 ("Target layer cannot be modified").
     */
    function unlockAndShowLayer(layer) {
        if (!layer) return;
        try {
            // Unlock ancestors if parent is another layer
            if (layer.parent && layer.parent.typename === "Layer") {
                unlockAndShowLayer(layer.parent);
            }
        } catch (eP) {}

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

        try {
            if (layer.pageItems && layer.pageItems.length > 0) {
                for (var j = 0; j < layer.pageItems.length; j++) {
                    try { layer.pageItems[j].locked = false; } catch (eItmL) {}
                    try { layer.pageItems[j].hidden = false; } catch (eItmH) {}
                }
            }
        } catch (eItm) {}
    }

    function isIsolationMode(doc) {
        if (!doc) return false;
        try {
            var testLyr = doc.layers.add();
            testLyr.remove();
            return false;
        } catch (e) {
            var errStr = String(e.message || e);
            if (errStr.indexOf("Isolation Mode") !== -1 || errStr.indexOf("synthetic layer") !== -1 || e.number === 9034) {
                return true;
            }
            return false;
        }
    }

    function ensureExitIsolationMode(doc) {
        if (!doc) return true;
        if (!isIsolationMode(doc)) return true;

        // 1. Try native menu command (up to 3 times for nested groups)
        for (var iter = 0; iter < 3; iter++) {
            try {
                app.executeMenuCommand("exitFocus");
            } catch (eCmd) {
                break;
            }
        }
        if (!isIsolationMode(doc)) return true;

        // 2. Try OS-level Escape keystroke (Windows / Mac)
        try {
            if (typeof $.os !== "undefined" && $.os.indexOf("Windows") !== -1) {
                var vbs = new File(Folder.temp.fsName + "/gd_exit_iso_" + (new Date().getTime()) + ".vbs");
                vbs.encoding = "ASCII";
                if (vbs.open("w")) {
                    vbs.writeln('Set Wsh = CreateObject("WScript.Shell")');
                    vbs.writeln('Wsh.SendKeys "{ESC}"');
                    vbs.close();
                    vbs.execute();
                    $.sleep(150);
                    try { vbs.remove(); } catch (eRem) {}
                }
            } else if (typeof $.os !== "undefined" && $.os.indexOf("Mac") !== -1) {
                try {
                    app.doScript('tell application "System Events" to key code 53', ScriptLanguage.APPLESCRIPT_LANGUAGE);
                    $.sleep(150);
                } catch (eMac) {}
            }
        } catch (eOS) {}

        return !isIsolationMode(doc);
    }

    function getOrCreateLayer(doc, layerName, parentLayer) {
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
        if (!targetLyr) {
            try {
                targetLyr = container.add();
                targetLyr.name = layerName;
            } catch (eAdd) {
                var errStr = String(eAdd.message || eAdd);
                if (errStr.indexOf("Isolation Mode") !== -1 || errStr.indexOf("synthetic layer") !== -1 || eAdd.number === 9034) {
                    var exited = ensureExitIsolationMode(doc);
                    if (exited) {
                        targetLyr = container.add();
                        targetLyr.name = layerName;
                    } else {
                        throw new Error("\u3010Illustrator\u306e\u7de8\u96c6\u30e2\u30fc\u30c9\uff08\u30a2\u30a4\u30bd\u30ec\u30fc\u30b7\u30e7\u30f3\u30e2\u30fc\u30c9\uff09\u3092\u89e3\u9664\u3057\u3066\u304f\u3060\u3055\u3044\u3011\n\n" +
                            "\u73fe\u5728\u3001Illustrator\u4e0a\u3067\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u307e\u305f\u306f\u30b0\u30eb\u30fc\u30d7\u304c\u300c\u7de8\u96c6\u30e2\u30fc\u30c9\uff08\u5206\u96e2\u30fb\u30a2\u30a4\u30bd\u30ec\u30fc\u30b7\u30e7\u30f3\u30e2\u30fc\u30c9\uff09\u300d\u306b\u306a\u3063\u3066\u3044\u307e\u3059\u3002\n" +
                            "Illustrator\u306e\u4ed5\u69d8\u4e0a\u3001\u3053\u306e\u72b6\u614b\u3067\u306f\u65b0\u898f\u30ec\u30a4\u30e4\u30fc\u306e\u4f5c\u6210\u304c\u7981\u6b62\u3055\u308c\u3066\u3044\u307e\u3059\u3002\n\n" +
                            "\u3010\u89e3\u9664\u65b9\u6cd5\u3011\n" +
                            "1. \u30ad\u30fc\u30dc\u30fc\u30c9\u306e\uff3bEsc\uff3d\u30ad\u30fc\u30921\u301c2\u56de\u62bc\u3059\n" +
                            "   \uff08\u307e\u305f\u306f\u753b\u9762\u4e0a\u90e8\u306e\u30b0\u30ec\u30fc\u306e\u30d0\u30fc\u306b\u3042\u308b\u300c<\u300d\u3092\u30af\u30ea\u30c3\u30af\uff09\n" +
                            "2. \u901a\u5e38\u306e\u7de8\u96c6\u753b\u9762\u306b\u623b\u3063\u305f\u3053\u3068\u3092\u78ba\u8a8d\u3057\u3001\u518d\u5ea6\u30ae\u30a2\u4f5c\u6210\u3092\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    }
                } else {
                    throw eAdd;
                }
            }
        }

        unlockAndShowLayer(targetLyr);
        try {
            doc.activeLayer = targetLyr;
        } catch (eAct) {}

        return targetLyr;
    }

    function getRegistrationColor(doc) {
        try {
            if (doc && doc.swatches) {
                for (var s = 0; s < doc.swatches.length; s++) {
                    var swName = doc.swatches[s].name;
                    if (swName === "[Registration]" || swName === "[レジストレーション]") {
                        return doc.swatches[s].color;
                    }
                }
            }
        } catch (e) {}
        return createRGBColor(30, 30, 30);
    }

    function createRGBColor(r, g, b) {
        var col = new RGBColor();
        col.red = r;
        col.green = g;
        col.blue = b;
        return col;
    }

    /**
     * Unified Cut Stroke Determination & Styling.
     * Applies uniform strokeWidth, strokeColor, and filled=false to PathItems or CompoundPathItems.
     * Always executed AFTER compound path construction and grouping to guarantee 100% stroke consistency.
     */
    function applyCutStyle(item, strokeWidth, strokeColor) {
        var sw = (strokeWidth !== undefined) ? strokeWidth : STYLES.DEFAULT_CUT_WIDTH;
        var sc = strokeColor || STYLES.COLOR_CUT;

        item.stroked = true;
        item.strokeColor = sc;
        item.strokeWidth = sw;
        item.filled = false;

        // If CompoundPathItem, also strictly apply to each child pathItem to override AI defaults
        if (item.typename === "CompoundPathItem" && item.pathItems) {
            for (var p = 0; p < item.pathItems.length; p++) {
                item.pathItems[p].stroked = true;
                item.pathItems[p].strokeColor = sc;
                item.pathItems[p].strokeWidth = sw;
                item.pathItems[p].filled = false;
            }
        }
    }

    /**
     * Unified Guide Stroke Determination & Styling.
     */
    function applyGuideStyle(item, strokeWidth, strokeColor, dashes) {
        var sw = (strokeWidth !== undefined) ? strokeWidth : STYLES.DEFAULT_GUIDE_WIDTH;
        var sc = strokeColor || STYLES.COLOR_GUIDE;

        item.stroked = true;
        item.strokeColor = sc;
        item.strokeWidth = sw;
        item.filled = false;
        if (dashes && dashes.length > 0) {
            item.strokeDashes = dashes;
        }
    }

    /**
     * Resolves gear center coordinates for branched train nodes based on placementRef and target coordinates.
     * 
     * @param {Array} trainNodes Array of resolved node objects
     * @param {Object} options Options containing placementRef, targetXmm, targetYmm, baseOrigin
     * @param {Array} abRect Artboard rect [left, top, right, bottom] in pt
     * @returns {Array} Array of [xPt, yPt]
     */
    function resolveTrainCenters(trainNodes, options, abRect) {
        options = options || {};
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];
        var abCenter = [abRect[0] + abWidth / 2.0, abRect[1] - abHeight / 2.0];

        var placementRef = options.placementRef || "original";
        var hasOrigCircles = (trainNodes.length > 0 && !!trainNodes[0].origCircle);

        // Calculate initial centers in pt
        var rawCenters = [];
        for (var i = 0; i < trainNodes.length; i++) {
            var nd = trainNodes[i];
            if (hasOrigCircles) {
                // nd.centerPt is already absolute artboard coordinate
                rawCenters.push([nd.centerPt[0], nd.centerPt[1]]);
            } else {
                // Manual input: nd.centerPt is relative to G1 (which is at [0, 0])
                var origBase = options.baseOrigin || abCenter;
                rawCenters.push([origBase[0] + nd.centerPt[0], origBase[1] + nd.centerPt[1]]);
            }
        }

        if (placementRef === "original" && hasOrigCircles) {
            return rawCenters;
        }

        // Target position in pt (relative to active artboard top-left)
        var targetXPt = (options.targetXmm !== undefined && !isNaN(options.targetXmm)) ? (abRect[0] + options.targetXmm * MM_TO_PT) : abCenter[0];
        var targetYPt = (options.targetYmm !== undefined && !isNaN(options.targetYmm)) ? (abRect[1] - options.targetYmm * MM_TO_PT) : abCenter[1];

        // Reference point P_ref
        var refPt = [rawCenters[0][0], rawCenters[0][1]];
        if (placementRef === "bbox") {
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (var i = 0; i < trainNodes.length; i++) {
                var c = rawCenters[i];
                var r = (trainNodes[i].gearData && trainNodes[i].gearData.tipRadiusPt) ? trainNodes[i].gearData.tipRadiusPt : (trainNodes[i].z * 2.0 * MM_TO_PT / 2.0);
                if (c[0] - r < minX) minX = c[0] - r;
                if (c[0] + r > maxX) maxX = c[0] + r;
                if (c[1] - r < minY) minY = c[1] - r;
                if (c[1] + r > maxY) maxY = c[1] + r;
            }
            if (minX !== Infinity) {
                refPt = [(minX + maxX) / 2.0, (minY + maxY) / 2.0];
            }
        }

        // Shift vector: Delta = Target - Reference
        var deltaX = targetXPt - refPt[0];
        var deltaY = targetYPt - refPt[1];

        var finalCenters = [];
        for (var i = 0; i < rawCenters.length; i++) {
            finalCenters.push([
                Math.round((rawCenters[i][0] + deltaX) * 10000) / 10000,
                Math.round((rawCenters[i][1] + deltaY) * 10000) / 10000
            ]);
        }
        return finalCenters;
    }

    /**
     * Resolves the system center for simple mechanisms (pairs, planetary sets, racks).
     */
    function resolveSystemCenter(options, abCenter, bboxShiftPt) {
        options = options || {};
        var placementRef = options.placementRef || "original";
        if (placementRef === "original" && options.baseOrigin) {
            return options.baseOrigin;
        }
        if (options.targetXmm !== undefined && options.targetYmm !== undefined && placementRef !== "original") {
            var tx = options.targetXmm * MM_TO_PT;
            var ty = options.targetYmm * MM_TO_PT;
            if (placementRef === "bbox" && bboxShiftPt) {
                tx -= bboxShiftPt[0];
                ty -= bboxShiftPt[1];
            }
            return [tx, ty];
        }
        return options.baseOrigin || abCenter;
    }

    /**
     * Safely apply point array to a PathItem (Polyline mode)
     */
    function setPathCoords(pathItem, points) {
        try {
            pathItem.setEntirePath(points);
        } catch (e) {
            for (var p = 0; p < points.length; p++) {
                var pt = pathItem.pathPoints.add();
                pt.anchor = points[p];
                pt.leftDirection = points[p];
                pt.rightDirection = points[p];
            }
        }
    }

    /**
     * Apply cubic Bezier nodes with handles to a PathItem
     * Each node: { anchor: [x,y], leftDirection: [lx,ly], rightDirection: [rx,ry], pointType: "SMOOTH"|"CORNER" }
     * 
     * @param {PathItem} pathItem
     * @param {Array} nodes
     * @param {Array} center [cx, cy] in pt
     * @param {number} rotRad Rotation angle in radians
     * @param {number} scale Multiplier (1.0 if nodes are already in pt, MM_TO_PT if in mm)
     */
    function applyBezierNodes(pathItem, nodes, center, rotRad, scale) {
        scale = scale || 1.0;
        var cosR = Math.cos(rotRad);
        var sinR = Math.sin(rotRad);

        // Ensure parent layer is unlocked and active
        try {
            if (pathItem.layer) {
                unlockAndShowLayer(pathItem.layer);
            }
        } catch (eLyr) {}

        function tf(coord) {
            var px = coord[0] * scale;
            var py = coord[1] * scale;
            var rx = px * cosR - py * sinR;
            var ry = px * sinR + py * cosR;
            return [
                Math.round((center[0] + rx) * 10000) / 10000,
                Math.round((center[1] + ry) * 10000) / 10000
            ];
        }

        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            var pt = pathItem.pathPoints.add();
            pt.anchor = tf(nd.anchor);
            pt.leftDirection = tf(nd.leftDirection);
            pt.rightDirection = tf(nd.rightDirection);
            try {
                if (nd.pointType === "CORNER") {
                    pt.pointType = (typeof PointType !== "undefined" && PointType) ? PointType.CORNER : 2;
                } else {
                    pt.pointType = (typeof PointType !== "undefined" && PointType) ? PointType.SMOOTH : 1;
                }
            } catch (ePT) {}
        }
    }

    /**
     * Helper to rotate and translate a point list
     */
    function transformPoints(points, center, rotRad) {
        var cosR = Math.cos(rotRad);
        var sinR = Math.sin(rotRad);
        var result = [];
        for (var i = 0; i < points.length; i++) {
            var px = points[i].x * MM_TO_PT;
            var py = points[i].y * MM_TO_PT;
            var rx = px * cosR - py * sinR;
            var ry = px * sinR + py * cosR;
            result.push([
                Math.round((center[0] + rx) * 10000) / 10000,
                Math.round((center[1] + ry) * 10000) / 10000
            ]);
        }
        return result;
    }

    /**
     * Draw Shaft Hole Item (Round, D-Cut, Keyway)
     * Supports Bezier Nodes, Polylines, and Native Ellipse
     */
    function drawShaftHoleItem(parentGroup, center, gearData, rotRad, gearName, options) {
        if (!gearData || !gearData.hasHole) return null;

        var shaftHole = gearData.shaftHole;
        var holeRadiusPt = gearData.holeRadiusPt || ((gearData.shaftDiameter || 0) / 2.0 * MM_TO_PT);
        if (holeRadiusPt <= 0) return null;

        var shaftType = (shaftHole && shaftHole.shaftType) ? shaftHole.shaftType : "ROUND";

        var holePath = null;
        if (shaftType === "ROUND") {
            // High-speed native Illustrator ellipse
            holePath = parentGroup.pathItems.ellipse(
                center[1] + holeRadiusPt,
                center[0] - holeRadiusPt,
                holeRadiusPt * 2,
                holeRadiusPt * 2
            );
        } else if (shaftHole && shaftHole.nodes && shaftHole.nodes.length > 0) {
            // D-Cut or Keyway via Bezier Nodes
            holePath = parentGroup.pathItems.add();
            var holeRot = (options && options.shaftFixedAngle) ? 0.0 : (rotRad || 0.0);
            applyBezierNodes(holePath, shaftHole.nodes, center, holeRot, MM_TO_PT);
            holePath.closed = true;
        } else if (shaftHole && shaftHole.points && shaftHole.points.length > 0) {
            // Polyline fallback
            holePath = parentGroup.pathItems.add();
            var holeRot = (options && options.shaftFixedAngle) ? 0.0 : (rotRad || 0.0);
            var pts = transformPoints(shaftHole.points, center, holeRot);
            setPathCoords(holePath, pts);
            holePath.closed = true;
        } else {
            // Fallback to round ellipse
            holePath = parentGroup.pathItems.ellipse(
                center[1] + holeRadiusPt,
                center[0] - holeRadiusPt,
                holeRadiusPt * 2,
                holeRadiusPt * 2
            );
        }

        if (holePath) {
            holePath.name = gearName + "_ShaftHole_" + shaftType;
        }
        return holePath;
    }

    /**
     * Draw Coaxial Alignment Pin Holes
     */
    function drawAlignmentPinHoles(parentGroup, center, gearData, rotRad, gearName, options) {
        var pinHolesData = (gearData && gearData.pinHoles) ? gearData.pinHoles : ((options && options.pinHoles) ? options.pinHoles : null);
        if (!pinHolesData || !pinHolesData.valid || !pinHolesData.holes || pinHolesData.holes.length === 0) {
            return [];
        }

        var pinPaths = [];
        var cosR = Math.cos(rotRad || 0.0);
        var sinR = Math.sin(rotRad || 0.0);

        for (var p = 0; p < pinHolesData.holes.length; p++) {
            var pin = pinHolesData.holes[p];
            var px = pin.center[0] * MM_TO_PT;
            var py = pin.center[1] * MM_TO_PT;
            var rx = px * cosR - py * sinR;
            var ry = px * sinR + py * cosR;

            var pinCenterX = center[0] + rx;
            var pinCenterY = center[1] + ry;
            var pinRadiusPt = pin.radius * MM_TO_PT;

            var pPath = parentGroup.pathItems.ellipse(
                pinCenterY + pinRadiusPt,
                pinCenterX - pinRadiusPt,
                pinRadiusPt * 2,
                pinRadiusPt * 2
            );
            pPath.name = gearName + "_PinHole_" + (p + 1);
            pinPaths.push(pPath);
        }
        return pinPaths;
    }

    /**
     * Draw a single gear into Illustrator
     * Strict Pipeline: 1. Sizing -> 2. Grouping & Compound Path -> 3. Stroke & Style Determination
     */
    function drawGear(doc, targetLayer, center, gearData, rotationDeg, gearName, options) {
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}
        options = options || {};
        var outputIndividualTeeth = !!(options.outputIndividualTeeth || options.individualTeeth);
        var mode = (options.drawMode && options.drawMode !== "normal") ? options.drawMode : (outputIndividualTeeth ? "test_teeth" : "normal");
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : STYLES.DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : STYLES.DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || STYLES.COLOR_CUT;
        var guideColor = options.guideColor || STYLES.COLOR_GUIDE;
        var textColor = STYLES.COLOR_TEXT;

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName + (mode !== "normal" ? (" [" + mode + "]") : "");

        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180);
        var toothPitchAngle = (2.0 * Math.PI) / gearData.z;

        if (mode === "normal") {
            // === STEP 1: Sizing & Coordinate Generation ===
            var outerPath = gearGroup.pathItems.add();
            outerPath.name = gearName + "_Contour";

            if (gearData.pathQuality !== "polyline" && gearData.outerNodes && gearData.outerNodes.length > 0) {
                applyBezierNodes(outerPath, gearData.outerNodes, center, rotOffsetRad, 1.0);
            } else {
                var rotatedPoints = [];
                var cosR = Math.cos(rotOffsetRad);
                var sinR = Math.sin(rotOffsetRad);

                for (var i = 0; i < gearData.outerPoints.length; i++) {
                    var px = gearData.outerPoints[i][0];
                    var py = gearData.outerPoints[i][1];
                    var rx = px * cosR - py * sinR;
                    var ry = px * sinR + py * cosR;
                    rotatedPoints.push([
                        Math.round((center[0] + rx) * 10000) / 10000,
                        Math.round((center[1] + ry) * 10000) / 10000
                    ]);
                }
                setPathCoords(outerPath, rotatedPoints);
            }
            outerPath.closed = true;

            var holePath = drawShaftHoleItem(gearGroup, center, gearData, rotOffsetRad, gearName, options);
            var pinPaths = drawAlignmentPinHoles(gearGroup, center, gearData, rotOffsetRad, gearName, options);

            // === STEP 2: Grouping & Compound Path Construction ===
            var mainCutItem = outerPath;
            var createCompound = (options.createCompound !== undefined) ? options.createCompound : true;
            if ((holePath || (pinPaths && pinPaths.length > 0)) && createCompound) {
                try {
                    var compoundGear = gearGroup.compoundPathItems.add();
                    compoundGear.name = gearName + "_Body";
                    if (holePath) {
                        holePath.moveToBeginning(compoundGear);
                    }
                    if (pinPaths && pinPaths.length > 0) {
                        for (var pi = 0; pi < pinPaths.length; pi++) {
                            pinPaths[pi].moveToBeginning(compoundGear);
                        }
                    }
                    outerPath.moveToBeginning(compoundGear);
                    mainCutItem = compoundGear;
                } catch (e) {
                    mainCutItem = outerPath;
                }
            }

            // === STEP 3: Stroke Determination & Style Application ===
            applyCutStyle(mainCutItem, cutStrokeWidth, cutColor);
            if (holePath && mainCutItem !== holePath && mainCutItem.typename !== "CompoundPathItem") {
                applyCutStyle(holePath, cutStrokeWidth, cutColor);
            }
            if (pinPaths && pinPaths.length > 0 && mainCutItem.typename !== "CompoundPathItem") {
                for (var pj = 0; pj < pinPaths.length; pj++) {
                    applyCutStyle(pinPaths[pj], cutStrokeWidth, cutColor);
                }
            }

            // === STEP 4: Two-Layer Lock Plate (if present) ===
            // Exported to a dedicated sublayer (_LockPlate) to keep CAM cut paths isolated from gear teeth
            if (gearData.lockPlate && gearData.lockPlate.outerNodes && gearData.lockPlate.outerNodes.length > 0) {
                var lockLayerParent = (targetLayer.parent && targetLayer.parent.typename === "Layer") ? targetLayer.parent : targetLayer;
                var lockLayerName = (targetLayer.parent && targetLayer.parent.typename === "Layer" ? targetLayer.parent.name : targetLayer.name) + "_LockPlate";
                var lockPlateLayer = getOrCreateLayer(doc, lockLayerName, lockLayerParent);
                unlockAndShowLayer(lockPlateLayer);

                var lockPlateGroup = lockPlateLayer.groupItems.add();
                lockPlateGroup.name = gearName + "_" + (gearData.lockPlate.name || "LockPlate");
                var lpPath = lockPlateGroup.pathItems.add();
                lpPath.name = gearData.lockPlate.name || (gearName + "_LockPlate");
                applyBezierNodes(lpPath, gearData.lockPlate.outerNodes, center, rotOffsetRad, 1.0);
                lpPath.closed = true;
                applyCutStyle(lpPath, cutStrokeWidth, cutColor);

                var lpHole = drawShaftHoleItem(lockPlateGroup, center, gearData, rotOffsetRad, gearName + "_LockPlate", options);
                if (lpHole) applyCutStyle(lpHole, cutStrokeWidth, cutColor);

                var lpPins = drawAlignmentPinHoles(lockPlateGroup, center, gearData, rotOffsetRad, gearName + "_LockPlate", options);
                if (lpPins && lpPins.length > 0) {
                    for (var lpj = 0; lpj < lpPins.length; lpj++) {
                        applyCutStyle(lpPins[lpj], cutStrokeWidth, cutColor);
                    }
                }
            }

        } else if (mode === "test_teeth") {
            // === 2. Individual Teeth Mode: Single tooth x z (independent paths) + root circle + shaft hole ===
            var teethGroup = gearGroup.groupItems.add();
            teethGroup.name = gearName + "_IndividualTeeth";

            var isMut = !!(gearData.isMutilated && gearData.activeTeeth < gearData.z);
            var teethCount = isMut ? gearData.activeTeeth : gearData.z;
            var startToothIdx = (isMut && gearData.startTooth) ? (gearData.startTooth - 1) : 0;

            for (var step = 0; step < teethCount; step++) {
                var t = (startToothIdx + step) % gearData.z;
                var toothRot = rotOffsetRad + (t * toothPitchAngle);
                var toothPath = teethGroup.pathItems.add();
                toothPath.name = gearName + "_Tooth_" + (t + 1);

                if (gearData.pathQuality !== "polyline" && gearData.singleToothNodes && gearData.singleToothNodes.length > 0) {
                    applyBezierNodes(toothPath, gearData.singleToothNodes, center, toothRot, MM_TO_PT);
                } else {
                    var toothPts = transformPoints(gearData.singleToothCombined, center, toothRot);
                    setPathCoords(toothPath, toothPts);
                }

                toothPath.closed = false;
                applyCutStyle(toothPath, cutStrokeWidth, cutColor);
            }

            // Dedicated Root Circle (Realized/actual root circle considering undercut & trochoid)
            var actualRootPt = gearData.actualRootRadiusPt || gearData.rootRadiusPt;
            var actualRootD = gearData.actualRootDiameter || gearData.rootDiameter;
            var rootCircle = gearGroup.pathItems.ellipse(
                center[1] + actualRootPt,
                center[0] - actualRootPt,
                actualRootPt * 2,
                actualRootPt * 2
            );
            rootCircle.name = gearName + "_RootCircle_df" + actualRootD.toFixed(2);
            applyCutStyle(rootCircle, cutStrokeWidth, cutColor);

            // Shaft Hole & Alignment Pin Holes for Individual Teeth Mode
            var holePathInd = drawShaftHoleItem(gearGroup, center, gearData, rotOffsetRad, gearName, options);
            if (holePathInd) applyCutStyle(holePathInd, cutStrokeWidth, cutColor);

            var pinPathsInd = drawAlignmentPinHoles(gearGroup, center, gearData, rotOffsetRad, gearName, options);
            if (pinPathsInd && pinPathsInd.length > 0) {
                for (var pki = 0; pki < pinPathsInd.length; pki++) {
                    applyCutStyle(pinPathsInd[pki], cutStrokeWidth, cutColor);
                }
            }

        } else if (mode === "test_disassembled") {
            // === 3. Test Mode (Disassembled): Tip arc, Involutes, Fillets ===
            var disGroup = gearGroup.groupItems.add();
            disGroup.name = gearName + "_DisassembledParts";

            var segs = gearData.singleToothSegments;

            for (var t2 = 0; t2 < gearData.z; t2++) {
                var tRot = rotOffsetRad + (t2 * toothPitchAngle);
                var singleToothGroup = disGroup.groupItems.add();
                singleToothGroup.name = "Tooth_" + (t2 + 1) + "_Segments";

                // A. Tip Arc
                var tipPts = transformPoints(segs.tipArc, center, tRot);
                var pTip = singleToothGroup.pathItems.add();
                pTip.name = "TipArc";
                setPathCoords(pTip, tipPts);
                applyCutStyle(pTip, cutStrokeWidth, tipArcColor);

                // B. Left Involute
                var leftInvPts = transformPoints(segs.leftInvolute, center, tRot);
                var pLInv = singleToothGroup.pathItems.add();
                pLInv.name = "LeftInvolute";
                setPathCoords(pLInv, leftInvPts);
                applyCutStyle(pLInv, cutStrokeWidth, involuteColor);

                // C. Right Involute
                var rightInvPts = transformPoints(segs.rightInvolute, center, tRot);
                var pRInv = singleToothGroup.pathItems.add();
                pRInv.name = "RightInvolute";
                setPathCoords(pRInv, rightInvPts);
                applyCutStyle(pRInv, cutStrokeWidth, involuteColor);

                // D. Left Trochoid Fillet
                var leftFilletPts = transformPoints(segs.leftFillet, center, tRot);
                var pLFil = singleToothGroup.pathItems.add();
                pLFil.name = "LeftTrochoidFillet";
                setPathCoords(pLFil, leftFilletPts);
                applyCutStyle(pLFil, cutStrokeWidth, filletColor);

                // E. Right Trochoid Fillet
                var rightFilletPts = transformPoints(segs.rightFillet, center, tRot);
                var pRFil = singleToothGroup.pathItems.add();
                pRFil.name = "RightTrochoidFillet";
                setPathCoords(pRFil, rightFilletPts);
                applyCutStyle(pRFil, cutStrokeWidth, filletColor);
            }

            // Dedicated Root Circle
            var rootCircleD = gearGroup.pathItems.ellipse(
                center[1] + gearData.rootRadiusPt,
                center[0] - gearData.rootRadiusPt,
                gearData.rootRadiusPt * 2,
                gearData.rootRadiusPt * 2
            );
            rootCircleD.name = gearName + "_RootCircle_df" + gearData.rootDiameter.toFixed(1);
            applyGuideStyle(rootCircleD, guideStrokeWidth, STYLES.COLOR_CUT);
        }

        // Draw shaft hole & pin holes in test mode (in normal mode, it was already handled and compounded)
        if (mode !== "normal" && gearData.hasHole) {
            var testHole = drawShaftHoleItem(gearGroup, center, gearData, rotOffsetRad, gearName, options);
            if (testHole) {
                applyCutStyle(testHole, cutStrokeWidth, cutColor);
            }
            var testPins = drawAlignmentPinHoles(gearGroup, center, gearData, rotOffsetRad, gearName, options);
            if (testPins && testPins.length > 0) {
                for (var tp = 0; tp < testPins.length; tp++) {
                    applyCutStyle(testPins[tp], cutStrokeWidth, cutColor);
                }
            }
        }

        // Guides with uniform guide stroke
        if (options && options.drawGuides) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearName + "_Guides";

            // 1. Pitch Circle
            var pr = gearData.pitchRadiusPt;
            var pitchCircle = guideGroup.pathItems.ellipse(
                center[1] + pr,
                center[0] - pr,
                pr * 2,
                pr * 2
            );
            pitchCircle.name = "PitchCircle_d" + gearData.pitchDiameter.toFixed(1);
            applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [4, 4]);

            // 2. Base Circle (if distinct and applicable)
            if (gearData.baseRadiusPt && gearData.baseRadiusPt > 0 && Math.abs(gearData.baseRadiusPt - pr) > 0.5) {
                var br = gearData.baseRadiusPt;
                var baseCircle = guideGroup.pathItems.ellipse(
                    center[1] + br,
                    center[0] - br,
                    br * 2,
                    br * 2
                );
                baseCircle.name = "BaseCircle_db" + gearData.baseDiameter.toFixed(1);
                applyGuideStyle(baseCircle, guideStrokeWidth, guideColor, [2, 3]);
            }

            // 3. Intermittent Lock Arc Guide (if applicable)
            if (gearData.intermittentRole && gearData.intermittentRole !== "NONE") {
                var lr = (gearData.blankRadiusPt && gearData.blankRadiusPt > 0) ? gearData.blankRadiusPt : pr;
                var lockCircle = guideGroup.pathItems.ellipse(
                    center[1] + lr,
                    center[0] - lr,
                    lr * 2,
                    lr * 2
                );
                lockCircle.name = "LockGuide_" + gearData.intermittentRole;
                applyGuideStyle(lockCircle, guideStrokeWidth, guideColor, [1, 3]);
            }

            var crossLen = Math.min(pr * 0.4, 15);
            var crossCompound = guideGroup.compoundPathItems.add();
            crossCompound.name = gearName + "_CenterCross";
            var hLine = crossCompound.pathItems.add();
            hLine.setEntirePath([
                [center[0] - crossLen, center[1]],
                [center[0] + crossLen, center[1]]
            ]);
            var vLine = crossCompound.pathItems.add();
            vLine.setEntirePath([
                [center[0], center[1] - crossLen],
                [center[0], center[1] + crossLen]
            ]);
            applyGuideStyle(crossCompound, guideStrokeWidth, guideColor);
        }

        // Text label
        if (options && options.drawText) {
            try {
                var textFrame = gearGroup.textFrames.add();
                textFrame.contents = gearName + " [m=" + gearData.m + " z=" + gearData.z + " d=" + gearData.pitchDiameter.toFixed(1) + "mm]";
                textFrame.position = [center[0] - 20, center[1] - gearData.tipRadiusPt - 8];
                textFrame.textRange.characterAttributes.size = 8;
                textFrame.textRange.characterAttributes.fillColor = textColor;
            } catch (e) {
                // Ignore text error
            }
        }

        return gearGroup;
    }

    /**
     * Draw meshing pair
     */
    function drawMeshingPair(doc, params) {
        var options = params.options || {};
        var naming = options.naming || InvoluteMath.NAMING_PRESETS.standard;
        var trainId = options.trainId || "T1";

        // 1. Main & Sublayer (e.g. "T1" -> "T1_1")
        var mainLayerName = InvoluteMath.formatName(naming.mainLayer, { train: trainId, m: params.gear1Data.m });
        var mainLayer = getOrCreateLayer(doc, mainLayerName);

        var subLayerName = InvoluteMath.formatName(naming.subLayer, { train: trainId, layer: 1, m: params.gear1Data.m });
        var targetLayer = getOrCreateLayer(doc, subLayerName, mainLayer);

        var abRect = getActiveArtboardRect(doc);
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var abCenter = [abRect[0] + abWidth / 2, abRect[1] - abHeight / 2];
        var bboxShift = [params.meshing.gear2OffsetX / 2, params.meshing.gear2OffsetY / 2];
        var g1Center = resolveSystemCenter(params.options, [abCenter[0] - bboxShift[0], abCenter[1] - bboxShift[1]], bboxShift);
        var g2Center = [g1Center[0] + params.meshing.gear2OffsetX, g1Center[1] + params.meshing.gear2OffsetY];

        var g1Name = InvoluteMath.formatName(naming.gearGroup, {
            train: trainId,
            layer: 1,
            id: "G1",
            parentId: "Root",
            role: "Spur",
            m: params.gear1Data.m,
            z: params.gear1Data.z,
            d: params.gear1Data.pitchDiameter,
            pcd: params.gear1Data.pitchDiameter,
            da: params.gear1Data.tipRadiusMm * 2,
            shaft: params.gear1Data.shaftDiameter
        });

        var g2Name = InvoluteMath.formatName(naming.gearGroup, {
            train: trainId,
            layer: 1,
            id: "G2",
            parentId: "G1",
            role: "Spur",
            m: params.gear2Data.m,
            z: params.gear2Data.z,
            d: params.gear2Data.pitchDiameter,
            pcd: params.gear2Data.pitchDiameter,
            da: params.gear2Data.tipRadiusMm * 2,
            shaft: params.gear2Data.shaftDiameter
        });

        var g1Group = drawGear(
            doc,
            targetLayer,
            g1Center,
            params.gear1Data,
            params.meshing.gear1RotationDeg,
            g1Name,
            params.options
        );

        var g2Group = drawGear(
            doc,
            targetLayer,
            g2Center,
            params.gear2Data,
            params.meshing.gear2RotationDeg,
            g2Name,
            params.options
        );

        // 2. Generate Drawing / Skeleton Layer (e.g. "T1_dwg")
        if (options.drawDwgLayer !== false) {
            var dwgLayerName = InvoluteMath.formatName(naming.dwgLayer, {
                train: trainId,
                m: params.gear1Data.m
            });
            var dwgLayer = getOrCreateLayer(doc, dwgLayerName);
            drawDwgSkeleton(dwgLayer, [
                { id: "G1", center: g1Center, m: params.gear1Data.m, z: params.gear1Data.z, pitchRadiusPt: params.gear1Data.pitchRadiusPt, tipRadiusPt: params.gear1Data.tipRadiusPt, rootRadiusPt: params.gear1Data.rootRadiusPt },
                { id: "G2", center: g2Center, m: params.gear2Data.m, z: params.gear2Data.z, pitchRadiusPt: params.gear2Data.pitchRadiusPt, tipRadiusPt: params.gear2Data.tipRadiusPt, rootRadiusPt: params.gear2Data.rootRadiusPt }
            ], [
                [g1Center, g2Center, "G1", "G2"]
            ], options);
        }

        return targetLayer;
    }

    /**
     * Draw a rack into Illustrator
     * Strict Pipeline: 1. Sizing -> 2. Grouping -> 3. Stroke & Style Determination
     */
    function drawRack(doc, targetLayer, origin, rackData, rotationDeg, shiftPt, rackName, options) {
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}
        options = options || {};
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : STYLES.DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : STYLES.DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || STYLES.COLOR_CUT;
        var guideColor = options.guideColor || STYLES.COLOR_GUIDE;
        var textColor = STYLES.COLOR_TEXT;

        var rackGroup = targetLayer.groupItems.add();
        rackGroup.name = rackName || ("Rack_m" + rackData.m + "_z" + rackData.zRack);

        var rotRad = (rotationDeg || 0) * (Math.PI / 180.0);
        var shift = 0;
        if (typeof shiftPt === "number") {
            shift = shiftPt;
        } else if (shiftPt && typeof shiftPt[0] === "number") {
            shift = shiftPt[0];
        }
        if (isNaN(shift)) {
            shift = 0;
        }

        var cosR = Math.cos(rotRad);
        var sinR = Math.sin(rotRad);

        // === STEP 1: Sizing & Offset Calculation ===
        var ox = (origin && typeof origin[0] === "number" && !isNaN(origin[0])) ? origin[0] : 0;
        var oy = (origin && typeof origin[1] === "number" && !isNaN(origin[1])) ? origin[1] : 0;
        var cx = ox + shift * cosR;
        var cy = oy + shift * sinR;

        // === STEP 2: Topology / Path Creation ===
        var contour = rackGroup.pathItems.add();
        contour.name = rackGroup.name + "_Contour";
        applyBezierNodes(contour, rackData.outerNodes, [cx, cy], rotRad, 1.0);
        contour.closed = true;

        // === STEP 3: Stroke Determination & Style Application ===
        applyCutStyle(contour, cutStrokeWidth, cutColor);

        // Guides with uniform guide stroke
        if (options.drawGuides !== false && rackData.pitchLinePt) {
            var guideGroup = rackGroup.groupItems.add();
            guideGroup.name = rackGroup.name + "_Guides";

            var pitchLine = guideGroup.pathItems.add();
            pitchLine.name = "PitchLine";
            var pStart = rackData.pitchLinePt.start;
            var pEnd = rackData.pitchLinePt.end;

            function tfGuide(p) {
                var rx = p[0] * cosR - p[1] * sinR;
                var ry = p[0] * sinR + p[1] * cosR;
                return [cx + rx, cy + ry];
            }

            setPathCoords(pitchLine, [tfGuide(pStart), tfGuide(pEnd)]);
            applyGuideStyle(pitchLine, guideStrokeWidth, guideColor, [3, 2]);
        }

        // Text label
        if (options.drawText !== false) {
            try {
                var tf = rackGroup.textFrames.add();
                tf.contents = "Rack: m=" + rackData.m + " z=" + rackData.zRack + " L=" + Math.round(rackData.totalLengthMm * 10) / 10 + "mm";
                var hfPt = ((rackData.hfMm !== undefined) ? rackData.hfMm : (1.25 * (rackData.m || 2.0))) * MM_TO_PT;
                var backHeightPt = ((rackData.backHeightMm !== undefined) ? rackData.backHeightMm : (2.5 * (rackData.m || 2.0))) * MM_TO_PT;
                var backPt = [0, -(hfPt + backHeightPt) - 10];
                var tfPos = [cx + backPt[0] * cosR - backPt[1] * sinR, cy + backPt[0] * sinR + backPt[1] * cosR];
                var leftVal = tfPos[0] - 50;
                var topVal = tfPos[1];
                tf.left = (!isNaN(leftVal)) ? leftVal : (ox - 50);
                tf.top = (!isNaN(topVal)) ? topVal : oy;
                tf.textRange.characterAttributes.size = 8;
                tf.textRange.characterAttributes.fillColor = textColor;
            } catch (eTf) {
                // Ignore text frame errors
            }
        }

        return rackGroup;
    }

    /**
     * Draw a meshing Rack & Pinion pair
     */
    function drawRackAndPinionPair(doc, params) {
        var layer = getOrCreateLayer(doc, "GearDrawer");

        var abRect = getActiveArtboardRect(doc);
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var pinionCenter = resolveSystemCenter(params.options, [abRect[0] + abWidth / 2, abRect[1] - abHeight / 2 + params.rackMeshing.pinionRadiusPt / 2]);

        // Draw Pinion
        var pinionGroup = drawGear(
            doc,
            layer,
            pinionCenter,
            params.pinionData,
            params.rackMeshing.pinionRotationDeg,
            "Pinion_z" + params.pinionData.z,
            params.options
        );

        // Rack contact origin:
        var rackOrigin = [
            pinionCenter[0] + params.rackMeshing.contactPointX,
            pinionCenter[1] + params.rackMeshing.contactPointY
        ];

        // Draw Rack
        var rackGroup = drawRack(
            doc,
            layer,
            rackOrigin,
            params.rackData,
            params.rackMeshing.rackRotationDeg,
            params.rackMeshing.rackShiftPt,
            "Rack_z" + params.rackData.zRack,
            params.options
        );

        var pairGroup = layer.groupItems.add();
        pairGroup.name = "RackAndPinion_m" + params.pinionData.m + "_z" + params.pinionData.z + "xRack" + params.rackData.zRack;
        pinionGroup.moveToBeginning(pairGroup);
        rackGroup.moveToBeginning(pairGroup);

        return pairGroup;
    }

    /**
     * Draw an Internal Ring Gear in Illustrator document.
     * Strict Pipeline: 1. Sizing -> 2. Grouping & Compound Path -> 3. Stroke & Style Determination
     */
    function drawInternalGear(doc, targetLayer, center, internalData, rotationDeg, gearName, options) {
        unlockAndShowLayer(targetLayer);
        try { doc.activeLayer = targetLayer; } catch (eAL) {}
        options = options || {};
        var cutStrokeWidth = (options.cutStrokeWidth !== undefined) ? options.cutStrokeWidth : STYLES.DEFAULT_CUT_WIDTH;
        var guideStrokeWidth = (options.guideStrokeWidth !== undefined) ? options.guideStrokeWidth : STYLES.DEFAULT_GUIDE_WIDTH;
        var cutColor = options.cutColor || STYLES.COLOR_CUT;
        var guideColor = options.guideColor || STYLES.COLOR_GUIDE;
        var textColor = STYLES.COLOR_TEXT;
        var createCompound = (options.createCompound !== undefined) ? options.createCompound : true;

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName || ("InternalGear_m" + internalData.m + "_z" + internalData.z);

        var rotRad = (rotationDeg || 0) * (Math.PI / 180.0);

        // === STEP 1: Sizing & Path Geometry Generation ===
        var innerContour = gearGroup.pathItems.add();
        innerContour.name = gearGroup.name + "_InnerContour";
        applyBezierNodes(innerContour, internalData.innerContourNodes, center, rotRad, 1.0);
        innerContour.closed = true;

        var rimContour = gearGroup.pathItems.add();
        rimContour.name = gearGroup.name + "_RimOuter";
        applyBezierNodes(rimContour, internalData.rimCircleNodes, center, rotRad, 1.0);
        rimContour.closed = true;

        // === STEP 2: Grouping & Compound Path Construction ===
        var mainCutItem = rimContour;
        if (createCompound) {
            try {
                var compoundPath = gearGroup.compoundPathItems.add();
                compoundPath.name = gearGroup.name + "_Ring";
                innerContour.moveToBeginning(compoundPath);
                rimContour.moveToBeginning(compoundPath);
                mainCutItem = compoundPath;
            } catch (e) {
                // If compound path fails in older AI version, keep as individual paths in gearGroup
                mainCutItem = rimContour;
            }
        }

        // === STEP 3: Stroke Determination & Style Application ===
        applyCutStyle(mainCutItem, cutStrokeWidth, cutColor);
        if (mainCutItem.typename !== "CompoundPathItem") {
            applyCutStyle(innerContour, cutStrokeWidth, cutColor);
            applyCutStyle(rimContour, cutStrokeWidth, cutColor);
        }

        // Guides with uniform guide stroke
        if (options.drawGuides !== false) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearGroup.name + "_Guides";

            // Pitch Circle (rp)
            var pitchCircle = guideGroup.pathItems.ellipse(
                center[1] + internalData.rpPt,
                center[0] - internalData.rpPt,
                internalData.rpPt * 2,
                internalData.rpPt * 2
            );
            pitchCircle.name = "PitchCircle_rp" + Math.round(internalData.rpMm * 10) / 10 + "mm";
            applyGuideStyle(pitchCircle, guideStrokeWidth, guideColor, [3, 2]);

            // Tip Circle (ra - inner tip)
            var tipCircle = guideGroup.pathItems.ellipse(
                center[1] + internalData.raPt,
                center[0] - internalData.raPt,
                internalData.raPt * 2,
                internalData.raPt * 2
            );
            tipCircle.name = "TipCircle_ra" + Math.round(internalData.raMm * 10) / 10 + "mm";
            applyGuideStyle(tipCircle, guideStrokeWidth, guideColor, [1, 2]);

            // Root Circle (rf - outer root)
            var rootCircle = guideGroup.pathItems.ellipse(
                center[1] + internalData.rfPt,
                center[0] - internalData.rfPt,
                internalData.rfPt * 2,
                internalData.rfPt * 2
            );
            rootCircle.name = "RootCircle_rf" + Math.round(internalData.rfMm * 10) / 10 + "mm";
            applyGuideStyle(rootCircle, guideStrokeWidth, guideColor, [1, 2]);
        }

        // Text Label
        if (options.drawText !== false) {
            try {
                var tf = gearGroup.textFrames.add();
                tf.contents = "Internal: m=" + internalData.m + " z=" + internalData.z + " PCD=" + (internalData.rpMm * 2) + "mm ID=" + (internalData.raMm * 2) + "mm OD=" + (internalData.rRimMm * 2) + "mm";
                var leftVal = center[0] - internalData.rRimPt;
                var topVal = center[1] + internalData.rRimPt + 15;
                tf.left = (!isNaN(leftVal)) ? leftVal : (center[0] - 20);
                tf.top = (!isNaN(topVal)) ? topVal : (center[1] + 20);
                tf.textRange.characterAttributes.size = 8;
                tf.textRange.characterAttributes.fillColor = textColor;
            } catch (eTfInt) {
                // Ignore text frame errors
            }
        }

        return gearGroup;
    }

    /**
     * Draw a meshing Internal Gear Pair (Pinion inside Internal Ring Gear).
     */
    function drawInternalMeshingPair(doc, params) {
        var layer = getOrCreateLayer(doc, "GearDrawer");

        var abRect = getActiveArtboardRect(doc);
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var internalCenter = resolveSystemCenter(params.options, [abRect[0] + abWidth / 2, abRect[1] - abHeight / 2]);

        // Pinion center relative to internal gear center:
        // params.internalMeshing.internalCenterX and internalCenterY are relative to pinion center (0, 0).
        // Therefore Pinion center = internalCenter - [internalCenterX, internalCenterY]
        var pinionCenter = [
            internalCenter[0] - params.internalMeshing.internalCenterX,
            internalCenter[1] - params.internalMeshing.internalCenterY
        ];

        // Draw Pinion (External Spur Gear)
        var pinionGroup = drawGear(
            doc,
            layer,
            pinionCenter,
            params.pinionData,
            params.internalMeshing.pinionRotationDeg,
            "Pinion_z" + params.pinionData.z,
            params.options
        );

        // Draw Internal Ring Gear
        var internalGroup = drawInternalGear(
            doc,
            layer,
            internalCenter,
            params.internalData,
            params.internalMeshing.internalRotationDeg,
            "InternalGear_z" + params.internalData.z,
            params.options
        );

        var pairGroup = layer.groupItems.add();
        pairGroup.name = "InternalPair_m" + params.pinionData.m + "_z" + params.pinionData.z + "x" + params.internalData.z;
        internalGroup.moveToBeginning(pairGroup);
        pinionGroup.moveToBeginning(pairGroup);

        return pairGroup;
    }

    /**
     * Draw 3K Paradoxical Planetary Gear Set on Illustrator document.
     */
    function drawParadoxicalPlanetary(doc, params, options) {
        options = options || {};
        var layer = getOrCreateLayer(doc, "GearDrawer_Paradoxical");

        var abRect = getActiveArtboardRect(doc);
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var systemCenter = resolveSystemCenter(options, [abRect[0] + abWidth / 2, abRect[1] - abHeight / 2]);

        var systemGroup = layer.groupItems.add();
        systemGroup.name = "Paradoxical_m" + params.m + "_s" + params.zs + "p" + params.zp + "r" + params.zr1 + "x" + params.zr2;

        // 1. Draw Sun Gear (Blue)
        var sunGroup = drawGear(
            doc,
            layer,
            systemCenter,
            params.sunData,
            0.0,
            "Sun_z" + params.zs,
            options
        );
        sunGroup.moveToBeginning(systemGroup);

        // 2. Draw Planets
        var planetContainer = systemGroup.groupItems.add();
        planetContainer.name = "Planets_zp" + params.zp + "_Count" + params.planets.length;

        for (var p = 0; p < params.planets.length; p++) {
            var pl = params.planets[p];
            var pCenter = [systemCenter[0] + pl.centerX, systemCenter[1] + pl.centerY];
            var pGroup = drawGear(
                doc,
                layer,
                pCenter,
                params.planetData,
                pl.rotationDeg,
                "Planet_" + (p + 1) + "_z" + params.zp,
                options
            );
            pGroup.moveToBeginning(planetContainer);
        }

        // 3. Draw Fixed Ring Gear 1 (Red)
        var ring1Group = drawInternalGear(
            doc,
            layer,
            systemCenter,
            params.ring1Data,
            0.0,
            "Ring1_Fixed_z" + params.zr1,
            options
        );
        ring1Group.moveToBeginning(systemGroup);

        // 4. Draw Output Ring Gear 2 (Purple / shifted)
        var ring2Group = drawInternalGear(
            doc,
            layer,
            systemCenter,
            params.ring2Data,
            0.0,
            "Ring2_Output_z" + params.zr2 + "_x" + Math.round(params.xr2 * 100) / 100,
            options
        );
        ring2Group.moveToBeginning(systemGroup);

        return systemGroup;
    }

    /**
     * Draw Standard 2K-H Planetary Gear Set on Illustrator document.
     */
    function drawStandardPlanetary(doc, params, options) {
        options = options || {};
        var layer = getOrCreateLayer(doc, "GearDrawer_Planetary");

        var abRect = getActiveArtboardRect(doc);
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var systemCenter = resolveSystemCenter(options, [abRect[0] + abWidth / 2, abRect[1] - abHeight / 2]);

        var systemGroup = layer.groupItems.add();
        systemGroup.name = "Planetary_m" + params.m + "_s" + params.zs + "p" + params.zp + "r" + params.zr;

        // 1. Draw Sun Gear
        var sunGroup = drawGear(
            doc,
            layer,
            systemCenter,
            params.sunData,
            0.0,
            "Sun_z" + params.zs,
            options
        );
        sunGroup.moveToBeginning(systemGroup);

        // 2. Draw Planets
        var planetContainer = systemGroup.groupItems.add();
        planetContainer.name = "Planets_zp" + params.zp + "_Count" + params.planets.length;

        for (var p = 0; p < params.planets.length; p++) {
            var pl = params.planets[p];
            var pCenter = [systemCenter[0] + pl.centerX, systemCenter[1] + pl.centerY];
            var pGroup = drawGear(
                doc,
                layer,
                pCenter,
                params.planetData,
                pl.rotationDeg,
                "Planet_" + (p + 1) + "_z" + params.zp,
                options
            );
            pGroup.moveToBeginning(planetContainer);
        }

        // 3. Draw Ring Gear
        var ringGroup = drawInternalGear(
            doc,
            layer,
            systemCenter,
            params.ringData,
            0.0,
            "Ring_z" + params.zr,
            options
        );
        ringGroup.moveToBeginning(systemGroup);

        return systemGroup;
    }

    /**
     * Handles the original selected circle object on artboard.
     * 
     * @param {PathItem} circleItem
     * @param {String} fate "guide" | "delete" | "keep"
     */
    function handleSelectedCircles(circleItems, fate) {
        if (!circleItems) return;
        var list = (circleItems instanceof Array) ? circleItems : [circleItems];
        for (var i = 0; i < list.length; i++) {
            var itm = list[i];
            if (!itm) continue;
            try {
                if (fate === "guide") {
                    itm.guides = true;
                    itm.selected = false;
                } else if (fate === "delete") {
                    itm.remove();
                } else {
                    itm.selected = false;
                }
            } catch (e) {
                // Ignore error
            }
        }
    }
    var handleSelectedCircle = handleSelectedCircles;

    /**
     * Draws JIS B 0003 & Kinematic Skeleton Diagram into the DWG layer.
     * Follows strict JIS gear drafting conventions:
     * - Tip circle (da): Solid outer boundary
     * - Pitch circle (d): Fine dash-dot line [6, 2, 1.5, 2]
     * - Root circle (df): Fine solid line
     * - Axis center: Dash-dot crosshair compound path
     * - Center-to-center line: Dash-dot kinematic link line
     * 
     * @param {Layer} dwgLayer
     * @param {Array} gears List of { id, center, m, z, pitchRadiusPt, tipRadiusPt, rootRadiusPt }
     * @param {Array} connections List of [center1, center2, id1, id2]
     * @param {Object} options
     */
    function drawDwgSkeleton(dwgLayer, gears, connections, options) {
        if (!dwgLayer) return;
        unlockAndShowLayer(dwgLayer);
        try { dwgLayer.parent.activeLayer = dwgLayer; } catch (eAL) {}
        var dwgGroup = dwgLayer.groupItems.add();
        dwgGroup.name = "Skeleton_Kinematics";

        var regColor = getRegistrationColor(dwgLayer.parent);
        var strokeWidth = (options && options.guideStrokeWidth) ? options.guideStrokeWidth : 0.25;

        // 1. Draw connection lines between meshing centers (Kinematic link lines)
        if (connections) {
            for (var c = 0; c < connections.length; c++) {
                var conn = connections[c];
                var cLine = dwgGroup.pathItems.add();
                cLine.name = "CenterLine_" + conn[2] + "_to_" + conn[3];
                cLine.setEntirePath([conn[0], conn[1]]);
                applyGuideStyle(cLine, strokeWidth, regColor, [6, 2, 1.5, 2]);
            }
        }

        // 2. Draw each gear's theoretical circles & axis crosshair
        if (gears) {
            for (var g = 0; g < gears.length; g++) {
                var gear = gears[g];
                var center = gear.center;
                var gDwgGroup = dwgGroup.groupItems.add();
                gDwgGroup.name = gear.id + "_Dwg";

                // 2a. Pitch Circle (Fine Dash-Dot Line) - JIS Standard
                var pCirc = gDwgGroup.pathItems.ellipse(
                    center[1] + gear.pitchRadiusPt,
                    center[0] - gear.pitchRadiusPt,
                    gear.pitchRadiusPt * 2,
                    gear.pitchRadiusPt * 2
                );
                pCirc.name = gear.id + "_PitchCircle_d" + (gear.pitchRadiusPt * 2 * 25.4 / 72).toFixed(1);
                applyGuideStyle(pCirc, strokeWidth, regColor, [6, 2, 1.5, 2]);

                // 2b. Tip Circle (Solid Line) - JIS Standard
                var tCirc = gDwgGroup.pathItems.ellipse(
                    center[1] + gear.tipRadiusPt,
                    center[0] - gear.tipRadiusPt,
                    gear.tipRadiusPt * 2,
                    gear.tipRadiusPt * 2
                );
                tCirc.name = gear.id + "_TipCircle_da" + (gear.tipRadiusPt * 2 * 25.4 / 72).toFixed(1);
                applyGuideStyle(tCirc, strokeWidth * 1.4, regColor);

                // 2c. Root Circle (Fine Solid Line)
                if (gear.rootRadiusPt && gear.rootRadiusPt > 0) {
                    var rCirc = gDwgGroup.pathItems.ellipse(
                        center[1] + gear.rootRadiusPt,
                        center[0] - gear.rootRadiusPt,
                        gear.rootRadiusPt * 2,
                        gear.rootRadiusPt * 2
                    );
                    rCirc.name = gear.id + "_RootCircle_df" + (gear.rootRadiusPt * 2 * 25.4 / 72).toFixed(1);
                    applyGuideStyle(rCirc, strokeWidth * 0.8, regColor);
                }

                // 2d. Axis Center Crosshair (CompoundPath with Dash-Dot)
                var crossLen = Math.max(gear.pitchRadiusPt * 0.5, 12);
                var crossCompound = gDwgGroup.compoundPathItems.add();
                crossCompound.name = gear.id + "_AxisCross";
                var hLine = crossCompound.pathItems.add();
                hLine.setEntirePath([[center[0] - crossLen, center[1]], [center[0] + crossLen, center[1]]]);
                var vLine = crossCompound.pathItems.add();
                vLine.setEntirePath([[center[0], center[1] - crossLen], [center[0], center[1] + crossLen]]);
                applyGuideStyle(crossCompound, strokeWidth, regColor, [6, 2, 1.5, 2]);
            }
        }
    }

    /**
     * Draw a complete branched gear train (tree graph) into Illustrator.
     * Generates hierarchical layers (Main layer -> Sublayers per stack level),
     * applies token-based naming conventions, and generates a JIS B 0003
     * kinematic skeleton drawing layer.
     * 
     * @param {Document} doc
     * @param {Object} trainData Result from InvoluteMath.calculateBranchedGearTrain
     * @param {Object} options Drawing options (cutStrokeWidth, guideStrokeWidth, drawGuides, naming, etc.)
     */
    function drawBranchedGearTrain(doc, trainData, options) {
        options = options || {};
        var naming = options.naming || InvoluteMath.NAMING_PRESETS.standard;
        var trainId = options.trainId || "T1";

        var abRect = getActiveArtboardRect(doc);
        var centers = resolveTrainCenters(trainData.nodes, options, abRect);

        logTrace("DRAW_TRAIN", "Starting branched gear train drawing", {
            trainId: trainId,
            nodeCount: trainData.nodes ? trainData.nodes.length : 0,
            m: trainData.m,
            placementRef: options.placementRef || "original"
        });

        // 1. Create Main Train Layer (e.g. "T1")
        var mainLayerName = InvoluteMath.formatName(naming.mainLayer, {
            train: trainId,
            m: trainData.m
        });
        var mainLayer = getOrCreateLayer(doc, mainLayerName);

        // Overwrite mode: clear all existing items and sublayers in the target train layer
        if (options.overwriteLayer && mainLayer) {
            try {
                unlockAndShowLayer(mainLayer);
                while (mainLayer.pageItems.length > 0) {
                    try { mainLayer.pageItems[0].locked = false; } catch (eItmLk) {}
                    mainLayer.pageItems[0].remove();
                }
                while (mainLayer.layers.length > 0) {
                    unlockAndShowLayer(mainLayer.layers[0]);
                    mainLayer.layers[0].remove();
                }
            } catch (eClean) {
                // Ignore cleanup errors on system items
            }
        }

        // 2. Prepare sublayer dictionary by layerIndex/stageIndex (e.g. "T1_L1", "T1_L2")
        var subLayers = {};
        for (var s = 0; s < trainData.nodes.length; s++) {
            var sNd = trainData.nodes[s];
            var lIdx = sNd.stageIndex || sNd.layerIndex || 1;
            if (!subLayers[lIdx]) {
                var origLyr = sNd.layerName || ((sNd.origCircle && sNd.origCircle.layerName) ? sNd.origCircle.layerName : "");
                var subName = InvoluteMath.formatName(naming.subLayer, {
                    train: trainId,
                    layer: lIdx,
                    stage: lIdx,
                    origLayer: origLyr,
                    layerName: origLyr,
                    m: sNd.m || trainData.m,
                    alpha: sNd.alphaDeg || trainData.alphaDeg
                });
                subLayers[lIdx] = getOrCreateLayer(doc, subName, mainLayer);
            }
        }

        var dwgGears = [];
        var dwgConnections = [];

        // 3. Draw each gear node into its designated sublayer
        for (var i = 0; i < trainData.nodes.length; i++) {
            var nd = trainData.nodes[i];
            var lIndex = nd.stageIndex || nd.layerIndex || 1;
            var targetLayer = subLayers[lIndex] || mainLayer;
            unlockAndShowLayer(targetLayer);
            try { doc.activeLayer = targetLayer; } catch (eAL) {}

            var center = centers[i];

            var isInternal = (nd.gearType === "INTERNAL");
            var isRack = (nd.gearType === "RACK");
            var nodeM = nd.m || trainData.m;
            var nodeAlpha = nd.alphaDeg || trainData.alphaDeg;
            var dVal = isRack ? (nodeM * nd.z) : (isInternal ? (nd.gearData.rpMm * 2) : (nd.gearData.d || nd.gearData.pitchDiameter || (nodeM * nd.z)));
            var daVal = isRack ? (nodeM * (nd.z + 2)) : (isInternal ? (nd.gearData.raMm * 2) : (nd.gearData.da || (nodeM * (nd.z + 2))));

            var origLyrNode = nd.layerName || ((nd.origCircle && nd.origCircle.layerName) ? nd.origCircle.layerName : "");
            var gearName = InvoluteMath.formatName(naming.gearGroup, {
                train: trainId,
                layer: lIndex,
                stage: lIndex,
                origLayer: origLyrNode,
                layerName: origLyrNode,
                id: nd.id,
                parentId: nd.parentId || "Root",
                role: nd.relationType,
                m: nodeM,
                alpha: nodeAlpha,
                z: nd.z,
                gearType: isRack ? "RACK" : (isInternal ? "INTERNAL" : "SPUR"),
                type: isRack ? "Rack" : (isInternal ? "Internal" : "Spur"),
                d: dVal,
                pcd: dVal,
                da: daVal,
                shaft: isInternal ? ("rim" + nd.rimDiameter) : (isRack ? "h" + (nd.rackHeight || 12) : nd.shaftDiameter),
                angle: nd.relativeAngleDeg
            });

            if (isRack) {
                drawRack(
                    doc,
                    targetLayer,
                    center,
                    nd.gearData,
                    nd.rotationDeg,
                    (nd.shiftPt !== undefined) ? nd.shiftPt : 0,
                    gearName,
                    options
                );
            } else if (isInternal) {
                drawInternalGear(
                    doc,
                    targetLayer,
                    center,
                    nd.gearData,
                    nd.rotationDeg,
                    gearName,
                    options
                );
            } else {
                var gearOptions = options;
                var nodeInd = (nd.outputIndividualTeeth !== undefined) ? nd.outputIndividualTeeth : nd.individualTeeth;
                if (nodeInd !== undefined) {
                    gearOptions = {};
                    for (var optKey in options) {
                        if (options.hasOwnProperty(optKey)) gearOptions[optKey] = options[optKey];
                    }
                    gearOptions.outputIndividualTeeth = !!nodeInd;
                    gearOptions.individualTeeth = !!nodeInd;
                }
                drawGear(
                    doc,
                    targetLayer,
                    center,
                    nd.gearData,
                    nd.rotationDeg,
                    gearName,
                    gearOptions
                );
            }

            // Collect info for DWG skeleton layer
            if (!isRack) {
                dwgGears.push({
                    id: nd.id,
                    center: center,
                    m: nodeM,
                    alpha: nodeAlpha,
                    z: nd.z,
                    gearType: nd.gearType,
                    pitchRadiusPt: isInternal ? nd.gearData.rpPt : nd.gearData.pitchRadiusPt,
                    tipRadiusPt: isInternal ? nd.gearData.raPt : nd.gearData.tipRadiusPt,
                    rootRadiusPt: isInternal ? nd.gearData.rfPt : nd.gearData.rootRadiusPt
                });
            }

            // Collect connections for DWG skeleton layer
            if (nd.parentId && nd.relationType === "MESHING") {
                var pIdx = -1;
                for (var k = 0; k < trainData.nodes.length; k++) {
                    if (trainData.nodes[k].id === nd.parentId) {
                        pIdx = k;
                        break;
                    }
                }
                if (pIdx >= 0) {
                    var pCenter = centers[pIdx];
                    dwgConnections.push([pCenter, center, nd.parentId, nd.id]);
                }
            }
        }

        // 4. Generate Drawing / Skeleton Sublayer (e.g. "T1_dwg" or per-stage "T1_1_dwg" under mainLayer)
        if (options.drawDwgLayer !== false) {
            if (options.skelMode === "per_stage") {
                // Group gears and connections by stage / layerIndex
                var stagesMap = {};
                for (var sg = 0; sg < dwgGears.length; sg++) {
                    var stIdx = trainData.nodes[sg].layerIndex || 1;
                    if (!stagesMap[stIdx]) stagesMap[stIdx] = { gears: [], conns: [] };
                    stagesMap[stIdx].gears.push(dwgGears[sg]);
                }
                for (var sc = 0; sc < dwgConnections.length; sc++) {
                    var conn = dwgConnections[sc];
                    // Find stage of child
                    var cId = conn[3];
                    var cStage = 1;
                    for (var cn = 0; cn < trainData.nodes.length; cn++) {
                        if (trainData.nodes[cn].id === cId) {
                            cStage = trainData.nodes[cn].layerIndex || 1;
                            break;
                        }
                    }
                    if (!stagesMap[cStage]) stagesMap[cStage] = { gears: [], conns: [] };
                    stagesMap[cStage].conns.push(conn);
                }

                for (var stageKey in stagesMap) {
                    if (stagesMap.hasOwnProperty(stageKey)) {
                        var stData = stagesMap[stageKey];
                        var stageDwgName = InvoluteMath.formatName(naming.dwgLayer, {
                            train: trainId,
                            layer: stageKey,
                            stage: stageKey,
                            m: trainData.m
                        });
                        // If template didn't include stage/layer, append stage suffix
                        if (stageDwgName.indexOf(stageKey) === -1 && stageDwgName === naming.dwgLayer) {
                            stageDwgName = trainId + "_" + stageKey + "_dwg";
                        }
                        var stDwgLayer = getOrCreateLayer(doc, stageDwgName, mainLayer);
                        drawDwgSkeleton(stDwgLayer, stData.gears, stData.conns, options);
                    }
                }
            } else {
                var dwgLayerName = InvoluteMath.formatName(naming.dwgLayer, {
                    train: trainId,
                    m: trainData.m
                });
                var dwgLayer = getOrCreateLayer(doc, dwgLayerName, mainLayer);
                drawDwgSkeleton(dwgLayer, dwgGears, dwgConnections, options);
            }
        }

        return mainLayer;
    }

    return {
        getOrCreateLayer: getOrCreateLayer,
        isIsolationMode: isIsolationMode,
        ensureExitIsolationMode: ensureExitIsolationMode,
        drawGear: drawGear,
        drawMeshingPair: drawMeshingPair,
        drawRack: drawRack,
        drawRackAndPinionPair: drawRackAndPinionPair,
        drawInternalGear: drawInternalGear,
        drawInternalMeshingPair: drawInternalMeshingPair,
        drawStandardPlanetary: drawStandardPlanetary,
        drawParadoxicalPlanetary: drawParadoxicalPlanetary,
        handleSelectedCircle: handleSelectedCircle,
        handleSelectedCircles: handleSelectedCircles,
        resolveTrainCenters: resolveTrainCenters,
        resolveSystemCenter: resolveSystemCenter,
        drawBranchedGearTrain: drawBranchedGearTrain
    };
})();

/**
 * DialogView.jsxinc - GearDrawer Universal ScriptUI Dialog (2-Tabbed Architecture v2)
 * Version: 1.0.0
 * 
 * Provides an intuitive, compact 2-tabbed interface:
 * - Tab 1: Gear Creation (Main)
 *     1. Mechanism Type Panel (Branched, Planetary, Paradoxical)
 *     2. Circle Object Topology Panel (Source selection, rescan, pitch/tip interpretation, strict isCircle check)
 *     3. Mechanism Configuration Panel (Expanded 10-row gear table, gear ID editor with unique check & enter protection,
 *        parent-first inputs, reduction ratio column, outer diameter/rim thickness column, stage specs)
 *     4. Gear Creation Options (6 specific checkboxes: compound path, pitch same layer, center guide same group,
 *        spec labels, single skeleton layer, per-stage skeleton layer)
 *     5. Placement & Origin Panel (Train ID with auto-increment, placement reference "Root Gear Center", X/Y mm)
 *     6. Calculation & Interference Preview Panel
 * - Tab 2: Standard Preferences (Settings)
 *     1. General Settings (Module without unit, pressure angle, backlash, kerf, shaft diameter, shaft type, thickness basis)
 *     2. CAD/CAM Styles & Precision (Presets, detailed modal with color preview & document swatch picker)
 *     3. Layers & Naming Conventions ({prefix}{Number} format)
 *     4. Diagnostics & Log Preferences (Log directory, auto-check log on creation)
 *     5. Profile JSON Import / Export & Reset
 * - Common Action Footer:
 *     [View Log...] [Reset to Defaults] [Cancel] [Draw Gears]
 */

var DialogView = (function () {
    var MM_TO_PT = 72.0 / 25.4;
    var PT_TO_MM = 25.4 / 72.0;

    // ==========================================
    // 0. Lightweight Safe JSON Polyfill for ExtendScript
    // ==========================================
    var SimpleJSON = {
        stringify: function (obj, indent) {
            indent = indent || "";
            if (obj === null) return "null";
            if (typeof obj === "undefined") return "undefined";
            if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
            if (typeof obj === "string") {
                return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
            }
            var isArr = (Object.prototype.toString.call(obj) === "[object Array]" || obj instanceof Array);
            if (isArr) {
                var arrItems = [];
                for (var i = 0; i < obj.length; i++) {
                    arrItems.push(indent + "  " + SimpleJSON.stringify(obj[i], indent + "  "));
                }
                return "[\n" + arrItems.join(",\n") + "\n" + indent + "]";
            }
            if (typeof obj === "object") {
                var objItems = [];
                for (var k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        objItems.push(indent + '  "' + k + '": ' + SimpleJSON.stringify(obj[k], indent + "  "));
                    }
                }
                return "{\n" + objItems.join(",\n") + "\n" + indent + "}";
            }
            return String(obj);
        },
        parse: function (str) {
            if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
                return JSON.parse(str);
            }
            return eval("(" + str + ")");
        }
    };

    // ==========================================
    // 0b. CAD / CAM Style Presets
    // ==========================================
    var STYLE_PRESETS = {
        laser: {
            name: "\u30ec\u30fc\u30b6\u30fc\u52a0\u5de5\u6a19\u6e96 (Laser Hairline Red)",
            cut: { r: 255, g: 0, b: 0, strokeWidthPt: 0.001, dashes: [] },
            pitchGuide: { r: 0, g: 150, b: 0, strokeWidthPt: 0.25, dashes: [4, 2] },
            baseGuide: { r: 0, g: 100, b: 255, strokeWidthPt: 0.25, dashes: [] },
            skeleton: { r: 0, g: 0, b: 0, strokeWidthPt: 0.25, dashes: [] }
        },
        jis: {
            name: "JIS \u6a5f\u68b0\u88fd\u56f3\u6a19\u6e96 (0.5mm \u592a\u7dda/\u7d30\u7dda)",
            cut: { r: 0, g: 0, b: 0, strokeWidthPt: 0.5 * (72.0 / 25.4), dashes: [] },
            pitchGuide: { r: 255, g: 0, b: 0, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [12, 2, 2, 2] },
            baseGuide: { r: 0, g: 150, b: 0, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [] },
            skeleton: { r: 0, g: 0, b: 255, strokeWidthPt: 0.25 * (72.0 / 25.4), dashes: [12, 2, 2, 2] }
        },
        cnc: {
            name: "CNC\u5207\u524a / 3D\u30d7\u30ea\u30f3\u30c8\u6a19\u6e96",
            cut: { r: 255, g: 0, b: 255, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            pitchGuide: { r: 0, g: 255, b: 255, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            baseGuide: { r: 100, g: 100, b: 100, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] },
            skeleton: { r: 0, g: 0, b: 0, strokeWidthPt: 0.1 * (72.0 / 25.4), dashes: [] }
        }
    };

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

    // ==========================================
    // 0c. Modal: Detailed Style Configuration (with Color Previews & Swatch Picker)
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
        var pnlCut = modal.add("panel", undefined, "\u5207\u65ad\u7dda (Cut - \u5916\u5f62\u30fb\u8ef8\u7a74)");
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
        var pnlPitch = modal.add("panel", undefined, "\u30d4\u30c3\u30c1\u5186\u30ac\u30a4\u30c9 (Pitch Guide)");
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
        var pnlBase = modal.add("panel", undefined, "\u57fa\u790e\u5186\u30ac\u30a4\u30c9 (Base Guide)");
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

        // Skeleton
        var pnlSkel = modal.add("panel", undefined, "JIS \u9aa8\u683c\u56f3\u7dda (Kinematic Skeleton)");
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

        // Swatch shortcut
        var rowSwatch = modal.add("group");
        rowSwatch.orientation = "row";
        rowSwatch.spacing = 8;
        rowSwatch.add("statictext", undefined, "\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u30b9\u30a6\u30a9\u30c3\u30c1\u304b\u3089\u5207\u65ad\u8272\u3092\u53d6\u5f97:");
        var swatchNames = ["(\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044)"];
        var swatchObjs = [];
        try {
            if (app.documents.length > 0) {
                var sws = app.activeDocument.swatches;
                for (var s = 0; s < sws.length; s++) {
                    swatchNames.push(sws[s].name);
                    swatchObjs.push(sws[s]);
                }
            }
        } catch (eSw) {}
        var ddSwatches = rowSwatch.add("dropdownlist", undefined, swatchNames);
        ddSwatches.selection = 0;
        ddSwatches.onChange = function () {
            if (ddSwatches.selection && ddSwatches.selection.index > 0) {
                var targetSw = swatchObjs[ddSwatches.selection.index - 1];
                if (targetSw && targetSw.color && targetSw.color.typename === "RGBColor") {
                    etCutR.text = String(Math.round(targetSw.color.red));
                    etCutG.text = String(Math.round(targetSw.color.green));
                    etCutB.text = String(Math.round(targetSw.color.blue));
                    updateCutPrev();
                }
            }
        };

        // Action Buttons
        var grpM = modal.add("group");
        grpM.orientation = "row";
        grpM.alignment = ["right", "center"];
        var btnMCan = grpM.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb");
        var btnMOk = grpM.add("button", undefined, "\u8a2d\u5b9a\u3092\u9069\u7528");

        btnMCan.onClick = function () { modal.close(0); };
        btnMOk.onClick = function () {
            function parseDashes(str) {
                if (!str) return [];
                var parts = str.split(",");
                var res = [];
                for (var p = 0; p < parts.length; p++) {
                    var v = parseFloat(parts[p]);
                    if (!isNaN(v) && v > 0) res.push(v);
                }
                return res;
            }

            var updated = {
                name: "\u30ab\u30b9\u30bf\u30e0 (Custom)",
                cut: {
                    r: parseInt(etCutR.text, 10) || 0,
                    g: parseInt(etCutG.text, 10) || 0,
                    b: parseInt(etCutB.text, 10) || 0,
                    strokeWidthPt: parseFloat(etCutW.text) || 0.001,
                    dashes: []
                },
                pitchGuide: {
                    r: parseInt(etPitchR.text, 10) || 0,
                    g: parseInt(etPitchG.text, 10) || 0,
                    b: parseInt(etPitchB.text, 10) || 0,
                    strokeWidthPt: parseFloat(etPitchW.text) || 0.25,
                    dashes: parseDashes(etPitchDash.text)
                },
                baseGuide: {
                    r: parseInt(etBaseR.text, 10) || 0,
                    g: parseInt(etBaseG.text, 10) || 0,
                    b: parseInt(etBaseB.text, 10) || 0,
                    strokeWidthPt: parseFloat(etBaseW.text) || 0.25,
                    dashes: []
                },
                skeleton: {
                    r: parseInt(etSkelR.text, 10) || 0,
                    g: parseInt(etSkelG.text, 10) || 0,
                    b: parseInt(etSkelB.text, 10) || 0,
                    strokeWidthPt: parseFloat(etSkelW.text) || 0.25,
                    dashes: []
                }
            };
            modal.close(1);
            if (onApply) onApply(updated);
        };

        modal.show();
    }

    // ==========================================
    // 0d. Settings Profile I/O Helpers
    // ==========================================
    function getLocalSettingsFile() {
        var basePath = "";
        try {
            if (typeof Folder !== "undefined" && Folder.userData) {
                basePath = Folder.userData.fsName;
            }
        } catch (eF) {}
        if (!basePath && typeof process !== "undefined" && process.env) {
            basePath = process.env.APPDATA || process.env.HOME || ".";
        }
        if (!basePath) basePath = "~";
        var folder = new Folder(basePath + "/GearDrawer");
        if (!folder.exists) {
            try { folder.create(); } catch (eC) {}
        }
        return new File(folder.fsName + "/geardrawer_preferences.json");
    }

    function saveLocalSettings(profileObj) {
        try {
            var file = getLocalSettingsFile();
            file.encoding = "UTF-8";
            file.open("w");
            file.write(SimpleJSON.stringify(profileObj, ""));
            file.close();
            return true;
        } catch (eSave) {
            return false;
        }
    }

    function loadLocalSettings(onLoaded) {
        try {
            var file = getLocalSettingsFile();
            if (file && file.exists) {
                file.encoding = "UTF-8";
                file.open("r");
                var content = file.read();
                file.close();
                if (content && content.length > 0) {
                    var profile = SimpleJSON.parse(content);
                    if (profile && typeof profile === "object") {
                        if (onLoaded) onLoaded(profile);
                        return true;
                    }
                }
            }
        } catch (eLoad) {}
        return false;
    }

    function exportSettingsProfile(profileObj) {
        try {
            var file = File.saveDialog(
                "\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u306e\u4fdd\u5b58",
                "GearDrawer Profile (*.json):*.json"
            );
            if (!file) return;
            if (file.name.indexOf(".") === -1) {
                file = new File(file.fsName + ".json");
            }
            file.encoding = "UTF-8";
            file.open("w");
            file.write(SimpleJSON.stringify(profileObj, ""));
            file.close();
            alert("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f:\n" + file.fsName);
        } catch (eExp) {
            alert("\u4fdd\u5b58\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + eExp.message);
        }
    }

    function importSettingsProfile(onLoaded) {
        try {
            var file = File.openDialog(
                "\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u306e\u8aad\u307f\u8fbc\u307f",
                "GearDrawer Profile (*.json):*.json"
            );
            if (!file) return;
            file.encoding = "UTF-8";
            file.open("r");
            var content = file.read();
            file.close();
            var profile = SimpleJSON.parse(content);
            if (profile && typeof profile === "object") {
                onLoaded(profile);
                alert("\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u3092\u8aad\u307f\u8fbc\u307f\u307e\u3057\u305f:\n" + file.fsName);
            }
        } catch (eImp) {
            alert("\u8aad\u307f\u8fbc\u307f\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + eImp.message);
        }
    }

    // ==========================================
    // 0e. Suggested Train ID Generator
    // ==========================================
    function getSuggestedTrainId(doc) {
        if (!doc) return "T1";
        var maxNum = 0;
        try {
            for (var i = 0; i < doc.layers.length; i++) {
                var name = doc.layers[i].name;
                var m = name.match(/^[Tt](\d+)$/);
                if (m) {
                    var num = parseInt(m[1], 10);
                    if (num > maxNum) maxNum = num;
                } else {
                    var m2 = name.match(/Train_?[Tt]?(\d+)/i);
                    if (m2) {
                        var num2 = parseInt(m2[1], 10);
                        if (num2 > maxNum) maxNum = num2;
                    }
                }
            }
        } catch (e) {}
        return "T" + (maxNum + 1);
    }

    // ==========================================
    // 0f. Strict Circular Geometry Validator
    // ==========================================
    function isStrictCircle(itm) {
        if (!itm || itm.typename !== "PathItem") return false;
        var w = Math.abs(itm.width);
        var h = Math.abs(itm.height);
        if (Math.abs(w - h) >= 0.5) return false;
        if (!itm.pathPoints || itm.pathPoints.length !== 4) return false;
        var pts = itm.pathPoints;
        var hasHandles = false;
        for (var p = 0; p < pts.length; p++) {
            var pt = pts[p];
            var dL = Math.sqrt(Math.pow(pt.leftDirection[0] - pt.anchor[0], 2) + Math.pow(pt.leftDirection[1] - pt.anchor[1], 2));
            var dR = Math.sqrt(Math.pow(pt.rightDirection[0] - pt.anchor[0], 2) + Math.pow(pt.rightDirection[1] - pt.anchor[1], 2));
            if (dL > 0.5 || dR > 0.5) {
                hasHandles = true;
                break;
            }
        }
        return hasHandles;
    }

    // ==========================================
    // Main Dialog Builder
    // ==========================================
    function show(arg1, arg2) {
        var onGenerate = null;
        var selectedCircleInfo = null;
        if (typeof arg1 === "function") {
            onGenerate = arg1;
        } else {
            selectedCircleInfo = arg1;
            onGenerate = arg2;
        }
        var win = new Window("dialog", "GearDrawer - \u6b6f\u8eca\u4f5c\u56f3\u30c4\u30fc\u30eb (v1.0)");
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        var selectedCircles = [];
        var btnOk = null;

        function scanCircles(fromAllLayers) {
            var detected = [];
            var doc = null;
            try {
                if (app.documents.length > 0) doc = app.activeDocument;
            } catch (e) {}
            if (!doc) return detected;

            var COLOR_INTERNAL_GEAR_RGB = [255, 0, 0];

            function getItemLayerName(itm) {
                if (!itm) return "Default";
                try {
                    if (itm.layer && itm.layer.name) return itm.layer.name;
                    var cur = itm.parent;
                    while (cur) {
                        if (cur.typename === "Layer") return cur.name;
                        cur = cur.parent;
                    }
                } catch (e) {}
                return "Default";
            }

            function inspectItem(itm) {
                if (!itm) return;
                if (itm.typename === "PathItem") {
                    if (isStrictCircle(itm)) {
                        var w = Math.abs(itm.width);
                        var h = Math.abs(itm.height);
                        var diamPt = (w + h) / 2.0;
                        var diamMm = diamPt * (25.4 / 72.0);
                        var centerPt = [itm.left + w / 2.0, itm.top - h / 2.0];

                        var gearType = "SPUR";
                        var rgb = null;
                        try {
                            var col = (itm.stroked && itm.strokeColor) ? itm.strokeColor : (itm.filled ? itm.fillColor : null);
                            if (col && col.typename === "RGBColor") {
                                rgb = [Math.round(col.red), Math.round(col.green), Math.round(col.blue)];
                                if (rgb[0] === COLOR_INTERNAL_GEAR_RGB[0] &&
                                    rgb[1] === COLOR_INTERNAL_GEAR_RGB[1] &&
                                    rgb[2] === COLOR_INTERNAL_GEAR_RGB[2]) {
                                    gearType = "INTERNAL";
                                }
                            }
                        } catch (e) {}

                        detected.push({
                            id: "C" + (detected.length + 1),
                            item: itm,
                            diameterPt: diamPt,
                            diameterMm: Math.round(diamMm * 100) / 100,
                            centerPt: centerPt,
                            layerName: getItemLayerName(itm),
                            rgb: rgb,
                            gearType: gearType
                        });
                    }
                } else if (itm.typename === "GroupItem") {
                    try {
                        for (var g = 0; g < itm.pageItems.length; g++) {
                            inspectItem(itm.pageItems[g]);
                        }
                    } catch (e) {}
                } else if (itm.typename === "CompoundPathItem") {
                    try {
                        for (var cp = 0; cp < itm.pathItems.length; cp++) {
                            inspectItem(itm.pathItems[cp]);
                        }
                    } catch (e) {}
                }
            }

            if (fromAllLayers) {
                function scanLayer(lyr) {
                    if (!lyr.visible) return;
                    for (var p = 0; p < lyr.pageItems.length; p++) {
                        inspectItem(lyr.pageItems[p]);
                    }
                    for (var s = 0; s < lyr.layers.length; s++) {
                        scanLayer(lyr.layers[s]);
                    }
                }
                for (var l = 0; l < doc.layers.length; l++) {
                    scanLayer(doc.layers[l]);
                }
            } else {
                if (doc.selection && doc.selection.length > 0) {
                    for (var sIdx = 0; sIdx < doc.selection.length; sIdx++) {
                        inspectItem(doc.selection[sIdx]);
                    }
                }
            }

            if (typeof CalcLogger !== "undefined") {
                CalcLogger.log("SCAN_CIRCLES", "Circles scanned (" + (fromAllLayers ? "All Layers" : "Selection") + ")", {
                    count: detected.length,
                    circles: (function () {
                        var res = [];
                        for (var d = 0; d < detected.length; d++) {
                            res.push({
                                id: detected[d].id,
                                layer: detected[d].layerName,
                                dMm: detected[d].diameterMm,
                                gearType: detected[d].gearType
                            });
                        }
                        return res;
                    })()
                });
            }

            return detected;
        }

        var activeDoc = null;
        try { if (app.documents.length > 0) activeDoc = app.activeDocument; } catch (eAD) {}
        var initialTrainId = getSuggestedTrainId(activeDoc);

        var selectedCircles = scanCircles(false);
        var currentStyles = cloneObj(STYLE_PRESETS.laser);

        // ==========================================
        // Main 2-Pane Horizontal Layout
        // ==========================================
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;
        win.preferredSize.width = 800;
        win.preferredSize.height = 780;

        var grpPanes = win.add("group");
        grpPanes.orientation = "row";
        grpPanes.alignment = ["fill", "fill"];
        grpPanes.alignChildren = ["fill", "fill"];
        grpPanes.spacing = 10;

        // Left Pane: Circle Input & Gear Train Configuration
        var paneLeft = grpPanes.add("group");
        paneLeft.orientation = "column";
        paneLeft.alignChildren = ["fill", "top"];
        paneLeft.preferredSize.width = 450;
        paneLeft.spacing = 6;

        // Right Pane: CAD/CAM Styles, Geometry Options, Creation Options & Defaults
        var paneRight = grpPanes.add("group");
        paneRight.orientation = "column";
        paneRight.alignChildren = ["fill", "top"];
        paneRight.preferredSize.width = 330;
        paneRight.spacing = 6;

        // ==========================================
        // --- RIGHT PANE: STYLES, OPTIONS & SETTINGS ---
        // (Instantiated first so default variables are accessible in Left Pane)
        // ==========================================

        // 1. General Settings Panel (Renamed from Default Specs, unit removed from module)
        var pnlCommon = paneRight.add("panel", undefined, "\u57fa\u672c\u8a2d\u5b9a (General Settings)");
        pnlCommon.orientation = "column";
        pnlCommon.alignChildren = ["fill", "top"];
        pnlCommon.spacing = 6;
        pnlCommon.margins = 6;

        // Row 1: Module & Alpha
        var rowDef1 = pnlCommon.add("group");
        rowDef1.orientation = "row";
        rowDef1.spacing = 8;
        rowDef1.add("statictext", undefined, "\u30e2\u30b8\u30e5\u30fc\u30eb:");
        var etModule = rowDef1.add("edittext", undefined, "2.0"); etModule.characters = 4;
        rowDef1.add("statictext", undefined, " \u5727\u529b\u89d2(deg):");
        var etAlpha = rowDef1.add("edittext", undefined, "20"); etAlpha.characters = 4;

        // Row 2: Backlash & Tip Rounding
        var rowDef2 = pnlCommon.add("group");
        rowDef2.orientation = "row";
        rowDef2.spacing = 8;
        rowDef2.add("statictext", undefined, "\u30d0\u30c3\u30af\u30e9\u30c3\u30b7(mm):");
        var etBacklash = rowDef2.add("edittext", undefined, "0.15"); etBacklash.characters = 4;
        rowDef2.add("statictext", undefined, " \u6b6f\u5148\u4e38\u307f(mm):");
        var etDefTipRounding = rowDef2.add("edittext", undefined, "0.0"); etDefTipRounding.characters = 4;

        // Row 3: Kerf & Shaft Diameter
        var rowDef3 = pnlCommon.add("group");
        rowDef3.orientation = "row";
        rowDef3.spacing = 8;
        rowDef3.add("statictext", undefined, "\u30ab\u30fc\u30d5\u88dc\u6b63(mm):");
        var etKerf = rowDef3.add("edittext", undefined, "0.0"); etKerf.characters = 4;
        rowDef3.add("statictext", undefined, " \u6a19\u6e96\u8ef8\u5f84(mm):");
        var etDefShaft = rowDef3.add("edittext", undefined, "5.0"); etDefShaft.characters = 4;

        // Row 4: Shaft Shape & Thickness Mode
        var rowDef4 = pnlCommon.add("group");
        rowDef4.orientation = "row";
        rowDef4.spacing = 8;
        rowDef4.add("statictext", undefined, "\u8ef8\u7a74\u5f62\u72b6:");
        var ddDefShaftType = rowDef4.add("dropdownlist", undefined, ["\u4e38\u7a74 (Round)", "D\u30ab\u30c3\u30c8 (D-Cut)", "\u30ad\u30fc\u6e4d (Keyway)", "\u306a\u3057 (None)"]);
        ddDefShaftType.selection = 0;
        rowDef4.add("statictext", undefined, " \u539a\u307f:");
        var rbDefThickRoot = rowDef4.add("radiobutton", undefined, "\u6b6f\u5e95");
        var rbDefThickTip = rowDef4.add("radiobutton", undefined, "\u6b6f\u5148");
        rbDefThickRoot.value = true;

        // 2. CAD / CAM Styles & Precision Panel
        var pnlQuality = paneRight.add("panel", undefined, "\u63cf\u753b\u30b9\u30bf\u30a4\u30eb\u30fbCAD/CAM\u4ed5\u69d8 (Styles & Appearances)");
        pnlQuality.orientation = "column";
        pnlQuality.alignChildren = ["fill", "top"];
        pnlQuality.spacing = 6;
        pnlQuality.margins = 6;

        var rowQ1 = pnlQuality.add("group");
        rowQ1.orientation = "row";
        rowQ1.spacing = 8;
        rowQ1.add("statictext", undefined, "\u30b9\u30bf\u30a4\u30eb:");
        var ddStylePreset = rowQ1.add("dropdownlist", undefined, [
            "\u30ec\u30fc\u30b6\u30fc\u52a0\u5de5\u6a19\u6e96 (Laser)",
            "JIS \u6a5f\u68b0\u88fd\u56f3\u6a19\u6e96 (JIS)",
            "CNC\u5207\u524a / 3D\u30d7\u30ea\u30f3\u30c8 (CNC)",
            "\u30ab\u30b9\u30bf\u30e0 (Custom)"
        ]);
        ddStylePreset.selection = 0;
        var btnDetailStyle = rowQ1.add("button", undefined, "\u8a73\u7d30\u8a2d\u5b9a...");

        var rowQ2 = pnlQuality.add("group");
        rowQ2.orientation = "row";
        rowQ2.spacing = 8;
        rowQ2.add("statictext", undefined, "\u66f2\u7dda\u7cbe\u5ea6:");
        var ddQuality = rowQ2.add("dropdownlist", undefined, [
            "\u9ad8\u7cbe\u5ea6\u30d9\u30b8\u30a7 [\u63a8\u5968] (8-10\u70b9/\u6b6f)",
            "\u6700\u5c0f\u30d9\u30b8\u30a7 [\u69cb\u6210B] (6\u70b9/\u6b6f)",
            "\u9ad8\u5bc6\u5ea6\u30dd\u30ea\u30e9\u30a4\u30f3 (~25\u70b9/\u6b6f)"
        ]);
        ddQuality.selection = 0;
        btnDetailStyle.onClick = function () {
            showStyleDetailModal(win, currentStyles, function (updated) {
                currentStyles = updated;
                ddStylePreset.selection = 3;
            });
        };

        ddStylePreset.onChange = function () {
            var idx = ddStylePreset.selection ? ddStylePreset.selection.index : 0;
            if (idx === 0) currentStyles = cloneObj(STYLE_PRESETS.laser);
            else if (idx === 1) currentStyles = cloneObj(STYLE_PRESETS.jis);
            else if (idx === 2) currentStyles = cloneObj(STYLE_PRESETS.cnc);
        };

        // 3. Gear Creation Options Panel
        var pnlCreationOptions = paneRight.add("panel", undefined, "\u6b6f\u8eca\u4f5c\u6210\u30aa\u30d7\u30b7\u30e7\u30f3 (Creation Options)");
        pnlCreationOptions.orientation = "column";
        pnlCreationOptions.alignChildren = ["fill", "top"];
        pnlCreationOptions.spacing = 4;
        pnlCreationOptions.margins = 6;

        var grpOptCols = pnlCreationOptions.add("group");
        grpOptCols.orientation = "row";
        grpOptCols.spacing = 8;
        grpOptCols.alignChildren = ["fill", "top"];

        var colOpt1 = grpOptCols.add("group");
        colOpt1.orientation = "column";
        colOpt1.alignChildren = ["left", "top"];
        colOpt1.spacing = 4;
        var chkCompound = colOpt1.add("checkbox", undefined, "\u8ef8\u7a74\u3068\u6b6f\u3092\u4e00\u4f53\u5316");
        chkCompound.value = true;
        var chkPitchSameLayer = colOpt1.add("checkbox", undefined, "\u30d4\u30c3\u30c1\u5186\u540c\u30ec\u30a4\u30e4");
        chkPitchSameLayer.value = false;
        var chkCenterSameGroup = colOpt1.add("checkbox", undefined, "\u4e2d\u5fc3\u540c\u30b0\u30eb\u30fc\u30d7");
        chkCenterSameGroup.value = true;
        var chkIndividualTeeth = colOpt1.add("checkbox", undefined, "\u6b6f\u3092\u500b\u5225\u30d1\u30b9\u51fa\u529b");
        chkIndividualTeeth.value = false;

        var colOpt2 = grpOptCols.add("group");
        colOpt2.orientation = "column";
        colOpt2.alignChildren = ["left", "top"];
        colOpt2.spacing = 4;
        var chkText = colOpt2.add("checkbox", undefined, "\u4ed5\u69d8\u30e9\u30d9\u30eb\u63cf\u753b");
        chkText.value = true;
        var rbSkelSingleLayer = colOpt2.add("radiobutton", undefined, "JIS\u9aa8\u683c: 1\u30ec\u30a4\u30e4");
        rbSkelSingleLayer.value = true;
        var rbSkelPerStageLayer = colOpt2.add("radiobutton", undefined, "JIS\u9aa8\u683c: \u6bb5\u5225");
        var chkRecordLogThis = colOpt2.add("checkbox", undefined, "\u8a08\u7b97\u30ed\u30b0TXT\u4fdd\u5b58");
        chkRecordLogThis.value = false;

        // Alias variables for backward compatibility
        var chkDefCompound = chkCompound;
        var chkDefPitchSameLayer = chkPitchSameLayer;
        var chkDefCenterSameGroup = chkCenterSameGroup;
        var chkDefDrawLabel = chkText;
        var chkDefIndividualTeeth = chkIndividualTeeth;
        var rbDefSkelSingle = rbSkelSingleLayer;
        var rbDefSkelPerStage = rbSkelPerStageLayer;

        // 4. Layers & Naming Conventions Panel
        var pnlNaming = paneRight.add("panel", undefined, "\u30ec\u30a4\u30e4\u30fc\u30fb\u547d\u540d\u898f\u5247 (Layers & Naming)");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];
        pnlNaming.spacing = 6;
        pnlNaming.margins = 6;

        var rowN1 = pnlNaming.add("group");
        rowN1.orientation = "row";
        rowN1.spacing = 10;
        rowN1.add("statictext", undefined, "\u547d\u540d\u30d7\u30ea\u30bb\u30c3\u30c8:");
        var ddNamingPreset = rowN1.add("dropdownlist", undefined, [
            "\u6a19\u6e96 (Standard: T1, T1_1, T1_dwg, G1_z18)",
            "\u8a2d\u8a08\u8af8\u5143 (Engineering: Train_T1_m2, T1_L1, G1_m2_z18)",
            "\u52a0\u5de5\u7528 (CAM: CUT_T1, T1_L1, REG_T1, G1_z18)",
            "\u30ab\u30b9\u30bf\u30e0 (Custom: \u81ea\u7531\u7de8\u96c6)"
        ]);
        ddNamingPreset.selection = 0;

        var rowN2 = pnlNaming.add("group");
        rowN2.orientation = "row";
        rowN2.spacing = 6;
        rowN2.add("statictext", undefined, "\u8f2a\u5217:");
        var etTemplateMain = rowN2.add("edittext", undefined, "{train}"); etTemplateMain.characters = 7;
        rowN2.add("statictext", undefined, " \u6bb5:");
        var etTemplateSub = rowN2.add("edittext", undefined, "{train}_{layer}"); etTemplateSub.characters = 10;

        var rowN3 = pnlNaming.add("group");
        rowN3.orientation = "row";
        rowN3.spacing = 6;
        rowN3.add("statictext", undefined, "\u56f3\u9762:");
        var etTemplateDwg = rowN3.add("edittext", undefined, "{train}_dwg"); etTemplateDwg.characters = 9;
        rowN3.add("statictext", undefined, " \u30ae\u30a2:");
        var etTemplateGear = rowN3.add("edittext", undefined, "{id}_{kind}_z{z}"); etTemplateGear.characters = 12;

        function applyNamingPreset(idx) {
            if (idx === 0) {
                etTemplateMain.text = "{train}";
                etTemplateSub.text = "{train}_{layer}";
                etTemplateDwg.text = "{train}_dwg";
                etTemplateGear.text = "{id}_{kind}_z{z}";
            } else if (idx === 1) {
                etTemplateMain.text = "Train_{train}_m{m}";
                etTemplateSub.text = "{train}_L{layer}";
                etTemplateDwg.text = "DWG_{train}_Skeleton";
                etTemplateGear.text = "{id}_m{m}_z{z}_d{d}_h{shaft}";
            } else if (idx === 2) {
                etTemplateMain.text = "CUT_{train}";
                etTemplateSub.text = "{train}_L{layer}";
                etTemplateDwg.text = "REG_{train}";
                etTemplateGear.text = "{id}_z{z}";
            }
        }

        ddNamingPreset.onChange = function () {
            if (ddNamingPreset.selection && ddNamingPreset.selection.index < 3) {
                applyNamingPreset(ddNamingPreset.selection.index);
            }
        };

        var onCustomNaming = function () { ddNamingPreset.selection = 3; };
        etTemplateMain.onChanging = onCustomNaming;
        etTemplateSub.onChanging = onCustomNaming;
        etTemplateDwg.onChanging = onCustomNaming;
        etTemplateGear.onChanging = onCustomNaming;

        // 5. Diagnostics & Log Preferences Panel
        var pnlToleranceLog = paneRight.add("panel", undefined, "\u89e3\u6790\u30c8\u30ec\u30e9\u30f3\u30b9\u30fb\u8a3a\u65ad\u30ed\u30b0 (Tolerance & Diagnostics)");
        pnlToleranceLog.orientation = "column";
        pnlToleranceLog.alignChildren = ["fill", "top"];
        pnlToleranceLog.spacing = 6;
        pnlToleranceLog.margins = 6;

        var rowTol1 = pnlToleranceLog.add("group");
        rowTol1.orientation = "row";
        rowTol1.spacing = 8;
        rowTol1.add("statictext", undefined, "\u565b\u5408\u8a31\u5bb9\u8aa4\u5dee(mm):");
        var etTolerance = rowTol1.add("edittext", undefined, "2.5"); etTolerance.characters = 4;
        var chkCrossLayerMesh = rowTol1.add("checkbox", undefined, "\u7570\u30ec\u30a4\u30e4\u30fc\u565b\u5408\u8a31\u5bb9");
        chkCrossLayerMesh.value = false;

        var rowTol2 = pnlToleranceLog.add("group");
        rowTol2.orientation = "row";
        rowTol2.spacing = 8;
        rowTol2.add("statictext", undefined, "\u8ef8\u9593\u6c7a\u5b9a:");
        var ddSnapMode = rowTol2.add("dropdownlist", undefined, [
            "\u5b9f\u5bf8\u4f4d\u7f6e\u56fa\u5b9a & \u8ee2\u4f4dx\u81ea\u52d5\u9006\u7b97 [\u63a8\u5968]",
            "\u6a5f\u69cb\u7406\u8ad6\u8ddd\u96e2\u306b\u30b9\u30ca\u30c3\u30d7",
            "\u5186\u306e\u4f4d\u7f6e\u306b\u72ec\u7acb\u914d\u7f6e (Free)"
        ]);
        ddSnapMode.selection = 0;

        var rowLog1 = pnlToleranceLog.add("group");
        rowLog1.orientation = "row";
        rowLog1.spacing = 6;
        var chkAutoRecordLog = rowLog1.add("checkbox", undefined, "\u81ea\u52d5\u3067TXT\u30ed\u30b0\u4fdd\u5b58\u3092\u6709\u52b9\u5316");
        chkAutoRecordLog.value = false;

        var defaultLogDir = "";
        try {
            if (app.documents && app.documents.length > 0 && app.activeDocument.saved) {
                defaultLogDir = app.activeDocument.path.fsName;
            }
        } catch (eDocPath) {}
        if (!defaultLogDir) {
            try {
                if (typeof Folder !== "undefined" && Folder.desktop) {
                    defaultLogDir = Folder.desktop.fsName;
                }
            } catch (eDesk) {}
        }

        var rowLog2 = pnlToleranceLog.add("group");
        rowLog2.orientation = "row";
        rowLog2.spacing = 6;
        rowLog2.add("statictext", undefined, "\u4fdd\u5b58\u5148:");
        var etLogFolder = rowLog2.add("edittext", undefined, defaultLogDir);
        etLogFolder.preferredSize = [120, 20];

        var btnBrowseFolder = rowLog2.add("button", undefined, "\u53c2\u7167...");
        btnBrowseFolder.onClick = function () {
            try {
                var selFile = File.openDialog(
                    "\u30ed\u30b0\u4fdd\u5b58\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044",
                    "すべてのファイル:*.*"
                );
                if (selFile) {
                    var targetDir = selFile.parent ? selFile.parent.fsName : selFile.fsName;
                    etLogFolder.text = targetDir;
                }
            } catch (eSel) {}
        };

        var btnOpenFolder = rowLog2.add("button", undefined, "\u958b\u304f");
        btnOpenFolder.onClick = function () {
            try {
                var f = new Folder(etLogFolder.text || "~");
                if (!f.exists) f.create();
                f.execute();
            } catch (eExp) {}
        };

        // 6. Settings Profile I/O Panel (JSON Import / Export & Reset)
        var pnlProfileIO = paneRight.add("panel", undefined, "\u8a2d\u5b9a\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u5165\u51fa\u529b (Profile Import / Export)");
        pnlProfileIO.orientation = "row";
        pnlProfileIO.alignChildren = ["left", "center"];
        pnlProfileIO.spacing = 10;
        pnlProfileIO.margins = 8;

        var btnExportSettings = pnlProfileIO.add("button", undefined, "\u8a2d\u5b9a\u4fdd\u5b58...");
        var btnImportSettings = pnlProfileIO.add("button", undefined, "\u8a2d\u5b9a\u8aad\u8fbc...");
        var btnResetFactory = pnlProfileIO.add("button", undefined, "\u8a2d\u5b9a\u521d\u671f\u5316");

        function getCurrentPreferencesObject() {
            return {
                version: "1.0.0",
                timestamp: String(new Date()),
                defaultSpecs: {
                    m: parseFloat(etModule.text) || 2.0,
                    alphaDeg: parseFloat(etAlpha.text) || 20.0,
                    backlash: parseFloat(etBacklash.text) || 0.15,
                    kerf: parseFloat(etKerf.text) || 0.0,
                    shaftDiameter: parseFloat(etDefShaft.text) || 5.0,
                    shaftTypeIndex: ddDefShaftType.selection ? ddDefShaftType.selection.index : 0,
                    thicknessMode: rbDefThickTip.value ? "tip" : "root"
                },
                styles: currentStyles,
                creationOptions: {
                    compound: chkDefCompound.value,
                    pitchSameLayer: chkDefPitchSameLayer.value,
                    centerSameGroup: chkDefCenterSameGroup.value,
                    drawLabel: chkDefDrawLabel.value,
                    individualTeeth: chkDefIndividualTeeth.value,
                    skelMode: rbDefSkelPerStage.value ? "per_stage" : "single"
                },
                options: {
                    pathQualityIndex: ddQuality.selection ? ddQuality.selection.index : 0,
                    stylePresetIndex: ddStylePreset.selection ? ddStylePreset.selection.index : 0
                },
                naming: {
                    presetIndex: ddNamingPreset.selection ? ddNamingPreset.selection.index : 0,
                    mainLayer: etTemplateMain.text,
                    subLayer: etTemplateSub.text,
                    dwgLayer: etTemplateDwg.text,
                    gearGroup: etTemplateGear.text
                },
                analysisAndLog: {
                    toleranceMm: parseFloat(etTolerance.text) || 2.5,
                    snapModeIndex: ddSnapMode.selection ? ddSnapMode.selection.index : 0,
                    allowCrossLayerMeshing: chkCrossLayerMesh.value,
                    autoRecordLog: chkAutoRecordLog.value,
                    logFolder: etLogFolder.text
                }
            };
        }

        function applyPreferencesObject(profile) {
            if (!profile || typeof profile !== "object") return;
            if (profile.defaultSpecs) {
                if (profile.defaultSpecs.m !== undefined) etModule.text = String(profile.defaultSpecs.m);
                if (profile.defaultSpecs.alphaDeg !== undefined) etAlpha.text = String(profile.defaultSpecs.alphaDeg);
                if (profile.defaultSpecs.backlash !== undefined) etBacklash.text = String(profile.defaultSpecs.backlash);
                if (profile.defaultSpecs.kerf !== undefined) etKerf.text = String(profile.defaultSpecs.kerf);
                if (profile.defaultSpecs.shaftDiameter !== undefined) etDefShaft.text = String(profile.defaultSpecs.shaftDiameter);
                if (profile.defaultSpecs.shaftTypeIndex !== undefined && ddDefShaftType.items[profile.defaultSpecs.shaftTypeIndex]) {
                    ddDefShaftType.selection = profile.defaultSpecs.shaftTypeIndex;
                }
                if (profile.defaultSpecs.thicknessMode === "tip") rbDefThickTip.value = true;
                else rbDefThickRoot.value = true;
            }
            if (profile.styles) {
                currentStyles = cloneObj(profile.styles);
                ddStylePreset.selection = 3;
            }
            if (profile.creationOptions) {
                if (profile.creationOptions.compound !== undefined) chkDefCompound.value = !!profile.creationOptions.compound;
                if (profile.creationOptions.pitchSameLayer !== undefined) chkDefPitchSameLayer.value = !!profile.creationOptions.pitchSameLayer;
                if (profile.creationOptions.centerSameGroup !== undefined) chkDefCenterSameGroup.value = !!profile.creationOptions.centerSameGroup;
                if (profile.creationOptions.drawLabel !== undefined) chkDefDrawLabel.value = !!profile.creationOptions.drawLabel;
                if (profile.creationOptions.individualTeeth !== undefined) chkDefIndividualTeeth.value = !!profile.creationOptions.individualTeeth;
                if (profile.creationOptions.skelMode === "per_stage") rbDefSkelPerStage.value = true;
                else rbDefSkelSingle.value = true;

                if (typeof chkCompound !== "undefined" && chkCompound) chkCompound.value = chkDefCompound.value;
                if (typeof chkPitchSameLayer !== "undefined" && chkPitchSameLayer) chkPitchSameLayer.value = chkDefPitchSameLayer.value;
                if (typeof chkCenterSameGroup !== "undefined" && chkCenterSameGroup) chkCenterSameGroup.value = chkDefCenterSameGroup.value;
                if (typeof chkText !== "undefined" && chkText) chkText.value = chkDefDrawLabel.value;
                if (typeof chkIndividualTeeth !== "undefined" && chkIndividualTeeth) chkIndividualTeeth.value = chkDefIndividualTeeth.value;
                if (typeof rbSkelPerStageLayer !== "undefined" && rbSkelPerStageLayer) rbSkelPerStageLayer.value = rbDefSkelPerStage.value;
                if (typeof rbSkelSingleLayer !== "undefined" && rbSkelSingleLayer) rbSkelSingleLayer.value = rbDefSkelSingle.value;
            }
            if (profile.options) {
                if (profile.options.pathQualityIndex !== undefined && ddQuality.items[profile.options.pathQualityIndex]) {
                    ddQuality.selection = profile.options.pathQualityIndex;
                }
                if (profile.options.stylePresetIndex !== undefined && ddStylePreset.items[profile.options.stylePresetIndex]) {
                    ddStylePreset.selection = profile.options.stylePresetIndex;
                }
            }
            if (profile.naming) {
                if (profile.naming.presetIndex !== undefined && ddNamingPreset.items[profile.naming.presetIndex]) {
                    ddNamingPreset.selection = profile.naming.presetIndex;
                }
                if (profile.naming.mainLayer !== undefined) etTemplateMain.text = profile.naming.mainLayer;
                if (profile.naming.subLayer !== undefined) etTemplateSub.text = profile.naming.subLayer;
                if (profile.naming.dwgLayer !== undefined) etTemplateDwg.text = profile.naming.dwgLayer;
                if (profile.naming.gearGroup !== undefined) etTemplateGear.text = profile.naming.gearGroup;
            }
            if (profile.analysisAndLog) {
                if (profile.analysisAndLog.toleranceMm !== undefined) etTolerance.text = String(profile.analysisAndLog.toleranceMm);
                if (profile.analysisAndLog.snapModeIndex !== undefined && ddSnapMode.items[profile.analysisAndLog.snapModeIndex]) {
                    ddSnapMode.selection = profile.analysisAndLog.snapModeIndex;
                }
                if (profile.analysisAndLog.allowCrossLayerMeshing !== undefined) chkCrossLayerMesh.value = !!profile.analysisAndLog.allowCrossLayerMeshing;
                if (profile.analysisAndLog.autoRecordLog !== undefined) chkAutoRecordLog.value = !!profile.analysisAndLog.autoRecordLog;
                if (profile.analysisAndLog.logFolder !== undefined) etLogFolder.text = profile.analysisAndLog.logFolder;
            }
        }

        btnExportSettings.onClick = function () {
            exportSettingsProfile(getCurrentPreferencesObject());
        };

        btnImportSettings.onClick = function () {
            importSettingsProfile(function (profile) {
                applyPreferencesObject(profile);
                try {
                    saveLocalSettings(getCurrentPreferencesObject());
                } catch (eAutoSave) {}
                updatePreview();
            });
        };

        btnResetFactory.onClick = function () {
            etModule.text = "2.0";
            etAlpha.text = "20";
            etBacklash.text = "0.15";
            etKerf.text = "0.0";
            etDefShaft.text = "5.0";
            ddDefShaftType.selection = 0;
            rbDefThickRoot.value = true;
            currentStyles = cloneObj(STYLE_PRESETS.laser);
            ddStylePreset.selection = 0;
            ddQuality.selection = 0;
            chkDefCompound.value = true;
            chkDefPitchSameLayer.value = false;
            chkDefCenterSameGroup.value = true;
            chkDefDrawLabel.value = true;
            chkDefIndividualTeeth.value = false;
            rbDefSkelSingle.value = true;
            ddNamingPreset.selection = 0;
            applyNamingPreset(0);
            etTolerance.text = "2.5";
            ddSnapMode.selection = 0;
            chkCrossLayerMesh.value = false;
            chkAutoRecordLog.value = false;
            saveLocalSettings(getCurrentPreferencesObject());
            updatePreview();
            alert("\u8a2d\u5b9a\u3092\u521d\u671f\u5316\u3057\u3001\u30ed\u30fc\u30ab\u30eb\u8a2d\u5b9a\u3082\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002");
        };

        // ==========================================
        // --- TAB 1: GEAR CREATION ---
        // ==========================================

// 2. Circle Object Topology Panel (Placed SECOND as requested)
        var pnlCircle = paneLeft.add("panel", undefined, "\u5186\u30aa\u30d6\u30b8\u30a8\u30af\u30c8\u9023\u643a (Object-Driven Input)");
        pnlCircle.orientation = "column";
        pnlCircle.alignChildren = ["fill", "top"];
        pnlCircle.spacing = 4;
        pnlCircle.margins = 6;

        // Row 1: Checkbox, Rescan & Status
        var rowCircle1 = pnlCircle.add("group");
        rowCircle1.orientation = "row";
        rowCircle1.alignChildren = ["left", "center"];
        rowCircle1.spacing = 8;
        var chkUseCircle = rowCircle1.add("checkbox", undefined, "\u5186\u304b\u3089\u6b6f\u8eca\u4f5c\u6210");
        chkUseCircle.value = (selectedCircles.length > 0);
        chkUseCircle.enabled = (selectedCircles.length > 0);
        var btnRescan = rowCircle1.add("button", undefined, "\u5186\u3092\u518d\u30b9\u30ad\u30e3\u30f3");
        var lblCircleStatus = rowCircle1.add("statictext", undefined, "");
        lblCircleStatus.characters = 18;

        // Row 2: Source & Interpretation
        var rowCircle2 = pnlCircle.add("group");
        rowCircle2.orientation = "row";
        rowCircle2.alignChildren = ["left", "center"];
        rowCircle2.spacing = 8;
        rowCircle2.enabled = (selectedCircles.length > 0);
        rowCircle2.add("statictext", undefined, "\u691c\u51fa\u5143:");
        var rbSourceSelection = rowCircle2.add("radiobutton", undefined, "\u9078\u629e");
        var rbSourceAllLayers = rowCircle2.add("radiobutton", undefined, "\u5168\u5c64");
        rbSourceSelection.value = true;
        rowCircle2.add("statictext", undefined, " \u76f4\u5f84:");
        var rbCirclePitch = rowCircle2.add("radiobutton", undefined, "\u30d4\u30c3\u30c1\u5186");
        var rbCircleTip = rowCircle2.add("radiobutton", undefined, "\u6b6f\u5148\u5186");
        rbCirclePitch.value = true;

        // Row 3: Fate & Positioning
        var rowCircle3 = pnlCircle.add("group");
        rowCircle3.orientation = "row";
        rowCircle3.alignChildren = ["left", "center"];
        rowCircle3.spacing = 8;
        rowCircle3.enabled = (selectedCircles.length > 0);
        rowCircle3.add("statictext", undefined, "\u5143\u5186\u51e6\u7406:");
        var ddCircleFate = rowCircle3.add("dropdownlist", undefined, [
            "\u30ac\u30a4\u30c9\u7dda\u5316",
            "\u524a\u9664\u7f6e\u63db",
            "\u4fdd\u6301"
        ]);
        ddCircleFate.selection = 0;
        rowCircle3.add("statictext", undefined, " \u914d\u7f6e:");
        var rbCircleOrigPos = rowCircle3.add("radiobutton", undefined, "\u5143\u4f4d\u7f6e");
        var rbCircleCustomPos = rowCircle3.add("radiobutton", undefined, "\u6307\u5b9a\u4f4d\u7f6e");
        rbCircleOrigPos.value = false;
        rbCircleCustomPos.value = true;

        // Row 4: Multi-Circle Build Button
        var grpMultiCircle = pnlCircle.add("group");
        grpMultiCircle.orientation = "row";
        grpMultiCircle.alignChildren = ["left", "center"];
        grpMultiCircle.spacing = 8;
        grpMultiCircle.enabled = (selectedCircles.length > 1);
        var btnAutoBuildTrain = grpMultiCircle.add("button", undefined, "\u5186\u304b\u3089\u8f2a\u5217\u30c4\u30ea\u30fc\u3092\u81ea\u52d5\u69cb\u7bc9");
        btnAutoBuildTrain.enabled = (selectedCircles.length > 1);

        // 3. Mechanism Configuration Panel
        var pnlConfig = paneLeft.add("panel", undefined, "輪列構成・諸元 (Gear Train Configuration)");
        pnlConfig.orientation = "column";
        pnlConfig.alignChildren = ["fill", "top"];
        pnlConfig.spacing = 8;
        pnlConfig.margins = 10;
        // pnlConfig preferredSize auto

        // Subpanel A: Branched Gear Train
        var pnlTrain = pnlConfig.add("group");
        pnlTrain.orientation = "column";
        pnlTrain.alignChildren = ["fill", "top"];
        pnlTrain.spacing = 4;

        // Top Row: Train ID moved here from settings tab
        var rowTrainTop = pnlTrain.add("group");
        rowTrainTop.orientation = "row";
        rowTrainTop.alignChildren = ["left", "center"];
        rowTrainTop.spacing = 10;
        rowTrainTop.add("statictext", undefined, "\u8f2a\u5217ID:");
        var etTrainId = rowTrainTop.add("edittext", undefined, initialTrainId);
        etTrainId.characters = 6;
        var btnAutoTrainId = rowTrainTop.add("button", undefined, "\u7a7a\u304dID\u81ea\u52d5\u63a1\u756a");
        btnAutoTrainId.onClick = function () {
            var doc = null;
            try { if (app.documents.length > 0) doc = app.activeDocument; } catch (e) {}
            etTrainId.text = getSuggestedTrainId(doc);
        };
        rowTrainTop.add("statictext", undefined, "(\u65e2\u5b58\u30ec\u30a4\u30e4\u30fc\u3068\u91cd\u8907\u3057\u306a\u3044ID\u3092\u6307\u5b9a)");

        // Expanded 10-Row Train Table
        var trainListBox = pnlTrain.add("listbox", undefined, [], {
            numberOfColumns: 13,
            showHeaders: true,
            columnTitles: [
                "ID",
                "\u7a2e\u5225",
                "\u6bb5",
                "\u89aa",
                "\u63a5\u7d9a",
                "\u6b6f\u6570",
                "\u6e1b\u901f\u6bd4",
                "\u5916\u5f84/\u30ea\u30e0",
                "m",
                "\u03b1",
                "\u8ef8\u7a74",
                "\u89d2\u5ea6",
                "\u72b6\u614b"
            ],
            columnWidths: [35, 38, 24, 35, 35, 52, 45, 70, 28, 24, 55, 45, 45]
        });
        trainListBox.preferredSize = [430, 180];

        // Node Detail Editor Area (Parent first, then teeth)
        var pnlNodeDetail = pnlTrain.add("panel", undefined, "\u9078\u629e\u30ae\u30a2\u306e\u500b\u5225\u8a2d\u5b9a (Selected Gear Settings)");
        pnlNodeDetail.orientation = "column";
        pnlNodeDetail.alignChildren = ["fill", "top"];
        pnlNodeDetail.spacing = 4;
        pnlNodeDetail.margins = 6;

        // Row 1: ID Editor with Enter protection and validation
        // Row 1: ID & Kind
        var rowNode1 = pnlNodeDetail.add("group");
        rowNode1.orientation = "row";
        rowNode1.alignChildren = ["left", "center"];
        rowNode1.spacing = 6;
        rowNode1.add("statictext", undefined, "\u30ae\u30a2ID:");
        var etNodeId = rowNode1.add("edittext", undefined, "G1"); etNodeId.characters = 5;
        var btnChangeId = rowNode1.add("button", undefined, "ID\u5909\u66f4");
        var lblIdStatus = rowNode1.add("statictext", undefined, ""); lblIdStatus.characters = 6;
        rowNode1.add("statictext", undefined, " \u7a2e\u5225:");
        var ddNodeKind = rowNode1.add("dropdownlist", undefined, ["\u5916\u6b6f\u8eca (Spur)", "\u5185\u6b6f\u8eca (Internal)", "\u30e9\u30c3\u30af (Rack)"]);
        ddNodeKind.selection = 0;

        // Row 2: Parent, Relation & Teeth
        var rowNode2 = pnlNodeDetail.add("group");
        rowNode2.orientation = "row";
        rowNode2.alignChildren = ["left", "center"];
        rowNode2.spacing = 6;
        rowNode2.add("statictext", undefined, "\u63a5\u7d9a\u89aa:");
        var ddNodeParent = rowNode2.add("dropdownlist", undefined, ["(\u306a\u3057 / \u30eb\u30fc\u30c8)"]);
        ddNodeParent.selection = 0;
        rowNode2.add("statictext", undefined, " \u63a5\u7d9a:");
        var ddNodeRelation = rowNode2.add("dropdownlist", undefined, ["\u565b\u5408 (Mesh)", "\u540c\u8ef8 (Coaxial)"]);
        ddNodeRelation.selection = 0;
        var lblNodeZ = rowNode2.add("statictext", undefined, " \u6b6f\u6570:");
        var etNodeZ = rowNode2.add("edittext", undefined, "18"); etNodeZ.characters = 4;

        // Row 3: Angle, Shaft Diameter & Shape
        var rowNode3 = pnlNodeDetail.add("group");
        rowNode3.orientation = "row";
        rowNode3.alignChildren = ["left", "center"];
        rowNode3.spacing = 6;
        var lblNodeAngle = rowNode3.add("statictext", undefined, "\u914d\u7f6e\u89d2(deg):");
        lblNodeAngle.helpTip = "\u89aa\u30ae\u30a2\u306e\u4e2d\u5fc3\u304b\u3089\u898b\u3066X\u8ef8\u6b63\u65b9\u5411(\u53f3\u5411\u304d0\u5ea6)\u304b\u3089\u4f55\u5ea6\u306e\u4f4d\u7f6e\u3067\u30d4\u30c3\u30c1\u5186\u304c\u63a5\u3059\u308b\u304b\u3092\u6307\u5b9a";
        var etNodeAngle = rowNode3.add("edittext", undefined, "0"); etNodeAngle.characters = 4;
        rowNode3.add("statictext", undefined, " \u8ef8\u5f84:");
        var etNodeShaft = rowNode3.add("edittext", undefined, "5.0"); etNodeShaft.characters = 4;
        rowNode3.add("statictext", undefined, "mm");
        rowNode3.add("statictext", undefined, " \u5f62\u72b6:");
        var ddNodeShaftType = rowNode3.add("dropdownlist", undefined, ["\u4e38\u7a74", "D\u30ab\u30c3\u30c8", "\u30ad\u30fc\u6e4d", "\u306a\u3057"]);
        ddNodeShaftType.selection = 0;

        // Row 3b: Back / Rim Height & Profile Shift
        var rowNode3b = pnlNodeDetail.add("group");
        rowNode3b.orientation = "row";
        rowNode3b.alignChildren = ["left", "center"];
        rowNode3b.spacing = 6;
        var lblNodeBackHeight = rowNode3b.add("statictext", undefined, "\u80cc\u9762/\u539a\u307f:");
        var etNodeBackHeight = rowNode3b.add("edittext", undefined, "6.0"); etNodeBackHeight.characters = 4;
        rowNode3b.add("statictext", undefined, "mm");
        rowNode3b.add("statictext", undefined, "  \u8ee2\u4f4dx:");
        var etNodeShift = rowNode3b.add("edittext", undefined, "0.0"); etNodeShift.characters = 4;

        // Row 4: Stage, Module & Alpha
        var rowNode4 = pnlNodeDetail.add("group");
        rowNode4.orientation = "row";
        rowNode4.alignChildren = ["left", "center"];
        rowNode4.spacing = 6;
        rowNode4.add("statictext", undefined, "\u6bb5\u756a\u53f7:");
        var etNodeStage = rowNode4.add("edittext", undefined, "1"); etNodeStage.characters = 3;
        rowNode4.add("statictext", undefined, " \u30e2\u30b8\u30e5\u30fc\u30eb:");
        var etNodeModule = rowNode4.add("edittext", undefined, "2.0"); etNodeModule.characters = 4;
        rowNode4.add("statictext", undefined, " \u5727\u529b\u89d2:");
        var etNodeAlpha = rowNode4.add("edittext", undefined, "20"); etNodeAlpha.characters = 4;

        // Row 4b: Backlash & Tip Rounding
        var rowNode4b = pnlNodeDetail.add("group");
        rowNode4b.orientation = "row";
        rowNode4b.alignChildren = ["left", "center"];
        rowNode4b.spacing = 6;
        rowNode4b.add("statictext", undefined, "\u30d0\u30c3\u30af\u30e9\u30c3\u30b7(mm):");
        var etNodeBacklash = rowNode4b.add("edittext", undefined, "0.15"); etNodeBacklash.characters = 4;
        rowNode4b.add("statictext", undefined, " \u6b6f\u5148\u4e38\u307f(mm):");
        var etNodeTipRounding = rowNode4b.add("edittext", undefined, "0.0"); etNodeTipRounding.characters = 4;

        // Row 5: Mutilated / Intermittent Gear Settings
        var rowNode5 = pnlNodeDetail.add("group");
        rowNode5.orientation = "row";
        rowNode5.alignChildren = ["left", "center"];
        rowNode5.spacing = 6;

        rowNode5.add("statictext", undefined, "\u52d5\u4f5c\u30e2\u30fc\u30c9:");
        var ddIntermittentMode = rowNode5.add("dropdownlist", undefined, [
            "\u901a\u5e38 (Normal)",
            "\u6b20\u6b6f\u306e\u307f (Mutilated)",
            "\u9593\u6b20\u30fb\u539f\u52d5 (Driver)",
            "\u9593\u6b20\u30fb\u5f93\u52d5 (Driven)"
        ]);
        ddIntermittentMode.selection = 0;

        // Subgroup for Driver / Mutilated parameters
        var grpMutDriver = rowNode5.add("group");
        grpMutDriver.orientation = "row";
        grpMutDriver.alignChildren = ["left", "center"];
        grpMutDriver.spacing = 4;
        grpMutDriver.visible = false;
        grpMutDriver.add("statictext", undefined, " \u6709\u52b9\u6b6f:");
        var etActiveTeeth = grpMutDriver.add("edittext", undefined, "2"); etActiveTeeth.characters = 3;
        grpMutDriver.add("statictext", undefined, " \u958b\u59cb\u6b6f:");
        var etStartTooth = grpMutDriver.add("edittext", undefined, "1"); etStartTooth.characters = 3;
        var chkTipRelief = grpMutDriver.add("checkbox", undefined, "\u6b6f\u5148\u7de9\u548c(Tip Relief)"); chkTipRelief.value = false;

        // Subgroup for Driven parameters
        var grpMutDriven = rowNode5.add("group");
        grpMutDriven.orientation = "row";
        grpMutDriven.alignChildren = ["left", "center"];
        grpMutDriven.spacing = 4;
        grpMutDriven.visible = false;
        grpMutDriven.add("statictext", undefined, " \u5206\u5272\u6570(n):");
        var etDivisions = grpMutDriven.add("edittext", undefined, "4"); etDivisions.characters = 3;
        grpMutDriven.add("statictext", undefined, " \u9001\u308a\u6b6f:");
        var etMoveTeeth = grpMutDriven.add("edittext", undefined, "2"); etMoveTeeth.characters = 3;
        grpMutDriven.add("statictext", undefined, " \u9699\u9593(mm):");
        var etLockClearance = grpMutDriven.add("edittext", undefined, "0.15"); etLockClearance.characters = 4;

        // Row 5b: Intermittent Structure (Coplanar vs Two-Layer) & Warning
        var rowNode5b = pnlNodeDetail.add("group");
        rowNode5b.orientation = "row";
        rowNode5b.alignChildren = ["left", "center"];
        rowNode5b.spacing = 8;
        rowNode5b.visible = false;

        rowNode5b.add("statictext", undefined, "\u69cb\u9020\u5f62\u5f0f:");
        var rbStructCoplanar = rowNode5b.add("radiobutton", undefined, "\u540c\u4e00\u5e73\u9762 (1\u679a\u677f)");
        var rbStructTwoLayer = rowNode5b.add("radiobutton", undefined, "2\u5c64\u5f0f (\u7a4d\u5c64\u30d7\u30ec\u30fc\u30c8)");
        rbStructCoplanar.value = true;

        var lblTwoLayerWarning = rowNode5b.add("statictext", undefined, "\u203b2\u5c64\u5f0f\u306f\u4ed6\u6bb5\u30ae\u30a2\u3068\u306e\u7acb\u4f53\u5e72\u6e09\u3092\u30d7\u30e9\u30b0\u30a4\u30f3\u5074\u3067\u4fdd\u8a3c\u3057\u307e\u305b\u3093");
        lblTwoLayerWarning.visible = false;
        try {
            var redGfx = lblTwoLayerWarning.graphics;
            redGfx.foregroundColor = redGfx.newPen(redGfx.PenType.SOLID_COLOR, [0.85, 0.0, 0.0, 1], 1);
        } catch (eGfx) {}

        // Action Buttons: Row 1 (Basic Gear Elements)
        // Action Buttons: Row 1 (Basic Gear Elements - 4 buttons)
        var rowNodeBtns1 = pnlNodeDetail.add("group");
        rowNodeBtns1.orientation = "row";
        rowNodeBtns1.alignChildren = ["left", "center"];
        rowNodeBtns1.spacing = 6;
        var btnAddSpur = rowNodeBtns1.add("button", undefined, "+ \u5916\u6b6f\u8eca");
        var btnAddCoaxial = rowNodeBtns1.add("button", undefined, "+ \u540c\u8ef8\u30ae\u30a2");
        var btnAddInternal = rowNodeBtns1.add("button", undefined, "+ \u5185\u6b6f\u8eca");
        var btnAddRack = rowNodeBtns1.add("button", undefined, "+ \u30e9\u30c3\u30af");

        // Action Buttons: Row 2 (Complex Mechanisms - 3 buttons)
        var rowNodeBtns2 = pnlNodeDetail.add("group");
        rowNodeBtns2.orientation = "row";
        rowNodeBtns2.alignChildren = ["left", "center"];
        rowNodeBtns2.spacing = 6;
        var btnAddIntermittent = rowNodeBtns2.add("button", undefined, "+ \u9593\u6b20\u30da\u30a2\u8ffd\u52a0");
        var btnAddPlanetary = rowNodeBtns2.add("button", undefined, "+ \u904a\u661f\u6a5f\u69cb\u8ffd\u52a0");
        var btnAddParadox = rowNodeBtns2.add("button", undefined, "+ \u4e0d\u601d\u8b70\u904a\u661f\u8ffd\u52a0");

        // Action Buttons: Row 3 (Delete & CSV - 2 buttons)
        var rowNodeBtns3 = pnlNodeDetail.add("group");
        rowNodeBtns3.orientation = "row";
        rowNodeBtns3.alignChildren = ["left", "center"];
        rowNodeBtns3.spacing = 6;
        var btnDeleteNode = rowNodeBtns3.add("button", undefined, "- \u9078\u629e\u30ae\u30a2\u524a\u9664");
        var btnImportCSV = rowNodeBtns3.add("button", undefined, "CSV/TSV\u8aad\u8fbc...");

// (pnlCreationOptions moved to paneRight)

        // 5. Placement & Origin Panel (Renamed G1 to Root Gear Center)
        var pnlPlacement = paneLeft.add("panel", undefined, "\u4f5c\u6210\u4f4d\u7f6e (Placement & Origin)");
        pnlPlacement.orientation = "column";
        pnlPlacement.alignChildren = ["fill", "top"];
        pnlPlacement.spacing = 4;
        pnlPlacement.margins = 6;

        var rowPlace1 = pnlPlacement.add("group");
        rowPlace1.orientation = "row";
        rowPlace1.alignChildren = ["left", "center"];
        rowPlace1.spacing = 6;
        rowPlace1.add("statictext", undefined, "\u57fa\u6e96\u70b9:");
        var ddPlacementRef = rowPlace1.add("dropdownlist", undefined, [
            "\u7b2c1\u30ae\u30a2(\u30eb\u30fc\u30c8)\u306e\u57fa\u6e96\u5186\u4e2d\u5fc3",
            "\u8f2a\u5217\u5168\u4f53\u306e\u4e2d\u5fc3 (Train BBox Center)",
            "\u30a2\u30fc\u30c8\u30dc\u30fc\u30c9\u4e2d\u592e (Artboard Center)",
            "\u9078\u629e\u30aa\u30d6\u30b8\u30a8\u30af\u30c8\u4f4d\u7f6e (Selection Center)"
        ]);
        ddPlacementRef.selection = 0;
        var btnUpdatePlacementCoords = rowPlace1.add("button", undefined, "\u5ea7\u6a19\u66f4\u65b0");

        var rowPlace2 = pnlPlacement.add("group");
        rowPlace2.orientation = "row";
        rowPlace2.alignChildren = ["left", "center"];
        rowPlace2.spacing = 6;
        rowPlace2.add("statictext", undefined, "X:");
        var etTargetX = rowPlace2.add("edittext", undefined, "0.0"); etTargetX.characters = 6;
        rowPlace2.add("statictext", undefined, "mm");
        rowPlace2.add("statictext", undefined, "  Y:");
        var etTargetY = rowPlace2.add("edittext", undefined, "0.0"); etTargetY.characters = 6;
        rowPlace2.add("statictext", undefined, "mm");

        function updatePlacementRefLabel() {
            var rootNode = (trainNodes && trainNodes.length > 0) ? trainNodes[0] : null;
            if (trainNodes) {
                for (var i = 0; i < trainNodes.length; i++) {
                    if (!trainNodes[i].parentId || trainNodes[i].relationType === "ROOT") {
                        rootNode = trainNodes[i];
                        break;
                    }
                }
            }
            var rootId = rootNode ? rootNode.id : "G1";
            if (ddPlacementRef && ddPlacementRef.items && ddPlacementRef.items.length > 0) {
                ddPlacementRef.items[0].text = "ルートギア (" + rootId + ") の中心";
            }
        }

        function parseTrainCSV(text) {
            if (!text || typeof text !== "string") return { success: false, error: "Empty or invalid text" };

            var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
            var validLines = [];
            for (var l = 0; l < lines.length; l++) {
                var trimmed = lines[l].replace(/^\s+|\s+$/g, "");
                if (trimmed.length > 0 && trimmed.charAt(0) !== "#") {
                    validLines.push(trimmed);
                }
            }
            if (validLines.length === 0) return { success: false, error: "No data rows found" };

            var firstLine = validLines[0];
            var delimiter = (firstLine.indexOf("\t") !== -1) ? "\t" : ",";

            function splitLine(line) {
                var tokens = line.split(delimiter);
                for (var t = 0; t < tokens.length; t++) {
                    tokens[t] = tokens[t].replace(/^\s+|\s+$/g, "").replace(/^["']|["']$/g, "");
                }
                return tokens;
            }

            var headerTokens = splitLine(firstLine);
            var hasHeader = false;
            var colMap = { id: -1, parent: -1, z: -1, m: -1, alpha: -1, angle: -1, type: -1, shaftType: -1, shaftDia: -1, stage: -1, x: -1 };

            for (var h = 0; h < headerTokens.length; h++) {
                var key = headerTokens[h].toLowerCase();
                if (key === "id" || key === "gearid" || key === "ギアid") { colMap.id = h; hasHeader = true; }
                else if (key === "parent" || key === "parentid" || key === "親" || key === "親id") { colMap.parent = h; hasHeader = true; }
                else if (key === "z" || key === "teeth" || key === "歯数") { colMap.z = h; hasHeader = true; }
                else if (key === "m" || key === "module" || key === "モジュール") { colMap.m = h; hasHeader = true; }
                else if (key === "alpha" || key === "alphadeg" || key === "圧力角") { colMap.alpha = h; hasHeader = true; }
                else if (key === "angle" || key === "angledeg" || key === "relativeangle" || key === "配置角度") { colMap.angle = h; hasHeader = true; }
                else if (key === "type" || key === "geartype" || key === "種別") { colMap.type = h; hasHeader = true; }
                else if (key === "shafttype" || key === "軸穴形状") { colMap.shaftType = h; hasHeader = true; }
                else if (key === "shaftdia" || key === "shaftdiameter" || key === "shaft" || key === "軸穴径") { colMap.shaftDia = h; hasHeader = true; }
                else if (key === "stage" || key === "stageindex" || key === "段" || key === "段番号") { colMap.stage = h; hasHeader = true; }
                else if (key === "x" || key === "shift" || key === "転位係数") { colMap.x = h; hasHeader = true; }
            }

            var startRow = hasHeader ? 1 : 0;
            if (!hasHeader) {
                colMap = { id: 0, parent: 1, z: 2, angle: 3, m: 4, alpha: 5, shaftType: 6, shaftDia: 7, stage: 8, type: 9 };
            }

            var importedNodes = [];
            var usedIds = {};

            for (var r = startRow; r < validLines.length; r++) {
                var row = splitLine(validLines[r]);
                if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

                var rawId = (colMap.id !== -1 && row[colMap.id]) ? row[colMap.id] : ("G" + (importedNodes.length + 1));
                var cleanId = sanitizeId(rawId);
                if (!cleanId) cleanId = "G" + (importedNodes.length + 1);

                if (usedIds[cleanId]) {
                    var counter = 2;
                    while (usedIds[cleanId + "_" + counter]) counter++;
                    cleanId = cleanId + "_" + counter;
                }
                usedIds[cleanId] = true;

                var rawParent = (colMap.parent !== -1 && row[colMap.parent]) ? row[colMap.parent] : "";
                var parentId = (rawParent && rawParent !== "-" && rawParent !== "none" && rawParent !== "null") ? sanitizeId(rawParent) : null;

                var zVal = (colMap.z !== -1 && row[colMap.z]) ? (parseInt(row[colMap.z], 10) || 18) : 18;
                var mVal = (colMap.m !== -1 && row[colMap.m]) ? (parseFloat(row[colMap.m]) || 2.0) : 2.0;
                var aVal = (colMap.alpha !== -1 && row[colMap.alpha]) ? (parseFloat(row[colMap.alpha]) || 20.0) : 20.0;
                var angVal = (colMap.angle !== -1 && row[colMap.angle]) ? (parseFloat(row[colMap.angle]) || 0.0) : 0.0;
                var stageVal = (colMap.stage !== -1 && row[colMap.stage]) ? (parseInt(row[colMap.stage], 10) || 1) : 1;
                var xVal = (colMap.x !== -1 && row[colMap.x]) ? (parseFloat(row[colMap.x]) || 0.0) : 0.0;

                var rawType = (colMap.type !== -1 && row[colMap.type]) ? row[colMap.type].toUpperCase() : "SPUR";
                var gearType = "SPUR";
                if (rawType.indexOf("INT") !== -1 || rawType.indexOf("内歯") !== -1) gearType = "INTERNAL";
                else if (rawType.indexOf("RACK") !== -1 || rawType.indexOf("ラック") !== -1) gearType = "RACK";

                var rawShaftType = (colMap.shaftType !== -1 && row[colMap.shaftType]) ? row[colMap.shaftType] : "丸穴";
                var shaftType = "丸穴";
                var sLower = rawShaftType.toLowerCase();
                if (sLower.indexOf("d") !== -1) shaftType = "Dカット";
                else if (sLower.indexOf("key") !== -1 || sLower.indexOf("キー") !== -1) shaftType = "キー溝";
                else if (sLower.indexOf("none") !== -1 || sLower.indexOf("なし") !== -1) shaftType = "なし";

                var shaftDia = (colMap.shaftDia !== -1 && row[colMap.shaftDia]) ? (parseFloat(row[colMap.shaftDia]) || 5.0) : 5.0;
                if (gearType === "RACK" || gearType === "INTERNAL") {
                    shaftType = "なし";
                    shaftDia = 0.0;
                }

                var relType = (!parentId || importedNodes.length === 0) ? "ROOT" : "MESHING";
                if (parentId && (rawType.indexOf("COAX") !== -1 || rawType.indexOf("同軸") !== -1)) {
                    relType = "COAXIAL";
                }

                importedNodes.push({
                    id: cleanId,
                    kind: gearType,
                    gearType: gearType,
                    parentId: parentId,
                    relationType: relType,
                    z: zVal,
                    m: mVal,
                    alphaDeg: aVal,
                    angleDeg: angVal,
                    relativeAngleDeg: angVal,
                    stageIndex: stageVal,
                    layerIndex: stageVal,
                    shaftType: shaftType,
                    shaftDiameter: shaftDia,
                    x: xVal,
                    backHeight: 5.0,
                    rimThickness: 6.0,
                    rimDiameter: (mVal * zVal) + 12.0
                });
            }

            if (importedNodes.length > 0) {
                importedNodes[0].parentId = null;
                importedNodes[0].relationType = "ROOT";
            }

            return {
                success: true,
                nodes: importedNodes,
                rowCount: importedNodes.length
            };
        }

        function syncPlacementEnabled() {
            var useOrigCirclePos = (selectedCircles.length > 0 && rbCircleOrigPos.value);
            etTargetX.enabled = !useOrigCirclePos;
            etTargetY.enabled = !useOrigCirclePos;
            ddPlacementRef.enabled = !useOrigCirclePos;
            btnUpdatePlacementCoords.enabled = !useOrigCirclePos;
        }

        // 6. Calculation Results Panel
        var pnlCalc = paneLeft.add("panel", undefined, "\u8a08\u7b97\u7d50\u679c\u30fb\u5e72\u6e09\u30d7\u30ec\u30d3\u30e5\u30fc");
        pnlCalc.orientation = "row";
        pnlCalc.alignChildren = ["fill", "center"];
        pnlCalc.spacing = 15;
        pnlCalc.margins = 6;

        var lblCalcSummary = pnlCalc.add("statictext", undefined, "\u6b6f\u8eca\u8af8\u5143\u3092\u8a08\u7b97\u4e2d...");
        lblCalcSummary.characters = 45;

        // 2-Pane layout active

        // ==========================================
        // Train Nodes State Management (Protected & Synchronized)
        // ==========================================
        var isUpdatingFields = false; // Re-entrancy protection guard for ScriptUI events

        function sanitizeId(rawId) {
            if (!rawId) return "";
            var s = String(rawId);
            var clean = "";
            for (var i = 0; i < s.length; i++) {
                var c = s.charCodeAt(i);
                if (c > 32 && c !== 34 && c !== 42 && c !== 47 && c !== 58 && c !== 60 && c !== 62 && c !== 63 && c !== 92 && c !== 124) {
                    clean += s.charAt(i);
                }
            }
            return clean;
        }

        var trainNodes = [];

        function resolveNodeStage(nd) {
            if (nd.stageIndex !== undefined && nd.stageIndex !== null && !isNaN(nd.stageIndex) && nd.stageIndex > 0) {
                return parseInt(nd.stageIndex, 10);
            }
            if (nd.layerIndex !== undefined && nd.layerIndex !== null && !isNaN(nd.layerIndex) && nd.layerIndex > 0) {
                return parseInt(nd.layerIndex, 10);
            }
            if (nd.origCircle && nd.origCircle.stageIndex) {
                return parseInt(nd.origCircle.stageIndex, 10);
            }
            return 1;
        }

        // --- Stage Driver & Unified Parameters Management ---
        function getStageDriverNode(stageIdx, nodes) {
            if (!nodes || nodes.length === 0) return null;
            stageIdx = parseInt(stageIdx, 10) || 1;

            // 1. Root gear in this stage
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if ((parseInt(n.stageIndex, 10) || 1) === stageIdx && (!n.parentId || n.relationType === "ROOT")) {
                    return n;
                }
            }

            // 2. Input gear to this stage (whose parent belongs to a different stage, e.g. coaxial pair)
            var nodeMap = {};
            for (var j = 0; j < nodes.length; j++) {
                nodeMap[nodes[j].id] = nodes[j];
            }
            for (var k = 0; k < nodes.length; k++) {
                var cand = nodes[k];
                if ((parseInt(cand.stageIndex, 10) || 1) === stageIdx && cand.parentId) {
                    var p = nodeMap[cand.parentId];
                    if (p && (parseInt(p.stageIndex, 10) || 1) !== stageIdx) {
                        return cand;
                    }
                }
            }

            // 3. Fallback: first gear in this stage
            for (var m = 0; m < nodes.length; m++) {
                if ((parseInt(nodes[m].stageIndex, 10) || 1) === stageIdx) return nodes[m];
            }
            return null;
        }

        function inheritStageParameters(targetNode, stageIdx, nodes) {
            if (!targetNode) return;
            stageIdx = parseInt(stageIdx, 10) || 1;
            var driver = getStageDriverNode(stageIdx, nodes);
            if (driver && driver !== targetNode) {
                targetNode.m = driver.m;
                targetNode.alphaDeg = driver.alphaDeg;
                targetNode.backlash = driver.backlash;
            }
        }

        function propagateStageParameters(editedNode, nodes) {
            if (!editedNode || !nodes) return;
            var st = parseInt(editedNode.stageIndex, 10) || 1;
            var driver = getStageDriverNode(st, nodes);
            if (driver && driver.id === editedNode.id) {
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    if ((parseInt(n.stageIndex, 10) || 1) === st && n.id !== editedNode.id) {
                        n.m = editedNode.m;
                        n.alphaDeg = editedNode.alphaDeg;
                        n.backlash = editedNode.backlash;
                        syncNodeProperties(n);
                    }
                }
            }
        }

        function syncNodeProperties(nd) {
            if (!nd) return;
            nd.gearType = (nd.kind === "INTERNAL") ? "INTERNAL" : ((nd.kind === "RACK") ? "RACK" : "SPUR");
            nd.kind = nd.gearType;
            nd.z = parseInt(nd.z, 10) || ((nd.gearType === "RACK") ? 24 : 18);
            nd.isMutilated = (nd.gearType === "SPUR") ? !!(nd.isMutilated || nd.mutilated) : false;
            nd.activeTeeth = (nd.activeTeeth !== undefined && nd.activeTeeth !== null && !isNaN(nd.activeTeeth)) ? parseInt(nd.activeTeeth, 10) : nd.z;
            nd.startTooth = (nd.startTooth !== undefined && nd.startTooth !== null && !isNaN(nd.startTooth)) ? parseInt(nd.startTooth, 10) : 1;
            nd.blankRadiusType = nd.blankRadiusType || "root";
            nd.m = (nd.m !== undefined && nd.m !== null && !isNaN(nd.m)) ? parseFloat(nd.m) : (parseFloat(etModule.text) || 2.0);
            nd.alphaDeg = (nd.alphaDeg !== undefined && nd.alphaDeg !== null && !isNaN(nd.alphaDeg)) ? parseFloat(nd.alphaDeg) : (parseFloat(etAlpha.text) || 20.0);
            nd.backlash = (nd.backlash !== undefined && nd.backlash !== null && !isNaN(nd.backlash)) ? parseFloat(nd.backlash) : (parseFloat(etBacklash.text) || 0.15);
            nd.x = (nd.x !== undefined && nd.x !== null && !isNaN(nd.x)) ? parseFloat(nd.x) : 0.0;
            
            var relAngle = (nd.relativeAngleDeg !== undefined && !isNaN(nd.relativeAngleDeg)) ? parseFloat(nd.relativeAngleDeg) : (parseFloat(nd.angleDeg) || 0.0);
            nd.angleDeg = relAngle;
            nd.relativeAngleDeg = relAngle;

            var stIdx = resolveNodeStage(nd);
            nd.stageIndex = stIdx;
            nd.layerIndex = stIdx;

            if (nd.gearType === "RACK") {
                var bHeight = (nd.backBarHeight !== undefined && !isNaN(nd.backBarHeight)) ? parseFloat(nd.backBarHeight) : (parseFloat(nd.backHeight) || 5.0);
                nd.backHeight = bHeight;
                nd.backBarHeight = bHeight;
                nd.rackHeight = bHeight;
                nd.shaftDiameter = 0.0;
                nd.shaftType = "なし";
            } else if (nd.gearType === "INTERNAL") {
                var rThick = (nd.rimThickness !== undefined && !isNaN(nd.rimThickness)) ? parseFloat(nd.rimThickness) : 6.0;
                nd.rimThickness = rThick;
                nd.backHeight = rThick;
                nd.rimDiameter = (nd.m * (nd.z - 2.5)) + 2.0 * rThick;
                nd.shaftDiameter = 0.0;
                nd.shaftType = "なし";
            } else {
                nd.shaftDiameter = (nd.shaftDiameter !== undefined && !isNaN(nd.shaftDiameter)) ? parseFloat(nd.shaftDiameter) : 5.0;
                nd.shaftType = nd.shaftType || "丸穴";
            }
        }

        function setSubItem(it, sIdx, val) {
            if (!it.subItems) it.subItems = [];
            while (it.subItems.length <= sIdx) {
                it.subItems.push({ text: "" });
            }
            if (!it.subItems[sIdx]) it.subItems[sIdx] = { text: "" };
            it.subItems[sIdx].text = String(val);
        }

        function getNodeDisplayStrings(nd) {
            syncNodeProperties(nd);

            // Find parent node
            var pNode = null;
            if (nd.parentId) {
                for (var p = 0; p < trainNodes.length; p++) {
                    if (trainNodes[p].id === nd.parentId) { pNode = trainNodes[p]; break; }
                }
            }

            // Reduction ratio i
            var iStr = "-";
            if (!nd.parentId || nd.relationType === "ROOT") {
                iStr = "- (基準)";
            } else if (nd.relationType === "COAXIAL") {
                iStr = "1.00 (同軸)";
            } else if (pNode && pNode.z && nd.z) {
                var rVal = (nd.z / pNode.z);
                iStr = "i=" + rVal.toFixed(2);
            }

            // Outer diameter / rim thickness column
            var sizeStr = "-";
            if (nd.gearType === "SPUR") {
                var daVal = (nd.gearData && nd.gearData.da) ? nd.gearData.da : (nd.m * (nd.z + 2));
                sizeStr = "da: " + daVal.toFixed(1) + "mm";
            } else if (nd.gearType === "INTERNAL") {
                var dfVal = (nd.gearData && nd.gearData.df) ? nd.gearData.df : (nd.m * (nd.z + 2.5));
                sizeStr = "df: " + dfVal.toFixed(1) + " / リム: " + nd.rimThickness.toFixed(1) + "mm";
            } else if (nd.gearType === "RACK") {
                var thVal = (nd.gearData && nd.gearData.totalHeightMm) ? nd.gearData.totalHeightMm : (nd.m * 4.75);
                sizeStr = "全高: " + thVal.toFixed(1) + "mm";
            }

            var teethStr = (nd.gearType === "RACK") ? ("L" + nd.z) : ("z" + nd.z);
            var kindStr = nd.gearType;
            if (nd.intermittentRole === "DRIVER") {
                kindStr = "間欠(原)";
                teethStr += " (act:" + (nd.activeTeeth || 2) + ")";
            } else if (nd.intermittentRole === "DRIVEN") {
                kindStr = "間欠(従)";
                teethStr += " (n:" + (nd.divisions || 4) + "/mov:" + (nd.moveTeeth || 2) + ")";
            } else if (nd.gearType === "SPUR" && nd.isMutilated && nd.activeTeeth < nd.z) {
                kindStr = "欠歯平";
                teethStr += " (\u6709\u52b9" + nd.activeTeeth + ")";
            }

            return {
                id: nd.id,
                kind: kindStr,
                stage: "L" + nd.stageIndex,
                parent: nd.parentId ? nd.parentId : "-",
                relation: nd.relationType === "COAXIAL" ? "同軸" : (nd.relationType === "ROOT" ? "ルート" : "噛合"),
                teeth: teethStr,
                ratio: iStr,
                size: sizeStr,
                m: String(nd.m),
                alpha: String(nd.alphaDeg) + "°",
                shaft: (nd.gearType === "RACK") ? "-" : (nd.shaftDiameter + "mm (" + nd.shaftType + ")"),
                angle: (nd.relationType === "COAXIAL") ? "-" : (nd.relativeAngleDeg + "°"),
                status: nd.status || "正常"
            };
        }

        function updateListItemRow(item, nd) {
            if (!item || !nd) return;
            var disp = getNodeDisplayStrings(nd);
            item.text = disp.id;
            setSubItem(item, 0, disp.kind);
            setSubItem(item, 1, disp.stage);
            setSubItem(item, 2, disp.parent);
            setSubItem(item, 3, disp.relation);
            setSubItem(item, 4, disp.teeth);
            setSubItem(item, 5, disp.ratio);
            setSubItem(item, 6, disp.size);
            setSubItem(item, 7, disp.m);
            setSubItem(item, 8, disp.alpha);
            setSubItem(item, 9, disp.shaft);
            setSubItem(item, 10, disp.angle);
            setSubItem(item, 11, disp.status);
        }

        function updateCurrentSelectedRowOnly() {
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            var nd = trainNodes[idx];
            if (!nd) return;
            updateListItemRow(trainListBox.selection, nd);
        }

        function refreshTrainList(selectedId) {
            var prevLock = isUpdatingFields;
            isUpdatingFields = true;
            try {
                trainListBox.removeAll();
                for (var i = 0; i < trainNodes.length; i++) {
                    var nd = trainNodes[i];
                    var item = trainListBox.add("item", nd.id);
                    updateListItemRow(item, nd);
                }

                var selIdx = 0;
                if (selectedId) {
                    for (var s = 0; s < trainNodes.length; s++) {
                        if (trainNodes[s].id === selectedId) { selIdx = s; break; }
                    }
                }
                if (trainListBox.items.length > 0) {
                    trainListBox.selection = selIdx;
                }
                loadSelectedNodeToFields();
            } finally {
                isUpdatingFields = prevLock;
            }
            updatePlacementRefLabel();
        }

        function loadSelectedNodeToFields() {
            if (!trainListBox.selection || !trainNodes || trainNodes.length === 0) {
                if (typeof pnlNodeDetail !== "undefined" && pnlNodeDetail) pnlNodeDetail.enabled = false;
                etNodeId.text = "";
                lblIdStatus.text = "";
                etNodeZ.text = "";
                ddNodeParent.removeAll();
                ddNodeParent.add("item", "(なし / ルート)");
                ddNodeParent.selection = 0;
                etNodeAngle.text = "";
                etNodeShaft.text = "";
                etNodeBackHeight.text = "";
                etNodeShift.text = "";
                etNodeStage.text = "";
                etNodeModule.text = "";
                etNodeAlpha.text = "";
                etNodeBacklash.text = "";
                return;
            }
            if (typeof pnlNodeDetail !== "undefined" && pnlNodeDetail) pnlNodeDetail.enabled = true;
            var idx = trainListBox.selection.index;
            var nd = trainNodes[idx];
            if (!nd) return;

            var prevLock = isUpdatingFields;
            isUpdatingFields = true;
            try {
                syncNodeProperties(nd);

                etNodeId.text = nd.id;
                lblIdStatus.text = "";

                ddNodeKind.selection = (nd.gearType === "INTERNAL") ? 1 : ((nd.gearType === "RACK") ? 2 : 0);
                etNodeZ.text = String(nd.z);
                lblNodeZ.text = (nd.gearType === "RACK") ? " 歯数/長さ:" : " 歯数:";

                // Rebuild parent list EXCLUDING the node itself
                ddNodeParent.removeAll();
                ddNodeParent.add("item", "(なし / ルート)");
                var parentItemIdx = 0;
                var currentPIndex = 1;
                for (var p = 0; p < trainNodes.length; p++) {
                    if (trainNodes[p].id !== nd.id) {
                        ddNodeParent.add("item", trainNodes[p].id);
                        if (nd.parentId && trainNodes[p].id === nd.parentId) {
                            parentItemIdx = currentPIndex;
                        }
                        currentPIndex++;
                    }
                }
                ddNodeParent.selection = parentItemIdx;

                ddNodeRelation.selection = (nd.relationType === "COAXIAL") ? 1 : 0;
                etNodeAngle.text = String(nd.relativeAngleDeg);

                etNodeShaft.text = String(nd.shaftDiameter);
                var shType = nd.shaftType || "丸穴";
                if (shType === "Dカット") ddNodeShaftType.selection = 1;
                else if (shType === "キー湍") ddNodeShaftType.selection = 2;
                else if (shType === "なし") ddNodeShaftType.selection = 3;
                else ddNodeShaftType.selection = 0;

                etNodeBackHeight.text = String(nd.gearType === "RACK" ? nd.backBarHeight : nd.rimThickness);
                lblNodeBackHeight.text = (nd.gearType === "RACK") ? " 背面高さ:" : " リム厚み:";

                etNodeShift.text = String(nd.x);
                etNodeStage.text = String(nd.stageIndex);
                etNodeModule.text = String(nd.m);
                etNodeAlpha.text = String(nd.alphaDeg);
                etNodeBacklash.text = String(nd.backlash);

                // Intermittent Mode synchronization
                var intRole = nd.intermittentRole || "NONE";
                if (intRole === "DRIVER") ddIntermittentMode.selection = 2;
                else if (intRole === "DRIVEN") ddIntermittentMode.selection = 3;
                else if (nd.isMutilated) ddIntermittentMode.selection = 1;
                else ddIntermittentMode.selection = 0;

                etActiveTeeth.text = String(nd.activeTeeth !== undefined ? nd.activeTeeth : 2);
                etStartTooth.text = String(nd.startTooth !== undefined ? nd.startTooth : 1);
                chkTipRelief.value = !!nd.tipRelief;

                etDivisions.text = String(nd.divisions || 4);
                etMoveTeeth.text = String(nd.moveTeeth || 2);
                etLockClearance.text = String(nd.lockClearance !== undefined ? nd.lockClearance : 0.15);

                var struct = nd.intermittentStructure || "coplanar";
                if (struct === "two_layer") {
                    rbStructTwoLayer.value = true;
                    rbStructCoplanar.value = false;
                    lblTwoLayerWarning.visible = true;
                } else {
                    rbStructCoplanar.value = true;
                    rbStructTwoLayer.value = false;
                    lblTwoLayerWarning.visible = false;
                }

                updateIntermittentControlsVisibility();

                if (!nd.parentId || nd.relationType === "ROOT") {
                    ddNodeRelation.enabled = false;
                    etNodeAngle.enabled = false;
                } else {
                    ddNodeRelation.enabled = true;
                    etNodeAngle.enabled = (nd.relationType === "MESHING");
                }
            } finally {
                isUpdatingFields = prevLock;
            }
            updatePlacementRefLabel();
        }

        function updateIntermittentControlsVisibility() {
            var isSpur = (ddNodeKind.selection && ddNodeKind.selection.index === 0);
            ddIntermittentMode.enabled = isSpur;
            if (!isSpur) {
                grpMutDriver.visible = false;
                grpMutDriven.visible = false;
                rowNode5b.visible = false;
                lblTwoLayerWarning.visible = false;
                return;
            }

            var modeIdx = ddIntermittentMode.selection ? ddIntermittentMode.selection.index : 0;
            if (modeIdx === 1 || modeIdx === 2) {
                // Mutilated or Driver
                grpMutDriver.visible = true;
                grpMutDriven.visible = false;
                chkTipRelief.visible = (modeIdx === 2);
                rowNode5b.visible = (modeIdx === 2);
                lblTwoLayerWarning.visible = (modeIdx === 2 && rbStructTwoLayer.value);
            } else if (modeIdx === 3) {
                // Driven
                grpMutDriver.visible = false;
                grpMutDriven.visible = true;
                rowNode5b.visible = true;
                lblTwoLayerWarning.visible = rbStructTwoLayer.value;
            } else {
                // Normal
                grpMutDriver.visible = false;
                grpMutDriven.visible = false;
                rowNode5b.visible = false;
                lblTwoLayerWarning.visible = false;
            }
        }

        function saveFieldsToCurrentNode() {
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            var nd = trainNodes[idx];
            if (!nd) return;

            var kinds = ["SPUR", "INTERNAL", "RACK"];
            nd.gearType = kinds[ddNodeKind.selection ? ddNodeKind.selection.index : 0];
            nd.kind = nd.gearType;

            nd.z = parseInt(etNodeZ.text, 10) || ((nd.gearType === "RACK") ? 24 : 18);

            if (ddNodeParent.selection && ddNodeParent.selection.index > 0) {
                nd.parentId = ddNodeParent.selection.text;
                nd.relationType = (ddNodeRelation.selection && ddNodeRelation.selection.index === 1) ? "COAXIAL" : "MESHING";
            } else {
                nd.parentId = null;
                nd.relationType = "ROOT";
            }

            var ang = parseFloat(etNodeAngle.text) || 0.0;
            nd.angleDeg = ang;
            nd.relativeAngleDeg = ang;

            nd.shaftDiameter = parseFloat(etNodeShaft.text) || 0.0;
            nd.shaftType = ddNodeShaftType.selection ? ddNodeShaftType.selection.text : "丸穴";

            var bVal = parseFloat(etNodeBackHeight.text) || ((nd.gearType === "RACK") ? 5.0 : 6.0);
            nd.backHeight = bVal;
            nd.backBarHeight = bVal;
            nd.rackHeight = bVal;
            nd.rimThickness = bVal;

            nd.x = parseFloat(etNodeShift.text) || 0.0;
            nd.stageIndex = parseInt(etNodeStage.text, 10) || 1;
            nd.layerIndex = nd.stageIndex;
            nd.m = parseFloat(etNodeModule.text) || 2.0;
            nd.alphaDeg = parseFloat(etNodeAlpha.text) || 20.0;
            nd.backlash = parseFloat(etNodeBacklash.text) || 0.15;

            var modeIdx = ddIntermittentMode.selection ? ddIntermittentMode.selection.index : 0;
            if (modeIdx === 1) {
                nd.isMutilated = true;
                nd.intermittentRole = "NONE";
            } else if (modeIdx === 2) {
                nd.isMutilated = true;
                nd.intermittentRole = "DRIVER";
            } else if (modeIdx === 3) {
                nd.isMutilated = true;
                nd.intermittentRole = "DRIVEN";
            } else {
                nd.isMutilated = false;
                nd.intermittentRole = "NONE";
            }

            nd.activeTeeth = parseInt(etActiveTeeth.text, 10) || 2;
            nd.startTooth = parseInt(etStartTooth.text, 10) || 1;
            nd.tipRelief = chkTipRelief.value;

            nd.divisions = parseInt(etDivisions.text, 10) || 4;
            nd.moveTeeth = parseInt(etMoveTeeth.text, 10) || 2;
            nd.lockClearance = parseFloat(etLockClearance.text) || 0.15;

            nd.intermittentStructure = rbStructTwoLayer.value ? "two_layer" : "coplanar";
            nd.blankRadiusType = "root";

            // Enforce kinematic constraint z2 = S * k for coplanar intermittent indexing
            if (nd.intermittentRole === "DRIVEN" && nd.intermittentStructure === "coplanar") {
                var expectedZ = nd.divisions * nd.moveTeeth;
                if (expectedZ >= 4 && nd.z !== expectedZ) {
                    nd.z = expectedZ;
                    etNodeZ.text = String(expectedZ);
                }
            }

            syncNodeProperties(nd);
            // Automatically propagate stage-unified parameters (module, alpha, backlash) if editing stage driver
            propagateStageParameters(nd, trainNodes);
        }

        trainListBox.onChange = function () {
            if (isUpdatingFields) return;
            loadSelectedNodeToFields();
        };

        function onFieldInputChanged() {
            if (isUpdatingFields) return;
            var prevLock = isUpdatingFields;
            isUpdatingFields = true;
            try {
                saveFieldsToCurrentNode();
                updateCurrentSelectedRowOnly();
                updatePreview();
            } finally {
                isUpdatingFields = prevLock;
            }
            updatePlacementRefLabel();
        }

        // Attach field change listeners
        etNodeZ.onChanging = onFieldInputChanged;
        etNodeZ.onChange = onFieldInputChanged;
        ddNodeKind.onChange = function () {
            updateIntermittentControlsVisibility();
            onFieldInputChanged();
        };

        ddIntermittentMode.onChange = function () {
            updateIntermittentControlsVisibility();
            onFieldInputChanged();
        };

        chkTipRelief.onClick = onFieldInputChanged;

        rbStructCoplanar.onClick = function () {
            lblTwoLayerWarning.visible = false;
            onFieldInputChanged();
        };

        rbStructTwoLayer.onClick = function () {
            lblTwoLayerWarning.visible = true;
            onFieldInputChanged();
        };

        etActiveTeeth.onChanging = onFieldInputChanged;
        etActiveTeeth.onChange = onFieldInputChanged;
        etStartTooth.onChanging = onFieldInputChanged;
        etStartTooth.onChange = onFieldInputChanged;
        etDivisions.onChanging = onFieldInputChanged;
        etDivisions.onChange = onFieldInputChanged;
        etMoveTeeth.onChanging = onFieldInputChanged;
        etMoveTeeth.onChange = onFieldInputChanged;
        etLockClearance.onChanging = onFieldInputChanged;
        etLockClearance.onChange = onFieldInputChanged;
        ddNodeParent.onChange = function () {
            if (isUpdatingFields) return;
            var prevLock = isUpdatingFields;
            isUpdatingFields = true;
            try {
                saveFieldsToCurrentNode();
                updateCurrentSelectedRowOnly();
                if (!ddNodeParent.selection || ddNodeParent.selection.index === 0) {
                    ddNodeRelation.enabled = false;
                    etNodeAngle.enabled = false;
                } else {
                    ddNodeRelation.enabled = true;
                    etNodeAngle.enabled = (ddNodeRelation.selection && ddNodeRelation.selection.index === 0);
                }
                updatePreview();
            } finally {
                isUpdatingFields = prevLock;
            }
            updatePlacementRefLabel();
        };
        ddNodeRelation.onChange = function () {
            if (isUpdatingFields) return;
            var prevLock = isUpdatingFields;
            isUpdatingFields = true;
            try {
                // If switching to COAXIAL, auto-increment stage if same as parent
                if (ddNodeRelation.selection && ddNodeRelation.selection.index === 1 && ddNodeParent.selection && ddNodeParent.selection.index > 0) {
                    var pId = ddNodeParent.selection.text;
                    var pNode = null;
                    for (var pi = 0; pi < trainNodes.length; pi++) {
                        if (trainNodes[pi].id === pId) { pNode = trainNodes[pi]; break; }
                    }
                    if (pNode) {
                        var curStage = parseInt(etNodeStage.text, 10) || 1;
                        var pStage = parseInt(pNode.stageIndex, 10) || 1;
                        if (curStage <= pStage) {
                            etNodeStage.text = String(pStage + 1);
                        }
                    }
                }
                saveFieldsToCurrentNode();
                updateCurrentSelectedRowOnly();
                etNodeAngle.enabled = (ddNodeRelation.selection && ddNodeRelation.selection.index === 0);
                updatePreview();
            } finally {
                isUpdatingFields = prevLock;
            }
            updatePlacementRefLabel();
        };
        etNodeAngle.onChanging = onFieldInputChanged;
        etNodeAngle.onChange = onFieldInputChanged;
        etNodeShaft.onChanging = onFieldInputChanged;
        etNodeShaft.onChange = onFieldInputChanged;
        ddNodeShaftType.onChange = onFieldInputChanged;
        etNodeBackHeight.onChanging = onFieldInputChanged;
        etNodeBackHeight.onChange = onFieldInputChanged;
        etNodeShift.onChanging = onFieldInputChanged;
        etNodeShift.onChange = onFieldInputChanged;
        etNodeStage.onChanging = onFieldInputChanged;
        etNodeStage.onChange = function () {
            if (isUpdatingFields) return;
            var newStage = parseInt(etNodeStage.text, 10) || 1;
            var driver = getStageDriverNode(newStage, trainNodes);
            if (driver) {
                etNodeModule.text = String(driver.m);
                etNodeAlpha.text = String(driver.alphaDeg);
                etNodeBacklash.text = String(driver.backlash);
            }
            onFieldInputChanged();
        };
        etNodeModule.onChanging = onFieldInputChanged;
        etNodeModule.onChange = onFieldInputChanged;
        etNodeAlpha.onChanging = onFieldInputChanged;
        etNodeAlpha.onChange = onFieldInputChanged;
        etNodeBacklash.onChanging = onFieldInputChanged;
        etNodeBacklash.onChange = onFieldInputChanged;

        // Unique ID Change Button Handler
        btnChangeId.onClick = function () {
            if (!trainListBox.selection) return;
            var idx = trainListBox.selection.index;
            var nd = trainNodes[idx];
            if (!nd) return;

            var newId = sanitizeId(etNodeId.text);
            if (!newId) {
                lblIdStatus.text = "空のIDは無効です";
                try { lblIdStatus.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1); } catch (eG) {}
                return;
            }

            var isDup = false;
            for (var i = 0; i < trainNodes.length; i++) {
                if (trainNodes[i] !== nd && trainNodes[i].id.toLowerCase() === newId.toLowerCase()) {
                    isDup = true;
                    break;
                }
            }

            if (isDup) {
                lblIdStatus.text = "IDが重複しています。";
                try { lblIdStatus.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1); } catch (eG) {}
                etNodeId.text = nd.id;
            } else {
                var oldId = nd.id;
                nd.id = newId;
                for (var j = 0; j < trainNodes.length; j++) {
                    if (trainNodes[j].parentId === oldId) {
                        trainNodes[j].parentId = newId;
                    }
                }
                lblIdStatus.text = "IDを変更しました";
                try { lblIdStatus.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0, 0.6, 0, 1], 1); } catch (eG) {}
                refreshTrainList(newId);
                updatePreview();
            }
        };

        function getSelectedOrLastNode() {
            if (trainListBox.selection && trainNodes[trainListBox.selection.index]) {
                return trainNodes[trainListBox.selection.index];
            }
            return (trainNodes.length > 0) ? trainNodes[trainNodes.length - 1] : null;
        }

        btnAddSpur.onClick = function () {
            var newIdx = trainNodes.length + 1;
            var parentNode = getSelectedOrLastNode();
            var newId = "G" + newIdx;
            var targetStage = parentNode ? (parseInt(parentNode.stageIndex, 10) || 1) : 1;

            var newNode = {
                id: newId,
                kind: "SPUR",
                gearType: "SPUR",
                z: 24,
                m: parentNode ? parentNode.m : (parseFloat(etModule.text) || 2.0),
                alphaDeg: parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0),
                backlash: parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15),
                shaftDiameter: 5.0,
                shaftType: "丸穴",
                parentId: parentNode ? parentNode.id : null,
                relationType: parentNode ? "MESHING" : "ROOT",
                angleDeg: 0,
                relativeAngleDeg: 0,
                stageIndex: targetStage,
                layerIndex: targetStage,
                x: 0
            };
            inheritStageParameters(newNode, targetStage, trainNodes);
            syncNodeProperties(newNode);
            trainNodes.push(newNode);
            refreshTrainList(newId);
            updatePreview();
        };

        btnAddCoaxial.onClick = function () {
            var parentNode = getSelectedOrLastNode();
            if (!parentNode) {
                alert("同軸ギアを追加するには、親となるギアを選択してください。");
                return;
            }
            var newIdx = trainNodes.length + 1;
            var newId = "G" + newIdx;
            var nextStage = (parseInt(parentNode.stageIndex, 10) || 1) + 1; // Stage number +1!

            var newNode = {
                id: newId,
                kind: "SPUR",
                gearType: "SPUR",
                z: 18,
                m: parseFloat(etModule.text) || parentNode.m || 2.0,
                alphaDeg: parseFloat(etAlpha.text) || parentNode.alphaDeg || 20.0,
                backlash: parseFloat(etBacklash.text) || parentNode.backlash || 0.15,
                shaftDiameter: parentNode.shaftDiameter || 5.0,
                shaftType: parentNode.shaftType || "丸穴",
                parentId: parentNode.id,
                relationType: "COAXIAL",
                angleDeg: 0,
                relativeAngleDeg: 0,
                stageIndex: nextStage,
                layerIndex: nextStage,
                x: 0
            };
            inheritStageParameters(newNode, nextStage, trainNodes);
            syncNodeProperties(newNode);
            trainNodes.push(newNode);
            refreshTrainList(newId);
            updatePreview();
        };

        btnAddInternal.onClick = function () {
            var newIdx = trainNodes.length + 1;
            var parentNode = getSelectedOrLastNode();
            var newId = "I" + newIdx;
            var targetStage = parentNode ? (parseInt(parentNode.stageIndex, 10) || 1) : 1;

            var newNode = {
                id: newId,
                kind: "INTERNAL",
                gearType: "INTERNAL",
                z: 48,
                m: parentNode ? parentNode.m : (parseFloat(etModule.text) || 2.0),
                alphaDeg: parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0),
                backlash: parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15),
                shaftDiameter: 0.0,
                shaftType: "なし",
                rimThickness: 6.0,
                parentId: parentNode ? parentNode.id : null,
                relationType: parentNode ? "MESHING" : "ROOT",
                angleDeg: 0,
                relativeAngleDeg: 0,
                stageIndex: targetStage,
                layerIndex: targetStage,
                x: 0
            };
            inheritStageParameters(newNode, targetStage, trainNodes);
            syncNodeProperties(newNode);
            trainNodes.push(newNode);
            refreshTrainList(newId);
            updatePreview();
        };

        btnAddRack.onClick = function () {
            var newIdx = trainNodes.length + 1;
            var parentNode = getSelectedOrLastNode();
            var newId = "R" + newIdx;
            var targetStage = parentNode ? (parseInt(parentNode.stageIndex, 10) || 1) : 1;

            var newNode = {
                id: newId,
                kind: "RACK",
                gearType: "RACK",
                z: 24,
                m: parentNode ? parentNode.m : (parseFloat(etModule.text) || 2.0),
                alphaDeg: parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0),
                backlash: parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15),
                backHeight: 5.0,
                backBarHeight: 5.0,
                rackHeight: 5.0,
                shaftDiameter: 0.0,
                shaftType: "なし",
                parentId: parentNode ? parentNode.id : null,
                relationType: parentNode ? "MESHING" : "ROOT",
                angleDeg: -90,
                relativeAngleDeg: -90,
                stageIndex: targetStage,
                layerIndex: targetStage,
                x: 0
            };
            inheritStageParameters(newNode, targetStage, trainNodes);
            syncNodeProperties(newNode);
            trainNodes.push(newNode);
            refreshTrainList(newId);
            updatePreview();
        };

        // ==========================================
        // Modal: Add Intermittent Gear Pair Dialog
        // ==========================================
        function showAddIntermittentModal(initParams) {
            initParams = initParams || {};
            var parentNode = getSelectedOrLastNode();
            var modal = new Window("dialog", "間欠歯車ペアの追加設定 (Intermittent Gear Pair)");
            modal.orientation = "column";
            modal.alignChildren = ["fill", "top"];
            modal.spacing = 8;
            modal.margins = 12;

            // Panel 1: Kinematic Connection
            var pnlConn = modal.add("panel", undefined, "輪列接続設定 (Kinematic Connection)");
            pnlConn.orientation = "column";
            pnlConn.alignChildren = ["fill", "top"];
            pnlConn.spacing = 6;
            pnlConn.margins = 8;

            var rowConn1 = pnlConn.add("group");
            rowConn1.orientation = "row";
            rowConn1.spacing = 8;
            rowConn1.add("statictext", undefined, "親ギア:");
            var parentOptions = ["なし (独立ルート)"];
            var parentNodesList = [null];
            var selParentIdx = 0;
            for (var i = 0; i < trainNodes.length; i++) {
                var tn = trainNodes[i];
                parentOptions.push(tn.id + " (" + tn.gearType + ", z=" + tn.z + ", 段" + (tn.stageIndex || 1) + ")");
                parentNodesList.push(tn);
                if (parentNode && tn.id === parentNode.id) {
                    selParentIdx = i + 1;
                }
            }
            var ddParent = rowConn1.add("dropdownlist", undefined, parentOptions);
            ddParent.selection = selParentIdx;

            rowConn1.add("statictext", undefined, "接続関係:");
            var ddRelation = rowConn1.add("dropdownlist", undefined, ["噛み合い (MESHING)", "同軸 (COAXIAL)"]);
            ddRelation.selection = (selParentIdx > 0) ? 0 : 0;

            var rowConn2 = pnlConn.add("group");
            rowConn2.orientation = "row";
            rowConn2.spacing = 8;
            rowConn2.add("statictext", undefined, "段番号(Stage):");
            var defaultStage = 1;
            if (parentNode) {
                defaultStage = (ddRelation.selection && ddRelation.selection.index === 1) ? ((parseInt(parentNode.stageIndex, 10) || 1) + 1) : (parseInt(parentNode.stageIndex, 10) || 1);
            }
            var etStage = rowConn2.add("edittext", undefined, String(defaultStage));
            etStage.characters = 3;

            rowConn2.add("statictext", undefined, "配置角度(°):");
            var etAngle = rowConn2.add("edittext", undefined, "0.0");
            etAngle.characters = 4;

            // Panel 2: Gear Parameters
            var pnlParams = modal.add("panel", undefined, "基本諸元 (Gear Parameters)");
            pnlParams.orientation = "row";
            pnlParams.spacing = 8;
            pnlParams.margins = 8;

            var curStage = parseInt(etStage.text, 10) || 1;
            var stageDriver = getStageDriverNode(curStage, trainNodes);
            var defM = initParams.m || (stageDriver ? stageDriver.m : (parentNode ? parentNode.m : (parseFloat(etModule.text) || 3.0)));
            if (defM < 2.0) defM = 3.0;
            var defA = initParams.alphaDeg || (stageDriver ? stageDriver.alphaDeg : (parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0)));
            var defB = initParams.backlash || (stageDriver ? stageDriver.backlash : (parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15)));

            pnlParams.add("statictext", undefined, "モジュール(m):");
            var etM = pnlParams.add("edittext", undefined, String(defM));
            etM.characters = 4;

            pnlParams.add("statictext", undefined, "圧力角(°):");
            var etA = pnlParams.add("edittext", undefined, String(defA));
            etA.characters = 4;

            pnlParams.add("statictext", undefined, "バックラッシ(mm):");
            var etB = pnlParams.add("edittext", undefined, String(defB));
            etB.characters = 4;

            // Panel 3: Intermittent Parameters
            var pnlInt = modal.add("panel", undefined, "間欠機構パラメータ (Intermittent Kinematics)");
            pnlInt.orientation = "column";
            pnlInt.alignChildren = ["fill", "top"];
            pnlInt.spacing = 6;
            pnlInt.margins = 8;

            var rowInt1 = pnlInt.add("group");
            rowInt1.orientation = "row";
            rowInt1.spacing = 8;

            rowInt1.add("statictext", undefined, "従動車分割数(S):");
            var etDiv = rowInt1.add("edittext", undefined, String(initParams.divisions || "4"));
            etDiv.characters = 3;

            rowInt1.add("statictext", undefined, "送り歯数(k):");
            var etMove = rowInt1.add("edittext", undefined, String(initParams.moveTeeth || "2"));
            etMove.characters = 3;

            rowInt1.add("statictext", undefined, "原動車歯数(z1):");
            var etZ1 = rowInt1.add("edittext", undefined, String(initParams.z1 || "8"));
            etZ1.characters = 3;

            rowInt1.add("statictext", undefined, "従動車歯数(z2=S×k):");
            var stZ2 = rowInt1.add("statictext", undefined, "8");
            stZ2.characters = 4;

            var rowInt2 = pnlInt.add("group");
            rowInt2.orientation = "row";
            rowInt2.spacing = 8;

            rowInt2.add("statictext", undefined, "軸穴径(原動/従動 mm):");
            var etShaft = rowInt2.add("edittext", undefined, String(initParams.shaftDiameter || (parentNode ? parentNode.shaftDiameter : (parseFloat(etDefShaft.text) || 5.0))));
            etShaft.characters = 4;

            var cbLock = rowInt2.add("checkbox", undefined, "ロック機構 (ドラム/アーク) を有効化");
            cbLock.value = (initParams.enableLock !== undefined) ? !!initParams.enableLock : true;

            // Panel 4: Analysis
            var pnlInfo = modal.add("panel", undefined, "動作解析 (Analysis)");
            pnlInfo.orientation = "row";
            pnlInfo.spacing = 12;
            pnlInfo.margins = 8;
            var stIndexAngle = pnlInfo.add("statictext", undefined, "割出し角: 90.0°");
            var stCenterDist = pnlInfo.add("statictext", undefined, "中心距離 a: 24.00 mm");

            function updateIntermittentCalculations() {
                var s = parseInt(etDiv.text, 10) || 4;
                if (s < 2) s = 2;
                var k = parseInt(etMove.text, 10) || 2;
                if (k < 1) k = 1;
                var z1 = parseInt(etZ1.text, 10) || 8;
                var z2 = s * k;
                stZ2.text = String(z2);

                var m = parseFloat(etM.text) || 3.0;
                var a = (m * (z1 + z2)) / 2.0;
                var indexDeg = 360.0 / s;

                stIndexAngle.text = "割出し角: " + indexDeg.toFixed(1) + "°";
                stCenterDist.text = "中心距離 a: " + a.toFixed(2) + " mm";
            }

            ddParent.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    ddRelation.enabled = true;
                    if (ddRelation.selection.index === 1) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                } else {
                    ddRelation.enabled = false;
                    etStage.text = "1";
                }
                var stg = parseInt(etStage.text, 10) || 1;
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updateIntermittentCalculations();
            };

            ddRelation.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    if (ddRelation.selection.index === 1) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                }
                var stg = parseInt(etStage.text, 10) || 1;
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updateIntermittentCalculations();
            };

            etDiv.onChanging = updateIntermittentCalculations;
            etMove.onChanging = updateIntermittentCalculations;
            etZ1.onChanging = updateIntermittentCalculations;
            etM.onChanging = updateIntermittentCalculations;

            updateIntermittentCalculations();

            var grpBtn = modal.add("group");
            grpBtn.orientation = "row";
            grpBtn.alignment = ["right", "center"];
            var btnCancel = grpBtn.add("button", undefined, "キャンセル");
            var btnOk = grpBtn.add("button", undefined, "輪列に追加 (Add)");

            btnCancel.onClick = function () { modal.close(0); };
            btnOk.onClick = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                var s = parseInt(etDiv.text, 10) || 4;
                var k = parseInt(etMove.text, 10) || 2;
                var z1 = parseInt(etZ1.text, 10) || 8;
                var m = parseFloat(etM.text) || 3.0;
                var aDeg = parseFloat(etA.text) || 20.0;
                var b = parseFloat(etB.text) || 0.15;
                var stage = parseInt(etStage.text, 10) || 1;
                var relAngle = parseFloat(etAngle.text) || 0.0;
                var shaft = parseFloat(etShaft.text) || 5.0;
                var relType = curParent ? ((ddRelation.selection.index === 1) ? "COAXIAL" : "MESHING") : "ROOT";

                var prefix = "G" + (trainNodes.length + 1) + "_";
                var driverId = prefix + "Driver";
                var drivenId = prefix + "Driven";

                var pairNodes = InvoluteMath.expandIntermittentPairToNodes({
                    m: m,
                    alphaDeg: aDeg,
                    backlash: b,
                    shaftDiameter1: shaft,
                    shaftDiameter2: shaft,
                    driverId: driverId,
                    drivenId: drivenId,
                    parentId: curParent ? curParent.id : null,
                    relationType: relType,
                    relativeAngleDeg: relAngle,
                    stageIndex: stage,
                    divisions: s,
                    moveTeeth: k,
                    z1: z1,
                    enableLock: cbLock.value
                });

                for (var pi = 0; pi < pairNodes.length; pi++) {
                    syncNodeProperties(pairNodes[pi]);
                    trainNodes.push(pairNodes[pi]);
                }

                modal.close(1);
                refreshTrainList(driverId);
                updatePreview();
            };

            modal.show();
        }

        // ==========================================
        // Modal: Add Planetary Gear System Dialog
        // ==========================================
        function showAddPlanetaryModal(initParams) {
            initParams = initParams || {};
            var parentNode = getSelectedOrLastNode();
            var modal = new Window("dialog", "遊星歯車機構の追加設定 (Standard 2K-H Planetary)");
            modal.orientation = "column";
            modal.alignChildren = ["fill", "top"];
            modal.spacing = 8;
            modal.margins = 12;

            // Panel 1: Kinematic Connection
            var pnlConn = modal.add("panel", undefined, "輪列接続設定 (Kinematic Connection)");
            pnlConn.orientation = "column";
            pnlConn.alignChildren = ["fill", "top"];
            pnlConn.spacing = 6;
            pnlConn.margins = 8;

            var rowConn1 = pnlConn.add("group");
            rowConn1.orientation = "row";
            rowConn1.spacing = 8;
            rowConn1.add("statictext", undefined, "親ギア:");
            var parentOptions = ["なし (独立ルート)"];
            var parentNodesList = [null];
            var selParentIdx = 0;
            for (var i = 0; i < trainNodes.length; i++) {
                var tn = trainNodes[i];
                parentOptions.push(tn.id + " (" + tn.gearType + ", z=" + tn.z + ", 段" + (tn.stageIndex || 1) + ")");
                parentNodesList.push(tn);
                if (parentNode && tn.id === parentNode.id) {
                    selParentIdx = i + 1;
                }
            }
            var ddParent = rowConn1.add("dropdownlist", undefined, parentOptions);
            ddParent.selection = selParentIdx;

            rowConn1.add("statictext", undefined, "接続関係:");
            var ddRelation = rowConn1.add("dropdownlist", undefined, ["同軸 (COAXIAL)", "噛み合い (MESHING)"]);
            ddRelation.selection = 0;

            var rowConn2 = pnlConn.add("group");
            rowConn2.orientation = "row";
            rowConn2.spacing = 8;
            rowConn2.add("statictext", undefined, "太陽車の段番号(Stage):");
            var defaultStage = 1;
            if (parentNode) {
                defaultStage = (ddRelation.selection.index === 0) ? ((parseInt(parentNode.stageIndex, 10) || 1) + 1) : (parseInt(parentNode.stageIndex, 10) || 1);
            }
            var etStage = rowConn2.add("edittext", undefined, String(defaultStage));
            etStage.characters = 3;

            // Panel 2: Gear Parameters
            var pnlParams = modal.add("panel", undefined, "基本諸元 (Gear Parameters)");
            pnlParams.orientation = "row";
            pnlParams.spacing = 8;
            pnlParams.margins = 8;

            var curStage = parseInt(etStage.text, 10) || 1;
            var stageDriver = getStageDriverNode(curStage, trainNodes);
            var defM = initParams.m || (stageDriver ? stageDriver.m : (parentNode ? parentNode.m : (parseFloat(etModule.text) || 2.0)));
            var defA = initParams.alphaDeg || (stageDriver ? stageDriver.alphaDeg : (parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0)));
            var defB = initParams.backlash || (stageDriver ? stageDriver.backlash : (parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15)));

            pnlParams.add("statictext", undefined, "モジュール(m):");
            var etM = pnlParams.add("edittext", undefined, String(defM));
            etM.characters = 4;

            pnlParams.add("statictext", undefined, "圧力角(°):");
            var etA = pnlParams.add("edittext", undefined, String(defA));
            etA.characters = 4;

            pnlParams.add("statictext", undefined, "バックラッシ(mm):");
            var etB = pnlParams.add("edittext", undefined, String(defB));
            etB.characters = 4;

            // Panel 3: Teeth Configuration
            var pnlTeeth = modal.add("panel", undefined, "歯数・遊星数構成 (Gear Teeth & Planets)");
            pnlTeeth.orientation = "column";
            pnlTeeth.alignChildren = ["fill", "top"];
            pnlTeeth.spacing = 6;
            pnlTeeth.margins = 8;

            var rowTeeth1 = pnlTeeth.add("group");
            rowTeeth1.orientation = "row";
            rowTeeth1.spacing = 8;

            rowTeeth1.add("statictext", undefined, "太陽歯車 (zs):");
            var etZs = rowTeeth1.add("edittext", undefined, String(initParams.zs || (typeof etPlanetaryZs !== "undefined" ? etPlanetaryZs.text : "18")));
            etZs.characters = 4;

            rowTeeth1.add("statictext", undefined, "遊星歯車 (zp):");
            var etZp = rowTeeth1.add("edittext", undefined, String(initParams.zp || (typeof etPlanetaryZp !== "undefined" ? etPlanetaryZp.text : "18")));
            etZp.characters = 4;

            rowTeeth1.add("statictext", undefined, "内歯車 (zr):");
            var zs0 = parseInt(etZs.text, 10) || 18;
            var zp0 = parseInt(etZp.text, 10) || 18;
            var etZr = rowTeeth1.add("edittext", undefined, String(initParams.zr || (zs0 + 2 * zp0)));
            etZr.characters = 4;

            rowTeeth1.add("statictext", undefined, "遊星数 (N):");
            var etN = rowTeeth1.add("edittext", undefined, String(initParams.numPlanets || (typeof etPlanetaryN !== "undefined" ? etPlanetaryN.text : "3")));
            etN.characters = 3;

            var rowTeeth2 = pnlTeeth.add("group");
            rowTeeth2.orientation = "row";
            rowTeeth2.spacing = 8;

            rowTeeth2.add("statictext", undefined, "軸穴径 (太陽/遊星 mm):");
            var etShaftSun = rowTeeth2.add("edittext", undefined, "5.0");
            etShaftSun.characters = 4;
            var etShaftPlanet = rowTeeth2.add("edittext", undefined, "4.0");
            etShaftPlanet.characters = 4;

            rowTeeth2.add("statictext", undefined, "内歯車リム外径オフセット(mm):");
            var etRimOffset = rowTeeth2.add("edittext", undefined, "16.0");
            etRimOffset.characters = 4;

            // Panel 4: Feasibility
            var pnlFeas = modal.add("panel", undefined, "幾何解析・組立判定 (Assembly Feasibility)");
            pnlFeas.orientation = "column";
            pnlFeas.alignChildren = ["fill", "top"];
            pnlFeas.spacing = 4;
            pnlFeas.margins = 8;

            var stCond1 = pnlFeas.add("statictext", undefined, "同心条件 (zr = zs + 2zp): OK");
            var stCond2 = pnlFeas.add("statictext", undefined, "組立条件 ((zs + zr)/N = 整数): OK");
            var stRatio = pnlFeas.add("statictext", undefined, "減速比: 内歯固定時 i = 4.00, キャリア固定時 i = -3.00");

            function updatePlanetaryCalculations(autoZr) {
                var zs = parseInt(etZs.text, 10) || 18;
                var zp = parseInt(etZp.text, 10) || 18;
                if (autoZr) {
                    etZr.text = String(zs + 2 * zp);
                }
                var zr = parseInt(etZr.text, 10) || (zs + 2 * zp);
                var n = parseInt(etN.text, 10) || 3;

                if (zr === (zs + 2 * zp)) {
                    stCond1.text = "同心条件 (zr = zs + 2zp): OK (" + zr + " = " + zs + " + " + (2 * zp) + ")";
                } else {
                    stCond1.text = "同心条件: 要転位 (差分 " + (zr - (zs + 2 * zp)) + " 歯)";
                }

                var sumZ = zs + zr;
                if (sumZ % n === 0) {
                    stCond2.text = "組立条件 ((zs + zr)/N = 整数): OK (" + sumZ + " / " + n + " = " + (sumZ / n) + ")";
                } else {
                    stCond2.text = "組立条件: NG (" + sumZ + " / " + n + " = " + (sumZ / n).toFixed(2) + " 非整数 - 等配不可)";
                }

                var iRingFix = 1.0 + (zr / zs);
                var iCarrFix = -(zr / zs);
                stRatio.text = "減速比: 内歯固定時 i = " + iRingFix.toFixed(2) + " (増力), キャリア固定時 i = " + iCarrFix.toFixed(2) + " (逆転)";
            }

            ddParent.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    ddRelation.enabled = true;
                    if (ddRelation.selection.index === 0) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                } else {
                    ddRelation.enabled = false;
                    etStage.text = "1";
                }
                var stg = parseInt(etStage.text, 10) || 1;
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updatePlanetaryCalculations(false);
            };

            ddRelation.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    if (ddRelation.selection.index === 0) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                }
                var stg = parseInt(etStage.text, 10) || 1;
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updatePlanetaryCalculations(false);
            };

            etZs.onChanging = function () { updatePlanetaryCalculations(true); };
            etZp.onChanging = function () { updatePlanetaryCalculations(true); };
            etZr.onChanging = function () { updatePlanetaryCalculations(false); };
            etN.onChanging = function () { updatePlanetaryCalculations(false); };

            updatePlanetaryCalculations(false);

            var grpBtn = modal.add("group");
            grpBtn.orientation = "row";
            grpBtn.alignment = ["right", "center"];
            var btnCancel = grpBtn.add("button", undefined, "キャンセル");
            var btnOk = grpBtn.add("button", undefined, "輪列に追加 (Add)");

            btnCancel.onClick = function () { modal.close(0); };
            btnOk.onClick = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                var zs = parseInt(etZs.text, 10) || 18;
                var zp = parseInt(etZp.text, 10) || 18;
                var zr = parseInt(etZr.text, 10) || (zs + 2 * zp);
                var n = parseInt(etN.text, 10) || 3;
                var m = parseFloat(etM.text) || 2.0;
                var aDeg = parseFloat(etA.text) || 20.0;
                var b = parseFloat(etB.text) || 0.15;
                var stage = parseInt(etStage.text, 10) || 1;
                var shaftS = parseFloat(etShaftSun.text) || 5.0;
                var shaftP = parseFloat(etShaftPlanet.text) || 4.0;
                var rimOffset = parseFloat(etRimOffset.text) || 16.0;
                var rimDia = (m * zr) + rimOffset;
                var relType = curParent ? ((ddRelation.selection.index === 0) ? "COAXIAL" : "MESHING") : "ROOT";

                var prefix = "PL" + (trainNodes.length + 1) + "_";

                var pNodes = InvoluteMath.expandPlanetaryToNodes({
                    m: m,
                    zs: zs,
                    zp: zp,
                    zr: zr,
                    numPlanets: n,
                    alphaDeg: aDeg,
                    backlash: b,
                    shaftDiameterSun: shaftS,
                    shaftDiameterPlanet: shaftP,
                    rimDiameter: rimDia,
                    parentId: curParent ? curParent.id : null,
                    relationType: relType,
                    stageIndex: stage,
                    idPrefix: prefix
                });

                for (var i = 0; i < pNodes.length; i++) {
                    syncNodeProperties(pNodes[i]);
                    trainNodes.push(pNodes[i]);
                }

                modal.close(1);
                refreshTrainList(pNodes[0].id);
                updatePreview();
            };

            modal.show();
        }

        // ==========================================
        // Modal: Add Paradoxical Planetary Dialog
        // ==========================================
        function showAddParadoxModal(initParams) {
            initParams = initParams || {};
            var parentNode = getSelectedOrLastNode();
            var modal = new Window("dialog", "不思議遊星歯車機構の追加設定 (3K Paradoxical Planetary)");
            modal.orientation = "column";
            modal.alignChildren = ["fill", "top"];
            modal.spacing = 8;
            modal.margins = 12;

            // Panel 1: Kinematic Connection
            var pnlConn = modal.add("panel", undefined, "輪列接続設定 (Kinematic Connection)");
            pnlConn.orientation = "column";
            pnlConn.alignChildren = ["fill", "top"];
            pnlConn.spacing = 6;
            pnlConn.margins = 8;

            var rowConn1 = pnlConn.add("group");
            rowConn1.orientation = "row";
            rowConn1.spacing = 8;
            rowConn1.add("statictext", undefined, "親ギア:");
            var parentOptions = ["なし (独立ルート)"];
            var parentNodesList = [null];
            var selParentIdx = 0;
            for (var i = 0; i < trainNodes.length; i++) {
                var tn = trainNodes[i];
                parentOptions.push(tn.id + " (" + tn.gearType + ", z=" + tn.z + ", 段" + (tn.stageIndex || 1) + ")");
                parentNodesList.push(tn);
                if (parentNode && tn.id === parentNode.id) {
                    selParentIdx = i + 1;
                }
            }
            var ddParent = rowConn1.add("dropdownlist", undefined, parentOptions);
            ddParent.selection = selParentIdx;

            rowConn1.add("statictext", undefined, "接続関係:");
            var ddRelation = rowConn1.add("dropdownlist", undefined, ["同軸 (COAXIAL)", "噛み合い (MESHING)"]);
            ddRelation.selection = 0;

            var rowConn2 = pnlConn.add("group");
            rowConn2.orientation = "row";
            rowConn2.spacing = 8;
            rowConn2.add("statictext", undefined, "固定内歯車段(Stage):");
            var defaultStage = 1;
            if (parentNode) {
                defaultStage = (ddRelation.selection.index === 0) ? ((parseInt(parentNode.stageIndex, 10) || 1) + 1) : (parseInt(parentNode.stageIndex, 10) || 1);
            }
            var etStage = rowConn2.add("edittext", undefined, String(defaultStage));
            etStage.characters = 3;

            rowConn2.add("statictext", undefined, "出力内歯車段:");
            var stStageOut = rowConn2.add("statictext", undefined, "段 " + (defaultStage + 1));

            // Panel 2: Gear Parameters
            var pnlParams = modal.add("panel", undefined, "基本諸元 (Gear Parameters)");
            pnlParams.orientation = "row";
            pnlParams.spacing = 8;
            pnlParams.margins = 8;

            var curStage = parseInt(etStage.text, 10) || 1;
            var stageDriver = getStageDriverNode(curStage, trainNodes);
            var defM = initParams.m || (stageDriver ? stageDriver.m : (parentNode ? parentNode.m : (parseFloat(etModule.text) || 2.0)));
            var defA = initParams.alphaDeg || (stageDriver ? stageDriver.alphaDeg : (parentNode ? parentNode.alphaDeg : (parseFloat(etAlpha.text) || 20.0)));
            var defB = initParams.backlash || (stageDriver ? stageDriver.backlash : (parentNode ? parentNode.backlash : (parseFloat(etBacklash.text) || 0.15)));

            pnlParams.add("statictext", undefined, "モジュール(m):");
            var etM = pnlParams.add("edittext", undefined, String(defM));
            etM.characters = 4;

            pnlParams.add("statictext", undefined, "圧力角(°):");
            var etA = pnlParams.add("edittext", undefined, String(defA));
            etA.characters = 4;

            pnlParams.add("statictext", undefined, "バックラッシ(mm):");
            var etB = pnlParams.add("edittext", undefined, String(defB));
            etB.characters = 4;

            // Panel 3: Teeth Configuration
            var pnlTeeth = modal.add("panel", undefined, "歯数・遊星数構成 (Teeth Configuration)");
            pnlTeeth.orientation = "column";
            pnlTeeth.alignChildren = ["fill", "top"];
            pnlTeeth.spacing = 6;
            pnlTeeth.margins = 8;

            var rowTeeth1 = pnlTeeth.add("group");
            rowTeeth1.orientation = "row";
            rowTeeth1.spacing = 8;

            rowTeeth1.add("statictext", undefined, "太陽 (zs):");
            var etZs = rowTeeth1.add("edittext", undefined, String(initParams.zs || (typeof etParadoxZs !== "undefined" ? etParadoxZs.text : "24")));
            etZs.characters = 4;

            rowTeeth1.add("statictext", undefined, "遊星 (zp):");
            var etZp = rowTeeth1.add("edittext", undefined, String(initParams.zp || (typeof etParadoxZp !== "undefined" ? etParadoxZp.text : "18")));
            etZp.characters = 4;

            rowTeeth1.add("statictext", undefined, "固定内歯 (zr1):");
            var zs0 = parseInt(etZs.text, 10) || 24;
            var zp0 = parseInt(etZp.text, 10) || 18;
            var etZr1 = rowTeeth1.add("edittext", undefined, String(initParams.zr1 || (zs0 + 2 * zp0)));
            etZr1.characters = 4;

            rowTeeth1.add("statictext", undefined, "出力内歯 (zr2):");
            var etZr2 = rowTeeth1.add("edittext", undefined, String(initParams.zr2 || (typeof etParadoxZr2 !== "undefined" ? etParadoxZr2.text : "57")));
            etZr2.characters = 4;

            rowTeeth1.add("statictext", undefined, "遊星数 (N):");
            var etN = rowTeeth1.add("edittext", undefined, String(initParams.numPlanets || (typeof etParadoxN !== "undefined" ? etParadoxN.text : "3")));
            etN.characters = 3;

            var rowTeeth2 = pnlTeeth.add("group");
            rowTeeth2.orientation = "row";
            rowTeeth2.spacing = 8;

            rowTeeth2.add("statictext", undefined, "軸穴径 (太陽/遊星 mm):");
            var etShaftSun = rowTeeth2.add("edittext", undefined, "5.0");
            etShaftSun.characters = 4;
            var etShaftPlanet = rowTeeth2.add("edittext", undefined, "4.0");
            etShaftPlanet.characters = 4;

            rowTeeth2.add("statictext", undefined, "内歯車リム外径オフセット(mm):");
            var etRimOffset = rowTeeth2.add("edittext", undefined, "16.0");
            etRimOffset.characters = 4;

            // Panel 4: Kinematics & Profile Shift
            var pnlFeas = modal.add("panel", undefined, "機構解析・転位量・超減速比 (Kinematics & Profile Shift)");
            pnlFeas.orientation = "column";
            pnlFeas.alignChildren = ["fill", "top"];
            pnlFeas.spacing = 4;
            pnlFeas.margins = 8;

            var stRatio = pnlFeas.add("statictext", undefined, "超減速比 i: -19.00");
            var stShift = pnlFeas.add("statictext", undefined, "出力内歯車 転位係数 xr2: +0.0000");
            var stAssem = pnlFeas.add("statictext", undefined, "組立条件判定: 固定 OK / 出力 OK");

            function updateParadoxCalculations(autoZr1) {
                var zs = parseInt(etZs.text, 10) || 24;
                var zp = parseInt(etZp.text, 10) || 18;
                if (autoZr1) {
                    etZr1.text = String(zs + 2 * zp);
                }
                var zr1 = parseInt(etZr1.text, 10) || (zs + 2 * zp);
                var zr2 = parseInt(etZr2.text, 10) || (zr1 - 3);
                var n = parseInt(etN.text, 10) || 3;
                var mVal = parseFloat(etM.text) || 2.0;
                var aVal = parseFloat(etA.text) || 20.0;

                var ratio = (zr1 !== zr2) ? (zr2 / (zr2 - zr1)) : 0;
                stRatio.text = "超減速比 i: " + ratio.toFixed(2) + " (1入力回転に対し " + (1.0 / ratio).toFixed(4) + " 回転出力)";

                var alpha = aVal * (Math.PI / 180.0);
                var a = (mVal * (zs + zp)) / 2.0;
                var a0_2 = (mVal * (zr2 - zp)) / 2.0;
                var cosAw2 = (a0_2 / a) * Math.cos(alpha);
                var xr2Val = 0.0;
                if (cosAw2 > 0.0 && cosAw2 <= 1.0) {
                    var aw2 = Math.acos(cosAw2);
                    var invAlpha = Math.tan(alpha) - alpha;
                    var invAw2 = Math.tan(aw2) - aw2;
                    xr2Val = (zr2 - zp) * (invAw2 - invAlpha) / (2.0 * Math.tan(alpha));
                    stShift.text = "出力内歯車 転位係数 xr2: " + ((xr2Val >= 0 ? "+" : "") + xr2Val.toFixed(4));
                } else {
                    stShift.text = "出力内歯車 転位係数: 中心距離整合限界外";
                }

                var ok1 = ((zs + zr1) % n === 0);
                var ok2 = ((zs + zr2) % n === 0);
                stAssem.text = "組立条件判定: 固定(zr1) " + (ok1 ? "OK" : "NG") + " / 出力(zr2) " + (ok2 ? "OK" : "NG");
            }

            ddParent.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    ddRelation.enabled = true;
                    if (ddRelation.selection.index === 0) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                } else {
                    ddRelation.enabled = false;
                    etStage.text = "1";
                }
                var stg = parseInt(etStage.text, 10) || 1;
                stStageOut.text = "段 " + (stg + 1);
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updateParadoxCalculations(false);
            };

            ddRelation.onChange = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                if (curParent) {
                    if (ddRelation.selection.index === 0) {
                        etStage.text = String((parseInt(curParent.stageIndex, 10) || 1) + 1);
                    } else {
                        etStage.text = String(parseInt(curParent.stageIndex, 10) || 1);
                    }
                }
                var stg = parseInt(etStage.text, 10) || 1;
                stStageOut.text = "段 " + (stg + 1);
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
                updateParadoxCalculations(false);
            };

            etStage.onChanging = function () {
                var stg = parseInt(etStage.text, 10) || 1;
                stStageOut.text = "段 " + (stg + 1);
                var drv = getStageDriverNode(stg, trainNodes);
                if (drv) {
                    etM.text = String(drv.m);
                    etA.text = String(drv.alphaDeg);
                    etB.text = String(drv.backlash);
                }
            };

            etZs.onChanging = function () { updateParadoxCalculations(true); };
            etZp.onChanging = function () { updateParadoxCalculations(true); };
            etZr1.onChanging = function () { updateParadoxCalculations(false); };
            etZr2.onChanging = function () { updateParadoxCalculations(false); };
            etN.onChanging = function () { updateParadoxCalculations(false); };
            etM.onChanging = function () { updateParadoxCalculations(false); };
            etA.onChanging = function () { updateParadoxCalculations(false); };

            updateParadoxCalculations(false);

            var grpBtn = modal.add("group");
            grpBtn.orientation = "row";
            grpBtn.alignment = ["right", "center"];
            var btnCancel = grpBtn.add("button", undefined, "キャンセル");
            var btnOk = grpBtn.add("button", undefined, "輪列に追加 (Add)");

            btnCancel.onClick = function () { modal.close(0); };
            btnOk.onClick = function () {
                var curParent = parentNodesList[ddParent.selection.index];
                var zs = parseInt(etZs.text, 10) || 24;
                var zp = parseInt(etZp.text, 10) || 18;
                var zr1 = parseInt(etZr1.text, 10) || (zs + 2 * zp);
                var zr2 = parseInt(etZr2.text, 10) || (zr1 - 3);
                var n = parseInt(etN.text, 10) || 3;
                var m = parseFloat(etM.text) || 2.0;
                var aDeg = parseFloat(etA.text) || 20.0;
                var b = parseFloat(etB.text) || 0.15;
                var stage = parseInt(etStage.text, 10) || 1;
                var shaftS = parseFloat(etShaftSun.text) || 5.0;
                var shaftP = parseFloat(etShaftPlanet.text) || 4.0;
                var rimOffset = parseFloat(etRimOffset.text) || 16.0;
                var relType = curParent ? ((ddRelation.selection.index === 0) ? "COAXIAL" : "MESHING") : "ROOT";

                var alpha = aDeg * (Math.PI / 180.0);
                var a = (m * (zs + zp)) / 2.0;
                var a0_2 = (m * (zr2 - zp)) / 2.0;
                var cosAw2 = (a0_2 / a) * Math.cos(alpha);
                var xr2Val = 0.0;
                if (cosAw2 > 0.0 && cosAw2 <= 1.0) {
                    var aw2 = Math.acos(cosAw2);
                    var invAlpha = Math.tan(alpha) - alpha;
                    var invAw2 = Math.tan(aw2) - aw2;
                    xr2Val = (zr2 - zp) * (invAw2 - invAlpha) / (2.0 * Math.tan(alpha));
                }

                var prefix = "PDX" + (trainNodes.length + 1) + "_";

                var pdxNodes = InvoluteMath.expandParadoxicalToNodes({
                    m: m,
                    zs: zs,
                    zp: zp,
                    zr1: zr1,
                    zr2: zr2,
                    numPlanets: n,
                    alphaDeg: aDeg,
                    backlash: b,
                    xr2: xr2Val,
                    shaftDiameterSun: shaftS,
                    shaftDiameterPlanet: shaftP,
                    rimDiameter1: (m * zr1) + rimOffset,
                    rimDiameter2: (m * zr2) + rimOffset,
                    parentId: curParent ? curParent.id : null,
                    relationType: relType,
                    stageIndex: stage,
                    idPrefix: prefix
                });

                for (var i = 0; i < pdxNodes.length; i++) {
                    syncNodeProperties(pdxNodes[i]);
                    trainNodes.push(pdxNodes[i]);
                }

                modal.close(1);
                refreshTrainList(pdxNodes[0].id);
                updatePreview();
            };

            modal.show();
        }

        btnAddIntermittent.onClick = function () {
            showAddIntermittentModal();
        };

        btnAddPlanetary.onClick = function () {
            showAddPlanetaryModal();
        };

        btnAddParadox.onClick = function () {
            showAddParadoxModal();
        };

        btnDeleteNode.onClick = function () {
            if (!trainNodes || trainNodes.length === 0) return;
            if (!trainListBox.selection) return;
            var delIdx = trainListBox.selection.index;
            if (delIdx < 0 || delIdx >= trainNodes.length || !trainNodes[delIdx]) return;
            var delId = trainNodes[delIdx].id;

            for (var i = 0; i < trainNodes.length; i++) {
                if (trainNodes[i].parentId === delId) {
                    trainNodes[i].parentId = trainNodes[delIdx].parentId;
                    trainNodes[i].relationType = trainNodes[delIdx].relationType;
                }
            }
            trainNodes.splice(delIdx, 1);
            if (trainNodes.length > 0) {
                var nextSelectId = trainNodes[Math.min(delIdx, trainNodes.length - 1)].id;
                refreshTrainList(nextSelectId);
            } else {
                refreshTrainList(null);
            }
            updatePreview();
        };

        btnImportCSV.onClick = function () {
            try {
                var f = File.openDialog(
                    "輪列定義CSV/TSVファイルを選択",
                    "CSV/TSVファイル:*.csv;*.tsv;*.txt;すべてのファイル:*.*"
                );
                if (!f) return;
                f.encoding = "UTF-8";
                if (!f.open("r")) {
                    alert("ファイルを開けませんでした: " + f.fsName);
                    return;
                }
                var content = f.read();
                f.close();

                var parsedResult = parseTrainCSV(content);
                if (!parsedResult.success) {
                    alert("CSVの読み込みに失敗しました:\n" + parsedResult.error);
                    return;
                }

                if (parsedResult.nodes.length === 0) {
                    alert("有効な歯車データが見つかりませんでした。");
                    return;
                }

                trainNodes = parsedResult.nodes;
                refreshTrainList(trainNodes[0].id);
                updatePreview();
                alert("CSV/TSVから " + trainNodes.length + " 個の歯車を正常に読み込みました。");
            } catch (eCsv) {
                alert("CSV読込エラー: " + eCsv.message);
            }
        };

        // Mechanism type switching dummy (always branched gear train)
        function switchMechanism(idx) {}// Rescan Circles Handler
        btnRescan.onClick = function () {
            doRescan();
        };
        rbSourceSelection.onClick = function () { doRescan(); };
        rbSourceAllLayers.onClick = function () { doRescan(); };

        function doRescan() {
            var fromAll = rbSourceAllLayers.value;
            selectedCircles = scanCircles(fromAll);
            selectedCircleInfo = (selectedCircles.length > 0) ? selectedCircles[0] : null;

            var txt = "";
            if (selectedCircles.length === 0) {
                txt = "(\u5186\u306f\u691c\u51fa\u3055\u308c\u3066\u3044\u307e\u305b\u3093)";
                chkUseCircle.value = false;
                chkUseCircle.enabled = false;
                rowCircle2.enabled = false; rowCircle3.enabled = false;
                grpMultiCircle.enabled = false;
                btnAutoBuildTrain.enabled = false;
            } else if (selectedCircles.length === 1) {
                txt = "\u691c\u51fa: 1\u500b (\u76f4\u5f84 " + selectedCircles[0].diameterMm + " mm)";
                chkUseCircle.enabled = true;
                rowCircle2.enabled = true; rowCircle3.enabled = true;
                grpMultiCircle.enabled = false;
                btnAutoBuildTrain.enabled = false;
            } else {
                txt = "\u691c\u51fa: " + selectedCircles.length + "\u500b (\u8f2a\u5217\u81ea\u52d5\u69cb\u7bc9\u53ef\u80fd)";
                chkUseCircle.enabled = true;
                rowCircle2.enabled = true; rowCircle3.enabled = true;
                grpMultiCircle.enabled = true;
                btnAutoBuildTrain.enabled = true;
            }
            lblCircleStatus.text = txt;
            syncPlacementEnabled();
        }

        // Auto build train from circles button
        btnAutoBuildTrain.onClick = function () {
            if (selectedCircles.length < 2) return;
            var mVal = parseFloat(etModule.text) || 2.0;
            var alphaVal = parseFloat(etAlpha.text) || 20.0;
            var backlashVal = parseFloat(etBacklash.text) || 0.15;
            var tolMm = parseFloat(etTolerance.text) || 2.5;

            var topology = InvoluteMath.analyzeCircleTopology(selectedCircles, {
                m: mVal,
                alphaDeg: alphaVal,
                backlash: backlashVal,
                toleranceMm: tolMm,
                interpretation: rbCircleTip.value ? "tip" : "pitch",
                snapMode: (ddSnapMode.selection && ddSnapMode.selection.index === 1) ? "snap_theory" : "exact_position",
                allowCrossLayerMeshing: chkCrossLayerMesh.value
            });

            if (topology && topology.nodes && topology.nodes.length > 0) {
                trainNodes = topology.nodes;
                refreshTrainList(trainNodes[0].id);
                updatePreview();
                alert("\u5186\u30aa\u30d6\u30b8\u30a8\u30af\u30c8\u304b\u3089 " + trainNodes.length + " \u500b\u306e\u30ae\u30a2\u8f2a\u5217\u30c4\u30ea\u30fc\u3092\u69cb\u7bc9\u3057\u307e\u3057\u305f\u3002");
            }
        };

        rbCircleOrigPos.onClick = function () { syncPlacementEnabled(); };
        rbCircleCustomPos.onClick = function () { syncPlacementEnabled(); };

        btnUpdatePlacementCoords.onClick = function () {
            var doc = null;
            try { if (app.documents.length > 0) doc = app.activeDocument; } catch (e) {}
            if (!doc || !doc.artboards || doc.artboards.length === 0) return;
            var abIdx = (typeof doc.artboards.getActiveArtboardIndex === "function") ? doc.artboards.getActiveArtboardIndex() : 0;
            if (abIdx < 0 || abIdx >= doc.artboards.length) abIdx = 0;
            var abRect = doc.artboards[abIdx].artboardRect;
            if (!abRect) return;
            var abWidthPt = abRect[2] - abRect[0];
            var abHeightPt = abRect[1] - abRect[3];

            var selIdx = ddPlacementRef.selection ? ddPlacementRef.selection.index : 0;
            if (selIdx === 2) {
                etTargetX.text = ((abWidthPt / 2.0) * PT_TO_MM).toFixed(2);
                etTargetY.text = ((abHeightPt / 2.0) * PT_TO_MM).toFixed(2);
            } else if (selIdx === 3) {
                if (doc.selection && doc.selection.length > 0) {
                    var sItem = doc.selection[0];
                    var sX = sItem.left + sItem.width / 2.0;
                    var sY = sItem.top - sItem.height / 2.0;
                    etTargetX.text = ((sX - abRect[0]) * PT_TO_MM).toFixed(2);
                    etTargetY.text = ((abRect[1] - sY) * PT_TO_MM).toFixed(2);
                }
            }
        };

        function updatePreview() {
            var m = parseFloat(etModule.text) || 2.0;
            if (!trainNodes || trainNodes.length === 0) {
                lblCalcSummary.text = "輪列ノード: 0 個 (ギアを追加してください)";
            } else {
                lblCalcSummary.text = "輪列ノード: " + trainNodes.length + " 個 | 標準モジュール: " + m;
            }
        }// ==========================================
        // Common Action Footer
        // ==========================================
        var grpBtns = win.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["fill", "bottom"];
        grpBtns.spacing = 8;

        var btnShowLog = grpBtns.add("button", undefined, "\u30ed\u30b0\u95b2\u89a7...");
        btnShowLog.onClick = function () {
            if (typeof CalcLogger !== "undefined") {
                CalcLogger.showLogWindow("\u8a08\u7b97\u904e\u7a0b\u30ed\u30b0");
            }
        };

        var btnResetToDefaults = grpBtns.add("button", undefined, "\u57fa\u672c\u8a2d\u5b9a\u304b\u3089\u521d\u671f\u5316");
        btnResetToDefaults.helpTip = "\u57fa\u672c\u8a2d\u5b9a\u30bf\u30d6\u306e\u5024\u3092\u4f5c\u6210\u30bf\u30d6\u306e\u5404\u30ae\u30a2\u3078\u518d\u9069\u7528\u3057\u307e\u3059";
        btnResetToDefaults.onClick = function () {
            var defM = parseFloat(etModule.text) || 2.0;
            var defAlpha = parseFloat(etAlpha.text) || 20.0;
            var defShaft = parseFloat(etDefShaft.text) || 5.0;
            var defShaftType = ddDefShaftType.selection ? ddDefShaftType.selection.text : "\u4e38\u7a74";
            for (var t = 0; t < trainNodes.length; t++) {
                trainNodes[t].m = defM;
                trainNodes[t].alphaDeg = defAlpha;
                trainNodes[t].shaftDiameter = defShaft;
                trainNodes[t].shaftType = defShaftType;
            }
            refreshTrainList(trainNodes[0] ? trainNodes[0].id : null);
            updatePreview();
            alert("\u57fa\u672c\u8a2d\u5b9a\u306e\u5024 (m=" + defM + ", \u03b1=" + defAlpha + "\u00b0, \u8ef8=" + defShaft + "mm) \u3092\u5168\u30ae\u30a2\u3078\u53cd\u6620\u3057\u307e\u3057\u305f\u3002");
        };

        var spacerFooter = grpBtns.add("group");
        spacerFooter.alignment = ["fill", "fill"];

        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        btnOk = grpBtns.add("button", undefined, "\u6b6f\u8eca\u3092\u63cf\u753b (Generate)", { name: "ok" });

        btnCancel.onClick = function () {
            try {
                saveLocalSettings(getCurrentPreferencesObject());
            } catch (ePrefSave) {}
            win.close();
        };

        btnOk.onClick = function () {
            try {
                var m = parseFloat(etModule.text);
                var alphaDeg = parseFloat(etAlpha.text);
                var backlash = parseFloat(etBacklash.text) || 0;
if (isNaN(m) || m <= 0) {
                    alert("\u6709\u52b9\u306a\u30e2\u30b8\u30e5\u30fc\u30eb(>0)\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                var pathQuality = "bezier_recommended";
                if (ddQuality.selection) {
                    if (ddQuality.selection.index === 1) {
                        pathQuality = "bezier_minimal";
                    } else if (ddQuality.selection.index === 2) {
                        pathQuality = "polyline";
                    }
                }

                var cutStrokeWidth = (currentStyles && currentStyles.cut) ? (currentStyles.cut.strokeWidthPt * PT_TO_MM) : 0.5;
                var guideStrokeWidth = (currentStyles && currentStyles.pitchGuide) ? (currentStyles.pitchGuide.strokeWidthPt * PT_TO_MM) : 0.25;

                var circleFate = "guide";
                if (ddCircleFate.selection) {
                    if (ddCircleFate.selection.index === 1) circleFate = "delete";
                    else if (ddCircleFate.selection.index === 2) circleFate = "keep";
                }

                var namingConfig = {
                    mainLayer: etTemplateMain.text || "{train}",
                    subLayer: etTemplateSub.text || "{train}_{layer}",
                    dwgLayer: etTemplateDwg.text || "{train}_dwg",
                    gearGroup: etTemplateGear.text || "{id}_{kind}_z{z}"
                };

                var snapMode = "exact_position";
                if (ddSnapMode && ddSnapMode.selection) {
                    if (ddSnapMode.selection.index === 1) snapMode = "snap_theory";
                    else if (ddSnapMode.selection.index === 2) snapMode = "free";
                }

                var circleItems = [];
                for (var c = 0; c < selectedCircles.length; c++) {
                    if (selectedCircles[c].item) circleItems.push(selectedCircles[c].item);
                }

                var placementRef = "g1";
                if (rbCircleOrigPos && rbCircleOrigPos.value) {
                    placementRef = "original";
                } else if (ddPlacementRef && ddPlacementRef.selection) {
                    if (ddPlacementRef.selection.index === 1) placementRef = "bbox";
                    else if (ddPlacementRef.selection.index === 2) placementRef = "artboard";
                    else if (ddPlacementRef.selection.index === 3) placementRef = "selection";
                    else placementRef = "g1";
                }
                var targetXmm = parseFloat(etTargetX.text) || 0;
                var targetYmm = parseFloat(etTargetY.text) || 0;

                var isSkelPerStage = (typeof rbSkelPerStage !== "undefined" && rbSkelPerStage && rbSkelPerStage.value);
                var isSkelSingle = (typeof rbSkelSingle !== "undefined" && rbSkelSingle && rbSkelSingle.value);

                var commonParams = {
                    m: m,
                    alphaDeg: alphaDeg,
                    backlash: backlash,
                    pathQuality: pathQuality,
                    cutStrokeWidth: cutStrokeWidth,
                    guideStrokeWidth: guideStrokeWidth,
                    currentStyles: currentStyles,
                    createCompound: (typeof chkCompound !== "undefined" && chkCompound) ? chkCompound.value : true,
                    outputIndividualTeeth: (typeof chkIndividualTeeth !== "undefined" && chkIndividualTeeth) ? chkIndividualTeeth.value : false,
                    pitchSameLayer: (typeof chkPitchSameLayer !== "undefined" && chkPitchSameLayer) ? chkPitchSameLayer.value : false,
                    centerSameGroup: (typeof chkCenterSameGroup !== "undefined" && chkCenterSameGroup) ? chkCenterSameGroup.value : false,
                    drawText: (typeof chkText !== "undefined" && chkText) ? chkText.value : true,
                    skelMode: isSkelPerStage ? "per_stage" : "single",
                    skelSingleLayer: isSkelSingle,
                    skelPerStageLayer: isSkelPerStage,
                    drawGuides: (typeof chkPitchSameLayer !== "undefined" && chkPitchSameLayer) ? (chkPitchSameLayer.value || chkCenterSameGroup.value) : true,
                    useSelectedCircle: (typeof chkUseCircle !== "undefined" && chkUseCircle) ? chkUseCircle.value : false,
                    selectedCircleItem: selectedCircleInfo ? selectedCircleInfo.item : null,
                    selectedCircleItems: circleItems,
                    circleFate: circleFate,
                    circleCenterPt: (trainNodes && trainNodes.length > 0 && trainNodes[0].centerPt) ? trainNodes[0].centerPt : (selectedCircleInfo ? selectedCircleInfo.centerPt : null),
                    placementRef: placementRef,
                    targetXmm: targetXmm,
                    targetYmm: targetYmm,
                    trainId: (typeof etTrainId !== "undefined" && etTrainId && etTrainId.text) ? etTrainId.text : "T1",
                    drawDwgLayer: (isSkelSingle || isSkelPerStage),
                    naming: namingConfig,
                    snapMode: snapMode,
                    allowCrossLayerMeshing: (typeof chkCrossLayerMesh !== "undefined" && chkCrossLayerMesh) ? chkCrossLayerMesh.value : false,
                    keepExactCenterPositions: (circleItems.length > 0 && (snapMode === "exact_position" || snapMode === "free")),
                    recordLog: (typeof chkRecordLog !== "undefined" && chkRecordLog) ? chkRecordLog.value : false,
                    logFolder: (typeof etLogFolder !== "undefined" && etLogFolder) ? etLogFolder.text : ""
                };

                var payload = null;

                // Unified branched gear train execution
                if (!trainNodes || trainNodes.length === 0) {
                    alert("輪列にギアが追加されていません。\n[+ 外歯車追加] や [+ 間欠歯車ペア追加] などのボタンからギアを作成してください。");
                    return;
                }
                    if (!trainNodes || trainNodes.length === 0) {
                        alert("\u8f2a\u5217\u306b\u306f\u6700\u4f4e1\u3064\u306e\u30ae\u30a2\u304c\u5fc5\u8981\u3067\u3059\u3002");
                        return;
                    }

                    // Check duplicate train layer in document
                    var currentTrainId = (etTrainId && etTrainId.text) ? etTrainId.text.replace(/[\s\/\:\*\?"\<\>\|]/g, "") : "T1";
                    if (!currentTrainId) currentTrainId = "T1";

                    var targetLayerName = InvoluteMath.formatName(namingConfig.mainLayer, {
                        train: currentTrainId,
                        m: m
                    });

                    var doc = null;
                    try {
                        if (app.documents.length > 0) doc = app.activeDocument;
                    } catch (e) {}

                    if (doc) {
                        var layerExists = false;
                        for (var ly = 0; ly < doc.layers.length; ly++) {
                            if (doc.layers[ly].name === targetLayerName || doc.layers[ly].name === currentTrainId) {
                                layerExists = true;
                                break;
                            }
                        }

                        if (layerExists) {
                            var dupDlg = new Window("dialog", "\u8f2a\u5217ID\u306e\u91cd\u8907\u78ba\u8a8d");
                            dupDlg.orientation = "column";
                            dupDlg.alignChildren = ["fill", "top"];
                            dupDlg.spacing = 12;
                            dupDlg.margins = 16;

                            var msgTxt = "\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u5185\u306b\u8f2a\u5217 '" + currentTrainId + "' \u306e\u30ec\u30a4\u30e4\u30fc ('" + targetLayerName + "') \u304c\u65e2\u306b\u5b58\u5728\u3057\u307e\u3059\u3002\n\n" +
                                "\u4f5c\u56f3\u65b9\u6cd5\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\uff1a\n" +
                                "\u30fb\u3010\u4e0a\u66f8\u304d\u3011: \u65e2\u5b58\u30ec\u30a4\u30e4\u30fc\u5185\u306e\u30a2\u30a4\u30c6\u30e0\u30fb\u4e0b\u4f4d\u30ec\u30a4\u30e4\u30fc\u3092\u5168\u524a\u9664\u3057\u3001\u65b0\u898f\u4f5c\u56f3\u3057\u307e\u3059\u3002\n" +
                                "\u30fb\u3010\u6df7\u5728\u3011: \u65e2\u5b58\u306e\u8f2a\u5217\u30ec\u30a4\u30e4\u30fc\u3092\u6b8b\u3057\u305f\u307e\u307e\u3001\u65b0\u3057\u3044\u30ae\u30a2\u3092\u8ffd\u52a0\u4f5c\u56f3\u3057\u307e\u3059\u3002\n" +
                                "\u30fb\u3010\u30ad\u30e3\u30f3\u30bb\u30eb\u3011: \u4f5c\u56f3\u3092\u4e2d\u65ad\u3057\u3001\u7de8\u96c6\u753b\u9762\u306b\u623b\u308a\u307e\u3059\uff08\u8f2a\u5217ID\u306e\u5909\u66f4\u304c\u53ef\u80fd\u3067\u3059\uff09\u3002";
                            var stMsg = dupDlg.add("statictext", undefined, msgTxt, { multiline: true });
                            stMsg.preferredSize.width = 440;

                            var grpDupBtns = dupDlg.add("group");
                            grpDupBtns.orientation = "row";
                            grpDupBtns.alignment = "right";
                            grpDupBtns.spacing = 8;

                            var btnOverwrite = grpDupBtns.add("button", undefined, "\u4e0a\u66f8\u304d (\u65e2\u5b58\u524a\u9664 & \u518d\u63cf\u753b)");
                            var btnCoexist = grpDupBtns.add("button", undefined, "\u6df7\u5728 (\u65e2\u5b58\u306b\u8ffd\u52a0)");
                            var btnCancelDup = grpDupBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });

                            var dupChoice = "cancel";
                            btnOverwrite.onClick = function () {
                                dupChoice = "overwrite";
                                dupDlg.close();
                            };
                            btnCoexist.onClick = function () {
                                dupChoice = "coexist";
                                dupDlg.close();
                            };
                            btnCancelDup.onClick = function () {
                                dupChoice = "cancel";
                                dupDlg.close();
                            };

                            dupDlg.show();

                            if (dupChoice === "cancel") {
                                return;
                            } else if (dupChoice === "overwrite") {
                                commonParams.overwriteLayer = true;
                            } else {
                                commonParams.overwriteLayer = false;
                            }
                        }
                    }

                    payload = {
                        mechanismType: "branched",
                        nodes: trainNodes
                    };

                // Auto-save preferences to local storage on draw
                try {
                    saveLocalSettings(getCurrentPreferencesObject());
                } catch (ePrefSave) {}

                win.close();

                if (onGenerate && payload) {
                    for (var key in commonParams) {
                        if (commonParams.hasOwnProperty(key)) {
                            payload[key] = commonParams[key];
                        }
                    }
                    onGenerate(payload);
                }
            } catch (err) {
                alert("\u30ae\u30a2\u751f\u6210\u306e\u524d\u51e6\u7406\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + err.message + "\n(Line " + err.line + ")");
            }
        };

        // Auto-load local preferences on startup
        try {
            loadLocalSettings(function (profile) {
                applyPreferencesObject(profile);
            });
        } catch (ePrefLoad) {}

        refreshTrainList(null);
        updatePreview();
        win.layout.layout(true);
        if (win.layout && typeof win.layout.resize === "function") {
            win.layout.resize();
        }

        win.onClose = function () {
            try {
                saveLocalSettings(getCurrentPreferencesObject());
            } catch (eCloseSave) {}
            return true;
        };

        win.show();
    }

    return {
        show: show
    };
})();

/**
 * MainController.jsxinc - Main Execution Dispatcher for Adobe Illustrator
 * Version: 0.9.37
 * Part of GearDrawer Architecture
 */

var MainController = (function () {
    var _version = "0.9.37";

    function run(version) {
        if (version) _version = version;

        if (app.documents.length === 0) {
            alert("\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u304c\u958b\u304b\u308c\u3066\u3044\u307e\u305b\u3093\u3002\n\u65b0\u898f\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u4f5c\u6210\u3057\u3066\u304b\u3089\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
            return;
        }

        var doc = app.activeDocument;

        // Pre-flight check & auto-exit for Isolation Mode
        try {
            if (typeof PathBuilder !== "undefined" && typeof PathBuilder.ensureExitIsolationMode === "function") {
                PathBuilder.ensureExitIsolationMode(doc);
            }
        } catch (eIsoInit) {}

        DialogView.show(function (params) {
            if (typeof CalcLogger !== "undefined") {
                CalcLogger.setEnabled(params.recordLog);
                CalcLogger.setVersion(_version);
                CalcLogger.log("MAIN", "GearDrawer execution initiated", {
                    mechanismType: params.mechanismType,
                    m: params.m,
                    alphaDeg: params.alphaDeg,
                    backlash: params.backlash,
                    recordLog: params.recordLog,
                    logFolder: params.logFolder
                });
            }

            try {
                // Ensure isolation mode is exited before layer operations
                try {
                    if (typeof PathBuilder !== "undefined" && typeof PathBuilder.ensureExitIsolationMode === "function") {
                        PathBuilder.ensureExitIsolationMode(doc);
                    }
                } catch (eIsoDraw) {}

                // Ensure document active layer is unlocked
                try {
                    if (doc.activeLayer && doc.activeLayer.locked) {
                        doc.activeLayer.locked = false;
                    }
                    if (doc.activeLayer && !doc.activeLayer.visible) {
                        doc.activeLayer.visible = true;
                    }
                } catch (eALInit) {}

                var isIndTeeth = (params.outputIndividualTeeth === true || params.individualTeeth === true);
                var options = {
                    drawMode: isIndTeeth ? "test_teeth" : (params.drawMode || "normal"),
                    outputIndividualTeeth: isIndTeeth,
                    individualTeeth: isIndTeeth,
                    cutStrokeWidth: params.cutStrokeWidth,
                    guideStrokeWidth: params.guideStrokeWidth,
                    currentStyles: params.currentStyles,
                    createCompound: params.createCompound,
                    pitchSameLayer: params.pitchSameLayer,
                    centerSameGroup: params.centerSameGroup,
                    drawGuides: (params.drawGuides !== undefined) ? params.drawGuides : true,
                    drawText: (params.drawText !== undefined) ? params.drawText : true,
                    skelMode: params.skelMode || "single",
                    skelSingleLayer: params.skelSingleLayer,
                    skelPerStageLayer: params.skelPerStageLayer,
                    baseOrigin: (params.useSelectedCircle && params.circleCenterPt) ? params.circleCenterPt : null,
                    placementRef: params.placementRef || "original",
                    targetXmm: (params.targetXmm !== undefined) ? params.targetXmm : 0,
                    targetYmm: (params.targetYmm !== undefined) ? params.targetYmm : 0,
                    trainId: params.trainId || "T1",
                    overwriteLayer: (params.overwriteLayer === true),
                    drawDwgLayer: (params.drawDwgLayer !== undefined) ? params.drawDwgLayer : true,
                    naming: params.naming
                };

                // Handle original selected circles if applicable
                if (params.useSelectedCircle && params.selectedCircleItems && params.selectedCircleItems.length > 0) {
                    PathBuilder.handleSelectedCircles(params.selectedCircleItems, params.circleFate);
                } else if (params.useSelectedCircle && params.selectedCircleItem) {
                    PathBuilder.handleSelectedCircles(params.selectedCircleItem, params.circleFate);
                }

                if (params.mechanismType === "spur") {
                    // 1. Spur Gear Pair
                    var gear1Data = InvoluteMath.calculateSpurGear({
                        m: params.m,
                        z: params.z1,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        shaftDiameter: params.g1Hole,
                        useFillet: true,
                        rcFactor: 0.38,
                        pathQuality: params.pathQuality
                    });

                    var gear2Data = InvoluteMath.calculateSpurGear({
                        m: params.m,
                        z: params.z2,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        shaftDiameter: params.g2Hole,
                        useFillet: true,
                        rcFactor: 0.38,
                        pathQuality: params.pathQuality
                    });

                    var meshing = InvoluteMath.calculateMeshingPair(
                        params.m,
                        params.z1,
                        params.z2,
                        params.angleDeg || 0,
                        0
                    );

                    PathBuilder.drawMeshingPair(doc, {
                        gear1Data: gear1Data,
                        gear2Data: gear2Data,
                        meshing: meshing,
                        options: options
                    });

                } else if (params.mechanismType === "rack") {
                    // 2. Rack & Pinion
                    var pinionData = InvoluteMath.calculateSpurGear({
                        m: params.m,
                        z: params.zp,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        shaftDiameter: params.shaftDiameter,
                        useFillet: true,
                        rcFactor: 0.38,
                        pathQuality: params.pathQuality
                    });

                    var rackData = InvoluteMath.calculateRack({
                        m: params.m,
                        numTeeth: params.numTeethRack,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        rackHeight: params.rackHeight,
                        useFillet: true
                    });

                    var rackMeshing = InvoluteMath.calculateRackMeshing(
                        params.m,
                        params.zp,
                        params.numTeethRack,
                        0.0
                    );

                    PathBuilder.drawRackAndPinionPair(doc, {
                        pinionData: pinionData,
                        rackData: rackData,
                        rackMeshing: rackMeshing,
                        options: options
                    });

                } else if (params.mechanismType === "internal") {
                    // 3. Internal Gear Pair
                    var pinionData = InvoluteMath.calculateSpurGear({
                        m: params.m,
                        z: params.zp,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        shaftDiameter: params.shaftDiameter,
                        useFillet: true,
                        rcFactor: 0.38,
                        pathQuality: params.pathQuality
                    });

                    var internalData = InvoluteMath.calculateInternalGear({
                        m: params.m,
                        z: params.zr,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        rimThickness: params.rimThickness,
                        pathQuality: params.pathQuality
                    });

                    var internalMeshing = InvoluteMath.calculateInternalMeshing(
                        params.m,
                        params.zp,
                        params.zr,
                        params.contactAngleDeg !== undefined ? params.contactAngleDeg : -90.0,
                        0.0
                    );

                    PathBuilder.drawInternalMeshingPair(doc, {
                        pinionData: pinionData,
                        internalData: internalData,
                        internalMeshing: internalMeshing,
                        options: options
                    });

                } else if (params.mechanismType === "planetary") {
                    // 4. Standard 2K-H Planetary
                    var planetaryData = InvoluteMath.calculateStandardPlanetary({
                        m: params.m,
                        zs: params.zs,
                        zp: params.zp,
                        zr: params.zr,
                        numPlanets: params.numPlanets,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        rimThickness: params.rimThickness,
                        pathQuality: params.pathQuality
                    });

                    PathBuilder.drawStandardPlanetary(doc, planetaryData, options);

                } else if (params.mechanismType === "paradoxical") {
                    // 5. 3K Paradoxical Planetary
                    var paradoxData = InvoluteMath.calculateParadoxicalPlanetary({
                        m: params.m,
                        zs: params.zs,
                        zp: params.zp,
                        zr1: params.zr1,
                        zr2: params.zr2,
                        numPlanets: params.numPlanets,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        rimThickness: params.rimThickness,
                        pathQuality: params.pathQuality
                    });

                    PathBuilder.drawParadoxicalPlanetary(doc, paradoxData, options);
                } else if (params.mechanismType === "branched") {
                    // 6. Branched Gear Train
                    var trainData = InvoluteMath.calculateBranchedGearTrain({
                        m: params.m,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        pathQuality: params.pathQuality,
                        nodes: params.nodes,
                        snapMode: params.snapMode,
                        keepExactCenterPositions: params.keepExactCenterPositions
                    });

                    PathBuilder.drawBranchedGearTrain(doc, trainData, options);
                } else if (params.mechanismType === "intermittent") {
                    // 7. Intermittent Gear Pair
                    var intNodes = params.nodes;
                    if (!intNodes && params.intermittentSpec) {
                        intNodes = InvoluteMath.expandIntermittentPairToNodes(params.intermittentSpec);
                    }
                    var trainData = InvoluteMath.calculateBranchedGearTrain({
                        m: params.m,
                        alphaDeg: params.alphaDeg,
                        backlash: params.backlash,
                        pathQuality: params.pathQuality,
                        nodes: intNodes,
                        snapMode: "snap_theory"
                    });

                    PathBuilder.drawBranchedGearTrain(doc, trainData, options);
                }

                // Redraw screen
                try { if (app && typeof app.redraw === "function") app.redraw(); } catch (eR) {}

                if (typeof CalcLogger !== "undefined") {
                    CalcLogger.log("MAIN", "Gear generation completed successfully");
                    if (params.recordLog) {
                        var exportedPath = CalcLogger.exportToFile(params.logFolder);
                        var successMsg = "\u6b6f\u8eca\u306e\u63cf\u753b\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002";
                        if (exportedPath) {
                            successMsg += "\n\n\u3010\u8a08\u7b97\u30ed\u30b0\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3011\n" + exportedPath;
                        }
                        alert(successMsg);
                    }
                }

            } catch (e) {
                if (typeof CalcLogger !== "undefined") {
                    CalcLogger.error("MAIN", "Fatal error during gear generation", e);
                    var errLogPath = CalcLogger.exportToFile(params.logFolder);
                    var errMsg = "\u6b6f\u8eca\u306e\u751f\u6210\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + e.message + "\n(Line " + e.line + ")";
                    if (errLogPath) {
                        errMsg += "\n\n\u3010\u30a8\u30e9\u30fc\u5831\u544a\u7528\u8a08\u7b97\u30ed\u30b0\u3092\u81ea\u52d5\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3011\n" + errLogPath;
                    }
                    alert(errMsg);
                    CalcLogger.showLogWindow("\u30a8\u30e9\u30fc\u5831\u544a\u7528 \u8a08\u7b97\u30ed\u30b0", "\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002\u4ee5\u4e0b\u306e\u30ed\u30b0\u3092\u30b3\u30d4\u30fc\u3057\u3066\u5831\u544a\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                } else {
                    alert("\u6b6f\u8eca\u306e\u751f\u6210\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + e.message + "\n(Line " + e.line + ")");
                }
            }
        });
    }

    return {
        run: run,
        getVersion: function () { return _version; }
    };
})();

MainController.run('0.9.37');
