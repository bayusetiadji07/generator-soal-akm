export default function ModernLoader() {
  return (
    <div className="loader-container">
      {/* Floating orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className="loader-content">
        <img
          src="/logo-si-gatot.png"
          alt="Si Gatot"
          className="loader-logo rounded-2xl shadow-2xl"
        />
        <h1 className="loader-title">Si Gatot</h1>
        <p className="loader-subtitle">Generator Tes Otomatis Berbasis AI</p>

        <div className="loader-spinner">
          <div className="spinner-dot"></div>
          <div className="spinner-dot"></div>
          <div className="spinner-dot"></div>
        </div>

        <div className="loader-progress">
          <div className="loader-progress-bar"></div>
        </div>
      </div>
    </div>
  );
}
