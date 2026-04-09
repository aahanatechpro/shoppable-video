import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const formData = await request.formData();
  const step     = formData.get("step");
  const shop     = formData.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop" }, { status: 400 });
  }

  let admin;
  try {
    const result = await unauthenticated.admin(shop);
    admin = result.admin;
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  // ── STEP 1: Get staged upload URL ─────────────────────────────────────────
  if (step === "staged") {
    const filename = formData.get("filename");
    const fileSize = formData.get("fileSize");
    const mimeType = formData.get("mimeType");

    const response = await admin.graphql(
      `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: [{
            resource:   "VIDEO",
            filename,
            mimeType,
            fileSize:   String(fileSize),
            httpMethod: "POST",
          }],
        },
      }
    );

    const result = await response.json();
    const { stagedTargets, userErrors } = result.data.stagedUploadsCreate;

    if (userErrors?.length > 0) {
      return Response.json({ error: userErrors[0].message }, { status: 400 });
    }

    const target = stagedTargets[0];
    return Response.json({
      step:        "staged",
      uploadUrl:   target.url,
      resourceUrl: target.resourceUrl,
      parameters:  target.parameters,
    });
  }

  // ── STEP 2: Register file + save to DB ────────────────────────────────────
  if (step === "create") {
    const resourceUrl    = formData.get("resourceUrl");
    const title          = formData.get("title");
    const redirectLink   = formData.get("redirectLink") || null;
    const thumbnailBase64 = formData.get("thumbnailBase64") || null;

    const response = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            ... on Video {
              id
              originalSource { url }
            }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          files: [{
            originalSource: resourceUrl,
            contentType:    "VIDEO",
            alt:            title || "Shoppable video",
          }],
        },
      }
    );

    const result = await response.json();
    const { files, userErrors } = result.data.fileCreate;

    if (userErrors?.length > 0) {
      return Response.json({ error: userErrors[0].message }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: {
        shop,
        title:         title || "Untitled video",
        redirectLink:  redirectLink?.trim() || null,
        storageKey:    resourceUrl,
        shopifyFileId: files[0].id,
        thumbnailKey:  thumbnailBase64,   // save thumbnail if provided
        status:        "PROCESSING",
      },
    });

    return Response.json({ step: "done", success: true, videoId: video.id });
  }

  return Response.json({ error: "Invalid step" }, { status: 400 });
}
