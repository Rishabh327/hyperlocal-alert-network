import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => {
        const dismissed = localStorage.getItem('alertnet_install_dismissed');
        if (!dismissed) {
          setShowInstall(true);
        }
      }, 30000); // Renders after 30 seconds
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstall(false);
    localStorage.setItem('alertnet_install_dismissed', 'true');
  };

  if (!showInstall) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '20px',
        right: '20px',
        zIndex: 9999,
        background: '#1a1a2e',
        color: '#ffffff',
        border: '2px solid #e74c3c',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}
    >
      <div style={{ fontSize: '13px', lineHeight: '1.5', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📲</span>
        <span>Install AlertNet on your home screen for faster access to emergency alerts</span>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleInstallClick}
          style={{
            flex: 1,
            background: '#2ecc71',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'background 0.2s',
            textAlign: 'center'
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#27ae60')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#2ecc71')}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            background: '#4a5568',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'background 0.2s',
            textAlign: 'center'
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#2d3748')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#4a5568')}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
