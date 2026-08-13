"use client";

import { useMemo, useState } from "react";
import type { ShopMapData } from "./types.js";

type Edge = ShopMapData["edges"][number];

export default function RelationshipExplorer({ map }: { map: ShopMapData }) {
  const [query, setQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState(map.anchor.tableId);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredNodes = useMemo(() => map.nodes.filter((node) =>
    !normalizedQuery || `${node.tableName} ${node.tableId}`.toLowerCase().includes(normalizedQuery),
  ), [map.nodes, normalizedQuery]);

  const visibleEdges = useMemo(() => map.edges.filter((edge) =>
    edge.sourceTableId === selectedTable || edge.targetTableId === selectedTable,
  ), [map.edges, selectedTable]);

  const selectedNode = map.nodes.find((node) => node.tableId === selectedTable) ?? map.nodes[0];
  const counts = {
    ninox: map.edges.filter((edge) => edge.source === "ninox").length,
    detected: map.edges.filter((edge) => edge.source === "detected").length,
    unknown: map.edges.filter((edge) => edge.source === "unknown").length,
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">NINOX DATA MAPPER / P0</div>
          <h1>Relationship Explorer</h1>
          <p className="subhead">Explore the real Shop data map discovered from Ninox.</p>
        </div>
        <div className="readonly"><span className="status-dot" /> READ ONLY</div>
      </header>

      <section className="hero-grid">
        <div className="anchor-card">
          <div className="card-label">ANCHOR TABLE</div>
          <div className="anchor-name">{map.anchor.tableName}</div>
          <div className="anchor-id">ID / {map.anchor.tableId}</div>
          <div className="anchor-note">Primary discovery point for the Shop map</div>
        </div>
        <div className="metric-card"><span>TABLES</span><strong>{map.nodes.length}</strong><small>connected to anchor</small></div>
        <div className="metric-card"><span>RELATIONSHIPS</span><strong>{map.edges.length}</strong><small>explicit + detected</small></div>
        <div className="metric-card"><span>HYPOTHESES</span><strong className="amber">{map.hypotheses.length}</strong><small>require review</small></div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-heading"><span>TABLES</span><em>{map.nodes.length}</em></div>
          <input aria-label="Search tables" placeholder="Search tables..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="table-list">
            {filteredNodes.map((node) => (
              <button className={`table-row ${selectedTable === node.tableId ? "active" : ""}`} key={node.tableId} onClick={() => { setSelectedTable(node.tableId); setSelectedEdge(null); }}>
                <span className={node.role === "anchor" ? "node-mark anchor-mark" : "node-mark"} />
                <span><b>{node.tableName}</b><small>{node.tableId}</small></span>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="content">
          <div className="content-header">
            <div><div className="card-label">SELECTED TABLE</div><h2>{selectedNode?.tableName ?? "Unknown"}</h2><span className="pill">ID {selectedNode?.tableId}</span></div>
            <div className="legend"><span><i className="legend-dot green" /> Ninox relation <b>{counts.ninox}</b></span><span><i className="legend-dot amber-dot" /> Detected <b>{counts.detected}</b></span><span><i className="legend-dot gray" /> Unknown <b>{counts.unknown}</b></span></div>
          </div>

          <div className="relation-list">
            {visibleEdges.length === 0 && <div className="empty">No relationships found for this table.</div>}
            {visibleEdges.map((edge, index) => {
              const outgoing = edge.sourceTableId === selectedTable;
              const otherTable = outgoing ? edge.targetTable : edge.sourceTable;
              return <button className={`relation-card ${selectedEdge === edge ? "selected" : ""}`} key={`${edge.sourceTableId}-${edge.sourceFieldId}-${edge.targetTableId}-${index}`} onClick={() => setSelectedEdge(edge)}>
                <div className="relation-direction"><span className={edge.source === "ninox" ? "relation-icon green-bg" : "relation-icon amber-bg"}>{edge.source === "ninox" ? "✓" : "•"}</span><span>{outgoing ? "OUTGOING" : "INCOMING"}</span></div>
                <div className="relation-main"><strong>{outgoing ? edge.sourceField : edge.sourceTable}</strong><span className="arrow">{outgoing ? "→" : "←"}</span><strong>{otherTable}</strong></div>
                <div className="relation-meta"><span>{edge.source === "ninox" ? "Ninox Relation" : "Detected Relation"}</span><span>confidence {Math.round(edge.confidence * 100)}%</span></div>
              </button>;
            })}
          </div>

          <div className="detail-panel">
            <div className="card-label">RELATIONSHIP DETAIL</div>
            {selectedEdge ? <><div className="detail-title">{selectedEdge.sourceTable}.{selectedEdge.sourceField} <span>→</span> {selectedEdge.targetTable}.id</div><div className="detail-grid"><div><span>SOURCE</span><b>{selectedEdge.source === "ninox" ? "✓ Ninox Relation" : "• Detected Relation"}</b></div><div><span>FIELD IDS</span><b>{selectedEdge.sourceFieldId} → id</b></div><div><span>REVERSE FIELD</span><b>{selectedEdge.reverseField}</b></div><div><span>CONFIDENCE</span><b>{Math.round(selectedEdge.confidence * 100)}%</b></div></div>{selectedEdge.source !== "ninox" && <p className="warning">This is a technical hypothesis based on sampled IDs. It is not confirmed by Ninox metadata.</p>}</> : <p className="muted">Select a relationship to inspect its source, target, reverse field, and confidence.</p>}
          </div>
        </section>
      </section>
      <footer><span>Generated {map.generatedAt === new Date(0).toISOString() ? "No scan loaded" : map.generatedAt}</span><span>Data Mapper P0 · local artifact</span></footer>
    </main>
  );
}
