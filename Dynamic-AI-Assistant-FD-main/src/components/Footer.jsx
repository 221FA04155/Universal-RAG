import React from 'react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer style={{
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-main)',
            padding: '100px 24px 60px',
            color: 'var(--text-secondary)'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: '1.5fr repeat(4, 1fr)',
                gap: '40px'
            }}>
                {/* Brand Column */}
                <div style={{ gridColumn: 'span 1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            background: 'var(--accent-navy)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '900',
                            fontSize: '1.2rem'
                        }}>D</div>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-navy)', letterSpacing: '-0.5px' }}>
                            DataMind
                        </span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '32px', maxWidth: '300px' }}>
                        Enterprise-standard platform for high-context neural search and localized data intelligence.
                    </p>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)', animation: 'pulse 2s infinite' }}></span>
                            SYSTEMS OPERATIONAL
                        </span>
                    </div>
                </div>

                {/* Navigation Links */}
                {[
                    {
                        title: 'Platform',
                        links: ['Architecture', 'Data Connectors', 'Security', 'Enterprise RAG']
                    },
                    {
                        title: 'Solutions',
                        links: ['Legal Review', 'Financial Analysis', 'R&D Discovery', 'Compliance']
                    },
                    {
                        title: 'Resources',
                        links: ['Documentation', 'API Reference', 'Developer Portal', 'Status']
                    },
                    {
                        title: 'Company',
                        links: ['About Us', 'Contact Sales', 'Terms of Service', 'Privacy Policy']
                    }
                ].map((col, i) => (
                    <div key={i}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent-navy)', marginBottom: '28px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{col.title}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {col.links.map((link, j) => (
                                <li key={j} style={{ marginBottom: '16px' }}>
                                    <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>{link}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                paddingTop: '60px',
                marginTop: '60px',
                borderTop: '1px solid var(--border-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                    © {currentYear} DataMind Intelligence Systems. All rights reserved.
                </div>
                <div style={{ display: 'flex', gap: '32px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>ISO 27001 CERTIFIED</p>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(0.9); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(0.9); opacity: 0.6; }
                }
            `}</style>
        </footer>
    );
};

export default Footer;
