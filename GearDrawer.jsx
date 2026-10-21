/**
 * GearDrawer - Involute Spur Gear Generator for Adobe Illustrator
 * Version: 0.2.0
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

/**
 * InvoluteMath.jsxinc - GearDrawer Geometry Calculation Engine
 * Version: 0.2.0
 * 
 * Provides 100% mathematically pure involute spur gear calculations
 * compliant with JIS B 1701 standards:
 * - Pure involute flank curve (no kerf in math)
 * - True generating trochoid root fillet (rigorous rack cutter envelope)
 * - Dynamic undercut support with exact mathematical intersection
 * - Cubic Bezier anchor optimization (Recommended: 8-10 pts/tooth, Minimal: 6 pts/tooth)
 * - Smooth C1 continuity with true tangent vector fitting
 * - Correct meshing phase alignment (tooth-to-space conjugate action)
 * - Independent segment extraction (tip arc, involutes, trochoid fillets, root circle)
 */

var InvoluteMath = (function () {
    var MM_TO_PT = 72 / 25.4; // 1 mm = 2.83464567 pt

    /**
     * Involute function: inv(alpha) = tan(alpha) - alpha
     */
    function inv(alphaRad) {
        return Math.tan(alphaRad) - alphaRad;
    }

    /**
     * Dynamic undercut limit tooth count
     * z_min = 2 / (sin(alpha)^2)
     */
    function getUndercutLimit(alphaRad) {
        var sinA = Math.sin(alphaRad);
        return 2.0 / (sinA * sinA);
    }

    /**
     * Calculate tooth profile coordinates and Bezier nodes for a spur gear.
     * 
     * @param {Object} params
     *   - m: Module (mm)
     *   - z: Number of teeth
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
        var alphaDeg = params.alphaDeg || 20;
        var alpha = alphaDeg * (Math.PI / 180.0);
        var backlash = params.backlash || 0.0;
        var shaftDiameter = params.shaftDiameter || 0.0;
        var useFillet = (params.useFillet !== false);
        var rcFactor = params.rcFactor || 0.38;
        var pathQuality = params.pathQuality || "bezier_recommended"; // "bezier_recommended" | "bezier_minimal" | "polyline"

        // Pure standard dimensions (mm) - JIS B 1701-1
        var d = m * z;
        var db = d * Math.cos(alpha);
        var da = m * (z + 2.0);
        var df = m * (z - 2.5);

        var rp = d / 2.0;
        var rb = db / 2.0;
        var ra = da / 2.0;
        var rf = df / 2.0;

        // Effective tooth thickness on pitch circle considering backlash
        var s_eff = (Math.PI * m / 2.0) - backlash;
        var psi_p = s_eff / (2.0 * rp); // Half-tooth angle on pitch circle

        var invAlpha = inv(alpha);

        // --- 1. Involute function for right flank (r >= rb) ---
        function getInvolutePoint(r) {
            var cosA = Math.min(1.0, rb / Math.max(rb, r));
            var alphaR = Math.acos(cosA);
            var invR = inv(alphaR);
            var theta = psi_p + invAlpha - invR;

            var dr_dth;
            if (alphaR < 1e-4) {
                dr_dth = 0;
            } else {
                dr_dth = -rb / (Math.sin(alphaR) * Math.cos(alphaR));
            }
            var dx = dr_dth * Math.cos(theta) - r * Math.sin(theta);
            var dy = dr_dth * Math.sin(theta) + r * Math.cos(theta);
            var len = Math.sqrt(dx * dx + dy * dy);
            var tx = (len > 1e-9) ? -dx / len : 0;
            var ty = (len > 1e-9) ? -dy / len : 1;

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
        var vc = hk - rc;
        var w = (Math.PI * m - s_eff) / 2.0;
        var uc = w - vc * Math.tan(alpha) - rc * (1.0 - Math.sin(alpha)) / Math.cos(alpha);

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
            // Unit tangent along curve towards junction (increasing r):
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

        // --- 3. Determine exact junction between Fillet and Involute ---
        var phi_a = phi_root;
        var phi_b = phi_root - (50.0 * Math.PI / 180.0);
        var searchSteps = 1000;

        var prevDiff = null;
        var prevPhi = null;
        var junctionPhi = phi_root;
        var junctionR = rf;

        if (useFillet) {
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
        }

        var z_min = 2.0 / (Math.sin(alpha) * Math.sin(alpha));
        var isUndercut = (z < z_min);

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

        // Tip Arc Segment
        var dThTip = 2.0 * pRightTip.theta;
        var L_tip = (4.0 / 3.0) * ra * Math.tan(dThTip / 4.0);
        var pLeftTip = { x: pRightTip.x, y: -pRightTip.y };

        var tipArcSeg = {
            P0: pLeftTip,
            P1: { x: pLeftTip.x + L_tip * Math.sin(pRightTip.theta), y: pLeftTip.y + L_tip * Math.cos(pRightTip.theta) },
            P2: { x: pRightTip.x + L_tip * Math.sin(pRightTip.theta), y: pRightTip.y - L_tip * Math.cos(pRightTip.theta) },
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
            rightDirection: [tipArcSeg.P1.x, tipArcSeg.P1.y],
            pointType: "CORNER"
        });

        // Right Tip Corner:
        var lastRInv = rightInvSegs[rightInvSegs.length - 1];
        singleToothNodes.push({
            anchor: [pRightTip.x, pRightTip.y],
            leftDirection: [tipArcSeg.P2.x, tipArcSeg.P2.y],
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
        var L_root = (4.0 / 3.0) * rf * Math.tan(dThRoot / 4.0);

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
        for (var ts = 0; ts <= 3; ts++) {
            var tipAngle = -pRightTip.theta + (2.0 * pRightTip.theta) * (ts / 3.0);
            tipArcAcross.push({ r: ra, theta: tipAngle, x: ra * Math.cos(tipAngle), y: ra * Math.sin(tipAngle) });
        }

        var singleToothCombined = [];
        for (var i = 0; i < leftFilletUp.length; i++) singleToothCombined.push(leftFilletUp[i]);
        for (var i = 1; i < leftInvoluteUp.length; i++) singleToothCombined.push(leftInvoluteUp[i]);
        for (var i = 1; i < tipArcAcross.length - 1; i++) singleToothCombined.push(tipArcAcross[i]);
        for (var i = 0; i < rightInvoluteDown.length; i++) singleToothCombined.push(rightInvoluteDown[i]);
        for (var i = 1; i < rightFilletDown.length; i++) singleToothCombined.push(rightFilletDown[i]);

        var outerPoints = [];
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

        var holeRadius = (shaftDiameter > 0) ? (shaftDiameter / 2.0) : 0;

        return {
            m: m,
            z: z,
            alphaDeg: alphaDeg,
            pathQuality: pathQuality,
            pitchDiameter: d,
            baseDiameter: db,
            tipDiameter: da,
            rootDiameter: df,
            pitchRadiusPt: rp * MM_TO_PT,
            baseRadiusPt: rb * MM_TO_PT,
            tipRadiusPt: ra * MM_TO_PT,
            rootRadiusPt: rf * MM_TO_PT,
            holeRadiusPt: holeRadius * MM_TO_PT,
            hasHole: holeRadius > 0,
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

    return {
        MM_TO_PT: MM_TO_PT,
        getUndercutLimit: getUndercutLimit,
        calculateSpurGear: calculateSpurGear,
        calculateMeshingPair: calculateMeshingPair
    };
})();

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

    function getOrCreateLayer(doc, layerName) {
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                return doc.layers[i];
            }
        }
        var newLayer = doc.layers.add();
        newLayer.name = layerName;
        return newLayer;
    }

    function createRGBColor(r, g, b) {
        var col = new RGBColor();
        col.red = r;
        col.green = g;
        col.blue = b;
        return col;
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
            if (nd.pointType === "CORNER") {
                pt.pointType = PointType.CORNER;
            } else {
                pt.pointType = PointType.SMOOTH;
            }
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
     * Draw a single gear into Illustrator
     */
    function drawGear(doc, targetLayer, center, gearData, rotationDeg, gearName, options) {
        var mode = (options && options.drawMode) || "normal"; // "normal" | "test_teeth" | "test_disassembled"
        var cutColor = createRGBColor(255, 0, 0);          // Red
        var rootColor = createRGBColor(0, 100, 220);       // Blue for root circle
        var tipArcColor = createRGBColor(0, 180, 220);     // Cyan for tip arc
        var involuteColor = createRGBColor(220, 0, 180);   // Magenta for involute
        var filletColor = createRGBColor(255, 140, 0);     // Orange for trochoid fillet
        var guideColor = createRGBColor(0, 150, 0);        // Green for pitch circle
        var textColor = createRGBColor(0, 0, 0);

        var gearGroup = targetLayer.groupItems.add();
        gearGroup.name = gearName + (mode !== "normal" ? (" [" + mode + "]") : "");

        var rotOffsetRad = (rotationDeg || 0) * (Math.PI / 180);
        var toothPitchAngle = (2.0 * Math.PI) / gearData.z;

        if (mode === "normal") {
            // === 1. Normal Mode: Closed full gear contour ===
            var outerPath = gearGroup.pathItems.add();
            outerPath.name = gearName + "_Contour";

            if (gearData.pathQuality !== "polyline" && gearData.outerNodes && gearData.outerNodes.length > 0) {
                // Bezier curve contour (Recommended or Minimal)
                applyBezierNodes(outerPath, gearData.outerNodes, center, rotOffsetRad, 1.0);
            } else {
                // Polyline contour fallback
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
            outerPath.stroked = true;
            outerPath.strokeColor = cutColor;
            outerPath.strokeWidth = 0.5;
            outerPath.filled = false;

        } else if (mode === "test_teeth") {
            // === 2. Test Mode: Single tooth x z (connected per tooth) + root circle ===
            var teethGroup = gearGroup.groupItems.add();
            teethGroup.name = gearName + "_IndividualTeeth";

            for (var t = 0; t < gearData.z; t++) {
                var toothRot = rotOffsetRad + (t * toothPitchAngle);
                var toothPath = teethGroup.pathItems.add();
                toothPath.name = gearName + "_Tooth_" + (t + 1);

                if (gearData.pathQuality !== "polyline" && gearData.singleToothNodes && gearData.singleToothNodes.length > 0) {
                    // Bezier single tooth profile
                    applyBezierNodes(toothPath, gearData.singleToothNodes, center, toothRot, MM_TO_PT);
                } else {
                    // Polyline single tooth profile
                    var toothPts = transformPoints(gearData.singleToothCombined, center, toothRot);
                    setPathCoords(toothPath, toothPts);
                }

                toothPath.closed = false; // Open tooth profile
                toothPath.stroked = true;
                toothPath.strokeColor = cutColor;
                toothPath.strokeWidth = 0.5;
                toothPath.filled = false;
            }

            // Dedicated Root Circle (Dedendum Circle)
            var rootCircle = gearGroup.pathItems.ellipse(
                center[1] + gearData.rootRadiusPt,
                center[0] - gearData.rootRadiusPt,
                gearData.rootRadiusPt * 2,
                gearData.rootRadiusPt * 2
            );
            rootCircle.name = gearName + "_RootCircle_df" + gearData.rootDiameter.toFixed(1);
            rootCircle.stroked = true;
            rootCircle.strokeColor = rootColor;
            rootCircle.strokeWidth = 0.5;
            rootCircle.filled = false;

        } else if (mode === "test_disassembled") {
            // === 3. Test Mode (Disassembled): Tip arc, Involutes, Fillets as raw independent paths ===
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
                pTip.stroked = true;
                pTip.strokeColor = tipArcColor;
                pTip.strokeWidth = 0.75;
                pTip.filled = false;

                // B. Left Involute
                var leftInvPts = transformPoints(segs.leftInvolute, center, tRot);
                var pLInv = singleToothGroup.pathItems.add();
                pLInv.name = "LeftInvolute";
                setPathCoords(pLInv, leftInvPts);
                pLInv.stroked = true;
                pLInv.strokeColor = involuteColor;
                pLInv.strokeWidth = 0.5;
                pLInv.filled = false;

                // C. Right Involute
                var rightInvPts = transformPoints(segs.rightInvolute, center, tRot);
                var pRInv = singleToothGroup.pathItems.add();
                pRInv.name = "RightInvolute";
                setPathCoords(pRInv, rightInvPts);
                pRInv.stroked = true;
                pRInv.strokeColor = involuteColor;
                pRInv.strokeWidth = 0.5;
                pRInv.filled = false;

                // D. Left Trochoid Fillet
                var leftFilletPts = transformPoints(segs.leftFillet, center, tRot);
                var pLFil = singleToothGroup.pathItems.add();
                pLFil.name = "LeftTrochoidFillet";
                setPathCoords(pLFil, leftFilletPts);
                pLFil.stroked = true;
                pLFil.strokeColor = filletColor;
                pLFil.strokeWidth = 0.5;
                pLFil.filled = false;

                // E. Right Trochoid Fillet
                var rightFilletPts = transformPoints(segs.rightFillet, center, tRot);
                var pRFil = singleToothGroup.pathItems.add();
                pRFil.name = "RightTrochoidFillet";
                setPathCoords(pRFil, rightFilletPts);
                pRFil.stroked = true;
                pRFil.strokeColor = filletColor;
                pRFil.strokeWidth = 0.5;
                pRFil.filled = false;
            }

            // Dedicated Root Circle
            var rootCircleD = gearGroup.pathItems.ellipse(
                center[1] + gearData.rootRadiusPt,
                center[0] - gearData.rootRadiusPt,
                gearData.rootRadiusPt * 2,
                gearData.rootRadiusPt * 2
            );
            rootCircleD.name = gearName + "_RootCircle_df" + gearData.rootDiameter.toFixed(1);
            rootCircleD.stroked = true;
            rootCircleD.strokeColor = rootColor;
            rootCircleD.strokeWidth = 0.5;
            rootCircleD.filled = false;
        }

        // 4. Draw shaft hole (independent circle path)
        if (gearData.hasHole && gearData.holeRadiusPt > 0) {
            var hr = gearData.holeRadiusPt;
            var holePath = gearGroup.pathItems.ellipse(
                center[1] + hr,
                center[0] - hr,
                hr * 2,
                hr * 2
            );
            holePath.name = gearName + "_ShaftHole";
            holePath.stroked = true;
            holePath.strokeColor = cutColor;
            holePath.strokeWidth = 0.5;
            holePath.filled = false;
        }

        // 5. Draw Pitch Circle & Crosshair Guides
        if (options && options.drawGuides) {
            var guideGroup = gearGroup.groupItems.add();
            guideGroup.name = gearName + "_Guides";

            var pr = gearData.pitchRadiusPt;
            var pitchCircle = guideGroup.pathItems.ellipse(
                center[1] + pr,
                center[0] - pr,
                pr * 2,
                pr * 2
            );
            pitchCircle.name = "PitchCircle_d" + gearData.pitchDiameter.toFixed(1);
            pitchCircle.stroked = true;
            pitchCircle.strokeColor = guideColor;
            pitchCircle.strokeWidth = 0.5;
            pitchCircle.strokeDashes = [4, 4];
            pitchCircle.filled = false;

            var crossLen = Math.min(pr * 0.4, 15);
            var hLine = guideGroup.pathItems.add();
            hLine.setEntirePath([
                [center[0] - crossLen, center[1]],
                [center[0] + crossLen, center[1]]
            ]);
            hLine.stroked = true;
            hLine.strokeColor = guideColor;
            hLine.strokeWidth = 0.5;

            var vLine = guideGroup.pathItems.add();
            vLine.setEntirePath([
                [center[0], center[1] - crossLen],
                [center[0], center[1] + crossLen]
            ]);
            vLine.stroked = true;
            vLine.strokeColor = guideColor;
            vLine.strokeWidth = 0.5;
        }

        // 6. Draw specifications label
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
        var layer = getOrCreateLayer(doc, "GearDrawer");

        var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var abRect = artboard.artboardRect;
        var abWidth = abRect[2] - abRect[0];
        var abHeight = abRect[1] - abRect[3];

        var g1Center = [abRect[0] + abWidth / 2 - params.meshing.gear2OffsetX / 2, abRect[1] - abHeight / 2 - params.meshing.gear2OffsetY / 2];
        var g2Center = [g1Center[0] + params.meshing.gear2OffsetX, g1Center[1] + params.meshing.gear2OffsetY];

        var g1Group = drawGear(
            doc,
            layer,
            g1Center,
            params.gear1Data,
            params.meshing.gear1RotationDeg,
            "Gear_1_z" + params.gear1Data.z,
            params.options
        );

        var g2Group = drawGear(
            doc,
            layer,
            g2Center,
            params.gear2Data,
            params.meshing.gear2RotationDeg,
            "Gear_2_z" + params.gear2Data.z,
            params.options
        );

        var pairGroup = layer.groupItems.add();
        pairGroup.name = "GearPair_m" + params.gear1Data.m + "_z" + params.gear1Data.z + "x" + params.gear2Data.z;
        g1Group.moveToBeginning(pairGroup);
        g2Group.moveToBeginning(pairGroup);

        return pairGroup;
    }

    return {
        getOrCreateLayer: getOrCreateLayer,
        drawGear: drawGear,
        drawMeshingPair: drawMeshingPair
    };
})();

