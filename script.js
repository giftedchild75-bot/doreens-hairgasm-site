(function () {
  const cfg = window.SITE_CONFIG;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function waLink() {
    const msg = encodeURIComponent(cfg.whatsappDefaultMessage || "");
    return `https://wa.me/${cfg.whatsappNumber}?text=${msg}`;
  }

  function orderLink(name, price) {
    const msg = encodeURIComponent(`Hi Doreen! I'd like to order the ${name} (${price}).`);
    return `https://wa.me/${cfg.whatsappNumber}?text=${msg}`;
  }

  // Wire up WhatsApp CTAs
  document.querySelectorAll("#nav-whatsapp, #hero-whatsapp, #order-whatsapp, #float-whatsapp, #mobile-whatsapp")
    .forEach((el) => (el.href = waLink()));

  // Wire up Instagram / TikTok links
  document.querySelectorAll("#hero-tiktok, #feature-tiktok, #contact-tt")
    .forEach((el) => (el.href = cfg.tiktokUrl));
  const ig = document.getElementById("contact-ig");
  if (ig) ig.href = cfg.instagramUrl;

  // Featured "Watch the Install" card links straight to the specific video, not just the profile
  const featuredCard = document.getElementById("tiktok-embed-wrap");
  if (featuredCard) featuredCard.href = cfg.featuredTikTokVideoUrl || cfg.tiktokUrl;

  // Location
  const loc = document.getElementById("contact-location");
  if (loc) loc.textContent = cfg.location;

  // Marquee strip
  const stripItems = [
    "Glueless Fit",
    "Wigs & Styling",
    cfg.location,
    "Order on WhatsApp",
    "New Colors Weekly",
  ];
  const track = document.getElementById("strip-track");
  if (track) {
    const html = stripItems.map((t) => `<span>${t}</span>`).join("");
    track.innerHTML = html + html; // duplicate for seamless loop
  }

  // Product gallery — responsive grid with live search + sort
  const wigIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 10c0-4.4 3.6-8 8-8s8 3.6 8 8v3c0 .8-.5 1.4-1.2 1.7-1 .4-1.8 1.3-1.8 2.3v3c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-3c0-1-.8-1.9-1.8-2.3C4.5 14.4 4 13.8 4 13v-3z"/></svg>`;
  const grid = document.getElementById("product-grid");
  const searchInput = document.getElementById("catalog-search-input");
  const sortSelect = document.getElementById("catalog-sort-select");
  const countEl = document.getElementById("catalog-count");
  const emptyEl = document.getElementById("catalog-empty");
  const emptyTermEl = document.getElementById("catalog-empty-term");

  function parsePrice(priceStr) {
    const digits = String(priceStr || "").replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function renderProducts(list, isFiltered) {
    if (!grid) return;
    grid.innerHTML = list
      .map(
        (p, i) => `
      <div class="card" data-reveal style="transition-delay:${Math.min(i, 8) * 70}ms">
        <div class="card-media">
          <span class="card-index">${String(i + 1).padStart(2, "0")} /</span>
          ${
            p.image
              ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
              : `${wigIcon}<div class="ph-label">Photo placeholder — add real product image</div>`
          }
          <div class="card-media-hover">${p.name} — view</div>
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          <p class="desc">${p.desc}</p>
          ${
            Array.isArray(p.specs) && p.specs.length
              ? `<ul class="spec-list">${p.specs.map((s) => `<li>${s}</li>`).join("")}</ul>`
              : ""
          }
          <div class="card-foot">
            <span class="price">${p.price}</span>
            <a class="mini-link" href="${orderLink(p.name, p.price)}" target="_blank" rel="noopener">Order</a>
          </div>
        </div>
      </div>`
      )
      .join("");

    grid.querySelectorAll("img").forEach(wireImageFadeIn);
    if (!reducedMotion && "IntersectionObserver" in window) {
      grid.querySelectorAll("[data-reveal]").forEach((el) => cardRevealObserver.observe(el));
    } else {
      grid.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-revealed"));
    }

    if (countEl) {
      countEl.textContent = isFiltered
        ? `Showing ${list.length} of ${cfg.products.length} pieces`
        : `${list.length} pieces in the collection`;
    }
    if (emptyEl) emptyEl.hidden = list.length !== 0;
    grid.hidden = list.length === 0;
  }

  function updateCatalog() {
    if (!grid || !Array.isArray(cfg.products)) return;
    const term = (searchInput?.value || "").trim().toLowerCase();
    const sortMode = sortSelect?.value || "default";

    let list = !term
      ? cfg.products.slice()
      : cfg.products.filter((p) => {
          const haystack = [p.name, p.desc, ...(Array.isArray(p.specs) ? p.specs : [])]
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        });

    if (sortMode === "price-asc") list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    else if (sortMode === "price-desc") list.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    else if (sortMode === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));

    if (emptyTermEl) emptyTermEl.textContent = searchInput?.value || "";
    renderProducts(list, Boolean(term) || sortMode !== "default");
  }

  // Reveal-on-scroll observer, defined early so re-rendered cards (from search/sort) can reuse it
  const cardRevealObserver =
    !reducedMotion && "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-revealed");
                cardRevealObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
        )
      : null;

  if (grid && Array.isArray(cfg.products)) {
    updateCatalog();
    let searchDebounce;
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(updateCatalog, 120);
    });
    sortSelect?.addEventListener("change", updateCatalog);
  }

  // Find Your Shade — front-end-only match tool, routes to WhatsApp with context
  const shadeSteps = document.getElementById("shade-steps");
  const shadeResult = document.getElementById("shade-result");
  const shadeResultName = document.getElementById("shade-result-name");
  const shadeResultCta = document.getElementById("shade-result-cta");
  const selections = {};

  const RECOMMEND_BY_UNDERTONE = {
    cool: "Straightening Service",
    warm: "Skull Cap Wig — Honey Blonde",
    neutral: "Custom Install",
  };

  function updateShadeResult() {
    if (!(selections.undertone && selections.length && selections.texture)) return;
    const recommended =
      RECOMMEND_BY_UNDERTONE[selections.undertone] || cfg.products[0].name;
    shadeResultName.textContent = recommended;
    const msg = encodeURIComponent(
      `Hi Doreen! I used the shade finder — ${selections.undertone} undertone, ${selections.length} length, ${selections.texture} texture. Recommended: ${recommended}. Can we chat?`
    );
    shadeResultCta.href = `https://wa.me/${cfg.whatsappNumber}?text=${msg}`;
    shadeResult.hidden = false;
    requestAnimationFrame(() => shadeResult.classList.add("is-shown"));
    shadeResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (shadeSteps) {
    shadeSteps.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-value]");
      if (!btn) return;
      const group = btn.closest("[data-group]");
      if (!group) return;
      const key = group.getAttribute("data-group");
      selections[key] = btn.getAttribute("data-value");
      group
        .querySelectorAll("[data-value]")
        .forEach((el) => el.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      updateShadeResult();
    });
  }

  // Announcement bar hide if empty
  const announce = document.getElementById("announce");
  if (announce && !announce.textContent.trim()) announce.style.display = "none";

  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Mobile menu
  const navToggle = document.getElementById("nav-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileBackdrop = document.getElementById("mobile-menu-backdrop");

  function openMobileMenu() {
    mobileMenu.hidden = false;
    mobileBackdrop.hidden = false;
    // force layout before adding the "open" class so the transition runs
    requestAnimationFrame(() => {
      mobileMenu.classList.add("is-open");
      mobileBackdrop.classList.add("is-open");
    });
    navToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeMobileMenu() {
    mobileMenu.classList.remove("is-open");
    mobileBackdrop.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(() => {
      if (!mobileMenu.classList.contains("is-open")) {
        mobileMenu.hidden = true;
        mobileBackdrop.hidden = true;
      }
    }, 400);
  }
  if (navToggle && mobileMenu && mobileBackdrop) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      isOpen ? closeMobileMenu() : openMobileMenu();
    });
    mobileBackdrop.addEventListener("click", closeMobileMenu);
    mobileMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobileMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") closeMobileMenu();
    });
  }

  // Nav compress-on-scroll + hero parallax + scroll progress (single rAF-throttled scroll listener)
  const navEl = document.querySelector("header.nav");
  const heroMedia = document.querySelector(".hero-media");
  const heroEl = document.querySelector(".hero");
  const scrollProgress = document.getElementById("scroll-progress");
  let ticking = false;

  function onScrollFrame() {
    const y = window.scrollY;
    if (navEl) navEl.classList.toggle("is-scrolled", y > 40);
    if (heroMedia && heroEl && !reducedMotion) {
      const heroHeight = heroEl.offsetHeight;
      if (y < heroHeight) {
        heroMedia.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
      }
    }
    if (scrollProgress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      scrollProgress.style.transform = `scaleX(${ratio})`;
    }
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(onScrollFrame);
        ticking = true;
      }
    },
    { passive: true }
  );
  onScrollFrame();

  // Scroll-reveal choreography
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reducedMotion) {
    revealEls.forEach((el) => el.classList.add("is-revealed"));
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-revealed"));
  }

  // Product photos fade in once actually loaded instead of popping in
  function wireImageFadeIn(img) {
    if (img.complete) {
      img.classList.add("is-loaded");
    } else {
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    }
  }
  if (grid) grid.querySelectorAll("img").forEach(wireImageFadeIn);

  // Cursor-driven micro-interactions — fine pointer only, never on touch,
  // and skipped entirely under prefers-reduced-motion.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!reducedMotion && finePointer) {
    // Hero cursor spotlight
    const heroGlow = document.getElementById("hero-glow");
    if (heroGlow && heroEl) {
      heroEl.addEventListener("mousemove", (e) => {
        const rect = heroEl.getBoundingClientRect();
        heroGlow.style.transform = `translate3d(${e.clientX - rect.left}px, ${e.clientY - rect.top}px, 0)`;
        heroGlow.classList.add("is-active");
      });
      heroEl.addEventListener("mouseleave", () => heroGlow.classList.remove("is-active"));
    }

    // Product card tilt-follow
    if (grid) {
      grid.addEventListener("mousemove", (e) => {
        const card = e.target.closest(".card");
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-10px)`;
      });
      grid.addEventListener(
        "mouseout",
        (e) => {
          const card = e.target.closest(".card");
          if (!card) return;
          if (card.contains(e.relatedTarget)) return;
          card.style.transform = "";
        },
        true
      );
    }

    // Magnetic pull on primary CTAs
    function magnetize(el, strength) {
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${(x / rect.width) * strength}px, ${(y / rect.height) * strength}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    }
    document
      .querySelectorAll(".hero .btn-primary, .nav-cta, #order-whatsapp, .float-wa")
      .forEach((el) => magnetize(el, el.classList.contains("float-wa") ? 8 : 12));
  }
})();
