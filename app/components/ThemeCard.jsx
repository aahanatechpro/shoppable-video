import { Banner, BlockStack, Box, Button, InlineStack, Modal, Select, Text } from '@shopify/polaris';
import React, { useCallback, useEffect, useState } from 'react';

const ThemeCard = ({ shop, apiKey, themes, isThemePopupOpen }) => {
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [selectedThemeName, setSelectedThemeName] = useState(null);
  const [templateType, setTemplateType] = useState(null);
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [themePopupOpen, setThemePopupOpen] = useState(false);

  const handleSelectThemeChange = useCallback((value) => {
    setSelectedThemeId(value);
  }, []);

  const themeData = themes?.map((theme) => ({
    label: `${theme.name}${theme.role === "main" ? " (Live)" : ""}`,
    value: theme.id,
  }));

  useEffect(() => {
    const mainTheme = themes?.find((theme) => theme.role === "main");
    setSelectedThemeId(mainTheme?.id);
    setSelectedThemeName(mainTheme?.name);
  }, [themes]);

  useEffect(() => {
    const theme = themes?.find((theme) => theme.id === selectedThemeId);
    setSelectedThemeName(theme?.name);
  }, [selectedThemeId, themes]);

  useEffect(() => {
    if (selectedThemeId) {
      fetchThemeTemplate("index");
    }
  }, [selectedThemeId]);

  const fetchThemeTemplate = async (templateName) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/theme-check?themeId=${selectedThemeId}&template=${templateName}`);
      const data = await res.json();
      
      if (data?.error) {
        console.error("API error:", data.error);
        setError(data.error);
        setTemplateType(null);
      } else {
        setTemplateType(data?.templateType || null);
        if (!data?.templateType) {
          setError(`Unable to detect theme template type. Theme: ${data?.themeName || 'Unknown'}`);
        }
      }
    } catch (err) {
      console.error("Theme check network error:", err);
      setError(`Network error: ${err.message}`);
      setTemplateType(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (themePopupOpen) {
      isThemePopupOpen(true);
    } else {
      isThemePopupOpen(false);
    }
  }, [themePopupOpen, isThemePopupOpen]);

  const codeContent = `<div class="shoppable-video-container"><div id="shoppable-video-root"></div></div><script>const appUrl = "https://app.encircledev.com/shoppable-video.js"; const cssUrl = "https://app.encircledev.com/shoppable-video.css"; fetch(appUrl).then(r => r.ok && r.text()).then(code => { if(code) { const s = document.createElement('script'); s.id = "shoppable-video"; s.defer = true; s.textContent = code; document.head.appendChild(s); }}).catch(e => console.error(e)); fetch(cssUrl).then(r => r.ok && r.text()).then(css => { if(css) { const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); }}).catch(e => console.error(e));</script>\n\n{% schema %}\n{\n  "name": "Shoppable Video",\n  "settings": [\n    {\n      "type": "header",\n      "content": "Settings managed through the Shoppable Video app"\n    }\n  ],\n  "presets": [{\n    "name": "Shoppable Video"\n  }]\n}\n{% endschema %}`;

  const copyCode = () => {
    const codeField = document.getElementById("codeField");
    if (codeField) {
      codeField.select();
      document.execCommand("copy");
    }
  };

  return (
    <>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">Add Extension To Your Theme</Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Embed shoppable videos directly in your storefront.
          </Text>
        </BlockStack>

        <Box maxWidth="360px">
          <Select
            label="Select Theme"
            options={themeData || []}
            onChange={handleSelectThemeChange}
            value={selectedThemeId || ""}
            disabled={!themeData || themeData.length === 0}
          />
        </Box>

        {loading ? (
          <Banner tone="info">
            <Text>Checking theme compatibility...</Text>
          </Banner>
        ) : templateType === 'json' ? (
          <BlockStack gap="300">
            <Banner tone="success">
              <Text>Modern theme detected - Ready for 1-click installation</Text>
            </Banner>
            <InlineStack>
              <Button
                variant="primary"
                onClick={() =>
                  window.open(
                    `https://${shop}/admin/themes/${selectedThemeId}/editor?template=index&addAppBlockId=${apiKey}/shoppable-video&target=newAppsSection`,
                    "_blank"
                  )
                }
              >
                1-click Install
              </Button>
            </InlineStack>
          </BlockStack>
        ) : templateType === 'liquid' ? (
          <BlockStack gap="300">
            <Banner tone="warning">
              <Text as="h2">Legacy theme detected - Manual installation required</Text>
              <Text>
                Your theme uses liquid templates. Add the code manually to your theme's index template.
              </Text>
            </Banner>
            <InlineStack>
              <Button
                variant="secondary"
                onClick={() => setThemePopupOpen(true)}
              >
                Manual Installation
              </Button>
            </InlineStack>
          </BlockStack>
        ) : error ? (
          <BlockStack gap="300">
            <Banner tone="critical">
              <Text as="h2">Unable to detect theme type</Text>
              <Text>{error}</Text>
            </Banner>
            <InlineStack>
              <Button
                variant="secondary"
                onClick={() => fetchThemeTemplate("index")}
              >
                Retry
              </Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <Banner tone="critical">
            <Text>Unable to detect theme template type. Please try again.</Text>
          </Banner>
        )}
      </BlockStack>

      <Modal
        open={themePopupOpen}
        onClose={() => setThemePopupOpen(false)}
        title="Manual Installation"
        size="large"
        primaryAction={{
          content: "Copy Code",
          onAction: copyCode,
        }}
        secondaryActions={[
          {
            content: "Close",
            onAction: () => setThemePopupOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ marginBottom: "16px" }}>
            <Text as="h3" variant="headingMd">Installation Steps:</Text>
            <ol style={{ marginTop: "12px", lineHeight: "1.8" }}>
              <li>Go to Online Store → Edit Code</li>
              <li>Create a new section file named "shoppable-video.liquid"</li>
              <li>Copy the code below and paste it into the new file</li>
              <li>Navigate to the customize section and edit the Index template</li>
              <li>Add the "Shoppable Video" section to your template</li>
              <li>Save your changes</li>
            </ol>
          </div>
          <textarea
            id="codeField"
            readOnly
            rows="12"
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #e1e3e5",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "12px",
              boxSizing: "border-box",
            }}
            defaultValue={codeContent}
          />
        </Modal.Section>
      </Modal>
    </>
  );
};

export default ThemeCard;
