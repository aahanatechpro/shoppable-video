(function () {
  "use strict";

  // ── Update this URL when you deploy ───────────────────────────────────────
  var APP_URL = "https://currencies-cook-characters-bloom.trycloudflare.com";

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".shoppable-video-section").forEach(initSection);
  });

  function initSection(container) {
    var widgetId = container.getAttribute("data-widget-id");
    var shop     = container.getAttribute("data-shop");

    if (!widgetId || !shop) {
      container.innerHTML = '<p class="shoppable-video-error">Please set the Widget ID in section settings.</p>';
      return;
    }

    fetch(APP_URL + "/api/widget?widgetId=" + encodeURIComponent(widgetId) + "&shop=" + encodeURIComponent(shop))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.widget) throw new Error("Widget not found");
        return fetch(APP_URL + "/api/storefront/videos?shop=" + encodeURIComponent(shop))
          .then(function (r) { return r.json(); })
          .then(function (vData) {
            renderWidget(container, data.widget, vData.videos || []);
          });
      })
      .catch(function (err) {
        console.error("[ShoppableVideo] Error:", err);
        container.innerHTML = '<p class="shoppable-video-error">Could not load videos.</p>';
      });
  }

  function renderWidget(container, widget, videos) {
    container.innerHTML = "";
    var brand = widget.brandSettings || {};

    if (widget.title && widget.titleEnabled !== false) {
      var h2 = document.createElement("h2");
      h2.className = "shoppable-video-title";
      setSafeHtml(h2, widget.title);
      if (brand.titleColor) h2.style.color = brand.titleColor;
      if (brand.titleFontSize) h2.style.fontSize = brand.titleFontSize + "px";
      container.appendChild(h2);
    }

    if (widget.description && widget.descriptionEnabled !== false) {
      var p = document.createElement("p");
      p.className = "shoppable-video-description";
      setSafeHtml(p, widget.description);
      if (brand.descriptionColor) p.style.color = brand.descriptionColor;
      if (brand.descriptionFontSize) p.style.fontSize = brand.descriptionFontSize + "px";
      container.appendChild(p);
    }

    if (videos.length === 0) {
      var empty = document.createElement("p");
      empty.className = "shoppable-video-empty";
      empty.textContent = "No videos available.";
      container.appendChild(empty);
      return;
    }

    if ((widget.layout || "grid") === "slider") {
      renderSlider(container, videos, widget);
    } else {
      renderGrid(container, videos, widget);
    }

    if (widget.buttonEnabled !== false && widget.buttonText && widget.buttonLink) {
      var btnWrap = document.createElement("div");
      btnWrap.className = "shoppable-video-btn-wrap";
      var btn = document.createElement("a");
      btn.className = "shoppable-video-btn";
      btn.href = widget.buttonLink;
      btn.textContent = widget.buttonText;
      if (brand.buttonColor) btn.style.backgroundColor = brand.buttonColor;
      if (brand.buttonTextColor) btn.style.color = brand.buttonTextColor;
      if (widget.buttonOpenNewTab) {
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
      }
      btnWrap.appendChild(btn);
      container.appendChild(btnWrap);
    }
  }

  function setSafeHtml(element, html) {
    var template = document.createElement("template");
    template.innerHTML = html;

    var allowedTags = {
      B: true,
      STRONG: true,
      I: true,
      EM: true,
      U: true,
      BR: true,
      A: true,
      SPAN: true
    };

    var allowedAttrs = {
      A: { href: true, target: true, rel: true },
      SPAN: {}
    };

    sanitizeNode(template.content, allowedTags, allowedAttrs);
    element.replaceChildren(template.content.cloneNode(true));
  }

  function sanitizeNode(root, allowedTags, allowedAttrs) {
    var nodes = Array.prototype.slice.call(root.querySelectorAll("*"));

    nodes.forEach(function (node) {
      var tagName = node.tagName;
      if (!allowedTags[tagName]) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }

      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        var attrName = attr.name.toLowerCase();
        var tagAttrs = allowedAttrs[tagName] || {};
        var isAllowed = !!tagAttrs[attrName];

        if (!isAllowed) {
          node.removeAttribute(attr.name);
          return;
        }

        if (tagName === "A" && attrName === "href") {
          var href = (node.getAttribute("href") || "").trim();
          if (!/^https?:\/\//i.test(href) && !/^(\/|#)/.test(href)) {
            node.removeAttribute("href");
          }
        }
      });

      if (tagName === "A") {
        if (node.getAttribute("target") === "_blank") {
          node.setAttribute("rel", "noopener noreferrer");
        } else {
          node.removeAttribute("target");
          node.removeAttribute("rel");
        }
      }
    });
  }

  function getVideoRedirectUrl(video, widget) {
    if (video.redirectLink) return video.redirectLink;
    if (widget.buttonLink) return widget.buttonLink;
    if (video.tags && video.tags.length > 0) {
      return video.tags[0].productUrl || "#";
    }
    return "#";
  }

  function getCornerRadius(style) {
    if (style === "rounded") return 16;
    if (style === "square") return 6;
    return 0;
  }

  function getSizeValue(value, fallback, min, max) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function getSliderSettings(widget) {
    var brand = widget.brandSettings || {};
    return {
      arrows: typeof brand.sliderArrows === "boolean" ? brand.sliderArrows : widget.sliderArrows !== false,
      arrowPosition: brand.sliderArrowPosition || widget.sliderArrowPosition || "side",
      desktopSlides: parseSlideCount(brand.sliderDesktopSlides, 5, 1, 6),
      tabletSlides: parseSlideCount(brand.sliderTabletSlides, 3, 1, 4),
      mobileSlides: parseSlideCount(brand.sliderMobileSlides, 1, 1, 2),
      zoomDesktop: brand.sliderZoomDesktop !== false,
      zoomTablet: brand.sliderZoomTablet !== false,
      autoDuration: getSizeValue(brand.sliderAutoDuration, 5, 1, 30),
      auto: typeof brand.sliderAuto === "boolean" ? brand.sliderAuto : !!widget.sliderAuto,
      loop: typeof brand.sliderLoop === "boolean" ? brand.sliderLoop : widget.sliderLoop !== false
    };
  }

  function parseSlideCount(value, fallback, min, max) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function getGridSettings(widget) {
    var brand = widget.brandSettings || {};
    return {
      desktopColumns: parseColumnCount(brand.gridDesktopColumns, widget.gridColumns || 4, 1, 6),
      tabletColumns: parseColumnCount(brand.gridTabletColumns, 3, 1, 4),
      mobileColumns: parseColumnCount(brand.gridMobileColumns, 1, 1, 2)
    };
  }

  function parseColumnCount(value, fallback, min, max) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function applyBrandVariables(target, brand) {
    target.style.setProperty("--sv-video-gap", getSizeValue(brand.videoGap, 16, 0, 40) + "px");
    target.style.setProperty("--sv-video-padding-top", getSizeValue(brand.videoPaddingTop, 20, 0, 80) + "px");
    target.style.setProperty("--sv-video-padding-right", getSizeValue(brand.videoPaddingRight, 12, 0, 80) + "px");
    target.style.setProperty("--sv-video-padding-bottom", getSizeValue(brand.videoPaddingBottom, 20, 0, 80) + "px");
    target.style.setProperty("--sv-video-padding-left", getSizeValue(brand.videoPaddingLeft, 12, 0, 80) + "px");
    target.style.setProperty("--sv-video-radius", getCornerRadius(brand.videoCornerStyle) + "px");
    target.style.setProperty("--sv-video-border-width", getSizeValue(brand.videoBorderWidth, 0, 0, 12) + "px");
    target.style.setProperty("--sv-product-card-radius", getCornerRadius(brand.productCardCornerStyle) + "px");
    target.style.setProperty("--sv-product-card-border-width", getSizeValue(brand.productCardBorderWidth, 1, 0, 12) + "px");
    target.style.setProperty("--sv-product-card-padding", getSizeValue(brand.productCardPadding, 10, 0, 40) + "px");
    target.style.setProperty("--sv-product-card-gap", getSizeValue(brand.productCardGap, 10, 0, 30) + "px");
  }

  // ── GRID ──────────────────────────────────────────────────────────────────

  function renderGrid(container, videos, widget) {
    var gridSettings = getGridSettings(widget);
    var brand = widget.brandSettings || {};
    var cols = getResponsiveColumns(gridSettings);
    var grid = document.createElement("div");
    grid.className = "shoppable-video-grid";
    grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    applyBrandVariables(grid, brand);
    container.appendChild(grid);
    videos.forEach(function (video) {
      grid.appendChild(createVideoItem(video, widget));
    });
    
    // Handle responsive columns on resize
    window.addEventListener("resize", debounce(function () {
      var newCols = getResponsiveColumns(gridSettings);
      if (newCols !== cols) {
        cols = newCols;
        grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
      }
    }, 250));
  }
  
  function getResponsiveColumns(gridSettings) {
    var width = window.innerWidth;
    if (width >= 1200) return gridSettings.desktopColumns;
    if (width >= 768) return gridSettings.tabletColumns;
    return gridSettings.mobileColumns;
  }
  
  function debounce(func, delay) {
    var timeout;
    return function () {
      clearTimeout(timeout);
      timeout = setTimeout(func, delay);
    };
  }

  // ── SLIDER ────────────────────────────────────────────────────────────────

  function renderSlider(container, videos, widget) {
    var total = videos.length;
    if (total === 0) return;
    var sliderSettings = getSliderSettings(widget);
    var brand = widget.brandSettings || {};

    var sliderWrap = document.createElement("div");
    sliderWrap.className = "shoppable-video-slider-wrap";
    sliderWrap.classList.add("arrow-pos-" + sliderSettings.arrowPosition);
    sliderWrap.style.setProperty("--sv-arrow-bg", brand.sliderArrowBackgroundColor || "#202223");
    sliderWrap.style.setProperty("--sv-arrow-color", brand.sliderArrowColor || "#ffffff");
    applyBrandVariables(sliderWrap, brand);
    sliderWrap.style.setProperty("--sv-slide-gap", getSizeValue(brand.videoGap, 16, 0, 40) + "px");

    var track = document.createElement("div");
    track.className = "shoppable-video-slider-track";
    sliderWrap.appendChild(track);

    // Handle single video differently - no carousel, just centered display
    if (total === 1) {
      var slide = createVideoItem(videos[0], widget);
      slide.classList.add("shoppable-video-slide", "single-video-center");
      track.appendChild(slide);
      
      // Auto-play the single video
      var videoEl = slide.querySelector("video");
      if (videoEl) {
        videoEl.autoplay = true;
        videoEl.play().catch(function () {});
      }
      
      container.appendChild(sliderWrap);
      return; // Exit early, no carousel logic needed
    }

    var shouldLoop = sliderSettings.loop && total > 1;
    var maxVisibleSlides = Math.max(sliderSettings.desktopSlides, sliderSettings.tabletSlides, sliderSettings.mobileSlides);
    var numClones = shouldLoop ? maxVisibleSlides : 0;

    // Create slides with duplicate items only when loop is enabled
    var allSlides = [];
    videos.forEach(function (video, idx) {
      allSlides.push({ video: video, isClone: false, index: idx });
    });
    
    for (var i = 0; i < numClones; i++) {
      allSlides.unshift({ video: videos[total - 1 - (i % total)], isClone: true, index: (total - 1 - (i % total)) });
      allSlides.push({ video: videos[i % total], isClone: true, index: i % total });
    }

    allSlides.forEach(function (slideData) {
      var slide = createVideoItem(slideData.video, widget);
      slide.classList.add("shoppable-video-slide");
      slide.setAttribute("data-index", slideData.index);
      track.appendChild(slide);
    });

    container.appendChild(sliderWrap);

    var slides = Array.prototype.slice.call(track.querySelectorAll(".shoppable-video-slide"));
    var current = numClones;
    var isTransitioning = false;
    var autoTimer = null;

    function getViewportWidth() {
      return sliderWrap.clientWidth || container.clientWidth || window.innerWidth;
    }

    function getVisibleCount() {
      var width = getViewportWidth();
      if (width >= 1024) return sliderSettings.desktopSlides;
      if (width >= 768) return sliderSettings.tabletSlides;
      return sliderSettings.mobileSlides;
    }

    function shouldZoomCenter() {
      var width = getViewportWidth();
      if (width >= 1024) return !!sliderSettings.zoomDesktop;
      if (width >= 768) return !!sliderSettings.zoomTablet;
      return false;
    }

    function applyResponsiveLayout() {
      var visibleCount = getVisibleCount();
      var centerScale = visibleCount >= 5 ? 1.06 : visibleCount >= 3 ? 1.1 : 1.04;
      sliderWrap.style.setProperty("--sv-visible-count", String(visibleCount));
      sliderWrap.style.setProperty("--sv-center-scale", String(centerScale));
      sliderWrap.classList.toggle("has-center-focus", shouldZoomCenter() && visibleCount > 1);
    }

    function updateSliderPosition(animate) {
      if (animate === undefined) animate = true;

      if (animate) {
        track.style.transition = "transform 0.4s ease";
      } else {
        track.style.transition = "none";
      }

      var targetSlide = slides[current];
      var offset = targetSlide ? targetSlide.offsetLeft : 0;
      track.style.transform = "translateX(-" + offset + "px)";
      isTransitioning = animate;

      if (animate) {
        setTimeout(function () { isTransitioning = false; }, 400);
      }
    }

    function goTo(index, skipAnimation) {
      if (isTransitioning && !skipAnimation) return;
      var realStart = numClones;
      var realEnd = allSlides.length - numClones - 1;

      if (!shouldLoop) {
        current = Math.max(0, Math.min(index, allSlides.length - 1));
      } else {
        current = index;
      }

      updateSliderPosition(!skipAnimation);

      if (shouldLoop) {
        setTimeout(function () {
          var loopRealEnd = allSlides.length - numClones;
          if (current >= loopRealEnd) {
            current = realStart;
            updateSliderPosition(false);
            updateVideoPlayback();
          } else if (current < realStart) {
            current = loopRealEnd - 1;
            updateSliderPosition(false);
            updateVideoPlayback();
          }
        }, skipAnimation ? 0 : 400);
      }

      updateVideoPlayback();
      updateArrowState();
    }

    function updateVideoPlayback() {
      var visibleCount = getVisibleCount();
      var centerIndex = Math.floor(visibleCount / 2);
      var zoomCenter = shouldZoomCenter() && visibleCount > 1;

      slides.forEach(function (slide, idx) {
        var video = slide.querySelector("video");
        var isCenterVideo = idx === current + centerIndex;
        
        slide.classList.toggle("center", isCenterVideo);
        slide.classList.toggle("zoom-active", isCenterVideo && zoomCenter);

        if (video) {
          if (isCenterVideo) {
            video.autoplay = true;
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        }
      });
    }

    function updateArrowState() {
      if (shouldLoop) return;
      prevBtn.disabled = current <= 0;
      nextBtn.disabled = current >= allSlides.length - getVisibleCount();
    }

    function startAutoplay() {
      clearInterval(autoTimer);
      if (!sliderSettings.auto) return;
      autoTimer = setInterval(function () {
        if (!shouldLoop && current >= allSlides.length - getVisibleCount()) {
          clearInterval(autoTimer);
          return;
        }
        goTo(current + 1);
      }, sliderSettings.autoDuration * 1000);
    }

    // Arrow buttons
    var prevBtn = document.createElement("button");
    prevBtn.className = "shoppable-video-arrow shoppable-video-arrow-prev";
    prevBtn.innerHTML = "&#8592;";
    prevBtn.addEventListener("click", function () {
      clearInterval(autoTimer);
      goTo(current - 1);
      startAutoplay();
    });

    var nextBtn = document.createElement("button");
    nextBtn.className = "shoppable-video-arrow shoppable-video-arrow-next";
    nextBtn.innerHTML = "&#8594;";
    nextBtn.addEventListener("click", function () {
      clearInterval(autoTimer);
      goTo(current + 1);
      startAutoplay();
    });

    if (sliderSettings.arrows) {
      sliderWrap.appendChild(prevBtn);
      sliderWrap.appendChild(nextBtn);
    }

    // Auto scroll
    // Handle window resize
    window.addEventListener("resize", debounce(function () {
      applyResponsiveLayout();
      updateSliderPosition(false);
      updateVideoPlayback();
      updateArrowState();
    }, 250));

    // Initial setup
    applyResponsiveLayout();
    updateSliderPosition(false);
    updateVideoPlayback();
    updateArrowState();
    startAutoplay();
  }

  // ── Video item ────────────────────────────────────────────────────────────

  function createVideoItem(video, widget) {
    var item = document.createElement("div");
    item.className = "shoppable-video-item";

    var playerWrap = document.createElement("div");
    playerWrap.className = "shoppable-video-player-wrapper";

    var videoEl = document.createElement("video");
    videoEl.className   = "shoppable-video-player";
    videoEl.controls    = false;
    videoEl.playsInline = true;
    videoEl.preload     = "metadata";
    videoEl.crossOrigin = "anonymous";
    videoEl.muted       = true; // Required for autoplay
    if (video.storageKey)   videoEl.src    = video.storageKey;
    if (video.thumbnailKey) videoEl.poster = video.thumbnailKey;

    if (widget.redirectOnLink) {
      var redirectUrl = getVideoRedirectUrl(video, widget);
      if (redirectUrl && redirectUrl !== "#") {
        item.style.cursor = "pointer";
        item.addEventListener("click", function (event) {
          if (event.target && event.target.closest && event.target.closest("a")) return;
          if (widget.buttonOpenNewTab) {
            window.open(redirectUrl, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = redirectUrl;
          }
        });
      }
    }

    playerWrap.appendChild(videoEl);
    item.appendChild(playerWrap);

    // Commented out video title
    // if (video.title) {
    //   var titleEl = document.createElement("p");
    //   titleEl.className   = "shoppable-video-item-title";
    //   titleEl.textContent = video.title;
    //   item.appendChild(titleEl);
    // }

    // Tagged product cards at bottom
    if (!widget.hideTaggedProducts && video.tags && video.tags.length > 0) {
      var taggedWrap = document.createElement("div");
      taggedWrap.className = "shoppable-video-tagged-products";

      video.tags.forEach(function (tag) {
        var card = document.createElement("a");
        card.className = "shoppable-video-tagged-card";
        card.href      = tag.productUrl || "#";
        card.target    = "_blank";

        if (tag.image) {
          var img = document.createElement("img");
          img.src = tag.image; img.alt = tag.title || "";
          img.className = "shoppable-video-tagged-img";
          card.appendChild(img);
        } else {
          var ph = document.createElement("div");
          ph.className = "shoppable-video-tagged-img-placeholder";
          card.appendChild(ph);
        }

        var info = document.createElement("div");
        info.className = "shoppable-video-tagged-info";

        var tt = document.createElement("p");
        tt.className = "shoppable-video-tagged-title";
        tt.textContent = tag.title || "";

        var tp = document.createElement("p");
        tp.className = "shoppable-video-tagged-price";
        tp.textContent = tag.price || "";

        info.appendChild(tt);
        info.appendChild(tp);
        card.appendChild(info);

        var addBtn = document.createElement("div");
        addBtn.className = "shoppable-video-tagged-add";
        addBtn.innerHTML = "+";
        card.appendChild(addBtn);

        taggedWrap.appendChild(card);
      });

      item.appendChild(taggedWrap);
    }

    return item;
  }

})();
