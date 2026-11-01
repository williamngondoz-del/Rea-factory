(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Split text (hero + section titles) ---------- */
  function splitWords(el, wordClass) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = wordClass;
            const inner = document.createElement("span");
            inner.textContent = part;
            w.style.setProperty("--i", i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          // Keep gradient spans: split inside them, tagging the words
          if (child.classList.contains("grad")) {
            const text = child.textContent;
            const w = document.createElement("span");
            w.className = wordClass + " grad-word";
            w.style.setProperty("--i", i++);
            const inner = document.createElement("span");
            inner.className = "grad";
            inner.textContent = text;
            w.appendChild(inner);
            child.replaceWith(w);
          } else walk(child);
        }
      });
    };
    walk(el);
  }
  $$("[data-split]").forEach((el) => splitWords(el, "word"));
  $$("[data-words]").forEach((el) => splitWords(el, "w"));

  /* ---------- Preloader ---------- */
  const loader = $("#loader");
  const countEl = $("#loaderCount");
  const finishLoading = () => {
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    setTimeout(() => loader.remove(), 1400);
  };
  if (reduced) {
    finishLoading();
  } else {
    let n = 0;
    const tick = () => {
      n += Math.max(1, Math.round((100 - n) * 0.08));
      if (n > 100) n = 100;
      countEl.textContent = n;
      if (n < 100) setTimeout(tick, 28);
      else setTimeout(finishLoading, 250);
    };
    tick();
  }

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduced) {
    const cursor = $("#cursor"), dot = $("#cursorDot"), label = $("#cursorLabel");
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      document.body.classList.add("has-cursor");
    });
    document.addEventListener("mouseleave", () => document.body.classList.remove("has-cursor"));
    (function loop() {
      cx = lerp(cx, mx, 0.18); cy = lerp(cy, my, 0.18);
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", (e) => {
      const withLabel = e.target.closest("[data-cursor]");
      const hover = e.target.closest("a, button, summary, input, select, .tilt");
      if (withLabel) {
        label.textContent = withLabel.dataset.cursor;
        cursor.classList.add("has-label");
        cursor.classList.remove("is-hover");
      } else {
        cursor.classList.remove("has-label");
        cursor.classList.toggle("is-hover", !!hover);
      }
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduced) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.3}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 600);
      });
    });
  }

  /* ---------- 3D tilt ---------- */
  if (finePointer && !reduced) {
    $$("[data-tilt]").forEach((el) => {
      const max = el.classList.contains("hero__card") ? 10 : 8;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateY(${px * max * 2}deg) rotateX(${-py * max * 2}deg)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- Scroll reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal, .reveal-words").forEach((el) => io.observe(el));

  /* ---------- Counters ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      countIO.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const suffix = el.dataset.suffix || "";
      const dur = reduced ? 1 : 2000;
      const start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        const val = target * eased;
        el.textContent = (dec ? val.toFixed(dec) : Math.round(val).toLocaleString()) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- Marquee (scroll-velocity aware) ---------- */
  const marquees = $$("[data-marquee]").map((track, idx) => {
    const group = track.firstElementChild;
    // Clone enough groups to fill the screen twice
    const copies = Math.max(2, Math.ceil((innerWidth * 2) / group.offsetWidth) + 1);
    for (let i = 1; i < copies; i++) {
      const c = group.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      track.appendChild(c);
    }
    return { track, group, x: 0, dir: idx % 2 ? 1 : -1 };
  });

  /* ---------- Scroll-driven effects ---------- */
  const header = $("#header");
  const progress = $("#progress");
  const parallaxEls = $$("[data-parallax]");
  const process = $("#process");
  const processTrack = $("#processTrack");
  const processBar = $("#processBar");
  const stackCards = $$(".stack__card");
  const sections = $$("main section[id]");
  const navLinks = $$(".nav__link");

  let lastY = scrollY, velocity = 0;

  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    header.classList.toggle("is-scrolled", y > 40);
    const menuOpen = $("#menu").classList.contains("is-open");
    header.classList.toggle("is-hidden", !menuOpen && y > lastY && y > 400);

    velocity = clamp(y - lastY, -60, 60);
    lastY = y;

    if (reduced) return;

    parallaxEls.forEach((el) => {
      el.style.transform = `translate3d(0, ${y * parseFloat(el.dataset.parallax)}px, 0)`;
    });

    // Horizontal process scroll
    const r = process.getBoundingClientRect();
    const total = process.offsetHeight - innerHeight;
    const p = clamp(-r.top / total, 0, 1);
    const dist = processTrack.scrollWidth - innerWidth + Math.max(24, (innerWidth - 1200) / 2);
    processTrack.style.transform = `translate3d(${-p * Math.max(0, dist)}px, 0, 0)`;
    processBar.style.transform = `scaleX(${p})`;

    // Stacked cards shrink as next card covers them
    stackCards.forEach((card, i) => {
      const next = stackCards[i + 1];
      if (!next) return;
      const cr = card.getBoundingClientRect();
      const nr = next.getBoundingClientRect();
      const overlap = clamp((cr.bottom - nr.top) / cr.height, 0, 1);
      card.style.transform = `scale(${1 - overlap * 0.06})`;
      card.style.filter = `brightness(${1 - overlap * 0.15})`;
    });
  }

  // Active nav link
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => navIO.observe(s));

  let ticking = false;
  addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // Marquee animation loop (speeds up with scroll velocity)
  if (!reduced) {
    let boost = 0;
    (function marqueeLoop() {
      boost = lerp(boost, Math.abs(velocity) * 0.25, 0.1);
      velocity *= 0.9;
      marquees.forEach((m) => {
        const w = m.group.offsetWidth;
        m.x += m.dir * (0.6 + boost);
        if (m.x <= -w) m.x += w;
        if (m.x >= 0 && m.dir > 0) m.x -= w;
        m.track.style.transform = `translate3d(${m.x}px,0,0)`;
      });
      requestAnimationFrame(marqueeLoop);
    })();
  }

  /* ---------- Hero particles ---------- */
  const canvas = $("#particles");
  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    let w, h, dots;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: Math.round((w * h) / 22000) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2 + 0.6, vy: -(Math.random() * 0.3 + 0.1), vx: (Math.random() - 0.5) * 0.15,
        a: Math.random() * 0.5 + 0.2,
      }));
    };
    resize();
    addEventListener("resize", resize);
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
    (function draw() {
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        dots.forEach((d) => {
          d.x += d.vx; d.y += d.vy;
          if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(15,118,110,${d.a})`;
          ctx.fill();
        });
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ---------- Mobile menu ---------- */
  const burger = $("#burger"), menu = $("#menu");
  const toggleMenu = (open) => {
    burger.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => toggleMenu(!menu.classList.contains("is-open")));
  $$(".menu__link").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });

  /* ---------- Before / After ---------- */
  const compare = $("#compare"), handle = $("#compareHandle");
  const setPos = (pct) => {
    pct = clamp(pct, 0, 100);
    compare.style.setProperty("--pos", pct + "%");
    handle.setAttribute("aria-valuenow", Math.round(pct));
  };
  let dragging = false;
  const fromEvent = (e) => {
    const r = compare.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100);
  };
  compare.addEventListener("pointerdown", (e) => { dragging = true; compare.classList.remove("is-hint"); compare.setPointerCapture(e.pointerId); fromEvent(e); });
  compare.addEventListener("pointermove", (e) => dragging && fromEvent(e));
  compare.addEventListener("pointerup", () => (dragging = false));
  compare.addEventListener("pointercancel", () => (dragging = false));
  handle.addEventListener("keydown", (e) => {
    const cur = parseFloat(handle.getAttribute("aria-valuenow"));
    if (e.key === "ArrowLeft") { setPos(cur - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { setPos(cur + 5); e.preventDefault(); }
  });
  // Hint animation when it first appears
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting || reduced) return;
    obs.disconnect();
    compare.classList.add("is-hint");
    setTimeout(() => setPos(25), 600);
    setTimeout(() => setPos(70), 1800);
    setTimeout(() => setPos(50), 3000);
    setTimeout(() => compare.classList.remove("is-hint"), 4300);
  }, { threshold: 0.6 }).observe(compare);

  /* ---------- Testimonial slider ---------- */
  const slider = $("#slider"), track = $("#sliderTrack"), dotsWrap = $("#sliderDots");
  const slides = $$(".quote", track);
  let index = 0, autoTimer;
  const perView = () => (innerWidth <= 960 ? 1 : 2);
  const maxIndex = () => slides.length - perView();
  const buildDots = () => {
    dotsWrap.innerHTML = "";
    for (let i = 0; i <= maxIndex(); i++) {
      const b = document.createElement("button");
      b.setAttribute("aria-label", `Go to slide ${i + 1}`);
      b.addEventListener("click", () => go(i));
      dotsWrap.appendChild(b);
    }
  };
  const go = (i) => {
    index = (i + maxIndex() + 1) % (maxIndex() + 1);
    track.style.transform = `translateX(${-index * (100 / perView())}%)`;
    $$("button", dotsWrap).forEach((d, k) => d.classList.toggle("is-active", k === index));
    restartAuto();
  };
  const restartAuto = () => {
    clearInterval(autoTimer);
    if (!reduced) autoTimer = setInterval(() => go(index + 1), 6000);
  };
  $("#prevT").addEventListener("click", () => go(index - 1));
  $("#nextT").addEventListener("click", () => go(index + 1));
  // Drag / swipe
  let sx = 0, dx = 0, down = false;
  slider.addEventListener("pointerdown", (e) => { down = true; sx = e.clientX; dx = 0; slider.classList.add("is-drag"); });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    dx = e.clientX - sx;
    track.style.transform = `translateX(calc(${-index * (100 / perView())}% + ${dx}px))`;
  });
  addEventListener("pointerup", () => {
    if (!down) return;
    down = false; slider.classList.remove("is-drag");
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1)); else go(index);
  });
  addEventListener("resize", () => { buildDots(); go(Math.min(index, maxIndex())); });
  buildDots(); go(0);

  /* ---------- FAQ: only one open at a time ---------- */
  $$(".acc").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) $$(".acc").forEach((o) => o !== d && (o.open = false));
  }));

  /* ---------- Booking card glow follows mouse ---------- */
  const card = $(".book__card");
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  /* ---------- Booking form ---------- */
  const form = $("#bookForm"), msg = $("#formMsg");
  const dateInput = $("#fDate");
  dateInput.min = new Date().toISOString().split("T")[0];
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    $$("input, select", form).forEach((f) => {
      const field = f.closest(".field");
      field.classList.remove("is-error");
      const valid = f.checkValidity() && f.value.trim() !== "";
      if (!valid) { ok = false; void field.offsetWidth; field.classList.add("is-error"); }
    });
    if (!ok) {
      msg.textContent = "Please complete all fields.";
      msg.classList.add("is-error");
      return;
    }
    msg.classList.remove("is-error");
    const btn = $("button[type=submit] span", form);
    btn.textContent = "Sending…";
    setTimeout(() => {
      const name = $("#fName").value.trim().split(" ")[0];
      msg.textContent = `Thanks ${name}! This is a demo — in production we'd confirm your visit shortly.`;
      btn.textContent = "Request sent ✓";
      form.reset();
      setTimeout(() => (btn.textContent = "Request appointment"), 3000);
    }, 900);
  });
})();
