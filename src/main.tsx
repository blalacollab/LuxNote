import ReactDOMClient from 'react-dom/client';

import { App } from './app/App';
import './lib/outlineI18n';
import './styles/globals.css';
import './styles/outlineEditor.css';

ReactDOMClient.createRoot(document.getElementById('root')!).render(
  <App />,
);
