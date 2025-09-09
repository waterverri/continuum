import { supabaseAdmin } from '../db/supabaseClient';
import { resolveDocumentWithOverrides } from './documentResolutionService';

interface Document {
  id: string;
  project_id: string;
  title: string;
  document_type?: string;
  content?: string;
  is_composite: boolean;
  components?: Record<string, string>;
  group_id?: string;
  interaction_mode?: 'document' | 'chat' | 'canvas';
}

interface ContextOptions {
  includeRelated?: boolean;
  includeEventContext?: boolean;
  maxContextSize?: number; // in tokens (approximate)
  preferredTypes?: string[];
}

export class ContextAssemblyService {
  private readonly MAX_CONTEXT_TOKENS = 100000; // Conservative limit for context size

  /**
   * Assembles context for AI requests by intelligently gathering related documents
   */
  async assembleContext(
    projectId: string,
    primaryDocumentId: string,
    additionalDocumentIds: string[] = [],
    options: ContextOptions = {}
  ): Promise<{
    context: string;
    documentsUsed: string[];
    tokenCount: number;
  }> {
    const {
      includeRelated = true,
      includeEventContext = false,
      maxContextSize = this.MAX_CONTEXT_TOKENS,
      preferredTypes = []
    } = options;

    try {
      // Get primary document
      const primaryDoc = await this.getDocument(projectId, primaryDocumentId);
      if (!primaryDoc) {
        throw new Error('Primary document not found');
      }

      let assembledContext = '';
      const documentsUsed: string[] = [primaryDocumentId];
      let currentTokenCount = 0;

      // Start with primary document
      const primaryContent = await this.resolveDocumentContent(projectId, primaryDoc);
      const primarySection = this.formatDocumentForContext(primaryDoc, primaryContent);
      assembledContext += primarySection;
      currentTokenCount += this.estimateTokens(primarySection);

      // Add explicitly requested additional documents
      for (const docId of additionalDocumentIds) {
        if (currentTokenCount >= maxContextSize) break;
        
        const doc = await this.getDocument(projectId, docId);
        if (doc) {
          const content = await this.resolveDocumentContent(projectId, doc);
          const section = this.formatDocumentForContext(doc, content, 'Additional Context');
          
          const sectionTokens = this.estimateTokens(section);
          if (currentTokenCount + sectionTokens <= maxContextSize) {
            assembledContext += '\n\n' + section;
            currentTokenCount += sectionTokens;
            documentsUsed.push(docId);
          }
        }
      }

      // Intelligently gather related documents
      if (includeRelated && currentTokenCount < maxContextSize) {
        const relatedDocs = await this.findRelatedDocuments(projectId, primaryDoc, {
          excludeIds: documentsUsed,
          preferredTypes,
          limit: 5
        });

        for (const doc of relatedDocs) {
          if (currentTokenCount >= maxContextSize) break;

          const content = await this.resolveDocumentContent(projectId, doc);
          const section = this.formatDocumentForContext(doc, content, 'Related Context');
          
          const sectionTokens = this.estimateTokens(section);
          if (currentTokenCount + sectionTokens <= maxContextSize) {
            assembledContext += '\n\n' + section;
            currentTokenCount += sectionTokens;
            documentsUsed.push(doc.id);
          }
        }
      }

      // Add event context if requested
      if (includeEventContext && currentTokenCount < maxContextSize) {
        const eventContext = await this.getEventContext(projectId, primaryDocumentId);
        if (eventContext) {
          const eventTokens = this.estimateTokens(eventContext);
          if (currentTokenCount + eventTokens <= maxContextSize) {
            assembledContext += '\n\n' + eventContext;
            currentTokenCount += eventTokens;
          }
        }
      }

      return {
        context: assembledContext,
        documentsUsed,
        tokenCount: currentTokenCount
      };

    } catch (error) {
      console.error('Error assembling context:', error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  private async getDocument(projectId: string, documentId: string): Promise<Document | null> {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      return null;
    }

    return data;
  }

  /**
   * Resolve document content (handles composite documents)
   */
  private async resolveDocumentContent(projectId: string, document: Document): Promise<string> {
    if (!document.is_composite) {
      return document.content || '';
    }

    try {
      // Use existing document resolution service for composite documents
      return await resolveDocumentWithOverrides(
        supabaseAdmin,
        projectId,
        document.content || '',
        document.components || {},
        {}, // no overrides for context assembly
        document.id
      );
    } catch (error) {
      console.error('Error resolving composite document:', error);
      return document.content || '';
    }
  }

  /**
   * Find related documents based on various criteria
   */
  private async findRelatedDocuments(
    projectId: string,
    primaryDoc: Document,
    options: {
      excludeIds: string[];
      preferredTypes: string[];
      limit: number;
    }
  ): Promise<Document[]> {
    const related: Document[] = [];

    try {
      // 1. Documents in the same group
      if (primaryDoc.group_id) {
        const { data: groupDocs } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .eq('group_id', primaryDoc.group_id)
          .not('id', 'in', `(${options.excludeIds.join(',')})`);

        if (groupDocs) {
          related.push(...groupDocs);
        }
      }

      // 2. Documents of preferred types
      if (options.preferredTypes.length > 0) {
        const { data: typedDocs } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .in('document_type', options.preferredTypes)
          .not('id', 'in', `(${options.excludeIds.join(',')})`);

        if (typedDocs) {
          // Add documents not already in related
          const existingIds = new Set(related.map(d => d.id));
          related.push(...typedDocs.filter(d => !existingIds.has(d.id)));
        }
      }

      // 3. Documents referenced in composite components
      const referencedDocs = await this.findReferencedDocuments(projectId, primaryDoc);
      const existingIds = new Set(related.map(d => d.id));
      related.push(...referencedDocs.filter(d => !existingIds.has(d.id) && !options.excludeIds.includes(d.id)));

      // Sort by relevance (group members first, then preferred types, then others)
      related.sort((a, b) => {
        if (a.group_id === primaryDoc.group_id && b.group_id !== primaryDoc.group_id) return -1;
        if (a.group_id !== primaryDoc.group_id && b.group_id === primaryDoc.group_id) return 1;
        
        const aPreferred = options.preferredTypes.includes(a.document_type || '');
        const bPreferred = options.preferredTypes.includes(b.document_type || '');
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        
        return 0;
      });

      return related.slice(0, options.limit);

    } catch (error) {
      console.error('Error finding related documents:', error);
      return [];
    }
  }

  /**
   * Find documents referenced in composite document components
   */
  private async findReferencedDocuments(projectId: string, document: Document): Promise<Document[]> {
    if (!document.is_composite || !document.components) {
      return [];
    }

    const referencedIds = Object.values(document.components);
    if (referencedIds.length === 0) return [];

    try {
      const { data } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .in('id', referencedIds);

      return data || [];
    } catch (error) {
      console.error('Error finding referenced documents:', error);
      return [];
    }
  }

  /**
   * Get event context for a document
   */
  private async getEventContext(projectId: string, documentId: string): Promise<string | null> {
    try {
      // Get events associated with this document
      const { data: eventDocs } = await supabaseAdmin
        .from('event_documents')
        .select(`
          events (
            id,
            name,
            description,
            time_start,
            time_end
          )
        `)
        .eq('document_id', documentId);

      if (!eventDocs || eventDocs.length === 0) return null;

      let context = '=== Event Context ===\n';
      for (const eventDoc of eventDocs) {
        const event = (eventDoc as any).events;
        if (event) {
          context += `Event: ${event.name}\n`;
          if (event.description) {
            context += `Description: ${event.description}\n`;
          }
          if (event.time_start || event.time_end) {
            context += `Timeline: ${event.time_start || '?'} - ${event.time_end || '?'}\n`;
          }
          context += '\n';
        }
      }

      return context;
    } catch (error) {
      console.error('Error getting event context:', error);
      return null;
    }
  }

  /**
   * Format a document for context inclusion
   */
  private formatDocumentForContext(
    document: Document, 
    content: string, 
    contextType: string = 'Primary Document'
  ): string {
    let formatted = `=== ${contextType}: ${document.title} ===\n`;
    
    if (document.document_type) {
      formatted += `Type: ${document.document_type}\n`;
    }
    
    if (document.interaction_mode === 'chat') {
      formatted += 'Mode: AI Chat Document\n';
      // For chat documents, try to extract useful information
      try {
        const chatData = JSON.parse(content);
        if (chatData.conversation_summary) {
          formatted += `Summary: ${chatData.conversation_summary}\n`;
        }
        if (chatData.messages && chatData.messages.length > 0) {
          formatted += `Recent Messages: ${Math.min(3, chatData.messages.length)} messages\n`;
          // Include last few messages for context
          const recentMessages = chatData.messages.slice(-3);
          formatted += 'Recent Context:\n';
          recentMessages.forEach((msg: any) => {
            formatted += `${msg.role}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
          });
        }
      } catch {
        formatted += content.substring(0, 1000) + (content.length > 1000 ? '...' : '');
      }
    } else {
      formatted += `Content:\n${content}`;
    }
    
    return formatted;
  }

  /**
   * Estimate token count for a string (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

export const contextAssemblyService = new ContextAssemblyService();