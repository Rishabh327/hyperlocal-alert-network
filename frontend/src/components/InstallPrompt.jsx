import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("alertnet_install_dismissed");
    
    if (!isInstalled && !dismissed) {
      setShowInstall(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
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

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '12px',
        right: '12px',
        zIndex: 2000,
        background: '#1a1a2e',
        color: '#ffffff',
        border: '2px solid #e74c3c',
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      <style>{`
        @keyframes pulseGlowInstall {
          0% { box-shadow: 0 0 5px rgba(231, 76, 60, 0.4); transform: scale(1); }
          50% { box-shadow: 0 0 15px rgba(231, 76, 60, 0.8); transform: scale(1.03); }
          100% { box-shadow: 0 0 5px rgba(231, 76, 60, 0.4); transform: scale(1); }
        }
        .pulse-install-btn {
          animation: pulseGlowInstall 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Row 1: Title and Close button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#ffffff' }}>📲 Install AlertNet</span>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a0aec0',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1
          }}
        >
          &times;
        </button>
      </div>

      {/* Row 2: Instructions */}
      <div style={{ fontSize: '13px', lineHeight: '1.4', color: '#cbd5e0' }}>
        {isAndroid ? (
          <div>
            Tap the <strong>&#8942;</strong> (three dots) menu in your browser &rarr; Select <strong>'Add to Home screen'</strong> &rarr; Tap <strong>Add</strong>
          </div>
        ) : isIOS ? (
          <div>
            Tap the Share button <strong>(&#9633;&#8593;)</strong> at the bottom &rarr; Select <strong>'Add to Home Screen'</strong> &rarr; Tap <strong>Add</strong>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>Install AlertNet on your desktop for real-time emergency notifications.</div>
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="pulse-install-btn"
                style={{
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}
              >
                <span>⚡</span> Install AlertNet &rarr;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row 3: Step Indicator */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e74c3c' }}></div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4a5568' }}></div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4a5568' }}></div>
        <span style={{ fontSize: '11px', color: '#718096', marginLeft: '4px' }}>Step 1 of 3</span>
      </div>
    </div>
  );
}
