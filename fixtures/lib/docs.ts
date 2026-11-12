import path from 'node:path';
import { DocType, type ExtractionRecording } from '@vp/shared';
import { rgb } from 'pdf-lib';
import type { Company } from './companies';
import { RelDate, rel } from './common';
import { A4, GREEN, GREY, INK, LIGHT, MAROON, NAVY, PdfBuilder } from './pdf';
import { SCAN, ScanBuilder } from './scan';

export interface Generated {
  filePath: string;
  recording: ExtractionRecording;
  pageCount: number;
}

const toLongDate = (d: RelDate) => d.with('d MMMM yyyy');

/* ------------------------------------------------------------------ SSM Form 9 / Section 17 */
export async function ssmCertificate(outDir: string, fileName: string, co: Company): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.SSM, 0.97, 'SSM certificate of incorporation header, company number and Registrar signature block').init();
  b.rect(30, 30, A4.width - 60, A4.height - 60, { stroke: NAVY, lineWidth: 1.6 });
  b.rect(36, 36, A4.width - 72, A4.height - 72, { stroke: NAVY, lineWidth: 0.6 });
  const cx = A4.width / 2;
  const centered = (s: string, y: number, size: number, font: 'sans' | 'sansBold' | 'serif' | 'serifBold' = 'serif', color = INK) =>
    b.text(s, cx - b.textWidth(s, size, font) / 2, y, { size, font, color });

  const issuerBox = centered('SURUHANJAYA SYARIKAT MALAYSIA', 70, 13, 'sansBold', NAVY);
  b.rec.add('issuer', 'SURUHANJAYA SYARIKAT MALAYSIA', issuerBox, 0.9);
  centered('(COMPANIES COMMISSION OF MALAYSIA)', 88, 9, 'sans', GREY);
  centered('AKTA SYARIKAT 2016 / COMPANIES ACT 2016', 118, 10, 'serif');
  centered('Seksyen 17 / Section 17', 133, 10, 'serif');
  centered('PERAKUAN PEMERBADANAN SYARIKAT PERSENDIRIAN', 168, 14, 'serifBold');
  centered('CERTIFICATE OF INCORPORATION OF PRIVATE COMPANY', 188, 12, 'serifBold');
  b.line(120, 212, A4.width - 120, 212, { color: NAVY, width: 0.8 });

  centered('Adalah dengan ini diperakui bahawa / This is to certify that', 250, 10, 'serif');
  const nameBox = centered(co.name.toUpperCase(), 280, 18, 'serifBold');
  b.rec.add('company_name', co.name.toUpperCase(), nameBox, 0.98);

  centered('No. Syarikat / Company No.', 320, 9, 'sans', GREY);
  const regText = `${co.newNo} (${co.oldNo})`;
  const regBox = centered(regText, 334, 13, 'sansBold');
  b.rec.add('registration_no', regText, regBox, 0.97);

  let y = b.paragraph(
    'telah diperbadankan di bawah Akta Syarikat 2016 pada / was incorporated under the Companies Act 2016 on',
    90,
    372,
    A4.width - 180,
    { size: 10, font: 'serif' },
  );
  const dateBox = centered(co.incorporated, y + 4, 13, 'sansBold');
  b.rec.add('incorporation_date', co.incorporated, dateBox, 0.96);
  y = b.paragraph(
    'dan bahawa syarikat ini adalah sebuah syarikat persendirian berhad menurut syer. / and that the company is a private company limited by shares.',
    90,
    y + 32,
    A4.width - 180,
    { size: 10, font: 'serif' },
  );

  b.text('Alamat Berdaftar / Registered Address:', 90, y + 30, { size: 9, color: GREY });
  const addrLines = co.addressLines;
  const first = b.text(addrLines[0], 90, y + 44, { size: 10 });
  addrLines.slice(1).forEach((l, i) => b.text(l, 90, y + 58 + i * 14, { size: 10 }));
  const addrBox = { x: first.x, y: first.y, width: 0.5, height: (addrLines.length * 14) / A4.height };
  b.rec.add('registered_address', addrLines.join(', '), addrBox, 0.91);

  const statusBox = b.labelValue('Status Syarikat / Company Status:', 'EXISTING', 90, y + 110, 270, { size: 10, font: 'sansBold', color: GREEN });
  b.rec.add('company_status', 'EXISTING', statusBox, 0.94);

  b.text('Diberikan di bawah tandatangan dan meterai saya di Kuala Lumpur.', 90, 600, { size: 9, font: 'serif' });
  b.text('Given under my hand and seal at Kuala Lumpur.', 90, 613, { size: 9, font: 'serif', color: GREY });
  b.line(330, 690, 520, 690, { width: 0.6 });
  b.text('Pendaftar Syarikat / Registrar of Companies', 330, 695, { size: 8, color: GREY });
  b.text('Suruhanjaya Syarikat Malaysia', 330, 706, { size: 8, color: GREY });
  b.stamp(150, 680, ['SSM', 'REGISTRAR', 'KUALA LUMPUR'], NAVY);
  b.text(`Dokumen ini dijana secara elektronik. Rujukan: SSM/${co.newNo}/S17`, 90, 770, { size: 7, color: GREY });
  b.text('FICTIONAL DEMO DOCUMENT - NOT A REAL CERTIFICATE', 90, 782, { size: 7, color: MAROON });

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ SSM e-Info profile (2 pages) */
export async function ssmEInfoProfile(outDir: string, fileName: string, co: Company, printedOn: RelDate): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.SSM, 0.93, 'SSM e-Info company profile printout with registration particulars and directors').init();
  let y = b.letterhead('SSM e-Info', ['Suruhanjaya Syarikat Malaysia - Companies Commission of Malaysia', 'Company Profile (Maklumat Syarikat)'], NAVY);
  b.rec.add('issuer', 'Suruhanjaya Syarikat Malaysia', { x: 80 / A4.width, y: 56 / A4.height, width: 0.45, height: 11 / A4.height }, 0.88);
  b.text('COMPANY PROFILE', 40, y, { size: 14, font: 'sansBold' });
  b.text(`Printed on ${printedOn.printed}`, A4.width - 40, y + 3, { size: 8, color: GREY, alignRight: true });
  y += 30;

  b.text('A. REGISTRATION PARTICULARS', 40, y, { size: 10, font: 'sansBold', color: NAVY });
  y += 18;
  const rows: Array<[string, string]> = [
    ['Company Name', co.name.toUpperCase()],
    ['Registration No.', `${co.newNo} (${co.oldNo})`],
    ['Date of Incorporation', co.incorporated],
    ['Company Type', 'Private Limited Company (Sdn. Bhd.)'],
    ['Company Status', 'EXISTING'],
    ['Registered Address', co.addressLines.join(', ')],
    ['Business Address', co.addressLines.join(', ')],
    ['Nature of Business', co.businessNature],
  ];
  const t = b.table(40, y, [150, A4.width - 80 - 150], rows, { header: false, size: 8.5, rowHeight: 22 });
  b.rec.add('company_name', co.name.toUpperCase(), t.cell(0, 1), 0.97);
  b.rec.add('registration_no', `${co.newNo} (${co.oldNo})`, t.cell(1, 1), 0.96);
  b.rec.add('incorporation_date', co.incorporated, t.cell(2, 1), 0.95);
  b.rec.add('company_status', 'EXISTING', t.cell(4, 1), 0.93);
  b.rec.add('registered_address', co.addressLines.join(', '), t.cell(5, 1), 0.9);
  y = t.bottom + 24;

  b.text('B. SHARE CAPITAL', 40, y, { size: 10, font: 'sansBold', color: NAVY });
  y += 18;
  const cap = b.table(40, y, [150, 180, 185], [
    ['Type', 'Issued (RM)', 'Paid-up (RM)'],
    ['Ordinary', '1,000,000.00', '1,000,000.00'],
  ], { size: 9 });
  y = cap.bottom + 24;
  b.text('Continued on next page.', 40, y, { size: 8, color: GREY });
  b.footer(`SSM e-Info | ${co.name} | Fictional demo document generated for Vendor Passport`);

  b.addPage();
  y = b.letterhead('SSM e-Info', ['Suruhanjaya Syarikat Malaysia - Companies Commission of Malaysia', 'Company Profile (Maklumat Syarikat)'], NAVY);
  b.text('C. DIRECTORS', 40, y, { size: 10, font: 'sansBold', color: NAVY });
  y += 18;
  const dir = b.table(40, y, [40, 255, 110, 110], [
    ['No.', 'Name', 'Designation', 'Appointed'],
    ...co.directors.map((d, i) => [String(i + 1), d.name, 'Director', d.since]),
  ], { size: 9 });
  y = dir.bottom + 24;
  b.text('D. COMPANY SECRETARY', 40, y, { size: 10, font: 'sansBold', color: NAVY });
  y += 18;
  const sec = b.table(40, y, [255, 260], [
    ['Name', 'Licence No.'],
    ['Setiausaha Prima Sdn Bhd', 'LS 0009876'],
  ], { size: 9 });
  y = sec.bottom + 24;
  b.text('E. ANNUAL RETURN', 40, y, { size: 10, font: 'sansBold', color: NAVY });
  y += 18;
  b.table(40, y, [255, 260], [
    ['Last annual return lodged', rel(-120, 'dd/MM/yyyy').printed],
    ['Last financial statements lodged', rel(-150, 'dd/MM/yyyy').printed],
  ], { header: false, size: 9 });
  b.text('The information above is extracted from the SSM register as at the printing date. FICTIONAL DEMO DOCUMENT.', 40, 760, { size: 7, color: GREY });
  b.footer(`SSM e-Info | ${co.name} | Fictional demo document generated for Vendor Passport`);

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ CIDB certificate */
export async function cidbCertificate(outDir: string, fileName: string, co: Company, issue: RelDate, expiry: RelDate): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.CIDB, 0.96, 'CIDB "Perakuan Pendaftaran Kontraktor" with grade and category table').init();
  b.rect(28, 28, A4.width - 56, A4.height - 56, { stroke: GREEN, lineWidth: 2 });
  b.rect(34, 34, A4.width - 68, A4.height - 68, { stroke: GREEN, lineWidth: 0.5 });
  const cx = A4.width / 2;
  const centered = (s: string, y: number, size: number, font: 'sans' | 'sansBold' | 'serif' | 'serifBold' = 'sans', color = INK) =>
    b.text(s, cx - b.textWidth(s, size, font) / 2, y, { size, font, color });
  b.rect(cx - 16, 56, 32, 32, { fill: GREEN });
  b.rect(cx - 9, 63, 18, 18, { fill: rgb(1, 1, 1) });
  const issuerBox = centered('LEMBAGA PEMBANGUNAN INDUSTRI PEMBINAAN MALAYSIA', 100, 11, 'sansBold', GREEN);
  centered('CONSTRUCTION INDUSTRY DEVELOPMENT BOARD MALAYSIA (CIDB)', 116, 9, 'sans', GREY);
  b.rec.add('issuer', 'LEMBAGA PEMBANGUNAN INDUSTRI PEMBINAAN MALAYSIA', issuerBox, 0.92);
  centered('PERAKUAN PENDAFTARAN KONTRAKTOR', 150, 16, 'serifBold');
  centered('CERTIFICATE OF CONTRACTOR REGISTRATION', 172, 11, 'serif');
  centered('Akta Lembaga Pembangunan Industri Pembinaan Malaysia 1994 (Akta 520)', 190, 8, 'sans', GREY);

  let y = 230;
  const labelX = 70;
  const valueX = 250;
  const row = (label: string, value: string, bold = true, size = 11) => {
    const box = b.labelValue(label, value, labelX, y, valueX, { size, font: bold ? 'sansBold' : 'sans' }, { size: 9 });
    y += 26;
    return box;
  };
  const cidbBox = row('No. Pendaftaran / Registration No.', co.cidbNo);
  b.rec.add('cidb_registration_no', co.cidbNo, cidbBox, 0.95);
  const nameBox = row('Nama Kontraktor / Contractor', co.name.toUpperCase());
  b.rec.add('company_name', co.name.toUpperCase(), nameBox, 0.97);
  const ssmBox = row('No. Syarikat (SSM) / Company No.', co.newNo);
  b.rec.add('registration_no', co.newNo, ssmBox, 0.94);
  b.text('Alamat / Address', labelX, y, { size: 9, color: GREY });
  co.addressLines.forEach((l, i) => b.text(l, valueX, y + i * 13, { size: 10 }));
  y += co.addressLines.length * 13 + 16;

  b.rect(labelX, y, 150, 60, { fill: rgb(0.93, 0.97, 0.94), stroke: GREEN });
  b.text('GRED / GRADE', labelX + 10, y + 8, { size: 8, color: GREY });
  const gradeBox = b.text(co.grade, labelX + 10, y + 22, { size: 26, font: 'sansBold', color: GREEN });
  b.rec.add('grade', co.grade, gradeBox, 0.98);
  b.text('Kategori & Pengkhususan / Categories & Specialisations', valueX, y, { size: 9, color: GREY });
  const cats = co.categories.split(',').map((c) => c.trim());
  const catLabels: Record<string, string> = { B: 'Building construction', CE: 'Civil engineering construction', ME: 'Mechanical & electrical' };
  const catTable = b.table(valueX, y + 14, [60, 215], [['Kod', 'Keterangan'], ...cats.map((c) => [c, catLabels[c] ?? c])], { size: 9, rowHeight: 16 });
  const catBox = { x: catTable.cell(1, 0).x, y: catTable.cell(1, 0).y, width: 60 / A4.width, height: (cats.length * 16) / A4.height };
  b.rec.add('categories', co.categories, catBox, 0.9);
  y = Math.max(y + 70, catTable.bottom + 16);

  const issueBox = row('Tarikh Daftar / Date of Registration', issue.printed, true, 11);
  b.rec.add('issue_date', issue, issueBox, 0.95);
  const expiryBox = row('Tarikh Tamat / Expiry Date', expiry.printed, true, 11);
  b.rec.add('expiry_date', expiry, expiryBox, 0.96);

  b.stamp(140, 680, ['CIDB', 'MALAYSIA', 'BERDAFTAR'], GREEN);
  b.line(330, 690, 520, 690, { width: 0.6 });
  b.text('Ketua Eksekutif / Chief Executive', 330, 695, { size: 8, color: GREY });
  b.text('Lembaga Pembangunan Industri Pembinaan Malaysia', 330, 706, { size: 8, color: GREY });
  b.text('Perakuan ini tidak boleh dipindah milik. Sah hanya dengan cop rasmi CIDB. FICTIONAL DEMO DOCUMENT.', 60, 775, { size: 7, color: GREY });

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ Public liability schedule */
export interface LiabilityOpts {
  insurer: string;
  policyNo: string;
  insuredParty: string;
  address: string[];
  limit: string; // printed amount e.g. "RM 2,000,000.00"
  from: RelDate;
  to: RelDate;
  premium: string;
}

