import { DocType } from './enums';

export type FieldKind = 'text' | 'registration_no' | 'company_name' | 'date' | 'amount' | 'grade' | 'list';

export interface FieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
  /** Whether the extractor should always try to produce this field. */
  required: boolean;
  description: string;
}

export interface DocTypeDefinition {
  type: DocType;
  label: string;
  shortLabel: string;
  description: string;
  /** Whether this type carries a validity period that the expiry timeline should track. */
  hasExpiry: boolean;
  /** Whether a trust score considers this document at all. */
  scored: boolean;
  fields: FieldDefinition[];
}

const f = (
  key: string,
  label: string,
  kind: FieldKind,
  description: string,
  required = true,
): FieldDefinition => ({ key, label, kind, required, description });

export const COMMON_FIELD_KEYS = {
  companyName: 'company_name',
  registrationNo: 'registration_no',
  issuer: 'issuer',
  issueDate: 'issue_date',
  expiryDate: 'expiry_date',
  grade: 'grade',
  coverageAmount: 'coverage_amount',
  insuredParty: 'insured_party',
} as const;

export const DOC_TYPE_DEFINITIONS: Record<DocType, DocTypeDefinition> = {
  [DocType.SSM]: {
    type: DocType.SSM,
    label: 'SSM company registration',
    shortLabel: 'SSM',
    description: 'Suruhanjaya Syarikat Malaysia certificate of incorporation (Form 9 / Section 17) or e-Info company profile.',
    hasExpiry: false,
    scored: true,
    fields: [
      f('company_name', 'Company name', 'company_name', 'Registered company name exactly as printed'),
      f('registration_no', 'Registration number', 'registration_no', 'New 12-digit SSM number (e.g. 202001012345) and/or old number (e.g. 1234567-X)'),
      f('incorporation_date', 'Incorporation date', 'date', 'Date of incorporation'),
      f('registered_address', 'Registered address', 'text', 'Registered office address', false),
      f('company_status', 'Company status', 'text', 'e.g. EXISTING, ACTIVE', false),
      f('issuer', 'Issuer', 'text', 'Issuing authority (SSM)', false),
    ],
  },
  [DocType.CIDB]: {
    type: DocType.CIDB,
    label: 'CIDB registration certificate',
    shortLabel: 'CIDB',
    description: 'Construction Industry Development Board contractor registration certificate (Perakuan Pendaftaran Kontraktor).',
    hasExpiry: true,
    scored: true,
    fields: [
      f('company_name', 'Company name', 'company_name', 'Contractor name as printed'),
      f('cidb_registration_no', 'CIDB registration number', 'registration_no', 'CIDB contractor registration number'),
      f('registration_no', 'SSM registration number', 'registration_no', 'Company (SSM) registration number printed on the certificate'),
      f('grade', 'Grade', 'grade', 'Contractor grade G1 to G7'),
      f('categories', 'Categories', 'list', 'Registered categories and specialisations, e.g. B, CE, ME'),
      f('issue_date', 'Issue date', 'date', 'Date of issue / registration'),
      f('expiry_date', 'Expiry date', 'date', 'Valid until date'),
      f('issuer', 'Issuer', 'text', 'Issuing authority (CIDB)', false),
    ],
  },
  [DocType.PUBLIC_LIABILITY]: {
    type: DocType.PUBLIC_LIABILITY,
    label: 'Public liability insurance',
    shortLabel: 'Liability',
    description: 'Public liability insurance policy schedule or certificate.',
    hasExpiry: true,
    scored: true,
    fields: [
      f('issuer', 'Insurer', 'text', 'Insurance company name'),
      f('policy_no', 'Policy number', 'text', 'Policy number'),
      f('insured_party', 'Insured party', 'company_name', 'Name of the insured company'),
      f('company_name', 'Company name', 'company_name', 'Insured company name (same as insured party)'),
      f('coverage_amount', 'Limit of liability', 'amount', 'Limit of liability / sum insured in MYR'),
      f('issue_date', 'Period from', 'date', 'Start of the period of insurance'),
      f('expiry_date', 'Period to', 'date', 'End of the period of insurance'),
    ],
  },
  [DocType.WORKMEN_COMP]: {
    type: DocType.WORKMEN_COMP,
    label: "Workmen's compensation / SOCSO",
    shortLabel: 'SOCSO',
    description: "Workmen's compensation insurance or SOCSO (PERKESO) employer coverage certificate.",
    hasExpiry: true,
    scored: true,
    fields: [
      f('issuer', 'Issuer', 'text', 'Insurer or PERKESO'),
      f('policy_no', 'Policy / employer code', 'text', 'Policy number or SOCSO employer code'),
      f('company_name', 'Company name', 'company_name', 'Covered employer name'),
      f('insured_party', 'Insured party', 'company_name', 'Covered employer name', false),
      f('coverage_amount', 'Coverage amount', 'amount', 'Coverage amount in MYR, if stated', false),
      f('issue_date', 'Period from', 'date', 'Start of coverage'),
      f('expiry_date', 'Period to', 'date', 'End of coverage'),
    ],
  },
  [DocType.TAX_CLEARANCE]: {
    type: DocType.TAX_CLEARANCE,
    label: 'LHDN tax clearance',
    shortLabel: 'Tax',
    description: 'Lembaga Hasil Dalam Negeri tax clearance / tax compliance letter.',
    hasExpiry: true,
    scored: true,
    fields: [
      f('issuer', 'Issuer', 'text', 'Issuing authority (LHDN)'),
      f('company_name', 'Company name', 'company_name', 'Taxpayer company name'),
      f('tax_reference_no', 'Tax reference number', 'text', 'Income tax reference number (e.g. C 1234567890)'),
      f('registration_no', 'SSM registration number', 'registration_no', 'Company registration number, if printed', false),
      f('issue_date', 'Issue date', 'date', 'Date of the letter'),
      f('expiry_date', 'Valid until', 'date', 'Validity end date, if stated', false),
    ],
  },
  [DocType.BANK_REFERENCE]: {
    type: DocType.BANK_REFERENCE,
    label: 'Bank reference letter',
    shortLabel: 'Bank',
    description: "Bank reference / banker's confirmation letter.",
    hasExpiry: false,
    scored: true,
    fields: [
      f('issuer', 'Bank', 'text', 'Issuing bank'),
      f('company_name', 'Company name', 'company_name', 'Account holder company name'),
      f('registration_no', 'SSM registration number', 'registration_no', 'Company registration number, if printed', false),
      f('account_since', 'Account since', 'date', 'Date the account was opened', false),
      f('conduct', 'Account conduct', 'text', 'Bank\'s description of the account conduct, e.g. satisfactory', false),
      f('issue_date', 'Issue date', 'date', 'Date of the letter'),
    ],
  },
  [DocType.ISO]: {
    type: DocType.ISO,
    label: 'ISO / quality certificate',
    shortLabel: 'ISO',
    description: 'ISO 9001 / 14001 / 45001 or other management system certificate.',
    hasExpiry: true,
    scored: true,
    fields: [
      f('issuer', 'Certification body', 'text', 'Issuing certification body'),
      f('company_name', 'Company name', 'company_name', 'Certified organisation name'),
      f('standard', 'Standard', 'text', 'Standard, e.g. ISO 9001:2015'),
      f('certificate_no', 'Certificate number', 'text', 'Certificate number'),
      f('scope', 'Scope', 'text', 'Scope of certification', false),
      f('issue_date', 'Issue date', 'date', 'Date of issue'),
      f('expiry_date', 'Expiry date', 'date', 'Valid until date'),
    ],
  },
  [DocType.OTHER]: {
    type: DocType.OTHER,
    label: 'Other document',
    shortLabel: 'Other',
    description: 'Any other document. Kept on file, not scored.',
    hasExpiry: false,
    scored: false,
    fields: [
      f('title', 'Title', 'text', 'Document title or a one-line description', false),
      f('company_name', 'Company name', 'company_name', 'Company name if printed', false),
      f('issue_date', 'Date', 'date', 'Document date if printed', false),
    ],
  },
};

export const DOC_TYPES: DocType[] = Object.values(DocType);

export const SCORED_DOC_TYPES: DocType[] = DOC_TYPES.filter((t) => DOC_TYPE_DEFINITIONS[t].scored);

export const DEFAULT_REQUIRED_DOC_TYPES: DocType[] = [
  DocType.SSM,
  DocType.CIDB,
  DocType.PUBLIC_LIABILITY,
  DocType.WORKMEN_COMP,
  DocType.TAX_CLEARANCE,
];

export function docTypeLabel(type: DocType | string): string {
  return DOC_TYPE_DEFINITIONS[type as DocType]?.label ?? String(type);
}

export function fieldLabel(docType: DocType | string, key: string): string {
  const def = DOC_TYPE_DEFINITIONS[docType as DocType];
  return def?.fields.find((x) => x.key === key)?.label ?? key.replace(/_/g, ' ');
}
