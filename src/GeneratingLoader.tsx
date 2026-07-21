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

export default function GeneratingLoader({ status }: GeneratingLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % STEPS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="generating-container">
      {/* Animated Brain/AI Icon */}
      <svg className="generating-brain" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" stroke="url(#grad)" strokeWidth="4" fill="none" strokeDasharray="280" strokeDashoffset="0">
          <animate attributeName="stroke-dashoffset" from="0" to="560" dur="3s" repeatCount="indefinite" />
        </circle>
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Brain outline */}
        <path d="M50 20 C30 20 20 35 20 50 C20 65 35 80 50 80 C65 80 80 65 80 50 C80 35 70 20 50 20" stroke="url(#grad)" strokeWidth="3" fill="none" />
        {/* Brain details */}
        <path d="M35 40 Q50 45 65 40 M35 55 Q50 60 65 55 M40 35 V50 M60 35 V50 M40 65 V55 M60 65 V55" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" />
        {/* Sparkles */}
        <circle cx="25" cy="25" r="3" fill="#60a5fa" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="75" cy="30" r="2" fill="#a78bfa" opacity="0.4">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="70" cy="70" r="3" fill="#34d399" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      <p className="generating-text">
        {status || 'Menyusun'}
        <span className="generating-dots" />
      </p>

      <p className="generating-subtext">
        {STEPS[currentStep]}
      </p>

      {/* Progress bar */}
      <div className="generating-progress">
        <div className="generating-progress-bar" />
      </div>

      {/* Floating emojis */}
      <div className="generating-emoji">
        <span>📚</span>
        <span>✏️</span>
        <span>🎯</span>
      </div>
    </div>
  );
}