/** Scanned (JPEG) policy schedule. */
export async function liabilityScheduleScan(outDir: string, fileName: string, o: LiabilityOpts, seed: number): Promise<Generated> {
  const s = new ScanBuilder(fileName, DocType.PUBLIC_LIABILITY, 0.94, 'Scanned public liability policy schedule with limit of liability and period of insurance', seed);
  s.rect(90, 80, 70, 70, { fill: '#2b3a67' });
  s.rect(105, 95, 40, 40, { fill: '#faf8f3' });
  const insurerBox = s.text(o.insurer.toUpperCase(), 180, 82, { size: 40, weight: 'bold', color: '#2b3a67' });
  s.rec.add('issuer', o.insurer.toUpperCase(), insurerBox, 0.93);
  s.text('Licensed general insurer | Menara Perisai, Jalan Ampang, 50450 Kuala Lumpur', 180, 132, { size: 20, color: '#55555a' });
  s.line(90, 180, SCAN.width - 90, 180, { color: '#2b3a67', width: 4 });
  s.text('PUBLIC LIABILITY INSURANCE', 90, 220, { size: 44, weight: 'bold' });
  s.text('POLICY SCHEDULE', 90, 275, { size: 34, weight: 'bold', color: '#55555a' });

  let y = 360;
  const labelX = 90;
  const valueX = 520;
  const row = (label: string, value: string | RelDate, opts: Parameters<ScanBuilder['text']>[3] = {}) => {
    const box = s.labelValue(label, value, labelX, y, valueX, { size: 28, weight: 'bold', ...opts });
    s.line(labelX, y + 44, SCAN.width - 90, y + 44, { color: '#d9d4c7', width: 2 });
    y += 62;
    return box;
  };
  const policyBox = row('Policy No.', o.policyNo);
  s.rec.add('policy_no', o.policyNo, policyBox, 0.96);
  const insuredBox = row('The Insured', o.insuredParty.toUpperCase());
  s.rec.add('insured_party', o.insuredParty.toUpperCase(), insuredBox, 0.95);
  s.rec.alias('insured_party', 'company_name', 0.93);
  s.text('Address of the Insured', labelX, y, { size: 26, color: '#55555a' });
  o.address.forEach((l, i) => s.text(l, valueX, y + i * 34, { size: 26 }));
  y += o.address.length * 34 + 30;
  row('Business', 'Building and civil engineering contractors', { size: 26, weight: 'normal' });
  const fromBox = row('Period of Insurance - From', o.from.printed);
  s.rec.add('issue_date', o.from, fromBox, 0.94);
  const toBox = row('Period of Insurance - To', o.to.printed);
  s.rec.add('expiry_date', o.to, toBox, 0.95);
  s.text('(both dates inclusive, Malaysian time)', valueX, y - 20, { size: 20, color: '#55555a' });
  y += 20;
  s.rect(labelX, y, SCAN.width - 180, 110, { fill: '#eef1f7', stroke: '#2b3a67', strokeWidth: 3 });
  s.text('Limit of Liability (any one occurrence and in the aggregate)', labelX + 20, y + 16, { size: 24, color: '#2b3a67' });
  const limitBox = s.text(o.limit, labelX + 20, y + 52, { size: 40, weight: 'bold' });
  s.rec.add('coverage_amount', o.limit, limitBox, 0.96);
  y += 150;
  row('Annual Premium', o.premium, { size: 26, weight: 'normal' });
  row('Territorial Limits', 'Malaysia', { size: 26, weight: 'normal' });
  row('Jurisdiction', 'Courts of Malaysia', { size: 26, weight: 'normal' });

  s.text('Subject otherwise to the terms, exceptions and conditions of the Policy. This schedule forms part of the Policy.', labelX, y + 20, { size: 20, color: '#55555a' });
  s.stamp(980, 1470, ['ORIGINAL', o.insurer.split(' ')[0].toUpperCase(), 'KUALA LUMPUR']);
  s.signature(140, 1540);
  s.line(120, 1560, 480, 1560, { color: '#1b1b1f', width: 2 });
  s.text('Authorised Signatory', 120, 1572, { size: 20, color: '#55555a' });
  s.text('FICTIONAL DEMO DOCUMENT - NOT A REAL POLICY', 90, 1680, { size: 18, color: '#8b1e26' });

  const filePath = path.join(outDir, fileName);
  await s.save(filePath, 'jpeg');
  return { filePath, recording: s.rec.build(), pageCount: 1 };
}

