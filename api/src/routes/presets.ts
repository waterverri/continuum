import express from 'express';
import { RequestWithUser } from '../index';
import { createClient } from '@supabase/supabase-js';
import puppeteer, { Browser, Page } from 'puppeteer';
import MarkdownIt from 'markdown-it';

const router = express.Router();
const md = new MarkdownIt();

// Create Supabase client for server-side operations
const getSupabaseClient = (userToken: string) => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
};

// GET /api/presets/:projectId - Get all presets for a project
router.get('/:projectId', async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    const { data: presets, error } = await supabase
      .from('presets')
      .select('id, name, rules, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching presets:', error);
      return res.status(500).json({ error: 'Failed to fetch presets' });
    }

    // Enhance presets with document info
    const enhancedPresets = await Promise.all((presets || []).map(async (preset) => {
      const documentId = preset.rules?.document_id;
      if (documentId) {
        const { data: document } = await supabase
          .from('documents')
          .select('id, title, is_composite, content, components, document_type')
          .eq('id', documentId)
          .single();
        
        return {
          ...preset,
          document
        };
      }
      return preset;
    }));

    res.json(enhancedPresets);
  } catch (error) {
    console.error('Error in GET /presets/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/presets/:projectId - Create a new preset
router.post('/:projectId', async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const { name, documentId } = req.body;

    if (!name || !documentId) {
      return res.status(400).json({ error: 'Name and documentId are required' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Verify the document exists and belongs to this project
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, is_composite, content, components, document_type')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found in this project' });
    }

    // Create the preset with document_id in rules
    const { data: preset, error } = await supabase
      .from('presets')
      .insert({
        project_id: projectId,
        name,
        rules: { document_id: documentId }
      })
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A preset with this name already exists in this project' });
      }
      console.error('Error creating preset:', error);
      return res.status(500).json({ error: 'Failed to create preset' });
    }

    res.status(201).json({
      ...preset,
      document
    });
  } catch (error) {
    console.error('Error in POST /presets/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/presets/:presetId - Update a preset
router.put('/:presetId', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const { name, documentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Get the existing preset to verify ownership
    const { data: existingPreset, error: fetchError } = await supabase
      .from('presets')
      .select('project_id, rules')
      .eq('id', presetId)
      .single();

    if (fetchError || !existingPreset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    let updateData: any = { name };

    // If documentId is provided, verify it exists in the same project
    if (documentId) {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, title, is_composite, content, components, document_type')
        .eq('id', documentId)
        .eq('project_id', existingPreset.project_id)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Document not found in this project' });
      }

      updateData.rules = { document_id: documentId };
    }

    // Update the preset
    const { data: preset, error } = await supabase
      .from('presets')
      .update(updateData)
      .eq('id', presetId)
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A preset with this name already exists in this project' });
      }
      console.error('Error updating preset:', error);
      return res.status(500).json({ error: 'Failed to update preset' });
    }

    // Get the document info if available
    let document = null;
    const documentId_final = preset.rules?.document_id;
    if (documentId_final) {
      const { data: docData } = await supabase
        .from('documents')
        .select('id, title, is_composite, content, components, document_type')
        .eq('id', documentId_final)
        .single();
      document = docData;
    }

    res.json({
      ...preset,
      document
    });
  } catch (error) {
    console.error('Error in PUT /presets/:presetId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/presets/:presetId - Delete a preset
router.delete('/:presetId', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    const { error } = await supabase
      .from('presets')
      .delete()
      .eq('id', presetId);

    if (error) {
      console.error('Error deleting preset:', error);
      return res.status(500).json({ error: 'Failed to delete preset' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /presets/:presetId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/presets/:presetId/overrides - Update component overrides for a preset
router.put('/:presetId/overrides', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const { overrides } = req.body;

    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Overrides must be provided as an object' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Get the existing preset to verify ownership and get current rules
    const { data: existingPreset, error: fetchError } = await supabase
      .from('presets')
      .select('project_id, rules')
      .eq('id', presetId)
      .single();

    if (fetchError || !existingPreset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Validate that all override document IDs exist in the same project
    const documentIds = Object.values(overrides).filter(Boolean) as string[];
    if (documentIds.length > 0) {
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', existingPreset.project_id)
        .in('id', documentIds);

      if (docsError || !documents || documents.length !== documentIds.length) {
        return res.status(400).json({ error: 'One or more override documents not found in this project' });
      }
    }

    // Update the preset rules to include component overrides
    const updatedRules = {
      ...existingPreset.rules,
      component_overrides: overrides
    };

    const { data: preset, error } = await supabase
      .from('presets')
      .update({ rules: updatedRules })
      .eq('id', presetId)
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      console.error('Error updating preset overrides:', error);
      return res.status(500).json({ error: 'Failed to update preset overrides' });
    }

    res.json(preset);
  } catch (error) {
    console.error('Error in PUT /presets/:presetId/overrides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/presets/:presetId/context - Generate context with component overrides applied
router.get('/:presetId/context', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    // Get the preset with document info
    const { data: preset, error: presetError } = await supabase
      .from('presets')
      .select('id, name, rules, project_id')
      .eq('id', presetId)
      .single();

    if (presetError || !preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const documentId = preset.rules?.document_id;
    if (!documentId) {
      return res.status(400).json({ error: 'Preset has no associated document' });
    }

    // Get the base document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, is_composite, components')
      .eq('id', documentId)
      .eq('project_id', preset.project_id)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Preset document not found' });
    }

    // Recursive function to resolve composite documents with overrides
    const resolveWithOverrides = async (
      docContent: string, 
      docComponents: Record<string, string> = {},
      overrides: Record<string, string> = {},
      visited: Set<string> = new Set()
    ): Promise<string> => {
      let resolvedContent = docContent;
      
      // Find all component references in the content
      const componentRegex = /{{([^}]+)}}/g;
      const matches = [...docContent.matchAll(componentRegex)];
      
      for (const match of matches) {
        const componentKey = match[1];
        if (!componentKey) continue;
        
        // Check if this component has an override
        let targetDocId = overrides[componentKey] || docComponents[componentKey];
        
        if (!targetDocId) continue;
        
        // Prevent infinite recursion
        if (visited.has(targetDocId)) {
          console.warn(`Circular reference detected for document ${targetDocId}`);
          continue;
        }
        
        // Get the component document
        const { data: componentDoc, error: componentError } = await supabase
          .from('documents')
          .select('id, content, is_composite, components')
          .eq('id', targetDocId)
          .eq('project_id', preset.project_id)
          .single();
          
        if (componentError || !componentDoc) {
          console.warn(`Component document ${targetDocId} not found`);
          continue;
        }
        
        let componentContent = componentDoc.content || '';
        
        // If the component is also composite, recursively resolve it
        if (componentDoc.is_composite && componentDoc.components) {
          const newVisited = new Set(visited);
          newVisited.add(targetDocId);
          componentContent = await resolveWithOverrides(
            componentContent,
            componentDoc.components,
            overrides, // Pass through the same overrides for nested resolution
            newVisited
          );
        }
        
        // Replace the component reference with the resolved content
        resolvedContent = resolvedContent.replace(match[0], componentContent);
      }
      
      return resolvedContent;
    };

    // Apply overrides and resolve the document
    const overrides = preset.rules.component_overrides || {};
    let resolvedContent = document.content || '';
    
    if (document.is_composite && document.components) {
      resolvedContent = await resolveWithOverrides(
        document.content || '',
        document.components,
        overrides
      );
    }

    res.json({
      preset_id: preset.id,
      preset_name: preset.name,
      base_document_id: document.id,
      base_document_title: document.title,
      content: resolvedContent,
      applied_overrides: Object.keys(overrides).length > 0 ? overrides : null
    });
  } catch (error) {
    console.error('Error in GET /presets/:presetId/context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/presets/:projectId/:presetId/pdf - Generate PDF from preset content (private, requires auth)
router.get('/:projectId/:presetId/pdf', async (req: RequestWithUser, res) => {
  let browser: Browser | null = null;
  
  try {
    const { projectId, presetId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    // Get the preset with document info - reuse the same logic as context endpoint
    const { data: preset, error: presetError } = await supabase
      .from('presets')
      .select('id, name, rules, project_id')
      .eq('id', presetId)
      .eq('project_id', projectId)
      .single();

    if (presetError || !preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const documentId = preset.rules?.document_id;
    if (!documentId) {
      return res.status(400).json({ error: 'Preset has no associated document' });
    }

    // Get the base document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, is_composite, components')
      .eq('id', documentId)
      .eq('project_id', preset.project_id)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Preset document not found' });
    }

    // Recursive function to resolve composite documents with overrides
    // (Same logic as context endpoint)
    const resolveWithOverrides = async (
      docContent: string, 
      docComponents: Record<string, string> = {},
      overrides: Record<string, string> = {},
      visited: Set<string> = new Set()
    ): Promise<string> => {
      let resolvedContent = docContent;
      
      // Find all component references in the content
      const componentRegex = /{{([^}]+)}}/g;
      const matches = [...docContent.matchAll(componentRegex)];
      
      for (const match of matches) {
        const componentKey = match[1];
        if (!componentKey) continue;
        
        // Check if this component has an override
        let targetDocId = overrides[componentKey] || docComponents[componentKey];
        
        if (!targetDocId) continue;
        
        // Prevent infinite recursion
        if (visited.has(targetDocId)) {
          console.warn(`Circular reference detected for document ${targetDocId}`);
          continue;
        }
        
        // Get the component document
        const { data: componentDoc, error: componentError } = await supabase
          .from('documents')
          .select('id, content, is_composite, components')
          .eq('id', targetDocId)
          .eq('project_id', preset.project_id)
          .single();
          
        if (componentError || !componentDoc) {
          console.warn(`Component document ${targetDocId} not found`);
          continue;
        }
        
        let componentContent = componentDoc.content || '';
        
        // If the component is also composite, recursively resolve it
        if (componentDoc.is_composite && componentDoc.components) {
          const newVisited = new Set(visited);
          newVisited.add(targetDocId);
          componentContent = await resolveWithOverrides(
            componentContent,
            componentDoc.components,
            overrides,
            newVisited
          );
        }
        
        // Replace the component reference with the resolved content
        resolvedContent = resolvedContent.replace(match[0], componentContent);
      }
      
      return resolvedContent;
    };

    // Apply overrides and resolve the document
    const overrides = preset.rules.component_overrides || {};
    let resolvedContent = document.content || '';
    
    if (document.is_composite && document.components) {
      resolvedContent = await resolveWithOverrides(
        document.content || '',
        document.components,
        overrides
      );
    }

    // Convert markdown to HTML
    const htmlContent = md.render(resolvedContent);
    
    // Create full HTML document with styling
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${preset.name} - ${document.title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 24px;
            margin-bottom: 16px;
          }
          h1 { font-size: 2.2em; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          h2 { font-size: 1.8em; border-bottom: 1px solid #ecf0f1; padding-bottom: 8px; }
          h3 { font-size: 1.4em; }
          p { margin-bottom: 16px; }
          blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 20px 0;
            font-style: italic;
            background: #f8f9fa;
            padding: 15px 20px;
          }
          pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
          }
          code {
            background: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
          }
          ul, ol { margin-bottom: 16px; }
          li { margin-bottom: 8px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .header {
            text-align: center;
            border-bottom: 1px solid #eee;
            margin-bottom: 30px;
            padding-bottom: 20px;
          }
          .metadata {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 30px;
          }
          @page {
            margin: 1in;
            size: A4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${preset.name}</h1>
        </div>
        ${htmlContent}
      </body>
      </html>
    `;

    // Launch puppeteer and generate PDF
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();
    browser = null;

    // Set appropriate headers for PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${preset.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the buffer directly without JSON serialization
    res.end(pdfBuffer, 'binary');

  } catch (error) {
    console.error('Error in GET /presets/:presetId/pdf:', error);
    
    // Make sure to close browser if it was opened
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;