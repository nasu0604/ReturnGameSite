import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />  {/* BrowserRouter는 App.js에 이미 추가됐으므로 index.js에서 제거 */}
  </React.StrictMode>
);
