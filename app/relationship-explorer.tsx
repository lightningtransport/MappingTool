"use client";

import { useMemo, useState } from "react";
import { fieldReviewKey, relationshipReviewKey } from "../src/catalog/types.js";
import {
  CandidateReview,
  ConsumerCard,
  ConsumerForm,
  ExportCatalogControl,
  FieldReviewForm,
  RelationshipReviewForm,
  TableReviewForm,
} from "./catalog-forms.js";
import {
  filterRelationships,
  searchCatalog,
  scopedRelationships,
  type Direction,
  type ExplorerData,
  type ExplorerField,
  type ExplorerRelationship,
  type RelationshipSource,
} from "./explorer-data.js";
import { relationshipGraph } from "./relationship-graph-model.js";
import RescanControl from "./rescan-control.js";

type CatalogTab = "overview" | "fields" | "relationships" | "usage";

function EvidenceBadge({ kind }: { kind: "evidence" | "reviewed" | "external" | "unknown" }) {
  const labels = { evidence: "Ninox evidence", reviewed: "Human reviewed", external: "External candidate", unknown: "Unknown" };
  return <span className={`knowledge-badge ${kind}`}>{labels[kind]}</span>;
}

export default function RelationshipExplorer({ data }: { data: ExplorerData }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"shop" | "all">("all");
  const [source, setSource] = useState<RelationshipSource | "all">("all");
  const [direction, setDirection] = useState<Direction>("all");
  const [selectedTable, setSelectedTable] = useState(data.tables[0]?.id ?? data.shopMap.anchor.tableId);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ExplorerRelationship | null>(null);
  const [tab, setTab] = useState<CatalogTab>("overview");

  const scopeIds = useMemo(() => new Set(data.shopMap.nodes.map((node) => node.tableId)), [data.shopMap.nodes]);
  const tables = data.tables.filter((table) => scope === "all" || scopeIds.has(table.id));
  const tableQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => searchCatalog(data, query), [data, query]);
  const visibleTables = tables.filter((table) => !tableQuery || `${table.name} ${table.id}`.toLowerCase().includes(tableQuery));
  const selectedNode = data.tables.find((table) => table.id === selectedTable) ?? { id: selectedTable, name: "Unresolved table", relationshipCount: 0, fields: [] };
  const relationships = scopedRelationships(scope, data.relationships, data.shopMap.edges);
  const visibleEdges = useMemo(() => filterRelationships(relationships, source, direction, selectedTable), [relationships, source, direction, selectedTable]);
  const graph = useMemo(() => relationshipGraph(selectedTable, selectedNode.name, visibleEdges), [selectedTable, selectedNode.name, visibleEdges]);
  const selectedFieldData = selectedNode.fields.find((field) => field.id === selectedField) ?? null;
  const annotations = data.catalog.annotations;
  const tableReview = annotations.tables[selectedTable];
  const tableConsumers = Object.values(annotations.consumers).filter((consumer) => consumer.tableIds.includes(selectedTable));
  const tableCandidates = Object.values(annotations.candidates).filter((candidate) => candidate.tableId === selectedTable);
  const pendingTableCandidates = tableCandidates.filter((candidate) => candidate.decision === "pending");
  const sourceCounts = {
    ninox: data.relationships.filter((edge) => edge.source === "ninox").length,
    detected: data.relationships.filter((edge) => edge.source === "detected").length,
    unknown: data.relationships.filter((edge) => edge.source === "unknown").length,
  };

  function navigate(tableId: string, nextTab: CatalogTab = tab, fieldId: string | null = null) {
    setScope("all");
    setSelectedTable(tableId);
    setSelectedField(fieldId);
    setSelectedEdge(null);
    setTab(fieldId ? "fields" : nextTab);
    setQuery("");
  }

  function relatedEdge(field: ExplorerField) {
    if (field.type === "ref") return data.relationships.find((edge) => edge.sourceTableId === selectedTable && edge.sourceFieldId === field.id);
    if (field.type === "rev") return data.relationships.find((edge) => edge.sourceTableId === field.referenceFromTable && edge.sourceFieldId === field.referenceFromField && edge.targetTableId === selectedTable);
    return undefined;
  }

  return <main className="shell">
    <header className="topbar">
      <div><div className="eyebrow">NINOX DATA MAPPER / TECHNICAL CATALOG</div><h1>Relationship Explorer</h1><p className="subhead">Understand what data exists, what it means, how it connects, and who uses it.</p></div>
      <div className="topbar-actions"><div className="readonly"><span className="status-dot" /> READ ONLY TO NINOX</div><RescanControl /></div>
    </header>

    {data.catalog.issue && <div className="catalog-alert error" role="alert"><strong>Catalog file needs attention.</strong> {data.catalog.issue}</div>}

    <section className="hero-grid catalog-metrics" aria-label="Catalog coverage">
      <div className="database-card"><div className="card-label">DATABASE SCOPE</div><div className="database-name">Complete Ninox database</div><div className="database-note">{data.summary.tableCount} tables · {data.summary.fieldCount} fields · {data.summary.relationshipCount} relationships</div></div>
      <div className="metric-card"><span>REVIEWED TABLES</span><strong>{data.catalog.coverage.reviewedTables}</strong><small>of {data.summary.tableCount}</small></div>
      <div className="metric-card"><span>DOCUMENTED FIELDS</span><strong>{data.catalog.coverage.documentedFields}</strong><small>human or approved context</small></div>
      <div className="metric-card"><span>PENDING REVIEW</span><strong className="amber">{data.catalog.coverage.pendingCandidates + data.catalog.coverage.pendingRelationships}</strong><small>candidates + decisions</small></div>
      <div className="metric-card"><span>ORPHANS</span><strong>{data.catalog.coverage.orphanedAnnotations}</strong><small>preserved after schema change</small></div>
    </section>
    <div className="knowledge-legend" aria-label="Knowledge provenance legend"><EvidenceBadge kind="evidence" /><EvidenceBadge kind="reviewed" /><EvidenceBadge kind="external" /><EvidenceBadge kind="unknown" /></div>

    <details className="evidence-drawer">
      <summary>Structural evidence and scan history</summary>
      <div className="evidence-summary"><span>Ninox relationships <b>{sourceCounts.ninox}</b></span><span>Detected hypotheses <b>{sourceCounts.detected}</b></span><span>Unresolved <b>{sourceCounts.unknown}</b></span><span>Saved scans <b>{data.history.length}</b></span></div>
      {data.history.slice(0, 5).map((entry) => <p key={entry.toScannedAt}><code>{entry.toScannedAt}</code> — {entry.baseline ? "baseline" : `${entry.summary.total} structural changes`}</p>)}
    </details>

    {data.catalog.orphans.length > 0 && <details className="catalog-alert"><summary>{data.catalog.orphans.length} preserved orphan annotations require review</summary><ul>{data.catalog.orphans.map((orphan) => <li key={`${orphan.kind}:${orphan.key}`}><code>{orphan.key}</code> — {orphan.reason}</li>)}</ul></details>}

    <section className="workspace">
      <aside className="sidebar">
        <div className="section-heading"><span>DATA ASSETS</span><em>{tables.length}</em></div>
        <label className="search-label">Search catalog<input aria-label="Search catalog" placeholder="Name, ID, meaning, tag, use…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="scope-control" role="group" aria-label="Database scope"><button className={scope === "all" ? "selected" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>All database</button><button className={scope === "shop" ? "selected" : ""} aria-pressed={scope === "shop"} onClick={() => { setScope("shop"); if (!scopeIds.has(selectedTable)) navigate(data.shopMap.anchor.tableId); }}>TrucksDB area</button></div>
        {query.trim() && searchResults.length > 0 ? <div className="search-results" aria-label="Catalog search results">{searchResults.map((result, index) => <button key={`${result.kind}:${result.tableId}:${result.fieldId ?? index}`} onClick={() => navigate(result.tableId, result.kind === "consumer" ? "usage" : "overview", result.fieldId)}><span><b>{result.label}</b><small>{result.kind} · {result.detail}</small></span><EvidenceBadge kind={result.provenance === "Human reviewed" ? "reviewed" : "evidence"} /></button>)}</div> : <div className="table-list">{visibleTables.map((table) => <button className={`table-row ${selectedTable === table.id ? "active" : ""}`} key={table.id} onClick={() => navigate(table.id, "overview")}><span className="node-mark" /><span><b>{table.name}</b><small>{table.id} · {table.fields.length} fields</small></span><span className="chevron">›</span></button>)}</div>}
      </aside>

      <section className="content">
        <div className="content-header"><div><div className="card-label">SELECTED DATA ASSET</div><h2>{selectedNode.name}</h2><div className="asset-badges"><span className="pill">ID {selectedNode.id}</span><EvidenceBadge kind="evidence" />{tableReview ? <EvidenceBadge kind="reviewed" /> : <EvidenceBadge kind="unknown" />}{pendingTableCandidates.length > 0 && <EvidenceBadge kind="external" />}</div></div><ExportCatalogControl /></div>
        <nav className="catalog-tabs" aria-label="Table catalog sections">{(["overview", "fields", "relationships", "usage"] as CatalogTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item === "usage" ? "Usage & Review" : item[0]!.toUpperCase() + item.slice(1)}</button>)}</nav>

        {tab === "overview" && <section className="catalog-section" aria-labelledby="overview-heading">
          <div className="section-intro"><div><div className="card-label">OVERVIEW</div><h3 id="overview-heading">Meaning and governance</h3></div><p>Ninox supplies structure. The fields below are reviewed human knowledge stored locally.</p></div>
          <div className="evidence-facts"><div><span>Table ID</span><b>{selectedNode.id}</b></div><div><span>Fields</span><b>{selectedNode.fields.length}</b></div><div><span>Relationships</span><b>{selectedNode.relationshipCount}</b></div><div><span>Evidence state</span><b>Scanned</b></div></div>
          <TableReviewForm tableId={selectedNode.id} review={tableReview} fieldIds={selectedNode.fields.map((field) => field.id)} />
        </section>}

        {tab === "fields" && <section className="catalog-section" aria-labelledby="fields-heading">
          <div className="section-intro"><div><div className="card-label">FIELDS</div><h3 id="fields-heading">Schema evidence and business context</h3></div><p>Select a field to document meaning, role, sensitivity, and safe use.</p></div>
          <div className="fields-workspace"><div className="field-list catalog-field-list">{selectedNode.fields.map((field) => { const review = annotations.fields[fieldReviewKey(selectedNode.id, field.id)]; return <button className={`field-card ${selectedField === field.id ? "selected" : ""}`} key={field.id} onClick={() => setSelectedField(field.id)}><div className="field-card-heading"><div><strong>{field.name}</strong><span>{field.id} · {field.type}</span></div><EvidenceBadge kind={review ? "reviewed" : field.metadataState === "unknown" ? "unknown" : "evidence"} /></div>{review?.description && <p>{review.description}</p>}{field.choices.length > 0 && <small>{field.choices.length} schema options</small>}</button>; })}</div>
          <div className="selected-review-panel">{selectedFieldData ? <><div className="ninox-evidence-card"><EvidenceBadge kind="evidence" /><dl><div><dt>Name</dt><dd>{selectedFieldData.name}</dd></div><div><dt>Stable ID</dt><dd>{selectedNode.id}.{selectedFieldData.id}</dd></div><div><dt>Type</dt><dd>{selectedFieldData.type}</dd></div><div><dt>Reference</dt><dd>{relatedEdge(selectedFieldData)?.targetTable ?? "Unknown / not applicable"}</dd></div></dl></div><FieldReviewForm tableId={selectedNode.id} fieldId={selectedFieldData.id} fieldName={selectedFieldData.name} review={annotations.fields[fieldReviewKey(selectedNode.id, selectedFieldData.id)]} /></> : <div className="empty-state">Select a field to inspect and document it.</div>}</div></div>
        </section>}

        {tab === "relationships" && <section className="catalog-section" aria-labelledby="relationships-heading">
          <div className="section-intro"><div><div className="card-label">RELATIONSHIPS</div><h3 id="relationships-heading">Structural graph and review decisions</h3></div><p>The graph contains tables only. Consumers remain in Usage & Review.</p></div>
          <div className="filters"><label>Source<select aria-label="Source filter" value={source} onChange={(event) => setSource(event.target.value as RelationshipSource | "all")}><option value="all">All</option><option value="ninox">Ninox</option><option value="detected">Detected</option><option value="unknown">Unresolved</option></select></label><label>Direction<select aria-label="Direction filter" value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="all">All</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label></div>
          <div className="relationship-layout"><div><div className="graph-panel"><div className="graph-legend"><span className="ninox">Ninox</span><span className="detected">Hypothesis</span><span className="unknown">Unresolved</span></div>{graph.neighbors.length === 0 ? <div className="graph-empty">No direct relationships match these filters.</div> : <svg className="relationship-graph" viewBox="0 0 760 560" role="img" aria-label={`Relationships centered on ${selectedNode.name}`}>{graph.edges.map((edge, index) => { const targetId = edge.sourceTableId === selectedTable ? edge.targetTableId : edge.sourceTableId; const target = graph.neighbors.find((node) => node.id === targetId)!; return <line key={`${edge.sourceTableId}:${edge.sourceFieldId}:${edge.targetTableId}:${index}`} className={`graph-line ${edge.source}`} x1={graph.center.x} y1={graph.center.y} x2={target.x} y2={target.y} />; })}<g className="graph-center"><circle cx={graph.center.x} cy={graph.center.y} r="42" /><text x={graph.center.x} y={graph.center.y}>{graph.center.label}</text></g>{graph.neighbors.map((node) => <g className="graph-neighbor" key={node.id} role="button" tabIndex={0} aria-label={`Select ${node.name}`} onClick={() => navigate(node.id, "relationships")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(node.id, "relationships"); }}><circle cx={node.x} cy={node.y} r="30" /><text x={node.x} y={node.y}>{node.label}</text></g>)}</svg>}</div>
          <div className="relation-list">{visibleEdges.map((edge, index) => { const review = annotations.relationships[relationshipReviewKey(edge.sourceTableId, edge.sourceFieldId, edge.targetTableId)]; return <button className={`relation-card ${selectedEdge === edge ? "selected" : ""}`} key={`${edge.sourceTableId}:${edge.sourceFieldId}:${edge.targetTableId}:${index}`} onClick={() => setSelectedEdge(edge)}><div className="relation-direction"><EvidenceBadge kind={edge.source === "ninox" ? "evidence" : edge.source === "unknown" ? "unknown" : "external"} />{review && <EvidenceBadge kind="reviewed" />}</div><div className="relation-main"><strong>{edge.sourceTable}.{edge.sourceField}</strong><span>→</span><strong>{edge.targetTable}</strong></div><div className="relation-meta"><span>{Math.round(edge.confidence * 100)}% confidence</span><span>{review?.decision ?? "not reviewed"}</span></div></button>; })}</div></div>
          <div className="selected-review-panel">{selectedEdge ? <><div className="ninox-evidence-card"><EvidenceBadge kind={selectedEdge.source === "ninox" ? "evidence" : selectedEdge.source === "unknown" ? "unknown" : "external"} /><p>{selectedEdge.sourceTable}.{selectedEdge.sourceField} → {selectedEdge.targetTable}.{selectedEdge.targetField}</p><small>{selectedEdge.provenance}</small></div><RelationshipReviewForm identity={selectedEdge} review={annotations.relationships[relationshipReviewKey(selectedEdge.sourceTableId, selectedEdge.sourceFieldId, selectedEdge.targetTableId)]} /></> : <div className="empty-state">Select a relationship to review its cardinality and join rule.</div>}</div></div>
        </section>}

        {tab === "usage" && <section className="catalog-section" aria-labelledby="usage-heading">
          <div className="section-intro"><div><div className="card-label">USAGE & REVIEW</div><h3 id="usage-heading">Consumers, recipes, and external proposals</h3></div><p>Usage documentation does not execute queries or change Ninox.</p></div>
          <div className="usage-grid"><div><h4>Known consumers <span>{tableConsumers.length}</span></h4>{tableConsumers.length ? tableConsumers.map((consumer) => <ConsumerCard key={consumer.id} consumer={consumer} />) : <div className="empty-state">No consumer has been documented for this table.</div>}<details className="catalog-editor"><summary>Add or update a consumer</summary><ConsumerForm tableId={selectedTable} /></details></div>
          <div><h4>External candidates <span>{tableCandidates.length}</span></h4>{tableCandidates.length ? tableCandidates.map((candidate) => <CandidateReview key={candidate.id} candidate={candidate} />) : <div className="empty-state">No mapped proposals for this table. Import only explicit Ninox IDs with <code>npm run catalog:import</code>.</div>}</div></div>
        </section>}
      </section>
    </section>
    <footer><span>Generated {data.generatedAt}</span><span>Local catalog · Ninox remains read only</span></footer>
  </main>;
}
