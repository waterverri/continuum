import { ContextAssemblyService } from '../../src/services/contextAssemblyService';

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;

  beforeEach(() => {
    service = new ContextAssemblyService();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test string';
      const result = (service as any).estimateTokens(text);

      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty string', () => {
      const result = (service as any).estimateTokens('');
      expect(result).toBe(0);
    });

    it('should handle long text', () => {
      const longText = 'x'.repeat(1000);
      const result = (service as any).estimateTokens(longText);

      expect(result).toBe(250); // 1000 / 4
    });
  });

  describe('formatDocumentForContext', () => {
    const mockDocument = {
      id: 'doc1',
      project_id: 'proj1',
      title: 'Test Document',
      document_type: 'prompt',
      content: 'Test content',
      is_composite: false,
      components: {},
      group_id: 'group1'
    };

    it('should format regular document correctly', () => {
      const result = (service as any).formatDocumentForContext(mockDocument, 'Test content');

      expect(result).toContain('=== Primary Document: Test Document ===');
      expect(result).toContain('Type: prompt');
      expect(result).toContain('Content:\nTest content');
    });

    it('should format chat document correctly', () => {
      const chatDoc = { ...mockDocument, interaction_mode: 'chat' };
      const chatContent = JSON.stringify({
        conversation_summary: 'Discussion about AI',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      });

      const result = (service as any).formatDocumentForContext(chatDoc, chatContent);

      expect(result).toContain('Mode: AI Chat Document');
      expect(result).toContain('Summary: Discussion about AI');
      expect(result).toContain('Recent Messages: 2 messages');
      expect(result).toContain('user: Hello');
      expect(result).toContain('assistant: Hi there!');
    });

    it('should handle invalid chat JSON gracefully', () => {
      const chatDoc = { ...mockDocument, interaction_mode: 'chat' };
      const invalidContent = 'invalid json';

      const result = (service as any).formatDocumentForContext(chatDoc, invalidContent);

      expect(result).toContain('Mode: AI Chat Document');
      expect(result).toContain('invalid json');
    });

    it('should truncate long content in chat mode', () => {
      const longContent = 'x'.repeat(2000);
      const chatDoc = { ...mockDocument, interaction_mode: 'chat' };

      const result = (service as any).formatDocumentForContext(chatDoc, longContent);

      expect(result).toContain('xxx'); // First part
      expect(result).toContain('...');   // Truncation indicator
      expect(result.length).toBeLessThan(longContent.length + 200);
    });

    it('should handle document without type', () => {
      const docWithoutType = { ...mockDocument, document_type: undefined };

      const result = (service as any).formatDocumentForContext(docWithoutType, 'content');

      expect(result).not.toContain('Type:');
      expect(result).toContain('Content:\ncontent');
    });

    it('should use custom context type', () => {
      const result = (service as any).formatDocumentForContext(mockDocument, 'content', 'Related Document');

      expect(result).toContain('=== Related Document: Test Document ===');
    });
  });

  describe('MAX_CONTEXT_TOKENS constant', () => {
    it('should have correct default value', () => {
      expect((service as any).MAX_CONTEXT_TOKENS).toBe(100000);
    });
  });

  describe('error handling', () => {
    it('should handle empty document title', () => {
      const docWithoutTitle = {
        id: 'doc1',
        project_id: 'proj1',
        title: '',
        is_composite: false
      };

      const result = (service as any).formatDocumentForContext(docWithoutTitle, 'content');

      expect(result).toContain('=== Primary Document:  ==='); // Empty title
      expect(result).toContain('Content:\ncontent');
    });

    it('should handle null content', () => {
      const mockDocument = {
        id: 'doc1',
        project_id: 'proj1',
        title: 'Test',
        is_composite: false
      };

      const result = (service as any).formatDocumentForContext(mockDocument, null);

      expect(result).toContain('Test');
      expect(result).toContain('Content:\nnull');
    });
  });
});