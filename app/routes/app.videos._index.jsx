import { useState, useRef, useCallback } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  Page,
  Card,
  EmptyState,
  Button,
  ButtonGroup,
  Modal,
  TextField,
  Checkbox,
  Banner,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Spinner,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  const videos = await prisma.video.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: { tags: true },
  });

  return Response.json({
    videos,
    shop: session.shop,
  });
}

function VideoLibraryPage() {
  const { videos: initialVideos, shop } = useLoaderData();
  const navigate = useNavigate();

  const [videos, setVideos] = useState(initialVideos);
  const [activeVideo, setActiveVideo] = useState(null);
  const [tags, setTags] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProds, setFilteredProds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingProds, setLoadingProds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedResources, setSelectedResources] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef(null);

  const allResourcesSelected = videos.length > 0 && selectedResources.length === videos.length;

  const clearSelection = useCallback(() => {
    setSelectedResources([]);
  }, []);

  const toggleSelectAll = useCallback((checked) => {
    setSelectedResources(checked ? videos.map((video) => video.id) : []);
  }, [videos]);

  const toggleSelection = useCallback((videoId, checked) => {
    setSelectedResources((prev) => (
      checked ? [...prev, videoId] : prev.filter((id) => id !== videoId)
    ));
  }, []);

  const handleDelete = useCallback(async (videoId) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    setDeleting(videoId);
    try {
      const fd = new FormData();
      fd.append("action", "delete");
      fd.append("shop", shop);
      fd.append("videoId", videoId);
      const data = await fetch("/api/videos", { method: "POST", body: fd }).then((response) => response.json());
      if (data.error) throw new Error(data.error);
      setVideos((prev) => prev.filter((video) => video.id !== videoId));
      setSelectedResources((prev) => prev.filter((id) => id !== videoId));
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  }, [shop]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedResources.length) return;
    if (!confirm(`Delete ${selectedResources.length} selected video${selectedResources.length > 1 ? "s" : ""}?`)) return;

    setBulkDeleting(true);
    try {
      await Promise.all(
        selectedResources.map(async (videoId) => {
          const fd = new FormData();
          fd.append("action", "delete");
          fd.append("shop", shop);
          fd.append("videoId", videoId);
          const data = await fetch("/api/videos", { method: "POST", body: fd }).then((response) => response.json());
          if (data.error) throw new Error(data.error);
        })
      );

      setVideos((prev) => prev.filter((video) => !selectedResources.includes(video.id)));
      clearSelection();
    } catch (err) {
      alert("Bulk delete failed: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedResources, shop, clearSelection]);

  const loadProducts = useCallback(async () => {
    setLoadingProds(true);
    try {
      const fd = new FormData();
      fd.append("action", "load");
      fd.append("shop", shop);
      fd.append("searchQuery", "");
      const data = await fetch("/api/products", { method: "POST", body: fd }).then((response) => response.json());
      if (data.error) throw new Error(data.error);
      setAllProducts(data.products);
      setFilteredProds(data.products);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingProds(false);
    }
  }, [shop]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredProds(allProducts);
      return;
    }
    const lower = query.toLowerCase();
    setFilteredProds(allProducts.filter((product) => product.title.toLowerCase().includes(lower)));
  }, [allProducts]);

  const openTagger = useCallback((video) => {
    setActiveVideo(video);
    setTags(video.tags || []);
    setSearchQuery("");
    setErrorMsg("");
    loadProducts();
  }, [loadProducts]);

  const closeTagger = useCallback(() => {
    setActiveVideo(null);
    setTags([]);
    setAllProducts([]);
    setFilteredProds([]);
    setSearchQuery("");
    setErrorMsg("");
  }, []);

  const handleSelectProduct = useCallback((product) => {
    const isSelected = tags.some((tag) => tag.productId === product.id);
    const timestamp = videoRef.current?.currentTime || 0;

    if (isSelected) {
      setTags((prev) => prev.filter((tag) => tag.productId !== product.id));
    } else {
      setTags([{
        id: `temp_${Date.now()}`,
        productId: product.id,
        title: product.title,
        image: product.image,
        timestamp,
        positionX: 50,
        positionY: 50,
        isNew: true,
      }]);
    }
  }, [tags]);

  const handleSave = useCallback(async () => {
    if (!activeVideo) return;
    setSaving(true);
    setErrorMsg("");

    try {
      for (const tag of activeVideo.tags || []) {
        const fd = new FormData();
        fd.append("action", "remove");
        fd.append("shop", shop);
        fd.append("tagId", tag.id);
        await fetch("/api/products", { method: "POST", body: fd });
      }

      for (const tag of tags) {
        const fd = new FormData();
        fd.append("action", "tag");
        fd.append("shop", shop);
        fd.append("videoId", activeVideo.id);
        fd.append("productId", tag.productId);
        fd.append("title", tag.title || "");
        fd.append("timestamp", String(tag.timestamp || 0));
        fd.append("positionX", "50");
        fd.append("positionY", "50");
        await fetch("/api/products", { method: "POST", body: fd });
      }

      closeTagger();
      window.location.reload();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }, [activeVideo, tags, shop, closeTagger]);

  return (
    <Page
      title="Video library"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      primaryAction={{
        content: "Upload video",
        onAction: () => navigate("/app/videos/upload"),
      }}
    >
      <BlockStack gap="300">
        <style>{`
          .sv-video-table-wrap {
            padding-inline: 4px;
          }
          .sv-video-table-shell {
            overflow: hidden;
          }
          .sv-video-table-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
          }
          .sv-video-table-icon {
            width: 32px;
            height: 32px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            color: #4b5563;
            font-size: 15px;
          }
          .sv-video-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
          }
          .sv-video-table thead th {
            padding: 12px 14px;
            font-size: 13px;
            font-weight: 600;
            color: #6b7280;
            text-align: left;
            background: #fafafa;
            border-bottom: 1px solid #e5e7eb;
          }
          .sv-video-table tbody td {
            padding: 5px 14px;
            vertical-align: middle;
            border-bottom: 1px solid #eceff3;
            background: #fff;
          }
          .sv-video-table tbody tr:last-child td {
            border-bottom: none;
          }
          .sv-video-thumb {
            width: 44px;
            height: 40px;
            border-radius: 10px;
            overflow: hidden;
            flex-shrink: 0;
            background: #fff;
            border: 1px solid #e5e7eb;
          }
          .sv-video-tag-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            font-size: 13px;
            color: #111827;
            background: #fff;
            white-space: nowrap;
          }
          .sv-video-table td.sv-video-action-cell {
            white-space: nowrap;
          }
          .sv-video-table td.sv-video-action-cell .Polaris-ButtonGroup {
            flex-wrap: nowrap;
          }
          .sv-video-table-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 14px;
            border-top: 1px solid #e5e7eb;
            background: #fff;
          }
        `}</style>

        {videos.length === 0 ? (
          <Card>
            <EmptyState
              heading="No videos uploaded yet"
              action={{
                content: "Upload video",
                onAction: () => navigate("/app/videos/upload"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Upload your first shoppable video to get started.</p>
            </EmptyState>
          </Card>
        ) : (
          <div className="sv-video-table-wrap">
            <Card padding="0">
              <div className="sv-video-table-shell">
                <div className="sv-video-table-toolbar">
                  <InlineStack gap="200" blockAlign="center">
                    {selectedResources.length > 0 ? (
                      <Button
                        size="slim"
                        variant="primary"
                        tone="critical"
                        onClick={handleBulkDelete}
                        loading={bulkDeleting}
                      >
                        Delete selected ({selectedResources.length})
                      </Button>
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Manage your uploaded videos
                      </Text>
                    )}
                  </InlineStack>
                </div>

                <table className="sv-video-table">
                  <thead>
                    <tr>
                      <th style={{ width: "44px" }}>
                        <Checkbox
                          label=""
                          checked={allResourcesSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Video</th>
                      <th>Upload at</th>
                      <th>Tag product(s)</th>
                      <th style={{ textAlign: "center", width: "170px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <tr key={video.id}>
                        <td>
                          <Checkbox
                            label=""
                            checked={selectedResources.includes(video.id)}
                            onChange={(checked) => toggleSelection(video.id, checked)}
                          />
                        </td>
                        <td>
                          <InlineStack gap="300" blockAlign="center">
                            <div className="sv-video-thumb">
                              {video.thumbnailKey ? (
                                <img
                                  src={video.thumbnailKey}
                                  alt={video.title}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "#ffffff",
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 20 20" fill="#8c9196">
                                    <path d="M8 6.5l5 3.5-5 3.5V6.5z"/>
                                    <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2 0v12h12V4H4z"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <Text as="span" variant="bodyMd" fontWeight="medium">
                              {video.title}
                            </Text>
                          </InlineStack>
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd" tone="subdued">
                            {new Date(video.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </Text>
                        </td>
                        <td>
                          {video.tags.length > 0 ? (
                            <span className="sv-video-tag-pill">
                              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path
                                  d="M10.59 2.75H4.75a2 2 0 0 0-2 2v5.84a2 2 0 0 0 .59 1.41l5.5 5.5a2 2 0 0 0 2.82 0l5.84-5.84a2 2 0 0 0 0-2.82L12 3.34a2 2 0 0 0-1.41-.59Z"
                                  stroke="#4B5563"
                                  strokeWidth="1.6"
                                  strokeLinejoin="round"
                                />
                                <circle cx="7" cy="7" r="1.25" fill="#4B5563" />
                              </svg>
                              {video.tags.length} product{video.tags.length > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <Text as="span" variant="bodySm" tone="subdued">
                              Not tagged
                            </Text>
                          )}
                        </td>
                        <td className="sv-video-action-cell">
                          <InlineStack align="center">
                            <ButtonGroup>
                              <Button size="slim" onClick={() => openTagger(video)}>
                                Tag
                              </Button>
                              <Button
                                size="slim"
                                onClick={() => navigate(`/app/videos/${video.id}/edit`)}
                                icon={EditIcon}
                              />
                              <Button
                                size="slim"
                                variant="critical"
                                onClick={() => handleDelete(video.id)}
                                disabled={deleting === video.id || bulkDeleting}
                                loading={deleting === video.id}
                                icon={DeleteIcon}
                              />
                            </ButtonGroup>
                          </InlineStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="sv-video-table-footer">
                  <InlineStack gap="200" blockAlign="center">
                    <Button size="slim" disabled>
                      Previous
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      1 - {videos.length} of {videos.length} videos
                    </Text>
                    <Button size="slim" disabled>
                      Next
                    </Button>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Items per page
                    </Text>
                    <Button size="slim">10</Button>
                  </InlineStack>
                </div>
              </div>
            </Card>
          </div>
        )}
      </BlockStack>

      <Modal
        open={Boolean(activeVideo)}
        onClose={closeTagger}
        title={`Tag products - ${activeVideo?.title || ""}`}
        primaryAction={{
          content: "Save tags",
          onAction: handleSave,
          loading: saving,
          disabled: saving,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: closeTagger,
            disabled: saving,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {errorMsg ? (
              <Banner tone="critical" onDismiss={() => setErrorMsg("")}>
                {errorMsg}
              </Banner>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Box>
                <video
                  ref={videoRef}
                  src={activeVideo?.storageKey}
                  controls
                  style={{ width: "100%", borderRadius: "8px", background: "#000" }}
                />
              </Box>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Tagged products</Text>
                <TextField
                  label=""
                  placeholder="Search by product name"
                  value={searchQuery}
                  onChange={handleSearch}
                  disabled={loadingProds}
                />
                <Box
                  style={{
                    overflowY: "auto",
                    maxHeight: "300px",
                    border: "1px solid #e1e3e5",
                    borderRadius: "6px",
                  }}
                >
                  {loadingProds ? (
                    <Box padding="400" style={{ textAlign: "center" }}>
                      <Spinner accessibilityLabel="Loading products" />
                    </Box>
                  ) : filteredProds.length === 0 ? (
                    <Box padding="400" style={{ textAlign: "center", color: "#6d7175" }}>
                      <Text tone="subdued" as="p" variant="bodySm">No products found</Text>
                    </Box>
                  ) : (
                    <div>
                      {filteredProds.map((product) => {
                        const isSelected = tags.some((tag) => tag.productId === product.id);
                        return (
                          <Box
                            key={product.id}
                            padding="300"
                            borderInline="base"
                            style={{
                              borderBottom: "1px solid #f1f2f3",
                              paddingBottom: "12px",
                              marginBottom: "12px",
                            }}
                          >
                            <InlineStack gap="200" blockAlign="start">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleSelectProduct(product)}
                              />
                              <Box style={{ width: "36px", height: "36px", flexShrink: 0 }}>
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      background: "#f1f2f3",
                                      borderRadius: "4px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#8c9196">
                                      <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v15A1.5 1.5 0 0 0 2.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 17.5 1h-15z"/>
                                    </svg>
                                  </div>
                                )}
                              </Box>
                              <Text as="p" variant="bodySm" fontWeight="medium">
                                {product.title}
                              </Text>
                            </InlineStack>
                          </Box>
                        );
                      })}
                    </div>
                  )}
                </Box>
              </BlockStack>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);

export default VideoLibraryPage;
