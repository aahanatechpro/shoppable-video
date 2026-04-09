import prisma from "../db.server";

export async function action({ request }) {
  const formData = await request.formData();
  const action   = formData.get("action");
  const shop     = formData.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop" }, { status: 400 });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (action === "delete") {
    const videoId = formData.get("videoId");

    const video = await prisma.video.findFirst({
      where: { id: videoId, shop },
    });

    if (!video) {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }

    await prisma.video.delete({ where: { id: videoId } });
    return Response.json({ success: true });
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  if (action === "edit") {
    const videoId         = formData.get("videoId");
    const title           = formData.get("title");
    const redirectLink    = formData.get("redirectLink");
    const thumbnailBase64 = formData.get("thumbnailBase64");
    const newStorageKey   = formData.get("newStorageKey");

    const video = await prisma.video.findFirst({
      where: { id: videoId, shop },
    });

    if (!video) {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }

    const updateData = {
      title,
      redirectLink: redirectLink?.trim() || null,
    };

    // Update thumbnail if provided
    if (thumbnailBase64) {
      updateData.thumbnailKey = thumbnailBase64;
    }

    // Update video storageKey if new video was uploaded
    if (newStorageKey) {
      updateData.storageKey = newStorageKey;
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data:  updateData,
    });

    return Response.json({ success: true, video: updated });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
} 
