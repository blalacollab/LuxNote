import ReactDOMLegacy from 'react-dom';
import ReactDOMClient, { type Root } from 'react-dom/client';

import { App } from './app/App';
import '../vendor/outline-editor/dist/outline-editor.css';
import './lib/outlineI18n';
import './styles/globals.css';
import './styles/outlineEditor.css';

const legacyRoots = new WeakMap<Element | DocumentFragment, Root>();
const legacyApi = ReactDOMLegacy as any;

if (typeof legacyApi.render === 'function') {
  legacyApi.render = (
    element: unknown,
    container: Element | DocumentFragment,
    callback?: () => void,
  ) => {
    let root = legacyRoots.get(container);

    if (!root) {
      root = ReactDOMClient.createRoot(container);
      legacyRoots.set(container, root);
    }

    root.render(element as any);
    callback?.();
    return null;
  };
}

if (typeof legacyApi.unmountComponentAtNode === 'function') {
  legacyApi.unmountComponentAtNode = (
    container: Element | DocumentFragment,
  ) => {
    const root = legacyRoots.get(container);

    if (!root) {
      return false;
    }

    root.unmount();
    legacyRoots.delete(container);
    return true;
  };
}

ReactDOMClient.createRoot(document.getElementById('root')!).render(
  <App />,
);
