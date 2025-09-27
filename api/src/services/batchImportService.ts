import JSZip from 'jszip';
import csvParser from 'csv-parser';
import { createUserSupabaseClient } from '../db/supabaseClient';
import { Readable } from 'stream';

export interface ManifestRow {
  filename: string;
  title: string;
  alias?: string;
  group_name?: string;
  tags?: string;
  document_type?: string;
  group_head?: string;
  event_name?: string;
}

export interface ValidationError {
  type: 'validation' | 'file_missing' | 'constraint' | 'database';
  row?: number;
  filename?: string;
  field?: string;
  message: string;
  group_name?: string;
}

export interface BatchImportResult {
  success: boolean;
  errors: ValidationError[];
  warnings: string[];
  created?: {
    documents: number;
    groups: number;
    tags: number;
    events: number;
  };
}

export class BatchImportService {
  private userToken: string;
  private projectId: string;

  constructor(userToken: string, projectId: string) {
    this.userToken = userToken;
    this.projectId = projectId;
  }

  /**
   * Find a file in ZIP, handling nested directory structures
   */
  private findFileInZip(zip: JSZip, filename: string): JSZip.JSZipObject | null {
    // Try direct lookup first
    let file = zip.file(filename);
    if (file) return file;

    // Try case-insensitive and nested directory search
    const allFiles = Object.keys(zip.files);
    const foundPath = allFiles.find(path => {
      const pathLower = path.toLowerCase();
      const filenameLower = filename.toLowerCase();

      // Exact match (case insensitive)
      if (pathLower === filenameLower) return true;

      // Match filename at end of path (handles nested directories)
      if (pathLower.endsWith('/' + filenameLower)) return true;

      return false;
    });

    return foundPath ? zip.files[foundPath] : null;
  }

  async validateZipFile(zipBuffer: Buffer): Promise<BatchImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Parse zip file
      const zip = await JSZip.loadAsync(zipBuffer);

      // List all files in the ZIP
      const allFiles = Object.keys(zip.files);

      // Show details of each file
      allFiles.forEach(filename => {
        const file = zip.files[filename];
      });

      // Find manifest.csv (case insensitive search, including nested directories)
      const manifestFile = this.findFileInZip(zip, 'manifest.csv');
      if (manifestFile) {
      }


      if (!manifestFile) {
        return {
          success: false,
          errors: [{
            type: 'validation',
            message: `manifest.csv not found in zip file. Found files: ${allFiles.join(', ')}`
          }],
          warnings: []
        };
      }

      // Parse manifest CSV
      const manifestContent = await manifestFile.async('string');
      const manifestRows = await this.parseManifest(manifestContent);

      if (manifestRows.length === 0) {
        return {
          success: false,
          errors: [{ type: 'validation', message: 'manifest.csv is empty or invalid' }],
          warnings: []
        };
      }

      // Validate manifest structure and referenced files (VALIDATION ONLY)
      const validationResult = await this.validateManifest(manifestRows, zip);

