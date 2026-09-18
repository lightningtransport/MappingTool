"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  exportCatalogAction,
  reviewCandidateAction,
  saveConsumerAction,
  saveFieldReviewAction,
  saveRelationshipReviewAction,
  saveTableReviewAction,
} from "./catalog-actions.js";
import type { CatalogActionState } from "./catalog-actions.js";
import { candidatePrimaryText, defaultFieldReview, defaultRelationshipReview, defaultTableReview } from "../src/catalog/review.js";
import type { ConsumerUsage, FieldReview, ImportCandidate, RelationshipReview, TableReview } from "../src/catalog/types.js";

const initialCatalogActionState: CatalogActionState = { status: "idle", message: "" };

function SubmitButton({ children = "Save review", tone = "primary" }: { children?: string; tone?: "primary" | "quiet" | "danger" }) {
  const { pending } = useFormStatus();
  return <button className={`catalog-submit ${tone}`} type="submit" disabled={pending}>{pending ? "Saving…" : children}</button>;
}

function Feedback({ status, message }: { status: string; message: string }) {
  return message ? <p className={`catalog-feedback ${status}`} role="status">{message}</p> : null;
}

function split(values: string[]): string { return values.join("\n"); }

export function TableReviewForm({ tableId, review, fieldIds }: { tableId: string; review?: TableReview; fieldIds: string[] }) {
  const [state, formAction] = useActionState(saveTableReviewAction, initialCatalogActionState);
  const value = review ?? defaultTableReview(tableId);
  return <form action={formAction} className="catalog-form">
    <input type="hidden" name="tableId" value={tableId} />
    <label className="wide">Description<textarea name="description" defaultValue={value.description} placeholder="What this table represents and why it exists." /></label>
    <label>Status<select name="status" defaultValue={value.status}><option value="unknown">Unknown</option><option value="active">Active</option><option value="obsolete">Obsolete</option><option value="temporary">Temporary</option><option value="duplicate">Duplicate</option><option value="merge-candidate">Merge candidate</option></select></label>
    <label>Criticality<select name="criticality" defaultValue={value.criticality}><option value="unknown">Unknown</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    <label className="wide">Row grain<input name="grain" defaultValue={value.grain} placeholder="One row per…" /></label>
    <label>Business key field IDs<input name="businessKeyFieldIds" defaultValue={split(value.businessKeyFieldIds)} placeholder={fieldIds.slice(0, 4).join(", ") || "A, B"} /></label>
    <label>Tags<input name="tags" defaultValue={split(value.tags)} placeholder="fleet, finance" /></label>
    <label>Use for<textarea name="useFor" defaultValue={split(value.useFor)} placeholder="One approved use per line" /></label>
    <label>Do not use for<textarea name="doNotUseFor" defaultValue={split(value.doNotUseFor)} placeholder="One limitation per line" /></label>
    <label className="wide">Review notes<textarea name="notes" defaultValue={value.notes} placeholder="Human context, caveats, or follow-up questions." /></label>
    <div className="catalog-form-actions wide"><SubmitButton /><Feedback {...state} /></div>
  </form>;
}

export function FieldReviewForm({ tableId, fieldId, fieldName, review }: { tableId: string; fieldId: string; fieldName: string; review?: FieldReview }) {
  const [state, formAction] = useActionState(saveFieldReviewAction, initialCatalogActionState);
  const value = review ?? defaultFieldReview(tableId, fieldId);
  return <form action={formAction} className="catalog-form field-review-form">
    <input type="hidden" name="tableId" value={tableId} /><input type="hidden" name="fieldId" value={fieldId} />
    <div className="wide review-form-title"><div><span>FIELD REVIEW</span><strong>{fieldName}</strong></div><code>{tableId}.{fieldId}</code></div>
    <label className="wide">Meaning<textarea name="description" defaultValue={value.description} placeholder="Business meaning of this field." /></label>
    <label>Role<select name="role" defaultValue={value.role}><option value="unknown">Unknown</option><option value="business-key">Business key</option><option value="dimension">Dimension</option><option value="measure">Measure</option><option value="status">Status</option><option value="date">Date</option><option value="reference">Reference</option><option value="sensitive">Sensitive</option></select></label>
    <label>Criticality<select name="criticality" defaultValue={value.criticality}><option value="unknown">Unknown</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    <label className="checkbox-label"><input type="checkbox" name="sensitive" defaultChecked={value.sensitive} /> Sensitive field</label>
    <label className="wide">Safe use<input name="safeUse" defaultValue={value.safeUse} placeholder="How builders should use or join this field." /></label>
    <label className="wide">Notes<textarea name="notes" defaultValue={value.notes} /></label>
    <div className="catalog-form-actions wide"><SubmitButton /><Feedback {...state} /></div>
  </form>;
}

