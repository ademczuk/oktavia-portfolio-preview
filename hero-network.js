/*
 * hero-network.js
 *
 * Faithful vanilla-JS port of the real Oktavia Portfolio hero, lifted from the
 * production React component src/components/hero-scene/living-network.tsx.
 *
 * The story-card scrubber (AgentReef anchors, onStory callback) is removed so
 * this is the ambient field only: a dense, slowly tumbling 3D oblate ball of
 * neurons on near-black navy, drawn across three depth-of-field-blurred canvases
 * (far / mid / near), with curved bezier dendrites, travelling photons on the
 * cell-body fans, pointer parallax, and scroll focus. Always animates (this
 * environment reports prefers-reduced-motion even when unset, so we do not gate
 * on it for a decorative hero).
 *
 * Wiring: expects a wrapper element #hero-net containing three canvases with ids
 * hn-far, hn-mid, hn-near. The script self-runs on load.
 */
(function () {
  "use strict";

  function boot() {
    var ACCENT = "#f4b942"; // production accent

    var wrap = document.getElementById("hero-net");
    var far = document.getElementById("hn-far");
    var mid = document.getElementById("hn-mid");
    var near = document.getElementById("hn-near");
    if (!wrap || !far || !mid || !near) return;

    var farCtx = far.getContext("2d");
    var midCtx = mid.getContext("2d");
    var nearCtx = near.getContext("2d");
    if (!farCtx || !midCtx || !nearCtx) return;

    // Always animate; calm/reduced-motion gate intentionally disabled.
    var calm = false;
    var CALM_MUL = 0.5;
    function motionMul() { return calm ? CALM_MUL : 1; }

    // Mobile tuning: the full engine (300+ nodes, three canvases, per-frame
    // bezier links and photons) can peg a phone's main thread and starve touch
    // input, so a tap on a button can be dropped. On a coarse pointer / narrow
    // screen we run a much lighter field: fewer nodes, ~30fps, and no photons.
    var IS_MOBILE =
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) ||
      Math.min(window.innerWidth, window.innerHeight) < 820;
    var FRAME_MS = IS_MOBILE ? 33 : 18;

    // ---- colour helpers ------------------------------------------------
    function hexToRgb(hex) {
      var v = hex.replace("#", "");
      if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
      var n = parseInt(v, 16);
      if (isNaN(n)) return { r: 244, g: 185, b: 66 };
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function mix(a, b, t) {
      return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
      };
    }
    function rgba(c, alpha) {
      return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + alpha + ")";
    }
    function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
    function ease(value) { var v = clamp(value, 0, 1); return v * v * (3 - 2 * v); }

    var baseRgb = hexToRgb(ACCENT);
    var white = { r: 255, g: 255, b: 255 };
    var black = { r: 0, g: 0, b: 0 };
    var secondaryRgb = mix(baseRgb, white, 0.42);
    var deepRgb = mix(baseRgb, black, 0.32);
    var navy = { r: 2, g: 5, b: 13 };
    var hotCore = { r: 255, g: 250, b: 240 };
    var photonRgb = mix(baseRgb, { r: 255, g: 246, b: 224 }, 0.7);

    // ---- bands ---------------------------------------------------------
    var bands = [
      { key: "far", ctx: farCtx, canvas: far, opacity: 0.5, parallax: 0.28, linkAlpha: 0.5, ox: 0, oy: 0 },
      { key: "mid", ctx: midCtx, canvas: mid, opacity: 0.8, parallax: 0.62, linkAlpha: 0.75, ox: 0, oy: 0 },
      { key: "near", ctx: nearCtx, canvas: near, opacity: 1, parallax: 1, linkAlpha: 1, ox: 0, oy: 0 },
    ];

    var nodes = [];
    var links = [];

    function buildGraph(w, h) {
      var area = w * h;
      var count = IS_MOBILE
        ? clamp(Math.round(area / 14000), 90, 150)
        : clamp(Math.round(area / 5400), 300, 520);
      var ballAspect = w / Math.max(1, h);
      var BALL_R = 1.05;
      var BALL_RY = 0.92;
      var next = [];
      for (var i = 0; i < count; i++) {
        var z = Math.random();
        var band = z < 0.34 ? 0 : z < 0.67 ? 1 : 2;
        var isFar = z < 0.34;
        var sizeBase = isFar ? 1.5 + Math.random() * 1.8 : 0.55 + Math.random() * 0.95;
        var depthScale = isFar ? 1.0 : 0.7 + z * 0.6;
        var periodMs = 12000 + Math.random() * 10000;
        var dirTheta = Math.random() * Math.PI * 2;
        var dirZ = Math.random() * 2 - 1;
        var dirXY = Math.sqrt(1 - dirZ * dirZ);
        var rad = Math.pow(Math.random(), 0.4);
        var sphX = dirXY * Math.cos(dirTheta) * rad * BALL_R;
        var sphY = dirXY * Math.sin(dirTheta) * rad * BALL_RY;
        var bx = 0.5 + sphX / ballAspect;
        var by = 0.5 + sphY;
        var nz = dirZ * rad * BALL_R;
        next.push({
          bx: bx, by: by, z: z, band: band,
          r: sizeBase * depthScale, r0: sizeBase,
          warm: Math.random() < 0.1, hub: false,
          phase: Math.random() * Math.PI * 2,
          driftAmp: 6 + Math.random() * 16,
          bright: 0.5 + Math.random() * 0.5,
          zSpeed: (Math.PI * 2) / periodMs,
          zPhase: Math.random() * Math.PI * 2,
          zAmp: 0.32 + Math.random() * 0.1,
          nz: nz,
        });
      }
      nodes = next;

      var aspect = w / Math.max(1, h);
      var n = next.length;

      var sx = new Float32Array(n);
      var sy = new Float32Array(n);
      var sz = new Float32Array(n);
      for (var a = 0; a < n; a++) {
        var na = next[a];
        sx[a] = (na.bx - 0.5) * ballAspect;
        sy[a] = na.by - 0.5;
        sz[a] = na.nz;
      }

      // centrality
      var centrality = new Array(n).fill(0);
      for (var ci = 0; ci < n; ci++) {
        var ni = next[ci];
        var acc = 0;
        for (var cj = 0; cj < n; cj++) {
          if (cj === ci) continue;
          var nj = next[cj];
          var dxc = (ni.bx - nj.bx) * aspect;
          var dyc = ni.by - nj.by;
          acc += 1 / (dxc * dxc + dyc * dyc + 0.0008);
        }
        centrality[ci] = acc;
      }

      // hubs
      var hubCount = clamp(Math.round(n / 38), 4, 8);
      var byCentral = Array.from({ length: n }, function (_v, idx) { return idx; })
        .sort(function (p, q) { return (centrality[q] || 0) - (centrality[p] || 0); });
      var hubIdx = [];
      for (var c = 0; c < byCentral.length && hubIdx.length < hubCount; c++) {
        var idx = byCentral[c];
        if (idx === undefined) continue;
        var cand = next[idx];
        var tooClose = false;
        for (var hh = 0; hh < hubIdx.length; hh++) {
          var hn = next[hubIdx[hh]];
          var dxh = (cand.bx - hn.bx) * aspect;
          var dyh = cand.by - hn.by;
          if (dxh * dxh + dyh * dyh < 0.02) { tooClose = true; break; }
        }
        if (tooClose) continue;
        hubIdx.push(idx);
        cand.hub = true;
        cand.warm = false;
        cand.r0 = cand.r0 * 2.8 + 2.2;
        cand.r = cand.r0 * (cand.z < 0.34 ? 1.0 : 0.7 + cand.z * 0.6);
        cand.bright = 0.92 + Math.random() * 0.08;
        cand.driftAmp = cand.driftAmp * 0.45;
        cand.nz = cand.nz * 0.6;
      }
      var isHub = new Set(hubIdx);

      // base k-NN mesh
      var built = [];
      var seen = new Set();

      function curveFor(i, j) {
        var sign = (i + j) % 2 === 0 ? 1 : -1;
        var hsh = ((i * 73856093) ^ (j * 19349663)) >>> 0;
        var mag = 0.1 + ((hsh % 1000) / 1000) * 0.12;
        return sign * mag;
      }

      function addLink(i, j, d) {
        var key = i < j ? i + ":" + j : j + ":" + i;
        if (seen.has(key)) return;
        seen.add(key);
        var ni = next[i];
        var nj = next[j];
        var band = ni.z < nj.z ? ni.band : nj.band;
        built.push({
          a: i, b: j, dist: d, band: band,
          phase: Math.random() * Math.PI * 2,
          curv: curveFor(i, j),
          hubLink: isHub.has(i) || isHub.has(j),
          speed: 0.7 + Math.random() * 0.8,
        });
      }

      for (var i2 = 0; i2 < n; i2++) {
        var nn = next[i2];
        var candList = [];
        for (var j2 = 0; j2 < n; j2++) {
          if (j2 === i2) continue;
          var dx = sx[i2] - sx[j2];
          var dy = sy[i2] - sy[j2];
          var dz = sz[i2] - sz[j2];
          candList.push({ j: j2, d: dx * dx + dy * dy + dz * dz });
        }
        candList.sort(function (p, q) { return p.d - q.d; });
        var k = nn.band === 2 ? 5 : nn.band === 1 ? 4 : 3;
        var lim = Math.min(k, candList.length);
        for (var cc = 0; cc < lim; cc++) {
          addLink(i2, candList[cc].j, Math.sqrt(candList[cc].d));
        }
      }

      // soma dendrite fans
      for (var hi2 = 0; hi2 < hubIdx.length; hi2++) {
        var hi = hubIdx[hi2];
        var candH = [];
        for (var j3 = 0; j3 < n; j3++) {
          if (j3 === hi) continue;
          var dxF = sx[hi] - sx[j3];
          var dyF = sy[hi] - sy[j3];
          var dzF = sz[hi] - sz[j3];
          candH.push({ j: j3, d: dxF * dxF + dyF * dyF + dzF * dzF });
        }
        candH.sort(function (p, q) { return p.d - q.d; });
        var fan = 8 + Math.floor(Math.random() * 6);
        var limF = Math.min(fan, candH.length);
        for (var cf = 0; cf < limF; cf++) {
          addLink(hi, candH[cf].j, Math.sqrt(candH[cf].d));
        }
      }

      links = built;
    }

    // ---- sizing --------------------------------------------------------
    var width = 0, height = 0, dpr = 1, lastBuiltW = 0, lastBuiltH = 0;
    function size(force) {
      if (!wrap) return;
      var rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var pw = Math.max(1, Math.floor(width * dpr));
      var ph = Math.max(1, Math.floor(height * dpr));
      for (var b = 0; b < bands.length; b++) {
        bands[b].canvas.width = pw;
        bands[b].canvas.height = ph;
        bands[b].ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      var wDelta = lastBuiltW > 0 ? Math.abs(width - lastBuiltW) / lastBuiltW : 1;
      var hDelta = lastBuiltH > 0 ? Math.abs(height - lastBuiltH) / lastBuiltH : 1;
      if (force || nodes.length === 0 || wDelta > 0.1 || hDelta > 0.1) {
        buildGraph(width, height);
        lastBuiltW = width;
        lastBuiltH = height;
      }
    }

    // ---- pointer + scroll ----------------------------------------------
    var pointer = { tx: 0, ty: 0, active: false };
    var scroll = 0, scrollFromWindow = false, ioProgress = 0;
    function onPointerMove(e) {
      var vw = Math.max(1, window.innerWidth);
      var vh = Math.max(1, window.innerHeight);
      pointer.tx = e.clientX / vw - 0.5;
      pointer.ty = e.clientY / vh - 0.5;
      pointer.active = true;
    }
    function onPointerLeave() { pointer.active = false; pointer.tx = 0; pointer.ty = 0; }
    function onScroll() {
      var span = Math.max(1, window.innerHeight * 2);
      var y = window.scrollY || window.pageYOffset || 0;
      if (y > 0) scrollFromWindow = true;
      scroll = clamp(y / span, 0, 1);
    }
    function computeIoProgress() {
      if (!wrap) return;
      var vh = Math.max(1, window.innerHeight);
      var rect = wrap.getBoundingClientRect();
      ioProgress = clamp(-rect.top / vh, 0, 1);
    }

    var visible = true, onScreen = true;
    function shouldRun() { return visible && onScreen; }
    function focusProgress() { return scrollFromWindow ? scroll : ioProgress; }

    // ---- background ----------------------------------------------------
    function paintBackground(now, sp) {
      var ctx = farCtx;
      var g0 = ctx.createLinearGradient(0, 0, 0, height);
      g0.addColorStop(0, "#02050d");
      g0.addColorStop(1, "#04070f");
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, width, height);

      var cx = width * (0.5 + (sp - 0.5) * 0.06);
      var cy = height * (0.46 + Math.sin(now * 0.00008) * 0.02);
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      glow.addColorStop(0, rgba(baseRgb, 0.14));
      glow.addColorStop(0.4, rgba(mix(baseRgb, navy, 0.5), 0.08));
      glow.addColorStop(1, "rgba(2, 5, 13, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      var vg = ctx.createRadialGradient(
        width * 0.5, height * 0.5, Math.min(width, height) * 0.35,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.72
      );
      vg.addColorStop(0, "rgba(0, 0, 0, 0)");
      vg.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
    }

    // ---- 3D tumble projection ------------------------------------------
    var ROTATION_PERIOD_MS = 270000;
    var ROT_SPEED = (Math.PI * 2) / ROTATION_PERIOD_MS;
    var TILT_X = 0.18;
    var COS_TILT = Math.cos(TILT_X);
    var SIN_TILT = Math.sin(TILT_X);
    var PERSP_CAMERA = 1.85;
    var DENOM_FLOOR = 0.25;
    var X_CONTRACT = 0.78;
    var Z_RANGE = 1.0;
    var Z_RESIDUAL = 0.03;
    function zResidual(n, now, mul) {
      return Math.sin(now * n.zSpeed + n.zPhase) * Z_RESIDUAL * mul;
    }
    function bandFromZ(z) { return z < 0.34 ? 0 : z < 0.67 ? 1 : 2; }
    function zFocus(z, sp) {
      var plane = 0.84 - sp * 0.68;
      var d = Math.abs(z - plane);
      return ease(1 - d * 1.9);
    }
    function boundaryEase(z) {
      var dEdge = Math.min(Math.abs(z - 0.34), Math.abs(z - 0.67));
      return 0.55 + 0.45 * ease(dEdge / 0.05);
    }
    function project3D(n, cosT, sinT, aspect) {
      var mx = (n.bx - 0.5) * aspect;
      var my = n.by - 0.5;
      var mz = n.nz;
      var x1 = mx * cosT + mz * sinT;
      var z1 = mz * cosT - mx * sinT;
      var y2 = my * COS_TILT - z1 * SIN_TILT;
      var z2 = my * SIN_TILT + z1 * COS_TILT;
      var denom = Math.max(DENOM_FLOOR, PERSP_CAMERA - z2);
      var persp = PERSP_CAMERA / denom;
      var bx = 0.5 + (x1 * persp * X_CONTRACT) / aspect;
      var by = 0.5 + y2 * persp * X_CONTRACT;
      var depth = clamp((z2 + Z_RANGE) / (2 * Z_RANGE), 0, 1);
      return { bx: bx, by: by, depth: depth, scale: persp };
    }
    function nodeXY(n, band, now, bx, by, zAnim, mul) {
      var ampScale = (0.7 + zAnim * 0.6) * mul;
      var sway = Math.sin(now * 0.00028 + n.phase) * n.driftAmp * ampScale;
      var lift = Math.cos(now * 0.00024 + n.phase * 1.3) * (n.driftAmp * 0.7 * ampScale);
      return { x: bx * width + sway + band.ox, y: by * height + lift + band.oy };
    }

    // ---- draw loop -----------------------------------------------------
    var raf = 0, last = -1;
    function drawFrame(now) {
      if (!midCtx || !nearCtx) return;
      if (last >= 0 && now - last < FRAME_MS) { raf = requestAnimationFrame(drawFrame); return; }
      last = now;

      var sp = focusProgress();
      var mul = motionMul();
      var ambientDim = 1; // no story scrubber: ambient field at full strength

      var reachX = calm ? 0 : Math.min(width * 0.05, 60);
      var reachY = calm ? 0 : Math.min(height * 0.05, 60);
      for (var bi = 0; bi < bands.length; bi++) {
        var band = bands[bi];
        var targetX = pointer.tx * reachX * band.parallax;
        var targetY = pointer.ty * reachY * band.parallax + (sp - 0.5) * height * 0.04 * band.parallax * mul;
        band.ox += (targetX - band.ox) * 0.06;
        band.oy += (targetY - band.oy) * 0.06;
      }

      paintBackground(now, sp);
      midCtx.clearRect(0, 0, width, height);
      nearCtx.clearRect(0, 0, width, height);

      var theta = now * ROT_SPEED * mul;
      var cosT = Math.cos(theta);
      var sinT = Math.sin(theta);
      var aspect = width / Math.max(1, height);

      var pos = new Array(nodes.length);
      var zAnimArr = new Array(nodes.length);
      var liveBand = new Array(nodes.length);
      var scaleArr = new Array(nodes.length);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var pr = project3D(n, cosT, sinT, aspect);
        var z = clamp(pr.depth + zResidual(n, now, mul), 0, 1);
        var lb = bandFromZ(z);
        zAnimArr[i] = z;
        liveBand[i] = lb;
        scaleArr[i] = pr.scale;
        pos[i] = nodeXY(n, bands[lb], now, pr.bx, pr.by, z, mul);
      }

      // links
      for (var li = 0; li < links.length; li++) {
        var link = links[li];
        var a = pos[link.a];
        var b = pos[link.b];
        if (!a || !b) continue;
        var za = zAnimArr[link.a];
        var zb = zAnimArr[link.b];
        var lba = liveBand[link.a];
        var lbb = liveBand[link.b];
        var drawBandIndex = za < zb ? lba : lbb;
        var linkZ = Math.min(za, zb);
        var bandL = bands[drawBandIndex];
        var ctx = bandL.ctx;
        var focus = zFocus(linkZ, sp);
        var prox = clamp(1 - link.dist * 2.4, 0, 1);
        var pulse = (Math.sin(now * 0.0011 + link.phase) + 1) / 2;
        var edge = boundaryEase(za) * boundaryEase(zb);
        var hubBoost = link.hubLink ? 2.0 : 1.0;
        var segLen = Math.hypot(b.x - a.x, b.y - a.y);
        var maxEdge = Math.min(width, height) * 0.3;
        var softEdge = maxEdge * 0.64;
        var lenFade = clamp(1 - (segLen - softEdge) / Math.max(1, maxEdge - softEdge), 0, 1);
        if (lenFade <= 0) continue;
        var alpha = (0.13 + prox * 0.3) * (0.5 + focus * 0.5) * (0.5 + pulse * 0.5) *
          bandL.linkAlpha * edge * hubBoost * lenFade * ambientDim;
        if (alpha < 0.02) continue;

        var mxl = (a.x + b.x) * 0.5;
        var myl = (a.y + b.y) * 0.5;
        var ex = b.x - a.x;
        var ey = b.y - a.y;
        var cxl = mxl - ey * link.curv;
        var cyl = myl + ex * link.curv;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cxl, cyl, b.x, b.y);
        ctx.strokeStyle = rgba(baseRgb, alpha);
        ctx.lineWidth = (1.05 + focus * 1.1) * (link.hubLink ? 1.45 : 1);
        ctx.stroke();

        if (!IS_MOBILE && drawBandIndex !== 0 && lenFade > 0.6 && (link.hubLink || prox > 0.55)) {
          var focusGate = ease(clamp((focus - 0.32) / 0.2, 0, 1));
          var proxGate = ease(clamp((prox - 0.3) / 0.18, 0, 1));
          var gate = focusGate * proxGate;
          if (gate > 0.01) {
            var tBase = (now * 0.00018 * link.speed + link.phase * 0.16) % 1;
            var glowBase = (link.hubLink ? 0.6 : 0.22) * focus * (0.55 + pulse * 0.45) * gate;
            var prr = (link.hubLink ? 1.8 : 1.2) + focus * 1.1;
            var TRAIL = [0, 0.05, 0.1];
            for (var d = TRAIL.length - 1; d >= 0; d--) {
              var off = TRAIL[d];
              var t = (tBase - off + 1) % 1;
              var win = Math.sin(Math.PI * t);
              var glowA = glowBase * win * (1 - d * 0.34);
              if (glowA < 0.012) continue;
              var it = 1 - t;
              var w0 = it * it;
              var w1 = 2 * it * t;
              var w2 = t * t;
              var px = w0 * a.x + w1 * cxl + w2 * b.x;
              var py = w0 * a.y + w1 * cyl + w2 * b.y;
              var rr = (prr - d * 0.55) * 2.4;
              if (rr <= 0) continue;
              var ph = ctx.createRadialGradient(px, py, 0, px, py, rr);
              ph.addColorStop(0, rgba(photonRgb, glowA));
              ph.addColorStop(0.5, rgba(photonRgb, glowA * 0.35));
              ph.addColorStop(1, rgba(photonRgb, 0));
              ctx.fillStyle = ph;
              ctx.beginPath();
              ctx.arc(px, py, rr, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(px, py, Math.max(0.4, prr - d * 0.55), 0, Math.PI * 2);
              ctx.fillStyle = rgba(mix(photonRgb, hotCore, 0.5), clamp(glowA * 1.2, 0, 1));
              ctx.fill();
            }
          }
        }
      }

      // nodes
      for (var ni2 = 0; ni2 < nodes.length; ni2++) {
        var nd = nodes[ni2];
        var p = pos[ni2];
        var zz = zAnimArr[ni2];
        var lbn = liveBand[ni2];
        if (!p || zz === undefined || lbn === undefined) continue;
        var bandN = bands[lbn];
        var ctxN = bandN.ctx;
        var focusN = zFocus(zz, sp);
        var tint = nd.warm ? secondaryRgb : baseRgb;
        var depthScaleN = zz < 0.34 ? 1.0 : 0.7 + zz * 0.6;
        var pScale = clamp(scaleArr[ni2] || 1, 0.82, 1.28);

        if (nd.hub) {
          var breatheH = 1 + Math.sin(now * 0.0013 + nd.phase) * 0.09;
          var radiusH = nd.r0 * depthScaleN * (1.5 + focusN * 0.7) * breatheH * pScale;
          var haloMultH = lbn === 0 ? 5.4 : 4.4;
          var depthSwellH = 1 + (1 - zz) * 1.6;
          var haloH = radiusH * haloMultH * depthSwellH;
          var edgeH = boundaryEase(zz);
          var coreAH = nd.bright * (0.62 + focusN * 0.38) * edgeH * ambientDim;

          var halTint = mix(baseRgb, hotCore, 0.18);
          var bloomH = ctxN.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloH);
          bloomH.addColorStop(0, rgba(halTint, 0.3 * coreAH));
          bloomH.addColorStop(0.35, rgba(halTint, 0.12 * coreAH));
          bloomH.addColorStop(1, rgba(halTint, 0));
          ctxN.fillStyle = bloomH;
          ctxN.beginPath();
          ctxN.arc(p.x, p.y, haloH, 0, Math.PI * 2);
          ctxN.fill();

          var midR = radiusH * 2.2;
          var ring = ctxN.createRadialGradient(p.x, p.y, radiusH * 0.4, p.x, p.y, midR);
          ring.addColorStop(0, rgba(mix(baseRgb, hotCore, 0.35), 0.5 * coreAH));
          ring.addColorStop(1, rgba(baseRgb, 0));
          ctxN.fillStyle = ring;
          ctxN.beginPath();
          ctxN.arc(p.x, p.y, midR, 0, Math.PI * 2);
          ctxN.fill();

          var coreHotH = 0.55 + focusN * 0.35;
          ctxN.beginPath();
          ctxN.arc(p.x, p.y, radiusH, 0, Math.PI * 2);
          ctxN.fillStyle = rgba(mix(baseRgb, hotCore, coreHotH), Math.min(1, 0.95 * coreAH + 0.25));
          ctxN.fill();
          continue;
        }

        var breatheM = 0.85 + Math.sin(now * 0.0014 + nd.phase) * 0.15;
        var depthSwellM = 1 + (1 - zz) * 2.6;
        var radiusM = nd.r0 * depthScaleN * (1.4 + focusN * 0.6) * breatheM * pScale;
        var haloMultM = lbn === 0 ? 4.6 : 3.4;
        var haloM = radiusM * haloMultM * depthSwellM;
        var edgeM = boundaryEase(zz);
        var coreAM = nd.bright * (0.5 + focusN * 0.5) * edgeM * ambientDim;

        var bloomTint = nd.warm ? mix(tint, deepRgb, 0.35) : tint;
        var bloomM = ctxN.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloM);
        bloomM.addColorStop(0, rgba(bloomTint, 0.16 * coreAM));
        bloomM.addColorStop(0.5, rgba(bloomTint, 0.05 * coreAM));
        bloomM.addColorStop(1, rgba(bloomTint, 0));
        ctxN.fillStyle = bloomM;
        ctxN.beginPath();
        ctxN.arc(p.x, p.y, haloM, 0, Math.PI * 2);
        ctxN.fill();

        var hot = lbn === 2 ? focusN * nd.bright : 0;
        var coreColor = mix(tint, hotCore, 0.25 + hot * 0.45);
        ctxN.beginPath();
        ctxN.arc(p.x, p.y, radiusM, 0, Math.PI * 2);
        ctxN.fillStyle = rgba(coreColor, 0.7 * coreAM);
        ctxN.fill();
      }

      raf = requestAnimationFrame(drawFrame);
    }

    function start() { if (raf) return; if (shouldRun()) { last = -1; raf = requestAnimationFrame(drawFrame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    // ---- observers -----------------------------------------------------
    var ro = new ResizeObserver(function () { size(false); });
    ro.observe(wrap);

    if (typeof IntersectionObserver === "function") {
      var io = new IntersectionObserver(function (entries) {
        var e = entries[0];
        onScreen = e ? e.isIntersecting : true;
        computeIoProgress();
        if (shouldRun()) start(); else stop();
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
      io.observe(wrap);
    }

    document.addEventListener("visibilitychange", function () {
      visible = document.visibilityState !== "hidden";
      if (shouldRun()) start(); else stop();
    });
    function onScrollFallback() { if (!scrollFromWindow) computeIoProgress(); }

    size(true);
    onScroll();
    computeIoProgress();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScrollFallback, { passive: true });
    window.setTimeout(function () { if (!scrollFromWindow) computeIoProgress(); }, 400);
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