/**
 * DialogView.jsxinc - GearDrawer ScriptUI Dialog
 * Version: 0.2.0
 * 
 * Provides an intuitive parameter input dialog with real-time
 * calculation updates, anchor quality selection (Recommended Bezier / Minimal Bezier / Polyline),
 * and drawing mode selection (Normal / Test Teeth / Test Disassembled).
 * All UI labels are Unicode-escaped for 100% environment compatibility.
 */

var DialogView = (function () {
    function show(onGenerate) {
        var win = new Window("dialog", "GearDrawer v0.2.0 - Meshing Gear Generator");
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        // --- Common Parameters Panel ---
        // \u57fa\u672c\u4ed5\u69d8 (Common Parameters)
        var pnlCommon = win.add("panel", undefined, "\u57fa\u672c\u4ed5\u69d8 (Common Parameters)");
        pnlCommon.orientation = "row";
        pnlCommon.alignChildren = ["left", "center"];
        pnlCommon.spacing = 15;
        pnlCommon.margins = 12;

        // \u30e2\u30b8\u30e5\u30fc\u30eb (m):
        pnlCommon.add("statictext", undefined, "\u30e2\u30b8\u30e5\u30fc\u30eb (m):");
        var etModule = pnlCommon.add("edittext", undefined, "2.0");
        etModule.characters = 5;

        // \u5727\u529b\u89d2 (deg):
        pnlCommon.add("statictext", undefined, "\u5727\u529b\u89d2 (deg):");
        var etAlpha = pnlCommon.add("edittext", undefined, "20");
        etAlpha.characters = 5;

        // --- Gears Panel (Gear 1 & Gear 2) ---
        // \u6b6f\u8eca\u69cb\u6210 (Gear Pair Configuration)
        var pnlGears = win.add("panel", undefined, "\u6b6f\u8eca\u69cb\u6210 (Gear Pair Configuration)");
        pnlGears.orientation = "row";
        pnlGears.alignChildren = ["fill", "top"];
        pnlGears.spacing = 15;
        pnlGears.margins = 12;

        // Gear 1
        var grpG1 = pnlGears.add("group");
        grpG1.orientation = "column";
        grpG1.alignChildren = ["left", "top"];
        grpG1.spacing = 6;
        // \u3010\u30ae\u30a2 1 (\u539f\u52d5)\u3011
        grpG1.add("statictext", undefined, "\u3010\u30ae\u30a2 1 (\u539f\u52d5)\u3011").graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.1, 0.4, 0.8, 1], 1);

        var rowG1Z = grpG1.add("group");
        // \u6b6f\u6570 (z1):
        rowG1Z.add("statictext", undefined, "\u6b6f\u6570 (z1):");
        var etG1Z = rowG1Z.add("edittext", undefined, "18");
        etG1Z.characters = 6;

        var rowG1Hole = grpG1.add("group");
        // \u8ef8\u7a74\u5f84 (mm):
        rowG1Hole.add("statictext", undefined, "\u8ef8\u7a74\u5f84 (mm):");
        var etG1Hole = rowG1Hole.add("edittext", undefined, "5.0");
        etG1Hole.characters = 6;

        // Gear 2
        var grpG2 = pnlGears.add("group");
        grpG2.orientation = "column";
        grpG2.alignChildren = ["left", "top"];
        grpG2.spacing = 6;
        // \u3010\u30ae\u30a2 2 (\u5f93\u52d5)\u3011
        grpG2.add("statictext", undefined, "\u3010\u30ae\u30a2 2 (\u5f93\u52d5)\u3011").graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.8, 0.4, 0.1, 1], 1);

        var rowG2Z = grpG2.add("group");
        // \u6b6f\u6570 (z2):
        rowG2Z.add("statictext", undefined, "\u6b6f\u6570 (z2):");
        var etG2Z = rowG2Z.add("edittext", undefined, "36");
        etG2Z.characters = 6;

        var rowG2Hole = grpG2.add("group");
        // \u8ef8\u7a74\u5f84 (mm):
        rowG2Hole.add("statictext", undefined, "\u8ef8\u7a74\u5f84 (mm):");
        var etG2Hole = rowG2Hole.add("edittext", undefined, "5.0");
        etG2Hole.characters = 6;

        // --- Output & Drawing Mode Panel ---
        // \u63cf\u753b\u30e2\u30fc\u30c9 / \u30c6\u30b9\u30c8\u51fa\u529b (Drawing Mode)
        var pnlMode = win.add("panel", undefined, "\u63cf\u753b\u30e2\u30fc\u30c9 / \u30c6\u30b9\u30c8\u51fa\u529b (Drawing Mode)");
        pnlMode.orientation = "column";
        pnlMode.alignChildren = ["left", "top"];
        pnlMode.spacing = 6;
        pnlMode.margins = 12;

        // \u901a\u5e38\u30e2\u30fc\u30c9 (\u5168\u9023\u7d50\u30fb\u5b9f\u52d5\u30af\u30ed\u30fc\u30ba\u30c9\u30d1\u30b9)
        var rbNormal = pnlMode.add("radiobutton", undefined, "\u901a\u5e38\u30e2\u30fc\u30c9 (\u5168\u9023\u7d50\u30fb\u5b9f\u52d5\u30af\u30ed\u30fc\u30ba\u30c9\u30d1\u30b9)");
        rbNormal.value = true;

        // \u30c6\u30b9\u30c8\u30e2\u30fc\u30c9 (\u5358\u4f53\u306e\u6b6f\u00d7\u6b6f\u6570 + \u6b6f\u5143\u5186 + \u8ef8\u7a74 \u3092\u72ec\u7acb\u51fa\u529b)
        var rbTestTeeth = pnlMode.add("radiobutton", undefined, "\u30c6\u30b9\u30c8\u30e2\u30fc\u30c9 (\u5358\u4f53\u306e\u6b6f\u00d7\u6b6f\u6570 + \u6b6f\u5143\u5186 + \u8ef8\u7a74 \u3092\u72ec\u7acb\u51fa\u529b)");

        // \u5206\u89e3\u30c6\u30b9\u30c8 (\u6b6f\u5148\u5186\u5f27\u30fb\u30a4\u30f3\u30dc\u30ea\u30e5\u30fc\u30c8\u30fb\u9685\u8089\u66f2\u7dda\u3092\u672a\u9023\u7d50\u3067\u5b8c\u5168\u5206\u89e3\u51fa\u529b)
        var rbTestDis = pnlMode.add("radiobutton", undefined, "\u5206\u89e3\u30c6\u30b9\u30c8 (\u6b6f\u5148\u5186\u5f27\u30fb\u30a4\u30f3\u30dc\u30ea\u30e5\u30fc\u30c8\u30fb\u9685\u8089\u66f2\u7dda\u3092\u672a\u9023\u7d50\u3067\u5b8c\u5168\u5206\u89e3\u51fa\u529b)");

        // --- Path Quality & Anchor Mode Panel ---
        // \u30d1\u30b9\u7cbe\u5ea6\u30fb\u30a2\u30f3\u30ab\u30fc\u69cb\u6210 (Path Quality & Anchors)
        var pnlQuality = win.add("panel", undefined, "\u30d1\u30b9\u7cbe\u5ea6\u30fb\u30a2\u30f3\u30ab\u30fc\u69cb\u6210 (Path Quality & Anchors)");
        pnlQuality.orientation = "row";
        pnlQuality.alignChildren = ["left", "center"];
        pnlQuality.spacing = 15;
        pnlQuality.margins = 12;

        // \u66f2\u7dda\u69cb\u6210:
        pnlQuality.add("statictext", undefined, "\u66f2\u7dda\u69cb\u6210:");
        var ddQuality = pnlQuality.add("dropdownlist", undefined, [
            "\u9ad8\u7cbe\u5ea6\u30d9\u30b8\u30a7 [\u63a8\u5968] (8-10\u70b9/\u6b6f)",
            "\u6700\u5c0f\u30d9\u30b8\u30a7 [\u69cb\u6210B] (6\u70b9/\u6b6f)",
            "\u9ad8\u5bc6\u5ea6\u30dd\u30ea\u30e9\u30a4\u30f3 [\u5f93\u6765] (~25\u70b9/\u6b6f)"
        ]);
        ddQuality.selection = 0; // Default: Recommended Bezier

        // --- Laser Fabrication Adjustments ---
        // \u5b9f\u52d5\u52a0\u5de5\u8abf\u6574 (Fabrication & Options)
        var pnlFab = win.add("panel", undefined, "\u5b9f\u52d5\u52a0\u5de5\u8abf\u6574 (Fabrication & Options)");
        pnlFab.orientation = "column";
        pnlFab.alignChildren = ["fill", "top"];
        pnlFab.spacing = 8;
        pnlFab.margins = 12;

        var rowFab1 = pnlFab.add("group");
        rowFab1.orientation = "row";
        rowFab1.alignChildren = ["left", "center"];
        rowFab1.spacing = 15;

        // \u30d0\u30c3\u30af\u30e9\u30c3\u30b7 (mm):
        rowFab1.add("statictext", undefined, "\u30d0\u30c3\u30af\u30e9\u30c3\u30b7 (mm):");
        var etBacklash = rowFab1.add("edittext", undefined, "0.15");
        etBacklash.characters = 5;

        // \u914d\u7f6e\u89d2\u5ea6 (deg):
        rowFab1.add("statictext", undefined, "\u914d\u7f6e\u89d2\u5ea6 (deg):");
        var etAngle = rowFab1.add("edittext", undefined, "0");
        etAngle.characters = 5;

        var rowFab2 = pnlFab.add("group");
        rowFab2.orientation = "row";
        rowFab2.alignChildren = ["left", "center"];
        rowFab2.spacing = 15;

        // \u6b6f\u5143\u9685\u8089\u66f2\u7dda(\u30c8\u30ed\u30b3\u30a4\u30c9)\u3092\u751f\u6210
        var chkFillet = rowFab2.add("checkbox", undefined, "\u6b6f\u5143\u9685\u8089\u66f2\u7dda(\u30c8\u30ed\u30b3\u30a4\u30c9)\u3092\u751f\u6210");
        chkFillet.value = true;

        // \u30d4\u30c3\u30c1\u5186\u30fb\u4e2d\u5fc3\u30ac\u30a4\u30c9\u3092\u63cf\u753b
        var chkGuides = rowFab2.add("checkbox", undefined, "\u30d4\u30c3\u30c1\u5186\u30fb\u4e2d\u5fc3\u30ac\u30a4\u30c9\u3092\u63cf\u753b");
        chkGuides.value = true;

        // \u4ed5\u69d8\u30e9\u30d9\u30eb\u30c6\u30ad\u30b9\u30c8\u5370\u5b57
        var chkText = rowFab2.add("checkbox", undefined, "\u4ed5\u69d8\u30e9\u30d9\u30eb\u30c6\u30ad\u30b9\u30c8\u5370\u5b57");
        chkText.value = true;

        // --- Real-time Calculation Summary ---
        // \u8a08\u7b97\u30d7\u30ec\u30d3\u30e5\u30fc (Calculation Preview)
        var pnlCalc = win.add("panel", undefined, "\u8a08\u7b97\u30d7\u30ec\u30d3\u30e5\u30fc (Calculation Preview)");
        pnlCalc.orientation = "column";
        pnlCalc.alignChildren = ["left", "top"];
        pnlCalc.margins = 12;
        pnlCalc.spacing = 4;

        // \u4e2d\u5fc3\u8ddd\u96e2 a: --- mm
        var lblCenterDist = pnlCalc.add("statictext", undefined, "\u4e2d\u5fc3\u8ddd\u96e2 a: --- mm");
        // \u6e1b\u901f\u6bd4 i: ---
        var lblRatio = pnlCalc.add("statictext", undefined, "\u6e1b\u901f\u6bd4 i: ---");
        // \u63a8\u5b9a\u30a2\u30f3\u30ab\u30fc\u6570: ---
        var lblAnchors = pnlCalc.add("statictext", undefined, "\u63a8\u5b9a\u30a2\u30f3\u30ab\u30fc\u6570: ---");
        var lblWarning = pnlCalc.add("statictext", undefined, "");
        lblWarning.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.8, 0.1, 0.1, 1], 1);

        function updatePreview() {
            var m = parseFloat(etModule.text);
            var alphaDeg = parseFloat(etAlpha.text);
            var z1 = parseInt(etG1Z.text, 10);
            var z2 = parseInt(etG2Z.text, 10);

            if (!isNaN(m) && !isNaN(z1) && !isNaN(z2) && z1 > 0 && z2 > 0) {
                var a = m * (z1 + z2) / 2.0;
                var ratio = (z2 / z1).toFixed(2);
                lblCenterDist.text = "\u4e2d\u5fc3\u8ddd\u96e2 a: " + a.toFixed(2) + " mm  |  G1 PCD: " + (m * z1).toFixed(1) + " mm  |  G2 PCD: " + (m * z2).toFixed(1) + " mm";
                lblRatio.text = "\u6e1b\u901f\u6bd4 i: " + ratio + " (1 : " + ratio + ")";

                var alphaRad = (isNaN(alphaDeg) ? 20 : alphaDeg) * (Math.PI / 180);
                var zMin = InvoluteMath.getUndercutLimit(alphaRad);

                var qIdx = ddQuality.selection ? ddQuality.selection.index : 0;
                var g1Pts, g2Pts;
                if (qIdx === 1) { // Minimal (6 pts/tooth)
                    g1Pts = 6 * z1;
                    g2Pts = 6 * z2;
                } else if (qIdx === 2) { // Polyline (~25 pts/tooth)
                    g1Pts = 25 * z1;
                    g2Pts = 25 * z2;
                } else { // Recommended (8-10 pts/tooth)
                    g1Pts = (z1 < zMin ? 10 : 8) * z1;
                    g2Pts = (z2 < zMin ? 10 : 8) * z2;
                }
                lblAnchors.text = "\u63a8\u5b9a\u30a2\u30f3\u30ab\u30fc\u6570: G1: ~" + g1Pts + "\u70b9 / G2: ~" + g2Pts + "\u70b9";

                var warnings = [];
                if (z1 < zMin) {
                    warnings.push("\u30ae\u30a21 \u5207\u4e0b\u3052\u6ce8\u610f (z1=" + z1 + " < \u9650\u754c" + zMin.toFixed(1) + ")");
                }
                if (z2 < zMin) {
                    warnings.push("\u30ae\u30a22 \u5207\u4e0b\u3052\u6ce8\u610f (z2=" + z2 + " < \u9650\u754c" + zMin.toFixed(1) + ")");
                }
                lblWarning.text = warnings.length > 0 ? ("! " + warnings.join(", ")) : "\u5e7e\u4f55\u5b66\u5e72\u6e09: \u306a\u3057 (\u6b63\u5e38)";
            }
        }

        etModule.onChanging = updatePreview;
        etAlpha.onChanging = updatePreview;
        etG1Z.onChanging = updatePreview;
        etG2Z.onChanging = updatePreview;
        ddQuality.onChange = updatePreview;

        updatePreview();

        // --- Action Buttons ---
        var grpBtns = win.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = "right";
        var btnCancel = grpBtns.add("button", undefined, "\u30ad\u30e3\u30f3\u30bb\u30eb", { name: "cancel" });
        var btnOk = grpBtns.add("button", undefined, "\u6b6f\u8eca\u3092\u63cf\u753b (Generate)", { name: "ok" });

        btnCancel.onClick = function () {
            win.close();
        };

        btnOk.onClick = function () {
            var m = parseFloat(etModule.text);
            var alphaDeg = parseFloat(etAlpha.text);
            var z1 = parseInt(etG1Z.text, 10);
            var z2 = parseInt(etG2Z.text, 10);
            var g1Hole = parseFloat(etG1Hole.text) || 0;
            var g2Hole = parseFloat(etG2Hole.text) || 0;
            var backlash = parseFloat(etBacklash.text) || 0;
            var angleDeg = parseFloat(etAngle.text) || 0;

            if (isNaN(m) || m <= 0 || isNaN(z1) || z1 < 3 || isNaN(z2) || z2 < 3) {
                alert("\u6709\u52b9\u306a\u30e2\u30b8\u30e5\u30fc\u30eb(>0)\u304a\u3088\u3073\u6b6f\u6570(>=3)\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                return;
            }

            var drawMode = "normal";
            if (rbTestTeeth.value) {
                drawMode = "test_teeth";
            } else if (rbTestDis.value) {
                drawMode = "test_disassembled";
            }

            var pathQuality = "bezier_recommended";
            if (ddQuality.selection) {
                if (ddQuality.selection.index === 1) {
                    pathQuality = "bezier_minimal";
                } else if (ddQuality.selection.index === 2) {
                    pathQuality = "polyline";
                }
            }

            win.close();

            if (onGenerate) {
                onGenerate({
                    m: m,
                    alphaDeg: alphaDeg,
                    z1: z1,
                    z2: z2,
                    g1Hole: g1Hole,
                    g2Hole: g2Hole,
                    backlash: backlash,
                    angleDeg: angleDeg,
                    drawMode: drawMode,
                    pathQuality: pathQuality,
                    useFillet: chkFillet.value,
                    drawGuides: chkGuides.value,
                    drawText: chkText.value
                });
            }
        };

        win.show();
    }

    return {
        show: show
    };
})();


