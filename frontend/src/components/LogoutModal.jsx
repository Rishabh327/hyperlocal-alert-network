import React from 'react';

const LogoutModal = ({ onConfirm, onCancel }) => {
  return (
    <div
      className="logout-modal-overlay"
      onClick={(e) => {
        if (e.target.classList.contains('logout-modal-overlay')) {
          onCancel();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          background: '#16213e',
          border: '1px solid rgba(233, 69, 96, 0.35)',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
          color: '#ffffff',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          animation: 'popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        {/* Glowing Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(233, 69, 96, 0.15)',
            border: '2px solid rgba(233, 69, 96, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 18px auto',
            boxShadow: '0 0 20px rgba(233, 69, 96, 0.2)'
          }}
        >
          🚪
        </div>

        {/* Title & Message */}
        <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800', color: '#ffffff' }}>
          Confirm Logout
        </h3>

        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#b2bec3', lineHeight: '1.5' }}>
          Are you sure you want to log out of <strong>AlertNet</strong>? You will need to sign in again to access the app.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            type="button"
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '8px',
              border: '1px solid #0f3460',
              background: '#0f3460',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#1a1a2e';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#0f3460';
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            type="button"
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#e94560',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(233, 69, 96, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
