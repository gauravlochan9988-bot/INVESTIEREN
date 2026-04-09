import { AccessCodeForm } from "@/components/access-code-form";

export default function Home() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-copy">
          <p className="login-eyebrow">Trading Dashboard</p>
          <h1 className="login-title">GQ Trading</h1>
          <p className="login-subtitle">Simple access. Real market signals.</p>
        </div>

        <AccessCodeForm />

        <div className="login-info">
          <p className="login-info-title">Inside your workspace</p>
          <ul className="login-info-list">
            <li>Live signals</li>
            <li>AI-based trade decisions</li>
            <li>Alerts in one workspace</li>
          </ul>
        </div>

        <p className="login-stack">Frontend: Vercel • Backend: Railway • Database: Neon</p>
      </section>
    </main>
  );
}