/** PDF version of the policy schedule (clean supplier). */
export async function liabilitySchedulePdf(outDir: string, fileName: string, o: LiabilityOpts): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.PUBLIC_LIABILITY, 0.96, 'Public liability policy schedule with limit of liability and period of insurance').init();
  let y = b.letterhead(o.insurer, ['Licensed general insurer | Wisma Amanah, Jalan Tun Razak, 50400 Kuala Lumpur', 'Customer service 1-300-00-0000'], NAVY);
  b.rec.add('issuer', o.insurer, { x: 80 / A4.width, y: 36 / A4.height, width: b.textWidth(o.insurer, 15, 'sansBold') / A4.width, height: 17 / A4.height }, 0.94);
  b.text('PUBLIC LIABILITY INSURANCE - POLICY SCHEDULE', 40, y, { size: 14, font: 'sansBold' });
  y += 30;
  const rows: Array<[string, string]> = [
    ['Policy No.', o.policyNo],
    ['The Insured', o.insuredParty.toUpperCase()],
    ['Address of the Insured', o.address.join(', ')],
    ['Business', 'Building and civil engineering contractors'],
    ['Period of Insurance - From', o.from.printed],
    ['Period of Insurance - To', o.to.printed],
    ['Limit of Liability', o.limit],
    ['Annual Premium', o.premium],
    ['Territorial Limits', 'Malaysia'],
  ];
  const t = b.table(40, y, [170, A4.width - 80 - 170], rows, { header: false, size: 10, rowHeight: 24 });
  b.rec.add('policy_no', o.policyNo, t.cell(0, 1), 0.97);
  b.rec.add('insured_party', o.insuredParty.toUpperCase(), t.cell(1, 1), 0.97);
  b.rec.alias('insured_party', 'company_name', 0.95);
  b.rec.add('issue_date', o.from, t.cell(4, 1), 0.96);
  b.rec.add('expiry_date', o.to, t.cell(5, 1), 0.97);
  b.rec.add('coverage_amount', o.limit, t.cell(6, 1), 0.97);
  y = t.bottom + 30;
  y = b.paragraph(
    'Subject otherwise to the terms, exceptions and conditions of the Policy. This schedule forms part of the Policy and should be read together with the policy wording and any endorsements.',
    40,
    y,
    A4.width - 80,
    { size: 9, color: GREY },
  );
  b.stamp(470, 640, ['ORIGINAL', o.insurer.split(' ')[0].toUpperCase(), 'KUALA LUMPUR']);
  b.line(40, 680, 220, 680, { width: 0.6 });
  b.text('Authorised Signatory', 40, 685, { size: 8, color: GREY });
  b.footer(`${o.insurer} | ${o.policyNo} | FICTIONAL DEMO DOCUMENT - NOT A REAL POLICY`);
  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ SOCSO / PERKESO coverage */
