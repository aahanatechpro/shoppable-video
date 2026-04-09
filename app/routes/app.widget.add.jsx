import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { WidgetPreview } from "../components/WidgetPreview";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Banner,
  InlineStack,
  BlockStack,
  Box,
  Text,
  Tabs,
} from "@shopify/polaris";

function parseOptionalColor(value) {
  const color = String(value || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : null;
}

function parseOptionalFontSize(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const size = parseInt(trimmed, 10);
  if (Number.isNaN(size)) return null;
  return Math.min(72, Math.max(10, size));
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

function buildBrandSettings(input) {
  return JSON.stringify({
    ...DEFAULT_BRAND_SETTINGS,
    titleColor: parseOptionalColor(input.titleColor) || "",
    titleFontSize: parseOptionalFontSize(input.titleFontSize),
    descriptionColor: parseOptionalColor(input.descriptionColor) || "",
    descriptionFontSize: parseOptionalFontSize(input.descriptionFontSize),
    buttonColor: parseOptionalColor(input.buttonColor) || "",
    buttonTextColor: parseOptionalColor(input.buttonTextColor) || "",
    sliderArrowBackgroundColor: parseOptionalColor(input.sliderArrowBackgroundColor) || DEFAULT_BRAND_SETTINGS.sliderArrowBackgroundColor,
    sliderArrowColor: parseOptionalColor(input.sliderArrowColor) || DEFAULT_BRAND_SETTINGS.sliderArrowColor,
    sliderAutoDuration: parseSizeValue(input.sliderAutoDuration, DEFAULT_BRAND_SETTINGS.sliderAutoDuration, 1, 30),
    gridDesktopColumns: parseColumnCount(input.gridDesktopColumns, DEFAULT_BRAND_SETTINGS.gridDesktopColumns, 1, 6),
    gridTabletColumns: parseColumnCount(input.gridTabletColumns, DEFAULT_BRAND_SETTINGS.gridTabletColumns, 1, 4),
    gridMobileColumns: parseColumnCount(input.gridMobileColumns, DEFAULT_BRAND_SETTINGS.gridMobileColumns, 1, 2),
    videoCornerStyle: ["rounded", "square", "none"].includes(input.videoCornerStyle) ? input.videoCornerStyle : DEFAULT_BRAND_SETTINGS.videoCornerStyle,
    videoBorderWidth: parseSizeValue(input.videoBorderWidth, DEFAULT_BRAND_SETTINGS.videoBorderWidth, 0, 12),
    videoGap: parseSizeValue(input.videoGap, DEFAULT_BRAND_SETTINGS.videoGap, 0, 40),
    videoPaddingTop: parseSizeValue(input.videoPaddingTop, DEFAULT_BRAND_SETTINGS.videoPaddingTop, 0, 80),
    videoPaddingRight: parseSizeValue(input.videoPaddingRight, DEFAULT_BRAND_SETTINGS.videoPaddingRight, 0, 80),
    videoPaddingBottom: parseSizeValue(input.videoPaddingBottom, DEFAULT_BRAND_SETTINGS.videoPaddingBottom, 0, 80),
    videoPaddingLeft: parseSizeValue(input.videoPaddingLeft, DEFAULT_BRAND_SETTINGS.videoPaddingLeft, 0, 80),
    productCardCornerStyle: ["rounded", "square", "none"].includes(input.productCardCornerStyle) ? input.productCardCornerStyle : DEFAULT_BRAND_SETTINGS.productCardCornerStyle,
    productCardBorderWidth: parseSizeValue(input.productCardBorderWidth, DEFAULT_BRAND_SETTINGS.productCardBorderWidth, 0, 12),
    productCardPadding: parseSizeValue(input.productCardPadding, DEFAULT_BRAND_SETTINGS.productCardPadding, 0, 40),
    productCardGap: parseSizeValue(input.productCardGap, DEFAULT_BRAND_SETTINGS.productCardGap, 0, 30),
    sliderArrows: input.sliderArrows !== false,
    sliderArrowPosition: ["side", "above", "bottom"].includes(input.sliderArrowPosition) ? input.sliderArrowPosition : DEFAULT_BRAND_SETTINGS.sliderArrowPosition,
    sliderDesktopSlides: parseSlideCount(input.sliderDesktopSlides, DEFAULT_BRAND_SETTINGS.sliderDesktopSlides, 1, 6),
    sliderTabletSlides: parseSlideCount(input.sliderTabletSlides, DEFAULT_BRAND_SETTINGS.sliderTabletSlides, 1, 4),
    sliderMobileSlides: parseSlideCount(input.sliderMobileSlides, DEFAULT_BRAND_SETTINGS.sliderMobileSlides, 1, 2),
    sliderZoomDesktop: input.sliderZoomDesktop !== false,
    sliderZoomTablet: input.sliderZoomTablet !== false,
    sliderAuto: input.sliderAuto === true,
    sliderLoop: input.sliderLoop !== false,
  });
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server.js");
  const videos = await prisma.video.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { tags: true },
  });

  return Response.json({ shop: session.shop, videos });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server.js");
  const formData = await request.formData();

  const title       = formData.get("title");
  const description = formData.get("description") || null;
  const buttonText  = formData.get("buttonText")  || "Shop Now";
  const buttonLink  = formData.get("buttonLink")  || null;
  const titleEnabled = formData.get("titleEnabled") === "true";
  const descriptionEnabled = formData.get("descriptionEnabled") === "true";
  const buttonEnabled = formData.get("buttonEnabled") === "true";
  const buttonOpenNewTab = formData.get("buttonOpenNewTab") === "true";
  const hideTaggedProducts = formData.get("hideTaggedProducts") === "true";
  const redirectOnLink = formData.get("redirectOnLink") === "true";
  const layout      = formData.get("layout")      || "grid";
  const gridColumns = parseInt(formData.get("gridColumns") || "3");
  const sliderArrows = formData.get("sliderArrows") === "true";
  const sliderArrowPosition = formData.get("sliderArrowPosition") || "side";
  const sliderAuto   = formData.get("sliderAuto")   === "true";
  const sliderLoop   = formData.get("sliderLoop")   === "true";

  if (!title?.trim()) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const widget = await prisma.widget.create({
    data: {
      shop:        session.shop,
      title:       title.trim(),
      description: description?.trim() || null,
      buttonText:  buttonText?.trim()  || "Shop Now",
      buttonLink:  buttonLink?.trim()  || null,
      titleEnabled,
      descriptionEnabled,
      buttonEnabled,
      buttonOpenNewTab,
      brandSettings: buildBrandSettings({
        titleColor: formData.get("titleColor"),
        titleFontSize: formData.get("titleFontSize"),
        descriptionColor: formData.get("descriptionColor"),
        descriptionFontSize: formData.get("descriptionFontSize"),
        buttonColor: formData.get("buttonColor"),
        buttonTextColor: formData.get("buttonTextColor"),
        sliderArrowBackgroundColor: formData.get("sliderArrowBackgroundColor"),
        sliderArrowColor: formData.get("sliderArrowColor"),
        sliderAutoDuration: formData.get("sliderAutoDuration"),
        gridDesktopColumns: formData.get("gridDesktopColumns"),
        gridTabletColumns: formData.get("gridTabletColumns"),
        gridMobileColumns: formData.get("gridMobileColumns"),
        videoCornerStyle: formData.get("videoCornerStyle"),
        videoBorderWidth: formData.get("videoBorderWidth"),
        videoGap: formData.get("videoGap"),
        videoPaddingTop: formData.get("videoPaddingTop"),
        videoPaddingRight: formData.get("videoPaddingRight"),
        videoPaddingBottom: formData.get("videoPaddingBottom"),
        videoPaddingLeft: formData.get("videoPaddingLeft"),
        productCardCornerStyle: formData.get("productCardCornerStyle"),
        productCardBorderWidth: formData.get("productCardBorderWidth"),
        productCardPadding: formData.get("productCardPadding"),
        productCardGap: formData.get("productCardGap"),
        sliderArrows,
        sliderArrowPosition,
        sliderDesktopSlides: formData.get("sliderDesktopSlides"),
        sliderTabletSlides: formData.get("sliderTabletSlides"),
        sliderMobileSlides: formData.get("sliderMobileSlides"),
        sliderZoomDesktop: formData.get("sliderZoomDesktop") === "true",
        sliderZoomTablet: formData.get("sliderZoomTablet") === "true",
        sliderAuto,
        sliderLoop,
      }),
      hideTaggedProducts,
      redirectOnLink,
      layout,
      gridColumns,
      sliderArrows,
      sliderArrowPosition,
      sliderAuto,
      sliderLoop,
    },
  });

  return Response.json({ success: true, widget });
}

