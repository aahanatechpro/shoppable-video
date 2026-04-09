import { authenticate } from "../shopify.server";

const DEFAULT_BRAND_SETTINGS = {
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
};

function parseOptionalColor(value) {
  const color = String(value || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : "";
}

function parseOptionalFontSize(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const size = parseInt(trimmed, 10);
  return Number.isNaN(size) ? null : Math.min(72, Math.max(10, size));
}

function parseSlideCount(value, fallback, min, max) {
  const parsed = parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseColumnCount(value, fallback, min, max) {
  const parsed = parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseSizeValue(value, fallback, min, max) {
  const parsed = parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildBrandSettings(formData) {
  return JSON.stringify({
    ...DEFAULT_BRAND_SETTINGS,
    titleColor: parseOptionalColor(formData.get("titleColor")),
    titleFontSize: parseOptionalFontSize(formData.get("titleFontSize")),
    descriptionColor: parseOptionalColor(formData.get("descriptionColor")),
    descriptionFontSize: parseOptionalFontSize(formData.get("descriptionFontSize")),
    buttonColor: parseOptionalColor(formData.get("buttonColor")),
    buttonTextColor: parseOptionalColor(formData.get("buttonTextColor")),
    sliderArrowBackgroundColor: parseOptionalColor(formData.get("sliderArrowBackgroundColor")) || DEFAULT_BRAND_SETTINGS.sliderArrowBackgroundColor,
    sliderArrowColor: parseOptionalColor(formData.get("sliderArrowColor")) || DEFAULT_BRAND_SETTINGS.sliderArrowColor,
    sliderAutoDuration: parseSizeValue(formData.get("sliderAutoDuration"), DEFAULT_BRAND_SETTINGS.sliderAutoDuration, 1, 30),
    gridDesktopColumns: parseColumnCount(formData.get("gridDesktopColumns"), DEFAULT_BRAND_SETTINGS.gridDesktopColumns, 1, 6),
    gridTabletColumns: parseColumnCount(formData.get("gridTabletColumns"), DEFAULT_BRAND_SETTINGS.gridTabletColumns, 1, 4),
    gridMobileColumns: parseColumnCount(formData.get("gridMobileColumns"), DEFAULT_BRAND_SETTINGS.gridMobileColumns, 1, 2),
    videoCornerStyle: ["rounded", "square", "none"].includes(formData.get("videoCornerStyle")) ? formData.get("videoCornerStyle") : DEFAULT_BRAND_SETTINGS.videoCornerStyle,
    videoBorderWidth: parseSizeValue(formData.get("videoBorderWidth"), DEFAULT_BRAND_SETTINGS.videoBorderWidth, 0, 12),
    videoGap: parseSizeValue(formData.get("videoGap"), DEFAULT_BRAND_SETTINGS.videoGap, 0, 40),
    videoPaddingTop: parseSizeValue(formData.get("videoPaddingTop"), DEFAULT_BRAND_SETTINGS.videoPaddingTop, 0, 80),
    videoPaddingRight: parseSizeValue(formData.get("videoPaddingRight"), DEFAULT_BRAND_SETTINGS.videoPaddingRight, 0, 80),
    videoPaddingBottom: parseSizeValue(formData.get("videoPaddingBottom"), DEFAULT_BRAND_SETTINGS.videoPaddingBottom, 0, 80),
    videoPaddingLeft: parseSizeValue(formData.get("videoPaddingLeft"), DEFAULT_BRAND_SETTINGS.videoPaddingLeft, 0, 80),
    productCardCornerStyle: ["rounded", "square", "none"].includes(formData.get("productCardCornerStyle")) ? formData.get("productCardCornerStyle") : DEFAULT_BRAND_SETTINGS.productCardCornerStyle,
    productCardBorderWidth: parseSizeValue(formData.get("productCardBorderWidth"), DEFAULT_BRAND_SETTINGS.productCardBorderWidth, 0, 12),
    productCardPadding: parseSizeValue(formData.get("productCardPadding"), DEFAULT_BRAND_SETTINGS.productCardPadding, 0, 40),
    productCardGap: parseSizeValue(formData.get("productCardGap"), DEFAULT_BRAND_SETTINGS.productCardGap, 0, 30),
    sliderArrows: formData.get("sliderArrows") !== "false",
    sliderArrowPosition: ["side", "above", "bottom"].includes(formData.get("sliderArrowPosition")) ? formData.get("sliderArrowPosition") : DEFAULT_BRAND_SETTINGS.sliderArrowPosition,
    sliderDesktopSlides: parseSlideCount(formData.get("sliderDesktopSlides"), DEFAULT_BRAND_SETTINGS.sliderDesktopSlides, 1, 6),
    sliderTabletSlides: parseSlideCount(formData.get("sliderTabletSlides"), DEFAULT_BRAND_SETTINGS.sliderTabletSlides, 1, 4),
    sliderMobileSlides: parseSlideCount(formData.get("sliderMobileSlides"), DEFAULT_BRAND_SETTINGS.sliderMobileSlides, 1, 2),
    sliderZoomDesktop: formData.get("sliderZoomDesktop") !== "false",
    sliderZoomTablet: formData.get("sliderZoomTablet") !== "false",
    sliderAuto: formData.get("sliderAuto") === "true",
    sliderLoop: formData.get("sliderLoop") !== "false",
  });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const { default: prisma } = await import("../db.server.js");
  const formData = await request.formData();
  const action   = formData.get("action");

  if (action === "create") {
    const widget = await prisma.widget.create({
      data: {
        shop,
        title:       formData.get("title")       || "My Widget",
        description: formData.get("description") || null,
        buttonText:  formData.get("buttonText")  || "Shop Now",
        buttonLink:  formData.get("buttonLink")  || null,
        titleEnabled: formData.get("titleEnabled") !== "false",
        descriptionEnabled: formData.get("descriptionEnabled") !== "false",
        buttonEnabled: formData.get("buttonEnabled") !== "false",
        buttonOpenNewTab: formData.get("buttonOpenNewTab") === "true",
        brandSettings: buildBrandSettings(formData),
        hideTaggedProducts: formData.get("hideTaggedProducts") === "true",
        redirectOnLink: formData.get("redirectOnLink") === "true",
        sliderArrowPosition: formData.get("sliderArrowPosition") || "side",
      },
    });
    return Response.json({ success: true, widget });
  }

  if (action === "update") {
    const widgetId = formData.get("widgetId");
    const widget   = await prisma.widget.findFirst({ where: { id: widgetId, shop } });
    if (!widget) return Response.json({ error: "Widget not found" }, { status: 404 });
    const updated = await prisma.widget.update({
      where: { id: widgetId },
      data: {
        title:       formData.get("title")       || widget.title,
        description: formData.get("description") || null,
        buttonText:  formData.get("buttonText")  || "Shop Now",
        buttonLink:  formData.get("buttonLink")  || null,
        titleEnabled: formData.get("titleEnabled") !== "false",
        descriptionEnabled: formData.get("descriptionEnabled") !== "false",
        buttonEnabled: formData.get("buttonEnabled") !== "false",
        buttonOpenNewTab: formData.get("buttonOpenNewTab") === "true",
        brandSettings: buildBrandSettings(formData),
        hideTaggedProducts: formData.get("hideTaggedProducts") === "true",
        redirectOnLink: formData.get("redirectOnLink") === "true",
        sliderArrowPosition: formData.get("sliderArrowPosition") || "side",
      },
    });
    return Response.json({ success: true, widget: updated });
  }

  if (action === "delete") {
    const widgetId = formData.get("widgetId");
    await prisma.widget.deleteMany({ where: { id: widgetId, shop } });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
