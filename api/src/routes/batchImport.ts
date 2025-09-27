import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { BatchImportService } from '../services/batchImportService';
import busboy from 'busboy';

const router = express.Router();


/**
 * POST /api/batch-import/:projectId/validate
 * Validate batch import without actually creating anything
 */
router.post('/:projectId/validate', async (req: RequestWithUser, res: Response) => {
  try {

    const { projectId } = req.params;
    const userToken = req.token!;

    if (req.body && Buffer.isBuffer(req.body)) {

      // Now parse the raw buffer with busboy
      const stream = require('stream');
      const readable = new stream.Readable();
      readable.push(req.body);
      readable.push(null);

      const { file: fileBuffer, filename } = await new Promise<{ file: Buffer | null, filename: string | null }>((resolve, reject) => {
        const bb = busboy({ headers: req.headers });
        let fileBuffer: Buffer | null = null;
        let filename: string | null = null;

        bb.on('file', (fieldname: string, file: any, info: any) => {
          if (fieldname === 'zipFile') {
            filename = info.filename || null;
            const chunks: Buffer[] = [];
            file.on('data', (chunk: Buffer) => chunks.push(chunk));
            file.on('end', () => {
              fileBuffer = Buffer.concat(chunks);
            });
          } else {
            file.resume();
          }
        });

        bb.on('finish', () => {
          resolve({ file: fileBuffer, filename });
        });

        bb.on('error', reject);

        readable.pipe(bb);
      });

      if (!fileBuffer) {
        return res.status(400).json({ error: 'No ZIP file found in upload' });
      }

      // Continue processing with the extracted file

      // Validate project access
      const { createUserSupabaseClient } = await import('../db/supabaseClient');
      const userSupabase = createUserSupabaseClient(userToken);

      const { data: project, error: projectError } = await userSupabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return res.status(404).json({
          error: 'Project not found or access denied'
        });
      }

      // Initialize batch import service
      const batchImportService = new BatchImportService(userToken, projectId);

      // Validate the zip file (no actual import)
      const result = await batchImportService.validateZipFile(fileBuffer);

      // Return validation results
      res.json({
        success: result.success,
        errors: result.errors,
        warnings: result.warnings,
        message: result.success ? 'Validation passed' : 'Validation failed'
      });

    } else {
      return res.status(400).json({ error: 'No multipart data received by Express' });
    }

  } catch (error) {
    console.error('Error in batch import validation:', error);

    // Handle file upload errors
    if (error instanceof Error && error.message.includes('ZIP files')) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error during validation'
    });
  }
});

/**
 * POST /api/batch-import/:projectId
 * Process batch import from zip file containing markdown files and manifest.csv
 */
router.post('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;

    if (req.body && Buffer.isBuffer(req.body)) {
      // Parse the raw buffer with busboy (same approach as validation endpoint)
      const stream = require('stream');
      const readable = new stream.Readable();
      readable.push(req.body);
      readable.push(null);

      const { file: fileBuffer, filename } = await new Promise<{ file: Buffer | null, filename: string | null }>((resolve, reject) => {
        const bb = busboy({ headers: req.headers });
        let fileBuffer: Buffer | null = null;
        let filename: string | null = null;

        bb.on('file', (fieldname: string, file: any, info: any) => {
          if (fieldname === 'zipFile') {
            filename = info.filename || null;
            const chunks: Buffer[] = [];
            file.on('data', (chunk: Buffer) => chunks.push(chunk));
            file.on('end', () => {
              fileBuffer = Buffer.concat(chunks);
            });
          } else {
            file.resume();
          }
        });

        bb.on('finish', () => {
          resolve({ file: fileBuffer, filename });
        });

        bb.on('error', reject);
        readable.pipe(bb);
      });

      if (!fileBuffer) {
        return res.status(400).json({ error: 'No ZIP file found in upload' });
      }

      // Validate project access by attempting to fetch project info
      // This ensures the user has access to the project via RLS
      const { createUserSupabaseClient } = await import('../db/supabaseClient');
    const userSupabase = createUserSupabaseClient(userToken);

    const { data: project, error: projectError } = await userSupabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        error: 'Project not found or access denied'
      });
    }

    // Initialize batch import service
    const batchImportService = new BatchImportService(userToken, projectId);

    // Process the zip file
    const result = await batchImportService.processZipFile(fileBuffer);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Batch import completed successfully',
        created: result.created,
        warnings: result.warnings
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Batch import failed',
        errors: result.errors,
        warnings: result.warnings
      });
    }

    } else {
      return res.status(400).json({ error: 'No multipart data received by Express' });
    }

  } catch (error) {
    console.error('Error in batch import endpoint:', error);

    // Handle file upload errors
    if (error instanceof Error && error.message.includes('ZIP files')) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error during batch import'
    });
  }
});

export default router;