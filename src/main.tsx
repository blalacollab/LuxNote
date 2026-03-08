import ReactDOMClient from 'react-dom/client';

import { App } from './app/App';
import './styles/globals.css';

ReactDOMClient.createRoot(document.getElementById('root')!).render(
  <App />,
);
