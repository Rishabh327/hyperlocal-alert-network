import React, { useState } from 'react';

export default function ConsentScreen({ onAccept }) {
  const [checked, setChecked] = useState(false);

  const handleAccept = () => {
    if (!checked) return;
    localStorage.setItem('alertnet_consent', 'true');
    localStorage.setItem('alertnet_consent_date', new Date().toISOString());
    if (onAccept) onAccept();
  };

  const sections = [
    {
      icon: '📍',
      title: 'Location Data',
      desc: 'We collect your GPS location to show you nearby alerts and to tag alerts you report with their location. Your location is never sold or shared with third parties.'
    },
    {
      icon: '🔔',
      title: 'Notifications',
      desc: 'We will send you push notifications when emergency alerts are reported near you. You can disable these at any time.'
    },
    {
      icon: '📸',
      title: 'Photos',
      desc: 'Photos you attach to alerts are stored on our servers to help verify emergencies. Do not include personal information in photos.'
    },
    {
      icon: '⚖️',
      title: 'Legal Notice',
      desc: 'By using AlertNet you agree to report only genuine emergencies. False reports may result in account suspension and legal action under the Disaster Management Act 2005.'
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 14, 26, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        color: '#ffffff',
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}
    >
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(233, 69, 96, 0.2)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚨 AlertNet</div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800' }}>Before You Continue</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#b2bec3' }}>
            Please read and accept our data usage policy
          </p>
        </div>

        {/* Content - scrollable list of policy points */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {sections.map((sec, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '24px', padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                {sec.icon}
              </span>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#e94560' }}>
                  {sec.title}
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#b2bec3', lineHeight: '1.5' }}>
                  {sec.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 24px 24px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Checkbox */}
          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#2ecc71',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: '500' }}>
              I have read and agree to the above
            </span>
          </label>

          {/* Button */}
          <button
            onClick={handleAccept}
            disabled={!checked}
            style={{
              width: '100%',
              background: checked ? '#2ecc71' : '#4a5568',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '8px',
              cursor: checked ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              textAlign: 'center',
              boxShadow: checked ? '0 4px 15px rgba(46, 204, 113, 0.3)' : 'none'
            }}
          >
            Accept & Continue
          </button>

          {/* Help link/Support */}
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#718096' }}>
            For support contact: <span style={{ color: '#e94560' }}>support@alertnet.in</span>
          </div>
        </div>
      </div>
    </div>
  );
}