export async function socsoCertificate(
  outDir: string,
  fileName: string,
  co: Company,
  from: RelDate,
  to: RelDate,
  coverage: { amount: string; confidence: number; faint: boolean },
  employees: number,
): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.WORKMEN_COMP, 0.92, 'PERKESO employer coverage certificate (Sijil Perlindungan Majikan) with coverage period').init();
  b.rect(30, 30, A4.width - 60, A4.height - 60, { stroke: MAROON, lineWidth: 1.4 });
  const cx = A4.width / 2;
  const centered = (s: string, y: number, size: number, font: 'sans' | 'sansBold' | 'serif' | 'serifBold' = 'sans', color = INK) =>
    b.text(s, cx - b.textWidth(s, size, font) / 2, y, { size, font, color });
  b.rect(cx - 18, 52, 36, 36, { fill: MAROON });
  b.rect(cx - 10, 60, 20, 20, { fill: rgb(1, 1, 1) });
  const issuerBox = centered('PERTUBUHAN KESELAMATAN SOSIAL (PERKESO)', 100, 12, 'sansBold', MAROON);
  centered('SOCIAL SECURITY ORGANISATION, MALAYSIA', 116, 9, 'sans', GREY);
  b.rec.add('issuer', 'PERTUBUHAN KESELAMATAN SOSIAL (PERKESO)', issuerBox, 0.93);
  centered('SIJIL PERLINDUNGAN MAJIKAN', 150, 16, 'serifBold');
  centered('EMPLOYER COVERAGE CERTIFICATE', 172, 11, 'serif');
  centered('Akta Keselamatan Sosial Pekerja 1969 (Akta 4) & Akta Sistem Insurans Pekerjaan 2017 (Akta 800)', 190, 8, 'sans', GREY);

  let y = 235;
  const row = (label: string, value: string | RelDate, opts: { bold?: boolean; faint?: boolean; size?: number } = {}) => {
    const box = b.labelValue(label, value, 70, y, 300, { size: opts.size ?? 11, font: opts.bold === false ? 'sans' : 'sansBold', faint: opts.faint }, { size: 9 });
    y += 26;
    return box;
  };
  const codeBox = row('Kod Majikan / Employer Code', co.socsoCode);
  b.rec.add('policy_no', co.socsoCode, codeBox, 0.94);
  const nameBox = row('Nama Majikan / Employer Name', co.name.toUpperCase());
  b.rec.add('company_name', co.name.toUpperCase(), nameBox, 0.96);
  b.rec.alias('company_name', 'insured_party', 0.9);
  row('No. Syarikat / Company No.', co.oldNo, { bold: false });
  b.text('Alamat / Address', 70, y, { size: 9, color: GREY });
  co.addressLines.forEach((l, i) => b.text(l, 300, y + i * 13, { size: 10 }));
  y += co.addressLines.length * 13 + 16;
  row('Skim / Scheme', 'Bencana Kerja & Keilatan / Employment Injury & Invalidity', { bold: false, size: 9.5 });
  row('Pekerja Dilindungi / Covered Employees', String(employees), { bold: false });
  const fromBox = row('Tempoh Perlindungan Dari / Coverage From', from.printed);
  b.rec.add('issue_date', from, fromBox, 0.93);
  const toBox = row('Tempoh Perlindungan Hingga / Coverage To', to.printed);
  b.rec.add('expiry_date', to, toBox, 0.94);
  y += 6;
  b.text('Had Perlindungan / Coverage Limit (per claim)', 70, y, { size: 9, color: GREY });
  const covBox = b.text(coverage.amount, 300, y, { size: 11, font: 'sansBold', faint: coverage.faint });
  b.rec.add('coverage_amount', coverage.amount, covBox, coverage.confidence);
  y += 40;
  y = b.paragraph(
    'Majikan di atas telah berdaftar dengan PERKESO dan caruman bagi tempoh yang dinyatakan telah diterima. / The employer above is registered with PERKESO and contributions for the stated period have been received.',
    70,
    y,
    A4.width - 140,
    { size: 9, font: 'serif' },
  );
  b.stamp(140, 660, ['PERKESO', 'DISAHKAN', 'SELANGOR'], MAROON);
  b.line(330, 670, 520, 670, { width: 0.6 });
  b.text('Pengurus Cawangan / Branch Manager', 330, 675, { size: 8, color: GREY });
  b.text('PERKESO Cawangan Petaling Jaya', 330, 686, { size: 8, color: GREY });
  b.text(`Rujukan: PKS/${co.socsoCode}/${to.printed.slice(-4)} | FICTIONAL DEMO DOCUMENT`, 70, 775, { size: 7, color: GREY });

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ LHDN tax clearance */
export async function taxClearance(outDir: string, fileName: string, co: Company, issued: RelDate, validUntil: RelDate): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.TAX_CLEARANCE, 0.95, 'LHDN letter confirming tax compliance with reference number and validity').init();
  let y = b.letterhead('LEMBAGA HASIL DALAM NEGERI MALAYSIA', ['Inland Revenue Board of Malaysia', 'Cawangan Petaling Jaya, Menara Hasil PJ, 46200 Petaling Jaya, Selangor'], NAVY);
  b.rec.add('issuer', 'LEMBAGA HASIL DALAM NEGERI MALAYSIA', { x: 80 / A4.width, y: 36 / A4.height, width: b.textWidth('LEMBAGA HASIL DALAM NEGERI MALAYSIA', 15, 'sansBold') / A4.width, height: 17 / A4.height }, 0.95);
  const refBox = b.labelValue('Ruj. Kami / Our Ref:', `LHDN/PJ/${co.taxRef.replace(/\s/g, '')}/SPC`, 40, y, 150, { size: 9, font: 'mono' }, { size: 9 });
  void refBox;
  const dateBox = b.labelValue('Tarikh / Date:', toLongDate(issued).printed, 380, y, 450, { size: 9 }, { size: 9 });
  b.rec.add('issue_date', toLongDate(issued), dateBox, 0.93);
  y += 30;
  b.text(co.name.toUpperCase(), 40, y, { size: 10, font: 'sansBold' });
  co.addressLines.forEach((l, i) => b.text(l, 40, y + 13 + i * 12, { size: 9 }));
  y += 13 + co.addressLines.length * 12 + 20;
  b.text('Tuan/Puan,', 40, y, { size: 10 });
  y += 24;
  b.text('SURAT PENGESAHAN PEMATUHAN CUKAI / TAX COMPLIANCE CONFIRMATION LETTER', 40, y, { size: 10, font: 'sansBold' });
  y += 24;
  const rows: Array<[string, string]> = [
    ['Nama Pembayar Cukai / Taxpayer', co.name.toUpperCase()],
    ['No. Rujukan Cukai / Tax Reference No.', co.taxRef],
    ['No. Pendaftaran Syarikat / Company No.', co.oldNo],
    ['Tahun Taksiran / Year of Assessment', String(new Date().getUTCFullYear() - 1)],
  ];
  const t = b.table(40, y, [200, A4.width - 80 - 200], rows, { header: false, size: 9, rowHeight: 22 });
  b.rec.add('company_name', co.name.toUpperCase(), t.cell(0, 1), 0.96);
  b.rec.add('tax_reference_no', co.taxRef, t.cell(1, 1), 0.95);
  b.rec.add('registration_no', co.oldNo, t.cell(2, 1), 0.92);
  y = t.bottom + 20;
  y = b.paragraph(
    'Dengan hormatnya perkara di atas adalah dirujuk. Disahkan bahawa pembayar cukai di atas telah mengemukakan borang nyata cukai pendapatan bagi tahun taksiran yang dinyatakan dan tidak mempunyai tunggakan cukai pada tarikh surat ini.',
    40,
    y,
    A4.width - 80,
    { size: 9.5, font: 'serif' },
  );
  y += 6;
  y = b.paragraph(
    'With reference to the above, we confirm that the taxpayer has submitted the income tax return for the stated year of assessment and has no outstanding tax as at the date of this letter.',
    40,
    y,
    A4.width - 80,
    { size: 9.5, font: 'serif', color: GREY },
  );
  y += 10;
  const validBox = b.labelValue('Surat ini sah sehingga / This letter is valid until:', validUntil.printed, 40, y, 300, { size: 10, font: 'sansBold' }, { size: 9.5 });
  b.rec.add('expiry_date', validUntil, validBox, 0.91);
  y += 40;
  b.text('Sekian, terima kasih.', 40, y, { size: 10 });
  b.text('"BERKHIDMAT UNTUK NEGARA"', 40, y + 18, { size: 9, font: 'sansBold' });
  b.text('Saya yang menjalankan amanah,', 40, y + 44, { size: 10 });
  b.line(40, y + 100, 200, y + 100, { width: 0.6 });
  b.text('Pengarah Cawangan / Branch Director', 40, y + 105, { size: 8, color: GREY });
  b.text('b.p. Ketua Pengarah Hasil Dalam Negeri', 40, y + 116, { size: 8, color: GREY });
  b.stamp(450, y + 70, ['LHDNM', 'CAWANGAN', 'PETALING JAYA'], NAVY);
  b.footer('Surat ini dijana oleh komputer dan tidak memerlukan tandatangan. FICTIONAL DEMO DOCUMENT.');

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ Bank reference letter (scan) */
export async function bankReferenceScan(
  outDir: string,
  fileName: string,
  co: Company,
  bank: string,
  issued: RelDate,
  accountSince: { printed: string; confidence: number; faint: boolean },
  seed: number,
): Promise<Generated> {
  const s = new ScanBuilder(fileName, DocType.BANK_REFERENCE, 0.9, "Scanned banker's reference letter on bank letterhead", seed);
  s.rect(90, 80, 64, 64, { fill: '#0f5132' });
  s.text('M', 103, 86, { size: 50, weight: 'bold', color: '#faf8f3' });
  const bankBox = s.text(bank.toUpperCase(), 175, 84, { size: 38, weight: 'bold', color: '#0f5132' });
  s.rec.add('issuer', bank.toUpperCase(), bankBox, 0.92);
  s.text('Cawangan Seri Kembangan | 2, Jalan Besar, 43300 Seri Kembangan, Selangor', 175, 132, { size: 20, color: '#55555a' });
  s.line(90, 175, SCAN.width - 90, 175, { color: '#0f5132', width: 4 });

  let y = 240;
  const dateBox = s.labelValue('Date:', toLongDate(issued).printed, 90, y, 200, { size: 26 });
  s.rec.add('issue_date', toLongDate(issued), dateBox, 0.91);
  s.text(`Our ref: BMB/SK/${co.oldNo.replace('-', '')}/REF`, SCAN.width - 90, y, { size: 22, color: '#55555a', alignRight: true });
  y += 80;
  s.text('TO WHOM IT MAY CONCERN', 90, y, { size: 28, weight: 'bold' });
  y += 70;
  s.text("RE: BANKER'S REFERENCE", 90, y, { size: 26, weight: 'bold' });
  y += 44;
  const nameBox = s.text(co.name.toUpperCase(), 90, y, { size: 26, weight: 'bold' });
  s.rec.add('company_name', co.name.toUpperCase(), nameBox, 0.94);
  y += 40;
  const regBox = s.labelValue('Company No.:', co.oldNo, 90, y, 300, { size: 26, weight: 'bold' });
  s.rec.add('registration_no', co.oldNo, regBox, 0.9);
  y += 80;

  const para = (t: string, size = 24, color = '#1b1b1f') => {
    const maxChars = Math.floor((SCAN.width - 180) / (size * 0.52));
    const words = t.split(' ');
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > maxChars) {
        s.text(line.trim(), 90, y, { size, color });
        y += size * 1.5;
        line = w;
      } else line = `${line} ${w}`;
    }
    if (line.trim()) {
      s.text(line.trim(), 90, y, { size, color });
      y += size * 1.5;
    }
    y += 14;
  };
  para(`We refer to your enquiry regarding the above-named customer and confirm that ${co.name} has maintained a current account with our Seri Kembangan branch`);
  const sinceLabel = s.text('since', 90, y, { size: 24 });
  const sinceBox = s.text(accountSince.printed, 90 + s.textWidth('since ', 24), y, { size: 24, faint: accountSince.faint, weight: 'bold' });
  s.rec.add('account_since', accountSince.printed, sinceBox, accountSince.confidence);
  void sinceLabel;
  s.text('and that the account has been conducted', 90 + s.textWidth(`since ${accountSince.printed} `, 24), y, { size: 24 });
  y += 36;
  const conductBox = s.text('satisfactorily', 90, y, { size: 24, weight: 'bold' });
  s.rec.add('conduct', 'satisfactorily', conductBox, 0.9);
  s.text('throughout the relationship. We are not aware of any returned cheques or', 90 + s.textWidth('satisfactorily ', 24) * 1.07, y, { size: 24 });
  y += 36;
  para('adverse records against the customer. The customer currently enjoys banking facilities with us within approved limits, which are regularly serviced.');
  para('This reference is given in confidence and without responsibility on the part of the Bank or its officers. It is provided at the request of the customer for the purpose of a tender submission.', 22, '#55555a');
  y += 30;
  s.text('Yours faithfully,', 90, y, { size: 24 });
  s.text(`for ${bank.toUpperCase()}`, 90, y + 36, { size: 22, weight: 'bold' });
  s.signature(110, y + 150);
  s.line(90, y + 170, 460, y + 170, { width: 2 });
  s.text('Branch Manager', 90, y + 182, { size: 22, color: '#55555a' });
  s.stamp(960, y + 110, [bank.split(' ')[0].toUpperCase(), 'SERI KEMBANGAN', 'BRANCH'], '#0f5132', 6);
  s.text('FICTIONAL DEMO DOCUMENT - NOT A REAL BANK LETTER', 90, 1680, { size: 18, color: '#8b1e26' });

  const filePath = path.join(outDir, fileName);
  await s.save(filePath, 'png');
  return { filePath, recording: s.rec.build(), pageCount: 1 };
}

