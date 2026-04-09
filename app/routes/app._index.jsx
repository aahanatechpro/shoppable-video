import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Badge,
} from "@shopify/polaris";
import ThemeCard from "../components/ThemeCard.jsx";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const [videoCount, widgetCount] = await Promise.all([
    prisma.video.count({ where: { shop: session.shop } }),
    prisma.widget.count({ where: { shop: session.shop } }),
  ]);

  let themes = [];
  try {
    const themeResponse = await admin.graphql(`#graphql
      query { themes(first: 20) { nodes { id name role } } }
    `);
    const themeResult = await themeResponse.json();
    themes = (themeResult?.data?.themes?.nodes || []).map((theme) => ({
      id: theme.id.replace("gid://shopify/OnlineStoreTheme/", ""),
      name: theme.name,
      role: theme.role.toLowerCase(),
    }));
  } catch (err) {
  }

  return Response.json({
    shop: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    themes,
    videoCount,
    widgetCount,
  });
}

export default function DashboardPage() {
  const { shop, apiKey, themes, videoCount, widgetCount } = useLoaderData();
  const navigate = useNavigate();
  const [isThemePopupOpen, setIsThemePopupOpen] = useState(false);

  return (
    <Page title="Dashboard" subtitle="A cleaner overview of your shoppable video setup.">
      <BlockStack gap="300">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) repeat(2, minmax(220px, 1fr))", gap: "12px" }}>
          <Card>
            <Box padding="400">
              <BlockStack gap="200">
                <Badge tone="success">Overview</Badge>
                <Text as="h2" variant="headingLg">
                  Manage videos, widgets, and theme setup from one place
                </Text>
                <Text as="p" tone="subdued" variant="bodyMd">
                  Jump into your library, open widget management, or complete theme installation without extra clutter.
                </Text>
                <InlineStack gap="300">
                  <Button variant="primary" onClick={() => navigate("/app/videos")}>
                    Manage Videos
                  </Button>
                  <Button onClick={() => navigate("/app/widget")}>
                    Manage Widgets
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </Card>

          <Card>
            <Box padding="400">
              <BlockStack gap="100">
                <Text as="p" tone="subdued" variant="bodySm">Videos Uploaded</Text>
                <Text as="p" variant="heading2xl">{videoCount}</Text>
                <Text as="p" tone="subdued" variant="bodySm">All uploaded storefront videos.</Text>
              </BlockStack>
            </Box>
          </Card>

          <Card>
            <Box padding="400">
              <BlockStack gap="100">
                <Text as="p" tone="subdued" variant="bodySm">Widgets Created</Text>
                <Text as="p" variant="heading2xl">{widgetCount}</Text>
                <Text as="p" tone="subdued" variant="bodySm">Ready-to-use widget configurations.</Text>
              </BlockStack>
            </Box>
          </Card>
        </div>

        <Card>
          <Box padding="400">
            <ThemeCard
              shop={shop}
              apiKey={apiKey}
              themes={themes}
              isThemePopupOpen={setIsThemePopupOpen}
            />
          </Box>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);
