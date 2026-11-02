"use client";

// Easter egg: shown when someone backs Derby County to win (an LMS pick or a
// Predictor scoreline). Closes on the button or a tap outside the box.
export default function DerbyNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-label="Are you ok mate?" onClick={(e) => e.stopPropagation()}>
        <p style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>Are you ok mate?</p>
        <p style={{ margin: 0, fontSize: "1.4rem", letterSpacing: "0.08em" }}>
          <a href="tel:116123">116 123</a>
        </p>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