      return {
        success: validationResult.errors.length === 0,
        errors: validationResult.errors,
        warnings: [...warnings, ...validationResult.warnings]
      };

    } catch (error) {
      console.error('Error validating zip file:', error);
      return {
        success: false,
        errors: [{
          type: 'validation',
          message: `Failed to validate zip file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings: []
      };
    }
  }

  async processZipFile(zipBuffer: Buffer): Promise<BatchImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Parse zip file
      const zip = await JSZip.loadAsync(zipBuffer);

      // List all files in the ZIP
      const allFiles = Object.keys(zip.files);

      // Show details of each file
      allFiles.forEach(filename => {
        const file = zip.files[filename];
      });

      // Find manifest.csv (case insensitive search, including nested directories)
      const manifestFile = this.findFileInZip(zip, 'manifest.csv');
      if (manifestFile) {
      }


      if (!manifestFile) {
        return {
          success: false,
          errors: [{
            type: 'validation',
            message: `manifest.csv not found in zip file. Found files: ${allFiles.join(', ')}`
          }],
          warnings: []
        };
      }

      // Parse manifest CSV
      const manifestContent = await manifestFile.async('string');
      const manifestRows = await this.parseManifest(manifestContent);

      if (manifestRows.length === 0) {
        return {
          success: false,
          errors: [{ type: 'validation', message: 'manifest.csv is empty or invalid' }],
          warnings: []
        };
      }

      // Validate manifest structure and referenced files
      const validationResult = await this.validateManifest(manifestRows, zip);
      if (validationResult.errors.length > 0) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // Process import in transaction
      const importResult = await this.executeImport(manifestRows, zip);

      return {
        success: importResult.success,
        errors: importResult.errors,
        warnings: [...warnings, ...validationResult.warnings, ...(importResult.warnings || [])],
        created: importResult.created
      };

    } catch (error) {
      console.error('Error processing zip file:', error);
      return {
        success: false,
        errors: [{
          type: 'validation',
          message: `Failed to process zip file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings: []
      };
    }
  }

  /**
   * Get column value from row, handling case variations and missing columns
   */
  private getColumnValue(row: any, columnName: string): string | undefined {
    // Try exact match first
    if (row[columnName] !== undefined) {
      return row[columnName];
    }

    // Try case-insensitive match
    const rowKeys = Object.keys(row);
    const matchingKey = rowKeys.find(key => key.toLowerCase() === columnName.toLowerCase());

    return matchingKey ? row[matchingKey] : undefined;
  }

  /**
   * Detect CSV delimiter by finding any two known column names
   */
  private detectCsvDelimiter(csvContent: string): string {
    const firstLine = csvContent.split('\n')[0] || '';
    const knownColumns = ['filename', 'title', 'alias', 'group_name', 'tags', 'document_type', 'group_head', 'event_name'];

    let delimiter = ','; // default

    // Find positions of all known columns in the header
    const columnPositions = knownColumns
      .map(col => ({
        name: col,
        index: firstLine.toLowerCase().indexOf(col.toLowerCase())
      }))
      .filter(col => col.index !== -1)
      .sort((a, b) => a.index - b.index); // Sort by position


    // If we have at least 2 columns, detect delimiter between first two
    if (columnPositions.length >= 2) {
      const firstCol = columnPositions[0];
      const secondCol = columnPositions[1];

      const startPos = firstCol.index + firstCol.name.length;
      const endPos = secondCol.index;
      const betweenText = firstLine.slice(startPos, endPos);

      // Find the delimiter (first non-word, non-space character)
      const match = betweenText.match(/[^\w\s]/);
      if (match) {
        delimiter = match[0];
      }

    }

    return delimiter;
  }

  private async parseManifest(csvContent: string): Promise<ManifestRow[]> {
    return new Promise((resolve, reject) => {
      const rows: ManifestRow[] = [];
      const stream = Readable.from([csvContent]);

      // Detect delimiter dynamically
      const delimiter = this.detectCsvDelimiter(csvContent);

      stream
        .pipe(csvParser({ separator: delimiter }))
        .on('data', (row) => {
          // Normalize the row - trim whitespace and handle empty values
          // Support flexible column names and missing optional columns
          const normalizedRow: ManifestRow = {
            // Required fields
            filename: String(this.getColumnValue(row, 'filename') || '').trim(),
            title: String(this.getColumnValue(row, 'title') || '').trim(),

            // Optional fields - only include if present
            alias: this.getColumnValue(row, 'alias') ? String(this.getColumnValue(row, 'alias')).trim() : undefined,
            group_name: this.getColumnValue(row, 'group_name') ? String(this.getColumnValue(row, 'group_name')).trim() : undefined,
            tags: this.getColumnValue(row, 'tags') ? String(this.getColumnValue(row, 'tags')).trim() : undefined,
            document_type: this.getColumnValue(row, 'document_type') ? String(this.getColumnValue(row, 'document_type')).trim() : undefined,
            group_head: this.getColumnValue(row, 'group_head') ? String(this.getColumnValue(row, 'group_head')).trim().toLowerCase() : undefined,
            event_name: this.getColumnValue(row, 'event_name') ? String(this.getColumnValue(row, 'event_name')).trim() : undefined,
          };

          rows.push(normalizedRow);
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  private async validateManifest(rows: ManifestRow[], zip: JSZip): Promise<{ errors: ValidationError[], warnings: string[] }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const groupHeadCounts = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.filename) {
        errors.push({
          type: 'validation',
          row: rowNum,
          field: 'filename',
          message: 'filename is required'
        });
        continue;
      }

      if (!row.title) {
        errors.push({
          type: 'validation',
          row: rowNum,
          filename: row.filename,
          field: 'title',
          message: 'title is required'
        });
        continue;
      }

      // Check if referenced file exists in zip
      const mdFile = this.findFileInZip(zip, row.filename);
      if (!mdFile) {
        errors.push({
          type: 'file_missing',
          row: rowNum,
          filename: row.filename,
          message: `Referenced file '${row.filename}' not found in zip`
        });
        continue;
      }

      // Validate group_head format
      if (row.group_head && !['true', 'false'].includes(row.group_head)) {
        errors.push({
          type: 'validation',
          row: rowNum,
          filename: row.filename,
          field: 'group_head',
          message: 'group_head must be "true" or "false"'
        });
      }

      // Count group heads per group
      if (row.group_name && row.group_head === 'true') {
        const count = groupHeadCounts.get(row.group_name) || 0;
        groupHeadCounts.set(row.group_name, count + 1);
      }
    }

    // Validate group head constraints
    for (const [groupName, count] of groupHeadCounts.entries()) {
      if (count > 1) {
        const affectedRows = rows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.group_name === groupName && row.group_head === 'true')
          .map(({ index }) => index + 1);

        errors.push({
          type: 'constraint',
          group_name: groupName,
          message: `Multiple documents marked as group_head=true for group '${groupName}' (rows: ${affectedRows.join(', ')}). Only one group head is allowed per group.`
        });
      }
    }

    // Check for groups without group heads
    const groupsWithoutHeads = new Set<string>();
    for (const row of rows) {
      if (row.group_name && row.group_head !== 'true') {
        if (!groupHeadCounts.has(row.group_name)) {
          groupsWithoutHeads.add(row.group_name);
        }
      }
    }

    for (const groupName of groupsWithoutHeads) {
      warnings.push(`Group '${groupName}' has no group_head=true document. First document will be used as group head.`);
    }

    return { errors, warnings };
  }

  private async executeImport(rows: ManifestRow[], zip: JSZip): Promise<BatchImportResult> {
    const userSupabase = createUserSupabaseClient(this.userToken);

    try {
      // Start transaction-like operation
      const createdGroups = new Map<string, string>(); // group_name -> group_head_document_id
      const createdTags = new Map<string, string>(); // tag_name -> tag_id
      const createdEvents = new Map<string, string>(); // event_name -> event_id
      const createdDocuments: string[] = [];

      // Process documents in order, handling group heads first
      const sortedRows = this.sortRowsForProcessing(rows);

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];

        try {
          const documentId = await this.createDocument(row, zip, createdGroups, userSupabase);
          createdDocuments.push(documentId);

          // Handle tags
          if (row.tags) {
            await this.processDocumentTags(documentId, row.tags, createdTags, userSupabase);
          }

          // Handle events
          if (row.event_name) {
            await this.processDocumentEvent(documentId, row.event_name, createdEvents, userSupabase);
          }

        } catch (error) {
          // If any document creation fails, we need to rollback
          // For now, return the error - in a real transaction this would rollback
          console.error(`Error creating document ${row.filename}:`, error);

          return {
            success: false,
            errors: [{
              type: 'database',
              filename: row.filename,
              message: `Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            warnings: []
          };
        }
      }

      return {
        success: true,
        errors: [],
        warnings: [],
        created: {
          documents: createdDocuments.length,
          groups: createdGroups.size,
          tags: createdTags.size,
          events: createdEvents.size
        }
      };

    } catch (error) {
      console.error('Error during batch import:', error);
      return {
        success: false,
        errors: [{
          type: 'database',
          message: `Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings: []
      };
    }
  }

  private sortRowsForProcessing(rows: ManifestRow[]): ManifestRow[] {
    // Sort so that group heads come before other documents in the same group
    return [...rows].sort((a, b) => {
      // If both are in same group, prioritize group head
      if (a.group_name && b.group_name && a.group_name === b.group_name) {
        if (a.group_head === 'true' && b.group_head !== 'true') return -1;
        if (b.group_head === 'true' && a.group_head !== 'true') return 1;
      }
      return 0; // Maintain original order otherwise
    });
  }

  private async createDocument(
    row: ManifestRow,
    zip: JSZip,
    createdGroups: Map<string, string>,
    userSupabase: any
  ): Promise<string> {
    // Get file content
    const mdFile = this.findFileInZip(zip, row.filename)!;
    const content = await mdFile.async('string');

    // Determine group_id
    let groupId: string | undefined;
    if (row.group_name) {
      if (row.group_head === 'true') {
        // This will be set after document creation
        groupId = undefined;
      } else {
        // Use existing group head ID
        groupId = createdGroups.get(row.group_name!);
        if (!groupId) {
          throw new Error(`Group '${row.group_name}' head document not found. Process group heads first.`);
        }
      }
    }

    // Create document
    const { data: document, error } = await userSupabase
      .from('documents')
      .insert({
        project_id: this.projectId,
        title: row.title,
        alias: row.alias || null,
        content,
        document_type: row.document_type || null,
        group_id: groupId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // If this is a group head, update its group_id to point to itself and store mapping
    if (row.group_name && row.group_head === 'true') {
      const { error: updateError } = await userSupabase
        .from('documents')
        .update({ group_id: document.id })
        .eq('id', document.id);

      if (updateError) {
        throw new Error(`Failed to set group head: ${updateError.message}`);
      }

      createdGroups.set(row.group_name!, document.id);
    }

    return document.id;
  }

  private async processDocumentTags(
    documentId: string,
    tagsString: string,
    createdTags: Map<string, string>,
    userSupabase: any
  ): Promise<void> {
    const tagNames = tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);

    for (const tagName of tagNames) {
      let tagId = createdTags.get(tagName);

      if (!tagId) {
        // Try to find existing tag
        const { data: existingTag } = await userSupabase
          .from('tags')
          .select('id')
          .eq('project_id', this.projectId)
          .eq('name', tagName)
          .single();

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          // Create new tag
          const { data: newTag, error } = await userSupabase
            .from('tags')
            .insert({
              project_id: this.projectId,
              name: tagName,
              color: '#6366f1' // Default color
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to create tag '${tagName}': ${error.message}`);
          }

          tagId = newTag.id;
        }

        createdTags.set(tagName, tagId!);
      }

      // Create document-tag association
      const { error: linkError } = await userSupabase
        .from('document_tags')
        .insert({
          document_id: documentId,
          tag_id: tagId
        });

      if (linkError && !linkError.message.includes('duplicate')) {
        throw new Error(`Failed to link tag '${tagName}': ${linkError.message}`);
      }
    }
  }

  private async processDocumentEvent(
    documentId: string,
    eventName: string,
    createdEvents: Map<string, string>,
    userSupabase: any
  ): Promise<void> {
    let eventId = createdEvents.get(eventName);

    if (!eventId) {
      // Try to find existing event
      const { data: existingEvent } = await userSupabase
        .from('events')
        .select('id')
        .eq('project_id', this.projectId)
        .eq('name', eventName)
        .single();

      if (existingEvent) {
        eventId = existingEvent.id;
      } else {
        // Create new event
        const { data: newEvent, error } = await userSupabase
          .from('events')
          .insert({
            project_id: this.projectId,
            name: eventName
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create event '${eventName}': ${error.message}`);
        }

        eventId = newEvent.id;
      }

      createdEvents.set(eventName, eventId!);
    }

    // Create document-event association
    const { error: linkError } = await userSupabase
      .from('event_documents')
      .insert({
        event_id: eventId,
        document_id: documentId
      });

    if (linkError && !linkError.message.includes('duplicate')) {
      throw new Error(`Failed to link event '${eventName}': ${linkError.message}`);
    }
  }
}