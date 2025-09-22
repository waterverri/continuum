import { useCallback, useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

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
  const [htmlContent, setHtmlContent] = useState<string>(initialValue);
  const quillRef = useRef<ReactQuill>(null);

  // Update content when initialValue changes (from parent)
  useEffect(() => {
    setHtmlContent(initialValue || '');
  }, [initialValue]);

  const handleChange = useCallback((content: string) => {
    setHtmlContent(content);
    onContentChange(content);
  }, [onContentChange]);

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