/** PWA / app/icon 용 부엉이 (ImageResponse / Satori 호환) */
export function OwlIconImage() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#3182F6',
      }}
    >
      <div style={{ position: 'relative', width: 380, height: 380 }}>
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: '#FFF8F0',
            position: 'absolute',
            top: 40,
            left: 30,
          }}
        />
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: '#E8C9A8',
            position: 'absolute',
            top: 20,
            left: 40,
          }}
        />
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: '#E8C9A8',
            position: 'absolute',
            top: 20,
            right: 40,
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '70px solid transparent',
            borderRight: '70px solid transparent',
            borderBottom: '80px solid #4A5568',
            position: 'absolute',
            top: 0,
            left: 120,
          }}
        />
        <div
          style={{
            width: 120,
            height: 28,
            background: '#FFD93D',
            borderRadius: 8,
            position: 'absolute',
            top: 72,
            left: 130,
          }}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#2D3748',
            position: 'absolute',
            top: 130,
            left: 75,
          }}
        />
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#FFFFFF',
            position: 'absolute',
            top: 138,
            left: 88,
          }}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#2D3748',
            position: 'absolute',
            top: 130,
            right: 75,
          }}
        />
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#FFFFFF',
            position: 'absolute',
            top: 138,
            right: 88,
          }}
        />
        <div
          style={{
            width: 48,
            height: 36,
            borderRadius: '50%',
            background: '#FFB4A2',
            position: 'absolute',
            top: 200,
            left: 166,
          }}
        />
        <div
          style={{
            width: 100,
            height: 72,
            background: '#FFFFFF',
            borderRadius: 12,
            position: 'absolute',
            bottom: 30,
            left: 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ width: 60, height: 8, background: '#3182F6', borderRadius: 4, opacity: 0.5 }} />
          <div style={{ width: 44, height: 6, background: '#8B95A1', borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
