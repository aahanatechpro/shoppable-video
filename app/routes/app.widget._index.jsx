import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useNavigate, useSubmit, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Card,
  EmptyState,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  Text,
  Checkbox,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server.js");
  const widgets = await prisma.widget.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ widgets, shop: session.shop });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server.js");
  const formData = await request.formData();
  const widgetId = formData.get("widgetId");

  await prisma.widget.deleteMany({
    where: { id: widgetId, shop: session.shop },
  });

  return Response.json({ success: true, deletedId: widgetId });
}

export default function WidgetList() {
  const { widgets: initial } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [widgets, setWidgets] = useState(initial);
  const [copied, setCopied] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedResources, setSelectedResources] = useState([]);

  const deleting = navigation.state === "submitting";
  const allResourcesSelected = widgets.length > 0 && selectedResources.length === widgets.length;

  useEffect(() => {
    if (actionData?.deletedId) {
      setWidgets((prev) => prev.filter((widget) => widget.id !== actionData.deletedId));
      setSelectedResources((prev) => prev.filter((id) => id !== actionData.deletedId));
    }
  }, [actionData]);

  const handleDelete = useCallback((id) => {
    if (!confirm("Delete this widget?")) return;
    const fd = new FormData();
    fd.append("widgetId", id);
    submit(fd, { method: "POST" });
  }, [submit]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedResources.length) return;
    if (!confirm(`Delete ${selectedResources.length} selected widget${selectedResources.length > 1 ? "s" : ""}?`)) return;

    setBulkDeleting(true);
    try {
      await Promise.all(
        selectedResources.map(async (widgetId) => {
          const fd = new FormData();
          fd.append("widgetId", widgetId);
          const data = await fetch("/app/widget", { method: "POST", body: fd }).then((response) => response.json());
          if (data.error) throw new Error(data.error);
        })
      );

      setWidgets((prev) => prev.filter((widget) => !selectedResources.includes(widget.id)));
      setSelectedResources([]);
    } catch (err) {
      alert("Bulk delete failed: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedResources]);

  const copyId = useCallback((id) => {
    navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const toggleSelectAll = useCallback((checked) => {
    setSelectedResources(checked ? widgets.map((widget) => widget.id) : []);
  }, [widgets]);

  const toggleSelection = useCallback((widgetId, checked) => {
    setSelectedResources((prev) => (
      checked ? [...prev, widgetId] : prev.filter((id) => id !== widgetId)
    ));
  }, []);

  return (
    <Page
      title="Widgets"
      subtitle="Manage storefront experiences and keep each layout on brand."
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      primaryAction={{
        content: "Create widget",
        onAction: () => navigate("/app/widget/add"),
      }}
    >
      <BlockStack gap="300">
        <style>{`
          .sv-widget-table-wrap {
            padding-inline: 6px;
          }
          .sv-widget-table-shell {
            overflow: hidden;
          }
          .sv-widget-table-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
          }
          .sv-widget-table-icon {
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
          .sv-widget-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
          }
          .sv-widget-table thead th {
            padding: 12px 14px;
            font-size: 13px;
            font-weight: 600;
            color: #6b7280;
            text-align: left;
            background: #fafafa;
            border-bottom: 1px solid #e5e7eb;
          }
          .sv-widget-table tbody td {
            padding: 5px 14px;
            vertical-align: middle;
            border-bottom: 1px solid #eceff3;
            background: #fff;
          }
          .sv-widget-table tbody tr:last-child td {
            border-bottom: none;
          }
          .sv-widget-id-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 10px;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            font-size: 13px;
            color: #111827;
            background: #fff;
            white-space: nowrap;
          }
          .sv-widget-table td.sv-widget-action-cell {
            white-space: nowrap;
          }
          .sv-widget-table td.sv-widget-action-cell .Polaris-ButtonGroup {
            flex-wrap: nowrap;
          }
          .sv-widget-table-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 14px;
            border-top: 1px solid #e5e7eb;
            background: #fff;
          }
        `}</style>

        {widgets.length === 0 ? (
          <Card>
            <EmptyState
              heading="No widgets yet"
              action={{
                content: "Create widget",
                onAction: () => navigate("/app/widget/add"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create a widget to embed shoppable videos in your storefront.</p>
            </EmptyState>
          </Card>
        ) : (
          <div className="sv-widget-table-wrap">
            <Card padding="0">
              <div className="sv-widget-table-shell">
                <div className="sv-widget-table-toolbar">
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
                        Manage your storefront widgets
                      </Text>
                    )}
                  </InlineStack>
                 
                </div>

                <table className="sv-widget-table">
                  <thead>
                    <tr>
                      <th style={{ width: "44px" }}>
                        <Checkbox
                          label=""
                          checked={allResourcesSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Widget</th>
                      <th>Widget ID</th>
                      <th>Layout</th>
                      <th style={{ textAlign: "center", width: "140px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widgets.map((widget) => (
                      <tr key={widget.id}>
                        <td>
                          <Checkbox
                            label=""
                            checked={selectedResources.includes(widget.id)}
                            onChange={(checked) => toggleSelection(widget.id, checked)}
                          />
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            {widget.title}
                          </Text>
                        </td>
                        <td>
                          <span className="sv-widget-id-pill">
                            {widget.id}
                            <Button
                              size="micro"
                              variant={copied === widget.id ? "primary" : "tertiary"}
                              onClick={() => copyId(widget.id)}
                            >
                              {copied === widget.id ? "Copied" : "Copy"}
                            </Button>
                          </span>
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd" tone="subdued">
                            {widget.layout === "slider" ? "Slider" : "Grid"}
                          </Text>
                        </td>
                        <td className="sv-widget-action-cell">
                          <InlineStack align="center">
                            <ButtonGroup>
                              <Button
                                size="slim"
                                onClick={() => navigate(`/app/widget/${widget.id}/edit`)}
                                icon={EditIcon}
                              />
                              <Button
                                size="slim"
                                variant="critical"
                                onClick={() => handleDelete(widget.id)}
                                disabled={deleting || bulkDeleting}
                                icon={DeleteIcon}
                              />
                            </ButtonGroup>
                          </InlineStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="sv-widget-table-footer">
                  <InlineStack gap="200" blockAlign="center">
                    <Button size="slim" disabled>
                      Previous
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      1 - {widgets.length} of {widgets.length} widgets
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
    </Page>
  );
}

export const headers = (args) => boundary.headers(args);
