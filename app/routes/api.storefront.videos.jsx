import { unauthenticated } from "../shopify.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

export async function action() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function loader({ request }) {
  const url  = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop" }, { status: 400, headers: CORS_HEADERS });
  }

  const { default: prisma } = await import("../db.server.js");

  const videos = await prisma.video.findMany({
    where:   { shop },
    orderBy: { createdAt: "desc" },
    include: { tags: true },
  });

  if (videos.length === 0) {
    return Response.json({ videos: [] }, { headers: CORS_HEADERS });
  }

  let admin;
  try {
    const result = await unauthenticated.admin(shop);
    admin = result.admin;
  } catch (err) {}

  // Collect all product IDs
  const allProductIds = [];
  videos.forEach((v) => {
    v.tags.forEach((t) => {
      if (!allProductIds.includes(t.productId)) allProductIds.push(t.productId);
    });
  });

  // Fetch products
  let productMap = {};
  if (admin && allProductIds.length > 0) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id title handle
              featuredImage { url }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
            }
          }
        }`,
        { variables: { ids: allProductIds } }
      );
      const result = await response.json();
      (result?.data?.nodes || []).forEach((p) => { if (p) productMap[p.id] = p; });
    } catch (err) {}
  }

  // Fetch real video URLs
  const fileIds = videos.filter((v) => v.shopifyFileId).map((v) => v.shopifyFileId);
  let fileMap = {};
  if (admin && fileIds.length > 0) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getFiles($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Video { id sources { url mimeType } }
          }
        }`,
        { variables: { ids: fileIds } }
      );
      const result = await response.json();
      (result?.data?.nodes || []).forEach((f) => {
        if (f) {
          const mp4 = f.sources?.find((s) => s.mimeType === "video/mp4");
          fileMap[f.id] = mp4?.url || f.sources?.[0]?.url || null;
        }
      });
    } catch (err) {}
  }

  const result = videos.map((video) => {
    const videoUrl = (video.shopifyFileId && fileMap[video.shopifyFileId])
      ? fileMap[video.shopifyFileId]
      : video.storageKey;

    const tags = video.tags.map((tag) => {
      const product = productMap[tag.productId];
      return {
        id:         tag.id,
        productId:  tag.productId,
        title:      product?.title || tag.title || "",
        image:      product?.featuredImage?.url || null,
        price:      product?.priceRangeV2?.minVariantPrice
          ? `${product.priceRangeV2.minVariantPrice.currencyCode} ${parseFloat(product.priceRangeV2.minVariantPrice.amount).toFixed(2)}`
          : "",
        productUrl: product?.handle ? `/products/${product.handle}` : null,
        timestamp:  tag.timestamp,
        positionX:  tag.positionX,
        positionY:  tag.positionY,
      };
    });

    return {
      id:           video.id,
      title:        video.title,
      redirectLink: video.redirectLink,
      storageKey:   videoUrl,
      thumbnailKey: video.thumbnailKey,
      tags,
    };
  });

  return Response.json({ videos: result }, { headers: CORS_HEADERS });
}