export function RelationshipReviewForm({ review, identity }: { review?: RelationshipReview; identity: { sourceTableId: string; sourceFieldId: string; targetTableId: string } }) {
  const [state, formAction] = useActionState(saveRelationshipReviewAction, initialCatalogActionState);
  const value = review ?? defaultRelationshipReview(identity.sourceTableId, identity.sourceFieldId, identity.targetTableId);
  return <form action={formAction} className="catalog-form relationship-review-form">
    <input type="hidden" name="sourceTableId" value={identity.sourceTableId} /><input type="hidden" name="sourceFieldId" value={identity.sourceFieldId} /><input type="hidden" name="targetTableId" value={identity.targetTableId} />
    <label>Decision<select name="decision" defaultValue={value.decision}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select></label>
    <label>Cardinality<select name="cardinality" defaultValue={value.cardinality}><option value="unknown">Unknown</option><option value="one-to-one">One to one</option><option value="one-to-many">One to many</option><option value="many-to-one">Many to one</option><option value="many-to-many">Many to many</option></select></label>
    <label className="wide">Join rule<input name="joinRule" defaultValue={value.joinRule} placeholder="Document normalization or join constraints." /></label>
    <label className="wide">Notes<textarea name="notes" defaultValue={value.notes} /></label>
    <div className="catalog-form-actions wide"><SubmitButton /><Feedback {...state} /></div>
  </form>;
}

export function ConsumerForm({ tableId }: { tableId: string }) {
  const [state, formAction] = useActionState(saveConsumerAction, initialCatalogActionState);
  return <form action={formAction} className="catalog-form consumer-form">
    <label>Consumer ID<input name="id" placeholder="settlement-dashboard" required /></label>
    <label>Name<input name="name" placeholder="Settlement dashboard" required /></label>
    <label>Kind<select name="kind" defaultValue="app"><option value="app">App</option><option value="report">Report</option><option value="api">API</option><option value="job">Job</option></select></label>
    <label className="wide">Purpose<textarea name="purpose" placeholder="What this consumer reads and why." /></label>
    <label>Table IDs<input name="tableIds" defaultValue={tableId} /></label>
    <label>Field keys<input name="fieldKeys" placeholder={`${tableId}:A`} /></label>
    <label>Filters<textarea name="filters" placeholder="One filter per line" /></label>
    <label>Joins<textarea name="joins" placeholder="One join rule per line" /></label>
    <label className="wide">Freshness limitations<textarea name="freshnessLimitations" placeholder="Known sync or recency limitations." /></label>
    <div className="catalog-form-actions wide"><SubmitButton>Save consumer</SubmitButton><Feedback {...state} /></div>
  </form>;
}

export function CandidateReview({ candidate }: { candidate: ImportCandidate }) {
  const [state, formAction] = useActionState(reviewCandidateAction, initialCatalogActionState);
  const primary = candidatePrimaryText(candidate);
  return <form action={formAction} className={`candidate-card ${candidate.decision}`}>
    <input type="hidden" name="candidateId" value={candidate.id} />
    <div className="candidate-heading"><span className="knowledge-badge external">External candidate</span><code>{candidate.kind}{candidate.fieldId ? ` · ${candidate.tableId}.${candidate.fieldId}` : ` · ${candidate.tableId}`}</code></div>
    <label>Review before accepting<textarea name="overrideDescription" defaultValue={primary} /></label>
    <p>{candidate.provenance.sourceLabel} · schema {candidate.provenance.sourceVersion ?? "Unknown"} · verified {candidate.provenance.verifiedAt ?? "Unknown"}</p>
    <div className="candidate-actions"><button name="decision" value="accepted" type="submit">Accept candidate</button><button className="reject" name="decision" value="rejected" type="submit">Reject</button><span>{candidate.decision}</span></div>
    <Feedback {...state} />
  </form>;
}

export function ConsumerCard({ consumer }: { consumer: ConsumerUsage }) {
  return <article className="consumer-card"><div><span className="knowledge-badge reviewed">Human reviewed</span><code>{consumer.kind}</code></div><h4>{consumer.name}</h4><p>{consumer.purpose || "Purpose Unknown"}</p><dl><div><dt>Tables</dt><dd>{consumer.tableIds.join(", ") || "Unknown"}</dd></div><div><dt>Filters</dt><dd>{consumer.filters.join(" · ") || "Unknown"}</dd></div><div><dt>Joins</dt><dd>{consumer.joins.join(" · ") || "Unknown"}</dd></div><div><dt>Freshness</dt><dd>{consumer.freshnessLimitations.join(" · ") || "Unknown"}</dd></div></dl></article>;
}

export function ExportCatalogControl() {
  const [state, formAction] = useActionState(exportCatalogAction, initialCatalogActionState);
  return <form action={formAction} className="export-control"><SubmitButton tone="quiet">Export safe catalog</SubmitButton><Feedback {...state} /></form>;
}
