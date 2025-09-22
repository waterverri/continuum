import { useState, useCallback, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import TurndownService from 'turndown';
import { marked } from 'marked';

interface ReactQuillEditorProps {
  initialValue: string;
  onContentChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}

export function ReactQuillEditor({
  initialValue,
  onContentChange,
  placeholder = "Enter your content...",
  className = "",
  height = "75vh"
}: ReactQuillEditorProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const quillRef = useRef<ReactQuill>(null);
  const turndownService = useRef(new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  }));

  // Convert markdown to HTML for initial display
  useEffect(() => {
    const convertMarkdownToHtml = async () => {
      try {
        const html = await marked(initialValue || '');
        setHtmlContent(html);
      } catch (error) {
        console.error('Error converting markdown to HTML:', error);
        setHtmlContent(initialValue || '');
      }
    };
    convertMarkdownToHtml();
  }, [initialValue]);

  const convertHtmlToMarkdown = useCallback((html: string) => {
    try {
      return turndownService.current.turndown(html);
    } catch (error) {
      console.error('Error converting HTML to markdown:', error);
      return html;
    }
  }, []);

  const handleChange = useCallback((content: string) => {
    setHtmlContent(content);
    const markdown = convertHtmlToMarkdown(content);
    onContentChange(markdown);
  }, [onContentChange, convertHtmlToMarkdown]);

  // Custom toolbar with rich text formatting options
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background',
    'align', 'script', 'code-block', 'direction'
  ];

  return (
    <div className={`react-quill-editor ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={htmlContent}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ height }}
      />

      {/* Help text for component references */}
      <small className="form-help" style={{ marginTop: '1rem', display: 'block' }}>
        <strong>WYSIWYG Mode:</strong> Use the toolbar above for rich text formatting.
        To add document references, you can type <code>{`{{`}</code> followed by document names or use the Monaco editor mode.
      </small>
    </div>
  );
}

export type { ReactQuillEditorProps };