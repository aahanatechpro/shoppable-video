// Public GET endpoint for storefront widget
// GET /api/widget?widgetId=xxx&shop=xxx

export async function loader({ request }) {
  const url      = new URL(request.url);
  const widgetId = url.searchParams.get("widgetId");
  const shop     = url.searchParams.get("shop");

  if (!widgetId || !shop) {
    return Response.json({ error: "Missing widgetId or shop" }, { status: 400 });
  }

  const { default: prisma } = await import("../db.server.js");

  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, shop },
  });

  if (!widget) {
    return Response.json({ error: "Widget not found" }, { status: 404 });
  }

  let brandSettings = {
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

  try {
    brandSettings = { ...brandSettings, ...(widget.brandSettings ? JSON.parse(widget.brandSettings) : {}) };
  } catch {}

  return Response.json({ widget: { ...widget, brandSettings } }, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET",
      "Content-Type":                 "application/json",
    },
  });
}
