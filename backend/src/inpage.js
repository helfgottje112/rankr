export const INPAGE_SCRIPT = `() => {
  const q = (sel) => Array.from(document.querySelectorAll(sel));
  const text = (document.body ? document.body.innerText : "") || "";
  const all = q("*");
  const links = q("a[href]");
  const forms = q("form");
  const images = q("img");
  const buttons = q("button, a, input[type=button], input[type=submit]");
  const scripts = q("script");
  const styles = q("[style]");
  const tables = q("table");
  const frames = q("frame, frameset");
  const marquees = q("marquee, blink");
  const headings = q("h1");
  const viewport = document.querySelector('meta[name="viewport"]');
  const title = document.title || "";

  const visibleButtons = buttons.filter(el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });

  const buttonRects = visibleButtons.map(el => {
    const r = el.getBoundingClientRect();
    return {
      w: r.width, h: r.height, x: r.left, y: r.top, text: (el.innerText || el.value || "").trim(),
      aria: el.getAttribute("aria-label") || "", title: el.getAttribute("title") || ""
    };
  });

  const tinyButtons = buttonRects.filter(b => b.w < 36 || b.h < 36).length;
  let closeButtons = 0;
  for (let i = 0; i < buttonRects.length; i++) {
    for (let j = i + 1; j < buttonRects.length; j++) {
      if (Math.abs(buttonRects[i].x - buttonRects[j].x) < 8 && Math.abs(buttonRects[i].y - buttonRects[j].y) < 8) closeButtons++;
    }
  }

  let offscreenElements = 0;
  let overlappingPairs = 0;
  let clippedTextBlocks = 0;
  const candidates = all.filter(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 40 && r.height > 20 && s.display !== "none" && s.visibility !== "hidden";
  }).slice(0, 450);

  const rects = candidates.map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if ((el.innerText || "").trim().length > 40 && (el.scrollWidth - el.clientWidth > 10 || el.scrollHeight - el.clientHeight > 20)) {
      clippedTextBlocks++;
    }
    return { el, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, position: cs.position };
  });

  for (const r of rects) {
    if (r.right > window.innerWidth + 8 || r.left < -8) offscreenElements++;
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length && j < i + 12; j++) {
      const a = rects[i], b = rects[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const intersects = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      if (intersects && a.width * a.height > 1200 && b.width * b.height > 1200) overlappingPairs++;
    }
  }

  const bodyWidth = Math.max(
    document.documentElement ? document.documentElement.scrollWidth : 0,
    document.body ? document.body.scrollWidth : 0
  );
  const horizontalOverflow = bodyWidth > window.innerWidth + 12;
  const overflowAmount = Math.max(0, bodyWidth - window.innerWidth);

  const all2 = all;
  const fixedElements = all2.filter(el => getComputedStyle(el).position === "fixed").length;
  const stickyElements = all2.filter(el => getComputedStyle(el).position === "sticky").length;

  const topFixed = all2.filter(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.position === "fixed" && r.top <= 10 && r.height >= 40 && r.width >= window.innerWidth * 0.5;
  }).length;

  const bottomFixed = all2.filter(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.position === "fixed" && r.bottom >= window.innerHeight - 10 && r.height >= 40 && r.width >= window.innerWidth * 0.5;
  }).length;

  const fontSizes = [];
  const colors = new Set();
  let infiniteAnimations = 0, transitions = 0, autoplayMedia = 0, unlabeledClickables = 0, largeFixedWidthSignals = 0, smallFontBlocks = 0;

  const sampleNodes = all.slice(0, 1400);
  for (const el of sampleNodes) {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize || "0");
    if (fs) fontSizes.push(Math.round(fs * 10) / 10);
    if (cs.color) colors.add(cs.color);
    if ((cs.animationIterationCount || "").toString() === "infinite") infiniteAnimations++;
    if (cs.transitionDuration && cs.transitionDuration !== "0s") transitions++;
    const widthVal = parseFloat(cs.width || "0");
    if (widthVal >= 900) largeFixedWidthSignals++;
    if (fs > 0 && fs < 14 && (el.innerText || "").trim().length > 25) smallFontBlocks++;
  }

  for (const media of q("video,audio")) if (media.autoplay) autoplayMedia++;
  for (const b of buttonRects) if (!b.text && !b.aria && !b.title) unlabeledClickables++;

  const imgsMissingAlt = images.filter(img => !(img.getAttribute("alt") || "").trim()).length;
  const placeholderLinks = links.filter(a => {
    const href = (a.getAttribute("href") || "").trim().toLowerCase();
    return href === "#" || href === "javascript:void(0)" || href === "javascript:;";
  }).length;

  const contactPage = links.some(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const label = (a.innerText || "").toLowerCase();
    return /(contact|contact-us|contactus|get-in-touch|reach-us|quote|book|schedule)/.test(href) ||
           /(contact|contact us|get in touch|request quote|book now|schedule consultation)/.test(label);
  });

  const contactForm = forms.some(form => {
    const blob = [
      form.innerText || "",
      form.getAttribute("action") || "",
      ...Array.from(form.querySelectorAll("input,textarea,select")).flatMap(x => [x.getAttribute("name") || "", x.getAttribute("id") || "", x.getAttribute("placeholder") || "", x.getAttribute("type") || ""])
    ].join(" ").toLowerCase();
    let hits = 0;
    for (const term of ["name","email","message","phone","contact","quote","inquiry","enquiry"]) if (blob.includes(term)) hits++;
    return hits >= 3;
  });

  const ctaText = visibleButtons.map(el => (el.innerText || el.value || "").trim().toLowerCase()).filter(Boolean);
  const genericCtas = ctaText.filter(t => ["learn more","click here","read more","submit"].includes(t)).length;

  let heroMissingCTA = false;
  const aboveFold = all.filter(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top < Math.min(window.innerHeight, 900) && r.height > 20 && r.width > 60;
  });
  const aboveFoldHasCTA = aboveFold.some(el => {
    const tag = el.tagName.toLowerCase();
    const txt = (el.innerText || "").toLowerCase();
    return tag === "button" || tag === "a" || /(contact|quote|book|call|schedule|start|shop|buy)/.test(txt);
  });
  if (!aboveFoldHasCTA) heroMissingCTA = true;

  const viewportContent = viewport ? (viewport.getAttribute("content") || "") : "";
  const zoomRestricted = /user-scalable\\s*=\\s*no|max(imum)?-scale\\s*=\\s*1/i.test(viewportContent);
  const hasResponsiveViewport = /width\\s*=\\s*device-width/i.test(viewportContent);

  const h1Count = headings.length;
  const metaDescription = document.querySelector('meta[name="description"]');
  const descMissing = !(metaDescription && (metaDescription.getAttribute("content") || "").trim());

  const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi) || [])));
  const phones = Array.from(new Set((text.match(/(?:\\+?1[-.\\s]?)?(?:\\(?\\d{3}\\)?[-.\\s]?)\\d{3}[-.\\s]?\\d{4}/g) || [])));

  const socialLinks = links.filter(a => /facebook\\.com|instagram\\.com|linkedin\\.com|x\\.com|twitter\\.com|youtube\\.com|tiktok\\.com|pinterest\\.com/i.test(a.href)).length;

  let navLinkCount = 0;
  const nav = document.querySelector("nav");
  if (nav) navLinkCount = nav.querySelectorAll("a[href]").length;

  const menuToggle = q('button,[role="button"],.menu-toggle,.hamburger,.navbar-toggler,[aria-label*="menu" i]').find(el => {
    const txt = (el.innerText || el.getAttribute("aria-label") || "").toLowerCase();
    return txt.includes("menu") || txt.includes("navigation") || (el.className || "").toString().toLowerCase().includes("hamburger");
  });
  let mobileMenuBroken = false;
  if (window.innerWidth <= 430 && menuToggle) {
    try {
      const beforeLinks = nav ? nav.querySelectorAll("a[href]").length : 0;
      menuToggle.click();
      const afterLinks = nav ? nav.querySelectorAll("a[href]").length : beforeLinks;
      if (beforeLinks === afterLinks && afterLinks <= 2) mobileMenuBroken = true;
    } catch (e) {}
  }

  const cmsHints = [];
  const gen = document.querySelector('meta[name="generator"]');
  const genContent = gen ? (gen.getAttribute("content") || "") : "";
  if (/wordpress/i.test(genContent)) cmsHints.push("generator:" + genContent);
  const assetStrs = [...q("script[src]"), ...q("link[rel='stylesheet']"), ...links].map((el) => (el.src || el.href || "")).join(" ");
  if (/wp-content|\\/wp-includes\\/|\\/wp-json|xmlrpc\\.php|wp-login\\.php/i.test(assetStrs)) cmsHints.push("wp-assets");
  if (document.querySelector("#wpadminbar, .wp-block, [class^='wp-block']")) cmsHints.push("wp-markup");
  let cmsName = "";
  if (/wordpress/i.test(genContent)) cmsName = "wordpress";
  else if (/drupal/i.test(genContent)) cmsName = "drupal";
  else if (/joomla/i.test(genContent)) cmsName = "joomla";
  else if (/shopify/i.test(genContent) || /shopify/i.test(document.title)) cmsName = "shopify";
  if (!cmsName) {
    const bodyClass = (document.body.className || "") + " " + (document.documentElement.className || "");
    if (document.querySelector("#SITE_CONTAINER") || document.querySelector("script[src*='static.parastorage'], link[href*='static.parastorage']")) cmsName = "wix";
    else if (/wp-content|\\/wp-includes\\//.test(assetStrs)) cmsName = "wordpress";
    else if (/drupal/i.test(bodyClass) || /drupal|\\/sites\\/all\\//.test(assetStrs)) cmsName = "drupal";
    else if (/cdn\\.shopify\\.com|c\\/shop\\.js|shopify/i.test(assetStrs)) cmsName = "shopify";
    else if (/static1\\.squarespace\\.com|squarespace/i.test(assetStrs)) cmsName = "squarespace";
    else if (/cdn\\.wixstatic\\.com/i.test(assetStrs)) cmsName = "wix";
    else if (/\\/media\\/system\\/|joomla/i.test(assetStrs)) cmsName = "joomla";
  }
  const cmsVersionMatch = genContent.match(/wordpress\\s*(\\d[\\d.]*)|drupal\\s*(\\d[\\d.]*)|joomla!?\\s*(\\d[\\d.]*)/i);
  const cmsVersion = cmsVersionMatch ? (cmsVersionMatch[1] || cmsVersionMatch[2] || cmsVersionMatch[3]) : "";
  if (cmsName) cmsHints.push(cmsName);
  const cmsDetected = Boolean(cmsName) || cmsHints.length > 0;

  const cookieOrPopupCandidates = all.filter(el => {
    const txt = (el.innerText || "").toLowerCase();
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (r.width < window.innerWidth * 0.3 || r.height < 60) return false;
    const keyword = /(cookie|subscribe|newsletter|sign up|signup|join our list|special offer|discount|accept all|privacy)/.test(txt);
    return keyword && (cs.position === "fixed" || cs.position === "sticky");
  });
  const popupDetected = cookieOrPopupCandidates.length > 0;

  const chatWidgetDetected = all.some(el => {
    const txt = ((el.getAttribute("id") || "") + " " + (el.className || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (txt.includes("chat") || txt.includes("intercom") || txt.includes("drift") || txt.includes("widget")) &&
           cs.position === "fixed" && r.width >= 40 && r.height >= 40;
  });

  const reviewsSignals = /(review|testimonial|what our clients say|google reviews|five star)/i.test(text);
  const hoursSignals = /(hours|mon|tue|wed|thu|fri|sat|sun|open today)/i.test(text);
  const addressSignals = /\\d{1,5}\\s+[A-Za-z0-9.\\s]+\\b(st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane)\\b/i.test(text);

  const paintEntries = performance && performance.getEntriesByType ? performance.getEntriesByType("paint") : [];
  let fcp = null;
  if (Array.isArray(paintEntries)) {
    const entry = paintEntries.find(e => e.name === "first-contentful-paint");
    if (entry && typeof entry.startTime === "number") fcp = entry.startTime;
  }

  const navEntry = performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  let domContentLoadedMs = null, loadMs = null;
  if (navEntry) {
    domContentLoadedMs = navEntry.domContentLoadedEventEnd || null;
    loadMs = navEntry.loadEventEnd || null;
  }

  return {
    title, textSample: text.slice(0, 24000), emails, phones, socialLinks, contactPage, contactForm,
    cmsDetected, cmsHints, cmsName, cmsGenerator: genContent,
    viewportContent, hasResponsiveViewport, zoomRestricted, h1Count, descMissing, bodyTextLength: text.length,
    imagesCount: images.length, imgsMissingAlt, buttonsCount: visibleButtons.length, tinyButtons, closeButtons,
    unlabeledClickables, placeholderLinks,
    internalLinksGuess: links.filter(a => {
      try {
        const href = a.getAttribute("href") || "";
        return href.startsWith("/") || href.startsWith("#") || href.startsWith(window.location.origin);
      } catch (e) { return false; }
    }).length,
    navLinkCount, formsCount: forms.length,
    longForm: forms.some(f => f.querySelectorAll("input,textarea,select").length >= 8),
    heroMissingCTA, horizontalOverflow, overflowAmount, offscreenElements, overlappingPairs, clippedTextBlocks,
    fixedElements, stickyElements, topFixed, bottomFixed, fontSizeVariety: Array.from(new Set(fontSizes)).length,
    colorVariety: colors.size, smallFontBlocks, infiniteAnimations, transitions, autoplayMedia, largeFixedWidthSignals,
    tableCount: tables.length, frameCount: frames.length, marqueeCount: marquees.length, scriptCount: scripts.length,
    inlineStyleCount: styles.length, htmlBytes: new Blob([document.documentElement.outerHTML]).size,
    fcp, domContentLoadedMs, loadMs, genericCtas, popupDetected, popupCount: cookieOrPopupCandidates.length,
    chatWidgetDetected, mobileMenuBroken, reviewsSignals, hoursSignals, addressSignals
  };
}`;