/* ------------------------------------------------------------------ ISO certificate */
export async function isoCertificate(
  outDir: string,
  fileName: string,
  co: Company,
  o: { body: string; standard: string; system: string; certNo: string; scope: string; issue: RelDate; expiry: RelDate },
): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.ISO, 0.95, `${o.standard} certificate of registration from a certification body`).init();
  b.rect(26, 26, A4.width - 52, A4.height - 52, { stroke: rgb(0.72, 0.58, 0.2), lineWidth: 3 });
  b.rect(34, 34, A4.width - 68, A4.height - 68, { stroke: rgb(0.72, 0.58, 0.2), lineWidth: 0.6 });
  const cx = A4.width / 2;
  const centered = (s: string, y: number, size: number, font: 'sans' | 'sansBold' | 'serif' | 'serifBold' = 'serif', color = INK) =>
    b.text(s, cx - b.textWidth(s, size, font) / 2, y, { size, font, color });
  b.rect(cx - 20, 56, 40, 40, { fill: rgb(0.72, 0.58, 0.2) });
  b.rect(cx - 10, 66, 20, 20, { fill: rgb(1, 1, 1) });
  const bodyBox = centered(o.body, 108, 13, 'sansBold', rgb(0.45, 0.35, 0.1));
  b.rec.add('issuer', o.body, bodyBox, 0.94);
  centered('Accredited certification body | Reg. No. CB-0098', 126, 8, 'sans', GREY);
  centered('CERTIFICATE OF REGISTRATION', 170, 22, 'serifBold');
  centered(`This is to certify that the ${o.system} of`, 215, 11, 'serif');
  const nameBox = centered(co.name.toUpperCase(), 240, 17, 'serifBold');
  b.rec.add('company_name', co.name.toUpperCase(), nameBox, 0.97);
  co.addressLines.forEach((l, i) => centered(l, 268 + i * 13, 10, 'serif', GREY));
  let y = 268 + co.addressLines.length * 13 + 16;
  centered('has been assessed and registered as meeting the requirements of', y, 11, 'serif');
  const stdBox = centered(o.standard, y + 22, 20, 'sansBold', rgb(0.45, 0.35, 0.1));
  b.rec.add('standard', o.standard, stdBox, 0.98);
  y += 60;
  centered('for the following scope:', y, 10, 'serif', GREY);
  y += 16;
  const scopeBox = b.text(o.scope, cx - b.textWidth(o.scope, 10, 'serif') / 2, y, { size: 10, font: 'serif' });
  b.rec.add('scope', o.scope, scopeBox, 0.89);
  y += 50;
  const certBox = b.labelValue('Certificate No.', o.certNo, 120, y, 260, { size: 11, font: 'sansBold' }, { size: 9 });
  b.rec.add('certificate_no', o.certNo, certBox, 0.96);
  y += 24;
  const issueBox = b.labelValue('Date of Issue', o.issue.printed, 120, y, 260, { size: 11, font: 'sansBold' }, { size: 9 });
  b.rec.add('issue_date', o.issue, issueBox, 0.95);
  y += 24;
  const expiryBox = b.labelValue('Valid Until', o.expiry.printed, 120, y, 260, { size: 11, font: 'sansBold' }, { size: 9 });
  b.rec.add('expiry_date', o.expiry, expiryBox, 0.96);
  y += 24;
  b.labelValue('Original Registration', rel(-1100, 'dd/MM/yyyy').printed, 120, y, 260, { size: 10 }, { size: 9 });
  b.stamp(150, 680, [o.body.split(' ')[0].toUpperCase(), 'CERTIFIED', o.standard.split(':')[0]], rgb(0.45, 0.35, 0.1));
  b.line(330, 690, 520, 690, { width: 0.6 });
  b.text('Head of Certification', 330, 695, { size: 8, color: GREY });
  b.text(o.body, 330, 706, { size: 8, color: GREY });
  b.text('This certificate remains the property of the certification body and is subject to annual surveillance audits. FICTIONAL DEMO DOCUMENT.', 60, 775, { size: 7, color: GREY });

  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}

