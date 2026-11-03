/* Background shader: a soft sky with drifting volumetric clouds.
   Scrolling sinks the view toward the cloud layer; a soft light follows the cursor.
   Falls back to the CSS gradient when WebGL is unavailable. */
(function () {
  "use strict";
  var canvas = document.getElementById("bg-shader");
  if (!canvas) return;
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) { canvas.remove(); return; }

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uMouseOn;uniform float uScroll;uniform float uDark;",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);",
    "return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return s;}",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/uRes;",
    "  vec2 p=gl_FragCoord.xy/uRes.y;",
    "  float asp=uRes.x/uRes.y;",
    "  float t=uTime;float s=uScroll;",
    "  vec3 top,mid,low,haze,lit,shade;",
    "  if(uDark<.5){top=vec3(.20,.40,.64);mid=vec3(.46,.65,.86);low=vec3(.83,.88,.93);haze=vec3(.95,.97,1.);lit=vec3(.97,.975,.985);shade=vec3(.68,.71,.75);}",
    "  else{top=vec3(.015,.03,.08);mid=vec3(.04,.08,.17);low=vec3(.09,.13,.22);haze=vec3(.20,.27,.40);lit=vec3(.20,.25,.35);shade=vec3(.05,.07,.12);}",
    "  float gy=uv.y-s*.35;",
    "  vec3 col=mix(low,mid,smoothstep(-.15,.55,gy));",
    "  col=mix(col,top,smoothstep(.45,1.05,gy));",
    "  col=mix(col,top,(1.-uv.x)*.14*smoothstep(.2,1.,gy));",
    "  vec2 sun=vec2(.64*asp,.46+s*.18);",
    "  float sd=length(p-sun);",
    "  col=mix(col,haze,exp(-sd*sd*3.2)*.55);",
    "  vec2 cp=p*1.1+vec2(t*.012,-s*.7);",
    "  vec2 w=vec2(fbm(cp*.8+t*.01),fbm(cp*.8+vec2(4.3,1.2)-t*.008));",
    "  float c=fbm(cp+1.3*w);",
    "  float cover=mix(.64,.42,smoothstep(.8,-.15,gy));",
    "  float dens=smoothstep(cover,cover+.3,c);",
    "  float c2=fbm(cp+1.3*w+vec2(.06,.09));",
    "  float sh=clamp((c-c2)*4.+.55,0.,1.);",
    "  col=mix(col,mix(shade,lit,sh),dens*.88);",
    "  float wisp=fbm(vec2(p.x*.6+t*.006,p.y*2.2)+w*.5);",
    "  col=mix(col,haze,smoothstep(.55,.9,wisp)*.16*smoothstep(.3,1.,gy));",
    "  vec2 m=vec2(uMouse.x,uRes.y-uMouse.y)/uRes.y;",
    "  float md=length(p-m);",
    "  col+=haze*mix(.09,.12,uDark)*uMouseOn*exp(-md*md*8.);",
    "  col+=(hash(gl_FragCoord.xy+fract(t))-.5)/255.;",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uRes", "uTime", "uMouse", "uMouseOn", "uScroll", "uDark"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  /* Theme: follow data-theme when set, otherwise the system setting */
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function syncTheme() {
    var t = root.getAttribute("data-theme");
    var dark = t === "dark" || (t !== "light" && mq && mq.matches);
    gl.uniform1f(U.uDark, dark ? 1 : 0);
    requestDraw();
  }

  /* Clouds are soft, so render at half resolution and let CSS upscale */
  var SCALE = 0.5;
  function resize() {
    canvas.width = Math.max(1, Math.round(window.innerWidth * SCALE));
    canvas.height = Math.max(1, Math.round(window.innerHeight * SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    requestDraw();
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };
  if (!reduce) {
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      mouse.tx = e.clientX * SCALE; mouse.ty = e.clientY * SCALE; mouse.ton = 1;
      if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mouse.ton = 0; });
    window.addEventListener("blur", function () { mouse.ton = 0; });
  }

  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  var t0 = performance.now(), last = 0, pending = false;
  var BASE_T = 30.0;
  function draw(now) {
    pending = false;
    if (!reduce && now - last < 32) { schedule(); return; }  // ~30 fps is plenty for drifting clouds
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.on += (mouse.ton - mouse.on) * 0.08;
    gl.uniform1f(U.uTime, reduce ? BASE_T : BASE_T + (now - t0) / 1000);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uMouseOn, mouse.on);
    gl.uniform1f(U.uScroll, progress());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) schedule();
  }
  function schedule() {
    if (!pending && !document.hidden) { pending = true; requestAnimationFrame(draw); }
  }
  function requestDraw() { last = 0; schedule(); }

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", function () { if (reduce) requestDraw(); }, { passive: true });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) requestDraw(); });
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (mq) { if (mq.addEventListener) mq.addEventListener("change", syncTheme); else if (mq.addListener) mq.addListener(syncTheme); }
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); canvas.style.display = "none"; });

  resize();
  syncTheme();
  root.classList.add("has-shader");
})();
