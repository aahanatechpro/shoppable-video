import { useState, useRef, useCallback } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
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
  EmptyState,
  Spinner,
} from "@shopify/polaris";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);

  const video = await prisma.video.findFirst({
    where: { id: params.id, shop: session.shop },
  });

  if (!video) throw new Response("Video not found", { status: 404 });

  return Response.json({ video, shop: session.shop });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditVideo() {
  const { video, shop } = useLoaderData();
  const navigate        = useNavigate();

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const thumbInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const [title,         setTitle]         = useState(video.title);
  const [thumbPreview,  setThumbPreview]  = useState(video.thumbnailKey || null);
  const [thumbBase64,   setThumbBase64]   = useState(null);
  const [thumbMode,     setThumbMode]     = useState("upload");

  // Video replacement state
  const [newVideo,      setNewVideo]      = useState(null);
  const [newVideoPreview, setNewVideoPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState,   setUploadState]   = useState("idle"); // idle | uploading | done

  const [saving,        setSaving]        = useState(false);
  const [capturing,     setCapturing]     = useState(false);
  const [errorMsg,      setErrorMsg]      = useState("");
  const [successMsg,    setSuccessMsg]    = useState("");

  // ── Select new video file ─────────────────────────────────────────────────
  const handleVideoChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setErrorMsg("Please select a valid video file (MP4, MOV, WEBM).");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setErrorMsg("File size must be under 500 MB.");
      return;
    }

    setNewVideo(file);
    setNewVideoPreview(URL.createObjectURL(file));
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMsg("");
  }, []);

  // ── Upload new video to Shopify CDN ──────────────────────────────────────
  const handleVideoUpload = useCallback(async () => {
    if (!newVideo) return;

    try {
      setUploadState("uploading");
      setUploadProgress(10);

      // Step 1 — get staged URL
      const fd1 = new FormData();
      fd1.append("step",     "staged");
      fd1.append("shop",     shop);
      fd1.append("filename", newVideo.name);
      fd1.append("fileSize", String(newVideo.size));
      fd1.append("mimeType", newVideo.type);

      const stageRes  = await fetch("/api/upload", { method: "POST", body: fd1 });
      const stageData = await stageRes.json();
      if (stageData.error) throw new Error(stageData.error);

      setUploadProgress(35);

      // Step 2 — POST to CDN
      const uploadForm = new FormData();
      stageData.parameters.forEach(({ name, value }) => uploadForm.append(name, value));
      uploadForm.append("file", newVideo);

      const uploadRes = await fetch(stageData.uploadUrl, { method: "POST", body: uploadForm });
      if (!uploadRes.ok) throw new Error(`CDN upload failed: ${uploadRes.status}`);

      setUploadProgress(80);

      // Step 3 — register in Shopify Files
      const fd2 = new FormData();
      fd2.append("step",        "create");
      fd2.append("shop",        shop);
      fd2.append("resourceUrl", stageData.resourceUrl);
      fd2.append("title",       title.trim() || video.title);

      const createRes  = await fetch("/api/upload", { method: "POST", body: fd2 });
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error);

      setUploadProgress(100);
      setUploadState("done");

      // Store new resourceUrl so save can update DB
      setNewVideo((prev) => ({ ...prev, resourceUrl: stageData.resourceUrl }));

    } catch (err) {
      setErrorMsg(err.message);
      setUploadState("idle");
      setUploadProgress(0);
    }
  }, [newVideo, shop, title, video.title]);

  // ── Upload thumbnail ──────────────────────────────────────────────────────
  const handleThumbUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image must be under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setThumbPreview(ev.target.result);
      setThumbBase64(ev.target.result);
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Capture frame from video ──────────────────────────────────────────────
  const handleCaptureFrame = useCallback(() => {
    const videoEl  = videoRef.current;
    const canvasEl = canvasRef.current;

    if (!videoEl || !canvasEl) return;
    if (videoEl.readyState < 2) {
      setErrorMsg("Please wait for the video to load.");
      return;
    }

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

  // ── Save all changes ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { setErrorMsg("Title cannot be empty."); return; }
    if (newVideo && uploadState !== "done") {
      setErrorMsg("Please upload the new video first before saving.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("action",  "edit");
      fd.append("shop",    shop);
      fd.append("videoId", video.id);
      fd.append("title",   title.trim());

      if (thumbBase64) {
        fd.append("thumbnailBase64", thumbBase64);
      }
      if (newVideo?.resourceUrl) {
        fd.append("newStorageKey", newVideo.resourceUrl);
      }

      const res  = await fetch("/api/videos", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSuccessMsg("Video updated successfully!");
      setTimeout(() => navigate("/app/videos"), 1500);
    } catch (err) {
      setErrorMsg(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [title, thumbBase64, newVideo, uploadState, shop, video.id, navigate]);

  const isVideoUploading = uploadState === "uploading";

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* ── Left: Form ── */}
          <BlockStack gap="400">
            {/* Title */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Video title</Text>
                <TextField
                  label="Title"
                  value={title}
                  onChange={(value) => setTitle(value)}
                  placeholder="Enter video title"
                  disabled={saving}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Replace video */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Replace video</Text>
                <Text tone="subdued">Upload a new video to replace the current one.</Text>
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
                      ✓ New video uploaded
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
                  {["upload", "capture"].map((mode) => (
                    <Button
                      key={mode}
                      onClick={() => setThumbMode(mode)}
                      variant={thumbMode === mode ? "primary" : "secondary"}
                      size="slim"
                    >
                      {mode === "upload" ? "Upload image" : "Capture from video"}
                    </Button>
                  ))}
                </div>
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
                {thumbMode === "capture" && (
                  <BlockStack gap="200">
                    <Text tone="subdued">
                      Play the video on the right, pause at the frame you want, then click capture.
                    </Text>
                    <Button
                      onClick={handleCaptureFrame}
                      disabled={saving || capturing}
                      loading={capturing}
                    >
                      Capture current frame
                    </Button>
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
            {/* Video preview */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  {newVideoPreview ? "New video preview" : "Current video"}
                </Text>
                <video
                  ref={videoRef}
                  src={newVideoPreview || video.storageKey}
                  controls
                  style={{ width: "100%", borderRadius: "8px", background: "#000" }}
                />
                {newVideoPreview && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Showing new video preview
                    </Text>
                    <button
                      onClick={() => {
                        setNewVideo(null);
                        setNewVideoPreview(null);
                        setUploadState("idle");
                        setUploadProgress(0);
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

            {/* Thumbnail preview */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Thumbnail preview</Text>
                {thumbPreview ? (
                  <BlockStack gap="200">
                    <img
                      src={thumbPreview}
                      alt="Thumbnail"
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        objectFit: "cover",
                        maxHeight: "200px",
                      }}
                    />
                    <Button
                      onClick={() => {
                        setThumbPreview(video.thumbnailKey || null);
                        setThumbBase64(null);
                      }}
                      tone="critical"
                      size="slim"
                    >
                      Reset thumbnail
                    </Button>
                  </BlockStack>
                ) : (
                  <Box
                    paddingBlockStart="600"
                    paddingBlockEnd="600"
                    style={{
                      background: "#f6f6f7",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    <Text tone="subdued">
                      {thumbMode === "upload" ? "Upload an image to preview." : "Capture a frame to preview."}
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
