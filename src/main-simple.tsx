import React from 'react'
import ReactDOM from 'react-dom/client'

const SimpleApp: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Simple React App Test</h1>
      <p>If you can see this, React is working correctly!</p>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>
) 