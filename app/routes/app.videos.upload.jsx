import { useState, useRef, useCallback } from "react";
import { useNavigate, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Box,
  Text,
  ProgressBar,
  Checkbox,
} from "@shopify/polaris";
import { UploadIcon } from "@shopify/polaris-icons";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  return Response.json({ shop: session.shop });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadVideo() {
  const { shop } = useLoaderData();
  const navigate  = useNavigate();
  const compactPreviewHeight = "auto";
  const compactThumbHeight = "220px";

  // Refs
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);

  // Video file state
  const [video,         setVideo]         = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [title,         setTitle]         = useState("");
  const [redirectLink,  setRedirectLink]  = useState("");

  // Thumbnail state
  const [thumbMode,     setThumbMode]     = useState("auto");   // auto | capture | upload
  const [thumbPreview,  setThumbPreview]  = useState(null);
  const [thumbBase64,   setThumbBase64]   = useState(null);
  const [capturing,     setCapturing]     = useState(false);

  // Product tagging state
  const [allProducts,   setAllProducts]   = useState([]);
  const [filteredProds, setFilteredProds] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loadingProds,  setLoadingProds]  = useState(false);
  const [prodsLoaded,   setProdsLoaded]   = useState(false);

  // Upload state
  const [progress,      setProgress]      = useState(0);
  const [uploadState,   setUploadState]   = useState("idle");
  const [errorMsg,      setErrorMsg]      = useState("");

  // ── File selected ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { setErrorMsg("Please select a valid video file."); return; }
    if (file.size > 500 * 1024 * 1024)  { setErrorMsg("File size must be under 500 MB."); return; }
    setVideo(file);
    setPreview(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^/.]+$/, ""));
    setThumbPreview(null);
    setThumbBase64(null);
    setErrorMsg("");
  }, []);

  // ── Capture frame manually ────────────────────────────────────────────────
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
      setThumbPreview(base64);
      setThumbBase64(base64);
      setErrorMsg("");
    } catch (err) {
      setErrorMsg("Could not capture frame. Try pausing the video first.");
    } finally {
      setCapturing(false);
    }
  }, []);

  // ── Upload thumbnail image ────────────────────────────────────────────────
  const handleThumbUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrorMsg("Please select a valid image."); return; }
    if (file.size > 5 * 1024 * 1024)    { setErrorMsg("Image must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setThumbPreview(ev.target.result);
      setThumbBase64(ev.target.result);
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Load products ─────────────────────────────────────────────────────────
  const handleLoadProducts = useCallback(async () => {
    if (prodsLoaded) return;
    setLoadingProds(true);
    try {
      const fd = new FormData();
      fd.append("action", "load"); fd.append("shop", shop); fd.append("searchQuery", "");
      const res  = await fetch("/api/products", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAllProducts(data.products);
      setFilteredProds(data.products);
      setProdsLoaded(true);
    } catch (err) { setErrorMsg(err.message); }
    finally { setLoadingProds(false); }
  }, [shop, prodsLoaded]);

  // ── Search products ───────────────────────────────────────────────────────
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) { setFilteredProds(allProducts); return; }
    const lower = query.toLowerCase();
    setFilteredProds(allProducts.filter((p) => p.title.toLowerCase().includes(lower)));
  }, [allProducts]);

  // ── Main upload flow ──────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!video)        { setErrorMsg("Please select a video first."); return; }
    if (!title.trim()) { setErrorMsg("Please enter a title.");        return; }

    try {
      setUploadState("uploading"); setProgress(10); setErrorMsg("");

      // Step 1 — staged URL
      const fd1 = new FormData();
      fd1.append("step", "staged"); fd1.append("shop", shop);
      fd1.append("filename", video.name); fd1.append("fileSize", String(video.size));
      fd1.append("mimeType", video.type);
      const stageRes  = await fetch("/api/upload", { method: "POST", body: fd1 });
      const stageText = await stageRes.text();
      let stageData;
      try { stageData = JSON.parse(stageText); } catch { throw new Error("Server error on staged upload."); }
      if (stageData.error) throw new Error(stageData.error);

      setProgress(30);

      // Step 2 — CDN upload
      const uploadForm = new FormData();
      stageData.parameters.forEach(({ name, value }) => uploadForm.append(name, value));
      uploadForm.append("file", video);
      const uploadRes = await fetch(stageData.uploadUrl, { method: "POST", body: uploadForm });
      if (!uploadRes.ok) throw new Error(`CDN upload failed: ${uploadRes.status}`);

      setProgress(60);

      // Step 3 — register + save to DB with thumbnail
      const fd2 = new FormData();
      fd2.append("step",        "create");
      fd2.append("shop",        shop);
      fd2.append("resourceUrl", stageData.resourceUrl);
      fd2.append("title",       title.trim());
      fd2.append("redirectLink", redirectLink.trim());
      if (thumbBase64) fd2.append("thumbnailBase64", thumbBase64);

      const createRes  = await fetch("/api/upload", { method: "POST", body: fd2 });
      const createText = await createRes.text();
      let createData;
      try { createData = JSON.parse(createText); } catch { throw new Error("Server error on file create."); }
      if (createData.error) throw new Error(createData.error);

      setProgress(85);

      // Step 4 — save product tag if selected
      if (selectedProduct && createData.videoId) {
        const fd3 = new FormData();
        fd3.append("action",    "tag");
        fd3.append("shop",      shop);
        fd3.append("videoId",   createData.videoId);
        fd3.append("productId", selectedProduct.id);
        fd3.append("title",     selectedProduct.title);
        fd3.append("timestamp", "0");
        fd3.append("positionX", "50");
        fd3.append("positionY", "50");
        await fetch("/api/products", { method: "POST", body: fd3 });
      }

      setProgress(100);
      setUploadState("done");
      setTimeout(() => navigate("/app/videos"), 1500);

    } catch (err) {
      setErrorMsg(err.message || "Upload failed.");
      setUploadState("error");
      setProgress(0);
    }
  }, [video, title, redirectLink, shop, thumbBase64, selectedProduct, navigate]);

  const isUploading = uploadState === "uploading";

  const progressLabel = {
    uploading: progress < 30 ? "Getting upload URL…" : progress < 60 ? "Uploading to Shopify…" : progress < 85 ? "Saving video…" : "Tagging product…",
    done: "Done!",
  }[uploadState] || "";

  return (
    <Page
      title="Upload video"
      backAction={{ content: "Videos", onAction: () => navigate("/app/videos") }}
    >
      <BlockStack gap="400">
        {errorMsg && (
          <Banner tone="critical" onDismiss={() => setErrorMsg("")}>
            {errorMsg}
          </Banner>
        )}
        {uploadState === "done" && (
          <Banner tone="success">
            Video uploaded! Redirecting to library…
          </Banner>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          {/* Left: Form */}
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Video details</Text>
                <TextField
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  placeholder="Enter a title for this video"
                  disabled={isUploading}
                  requiredIndicator
                />
                <TextField
                  label="Redirect link"
                  value={redirectLink}
                  onChange={setRedirectLink}
                  placeholder="https://your-store.com/products/..."
                  disabled={isUploading}
                  autoComplete="off"
                  helpText="Optional. Used when widget redirect-on-click is enabled."
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <div>
                  <Text as="h2" variant="headingMd">Video file</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    MP4, MOV, WEBM • Max 500 MB
                  </Text>
                </div>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/mov,video/quicktime"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  style={{ display: "none" }}
                />
                <InlineStack gap="200" blockAlign="center">
                  <Button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploading}
                    icon={UploadIcon}
                  >
                    {video ? "Change file" : "Choose file"}
                  </Button>
                  {video && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {video.name} • {(video.size / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  )}
                </InlineStack>

                {isUploading && (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">{progressLabel} {progress}%</Text>
                    <ProgressBar progress={progress} />
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Thumbnail</Text>
                <InlineStack gap="100">
                  {[
                    { key: "capture", label: "Capture" },
                    { key: "upload",  label: "Upload" },
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={thumbMode === key ? "primary" : "secondary"}
                      size="slim"
                      onClick={() => { setThumbMode(key); }}
                    >
                      {label}
                    </Button>
                  ))}
                </InlineStack>

                {thumbMode === "capture" && (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Play the video on the right, pause at the frame you want, then capture.
                    </Text>
                    <Button
                      onClick={handleCaptureFrame}
                      disabled={!preview || capturing || isUploading}
                      loading={capturing}
                    >
                      Capture current frame
                    </Button>
                    {!preview && <Text as="p" variant="bodySm" tone="subdued">Choose a video first.</Text>}
                  </BlockStack>
                )}

                {thumbMode === "upload" && (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      JPG, PNG, WEBP • Max 5 MB
                    </Text>
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleThumbUpload}
                      disabled={isUploading}
                      style={{ display: "none" }}
                    />
                    <Button
                      onClick={() => thumbInputRef.current?.click()}
                      disabled={isUploading}
                      icon={UploadIcon}
                    >
                      Choose image
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <div>
                  <Text as="h2" variant="headingMd">Tag a product (optional)</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Tag one product to this video. You can add more after uploading.
                  </Text>
                </div>

                {!prodsLoaded ? (
                  <Button
                    onClick={handleLoadProducts}
                    disabled={loadingProds || isUploading}
                    loading={loadingProds}
                  >
                    Load products
                  </Button>
                ) : (
                  <BlockStack gap="200">
                    <TextField
                      label=""
                      placeholder="Search products…"
                      value={searchQuery}
                      onChange={handleSearch}
                    />

                    {selectedProduct && (
                      <InlineStack gap="200" blockAlign="center">
                        {selectedProduct.image && (
                          <img
                            src={selectedProduct.image}
                            alt={selectedProduct.title}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "4px",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <Text as="p" variant="bodySm" fontWeight="medium">
                          {selectedProduct.title}
                        </Text>
                        <Button
                          variant="plain"
                          size="slim"
                          onClick={() => setSelectedProduct(null)}
                        >
                          ✕
                        </Button>
                      </InlineStack>
                    )}

                    <Box style={{
                      maxHeight: "200px",
                      overflowY: "auto",
                      border: "1px solid #e1e3e5",
                      borderRadius: "6px",
                    }}>
                      {filteredProds.length === 0 ? (
                        <Box padding="300" style={{ textAlign: "center" }}>
                          <Text as="p" variant="bodySm" tone="subdued">
                            No products found
                          </Text>
                        </Box>
                      ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                          {filteredProds.map((product) => {
                            const isSelected = selectedProduct?.id === product.id;
                            return (
                              <li
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
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => {}}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {product.image && (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "4px",
                                      objectFit: "cover",
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                                <Text
                                  as="p"
                                  variant="bodySm"
                                  fontWeight={isSelected ? "semibold" : "regular"}
                                  tone={isSelected ? "subdued" : "default"}
                                >
                                  {product.title}
                                </Text>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Box>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <InlineStack gap="200">
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={isUploading || uploadState === "done" || !video}
                loading={isUploading}
              >
                {isUploading ? progressLabel : "Upload video"}
              </Button>
              <Button
                onClick={() => navigate("/app/videos")}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </InlineStack>
          </BlockStack>

          {/* Right: Previews */}
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Preview</Text>
                {preview ? (
                  <video
                    ref={videoRef}
                    src={preview}
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
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    <Text as="p" variant="bodySm" tone="subdued">
                      Your video preview will appear here.
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>

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
                    <Text as="p" variant="bodySm" tone="subdued">
                      Thumbnail preview will appear here.
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </BlockStack>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);
