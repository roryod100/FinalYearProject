import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

/*
  This is the main entry point for the React frontend.
  It finds the "root" element in index.html and renders
  the main App component into it.
*/

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  /*
    React.StrictMode is used during development to help
    highlight potential problems in the application.
    It does not affect the production build.
  */
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/*
  reportWebVitals can be used to measure performance
  metrics of the application. It is optional and mainly
  used for analytics or debugging performance.
*/
reportWebVitals();