import { useState, useEffect } from 'react';

interface GeneratingLoaderProps {
  status: string;
}

const STEPS = [
  'Menganalisis topik dan kurikulum...',
  'Menyusun kisi-kisi soal...',
  'Membuat stimulus soal...',
  'Menulis pertanyaan HOTS...',
  'Membuat pengecoh logis...',
  'Menyusun kunci jawaban...',
  'Menulis pembahasan...',
  'Memformat perangkat soal...',
];

// Sudut & jarak tiap partikel dibuat tetap (bukan random tiap render)
// supaya animasinya halus dan tidak "meloncat" saat status berubah.
const PARTICLES = Array.from({ length: 14 }).map((_, i) => {
  const angle = (i / 14) * 360;
  const radius = 55 + (i % 3) * 18;
  return {
    x: Math.cos((angle * Math.PI) / 180) * radius,
    y: Math.sin((angle * Math.PI) / 180) * radius,
    delay: (i % 7) * 0.3,
    duration: 3 + (i % 4) * 0.6,
    size: 3 + (i % 3) * 2,
  };
});

export default function GeneratingLoader({ status }: GeneratingLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);

  return (
    <div className="generating-container">
      <div className="generating-orb-wrap">
        {/* Cincin berputar */}
        <div className="generating-ring" />
        <div className="generating-ring generating-ring-2" />

        {/* Inti bercahaya */}
        <div className="generating-core" />

        {/* Partikel mengambang */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="generating-particle"
            style={{
              // @ts-ignore - custom CSS properties
              '--px': `${p.x}px`,
              '--py': `${p.y}px`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <p className="generating-text">
        {status || 'Menyusun soal'}
        <span className="generating-dots" />
      </p>

      <p key={currentStep} className="generating-subtext">
        {STEPS[currentStep]}
      </p>

      <div className="generating-progress">
        <div className="generating-progress-bar" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}
