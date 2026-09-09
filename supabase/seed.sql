-- ==============================================================================
-- Sahayak — Demo & Initial Catalog Seed Data
-- Team DietCode · Build with Bharat 2.0
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schemes Catalog
-- ------------------------------------------------------------------------------
insert into public.schemes (id, name, category, jurisdiction, benefit, description, official_source, eligibility_status, last_verified)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'National Means-cum-Merit Scholarship',
    'Education',
    'Central',
    '₹12,000 / year',
    'Financial support for meritorious students continuing secondary education in government and aided schools.',
    'myScheme / Ministry of Education',
    'Active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'PM-KISAN Samman Nidhi',
    'Agriculture',
    'Central',
    '₹6,000 / year in 3 installments',
    'Income support scheme providing ₹6,000 per year directly into bank accounts of all landholding farmer families.',
    'PM Kisan Portal',
    'Active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'PM Awas Yojana (Urban)',
    'Housing',
    'Central',
    'Up to ₹2.67 Lakh subsidy',
    'Housing for all in urban areas through credit-linked interest subsidy and direct construction assistance.',
    'PMAY Portal',
    'Active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Atal Pension Yojana',
    'Employment & Pension',
    'Central',
    '₹1,000 - ₹5,000 / month guaranteed pension',
    'Guaranteed minimum pension for unorganized sector workers with government co-contribution.',
    'PFRDA / Jansuraksha',
    'Active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Sukanya Samriddhi Yojana',
    'Women & Child',
    'Central',
    'High interest tax-free savings for girl child',
    'Small deposit savings scheme targeted at building a fund for education and marriage expenses of girl children.',
    'India Post / RBI',
    'Active',
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  jurisdiction = excluded.jurisdiction,
  benefit = excluded.benefit,
  description = excluded.description,
  official_source = excluded.official_source,
  eligibility_status = excluded.eligibility_status;

-- ------------------------------------------------------------------------------
-- 2. Eligibility Rules
-- ------------------------------------------------------------------------------
delete from public.eligibility_rules where scheme_id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005'
);

insert into public.eligibility_rules (scheme_id, criterion_name, requirement, rule_type, evidence_source)
values
  -- NMMSS
  ('a0000000-0000-0000-0000-000000000001', 'Age', '14-18 years', 'numeric', 'Identity Document'),
  ('a0000000-0000-0000-0000-000000000001', 'Annual Household Income', 'Below ₹3,50,000', 'numeric', 'Income Certificate'),
  ('a0000000-0000-0000-0000-000000000001', 'School Enrollment', 'Enrolled in Government/Aided School', 'text', 'Enrollment Certificate'),

  -- PM-KISAN
  ('a0000000-0000-0000-0000-000000000002', 'Landholding', 'Cultivable land in family name', 'boolean', 'Land Records / RoR'),
  ('a0000000-0000-0000-0000-000000000002', 'Bank Account', 'Aadhaar-seeded active bank account', 'text', 'Bank Passbook'),

  -- PMAY-U
  ('a0000000-0000-0000-0000-000000000003', 'Pucca House Ownership', 'Must not own a pucca house anywhere in India', 'boolean', 'Self Declaration'),
  ('a0000000-0000-0000-0000-000000000003', 'Household Income', 'EWS: <= ₹3L, LIG: <= ₹6L, MIG: <= ₹18L', 'numeric', 'Income Certificate'),

  -- APY
  ('a0000000-0000-0000-0000-000000000004', 'Age at Entry', '18-40 years', 'numeric', 'Identity Document'),
  ('a0000000-0000-0000-0000-000000000004', 'Taxpayer Status', 'Not an income taxpayer under IT Act', 'boolean', 'PAN / Self Declaration'),

  -- Sukanya Samriddhi
  ('a0000000-0000-0000-0000-000000000005', 'Girl Child Age', 'Below 10 years at time of account opening', 'numeric', 'Birth Certificate'),
  ('a0000000-0000-0000-0000-000000000005', 'Citizenship', 'Resident Indian citizen', 'text', 'Aadhaar Card');

-- ------------------------------------------------------------------------------
-- 3. Document Requirements
-- ------------------------------------------------------------------------------
delete from public.document_requirements where scheme_id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005'
);

insert into public.document_requirements (scheme_id, document_type, is_mandatory)
values
  -- NMMSS
  ('a0000000-0000-0000-0000-000000000001', 'Aadhaar Card', true),
  ('a0000000-0000-0000-0000-000000000001', 'Income Certificate', true),
  ('a0000000-0000-0000-0000-000000000001', 'Enrollment Certificate', true),
  ('a0000000-0000-0000-0000-000000000001', 'Bank Passbook', true),

  -- PM-KISAN
  ('a0000000-0000-0000-0000-000000000002', 'Aadhaar Card', true),
  ('a0000000-0000-0000-0000-000000000002', 'Land Ownership Record (RoR)', true),
  ('a0000000-0000-0000-0000-000000000002', 'Bank Account Details', true),

  -- PMAY-U
  ('a0000000-0000-0000-0000-000000000003', 'Aadhaar Card', true),
  ('a0000000-0000-0000-0000-000000000003', 'Income Certificate', true),
  ('a0000000-0000-0000-0000-000000000003', 'Residence Proof', true),
  ('a0000000-0000-0000-0000-000000000003', 'Affidavit / Self Declaration', true),

  -- APY
  ('a0000000-0000-0000-0000-000000000004', 'Aadhaar Card', true),
  ('a0000000-0000-0000-0000-000000000004', 'Savings Bank Account Passbook', true),

  -- Sukanya Samriddhi
  ('a0000000-0000-0000-0000-000000000005', 'Birth Certificate of Girl Child', true),
  ('a0000000-0000-0000-0000-000000000005', 'Parent/Guardian Aadhaar Card', true),
  ('a0000000-0000-0000-0000-000000000005', 'Address Proof', true);
