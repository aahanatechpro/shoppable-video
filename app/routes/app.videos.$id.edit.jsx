import { useState, useRef, useCallback } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  Page,
  Card,
  Banner,
  Button,
  ButtonGroup,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  Box,
} from "@shopify/polaris";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const video = await prisma.video.findFirst({
    where:   { id: params.id, shop },
    include: { tags: true },
  });

  if (!video) throw new Response("Video not found", { status: 404 });

  // ── Get real video URL from Shopify Files ──────────────────────────────────
  let videoUrl = video.storageKey;
  if (video.shopifyFileId) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      const response = await admin.graphql(
        `#graphql
        query getFile($id: ID!) {
          node(id: $id) {
            ... on Video {
              id
              sources { url mimeType }
              originalSource { url }
            }
          }
        }`,
        { variables: { id: video.shopifyFileId } }
      );
      const result = await response.json();
      const node   = result?.data?.node;
      if (node?.sources?.length > 0) {
        // Prefer mp4 source
        const mp4 = node.sources.find((s) => s.mimeType === "video/mp4");
        videoUrl  = mp4?.url || node.sources[0].url || videoUrl;
      }
    } catch (err) {}
  }

  // ── Get existing tagged product details ────────────────────────────────────
  let existingProduct = null;
  if (video.tags?.length > 0) {
    const tag = video.tags[0];
    try {
      const { admin } = await unauthenticated.admin(shop);
      const response = await admin.graphql(
        `#graphql
        query getProduct($id: ID!) {
          node(id: $id) {
            ... on Product {
              id
              title
              featuredImage { url }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
            }
          }
        }`,
        { variables: { id: tag.productId } }
      );
      const result  = await response.json();
      const product = result?.data?.node;
      if (product) {
        existingProduct = {
          id:    product.id,
          title: product.title,
          image: product.featuredImage?.url || null,
          price: product.priceRangeV2?.minVariantPrice
            ? `${product.priceRangeV2.minVariantPrice.currencyCode} ${parseFloat(product.priceRangeV2.minVariantPrice.amount).toFixed(2)}`
            : "",
          tagId: tag.id,
        };
      }
    } catch (err) {
      existingProduct = { id: tag.productId, title: tag.title, image: null, tagId: tag.id };
    }
  }

  return Response.json({ video, videoUrl, shop, existingProduct });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditVideo() {
  const { video, videoUrl, shop, existingProduct } = useLoaderData();
  const navigate = useNavigate();
  const compactPreviewHeight = "auto";
  const compactThumbHeight = "220px";

  // Refs
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);

  // Title
  const [title,           setTitle]           = useState(video.title);
  const [redirectLink,    setRedirectLink]    = useState(video.redirectLink || "");

  // Video replacement
  const [newVideo,        setNewVideo]        = useState(null);
  const [newVideoPreview, setNewVideoPreview] = useState(null);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadState,     setUploadState]     = useState("idle");
  const [newResourceUrl,  setNewResourceUrl]  = useState(null);

  // Thumbnail
  const [thumbMode,     setThumbMode]     = useState("current");
  const [thumbPreview,  setThumbPreview]  = useState(video.thumbnailKey || null);
  const [thumbBase64,   setThumbBase64]   = useState(null);
  const [capturing,     setCapturing]     = useState(false);

  // Product
  const [allProducts,     setAllProducts]     = useState([]);
  const [filteredProds,   setFilteredProds]   = useState([]);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [selectedProduct, setSelectedProduct] = useState(existingProduct);
  const [loadingProds,    setLoadingProds]    = useState(false);
  const [prodsLoaded,     setProdsLoaded]     = useState(false);

  // Save
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Select new video ──────────────────────────────────────────────────────
  const handleVideoChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { setErrorMsg("Please select a valid video file."); return; }
    if (file.size > 500 * 1024 * 1024)  { setErrorMsg("File must be under 500 MB."); return; }
    setNewVideo(file);
    setNewVideoPreview(URL.createObjectURL(file));
    setUploadState("idle"); setUploadProgress(0); setNewResourceUrl(null);
    setErrorMsg("");
  }, []);

  // ── Upload new video ──────────────────────────────────────────────────────
  const handleVideoUpload = useCallback(async () => {
    if (!newVideo) return;
    try {
      setUploadState("uploading"); setUploadProgress(10);
      const fd1 = new FormData();
      fd1.append("step", "staged"); fd1.append("shop", shop);
      fd1.append("filename", newVideo.name); fd1.append("fileSize", String(newVideo.size));
      fd1.append("mimeType", newVideo.type);
      const stageData = await fetch("/api/upload", { method: "POST", body: fd1 }).then(r => r.json());
      if (stageData.error) throw new Error(stageData.error);
      setUploadProgress(40);

      const uploadForm = new FormData();
      stageData.parameters.forEach(({ name, value }) => uploadForm.append(name, value));
      uploadForm.append("file", newVideo);
      const uploadRes = await fetch(stageData.uploadUrl, { method: "POST", body: uploadForm });
      if (!uploadRes.ok) throw new Error(`CDN upload failed: ${uploadRes.status}`);
      setUploadProgress(80);

      const fd2 = new FormData();
      fd2.append("step", "create"); fd2.append("shop", shop);
      fd2.append("resourceUrl", stageData.resourceUrl); fd2.append("title", title.trim() || video.title);
      const createData = await fetch("/api/upload", { method: "POST", body: fd2 }).then(r => r.json());
      if (createData.error) throw new Error(createData.error);

      setUploadProgress(100); setUploadState("done");
      setNewResourceUrl(stageData.resourceUrl);
    } catch (err) {
      setErrorMsg(err.message); setUploadState("idle"); setUploadProgress(0);
    }
  }, [newVideo, shop, title, video.title]);

  const handleCaptureFrame = useCallback(() => {
    const videoEl  = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;
    if (videoEl.readyState < 2) { setErrorMsg("Please wait for the video to load."); return; }
    setCapturing(true);
    try {
      canvasEl.width  = videoEl.videoWidth  || 640;
      canvasEl.height = videoEl.videoHeight || 360;
      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const base64 = canvasEl.toDataURL("image/jpeg", 0.85);
      setThumbPreview(base64); setThumbBase64(base64); setErrorMsg("");
    } catch (err) {
      setErrorMsg("Could not capture frame.");
    } finally { setCapturing(false); }
  }, []);

  const handleThumbUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrorMsg("Please select a valid image."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setThumbPreview(ev.target.result); setThumbBase64(ev.target.result); setErrorMsg(""); };
    reader.readAsDataURL(file);
  }, []);

  // ── Load products ─────────────────────────────────────────────────────────
  const handleLoadProducts = useCallback(async () => {
    if (prodsLoaded) return;
    setLoadingProds(true);
    try {
      const fd = new FormData();
      fd.append("action", "load"); fd.append("shop", shop); fd.append("searchQuery", "");
      const data = await fetch("/api/products", { method: "POST", body: fd }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setAllProducts(data.products); setFilteredProds(data.products); setProdsLoaded(true);
    } catch (err) { setErrorMsg(err.message); }
    finally { setLoadingProds(false); }
  }, [shop, prodsLoaded]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) { setFilteredProds(allProducts); return; }
    const lower = query.toLowerCase();
    setFilteredProds(allProducts.filter((p) => p.title.toLowerCase().includes(lower)));
  }, [allProducts]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { setErrorMsg("Title cannot be empty."); return; }
    if (newVideo && uploadState !== "done") { setErrorMsg("Please upload the new video first."); return; }

    setSaving(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const fd = new FormData();
      fd.append("action",  "edit"); fd.append("shop", shop);
      fd.append("videoId", video.id); fd.append("title", title.trim());
      fd.append("redirectLink", redirectLink.trim());
      if (thumbBase64)    fd.append("thumbnailBase64", thumbBase64);
      if (newResourceUrl) fd.append("newStorageKey",   newResourceUrl);
      const data = await fetch("/api/videos", { method: "POST", body: fd }).then(r => r.json());
      if (data.error) throw new Error(data.error);

      // Remove existing tags
      for (const tag of video.tags || []) {
        const fd2 = new FormData();
        fd2.append("action", "remove"); fd2.append("shop", shop); fd2.append("tagId", tag.id);
        await fetch("/api/products", { method: "POST", body: fd2 });
      }

      // Save selected product
      if (selectedProduct) {
        const fd3 = new FormData();
        fd3.append("action",    "tag");    fd3.append("shop",      shop);
        fd3.append("videoId",   video.id); fd3.append("productId", selectedProduct.id);
        fd3.append("title",     selectedProduct.title || "");
        fd3.append("timestamp", "0"); fd3.append("positionX", "50"); fd3.append("positionY", "50");
        await fetch("/api/products", { method: "POST", body: fd3 });
      }

      setSuccessMsg("Video updated successfully!");
      setTimeout(() => navigate("/app/videos"), 1500);
    } catch (err) {
      setErrorMsg(err.message || "Save failed.");
    } finally { setSaving(false); }
  }, [title, redirectLink, thumbBase64, newResourceUrl, newVideo, uploadState, selectedProduct, shop, video, navigate]);

  const isVideoUploading = uploadState === "uploading";
  const currentVideoSrc  = newVideoPreview || videoUrl;

  return (
    <Page
      title="Edit video"
      backAction={{ content: "Videos", onAction: () => navigate("/app/videos") }}
    >
      <BlockStack gap="400">
        {errorMsg && (
          <Banner tone="critical" onDismiss={() => setErrorMsg("")}>
            <Text as="p">{errorMsg}</Text>
          </Banner>
        )}
        {successMsg && (
          <Banner tone="success">
            <Text as="p">{successMsg}</Text>
          </Banner>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          {/* ── Left: Form ── */}
          <BlockStack gap="400">
            {/* Title */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Video details</Text>
                <TextField
                  label="Title"
                  value={title}
                  onChange={(value) => setTitle(value)}
                  placeholder="Enter video title"
                  disabled={saving}
                  autoComplete="off"
                />
                <TextField
                  label="Redirect link"
                  value={redirectLink}
                  onChange={(value) => setRedirectLink(value)}
                  placeholder="https://your-store.com/products/..."
                  disabled={saving}
                  autoComplete="off"
                  helpText="Optional. Used when widget redirect-on-click is enabled."
                />
              </BlockStack>
            </Card>

            {/* Replace video */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Replace video</Text>
                <Text tone="subdued">Upload a new video to replace the current one. Optional.</Text>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/mov,video/quicktime"
                  onChange={handleVideoChange}
                  disabled={saving || isVideoUploading}
                  style={{ display: "none" }}
                />
                <div>
                  <ButtonGroup>
                    <Button onClick={() => videoInputRef.current?.click()} disabled={saving || isVideoUploading}>
                      {newVideo ? "Change file" : "Choose new video"}
                    </Button>
                    {newVideo && uploadState === "idle" && (
                      <Button variant="primary" onClick={handleVideoUpload}>
                        Upload new video
                      </Button>
                    )}
                  </ButtonGroup>
                  {uploadState === "done" && (
                    <Text tone="success" variant="bodySm" as="p" style={{ marginTop: "8px" }}>
                      ✓ Uploaded
                    </Text>
                  )}
                </div>
                {newVideo && (
                  <Text tone="subdued" variant="bodySm">
                    {newVideo.name} · {(newVideo.size / 1024 / 1024).toFixed(1)} MB
                  </Text>
                )}
                {isVideoUploading && (
                  <BlockStack gap="200">
                    <Text>Uploading… {uploadProgress}%</Text>
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "3px",
                        background: "#e4e5e7",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${uploadProgress}%`,
                          background: "#008060",
                          borderRadius: "3px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Thumbnail */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Thumbnail</Text>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { key: "current", label: "Keep current" },
                    { key: "capture", label: "Capture from video" },
                    { key: "upload", label: "Upload image" },
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      onClick={() => {
                        setThumbMode(key);
                        if (key === "current") {
                          setThumbPreview(video.thumbnailKey || null);
                          setThumbBase64(null);
                        }
                      }}
                      variant={thumbMode === key ? "primary" : "secondary"}
                      size="slim"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {thumbMode === "current" && (
                  <Text tone="subdued">
                    {video.thumbnailKey
                      ? "Keeping the existing thumbnail."
                      : "No thumbnail currently set."}
                  </Text>
                )}
                {thumbMode === "capture" && (
                  <BlockStack gap="200">
                    <Text tone="subdued">
                      Play the video on the right, pause at the frame you want, then capture.
                    </Text>
                    <Button
                      onClick={handleCaptureFrame}
                      disabled={capturing || saving}
                      loading={capturing}
                    >
                      Capture current frame
                    </Button>
                  </BlockStack>
                )}
                {thumbMode === "upload" && (
                  <BlockStack gap="200">
                    <Text tone="subdued">Accepted: JPG, PNG, WEBP · Max 5 MB</Text>
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleThumbUpload}
                      disabled={saving}
                      style={{ display: "none" }}
                    />
                    <Button onClick={() => thumbInputRef.current?.click()} disabled={saving}>
                      Choose image
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Tag a product */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Tag a product</Text>
                <Text tone="subdued">Select one product to tag with this video.</Text>

                {selectedProduct && (
                  <Box
                    padding="200"
                    borderRadius="200"
                    background="bg-success-subdued"
                    borderColor="border-success"
                    borderWidth="1px"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      {selectedProduct.image && (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.title}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "4px",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Text variant="bodySm" tone="success" as="span">
                        {selectedProduct.title}
                      </Text>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#008060",
                          fontSize: "18px",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </InlineStack>
                  </Box>
                )}

                {!prodsLoaded ? (
                  <Button
                    onClick={handleLoadProducts}
                    disabled={loadingProds || saving}
                    loading={loadingProds}
                  >
                    {selectedProduct ? "Change product" : "Load products"}
                  </Button>
                ) : (
                  <BlockStack gap="200">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px solid #e1e3e5",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        background: "#fff",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
                          stroke="#8c9196"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search products…"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{
                          border: "none",
                          outline: "none",
                          flex: 1,
                          fontSize: "14px",
                          color: "#202223",
                          background: "transparent",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        maxHeight: "200px",
                        overflowY: "auto",
                        border: "1px solid #e1e3e5",
                        borderRadius: "8px",
                      }}
                    >
                      {filteredProds.length === 0 ? (
                        <div
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "#6d7175",
                            fontSize: "13px",
                          }}
                        >
                          No products found
                        </div>
                      ) : (
                        filteredProds.map((product) => {
                          const isSelected = selectedProduct?.id === product.id;
                          return (
                            <div
                              key={product.id}
                              onClick={() => setSelectedProduct(isSelected ? null : product)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px 12px",
                                borderBottom: "1px solid #f1f2f3",
                                cursor: "pointer",
                                background: isSelected ? "#f0faf7" : "#fff",
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#f6f6f7";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = isSelected ? "#f0faf7" : "#fff";
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: "15px", height: "15px", cursor: "pointer", flexShrink: 0 }}
                              />
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                  background: "#f1f2f3",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 20 20" fill="#8c9196">
                                    <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v15A1.5 1.5 0 0 0 2.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 17.5 1h-15zm0 1h15a.5.5 0 0 1 .5.5V13l-4-4-4 5-3-3-5 5V2.5a.5.5 0 0 1 .5-.5z" />
                                  </svg>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: isSelected ? 600 : 400,
                                  color: isSelected ? "#008060" : "#202223",
                                }}
                              >
                                {product.title}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Actions */}
            <ButtonGroup>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || isVideoUploading}
                loading={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button onClick={() => navigate("/app/videos")} disabled={saving || isVideoUploading}>
                Cancel
              </Button>
            </ButtonGroup>
          </BlockStack>

          {/* ── Right: Previews ── */}
          <BlockStack gap="400">
            {/* Video */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  {newVideoPreview ? "New video preview" : "Current video"}
                </Text>
                {currentVideoSrc ? (
                  <video
                    ref={videoRef}
                    src={currentVideoSrc}
                    controls
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      maxHeight: compactPreviewHeight,
                      borderRadius: "8px",
                      background: "#000",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <Box
                    style={{
                      minHeight: compactPreviewHeight,
                      background: "#f6f6f7",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text tone="subdued">Video loading…</Text>
                  </Box>
                )}
                {newVideoPreview && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">
                      New video preview
                    </Text>
                    <button
                      onClick={() => {
                        setNewVideo(null);
                        setNewVideoPreview(null);
                        setUploadState("idle");
                        setUploadProgress(0);
                        setNewResourceUrl(null);
                      }}
                      style={{
                        fontSize: "12px",
                        color: "#d72c0d",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </InlineStack>
                )}
              </BlockStack>
            </Card>

            {/* Thumbnail */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Thumbnail preview</Text>
                {thumbPreview ? (
                  <img
                    src={thumbPreview}
                    alt="Thumbnail"
                    style={{
                      width: "auto",
                      maxWidth: "100%",
                      maxHeight: compactThumbHeight,
                      borderRadius: "8px",
                      objectFit: "contain",
                      margin: "0 auto",
                      display: "block",
                    }}
                  />
                ) : (
                  <Box
                    style={{
                      minHeight: compactThumbHeight,
                      background: "#f6f6f7",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    <Text tone="subdued">Thumbnail preview will appear here.</Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </BlockStack>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);
