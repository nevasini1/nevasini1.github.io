/* Background shader: an animated loss-landscape contour map.
   Contours bend around the cursor, which leaves a warm "attention" glow.
   Falls back to the plain CSS background when WebGL is unavailable. */
(function () {
  "use strict";
  var canvas = document.getElementById("bg-shader");
  if (!canvas) return;
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) { canvas.remove(); return; }
  var hasDeriv = !!gl.getExtension("OES_standard_derivatives");

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    hasDeriv ? "#extension GL_OES_standard_derivatives : enable" : "",
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uMouseOn;",
    "uniform float uScroll;uniform float uIntensity;uniform vec3 uBg;uniform vec3 uLine;uniform vec3 uHot;uniform float uDark;",
    // Simplex noise (Ashima Arts, MIT)
    "vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}",
    "float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);",
    "vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);",
    "vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);",
    "vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));",
    "vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;",
    "vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;",
    "m*=1.79284291400159-.85373472095314*(a0*a0+h*h);",
    "vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}",
    "float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return .5+.5*s;}",
    "float band(float v,float w){",
    hasDeriv ? "float fw=max(fwidth(v),1e-4)*w;" : "float fw=.04*w;",
    "return 1.-min(abs(fract(v-.5)-.5)/fw,1.);}",
    "void main(){",
    "  float sc=2.1/uRes.y;",
    "  float shift=uScroll*.35*sc;",
    "  vec2 p=gl_FragCoord.xy*sc;p.y-=shift;",
    "  vec2 m=vec2(uMouse.x,uRes.y-uMouse.y)*sc;m.y-=shift;",
    "  float t=uTime*.035;",
    "  vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));",
    "  float f=fbm(p+1.5*q+vec2(.4*t,-.2*t));",
    "  float d=length(p-m);",
    "  float bump=uMouseOn*exp(-d*d*2.6);",
    "  f+=.22*bump;",
    "  float v=f*16.;",
    "  float minor=band(v,1.1);",
    "  float major=band(v/5.,1.5);",
    "  float lines=clamp(minor*.55+major,0.,1.);",
    "  float lineA=mix(.12,.22,uDark)*uIntensity;",
    "  vec3 col=uBg;",
    "  col=mix(col,uLine,smoothstep(.55,.95,f)*.05*uIntensity);",
    "  float hot=uMouseOn*exp(-d*d*5.5);",
    "  col=mix(col,uHot,hot*mix(.10,.16,uDark)*uIntensity);",
    "  vec3 lc=mix(uLine,uHot,clamp(hot*1.6,0.,1.));",
    "  col=mix(col,lc,lines*lineA*(1.+hot*1.4));",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uRes", "uTime", "uMouse", "uMouseOn", "uScroll", "uIntensity", "uBg", "uLine", "uHot", "uDark"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  /* Colors come from the page's theme tokens */
  var probe = document.createElement("canvas").getContext("2d");
  function rgb(cssColor) {
    probe.fillStyle = "#000";
    probe.fillStyle = cssColor.trim();
    var h = probe.fillStyle;
    if (h.charAt(0) === "#") return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255];
    var m = h.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    var bg = rgb(cs.getPropertyValue("--paper"));
    gl.uniform3fv(U.uBg, bg);
    gl.uniform3fv(U.uLine, rgb(cs.getPropertyValue("--accent")));
    gl.uniform3fv(U.uHot, rgb(cs.getPropertyValue("--signal")));
    gl.uniform1f(U.uDark, (bg[0] + bg[1] + bg[2]) / 3 < 0.5 ? 1 : 0);
    requestDraw();
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = 1;
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, w < 760 ? 1.25 : 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    requestDraw();
  }

  /* Cursor: smoothed so the attention glow trails a little */
  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };
  if (!reduce) {
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      mouse.tx = e.clientX * dpr; mouse.ty = e.clientY * dpr; mouse.ton = 1;
      if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mouse.ton = 0; });
    window.addEventListener("blur", function () { mouse.ton = 0; });
  }

  var hero = document.querySelector(".hero");
  function intensity() {
    var end = hero ? hero.offsetTop + hero.offsetHeight : window.innerHeight;
    var k = Math.min(1, Math.max(0, window.scrollY / end));
    k = k * k * (3 - 2 * k);
    return 1 - 0.6 * k;
  }

  var start = performance.now();
  var frozenTime = 40.0;
  var pending = false;
  var running = !reduce;
  function draw(now) {
    pending = false;
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    mouse.on += (mouse.ton - mouse.on) * 0.05;
    gl.uniform1f(U.uTime, reduce ? frozenTime : frozenTime + (now - start) / 1000);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uMouseOn, mouse.on);
    gl.uniform1f(U.uScroll, window.scrollY * dpr);
    gl.uniform1f(U.uIntensity, intensity());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (running && !document.hidden) { pending = true; requestAnimationFrame(draw); }
  }
  function requestDraw() {
    if (!pending) { pending = true; requestAnimationFrame(draw); }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", function () { if (reduce) requestDraw(); }, { passive: true });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) requestDraw(); });
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", readTheme); else if (mq.addListener) mq.addListener(readTheme);
  }
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; canvas.style.display = "none"; });

  resize();
  readTheme();
  document.documentElement.classList.add("has-shader");
})();
