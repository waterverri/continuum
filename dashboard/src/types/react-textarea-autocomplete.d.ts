declare module 'react-textarea-autocomplete' {
  import { Component, CSSProperties } from 'react';

  interface TriggerConfig {
    [key: string]: {
      dataProvider: (token: string) => any[] | Promise<any[]>;
      component: (props: { entity: any }) => JSX.Element;
      output: (item: any, trigger?: string) => string;
    };
  }

  interface ReactTextareaAutocompleteProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    trigger: TriggerConfig;
    rows?: number;
    placeholder?: string;
    className?: string;
    loadingComponent?: () => JSX.Element;
    containerStyle?: CSSProperties;
    listStyle?: CSSProperties;
    itemStyle?: CSSProperties;
    dropdownStyle?: CSSProperties;
    minChar?: number;
    scrollToItem?: boolean;
    textAreaComponent?: any;
    renderToBody?: boolean;
  }

  export default class ReactTextareaAutocomplete extends Component<ReactTextareaAutocompleteProps> {}
}