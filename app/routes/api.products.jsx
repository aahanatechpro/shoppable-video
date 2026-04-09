import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const formData = await request.formData();
  const action   = formData.get("action");
  const shop     = formData.get("shop");

  if (!shop) return Response.json({ error: "Missing shop" }, { status: 400 });

  // ── LOAD / SEARCH ─────────────────────────────────────────────────────────
  if (action === "search" || action === "load") {
    const searchQuery = formData.get("searchQuery") || "";
    const { admin }   = await unauthenticated.admin(shop);

    const response = await admin.graphql(
      `#graphql
      query searchProducts($query: String!) {
        products(first: 20, query: $query) {
          edges {
            node {
              id
              title
              featuredImage { url }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
            }
          }
        }
      }`,
      { variables: { query: searchQuery } }
    );

    const result   = await response.json();
    const products = result.data.products.edges.map(({ node }) => ({
      id:    node.id,
      title: node.title,
      image: node.featuredImage?.url || null,
      price: node.priceRangeV2?.minVariantPrice
        ? `${node.priceRangeV2.minVariantPrice.currencyCode} ${parseFloat(node.priceRangeV2.minVariantPrice.amount).toFixed(2)}`
        : "",
    }));

    return Response.json({ products });
  }

  // ── TAG ───────────────────────────────────────────────────────────────────
  if (action === "tag") {
    const tag = await prisma.productTag.create({
      data: {
        videoId:   formData.get("videoId"),
        shop,                                    // ← shop saved with tag
        productId: formData.get("productId"),
        title:     formData.get("title") || "",
        timestamp: parseFloat(formData.get("timestamp") || "0"),
        positionX: parseFloat(formData.get("positionX") || "50"),
        positionY: parseFloat(formData.get("positionY") || "50"),
      },
    });
    return Response.json({ tag });
  }

  // ── REMOVE ────────────────────────────────────────────────────────────────
  if (action === "remove") {
    await prisma.productTag.delete({ where: { id: formData.get("tagId") } });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}