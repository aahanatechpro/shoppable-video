import { authenticate } from '../shopify.server';

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const themeId = url.searchParams.get('themeId');
  const template = url.searchParams.get('template');

  if (!themeId || !template) {
    return Response.json({ error: 'themeId and template are required' }, { status: 400 });
  }

  try {
    // Step 1: Verify theme exists
    const themeResponse = await admin.graphql(`#graphql
      query getTheme($id: ID!) {
        theme(id: $id) {
          id
          name
        }
      }
    `, {
      variables: { id: `gid://shopify/OnlineStoreTheme/${themeId}` }
    });

    const themeResult = await themeResponse.json();
    
    if (themeResult?.errors) {
      console.error('Theme query error:', themeResult.errors);
      return Response.json({ themeSupported: false, templateType: null, error: 'Failed to fetch theme' });
    }

    const theme = themeResult?.data?.theme;

    if (!theme) {
      return Response.json({ themeSupported: false, templateType: null, error: 'Theme not found' });
    }

    // Step 2: Fetch all template files from the theme
    const filesResponse = await admin.graphql(`#graphql
      query getThemeFiles($id: ID!) {
        theme(id: $id) {
          files(first: 250) {
            nodes {
              filename
            }
          }
        }
      }
    `, {
      variables: { 
        id: `gid://shopify/OnlineStoreTheme/${themeId}`
      }
    });

    const filesResult = await filesResponse.json();
    
    if (filesResult?.errors) {
      console.error('Files query error:', filesResult.errors);
      return Response.json({ themeSupported: false, templateType: null, error: 'Failed to fetch theme files' });
    }

    const files = filesResult?.data?.theme?.files?.nodes || [];
    const fileNames = files.map(f => f.filename);


    // Check for JSON template (modern theme) - check for ANY .json in templates
    const hasJsonTemplate = fileNames.some(name => 
      name.startsWith('templates/') && name.endsWith('.json')
    );
    
    if (hasJsonTemplate) {
      return Response.json({ 
        themeSupported: true,
        templateType: 'json',
        themeName: theme.name,
        themeId: themeId 
      });
    }

    // Check for Liquid template (old theme)
    const hasLiquidTemplate = fileNames.some(name => 
      name === `templates/${template}.liquid` || name === 'templates/index.liquid'
    );
    
    if (hasLiquidTemplate) {
      return Response.json({ 
        themeSupported: true,
        templateType: 'liquid',
        themeName: theme.name,
        themeId: themeId 
      });
    }

    // Check if it's a modern theme based on other indicators
    const hasModernFiles = fileNames.some(name => 
      name.includes('sections/') || name.includes('settings.json') || name.includes('locales/')
    );
    
    if (hasModernFiles) {
      return Response.json({ 
        themeSupported: true,
        templateType: 'json',
        themeName: theme.name,
        themeId: themeId 
      });
    }

    if (hasLiquidTemplate) {
      return Response.json({ 
        themeSupported: true,
        templateType: 'liquid',
        themeName: theme.name,
        themeId: themeId 
      });
    }

    // Neither template type found
    console.warn(`No templates found for theme ${themeId}, template ${template}`);
    return Response.json({ 
      themeSupported: false,
      templateType: null,
      themeName: theme.name,
      themeId: themeId,
      error: 'No compatible template found in theme'
    });

  } catch (error) {
    console.error('Theme check error:', error);
    return Response.json({ 
      themeSupported: false, 
      templateType: null, 
      error: error.message 
    }, { status: 500 });
  }
}