/* ------------------------------------------------------------------ Misc: brochure (OTHER) */
export async function brochure(outDir: string, fileName: string, co: Company): Promise<Generated> {
  const b = await new PdfBuilder(fileName, DocType.OTHER, 0.9, 'Marketing brochure; not a compliance document').init();
  b.rect(0, 0, A4.width, 220, { fill: NAVY });
  const titleBox = b.text("Building Malaysia's Future", 40, 70, { size: 28, font: 'sansBold', color: rgb(1, 1, 1) });
  b.rec.add('title', "Building Malaysia's Future", titleBox, 0.88);
  const nameBox = b.text(`${co.name} | Company Brochure`, 40, 115, { size: 13, color: rgb(0.85, 0.9, 1) });
  b.rec.add('company_name', co.name, { ...nameBox, width: b.textWidth(co.name, 13) / A4.width }, 0.86);
  let y = 260;
  b.text('Who we are', 40, y, { size: 14, font: 'sansBold', color: NAVY });
  y = b.paragraph(
    `${co.name} is a Selangor-based contractor delivering building and civil engineering works for public and private clients. Founded in ${co.incorporated.slice(-4)}, we combine an experienced site team with modern planning tools to deliver projects safely, on time and within budget.`,
    40,
    y + 22,
    A4.width - 80,
    { size: 10 },
  );
  b.text('What we do', 40, y + 14, { size: 14, font: 'sansBold', color: NAVY });
  y = b.paragraph(
    'Earthworks and drainage | Roads and bridges | Industrial buildings | Site offices and temporary works | Mechanical and electrical fit-out.',
    40,
    y + 36,
    A4.width - 80,
    { size: 10 },
  );
  b.text('Selected projects', 40, y + 14, { size: 14, font: 'sansBold', color: NAVY });
  b.table(40, y + 36, [260, 130, 125], [
    ['Project', 'Client', 'Value'],
    ['Sungai Langat retention pond, Phase 2', 'Fictional Water Authority', 'RM 4.2 million'],
    ['Kajang industrial park access road', 'Fictional Township Developer', 'RM 2.8 million'],
    ['Seri Kembangan community hall', 'Fictional Local Council', 'RM 1.9 million'],
  ], { size: 9 });
  b.text(`Contact: ${co.phone} | ${co.email}`, 40, 740, { size: 9, color: GREY });
  b.text('FICTIONAL DEMO DOCUMENT', 40, 755, { size: 7, color: MAROON });
  const filePath = path.join(outDir, fileName);
  const { pageCount } = await b.save(filePath);
  return { filePath, recording: b.rec.build(), pageCount };
}