export default function CreateWidget() {
  const { videos } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate   = useNavigate();
  const submit     = useSubmit();

  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [buttonText,   setButtonText]   = useState("Shop Now");
  const [buttonLink,   setButtonLink]   = useState("");
  const [titleEnabled, setTitleEnabled] = useState(true);
  const [titleColor, setTitleColor] = useState("");
  const [titleFontSize, setTitleFontSize] = useState("");
  const [descriptionEnabled, setDescriptionEnabled] = useState(true);
  const [descriptionColor, setDescriptionColor] = useState("");
  const [descriptionFontSize, setDescriptionFontSize] = useState("");
  const [buttonEnabled, setButtonEnabled] = useState(true);
  const [buttonColor, setButtonColor] = useState("");
  const [buttonTextColor, setButtonTextColor] = useState("");
  const [sliderArrowBackgroundColor, setSliderArrowBackgroundColor] = useState(DEFAULT_BRAND_SETTINGS.sliderArrowBackgroundColor);
  const [sliderArrowColor, setSliderArrowColor] = useState(DEFAULT_BRAND_SETTINGS.sliderArrowColor);
  const [sliderAutoDuration, setSliderAutoDuration] = useState(String(DEFAULT_BRAND_SETTINGS.sliderAutoDuration));
  const [buttonOpenNewTab, setButtonOpenNewTab] = useState(false);
  const [hideTaggedProducts, setHideTaggedProducts] = useState(false);
  const [redirectOnLink, setRedirectOnLink] = useState(false);
  const [layout,       setLayout]       = useState("grid");
  const [gridColumns,  setGridColumns]  = useState("3");
  const [gridDesktopColumns, setGridDesktopColumns] = useState(String(DEFAULT_BRAND_SETTINGS.gridDesktopColumns));
  const [gridTabletColumns, setGridTabletColumns] = useState(String(DEFAULT_BRAND_SETTINGS.gridTabletColumns));
  const [gridMobileColumns, setGridMobileColumns] = useState(String(DEFAULT_BRAND_SETTINGS.gridMobileColumns));
  const [videoCornerStyle, setVideoCornerStyle] = useState(DEFAULT_BRAND_SETTINGS.videoCornerStyle);
  const [videoBorderWidth, setVideoBorderWidth] = useState(String(DEFAULT_BRAND_SETTINGS.videoBorderWidth));
  const [videoGap, setVideoGap] = useState(String(DEFAULT_BRAND_SETTINGS.videoGap));
  const [videoPaddingTop, setVideoPaddingTop] = useState(String(DEFAULT_BRAND_SETTINGS.videoPaddingTop));
  const [videoPaddingRight, setVideoPaddingRight] = useState(String(DEFAULT_BRAND_SETTINGS.videoPaddingRight));
  const [videoPaddingBottom, setVideoPaddingBottom] = useState(String(DEFAULT_BRAND_SETTINGS.videoPaddingBottom));
  const [videoPaddingLeft, setVideoPaddingLeft] = useState(String(DEFAULT_BRAND_SETTINGS.videoPaddingLeft));
  const [productCardCornerStyle, setProductCardCornerStyle] = useState(DEFAULT_BRAND_SETTINGS.productCardCornerStyle);
  const [productCardBorderWidth, setProductCardBorderWidth] = useState(String(DEFAULT_BRAND_SETTINGS.productCardBorderWidth));
  const [productCardPadding, setProductCardPadding] = useState(String(DEFAULT_BRAND_SETTINGS.productCardPadding));
  const [productCardGap, setProductCardGap] = useState(String(DEFAULT_BRAND_SETTINGS.productCardGap));
  const [sliderArrows, setSliderArrows] = useState(true);
  const [sliderArrowPosition, setSliderArrowPosition] = useState("side");
  const [sliderAuto,   setSliderAuto]   = useState(false);
  const [sliderLoop,   setSliderLoop]   = useState(true);
  const [sliderDesktopSlides, setSliderDesktopSlides] = useState(String(DEFAULT_BRAND_SETTINGS.sliderDesktopSlides));
  const [sliderTabletSlides, setSliderTabletSlides] = useState(String(DEFAULT_BRAND_SETTINGS.sliderTabletSlides));
  const [sliderMobileSlides, setSliderMobileSlides] = useState(String(DEFAULT_BRAND_SETTINGS.sliderMobileSlides));
  const [sliderZoomDesktop, setSliderZoomDesktop] = useState(DEFAULT_BRAND_SETTINGS.sliderZoomDesktop);
  const [sliderZoomTablet, setSliderZoomTablet] = useState(DEFAULT_BRAND_SETTINGS.sliderZoomTablet);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [selectedTab,  setSelectedTab]  = useState(0);

  const saving = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) navigate("/app/widget");
  }, [actionData]);

  const handleSave = useCallback(() => {
    if (!title.trim()) { setErrorMsg("Title is required."); return; }
    setErrorMsg("");
    const fd = new FormData();
    fd.append("title",        title.trim());
    fd.append("description",  description.trim());
    fd.append("buttonText",   buttonText.trim());
    fd.append("buttonLink",   buttonLink.trim());
    fd.append("titleEnabled", String(titleEnabled));
    fd.append("titleColor", titleColor.trim());
    fd.append("titleFontSize", titleFontSize.trim());
    fd.append("descriptionEnabled", String(descriptionEnabled));
    fd.append("descriptionColor", descriptionColor.trim());
    fd.append("descriptionFontSize", descriptionFontSize.trim());
    fd.append("buttonEnabled", String(buttonEnabled));
    fd.append("buttonColor", buttonColor.trim());
    fd.append("buttonTextColor", buttonTextColor.trim());
    fd.append("sliderArrowBackgroundColor", sliderArrowBackgroundColor.trim());
    fd.append("sliderArrowColor", sliderArrowColor.trim());
    fd.append("sliderAutoDuration", sliderAutoDuration.trim());
    fd.append("buttonOpenNewTab", String(buttonOpenNewTab));
    fd.append("hideTaggedProducts", String(hideTaggedProducts));
    fd.append("redirectOnLink", String(redirectOnLink));
    fd.append("layout",       layout);
    fd.append("gridColumns",  gridColumns);
    fd.append("gridDesktopColumns", gridDesktopColumns);
    fd.append("gridTabletColumns", gridTabletColumns);
    fd.append("gridMobileColumns", gridMobileColumns);
    fd.append("videoCornerStyle", videoCornerStyle);
    fd.append("videoBorderWidth", videoBorderWidth.trim());
    fd.append("videoGap", videoGap.trim());
    fd.append("videoPaddingTop", videoPaddingTop.trim());
    fd.append("videoPaddingRight", videoPaddingRight.trim());
    fd.append("videoPaddingBottom", videoPaddingBottom.trim());
    fd.append("videoPaddingLeft", videoPaddingLeft.trim());
    fd.append("productCardCornerStyle", productCardCornerStyle);
    fd.append("productCardBorderWidth", productCardBorderWidth.trim());
    fd.append("productCardPadding", productCardPadding.trim());
    fd.append("productCardGap", productCardGap.trim());
    fd.append("sliderArrows", String(sliderArrows));
    fd.append("sliderArrowPosition", sliderArrowPosition);
    fd.append("sliderAuto",   String(sliderAuto));
    fd.append("sliderLoop",   String(sliderLoop));
    fd.append("sliderDesktopSlides", sliderDesktopSlides);
    fd.append("sliderTabletSlides", sliderTabletSlides);
    fd.append("sliderMobileSlides", sliderMobileSlides);
    fd.append("sliderZoomDesktop", String(sliderZoomDesktop));
    fd.append("sliderZoomTablet", String(sliderZoomTablet));
    submit(fd, { method: "POST" });
  }, [title, description, buttonText, buttonLink, titleEnabled, titleColor, titleFontSize, descriptionEnabled, descriptionColor, descriptionFontSize, buttonEnabled, buttonColor, buttonTextColor, sliderArrowBackgroundColor, sliderArrowColor, sliderAutoDuration, buttonOpenNewTab, hideTaggedProducts, redirectOnLink, layout, gridColumns, gridDesktopColumns, gridTabletColumns, gridMobileColumns, videoCornerStyle, videoBorderWidth, videoGap, videoPaddingTop, videoPaddingRight, videoPaddingBottom, videoPaddingLeft, productCardCornerStyle, productCardBorderWidth, productCardPadding, productCardGap, sliderArrows, sliderArrowPosition, sliderAuto, sliderLoop, sliderDesktopSlides, sliderTabletSlides, sliderMobileSlides, sliderZoomDesktop, sliderZoomTablet, submit]);

  return (
    <Page
      title="Create widget"
      backAction={{ content: "Widgets", onAction: () => navigate("/app/widget") }}
      primaryAction={{
        content: "Save widget",
        onAction: handleSave,
        loading: saving,
      }}
    >
      <BlockStack gap="300">
        {(errorMsg || actionData?.error) && (
          <Banner tone="critical" onDismiss={() => setErrorMsg("")}>
            {errorMsg || actionData?.error}
          </Banner>
        )}

        <style>{`
          .widget-builder-layout {
            display: grid;
            grid-template-columns: minmax(280px, 30%) minmax(0, 70%);
            gap: 16px;
            align-items: start;
          }
          .widget-builder-sidebar {
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: sticky;
            top: 16px;
          }
          .widget-builder-layout .widget-tabs [role="tab"] {
            font-size: 15px;
            font-weight: 600;
          }
          @media (max-width: 1100px) {
            .widget-builder-layout {
              grid-template-columns: 1fr;
            }
            .widget-builder-sidebar {
              position: static;
            }
          }
        `}</style>
        <div className="widget-builder-layout">
        <div>
        <Card>
          <div className="widget-tabs">
          <Tabs
            tabs={[
              { id: "details", content: "Content" },
              { id: "layout", content: "Layout" },
              { id: "design", content: "Design" },
            ]}
            selected={selectedTab}
            onSelect={setSelectedTab}
          >
            {selectedTab === 0 && (
              <BlockStack gap="300" padding="300">
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Title</Text>
                    <FormLayout>
                      <TextField
                        label="Title"
                        value={title}
                        onChange={setTitle}
                        placeholder="e.g. Watch & Shop"
                        disabled={saving}
                        requiredIndicator
                      />
                      <Checkbox label="Show Title" checked={titleEnabled} onChange={setTitleEnabled} disabled={saving} />
                    </FormLayout>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Description</Text>
                    <FormLayout>
                      <TextField
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        placeholder="e.g. Tap the product to shop directly from the video"
                        disabled={saving}
                        multiline={3}
                      />
                      <Checkbox label="Show Description" checked={descriptionEnabled} onChange={setDescriptionEnabled} disabled={saving} />
                    </FormLayout>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Button</Text>
                    <FormLayout>
                      <TextField label="Button Text" value={buttonText} onChange={setButtonText} placeholder="Shop Now" disabled={saving} />
                      <Checkbox label="Show Button" checked={buttonEnabled} onChange={setButtonEnabled} disabled={saving} />
                      <TextField
                        label="Button Link"
                        value={buttonLink}
                        onChange={setButtonLink}
                        placeholder="https://your-store.com/collections/all"
                        disabled={saving}
                        helpText="Optional. Leave empty to use the video's product link."
                      />
                      <Checkbox label="Open Button In New Tab" checked={buttonOpenNewTab} onChange={setButtonOpenNewTab} disabled={saving} />
                      <Checkbox label="Hide Tagged Products" checked={hideTaggedProducts} onChange={setHideTaggedProducts} disabled={saving} />
                      <Checkbox label="Redirect On Link When Video Is Clicked" checked={redirectOnLink} onChange={setRedirectOnLink} disabled={saving} />
                    </FormLayout>
                  </BlockStack>
                </Box>
              </BlockStack>
            )}

            {selectedTab === 1 && (
              <BlockStack gap="300" padding="300">
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                <FormLayout>
                  <Select
                    label="Layout Type"
                    options={[
                      { label: "Grid", value: "grid" },
                      { label: "Slider", value: "slider" },
                    ]}
                    value={layout}
                    onChange={setLayout}
                    disabled={saving}
                  />

                  {layout === "grid" && (
                    <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border-secondary">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingSm">Column Settings</Text>
                        <InlineStack gap="300" align="start">
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Desktop"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                                { label: "5", value: "5" },
                                { label: "6", value: "6" },
                              ]}
                              value={gridDesktopColumns}
                              onChange={setGridDesktopColumns}
                              disabled={saving}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Tablet"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                              ]}
                              value={gridTabletColumns}
                              onChange={setGridTabletColumns}
                              disabled={saving}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Mobile"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                              ]}
                              value={gridMobileColumns}
                              onChange={setGridMobileColumns}
                              disabled={saving}
                            />
                          </div>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  )}

                  {layout === "slider" && (
                    <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border-secondary">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingSm">Slide Settings</Text>
                        <InlineStack gap="300" align="start">
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Desktop"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                                { label: "5", value: "5" },
                                { label: "6", value: "6" },
                              ]}
                              value={sliderDesktopSlides}
                              onChange={setSliderDesktopSlides}
                              disabled={saving}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Tablet"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                              ]}
                              value={sliderTabletSlides}
                              onChange={setSliderTabletSlides}
                              disabled={saving}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Mobile"
                              options={[
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                              ]}
                              value={sliderMobileSlides}
                              onChange={setSliderMobileSlides}
                              disabled={saving}
                            />
                          </div>
                        </InlineStack>
                        <Select
                          label="Arrow Position"
                          options={[
                            { label: "Side", value: "side" },
                            { label: "Above", value: "above" },
                            { label: "Bottom", value: "bottom" },
                          ]}
                          value={sliderArrowPosition}
                          onChange={setSliderArrowPosition}
                          disabled={saving || !sliderArrows}
                        />
                        <Checkbox
                          label="Show Navigation Arrows"
                          checked={sliderArrows}
                          onChange={setSliderArrows}
                          disabled={saving}
                        />
                        <Checkbox
                          label="Auto-Play Slider"
                          checked={sliderAuto}
                          onChange={setSliderAuto}
                          disabled={saving}
                        />
                        <TextField
                          label="Auto-Play Duration (Seconds)"
                          value={sliderAutoDuration}
                          onChange={setSliderAutoDuration}
                          autoComplete="off"
                          type="number"
                          disabled={saving || !sliderAuto}
                        />
                        <Checkbox
                          label="Loop Slider"
                          checked={sliderLoop}
                          onChange={setSliderLoop}
                          disabled={saving}
                        />
                        <Checkbox
                          label="Zoom Middle Slide On Desktop"
                          checked={sliderZoomDesktop}
                          onChange={setSliderZoomDesktop}
                          disabled={saving}
                        />
                        <Checkbox
                          label="Zoom Middle Slide On Tablet"
                          checked={sliderZoomTablet}
                          onChange={setSliderZoomTablet}
                          disabled={saving}
                        />
                      </BlockStack>
                    </Box>
                  )}
                </FormLayout>
                </Box>
              </BlockStack>
            )}

            {selectedTab === 2 && (
              <BlockStack gap="300" padding="300">
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Title Style</Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: "120px" }}>
                        <Text as="label" variant="bodyMd">Color</Text>
                        <input type="color" value={titleColor || "#000000"} onChange={(e) => setTitleColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextField label="Font Size (px)" value={titleFontSize} onChange={setTitleFontSize} placeholder="Leave empty to use theme" autoComplete="off" type="number" disabled={saving} />
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Description Style</Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: "120px" }}>
                        <Text as="label" variant="bodyMd">Color</Text>
                        <input type="color" value={descriptionColor || "#000000"} onChange={(e) => setDescriptionColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextField label="Font Size (px)" value={descriptionFontSize} onChange={setDescriptionFontSize} placeholder="Leave empty to use theme" autoComplete="off" type="number" disabled={saving} />
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Button Style</Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: "120px" }}>
                        <Text as="label" variant="bodyMd">Color</Text>
                        <input type="color" value={buttonColor || "#000000"} onChange={(e) => setButtonColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text as="label" variant="bodyMd">Text Color</Text>
                        <input type="color" value={buttonTextColor || "#ffffff"} onChange={(e) => setButtonTextColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Video Style</Text>
                    <FormLayout>
                      <Select
                        label="Corner Style"
                        options={[
                          { label: "Rounded", value: "rounded" },
                          { label: "Square", value: "square" },
                          { label: "None", value: "none" },
                        ]}
                        value={videoCornerStyle}
                        onChange={setVideoCornerStyle}
                        disabled={saving}
                      />
                      <InlineStack gap="300" align="start">
                        <div style={{ flex: 1 }}>
                          <TextField label="Border Width (px)" value={videoBorderWidth} onChange={setVideoBorderWidth} autoComplete="off" type="number" disabled={saving} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label="Gap (px)" value={videoGap} onChange={setVideoGap} autoComplete="off" type="number" disabled={saving} />
                        </div>
                      </InlineStack>
                      <InlineStack gap="300" align="start">
                        <div style={{ flex: 1 }}>
                          <TextField label="Top Padding (px)" value={videoPaddingTop} onChange={setVideoPaddingTop} autoComplete="off" type="number" disabled={saving} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label="Right Padding (px)" value={videoPaddingRight} onChange={setVideoPaddingRight} autoComplete="off" type="number" disabled={saving} />
                        </div>
                      </InlineStack>
                      <InlineStack gap="300" align="start">
                        <div style={{ flex: 1 }}>
                          <TextField label="Bottom Padding (px)" value={videoPaddingBottom} onChange={setVideoPaddingBottom} autoComplete="off" type="number" disabled={saving} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label="Left Padding (px)" value={videoPaddingLeft} onChange={setVideoPaddingLeft} autoComplete="off" type="number" disabled={saving} />
                        </div>
                      </InlineStack>
                    </FormLayout>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Product Card Style</Text>
                    <FormLayout>
                      <Select
                        label="Corner Style"
                        options={[
                          { label: "Rounded", value: "rounded" },
                          { label: "Square", value: "square" },
                          { label: "None", value: "none" },
                        ]}
                        value={productCardCornerStyle}
                        onChange={setProductCardCornerStyle}
                        disabled={saving}
                      />
                      <InlineStack gap="300" align="start">
                        <div style={{ flex: 1 }}>
                          <TextField label="Border Width (px)" value={productCardBorderWidth} onChange={setProductCardBorderWidth} autoComplete="off" type="number" disabled={saving} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label="Padding (px)" value={productCardPadding} onChange={setProductCardPadding} autoComplete="off" type="number" disabled={saving} />
                        </div>
                      </InlineStack>
                      <TextField label="Gap (px)" value={productCardGap} onChange={setProductCardGap} autoComplete="off" type="number" disabled={saving} />
                    </FormLayout>
                  </BlockStack>
                </Box>
                <Box padding="300" borderWidth="1" borderRadius="300" borderColor="border">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Slider Arrow Style</Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: "120px" }}>
                        <Text as="label" variant="bodyMd">Arrow Background</Text>
                        <input type="color" value={sliderArrowBackgroundColor || "#202223"} onChange={(e) => setSliderArrowBackgroundColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text as="label" variant="bodyMd">Arrow Color</Text>
                        <input type="color" value={sliderArrowColor || "#ffffff"} onChange={(e) => setSliderArrowColor(e.target.value)} disabled={saving} style={{ width: "100%", height: "40px" }} />
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            )}
          </Tabs>
          </div>
        </Card>
        </div>
        <div className="widget-builder-sidebar">
          <WidgetPreview
            title={title}
            description={description}
            buttonText={buttonText}
            titleEnabled={titleEnabled}
            descriptionEnabled={descriptionEnabled}
            buttonEnabled={buttonEnabled}
            hideTaggedProducts={hideTaggedProducts}
            layout={layout}
            gridColumns={gridColumns}
            sliderArrows={sliderArrows}
            sliderArrowPosition={sliderArrowPosition}
            videos={videos}
            brandSettings={{
              titleColor,
              titleFontSize: parseOptionalFontSize(titleFontSize),
              descriptionColor,
              descriptionFontSize: parseOptionalFontSize(descriptionFontSize),
              buttonColor,
              buttonTextColor,
              sliderArrowBackgroundColor,
              sliderArrowColor,
              gridDesktopColumns: parseColumnCount(gridDesktopColumns, DEFAULT_BRAND_SETTINGS.gridDesktopColumns, 1, 6),
              gridTabletColumns: parseColumnCount(gridTabletColumns, DEFAULT_BRAND_SETTINGS.gridTabletColumns, 1, 4),
              gridMobileColumns: parseColumnCount(gridMobileColumns, DEFAULT_BRAND_SETTINGS.gridMobileColumns, 1, 2),
              videoCornerStyle,
              videoBorderWidth: parseSizeValue(videoBorderWidth, DEFAULT_BRAND_SETTINGS.videoBorderWidth, 0, 12),
              videoGap: parseSizeValue(videoGap, DEFAULT_BRAND_SETTINGS.videoGap, 0, 40),
              videoPaddingTop: parseSizeValue(videoPaddingTop, DEFAULT_BRAND_SETTINGS.videoPaddingTop, 0, 80),
              videoPaddingRight: parseSizeValue(videoPaddingRight, DEFAULT_BRAND_SETTINGS.videoPaddingRight, 0, 80),
              videoPaddingBottom: parseSizeValue(videoPaddingBottom, DEFAULT_BRAND_SETTINGS.videoPaddingBottom, 0, 80),
              videoPaddingLeft: parseSizeValue(videoPaddingLeft, DEFAULT_BRAND_SETTINGS.videoPaddingLeft, 0, 80),
              productCardCornerStyle,
              productCardBorderWidth: parseSizeValue(productCardBorderWidth, DEFAULT_BRAND_SETTINGS.productCardBorderWidth, 0, 12),
              productCardPadding: parseSizeValue(productCardPadding, DEFAULT_BRAND_SETTINGS.productCardPadding, 0, 40),
              productCardGap: parseSizeValue(productCardGap, DEFAULT_BRAND_SETTINGS.productCardGap, 0, 30),
              sliderArrows,
              sliderArrowPosition,
              sliderDesktopSlides: parseSlideCount(sliderDesktopSlides, DEFAULT_BRAND_SETTINGS.sliderDesktopSlides, 1, 6),
              sliderTabletSlides: parseSlideCount(sliderTabletSlides, DEFAULT_BRAND_SETTINGS.sliderTabletSlides, 1, 4),
              sliderMobileSlides: parseSlideCount(sliderMobileSlides, DEFAULT_BRAND_SETTINGS.sliderMobileSlides, 1, 2),
              sliderZoomDesktop,
              sliderZoomTablet,
              sliderAuto,
              sliderAutoDuration: parseSizeValue(sliderAutoDuration, DEFAULT_BRAND_SETTINGS.sliderAutoDuration, 1, 30),
              sliderLoop,
            }}
          />
        </div>
        </div>
      </BlockStack>
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);
