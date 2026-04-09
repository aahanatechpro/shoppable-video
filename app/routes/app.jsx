import { Outlet, useLoaderData, useRouteError, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const location = useLocation();
  const isDashboardActive = location.pathname === "/app";
  const isVideosActive = location.pathname === "/app/videos" || location.pathname.startsWith("/app/videos/");
  const isWidgetsActive = location.pathname === "/app/widget" || location.pathname.startsWith("/app/widget/");

  return (
    <AppProvider embedded apiKey={apiKey}>
      <style>{`
        .Polaris-Page {
          max-width: none;
        }
        .Polaris-Page__Content {
          max-width: none;
        }
        @media (min-width: 768px) {
          .Polaris-Page {
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      `}</style>
      <s-app-nav>
        <s-link href="/app" class={isDashboardActive ? "active" : ""}>Dashboard</s-link>
        <s-link href="/app/videos" class={isVideosActive ? "active" : ""}>Videos</s-link>
        <s-link href="/app/widget" class={isWidgetsActive ? "active" : ""}>Widgets</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