// --- Main Execution Controller ---
(function main() {
    if (app.documents.length === 0) {
        // Document not open alert
        alert("\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u304c\u958b\u304b\u308c\u3066\u3044\u307e\u305b\u3093\u3002\n\u65b0\u898f\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u4f5c\u6210\u3057\u3066\u304b\u3089\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
        return;
    }

    var doc = app.activeDocument;

    DialogView.show(function (params) {
        try {
            // 1. Calculate Gear 1 geometry (Pure mathematical calculations)
            var gear1Data = InvoluteMath.calculateSpurGear({
                m: params.m,
                z: params.z1,
                alphaDeg: params.alphaDeg,
                backlash: params.backlash,
                shaftDiameter: params.g1Hole,
                useFillet: params.useFillet,
                rcFactor: 0.38,
                pathQuality: params.pathQuality
            });

            // 2. Calculate Gear 2 geometry (Pure mathematical calculations)
            var gear2Data = InvoluteMath.calculateSpurGear({
                m: params.m,
                z: params.z2,
                alphaDeg: params.alphaDeg,
                backlash: params.backlash,
                shaftDiameter: params.g2Hole,
                useFillet: params.useFillet,
                rcFactor: 0.38,
                pathQuality: params.pathQuality
            });

            // 3. Calculate meshing distance and rotation phase
            var meshing = InvoluteMath.calculateMeshingPair(
                params.m,
                params.z1,
                params.z2,
                params.angleDeg,
                0 // Gear 1 initial angle
            );

            // 4. Draw to active document
            PathBuilder.drawMeshingPair(doc, {
                gear1Data: gear1Data,
                gear2Data: gear2Data,
                meshing: meshing,
                options: {
                    drawMode: params.drawMode,
                    drawGuides: params.drawGuides,
                    drawText: params.drawText
                }
            });

            // Redraw screen
            app.redraw();

        } catch (e) {
            // Error during generation
            alert("\u6b6f\u8eca\u306e\u751f\u6210\u4e2d\u306b\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f:\n" + e.message + "\n(Line " + e.line + ")");
        }
    });
})();