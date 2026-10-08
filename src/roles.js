export const roles = {
  reception: {
    name: 'Reception',
    department: 'reception',
    purpose: 'Capture incoming enquiries and route them for review.',
    permissions: ['Create enquiry records', 'Create reception tasks', 'Prepare customer message drafts', 'Route inbound communications'],
    boundaries: ['Cannot access sales queue before owner-approved handoff', 'Drafts are never sent by this workspace', 'Cannot promise outcomes or spend money', 'Cannot create campaigns or activate marketing']
  },
  marketing: {
    name: 'Marketing',
    department: 'marketing',
    purpose: 'Prepare and organize marketing work and qualify enquiries.',
    permissions: ['Create enquiry records', 'Move enquiries into marketing review', 'Request sales handoff', 'Create marketing tasks', 'Prepare customer message drafts', 'Draft and activate campaigns'],
    boundaries: ['Cannot publish or send campaigns', 'Cannot move a lead into Sales without owner approval', 'Drafts are never sent by this workspace', 'Cannot make customer offers or commitments or spend money']
  },
  sales: {
    name: 'Sales',
    department: 'sales',
    purpose: 'Work owner-approved sales handoffs and prepare proposed offers.',
    permissions: ['Work leads in the sales queue', 'Request offers, commitments, and customer outcome decisions', 'Create sales tasks', 'Prepare customer message drafts', 'Issue quotes'],
    boundaries: ['Cannot access unapproved marketing enquiries', 'Cannot make offers or commitments without owner approval', 'Drafts are never sent by this workspace', 'Cannot mark a lead won or lost without owner approval or spend money']
  },
  finance: {
    name: 'Finance & Accounting',
    department: 'finance',
    purpose: 'Prepare financial work and document proposed expenditure.',
    permissions: ['Create finance tasks', 'Request approval for a specified expense', 'Issue invoices', 'Record inbound payments', 'Record expenses'],
    boundaries: ['Cannot initiate a payment or incur a cost', 'Every positive amount requires owner approval', 'Cannot change approval records', 'VAT is not added unless a quote stated it']
  },
  technical: {
    name: 'Technical',
    department: 'technical',
    purpose: 'Track technical work and prepare proposed system changes.',
    permissions: ['Create technical tasks', 'Request approval for a production change', 'Open and update tickets'],
    boundaries: ['Cannot deploy or change production systems through this workspace', 'Cannot incur a cost', 'Cannot access customer or financial data']
  },
  operations: {
    name: 'Operations',
    department: 'operations',
    purpose: 'Coordinate internal work and maintain operational task status.',
    permissions: ['Create operations tasks', 'Coordinate cross-department work'],
    boundaries: ['Cannot spend money', 'Cannot make customer commitments or change approvals', 'Cannot access sales or marketing data']
  },
  administration: {
    name: 'Administration',
    department: 'administration',
    purpose: 'Prepare and organize administrative work.',
    permissions: ['Create administration tasks', 'Draft documents', 'Manage calendars and filing'],
    boundaries: ['Cannot spend money', 'Cannot make customer commitments or change approvals', 'Cannot access customer or financial data']
  },
  service: {
    name: 'Customer Service',
    department: 'service',
    purpose: 'Own the conversation after reception: status, faults, and complaints.',
    permissions: ['Draft replies', 'Open and update tickets', 'Escalate account risk'],
    boundaries: ['Cannot send replies (draft only)', 'Cannot sell, quote, spend, or concede a refund or cancellation', 'Cannot access sales pipeline']
  },
  compliance: {
    name: 'Compliance',
    department: 'governance',
    purpose: 'Runtime constitution, POPIA, and audit integrity. Holds veto on unlawful or off-role action.',
    permissions: ['Notify operator', 'Draft documents', 'Open tickets', 'Veto unlawful actions'],
    boundaries: ['Cannot spend money', 'Cannot make customer commitments', 'Cannot be overridden by other agents', 'Cannot execute external actions']
  },
  orchestrator: {
    name: 'Orchestrator',
    department: 'office',
    purpose: 'Coordinates the fleet, decomposes work, and never executes spend or sales itself.',
    permissions: ['Notify operator', 'Route inbound', 'Open tickets', 'Draft documents', 'Create leads'],
    boundaries: ['Cannot spend money', 'Cannot contact market directly', 'Cannot enter sales', 'Cannot issue invoices', 'Cannot halt fleet without founder approval']
  }
};

export const leadStages = ['enquiry', 'marketing_review', 'sales_queue', 'sales_working', 'customer', 'closed_lost'];
export const taskStatuses = ['open', 'in_progress', 'done'];
export const approvalKinds = {
  spend: 'Proposed spend',
  sales_handoff: 'Marketing to Sales handoff',
  customer_offer: 'Customer offer',
  customer_commitment: 'Customer commitment',
  customer_outcome: 'Customer outcome',
  customer_risk: 'At-risk customer action',
  production_change: 'Production change'
};

export function agentCanRequest(role, kind) {
  if (!roles[role] || !approvalKinds[kind]) return false;
  if (kind === 'spend') return true;
  if (kind === 'sales_handoff') return role === 'marketing';
  if (['customer_offer', 'customer_commitment', 'customer_outcome', 'customer_risk'].includes(kind)) return role === 'sales';
  if (kind === 'production_change') return role === 'technical';
  return false;
}

export const agentRoles = {
  vantage: { id: 'vantage', callsign: 'VANTAGE', title: 'Orchestrator', department: 'Office', role: 'orchestrator' },
  foyer: { id: 'foyer', callsign: 'FOYER', title: 'Reception', department: 'Front of house', role: 'reception' },
  signal: { id: 'signal', callsign: 'SIGNAL', title: 'Marketing', department: 'Marketing', role: 'marketing' },
  close: { id: 'close', callsign: 'CLOSE', title: 'Sales', department: 'Sales', role: 'sales' },
  ledger: { id: 'ledger', callsign: 'LEDGER', title: 'Accountant', department: 'Finance', role: 'finance' },
  forge: { id: 'forge', callsign: 'FORGE', title: 'Technical', department: 'Technical', role: 'technical' },
  keep: { id: 'keep', callsign: 'KEEP', title: 'Admin', department: 'Administration', role: 'administration' },
  desk: { id: 'desk', callsign: 'DESK', title: 'Customer service', department: 'Customer service', role: 'service' },
  seal: { id: 'seal', callsign: 'SEAL', title: 'Compliance', department: 'Governance', role: 'compliance' }
};