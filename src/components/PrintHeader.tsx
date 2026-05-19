export default function PrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const now = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <div className="print-only" style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid #4f46e5' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="brand-mark" style={{ width: 36, height: 36, fontSize: '0.75rem' }}>
            RIT
          </span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '11pt', margin: 0 }}>
              RIT Internship Portal
            </p>
            <p style={{ fontSize: '9pt', color: '#6b7280', margin: 0 }}>
              Rajiv Gandhi Institute of Technology, Kottayam
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#6b7280' }}>
          Generated {now}
        </div>
      </div>
      <p style={{ fontSize: '16pt', fontWeight: 700, margin: '0.5rem 0 0' }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontSize: '10pt', color: '#4b5563', margin: '0.25rem 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
