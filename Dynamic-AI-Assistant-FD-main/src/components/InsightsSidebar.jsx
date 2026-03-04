import React from 'react'

function InsightsSidebar({
    attributes,
    sampleQuestions,
    onQuestionClick,
    graphData,
    dataSourceType,
    fileHistory,
    onDeleteFile,
    isOpen,
    onClose,
    onToggle,
    onRefresh,
    style = {}
}) {
    // Removed: if (!isOpen) return null;

    const COLORS = ['#006266', '#009688', '#58696D', '#A5D6A7', '#D97706', '#E0F2F1'];

    const renderBarChart = (data) => {
        if (!data || !data.values) return null;
        const maxVal = Math.max(...data.values, 1);

        return (
            <>
                <div className="section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    CATEGORY DISTRIBUTION
                </div>
                <div className="mini-chart blocks">
                    {data.values.slice(0, 2).map((val, i) => (
                        <div
                            key={i}
                            className="chart-block"
                            style={{
                                background: i === 0 ? 'var(--accent-navy)' : 'var(--border-soft)'
                            }}
                        ></div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    {data.labels && data.labels.slice(0, 2).map((lbl, i) => (
                        <span key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                            {lbl}
                        </span>
                    ))}
                </div>
            </>
        );
    };

    const renderPieChart = (data) => {
        if (!data || !data.values || data.values.length === 0) return null;

        const total = data.values.reduce((a, b) => a + b, 0);
        let cumulativePercent = 0;

        const slices = data.values.map((val, i) => {
            const percentage = (val / total) * 100;
            const start = cumulativePercent;
            cumulativePercent += percentage;
            return `${COLORS[i % COLORS.length]} ${start}% ${cumulativePercent}%`;
        }).join(', ');

        return (
            <>
                <div className="section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                        <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                    </svg>
                    QUESTION BREAKDOWN
                </div>
                <div className="donut-chart-container">
                    <div className="donut-chart" style={{
                        background: `conic-gradient(${slices})`,
                    }}>
                        <div className="donut-hole" style={{ background: 'var(--bg-surface)' }}>
                            <span className="donut-val">{data.center_label || data.values.length}</span>
                            <span className="donut-label">{data.center_text || 'Segments'}</span>
                        </div>
                    </div>
                </div>
                <div className="chart-legend">
                    {data.labels && data.labels.map((lbl, i) => (
                        <div key={i} className="legend-item">
                            <span className="dot" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                            <span>{lbl}</span>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    const renderTrendChart = (data) => {
        if (!data || !data.data_points) return null;

        return (
            <div className="analytics-card trend-analysis">
                <div className="section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    {data.title || 'Trends'}
                </div>
                <svg className="line-chart-svg" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ height: '60px', width: '100%', overflow: 'visible' }}>
                    <path
                        d={`M 0 35 ${data.data_points.map((p, i) => `L ${(i / (data.data_points.length - 1)) * 100} ${35 - ((p / Math.max(...data.data_points, 1)) * 30)}`).join(' ')}`}
                        fill="none"
                        stroke="var(--accent-primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <div className={`trend-val ${!data.trend_change || data.trend_change.startsWith('+') ? 'up' : 'down'}`} style={{
                            fontSize: '1rem',
                            fontWeight: '800',
                            color: !data.trend_change || data.trend_change.startsWith('+') ? 'var(--accent-success)' : 'var(--accent-danger)'
                        }}>
                            {data.trend_change || '+0.0%'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase' }}>{data.trend_label || 'Growth'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-navy)' }}>{data.avg_value || '0.0'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase' }}>Avg Value</div>
                    </div>
                </div>
            </div>
        );
    };

    const [showAllAttributes, setShowAllAttributes] = React.useState(false);
    const [expandedSections, setExpandedSections] = React.useState({
        metadata: true,
        analytics: true,
        datasets: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const ATTRIBUTE_LIMIT = 10;
    const JUNK_FIELDS = ['id', 'user_id', 'assistant_id', 'metadata', 'source', 'row_number', 'item_number', 'version'];

    const filteredAttributes = (attributes || []).filter(attr => !JUNK_FIELDS.includes(attr.toLowerCase()));

    return (
        <div className={`insights-sidebar ${isOpen ? 'open' : ''} ${window.innerWidth < 768 ? 'mobile-panel' : ''}`} style={style}>

            <div className="insights-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-navy)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insights</h4>
                    {dataSourceType && <span className="source-type-pill">{dataSourceType}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="icon-btn" onClick={onRefresh} title="Recalibrate Neural Data">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={onClose} title="Close Analysis Panel">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="insights-content">
                {/* Attributes Section */}
                {attributes && attributes.length > 0 && (
                    <div className={`insights-section ${expandedSections.metadata ? 'expanded' : 'collapsed'}`}>
                        <div className="section-header-toggle" onClick={() => toggleSection('metadata')}>
                            <div className="section-title">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                                </svg>
                                Detected Metadata
                            </div>
                            <svg className={`chevron ${expandedSections.metadata ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>

                        {expandedSections.metadata && (
                            <div className="section-body-flow">
                                <div className="attributes-list">
                                    {(showAllAttributes ? filteredAttributes : filteredAttributes.slice(0, ATTRIBUTE_LIMIT)).map((attr, idx) => (
                                        <div
                                            key={idx}
                                            className="attribute-chip interactive"
                                            onClick={() => onQuestionClick && onQuestionClick(`Perform a detailed analysis focusing on the '${attr}' field. Identify trends, anomalies, and its overall strategic impact.`)}
                                            title={`Analyze ${attr}`}
                                        >
                                            <span className="attr-icon">◈</span>
                                            {attr}
                                        </div>
                                    ))}
                                </div>
                                {filteredAttributes.length > ATTRIBUTE_LIMIT && (
                                    <button
                                        onClick={() => setShowAllAttributes(!showAllAttributes)}
                                        className="view-more-btn"
                                    >
                                        {showAllAttributes ? 'Minimize View' : `Explore All (${filteredAttributes.length})`}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAllAttributes ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics Section */}
                <div className={`insights-section ${expandedSections.analytics ? 'expanded' : 'collapsed'}`}>
                    <div className="section-header-toggle" onClick={() => toggleSection('analytics')}>
                        <div className="section-title">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 2v10l8 5"></path>
                            </svg>
                            ANALYTICAL INTELLIGENCE
                        </div>
                        <svg className={`chevron ${expandedSections.analytics ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>

                    {expandedSections.analytics && (
                        <div className="section-body-flow" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {graphData?.bar_chart && (
                                <div className="analytics-card category-distribution">
                                    {renderBarChart(graphData.bar_chart)}
                                </div>
                            )}

                            {graphData?.donut_chart && (
                                <div className="analytics-card professional-breakdown question-breakdown">
                                    {renderPieChart(graphData.donut_chart)}
                                </div>
                            )}

                            {graphData?.line_chart && renderTrendChart(graphData.line_chart)}

                            {/* Unstructured summary removed for tighter dashboard layout */}

                            {(!graphData || (!graphData.bar_chart && !graphData.donut_chart && !graphData.line_chart && !graphData.unstructured_summary)) && (
                                <div className="analytics-placeholder" style={{
                                    textAlign: 'center',
                                    padding: '48px 20px',
                                    border: '1px dashed var(--sage-soft)',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--accent-glass)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <span className="live-pulse"></span>
                                    <div style={{ color: 'var(--accent-primary)', marginBottom: '4px' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                        </svg>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--accent-navy)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Synthesizing Deep Analytics
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, maxWidth: '200px' }}>
                                        Our neural engine is currently modeling the dataset architecture to generate strategic insights.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* File History Section */}
                {fileHistory && fileHistory.length > 0 && (
                    <div className={`insights-section ${expandedSections.datasets ? 'expanded' : 'collapsed'}`}>
                        <div className="section-header-toggle" onClick={() => toggleSection('datasets')}>
                            <div className="section-title">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                </svg>
                                Verified Datasets
                            </div>
                            <svg className={`chevron ${expandedSections.datasets ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>

                        {expandedSections.datasets && (
                            <div className="section-body-flow" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {fileHistory.map((file, idx) => (
                                    <div key={idx} style={{
                                        padding: '12px 16px',
                                        background: 'var(--bg-main)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-soft)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {file.filename}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                                                {new Date(file.upload_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <button
                                            className="icon-btn"
                                            onClick={() => onDeleteFile(file.filename)}
                                            style={{
                                                color: 'var(--accent-danger)',
                                                padding: '8px',
                                                background: 'rgba(239, 68, 68, 0.05)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="dataset-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)', boxShadow: '0 0 8px var(--accent-success)' }}></div>
                    Engine Context Optimized
                </div>
            </div>
        </div >
    );
}

export default InsightsSidebar;
