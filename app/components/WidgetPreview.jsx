import { useEffect, useState } from "react";
import { Card, BlockStack, Box, Text } from "@shopify/polaris";

function renderHtml(text) {
  return { __html: text || "" };
}

function getCornerRadius(style) {
  if (style === "rounded") return 16;
  if (style === "square") return 6;
  return 0;
}

function PreviewCard({ video, title, showTags, zoomed, videoStyle, productCardStyle }) {
  const previewImage = video?.thumbnailKey || null;
  const previewVideo = !previewImage && video?.storageKey ? video.storageKey : null;
  const taggedProduct = video?.tags?.[0] || null;

  return (
    <div
      style={{
        minWidth: 0,
        transform: zoomed ? "scale(1.08)" : "scale(1)",
        opacity: zoomed ? 1 : 0.72,
        transition: "transform 0.2s ease, opacity 0.2s ease",
      }}
    >
      <div
        style={{
          aspectRatio: "9 / 16",
          borderRadius: `${videoStyle.borderRadius}px`,
          border: videoStyle.borderWidth ? `${videoStyle.borderWidth}px solid #d0d5dd` : "none",
          background: previewImage
            ? `center / cover no-repeat url("${previewImage}")`
            : "linear-gradient(180deg, rgba(24,24,27,0.92) 0%, rgba(57,57,63,0.96) 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow: zoomed
            ? "0 20px 40px rgba(15, 23, 42, 0.22)"
            : "0 10px 24px rgba(15, 23, 42, 0.12)",
        }}
      >
        {previewVideo && (
          <video
            src={previewVideo}
            muted
            playsInline
            autoPlay
            loop
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}
        {!previewImage && !previewVideo && (
          <div
            style={{
              position: "absolute",
              inset: "50% auto auto 50%",
              transform: "translate(-50%, -50%)",
              width: "58px",
              height: "58px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "22px",
            }}
          >
            &#9654;
          </div>
        )}
      </div>
      {showTags && (
        <div
          style={{
            marginTop: "10px",
            border: productCardStyle.borderWidth ? `${productCardStyle.borderWidth}px solid #e5e7eb` : "none",
            borderRadius: `${productCardStyle.borderRadius}px`,
            padding: `${productCardStyle.padding}px`,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: `${productCardStyle.gap}px`,
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
            {taggedProduct?.title || title || "Tagged Product"}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            {taggedProduct?.price || "USD 49.00"}
          </div>
        </div>
      )}
    </div>
  );
}

export function WidgetPreview({
  title,
  description,
  buttonText,
  titleEnabled,
  descriptionEnabled,
  buttonEnabled,
  hideTaggedProducts,
  layout,
  gridColumns,
  sliderArrows,
  sliderArrowPosition,
  brandSettings,
  videos,
}) {
  const brand = {
    titleColor: "",
    titleFontSize: null,
    descriptionColor: "",
    descriptionFontSize: null,
    buttonColor: "",
    buttonTextColor: "",
    sliderArrowBackgroundColor: "#202223",
    sliderArrowColor: "#ffffff",
    sliderAutoDuration: 5,
    gridDesktopColumns: 4,
    gridTabletColumns: 3,
    gridMobileColumns: 1,
    videoCornerStyle: "rounded",
    videoBorderWidth: 0,
    videoGap: 16,
    videoPaddingTop: 20,
    videoPaddingRight: 12,
    videoPaddingBottom: 20,
    videoPaddingLeft: 12,
    productCardCornerStyle: "rounded",
    productCardBorderWidth: 1,
    productCardPadding: 10,
    productCardGap: 10,
    sliderArrows: true,
    sliderArrowPosition: "side",
    sliderDesktopSlides: 5,
    sliderTabletSlides: 3,
    sliderMobileSlides: 1,
    sliderZoomDesktop: true,
    sliderZoomTablet: true,
    sliderAuto: false,
    sliderLoop: true,
    ...(brandSettings || {}),
  };

  const fallbackCount = layout === "slider"
    ? Math.max(brand.sliderDesktopSlides || 5, brand.sliderTabletSlides || 3, brand.sliderMobileSlides || 1)
    : Math.max(3, Number(gridColumns) || 3);
  const previewCards = videos?.length
    ? videos
    : Array.from({ length: fallbackCount }, (_, index) => ({ id: `mock-${index}` }));
  const previewSliderArrows = typeof brand.sliderArrows === "boolean" ? brand.sliderArrows : sliderArrows;
  const previewArrowPosition = brand.sliderArrowPosition || sliderArrowPosition || "side";
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1200 : window.innerWidth
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  function getSliderVisibleCount() {
    if (viewportWidth <= 640) return brand.sliderMobileSlides || 1;
    if (viewportWidth <= 900) return brand.sliderTabletSlides || 3;
    return brand.sliderDesktopSlides || 5;
  }

  function getGridVisibleColumns() {
    if (viewportWidth <= 640) return brand.gridMobileColumns || 1;
    if (viewportWidth <= 900) return brand.gridTabletColumns || 3;
    return brand.gridDesktopColumns || Math.max(1, Number(gridColumns) || 3);
  }

  function isZoomEnabled() {
    if (viewportWidth <= 640) return false;
    if (viewportWidth <= 900) return !!brand.sliderZoomTablet;
    return !!brand.sliderZoomDesktop;
  }

  const visibleCount = getSliderVisibleCount();
  const maxStartIndex = Math.max(0, previewCards.length - visibleCount);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxStartIndex));
  }, [maxStartIndex, visibleCount, layout]);

  useEffect(() => {
    if (layout !== "slider" || !brand.sliderAuto || previewCards.length <= visibleCount) return undefined;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= maxStartIndex) {
          return brand.sliderLoop ? 0 : prev;
        }
        return prev + 1;
      });
    }, Math.max(1000, (brand.sliderAutoDuration || 5) * 1000));

    return () => window.clearInterval(timer);
  }, [layout, brand.sliderAuto, brand.sliderAutoDuration, brand.sliderLoop, previewCards.length, visibleCount, maxStartIndex]);

  function goPrev() {
    setCurrentIndex((prev) => {
      if (prev <= 0) return brand.sliderLoop ? maxStartIndex : 0;
      return prev - 1;
    });
  }

  function goNext() {
    setCurrentIndex((prev) => {
      if (prev >= maxStartIndex) return brand.sliderLoop ? 0 : maxStartIndex;
      return prev + 1;
    });
  }

  function getVisibleSliderCards() {
    const items = [];
    for (let index = 0; index < visibleCount; index += 1) {
      if (previewCards.length === 0) {
        items.push({ id: `mock-${index}` });
      } else if (!brand.sliderLoop) {
        items.push(previewCards[currentIndex + index] || { id: `empty-${index}` });
      } else {
        items.push(previewCards[(currentIndex + index) % previewCards.length]);
      }
    }
    return items;
  }

  const visibleSliderCards = getVisibleSliderCards();
  const centerIndex = Math.floor(visibleSliderCards.length / 2);

  return (
    <Card>
      <BlockStack gap="300">
        <div>
          <Text as="h2" variant="headingMd">
            Live Preview
          </Text>
          <Text as="p" tone="subdued" variant="bodySm">
            A quick storefront preview of your current widget settings.
          </Text>
        </div>

        <Box
          background="bg-surface-secondary"
          borderRadius="300"
          padding="400"
          borderWidth="1"
          borderColor="border-secondary"
        >
          <style>{`
            .widget-live-preview a { text-decoration: none; }
            .widget-live-preview .preview-slider {
              position: relative;
              padding: 18px 0;
            }
            .widget-live-preview .preview-track {
              display: grid;
              gap: ${brand.videoGap || 16}px;
              align-items: start;
            }
            .widget-live-preview .preview-grid {
              display: grid;
              gap: ${brand.videoGap || 16}px;
              align-items: start;
            }
            .widget-live-preview .preview-arrows {
              position: absolute;
              inset: 0;
              pointer-events: none;
            }
            .widget-live-preview .preview-arrow {
              width: 42px;
              height: 42px;
              border-radius: 999px;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              position: absolute;
              pointer-events: auto;
              background: ${brand.sliderArrowBackgroundColor || "#202223"};
              color: ${brand.sliderArrowColor || "#ffffff"};
              box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
            }
            .widget-live-preview .preview-arrow:disabled {
              opacity: 0.45;
              cursor: not-allowed;
            }
            .widget-live-preview .preview-arrows.side .preview-arrow {
              top: 50%;
              transform: translateY(-50%);
            }
            .widget-live-preview .preview-arrows.side .preview-arrow.prev { left: -10px; }
            .widget-live-preview .preview-arrows.side .preview-arrow.next { right: -10px; }
            .widget-live-preview .preview-arrows.above .preview-arrow {
              top: -10px;
            }
            .widget-live-preview .preview-arrows.above .preview-arrow.prev { left: calc(50% - 50px); }
            .widget-live-preview .preview-arrows.above .preview-arrow.next { right: calc(50% - 50px); }
            .widget-live-preview .preview-arrows.bottom .preview-arrow {
              bottom: -12px;
            }
            .widget-live-preview .preview-arrows.bottom .preview-arrow.prev { left: calc(50% - 50px); }
            .widget-live-preview .preview-arrows.bottom .preview-arrow.next { right: calc(50% - 50px); }
            @media (max-width: 900px) {
              .widget-live-preview .preview-track.desktop { grid-template-columns: repeat(${brand.sliderTabletSlides || 3}, minmax(0, 1fr)) !important; }
              .widget-live-preview .preview-grid { grid-template-columns: repeat(${brand.gridTabletColumns || 3}, minmax(0, 1fr)) !important; }
              .widget-live-preview .preview-card.desktop-zoom {
                opacity: 1;
              }
            }
            @media (max-width: 640px) {
              .widget-live-preview .preview-track.desktop { grid-template-columns: repeat(${brand.sliderMobileSlides || 1}, minmax(0, 1fr)) !important; }
              .widget-live-preview .preview-grid { grid-template-columns: repeat(${brand.gridMobileColumns || 1}, minmax(0, 1fr)) !important; }
              .widget-live-preview .preview-card.desktop-zoom {
                opacity: 1;
              }
            }
          `}</style>

          <div className="widget-live-preview">
            <div
              style={{
                maxWidth: "1200px",
                margin: "0 auto",
                padding: `${brand.videoPaddingTop || 20}px ${brand.videoPaddingRight || 12}px ${brand.videoPaddingBottom || 20}px ${brand.videoPaddingLeft || 12}px`,
              }}
            >
              {titleEnabled && (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: brand.titleFontSize ? `${brand.titleFontSize}px` : "32px",
                    color: brand.titleColor || "#111827",
                    fontWeight: 700,
                    marginBottom: "12px",
                    lineHeight: 1.2,
                  }}
                  dangerouslySetInnerHTML={renderHtml(title || "Watch & Shop")}
                />
              )}

              {descriptionEnabled && (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: brand.descriptionFontSize
                      ? `${brand.descriptionFontSize}px`
                      : "16px",
                    color: brand.descriptionColor || "#6b7280",
                    maxWidth: "660px",
                    margin: "0 auto 26px",
                    lineHeight: 1.5,
                  }}
                  dangerouslySetInnerHTML={renderHtml(
                    description || "Show customers how to discover and shop your featured products."
                  )}
                />
              )}

              {layout === "slider" ? (
                <div className="preview-slider">
                  {previewSliderArrows && (
                    <div className={`preview-arrows ${previewArrowPosition}`}>
                      <button
                        className="preview-arrow prev"
                        type="button"
                        aria-label="Previous"
                        onClick={goPrev}
                        disabled={!brand.sliderLoop && currentIndex <= 0}
                      >
                        &#8592;
                      </button>
                      <button
                        className="preview-arrow next"
                        type="button"
                        aria-label="Next"
                        onClick={goNext}
                        disabled={!brand.sliderLoop && currentIndex >= maxStartIndex}
                      >
                        &#8594;
                      </button>
                    </div>
                  )}
                  <div
                    className="preview-track desktop"
                    style={{ gridTemplateColumns: `repeat(${visibleSliderCards.length || 1}, minmax(0, 1fr))` }}
                  >
                    {visibleSliderCards.map((card, index) => (
                      <div
                        key={`${card.id || index}-${index}`}
                        className={
                          index === centerIndex && isZoomEnabled()
                            ? "preview-card desktop-zoom"
                            : "preview-card"
                        }
                      >
                        <PreviewCard
                          video={card}
                          title={buttonText || "Shop Now"}
                          showTags={!hideTaggedProducts}
                          zoomed={index === centerIndex && isZoomEnabled()}
                          videoStyle={{
                            borderRadius: getCornerRadius(brand.videoCornerStyle),
                            borderWidth: brand.videoBorderWidth || 0,
                          }}
                          productCardStyle={{
                            borderRadius: getCornerRadius(brand.productCardCornerStyle),
                            borderWidth: brand.productCardBorderWidth || 0,
                            padding: brand.productCardPadding || 10,
                            gap: brand.productCardGap || 10,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="preview-grid"
                  style={{
                    gridTemplateColumns: `repeat(${getGridVisibleColumns()}, minmax(0, 1fr))`,
                  }}
                >
                  {previewCards.map((_, index) => (
                    <PreviewCard
                      key={previewCards[index].id || index}
                      video={previewCards[index]}
                      title={buttonText || "Shop Now"}
                      showTags={!hideTaggedProducts}
                      zoomed={false}
                      videoStyle={{
                        borderRadius: getCornerRadius(brand.videoCornerStyle),
                        borderWidth: brand.videoBorderWidth || 0,
                      }}
                      productCardStyle={{
                        borderRadius: getCornerRadius(brand.productCardCornerStyle),
                        borderWidth: brand.productCardBorderWidth || 0,
                        padding: brand.productCardPadding || 10,
                        gap: brand.productCardGap || 10,
                      }}
                    />
                  ))}
                </div>
              )}

              {buttonEnabled && (
                <div style={{ textAlign: "center", marginTop: "26px" }}>
                  <a
                    href="#"
                    style={{
                      display: "inline-block",
                      padding: "12px 22px",
                      borderRadius: "10px",
                      background: brand.buttonColor || "#111827",
                      color: brand.buttonTextColor || "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    {buttonText || "Shop Now"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </Box>
      </BlockStack>
    </Card>
  );
}
